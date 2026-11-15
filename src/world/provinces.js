import { MinHeap } from '../core/util.js';
import { BIOMES, RESOURCES, B } from '../data/biomes.js';
import { provinceName } from '../core/names.js';
import { neighbors4 } from './worldgen.js';

// Partition land into organic provinces: Poisson-spaced seeds grown with a
// terrain-weighted Dijkstra flood (mountains and rivers form natural borders).
export function generateProvinces(world, rng) {
  const { w, h, N, biome, river, resource } = world;
  const isLand = (i) => !BIOMES[biome[i]].water;
  const spacing = 8.5;

  const cand = [];
  for (let i = 0; i < N; i++) if (isLand(i) && biome[i] !== B.MOUNTAIN) cand.push(i);
  rng.shuffle(cand);
  const cell = spacing;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = Array.from({ length: gw * gh }, () => []);
  const seeds = [];
  for (const c of cand) {
    const x = c % w, y = (c / w) | 0;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let ok = true;
    for (let yy = gy - 1; yy <= gy + 1 && ok; yy++) {
      for (let xx = gx - 1; xx <= gx + 1 && ok; xx++) {
        if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
        for (const s of grid[yy * gw + xx]) {
          const dx = (s % w) - x, dy = ((s / w) | 0) - y;
          if (dx * dx + dy * dy < spacing * spacing) { ok = false; break; }
        }
      }
    }
    if (ok) { seeds.push(c); grid[gy * gw + gx].push(c); }
  }

  const owner = new Int32Array(N).fill(-1);
  const dist = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap();
  seeds.forEach((s, id) => { owner[s] = id; dist[s] = 0; heap.push(s, 0); });
  const nb = [];
  const grow = () => {
    while (heap.size) {
      const i = heap.pop();
      const d = dist[i];
      for (const j of neighbors4(i, w, h, nb)) {
        if (!isLand(j)) continue;
        let c = BIOMES[biome[j]].cost;
        if (river[j] !== river[i]) c += 2.5;
        const nd = d + c;
        if (nd < dist[j]) { dist[j] = nd; owner[j] = owner[i]; heap.push(j, nd); }
      }
    }
  };
  grow();
  // Unreached land (islands without seeds) becomes its own provinces.
  let nextId = seeds.length;
  for (let i = 0; i < N; i++) {
    if (isLand(i) && owner[i] < 0) {
      owner[i] = nextId++; dist[i] = 0; heap.push(i, 0);
      grow();
    }
  }

  // Merge tiny provinces into their largest-border neighbour.
  const sizes = new Int32Array(nextId);
  for (let i = 0; i < N; i++) if (owner[i] >= 0) sizes[owner[i]]++;
  for (let pass = 0; pass < 2; pass++) {
    const tilesOf = new Map();
    for (let i = 0; i < N; i++) {
      const o = owner[i];
      if (o >= 0 && sizes[o] < 14) { if (!tilesOf.has(o)) tilesOf.set(o, []); tilesOf.get(o).push(i); }
    }
    for (const [o, tiles] of tilesOf) {
      if (sizes[o] >= 14) continue;
      const border = new Map();
      for (const t of tiles) for (const j of neighbors4(t, w, h, nb)) {
        const oj = owner[j];
        if (oj >= 0 && oj !== o) border.set(oj, (border.get(oj) || 0) + 1);
      }
      let best = -1, bc = 0;
      for (const [k, v] of border) if (v > bc) { bc = v; best = k; }
      if (best < 0) continue; // isolated islet stays
      for (const t of tiles) owner[t] = best;
      sizes[best] += sizes[o]; sizes[o] = 0;
    }
  }

  // Compact ids
  const remap = new Int32Array(nextId).fill(-1);
  let count = 0;
  for (let i = 0; i < N; i++) {
    const o = owner[i];
    if (o < 0) continue;
    if (remap[o] < 0) remap[o] = count++;
    owner[i] = remap[o];
  }

  const provinces = [];
  for (let p = 0; p < count; p++) {
    provinces.push({
      id: p, name: provinceName(rng), tiles: [], neighbors: new Set(),
      coastal: false, river: false, cx: 0, cy: 0, center: -1, landmass: -1,
      biomes: {}, resources: {}, pot: null, avg: null,
    });
  }
  for (let i = 0; i < N; i++) {
    const o = owner[i];
    if (o < 0) continue;
    const P = provinces[o];
    P.tiles.push(i);
    P.cx += i % w; P.cy += (i / w) | 0;
    P.biomes[biome[i]] = (P.biomes[biome[i]] || 0) + 1;
    if (resource[i]) P.resources[resource[i]] = (P.resources[resource[i]] || 0) + 1;
    if (river[i]) P.river = true;
    for (const j of neighbors4(i, w, h, nb)) {
      const oj = owner[j];
      if (oj >= 0 && oj !== o) P.neighbors.add(oj);
      if (oj < 0 && biome[j] !== B.LAKE) {
        P.coastal = true;
        if (resource[j]) P.resources[resource[j]] = (P.resources[resource[j]] || 0) + 1; // fish
      }
    }
  }
  for (const P of provinces) {
    P.cx /= P.tiles.length; P.cy /= P.tiles.length;
    let best = P.tiles[0], bd = Infinity;
    for (const t of P.tiles) {
      const dx = (t % w) - P.cx, dy = ((t / w) | 0) - P.cy;
      const d = dx * dx + dy * dy + (biome[t] === B.MOUNTAIN ? 40 : 0);
      if (d < bd) { bd = d; best = t; }
    }
    P.center = best;
    P.landmass = world.landmass[best];
    P.neighbors = [...P.neighbors];
    // Economic potential: average tile yields + deposit bonuses
    const avg = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    for (const t of P.tiles) {
      const y = BIOMES[biome[t]].yields;
      for (const k in avg) avg[k] += y[k];
      if (river[t]) avg.food += 0.25;
    }
    for (const k in avg) avg[k] /= P.tiles.length;
    if (P.coastal) avg.food += 0.08;
    const pot = { ...avg };
    for (const r in P.resources) {
      const R = RESOURCES[r];
      pot[R.sector] += Math.min(P.resources[r], 4) * R.bonus * 0.25;
    }
    P.avg = avg;
    P.pot = pot;
  }

  world.province = owner;
  world.provinces = provinces;
}
