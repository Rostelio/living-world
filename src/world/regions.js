// Phase 14 — regional resources and province traits.
// Applied after world generation with its own random stream, so the map, provinces and
// rivers stay exactly as before; only deposits and province character change.
import { RNG } from '../core/rng.js';
import { makeNoise2D, fbm } from '../core/noise.js';
import { B, BIOMES, R, RESOURCES } from '../data/biomes.js';

// Deposits cluster in belts and basins driven by slow noise fields.
export function assignResources(world) {
  const { w, h, N, biome, temp, moist, river, height } = world;
  const rng = new RNG((world.seed ^ 0x2b7e1516) >>> 0);
  const nA = makeNoise2D(new RNG((world.seed ^ 0x13579b) >>> 0));
  const nB = makeNoise2D(new RNG((world.seed ^ 0x2468ac) >>> 0));
  const nC = makeNoise2D(new RNG((world.seed ^ 0x97531f) >>> 0));
  const field = (n, x, y, f) => (fbm(n, x * f, y * f, 3) + 1) / 2; // 0..1
  const res = new Uint8Array(N);
  const nearWater = (i) => { const x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && BIOMES[biome[yy * w + xx]].water) return true; } return false; };
  for (let i = 0; i < N; i++) {
    const x = i % w, y = (i / w) | 0;
    const b = biome[i];
    const ore = field(nA, x, y, 0.045), basin = field(nB, x, y, 0.035), climate = field(nC, x, y, 0.05);
    const r = rng.next();
    let k = 0;
    switch (b) {
      case B.MOUNTAIN:
        if (ore > 0.62 && r < 0.16) k = R.IRON;
        else if (ore < 0.42 && r < 0.06) k = R.GOLD;
        else if (ore > 0.48 && r < 0.03) k = R.GEMS;
        else if (basin < 0.45 && r < 0.08) k = R.MARBLE;
        else if (r < 0.025) k = R.STONE;
        break;
      case B.HILLS:
        if (ore > 0.6 && r < 0.12) k = R.IRON;
        else if (basin > 0.6 && r < 0.1) k = R.COAL;
        else if (temp[i] > 0.48 && temp[i] < 0.86 && climate > 0.5 && r < 0.14) k = R.WINE;
        else if (basin < 0.45 && r < 0.05) k = R.MARBLE;
        else if (r < 0.04) k = R.STONE;
        break;
      case B.FOREST: case B.TAIGA:
        if (basin > 0.64 && r < 0.06) k = R.COAL;
        else if (r < 0.035) k = R.GAME;
        break;
      case B.JUNGLE: case B.SWAMP:
        if (temp[i] > 0.68 && moist[i] > 0.5 && climate > 0.5 && r < 0.06) k = R.SPICES;
        else if (r < 0.03) k = R.GAME;
        break;
      case B.DESERT:
        if (climate < 0.5 && r < 0.06) k = R.SALT;
        else if (ore < 0.42 && r < 0.015) k = R.GOLD;
        else if (temp[i] > 0.75 && climate > 0.6 && r < 0.02) k = R.SPICES;
        break;
      case B.TUNDRA: if (climate < 0.48 && r < 0.04) k = R.SALT; else if (basin > 0.65 && r < 0.04) k = R.COAL; break;
      case B.GRASS: case B.PLAINS:
        if (river[i] && climate > 0.4 && r < 0.12) k = R.FERTILE;
        else if (b === B.PLAINS && basin > 0.5 && r < 0.1) k = R.HORSES;
        else if (b === B.GRASS && basin > 0.62 && r < 0.02) k = R.HORSES;
        else if (temp[i] > 0.52 && temp[i] < 0.84 && climate > 0.58 && r < 0.04) k = R.WINE;
        else if (r < 0.006) k = R.FERTILE;
        break;
      case B.BEACH: if (climate < 0.48 && r < 0.06) k = R.SALT; break;
      case B.SHALLOW: if (nearWater(i) && climate > 0.45 && r < 0.08) k = R.FISH; break;
      default: break;
    }
    void height;
    res[i] = k;
  }
  world.resource = res;
  // recount province deposits and potential
  for (const P of world.provinces) {
    P.resources = {};
    for (const t of P.tiles) if (res[t]) P.resources[res[t]] = (P.resources[res[t]] || 0) + 1;
    // fish banks just offshore count for coastal provinces
    if (P.coastal) for (const t of P.tiles) { const x = t % w, y = (t / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (world.province[j] < 0 && res[j]) P.resources[res[j]] = (P.resources[res[j]] || 0) + 1; } }
    const pot = { ...P.avg };
    for (const r in P.resources) { const D = RESOURCES[r]; if (D?.sector) pot[D.sector] += Math.min(P.resources[r], 4) * D.bonus * 0.25; }
    P.pot = pot;
  }
  assignTraits(world);
}

// ---------------- Province traits ----------------
// fx: mul (production by quality key), max (+building levels), forbid, slots, tax, trade, defense, build, stability
export const TRAITS = {
  fertile_valley: { name: 'Fertile Valley', icon: '❀', color: '#7fd16b', desc: 'River-fed soil: +30% food, farms +1 level, +1 building slot.', fx: { mul: { food: 0.3 }, max: { farm: 1 }, slots: 1 } },
  rich_vein: { name: 'Rich Vein', icon: '⛏', color: '#c9a050', desc: 'Deep ore: +35% mining, mines +1 level.', fx: { mul: { iron: 0.35 }, max: { mine: 1 } } },
  crossroads: { name: 'Trade Crossroads', icon: '⚖', color: '#e6c068', desc: 'Where roads meet: +15% taxes, markets +1 level, +1 building slot.', fx: { tax: 0.15, max: { market: 1 }, slots: 1, trade: 0.2 } },
  holy_site: { name: 'Holy Site', icon: '✝', color: '#d8d0ff', desc: 'A sacred place: temples +1 level, +3 stability while held, pilgrims bring gold.', fx: { max: { temple: 1 }, stability: 3, tax: 0.05 } },
  marshy: { name: 'Marshland', icon: '≈', color: '#6a9a7a', desc: 'Soggy ground: −20% build speed, farms at most level 1.', fx: { build: -0.2, cap: { farm: 1 } } },
  barren: { name: 'Barren Land', icon: '░', color: '#c8b080', desc: 'Poor soil: no farms or pastures; +20% stone.', fx: { forbid: ['farm', 'pasture'], mul: { stone: 0.2 } } },
  timberland: { name: 'Timberland', icon: '♣', color: '#4f9a4f', desc: 'Old forest: +30% wood, lumber camps +1 level.', fx: { mul: { wood: 0.3 }, max: { lumber_camp: 1 } } },
  fishing_banks: { name: 'Fishing Banks', icon: '🐟', color: '#6fc3e8', desc: 'Teeming waters: +35% fish, harbours +1 level.', fx: { mul: { fish: 0.35 }, max: { port: 1 } } },
  natural_harbour: { name: 'Natural Harbour', icon: '⚓', color: '#5a9ad8', desc: 'Sheltered bay: harbours +1 level, +20% trade, +1 building slot.', fx: { max: { port: 1 }, trade: 0.2, slots: 1 } },
  highlands: { name: 'Highlands', icon: '▲', color: '#a09080', desc: 'Rugged hills: +20 defense here, −1 building slot.', fx: { defense: 20, slots: -1 } },
  steppe: { name: 'Open Steppe', icon: '≋', color: '#c8c070', desc: 'Endless grass: pastures +1 level, +25% horses and wool.', fx: { max: { pasture: 1 }, mul: { food: 0.05 } } },
};
export const TRAIT_LIST = Object.keys(TRAITS);

export function assignTraits(world) {
  const rng = new RNG((world.seed ^ 0x6a09e667) >>> 0);
  for (const P of world.provinces) {
    const n = P.tiles.length || 1;
    const share = (...bs) => bs.reduce((s, b) => s + (P.biomes[b] || 0), 0) / n;
    const res = (k) => P.resources[k] || 0;
    const t = [];
    const roll = rng.next(), roll2 = rng.next();
    if (P.river && share(B.GRASS, B.PLAINS) > 0.35 && (res(R.FERTILE) || roll < 0.45)) t.push('fertile_valley');
    if (res(R.IRON) + res(R.GOLD) + res(R.COAL) + res(R.GEMS) >= 2) t.push('rich_vein');
    if (P.neighbors.length >= 6 && share(B.GRASS, B.PLAINS, B.BEACH, B.HILLS) > 0.3 && roll2 < 0.55) t.push('crossroads');
    if (share(B.SWAMP) > 0.3) t.push('marshy');
    if (share(B.DESERT, B.TUNDRA, B.SNOW) > 0.5) t.push('barren');
    if (share(B.FOREST, B.TAIGA, B.JUNGLE) > 0.6) t.push('timberland');
    if (res(R.FISH) >= 2) t.push('fishing_banks');
    else if (P.coastal && roll < 0.12) t.push('natural_harbour');
    if (share(B.HILLS, B.MOUNTAIN) > 0.45) t.push('highlands');
    if (share(B.PLAINS) > 0.42) t.push('steppe');
    if (roll2 > 0.975 && !t.includes('barren')) t.push('holy_site');
    P.traits = t.slice(0, 3);
  }
}

// Aggregated trait effects of a province
export function traitFx(P) {
  const out = { mul: {}, max: {}, cap: {}, forbid: [], slots: 0, tax: 0, trade: 0, defense: 0, build: 0, stability: 0 };
  for (const k of P?.traits || []) {
    const f = TRAITS[k]?.fx;
    if (!f) continue;
    for (const g in f.mul || {}) out.mul[g] = (out.mul[g] || 0) + f.mul[g];
    for (const b in f.max || {}) out.max[b] = (out.max[b] || 0) + f.max[b];
    for (const b in f.cap || {}) out.cap[b] = f.cap[b];
    out.forbid.push(...(f.forbid || []));
    for (const k2 of ['slots', 'tax', 'trade', 'defense', 'build', 'stability']) out[k2] += f[k2] || 0;
  }
  return out;
}
