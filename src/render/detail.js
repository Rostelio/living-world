// Phase 11 — close-up detail: sharper building sprites (Scale2x + outline + light) and
// season-aware trees drawn over the baked terrain when the camera is close.
import { B } from '../data/biomes.js';
import { hash2 } from '../core/rng.js';
import { TILE } from './terrain.js';
import { makeCanvas } from './sprites.js';

// ---------- Scale2x with an outline and top-left light ----------
const hiCache = new WeakMap();
export function hiRes(src) {
  if (hiCache.has(src)) return hiCache.get(src);
  const w = src.width, h = src.height;
  const s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const W = w * 2, H = h * 2;
  const out = makeCanvas(W, H);
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const d = img.data;
  const px = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const o = (y * w + x) * 4; return (s[o + 3] << 24 | s[o] << 16 | s[o + 1] << 8 | s[o + 2]) >>> 0; };
  const put = (x, y, v) => { const o = (y * W + x) * 4; d[o] = (v >> 16) & 255; d[o + 1] = (v >> 8) & 255; d[o + 2] = v & 255; d[o + 3] = (v >>> 24) & 255; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = px(x, y), A = px(x, y - 1), Bv = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== Bv) e0 = A;
      if (A === Bv && A !== C && Bv !== D) e1 = Bv;
      if (D === C && D !== Bv && C !== A) e2 = C;
      if (Bv === D && Bv !== A && D !== C) e3 = D;
      put(x * 2, y * 2, e0); put(x * 2 + 1, y * 2, e1); put(x * 2, y * 2 + 1, e2); put(x * 2 + 1, y * 2 + 1, e3);
    }
  }
  // outline: transparent pixels touching opaque ones get a dark edge; opaque edges facing top-left get light
  const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
  const outline = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (d[o + 3] < 40) { if (alpha(x + 1, y) > 128 || alpha(x - 1, y) > 128 || alpha(x, y + 1) > 128 || alpha(x, y - 1) > 128) outline.push(o); }
    else if (alpha(x, y - 1) < 40 || alpha(x - 1, y) < 40) { d[o] = Math.min(255, d[o] * 1.18 + 10); d[o + 1] = Math.min(255, d[o + 1] * 1.18 + 10); d[o + 2] = Math.min(255, d[o + 2] * 1.12 + 8); }
    else if (alpha(x, y + 1) < 40 || alpha(x + 1, y) < 40) { d[o] *= 0.78; d[o + 1] *= 0.78; d[o + 2] *= 0.8; }
  }
  for (const o of outline) { d[o] = 24; d[o + 1] = 16; d[o + 2] = 10; d[o + 3] = 170; }
  octx.putImageData(img, 0, 0);
  hiCache.set(src, out);
  return out;
}

// ---------- Trees ----------
// season: 0 spring, 1 summer, 2 autumn, 3 winter
const treeCache = new Map();
function treeSprite(kind, season, v) {
  const key = `${kind}:${season}:${v}`;
  if (treeCache.has(key)) return treeCache.get(key);
  const c = makeCanvas(12, 14);
  const ctx = c.getContext('2d');
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const rnd = (() => { let s = (v + 1) * 9301 + season * 49297 + kind.length * 233; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  if (kind === 'broad') {
    const pal = [
      ['#4fa83e', '#7fd060', '#2f7a2a', '#f4b8d0'], // spring (blossoms)
      ['#3a9a3a', '#6cc455', '#226a26', null], // summer
      [['#d8782a', '#f0a840', '#a8481e'], ['#c8402a', '#e87050', '#8a2a1a'], ['#d8b030', '#f0d060', '#a8801e']][v % 3].concat([null]), // autumn
      ['#6a5a48', '#8a7a68', '#4a3e30', '#f0f4fa'], // winter (bare, snowy)
    ][season];
    const [mid, hi, dk, extra] = pal;
    P(5, 9, 2, 5, '#6e4a2a'); P(5, 9, 1, 5, '#8a6038'); P(4, 13, 4, 1, 'rgba(0,0,0,0.25)');
    if (season === 3) {
      // bare branches with snow
      P(5, 4, 1, 6, '#5a4632'); P(3, 5, 3, 1, '#5a4632'); P(6, 3, 3, 1, '#5a4632'); P(2, 3, 1, 3, '#5a4632'); P(8, 1, 1, 3, '#5a4632'); P(4, 2, 1, 2, '#5a4632');
      P(2, 2, 2, 1, extra); P(6, 2, 3, 1, extra); P(8, 0, 1, 1, extra); P(4, 1, 1, 1, extra);
    } else {
      const blobs = [[6, 5, 4.2], [4, 6, 3], [8, 6, 3], [6, 3, 3]];
      for (let y = 0; y < 11; y++) for (let x = 0; x < 12; x++) {
        let inside = false, lit = 0;
        for (const [bx, by, r] of blobs) { const dd = (x - bx) ** 2 + (y - by) ** 2; if (dd < r * r) { inside = true; lit = Math.max(lit, (bx - x) + (by - y)); } }
        if (!inside) continue;
        const n = rnd();
        P(x, y, 1, 1, lit > 2 ? hi : lit < -1.5 ? dk : n < 0.18 ? dk : n > 0.85 ? hi : mid);
      }
      if (extra) for (let i = 0; i < 5; i++) P(2 + ((rnd() * 8) | 0), 1 + ((rnd() * 8) | 0), 1, 1, extra);
    }
  } else if (kind === 'pine') {
    const snowy = season === 3;
    const mid = '#2e6e48', hi = '#4a9a62', dk = '#1c4a30';
    P(5, 11, 2, 3, '#5a3e24'); P(4, 13, 4, 1, 'rgba(0,0,0,0.25)');
    const tiers = [[6, 0, 1], [6, 2, 2], [6, 4, 3], [6, 6, 4], [6, 8, 5]];
    for (const [cx, y, hw] of tiers) {
      for (let x = cx - hw; x < cx + hw; x++) P(x, y, 1, 2, x < cx - hw / 2 ? hi : x >= cx + hw / 2 ? dk : mid);
      if (snowy) P(cx - hw, y, hw * 2 - 1, 1, '#eef3fa');
    }
    if (season === 0) P(6, 0, 1, 1, '#8ad070');
  }
  treeCache.set(key, c);
  return c;
}

export class Detail {
  constructor(renderer) { this.r = renderer; }

  // Detailed trees over forests when zoomed in
  drawTrees(ctx, v, day) {
    const W = this.r.world;
    if (!W) return;
    const { w, biome, temp, seed } = W;
    const S = seed & 0xffff;
    const m = Math.floor((day % 360) / 30);
    const season = m <= 1 || m === 11 ? 3 : m <= 4 ? 0 : m <= 7 ? 1 : 2;
    for (let y = v.ty0; y < v.ty1; y++) {
      for (let x = v.tx0; x < v.tx1; x++) {
        const i = y * w + x;
        const b = biome[i];
        const X = x * TILE, Y = y * TILE;
        if (b === B.FOREST) {
          const r3 = hash2(x, y, S + 13);
          const n = 2 + (r3 < 0.4 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const tx = X - 1 + ((hash2(x * 3 + k, y, S + 21) * 6) | 0), ty = Y - 1 + ((hash2(x, y * 3 + k, S + 22) * 4) | 0);
            const kind = hash2(x + k, y - k, S + 25) < 0.18 ? 'pine' : 'broad';
            const cold = temp[i] < 0.3;
            const s = season === 3 && !cold && temp[i] > 0.62 ? 1 : season; // warm south keeps leaves
            ctx.drawImage(treeSprite(kind, s, (x * 7 + y * 3 + k) % 6), tx - 0.5, ty - 2, 6, 7);
          }
        } else if (b === B.TAIGA) {
          for (let k = 0; k < 3; k++) {
            const tx = X + ((hash2(x * 3 + k, y, S + 23) * 6) | 0), ty = Y - 2 + ((hash2(x, y * 3 + k, S + 24) * 3) | 0);
            ctx.drawImage(treeSprite('pine', season === 3 || temp[i] < 0.22 ? 3 : season, k), tx - 2, ty - 1, 6, 7);
          }
        }
      }
    }
  }
}
