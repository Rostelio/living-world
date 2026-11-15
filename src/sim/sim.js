import { scoreOf } from './score.js';
import { marketsMonthly, ensurePhase14Markets } from './markets.js';
import { revealRealm } from './fog.js';
import { explorersDaily, updateFog, fogYearly } from './fog.js';
import { treasuryMonthly, treasuryYearly, ensurePhase12Treasury } from './treasury.js';
import { warfareMonthly, aiCommanders } from './warfare.js';
import { addWarScore, makePeace } from './diplomacy.js';
import { succeed } from './government.js';
import { charactersMonthly, charactersYearly, ensurePhase11 } from './characters.js';
import * as CHARS from './characters.js';
import { ensurePhase8 } from './setup.js';
import { ensurePhase10 } from './politics.js';
import { politicsMonthly, aiPoliticsYearly } from './politics.js';
import * as POLITICS from './politics.js';
import { disastersMonthly } from './disasters.js';
import { G, S, emit, log } from './state.js';
import { dailyUnits } from './colonize.js';
import { dailyWildlife, huntNear, purgeHunted } from './wildlife.js';
import { dailyConstruction, claimProvinces, storageCaps } from './settlements.js';
import { civMonthly } from './economy.js';
import { yearlyGovernment } from './government.js';
import { lateMonthly, lateYearly } from './latebalance.js';
import { depthMonthly } from './depth.js';
import * as REL from './religion.js';
import { religionMonthly, religionYearly } from './religion.js';
import { updateContacts } from './tech.js';
import { dailyArmies, militaryMonthly, aiRecruit, aiArmies } from './military.js';
import { diplomacyMonthly, diplomacyYearly } from './diplomacy.js';
import { unrestMonthly, civilWarsMonthly, startCivilWar } from './unrest.js';
import { eventsMonthly, cleanModifiers } from './events.js';
import { dailyFleets, aiFleets, aiNavyMonthly } from './naval.js';
import * as AI from './ai.js';
import * as PLAYS from './plays.js';
import { cultureMonthly, aiCultureYearly } from './culture.js';
import { cabinetMonthly, cabinetYearly } from './cabinet.js';
import { marketTrade } from './economy.js';
import { rel } from './diplomacy.js';
import { memoryYearly, ensurePhase17Memory } from './memory.js';
import { storiesMonthly, heroesYearly, ensurePhase17Stories } from './stories.js';

G.ai = AI;
G.politics = POLITICS;
G.characters = CHARS;
G.religion = REL; // Phase 22
G.addWarScore = addWarScore;
G.diplo = { makePeace, rel };
G.succeed = succeed;
G.fogReveal = (id) => { revealRealm(id, 16); };
G.ensureNewCivs = () => { const st = S(); ensurePhase8(st); ensurePhase10(st); ensurePhase11(st); ensurePhase12Treasury(st); ensurePhase14Markets(st); ensurePhase17Memory(st); ensurePhase17Stories(st); };
G.plays = PLAYS;
G.civilWar = (civ, type, claimant) => startCivilWar(civ, type, claimant);

// Optional profiler: set G.profile = {} to collect ms per subsystem.
const now = () => performance.now();
function timed(name, fn) {
  if (!G.profile) return fn();
  const t = now();
  const r = fn();
  G.profile[name] = (G.profile[name] || 0) + now() - t;
  return r;
}

// One simulation day. Daily: movement, battles, sieges, wildlife, construction.
// Monthly: aggregated economy per settlement, diplomacy, supply (cheap, scales to many civs).
// Yearly: politics, territory, AI strategy and war decisions.
export function simDay() {
  const st = S();
  st.day++;
  // Per-day caches shared by subsystems
  G.cache = { day: st.day };
  timed('units', dailyUnits);
  timed('armies', dailyArmies);
  timed('fleets', dailyFleets);
  timed('wildlife', dailyWildlife);
  timed('fog', () => { explorersDaily(); updateFog(); });
  timed('construction', () => {
    for (const civ of st.civs) {
      if (!civ.alive) continue;
      dailyConstruction(civ);
    }
  });
  timed('aiArmies', () => {
    for (const civ of st.civs) {
      if (!civ.alive || civ.isPlayer || st.day % 4 !== civ.id % 4) continue;
      aiArmies(civ);
      aiFleets(civ);
    }
  });
  if (st.day % 30 === 0) monthly();
  if (st.day % 360 === 0) timed('yearly', yearly);
}

function monthly() {
  const st = S();
  for (const civ of st.civs) {
    if (!civ.alive) continue;
    timed('economy', () => civMonthly(civ));
    timed('politics', () => politicsMonthly(civ));
    timed('treasury', () => treasuryMonthly(civ));
    timed('late', () => lateMonthly(civ));
    timed('hunting', () => {
      let game = 0;
      for (const id of civ.settlements) game += huntNear(st.settlements[id]);
      if (game) civ.stock.grain = Math.min(storageCaps(civ).grain, civ.stock.grain + game);
      civ.last.hunt = game;
    });
    timed('supply', () => militaryMonthly(civ));
    cleanModifiers(civ);
    timed('culture', () => { cultureMonthly(civ); cabinetMonthly(civ, { rel }); });
    timed('unrest', () => unrestMonthly(civ));
    timed('events', () => eventsMonthly(civ));
    timed('aiMonthly', () => { AI.aiMonthly(civ); if (!civ.isPlayer) { aiRecruit(civ); aiNavyMonthly(civ); } });
    if (!civ.settlements.length && !st.units.some((u) => u.civ === civ.id)) {
      civ.alive = false;
      st.armies = st.armies.filter((a) => a.civ !== civ.id);
      st.fleets = st.fleets.filter((f) => f.civ !== civ.id);
      for (const o of st.civs) if (o.overlord === civ.id) o.overlord = -1;
      const msg = `${civ.displayName} has collapsed and vanished from history.`;
      civ.history.push({ day: st.day, text: msg });
      log(msg, { civ: civ.id, type: civ.isPlayer ? 'bad' : 'world', toast: true, major: true });
    }
  }
  purgeHunted();
  timed('disasters', disastersMonthly);
  timed('characters', charactersMonthly);
  timed('stories', storiesMonthly);
  timed('warfare', warfareMonthly);
  timed('trade', marketTrade);
  timed('markets', marketsMonthly);
  timed('depth', depthMonthly); // Phase 21: caravans, missions, schemes
  timed('religion', religionMonthly); // Phase 22: missionaries
  timed('plays', PLAYS.playsMonthly);
  timed('civilWars', civilWarsMonthly);
  timed('diplomacy', diplomacyMonthly);
  emit('month');
}

function yearly() {
  const st = S();
  treasuryYearly();
  fogYearly();
  for (const civ of st.civs) {
    if (!civ.alive) continue;
    yearlyGovernment(civ);
    if (civ.alive) charactersYearly(civ);
    claimProvinces(civ);
    updateContacts(civ);
    AI.aiYearly(civ);
    diplomacyYearly(civ);
    memoryYearly(civ);
    heroesYearly(civ);
    cabinetYearly(civ);
    aiCultureYearly(civ);
    aiPoliticsYearly(civ);
    if (!civ.isPlayer || civ.autoBuild) aiCommanders(civ);
    recordHistory(civ);
  }
  timed('lateYearly', lateYearly);
  timed('religionYearly', religionYearly); // Phase 22: heads of faiths, holy wars
}

// Yearly snapshot for the Trends charts: [year, pop, gold, sol, stability, knowledge, regiments, techs]
export function recordHistory(civ) {
  const st = S();
  let pop = 0; for (const id of civ.settlements) pop += st.settlements[id].pop;
  let regs = 0; for (const a of st.armies) if (a.civ === civ.id) for (const k in a.units) regs += a.units[k];
  civ.hist ??= [];
  const r1 = (v) => Math.round(v * 10) / 10;
  civ.hist.push([Math.floor(st.day / 360), Math.round(pop), Math.round(civ.treasury), r1(civ.sol ?? 0), Math.round(civ.stability), r1(civ.last?.knowledge || 0), r1(regs), civ.techs.length, scoreOf(civ).total]);
  if (civ.hist.length > 400) civ.hist.splice(0, civ.hist.length - 400);
}
