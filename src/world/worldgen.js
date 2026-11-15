import { RNG } from '../core/rng.js';
import { makeNoise2D, fbm } from '../core/noise.js';
import { clamp } from '../core/util.js';
import { B, BIOMES, R } from '../data/biomes.js';
import { generateProvinces } from './provinces.js';
import { assignResources, assignTraits } from './regions.js';

export const WORLD_SIZES = {
  small: { w: 200, h: 128, label: 'Small' },
  medium: { w: 288, h: 180, label: 'Medium' },
  large: { w: 384, h: 240, label: 'Large' },
};

// 4-neighbour offsets helper
export function neighbors4(i, w, h, out) {
  out.length = 0;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (y > 0) out.push(i - w);
  if (y < h - 1) out.push(i + w);
  return out;
}

function bfsDistance(N, w, h, isSource, maxD = 60000) {
  const dist = new Uint16Array(N).fill(65535);
  const q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (isSource(i)) { dist[i] = 0; q[qt++] = i; }
  const nb = [];
  while (qh < qt) {
    const i = q[qh++];
    const d = dist[i] + 1;
    if (d > maxD) continue;
    for (const j of neighbors4(i, w, h, nb)) {
      if (dist[j] > d) { dist[j] = d; q[qt++] = j; }
    }
  }
  return dist;
}

// World types shape the elevation noise.
export const WORLD_TYPES = {
  continents: { label: 'Continents', freq: 3.0, sea: 0.6, falloff: 0.65, ridge: 0.32, center: 0, desc: 'A few large continents and scattered islands.' },
  pangaea: { label: 'Pangaea', freq: 1.9, sea: 0.5, falloff: 0.9, ridge: 0.32, center: 0.55, desc: 'One great supercontinent — land wars everywhere.' },
  archipelago: { label: 'Archipelago', freq: 5.2, sea: 0.7, falloff: 0.45, ridge: 0.25, center: 0, desc: 'Countless islands. Navies decide everything.' },
  highlands: { label: 'Highlands', freq: 3.4, sea: 0.45, falloff: 0.6, ridge: 0.7, center: 0, desc: 'Rugged mountain ranges and deep valleys.' },
};

export function generateWorld(seed, sizeKey = 'medium', type = 'continents') {
  const { w, h } = WORLD_SIZES[sizeKey];
  const T = WORLD_TYPES[type] || WORLD_TYPES.continents;
  const N = w * h;
  const rng = new RNG(seed);
  const nE = makeNoise2D(rng), nR = makeNoise2D(rng), nT = makeNoise2D(rng);
  const nM = makeNoise2D(rng), nW = makeNoise2D(rng);

  // ---- Elevation ----
  const raw = new Float32Array(N);
  const f = T.freq / w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const wx = x + fbm(nW, x * f * 1.4, y * f * 1.4, 3) * w * 0.09;
      const wy = y + fbm(nW, x * f * 1.4 + 51.7, y * f * 1.4 + 23.1, 3) * w * 0.09;
      let e = fbm(nE, wx * f, wy * f, 6);
      const ridge = 1 - Math.abs(fbm(nR, wx * f * 2.3, wy * f * 2.3, 4)) * 2;
      e += Math.pow(clamp(ridge, 0, 1), 4) * T.ridge * clamp(e + 0.3, 0, 1);
      if (T.center) {
        const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
        e += (0.6 - Math.sqrt(dx * dx + dy * dy)) * T.center;
      }
      const ex = Math.min(x, w - 1 - x) / (w * 0.09);
      const ey = Math.min(y, h - 1 - y) / (h * 0.09);
      const edge = clamp(Math.min(ex, ey), 0, 1);
      e -= (1 - edge) * (1 - edge) * T.falloff;
      raw[i] = e;
    }
  }
  const sorted = Float32Array.from(raw).sort();
  const sea = sorted[Math.floor(N * T.sea)];
  const minE = sorted[0], maxE = sorted[N - 1];
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const e = raw[i];
    height[i] = e >= sea ? (e - sea) / (maxE - sea) : (e - sea) / (sea - minE);
  }
  const land = (i) => height[i] >= 0;

  const distWater = bfsDistance(N, w, h, (i) => !land(i));
  const distLand = bfsDistance(N, w, h, (i) => land(i));

  // ---- Rivers ----
  const river = new Uint8Array(N);
  const riverNext = new Int32Array(N).fill(-1);
  const lakeFlag = new Uint8Array(N);
  const srcCandidates = [];
  for (let i = 0; i < N; i++) if (height[i] > 0.28 && distWater[i] > 4) srcCandidates.push(i);
  rng.shuffle(srcCandidates);
  const riverCount = Math.round(N / 1400);
  const sources = [];
  for (const c of srcCandidates) {
    if (sources.length >= riverCount) break;
    const cx = c % w, cy = (c / w) | 0;
    let ok = true;
    for (const s of sources) {
      const dx = (s % w) - cx, dy = ((s / w) | 0) - cy;
      if (dx * dx + dy * dy < 14 * 14) { ok = false; break; }
    }
    if (ok) sources.push(c);
  }
  const nb = [];
  for (const src of sources) {
    const path = [];
    const visited = new Set();
    let cur = src;
    let ended = false;
    for (let step = 0; step < 400; step++) {
      path.push(cur);
      visited.add(cur);
      let best = -1, bestH = Infinity;
      for (const j of neighbors4(cur, w, h, nb)) {
        if (visited.has(j)) continue;
        if (!land(j) || river[j]) { best = j; bestH = -Infinity; break; }
        if (height[j] < bestH) { bestH = height[j]; best = j; }
      }
      if (best < 0) break;
      riverNext[cur] = best;
      if (!land(best) || river[best]) { ended = true; break; }
      if (height[best] >= height[cur]) height[best] = height[cur] - 0.0005; // carve
      cur = best;
    }
    if (path.length < 6) { for (const p of path) riverNext[p] = -1; continue; }
    for (const p of path) river[p] = 1;
    if (!ended) { lakeFlag[path[path.length - 1]] = 1; river[path[path.length - 1]] = 0; riverNext[path[path.length - 2]] = path[path.length - 1]; }
  }
  // Grow small lakes around river dead-ends
  for (let i = 0; i < N; i++) {
    if (!lakeFlag[i]) continue;
    for (const j of neighbors4(i, w, h, nb)) if (land(j) && !river[j] && rng.chance(0.6)) lakeFlag[j] = 2;
  }
  const distRiver = bfsDistance(N, w, h, (i) => river[i] === 1, 12);

  // ---- Climate ----
  const temp = new Float32Array(N), moist = new Float32Array(N);
  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hl = Math.max(0, height[i]);
      temp[i] = 1 - lat * 1.05 + fbm(nT, x * f * 2, y * f * 2, 3) * 0.35 - hl * 0.5;
      let m = fbm(nM, x * f * 2.2, y * f * 2.2, 4) * 1.1 + 0.5;
      m += Math.max(0, 0.3 - distWater[i] * 0.02);
      if (distRiver[i] < 65535) m += Math.max(0, 0.22 - distRiver[i] * 0.04);
      moist[i] = clamp(m, 0, 1);
    }
  }

  // ---- Biomes ----
  const biome = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const hl = height[i];
    if (lakeFlag[i]) { biome[i] = B.LAKE; continue; }
    if (hl < 0) {
      biome[i] = distLand[i] <= 2 ? B.SHALLOW : hl < -0.32 ? B.DEEP : B.OCEAN;
      continue;
    }
    const t = temp[i], m = moist[i];
    let b;
    if (hl > 0.62) b = B.MOUNTAIN;
    else if (hl > 0.42) b = t < 0.12 ? B.SNOW : B.HILLS;
    else if (t < 0.1) b = B.SNOW;
    else if (t < 0.24) b = m > 0.58 ? B.TAIGA : B.TUNDRA;
    else if (t < 0.4) b = m > 0.5 ? B.TAIGA : m < 0.3 ? B.TUNDRA : B.GRASS;
    else if (t > 0.74) b = m < 0.33 ? B.DESERT : m < 0.48 ? B.PLAINS : m > 0.7 ? B.JUNGLE : B.GRASS;
    else b = m < 0.18 ? B.DESERT : m < 0.32 ? B.PLAINS : m < 0.55 ? B.GRASS : m < 0.82 ? B.FOREST : hl < 0.12 ? B.SWAMP : B.FOREST;
    if (hl < 0.035 && distWater[i] === 1 && t > 0.3 && !river[i] && b !== B.SWAMP) b = B.BEACH;
    if (river[i] && (b === B.DESERT)) b = B.PLAINS; // river oases
    biome[i] = b;
  }
  // Inland water bodies -> lakes
  {
    const seen = new Uint8Array(N);
    const q = [];
    for (let i = 0; i < N; i++) {
      if (seen[i] || !BIOMES[biome[i]].water) continue;
      q.length = 0; q.push(i); seen[i] = 1;
      let touchesEdge = false;
      const comp = [];
      while (q.length) {
        const c = q.pop();
        comp.push(c);
        const x = c % w, y = (c / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
        for (const j of neighbors4(c, w, h, nb)) {
          if (!seen[j] && BIOMES[biome[j]].water) { seen[j] = 1; q.push(j); }
        }
      }
      if (!touchesEdge && comp.length < 400) for (const c of comp) biome[c] = B.LAKE;
    }
  }

  // ---- Resources ----
  const resource = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const b = biome[i];
    const r = rng.next();
    switch (b) {
      case B.MOUNTAIN: if (r < 0.05) resource[i] = R.IRON; else if (r < 0.065) resource[i] = R.GOLD; else if (r < 0.09) resource[i] = R.STONE; break;
      case B.HILLS: if (r < 0.04) resource[i] = R.IRON; else if (r < 0.085) resource[i] = R.STONE; else if (r < 0.092) resource[i] = R.GOLD; break;
      case B.DESERT: if (r < 0.006) resource[i] = R.GOLD; else if (r < 0.016) resource[i] = R.STONE; break;
      case B.GRASS: case B.PLAINS:
        if (r < (distRiver[i] <= 1 ? 0.07 : 0.012)) resource[i] = R.FERTILE;
        else if (b === B.PLAINS && r < 0.035) resource[i] = R.HORSES;
        break;
      case B.FOREST: case B.JUNGLE: case B.TAIGA: if (r < 0.03) resource[i] = R.GAME; break;
      case B.SHALLOW: if (distLand[i] === 1 && r < 0.04) resource[i] = R.FISH; break;
      default: break;
    }
  }

  // ---- Landmasses ----
  const landmass = new Int32Array(N).fill(-1);
  const landmassSizes = [];
  {
    const q = [];
    for (let i = 0; i < N; i++) {
      if (landmass[i] >= 0 || BIOMES[biome[i]].water) continue;
      const id = landmassSizes.length;
      let size = 0;
      q.length = 0; q.push(i); landmass[i] = id;
      while (q.length) {
        const c = q.pop(); size++;
        for (const j of neighbors4(c, w, h, nb)) {
          if (landmass[j] < 0 && !BIOMES[biome[j]].water) { landmass[j] = id; q.push(j); }
        }
      }
      landmassSizes.push(size);
    }
  }

  const world = { seed, sizeKey, mapType: type, w, h, N, height, temp, moist, biome, river, riverNext, resource, landmass, landmassSizes };
  generateProvinces(world, rng);
  assignResources(world); // Phase 14: regional deposits + province traits (separate random stream)
  return world;
}

// ================= Custom maps =================
// Elevation used for shading when a map comes from painted terrain.
const BIOME_HEIGHT = {
  [B.DEEP]: -0.6, [B.OCEAN]: -0.3, [B.SHALLOW]: -0.08, [B.LAKE]: -0.1, [B.BEACH]: 0.02, [B.GRASS]: 0.15, [B.PLAINS]: 0.12,
  [B.FOREST]: 0.2, [B.JUNGLE]: 0.15, [B.TAIGA]: 0.25, [B.DESERT]: 0.15, [B.TUNDRA]: 0.25, [B.SNOW]: 0.38, [B.SWAMP]: 0.05,
  [B.HILLS]: 0.52, [B.MOUNTAIN]: 0.8,
};

export function computeLandmasses(world) {
  const { N, w, h, biome } = world;
  const landmass = new Int32Array(N).fill(-1);
  const landmassSizes = [];
  const q = [], nb = [];
  for (let i = 0; i < N; i++) {
    if (landmass[i] >= 0 || BIOMES[biome[i]].water) continue;
    const id = landmassSizes.length;
    let size = 0;
    q.length = 0; q.push(i); landmass[i] = id;
    while (q.length) {
      const c = q.pop(); size++;
      for (const j of neighbors4(c, w, h, nb)) if (landmass[j] < 0 && !BIOMES[biome[j]].water) { landmass[j] = id; q.push(j); }
    }
    landmassSizes.push(size);
  }
  world.landmass = landmass;
  world.landmassSizes = landmassSizes;
}

// Height / temperature / moisture derived from the painted biomes (+ gentle noise for shading).
export function deriveFields(world, x0 = 0, y0 = 0, x1 = world.w, y1 = world.h) {
  const { w, h, biome } = world;
  if (!world._noise) world._noise = makeNoise2D(new RNG((world.seed ^ 0x51ed) >>> 0));
  const n = world._noise;
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    const lat = Math.abs(y / (h - 1) - 0.5) * 2;
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = y * w + x;
      const b = biome[i];
      const v = fbm(n, x * 0.08, y * 0.08, 3);
      world.height[i] = BIOME_HEIGHT[b] + v * (BIOMES[b].water ? 0.05 : 0.1);
      world.temp[i] = b === B.SNOW || b === B.TUNDRA ? 0.15 : b === B.TAIGA ? 0.3 : 1 - lat * 1.05 - Math.max(0, world.height[i]) * 0.5;
      world.moist[i] = b === B.DESERT ? 0.1 : b === B.SWAMP || b === B.JUNGLE ? 0.9 : 0.5;
    }
  }
}

// Shallow water hugs the coasts; open water further out becomes ocean.
export function fixCoasts(world, x0 = 0, y0 = 0, x1 = world.w, y1 = world.h) {
  const { w, h, biome } = world;
  const isLand = (t) => !BIOMES[biome[t]].water;
  for (let y = Math.max(0, y0 - 3); y < Math.min(h, y1 + 3); y++) {
    for (let x = Math.max(0, x0 - 3); x < Math.min(w, x1 + 3); x++) {
      const i = y * w + x;
      const b = biome[i];
      if (b !== B.SHALLOW && b !== B.OCEAN && b !== B.DEEP) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || Math.abs(dx) + Math.abs(dy) > 2) continue;
        if (isLand(yy * w + xx)) { near = true; break; }
      }
      if (near) biome[i] = B.SHALLOW;
      else if (b === B.SHALLOW) biome[i] = B.OCEAN;
    }
  }
}

// Rivers flow toward the nearest water through connected river tiles.
export function recomputeRivers(world) {
  const { N, w, h, biome, river } = world;
  const riverNext = new Int32Array(N).fill(-1);
  const dist = new Int32Array(N).fill(-1);
  const q = [];
  for (let i = 0; i < N; i++) if (BIOMES[biome[i]].water) { dist[i] = 0; }
  // seed: river tiles touching water
  const nb = [];
  for (let i = 0; i < N; i++) {
    if (!river[i]) continue;
    if (BIOMES[biome[i]].water) { river[i] = 0; continue; }
    for (const j of neighbors4(i, w, h, nb)) if (BIOMES[biome[j]].water) { dist[i] = 1; riverNext[i] = j; q.push(i); break; }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    for (const j of neighbors4(i, w, h, nb)) {
      if (river[j] && dist[j] < 0) { dist[j] = dist[i] + 1; riverNext[j] = i; q.push(j); }
    }
  }
  // Isolated river segments: flow into a neighbouring river tile if any
  for (let i = 0; i < N; i++) {
    if (!river[i] || riverNext[i] >= 0) continue;
    for (const j of neighbors4(i, w, h, nb)) if (river[j] && j < i) { riverNext[i] = j; break; }
  }
  world.riverNext = riverNext;
}

// Landmasses + provinces (deterministic from the map seed).
export function finalizeWorld(world) {
  recomputeRivers(world);
  computeLandmasses(world);
  generateProvinces(world, new RNG((world.seed ^ 0x7f4a7c15) >>> 0));
  assignTraits(world); // painted maps keep their own deposits
  return world;
}

export function blankWorld(sizeKey = 'medium', seed = 1, fill = B.OCEAN) {
  const { w, h } = WORLD_SIZES[sizeKey];
  const N = w * h;
  const world = {
    seed, sizeKey, mapType: 'custom', w, h, N,
    height: new Float32Array(N), temp: new Float32Array(N), moist: new Float32Array(N),
    biome: new Uint8Array(N).fill(fill), river: new Uint8Array(N), riverNext: new Int32Array(N).fill(-1),
    resource: new Uint8Array(N), landmass: new Int32Array(N).fill(-1), landmassSizes: [], provinces: [], province: new Int32Array(N).fill(-1),
  };
  deriveFields(world);
  return world;
}

// Build a playable world from saved map data {w,h,seed,biome,river,resource} (typed arrays).
export function worldFromArrays({ w, h, seed, sizeKey, biome, river, resource }) {
  const N = w * h;
  const world = {
    seed, sizeKey: sizeKey || 'custom', mapType: 'custom', w, h, N,
    height: new Float32Array(N), temp: new Float32Array(N), moist: new Float32Array(N),
    biome, river, riverNext: new Int32Array(N).fill(-1), resource,
  };
  deriveFields(world);
  return finalizeWorld(world);
}
