import { G, S } from './state.js';
import { BUILDING_LIST } from '../data/buildings.js';
import { PERSONALITIES } from '../data/governments.js';
import { RACES } from '../data/races.js';
import { mods } from './mods.js';
import { availableTechs, setResearch } from './tech.js';
import { canBuild, startBuild, quality, storageCaps, lvl, canAfford, maxHousing, wantGoods } from './settlements.js';
import { colonizeTargets, canColonize, sendColonists, colonyCost } from './colonize.js';
import { reformCheck, doReform } from './government.js';
import { projectLedger, basePrice } from './economy.js';
import { PRODUCTION, activePM } from '../data/goods.js';
import { warsOf } from './diplomacy.js';

export const persona = (civ) => PERSONALITIES[civ.personality || 'diplomatic'];

export function pickResearch(civ) {
  const avail = availableTechs(civ);
  if (!avail.length) return null;
  const tags = persona(civ).tags;
  const L = civ.last;
  const t = G.rng.weighted(avail, (tech) => {
    let w = 1;
    for (const tag of tech.tags) w *= tags[tag] || 1;
    if (tech.race) w *= 2.2;
    if (L?.starving && tech.tags.includes('food')) w *= 3;
    if (civ.stability < 40 && tech.tags.includes('admin')) w *= 2;
    w *= 1 / (1 + tech.era * 0.3);
    return w;
  });
  return t ? t.id : null;
}

// Value of a production building: how scarce/dear its outputs are in our market.
function marketScore(civ, s, type, ctx) {
  const P = PRODUCTION[type];
  const pm = activePM(type, civ.techs);
  if (!P || !pm) return null;
  const mk = civ.market;
  let v = 0;
  for (const g in pm.out) {
    const ratio = (mk?.price[g] ?? basePrice(g)) / basePrice(g);
    const short = (mk?.demand[g] || 0) > (mk?.supply[g] || 0) * 1.05 ? 1.5 : 0;
    v += Math.max(0, ratio - 0.75) * 2.5 + short;
  }
  // can't feed a workshop without its materials
  for (const g in pm.in || {}) if ((civ.stock[g] || 0) < 5 && (mk?.supply[g] || 0) < 1) v *= 0.3;
  const q = P.q ? (ctx.q[P.q] ?? 1) : 1;
  // spare labour makes new workplaces attractive
  const idle = (s.pops?.peasants || s.pop) / Math.max(1, s.pop);
  return 0.6 + v * (0.6 + q * 0.4) + (idle > 0.6 ? 0.8 : 0);
}

function scoreBuilding(civ, s, type, ctx) {
  const tags = persona(civ).tags;
  const { caps } = ctx;
  const st = civ.stock;
  const ms = marketScore(civ, s, type, ctx);
  if (ms != null) {
    let k = 1;
    if (type === 'farm' && civ.last?.starving) k = 3;
    if (['smithy', 'foundry', 'factory'].includes(type)) k *= tags.military;
    if (['weaver', 'carpenter', 'jeweller', 'textile_mill', 'plantation'].includes(type)) k *= tags.econ;
    if (type === 'port') k *= (ctx.landlocked ? 2.2 : 1.2) * tags.econ;
    return ms * k;
  }
  switch (type) {
    case 'granary': return st.grain > caps.grain * 0.7 || civ.last?.starving ? 3 : 0.7;
    case 'warehouse': return (st.wood > caps.wood * 0.8 || st.stone > caps.stone * 0.8) ? 3 : 0.4;
    case 'town_hall': return s.pop > 170 ? 7 : s.pop > 110 ? 3.5 : 0.6;
    case 'market': return (s.stage >= 2 ? 4.5 : 2) * tags.econ;
    case 'library': return 2.2 * tags.science;
    case 'temple': return civ.stability < 50 || s.faith !== civ.faith ? 4 : 0.9;
    case 'barracks': return (0.9 * tags.military + (s.isCapital ? 1 : 0)) * (warsOf(civ.id).length ? 3 : 1);
    case 'walls': return 0.7 * tags.military * (civ.personality === 'defensive' ? 2 : 1) * (warsOf(civ.id).length ? 2.5 : 1);
    case 'road': return 1.6;
    case 'university': return 3 * tags.science;
    case 'castle': return (warsOf(civ.id).length ? 3 : 1) * tags.military * (s.isCapital ? 1.5 : 0.7);
    case 'star_fort': return (warsOf(civ.id).length ? 3 : 0.8) * tags.military * (s.isCapital ? 1.5 : 0.6);
    case 'aqueduct': return s.pop > maxHousing(civ, s) * 0.7 ? 3.5 : 1.2;
    case 'hospital': return 1.8;
    case 'observatory': return 2.8 * tags.science;
    case 'bank': return 3 * tags.econ;
    case 'railway_station': return 2.5;
    default: return 1;
  }
}

// Phase 14: the best few buildings for a settlement (for the quick-build buttons)
export function suggestBuildings(civ, s, n = 3) {
  const ctx = { caps: storageCaps(civ), L: civ.last || projectLedger(civ), landlocked: colonizeTargets(civ).length < 2, q: quality(s) };
  const opts = [];
  for (const type of BUILDING_LIST) {
    const r = canBuild(civ, s, type);
    if (!r.ok) continue;
    opts.push([type, scoreBuilding(civ, s, type, ctx) / (1 + lvl(s, type) * 0.45)]);
  }
  return opts.sort((a, b) => b[1] - a[1]).slice(0, n).map((o) => o[0]);
}
export function chooseBuilding(civ, s, ctx) {
  const opts = [];
  for (const type of BUILDING_LIST) {
    const r = canBuild(civ, s, type, true);
    if (!r.ok) continue;
    const sc = scoreBuilding(civ, s, type, ctx) / (1 + lvl(s, type) * 0.45);
    opts.push([type, sc * (0.75 + G.rng.next() * 0.5), canBuild(civ, s, type).ok, r.cost]);
  }
  if (!opts.length) return null;
  opts.sort((a, b) => b[1] - a[1]);
  // Signal demand for what the most-wanted project lacks, then build the best affordable one.
  if (!opts[0][2]) wantGoods(civ, opts[0][3]);
  const ok = opts.find((o) => o[2] && o[1] > opts[0][1] * 0.35);
  return ok ? ok[0] : null;
}

function autoConstruct(civ) {
  const st = S();
  const ctx0 = { caps: storageCaps(civ), L: civ.last || projectLedger(civ), landlocked: colonizeTargets(civ).length < 2 };
  // keep a reserve for expansion
  const reserve = civ.isPlayer ? null : colonyCost(civ);
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (s.queue.length) continue;
    if (G.rng.next() > 0.7 * persona(civ).build) continue;
    const type = chooseBuilding(civ, s, { ...ctx0, q: quality(s) });
    if (!type) continue;
    const r = canBuild(civ, s, type);
    if (!r.ok) continue;
    if (reserve && civ.settlements.length < 4) {
      if (civ.stock.wood - (r.cost.wood || 0) < reserve.wood * 0.5 && G.rng.chance(0.5)) continue;
    }
    startBuild(civ, s, type);
  }
}

function habitatShare(civ, P) {
  const hab = RACES[civ.race].habitat, avoid = RACES[civ.race].avoid;
  let good = 0, bad = 0;
  for (const b in P.biomes) {
    if (hab.includes(+b)) good += P.biomes[b];
    if (avoid.includes(+b)) bad += P.biomes[b];
  }
  return (good - bad) / P.tiles.length;
}

function tryExpand(civ) {
  const st = S();
  const W = G.world;
  const P = persona(civ);
  const inTransit = st.units.filter((u) => u.civ === civ.id).length;
  if (inTransit >= 1 + Math.floor(civ.settlements.length / 5)) return;
  const m = mods(civ);
  let th = 0;
  for (const id of civ.settlements) th += lvl(st.settlements[id], 'town_hall');
  const admin = m.admin + th;
  let exp = P.expand * (civ.ruler.traits.includes('ambitious') ? 1.3 : 1);
  if (civ.settlements.length >= admin) exp *= civ.personality === 'expansionist' ? 0.35 : 0.12;
  if (civ.stability < 35) exp *= 0.3;
  if (G.rng.next() > 0.18 * exp) return;
  const targets = colonizeTargets(civ);
  if (!targets.length) return;
  const cap = st.settlements[civ.capital];
  let best = -1, bv = -Infinity;
  for (const p of targets) {
    const Pr = W.provinces[p];
    const pot = Pr.pot;
    let v = pot.food * 2 + pot.wood + pot.stone * 0.7 + pot.iron * 0.7 + pot.gold + habitatShare(civ, Pr) * 1.5 + Pr.tiles.length / 80;
    if (Pr.river) v += 0.4;
    if (Pr.coastal) v += 0.3;
    if (cap) {
      const dx = (cap.tile % W.w) - Pr.cx, dy = ((cap.tile / W.w) | 0) - Pr.cy;
      v -= Math.sqrt(dx * dx + dy * dy) / 40;
    }
    v += G.rng.next() * 0.4;
    if (v > bv) { bv = v; best = p; }
  }
  if (best < 0) return;
  const r = canColonize(civ, best);
  if (r.ok) sendColonists(civ, best);
}

export function aiMonthly(civ) {
  if (civ.isPlayer) {
    if (civ.autoBuild) autoConstruct(civ);
    if (civ.autoResearch && !civ.research.current) setResearch(civ, pickResearch(civ));
    return;
  }
  if (!civ.research.current) setResearch(civ, pickResearch(civ));
  autoConstruct(civ);
  tryExpand(civ);
  // emergency food focus
}

const STRATEGY = {
  expansionist: 'Expansion', diplomatic: 'Prosperity', isolationist: 'Self-Reliance',
  trader: 'Commerce', militaristic: 'Militarisation', defensive: 'Fortification',
};
const GOV_PREF = {
  expansionist: ['empire', 'monarchy'], militaristic: ['empire', 'monarchy'],
  diplomatic: ['republic', 'monarchy'], trader: ['republic', 'monarchy'],
  defensive: ['monarchy', 'theocracy'], isolationist: ['theocracy', 'monarchy'],
};

export function aiYearly(civ) {
  if (civ.isPlayer) return;
  const P = persona(civ);
  const caps = storageCaps(civ);
  // Adaptive strategy: personality sets the default, circumstances override it.
  const targets = colonizeTargets(civ).length;
  if (civ.last?.starving) civ.ai.strategy = 'Famine Relief';
  else if (civ.stability < 35) civ.ai.strategy = 'Restoring Order';
  else if (!targets) civ.ai.strategy = 'Consolidation';
  else civ.ai.strategy = STRATEGY[civ.personality];

  void caps;

  let tax = P.tax;
  if (civ.stability < 40) tax -= 0.06;
  if (civ.treasury < 0) tax += 0.05;
  civ.taxRate = Math.max(0.05, Math.min(0.4, tax));

  if (civ.stability > 40) {
    for (const g of GOV_PREF[civ.personality]) {
      if (g === civ.gov) break;
      const r = reformCheck(civ, g);
      if (r.ok && G.rng.chance(0.5)) { doReform(civ, g); break; }
    }
  }
  void canAfford;
}
