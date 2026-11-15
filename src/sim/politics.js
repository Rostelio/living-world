// Phase 10 — interest groups, laws and political movements.
import { G, S, log, civOf } from './state.js';
import { GROUPS, GROUP_LIST, POP_WEIGHT, GOV_VOICE, LAWS, LAW_CATS, CAT_LIST, DEFAULT_LAWS, lawsIn } from '../data/politics.js';
import { POP_LIST } from '../data/goods.js';
import { invalidateMods } from './mods.js';
import { startCivilWar } from './unrest.js';
import { warsOf } from './diplomacy.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- State ----------------
export function ensurePolitics(civ) {
  civ.laws ??= { ...DEFAULT_LAWS };
  for (const c of CAT_LIST) civ.laws[c] ??= DEFAULT_LAWS[c];
  civ.groups ??= {};
  for (const g of GROUP_LIST) civ.groups[g] ??= { approval: 0, clout: 0, movement: 0 };
  civ.enact ??= null;
}
export function ensurePhase10(st) {
  for (const c of st.civs) ensurePolitics(c);
  st.version = Math.max(st.version || 0, 10);
}

// ---------------- Law effects ----------------
export function lawFxList(civ) {
  const out = [];
  for (const c of CAT_LIST) { const L = LAWS[civ.laws?.[c]]; if (L?.fx && Object.keys(L.fx).length) out.push([L.fx, `Law: ${L.name}`]); }
  return out;
}
// Aggregated numeric hooks (derived; recomputed whenever laws change).
export function lawHooks(civ) {
  if (civ._lawHooks) return civ._lawHooks;
  const h = { ownerShare: 0.25, mobility: 1, trade: 1, markup: 2.5, recruit: 1, upkeep: 1, welfare: 0, school: 0, poorSol: 0 };
  if (civ.laws) {
    const land = LAWS[civ.laws.land]?.hooks, labor = LAWS[civ.laws.labor]?.hooks, trade = LAWS[civ.laws.trade]?.hooks, army = LAWS[civ.laws.army]?.hooks;
    if (land) { h.ownerShare = land.ownerShare ?? 0.25; h.mobility = land.mobility ?? 1; }
    if (labor) h.ownerShare += labor.ownerShare || 0;
    if (trade) { h.trade = trade.trade ?? 1; h.markup = trade.markup ?? 2.5; }
    if (army) { h.recruit = army.recruit ?? 1; h.upkeep = army.upkeep ?? 1; }
    for (const c of CAT_LIST) { const k = LAWS[civ.laws[c]]?.hooks; if (!k) continue; h.welfare += k.welfare || 0; h.school += k.school || 0; h.poorSol += k.poorSol || 0; }
    h.ownerShare = clamp(h.ownerShare, 0.05, 0.5);
  }
  civ._lawHooks = h;
  return h;
}
export const lawHook = (civ, k) => lawHooks(civ)[k];

export function lawAvailable(civ, id) {
  const L = LAWS[id];
  if (!L) return { ok: false, reason: 'Unknown law' };
  if (L.tech && !civ.techs.includes(L.tech)) return { ok: false, reason: 'Requires technology', tech: L.tech };
  return { ok: true };
}

// ---------------- Clout & approval ----------------
export function computeClout(civ) {
  const st = S();
  const raw = {};
  for (const g of GROUP_LIST) raw[g] = 0;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (!s?.pops) continue;
    for (const t of POP_LIST) {
      const n = s.pops[t];
      if (!n) continue;
      const wealth = 0.6 + ((s.solBy?.[t] ?? 5) / 10) * 0.8;
      for (const g of GROUP_LIST) { const share = GROUPS[g].pops[t]; if (share) raw[g] += n * share * (POP_WEIGHT[t] || 1) * wealth; }
    }
  }
  const voice = GOV_VOICE[civ.gov] || {};
  for (const g of GROUP_LIST) {
    raw[g] *= voice[g] ?? 1;
    for (const c of CAT_LIST) { const v = LAWS[civ.laws[c]]?.voice?.[g]; if (v) raw[g] *= v; }
  }
  let tot = 0; for (const g of GROUP_LIST) tot += raw[g];
  const out = {};
  for (const g of GROUP_LIST) out[g] = tot > 0 ? raw[g] / tot : 1 / GROUP_LIST.length;
  return out;
}
const stanceOf = (g, lawId) => LAWS[lawId]?.stance?.[g] ?? 0;

// Living standard of a group's members
function groupSol(civ, g) {
  const st = S();
  let sum = 0, n = 0;
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (!s?.pops) continue;
    for (const t in GROUPS[g].pops) { const k = s.pops[t] * GROUPS[g].pops[t]; if (k > 0) { sum += k * (s.solBy?.[t] ?? 5); n += k; } }
  }
  return n > 0 ? sum / n : 5;
}

// Approval target with its reasons (for tooltips)
// How much people care about laws: grows with the era, literacy and the form of government
export function awareness(civ) {
  let a = 0.35 + 0.2 * (civ.era || 0);
  if (civ.laws?.school === 'religious_schools') a += 0.08;
  if (civ.laws?.school === 'public_schools') a += 0.18;
  if (civ.gov === 'republic') a += 0.1;
  if (civ.gov === 'tribal') a -= 0.1;
  return clamp(a, 0.25, 1.2);
}
export function approvalBreakdown(civ, g) {
  const items = [];
  const aw = awareness(civ);
  for (const c of CAT_LIST) { const v = stanceOf(g, civ.laws[c]); if (v) items.push([`${LAWS[civ.laws[c]].name}`, Math.round(v * 1.5 * aw * 10) / 10]); }
  const sol = groupSol(civ, g);
  items.push([`Living standard (${sol.toFixed(1)})`, Math.round((sol - 5) * 0.8 * 10) / 10]);
  if (civ.enact) { const v = stanceOf(g, civ.enact.law) - stanceOf(g, civ.laws[civ.enact.cat]); if (v) items.push([`Enacting ${LAWS[civ.enact.law].name}`, v]); }
  items.push(['Stability', Math.round(((civ.stability - 50) / 25) * 10) / 10]);
  if (g === 'armed' && warsOf(civ.id).length) items.push(['At war', 1.5]);
  if (g === 'devout' && civ.tolerance === 'enforced') items.push(['Enforced faith', 1.5]);
  const grp = civ.groups?.[g];
  if (grp && (grp.bribeUntil || 0) > S().day) items.push(['Bought with gold', grp.bribe || 4]);
  let t = 0; for (const [, v] of items) t += v;
  return { target: clamp(t, -10, 10), items };
}

export const MOOD = (a) => (a >= 5 ? ['Loyal', 'good'] : a >= 1.5 ? ['Content', 'good'] : a > -1.5 ? ['Neutral', ''] : a > -3.5 ? ['Restless', 'warn'] : ['Angry', 'bad']);

// Net support for switching a category to `lawId`: -1 … +1 (weighted by clout).
export function supportFor(civ, lawId) {
  const L = LAWS[lawId];
  const cur = civ.laws[L.cat];
  let s = 0;
  for (const g of GROUP_LIST) s += (civ.groups[g]?.clout || 0) * (stanceOf(g, lawId) - stanceOf(g, cur)) / 2;
  // happy groups trust the government a bit more
  let mood = 0; for (const g of GROUP_LIST) mood += (civ.groups[g]?.clout || 0) * (civ.groups[g]?.approval || 0);
  return clamp(s + mood * 0.02, -1, 1);
}
export function supporters(civ, lawId) {
  const L = LAWS[lawId];
  const cur = civ.laws[L.cat];
  const pro = [], con = [];
  for (const g of GROUP_LIST) {
    const d = stanceOf(g, lawId) - stanceOf(g, cur);
    if (d > 0) pro.push(g); else if (d < 0) con.push(g);
  }
  return { pro, con };
}

// ---------------- Enactment ----------------
export function canEnact(civ, lawId) {
  const L = LAWS[lawId];
  if (!L) return { ok: false, reason: 'Unknown law' };
  if (civ.laws[L.cat] === lawId) return { ok: false, reason: 'Already in force' };
  const av = lawAvailable(civ, lawId);
  if (!av.ok) return av;
  if (civ.enact) return { ok: false, reason: `Already enacting ${LAWS[civ.enact.law].name}` };
  const sup = supportFor(civ, lawId);
  if (sup < -0.45) return { ok: false, reason: 'Too much opposition — win over more interest groups first', support: sup };
  return { ok: true, support: sup };
}
export function startEnact(civ, lawId) {
  const r = canEnact(civ, lawId);
  if (!r.ok) return r;
  const L = LAWS[lawId];
  civ.enact = { law: lawId, cat: L.cat, progress: 0, start: S().day };
  if (civ.isPlayer) log(`The court begins debating ${L.name}.`, { civ: civ.id, type: 'info' });
  return { ok: true };
}
export function cancelEnact(civ) {
  if (!civ.enact) return;
  if (civ.isPlayer) log(`Debate on ${LAWS[civ.enact.law].name} abandoned.`, { civ: civ.id, type: 'info' });
  civ.enact = null;
}
export function setLaw(civ, lawId, quiet = false) {
  const L = LAWS[lawId];
  const old = civ.laws[L.cat];
  civ.laws[L.cat] = lawId;
  civ._lawHooks = null;
  invalidateMods(civ);
  // groups react at once
  for (const g of GROUP_LIST) { const d = stanceOf(g, lawId) - stanceOf(g, old); civ.groups[g].approval = clamp(civ.groups[g].approval + d * 1.2, -10, 10); }
  if (!quiet) log(`${civ.displayName} enacts ${L.name} (${LAW_CATS[L.cat].name}).`, { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer, major: civ.isPlayer });
}
export function enactMonths(civ) {
  if (!civ.enact) return null;
  const rate = enactRate(supportFor(civ, civ.enact.law));
  return Math.ceil((100 - civ.enact.progress) / Math.max(1, rate));
}
const enactRate = (sup) => 5 + 15 * clamp(sup + 0.35, 0, 1.35);

// ---------------- Monthly update ----------------
export function politicsMonthly(civ) {
  ensurePolitics(civ);
  if (!civ.settlements.length) return;
  const clout = computeClout(civ);
  for (const g of GROUP_LIST) {
    const grp = civ.groups[g];
    grp.clout = clout[g];
    const { target } = approvalBreakdown(civ, g);
    grp.approval = clamp(grp.approval + (target - grp.approval) * 0.15, -10, 10);
    // Movements: angry, organised groups agitate for change
    const st = S();
    if (grp.approval <= -3.5 && grp.clout >= 0.06 && (grp.cool || 0) <= st.day && movementDemand(civ, g)) grp.movement = clamp(grp.movement + grp.clout * 16 * (1 + (-grp.approval - 3.5) / 4), 0, 100);
    else grp.movement = Math.max(0, grp.movement - 3);
    if (grp.movement >= 100) movementBoils(civ, g);
  }
  // Enactment progress
  if (civ.enact) {
    const sup = supportFor(civ, civ.enact.law);
    civ.enact.progress += enactRate(sup);
    if (sup < 0 && G.rng.chance(-sup * 0.5)) {
      civ.enact.progress = Math.max(0, civ.enact.progress - 12);
      if (civ.isPlayer) log(`Debate on ${LAWS[civ.enact.law].name} stalls in the council.`, { civ: civ.id, type: 'info' });
    }
    if (civ.enact.progress >= 100) { const law = civ.enact.law; civ.enact = null; setLaw(civ, law); }
  }
  // Running costs: schools and welfare
  const h = lawHooks(civ);
  let pop = 0; for (const id of civ.settlements) pop += S().settlements[id].pop;
  const cost = (h.welfare + h.school) * pop / 100;
  civ.treasury -= cost;
  if (civ.last) civ.last.lawCost = cost;
}

// What an angry group demands: the law it hates most → the alternative it likes most
export function movementDemand(civ, g) {
  let best = null, bestGain = 0;
  for (const c of CAT_LIST) {
    const cur = stanceOf(g, civ.laws[c]);
    for (const id of lawsIn(c)) {
      if (id === civ.laws[c] || !lawAvailable(civ, id).ok) continue;
      const gain = stanceOf(g, id) - cur;
      if (gain > bestGain) { bestGain = gain; best = id; }
    }
  }
  return best;
}

function movementBoils(civ, g) {
  const st = S();
  const grp = civ.groups[g];
  grp.movement = 0;
  grp.cool = st.day + 360 * 6;
  const demand = movementDemand(civ, g);
  if (!demand) return;
  if (civ.isPlayer) {
    if (st.pendingEvents.some((p) => p.ev === 'movement' && p.civ === civ.id)) return;
    st.pendingEvents.push({ id: st.nextEventId++, ev: 'movement', civ: civ.id, ctx: { g, demand }, day: st.day });
    return;
  }
  // AI: give in if the group is strong or the realm is fragile, otherwise risk a revolution
  if (demand && (grp.clout > 0.22 || civ.stability < 35 || G.rng.chance(0.5))) concedeMovement(civ, g, demand);
  else refuseMovement(civ, g);
}
export function concedeMovement(civ, g, demand) {
  if (demand && LAWS[demand]) { if (civ.enact?.cat === LAWS[demand].cat) civ.enact = null; setLaw(civ, demand, true); }
  civ.groups[g].approval = Math.min(10, civ.groups[g].approval + 6);
  civ.stability = Math.max(0, civ.stability - 4);
  log(`${GROUPS[g].name} force ${civ.displayName} to accept ${demand ? LAWS[demand].name : 'their demands'}.`, { civ: civ.id, type: civ.isPlayer ? 'info' : 'world', major: true });
}
export function refuseMovement(civ, g) {
  civ.groups[g].approval = Math.max(-10, civ.groups[g].approval - 2);
  civ.stability = Math.max(0, civ.stability - 8);
  for (const id of civ.settlements) { const s = S().settlements[id]; s.unrest = Math.min(100, (s.unrest || 0) + 12 * civ.groups[g].clout * 4); }
  const strong = civ.groups[g].clout > 0.18 && civ.settlements.length >= 3;
  if (strong && (civ.isPlayer ? G.rng.chance(0.6) : G.rng.chance(0.5))) {
    const w = startCivilWar(civ, 'revolution');
    if (w) log(`The ${GROUPS[g].name} rise in revolution against ${civ.displayName}!`, { civ: civ.id, type: 'bad', toast: civ.isPlayer, major: true });
  } else log(`${civ.displayName} defies the ${GROUPS[g].name}; riots spread.`, { civ: civ.id, type: civ.isPlayer ? 'bad' : 'world' });
}

// Stability contribution of interest groups
export function groupsStability(civ) {
  if (!civ.groups) return 0;
  let v = 0;
  for (const g of GROUP_LIST) v += (civ.groups[g].clout || 0) * (civ.groups[g].approval || 0);
  return Math.round(clamp(v * 1.4, -15, 10));
}

// ---------------- AI ----------------
const ERA_TASTE = {
  // laws the AI leans toward, by personality tag
  econ: ['proportional_tax', 'free_trade', 'tenant_farming', 'guild_charters', 'income_tax', 'homesteading'],
  science: ['religious_schools', 'public_schools', 'freedom_of_conscience', 'secularism'],
  military: ['professional_army', 'mass_conscription', 'per_capita'],
  pious: ['state_religion', 'religious_schools', 'poor_relief'],
};
export function aiPoliticsYearly(civ) {
  if (civ.isPlayer && !civ.autoBuild) return;
  ensurePolitics(civ);
  if (civ.enact || !civ.settlements.length) return;
  if (!G.rng.chance(civ.isPlayer ? 0.35 : 0.5)) return;
  const tags = G.ai?.persona?.(civ)?.tags || {};
  let best = null, bestScore = 0.25;
  for (const id of Object.keys(LAWS)) {
    const r = canEnact(civ, id);
    if (!r.ok) continue;
    const L = LAWS[id];
    let sc = r.support * 1.6;
    if (ERA_TASTE.econ.includes(id)) sc += 0.35 * (tags.econ || 1);
    if (ERA_TASTE.science.includes(id)) sc += 0.35 * (tags.science || 1);
    if (ERA_TASTE.military.includes(id)) sc += 0.3 * (tags.military || 1);
    if (ERA_TASTE.pious.includes(id)) sc += civ.stability < 45 ? 0.3 : 0;
    // tax: more revenue when broke
    if (L.cat === 'tax' && (L.fx.tax || 0) > (LAWS[civ.laws.tax].fx.tax || 0) && civ.treasury < 200) sc += 0.4;
    // welfare and schools only when rich enough
    const h = L.hooks || {};
    if ((h.welfare || h.school) && civ.treasury < 400) sc -= 0.6;
    if (L.cat === 'welfare' && (civ.sol ?? 5) < 5) sc += 0.3;
    sc += (G.rng.next() - 0.5) * 0.3;
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  if (best) startEnact(civ, best);
}

// Helpers for the UI
export const groupName = (g) => GROUPS[g]?.name || g;
export const lawName = (id) => LAWS[id]?.name || id;
export function rulingSummary(civ) {
  const gs = GROUP_LIST.map((g) => ({ g, ...civ.groups[g] })).sort((a, b) => b.clout - a.clout);
  return gs;
}
void civOf;
