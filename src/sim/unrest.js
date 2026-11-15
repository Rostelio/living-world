import { G, S, log, civOf } from './state.js';
import { RACES } from '../data/races.js';
import { UNITS } from '../data/military.js';
import { clamp } from '../core/util.js';
import { lvl, transferSettlement, setCapital } from './settlements.js';
import { makeRuler, realmName, changeGovernment, rulerFullName, defaultLaw } from './government.js';
import { warsOf, rel } from './diplomacy.js';
import { createArmy, armyCount, besiegedSet, armyTiles } from './military.js';
import { blockadedSet } from './naval.js';
import { religionUnrest } from './culture.js';
import { invalidateMods, mods } from './mods.js';
import { realmName as genRealmName } from '../core/names.js';
import { createCiv } from './setup.js';

const W = () => G.world;
const dist = (a, b) => Math.hypot((a % W().w) - (b % W().w), ((a / W().w) | 0) - ((b / W().w) | 0));

// ---------------- Unrest ----------------
export function unrestBreakdown(civ, s) {
  const st = S();
  const items = [];
  if (civ.stability < 45) items.push(['Low national stability', (45 - civ.stability) * 1.2]);
  if (civ.taxRate > 0.2) items.push(['Heavy taxation', (civ.taxRate - 0.2) * 120]);
  for (const it of religionUnrest(civ, s)) items.push(it);
  if (s.sol != null) {
    if (s.sol < 5) items.push([`Poor living standards (${s.sol.toFixed(1)})`, (5 - s.sol) * 5]);
    else if (s.sol > 6.5) items.push([`Prosperity (${s.sol.toFixed(1)})`, -(s.sol - 6.5) * 3]);
  }
  if (s.foodSat != null && s.foodSat < 0.8) items.push(['Hunger', (0.8 - s.foodSat) * 40]);
  if (s.conquered != null && st.day - s.conquered < 3600) items.push(['Recently conquered', 22 * (1 - (st.day - s.conquered) / 3600)]);
  let exh = 0;
  for (const w of warsOf(civ.id)) exh = Math.max(exh, w.att.includes(civ.id) ? w.exhA : w.exhD);
  if (exh > 5) items.push(['War exhaustion', Math.min(15, exh * 0.3)]);
  const cap = st.settlements[civ.capital];
  if (cap && cap.id !== s.id) {
    const d = dist(cap.tile, s.tile);
    if (d > 35) items.push(['Distance from the capital', Math.min(15, (d - 35) * 0.4)]);
  }
  // Phase 14: sprawling realms are hard to hold together
  const reach = (mods(civ).admin || 3) * 1.6 + 4;
  if (civ.settlements.length > reach) items.push(['Sprawling realm', Math.min(14, (civ.settlements.length - reach) * 0.7)]);
  if (civ.regencyUntil > st.day) items.push(['Regency', 5]);
  if (civ.last?.starving) items.push(['Famine', 15]);
  if (besiegedSet().has(s.id)) items.push(['Under siege', 10]);
  if (blockadedSet().has(s.id)) items.push(['Naval blockade', 6]);
  const temple = lvl(s, 'temple') * 4 + lvl(s, 'town_hall') * 3 + lvl(s, 'castle') * 5 + lvl(s, 'brewery') * 2;
  if (temple) items.push(['Temples, halls & castles', -temple]);
  if (armyTiles(civ.id).has(s.tile)) items.push(['Garrisoned army', -12]);
  if (s.isCapital) items.push(['Seat of power', -10]);
  const target = clamp(items.reduce((a, [, v]) => a + v, 0), 0, 100);
  return { items: items.map(([l, v]) => [l, Math.round(v)]), target };
}

export function unrestMonthly(civ) {
  const st = S();
  for (const id of [...civ.settlements]) {
    const s = st.settlements[id];
    const { target } = unrestBreakdown(civ, s);
    s.unrest = (s.unrest || 0) + (target - (s.unrest || 0)) * 0.15;
  }
  if (civ.rebel) return;
  if (st.wars.some((w) => w.civil && w.civil.parent === civ.id)) return; // one civil war at a time
  if ((civ.civilCooldown || 0) > st.day) return; // exhausted by recent strife
  // Local revolts
  for (const id of civ.settlements) {
    const s = st.settlements[id];
    if (s.isCapital || s.unrest < 65) continue;
    if (G.rng.chance((s.unrest - 65) / 160)) {
      const group = civ.settlements.map((x) => st.settlements[x]).filter((o) => o !== s && !o.isCapital && o.unrest > 45 && (dist(o.tile, s.tile) < 25 || (s.culture !== civ.race && o.culture === s.culture)));
      startCivilWar(civ, 'separatist', null, [s, ...group.slice(0, 3)]);
      return;
    }
  }
  // National collapse into civil war
  if (civ.stability < 15) civ.lowStab = (civ.lowStab || 0) + 1; else civ.lowStab = 0;
  if (civ.lowStab >= 6 && civ.settlements.length >= 3 && G.rng.chance(0.35)) {
    civ.lowStab = 0;
    startCivilWar(civ, 'revolution');
  }
}

// ---------------- Civil wars ----------------
function pickColor(parent) {
  const st = S();
  const used = new Set(st.civs.filter((c) => c.alive).map((c) => c.color.toLowerCase()));
  const pal = ['#d94a3d', '#3d7fd9', '#e6b422', '#9b59b6', '#2fbf71', '#e67e22', '#17a2b8', '#e84393', '#8d6e63', '#c0ca33', '#5c6bc0', '#ef5350', '#26a69a', '#ab47bc', '#ffa726', '#78909c', '#d4e157', '#8e24aa', '#00897b', '#f06292'];
  for (const c of pal) if (!used.has(c)) return c;
  void parent;
  return pal[G.rng.int(0, pal.length - 1)];
}

export function startCivilWar(parent, type, claimant = null, setts = null) {
  const st = S();
  if (!parent.alive || parent.settlements.length < 2) return null;
  if (st.wars.some((w) => w.civil && w.civil.parent === parent.id)) return null;
  const own = parent.settlements.map((id) => st.settlements[id]).filter((s) => !s.isCapital);
  if (!setts) {
    own.sort((a, b) => (b.unrest || 0) - (a.unrest || 0));
    setts = own.slice(0, Math.max(1, Math.round(parent.settlements.length * 0.4)));
  }
  setts = setts.filter((s) => s && !s.isCapital && s.civ === parent.id);
  if (!setts.length) return null;
  const race = type === 'separatist' ? (setts[0].culture || parent.race) : parent.race;
  const id = st.civs.length;
  const baseName = type === 'separatist' ? genRealmName(race, G.rng) : parent.baseName;
  const civ = createCiv(id, race, { name: baseName, color: pickColor(parent) });
  civ.baseName = baseName;
  civ.rebel = { type, parent: parent.id };
  civ.techs = [...parent.techs];
  civ.era = parent.era;
  civ.gov = type === 'revolution' ? (parent.gov === 'republic' ? 'dictatorship' : 'republic') : parent.gov === 'empire' ? 'monarchy' : parent.gov;
  civ.law = defaultLaw(civ.gov);
  civ.personality = type === 'separatist' ? 'defensive' : type === 'revolution' ? 'militaristic' : 'expansionist';
  civ.faith = type === 'separatist' ? (setts[0].faith || civ.faith) : parent.faith;
  civ.tolerance = parent.tolerance || 'tolerant'; civ.accepted = []; civ.cabinet = []; civ.candidates = [];
  civ.ruler = claimant ? makeRuler(civ, claimant) : makeRuler(civ, { age: G.rng.int(28, 50) });
  civ.family = [];
  civ.stability = 60;
  civ.capital = -1;
  civ.displayName = realmName(civ);
  st.civs.push(civ);
  let pop = 0, ppop = 0;
  for (const pid of parent.settlements) ppop += st.settlements[pid].pop;
  for (const s of setts) pop += s.pop;
  const share = Math.min(0.6, pop / Math.max(1, ppop));
  const gold = Math.max(0, parent.treasury * share * 0.6);
  parent.treasury -= gold; civ.treasury = gold + 50;
  for (const k in civ.stock) civ.stock[k] = Math.round((parent.stock[k] || 0) * share * 0.5);
  for (const s of setts) {
    transferSettlement(s, civ);
    s.unrest = 15;
    // Rebels take up arms
    const regs = Math.max(1, Math.min(14, Math.round(s.pop / 70)));
    const a = createArmy(civ, s.tile, s.id);
    const best = civ.techs.includes('gunpowder') ? 'musketeers' : 'infantry';
    a.units[best] = Math.round(regs * 0.7 * 10) / 10;
    a.units.archers = Math.round(regs * 0.3 * 10) / 10;
    s.pop -= regs * UNITS.infantry.men * 0.4;
  }
  civ.contacts = [parent.id];
  if (!parent.contacts.includes(civ.id)) parent.contacts.push(civ.id);
  const names = {
    separatist: `${civ.baseName} War of Independence`,
    revolution: `${parent.baseName} Revolution`,
    claimant: `War of the ${parent.baseName} Succession`,
  };
  const w = { id: st.nextWarId++, name: names[type], att: [civ.id], def: [parent.id], start: st.day, score: 0, exhA: 0, exhD: 0, battles: 0, civil: { type, parent: parent.id, rebel: civ.id } };
  st.wars.push(w);
  rel(civ.id, parent.id).grudge += 40;
  const why = { separatist: `${setts.map((s) => s.name).join(', ')} rise${setts.length === 1 ? 's' : ''} in revolt and declare${setts.length === 1 ? 's' : ''} independence as ${civ.displayName}!`, revolution: `REVOLUTION! Rebels seize ${setts.length} settlements of ${parent.displayName}, demanding a new order.`, claimant: `${rulerFullName(civ)} claims the throne of ${parent.displayName}! Civil war erupts.` };
  const msg = why[type];
  parent.history.push({ day: st.day, text: msg });
  civ.history.push({ day: st.day, text: msg });
  log(msg, { civ: parent.id, type: parent.isPlayer ? 'bad' : 'world', toast: true, tile: setts[0].tile });
  G.dirty.owners = true;
  return civ;
}

// Fold a rebel faction back into its parent nation.
function absorb(R, P, keepArmies) {
  const st = S();
  for (const id of [...R.settlements]) transferSettlement(st.settlements[id], P);
  for (const a of st.armies) if (a.civ === R.id) { if (keepArmies) a.civ = P.id; else a.units = {}; }
  st.armies = st.armies.filter((a) => armyCount(a) > 0.05);
  R.alive = false;
  st.wars = st.wars.filter((w) => !(w.civil && w.civil.rebel === R.id));
  for (const w of st.wars) { w.att = w.att.filter((c) => c !== R.id); w.def = w.def.filter((c) => c !== R.id); }
  st.offers = st.offers.filter((o) => o.from !== R.id);
  for (const id of P.settlements) st.settlements[id].unrest = Math.min(st.settlements[id].unrest || 0, 30);
  G.dirty.owners = true;
}

export function rebelsWin(w) {
  const st = S();
  const R = civOf(w.civil.rebel), P = civOf(w.civil.parent);
  P.civilCooldown = st.day + 360 * 15;
  P.lowStab = 0;
  let msg;
  if (w.civil.type === 'separatist' || !P.alive) {
    st.wars = st.wars.filter((x) => x !== w);
    for (const a of w.att) for (const d of w.def) rel(a, d).truce = st.day + 3600;
    R.rebel = null;
    R.displayName = realmName(R);
    msg = `${R.displayName} wins its independence from ${P.displayName}.`;
  } else if (w.civil.type === 'revolution') {
    const oldName = P.displayName;
    P.ruler = R.ruler; P.family = [];
    changeGovernment(P, R.gov);
    P.stability = 40;
    absorb(R, P, true);
    msg = `The revolution triumphs! ${oldName} falls; ${rulerFullName(P)} now leads the ${P.displayName}.`;
  } else {
    const oldRuler = rulerFullName(P);
    P.ruler = R.ruler; P.family = [];
    P.dynasties ??= [];
    P.dynasties.push({ name: P.ruler.dynasty, from: st.day, to: null });
    P.stability = 45;
    absorb(R, P, true);
    msg = `${oldRuler} is deposed. ${rulerFullName(P)} takes the throne of ${P.displayName}.`;
  }
  invalidateMods(P);
  P.history.push({ day: st.day, text: msg });
  log(msg, { civ: P.id, type: P.isPlayer ? 'bad' : 'world', toast: true });
}

export function loyalistsWin(w) {
  const st = S();
  const R = civOf(w.civil.rebel), P = civOf(w.civil.parent);
  absorb(R, P, false);
  P.stability = Math.min(100, Math.max(35, P.stability + 10));
  P.civilCooldown = st.day + 360 * 15;
  P.lowStab = 0;
  for (const id of P.settlements) { const s = st.settlements[id]; if (s.culture !== P.race) s.unrest = 20; }
  const msg = `${w.name} ends: the rebellion of ${R.displayName} is crushed and order restored in ${P.displayName}.`;
  P.history.push({ day: st.day, text: msg });
  log(msg, { civ: P.id, type: P.isPlayer ? 'good' : 'world', toast: true });
}

export function civilWarsMonthly() {
  const st = S();
  for (const w of st.wars.filter((x) => x.civil)) {
    const R = civOf(w.civil.rebel), P = civOf(w.civil.parent);
    const months = (st.day - w.start) / 30;
    if (!R.alive || !R.settlements.length) { loyalistsWin(w); continue; }
    if (!P.alive || !P.settlements.length) { rebelsWin(w); continue; }
    const score = w.score; // rebels attack, so positive favours rebels
    if (score >= 60) rebelsWin(w);
    else if (score <= -50) loyalistsWin(w);
    else if (!P.isPlayer && months > 18 && score >= 30 && G.rng.chance(0.15)) rebelsWin(w);
    else if (months > 120) {
      if (w.civil.type === 'separatist') rebelsWin(w);
      else if (score > 0) rebelsWin(w); else loyalistsWin(w);
    }
  }
}

// Player concedes a civil war.
export function concede(w) { if (w?.civil) rebelsWin(w); }
void setCapital;
