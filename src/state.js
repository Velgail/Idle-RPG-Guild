// 状態の定義と初期化。機能ごとに分離した“変数”をここで一括生成する。
import { CONFIG } from './config.js';
import { makeRng, pick } from './rng.js';

const NAME_A = ['アル', 'ベル', 'カイ', 'ドラ', 'エル', 'フィ', 'グレ', 'ハル', 'イリ', 'ジン', 'クロ', 'レン', 'ミナ', 'ノア', 'オル', 'ピア'];
const NAME_B = ['ド', 'ン', 'ヴァ', 'ス', 'ク', 'ミ', 'ル', 'ト', 'ア', 'ゼ', 'グ', 'リ'];

export function makeAdventurer(rng, id) {
  return {
    id,
    name: pick(rng, NAME_A) + pick(rng, NAME_B),
    level: CONFIG.population.startLevel,
    hp: CONFIG.population.startHp,
    maxHp: CONFIG.population.startHp,
    morale: 0.6, // 0..1
    gold: 0,
    floor: 0, // 到達した最深フロア（0 = 地上）
    alive: true,
    tags: [], // 例: 'front'（先頭パーティ）。ガンビットがタグ付けする。
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

    time: {
      tick: 0,
      day: 0,
      ticksPerDay: CONFIG.time.ticksPerDay,
      speed: 1, // 倍速（可変速セッションtick）
      paused: true,
    },

    // ゲージ（バンドを外れたら破局）
    gauges: {
      flux: 0.5, // 循環：活動量（平滑）
      clear: 0, // 攻略進捗 0..100（frontrunner の最深到達 / floors）
      reputation: CONFIG.gauges.reputationStart, // マクロ旨味
    },

    economy: {
      treasury: CONFIG.economy.startTreasury, // 利潤の蓄積
      lastDayNet: 0,
      bankruptStreak: 0,
    },

    population: {
      adventurers,
      nextId: adventurers.length,
      inflowAccum: 0,
    },

    dungeon: {
      floors: CONFIG.dungeon.floors,
      preset: CONFIG.presets.normal, // 現在適用中
      pendingPresetId: 'normal', // 翌日に適用される予定
    },

    // 8ボード：各スロット null | 'R' | 'G' | 'B'
    board: {
      slots: new Array(8).fill(null),
      manualOverride: false, // プレイヤーが手で置いたらガンビットの自動配置を一時停止
    },

    // 秘書のガンビット（MVP：閾値つき条件→行動の芽。将来は独自DSL）
    gambit: {
      deepenAtClear: 65, // 攻略進捗がこの値以上 → 「深層強化」の合図(R)
      easeAtFlux: 0.3, // 循環がこの値未満 → 「緩和・誘引」の合図(B)
      minPopulation: 6, // 人口がこれ未満 → 誘引(B)
    },

    // 魔王の応答表：盤面の粗い特徴(支配色) → プリセット
    responseTable: {
      // dominant color → presetId
      R: 'deepen',
      G: 'normal',
      B: 'ease',
      none: 'normal',
    },

    // 勇者緊急召喚（元HALT）
    summon: {
      active: false,
      reason: '',
    },

    fluxStagnantStreak: 0,
    log: [],
    over: null, // 破局理由（null = 継続中）
    stats: { delves: 0, deaths: 0, retires: 0, inflow: 0, outflow: 0 },
  };
}

export function logEvent(state, msg) {
  state.log.unshift({ day: state.time.day, tick: state.time.tick, msg });
  if (state.log.length > 120) state.log.pop();
}
