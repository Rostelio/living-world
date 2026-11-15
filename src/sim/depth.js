// Phase 21 — more to do in the middle of the game:
//  · trade on the map: caravans and merchant ships ply every trade route; raiders and enemies
//    can cut a route for a few months unless it is escorted; trading posts boost routes
//  · missions: a few goals at a time that fit the realm's situation, with rewards
//  · decisions: big one-time choices that unlock when their conditions are met
//  · court intrigue: schemes against other realms (spies, discord, stolen knowledge, revolt),
//    run by the realm's best schemer; the AI schemes against its rivals too
import { G, S, log, civOf } from './state.js';
import { invalidateMods, mods } from './mods.js';
import { atWar, warsOf, allied, rel, opinion } from './diplomacy.js';
import { TECH } from '../data/techs.js';
import { remember } from './memory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const YEAR = 360;
const income = (c) => Math.max(20, (c.last?.tax || 0) + (c.last?.trade || 0) + (c.last?.tradeIncome || 0));
const setts = (c) => c.settlements.map((id) => S().settlements[id]).filter(Boolean);
const addMod = (c, name, fx, months) => { c.modifiers ??= []; c.modifiers.push({ name, fx, until: months < 0 ? -1 : S().day + months * 30 }); invalidateMods(c); };

// ---------------- Trade on the map ----------------
export const routeRaided = (r) => r && r.raid && r.raid.until > S().day;
export const escortCost = (r) => Math.round(4 + r.level * 4);
export function setEscort(civ, routeId, on) {
  const r = S().routes.find((x) => x.id === routeId);
  if (!r) return;
  r.escort ??= {};
  r.escort[civ.id] = !!on;
}
function tradeMonthly() {
  const st = S();
  for (const r of st.routes || []) {
    const A = civOf(r.a), Bc = civOf(r.b);
    if (!A?.alive || !Bc?.alive) continue;
    // escorts are paid by whoever keeps them
    for (const c of [A, Bc]) if (r.escort?.[c.id]) { c.treasury -= escortCost(r); if (c.last) c.last.escorts = (c.last.escorts || 0) + escortCost(r); }
    if (routeRaided(r)) continue;
    // danger: wars around either partner, unrest along the way
    const wars = warsOf(r.a).length + warsOf(r.b).length;
    const unrest = (avgUnrest(A) + avgUnrest(Bc)) / 200;
    const guarded = (r.escort?.[r.a] ? 1 : 0) + (r.escort?.[r.b] ? 1 : 0);
    let p = 0.006 + wars * 0.025 + unrest * 0.04;
    p *= guarded === 2 ? 0.1 : guarded === 1 ? 0.35 : 1;
    if (!G.rng.chance(p)) continue;
    const months = G.rng.int(3, 7);
    // who struck: a realm at war with one of the partners, or brigands
    const foe = st.civs.find((c) => c.alive && c.id !== r.a && c.id !== r.b && (atWar(c.id, r.a) || atWar(c.id, r.b)));
    r.raid = { until: st.day + months * 30, by: foe ? foe.id : -1 };
    const loot = Math.round((income(A) + income(Bc)) * 0.08 * r.level);
    if (foe) foe.treasury += loot;
    const who = foe ? foe.displayName : 'Brigands';
    if (A.isPlayer || Bc.isPlayer) log(`🐫 ${who} raid the caravans between ${A.displayName} and ${Bc.displayName}! The route is cut for ${months} months.`, { civ: st.playerId, type: 'bad', toast: true });
  }
}
function avgUnrest(c) { const l = setts(c); return l.length ? l.reduce((s, x) => s + (x.unrest || 0), 0) / l.length : 0; }

// ---------------- Missions ----------------
const capitalOf = (c) => S().settlements[c.capital];
const regiments = (c) => S().armies.filter((a) => a.civ === c.id).reduce((s, a) => s + Object.values(a.units).reduce((x, y) => x + y, 0), 0);
export const MISSIONS = {
  village: { name: 'From Camp to Village', icon: '⌂', desc: 'Let the capital grow into a village.', check: (c) => [capitalOf(c)?.stage >= 1 ? 1 : 0, 1], reward: { gold: 3, stab: 2 }, avail: (c) => (capitalOf(c)?.stage ?? 0) < 1 },
  second: { name: 'A New Hearth', icon: '⚑', desc: 'Found a second settlement.', check: (c) => [Math.min(2, c.settlements.length), 2], reward: { gold: 4 }, avail: (c) => c.settlements.length < 2 },
  five: { name: 'Five Towns', icon: '⚑', desc: 'Hold five settlements.', check: (c) => [Math.min(5, c.settlements.length), 5], reward: { gold: 6, stab: 3 }, avail: (c) => c.settlements.length >= 2 && c.settlements.length < 5 },
  realm: { name: 'A Great Realm', icon: '♛', desc: 'Hold twelve settlements.', check: (c) => [Math.min(12, c.settlements.length), 12], reward: { gold: 10, admin: 1 }, avail: (c) => c.settlements.length >= 5 && c.settlements.length < 12 },
  town: { name: 'A Proper Town', icon: '🏘', desc: 'Grow a settlement into a town (needs a town hall).', check: (c) => [setts(c).some((s) => s.stage >= 2) ? 1 : 0, 1], reward: { gold: 5, know: 0.2 }, avail: (c) => !setts(c).some((s) => s.stage >= 2) && setts(c).some((s) => s.stage >= 1) },
  city: { name: 'A City of Renown', icon: '🏙', desc: 'Grow a settlement into a city.', check: (c) => [setts(c).some((s) => s.stage >= 3) ? 1 : 0, 1], reward: { gold: 8, stab: 3 }, avail: (c) => setts(c).some((s) => s.stage >= 2) && !setts(c).some((s) => s.stage >= 3) },
  trade: { name: 'Open the Roads', icon: '🐫', desc: 'Open a trade route with another realm.', check: (c) => [Math.min(1, (S().routes || []).filter((r) => r.a === c.id || r.b === c.id).length), 1], reward: { gold: 4, stab: 2 }, avail: (c) => (c.era || 0) >= 1 && !(S().routes || []).some((r) => r.a === c.id || r.b === c.id) },
  traders: { name: 'Merchant Princes', icon: '🐫', desc: 'Keep three trade routes open.', check: (c) => [Math.min(3, (S().routes || []).filter((r) => r.a === c.id || r.b === c.id).length), 3], reward: { gold: 8 }, avail: (c) => (S().routes || []).some((r) => r.a === c.id || r.b === c.id) },
  friend: { name: 'A Sworn Friend', icon: '🤝', desc: 'Sign an alliance.', check: (c) => [S().civs.some((o) => o.alive && o.id !== c.id && allied(c.id, o.id)) ? 1 : 0, 1], reward: { stab: 4 }, avail: (c) => c.contacts?.length > 0 && !S().civs.some((o) => o.alive && o.id !== c.id && allied(c.id, o.id)) },
  army: { name: 'Shield of the Realm', icon: '⚔', desc: 'Raise ten regiments.', check: (c) => [Math.min(10, regiments(c)), 10], reward: { gold: 4, stab: 2 }, avail: (c) => c.settlements.length >= 3 && regiments(c) < 10 },
  era: { name: 'A New Age', icon: '✦', desc: 'Enter the next era.', check: (c) => [c.era > (c.missionEra ?? c.era) ? 1 : 0, 1], reward: { gold: 6, know: 0.3 }, avail: (c) => (c.era || 0) < 3, start: (c) => { c.missionEra = c.era || 0; } },
  work: { name: 'A Lasting Legacy', icon: '🏛', desc: 'Complete a great work or a monument.', check: (c) => [((c.works || []).length + (c.monuments || []).length) > (c.missionWorks ?? 0) ? 1 : 0, 1], reward: { stab: 4, know: 0.2 }, avail: (c) => (c.era || 0) >= 1, start: (c) => { c.missionWorks = (c.works || []).length + (c.monuments || []).length; } },
  granary: { name: 'Full Granaries', icon: '🌾', desc: 'Store 600 grain.', check: (c) => [Math.min(600, Math.round(c.stock.grain || 0)), 600], reward: { gold: 3, stab: 2 }, avail: (c) => (c.stock.grain || 0) < 400 && c.settlements.length >= 2 },
  stable: { name: 'Peace at Home', icon: '☮', desc: 'Raise stability to 70.', check: (c) => [Math.min(70, Math.round(c.stability)), 70], reward: { gold: 5 }, avail: (c) => c.stability < 55 },
};
export const MISSION_LIST = Object.keys(MISSIONS);
function giveReward(c, R, label) {
  const parts = [];
  if (R.gold) { const g = Math.round(income(c) * R.gold); c.treasury += g; parts.push(`+${g} gold`); }
  if (R.stab) { c.stability = clamp(c.stability + R.stab, 0, 100); parts.push(`+${R.stab} stability`); }
  if (R.know) { const k = Math.round(120 * ((c.era || 0) + 1) * R.know * 3); c.research.pool += k; parts.push(`+${k} research`); }
  if (R.admin) { addMod(c, label, { admin: R.admin }, -1); parts.push(`+${R.admin} administration`); }
  return parts.join(', ');
}
function missionsMonthly(c) {
  c.missions ??= { active: [], done: [] };
  const m = c.missions;
  // complete
  for (const id of [...m.active]) {
    const M = MISSIONS[id];
    const [cur, goal] = M.check(c);
    if (cur >= goal) {
      m.active = m.active.filter((x) => x !== id); m.done.push(id);
      const got = giveReward(c, M.reward, M.name);
      if (c.isPlayer) log(`🎯 Mission complete — ${M.name}: ${got}.`, { civ: c.id, type: 'good', toast: true, major: true });
    } else if (!M.avail(c) && cur === 0 && id !== 'era' && id !== 'work') m.active = m.active.filter((x) => x !== id); // no longer fits
  }
  // pick new ones that fit (up to three)
  if (m.active.length < 3) {
    const opts = MISSION_LIST.filter((id) => !m.active.includes(id) && !m.done.includes(id) && MISSIONS[id].avail(c));
    while (m.active.length < 3 && opts.length) { const id = opts.shift(); MISSIONS[id].start?.(c); m.active.push(id); }
  }
}

// ---------------- Decisions ----------------
const hasB = (c, b, n = 1) => setts(c).reduce((s, x) => s + (x.buildings[b] || 0), 0) >= n;
export const DECISIONS = {
  codify: { name: 'Codify the Laws', icon: '📜', desc: 'Scholars gather every custom into one code of law.', fx: '+1 administration for good; −2 stability for a year while courts adjust', cost: 3, need: 'Medieval era and stability 45+', ok: (c) => c.era >= 1 && c.stability >= 45, act: (c) => { addMod(c, 'Codified laws', { admin: 1 }, -1); addMod(c, 'New courts', { stability: -2 }, 12); } },
  order: { name: 'Found a Holy Order', icon: '✝', desc: 'Sworn brothers keep the faith and the roads safe.', fx: '+3 stability and +5 defense for good', cost: 4, need: 'three temples', ok: (c) => hasB(c, 'temple', 3), act: (c) => addMod(c, 'Holy order', { stability: 3, defense: 5 }, -1) },
  roads: { name: 'The King\'s Highways', icon: '🛣', desc: 'Paved highways bind the realm together.', fx: '+5% taxes, +3% growth for good', cost: 5, need: 'three roads', ok: (c) => hasB(c, 'road', 3), act: (c) => addMod(c, 'King\'s highways', { tax: 0.05, growth: 0.03 }, -1) },
  tourney: { name: 'A Great Tournament', icon: '🏇', desc: 'Knights from every land compete before the court.', fx: '+6 stability for 5 years; nearby realms think better of us', cost: 3, need: 'a castle', ok: (c) => hasB(c, 'castle'), act: (c) => { addMod(c, 'Great tournament', { stability: 6 }, 60); for (const o of c.contacts || []) rel(c.id, o).gift = Math.min(60, (rel(c.id, o).gift || 0) + 12); } },
  academy: { name: 'Found an Academy', icon: '✎', desc: 'A school where the realm\'s best minds teach.', fx: '+8% knowledge for good', cost: 4, need: 'two libraries', ok: (c) => hasB(c, 'library', 2), act: (c) => addMod(c, 'Royal academy', { knowledge: 0.08 }, -1) },
  capital: { name: 'Move the Capital', icon: '♛', desc: 'Make our greatest city the seat of the crown.', fx: 'the largest settlement becomes the capital; −5 stability for 2 years', cost: 4, need: 'a city larger than the capital', ok: (c) => { const big = setts(c).sort((a, b) => b.pop - a.pop)[0]; return big && big.id !== c.capital && big.pop > (capitalOf(c)?.pop || 0) * 1.5; }, act: (c) => { const big = setts(c).sort((a, b) => b.pop - a.pop)[0]; const old = capitalOf(c); if (old) old.isCapital = false; big.isCapital = true; c.capital = big.id; addMod(c, 'A new capital', { stability: -5 }, 24); } },
  unify: { name: 'Unite Our People', icon: '★', desc: 'Proclaim that every one of our kin belongs under one crown.', fx: '+10% growth and +4 stability for good', cost: 6, need: 'twelve settlements', ok: (c) => c.settlements.length >= 12, act: (c) => addMod(c, 'One people, one crown', { growth: 0.1, stability: 4 }, -1) },
  reform: { name: 'Reform the Faith', icon: '✝', desc: 'Our theologians strip away old abuses and write a new creed.', fx: 'a Reformed faith with +8% knowledge becomes the state faith; −15 stability as the old clergy resist', cost: 4, need: 'the Renaissance', ok: (c) => c.era >= 2 && !/^Reformed/.test(G.state.faiths?.[c.faith]?.name || ''), act: (c) => { G.religion?.reformFaith(c, 'knowledge'); } },
  gates: { name: 'Open the Gates', icon: '🚪', desc: 'Welcome refugees and wanderers from every land.', fx: '+12% population in every settlement; −4 stability for 2 years', cost: 1, need: 'stability 55+', ok: (c) => c.stability >= 55 && c.settlements.length >= 2, act: (c) => { for (const s of setts(c)) { s.pop *= 1.12; s.housing = Math.max(s.housing, Math.ceil(s.pop * 1.05)); if (s.pops) for (const k in s.pops) s.pops[k] *= 1.12; } addMod(c, 'Newcomers', { stability: -4 }, 24); } },
};
export const DECISION_LIST = Object.keys(DECISIONS);
export const decisionCost = (c, id) => Math.round(income(c) * DECISIONS[id].cost + 50);
export function canTakeDecision(c, id) {
  const D = DECISIONS[id];
  if (!D) return { ok: false, reason: 'Unknown' };
  if ((c.decisions || []).includes(id)) return { ok: false, reason: 'Already done' };
  if (!D.ok(c)) return { ok: false, reason: `Needs ${D.need}` };
  if (c.treasury < decisionCost(c, id)) return { ok: false, reason: `Costs ${decisionCost(c, id)} gold` };
  return { ok: true };
}
export function takeDecision(c, id) {
  const r = canTakeDecision(c, id);
  if (!r.ok) return r;
  c.treasury -= decisionCost(c, id);
  (c.decisions ??= []).push(id);
  DECISIONS[id].act(c);
  log(`${DECISIONS[id].icon} ${c.displayName}: ${DECISIONS[id].name}.`, { civ: c.isPlayer ? c.id : -1, type: c.isPlayer ? 'good' : 'world', major: c.isPlayer });
  return { ok: true };
}

// ---------------- Court intrigue: schemes ----------------
export const SCHEMES = {
  spy: { name: 'Spy Network', icon: '👁', desc: 'Agents report the target\'s plans, ambitions, armies and treasury for 5 years.', months: 6, cost: 1 },
  discord: { name: 'Sow Discord', icon: '🐍', desc: 'Rumours and bribes: −10 stability for the target for 2 years.', months: 8, cost: 2 },
  steal: { name: 'Steal Knowledge', icon: '📖', desc: 'Copy one technology the target knows and we do not.', months: 10, cost: 2 },
  incite: { name: 'Incite Revolt', icon: '🔥', desc: 'Stir unrest in the target\'s towns; a revolt may follow.', months: 12, cost: 3 },
};
export const SCHEME_LIST = Object.keys(SCHEMES);
export const schemeCost = (c, k) => Math.round(income(c) * SCHEMES[k].cost + 40);
// the realm's best schemer: the ruler or the most intriguing courtier
export function spymaster(c) {
  let best = { name: c.ruler?.name, int: c.ruler?.stats?.int ?? 5, schemer: c.ruler?.traits?.includes('schemer') };
  for (const p of c.court || []) { const v = p.stats?.int ?? 0; if (v > best.int) best = { name: p.name, int: v, schemer: p.traits?.includes('schemer') }; }
  return best;
}
export function schemeOdds(c, target, k) {
  const sm = spymaster(c), tm = spymaster(civOf(target));
  const base = { spy: 0.85, discord: 0.7, steal: 0.55, incite: 0.5 }[k];
  return clamp(base + (sm.int - tm.int) * 0.04 + (sm.schemer ? 0.1 : 0), 0.1, 0.95);
}
export function canScheme(c, target, k) {
  const T = civOf(target);
  if (!T?.alive || target === c.id) return { ok: false, reason: 'Invalid target' };
  if (!c.contacts?.includes(target)) return { ok: false, reason: 'No contact' };
  if ((c.schemes || []).some((x) => x.target === target && x.kind === k)) return { ok: false, reason: 'Already under way' };
  if ((c.schemes || []).length >= 2 + (spymaster(c).int >= 8 ? 1 : 0)) return { ok: false, reason: 'Too many schemes at once' };
  if (k === 'steal' && !T.techs.some((t) => !c.techs.includes(t) && !TECH[t]?.race)) return { ok: false, reason: 'Nothing to steal' };
  if (c.treasury < schemeCost(c, k)) return { ok: false, reason: `Costs ${schemeCost(c, k)} gold` };
  return { ok: true };
}
export function startScheme(c, target, k) {
  const r = canScheme(c, target, k);
  if (!r.ok) return r;
  c.treasury -= schemeCost(c, k);
  (c.schemes ??= []).push({ kind: k, target, progress: 0, months: SCHEMES[k].months, odds: schemeOdds(c, target, k) });
  return { ok: true };
}
export function cancelScheme(c, i) { c.schemes?.splice(i, 1); }
export const spiedOn = (c, target) => (c.intel?.[target] || 0) > S().day;
function schemesMonthly(c) {
  if (!c.schemes?.length) return;
  for (const sc of [...c.schemes]) {
    const T = civOf(sc.target);
    if (!T?.alive) { c.schemes = c.schemes.filter((x) => x !== sc); continue; }
    sc.progress++;
    // each month there is a small chance the agents are caught
    if (G.rng.chance((1 - sc.odds) * 0.06)) {
      c.schemes = c.schemes.filter((x) => x !== sc);
      rel(sc.target, c.id).grudge = (rel(sc.target, c.id).grudge || 0) + 25;
      remember(sc.target, c.id, 'insulted');
      const msg = `${SCHEMES[sc.kind].icon} Agents of ${c.displayName} were caught in ${T.displayName}: the ${SCHEMES[sc.kind].name.toLowerCase()} is exposed!`;
      if (c.isPlayer || T.isPlayer) log(msg, { civ: S().playerId, type: c.isPlayer ? 'bad' : 'good', toast: true });
      continue;
    }
    if (sc.progress < sc.months) continue;
    c.schemes = c.schemes.filter((x) => x !== sc);
    const st = S();
    if (sc.kind === 'spy') { (c.intel ??= {})[sc.target] = st.day + 5 * YEAR; }
    else if (sc.kind === 'discord') addMod(T, 'Sown discord', { stability: -10 }, 24);
    else if (sc.kind === 'steal') { const t = T.techs.find((x) => !c.techs.includes(x) && !TECH[x]?.race); if (t) { c.techs.push(t); invalidateMods(c); } }
    else if (sc.kind === 'incite') { for (const s of setts(T)) s.unrest = Math.min(100, (s.unrest || 0) + 30); }
    const what = { spy: 'our spies now report from', discord: 'discord spreads in', steal: 'stolen knowledge arrives from', incite: 'revolt stirs in' }[sc.kind];
    if (c.isPlayer) log(`${SCHEMES[sc.kind].icon} Scheme succeeded: ${what} ${T.displayName}.`, { civ: c.id, type: 'good', toast: true });
    else if (T.isPlayer && sc.kind !== 'spy') log(`${SCHEMES[sc.kind].icon} Someone is working against us: ${SCHEMES[sc.kind].name.toLowerCase()} in our realm.`, { civ: T.id, type: 'bad', toast: true });
  }
}
function aiSchemes(c) {
  if (c.isPlayer || c.rebel || (c.schemes || []).length || !G.rng.chance(0.02)) return;
  const target = c.rival ?? c.ambition?.def;
  if (target == null || !civOf(target)?.alive) return;
  const k = G.rng.chance(0.4) ? 'spy' : G.rng.chance(0.5) ? 'discord' : G.rng.chance(0.5) ? 'steal' : 'incite';
  if (canScheme(c, target, k).ok && c.treasury > schemeCost(c, k) * 3) startScheme(c, target, k);
}

// ---------------- Monthly ----------------
export function depthMonthly() {
  const st = S();
  tradeMonthly();
  for (const c of st.civs) {
    if (!c.alive) continue;
    if (c.isPlayer) missionsMonthly(c);
    schemesMonthly(c);
    aiSchemes(c);
    if (!c.isPlayer || c.autoBuild) for (const r of st.routes || []) if ((r.a === c.id || r.b === c.id) && (warsOf(c.id).length > 0) !== !!r.escort?.[c.id] && c.treasury > escortCost(r) * 12) setEscort(c, r.id, warsOf(c.id).length > 0);
  }
  void mods; void opinion;
}
export function ensurePhase21(st) {
  for (const c of st.civs) { c.missions ??= { active: [], done: [] }; c.decisions ??= []; c.schemes ??= []; c.intel ??= {}; }
  for (const r of st.routes || []) r.escort ??= {};
}
