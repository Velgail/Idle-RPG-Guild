// 秘書のガンビット（MVP）：状態を感知し、盤面に合図を置く自動運用。
// 設計 D-15 では独自DSLだが、v0 は閾値つき条件→行動の“芽”。
// 先頭パーティのタグ付け（D-18/D-19）も行う。
import { setAll } from './board.js';
import { partyMembers } from './state.js';

export function countAlive(state) {
  let n = 0;
  for (const a of state.population.adventurers) if (a.alive) n++;
  return n;
}

// 先頭（最深到達）パーティのメンバーに 'front' タグを付け直す。
export function retagFrontrunner(state) {
  let front = null;
  for (const p of state.parties.list) {
    if (!p.alive) continue;
    if (!front || p.floor > front.floor) front = p;
  }
  for (const a of state.population.adventurers) {
    if (a.tags.length) a.tags = a.tags.filter((t) => t !== 'front');
  }
  if (front) {
    for (const m of partyMembers(state, front)) m.tags.push('front');
  }
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

  if (clear >= g.deepenAtClear) {
    setAll(state.board, 'R'); // 深層強化を要請
    return;
  }
  if (flux < g.easeAtFlux || pop < g.minPopulation) {
    setAll(state.board, 'B'); // 誘引・緩和
    return;
  }
  setAll(state.board, 'G'); // 平時
}
