// Cabinet & advisors (Phase 8, after Europa Universalis V).
// Realms appoint advisors to a few cabinet seats; each carries out one ongoing
// action whose strength depends on their skill (and +1 in their speciality).
import { G, S, log, civOf } from './state.js';
import { personName } from '../core/names.js';

export const ACTIONS = {
  economy: { name: 'Oversee the Treasury', desc: '+3% production and +1.5% taxes per skill.' },
  research: { name: 'Patronise Scholars', desc: '+4% knowledge per skill.' },
  stability: { name: 'Keep the Peace', desc: '+0.8 stability per skill.' },
  trade: { name: 'Expand Commerce', desc: '+10% trade between markets per skill.' },
  military: { name: 'Drill the Armies', desc: '+4 defense per skill.' },
  diplomacy: { name: 'Improve Relations', target: 'civ', desc: '+1.5 opinion per month per skill with the chosen realm.' },
  convert: { name: 'Convert the Faithful', target: 'settlement', desc: 'Converts a settlement to the state faith: +3 progress per month per skill.' },
  integrate: { name: 'Integrate Culture', target: 'settlement', desc: 'Assimilates a settlement to the ruling culture: +2 per month per skill; calms unrest.' },
};
export const ACTION_LIST = Object.keys(ACTIONS);

export function seats(civ) {
  return 2 + (['monarchy', 'empire'].includes(civ.gov) ? 1 : 0) + (civ.era >= 2 ? 1 : 0);
}
export function ensureCabinet(st) {
  st.nextAdvisorId ??= 1;
  for (const c of st.civs) { c.cabinet ??= []; c.candidates ??= []; }
}
function makeAdvisor(civ) {
  const rng = G.rng;
  const gender = rng.chance(0.5) ? 'm' : 'f';
  return { id: S().nextAdvisorId++, name: personName(civ.race, gender, rng), gender, skill: rng.int(1, 3) + (rng.chance(0.3) ? 1 : 0) + (rng.chance(0.08) ? 1 : 0), spec: rng.pick(ACTION_LIST), action: null, target: null };
}
export function refreshCandidates(civ) {
  while (civ.candidates.length < 3) civ.candidates.push(makeAdvisor(civ));
}
export const hireCost = (a) => 40 + a.skill * 35;
export const salary = (a) => a.skill * 0.5;
export const skillFor = (a, action) => a.skill + (a.spec === action ? 1 : 0);

export function hire(civ, candId, action, target = null) {
  const a = civ.candidates.find((x) => x.id === candId);
  if (!a) return { ok: false, reason: 'No such candidate' };
  if (civ.cabinet.length >= seats(civ)) return { ok: false, reason: 'All cabinet seats are filled' };
  const cost = hireCost(a);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  civ.treasury -= cost;
  civ.candidates = civ.candidates.filter((x) => x !== a);
  a.action = action || a.spec;
  a.target = target;
  if (ACTIONS[a.action].target && a.target == null) a.target = defaultTarget(civ, a.action);
  civ.cabinet.push(a);
  refreshCandidates(civ);
  return { ok: true };
}
export function dismiss(civ, id) { civ.cabinet = civ.cabinet.filter((a) => a.id !== id); }
export function assign(civ, id, action, target = null) {
  const a = civ.cabinet.find((x) => x.id === id);
  if (!a) return;
  a.action = action;
  a.target = target ?? (ACTIONS[action].target ? defaultTarget(civ, action) : null);
}

// Sensible target when none is chosen.
export function defaultTarget(civ, action) {
  const st = S();
  const setts = civ.settlements.map((id) => st.settlements[id]);
  if (action === 'convert') return setts.filter((s) => s.faith !== civ.faith).sort((a, b) => b.pop - a.pop)[0]?.id ?? null;
  if (action === 'integrate') return setts.filter((s) => s.culture !== civ.race).sort((a, b) => b.pop - a.pop)[0]?.id ?? null;
  if (action === 'diplomacy') return civ.contacts.find((c) => civOf(c).alive) ?? null;
  return null;
}

// ---- Effects used by other systems ----
function sum(civ, action) {
  let s = 0;
  for (const a of civ.cabinet || []) if (a.action === action) s += skillFor(a, action);
  return s;
}
export const cabinetMul = (civ, action, per) => 1 + per * sum(civ, action);
export const cabinetAdd = (civ, action, per) => per * sum(civ, action);
export const cabinetSalaries = (civ) => (civ.cabinet || []).reduce((t, a) => t + salary(a), 0);

export function cabinetMonthly(civ, hooks) {
  const st = S();
  for (const a of civ.cabinet) {
    const k = skillFor(a, a.action);
    if (a.action === 'diplomacy') {
      const o = a.target != null ? civOf(a.target) : null;
      if (!o || !o.alive) { a.target = defaultTarget(civ, 'diplomacy'); continue; }
      const r = hooks.rel(civ.id, o.id);
      r.gift = Math.min(60, r.gift + 1.5 * k);
    } else if (a.action === 'convert' || a.action === 'integrate') {
      const s = st.settlements[a.target];
      const done = !s || s.dead || s.civ !== civ.id || (a.action === 'convert' ? s.faith === civ.faith : s.culture === civ.race);
      if (done) { a.target = defaultTarget(civ, a.action); if (a.target == null && civ.isPlayer) { a.action = a.spec === a.action ? 'stability' : a.spec; } continue; }
      if (a.action === 'convert') s.convert += 3 * k;
      else { s.assim += 2 * k; s.unrest = Math.max(0, (s.unrest || 0) - 0.5 * k); }
    }
  }
}

export function cabinetYearly(civ) {
  // Advisors occasionally retire; the pool of candidates changes.
  for (const a of [...civ.cabinet]) {
    if (G.rng.chance(0.04)) {
      civ.cabinet = civ.cabinet.filter((x) => x !== a);
      if (civ.isPlayer) log(`${a.name} retires from the cabinet.`, { civ: civ.id, type: 'info' });
    }
  }
  if (G.rng.chance(0.5) && civ.candidates.length) civ.candidates.shift();
  refreshCandidates(civ);
  if (!civ.isPlayer) aiCabinet(civ);
}

// AI fills seats with what the realm needs most.
function aiCabinet(civ) {
  const st = S();
  const setts = civ.settlements.map((id) => st.settlements[id]);
  const wantAction = () => {
    if (setts.some((s) => s.faith !== civ.faith && s.pop > 50) && !civ.cabinet.some((a) => a.action === 'convert')) return 'convert';
    if (setts.some((s) => s.culture !== civ.race && (s.unrest || 0) > 30) && !civ.cabinet.some((a) => a.action === 'integrate')) return 'integrate';
    if (civ.stability < 45 && !civ.cabinet.some((a) => a.action === 'stability')) return 'stability';
    const pref = { trader: 'trade', diplomatic: 'diplomacy', militaristic: 'military', defensive: 'military', isolationist: 'research', expansionist: 'economy' }[civ.personality] || 'economy';
    if (!civ.cabinet.some((a) => a.action === pref)) return pref;
    return G.rng.pick(['economy', 'research', 'stability', 'trade']);
  };
  while (civ.cabinet.length < seats(civ) && civ.candidates.length) {
    const best = [...civ.candidates].sort((a, b) => b.skill - a.skill)[0];
    if (civ.treasury < hireCost(best) * 2) break;
    const action = wantAction();
    if (hire(civ, best.id, action).ok === false) break;
  }
  // Re-task idle advisors
  for (const a of civ.cabinet) if (ACTIONS[a.action]?.target && a.target == null) a.action = 'economy';
}
