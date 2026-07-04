// 世界のシミュレーション（1tick）：冒険者の潜行・成長・生死、人口フロー。
import { CONFIG } from './config.js';
import { makeAdventurer, logEvent } from './state.js';
import { countAlive } from './gambit.js';

// あるフロアの難度。プリセットで深層バイアスが乗る。
// depth=1 で約 1.0（Lv1 が越えられる）、深層で急峻に。
function floorDifficulty(state, depth) {
  const p = state.dungeon.preset;
  const deep = depth >= 6 ? p.deepBias * (depth - 5) : 0;
  return depth * p.diffBase + deep;
}

// 1tick 分の世界更新。income（この tick の手数料収入）を返す。
export function simTick(state) {
  const rng = state.rng;
  const pop = state.population;
  let fee = 0;
  let delveEvents = 0;

  // --- 流入（評判＝旨味に比例、softCap で鈍化）---
  const alive = countAlive(state);
  const capFactor = Math.max(0, 1 - alive / CONFIG.population.softCap);
  pop.inflowAccum += CONFIG.population.inflowBase * (0.4 + state.gauges.reputation) * capFactor;
  while (pop.inflowAccum >= 1) {
    pop.inflowAccum -= 1;
    const a = makeAdventurer(rng, pop.nextId++);
    pop.adventurers.push(a);
    state.stats.inflow++;
  }

  // --- 各冒険者の行動 ---
  const floors = state.dungeon.floors;
  for (const a of pop.adventurers) {
    if (!a.alive) continue;

    // 低HPは休養（自己保存）：潜らず回復。
    if (a.hp < a.maxHp * 0.4) {
      a.hp = Math.min(a.maxHp, a.hp + 4);
      a.morale = Math.max(0, a.morale - 0.01);
      continue;
    }

    const pushTarget = a.floor + 1;
    // 期待実力(平均 1.15×level)が難度に届いて初めて前進を試みる。
    // 届かないうちは撤退して安全フロアで稼ぐ（自滅を防ぎ、強者だけが突破する）。
    const canPush =
      pushTarget <= floors && a.level * 1.15 >= floorDifficulty(state, pushTarget);

    delveEvents++;
    state.stats.delves++;
    const power = a.level * (0.9 + 0.5 * rng());

    if (canPush) {
      // 前進を試みる
      const diff = floorDifficulty(state, pushTarget);
      if (power >= diff) {
        a.floor = pushTarget;
        const reward = (1.5 + pushTarget * 1.2) * state.dungeon.preset.reward;
        a.gold += reward;
        fee += reward * CONFIG.economy.feeRate;
        a.level += 0.12;
        a.morale = Math.min(1, a.morale + 0.05);
        a.hp = Math.min(a.maxHp, a.hp + 2);
      } else {
        const dmg = (diff - power) * 2.2 + 2;
        a.hp -= dmg;
        a.morale = Math.max(0, a.morale - 0.06);
        if (a.hp <= 0) killAdventurer(state, a, pushTarget);
      }
    } else if (a.floor >= 1) {
      // 撤退して既踏破フロアで安全に稼ぐ（out-level farming）
      const fd = floorDifficulty(state, a.floor);
      if (power >= fd) {
        const reward = (0.8 + a.floor * 0.6) * state.dungeon.preset.reward;
        a.gold += reward;
        fee += reward * CONFIG.economy.feeRate;
        a.level += 0.05;
        a.morale = Math.min(1, a.morale + 0.02);
      } else {
        // 稼ぎ場でも稀に事故る
        a.hp -= (fd - power) * 1.2 + 1;
        a.morale = Math.max(0, a.morale - 0.03);
        if (a.hp <= 0) killAdventurer(state, a, a.floor);
      }
    } else {
      // 地上（floor 0）でまだ何も踏破していない弱者：フロア1へ挑む
      const diff = floorDifficulty(state, 1);
      if (power >= diff) {
        a.floor = 1;
        const reward = 2 * state.dungeon.preset.reward;
        a.gold += reward;
        fee += reward * CONFIG.economy.feeRate;
        a.level += 0.1;
      } else {
        a.hp -= (diff - power) * 2 + 1;
        a.morale = Math.max(0, a.morale - 0.05);
        if (a.hp <= 0) killAdventurer(state, a, 1);
      }
    }
  }

  // --- 引退・流出 ---
  for (const a of pop.adventurers) {
    if (!a.alive) continue;
    // 引退：十分強く稼いだら去る（世代交代の芽）
    if (a.level >= 8 && a.gold >= 120 && rng() < 0.03) {
      a.alive = false;
      state.stats.retires++;
      logEvent(state, `${a.name} が引退（Lv${a.level.toFixed(0)}, ${a.gold | 0}G）`);
      continue;
    }
    // 流出：士気が尽きたら旨味なしと見て他所へ
    if (a.morale <= 0.02 && rng() < 0.06) {
      a.alive = false;
      state.stats.outflow++;
      state.gauges.reputation = Math.max(0, state.gauges.reputation - 0.005);
      continue;
    }
  }

  // 死亡・離脱した個体を間引く（配列肥大を防ぐ）
  if (state.time.tick % CONFIG.time.ticksPerDay === 0) {
    pop.adventurers = pop.adventurers.filter((a) => a.alive);
  }

  // --- ゲージ更新 ---
  updateGauges(state, delveEvents, alive);

  return { fee, delveEvents };
}

function killAdventurer(state, a, depth) {
  a.alive = false;
  state.stats.deaths++;
  state.gauges.reputation = Math.max(0, state.gauges.reputation - 0.015);
  logEvent(state, `${a.name}(Lv${a.level.toFixed(0)}) が F${depth} で死亡`);
}

function updateGauges(state, delveEvents, alive) {
  // 循環：1人あたりの活動量を平滑化
  const activity = alive > 0 ? Math.min(1, delveEvents / alive) : 0;
  const k = CONFIG.gauges.fluxSmoothing;
  state.gauges.flux = state.gauges.flux * (1 - k) + activity * k;

  // 攻略進捗：先頭（最深到達）/ floors
  let deepest = 0;
  for (const a of state.population.adventurers) {
    if (a.alive && a.floor > deepest) deepest = a.floor;
  }
  state.gauges.clear = (deepest / state.dungeon.floors) * 100;

  // 評判：成功が続けば緩やかに回復
  state.gauges.reputation = Math.min(1, state.gauges.reputation + delveEvents * 0.0006);
}
