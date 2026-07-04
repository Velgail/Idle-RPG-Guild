// DOM 描画と操作。skeleton を一度組み、render(state) で動的部分だけ更新する。
import { CONFIG } from './config.js';
import { classOf } from './classes.js';
import { coarseRead } from './board.js';
import { partyMembers } from './state.js';

const RESIST_JA = { none: 'なし', phys: '物理耐性', magic: '魔法耐性' };
const THREAT_JA = { none: 'なし', burst: '連撃(要:壁)', status: '状態異常(要:回復)' };
const COLOR_JA = { R: '赤', G: '緑', B: '青', none: '無/曖昧' };

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function initUI(handlers) {
  const app = document.getElementById('app');
  const presetOptions = Object.values(CONFIG.presets)
    .map((p) => `<option value="${p.id}">${p.label}</option>`)
    .join('');

  app.innerHTML = `
    <div class="panel col-4">
      <h3>ゲージ（バンドを外れたら破局）</h3>
      <div class="gauge"><div class="lab"><span>循環 Flux</span><b id="gFluxV"></b></div><div class="bar flux"><span id="gFlux"></span></div></div>
      <div class="gauge"><div class="lab"><span>攻略進捗 Clear</span><b id="gClearV"></b></div><div class="bar clear"><span id="gClear"></span></div></div>
      <div class="gauge"><div class="lab"><span>評判（旨味）</span><b id="gRepV"></b></div><div class="bar rep"><span id="gRep"></span></div></div>
      <div class="gauge"><div class="lab"><span>利潤 Treasury</span><b id="gTreV"></b></div></div>
      <div class="readout" id="warnV"></div>
    </div>

    <div class="panel col-4">
      <h3>ダンジョン / 先頭パーティ</h3>
      <div class="readout" style="line-height:1.9">
        現在のプリセット: <b id="dPreset"></b><br/>
        モンスター構成: <span id="dMonster"></span><br/>
        フロア数: <span id="dFloors"></span><br/>
        先頭到達: <b id="dFront"></b><br/>
        人口: <span id="dPop"></span> / パーティ: <span id="dPartyN"></span>
      </div>
    </div>

    <div class="panel col-4">
      <h3>8ボード（秘匿チャネル / 勇者呼び）</h3>
      <div class="board" id="board"></div>
      <div class="readout" id="boardRead"></div>
      <label class="row"><span>手動オーバーライド（秘書の自動配置を止める）</span><input type="checkbox" id="override" /></label>
      <div class="hint">クリックで 空→赤→緑→青。魔王は「支配色」で粗く読む。</div>
    </div>

    <div class="panel col-6">
      <h3>秘書ガンビット（自動運用）</h3>
      <label class="row"><span>攻略進捗 ≥ で「深層強化(赤)」</span><input type="number" id="gDeepen" min="0" max="100" step="5" /></label>
      <label class="row"><span>循環 &lt; で「緩和・誘引(青)」</span><input type="number" id="gEase" min="0" max="1" step="0.05" /></label>
      <label class="row"><span>人口 &lt; で「緩和・誘引(青)」</span><input type="number" id="gMinPop" min="0" max="60" step="1" /></label>

      <h3 style="margin-top:12px">魔王の応答表（支配色 → プリセット）</h3>
      <table class="rt">
        <tr><td>赤 R</td><td><select id="rtR">${presetOptions}</select></td></tr>
        <tr><td>緑 G</td><td><select id="rtG">${presetOptions}</select></td></tr>
        <tr><td>青 B</td><td><select id="rtB">${presetOptions}</select></td></tr>
        <tr><td>無/曖昧</td><td><select id="rtnone">${presetOptions}</select></td></tr>
      </table>
      <div class="hint">既定マニュアルは不完全。放っておくと破局する。閾値と応答表を手直しして均衡を延ばす。</div>
    </div>

    <div class="panel col-6">
      <h3>パーティ（自発編成・先頭は黄枠）</h3>
      <div class="parties" id="parties"></div>
    </div>

    <div class="panel col-12">
      <h3>ログ</h3>
      <div class="log" id="log"></div>
    </div>
  `;

  // 8ボード生成
  const board = document.getElementById('board');
  for (let i = 0; i < 8; i++) {
    const s = el(`<div class="slot" data-i="${i}"></div>`);
    s.addEventListener('click', () => handlers.onCycleSlot(i));
    board.appendChild(s);
  }

  // 応答表・ガンビット・override の配線
  ['R', 'G', 'B', 'none'].forEach((c) => {
    document.getElementById('rt' + c).addEventListener('change', (e) => handlers.onSetResponse(c, e.target.value));
  });
  document.getElementById('gDeepen').addEventListener('change', (e) => handlers.onSetGambit('deepenAtClear', +e.target.value));
  document.getElementById('gEase').addEventListener('change', (e) => handlers.onSetGambit('easeAtFlux', +e.target.value));
  document.getElementById('gMinPop').addEventListener('change', (e) => handlers.onSetGambit('minPopulation', +e.target.value));
  document.getElementById('override').addEventListener('change', (e) => handlers.onToggleOverride(e.target.checked));

  // ヘッダ制御
  document.getElementById('btnPlay').addEventListener('click', handlers.onTogglePause);
  document.getElementById('btnReset').addEventListener('click', handlers.onReset);
  document.querySelectorAll('#controls [data-speed]').forEach((b) => {
    b.addEventListener('click', () => handlers.onSpeed(+b.dataset.speed));
  });

  // モーダル
  document.getElementById('modalBtn').addEventListener('click', () => handlers.onModalAction());

  return { render };
}

function setVal(id, v) {
  const e = document.getElementById(id);
  if (e && document.activeElement !== e) e.value = v;
}

export function render(state) {
  const g = state.gauges;
  document.getElementById('gFlux').style.width = (g.flux * 100).toFixed(0) + '%';
  document.getElementById('gClear').style.width = g.clear.toFixed(0) + '%';
  document.getElementById('gRep').style.width = (g.reputation * 100).toFixed(0) + '%';
  document.getElementById('gFluxV').textContent = g.flux.toFixed(2);
  document.getElementById('gClearV').textContent = g.clear.toFixed(0) + '%';
  document.getElementById('gRepV').textContent = g.reputation.toFixed(2);
  const tre = document.getElementById('gTreV');
  tre.textContent = state.economy.treasury.toFixed(0);
  tre.className = state.economy.treasury < 0 ? 'danger' : '';

  // 破局が近い警告
  const warns = [];
  if (state.fluxStagnantStreak > 0) warns.push(`循環低下 ${state.fluxStagnantStreak}/${CONFIG.gauges.fluxStagnantDays}日`);
  if (state.economy.bankruptStreak > 0) warns.push(`赤字 ${state.economy.bankruptStreak}/${CONFIG.economy.bankruptDays}日`);
  if (g.clear >= 80) warns.push(`攻略間近 ${g.clear.toFixed(0)}%`);
  document.getElementById('warnV').innerHTML = warns.length ? '⚠ ' + warns.join(' / ') : '安定';
  document.getElementById('warnV').className = 'readout' + (warns.length ? ' danger' : '');

  // ダンジョン
  const p = state.dungeon.preset;
  document.getElementById('dPreset').textContent = p.label;
  document.getElementById('dMonster').textContent = `相性:${RESIST_JA[p.monster.resist]} / 脅威:${THREAT_JA[p.monster.threat]}`;
  document.getElementById('dFloors').textContent = state.dungeon.floors;
  let deepest = 0;
  for (const pt of state.parties.list) if (pt.alive && pt.floor > deepest) deepest = pt.floor;
  document.getElementById('dFront').textContent = `F${deepest} / ${state.dungeon.floors}`;
  let alive = 0;
  for (const a of state.population.adventurers) if (a.alive) alive++;
  document.getElementById('dPop').textContent = alive;
  document.getElementById('dPartyN').textContent = state.parties.list.filter((x) => x.alive).length;

  // 盤面
  const slots = document.querySelectorAll('#board .slot');
  slots.forEach((s, i) => {
    const c = state.board.slots[i];
    s.className = 'slot' + (c ? ' ' + c : '');
    s.textContent = c || '';
  });
  const cr = coarseRead(state.board);
  const mapped = state.responseTable[cr.dominant] || 'normal';
  document.getElementById('boardRead').innerHTML =
    `支配色: <b>${COLOR_JA[cr.dominant]}</b>（計${cr.total}） → 魔王は明日 <b>${CONFIG.presets[mapped].label}</b> に`;
  document.getElementById('override').checked = state.board.manualOverride;

  // ガンビット・応答表（フォーカス中は触らない）
  setVal('gDeepen', state.gambit.deepenAtClear);
  setVal('gEase', state.gambit.easeAtFlux);
  setVal('gMinPop', state.gambit.minPopulation);
  ['R', 'G', 'B', 'none'].forEach((c) => setVal('rt' + c, state.responseTable[c]));

  // パーティ一覧
  const pl = document.getElementById('parties');
  const parties = state.parties.list.filter((x) => x.alive).sort((a, b) => b.floor - a.floor).slice(0, 14);
  pl.innerHTML = parties
    .map((pt) => {
      const members = partyMembers(state, pt);
      const isFront = members.some((m) => m.tags.includes('front'));
      const chips = members
        .map((m) => {
          const cls = classOf(m.classId);
          return `<span class="chip ${cls.role}">${cls.label} L${m.level.toFixed(0)}</span>`;
        })
        .join('');
      const avgMorale = members.length ? members.reduce((s, m) => s + m.morale, 0) / members.length : 0;
      return `<div class="pty ${isFront ? 'front' : ''}">
        <div class="hd"><b>#${pt.id} F${pt.floor}</b><span>士気 ${(avgMorale * 100).toFixed(0)}% / ${members.length}人</span></div>
        <div>${chips}</div>
      </div>`;
    })
    .join('') || '<div class="readout">（編成待ち）</div>';

  // ログ
  document.getElementById('log').innerHTML = state.log
    .slice(0, 40)
    .map((e) => `<div class="e"><b>${e.day}日</b> ${e.msg}</div>`)
    .join('');

  // 速度ボタンのハイライト
  document.querySelectorAll('#controls [data-speed]').forEach((b) => {
    b.classList.toggle('active', +b.dataset.speed === state.time.speed);
  });
  document.getElementById('btnPlay').textContent = state.time.paused ? '▶ 再生' : '⏸ 停止';

  // オーバーレイ（破局 / 緊急召喚）
  renderOverlay(state);
}

function renderOverlay(state) {
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const bodyE = document.getElementById('modalBody');
  const btn = document.getElementById('modalBtn');
  const hint = document.getElementById('modalHint');

  if (state.over) {
    overlay.classList.add('show');
    modal.className = 'modal over';
    title.textContent = '破局';
    bodyE.textContent = state.over + `（${state.time.day}日目）`;
    btn.textContent = '最初から';
    hint.textContent = '唯一の終わりは破局。均衡は永遠には保てない——が、より長く保てるマニュアルはある。';
  } else if (state.summon.active) {
    overlay.classList.add('show');
    modal.className = 'modal summon';
    title.textContent = '勇者、緊急召喚';
    bodyE.textContent = state.summon.reason;
    btn.textContent = '対応した（再開）';
    hint.textContent = '盤面・応答表・ガンビット閾値を手直ししてから再開しよう。';
  } else {
    overlay.classList.remove('show');
  }
}
