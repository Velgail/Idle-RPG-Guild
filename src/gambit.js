// 秘書のガンビット（MVP）：状態を感知し、盤面に合図を置く自動運用。
// 設計 D-15 では独自DSLだが、v0 は閾値つき条件→行動の“芽”。
// 併せて先頭パーティのタグ付け（D-19：集計＋タグ付け個体）を行う。
import { setAll, clearBoard } from './board.js';

// 先頭（最深到達）の冒険者に 'front' タグを付け直す。
export function retagFrontrunner(state) {
  let front = null;
  for (const a of state.population.adventurers) {
    if (!a.alive) continue;
    if (!front || a.floor > front.floor || (a.floor === front.floor && a.level > front.level)) {
      front = a;
    }
  }
  for (const a of state.population.adventurers) {
    a.tags = a.tags.filter((t) => t !== 'front');
  }
  if (front) front.tags.push('front');
  return front;
}

// 秘書が1日1回、盤面（＝魔王への合図）を更新する。
// 手動オーバーライド中はプレイヤーの配置を尊重して触らない。
export function runSecretary(state) {
  retagFrontrunner(state);
  if (state.board.manualOverride) return;

  const g = state.gambit;
  const clear = state.gauges.clear;
  const flux = state.gauges.flux;
  const pop = countAlive(state);

  // 優先度順（上が強い）：攻略が近い → 深層強化を最優先で合図。
  if (clear >= g.deepenAtClear) {
    setAll(state.board, 'R'); // 深層強化を要請
    return;
  }
  // 循環が低い or 人口が少ない → 誘引・緩和。
  if (flux < g.easeAtFlux || pop < g.minPopulation) {
    setAll(state.board, 'B');
    return;
  }
  // 平時 → 通常（合図を薄く：緑）。
  setAll(state.board, 'G');
}

export function countAlive(state) {
  let n = 0;
  for (const a of state.population.adventurers) if (a.alive) n++;
  return n;
}
