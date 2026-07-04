// パーティの自発編成・転職・解散（D-31/32/33）。プレイヤーは直接割当てしない。
import { CONFIG } from './config.js';
import { logEvent, partyMembers } from './state.js';
import { classOf, ROLE_TO_CLASS } from './classes.js';
import { partyRoles } from './dungeon.js';

function freeAgents(state) {
  return state.population.adventurers.filter((a) => a.alive && a.partyId === null);
}

// 特性の近さで相性（0..1）。社交性と慎重さが近いほど組みやすい。
function compat(a, b) {
  const d = Math.abs(a.traits.socia - b.traits.socia) + Math.abs(a.traits.caution - b.traits.caution);
  return 1 - d / 2;
}

function avgCompat(members, cand) {
  if (members.length === 0) return 1;
  let s = 0;
  for (const m of members) s += compat(m, cand);
  return s / members.length;
}

// 1日1回：自由な冒険者が自発的にパーティを組む。
export function formParties(state) {
  const free = freeAgents(state);
  // id 昇順で決定論的に処理（seedが同じなら同じ編成）
  free.sort((a, b) => a.id - b.id);
  const used = new Set();

  for (let i = 0; i < free.length; i++) {
    const seed = free[i];
    if (used.has(seed.id)) continue;
    const members = [seed];
    used.add(seed.id);

    // 相性の良い自由人で最大人数まで埋める（役割の多様性を優先）
    while (members.length < CONFIG.party.maxSize) {
      let best = null;
      let bestScore = 0.4; // 最低相性しきい値
      const haveRoles = new Set(members.map((m) => classOf(m.classId).role));
      for (let j = 0; j < free.length; j++) {
        const cand = free[j];
        if (used.has(cand.id)) continue;
        const c = avgCompat(members, cand);
        const roleGain = haveRoles.has(classOf(cand.classId).role) ? 0 : 0.3;
        const score = c + roleGain;
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      if (!best) break;
      members.push(best);
      used.add(best.id);
    }

    if (members.length >= 2) {
      const party = { id: state.parties.nextId++, memberIds: members.map((m) => m.id), floor: 0, stallDays: 0, alive: true };
      for (const m of members) m.partyId = party.id;
      state.parties.list.push(party);
      state.stats.formed++;
    } else {
      // 相手が見つからず単独 → 今日は組めない（プールに残る）
      used.delete(seed.id);
      break; // これ以上有効な組み合わせは無い
    }
  }
}

// 停滞したパーティは、欠けている役割へ誰かが自発転職して適応する（D-32）。
export function considerJobChange(state, party) {
  if (party.stallDays < CONFIG.party.stallDaysToJobChange) return;
  const members = partyMembers(state, party);
  if (members.length === 0) return;
  const roles = partyRoles(state, party);
  const preset = state.dungeon.preset;
  const threat = preset.monster ? preset.monster.threat : 'none';

  let wantRole = null;
  if (threat === 'burst' && !roles.has('tank')) wantRole = 'tank';
  else if (threat === 'status' && !roles.has('heal')) wantRole = 'heal';
  else if (!roles.has('dps')) wantRole = 'dps';
  if (!wantRole) return;

  // 一番“余っている役割”の member を転職させる（重複役割の低レベル者を優先）
  const roleCount = {};
  for (const m of members) {
    const r = classOf(m.classId).role;
    roleCount[r] = (roleCount[r] || 0) + 1;
  }
  const candidates = members
    .filter((m) => roleCount[classOf(m.classId).role] > 1)
    .sort((a, b) => a.level - b.level);
  const target = candidates[0] || members.slice().sort((a, b) => a.level - b.level)[0];
  if (!target) return;

  const newClassId = ROLE_TO_CLASS[wantRole];
  const cls = classOf(newClassId);
  target.classId = newClassId;
  target.maxHp = Math.round(CONFIG.population.startHp * cls.hpMul);
  target.hp = Math.min(target.hp, target.maxHp);
  party.stallDays = 0;
  state.stats.jobChanges++;
  logEvent(state, `${target.name} が ${cls.label} に転職（欠けた役割:${wantRole} を補う）`);
}

// 解散判定（死亡/士気崩壊/相性不和/円満）。members は再編成プールへ、円満は引退。
export function disbandChecks(state) {
  const rng = state.rng;
  for (const party of state.parties.list) {
    if (!party.alive) continue;
    const members = partyMembers(state, party);

    // メンバー消失で2人未満 → 解散
    if (members.length < 2) {
      disband(state, party, members, 'メンバー欠員', false);
      continue;
    }
    const avgMorale = members.reduce((s, m) => s + m.morale, 0) / members.length;
    const avgLevel = members.reduce((s, m) => s + m.level, 0) / members.length;
    const avgGold = members.reduce((s, m) => s + m.gold, 0) / members.length;

    // 士気崩壊
    if (avgMorale < CONFIG.party.disbandMoraleFloor) {
      disband(state, party, members, '士気崩壊', false);
      continue;
    }
    // 円満解散（十分強く稼いだ → 引退＝流出）
    if (avgLevel >= CONFIG.party.amicableLevel && avgGold >= 120) {
      disband(state, party, members, '円満解散（目的達成）', true);
      continue;
    }
    // 相性不和：特性の分散が大きいほど日々わずかに崩れる
    const variance = traitVariance(members);
    if (rng() < variance * 0.04) {
      disband(state, party, members, '相性不和', false);
      continue;
    }
  }
  // 死んだパーティを掃除
  state.parties.list = state.parties.list.filter((p) => p.alive);
}

function traitVariance(members) {
  const socia = members.map((m) => m.traits.socia);
  const mean = socia.reduce((s, x) => s + x, 0) / socia.length;
  return socia.reduce((s, x) => s + (x - mean) * (x - mean), 0) / socia.length;
}

function disband(state, party, members, reason, amicable) {
  party.alive = false;
  state.stats.disbanded++;
  for (const m of members) {
    m.partyId = null;
    m.stallDays = 0;
    if (amicable) {
      // 引退（流出）：世代交代の正のフロー
      m.alive = false;
      state.stats.retires++;
    }
  }
  logEvent(state, `パーティ#${party.id} が解散（${reason}）`);
}
