// ブート＋ゲームループ。可変速セッションtick（D-25）。
import { CONFIG } from './config.js';
import { createInitialState } from './state.js';
import { stepTick, acknowledgeSummon } from './game.js';
import { cycleSlot } from './board.js';
import { initUI, render } from './ui.js';

let state = createInitialState(Date.now() % 2147483647 | 0);

const handlers = {
  onCycleSlot(i) {
    cycleSlot(state.board, i);
    state.board.manualOverride = true; // 手で置いたら秘書の自動配置を止める
  },
  onToggleOverride(v) {
    state.board.manualOverride = v;
  },
  onSetResponse(color, presetId) {
    state.responseTable[color] = presetId;
  },
  onSetGambit(key, val) {
    if (Number.isFinite(val)) state.gambit[key] = val;
  },
  onSpeed(mult) {
    state.time.speed = mult;
  },
  onTogglePause() {
    if (state.over) return;
    state.summon.active = false;
    state.time.paused = !state.time.paused;
  },
  onReset() {
    state = createInitialState(Date.now() % 2147483647 | 0);
  },
  onModalAction() {
    if (state.over) {
      handlers.onReset();
    } else if (state.summon.active) {
      acknowledgeSummon(state);
      state.time.paused = false; // 勇者が対応 → 再開
    }
  },
};

const ui = initUI(handlers);

let acc = 0;
let last = performance.now();

function loop(now) {
  const dt = now - last;
  last = now;

  if (!state.time.paused && !state.over && !state.summon.active) {
    acc += dt;
    const interval = CONFIG.time.tickMs / state.time.speed;
    let steps = 0;
    while (acc >= interval && steps < 8) {
      stepTick(state);
      acc -= interval;
      steps++;
      if (state.over || state.summon.active) break;
    }
  } else {
    acc = 0;
  }

  ui.render(state);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
