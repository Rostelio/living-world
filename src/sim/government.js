import { newId, inheritByClaim, partitionRealm } from './characters.js';
import { G, S, log } from './state.js';
import { GOVERNMENTS, TRAITS, TRAIT_LIST, PERSONALITIES, TRAIT_OPPOSITES } from '../data/governments.js';
import { personName, dynastyName } from '../core/names.js';
import { invalidateMods } from './mods.js';

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X', ' XI', ' XII', ' XIII', ' XIV', ' XV'];

export function realmName(civ) {
  if (civ.rebel) {
    const r = civ.rebel;
    if (r.type === 'separatist') return `Free ${civ.baseName}`;
    if (r.type === 'revolution') return `${civ.baseName} Revolutionaries`;
    if (r.type === 'claimant') return `${civ.ruler?.name ?? 'Pretender'}'s Faction`;
  }
  return GOVERNMENTS[civ.gov].realm(civ.baseName);
}
export function rulerTitle(civ, ruler = civ.ruler) {
  if (civ.rebel?.type === 'claimant') return ruler?.gender === 'f' ? 'Pretender Queen' : 'Pretender King';
  if (civ.rebel?.type === 'revolution') return 'Revolutionary Leader';
  return GOVERNMENTS[civ.gov].title[ruler?.gender === 'f' ? 1 : 0];
}
export function rulerFullName(civ, ruler = civ.ruler) {
  if (!ruler) return '—';
  return `${rulerTitle(civ, ruler)} ${ruler.name}${ROMAN[ruler.regnal] || ''}`;
}
export const defaultLaw = (gov) => (gov === 'tribal' ? 'elective' : 'primogeniture');

// ---------------- Characters ----------------
export function rollStats(rng, traits = []) {
  const r = () => Math.max(0, Math.min(10, Math.round(rng.float(2, 8) + rng.float(-1.5, 1.5))));
  const s = { dip: r(), mar: r(), stw: r(), lrn: r(), int: r() };
  if (traits.includes('genius')) for (const k in s) s[k] = Math.min(10, s[k] + 2);
  if (traits.includes('schemer')) s.int = Math.min(10, s.int + 3);
  if (traits.includes('honest')) s.int = Math.max(0, s.int - 2);
  if (traits.includes('wise')) s.lrn = Math.min(10, s.lrn + 3);
  if (traits.includes('brave')) s.mar = Math.min(10, s.mar + 3);
  if (traits.includes('charismatic')) s.dip = Math.min(10, s.dip + 3);
  if (traits.includes('diligent') || traits.includes('builder')) s.stw = Math.min(10, s.stw + 2);
  if (traits.includes('lazy')) s.stw = Math.max(0, s.stw - 3);
  return s;
}

export function rollTraits(rng, n = null) {
  n = n ?? (rng.chance(0.3) ? 1 : rng.chance(0.75) ? 2 : 3);
  const pool = TRAIT_LIST.filter((t) => !TRAITS[t].rare || rng.chance(0.08));
  rng.shuffle(pool);
  const picked = [];
  for (const t of pool) {
    if (picked.length >= n) break;
    if (TRAIT_OPPOSITES.some(([a, b]) => (t === a && picked.includes(b)) || (t === b && picked.includes(a)))) continue;
    picked.push(t);
  }
  return picked;
}

export function makeRuler(civ, opts = {}) {
  const rng = G.rng;
  const gender = opts.gender || (rng.chance(0.5) ? 'm' : 'f');
  const name = opts.name || personName(civ.race, gender, rng);
  civ.nameCounts = civ.nameCounts || {};
  civ.nameCounts[name] = (civ.nameCounts[name] || 0) + 1;
  const traits = opts.traits || rollTraits(rng);
  return {
    name, gender,
    dynasty: opts.dynasty || dynastyName(civ.race, rng),
    age: opts.age ?? rng.int(20, 42),
    traits,
    stats: opts.stats || rollStats(rng, traits),
    since: S().day,
    regnal: civ.nameCounts[name],
  };
}

export function makeChild(civ, age = 0) {
  const rng = G.rng;
  const gender = rng.chance(0.5) ? 'm' : 'f';
  const name = personName(civ.race, gender, rng);
  return { name, gender, age, traits: [], stats: null };
}

// Coming of age at 16: education gives traits and attributes.
export function educate(civ, child, focus = null) {
  const rng = G.rng;
  child.traits = rollTraits(rng, 1);
  const extra = { martial: 'brave', scholar: 'wise', diplomat: 'charismatic', steward: 'diligent' }[focus];
  if (extra && !child.traits.includes(extra)) child.traits.push(extra);
  child.stats = rollStats(rng, child.traits);
  if (focus === 'martial') child.stats.mar = Math.min(10, child.stats.mar + 2);
  if (focus === 'scholar') child.stats.lrn = Math.min(10, child.stats.lrn + 2);
  if (focus === 'diplomat') child.stats.dip = Math.min(10, child.stats.dip + 2);
  if (focus === 'steward') child.stats.stw = Math.min(10, child.stats.stw + 2);
}
export function educateHeir(civ, focus) {
  const h = heirOf(civ);
  if (!h) return;
  h.edu = focus;
}

export const statTotal = (p) => (p.stats ? p.stats.dip + p.stats.mar + p.stats.stw + p.stats.lrn + (p.stats.int || 0) : 0);

export function heirOf(civ) {
  const gov = GOVERNMENTS[civ.gov];
  if (gov.succession !== 'heir' || !civ.family?.length) return null;
  const fam = [...civ.family].sort((a, b) => b.age - a.age);
  if ((civ.law || defaultLaw(civ.gov)) === 'elective') {
    const adults = fam.filter((c) => c.age >= 16);
    if (adults.length) return adults.sort((a, b) => statTotal(b) - statTotal(a))[0];
  }
  return fam[0];
}

export function setLaw(civ, law) {
  if (civ.law === law) return { ok: false };
  if (civ.treasury < 60) return { ok: false, reason: 'Needs 60 gold' };
  civ.treasury -= 60;
  civ.law = law;
  civ.stability -= 5;
  invalidateMods(civ);
  return { ok: true };
}

// ---------------- Yearly ----------------
export function yearlyGovernment(civ) {
  const rng = G.rng;
  const r = civ.ruler;
  r.age++;
  civ.family ??= [];
  for (const c of civ.family) {
    c.age++;
    if (c.age === 16 && !c.stats) educate(civ, c, c.edu);
    if (c.age > 3 && rng.chance(0.004)) { // childhood death
      civ.family = civ.family.filter((x) => x !== c);
      if (civ.isPlayer) log(`${c.name}, child of ${rulerFullName(civ)}, has died.`, { civ: civ.id, type: 'bad' });
    }
  }
  const gov = GOVERNMENTS[civ.gov];
  const fertile = r.spouse ? (r.spouse.age < 46 ? (civ.family.length ? 0.17 : 0.3) : 0) : 0.03;
  if (gov.succession === 'heir' && civ.family.length < 5 && r.age >= 18 && r.age < 55 && rng.chance(fertile)) {
    const c = makeChild(civ);
    c.id = newId();
    if (r.spouse?.from >= 0) c.claim = r.spouse.from;
    civ.family.push(c);
    if (civ.isPlayer) log(`A child, ${c.name}, is born to ${rulerFullName(civ)}.`, { civ: civ.id, type: 'good' });
  }
  if (civ.gov === 'republic' && S().day - r.since >= 360 * 8) { succeed(civ, 'election'); return; }
  const a = r.age;
  const p = a < 35 ? 0.004 : a < 50 ? 0.012 : a < 60 ? 0.03 : a < 70 ? 0.07 : 0.15 + (a - 70) * 0.02;
  if (rng.chance(p)) succeed(civ, 'death');
}

function recordReign(civ, cause) {
  civ.rulers ??= [];
  civ.rulers.push({ name: rulerFullName(civ), dynasty: civ.ruler.dynasty, from: civ.ruler.since, to: S().day, cause });
  if (civ.rulers.length > 60) civ.rulers.shift();
}
function noteDynasty(civ, name) {
  civ.dynasties ??= [];
  const last = civ.dynasties[civ.dynasties.length - 1];
  if (last && last.name === name && last.to == null) return;
  if (last && last.to == null) last.to = S().day;
  civ.dynasties.push({ name, from: S().day, to: null });
}

export function succeed(civ, cause) {
  const st = S();
  const rng = G.rng;
  const old = civ.ruler;
  const oldName = rulerFullName(civ);
  const gov = GOVERNMENTS[civ.gov];
  recordReign(civ, cause === 'death' ? 'died' : cause);
  let msg;
  let crisis = null;
  let partitionLater = null;
  let unionWith = null;
  if (cause === 'election') {
    civ.ruler = makeRuler(civ, { age: rng.int(35, 60) });
    msg = `${oldName}'s term ends. ${rulerFullName(civ)} is elected to lead ${civ.displayName}.`;
  } else if (gov.succession === 'heir' && heirOf(civ)) {
    const h = heirOf(civ);
    if (!h.stats) educate(civ, h, h.edu);
    const siblings = civ.family.filter((c) => c !== h && c.age >= 16);
    civ.family = [];
    civ.ruler = makeRuler(civ, { name: h.name, gender: h.gender, age: h.age, dynasty: old.dynasty, traits: h.traits, stats: h.stats });
    civ.ruler.id = h.id ?? newId();
    if (h.claim >= 0) civ.ruler.claim = h.claim;
    msg = `${oldName} has ${cause === 'murder' ? 'been murdered' : 'died'}. ${rulerFullName(civ)} of House ${old.dynasty} inherits the throne.`;
    if (civ.law === 'partition' && siblings.length) partitionLater = siblings;
    if (h.age < 16) {
      civ.regencyUntil = st.day + (16 - h.age) * 360;
      civ.stability -= 6;
      msg += ' A regency council rules until they come of age.';
    }
    // Passed-over siblings may contest the throne
    const rival = siblings.sort((a, b) => statTotal(b) - statTotal(a))[0];
    if (rival && civ.stability < 50 && civ.settlements.length >= 3 && rng.chance(civ.law === 'elective' ? 0.3 : 0.15)) {
      crisis = { name: rival.name, gender: rival.gender, dynasty: old.dynasty, traits: rival.traits, stats: rival.stats, age: rival.age };
    }
  } else if (gov.succession === 'heir' && (unionWith = inheritByClaim(civ))) {
    civ.ruler = makeRuler(civ, { age: rng.int(20, 45), dynasty: unionWith.ruler.dynasty });
    msg = `${oldName} has died without an heir. By right of blood, House ${unionWith.ruler.dynasty} of ${unionWith.displayName} inherits the throne — ${civ.displayName} enters a personal union under ${unionWith.displayName}.`;
  } else if (gov.succession === 'heir') {
    civ.ruler = makeRuler(civ, { age: rng.int(25, 45) });
    civ.stability -= 12;
    msg = `${oldName} has died without an heir. House ${old.dynasty} loses the throne — House ${civ.ruler.dynasty} rises with ${rulerFullName(civ)}.`;
    if (civ.stability < 45 && civ.settlements.length >= 3 && rng.chance(0.5)) {
      crisis = { name: personName(civ.race, rng.chance(0.5) ? 'm' : 'f', rng), dynasty: old.dynasty, age: rng.int(20, 40) };
    }
  } else if (gov.succession === 'seize') {
    civ.ruler = makeRuler(civ, { age: rng.int(30, 50) });
    civ.stability -= 8;
    msg = `${oldName} has died. ${rulerFullName(civ)} seizes power in the turmoil.`;
  } else {
    civ.ruler = makeRuler(civ, { age: rng.int(40, 60) });
    civ.stability -= 2;
    msg = `${oldName} has died. ${rulerFullName(civ)} is chosen as successor.`;
  }
  noteDynasty(civ, civ.ruler.dynasty);
  civ.history.push({ day: st.day, text: msg });
  invalidateMods(civ);
  log(msg, { civ: civ.id, type: civ.isPlayer ? 'info' : 'world', toast: civ.isPlayer });
  driftPersonality(civ);
  if (crisis && G.civilWar) {
    G.civilWar(civ, 'claimant', crisis);
  } else if (partitionLater) partitionRealm(civ, partitionLater);
}

// AI personalities follow the temperament of their rulers.
export function driftPersonality(civ) {
  if (civ.isPlayer || !G.rng.chance(0.45)) return;
  const t = civ.ruler.traits;
  let p = null;
  if (t.includes('ambitious') || t.includes('cruel')) p = G.rng.chance(0.5) ? 'expansionist' : 'militaristic';
  else if (t.includes('brave')) p = 'militaristic';
  else if (t.includes('just') || t.includes('charismatic')) p = 'diplomatic';
  else if (t.includes('pious')) p = 'defensive';
  else if (t.includes('greedy')) p = 'trader';
  else if (t.includes('wise') || t.includes('frugal')) p = G.rng.chance(0.5) ? 'isolationist' : 'diplomatic';
  if (p && p !== civ.personality) {
    civ.personality = p;
    civ.history.push({ day: S().day, text: `Under ${rulerFullName(civ)}, the realm turns ${PERSONALITIES[p].name.toLowerCase()}.` });
  }
}

// ---------------- Reforms ----------------
export function reformCost(civ) {
  const base = 120 * (1 + 0.5 * (civ.reforms || 0));
  return Math.round(base * (civ.race === 'humans' ? 0.7 : 1));
}

export function reformCheck(civ, govId) {
  const g = GOVERNMENTS[govId];
  if (civ.gov === govId) return { ok: false, reason: 'Current government' };
  const req = g.requires || {};
  const st = S();
  const setts = civ.settlements.map((id) => st.settlements[id]);
  const reasons = [];
  if (civ.rebel) reasons.push('Not while a rebel faction');
  if (req.tech && !civ.techs.includes(req.tech)) reasons.push(`Technology: ${req.tech.replace(/_/g, ' ')}`);
  if (req.stage && !setts.some((s) => s.stage >= req.stage)) reasons.push(`A settlement of size ${['Camp', 'Village', 'Town', 'City'][req.stage]}+`);
  if (req.building && !setts.some((s) => s.buildings[req.building])) reasons.push(`A ${req.building.replace(/_/g, ' ')}`);
  if (req.gov && civ.gov !== req.gov) reasons.push(`Must be a ${GOVERNMENTS[req.gov].name}`);
  if (req.provinces) {
    const owned = st.provinces.filter((p) => p.owner === civ.id).length;
    if (owned < req.provinces) reasons.push(`${req.provinces} provinces (have ${owned})`);
  }
  const cost = reformCost(civ);
  if (civ.treasury < cost) reasons.push(`${cost} gold`);
  return { ok: reasons.length === 0, reasons, cost };
}

export function changeGovernment(civ, govId) {
  civ.gov = govId;
  civ.law = defaultLaw(govId);
  if (GOVERNMENTS[govId].succession !== 'heir') civ.family = [];
  civ.displayName = realmName(civ);
  invalidateMods(civ);
}

export function doReform(civ, govId) {
  const r = reformCheck(civ, govId);
  if (!r.ok) return r;
  const from = GOVERNMENTS[civ.gov].name;
  civ.treasury -= r.cost;
  civ.reforms = (civ.reforms || 0) + 1;
  civ.stability -= from === 'Tribal Government' ? 4 : 10;
  changeGovernment(civ, govId);
  const msg = `${civ.baseName} reforms from ${from} to ${GOVERNMENTS[govId].name}. It is now the ${civ.displayName}.`;
  civ.history.push({ day: S().day, text: msg });
  log(msg, { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', toast: true });
  return r;
}

export { TRAITS };
