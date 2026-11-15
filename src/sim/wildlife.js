import { G, S } from './state.js';
import { B, BIOMES } from '../data/biomes.js';

// Lightweight agent ecosystem: herbivores graze & breed, predators hunt.
export const SPECIES = {
  deer: { name: 'Deer', color: '#a0714a', biomes: [B.FOREST, B.GRASS, B.PLAINS, B.TAIGA], prey: false, cap: 220, breed: 0.012, life: 3000 },
  boar: { name: 'Boar', color: '#5b4636', biomes: [B.FOREST, B.JUNGLE, B.SWAMP], prey: false, cap: 120, breed: 0.01, life: 2800 },
  goat: { name: 'Mountain Goat', color: '#ddd6c8', biomes: [B.HILLS, B.MOUNTAIN, B.TUNDRA], prey: false, cap: 110, breed: 0.01, life: 3200 },
  wolf: { name: 'Wolf', color: '#7d8590', biomes: [B.FOREST, B.TAIGA, B.TUNDRA, B.GRASS, B.HILLS], prey: true, cap: 70, breed: 0.006, life: 3600, hunger: 45 },
  bear: { name: 'Bear', color: '#3d2b1f', biomes: [B.FOREST, B.TAIGA, B.HILLS], prey: true, cap: 30, breed: 0.003, life: 5000, hunger: 70 },
};
const KEYS = Object.keys(SPECIES);
const CELL = 8;

export function seedWildlife() {
  const st = S();
  const W = G.world;
  const rng = G.rng;
  st.animals = [];
  for (const k of KEYS) {
    const sp = SPECIES[k];
    const n = Math.round(sp.cap * 0.6 * (W.N / 51840));
    for (let tries = 0, made = 0; made < n && tries < n * 60; tries++) {
      const t = rng.int(0, W.N - 1);
      if (!sp.biomes.includes(W.biome[t])) continue;
      st.animals.push({ id: st.nextAnimalId++, sp: k, t, pt: t, age: rng.int(0, sp.life >> 1), hunger: 0 });
      made++;
    }
  }
}

export function dailyWildlife() {
  const st = S();
  const W = G.world;
  const rng = G.rng;
  const { w, h, biome } = W;
  const counts = {};
  for (const k of KEYS) counts[k] = 0;
  for (const a of st.animals) counts[a.sp]++;
  const scale = W.N / 51840;

  // Spatial buckets for hunting
  const gw = Math.ceil(w / CELL);
  const buckets = new Map();
  for (const a of st.animals) {
    if (SPECIES[a.sp].prey) continue;
    const x = a.t % w, y = (a.t / w) | 0;
    const key = ((y / CELL) | 0) * gw + ((x / CELL) | 0);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    b.push(a);
  }
  const owned = st.provinces;
  const born = [];
  const dead = new Set();
  for (const a of st.animals) {
    if (dead.has(a)) continue;
    const sp = SPECIES[a.sp];
    a.pt = a.t;
    a.age++;
    if (a.age > sp.life) { dead.add(a); continue; }
    // move (most days)
    if (rng.next() < 0.55) {
      const x = a.t % w, y = (a.t / w) | 0;
      const d = rng.int(0, 3);
      const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0), ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
        const j = ny * w + nx;
        const bj = biome[j];
        if (!BIOMES[bj].water && (sp.biomes.includes(bj) || rng.next() < 0.15)) {
          const p = W.province[j];
          const ps = p >= 0 ? owned[p] : null;
          // animals shy away from settlement tiles
          if (!(ps && ps.settlement >= 0 && st.settlements[ps.settlement].tile === j)) a.t = j;
        }
      }
    }
    if (sp.prey) {
      a.hunger++;
      if (a.hunger > sp.hunger * 2) { dead.add(a); continue; }
      if (a.hunger > sp.hunger * 0.5) {
        const x = a.t % w, y = (a.t / w) | 0;
        const key = ((y / CELL) | 0) * gw + ((x / CELL) | 0);
        const b = buckets.get(key);
        if (b && b.length) {
          const idx = rng.int(0, b.length - 1);
          const prey = b[idx];
          if (!dead.has(prey) && rng.next() < 0.25) {
            dead.add(prey); b.splice(idx, 1);
            a.hunger = 0;
            if (counts[a.sp] < sp.cap * scale && rng.next() < 0.3) born.push({ sp: a.sp, t: a.t });
          }
        }
      }
    } else if (counts[a.sp] < sp.cap * scale && a.age > 200 && rng.next() < sp.breed) {
      born.push({ sp: a.sp, t: a.t });
      counts[a.sp]++;
    }
  }
  if (dead.size) st.animals = st.animals.filter((a) => !dead.has(a));
  for (const b of born) st.animals.push({ id: st.nextAnimalId++, sp: b.sp, t: b.t, pt: b.t, age: 0, hunger: 0 });

  // Repopulate extinct species slowly from the wild edges
  if (st.day % 90 === 0) {
    for (const k of KEYS) {
      if (counts[k] < 4 * scale) {
        for (let tries = 0; tries < 200; tries++) {
          const t = rng.int(0, W.N - 1);
          if (SPECIES[k].biomes.includes(biome[t]) && W.province[t] >= 0 && owned[W.province[t]].owner < 0) {
            st.animals.push({ id: st.nextAnimalId++, sp: k, t, pt: t, age: 300, hunger: 0 });
            st.animals.push({ id: st.nextAnimalId++, sp: k, t, pt: t, age: 300, hunger: 0 });
            break;
          }
        }
      }
    }
  }
}

// Spatial index of animals (8-tile cells), rebuilt once per day when needed.
function animalGrid() {
  const st = S();
  const c = G.cache || (G.cache = {});
  if (!c.animalGrid) {
    const w = G.world.w;
    const gw = Math.ceil(w / CELL);
    const grid = new Map();
    for (const a of st.animals) {
      if (a.dead) continue;
      const k = (((a.t / w) | 0) / CELL | 0) * gw + ((a.t % w) / CELL | 0);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(a);
    }
    c.animalGrid = { grid, gw };
  }
  return c.animalGrid;
}

// Settlements hunt nearby game: returns food gained and removes animals.
export function huntNear(s, radius = 4) {
  const st = S();
  const W = G.world;
  const sx = s.tile % W.w, sy = (s.tile / W.w) | 0;
  const { grid, gw } = animalGrid();
  let food = 0, hunted = 0;
  const maxHunt = 1 + (s.stage >> 1);
  const cx0 = Math.max(0, ((sx - radius) / CELL) | 0), cx1 = ((sx + radius) / CELL) | 0;
  const cy0 = Math.max(0, ((sy - radius) / CELL) | 0), cy1 = ((sy + radius) / CELL) | 0;
  for (let cy = cy0; cy <= cy1 && hunted < maxHunt; cy++) {
    for (let cx = cx0; cx <= cx1 && hunted < maxHunt; cx++) {
      const b = grid.get(cy * gw + cx);
      if (!b) continue;
      for (const a of b) {
        if (hunted >= maxHunt) break;
        if (a.dead || a.sp === 'bear') continue;
        const dx = (a.t % W.w) - sx, dy = ((a.t / W.w) | 0) - sy;
        if (dx * dx + dy * dy <= radius * radius && G.rng.next() < 0.3) {
          a.dead = true; hunted++; food += a.sp === 'wolf' ? 2 : 6;
        }
      }
    }
  }
  if (hunted) G.cache.huntedAny = true;
  return food;
}
// Remove hunted animals in one pass (called after all settlements hunted).
export function purgeHunted() {
  if (!G.cache?.huntedAny) return;
  S().animals = S().animals.filter((a) => !a.dead);
  G.cache.huntedAny = false;
}
