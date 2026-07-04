// 8ボード：秘匿チャネル。プレイヤー/ガンビットが色を置き、魔王は「粗い特徴」で読む。
export const COLORS = ['R', 'G', 'B'];
export const COLOR_CYCLE = [null, 'R', 'G', 'B'];

// クリックで空→R→G→B→空 と循環
export function cycleSlot(board, index) {
  const cur = board.slots[index];
  const i = COLOR_CYCLE.indexOf(cur);
  board.slots[index] = COLOR_CYCLE[(i + 1) % COLOR_CYCLE.length];
}

export function setAll(board, color) {
  for (let i = 0; i < board.slots.length; i++) board.slots[i] = color;
}

export function clearBoard(board) {
  setAll(board, null);
}

// 魔王の“粗い読み”：支配色（最多の色）と総数を返す。
// 設計 D-20/D-21：256通りの精密符号ではなく、粗い特徴で読む。
export function coarseRead(board) {
  const counts = { R: 0, G: 0, B: 0 };
  let total = 0;
  for (const s of board.slots) {
    if (s && counts[s] !== undefined) {
      counts[s]++;
      total++;
    }
  }
  let dominant = 'none';
  let best = 0;
  for (const c of COLORS) {
    if (counts[c] > best) {
      best = counts[c];
      dominant = c;
    }
  }
  // 同数タイなら none 扱い（曖昧＝魔王が読み切れない）
  const ties = COLORS.filter((c) => counts[c] === best && best > 0);
  if (ties.length > 1) dominant = 'none';
  return { dominant, counts, total };
}
