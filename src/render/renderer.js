import { G, S } from '../sim/state.js';
import { B, BIOMES, RESOURCES } from '../data/biomes.js';
import { STAGES } from '../data/buildings.js';
import { RACES } from '../data/races.js';
import { SPECIES } from '../sim/wildlife.js';
import { stepCost } from '../sim/colonize.js';
import { visibleHouses } from '../sim/economy.js';
import { hash2 } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { TILE, bakeTerrain, bakeMinimapBase } from './terrain.js';
import { Atmosphere, seasonOf } from './fx.js';
import { People, VIEW } from './people.js';
import { Detail, hiRes } from './detail.js';
import { Tiles16 } from './tiles16.js';
import { bakeAtlas, drawCompass, APX } from './atlas.js';
import { battleScene, formation, siegeCamp, siegeAngle, isBreached, seaClash, armyCamp } from './warfx.js';
import { setSun, castShadow, snowCap } from './pixelkit.js';
import { yard16, path16, bridge16, plaza16, wall16, tower16, gate16, prop16, PROPS_BY_RACE, treehouse16, hillhome16, tent16, stilt16, boardwalk16, ropeBridge, fence16, pixelRing, townhouse16, work16, campTent8, windmill16, caravan16 } from './town16.js';
import { findPath } from '../sim/pathfind.js';
import { TerrainGL } from './terrainGL.js';
import { seasonKey } from './tiles16.js';
import { house16, special16, field16 } from './buildings16.js';
import { fogOn, isExplored, isVisible, fogArrays, fogRev, knowsRealm } from '../sim/fog.js';
import { SETTINGS } from '../ui/settings.js';
import { blockadedSet } from '../sim/naval.js';
import { Overlays, BS } from './overlays.js';
import { houseSprite, specialSprite, fieldSprites, BIG_SPRITES, iconCanvas, drawFlag } from './sprites.js';

const HOUSE_VIS = [6, 10, 20, 40, 80];
export const MAX_ZOOM = 16;
export const HD_ZOOM = 1.0; // switch to the 16×16 tileset
const SPECIAL_ORDER = ['town_hall', 'castle', 'star_fort', 'temple', 'market', 'trading_post', 'library', 'university', 'observatory', 'bank', 'hospital', 'granary', 'warehouse', 'barracks', 'brewery', 'aqueduct', 'railway_station', 'textile_mill', 'foundry', 'factory', 'power_plant', 'newspaper'];

export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimap;
    this.mctx = minimap.getContext('2d', { willReadFrequently: true });
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.mode = 'political';
    this.layouts = new Map();
    this.walkers = new Map();
    this.selected = null; // {type:'province', id}
    this.hover = -1;
    this.dpr = 1;
    this.time = 0;
    this.atmo = new Atmosphere(this);
    this.people = new People(this);
    this.detail = new Detail(this);
    this.armyDir = new Map(); // cosmetic facing, never saved
    this.godCursor = null;
  }

  setWorld(world) {
    this.world = world;
    this.terrain = bakeTerrain(world);
    this.miniBase = bakeMinimapBase(world);
    this.overlays = new Overlays(world);
    this.atmo.setWorld(world);
    this.tiles16 = new Tiles16(world);
    // Phase 22: the GPU paints the close-up ground and water (falls back to baked chunks)
    try { this.gl = SETTINGS.gpuTerrain === false ? null : new TerrainGL(world); if (this.gl && !this.gl.ok) this.gl = null; if (this.gl) this.gl.setData(this.atmo.water); } catch (e) { console.warn('GPU terrain unavailable', e); this.gl = null; }
    this.atlas = null; // baked lazily the first time we zoom far out
    this.people.reset();
    this.layouts.clear(); this.streetTiles = new Set();
    this.walkers.clear();
    this.roadTiles = new Map();
    this.miniDirty = true;
    G.dirty.owners = true;
    G.dirty.roads = true;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.vw = r.width; this.vh = r.height;
    this.clampCam();
  }

  get minZoom() { return Math.max(0.12, Math.min(this.vw / (this.world.w * TILE), this.vh / (this.world.h * TILE)) * 0.9); }

  clampCam() {
    if (!this.world) return;
    const z = this.cam.zoom = clamp(this.cam.zoom, this.minZoom, MAX_ZOOM);
    const W = this.world.w * TILE, H = this.world.h * TILE;
    const vw = this.vw / z, vh = this.vh / z;
    this.cam.x = vw >= W ? (W - vw) / 2 : clamp(this.cam.x, -vw * 0.2, W - vw * 0.8);
    this.cam.y = vh >= H ? (H - vh) / 2 : clamp(this.cam.y, -vh * 0.2, H - vh * 0.8);
  }

  // Phase 20: close up, zoom rests only where one art pixel covers a whole number of screen
  // pixels (no uneven pixels); the camera glides between those steps. Far out it stays smooth.
  // Phase 21: caravans and merchant ships ply every trade route between the two capitals
  drawCaravans(ctx, v, running) {
    const st = S(), W = this.world;
    this.routePaths ??= new Map();
    for (const r of st.routes || []) {
      const A = st.civs[r.a], Bc = st.civs[r.b];
      const sa = st.settlements[A?.capital], sb = st.settlements[Bc?.capital];
      if (!sa || !sb) continue;
      const key = `${r.id}:${sa.tile}:${sb.tile}`;
      let p = this.routePaths.get(key);
      if (p === undefined) {
        p = findPath(sa.tile, sb.tile, { mode: 'amphibious' }) || null;
        this.routePaths.set(key, p);
        if (this.routePaths.size > 200) this.routePaths.delete(this.routePaths.keys().next().value);
      }
      if (!p || p.length < 3) continue;
      // is any part of it on screen?
      const n = p.length - 1;
      const raided = r.raid && r.raid.until > st.day;
      const count = raided ? 1 : Math.min(3, r.level);
      for (let k = 0; k < count; k++) {
        let u = raided ? 0.5 : ((this.time * 0.6) / n + k / count + hash2(r.id, k, 5)) % 2;
        const back = u > 1; if (back) u = 2 - u;
        const f = u * n, i0 = Math.floor(f), fr = f - i0;
        const t0 = p[i0], t1 = p[Math.min(n, i0 + 1)];
        const x = ((t0 % W.w) + ((t1 % W.w) - (t0 % W.w)) * fr) * TILE + 4, y = (((t0 / W.w) | 0) + (((t1 / W.w) | 0) - ((t0 / W.w) | 0)) * fr) * TILE + 4;
        if (x < v.x0 - 10 || x > v.x1 + 10 || y < v.y0 - 10 || y > v.y1 + 10) continue;
        const dir = (((t1 % W.w) - (t0 % W.w)) * (back ? -1 : 1)) >= 0 ? 1 : -1;
        const X = Math.round(x * 2) / 2, Y = Math.round(y * 2) / 2;
        if (BIOMES[W.biome[t0]].water) { this.drawShip(ctx, X, Y, (back ? Bc : A).color, 0.8, false); continue; }
        if (raided) { // a burnt-out cart and smoke where the raiders struck
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(X - 3, Y - 1, 6, 2); ctx.fillStyle = '#1a120a'; ctx.fillRect(X - 2, Y - 3, 4, 2);
          if (running && Math.random() < 0.2) this.atmo.add('smoke', X, Y - 3, (Math.random() - 0.5) * 2, -5, 2.5, 1.5, 1.5, '70,64,60');
          continue;
        }
        ctx.save(); if (dir < 0) { ctx.translate(X * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(caravan16((back ? Bc : A).color, Math.floor(this.time * 4 + k) % 2), X - 4, Y - 4, 8, 5);
        ctx.restore();
        if (r.escort?.[r.a] || r.escort?.[r.b]) { ctx.fillStyle = '#9aa4ae'; ctx.fillRect(X + dir * 5, Y - 2.5, 1, 2.5); ctx.fillStyle = (back ? Bc : A).color; ctx.fillRect(X + dir * 5, Y - 3, 1, 0.5); } // a mounted guard
      }
    }
  }

  // Phase 21: what the camera sees, for the soundscape (fractions 0..1)
  soundscape() {
    const W = this.world, st = S(), A = this.atmo;
    if (!W || !st) return null;
    const z = this.cam.zoom, x0 = this.cam.x / TILE, y0 = this.cam.y / TILE, x1 = x0 + this.vw / z / TILE, y1 = y0 + this.vh / z / TILE;
    let n = 0, water = 0, coast = 0, forest = 0, open = 0, high = 0;
    for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) {
      const tx = Math.floor(x0 + ((gx + 0.5) / 9) * (x1 - x0)), ty = Math.floor(y0 + ((gy + 0.5) / 9) * (y1 - y0));
      if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) continue;
      const i = ty * W.w + tx, b = W.biome[i]; n++;
      if (BIOMES[b].water) { water++; if (A.water?.[i] === 2) coast++; }
      else if (b === B.FOREST || b === B.JUNGLE || b === B.TAIGA || b === B.SWAMP) forest++;
      else if (b === B.GRASS || b === B.PLAINS) open++;
      else if (b === B.MOUNTAIN || b === B.HILLS || b === B.SNOW || b === B.TUNDRA) high++;
    }
    if (!n) return null;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let town = 0;
    for (const t of st.settlements) { if (t.dead) continue; const d = Math.hypot((t.tile % W.w) - cx, ((t.tile / W.w) | 0) - cy); if (d < 10) town = Math.max(town, (1 - d / 10) * Math.min(1, 0.4 + t.stage * 0.2)); }
    let fire = 0;
    for (const d of st.disasters || []) if (d.until >= st.day && (d.type === 'wildfire' || d.type === 'volcano')) { const dd = Math.hypot((d.tile % W.w) - cx, ((d.tile / W.w) | 0) - cy); if (dd < 15) fire = Math.max(fire, 1 - dd / 15); }
    if (st.armies.some((a) => a.siege && !a.siege.blocked && st.settlements[a.siege.s] && Math.hypot((st.settlements[a.siege.s].tile % W.w) - cx, ((st.settlements[a.siege.s].tile / W.w) | 0) - cy) < 8)) fire = Math.max(fire, 0.5);
    const cover = SETTINGS.clouds ? A.cover(cx * TILE, cy * TILE) : 0.5;
    const month = Math.floor((st.day % 360) / 30);
    return {
      water: water / n, coast: Math.min(1, (coast / n) * 3), forest: forest / n, open: open / n, high: high / n, town, fire,
      rain: SETTINGS.weather ? Math.max(0, Math.min(1, (cover - 0.6) / 0.3)) : 0, night: Math.min(1, (A.darkness || 0) / 0.5),
      dawn: Math.abs(A.tod - 0.27) < 0.06, warm: month >= 3 && month <= 8, zoom: z,
    };
  }

  snapZoom(z) {
    const dpr = this.dpr || 1, step = 2 / dpr; // art = 2 px per world px
    if (z < Math.max(HD_ZOOM, step) * 0.97) return z;
    return clamp(Math.round(z / step) * step, step, MAX_ZOOM);
  }
  updateZoom(dt) {
    if (this.zoomGoal == null) return;
    const tgt = clamp(this.snapZoom(this.zoomGoal), this.minZoom, MAX_ZOOM);
    let nz = this.cam.zoom + (tgt - this.cam.zoom) * Math.min(1, dt * 16);
    if (Math.abs(nz - tgt) < 0.004 * tgt) { nz = tgt; this.zoomGoal = null; }
    const [sx, sy] = this.zoomAnchor || [this.vw / 2, this.vh / 2];
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = nz;
    this.cam.x = before.x - sx / nz; this.cam.y = before.y - sy / nz;
    this.clampCam();
  }

  centerOn(tile, zoom) {
    const w = this.world.w;
    if (zoom) { this.cam.zoom = this.snapZoom(zoom); this.zoomGoal = null; }
    const z = this.cam.zoom;
    this.cam.x = (tile % w) * TILE + TILE / 2 - this.vw / z / 2;
    this.cam.y = ((tile / w) | 0) * TILE + TILE / 2 - this.vh / z / 2;
    this.clampCam();
  }

  zoomAt(sx, sy, factor) {
    this.zoomGoal = clamp((this.zoomGoal ?? this.cam.zoom) * factor, this.minZoom, MAX_ZOOM);
    this.zoomAnchor = [sx, sy];
    if (this.snapZoom(this.zoomGoal) === this.zoomGoal) { // far out: smooth and immediate, as before
      const before = this.screenToWorld(sx, sy);
      this.cam.zoom = this.zoomGoal; this.zoomGoal = null;
      this.cam.x = before.x - sx / this.cam.zoom;
      this.cam.y = before.y - sy / this.cam.zoom;
      this.clampCam();
    }
  }

  onFx(e) { this.atmo.onFx(e); }
  tileVisible(t, pad = 0) {
    if (!this.world || t == null || t < 0) return false;
    return this.worldVisible((t % this.world.w) * TILE + 4, ((t / this.world.w) | 0) * TILE + 4, pad * TILE);
  }
  worldVisible(x, y, pad = 0) {
    const z = this.cam.zoom;
    return x > this.cam.x - pad && x < this.cam.x + this.vw / z + pad && y > this.cam.y - pad && y < this.cam.y + this.vh / z + pad;
  }
  // Re-bake terrain after terraforming
  terrainChanged(tiles) {
    if (!tiles?.length) return;
    const w = this.world.w;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const t of tiles) { const x = t % w, y = (t / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    bakeTerrain(this.world, { x0: x0 - 1, y0: y0 - 1, x1: x1 + 2, y1: y1 + 2 }, this.terrain);
    this.miniBase = bakeMinimapBase(this.world);
    this.miniDirty = true;
    this.layouts.clear(); this.streetTiles = new Set();
    this.tiles16?.invalidate(tiles);
    this.gl?.setData(this.atmo.water);
    this.atlas = null;
  }

  screenToWorld(sx, sy) { return { x: this.cam.x + sx / this.cam.zoom, y: this.cam.y + sy / this.cam.zoom }; }
  screenToTile(sx, sy) {
    const p = this.screenToWorld(sx, sy);
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.world.w || ty >= this.world.h) return -1;
    return ty * this.world.w + tx;
  }

  // ---------- Settlement layout ----------
  layoutFor(s) {
    const cached = this.layouts.get(s.id);
    if (cached && cached.rev === s.rev && cached.stage === s.stage) return cached;
    // Phase 18: towns on the tile grid — square streets, 2×2 halls, yards, gates in the walls
    const W = this.world;
    const { w, h, biome, province } = W;
    const st = S();
    const cx = s.tile % w, cy = (s.tile / w) | 0;
    const R = STAGES[s.stage].radius + 1;
    const civ = st.civs[s.civ];
    const race = civ.race;
    const isWater = (i) => BIOMES[biome[i]].water;
    const nearLand = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => { const xx = x + ax, yy = y + ay; return xx >= 0 && yy >= 0 && xx < w && yy < h && !isWater(yy * w + xx); });
    const cand = [];
    const byTile = new Map();
    for (let dy = -R - 2; dy <= R + 2; dy++) {
      for (let dx = -R - 2; dx <= R + 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        const b = biome[i];
        let water = false;
        if (BIOMES[b].water) {
          // lizardfolk raise stilt huts over the shallows next to their shore
          if (race !== 'lizardfolk' || b === B.DEEP || b === B.OCEAN || !nearLand(x, y)) continue;
          water = true;
        } else if (b === B.MOUNTAIN && race !== 'dwarves') continue;
        if (!water) { const pr = province[i]; const ps = st.provinces[pr]; if (!ps || (pr !== s.province && ps.owner !== s.civ)) continue; }
        const e = Math.sqrt(dx * dx + dy * dy);
        const hj = hash2(x, y, s.id);
        let d;
        if (race === 'elves') d = e * (1 + hj * 0.9) + (hj > 0.7 ? 2.5 : 0) - (b === B.FOREST || b === B.TAIGA || b === B.JUNGLE ? 0.8 : 0);
        else if (race === 'dwarves') d = Math.max(Math.abs(dx), Math.abs(dy)) * 1.05 + hj * 0.4 - (b === B.HILLS || b === B.MOUNTAIN ? 1 : 0);
        else if (race === 'orcs') d = e * 1.05 + hj * 0.7;
        else if (race === 'lizardfolk') d = e + hj * 0.9 + (water ? -0.6 : b === B.SWAMP ? -0.4 : 0.6);
        else if (race === 'halflings') d = e * 1.1 + hj * 1.4 + (b === B.HILLS ? -0.8 : 0);
        else d = e + hj * 0.9;
        const c = { i, x, y, d, b, water };
        cand.push(c); byTile.set(i, c);
      }
    }
    cand.sort((a, b) => a.d - b.d);
    const used = new Map(); // tile → what occupies it
    const at = (x, y) => byTile.get(y * w + x);
    const free = (x, y) => { const c = at(x, y); return c && !used.has(c.i) ? c : null; };
    const items = [];
    const center = byTile.get(s.tile) || cand[0];
    // the heart of town: a 2×2 hall, or a fire / well on the central tile
    let hallAt = null;
    if (center && s.buildings.town_hall) {
      for (const [ox, oy] of [[0, 0], [-1, 0], [0, 1], [-1, 1]]) {
        const ax = center.x + ox, ay = center.y + oy;
        if ([[0, 0], [1, 0], [0, -1], [1, -1]].every(([qx, qy]) => free(ax + qx, ay + qy) && !at(ax + qx, ay + qy).water)) { hallAt = [ax, ay]; break; }
      }
    }
    const takeFoot = (ax, ay, kind) => { for (const [qx, qy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) used.set((ay + qy) * w + ax + qx, kind); };
    if (hallAt) { takeFoot(hallAt[0], hallAt[1], 'big'); items.push({ kind: 'town_hall', x: hallAt[0], y: hallAt[1], big: true }); }
    else if (center) { used.set(center.i, 'plaza'); items.push({ kind: 'campfire', x: center.x, y: center.y }); }
    // a paved square around the heart in larger places (not for elves, who keep their forest)
    const plaza = [];
    if (center && s.stage >= 2 && race !== 'elves') {
      const ring = hallAt ? [[-1, 0], [2, 0], [-1, -1], [2, -1], [0, 1], [1, 1], [0, -2], [1, -2]].map(([qx, qy]) => [hallAt[0] + qx, hallAt[1] + qy]) : [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([qx, qy]) => [center.x + qx, center.y + qy]);
      for (const [x, y] of ring) { const c = free(x, y); if (c && !c.water) { used.set(c.i, 'plaza'); plaza.push({ x, y }); } }
      if (!hallAt && center) plaza.push({ x: center.x, y: center.y, well: true });
    }
    // streets: square lanes (straight runs and right-angle turns) from the heart outwards
    const streets = [];
    const streetSet = new Set();
    const addStreet = (c) => { used.set(c.i, 'street'); streets.push({ x: c.x, y: c.y, water: c.water }); streetSet.add(c.i); };
    if (center && s.stage >= 1) {
      const n = race === 'elves' ? 2 : 2 + Math.min(2, s.stage);
      const base = hash2(s.id, 3, 7) * Math.PI * 2;
      const len = Math.max(2, Math.round(R * 0.85));
      for (let k = 0; k < n; k++) {
        const a = base + (k * Math.PI * 2) / n;
        const tx = Math.round(center.x + Math.cos(a) * len), ty = Math.round(center.y + Math.sin(a) * len);
        let x = center.x, y = center.y;
        const xFirst = hash2(s.id, k, 11) < 0.5; // one bend per lane: along x then y, or y then x
        for (let step = 0; step < len * 2 + 2; step++) {
          if (x === tx && y === ty) break;
          if ((xFirst && x !== tx) || (!xFirst && y === ty)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
          const c = at(x, y);
          if (!c) break;
          if (used.has(c.i)) { if (used.get(c.i) === 'street' || used.get(c.i) === 'plaza') continue; break; }
          if (c.water && race !== 'lizardfolk') break;
          addStreet(c);
        }
      }
    }
    // other buildings: big ones take a 2×2 footprint
    const nearStreet = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => { const q = used.get((c.y + ay) * w + c.x + ax); return q === 'street' || q === 'plaza'; });
    const take = (pred) => {
      let best = null, bs = 1e9;
      for (const c of cand) {
        if (used.has(c.i) || !pred(c)) continue;
        const sc = c.d - (nearStreet(c) ? 1.2 : 0);
        if (sc < bs) { bs = sc; best = c; }
        if (c.d > bs + 2) break;
      }
      if (best) used.set(best.i, 'b');
      return best;
    };
    const takeBig = (extra = 0) => {
      for (const c of cand) {
        if (c.d > R + 1 + extra) break;
        if ([[0, 0], [1, 0], [0, -1], [1, -1]].every(([qx, qy]) => { const q = free(c.x + qx, c.y + qy); return q && !q.water; })) { takeFoot(c.x, c.y, 'big'); return c; }
      }
      return null;
    };
    for (const k of SPECIAL_ORDER) {
      const lv = s.buildings[k] || 0;
      if (!lv || k === 'town_hall') continue;
      if (BIG_SPRITES[k]) { const c = takeBig(); if (c) items.push({ kind: k, x: c.x, y: c.y, big: true }); continue; }
      const c = take((c) => c.d < R + 1 && !c.water);
      if (c) items.push({ kind: k, x: c.x, y: c.y });
    }
    // Phase 20: a windmill by the fields of farming towns
    if ((s.buildings.farm || 0) >= 2 && s.stage >= 1 && race !== 'elves' && race !== 'lizardfolk') { const c = take((c) => !c.water && c.d > 1.5 && c.d < R + 2); if (c) items.push({ kind: 'windmill', x: c.x, y: c.y }); }
    // Phase 19: great works stand as 2×2 landmarks
    for (const wid of s.works || []) { const c = takeBig(3); if (c) items.push({ kind: 'work', work: wid, x: c.x, y: c.y, big: true }); }
    // resource buildings on suitable terrain
    const rocky = (b) => b === B.HILLS || b === B.DESERT || b === B.TUNDRA;
    if (s.buildings.mine) { const c = take((c) => c.b === B.HILLS || c.b === B.MOUNTAIN) || take((c) => !c.water); if (c) items.push({ kind: 'mine', x: c.x, y: c.y }); }
    if (s.buildings.quarry) { const c = take((c) => rocky(c.b)) || take((c) => !c.water); if (c) items.push({ kind: 'quarry', x: c.x, y: c.y }); }
    if (s.buildings.lumber_camp) {
      for (let k = 0; k < Math.min(2, s.buildings.lumber_camp); k++) {
        const c = take((c) => c.b === B.FOREST || c.b === B.TAIGA || c.b === B.JUNGLE) || take((c) => !c.water);
        if (c) items.push({ kind: 'lumber_camp', x: c.x, y: c.y });
      }
    }
    if (s.buildings.port) {
      const c = take((c) => !c.water && [c.i - 1, c.i + 1, c.i - w, c.i + w].some((j) => j >= 0 && j < W.N && BIOMES[biome[j]].water && biome[j] !== B.LAKE));
      if (c) items.push({ kind: 'port', x: c.x, y: c.y });
    }
    // homes
    // Phase 19: big towns grow upward (tall town houses) instead of carpeting the region
    const nHouses = Math.max(2, Math.min([10, 24, 40, 50, 60][s.stage], Math.round(s.housing / HOUSE_VIS[s.stage])));
    const tallShare = race === 'elves' || race === 'lizardfolk' ? 0 : [0, 0, 0.15, 0.5, 0.8][s.stage];
    const tier = Math.min(3, s.stage);
    const houseTiles = [];
    const props = [];
    const kit = PROPS_BY_RACE[race] || PROPS_BY_RACE.humans;
    for (let k = 0; k < nHouses; k++) {
      const c = take((c) => (c.b !== B.SWAMP || k > 10 || race === 'lizardfolk') && (!c.water || race === 'lizardfolk'));
      if (!c) break;
      const t = s.stage >= 2 && hash2(c.x, c.y, 5) < 0.3 ? tier - 1 : tier;
      const hh = hash2(c.x, c.y, 91);
      items.push({ kind: 'house', x: c.x, y: c.y, tier: Math.max(0, t), water: c.water, hill: c.b === B.HILLS || c.b === B.MOUNTAIN, tall: hh < tallShare ? (s.stage >= 4 && hh < tallShare * 0.5 ? 3 : 2) : 0, v: (hash2(c.x, c.y, 93) * 3) | 0 });
      houseTiles.push(c);
      // a little clutter in some yards: the only things allowed off the grid
      const ph = hash2(c.x, c.y, 77);
      if (ph < 0.45 && !c.water && race !== 'elves') props.push({ kind: kit[(ph * 97 | 0) % kit.length], x: c.x * TILE + (ph < 0.22 ? 5.5 : -1.5), y: c.y * TILE + 4.5 + hash2(c.y, c.x, 78) * 1.5 });
      else if (race === 'elves' && ph < 0.25) props.push({ kind: 'flowers', x: c.x * TILE + 4.5, y: c.y * TILE + 5 });
    }
    // lizardfolk boardwalks: a stilt hut off the shore is linked by planks to the nearest street or land
    const boardwalks = [];
    if (race === 'lizardfolk') for (const hT of houseTiles) {
      if (!hT.water) continue;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = at(hT.x + ax, hT.y + ay); if (c && c.water && !used.has(c.i)) { used.set(c.i, 'bw'); boardwalks.push({ x: c.x, y: c.y, hz: ax !== 0 }); break; } }
    }
    // fields
    const fields = [];
    const nFields = Math.min(4 + s.stage * 3, (s.buildings.farm || 0) * (2 + s.stage * 2) + (s.stage > 0 ? 2 : 0));
    for (let k = 0; k < nFields; k++) {
      const c = take((c) => !c.water && (c.b === B.GRASS || c.b === B.PLAINS || c.b === B.BEACH));
      if (!c) break;
      used.set(c.i, 'field');
      fields.push({ x: c.x, y: c.y, v: (hash2(c.x, c.y, 3) * 3) | 0 });
    }
    // walls around the inhabited core; a gate where a street or road leaves town
    const walls = [];
    if (s.buildings.walls || race === 'orcs' && s.stage >= 1) {
      const core0 = new Set();
      for (const [i, k] of used) if (k !== 'field' && k !== 'bw') core0.add(i);
      for (const it of items) if (['mine', 'quarry', 'lumber_camp', 'port'].includes(it.kind)) core0.delete(it.y * w + it.x);
      // smooth the outline: fill every row and column between its outermost tiles, so the wall
      // runs in long straight stretches instead of tracing each house
      const core = new Set(core0);
      for (let pass = 0; pass < 2; pass++) {
        const rows = new Map(), cols = new Map();
        for (const i of core) { const x = i % w, y = (i / w) | 0; const r = rows.get(y) || [x, x]; rows.set(y, [Math.min(r[0], x), Math.max(r[1], x)]); const c = cols.get(x) || [y, y]; cols.set(x, [Math.min(c[0], y), Math.max(c[1], y)]); }
        for (const [y, [a1, b1]] of rows) for (let x = a1; x <= b1; x++) { const c = at(x, y); if (c && !c.water) core.add(y * w + x); }
        for (const [x, [a1, b1]] of cols) for (let y = a1; y <= b1; y++) { const c = at(x, y); if (c && !c.water) core.add(y * w + x); }
      }
      const roadT = this.roadTileSet || new Set();
      for (const i of core) {
        const x = i % w, y = (i / w) | 0;
        const gateIf = (j) => (streetSet.has(i) || used.get(i) === 'plaza') && (roadT.has(j) || streetSet.has(j));
        if (!core.has(i - 1)) walls.push([x, y, 0, 1, gateIf(i - 1)]);
        if (!core.has(i + 1)) walls.push([x + 1, y, 0, 1, gateIf(i + 1)]);
        if (!core.has(i - w)) walls.push([x, y, 1, 0, gateIf(i - w)]);
        if (!core.has(i + w)) walls.push([x, y + 1, 1, 0, gateIf(i + w)]);
      }
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    props.sort((a, b) => a.y - b.y);
    const L = { rev: s.rev, stage: s.stage, items, fields, walls, race, houseTiles, center, streets, streetSet, plaza, props, boardwalks, used, palisade: race === 'orcs' };
    this.streetTiles ??= new Set();
    for (const t of streetSet) this.streetTiles.add(t);
    for (const p of plaza) this.streetTiles.add(p.y * w + p.x);
    this.layouts.set(s.id, L);
    return L;
  }

  draw(dt, dayFrac, simRunning) {
    this._running = simRunning;
    this.updateZoom(dt);
    setSun(this.atmo.tod, this.atmo.darkness || 0);
    const ctx = this.ctx;
    const st = S();
    const W = this.world;
    this.time += dt;
    if (G.dirty.owners) { this.overlays.rebuildOwners(); G.dirty.owners = false; this.miniDirty = true; this.overlays.edgeCache.clear(); }
    if (G.dirty.roads) { this.rebuildRoads(); G.dirty.roads = false; }
    if (['population', 'development', 'resources', 'military', 'unrest'].includes(this.mode) && (this.overlays.heatMode !== this.mode || st.day - (this.heatDay ?? -999) >= 30)) {
      this.overlays.rebuildHeat(this.mode);
      this.heatDay = st.day;
    }

    const dpr = this.dpr, z = this.cam.zoom;
    this.atmo.update(dt, simRunning);
    const [shx, shy] = this.atmo.shakeOffset();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, Math.round((-this.cam.x * z + shx) * dpr), Math.round((-this.cam.y * z + shy) * dpr)); // whole device pixels: no shimmer
    ctx.imageSmoothingEnabled = false;

    const x0 = Math.max(0, this.cam.x), y0 = Math.max(0, this.cam.y);
    const x1 = Math.min(W.w * TILE, this.cam.x + this.vw / z), y1 = Math.min(W.h * TILE, this.cam.y + this.vh / z);
    if (x1 <= x0 || y1 <= y0) return;
    const hd = z >= HD_ZOOM && SETTINGS.hdTiles !== false;
    const useGL = hd && this.gl && SETTINGS.gpuTerrain !== false && z * dpr >= 3; // far out the cached blocks are cheaper
    if (useGL) {
      // the GPU ground goes down first, aligned to the same whole-pixel camera as everything else
      const zd = z * dpr, txp = Math.round((-this.cam.x * z + shx) * dpr), typ = Math.round((-this.cam.y * z + shy) * dpr);
      const sk = seasonKey(st.day);
      const g = this.gl.render(this.canvas.width, this.canvas.height, -txp / zd, -typ / zd, zd, sk.season, sk.snow, this.atmo.time, W.seed);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(g.img, Math.round(g.x), Math.round(g.y), Math.round(g.w), Math.round(g.h)); ctx.restore();
    } else ctx.drawImage(this.terrain, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    if (this.tiles16 && this.tiles16.objectsOnly !== !!useGL) { this.tiles16.objectsOnly = !!useGL; this.tiles16.last?.clear(); }
    const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
    const tx1 = Math.ceil(x1 / TILE), ty1 = Math.ceil(y1 / TILE);
    VIEW.hd = hd;
    const view = { x0, y0, x1, y1, tx0, ty0, tx1, ty1, z, dpr, dayFrac, hd };
    if (hd) this.tiles16.draw(ctx, view, st.day);
    this.atmo.drawGround(ctx, view);
    // Phase 16: far out, the world becomes an illustrated atlas
    const atlasA = SETTINGS.atlas !== false ? clamp((0.78 - z) / 0.3, 0, 1) : 0;
    this.atlasA = atlasA;
    if (atlasA > 0) {
      if (!this.atlas) this.atlas = bakeAtlas(W);
      ctx.globalAlpha = atlasA;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.atlas, x0 / TILE * APX, y0 / TILE * APX, (x1 - x0) / TILE * APX, (y1 - y0) / TILE * APX, x0, y0, x1 - x0, y1 - y0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
    if (!hd && z >= 2.6 && SETTINGS.detailTrees !== false) this.detail.drawTrees(ctx, view, st.day);

    // Roads
    if (z > 0.3) this.drawRoads(ctx, x0, y0, x1, y1);

    // Map mode overlays
    const sw = tx1 - tx0, sh = ty1 - ty0;
    if ((this.mode === 'political' || this.mode === 'trade') && (!hd || z < 1.8)) {
      ctx.globalAlpha = hd ? 0.16 : clamp(0.62 - z * 0.22, z >= 3 ? 0.07 : 0.14, 0.55);
      ctx.imageSmoothingEnabled = true; // soft watercolour washes instead of tile blocks
      ctx.drawImage(this.overlays.owner, tx0, ty0, sw, sh, tx0 * TILE, ty0 * TILE, sw * TILE, sh * TILE);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    } else if (this.overlays.heatMode === this.mode) {
      ctx.globalAlpha = 0.78;
      ctx.drawImage(this.overlays.heat, tx0, ty0, sw, sh, tx0 * TILE, ty0 * TILE, sw * TILE, sh * TILE);
      ctx.globalAlpha = 1;
    }
    if (this.mode !== 'terrain' || z < 1.2) {
      ctx.globalAlpha = this.mode === 'terrain' ? 0.6 : hd ? (z >= 2.5 ? 0.3 : 0.5) : 1; // Phase 20: quieter borders close up
      const f = TILE / BS;
      ctx.imageSmoothingEnabled = z < 2; // painted, soft-edged borders
      ctx.drawImage(this.overlays.border, tx0 * BS, ty0 * BS, sw * BS, sh * BS, tx0 * TILE, ty0 * TILE, sw * TILE, sh * TILE);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      void f;
    }
    if (z >= 1.5 && SETTINGS.statusMarkers !== false) this.drawFrontier(ctx, x0, y0, x1, y1);

    // Selection / hover outline
    const outline = (p, color) => {
      ctx.fillStyle = color;
      for (const [x, y, ww, hh] of this.overlays.provinceEdges(p)) ctx.fillRect(x * TILE, y * TILE, ww * TILE, hh * TILE);
    };
    if (this.hover >= 0 && (!this.selected || this.selected.id !== this.hover)) outline(this.hover, 'rgba(255,255,255,0.35)');
    if (this.selected) outline(this.selected.id, `rgba(255,236,150,${0.75 + 0.25 * Math.sin(this.time * 5)})`);

    // Resource icons
    if (this.mode === 'resources') this.drawResources(ctx, tx0, ty0, tx1, ty1, z);

    // Settlements
    const detail = z >= 0.55;
    for (const s of st.settlements) {
      if (s.dead || !isExplored(s.tile)) continue;
      const sx = (s.tile % W.w) * TILE, sy = ((s.tile / W.w) | 0) * TILE;
      if (sx < x0 - 80 || sx > x1 + 80 || sy < y0 - 80 || sy > y1 + 80) continue;
      this.atmo.light(sx + 4, sy + 4, 12 + s.stage * 10 + Math.min(30, s.pop / 30), 1);
      if (detail) this.drawSettlement(ctx, s, z, dt, simRunning);
    }

    // Wildlife
    if (z >= 0.9 && SETTINGS.showWildlife) this.people.wildlife(ctx, view, dayFrac, isVisible);

    this.atmo.drawLife(ctx, view);
    this.atmo.drawNature(ctx, view); // Phase 20: dawn mist, fireflies, stars on water
    if (z >= 0.9 && SETTINGS.ambientLife) this.drawCaravans(ctx, view, simRunning); // Phase 21

    // Units (settlers)
    for (const u of st.units) if (isVisible(u.path[u.step] ?? u.tile)) this.drawUnit(ctx, u, z);
    this.drawExplorers(ctx, z);

    // Trade & alliance routes
    if (this.mode === 'trade') this.drawRoutes(ctx, z);

    // Armies, battles, sieges
    this.drawBattles(ctx, z, simRunning);
    this.drawFleetsWorld(ctx, z, dayFrac);
    this.drawArmiesWorld(ctx, z, dayFrac);
    this.people.drawArrows(ctx, simRunning ? dt : 0);
    if ((this._prune = (this._prune || 0) + 1) % 120 === 0) this.people.pruneBattles();
    for (const a of st.armies) if (!a.battle || a.battle < 0) { const t = a.tile; this.atmo.light((t % W.w) * TILE + 4, ((t / W.w) | 0) * TILE + 4, 12, 2); }

    // Disasters, particles, clouds
    this.atmo.drawEffects(ctx, view, simRunning);
    if (this.godCursor) this.drawGodCursor(ctx);
    this.drawFog(ctx, view);
    this.atmo.drawSky(ctx, view);
    this.atmo.drawScreen(ctx, view);

    // ---- Screen-space labels ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.atlasA > 0.05) drawCompass(ctx, this.vw - 70, this.vh - 330, 26, this.atlasA * 0.9);
    this.drawLabels(ctx, z);
    this.drawArmyBadges(ctx, z, dayFrac);
    this.drawMinimap();
  }

  // Close-up detail: crops that grow with the seasons, fences around the fields
  drawFieldDetail(ctx, L, z, fencesOnly = false) {
    const day = S().day % 360;
    const m = Math.floor(day / 30);
    const se = seasonOf(day);
    // crop stage by month: 0-1 winter, 2-3 sprouts, 4-5 green, 6-7 golden, 8 harvested stubble, 9-11 bare
    const stage = m <= 1 || m >= 10 ? 0 : m <= 3 ? 1 : m <= 5 ? 2 : m <= 7 ? 3 : m === 8 ? 4 : 0;
    const set = new Set(L.fields.map((f) => f.y * 100000 + f.x));
    for (const f of L.fields) {
      const X = f.x * TILE, Y = f.y * TILE;
      if (fencesOnly) { this.fence(ctx, f, set, X, Y, z); continue; }
      if (stage === 0) {
        const snowy = se.snowMild > 0.3 || se.snowCold > 0.5;
        ctx.fillStyle = snowy ? 'rgba(236,240,248,0.5)' : 'rgba(120,88,54,0.5)'; ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = snowy ? 'rgba(150,130,110,0.45)' : 'rgba(80,56,34,0.55)';
        for (let r = 0; r < 4; r++) ctx.fillRect(X, Y + 1.5 + r * 2, TILE, 0.45);
      }
      for (let r = 0; r < 4; r++) {
        const ry = Y + 1 + r * 2;
        if (stage === 1) { ctx.fillStyle = '#8fd060'; for (let k = 0; k < 4; k++) ctx.fillRect(X + 0.6 + k * 2, ry, 0.5, 0.5); }
        else if (stage === 2) { ctx.fillStyle = '#5aa83a'; for (let k = 0; k < 4; k++) ctx.fillRect(X + 0.4 + k * 2, ry - 0.6, 0.9, 1.1); }
        else if (stage === 3) { for (let k = 0; k < 4; k++) { ctx.fillStyle = '#e6c048'; ctx.fillRect(X + 0.4 + k * 2, ry - 0.9, 0.9, 1.3); ctx.fillStyle = '#c8962a'; ctx.fillRect(X + 0.5 + k * 2, ry - 1, 0.6, 0.35); } }
        else if (stage === 4) { ctx.fillStyle = '#b89a5a'; for (let k = 0; k < 4; k++) ctx.fillRect(X + 0.6 + k * 2, ry, 0.4, 0.4); if (r === 1) { ctx.fillStyle = '#d8b84a'; ctx.fillRect(X + 3, ry - 1, 1.4, 1.6); } }
      }
      if (z >= 3) this.fence(ctx, f, set, X, Y, z);
      if (false) {
        ctx.fillStyle = '#7a5a36';
        const edge = (dx, dy) => !set.has((f.y + dy) * 100000 + f.x + dx);
        if (edge(0, -1)) { ctx.fillRect(X, Y, TILE, 0.25); for (let k = 0; k <= 8; k += 2) ctx.fillRect(X + k - 0.15, Y - 0.5, 0.3, 0.8); }
        if (edge(0, 1)) { ctx.fillRect(X, Y + TILE - 0.25, TILE, 0.25); for (let k = 0; k <= 8; k += 2) ctx.fillRect(X + k - 0.15, Y + TILE - 0.6, 0.3, 0.8); }
        if (edge(-1, 0)) ctx.fillRect(X, Y, 0.25, TILE);
        if (edge(1, 0)) ctx.fillRect(X + TILE - 0.25, Y, 0.25, TILE);
      }
    }
  }
  fence(ctx, f, set, X, Y, z) {
    if (z < 3) return;
    ctx.fillStyle = '#7a5a36';
    const edge = (dx, dy) => !set.has((f.y + dy) * 100000 + f.x + dx);
    if (edge(0, -1)) { ctx.fillRect(X, Y, TILE, 0.25); for (let k = 0; k <= 8; k += 2) ctx.fillRect(X + k - 0.15, Y - 0.5, 0.3, 0.8); }
    if (edge(0, 1)) { ctx.fillRect(X, Y + TILE - 0.25, TILE, 0.25); for (let k = 0; k <= 8; k += 2) ctx.fillRect(X + k - 0.15, Y + TILE - 0.6, 0.3, 0.8); }
    if (edge(-1, 0)) ctx.fillRect(X, Y, 0.25, TILE);
    if (edge(1, 0)) ctx.fillRect(X + TILE - 0.25, Y, 0.25, TILE);
  }
  // Phase 18: the town's ground on the tile grid — yards, square streets, plaza, boardwalks
  drawTownGround(ctx, s, L, snowy) {
    const w = this.world.w;
    const st = s.stage >= 2 ? (S().civs[s.civ].era >= 3 ? 2 : 1) : 0;
    // yards: clean ground under every building tile (covers trees and rocks baked into the terrain)
    if (L.race !== 'elves') for (const [i, k] of L.used) { if (k === 'b' || k === 'big') { const x = i % w, y = (i / w) | 0; const c = this.world.biome[i]; if (BIOMES[c].water) continue; ctx.drawImage(yard16((x * 7 + y * 3) % 3, snowy), x * TILE, y * TILE, TILE, TILE); } }
    else for (const it of L.items) if (it.kind !== 'house' && it.kind !== 'campfire') { const fs = it.big ? [[0, 0], [1, 0], [0, -1], [1, -1]] : [[0, 0]]; for (const [qx, qy] of fs) ctx.drawImage(yard16(0, snowy), (it.x + qx) * TILE, (it.y + qy) * TILE, TILE, TILE); }
    for (const p of L.streets) {
      const t = p.y * w + p.x;
      const m = this.pathMask(t, L.streetSet);
      if (p.water) ctx.drawImage(boardwalk16((m & 10) !== 0), p.x * TILE, p.y * TILE, TILE, TILE);
      else ctx.drawImage(path16(m, st, 3), p.x * TILE, p.y * TILE, TILE, TILE);
    }
    for (const p of L.plaza) ctx.drawImage(plaza16(p.well ? (s.stage >= 3 ? 'fountain' : 'well') : ''), p.x * TILE, p.y * TILE, TILE, TILE);
    for (const b of L.boardwalks) ctx.drawImage(boardwalk16(b.hz), b.x * TILE, b.y * TILE, TILE, TILE);
  }
  // fences round the edge of each farm plot, a scarecrow here and there
  drawPlots(ctx, L) {
    const w = this.world.w;
    const isF = new Set(L.fields.map((f) => f.y * w + f.x));
    for (const f of L.fields) {
      const t = f.y * w + f.x;
      const m = (isF.has(t - w) ? 0 : 1) | (isF.has(t + 1) ? 0 : 2) | (isF.has(t + w) ? 0 : 4) | (isF.has(t - 1) ? 0 : 8);
      if (m) ctx.drawImage(fence16(m), f.x * TILE, f.y * TILE, TILE, TILE);
      if (hash2(f.x, f.y, 61) < 0.12) ctx.drawImage(prop16('scarecrow'), f.x * TILE + 2, f.y * TILE + 1, 4, 4);
    }
  }
  // the right home for each people
  homeSprite(L, it) {
    if (it.tall && !(L.race === 'dwarves' && it.hill)) return { img: townhouse16(L.race, it.tall, (it.x + it.y) & 1), dx: 0, dy: -TILE / 2, w: TILE, h: TILE * 1.5 };
    switch (L.race) {
      case 'elves': return { img: treehouse16(it.tier), dx: 0, dy: -4, w: TILE, h: TILE * 1.5 };
      case 'dwarves': return { img: it.hill || it.tier <= 1 ? hillhome16(it.tier, false) : house16(L.race, it.tier, it.v || 0) };
      case 'orcs': return { img: it.tier <= 2 ? tent16(it.tier, S().civs[L.civ ?? 0]?.color || '#c0392b') : house16(L.race, it.tier, it.v || 0) };
      case 'lizardfolk': return { img: it.water || it.tier >= 1 ? stilt16(it.tier) : house16(L.race, it.tier, it.v || 0) };
      default: return { img: house16(L.race, it.tier, it.v || 0) };
    }
  }
  // walls on tile edges: stone (or orc palisade) pieces, towers at the corners, gates on streets
  drawTileWalls(ctx, s, L) {
    if (!L.walls.length) return;
    const sieger = S().armies.find((a) => a.siege && a.siege.s === s.id && !a.siege.blocked);
    const bang = sieger ? siegeAngle(s, sieger, this.world.w) : 0, bprog = sieger?.siege.progress || 0;
    const cxw = (s.tile % this.world.w) + 0.5, cyw = ((s.tile / this.world.w) | 0) + 0.5;
    const pal = L.palisade;
    const corners = new Map();
    const hzs = [], vts = [];
    for (const [x, y, hz, vt, gate] of L.walls) {
      const broken = sieger && isBreached([x + (hz ? 0.5 : 0), y + (hz ? 0 : 0.5)], cxw, cyw, bang, bprog);
      (hz ? hzs : vts).push([x, y, gate, broken]);
      for (const k of hz ? [`${x},${y}`, `${x + 1},${y}`] : [`${x},${y}`, `${x},${y + 1}`]) { const c = corners.get(k) || { h: 0, v: 0 }; if (hz) c.h++; else c.v++; corners.set(k, c); }
    }
    for (const [x, y, gate, broken] of vts) ctx.drawImage(gate ? gate16(false, pal) : wall16(false, pal, broken), x * TILE - TILE / 2, y * TILE, TILE, TILE);
    for (const [x, y, gate, broken] of hzs) ctx.drawImage(gate ? gate16(true, pal) : wall16(true, pal, broken), x * TILE, y * TILE - TILE / 2, TILE, TILE);
    // towers where the wall turns — but not on every step of a staircase
    let n = 0;
    for (const [k, c] of corners) if (c.h && c.v) { const [x, y] = k.split(',').map(Number); if ((x + y) % 2 && n++ % 2) continue; ctx.drawImage(tower16(pal), x * TILE - TILE * 0.5, y * TILE - TILE * 0.5 - 1, TILE, TILE); }
  }

  // Close-up detail on houses: door, windows, chimney
  houseDetail(ctx, it) {
    const X = it.x * TILE + (it.ox || 0), Y = it.y * TILE + (it.oy || 0);
    const h = hash2(it.x, it.y, 77);
    const lit = (this.atmo.darkness || 0) > 0.3;
    ctx.fillStyle = '#3a2416'; ctx.fillRect(X + 3.4, Y + 5.6, 1.2, 2.2);
    ctx.fillStyle = '#c8a050'; ctx.fillRect(X + 4.25, Y + 6.6, 0.2, 0.2);
    ctx.fillStyle = lit ? '#ffd27a' : '#9cc8e8';
    ctx.fillRect(X + 1.4, Y + 5.4, 1, 0.9); ctx.fillRect(X + 5.6, Y + 5.4, 1, 0.9);
    ctx.fillStyle = 'rgba(60,40,30,0.6)'; ctx.fillRect(X + 1.85, Y + 5.4, 0.1, 0.9); ctx.fillRect(X + 6.05, Y + 5.4, 0.1, 0.9);
    if (h < 0.5) { ctx.fillStyle = '#6e5a4a'; ctx.fillRect(X + 5.6, Y + 0.6, 0.9, 1.6); }
    if (h > 0.7) { ctx.fillStyle = '#c04a3a'; ctx.fillRect(X + 0.6, Y + 7.2, 0.5, 0.5); ctx.fillStyle = '#5a9a3a'; ctx.fillRect(X + 0.6, Y + 7.6, 0.5, 0.3); }
  }

  // ---------- Phase 15: at-a-glance status of a settlement ----------
  statusOf(s) {
    const st = S();
    const out = [];
    if (s.queue.length) { const q = s.queue[0]; out.push([`🔨${Math.round((q.progress / Math.max(1, q.total)) * 100)}%`, '#e6c068']); }
    else if (st.day > 60) out.push(['💤 idle', '#a8977a']);
    if (s.occ && s.occ.by !== s.civ) out.push(['⚑ occupied', '#e46b5a']);
    if (st.armies.some((a) => a.siege && a.siege.s === s.id && !a.siege.blocked)) out.push(['🏰 siege', '#e46b5a']);
    if (s.plague && s.plague.until > st.day) out.push(['☣ plague', '#9bd36a']);
    if ((s.foodSat ?? 1) < 0.8) out.push(['🍞 hunger', '#e46b5a']);
    if ((s.unrest || 0) >= 40) out.push([`⚠ unrest ${Math.round(s.unrest)}`, s.unrest >= 70 ? '#e46b5a' : '#e0a050']);
    return out;
  }
  // Floating notes over the map (things that just happened to us)
  floatText(tile, text, color = '#f4ecd8') {
    this.floats ??= [];
    this.floats.push({ tile, text: text.length > 34 ? text.slice(0, 33) + '…' : text, color, t: 0 });
    if (this.floats.length > 12) this.floats.shift();
  }
  drawFloats(ctx, z) {
    if (!this.floats?.length) return;
    const W = this.world;
    ctx.font = '700 12px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      f.t += 1 / 60;
      const x = ((f.tile % W.w) * TILE + 4 - this.cam.x) * z, y = ((((f.tile / W.w) | 0) * TILE + 4 - this.cam.y) * z) - 26 - f.t * 14;
      const a = Math.max(0, Math.min(1, 3.2 - f.t));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,6,0.85)'; ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.t < 3.3);
    ctx.textAlign = 'left';
  }

  // ---------- Fog of war ----------
  rebuildFog() {
    const W = this.world, { explored, visible } = fogArrays();
    if (!explored) return;
    const w = W.w, h = W.h;
    if (!this.fogCanvas || this.fogCanvas.width !== w * 2) { this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = w * 2; this.fogCanvas.height = h * 2; }
    const ctx = this.fogCanvas.getContext('2d');
    const img = ctx.createImageData(w * 2, h * 2);
    const d = img.data;
    const seed = W.seed & 0xffff;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let a = 0, r = 10, g = 9, b = 14;
        if (!explored[i]) {
          // edge tiles next to charted land are dithered for a soft pixel coastline of the unknown
          const edge = (x > 0 && explored[i - 1]) || (x < w - 1 && explored[i + 1]) || (y > 0 && explored[i - w]) || (y < h - 1 && explored[i + w]);
          const n = hash2(x, y, seed + 3);
          r = 22 + n * 10; g = 18 + n * 8; b = 14 + n * 6; a = edge ? -1 : 255;
        } else if (!visible[i]) a = 92;
        for (let k = 0; k < 4; k++) {
          const px = x * 2 + (k & 1), py = y * 2 + (k >> 1);
          const o = (py * w * 2 + px) * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = b;
          d[o + 3] = a === -1 ? (((px + py) & 1) ? 255 : 150) : a;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    this.fogBuiltRev = fogRev();
    this.miniDirty = true;
  }
  drawFog(ctx, v) {
    if (!fogOn()) return;
    if (this.fogBuiltRev !== fogRev() || G.dirty.fog) { this.rebuildFog(); G.dirty.fog = false; }
    if (!this.fogCanvas) return;
    ctx.imageSmoothingEnabled = false;
    const sx = v.tx0 * 2, sy = v.ty0 * 2, sw = (v.tx1 - v.tx0) * 2, sh = (v.ty1 - v.ty0) * 2;
    ctx.drawImage(this.fogCanvas, sx, sy, sw, sh, v.tx0 * TILE, v.ty0 * TILE, (v.tx1 - v.tx0) * TILE, (v.ty1 - v.ty0) * TILE);
  }
  drawExplorers(ctx, z) {
    const st = S();
    if (!st.explorers?.length || z < 0.5) return;
    const W = this.world;
    for (const e of st.explorers) {
      if (e.civ !== st.playerId) continue;
      const x = e.x * TILE + 4, y = e.y * TILE + 5;
      const civ = st.civs[e.civ];
      const water = BIOMES[W.biome[e.tile]]?.water;
      if (water) this.drawShip(ctx, x, y, civ.color, 0.7, true);
      else {
        for (let k = 0; k < 2; k++) {
          const ox = x - 1.5 + k * 2.4;
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ox - 0.7, y + 0.2, 1.6, 0.4);
          ctx.fillStyle = '#6b5236'; ctx.fillRect(ox - 0.5, y - 2.2, 1.1, 1.4);
          ctx.fillStyle = RACES[civ.race].skin; ctx.fillRect(ox - 0.35, y - 3, 0.75, 0.75);
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(ox - 0.4, y - 0.8, 0.3, 0.8); ctx.fillRect(ox + 0.2, y - 0.8, 0.3, 0.8);
        }
        ctx.fillStyle = '#c9a050'; ctx.fillRect(x + 1.8, y - 4.2, 0.25, 4); ctx.fillStyle = civ.color; ctx.fillRect(x + 2.05, y - 4.2, 1.6, 1);
      }
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      for (let t = 0.25; t < 1; t += 0.25) ctx.fillRect((e.x + (e.tx - e.x) * t) * TILE + 3.6, (e.y + (e.ty - e.y) * t) * TILE + 3.6, 0.8, 0.8);
    }
  }

  drawGodCursor(ctx) {
    const W = this.world, c = this.godCursor;
    const x = (c.tile % W.w) * TILE + 4, y = ((c.tile / W.w) | 0) * TILE + 4;
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 6);
    pixelRing(ctx, x, y, Math.max(3, c.r * TILE), `rgba(255,230,140,${pulse})`, { dashed: true });
    ctx.fillStyle = `rgba(255,230,140,${pulse})`;
    ctx.fillRect(x - 0.5, y - 3, 1, 6); ctx.fillRect(x - 3, y - 0.5, 6, 1);
  }

  // ---------- Map editor view ----------
  drawEditor(ed, dt) {
    const ctx = this.ctx;
    const W = this.world;
    this.time += dt;
    const dpr = this.dpr, z = this.cam.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, -this.cam.x * z * dpr, -this.cam.y * z * dpr);
    ctx.imageSmoothingEnabled = false;
    const x0 = Math.max(0, this.cam.x), y0 = Math.max(0, this.cam.y);
    const x1 = Math.min(W.w * TILE, this.cam.x + this.vw / z), y1 = Math.min(W.h * TILE, this.cam.y + this.vh / z);
    if (x1 > x0 && y1 > y0) ctx.drawImage(this.terrain, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    if (ed.showProvinces && ed.provCanvas) {
      ctx.globalAlpha = 0.38;
      ctx.drawImage(ed.provCanvas, 0, 0, W.w, W.h, 0, 0, W.w * TILE, W.h * TILE);
      ctx.globalAlpha = 1;
    }
    // resources
    const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE), tx1 = Math.ceil(x1 / TILE), ty1 = Math.ceil(y1 / TILE);
    if (ed.tool === 'resource') this.drawResources(ctx, tx0, ty0, tx1, ty1, z);
    // brush outline
    if (ed.hover >= 0 && ed.tool !== 'civ') {
      const r = ed.tool === 'terrain' ? ed.brush - 1 : 0;
      const hx = ed.hover % W.w, hy = (ed.hover / W.w) | 0;
      pixelRing(ctx, (hx + 0.5) * TILE, (hy + 0.5) * TILE, (r + 0.5) * TILE, ed.erase ? 'rgba(255,120,100,0.9)' : 'rgba(255,240,180,0.9)', { px: Math.max(0.5, 1 / z) });
    }
    // civilization banners
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ed.meta.starts.forEach((s, i) => {
      const sx = ((s.tile % W.w) * TILE + 4 - this.cam.x) * z, sy = (((s.tile / W.w) | 0) * TILE + 4 - this.cam.y) * z;
      if (sx < -60 || sy < -60 || sx > this.vw + 60 || sy > this.vh + 60) return;
      ctx.fillStyle = '#1b140e'; ctx.fillRect(sx - 1, sy - 22, 2.5, 24);
      ctx.fillStyle = s.color; ctx.fillRect(sx + 1.5, sy - 22, 14, 9);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx + 1.5, sy - 14, 14, 1);
      if (ed.selected === i) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.strokeRect(sx - 4, sy - 25, 23, 30); }
      ctx.font = '600 11px "Pixelify Sans", monospace';
      const label = `${s.name} · ${RACES[s.race].name}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(14,10,8,0.8)'; ctx.fillRect(sx - tw / 2 - 4, sy + 5, tw + 8, 14);
      ctx.fillStyle = '#f4ecd8'; ctx.fillText(label, sx, sy + 12.5);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // minimap
    const m = this.minimap, mctx = this.mctx;
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(this.miniBase, 0, 0, m.width, m.height);
    const msx = m.width / (W.w * TILE), msy = m.height / (W.h * TILE);
    mctx.strokeStyle = '#ffe9a8'; mctx.lineWidth = 1;
    mctx.strokeRect(this.cam.x * msx + 0.5, this.cam.y * msy + 0.5, (this.vw / z) * msx, (this.vh / z) * msy);
  }

  armyPos(a, dayFrac) {
    const w = this.world.w;
    const fx = (a.pt % w) + ((a.tile % w) - (a.pt % w)) * dayFrac;
    const fy = ((a.pt / w) | 0) + (((a.tile / w) | 0) - ((a.pt / w) | 0)) * dayFrac;
    return [fx * TILE + 4, fy * TILE + 4];
  }

  drawArmiesWorld(ctx, z, dayFrac) {
    const st = S();
    const W = this.world;
    for (const a of st.armies) {
      if (!isVisible(a.tile)) continue;
      const civ = st.civs[a.civ];
      const [x, y] = this.armyPos(a, dayFrac);
      // Remaining path for the selected army (or any player army)
      if (a.path.length && (this.selectedArmy === a.id || civ.isPlayer)) {
        ctx.fillStyle = this.selectedArmy === a.id ? 'rgba(255,230,120,0.9)' : 'rgba(255,230,120,0.4)';
        for (let k = a.step + 1; k < a.path.length; k++) {
          const p = a.path[k];
          ctx.fillRect((p % W.w) * TILE + 3, ((p / W.w) | 0) * TILE + 3, 2, 2);
        }
        const end = a.path[a.path.length - 1];
        ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 1;
        ctx.strokeRect((end % W.w) * TILE + 0.5, ((end / W.w) | 0) * TILE + 0.5, TILE - 1, TILE - 1);
      }
      if (z < 0.9) continue;
      if (BIOMES[W.biome[a.tile]].water) { this.drawShip(ctx, x, y, civ.color, 0.8, true); continue; }
      if (a.path.length) { const nx = a.path[Math.min(a.path.length - 1, a.step + 1)] % W.w, cx = a.tile % W.w; if (nx !== cx) this.armyDir.set(a.id, nx > cx ? 1 : -1); }
      if (z >= 1.4) {
        if (a.battle >= 0 && st.battles.some((b) => b.id === a.battle && !b.ended)) continue; // drawn by the battle
        if (a.retreating && a.path.length) formation(ctx, this.people, a, x, y + 2, civ, this.armyDir.get(a.id) || 1, this.time, 0, true);
        else if (!a.path.length && !a.siege && !(a.battle >= 0) && !BIOMES[W.biome[a.tile]].water) armyCamp(ctx, this, a, x, y, civ, campTent8(civ.color)); // Phase 18: resting armies pitch camp
        else this.people.army(ctx, a, x, y + 2, z, civ, { dir: this.armyDir.get(a.id) || 1 });
        if (a.siege && !a.siege.blocked && st.settlements[a.siege.s]) siegeCamp(ctx, this, a, st.settlements[a.siege.s], civ);
        else this.drawSiegeRing(ctx, a);
        continue;
      }
      const skin = RACES[civ.race].skin;
      const n = Math.min(5, 2 + Math.floor(Object.values(a.units).reduce((s, v) => s + v, 0) / 4));
      for (let k = 0; k < n; k++) {
        const ox = x - 5 + (k % 3) * 3 + (k >= 3 ? 1.5 : 0), oy = y - 1 + (k >= 3 ? 2.5 : 0);
        const bob = a.path.length ? Math.sin(this.time * 10 + k) * 0.4 : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(ox, oy + 3, 2, 0.8);
        ctx.fillStyle = civ.color; ctx.fillRect(ox, oy + bob, 1.6, 2.6);
        ctx.fillStyle = skin; ctx.fillRect(ox + 0.2, oy - 1.2 + bob, 1.2, 1.2);
        ctx.fillStyle = '#cfd6dd'; ctx.fillRect(ox + 1.7, oy - 2 + bob, 0.5, 3.5);
      }
      ctx.fillStyle = '#2a1d12'; ctx.fillRect(x + 4, y - 7, 0.8, 9);
      ctx.fillStyle = civ.color; ctx.fillRect(x + 4.8, y - 7, 4, 2.6);
      this.drawSiegeRing(ctx, a);
    }
  }

  drawSiegeRing(ctx, a) {
    const st = S(), W = this.world;
    {
      if (a.siege && !a.siege.blocked) {
        const s = st.settlements[a.siege.s];
        const sx = (s.tile % W.w) * TILE + 4, sy = ((s.tile / W.w) | 0) * TILE + 4;
        const r = (STAGES[s.stage].radius + 0.8) * TILE;
        ctx.fillStyle = `rgba(220,60,40,${0.5 + 0.3 * Math.sin(this.time * 4)})`;
        for (let k = 0; k < 40; k++) {
          const ang = (k / 40) * Math.PI * 2 + this.time * 0.2;
          ctx.fillRect(sx + Math.cos(ang) * r - 0.75, sy + Math.sin(ang) * r - 0.75, 1.5, 1.5);
        }
      }
    }
  }

  // A small pixel ship: hull, mast, sail in the realm's colour. transport = troop boat.
  drawShip(ctx, x, y, color, scale = 1, transport = false) {
    const s = scale;
    const bob = Math.sin(this.time * 2.5 + x * 0.3) * 0.4;
    y += bob;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 5 * s, y + 2.5 * s, 10 * s, 0.6);
    ctx.fillStyle = '#5e3d22'; ctx.fillRect(x - 4.5 * s, y + 0.5 * s, 9 * s, 2 * s);
    ctx.fillStyle = '#3e2814'; ctx.fillRect(x - 3.5 * s, y + 2.5 * s, 7 * s, 0.8 * s);
    ctx.fillStyle = '#2a1d12'; ctx.fillRect(x - 0.3 * s, y - 6 * s, 0.8 * s, 6.5 * s);
    ctx.fillStyle = transport ? '#e8e0c8' : color;
    ctx.fillRect(x - 3 * s, y - 5.5 * s, 3 * s, 4.5 * s);
    ctx.fillRect(x + 0.6 * s, y - 4.5 * s, 2.5 * s, 3.5 * s);
    if (transport) { ctx.fillStyle = color; ctx.fillRect(x - 3 * s, y - 3.5 * s, 3 * s, 1 * s); }
    ctx.fillStyle = color; ctx.fillRect(x + 0.4 * s, y - 7 * s, 2 * s, 1.2 * s);
  }

  fleetPos(f, dayFrac) {
    const w = this.world.w;
    const fx = (f.pt % w) + ((f.tile % w) - (f.pt % w)) * dayFrac;
    const fy = ((f.pt / w) | 0) + (((f.tile / w) | 0) - ((f.pt / w) | 0)) * dayFrac;
    return [fx * TILE + 4, fy * TILE + 4];
  }

  drawFleetsWorld(ctx, z, dayFrac) {
    const st = S();
    const W = this.world;
    // Blockade rings around enemy harbours
    const bl = blockadedSet();
    for (const [sid] of bl) {
      const s = st.settlements[sid];
      const sx = (s.tile % W.w) * TILE + 4, sy = ((s.tile / W.w) | 0) * TILE + 4;
      const r = (STAGES[s.stage].radius + 1.5) * TILE;
      ctx.fillStyle = `rgba(80,150,255,${0.45 + 0.25 * Math.sin(this.time * 3)})`;
      for (let k = 0; k < 30; k += 2) {
        const ang = (k / 30) * Math.PI * 2 - this.time * 0.15;
        ctx.fillRect(sx + Math.cos(ang) * r - 0.75, sy + Math.sin(ang) * r - 0.75, 1.5, 1.5);
      }
    }
    for (const f of st.fleets) {
      if (!isVisible(f.tile)) continue;
      const civ = st.civs[f.civ];
      const [x, y] = this.fleetPos(f, dayFrac);
      if (f.path.length && (this.selectedFleet === f.id || civ.isPlayer)) {
        ctx.fillStyle = this.selectedFleet === f.id ? 'rgba(140,200,255,0.9)' : 'rgba(140,200,255,0.4)';
        for (let k = f.step + 1; k < f.path.length; k += 2) {
          const p = f.path[k];
          ctx.fillRect((p % W.w) * TILE + 3, ((p / W.w) | 0) * TILE + 3, 2, 2);
        }
      }
      if (z < 0.6) continue;
      if (z >= 1.2 && f.battle >= 0 && (st.seaBattles || []).some((b) => b.id === f.battle && !b.ended)) continue; // drawn by the clash
      const n = Object.values(f.ships).reduce((a, v) => a + v, 0);
      const ships = Math.min(3, Math.max(1, Math.ceil(n / 3)));
      for (let k = 0; k < ships; k++) this.drawShip(ctx, x - 5 + k * 6, y + (k % 2) * 3, civ.color, 1);
    }
    for (const b of st.seaBattles || []) {
      const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
      if (z >= 1.2 && isVisible(b.tile)) { if (!b.ended) seaClash(ctx, this, b, this._running); continue; }
      if (b.ended) continue;
      for (let k = 0; k < 12; k++) {
        const ang = Math.random() * Math.PI * 2, d = Math.random() * 11;
        ctx.fillStyle = k % 3 ? `rgba(220,220,220,${0.3 + Math.random() * 0.4})` : `rgba(255,${140 + Math.random() * 90},60,0.9)`;
        ctx.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d - 2, 1.5, 1.5);
      }
    }
  }

  drawBattles(ctx, z = 1, running = false) {
    const st = S();
    const W = this.world;
    if (z >= 1.4) { for (const b of st.battles) if (isVisible(b.tile)) { if (!b.ended) battleScene(ctx, this.people, b, running); this.people.battle(ctx, { ...b, ended: true }, z, running); this.people.trackLosses(b); } return; }
    for (const b of st.battles) {
      const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
      if (!b.ended) {
        for (let k = 0; k < 10; k++) {
          const ang = Math.random() * Math.PI * 2, d = Math.random() * 9;
          ctx.fillStyle = `rgba(${180 + Math.random() * 60},${150 + Math.random() * 60},120,${0.25 + Math.random() * 0.4})`;
          ctx.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d - 2, 1.5, 1.5);
        }
        ctx.fillStyle = `rgba(255,${120 + Math.random() * 100},60,0.9)`;
        ctx.fillRect(x - 1 + Math.random() * 3, y - 3 + Math.random() * 3, 1, 1);
      } else {
        ctx.fillStyle = 'rgba(60,40,30,0.5)';
        ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
      }
    }
  }

  drawRoutes(ctx, z) {
    const st = S();
    const W = this.world;
    const cap = (c) => st.settlements[st.civs[c].capital];
    ctx.lineWidth = Math.max(1, 2.2 / z);
    for (const k in st.diplo) {
      const r = st.diplo[k];
      if (!r.trade && !r.ally) continue;
      const [a, b] = k.split('-').map(Number);
      if (!st.civs[a].alive || !st.civs[b].alive) continue;
      const A = cap(a), Bc = cap(b);
      if (!A || !Bc) continue;
      const ax = (A.tile % W.w) * TILE + 4, ay = ((A.tile / W.w) | 0) * TILE + 4;
      const bx = (Bc.tile % W.w) * TILE + 4, by = ((Bc.tile / W.w) | 0) * TILE + 4;
      ctx.setLineDash(r.trade ? [6 / z, 4 / z] : []);
      ctx.lineDashOffset = -this.time * 20 / z;
      ctx.strokeStyle = r.trade ? 'rgba(242,201,76,0.9)' : 'rgba(110,170,255,0.8)';
      ctx.beginPath();
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.15;
      ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  drawArmyBadges(ctx, z, dayFrac) {
    const st = S();
    this.armyHits = [];
    ctx.font = '700 10px "Pixelify Sans", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of st.armies) {
      if (!isVisible(a.tile)) continue;
      const civ = st.civs[a.civ];
      const [wx, wy] = this.armyPos(a, dayFrac);
      const sx = (wx - this.cam.x) * z, sy = (wy - this.cam.y) * z;
      if (sx < -30 || sy < -30 || sx > this.vw + 30 || sy > this.vh + 30) continue;
      const n = Object.values(a.units).reduce((s, v) => s + v, 0);
      const label = n >= 10 ? Math.round(n) + '' : n.toFixed(1);
      const bw = Math.max(20, ctx.measureText(label).width + 12), bh = 13;
      const bx = sx - bw / 2, by = sy + (z >= 0.9 ? 6 * z * 0.6 + 2 : -6);
      const sel = this.selectedArmy === a.id;
      ctx.fillStyle = sel ? '#ffe08a' : '#120c08';
      ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
      ctx.fillStyle = civ.color; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx, by + bh - 3, bw, 3);
      // morale bar
      ctx.fillStyle = '#1b140e'; ctx.fillRect(bx, by + bh, bw, 2.5);
      ctx.fillStyle = a.morale > 0.5 ? '#8fd16b' : a.morale > 0.25 ? '#e6c068' : '#e46b5a';
      ctx.fillRect(bx, by + bh, bw * a.morale, 2.5);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, sx + 3, by + bh / 2);
      // sword glyph
      ctx.fillStyle = '#f4ecd8'; ctx.fillRect(bx + 3, by + 3, 1, 6); ctx.fillRect(bx + 1.5, by + 7, 4, 1);
      if (a.battle >= 0) {
        ctx.fillStyle = `rgba(255,80,50,${0.6 + 0.4 * Math.sin(this.time * 9)})`;
        ctx.font = '700 13px sans-serif';
        ctx.fillText('⚔', sx, by - 9);
        ctx.font = '700 10px "Pixelify Sans", monospace';
      } else if (a.siege) {
        const s = st.settlements[a.siege.s];
        ctx.fillStyle = '#1b140e'; ctx.fillRect(bx, by - 6, bw, 4);
        ctx.fillStyle = a.siege.blocked ? '#777' : '#e46b5a'; ctx.fillRect(bx, by - 6, (bw * Math.min(100, a.siege.progress)) / 100, 4);
        void s;
      }
      this.armyHits.push({ id: a.id, kind: 'army', x: bx - 2, y: by - 8, w: bw + 4, h: bh + 12 });
    }
    // Fleet badges: blue-bordered with an anchor glyph
    for (const f of st.fleets) {
      if (!isVisible(f.tile)) continue;
      const civ = st.civs[f.civ];
      const [wx, wy] = this.fleetPos(f, dayFrac);
      const sx = (wx - this.cam.x) * z, sy = (wy - this.cam.y) * z;
      if (sx < -30 || sy < -30 || sx > this.vw + 30 || sy > this.vh + 30) continue;
      const n = Object.values(f.ships).reduce((s, v) => s + v, 0);
      const label = n >= 10 ? Math.round(n) + '' : n.toFixed(1);
      const bw = Math.max(20, ctx.measureText(label).width + 12), bh = 13;
      const bx = sx - bw / 2, by = sy + (z >= 0.6 ? 5 * z * 0.6 + 3 : -6);
      ctx.fillStyle = this.selectedFleet === f.id ? '#ffe08a' : '#5aa0e6';
      ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
      ctx.fillStyle = civ.color; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#1b140e'; ctx.fillRect(bx, by + bh, bw, 2.5);
      ctx.fillStyle = f.morale > 0.5 ? '#8fd16b' : f.morale > 0.25 ? '#e6c068' : '#e46b5a';
      ctx.fillRect(bx, by + bh, bw * f.morale, 2.5);
      ctx.fillStyle = '#fff'; ctx.fillText(label, sx + 3, by + bh / 2);
      ctx.fillStyle = '#f4ecd8'; ctx.fillRect(bx + 3, by + 3, 1, 6); ctx.fillRect(bx + 1.5, by + 4, 4, 1); ctx.fillRect(bx + 1.5, by + 8, 4, 1);
      if (f.battle >= 0) {
        ctx.fillStyle = `rgba(255,80,50,${0.6 + 0.4 * Math.sin(this.time * 9)})`;
        ctx.font = '700 13px sans-serif'; ctx.fillText('⚔', sx, by - 9); ctx.font = '700 10px "Pixelify Sans", monospace';
      }
      this.armyHits.push({ id: f.id, kind: 'fleet', x: bx - 2, y: by - 8, w: bw + 4, h: bh + 12 });
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // Returns {kind:'army'|'fleet', id} under the cursor, or null.
  armyAt(sx, sy) {
    if (!this.armyHits) return null;
    for (let i = this.armyHits.length - 1; i >= 0; i--) {
      const h = this.armyHits[i];
      if (sx >= h.x && sx <= h.x + h.w && sy >= h.y && sy <= h.y + h.h) return { kind: h.kind, id: h.id };
    }
    return null;
  }

  drawResources(ctx, tx0, ty0, tx1, ty1, z) {
    const W = this.world;
    const scale = this.mode === 'resources' ? Math.max(1, 1.2 / z) : 1;
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        const r = W.resource[y * W.w + x];
        if (!r) continue;
        const R = RESOURCES[r];
        const s = 4 * scale;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x * TILE + 4 - s / 2 - 0.5, y * TILE + 4 - s / 2 - 0.5, s + 1, s + 1);
        ctx.fillStyle = R.color;
        ctx.fillRect(x * TILE + 4 - s / 2, y * TILE + 4 - s / 2, s, s);
      }
    }
  }

  drawSettlement(ctx, s, z, dt, simRunning) {
    const L = this.layoutFor(s);
    const civ = S().civs[s.civ];
    const hd = z >= HD_ZOOM && SETTINGS.hdTiles !== false;
    if (hd) {
      // 16×16 art: fields by season, then buildings drawn back to front
      const m = Math.floor((S().day % 360) / 30);
      const snowy = (m <= 1 || m === 11) && this.world.temp[s.tile] < 0.6;
      const stage = m <= 1 || m >= 10 ? (snowy ? 5 : 0) : m <= 3 ? 1 : m <= 5 ? 2 : m <= 7 ? 3 : m === 8 ? 4 : 0;
      L.civ = s.civ;
      this.drawTownGround(ctx, s, L, snowy);
      for (const f of L.fields) ctx.drawImage(field16(f.v, stage), f.x * TILE, f.y * TILE, TILE, TILE);
      this.drawPlots(ctx, L);
      if (z >= 3) this.drawFieldDetail(ctx, L, z, true);
      // back to front: buildings, then the clutter in front of them
      const props = L.props;
      let pi = 0;
      // Phase 20: every building casts a shadow away from the sun
      if (SETTINGS.shadows !== false && z >= 2) for (const it of L.items) {
        let img, X = it.x * TILE, Y = it.y * TILE, w = TILE, h = TILE;
        if (it.kind === 'house') { const H = this.homeSprite(L, it); img = H.img; X += H.dx || 0; Y += H.dy || 0; w = H.w || TILE; h = H.h || TILE; }
        else if (it.kind === 'work') { img = work16(it.work); Y -= TILE; w = h = TILE * 2; }
        else if (it.kind === 'windmill') { img = windmill16(0); Y -= TILE / 2; h = TILE * 1.5; }
        else { img = special16(it.kind, L.race, civ.color); if (it.big) { Y -= TILE; w = h = TILE * 2; } }
        castShadow(ctx, img, X, Y + h, w, h);
        // Phase 20: on the shore (or on stilts) a building is mirrored in the water, broken by ripples
        const bt = (it.y + 1) * this.world.w + it.x;
        if (z >= 2 && (it.water || (bt < this.world.N && BIOMES[this.world.biome[bt]].water))) {
          ctx.save(); ctx.globalAlpha = 0.3;
          const rows = img.height, base = Y + h;
          const rh = (h / rows) * 0.6; // squashed to 60%: water seen at a glance
          for (let r = 0; r < rows; r++) {
            const sh = Math.round(Math.sin(this.time * 2.2 + r * 0.9 + it.x) * 0.8) / 2;
            ctx.drawImage(img, 0, rows - 1 - r, img.width, 1, X + sh, base + r * rh, w, rh + 0.01);
          }
          ctx.restore();
        }
      }
      for (const it of L.items) {
        while (pi < props.length && props[pi].y < it.y * TILE + 1) { const p = props[pi++]; ctx.drawImage(prop16(p.kind), p.x, p.y, 4, 4); }
        const sn = (img) => (snowy && L.race !== 'elves' ? snowCap(img) : img); // Phase 20: snow on the roofs in winter
        if (it.kind === 'house') { const H = this.homeSprite(L, it); ctx.drawImage(sn(H.img), it.x * TILE + (H.dx || 0), it.y * TILE + (H.dy || 0), H.w || TILE, H.h || TILE); }
        else if (it.kind === 'windmill') ctx.drawImage(sn(windmill16(Math.floor(this.time * 3 + it.x) % 4)), it.x * TILE, it.y * TILE - TILE / 2, TILE, TILE * 1.5);
        else if (it.kind === 'work') ctx.drawImage(sn(work16(it.work)), it.x * TILE, (it.y - 1) * TILE, TILE * 2, TILE * 2);
        else if (it.big) ctx.drawImage(sn(special16(it.kind, L.race, civ.color)), it.x * TILE, (it.y - 1) * TILE, TILE * 2, TILE * 2);
        else ctx.drawImage(sn(special16(it.kind, L.race, civ.color)), it.x * TILE, it.y * TILE, TILE, TILE);
      }
      while (pi < props.length) { const p = props[pi++]; ctx.drawImage(prop16(p.kind), p.x, p.y, 4, 4); }
      // elven rope bridges between neighbouring treehouses
      if (L.race === 'elves') { const hs = L.items.filter((it) => it.kind === 'house'); const key = new Set(hs.map((q) => q.x + ',' + q.y)); for (const q of hs) for (const [ax, ay] of [[1, 0], [2, 0], [0, 1]]) if (key.has(q.x + ax + ',' + (q.y + ay))) ropeBridge(ctx, q.x * TILE + 6, q.y * TILE + 3, (q.x + ax) * TILE + 2, (q.y + ay) * TILE + 3); }
      this.drawTileWalls(ctx, s, L);
    } else {
      const fs = fieldSprites();
      for (const f of L.fields) ctx.drawImage(fs[f.v], f.x * TILE, f.y * TILE);
      if (z >= 2.2) this.drawFieldDetail(ctx, L, z);
      for (const it of L.items) {
        let spr;
        if (it.kind === 'work') { ctx.drawImage(work16(it.work), it.x * TILE, (it.y - 1) * TILE, TILE * 2, TILE * 2); continue; }
        if (it.kind === 'house') spr = houseSprite(L.race, it.tier);
        else spr = specialSprite(it.kind, L.race, civ.color);
        const img = z >= 2 ? hiRes(spr) : spr;
        if (it.big) ctx.drawImage(img, it.x * TILE, (it.y - 1) * TILE, TILE * 2, TILE * 2);
        else ctx.drawImage(img, it.x * TILE, it.y * TILE, spr.width, spr.height);
        if (it.kind === 'house' && z >= 3.5 && it.tier >= 1) this.houseDetail(ctx, it);
      }
    }
    if (L.walls.length && !hd) {
      // Phase 17: a breach opens on the besiegers' side
      const sieger = S().armies.find((a) => a.siege && a.siege.s === s.id && !a.siege.blocked);
      const bang = sieger ? siegeAngle(s, sieger, this.world.w) : 0, bprog = sieger?.siege.progress || 0;
      const cxw = (s.tile % this.world.w) + 0.5, cyw = ((s.tile / this.world.w) | 0) + 0.5;
      ctx.fillStyle = L.palisade ? '#7a5232' : '#7d776c';
      for (const [x, y, hz, vt] of L.walls) {
        if (sieger && isBreached([x + (hz ? 0.5 : 0), y + (hz ? 0 : 0.5)], cxw, cyw, bang, bprog)) {
          ctx.fillStyle = '#8a8274'; for (let k = 0; k < 3; k++) ctx.fillRect(x * TILE + (hz ? k * 2.6 : -1 + (k & 1)), y * TILE + (hz ? -1 + (k & 1) : k * 2.6), 1.6, 1.2);
          ctx.fillStyle = '#7d776c'; continue;
        }
        if (hz) ctx.fillRect(x * TILE, y * TILE - 1, TILE, 2);
        else ctx.fillRect(x * TILE - 1, y * TILE, 2, TILE);
      }
      ctx.fillStyle = '#a9a294';
      for (const [x, y, hz] of L.walls) if (hz && (x + y) % 3 === 0) ctx.fillRect(x * TILE - 1, y * TILE - 2, 3, 3);
    }
    // Campfire flicker
    if (!s.buildings.town_hall && L.center) {
      const fl = (Math.sin(this.time * 12 + s.id) + 1) / 2;
      ctx.fillStyle = `rgba(255,${150 + fl * 80},60,${0.5 + fl * 0.4})`;
      ctx.fillRect(L.center.x * TILE + 3, L.center.y * TILE + 2 - fl, 2, 1);
    }
    // occupied: the occupier's banner flies over the town
    if (s.occ && s.occ.by !== s.civ) {
      const oc = S().civs[s.occ.by];
      const cx = (L.center?.x ?? (s.tile % this.world.w)) * TILE + 4, cy = (L.center?.y ?? ((s.tile / this.world.w) | 0)) * TILE + 4;
      const r = (STAGES[s.stage].radius + 0.6) * TILE;
      ctx.globalAlpha = 0.6; pixelRing(ctx, cx, cy, r, oc.color, { dashed: true }); ctx.globalAlpha = 1;
      ctx.fillStyle = '#2a1d12'; ctx.fillRect(cx + 5, cy - 11, 0.8, 9);
      ctx.fillStyle = oc.color; ctx.fillRect(cx + 5.8, cy - 11 + Math.sin(this.time * 3) * 0.3, 4.5, 3);
    }
    this.atmo.settlementExtras(ctx, s, L, z, simRunning);
    // The little people of the town
    this.people.settlementPeople(ctx, s, L, z, dt, simRunning);
  }

  updateWalkers(ctx, s, L, dt, simRunning) {
    let ws = this.walkers.get(s.id);
    const want = Math.min(16, Math.ceil(s.pop / 20));
    if (!ws) { ws = []; this.walkers.set(s.id, ws); }
    const skin = RACES[L.race].skin;
    const pick = () => { const c = L.houseTiles[(Math.random() * L.houseTiles.length) | 0]; return { x: c.x * TILE + 4, y: c.y * TILE + 7 }; };
    while (ws.length < want) { const p = pick(); ws.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, c: Math.random() < 0.5 ? '#6b4e9b' : '#4e7b9b' }); }
    if (ws.length > want) ws.length = want;
    for (const v of ws) {
      if (simRunning) {
        const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
        if (d < 0.5) { const p = pick(); v.tx = p.x + Math.random() * 3; v.ty = p.y; }
        else { const sp = Math.min(d, dt * 6); v.x += (dx / d) * sp; v.y += (dy / d) * sp; }
      }
      ctx.fillStyle = v.c; ctx.fillRect(v.x, v.y - 1, 1, 1.5);
      ctx.fillStyle = skin; ctx.fillRect(v.x, v.y - 2, 1, 1);
    }
  }

  drawUnit(ctx, u, z) {
    const W = this.world;
    const civ = S().civs[u.civ];
    const cur = u.path[u.step], nxt = u.path[Math.min(u.step + 1, u.path.length - 1)];
    const t = nxt === cur ? 0 : clamp(u.mp / stepCost(nxt), 0, 1);
    const x = ((cur % W.w) + ((nxt % W.w) - (cur % W.w)) * t) * TILE + 4;
    const y = (((cur / W.w) | 0) + (((nxt / W.w) | 0) - ((cur / W.w) | 0)) * t) * TILE + 4;
    const s = Math.max(1, 0.9 / z);
    // dashed path preview for player units
    if (civ.isPlayer) {
      ctx.fillStyle = 'rgba(255,240,180,0.55)';
      for (let k = u.step + 1; k < u.path.length; k += 2) {
        const p = u.path[k];
        ctx.fillRect((p % W.w) * TILE + 3.5, ((p / W.w) | 0) * TILE + 3.5, 1, 1);
      }
    }
    if (BIOMES[W.biome[cur]].water) { this.drawShip(ctx, x, y, civ.color, Math.max(0.8, s * 0.8), true); return; }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 3 * s, y + 2 * s, 7 * s, 1.5 * s);
    const skin = RACES[civ.race].skin;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#5b4636'; ctx.fillRect(x - 3 * s + k * 2.5 * s, y - 1 * s, 1.2 * s, 3 * s);
      ctx.fillStyle = skin; ctx.fillRect(x - 3 * s + k * 2.5 * s, y - 2.2 * s, 1.2 * s, 1.2 * s);
    }
    ctx.fillStyle = '#2a1d12'; ctx.fillRect(x + 3 * s, y - 6 * s, 0.8 * s, 8 * s);
    ctx.fillStyle = civ.color; ctx.fillRect(x + 3.8 * s, y - 6 * s, 3.5 * s, 2.5 * s);
  }

  // Phase 18: roads on the tile grid — each road tile is a square path piece that joins its
  // neighbours (straight runs, right-angle turns, crossroads), with bridges over water.
  rebuildRoads() {
    const W = this.world;
    this.roadTileSet = new Set();
    this.roadCiv = new Map();
    this.roadSegs = [];
    for (const r of S().roads) {
      for (let k = 0; k < r.path.length; k++) {
        const t = r.path[k];
        this.roadTileSet.add(t);
        if (!this.roadCiv.has(t)) this.roadCiv.set(t, r.civ);
        if (k < r.path.length - 1) { const b = r.path[k + 1]; this.roadSegs.push([Math.min(t % W.w, b % W.w), Math.min((t / W.w) | 0, (b / W.w) | 0), Math.abs((b % W.w) - (t % W.w)), Math.abs(((b / W.w) | 0) - ((t / W.w) | 0)), r.civ]); }
      }
    }
    this.layouts.clear(); this.streetTiles = new Set(); // town gates depend on where roads arrive
  }
  roadStyle(civId) { const era = S().civs[civId]?.era || 0; return era >= 3 ? 2 : era >= 2 ? 1 : 0; }
  pathMask(t, set) {
    const w = this.world.w;
    const has = (j) => set.has(j) || this.roadTileSet?.has(j) || this.streetTiles?.has(j);
    return (has(t - w) ? 1 : 0) | ((t % w) < w - 1 && has(t + 1) ? 2 : 0) | (has(t + w) ? 4 : 0) | ((t % w) > 0 && has(t - 1) ? 8 : 0);
  }
  drawRoads(ctx, x0, y0, x1, y1) {
    if (!this.roadSegs?.length) return;
    const W = this.world, z = this.cam.zoom;
    const hd = z >= HD_ZOOM && SETTINGS.hdTiles !== false;
    if (this.atlasA > 0.5) { // inked dashed track on the atlas, still square
      ctx.fillStyle = 'rgba(110,70,40,0.75)';
      for (const [x, y, ww, hh] of this.roadSegs) { if (x * TILE > x1 || y * TILE > y1 || (x + ww + 1) * TILE < x0 || (y + hh + 1) * TILE < y0) continue; if ((x + y) & 1) continue; ctx.fillRect(x * TILE + 3.4, y * TILE + 3.4, ww * TILE + 1.2, hh * TILE + 1.2); }
      return;
    }
    if (!hd) { // simple square tracks when zoomed out
      const edge = ['#6e5434', '#5c564c', '#4a4844'], fill = ['#c4a674', '#a8a092', '#8e8a84'];
      for (const pass of [0, 1]) for (const [x, y, ww, hh, civ] of this.roadSegs) {
        if (x * TILE > x1 || y * TILE > y1 || (x + ww + 1) * TILE < x0 || (y + hh + 1) * TILE < y0) continue;
        const st = this.roadStyle(civ);
        ctx.fillStyle = pass ? fill[st] : edge[st];
        const o = pass ? 3.5 : 3, sz = pass ? 1 : 2; // a slim track, not a whole tile
        ctx.fillRect(x * TILE + o, y * TILE + o, ww * TILE + sz, hh * TILE + sz);
      }
      return;
    }
    const tx0 = Math.floor(x0 / TILE) - 1, ty0 = Math.floor(y0 / TILE) - 1, tx1 = Math.ceil(x1 / TILE) + 1, ty1 = Math.ceil(y1 / TILE) + 1;
    for (const t of this.roadTileSet) {
      const x = t % W.w, y = (t / W.w) | 0;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
      if (this.streetTiles?.has(t)) continue; // drawn by the town
      const st = this.roadStyle(this.roadCiv.get(t));
      const m = this.pathMask(t, this.roadTileSet);
      if (W.river[t] || BIOMES[W.biome[t]].water) ctx.drawImage(bridge16((m & 10) !== 0 && (m & 5) === 0 ? true : (m & 5) ? false : true, st ? 1 : 0), x * TILE, y * TILE, TILE, TILE);
      else ctx.drawImage(path16(m, st), x * TILE, y * TILE, TILE, TILE);
    }
  }

  // Phase 16: frontier banners on realm borders, close up
  drawFrontier(ctx, x0, y0, x1, y1) {
    const st = S();
    for (const f of this.overlays.frontier || []) {
      const X = f.x * TILE + 4, Y = f.y * TILE + 4;
      if (X < x0 - 8 || Y < y0 - 12 || X > x1 + 8 || Y > y1 + 8) continue;
      if (!isExplored(f.y * this.world.w + f.x)) continue;
      const civ = st.civs[f.civ]; if (!civ?.alive) continue;
      const wv = Math.sin(this.time * 3 + f.x * 0.7) * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X - 1, Y + 0.5, 3, 1);
      ctx.fillStyle = '#4a3220'; ctx.fillRect(X, Y - 8, 0.8, 9);
      ctx.fillStyle = civ.color;
      ctx.beginPath(); ctx.moveTo(X + 0.8, Y - 8); ctx.lineTo(X + 4.5, Y - 7.5 + wv); ctx.lineTo(X + 3.5, Y - 6 + wv * 0.5); ctx.lineTo(X + 4.5, Y - 4.5 + wv); ctx.lineTo(X + 0.8, Y - 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X + 0.8, Y - 8, 3, 0.6);
    }
  }

  drawLabels(ctx, z) {
    const st = S();
    const W = this.world;
    const toS = (wx, wy) => [(wx - this.cam.x) * z, (wy - this.cam.y) * z];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Realm names when zoomed out
    if (z < 0.9 && (this.mode === 'political' || this.mode === 'military' || this.mode === 'trade')) {
      for (const L of this.overlays.civLabels) {
        const civ = st.civs[L.civ];
        if (!civ.alive || L.n < 25 || !knowsRealm(civ.id)) continue;
        const [sx, sy] = toS(L.x * TILE + 4, L.y * TILE + 4);
        const size = clamp(L.span * TILE * z * 0.11, 10, 34);
        ctx.font = `700 ${size}px "Pixelify Sans", "Trebuchet MS", sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,8,6,0.75)';
        const name = civ.baseName.toUpperCase().split('').join(String.fromCharCode(8202));
        ctx.globalAlpha = clamp((0.9 - z) * 2, 0, 0.95);
        ctx.strokeText(name, sx, sy);
        ctx.fillStyle = '#f7ecd0';
        ctx.fillText(name, sx, sy);
        ctx.globalAlpha = 1;
      }
    }
    // Settlement markers/labels
    const labels = [];
    for (const s of st.settlements) {
      if (s.dead || !isExplored(s.tile)) continue;
      const civ = st.civs[s.civ];
      const [sx, sy] = toS((s.tile % W.w) * TILE + 4, ((s.tile / W.w) | 0) * TILE + 4);
      if (sx < -100 || sy < -50 || sx > this.vw + 100 || sy > this.vh + 50) continue;
      if (z < 0.55) {
        const r = 2 + s.stage * 0.8;
        ctx.fillStyle = '#1b140e';
        ctx.fillRect(sx - r - 1, sy - r - 1, r * 2 + 2, r * 2 + 2);
        ctx.fillStyle = s.isCapital ? '#f2c94c' : civ.color;
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      // Phase 20: fewer labels — camps only close up, villages from mid zoom, towns and capitals further out
      const showLabel = (z >= 2 || (s.stage >= 1 && z >= 0.75) || (s.stage >= 2 && z >= 0.45)) || s.isCapital || (civ.isPlayer && z >= 0.3);
      if (!showLabel) continue;
      // Phase 18: collect labels first, place the important ones, nudge or drop the rest
      const size = Math.round(clamp(9 + s.stage * 1.2 + (z - 1) * 1.5, 9, z >= 3 ? 12 : 14));
      const ly = sy + (z >= 0.55 ? STAGES[s.stage].radius * TILE * z * 0.5 + 14 : 12);
      labels.push({ s, civ, sx, ly, size, pri: (civ.isPlayer ? 100 : 0) + (s.isCapital ? 50 : 0) + s.stage * 10 + Math.min(9, s.pop / 500) });
    }
    labels.sort((a, b) => b.pri - a.pri);
    const placed = [];
    const hit = (r) => placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    for (const Lb of labels) {
      const { s, civ, sx, size } = Lb;
      ctx.font = `600 ${size}px "Pixelify Sans", "Trebuchet MS", sans-serif`;
      const label = s.name;
      const tw = ctx.measureText(label).width;
      const pad = 4, flagW = 12;
      const wTot = tw + pad * 2 + flagW, hTot = size + 6;
      let ly = Math.round(Lb.ly);
      let ok = false;
      for (const dy of [0, hTot + 1, -(hTot + 1), 2 * (hTot + 1)]) { const r = { x: sx - wTot / 2, y: ly + dy - size / 2 - 2, w: wTot, h: hTot }; if (!hit(r)) { ly += dy; placed.push(r); ok = true; break; } }
      if (!ok && Lb.pri < 100) continue; // too crowded: only our own towns always keep a name
      if (!ok) placed.push({ x: sx - wTot / 2, y: ly - size / 2 - 2, w: wTot, h: hTot });
      const x0 = Math.round(sx - tw / 2 - pad - flagW / 2);
      ctx.globalAlpha = z >= 3 ? 0.9 : 1;
      drawRibbon(ctx, x0, Math.round(ly - size / 2 - 3), Math.round(wTot), size + 6, civ.color, s.isCapital);
      drawFlag(ctx, civ.flag, Math.round(sx - tw / 2 - flagW / 2 - 1), ly - 4, 10, 7);
      ctx.fillStyle = s.isCapital ? '#7a1e10' : '#3a2614';
      ctx.fillText(label, Math.round(sx + flagW / 2), ly + 0.5);
      // Phase 15: status markers for our own settlements (beside the label, inside its box)
      if (civ.isPlayer && SETTINGS.statusMarkers !== false) {
        const marks = this.statusOf(s);
        if (marks.length) {
          ctx.font = '700 10px "Pixelify Sans", monospace';
          let mx = Math.round(sx + tw / 2 + pad + flagW / 2 + 3);
          for (const [txt, col] of marks) {
            const w = Math.round(ctx.measureText(txt).width + 6);
            const r = { x: mx, y: ly - 7, w, h: 14 };
            if (hit(r) && mx > sx + tw) break;
            placed.push(r);
            ctx.fillStyle = 'rgba(14,10,8,0.78)'; ctx.fillRect(mx, ly - 7, w, 14);
            ctx.fillStyle = col; ctx.fillRect(mx, ly + 6, w, 2);
            ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(txt, mx + 3, ly + 0.5);
            ctx.textAlign = 'center';
            mx += w + 2;
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    this.drawFloats(ctx, z);
    ctx.textBaseline = 'alphabetic';
    void iconCanvas;
  }

  drawMinimap() {
    const m = this.minimap, ctx = this.mctx, W = this.world;
    if (this.miniDirty) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, m.width, m.height);
      ctx.drawImage(this.miniBase, 0, 0, m.width, m.height);
      ctx.globalAlpha = 0.75;
      ctx.drawImage(this.overlays.owner, 0, 0, m.width, m.height);
      ctx.globalAlpha = 1;
      if (fogOn() && this.fogCanvas) { ctx.imageSmoothingEnabled = true; ctx.drawImage(this.fogCanvas, 0, 0, m.width, m.height); ctx.imageSmoothingEnabled = false; }
      this.miniImage = ctx.getImageData(0, 0, m.width, m.height);
      this.miniDirty = false;
    } else {
      ctx.putImageData(this.miniImage, 0, 0);
    }
    const sx = m.width / (W.w * TILE), sy = m.height / (W.h * TILE);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.cam.x * sx + 0.5, this.cam.y * sy + 0.5, (this.vw / this.cam.zoom) * sx, (this.vh / this.cam.zoom) * sy);
  }
}

// Phase 20: a parchment ribbon name tag — folded tails in the realm's colour, crisp pixel edges
function drawRibbon(ctx, x, y, w, h, color, capital) {
  const t = 5; // tail width
  // tails: behind the band, a notch cut into each end
  ctx.fillStyle = '#2c1c10';
  ctx.fillRect(x - t - 1, y + 2, t + 2, h - 2); ctx.fillRect(x + w - 1, y + 2, t + 2, h - 2);
  ctx.fillStyle = color;
  ctx.fillRect(x - t, y + 3, t + 1, h - 4); ctx.fillRect(x + w - 1, y + 3, t + 1, h - 4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - t, y + h - 3, t + 1, 1); ctx.fillRect(x + w - 1, y + h - 3, t + 1, 1);
  ctx.clearRect(x - t, y + Math.floor(h / 2), 2, 2); ctx.clearRect(x + w + t - 2, y + Math.floor(h / 2), 2, 2); // notches
  ctx.fillStyle = '#2c1c10'; ctx.fillRect(x - t + 2, y + Math.floor(h / 2), 1, 2); ctx.fillRect(x + w + t - 3, y + Math.floor(h / 2), 1, 2);
  // the band
  ctx.fillStyle = '#2c1c10'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = capital ? '#f4dc98' : '#ead7a8'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,248,220,0.8)'; ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(150,110,60,0.45)'; ctx.fillRect(x, y + h - 1, w, 1);
  // little folds where the tails tuck behind
  ctx.fillStyle = 'rgba(90,60,30,0.5)'; ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  if (capital) { ctx.fillStyle = '#c89a2a'; ctx.fillRect(x + Math.floor(w / 2) - 2, y - 3, 5, 2); ctx.fillRect(x + Math.floor(w / 2) - 2, y - 4, 1, 1); ctx.fillRect(x + Math.floor(w / 2), y - 4, 1, 1); ctx.fillRect(x + Math.floor(w / 2) + 2, y - 4, 1, 1); } // a tiny crown
}
