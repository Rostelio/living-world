// Phase 9 — natural disasters (normal play) and god powers (sandbox mode).
// All randomness goes through G.rng so games stay deterministic.
import { G, S, log, emit, civOf } from './state.js';
import { B, BIOMES, RESOURCES } from '../data/biomes.js';
import { RACE_LIST, RACES } from '../data/races.js';
import { abandonSettlement, foundSettlement, chooseSite } from './settlements.js';
import { invalidateMods } from './mods.js';
import { createArmy } from './military.js';
import { createCiv, ensurePhase8 } from './setup.js';
import { PERSONALITY_LIST } from '../data/governments.js';
import { declareWar, makePeace, atWar, rel } from './diplomacy.js';
import { startCivilWar } from './unrest.js';
import { updateContacts } from './tech.js';

// ---------------- Definitions ----------------
export const DISASTERS = {
  plague: { name: 'Plague', icon: '☣', color: '#9bd36a', desc: 'A sickness that spreads along roads and trade, killing part of the population each month. Hospitals and aqueducts help.' },
  earthquake: { name: 'Earthquake', icon: '≋', color: '#c08a5a', desc: 'Shakes the land: buildings collapse and people die. Strongest near mountains.' },
  volcano: { name: 'Volcanic eruption', icon: '▲', color: '#ff6a2a', desc: 'Lava and ash bury the land around a mountain. Farms produce little under the ash for years.' },
  drought: { name: 'Drought', icon: '☀', color: '#e0b050', desc: 'No rain for months: farms, pastures and fisheries produce far less in the region.' },
  flood: { name: 'Flood', icon: '≈', color: '#5aa0e0', desc: 'Rivers and seas burst their banks, drowning fields and homes.' },
  wildfire: { name: 'Wildfire', icon: '♨', color: '#ff8a30', desc: 'Forests burn: lumber camps are lost and nearby towns catch fire.' },
  meteor: { name: 'Meteor strike', icon: '☄', color: '#ffd080', desc: 'A rock from the sky leaves a crater where it lands.' },
  blizzard: { name: 'Great blizzard', icon: '❄', color: '#cfe4ff', desc: 'A brutal winter in the cold north: food runs short and armies freeze.' },
};

// Natural frequency per month for the whole world, by setting
export const DISASTER_RATES = { off: 0, rare: 0.025, normal: 0.06, frequent: 0.14 };

// God powers available in sandbox mode. target: 'tile' | 'settlement' | 'civ' | 'army' | 'two-civs'
export const POWERS = [
  { id: 'inspect', name: 'Inspect', icon: '☞', group: 'World', target: 'none', desc: 'Normal map selection.' },
  { id: 'possess', name: 'Rule realm', icon: '♛', group: 'World', target: 'civ', desc: 'Take control of the realm you click.' },
  { id: 'spawn', name: 'Found people', icon: '✦', group: 'Life', target: 'tile', desc: 'A new people settles on an empty land tile.' },
  { id: 'bless', name: 'Bless', icon: '✧', group: 'Life', target: 'settlement', desc: 'Prosperity: +population, food and growth for 5 years, +stability.' },
  { id: 'army', name: 'Raise army', icon: '⚔', group: 'Life', target: 'settlement', desc: 'Give the owner a free army of veterans.' },
  { id: 'curse', name: 'Curse', icon: '☠', group: 'Wrath', target: 'settlement', desc: 'Misfortune: −stability, −growth and −gold for 5 years.' },
  { id: 'lightning', name: 'Lightning', icon: 'ϟ', group: 'Wrath', target: 'tile', desc: 'Strike an army or settlement: kills soldiers, starts fires.' },
  { id: 'meteor', name: 'Meteor', icon: '☄', group: 'Wrath', target: 'tile', desc: 'Obliterate everything around the impact and leave a crater.' },
  { id: 'earthquake', name: 'Earthquake', icon: '≋', group: 'Wrath', target: 'tile', desc: DISASTERS.earthquake.desc },
  { id: 'volcano', name: 'Volcano', icon: '▲', group: 'Wrath', target: 'tile', desc: 'Raise a volcano and erupt it (on any land).' },
  { id: 'plague', name: 'Plague', icon: '☣', group: 'Wrath', target: 'settlement', desc: DISASTERS.plague.desc },
  { id: 'drought', name: 'Drought', icon: '☀', group: 'Wrath', target: 'tile', desc: DISASTERS.drought.desc },
  { id: 'flood', name: 'Flood', icon: '≈', group: 'Wrath', target: 'tile', desc: DISASTERS.flood.desc },
  { id: 'wildfire', name: 'Wildfire', icon: '♨', group: 'Wrath', target: 'tile', desc: 'Set the land ablaze; fire spreads through forests.' },
  { id: 'rebellion', name: 'Incite revolt', icon: '✊', group: 'Politics', target: 'settlement', desc: 'The settlement and its neighbours rise against their ruler.' },
  { id: 'war', name: 'Start war', icon: '⚑', group: 'Politics', target: 'two-civs', desc: 'Click two realms: the first declares war on the second.' },
  { id: 'peace', name: 'Force peace', icon: '☮', group: 'Politics', target: 'civ', desc: 'End every war of the realm you click with a white peace.' },
  { id: 'grass', name: 'Grassland', icon: '▒', group: 'Terrain', target: 'tile', biome: B.GRASS, desc: 'Paint grassland (brush).' },
  { id: 'forest', name: 'Forest', icon: '♣', group: 'Terrain', target: 'tile', biome: B.FOREST, desc: 'Plant forest (brush).' },
  { id: 'desert', name: 'Desert', icon: '░', group: 'Terrain', target: 'tile', biome: B.DESERT, desc: 'Turn land to desert (brush).' },
  { id: 'hills', name: 'Hills', icon: '◠', group: 'Terrain', target: 'tile', biome: B.HILLS, desc: 'Raise hills (brush).' },
  { id: 'mountain', name: 'Mountains', icon: '▴', group: 'Terrain', target: 'tile', biome: B.MOUNTAIN, desc: 'Raise mountains (brush).' },
  { id: 'snow', name: 'Snow', icon: '❄', group: 'Terrain', target: 'tile', biome: B.SNOW, desc: 'Freeze the land (brush).' },
];
export const POWER = Object.fromEntries(POWERS.map((p) => [p.id, p]));

// ---------------- State ----------------
export function ensurePhase9(st) {
  st.disasters ??= [];
  st.scars ??= [];
  st.terraform ??= [];
  st.nextDisasterId ??= 1;
  st.sandbox ??= false;
  st.disasterRate ??= 'normal';
  st.disasterStats ??= {};
}

// Re-apply terrain changes (terraforming) to a freshly generated world after loading.
export function applyTerraform(world, st) {
  if (!st.terraform?.length) return;
  const touched = new Set();
  for (const [t, b] of st.terraform) {
    if (t < 0 || t >= world.N || BIOMES[world.biome[t]].water) continue;
    world.biome[t] = b;
    if (world.province[t] >= 0) touched.add(world.province[t]);
  }
  for (const p of touched) refreshProvinceStats(world, p);
}

// Recount a province's terrain mix and economic potential after its tiles change.
export function refreshProvinceStats(world, p) {
  const P = world.provinces[p];
  if (!P) return;
  const { biome, river, resource } = world;
  P.biomes = {};
  for (const t of P.tiles) P.biomes[biome[t]] = (P.biomes[biome[t]] || 0) + 1;
  const avg = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
  for (const t of P.tiles) {
    const y = BIOMES[biome[t]].yields;
    for (const k in avg) avg[k] += y[k];
    if (river[t]) avg.food += 0.25;
  }
  for (const k in avg) avg[k] /= P.tiles.length;
  if (P.coastal) avg.food += 0.08;
  const pot = { ...avg };
  for (const r in P.resources) {
    const R = RESOURCES[r];
    if (R) pot[R.sector] += Math.min(P.resources[r], 4) * R.bonus * 0.25;
  }
  P.avg = avg; P.pot = pot;
  void resource;
}

// ---------------- Helpers ----------------
const W = () => G.world;
const tx = (t) => t % W().w;
const ty = (t) => (t / W().w) | 0;
const dist = (a, b) => Math.hypot(tx(a) - tx(b), ty(a) - ty(b));
const isLand = (t) => t >= 0 && t < W().N && !BIOMES[W().biome[t]].water;
const settlementsNear = (tile, r) => S().settlements.filter((s) => !s.dead && dist(s.tile, tile) <= r);
export const settlementAtTile = (tile, r = 2.5) => {
  let best = null, bd = r;
  for (const s of S().settlements) { if (s.dead) continue; const d = dist(s.tile, tile); if (d <= bd) { bd = d; best = s; } }
  if (best) return best;
  const p = W().province[tile];
  const sid = p >= 0 ? S().provinces[p].settlement : -1;
  return sid >= 0 ? S().settlements[sid] : null;
};
const placeName = (tile) => {
  const near = settlementsNear(tile, 12).sort((a, b) => dist(a.tile, tile) - dist(b.tile, tile))[0];
  if (near) return `near ${near.name}`;
  const p = W().province[tile];
  return p >= 0 ? `in ${W().provinces[p].name}` : 'at sea';
};
function addMod(c, name, fx, months) {
  c.modifiers ??= [];
  c.modifiers = c.modifiers.filter((m) => m.name !== name);
  c.modifiers.push({ name, fx, until: S().day + months * 30 });
  invalidateMods(c);
}
function scar(type, tile, r, years = -1) {
  const st = S();
  st.scars.push({ type, tile, r, day: st.day, until: years < 0 ? -1 : st.day + years * 360, seed: G.rng.int(0, 9999) });
  if (st.scars.length > 160) st.scars.splice(0, st.scars.length - 160);
  emit('fx', { fx: 'scar', tile, r });
}
function fx(kind, tile, r = 3, extra = {}) { emit('fx', { fx: kind, tile, r, ...extra }); }

// Damage a settlement: kill a share of its people and knock down building levels.
export function damageSettlement(s, popFrac, hits = 0, reason = 'destroyed') {
  if (!s || s.dead) return;
  const civ = civOf(s.civ);
  const before = s.pop;
  s.pop = Math.max(0, s.pop * (1 - popFrac));
  if (s.pops) { const k = before > 0 ? s.pop / before : 0; for (const t in s.pops) s.pops[t] *= k; }
  for (let i = 0; i < hits; i++) {
    const keys = Object.keys(s.buildings).filter((b) => s.buildings[b] > 0);
    if (!keys.length) break;
    const b = keys[G.rng.int(0, keys.length - 1)];
    s.buildings[b]--; if (s.buildings[b] <= 0) delete s.buildings[b];
  }
  if (hits) { s.housing = Math.max(s.pop, (s.housing || s.pop) * (1 - Math.min(0.5, hits * 0.06))); invalidateMods(civ); }
  s.rev = (s.rev || 0) + 1;
  if (s.pop < 6) abandonSettlement(civ, s, reason);
}
function hurtArmies(tile, r, frac) {
  const st = S();
  for (const a of st.armies) {
    if (dist(a.tile, tile) > r) continue;
    for (const u in a.units) a.units[u] = Math.floor(a.units[u] * (1 - frac) + (G.rng.next() < 0.5 ? 0 : 0));
    a.morale = Math.max(0, a.morale - frac);
  }
  st.armies = st.armies.filter((a) => Object.values(a.units).some((n) => n > 0) || a.battle >= 0);
  for (const f of st.fleets || []) {
    if (dist(f.tile, tile) > r) continue;
    for (const k in f.ships) f.ships[k] = Math.floor(f.ships[k] * (1 - frac));
  }
  if (st.fleets) st.fleets = st.fleets.filter((f) => Object.values(f.ships).some((n) => n > 0) || f.battle >= 0);
}
function blight(s, food, wood, months, kind) {
  const until = S().day + months * 30;
  const cur = s.blight && s.blight.until > S().day ? s.blight : null;
  s.blight = { food: Math.min(food, cur?.food ?? 1), wood: Math.min(wood, cur?.wood ?? 1), until: Math.max(until, cur?.until ?? 0), kind };
}
function record(type) { const st = S(); st.disasterStats[type] = (st.disasterStats[type] || 0) + 1; }
function announce(type, tile, text, civs, major = true) {
  const st = S();
  const affectsPlayer = civs.includes(st.playerId);
  log(`${DISASTERS[type].icon} ${text}`, { type: affectsPlayer ? 'bad' : 'world', toast: affectsPlayer, tile, civ: affectsPlayer ? st.playerId : -1, major });
}
function start(type, tile, r, months, data = {}) {
  const st = S();
  const d = { id: st.nextDisasterId++, type, tile, r, start: st.day, until: st.day + Math.round(months * 30), ...data };
  st.disasters.push(d);
  record(type);
  return d;
}

// ---------------- Disasters ----------------
export function startPlague(s, rate = null) {
  if (!s || s.dead || (s.plague && s.plague.until > S().day) || (s.immune || 0) > S().day) return null;
  const st = S();
  const months = G.rng.int(6, 14);
  s.plague = { until: st.day + months * 30, rate: rate ?? (0.012 + G.rng.next() * 0.02) };
  const d = st.disasters.find((x) => x.type === 'plague' && x.until > st.day && dist(x.tile, s.tile) < 30);
  if (!d) {
    start('plague', s.tile, 3, months, { origin: s.id });
    announce('plague', s.tile, `Plague breaks out in ${s.name}!`, [s.civ]);
  }
  fx('plague', s.tile, 3);
  return s.plague;
}

export function earthquake(tile, power = 1) {
  const r = 5 + power * 3;
  const hit = settlementsNear(tile, r);
  for (const s of hit) {
    const k = 1 - dist(s.tile, tile) / (r + 1);
    damageSettlement(s, (0.03 + 0.09 * k) * power, Math.round(k * 3 * power + G.rng.next()), 'destroyed by an earthquake');
    s.unrest = Math.min(100, (s.unrest || 0) + 10 * k);
  }
  hurtArmies(tile, r * 0.6, 0.08 * power);
  scar('cracks', tile, Math.round(r * 0.6), 6);
  start('earthquake', tile, r, 0.3);
  fx('quake', tile, r);
  announce('earthquake', tile, `A great earthquake strikes ${placeName(tile)}.`, [...new Set(hit.map((s) => s.civ))]);
}

export function eruption(tile, power = 1) {
  const r = 6 + power * 3;
  const hit = settlementsNear(tile, r);
  for (const s of hit) {
    const k = 1 - dist(s.tile, tile) / (r + 1);
    damageSettlement(s, (0.04 + 0.25 * k * k) * power, Math.round(k * 4 * power), 'buried by a volcano');
    if (!s.dead) blight(s, 0.45 + 0.4 * (1 - k), 0.7, 24, 'ash');
  }
  hurtArmies(tile, 4, 0.5);
  scar('lava', tile, 2 + power, -1);
  scar('ash', tile, r, 8);
  start('volcano', tile, r, 4);
  fx('eruption', tile, r);
  announce('volcano', tile, `A volcano erupts ${placeName(tile)}! Ash darkens the sky.`, [...new Set(hit.map((s) => s.civ))]);
}

export function drought(tile, power = 1) {
  const r = 10 + power * 4;
  const months = G.rng.int(6, 14);
  const hit = settlementsNear(tile, r);
  for (const s of hit) blight(s, 0.55 - 0.1 * power, 0.9, months, 'drought');
  scar('dry', tile, r, Math.ceil(months / 12));
  start('drought', tile, r, months);
  fx('drought', tile, r);
  announce('drought', tile, `Drought grips the land ${placeName(tile)}.`, [...new Set(hit.map((s) => s.civ))]);
}

export function flood(tile, power = 1) {
  const r = 5 + power * 2;
  const wd = W();
  const hit = settlementsNear(tile, r).filter((s) => {
    const P = wd.provinces[s.province];
    return P.river || P.coastal || power > 1;
  });
  for (const s of hit) {
    const k = 1 - dist(s.tile, tile) / (r + 1);
    damageSettlement(s, (0.02 + 0.06 * k) * power, G.rng.next() < k ? 1 : 0, 'washed away by a flood');
    if (!s.dead) blight(s, 0.7, 0.95, 3, 'flood');
  }
  start('flood', tile, r, 1.5);
  fx('flood', tile, r);
  announce('flood', tile, `Floodwaters drown the fields ${placeName(tile)}.`, [...new Set(hit.map((s) => s.civ))]);
}

const FOREST = new Set([B.FOREST, B.JUNGLE, B.TAIGA]);
export function wildfire(tile, power = 1) {
  const wd = W();
  // flood-fill through forest from the origin
  const burned = [];
  const seen = new Set([tile]);
  const q = [tile];
  const max = 40 + power * 60;
  while (q.length && burned.length < max) {
    const t = q.shift();
    if (!isLand(t)) continue;
    burned.push(t);
    for (const n of [t - 1, t + 1, t - wd.w, t + wd.w]) {
      if (seen.has(n) || n < 0 || n >= wd.N) continue;
      seen.add(n);
      if (FOREST.has(wd.biome[n]) || (burned.length < 12 && isLand(n) && G.rng.next() < 0.5)) q.push(n);
    }
  }
  const r = Math.max(3, Math.sqrt(burned.length) * 0.8);
  const hit = settlementsNear(tile, r + 2);
  for (const s of hit) {
    const k = 1 - dist(s.tile, tile) / (r + 3);
    if (s.buildings.lumber_camp) { s.buildings.lumber_camp--; if (!s.buildings.lumber_camp) delete s.buildings.lumber_camp; s.rev++; }
    damageSettlement(s, 0.03 + 0.06 * k * power, G.rng.next() < k * 0.6 ? 1 : 0, 'burned to the ground');
    if (!s.dead) blight(s, 0.95, 0.5, 12, 'wildfire');
  }
  hurtArmies(tile, r, 0.1);
  scar('burn', tile, Math.round(r), 4);
  start('wildfire', tile, r, 1.5, { tiles: burned.length });
  fx('fire', tile, r);
  announce('wildfire', tile, `Wildfire sweeps the forests ${placeName(tile)}.`, [...new Set(hit.map((s) => s.civ))], burned.length > 40);
}

export function meteor(tile, power = 1) {
  const r = 3 + power * 2;
  const hit = settlementsNear(tile, r * 2);
  for (const s of hit) {
    const d = dist(s.tile, tile);
    if (d <= r * 0.6) damageSettlement(s, 0.85, 20, 'obliterated by a meteor');
    else damageSettlement(s, 0.25 * (1 - d / (r * 2)), 2, 'obliterated by a meteor');
  }
  hurtArmies(tile, r, 0.9);
  scar('crater', tile, Math.max(2, Math.round(r * 0.6)), -1);
  scar('burn', tile, r + 1, 3);
  start('meteor', tile, r, 0.2);
  fx('meteor', tile, r);
  announce('meteor', tile, `A meteor falls from the sky ${placeName(tile)}!`, [...new Set(hit.map((s) => s.civ))]);
}

export function blizzard(tile) {
  const r = 14;
  const hit = settlementsNear(tile, r);
  for (const s of hit) { blight(s, 0.6, 0.85, 3, 'blizzard'); damageSettlement(s, 0.02, 0, 'frozen'); }
  hurtArmies(tile, r, 0.15);
  start('blizzard', tile, r, 2);
  fx('blizzard', tile, r);
  announce('blizzard', tile, `A great blizzard buries the land ${placeName(tile)}.`, [...new Set(hit.map((s) => s.civ))]);
}

// ---------------- Monthly update ----------------
export function disastersMonthly() {
  const st = S();
  const wd = W();
  // Plague: deaths, spread, recovery
  const sick = st.settlements.filter((s) => !s.dead && s.plague && s.plague.until > st.day);
  for (const s of sick) {
    const lv = (s.buildings.hospital || 0) * 0.25 + (s.buildings.aqueduct || 0) * 0.15;
    const rate = s.plague.rate / (1 + lv);
    damageSettlement(s, rate, 0, 'emptied by plague');
    if (s.dead) continue;
    // spread along roads and to nearby settlements
    const near = [];
    for (const r of st.roads) { if (r.a === s.id) near.push(r.b); else if (r.b === s.id) near.push(r.a); }
    for (const o of st.settlements) if (!o.dead && o.id !== s.id && dist(o.tile, s.tile) < 14) near.push(o.id);
    for (const id of near) {
      const o = st.settlements[id];
      if (!o || o.dead) continue;
      const chance = 0.08 * Math.min(2, o.pop / 400 + 0.4) / (1 + (o.buildings.hospital || 0) * 0.5);
      if (G.rng.next() < chance) startPlague(o, s.plague.rate * 0.9);
    }
  }
  for (const s of st.settlements) {
    if (s.plague && s.plague.until <= st.day) { delete s.plague; s.immune = st.day + 360 * 8; }
    if (s.blight && s.blight.until <= st.day) delete s.blight;
  }
  // Ongoing volcano: more ash
  for (const d of st.disasters) {
    if (d.type === 'volcano' && d.until > st.day) for (const s of settlementsNear(d.tile, d.r)) if (!s.dead) damageSettlement(s, 0.01, 0, 'buried by a volcano');
  }
  st.disasters = st.disasters.filter((d) => d.until > st.day || st.day - d.until < 60);
  st.scars = st.scars.filter((x) => x.until < 0 || x.until > st.day);

  // Natural disasters
  const rate = DISASTER_RATES[st.disasterRate] ?? DISASTER_RATES.normal;
  if (!rate) return;
  const sizeK = Math.max(0.5, wd.N / (288 * 180));
  if (G.rng.next() > rate * sizeK) return;
  naturalDisaster();
}

function pickTile(pred, tries = 60) {
  const wd = W();
  for (let k = 0; k < tries; k++) {
    const t = G.rng.int(0, wd.N - 1);
    if (pred(t)) return t;
  }
  return -1;
}
function naturalDisaster() {
  const st = S();
  const wd = W();
  const month = Math.floor((st.day % 360) / 30);
  const winter = month <= 1 || month === 11;
  const summer = month >= 5 && month <= 8;
  const live = st.settlements.filter((s) => !s.dead);
  if (!live.length) return;
  const weights = [
    ['plague', 1.2], ['earthquake', 0.9], ['volcano', 0.35], ['drought', summer ? 1.6 : 0.5], ['flood', winter ? 0.4 : 1.1],
    ['wildfire', summer ? 1.6 : 0.4], ['blizzard', winter ? 1.2 : 0], ['meteor', 0.04],
  ];
  let sum = 0; for (const [, w] of weights) sum += w;
  let r = G.rng.next() * sum, type = 'plague';
  for (const [k, w] of weights) { r -= w; if (r <= 0) { type = k; break; } }
  const near = (s, R) => { for (let k = 0; k < 20; k++) { const t = s.tile + G.rng.int(-R, R) + G.rng.int(-R, R) * wd.w; if (isLand(t)) return t; } return s.tile; };
  const anyS = () => live[G.rng.int(0, live.length - 1)];
  switch (type) {
    case 'plague': { const big = live.filter((s) => s.pop > 250); const s = big.length ? big[G.rng.int(0, big.length - 1)] : anyS(); startPlague(s); break; }
    case 'earthquake': {
      const t = pickTile((t) => (wd.biome[t] === B.MOUNTAIN || wd.biome[t] === B.HILLS) && settlementsNear(t, 10).length > 0) ;
      if (t >= 0) earthquake(t, G.rng.next() < 0.25 ? 2 : 1);
      break;
    }
    case 'volcano': { const t = pickTile((t) => wd.biome[t] === B.MOUNTAIN && settlementsNear(t, 12).length > 0, 120); if (t >= 0) eruption(t, 1); break; }
    case 'drought': { const s = live.find((x, i) => i === G.rng.int(0, live.length - 1) && wd.temp[x.tile] > 0.45) || anyS(); drought(near(s, 4), 1); break; }
    case 'flood': { const c = live.filter((s) => wd.provinces[s.province].river || wd.provinces[s.province].coastal); const s = c.length ? c[G.rng.int(0, c.length - 1)] : anyS(); flood(near(s, 2), 1); break; }
    case 'wildfire': { const t = pickTile((t) => FOREST.has(wd.biome[t]) && settlementsNear(t, 10).length > 0, 120); if (t >= 0) wildfire(t, 1); break; }
    case 'blizzard': { const c = live.filter((s) => wd.temp[s.tile] < 0.35); if (c.length) blizzard(c[G.rng.int(0, c.length - 1)].tile); break; }
    case 'meteor': { const t = pickTile((t) => isLand(t)); if (t >= 0) meteor(t, 1); break; }
    default: break;
  }
}

// Production multiplier from local disasters (used by the economy).
export function blightMul(s, sector) {
  const b = s.blight;
  if (!b || b.until <= S().day) return 1;
  return sector === 'wood' ? b.wood : b.food;
}

// ---------------- God powers ----------------
// Returns { ok, msg } — or { ok:false, reason } when the target is invalid.
export function usePower(id, tile, opts = {}) {
  const st = S();
  const wd = W();
  const P = POWER[id];
  if (!P) return { ok: false, reason: 'Unknown power' };
  if (!st.sandbox) return { ok: false, reason: 'God powers are only available in sandbox mode' };
  if (tile < 0 || tile >= wd.N) return { ok: false, reason: 'Click on the map' };
  const s = settlementAtTile(tile);
  const prov = wd.province[tile];
  const owner = prov >= 0 ? st.provinces[prov].owner : -1;
  switch (id) {
    case 'spawn': {
      if (!isLand(tile) || prov < 0) return { ok: false, reason: 'Choose a land tile' };
      if (st.provinces[prov].owner >= 0) return { ok: false, reason: 'That land is already claimed — choose empty land' };
      const race = opts.race && RACES[opts.race] ? opts.race : RACE_LIST[G.rng.int(0, RACE_LIST.length - 1)];
      const used = new Set(st.civs.map((c) => c.color));
      const color = RACES[race].colors.find((c) => !used.has(c)) || `hsl(${G.rng.int(0, 359)},55%,50%)`;
      const civ = createCiv(st.civs.length, race, { color: color.startsWith('hsl') ? hslHex(color) : color });
      st.civs.push(civ);
      const site = isLand(tile) ? tile : chooseSite(wd.provinces[prov], race);
      foundSettlement(civ, prov, site, 40, { capital: true });
      ensurePhase8(st);
      civ.research.current = G.ai?.pickResearch(civ) ?? null;
      updateContacts(civ);
      G.dirty.owners = true;
      fx('bless', site, 3);
      log(`✦ A new people, the ${civ.displayName}, appears in ${wd.provinces[prov].name}.`, { type: 'world', toast: true, tile: site, major: true });
      return { ok: true };
    }
    case 'possess': {
      if (owner < 0) return { ok: false, reason: 'Click on a realm' };
      setPlayer(owner);
      return { ok: true, msg: `You now rule ${civOf(owner).displayName}.` };
    }
    case 'bless': case 'curse': case 'army': case 'plague': case 'rebellion': {
      if (!s) return { ok: false, reason: 'Click on a settlement' };
      const civ = civOf(s.civ);
      if (id === 'bless') {
        s.pop *= 1.12; s.housing = Math.max(s.housing || 0, s.pop * 1.05);
        if (s.pops) s.pops.peasants += s.pop * 0.107;
        delete s.plague; delete s.blight;
        addMod(civ, 'Divine blessing', { food: 0.25, growth: 0.3, stability: 10 }, 60);
        civ.stability = Math.min(100, civ.stability + 10);
        fx('bless', s.tile, 4);
        log(`✧ The gods bless ${s.name}.`, { type: 'good', tile: s.tile, toast: true });
      } else if (id === 'curse') {
        addMod(civ, 'Divine curse', { stability: -15, growth: -0.3, gold: -0.2 }, 60);
        civ.stability = Math.max(0, civ.stability - 15);
        fx('curse', s.tile, 4);
        log(`☠ A curse falls upon ${civ.displayName}.`, { type: 'bad', tile: s.tile, toast: true });
      } else if (id === 'army') {
        const a = createArmy(civ, s.tile, s.id);
        a.name = 'Heaven-sent Host';
        const era = civ.era || 0;
        a.units.infantry = 4 + era * 2; a.units.archers = 2 + era; a.units.cavalry = 1 + era;
        a.general.skill = Math.min(5, (a.general.skill || 1) + 2);
        fx('bless', s.tile, 2);
        log(`⚔ An army rises for ${civ.displayName} at ${s.name}.`, { type: 'world', tile: s.tile, toast: true });
      } else if (id === 'plague') {
        delete s.immune;
        if (!startPlague(s, 0.035)) return { ok: false, reason: `${s.name} is already sick` };
      } else if (id === 'rebellion') {
        s.unrest = 100;
        const near = civ.settlements.map((x) => st.settlements[x]).filter((o) => o.id !== s.id && dist(o.tile, s.tile) < 18).slice(0, 3);
        const w = startCivilWar(civ, 'separatist', null, [s, ...near]);
        if (!w) return { ok: false, reason: 'The realm is too small (or the capital cannot revolt)' };
        fx('curse', s.tile, 3);
      }
      return { ok: true };
    }
    case 'lightning': {
      fx('lightning', tile, 1);
      const armies = st.armies.filter((a) => dist(a.tile, tile) <= 1.5);
      if (armies.length) hurtArmies(tile, 1.5, 0.45);
      else if (s && dist(s.tile, tile) <= 3) { damageSettlement(s, 0.08, 1, 'burned to the ground'); fx('fire', s.tile, 1.5); }
      else if (FOREST.has(wd.biome[tile]) && G.rng.next() < 0.6) wildfire(tile, 0.5);
      return { ok: true };
    }
    case 'meteor': meteor(tile, opts.power || 1); return { ok: true };
    case 'earthquake': earthquake(tile, opts.power || 1); return { ok: true };
    case 'volcano': {
      if (!isLand(tile)) return { ok: false, reason: 'Choose a land tile' };
      if (wd.biome[tile] !== B.MOUNTAIN) terraform(tile, B.MOUNTAIN, 1);
      eruption(tile, opts.power || 1);
      return { ok: true };
    }
    case 'drought': drought(tile, opts.power || 1); return { ok: true };
    case 'flood': flood(tile, opts.power || 1); return { ok: true };
    case 'wildfire': if (!isLand(tile)) return { ok: false, reason: 'Choose a land tile' }; wildfire(tile, opts.power || 1); return { ok: true };
    case 'war': {
      const [a, b] = opts.civs || [];
      if (a == null || b == null || a === b) return { ok: false, reason: 'Pick two different realms' };
      if (atWar(a, b)) return { ok: false, reason: 'They are already at war' };
      const A = civOf(a), Bc = civOf(b);
      // the gods override vassalage, alliances, truces and distance
      A.overlord = -1;
      if (Bc.overlord === a) Bc.overlord = -1;
      if (!A.contacts.includes(b)) A.contacts.push(b);
      if (!Bc.contacts.includes(a)) Bc.contacts.push(a);
      const r = rel(a, b);
      r.truce = 0; r.ally = false;
      const res = declareWar(a, b);
      if (res && res.ok === false) return { ok: false, reason: res.reason || 'They cannot go to war' };
      fx('war', civOf(b).settlements.length ? st.settlements[civOf(b).capital].tile : tile, 3);
      return { ok: true };
    }
    case 'peace': {
      if (owner < 0) return { ok: false, reason: 'Click on a realm' };
      const ws = st.wars.filter((w) => !w.civil && (w.att.includes(owner) || w.def.includes(owner)));
      if (!ws.length) return { ok: false, reason: `${civOf(owner).displayName} is at peace` };
      for (const w of ws) makePeace(w, { type: 'white' });
      fx('bless', tile, 2);
      return { ok: true };
    }
    default:
      if (P.biome != null) {
        if (!isLand(tile)) return { ok: false, reason: 'Terrain can only be changed on land' };
        terraform(tile, P.biome, opts.brush ?? 1);
        return { ok: true, quiet: true };
      }
      return { ok: false, reason: 'Nothing happens' };
  }
}

function hslHex(hsl) {
  const m = hsl.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
  if (!m) return '#888888';
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Change land biomes in a radius; remembered in the save and re-applied on load.
export function terraform(tile, biome, brush = 1) {
  const st = S();
  const wd = W();
  const touched = new Set();
  const changed = [];
  const x0 = tx(tile), y0 = ty(tile);
  for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
    if (dx * dx + dy * dy > brush * brush + 0.5) continue;
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= wd.w || y >= wd.h) continue;
    const t = y * wd.w + x;
    if (!isLand(t) || wd.biome[t] === biome) continue;
    wd.biome[t] = biome;
    st.terraform.push([t, biome]);
    changed.push(t);
    if (wd.province[t] >= 0) touched.add(wd.province[t]);
  }
  if (st.terraform.length > 20000) st.terraform.splice(0, st.terraform.length - 20000);
  for (const p of touched) refreshProvinceStats(wd, p);
  if (changed.length) emit('fx', { fx: 'terrain', tiles: changed, tile, r: brush });
  return changed.length;
}

// Switch which realm the player controls (sandbox).
export function setPlayer(id) {
  const st = S();
  const old = civOf(st.playerId);
  if (old) { old.isPlayer = false; old.personality ??= PERSONALITY_LIST[0]; if (old.alive) old.research.current ??= G.ai?.pickResearch(old) ?? null; }
  const c = civOf(id);
  c.isPlayer = true; c.autoBuild = true; c.autoResearch = true;
  st.playerId = id;
  G.dirty.owners = true;
  if (st.fog?.on) G.fogReveal?.(id);
}
