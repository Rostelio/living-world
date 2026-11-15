// Phase 15 — objective-driven AI wars. Realms go to war for something: land with resources
// they lack, a blood claim, a rival to humble, a rich neighbour's gold — and only when their
// power (with allies) and readiness (treasury, stability, exhaustion) make it worth the risk.
import { G, S, civOf } from './state.js';
import { RESOURCES } from '../data/biomes.js';
import { canDeclareWar, coalitionStrength, opinion, warsOf } from './diplomacy.js';
import { TRAITS } from '../world/regions.js';
import { temperament, grievance, lostTowns } from './memory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TRAIT_VALUE = { fertile_valley: 1.2, rich_vein: 1.5, crossroads: 1.2, holy_site: 1.5, natural_harbour: 0.8, fishing_banks: 0.6, timberland: 0.4, steppe: 0.4 };

// Deposit kinds a realm already controls
export function ownedDeposits(civ) {
  const W = G.world, st = S();
  const set = new Set();
  for (const id of civ.settlements) { const s = st.settlements[id]; for (const p of [s.province, ...(s.claims || [])]) for (const k in W.provinces[p]?.resources || {}) set.add(+k); }
  return set;
}
// How much a settlement is worth taking, and why
export function settlementPrize(att, s) {
  const W = G.world;
  const have = ownedDeposits(att);
  let v = 0.4 + s.pop / 250 + s.stage * 0.4;
  const why = [];
  for (const p of [s.province, ...(s.claims || [])]) {
    for (const k in W.provinces[p]?.resources || {}) if (!have.has(+k)) { v += 1.6; why.push(RESOURCES[k].name.toLowerCase()); }
    for (const t of W.provinces[p]?.traits || []) if (TRAIT_VALUE[t]) { v += TRAIT_VALUE[t]; if (!why.length) why.push(TRAITS[t].name.toLowerCase()); }
  }
  return { v, why: [...new Set(why)].slice(0, 2) };
}
function borderSettlements(att, def) {
  const st = S(), W = G.world;
  const A = civOf(att), D = civOf(def);
  const near = D.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital && W.provinces[s.province].neighbors.some((n) => st.provinces[n].owner === att));
  if (near.length) return near;
  return D.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital && W.provinces[s.province].coastal && (A.seaContacts || []).includes(def));
}
// Readiness of a realm for war: 0 (not now) .. 1
export function readiness(civ) {
  if (civ.stability < 35) return 0;
  const wars = warsOf(civ.id);
  if (wars.some((w) => w.att.includes(civ.id) || w.def.includes(civ.id))) return 0;
  const income = Math.max(10, (civ.last?.tax || 0) + (civ.last?.trade || 0));
  const money = clamp(civ.treasury / (income * 6), 0, 1);
  const recent = civ.lastWarDay != null ? clamp((S().day - civ.lastWarDay) / (360 * (civ.ambition ? 5 : 8)), 0, 1) : 1;
  return clamp(0.25 + money * 0.45 + (civ.stability - 35) / 130, 0, 1) * (0.3 + 0.7 * recent);
}
const AGGR = { militaristic: 1.5, expansionist: 1.3, trader: 0.6, defensive: 0.5, diplomatic: 0.5, isolationist: 0.35 };

// Pick the best war objective against any neighbour, or null
export function planWar(civ) {
  const st = S();
  const ready = readiness(civ);
  if (!ready) return null;
  const mine = coalitionStrength(civ.id);
  let best = null;
  for (const c of new Set([...civ.contacts, ...(civ.seaContacts || [])])) {
    const D = civOf(c);
    if (!D?.alive || D.rebel || !canDeclareWar(civ.id, c).ok) continue;
    if (D.isPlayer && st.day < 360 * 30) continue; // grace period for the player
    // Phase 21: a small young player realm is left alone unless there is real bad blood or
    // overwhelming strength (and longer on easy difficulty)
    const easy = st.difficulty === 'easy' || st.difficulty === 'peaceful';
    if (D.isPlayer && D.settlements.length <= 3 && st.day < 360 * (easy ? 90 : 60) && grievance(civ.id, c) < 20 && mine / Math.max(1, coalitionStrength(c)) < 2.5) continue;
    const ratio = mine / Math.max(1, coalitionStrength(c));
    const amb = civ.ambition?.def === c ? civ.ambition : null; // Phase 19: a long-held ambition
    if (ratio < (amb ? 0.95 : 1.15)) continue; // never pick a fight it expects to lose
    const power = clamp((ratio - 1.1) / 1.4, 0.05, 1.4);
    const op = opinion(civ.id, c);
    const grudge = grievance(civ.id, c);
    const hate = clamp(1 - op / 60 + grudge / 60, 0.2, 2.2) * (civ.rival === c ? 1.5 : 1) * (amb ? 1.6 : 1);
    const opts = [];
    // land worth having
    const border = borderSettlements(civ.id, c);
    let prize = null;
    for (const s of border) { const p = settlementPrize(civ, s); if (!prize || p.v > prize.v) prize = { ...p, s }; }
    if (prize) opts.push({ type: 'conquest', target: prize.s.id, v: prize.v, why: prize.why.length ? `for its ${prize.why.join(' and ')}` : 'for land' });
    // Phase 17: revenge — retake towns they took from us
    for (const s of lostTowns(civ.id, c)) { const p = settlementPrize(civ, s); opts.push({ type: 'conquest', target: s.id, v: p.v + 2.2, why: `to retake ${s.name}` }); }
    if (grudge > 25 && !opts.some((o) => o.why?.startsWith('to retake'))) opts.push({ type: 'humiliate', v: 1 + grudge / 40, why: 'to avenge old wrongs' });
    if (G.characters?.hasClaim(civ.id, c)) opts.push({ type: 'claim', v: 3.2, why: 'to press a claim to its throne' });
    if (civ.rival === c) opts.push({ type: 'humiliate', v: 1.8, why: 'to humble a rival' });
    if (amb?.type === 'region' && S().settlements[amb.target]?.civ === c) opts.push({ type: 'conquest', target: amb.target, v: settlementPrize(civ, S().settlements[amb.target]).v + 3, why: `to win ${S().settlements[amb.target].name}, its long ambition` });
    else if (amb) opts.push({ type: amb.type === 'dominate' && ratio > 3 ? 'vassal' : 'humiliate', v: 3, why: 'in pursuit of its long ambition' });
    const T = temperament(civ);
    if (D.treasury > Math.max(400, civ.treasury * 1.5)) opts.push({ type: 'tribute', v: (1 + Math.min(2, D.treasury / 2000)) * T.greed, why: 'for its gold' });
    if (ratio > 3 && D.overlord < 0) opts.push({ type: 'vassal', v: 2.2 + Math.min(2, D.settlements.length / 6), why: 'to make it a vassal' });
    for (const o of opts) {
      const score = o.v * power * hate * ready * (AGGR[civ.personality] ?? 0.6) * T.war * (o.type === 'vassal' && ratio < 3 ? 0 : 1);
      if (!best || score > best.score) best = { ...o, def: c, score, ratio };
    }
  }
  return best;
}
// Yearly: chance to act grows with how attractive the best objective is
export function aiWarYearly(civ) {
  if (!G.plays || civ.isPlayer || civ.rebel || civ.overlord >= 0) return;
  const st = S();
  if (st.day < 360 * 15) return; // tribes settle first
  if (G.plays.playsOf(civ.id).some((p) => p.att === civ.id)) return;
  const plan = planWar(civ);
  if (!plan) return;
  if (G.rng.chance(clamp(plan.score * 0.22, 0, 0.6))) G.plays.startPlay(civ.id, plan.def, plan.type, { target: plan.target, why: plan.why });
}
