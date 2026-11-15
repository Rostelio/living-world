// Diplomatic plays (Phase 8, after Victoria 3).
// Wars no longer start instantly: a realm makes a demand, the crisis escalates for
// several months while both sides gather backers, and it ends with the target
// conceding, the instigator backing down — or war fought over the demand.
import { G, S, log, civOf } from './state.js';
import { canDeclareWar, declareWar, allied, opinion, rel, coalitionStrength, vassalPair, warBetween } from './diplomacy.js';
import { transferSettlement } from './settlements.js';
import { remember } from './memory.js';

export const DEMANDS = {
  conquest: { name: 'Cede a province', short: 'cede', severity: 1, desc: 'They hand over a settlement on our border.' },
  tribute: { name: 'Pay tribute', short: 'tribute', severity: 0.6, desc: 'They pay a third of their treasury.' },
  vassal: { name: 'Submit as vassal', short: 'vassalage', severity: 1.6, desc: 'They become our vassal.' },
  humiliate: { name: 'Humiliate', short: 'humiliation', severity: 0.3, desc: 'They lose face and stability; we gain stability.' },
  claim: { name: 'Press our claim', short: 'our claim to their throne', severity: 1.4, desc: 'Our blood claim: a member of our house takes their throne and they become our vassal.' },
};
const ESCALATION_PER_MONTH = 14;

export const playsOf = (c) => (S().plays || []).filter((p) => p.att === c || p.def === c || p.attB.includes(c) || p.defB.includes(c));
export const playBetween = (a, b) => (S().plays || []).find((p) => (p.att === a && p.def === b) || (p.att === b && p.def === a));

function conquestTarget(att, def) {
  const st = S();
  const W = G.world;
  const A = civOf(att), D = civOf(def);
  const border = D.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital && W.provinces[s.province].neighbors.some((n) => st.provinces[n].owner === att));
  const pool = border.length ? border : D.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital && W.provinces[s.province].coastal && (A.seaContacts || []).includes(def));
  if (!pool.length) return null;
  return pool.sort((a, b) => a.pop - b.pop)[0].id;
}

export function canStartPlay(att, def, type) {
  const chk = canDeclareWar(att, def);
  if (!chk.ok) return chk;
  if (playBetween(att, def)) return { ok: false, reason: 'A crisis between you is already under way' };
  if (type === 'conquest' && conquestTarget(att, def) == null) return { ok: false, reason: 'No settlement of theirs borders your lands' };
  if (type === 'vassal' && civOf(def).overlord >= 0) return { ok: false, reason: 'Already someone’s vassal' };
  if (type === 'claim' && !(G.characters?.hasClaim(att, def))) return { ok: false, reason: 'No claim on their throne (gained through royal marriages)' };
  return { ok: true };
}

export function startPlay(att, def, type, plan = {}) {
  const chk = canStartPlay(att, def, type);
  if (!chk.ok) return chk;
  const st = S();
  const A = civOf(att), D = civOf(def);
  const target = type === 'conquest' ? (plan.target != null && st.settlements[plan.target]?.civ === def ? plan.target : conquestTarget(att, def)) : null;
  const p = { id: st.nextPlayId++, att, def, type, target, why: plan.why || null, start: st.day, escalation: 0, attB: [], defB: [] };
  // Natural backers: allies, overlords and vassals
  for (const c of st.civs) {
    if (!c.alive || c.id === att || c.id === def) continue;
    if (allied(c.id, def) || c.overlord === def || D.overlord === c.id) { if (!allied(c.id, att)) p.defB.push(c.id); }
    else if (c.overlord === att) p.attB.push(c.id);
    else if (allied(c.id, att) && opinion(c.id, att) > 30) p.attB.push(c.id);
  }
  st.plays.push(p);
  A.ae = (A.ae || 0) + 2;
  rel(att, def).grudge += 15;
  const what = type === 'conquest' ? `the surrender of ${st.settlements[p.target].name}` : DEMANDS[type].short;
  const me = st.playerId;
  const involved = att === me || def === me;
  log(`CRISIS! ${A.displayName} demands ${what} from ${D.displayName}${p.why ? ' — ' + p.why : ''}.`, { civ: involved ? me : att, type: involved ? 'bad' : 'world', toast: true, major: true, tile: st.settlements[D.capital]?.tile ?? -1 });
  return { ok: true, play: p };
}

const sideStrength = (p, side) => [p[side], ...(side === 'att' ? p.attB : p.defB)].reduce((s, c) => s + (civOf(c).alive ? coalitionStrength(c) : 0), 0);
export function playOdds(p) { return sideStrength(p, 'att') / Math.max(1, sideStrength(p, 'def')); }

function applyDemand(type, att, def, target) {
  const st = S();
  const A = civOf(att), D = civOf(def);
  if (type === 'conquest') {
    const s = st.settlements[target];
    if (s && !s.dead && s.civ === def) { transferSettlement(s, A); s.conquered = st.day; A.ae = (A.ae || 0) + 6; remember(def, att, 'land_taken', { s: s.id, name: s.name }); return `${s.name} passes to ${A.displayName}`; }
    return 'the claim lapses';
  }
  if (type === 'tribute') { const g = Math.round(Math.max(0, D.treasury) / 3); D.treasury -= g; A.treasury += g; return `${D.displayName} pays ${g} gold`; }
  if (type === 'claim') {
    D.overlord = A.id;
    for (const o of st.civs) if (o.overlord === D.id) o.overlord = A.id;
    const kin = A.family.filter((c) => c.age >= 16).sort((x, y) => y.age - x.age)[1] || A.family.find((c) => c.age >= 16);
    if (kin) A.family = A.family.filter((c) => c !== kin);
    D.ruler = { ...(kin || {}), name: kin?.name || A.ruler.name, gender: kin?.gender || 'm', age: kin?.age ?? 30, traits: kin?.traits || [], stats: kin?.stats || { ...A.ruler.stats }, dynasty: A.ruler.dynasty, since: st.day, regnal: 1, spouse: null, xp: 0, lifestyle: null, id: kin?.id };
    D.family = []; D.claims = (D.claims || []).filter((x) => x !== A.id);
    A.claims = (A.claims || []).filter((x) => x !== D.id);
    for (const c of A.family) if (c.claim === D.id) c.claim = null;
    if (A.ruler.claim === D.id) A.ruler.claim = null;
    return `House ${A.ruler.dynasty} takes the throne of ${D.displayName}, now a vassal of ${A.displayName}`;
  }
  if (type === 'vassal' || type === 'claim') remember(def, att, 'vassalised');
  if (type === 'vassal') { D.overlord = A.id; for (const o of st.civs) if (o.overlord === D.id) o.overlord = A.id; return `${D.displayName} becomes a vassal of ${A.displayName}`; }
  D.stability = Math.max(0, D.stability - 10); A.stability = Math.min(100, A.stability + 5);
  remember(def, att, 'insulted');
  return `${D.displayName} is humiliated`;
}
export function enforceGoal(goal, att, def) { return applyDemand(goal.type, att, def, goal.target); }

export function concede(p) {
  const st = S();
  const result = applyDemand(p.type, p.att, p.def, p.target);
  rel(p.att, p.def).truce = st.day + 360 * 8;
  endPlay(p);
  const me = st.playerId;
  const involved = p.att === me || p.def === me;
  log(`${civOf(p.def).displayName} gives in: ${result}.`, { civ: involved ? me : p.att, type: involved ? (p.att === me ? 'good' : 'bad') : 'world', toast: involved, major: true });
}
export function backDown(p) {
  const st = S();
  const A = civOf(p.att);
  A.stability = Math.max(0, A.stability - 8);
  rel(p.att, p.def).truce = st.day + 360 * 5;
  endPlay(p);
  const me = st.playerId;
  const involved = p.att === me || p.def === me;
  log(`${A.displayName} backs down from its demands on ${civOf(p.def).displayName}.`, { civ: involved ? me : p.att, type: involved ? (p.def === me ? 'good' : 'bad') : 'world', toast: involved, major: true });
}
function endPlay(p) { S().plays = S().plays.filter((x) => x !== p); }

function escalateToWar(p) {
  endPlay(p);
  if (!canDeclareWar(p.att, p.def).ok) return;
  const r = declareWar(p.att, p.def);
  if (!r.ok) return;
  const w = r.war;
  w.goal = { type: p.type, target: p.target };
  for (const c of p.attB) if (civOf(c).alive && !w.att.includes(c) && !w.def.includes(c)) w.att.push(c);
  for (const c of p.defB) if (civOf(c).alive && !w.att.includes(c) && !w.def.includes(c)) w.def.push(c);
}

export function playsMonthly() {
  const st = S();
  for (const p of [...st.plays]) {
    const A = civOf(p.att), D = civOf(p.def);
    if (!A.alive || !D.alive || warBetween(p.att, p.def)) { endPlay(p); continue; }
    p.escalation += ESCALATION_PER_MONTH;
    // Third parties take sides by sympathy
    for (const c of st.civs) {
      if (!c.alive || c.isPlayer || c.rebel || [p.att, p.def, ...p.attB, ...p.defB].includes(c.id)) continue;
      if (!(c.contacts.includes(p.att) || c.contacts.includes(p.def))) continue;
      const lean = opinion(c.id, p.def) - opinion(c.id, p.att);
      if (lean > 40 && !vassalPair(c.id, p.att) && G.rng.chance(0.12)) { p.defB.push(c.id); if (A.isPlayer || D.isPlayer) log(`${c.displayName} backs ${D.displayName} in the crisis.`, { civ: st.playerId, type: 'info' }); }
      else if (lean < -50 && G.rng.chance(0.06)) { p.attB.push(c.id); if (A.isPlayer || D.isPlayer) log(`${c.displayName} backs ${A.displayName} in the crisis.`, { civ: st.playerId, type: 'info' }); }
    }
    const odds = playOdds(p);
    const sev = DEMANDS[p.type].severity;
    if (!D.isPlayer && odds > 1.5 + sev * 0.6 && G.rng.chance(0.3)) { concede(p); continue; }
    if (!A.isPlayer && (odds < 0.75 || A.stability < 22) && G.rng.chance(0.35)) { backDown(p); continue; }
    if (p.escalation >= 100) escalateToWar(p);
  }
}

// AI chooses what to demand
export function aiDemand(att, def) {
  const A = civOf(att);
  const ratio = coalitionStrength(att) / Math.max(1, coalitionStrength(def));
  if (ratio > 3 && G.rng.chance(0.4) && civOf(def).overlord < 0) return 'vassal';
  if (['expansionist', 'militaristic'].includes(A.personality) && conquestTarget(att, def) != null) return 'conquest';
  if (A.personality === 'trader') return 'tribute';
  if (conquestTarget(att, def) != null && G.rng.chance(0.6)) return 'conquest';
  return G.rng.chance(0.5) ? 'tribute' : 'humiliate';
}
