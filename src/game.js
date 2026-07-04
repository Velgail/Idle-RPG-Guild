// オーケストレーション：1tick と 1日境界の処理を組み立てる（DOM非依存＝テスト可能）。
import { CONFIG } from './config.js';
import { simTick } from './sim.js';
import { accrueTickIncome, settleDaily, checkCatastrophe, endGame } from './economy.js';
import { runSecretary } from './gambit.js';
import { demonReadDaily, applyPendingPreset } from './demon.js';
import { logEvent } from './state.js';

// 1tick を進める。破局していたら何もしない。
export function stepTick(state) {
  if (state.over) return;

  const isDayStart = state.time.tick % state.time.ticksPerDay === 0;

  if (isDayStart) {
    // 日の頭：魔王が前日の合図で決めたプリセットを適用 → 秘書が新しい合図を組む → 魔王が読む
    applyPendingPreset(state);
    runSecretary(state);
    demonReadDaily(state);
  }

  const { fee } = simTick(state);
  accrueTickIncome(state, fee);

  state.time.tick++;

  // 日の変わり目
  if (state.time.tick % state.time.ticksPerDay === 0) {
    state.time.day++;
    settleDaily(state);

    const reason = checkCatastrophe(state);
    if (reason) {
      endGame(state, reason);
      return;
    }
  }

  // 勇者緊急召喚（元HALT）：攻略が近づいたら自動で一時停止し、プレイヤーを呼ぶ
  maybeSummon(state);
}

function maybeSummon(state) {
  if (state.summon.active) return;
  if (state.gauges.clear >= CONFIG.summon.clearWarn) {
    state.summon.active = true;
    state.summon.reason = `攻略進捗 ${state.gauges.clear.toFixed(0)}% — 先頭パーティが最深に接近`;
    state.time.paused = true;
    logEvent(state, `【勇者緊急召喚】${state.summon.reason}`);
  }
}

// プレイヤーが対応して再開するときに呼ぶ
export function acknowledgeSummon(state) {
  state.summon.active = false;
  state.summon.reason = '';
}
