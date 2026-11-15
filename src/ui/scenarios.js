// Scenario browser, new-map dialog and "choose your civilization" screen.
import { escapeHtml as E } from '../core/util.js';
import { RACES, RACE_LIST } from '../data/races.js';
import { STAGES } from '../data/buildings.js';
import { ERAS } from '../data/techs.js';
import { WORLD_SIZES, WORLD_TYPES } from '../world/worldgen.js';
import { BUILTIN_SCENARIOS, listMaps, loadMapFromLibrary, deleteMap, exportMap, validateMap } from '../world/mapio.js';

let hooks = {};
const $ = (id) => document.getElementById(id);
const show = (html) => { const m = $('modal'); m.innerHTML = html; m.classList.remove('hidden'); return m; };

export function initScenarios(h) { hooks = h; }

export function scenariosModal() {
  const maps = listMaps();
  const m = show(`<div class="modal-box" style="width:min(720px,94vw)">
    <div class="row between"><div class="title-logo" style="font-size:28px">SCENARIOS & MAPS</div><button class="btn sm" data-sc="back">Back</button></div>
    <h3>Built-in scenarios</h3>
    ${BUILTIN_SCENARIOS.map((s) => `<div class="card scen"><div><b style="font-family:var(--pixel);font-size:15px;color:var(--gold)">${E(s.name)}</b> <span class="tag">${WORLD_TYPES[s.recipe.mapType].label}</span><span class="tag">${WORLD_SIZES[s.recipe.size].label}</span><span class="tag gold">${ERAS[s.recipe.startEra].name}</span><div class="small muted">${E(s.description)}</div></div><button class="btn primary" data-sc="playBuiltin" data-id="${s.id}">Play</button></div>`).join('')}
    <h3>My maps & scenarios</h3>
    ${maps.length ? maps.map((s) => `<div class="card scen"><div><b style="font-family:var(--pixel);font-size:15px">${E(s.name)}</b> <span class="tag">${s.w}×${s.h}</span><span class="tag">${s.starts ? s.starts + ' civilizations' : 'random starts'}</span><span class="tag gold">${ERAS[s.startEra || 0].name}</span>${s.description ? `<div class="small muted">${E(s.description)}</div>` : ''}<div class="small muted">Edited ${new Date(s.modified).toLocaleString()}</div></div><div class="row" style="gap:4px"><button class="btn sm primary" data-sc="playMap" data-id="${s.id}">Play</button><button class="btn sm" data-sc="editMap" data-id="${s.id}">Edit</button><button class="btn sm" data-sc="exportMap" data-id="${s.id}" title="Export file">⇩</button><button class="btn sm" data-sc="deleteMap" data-id="${s.id}" title="Delete">✕</button></div></div>`).join('') : '<div class="small muted">No custom maps yet — create one with the editor.</div>'}
    <div class="actions"><button class="btn primary" data-sc="newMap">New map…</button><button class="btn" data-sc="importMap">Import map file…</button></div>
  </div>`);
  m.onclick = onClick;
}

export function newMapModal() {
  const m = show(`<div class="modal-box narrow" style="width:min(480px,94vw)">
    <div class="row between"><div class="title-logo" style="font-size:26px">NEW MAP</div><button class="btn sm" data-sc="list">Back</button></div>
    <div class="form" style="grid-template-columns:1fr 1fr">
      <label style="grid-column:span 2">Name<input id="nmName" value="My World" maxlength="40"></label>
      <label>Size<select id="nmSize">${Object.entries(WORLD_SIZES).map(([k, v]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${v.label} (${v.w}×${v.h})</option>`).join('')}</select></label>
      <label>Start from<select id="nmBase"><option value="generate">Generated world</option><option value="ocean">Empty ocean</option><option value="land">Empty grassland</option></select></label>
      <label>World type<select id="nmType">${Object.entries(WORLD_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
      <label>Seed<input id="nmSeed" value="${Math.floor(Math.random() * 999999)}"></label>
    </div>
    <div class="actions"><button class="btn primary" data-sc="createMap">Open in editor</button></div>
  </div>`);
  m.onclick = onClick;
}

// Choose a civilization (scenario with placed civs) or race (random starts).
export function playMapModal(source) {
  const isBuiltin = !!source.recipe;
  const map = isBuiltin ? null : source;
  const starts = map?.starts || [];
  const era = isBuiltin ? source.recipe.startEra : map.settings?.startEra || 0;
  let pick = 0;
  let race = 'humans';
  const render = () => {
    const m = show(`<div class="modal-box" style="width:min(640px,94vw)">
      <div class="row between"><div class="title-logo" style="font-size:26px">${E(source.name.toUpperCase())}</div><button class="btn sm" data-sc="list">Back</button></div>
      <div class="small muted" style="margin:6px 0 10px">${E(source.description || '')}</div>
      ${starts.length ? `<h3>Choose your civilization</h3><div class="grid2">${starts.map((s, i) => `<div class="race ${pick === i ? 'on' : ''}" data-sc="pickStart" data-i="${i}" style="padding:8px"><div class="row"><i style="width:14px;height:14px;background:${s.color};display:inline-block;border-radius:2px"></i><h4 style="margin:0">${E(s.name)}</h4></div><div class="small muted">${RACES[s.race].name} · ${STAGES[s.stage || 0].name}</div></div>`).join('')}</div>`
        : `<h3>Choose your people</h3><div class="row" style="flex-wrap:wrap;gap:4px">${RACE_LIST.map((r) => `<button class="btn sm ${race === r ? 'primary' : ''}" data-sc="pickRace" data-r="${r}">${RACES[r].name}</button>`).join('')}</div>
        <div class="form" style="grid-template-columns:1fr 1fr"><label>Name of your people<input id="pmName" maxlength="20" placeholder="Random"></label>${isBuiltin ? '' : `<label>Rival civilizations<select id="pmAi">${[3, 5, 7, 9].map((n) => `<option ${n === 7 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}</div>`}
      <div class="small" style="margin-top:10px">Starting era: <b>${ERAS[era].name}</b></div>
      <div class="actions"><button class="btn primary" data-sc="begin" style="font-size:16px;padding:8px 22px">Begin</button></div>
    </div>`);
    m.onclick = (e) => {
      const el = e.target.closest('[data-sc]');
      if (!el) return;
      if (el.dataset.sc === 'pickStart') { pick = +el.dataset.i; render(); return; }
      if (el.dataset.sc === 'pickRace') { race = el.dataset.r; render(); return; }
      if (el.dataset.sc === 'begin') {
        const civName = $('pmName')?.value.trim() || '';
        if (isBuiltin) hooks.start({ ...source.recipe, race, civName, scenarioName: source.name });
        else hooks.start({ customMap: map, playerStart: pick, startEra: era, race, civName, aiCount: +($('pmAi')?.value || 7), scenarioName: map.name });
        return;
      }
      onClick(e);
    };
  };
  render();
}

async function onClick(e) {
  const el = e.target.closest('[data-sc]');
  if (!el) return;
  const k = el.dataset.sc, id = el.dataset.id;
  if (k === 'back') hooks.back();
  else if (k === 'list') scenariosModal();
  else if (k === 'newMap') newMapModal();
  else if (k === 'playBuiltin') playMapModal(BUILTIN_SCENARIOS.find((s) => s.id === id));
  else if (k === 'playMap') { const m = loadMapFromLibrary(id); if (m) playMapModal(m); }
  else if (k === 'editMap') { const m = loadMapFromLibrary(id); if (m) hooks.editMap(m); }
  else if (k === 'exportMap') { const m = loadMapFromLibrary(id); if (m) exportMap(m); }
  else if (k === 'deleteMap') { if (window.confirm('Delete this map? This cannot be undone.')) { deleteMap(id); scenariosModal(); } }
  else if (k === 'importMap') hooks.importMap();
  else if (k === 'createMap') {
    const seedRaw = $('nmSeed').value.trim();
    const seed = /^\d+$/.test(seedRaw) ? +seedRaw : [...seedRaw].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    hooks.createMap({ name: $('nmName').value.trim() || 'My World', size: $('nmSize').value, base: $('nmBase').value, mapType: $('nmType').value, seed: seed || 1 });
  }
}
export { validateMap };
