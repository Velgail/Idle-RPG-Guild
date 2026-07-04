// 魔王軍：1日1回、盤面の粗い特徴を読んで応答表からプリセットを選ぶ（＝翌日適用）。
import { CONFIG } from './config.js';
import { coarseRead } from './board.js';
import { logEvent } from './state.js';

// 「1日1回」魔王が盤面を読み、翌日のプリセットを決める。
export function demonReadDaily(state) {
  const { dominant } = coarseRead(state.board);
  const presetId = state.responseTable[dominant] || 'normal';
  state.dungeon.pendingPresetId = presetId;
}

// 翌日の頭で pending を実際に適用する（魔王は粗い＆低頻度）。
export function applyPendingPreset(state) {
  const preset = CONFIG.presets[state.dungeon.pendingPresetId] || CONFIG.presets.normal;
  if (state.dungeon.preset.id !== preset.id) {
    logEvent(state, `魔王軍がダンジョンを『${preset.label}』に再編（合図: ${describeSignal(state)}）`);
  }
  state.dungeon.preset = preset;
}

function describeSignal(state) {
  const { dominant, total } = coarseRead(state.board);
  const name = { R: '赤', G: '緑', B: '青', none: '無/曖昧' }[dominant];
  return `${name}×${total}`;
}
