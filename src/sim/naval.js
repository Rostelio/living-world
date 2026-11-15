import { G, S, log, civOf } from './state.js';
import { B, BIOMES } from '../data/biomes.js';
import { clamp } from '../core/util.js';
import { personName } from '../core/names.js';
import { findPath } from './pathfind.js';
import { lvl, canAfford, pay } from './settlements.js';
import { atWar, enemiesOf, warBetween, sideOf, addWarScore, warsOf } from './diplomacy.js';

// ---------------- Ships ----------------
export const SHIPS = {
  galley: { name: 'Galleys', att: 2.5, def: 2, speed: 2.2, upkeep: 0.4, cost: { gold: 25, wood: 30 }, tech: 'sailing', desc: 'Oared warships of the ancient seas.' },
  carrack: { name: 'Carracks', att: 5, def: 4.5, speed: 2.6, upkeep: 0.8, cost: { gold: 50, wood: 60, iron: 10, cloth: 10 }, tech: 'navigation', desc: 'Ocean-going sailing ships with cannon.' },
  ironclad: { name: 'Ironclads', att: 13, def: 12, speed: 3, upkeep: 1.5, cost: { gold: 120, steel: 25, coal: 15 }, tech: 'steam_power', desc: 'Steam-driven armoured warships.' },
};
export const SHIP_LIST = Object.keys(SHIPS);

const W = () => G.world;
const isWater = (t) => BIOMES[W().biome[t]].water;
const isSea = (t) => isWater(t) && W().biome[t] !== B.LAKE;
const manhattan = (a, b) => Math.abs((a % W().w) - (b % W().w)) + Math.abs(((a / W().w) | 0) - ((b / W().w) | 0));
export const fleetCount = (f) => { let n = 0; for (const k in f.ships) n += f.ships[k]; return n; };
export const fleetById = (id) => S().fleets.find((f) => f.id === id);

// ---------------- Sailing ability ----------------
export const portSettlements = (civ) => civ.settlements.map((id) => S().settlements[id]).filter((s) => lvl(s, 'port'));
export function canSail(civ) {
  return civ.techs.includes('sailing') && civ.settlements.some((id) => lvl(S().settlements[id], 'port'));
}
export function portProvinces(civ) {
  return new Set(portSettlements(civ).map((s) => s.province));
}

// Nearest open-sea tile to a harbour town (where its ships anchor).
export function portWater(s) {
  const c = G.cache || (G.cache = {});
  c.portWater ??= new Map();
  if (c.portWater.has(s.id)) return c.portWater.get(s.id);
  const w = W().w, h = W().h;
  const sx = s.tile % w, sy = (s.tile / w) | 0;
  let best = -1, bd = Infinity;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = sx + dx, y = sy + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const t = y * w + x;
    if (!isSea(t)) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = t; }
  }
  c.portWater.set(s.id, best);
  return best;
}
// Nearest sea tile next to a land tile (for "sail here" orders on coasts).
export function waterNear(tile, radius = 4) {
  const w = W().w, h = W().h;
  const sx = tile % w, sy = (tile / w) | 0;
  let best = -1, bd = Infinity;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = sx + dx, y = sy + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const t = y * w + x;
    if (!isWater(t)) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// ---------------- Building ships ----------------
export function shipAvailable(civ, type) { return civ.techs.includes(SHIPS[type].tech); }
export function shipCost(civ, s, type) {
  const c = {};
  for (const k in SHIPS[type].cost) c[k] = Math.ceil(SHIPS[type].cost[k] * (1 - 0.1 * (lvl(s, 'port') - 1)));
  return c;
}
export function canBuildShip(civ, s, type) {
  if (!shipAvailable(civ, type)) return { ok: false, reason: 'Requires technology', hidden: true };
  if (!lvl(s, 'port')) return { ok: false, reason: 'Requires a Harbour' };
  if (portWater(s) < 0) return { ok: false, reason: 'No open sea nearby' };
  const cost = shipCost(civ, s, type);
  if (!canAfford(civ, cost)) return { ok: false, reason: 'Not enough resources', cost };
  return { ok: true, cost };
}
function makeAdmiral(civ) {
  const rng = G.rng;
  return { name: personName(civ.race, rng.chance(0.5) ? 'm' : 'f', rng), skill: rng.int(1, 3) + (rng.chance(0.25) ? 1 : 0) };
}
const ORD = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export function createFleet(civ, tile, home) {
  const st = S();
  civ.fleetNo = (civ.fleetNo || 0) + 1;
  const f = { id: st.nextFleetId++, civ: civ.id, name: `${ORD(civ.fleetNo)} Fleet`, tile, pt: tile, home, ships: {}, admiral: makeAdmiral(civ), morale: 1, path: [], step: 0, mp: 0, battle: -1, ai: { next: 0 } };
  st.fleets.push(f);
  return f;
}
export function buildShip(civ, s, type) {
  const r = canBuildShip(civ, s, type);
  if (!r.ok) return r;
  pay(civ, r.cost);
  const tile = portWater(s);
  let f = S().fleets.find((x) => x.civ === civ.id && x.tile === tile && x.battle < 0 && !x.path.length);
  if (!f) f = createFleet(civ, tile, s.id);
  f.ships[type] = (f.ships[type] || 0) + 1;
  return { ok: true, fleet: f };
}
export function fleetUpkeep(civ) {
  let g = 0;
  for (const f of S().fleets) if (f.civ === civ.id) for (const k in f.ships) g += f.ships[k] * SHIPS[k].upkeep;
  return g;
}
export function fleetPower(f) {
  let p = 0;
  for (const k in f.ships) p += f.ships[k] * (SHIPS[k].att + SHIPS[k].def) / 2;
  return p * (0.5 + 0.5 * f.morale);
}
export function fleetSpeed(f) {
  let sp = 9;
  for (const k in f.ships) if (f.ships[k] > 0.05) sp = Math.min(sp, SHIPS[k].speed);
  return sp === 9 ? 2 : sp;
}
export function mergeFleets(a, b) {
  if (a === b || a.civ !== b.civ || a.battle >= 0 || b.battle >= 0) return false;
  for (const k in b.ships) a.ships[k] = (a.ships[k] || 0) + b.ships[k];
  if (b.admiral.skill > a.admiral.skill) a.admiral = b.admiral;
  S().fleets = S().fleets.filter((x) => x !== b);
  return true;
}
export function disbandFleet(f) { S().fleets = S().fleets.filter((x) => x !== f); }

export function orderSail(f, tile) {
  if (f.battle >= 0) return { ok: false, reason: 'Engaged in battle' };
  let goal = tile;
  if (!isWater(goal)) goal = waterNear(tile);
  if (goal < 0) return { ok: false, reason: 'No water there' };
  if (goal === f.tile) { f.path = []; return { ok: true }; }
  const path = findPath(f.tile, goal, { mode: 'water', maxNodes: 120000 });
  if (!path) return { ok: false, reason: 'No sea route' };
  f.path = path; f.step = 0; f.mp = 0;
  return { ok: true };
}
export function homePort(f) {
  const civ = civOf(f.civ);
  let best = null, bd = Infinity;
  for (const s of portSettlements(civ)) {
    const t = portWater(s);
    if (t < 0) continue;
    const d = manhattan(t, f.tile);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function returnHome(f) {
  const s = homePort(f);
  if (s) orderSail(f, portWater(s));
  f.retreating = true;
  f.shield = S().day + 10;
}

// ---------------- Blockades ----------------
// Enemy harbour towns within 2 tiles of an idle warship are blockaded.
export function blockadedSet() {
  const c = G.cache || (G.cache = {});
  if (!c.blockaded || c.blockadedDay !== S().day) {
    c.blockaded = new Map();
    c.blockadedDay = S().day;
    const st = S();
    const ports = st.settlements.filter((s) => !s.dead && lvl(s, 'port'));
    for (const f of st.fleets) {
      if (f.battle >= 0 || f.path.length || fleetCount(f) < 0.5) continue;
      for (const s of ports) {
        const pw = portWater(s);
        if (pw >= 0 && manhattan(pw, f.tile) <= 2 && atWar(f.civ, s.civ)) c.blockaded.set(s.id, f.civ);
      }
    }
  }
  return c.blockaded;
}

// ---------------- Naval battles ----------------
function shipCasualties(f, cas) {
  const n = fleetCount(f);
  if (n <= 0) return 0;
  let lost = 0;
  for (const k in f.ships) {
    const l = Math.min(f.ships[k], cas * (f.ships[k] / n));
    f.ships[k] -= l; lost += l;
    if (f.ships[k] < 0.02) delete f.ships[k];
  }
  return lost;
}
function sidePower(f) {
  const civ = civOf(f.civ);
  let att = 0, def = 0, n = 0;
  for (const k in f.ships) { att += f.ships[k] * SHIPS[k].att; def += f.ships[k] * SHIPS[k].def; n += f.ships[k]; }
  const mul = (1 + f.admiral.skill * 0.06) * (1 + 0.06 * civ.era) * (0.5 + 0.5 * f.morale);
  return { att: att * mul, avgDef: (def / Math.max(0.01, n)) * (1 + f.admiral.skill * 0.04), n };
}
function startSeaBattle(x, y) {
  const st = S();
  const b = { id: st.nextBattleId++, naval: true, a: x.id, d: y.id, ac: x.civ, dc: y.civ, tile: y.tile, day: 0, lossA: 0, lossD: 0, ended: false, endDay: 0, phase: 'Broadsides', hist: [], startA: fleetCount(x), startD: fleetCount(y) };
  st.seaBattles.push(b);
  x.battle = b.id; y.battle = b.id; x.path = []; y.path = [];
  const p = st.playerId;
  if (x.civ === p || y.civ === p) log(`Naval battle joined off ${coastName(b.tile)}!`, { civ: p, type: 'bad', toast: true, tile: b.tile });
}
function coastName(tile) {
  const w = W().w;
  for (let r = 1; r < 8; r++) for (const t of [tile - r, tile + r, tile - r * w, tile + r * w]) {
    const p = W().province[t];
    if (p >= 0) return W().provinces[p].name;
  }
  return 'the open sea';
}
function seaBattleDay(b) {
  const A = fleetById(b.a), D = fleetById(b.d);
  if (!A || !D) { endSeaBattle(b, A ? b.d : b.a); return; }
  const pa = sidePower(A), pd = sidePower(D);
  const rng = G.rng;
  const cD = (0.07 * pa.att) / Math.max(0.5, pd.avgDef) * rng.float(0.8, 1.2);
  const cA = (0.07 * pd.att) / Math.max(0.5, pa.avgDef) * rng.float(0.8, 1.2);
  const lD = shipCasualties(D, cD), lA = shipCasualties(A, cA);
  b.lossA += lA; b.lossD += lD;
  A.morale -= (lA / Math.max(0.2, fleetCount(A) + lA)) * 2.2 + 0.015;
  D.morale -= (lD / Math.max(0.2, fleetCount(D) + lD)) * 2.2 + 0.015;
  b.day++;
  b.hist.push([lA, lD]);
  const brokeA = A.morale < 0.25 || fleetCount(A) < 0.3, brokeD = D.morale < 0.25 || fleetCount(D) < 0.3;
  if (brokeA || brokeD || b.day > 30) endSeaBattle(b, (brokeA && !brokeD) || (brokeA && brokeD && A.morale < D.morale) || (!brokeA && !brokeD && A.morale < D.morale) ? b.a : b.d);
}
function endSeaBattle(b, loserId) {
  const st = S();
  b.ended = true; b.endDay = st.day;
  const A = fleetById(b.a), D = fleetById(b.d);
  for (const f of [A, D]) if (f) f.battle = -1;
  const loser = loserId === b.a ? A : D;
  b.winner = loserId === b.a ? b.dc : b.ac;
  const w = warBetween(b.ac, b.dc);
  if (w) { const side = sideOf(w, b.winner); if (side) addWarScore(w, side, clamp(2 + (loserId === b.a ? b.lossA : b.lossD) * 1.5, 2, 15)); w.battles++; }
  const p = st.playerId;
  const involved = b.ac === p || b.dc === p;
  const sunk = loser && fleetCount(loser) < 0.3;
  if (involved || b.startA + b.startD >= 6) log(`Battle of ${coastName(b.tile)}: the fleet of ${civOf(b.winner).displayName} prevails${sunk ? ', sinking the enemy fleet' : ''}.`, { civ: involved ? p : b.ac, type: involved ? (b.winner === p ? 'good' : 'bad') : 'world', toast: involved, tile: b.tile });
  if (loser) { if (sunk) st.fleets = st.fleets.filter((x) => x !== loser); else returnHome(loser); }
}

// ---------------- Daily tick ----------------
export function dailyFleets() {
  const st = S();
  for (const f of st.fleets) {
    f.pt = f.tile;
    if (f.battle >= 0) continue;
    if (f.path.length) {
      f.mp += fleetSpeed(f);
      while (f.step < f.path.length - 1 && f.mp >= 1) { f.mp -= 1; f.step++; f.tile = f.path[f.step]; }
      if (f.step >= f.path.length - 1) { f.path = []; f.retreating = false; }
    }
    const docked = st.settlements.some((s) => s.civ === f.civ && lvl(s, 'port') && portWater(s) === f.tile);
    f.morale = Math.min(1, f.morale + (docked ? 0.04 : 0.01));
  }
  // Engagements between hostile fleets
  const day = st.day;
  const fl = st.fleets;
  for (let i = 0; i < fl.length; i++) {
    const x = fl[i];
    if (x.battle >= 0 || x.shield > day) continue;
    for (let j = i + 1; j < fl.length; j++) {
      const y = fl[j];
      if (y.battle >= 0 || y.shield > day || x.civ === y.civ) continue;
      if (manhattan(x.tile, y.tile) > 1 || !atWar(x.civ, y.civ)) continue;
      startSeaBattle(x, y);
      break;
    }
  }
  for (const b of st.seaBattles) if (!b.ended) seaBattleDay(b);
  st.seaBattles = st.seaBattles.filter((b) => !b.ended || st.day - b.endDay < 10);
  st.fleets = st.fleets.filter((f) => fleetCount(f) >= 0.05 || f.battle >= 0);
}

// Enemy warships near an army crossing the sea. Returns {fleet, escorted}.
export function interceptor(army) {
  const st = S();
  let enemy = null, escort = false;
  for (const f of st.fleets) {
    const d = manhattan(f.tile, army.tile);
    if (f.civ === army.civ && d <= 2 && fleetCount(f) >= 0.5) escort = true;
    else if (d <= 1 && f.battle < 0 && atWar(f.civ, army.civ) && fleetCount(f) >= 0.5) enemy = f;
  }
  return { fleet: enemy, escorted: escort };
}

// ---------------- AI ----------------
function bestShip(civ) {
  let best = null, bv = -1;
  for (const k of SHIP_LIST) if (shipAvailable(civ, k) && SHIPS[k].att + SHIPS[k].def > bv) { bv = SHIPS[k].att + SHIPS[k].def; best = k; }
  return best;
}
export function aiNavyMonthly(civ) {
  if (civ.isPlayer || !canSail(civ)) return;
  const st = S();
  const ports = portSettlements(civ).filter((s) => portWater(s) >= 0);
  if (!ports.length) return;
  let mine = 0;
  for (const f of st.fleets) if (f.civ === civ.id) mine += fleetCount(f);
  let enemyShips = 0;
  const enemies = enemiesOf(civ.id);
  for (const f of st.fleets) if (enemies.has(f.civ)) enemyShips += fleetCount(f);
  const navalEnemy = [...enemies].some((e) => portSettlements(civOf(e)).length);
  const P = civ.personality;
  let desired = (P === 'trader' || P === 'expansionist' ? 2 : 1) * Math.min(3, ports.length);
  if (navalEnemy) desired = Math.max(desired, 3 + enemyShips * 0.9);
  if (mine >= desired || civ.treasury < 80) return;
  const type = bestShip(civ);
  if (!type) return;
  const s = ports.sort((a, b) => b.pop - a.pop)[0];
  buildShip(civ, s, type);
}
export function aiFleets(civ) {
  const st = S();
  const mine = st.fleets.filter((f) => f.civ === civ.id);
  if (!mine.length) return;
  const byTile = new Map();
  for (const f of mine) {
    if (f.path.length || f.battle >= 0) continue;
    const o = byTile.get(f.tile);
    if (o) mergeFleets(o, f); else byTile.set(f.tile, f);
  }
  const enemies = enemiesOf(civ.id);
  for (const f of st.fleets.filter((x) => x.civ === civ.id)) {
    if (f.battle >= 0 || f.retreating || f.ai.next > st.day) continue;
    f.ai.next = st.day + 10 + G.rng.int(0, 8);
    if (f.morale < 0.45) { returnHome(f); continue; }
    if (enemies.size) {
      const my = fleetPower(f);
      let prey = null, pd = Infinity;
      for (const o of st.fleets) {
        if (!enemies.has(o.civ)) continue;
        const d = manhattan(o.tile, f.tile);
        if (d < 40 && d < pd && fleetPower(o) < my * 1.15) { pd = d; prey = o; }
      }
      if (prey) { if (!orderSail(f, prey.tile).ok) f.ai.next = st.day + 60; continue; }
      let target = null, td = Infinity;
      for (const e of enemies) for (const s of portSettlements(civOf(e))) {
        const t = portWater(s);
        if (t < 0) continue;
        const d = manhattan(t, f.tile);
        if (d < td) { td = d; target = t; }
      }
      if (target != null && target !== f.tile && !orderSail(f, target).ok) f.ai.next = st.day + 90;
    } else {
      f.ai.next = st.day + 60;
      const s = homePort(f);
      if (s && portWater(s) !== f.tile && !f.path.length && !orderSail(f, portWater(s)).ok) f.ai.next = st.day + 720;
    }
  }
}

// Civs reachable by sea from our harbours (for war, trade and colonisation).
export function seaContacts(civ) {
  if (!canSail(civ)) return [];
  const st = S();
  const mine = portSettlements(civ).map((s) => s.tile);
  const out = [];
  for (const o of st.civs) {
    if (!o.alive || o.id === civ.id) continue;
    const coastal = o.settlements.some((id) => {
      const s = st.settlements[id];
      return W().provinces[s.province].coastal && mine.some((t) => manhattan(t, s.tile) < 70);
    });
    if (coastal) out.push(o.id);
  }
  return out;
}
export function navalWarsOf(civ) { return warsOf(civ.id); }
