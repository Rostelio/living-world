import { DIFFICULTY } from '../data/difficulty.js';
import { ensurePhase12 } from './phase12.js';
import { ensurePhase11, makeNoble } from './characters.js';
import { ensurePhase10 } from './politics.js';
import { ensurePhase9 as ensureP9 } from './disasters.js';
import { G, makeRng, log } from './state.js';
import { generateWorld } from '../world/worldgen.js';
import { worldFromMap } from '../world/mapio.js';
import { TECHS } from '../data/techs.js';
import { ensureFaiths } from './culture.js';
import { ensureCabinet, refreshCandidates } from './cabinet.js';
import { ensureMarket, ensurePops } from './economy.js';
import { RACES, RACE_LIST } from '../data/races.js';
import { PERSONALITY_LIST } from '../data/governments.js';
import { realmName as genRealmName } from '../core/names.js';
import { foundSettlement, chooseSite } from './settlements.js';
import { makeRuler, realmName } from './government.js';
import { seedWildlife } from './wildlife.js';
import { updateContacts } from './tech.js';
import * as AI from './ai.js';

export const CIV_COLORS = ['#d94a3d', '#3d7fd9', '#e6b422', '#9b59b6', '#2fbf71', '#e67e22', '#17a2b8', '#e84393', '#8d6e63', '#c0ca33', '#5c6bc0', '#ef5350'];

function makeFlag(rng, color) {
  const pal = ['#f5f0e1', '#1b1b1b', '#e6b422', '#b22222', '#1e3a8a', '#2e7d32', '#ffffff'];
  let c2 = rng.pick(pal);
  if (c2.toLowerCase() === color.toLowerCase()) c2 = '#f5f0e1';
  return { pattern: rng.int(0, 6), c1: color, c2, c3: rng.pick(pal), emblem: rng.int(0, 7) };
}

export function createCiv(id, race, opts) {
  const rng = G.rng;
  const taken = new Set((G.state?.civs || []).map((c) => c.baseName));
  let baseName = opts.name || genRealmName(race, rng);
  for (let k = 0; taken.has(baseName) && k < 25; k++) baseName = genRealmName(race, rng);
  const civ = {
    id, race,
    baseName,
    displayName: '',
    color: opts.color,
    flag: makeFlag(rng, opts.color),
    isPlayer: !!opts.isPlayer,
    personality: opts.isPlayer ? null : rng.pick(PERSONALITY_LIST),
    alive: true, gov: 'tribal', ruler: null, fleetNo: 0, loans: [], monuments: [], project: null, fabricating: null, companies: [], memory: [], heroes: [], inflation: 0, works: [], work: null, ambition: null, missions: { active: [], done: [] }, decisions: [], schemes: [], intel: {},
    stability: 55, taxRate: 0.15,
    priorities: { food: 30, wood: 25, stone: 15, iron: 5, gold: 15, knowledge: 10 },
    stock: { grain: 150, fish: 0, wood: 60, stone: 20, iron: 0 }, treasury: 40,
    research: { current: null, pool: 0 }, techs: [], era: 0,
    settlements: [], capital: -1,
    autoBuild: false, autoResearch: false, overlord: -1, armyNo: 0,
    ai: { strategy: 'Survival' }, last: { tax: 0, gold: 0, trade: 0 } /* never null: realms born mid-month are read by trade at month's end */, market: { price: {}, supply: {}, demand: {}, used: {}, imports: {}, exports: {} }, contacts: [], history: [], reforms: 0, nameCounts: {},
  };
  civ.displayName = realmName(civ);
  civ.ruler = makeRuler(civ);
  Object.assign(civ, { family: [], law: 'elective', modifiers: [], rulers: [], ae: 0, rival: null, dynasties: [{ name: civ.ruler.dynasty, from: G.state?.day ?? 0, to: null }] });
  return civ;
}

function habitatScore(P, race) {
  const hab = RACES[race].habitat, avoid = RACES[race].avoid;
  let s = 0;
  for (const b in P.biomes) {
    if (hab.includes(+b)) s += P.biomes[b];
    if (avoid.includes(+b)) s -= P.biomes[b];
  }
  return s / P.tiles.length;
}

function pickStarts(world, races) {
  const W = world;
  const cands = W.provinces.filter((P) => P.tiles.length >= 30 && W.landmassSizes[P.landmass] >= 400 && P.pot.food >= 0.45);
  const starts = [];
  for (const race of races) {
    let best = null, bv = -Infinity;
    for (const P of cands) {
      if (starts.includes(P)) continue;
      let minD = Infinity;
      for (const s of starts) {
        const dx = s.cx - P.cx, dy = s.cy - P.cy;
        minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy));
      }
      if (minD < 22) continue;
      const spread = starts.length ? Math.min(minD, 90) / 30 : 0;
      const v = habitatScore(P, race) * 2.5 + P.pot.food + (P.river ? 0.5 : 0) + spread + G.rng.next() * 0.4;
      if (v > bv) { bv = v; best = P; }
    }
    if (!best) best = cands.find((P) => !starts.includes(P)) || W.provinces.find((P) => !starts.includes(P));
    starts.push(best);
  }
  return starts;
}

// Fields added in Phase 3; also used to migrate older saves.
export function ensurePhase3(st) {
  st.armies ??= []; st.wars ??= []; st.battles ??= []; st.offers ??= []; st.diplo ??= {};
  st.nextArmyId ??= 1; st.nextWarId ??= 1; st.nextBattleId ??= 1; st.nextOfferId ??= 1;
  for (const c of st.civs) { c.overlord ??= -1; c.armyNo ??= 0; }
  st.version = Math.max(st.version || 0, 3);
}

// Fields added in Phase 4 (dynasties, unrest, events); also migrates older saves.
// Phase 8: goods economy, pops, cultures & faiths, cabinet, diplomatic plays.
// Also migrates older saves (old food stock becomes grain; everyone starts as peasants).
// Phase 9: disasters, sandbox, terraforming.
export function ensurePhase9(st) { ensureP9(st); st.version = Math.max(st.version || 0, 9); }

export function ensurePhase8(st) {
  ensureFaiths(st);
  ensureCabinet(st);
  st.plays ??= []; st.nextPlayId ??= 1;
  for (const c of st.civs) {
    if (c.stock.food != null) { c.stock.grain = (c.stock.grain || 0) + c.stock.food; delete c.stock.food; }
    ensureMarket(c);
    refreshCandidates(c);
  }
  for (const s of st.settlements) if (!s.dead) ensurePops(s);
  st.version = Math.max(st.version || 0, 8);
}

export function ensurePhase4(st) {
  st.pendingEvents ??= []; st.nextEventId ??= 1;
  for (const c of st.civs) {
    c.family ??= c.heir ? [{ ...c.heir, traits: [], stats: null }] : [];
    delete c.heir;
    c.law ??= c.gov === 'tribal' ? 'elective' : 'primogeniture';
    c.modifiers ??= []; c.rulers ??= []; c.ae ??= 0;
    c.dynasties ??= [{ name: c.ruler.dynasty, from: c.ruler.since, to: null }];
    if (!c.ruler.stats) {
      const r = G.rng;
      const v = () => r.int(2, 8);
      c.ruler.stats = { dip: v(), mar: v(), stw: v(), lrn: v() };
    }
  }
  for (const s of st.settlements) { s.culture ??= st.civs[s.civ].race; s.unrest ??= 0; }
  for (const a of st.armies) a.stance ??= 'balanced';
  st.chronicle ??= [];
  // Phase 6: navies
  st.fleets ??= []; st.seaBattles ??= []; st.nextFleetId ??= 1;
  for (const c of st.civs) { c.fleetNo ??= 0; c.seaContacts ??= []; }
  st.version = Math.max(st.version || 0, 4);
}

// Starting settlement sizes for scenarios: [population, buildings]
const STAGE_START = [
  [30, {}],
  [90, { farm: 1, lumber_camp: 1 }],
  [320, { farm: 2, lumber_camp: 1, town_hall: 1, granary: 1 }],
  [1000, { farm: 3, lumber_camp: 2, town_hall: 1, market: 1, granary: 1, temple: 1, walls: 1 }],
  [3200, { farm: 4, lumber_camp: 2, town_hall: 1, market: 2, library: 1, granary: 2, temple: 1, walls: 1, warehouse: 1 }],
];
function applyStage(s, stage) {
  stage = Math.max(0, Math.min(4, stage | 0));
  if (stage <= s.stage) return;
  const [pop, b] = STAGE_START[stage];
  s.pop = Math.max(s.pop, pop);
  s.housing = Math.max(s.housing, Math.round(pop * 1.25));
  for (const k in b) s.buildings[k] = Math.max(s.buildings[k] || 0, b[k]);
  s.stage = stage;
  s.rev++;
}

// Give every civ the knowledge and trappings of a later starting era.
function applyStartEra(st, era) {
  if (!era) return;
  for (const civ of st.civs) {
    for (const t of TECHS) if (t.era < era && (!t.race || t.race === civ.race) && !civ.techs.includes(t.id)) civ.techs.push(t.id);
    civ.era = Math.max(civ.era, era);
    civ.treasury += 250 * era;
    civ.stock.grain += 150 * era; civ.stock.wood += 150 * era; civ.stock.stone += 100 * era; civ.stock.iron += 60 * era; civ.stock.tools = (civ.stock.tools || 0) + 30 * era; civ.stock.cloth = (civ.stock.cloth || 0) + 20 * era;
    if (civ.gov === 'tribal') { civ.gov = 'monarchy'; civ.law = 'primogeniture'; civ.displayName = realmName(civ); }
    const cap = st.settlements[civ.capital];
    if (cap) applyStage(cap, Math.min(3, era + 1));
    civ._mods = null;
  }
}

export function newGame(opts) {
  const { seed, size = 'medium', race = 'humans', civName = '', aiCount = 7, color, mapType = 'continents', customMap = null, startEra = 0, playerStart = 0 } = opts;
  const world = customMap ? worldFromMap(customMap) : generateWorld(seed, size, mapType);
  const wseed = customMap ? customMap.seed >>> 0 : seed;
  G.world = world;
  makeRng((wseed ^ 0x9e3779b9) >>> 0);
  G.ai = AI;
  const st = {
    version: 1, seed: wseed, size: world.sizeKey, mapType: customMap ? 'custom' : mapType, startEra, day: 0, playerId: 0,
    customMap: customMap || null, scenarioName: opts.scenarioName || (customMap ? customMap.name : null),
    civs: [], settlements: [], provinces: world.provinces.map(() => ({ owner: -1, settlement: -1, claimedBy: -1 })),
    units: [], animals: [], roads: [], log: [], nextUnitId: 1, nextAnimalId: 1, rngState: 0,
  };
  ensurePhase3(st);
  G.state = st;

  const colors = [...CIV_COLORS];
  const placed = customMap?.starts?.filter((sp) => world.province[sp.tile] >= 0) || [];
  if (placed.length) {
    // Scenario: civilizations placed in the editor. The player takes the chosen one.
    const order = [Math.min(playerStart, placed.length - 1), ...placed.map((_, i) => i).filter((i) => i !== Math.min(playerStart, placed.length - 1))];
    const used = new Set();
    order.forEach((si, i) => {
      const sp = placed[si];
      const p = world.province[sp.tile];
      if (used.has(p)) return;
      used.add(p);
      const civ = createCiv(st.civs.length, sp.race, { isPlayer: i === 0, name: (i === 0 && civName) || sp.name || '', color: sp.color || colors[i % colors.length] });
      if (!civ.isPlayer && sp.personality) civ.personality = sp.personality;
      st.civs.push(civ);
      const s = foundSettlement(civ, p, sp.tile, 30, { capital: true });
      applyStage(s, sp.stage || 0);
      if (!civ.isPlayer) civ.research.current = AI.pickResearch(civ);
    });
    // Optional extra rivals at random
    const fill = customMap.settings?.aiFill || 0;
    if (fill) {
      const races = Array.from({ length: fill }, (_, i) => RACE_LIST[i % RACE_LIST.length]);
      const free = pickStarts(world, races).filter((P) => P && !used.has(P.id) && st.provinces[P.id].owner < 0);
      free.forEach((P, k) => {
        const civ = createCiv(st.civs.length, races[k], { color: colors[(st.civs.length + 3) % colors.length] });
        st.civs.push(civ);
        foundSettlement(civ, P.id, chooseSite(P, races[k]), 30, { capital: true });
        civ.research.current = AI.pickResearch(civ);
      });
    }
  } else {
    const others = [];
    for (let i = 0; i < aiCount; i++) others.push(RACE_LIST[i % RACE_LIST.length]);
    G.rng.shuffle(others);
    const races = [race, ...others];
    const pColor = color || RACES[race].colors[0];
    const pool = colors.filter((c) => c.toLowerCase() !== pColor.toLowerCase());
    G.rng.shuffle(pool);
    const starts = pickStarts(world, races);
    const used = new Set();
    races.forEach((r, i) => {
      const P = starts[i];
      if (!P || used.has(P.id)) return;
      used.add(P.id);
      const civ = createCiv(st.civs.length, r, { isPlayer: i === 0, name: i === 0 ? civName : '', color: i === 0 ? pColor : pool[(i - 1) % pool.length] });
      st.civs.push(civ);
      foundSettlement(civ, P.id, chooseSite(P, r), 30, { capital: true });
      if (!civ.isPlayer) civ.research.current = AI.pickResearch(civ);
    });
  }
  applyStartEra(st, startEra);
  for (const c of st.civs) updateContacts(c);
  ensurePhase4(st);
  ensurePhase8(st);
  ensurePhase9(st);
  ensurePhase10(st);
  ensurePhase11(st);
  ensurePhase12(st, opts);
  // starting rulers: some are already married to local nobles
  for (const c of st.civs) if (c.ruler.age >= 20 && G.rng.chance(0.6)) { const sp = makeNoble(c, { age: Math.max(17, c.ruler.age + G.rng.int(-6, 3)), gender: c.ruler.gender === 'm' ? 'f' : 'm' }); sp.from = -1; c.ruler.spouse = sp; }
  for (const c of st.civs) if (!c.isPlayer && c.gov === 'tribal' && G.rng.chance(0.35)) c.law = 'partition';
  st.sandbox = !!opts.sandbox;
  st.difficulty = opts.difficulty || 'normal';
  st.disasterRate = opts.disasters || (opts.sandbox ? 'rare' : DIFFICULTY[st.difficulty]?.disasters || 'normal');
  seedWildlife();
  const p = st.civs[0];
  const intro = startEra
    ? `${p.displayName} enters history in the ${['Ancient', 'Medieval', 'Renaissance', 'Industrial'][startEra]} Era. Its story begins.`
    : `The ${RACES[p.race].adj} people of ${p.baseName} gather around their first campfire. Their story begins.`;
  log(intro, { civ: 0, type: 'good', toast: true });
  return st;
}
