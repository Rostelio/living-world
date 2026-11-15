import { aiWarYearly } from './warplans.js';
import { settleOccupations, provincesFor, provincesCost } from './warfare.js';
import { G, S, log, civOf } from './state.js';
import { PERSONALITIES } from '../data/governments.js';
import { UNITS } from '../data/military.js';
import { clamp } from '../core/util.js';
import { faithOpinion } from './culture.js';
import { remember, memoryItems, temperament } from './memory.js';

// ---------------- Relations ----------------
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function rel(a, b) {
  const st = S();
  if (!st.diplo) st.diplo = {};
  const k = key(a, b);
  if (!st.diplo[k]) st.diplo[k] = { op: 0, gift: 0, grudge: 0, trade: false, ally: false, truce: 0 };
  return st.diplo[k];
}
export const allied = (a, b) => a !== b && rel(a, b).ally;
export const trading = (a, b) => a !== b && rel(a, b).trade;
export const inTruce = (a, b) => a !== b && rel(a, b).truce > S().day;
export const overlordOf = (c) => civOf(c).overlord ?? -1;
export const vassalPair = (a, b) => overlordOf(a) === b || overlordOf(b) === a;

export function warBetween(a, b) {
  for (const w of S().wars) {
    if ((w.att.includes(a) && w.def.includes(b)) || (w.att.includes(b) && w.def.includes(a))) return w;
  }
  return null;
}
export const atWar = (a, b) => a !== b && !!warBetween(a, b);
export const warsOf = (c) => S().wars.filter((w) => w.att.includes(c) || w.def.includes(c));
export const sideOf = (w, c) => (w.att.includes(c) ? 'att' : w.def.includes(c) ? 'def' : null);
export function enemiesOf(c) {
  const out = new Set();
  for (const w of warsOf(c)) for (const e of (w.att.includes(c) ? w.def : w.att)) out.add(e);
  return out;
}
// May an army of civ `c` stand in territory owned by `o`?
export function mayEnter(c, o) {
  return o < 0 || o === c || allied(c, o) || vassalPair(c, o) || atWar(c, o);
}

const ENMITY = {
  'elves-orcs': -20, 'dwarves-orcs': -20, 'dwarves-elves': -10, 'humans-orcs': -8,
  'halflings-orcs': -18, 'humans-lizardfolk': -6, 'elves-lizardfolk': -6, 'halflings-humans': 6, 'dwarves-halflings': 4,
};
export function opinionBreakdown(a, b) {
  const A = civOf(a), B = civOf(b), r = rel(a, b);
  const items = [];
  if (A.race === B.race) items.push(['Kindred people', 15]);
  else {
    const e = ENMITY[[A.race, B.race].sort().join('-')];
    items.push(e ? [e > 0 ? 'Old friendship' : 'Ancient enmity', e] : ['Different peoples', -5]);
  }
  if (A.contacts?.includes(b)) items.push(['Shared border', -8]);
  if (r.ally) items.push(['Alliance', 35]);
  if (r.trade) items.push(['Trade agreement', 15]);
  if (atWar(a, b)) items.push(['At war', -80]);
  else if (inTruce(a, b)) items.push(['Recent war', -25]);
  if (A.gov === B.gov) items.push(['Similar government', 5]);
  const dip = (c) => c.personality === 'diplomatic' ? 8 : c.personality === 'isolationist' ? -6 : 0;
  const d = dip(A) + dip(B);
  if (d) items.push(['Temperament', d]);
  if (vassalPair(a, b)) items.push(['Vassalage', 20]);
  const ae = (A.ae || 0) + (B.ae || 0);
  if (ae > 3) items.push(['Aggressive expansion', -Math.round(ae * 0.5)]);
  if (A.rival === b || B.rival === a) items.push(['Rivalry', -15]);
  if (A.rebel?.parent === b || B.rebel?.parent === a) items.push(['Rebellion', -40]);
  if (r.marriage) items.push(['Royal marriage', 20]);
  if (A.ruler?.dynasty && A.ruler.dynasty === B.ruler?.dynasty) items.push([`Same house (${A.ruler.dynasty})`, 25]);
  const fo = faithOpinion(a, b);
  if (fo) items.push(fo);
  if (r.gift > 0.5) items.push(['Gifts', Math.round(r.gift)]);
  if (r.grudge > 0.5) items.push(['Grievances', -Math.round(r.grudge)]);
  items.push(...memoryItems(a, b)); // Phase 17: what each remembers of the other
  return items;
}
export function opinion(a, b) { return a === b ? 100 : Math.round(rel(a, b).op); }

// ---------------- Strength ----------------
export function armyPower(army) {
  let p = 0;
  for (const k in army.units) { const U = UNITS[k]; p += army.units[k] * (U.att + U.def) / 2; }
  return p * (0.5 + 0.5 * army.morale);
}
export function militaryStrength(c) {
  const st = S();
  let p = 0;
  for (const a of st.armies) if (a.civ === c) p += armyPower(a);
  for (const f of st.fleets || []) if (f.civ === c) for (const k in f.ships) p += f.ships[k] * 2.5;
  for (const id of civOf(c).settlements) {
    const s = st.settlements[id];
    p += (s.stage + 1) * 1.5 + (s.buildings.barracks || 0) * 2 + (s.buildings.walls || 0) * 2;
  }
  return p;
}
export function coalitionStrength(c) {
  let p = militaryStrength(c);
  for (const o of S().civs) if (o.alive && o.id !== c && (allied(c, o.id) || overlordOf(o.id) === c)) p += militaryStrength(o.id) * 0.7;
  return p;
}

// A menacing expansionist that both `a` and `b` border (coalition trigger).
export function dominantThreat(a, b) {
  const A = civOf(a), B = civOf(b);
  let best = null, bv = 0;
  for (const t of S().civs) {
    if (!t.alive || t.id === a || t.id === b || (t.ae || 0) < 30) continue;
    if (!(A.contacts?.includes(t.id) || B.contacts?.includes(t.id))) continue;
    if (allied(a, t.id) || allied(b, t.id)) continue;
    if (t.ae > bv) { bv = t.ae; best = t.id; }
  }
  return best;
}

// ---------------- Trade ----------------
function hasPort(c) { return civOf(c).settlements.some((id) => S().settlements[id].buildings.port); }
export function canTrade(a, b) {
  const A = civOf(a), B = civOf(b);
  if (!A.alive || !B.alive || atWar(a, b)) return false;
  return A.contacts.includes(b) || (hasPort(a) && hasPort(b));
}
function popOf(c) { let p = 0; for (const id of civOf(c).settlements) p += S().settlements[id].pop; return p; }
export function tradeIncome(a, b) {
  const markets = (c) => civOf(c).settlements.reduce((n, id) => n + (S().settlements[id].buildings.market || 0), 0);
  return Math.sqrt(popOf(a) * popOf(b)) * 0.006 * (1 + 0.05 * Math.min(10, markets(a))) + 1.5;
}

// ---------------- Evaluation of proposals ----------------
// Returns how `to` (AI) feels about a proposal from `from`.
export function evaluate(from, to, type, extra = {}) {
  const T = civOf(to);
  const P = PERSONALITIES[T.personality || 'diplomatic'];
  const op = opinion(from, to);
  const reasons = [];
  let score = 0;
  const add = (label, v) => { score += v; reasons.push([label, Math.round(v)]); };
  if (type === 'trade') {
    if (!canTrade(from, to)) return { accept: false, score: -999, reasons: [['No contact or at war', -999]] };
    add('Opinion', op * 0.6);
    add('Base interest', 15);
    if (T.personality === 'trader') add('Mercantile', 20);
    if (T.personality === 'isolationist') add('Isolationist', -30);
  } else if (type === 'alliance') {
    if (atWar(from, to)) return { accept: false, score: -999, reasons: [['At war', -999]] };
    add('Opinion', op * 0.8);
    add('Reluctance', -25);
    if (T.personality === 'defensive' || T.personality === 'diplomatic') add('Seeks partners', 15);
    if (T.personality === 'isolationist') add('Isolationist', -25);
    const common = [...enemiesOf(from)].some((e) => enemiesOf(to).has(e)) || [...enemiesOf(to)].length > 0;
    if (common) add('Common enemies', 20);
    const ratio = militaryStrength(from) / Math.max(1, militaryStrength(to));
    add('Relative strength', clamp((ratio - 1) * 15, -15, 15));
    if (enemiesOf(from).size && !enemiesOf(to).size) add('Would drag us to war', -20);
    const threat = dominantThreat(to, from);
    if (threat) add(`Common threat: ${civOf(threat).baseName}`, 28);
  } else if (type.startsWith('peace')) {
    const w = extra.war;
    const side = sideOf(w, to);
    const myScore = side === 'att' ? w.score : -w.score;
    const exh = side === 'att' ? w.exhA : w.exhD;
    add('War score', -myScore);
    add('War exhaustion', exh * 0.6);
    if (type === 'peace_white') add('Base', -10);
    if (type === 'peace_gold') { add('Tribute demanded', -20 - (extra.amount / Math.max(50, T.treasury + 50)) * 20); }
    if (type === 'peace_vassal') add('Submission', -60);
    if (type === 'peace_provinces') add(`Cede ${(extra.setts || []).length} occupied town${(extra.setts || []).length === 1 ? '' : 's'}`, -provincesCost(extra.setts || []) * 1.1 - 5);
    if (type === 'peace_goal') add('Their war goal', -15 - (w.goal?.type === 'vassal' ? 45 : w.goal?.type === 'conquest' ? 20 : 0));
    if (T.personality === 'militaristic') add('Warlike', -10);
  }
  void P;
  return { accept: score > 0, score: Math.round(score), reasons };
}

// ---------------- Actions ----------------
export function sendGift(a, b, amount) {
  const A = civOf(a);
  if (A.treasury < amount) return { ok: false, reason: 'Not enough gold' };
  A.treasury -= amount;
  civOf(b).treasury += amount;
  const r = rel(a, b);
  r.gift = Math.min(60, r.gift + (30 * amount) / (amount + 80));
  if (amount >= 100) remember(b, a, 'gift');
  return { ok: true };
}

export function signTrade(a, b) {
  rel(a, b).trade = true;
  log(`${civOf(a).displayName} and ${civOf(b).displayName} sign a trade agreement.`, { civ: involvesPlayer(a, b) ? G.state.playerId : a, type: involvesPlayer(a, b) ? 'good' : 'world', toast: involvesPlayer(a, b) });
}
export function signAlliance(a, b) {
  rel(a, b).ally = true;
  log(`${civOf(a).displayName} and ${civOf(b).displayName} forge an alliance.`, { civ: involvesPlayer(a, b) ? G.state.playerId : a, type: involvesPlayer(a, b) ? 'good' : 'world', toast: true });
}
export function cancelTrade(a, b) { rel(a, b).trade = false; rel(a, b).grudge += 5; }
export function breakAlliance(a, b, quiet = false) {
  rel(a, b).ally = false;
  rel(a, b).grudge += 20;
  remember(b, a, 'alliance_broken');
  if (!quiet) log(`The alliance between ${civOf(a).displayName} and ${civOf(b).displayName} is broken.`, { civ: involvesPlayer(a, b) ? G.state.playerId : a, type: involvesPlayer(a, b) ? 'bad' : 'world', toast: involvesPlayer(a, b) });
}
const involvesPlayer = (...ids) => ids.includes(G.state.playerId);

export function propose(from, to, type, extra = {}) {
  const T = civOf(to);
  if (T.isPlayer) {
    addOffer(from, to, type, extra);
    return { ok: true, pending: true };
  }
  const ev = evaluate(from, to, type, extra);
  if (!ev.accept) return { ok: false, reason: `${T.displayName} declines.`, ev };
  if (type === 'trade') signTrade(from, to);
  else if (type === 'alliance') signAlliance(from, to);
  else if (type.startsWith('peace')) acceptPeace(extra.war, from, type, extra.amount, extra.setts);
  return { ok: true, ev };
}

// Offers to the player from AI civilizations
export function addOffer(from, to, type, extra = {}) {
  const st = S();
  if (st.offers.some((o) => o.from === from && o.type === type)) return;
  st.offers.push({ id: st.nextOfferId++, from, to, type, war: extra.war?.id ?? -1, amount: extra.amount || 0, setts: extra.setts || null, day: st.day });
  const F = civOf(from);
  const text = {
    trade: `${F.displayName} proposes a trade agreement.`,
    alliance: `${F.displayName} proposes an alliance.`,
    peace_white: `${F.displayName} offers a white peace.`,
    peace_gold: `${F.displayName} demands ${extra.amount} gold for peace.`,
    peace_vassal: `${F.displayName} demands that you become their vassal.`,
    peace_provinces: `${F.displayName} demands ${(extra.setts || []).map((id) => S().settlements[id]?.name).join(', ')} for peace.`,
    peace_goal: `${F.displayName} demands what they went to war for.`,
  }[type];
  log(text + ' (Diplomacy)', { civ: to, type: 'info', toast: true });
}
export function answerOffer(id, accept) {
  const st = S();
  const o = st.offers.find((x) => x.id === id);
  if (!o) return;
  st.offers = st.offers.filter((x) => x.id !== id);
  if (!accept) { rel(o.from, o.to).grudge += 5; if (o.type === 'alliance' || o.type === 'trade') remember(o.from, o.to, 'offer_refused'); return; }
  if (o.type === 'trade' && canTrade(o.from, o.to)) signTrade(o.from, o.to);
  else if (o.type === 'alliance') signAlliance(o.from, o.to);
  else if (o.type.startsWith('peace')) {
    const w = st.wars.find((x) => x.id === o.war);
    if (w) acceptPeace(w, o.from, o.type, o.amount, o.setts);
  }
}

// ---------------- War ----------------
export function canDeclareWar(a, b) {
  const A = civOf(a), B = civOf(b);
  if (a === b || !A.alive || !B.alive) return { ok: false, reason: 'Invalid target' };
  if (atWar(a, b)) return { ok: false, reason: 'Already at war' };
  if (allied(a, b)) return { ok: false, reason: 'Allied — break the alliance first' };
  if (vassalPair(a, b) && A.overlord !== b) return { ok: false, reason: 'Your vassal' };
  if (A.overlord >= 0 && A.overlord !== b) return { ok: false, reason: 'Vassals cannot declare war' };
  if (inTruce(a, b)) return { ok: false, reason: 'Truce in effect' };
  const W = G.world;
  const myLand = new Set(A.settlements.map((id) => W.landmass[S().settlements[id].tile]));
  const reach = A.contacts.includes(b) || A.seaContacts?.includes(b) || B.settlements.some((id) => myLand.has(W.landmass[S().settlements[id].tile]));
  if (!reach) return { ok: false, reason: 'Out of reach — no land route, and no harbour within sailing range' };
  return { ok: true };
}

function joinWar(w, side, c) {
  if (w.att.includes(c) || w.def.includes(c)) return;
  w[side].push(c);
  const other = side === 'att' ? w.def : w.att;
  for (const e of other) if (allied(c, e)) breakAlliance(c, e, true);
}

export function declareWar(a, b) {
  const chk = canDeclareWar(a, b);
  if (!chk.ok) return chk;
  const st = S();
  const A = civOf(a), B = civOf(b);
  const independence = A.overlord === b;
  if (independence) A.overlord = -1;
  const w = {
    id: st.nextWarId++, name: independence ? `${A.baseName} War of Independence` : `${A.baseName}–${B.baseName} War`,
    att: [a], def: [b], start: st.day, score: 0, exhA: 0, exhD: 0, battles: 0,
  };
  st.wars.push(w);
  const r = rel(a, b);
  r.grudge += 30;
  if (!independence) remember(b, a, 'war_declared');
  if (r.op > 10 && !independence) { A.stability -= 6; }
  if (!independence) A.ae = (A.ae || 0) + 5;
  // Defensive calls: allies, overlord and vassals of the defender
  for (const c of st.civs) {
    if (!c.alive || c.id === a || c.id === b) continue;
    if (allied(c.id, b) || c.overlord === b || B.overlord === c.id) {
      if (allied(c.id, a)) breakAlliance(c.id, a, true);
      joinWar(w, 'def', c.id);
    } else if (c.overlord === a) joinWar(w, 'att', c.id);
    else if (!c.isPlayer && allied(c.id, a) && opinion(c.id, a) > 30 && G.rng.chance(clamp(0.6 * temperament(c).loyal, 0, 0.95))) joinWar(w, 'att', c.id);
  }
  const p = st.playerId;
  const involved = w.att.includes(p) || w.def.includes(p);
  const allies = (side) => side.length > 1 ? ` (with ${side.slice(1).map((c) => civOf(c).baseName).join(', ')})` : '';
  log(`WAR! ${A.displayName}${allies(w.att)} declares war on ${B.displayName}${allies(w.def)}.`, { civ: involved ? p : a, type: involved ? 'bad' : 'world', toast: true, tile: S().settlements[B.capital]?.tile ?? -1 });
  return { ok: true, war: w };
}

export function addWarScore(w, side, amount) {
  w.score = clamp(w.score + (side === 'att' ? amount : -amount), -100, 100);
}

function acceptPeace(w, proposer, type, amount, setts) {
  // proposer offers/demands; the side of the proposer is the potential winner for demands
  const pSide = sideOf(w, proposer);
  const otherLead = pSide === 'att' ? w.def[0] : w.att[0];
  if (type === 'peace_white') makePeace(w, { type: 'white' });
  else if (type === 'peace_gold') makePeace(w, { type: 'gold', winner: proposer, loser: otherLead, amount });
  else if (type === 'peace_vassal') makePeace(w, { type: 'vassal', winner: proposer, loser: otherLead });
  else if (type === 'peace_goal') makePeace(w, { type: 'goal', winner: proposer, loser: otherLead });
  else if (type === 'peace_provinces') makePeace(w, { type: 'provinces', winner: proposer, loser: otherLead, setts });
}

export function makePeace(w, terms) {
  const st = S();
  st.wars = st.wars.filter((x) => x !== w);
  st.offers = st.offers.filter((o) => o.war !== w.id);
  for (const a of w.att) for (const d of w.def) { const r = rel(a, d); r.truce = st.day + 360 * 10; }
  let msg = `${w.name} ends`;
  const taken = settleOccupations(w, terms);
  // Phase 17: memories of the war — land lost, vassalage, help from allies, an honourable end
  if (terms.loser != null && terms.winner != null) {
    if (terms.type === 'vassal') remember(terms.loser, terms.winner, 'vassalised');
    for (const name of taken) { const s = st.settlements.find((x) => x.name === name && !x.dead); remember(terms.loser, terms.winner, 'land_taken', { s: s?.id, name }); }
  } else if (terms.type === 'white') { remember(w.att[0], w.def[0], 'honourable_peace'); remember(w.def[0], w.att[0], 'honourable_peace'); }
  for (const side of [w.att, w.def]) for (const c of side.slice(1)) remember(side[0], c, 'war_aid');
  if (terms.type === 'provinces') msg += terms.capitulation ? `: ${civOf(terms.loser).displayName} capitulates` : '';
  if (terms.type === 'gold') {
    const L = civOf(terms.loser), Wn = civOf(terms.winner);
    const amt = Math.round(Math.min(terms.amount, Math.max(0, L.treasury)));
    L.treasury -= amt; Wn.treasury += amt;
    msg += `: ${L.displayName} pays ${amt} gold to ${Wn.displayName}.`;
  } else if (terms.type === 'vassal') {
    const L = civOf(terms.loser), Wn = civOf(terms.winner);
    L.overlord = Wn.id;
    for (const o of st.civs) if (o.overlord === L.id) o.overlord = Wn.id;
    msg += `: ${L.displayName} becomes a vassal of ${Wn.displayName}.`;
  } else if (terms.type === 'goal' && w.goal && G.plays) {
    // the war goal is enforced for the attacking side
    const att = w.att.includes(terms.winner) ? terms.winner : terms.loser;
    const def = att === terms.winner ? terms.loser : terms.winner;
    msg += ': ' + G.plays.enforceGoal(w.goal, att, def) + '.';
  } else if (terms.type === 'provinces') msg += taken.length ? `: ${civOf(terms.winner).displayName} takes ${taken.join(', ')}.` : '.';
  else msg += ' in a white peace.';
  const p = st.playerId;
  const involved = w.att.includes(p) || w.def.includes(p);
  for (const c of [...w.att, ...w.def]) { civOf(c).history.push({ day: st.day, text: msg }); civOf(c).lastWarDay = st.day; }
  log(msg, { civ: involved ? p : w.att[0], type: involved ? 'good' : 'world', toast: true });
}

export function warSummary(w) {
  return { att: w.att.map(civOf), def: w.def.map(civOf) };
}

// ---------------- Monthly / yearly ----------------
export function diplomacyMonthly() {
  const st = S();
  const alive = st.civs.filter((c) => c.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i].id, b = alive[j].id;
      const r = rel(a, b);
      const target = opinionBreakdown(a, b).reduce((s, [, v]) => s + v, 0);
      r.op += (target - r.op) * 0.15;
      r.gift *= 0.93; r.grudge *= 0.97;
      if (r.trade) {
        if (!canTrade(a, b)) { r.trade = false; continue; }
        const inc = tradeIncome(a, b);
        alive[i].treasury += inc; alive[j].treasury += inc;
        alive[i].last.trade = (alive[i].last.trade || 0) + inc;
        alive[j].last.trade = (alive[j].last.trade || 0) + inc;
      }
    }
  }
  // Vassal tribute
  for (const c of alive) {
    if (c.overlord >= 0) {
      const O = civOf(c.overlord);
      if (!O.alive) { c.overlord = -1; continue; }
      const t = Math.max(0, (c.last?.tax || 0) * 0.25);
      c.treasury -= t; O.treasury += t;
      c.last.tribute = -t; O.last.tribute = (O.last.tribute || 0) + t;
    }
  }
  for (const c of alive) c.ae = (c.ae || 0) * 0.985;
  // Wars: cleanup, exhaustion, AI peace
  for (const w of [...st.wars]) {
    if (w.civil) { w.exhA += 0.8; w.exhD += 0.8; continue; }
    w.att = w.att.filter((c) => civOf(c).alive);
    w.def = w.def.filter((c) => civOf(c).alive);
    if (!w.att.length || !w.def.length) {
      st.wars = st.wars.filter((x) => x !== w);
      log(`${w.name} ends as one side has fallen.`, { civ: w.att[0] ?? w.def[0] ?? -1, type: 'world' });
      continue;
    }
    w.exhA += 0.8; w.exhD += 0.8;
    aiPeace(w);
  }
  st.offers = st.offers.filter((o) => st.day - o.day < 90 && civOf(o.from).alive);
}

function aiPeace(w) {
  const st = S();
  const la = civOf(w.att[0]), ld = civOf(w.def[0]);
  const months = (st.day - w.start) / 30;
  if (months < 6) return;
  for (const [me, other, side] of [[la, ld, 'att'], [ld, la, 'def']]) {
    if (me.isPlayer || !st.wars.includes(w)) continue;
    const myScore = side === 'att' ? w.score : -w.score;
    const exh = side === 'att' ? w.exhA : w.exhD;
    if (!G.rng.chance(0.25)) continue;
    let type = null, amount = 0;
    const prov = myScore >= 10 ? provincesFor(w, side, myScore + exh * 0.4) : { setts: [] };
    let setts = null;
    if (prov.setts.length && (myScore >= 25 || !w.goal)) { type = 'peace_provinces'; setts = prov.setts; }
    else if (side === 'att' && w.goal && myScore >= 40) type = 'peace_goal';
    else if (myScore >= 70) type = 'peace_vassal';
    else if (myScore >= 30) { type = 'peace_gold'; amount = Math.round(Math.max(50, other.treasury * 0.5)); }
    else if (exh > 25 || myScore < -15) type = 'peace_white';
    if (!type) continue;
    if (other.isPlayer) { addOffer(me.id, other.id, type, { war: w, amount, setts }); continue; }
    const ev = evaluate(me.id, other.id, type, { war: w, amount, setts });
    if (ev.accept) { acceptPeace(w, me.id, type, amount, setts); return; }
  }
}

export function diplomacyYearly(civ) {
  if (!civ.alive) return;
  const st = S();
  const rng = G.rng;
  // Rivals: a neighbour of comparable strength we dislike most
  {
    const mine = militaryStrength(civ.id);
    let best = null, bv = Infinity;
    for (const c of civ.contacts) {
      const o = civOf(c);
      if (!o.alive || allied(civ.id, c) || vassalPair(civ.id, c)) continue;
      const ratio = militaryStrength(c) / Math.max(1, mine);
      if (ratio < 0.5 || ratio > 2) continue;
      const op = opinion(civ.id, c);
      if (op < bv) { bv = op; best = c; }
    }
    if (best !== civ.rival && best !== null && bv < 0) {
      civ.rival = best;
      if (civ.isPlayer || civOf(best).isPlayer) log(`${civ.displayName} now regards ${civOf(best).displayName} as its rival.`, { civ: st.playerId, type: 'info' });
    }
    if (civ.rival != null && !civOf(civ.rival).alive) civ.rival = null;
  }
  if (civ.isPlayer || civ.rebel) return;
  const P = civ.personality;
  // Coalitions against a dangerous conqueror
  for (const c of civ.contacts) {
    const t = dominantThreat(civ.id, c);
    if (t !== null && !allied(civ.id, c) && !atWar(civ.id, c) && c !== t && opinion(civ.id, c) > -10 && rng.chance(0.3)) propose(civ.id, c, 'alliance');
  }
  for (const c of civ.contacts) {
    const o = civOf(c);
    if (!o.alive) continue;
    const r = rel(civ.id, c);
    if (!r.trade && canTrade(civ.id, c) && opinion(civ.id, c) > -15 && rng.chance(0.4)) propose(civ.id, c, 'trade');
    if (!r.ally && opinion(civ.id, c) > 22 && rng.chance(0.25) && !atWar(civ.id, c)) propose(civ.id, c, 'alliance');
    if (r.ally && opinion(civ.id, c) < -5) breakAlliance(civ.id, c);
  }
  // Vassals seek independence
  if (civ.overlord >= 0) {
    const ratio = militaryStrength(civ.id) / Math.max(1, militaryStrength(civ.overlord));
    if (opinion(civ.id, civ.overlord) < -20 && ratio > 0.9 && rng.chance(0.3)) declareWar(civ.id, civ.overlord);
    return;
  }
  // War declarations (Phase 15: objective-driven, see warplans.js)
  aiWarYearly(civ);
  if (true) return;
  if (warsOf(civ.id).some((w) => w.att[0] === civ.id) || civ.stability < 32) return;
  if (G.plays && G.plays.playsOf(civ.id).some((p) => p.att === civ.id)) return; // one crisis at a time
  if (st.day < 360 * 20) return; // early tribal peace
  const aggr = { militaristic: 0.5, expansionist: 0.4, trader: 0.1, defensive: 0.06, diplomatic: 0.06, isolationist: 0.04 }[P] ?? 0.06;
  let best = null, bv = 0;
  const mine = coalitionStrength(civ.id);
  for (const c of new Set([...civ.contacts, ...(civ.seaContacts || [])])) {
    if (!canDeclareWar(civ.id, c).ok) continue;
    if (civOf(c).isPlayer && st.day < 360 * 35) continue; // grace period for the player
    const theirs = coalitionStrength(c);
    const ratio = mine / Math.max(1, theirs);
    const op = opinion(civ.id, c);
    if (ratio < 1.2 || op > 20) continue;
    const v = (ratio - 1) * (1 - op / 100) * (civ.rival === c ? 1.6 : 1) * (civOf(c).rebel ? 0 : 1);
    if (v > bv) { bv = v; best = c; }
  }
  if (best !== null && rng.chance(Math.min(0.7, aggr * bv)) && G.plays) G.plays.startPlay(civ.id, best, G.plays.aiDemand(civ.id, best));
  void st;
}
