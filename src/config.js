// 数値バランスの集約点。設計上「数値は縦切りで実測しながら」なのでここを触れば調整できる。
export const CONFIG = {
  time: {
    ticksPerDay: 20, // ゲーム内1日 = 20 tick
    tickMs: 120, // 実時間: 1tick あたり基準ミリ秒（速度倍率で割る）
  },

  dungeon: {
    floors: 10, // 最深フロア。frontrunner がここに到達 = 攻略破局
  },

  population: {
    start: 8, // 開始時の冒険者数
    softCap: 40, // これを超えると流入が鈍る
    inflowBase: 0.35, // 1tick あたりの基本流入期待値（評判で増減）
    startLevel: 1,
    startHp: 20,
  },

  // ダンジョン挙動プリセット（魔王の応答表が指すもの）
  // monster: 魔王のモンスター構成ノブ(D-13)。resist=半減属性 / threat=脅威型(burst 要壁 / status 要回復)
  presets: {
    normal: { id: 'normal', label: '通常', diffBase: 1.0, deepBias: 0.0, reward: 1.0, monster: { resist: 'none', threat: 'none' } },
    deepen: { id: 'deepen', label: '深層強化', diffBase: 1.0, deepBias: 1.2, reward: 1.1, monster: { resist: 'phys', threat: 'burst' } },
    ease: { id: 'ease', label: '緩和・誘引', diffBase: 0.75, deepBias: 0.0, reward: 1.25, monster: { resist: 'none', threat: 'none' } },
  },

  party: {
    maxSize: 4,
    diffScale: 2.6, // フロア難度に掛ける“パーティ基準”係数（4人編成前提の調整）
    threatPenalty: 1.4, // 要求ロール欠けの脅威で難度が上がる倍率
    stallDaysToJobChange: 3, // このフロアで前進できない日が続くと転職を検討
    amicableLevel: 8, // 平均これ以上＆資金十分で円満解散（引退）
    disbandMoraleFloor: 0.12, // 平均士気がこれ未満で解散
  },

  economy: {
    feeRate: 0.2, // 冒険者の稼ぎへのギルド手数料
    townConsumePerCapita: 0.05, // 1tick 1人あたりの街の消費（ギルド関連）
    secretarySalaryPerDay: 8, // 秘書の人件費 / 日
    demonUpkeepPerDay: 5, // 魔王への循環維持コスト / 日（固定分）
    demonUpkeepPerClear: 0.2, // 攻略進捗に比例する循環維持コスト / 日
    startTreasury: 80,
    bankruptFloor: -40, // これを下回る日が続くと破産
    bankruptDays: 3,
  },

  gauges: {
    fluxFloor: 0.15, // 循環がこれを下回る日が続くと停滞破局
    fluxStagnantDays: 4,
    fluxSmoothing: 0.15, // 循環（活動量）の指数平滑係数
    reputationStart: 0.5, // 0..1 マクロ評判（旨味）
  },

  summon: {
    clearWarn: 90, // 攻略進捗がこの値以上で勇者緊急召喚（一時停止）
  },
};
