// クラス定義（データ駆動・拡張前提 D-30）。表に足せば増える。
// role: 役割（tank 壁 / heal 回復 / dps 火力 / scout 探索）
// atk : 攻撃属性（phys 物理 / magic 魔法 / holy 神聖）
export const CLASSES = {
  warrior: { id: 'warrior', label: '戦士', role: 'tank', atk: 'phys', powMul: 1.1, hpMul: 1.6 },
  mage: { id: 'mage', label: '魔法使い', role: 'dps', atk: 'magic', powMul: 1.6, hpMul: 0.7 },
  cleric: { id: 'cleric', label: '僧侶', role: 'heal', atk: 'holy', powMul: 0.7, hpMul: 1.0 },
  thief: { id: 'thief', label: '盗賊', role: 'scout', atk: 'phys', powMul: 1.05, hpMul: 0.9 },
  ranger: { id: 'ranger', label: '狩人', role: 'dps', atk: 'phys', powMul: 1.25, hpMul: 0.85 },
};

export const CLASS_IDS = Object.keys(CLASSES);

// 役割ごとの代表クラス（転職の行き先を選ぶのに使う）
export const ROLE_TO_CLASS = { tank: 'warrior', heal: 'cleric', dps: 'mage', scout: 'thief' };

// 属性相性：魔王のモンスター構成(resist)が、この属性の攻撃を半減する。
// preset.monster.resist === atk のとき攻撃力係数を下げる。
export function attrFactor(atk, resist) {
  if (!resist || resist === 'none') return 1.0;
  if (resist === atk) return 0.5; // 狙い撃ち
  if (resist === 'phys' && atk === 'magic') return 1.1; // 物理耐性の敵には魔法が通る
  if (resist === 'magic' && atk === 'phys') return 1.1;
  return 1.0;
}

export function classOf(id) {
  return CLASSES[id] || CLASSES.warrior;
}
