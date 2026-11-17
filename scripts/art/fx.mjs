// Effects: fx_flame (12×20, burn ×3), fx_puff (64×64, one smoke puff per frame, growing sizes, in
// grey that the game tints), fx_meteor (32×32, fall ×3, heading down-left), fx_burst (32×32, an
// impact flash ×5) and fx_cloud (64×32, 8 cloud shapes). Effects have no ink outline: flames carry
// a dark-red rim, smoke and clouds a soft dithered edge.
import { Pix } from './pix.mjs';
import { R } from './palette.mjs';

const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const F = R.fire; // #7a1c18 #c4401c #f08a24 #fcd25a #fff6c0

// ---------------- flame tongue (12×20) ----------------
function flame(f) {
  const g = new Pix(12, 20);
  for (let y = 0; y < 20; y++) {
    const t = y / 19;                                   // 0 tip .. 1 base
    const half = Math.max(0.6, (1 - Math.abs(t - 0.72) * 1.35) * 5.2 * (0.8 + 0.2 * Math.sin(y * 0.8 + f * 2.1)));
    const sway = Math.round(Math.sin(y * 0.45 + f * 2.1) * (1 - t) * 2.2);
    for (let x = 0; x < 12; x++) {
      const dx = Math.abs(x + 0.5 - 6 - sway);
      if (dx > half) continue;
      const q = dx / half;
      let c = t < 0.25 ? F[1] : F[2];
      if (q < 0.62 && t > 0.3) c = F[3];
      if (q < 0.32 && t > 0.55) c = F[4];
      g.p(x, y, c);
    }
  }
  // a lick that breaks off the tip
  g.p(6 + Math.round(Math.sin(f * 2.1 + 1) * 2), f % 2 ? 0 : 1, F[2]);
  g.outline(F[0]);
  return g;
}

// ---------------- smoke puff (grey; the game multiplies in the smoke's colour) ----------------
export const PUFF_D = [8, 14, 20, 28, 40, 56];
function puff(d) {
  const g = new Pix(64, 64);
  const ramp = ['#9c9ca4', '#c4c4ca', '#e2e2e6', '#ffffff'];
  const R0 = d / 2, o = 32 - R0;
  // three overlapping lobes make the puff lumpy rather than a disc
  const lobes = [[R0, R0 + R0 * 0.12, R0 * 0.92], [R0 * 0.62, R0 * 0.82, R0 * 0.6], [R0 * 1.38, R0 * 0.9, R0 * 0.58]];
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    let best = 0;
    for (const [lx, ly, lr] of lobes) best = Math.max(best, 1 - ((x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2) / (lr * lr));
    if (best <= 0) continue;
    if (best < 0.22 && (x + y) % 2) continue;           // dithered rim
    // light from the top-left: distance to a highlight spot on each lobe picks the tone
    let lt = 9;
    for (const [lx, ly, lr] of lobes) lt = Math.min(lt, Math.hypot(x + 0.5 - (lx - lr * 0.38), y + 0.5 - (ly - lr * 0.45)) / lr);
    const c = lt < 0.45 ? ramp[3] : lt < 0.85 ? ramp[2] : lt < 1.15 ? ramp[1] : ramp[0];
    g.p(o + x, o + y, c);
  }
  return g;
}

// ---------------- meteor (32×32) heading down-left: head at the bottom-left, tail up-right ----------------
function meteor(f) {
  const g = new Pix(32, 32);
  const hx = 9, hy = 22;
  const layers = [[F[1], 1.0], [F[2], 0.72], [F[3], 0.45], [F[4], 0.22]]; // tail: red rim, white-hot core
  for (const [c, k] of layers) for (let i = 22; i >= 0; i -= 0.5) {
    const x = hx + i * 0.85, y = hy - i * 0.95, w = Math.max(0, (4 - i * 0.17 + Math.sin(i * 1.3 + f * 2) * 0.5) * k);
    if (w < 0.5) continue;
    if (k === 1 && i > 15 && Math.floor(i + f) % 2) continue;
    g.ellipse(Math.round(x), Math.round(y), w, w, c);
  }
  for (let k = 0; k < 4; k++) g.p(hx + 6 + Math.round(rnd(k, f, 3) * 14), hy - 8 - Math.round(rnd(k, f, 4) * 12), F[3]); // embers in the wake
  g.ellipse(hx, hy, 3.4, 3.4, R.stone[1]);              // rock
  g.ellipse(hx - 0.6, hy + 0.6, 2.2, 2.2, R.ink[2]);
  g.p(hx + 1, hy - 2, F[3]).p(hx + 2, hy - 1, F[3]).p(hx + 2, hy - 2, F[4]);
  g.outline(F[0]);
  return g;
}

// ---------------- impact burst (32×32 ×5) ----------------
function burst(f) {
  const g = new Pix(32, 32);
  const r = [4, 8, 11, 13, 14][f];
  const ring = [0, 0, 2, 3, 2][f];
  const cols = f < 2 ? [F[4], F[3]] : f < 4 ? [F[3], F[2]] : [F[2], F[1]];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x + 0.5 - 16, dy = y + 0.5 - 16, d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
    const spike = r * (0.72 + 0.28 * Math.abs(Math.cos(a * 4 + f)));
    if (ring && d < spike - ring) continue;              // the core burns out into a ring
    if (d > spike) continue;
    if (f === 4 && (x + y) % 2) continue;
    g.p(x, y, d < spike * 0.55 ? cols[0] : cols[1]);
  }
  if (f >= 1) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + f * 0.3, d = r + 2 + f; g.p(Math.round(16 + Math.cos(a) * d), Math.round(16 + Math.sin(a) * d), F[3]); }
  if (f < 4) g.outline(F[0]);
  return g;
}

// ---------------- clouds (64×32 ×8): flat white tops, a cool shaded underside ----------------
function cloud(k) {
  const g = new Pix(64, 32);
  const ramp = ['#a8b4cc', '#c8d2e4', '#e8eef6', '#ffffff'];
  const n = 4 + (k % 3), w = 40 + ((k * 7) % 18), h = 16 + (k % 3) * 4;
  const x0 = Math.round((64 - w) / 2), base = 14 + h / 2;
  const blobs = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, rr = h * (0.3 + 0.35 * Math.sin(t * Math.PI)) * (0.85 + rnd(k, i, 3) * 0.3); blobs.push([x0 + t * w, base - rr * 0.55, rr]); }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    if (y > base + 2) continue;                          // flat bottom
    let best = 0;
    for (const [bx, by, r] of blobs) best = Math.max(best, 1 - ((x + 0.5 - bx) ** 2 + ((y + 0.5 - by) * 1.15) ** 2) / (r * r));
    if (best <= 0) continue;
    const under = y > base - 2 ? 0 : y > base - 5 ? 1 : best > 0.55 && y < base - h * 0.35 ? 3 : 2;
    if (best < 0.12 && (x + y) % 2) continue;
    g.p(x, y, ramp[under]);
  }
  return g;
}

export const FX = {
  fx_flame: () => ({ frames: [0, 1, 2].map(flame), tags: [['burn', 0, 2, 110]] }),
  fx_puff: () => ({ frames: PUFF_D.map(puff), tags: [] }),
  fx_meteor: () => ({ frames: [0, 1, 2].map(meteor), tags: [['fall', 0, 2, 90]] }),
  fx_burst: () => ({ frames: [0, 1, 2, 3, 4].map(burst), tags: [['burst', 0, 4, 70]] }),
  fx_cloud: () => ({ frames: [0, 1, 2, 3, 4, 5, 6, 7].map(cloud), tags: [] }),
};
