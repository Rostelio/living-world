import { G, S, log } from './state.js';
import { TECHS, TECH, ERAS } from '../data/techs.js';
import { invalidateMods } from './mods.js';
import { trading } from './diplomacy.js';
import { seaContacts } from './naval.js';

export function eraUnlocked(civ, era) {
  if (era === 0) return true;
  const need = ERAS[era].unlockNeed;
  const have = civ.techs.filter((t) => TECH[t].era === era - 1).length;
  return have >= need;
}

export function canResearch(civ, t) {
  const tech = typeof t === 'string' ? TECH[t] : t;
  if (civ.techs.includes(tech.id)) return false;
  if (tech.race && tech.race !== civ.race) return false;
  return eraUnlocked(civ, tech.era);
}

export function availableTechs(civ) {
  return TECHS.filter((t) => canResearch(civ, t));
}

// Knowledge diffusion: techs known by neighbours (trade, cultural exchange) are cheaper.
export function diffusion(civ, techId) {
  const st = S();
  let d = 0;
  for (const other of st.civs) {
    if (other.id === civ.id || !other.alive || !other.techs.includes(techId)) continue;
    d += civ.contacts?.includes(other.id) || trading(civ.id, other.id) ? 0.12 : 0.04;
  }
  return Math.min(0.4, d);
}

export function techCost(civ, techId) {
  const t = TECH[techId];
  const known = civ.techs.filter((x) => TECH[x].era === t.era).length;
  // Larger realms pay more per tech, so small civilizations can keep pace.
  const size = 1 + 0.045 * Math.max(0, civ.settlements.length - 1);
  return Math.round(ERAS[t.era].cost * (1 + 0.15 * known) * size * (1 - diffusion(civ, techId)));
}

export function setResearch(civ, techId) {
  if (techId && !canResearch(civ, techId)) return false;
  civ.research.current = techId;
  return true;
}

export function learnTech(civ, techId) {
  if (civ.techs.includes(techId)) return;
  civ.techs.push(techId);
  const t = TECH[techId];
  invalidateMods(civ);
  if (t.era > civ.era) {
    civ.era = t.era;
    const msg = `${civ.displayName} enters the ${ERAS[t.era].name} Era.`;
    civ.history.push({ day: S().day, text: msg });
    log(msg, { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', toast: true });
  }
  if (civ.isPlayer) log(`Discovered ${t.name}: ${t.desc}`, { civ: civ.id, type: 'good', toast: true });
}

export function progressResearch(civ, knowledge) {
  civ.research.pool += knowledge;
  for (let guard = 0; guard < 3; guard++) {
    const cur = civ.research.current;
    if (!cur) break;
    if (civ.techs.includes(cur)) { civ.research.current = null; break; }
    const cost = techCost(civ, cur);
    if (civ.research.pool < cost) break;
    civ.research.pool -= cost;
    learnTech(civ, cur);
    civ.research.current = null;
    if (!civ.isPlayer || civ.autoResearch) civ.research.current = G.ai?.pickResearch(civ) ?? null;
    else log('Research complete — choose a new technology.', { civ: civ.id, type: 'info' });
  }
}

export function updateContacts(civ) {
  const st = S();
  const W = G.world;
  const set = new Set();
  st.provinces.forEach((ps, p) => {
    if (ps.owner !== civ.id) return;
    for (const n of W.provinces[p].neighbors) {
      const o = st.provinces[n].owner;
      if (o >= 0 && o !== civ.id) set.add(o);
    }
  });
  civ.contacts = [...set];
  civ.seaContacts = seaContacts(civ).filter((c) => !set.has(c));
}
