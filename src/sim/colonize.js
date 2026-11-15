import { G, S, log, civOf } from './state.js';
import { BIOMES } from '../data/biomes.js';
import { findPath } from './pathfind.js';
import { chooseSite, foundSettlement, canAfford, pay } from './settlements.js';
import { canSail, portSettlements, portProvinces } from './naval.js';

export const COLONISTS = 20;
export const MIN_SOURCE_POP = 45;

export function colonyCost(civ) {
  const f = 1 + 0.15 * Math.max(0, civ.settlements.length - 1);
  return { grain: Math.round(40 * f), wood: Math.round(25 * f), gold: Math.round(15 * f) };
}

const isFree = (civ, p) => {
  const ps = S().provinces[p];
  return ps.owner < 0 || (ps.owner === civ.id && ps.settlement < 0);
};

export function colonizeTargets(civ) {
  const st = S();
  const W = G.world;
  const targeted = new Set(st.units.filter((u) => u.civ === civ.id).map((u) => u.target));
  const out = new Set();
  st.provinces.forEach((ps, p) => {
    if (ps.owner !== civ.id) return;
    if (ps.settlement < 0 && !targeted.has(p)) out.add(p);
    for (const n of W.provinces[p].neighbors) if (isFree(civ, n) && !targeted.has(n)) out.add(n);
  });
  // Overseas: free coastal provinces within sailing range of our harbours
  if (canSail(civ)) {
    const ports = portSettlements(civ).map((s) => s.tile);
    W.provinces.forEach((P, p) => {
      if (!P.coastal || targeted.has(p) || !isFree(civ, p)) return;
      if (ports.some((t) => Math.abs((t % W.w) - P.cx) + Math.abs(((t / W.w) | 0) - P.cy) <= 45)) out.add(p);
    });
  }
  return [...out];
}
export const isOverseas = (civ, p) => {
  const W = G.world;
  const L = W.provinces[p].landmass;
  return !civ.settlements.some((id) => W.landmass[S().settlements[id].tile] === L);
};

function sourceFor(civ, p) {
  const st = S();
  const W = G.world;
  const P = W.provinces[p];
  const sail = canSail(civ);
  let best = null, bd = Infinity;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (s.pop < MIN_SOURCE_POP) continue;
    if (W.landmass[s.tile] !== P.landmass && !(sail && s.buildings.port)) continue;
    const dx = (s.tile % W.w) - P.cx, dy = ((s.tile / W.w) | 0) - P.cy;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function canColonize(civ, p) {
  if (!isFree(civ, p)) return { ok: false, reason: 'Province is already settled' };
  const st = S();
  if (st.units.some((u) => u.civ === civ.id && u.target === p)) return { ok: false, reason: 'Settlers already on their way' };
  if (!colonizeTargets(civ).includes(p)) return { ok: false, reason: canSail(civ) ? 'Must border your territory or be a coast within 45 tiles of a harbour' : 'Must border your territory (or research Sailing and build a Harbour to settle overseas)' };
  const src = sourceFor(civ, p);
  if (!src) return { ok: false, reason: `Needs a settlement with ${MIN_SOURCE_POP}+ people on this landmass (or a harbour town)` };
  const cost = colonyCost(civ);
  if (isOverseas(civ, p)) { cost.wood += 30; cost.gold += 20; }
  if (!canAfford(civ, cost)) return { ok: false, reason: 'Not enough resources', cost, source: src };
  return { ok: true, cost, source: src };
}

export function sendColonists(civ, p) {
  const r = canColonize(civ, p);
  if (!r.ok) return r;
  const st = S();
  const P = G.world.provinces[p];
  const site = chooseSite(P, civ.race);
  let path = G.world.landmass[r.source.tile] === P.landmass ? findPath(r.source.tile, site) : null;
  if (!path && canSail(civ)) path = findPath(r.source.tile, site, { mode: 'amphibious', portProvinces: portProvinces(civ), maxNodes: 150000 });
  if (!path) return { ok: false, reason: 'No route' };
  pay(civ, r.cost);
  r.source.pop -= COLONISTS;
  st.units.push({
    id: st.nextUnitId++, kind: 'colonists', civ: civ.id, from: r.source.id, target: p, site,
    path, step: 0, mp: 0, pop: COLONISTS,
  });
  if (civ.isPlayer) log(`Settlers depart ${r.source.name} for ${P.name}.`, { civ: civ.id, type: 'info', tile: site });
  return r;
}

export function stepCost(tile) {
  const W = G.world;
  const b = BIOMES[W.biome[tile]];
  if (b.water) return 0.5;
  return b.cost + (W.river[tile] ? 0.5 : 0);
}

export function dailyUnits() {
  const st = S();
  const W = G.world;
  const done = [];
  for (const u of st.units) {
    const civ = civOf(u.civ);
    if (!civ.alive) { done.push(u); continue; }
    u.mp += 1.4;
    while (u.step < u.path.length - 1) {
      const c = stepCost(u.path[u.step + 1]);
      if (u.mp < c) break;
      u.mp -= c;
      u.step++;
    }
    if (u.step < u.path.length - 1) continue;
    done.push(u);
    // Arrived
    if (isFree(civ, u.target)) {
      const s = foundSettlement(civ, u.target, u.site, u.pop);
      log(`${civ.isPlayer ? 'Our settlers' : civ.displayName} founded ${s.name} in ${W.provinces[u.target].name}.`,
        { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer, tile: s.tile });
    } else {
      const home = civ.settlements.map((id) => st.settlements[id])[0];
      if (home) home.pop += u.pop;
      if (civ.isPlayer) log(`${W.provinces[u.target].name} was settled by others first. Our settlers return home.`, { civ: civ.id, type: 'bad' });
    }
  }
  if (done.length) st.units = st.units.filter((u) => !done.includes(u));
}
