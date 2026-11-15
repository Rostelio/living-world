import { routeFactor, priceDamping } from './markets.js';
import { traitFx } from '../world/regions.js';
import { isOccupied } from './warfare.js';
import { courtStability } from './characters.js';
import { lawHook, groupsStability } from './politics.js';
import { blightMul } from './disasters.js';
// =====================================================================
// Living World economy (Phase 8): pops, jobs, goods, markets, living standards.
//  1. Buildings offer jobs; pops drift toward the jobs available (peasants by default).
//  2. Each building runs its best production method: inputs from the realm market,
//     outputs sold to it. Revenue pays wages; profits go to owners.
//  3. Pops spend their (taxed) income on needs: basic → comfort → luxury.
//     What they can buy sets their standard of living (0–10).
//  4. Supply and demand set each good's price in the realm's market.
//  5. Trade agreements, harbours and vassalage let goods flow between markets.
// =====================================================================
import { G, S, log, civOf } from './state.js';
import { clamp } from '../core/util.js';
import { STAGES } from '../data/buildings.js';
import { GOODS, GOOD_LIST, GROUPS, NEEDS, NEED_TIERS, TIER_WEIGHT, POPS, POP_LIST, PRODUCTION, activePM } from '../data/goods.js';
import { mods, invalidateMods } from './mods.js';
import { quality, sumBuildingField, lvl, maxHousing, updateStage, storageCaps, abandonSettlement } from './settlements.js';
import { progressResearch } from './tech.js';
import { armyUpkeep, besiegedSet } from './military.js';
import { fleetUpkeep, blockadedSet } from './naval.js';
import { warsOf, rel, allied } from './diplomacy.js';
import { cabinetMul, cabinetAdd, cabinetSalaries } from './cabinet.js';

export const PRICE_SCALE = 0.25; // goods prices in gold
export const HOUSE_SIZE = [5, 6, 8, 12, 18];
const STATE_WAGE = { clergy: 0.6, soldiers: 0.45, aristocrats: 0.7 };
export const basePrice = (g) => GOODS[g].base * PRICE_SCALE;

export function upkeepOf(civ, buildingLevels) {
  return buildingLevels * 0.15 + civ.settlements.length * 0.3;
}
export function treasuryReserve(civ) { return 400 + 250 * civ.settlements.length; }
export function corruptionOf(civ) {
  const ex = Math.max(0, civ.treasury - treasuryReserve(civ));
  const inc = Math.max(20, civ.last?.tax || 0);
  return ex * (0.035 + 0.035 * Math.min(1, ex / (inc * 24))); // hoards rot faster
}
// Phase 14: a realm beyond its administrative reach runs less efficiently (anti-snowball)
export function sizeEfficiency(civ) {
  const reach = (mods(civ).admin || 3) * 1.6 + 4;
  const over = Math.max(0, civ.settlements.length - reach);
  return 1 / (1 + over * 0.03);
}
export function stabilityMult(civ) { return 0.75 + 0.5 * clamp(civ.stability, 0, 100) / 100; }
export function visibleHouses(s) { return Math.ceil(s.housing / HOUSE_SIZE[s.stage]); }

// ---------------- Market state ----------------
export function ensureMarket(civ) {
  if (!civ.market) civ.market = { price: {}, supply: {}, demand: {}, used: {}, imports: {}, exports: {} };
  const m = civ.market;
  for (const g of GOOD_LIST) {
    if (m.price[g] == null) m.price[g] = basePrice(g);
    m.supply[g] ??= 0; m.demand[g] ??= 0; m.used[g] ??= 0;
    civ.stock[g] ??= 0;
  }
  return m;
}
export const price = (civ, g) => civ.market?.price[g] ?? basePrice(g);
// cheapest good of a need key (a single good or a substitution group)
function keyGoods(key) { return GROUPS[key] || [key]; }
function keyPrice(civ, key) {
  let best = Infinity;
  for (const g of keyGoods(key)) best = Math.min(best, price(civ, g) * (key === 'clothing' && g === 'cloth' ? 1.5 : 1));
  return best;
}
function keyStock(civ, key) {
  let n = 0;
  for (const g of keyGoods(key)) n += civ.stock[g] / (key === 'clothing' && g === 'cloth' ? 1.5 : 1);
  return n;
}
// Remove `qty` of a need key from stock, spread across its goods by availability.
function takeKey(civ, key, qty) {
  const goods = keyGoods(key);
  const total = keyStock(civ, key);
  if (total <= 0) return;
  for (const g of goods) {
    const mul = key === 'clothing' && g === 'cloth' ? 1.5 : 1;
    const share = (civ.stock[g] / mul) / total;
    civ.stock[g] = Math.max(0, civ.stock[g] - qty * share * mul);
  }
}

// ---------------- Pops & jobs ----------------
export function ensurePops(s) {
  if (!s.pops) s.pops = { peasants: s.pop };
  for (const t of POP_LIST) s.pops[t] ??= 0;
  s.inc ??= {}; s.solBy ??= {};
}
function normalizePops(s) {
  let sum = 0;
  for (const t of POP_LIST) sum += s.pops[t];
  if (sum <= 0) { for (const t of POP_LIST) s.pops[t] = 0; s.pops.peasants = s.pop; return; }
  const f = s.pop / sum;
  for (const t of POP_LIST) s.pops[t] *= f;
}
export function jobsOf(civ, s) {
  const jobs = {};
  for (const t of POP_LIST) jobs[t] = 0;
  for (const type in s.buildings) {
    const P = PRODUCTION[type];
    if (!P?.jobs) continue;
    const lv = s.buildings[type];
    for (const t in P.jobs) jobs[t === 'capitalists' && civ.era < 3 ? 'aristocrats' : t] += P.jobs[t] * lv;
    void PEASANT_JOBS;
  }
  jobs.aristocrats += s.pop * 0.012; // landowning gentry
  return jobs;
}
// Pops move into professions that have open jobs — but farmers only leave the
// fields for work that pays better than tilling the land.
const PEASANT_JOBS = ['farm', 'pasture', 'plantation'];
function adjustPops(civ, s, jobs) {
  const cap = s.pop * 0.7;
  const pInc = s.inc?.peasants || 0;
  for (const t of POP_LIST) {
    if (t === 'peasants') continue;
    const target = Math.min(jobs[t], cap);
    const diff = target - s.pops[t];
    if (diff > 0) {
      // Free peasants (no farm job) move readily; employed farmers only for better pay
      const free = Math.max(0, s.pops.peasants - jobs.peasants);
      const better = (s.inc?.[t] ?? 0) > pInc * 1.15 || s.pops[t] < 1 || STATE_WAGE[t] != null;
      const pool = free + (better ? Math.max(0, s.pops.peasants - free) * 0.5 : 0);
      const mv = Math.min(diff, pool * 0.08 * lawHook(civ, 'mobility'), diff * 0.2 + 0.5);
      if (mv <= 0) continue;
      s.pops[t] += mv; s.pops.peasants -= mv;
    } else if (diff < 0) {
      const mv = -diff * 0.12;
      s.pops[t] -= mv; s.pops.peasants += mv;
    }
  }
  if (s.pops.peasants < 0) s.pops.peasants = 0;
  normalizePops(s);
}

// ---------------- Monthly economy for one realm ----------------
function plan(civ, s, m, stab) {
  ensurePops(s);
  const jobs = jobsOf(civ, s);
  const ratio = {};
  for (const t of POP_LIST) ratio[t] = jobs[t] > 0 ? Math.min(1, s.pops[t] / jobs[t]) : 0;
  const q = quality(s);
  let disrupt = 1 - (s.unrest || 0) / 250;
  if (besiegedSet().has(s.id)) disrupt *= 0.5;
  if (isOccupied(s)) disrupt *= 0.35;
  const blockaded = blockadedSet().has(s.id);
  const effAll = stab * disrupt * cabinetMul(civ, 'economy', 0.03) * sizeEfficiency(civ);
  const blds = [];
  let landWorkers = 0;
  for (const type in s.buildings) {
    const P = PRODUCTION[type];
    if (!P) continue;
    const lv = s.buildings[type];
    const work = {};
    let w = 0;
    for (const t in P.jobs || {}) {
      const tt = t === 'capitalists' && civ.era < 3 ? 'aristocrats' : t;
      work[tt] = (work[tt] || 0) + P.jobs[t] * lv * ratio[tt];
      if (tt !== 'capitalists' && tt !== 'aristocrats') w += P.jobs[t] * lv * ratio[tt];
    }
    if (w <= 0.01) continue;
    if (P.jobs?.peasants) landWorkers += w;
    const pm = activePM(type, civ.techs);
    blds.push({ type, P, pm, w, work, q: P.q ? (q[P.q] ?? 1) : 1 });
  }
  const freePeasants = Math.max(0, s.pops.peasants - landWorkers);
  return { s, jobs, blds, freePeasants, q, effAll, blockaded };
}

export function civMonthly(civ) {
  const st = S();
  invalidateMods(civ);
  const m = mods(civ);
  const mk = ensureMarket(civ);
  const stab = stabilityMult(civ);
  const sup = {}, dem = {};
  for (const g of GOOD_LIST) { sup[g] = 0; dem[g] = mk.used[g] || 0; mk.used[g] = 0; }
  const plans = civ.settlements.map((id) => plan(civ, st.settlements[id], m, stab));

  // ---- 1. Input demand and fulfilment ----
  const inDem = {};
  for (const p of plans) for (const b of p.blds) {
    const ins = b.pm?.in || b.P.in;
    if (ins) for (const g in ins) inDem[g] = (inDem[g] || 0) + ins[g] * b.w;
  }
  const inFill = {};
  for (const g in inDem) { inFill[g] = inDem[g] > 0 ? Math.min(1, civ.stock[g] / inDem[g]) : 1; dem[g] += inDem[g]; }

  // ---- 2. Production, wages and profits ----
  let knowledge = 0, stateWages = 0, popTotal = 0, buildingLevels = 0;
  const income = new Map(); // settlement id -> {type: total income}
  for (const p of plans) {
    const s = p.s;
    popTotal += s.pop;
    for (const k in s.buildings) buildingLevels += s.buildings[k];
    const inc = {};
    for (const t of POP_LIST) inc[t] = 0;
    const out = {};
    const addOut = (g, v) => { out[g] = (out[g] || 0) + v; };
    for (const b of p.blds) {
      if (b.P.scholars) {
        // Scholars produce knowledge, better with paper/glass
        const ins = b.P.in || {};
        let boost = 1;
        for (const g in ins) { civ.stock[g] = Math.max(0, civ.stock[g] - ins[g] * b.w * inFill[g]); boost += 0.5 * inFill[g]; }
        knowledge += b.w * 0.6 * boost;
        continue;
      }
      if (!b.pm) { // service building (markets, temples, barracks…): state-paid or trade-paid
        const ins = b.P.in || {};
        for (const g in ins) civ.stock[g] = Math.max(0, civ.stock[g] - ins[g] * b.w * inFill[g]);
        continue;
      }
      const ins = b.pm.in || {};
      let inRatio = 1;
      for (const g in ins) inRatio = Math.min(inRatio, inFill[g]);
      const crafted = !!(b.P.jobs.craftsmen || b.P.industrial);
      const factor = crafted ? inRatio : 0.5 + 0.5 * inRatio;
      let cost = 0, rev = 0;
      for (const g in ins) { const used = ins[g] * b.w * (crafted ? inRatio : inFill[g]); civ.stock[g] = Math.max(0, civ.stock[g] - used); cost += used * price(civ, g); }
      for (const g in b.pm.out) {
        let v = b.pm.out[g] * b.w * b.q * m[GOODS[g].mod] * p.effAll * factor;
        if (s.blight) v *= blightMul(s, GOODS[g].mod);
        if (g === 'fish' && p.blockaded) v *= 0.5;
        addOut(g, v);
        rev += v * price(civ, g);
      }
      // Profit: 75% wages to workers (weighted by pop wage), 25% to owners
      const profit = Math.max(0, rev - cost);
      let wsum = 0;
      for (const t in b.work) if (t !== 'aristocrats' && t !== 'capitalists') wsum += b.work[t] * POPS[t].wage;
      const owner = b.P.industrial && civ.era >= 3 ? 'capitalists' : 'aristocrats';
      const ownersHere = s.pops[owner] > 0.5;
      const own = lawHook(civ, 'ownerShare');
      const toWorkers = profit * (ownersHere ? 1 - own : 1);
      for (const t in b.work) if (t !== 'aristocrats' && t !== 'capitalists' && wsum > 0) inc[t] += toWorkers * (b.work[t] * POPS[t].wage) / wsum;
      if (ownersHere) inc[owner] += profit * own;
    }
    // Subsistence farming by peasants without farm jobs
    if (p.freePeasants > 0) {
      const v = p.freePeasants * 0.62 * p.q.food * m.food * p.effAll * (s.blight ? blightMul(s, 'food') : 1);
      addOut('grain', v);
      inc.peasants += v * price(civ, 'grain');
      // ...and gather brushwood and deadwood, so even treeless lands get a trickle of wood
      const w = Math.min(p.freePeasants, 80) * 0.045 * Math.max(0.5, p.q.wood) * m.wood * p.effAll;
      addOut('wood', w);
      inc.peasants += w * price(civ, 'wood');
    }
    // State-paid professions and merchants
    for (const t in STATE_WAGE) {
      const n = Math.min(s.pops[t], p.jobs[t]);
      const wage = n * STATE_WAGE[t];
      inc[t] += wage; stateWages += wage;
    }
    const merchants = Math.min(s.pops.merchants, p.jobs.merchants);
    inc.merchants += merchants * 0.7 + (s.consVal || 0) * 0.03 * Math.min(1, merchants / 10);
    // base knowledge from the population
    knowledge += 1 + s.pop * 0.006;
    for (const g in out) { civ.stock[g] += out[g]; sup[g] += out[g]; }
    s.prod = out;
    income.set(s.id, inc);
  }

  // ---- 3. Consumption: pops buy needs with their taxed income ----
  const taxMul = m.tax * cabinetMul(civ, 'economy', 0.015);
  let taxes = 0;
  const want = []; // [settlement, popType, tier, key, qty, fullQty]
  const keyDem = {};
  for (const p of plans) {
    const s = p.s;
    const inc = income.get(s.id);
    const taxBonus = 1 + sumBuildingField(s, 'tax') + traitFx(G.world.provinces[s.province]).tax;
    const unrestCut = isOccupied(s) ? 0 : 1 - (s.unrest || 0) / 150;
    let consVal = 0;
    for (const t of POP_LIST) {
      const n = s.pops[t];
      if (n < 0.01) { s.inc[t] = 0; continue; }
      const gross = inc[t];
      const tax = gross * civ.taxRate * taxBonus * unrestCut * (p.blockaded ? 0.7 : 1);
      const taxed = Math.min(gross * 0.6, tax * taxMul);
      taxes += taxed;
      let budget = gross - taxed;
      s.inc[t] = gross / n;
      for (const tier of NEED_TIERS) {
        const mult = POPS[t].needs[tier];
        if (!mult) continue;
        for (const key in NEEDS[tier]) {
          const full = n * NEEDS[tier][key] * mult;
          const pr = keyPrice(civ, key);
          // Basic needs are always shared out (subsistence, charity, alms); the rest must be bought
          const afford = tier === 'basic' ? 1 : Math.min(1, budget / Math.max(1e-6, full * pr));
          const qty = full * afford;
          budget = Math.max(0, budget - qty * pr);
          consVal += qty * pr;
          want.push([s, t, tier, key, qty, full]);
          keyDem[key] = (keyDem[key] || 0) + qty;
        }
      }
    }
    s.consVal = consVal;
  }
  const keyFill = {};
  for (const key in keyDem) {
    keyFill[key] = keyDem[key] > 0 ? Math.min(1, keyStock(civ, key) / keyDem[key]) : 1;
    // demand recorded on the cheapest good of the key
    // demand lands on the goods actually available (by stock and output)
    const goods = keyGoods(key);
    const avail = goods.map((g) => civ.stock[g] + sup[g]);
    const tot = avail.reduce((x, y) => x + y, 0);
    goods.forEach((g, i) => { dem[g] += keyDem[key] * (tot > 0 ? avail[i] / tot : i === 0 ? 1 : 0); });
    takeKey(civ, key, keyDem[key] * keyFill[key]);
  }
  // Standard of living per pop type
  const sat = new Map();
  for (const [s, t, tier, key, qty, full] of want) {
    let o = sat.get(s);
    if (!o) sat.set(s, (o = {}));
    const k = t + ':' + tier;
    o[k] ??= [0, 0];
    o[k][0] += qty * keyFill[key];
    o[k][1] += full;
    if (tier === 'basic' && key === 'food') { o.food ??= [0, 0]; o.food[0] += qty * keyFill[key]; o.food[1] += full; }
  }
  let solSum = 0, solPop = 0;
  for (const p of plans) {
    const s = p.s;
    const o = sat.get(s) || {};
    let sp = 0, sn = 0;
    for (const t of POP_LIST) {
      const n = s.pops[t];
      if (n < 0.01) continue;
      let v = 0, wsum = 0;
      for (const tier of NEED_TIERS) {
        if (!POPS[t].needs[tier]) continue;
        const e = o[t + ':' + tier];
        const f = e && e[1] > 0 ? e[0] / e[1] : 0;
        v += f * TIER_WEIGHT[tier]; wsum += TIER_WEIGHT[tier];
      }
      const sol = clamp((v / Math.max(0.01, wsum)) * 10 + (POPS[t].wage - 1) * 0.4 + (t === 'peasants' || t === 'laborers' ? lawHook(civ, 'poorSol') : 0), 0, 10);
      s.solBy[t] = sol;
      sp += sol * n; sn += n;
    }
    s.sol = sn > 0 ? sp / sn : 5;
    s.foodSat = o.food && o.food[1] > 0 ? o.food[0] / o.food[1] : 1;
    solSum += s.sol * s.pop; solPop += s.pop;
  }
  civ.sol = solPop > 0 ? solSum / solPop : 5;

  // ---- 4. Prices ----
  const caps = storageCaps(civ);
  for (const g of GOOD_LIST) {
    mk.supply[g] = sup[g] + (mk.imports[g] || 0);
    mk.demand[g] = dem[g] + (mk.exports[g] || 0);
    const ratio = (mk.demand[g] + 0.5) / (mk.supply[g] + civ.stock[g] * 0.15 + 0.5);
    const target = basePrice(g) * clamp(Math.pow(ratio, 0.6), 0.5, 3);
    mk.price[g] += (target - mk.price[g]) * 0.25 * priceDamping(civ);
    if (civ.stock[g] > caps[g]) civ.stock[g] = caps[g];
    mk.imports[g] = 0; mk.exports[g] = 0;
  }

  // ---- 5. Treasury, research ----
  const upkeep = upkeepOf(civ, buildingLevels);
  const corruption = corruptionOf(civ);
  const military = armyUpkeep(civ) + fleetUpkeep(civ);
  const salaries = cabinetSalaries(civ);
  civ.treasury += taxes - upkeep - corruption - military - stateWages - salaries;
  knowledge = Math.pow(knowledge * m.knowledge * cabinetMul(civ, 'research', 0.04), 0.8);
  knowledge *= [1, 1.15, 1.45, 1.8][civ.era || 0]; // Phase 19: printing, universities and science speed the later eras
  progressResearch(civ, knowledge);

  // ---- 6. Growth, housing, migration ----
  let starving = false;
  for (const id of [...civ.settlements]) {
    const s = st.settlements[id];
    const growth = m.growth * (1 + sumBuildingField(s, 'growth'));
    if (s.foodSat >= 0.8 && !(s.plague && s.plague.until > S().day)) {
      const room = s.housing - s.pop;
      const crowd = Math.max(0.08, 1 - s.pop / Math.max(1, maxHousing(civ, s)));
      const solF = 0.5 + s.sol / 10;
      if (room > 0) {
        const big = Math.min(1, 1500 / (s.pop + 700)); // great cities grow slowly
        const add = Math.min(room, s.pop * 0.0045 * growth * crowd * solF * big * (0.6 + 0.8 * civ.stability / 100) + 0.25);
        s.pop += add; s.pops.peasants += add;
      }
    } else {
      starving = true;
      const loss = Math.max(1, s.pop * (0.8 - s.foodSat) * 0.08);
      s.pop -= loss;
    }
    if (s.pop > s.housing) s.pop -= (s.pop - s.housing) * 0.15;
    normalizePops(s);
    adjustPops(civ, s, jobsOf(civ, s));
    autoHousing(civ, s);
    updateStage(civ, s);
    if (s.pop < 3) abandonSettlement(civ, s, 'abandoned by its last inhabitants');
  }
  migrate(civ);

  civ.last = { tax: taxes, gold: 0, upkeep, corruption, military, stateWages, salaries, knowledge, caps, starving, sol: civ.sol };
  const { target } = stabilityBreakdown(civ, m);
  civ.stability = clamp(civ.stability + (target - civ.stability) * 0.12, 0, 100);
  if (starving && civ.isPlayer && !civ.famineWarned) {
    log('Famine! Not enough grain and fish reach the people.', { civ: civ.id, type: 'bad', toast: true });
    civ.famineWarned = true;
  } else if (!starving) civ.famineWarned = false;
  void STAGES;
}

// People move from miserable settlements to prosperous ones within the realm.
function migrate(civ) {
  const setts = civ.settlements.map((id) => S().settlements[id]).filter((s) => s.pop > 20);
  if (setts.length < 2) return;
  setts.sort((a, b) => a.sol - b.sol);
  const lo = setts[0], hi = setts[setts.length - 1];
  if (hi.sol - lo.sol < 1.5 || hi.pop >= hi.housing) return;
  const mv = Math.min(lo.pop * 0.005 * (hi.sol - lo.sol), hi.housing - hi.pop);
  if (mv <= 0) return;
  const f = mv / lo.pop;
  for (const t of POP_LIST) { const n = lo.pops[t] * f; lo.pops[t] -= n; hi.pops.peasants += n; }
  lo.pop -= mv; hi.pop += mv;
}

function autoHousing(civ, s) {
  const maxH = maxHousing(civ, s);
  if (s.pop < s.housing * 0.75 || s.housing >= maxH) return;
  const add = Math.min(maxH - s.housing, Math.max(6, Math.ceil(s.housing * 0.12)));
  const woodPer = s.stage === 0 ? 0 : 0.4 /* camps raise huts of hide, turf and reed */, stonePer = s.stage >= 2 ? 0.2 : 0;
  let afford = woodPer ? Math.min(add, Math.floor((civ.stock.wood * 0.5) / woodPer)) : add;
  if (stonePer) afford = Math.min(afford, Math.floor((civ.stock.stone * 0.5) / stonePer));
  if (afford <= 0) return;
  const before = visibleHouses(s);
  civ.stock.wood -= afford * woodPer;
  civ.stock.stone -= afford * stonePer;
  civ.market.used.wood += afford * woodPer;
  civ.market.used.stone += afford * stonePer;
  s.housing += afford;
  if (visibleHouses(s) !== before) s.rev++;
}

export function stabilityBreakdown(civ, m = mods(civ)) {
  const st = S();
  const items = [['Base', 50]];
  for (const [label, v] of m.sources.stability) items.push([label, v]);
  let b = 0, th = 0;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    b += sumBuildingField(s, 'stability');
    th += lvl(s, 'town_hall');
  }
  const n = Math.max(1, civ.settlements.length);
  const bs = Math.min(15, (b / n) * 2);
  if (bs) items.push(['Temples & civic buildings', Math.round(bs * 10) / 10]);
  items.push(['Taxation', -Math.round(civ.taxRate * 80)]);
  const gs = groupsStability(civ);
  if (gs) items.push(['Interest groups', gs]);
  let holy = 0; for (const id of civ.settlements) holy += traitFx(G.world.provinces[st.settlements[id].province]).stability;
  if (holy) items.push(['Holy sites', holy]);
  const cs = courtStability(civ);
  if (cs) items.push(['Court', cs]);
  if (civ.sol != null) {
    const v = clamp(Math.round((civ.sol - 5) * 2.5), -15, 12);
    if (v) items.push([`Living standards (${civ.sol.toFixed(1)})`, v]);
  }
  if (civ.last?.starving) items.push(['Famine', -15]);
  if (civ.treasury < 0) items.push(['Debt', -10]);
  const over = Math.max(0, civ.settlements.length - (m.admin + th));
  if (over) items.push([`Overextension (${civ.settlements.length}/${m.admin + th} admin)`, -Math.round(Math.min(45, over * 4))]);
  const wars = warsOf(civ.id);
  if (wars.length) {
    let exh = 0;
    for (const w of wars) exh = Math.max(exh, w.att.includes(civ.id) ? w.exhA : w.exhD);
    items.push([`War weariness`, -Math.round(3 * wars.length + Math.min(15, exh * 0.2))]);
  }
  if (civ.overlord >= 0) items.push(['Subject to an overlord', -3]);
  if (civ.era > 0) items.push(['Social change', -3 * civ.era]);
  if (civ.settlements.length > 8) items.push(['Size of the realm', -Math.min(14, Math.round((civ.settlements.length - 8) * 0.4))]);
  const cab = cabinetAdd(civ, 'stability', 0.8);
  if (cab) items.push(['Cabinet: keeping the peace', Math.round(cab)]);
  const target = clamp(items.reduce((a, [, v]) => a + v, 0), 0, 100);
  return { items, target };
}

// ---------------- Trade between markets ----------------
// Goods flow from cheap markets to dear ones along trade agreements, vassal ties
// and between harbour realms; exporters earn duties, importers ease shortages.
export function marketTrade() {
  const st = S();
  const alive = st.civs.filter((c) => c.alive && c.market);
  const tradeMul = (c) => {
    let t = 1;
    for (const id of c.settlements) t += sumBuildingField(st.settlements[id], 'trade');
    return Math.min(4, t) * cabinetMul(c, 'trade', 0.1) * lawHook(c, 'trade');
  };
  for (const c of alive) c.last.tradeIncome = 0;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const A = alive[i], B = alive[j];
      const linked = rel(A.id, B.id).trade || A.overlord === B.id || B.overlord === A.id || allied(A.id, B.id);
      if (!linked) continue;
      const cap = 20 * Math.sqrt(tradeMul(A) * tradeMul(B)) * routeFactor(A.id, B.id);
      for (const g of GOOD_LIST) {
        const pa = A.market.price[g], pb = B.market.price[g];
        let [X, Y, px, py] = pa < pb ? [A, B, pa, pb] : [B, A, pb, pa];
        if (py < px * 1.12) continue;
        const qty = Math.min(X.stock[g] * 0.15, cap * (py / px - 1));
        if (qty < 0.1) continue;
        X.stock[g] -= qty; Y.stock[g] += qty;
        X.market.exports[g] += qty; Y.market.imports[g] += qty;
        const duty = qty * px * 0.1, profit = qty * (py - px) * 0.3;
        X.treasury += duty; Y.treasury += profit;
        X.last.tradeIncome += duty; Y.last.tradeIncome += profit;
        void px;
      }
    }
  }
}

// ---------------- UI helpers ----------------
// Projected monthly treasury balance (uses last month's figures).
export function projectLedger(civ) {
  const L = { ...(civ.last || {}) };
  L.tax ??= 0; L.upkeep ??= 0; L.corruption = corruptionOf(civ); L.military = armyUpkeep(civ) + fleetUpkeep(civ);
  L.stateWages ??= 0; L.salaries = cabinetSalaries(civ);
  L.trade = (civ.last?.trade || 0) + (civ.last?.tradeIncome || 0);
  L.tribute = civ.last?.tribute || 0;
  L.knowledge ??= 0;
  L.laws = civ.last?.lawCost || 0;
  L.companies = civ.last?.companies || 0; L.worldTrade = civ.last?.worldTrade || 0;
  L.interest = civ.last?.interest || 0; L.mercs = civ.last?.mercs || 0; L.monument = civ.last?.monument || 0; L.patronage = civ.last?.patronage || 0;
  L.admin = civ.last?.admin || 0; L.works = civ.last?.works || 0; // Phase 19
  L.net = { gold: L.tax + L.trade + L.tribute + L.companies + L.worldTrade - L.upkeep - L.corruption - L.military - L.stateWages - L.salaries - L.laws - L.interest - L.mercs - L.monument - L.patronage - L.admin - L.works, knowledge: L.knowledge };
  return L;
}
// Settlement summary for panels
export function settlementSummary(civ, s) {
  ensurePops(s);
  const jobs = jobsOf(civ, s);
  return { pops: s.pops, jobs, sol: s.sol ?? 5, solBy: s.solBy || {}, inc: s.inc || {}, prod: s.prod || {}, foodSat: s.foodSat ?? 1 };
}
export function goodsBalance(civ) {
  const mk = ensureMarket(civ);
  return GOOD_LIST.map((g) => ({ g, price: mk.price[g], base: basePrice(g), supply: mk.supply[g], demand: mk.demand[g], stock: civ.stock[g] }));
}
void civOf;
