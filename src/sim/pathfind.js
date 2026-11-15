import { MinHeap } from '../core/util.js';
import { BIOMES } from '../data/biomes.js';
import { G } from './state.js';

// Tile mask of all roads (rebuilt when the road list changes).
export function roadMask() {
  const st = G.state;
  const N = G.world.N;
  if (!G._roads || G._roads.n !== st.roads.length || G._roads.mask.length !== N) {
    const mask = new Uint8Array(N);
    for (const r of st.roads) for (const t of r.path) mask[t] = 1;
    G._roads = { n: st.roads.length, mask };
  }
  return G._roads.mask;
}

export const SEA_COST = 0.5; // sailing is fast
export const EMBARK_COST = 8; // boarding from an open beach
export const PORT_EMBARK_COST = 1; // boarding at one of our harbours
export const LANDING_COST = 3;

// A* over the tile grid. Returns tile indices from start to goal (inclusive) or null.
// opts.mode: 'land' (default) | 'water' (ships) | 'amphibious' (land + sea crossings)
// opts.portProvinces: Set of province ids where boarding is cheap (own harbours)
export function findPath(start, goal, opts = {}) {
  const world = G.world;
  const { w, h, N, biome, river, province } = world;
  const mode = opts.mode || 'land';
  const ports = opts.portProvinces;
  const hf = mode === 'land' ? 0.9 : SEA_COST * 0.9;
  if (!world._pf) world._pf = { g: new Float32Array(N), came: new Int32Array(N), stamp: new Uint32Array(N), cur: 0, closed: new Uint32Array(N) };
  const pf = world._pf;
  pf.cur++;
  const stamp = pf.cur;
  const roadBonus = opts.roads;
  const canEnter = opts.canEnter;
  const maxNodes = opts.maxNodes ?? 60000;
  const gx = goal % w, gy = (goal / w) | 0;
  const heap = new MinHeap();
  pf.g[start] = 0; pf.stamp[start] = stamp; pf.came[start] = -1;
  heap.push(start, 0);
  let expanded = 0;
  while (heap.size) {
    const i = heap.pop();
    if (i === goal) {
      const path = [];
      for (let c = goal; c !== -1; c = pf.came[c]) path.push(c);
      return path.reverse();
    }
    if (pf.closed[i] === stamp) continue;
    pf.closed[i] = stamp;
    if (++expanded > maxNodes) return null;
    const x = i % w, y = (i / w) | 0;
    const fromWater = BIOMES[biome[i]].water;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const bd = BIOMES[biome[j]];
      let c;
      if (bd.water) {
        if (mode === 'land') continue;
        c = SEA_COST;
        if (!fromWater) c += ports && ports.has(province[i]) ? PORT_EMBARK_COST : EMBARK_COST;
      } else {
        if (mode === 'water' && j !== goal) continue;
        if (canEnter && !canEnter(j)) continue;
        c = bd.cost + (river[j] ? 1 : 0);
        if (roadBonus && roadBonus[j]) c *= 0.35;
        if (fromWater) c += LANDING_COST;
      }
      const ng = pf.g[i] + c;
      if (pf.stamp[j] !== stamp || ng < pf.g[j]) {
        pf.stamp[j] = stamp; pf.g[j] = ng; pf.came[j] = i;
        heap.push(j, ng + (Math.abs(nx - gx) + Math.abs(ny - gy)) * hf);
      }
    }
  }
  return null;
}
