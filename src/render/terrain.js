import { B, BIOMES } from '../data/biomes.js';
import { hash2 } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { makeCanvas } from './sprites.js';

export const TILE = 8;

// Bake the world (or a tile region of it) into a pixel-art canvas (TILE px per tile).
// region: {x0,y0,x1,y1} in tiles (exclusive end); canvas: existing canvas to update.
// close-up sea palette (tiles16 SEA5), mirrored here for the far view
const SEA_BANDS = ['#6cc6d6', '#45a2d4', '#2f7fc0', '#2464a8', '#1b4b8c', '#163e78'].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
export function bakeTerrain(world, region = null, canvasIn = null) {
  const { w, h, biome, height, river, riverNext, temp, seed } = world;
  const W = w * TILE, H = h * TILE;
  const canvas = canvasIn || makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rx0 = region ? clamp(region.x0, 0, w) : 0, ry0 = region ? clamp(region.y0, 0, h) : 0;
  const rx1 = region ? clamp(region.x1, 0, w) : w, ry1 = region ? clamp(region.y1, 0, h) : h;
  if (rx1 <= rx0 || ry1 <= ry0) return canvas;
  const PX0 = rx0 * TILE, PY0 = ry0 * TILE, RW = (rx1 - rx0) * TILE, RH = (ry1 - ry0) * TILE;
  // tile loops cover one extra tile around the region (decorations overhang)
  const tx0 = Math.max(0, rx0 - 1), ty0 = Math.max(0, ry0 - 1), tx1 = Math.min(w, rx1 + 1), ty1 = Math.min(h, ry1 + 1);
  const img = ctx.createImageData(RW, RH);
  const d = img.data;
  const S = seed & 0xffff;

  const set = (x, y, r, g, b) => {
    x -= PX0; y -= PY0;
    if (x < 0 || y < 0 || x >= RW || y >= RH) return;
    const o = (y * RW + x) * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  };
  const setC = (x, y, c) => set(x, y, c[0], c[1], c[2]);
  const mul = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Precompute per-tile base color with elevation shading and hillshade.
  const tileCol = new Array(w * h);
  const deep = BIOMES[B.DEEP].color, shallow = BIOMES[B.SHALLOW].color, ocean = BIOMES[B.OCEAN].color;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const i = y * w + x;
      const b = biome[i];
      const bd = BIOMES[b];
      let c;
      if (bd.water) {
        if (b === B.LAKE) c = BIOMES[B.LAKE].color;
        else {
          // Phase 20: the same depth bands as the close-up sea, so the two never show seams
          const depth = clamp(-height[i] * 1.3, 0, 1), t = clamp(Math.pow(depth, 0.8) * 1.05, 0, 0.999) * (SEA_BANDS.length - 1);
          const k = Math.floor(t); c = mix(SEA_BANDS[k], SEA_BANDS[Math.min(SEA_BANDS.length - 1, k + 1)], t - k);
          void shallow; void ocean; void deep;
        }
      } else {
        const hl = height[i];
        const xr = Math.min(x + 1, w - 1), yd = Math.min(y + 1, h - 1);
        const xl = Math.max(x - 1, 0), yu = Math.max(y - 1, 0);
        const dzdx = height[y * w + xr] - height[y * w + xl];
        const dzdy = height[yd * w + x] - height[yu * w + x];
        const light = clamp(-(dzdx + dzdy) * 2.2, -0.22, 0.22);
        c = mul(bd.color, 1 + light + (0.12 - hl * 0.25));
      }
      tileCol[i] = c;
    }
  }

  // Base pass: per-pixel with jittered tile sampling for organic biome edges.
  for (let py = PY0; py < PY0 + RH; py++) {
    for (let pxx = PX0; pxx < PX0 + RW; pxx++) {
      const hj = hash2(pxx, py, S);
      const ox = ((hj * 3) | 0) - 1, oy = ((hash2(py, pxx, S + 7) * 3) | 0) - 1;
      const tx = clamp(((pxx + ox) / TILE) | 0, tx0, tx1 - 1);
      const ty = clamp(((py + oy) / TILE) | 0, ty0, ty1 - 1);
      const i = ty * w + tx;
      const c = tileCol[i];
      const water = BIOMES[biome[i]].water;
      const j = (hash2(pxx >> (water ? 1 : 0), py >> (water ? 0 : 1), S + 3) - 0.5) * (water ? 5 : 11);
      set(pxx, py, clamp(c[0] + j, 0, 255), clamp(c[1] + j, 0, 255), clamp(c[2] + j * 0.8, 0, 255));
    }
  }

  // Shoreline shading: land next to water gets a wet-sand rim, water next to land is lighter.
  const isW = (i) => BIOMES[biome[i]].water;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const i = y * w + x;
      if (isW(i) || biome[i] === B.MOUNTAIN) continue;
      const X = x * TILE, Y = y * TILE;
      const sand = biome[i] === B.SNOW || biome[i] === B.TUNDRA ? [200, 205, 210] : biome[i] === B.SWAMP ? [92, 104, 70] : [214, 196, 140];
      const edge = [[x > 0 && isW(i - 1), 0, -1], [x < w - 1 && isW(i + 1), 0, 1], [y > 0 && isW(i - w), 1, -1], [y < h - 1 && isW(i + w), 1, 1]];
      for (const [on, axis, dir] of edge) {
        if (!on) continue;
        for (let k = 0; k < TILE; k++) {
          const depth = 1 + ((hash2(X + k * (1 - axis), Y + k * axis, S + 41) * 2.2) | 0);
          for (let d = 0; d < depth; d++) {
            const px = axis === 0 ? (dir < 0 ? X + d : X + TILE - 1 - d) : X + k;
            const py = axis === 1 ? (dir < 0 ? Y + d : Y + TILE - 1 - d) : Y + k;
            setC(px, py, d === 0 ? mix(sand, tileCol[i], 0.25) : mix(sand, tileCol[i], 0.6));
          }
        }
      }
    }
  }

  // Decorations
  const shadow = (px, py, base) => setC(px, py, mul(base, 0.72));
  // round broadleaf tree: 5x5 canopy with light from the top-left and a ground shadow
  const tree = (tx, ty, base, tint = 1) => {
    const lt = mul(base, 1.28 * tint), md = mul(base, 0.98 * tint), dk = mul(base, 0.66 * tint), xd = mul(base, 0.5);
    shadow(tx + 3, ty + 5, base); shadow(tx + 4, ty + 5, base); shadow(tx + 2, ty + 5, base);
    setC(tx + 1, ty, md); setC(tx + 2, ty, lt); setC(tx + 3, ty, md);
    setC(tx, ty + 1, md); setC(tx + 1, ty + 1, lt); setC(tx + 2, ty + 1, lt); setC(tx + 3, ty + 1, md); setC(tx + 4, ty + 1, dk);
    setC(tx, ty + 2, dk); setC(tx + 1, ty + 2, md); setC(tx + 2, ty + 2, md); setC(tx + 3, ty + 2, dk); setC(tx + 4, ty + 2, xd);
    setC(tx + 1, ty + 3, dk); setC(tx + 2, ty + 3, dk); setC(tx + 3, ty + 3, xd);
    setC(tx + 2, ty + 4, [88, 58, 34]);
  };
  // conifer: tall narrow triangle
  const pine = (tx, ty, base, snowy) => {
    const lt = mul(base, 1.05), md = mul(base, 0.82), dk = mul(base, 0.6);
    shadow(tx + 2, ty + 6, base); shadow(tx + 3, ty + 6, base);
    setC(tx + 1, ty, snowy ? [236, 242, 248] : lt);
    setC(tx + 1, ty + 1, lt); setC(tx + 2, ty + 1, md);
    setC(tx, ty + 2, lt); setC(tx + 1, ty + 2, md); setC(tx + 2, ty + 2, dk);
    setC(tx + 1, ty + 3, md); setC(tx + 2, ty + 3, dk);
    setC(tx - 1, ty + 4, lt); setC(tx, ty + 4, md); setC(tx + 1, ty + 4, md); setC(tx + 2, ty + 4, dk); setC(tx + 3, ty + 4, dk);
    setC(tx + 1, ty + 5, [76, 52, 32]);
    if (snowy) { setC(tx, ty + 2, [230, 236, 244]); setC(tx - 1, ty + 4, [226, 232, 240]); }
  };
  // jungle palm/canopy
  const palm = (tx, ty, base) => {
    const lt = mul(base, 1.3), dk = mul(base, 0.7);
    setC(tx + 2, ty + 2, [110, 80, 45]); setC(tx + 2, ty + 3, [100, 72, 40]); setC(tx + 2, ty + 4, [92, 64, 36]);
    for (const [dx, dy, c] of [[0, 1, dk], [1, 0, lt], [2, 1, lt], [3, 0, lt], [4, 1, dk], [1, 1, lt], [3, 1, lt], [2, 0, lt]]) setC(tx + dx, ty + dy, c);
    shadow(tx + 3, ty + 5, base);
  };
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const i = y * w + x;
      const b = biome[i];
      const r1 = hash2(x, y, S + 11), r2 = hash2(x, y, S + 12), r3 = hash2(x, y, S + 13);
      const X = x * TILE, Y = y * TILE;
      const base = tileCol[i];
      switch (b) {
        case B.SHALLOW: case B.OCEAN: case B.DEEP: case B.LAKE: {
          // gentle wave crests
          if (r1 < (b === B.DEEP ? 0.08 : 0.16)) { const wx = X + ((r2 * 5) | 0), wy = Y + ((r3 * 7) | 0); const c = mix(base, [230, 240, 255], b === B.SHALLOW ? 0.3 : 0.22); setC(wx, wy, c); setC(wx + 1, wy, c); setC(wx + 2, wy, mix(base, c, 0.5)); setC(wx + 1, wy + 1, mul(base, 0.9)); }
          if (b === B.SHALLOW && r2 < 0.25) setC(X + ((r3 * 8) | 0), Y + ((r1 * 8) | 0), mul(base, 1.08));
          break;
        }
        case B.FOREST: {
          const n = 2 + (r3 < 0.4 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const tx = X - 1 + ((hash2(x * 3 + k, y, S + 21) * 6) | 0), ty = Y - 1 + ((hash2(x, y * 3 + k, S + 22) * 4) | 0);
            const kind = hash2(x + k, y - k, S + 25);
            if (kind < 0.18) pine(tx + 1, ty, mul(base, 0.85), false);
            else tree(tx, ty, base, 0.92 + kind * 0.18);
          }
          break;
        }
        case B.JUNGLE: {
          for (let k = 0; k < 3; k++) {
            const tx = X - 1 + ((hash2(x * 3 + k, y, S + 21) * 6) | 0), ty = Y - 1 + ((hash2(x, y * 3 + k, S + 22) * 4) | 0);
            if (hash2(x - k, y + k, S + 26) < 0.3) palm(tx, ty, base); else tree(tx, ty, mul(base, 0.95), 1.05);
          }
          if (r1 < 0.3) setC(X + ((r2 * 7) | 0), Y + 7, [210, 80, 120]);
          break;
        }
        case B.TAIGA: {
          const cold = temp[i] < 0.22;
          for (let k = 0; k < 3; k++) {
            const tx = X + ((hash2(x * 3 + k, y, S + 23) * 6) | 0), ty = Y - 2 + ((hash2(x, y * 3 + k, S + 24) * 4) | 0);
            pine(tx, ty, base, cold && hash2(x, k, S) < 0.7);
          }
          break;
        }
        case B.MOUNTAIN: {
          const snow = height[i] > 0.78 || temp[i] < 0.3;
          const lt = mul(base, 1.32), md = mul(base, 1.0), dk = mul(base, 0.68), xd = mul(base, 0.5);
          // one or two peaks per tile with a lit west face and shaded east face
          const peaks = r3 < 0.45 ? 2 : 1;
          for (let p = 0; p < peaks; p++) {
            const ph = p === 0 ? 8 : 5;
            const px = X + (p === 0 ? 3 + ((r1 * 2) | 0) : ((r2 * 2) | 0) + (r1 < 0.5 ? 0 : 6));
            const py = Y + (p === 0 ? 0 : 3);
            for (let row = 0; row < ph; row++) {
              const half = Math.floor(row * 0.75);
              for (let k = -half; k <= half; k++) {
                let c = k < 0 ? lt : k === 0 ? md : dk;
                if (k === half && row > 1) c = xd;
                if (snow && row < Math.max(2, ph * 0.35)) c = k <= 0 ? [246, 249, 252] : [196, 208, 222];
                setC(px + k, py + row, c);
              }
            }
            // ridge line
            for (let row = 2; row < ph - 1; row += 2) setC(px + ((hash2(px, row, S) * 2) | 0) - 1, py + row, mul(base, 0.85));
          }
          break;
        }
        case B.HILLS: {
          const lt = mul(base, 1.2), md = mul(base, 1.02), dk = mul(base, 0.78);
          for (let k = 0; k < (r3 < 0.5 ? 2 : 1); k++) {
            const hx = X + ((hash2(x + k, y, S + 27) * 4) | 0), hy = Y + 2 + ((hash2(x, y + k, S + 28) * 3) | 0);
            for (let c = 1; c < 5; c++) setC(hx + c, hy, c < 3 ? lt : md);
            for (let c = 0; c < 6; c++) setC(hx + c, hy + 1, c < 2 ? lt : c < 4 ? md : dk);
            for (let c = 0; c < 6; c++) setC(hx + c, hy + 2, c < 3 ? md : dk);
            shadow(hx + 2, hy + 3, base); shadow(hx + 3, hy + 3, base); shadow(hx + 4, hy + 3, base);
          }
          if (r1 > 0.8) { const rx = X + ((r2 * 7) | 0), ry = Y + ((r3 * 6) | 0); setC(rx, ry, [150, 145, 135]); setC(rx + 1, ry, [120, 116, 108]); }
          break;
        }
        case B.DESERT: {
          // dune ridges
          if (r1 < 0.55) {
            const c = mul(base, 1.1), cd = mul(base, 0.86);
            const dx = X + ((r2 * 3) | 0), dy = Y + 1 + ((r3 * 5) | 0);
            for (let k = 0; k < 5; k++) { setC(dx + k, dy - (k === 2 ? 1 : 0), c); setC(dx + k, dy + 1 - (k === 2 ? 1 : 0), cd); }
          }
          if (r1 > 0.985) { const cx = X + 4, cy = Y + 2; const g = [70, 130, 60]; for (let k = 0; k < 4; k++) setC(cx, cy + k, g); setC(cx - 1, cy + 1, g); setC(cx - 1, cy, g); setC(cx + 1, cy + 2, g); setC(cx + 1, cy + 1, g); shadow(cx + 1, cy + 4, base); }
          if (r2 > 0.96) { const rx = X + ((r3 * 7) | 0), ry = Y + ((r1 * 7) | 0); setC(rx, ry, [170, 140, 100]); }
          break;
        }
        case B.BEACH:
          if (r1 < 0.4) setC(X + ((r2 * 7) | 0), Y + ((r3 * 7) | 0), mul(base, 0.9));
          if (r1 > 0.94) setC(X + ((r3 * 7) | 0), Y + ((r2 * 7) | 0), [245, 240, 230]);
          break;
        case B.SWAMP:
          if (r1 < 0.6) { const c = [62, 96, 98]; const dx = X + ((r2 * 4) | 0), dy = Y + ((r3 * 5) | 0); setC(dx, dy, c); setC(dx + 1, dy, c); setC(dx + 2, dy, c); setC(dx + 1, dy + 1, c); setC(dx + 2, dy + 1, [80, 120, 122]); }
          if (r2 < 0.7) { const rx = X + 1 + ((r3 * 6) | 0), ry = Y + 1 + ((r1 * 4) | 0); setC(rx, ry, [130, 140, 60]); setC(rx, ry + 1, [96, 112, 50]); setC(rx, ry + 2, [86, 100, 45]); setC(rx + 2, ry + 1, [110, 125, 55]); setC(rx + 2, ry + 2, [86, 100, 45]); }
          if (r3 < 0.15) tree(X + 1, Y, mul(base, 0.9), 0.9);
          break;
        case B.GRASS: case B.PLAINS: {
          const tuft = mul(base, 0.8), hi = mul(base, 1.12);
          for (let k = 0; k < (b === B.GRASS ? 2 : 1); k++) {
            const tx = X + ((hash2(x + k, y, S + 29) * 7) | 0), ty = Y + 1 + ((hash2(x, y + k, S + 30) * 6) | 0);
            setC(tx, ty, tuft); setC(tx + 1, ty - 1, hi); setC(tx + 2, ty, tuft);
          }
          if (b === B.PLAINS && r2 < 0.35) { const sx = X + ((r3 * 4) | 0), sy = Y + ((r1 * 6) | 0); for (let k = 0; k < 4; k++) setC(sx + k, sy, mul(base, 1.08)); }
          if (r1 > 0.9) setC(X + ((r3 * 7) | 0), Y + ((r2 * 7) | 0), r2 > 0.66 ? [240, 220, 90] : r2 > 0.33 ? [240, 240, 240] : [220, 120, 160]);
          if (r3 > 0.985) tree(X + 1, Y, mix(base, [60, 110, 50], 0.6), 1);
          if (r3 < 0.012) { const rx = X + 3, ry = Y + 4; setC(rx, ry, [150, 148, 140]); setC(rx + 1, ry, [128, 125, 118]); setC(rx, ry - 1, [170, 168, 160]); }
          break;
        }
        case B.SNOW: {
          if (r1 < 0.3) setC(X + ((r2 * 7) | 0), Y + ((r3 * 7) | 0), [205, 215, 230]);
          if (r2 < 0.25) { const sx = X + ((r3 * 5) | 0), sy = Y + ((r1 * 6) | 0); setC(sx, sy, [255, 255, 255]); setC(sx + 1, sy, [255, 255, 255]); setC(sx + 1, sy + 1, [190, 200, 215]); setC(sx + 2, sy + 1, [190, 200, 215]); }
          break;
        }
        case B.TUNDRA:
          if (r1 < 0.4) setC(X + ((r2 * 7) | 0), Y + ((r3 * 7) | 0), mul(base, 0.85));
          if (r1 > 0.9) setC(X + ((r3 * 7) | 0), Y + ((r2 * 7) | 0), [230, 235, 240]);
          if (r2 > 0.85) { const rx = X + ((r1 * 6) | 0), ry = Y + ((r3 * 6) | 0); setC(rx, ry, [140, 138, 130]); setC(rx + 1, ry, [118, 115, 108]); }
          if (r3 < 0.08) pine(X + 3, Y, mul(base, 0.75), true);
          break;
        default: break;
      }
    }
  }

  // Rivers: flow accumulation determines width.
  const flow = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!river[i]) continue;
    let c = i, steps = 0;
    while (c >= 0 && river[c] && steps++ < 500) { flow[c]++; c = riverNext[c]; }
  }
  const rc = [62, 128, 196], rcl = [96, 160, 220];
  const center = (i) => {
    const x = i % w, y = (i / w) | 0;
    return [x * TILE + 3 + ((hash2(x, y, S + 31) * 3) | 0) - 1, y * TILE + 3 + ((hash2(y, x, S + 32) * 3) | 0) - 1];
  };
  for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
    const i = y * w + x;
    if (!river[i] || riverNext[i] < 0) continue;
    const a = center(i);
    const nxt = riverNext[i];
    const bnext = BIOMES[biome[nxt]];
    const bpt = bnext.water ? [((nxt % w) * TILE + 4), (((nxt / w) | 0) * TILE + 4)] : center(nxt);
    const width = flow[i] > 30 ? 3 : flow[i] > 10 ? 2 : 1;
    const steps = TILE * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a[0] + (bpt[0] - a[0]) * t), y = Math.round(a[1] + (bpt[1] - a[1]) * t);
      for (let dy = 0; dy < width; dy++) for (let dx = 0; dx < width; dx++) setC(x + dx, y + dy, rc);
      if (width > 1 && (s & 3) === 0) setC(x, y, rcl);
    }
  }

  // Coastline foam: water pixels next to land
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const i = y * w + x;
      if (!BIOMES[biome[i]].water || biome[i] === B.LAKE) continue;
      const landR = x < w - 1 && !BIOMES[biome[i + 1]].water;
      const landL = x > 0 && !BIOMES[biome[i - 1]].water;
      const landD = y < h - 1 && !BIOMES[biome[i + w]].water;
      const landU = y > 0 && !BIOMES[biome[i - w]].water;
      const foam = [170, 210, 230];
      const X = x * TILE, Y = y * TILE;
      for (let k = 0; k < TILE; k++) {
        if (landR && hash2(X + 7, Y + k, S) < 0.5) setC(X + 7, Y + k, foam);
        if (landL && hash2(X, Y + k, S) < 0.5) setC(X, Y + k, foam);
        if (landD && hash2(X + k, Y + 7, S) < 0.5) setC(X + k, Y + 7, foam);
        if (landU && hash2(X + k, Y, S) < 0.5) setC(X + k, Y, foam);
      }
    }
  }

  ctx.putImageData(img, PX0, PY0);
  return canvas;
}

// 1px-per-tile terrain for the minimap
export function bakeMinimapBase(world) {
  const { w, h, biome } = world;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const col = BIOMES[biome[i]].color;
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Seasonal layers (half resolution: 4 px per tile) ----------
// snowCold: snow that covers cold lands for most of winter; snowMild: only in deep winter.
// autumn: warm leaf colours over forests and grassland.
export const SEASON_PX = 4;
function vn(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const sm = (t) => t * t * (3 - 2 * t);
  const u = sm(x - xi), v = sm(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function bakeSeasonLayers(world, region = null, layers = null) {
  const { w, h, biome, temp, height, seed } = world;
  const P = SEASON_PX;
  const L = layers || { snowCold: makeCanvas(w * P, h * P), snowMild: makeCanvas(w * P, h * P), autumn: makeCanvas(w * P, h * P) };
  const x0 = region ? clamp(region.x0, 0, w) : 0, y0 = region ? clamp(region.y0, 0, h) : 0;
  const x1 = region ? clamp(region.x1, 0, w) : w, y1 = region ? clamp(region.y1, 0, h) : h;
  if (x1 <= x0 || y1 <= y0) return L;
  const RW = (x1 - x0) * P, RH = (y1 - y0) * P;
  const S = seed & 0xffff;
  const mk = (cv) => { const ctx = cv.getContext('2d'); const img = ctx.createImageData(RW, RH); return { ctx, img, d: img.data }; };
  const cold = mk(L.snowCold), mild = mk(L.snowMild), aut = mk(L.autumn);
  const AUT = [[196, 96, 40], [214, 150, 50], [170, 60, 36], [226, 182, 70]];
  for (let py = 0; py < RH; py++) {
    for (let px = 0; px < RW; px++) {
      const gx = x0 * P + px, gy = y0 * P + py;
      const i = ((gy / P) | 0) * w + ((gx / P) | 0);
      const b = biome[i];
      if (BIOMES[b].water && b !== B.LAKE) continue;
      const o = (py * RW + px) * 4;
      // clumpy noise so snow and leaves form patches instead of static
      const hj = vn(gx / 7, gy / 7, S + 77) * 0.75 + hash2(gx, gy, S + 77) * 0.25;
      // frozen lakes
      const t = temp[i] - Math.max(0, height[i] - 0.5) * 0.4;
      const snowy = b === B.LAKE ? t < 0.3 : true;
      if (snowy) {
        const shade = 238 + ((hj * 16) | 0);
        const put = (L2, a) => { L2.d[o] = shade - 6; L2.d[o + 1] = shade - 2; L2.d[o + 2] = 255; L2.d[o + 3] = a; };
        const c = clamp((0.5 - t) / 0.22, 0, 1); // 0 at temp .5, 1 at .28
        const m = clamp((0.66 - t) / 0.16, 0, 1);
        if (c > 0 && hj < 0.25 + c * 0.8) put(cold, 240);
        else if (m > 0 && hj < 0.1 + m * 0.62 && b !== B.DESERT && b !== B.JUNGLE) put(mild, 225);
      }
      if ((b === B.FOREST || b === B.GRASS || b === B.PLAINS || b === B.SWAMP || b === B.HILLS) && t > 0.35 && t < 0.85) {
        const dense = b === B.FOREST ? 0.6 : 0.24;
        if (hj < dense) {
          const c = AUT[(vn(gx / 5, gy / 5, S + 78) * AUT.length * 0.999) | 0];
          aut.d[o] = c[0]; aut.d[o + 1] = c[1]; aut.d[o + 2] = c[2]; aut.d[o + 3] = b === B.FOREST ? 190 : 120;
        }
      }
    }
  }
  cold.ctx.putImageData(cold.img, x0 * P, y0 * P);
  mild.ctx.putImageData(mild.img, x0 * P, y0 * P);
  aut.ctx.putImageData(aut.img, x0 * P, y0 * P);
  return L;
}

// Per-tile water class for animation: 0 land, 1 open water, 2 coastal water (touches land), 3 river.
export function waterKinds(world) {
  const { w, h, N, biome, river } = world;
  const k = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!BIOMES[biome[i]].water) { if (river[i]) k[i] = 3; continue; }
    const x = i % w, y = (i / w) | 0;
    const land = (j) => !BIOMES[biome[j]].water;
    k[i] = (x > 0 && land(i - 1)) || (x < w - 1 && land(i + 1)) || (y > 0 && land(i - w)) || (y < h - 1 && land(i + w)) ? 2 : 1;
  }
  return k;
}
