// Phase 18 — the pixel grid for towns: clean yard ground under buildings, square path tiles
// that join up with their neighbours (dirt, cobble, paving), plank and stone bridges, wall
// pieces with towers and gates (stone or orc palisade), small yard props, and the race homes
// (elven treehouses, dwarven hill doors, orc hide tents, lizardfolk stilt huts), fenced crop plots.
// Every sprite is 16×16 px drawn into one 8-world-px tile, so all art sits on the tile grid.
import { makeCanvas } from './sprites.js';
import { ramp } from './tiles16.js';
import { hash2 } from '../core/rng.js';
import { selectiveOutline, slot } from './pixelkit.js';

const cache = new Map();
const css = (c) => (typeof c === 'string' ? c : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
function sprite(key, w, h, draw) {
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const P = (px, py, pw, ph, col) => { if (pw <= 0 || ph <= 0) return; x.fillStyle = css(col); x.fillRect(px, py, pw, ph); };
  draw(P, x);
  c = slot(key, c, 'town'); // Phase 20: a hand-drawn PNG may replace it
  cache.set(key, c);
  return c;
}
function outline(c, col = [28, 18, 24]) {
  if (c._art) return c; // hand-drawn art keeps its own lines
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const d = x.getImageData(0, 0, w, h);
  if (col) { selectiveOutline(d, w, h); x.putImageData(d, 0, 0); return c; } // Phase 20: coloured outlines
  const a = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : d.data[(py * w + px) * 4 + 3]);
  const out = [];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (a(px, py) < 90 && (a(px + 1, py) > 200 || a(px - 1, py) > 200 || a(px, py + 1) > 200 || a(px, py - 1) > 200)) out.push((py * w + px) * 4);
  for (const o of out) { d.data[o] = col[0]; d.data[o + 1] = col[1]; d.data[o + 2] = col[2]; d.data[o + 3] = 230; }
  x.putImageData(d, 0, 0);
  return c;
}

// ---------------- Ground ----------------
// Trodden yard: covers the trees and rocks baked into the terrain under a building
export function yard16(v, snow) {
  return sprite(`yard:${v}:${snow}`, 16, 16, (P) => {
    const g = snow ? ramp('#e6eef2') : ramp(['#78b04a', '#6ea844', '#82b850'][v % 3]);
    P(0, 0, 16, 16, g.mid);
    for (let i = 0; i < 26; i++) { const h = hash2(i, v, 31); P((h * 16) | 0, (hash2(v, i, 32) * 16) | 0, 1, 1, i % 3 ? g.lt : g.dk); }
    if (!snow) for (let i = 0; i < 6; i++) P(((hash2(i, v, 33) * 13) | 0) + 1, ((hash2(v, i, 34) * 13) | 0) + 1, 2, 1, '#a08a5a'); // worn patches
  });
}

// ---------------- Paths ----------------
// mask bits: 1 north, 2 east, 4 south, 8 west. style: 0 dirt, 1 cobble, 2 paved
const PATH = [
  { fill: '#c2a070', edge: '#8a6c44', dot: '#a88a5a', hi: '#d8bc8a' },
  { fill: '#a8a08e', edge: '#6a6458', dot: '#8a8476', hi: '#c8c0ae' },
  { fill: '#9a968e', edge: '#5a5852', dot: '#86827a', hi: '#bcb8ae' },
];
export function path16(mask, style, half = 2) {
  return sprite(`path:${mask}:${style}:${half}`, 16, 16, (P) => {
    const C = PATH[style];
    const a = 8 - half, b = 8 + half; // a narrow track down the middle of the tile (roads 4 px, streets 6 px)
    const rects = [[a, a, b - a, b - a]];
    if (mask & 1) rects.push([a, 0, b - a, a]);
    if (mask & 2) rects.push([b, a, 16 - b, b - a]);
    if (mask & 4) rects.push([a, b, b - a, 16 - b]);
    if (mask & 8) rects.push([0, a, a, b - a]);
    for (const [x, y, w, h] of rects) P(x - 1, y - 1, w + 2, h + 2, C.edge); // border
    for (const [x, y, w, h] of rects) P(x, y, w, h, C.fill);
    // open the borders where arms join the centre
    if (mask & 1) P(a, a - 1, b - a, 1, C.fill);
    if (mask & 2) P(b, a, 1, b - a, C.fill);
    if (mask & 4) P(a, b, b - a, 1, C.fill);
    if (mask & 8) P(a - 1, a, 1, b - a, C.fill);
    // texture: pebbles, cobbles or paving joints
    for (const [x, y, w, h] of rects) {
      if (style === 0) { for (let i = 0; i < (w * h) / 10; i++) P(x + ((hash2(i, x + y, 41) * w) | 0), y + ((hash2(y + i, x, 42) * h) | 0), 1, 1, i % 2 ? C.dot : C.hi); }
      else if (style === 1) { for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy >> 1) & 1); xx < x + w; xx += 3) P(xx, yy, 2, 1, C.hi), P(xx, yy + 1, 2, 1, C.dot); }
      else { for (let yy = y; yy < y + h; yy += 3) P(x, yy, w, 1, C.dot); }
    }
  });
}
// a bridge tile over water or a river; horiz = the road runs east–west
export function bridge16(horiz, style) {
  return sprite(`bridge:${horiz}:${style}`, 16, 16, (P) => {
    const deck = style ? ramp('#a8a094') : ramp('#9a6a3a'), rail = style ? '#6a645a' : '#5a3a1e';
    if (horiz) {
      P(0, 6, 16, 5, deck.mid); P(0, 6, 16, 1, deck.lt); P(0, 10, 16, 1, deck.dk2);
      for (let x = 1; x < 16; x += style ? 4 : 3) P(x, 7, 1, 3, deck.dk);
      P(0, 5, 16, 1, rail); P(0, 11, 16, 1, rail); for (let x = 1; x < 16; x += 5) { P(x, 4, 1, 1, rail); P(x, 12, 1, 1, rail); }
      if (style) { P(3, 12, 2, 2, '#6a645a'); P(11, 12, 2, 2, '#6a645a'); }
    } else {
      P(6, 0, 4, 16, deck.mid); P(6, 0, 1, 16, deck.lt); P(9, 0, 1, 16, deck.dk2);
      for (let y = 1; y < 16; y += style ? 4 : 3) P(7, y, 2, 1, deck.dk);
      P(5, 0, 1, 16, rail); P(10, 0, 1, 16, rail);
    }
  });
}
export function plaza16(kind) {
  return sprite(`plaza:${kind}`, 16, 16, (P) => {
    P(0, 0, 16, 16, '#b0a694'); for (let y = 0; y < 16; y += 4) P(0, y, 16, 1, '#968c7c'); for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) P(x, y, 1, 4, '#968c7c');
    if (kind === 'well') { P(5, 6, 6, 6, '#7a7266'); P(6, 7, 4, 4, '#2a5a8a'); P(6, 7, 4, 1, '#5aa8e0'); P(4, 3, 1, 4, '#6a4a2a'); P(11, 3, 1, 4, '#6a4a2a'); P(4, 2, 8, 1, '#8a5a32'); }
    else if (kind === 'fountain') { P(3, 5, 10, 8, '#8a8478'); P(4, 6, 8, 6, '#3a7ab8'); P(4, 6, 8, 1, '#7ac0f0'); P(7, 3, 2, 6, '#a8a294'); P(7, 2, 2, 1, '#d8f0ff'); P(6, 4, 1, 1, '#d8f0ff'); P(9, 4, 1, 1, '#d8f0ff'); }
  });
}

// ---------------- Walls ----------------
// One wall piece along a tile edge (16 px long); hz = runs east–west. palisade = orc stakes.
// Walls run along tile edges as a slim line (3 px stone, 2 px stakes) with small towers and gates
export function wall16(hz, palisade, broken = false) {
  return sprite(`wall:${hz}:${palisade}:${broken}`, 16, 16, (P, x) => {
    const st = palisade ? ramp('#7a5232') : ramp('#9a9286');
    if (hz) {
      if (palisade) { for (let x = 0; x < 16; x += 2) { if (broken && x > 4 && x < 12) continue; P(x, 5, 1, 4, x % 4 ? st.mid : st.lt); P(x + 1, 6, 1, 3, st.dk); P(x, 4, 1, 1, st.lt); } }
      else { P(0, 6, 16, 3, st.mid); P(0, 6, 16, 1, st.lt); P(0, 8, 16, 1, st.dk); for (let x = 0; x < 16; x += 3) P(x, 5, 1, 1, st.lt); }
    } else {
      if (palisade) { for (let y = 0; y < 16; y += 2) { if (broken && y > 4 && y < 12) continue; P(7, y, 2, 1, y % 4 ? st.mid : st.lt); P(7, y + 1, 2, 1, st.dk); } }
      else { P(7, 0, 3, 16, st.mid); P(7, 0, 1, 16, st.lt); P(9, 0, 1, 16, st.dk); for (let y = 1; y < 16; y += 4) P(8, y, 1, 1, st.dk); }
    }
    if (broken && !palisade) { x.clearRect(hz ? 5 : 6, hz ? 4 : 5, hz ? 6 : 5, hz ? 6 : 6); P(hz ? 4 : 6, hz ? 8 : 4, 1, 1, st.dk); P(hz ? 10 : 9, hz ? 8 : 11, 1, 1, st.mid); }
  });
}
export function tower16(palisade) {
  return sprite(`tower:${palisade}`, 16, 16, (P) => {
    const st = palisade ? ramp('#6a4628') : ramp('#a8a094');
    if (palisade) { P(5, 4, 6, 9, st.mid); P(5, 4, 1, 9, st.lt); P(4, 3, 8, 2, st.dk); for (let x = 4; x < 12; x += 2) P(x, 2, 1, 1, st.lt); P(7, 7, 2, 2, '#1a0e08'); }
    else { P(5, 4, 6, 9, st.mid); P(5, 4, 1, 9, st.lt); P(10, 4, 1, 9, st.dk); P(4, 3, 8, 2, st.lt); for (let x = 4; x < 12; x += 2) P(x, 2, 1, 1, st.lt); P(7, 7, 2, 2, '#2a2420'); P(5, 11, 6, 1, st.dk); }
  });
}
export function gate16(hz, palisade) {
  return sprite(`gate:${hz}:${palisade}`, 16, 16, (P) => {
    const st = palisade ? ramp('#6a4628') : ramp('#a8a094');
    if (hz) { P(2, 4, 3, 6, st.mid); P(11, 4, 3, 6, st.mid); P(2, 3, 3, 1, st.lt); P(11, 3, 3, 1, st.lt); P(5, 7, 6, 2, palisade ? '#5a3a1e' : '#6a4a2a'); for (let x = 6; x < 11; x += 2) P(x, 7, 1, 2, '#4a2e18'); }
    else { P(6, 2, 4, 3, st.mid); P(6, 11, 4, 3, st.mid); P(6, 2, 4, 1, st.lt); P(6, 11, 4, 1, st.lt); P(7, 5, 2, 6, '#6a4a2a'); for (let y = 6; y < 11; y += 2) P(7, y, 2, 1, '#4a2e18'); }
  });
}
export function prop16(kind) {
  const c = sprite(`prop:${kind}`, 8, 8, (P) => {
    switch (kind) {
      case 'barrel': P(2, 2, 4, 5, '#8a5a2e'); P(2, 3, 4, 1, '#5a3a1e'); P(2, 5, 4, 1, '#5a3a1e'); P(3, 2, 2, 1, '#a87a44'); break;
      case 'crate': P(1, 3, 6, 4, '#a07a44'); P(1, 3, 6, 1, '#c09a5a'); P(1, 3, 1, 4, '#6a4a28'); P(6, 3, 1, 4, '#6a4a28'); P(2, 5, 4, 1, '#6a4a28'); break;
      case 'woodpile': P(0, 4, 7, 3, '#7a5232'); for (let x = 0; x < 7; x += 2) P(x, 4, 1, 1, '#c8a070'), P(x + 1, 6, 1, 1, '#c8a070'); break;
      case 'flowers': P(1, 5, 6, 2, '#4f9a3c'); P(1, 4, 1, 1, '#e84a7a'); P(3, 3, 1, 1, '#f6e08a'); P(5, 4, 1, 1, '#e87aa8'); P(6, 5, 1, 1, '#8ab8f0'); break;
      case 'lamp': P(3, 2, 1, 6, '#3a3a40'); P(2, 1, 3, 2, '#ffd27a'); P(2, 0, 3, 1, '#3a3a40'); break;
      case 'bush': P(1, 3, 6, 4, '#3f8a3a'); P(2, 2, 4, 2, '#5aa84a'); P(2, 3, 1, 1, '#7ac860'); break;
      case 'sack': P(2, 3, 4, 4, '#d8c49a'); P(3, 2, 2, 1, '#a8946a'); break;
      case 'anvil': P(1, 4, 6, 2, '#4a4a52'); P(3, 6, 2, 2, '#3a3a40'); P(1, 4, 6, 1, '#7a7a84'); break;
      case 'rack': P(1, 2, 1, 6, '#5a3a1e'); P(6, 2, 1, 6, '#5a3a1e'); P(1, 3, 6, 1, '#7a5232'); P(2, 4, 4, 2, '#c8b080'); break;
      case 'scarecrow': P(3, 1, 2, 2, '#e8c890'); P(1, 3, 6, 1, '#8a5a2e'); P(3, 3, 2, 3, '#7a4a8a'); P(3, 6, 1, 2, '#5a3a1e'); P(2, 0, 4, 1, '#a07a3a'); break;
      default: P(2, 3, 4, 4, '#888');
    }
  });
  return c;
}
export const PROPS_BY_RACE = {
  humans: ['barrel', 'crate', 'woodpile', 'flowers', 'lamp', 'sack'],
  elves: ['flowers', 'bush', 'flowers', 'lamp'],
  dwarves: ['barrel', 'crate', 'anvil', 'woodpile', 'lamp'],
  orcs: ['rack', 'woodpile', 'sack', 'barrel'],
  lizardfolk: ['sack', 'bush', 'rack'],
  halflings: ['flowers', 'barrel', 'sack', 'bush', 'woodpile'],
};

// ---------------- Race homes ----------------
// Elven treehouse: a great tree with a round house in the canopy (16×24, overhangs the tile above)
export function treehouse16(tier) {
  const key = `tree:${tier}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 24, (P) => {
    const bark = ramp('#7a5a3a'), leaf = ramp(['#3f8a44', '#4a9a4a', '#58a852', '#5fb060'][tier]), wall = ramp('#e8dcb8');
    P(6, 10, 4, 14, bark.mid); P(6, 10, 1, 14, bark.lt); P(9, 10, 1, 14, bark.dk); P(4, 22, 8, 2, bark.dk); // trunk & roots
    for (let y = 0; y < 11; y++) { const half = Math.round(7.5 * Math.sqrt(1 - ((y - 5) / 6) ** 2)); P(8 - half, y, half * 2, 1, y < 3 ? leaf.lt : y < 8 ? leaf.mid : leaf.dk); }
    for (let i = 0; i < 10; i++) P(((hash2(i, tier, 51) * 12) | 0) + 2, ((hash2(tier, i, 52) * 8) | 0) + 1, 1, 1, leaf.hi);
    P(4, 9, 8, 5, wall.mid); P(4, 9, 1, 5, wall.lt); P(11, 9, 1, 5, wall.dk); P(3, 8, 10, 1, leaf.dk); // the house in the boughs
    P(7, 11, 2, 3, '#3a5a2a'); P(5, 10, 1, 1, tier >= 2 ? '#ffd27a' : '#8ab8d8'); P(10, 10, 1, 1, tier >= 2 ? '#ffd27a' : '#8ab8d8');
    P(3, 14, 10, 1, '#8a6a44'); // platform
    for (let y = 15; y < 22; y += 2) P(10, y, 2, 1, '#a8885a'); // ladder rungs
    if (tier >= 3) { P(7, 0, 2, 1, '#fff6c8'); P(2, 4, 1, 1, '#fff6c8'); }
  });
  outline(c);
  return c;
}
// Dwarven hill home: a stone door set into a grassy (or rocky) slope
export function hillhome16(tier, rocky) {
  const key = `hill:${tier}:${rocky}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 16, (P) => {
    const turf = rocky ? ramp('#8a8478') : ramp('#6a9a44'), st = ramp('#8a8478');
    for (let y = 0; y < 12; y++) { const half = Math.round(8 * Math.sqrt(1 - ((11 - y) / 12) ** 2)); P(8 - half, 3 + y, half * 2, 1, y < 2 ? turf.lt : turf.mid); }
    P(4, 4, 3, 1, turf.hi);
    P(5, 8, 6, 7, st.dk); P(5, 8, 6, 1, st.lt); P(6, 9, 4, 6, tier >= 2 ? '#4a4a52' : '#5a3a22'); P(6, 9, 4, 1, '#e0a84a'); P(9, 12, 1, 1, '#e6c068');
    if (tier >= 1) { P(12, 1, 2, 4, '#7a6a5e'); P(12, 1, 2, 1, '#9a8a7e'); }
    if (tier >= 2) { P(2, 10, 2, 2, '#ffd27a'); P(12, 10, 2, 2, '#ffd27a'); }
    if (tier >= 3) { P(4, 7, 8, 1, '#e6c068'); P(7, 6, 2, 1, '#6ac8e8'); }
  });
  outline(c);
  return c;
}
// Orc hide tent with bone poles
export function tent16(tier, color) {
  const key = `tent:${tier}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 16, (P) => {
    const hide = ramp(tier >= 2 ? '#7a5a3a' : '#8a6a44');
    for (let i = 0; i < 11; i++) { const half = Math.round(i * (tier >= 2 ? 0.7 : 0.6)) + 1; P(8 - half, 3 + i, half, 1, hide.lt); P(8, 3 + i, half, 1, hide.dk); }
    P(7, 1, 1, 3, '#ece4cc'); P(9, 1, 1, 3, '#ece4cc'); P(7, 10, 2, 4, '#1a0e08');
    for (let x = 3; x < 13; x += 3) P(x, 8 + ((x * 7) % 3), 1, 1, hide.dk);
    if (tier >= 1) P(4, 7, 8, 1, color);
    if (tier >= 3) { P(13, 0, 1, 8, '#3a2a1a'); P(14, 0, 2, 3, color); }
  });
  outline(c);
  return c;
}
// Lizardfolk hut on stilts (for water and swamp tiles)
export function stilt16(tier) {
  const key = `stilt:${tier}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 16, (P) => {
    const reed = ramp('#9a9a52'), wood = ramp('#7a5232'), stilt = '#4e3820';
    P(3, 10, 1, 6, stilt); P(12, 10, 1, 6, stilt); P(7, 11, 1, 5, stilt);
    P(1, 9, 14, 2, wood.mid); P(1, 9, 14, 1, wood.lt);
    P(3, 5, 10, 4, tier >= 2 ? ramp('#4aa88a').mid : wood.lt); P(7, 6, 2, 3, '#1a1410');
    for (let i = 0; i < 6; i++) { const half = Math.round((i + 1) * 1.2) + 1; P(8 - half, i, half * 2, 1, i % 2 ? reed.mid : reed.lt); }
    if (tier >= 1) P(4, 6, 1, 1, '#ffd27a');
    if (tier >= 3) P(7, 0, 2, 1, '#e6c068');
  });
  outline(c);
  return c;
}
// Boardwalk tile over water (connects stilt huts to the shore)
export function boardwalk16(hz) {
  return sprite(`bw:${hz}`, 16, 16, (P) => {
    const w = ramp('#8a6a3e');
    if (hz) { P(0, 6, 16, 4, w.mid); P(0, 6, 16, 1, w.lt); for (let x = 1; x < 16; x += 3) P(x, 6, 1, 4, w.dk); P(2, 10, 1, 4, '#4e3820'); P(12, 10, 1, 4, '#4e3820'); }
    else { P(6, 0, 4, 16, w.mid); P(6, 0, 1, 16, w.lt); for (let y = 1; y < 16; y += 3) P(6, y, 4, 1, w.dk); }
  });
}
// Rope bridge between two treehouses (a sagging line of planks, 1 px tall per step)
export function ropeBridge(ctx, x0, y0, x1, y1) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1));
  for (let i = 0; i <= n; i++) {
    const u = i / n, sag = Math.sin(u * Math.PI) * 1.5;
    const x = Math.round((x0 + (x1 - x0) * u) * 2) / 2, y = Math.round((y0 + (y1 - y0) * u + sag) * 2) / 2;
    ctx.fillStyle = i % 2 ? '#a8885a' : '#7a5a3a'; ctx.fillRect(x, y, 0.5, 0.5);
  }
}

// ---------------- Crop plots ----------------
// Fence sides for a field tile: mask bits say which sides border something that isn't a field
export function fence16(mask) {
  return sprite(`fence:${mask}`, 16, 16, (P) => {
    const wd = '#8a6a3e', dk = '#5a4026';
    if (mask & 1) { P(0, 0, 16, 1, wd); for (let x = 0; x < 16; x += 5) P(x, 0, 1, 2, dk); }
    if (mask & 4) { P(0, 15, 16, 1, wd); for (let x = 0; x < 16; x += 5) P(x, 14, 1, 2, dk); }
    if (mask & 8) { P(0, 0, 1, 16, wd); for (let y = 0; y < 16; y += 5) P(0, y, 2, 1, dk); }
    if (mask & 2) { P(15, 0, 1, 16, wd); for (let y = 0; y < 16; y += 5) P(14, y, 2, 1, dk); }
  });
}

// A circle drawn with square pixels (half a world px each) — for rings, cursors and markers
export function pixelRing(ctx, cx, cy, r, color, opts = {}) {
  const px = opts.px || 1, gap = opts.dashed ? 2 : 0;
  ctx.fillStyle = color;
  const n = Math.max(12, Math.round((r * Math.PI * 2) / px));
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    if (gap && (i % (gap * 2)) >= gap) continue;
    const a = (i / n) * Math.PI * 2;
    const x = Math.round((cx + Math.cos(a) * r) / px) * px, y = Math.round((cy + Math.sin(a) * r) / px) * px;
    const k = x + ',' + y;
    if (seen.has(k)) continue;
    seen.add(k);
    ctx.fillRect(x - px / 2, y - px / 2, px, px);
  }
}

// ---------------- Phase 19: towns grow upward ----------------
// A narrow town house of 2–3 storeys (16×24): cities stack people instead of spreading out.
const TALL = {
  humans: { wall: '#d8c8a8', roof: '#a8483a', beam: '#6a4428' },
  halflings: { wall: '#e8d8a8', roof: '#5a8a3a', beam: '#7a5232' },
  dwarves: { wall: '#9a9286', roof: '#5a5a6a', beam: '#4a4a52' },
  orcs: { wall: '#8a7258', roof: '#5a3a28', beam: '#3a2818' },
  elves: { wall: '#e8e0c8', roof: '#4a7a8a', beam: '#8a7a5a' },
  lizardfolk: { wall: '#a8a070', roof: '#6a8a4a', beam: '#5a4a2a' },
};
export function townhouse16(race, storeys, v = 0) {
  const key = `th:${race}:${storeys}:${v}`;
  if (cache.has(key)) return cache.get(key);
  const T = TALL[race] || TALL.humans;
  const wall = ramp(T.wall), roof = ramp(v ? ramp(T.roof).lt : T.roof);
  const c = sprite(key, 16, 24, (P) => {
    const top = 24 - 2 - storeys * 6; // each storey 6 px
    P(3, 23, 10, 1, 'rgba(0,0,0,0.25)');
    P(3, top, 10, 23 - top, wall.mid); P(3, top, 1, 23 - top, wall.lt); P(12, top, 1, 23 - top, wall.dk);
    for (let k = 0; k < storeys; k++) {
      const y = top + k * 6;
      P(3, y, 10, 1, T.beam); // floor beam
      const lit = (k + v) % 2 === 0;
      P(5, y + 2, 2, 2, lit ? '#ffd27a' : '#7ab0d0'); P(9, y + 2, 2, 2, lit ? '#7ab0d0' : '#ffd27a');
      P(5, y + 4, 2, 1, wall.dk); P(9, y + 4, 2, 1, wall.dk);
    }
    P(7, 19, 2, 4, '#3a2416'); // door
    // roof: steep gable
    for (let i = 0; i < 6; i++) P(8 - (i + 2), top - 6 + i, (i + 2) * 2, 1, i < 2 ? roof.lt : i < 4 ? roof.mid : roof.dk);
    P(10, top - 6, 2, 3, '#6e5a4a'); // chimney
  });
  outline(c);
  return c;
}

// Great works stand in town as 2×2 landmarks (32×32 px drawn into two tiles)
export function work16(id) {
  const key = `work:${id}`;
  if (cache.has(key)) return cache.get(key);
  const stone = ramp('#c8c0b0'), dark = ramp('#7a7468'), gold = '#e8c050', glass = '#8ac8e8';
  const c = sprite(key, 32, 32, (P) => {
    P(2, 30, 28, 2, 'rgba(0,0,0,0.25)');
    switch (id) {
      case 'cathedral':
        P(6, 14, 20, 16, stone.mid); P(6, 14, 1, 16, stone.lt); P(25, 14, 1, 16, stone.dk);
        for (let i = 0; i < 6; i++) P(16 - (i + 4) - 2, 8 + i, (i + 4) * 2 + 4, 1, dark.mid); // nave roof
        P(13, 2, 6, 14, stone.lt); for (let i = 0; i < 5; i++) P(16 - i, -2 + i * 2 + 2, i * 2 || 1, 2, dark.dk); P(15, 0, 2, 3, gold);
        P(14, 18, 4, 6, glass); P(15, 17, 2, 1, '#c84a7a'); P(14, 25, 4, 5, '#3a2416'); P(8, 19, 3, 5, glass); P(21, 19, 3, 5, glass);
        break;
      case 'university':
        P(4, 16, 24, 14, stone.mid); P(4, 16, 24, 1, stone.lt); for (let x = 6; x < 27; x += 4) P(x, 18, 2, 12, stone.lt);
        P(10, 8, 12, 8, stone.mid); for (let i = 0; i < 4; i++) P(12 + i, 4 - i + 4, 8 - i * 2, 1, '#5a8aa0'); P(15, 2, 2, 4, gold);
        P(14, 24, 4, 6, '#3a2416'); P(3, 15, 26, 1, dark.dk);
        break;
      case 'palace':
        P(2, 14, 28, 16, '#e8dcc0'); P(2, 14, 28, 1, '#fff6e0'); P(2, 29, 28, 1, dark.dk);
        for (const x of [2, 13, 24]) { P(x, 6, 6, 9, '#e8dcc0'); P(x, 4, 6, 3, '#4a6aa8'); P(x + 2, 2, 2, 2, gold); }
        for (let x = 4; x < 29; x += 4) P(x, 18, 2, 3, glass); P(14, 23, 4, 7, '#6a2a2a'); P(15, 10, 2, 2, gold);
        break;
      case 'canal':
        P(0, 12, 32, 10, '#3a7ab0'); P(0, 12, 32, 1, '#7ab8e0'); P(0, 21, 32, 1, '#2a5a8a');
        P(0, 10, 32, 2, stone.mid); P(0, 22, 32, 2, stone.mid); P(13, 8, 6, 18, dark.mid); P(14, 9, 4, 16, '#6a4a2a'); // lock gates
        for (let x = 2; x < 32; x += 6) P(x, 15, 3, 1, '#9ad0f0');
        break;
      case 'harbour_works':
        P(0, 18, 32, 12, '#3a7ab0'); P(0, 18, 32, 1, '#7ab8e0'); P(2, 14, 28, 5, stone.mid); P(2, 14, 28, 1, stone.lt);
        P(22, 2, 2, 13, '#6a4a2a'); P(12, 2, 12, 2, '#6a4a2a'); P(13, 4, 1, 6, '#3a2a1a'); P(11, 10, 4, 3, '#a87a3a'); // crane
        P(4, 10, 6, 4, '#a85a3a'); P(5, 8, 4, 2, '#c87a4a'); // warehouse
        break;
      case 'boulevards':
        P(0, 14, 32, 4, '#c8b896'); P(14, 0, 4, 32, '#c8b896');
        for (const [x, y] of [[4, 4], [24, 4], [4, 22], [24, 22]]) { P(x, y + 4, 2, 4, '#6a4a2a'); P(x - 3, y - 2, 8, 7, '#4a9a4a'); P(x - 2, y - 2, 6, 2, '#6ab85a'); }
        P(12, 12, 8, 8, stone.mid); P(14, 14, 4, 4, '#5aa8e0'); P(15, 13, 2, 2, '#c8e8ff'); // fountain
        break;
      case 'world_fair':
        P(4, 14, 24, 16, '#e8dcc0'); for (let x = 4; x < 28; x += 3) P(x, 16, 2, 14, glass);
        for (let i = 0; i < 10; i++) P(16 - i - 2, 4 + i, (i + 2) * 2, 1, i < 3 ? '#c8e8ff' : glass); // glass dome
        P(15, 0, 2, 5, '#a8a094'); P(17, 0, 5, 3, '#c84a3a'); P(3, 13, 26, 1, dark.dk);
        break;
      default: P(8, 8, 16, 20, stone.mid);
    }
  });
  outline(c);
  return c;
}

// A small field tent for army camps (8×8 px, drawn into half a tile)
export function campTent8(color) {
  const key = `camptent:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 8, 8, (P) => {
    const hide = ramp('#c8b48a');
    for (let i = 0; i < 6; i++) { const half = Math.round(i * 0.6) + 1; P(4 - half, 1 + i, half, 1, hide.lt); P(4, 1 + i, half, 1, hide.dk); }
    P(3, 4, 2, 3, '#2a1a10'); P(1, 4, 6, 1, color); P(4, 0, 1, 1, '#5a3a1e');
  });
  outline(c);
  return c;
}

// Phase 20: a windmill (16×24) with sails turning through 4 frames (a quarter turn repeats)
export function windmill16(frame) {
  const key = `windmill:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 24, (P) => {
    const st = ramp('#d8c8a8'), wood = ramp('#8a5a32');
    // tapered tower
    for (let y = 10; y < 23; y++) { const half = 3 + Math.round((y - 10) * 0.15); P(8 - half, y, half, 1, st.lt); P(8, y, half, 1, st.dk); }
    P(7, 18, 2, 5, '#4a2e1a'); P(6, 13, 1, 2, '#3a5a7a'); P(10, 15, 1, 1, '#3a5a7a');
    // cap
    P(4, 8, 8, 3, wood.mid); P(4, 8, 8, 1, wood.lt); P(5, 7, 6, 1, wood.dk);
    // sails round the hub at (8, 8)
    const a0 = (frame / 4) * (Math.PI / 2);
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let r = 1; r <= 7; r++) {
        const x = Math.round(8 + ca * r), y = Math.round(8 + sa * r);
        P(x, y, 1, 1, '#5a3a1e');
        if (r >= 3) { const xs = Math.round(8 + ca * r - sa * 1.5), ys = Math.round(8 + sa * r + ca * 1.5); P(xs, ys, 1, 1, r % 2 ? '#f0e8d8' : '#d8ccb4'); }
      }
    }
    P(7, 7, 2, 2, '#3a2a1a');
  });
  outline(c);
  return c;
}

// Phase 21: a trade caravan (16×10): a pack mule and a covered cart in the realm's colour
export function caravan16(color, frame) {
  const key = `caravan:${color}:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 16, 10, (P) => {
    const mule = ramp('#8a6a4a'), cloth = ramp(color), wood = ramp('#7a5232');
    const st = frame % 2;
    // mule in front
    P(11, 4, 4, 2, mule.mid); P(11, 4, 4, 1, mule.lt); P(14, 3, 2, 2, mule.dk); P(15, 3, 1, 1, '#1a1010');
    P(11 + st, 6, 1, 2, mule.dk); P(14 - st, 6, 1, 2, mule.dk);
    // cart with a cloth cover
    P(1, 5, 9, 2, wood.mid); P(1, 5, 9, 1, wood.lt);
    P(2, 1, 7, 4, cloth.mid); P(2, 1, 7, 1, cloth.lt); P(2, 4, 7, 1, cloth.dk);
    P(3, 7, 2, 2, '#3a2a1a'); P(7, 7, 2, 2, '#3a2a1a'); P(3 + st, 7, 1, 1, '#8a7a6a'); P(8 - st, 8, 1, 1, '#8a7a6a');
    P(10, 5, 1, 1, '#5a3a1e'); // shaft
  });
  outline(c);
  return c;
}

// Phase 22: creatures of the wild and their lairs
export function lair16() {
  return sprite('lair', 16, 12, (P) => {
    const R = ramp('#7a7068');
    for (let i = 0; i < 10; i++) { const half = Math.round(i * 0.75) + 1; P(8 - half, 2 + i, half * 2, 1, i < 3 ? R.lt : R.mid); }
    P(5, 6, 6, 6, '#120c08'); P(6, 5, 4, 1, '#120c08');
    P(2, 11, 2, 1, '#e8e0d0'); P(12, 10, 2, 1, '#e8e0d0'); P(11, 11, 1, 1, '#e8e0d0'); P(7, 11, 2, 1, '#e6c068');
  });
}
export function creature16(kind, frame) {
  const key = `cr:${kind}:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = sprite(key, 24, 18, (P) => {
    const f = frame % 2;
    if (kind === 'dragon') {
      const R = ramp('#b8382a');
      P(7, 8, 10, 5, R.mid); P(7, 8, 10, 1, R.lt); P(16, 6, 5, 4, R.mid); P(20, 7, 2, 1, '#ffd060'); P(21, 9, 2, 1, '#f0e8d8');
      P(2, 10, 5, 2, R.dk); P(0, 9, 2, 2, R.dk); // tail
      const wy = f ? 1 : 4; P(8, wy, 8, 4 - (f ? 0 : 2), R.dk); P(9, wy - 1, 6, 1, R.lt); // wings
      P(9, 13, 2, 2, R.dk); P(14, 13, 2, 2, R.dk);
    } else if (kind === 'wyvern') {
      const R = ramp('#4a8a5a');
      P(8, 8, 8, 4, R.mid); P(15, 6, 4, 3, R.mid); P(18, 7, 1, 1, '#ffe060'); P(3, 9, 5, 2, R.dk);
      const wy = f ? 2 : 5; P(7, wy, 9, 3, R.dk); P(8, wy - 1, 7, 1, R.lt);
    } else if (kind === 'giant') {
      const R = ramp('#a88a6a');
      P(9, 2, 6, 5, R.mid); P(10, 3, 1, 1, '#1a1010'); P(13, 3, 1, 1, '#1a1010'); P(8, 7, 8, 7, '#6a5a44'); P(8, 7, 8, 1, '#8a7a5a');
      P(9 + f, 14, 2, 4, R.dk); P(13 - f, 14, 2, 4, R.dk); P(16, 6, 2, 9, '#5a3a1e'); P(15, 5, 4, 2, '#7a5a3a'); // club
    } else {
      const R = ramp('#5a7a4a');
      P(8, 5, 8, 9, R.mid); P(8, 5, 8, 1, R.lt); P(9, 3, 6, 3, R.mid); P(10, 4, 1, 1, '#ffd060'); P(13, 4, 1, 1, '#ffd060'); P(11, 6, 2, 1, '#f0e8d8');
      P(9 + f, 14, 2, 4, R.dk); P(13 - f, 14, 2, 4, R.dk); P(6, 7, 2, 6, R.dk); P(16, 7, 2, 6, R.dk);
    }
  });
  outline(c);
  return c;
}
