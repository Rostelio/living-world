// Phase 15 — score & ranking. A realm's score sums land, people, wealth, knowledge,
// military might, culture and the spread of its ruling house.
import { S } from './state.js';

export const SCORE_PARTS = [
  ['land', 'Land', '▦'], ['people', 'Population', '☺'], ['wealth', 'Wealth', '◎'], ['knowledge', 'Technology', '✎'],
  ['military', 'Military', '⚔'], ['culture', 'Culture', '✦'], ['dynasty', 'Dynasty', '♛'],
];
export function scoreOf(civ) {
  const st = S();
  if (!civ?.alive) return { total: 0, parts: {} };
  let pop = 0; for (const id of civ.settlements) pop += st.settlements[id].pop;
  let provinces = 0; for (const p of st.provinces) if (p.owner === civ.id) provinces++;
  let regs = 0; for (const a of st.armies) if (a.civ === civ.id) for (const k in a.units) regs += a.units[k];
  let ships = 0; for (const f of st.fleets || []) if (f.civ === civ.id) for (const k in f.ships) ships += f.ships[k];
  const income = Math.max(0, (civ.last?.tax || 0) + (civ.last?.trade || 0));
  const house = st.civs.filter((c) => c.alive && c.ruler?.dynasty === civ.ruler?.dynasty).length;
  const vassals = st.civs.filter((c) => c.alive && c.overlord === civ.id).length;
  const parts = {
    land: Math.round(provinces * 2 + civ.settlements.length * 4 + vassals * 10),
    people: Math.round(pop / 60),
    wealth: Math.round(Math.sqrt(Math.max(0, civ.treasury)) * 0.8 + income * 0.5),
    knowledge: Math.round(civ.techs.length * 4 + (civ.era || 0) * 25),
    military: Math.round(regs * 1.5 + ships * 2),
    culture: Math.round((civ.monuments?.length || 0) * 30 + Math.max(0, civ.stability - 40) * 0.6 + (civ.sol || 5) * 3),
    dynasty: Math.round((house - 1) * 15 + (civ.rulers?.length ? 0 : 0) + Math.min(30, (civ.claims || []).length * 5)),
  };
  let total = 0; for (const k in parts) total += parts[k];
  return { total, parts };
}
export function rankings() {
  const st = S();
  return st.civs.filter((c) => c.alive && c.settlements.length).map((c) => ({ c, ...scoreOf(c) })).sort((a, b) => b.total - a.total);
}
export function rankOf(id) { const r = rankings(); return { rank: r.findIndex((x) => x.c.id === id) + 1, of: r.length, score: r.find((x) => x.c.id === id)?.total ?? 0 }; }
