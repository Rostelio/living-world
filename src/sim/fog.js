// Phase 12 — exploration and fog of war (for the player's view only; the AI is unaffected).
// explored: tiles ever seen; visible: tiles seen right now. Saved as a run-length string.
import { G, S, log, civOf } from './state.js';
import { BIOMES } from '../data/biomes.js';
import { rel } from './diplomacy.js';

export const fogOn = () => !!S()?.fog?.on;
let explored = null, visible = null, size = 0;
export const isExplored = (t) => !fogOn() || (explored && t >= 0 && explored[t] === 1);
export const isVisible = (t) => !fogOn() || (visible && t >= 0 && visible[t] === 1);
export function fogArrays() { return { explored, visible }; }
let rev = 0;
export const fogRev = () => rev;

// ---------- persistence ----------
function encode(arr) {
  const out = [];
  let cur = arr[0], n = 0;
  for (let i = 0; i < arr.length; i++) { if (arr[i] === cur) n++; else { out.push(n); cur = arr[i]; n = 1; } }
  out.push(n);
  return (arr[0] ? '1:' : '0:') + out.join(',');
}
function decode(str, N) {
  const a = new Uint8Array(N);
  if (!str) return a;
  let v = str[0] === '1' ? 1 : 0, i = 0;
  for (const part of str.slice(2).split(',')) { const n = +part; if (v) a.fill(1, i, Math.min(N, i + n)); i += n; v ^= 1; }
  return a;
}
export function fogSync() { const st = S(); if (st?.fog?.on && explored) st.fog.data = encode(explored); }
export function ensureFog(st, on = null) {
  st.fog ??= { on: on ?? false, data: '', known: [] };
  if (on != null) st.fog.on = on;
  st.fog.known ??= [];
  st.explorers ??= [];
  st.nextExplorerId ??= 1;
  size = G.world.N;
  explored = decode(st.fog.data, size);
  visible = new Uint8Array(size);
  if (st.fog.on) { if (!st.fog.data) revealStart(st); updateFog(true); }
  rev++;
}

// ---------- revealing ----------
function disc(t, r, vis) {
  const w = G.world.w, h = G.world.h;
  const cx = t % w, cy = (t / w) | 0;
  let fresh = false;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    const span = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let dx = -span; dx <= span; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= w) continue;
      const i = y * w + x;
      if (!explored[i]) { explored[i] = 1; fresh = true; }
      if (vis) visible[i] = 1;
    }
  }
  return fresh;
}
function revealStart(st) {
  const me = civOf(st.playerId);
  for (const id of me.settlements) disc(st.settlements[id].tile, 16, false);
}
// Recompute what the player sees; called every few days and after big events.
export function updateFog(force = false) {
  const st = S();
  if (!st?.fog?.on || !explored) return;
  if (!force && st.day % 3 !== 0) return;
  visible.fill(0);
  const me = st.playerId;
  const friends = new Set([me]);
  for (const c of st.civs) {
    if (!c.alive || c.id === me) continue;
    if (c.overlord === me || civOf(me).overlord === c.id || rel(me, c.id).ally) friends.add(c.id);
  }
  let fresh = false;
  for (const s of st.settlements) {
    if (s.dead || !friends.has(s.civ)) continue;
    fresh = disc(s.tile, s.civ === me ? 7 + s.stage * 2 : 5 + s.stage, true) || fresh;
    if (s.civ === me) for (const p of s.claims) { const P = G.world.provinces[p]; if (P) fresh = disc(P.center, 3, true) || fresh; }
  }
  for (const a of st.armies) if (friends.has(a.civ)) fresh = disc(a.tile, a.civ === me ? 5 : 4, true) || fresh;
  for (const f of st.fleets || []) if (friends.has(f.civ)) fresh = disc(f.tile, 6, true) || fresh;
  for (const u of st.units) if (u.civ === me) fresh = disc(u.path[u.step] ?? u.tile, 4, true) || fresh;
  for (const e of st.explorers) if (e.civ === me) fresh = disc(e.tile, 8, true) || fresh;
  if (fresh) discoverRealms();
  rev++;
}
// First sight of a foreign settlement introduces its realm
function discoverRealms() {
  const st = S();
  const known = new Set(st.fog.known);
  for (const s of st.settlements) {
    if (s.dead || s.civ === st.playerId || known.has(s.civ) || !explored[s.tile]) continue;
    known.add(s.civ);
    const c = civOf(s.civ);
    log(`🧭 We have discovered ${c.displayName} at ${s.name}.`, { civ: st.playerId, type: 'good', toast: true, tile: s.tile });
  }
  st.fog.known = [...known];
}
export function knowsRealm(id) {
  const st = S();
  if (!fogOn() || id === st.playerId) return true;
  const me = civOf(st.playerId);
  return st.fog.known.includes(id) || me.contacts?.includes(id) || me.seaContacts?.includes(id);
}

// ---------- map sharing ----------
export function revealRealm(civId, radius = 8) {
  const st = S();
  if (!fogOn()) return;
  for (const s of st.settlements) if (!s.dead && s.civ === civId) disc(s.tile, radius, false);
  discoverRealms();
  rev++;
}
export function canExchangeMaps(me, other) {
  const st = S();
  if (!fogOn()) return { ok: false, reason: 'Fog of war is off' };
  const r = rel(me, other);
  if ((r.mapsDay || -99999) > st.day - 360 * 5) return { ok: false, reason: 'Maps were exchanged recently' };
  if (r.op < -10 && !r.trade && !r.ally) return { ok: false, reason: 'They do not trust us enough (opinion too low)' };
  return { ok: true };
}
export function exchangeMaps(me, other) {
  const r0 = canExchangeMaps(me, other);
  if (!r0.ok) return r0;
  const st = S();
  rel(me, other).mapsDay = st.day;
  // they share what lies around their realm and their neighbours
  const T = civOf(other);
  revealRealm(other, 12);
  for (const n of T.contacts || []) revealRealm(n, 5);
  return { ok: true };
}
// Trade partners share maps once a year
export function fogYearly() {
  const st = S();
  if (!fogOn()) return;
  const me = st.playerId;
  for (const c of st.civs) if (c.alive && c.id !== me && (rel(me, c.id).trade || rel(me, c.id).ally)) revealRealm(c.id, 7);
}

// ---------- explorers ----------
export const explorerCost = (civ) => 30 + 15 * (civ.era || 0);
export function canSendExplorer(civ, target) {
  if (target < 0) return { ok: false, reason: 'Pick a place on the map' };
  if (S().explorers.filter((e) => e.civ === civ.id).length >= 3) return { ok: false, reason: 'At most three expeditions at a time' };
  const cost = explorerCost(civ);
  if (civ.treasury < cost) return { ok: false, reason: `Needs ${cost} gold` };
  if (!S().settlements[civ.capital]) return { ok: false, reason: 'No capital' };
  return { ok: true, cost };
}
export function sendExplorer(civ, target) {
  const r = canSendExplorer(civ, target);
  if (!r.ok) return r;
  const st = S();
  civ.treasury -= r.cost;
  const cap = st.settlements[civ.capital];
  const w = G.world.w;
  st.explorers.push({ id: st.nextExplorerId++, civ: civ.id, tile: cap.tile, x: cap.tile % w, y: (cap.tile / w) | 0, tx: target % w, ty: (target / w) | 0, days: 0, sea: civ.techs.includes('sailing') });
  return { ok: true };
}
export function explorersDaily() {
  const st = S();
  if (!st.explorers?.length) return;
  const W = G.world;
  for (const e of [...st.explorers]) {
    e.days++;
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
    if (d < 1 || e.days > 240) { st.explorers = st.explorers.filter((x) => x !== e); if (e.civ === st.playerId) log('🧭 Our expedition returns with new maps.', { civ: e.civ, type: 'info' }); continue; }
    const sp = 1.3;
    const base = Math.atan2(dy, dx);
    let moved = false;
    // steer around coasts and lakes when the expedition cannot sail
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const ang = base + turn * (e.bias || 1);
      const nx = e.x + Math.cos(ang) * Math.min(d, sp), ny = e.y + Math.sin(ang) * Math.min(d, sp);
      if (nx < 0 || ny < 0 || nx > W.w - 1 || ny > W.h - 1) continue;
      const t = Math.round(ny) * W.w + Math.round(nx);
      if (BIOMES[W.biome[t]]?.water && !e.sea) continue;
      e.x = nx; e.y = ny; e.tile = t; moved = true;
      if (turn) e.bias = turn > 0 ? 1 : -1;
      break;
    }
    if (!moved) { e.tx = e.x; e.ty = e.y; }
  }
  if (fogOn()) updateFog(true);
}
