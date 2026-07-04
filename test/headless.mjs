// ヘッドレス検証：ブラウザ無しで sim を回し、破綻なく動くかを確かめる。
import { createInitialState } from '../src/state.js';
import { stepTick, acknowledgeSummon } from '../src/game.js';
import { countAlive } from '../src/gambit.js';

function run(seed, maxDays, autoAck = true) {
  const state = createInitialState(seed);
  state.time.paused = false;
  let guard = 0;
  const maxTicks = maxDays * state.time.ticksPerDay + 5;
  while (!state.over && state.time.day < maxDays && guard < maxTicks) {
    guard++;
    if (state.summon.active) {
      if (autoAck) acknowledgeSummon(state);
      else break;
    }
    stepTick(state);
  }
  return state;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓', msg);
  }
}

console.log('--- headless sim check ---');

// 1) 数日回してクラッシュせず、ゲージが有効範囲に留まる
{
  const s = run(12345, 30);
  console.log(`  day=${s.time.day} clear=${s.gauges.clear.toFixed(1)} flux=${s.gauges.flux.toFixed(2)} rep=${s.gauges.reputation.toFixed(2)} treasury=${s.economy.treasury.toFixed(1)} alive=${countAlive(s)} over=${s.over || '継続'}`);
  console.log(`  parties=${s.parties.list.length} stats:`, JSON.stringify(s.stats));
  assert(Number.isFinite(s.gauges.clear) && s.gauges.clear >= 0 && s.gauges.clear <= 100, 'clear は 0..100');
  assert(Number.isFinite(s.gauges.flux) && s.gauges.flux >= 0 && s.gauges.flux <= 1, 'flux は 0..1');
  assert(Number.isFinite(s.economy.treasury), 'treasury は有限');
  assert(s.time.day >= 1, '少なくとも1日は進む');
  assert(s.stats.delves > 0, '潜行イベントが発生する');
  assert(s.stats.formed > 0, 'パーティが自発編成される (D-31)');
  // 個体は必ず class と traits を持つ（構造化モデル）
  const sample = s.population.adventurers[0];
  assert(sample && sample.classId && sample.traits, '冒険者は class と traits を持つ');
}

// 2) 決定論：同じ seed は同じ結果
{
  const a = run(999, 20);
  const b = run(999, 20);
  assert(a.gauges.clear === b.gauges.clear && a.economy.treasury === b.economy.treasury, '同 seed は決定論的');
}

// 3) 応答表を壊す（全部 ease）と攻略が進みやすい → 破局に到達しうる
{
  const s = createInitialState(2024);
  s.responseTable.R = 'ease';
  s.responseTable.G = 'ease';
  s.responseTable.B = 'ease';
  s.gambit.deepenAtClear = 999; // 深層強化しない
  s.time.paused = false;
  let guard = 0;
  while (!s.over && s.time.day < 120 && guard < 5000) {
    guard++;
    if (s.summon.active) acknowledgeSummon(s);
    stepTick(s);
  }
  console.log(`  [ease-only] day=${s.time.day} clear=${s.gauges.clear.toFixed(1)} over=${s.over || '継続'}`);
  assert(s.over !== null || s.gauges.clear > 50, '緩和一辺倒だと攻略が進む/破局しうる');
}

// 4) 緊急召喚が発火し、放置すると止まる（autoAck=false）
{
  const s = createInitialState(2024);
  s.responseTable.R = 'ease';
  s.responseTable.B = 'ease';
  s.gambit.deepenAtClear = 999;
  s.time.paused = false;
  let guard = 0;
  while (!s.over && !s.summon.active && s.time.day < 200 && guard < 8000) {
    guard++;
    stepTick(s);
  }
  console.log(`  [summon] active=${s.summon.active} reason="${s.summon.reason}" clear=${s.gauges.clear.toFixed(1)}`);
  assert(s.summon.active || s.over, '攻略接近で勇者緊急召喚が発火する');
}

console.log(process.exitCode ? '--- FAILED ---' : '--- OK ---');
