// Phase 22 — side-view scenes. Open a town (or a battle) as a wide painted side view, drawn at
// pixel-art resolution and scaled up crisply: a sky that follows the hour, layered hills that
// drift with the camera, the town's own buildings in a row (in its people's style), townsfolk,
// animals, weather and lit windows at night; or two armies meeting on the field.
import { G, S } from '../sim/state.js';
import { B, BIOMES } from '../data/biomes.js';
import { RACES } from '../data/races.js';
import { UNITS } from '../data/military.js';
import { hash2 } from '../core/rng.js';
import { ramp } from './tiles16.js';
import { makeCanvas } from './sprites.js';

const H = 270; // art pixels tall
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// ---------------- sky & light by the hour ----------------
const SKY = [ // [tod, top, horizon, light tint for the land]
  [0.0, '#0c1230', '#2a2a58', '#4a5a9a'], [0.22, '#2a2a5a', '#e89a7a', '#c88a8a'], [0.3, '#6aa0d8', '#f6d8a0', '#f0dcb8'],
  [0.5, '#4a8ad8', '#b8dcf0', '#ffffff'], [0.7, '#5a7ab8', '#f0b890', '#f6d0b0'], [0.78, '#3a2a6a', '#e87a7a', '#c08a9a'], [0.86, '#141838', '#3a3060', '#5a5a9a'], [1.0, '#0c1230', '#2a2a58', '#4a5a9a'],
];
function sky(tod) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= tod) i++;
  const [t0, a0, b0, c0] = SKY[i], [t1, a1, b1, c1] = SKY[i + 1], u = (tod - t0) / (t1 - t0);
  return { top: mix(hex(a0), hex(a1), u), hor: mix(hex(b0), hex(b1), u), light: mix(hex(c0), hex(c1), u) };
}
const tint = (c, L, k = 0.45) => [c[0] * (1 - k + k * L[0] / 255), c[1] * (1 - k + k * L[1] / 255), c[2] * (1 - k + k * L[2] / 255)];

// ---------------- side-view buildings (cached sprites) ----------------
const cache = new Map();
function spr(key, w, h, draw) {
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const P = (px, py, pw, ph, col) => { if (pw <= 0 || ph <= 0) return; x.fillStyle = typeof col === 'string' ? col : css(col); x.fillRect(px, py, pw, ph); };
  draw(P, x);
  // a dark coloured outline
  const d = x.getImageData(0, 0, w, h), A = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d.data[(j * w + i) * 4 + 3]);
  const out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (A(i, j) < 40 && (A(i + 1, j) > 200 || A(i - 1, j) > 200 || A(i, j - 1) > 200 || A(i, j + 1) > 200)) out.push((j * w + i) * 4);
  for (const o of out) { d.data[o] = 30; d.data[o + 1] = 20; d.data[o + 2] = 34; d.data[o + 3] = 220; }
  x.putImageData(d, 0, 0);
  cache.set(key, c);
  return c;
}
// windows are recorded so they can glow at night
function house(race, tier, v) {
  const R = RACES[race] || RACES.humans;
  const roof = ramp(v === 1 ? mix(hex(R.roof), [90, 50, 40], 0.35) : v === 2 ? mix(hex(R.roof), [96, 108, 122], 0.4) : R.roof), wall = ramp(R.wall);
  const w = tier >= 3 ? 18 : 20 + (v % 2) * 4, storeys = tier >= 3 ? 3 : tier >= 2 ? 2 : 1, wh = storeys * 9 + 4, rh = 10, h = wh + rh + 2;
  const wins = [];
  const c = spr(`h:${race}:${tier}:${v}`, w, h, (P) => {
    const y0 = h - wh;
    P(1, y0, w - 2, wh, wall.mid); P(1, y0, 2, wh, wall.lt); P(w - 3, y0, 2, wh, wall.dk);
    if (race === 'humans' || race === 'halflings') for (let k = 0; k < storeys; k++) { P(1, y0 + k * 9, w - 2, 1, '#6a4428'); P(4, y0 + k * 9, 1, 9, '#6a4428'); P(w - 5, y0 + k * 9, 1, 9, '#6a4428'); }
    if (race === 'dwarves') for (let yy = y0 + 2; yy < h; yy += 4) for (let xx = 1 + ((yy >> 2) % 2) * 2; xx < w - 2; xx += 5) P(xx, yy, 4, 1, wall.dk);
    for (let k = 0; k < storeys; k++) for (let wx = 4; wx < w - 6; wx += 7) { const yy = y0 + 3 + k * 9; P(wx + 1, yy, 3, 4, '#3a2a1e'); P(wx + 2, yy + 1, 1, 2, '#8ab8d8'); wins.push([wx + 1, yy, 3, 4]); }
    P(Math.floor(w / 2) - 2, h - 7, 4, 7, '#4a2e1a'); P(Math.floor(w / 2) + 1, h - 4, 1, 1, '#e6c068');
    // roof
    for (let i = 0; i < rh; i++) { const half = Math.round((i + 1) * (w / 2 + 1) / rh); P(Math.floor(w / 2) - half, y0 - rh + i, half * 2, 1, i < 2 ? roof.lt : i < 6 ? roof.mid : roof.dk); }
    P(w - 6, y0 - rh + 1, 3, 5, '#7a6a5e'); P(w - 6, y0 - rh + 1, 3, 1, '#9a8a7e'); // chimney
  });
  c.wins ??= wins; c.chim ??= [w - 5, h - wh - rh];
  return c;
}
function tent(color, v) {
  return spr(`t:${color}:${v}`, 22, 20, (P) => {
    const hide = ramp(v ? '#8a6a44' : '#7a5a3a');
    for (let i = 0; i < 16; i++) { const half = Math.round(i * 0.65) + 1; P(11 - half, 4 + i, half, 1, hide.lt); P(11, 4 + i, half, 1, hide.dk); }
    P(10, 0, 1, 5, '#ece4cc'); P(12, 1, 1, 4, '#ece4cc'); P(9, 14, 4, 6, '#1a0e08'); P(4, 12, 14, 1, color);
  });
}
function special(kind, race, color) {
  const R = RACES[race] || RACES.humans, wall = ramp(R.wall), roof = ramp(R.roof), stone = ramp('#a8a094');
  switch (kind) {
    case 'town_hall': return spr(`s:hall:${race}`, 34, 46, (P) => { P(2, 22, 30, 24, wall.mid); P(2, 22, 3, 24, wall.lt); for (let i = 0; i < 10; i++) P(2 + i * 1.5, 12 + i, 30 - i * 3, 1, i < 3 ? roof.lt : roof.mid); P(13, 2, 8, 22, stone.mid); P(13, 2, 2, 22, stone.lt); P(14, 6, 6, 6, '#f4ecd8'); P(16, 7, 1, 3, '#2a1a10'); P(16, 9, 3, 1, '#2a1a10'); P(12, 0, 10, 3, roof.dk); P(14, 34, 6, 12, '#4a2e1a'); for (const x of [5, 25]) P(x, 28, 4, 6, '#3a2a1e'); });
    case 'castle': return spr(`s:castle:${color}`, 50, 52, (P) => { P(6, 20, 38, 32, stone.mid); P(6, 20, 3, 32, stone.lt); P(41, 20, 3, 32, stone.dk); for (const x of [0, 40]) { P(x, 8, 10, 44, stone.mid); P(x, 8, 2, 44, stone.lt); for (let k = 0; k < 10; k += 3) P(x + k, 5, 2, 3, stone.mid); } for (let k = 6; k < 44; k += 4) P(k, 17, 2, 3, stone.mid); P(20, 36, 10, 16, '#3a2a1e'); P(21, 37, 8, 15, '#5a3a1e'); P(4, 0, 1, 8, '#3a2a1a'); P(5, 0, 6, 4, color); P(44, 0, 1, 8, '#3a2a1a'); P(45, 0, 6, 4, color); });
    case 'temple': return spr(`s:temple:${race}`, 30, 50, (P) => { P(3, 26, 24, 24, '#e8e0d0'); P(3, 26, 3, 24, '#fff6e8'); P(11, 6, 8, 22, '#e8e0d0'); for (let i = 0; i < 8; i++) P(15 - i * 0.5, i, i + 1, 1, '#6a7a8a'); P(14, 0, 2, 3, '#e6c068'); P(13, 34, 4, 16, '#4a2e1a'); P(13, 12, 4, 6, '#8ab8e8'); for (let i = 0; i < 6; i++) P(3 + i * 2, 20 + i, 24 - i * 4, 1, '#6a7a8a'); });
    case 'market': return spr(`s:market:${color}`, 36, 24, (P) => { for (let k = 0; k < 3; k++) { const x = 1 + k * 12; P(x, 8, 10, 2, k % 2 ? color : '#e8e0d0'); for (let s = 0; s < 10; s += 2) P(x + s, 6, 2, 2, s % 4 ? color : '#e8e0d0'); P(x, 10, 1, 14, '#6a4428'); P(x + 9, 10, 1, 14, '#6a4428'); P(x + 1, 17, 8, 3, '#8a5a32'); P(x + 2, 15, 2, 2, ['#d84a3a', '#e8c050', '#7aa850'][k]); P(x + 5, 15, 2, 2, ['#e8a040', '#c84a3a', '#c8b050'][k]); } });
    case 'library': case 'university': return spr(`s:lib:${race}`, 34, 38, (P) => { P(2, 16, 30, 22, '#d8d0c0'); for (let x = 4; x < 31; x += 5) P(x, 18, 2, 18, '#f0e8dc'); P(1, 14, 32, 2, '#a8a094'); for (let i = 0; i < 8; i++) P(9 + i, 14 - i, 16 - i * 2, 1, '#5a8aa0'); P(16, 2, 2, 5, '#e6c068'); P(14, 28, 6, 10, '#4a2e1a'); });
    case 'granary': case 'warehouse': return spr(`s:gran:${race}`, 22, 30, (P) => { P(3, 8, 16, 22, '#c8a878'); P(3, 8, 3, 22, '#e0c898'); for (let y = 10; y < 30; y += 5) P(3, y, 16, 1, '#8a6a44'); for (let i = 0; i < 7; i++) P(3 + i, 8 - i, 16 - i * 2, 1, roof.mid); P(9, 22, 4, 8, '#4a2e1a'); });
    case 'barracks': return spr(`s:barr:${color}`, 32, 26, (P) => { P(1, 10, 30, 16, stone.mid); P(1, 10, 2, 16, stone.lt); for (let k = 1; k < 31; k += 4) P(k, 7, 2, 3, stone.mid); P(12, 16, 8, 10, '#3a2a1e'); P(26, 0, 1, 10, '#3a2a1a'); P(27, 0, 5, 3, color); for (const x of [5, 22]) { P(x, 14, 1, 10, '#8a6a44'); P(x, 13, 1, 1, '#d8dee4'); } });
    case 'port': return spr(`s:port`, 40, 40, (P) => { P(0, 30, 40, 4, '#7a5a3a'); for (let x = 2; x < 40; x += 6) P(x, 34, 2, 6, '#5a3a1e'); P(28, 2, 2, 28, '#6a4a2a'); P(14, 2, 16, 2, '#6a4a2a'); P(16, 4, 1, 10, '#3a2a1a'); P(14, 14, 5, 4, '#a87a3a'); P(4, 22, 10, 8, '#a85a3a'); P(5, 20, 8, 2, '#c87a4a'); });
    case 'mine': case 'quarry': return spr(`s:mine`, 24, 22, (P) => { for (let i = 0; i < 14; i++) P(12 - i, 8 + i, i * 2 + 1, 1, '#8a8480'); P(9, 13, 6, 9, '#1a1410'); P(8, 12, 8, 2, '#6a4428'); P(8, 12, 2, 10, '#6a4428'); P(14, 12, 2, 10, '#6a4428'); P(17, 18, 6, 4, '#5a3a1e'); P(18, 16, 4, 2, '#8a8a8a'); });
    case 'lumber_camp': return spr(`s:lumber`, 24, 18, (P) => { for (let k = 0; k < 4; k++) P(2, 12 - k * 3 + 0, 18, 3, k % 2 ? '#8a5a32' : '#a0703a'); for (let k = 0; k < 4; k++) P(2, 12 - k * 3, 2, 3, '#e8c890'); P(20, 6, 1, 12, '#6a4428'); P(19, 5, 4, 2, '#b8c0c8'); });
    default: return null;
  }
}
function windmill(frame) {
  return spr(`wm:${frame}`, 30, 44, (P) => {
    for (let y = 16; y < 44; y++) { const half = 5 + Math.round((y - 16) * 0.18); P(15 - half, y, half, 1, '#e8dcc0'); P(15, y, half, 1, '#c8bca0'); }
    P(13, 36, 4, 8, '#4a2e1a'); P(10, 13, 10, 5, '#7a5232');
    const a0 = (frame / 4) * (Math.PI / 2);
    for (let k = 0; k < 4; k++) { const a = a0 + (k * Math.PI) / 2; for (let r = 1; r <= 13; r++) { const x = Math.round(15 + Math.cos(a) * r), y = Math.round(15 + Math.sin(a) * r); P(x, y, 1, 1, '#5a3a1e'); if (r > 3) P(Math.round(15 + Math.cos(a) * r - Math.sin(a) * 2), Math.round(15 + Math.sin(a) * r + Math.cos(a) * 2), 1, 1, r % 2 ? '#f0e8d8' : '#d8ccb4'); } }
  });
}
function tree(kind, v) {
  return spr(`tr:${kind}:${v}`, 18, 30, (P) => {
    if (kind === 'pine') { const g = ramp('#3a7a4a'); for (let i = 0; i < 24; i++) { const half = Math.round(i * 0.33) + 1; P(9 - half, i, half, 1, g.lt); P(9, i, half, 1, g.dk); } P(8, 24, 2, 6, '#5a3a22'); return; }
    if (kind === 'palm') { P(8, 10, 2, 20, '#8a6a3a'); const g = ramp('#4a9a3a'); for (const [dx, dy] of [[-7, 2], [7, 2], [-5, -1], [5, -1], [0, -3]]) P(9 + Math.min(0, dx), 9 + dy, Math.abs(dx) + 1, 2, g.mid); return; }
    const g = ramp(['#4a9a3a', '#5aa848', '#3f8a40'][v % 3]);
    P(8, 18, 2, 12, '#6a4428');
    for (let y = 0; y < 20; y++) { const half = Math.round(8 * Math.sqrt(Math.max(0, 1 - ((y - 10) / 10) ** 2))); P(9 - half, y, half * 2, 1, y < 6 ? g.lt : y < 14 ? g.mid : g.dk); }
  });
}
// a blue-grey silhouette copy, for buildings further back
const SHADE = new WeakMap();
function shadeOf(img) {
  let c = SHADE.get(img);
  if (c) return c;
  c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#28325a'; x.fillRect(0, 0, img.width, img.height);
  SHADE.set(img, c);
  return c;
}
// a walker 5×9, frames 0..3; dir via flip at draw time
function walker(body, skin, hat, frame, small) {
  return spr(`wk:${body}:${skin}:${hat}:${frame}:${small}`, 5, 9, (P) => {
    const o = small ? 2 : 0, st = [0, 1, 0, -1][frame];
    P(1 + (st > 0 ? 1 : 0), 7, 1, 2, '#2a1c14'); P(3 - (st < 0 ? 1 : 0), 7, 1, 2, '#2a1c14');
    P(1, 3 + o, 3, 4 - o, body); P(0, 4 + o + (st > 0 ? 1 : 0), 1, 2, skin); P(4, 4 + o + (st < 0 ? 1 : 0), 1, 2, skin);
    P(1, 1 + o, 3, 2, skin); P(3, 2 + o, 1, 1, '#1a1010');
    if (hat) { P(0, o, 5, 1, hat); P(1, o - 1 < 0 ? 0 : o - 1, 3, 1, hat); } else P(1, o, 3, 1, '#5a3a22');
  });
}
function soldier(color, skin, cls, frame, era) {
  return spr(`so:${color}:${skin}:${cls}:${frame}:${era}`, 10, 13, (P) => {
    const st = [0, 1, 0, -1][frame % 4], body = ramp(color);
    // legs and boots
    P(3 + (st > 0 ? 1 : 0), 9, 1, 3, '#3a2a1e'); P(5 - (st < 0 ? 1 : 0), 9, 1, 3, '#3a2a1e'); P(3 + (st > 0 ? 1 : 0), 12, 2, 1, '#1e140e'); P(5 - (st < 0 ? 1 : 0), 12, 2, 1, '#1e140e');
    // tunic with a belt, lit on the facing side
    P(3, 5, 4, 4, body.mid); P(6, 5, 1, 4, body.lt); P(3, 5, 1, 4, body.dk); P(3, 8, 4, 1, '#3a2a1a');
    // head and helmet (a kettle hat early, a dark cap with guns)
    P(4, 2, 3, 3, skin); P(6, 3, 1, 1, '#1a1010');
    if (era >= 3) { P(3, 1, 5, 2, '#3a3a40'); } else { P(3, 1, 4, 2, '#9aa4ae'); P(2, 2, 6, 1, '#7a848e'); }
    if (cls === 'rng') { P(8, 2, 1, 8, '#7a5530'); P(9, 3, 1, 6, '#d8d0c0'); P(7, 5, 2, 1, skin); }
    else if (era >= 3) { P(6, 6, 4, 1, '#3a3a40'); P(5, 7, 2, 1, '#6a4a2a'); P(7, 6, 1, 1, skin); }
    else { P(8, 0, 1, 11, '#8a6a44'); P(8, 0, 1, 2, '#d8dee4'); P(7, 6, 1, 1, skin); P(1, 5, 3, 4, body.mid); P(1, 5, 3, 1, body.lt); P(2, 6, 1, 2, '#e6c068'); }
  });
}
function rider(color, skin, frame) {
  return spr(`rd:${color}:${skin}:${frame}`, 14, 14, (P) => {
    const st = frame % 2;
    P(2, 7, 9, 4, '#7a4e2e'); P(2, 7, 9, 1, '#9a6a44'); P(10, 4, 3, 4, '#7a4e2e'); P(12, 5, 1, 1, '#111');
    P(2 + st, 11, 1, 3, '#3a2a1e'); P(9 - st, 11, 1, 3, '#3a2a1e'); P(1, 8, 1, 3, '#3a2216');
    P(5, 2, 3, 5, color); P(5, 0, 3, 2, skin); P(5, 0, 3, 1, '#9aa4ae'); P(9, 0, 1, 7, '#cfd6dd');
  });
}

// ---------------- the scene view ----------------
export class SceneView {
  constructor() {
    this.el = null; this.open = false; this.cam = 0; this.t = 0;
  }
  ensureDom(close) {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'scene'; el.className = 'hidden';
    el.innerHTML = '<canvas></canvas><div class="scene-head"><b class="scene-title"></b><span class="scene-sub"></span><button class="btn sm" data-scene="close">Close · Esc</button></div><div class="scene-hint">Drag to look along the town · Esc to close</div>';
    document.getElementById('app').appendChild(el);
    this.el = el; this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    el.querySelector('[data-scene="close"]').addEventListener('click', () => close());
    let drag = null;
    this.cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, cam: this.cam }; });
    window.addEventListener('pointermove', (e) => { if (drag) this.cam = drag.cam - (e.clientX - drag.x) / (this.k || 3); });
    window.addEventListener('pointerup', () => { drag = null; });
  }
  show(spec, close) {
    this.ensureDom(close);
    this.spec = spec; this.open = true; this.cam = 0; this.t = 0;
    this.el.classList.remove('hidden');
    this.build();
  }
  hide() { this.open = false; this.el?.classList.add('hidden'); }
  build() {
    const st = S(), W = G.world, sp = this.spec;
    if (sp.type === 'town') {
      const s = st.settlements[sp.id], civ = st.civs[s.civ];
      this.title = s.name; this.sub = `${civ.displayName} · ${Math.round(s.pop)} people`;
      this.biome = W.biome[s.tile]; this.temp = W.temp[s.tile]; this.race = civ.race; this.color = civ.color; this.seed = s.id * 7919 + 13;
      const P = W.provinces[s.province];
      this.coast = !!P.coastal; this.hilly = this.biome === B.HILLS || this.biome === B.MOUNTAIN || civ.race === 'dwarves';
      // buildings in a row: specials spread among the houses
      const specials = [];
      for (const k of ['town_hall', 'castle', 'temple', 'market', 'library', 'university', 'granary', 'barracks', 'port', 'mine', 'quarry', 'lumber_camp']) if (s.buildings[k]) specials.push(k);
      const nH = clamp(Math.round(4 + s.pop / 60), 4, 26);
      const row = [];
      for (let i = 0; i < nH; i++) row.push({ kind: 'house', v: (hash2(i, s.id, 3) * 3) | 0 });
      specials.forEach((k, j) => row.splice(Math.round(((j + 1) / (specials.length + 1)) * row.length), 0, { kind: k }));
      if ((s.buildings.farm || 0) >= 2 && civ.race !== 'elves' && civ.race !== 'lizardfolk') row.splice(Math.min(row.length, 2), 0, { kind: 'windmill' });
      this.row = row; this.walls = (s.buildings.walls || 0) > 0;
      this.tier = Math.min(3, s.stage);
      this.people = Array.from({ length: clamp(Math.round(s.pop / 40), 4, 30) }, (_, i) => ({ x: hash2(i, s.id, 9) * 1, sp: (hash2(s.id, i, 10) - 0.5) * 0.02, role: (hash2(i, i, 11) * 5) | 0, small: hash2(i, s.id, 12) < 0.15 }));
      this.mode = 'town';
    } else {
      const r = sp.report, b = sp.battle;
      const src = r || b;
      this.title = r ? `Battle of ${r.place}` : 'A battle rages';
      const ac = st.civs[src.ac], dc = st.civs[src.dc];
      this.sub = `${ac.displayName} against ${dc.displayName}${r ? ` · ${st.civs[r.winner]?.displayName || '—'} won` : ''}`;
      this.biome = W.biome[src.tile] ?? B.GRASS; this.temp = W.temp[src.tile] ?? 0.5; this.seed = (src.id || 1) * 104729;
      this.coast = false; this.hilly = this.biome === B.HILLS || this.biome === B.MOUNTAIN;
      const comp = (c) => { const o = []; for (const k in c || {}) { const n = Math.round(c[k] * 2); for (let i = 0; i < Math.min(14, n); i++) o.push(UNITS[k]?.cls || 'inf'); } return o.slice(0, 40); };
      const info = r || b.info || {};
      this.armies = [
        { civ: ac, units: comp(r ? r.compA : info.compA), side: -1, loss: r ? r.lossA / Math.max(0.1, r.startA) : 0 },
        { civ: dc, units: comp(r ? r.compD : info.compD), side: 1, loss: r ? r.lossD / Math.max(0.1, r.startD) : 0 },
      ];
      this.winner = r ? (r.winner === r.ac ? 0 : 1) : -1;
      this.mode = 'battle';
    }
    this.el.querySelector('.scene-title').textContent = this.title;
    this.el.querySelector('.scene-sub').textContent = this.sub;
    this.el.querySelector('.scene-hint').textContent = this.mode === 'town' ? 'Drag to look along the town · Esc to close' : 'The armies meet · Esc to close';
  }
  // the scene's world width in art pixels
  width() { if (this.mode === 'battle') return 520; let w = 40; for (const it of this.row) w += it.kind === 'house' ? 26 : it.kind === 'castle' ? 56 : 40; return Math.max(520, w + 40); }
  draw(dt) {
    if (!this.open) return;
    this.t += dt;
    const cw = this.cv.clientWidth, ch = this.cv.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor((ch * dpr) / H)); this.k = k / dpr;
    const Wd = Math.ceil((cw * dpr) / k), Hd = Math.ceil((ch * dpr) / k);
    if (!this.art || this.art.width !== Wd || this.art.height !== Hd) { this.art = makeCanvas(Wd, Hd); }
    if (this.cv.width !== Math.round(cw * dpr) || this.cv.height !== Math.round(ch * dpr)) { this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr); }
    const x = this.art.getContext('2d');
    const tod = this.spec.tod ?? (window.LW?.renderer?.atmo?.tod ?? 0.45);
    const maxCam = Math.max(0, this.width() - Wd);
    if (this.mode === 'town' && this.cam === 0 && !this.spec.panned) this.cam = maxCam / 2;
    this.cam = clamp(this.cam, 0, maxCam);
    // the scene is 270 art px tall, anchored to the bottom; extra height above is sky
    const off = Hd - H;
    x.fillStyle = css(sky(tod).top); x.fillRect(0, 0, Wd, Hd);
    x.save(); x.translate(0, off);
    this.paint(x, Wd, tod);
    x.restore();
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.art, 0, 0, Wd * k, Hd * k);
  }
  paint(x, Wd, tod) {
    const P = (px, py, pw, ph, col) => { x.fillStyle = typeof col === 'string' ? col : css(col); x.fillRect(Math.round(px), Math.round(py), Math.ceil(pw), Math.ceil(ph)); };
    const S2 = sky(tod), L = S2.light, night = tod < 0.22 || tod > 0.82, dark = night ? 1 : clamp((Math.abs(tod - 0.5) - 0.25) / 0.07, 0, 1);
    const month = Math.floor((S().day % 360) / 30), winter = (month <= 1 || month === 11) && this.temp < 0.6, autumn = month >= 8 && month <= 10;
    const seed = this.seed;
    // sky, dithered between the bands
    for (let y = 0; y < 200; y++) { const u = y / 200; const c = mix(S2.top, S2.hor, u * u); P(0, y, Wd, 1, c); if (y % 2 === 0 && y > 20) for (let xx = (y >> 1) % 2; xx < Wd; xx += 4) P(xx, y, 1, 1, mix(c, S2.hor, 0.18)); }
    // sun or moon
    const sunU = (tod - 0.22) / 0.6;
    if (!night && sunU > 0 && sunU < 1) { const sx = Wd * (0.1 + sunU * 0.8), sy = 150 - Math.sin(sunU * Math.PI) * 120; x.fillStyle = 'rgba(255,240,200,0.18)'; x.beginPath(); x.arc(sx, sy, 22, 0, 6.29); x.fill(); for (let yy = -8; yy <= 8; yy++) { const hw = Math.round(Math.sqrt(64 - yy * yy)); P(sx - hw, sy + yy, hw * 2, 1, mix([255, 250, 220], L, 0.3)); } }
    else { const mx = Wd * 0.75, my = 50; for (let yy = -7; yy <= 7; yy++) { const hw = Math.round(Math.sqrt(49 - yy * yy)); P(mx - hw, my + yy, hw * 2, 1, '#f0eedc'); } P(mx + 1, my - 3, 3, 3, '#d8d6c4'); P(mx - 4, my + 2, 2, 2, '#d8d6c4'); for (let i = 0; i < 70; i++) { const sx = hash2(i, 1, seed) * Wd, sy = hash2(i, 2, seed) * 150; if (Math.sin(this.t * 2 + i) > -0.3) P(sx, sy, 1, 1, '#fffbe8'); } }
    // clouds
    for (let i = 0; i < 7; i++) { const cx = ((hash2(i, 3, seed) * Wd * 1.6 + this.t * (3 + i)) % (Wd + 120)) - 60, cy = 20 + hash2(i, 4, seed) * 70; const cc = mix([255, 255, 255], S2.hor, 0.35 + dark * 0.4); for (let b2 = 0; b2 < 4; b2++) { const r = 6 + hash2(i, b2, 5) * 7; x.fillStyle = css(cc); x.beginPath(); x.arc(cx + b2 * 9, cy + (b2 % 2) * 2, r, 0, 6.29); x.fill(); } }
    // far mountains, mid hills (parallax)
    const layer = (base, amp, sc, col, par, snow) => {
      const off = this.cam * par;
      for (let xx = 0; xx < Wd; xx++) {
        const wx = xx + off, n = Math.sin(wx / sc + seed) * 0.5 + Math.sin(wx / (sc * 0.37) + seed * 2) * 0.3 + Math.sin(wx / (sc * 0.13)) * 0.12;
        const top = Math.round(base - (n * 0.5 + 0.5) * amp);
        P(xx, top, 1, 270 - top, col);
        if (snow && top < base - amp * 0.62) P(xx, top, 1, 3, mix([248, 250, 255], L, 0.25));
      }
    };
    const fogc = (c, f) => mix(tint(c, L), S2.hor, f);
    const far = this.hilly ? 120 : 70;
    layer(170, far, 60, fogc([110, 120, 150], 0.55), 0.15, this.temp < 0.55 || this.hilly);
    const midBase = BIOMES[this.biome].water ? [70, 120, 90] : this.biome === B.DESERT ? [200, 170, 110] : this.biome === B.SNOW || winter ? [210, 220, 230] : autumn ? [150, 130, 70] : [70, 120, 70];
    layer(190, 34, 34, fogc(midBase, 0.3), 0.4, false);
    // trees on the mid hills
    const treeKind = this.biome === B.JUNGLE || this.biome === B.DESERT || this.biome === B.BEACH ? 'palm' : this.temp < 0.45 || this.biome === B.TAIGA ? 'pine' : 'oak';
    for (let i = 0; i < 40; i++) { const wx = hash2(i, 6, seed) * (this.width() + 200) - 100 - this.cam * 0.6; if (wx < -20 || wx > Wd + 20) continue; x.globalAlpha = 0.85; x.drawImage(tree(treeKind, i % 3), Math.round(wx), 168 + Math.round(hash2(i, 7, seed) * 14)); x.globalAlpha = 1; }
    // ground
    const ground = this.biome === B.DESERT || this.biome === B.BEACH ? [214, 190, 130] : winter || this.biome === B.SNOW ? [232, 238, 246] : autumn ? [150, 150, 70] : [96, 156, 70];
    P(0, 214, Wd, 56, tint(ground, L, 0.5));
    for (let i = 0; i < Wd; i += 3) if (hash2(i + Math.floor(this.cam), 8, seed) < 0.3) P(i, 214 + ((hash2(i, 9, seed) * 8) | 0), 1, 2, tint(mix(ground, [40, 70, 30], 0.35), L, 0.5));
    P(0, 214, Wd, 1, tint(mix(ground, [255, 255, 255], 0.25), L, 0.5));
    if (this.coast) { P(0, 246, Wd, 24, tint([60, 120, 180], L, 0.6)); for (let i = 0; i < Wd; i += 7) P((i + this.t * 6) % Wd, 250 + (i % 3) * 5, 4, 1, tint([200, 230, 250], L, 0.5)); }
    if (this.mode === 'town') this.paintTown(x, P, Wd, L, dark, winter);
    else this.paintBattle(x, P, Wd, L);
    // rain / snow
    const rain = (window.LW?.renderer?.atmo?.cover?.(0, 0) || 0) > 0.75;
    if (winter && hash2(Math.floor(this.t / 20), 1, seed) < 0.5) for (let i = 0; i < 120; i++) { const sx = (hash2(i, 11, seed) * Wd + this.t * 8 + Math.sin(this.t + i) * 4) % Wd, sy = (hash2(i, 12, seed) * 270 + this.t * 20) % 270; P(sx, sy, 1, 1, '#f4f8ff'); }
    else if (rain) for (let i = 0; i < 160; i++) { const sx = (hash2(i, 11, seed) * Wd + this.t * 40) % Wd, sy = (hash2(i, 12, seed) * 270 + this.t * 220) % 270; P(sx, sy, 1, 3, 'rgba(200,215,240,0.6)'); }
    // night: a deep blue veil, with lights punched through by the town itself
    if (dark > 0) { x.fillStyle = `rgba(20,24,64,${0.45 * dark})`; x.fillRect(0, 0, Wd, 270); }
    if (this.lights?.length && dark > 0.2) { x.globalCompositeOperation = 'lighter'; for (const [lx, ly] of this.lights) { const g = x.createRadialGradient(lx, ly, 0, lx, ly, 9); g.addColorStop(0, `rgba(255,190,100,${0.16 * dark})`); g.addColorStop(1, 'rgba(255,190,100,0)'); x.fillStyle = g; x.fillRect(lx - 9, ly - 9, 18, 18); } x.globalCompositeOperation = 'source-over'; for (const [lx, ly, w, h] of this.lights) if (w) P(lx - w / 2, ly - h / 2, w, h, '#ffd27a'); }
  }
  paintTown(x, P, Wd, L, dark, winter) {
    const lights = []; this.lights = lights;
    const draw = (img, wx, base, alpha = 1, shade = 0) => {
      const sx = Math.round(wx - this.cam);
      if (sx > Wd + 60 || sx + img.width < -60) return null;
      x.globalAlpha = alpha; x.drawImage(img, sx, base - img.height); x.globalAlpha = 1;
      if (shade) { x.globalAlpha = shade; x.drawImage(shadeOf(img), sx, base - img.height); x.globalAlpha = 1; }
      return sx;
    };
    // a hill behind dwarven and hill towns, with doors in it
    if (this.hilly) { x.fillStyle = css(tint([110, 120, 80], L)); x.beginPath(); x.moveTo(-10, 214); for (let xx = 0; xx <= Wd + 10; xx += 4) x.lineTo(xx, 214 - 34 - Math.sin((xx + this.cam) / 40) * 10); x.lineTo(Wd + 10, 214); x.fill(); }
    // back row (smaller, bluer) then front row
    let wx = 30;
    const back = [];
    for (const [i, it] of this.row.entries()) {
      const img = it.kind === 'house' ? (this.race === 'orcs' ? tent(this.color, it.v) : house(this.race, this.tier, it.v)) : it.kind === 'windmill' ? windmill(Math.floor(this.t * 3) % 4) : special(it.kind, this.race, this.color);
      if (!img) continue;
      if (it.kind === 'house' && i % 3 === 1) { back.push([img, wx + 6]); wx += 12; continue; }
      it.img = img; it.wx = wx; wx += img.width + 4 + (hash2(i, 5, this.seed) * 6 | 0);
    }
    for (const [img, bx] of back) draw(img, bx, 206, 1, 0.22);
    // walls run across the middle ground
    if (this.walls) { const wc = tint([168, 160, 148], L); for (let xx = 0; xx < Wd; xx++) { const wx2 = xx + this.cam; P(xx, 200, 1, 14, wc); if (Math.floor(wx2 / 6) % 2 === 0) P(xx, 196, 1, 4, wc); } P(Wd / 2 - 8, 202, 16, 12, '#3a2a1e'); }
    for (const it of this.row) {
      if (!it.img) continue;
      const sx = draw(it.img, it.wx, 216);
      if (sx == null) continue;
      if (winter && it.kind !== 'market') P(sx + 2, 216 - it.img.height + 2, it.img.width - 4, 2, '#f4f8ff');
      if (it.img.wins) for (const [wx3, wy, w, h] of it.img.wins) { if (dark > 0.2 && hash2(it.wx, wy, 7) < 0.8) lights.push([sx + wx3 + w / 2, 216 - it.img.height + wy + h / 2, w, h]); }
      if (it.img.chim && hash2(it.wx, 1, 2) < 0.6) for (let p = 0; p < 4; p++) { const age = (this.t * 0.6 + p * 0.25 + hash2(it.wx, p, 3)) % 1; x.fillStyle = `rgba(200,200,205,${0.5 * (1 - age)})`; x.fillRect(sx + it.img.chim[0] + Math.sin(age * 6) * 2 + age * 6, 216 - it.img.height + it.img.chim[1] - age * 24, 2 + age * 3, 2 + age * 3); }
    }
    // lamp posts at night
    for (let i = 0; i < 8; i++) { const lx = 60 + i * 90 - this.cam; if (lx < -10 || lx > Wd + 10) continue; P(lx, 206, 1, 14, '#3a2a1e'); P(lx - 1, 204, 3, 2, dark > 0.2 ? '#ffd27a' : '#6a5a4a'); if (dark > 0.2) lights.push([lx, 205, 0, 0]); }
    // townsfolk walking the street
    const skin = (RACES[this.race] || RACES.humans).skin;
    const W = this.width();
    const roles = [['#8a6a3a', '#d8c070'], [this.color, null], ['#4e6a8a', null], ['#c89a28', '#7a3a2a'], ['#7a3a8a', '#e6c068']];
    for (const [i, p] of this.people.entries()) {
      if (dark > 0.6 && i % 3) continue;
      const pos = ((p.x * W + this.t * p.sp * 1000) % W + W) % W;
      const sx = Math.round(pos - this.cam);
      if (sx < -6 || sx > Wd + 6) continue;
      const fr = Math.floor(this.t * 6 + i) % 4, [body, hat] = roles[p.role % roles.length];
      const img = walker(body, skin, hat, fr, p.small);
      x.save(); if (p.sp < 0) { x.translate(sx * 2 + 5, 0); x.scale(-1, 1); }
      x.drawImage(img, sx, 224 + (i % 3) * 3 - 9);
      x.restore();
    }
    // a cart and a dog
    const cx = ((this.t * 9) % (W + 60)) - 30 - this.cam;
    P(cx, 228, 10, 4, '#7a5232'); P(cx + 1, 224, 8, 4, this.color); P(cx + 1, 232, 2, 2, '#3a2a1a'); P(cx + 7, 232, 2, 2, '#3a2a1a'); P(cx + 10, 227, 5, 4, '#8a6a4a'); P(cx + 14, 225, 2, 2, '#8a6a4a');
    if (this.coast) for (let b = 0; b < 2; b++) { const bx = ((this.t * (4 + b * 2) + b * 200) % (Wd + 40)) - 20; P(bx, 252, 14, 3, '#5a3c22'); P(bx + 6, 240, 1, 12, '#3a2a1a'); P(bx + 7, 241, 6, 8, '#f2ecdc'); }
  }
  paintBattle(x, P, Wd, L) {
    const lights = []; this.lights = lights;
    // the fight unfolds over ~12 seconds: approach, clash, and (for reports) the rout
    const u = clamp(this.t / 12, 0, 1);
    const mid = Wd / 2;
    for (const [ai, A] of this.armies.entries()) {
      const skin = (RACES[A.civ.race] || RACES.humans).skin;
      const dir = ai === 0 ? 1 : -1;
      const routed = this.winner >= 0 && this.winner !== ai && u > 0.75;
      A.units.forEach((cls, i) => {
        const row = cls === 'cav' ? 0 : cls === 'rng' ? 2 : 1;
        const col = Math.floor(i / 3), lane = i % 3;
        const fallen = A.loss * A.units.length > i && hash2(i, ai, 41) < u * 1.2;
        let px = mid - dir * (40 + col * 9 + row * 26) + dir * Math.min(1, u * 1.6) * (row === 2 ? 10 : 34);
        if (routed) px -= dir * (u - 0.75) * 260;
        const py = 236 + lane * 6 - row * 2 + (cls === 'cav' ? -2 : 0);
        const jitter = u > 0.55 && !routed ? Math.round(Math.sin(this.t * 9 + i) * 1.5) : 0;
        if (fallen) { P(px, py + 7, 7, 2, mix([90, 30, 30], hex(A.civ.color), 0.5)); return; }
        const img = cls === 'cav' ? rider(A.civ.color, skin, Math.floor(this.t * 7 + i)) : soldier(A.civ.color, skin, cls, Math.floor(this.t * 6 + i), A.civ.era || 0);
        x.save(); if (dir < 0) { x.translate(Math.round(px + jitter) * 2 + img.width, 0); x.scale(-1, 1); }
        x.drawImage(img, Math.round(px + jitter), py - img.height + 6);
        x.restore();
        // arrows and musket smoke
        if (cls === 'rng' && u > 0.2 && u < 0.85 && (Math.floor(this.t * 2 + i) % 3 === 0)) { const f = (this.t * 1.5 + i * 0.3) % 1, ax = px + dir * f * 60, ay = py - 12 - Math.sin(f * Math.PI) * 26; P(ax, ay, 2, 1, '#3a2a1a'); }
        if ((A.civ.era || 0) >= 3 && u > 0.3 && Math.sin(this.t * 5 + i * 3) > 0.92) { x.fillStyle = 'rgba(220,220,220,0.6)'; x.fillRect(px + dir * 8, py - 6, 5, 4); lights.push([px + dir * 7, py - 5, 0, 0]); }
      });
      // banner
      const bx = mid - dir * (70 + Math.max(0, 1 - u) * 20) - (routed ? dir * (u - 0.75) * 260 : 0);
      P(bx, 200, 1, 24, '#3a2a1a'); P(bx + 1, 200, 10, 7, A.civ.color); P(bx + 1, 200, 10, 1, '#ffffff');
    }
    if (u > 0.5 && u < 0.85) for (let i = 0; i < 6; i++) { const d = hash2(i, Math.floor(this.t * 3), 7); x.fillStyle = `rgba(190,170,130,${0.35 * d})`; x.fillRect(mid - 30 + i * 10, 226 - d * 12, 8, 6); } // dust of the melee
    if (u >= 1 && this.winner >= 0) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(mid - 90, 110, 180, 22); x.fillStyle = '#f4ecd8'; x.font = '10px "Pixelify Sans", monospace'; x.textAlign = 'center'; x.fillText(`${this.armies[this.winner].civ.baseName} holds the field`, mid, 125); }
  }
}
export const sceneView = new SceneView();
