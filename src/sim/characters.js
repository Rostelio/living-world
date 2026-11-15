// Phase 11 — characters & dynasties (inspired by Crusader Kings):
// spouses and marriage alliances, claims and inheritance, partition, lifestyles,
// a court of nobles with opinions, and plots (murder and assassination).
import { G, S, log, civOf } from './state.js';
import { TRAITS, LIFESTYLES, LIFESTYLE_LIST, STAT_NAMES, GOVERNMENTS } from '../data/governments.js';
import { personName, dynastyName } from '../core/names.js';
import { rollStats, rollTraits, rulerFullName, statTotal, heirOf, succeed, realmName } from './government.js';
import { invalidateMods } from './mods.js';
import { rel, opinion, atWar } from './diplomacy.js';
import { createCiv } from './setup.js';
import { transferSettlement, setCapital } from './settlements.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TITLES = ['Count', 'Baron', 'Marshal', 'Lord', 'Steward', 'Chancellor', 'Warden'];
const TITLES_F = ['Countess', 'Baroness', 'Marshal', 'Lady', 'Steward', 'Chancellor', 'Warden'];

// ---------------- Ids & migration ----------------
export function newId() { const st = S(); st.nextCharId = (st.nextCharId || 1) + 1; return st.nextCharId; }
function fixStats(p) { if (p?.stats && p.stats.int == null) p.stats.int = Math.round((p.stats.dip + p.stats.lrn) / 2); }
export function ensureCharacters(civ) {
  const r = civ.ruler;
  if (r) { r.id ??= newId(); fixStats(r); r.lifestyle ??= null; r.xp ??= 0; r.spouse ??= null; if (r.spouse) { r.spouse.id ??= newId(); fixStats(r.spouse); } }
  civ.family ??= [];
  for (const c of civ.family) { c.id ??= newId(); fixStats(c); }
  civ.court ??= [];
  for (const c of civ.court) { c.id ??= newId(); fixStats(c); }
  civ.claims ??= [];
}
export function ensurePhase11(st) {
  st.plots ??= [];
  st.nextCharId ??= 1;
  st.nextPlotId ??= 1;
  for (const c of st.civs) ensureCharacters(c);
  st.version = Math.max(st.version || 0, 11);
}

// ---------------- People ----------------
export function makeNoble(civ, opts = {}) {
  const rng = G.rng;
  const gender = opts.gender || (rng.chance(0.5) ? 'm' : 'f');
  const traits = rollTraits(rng);
  const p = {
    id: newId(), name: personName(opts.race || civ.race, gender, rng), gender,
    dynasty: opts.dynasty || dynastyName(opts.race || civ.race, rng), age: opts.age ?? rng.int(18, 55),
    traits, stats: rollStats(rng, traits), race: opts.race || civ.race,
  };
  if (opts.court) {
    const i = rng.int(0, TITLES.length - 1);
    p.title = gender === 'f' ? TITLES_F[i] : TITLES[i];
    p.opinion = rng.int(-10, 30);
    p.ambition = rng.float(0, 1);
    p.favor = 0;
  }
  return p;
}
export const courtSize = (civ) => (civ.gov === 'tribal' ? 2 : 3) + Math.min(4, Math.floor(civ.settlements.length / 4));

// Opinion a courtier is drifting toward (with reasons)
export function courtierOpinion(civ, c) {
  const r = civ.ruler;
  const items = [];
  const has = (t) => r.traits.includes(t);
  if (has('just')) items.push(['Just ruler', 10]);
  if (has('cruel')) items.push(['Cruel ruler', -15]);
  if (has('charismatic')) items.push(['Charismatic', 10]);
  if (has('honest')) items.push(['Honest', 5]);
  if (has('paranoid')) items.push(['Paranoid', -5]);
  if (c.traits.includes('schemer') || c.ambition > 0.75) items.push(['Ambitious', -12]);
  if (c.traits.includes('honest')) items.push(['Loyal nature', 8]);
  items.push(['Stability', Math.round((civ.stability - 50) / 3)]);
  if (c.dynasty === r.dynasty) items.push(['Same house', 15]);
  if (c.favor > 0.5) items.push(['Gifts and favours', Math.round(c.favor)]);
  if (r.stats && r.stats.dip >= 7) items.push(['Diplomatic ruler', 5]);
  let t = 0; for (const [, v] of items) t += v;
  return { target: clamp(t, -100, 100), items };
}

// ---------------- Marriage ----------------
export const eligible = (p) => p && p.age >= 16 && p.age <= 60 && !p.spouse;
// Who of house B would marry into A: an adult child, or a kinsman of the house
function brideOf(B) {
  const adult = (B.family || []).filter((c) => c.age >= 16 && !c.betrothed).sort((a, b) => b.age - a.age)[0];
  if (adult) return { p: adult, child: true };
  const rng = G.rng;
  const k = makeNoble(B, { dynasty: B.ruler.dynasty, age: rng.int(17, 30) });
  return { p: k, child: false };
}
export function canMarry(a, b) {
  const A = civOf(a), B = civOf(b);
  if (!A?.alive || !B?.alive || a === b) return { ok: false, reason: 'Invalid realm' };
  if (!eligible(A.ruler)) return { ok: false, reason: A.ruler.spouse ? 'Your ruler is already married' : 'Your ruler is too young or too old' };
  if (atWar(a, b)) return { ok: false, reason: 'At war' };
  if (GOVERNMENTS[B.gov].succession !== 'heir') return { ok: false, reason: 'Their rulers are not of a royal house' };
  return { ok: true };
}
// Will B agree? (score > 0 means yes)
export function marriageScore(a, b) {
  const A = civOf(a), B = civOf(b);
  let s = opinion(b, a) + 10;
  s += (statTotal(A.ruler) - 25) * 1.5;
  if (A.race !== B.race) s -= 25;
  if (A.settlements.length > B.settlements.length) s += 10;
  return s;
}
export function marry(a, b, quiet = false) {
  const A = civOf(a), B = civOf(b);
  const { p, child } = brideOf(B);
  if (child) B.family = B.family.filter((c) => c !== p);
  p.from = b; p.race ??= B.race;
  A.ruler.spouse = p;
  const r = rel(a, b);
  r.marriage = true;
  r.op = Math.min(100, r.op + 15);
  if (!quiet) log(`💍 ${rulerFullName(A)} marries ${p.name} of House ${p.dynasty}: ${A.displayName} and ${B.displayName} are bound by marriage.`, { civ: A.isPlayer || B.isPlayer ? S().playerId : a, type: A.isPlayer || B.isPlayer ? 'good' : 'world', toast: A.isPlayer || B.isPlayer, major: true });
  return p;
}
export function proposeMarriage(a, b) {
  const chk = canMarry(a, b);
  if (!chk.ok) return chk;
  if (marriageScore(a, b) <= 0) return { ok: false, reason: `${civOf(b).displayName} refuses the match (they need a better opinion of you)` };
  marry(a, b);
  return { ok: true };
}
// A local noble match (no alliance)
function marryNoble(civ) {
  const p = makeNoble(civ, { age: clamp(civ.ruler.age + G.rng.int(-8, 4), 17, 55), gender: civ.ruler.gender === 'm' ? 'f' : 'm' });
  p.from = -1;
  civ.ruler.spouse = p;
  if (civ.isPlayer) log(`💍 ${rulerFullName(civ)} marries ${p.name} of House ${p.dynasty}, a noble of the realm.`, { civ: civ.id, type: 'good' });
}

export function noteMarriage(civ, from, p) {
  log(`💍 ${rulerFullName(civ)} weds ${p.name} of House ${p.dynasty}: ${civ.displayName} and ${civOf(from).displayName} are bound by marriage.`, { civ: civ.id, type: 'good', toast: true, major: true });
}
export function declined(a, b) { const r = rel(a, b); r.op = Math.max(-100, r.op - 10); }

// ---------------- Claims ----------------
// A realm holds a claim on another through its ruler's or children's blood.
export function claimsOf(civ) {
  const out = new Set(civ.claims || []);
  if (civ.ruler?.claim >= 0) out.add(civ.ruler.claim);
  for (const c of civ.family || []) if (c.claim >= 0) out.add(c.claim);
  out.delete(civ.id);
  return [...out].filter((id) => civOf(id)?.alive);
}
export const hasClaim = (a, b) => claimsOf(civOf(a)).includes(b);

// When an heirless house dies out, a claimant may inherit the realm (personal union → vassal).
export function inheritByClaim(civ) {
  const st = S();
  const claimants = st.civs.filter((c) => c.alive && c.id !== civ.id && claimsOf(c).includes(civ.id) && !atWar(c.id, civ.id));
  if (!claimants.length) return null;
  claimants.sort((x, y) => y.settlements.length - x.settlements.length);
  const heirRealm = claimants[0];
  civ.overlord = heirRealm.id;
  for (const o of st.civs) if (o.overlord === civ.id) o.overlord = heirRealm.id;
  civ.claims = (civ.claims || []).filter((x) => x !== heirRealm.id);
  return heirRealm;
}

// ---------------- Lifestyle ----------------
export function setLifestyle(civ, ls) {
  if (!LIFESTYLES[ls]) return;
  if (civ.ruler.lifestyle !== ls) civ.ruler.xp = Math.floor((civ.ruler.xp || 0) / 2);
  civ.ruler.lifestyle = ls;
}
function lifestyleYear(civ) {
  const r = civ.ruler;
  if (!r.lifestyle) return;
  const L = LIFESTYLES[r.lifestyle];
  r.xp = (r.xp || 0) + 18 + (r.stats?.[L.stat] || 5) * 2;
  if (r.xp < 100) return;
  r.xp -= 100;
  r.stats[L.stat] = Math.min(10, (r.stats[L.stat] || 5) + 1);
  const perk = L.perks.find((t) => !r.traits.includes(t));
  if (perk) {
    r.traits = r.traits.filter((t) => !['lazy', 'cruel', 'sickly'].includes(t) || !((perk === 'diligent' && t === 'lazy') || (perk === 'just' && t === 'cruel') || (perk === 'strong' && t === 'sickly')));
    r.traits.push(perk);
    invalidateMods(civ);
    if (civ.isPlayer) log(`${rulerFullName(civ)} masters ${L.name}: gains the trait ${TRAITS[perk].name} and +1 ${STAT_NAMES[L.stat]}.`, { civ: civ.id, type: 'good', toast: true });
  } else if (civ.isPlayer) log(`${rulerFullName(civ)} grows in ${L.name}: +1 ${STAT_NAMES[L.stat]}.`, { civ: civ.id, type: 'good' });
}

// ---------------- Plots ----------------
// type: 'murder' (courtier vs own ruler) | 'assassinate' (realm vs a foreign ruler or heir)
export function plotPower(owner) { return 1.5 + (owner?.stats?.int ?? 5) * 0.9 + (owner?.traits?.includes('schemer') ? 3 : 0); }
function targetPerson(p) {
  const T = civOf(p.target);
  if (!T?.alive) return null;
  return p.who === 'heir' ? heirOf(T) : T.ruler;
}
export function successChance(p) {
  const st = S();
  const owner = p.type === 'murder' ? civOf(p.target).court.find((c) => c.id === p.plotter) : civOf(p.owner)?.ruler;
  const T = civOf(p.target);
  const tp = targetPerson(p);
  if (!owner || !tp) return 0;
  let c = 0.3 + ((owner.stats?.int ?? 5) - (T.ruler.stats?.int ?? 5)) * 0.05;
  if (owner.traits?.includes('schemer')) c += 0.12;
  if (T.ruler.traits.includes('paranoid')) c -= 0.15;
  if (p.who === 'heir') c += 0.1;
  void st;
  return clamp(c, 0.05, 0.8);
}
export function assassinationCost(civ) { return Math.round(60 + 30 * (civ.era || 0)); }
export function canAssassinate(a, b, who) {
  const A = civOf(a), B = civOf(b);
  if (!B?.alive || a === b) return { ok: false, reason: 'Invalid target' };
  if (S().plots.some((p) => p.owner === a && p.target === b)) return { ok: false, reason: 'A plot is already under way' };
  if (who === 'heir' && !heirOf(B)) return { ok: false, reason: 'They have no heir' };
  const cost = assassinationCost(A);
  if (A.treasury < cost) return { ok: false, reason: `Needs ${cost} gold for agents` };
  return { ok: true, cost };
}
export function startAssassination(a, b, who = 'ruler') {
  const chk = canAssassinate(a, b, who);
  if (!chk.ok) return chk;
  const A = civOf(a);
  A.treasury -= chk.cost;
  const st = S();
  st.plots.push({ id: st.nextPlotId++, type: 'assassinate', owner: a, target: b, who, progress: 0, start: st.day, discovered: false });
  if (A.isPlayer) log(`Our agents begin a plot against the ${who === 'heir' ? 'heir' : 'ruler'} of ${civOf(b).displayName}.`, { civ: a, type: 'info' });
  return { ok: true };
}
export function cancelPlot(id) { const st = S(); st.plots = st.plots.filter((p) => p.id !== id); }

function plotsMonthly() {
  const st = S();
  for (const p of [...st.plots]) {
    const T = civOf(p.target);
    const tp = targetPerson(p);
    const owner = p.type === 'murder' ? T?.court.find((c) => c.id === p.plotter) : civOf(p.owner)?.alive ? civOf(p.owner).ruler : null;
    if (!T?.alive || !tp || !owner) { cancelPlot(p.id); continue; }
    p.progress += plotPower(owner) * 1.2;
    // the target's spymasters may uncover it
    if (!p.discovered) {
      const d = 0.015 + (T.ruler.stats?.int ?? 5) * 0.006 + (T.ruler.traits.includes('paranoid') ? 0.05 : 0) - (owner.traits?.includes('schemer') ? 0.01 : 0);
      if (G.rng.chance(d)) {
        p.discovered = true;
        if (p.type === 'assassinate') {
          const r = rel(p.owner, p.target); r.grudge += 45; r.op = Math.max(-100, r.op - 30);
          log(`🗡 A plot by ${civOf(p.owner).displayName} against ${rulerFullName(T)} is uncovered!`, { civ: T.isPlayer || civOf(p.owner).isPlayer ? st.playerId : p.target, type: T.isPlayer || civOf(p.owner).isPlayer ? 'bad' : 'world', toast: T.isPlayer || civOf(p.owner).isPlayer, major: true });
          cancelPlot(p.id);
          continue;
        } else if (T.isPlayer) log(`🗡 Our spies uncover a plot: ${owner.title} ${owner.name} conspires against ${rulerFullName(T)}! (Court panel)`, { civ: T.id, type: 'bad', toast: true });
        else { exposePlot(p.id); continue; }
      }
    }
    if (p.progress >= 100) resolvePlot(p, owner, tp);
  }
}
function resolvePlot(p, owner, tp) {
  const st = S();
  cancelPlot(p.id);
  const T = civOf(p.target);
  const ok = G.rng.chance(successChance({ ...p }) || 0.1);
  const involved = T.isPlayer || (p.owner != null && civOf(p.owner)?.isPlayer);
  if (!ok) {
    if (p.type === 'murder') { T.court = T.court.filter((c) => c !== owner); log(`An attempt on the life of ${rulerFullName(T)} fails; ${owner.name} is seized and executed.`, { civ: T.id, type: T.isPlayer ? 'good' : 'world', toast: T.isPlayer }); }
    else { const r = rel(p.owner, p.target); r.grudge += 30; log(`🗡 Assassins sent by ${civOf(p.owner).displayName} fail to kill ${tp.name} of ${T.displayName}.`, { civ: involved ? st.playerId : p.target, type: involved ? 'bad' : 'world', toast: involved }); }
    return;
  }
  if (p.who === 'heir') {
    T.family = T.family.filter((c) => c !== tp);
    log(`🗡 ${tp.name}, heir of ${T.displayName}, is found dead — poison is whispered.`, { civ: involved ? st.playerId : p.target, type: involved ? (T.isPlayer ? 'bad' : 'good') : 'world', toast: involved, major: true });
    return;
  }
  log(`🗡 ${rulerFullName(T)} is murdered${p.type === 'murder' ? ` by ${owner.title} ${owner.name}` : ''}!`, { civ: involved ? st.playerId : p.target, type: involved ? (T.isPlayer ? 'bad' : 'good') : 'world', toast: true, major: true });
  if (p.type === 'murder') T.court = T.court.filter((c) => c !== owner);
  succeed(T, 'murder');
}
export function exposePlot(id) {
  const st = S();
  const p = st.plots.find((x) => x.id === id);
  if (!p) return;
  const T = civOf(p.target);
  if (p.type === 'murder') {
    const c = T.court.find((x) => x.id === p.plotter);
    T.court = T.court.filter((x) => x !== c);
    for (const o of T.court) o.opinion = clamp(o.opinion - 4, -100, 100);
    if (T.isPlayer && c) log(`${c.title} ${c.name} is arrested for treason and executed.`, { civ: T.id, type: 'info' });
  }
  cancelPlot(id);
}

// ---------------- Partition ----------------
// Younger adult children receive part of the realm as new, allied realms of the same house.
export function partitionRealm(civ, kids) {
  const st = S();
  const setts = civ.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital).sort((a, b) => b.pop - a.pop);
  if (setts.length < 3 || !kids.length) return [];
  const created = [];
  const share = Math.floor(setts.length / (kids.length + 2));
  if (share < 1) return [];
  for (const kid of kids.slice(0, 2)) {
    // a compact share: settlements nearest to the first one picked
    const pool = setts.filter((s) => s.civ === civ.id);
    if (pool.length < share + 1) break;
    const seed = pool[pool.length - 1];
    const W = G.world;
    const d = (s) => Math.hypot((s.tile % W.w) - (seed.tile % W.w), ((s.tile / W.w) | 0) - ((seed.tile / W.w) | 0));
    const part = [...pool].sort((a, b) => d(a) - d(b)).slice(0, share);
    const id = st.civs.length;
    const n = createCiv(id, civ.race, { color: shiftColor(civ.color, created.length + 1) });
    n.techs = [...civ.techs]; n.era = civ.era; n.gov = civ.gov === 'empire' ? 'monarchy' : civ.gov;
    n.law = civ.law; n.faith = civ.faith; n.tolerance = civ.tolerance; n.laws = { ...(civ.laws || {}) };
    n.personality = civ.personality;
    n.ruler = { ...kid, since: st.day, dynasty: civ.ruler.dynasty, regnal: 1, xp: 0, lifestyle: null, spouse: null };
    n.family = []; n.court = []; n.claims = []; n.cabinet = []; n.candidates = [];
    n.dynasties = [{ name: civ.ruler.dynasty, from: st.day, to: null }];
    n.displayName = realmName(n);
    n.treasury = Math.max(20, civ.treasury * 0.2); civ.treasury -= n.treasury * 0.8;
    st.civs.push(n);
    for (const s of part) transferSettlement(s, n);
    if (!n.capital || n.capital < 0 || !st.settlements[n.capital] || st.settlements[n.capital].civ !== n.id) setCapital(n, part[0]);
    n.contacts = [civ.id]; if (!civ.contacts.includes(n.id)) civ.contacts.push(n.id);
    const r = rel(civ.id, n.id); r.ally = true; r.op = 60;
    created.push(n);
  }
  if (created.length) {
    G.ensureNewCivs?.();
    log(`👑 By partition, ${civ.displayName} is divided: ${created.map((c) => c.displayName).join(' and ')} pass to the younger children of House ${civ.ruler.dynasty}.`, { civ: civ.id, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, major: true });
    G.dirty.owners = true;
  }
  return created;
}
function shiftColor(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = 1 - 0.18 * k;
  r = Math.round(r * f + 30 * k); g = Math.round(g * f + 20 * k); b = Math.round(b * f + 40 * k);
  const c = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// ---------------- Yearly & monthly ----------------
export function charactersYearly(civ) {
  ensureCharacters(civ);
  const rng = G.rng;
  const r = civ.ruler;
  const heirGov = GOVERNMENTS[civ.gov].succession === 'heir';
  // spouse ages and may die
  if (r.spouse) {
    r.spouse.age++;
    if (rng.chance(r.spouse.age < 50 ? 0.01 : 0.05 + (r.spouse.age - 50) * 0.01)) {
      if (civ.isPlayer) log(`${r.spouse.name}, consort of ${rulerFullName(civ)}, has died.`, { civ: civ.id, type: 'bad' });
      r.spouse = null;
    }
  }
  // sickly / strong rulers
  if (r.traits.includes('sickly') && rng.chance(0.03)) { succeed(civ, 'death'); return; }
  lifestyleYear(civ);
  // court: age, deaths, newcomers, opinions
  for (const c of civ.court) c.age++;
  civ.court = civ.court.filter((c) => !(c.age > 55 && rng.chance(0.06 + (c.age - 55) * 0.01)));
  while (civ.court.length < courtSize(civ)) civ.court.push(makeNoble(civ, { court: true }));
  if (civ.court.length > courtSize(civ) + 1) civ.court.length = courtSize(civ) + 1;
  for (const c of civ.court) {
    c.favor = Math.max(0, (c.favor || 0) * 0.7);
    // disloyal, ambitious courtiers conspire
    if (c.opinion < -30 && (c.ambition > 0.55 || c.traits.includes('schemer')) && !S().plots.some((p) => p.plotter === c.id) && rng.chance(0.25)) {
      const st = S();
      st.plots.push({ id: st.nextPlotId++, type: 'murder', owner: null, plotter: c.id, target: civ.id, who: 'ruler', progress: 0, start: st.day, discovered: false });
    }
  }
  // children carry claims on the realm their other parent came from
  void heirGov;
  for (const c of civ.family) {
    c.id ??= newId();
    if (c.age === 0 && r.spouse?.from >= 0 && c.claim == null) c.claim = r.spouse.from;
  }
  // AI: marriage, lifestyle, court gifts, assassinations
  if (!civ.isPlayer || civ.autoBuild) aiCharacters(civ);
}

function aiCharacters(civ) {
  const rng = G.rng;
  const st = S();
  const r = civ.ruler;
  if (!r.lifestyle) {
    const pers = civ.personality;
    r.lifestyle = pers === 'militaristic' || pers === 'expansionist' ? 'martial' : pers === 'trader' ? 'stewardship' : pers === 'diplomatic' ? 'diplomacy' : rng.chance(0.25) ? 'intrigue' : 'learning';
  }
  if (eligible(r) && GOVERNMENTS[civ.gov].succession === 'heir' && rng.chance(0.5)) {
    // look for the best match among neighbours; otherwise marry a local noble
    const cands = st.civs.filter((o) => o.alive && o.id !== civ.id && canMarry(civ.id, o.id).ok && civ.contacts.includes(o.id));
    cands.sort((a, b) => marriageScore(civ.id, b.id) - marriageScore(civ.id, a.id));
    const best = cands[0];
    if (best && marriageScore(civ.id, best.id) > 0 && (opinion(civ.id, best.id) > -10)) {
      if (best.isPlayer && !best.autoBuild) {
        if (!st.pendingEvents.some((p) => p.ev === 'marriage_offer')) st.pendingEvents.push({ id: st.nextEventId++, ev: 'marriage_offer', civ: best.id, ctx: { from: civ.id }, day: st.day });
      } else marry(civ.id, best.id);
    } else if (rng.chance(0.6)) marryNoble(civ);
  }
  // keep the court sweet
  const angry = civ.court.find((c) => c.opinion < -20);
  if (angry && civ.treasury > 150 && rng.chance(0.5)) giftCourtier(civ, angry.id);
  // expose known plots
  for (const p of st.plots) if (p.target === civ.id && p.discovered) exposePlot(p.id);
  // rarely, assassinate a hated rival
  if (civ.rival != null && civ.treasury > 400 && rng.chance(0.03 + (r.traits.includes('schemer') ? 0.05 : 0))) startAssassination(civ.id, civ.rival, rng.chance(0.4) ? 'heir' : 'ruler');
}

export function giftCourtier(civ, id) {
  const c = civ.court.find((x) => x.id === id);
  if (!c) return { ok: false, reason: 'Gone' };
  const cost = 30 + 10 * (civ.era || 0);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  civ.treasury -= cost;
  c.favor = (c.favor || 0) + 25;
  c.opinion = clamp(c.opinion + 15, -100, 100);
  return { ok: true };
}
export function banishCourtier(civ, id) {
  const c = civ.court.find((x) => x.id === id);
  if (!c) return;
  civ.court = civ.court.filter((x) => x !== c);
  S().plots = S().plots.filter((p) => p.plotter !== id);
  for (const o of civ.court) o.opinion = clamp(o.opinion - 6, -100, 100);
  civ.stability = Math.max(0, civ.stability - 2);
}

export function charactersMonthly() {
  const st = S();
  for (const civ of st.civs) {
    if (!civ.alive) continue;
    ensureCharacters(civ);
    for (const c of civ.court) {
      const { target } = courtierOpinion(civ, c);
      c.opinion = clamp(c.opinion + (target - c.opinion) * 0.1, -100, 100);
    }
  }
  plotsMonthly();
}

// Courtiers' mood feeds stability
export function courtStability(civ) {
  if (!civ.court?.length) return 0;
  let s = 0; for (const c of civ.court) s += c.opinion;
  return Math.round(clamp(s / civ.court.length / 12, -6, 5));
}

// ---------------- Dynasty ----------------
export function dynastyRealms(name) { return S().civs.filter((c) => c.alive && c.ruler?.dynasty === name); }
void LIFESTYLE_LIST; void dynastyName;
