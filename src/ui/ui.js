import * as LB from '../sim/latebalance.js';
import { sceneView } from '../render/scene.js';
export function openScene(spec) { sceneView.show(spec, () => sceneView.hide()); }
import * as DEPTH from '../sim/depth.js';
import * as MK from '../sim/markets.js';
import { LANGS, setLang, t, currentLang } from './i18n.js';
import { UK_EVENTS } from './lang-uk-events.js';
import { KEY_ACTIONS, keyFor, keyLabel, bindKey, resetKeys } from './keys.js';
import { openChronicle } from './chronicle.js';
import { showTitleBackdrop } from './titlebg.js';
import { rankings, rankOf, SCORE_PARTS } from '../sim/score.js';
import { lineChart } from './panels.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { G, S, player, dateStr, shortDate, on, log } from '../sim/state.js';
import { fmt, fmtSigned, escapeHtml as E, hexToRgb } from '../core/util.js';
import { RACES, RACE_LIST } from '../data/races.js';
// (RACES also used by the battle view)
import { STAGES } from '../data/buildings.js';
import { WORLD_SIZES, WORLD_TYPES } from '../world/worldgen.js';
import { projectLedger, stabilityBreakdown } from '../sim/economy.js';
import { storageCaps, civPopulation, startBuild, cancelBuild } from '../sim/settlements.js';
import { setResearch } from '../sim/tech.js';
import { sendColonists } from '../sim/colonize.js';
import { doReform, rulerFullName, heirOf } from '../sim/government.js';
import { iconImg, flagUrl, houseSprite } from '../render/sprites.js';
import { BIOMES } from '../data/biomes.js';
import { PANELS, PANEL_ORDER, provincePanel } from './panels.js';
import { listSaves, storageUsed } from '../sim/save.js';
import { SETTINGS, saveSettings } from './settings.js';
import { armyPanel, fleetPanel } from './panels.js';
import { buildShip, homePort, orderSail, portWater, mergeFleets, disbandFleet } from '../sim/naval.js';
import { answerOffer, sendGift, propose, cancelTrade, breakAlliance, declareWar, warBetween, warsOf } from '../sim/diplomacy.js';
import { recruit, orderMove, splitArmy, mergeArmies, replaceGeneral, disbandArmy, withdraw, assault, armyCount } from '../sim/military.js';
import { setLaw } from '../sim/government.js';
import { concede } from '../sim/unrest.js';
import { resolveEvent, eventView } from '../sim/events.js';
import { UNITS } from '../data/military.js';
import { GOVERNMENTS } from '../data/governments.js';
import { BUILDING_LIST } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { canBuild } from '../sim/settlements.js';
import { GOODS } from '../data/goods.js';
import { startPlay, backDown, concede as concedePlayFn, DEMANDS } from '../sim/plays.js';
import { hire, dismiss, assign } from '../sim/cabinet.js';
import * as CH from '../sim/characters.js';
import * as TR from '../sim/treasury.js';
import * as WF from '../sim/warfare.js';
import * as FOG from '../sim/fog.js';
import { startEnact as startEnactLaw, cancelEnact as cancelEnactLaw, movementDemand } from '../sim/politics.js';
import { GROUPS, GROUP_LIST } from '../data/politics.js';
import { acceptCulture, revokeCulture, adoptFaith, setTolerance } from '../sim/culture.js';
import { enemiesOf } from '../sim/diplomacy.js';

const $ = (id) => document.getElementById(id);
export const SPEEDS = [0, 0.5, 1.5, 4, 10, 30]; // calmer pace: speed 1 = half a day per second
const MAP_MODES = [
  ['political', 'Political'], ['terrain', 'Terrain'], ['resources', 'Resources'],
  ['population', 'Population'], ['development', 'Development'], ['military', 'Diplomatic'], ['trade', 'Trade'], ['unrest', 'Unrest'],
];

let hooks = {};
let lastPanelDay = -1, lastCtxDay = -1;

export function initUI(h) {
  hooks = h;
  G.ui = { panel: null, ctx: null, buildSid: null, interacting: false };

  $('nav').innerHTML = PANEL_ORDER.map(([id, label, icon, key]) => `<button data-action="open" data-panel="${id}">${iconImg(icon)} ${label}<kbd>${key}</kbd></button>`).join('');
  $('mapModes').innerHTML = MAP_MODES.map(([id, label]) => `<button data-mode="${id}">${label}</button>`).join('');
  $('tbSpeed').innerHTML = SPEEDS.map((s, i) => `<button data-speed="${i}" class="${i === 0 ? 'pause' : ''}" title="${i === 0 ? 'Pause (Space)' : `Speed ${i} (${s} days/sec)`}">${i === 0 ? '❚❚' : '▶'.repeat(Math.min(i, 3)) + (i > 3 ? i : '')}</button>`).join('');
  [...$('tbSpeed').children].forEach((b, i) => { if (i > 0) b.textContent = String(i); });

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  for (const id of ['mainPanel', 'ctxPanel']) {
    $(id).addEventListener('pointerdown', () => { G.ui.interacting = true; });
  }
  window.addEventListener('pointerup', () => { G.ui.interacting = false; });
  $('menuBtn').addEventListener('click', () => hooks.menu());
  const muteLabel = () => { $('muteBtn').textContent = SETTINGS.muted ? '✕' : '♪'; $('muteBtn').style.opacity = SETTINGS.muted ? 0.5 : 1; };
  $('muteBtn').addEventListener('click', () => { SETTINGS.muted = !SETTINGS.muted; saveSettings(); muteLabel(); });
  muteLabel();

  on('event', (e) => {
    addLog(e);
    if (e.toast) toast(e.text, e.type);
  });
}

export function showGameUI(show) {
  for (const id of ['topbar', 'nav', 'log', 'bottomRight', 'alerts']) $(id).classList.toggle('hidden', !show);
  if (!show) { $('mainPanel').classList.add('hidden'); $('ctxPanel').classList.add('hidden'); $('godbar').classList.add('hidden'); }
}

function onClick(e) {
  const sp = e.target.closest('[data-speed]');
  if (sp) { hooks.setSpeed(+sp.dataset.speed); return; }
  const mm = e.target.closest('[data-mode]');
  if (mm && !mm.disabled) { hooks.setMode(mm.dataset.mode); return; }
  const a = e.target.closest('[data-action]');
  if (!a || a.disabled) return;
  const d = a.dataset;
  if (d.action === 'menuItem') { hooks.menuItem(d.item, d); return; } // works before a game exists
  if (!G.state) return;
  const me = player();
  switch (d.action) {
    case 'close':
      if (a.closest('#mainPanel')) openPanel(null);
      else selectProvince(null);
      break;
    case 'open': openPanel(G.ui.panel === d.panel ? null : d.panel); break;
    case 'focusSettlement': {
      const s = S().settlements[+d.id];
      hooks.focusTile(s.tile);
      selectProvince(s.province);
      break;
    }
    case 'focusTile': hooks.focusTile(+d.tile); break;
    case 'build': {
      const s = S().settlements[+d.sid];
      const r = startBuild(me, s, d.type);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'cancel': cancelBuild(me, S().settlements[+d.sid], +d.idx); refreshAll(true); break;
    case 'pickBuild': G.ui.buildSid = +d.sid; refreshAll(true); break;
    case 'openBuild': G.ui.buildSid = +d.sid; openPanel('construction'); break;
    case 'research': setResearch(me, d.id); refreshAll(true); break;
    case 'reform': {
      const r = doReform(me, d.gov);
      if (!r.ok) toast('Cannot reform: ' + r.reasons.join(', '), 'bad');
      refreshAll(true);
      break;
    }
    case 'colonize': {
      const r = sendColonists(me, +d.pid);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'menuItem': hooks.menuItem(d.item, d); break;
    // ---- Diplomacy ----
    case 'offer': answerOffer(+d.id, d.accept === '1'); refreshAll(true); break;
    case 'gift': { const r = sendGift(me.id, +d.civ, 50); if (!r.ok) toast(r.reason, 'bad'); else toast('Gift sent.', 'good'); refreshAll(true); break; }
    case 'propose': {
      const r = propose(me.id, +d.civ, d.type);
      toast(r.ok ? 'Accepted!' : r.reason, r.ok ? 'good' : 'bad');
      refreshAll(true);
      break;
    }
    case 'peace': {
      const w = warBetween(me.id, +d.civ);
      if (!w) break;
      const r = propose(me.id, +d.civ, d.type, { war: w, amount: +d.amount || 0 });
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'cancelTrade': cancelTrade(me.id, +d.civ); refreshAll(true); break;
    case 'breakAlliance': breakAlliance(me.id, +d.civ); refreshAll(true); break;
    case 'declareWar': {
      const o = S().civs[+d.civ];
      if (SETTINGS.confirmWar && !window.confirm(`Declare war on ${o.displayName}? Their allies will join against you.`)) break;
      const r = declareWar(me.id, o.id);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'ledgerTab': G.ui.ledgerTab = d.tab; refreshAll(true); break;
    case 'startPlay': {
      const o = S().civs[+d.civ];
      if (SETTINGS.confirmWar && !window.confirm(`Demand ${DEMANDS[d.type].short} from ${o.displayName}? The crisis can escalate into war.`)) break;
      const r = startPlay(me.id, o.id, d.type);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'backDown': { const p = S().plays.find((x) => x.id === +d.id); if (p) backDown(p); refreshAll(true); break; }
    case 'concedePlay': { const p = S().plays.find((x) => x.id === +d.id); if (p && window.confirm('Give in to their demands?')) concedePlayFn(p); refreshAll(true); break; }
    case 'hireAdvisor': { const c = me.candidates.find((x) => x.id === +d.id); const r = hire(me, +d.id, c?.spec); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'dismissAdvisor': dismiss(me, +d.id); refreshAll(true); break;
    case 'acceptCulture': { const r = acceptCulture(me, d.race); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'revokeCulture': revokeCulture(me, d.race); refreshAll(true); break;
    case 'adoptFaith': if (window.confirm('Change the state faith? Stability −15.')) adoptFaith(me, d.faith); refreshAll(true); break;
    case 'tolerance': setTolerance(me, d.mode); refreshAll(true); break;
    case 'enactLaw': { const r = startEnactLaw(me, d.law); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'cancelEnact': cancelEnactLaw(me); refreshAll(true); break;
    case 'takeLoan': { const r = TR.takeLoan(me); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'repayLoan': { const r = TR.repayLoan(me, +d.i); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'patronage': TR.setPatronage(me, +d.lvl); refreshAll(true); break;
    case 'startMonument': { const r = TR.startMonument(me, d.id, 2); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'investRate': TR.setInvestRate(me, +d.lvl); refreshAll(true); break;
    case 'cancelMonument': TR.cancelMonument(me); refreshAll(true); break;
    case 'viewTown': hideModal(); openScene({ type: 'town', id: +d.id }); break;
    case 'viewBattle': { const r = (S().battleReports || []).find((x) => x.id === +d.id); hideModal(); if (r) openScene({ type: 'battle', report: r }); break; }
    case 'quest': { const r = G.monsters.startQuest(me, +d.hero, d.k); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'holyWar': { const r = G.religion.callHolyWar(me); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'decision': { const r = DEPTH.takeDecision(me, d.id); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'scheme': { const r = DEPTH.startScheme(me, G.ui.schemeTarget, d.k); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'cancelScheme': DEPTH.cancelScheme(me, +d.i); refreshAll(true); break;
    case 'escort': DEPTH.setEscort(me, +d.id, d.on === '1'); refreshAll(true); break;
    case 'openRoute': { const r = MK.openRoute(me.id, +d.id); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'startWork': { const r = LB.startWork(me, d.id, +d.s, 2); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'workRate': LB.setWorkRate(me, +d.lvl); refreshAll(true); break;
    case 'cancelWork': LB.cancelWork(me); refreshAll(true); break;
    case 'hireMercs': { const r = TR.hireMercs(me, +d.id); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'bribeGroup': { const r = TR.bribeGroup(me, d.g); if (!r.ok) toast(r.reason, 'bad'); else toast(`The ${GROUPS[d.g].name} are pleased (−${r.cost} gold).`, 'good'); refreshAll(true); break; }
    case 'fabricate': { const r = TR.fabricateClaim(me, +d.civ); if (!r.ok) toast(r.reason, 'bad'); else toast('Our scribes begin forging a claim.', 'info'); refreshAll(true); break; }
    case 'appointCommander': { const a = S().armies.find((x) => x.id === +d.id); if (a) { const r = WF.appointCommander(a, d.who); if (!r.ok) toast(r.reason, 'bad'); } refreshAll(true); break; }
    case 'peacePick': { const set = G.ui.peacePick?.[d.war]; if (set) { if (e.target.checked) set.add(+d.id); else set.delete(+d.id); } refreshAll(true); break; }
    case 'peaceProvinces': { const w = S().wars.find((x) => x.id === +d.war); if (w) { const r = propose(me.id, +d.civ, 'peace_provinces', { war: w, setts: [...(G.ui.peacePick?.[w.id] || [])] }); if (!r.ok) toast(r.reason || 'They refuse.', 'bad'); } refreshAll(true); break; }
    case 'exchangeMaps': { const r = FOG.exchangeMaps(me.id, +d.civ); if (!r.ok) toast(r.reason, 'bad'); else toast('Charts exchanged — new lands appear on our maps.', 'good'); G.dirty.fog = true; refreshAll(true); break; }
    case 'pickExplorer': G.ui.pickTarget = 'explorer'; toast('Click the map where the expedition should go.', 'info'); break;
    case 'lifestyle': CH.setLifestyle(me, d.ls); refreshAll(true); break;
    case 'educateChild': { const c = me.family.find((x) => String(x.id) === d.id); if (c) c.edu = d.focus; refreshAll(true); break; }
    case 'giftCourtier': { const r = CH.giftCourtier(me, +d.id); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'banishCourtier': CH.banishCourtier(me, +d.id); refreshAll(true); break;
    case 'exposePlot': CH.exposePlot(+d.id); refreshAll(true); break;
    case 'cancelPlot': CH.cancelPlot(+d.id); refreshAll(true); break;
    case 'marry': { const r = CH.proposeMarriage(me.id, +d.civ); if (!r.ok) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'assassinate': { const r = CH.startAssassination(me.id, +d.civ, d.who); if (!r.ok) toast(r.reason, 'bad'); else toast('Agents dispatched. Track the plot in the Court panel.', 'info'); refreshAll(true); break; }
    case 'ledgerSort': G.ui.ledgerSort = d.key; refreshAll(true); break;
    case 'trendMetric': G.ui.trend = d.k; refreshAll(true); break;
    case 'chronFilter': G.ui.chronFilter = d.f; refreshAll(true); break;
    case 'chronPage': openChronicle(showModal, +d.p); break;
    case 'openChronicle': openChronicle(showModal); break;
    case 'battleReport': battleReportModal(+d.id); break;
    case 'gfxPreset': gfxPreset(d.p); break;
    case 'bindKey': captureKey(d.id, a); break;
    case 'resetKeys': resetKeys(); saveSettings(); settingsModal(); break;
    case 'alertBuild': G.ui.buildSid = +d.sid; openPanel('construction'); break;
    case 'setLaw': { const r = setLaw(me, d.law); if (!r.ok && r.reason) toast(r.reason, 'bad'); refreshAll(true); break; }
    case 'concede': {
      const w = S().wars.find((x) => x.id === +d.war);
      if (w && window.confirm('Concede the civil war? The rebels get what they fought for.')) concede(w);
      refreshAll(true);
      break;
    }
    case 'eventChoice': resolveEvent(+d.id, +d.idx); hideModal(); hooks.afterEvent?.(); refreshAll(true); break;
    // ---- Military ----
    case 'selectArmy': selectArmy(+d.id); break;
    case 'selectFleet': selectFleet(+d.id); break;
    case 'pickYard': G.ui.yardSid = +d.sid; refreshAll(true); break;
    case 'buildShip': {
      const r = buildShip(me, S().settlements[+d.sid], d.type);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'fleetHome': case 'fleetStop': case 'fleetMerge': case 'fleetDisband': {
      const f = S().fleets.find((x) => x.id === +d.id);
      if (!f) break;
      if (d.action === 'fleetHome') { const s = homePort(f); const r = s ? orderSail(f, portWater(s)) : { ok: false, reason: 'No harbour' }; if (!r.ok) toast(r.reason, 'bad'); }
      if (d.action === 'fleetStop') f.path = [];
      if (d.action === 'fleetMerge') { const o = S().fleets.find((x) => x.id === +d.other); if (o) mergeFleets(f, o); }
      if (d.action === 'fleetDisband') { if (window.confirm(`Scuttle ${f.name}?`)) { disbandFleet(f); selectFleet(null); } }
      refreshAll(true);
      break;
    }
    case 'armyWithdraw': case 'armyAssault': case 'armyStance': {
      const a = S().armies.find((x) => x.id === +d.id);
      if (!a) break;
      if (d.action === 'armyWithdraw') withdraw(a);
      if (d.action === 'armyAssault') { const r = assault(a); if (r.success) toast('The walls are stormed!', 'good'); }
      if (d.action === 'armyStance') a.stance = d.stance;
      if (S().armies.includes(a)) selectArmy(a.id); else selectArmy(null);
      refreshAll(true);
      break;
    }
    case 'pickRecruit': G.ui.recruitSid = +d.sid; refreshAll(true); break;
    case 'openRecruit': G.ui.recruitSid = +d.sid; openPanel('military'); break;
    case 'recruit': {
      const s = S().settlements[+d.sid];
      const r = recruit(me, s, d.type);
      if (!r.ok) toast(r.reason, 'bad');
      refreshAll(true);
      break;
    }
    case 'armyHome': case 'armyStop': case 'armySplit': case 'armyMerge': case 'armyGeneral': case 'armyDisband': {
      const a = S().armies.find((x) => x.id === +d.id);
      if (!a) break;
      if (d.action === 'armyHome') { const cap = S().settlements[me.capital]; const r = cap ? orderMove(a, cap.tile) : { ok: false, reason: 'No capital' }; if (!r.ok) toast(r.reason, 'bad'); }
      if (d.action === 'armyStop') { a.path = []; }
      if (d.action === 'armySplit') { const b = splitArmy(a); if (b) selectArmy(b.id); }
      if (d.action === 'armyMerge') { const b = S().armies.find((x) => x.id === +d.other); if (b) mergeArmies(a, b); }
      if (d.action === 'armyGeneral') { const r = replaceGeneral(a); toast(r.ok ? `General ${a.general.name} takes command.` : r.reason, r.ok ? 'good' : 'bad'); }
      if (d.action === 'armyDisband') { disbandArmy(a); selectArmy(null); }
      refreshAll(true);
      break;
    }
    default: break;
  }
}

function onInput(e) {
  const el = e.target;
  const kind = el.dataset?.input;
  if (!kind) return;
  const me = player();
  if (kind === 'tax') { me.taxRate = +el.value / 100; el.nextElementSibling.textContent = el.value + '%'; }
  else if (kind === 'advAction') { assign(me, +el.dataset.id, el.value); refreshAll(true); }
  else if (kind === 'advTarget') { const a = me.cabinet.find((x) => x.id === +el.dataset.id); if (a) a.target = +el.value; }
  else if (kind === 'schemeTarget') { G.ui.schemeTarget = +el.value; refreshAll(true); }
  else if (kind === 'autoBuild') { me.autoBuild = el.checked; if (e.type === 'change') refreshAll(true); }
  else if (kind === 'autoResearch') {
    me.autoResearch = el.checked;
    if (me.autoResearch && !me.research.current) setResearch(me, G.ai.pickResearch(me));
    if (e.type === 'change') refreshAll(true);
  }
  refreshTopbar();
}

// ---------- Panels ----------
export function openPanel(name) {
  if (name) { G.ui.seen ??= {}; G.ui.seen[name] = true; }
  G.ui.panel = name;
  const el = $('mainPanel');
  [...$('nav').children].forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  if (!name) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  renderPanel(true);
}

function renderInto(el, html, keepScroll) {
  const body = el.querySelector('.panel-body');
  const top = keepScroll && body ? body.scrollTop : 0;
  el.innerHTML = html;
  const nb = el.querySelector('.panel-body');
  if (nb) nb.scrollTop = top;
}

function renderPanel(fresh = false) {
  if (!G.ui.panel) return;
  renderInto($('mainPanel'), PANELS[G.ui.panel](player()), !fresh);
  lastPanelDay = S().day;
}

export function selectProvince(pid) {
  G.ui.ctx = pid;
  G.ui.ctxArmy = null;
  G.ui.ctxFleet = null;
  hooks.onSelectFleet?.(null);
  hooks.onSelectArmy?.(null);
  hooks.onSelect?.(pid);
  const el = $('ctxPanel');
  if (pid == null || pid < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  renderInto(el, provincePanel(pid), false);
  lastCtxDay = S().day;
}

export function selectFleet(id) {
  G.ui.ctxFleet = id;
  G.ui.ctxArmy = null;
  G.ui.ctx = null;
  hooks.onSelect?.(null);
  hooks.onSelectArmy?.(null);
  hooks.onSelectFleet?.(id);
  const el = $('ctxPanel');
  const html = id != null ? fleetPanel(id) : null;
  if (!html) { el.classList.add('hidden'); G.ui.ctxFleet = null; hooks.onSelectFleet?.(null); return; }
  el.classList.remove('hidden');
  renderInto(el, html, false);
  lastCtxDay = S().day;
}

export function selectArmy(id) {
  G.ui.ctxFleet = null;
  hooks.onSelectFleet?.(null);
  G.ui.ctxArmy = id;
  G.ui.ctx = null;
  hooks.onSelect?.(null);
  hooks.onSelectArmy?.(id);
  const el = $('ctxPanel');
  const html = id != null ? armyPanel(id) : null;
  if (!html) { el.classList.add('hidden'); G.ui.ctxArmy = null; hooks.onSelectArmy?.(null); return; }
  el.classList.remove('hidden');
  renderInto(el, html, false);
  lastCtxDay = S().day;
}

export function refreshAll(force = false) {
  refreshTopbar();
  if (G.ui.interacting && !force) return;
  const day = S().day;
  if (G.ui.panel && (force || day !== lastPanelDay)) renderPanel(false);
  if (G.ui.ctxFleet != null && (force || day !== lastCtxDay)) {
    const html = fleetPanel(G.ui.ctxFleet);
    if (!html) selectFleet(null); else renderInto($('ctxPanel'), html, true);
    lastCtxDay = day;
  } else if (G.ui.ctxArmy != null && (force || day !== lastCtxDay)) {
    const html = armyPanel(G.ui.ctxArmy);
    if (!html) selectArmy(null); else renderInto($('ctxPanel'), html, true);
    lastCtxDay = day;
  } else if (G.ui.ctx != null && G.ui.ctx >= 0 && (force || day !== lastCtxDay)) {
    renderInto($('ctxPanel'), provincePanel(G.ui.ctx), true);
    lastCtxDay = day;
  }
}

// ---------- Top bar ----------
export function refreshTopbar() {
  const me = player();
  const st = S();
  $('tbFlag').src = flagUrl(me);
  $('tbName').textContent = me.displayName;
  $('tbRuler').textContent = `${rulerFullName(me)} (${me.ruler.age}) · House ${me.ruler.dynasty}`;
  const al = G.atmoLabel?.();
  $('tbDate').innerHTML = `${dateStr(st.day)}${al ? ` <span class="tb-season" title="Season · time of day">${{ Winter: '❄', Spring: '✿', Summer: '☀', Autumn: '🍂' }[al.season] || ''} ${al.season} · ${al.part}</span>` : ''}${st.sandbox ? ' <span class="tb-sandbox" title="Sandbox mode: god powers enabled">✦ Sandbox</span>' : ''}`;
  const L = projectLedger(me);
  const caps = storageCaps(me);
  const chip = (icon, val, net, tip) => `<div class="chip" title="${tip}">${iconImg(icon)}<span>${val}</span>${net !== null ? `<small class="${net > 0.05 ? 'pos' : net < -0.05 ? 'neg' : ''}">${fmtSigned(net)}</small>` : ''}</div>`;
  let html = '';
  { const rk = rankOf(me.id); $('tbRank').innerHTML = `🏆<span>#${rk.rank || '–'}/${rk.of}</span><small>${fmt(rk.score)}</small>`; }
  html += '<div class="tb-group" data-g="Realm" title="Your realm: treasury, people, living standard">';
  html += chip('gold', fmt(me.treasury), L.net.gold, 'Treasury (gold) — monthly balance');
  html += chip('pop', fmt(civPopulation(me)), null, 'Population');
  const sol = me.sol ?? 5;
  html += `<div class="chip" data-action="open" data-panel="population" style="cursor:pointer" title="Average standard of living (0–10)">☺<span style="color:${sol >= 6.5 ? 'var(--good)' : sol < 4 ? 'var(--bad)' : 'var(--gold)'}">${sol.toFixed(1)}</span></div>`;
  const gchip = (g, label) => { const mk = me.market; const net = mk ? (mk.supply[g] || 0) - (mk.demand[g] || 0) : null; return `<div class="chip" data-action="open" data-panel="economy" style="cursor:pointer" title="${label}: ${fmt(me.stock[g] || 0)} in stock (cap ${fmt(caps[g])}) · price ${(mk?.price[g] ?? 0).toFixed(2)}"><i class="gdot" style="background:${GOODS[g].color}"></i><span>${fmt(me.stock[g] || 0)}</span>${net !== null ? `<small class="${net > 0.05 ? 'pos' : net < -0.05 ? 'neg' : ''}">${fmtSigned(net)}</small>` : ''}</div>`; };
  html += '</div><div class="tb-group" data-g="Goods" title="Stockpiles of key goods">';
  html += gchip('grain', 'Grain');
  html += gchip('wood', 'Wood');
  html += gchip('stone', 'Stone');
  html += gchip('iron', 'Iron');
  html += gchip('tools', 'Tools');
  html += '</div><div class="tb-group" data-g="Learning" title="Research">';
  html += chip('knowledge', me.research.current ? Math.floor(me.research.pool) : '!', L.knowledge, me.research.current ? 'Knowledge toward current research' : 'No research selected! Open Technology (T)');
  html += '</div>';
  const wars = warsOf(me.id);
  if (wars.length) html += `<div class="chip" data-action="open" data-panel="military" style="cursor:pointer;border-color:#a33;color:#ff8a70" title="${E(wars.map((w) => w.name).join(', '))}">⚔ ${wars.length} war${wars.length > 1 ? 's' : ''}</div>`;
  const crises = st.plays?.filter((p) => p.att === me.id || p.def === me.id) || [];
  if (crises.length) html += `<div class="chip" data-action="open" data-panel="diplomacy" style="cursor:pointer;border-color:#e6a23c;color:#ffd08a" title="Diplomatic crisis under way">⚠ crisis ${Math.round(Math.max(...crises.map((p) => p.escalation)))}%</div>`;
  const offers = st.offers.filter((o) => o.to === me.id).length;
  if (offers) html += `<div class="chip" data-action="open" data-panel="diplomacy" style="cursor:pointer;border-color:var(--gold)" title="Pending diplomatic proposals">✉ ${offers}</div>`;
  $('tbRes').innerHTML = html;
  const stab = Math.round(me.stability);
  const sb = stabilityBreakdown(me);
  $('tbStab').innerHTML = `${iconImg('stability')}<span style="color:${stab < 30 ? 'var(--bad)' : stab > 60 ? 'var(--good)' : 'var(--gold)'}">${stab}</span><small class="${sb.target > me.stability + 0.5 ? 'pos' : sb.target < me.stability - 0.5 ? 'neg' : ''}">${sb.target > me.stability + 0.5 ? '▲' : sb.target < me.stability - 0.5 ? '▼' : ''}</small>`;
  [...$('tbSpeed').children].forEach((b, i) => b.classList.toggle('on', i === hooks.getSpeed()));
  if (me.alive) $('alerts').innerHTML = computeAlerts(me);
  else $('alerts').innerHTML = '';
}

// ---------- Alerts: things that need the player's attention ----------
function computeAlerts(me) {
  const st = S();
  const out = [];
  const add = (cls, text, attrs, tip = '') => out.push(`<div class="alert ${cls}" ${attrs} title="${E(tip || text)}">${text}</div>`);
  if (!me.research.current && !me.autoResearch && availableTechCount(me)) add('warn', '⚗ Choose research', 'data-action="open" data-panel="technology"');
  if (me.last?.starving) add('bad', '🍞 Famine!', 'data-action="open" data-panel="economy"', 'Food stores are empty — raise food priority or build farms');
  if (me.treasury < 0) add('bad', '🪙 In debt', 'data-action="open" data-panel="economy"', 'Negative treasury: stability and army morale suffer');
  for (const g of GROUP_LIST) {
    const grp = me.groups?.[g];
    if (grp && grp.movement >= 40) add(grp.movement >= 75 ? 'bad' : 'warn', `${GROUPS[g].icon} ${GROUPS[g].short} movement ${Math.round(grp.movement)}%`, 'data-action="open" data-panel="politics"', `The ${GROUPS[g].name} are organising. At 100% they will demand a law change — or revolt.`);
  }
  const setts = me.settlements.map((id) => st.settlements[id]);
  for (const s of setts) {
    if (st.armies.some((a) => a.siege && a.siege.s === s.id)) add('bad', `🏰 ${E(s.name)} besieged`, `data-action="focusSettlement" data-id="${s.id}"`);
  }
  const enemies = enemiesOf(me.id);
  if (enemies.size) {
    const inv = st.armies.find((a) => enemies.has(a.civ) && st.provinces[G.world.province[a.tile]]?.owner === me.id);
    if (inv) add('bad', `⚔ Enemy army in our lands`, `data-action="selectArmy" data-id="${inv.id}"`, `${st.civs[inv.civ].displayName}: ${E(inv.name)}`);
  }
  const restless = setts.filter((s) => (s.unrest || 0) > 60).sort((a, b) => b.unrest - a.unrest)[0];
  if (restless) add('warn', `🔥 Revolt risk: ${E(restless.name)}`, `data-action="focusSettlement" data-id="${restless.id}"`, 'Unrest above 60 — the settlement may rise in revolt');
  if (!me.autoBuild) {
    const idle = setts.filter((s) => !s.queue.length && BUILDING_LIST.some((t) => canBuild(me, s, t).ok));
    if (idle.length) add('info', `🏗 ${idle.length} idle builder${idle.length > 1 ? 's' : ''}`, `data-action="alertBuild" data-sid="${idle[0].id}"`, idle.map((s) => s.name).join(', ') + ' can start construction');
  }
  if (GOVERNMENTS[me.gov].succession === 'heir' && !me.family?.length && me.ruler.age >= 45) add('warn', '👑 No heir', 'data-action="open" data-panel="government"', 'If the ruler dies without children a new house takes the throne');
  return out.slice(0, 6).join('');
}
const availableTechCount = (c) => TECHS.filter((t) => !c.techs.includes(t.id) && (!t.race || t.race === c.race)).length;

export function setModeButtons(mode) {
  [...$('mapModes').children].forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
}

// ---------- Log & toasts ----------
function addLog(e) {
  const me = player();
  if (e.civ !== me.id && e.type !== 'world') return;
  if (e.type === 'world' && !(e.toast || me.contacts.includes(e.civ) || /Era|collapsed|reforms/.test(e.text))) return;
  const el = $('log');
  const div = document.createElement('div');
  div.className = `le ${e.type} ${e.tile >= 0 ? 'loc' : ''}`;
  if (e.tile >= 0) { div.dataset.action = 'focusTile'; div.dataset.tile = e.tile; }
  div.innerHTML = `<span class="d">${shortDate(e.day)}</span>${E(e.text)}`;
  el.appendChild(div);
  while (el.children.length > 80) el.firstChild.remove();
  el.scrollTop = el.scrollHeight;
}
export function rebuildLog() {
  $('log').innerHTML = '';
  for (const e of S().log.slice(-60)) addLog(e);
}

export function toast(text, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; }, 4200);
  setTimeout(() => el.remove(), 4800);
}

// ---------- Tooltip ----------
export function showTooltip(x, y, pid) {
  const tt = $('tooltip');
  if (pid == null || pid < 0) { tt.classList.add('hidden'); return; }
  const st = S();
  const P = G.world.provinces[pid];
  const ps = st.provinces[pid];
  const owner = ps.owner >= 0 ? st.civs[ps.owner] : null;
  const s = ps.settlement >= 0 ? st.settlements[ps.settlement] : null;
  const main = Object.entries(P.biomes).sort((a, b) => b[1] - a[1])[0];
  tt.innerHTML = `<div class="tt-t">${E(s ? s.name : P.name)}</div>` +
    `<div class="small">${s ? `${STAGES[s.stage].name} · ${fmt(s.pop)} people<br>` : ''}${owner ? `<span style="color:${owner.color}">${E(owner.displayName)}</span>` : '<span class="muted">Unclaimed</span>'}</div>` +
    `<div class="small muted">${E(P.name)} · ${BIOMES[main[0]].name}</div>`;
  tt.classList.remove('hidden');
  const r = tt.getBoundingClientRect();
  tt.style.left = Math.min(window.innerWidth - r.width - 8, x + 16) + 'px';
  tt.style.top = Math.min(window.innerHeight - r.height - 8, y + 16) + 'px';
}

// ---------- Modals ----------
export function showModal(html) { const m = $('modal'); m.onclick = null; m.innerHTML = html; m.classList.remove('hidden'); }
export function hideModal() { $('modal').classList.add('hidden'); $('modal').innerHTML = ''; }
export const modalOpen = () => !$('modal').classList.contains('hidden');
export function setLoading(on, text = 'Shaping the world…') { $('loading').classList.toggle('hidden', !on); $('loadingText').textContent = text; }

export function startScreen(onStart, onLoad) {
  showTitleBackdrop();
  const saves = listSaves();
  let race = 'humans';
  let color = RACES[race].colors[0];
  const raceCard = (r) => {
    const R = RACES[r];
    const prev = [0, 1, 2, 3].map((t) => `<img src="${houseSprite(r, t).toDataURL()}">`).join('');
    return `<div class="race ${r === race ? 'on' : ''}" data-race="${r}"><div class="preview">${prev}</div><h4>${R.name}</h4><p>${R.desc}</p>` +
      R.strengths.map((s) => `<span class="tag good">${s}</span>`).join('') + R.weaknesses.map((s) => `<span class="tag bad">${s}</span>`).join('') + '</div>';
  };
  const render = () => {
    showModal(`<div class="modal-box">
      <div class="title-logo">LIVING WORLD</div>
      <div class="title-sub">Create a civilization · Build a nation · Shape your own history</div>
      <h3>Choose your people</h3>
      <div class="races">${RACE_LIST.map(raceCard).join('')}</div>
      <div class="form">
        <label>Name of your people<input id="ssName" maxlength="20" placeholder="Random"></label>
        <label>World seed<input id="ssSeed" value="${Math.floor(Math.random() * 999999)}"></label>
        <label>World size<select id="ssSize">${Object.entries(WORLD_SIZES).map(([k, v]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${v.label} (${v.w}×${v.h})</option>`).join('')}</select></label>
        <label>Rival civilizations<select id="ssAi">${[3, 5, 7, 9, 11].map((n) => `<option ${n === 7 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label title="${Object.values(WORLD_TYPES).map((t) => `${t.label}: ${t.desc}`).join('\n')}">World type<select id="ssType">${Object.entries(WORLD_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
        <label title="Sandbox: free god powers (meteors, plagues, terraforming, starting wars…) and you can switch which realm you rule.">Game mode<select id="ssMode"><option value="normal">Grand strategy</option><option value="sandbox">Sandbox — god powers</option></select></label>
        <label title="How often earthquakes, plagues, droughts, floods, wildfires, blizzards and eruptions strike on their own.">Natural disasters<select id="ssDis">${['off', 'rare', 'normal', 'frequent'].map((k) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select></label>
        <label title="${Object.values(DIFFICULTY).map((d) => d.name + ': ' + d.desc).join('\n')}">Difficulty<select id="ssDiff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label>
        <label title="Start knowing only your own region; explore, trade and exchange maps to chart the world.">Fog of war<select id="ssFog"><option value="on">On</option><option value="off">Off</option></select></label>
        <label style="grid-column: span 3">Banner colour<div class="colors" id="ssColors">${[...RACES[race].colors, '#e84393', '#17a2b8', '#c0ca33', '#5c6bc0'].map((c) => `<i data-color="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></i>`).join('')}</div></label>
      </div>
      <div class="actions">
        <button class="btn primary" id="ssStart" style="font-size:17px;padding:9px 24px">Found your people</button>
        <button class="btn" id="ssLearn" style="font-size:15px" title="A small, easy world with a step-by-step guide">📜 Learn to play</button>
        ${saves.length ? `<button class="btn" id="ssLoad" style="font-size:15px">Continue (${E(saves[0].name)}, ${shortDate(saves[0].day)})</button>` : ''}
        <button class="btn" data-action="menuItem" data-item="startLoad" style="font-size:15px">Load game…</button>
        <button class="btn" data-action="menuItem" data-item="scenarios" style="font-size:15px">Scenarios & Map Editor</button>
      </div>
    </div>`);
    const m = $('modal');
    m.querySelectorAll('[data-race]').forEach((el) => el.addEventListener('click', () => {
      const keep = { name: $('ssName').value, seed: $('ssSeed').value, size: $('ssSize').value, ai: $('ssAi').value, type: $('ssType').value, mode: $('ssMode').value, dis: $('ssDis').value, fog: $('ssFog').value, diff: $('ssDiff').value };
      race = el.dataset.race; color = RACES[race].colors[0]; render();
      $('ssName').value = keep.name; $('ssSeed').value = keep.seed; $('ssSize').value = keep.size; $('ssAi').value = keep.ai; $('ssType').value = keep.type; $('ssMode').value = keep.mode; $('ssDis').value = keep.dis; $('ssFog').value = keep.fog; $('ssDiff').value = keep.diff;
    }));
    m.querySelectorAll('[data-color]').forEach((el) => el.addEventListener('click', () => {
      color = el.dataset.color;
      m.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === el));
    }));
    $('ssStart').addEventListener('click', () => {
      const seedRaw = $('ssSeed').value.trim();
      const seed = /^\d+$/.test(seedRaw) ? +seedRaw : [...seedRaw].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      onStart({ race, color, civName: $('ssName').value.trim(), seed: seed || 1, size: $('ssSize').value, aiCount: +$('ssAi').value, mapType: $('ssType').value, sandbox: $('ssMode').value === 'sandbox', disasters: $('ssDis').value, fog: $('ssFog').value === 'on', difficulty: $('ssDiff').value, disasters: $('ssDis').value === 'normal' ? undefined : $('ssDis').value });
    });
    $('ssLoad')?.addEventListener('click', () => onLoad(saves[0].slot));
    $('ssLearn')?.addEventListener('click', () => onStart({ race: 'humans', color: RACES.humans.colors[0], civName: '', seed: 4111, size: 'small', aiCount: 4, mapType: 'continents', difficulty: 'easy', disasters: 'rare', fog: false, tutorial: true }));
  };
  render();
}

export function gameMenu() {
  showModal(`<div class="modal-box narrow">
    <div class="title-logo" style="font-size:28px">LIVING WORLD</div>
    <div class="menu-list">
      <button class="btn primary" data-action="menuItem" data-item="resume">Resume</button>
      <button class="btn" data-action="menuItem" data-item="saves">Save / Load</button>
      <button class="btn" data-action="menuItem" data-item="settings">Settings</button>
      <button class="btn" data-action="menuItem" data-item="help">Controls & tips</button>
      <button class="btn" data-action="menuItem" data-item="summary">Score &amp; summary</button>
      <button class="btn" data-action="menuItem" data-item="encyclopedia">Encyclopedia (I)</button>
      <button class="btn" data-action="menuItem" data-item="new">New world</button>
    </div></div>`);
}

export function saveManager(inGame = true) {
  const saves = listSaves();
  const used = storageUsed();
  const p = inGame ? player() : null;
  showModal(`<div class="modal-box" style="width:min(620px,94vw)">
    <div class="row between"><div class="title-logo" style="font-size:26px">SAVE / LOAD</div><button class="btn sm" data-action="menuItem" data-item="${inGame ? 'menu' : 'back'}">Back</button></div>
    ${inGame ? `<h3>Save current game</h3><div class="row"><input id="saveName" maxlength="32" value="${E(p.baseName)} Y${Math.floor(S().day / 360) + 1}" style="flex:1;background:#120e0a;border:1px solid var(--line2);color:var(--text);padding:6px 8px;border-radius:3px"><button class="btn primary" data-action="menuItem" data-item="saveAs">Save</button></div>` : ''}
    <h3>Saved games <span class="muted small">${(used / 1024 / 1024).toFixed(2)} MB of browser storage used</span></h3>
    ${saves.length ? `<table><tr><th>Name</th><th>Realm</th><th>Date</th><th></th></tr>${saves.map((s) => `<tr><td>${E(s.label || s.slot)}<div class="muted small">${new Date(s.savedAt).toLocaleString()} · ${Math.round(s.size / 1024)} KB</div></td><td>${E(s.name)}</td><td>${shortDate(s.day)}</td><td style="white-space:nowrap"><button class="btn sm primary" data-action="menuItem" data-item="load" data-slot="${s.slot}">Load</button> <button class="btn sm" data-action="menuItem" data-item="delete" data-slot="${s.slot}" title="Delete">✕</button></td></tr>`).join('')}</table>` : '<div class="muted small">No saved games yet.</div>'}
    <h3>Files</h3>
    <div class="row" style="gap:6px">${inGame ? '<button class="btn" data-action="menuItem" data-item="export">Export to file</button>' : ''}<button class="btn" data-action="menuItem" data-item="import">Import from file…</button></div>
    <div class="small muted" style="margin-top:6px">Saves live in this browser. Export a file to back up a game or move it to another computer. Autosaves rotate through 3 slots.</div>
  </div>`);
}

export function settingsModal() {
  const S_ = SETTINGS;
  const tog = (k, label) => `<label class="toggle"><input type="checkbox" data-setting="${k}" ${S_[k] ? 'checked' : ''}> ${label}</label>`;
  showModal(`<div class="modal-box narrow" style="width:min(480px,94vw)">
    <div class="row between"><div class="title-logo" style="font-size:26px">SETTINGS</div><button class="btn sm" data-action="menuItem" data-item="menu">Back</button></div>
    <h3>Language</h3>
    <div class="slider-row"><span>Language</span><select data-setting="lang" data-str="1" style="background:#120e0a;color:var(--text);border:1px solid var(--line2);padding:3px">${Object.entries(LANGS).map(([v, l]) => `<option value="${v}" ${(S_.lang || 'en') === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span></span></div>
    <h3>Game</h3>
    <div class="slider-row"><span>Autosave</span><select data-setting="autosaveYears" style="background:#120e0a;color:var(--text);border:1px solid var(--line2);padding:3px">${[[0, 'Off'], [1, 'Every year'], [5, 'Every 5 years'], [10, 'Every 10 years']].map(([v, l]) => `<option value="${v}" ${S_.autosaveYears === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span></span></div>
    ${tog('confirmWar', 'Ask for confirmation before declaring war')}
    ${tog('pauseOnBattle', 'Pause when one of my armies enters battle')}
    <h3>Sound</h3>
    ${tog('muted', 'Mute all sound')}
    ${[['masterVolume', 'Master'], ['musicVolume', 'Music'], ['sfxVolume', 'Effects'], ['ambienceVolume', 'Ambience']].map(([k, l]) => `<div class="slider-row"><span>${l}</span><input type="range" min="0" max="1" step="0.05" value="${S_[k]}" data-setting="${k}"><b>${Math.round(S_[k] * 100)}%</b></div>`).join('')}
    <div class="small muted">Music is generated live: it follows your era and turns martial in wartime.</div>
    <h3>Display</h3>
    <div class="row" style="gap:4px;margin-bottom:6px"><span class="small muted" style="align-self:center">Graphics preset</span>${[['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].map(([k, l]) => `<button class="btn sm" data-action="gfxPreset" data-p="${k}">${l}</button>`).join('')}</div>
    ${tog('showWildlife', 'Show wildlife')}
    ${tog('showVillagers', 'Show villagers in settlements')}
    ${tog('ambientLife', 'Show carts, ships and smoke around towns')}
    ${tog('hdTiles', 'High-detail 16×16 tiles when zoomed in')}
    ${tog('colorGrade', 'Warm colour grading and vignette')}
    ${tog('gradeFilter', 'Time-of-day colour mood (richer colours)')}
    ${tog('shadows', 'Shadows from the sun')}
    ${tog('sunbeams', 'Sunbeams at dawn and dusk')}
    ${tog('advisor', 'Show the advisor')}
    ${tog('gpuTerrain', 'Graphics card terrain (faster, animated water)')}
    ${tog('atlas', 'Illustrated atlas when zoomed far out')}
    ${tog('detailTrees', 'Detailed seasonal trees when zoomed in')}
    ${tog('seasons', 'Seasons (autumn colours, winter snow)')}
    ${tog('dayNight', 'Day and night cycle')}
    ${tog('clouds', 'Drifting clouds')}
    ${tog('weather', 'Rain, snow and fog')}
    ${tog('screenShake', 'Screen shake (earthquakes, meteors)')}
    <div class="slider-row"><span>Effects quality</span><select data-setting="effectsQuality" style="background:#120e0a;color:var(--text);border:1px solid var(--line2);padding:3px">${[[1, 'Low'], [2, 'Normal'], [3, 'High']].map(([v, l]) => `<option value="${v}" ${S_.effectsQuality === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span></span></div>
    ${tog('edgePan', 'Pan the map when the mouse touches the screen edge')}
    ${tog('colorBlind', 'Colour-blind friendly map colours')}
    <div class="slider-row"><span>Interface size</span><input type="range" min="0.8" max="1.4" step="0.05" value="${S_.uiScale}" data-setting="uiScale"><b>${Math.round(S_.uiScale * 100)}%</b></div>
    <h3>Key bindings</h3>
    <div class="keybinds">${KEY_ACTIONS.map(([id, label]) => `<div class="kb-row"><span>${label}</span><button class="btn sm kb" data-action="bindKey" data-id="${id}">${keyLabel(keyFor(id))}</button></div>`).join('')}</div>
    <button class="btn sm" data-action="resetKeys" style="margin-top:4px">Reset to defaults</button>
    <div class="small muted" style="margin-top:8px">Settings are stored in this browser and do not affect saved games.</div>
  </div>`);
  const m = document.getElementById('modal');
  m.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') S_[k] = el.checked;
    else if (el.tagName === 'SELECT') S_[k] = el.dataset.str ? el.value : +el.value;
    else { S_[k] = +el.value; el.nextElementSibling.textContent = Math.round(S_[k] * 100) + '%'; }
    saveSettings();
    if (k === 'lang') { setLang(S_.lang); settingsModal(); }
    if (k === 'colorBlind') G.dirty.owners = true;
  }));
}
export function gfxPreset(p) {
  const P = { low: { effectsQuality: 1, hdTiles: false, weather: false, clouds: false, ambientLife: false, detailTrees: false, colorGrade: false, gradeFilter: false, shadows: false, sunbeams: false, showVillagers: false }, normal: { effectsQuality: 2, hdTiles: true, weather: true, clouds: true, ambientLife: true, detailTrees: true, colorGrade: true, gradeFilter: true, shadows: true, showVillagers: true }, high: { effectsQuality: 3, hdTiles: true, weather: true, clouds: true, ambientLife: true, detailTrees: true, colorGrade: true, gradeFilter: true, shadows: true, showVillagers: true } }[p];
  if (!P) return;
  Object.assign(SETTINGS, P); saveSettings(); settingsModal();
}
// wait for the next key press and bind it
export function captureKey(id, btn) {
  btn.textContent = t('Press a key…');
  const on = (e) => {
    e.preventDefault(); e.stopPropagation();
    window.removeEventListener('keydown', on, true);
    if (e.key !== 'Escape') { bindKey(id, e.key.toLowerCase()); saveSettings(); }
    settingsModal();
  };
  window.addEventListener('keydown', on, true);
}

// ---------- Score summary (Phase 15) ----------
export function summaryModal(final = false) {
  const st = S();
  const me = player();
  const rk = rankings();
  const mine = rk.find((x) => x.c.id === me.id) || { total: 0, parts: {} };
  const rank = rk.findIndex((x) => x.c.id === me.id) + 1;
  const years = Math.floor(st.day / 360);
  const hist = me.hist || [];
  const peak = hist.reduce((b, r) => (r[8] > (b?.[8] || 0) ? r : b), null);
  const bars = SCORE_PARTS.map(([k, l, ic]) => { const v = mine.parts[k] || 0; const top = Math.max(1, ...rk.map((x) => x.parts[k] || 0)); return `<div class="row small" style="gap:6px"><span style="width:110px">${ic} ${l}</span><div class="bar" style="flex:1"><i style="width:${(v / top) * 100}%"></i></div><b style="width:44px;text-align:right">${fmt(v)}</b></div>`; }).join('');
  const series = rk.slice(0, 6).map((x) => ({ name: x.c.displayName, color: x.c.color, bold: x.c.id === me.id, pts: (x.c.hist || []).filter((r) => r[8] != null).map((r) => [r[0], r[8]]) }));
  if (!series.some((s) => s.bold) && hist.length) series.push({ name: me.displayName, color: me.color, bold: true, pts: hist.filter((r) => r[8] != null).map((r) => [r[0], r[8]]) });
  const moments = (st.chronicle || []).filter((e) => e.civ === me.id).slice(-10).reverse();
  showModal(`<div class="modal-box" style="width:min(720px,94vw)">
    <div class="title-logo" style="font-size:30px">${final ? 'THE CHRONICLE CLOSES' : 'STANDING OF THE REALM'}</div>
    <div class="title-sub">${E(me.displayName)} · ${years} years · ${me.alive ? `rank <b>#${rank}</b> of ${rk.length}` : 'fallen'}</div>
    <div class="row between"><h3 style="margin:0">Score ${fmt(mine.total)}</h3><span class="small muted">${peak ? `Peak ${fmt(peak[8])} in year ${peak[0] + 1}` : ''}</span></div>
    ${bars}
    <h3>Score of the great realms</h3>${lineChart(series, { fmtY: fmt })}
    <h3>Ranking</h3><table><tr><th>#</th><th>Realm</th><th>Score</th>${SCORE_PARTS.map(([, l]) => `<th>${l.slice(0, 4)}</th>`).join('')}</tr>${rk.slice(0, 10).map((x, i) => `<tr style="${x.c.id === me.id ? 'background:rgba(230,192,104,.15)' : ''}"><td>${i + 1}</td><td style="color:${x.c.color}">${E(x.c.displayName)}</td><td><b>${fmt(x.total)}</b></td>${SCORE_PARTS.map(([k]) => `<td class="small">${fmt(x.parts[k] || 0)}</td>`).join('')}</tr>`).join('')}</table>
    ${moments.length ? `<h3>Moments of your reign</h3>${moments.map((e) => `<div class="small" style="padding:2px 0 2px 8px;border-left:3px solid ${me.color}">Y${Math.floor(e.day / 360) + 1} — ${E(e.text)}</div>`).join('')}` : ''}
    <div class="actions"><button class="btn primary" data-action="menuItem" data-item="resume">${final ? 'Keep watching the world' : 'Continue'}</button><button class="btn" data-action="menuItem" data-item="new">New world</button></div>
  </div>`);
}

// ---------- Phase 17: battle report ----------
export function battleReportModal(id) {
  const st = S();
  const r = (st.battleReports || []).find((x) => x.id === id);
  if (!r) return;
  const A = st.civs[r.ac], D = st.civs[r.dc], Wn = st.civs[r.winner];
  const comp = (c) => Object.entries(c).map(([k, n]) => `${n} ${UNITS[k]?.name || k}`).join(', ') || '—';
  const col = (civ, g, start, loss, c, att) => `<div class="card small" style="border-top:3px solid ${civ.color}"><b style="color:${civ.color}">${E(civ.displayName)}</b> <span class="muted">${att ? 'attacking' : 'defending'}</span>
    <div>Commander: <b>${E(g.name)}</b>${g.hero ? ' ✦' : ''} · skill ${g.skill}${g.trait ? ` · ${E(g.trait)}` : ''}</div>
    <div>Fielded ${start} regiments: ${E(comp(c))}</div><div>Lost <b>${loss}</b> (${Math.round((loss / Math.max(0.1, start)) * 100)}%)</div></div>`;
  showModal(`<div class="modal-box narrow" style="width:min(620px,94vw)">
    <div class="title-logo" style="font-size:26px;text-align:left">Battle of ${E(r.place)}</div>
    <div class="small muted" style="margin:4px 0 10px">${dateStr(r.day)} · ${E(r.terrain)} · ${r.days} day${r.days === 1 ? '' : 's'} of fighting</div>
    <p style="font-size:15px"><b style="color:${Wn?.color}">${E(Wn?.displayName || '?')}</b> won the day${r.destroyed ? ', and the beaten army was annihilated' : ' and the beaten army fled the field'}.</p>
    <div class="grid2" style="gap:8px">${col(A, r.gA, r.startA, r.lossA, r.compA, true)}${col(D, r.gD, r.startD, r.lossD, r.compD, false)}</div>
    <h3>Why it was won</h3>${r.why.map((w) => `<div class="small">• ${E(w[0].toUpperCase() + w.slice(1))}.</div>`).join('')}
    ${r.despite?.length ? `<h3>Despite</h3>${r.despite.map((w) => `<div class="small muted">• ${E(w[0].toUpperCase() + w.slice(1))}.</div>`).join('')}` : ''}
    ${r.traits?.length ? `<div class="small muted" style="margin-top:6px">${r.traits.map(E).join(' · ')}.</div>` : ''}
    <div class="actions"><button class="btn" data-action="viewBattle" data-id="${r.id}">⚔ Watch the battle</button><button class="btn" data-action="focusTile" data-tile="${r.tile}">Show the field</button><button class="btn primary" data-action="menuItem" data-item="resume">Close</button></div>
  </div>`);
}

// ---------- Historical events ----------
export function eventModal(pe) {
  const v = eventView(pe);
  // Phase 17: event stories in Ukrainian, with names filled in
  if (currentLang() === 'uk' && UK_EVENTS[pe.ev]) {
    const st = S(), cv = (id) => st.civs[id];
    const h = { town: (x) => st.settlements[x.s]?.name || '—', civ: (id) => cv(id)?.displayName || '—', dynasty: (id) => cv(id)?.ruler?.dynasty || '—', ruler: (c) => t(rulerFullName(c)), heir: (c) => heirOf(c)?.name || '—', capital: (c) => st.settlements[c.capital]?.name || 'столиці', group: (g) => t(G.politics?.groupName(g) || g), law: (l) => t(G.politics?.lawName(l) || l) };
    try { v.text = UK_EVENTS[pe.ev](cv(pe.civ), pe.ctx, h); } catch (e) { console.warn('uk event text', e); }
  }
  showModal(`<div class="modal-box narrow parchment" style="width:min(520px,94vw)">
    <div class="title-logo" style="font-size:26px;text-align:left">${E(v.title)}</div>
    <div class="small muted" style="margin:4px 0 10px">${dateStr(pe.day)}${v.chain ? ` · <span class="tag gold">📜 ${E(v.chain)}</span>` : ''}</div>
    <p style="line-height:1.55;font-size:14px">${E(v.text)}</p>
    <div class="menu-list">${v.options.map((o, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" style="text-align:left" data-action="eventChoice" data-id="${pe.id}" data-idx="${i}">${E(o.label)}<div class="small" style="font-family:var(--ui);opacity:.8;margin-top:2px">${E(o.desc)}</div></button>`).join('')}</div>
  </div>`);
}

// ---------- Live battle view (drawn every frame while visible) ----------
export function drawBattleCanvas(time) {
  const cv = document.getElementById('battleCanvas');
  if (!cv) return;
  const st = S();
  const b = st.battles.find((x) => x.id === +cv.dataset.battle);
  if (!b) return;
  const us = st.armies.find((x) => x.id === +cv.dataset.army);
  const them = st.armies.find((x) => x.id === (b.a === us?.id ? b.d : b.a));
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#3e5a2c'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(2, 0, 0, 2, 0, 0); // chunky pixel-art scale
  const W = cv.width / 2, H = cv.height / 2 + 14; // battlefield uses the top part
  for (let i = 0; i < 50; i++) { ctx.fillStyle = i % 2 ? '#46663a' : '#365027'; ctx.fillRect((i * 37) % W, (i * 23) % 60, 2, 1); }
  const rows = ['rng', 'inf', 'cav', 'sie'];
  const drawSide = (army, left) => {
    if (!army) return;
    const civ = st.civs[army.civ];
    const adv = b.ended ? 0 : b.day < 3 ? 3 : 20 + Math.sin(time * 3) * 2;
    rows.forEach((cls, ri) => {
      let n = 0;
      for (const k in army.units) if (UNITS[k].cls === cls) n += army.units[k];
      const figs = Math.min(15, Math.ceil(n * 3));
      const skin = RACES[civ.race].skin;
      const move = cls === 'inf' || cls === 'cav' ? 1 : 0.3;
      for (let i = 0; i < figs; i++) {
        const r = i % 3, c = Math.floor(i / 3);
        const baseX = left ? 8 + c * 5 + (r % 2) * 2 + adv * move : W - 12 - c * 5 - (r % 2) * 2 - adv * move;
        const y = 3 + ri * 15 + r * 4.5;
        const jx = Math.sin(time * 8 + i * 1.7 + ri) * (b.day >= 3 ? 1.2 : 0.4);
        const x = baseX + jx;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 0.5, y + 5, cls === 'cav' ? 6 : 4, 1);
        if (cls === 'cav') { ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 1, y + 2, 6, 3); }
        if (cls === 'sie') { ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 1, y + 1, 7, 3); ctx.fillStyle = '#3b2a1a'; ctx.fillRect(x, y + 4, 2, 2); ctx.fillRect(x + 4, y + 4, 2, 2); continue; }
        ctx.fillStyle = civ.color; ctx.fillRect(x, y + 1, 3, 4);
        ctx.fillStyle = skin; ctx.fillRect(x + 0.5, y - 1, 2, 2);
        ctx.fillStyle = '#cfd6dd'; ctx.fillRect(left ? x + 3 : x - 1, y - 1, 1, cls === 'rng' ? 3 : 5);
      }
      // ranged volleys during skirmish
      if (cls === 'rng' && n > 0 && b.day < 4 && !b.ended) {
        ctx.fillStyle = 'rgba(240,230,200,0.85)';
        for (let k = 0; k < 5; k++) {
          const t = (time * 0.9 + k / 5) % 1;
          const x = left ? 20 + t * (W - 40) : W - 20 - t * (W - 40);
          ctx.fillRect(x, 6 + ri * 15 + k * 2 - Math.sin(t * Math.PI) * 9, 2, 0.6);
        }
      }
    });
    // morale bar
    const bh = 58;
    ctx.fillStyle = '#1b140e'; ctx.fillRect(left ? 2 : W - 4, 3, 2, bh);
    ctx.fillStyle = army.morale > 0.5 ? '#8fd16b' : army.morale > 0.25 ? '#e6c068' : '#e46b5a';
    const mh = bh * army.morale;
    ctx.fillRect(left ? 2 : W - 4, 3 + (bh - mh), 2, mh);
  };
  drawSide(us, true);
  drawSide(them, false);
  // clash sparks in melee
  if (!b.ended && b.day >= 3) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,${180 + Math.random() * 70},90,${Math.random()})`;
      ctx.fillRect(W / 2 - 8 + Math.random() * 16, 4 + Math.random() * 52, 1, 1);
    }
  }
  // casualty history chart (full resolution)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const CW = cv.width, CH = cv.height;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, CH - 26, CW, 26);
  const hist = b.hist || [];
  const max = Math.max(0.2, ...hist.map(([x, y]) => Math.max(x, y)));
  const usIsA = b.a === us?.id;
  hist.forEach(([la, ld], i) => {
    const mine = usIsA ? la : ld, theirs = usIsA ? ld : la;
    const x = 120 + i * 4.2;
    ctx.fillStyle = st.civs[us?.civ ?? b.ac].color; ctx.fillRect(x, CH - 3 - (mine / max) * 18, 1.8, (mine / max) * 18);
    ctx.fillStyle = st.civs[them?.civ ?? b.dc].color; ctx.fillRect(x + 2, CH - 3 - (theirs / max) * 18, 1.8, (theirs / max) * 18);
  });
  ctx.fillStyle = '#f4ecd8'; ctx.font = '600 11px "Pixelify Sans", monospace';
  ctx.fillText(`${b.phase} · day ${b.day}`, 6, CH - 9);
  void armyCount;
}

export function helpModal() {
  showModal(`<div class="modal-box narrow" style="width:min(560px,94vw)">
    <h3>Controls</h3>
    <div class="help-grid">
      <kbd>Drag / WASD</kbd><span>Pan the map</span>
      <kbd>Scroll / Z X</kbd><span>Zoom in / out</span>
      <kbd>Click</kbd><span>Select a province, settlement or army</span>
      <kbd>Right-click</kbd><span>March the selected army there</span>
      <kbd>Space</kbd><span>Pause / resume</span>
      <kbd>1 – 5</kbd><span>Game speed · <kbd>+ / −</kbd> faster / slower</span>
      <kbd>V E R M G K O T C P L · I</kbd><span>Overview, Economy, Diplomacy, Military, Government, Court, Politics, Technology, Construction, Population, Ledger · I: Encyclopedia</span>
      <kbd>F1 – F8</kbd><span>Map modes</span>
      <kbd>H</kbd><span>Jump to your capital</span>
      <kbd>Ctrl+S</kbd><span>Quick save</span>
      <kbd>Esc</kbd><span>Close panels / game menu (in sandbox: back to Inspect)</span>
      <kbd>Right-click</kbd><span>Quick-action menu (when no army is selected)</span>
      <kbd>/ or Ctrl+F</kbd><span>Search settlements, realms and provinces</span>
      <kbd>B</kbd><span>Build in the selected settlement (or the capital)</span>
      <kbd>N</kbd><span>Next settlement with nothing under construction</span>
      <kbd>Tab / Shift+Tab</kbd><span>Cycle through your settlements</span>
      <kbd>Q</kbd><span>Cycle through your armies · <kbd>F</kbd> follow the selected army</span>
    </div>
    <h3>Sandbox &amp; disasters</h3>
    <div class="small" style="line-height:1.6">
      Start a game in <b>Sandbox — god powers</b> mode to get the god-powers bar: pick a power, then click the map.
      Terrain brushes paint while you drag; <b>Start war</b> takes two clicks (attacker, then target); <b>Rule realm</b> lets you take over any realm.
      In every game, natural disasters (plague, earthquakes, droughts, floods, wildfires, blizzards, eruptions) strike on their own — set how often on the new-game screen.
      Seasons, day and night, clouds and weather are cosmetic and can be switched off in Settings.
    </div>
    <h3>Getting started</h3>
    <div class="small" style="line-height:1.6">
      1. Pick a technology (T) — Agriculture or Stoneworking are good starts.<br>
      2. Build Farmsteads and a Lumber Camp in your camp (C). Homes build themselves.<br>
      3. At 60 people your camp becomes a Village; a Town Hall lets it grow into a Town.<br>
      4. Click a neighbouring unclaimed province and <b>Send settlers</b> to expand.<br>
      5. Research Code of Laws and reform into a Monarchy (G) to form a true nation.<br>
      Watch the world: rival civilizations grow, reform, and advance through the eras on their own.
    </div>
    <div class="actions"><button class="btn primary" data-action="menuItem" data-item="resume">Close</button></div>
  </div>`);
}

void hexToRgb; void log;
