import { selectiveOutline, slot } from './pixelkit.js';
import { fromSheet, tintKey } from '../sprites.js';
// Phase 13 — buildings at 16×16 (houses, most specials) and 32×32 (halls, castles,
// universities), hand-built from a small pixel-art kit: shaded walls, tiled roofs,
// doors, lit windows, outlines and soft drop shadows. Every race has its own style.
import { RACES } from '../data/races.js';
import { makeCanvas } from './sprites.js';
import { ramp } from './tiles16.js';

const cache = new Map();
const css = (c) => (typeof c === 'string' ? c : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);

class Kit {
  constructor(w, h) { this.w = w; this.h = h; this.c = makeCanvas(w, h); this.x = this.c.getContext('2d'); }
  r(x, y, w, h, c) { if (w <= 0 || h <= 0) return; this.x.fillStyle = css(c); this.x.fillRect(x, y, w, h); return this; }
  p(x, y, c) { return this.r(x, y, 1, 1, c); }
  shadow(cx, cy, rx, ry = 2) { this.x.fillStyle = 'rgba(20,14,30,0.3)'; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5)))); this.x.fillRect(cx - w, cy + y, w * 2, 1); } return this; }
  // walls with light from the upper left
  wall(x, y, w, h, R, opts = {}) {
    this.r(x, y, w, h, R.mid);
    this.r(x, y, 1, h, R.lt);
    this.r(x + w - 2, y, 2, h, R.dk);
    if (opts.timber) { const b = opts.timber; this.r(x, y, w, 1, b); this.r(x, y + h - 1, w, 1, b); for (let i = x; i < x + w; i += 4) this.r(i, y, 1, h, b); this.r(x, y + (h >> 1), w, 1, b); }
    if (opts.stone) for (let yy = y + 1; yy < y + h; yy += 2) for (let xx = x + ((yy >> 1) % 2 ? 0 : 2); xx < x + w - 1; xx += 4) this.p(xx, yy, R.dk);
    if (opts.planks) for (let xx = x + 1; xx < x + w; xx += 2) this.r(xx, y, 1, h, R.dk);
    return this;
  }
  gable(x, y, w, h, R) { // triangular roof with tile rows; apex at the top centre
    for (let i = 0; i < h; i++) {
      const half = Math.round(((i + 1) / h) * (w / 2));
      const cx = x + w / 2;
      this.r(Math.round(cx - half), y + i, half, 1, i % 2 ? R.mid : R.lt);
      this.r(Math.round(cx), y + i, half, 1, i % 2 ? R.dk : R.mid);
    }
    this.r(x - 1, y + h - 1, w + 2, 1, R.dk2);
    return this;
  }
  sideRoof(x, y, w, h, R) { // roof seen from the front: rows of tiles getting darker toward the eaves
    for (let i = 0; i < h; i++) this.r(x + (h - 1 - i > 0 ? 0 : -1), y + i, w + (h - 1 - i > 0 ? 0 : 2), 1, i === 0 ? R.hi : i === h - 1 ? R.dk2 : i % 2 ? R.mid : R.lt);
    for (let xx = x + 1; xx < x + w; xx += 3) this.r(xx, y + 1, 1, h - 2, R.dk);
    return this;
  }
  dome(cx, y, rx, ry, R) {
    for (let yy = 0; yy < ry; yy++) { const half = Math.round(rx * Math.sqrt(1 - ((ry - yy) / ry) ** 2)); this.r(cx - half, y + yy, half, 1, yy < 2 ? R.hi : R.lt); this.r(cx, y + yy, half, 1, R.mid); this.r(cx + half - 1, y + yy, 1, 1, R.dk); }
    return this;
  }
  cone(cx, y, h, R) { for (let i = 0; i < h; i++) { const half = Math.max(1, Math.round((i + 1) * 0.55)); this.r(cx - half, y + i, half, 1, R.lt); this.r(cx, y + i, half, 1, R.dk); } return this; }
  door(x, y, w = 2, h = 3, col = '#4a2e1a', arch = false) { this.r(x, y, w, h, col); this.r(x, y, 1, h, '#6a4628'); if (arch) this.r(x, y, w, 1, '#2a1a10'); this.p(x + w - 1, y + (h >> 1), '#e6c068'); return this; }
  win(x, y, lit = false, w = 2, h = 2) { this.r(x - 1, y - 1, w + 2, h + 2, '#3a2a1e'); this.r(x, y, w, h, lit ? '#ffd27a' : '#8ab8d8'); if (!lit) this.p(x, y, '#cfe6f4'); if (w > 1 && h > 1) this.r(x + (w >> 1), y, 1, h, '#3a2a1e'); return this; }
  chimney(x, y, h = 3) { this.r(x, y, 2, h, '#7a6a5e'); this.r(x, y, 2, 1, '#9a8a7e'); this.p(x + 1, y + 1, '#5a4a40'); return this; }
  banner(x, y, color, h = 4) { this.r(x, y, 1, h + 3, '#3a2a1a'); this.r(x + 1, y, 3, h, color); this.r(x + 1, y + h - 1, 1, 1, ramp(color).dk); this.p(x + 3, y + h, color); return this; }
  outline() {
    const { w, h, x } = this;
    const d = x.getImageData(0, 0, w, h);
    const a = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : d.data[(py * w + px) * 4 + 3]);
    const out = [];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (a(px, py) < 90 && (a(px + 1, py) > 200 || a(px - 1, py) > 200 || a(px, py + 1) > 200 || a(px, py - 1) > 200)) out.push((py * w + px) * 4);
    void out;
    selectiveOutline(d, w, h); // Phase 20: coloured outlines
    x.putImageData(d, 0, 0);
    return this.c;
  }
}

// ---------------- Houses (16×16) ----------------
// v: 0 the race's usual roof, 1 weathered darker, 2 slate or moss (Phase 20: streets of
// matching-but-not-identical houses)
const ROOF_ALT = { 1: [[90, 50, 40], 0.35], 2: [[96, 108, 122], 0.4] };
const mixc = (a, b, t) => { const h = (c) => (typeof c === 'string' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c); const A = h(a), B = h(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
export function house16(race, tier, v = 0) {
  const key = v ? `h:${race}:${tier}:${v}` : `h:${race}:${tier}`;
  if (cache.has(key)) return cache.get(key);
  const R = RACES[race] || RACES.humans;
  const roof = ramp(ROOF_ALT[v] ? mixc(R.roof, ROOF_ALT[v][0], ROOF_ALT[v][1]) : R.roof), wall = ramp(v === 1 ? mixc(R.wall, [200, 180, 150], 0.25) : R.wall), wood = ramp('#7a5232');
  const k = new Kit(16, 16);
  k.shadow(8, 14, 7, 2);
  const lit = tier >= 2;
  switch (race) {
    case 'humans':
      if (tier === 0) { const hide = ramp('#c9b28a'); for (let i = 0; i < 11; i++) { const half = Math.round(i * 0.55) + 1; k.r(8 - half, 3 + i, half, 1, hide.lt); k.r(8, 3 + i, half, 1, hide.dk); } k.r(7, 2, 1, 3, '#6e4626'); k.door(7, 10, 2, 4, '#3a2416'); break; }
      if (tier === 1) { k.wall(3, 8, 10, 6, wall, { timber: '#6a4428' }); k.gable(2, 2, 12, 6, roof); k.door(7, 10, 2, 4); k.win(4, 10, lit); k.win(11, 10, lit, 1, 2); break; }
      if (tier === 2) { k.wall(2, 7, 12, 7, wall, { timber: '#6a4428' }); k.gable(1, 1, 14, 6, roof); k.chimney(11, 1); k.door(7, 10, 2, 4); k.win(4, 9, true); k.win(11, 9, true); k.r(4, 13, 3, 1, '#5aa83a'); k.p(5, 12, '#e84a7a'); break; }
      { const st = ramp('#b8b0a2'); k.wall(2, 6, 12, 8, st, { stone: true }); k.sideRoof(1, 2, 14, 4, ramp('#5a6070')); k.chimney(3, 0, 3); k.door(7, 10, 2, 4, '#4a2e1a', true); k.win(4, 7, true); k.win(11, 7, true); k.win(4, 11, true, 1, 2); k.win(12, 11, true, 1, 2); k.r(3, 9, 3, 1, '#7a5232'); k.p(4, 8, '#e84a7a'); }
      break;
    case 'elves': {
      const leaf = ramp('#4fa856'), bark = ramp('#8a6a44');
      if (tier === 0) { k.r(5, 9, 6, 5, wall.mid); k.dome(8, 3, 6, 7, leaf); k.door(7, 10, 2, 4, '#3a5a2a'); break; }
      if (tier === 1) { k.wall(4, 8, 8, 6, ramp('#d8cfa8'), { planks: true }); k.dome(8, 2, 7, 7, roof); k.door(7, 10, 2, 4); k.win(5, 10, lit, 1, 1); k.p(8, 1, '#f6f1d8'); break; }
      if (tier === 2) { k.r(7, 6, 3, 9, bark.mid); k.r(7, 6, 1, 9, bark.lt); k.r(3, 9, 10, 1, wood.mid); k.wall(4, 5, 8, 4, ramp('#e8e0c4')); k.dome(8, 0, 7, 6, leaf); k.win(6, 6, true, 1, 1); k.win(10, 6, true, 1, 1); for (let i = 10; i < 15; i += 2) k.r(10, i, 2, 1, wood.dk); break; }
      { const stone = ramp('#eef0e8'); k.wall(5, 5, 6, 9, stone); k.cone(8, 0, 6, roof); k.win(7, 7, true, 2, 2); k.door(7, 11, 2, 3, '#4a6a3a', true); k.r(4, 13, 8, 1, leaf.mid); k.p(4, 12, '#f6e08a'); k.p(11, 12, '#e87aa8'); k.p(10, 2, '#fff6c8'); }
      break;
    }
    case 'dwarves': {
      const st = ramp('#8a8478');
      if (tier === 0) { k.r(2, 9, 12, 5, st.mid); k.r(2, 9, 12, 1, st.lt); k.r(6, 10, 4, 4, '#1a1410'); k.r(6, 10, 4, 1, '#e0a84a'); break; }
      if (tier === 1) { k.wall(2, 6, 12, 8, st, { stone: true }); k.r(1, 5, 14, 2, st.lt); for (let i = 1; i < 15; i += 3) k.r(i, 4, 2, 1, st.lt); k.r(6, 9, 4, 5, '#2a1e16'); k.r(6, 9, 4, 1, '#e0a84a'); k.p(8, 11, '#6ac8e8'); break; }
      if (tier === 2) { k.wall(1, 5, 14, 9, st, { stone: true }); k.r(0, 4, 16, 2, st.lt); k.chimney(12, 0, 4); k.r(6, 8, 4, 6, '#4a4a52'); k.r(6, 8, 4, 1, '#e0a84a'); k.r(7, 10, 2, 1, '#2a2a30'); k.win(3, 7, true, 1, 2); k.win(12, 7, true, 1, 2); break; }
      k.wall(0, 4, 16, 10, st, { stone: true }); for (let i = 0; i < 16; i += 3) k.r(i, 2, 2, 2, st.lt); k.r(5, 7, 6, 7, '#4a4a52'); k.r(5, 7, 6, 1, '#e6c068'); k.r(7, 9, 2, 1, '#e6c068'); k.win(2, 7, true, 1, 2); k.win(13, 7, true, 1, 2); k.p(8, 5, '#6ac8e8');
      break;
    }
    case 'orcs': {
      const hide = ramp('#8a6a44'), bone = '#ece4cc';
      if (tier <= 1) { for (let i = 0; i < 11; i++) { const half = Math.round(i * 0.6) + 1; k.r(8 - half, 3 + i, half, 1, hide.lt); k.r(8, 3 + i, half, 1, hide.dk); } k.r(7, 1, 1, 3, bone); k.r(9, 1, 1, 3, bone); k.door(7, 10, 2, 4, '#2a1a10'); if (tier === 1) { k.p(3, 13, bone); k.p(12, 13, bone); k.r(4, 8, 8, 1, '#c0392b'); } break; }
      k.wall(1, 7, 14, 7, wood, { planks: true }); k.sideRoof(0, 3, 16, 4, hide); for (let i = 1; i < 16; i += 3) k.r(i, 1, 1, 3, bone); k.door(7, 10, 2, 4, '#1a0e08'); k.win(3, 9, lit, 2, 1); k.win(11, 9, lit, 2, 1);
      if (tier === 3) { k.banner(13, 0, '#c0392b', 3); k.r(2, 13, 12, 1, '#5a3a22'); }
      break;
    }
    case 'lizardfolk': {
      const reed = ramp('#9a9a52'), stilt = '#5e4528';
      if (tier === 0) { for (let i = 0; i < 9; i++) { const half = Math.round(Math.sqrt(i) * 2.6) + 1; k.r(8 - half, 5 + i, half * 2, 1, i % 2 ? reed.mid : reed.lt); } k.r(7, 10, 2, 4, '#1a1410'); break; }
      if (tier <= 2) { k.r(3, 11, 1, 4, stilt); k.r(12, 11, 1, 4, stilt); k.r(2, 10, 12, 1, wood.mid); k.wall(3, 6, 10, 4, wall, { planks: true }); k.gable(1, 0, 14, 7, reed); k.door(7, 7, 2, 3); if (tier === 2) { k.win(4, 7, true, 1, 1); k.r(7, 11, 2, 1, wood.lt); k.r(7, 13, 2, 1, wood.lt); } break; }
      { const jade = ramp('#4aa88a'); k.r(2, 10, 12, 4, jade.dk); k.r(3, 7, 10, 3, jade.mid); k.r(5, 4, 6, 3, jade.lt); k.r(6, 2, 4, 2, '#e6c068'); k.r(7, 11, 2, 3, '#1a1410'); k.r(2, 10, 12, 1, jade.lt); }
      break;
    }
    case 'halflings': {
      const turf = ramp(tier >= 2 ? '#5fae45' : '#4f9a3c');
      for (let i = 0; i < 10; i++) { const half = Math.round(7 * Math.sqrt(1 - ((9 - i) / 10) ** 2)) + 1; k.r(8 - half, 4 + i, half, 1, turf.lt); k.r(8, 4 + i, half, 1, turf.mid); }
      k.r(5, 4, 4, 1, turf.hi);
      const doorC = ['#a0783a', '#e8b84a', '#3a7ac8', '#c0392b'][tier];
      for (let i = 0; i < 5; i++) { const half = Math.round(2.5 * Math.sqrt(1 - ((4 - i) / 5) ** 2)) + 1; k.r(8 - half, 9 + i, half * 2, 1, doorC); }
      k.p(9, 11, '#5a3a1a');
      if (tier >= 1) k.win(12, 9, lit, 1, 1);
      if (tier >= 2) { k.chimney(11, 2, 3); k.win(3, 9, true, 1, 1); }
      if (tier >= 3) { k.r(1, 13, 3, 1, '#7a5232'); k.p(1, 12, '#e87aa8'); k.p(3, 12, '#f6e08a'); k.p(13, 12, '#e84a4a'); }
      break;
    }
    default: k.wall(3, 7, 10, 7, wall); k.gable(2, 2, 12, 5, roof); k.door(7, 10, 2, 4);
  }
  const c = fromSheet('house_' + race, 'tier' + tier, v, slot(key, k.outline(), 'house')); // Aseprite sprite if there is one
  cache.set(key, c);
  return c;
}

// ---------------- Special buildings ----------------
export const BIG16 = { town_hall: 1, university: 1, castle: 1, star_fort: 1 };
export function special16(kind, race, civColor) {
  const key = `s:${kind}:${race}:${civColor}`;
  if (cache.has(key)) return cache.get(key);
  const R = RACES[race] || RACES.humans;
  const roof = ramp(R.roof), wall = ramp(R.wall), wood = ramp('#7a5232'), stone = ramp('#a39c90'), brick = ramp('#a0503a');
  const big = !!BIG16[kind];
  const k = new Kit(big ? 32 : 16, big ? 32 : 16);
  if (big) k.shadow(16, 29, 14, 3); else k.shadow(8, 14, 7, 2);
  switch (kind) {
    case 'town_hall':
      k.wall(4, 14, 24, 14, wall, { timber: race === 'humans' ? '#6a4428' : null, stone: race === 'dwarves' });
      k.gable(2, 3, 28, 12, roof); k.wall(12, 8, 8, 6, wall); k.gable(11, 1, 10, 7, roof);
      k.r(15, 0, 2, 2, '#e6c068');
      k.door(14, 21, 4, 7, '#4a2e1a', true); k.win(7, 18, true); k.win(23, 18, true); k.win(7, 23, true); k.win(23, 23, true); k.win(15, 10, true, 2, 2);
      k.banner(4, 6, civColor, 5); k.banner(26, 6, civColor, 5);
      k.r(10, 28, 12, 1, stone.lt);
      break;
    case 'castle': {
      const s2 = ramp('#9a948a');
      k.wall(3, 14, 26, 14, s2, { stone: true });
      for (let i = 3; i < 29; i += 3) k.r(i, 12, 2, 2, s2.lt);
      for (const tx of [1, 23]) { k.wall(tx, 7, 8, 21, s2, { stone: true }); k.cone(tx + 4, 1, 7, roof); k.win(tx + 3, 12, true, 1, 2); }
      k.wall(11, 4, 10, 12, s2, { stone: true }); for (let i = 11; i < 21; i += 3) k.r(i, 2, 2, 2, s2.lt);
      k.r(13, 20, 6, 8, '#2a1a12'); k.r(13, 20, 6, 1, '#5a4636'); for (let i = 14; i < 19; i += 2) k.r(i, 21, 1, 7, '#4a4a52');
      k.banner(15, 0, civColor, 4); k.win(14, 8, true, 1, 2); k.win(17, 8, true, 1, 2);
      break;
    }
    case 'star_fort': {
      const s2 = ramp('#a8a090');
      const pts = [[16, 3], [28, 12], [24, 27], [8, 27], [4, 12]];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        let inside = false;
        for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xi, yi] = pts[a], [xj, yj] = pts[b]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
        if (inside) k.p(x, y, (x + y) % 7 === 0 ? s2.dk : y < 14 ? s2.lt : s2.mid);
      }
      k.wall(12, 11, 8, 9, ramp('#8a8478'), { stone: true }); k.r(11, 9, 10, 2, s2.lt); k.banner(15, 3, civColor, 4);
      for (const [cx, cy] of [[7, 13], [24, 13], [10, 25], [21, 25]]) k.r(cx, cy, 3, 1, '#3a3a40');
      break;
    }
    case 'university':
      k.wall(3, 13, 26, 15, ramp('#e2d8c0'), { stone: true });
      k.r(2, 11, 28, 2, stone.lt); for (let i = 5; i < 28; i += 4) k.r(i, 13, 2, 14, '#f2ece0');
      k.dome(16, 2, 7, 9, ramp('#4a7aa8')); k.r(15, 0, 2, 2, '#e6c068');
      k.door(14, 22, 4, 6, '#4a2e1a', true); k.win(8, 17, true); k.win(22, 17, true);
      k.banner(28, 4, civColor, 4);
      break;
    case 'temple':
      k.wall(3, 7, 10, 7, ramp('#e8e0cc'), { stone: true }); k.gable(2, 3, 12, 5, roof);
      k.wall(6, 2, 4, 6, ramp('#e8e0cc')); k.cone(8, 0, 3, roof); k.r(7, 0, 2, 1, '#e6c068');
      k.r(7, 9, 2, 5, '#4a2e1a'); k.r(4, 9, 2, 3, '#7a4ac8'); k.p(4, 9, '#e84a7a'); k.r(10, 9, 2, 3, '#4a7ac8'); k.p(11, 9, '#f2c94c');
      break;
    case 'market': {
      const aw = [['#c0392b', '#f2ece0'], ['#2e5fa8', '#f2ece0']];
      for (let s = 0; s < 2; s++) { const x0 = 1 + s * 8; k.r(x0, 9, 6, 4, wood.mid); k.r(x0, 9, 6, 1, wood.lt); for (let i = 0; i < 6; i++) k.r(x0 + i, 5, 1, 3, aw[s][i % 2]); k.r(x0, 8, 6, 1, aw[s][0]); k.r(x0, 8, 1, 5, wood.dk); k.r(x0 + 5, 8, 1, 5, wood.dk); }
      k.p(3, 10, '#e84a3a'); k.p(4, 10, '#f2c94c'); k.p(11, 10, '#5aa83a'); k.p(12, 10, '#e88a3a'); k.r(6, 12, 3, 2, wood.dk); k.r(6, 12, 3, 1, '#c8a060');
      break;
    }
    case 'library':
      k.wall(2, 6, 12, 8, ramp('#d8c8a8'), { stone: true }); k.sideRoof(1, 3, 14, 3, ramp('#5a4a7a')); k.dome(8, 0, 3, 3, ramp('#7a6aa8'));
      k.door(7, 10, 2, 4, '#4a2e1a', true); for (const x of [3, 11]) { k.win(x, 8, true, 2, 3); }
      break;
    case 'observatory':
      k.wall(3, 8, 10, 6, stone, { stone: true }); k.dome(8, 2, 6, 6, ramp('#b8c0c8')); k.r(8, 2, 1, 5, '#2a2a30'); k.r(9, 1, 4, 1, '#c9a050'); k.r(12, 0, 1, 2, '#c9a050'); k.door(7, 10, 2, 4);
      break;
    case 'bank':
      k.wall(2, 7, 12, 7, ramp('#ece4d0')); k.gable(1, 3, 14, 4, ramp('#d8d0bc')); for (let i = 3; i < 13; i += 3) k.r(i, 7, 1, 7, '#fbf6ea'); k.r(1, 13, 14, 1, '#bfb6a0'); k.r(7, 4, 2, 2, '#e6c068'); k.door(7, 10, 2, 4, '#5a3a20');
      break;
    case 'hospital':
      k.wall(2, 6, 12, 8, ramp('#f2eee6')); k.sideRoof(1, 3, 14, 3, ramp('#8a9aa8')); k.r(7, 7, 2, 5, '#d84a3a'); k.r(5, 8, 6, 2, '#d84a3a'); k.win(3, 10, true, 1, 2); k.win(12, 10, true, 1, 2);
      break;
    case 'granary':
      k.wall(4, 6, 8, 8, ramp('#d8b878'), { planks: true }); k.cone(8, 0, 7, roof); k.r(1, 11, 3, 3, '#e6d090'); k.r(1, 11, 3, 1, '#c8a860'); k.r(12, 12, 3, 2, '#e6d090'); k.door(7, 10, 2, 4, '#5a3a20');
      break;
    case 'warehouse':
      k.wall(1, 6, 14, 8, wood, { planks: true }); k.sideRoof(0, 3, 16, 3, roof); k.r(5, 8, 6, 6, wood.dk); k.r(5, 8, 6, 1, wood.lt); k.r(7, 8, 1, 6, wood.dk2); k.r(1, 12, 3, 2, '#b8884a'); k.r(12, 12, 3, 2, '#b8884a');
      break;
    case 'barracks':
      k.wall(1, 7, 11, 7, wood, { planks: true }); k.sideRoof(0, 4, 13, 3, roof); k.door(5, 10, 2, 4); k.banner(13, 2, civColor, 4);
      k.r(13, 10, 1, 4, wood.dk); k.r(12, 10, 3, 1, wood.mid); k.p(13, 9, '#d8c8a8'); // training dummy
      break;
    case 'brewery':
      k.wall(1, 6, 10, 8, wall, { timber: '#6a4428' }); k.gable(0, 1, 12, 6, roof); k.door(4, 10, 2, 4);
      for (const [bx, by] of [[11, 10], [13, 11], [12, 8]]) { k.r(bx, by, 3, 4, '#8a5a30'); k.r(bx, by + 1, 3, 1, '#4a3a2a'); }
      k.r(6, 7, 3, 2, '#e6c068');
      break;
    case 'aqueduct': {
      const s2 = ramp('#c8c0b0');
      k.r(0, 3, 16, 3, s2.lt); k.r(0, 3, 16, 1, '#6ab0e0');
      for (const ax of [0, 6, 12]) { k.r(ax, 6, 4, 8, s2.mid); k.r(ax, 6, 1, 8, s2.lt); }
      for (const ax of [4, 10]) { k.r(ax, 6, 2, 1, s2.mid); }
      break;
    }
    case 'railway_station':
      k.wall(1, 5, 14, 6, brick, { stone: true }); k.sideRoof(0, 2, 16, 3, ramp('#4a4a52')); k.r(0, 12, 16, 1, '#5a5048'); k.r(0, 14, 16, 1, '#8a8176'); for (let i = 1; i < 16; i += 3) k.r(i, 12, 1, 3, '#3b2a1a');
      k.r(2, 9, 6, 3, '#2a2a30'); k.r(2, 7, 2, 2, '#2a2a30'); k.p(7, 10, '#c0392b');
      break;
    case 'textile_mill': case 'foundry': case 'factory': {
      k.wall(1, 7, 14, 7, brick, { stone: true });
      for (let i = 0; i < 3; i++) { for (let j = 0; j < 4; j++) k.r(1 + i * 5 + j, 3 + (3 - j), 1, j + 1, '#5a5a62'); }
      k.r(12, 0, 2, 7, '#6a4a3a'); k.r(12, 0, 2, 1, '#2a2a30');
      if (kind !== 'textile_mill') { k.r(3, 0, 2, 7, '#6a4a3a'); k.r(3, 0, 2, 1, '#2a2a30'); }
      for (let i = 3; i < 14; i += 3) k.win(i, 9, true, 1, 2);
      if (kind === 'foundry') k.r(6, 12, 3, 2, '#ff8a30');
      break;
    }
    case 'lumber_camp':
      for (const [ly, n] of [[11, 3], [9, 2]]) for (let i = 0; i < n; i++) { k.r(2 + i * 3 + (ly === 9 ? 1 : 0), ly, 3, 3, '#9a6a3a'); k.p(3 + i * 3 + (ly === 9 ? 1 : 0), ly + 1, '#e0b878'); }
      k.r(11, 10, 3, 4, '#7a5232'); k.r(11, 10, 3, 1, '#c8a060'); k.r(12, 6, 1, 4, '#5a3a22'); k.r(11, 6, 3, 1, '#b8c0c8');
      break;
    case 'mine': {
      const rock = ramp('#8a8480');
      for (let i = 0; i < 9; i++) { const half = Math.round(i * 0.85) + 2; k.r(8 - half, 5 + i, half * 2, 1, i < 3 ? rock.lt : rock.mid); }
      k.r(5, 8, 6, 6, '#1a1410'); k.r(4, 7, 8, 1, wood.mid); k.r(4, 7, 1, 7, wood.dk); k.r(11, 7, 1, 7, wood.dk);
      k.r(1, 14, 14, 1, '#5a5048'); k.r(9, 12, 4, 2, '#5a5a62'); k.p(10, 11, '#d8b060');
      break;
    }
    case 'quarry': {
      const s2 = ramp('#c8c2b8');
      k.r(1, 8, 14, 6, s2.dk); k.r(3, 6, 10, 3, s2.mid); k.r(1, 8, 14, 1, s2.lt); k.r(3, 6, 10, 1, s2.hi);
      k.r(2, 11, 3, 2, s2.lt); k.r(10, 11, 4, 2, s2.lt); k.r(6, 12, 1, 2, '#6a4a2a');
      break;
    }
    case 'port':
      k.r(0, 6, 16, 3, wood.mid); k.r(0, 6, 16, 1, wood.lt); for (let i = 1; i < 16; i += 4) k.r(i, 9, 1, 5, wood.dk);
      k.r(3, 10, 8, 2, '#6e4626'); k.r(6, 3, 1, 7, '#3a2a1a'); k.r(7, 4, 3, 4, '#f2ece0'); k.r(12, 2, 1, 4, wood.dk); k.r(12, 2, 3, 1, wood.dk); k.r(14, 3, 1, 3, '#b8c0c8');
      break;
    case 'walls_tower': k.wall(4, 4, 8, 10, stone, { stone: true }); for (let i = 4; i < 12; i += 3) k.r(i, 2, 2, 2, stone.lt); k.win(7, 7, true, 1, 2); break;
    case 'campfire':
      for (const [x, y] of [[5, 11], [10, 11], [7, 13], [4, 13], [11, 13]]) k.r(x, y, 2, 1, '#8a8480');
      k.r(6, 11, 4, 2, '#6e4626'); k.r(7, 8, 2, 3, '#f08a24'); k.p(7, 7, '#f6d776'); k.p(8, 9, '#fff2b0');
      break;
    default: k.wall(3, 6, 10, 8, wall); k.gable(2, 1, 12, 6, roof); k.door(7, 10, 2, 4);
  }
  const legacy = slot(`s:${kind}:${race}`, k.outline(), 'building');
  let c = fromSheet(kind === 'campfire' ? 'campfire' : 'building_' + kind, race, 0, legacy);
  if (c !== legacy && civColor) c = tintKey(c, civColor);
  cache.set(key, c);
  return c;
}

// ---------------- Fields (16×16, by season) ----------------
const FIELDC = new Map();
export function field16(v, stage) { // Aseprite sheet 'field' (tags stage0..stage5, 3 soils) if there is one
  const key = v + ':' + stage;
  let c = FIELDC.get(key);
  if (!c) { c = fromSheet('field', 'stage' + stage, v, fieldLegacy(v, stage)); FIELDC.set(key, c); }
  return c;
}
function fieldLegacy(v, stage) {
  const key = `f:${v}:${stage}`;
  if (cache.has(key)) return cache.get(key);
  const k = new Kit(16, 16);
  const soil = ['#8a6a44', '#7e6040', '#94704a'][v % 3];
  k.r(0, 0, 16, 16, soil);
  for (let y = 1; y < 16; y += 3) k.r(0, y, 16, 1, '#6a4e32');
  const crop = [null, '#8fd060', '#4fa83a', '#e6c048', '#b89a5a', '#eef3f8'][stage];
  if (crop) for (let y = 0; y < 16; y += 3) for (let x = (y / 3) % 2; x < 16; x += 2) {
    if (stage === 1) k.p(x, y, crop);
    else if (stage === 2) { k.r(x, y - 1 < 0 ? 0 : y - 1, 1, 2, crop); }
    else if (stage === 3) { k.r(x, y - 1 < 0 ? 0 : y - 1, 1, 2, crop); k.p(x, y - 1 < 0 ? 0 : y - 1, '#c8962a'); }
    else if (stage === 4) k.p(x, y, crop);
    else if (stage === 5) k.r(x, y, 2, 1, crop);
  }
  if (stage === 4) { k.r(5, 6, 3, 4, '#d8b84a'); k.r(5, 6, 3, 1, '#f2d870'); }
  cache.set(key, k.c);
  return k.c;
}
