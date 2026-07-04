// ダンジョンのフロア難度と、パーティ実力の評価（クラス相性込み）。
import { CONFIG } from './config.js';
import { classOf, attrFactor } from './classes.js';
import { partyMembers } from './state.js';

// フロア難度（プリセットの深層バイアス込み）。depth=1 で約 1.0。
export function floorDifficulty(state, depth) {
  const p = state.dungeon.preset;
  const deep = depth >= 6 ? p.deepBias * (depth - 5) : 0;
  return depth * p.diffBase + deep;
}

// パーティの実効攻撃力（各員の level×クラス係数×属性相性の和）。
export function partyPower(state, party) {
  const preset = state.dungeon.preset;
  const resist = preset.monster ? preset.monster.resist : 'none';
  let power = 0;
  for (const m of partyMembers(state, party)) {
    const cls = classOf(m.classId);
    power += m.level * cls.powMul * attrFactor(cls.atk, resist);
  }
  return power;
}

// パーティが持つ役割集合。
export function partyRoles(state, party) {
  const roles = new Set();
  for (const m of partyMembers(state, party)) roles.add(classOf(m.classId).role);
  return roles;
}

// 対象フロアの実効難度（脅威型で要求ロールが欠けると跳ね上がる）。
export function effectiveDifficulty(state, party, depth) {
  let d = floorDifficulty(state, depth) * CONFIG.party.diffScale;
  const preset = state.dungeon.preset;
  const threat = preset.monster ? preset.monster.threat : 'none';
  const roles = partyRoles(state, party);
  if (threat === 'burst' && !roles.has('tank')) d *= CONFIG.party.threatPenalty;
  if (threat === 'status' && !roles.has('heal')) d *= CONFIG.party.threatPenalty;
  return d;
}
