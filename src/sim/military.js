import { traitFx } from '../world/regions.js';
import { occupy, liberate, isOccupied, crossingPenalty, fortDefense, attritionOf, commanderFate } from './warfare.js';
import { lawHook } from './politics.js';
import { G, S, log, civOf } from './state.js';
import { UNITS, UNIT_LIST, GENERAL_TRAITS, GENERAL_TRAIT_LIST, TERRAIN_DEF, ROUGH, WOODS } from '../data/military.js';
import { BIOMES } from '../data/biomes.js';
import { RACES } from '../data/races.js';
import { PERSONALITIES } from '../data/governments.js';
import { findPath, roadMask } from './pathfind.js';
import { mods } from './mods.js';
import { personName } from '../core/names.js';
import { clamp } from '../core/util.js';
import { canAfford, pay, lvl, transferSettlement, wantGoods } from './settlements.js';
import { atWar, mayEnter, enemiesOf, warBetween, sideOf, addWarScore, armyPower, warsOf, allied } from './diplomacy.js';
import { canSail, portProvinces, interceptor, fleetPower, blockadedSet } from './naval.js';

const ORD = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const armyCount = (a) => { let n = 0; for (const k in a.units) n += a.units[k]; return n; };
export const armyById = (id) => S().armies.find((a) => a.id === id);

// Settlements under active siege / tiles holding armies, cached per simulation day.
export function besiegedSet() {
  const c = G.cache || (G.cache = {});
  if (!c.besieged || c.besiegedDay !== S().day) {
    c.besieged = new Set();
    c.besiegedDay = S().day;
    for (const a of S().armies) if (a.siege && !a.siege.blocked) c.besieged.add(a.siege.s);
  }
  return c.besieged;
}
export function armyTiles(civId) {
  const c = G.cache || (G.cache = {});
  if (!c.armyTiles || c.armyTilesDay !== S().day) {
    c.armyTiles = new Map();
    c.armyTilesDay = S().day;
    for (const a of S().armies) {
      if (!c.armyTiles.has(a.civ)) c.armyTiles.set(a.civ, new Set());
      c.armyTiles.get(a.civ).add(a.tile);
    }
  }
  return c.armyTiles.get(civId) || new Set();
}
const W = () => G.world;
const tx = (t) => t % W().w, ty = (t) => (t / W().w) | 0;
const manhattan = (a, b) => Math.abs(tx(a) - tx(b)) + Math.abs(ty(a) - ty(b));

// ---------------- Generals ----------------
export function makeGeneral(civ) {
  const rng = G.rng;
  const gender = rng.chance(0.5) ? 'm' : 'f';
  return { name: personName(civ.race, gender, rng), gender, skill: rng.int(1, 3) + (rng.chance(0.25) ? 1 : 0) + (rng.chance(0.08) ? 1 : 0), trait: rng.pick(GENERAL_TRAIT_LIST) };
}
export const generalCost = (civ) => 40 + civ.settlements.length * 5;
export function replaceGeneral(army) {
  const civ = civOf(army.civ);
  const cost = generalCost(civ);
  if (civ.treasury < cost) return { ok: false, reason: 'Not enough gold' };
  civ.treasury -= cost;
  army.general = makeGeneral(civ);
  return { ok: true };
}

// ---------------- Recruitment ----------------
export function unitCost(civ, s, type) {
  const U = UNITS[type];
  const f = (1 - 0.1 * lvl(s, 'barracks')) * (civ.laws ? lawHook(civ, 'recruit') : 1);
  const c = {};
  for (const k in U.cost) c[k] = Math.ceil(U.cost[k] * f);
  return c;
}
export function unitAvailable(civ, type) {
  const U = UNITS[type];
  if (U.race && U.race !== civ.race) return false;
  if (U.tech && !civ.techs.includes(U.tech)) return false;
  return true;
}
export function canRecruit(civ, s, type) {
  const U = UNITS[type];
  if (!unitAvailable(civ, type)) return { ok: false, reason: 'Requires technology', hidden: true };
  if (s.stage < 1) return { ok: false, reason: 'Requires a Village' };
  if (U.barracks && !lvl(s, 'barracks')) return { ok: false, reason: 'Requires Barracks' };
  if (s.pop - U.men < 30) return { ok: false, reason: 'Not enough people' };
  const cost = unitCost(civ, s, type);
  if (!canAfford(civ, cost)) return { ok: false, reason: 'Not enough resources', cost };
  return { ok: true, cost };
}

export function createArmy(civ, tile, home) {
  const st = S();
  civ.armyNo = (civ.armyNo || 0) + 1;
  const a = {
    id: st.nextArmyId++, civ: civ.id, name: `${ORD(civ.armyNo)} Army`, tile, pt: tile, home,
    units: {}, general: makeGeneral(civ), morale: 1, path: [], step: 0, mp: 0, battle: -1, siege: null, occ: null, ai: { next: 0 }, stance: 'balanced',
  };
  st.armies.push(a);
  return a;
}

export function recruit(civ, s, type, into = null) {
  const r = canRecruit(civ, s, type);
  if (!r.ok) return r;
  pay(civ, r.cost);
  s.pop -= UNITS[type].men;
  let army = into || S().armies.find((a) => a.civ === civ.id && a.tile === s.tile && a.battle < 0 && !a.path.length);
  if (!army) army = createArmy(civ, s.tile, s.id);
  army.units[type] = (army.units[type] || 0) + 1;
  return { ok: true, army };
}

export function mergeArmies(a, b) {
  if (a === b || a.civ !== b.civ || a.battle >= 0 || b.battle >= 0) return false;
  const na = armyCount(a), nb = armyCount(b);
  for (const k in b.units) a.units[k] = (a.units[k] || 0) + b.units[k];
  a.morale = (a.morale * na + b.morale * nb) / Math.max(0.01, na + nb);
  if (b.general.skill > a.general.skill) a.general = b.general;
  S().armies = S().armies.filter((x) => x !== b);
  return true;
}
export function splitArmy(a) {
  if (a.battle >= 0 || armyCount(a) < 2) return null;
  const civ = civOf(a.civ);
  const b = createArmy(civ, a.tile, a.home);
  for (const k in a.units) { const h = Math.floor(a.units[k] / 2 * 10) / 10; b.units[k] = h; a.units[k] -= h; }
  b.morale = a.morale;
  return b;
}
export function disbandArmy(a) {
  const st = S();
  const civ = civOf(a.civ);
  let men = 0;
  for (const k in a.units) men += a.units[k] * UNITS[k].men * 0.8;
  const home = nearestOwnSettlement(civ, a.tile);
  if (home) home.pop += men;
  st.armies = st.armies.filter((x) => x !== a);
}

export function armyUpkeep(civ) {
  let g = 0;
  for (const a of S().armies) if (a.civ === civ.id && !a.merc) for (const k in a.units) g += a.units[k] * UNITS[k].upkeep;
  return g * (civ.laws ? lawHook(civ, 'upkeep') : 1);
}

// ---------------- Movement ----------------
export function canStand(civId, tile) {
  const p = W().province[tile];
  if (p < 0) return true; // open sea
  return mayEnter(civId, S().provinces[p].owner);
}
export const atSea = (a) => BIOMES[W().biome[a.tile]].water;
export function armySpeed(a) {
  let sp = 9;
  for (const k in a.units) if (a.units[k] > 0.05) sp = Math.min(sp, UNITS[k].speed);
  if (sp === 9) sp = 1;
  if (a.general.trait === 'logistician') sp *= 1.25;
  return sp * 1.25;
}
export function orderMove(a, tile, free = false) {
  if (a.battle >= 0) return { ok: false, reason: 'Engaged in battle' };
  if (tile === a.tile) { a.path = []; return { ok: true }; }
  if (BIOMES[W().biome[tile]].water) return { ok: false, reason: 'Armies cannot stop at sea — pick a coast' };
  const civId = a.civ;
  const civ = civOf(civId);
  const canEnter = free ? null : (t) => canStand(civId, t);
  const sameLand = W().landmass[a.tile] === W().landmass[tile];
  let path = sameLand ? findPath(a.tile, tile, { canEnter, roads: roadMask(), maxNodes: 50000 }) : null;
  if (!path && canSail(civ)) {
    path = findPath(a.tile, tile, { mode: 'amphibious', canEnter, roads: roadMask(), portProvinces: portProvinces(civ), maxNodes: 150000 });
  }
  if (!path) return { ok: false, reason: sameLand || canSail(civ) ? 'No route — blocked by closed borders' : 'Overseas — research Sailing and build a Harbour to cross the sea' };
  a.path = path; a.step = 0; a.mp = 0; a.siege = null; a.occ = null;
  return { ok: true, naval: path.some((t) => BIOMES[W().biome[t]].water) };
}
function nearestOwnSettlement(civ, tile) {
  let best = null, bd = Infinity;
  const anyLand = W().landmass[tile] < 0 || canSail(civ);
  for (const id of civ.settlements) {
    const s = S().settlements[id];
    if (!anyLand && W().landmass[s.tile] !== W().landmass[tile]) continue;
    const d = manhattan(s.tile, tile);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function stepCost(t) {
  const b = BIOMES[W().biome[t]];
  if (b.water) return 0.5;
  const c = b.cost + (W().river[t] ? 0.5 : 0);
  return roadMask()[t] ? c * 0.4 : c;
}

// ---------------- Combat ----------------
function sidePower(army, enemy, isDefender, battle) {
  const civ = civOf(army.civ);
  const gen = army.general, tr = GENERAL_TRAITS[gen.trait] || {};
  const biome = W().biome[battle.tile];
  let attMul = (1 + gen.skill * 0.06 + (tr.att || 0)) * (1 + 0.08 * civ.era) * (RACES[civ.race].army ?? 1);
  let defMul = 1 + gen.skill * 0.04 + (tr.def || 0) + mods(civ).defense / 150;
  if (isDefender) defMul += (TERRAIN_DEF[biome] || 0) + fortDefense(army, battle.tile);
  else attMul *= crossingPenalty(army, battle.tile);
  if (army.stance === 'aggressive') { attMul *= 1.15; defMul *= 0.9; }
  else if (army.stance === 'defensive') { attMul *= 0.88; defMul *= 1.2; }
  const skirmish = battle.day < 3;
  const eCav = enemy ? (enemy.units.cavalry || 0) + (enemy.units.knights || 0) : 0;
  const eCount = enemy ? armyCount(enemy) : 1;
  let att = 0, def = 0, count = 0;
  for (const k in army.units) {
    const n = army.units[k];
    if (n <= 0) continue;
    const U = UNITS[k];
    let a = U.att;
    if (U.cls === 'cav') { if (ROUGH.has(biome)) a *= 0.6; else if (eCav / Math.max(0.1, eCount) < 0.2) a *= 1.15; }
    if (U.cls === 'rng') { if (battle.day < 3) a *= 1.5; if (WOODS.has(biome)) a *= k === 'rangers' ? 1.4 : 1.2; }
    if (U.cls === 'sie') a *= 0.5;
    if (skirmish && U.cls !== 'rng' && U.cls !== 'sie') a *= 0.5; // lines close in during the skirmish phase
    att += n * a; def += n * U.def; count += n;
  }
  const mf = 0.5 + 0.5 * army.morale;
  return { att: att * attMul * mf, avgDef: (def / Math.max(0.01, count)) * defMul, count };
}

function applyCasualties(army, cas) {
  const n = armyCount(army);
  if (n <= 0 || cas <= 0) return 0;
  let wsum = 0;
  for (const k in army.units) wsum += army.units[k] * (UNITS[k].cls === 'sie' ? 1.5 : 1);
  let lost = 0;
  for (const k in army.units) {
    const share = (army.units[k] * (UNITS[k].cls === 'sie' ? 1.5 : 1)) / wsum;
    const l = Math.min(army.units[k], cas * share);
    army.units[k] -= l; lost += l;
    if (army.units[k] < 0.02) delete army.units[k];
  }
  return lost;
}

function startBattle(x, y) {
  const st = S();
  // defender: the stationary one, or the one on its own soil
  const own = (a) => S().provinces[W().province[a.tile]]?.owner === a.civ;
  let att = x, def = y;
  if ((x.path.length === 0 && y.path.length > 0) || (own(x) && !own(y))) { att = y; def = x; }
  const b = { id: st.nextBattleId++, a: att.id, d: def.id, ac: att.civ, dc: def.civ, tile: def.tile, day: 0, lossA: 0, lossD: 0, startA: armyCount(att), startD: armyCount(def), ended: false, endDay: 0, winner: -1, phase: 'Skirmish', hist: [] };
  st.battles.push(b);
  for (const a of [att, def]) { a.battle = b.id; a.path = []; }
  // AI commanders choose a stance from the odds
  const pa = armyPower(att), pd = armyPower(def);
  for (const [me, r] of [[att, pa / Math.max(0.1, pd)], [def, pd / Math.max(0.1, pa)]]) {
    if (civOf(me.civ).isPlayer) continue;
    me.stance = r > 1.3 ? 'aggressive' : r < 0.8 ? 'defensive' : 'balanced';
  }
  // Phase 17: what each side brought to the field (for the battle report)
  const comp = (a) => { const o = {}; for (const k in a.units) if (a.units[k] > 0.05) o[k] = Math.round(a.units[k] * 10) / 10; return o; };
  const gen = (a) => ({ name: a.general?.name || '—', skill: a.general?.skill || 1, trait: a.general?.trait || null, hero: !!a.general?.hero });
  b.info = { gA: gen(att), gD: gen(def), compA: comp(att), compD: comp(def), stanceA: att.stance, stanceD: def.stance, biome: W().biome[b.tile],
    fort: Math.round(fortDefense(def, b.tile) * 100) / 100, cross: Math.round(crossingPenalty(att, b.tile) * 100) / 100, eraA: civOf(att.civ).era, eraD: civOf(def.civ).era, moraleA: Math.round(att.morale * 100) / 100, moraleD: Math.round(def.morale * 100) / 100 };
  const p = st.playerId;
  if (att.civ === p || def.civ === p) log(`Battle joined at ${W().provinces[W().province[b.tile]]?.name || 'the wilds'}!`, { civ: p, type: 'bad', toast: true, tile: b.tile });
}

export const battleOf = (a) => S().battles.find((b) => b.id === a.battle);

// Player order: break off the fight, taking extra losses.
export function withdraw(army) {
  const b = battleOf(army);
  if (!b || b.ended) return { ok: false };
  applyCasualties(army, armyCount(army) * 0.08);
  endBattle(b, army.id);
  return { ok: true };
}

function moraleLoss(army, cas) {
  const n = Math.max(0.1, armyCount(army) + cas);
  const tr = GENERAL_TRAITS[army.general.trait] || {};
  let resist = tr.morale || 0;
  const bers = (army.units.berserkers || 0) / n;
  resist += bers * 0.3;
  return ((cas / n) * 2.4 + 0.012) * (1 - resist);
}

function battleDay(b) {
  const A = armyById(b.a), D = armyById(b.d);
  if (!A || !D) { endBattle(b, A ? D?.id ?? -1 : b.a); return; }
  const pa = sidePower(A, D, false, b), pd = sidePower(D, A, true, b);
  const rng = G.rng;
  const casD = (0.055 * pa.att) / Math.max(0.5, pd.avgDef) * rng.float(0.85, 1.15);
  const casA = (0.055 * pd.att) / Math.max(0.5, pa.avgDef) * rng.float(0.85, 1.15);
  const lD = applyCasualties(D, casD), lA = applyCasualties(A, casA);
  b.lossA += lA; b.lossD += lD;
  A.morale -= moraleLoss(A, lA) * (A.stance === 'aggressive' ? 1.1 : 1);
  D.morale -= moraleLoss(D, lD) * (D.stance === 'aggressive' ? 1.1 : 1);
  b.day++;
  b.phase = b.day < 3 ? 'Skirmish' : 'Melee';
  b.hist.push([lA, lD]);
  if (b.hist.length > 45) b.hist.shift();
  const brokeA = A.morale < 0.22 || armyCount(A) < 0.35;
  const brokeD = D.morale < 0.22 || armyCount(D) < 0.35;
  if (brokeA || brokeD || b.day > 40) {
    let loser;
    if (brokeA && brokeD) loser = A.morale < D.morale ? A : D;
    else if (brokeA) loser = A; else if (brokeD) loser = D;
    else loser = A.morale < D.morale ? A : D;
    endBattle(b, loser.id);
  }
}

function endBattle(b, loserId) {
  const st = S();
  b.ended = true; b.endDay = st.day;
  const A = armyById(b.a), D = armyById(b.d);
  for (const a of [A, D]) if (a) a.battle = -1;
  const loser = loserId === b.a ? A : D;
  const winner = loserId === b.a ? D : A;
  b.winner = winner ? winner.civ : (loserId === b.a ? b.dc : b.ac);
  b.phase = 'Pursuit';
  // Pursuit: the victor's cavalry cuts down fleeing troops
  if (winner && loser) {
    let cav = 0;
    for (const k in winner.units) if (UNITS[k].cls === 'cav') cav += winner.units[k];
    const extra = applyCasualties(loser, Math.min(armyCount(loser) * 0.3, cav * 0.35));
    if (loserId === b.a) b.lossA += extra; else b.lossD += extra;
  }
  const w = warBetween(b.ac, b.dc);
  const lossW = loserId === b.a ? b.lossD : b.lossA, lossL = loserId === b.a ? b.lossA : b.lossD;
  if (w) {
    const side = sideOf(w, b.winner);
    if (side) addWarScore(w, side, clamp(3 + lossL * 1.2, 3, 22));
    w.exhA += (w.att.includes(b.ac) ? b.lossA : b.lossD) * 0.4;
    w.exhD += (w.def.includes(b.ac) ? b.lossA : b.lossD) * 0.4;
    w.battles++;
  }
  if (loser) commanderFate(loser, true);
  if (winner) commanderFate(winner, false);
  const W1 = civOf(b.winner), L1 = civOf(b.winner === b.ac ? b.dc : b.ac);
  const p = st.playerId;
  const involved = b.ac === p || b.dc === p;
  const place = W().provinces[W().province[b.tile]]?.name || 'the wilds';
  const destroyed = loser && armyCount(loser) < 0.35;
  if (involved || b.startA + b.startD >= 8) log(`Battle of ${place}: ${W1.displayName} defeats ${L1.displayName}${destroyed ? ', annihilating their army' : ''}. Losses ${lossW.toFixed(1)} vs ${lossL.toFixed(1)} regiments.`,
    { civ: involved ? p : b.ac, type: involved ? (b.winner === p ? 'good' : 'bad') : 'world', toast: involved, tile: b.tile });
  if (b.info && (involved || b.startA + b.startD >= 8)) battleReport(b, A, D, loserId, place, !!destroyed);
  if (loser) {
    if (destroyed) st.armies = st.armies.filter((x) => x !== loser);
    else retreat(loser);
  }
}

// Phase 17: a short account of the battle — why it was won or lost
const TRAIT_WORD = { aggressive: 'a headlong attacker', cautious: 'a careful commander', tactician: 'a cunning tactician', inspiring: 'an inspiring leader', logistician: 'a fine quartermaster', siegemaster: 'a master of sieges', reckless: 'reckless' };
function battleReport(b, A, D, loserId, place, destroyed) {
  const st = S();
  const I = b.info;
  const attWon = loserId !== b.a;
  const side = (att) => civOf(att ? b.ac : b.dc).displayName;
  const poss = (n) => (n.endsWith('s') ? n + "'" : n + "'s");
  const f = []; // [weight, text, favours 'A'|'D']
  const ratio = b.startA / Math.max(0.1, b.startD);
  if (ratio > 1.3) f.push([Math.min(3, ratio), `${side(true)} brought ${ratio.toFixed(1)}× as many troops`, 'A']);
  else if (ratio < 0.77) f.push([Math.min(3, 1 / ratio), `${side(false)} had ${(1 / ratio).toFixed(1)}× as many troops`, 'D']);
  const sk = I.gA.skill - I.gD.skill;
  if (Math.abs(sk) >= 2) f.push([Math.abs(sk) * 0.6, `${sk > 0 ? I.gA.name : I.gD.name} out-generalled ${sk > 0 ? I.gD.name : I.gA.name} (skill ${Math.max(I.gA.skill, I.gD.skill)} vs ${Math.min(I.gA.skill, I.gD.skill)})`, sk > 0 ? 'A' : 'D']);
  for (const [g, who] of [[I.gA, 'A'], [I.gD, 'D']]) if (g.hero) f.push([1.5, `the legendary ${g.name} led ${who === 'A' ? side(true) : side(false)} in person`, who]);
  const td = TERRAIN_DEF[I.biome] || 0;
  if (td >= 0.12) f.push([td * 8, `the defenders held the ${BIOMES[I.biome].name.toLowerCase()} (+${Math.round(td * 100)}% defence)`, 'D']);
  if (I.fort > 0.05) f.push([I.fort * 6, `walls and a garrison sheltered the defenders (+${Math.round(I.fort * 100)}%)`, 'D']);
  if (I.cross < 0.95) f.push([(1 - I.cross) * 8, `the attackers had to cross a river under fire (−${Math.round((1 - I.cross) * 100)}% attack)`, 'D']);
  const cav = (c) => (c.cavalry || 0) + (c.knights || 0), rng = (c) => Object.entries(c).filter(([k]) => UNITS[k]?.cls === 'rng').reduce((s2, [, n]) => s2 + n, 0);
  if (ROUGH.has(I.biome) && cav(I.compA) > 1) f.push([1, `${poss(side(true))} cavalry floundered on rough ground`, 'D']);
  else if (!ROUGH.has(I.biome) && cav(I.compA) > cav(I.compD) + 1) f.push([1.1, `${poss(side(true))} cavalry rode down the enemy's flanks`, 'A']);
  else if (!ROUGH.has(I.biome) && cav(I.compD) > cav(I.compA) + 1) f.push([1.1, `${poss(side(false))} cavalry broke the attacking lines`, 'D']);
  if (WOODS.has(I.biome) && rng(I.compA) + rng(I.compD) > 1) f.push([0.8, `archers shot from the cover of the trees`, rng(I.compA) > rng(I.compD) ? 'A' : 'D']);
  if (I.eraA !== I.eraD) f.push([Math.abs(I.eraA - I.eraD) * 1.2, `${I.eraA > I.eraD ? side(true) : side(false)} fought with the weapons of a newer age`, I.eraA > I.eraD ? 'A' : 'D']);
  for (const [st2, who] of [[I.stanceA, 'A'], [I.stanceD, 'D']]) if (st2 === 'aggressive') f.push([0.5, `${who === 'A' ? side(true) : side(false)} attacked aggressively`, who]); else if (st2 === 'defensive') f.push([0.5, `${who === 'A' ? side(true) : side(false)} stood on the defensive`, who]);
  if (I.moraleA - I.moraleD > 0.2) f.push([1, `${poss(side(true))} troops marched in high spirits`, 'A']); else if (I.moraleD - I.moraleA > 0.2) f.push([1, `${poss(side(false))} troops were fresher and keener`, 'D']);
  const winSide = attWon ? 'A' : 'D';
  const decisive = f.filter((x) => x[2] === winSide).sort((x, y) => y[0] - x[0]).slice(0, 3).map((x) => x[1]);
  const against = f.filter((x) => x[2] !== winSide).sort((x, y) => y[0] - x[0]).slice(0, 2).map((x) => x[1]);
  const r = {
    id: b.id, day: st.day, place, tile: b.tile, ac: b.ac, dc: b.dc, winner: b.winner, days: b.day, destroyed,
    startA: Math.round(b.startA * 10) / 10, startD: Math.round(b.startD * 10) / 10, lossA: Math.round(b.lossA * 10) / 10, lossD: Math.round(b.lossD * 10) / 10,
    gA: I.gA, gD: I.gD, compA: I.compA, compD: I.compD, terrain: BIOMES[I.biome].name,
    why: decisive.length ? decisive : ['the fortunes of war'], despite: against,
    traits: [I.gA.trait && TRAIT_WORD[I.gA.trait] ? `${I.gA.name} was ${TRAIT_WORD[I.gA.trait]}` : null, I.gD.trait && TRAIT_WORD[I.gD.trait] ? `${I.gD.name} was ${TRAIT_WORD[I.gD.trait]}` : null].filter(Boolean),
  };
  st.battleReports ??= [];
  st.battleReports.push(r);
  if (st.battleReports.length > 30) st.battleReports.shift();
}

function retreat(a) {
  const civ = civOf(a.civ);
  const home = nearestOwnSettlement(civ, a.tile);
  a.siege = null; a.occ = null;
  let ok = false;
  if (home && home.tile !== a.tile) {
    ok = orderMove(a, home.tile).ok || orderMove(a, home.tile, true).ok;
  }
  if (!ok && atSea(a)) {
    // Nowhere to land: the army is lost at sea.
    if (civ.isPlayer) log(`${a.name} has nowhere to land and is lost at sea.`, { civ: civ.id, type: 'bad', toast: true });
    S().armies = S().armies.filter((x) => x !== a);
    return;
  }
  a.retreating = true;
  a.shield = S().day + 12; // disengaged while withdrawing
}

// ---------------- Sieges & occupation ----------------
export function garrisonOf(s) {
  return 1 + s.stage * 1.5 + lvl(s, 'barracks') * 2 + lvl(s, 'walls') * 1.5 + lvl(s, 'castle') * 4 + lvl(s, 'star_fort') * 6;
}
export function fortification(s) {
  return 1 + lvl(s, 'walls') * 1.2 + lvl(s, 'castle') * 1.5 + lvl(s, 'star_fort') * 2.5 + s.stage * 0.35 + (mods(civOf(s.civ)).defense + traitFx(W().provinces[s.province]).defense) / 40;
}
export function siegePhase(a) {
  if (!a.siege) return null;
  if (a.siege.blocked) return 'Blocked by the garrison';
  if ((a.siege.days || 0) > 60) return 'Starving the defenders';
  if (a.siege.progress > 50) return 'Walls breached';
  return 'Encircled';
}

// Storm the walls: a costly gamble to end a siege early.
export function assaultOdds(a) {
  const s = S().settlements[a.siege?.s];
  if (!s) return 0;
  const ratio = armyPower(a) / (garrisonOf(s) * 3 * fortification(s));
  return clamp(ratio * 0.35 + (a.siege.progress / 100) * 0.6, 0.02, 0.95);
}
export function assault(a) {
  const st = S();
  if (!a.siege || a.siege.blocked) return { ok: false, reason: 'Not besieging' };
  const s = st.settlements[a.siege.s];
  const odds = assaultOdds(a);
  const losses = garrisonOf(s) * fortification(s) * G.rng.float(0.2, 0.45);
  applyCasualties(a, Math.min(armyCount(a) * 0.6, losses));
  const civ = civOf(a.civ);
  if (G.rng.chance(odds) && armyCount(a) > 0.35) {
    captureSettlement(a, s);
    return { ok: true, success: true };
  }
  a.morale = Math.max(0, a.morale - 0.3);
  a.siege.progress = Math.max(0, a.siege.progress - 10);
  if (civ.isPlayer) log(`The assault on ${s.name} is thrown back with heavy losses.`, { civ: civ.id, type: 'bad', toast: true, tile: s.tile });
  return { ok: true, success: false };
}
export function siegePower(a) {
  let p = 0.3;
  for (const k in a.units) p += a.units[k] * UNITS[k].siege;
  if (a.general.trait === 'siegemaster') p *= 1.5;
  return p;
}

function siegeOrOccupy(a) {
  const st = S();
  const p = W().province[a.tile];
  if (p < 0) return;
  const ps = st.provinces[p];
  if (ps.settlement >= 0) {
    const s = st.settlements[ps.settlement];
    if (isOccupied(s)) {
      const ours = s.occ.by === a.civ || allied(s.occ.by, a.civ);
      if (ours) { a.siege = null; return; }
      if ((s.civ === a.civ || allied(s.civ, a.civ)) && atWar(a.civ, s.occ.by)) {
        a.lib = a.lib?.s === s.id ? a.lib : { s: s.id, days: 0 };
        if (++a.lib.days >= 15) {
          liberate(s); a.lib = null;
          const w = warBetween(a.civ, s.occ?.by ?? -1) || st.wars.find((x) => (x.att.includes(a.civ) || x.def.includes(a.civ)));
          if (w) addWarScore(w, sideOf(w, a.civ), s.isCapital ? 12 : 5);
          log(`${s.name} is liberated by ${civOf(a.civ).displayName}.`, { civ: s.civ === st.playerId || a.civ === st.playerId ? st.playerId : a.civ, type: 'good', tile: s.tile });
        }
        return;
      }
    }
  }
  if (ps.owner < 0 || !atWar(a.civ, ps.owner)) { a.siege = null; a.occ = null; return; }
  if (ps.settlement >= 0) {
    const s = st.settlements[ps.settlement];
    if (!a.siege || a.siege.s !== s.id) a.siege = { s: s.id, progress: 0, blocked: false };
    const gar = garrisonOf(s);
    if (armyCount(a) < gar * 0.5) { a.siege.blocked = true; return; }
    a.siege.blocked = false;
    a.siege.days = (a.siege.days || 0) + 1;
    const blockade = blockadedSet().has(s.id) ? 1.5 : 1; // cut off from the sea
    a.siege.progress += (siegePower(a) / fortification(s)) * blockade + (a.siege.days > 60 ? 0.12 * blockade : 0); // starvation
    s.pop *= 0.9985;
    applyCasualties(a, gar * 0.003);
    if (a.siege.progress >= 100) { captureSettlement(a, s); return; }
    // AI commanders storm the walls when the odds are good
    if (!civOf(a.civ).isPlayer && a.siege.progress > 35 && assaultOdds(a) > 0.6 && G.rng.chance(0.04)) assault(a);
  } else {
    if (!a.occ || a.occ.p !== p) a.occ = { p, days: 0 };
    a.occ.days++;
    if (a.occ.days >= 20) {
      const prev = ps.owner;
      if (ps.claimedBy >= 0) {
        const cl = st.settlements[ps.claimedBy];
        if (cl) cl.claims = cl.claims.filter((c) => c !== p);
      }
      ps.owner = a.civ; ps.claimedBy = -1;
      a.occ = null;
      G.dirty.owners = true;
      const w = warBetween(a.civ, prev);
      if (w) addWarScore(w, sideOf(w, a.civ), 3);
    }
  }
}

function captureSettlement(a, s) {
  const st = S();
  const oldCiv = civOf(s.civ), newCiv = civOf(a.civ);
  const wasCap = s.isCapital;
  const w = warBetween(a.civ, oldCiv.id);
  if (w && !w.civil) {
    // Phase 12: the town is occupied; its fate is decided at the peace table
    occupy(s, a.civ, w);
    s.pop *= 0.92;
    s.unrest = Math.max(s.unrest || 0, 25);
    if (s.buildings.walls) { s.buildings.walls--; if (!s.buildings.walls) delete s.buildings.walls; s.rev++; }
    a.siege = null;
    addWarScore(w, sideOf(w, a.civ), wasCap ? 18 : 8); w.exhD += 2; w.exhA += 1;
    const p = st.playerId;
    const involved = oldCiv.id === p || newCiv.id === p;
    log(`${s.name}${wasCap ? ', capital of ' + oldCiv.displayName + ',' : ''} is occupied by ${newCiv.displayName}!`, { civ: involved ? p : newCiv.id, type: involved ? (newCiv.id === p ? 'good' : 'bad') : 'world', toast: involved || wasCap, tile: s.tile });
    for (const o of st.armies) if (o.siege && o.siege.s === s.id && o !== a) o.siege = null;
    return;
  }
  transferSettlement(s, newCiv);
  s.pop *= 0.85;
  s.conquered = st.day;
  s.unrest = Math.max(s.unrest || 0, 40);
  if (!w?.civil) newCiv.ae = (newCiv.ae || 0) + (s.culture !== newCiv.race ? 10 : 6);
  if (s.buildings.walls) { s.buildings.walls--; if (!s.buildings.walls) delete s.buildings.walls; s.rev++; }
  a.siege = null;
  if (w) { addWarScore(w, sideOf(w, a.civ), wasCap ? 25 : 12); w.exhD += 3; w.exhA += 1; }
  const p = st.playerId;
  const involved = oldCiv.id === p || newCiv.id === p;
  log(`${s.name}${wasCap ? ', capital of ' + oldCiv.displayName + ',' : ''} falls to ${newCiv.displayName}!`, { civ: involved ? p : newCiv.id, type: involved ? (newCiv.id === p ? 'good' : 'bad') : 'world', toast: involved || wasCap, tile: s.tile });
  for (const o of st.armies) if (o.siege && o.siege.s === s.id && o !== a) o.siege = null;
}

// ---------------- Daily tick ----------------
export function dailyArmies() {
  const st = S();
  const armies = st.armies;
  for (const a of armies) {
    a.pt = a.tile;
    if (a.battle >= 0) continue;
    if (a.path.length) {
      a.mp += armySpeed(a);
      while (a.step < a.path.length - 1) {
        const nx = a.path[a.step + 1];
        if (!canStand(a.civ, nx) && !a.retreating) { a.path = []; break; }
        const c = stepCost(nx);
        if (a.mp < c) break;
        a.mp -= c; a.step++;
        a.tile = a.path[a.step];
      }
      if (a.path.length && a.step >= a.path.length - 1) { a.path = []; a.retreating = false; }
    }
    const p = W().province[a.tile];
    const own = p >= 0 && st.provinces[p].owner === a.civ;
    a.morale = Math.min(1, a.morale + (own ? 0.03 : 0.012));
    if (atSea(a)) {
      // At sea: enemy warships may intercept unless our own fleet escorts us.
      const { fleet, escorted } = interceptor(a);
      if (fleet && !escorted && a.intercepted !== st.day >> 3) {
        a.intercepted = st.day >> 3;
        const lost = applyCasualties(a, armyCount(a) * G.rng.float(0.12, 0.3) * Math.min(2, fleetPower(fleet) / Math.max(1, armyCount(a))));
        a.morale = Math.max(0, a.morale - 0.25);
        const p2 = st.playerId;
        if (a.civ === p2 || fleet.civ === p2) log(`Enemy warships fall upon ${a.name} at sea — ${lost.toFixed(1)} regiments lost!`, { civ: p2, type: a.civ === p2 ? 'bad' : 'good', toast: true, tile: a.tile });
      }
      if (!a.path.length) retreat(a); // never idle on the water
      continue;
    }
    // Stranded in territory we may no longer enter (peace, broken alliance): go home.
    if (!a.path.length && !canStand(a.civ, a.tile)) retreat(a);
  }
  // Engagements (land only)
  const day = st.day;
  for (let i = 0; i < armies.length; i++) {
    const x = armies[i];
    if (x.battle >= 0 || x.shield > day || atSea(x)) continue;
    for (let j = i + 1; j < armies.length; j++) {
      const y = armies[j];
      if (y.battle >= 0 || y.shield > day || x.civ === y.civ || atSea(y)) continue;
      if (manhattan(x.tile, y.tile) > 1 || !atWar(x.civ, y.civ)) continue;
      startBattle(x, y);
      break;
    }
  }
  for (const b of st.battles) if (!b.ended) battleDay(b);
  st.battles = st.battles.filter((b) => !b.ended || st.day - b.endDay < 12);
  for (const a of st.armies) if (a.battle < 0 && !a.path.length && !atSea(a)) siegeOrOccupy(a);
  // Remnants too small to fight dissolve back into the population.
  for (const a of [...st.armies]) if (a.battle < 0 && armyCount(a) < 0.35) disbandArmy(a);
}

// ---------------- Monthly supply ----------------
export function militaryMonthly(civ) {
  const st = S();
  const mine = st.armies.filter((a) => a.civ === civ.id);
  if (!mine.length) return;
  let food = 0;
  for (const a of mine) food += armyCount(a) * 0.3;
  const have = civ.stock.grain + civ.stock.fish;
  if (have >= food) { const fg = civ.stock.grain / Math.max(1e-6, have); civ.stock.grain -= food * fg; civ.stock.fish -= food * (1 - fg); }
  else { civ.stock.grain = 0; civ.stock.fish = 0; for (const a of mine) { a.morale -= 0.15; applyCasualties(a, armyCount(a) * 0.03); } }
  if (civ.market?.used) civ.market.used.grain += food;
  for (const a of mine) {
    const p = W().province[a.tile];
    const owner = p >= 0 ? st.provinces[p].owner : -1;
    if (owner !== civ.id) {
      const cap = p >= 0 ? W().provinces[p].tiles.length * 0.12 * (1 + W().provinces[p].pot.food) : 2;
      const n = armyCount(a);
      if (n > cap) applyCasualties(a, n * (a.general.trait === 'logistician' ? 0.01 : 0.02));
    }
    const at = attritionOf(a);
    if (at.total > 0) { applyCasualties(a, armyCount(a) * at.total); if (at.items.some(([k]) => k.startsWith('Beyond'))) a.morale -= 0.05; }
    if (civ.treasury < 0) a.morale -= 0.1;
    a.morale = clamp(a.morale, 0, 1);
  }
}

// ---------------- AI ----------------
function bestOfClass(civ, cls) {
  let best = null, bv = -1;
  for (const k of UNIT_LIST) {
    const U = UNITS[k];
    if (U.cls !== cls || !unitAvailable(civ, k)) continue;
    const v = U.att + U.def;
    if (v > bv) { bv = v; best = k; }
  }
  return best;
}

export function aiRecruit(civ) {
  const st = S();
  const P = civ.personality;
  const war = warsOf(civ.id).length > 0;
  let pop = 0;
  for (const id of civ.settlements) pop += st.settlements[id].pop;
  const factor = { militaristic: 1.7, defensive: 1.3, expansionist: 1.1, trader: 0.7, diplomatic: 0.7, isolationist: 0.9 }[P] ?? 1;
  const desired = (pop / 160) * factor * (war ? 1.8 : 1);
  let current = 0;
  for (const a of st.armies) if (a.civ === civ.id) current += armyCount(a);
  if (current >= desired) {
    // Peace-time demobilisation if upkeep is unaffordable
    if (!war && civ.treasury < 0) { const a = st.armies.find((x) => x.civ === civ.id && x.battle < 0); if (a) disbandArmy(a); }
    return;
  }
  const income = (civ.last?.tax || 0) + (civ.last?.gold || 0);
  if (!war && armyUpkeep(civ) > income * 0.35) return;
  const setts = civ.settlements.map((id) => st.settlements[id]).filter((s) => s.stage >= 1 && s.pop > 80).sort((a, b) => lvl(b, 'barracks') - lvl(a, 'barracks') || b.pop - a.pop);
  if (!setts.length) return;
  const s = setts[0];
  const n = Math.min(3, Math.ceil(desired - current));
  let siegeHave = 0;
  for (const a of st.armies) if (a.civ === civ.id) for (const k in a.units) if (UNITS[k].cls === 'sie') siegeHave += a.units[k];
  for (let i = 0; i < n; i++) {
    const opts = [];
    const inf = bestOfClass(civ, 'inf'), rng = bestOfClass(civ, 'rng'), cav = bestOfClass(civ, 'cav'), sie = bestOfClass(civ, 'sie');
    if (inf) opts.push([inf, P === 'defensive' ? 4 : 3]);
    if (rng) opts.push([rng, civ.race === 'elves' ? 3.5 : 2]);
    if (cav && lvl(s, 'barracks')) opts.push([cav, P === 'militaristic' || P === 'expansionist' ? 2 : 1.2]);
    if (sie && lvl(s, 'barracks') && war && siegeHave < current / 6) opts.push([sie, 2.5]);
    const pick = G.rng.weighted(opts, (o) => o[1]);
    if (!pick) break;
    const r = recruit(civ, s, pick[0]);
    if (!r.ok && r.cost) wantGoods(civ, r.cost);
    if (!r.ok) {
      const r2 = recruit(civ, s, inf || 'infantry');
      if (!r2.ok) break;
    }
  }
}

export function aiArmies(civ) {
  const st = S();
  const mine = st.armies.filter((a) => a.civ === civ.id);
  if (!mine.length) return;
  const enemies = enemiesOf(civ.id);
  // merge idle armies sharing a tile
  const byTile = new Map();
  for (const a of mine) {
    if (a.path.length || a.battle >= 0) continue;
    const o = byTile.get(a.tile);
    if (o) mergeArmies(o, a); else byTile.set(a.tile, a);
  }
  const sail = canSail(civ);
  for (const a of st.armies.filter((x) => x.civ === civ.id)) {
    if (a.battle >= 0 || a.retreating || atSea(a)) continue;
    if (a.ai.next > st.day) continue;
    a.ai.next = st.day + 8 + G.rng.int(0, 6);
    const myPow = armyPower(a);
    const land = W().landmass[a.tile];
    if (enemies.size) {
      if (a.morale < 0.45) { retreat(a); continue; }
      // threats & prey
      let prey = null, pd = Infinity, threat = null;
      for (const o of st.armies) {
        if (!enemies.has(o.civ) || W().landmass[o.tile] !== land) continue;
        const d = manhattan(a.tile, o.tile);
        const op = armyPower(o);
        if (op > myPow * 1.35 && d < 8) threat = o;
        if (op < myPow * 1.1 && d < 14 && d < pd) { pd = d; prey = o; }
      }
      if (threat && !prey) { retreat(a); continue; }
      if (prey) { if (!orderMove(a, prey.tile).ok) a.ai.next = st.day + 30; continue; }
      if (a.siege) continue; // keep sieging
      let target = null, td = Infinity;
      for (const id of civ.settlements) {
        const s = st.settlements[id];
        if (!isOccupied(s) || W().landmass[s.tile] !== land) continue;
        const d = manhattan(a.tile, s.tile) * 0.6;
        if (d < td) { td = d; target = s; }
      }
      for (const e of enemies) {
        for (const id of civOf(e).settlements) {
          const s = st.settlements[id];
          if (isOccupied(s) && (s.occ.by === civ.id || allied(s.occ.by, civ.id))) continue;
          const overseas = W().landmass[s.tile] !== land;
          if (overseas && (!sail || !W().provinces[s.province].coastal || armyCount(a) < 4)) continue;
          if (armyCount(a) < garrisonOf(s) * (overseas ? 1 : 0.6)) continue;
          const d = manhattan(a.tile, s.tile) * (overseas ? 1.8 : 1) + fortification(s) * 6;
          if (d < td) { td = d; target = s; }
        }
      }
      if (target && target.tile !== a.tile && !orderMove(a, target.tile).ok) a.ai.next = st.day + 45;
    } else {
      // Peacetime: garrison the capital; check rarely, and back off if unreachable.
      a.ai.next = st.day + 40 + G.rng.int(0, 20);
      const cap = st.settlements[civ.capital];
      if (cap && a.tile !== cap.tile && !a.path.length && (W().landmass[cap.tile] === land || sail)) {
        if (!orderMove(a, cap.tile).ok) a.ai.next = st.day + 720;
      }
    }
  }
}

export function militaryStrengthLabel(ratio) {
  return ratio > 1.6 ? 'Much stronger' : ratio > 1.15 ? 'Stronger' : ratio > 0.85 ? 'Even' : ratio > 0.6 ? 'Weaker' : 'Much weaker';
}
void PERSONALITIES;
