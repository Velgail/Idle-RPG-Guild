// 経済と破局判定。収入=手数料+街の消費、支出=秘書人件費+魔王への循環維持コスト。
import { CONFIG } from './config.js';
import { logEvent } from './state.js';
import { countAlive } from './gambit.js';

// 毎tick：手数料 + 街の消費を計上
export function accrueTickIncome(state, fee) {
  const alive = countAlive(state);
  const town = alive * CONFIG.economy.townConsumePerCapita;
  state.economy.treasury += fee + town;
}

// 1日1回：支出（人件費・魔王コスト）を引き、破局判定を進める
export function settleDaily(state) {
  const e = CONFIG.economy;
  const demonUpkeep = e.demonUpkeepPerDay + (state.gauges.clear / 100) * e.demonUpkeepPerClear * state.dungeon.floors;
  const expense = e.secretarySalaryPerDay + demonUpkeep;
  state.economy.treasury -= expense;

  // 破産ストリーク
  if (state.economy.treasury < e.bankruptFloor) {
    state.economy.bankruptStreak++;
  } else {
    state.economy.bankruptStreak = 0;
  }

  // 循環停滞ストリーク
  if (state.gauges.flux < CONFIG.gauges.fluxFloor) {
    state.fluxStagnantStreak++;
  } else {
    state.fluxStagnantStreak = 0;
  }
}

// 破局（唯一の終わり）判定。理由文字列を返す or null。
export function checkCatastrophe(state) {
  if (state.gauges.clear >= 100) {
    return 'ダンジョンが攻略された — 世界の循環が断たれた';
  }
  if (state.economy.bankruptStreak >= CONFIG.economy.bankruptDays) {
    return 'ギルドが破産した';
  }
  if (state.fluxStagnantStreak >= CONFIG.gauges.fluxStagnantDays) {
    return '循環が停滞した — 世界のバランスが崩れた';
  }
  return null;
}

export function endGame(state, reason) {
  state.over = reason;
  state.time.paused = true;
  logEvent(state, `【破局】${reason}（${state.time.day}日目）`);
}
