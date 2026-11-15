// Phase 14 — developing markets: market tiers, trade routes you open and upgrade,
// the sea-borne world market of later eras, and chartered merchant companies.
import { G, S, log, civOf } from './state.js';
import { GOODS, GOOD_LIST } from '../data/goods.js';
import { rel, allied, atWar } from './diplomacy.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- Market tiers ----------------
export const TIER_NAMES = ['No market', 'Local Market', 'Market Hall', 'Trade Fair', 'Exchange'];
export const TIER_DESC = [
  'Only barter: prices swing wildly and little is traded.',
  'Traders gather: trade routes can be opened (caravans).',
  'A covered hall: steadier prices, road convoys, merchant companies can be chartered.',
  'A great fair: much steadier prices, merchant fleets and — with a harbour in the Renaissance — the world market.',
  'An exchange: the steadiest prices and the largest trade capacity.',
];
export function marketTier(civ) {
  let t = 0;
  for (const id of civ.settlements) t = Math.max(t, S().settlements[id]?.buildings?.market || 0);
  return clamp(t, 0, 4);
}
export const priceDamping = (civ) => 1 - 0.13 * marketTier(civ); // multiplier on how fast prices move

// ---------------- Trade routes ----------------
export const ROUTE_NAMES = ['', 'Caravan route', 'Road convoys', 'Merchant fleet'];
export const linkedForTrade = (a, b) => rel(a, b).trade || civOf(a).overlord === b || civOf(b).overlord === a || allied(a, b);
export const routeBetween = (a, b) => (S().routes || []).find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const hasPort = (civ) => civ.settlements.some((id) => S().settlements[id]?.buildings?.port);
export const routeCost = (lvl) => [0, 80, 180, 350][lvl];
export function canOpenRoute(a, b, lvl = null) {
  const A = civOf(a), B = civOf(b);
  if (!A?.alive || !B?.alive || a === b) return { ok: false, reason: 'Invalid' };
  if (atWar(a, b)) return { ok: false, reason: 'At war' };
  if (!linkedForTrade(a, b)) return { ok: false, reason: 'Needs a trade agreement, alliance or vassal tie first' };
  const r = routeBetween(a, b);
  const next = lvl ?? (r ? r.level + 1 : 1);
  if (next > 3) return { ok: false, reason: 'Already a merchant fleet' };
  const need = next;
  if (marketTier(A) < need || marketTier(B) < need) return { ok: false, reason: `Both realms need a ${TIER_NAMES[need]} (market level ${need})` };
  if (next === 2 && !A.techs.includes('the_wheel')) return { ok: false, reason: 'Requires The Wheel' };
  if (next === 3 && (!A.techs.includes('sailing') || !hasPort(A) || !hasPort(B))) return { ok: false, reason: 'Requires Sailing and harbours in both realms' };
  const cost = routeCost(next);
  if (A.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  return { ok: true, cost, next };
}
export function openRoute(a, b) {
  const c = canOpenRoute(a, b);
  if (!c.ok) return c;
  const st = S();
  civOf(a).treasury -= c.cost;
  const r = routeBetween(a, b);
  if (r) r.level = c.next;
  else st.routes.push({ id: st.nextRouteId++, a, b, level: 1, since: st.day });
  if (civOf(a).isPlayer || civOf(b).isPlayer) log(`🛒 ${ROUTE_NAMES[c.next]} between ${civOf(a).displayName} and ${civOf(b).displayName}.`, { civ: st.playerId, type: 'good' });
  return { ok: true };
}
// capacity multiplier for trade between two markets
export function routeFactor(a, b) {
  const r = routeBetween(a, b);
  if (r?.raid && r.raid.until > S().day) return 0.1; // Phase 21: a raided route carries almost nothing
  const co = (c) => 1 + 0.06 * (civOf(c).companies || []).reduce((s, x) => s + x.level, 0);
  return (r ? 0.6 + 0.8 * r.level : 0.35) * Math.sqrt(co(a) * co(b));
}

// ---------------- World market ----------------
export const inWorldMarket = (civ) => civ.alive && (civ.era || 0) >= 2 && marketTier(civ) >= 3 && hasPort(civ);
export function worldPrices() {
  const st = S();
  const part = st.civs.filter((c) => c.market && inWorldMarket(c));
  const out = {};
  if (part.length < 2) return null;
  for (const g of GOOD_LIST) { let s = 0; for (const c of part) s += c.market.price[g]; out[g] = s / part.length; }
  return out;
}
function worldMarketMonthly() {
  const st = S();
  const part = st.civs.filter((c) => c.market && inWorldMarket(c));
  if (part.length < 2) { st.worldPrice = null; return; }
  const wp = worldPrices();
  st.worldPrice = wp;
  for (const g of GOOD_LIST) {
    const sellers = [], buyers = [];
    for (const c of part) {
      const p = c.market.price[g];
      const cap = 6 * marketTier(c) * (1 + 0.1 * (c.companies || []).filter((x) => x.good === g).reduce((s, x) => s + x.level, 0));
      if (p < wp[g] / 1.12 && c.stock[g] > 5) sellers.push([c, Math.min(c.stock[g] * 0.12, cap * (wp[g] / p - 1))]);
      else if (p > wp[g] * 1.12) buyers.push([c, cap * (p / wp[g] - 1)]);
    }
    let supply = 0, demand = 0;
    for (const [, q] of sellers) supply += q;
    for (const [, q] of buyers) demand += q;
    const vol = Math.min(supply, demand);
    if (vol < 0.2) continue;
    for (const [c, q] of sellers) {
      const qq = (q / supply) * vol;
      c.stock[g] -= qq; c.market.exports[g] += qq;
      const gold = qq * wp[g];
      c.treasury += gold * 0.12; c.last.worldTrade = (c.last.worldTrade || 0) + gold * 0.12;
    }
    for (const [c, q] of buyers) {
      const qq = (q / demand) * vol;
      const pay = qq * wp[g] * 0.1; // freight and duties
      c.stock[g] += qq; c.market.imports[g] += qq;
      c.treasury -= pay; c.last.worldTrade = (c.last.worldTrade || 0) - pay;
    }
  }
}

// ---------------- Merchant companies ----------------
export const companyCost = (lvl) => 200 * lvl + 100;
export function canCharter(civ, good) {
  if (!GOODS[good]) return { ok: false, reason: 'Unknown good' };
  if (marketTier(civ) < 2) return { ok: false, reason: 'Needs a Market Hall (market level 2)' };
  civ.companies ??= [];
  const co = civ.companies.find((x) => x.good === good);
  const next = (co?.level || 0) + 1;
  if (next > 3) return { ok: false, reason: 'Company at its largest' };
  if (civ.companies.length >= 3 && !co) return { ok: false, reason: 'At most three companies' };
  const prod = civ.market?.supply?.[good] || 0;
  if (prod < 3) return { ok: false, reason: 'We barely produce this good' };
  const cost = companyCost(next);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  return { ok: true, cost, next };
}
export function charterCompany(civ, good) {
  const r = canCharter(civ, good);
  if (!r.ok) return r;
  civ.treasury -= r.cost;
  const co = civ.companies.find((x) => x.good === good);
  if (co) co.level = r.next; else civ.companies.push({ good, level: 1, since: S().day });
  if (civ.isPlayer) log(`📜 The ${GOODS[good].name} Company ${co ? 'expands' : 'receives its royal charter'}.`, { civ: civ.id, type: 'good' });
  return { ok: true };
}
export function companyProfit(civ, co) {
  const ex = civ.market?.exports?.[co.good] || 0;
  const price = civ.market?.price?.[co.good] || 0;
  return co.level * (2 + ex * price * 0.18);
}
function companiesMonthly(civ) {
  if (!civ.companies?.length) return;
  let p = 0;
  for (const co of civ.companies) p += companyProfit(civ, co);
  civ.treasury += p;
  if (civ.last) civ.last.companies = p;
}

// ---------------- Monthly / AI ----------------
export function marketsMonthly() {
  const st = S();
  st.routes = (st.routes || []).filter((r) => civOf(r.a)?.alive && civOf(r.b)?.alive && linkedForTrade(r.a, r.b) && !atWar(r.a, r.b));
  worldMarketMonthly();
  for (const c of st.civs) {
    if (!c.alive) continue;
    companiesMonthly(c);
    if (!c.isPlayer || c.autoBuild) aiMarkets(c);
  }
}
function aiMarkets(civ) {
  const st = S();
  if (!G.rng.chance(0.08)) return;
  // open or upgrade a route with a linked partner
  const partners = st.civs.filter((o) => o.alive && o.id !== civ.id && linkedForTrade(civ.id, o.id));
  for (const o of partners) { const c = canOpenRoute(civ.id, o.id); if (c.ok && civ.treasury > c.cost * 3) { openRoute(civ.id, o.id); return; } }
  // charter a company for our biggest surplus
  if (civ.treasury > 900 && marketTier(civ) >= 2 && civ.market) { // realms born mid-month have no market yet
    const best = GOOD_LIST.map((g) => [g, (civ.market.supply[g] || 0) - (civ.market.demand[g] || 0)]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 5) charterCompany(civ, best[0]);
  }
}
export function ensurePhase14Markets(st) {
  st.routes ??= [];
  st.nextRouteId ??= 1;
  for (const c of st.civs) c.companies ??= [];
}
