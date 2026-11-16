import { remapKey } from './ui/keys.js';
import { initI18n } from './ui/i18n.js';
import { loadArt } from './render/pixelkit.js';
import { preloadSprites, toggleDebug } from './sprites.js';
import { initSkin } from './ui/skin.js';
import { sceneView } from './render/scene.js';
import { openChronicle } from './ui/chronicle.js';
import { startTutorial, updateTutorial } from './ui/tutorial.js';
import { encyclopedia } from './ui/encyclopedia.js';
import { sendExplorer, isExplored } from './sim/fog.js';
import { initQuick, openContextMenu, closeContextMenu, quickKey, searchOpen, closeSearch } from './ui/quick.js';
import { sendColonists } from './sim/colonize.js';
import { applyPixelSkin } from './ui/pixelskin.js';
import { G, S, player, on } from './sim/state.js';
import { newGame } from './sim/setup.js';
import { simDay } from './sim/sim.js';
import { saveGame, loadGame, exportSave, autosave, deleteSave, loadState, readFile, rescueSave } from './sim/save.js';
import { SETTINGS, loadSettings } from './ui/settings.js';
import { Renderer } from './render/renderer.js';
import { TILE } from './render/terrain.js';
import {
  initUI, showGameUI, startScreen, gameMenu, helpModal, hideModal, modalOpen, setLoading, openPanel,
  selectProvince, selectArmy, selectFleet, refreshAll, refreshTopbar, setModeButtons, showTooltip, toast, rebuildLog, SPEEDS, showModal,
  eventModal, drawBattleCanvas, saveManager, settingsModal, summaryModal,
} from './ui/ui.js';

import { orderMove } from './sim/military.js';
import { orderSail } from './sim/naval.js';
import { initScenarios, scenariosModal, playMapModal } from './ui/scenarios.js';
import { openEditor, closeEditor, editorFrame } from './editor/editor.js';
import { generateWorld, blankWorld, fixCoasts, deriveFields } from './world/worldgen.js';
import { worldFromMap, validateMap, saveMapToLibrary } from './world/mapio.js';
import { B } from './data/biomes.js';
import { audio } from './audio/audio.js';
import { warsOf } from './sim/diplomacy.js';
import { initGodMode, renderGodBar, godActive, godClick, selectPower, cursorRadius, god } from './ui/godmode.js';
import { POWER } from './sim/disasters.js';

loadSettings();
initI18n(SETTINGS.lang || 'en');
initSkin(); // Phase 20: wood & parchment interface
loadArt().then((n) => { if (n) console.info(`Art slots: ${n} hand-drawn sprites loaded`); }); // Phase 20
applyPixelSkin();
// Aseprite sprites (assets/sprites/) load before the game starts; a missing one is drawn in code
await Promise.race([
  preloadSprites().then((n) => { if (n) console.info(`Sprites: ${n} Aseprite sprites loaded`); }),
  new Promise((ok) => setTimeout(ok, 5000)), // never hold the game back for long
]);

const canvas = document.getElementById('map');
const minimap = document.getElementById('minimap');
const renderer = new Renderer(canvas, minimap);
window.LW = { G, renderer, simDay, newGame }; // debug handle (start/doLoad added below)
G.atmoLabel = () => renderer.atmo.label();

let speed = 0;
let lastSpeed = 2;
let acc = 0;
let running = false;
let uiTimer = 0;

function setSpeed(i) {
  speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
  G.ui.speed = speed;
  if (speed > 0) lastSpeed = speed;
  refreshTopbar();
}
function togglePause() { setSpeed(speed === 0 ? lastSpeed : 0); }

function setMode(m) {
  renderer.mode = m;
  setModeButtons(m);
}

function focusTile(t, zoom) {
  renderer.centerOn(t, zoom ?? Math.max(renderer.cam.zoom, 1.6));
}

initUI({
  setSpeed, getSpeed: () => speed, setMode, focusTile,
  onSelect: (pid) => { renderer.selected = pid != null && pid >= 0 ? { type: 'province', id: pid } : null; },
  onSelectArmy: (id) => { renderer.selectedArmy = id; },
  onSelectFleet: (id) => { renderer.selectedFleet = id; },
  menu: () => { if (!running) return; setSpeed(0); gameMenu(); },
  menuItem: (item, d) => {
    if (item === 'resume') hideModal();
    else if (item === 'menu') gameMenu();
    else if (item === 'back') startScreen(start, doLoad);
    else if (item === 'saves') saveManager(true);
    else if (item === 'startLoad') saveManager(false);
    else if (item === 'settings') settingsModal();
    else if (item === 'saveAs') {
      const name = (document.getElementById('saveName')?.value || 'Save').trim().slice(0, 32) || 'Save';
      const slot = 'user-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const r = saveGame(slot, name);
      toast(r.ok ? `Saved "${name}".` : 'Save failed: ' + r.error, r.ok ? 'good' : 'bad');
      saveManager(true);
    } else if (item === 'load') { hideModal(); doLoad(d.slot); }
    else if (item === 'delete') { if (window.confirm('Delete this saved game? This cannot be undone.')) { deleteSave(d.slot); saveManager(running); } }
    else if (item === 'export') exportSave();
    else if (item === 'import') fileInput.click();
    else if (item === 'help') helpModal();
    else if (item === 'scenarios') scenariosModal();
    else if (item === 'summary') summaryModal(false);
    else if (item === 'encyclopedia') { G.ui.seen ??= {}; G.ui.seen.encyclopedia = true; encyclopedia(showModal); }
    else if (item === 'new') { hideModal(); running = false; showGameUI(false); updateMood(); startScreen(start, doLoad); }
  },
});

// ---------- Scenarios & map editor ----------
const mapInput = document.createElement('input');
mapInput.type = 'file';
mapInput.accept = '.json,application/json';
mapInput.style.display = 'none';
document.body.appendChild(mapInput);
mapInput.addEventListener('change', async () => {
  const f = mapInput.files[0];
  mapInput.value = '';
  if (!f) return;
  try {
    const map = validateMap(JSON.parse(await readFile(f)));
    map.id = map.id || 'map-' + Date.now().toString(36);
    const r = saveMapToLibrary(map);
    toast(r.ok ? `Imported map "${map.name}".` : r.error, r.ok ? 'good' : 'bad');
  } catch (e) {
    toast('Could not import map: ' + e.message, 'bad');
  }
  scenariosModal();
});

function enterEditor(world, meta) {
  hideModal();
  running = false;
  showGameUI(false);
  document.body.classList.add('editing');
  openEditor(world, meta, renderer, {
    toast,
    play: (map) => { leaveEditor(); playMapModal(map); },
    exit: () => { leaveEditor(); startScreen(start, doLoad); },
  });
}
function leaveEditor() {
  closeEditor();
  document.body.classList.remove('editing');
}

initScenarios({
  back: () => startScreen(start, doLoad),
  start: (opts) => start(opts),
  importMap: () => mapInput.click(),
  editMap: (map) => {
    setLoading(true, 'Unrolling the map…');
    setTimeout(() => { try { enterEditor(worldFromMap(map), map); } catch (e) { toast('Could not open map: ' + e.message, 'bad'); } setLoading(false); }, 30);
  },
  createMap: ({ name, size, base, mapType, seed }) => {
    setLoading(true, 'Preparing a blank canvas…');
    setTimeout(() => {
      const world = base === 'generate' ? generateWorld(seed, size, mapType) : blankWorld(size, seed, base === 'ocean' ? B.OCEAN : B.GRASS);
      if (base === 'land') { fixCoasts(world); deriveFields(world); }
      enterEditor(world, { name });
      setLoading(false);
    }, 30);
  },
});

// Import a save file from disk
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,application/json';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  setLoading(true, 'Reading the chronicle…');
  try {
    loadState(await readFile(f));
    enterGame();
    toast(`Imported ${f.name}.`, 'good');
  } catch (e) {
    setLoading(false);
    toast('Could not import: ' + e.message, 'bad');
  }
});

function enterGame() {
  gameOverShown = false;
  setTimeout(updateMood, 0);
  renderer.setWorld(G.world);
  renderer.resize();
  showGameUI(true);
  hideModal();
  setLoading(false);
  running = true;
  rebuildLog();
  selectProvince(null);
  openPanel(null);
  setMode('political');
  const cap = S().settlements[player().capital];
  if (cap) renderer.centerOn(cap.tile, 2);
  setSpeed(0);
  selectPower('inspect');
  renderGodBar();
  refreshAll(true);
}

function start(opts) {
  setLoading(true, 'Shaping continents, raising mountains…');
  setTimeout(() => {
    const t0 = performance.now();
    newGame(opts);
    if (opts.tutorial) startTutorial(S());
    enterGame();
    console.log(`World generated in ${Math.round(performance.now() - t0)} ms`);
    toast('Paused. Choose a technology (T) and some buildings (C), then press Space.', 'info');
  }, 30);
}

window.LW.start = (o) => start(o);
window.LW.doLoad = (slot) => doLoad(slot);
function doLoad(slot) {
  setLoading(true, 'Recalling the chronicles…');
  setTimeout(() => {
    let st = null;
    try { st = loadGame(slot); } catch (e) { setLoading(false); toast('Could not load: ' + e.message, 'bad'); return; }
    if (!st) { setLoading(false); toast('No saved game found.', 'bad'); return; }
    enterGame();
    toast('Game loaded.', 'good');
  }, 30);
}

on('event', (e) => {
  if (SETTINGS.pauseOnBattle && running && e.civ === player()?.id && /^Battle joined/.test(e.text)) setSpeed(0);
});

// ---------- Audio ----------
// Browsers only allow sound after a user gesture.
const unlockAudio = () => { audio.unlock(); updateMood(); };
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
function updateMood() {
  if (!running || !G.state) { audio.setMood('menu', 0); return; }
  const me = player();
  const night = (renderer.atmo?.darkness || 0) > 0.4;
  audio.setMood(me.alive && warsOf(me.id).length ? 'war' : night ? 'night' : 'peace', me.era, me.race);
}
// Phase 21: the soundscape follows the camera and the hour; the music turns to night themes
setInterval(() => { if (!running || !G.state) return; try { const s = renderer.soundscape(); if (s) audio.ambience(s); updateMood(); } catch { /* ignore */ } }, 600);
on('month', updateMood);
// Phase 15: floating notes on the map for what happens to the player's realm
on('event', (e) => {
  if (!running || !G.state || e.tile == null || e.tile < 0 || e.civ !== player()?.id) return;
  const col = e.type === 'good' ? '#9fe07a' : e.type === 'bad' ? '#ff8a7a' : '#f4ecd8';
  renderer.floatText(e.tile, e.text.replace(/^[^\w🔨⚔]*\s?/u, ''), col);
});
// Sound effects for things that happen to the player's realm
const SFX_RULES = [
  [/^WAR!/, 'war'], [/^Battle joined|Naval battle joined/, 'battle'], [/enters the .* Era/, 'era'],
  [/^Discovered /, 'research'], [/completed in /, 'build'], [/founded .* in |Our settlers founded/, 'settle'],
  [/A child, .* is born/, 'birth'], [/trade agreement/, 'coin'], [/the fleet of/, 'ship'],
];
on('event', (e) => {
  if (!running || !G.state) return;
  const me = player();
  if (e.civ !== me.id) return;
  if (/^Battle of /.test(e.text) || /falls to/.test(e.text)) { audio.play(e.type === 'good' ? 'victory' : 'defeat'); return; }
  for (const [re, name] of SFX_RULES) if (re.test(e.text)) { audio.play(name); if (name === 'war') updateMood(); return; }
  if (e.toast) audio.play('toast');
});
document.addEventListener('click', (e) => { if (e.target.closest('.btn, #nav button, .speed button, #mapModes button, .iconbtn')) audio.play('click'); });

// Disasters & god powers: visual effects and sounds
const FX_SOUND = { quake: 'quake', meteor: 'meteor', lightning: 'lightning', fire: 'fire', eruption: 'eruption', plague: 'plague', bless: 'bless', curse: 'curse', flood: 'flood', drought: 'wind', blizzard: 'wind', war: 'war' };
on('fx', (e) => {
  if (!running) return;
  renderer.onFx(e);
  const name = FX_SOUND[e.fx];
  if (name && renderer.tileVisible(e.tile, 40)) audio.play(name);
});
import('./ui/advisor.js').then((A) => { A.initAdvisor((p) => openPanel(p)); setInterval(() => A.updateAdvisor(running && !document.body.classList.contains('editing')), 500); }); // Phase 21: the advisor
initGodMode({ toast, refresh: () => refreshAll(true), sound: () => {} });

initQuick({
  toast, selectProvince, selectArmy, openPanel, focusTile: (t) => focusTile(t),
  colonize: (pid) => { const r = sendColonists(player(), pid); toast(r.ok ? 'Settlers set out.' : r.reason, r.ok ? 'good' : 'bad'); refreshAll(true); },
  toastResult: (r, ok) => { toast(r.ok ? ok : r.reason, r.ok ? 'good' : 'bad'); refreshAll(true); },
});

let gameOverShown = false;
on('month', () => {
  const st = S();
  const every = SETTINGS.autosaveYears;
  if (every && st.day > 0 && st.day % (360 * every) === 0) {
    const r = autosave();
    if (!r.ok) toast('Autosave failed: ' + r.error, 'bad');
  }
  const me = player();
  if (!me.alive && !gameOverShown && !S().sandbox) {
    gameOverShown = true;
    setSpeed(0);
    showModal(`<div class="modal-box narrow" style="text-align:center">
      <div class="title-logo" style="font-size:30px">YOUR REALM HAS FALLEN</div>
      <p class="muted">${me.displayName} is no more. The world, however, goes on.</p>
      <div class="menu-list">
        <button class="btn primary" data-action="menuItem" data-item="resume">Observe the world</button>
        <button class="btn" data-action="menuItem" data-item="summary">See the final score</button>
        <button class="btn" data-action="menuItem" data-item="new">New world</button>
      </div></div>`);
  }
});

// ---------- Main loop ----------
let last = performance.now();
// A failure in one part of a frame must never stop the loop (that froze the game on one frame).
const errSeen = new Set();
function guard(where, fn) {
  try { fn(); } catch (e) {
    const key = where + ':' + (e && e.message);
    if (!errSeen.has(key)) {
      errSeen.add(key);
      console.error(`[${where}]`, e);
      window.LW.errors.push({ where, message: String(e && e.message), stack: String(e && e.stack).slice(0, 1500), day: G.state?.day });
      if (errSeen.size === 1 && G.state && running) { try { rescueSave(); } catch { /* ignore */ } }
      try { toast(`Internal error in ${where}: ${e && e.message}`, 'bad'); } catch { /* ignore */ }
    }
    return e;
  }
  return null;
}
window.LW.errors = [];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (running) {
    if (speed > 0 && !modalOpen()) {
      acc += dt * SPEEDS[speed];
      let steps = 0;
      while (acc >= 1 && steps < 90) {
        acc -= 1; steps++;
        if (guard('simulation', simDay)) { acc = 0; break; }
      }
      if (steps >= 90) acc = 0;
    }
    guard('input', () => handleKeysPan(dt));
    if (G.ui.follow != null) { const fa = S().armies.find((x) => x.id === G.ui.follow); if (fa) renderer.centerOn(fa.tile); else G.ui.follow = null; }
    guard('map rendering', () => renderer.draw(dt, Math.min(1, acc), speed > 0 && !modalOpen()));
    if (sceneView.open) guard('scene', () => sceneView.draw(dt)); // Phase 22: side-view scenes
    uiTimer += dt;
    if (uiTimer > 0.35) {
      uiTimer = 0;
      guard('interface', () => refreshAll());
      guard('tutorial', () => updateTutorial());
      guard('events', () => {
        const pe = S().pendingEvents.find((p) => p.civ === player().id);
        if (pe && !modalOpen()) { eventModal(pe); audio.play('event'); }
      });
    }
    guard('battle view', () => drawBattleCanvas(now / 1000));
  } else if (G.editorActive) {
    guard('input', () => handleKeysPan(dt));
    guard('editor', () => editorFrame(dt));
  }
}
requestAnimationFrame(frame);

// ---------- Input ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (G.editorActive) return; // the editor handles its own input
  drag = { x: e.clientX, y: e.clientY, cx: renderer.cam.x, cy: renderer.cam.y, moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  // terrain brushes paint while dragging instead of panning
  if (running && e.button === 0 && godActive() && POWER[god.power].biome != null) {
    const r = canvas.getBoundingClientRect();
    drag.paint = true;
    drag.last = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
    godClick(drag.last);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!running) return;
  const r = canvas.getBoundingClientRect();
  if (drag?.paint) {
    const t = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
    renderer.godCursor = t >= 0 ? { tile: t, r: cursorRadius() } : null;
    if (t >= 0 && t !== drag.last) { drag.last = t; godClick(t); }
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add('dragging'); }
    if (drag.moved) {
      renderer.cam.x = drag.cx - dx / renderer.cam.zoom;
      renderer.cam.y = drag.cy - dy / renderer.cam.zoom;
      renderer.clampCam();
    }
    showTooltip(0, 0, null);
    return;
  }
  const t = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
  const pid = t >= 0 ? G.world.province[t] : -1;
  renderer.hover = t >= 0 && !isExplored(t) ? -1 : pid;
  renderer.godCursor = godActive() && t >= 0 ? { tile: t, r: cursorRadius() } : null;
  showTooltip(e.clientX, e.clientY, t >= 0 && !isExplored(t) ? null : pid);
});
canvas.addEventListener('pointerleave', () => { renderer.hover = -1; renderer.godCursor = null; showTooltip(0, 0, null); });
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (drag?.paint) { drag = null; return; }
  if (drag && !drag.moved && running && e.button === 0) {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (godActive()) { godClick(renderer.screenToTile(sx, sy)); drag = null; return; }
    if (G.ui.pickTarget === 'explorer') {
      G.ui.pickTarget = null;
      const r = sendExplorer(player(), renderer.screenToTile(sx, sy));
      toast(r.ok ? 'The expedition sets out.' : r.reason, r.ok ? 'good' : 'bad');
      refreshAll(true); drag = null; return;
    }
    const hit = renderer.armyAt(sx, sy);
    if (hit?.kind === 'army') selectArmy(hit.id);
    else if (hit?.kind === 'fleet') selectFleet(hit.id);
    else {
      const t = renderer.screenToTile(sx, sy);
      const pid = t >= 0 ? G.world.province[t] : -1;
      if (t >= 0 && !isExplored(t)) { toast('Uncharted lands — send an expedition to explore them.', 'info'); selectProvince(null); }
      else selectProvince(pid >= 0 ? pid : null);
    }
  }
  drag = null;
});
// Right-click: march the selected army
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!running) return;
  const r = canvas.getBoundingClientRect();
  const t = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
  if (t < 0) return;
  // nothing selected to command: show the quick-action menu
  if (G.ui.ctxFleet == null && G.ui.ctxArmy == null) { openContextMenu(e.clientX, e.clientY, t); return; }
  if (G.ui.ctxFleet != null) {
    const f = S().fleets.find((x) => x.id === G.ui.ctxFleet);
    if (!f || f.civ !== player().id) return;
    const res = orderSail(f, t);
    if (!res.ok) toast(res.reason, 'bad');
    refreshAll(true);
    return;
  }
  if (G.ui.ctxArmy == null) return;
  const a = S().armies.find((x) => x.id === G.ui.ctxArmy);
  if (!a || a.civ !== player().id) return;
  const res = orderMove(a, t);
  if (!res.ok) toast(res.reason, 'bad');
  else if (res.naval) toast(`${a.name} will sail across the sea.`, 'info');
  refreshAll(true);
});
canvas.addEventListener('wheel', (e) => {
  if (!running && !G.editorActive) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
  renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, f);
}, { passive: false });

// Minimap navigation
function miniJump(e) {
  const r = minimap.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const W = G.world;
  renderer.cam.x = fx * W.w * TILE - renderer.vw / renderer.cam.zoom / 2;
  renderer.cam.y = fy * W.h * TILE - renderer.vh / renderer.cam.zoom / 2;
  renderer.clampCam();
}
let miniDrag = false;
minimap.addEventListener('pointerdown', (e) => { miniDrag = true; minimap.setPointerCapture(e.pointerId); miniJump(e); });
minimap.addEventListener('pointermove', (e) => { if (miniDrag) miniJump(e); });
minimap.addEventListener('pointerup', () => { miniDrag = false; });

const keys = new Set();
const PANEL_KEYS = { v: 'overview', e: 'economy', r: 'diplomacy', m: 'military', g: 'government', k: 'court', o: 'politics', t: 'technology', c: 'construction', p: 'population', u: 'missions', l: 'ledger' };
const MODE_KEYS = { F1: 'political', F2: 'terrain', F3: 'resources', F4: 'population', F5: 'development', F6: 'military', F7: 'trade', F8: 'unrest' };
window.addEventListener('keydown', (e) => {
  if (G.editorActive) {
    // Editor: only camera keys here (tools are handled by the editor itself)
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (k.startsWith('arrow')) e.preventDefault(); keys.add(k); }
    if (k === 'z') renderer.zoomAt(renderer.vw / 2, renderer.vh / 2, 1.25);
    if (k === 'x') renderer.zoomAt(renderer.vw / 2, renderer.vh / 2, 1 / 1.25);
    return;
  }
  if (!running) return;
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); const r = saveGame('quick'); toast(r.ok ? 'Game saved.' : 'Save failed', r.ok ? 'good' : 'bad'); return; }
  if (e.ctrlKey || e.metaKey) return;
  // F2: sprite debug (boxes, anchors, click hitboxes); Shift+F2 is the terrain map mode
  if (e.key === 'F2' && !e.shiftKey) { e.preventDefault(); toast(toggleDebug() ? 'Sprite debug on (F2)' : 'Sprite debug off', 'info'); return; }
  if (MODE_KEYS[e.key]) { e.preventDefault(); setMode(MODE_KEYS[e.key]); return; }
  if (searchOpen()) return;
  if (e.key === 'Escape' && sceneView.open) { sceneView.hide(); return; }
  if (e.key === 'Escape') {
    closeContextMenu();
    if (modalOpen()) hideModal();
    else if (godActive()) selectPower('inspect');
    else if (G.ui.panel) openPanel(null);
    else if (G.ui.ctx != null || G.ui.ctxArmy != null || G.ui.ctxFleet != null) selectProvince(null);
    else { setSpeed(0); gameMenu(); }
    return;
  }
  if (modalOpen()) return;
  const k = remapKey(e.key.toLowerCase());
  if (k == null) return;
  if (quickKey(k, e)) return;
  if (k === 'i') { G.ui.seen ??= {}; G.ui.seen.encyclopedia = true; encyclopedia(showModal); return; }
  if (k === 'j') { openChronicle(showModal); return; }
  if (k === ' ') { e.preventDefault(); togglePause(); return; }
  if (k >= '1' && k <= '5') { setSpeed(+k); return; }
  if (k === '+' || k === '=') { setSpeed(Math.max(1, speed + 1)); return; }
  if (k === '-' || k === '_') { setSpeed(speed - 1); return; }
  if (k === 'h') { const cap = S().settlements[player().capital]; if (cap) focusTile(cap.tile); return; }
  if (k === 'z') { renderer.zoomAt(renderer.vw / 2, renderer.vh / 2, 1.25); return; }
  if (k === 'x') { renderer.zoomAt(renderer.vw / 2, renderer.vh / 2, 1 / 1.25); return; }
  if (PANEL_KEYS[k]) { openPanel(G.ui.panel === PANEL_KEYS[k] ? null : PANEL_KEYS[k]); return; }
  if (k.startsWith('arrow')) e.preventDefault();
  keys.add(k);
});
window.addEventListener('keyup', (e) => { const k = remapKey(e.key.toLowerCase()); keys.delete(e.key.toLowerCase()); if (k) keys.delete(k); });
window.addEventListener('blur', () => keys.clear());

let mouse = null;
window.addEventListener('mousemove', (e) => { mouse = { x: e.clientX, y: e.clientY, onMap: e.target === canvas }; });
window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) mouse = null; });

function handleKeysPan(dt) {
  const sp = (600 * dt) / renderer.cam.zoom;
  if (SETTINGS.edgePan && mouse && mouse.onMap && !modalOpen()) {
    const m = 14;
    if (mouse.x < m) renderer.cam.x -= sp;
    if (mouse.x > window.innerWidth - m) renderer.cam.x += sp;
    if (mouse.y < m) renderer.cam.y -= sp;
    if (mouse.y > window.innerHeight - m) renderer.cam.y += sp;
    renderer.clampCam();
  }
  if (!keys.size) return;
  if (keys.has('w') || keys.has('arrowup')) renderer.cam.y -= sp;
  if (keys.has('s') || keys.has('arrowdown')) renderer.cam.y += sp;
  if (keys.has('a') || keys.has('arrowleft')) renderer.cam.x -= sp;
  if (keys.has('d') || keys.has('arrowright')) renderer.cam.x += sp;
  renderer.clampCam();
}

window.addEventListener('resize', () => { if (running || G.editorActive) renderer.resize(); });

startScreen(start, doLoad);
