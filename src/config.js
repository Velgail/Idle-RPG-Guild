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
    // エントロピー漸増(D-07)：新規冒険者が日々わずかに強く来る（熟練の伝播）。
    // 静的マニュアルはいずれ追いつけなくなる → 手直しが要る。
    inflowLevelCreep: 0.06, // 新規Lv = startLevel + 経過日 × これ
  },

  // ダンジョン挙動プリセット（魔王の応答表が指すもの）
  // monster: 魔王のモンスター構成ノブ(D-13)。resist=半減属性 / threat=脅威型(burst 要壁 / status 要回復)
  // upkeep: そのプリセットを維持する魔王への循環維持コスト/日（深層強化は高い）。
  presets: {
    normal: { id: 'normal', label: '通常', diffBase: 1.0, deepBias: 0.0, reward: 1.0, upkeep: 4, monster: { resist: 'none', threat: 'none' } },
    deepen: { id: 'deepen', label: '深層強化', diffBase: 1.28, deepBias: 1.3, reward: 1.1, upkeep: 16, monster: { resist: 'phys', threat: 'burst' } },
    ease: { id: 'ease', label: '緩和・誘引', diffBase: 0.75, deepBias: 0.0, reward: 1.25, upkeep: 7, monster: { resist: 'none', threat: 'none' } },
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
    feeRate: 0.16, // 冒険者の稼ぎへのギルド手数料
    townConsumePerCapita: 0.04, // 1tick 1人あたりの街の消費（ギルド関連）
    secretarySalaryBase: 5, // 秘書の人件費 / 日（基本）
    secretarySalaryPerParty: 1.2, // パーティ数に比例する運営費 / 日
    demonUpkeepPerClear: 0.6, // 攻略進捗に比例する循環維持コスト / 日
    // 終端クロック(D-07)：世界が拡大するほど循環維持コストが逓増。いずれ収入を追い越す。
    // 効率の良い経営（人口/攻略を締め、利潤率を保つ）ほど破産を遅らせる＝スコア。
    demonUpkeepGrowthPerDay: 0.5,
    startTreasury: 80,
    bankruptFloor: -50, // これを下回る日が続くと破産
    bankruptDays: 3,
  },

  gauges: {
    fluxFloor: 0.35, // 循環がこれを下回る日が続くと停滞破局
    fluxStagnantDays: 5,
    fluxDailySmoothing: 0.4, // 日次の循環平滑
    expectedParties: 6, // 健全なパーティ数の目安（循環の分母＝人口崩壊も拾う）
    reputationStart: 0.6, // 0..1 マクロ評判（旨味）
    reputationDecayPerDay: 0.006, // 旨味の緩い日次減衰（戦死で大きく落ちる）
  },

  summon: {
    clearWarn: 90, // 攻略進捗がこの値以上で勇者緊急召喚（一時停止）
  },
};
