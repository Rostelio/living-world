// Phase 19 — the late game. Gold that keeps its meaning (the cost of running a big realm,
// inflation from hoarding, great works that can be built again and again), and a world that
// keeps moving (long-term ambitions, coalitions against the strongest realm, world crises).
import { G, S, log, civOf } from './state.js';
import { mods, invalidateMods } from './mods.js';
import { allied, atWar, canDeclareWar, declareWar, coalitionStrength, militaryStrength, opinion, rel, sendGift, signAlliance, warsOf } from './diplomacy.js';
import { settlementPrize } from './warplans.js';
import { startCivilWar } from './unrest.js';
import { startPlague } from './disasters.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const income = (civ) => Math.max(20, (civ.last?.tax || 0) + (civ.last?.trade || 0) + (civ.last?.tradeIncome || 0));
const YEAR = 360;

// ---------------- The cost of a big realm ----------------
export function adminReach(civ) { return (mods(civ).admin || 3) * 1.6 + 4; }
// Share of taxes and trade spent on governors, clerks and courts beyond the realm's reach
export function adminShare(civ) {
  const over = Math.max(0, civ.settlements.length - adminReach(civ));
  return clamp(over * 0.012, 0, 0.4);
}

// ---------------- Inflation ----------------
// A hoard of more than six months of income drives prices up; spending it lets them settle.
export function inflationMul(civ) { return 1 + (civ.inflation || 0) / 100; }
function inflationMonthly(civ) {
  const months = civ.treasury / income(civ);
  const target = clamp((months - 6) * 3, 0, 50);
  const cur = civ.inflation || 0;
  civ.inflation = Math.round((target > cur ? Math.min(target, cur + 0.4) : Math.max(target, cur - 0.25)) * 100) / 100;
}

// ---------------- Great works ----------------
// Built in a chosen town, repeatable across the realm (each town hosts each work once).
// Cost is a base plus months of the realm's income at the time it is begun.
export const WORKS = {
  canal: { name: 'Grand Canal', icon: '≋', era: 1, base: 1500, months: 6, fx: { gold: 0.05, growth: 0.03 }, need: 'water', desc: '+5% gold, +3% growth. Needs a river or the coast.' },
  cathedral: { name: 'Cathedral', icon: '✝', era: 1, base: 1500, months: 6, fx: { stability: 3 }, desc: '+3 stability.' },
  university: { name: 'University', icon: '✎', era: 2, base: 3000, months: 8, fx: { knowledge: 0.08 }, desc: '+8% knowledge.' },
  palace: { name: 'Grand Palace', icon: '♛', era: 2, base: 3000, months: 10, fx: { admin: 1, stability: 2 }, capital: true, desc: '+1 administration (cheaper big realm), +2 stability. Capital only.' },
  harbour_works: { name: 'Harbour Works', icon: '⚓', era: 2, base: 2500, months: 7, fx: { tax: 0.04, gold: 0.03 }, need: 'coast', desc: '+4% taxes, +3% gold. Coastal towns.' },
  boulevards: { name: 'Boulevards & Parks', icon: '❀', era: 3, base: 6000, months: 9, fx: { growth: 0.05, stability: 2, housing: 0.05 }, desc: '+5% growth, +5% housing, +2 stability.' },
  world_fair: { name: "World's Fair", icon: '✺', era: 3, base: 8000, months: 8, fx: { stability: 5, gold: 0.08 }, years: 10, again: 40, desc: '+5 stability, +8% gold for 10 years. Can be held again after 40 years.' },
};
export const WORK_LIST = Object.keys(WORKS);
export const WORK_RATES = [0, 0.05, 0.1, 0.2, 0.35];

const doneIn = (s, id) => (s.works || []).includes(id);
const builtCount = (civ, id) => (civ.works || []).filter((w) => w.id === id).length;
export function canBuildWork(civ, id, s) {
  const Wk = WORKS[id];
  if (!Wk || !s || s.civ !== civ.id) return { ok: false, reason: 'Invalid' };
  if ((civ.era || 0) < Wk.era) return { ok: false, reason: `Requires the ${['Ancient', 'Medieval', 'Renaissance', 'Industrial', 'Modern'][Wk.era]} era` };
  if (s.stage < 2) return { ok: false, reason: 'Needs a town' };
  if (Wk.capital && !s.isCapital) return { ok: false, reason: 'Capital only' };
  const P = G.world.provinces[s.province];
  if (Wk.need === 'coast' && !P.coastal) return { ok: false, reason: 'Needs a coastal town' };
  if (Wk.need === 'water' && !P.coastal && !P.river) return { ok: false, reason: 'Needs a river or the coast' };
  if (Wk.again) { const last = (civ.works || []).filter((w) => w.id === id).pop(); if (last && S().day - last.day < Wk.again * YEAR) return { ok: false, reason: `Held ${Math.floor((S().day - last.day) / YEAR)} years ago` }; }
  else if (doneIn(s, id)) return { ok: false, reason: 'Already built here' };
  if (civ.work && civ.work.id === id && civ.work.s === s.id) return { ok: false, reason: 'Under way' };
  return { ok: true };
}
export function workCost(civ, id) {
  const Wk = WORKS[id];
  return Math.round((Wk.base + income(civ) * Wk.months) * (1 + 0.25 * builtCount(civ, id)));
}
export function startWork(civ, id, sid, rate = 2) {
  const s = S().settlements[sid];
  const r = canBuildWork(civ, id, s);
  if (!r.ok) return r;
  if (civ.work) civ.treasury += civ.work.invested * 0.5;
  civ.work = { id, s: sid, invested: 0, cost: workCost(civ, id), rate };
  return { ok: true };
}
export function setWorkRate(civ, rate) { if (civ.work) civ.work.rate = clamp(rate | 0, 0, WORK_RATES.length - 1); }
export function cancelWork(civ) { if (civ.work) { civ.treasury += civ.work.invested * 0.5; civ.work = null; } }
function finishWork(civ) {
  const st = S(), w = civ.work, Wk = WORKS[w.id], s = st.settlements[w.s];
  civ.work = null;
  if (!s || s.dead || s.civ !== civ.id) return;
  const n = builtCount(civ, w.id);
  const f = Math.pow(0.6, n); // each further work of a kind adds less
  const fx = {}; for (const k in Wk.fx) fx[k] = Math.round(Wk.fx[k] * f * 1000) / 1000;
  (civ.works ??= []).push({ id: w.id, s: s.id, day: st.day });
  (s.works ??= []).push(w.id);
  s.rev = (s.rev || 0) + 1;
  civ.modifiers ??= [];
  civ.modifiers.push({ name: `${Wk.name} (${s.name})`, fx, until: Wk.years ? st.day + Wk.years * YEAR : -1 });
  invalidateMods(civ);
  log(`${Wk.icon} ${civ.displayName} completes the ${Wk.name} in ${s.name}. ${Wk.desc}`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer, tile: s.tile });
}
function workMonthly(civ) {
  const w = civ.work;
  if (!w) { if (civ.last) civ.last.works = 0; return; }
  const s = S().settlements[w.s];
  if (!s || s.dead || s.civ !== civ.id) { civ.work = null; if (civ.isPlayer) log('Our great work was lost with the town.', { civ: civ.id, type: 'bad' }); return; }
  let amt = Math.min(Math.max(0, civ.treasury), income(civ) * WORK_RATES[w.rate], w.cost - w.invested);
  // the AI also pours a slice of a large hoard in
  if ((!civ.isPlayer || civ.autoBuild) && civ.treasury > income(civ) * 8) amt = Math.min(w.cost - w.invested, amt + (civ.treasury - income(civ) * 8) * 0.08);
  civ.treasury -= amt;
  w.invested += amt;
  if (civ.last) civ.last.works = amt;
  if (w.invested >= w.cost - 0.5) finishWork(civ);
}
export function workOptions(civ) {
  const out = [];
  for (const id of WORK_LIST) for (const sid of civ.settlements) { const s = S().settlements[sid]; if (canBuildWork(civ, id, s).ok) out.push({ id, s }); }
  return out;
}

// ---------------- Monthly ----------------
export function lateMonthly(civ) {
  if (!civ.alive) return;
  // administration
  const adm = ((civ.last?.tax || 0) + (civ.last?.trade || 0)) * adminShare(civ);
  civ.treasury -= adm;
  if (civ.last) civ.last.admin = adm;
  inflationMonthly(civ);
  workMonthly(civ);
  if (!civ.isPlayer || civ.autoBuild) aiLateSpend(civ);
}
function aiLateSpend(civ) {
  const inc = income(civ);
  const reserve = 150 + inc * 6;
  if (!civ.work && civ.treasury > reserve && G.rng.chance(0.1)) {
    const opts = workOptions(civ);
    if (opts.length) {
      opts.sort((a, b) => b.s.pop - a.s.pop);
      const o = opts[G.rng.int(0, Math.min(3, opts.length - 1))];
      startWork(civ, o.id, o.s.id, civ.treasury > reserve * 3 ? 4 : 3);
    }
  }
  // subsidies: a rich realm props up a struggling ally (and wins its loyalty)
  if (civ.treasury > inc * 10 && G.rng.chance(0.04)) {
    const friends = S().civs.filter((o) => o.alive && o.id !== civ.id && allied(civ.id, o.id) && o.treasury < income(o) * 2);
    const f = friends.sort((a, b) => a.treasury - b.treasury)[0];
    if (f) sendGift(civ.id, f.id, Math.round(Math.min(civ.treasury * 0.08, income(f) * 6 + 200)));
  }
}

// ---------------- Ambitions ----------------
// An AI realm sets itself a long-term goal against one neighbour and keeps to it for decades.
export function ambitionText(civ) {
  const a = civ.ambition;
  if (!a) return '';
  const D = civOf(a.def);
  if (a.type === 'region') return `take ${S().settlements[a.target]?.name || 'land'} from ${D.displayName}`;
  if (a.type === 'humble') return `humble ${D.displayName}`;
  return `dominate ${D.displayName}`;
}
function ambitionYearly(civ) {
  const st = S();
  const a = civ.ambition;
  if (a) {
    const D = civOf(a.def);
    const t = a.target != null ? st.settlements[a.target] : null;
    const done = a.type === 'region' ? (t && t.civ === civ.id) : false;
    if (!D?.alive || done || st.day > a.until || (t && t.dead)) {
      if (done) log(`${civ.displayName} has fulfilled its ambition: ${t.name} is theirs.`, { civ: civ.isPlayer || D?.isPlayer ? st.playerId : -1, type: 'world' });
      civ.ambition = null;
    }
    return;
  }
  if (civ.isPlayer || civ.rebel || civ.overlord >= 0 || st.day < 40 * YEAR || !G.rng.chance(0.12)) return;
  let best = null;
  for (const c of new Set([...civ.contacts, ...(civ.seaContacts || [])])) {
    const D = civOf(c);
    if (!D?.alive || D.rebel || allied(civ.id, c)) continue;
    const ratio = militaryStrength(civ.id) / Math.max(1, militaryStrength(c));
    if (ratio < 0.6) continue;
    const op = opinion(civ.id, c);
    for (const id of D.settlements) {
      const s = st.settlements[id];
      if (s.isCapital) continue;
      const v = settlementPrize(civ, s).v * (1 - op / 120) * (civ.rival === c ? 1.5 : 1);
      if (!best || v > best.v) best = { v, def: c, target: s.id, type: 'region' };
    }
    if (civ.rival === c && ratio > 0.9 && (!best || best.v < 3)) best = { v: 3, def: c, target: null, type: ratio > 1.8 ? 'dominate' : 'humble' };
  }
  if (!best || best.v < 1.5) return;
  civ.ambition = { type: best.type, def: best.def, target: best.target, since: st.day, until: st.day + G.rng.int(30, 55) * YEAR };
  const D = civOf(best.def);
  log(`⚑ ${civ.displayName} sets its sights on a great ambition: to ${ambitionText(civ)}.`, { civ: D.isPlayer ? D.id : -1, type: D.isPlayer ? 'bad' : 'world', toast: D.isPlayer });
}

// ---------------- Coalitions against the strongest realm ----------------
export function leaderShare() {
  const st = S();
  const counts = st.civs.filter((c) => c.alive).map((c) => [c, c.settlements.length]).sort((a, b) => b[1] - a[1]);
  const total = counts.reduce((s, x) => s + x[1], 0) || 1;
  return { leader: counts[0]?.[0], share: (counts[0]?.[1] || 0) / total, second: counts[1]?.[1] || 0 };
}
function coalitionYearly() {
  const st = S();
  const co = st.coalition;
  if (co) {
    const T = civOf(co.target);
    co.members = co.members.filter((m) => civOf(m).alive && !allied(m, co.target));
    const { leader, share } = leaderShare();
    if (!T.alive || co.members.length < 2 || (leader !== T && share < 0.2) || st.day - co.since > 45 * YEAR) {
      log(`The coalition against ${T.displayName} breaks up.`, { civ: T.isPlayer || co.members.includes(st.playerId) ? st.playerId : -1, type: 'world' });
      st.coalition = null;
      return;
    }
    // members keep each other close and loathe the target
    for (const m of co.members) rel(m, co.target).grudge = Math.max(rel(m, co.target).grudge, 20);
    // when together they are a match for it, they strike
    const atWarWith = co.members.some((m) => atWar(m, co.target));
    if (!atWarWith && st.day - (co.lastWar || 0) > 12 * YEAR) {
      const ours = co.members.reduce((s, m) => s + militaryStrength(m), 0);
      if (ours > militaryStrength(co.target) * 1.05 && G.rng.chance(0.35)) {
        const lead = co.members.filter((m) => !civOf(m).isPlayer && canDeclareWar(m, co.target).ok).sort((a, b) => militaryStrength(b) - militaryStrength(a))[0];
        if (lead != null) {
          const r = declareWar(lead, co.target);
          if (r.ok) {
            co.lastWar = st.day;
            for (const m of co.members) if (m !== lead && !civOf(m).isPlayer && !r.war.att.includes(m) && !r.war.def.includes(m) && !allied(m, co.target)) r.war.att.push(m);
            r.war.name = `War of the Coalition against ${T.baseName}`;
            log(`⚔ The coalition marches on ${T.displayName}: ${r.war.att.map((c) => civOf(c).baseName).join(', ')}.`, { civ: T.isPlayer || r.war.att.includes(st.playerId) ? st.playerId : -1, type: T.isPlayer ? 'bad' : 'world', toast: true, major: true });
          }
        }
      }
    }
    return;
  }
  const { leader, share, second } = leaderShare();
  if (!leader || share < 0.24 || leader.settlements.length < second * 1.5 || st.day < 60 * YEAR) return;
  const members = leader.contacts.filter((c) => { const o = civOf(c); return o?.alive && !o.isPlayer && !o.rebel && o.overlord < 0 && !allied(c, leader.id) && opinion(c, leader.id) < 30; });
  if (members.length < 2) return;
  st.coalition = { target: leader.id, members, since: st.day, lastWar: st.day - 8 * YEAR };
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (!allied(members[i], members[j]) && !atWar(members[i], members[j])) signAlliance(members[i], members[j]);
  log(`⚖ Alarmed by the might of ${leader.displayName}, ${members.map((c) => civOf(c).baseName).join(', ')} form a coalition against it!`, { civ: leader.isPlayer ? leader.id : -1, type: leader.isPlayer ? 'bad' : 'world', toast: true, major: true });
  // the player may join if they share the worry
  if (!leader.isPlayer && st.civs[st.playerId]?.alive && leader.contacts.includes(st.playerId) && !allied(st.playerId, leader.id)) st.pendingEvents.push({ id: st.nextEventId++, ev: 'coalition_invite', civ: st.playerId, ctx: { t: leader.id }, day: st.day });
}
export function joinCoalition(c) {
  const co = S().coalition;
  if (!co || co.members.includes(c) || co.target === c) return false;
  if (allied(c, co.target)) return false;
  co.members.push(c);
  for (const m of co.members) if (m !== c && !allied(m, c) && !atWar(m, c)) signAlliance(m, c);
  return true;
}

// ---------------- World crises ----------------
const CRISES = ['great_war', 'revolution', 'great_plague', 'crash', 'schism'];
function crisisYearly() {
  const st = S();
  if (st.day < 90 * YEAR) return;
  st.nextCrisis ??= st.day + G.rng.int(5, 20) * YEAR;
  if (st.day < st.nextCrisis) return;
  st.nextCrisis = st.day + G.rng.int(30, 50) * YEAR;
  const alive = st.civs.filter((c) => c.alive && c.settlements.length && !c.rebel);
  const order = G.rng.shuffle([...CRISES]);
  for (const k of order) if (CRISIS_FX[k](alive)) { st.lastCrisis = { kind: k, day: st.day }; return; }
}
const big = (alive) => [...alive].sort((a, b) => b.settlements.length - a.settlements.length);
const CRISIS_FX = {
  great_war(alive) {
    const P = [...alive].sort((a, b) => coalitionStrength(b.id) - coalitionStrength(a.id)).slice(0, 4);
    for (const A of P) for (const B of P) {
      if (A === B || A.isPlayer || !canDeclareWar(A.id, B.id).ok) continue;
      const r = declareWar(A.id, B.id);
      if (!r.ok) continue;
      // every ally answers the call
      for (const c of S().civs) if (c.alive && !c.isPlayer && !r.war.att.includes(c.id) && !r.war.def.includes(c.id) && allied(c.id, A.id) && !allied(c.id, B.id)) r.war.att.push(c.id);
      r.war.name = `The Great War of ${A.baseName} and ${B.baseName}`;
      log(`🔥 GREAT WAR! The great powers clash: ${r.war.att.map((c) => civOf(c).baseName).join(', ')} against ${r.war.def.map((c) => civOf(c).baseName).join(', ')}.`, { civ: -1, type: 'world', toast: true, major: true, tile: S().settlements[B.capital]?.tile ?? -1 });
      return true;
    }
    return false;
  },
  revolution(alive) {
    const C = big(alive).filter((c) => c.settlements.length >= 6 && !warsOf(c.id).some((w) => w.civil)).sort((a, b) => a.stability - b.stability)[0];
    if (!C || C.stability > 70) return false;
    const cw = startCivilWar(C, 'revolution');
    if (!cw) return false;
    log(`🔥 REVOLUTION! The people of ${C.displayName} rise against the old order.`, { civ: C.isPlayer ? C.id : -1, type: C.isPlayer ? 'bad' : 'world', toast: true, major: true });
    return true;
  },
  great_plague(alive) {
    const st = S();
    const towns = st.settlements.filter((s) => !s.dead && s.stage >= 2);
    if (towns.length < 6) return false;
    G.rng.shuffle(towns);
    let n = 0;
    for (const s of towns.slice(0, Math.max(4, Math.round(towns.length * 0.25)))) if (startPlague(s, 0.02 + G.rng.next() * 0.02)) n++;
    if (!n) return false;
    log(`☣ THE GREAT PESTILENCE! A plague sweeps the known world — ${n} towns are stricken.`, { civ: -1, type: 'world', toast: true, major: true });
    void alive;
    return true;
  },
  crash(alive) {
    const rich = alive.filter((c) => (c.era || 0) >= 2 && c.treasury > income(c) * 6);
    if (rich.length < 2) return false;
    for (const c of rich) {
      c.treasury *= 0.7;
      (c.modifiers ??= []).push({ name: 'The Great Crash', fx: { stability: -5, gold: -0.1 }, until: S().day + 3 * YEAR });
      invalidateMods(c);
    }
    log(`📉 THE GREAT CRASH! Banks fail and fortunes vanish: ${rich.map((c) => c.baseName).join(', ')} lose a third of their treasuries.`, { civ: rich.some((c) => c.isPlayer) ? S().playerId : -1, type: 'world', toast: true, major: true });
    return true;
  },
  schism(alive) {
    const st = S();
    const byFaith = {};
    for (const c of alive) if (c.faith != null) (byFaith[c.faith] ??= []).push(c);
    const group = Object.values(byFaith).sort((a, b) => b.length - a.length)[0];
    if (!group || group.length < 2) return false;
    for (const c of group) {
      (c.modifiers ??= []).push({ name: 'The Great Schism', fx: { stability: -8 }, until: st.day + 5 * YEAR });
      invalidateMods(c);
      for (const id of c.settlements) { const s = st.settlements[id]; if (G.rng.chance(0.3)) s.unrest = Math.min(100, (s.unrest || 0) + 20); }
    }
    const fname = st.faiths?.[group[0].faith]?.name || 'the old faith';
    log(`✝ THE GREAT SCHISM! Rival preachers tear ${fname} apart; ${group.length} realms are shaken.`, { civ: group.some((c) => c.isPlayer) ? st.playerId : -1, type: 'world', toast: true, major: true });
    return true;
  },
};

// ---------------- Yearly ----------------
export function lateYearly() {
  const st = S();
  for (const c of st.civs) if (c.alive) ambitionYearly(c);
  coalitionYearly();
  crisisYearly();
}
export function ensurePhase19(st) {
  for (const c of st.civs) { c.inflation ??= 0; c.works ??= []; c.work ??= null; c.ambition ??= null; }
  for (const s of st.settlements) if (s && !s.dead) s.works ??= [];
  st.coalition ??= null;
}
