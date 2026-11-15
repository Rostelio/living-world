// Phase 22 — religions that matter between realms:
//  · holy sites: each old faith has two sacred provinces; holding your own faith's sites brings
//    devotion and stability, losing them to another faith is a wound that calls for a holy war
//  · a head of each faith: the realm of that faith with the most devotion leads it
//  · missionaries: faiths spread across borders into the restless towns of neighbours
//  · holy wars: the head of a faith may call the faithful to retake a holy site; co-religionists
//    march together under the banner
import { G, S, log, civOf } from './state.js';
import { invalidateMods } from './mods.js';
import { atWar, allied, canDeclareWar, declareWar } from './diplomacy.js';
import { faithOf, BASE_FAITHS, sameFamily, createHeresy, adoptFaith } from './culture.js';
import { B, BIOMES } from '../data/biomes.js';

const YEAR = 360;
const rootOf = (fid) => faithOf(fid)?.root ?? fid;
const setts = (c) => c.settlements.map((id) => S().settlements[id]).filter(Boolean);

// ---------------- Holy sites ----------------
export function ensureReligion(st) {
  st.holySites ??= null;
  st.faithHeads ??= {};
  st.holyWarDay ??= {};
  if (st.holySites) return;
  // two sacred provinces per old faith: near its people's starting lands, on good land
  const W = G.world;
  const taken = new Set();
  const sites = [];
  for (const root in BASE_FAITHS) {
    const home = st.civs.find((c) => c.race === BASE_FAITHS[root].race && c.settlements.length);
    const hx = home ? st.settlements[home.capital]?.tile % W.w : W.w / 2, hy = home ? (st.settlements[home.capital]?.tile / W.w) | 0 : W.h / 2;
    const cand = W.provinces.map((P, id) => ({ P, id })).filter(({ P, id }) => !taken.has(id) && P.tiles.length > 10 && !BIOMES[W.biome[P.tiles[0]]]?.water && W.biome[P.tiles[0]] !== B.MOUNTAIN)
      .map((o) => ({ ...o, d: Math.hypot(o.P.cx - hx, o.P.cy - hy) + (o.P.traits?.includes('holy_site') ? -20 : 0) + G.rng.next() * 12 }))
      .filter((o) => o.d > 6).sort((a, b) => a.d - b.d);
    for (const o of cand.slice(0, 2)) { taken.add(o.id); sites.push({ prov: o.id, faith: root }); }
  }
  st.holySites = sites;
}
export const holySitesOf = (root) => (S().holySites || []).filter((h) => h.faith === root);
// who holds a holy site now (the realm owning the province), or -1
export const siteHolder = (h) => S().provinces[h.prov]?.owner ?? -1;

// ---------------- Devotion & the heads of the faiths ----------------
export function devotion(civ) {
  const root = rootOf(civ.faith);
  let d = 0;
  for (const h of S().holySites || []) if (h.faith === root && siteHolder(h) === civ.id) d += 30;
  for (const s of setts(civ)) { if (s.faith === civ.faith) d += 1 + (s.buildings.temple || 0) * 2; }
  return d;
}
function headsYearly() {
  const st = S();
  const best = {};
  for (const c of st.civs) {
    if (!c.alive || !c.faith) continue;
    const root = rootOf(c.faith), v = devotion(c);
    if (!best[root] || v > best[root].v) best[root] = { id: c.id, v };
  }
  for (const root in best) {
    const prev = st.faithHeads[root];
    st.faithHeads[root] = best[root].id;
    if (prev !== best[root].id) {
      const c = civOf(best[root].id);
      if (c.isPlayer || civOf(prev)?.isPlayer) log(`✝ ${c.displayName} now leads the faithful of ${faithOf(root)?.name}.`, { civ: S().playerId, type: c.isPlayer ? 'good' : 'info', major: true });
    }
  }
}
export const headOf = (root) => S().faithHeads?.[root] ?? -1;
export const isHead = (civ) => headOf(rootOf(civ.faith)) === civ.id;
// stability and unrest from holy sites, read by mods each month
export function religionFx(civ) {
  const root = rootOf(civ.faith);
  const out = [];
  let own = 0, lost = 0;
  for (const h of S().holySites || []) if (h.faith === root) { if (siteHolder(h) === civ.id) own++; else if (siteHolder(h) >= 0 && rootOf(civOf(siteHolder(h)).faith) !== root) lost++; }
  if (own) out.push([{ stability: 3 * own }, `Holy sites held (${own})`]);
  if (lost) out.push([{ stability: -2 * lost }, 'Holy sites in infidel hands']);
  if (isHead(civ)) out.push([{ stability: 4 }, 'Head of the faith']);
  return out;
}

// ---------------- Missionaries ----------------
// Towns near a border may take up a neighbour's faith, if that neighbour keeps temples nearby
function missionMonthly() {
  const st = S(), W = G.world;
  if (!G.rng.chance(0.25)) return;
  for (const s of st.settlements) {
    if (s.dead || (s.unrest || 0) < 25 || !G.rng.chance(0.04)) continue;
    const owner = st.civs[s.civ];
    if (owner.tolerance === 'enforced' && G.rng.chance(0.7)) continue;
    let best = null, bd = 18;
    for (const o of st.settlements) {
      if (o.dead || o.civ === s.civ || !o.buildings.temple || o.faith === s.faith) continue;
      const d = Math.hypot((o.tile % W.w) - (s.tile % W.w), ((o.tile / W.w) | 0) - ((s.tile / W.w) | 0));
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) continue;
    const from = faithOf(s.faith)?.short;
    s.faith = best.faith; s.convert = 0;
    if (owner.isPlayer) log(`Missionaries from ${st.civs[best.civ].displayName} win over ${s.name}: it turns from ${from} to ${faithOf(best.faith)?.short}.`, { civ: owner.id, type: 'bad', tile: s.tile });
  }
}

// ---------------- Holy wars ----------------
export function holyWarTarget(civ) {
  // a holy site of our faith held by a realm of another faith, that we can reach
  const root = rootOf(civ.faith);
  for (const h of holySitesOf(root)) {
    const holder = siteHolder(h);
    if (holder < 0 || holder === civ.id) continue;
    const H = civOf(holder);
    if (!H?.alive || rootOf(H.faith) === root || allied(civ.id, holder) || !canDeclareWar(civ.id, holder).ok) continue;
    return { site: h, holder };
  }
  return null;
}
export function canCallHolyWar(civ) {
  if (!isHead(civ)) return { ok: false, reason: 'Only the head of the faith can call a holy war' };
  const last = S().holyWarDay[rootOf(civ.faith)] ?? -99999;
  if (S().day - last < 25 * YEAR) return { ok: false, reason: `The faithful are weary: ${Math.ceil((25 * YEAR - (S().day - last)) / YEAR)} more years` };
  const t = holyWarTarget(civ);
  if (!t) return { ok: false, reason: 'No holy site of our faith is held by unbelievers within reach' };
  return { ok: true, ...t };
}
export function callHolyWar(civ) {
  const r = canCallHolyWar(civ);
  if (!r.ok) return r;
  const st = S(), root = rootOf(civ.faith);
  const w = declareWar(civ.id, r.holder);
  if (!w.ok) return w;
  st.holyWarDay[root] = st.day;
  const faithful = [];
  for (const c of st.civs) if (c.alive && c.id !== civ.id && c.id !== r.holder && rootOf(c.faith) === root && !c.isPlayer && !allied(c.id, r.holder) && !atWar(c.id, r.holder) && G.rng.chance(0.75)) { w.war.att.push(c.id); faithful.push(c.baseName); }
  const P = G.world.provinces[r.site.prov];
  w.war.name = `Holy War for ${P.name}`;
  w.war.holy = { prov: r.site.prov, root };
  civ.stability = Math.min(100, civ.stability + 5);
  log(`⚔✝ HOLY WAR! ${civ.displayName} calls the faithful of ${faithOf(root)?.name} to retake ${P.name} from ${civOf(r.holder).displayName}${faithful.length ? ` — ${faithful.join(', ')} answer the call` : ''}!`, { civ: civ.isPlayer || civOf(r.holder).isPlayer ? st.playerId : -1, type: civOf(r.holder).isPlayer ? 'bad' : 'world', toast: true, major: true });
  return { ok: true };
}
function aiHolyWars() {
  for (const c of S().civs) {
    if (!c.alive || c.isPlayer || c.rebel || !G.rng.chance(0.08)) continue;
    if (canCallHolyWar(c).ok && c.stability > 40) callHolyWar(c);
  }
}

// ---------------- Reformation (a player decision lives in depth.js) ----------------
export function reformFaith(civ, focus) {
  const h = createHeresy(civ.faith, civ);
  const f = faithOf(h);
  f.name = `Reformed ${faithOf(rootOf(civ.faith))?.short || f.short}`; f.short = f.name;
  f.fx = { knowledge: { knowledge: 0.08 }, gold: { gold: 0.08 }, order: { stability: 4 } }[focus] || { stability: 4 };
  adoptFaith(civ, h);
  for (const s of setts(civ)) if (s.isCapital || (s.buildings.temple || 0) > 0) { s.faith = h; s.convert = 0; }
  invalidateMods(civ);
  return h;
}

// ---------------- Yearly / monthly ----------------
export function religionMonthly() { missionMonthly(); }
export function religionYearly() { headsYearly(); aiHolyWars(); }
void sameFamily;
