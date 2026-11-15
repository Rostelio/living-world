// Custom map & scenario files: compact run-length encoded tile layers.
import { worldFromArrays, WORLD_SIZES } from './worldgen.js';

export const MAP_FORMAT = 'living-world-map';
export const MAP_VERSION = 1;
const KEY = 'livingworld.map.';

// ---- RLE + base64 for Uint8Array layers ----
export function encodeLayer(arr) {
  const out = [];
  for (let i = 0; i < arr.length;) {
    const v = arr[i];
    let n = 1;
    while (i + n < arr.length && arr[i + n] === v) n++;
    out.push(v);
    let c = n; // LEB128 varint
    do { let b = c & 127; c >>>= 7; if (c) b |= 128; out.push(b); } while (c);
    i += n;
  }
  let s = '';
  const bytes = Uint8Array.from(out);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function decodeLayer(b64, length) {
  const bin = atob(b64);
  const arr = new Uint8Array(length);
  let p = 0, o = 0;
  while (p < bin.length && o < length) {
    const v = bin.charCodeAt(p++);
    let n = 0, shift = 0, b;
    do { b = bin.charCodeAt(p++); n |= (b & 127) << shift; shift += 7; } while (b & 128);
    arr.fill(v, o, Math.min(length, o + n));
    o += n;
  }
  return arr;
}

// ---- Map <-> world ----
export function mapFromWorld(world, meta = {}) {
  return {
    format: MAP_FORMAT, version: MAP_VERSION,
    id: meta.id || 'map-' + Date.now().toString(36),
    name: meta.name || 'Untitled map',
    description: meta.description || '',
    w: world.w, h: world.h, sizeKey: world.sizeKey, seed: world.seed,
    biome: encodeLayer(world.biome), river: encodeLayer(world.river), resource: encodeLayer(world.resource),
    starts: meta.starts || [],
    settings: { startEra: 0, aiFill: 0, ...(meta.settings || {}) },
    created: meta.created || Date.now(), modified: Date.now(),
  };
}

export function validateMap(map) {
  if (!map || map.format !== MAP_FORMAT) throw new Error('Not a Living World map file');
  if ((map.version || 1) > MAP_VERSION) throw new Error('This map comes from a newer version of the game');
  if (!(map.w > 16 && map.h > 16 && map.w * map.h <= 400 * 260)) throw new Error('Map size is invalid');
  return map;
}

export function worldFromMap(map) {
  validateMap(map);
  const N = map.w * map.h;
  return worldFromArrays({
    w: map.w, h: map.h, seed: map.seed >>> 0, sizeKey: map.sizeKey,
    biome: decodeLayer(map.biome, N), river: decodeLayer(map.river, N), resource: decodeLayer(map.resource, N),
  });
}

// ---- Library (browser storage) ----
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
export function saveMapToLibrary(map) {
  try {
    localStorage.setItem(KEY + map.id, JSON.stringify(map));
    localStorage.setItem(KEY + map.id + '.meta', JSON.stringify({ id: map.id, name: map.name, description: map.description, w: map.w, h: map.h, starts: map.starts.length, startEra: map.settings?.startEra || 0, modified: map.modified }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: /quota/i.test(String(e)) ? 'Browser storage is full' : String(e) };
  }
}
export function listMaps() {
  const out = [];
  safe(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(KEY) && k.endsWith('.meta')) out.push(JSON.parse(localStorage.getItem(k)));
    }
  });
  return out.sort((a, b) => b.modified - a.modified);
}
export function loadMapFromLibrary(id) {
  const json = safe(() => localStorage.getItem(KEY + id), null);
  return json ? validateMap(JSON.parse(json)) : null;
}
export function deleteMap(id) { safe(() => { localStorage.removeItem(KEY + id); localStorage.removeItem(KEY + id + '.meta'); }); }

export function exportMap(map) {
  const blob = new Blob([JSON.stringify(map)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'map'}.lwmap.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function sizeKeyFor(w, h) {
  for (const [k, v] of Object.entries(WORLD_SIZES)) if (v.w === w && v.h === h) return k;
  return 'custom';
}

// ---- Built-in scenarios (recipes: generated on demand) ----
export const BUILTIN_SCENARIOS = [
  { id: 'builtin-dawn', name: 'Dawn of Peoples', description: 'A gentle start: a small continental world with five rivals in the Ancient era. Good for learning.', recipe: { size: 'small', mapType: 'continents', seed: 4111, aiCount: 5, startEra: 0 } },
  { id: 'builtin-sail', name: 'Age of Sail', description: 'A Medieval archipelago of island realms. Harbours and fleets decide who rules the waves.', recipe: { size: 'medium', mapType: 'archipelago', seed: 7302, aiCount: 7, startEra: 1 } },
  { id: 'builtin-empires', name: 'Clash of Empires', description: 'A Renaissance supercontinent crowded with nine ambitious rivals. Expect war from the start.', recipe: { size: 'large', mapType: 'pangaea', seed: 9157, aiCount: 9, startEra: 2 } },
  { id: 'builtin-peaks', name: 'Kingdoms of the Peaks', description: 'Rugged highlands in the Ancient era — perfect country for dwarves, deadly for invaders.', recipe: { size: 'medium', mapType: 'highlands', seed: 2468, aiCount: 7, startEra: 0 } },
];
