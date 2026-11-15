// Living World — map & scenario editor.
import { G } from '../sim/state.js';
import { B, BIOMES, R, RESOURCES } from '../data/biomes.js';
import { RACES, RACE_LIST } from '../data/races.js';
import { PERSONALITIES, PERSONALITY_LIST } from '../data/governments.js';
import { STAGES } from '../data/buildings.js';
import { ERAS } from '../data/techs.js';
import { escapeHtml as E, clamp } from '../core/util.js';
import { fixCoasts, deriveFields, recomputeRivers, finalizeWorld } from '../world/worldgen.js';
import { mapFromWorld, saveMapToLibrary, exportMap } from '../world/mapio.js';
import { bakeTerrain, bakeMinimapBase, TILE } from '../render/terrain.js';
import { realmName as genRealmName } from '../core/names.js';
import { RNG } from '../core/rng.js';

const PAINTABLE = [B.DEEP, B.OCEAN, B.SHALLOW, B.LAKE, B.BEACH, B.GRASS, B.PLAINS, B.FOREST, B.JUNGLE, B.TAIGA, B.SWAMP, B.DESERT, B.TUNDRA, B.SNOW, B.HILLS, B.MOUNTAIN];
const CIV_COLORS = ['#d94a3d', '#3d7fd9', '#e6b422', '#9b59b6', '#2fbf71', '#e67e22', '#17a2b8', '#e84393', '#8d6e63', '#c0ca33', '#5c6bc0', '#ef5350', '#26a69a', '#ab47bc'];
const $ = (id) => document.getElementById(id);

export const ED = { active: false };
let hooks = {};
let renderer = null;

export function openEditor(world, meta, r, h) {
  renderer = r; hooks = h;
  Object.assign(ED, {
    active: true, world,
    meta: { id: meta.id, name: meta.name || 'Untitled map', description: meta.description || '', starts: (meta.starts || []).map((s) => ({ ...s })), settings: { startEra: 0, aiFill: 0, ...(meta.settings || {}) }, created: meta.created },
    tool: 'terrain', biome: B.GRASS, brush: 3, resource: R.IRON,
    template: { race: 'humans', stage: 0, personality: '' },
    undo: [], redo: [], stroke: null, painting: false, panning: null,
    dirty: null, riversDirty: false, provincesStale: true, showProvinces: false, provCanvas: null,
    hover: -1, selected: -1, rng: new RNG(Date.now() >>> 0), unsaved: false,
  });
  G.editorActive = true;
  renderer.setWorld(world);
  renderer.resize();
  renderer.cam.zoom = renderer.minZoom * 1.15;
  renderer.centerOn((world.h >> 1) * world.w + (world.w >> 1));
  buildPanel();
  attachInput();
}

export function closeEditor() {
  ED.active = false;
  G.editorActive = false;
  detachInput();
  $('editorPanel').classList.add('hidden');
  $('editorHint').classList.add('hidden');
}

// ---------------- Editing primitives ----------------
const W = () => ED.world;
function record(i) {
  const s = ED.stroke;
  if (!s || s.before.has(i)) return;
  const w = W();
  s.before.set(i, [w.biome[i], w.river[i], w.resource[i]]);
}
function markDirty(x, y, r = 0) {
  const d = ED.dirty || (ED.dirty = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 });
  d.x0 = Math.min(d.x0, x - r); d.y0 = Math.min(d.y0, y - r); d.x1 = Math.max(d.x1, x + r + 1); d.y1 = Math.max(d.y1, y + r + 1);
}
function setBiome(i, b) {
  const w = W();
  if (w.biome[i] === b) return;
  record(i);
  w.biome[i] = b;
  if (BIOMES[b].water) {
    w.river[i] = 0;
    if (w.resource[i] && w.resource[i] !== R.FISH) w.resource[i] = 0;
    const before = ED.meta.starts.length;
    ED.meta.starts = ED.meta.starts.filter((s) => s.tile !== i);
    if (ED.meta.starts.length !== before) { ED.selected = -1; renderPanelBody(); }
  } else if (w.resource[i] === R.FISH) w.resource[i] = 0;
}
function applyBrush(tile) {
  const w = W();
  const tx = tile % w.w, ty = (tile / w.w) | 0;
  if (ED.tool === 'terrain') {
    const r = ED.brush - 1;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
      setBiome(y * w.w + x, ED.biome);
    }
    markDirty(tx, ty, r + 1);
  } else if (ED.tool === 'river') {
    if (BIOMES[w.biome[tile]].water) return;
    const v = ED.erase ? 0 : 1;
    if (w.river[tile] !== v) { record(tile); w.river[tile] = v; ED.riversDirty = true; markDirty(tx, ty, 1); }
  } else if (ED.tool === 'resource') {
    const res = ED.resource;
    const water = BIOMES[w.biome[tile]].water;
    if (res && (res === R.FISH) !== water) return;
    if (w.resource[tile] !== res) { record(tile); w.resource[tile] = res; markDirty(tx, ty, 0); }
  }
  ED.provincesStale = true;
  ED.unsaved = true;
}
function lineTiles(a, b) {
  const w = W().w;
  const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
  const out = [];
  for (let k = 0; k <= n; k++) out.push(Math.round(ay + ((by - ay) * k) / n) * w + Math.round(ax + ((bx - ax) * k) / n));
  return out;
}

// Re-derive and re-bake only what changed.
export function flushEdits() {
  const d = ED.dirty;
  if (!d) return;
  ED.dirty = null;
  const w = W();
  const x0 = clamp(d.x0, 0, w.w), y0 = clamp(d.y0, 0, w.h), x1 = clamp(d.x1, 0, w.w), y1 = clamp(d.y1, 0, w.h);
  fixCoasts(w, x0, y0, x1, y1);
  deriveFields(w, x0 - 4, y0 - 4, x1 + 4, y1 + 4);
  if (ED.riversDirty) { recomputeRivers(w); ED.riversDirty = false; }
  bakeTerrain(w, { x0: x0 - 4, y0: y0 - 4, x1: x1 + 4, y1: y1 + 4 }, renderer.terrain);
}
function endStroke() {
  const s = ED.stroke;
  ED.stroke = null;
  ED.painting = false;
  if (s && s.before.size) {
    ED.undo.push(s);
    if (ED.undo.length > 60) ED.undo.shift();
    ED.redo = [];
  }
  flushEdits();
  renderer.miniBase = bakeMinimapBase(W());
  renderer.miniDirty = true;
  if (ED.showProvinces) previewProvinces();
}
function applyRecord(rec, useBefore) {
  const w = W();
  const swap = new Map();
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const [i, v] of (useBefore ? rec.before : rec.after)) {
    swap.set(i, [w.biome[i], w.river[i], w.resource[i]]);
    [w.biome[i], w.river[i], w.resource[i]] = v;
    const x = i % w.w, y = (i / w.w) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  ED.dirty = { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
  ED.riversDirty = true;
  flushEdits();
  renderer.miniBase = bakeMinimapBase(w); renderer.miniDirty = true;
  ED.provincesStale = true;
  if (ED.showProvinces) previewProvinces();
  return swap;
}
function undo() {
  const rec = ED.undo.pop();
  if (!rec) return;
  rec.after = applyRecord(rec, true);
  ED.redo.push(rec);
}
function redo() {
  const rec = ED.redo.pop();
  if (!rec) return;
  rec.before = applyRecord({ after: rec.after }, false);
  ED.undo.push(rec);
}

// ---------------- Provinces preview ----------------
function previewProvinces() {
  const w = W();
  finalizeWorld(w);
  ED.provincesStale = false;
  const c = document.createElement('canvas');
  c.width = w.w; c.height = w.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w.w, w.h);
  for (let i = 0; i < w.N; i++) {
    const p = w.province[i];
    if (p < 0) continue;
    const hsh = Math.imul(p + 1, 2654435761) >>> 0;
    img.data[i * 4] = 60 + (hsh & 127); img.data[i * 4 + 1] = 60 + ((hsh >> 8) & 127); img.data[i * 4 + 2] = 60 + ((hsh >> 16) & 127); img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ED.provCanvas = c;
  setStatus(`${w.provinces.length} provinces on ${w.landmassSizes.filter((s) => s > 20).length} landmasses.`, true);
}

// ---------------- Civilizations ----------------
function startAt(tile, radius = 2) {
  const w = W();
  const tx = tile % w.w, ty = (tile / w.w) | 0;
  return ED.meta.starts.findIndex((s) => Math.abs((s.tile % w.w) - tx) <= radius && Math.abs(((s.tile / w.w) | 0) - ty) <= radius);
}
function placeCiv(tile) {
  const w = W();
  const existing = startAt(tile);
  if (existing >= 0) { ED.selected = existing; renderPanelBody(); return; }
  if (BIOMES[w.biome[tile]].water || w.biome[tile] === B.MOUNTAIN) { setStatus('Civilizations must start on habitable land.'); return; }
  if (ED.meta.starts.length >= 16) { setStatus('At most 16 civilizations.'); return; }
  const t = ED.template;
  const used = new Set(ED.meta.starts.map((s) => s.color));
  const color = CIV_COLORS.find((c) => !used.has(c)) || CIV_COLORS[ED.meta.starts.length % CIV_COLORS.length];
  ED.meta.starts.push({ race: t.race, name: genRealmName(t.race, ED.rng), color, stage: t.stage, personality: t.personality || null, tile });
  ED.selected = ED.meta.starts.length - 1;
  ED.unsaved = true;
  renderPanelBody();
}

// ---------------- Panel UI ----------------
function setStatus(text, sticky = false) {
  if (sticky) ED.statusMsg = text;
  const el = $('edStatus');
  if (el) el.textContent = text;
}

function buildPanel() {
  const p = $('editorPanel');
  p.classList.remove('hidden');
  $('editorHint').classList.remove('hidden');
  renderPanelBody();
}

function swatch(b) {
  const c = BIOMES[b].color;
  return `<button class="ed-sw ${ED.biome === b && ED.tool === 'terrain' ? 'on' : ''}" data-ed="biome" data-v="${b}" title="${BIOMES[b].name}" style="background:rgb(${c.join(',')})"></button>`;
}

export function renderPanelBody() {
  const p = $('editorPanel');
  if (!p || !ED.active) return;
  const m = ED.meta;
  const tools = [['terrain', 'Terrain'], ['river', 'Rivers'], ['resource', 'Resources'], ['civ', 'Civilizations']];
  let h = `<div class="panel-head"><h2>Map Editor</h2><button class="x" data-ed="exit" title="Exit editor">✕</button></div><div class="panel-body">`;
  h += `<label class="ed-l">Name<input id="edName" value="${E(m.name)}" maxlength="40"></label>`;
  h += `<label class="ed-l">Description<textarea id="edDesc" rows="2" maxlength="300">${E(m.description)}</textarea></label>`;
  h += '<div class="row" style="flex-wrap:wrap;gap:4px;margin:8px 0">' + tools.map(([k, l]) => `<button class="btn sm ${ED.tool === k ? 'primary' : ''}" data-ed="tool" data-v="${k}">${l}</button>`).join('') + '</div>';
  if (ED.tool === 'terrain') {
    h += `<div class="ed-pal">${PAINTABLE.map(swatch).join('')}</div><div class="small muted">${BIOMES[ED.biome].name}</div>`;
    h += `<div class="slider-row"><span>Brush</span><input type="range" min="1" max="14" value="${ED.brush}" data-ed-in="brush"><b>${ED.brush}</b></div>`;
    h += '<div class="small muted">Drag to paint. Coastlines and shallows form automatically. <kbd>[</kbd> <kbd>]</kbd> brush size.</div>';
  } else if (ED.tool === 'river') {
    h += `<div class="small muted">Drag across land to draw a river; it flows toward the nearest connected sea. Hold <b>Shift</b> to erase.</div>`;
  } else if (ED.tool === 'resource') {
    h += '<div class="ed-pal">' + [R.IRON, R.GOLD, R.STONE, R.FERTILE, R.FISH, R.GAME, R.HORSES].map((r) => `<button class="ed-sw ${ED.resource === r ? 'on' : ''}" data-ed="res" data-v="${r}" title="${RESOURCES[r].name}" style="background:${RESOURCES[r].color}"></button>`).join('') + `<button class="ed-sw ${ED.resource === 0 ? 'on' : ''}" data-ed="res" data-v="0" title="Clear" style="background:#222;color:#fff;font-size:10px">✕</button></div>`;
    h += `<div class="small muted">${ED.resource ? RESOURCES[ED.resource].name : 'Clear resources'} — click or drag. Fish go in shallow water.</div>`;
  } else {
    const t = ED.template;
    h += '<div class="small muted" style="margin-bottom:4px">Click land to place a civilization; click a banner to select it.</div>';
    h += `<div class="grid2"><label class="ed-l">Race<select data-ed-in="tRace">${RACE_LIST.map((r) => `<option value="${r}" ${t.race === r ? 'selected' : ''}>${RACES[r].name}</option>`).join('')}</select></label>`;
    h += `<label class="ed-l">Size<select data-ed-in="tStage">${STAGES.map((s, i) => `<option value="${i}" ${t.stage === i ? 'selected' : ''}>${s.short}</option>`).join('')}</select></label></div>`;
    if (m.starts.length) {
      h += '<h3>Placed civilizations</h3>';
      m.starts.forEach((s, i) => {
        h += `<div class="ed-civ ${ED.selected === i ? 'on' : ''}" data-ed="selCiv" data-v="${i}"><i style="background:${s.color}"></i><b>${E(s.name)}</b><span class="muted small">${RACES[s.race].name} · ${STAGES[s.stage].short}</span></div>`;
      });
      const s = m.starts[ED.selected];
      if (s) {
        h += `<div class="card" style="margin-top:6px"><label class="ed-l">Name<input data-ed-in="cName" value="${E(s.name)}" maxlength="24"></label>`;
        h += `<div class="grid2"><label class="ed-l">Race<select data-ed-in="cRace">${RACE_LIST.map((r) => `<option value="${r}" ${s.race === r ? 'selected' : ''}>${RACES[r].name}</option>`).join('')}</select></label>`;
        h += `<label class="ed-l">Size<select data-ed-in="cStage">${STAGES.map((x, i) => `<option value="${i}" ${s.stage === i ? 'selected' : ''}>${x.short}</option>`).join('')}</select></label>`;
        h += `<label class="ed-l">AI personality<select data-ed-in="cPers"><option value="">Random</option>${PERSONALITY_LIST.map((k) => `<option value="${k}" ${s.personality === k ? 'selected' : ''}>${PERSONALITIES[k].name}</option>`).join('')}</select></label>`;
        h += `<label class="ed-l">Colour<div class="colors">${CIV_COLORS.map((c) => `<i data-ed="cColor" data-v="${c}" style="background:${c}" class="${s.color === c ? 'on' : ''}"></i>`).join('')}</div></label></div>`;
        h += `<button class="btn sm" style="border-color:#a33;margin-top:6px" data-ed="delCiv" data-v="${ED.selected}">Remove</button></div>`;
      }
    }
  }
  h += '<h3>Scenario</h3><div class="grid2">';
  h += `<label class="ed-l">Starting era<select data-ed-in="era">${ERAS.map((e, i) => `<option value="${i}" ${m.settings.startEra === i ? 'selected' : ''}>${e.name}</option>`).join('')}</select></label>`;
  h += `<label class="ed-l">Extra random rivals<select data-ed-in="fill">${[0, 1, 2, 3, 4, 5, 6, 8].map((n) => `<option ${m.settings.aiFill === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
  h += `<div class="small muted">${m.starts.length ? `${m.starts.length} placed civilization${m.starts.length > 1 ? 's' : ''} — the player chooses one when starting.` : 'No civilizations placed: they will be placed at random when you play.'}</div>`;
  h += '<h3>Map</h3><div class="row" style="flex-wrap:wrap;gap:4px">';
  h += `<button class="btn sm" data-ed="undo" ${ED.undo.length ? '' : 'disabled'}>↶ Undo</button><button class="btn sm" data-ed="redo" ${ED.redo.length ? '' : 'disabled'}>↷ Redo</button>`;
  h += `<button class="btn sm ${ED.showProvinces ? 'primary' : ''}" data-ed="prov">Provinces</button>`;
  h += '</div><div class="row" style="flex-wrap:wrap;gap:4px;margin-top:6px">';
  h += '<button class="btn sm primary" data-ed="save">Save to library</button><button class="btn sm" data-ed="export">Export file</button><button class="btn sm primary" data-ed="play">▶ Play</button>';
  h += `</div><div id="edStatus" class="small muted" style="margin-top:8px">${E(ED.statusMsg || `${W().w}×${W().h} tiles`)}</div></div>`;
  p.innerHTML = h;
}

function currentMap() {
  const m = ED.meta;
  m.name = ($('edName')?.value || m.name).trim() || 'Untitled map';
  m.description = ($('edDesc')?.value || '').trim();
  flushEdits();
  const map = mapFromWorld(W(), m);
  m.id = map.id;
  return map;
}

function onPanelClick(e) {
  const el = e.target.closest('[data-ed]');
  if (!el || !ED.active) return;
  const k = el.dataset.ed, v = el.dataset.v;
  if (k === 'tool') ED.tool = v;
  else if (k === 'biome') { ED.biome = +v; ED.tool = 'terrain'; }
  else if (k === 'res') ED.resource = +v;
  else if (k === 'selCiv') ED.selected = +v;
  else if (k === 'delCiv') { ED.meta.starts.splice(+v, 1); ED.selected = -1; ED.unsaved = true; }
  else if (k === 'cColor') { const s = ED.meta.starts[ED.selected]; if (s) s.color = v; }
  else if (k === 'undo') undo();
  else if (k === 'redo') redo();
  else if (k === 'prov') { ED.showProvinces = !ED.showProvinces; if (ED.showProvinces) previewProvinces(); }
  else if (k === 'save') { const map = currentMap(); const r = saveMapToLibrary(map); ED.unsaved = !r.ok; hooks.toast(r.ok ? `Saved "${map.name}" to your library.` : r.error, r.ok ? 'good' : 'bad'); }
  else if (k === 'export') exportMap(currentMap());
  else if (k === 'play') { const map = currentMap(); saveMapToLibrary(map); ED.unsaved = false; hooks.play(map); return; }
  else if (k === 'exit') { if (ED.unsaved && !window.confirm('Leave the editor? Unsaved changes will be lost.')) return; hooks.exit(); return; }
  renderPanelBody();
}
function onPanelInput(e) {
  const el = e.target;
  const k = el.dataset?.edIn;
  if (!k) return;
  const s = ED.meta.starts[ED.selected];
  if (k === 'brush') { ED.brush = +el.value; el.nextElementSibling.textContent = el.value; return; }
  if (k === 'tRace') ED.template.race = el.value;
  else if (k === 'tStage') ED.template.stage = +el.value;
  else if (k === 'cName' && s) { s.name = el.value; return; }
  else if (k === 'cRace' && s) s.race = el.value;
  else if (k === 'cStage' && s) s.stage = +el.value;
  else if (k === 'cPers' && s) s.personality = el.value || null;
  else if (k === 'era') ED.meta.settings.startEra = +el.value;
  else if (k === 'fill') ED.meta.settings.aiFill = +el.value;
  ED.unsaved = true;
  if (e.type === 'change') renderPanelBody();
}

// ---------------- Input ----------------
let listeners = [];
function on(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
function detachInput() { for (const [t, ty, fn, o] of listeners) t.removeEventListener(ty, fn, o); listeners = []; }

function tileAt(e) {
  const r = renderer.canvas.getBoundingClientRect();
  return renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
}
function attachInput() {
  const cv = renderer.canvas;
  on($('editorPanel'), 'click', onPanelClick);
  on($('editorPanel'), 'input', onPanelInput);
  on($('editorPanel'), 'change', onPanelInput);
  on(cv, 'contextmenu', (e) => e.preventDefault());
  on(cv, 'pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    if (e.button === 2 || e.button === 1 || ED.space) { ED.panning = { x: e.clientX, y: e.clientY, cx: renderer.cam.x, cy: renderer.cam.y }; return; }
    const t = tileAt(e);
    if (t < 0) return;
    if (ED.tool === 'civ') { placeCiv(t); return; }
    ED.erase = e.shiftKey;
    ED.stroke = { before: new Map() };
    ED.painting = true;
    ED.last = t;
    applyBrush(t);
  });
  on(cv, 'pointermove', (e) => {
    if (ED.panning) {
      renderer.cam.x = ED.panning.cx - (e.clientX - ED.panning.x) / renderer.cam.zoom;
      renderer.cam.y = ED.panning.cy - (e.clientY - ED.panning.y) / renderer.cam.zoom;
      renderer.clampCam();
      return;
    }
    const t = tileAt(e);
    ED.hover = t;
    if (t >= 0) {
      const w = W();
      setStatus(`(${t % w.w}, ${(t / w.w) | 0}) ${BIOMES[w.biome[t]].name}${w.river[t] ? ' · river' : ''}${w.resource[t] ? ' · ' + RESOURCES[w.resource[t]].name : ''}`);
    }
    if (ED.painting && t >= 0 && t !== ED.last) {
      for (const k of lineTiles(ED.last, t)) applyBrush(k);
      ED.last = t;
    }
  });
  const up = () => { if (ED.panning) { ED.panning = null; return; } if (ED.painting) endStroke(); };
  on(cv, 'pointerup', up);
  on(cv, 'pointercancel', up);
  on(window, 'keydown', (e) => {
    if (!ED.active || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { ED.space = true; e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); renderPanelBody(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); renderPanelBody(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onPanelClick({ target: { closest: () => ({ dataset: { ed: 'save' } }) } }); }
    if (e.key === '[') { ED.brush = Math.max(1, ED.brush - 1); renderPanelBody(); }
    if (e.key === ']') { ED.brush = Math.min(14, ED.brush + 1); renderPanelBody(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && ED.tool === 'civ' && ED.selected >= 0) { ED.meta.starts.splice(ED.selected, 1); ED.selected = -1; renderPanelBody(); }
  });
  on(window, 'keyup', (e) => { if (e.key === ' ') ED.space = false; });
}

// Called every frame by the main loop while editing.
export function editorFrame(dt) {
  if (!ED.active) return;
  if (ED.painting) flushEdits();
  renderer.drawEditor(ED, dt);
}
export const brushRadius = () => (ED.tool === 'terrain' ? ED.brush - 1 : 0);
export { TILE };
