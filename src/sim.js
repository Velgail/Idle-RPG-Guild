// 世界のシミュレーション（1tick）：パーティ潜行・成長・生死、人口フロー。
import { CONFIG } from './config.js';
import { makeAdventurer, logEvent, partyMembers } from './state.js';
import { classOf } from './classes.js';
import { partyPower, effectiveDifficulty, floorDifficulty, partyRoles } from './dungeon.js';

function countAliveAll(state) {
  let n = 0;
  for (const a of state.population.adventurers) if (a.alive) n++;
  return n;
}

// 1tick 分の世界更新。fee（この tick の手数料収入）を返す。
export function simTick(state) {
  const rng = state.rng;
  const pop = state.population;
  const floors = state.dungeon.floors;
  let fee = 0;
  let memberDelves = 0;

  // --- 流入（評判＝旨味に比例、softCap で鈍化）→ 自由な冒険者として加入 ---
  const aliveCount = countAliveAll(state);
  const capFactor = Math.max(0, 1 - aliveCount / CONFIG.population.softCap);
  pop.inflowAccum += CONFIG.population.inflowBase * (0.4 + state.gauges.reputation) * capFactor;
  while (pop.inflowAccum >= 1) {
    pop.inflowAccum -= 1;
    pop.adventurers.push(makeAdventurer(rng, pop.nextId++));
    state.stats.inflow++;
  }

  // --- 各パーティの潜行 ---
  for (const party of state.parties.list) {
    if (!party.alive) continue;
    const members = partyMembers(state, party);
    if (members.length === 0) continue;

    // 回復役がいれば毎tick少し回復
    const roles = partyRoles(state, party);
    if (roles.has('heal')) {
      for (const m of members) m.hp = Math.min(m.maxHp, m.hp + 1.5);
    }

    const power = partyPower(state, party);
    const target = party.floor + 1;
    const canPush = target <= floors && power >= effectiveDifficulty(state, party, target);

    memberDelves += members.length;
    state.stats.delves++;
    const roll = 0.75 + 0.5 * rng();

    if (canPush) {
      const effDiff = effectiveDifficulty(state, party, target);
      if (power * roll >= effDiff) {
        // 前進成功
        party.floor = target;
        const reward = (1.5 + target * 1.2) * state.dungeon.preset.reward;
        fee += reward * CONFIG.economy.feeRate;
        const share = reward / members.length;
        for (const m of members) {
          m.gold += share;
          m.level += 0.11;
          m.morale = Math.min(1, m.morale + 0.05);
        }
      } else {
        applyPartyDamage(state, party, members, (effDiff - power * roll) * 2.0 + 2, target);
      }
    } else if (party.floor >= 1) {
      // 撤退して既踏破フロアで稼ぐ（自滅防止・安全収入）
      const fd = floorDifficulty(state, party.floor) * CONFIG.party.diffScale;
      if (power * roll >= fd) {
        const reward = (0.8 + party.floor * 0.6) * state.dungeon.preset.reward;
        fee += reward * CONFIG.economy.feeRate;
        const share = reward / members.length;
        for (const m of members) {
          m.gold += share;
          m.level += 0.04;
          m.morale = Math.min(1, m.morale + 0.02);
        }
      } else {
        applyPartyDamage(state, party, members, (fd - power * roll) * 1.0 + 1, party.floor);
      }
    } else {
      // 地上（まだ何も踏破していない）：フロア1へ挑む
      const effDiff = effectiveDifficulty(state, party, 1);
      if (power * roll >= effDiff) {
        party.floor = 1;
        const reward = 2 * state.dungeon.preset.reward;
        fee += reward * CONFIG.economy.feeRate;
        for (const m of members) {
          m.gold += reward / members.length;
          m.level += 0.09;
        }
      } else {
        applyPartyDamage(state, party, members, (effDiff - power * roll) * 1.5 + 1, 1);
      }
    }
  }

  // --- 自由な冒険者（未編成）は待機：軽く回復、長引くと離脱 ---
  for (const a of pop.adventurers) {
    if (!a.alive || a.partyId !== null) continue;
    a.hp = Math.min(a.maxHp, a.hp + 1);
    a.morale = Math.max(0, a.morale - 0.005);
    if (a.morale <= 0.02 && rng() < 0.05) {
      a.alive = false;
      state.stats.outflow++;
      state.gauges.reputation = Math.max(0, state.gauges.reputation - 0.004);
    }
  }

  // 日の変わり目にだけ配列を掃除（死亡/離脱を除去）
  if (state.time.tick % CONFIG.time.ticksPerDay === 0) {
    pop.adventurers = pop.adventurers.filter((a) => a.alive);
  }

  updateGauges(state, memberDelves, aliveCount);
  return { fee };
}

// ダメージは壁役が優先的に受ける（守り）。壁が居なければ最も脆い者へ（burst で事故）。
function applyPartyDamage(state, party, members, dmg, depth) {
  let taker = members.find((m) => classOf(m.classId).role === 'tank');
  if (!taker) {
    taker = members.slice().sort((a, b) => a.hp - b.hp)[0];
  }
  taker.hp -= dmg;
  taker.morale = Math.max(0, taker.morale - 0.06);
  for (const m of members) if (m !== taker) m.morale = Math.max(0, m.morale - 0.02);
  if (taker.hp <= 0) {
    taker.alive = false;
    taker.partyId = null;
    state.stats.deaths++;
    state.gauges.reputation = Math.max(0, state.gauges.reputation - 0.015);
    logEvent(state, `${taker.name}(${classOf(taker.classId).label} Lv${taker.level.toFixed(0)}) が F${depth} で死亡`);
  }
}

function updateGauges(state, memberDelves, aliveCount) {
  // 循環：潜行に参加している人口の割合（活動量）を平滑化
  const activity = aliveCount > 0 ? Math.min(1, memberDelves / aliveCount) : 0;
  const k = CONFIG.gauges.fluxSmoothing;
  state.gauges.flux = state.gauges.flux * (1 - k) + activity * k;

  // 攻略進捗：先頭パーティ（最深到達）/ floors
  let deepest = 0;
  for (const p of state.parties.list) {
    if (p.alive && p.floor > deepest) deepest = p.floor;
  }
  state.gauges.clear = (deepest / state.dungeon.floors) * 100;

  // 評判：活動が続けば緩やかに回復
  state.gauges.reputation = Math.min(1, state.gauges.reputation + memberDelves * 0.0004);
}
