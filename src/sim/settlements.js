import { traitFx, TRAITS } from '../world/regions.js';
import { R } from '../data/biomes.js';
import { lawHook } from './politics.js';
import { G, S, log, emit, civOf } from './state.js';
import { STAGES, BUILDINGS, maxLevel } from '../data/buildings.js';
import { GOODS, GOOD_LIST } from '../data/goods.js';
import { BIOMES, B } from '../data/biomes.js';
import { RACES } from '../data/races.js';
import { settlementName } from '../core/names.js';
import { clamp } from '../core/util.js';
import { mods, invalidateMods } from './mods.js';
import { findPath } from './pathfind.js';
import { neighbors4 } from '../world/worldgen.js';

export function chooseSite(prov, race) {
  const { w, h, biome, river } = G.world;
  const pref = RACES[race].habitat;
  const nb = [];
  let best = -1, bs = -Infinity;
  for (const t of prov.tiles) {
    const b = biome[t];
    if (b === B.MOUNTAIN || b === B.SNOW) continue;
    let s = 0;
    if (river[t]) s += 3;
    if (pref.includes(b)) s += 2;
    if (b === B.GRASS || b === B.PLAINS) s += 1;
    if (b === B.SWAMP || b === B.JUNGLE) s -= 1.5;
    let landN = 0;
    for (const j of neighbors4(t, w, h, nb)) {
      if (BIOMES[biome[j]].water) { if (biome[j] !== B.LAKE) s += 0.8; else s += 0.5; } else landN++;
    }
    if (landN < 2) s -= 3;
    const dx = (t % w) - prov.cx, dy = ((t / w) | 0) - prov.cy;
    s -= 0.18 * Math.sqrt(dx * dx + dy * dy);
    if (s > bs) { bs = s; best = t; }
  }
  return best >= 0 ? best : prov.center;
}

export function foundSettlement(civ, provId, tile, pop, opts = {}) {
  const st = S();
  const pst = st.provinces[provId];
  if (pst.claimedBy >= 0) {
    const claimer = st.settlements[pst.claimedBy];
    if (claimer) claimer.claims = claimer.claims.filter((c) => c !== provId);
  }
  let name = settlementName(civ.race, G.rng);
  const taken = new Set(st.settlements.map((x) => x.name));
  for (let k = 0; taken.has(name) && k < 25; k++) name = settlementName(civ.race, G.rng);
  if (taken.has(name)) name += ' ' + ['Minor', 'Nova', 'Secundus', 'Ford'][G.rng.int(0, 3)];
  const s = {
    id: st.settlements.length, name, civ: civ.id, province: provId, tile,
    pop, housing: Math.round(pop + 12), stage: 0, buildings: {}, queue: [], claims: [], pops: { peasants: pop },
    founded: st.day, works: [], isCapital: false, last: null, rev: 0, dead: false, culture: civ.race, unrest: 0, faith: civ.faith, convert: 0, assim: 0,
  };
  st.settlements.push(s);
  civ.settlements.push(s.id);
  pst.owner = civ.id; pst.settlement = s.id; pst.claimedBy = -1;
  if (opts.capital || civ.capital < 0 || !st.settlements[civ.capital] || st.settlements[civ.capital].dead) setCapital(civ, s);
  G.dirty.owners = true;
  emit('ownership', provId);
  return s;
}

export function setCapital(civ, s) {
  const st = S();
  if (civ.capital >= 0 && st.settlements[civ.capital]) st.settlements[civ.capital].isCapital = false;
  civ.capital = s.id;
  s.isCapital = true;
  s.rev++;
}

export function provinceTiles(s) {
  const W = G.world;
  let t = W.provinces[s.province].tiles.length;
  for (const c of s.claims) t += W.provinces[c].tiles.length * 0.5;
  return t;
}

// Woodland share of a province (forest, taiga, jungle), cached: world data never changes
function woodShare(P) { return ((P.biomes[B.FOREST] || 0) + (P.biomes[B.TAIGA] || 0) + (P.biomes[B.JUNGLE] || 0)) / P.tiles.length; }
const hasWoods = (P) => woodShare(P) >= 0.12 || P.pot.wood >= 0.35;
// Best timber in a neighbouring province: treeless places haul wood from the next woods
export function nearbyTimber(P) {
  const W = G.world;
  if (W._timber?.[P.id] !== undefined) return W._timber[P.id];
  W._timber ??= {};
  let best = 0;
  for (const n of P.neighbors) { const Q = W.provinces[n]; if (Q && hasWoods(Q)) best = Math.max(best, Q.pot.wood, 0.35); }
  return (W._timber[P.id] = best);
}
export function quality(s) {
  const W = G.world;
  const pot = { ...W.provinces[s.province].pot };
  // Timber hauled from neighbouring woods (at half the yield)
  pot.wood = Math.max(pot.wood, nearbyTimber(W.provinces[s.province]) * 0.5);
  for (const c of s.claims) {
    const cp = W.provinces[c].pot;
    for (const k in pot) pot[k] += cp[k] * 0.35;
  }
  return {
    food: clamp(0.3 + pot.food * 0.9, 0.2, 2.6),
    wood: clamp(0.25 + pot.wood, 0.15, 2.6),
    stone: clamp(0.25 + pot.stone, 0.15, 2.6),
    iron: clamp(0.15 + pot.iron * 1.1, 0.1, 2.6),
    gold: clamp(0.6 + pot.gold * 1.2, 0.4, 2.6),
    knowledge: 1,
    fish: clamp(0.6 + (W.provinces[s.province].resources[5] || 0) * 0.25, 0.5, 2.2),
    spices: clamp(0.4 + spiceShare(W.provinces[s.province]) * 2 + depositsOf(s, R.SPICES) * 0.25, 0.3, 2.6),
    ...traitQuality(s, pot),
  };
}
// Phase 14: province traits multiply local yields
function traitQuality(s, pot) {
  const f = traitFx(G.world.provinces[s.province]);
  const out = {};
  for (const k in f.mul) {
    const base = k === 'food' ? 0.3 + pot.food * 0.9 : k === 'wood' ? 0.25 + pot.wood : k === 'stone' ? 0.25 + pot.stone : k === 'iron' ? 0.15 + pot.iron * 1.1 : k === 'fish' ? 0.6 + (G.world.provinces[s.province].resources[5] || 0) * 0.25 : null;
    if (base != null) out[k] = clamp(base * (1 + f.mul[k]), 0.1, 3.2);
  }
  return out;
}
// Deposits of the given kinds in a settlement's province and claimed provinces
export function depositsOf(s, ...kinds) {
  const W = G.world;
  let n = 0;
  for (const p of [s.province, ...(s.claims || [])]) { const r = W.provinces[p]?.resources || {}; for (const k of kinds) n += r[k] || 0; }
  return n;
}
// Building slots: production and service buildings share a limited number of plots
export const SLOT_FREE = new Set(['town_hall', 'walls', 'road', 'granary', 'warehouse', 'aqueduct', 'castle', 'star_fort', 'farm']);
export function slotsOf(s) { return Math.max(2, [3, 5, 7, 9, 11][s.stage] + traitFx(G.world.provinces[s.province]).slots); }
export function slotsUsed(s) {
  const types = new Set(Object.keys(s.buildings).filter((k) => s.buildings[k] > 0 && !SLOT_FREE.has(k)));
  for (const q of s.queue) if (!SLOT_FREE.has(q.type)) types.add(q.type);
  return types.size;
}
// Why a building cannot stand here (terrain, deposits or traits), or null
export function landBlock(s, type) {
  const P = G.world.provinces[s.province];
  const tf = traitFx(P);
  if (tf.forbid.includes(type)) return `Not possible here (${(P.traits || []).map((t) => TRAITS[t].name).join(', ')})`;
  const share = (...bs) => bs.reduce((a, b) => a + (P.biomes[b] || 0), 0) / P.tiles.length;
  switch (type) {
    case 'farm': if (P.pot.food < 0.3) return 'Soil too poor to farm'; break;
    case 'lumber_camp': if (!hasWoods(P) && !nearbyTimber(P) && !(s.claims || []).some((c) => hasWoods(G.world.provinces[c]))) return 'Needs woodland in or next to this province'; break;
    case 'mine': if (!depositsOf(s, R.IRON, R.GOLD, R.COAL, R.GEMS)) return 'Needs an ore deposit (iron, coal, gold or gems)'; break;
    case 'quarry': if (!depositsOf(s, R.STONE, R.MARBLE) && share(B.HILLS, B.MOUNTAIN) < 0.2) return 'Needs rocky land or a marble/stone deposit'; break;
    case 'plantation': if (!depositsOf(s, R.SPICES)) return 'Needs spice groves'; break;
    case 'jeweller': if (!depositsOf(s, R.GOLD, R.GEMS)) return 'Needs gold or gems nearby'; break;
    default: break;
  }
  return null;
}
export function maxLevelHere(s, type) {
  const def = BUILDINGS[type];
  const tf = traitFx(G.world.provinces[s.province]);
  const b = tf.max[type] || 0;
  let m = def.max === 1 ? 1 : Math.min(def.max + b, s.stage + 1 + b);
  if (tf.cap[type] != null) m = Math.min(m, tf.cap[type]);
  return m;
}
// Share of a province that is jungle, desert or swamp (spice country)
export function spiceShare(P) {
  return ((P.biomes[B.JUNGLE] || 0) + (P.biomes[B.DESERT] || 0) + (P.biomes[B.SWAMP] || 0)) / P.tiles.length;
}
export function pastureShare(P) {
  return ((P.biomes[B.GRASS] || 0) + (P.biomes[B.PLAINS] || 0)) / P.tiles.length;
}

export function sectorBonus(s, sector) {
  let b = 1;
  for (const k in s.buildings) {
    const d = BUILDINGS[k];
    if (d.sector === sector) b += d.bonus * s.buildings[k];
  }
  return b;
}
export function sumBuildingField(s, field) {
  let v = 0;
  for (const k in s.buildings) {
    const d = BUILDINGS[k];
    if (d[field]) v += d[field] * s.buildings[k];
  }
  return v;
}
export const lvl = (s, type) => s.buildings[type] || 0;

export function maxHousing(civ, s) {
  return Math.round(provinceTiles(s) * STAGES[s.stage].density * mods(civ).housing * (1 + sumBuildingField(s, 'housing')));
}

export function targetStage(s) {
  let st = 0;
  for (let i = 1; i < STAGES.length; i++) {
    const S_ = STAGES[i];
    if (s.pop >= S_.minPop && S_.req.every((r) => lvl(s, r) > 0)) st = i; else break;
  }
  return st;
}

export function updateStage(civ, s) {
  const t = targetStage(s);
  if (t > s.stage) {
    s.stage++;
    s.rev++;
    log(`${s.name} has grown into a ${STAGES[s.stage].name}.`, { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer, tile: s.tile });
    emit('settlement', s);
  } else if (s.stage > 0 && s.pop < STAGES[s.stage].minPop * 0.6) {
    s.stage--;
    s.rev++;
    log(`${s.name} has declined to a ${STAGES[s.stage].name}.`, { civ: civ.id, type: 'bad', toast: civ.isPlayer, tile: s.tile });
  }
}

export function storageCaps(civ) {
  const st = S();
  let gran = 0, wh = 0;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    gran += lvl(s, 'granary'); wh += lvl(s, 'warehouse');
  }
  const n = civ.settlements.length;
  const caps = {};
  for (const g of GOOD_LIST) {
    const base = GOODS[g].base;
    caps[g] = Math.round((150 + 80 * n) * (base <= 4 ? 1.3 : base <= 10 ? 0.6 : 0.35) + 200 * wh);
  }
  caps.grain += 300 * gran; caps.fish += 300 * gran;
  caps.food = caps.grain; // legacy alias
  return caps;
}

// ---------- Construction ----------
export function queuedCount(s, type) { return s.queue.filter((q) => q.type === type).length; }

export function buildCost(civ, s, type) {
  const def = BUILDINGS[type];
  const level = lvl(s, type) + queuedCount(s, type);
  const m = mods(civ).cost * (1 + 0.6 * level);
  const c = {};
  for (const k in def.cost) c[k] = Math.ceil(def.cost[k] * m);
  return c;
}

// Goods a realm lacks can be imported from abroad for gold at a steep markup.
export const IMPORT_MARKUP = 2.5;
export function importPrice(civ, g) {
  const base = (GOODS[g]?.base ?? 2) * 0.25;
  return Math.max(base, civ.market?.price?.[g] ?? base) * (civ.laws ? lawHook(civ, 'markup') : IMPORT_MARKUP);
}
export function importCost(civ, cost) {
  let gold = 0;
  for (const k in cost) {
    if (k === 'gold' || !GOODS[k]) continue;
    const short = cost[k] - Math.max(0, civ.stock[k] || 0);
    if (short > 0) gold += short * importPrice(civ, k);
  }
  return gold;
}
export function canAfford(civ, cost, allowImport = true) {
  let short = false;
  for (const k in cost) {
    if (k === 'gold') continue;
    if ((civ.stock[k] || 0) < cost[k]) { if (!allowImport || !GOODS[k]) return false; short = true; }
  }
  const infl = 1 + (civ.inflation || 0) / 100; // Phase 19: hoarding drives prices up
  if (!short) return civ.treasury >= (cost.gold || 0) * infl;
  // AI realms only import while they keep a cash reserve (about a year of state wages)
  const reserve = civ.isPlayer && !civ.autoBuild ? 0 : 60 + (civ.last?.stateWages || 0) * 12 + (civ.last?.salaries || 0) * 12;
  return civ.treasury >= ((cost.gold || 0) + importCost(civ, cost)) * infl + reserve;
}
// Register goods a realm wanted but could not get: raises their price (demand signal).
export function wantGoods(civ, cost, share = 0.25) {
  if (!civ.market?.used) return;
  for (const k in cost) {
    if (k === 'gold') continue;
    const short = cost[k] - (civ.stock[k] || 0);
    if (short > 0) civ.market.used[k] = (civ.market.used[k] || 0) + short * share;
  }
}
export function pay(civ, cost) {
  for (const k in cost) {
    if (k === 'gold') { civ.treasury -= cost[k] * (1 + (civ.inflation || 0) / 100); continue; }
    const have = Math.max(0, civ.stock[k] || 0);
    const short = cost[k] - have;
    if (short > 0 && GOODS[k]) {
      // import the shortfall; the unmet demand also pushes up the local price
      const g = short * importPrice(civ, k) * (1 + (civ.inflation || 0) / 100);
      civ.treasury -= g;
      civ.imports = (civ.imports || 0) + g;
      civ.stock[k] = have;
    }
    civ.stock[k] -= Math.min(cost[k], have);
    if (civ.market?.used) civ.market.used[k] = (civ.market.used[k] || 0) + cost[k];
  }
}

export function hasTech(civ, t) { return civ.techs.includes(t); }

export function canBuild(civ, s, type, ignoreCost = false) {
  const def = BUILDINGS[type];
  const P = G.world.provinces[s.province];
  if (def.tech && !hasTech(civ, def.tech)) return { ok: false, reason: 'Requires technology', hidden: true };
  if (s.stage < def.stage) return { ok: false, reason: `Requires ${STAGES[def.stage].short}` };
  const level = lvl(s, type) + queuedCount(s, type);
  const lb = landBlock(s, type);
  if (lb) return { ok: false, reason: lb, land: true };
  if (level >= maxLevelHere(s, type)) return { ok: false, reason: level >= def.max ? 'Maximum level' : 'Settlement too small for next level' };
  if (level === 0 && !SLOT_FREE.has(type) && slotsUsed(s) >= slotsOf(s)) return { ok: false, reason: `No free building slot (${slotsUsed(s)}/${slotsOf(s)}) — grow the town or specialise`, slots: true };
  if (def.needs === 'coastal' && !P.coastal) return { ok: false, reason: 'Requires coast', hidden: true };
  if (def.needs === 'stone' && P.pot.stone < 0.25) return { ok: false, reason: 'No rocky land' };
  if (def.needs === 'iron' && P.pot.iron < 0.15) return { ok: false, reason: 'No ore deposits' };
  if (def.needs === 'neighbor' && civ.settlements.length < 2) return { ok: false, reason: 'Needs another settlement' };
  if (def.needs === 'spices' && spiceShare(P) < 0.15) return { ok: false, reason: 'Needs jungle, desert or swamp', hidden: true };
  if (def.needs === 'pasture' && pastureShare(P) < 0.2) return { ok: false, reason: 'Needs grass or plains' };
  if (s.queue.length >= 2) return { ok: false, reason: 'Construction queue full' };
  const cost = buildCost(civ, s, type);
  if (!ignoreCost && !canAfford(civ, cost)) return { ok: false, reason: 'Not enough resources', cost };
  return { ok: true, cost };
}

export function startBuild(civ, s, type) {
  const r = canBuild(civ, s, type);
  if (!r.ok) return r;
  pay(civ, r.cost);
  const level = lvl(s, type) + queuedCount(s, type);
  s.queue.push({ type, progress: 0, total: Math.round(BUILDINGS[type].days * (1 + 0.3 * level)) });
  return r;
}

export function cancelBuild(civ, s, index) {
  const q = s.queue[index];
  if (!q) return;
  s.queue.splice(index, 1);
  const def = BUILDINGS[q.type];
  // refund 50%
  const m = mods(civ).cost * (1 + 0.6 * (lvl(s, q.type) + queuedCount(s, q.type)));
  for (const k in def.cost) {
    const v = Math.floor(def.cost[k] * m * 0.5);
    if (k === 'gold') civ.treasury += v; else civ.stock[k] += v;
  }
}

export function dailyConstruction(civ) {
  const st = S();
  const speed = mods(civ).build;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    const q = s.queue[0];
    if (!q) continue;
    q.progress += speed * (1 + traitFx(G.world.provinces[s.province]).build);
    if (q.progress >= q.total) {
      s.queue.shift();
      s.buildings[q.type] = (s.buildings[q.type] || 0) + 1;
      s.rev++;
      if (q.type === 'road') buildRoad(civ, s);
      if (civ.isPlayer) log(`${BUILDINGS[q.type].name} completed in ${s.name}.`, { civ: civ.id, type: 'good', tile: s.tile });
      emit('settlement', s);
    }
  }
}

export function buildRoad(civ, s) {
  const st = S();
  const W = G.world;
  let best = null, bd = Infinity;
  const sx = s.tile % W.w, sy = (s.tile / W.w) | 0;
  for (const id of civ.settlements) {
    if (id === s.id) continue;
    const o = st.settlements[id];
    if (st.roads.some((r) => (r.a === s.id && r.b === o.id) || (r.a === o.id && r.b === s.id))) continue;
    const dx = (o.tile % W.w) - sx, dy = ((o.tile / W.w) | 0) - sy;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const path = findPath(s.tile, best.tile, { maxNodes: 30000 });
  if (!path) return;
  st.roads.push({ civ: civ.id, a: s.id, b: best.id, path });
  G.dirty.roads = true;
}

// ---------- Territory ----------
export function claimProvinces(civ) {
  const st = S();
  const W = G.world;
  const maxClaims = [0, 0, 1, 3, 5];
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (s.claims.length >= maxClaims[s.stage]) continue;
    const pool = new Set(W.provinces[s.province].neighbors);
    for (const c of s.claims) for (const n of W.provinces[c].neighbors) pool.add(n);
    let best = -1, bv = -1;
    for (const p of pool) {
      const ps = st.provinces[p];
      if (ps.owner >= 0) continue;
      if (st.units.some((u) => u.target === p)) continue;
      const pot = W.provinces[p].pot;
      const v = pot.food + pot.wood + pot.stone + pot.iron + pot.gold + G.rng.next() * 0.3;
      if (v > bv) { bv = v; best = p; }
    }
    if (best >= 0) {
      st.provinces[best].owner = civ.id;
      st.provinces[best].claimedBy = s.id;
      s.claims.push(best);
      G.dirty.owners = true;
      emit('ownership', best);
      if (civ.isPlayer) log(`${s.name} extends its influence over ${W.provinces[best].name}.`, { civ: civ.id, type: 'good', tile: W.provinces[best].center });
    }
  }
}

export function abandonSettlement(civ, s, reason = 'abandoned') {
  const st = S();
  const W = G.world;
  s.dead = true;
  civ.settlements = civ.settlements.filter((id) => id !== s.id);
  const release = (p) => { const ps = st.provinces[p]; ps.owner = -1; ps.settlement = -1; ps.claimedBy = -1; };
  release(s.province);
  for (const c of s.claims) release(c);
  s.claims = [];
  st.roads = st.roads.filter((r) => r.a !== s.id && r.b !== s.id);
  G.dirty.owners = true; G.dirty.roads = true;
  emit('ownership', s.province);
  log(`${s.name} has been ${reason}.`, { civ: civ.id, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, tile: s.tile });
  if (s.isCapital && civ.settlements.length) {
    const next = civ.settlements.map((id) => st.settlements[id]).sort((a, b) => b.pop - a.pop)[0];
    setCapital(civ, next);
    log(`${next.name} becomes the new capital of ${civ.displayName}.`, { civ: civ.id, type: 'world' });
  }
  invalidateMods(civ);
  void W;
}

// Conquest: hand a settlement (with its province and claims) to another civilization.
export function transferSettlement(s, newCiv) {
  const st = S();
  const old = st.civs[s.civ];
  old.settlements = old.settlements.filter((id) => id !== s.id);
  const wasCapital = s.isCapital;
  s.isCapital = false;
  s.civ = newCiv.id;
  s.queue = [];
  newCiv.settlements.push(s.id);
  st.provinces[s.province].owner = newCiv.id;
  for (const c of s.claims) st.provinces[c].owner = newCiv.id;
  st.roads = st.roads.filter((r) => r.a !== s.id && r.b !== s.id);
  s.rev++;
  if (wasCapital && old.settlements.length) {
    const next = old.settlements.map((id) => st.settlements[id]).sort((a, b) => b.pop - a.pop)[0];
    setCapital(old, next);
  }
  if (newCiv.capital < 0 || !st.settlements[newCiv.capital] || st.settlements[newCiv.capital].civ !== newCiv.id) setCapital(newCiv, s);
  invalidateMods(old); invalidateMods(newCiv);
  G.dirty.owners = true; G.dirty.roads = true;
  emit('ownership', s.province);
}

export function civPopulation(civ) {
  const st = S();
  let p = 0;
  for (const id of civ.settlements) p += st.settlements[id].pop;
  return p;
}
export const settlementsOf = (civ) => civ.settlements.map((id) => S().settlements[id]);
export { civOf };
