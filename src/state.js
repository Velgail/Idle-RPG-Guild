// 状態の定義と初期化。機能ごとに分離した“変数”をここで一括生成する。
import { CONFIG } from './config.js';
import { makeRng, pick } from './rng.js';
import { CLASS_IDS, classOf } from './classes.js';

const NAME_A = ['アル', 'ベル', 'カイ', 'ドラ', 'エル', 'フィ', 'グレ', 'ハル', 'イリ', 'ジン', 'クロ', 'レン', 'ミナ', 'ノア', 'オル', 'ピア'];
const NAME_B = ['ド', 'ン', 'ヴァ', 'ス', 'ク', 'ミ', 'ル', 'ト', 'ア', 'ゼ', 'グ', 'リ'];

export function makeAdventurer(rng, id, level = CONFIG.population.startLevel) {
  const classId = pick(rng, CLASS_IDS);
  const cls = classOf(classId);
  const maxHp = Math.round(CONFIG.population.startHp * cls.hpMul * (1 + (level - 1) * 0.1));
  return {
    id,
    name: pick(rng, NAME_A) + pick(rng, NAME_B),
    classId,
    level,
    hp: maxHp,
    maxHp,
    morale: 0.6, // 0..1
    gold: 0,
    // 特性：自発編成/転職/解散の判断に使う（D-31/32/33）
    traits: {
      socia: rng(), // 社交性（編成の相性）
      ambition: rng(), // 野心（前進の積極性）
      caution: rng(), // 慎重さ（撤退・休養の閾値）
    },
    partyId: null,
    stallDays: 0,
    alive: true,
    tags: [], // 'front' 等。ガンビットが付ける（D-19）
  };
}

export function createInitialState(seed = 12345) {
  const rng = makeRng(seed);
  const adventurers = [];
  for (let i = 0; i < CONFIG.population.start; i++) {
    adventurers.push(makeAdventurer(rng, i));
  }

  return {
    seed,
    rng,

    time: { tick: 0, day: 0, ticksPerDay: CONFIG.time.ticksPerDay, speed: 1, paused: true },

    gauges: {
      flux: 0.5, // 循環：活動量（平滑）
      clear: 0, // 攻略進捗 0..100（先頭パーティの最深到達 / floors）
      reputation: CONFIG.gauges.reputationStart, // マクロ旨味
    },

    economy: {
      treasury: CONFIG.economy.startTreasury,
      lastDayNet: 0,
      bankruptStreak: 0,
    },

    population: {
      adventurers, // 個体（自由/所属を問わず全員）
      nextId: adventurers.length,
      inflowAccum: 0,
    },

    parties: { list: [], nextId: 0 }, // 潜行単位。冒険者が自発編成する（D-31）

    dungeon: {
      floors: CONFIG.dungeon.floors,
      preset: CONFIG.presets.normal,
      pendingPresetId: 'normal',
    },

    board: { slots: new Array(8).fill(null), manualOverride: false },

    gambit: { deepenAtClear: 65, easeAtFlux: 0.3, minPopulation: 6 },

    responseTable: { R: 'deepen', G: 'normal', B: 'ease', none: 'normal' },

    summon: { active: false, reason: '' },

    fluxStagnantStreak: 0,
    log: [],
    over: null,
    stats: { delves: 0, deaths: 0, retires: 0, inflow: 0, outflow: 0, formed: 0, disbanded: 0, jobChanges: 0 },
  };
}

export function logEvent(state, msg) {
  state.log.unshift({ day: state.time.day, tick: state.time.tick, msg });
  if (state.log.length > 140) state.log.pop();
}

// 便利アクセサ
export function adventurerById(state, id) {
  return state.population.adventurers.find((a) => a.id === id) || null;
}
export function partyMembers(state, party) {
  return party.memberIds.map((id) => adventurerById(state, id)).filter((a) => a && a.alive);
}
