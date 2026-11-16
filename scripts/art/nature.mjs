// tree_<kind> and nature_<kind>: map objects baked into the terrain chunks (src/render/tiles16.js
// objectSprite). Feet (trunk base) sit 4 art px above the bottom edge; a soft shadow under them.
// Trees have the tags spring, summer, autumn, winter with a few variants each (the game picks a
// variant per spot); nature objects have season tags where the season changes their look.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

const SHADOW = '#241a2448';
function finishObj(g, cx, cy, rx, ry = 2) {
  g.outline(INK);
  const sh = new Pix(g.w, g.h); sh.ellipse(cx, cy, rx, ry, SHADOW);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!g.alpha(x, y) && sh.alpha(x, y)) g.p(x, y, SHADOW);
  return g;
}
// a deterministic little random
const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// one round clump of leaves, lit from the top-left, darker rim at the bottom-right
function clump(g, cx, cy, r, ramp, seed = 0) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const nx = (x - cx) / (r + 0.4), ny = (y - cy) / (r + 0.4), d = nx * nx + ny * ny;
    if (d > 1) continue;
    const edge = d > 0.82 && (x * 7 + y * 3 + seed) % 3 === 0;           // bumpy leafy edge
    if (edge && ny < 0.2) continue;
    const l = -0.62 * nx - 0.78 * ny + (rnd(x, y, seed) - 0.5) * 0.25;
    const i = l > 0.62 ? 4 : l > 0.2 ? 3 : l > -0.3 ? 2 : l > -0.7 ? 1 : 0;
    g.p(x, y, ramp[Math.min(i, ramp.length - 1)]);
  }
}
const SPRING = ['#1e3a24', '#2e6236', '#4c9640', '#7cc256', '#b0e078'];
const SUMMER = ['#163222', '#234f30', '#33773a', '#53a043', '#8cca5a'];
const AUTUMN = [
  ['#4a1e14', '#8a3a1c', '#c8622a', '#ec9a3a', '#f8cc6a'],
  ['#4a1418', '#862626', '#c4422e', '#e4743e', '#f4a868'],
  ['#5a3a14', '#9a6a1c', '#d4a42a', '#f0d04a', '#fbeb94'],
];
const BIRCH_SUMMER = ['#1e3e24', '#2f6a34', '#4e9c40', '#7ec456', '#b4e27a'];
const SNOW = ['#8a9ab8', '#b8c8dc', '#e4ecf6', '#ffffff'];

function trunk(g, x, top, bottom, w, ramp, birch = false) {
  g.r(x, top, w, bottom - top + 1, ramp[2]).r(x, top, 1, bottom - top + 1, ramp[3]).r(x + w - 1, top, 1, bottom - top + 1, ramp[1]);
  g.r(x - 1, bottom, w + 2, 1, ramp[1]).p(x - 2, bottom, ramp[1]).p(x + w + 1, bottom, ramp[0]);
  if (birch) for (let y = top + 1; y < bottom; y += 3) g.r(x + ((y * 5) % 2), y, 2, 1, R.ink[2]);
  else for (let y = top + 2; y < bottom; y += 4) g.p(x + 1 + (y % 2), y, ramp[1]);
}
function branches(g, cx, top, base, ramp, seed, snow) {
  const br = ramp[1];
  const arms = [[-1, 0.3, -7, -5], [1, 0.45, 7, -6], [-1, 0.6, -5, -8], [1, 0.15, 5, -4], [0, 0.05, 0, -6]];
  for (const [side, at, dx, dy] of arms) {
    const y0 = Math.round(base - (base - top) * (0.3 + at));
    const x1 = cx + dx + Math.round((rnd(seed, dx) - 0.5) * 3), y1 = y0 + dy;
    g.line(cx + (side > 0 ? 1 : 0), y0, x1, y1, br);
    g.line(x1, y1, x1 + side * 2, y1 - 2, br);
    if (snow) g.p(x1, y1 - 1, SNOW[3]).p(x1 + side, y1 - 1, SNOW[2]);
  }
}

// ---- broadleaf: oak and birch (32×44) ----
function broadleaf(kind, season, v) {
  const g = new Pix(32, 44);
  const birch = kind === 'birch';
  const bark = birch ? R.white : R.wood;
  const base = 40;
  trunk(g, birch ? 15 : 14, 22, base, birch ? 3 : 4, bark, birch);
  if (season === 3) {
    branches(g, 16, 6, 30, bark, v, true);
    return finishObj(g, 16, 40, 7);
  }
  const ramp = season === 0 ? (birch ? SPRING.map((c, i) => [R.leaf[0], R.leaf[1], '#5aa646', '#8ccc5e', '#c4ea8a'][i]) : SPRING) : season === 1 ? (birch ? BIRCH_SUMMER : SUMMER) : AUTUMN[v % 3];
  const s = v * 17;
  const lay = birch
    ? [[16, 9, 6], [12, 15, 6], [20, 15, 6], [16, 20, 7], [16, 13, 6]]
    : [[10, 19, 6], [22, 19, 6], [16, 22, 6], [11, 11, 6], [21, 11, 6], [16, 8, 7], [16, 15, 8]];
  for (const [x, y, r] of lay) clump(g, x + Math.round((rnd(s, x) - 0.5) * 2), y + Math.round((rnd(s, y) - 0.5) * 2), r - (v % 2), ramp, s + x);
  if (season === 0) for (let i = 0; i < 8; i++) g.p(6 + Math.floor(rnd(s, i, 1) * 20), 4 + Math.floor(rnd(s, i, 2) * 20), i % 2 ? R.pink[3] : R.white[3]);
  if (season === 1 && !birch && v % 3 === 0) for (const [x, y] of [[10, 14], [20, 10], [22, 20], [14, 21]]) g.p(x, y, R.red[2]).p(x, y - 1, R.red[3]);
  return finishObj(g, 16, 40, 9);
}

// ---- pine (28×48) ----
function pine(season, v) {
  const g = new Pix(28, 48);
  trunk(g, 12, 36, 44, 4, R.wood);
  const ramp = ['#122a20', '#1c4430', '#2a623c', '#3e824a', '#62a85a'];
  const tiers = [[2, 5], [8, 8], [15, 10], [23, 12], [31, 13]];
  const lean = (v % 3) - 1;
  for (const [y, hw] of tiers) {
    for (let r = 0; r < 8; r++) {
      const half = Math.max(1, Math.round(hw * (r + 2) / 9));
      const yy = y + r, cx = 14 + Math.round(lean * (1 - y / 40));
      for (let dx = -half; dx <= half; dx++) {
        if (r === 7 && (dx + v) % 3 === 0) continue;               // ragged hem
        const t = dx / (half + 0.01);
        const c = t < -0.45 ? ramp[3] : t < 0.15 ? ramp[2] : t < 0.6 ? ramp[1] : ramp[0];
        g.p(cx + dx, yy, r === 0 && t < 0.2 ? ramp[4] : c);
      }
      if (season === 3 && r <= 1) for (let dx = -half; dx <= half - 1; dx++) g.p(14 + Math.round(lean * (1 - y / 40)) + dx, yy, r ? SNOW[2] : SNOW[3]);
    }
  }
  if (season === 3) for (let i = 0; i < 6; i++) g.p(5 + Math.floor(rnd(v, i) * 18), 10 + i * 5, SNOW[3]);
  return finishObj(g, 14, 44, 7);
}

// ---- palm and jungle (36×44) ----
function palm(season, v) {
  const g = new Pix(36, 44);
  const bend = v % 2 ? 1 : -1;
  for (let i = 0; i < 26; i++) {
    const y = 41 - i, x = 17 + Math.round(Math.sin(i / 9) * 3 * bend);
    g.r(x, y, 3, 1, i % 3 === 0 ? R.wood[1] : R.ochre[1]).p(x, y, R.ochre[2]);
  }
  const top = 15, tx = 18 + Math.round(Math.sin(26 / 9) * 3 * bend);
  const fr = ['#163a24', '#235a30', '#378a3c', '#5cb04a', '#94d266'];
  const fronds = [[-14, 4], [-11, -4], [-4, -9], [5, -9], [12, -4], [15, 4], [-8, 8], [8, 8]];
  for (const [fx, fy] of fronds) {
    for (let t = 0; t <= 12; t++) {
      const u = t / 12, x = tx + Math.round(fx * u), y = top + Math.round(fy * u + u * u * 7);
      g.p(x, y, fr[2]).p(x, y - 1, fr[3]).p(x, y + 1, u > 0.5 ? fr[1] : fr[2]);
      if (t % 2 === 0 && u > 0.2) g.p(x, y + 2, fr[1]);
    }
  }
  g.r(tx - 2, top + 1, 4, 3, R.wood[1]).p(tx - 1, top + 1, R.wood[3]).p(tx + 1, top + 2, R.wood[2]);
  return finishObj(g, 18, 41, 7);
}
function jungle(season, v) {
  const g = new Pix(36, 44);
  trunk(g, 16, 24, 40, 5, R.wood);
  g.line(14, 40, 11, 42, R.wood[1]).line(21, 40, 24, 42, R.wood[1]);
  const ramp = ['#0e2a1c', '#174a2a', '#226a32', '#36903c', '#62b44c'];
  const s = v * 13;
  for (const [x, y, r] of [[8, 18, 7], [28, 18, 7], [18, 20, 8], [12, 10, 8], [24, 10, 8], [18, 7, 7]]) clump(g, x, y, r, ramp, s + x);
  for (const x of [9, 15, 23, 27]) { const len = 4 + Math.floor(rnd(s, x) * 6); g.line(x, 24, x + (x % 2), 24 + len, '#2e7a32'); g.p(x + (x % 2), 24 + len, ramp[3]); }
  if (v % 2) for (const [x, y, c] of [[11, 8, R.pink[2]], [24, 13, R.gold[3]], [19, 4, R.red[3]]]) g.p(x, y, c).p(x + 1, y, c);
  return finishObj(g, 18, 40, 9);
}
function dead(season, v) {
  const g = new Pix(24, 28);
  const bark = ['#2a2024', '#4a3c38', '#6a5a50', '#8a7a6c'];
  trunk(g, 10, 10, 24, 3, bark);
  for (const [x0, y0, x1, y1] of [[10, 13, 4, 8], [4, 8, 3, 4], [12, 11, 18, 6], [18, 6, 20, 2], [11, 10, 10, 3], [6, 10, 2, 11]]) g.line(x0, y0 + (v % 2), x1, y1 + (v % 2), bark[1]);
  if (season === 3) for (const [x, y] of [[3, 3], [4, 7], [20, 1], [17, 5], [10, 2]]) g.p(x, y + (v % 2), SNOW[3]);
  return finishObj(g, 12, 24, 5);
}

// ---- nature ----
const ROCK = R.stone;
function bush(season, v) {
  const g = new Pix(20, 16);
  const ramp = season === 2 ? AUTUMN[v % 3] : season === 3 ? ['#2a3830', '#465a4c', '#6a7c6c', '#8e9c8a', '#b4c0b0'] : season === 0 ? SPRING : SUMMER;
  clump(g, 7, 8, 5, ramp, v); clump(g, 13, 8, 5, ramp, v + 3); clump(g, 10, 6, 5, ramp, v + 7);
  if (season === 0) for (const [x, y] of [[6, 5], [12, 4], [14, 9], [8, 9]]) g.p(x, y, R.gold[3]);
  if (season === 1 && v % 2) for (const [x, y] of [[7, 7], [13, 6], [11, 10]]) g.p(x, y, R.red[2]);
  if (season === 3) g.r(6, 2, 8, 1, SNOW[3]).r(5, 3, 3, 1, SNOW[2]);
  return finishObj(g, 10, 12, 7, 1);
}
function rock(season, v) {
  const g = new Pix(20, 16);
  const sh = [[10, 8, 7, 5], [9, 8, 6, 5], [11, 9, 7, 4]][v % 3];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {
    const nx = (x - sh[0]) / sh[2], ny = (y - sh[1]) / sh[3];
    if (nx * nx + ny * ny > 1 || y > 12) continue;
    const facet = x + y * 0.6 < sh[0] + 3 ? (y < sh[1] - 1 ? 4 : 3) : y < sh[1] ? 2 : 1;
    g.p(x, y, ROCK[facet]);
  }
  g.line(sh[0] + 1, sh[1] - 2, sh[0] + 3, sh[1] + 2, ROCK[1]);
  if (season === 3) g.r(sh[0] - 4, sh[1] - sh[3] + 1, 7, 1, SNOW[3]).r(sh[0] - 3, sh[1] - sh[3] + 2, 4, 1, SNOW[2]);
  if (season === 1 && v === 2) g.p(sh[0] - 3, 11, R.leaf[3]).p(sh[0] - 2, 11, R.leaf[2]);
  return finishObj(g, 10, 12, 7, 1);
}
function mound(season) {
  const g = new Pix(32, 20);
  const ramp = season === 3 ? SNOW : season === 2 ? ['#4a4a1e', '#7a7a2e', '#a8a046', '#ccc46a'] : ['#2e4a1e', '#4e7a2e', '#7aa846', '#a8cc66'];
  for (let y = 2; y < 17; y++) for (let x = 1; x < 31; x++) {
    const nx = (x - 16) / 15, ny = (y - 17) / 14;
    if (nx * nx + ny * ny > 1) continue;
    const l = -0.55 * nx - 0.8 * ny - 0.6;
    g.p(x, y, ramp[l > 0.15 ? 3 : l > -0.15 ? 2 : l > -0.45 ? 1 : 0]);
  }
  if (season !== 3) { g.p(20, 12, R.stone[3]).p(21, 12, R.stone[2]); for (const x of [8, 13, 24]) g.p(x, 6 + (x % 3), ramp[3]); }
  g.outline(INK);
  return g;
}
function peak(snowy, season, v) {
  const g = new Pix(36, 48);
  const H = [38, 30, 24, 34, 26, 42][v % 6];
  const top = 44 - H, lean = [0, 2, -2, 0, 3, -2][v % 6];
  const ramp = [R.stone, ['#36323a', '#5a545a', '#7e7878', '#a8a09a', '#cec6bc'], ['#3a3438', '#625a58', '#8c8278', '#b4a898', '#d8ccbc'], R.stone][v % 4];
  const snowLine = (snowy || season === 3 ? 0.42 : 0.18) * H;
  for (let y = 0; y < H; y++) {
    const half = Math.round(y * 0.42 + (y > 3 ? (rnd(v, y >> 1) - 0.5) * 2 : 0)) + 1, cx = 18 + Math.round(lean * (1 - y / H));
    const shoulder = y > H * 0.45 ? Math.round(Math.min(4, (y - H * 0.45) * 0.35)) : 0;     // a lower spur on one side
    for (let dx = -half - (v % 2 ? shoulder : 0); dx <= half + (v % 2 ? 0 : shoulder); dx++) {
      const t = Math.max(-1, Math.min(1, dx / half));
      let c = (dx * 7 + y * 3) % 17 === 0 ? ramp[1] : t < -0.5 ? ramp[3] : t < 0.05 ? ramp[2] : t < 0.55 ? ramp[1] : ramp[0];
      if (y < snowLine && !(y > snowLine - 3 && (dx * 3 + y + v) % 4 === 0)) c = t < 0.1 ? SNOW[3] : SNOW[1];
      g.p(cx + dx, top + y, c);
    }
    if (y > 6 && y % 5 === v % 5) g.r(cx - Math.round(y * 0.15), top + y, 3, 1, ramp[1]);
  }
  return finishObj(g, 18, 44, 14, 2);
}
function tuft(season, v) {
  const g = new Pix(14, 12);
  const c = season === 2 ? ['#6a5a1e', '#a89a3a', '#d8c868'] : season === 3 ? ['#6a7068', '#9aa298', '#c8d0c4'] : season === 0 ? ['#2e6a2a', '#5aa846', '#9ad46a'] : ['#24502a', '#3e8a3a', '#6ab84c'];
  for (const [x, h, k] of [[2, 5, 0], [4, 8, 1], [6, 6, 0], [7, 9, 1], [9, 7, 0], [11, 5, 1]]) { g.r(x + (v % 2), 11 - h, 1, h, c[k]); g.p(x + (v % 2), 11 - h, c[2]); }
  return g;
}
function pebbles(v) {
  const g = new Pix(14, 8);
  for (const [x, y, w] of [[1, 3, 4], [7, 2, 3], [10, 5, 3]]) g.r(x, y + (v % 2), w, 2, ROCK[2]).r(x, y + (v % 2), w - 1, 1, ROCK[4]).p(x + w - 1, y + 1 + (v % 2), ROCK[1]);
  g.outline(INK);
  return g;
}
function lily(v) {
  const g = new Pix(14, 8);
  g.ellipse(7, 4, 5.5, 2.5, R.leaf[3]); g.r(3, 2, 7, 1, R.leaf[4]); g.line(7, 4, 11, 3, R.leaf[1]);
  g.clear(11, 3).clear(12, 3);
  if (v % 3 === 0) g.r(8, 1, 3, 2, R.pink[3]).p(9, 1, R.white[3]).p(9, 2, R.gold[3]);
  g.outline(R.leaf[0]);
  return g;
}
function mushroom(v) {
  const g = new Pix(12, 12);
  const cap = v % 2 ? R.red : R.ochre;
  g.r(5, 6, 3, 5, R.cream[3]).r(7, 6, 1, 5, R.cream[2]);
  g.ellipse(6, 5, 4.5, 2.5, cap[2]); g.r(2, 6, 9, 1, cap[1]); g.r(3, 3, 4, 1, cap[3]);
  for (let x = 0; x < 12; x++) for (let y = 7; y < 12; y++) if (g.get(x, y) && !(x >= 5 && x <= 7)) g.clear(x, y);
  if (v % 2) g.p(4, 4, R.white[3]).p(8, 4, R.white[3]).p(6, 3, R.white[3]);
  g.outline(INK);
  return g;
}
function reeds(season, v) {
  const g = new Pix(20, 20);
  const stem = season === 3 ? ['#8a7a4a', '#b8a87a'] : season === 2 ? ['#7a7a2e', '#a8a04a'] : ['#3a6a2a', '#6a9a3a'];
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 3, h = 9 + ((i * 3 + v) % 5) * 2;
    g.r(x, 19 - h, 1, h, stem[i % 2]);
    if (i % 2 === 0) g.r(x, 19 - h, 1, 3, R.wood[1]).p(x, 18 - h, R.wood[2]);
    else g.line(x, 19 - h + 3, x + 2, 19 - h, stem[1]);
  }
  return g;
}
function cactus(v) {
  const g = new Pix(20, 28);
  const c = ['#163a24', '#2a6a34', '#46944a', '#7cbc5c'];
  g.r(8, 4, 5, 20, c[2]).r(8, 4, 1, 20, c[3]).r(12, 4, 1, 20, c[1]).r(9, 3, 3, 1, c[2]);
  g.r(3, 10, 3, 7, c[2]).r(3, 10, 1, 7, c[3]).r(3, 16, 5, 2, c[2]);
  g.r(15, 8, 3, 6, c[1]).r(13, 13, 5, 2, c[1]);
  for (let y = 6; y < 23; y += 3) g.p(10, y, c[1]);
  if (v % 2) g.r(9, 1, 3, 2, R.pink[2]).p(10, 1, R.gold[3]);
  return finishObj(g, 10, 24, 6, 1);
}
function flowersObj(v) {
  const g = new Pix(16, 12);
  const cols = [R.gold[3], R.white[3], R.pink[2], R.blue[3], R.red[3]];
  for (let i = 0; i < 5; i++) {
    const x = 1 + ((i * 3 + v * 2) % 13), y = 3 + ((i * 5 + v) % 6);
    g.r(x, y + 1, 1, 3, R.leaf[2]); g.p(x, y, cols[(i + v) % 5]).p(x - 1, y, cols[(i + v) % 5]).p(x + 1, y, cols[(i + v) % 5]).p(x, y - 1, cols[(i + v) % 5]).p(x, y, R.gold[2]);
  }
  return g;
}

// ---- sheets ----
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
function seasonal(draw, variants) {
  const frames = [], tags = [];
  SEASONS.forEach((name, s) => { const a = frames.length; for (let v = 0; v < variants; v++) frames.push(draw(s, v)); tags.push([name, a, frames.length - 1, 1000]); });
  return { frames, tags };
}
const plain = (draw, variants) => ({ frames: Array.from({ length: variants }, (_, v) => draw(v)), tags: [] });

export const NATURE = {
  tree_oak: () => seasonal((s, v) => broadleaf('oak', s, v), 3),
  tree_birch: () => seasonal((s, v) => broadleaf('birch', s, v), 3),
  tree_pine: () => seasonal(pine, 3),
  tree_palm: () => seasonal(palm, 2),
  tree_jungle: () => seasonal(jungle, 2),
  tree_dead: () => seasonal(dead, 2),
  nature_bush: () => seasonal(bush, 3),
  nature_rock: () => seasonal(rock, 3),
  nature_mound: () => seasonal((s) => mound(s), 1),
  nature_peak: () => seasonal((s, v) => peak(false, s, v), 6),
  nature_peak_snow: () => seasonal((s, v) => peak(true, s, v), 6),
  nature_tuft: () => seasonal(tuft, 2),
  nature_pebbles: () => plain(pebbles, 2),
  nature_lily: () => plain(lily, 3),
  nature_mushroom: () => plain(mushroom, 2),
  nature_reeds: () => seasonal(reeds, 2),
  nature_cactus: () => plain(cactus, 2),
  nature_flowers: () => plain(flowersObj, 4),
};
