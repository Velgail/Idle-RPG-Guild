// オーケストレーション：1tick と 1日境界の処理を組み立てる（DOM非依存＝テスト可能）。
import { CONFIG } from './config.js';
import { simTick } from './sim.js';
import { accrueTickIncome, settleDaily, checkCatastrophe, endGame } from './economy.js';
import { runSecretary } from './gambit.js';
import { demonReadDaily, applyPendingPreset } from './demon.js';
import { formParties, considerJobChange, disbandChecks } from './party.js';
import { logEvent } from './state.js';

// 1日1回の冒険者ライフサイクル（停滞→転職→解散→再編成）。
function dailyPartyPhase(state) {
  // 停滞日数の更新（前日からフロアが進んだか）
  for (const party of state.parties.list) {
    if (!party.alive) continue;
    if (party.floorAtDayStart === undefined) party.floorAtDayStart = party.floor;
    if (party.floor > party.floorAtDayStart) party.stallDays = 0;
    else party.stallDays++;
    party.floorAtDayStart = party.floor;
    party.advancedToday = false; // 新しい日：前進枠をリセット
  }
  // 停滞パーティの自発転職（D-32）
  for (const party of state.parties.list) {
    if (party.alive) considerJobChange(state, party);
  }
  // 解散判定（D-33）→ 余った個体は再編成プールへ
  disbandChecks(state);
  // 自由な冒険者の自発編成（D-31）
  formParties(state);
}

// 1tick を進める。破局していたら何もしない。
export function stepTick(state) {
  if (state.over) return;

  const isDayStart = state.time.tick % state.time.ticksPerDay === 0;
  if (isDayStart) {
    applyPendingPreset(state); // 魔王が前日の合図で決めたプリセットを適用
    dailyPartyPhase(state); // 冒険者ライフサイクル
    runSecretary(state); // 秘書が新しい合図を組む（先頭タグ付け含む）
    demonReadDaily(state); // 魔王が盤面を読み、翌日のプリセットを決める
  }

  const { fee } = simTick(state);
  accrueTickIncome(state, fee);

  state.time.tick++;

  if (state.time.tick % state.time.ticksPerDay === 0) {
    state.time.day++;
    settleDaily(state);
    const reason = checkCatastrophe(state);
    if (reason) {
      endGame(state, reason);
      return;
    }
  }

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

export function acknowledgeSummon(state) {
  state.summon.active = false;
  state.summon.reason = '';
}
