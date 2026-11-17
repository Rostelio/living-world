// Title screen backdrop: title_backdrop, four 480×270 layers (tags sky, far, mid, near) that the
// title screen scales up by a whole number and scrolls at different speeds (src/ui/titlebg.js).
// A golden-hour valley: distant snowy peaks, green hills with a castle, a village and a windmill,
// a river, and dark pines with flowers up front. Every layer but the sky tiles left to right.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

const W = 480, H = 270, TAU = Math.PI * 2;
const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const per = (x, k, ph = 0) => Math.sin(TAU * k * x / W + ph);              // periodic across the layer's width
const pick = (ramp, t, x, y) => { const p = Math.max(0, Math.min(0.999, t)) * ramp.length, i = Math.floor(p); return ramp[Math.min(ramp.length - 1, i + (p - i > dith(x, y) ? 1 : 0))]; };

function sky() {
  const g = new Pix(W, H);
  const SKY = ['#2e4a86', '#3e64a4', '#5a86c0', '#88aed4', '#c8cfd0', '#f2cfa0', '#f8b878'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.p(x, y, pick(SKY, Math.pow(y / 190, 1.25), x, y));
  // low sun with a halo, left of centre
  const sx = 150, sy = 92;
  for (let y = sy - 40; y < sy + 40; y++) for (let x = sx - 40; x < sx + 40; x++) {
    const d = Math.hypot(x - sx, y - sy);
    if (d < 12) g.p(x, y, d < 9 ? '#fff6d8' : '#fde6a8');
    else if (d < 38 && dith(x, y) > 0.35 + (d - 12) / 40) g.p(x, y, '#fbdca0');
  }
  // a few long thin clouds lit from below
  for (const [cx, cy, len] of [[60, 60, 90], [300, 40, 120], [400, 90, 70], [230, 110, 60]]) for (let i = 0; i < len; i++) {
    const th = 3 - Math.abs(i - len / 2) / (len / 6);
    for (let j = 0; j < Math.max(1, th); j++) g.p(cx + i, cy + j, j === 0 ? '#fde8c8' : '#e8b8a0');
  }
  return g;
}

function far() {
  const g = new Pix(W, H);
  const M = ['#5a6a98', '#6e7eaa', '#8494bc', '#a4b0cc'], SNOW = ['#c8d0e4', '#eef2fa'];
  for (let x = 0; x < W; x++) {
    const top = Math.round(128 + 26 * per(x, 2, 1) + 16 * per(x, 5, 0.3) + 7 * per(x, 11, 2) + 3 * per(x, 23, 1));
    const slope = (26 * 2 * Math.cos(TAU * 2 * x / W + 1) + 16 * 5 * Math.cos(TAU * 5 * x / W + 0.3) + 7 * 11 * Math.cos(TAU * 11 * x / W + 2)) / W * TAU;
    for (let y = top; y < 215; y++) {
      const depth = (y - top) / 60, lit = slope > 0.05 ? 1 : slope < -0.05 ? -1 : 0;   // slopes facing the sun are lit
      let c = pick(M, 0.75 - depth * 0.5 + lit * 0.18, x, y);
      if (top < 118 && y < top + (118 - top) * 0.8 + 3 * per(x, 31)) c = lit >= 0 ? SNOW[1] : SNOW[0];
      g.p(x, y, c);
    }
  }
  // haze over the foot of the mountains
  for (let y = 170; y < 215; y++) for (let x = 0; x < W; x++) if (g.alpha(x, y) && dith(x, y) < (y - 170) / 60) g.p(x, y, '#b4bcd4');
  return g;
}

function house(g, x, base, w, wall, roof) {
  g.r(x, base - 7, w, 7, wall[2]).r(x, base - 7, 1, 7, wall[3]).r(x + w - 1, base - 7, 1, 7, wall[1]);
  for (let i = 0; i < 5; i++) { const hw = i + 1; g.r(x + Math.floor(w / 2) - hw, base - 12 + i, hw * 2, 1, i < 2 ? roof[3] : roof[2]); }
  g.p(x + 2, base - 5, '#ffd27a').p(x + w - 3, base - 5, '#ffd27a').r(x + Math.floor(w / 2), base - 3, 1, 3, R.wood[0]);
}
function mid() {
  const g = new Pix(W, H);
  const HILL = ['#2e5a3a', '#3e7442', '#56904a', '#7aac58', '#a8c870'];
  const top = (x) => Math.round(176 + 12 * per(x, 3, 0.4) + 7 * per(x, 7, 1.3) + 3 * per(x, 13));
  for (let x = 0; x < W; x++) {
    const t0 = top(x);
    for (let y = t0; y < H; y++) g.p(x, y, pick(HILL, 0.9 - (y - t0) / 40 + (rnd(x >> 3, y >> 3, 5) - 0.5) * 0.15, x, y));
  }
  // fields: striped patches on the slopes
  for (const [fx, fw, col] of [[40, 50, ['#c8b450', '#a89440']], [250, 40, ['#d8c060', '#b89c48']], [380, 46, ['#8aa848', '#6e8c3c']]]) for (let x = fx; x < fx + fw; x++) for (let y = top(x) + 6; y < top(x) + 16; y++) g.p(x, y, (x + y) % 4 < 2 ? col[0] : col[1]);
  // tree clumps along the ridge
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rnd(i, 1, 9) * W), y = top(x) + 2 + Math.floor(rnd(i, 2, 9) * 10), r = 3 + Math.floor(rnd(i, 3, 9) * 3);
    if (x > 280 && x < 345) continue;                              // the castle hill stays clear
    g.ellipse(x, y - r, r, r, HILL[1]); g.ellipse(x - 1, y - r - 1, r - 1, r - 1, HILL[2]); g.p(x - 2, y - r - 2, HILL[3]);
  }
  // the castle on its hill
  const cb = top(312), st = R.stone;
  g.r(292, cb - 26, 40, 26, st[2]); for (let y = cb - 24; y < cb; y += 3) for (let x = 292 + ((y / 3) % 2) * 2; x < 332; x += 5) g.r(x, y, 4, 1, st[1]);
  for (let x = 292; x < 332; x += 4) g.r(x, cb - 29, 2, 3, st[2]);
  for (const tx of [286, 326]) { g.r(tx, cb - 40, 10, 40, st[3]).r(tx + 8, cb - 40, 2, 40, st[1]); for (let i = 0; i < 9; i++) { const hw = Math.round(i * 0.7) + 1; g.r(tx + 5 - hw, cb - 50 + i, hw * 2, 1, i < 3 ? R.blue[3] : R.blue[2]); } g.r(tx + 4, cb - 33, 2, 3, '#ffd27a'); }
  g.r(306, cb - 46, 12, 22, st[3]).r(316, cb - 46, 2, 22, st[1]);
  for (let i = 0; i < 11; i++) { const hw = Math.round(i * 0.75) + 1; g.r(312 - hw, cb - 57 + i, hw * 2, 1, i < 3 ? R.blue[3] : R.blue[2]); }
  g.r(311, cb - 66, 1, 9, R.wood[0]).r(312, cb - 66, 6, 4, R.red[2]).r(312, cb - 66, 6, 1, R.red[3]);
  g.r(309, cb - 10, 6, 10, R.ink[1]); g.r(310, cb - 38, 3, 4, '#ffd27a');
  g.line(312, cb, 300, cb + 14, R.soil[3]).line(313, cb, 301, cb + 14, R.soil[2]);
  // the village and its windmill
  const vb = (x) => top(x) + 14;
  for (const [x, w, wall, roof] of [[96, 9, R.cream, R.red], [110, 8, R.cream, R.red], [122, 10, R.straw, R.brown], [136, 8, R.cream, R.red], [150, 9, R.cream, R.blue]]) house(g, x, vb(x), w, wall, roof);
  const mx = 176, mb = vb(mx);
  for (let y = mb - 18; y < mb; y++) { const hw = 3 + Math.round((y - mb + 18) * 0.15); g.r(mx - hw, y, hw * 2, 1, y % 3 ? R.cream[2] : R.cream[3]); }
  g.r(mx - 3, mb - 20, 6, 3, R.wood[2]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; for (let r = 1; r < 10; r++) g.p(Math.round(mx + Math.cos(a) * r), Math.round(mb - 19 + Math.sin(a) * r), r > 3 ? R.cream[3] : R.wood[0]); }
  // a river winding across the valley floor, mirroring the sky
  for (let x = 0; x < W; x++) {
    const c = Math.round(236 + 4 * per(x, 2, 0.7) + 2 * per(x, 5));
    for (let y = c - 3; y < c + 4; y++) g.p(x, y, y === c - 3 ? '#e8d8b0' : (x + y * 3) % 17 === 0 ? '#fde6c0' : y < c ? '#9ab8d4' : '#7a9cc0');
  }
  return g;
}

function near() {
  const g = new Pix(W, H);
  const GR = ['#14281e', '#1e3a26', '#2a4e2e', '#3e6a36'], PINE = ['#0e1c16', '#16281e', '#203a28', '#2e5232'];
  const top = (x) => Math.round(250 + 5 * per(x, 4, 0.2) + 3 * per(x, 9, 1));
  for (let x = 0; x < W; x++) { const t0 = top(x); for (let y = t0; y < H; y++) g.p(x, y, pick(GR, 0.95 - (y - t0) / 18, x, y)); for (let k = 0; k < 2; k++) if (rnd(x, k, 3) < 0.4) g.p(x, t0 - 1 - k, GR[3]); }
  // flowers in the grass
  for (let i = 0; i < 90; i++) { const x = Math.floor(rnd(i, 4, 7) * W), y = top(x) + 2 + Math.floor(rnd(i, 5, 7) * 14); g.p(x, y, [R.pink[3], R.gold[3], R.white[3], R.red[3], R.purple[3]][i % 5]); }
  // dark pines framing the view (they wrap across the seam)
  const pine = (cx, base, h) => {
    for (let i = 0; i < h; i++) {
      const tier = (i % 12) / 12, hw = Math.round((i / h) * h * 0.28 * (0.55 + tier * 0.6)) + 1;
      for (let x = cx - hw; x <= cx + hw; x++) g.p(((x % W) + W) % W, base - h + i, x < cx - hw * 0.3 ? PINE[2] : x > cx + hw * 0.4 ? PINE[0] : PINE[1]);
      if (i % 12 === 11) for (let x = cx - hw; x <= cx + hw; x++) g.p(((x % W) + W) % W, base - h + i, PINE[0]);
    }
    for (let y = base - 4; y < base + 4; y++) g.r(((cx - 1) % W + W) % W, y, 3, 1, '#2a1a12');
  };
  for (const [x, h] of [[18, 150], [52, 110], [84, 80], [440, 130], [470, 170], [236, 60]]) pine(x, top(x), h);
  // a fence and a signpost along a path
  for (let x = 140; x < 200; x += 8) g.r(x, top(x) - 7, 2, 8, '#3a2618');
  for (let x = 140; x < 200; x++) g.p(x, top(x) - 5, '#4a3020').p(x, top(x) - 2, '#4a3020');
  g.r(212, top(212) - 14, 2, 14, '#3a2618').r(206, top(212) - 14, 14, 4, '#5a3a22').r(206, top(212) - 14, 14, 1, '#7a5230');
  g.outline(INK);
  return g;
}

export const titleSheet = () => ({ frames: [sky(), far(), mid(), near()], tags: [['sky', 0, 0, 1000], ['far', 1, 1, 1000], ['mid', 2, 2, 1000], ['near', 3, 3, 1000]], layer: 'title' });
void hex; void toHex;
