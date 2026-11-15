// Phase 12 — where gold goes: loans and interest, mercenary companies, great monuments,
// bribing interest groups and forging claims. The AI uses all of them, so treasuries no
// longer pile up unspent.
import { G, S, log, civOf } from './state.js';
import { invalidateMods } from './mods.js';
import { createArmy, armyCount } from './military.js';
import { atWar, rel } from './diplomacy.js';
import { GROUPS, GROUP_LIST } from '../data/politics.js';
import { personName } from '../core/names.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const income = (civ) => Math.max(20, (civ.last?.tax || 0) + (civ.last?.trade || 0) + (civ.last?.tradeIncome || 0));

// ---------------- Monuments ----------------
export const MONUMENTS = {
  great_library: { name: 'Great Library', era: 0, cost: 900, fx: { knowledge: 0.12 }, icon: '✎', desc: '+12% knowledge.' },
  colossus: { name: 'The Colossus', era: 0, cost: 1000, fx: { gold: 0.08, stability: 2 }, icon: '♜', desc: '+8% gold, +2 stability. Needs a coastal capital.', coastal: true },
  hanging_gardens: { name: 'Hanging Gardens', era: 1, cost: 1800, fx: { growth: 0.1, food: 0.05 }, icon: '❀', desc: '+10% growth, +5% food.' },
  grand_temple: { name: 'Grand Temple', era: 1, cost: 1800, fx: { stability: 7 }, icon: '✝', desc: '+7 stability.' },
  great_wall: { name: 'Great Wall', era: 1, cost: 2200, fx: { defense: 25 }, icon: '▤', desc: '+25 defense.' },
  royal_palace: { name: 'Royal Palace', era: 2, cost: 4000, fx: { admin: 2, stability: 3 }, icon: '♛', desc: '+2 administration, +3 stability.' },
  star_observatory: { name: 'Star Observatory', era: 2, cost: 4000, fx: { knowledge: 0.15 }, icon: '✧', desc: '+15% knowledge.' },
  grand_bazaar: { name: 'Grand Bazaar', era: 2, cost: 4500, fx: { gold: 0.12, tax: 0.05 }, icon: '⚖', desc: '+12% gold, +5% taxes.' },
  crystal_palace: { name: 'Crystal Palace', era: 3, cost: 9000, fx: { build: 0.2, knowledge: 0.1, stability: 3 }, icon: '◇', desc: '+20% build speed, +10% knowledge, +3 stability.' },
  grand_railway: { name: 'Grand Railway Terminus', era: 3, cost: 9000, fx: { gold: 0.1, growth: 0.06 }, icon: '⛭', desc: '+10% gold, +6% growth.' },
};
export const MONUMENT_LIST = Object.keys(MONUMENTS);
export const INVEST_RATES = [0, 0.05, 0.1, 0.2, 0.35]; // share of monthly income

export function monumentOwner(id) { return S().monuments?.[id] ?? -1; }
export function canBuildMonument(civ, id) {
  const M = MONUMENTS[id];
  if (!M) return { ok: false, reason: 'Unknown' };
  if (monumentOwner(id) >= 0) return { ok: false, reason: `Already built by ${civOf(monumentOwner(id)).displayName}` };
  if ((civ.era || 0) < M.era) return { ok: false, reason: `Requires the ${['Ancient', 'Medieval', 'Renaissance', 'Industrial'][M.era]} era` };
  const cap = S().settlements[civ.capital];
  if (!cap) return { ok: false, reason: 'No capital' };
  if (M.coastal && !G.world.provinces[cap.province].coastal) return { ok: false, reason: 'Needs a coastal capital' };
  return { ok: true };
}
export function startMonument(civ, id, rate = 2) {
  const r = canBuildMonument(civ, id);
  if (!r.ok) return r;
  const prev = civ.project;
  if (prev && prev.id !== id) civ.treasury += prev.invested * 0.5; // half refunded when switching
  civ.project = { id, invested: prev?.id === id ? prev.invested : 0, rate };
  return { ok: true };
}
export function setInvestRate(civ, rate) { if (civ.project) civ.project.rate = clamp(rate | 0, 0, INVEST_RATES.length - 1); }
export function cancelMonument(civ) { if (civ.project) { civ.treasury += civ.project.invested * 0.5; civ.project = null; } }
function monumentMonthly(civ) {
  const p = civ.project;
  if (!p) return;
  const M = MONUMENTS[p.id];
  if (monumentOwner(p.id) >= 0) {
    civ.treasury += p.invested * 0.5;
    if (civ.isPlayer) log(`${civOf(monumentOwner(p.id)).displayName} finished the ${M.name} first — half our investment is recovered.`, { civ: civ.id, type: 'bad', toast: true });
    civ.project = null;
    return;
  }
  const amt = Math.min(Math.max(0, civ.treasury), income(civ) * INVEST_RATES[p.rate]);
  civ.treasury -= amt;
  p.invested += amt;
  civ.last && (civ.last.monument = amt);
  if (p.invested >= M.cost) {
    const st = S();
    st.monuments ??= {};
    st.monuments[p.id] = civ.id;
    civ.monuments ??= [];
    civ.monuments.push(p.id);
    civ.project = null;
    invalidateMods(civ);
    const cap = st.settlements[civ.capital];
    log(`🏛 ${civ.displayName} completes the ${M.name}! ${M.desc}`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'good' : 'world', toast: true, major: true, tile: cap?.tile ?? -1 });
  }
}
export function monumentFx(civ) { return (civ.monuments || []).map((id) => [MONUMENTS[id].fx, MONUMENTS[id].name]); }

// ---------------- Loans ----------------
export const LOAN_RATE = 0.006; // per month
export const maxLoans = 5;
export const loanSize = (civ) => Math.round(Math.max(150, income(civ) * 8) / 10) * 10;
export function debt(civ) { return (civ.loans || []).reduce((s, l) => s + l.amount, 0); }
export function takeLoan(civ, quiet = false) {
  civ.loans ??= [];
  if (civ.loans.length >= maxLoans) return { ok: false, reason: 'No banker will lend to us any more' };
  const amount = loanSize(civ);
  civ.loans.push({ amount, rate: LOAN_RATE * (1 + civ.loans.length * 0.25), day: S().day });
  civ.treasury += amount;
  if (!quiet && civ.isPlayer) log(`We borrow ${amount} gold at ${(LOAN_RATE * (1 + (civ.loans.length - 1) * 0.25) * 1200).toFixed(1)}% a year.`, { civ: civ.id, type: 'info' });
  return { ok: true, amount };
}
export function repayLoan(civ, i = 0) {
  const l = civ.loans?.[i];
  if (!l) return { ok: false, reason: 'No such loan' };
  if (civ.treasury < l.amount) return { ok: false, reason: `Needs ${l.amount} gold` };
  civ.treasury -= l.amount;
  civ.loans.splice(i, 1);
  return { ok: true };
}
function loansMonthly(civ) {
  civ.loans ??= [];
  let interest = 0;
  for (const l of civ.loans) interest += l.amount * l.rate;
  civ.treasury -= interest;
  if (civ.last) civ.last.interest = interest;
  // emergency borrowing; bankruptcy when no one lends
  const ai = !civ.isPlayer || civ.autoBuild;
  const atWarNow = S().wars.some((w) => w.att.includes(civ.id) || w.def.includes(civ.id));
  if (civ.treasury < -50 && ai && (!atWarNow || civ.loans.length >= 2)) {
    // AI: cut costs instead of borrowing in peacetime
    civ.taxRate = Math.min(0.35, (civ.taxRate || 0.15) + 0.02);
    const armies = S().armies.filter((a) => a.civ === civ.id && a.battle < 0).sort((a, b) => armyCount(a) - armyCount(b));
    if (armies.length > 1 && civ.treasury < -loanSize(civ)) armies[0].units = {};
    if (civ.treasury < -loanSize(civ) * 3) bankrupt(civ);
  } else if (civ.treasury < -50) {
    if (civ.loans.length < maxLoans) { const r = takeLoan(civ, true); if (civ.isPlayer && r.ok) log(`Our treasury is empty: the crown takes an emergency loan of ${r.amount} gold.`, { civ: civ.id, type: 'bad', toast: true }); }
    else if (civ.treasury < -loanSize(civ) * 2) bankrupt(civ);
  }
  // AI belt-tightening under debt
  if ((!civ.isPlayer || civ.autoBuild) && civ.loans.length >= 2) {
    civ.taxRate = Math.min(0.35, (civ.taxRate || 0.15) + 0.01);
    for (const a of S().armies) if (a.civ === civ.id && a.merc) a.units = {};
  }
}
function bankrupt(civ) {
  civ.loans = [];
  civ.treasury = 0;
  civ.stability = Math.max(0, civ.stability - 25);
  civ.modifiers ??= [];
  civ.modifiers.push({ name: 'Bankruptcy', fx: { tax: -0.25, build: -0.25, stability: -5 }, until: S().day + 360 * 5 });
  invalidateMods(civ);
  for (const a of S().armies) if (a.civ === civ.id && a.merc) a.units = {};
  log(`💸 ${civ.displayName} declares bankruptcy! Its debts are torn up, its mercenaries desert, and its credit is ruined.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: true, major: true });
}

// ---------------- Mercenaries ----------------
const COMPANY = ['Iron', 'Black', 'Red', 'Golden', 'Free', 'Grey', 'Silver', 'Wolf', 'Storm', 'Crimson'];
const COMPANY2 = ['Company', 'Band', 'Lances', 'Blades', 'Brotherhood', 'Host', 'Banners'];
function makeCompany() {
  const st = S();
  const rng = G.rng;
  const era = Math.max(0, ...st.civs.filter((c) => c.alive).map((c) => c.era || 0));
  const size = rng.int(4, 9) + era * 2;
  const units = {};
  const inf = era >= 3 ? 'riflemen' : era >= 2 ? 'musketeers' : 'infantry';
  units[inf] = Math.round(size * 0.55);
  units.archers = Math.round(size * 0.2);
  units.cavalry = Math.max(1, Math.round(size * 0.25));
  return {
    id: st.nextMercId = (st.nextMercId || 0) + 1,
    name: `The ${rng.pick(COMPANY)} ${rng.pick(COMPANY2)}`,
    captain: personName('humans', rng.chance(0.5) ? 'm' : 'f', rng),
    units, skill: rng.int(2, 4),
    cost: Math.round((60 + size * 22) * (1 + era * 0.6)),
    upkeep: Math.round((4 + size * 1.6) * (1 + era * 0.5) * 10) / 10,
  };
}
export function ensureMercs() { const st = S(); st.mercs ??= []; while (st.mercs.length < 4) st.mercs.push(makeCompany()); }
export function canHireMercs(civ, m) {
  if (!m) return { ok: false, reason: 'Gone' };
  if (civ.treasury < m.cost) return { ok: false, reason: `Needs ${m.cost} gold` };
  if (!S().settlements[civ.capital]) return { ok: false, reason: 'No capital' };
  return { ok: true };
}
export function hireMercs(civ, id) {
  const st = S();
  const m = st.mercs.find((x) => x.id === id);
  const r = canHireMercs(civ, m);
  if (!r.ok) return r;
  civ.treasury -= m.cost;
  const cap = st.settlements[civ.capital];
  const a = createArmy(civ, cap.tile, cap.id);
  a.name = m.name;
  a.units = { ...m.units };
  a.merc = { upkeep: m.upkeep, company: m.name };
  a.general = { name: m.captain, gender: 'm', skill: m.skill, trait: 'reckless' };
  st.mercs = st.mercs.filter((x) => x !== m);
  log(`⚔ ${civ.displayName} hires ${m.name} (${m.cost} gold, ${m.upkeep} gold a month).`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer });
  return { ok: true, army: a };
}
export function mercUpkeep(civ) { let g = 0; for (const a of S().armies) if (a.civ === civ.id && a.merc) g += a.merc.upkeep; return g; }
function mercsMonthly(civ) {
  const st = S();
  const pay = mercUpkeep(civ);
  if (!pay) return;
  civ.treasury -= pay;
  if (civ.last) civ.last.mercs = pay;
  if (civ.treasury < 0) {
    for (const a of st.armies) {
      if (a.civ !== civ.id || !a.merc || G.rng.chance(0.5)) continue;
      a.units = {};
      log(`${a.name} desert ${civ.displayName} — they were not paid.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer });
    }
    st.armies = st.armies.filter((a) => armyCount(a) > 0 || a.battle >= 0);
  }
}

// ---------------- Bribes & claims ----------------
export function bribeCost(civ, g) {
  let pop = 0; for (const id of civ.settlements) pop += S().settlements[id].pop;
  return Math.round((40 + 500 * (civ.groups?.[g]?.clout || 0)) * Math.sqrt(1 + pop / 800));
}
export function bribeGroup(civ, g) {
  if (!GROUPS[g] || !civ.groups?.[g]) return { ok: false, reason: 'Unknown group' };
  const cost = bribeCost(civ, g);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  const grp = civ.groups[g];
  if ((grp.bribeUntil || 0) > S().day) return { ok: false, reason: 'Already bought — wait a while' };
  civ.treasury -= cost;
  grp.bribe = 4; grp.bribeUntil = S().day + 360 * 3;
  grp.approval = clamp(grp.approval + 3, -10, 10);
  return { ok: true, cost };
}
export const claimCost = (civ) => 150 + 80 * (civ.era || 0);
export function canFabricate(civ, target) {
  const T = civOf(target);
  if (!T?.alive || T.id === civ.id) return { ok: false, reason: 'Invalid realm' };
  if (civ.fabricating) return { ok: false, reason: 'Our scribes are already forging a claim' };
  if ((civ.claims || []).includes(target)) return { ok: false, reason: 'We already hold a claim' };
  if (!civ.contacts.includes(target)) return { ok: false, reason: 'Only on neighbouring realms' };
  const cost = claimCost(civ);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  return { ok: true, cost };
}
export function fabricateClaim(civ, target) {
  const r = canFabricate(civ, target);
  if (!r.ok) return r;
  civ.treasury -= r.cost;
  civ.fabricating = { target, progress: 0 };
  return { ok: true };
}
function claimsMonthly(civ) {
  const f = civ.fabricating;
  if (!f) return;
  const T = civOf(f.target);
  if (!T?.alive) { civ.fabricating = null; return; }
  f.progress += 6 + (civ.ruler?.stats?.int ?? 5) * 0.8;
  if (G.rng.chance(0.01)) { // forgers caught
    civ.fabricating = null;
    rel(civ.id, T.id).grudge += 25;
    if (civ.isPlayer || T.isPlayer) log(`Forged documents of ${civ.displayName} claiming the throne of ${T.displayName} are exposed!`, { civ: S().playerId, type: 'bad', toast: true });
    return;
  }
  if (f.progress >= 100) {
    civ.claims ??= [];
    civ.claims.push(T.id);
    civ.fabricating = null;
    if (civ.isPlayer) log(`Our scribes have "discovered" a claim to the throne of ${T.displayName}. Press it with a Demand in Diplomacy.`, { civ: civ.id, type: 'good', toast: true });
  }
}

// ---------------- Royal patronage ----------------
// A standing share of income spent on festivals, roads, alms and grants: growth and stability.
export const PATRONAGE = [0, 0.05, 0.1, 0.2, 0.35];
export function setPatronage(civ, lvl) { civ.patronage = clamp(lvl | 0, 0, PATRONAGE.length - 1); }
function patronageMonthly(civ) {
  const lvl = civ.patronage || 0;
  civ.modifiers = (civ.modifiers || []).filter((m) => m.name !== 'Royal patronage');
  if (!lvl) { if (civ.last) civ.last.patronage = 0; return; }
  const amt = Math.min(Math.max(0, civ.treasury), income(civ) * PATRONAGE[lvl]);
  civ.treasury -= amt;
  if (civ.last) civ.last.patronage = amt;
  const share = amt / income(civ);
  civ.modifiers.push({ name: 'Royal patronage', fx: { stability: Math.round(share * 22), knowledge: share * 0.3 }, until: S().day + 31 });
  invalidateMods(civ);
}

// ---------------- Monthly & AI ----------------
export function treasuryMonthly(civ) {
  loansMonthly(civ);
  mercsMonthly(civ);
  monumentMonthly(civ);
  claimsMonthly(civ);
  patronageMonthly(civ);
  if (!civ.isPlayer || civ.autoBuild) aiSpend(civ);
}
export function treasuryYearly() {
  const st = S();
  ensureMercs();
  // the market for swords turns over
  if (G.rng.chance(0.5)) { st.mercs.shift(); ensureMercs(); }
}

function aiSpend(civ) {
  const st = S();
  const inc = income(civ);
  const reserve = 150 + inc * 6;
  // pay down debt when comfortable
  if (civ.loans?.length && civ.treasury > civ.loans[0].amount + reserve) repayLoan(civ, 0);
  // great works
  if (!civ.project && civ.treasury > reserve * 1.5 && G.rng.chance(0.08)) {
    const opts = MONUMENT_LIST.filter((id) => canBuildMonument(civ, id).ok);
    if (opts.length) startMonument(civ, opts[G.rng.int(0, opts.length - 1)], civ.treasury > reserve * 5 ? 4 : 3);
  }
  if (civ.project) setInvestRate(civ, civ.treasury > reserve * 8 ? 4 : civ.treasury > reserve * 3 ? 3 : civ.treasury > reserve ? 2 : 0);
  // surplus wealth flows into patronage
  setPatronage(civ, civ.loans?.length ? 0 : civ.treasury > inc * 30 ? 4 : civ.treasury > inc * 18 ? 3 : civ.treasury > inc * 10 ? 2 : civ.treasury > inc * 5 ? 1 : 0);
  // keep angry groups quiet
  if (civ.groups && civ.treasury > reserve && G.rng.chance(0.15)) {
    const angry = GROUP_LIST.filter((g) => civ.groups[g].approval < -3 && civ.groups[g].clout > 0.1).sort((a, b) => civ.groups[b].movement - civ.groups[a].movement)[0];
    if (angry) bribeGroup(civ, angry);
  }
  // hire swords at war, if outnumbered and rich
  const wars = st.wars.filter((w) => w.att.includes(civ.id) || w.def.includes(civ.id));
  if (wars.length && civ.treasury > reserve && G.rng.chance(0.2)) {
    const m = [...st.mercs].sort((a, b) => a.cost - b.cost).find((x) => x.cost < civ.treasury - reserve * 0.5);
    if (m) hireMercs(civ, m.id);
  }
  // dismiss mercenaries in peacetime
  if (!wars.length) for (const a of st.armies) if (a.civ === civ.id && a.merc && G.rng.chance(0.3)) a.units = {};
  // forge claims on a weak rival when rich
  if (civ.rival != null && !civ.fabricating && civ.treasury > reserve * 2 && G.rng.chance(0.05) && canFabricate(civ, civ.rival).ok) fabricateClaim(civ, civ.rival);
  void atWar;
}

export function ensurePhase12Treasury(st) {
  st.monuments ??= {};
  for (const c of st.civs) { c.loans ??= []; c.monuments ??= []; c.project ??= null; c.fabricating ??= null; }
  if (!st.mercs) { st.mercs = []; ensureMercs(); } // only when first created (never on load: it would consume random numbers)
}
