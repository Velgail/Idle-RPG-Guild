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
  const nParties = state.parties.list.filter((p) => p.alive).length;
  const secretary = e.secretarySalaryBase + e.secretarySalaryPerParty * nParties;
  // 循環維持コスト：現在プリセットの upkeep（深層強化は高い）＋攻略進捗比例＋逓増クロック
  const demonUpkeep =
    (state.dungeon.preset.upkeep || 0) +
    e.demonUpkeepPerClear * state.gauges.clear +
    e.demonUpkeepGrowthPerDay * state.time.day;
  const expense = secretary + demonUpkeep;
  state.economy.lastDayNet = -expense; // 収入はtick計上、ここでは支出のみ差引
  state.economy.treasury -= expense;

  // --- 循環 Flux（日次）：先頭で衝突しているか＝今日フロンティアに挑めたパーティの割合 ---
  // deepen で壁になると先頭が farm に留まり flux↓（過剰抑制は停滞破局を招く）。
  const active = state.parties.list.filter((p) => p.alive);
  const advanced = active.filter((p) => p.advancedToday).length;
  const g = CONFIG.gauges;
  const dailyActivity = Math.min(1, advanced / Math.max(g.expectedParties, 1));
  state.gauges.flux = state.gauges.flux * (1 - g.fluxDailySmoothing) + dailyActivity * g.fluxDailySmoothing;

  // --- 評判（日次減衰）：戦死や停滞で旨味が忘れられていく ---
  state.gauges.reputation = Math.max(0, state.gauges.reputation - g.reputationDecayPerDay);

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
