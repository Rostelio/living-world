import { DIFFICULTY } from '../data/difficulty.js';
import { monumentFx } from './treasury.js';
import { lawFxList } from './politics.js';
import { RACES } from '../data/races.js';
import { TECH } from '../data/techs.js';
import { GOVERNMENTS, TRAITS } from '../data/governments.js';
import { G } from './state.js';

const PROD = ['food', 'wood', 'stone', 'iron', 'gold', 'knowledge', 'growth'];

// Aggregate every modifier source for a civilization into one table.
export function computeMods(civ) {
  const race = RACES[civ.race];
  const add = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, knowledge: 0, growth: 0, build: 0, tax: 0, housing: 0, cost: 0, stability: 0, defense: 0, admin: 0 };
  const sources = { stability: [] };
  const apply = (fx, label) => {
    if (!fx) return;
    for (const k in fx) {
      add[k] += fx[k];
      if (k === 'stability' && fx[k]) sources.stability.push([label, fx[k]]);
    }
  };
  if (race.mods.stability) sources.stability.push([race.name, race.mods.stability]);
  for (const t of civ.techs) apply(TECH[t]?.fx, TECH[t]?.name);
  apply(GOVERNMENTS[civ.gov].fx, GOVERNMENTS[civ.gov].name);
  if (civ.ruler) for (const tr of civ.ruler.traits) apply(TRAITS[tr]?.fx, `Ruler: ${TRAITS[tr]?.name}`);
  // Ruler attributes (5 is average)
  const rs = civ.ruler?.stats;
  if (rs) {
    apply({ tax: (rs.stw - 5) * 0.02, build: (rs.stw - 5) * 0.02 }, 'Ruler stewardship');
    apply({ knowledge: (rs.lrn - 5) * 0.03 }, 'Ruler learning');
    apply({ defense: (rs.mar - 5) * 3 }, 'Ruler martial');
    const ds = Math.round((rs.dip - 5) * 0.6);
    if (ds) apply({ stability: ds }, 'Ruler diplomacy');
  }
  if (civ.law === 'elective') apply({ stability: -2 }, 'Elective succession');
  if (civ.law === 'partition') apply({ stability: 3 }, 'Partition succession');
  if (civ.regencyUntil > (G.state?.day ?? 0)) apply({ stability: -4, build: -0.1 }, 'Regency council');
  // State faith
  const faith = G.state?.faiths?.[civ.faith];
  if (faith) apply(faith.fx, `Faith: ${faith.short || faith.name}`);
  // Cabinet: drill the armies
  for (const a of civ.cabinet || []) if (a.action === 'military') apply({ defense: 4 * (a.skill + (a.spec === 'military' ? 1 : 0)) }, 'Cabinet');
  // Difficulty (Phase 14)
  const dif = G.state?.difficulty || 'normal';
  if (dif !== 'normal') {
    const D = DIFFICULTY[dif];
    apply(civ.isPlayer ? D.player : D.ai, `Difficulty: ${D.name}`);
  }
  // Great monuments (Phase 12)
  for (const [fx, label] of monumentFx(civ)) apply(fx, label);
  // Laws (Phase 10)
  for (const [fx, label] of lawFxList(civ)) apply(fx, label);
  // Timed and permanent modifiers (events, monuments...)
  for (const md of civ.modifiers || []) if (md.until < 0 || md.until > (G.state?.day ?? 0)) apply(md.fx, md.name);

  const m = { sources };
  for (const k of PROD) m[k] = Math.max(0.1, race.mods[k] * (1 + add[k]));
  m.build = Math.max(0.2, 1 + add.build);
  m.tax = Math.max(0.1, 1 + add.tax);
  m.housing = 1 + add.housing;
  m.cost = Math.max(0.3, (1 + add.cost) / race.mods.build);
  m.stability = race.mods.stability + add.stability;
  m.defense = add.defense;
  m.admin = 3 + add.admin;
  return m;
}

export function mods(civ) {
  if (!civ._mods) civ._mods = computeMods(civ);
  return civ._mods;
}
export function invalidateMods(civ) { civ._mods = null; }
