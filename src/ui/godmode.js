// Sandbox mode: the god-powers toolbar and map targeting.
import { G, S, civOf } from '../sim/state.js';
import { POWERS, POWER, usePower, settlementAtTile } from '../sim/disasters.js';
import { RACE_LIST, RACES } from '../data/races.js';
import { escapeHtml as E } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const GROUPS = ['World', 'Life', 'Wrath', 'Politics', 'Terrain'];
let hooks = { toast: () => {}, refresh: () => {}, sound: () => {} };

export const god = { power: 'inspect', power2: 1, brush: 1, race: 'random', pendingCiv: null, painting: false, open: true };

export function initGodMode(h) { hooks = { ...hooks, ...h }; }

export function godActive() { return !!S()?.sandbox && god.power !== 'inspect'; }
export function godTarget() { return POWER[god.power]?.target; }

export function renderGodBar() {
  const bar = $('godbar');
  if (!bar) return;
  const st = S();
  if (!st?.sandbox) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const P = POWER[god.power];
  const groups = GROUPS.map((g) => `<div class="gb-group"><div class="gb-label">${g}</div><div class="gb-btns">${POWERS.filter((p) => p.group === g).map((p) =>
    `<button class="gb ${p.id === god.power ? 'on' : ''} gb-${p.group.toLowerCase()}" data-power="${p.id}" title="${E(p.name)} — ${E(p.desc)}">${p.icon}</button>`).join('')}</div></div>`).join('');
  let opts = '';
  if (P.biome != null) opts = `<label>Brush <select id="gbBrush">${[0, 1, 2, 3, 5].map((b) => `<option value="${b}" ${b === god.brush ? 'selected' : ''}>${b * 2 + 1}×${b * 2 + 1}</option>`).join('')}</select></label>`;
  else if (['meteor', 'earthquake', 'volcano', 'drought', 'flood', 'wildfire'].includes(P.id)) opts = `<label>Power <select id="gbPow">${[1, 2, 3].map((b) => `<option value="${b}" ${b === god.power2 ? 'selected' : ''}>${['Minor', 'Major', 'Cataclysmic'][b - 1]}</option>`).join('')}</select></label>`;
  else if (P.id === 'spawn') opts = `<label>People <select id="gbRace"><option value="random">Random</option>${RACE_LIST.map((r) => `<option value="${r}" ${r === god.race ? 'selected' : ''}>${RACES[r].name}</option>`).join('')}</select></label>`;
  const hint = P.id === 'inspect' ? 'Pick a power, then click the map. Esc returns to Inspect.'
    : P.id === 'war' && god.pendingCiv != null ? `Now click the realm ${E(civOf(god.pendingCiv).displayName)} attacks.`
      : P.biome != null ? 'Click or drag on land to paint.' : E(P.desc);
  bar.innerHTML = `<div class="gb-head"><span class="gb-title">✦ God powers</span><span class="gb-name">${E(P.name)}</span>${opts}<button class="gb-min" data-gbmin title="Collapse">${god.open ? '▾' : '▸'}</button></div>
    ${god.open ? `<div class="gb-body">${groups}</div>` : ''}<div class="gb-hint">${hint}</div>`;
  bar.querySelectorAll('[data-power]').forEach((b) => b.addEventListener('click', () => selectPower(b.dataset.power)));
  bar.querySelector('[data-gbmin]')?.addEventListener('click', () => { god.open = !god.open; renderGodBar(); });
  $('gbBrush')?.addEventListener('change', (e) => { god.brush = +e.target.value; });
  $('gbPow')?.addEventListener('change', (e) => { god.power2 = +e.target.value; });
  $('gbRace')?.addEventListener('change', (e) => { god.race = e.target.value; });
}

export function selectPower(id) {
  god.power = POWER[id] ? id : 'inspect';
  god.pendingCiv = null;
  document.body.classList.toggle('god-aim', god.power !== 'inspect');
  renderGodBar();
}

// Radius (tiles) of the targeting ring drawn under the cursor.
export function cursorRadius() {
  const p = god.power;
  const k = god.power2;
  if (POWER[p]?.biome != null) return god.brush + 0.5;
  return { meteor: 3 + k * 2, earthquake: 5 + k * 3, volcano: 6 + k * 3, drought: 10 + k * 4, flood: 5 + k * 2, wildfire: 4 + k * 2, lightning: 1.5 }[p] || 2;
}

// Apply the selected power at a tile. Returns true when the click was consumed.
export function godClick(tile) {
  if (!godActive()) return false;
  const P = POWER[god.power];
  const st = S();
  const prov = tile >= 0 ? G.world.province[tile] : -1;
  const owner = prov >= 0 ? st.provinces[prov].owner : -1;
  let r;
  if (P.target === 'two-civs') {
    if (owner < 0) { hooks.toast('Click on a realm', 'bad'); return true; }
    if (god.pendingCiv == null) { god.pendingCiv = owner; renderGodBar(); return true; }
    r = usePower('war', tile, { civs: [god.pendingCiv, owner] });
    god.pendingCiv = null;
  } else if (P.target === 'settlement' && !settlementAtTile(tile)) {
    hooks.toast('Click on a settlement', 'bad'); return true;
  } else {
    r = usePower(god.power, tile, { power: god.power2, brush: god.brush, race: god.race === 'random' ? null : god.race });
  }
  if (!r.ok) hooks.toast(r.reason, 'bad');
  else {
    if (r.msg) hooks.toast(r.msg, 'good');
    if (!r.quiet) hooks.sound(god.power);
    if (god.power === 'possess') selectPower('inspect');
  }
  renderGodBar();
  hooks.refresh();
  return true;
}
