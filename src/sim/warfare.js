// Phase 12 — deeper warfare: towns are occupied (not annexed) until peace, peace deals
// trade occupied provinces for war score, rulers and courtiers command armies (and can
// fall in battle), and armies far from home or in harsh seasons suffer attrition.
import { G, S, log, civOf } from './state.js';
import { BIOMES, B } from '../data/biomes.js';
import { GENERAL_TRAITS } from '../data/military.js';
import { transferSettlement } from './settlements.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const W = () => G.world;
const manhattan = (a, b) => Math.abs((a % W().w) - (b % W().w)) + Math.abs(((a / W().w) | 0) - ((b / W().w) | 0));

// ---------------- Occupation ----------------
export const isOccupied = (s) => !!(s?.occ && s.occ.by !== s.civ);
export function occupy(s, byCiv, war) {
  s.occ = { by: byCiv, war: war?.id ?? -1, day: S().day };
  s.rev = (s.rev || 0) + 1;
}
export function liberate(s) { if (s.occ) { delete s.occ; s.rev = (s.rev || 0) + 1; } }
// Value of a settlement at the peace table (war score)
export function settlementValue(s) {
  return Math.round(8 + Math.min(22, s.pop / 40) + (s.isCapital ? 15 : 0) + s.stage * 2);
}
export function occupiedBySide(w, side) {
  const st = S();
  const mine = side === 'att' ? w.att : w.def, theirs = side === 'att' ? w.def : w.att;
  return st.settlements.filter((s) => !s.dead && isOccupied(s) && mine.includes(s.occ.by) && theirs.includes(s.civ));
}
// Monthly: occupations add war score; a realm wholly occupied capitulates.
export function warfareMonthly() {
  const st = S();
  for (const w of [...st.wars]) {
    if (w.civil) continue;
    for (const side of ['att', 'def']) {
      const occ = occupiedBySide(w, side);
      let tick = 0; for (const s of occ) tick += s.isCapital ? 1.2 : 0.5;
      if (tick && G.addWarScore) G.addWarScore(w, side, Math.min(6, tick));
    }
    // capitulation: the enemy leader holds nothing
    for (const [side, lead] of [['att', w.def[0]], ['def', w.att[0]]]) {
      const L = civOf(lead);
      if (!L?.alive || !L.settlements.length) continue;
      const free = L.settlements.filter((id) => !isOccupied(st.settlements[id]));
      if (!free.length && G.diplo?.makePeace) {
        const winner = side === 'att' ? w.att[0] : w.def[0];
        const setts = occupiedBySide(w, side).map((s) => s.id);
        G.diplo.makePeace(w, { type: 'provinces', winner, loser: lead, setts, capitulation: true });
        break;
      }
    }
  }
  // stray occupations (war ended some other way)
  for (const s of st.settlements) if (s.occ && !st.wars.some((w) => w.id === s.occ.war)) liberate(s);
}
// Called from makePeace: hand over the chosen towns, return the rest.
export function settleOccupations(w, terms) {
  const st = S();
  const taken = [];
  if (terms?.type === 'provinces') {
    for (const id of terms.setts || []) {
      const s = st.settlements[id];
      if (!s || s.dead || !isOccupied(s)) continue;
      const to = civOf(s.occ.by);
      liberate(s);
      transferSettlement(s, to);
      s.conquered = st.day;
      to.ae = (to.ae || 0) + (s.culture !== to.race ? 8 : 5);
      taken.push(s.name);
    }
  }
  const parties = new Set([...w.att, ...w.def]);
  for (const s of st.settlements) if (s.occ && (s.occ.war === w.id || (parties.has(s.civ) && parties.has(s.occ.by)))) liberate(s);
  return taken;
}
// Peace terms the AI asks for: the most valuable occupied towns it can afford with its war score
export function provincesFor(w, side, budget) {
  const occ = occupiedBySide(w, side).sort((a, b) => settlementValue(b) - settlementValue(a));
  const pick = [];
  let cost = 0;
  for (const s of occ) { const v = settlementValue(s); if (cost + v <= budget) { pick.push(s.id); cost += v; } }
  return { setts: pick, cost };
}
export function provincesCost(ids) { const st = S(); return ids.reduce((c, id) => c + (st.settlements[id] ? settlementValue(st.settlements[id]) : 0), 0); }

// ---------------- Commanders ----------------
const TRAIT_TO_GENERAL = { brave: 'aggressive', strong: 'aggressive', diligent: 'logistician', frugal: 'logistician', wise: 'tactician', genius: 'tactician', charismatic: 'inspiring', just: 'inspiring', builder: 'siegemaster', paranoid: 'cautious', cruel: 'reckless', schemer: 'cautious' };
export function generalFromCharacter(p, kind) {
  const mar = p.stats?.mar ?? 5;
  const trait = (p.traits || []).map((t) => TRAIT_TO_GENERAL[t]).find(Boolean) || (mar >= 7 ? 'tactician' : 'cautious');
  return { name: p.name, gender: p.gender, skill: clamp(Math.round(mar / 2) + ((p.traits || []).includes('brave') ? 1 : 0), 1, 6), trait, charId: p.id, kind };
}
export function commanderOptions(civ) {
  const out = [];
  if (civ.ruler && civ.ruler.age >= 16) out.push({ id: 'ruler', p: civ.ruler, label: `${civ.ruler.name} (ruler)` });
  for (const c of civ.court || []) out.push({ id: String(c.id), p: c, label: `${c.title} ${c.name}` });
  return out;
}
export function appointCommander(army, who) {
  const civ = civOf(army.civ);
  const st = S();
  const opt = commanderOptions(civ).find((o) => o.id === String(who));
  if (!opt) return { ok: false, reason: 'Nobody to appoint' };
  // a character can lead only one army
  for (const a of st.armies) if (a !== army && a.civ === civ.id && a.general?.charId === opt.p.id) return { ok: false, reason: `${opt.p.name} already leads ${a.name}` };
  army.general = generalFromCharacter(opt.p, who === 'ruler' ? 'ruler' : 'court');
  if (who !== 'ruler') opt.p.opinion = clamp((opt.p.opinion || 0) + 10, -100, 100);
  return { ok: true };
}
// After a battle: a commander may fall (more likely on the losing side)
export function commanderFate(army, lost) {
  const g = army?.general;
  if (!g?.kind) return;
  const civ = civOf(army.civ);
  const p = lost ? 0.12 : 0.03;
  if (!G.rng.chance(p * (GENERAL_TRAITS[g.trait]?.att ? 1.3 : 1))) return;
  const st = S();
  if (g.kind === 'ruler' && civ.ruler?.id === g.charId) {
    log(`⚔ ${g.name}, ruler of ${civ.displayName}, falls in battle!`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: true, major: true });
    army.general = { name: 'a captain', gender: 'm', skill: 1, trait: 'cautious' };
    G.succeed?.(civ, 'battle');
  } else if (g.kind === 'court') {
    civ.court = (civ.court || []).filter((c) => c.id !== g.charId);
    log(`⚔ ${g.name}, commander of ${army.name}, is killed in battle.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer });
    army.general = { name: 'a captain', gender: 'm', skill: 1, trait: 'cautious' };
  }
  void st;
}
// AI: the best martial character leads the biggest army
export function aiCommanders(civ) {
  const st = S();
  const armies = st.armies.filter((a) => a.civ === civ.id && !a.merc).sort((a, b) => Object.values(b.units).reduce((x, y) => x + y, 0) - Object.values(a.units).reduce((x, y) => x + y, 0));
  if (!armies.length) return;
  const opts = commanderOptions(civ).filter((o) => (o.p.stats?.mar ?? 0) >= 6 && !(o.id === 'ruler' && (civ.ruler.age > 60 || civ.ruler.traits.includes('sickly'))));
  opts.sort((a, b) => (b.p.stats?.mar ?? 0) - (a.p.stats?.mar ?? 0));
  for (let i = 0; i < Math.min(armies.length, opts.length); i++) {
    const a = armies[i];
    const cur = a.general?.skill || 0;
    const g = generalFromCharacter(opts[i].p, opts[i].id === 'ruler' ? 'ruler' : 'court');
    if (g.skill > cur && !st.armies.some((x) => x.general?.charId === g.charId)) a.general = g;
  }
}

// ---------------- Supply, seasons & terrain ----------------
export function supplyDistance(army) {
  const st = S();
  const civ = civOf(army.civ);
  let d = Infinity;
  for (const id of civ.settlements) { const s = st.settlements[id]; if (!isOccupied(s)) d = Math.min(d, manhattan(army.tile, s.tile)); }
  // occupied enemy towns serve as depots
  for (const s of st.settlements) if (isOccupied(s) && s.occ.by === civ.id) d = Math.min(d, manhattan(army.tile, s.tile));
  return d;
}
export const SUPPLY_RANGE = 14;
// Extra monthly attrition (share of men lost) and the reasons, for the army panel
export function attritionOf(army) {
  const w = W();
  const st = S();
  const items = [];
  const d = supplyDistance(army);
  if (d > SUPPLY_RANGE) items.push([`Beyond supply lines (${d} tiles)`, Math.min(0.06, 0.01 + (d - SUPPLY_RANGE) * 0.002)]);
  const m = Math.floor((st.day % 360) / 30);
  const winter = m <= 1 || m === 11;
  const summer = m >= 5 && m <= 7;
  const t = w.temp[army.tile], b = w.biome[army.tile];
  if (winter && t < 0.45 && !BIOMES[b].water) items.push(['Winter', t < 0.3 ? 0.03 : 0.015]);
  if (summer && (b === B.DESERT || b === B.JUNGLE)) items.push([b === B.DESERT ? 'Desert heat' : 'Jungle fever', 0.015]);
  if (b === B.MOUNTAIN || b === B.SWAMP) items.push([BIOMES[b].name, 0.01]);
  let tot = 0; for (const [, v] of items) tot += v;
  if (army.general?.trait === 'logistician') tot *= 0.5;
  return { total: tot, items };
}
// Combat modifiers from the ground (attacker side)
export function crossingPenalty(attacker, battleTile) {
  const w = W();
  if (!w.river[battleTile]) return 1;
  const from = attacker.pt ?? attacker.tile;
  return w.river[from] ? 1 : 0.78; // storming across a river
}
export function fortDefense(defender, battleTile) {
  const st = S();
  const p = W().province[battleTile];
  const sid = p >= 0 ? st.provinces[p].settlement : -1;
  const s = sid >= 0 ? st.settlements[sid] : null;
  if (!s || s.tile !== battleTile || s.civ !== defender.civ) return 0;
  return 0.06 * ((s.buildings.walls || 0) + (s.buildings.castle || 0) * 2 + (s.buildings.star_fort || 0) * 3);
}
