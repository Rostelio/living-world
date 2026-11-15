import { fogSync } from './fog.js';
import { ensurePhase12 } from './phase12.js';
import { ensurePhase11 } from './characters.js';
import { ensurePhase10 } from './politics.js';
import { G, makeRng } from './state.js';
import { generateWorld } from '../world/worldgen.js';
import { worldFromMap } from '../world/mapio.js';
import * as AI from './ai.js';
import { ensurePhase3, ensurePhase4, ensurePhase8, ensurePhase9 } from './setup.js';
import { applyTerraform } from './disasters.js';

const KEY = 'livingworld.save.';
export const SAVE_VERSION = 15;
const AUTOSAVE_SLOTS = 3;

// Only dynamic state is saved; the world is regenerated deterministically from its seed.
export function serialize() {
  const st = G.state;
  fogSync();
  st.rngState = G.rng.s;
  st.version = SAVE_VERSION;
  return JSON.stringify(st, (k, v) => (k.startsWith('_') ? undefined : v));
}

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function saveGame(slot = 'quick', label = null) {
  const json = serialize();
  const st = G.state;
  const p = st.civs[st.playerId];
  const meta = { slot, label: label || slot, day: st.day, name: p.displayName, race: p.race, savedAt: Date.now(), size: json.length, check: checksum(json), version: SAVE_VERSION, seed: st.seed, worldSize: st.size };
  try {
    localStorage.setItem(KEY + slot, json);
    // Phase 17: read back to make sure the save is whole before trusting it
    const back = localStorage.getItem(KEY + slot);
    if (!back || back.length !== json.length) return { ok: false, error: 'The save could not be written completely.' };
    localStorage.setItem(KEY + slot + '.meta', JSON.stringify(meta));
    return { ok: true, meta };
  } catch (e) {
    return { ok: false, error: /quota/i.test(String(e)) ? 'Browser storage is full — delete old saves or export to a file.' : String(e) };
  }
}
// quick fingerprint of a save (length + characters sampled across it)
function checksum(s) {
  let h = s.length >>> 0;
  const step = Math.max(1, Math.floor(s.length / 4096));
  for (let i = 0; i < s.length; i += step) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

// Phase 17: autosaves go round-robin into the oldest of three slots — nothing is copied, and the
// newest good autosave is never overwritten, so a crash mid-save can't lose your last game.
export function autosave() {
  let slot = 1, oldest = Infinity;
  for (let i = 1; i <= AUTOSAVE_SLOTS; i++) {
    const m = safe(() => JSON.parse(localStorage.getItem(KEY + `autosave-${i}.meta`) || 'null'), null);
    const t = m?.savedAt ?? -1;
    if (t < oldest) { oldest = t; slot = i; }
  }
  return saveGame(`autosave-${slot}`, `Autosave · Year ${Math.floor(G.state.day / 360) + 1}`);
}
// an emergency save after an internal error, so a broken session can be recovered
export function rescueSave() { return saveGame('rescue', 'Rescue save (after an error)'); }

export function deleteSave(slot) {
  safe(() => { localStorage.removeItem(KEY + slot); localStorage.removeItem(KEY + slot + '.meta'); });
}

export function listSaves() {
  const out = [];
  safe(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(KEY) && k.endsWith('.meta')) out.push(JSON.parse(localStorage.getItem(k)));
    }
  });
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function storageUsed() {
  return safe(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(KEY)) n += (localStorage.getItem(k) || '').length; }
    return n;
  }, 0);
}

export function loadState(json) {
  const st = typeof json === 'string' ? JSON.parse(json) : json;
  if (!st || typeof st.seed !== 'number' || !Array.isArray(st.civs)) throw new Error('Not a Living World save file');
  if ((st.version || 1) > SAVE_VERSION) throw new Error('This save comes from a newer version of the game');
  G.world = st.customMap ? worldFromMap(st.customMap) : generateWorld(st.seed, st.size, st.mapType || 'continents');
  G.state = st;
  ensurePhase3(st);
  makeRng(1);
  G.rng.s = st.rngState;
  ensurePhase4(st);
  ensurePhase8(st);
  ensurePhase9(st);
  ensurePhase10(st);
  ensurePhase11(st);
  ensurePhase12(st);
  applyTerraform(G.world, st);
  G.rng.s = st.rngState;
  G.ai = AI;
  G.dirty.owners = true;
  G.dirty.roads = true;
  return st;
}

export function loadGame(slot = 'quick') {
  const json = safe(() => localStorage.getItem(KEY + slot), null);
  if (!json) return null;
  const meta = safe(() => JSON.parse(localStorage.getItem(KEY + slot + '.meta') || 'null'), null);
  if (meta?.size && (json.length !== meta.size || (meta.check != null && checksum(json) !== meta.check))) throw new Error('This save is damaged (it was not written completely). Try an older autosave.');
  return loadState(json);
}

export function exportSave() {
  const blob = new Blob([serialize()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const p = G.state.civs[G.state.playerId];
  a.download = `livingworld-${p.baseName.toLowerCase()}-y${Math.floor(G.state.day / 360) + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}
