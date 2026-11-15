// Phase 22 — creatures and quests. Dragons, giants, trolls and wyverns keep lairs in the wild
// and raid the towns around them; armies can storm a lair; heroes go on quests (slay a beast,
// seek treasure, search ruins) for gold, knowledge, glory and legendary artifacts.
import { G, S, log, civOf } from './state.js';
import { invalidateMods } from './mods.js';
import { B, BIOMES } from '../data/biomes.js';
import { HERO_KINDS } from './stories.js';

const YEAR = 360;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const CREATURES = {
  dragon: { name: 'Dragon', icon: '🐉', power: 40, reach: 14, hoard: [600, 1500], home: [B.MOUNTAIN], raid: 0.05, desc: 'Burns towns from the sky and sleeps on a hoard of gold.' },
  giant: { name: 'Giant', icon: '🗿', power: 18, reach: 7, hoard: [150, 400], home: [B.HILLS, B.MOUNTAIN, B.TUNDRA], raid: 0.05, desc: 'Smashes walls and carries off cattle.' },
  troll: { name: 'Troll', icon: '👹', power: 12, reach: 6, hoard: [80, 250], home: [B.FOREST, B.SWAMP, B.TAIGA], raid: 0.06, desc: 'Lurks under bridges and in deep woods, preying on travellers.' },
  wyvern: { name: 'Wyvern', icon: '🦎', power: 22, reach: 10, hoard: [200, 500], home: [B.HILLS, B.JUNGLE, B.DESERT], raid: 0.05, desc: 'A venomous winged hunter that snatches flocks and herders.' },
};
export const ARTIFACTS = [
  { id: 'sunblade', name: 'The Sunblade', fx: { defense: 15 }, desc: '+15 defence' },
  { id: 'crown_ages', name: 'Crown of Ages', fx: { stability: 6 }, desc: '+6 stability' },
  { id: 'star_atlas', name: 'The Star Atlas', fx: { knowledge: 0.1 }, desc: '+10% knowledge' },
  { id: 'horn_plenty', name: 'Horn of Plenty', fx: { food: 0.1, growth: 0.05 }, desc: '+10% food, +5% growth' },
  { id: 'golden_scale', name: 'The Golden Scale', fx: { gold: 0.1, tax: 0.05 }, desc: '+10% gold, +5% taxes' },
  { id: 'dragon_bone_bow', name: 'Dragon-bone Bow', fx: { defense: 10, stability: 2 }, desc: '+10 defence, +2 stability' },
];

const W = () => G.world;
const tileXY = (t) => [t % W().w, (t / W().w) | 0];
const dist = (a, b) => { const [ax, ay] = tileXY(a), [bx, by] = tileXY(b); return Math.hypot(ax - bx, ay - by); };
const settled = (t, r) => S().settlements.some((s) => !s.dead && dist(s.tile, t) < r);

function spawnLair(kind) {
  const st = S(), world = W(), C = CREATURES[kind];
  for (let k = 0; k < (kind === 'dragon' ? 600 : 80); k++) {
    const t = G.rng.int(0, world.N - 1);
    if (!C.home.includes(world.biome[t]) || settled(t, kind === 'dragon' ? 5 : 6) || st.monsters.some((m) => m.alive && dist(m.lair, t) < 10)) continue;
    const m = { id: st.nextMonsterId++, kind, lair: t, tile: t, alive: true, power: C.power * (0.8 + G.rng.next() * 0.5), hoard: G.rng.int(C.hoard[0], C.hoard[1]), born: st.day };
    st.monsters.push(m);
    return m;
  }
  return null;
}
export function ensureMonsters(st) {
  st.monsters ??= null;
  st.nextMonsterId ??= 1;
  st.quests ??= [];
  for (const c of st.civs) c.artifacts ??= [];
  if (st.monsters) return;
  st.monsters = [];
  const n = Math.max(4, Math.round(W().N / 3500));
  const kinds = ['dragon', 'giant', 'giant', 'troll', 'troll', 'wyvern', 'wyvern', 'troll'];
  for (let i = 0; i < n; i++) spawnLair(kinds[i % kinds.length]);
}
export const monstersNear = (civ, r = 30) => (S().monsters || []).filter((m) => m.alive && civ.settlements.some((id) => dist(S().settlements[id].tile, m.lair) < r));

// ---------------- raids & lairs ----------------
function monstersMonthly() {
  const st = S();
  for (const m of st.monsters) {
    if (!m.alive) continue;
    const C = CREATURES[m.kind];
    // wander near the lair; return home
    m.tile = G.rng.chance(0.7) ? m.lair : (() => { const [x, y] = tileXY(m.lair); const nx = clamp(x + G.rng.int(-3, 3), 0, W().w - 1), ny = clamp(y + G.rng.int(-3, 3), 0, W().h - 1); return ny * W().w + nx; })();
    if (!G.rng.chance(C.raid)) continue;
    const targets = st.settlements.filter((s) => !s.dead && dist(s.tile, m.lair) < C.reach);
    if (!targets.length) continue;
    const s = G.rng.pick(targets), civ = civOf(s.civ);
    // walls and garrisons drive raiders off
    const defence = (s.buildings.walls || 0) * 8 + (s.buildings.castle ? 12 : 0) + st.armies.filter((a) => a.civ === s.civ && dist(a.tile, s.tile) < 3).reduce((x, a) => x + Object.values(a.units).reduce((p, q) => p + q, 0) * 2, 0);
    if (defence > m.power * 1.2) { if (civ.isPlayer) log(`${C.icon} A ${C.name.toLowerCase()} came for ${s.name}, but the defenders drove it off.`, { civ: civ.id, type: 'good', tile: s.tile }); continue; }
    const lost = Math.round(s.pop * (0.02 + m.power / 1500));
    s.pop = Math.max(10, s.pop - lost); s.unrest = Math.min(100, (s.unrest || 0) + 12);
    const gold = Math.min(Math.max(0, civ.treasury) * 0.05, 300); civ.treasury -= gold; m.hoard += Math.round(gold);
    if (m.kind === 'dragon') st.disasters?.push({ id: st.nextDisasterId++, type: 'wildfire', tile: s.tile, r: 2, start: st.day, until: st.day + 20 });
    log(`${C.icon} A ${C.name.toLowerCase()} raids ${s.name}! ${lost} people are lost${gold > 1 ? ` and ${Math.round(gold)} gold carried off` : ''}.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, tile: s.tile });
  }
  // armies standing on a lair storm it
  for (const a of st.armies) {
    const m = st.monsters.find((x) => x.alive && x.lair === a.tile);
    if (!m || a.battle >= 0) continue;
    const regs = Object.values(a.units).reduce((x, y) => x + y, 0);
    const odds = clamp((regs * 4) / (regs * 4 + m.power), 0.05, 0.95);
    const civ = civOf(a.civ), C = CREATURES[m.kind];
    if (G.rng.chance(odds)) {
      m.alive = false; civ.treasury += m.hoard;
      log(`${C.icon} ${civ.displayName}'s army storms the lair: the ${C.name.toLowerCase()} is slain and ${m.hoard} gold of hoard won!`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'good' : 'world', toast: true, major: true, tile: m.lair });
    } else {
      for (const k in a.units) a.units[k] *= 0.7;
      log(`${C.icon} The ${C.name.toLowerCase()} beats back ${civ.displayName}'s army from its lair.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, tile: m.lair });
    }
  }
  // new beasts move into the empty wilds now and then
  if (st.monsters.filter((m) => m.alive).length < Math.max(3, Math.round(W().N / 5000)) && G.rng.chance(0.02)) {
    const m = spawnLair(G.rng.pick(['troll', 'giant', 'wyvern', 'dragon']));
    if (m) log(`${CREATURES[m.kind].icon} Shepherds whisper of a ${CREATURES[m.kind].name.toLowerCase()} that has made its lair in the wilds.`, { civ: -1, type: 'world' });
  }
}

// ---------------- quests ----------------
export const QUESTS = {
  slay: { name: 'Slay the Beast', icon: '⚔', months: 6, desc: 'Hunt down a creature in its lair: its hoard, glory, and sometimes a legendary weapon.' },
  treasure: { name: 'Seek Lost Treasure', icon: '✦', months: 8, desc: 'Follow an old map into the wilds: gold, and a chance of an artifact.' },
  ruins: { name: 'Search the Ruins', icon: '📜', months: 7, desc: 'Explore the ruins of a fallen age: lost knowledge.' },
};
export const QUEST_LIST = Object.keys(QUESTS);
const heroSkill = (h) => ({ general: 6, adventurer: 7, saint: 4, sage: 3, architect: 2 }[h.kind] || 3) + (h.deeds?.length || 0);
export function canQuest(civ, heroId, kind) {
  const h = (civ.heroes || []).find((x) => x.id === heroId && x.alive);
  if (!h) return { ok: false, reason: 'No such hero' };
  if (S().quests.some((q) => q.hero === heroId)) return { ok: false, reason: 'Already on a quest' };
  if (kind === 'slay' && !monstersNear(civ).length) return { ok: false, reason: 'No creature lairs near our lands' };
  return { ok: true };
}
export function questOdds(civ, heroId, kind) {
  const h = (civ.heroes || []).find((x) => x.id === heroId);
  if (!h) return 0;
  const sk = heroSkill(h);
  if (kind === 'slay') { const m = monstersNear(civ).sort((a, b) => a.power - b.power)[0]; return m ? clamp((sk * 5) / (sk * 5 + m.power), 0.1, 0.9) : 0; }
  return clamp(0.45 + sk * 0.05, 0.3, 0.9);
}
export function startQuest(civ, heroId, kind) {
  const r = canQuest(civ, heroId, kind);
  if (!r.ok) return r;
  const target = kind === 'slay' ? monstersNear(civ).sort((a, b) => a.power - b.power)[0]?.id : null;
  S().quests.push({ civ: civ.id, hero: heroId, kind, target, due: S().day + QUESTS[kind].months * 30, odds: questOdds(civ, heroId, kind) });
  return { ok: true };
}
function grantArtifact(civ) {
  const st = S();
  const owned = new Set(st.civs.flatMap((c) => c.artifacts || []));
  const free = ARTIFACTS.filter((a) => !owned.has(a.id));
  if (!free.length) return null;
  const a = G.rng.pick(free);
  civ.artifacts.push(a.id);
  civ.modifiers ??= []; civ.modifiers.push({ name: `Artifact: ${a.name}`, fx: a.fx, until: -1 });
  invalidateMods(civ);
  return a;
}
function questsMonthly() {
  const st = S();
  for (const q of [...st.quests]) {
    if (st.day < q.due) continue;
    st.quests = st.quests.filter((x) => x !== q);
    const civ = civOf(q.civ);
    const h = civ?.heroes?.find((x) => x.id === q.hero);
    if (!civ?.alive || !h?.alive) continue;
    const who = `${h.name} ${h.epithet}`;
    const Q = QUESTS[q.kind];
    if (G.rng.chance(q.odds)) {
      let text = '', deed = '';
      if (q.kind === 'slay') {
        const m = st.monsters.find((x) => x.id === q.target && x.alive);
        if (m) { m.alive = false; civ.treasury += m.hoard; deed = `slew the ${CREATURES[m.kind].name.toLowerCase()} of the ${BIOMES[W().biome[m.lair]].name.toLowerCase()}`; text = `${m.hoard} gold of hoard`; if (G.rng.chance(m.kind === 'dragon' ? 0.6 : 0.25)) { const a = grantArtifact(civ); if (a) text += ` and ${a.name}`; } }
        else { deed = 'found the beast already gone, and came home with tales'; text = 'tales'; }
      } else if (q.kind === 'treasure') {
        const g = Math.round(150 + G.rng.next() * 400 * ((civ.era || 0) + 1)); civ.treasury += g; deed = 'followed an old map to a buried treasure'; text = `${g} gold`;
        if (G.rng.chance(0.2)) { const a = grantArtifact(civ); if (a) text += ` and ${a.name}`; }
      } else {
        const k = Math.round(150 * ((civ.era || 0) + 1)); civ.research.pool += k; deed = 'uncovered the lore of a fallen age in forgotten ruins'; text = `${k} research`;
      }
      h.deeds.push(deed);
      log(`${Q.icon} Quest fulfilled: ${who} ${deed} — ${text}!`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'good' : 'world', toast: civ.isPlayer, major: true });
    } else if (G.rng.chance(q.kind === 'slay' ? 0.5 : 0.25)) {
      h.alive = false; h.dies = st.day;
      log(`${Q.icon} ${who} never returned from the quest: ${q.kind === 'slay' ? 'the beast was too strong' : 'the wilds swallowed them'}.`, { civ: civ.isPlayer ? civ.id : -1, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, major: true });
    } else log(`${Q.icon} ${who} returns empty-handed from the quest, but alive.`, { civ: civ.isPlayer ? civ.id : -1, type: 'info' });
  }
  // AI heroes go questing now and then
  for (const c of st.civs) {
    if (!c.alive || c.isPlayer || !G.rng.chance(0.03)) continue;
    const h = (c.heroes || []).find((x) => x.alive && (x.kind === 'adventurer' || x.kind === 'general') && !st.quests.some((q) => q.hero === x.id));
    if (h) { const k = monstersNear(c).length && G.rng.chance(0.5) ? 'slay' : G.rng.chance(0.5) ? 'treasure' : 'ruins'; startQuest(c, h.id, k); }
  }
}
export function monstersMonthlyAll() { if (!S().monsters) return; monstersMonthly(); questsMonthly(); }
void HERO_KINDS; void YEAR;
