import { selectiveOutline, slot } from './pixelkit.js';
import { fromSheet } from '../sprites.js';
const TREES = new Set(['oak', 'birch', 'pine', 'palm', 'jungle', 'dead']);
const SEASON_TAGS = ['spring', 'summer', 'autumn', 'winter'];
// Phase 13 — close-up terrain at 16×16 pixels per tile. The world is rendered in chunks
// (16×16 tiles each) that are baked once per season state and cached. Ground textures
// blend softly between biomes; trees, rocks, hills and mountains are standing sprites
// with outlines and shadows, sorted so taller things overlap the tiles above them.
import { B, BIOMES } from '../data/biomes.js';
import { hash2 } from '../core/rng.js';
import { TILE } from './terrain.js';
import { makeCanvas } from './sprites.js';

export const T16 = 16;
export const CHUNK = 16; // tiles per chunk side
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Phase 20: smooth value noise (bilinear over a hash grid) and a 4×4 Bayer matrix for dithering
const sm = (t) => t * t * (3 - 2 * t);
// a 256×256 lattice of random values, made once; seeds shift where in it we read
const LAT = new Float32Array(65536);
for (let i = 0; i < 65536; i++) LAT[i] = hash2(i & 255, i >> 8, 7919);
const lat = (ix, iy) => LAT[(ix & 255) | ((iy & 255) << 8)];
function vn(x, y, sc, seed) {
  const fx = x / sc + seed * 17.13, fy = y / sc + seed * 29.71, ix = Math.floor(fx), iy = Math.floor(fy);
  const ux = sm(fx - ix), uy = sm(fy - iy);
  const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(x & 3) + ((y & 3) << 2)];
// pick from a ramp at position t (0..1) with ordered dithering between neighbouring tones
function dith(r, t, x, y) {
  const pos = clamp(t, 0, 0.9999) * (r.length - 1);
  const i = Math.floor(pos);
  return r[Math.min(r.length - 1, i + (pos - i > bayer(x, y) ? 1 : 0))];
}

// ---------- colour helpers ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
// Pixel-art ramp: shadows drift toward violet-blue, highlights toward warm yellow.
export function ramp(base) {
  const c = typeof base === 'string' ? hex(base) : base;
  return {
    outline: mix(c, [20, 12, 28], 0.78),
    dk2: mix(c, [40, 30, 70], 0.5),
    dk: mix(c, [50, 40, 90], 0.26),
    mid: c,
    lt: mix(c, [255, 240, 170], 0.22),
    hi: mix(c, [255, 250, 210], 0.45),
  };
}

// ---------- ground palettes per biome (summer) ----------
const GROUND = {
  [B.GRASS]: ['#5fae45', '#4f9a3c', '#73c052', '#3f8433'],
  [B.PLAINS]: ['#a9bb4f', '#98aa44', '#bccb62', '#86973c'],
  [B.FOREST]: ['#3f8a3a', '#357a33', '#4c9a44', '#2c6a2d'],
  [B.JUNGLE]: ['#2f7d3a', '#276d33', '#3a9046', '#1f5c2b'],
  [B.TAIGA]: ['#4b7a5a', '#3f6c4f', '#5a8a66', '#335c44'],
  [B.DESERT]: ['#e8c47a', '#dcb468', '#f2d48e', '#cfa45c'],
  [B.BEACH]: ['#efd796', '#e4c984', '#f7e4aa', '#d8bb78'],
  [B.TUNDRA]: ['#9aa889', '#8a987a', '#aab79a', '#7a886c'],
  [B.SNOW]: ['#eef3f8', '#dfe8f2', '#ffffff', '#cbd8e8'],
  [B.HILLS]: ['#8faa52', '#7f9a48', '#a0bb62', '#6e8a3e'],
  [B.MOUNTAIN]: ['#8f8a84', '#7d7872', '#a29d96', '#6a6560'],
  [B.SWAMP]: ['#55764f', '#4a6845', '#62855a', '#3e5a3b'],
};
const WATER = { [B.DEEP]: ['#1b4a8a', '#173f78'], [B.OCEAN]: ['#2563ad', '#1f579a'], [B.SHALLOW]: ['#3a8ccc', '#3480bf'], [B.LAKE]: ['#3f90cf', '#3684c2'] };
const AUTUMN = { [B.GRASS]: ['#9aa648', '#8a963e', '#b0b456', '#78843a'], [B.PLAINS]: ['#c2b25a', '#b2a24e', '#d2c26a', '#a09044'], [B.FOREST]: ['#7a7a3a', '#6a6a33', '#8a8a44', '#5a5a2c'], [B.HILLS]: ['#a6a052', '#969048', '#b6b062', '#86803e'] };
const SNOWG = ['#eef3f8', '#e2eaf3', '#ffffff', '#cdd9e7'];
const PAL = {};
const pal = (list) => list.map(hex);
for (const k in GROUND) PAL[k] = pal(GROUND[k]);
const PAL_A = {}; for (const k in AUTUMN) PAL_A[k] = pal(AUTUMN[k]);
const PAL_S = pal(SNOWG);
const PAL_W = {}; for (const k in WATER) PAL_W[k] = pal(WATER[k]);
// five-tone ramps for painterly, dithered ground: darkest, dark, base, light, sunlit
const ramp5 = (p) => [mix(p[3], [40, 34, 80], 0.18), p[1], p[0], p[2], mix(p[2], [255, 244, 190], 0.28)];
const R5 = {}; for (const k in PAL) R5[k] = ramp5(PAL[k]);
const R5A = {}; for (const k in PAL_A) R5A[k] = ramp5(PAL_A[k]);
const R5S = ramp5(PAL_S);
// water by depth: turquoise shallows to navy deeps (lakes a little greener)
const SEA5 = pal(['#6cc6d6', '#45a2d4', '#2f7fc0', '#2464a8', '#1b4b8c', '#163e78']);
const LAKE5 = pal(['#6ac2c8', '#4aa2c8', '#3a88c0', '#2f72ac']);
const MUD = hex('#3e5236'), POOL = hex('#3f6f78'), POOLHI = hex('#7fb0b0');

// season: 0 spring, 1 summer, 2 autumn, 3 winter; snow: 0 none, 1 cold lands, 2 deep winter
export function seasonKey(day) {
  const m = Math.floor((day % 360) / 30);
  const season = m <= 1 || m === 11 ? 3 : m <= 4 ? 0 : m <= 7 ? 1 : 2;
  const snow = m === 0 || m === 11 ? 2 : m === 1 || m === 10 ? 1 : 0;
  return { season, snow, key: season * 3 + snow };
}

// ---------- standing objects ----------
const objCache = new Map();
function canvasOf(w, h, draw) { const c = makeCanvas(w, h); draw(c.getContext('2d')); return c; }
function P(ctx, x, y, w, h, c) { ctx.fillStyle = typeof c === 'string' ? c : css(c); ctx.fillRect(x, y, w, h); }
function blob(ctx, cx, cy, rx, ry, R, light = true) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (d > 1) continue;
    const l = light ? (-x - y) / (rx + ry) : 0;
    const c = d > 0.82 ? R.dk : l > 0.35 ? R.hi : l > 0.05 ? R.lt : l < -0.4 ? R.dk : R.mid;
    P(ctx, cx + x, cy + y, 1, 1, c);
  }
}
function outline(ctx, w, h, col = [26, 16, 22]) {
  const d = ctx.getImageData(0, 0, w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d.data[(y * w + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a(x, y) < 20 && (a(x + 1, y) > 128 || a(x - 1, y) > 128 || a(x, y + 1) > 128 || a(x, y - 1) > 128)) out.push((y * w + x) * 4);
  void out; void col;
  selectiveOutline(d, w, h, 128, 20, 230); // Phase 20: coloured outlines
  ctx.putImageData(d, 0, 0);
}
function shadow(ctx, cx, cy, rx, ry, a = 0.28) {
  ctx.fillStyle = `rgba(20,16,30,${a})`;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01))); ctx.fillRect(cx - w, cy + y, w * 2, 1); }
}
// kind: oak, birch, pine, palm, jungle, bush, rock, mound, peak, peak_snow, reeds, cactus, flowers, dead
export function objectSprite(kind, season = 1, v = 0) {
  const key = `${kind}:${season}:${v}`;
  if (objCache.has(key)) return objCache.get(key);
  let c;
  switch (kind) {
    case 'oak': case 'birch': {
      const leaf = season === 2 ? ['#d8782a', '#c8402a', '#e0b030'][v % 3] : season === 0 ? (kind === 'birch' ? '#8acb5a' : '#5fae45') : kind === 'birch' ? '#7cbc4e' : '#3f9440';
      c = canvasOf(16, 22, (x) => {
        shadow(x, 8, 20, 6, 2);
        const bark = kind === 'birch' ? ramp('#e8e2d4') : ramp('#7a5232');
        P(x, 7, 12, 3, 9, bark.mid); P(x, 7, 12, 1, 9, bark.lt); P(x, 9, 12, 1, 9, bark.dk);
        if (kind === 'birch') for (let i = 0; i < 4; i++) P(x, 7 + (i % 2), 13 + i * 2, 2, 1, '#3a3430');
        if (season === 3) {
          // bare branches with snow
          const br = bark.dk;
          P(x, 8, 5, 1, 8, br); P(x, 5, 7, 3, 1, br); P(x, 9, 6, 3, 1, br); P(x, 4, 4, 1, 3, br); P(x, 11, 3, 1, 3, br); P(x, 7, 3, 1, 3, br);
          P(x, 4, 4, 2, 1, '#f4f8fc'); P(x, 10, 3, 2, 1, '#f4f8fc'); P(x, 6, 3, 2, 1, '#f4f8fc'); P(x, 9, 6, 2, 1, '#f4f8fc');
        } else {
          const R = ramp(leaf);
          blob(x, 8, 7, 6, 5, R); blob(x, 5, 9, 3, 3, R); blob(x, 11, 9, 3, 3, R);
          if (season === 0) for (let i = 0; i < 6; i++) P(x, 3 + ((v * 3 + i * 5) % 10), 3 + ((i * 7) % 8), 1, 1, '#f6c8dc');
          if (season === 1 && kind === 'oak' && v % 3 === 0) { P(x, 5, 7, 1, 1, '#d84a3a'); P(x, 10, 5, 1, 1, '#d84a3a'); } // apples
        }
        outline(x, 16, 22);
      });
      break;
    }
    case 'pine': {
      c = canvasOf(14, 24, (x) => {
        shadow(x, 7, 22, 5, 2);
        P(x, 6, 18, 2, 4, '#5e3c22');
        const R = ramp(season === 3 ? '#2f6a4a' : '#2e7048');
        const tiers = [[7, 1, 1], [7, 4, 3], [7, 8, 4], [7, 12, 5], [7, 16, 6]];
        for (const [cx, y, hw] of tiers) for (let r = 0; r < 4; r++) {
          const half = Math.max(1, hw - 3 + r);
          for (let dx = -half; dx < half; dx++) P(x, cx + dx, y + r, 1, 1, dx < -half / 2 ? R.lt : dx >= half / 2 ? R.dk : R.mid);
          if (season === 3 && r === 0) P(x, cx - half, y + r, half * 2, 1, '#f2f6fb');
        }
        if (season === 3) for (let i = 0; i < 4; i++) P(x, 3 + ((i * 5 + v) % 8), 6 + i * 4, 2, 1, '#eef3f8');
        outline(x, 14, 24);
      });
      break;
    }
    case 'palm': {
      c = canvasOf(18, 22, (x) => {
        shadow(x, 9, 20, 5, 2);
        const tr = ramp('#9a7040');
        for (let i = 0; i < 12; i++) P(x, 9 + Math.round(Math.sin(i / 4) * 1.5), 8 + i, 2, 1, i % 3 === 0 ? tr.dk : tr.mid);
        const R = ramp('#3f9a44');
        const fronds = [[-7, 2], [-5, -2], [0, -4], [5, -2], [7, 2], [-3, 3], [3, 3]];
        for (const [fx, fy] of fronds) { for (let t = 0; t <= 6; t++) { const px0 = 9 + Math.round((fx * t) / 6), py0 = 7 + Math.round((fy * t) / 6 + (t * t) / 14); P(x, px0, py0, 2, 1, t > 4 ? R.dk : R.mid); P(x, px0, py0 - 1, 1, 1, R.lt); } }
        P(x, 8, 7, 2, 2, '#7a5a30');
        outline(x, 18, 22);
      });
      break;
    }
    case 'jungle': {
      c = canvasOf(18, 22, (x) => {
        shadow(x, 9, 20, 7, 2);
        P(x, 8, 12, 3, 9, '#5a3a22');
        const R = ramp('#2a8a3a');
        blob(x, 9, 8, 7, 6, R); blob(x, 4, 10, 3, 3, R); blob(x, 14, 10, 3, 3, R);
        for (let i = 0; i < 3; i++) P(x, 5 + i * 4, 13, 1, 4, '#3a7a2a'); // vines
        if (v % 2) { P(x, 6, 6, 1, 1, '#e84a7a'); P(x, 12, 9, 1, 1, '#f2c94c'); }
        outline(x, 18, 22);
      });
      break;
    }
    case 'bush': {
      c = canvasOf(10, 8, (x) => { shadow(x, 5, 7, 4, 1); blob(x, 5, 4, 4, 3, ramp(season === 2 ? '#b0702a' : season === 3 ? '#6a7a6a' : '#4a9a3e')); if (season === 0) P(x, 3, 2, 1, 1, '#f6e08a'); outline(x, 10, 8); });
      break;
    }
    case 'rock': {
      c = canvasOf(10, 8, (x) => { shadow(x, 5, 7, 4, 1); blob(x, 5, 4, 4, 3, ramp('#9a948c')); P(x, 3, 2, 2, 1, '#c8c2b8'); if (season === 3) P(x, 2, 1, 5, 1, '#f2f6fb'); outline(x, 10, 8); });
      break;
    }
    case 'mound': {
      c = canvasOf(16, 10, (x) => {
        const R = ramp(season === 3 ? '#e2e8f0' : season === 2 ? '#a8a052' : '#8aa852');
        for (let y = 0; y < 8; y++) { const half = Math.round(7 * Math.sqrt(1 - ((7 - y) / 7.5) ** 2)); for (let dx = -half; dx < half; dx++) P(x, 8 + dx, 1 + y, 1, 1, dx < -half / 3 ? R.lt : dx > half / 3 ? R.dk : R.mid); }
        P(x, 5, 2, 3, 1, R.hi);
        if (season !== 3) { P(x, 10, 6, 1, 1, '#c8c2b8'); P(x, 4, 7, 1, 1, R.dk); }
        outline(x, 16, 10);
      });
      break;
    }
    case 'peak': case 'peak_snow': {
      const H = [19, 15, 12, 17, 13, 21][v % 6];
      c = canvasOf(18, 24, (x) => {
        shadow(x, 9, 22, 8, 2, 0.32);
        const R = ramp(['#8a8480', '#7f7a76', '#948a7e', '#86827e'][v % 4]);
        const top = 22 - H;
        const snowLine = (kind === 'peak_snow' || season === 3 ? 0.4 : 0.16) * H;
        const lean = [0, 1, -1, 0, 2, -1][v % 6];
        for (let y = 0; y < H; y++) {
          const half = Math.round(y * 0.5) + 1;
          const cxp = 9 + Math.round(lean * (1 - y / H));
          for (let dx = -half; dx <= half; dx++) {
            let col = dx < 0 ? (dx < -half * 0.6 ? R.lt : R.mid) : dx < half * 0.4 ? R.dk : R.dk2;
            if (y < snowLine && !(y > snowLine - 2 && (dx + y + v) % 3 === 0)) col = dx < 1 ? hex('#f6f9fc') : hex('#c4d0de');
            P(x, cxp + dx, top + y, 1, 1, col);
          }
          if (y > 5 && y % 4 === (v % 4)) P(x, cxp - Math.round(y * 0.2), top + y, 2, 1, R.dk);
        }
        outline(x, 18, 24);
      });
      break;
    }
    // Phase 20: small ground detail
    case 'tuft': {
      const g = season === 2 ? ['#b0a040', '#8a7a30'] : season === 0 ? ['#8ad060', '#5aa040'] : ['#6ab848', '#3f8433'];
      c = canvasOf(7, 6, (x) => { for (const [xx, hh, k] of [[1, 3, 1], [2, 5, 0], [3, 4, 1], [4, 5, 0], [5, 3, 1]]) { P(x, xx, 6 - hh, 1, hh, g[k]); } P(x, 2, 0, 1, 1, '#d8f0a0'); });
      break;
    }
    case 'pebbles': {
      c = canvasOf(7, 4, (x) => { const R = ramp('#9a948c'); P(x, 0, 2, 3, 2, R.mid); P(x, 0, 2, 2, 1, R.lt); P(x, 4, 1, 2, 2, R.dk); P(x, 4, 1, 1, 1, R.mid); P(x, 3, 3, 4, 1, 'rgba(30,24,40,0.25)'); });
      break;
    }
    case 'mushroom': {
      c = canvasOf(6, 6, (x) => { const cap = v % 2 ? '#c84a3a' : '#c8945a'; P(x, 2, 3, 2, 3, '#efe6d0'); P(x, 0, 1, 6, 2, cap); P(x, 1, 0, 4, 1, cap); if (v % 2) { P(x, 1, 1, 1, 1, '#ffffff'); P(x, 4, 1, 1, 1, '#ffffff'); } P(x, 0, 2, 6, 1, ramp(cap).dk); });
      break;
    }
    case 'lily': {
      c = canvasOf(7, 4, (x) => { const R = ramp('#4a9a4a'); P(x, 1, 0, 5, 4, R.mid); P(x, 0, 1, 7, 2, R.mid); P(x, 1, 0, 4, 1, R.lt); P(x, 3, 1, 1, 2, R.dk); if (v % 3 === 0 && season !== 3) { P(x, 4, 0, 2, 2, '#f2a0c0'); P(x, 4, 0, 1, 1, '#fff0f6'); } });
      break;
    }
    case 'reeds': {
      c = canvasOf(10, 10, (x) => { for (let i = 0; i < 5; i++) { const xx = 1 + i * 2, h = 5 + ((i * 3 + v) % 4); P(x, xx, 9 - h, 1, h, season === 3 ? '#b8a87a' : '#7a9a3a'); P(x, xx, 9 - h, 1, 2, '#6a4a2a'); } });
      break;
    }
    case 'cactus': {
      c = canvasOf(10, 14, (x) => { shadow(x, 5, 13, 3, 1); const R = ramp('#4a9a4a'); P(x, 4, 2, 3, 11, R.mid); P(x, 4, 2, 1, 11, R.lt); P(x, 1, 5, 2, 4, R.mid); P(x, 1, 8, 3, 1, R.mid); P(x, 7, 4, 2, 4, R.dk); P(x, 6, 7, 2, 1, R.dk); if (v % 2) P(x, 5, 1, 1, 1, '#f26a8a'); outline(x, 10, 14); });
      break;
    }
    case 'flowers': {
      c = canvasOf(8, 6, (x) => { const cols = ['#f6e08a', '#f6f2f0', '#e87aa8', '#8ab0f0']; for (let i = 0; i < 4; i++) { const fx = (i * 2 + v) % 7, fy = 1 + ((i * 3 + v) % 4); P(x, fx, fy + 1, 1, 1, '#3a7a2a'); P(x, fx, fy, 1, 1, cols[(i + v) % 4]); } });
      break;
    }
    case 'dead': {
      c = canvasOf(12, 14, (x) => { shadow(x, 6, 13, 4, 1); const br = '#5a4636'; P(x, 5, 4, 2, 9, br); P(x, 2, 5, 3, 1, br); P(x, 7, 3, 3, 1, br); P(x, 2, 3, 1, 2, br); P(x, 9, 1, 1, 2, br); outline(x, 12, 14); });
      break;
    }
    default: c = canvasOf(2, 2, () => {});
  }
  c = slot('o:' + key, c, 'nature');
  c = fromSheet((TREES.has(kind) ? 'tree_' : 'nature_') + kind, SEASON_TAGS[season], v, c); // Aseprite sprite if there is one
  objCache.set(key, c);
  return c;
}

// Objects standing on a tile: [kind, x, y] in tile-local 16px coords (feet position)
function tileObjects(W, i, x, y, S, season, snowy) {
  const b = W.biome[i];
  const h = (k) => hash2(x * 7 + k, y * 13 - k, S + 91);
  const out = [];
  const warm = W.temp[i] > 0.62;
  switch (b) {
    case B.FOREST: {
      if (h(17) < (season === 2 ? 0.2 : 0.08)) out.push(['mushroom', 3 + ((h(18) * 10) | 0), 14]);
      const n = 2 + (h(1) < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) out.push([h(10 + k) < 0.15 ? 'pine' : h(20 + k) < 0.25 ? 'birch' : 'oak', 2 + ((h(30 + k) * 12) | 0), 6 + ((h(40 + k) * 10) | 0)]);
      break;
    }
    case B.JUNGLE: for (let k = 0; k < 3; k++) out.push([h(10 + k) < 0.35 ? 'palm' : 'jungle', 1 + ((h(30 + k) * 14) | 0), 5 + ((h(40 + k) * 11) | 0)]); break;
    case B.TAIGA: for (let k = 0; k < 3; k++) out.push(['pine', 2 + ((h(30 + k) * 12) | 0), 6 + ((h(40 + k) * 10) | 0)]); break;
    case B.HILLS: if (h(11) < 0.25 && season !== 3) out.push(['tuft', 2 + ((h(12) * 11) | 0), 4 + ((h(13) * 10) | 0)]); if (h(14) < 0.14) out.push(['pebbles', 3 + ((h(15) * 9) | 0), 5 + ((h(16) * 9) | 0)]); if (h(4) < 0.2) out.push(['mound', 5 + ((h(5) * 7) | 0), 9 + ((h(7) * 6) | 0)]); if (h(5) < 0.16) out.push(['rock', 3 + ((h(6) * 9) | 0), 14]); if (h(8) < 0.12) out.push(['bush', 3 + ((h(9) * 10) | 0), 6]); break;
    case B.MOUNTAIN: {
      const sn = W.height[i] > 0.78 || W.temp[i] < 0.32 ? 'peak_snow' : 'peak';
      if (h(3) < 0.12) { out.push(['rock', 5, 10]); out.push(['rock', 11, 14]); break; } // a rocky saddle
      // Phase 20: peaks only on the high summits; lower slopes are shaded rock with ridges
      const high = W.height[i] > 0.72;
      if ((high && h(9) < 0.7) || h(9) < 0.1) out.push([sn, 5 + ((h(4) * 7) | 0), 13 + ((h(5) * 4) | 0)]);
      else if (h(7) < 0.4) out.push(['pebbles', 4 + ((h(7) * 8) | 0), 10]);
      if (high && h(6) < 0.2) out.push([sn, 2 + ((h(7) * 12) | 0), 7 + ((h(8) * 4) | 0)]);
      break;
    }
    case B.SWAMP: if (h(1) < 0.6) out.push(['reeds', 2 + ((h(2) * 10) | 0), 12]); if (h(3) < 0.25) out.push(['dead', 8, 13]); if (h(11) < 0.3 && season !== 3) out.push(['tuft', 2 + ((h(12) * 11) | 0), 4 + ((h(13) * 10) | 0)]); break;
    case B.DESERT: if (h(1) < 0.06) out.push(['cactus', 6 + ((h(2) * 4) | 0), 12]); if (h(3) < 0.08) out.push(['rock', 4, 13]); break;
    case B.GRASS: case B.PLAINS:
      if (h(1) < 0.035) out.push([warm ? 'palm' : 'oak', 8, 12]);
      else if (h(2) < 0.08) out.push(['bush', 3 + ((h(3) * 10) | 0), 10 + ((h(4) * 5) | 0)]);
      if (h(5) < 0.22 && season !== 3) out.push(['flowers', 2 + ((h(6) * 10) | 0), 6 + ((h(7) * 8) | 0)]);
      if (h(8) < 0.03) out.push(['rock', 4 + ((h(9) * 8) | 0), 12]);
      if (h(11) < 0.32 && season !== 3) out.push(['tuft', 1 + ((h(12) * 12) | 0), 4 + ((h(13) * 11) | 0)]);
      if (h(14) < 0.06) out.push(['pebbles', 2 + ((h(15) * 10) | 0), 5 + ((h(16) * 10) | 0)]);
      break;
    case B.TUNDRA: if (h(1) < 0.1) out.push(['rock', 4 + ((h(2) * 8) | 0), 12]); if (h(3) < 0.05) out.push(['pine', 8, 12]); break;
    case B.SNOW: if (h(1) < 0.04) out.push(['rock', 6, 12]); break;
    default: break;
  }
  void snowy;
  return out;
}

// ---------- chunk baking ----------
export class Tiles16 {
  constructor(world) {
    this.world = world;
    this.cache = new Map();
    this.flow = null;
  }
  invalidate(tiles) {
    const W = this.world;
    if (!tiles) { this.cache.clear(); return; }
    const keys = new Set();
    for (const t of tiles) { const cx = Math.floor((t % W.w) / CHUNK), cy = Math.floor(((t / W.w) | 0) / CHUNK); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.add(`${cx + dx},${cy + dy}`); }
    for (const k of [...this.cache.keys()]) if (keys.has(k.split(':')[0])) this.cache.delete(k);
  }
  riverFlow() {
    if (this.flow) return this.flow;
    const { N, river, riverNext } = this.world;
    const flow = new Uint16Array(N);
    for (let i = 0; i < N; i++) { if (!river[i]) continue; let c = i, s = 0; while (c >= 0 && river[c] && s++ < 400) { flow[c]++; c = riverNext[c]; } }
    this.flow = flow;
    return flow;
  }
  chunk(cx, cy, sk) {
    const k = `${cx},${cy}:${sk.key}`;
    let c = this.cache.get(k);
    if (c) { this.cache.delete(k); this.cache.set(k, c); return c; }
    c = this.bake(cx, cy, sk);
    this.cache.set(k, c);
    if (this.cache.size > 140) this.cache.delete(this.cache.keys().next().value);
    return c;
  }
  bake(cx, cy, sk) { const g = this.bakeSteps(cx, cy, sk); let r; do { r = g.next(); } while (!r.done); return r.value; }
  *bakeSteps(cx, cy, sk) {
    const W = this.world;
    const { w, h, biome, temp, height, river, riverNext } = W;
    const S = W.seed & 0xffff;
    const PX = CHUNK * T16;
    const cv = makeCanvas(PX, PX);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(PX, PX);
    const d = img.data;
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    const { season, snow } = sk;
    const snowAt = (i, jit = 0) => { const t = temp[i] - Math.max(0, height[i] - 0.5) * 0.4 + jit; return biome[i] === B.SNOW || (snow >= 1 && t < 0.42) || (snow >= 2 && t < 0.6); };
    const isW = (i) => BIOMES[biome[i]].water;
    // Phase 20: which tile a pixel belongs to — the tile grid warped by smooth noise, so biome
    // edges wander in coherent, hand-drawn-looking curves instead of pixel static
    const warpTile = (gx, gy) => {
      const wx = (vn(gx, gy, 15, S + 21) - 0.5) * 17 + (vn(gx, gy, 5, S + 27) - 0.5) * 6 + (hash2(gx >> 1, gy >> 1, S + 1) - 0.5) * 1.5;
      const wy = (vn(gx, gy, 15, S + 22) - 0.5) * 17 + (vn(gx, gy, 5, S + 28) - 0.5) * 6 + (hash2(gy >> 1, gx >> 1, S + 2) - 0.5) * 1.5;
      return clamp(((gy + wy) / T16) | 0, 0, h - 1) * w + clamp(((gx + wx) / T16) | 0, 0, w - 1);
    };
    // light from the upper left on the smoothed height field: lit slopes and shaded hollows
    const Hs = (fx, fy) => {
      const x = clamp(fx / T16 - 0.5, 0, w - 1.001), y = clamp(fy / T16 - 0.5, 0, h - 1.001);
      const ix = x | 0, iy = y | 0, ux = x - ix, uy = y - iy, i0 = iy * w + ix;
      const a = Math.max(0, height[i0]), b2 = Math.max(0, height[i0 + 1]), c = Math.max(0, height[i0 + w]), dd = Math.max(0, height[i0 + w + 1]);
      return (a + (b2 - a) * ux) + ((c + (dd - c) * ux) - (a + (b2 - a) * ux)) * uy;
    };
    const hillshade = (gx, gy) => clamp((Hs(gx - 5, gy - 5) - Hs(gx + 5, gy + 5)) * 5.5, -0.32, 0.32);
    // --- ground pass (per pixel, jittered sampling for organic biome edges)
    const anySnow = snow > 0;
    const objectsOnly = !!this.objectsOnly; // Phase 22: the GPU paints the ground; only rivers and standing things are baked
    for (let py = 0; py < (objectsOnly ? 0 : PX); py++) {
      if ((py & 31) === 0 && py) yield null; // spread the work over several frames
      let j1 = 0, j2 = 0;
      for (let px = 0; px < PX; px++) {
        const gx = tx0 * T16 + px, gy = ty0 * T16 + py;
        if (!(px & 1)) j1 = warpTile(gx, gy); // the warp is smooth: once per 2 px is plenty
        const i = j1; void j2;
        const sx = i % w, sy = (i / w) | 0;
        const b = biome[i];
        let col;
        const n = hash2(gx, gy, S + 3);
        if (isW(i)) {
          const p = PAL_W[b] || PAL_W[B.OCEAN];
          // depth blended between tile centres so the sea has no tile blocks
          const fx = gx / T16 - 0.5, fy = gy / T16 - 0.5;
          const ix = clamp(Math.floor(fx), 0, w - 2), iy = clamp(Math.floor(fy), 0, h - 2);
          const ux = clamp(fx - ix, 0, 1), uy = clamp(fy - iy, 0, 1);
          const H = (xx, yy) => height[yy * w + xx];
          const hh = (H(ix, iy) * (1 - ux) + H(ix + 1, iy) * ux) * (1 - uy) + (H(ix, iy + 1) * (1 - ux) + H(ix + 1, iy + 1) * ux) * uy;
          const depth = clamp(-hh * 1.3 + (n - 0.5) * 0.06, 0, 1);
          const shallow = PAL_W[B.SHALLOW], deep = PAL_W[B.DEEP];
          void p; void shallow; void deep;
          // Phase 20: banded depth with dithered steps, and light ripples of sand under the shallows
          col = b === B.LAKE ? dith(LAKE5, depth * 1.1, gx, gy) : dith(SEA5, Math.pow(depth, 0.8) * 1.05 + (vn(gx, gy, 14, S + 30) - 0.5) * 0.08, gx, gy);
          if (depth < 0.16 && b !== B.LAKE) { const cs = Math.abs(vn(gx, gy, 5, S + 31) - vn(gx + 9, gy - 4, 5, S + 32)); if (cs < 0.035) col = mix(col, [190, 236, 236], 0.45); }
          // gentle wave strokes
          const wv = Math.sin(gx * 0.45 + gy * 0.9 + (sy * 3.1) % 6) + Math.sin(gx * 0.17 - gy * 0.31);
          const wh = hash2(sx, sy, S + 12);
          if (wv > 1.72 + wh * 0.2 && hash2(gx >> 2, gy, S + 13) < 0.6) col = mix(col, [230, 245, 255], 0.2);
          if (b === B.LAKE && snow >= 2 && temp[i] < 0.38) col = mix(col, [220, 236, 248], 0.75); // frozen
        } else {
          let p = PAL[b] || PAL[B.GRASS];
          let r5 = R5[b] || R5[B.GRASS];
          if (season === 2 && PAL_A[b]) { p = PAL_A[b]; r5 = R5A[b]; }
          let snowy = false;
          if (anySnow || b === B.SNOW) { const sj = (vn(gx, gy, 11, S + 14) - 0.5) * 0.2 + (vn(gx, gy, 4, S + 15) - 0.5) * 0.06; if (snowAt(i, sj)) { p = PAL_S; r5 = R5S; snowy = true; } }
          // Phase 20: painterly ground — large soft patches, medium clumps and the slope's light,
          // all dithered through a five-tone ramp (no per-pixel static)
          const big = vn(gx, gy, 22, S + 23), med = vn(gx, gy, 6, S + 24);
          const slope = hillshade(gx, gy);
          let t = 0.52 + (big - 0.5) * 0.5 + (med - 0.5) * 0.34 + slope;
          if (b === B.MOUNTAIN || b === B.HILLS) {
            // ridges: thin crests catch the light, their far sides fall into shadow
            const rs = b === B.MOUNTAIN ? 1 : 0.5;
            const crest = Math.abs(vn(gx, gy, 11, S + 50) - 0.5), back = Math.abs(vn(gx + 3, gy + 3, 11, S + 50) - 0.5);
            if (crest < 0.035) t += 0.3 * rs; else if (back < 0.035) t -= 0.32 * rs;
            if (b === B.MOUNTAIN) t += (vn(gx, gy, 3, S + 26) - 0.5) * 0.25; // broken rock
          }
          col = dith(r5, t, gx, gy);
          if (b === B.DESERT || b === B.BEACH) { const r = Math.sin(gx * 0.35 + Math.sin(gy * 0.2) * 2 + gy * 0.12); if (r > 0.93) col = p[2]; else if (r < -0.95) col = p[3]; }
          // grass blades: a lit tip over a dark root, here and there
          if ((b === B.GRASS || b === B.PLAINS || b === B.HILLS || b === B.FOREST) && !snowy) { const tb = hash2(gx, gy, S + 6); if (tb < 0.02) col = r5[4]; else if (tb < 0.032 && py > 0) col = r5[1]; }
          // marsh pools: smooth shapes with a muddy rim and a glint of sky
          if (b === B.SWAMP && !snowy) { const pv = vn(gx, gy, 5, S + 7) * 0.7 + vn(gx, gy, 13, S + 8) * 0.3; if (pv > 0.6) col = pv > 0.66 && hash2(gx, gy >> 1, S + 9) < 0.05 ? POOLHI : POOL; else if (pv > 0.57) col = MUD; }
        }
        const o = (py * PX + px) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    yield null;
    // --- shorelines (per pixel, following the jittered coast): wet sand on land, foam on water
    const sand = hex('#f0dca2'), wet = hex('#d2bd84'), foam = [238, 247, 255];
    const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= PX || y >= PX) return; const o = (y * PX + x) * 4; if (!d[o + 3]) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.round(a * 255); return; } d[o] = d[o] * (1 - a) + c[0] * a; d[o + 1] = d[o + 1] * (1 - a) + c[1] * a; d[o + 2] = d[o + 2] * (1 - a) + c[2] * a; d[o + 3] = Math.max(d[o + 3], Math.round(a * 255)); };
    const sampleAt = warpTile;
    // only tiles on (or next to) a coastline need the per-pixel pass
    const coastal = new Uint8Array(CHUNK * CHUNK);
    for (let ty = 0; ty < CHUNK; ty++) for (let tx = 0; tx < CHUNK; tx++) {
      const gx = tx0 + tx, gy = ty0 + ty;
      if (gx >= w || gy >= h) continue;
      const wv = isW(gy * w + gx);
      outer: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x2 = gx + dx, y2 = gy + dy;
        if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
        if (isW(y2 * w + x2) !== wv) { coastal[ty * CHUNK + tx] = 1; break outer; }
      }
    }
    for (let py = 0; py < (objectsOnly ? 0 : PX); py++) {
      if ((py & 63) === 0 && py) yield null;
      for (let px = 0; px < PX; px++) {
        if (!coastal[(py >> 4) * CHUNK + (px >> 4)]) continue;
        const gx = tx0 * T16 + px, gy = ty0 * T16 + py;
        const i = sampleAt(gx, gy);
        const water = isW(i);
        let near = 99;
        for (const [ox, oy, dist] of [[2, 0, 2], [-2, 0, 2], [0, 2, 2], [0, -2, 2], [4, 0, 4], [-4, 0, 4], [0, 4, 4], [0, -4, 4], [3, 3, 4], [-3, -3, 4], [3, -3, 4], [-3, 3, 4]]) {
          if (dist >= near) continue;
          const j = sampleAt(gx + ox, gy + oy);
          if (isW(j) !== water) near = dist;
        }
        if (near === 99) continue;
        if (water) { if (biome[i] === B.LAKE && snow >= 2 && temp[i] < 0.38) continue; put(px, py, foam, near <= 2 ? 0.55 : 0.18); }
        else if (biome[i] !== B.SNOW && !snowAt(i) && biome[i] !== B.SWAMP && biome[i] !== B.MOUNTAIN) put(px, py, near <= 2 ? wet : sand, 0.92);
      }
    }
    // --- rivers: banked channels through tile centres
    const flow = this.riverFlow();
    const rc = hex('#3d8fd0'), rl = hex('#7cc0ec'), bank = hex('#8a7a52');
    const centre = (t) => [(t % w - tx0) * T16 + 8 + (((hash2(t % w, (t / w) | 0, S + 9) * 3) | 0) - 1), (((t / w) | 0) - ty0) * T16 + 8 + (((hash2((t / w) | 0, t % w, S + 10) * 3) | 0) - 1)];
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const i = ty * w + tx;
      if (!river[i] || riverNext[i] < 0) continue;
      const a = centre(i), nx = riverNext[i];
      const bpt = isW(nx) ? [(nx % w - tx0) * T16 + 8, (((nx / w) | 0) - ty0) * T16 + 8] : centre(nx);
      const wd = flow[i] > 30 ? 4 : flow[i] > 10 ? 3 : 2.5;
      const frozen = snow >= 2 && snowAt(i);
      // Phase 16: meander — a sideways bow along each segment (zero at both ends, so joins stay continuous)
      const sdx = bpt[0] - a[0], sdy = bpt[1] - a[1], sl = Math.hypot(sdx, sdy) || 1;
      const amp = (hash2(tx, ty, S + 11) - 0.5) * 6;
      const fall = !frozen && (biome[i] === B.MOUNTAIN || biome[i] === B.HILLS) && biome[nx] !== B.MOUNTAIN && biome[nx] !== B.HILLS && !isW(nx);
      for (let s = 0; s <= 32; s++) {
        const t = s / 32;
        const bow = Math.sin(t * Math.PI) * amp;
        const x = Math.round(a[0] + sdx * t - (sdy / sl) * bow), y = Math.round(a[1] + sdy * t + (sdx / sl) * bow);
        if (fall && s >= 14 && s <= 20) { // waterfall: white water and spray
          for (let dy = -wd - 1; dy <= wd + 1; dy++) for (let dx = -wd - 1; dx <= wd + 1; dx++) if (dx * dx + dy * dy <= (wd + 1) * (wd + 1) && hash2(x + dx, y + dy, S + 12) < 0.7) put(x + dx, y + dy, [236, 246, 252], 1);
          continue;
        }
        for (let dy = -wd; dy <= wd; dy++) for (let dx = -wd; dx <= wd; dx++) {
          const r2 = dx * dx + dy * dy;
          if (r2 > wd * wd + 1) continue;
          put(x + dx, y + dy, r2 > (wd - 1) * (wd - 1) + 1 ? bank : frozen ? [214, 232, 246] : rc, r2 > (wd - 1) * (wd - 1) + 1 ? 0.3 : 1);
        }
        if ((s & 7) === 0) put(x - 1, y - 1, frozen ? [250, 252, 255] : rl, 1);
      }
    }
    ctx.putImageData(img, 0, 0);
    yield null;
    // --- standing objects, sorted by their feet (y) so lower ones overlap upper ones
    const objs = [];
    for (let ty = ty0; ty < ty0 + CHUNK + 2; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const i = ty * w + tx;
      if (isW(i)) {
        // Phase 20: lily pads in lake shallows
        if (biome[i] === B.LAKE && !(snow >= 2 && temp[i] < 0.38) && hash2(tx, ty, S + 41) < 0.35 && [i - 1, i + 1, i - w, i + w].some((j) => j >= 0 && j < W.N && !isW(j))) {
          for (let k = 0; k < 2; k++) objs.push([(ty - ty0) * T16 + 4 + ((hash2(tx, ty + k, S + 42) * 9) | 0), (tx - tx0) * T16 + 3 + ((hash2(tx + k, ty, S + 43) * 10) | 0), objectSprite('lily', season, (hash2(tx, ty, S + 44 + k) * 6) | 0), true]);
        }
        continue;
      }
      for (const [kind, ox, oy] of tileObjects(W, i, tx, ty, S, season, snowAt(i))) {
        const kk = kind === 'oak' || kind === 'birch' || kind === 'pine' || kind === 'bush' || kind === 'mound' || kind === 'peak' ? kind : kind;
        const winterTree = (kind === 'oak' || kind === 'birch') && season === 3 && temp[i] > 0.62 ? 1 : season;
        const spr = objectSprite(kk, kind === 'pine' && snowAt(i) ? 3 : winterTree, (hash2(tx + ox, ty + oy, S + 17) * 6) | 0);
        objs.push([(ty - ty0) * T16 + oy, (tx - tx0) * T16 + ox, spr]);
      }
    }
    objs.sort((a, b) => (a[3] ? -1 : 0) - (b[3] ? -1 : 0) || a[0] - b[0]);
    // Phase 20: trees and rocks at the water's edge are mirrored in it (faint, squashed, broken by ripples)
    for (const [fy, fx, spr, flat] of objs) {
      if (flat || spr.height < 12) continue;
      const tx = tx0 + Math.floor(fx / T16), ty = ty0 + Math.floor(fy / T16);
      if (ty + 1 >= h || tx < 0 || tx >= w || !isW((ty + 1) * w + tx)) continue;
      ctx.save(); ctx.globalAlpha = 0.28;
      for (let yy = 0; yy < spr.height; yy += 2) { const sh = (yy >> 1) % 2 ? 1 : 0; ctx.drawImage(spr, 0, spr.height - 1 - yy, spr.width, 1, Math.round(fx - spr.width / 2) + sh, Math.round(fy + 2 + yy * 0.6), spr.width, 1); }
      ctx.restore();
    }
    for (const [fy, fx, spr] of objs) ctx.drawImage(spr, Math.round(fx - spr.width / 2), Math.round(fy - spr.height + 2));
    return cv;
  }
  // Draw visible chunks (world space; one tile = TILE world px). Missing chunks are baked
  // within a small time budget per frame; the 8 px map shows underneath meanwhile.
  draw(ctx, v, day, budgetMs = 7) {
    const sk = seasonKey(day);
    const cs = CHUNK * TILE;
    const cx0 = Math.floor(v.x0 / cs), cy0 = Math.floor(v.y0 / cs), cx1 = Math.floor((v.x1 - 1) / cs), cy1 = Math.floor((v.y1 - 1) / cs);
    const t0 = performance.now();
    const cells = [], missing = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= this.world.w || cy * CHUNK >= this.world.h) continue;
      const k = `${cx},${cy}:${sk.key}${this.objectsOnly ? 'o' : ''}`;
      const c = this.cache.get(k);
      cells.push([cx, cy, k, c]);
      if (!c) missing.push([cx, cy, k]);
    }
    // Phase 20: while a new season is being painted, keep showing the old one everywhere it
    // exists, then switch the whole view at once (no half-summer, half-winter patchwork)
    this.last ??= new Map(); // cell → the chunk shown there last
    const holdOld = missing.length && missing.every(([cx, cy]) => this.last.has(`${cx},${cy}`));
    for (const [cx, cy, k, c] of cells) {
      const cell = `${cx},${cy}`;
      const img = holdOld ? this.last.get(cell) : c;
      if (!img) continue;
      if (!holdOld) { this.cache.delete(k); this.cache.set(k, c); this.last.set(cell, c); }
      ctx.drawImage(img, cx * cs, cy * cs, cs, cs);
    }
    if (this.last.size > 400) this.last.delete(this.last.keys().next().value);
    // nearest to the view centre first
    const mx = (cx0 + cx1) / 2, my = (cy0 + cy1) / 2;
    missing.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
    this.jobs ??= new Map();
    const bake = (list, key, budget) => {
      for (const [cx, cy, k] of list) {
        if (performance.now() - t0 > budget) break;
        let job = this.jobs.get(k);
        if (!job) { job = this.bakeSteps(cx, cy, key); this.jobs.set(k, job); }
        let r;
        while (performance.now() - t0 <= budget) { r = job.next(); if (r.done) break; }
        if (r?.done) {
          this.jobs.delete(k);
          this.cache.set(k, r.value);
          if (this.cache.size > 260) this.cache.delete(this.cache.keys().next().value);
          if (!holdOld && key === sk) { ctx.drawImage(r.value, cx * cs, cy * cs, cs, cs); this.last.set(`${cx},${cy}`, r.value); }
        }
      }
    };
    bake(missing, sk, budgetMs);
    // and paint the coming season a few days early, in spare time, so the change is instant
    if (!missing.length) {
      const nk = seasonKey(day + 8);
      if (nk.key !== sk.key) bake(cells.map(([cx, cy]) => [cx, cy, `${cx},${cy}:${nk.key}${this.objectsOnly ? 'o' : ''}`]).filter(([, , k]) => !this.cache.has(k)), nk, Math.min(budgetMs, 3));
    }
    // forget half-baked jobs far from view
    if (this.jobs.size > 24) this.jobs.clear();
    return missing.length;
  }
}

// Phase 22: the colour ramps for the GPU terrain (render/terrainGL.js) — one palette texture
// row block per ramp set, 16 columns = biome ids
export function terrainPalette() {
  const rows = [];
  const put = (ramps) => { for (let k = 0; k < 5; k++) { const row = []; for (let b = 0; b < 16; b++) row.push((ramps[b] || ramps[B.GRASS])[k]); rows.push(row); } };
  put(R5);
  const R5AF = {}; for (let b = 0; b < 16; b++) R5AF[b] = R5A[b] || R5[b] || R5[B.GRASS];
  put(R5AF);
  const R5SF = {}; for (let b = 0; b < 16; b++) R5SF[b] = R5S;
  put(R5SF);
  // row 15: sea bands (0..5), lake (8..11), mud/pool/poolhi (12..14)
  const wrow = []; for (let i = 0; i < 16; i++) wrow.push([0, 0, 0]);
  SEA5.forEach((c, i) => { wrow[i] = c; }); LAKE5.forEach((c, i) => { wrow[8 + i] = c; }); wrow[12] = MUD; wrow[13] = POOL; wrow[14] = POOLHI;
  rows.push(wrow);
  return rows; // 16 rows × 16 colours
}
