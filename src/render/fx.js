import { pixelRing } from './town16.js';
// Phase 9 — atmosphere & effects: seasons, day/night, clouds, weather, animated water,
// disaster visuals, particles, scars, and ambient life (carts, boats, smoke, lights).
// Purely cosmetic: nothing here touches the simulation or its random generator.
import { G, S } from '../sim/state.js';
import { B, BIOMES } from '../data/biomes.js';
import { hash2 } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { TILE, SEASON_PX, bakeSeasonLayers, waterKinds } from './terrain.js';
import { makeCanvas } from './sprites.js';
import { SETTINGS } from '../ui/settings.js';

const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const INDUSTRY = new Set(['power_plant', 'textile_mill', 'foundry', 'factory', 'brewery', 'railway_station']);
const MAX_PARTICLES = [0, 350, 900, 1800];

// Season helpers (day of year 0..360; month 0 = Frostmoot, mid-winter)
export function seasonOf(doy) {
  const c = Math.cos(TAU * (doy - 15) / 360);
  const a = Math.cos(TAU * (doy - 255) / 360);
  return {
    snowCold: clamp((c - 0.15) / 0.45, 0, 1),
    snowMild: clamp((c - 0.72) / 0.22, 0, 1),
    autumn: clamp((a - 0.55) / 0.35, 0, 1) * 0.9,
    winter: c > 0.5,
    name: c > 0.5 ? 'Winter' : a > 0.5 ? 'Autumn' : Math.cos(TAU * (doy - 165) / 360) > 0.5 ? 'Summer' : 'Spring',
  };
}

export class Atmosphere {
  constructor(renderer) {
    this.r = renderer;
    this.time = 0; // seconds of running time (drives weather & clouds)
    this.tod = 0.32; // time of day 0..1 (0 = midnight)
    this.p = []; // particles
    this.anims = []; // transient animations (meteor, bolts, rings)
    this.lights = [];
    this.flash = 0;
    this.shakeT = 0; this.shakeA = 0;
    this.drops = [];
    this.portWater = new Map();
    this.scarSprites = new Map();
    this.clouds = makeCloudSprites();
    this.dark = null;
  }

  setWorld(world) {
    this.world = world;
    this.season = bakeSeasonLayers(world);
    this.water = waterKinds(world);
    this.portWater.clear();
    this.scarSprites.clear();
    this.p.length = 0; this.anims.length = 0;
  }

  terrainChanged(tiles) {
    if (!tiles?.length) return;
    const w = this.world.w;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const t of tiles) { const x = t % w, y = (t / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    bakeSeasonLayers(this.world, { x0: x0 - 1, y0: y0 - 1, x1: x1 + 2, y1: y1 + 2 }, this.season);
    this.scarSprites.clear();
  }

  // ---------- Events from the simulation ----------
  onFx(e) {
    const W = this.world;
    if (!W || e.tile == null || e.tile < 0) return;
    const x = (e.tile % W.w) * TILE + 4, y = ((e.tile / W.w) | 0) * TILE + 4;
    const R = (e.r || 2) * TILE;
    const visible = this.r.tileVisible(e.tile, 30);
    switch (e.fx) {
      case 'meteor':
        this.anims.push({ k: 'meteor', x, y, t: 0, dur: 0.9, R });
        break;
      case 'quake':
        if (visible) this.shake(1.6, 6);
        for (let i = 0; i < 40; i++) this.spawnAround('dust', x, y, R);
        this.anims.push({ k: 'ring', x, y, t: 0, dur: 1.2, R: R * 1.2, col: '200,170,120' });
        break;
      case 'eruption':
        if (visible) this.shake(1.2, 5);
        this.flash = Math.max(this.flash, visible ? 0.35 : 0);
        for (let i = 0; i < 70; i++) this.add('spark', x, y, (Math.random() - 0.5) * 70, -40 - Math.random() * 90, 1.5 + Math.random(), 1.4);
        for (let i = 0; i < 40; i++) this.add('smoke', x + (Math.random() - 0.5) * 10, y, (Math.random() - 0.5) * 10, -12 - Math.random() * 10, 4 + Math.random() * 3, 4, 50);
        break;
      case 'lightning': {
        const pts = [];
        let px = x + (Math.random() - 0.5) * 30, py = y - 160;
        while (py < y) { pts.push([px, py]); py += 10 + Math.random() * 14; px += (Math.random() - 0.5) * 16; }
        pts.push([x, y]);
        this.anims.push({ k: 'bolt', pts, t: 0, dur: 0.45, x, y });
        if (visible) this.flash = Math.max(this.flash, 0.5);
        for (let i = 0; i < 14; i++) this.add('spark', x, y, (Math.random() - 0.5) * 50, -20 - Math.random() * 40, 0.6, 1.2);
        break;
      }
      case 'fire': for (let i = 0; i < 30; i++) this.spawnAround('fire', x, y, R); break;
      case 'bless':
        this.anims.push({ k: 'ring', x, y, t: 0, dur: 1.4, R: R * 1.5, col: '255,226,140' });
        for (let i = 0; i < 50; i++) this.add('mote', x + (Math.random() - 0.5) * R * 2, y + (Math.random() - 0.5) * R * 2, 0, -8 - Math.random() * 8, 1.5 + Math.random() * 1.5, 1.3, 0, '255,220,120');
        break;
      case 'curse':
        this.anims.push({ k: 'ring', x, y, t: 0, dur: 1.4, R: R * 1.5, col: '170,80,220' });
        for (let i = 0; i < 40; i++) this.add('mote', x + (Math.random() - 0.5) * R * 2, y + (Math.random() - 0.5) * R * 2, 0, -5 - Math.random() * 6, 2, 1.3, 0, '170,90,230');
        break;
      case 'plague': for (let i = 0; i < 30; i++) this.add('mote', x + (Math.random() - 0.5) * R, y + (Math.random() - 0.5) * R, 0, -6, 2.5, 1.4, 0, '150,220,90'); break;
      case 'flood': for (let k = 0; k < 4; k++) this.anims.push({ k: 'ring', x, y, t: -k * 0.35, dur: 1.6, R, col: '120,180,240' }); break;
      case 'drought': for (let i = 0; i < 30; i++) this.spawnAround('dust', x, y, R); break;
      case 'war': this.anims.push({ k: 'ring', x, y, t: 0, dur: 1.2, R: R * 2, col: '230,70,50' }); break;
      case 'terrain': this.r.terrainChanged(e.tiles); this.terrainChanged(e.tiles); break;
      default: break;
    }
  }

  shake(dur, amp) { if (!SETTINGS.screenShake) return; this.shakeT = Math.max(this.shakeT, dur); this.shakeA = Math.max(this.shakeA, amp); }
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const a = this.shakeA * Math.min(1, this.shakeT);
    return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
  }

  // ---------- Particles ----------
  add(k, x, y, vx, vy, life, size = 1, grow = 0, col = null) {
    const cap = MAX_PARTICLES[SETTINGS.effectsQuality || 2];
    if (this.p.length >= cap) return;
    this.p.push({ k, x, y, vx, vy, life, max: life, size, grow, col });
  }
  spawnAround(k, x, y, R) {
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (k === 'fire') {
      this.add('fire', px, py, (Math.random() - 0.5) * 4, -10 - Math.random() * 10, 0.5 + Math.random() * 0.6, 1.2);
      if (Math.random() < 0.3) this.add('ember', px, py - 2, (Math.random() - 0.5) * 8, -14 - Math.random() * 14, 1 + Math.random() * 1.2, 0.5); // Phase 20
      if (Math.random() < 0.12) this.add('smoke', px, py - 4, (Math.random() - 0.5) * 3, -9 - Math.random() * 6, 3.5 + Math.random() * 2.5, 2.5, 3, '60,54,52');
    }
    else if (k === 'smoke') this.add('smoke', px, py, 3 + (Math.random() - 0.5) * 3, -6 - Math.random() * 5, 2.5 + Math.random() * 2, 2, 2.2);
    else if (k === 'dust') this.add('dust', px, py, (Math.random() - 0.5) * 12, -2 - Math.random() * 4, 1.2 + Math.random(), 2, 3);
    else if (k === 'snow') this.add('flake', px, py, 8 + Math.random() * 8, 3 + Math.random() * 4, 1.5 + Math.random(), 0.8);
  }

  update(dt, running) {
    const st = S();
    if (running) { this.time += dt; this.tod = (this.tod + dt / 150) % 1; }
    if (this.shakeT > 0) this.shakeT -= dt;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const wind = this.wind();
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      if (q.k === 'spark' || q.k === 'debris') q.vy += 60 * dt;
      if (q.k === 'smoke' || q.k === 'flake' || q.k === 'ember') q.vx += (wind * 0.6 - q.vx) * dt * 0.4;
      if (q.k === 'ember') q.vy *= 1 - dt * 0.8;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.size += q.grow * dt;
    }
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.k === 'meteor' && !a.hit && a.t >= a.dur) {
        a.hit = true;
        const vis = this.r.worldVisible(a.x, a.y, 200);
        if (vis) { this.shake(1.4, 8); this.flash = Math.max(this.flash, 0.8); }
        this.anims.push({ k: 'ring', x: a.x, y: a.y, t: 0, dur: 1.0, R: a.R * 2.2, col: '255,220,160' });
        for (let k = 0; k < 60; k++) { const an = Math.random() * TAU, sp = 30 + Math.random() * 90; this.add('debris', a.x, a.y, Math.cos(an) * sp, Math.sin(an) * sp - 40, 1 + Math.random(), 1.4); }
        for (let k = 0; k < 40; k++) this.spawnAround('fire', a.x, a.y, a.R);
        for (let k = 0; k < 30; k++) this.add('smoke', a.x + (Math.random() - 0.5) * a.R, a.y + (Math.random() - 0.5) * a.R, (Math.random() - 0.5) * 10, -8 - Math.random() * 8, 4 + Math.random() * 3, 4, 4);
      }
      if (a.t > a.dur + (a.k === 'meteor' ? 0.1 : 0)) this.anims.splice(i, 1);
    }
    void st;
  }

  wind() { return 6 + Math.sin(this.time / 37) * 5; }

  // Cloud cover 0..1 at world pixel (x, y), slowly evolving
  cover(x, y) {
    const ts = this.time / 80, k = Math.floor(ts), f = smooth(ts - k);
    const ox = this.time * this.wind() * 0.5;
    const n = (s) => vnoise((x - ox) / 520, y / 520, s) * 0.65 + vnoise((x - ox) / 170, y / 170, s + 3) * 0.35;
    return n(k * 11 + 1) * (1 - f) + n(k * 11 + 12) * f;
  }

  // ---------- Ground layers (world space, right after terrain) ----------
  drawGround(ctx, v) {
    const st = S();
    const P = SEASON_PX, f = TILE / P;
    if (SETTINGS.seasons && this.season && !v.hd) {
      const s = seasonOf((st.day % 360) + v.dayFrac);
      this.cur = s;
      const blit = (cv, a) => {
        if (a <= 0.01) return;
        ctx.globalAlpha = a;
        ctx.drawImage(cv, v.tx0 * P, v.ty0 * P, (v.tx1 - v.tx0) * P, (v.ty1 - v.ty0) * P, v.tx0 * TILE, v.ty0 * TILE, (v.tx1 - v.tx0) * TILE, (v.ty1 - v.ty0) * TILE);
      };
      blit(this.season.autumn, s.autumn);
      blit(this.season.snowCold, s.snowCold);
      blit(this.season.snowMild, s.snowMild);
      ctx.globalAlpha = 1;
      void f;
    } else this.cur = seasonOf(st.day % 360);
    this.drawScars(ctx, v);
    if (v.z >= 0.85) this.drawWater(ctx, v);
  }

  drawWater(ctx, v) {
    const W = this.world, w = W.w, k = this.water, t = this.time;
    const { tx0, ty0, tx1, ty1 } = v;
    const frozen = this.cur?.snowCold > 0.6;
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        const i = y * w + x;
        const kind = k[i];
        if (!kind) continue;
        const X = x * TILE, Y = y * TILE;
        if (kind === 1) {
          const h = hash2(x, y, Math.floor(t * 0.8 + hash2(x, y, 3) * 10));
          if (h < 0.035) { ctx.fillStyle = 'rgba(235,245,255,0.55)'; ctx.fillRect(X + ((h * 200) | 0) % 7, Y + ((h * 900) | 0) % 7, 2, 1); }
        } else if (kind === 2) {
          if (frozen && W.temp[i] < 0.3) continue;
          const ph = Math.round((Math.sin(t * 1.6 + hash2(x, y, 5) * 6) + 1)) / 2; // whole art pixels only
          ctx.fillStyle = `rgba(230,244,255,${0.25 + ph * 0.4})`;
          const land = (j) => !BIOMES[W.biome[j]].water;
          const off = (t * 2 + hash2(x, y, 7) * 8) % TILE;
          if (x < w - 1 && land(i + 1)) { ctx.fillRect(X + 6 - ph, Y + off, 1, 2); ctx.fillRect(X + 6 - ph, Y + (off + 4) % TILE, 1, 1); }
          if (x > 0 && land(i - 1)) { ctx.fillRect(X + 1 + ph, Y + (TILE - off) % TILE, 1, 2); }
          if (y < W.h - 1 && land(i + w)) { ctx.fillRect(X + off, Y + 6 - ph, 2, 1); ctx.fillRect(X + (off + 4) % TILE, Y + 6 - ph, 1, 1); }
          if (y > 0 && land(i - w)) { ctx.fillRect(X + (TILE - off) % TILE, Y + 1 + ph, 2, 1); }
        }
        // Phase 20: fish under the surface, and now and then one leaps
        if ((kind === 1 || kind === 2) && v.z >= 2.5 && !frozen && hash2(x, y, 77) < 0.06) {
          const sp = 0.25 + hash2(x, y, 78) * 0.3, a0 = hash2(y, x, 79) * 6.28, ang = a0 + t * sp;
          const fx = Math.round((X + 4 + Math.cos(ang) * 2.5) * 2) / 2, fy = Math.round((Y + 4 + Math.sin(ang) * 1.5) * 2) / 2;
          ctx.fillStyle = 'rgba(16,36,70,0.42)';
          ctx.fillRect(fx, fy, 1.5, 0.5); ctx.fillRect(fx + (Math.sin(ang) > 0 ? 1.5 : -0.5), fy, 0.5, 0.5);
          const cyc = (t + hash2(x, y, 80) * 9) % 9;
          if (cyc < 0.9) { // a leap: the fish arcs out, then rings spread
            const u = cyc / 0.9;
            if (u < 0.5) { ctx.fillStyle = '#c8d8e8'; ctx.fillRect(fx, Math.round((fy - Math.sin(u * Math.PI * 2) * 2) * 2) / 2, 1, 0.5); }
            else { const rr = (u - 0.5) * 6; ctx.fillStyle = `rgba(230,244,255,${0.6 * (1 - (u - 0.5) * 2)})`; ctx.fillRect(Math.round((fx - rr) * 2) / 2, fy, 0.5, 0.5); ctx.fillRect(Math.round((fx + rr) * 2) / 2, fy, 0.5, 0.5); ctx.fillRect(fx, Math.round((fy - rr * 0.5) * 2) / 2, 0.5, 0.5); ctx.fillRect(fx, Math.round((fy + rr * 0.5) * 2) / 2, 0.5, 0.5); }
          }
        }
        if (kind === 3) {
          const n = W.riverNext[i];
          if (n < 0) continue;
          const nx = (n % w) - x, ny = ((n / w) | 0) - y;
          const u = (t * 0.7 + hash2(x, y, 9)) % 1;
          if (frozen && W.temp[i] < 0.35) continue;
          ctx.fillStyle = 'rgba(200,232,255,0.8)';
          ctx.fillRect(X + 3 + nx * u * TILE, Y + 3 + ny * u * TILE, 1, 1);
          const u2 = (u + 0.5) % 1;
          ctx.fillStyle = 'rgba(160,210,250,0.6)';
          ctx.fillRect(X + 4 + nx * u2 * TILE, Y + 4 + ny * u2 * TILE, 1, 1);
        }
      }
    }
  }

  // ---------- Scars (craters, lava, ash, burns) ----------
  drawScars(ctx, v) {
    const st = S();
    const W = this.world;
    if (!st.scars?.length) return;
    for (const sc of st.scars) {
      const x = (sc.tile % W.w) * TILE + 4, y = ((sc.tile / W.w) | 0) * TILE + 4;
      const R = sc.r * TILE + 6;
      if (x + R < v.x0 || x - R > v.x1 || y + R < v.y0 || y - R > v.y1) continue;
      const key = `${sc.type}:${sc.tile}:${sc.r}:${sc.seed}`;
      let spr = this.scarSprites.get(key);
      if (!spr) { spr = makeScarSprite(sc, W); this.scarSprites.set(key, spr); if (this.scarSprites.size > 400) this.scarSprites.delete(this.scarSprites.keys().next().value); }
      // fade old temporary scars
      let a = 1;
      if (sc.until > 0) a = clamp((sc.until - st.day) / Math.max(1, (sc.until - sc.day) * 0.4), 0, 1);
      ctx.globalAlpha = a;
      ctx.drawImage(spr.cv, x - spr.cx, y - spr.cy);
      if (spr.glow) {
        ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(this.time * 2 + sc.seed));
        ctx.drawImage(spr.glow, x - spr.cx, y - spr.cy);
        this.light(x, y, R * 1.2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Settlement extras: scaffolds, smoke, windows ----------
  settlementExtras(ctx, s, L, z, running) {
    const st = S();
    const cx = (L.center?.x ?? (s.tile % this.world.w)) * TILE + 4, cy = (L.center?.y ?? ((s.tile / this.world.w) | 0)) * TILE + 4;
    if (!SETTINGS.ambientLife) return;
    // construction: scaffolding with a crane
    if (s.queue.length && z >= 0.9) {
      const q = s.queue[0];
      const sx = cx + 9 + (s.id % 3) * 2, sy = cy - 2;
      ctx.fillStyle = '#8a6a3e';
      ctx.fillRect(sx, sy - 6, 1, 7); ctx.fillRect(sx + 4, sy - 6, 1, 7); ctx.fillRect(sx, sy - 6, 5, 1); ctx.fillRect(sx, sy - 3, 5, 1);
      ctx.fillStyle = '#5c4426'; ctx.fillRect(sx - 1, sy + 1, 7, 1);
      // crane
      ctx.fillStyle = '#6e5636'; ctx.fillRect(sx + 6, sy - 10, 1, 11); ctx.fillRect(sx + 2, sy - 10, 8, 1);
      const sw = Math.sin(this.time * 1.5 + s.id) * 1.5;
      ctx.fillStyle = '#ccc'; ctx.fillRect(sx + 3 + sw, sy - 9, 0.5, 3); ctx.fillStyle = '#b08850'; ctx.fillRect(sx + 2.5 + sw, sy - 6, 1.5, 1);
      // progress
      const prog = clamp((q.progress || 0) / Math.max(1, q.total || 1), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 1, sy + 3, 8, 1.5);
      ctx.fillStyle = '#e6c068'; ctx.fillRect(sx - 1, sy + 3, 8 * prog, 1.5);
    }
    // Phase 20: washing lines in some yards on fair days, cloth swaying in the breeze
    if (z >= 3 && !this.cur?.winter && (this.darkness || 0) < 0.3) {
      const COL = ['#e8e0d0', '#c84a3a', '#4a7ab0', '#e0c050', '#7aa850'];
      for (const it of L.items) {
        if (it.kind !== 'house' || it.water || hash2(it.x, it.y, 97) > 0.1) continue;
        const X = it.x * TILE + 8, Y = it.y * TILE + 5;
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(X, Y, 0.5, 3); ctx.fillRect(X + 5, Y, 0.5, 3);
        ctx.fillStyle = 'rgba(220,214,200,0.9)'; ctx.fillRect(X, Y, 5.5, 0.5);
        for (let k = 0; k < 3; k++) {
          const sw = Math.round(Math.sin(this.time * 2.4 + k + it.x) * 0.6) / 2;
          ctx.fillStyle = COL[(hash2(it.x + k, it.y, 98) * COL.length) | 0];
          ctx.fillRect(X + 1 + k * 1.5 + sw, Y + 0.5, 1, 1 + (k % 2) * 0.5);
        }
      }
    }
    if (!running) return;
    const q = SETTINGS.effectsQuality || 2;
    // industry smoke
    for (const it of L.items) {
      if (it.kind === 'house') {
        if (z >= 1.4 && it.tier >= 1 && Math.random() < (this.cur?.winter ? 0.004 : 0.0012) * q) this.add('smoke', it.x * TILE + 5, it.y * TILE + 1, 1, -4, 2.2, 0.8, 1.2, '180,180,185'); // hearth smoke, thicker in winter
        continue;
      }
      if (INDUSTRY.has(it.kind) && Math.random() < 0.05 * q) this.add('smoke', it.x * TILE + (it.big ? 10 : 4), it.y * TILE - (it.big ? 6 : 1), 2, -7, 3.5, 1.5, 2.2, '90,90,95');
    }
    // torches flicker at halls, castles, temples and markets after dark
    if (this.darkness > 0.15) for (const it of L.items) {
      if (!['town_hall', 'castle', 'star_fort', 'temple', 'market', 'barracks', 'campfire'].includes(it.kind)) continue;
      const fl = 0.85 + 0.15 * Math.sin(this.time * 9 + it.x * 3.1) + 0.08 * Math.sin(this.time * 23 + it.y);
      const tx = it.x * TILE + (it.big ? 8 : 4), ty = it.y * TILE + (it.big ? 2 : 4);
      this.light(tx, ty, (it.big ? 26 : 16) * fl, 2);
      if (z >= 2) { ctx.fillStyle = `rgba(255,${170 + fl * 60},80,0.9)`; ctx.fillRect(tx + (it.big ? -6 : -3.5), ty + (it.big ? 2 : 1), 0.6, 0.9); ctx.fillRect(tx + (it.big ? 5.5 : 3), ty + (it.big ? 2 : 1), 0.6, 0.9); }
    }
    // windows at night
    if (this.darkness > 0.25 && z >= 1.2) {
      ctx.fillStyle = `rgba(255,214,120,${Math.min(1, this.darkness * 1.6)})`;
      for (const it of L.items) {
        if (it.kind !== 'house') continue;
        const h = hash2(it.x, it.y, 31);
        if (h < 0.55) ctx.fillRect(Math.round((it.x * TILE + 2 + (h * 6 | 0) % 3) * 2) / 2, it.y * TILE + 4, 1, 1);
      }
    }
    void st;
  }

  // ---------- Ambient life (carts, boats) ----------
  drawLife(ctx, v) {
    if (!SETTINGS.ambientLife || v.z < 0.8) return;
    const st = S();
    const W = this.world, w = W.w;
    const t = this.time;
    // carts on roads
    for (const r of st.roads) {
      const p = r.path;
      if (!p || p.length < 3) continue;
      const a = p[0], b = p[p.length - 1];
      const ax = (a % w) * TILE, ay = ((a / w) | 0) * TILE, bx = (b % w) * TILE, by = ((b / w) | 0) * TILE;
      if (Math.max(ax, bx) < v.x0 - 20 || Math.min(ax, bx) > v.x1 + 20 || Math.max(ay, by) < v.y0 - 20 || Math.min(ay, by) > v.y1 + 20) continue;
      const n = p.length > 18 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const len = p.length - 1;
        let u = ((t * 0.9) / len + hash2(r.a * 7 + k, r.b, 3)) % 2;
        const back = u > 1; if (back) u = 2 - u;
        const f = u * len, i0 = Math.floor(f), fr = f - i0;
        const t0 = p[i0], t1 = p[Math.min(len, i0 + 1)];
        const x = ((t0 % w) + ((t1 % w) - (t0 % w)) * fr) * TILE + 2;
        const y = (((t0 / w) | 0) + (((t1 / w) | 0) - ((t0 / w) | 0)) * fr) * TILE + 3;
        const dir = ((t1 % w) - (t0 % w)) * (back ? -1 : 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 1, y + 2, 6, 1);
        ctx.fillStyle = '#7a5532'; ctx.fillRect(x, y, 3, 2);
        ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x, y - 1, 3, 1);
        ctx.fillStyle = '#2a1d12'; ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1);
        ctx.fillStyle = '#6b4a2e'; ctx.fillRect(dir >= 0 ? x + 3 : x - 2, y, 2, 1.5);
      }
    }
    // fishing boats near harbours
    for (const s of st.settlements) {
      if (s.dead || !s.buildings.port) continue;
      const sx = (s.tile % w) * TILE, sy = ((s.tile / w) | 0) * TILE;
      if (sx < v.x0 - 60 || sx > v.x1 + 60 || sy < v.y0 - 60 || sy > v.y1 + 60) continue;
      let wt = this.portWater.get(s.id);
      if (!wt) {
        wt = [];
        const cx = s.tile % w, cy = (s.tile / w) | 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= W.h) continue;
          const i = y * w + x;
          if (this.water[i] === 1 || this.water[i] === 2) wt.push(i);
        }
        this.portWater.set(s.id, wt);
      }
      if (!wt.length) continue;
      const n = Math.min(4, s.buildings.port + 1);
      for (let k = 0; k < n; k++) {
        const base = wt[(hash2(s.id, k, 4) * wt.length) | 0];
        const ang = t * 0.25 + k * 2.1 + s.id;
        const x = (base % w) * TILE + 4 + Math.cos(ang) * 5, y = ((base / w) | 0) * TILE + 4 + Math.sin(ang) * 3;
        const bob = Math.sin(t * 3 + k) * 0.3;
        ctx.fillStyle = '#5a3c22'; ctx.fillRect(x - 2, y + bob, 4, 1);
        ctx.fillStyle = '#f2ecdc'; ctx.fillRect(x, y - 2 + bob, 1, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 3 - Math.cos(ang), y + 1 + bob, 1, 1);
      }
    }
  }

  // ---------- Phase 20: mist at dawn, fireflies and stars on still water at night ----------
  drawNature(ctx, v) {
    if (!SETTINGS.ambientLife || v.z < 1.4) return;
    const W = this.world, w = W.w, t = this.time;
    const night = clamp((this.darkness || 0) / 0.5, 0, 1);
    const dawn = clamp(1 - Math.abs(this.tod - 0.27) / 0.08, 0, 1);
    const month = Math.floor((S().day % 360) / 30);
    const warm = month >= 3 && month <= 8;
    const tx0 = Math.max(0, v.tx0), ty0 = Math.max(0, v.ty0), tx1 = Math.min(w, v.tx1), ty1 = Math.min(W.h, v.ty1);
    if ((tx1 - tx0) * (ty1 - ty0) > 9000) return; // only when fairly close
    for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
      const i = y * w + x, b = W.biome[i];
      const X = x * TILE, Y = y * TILE;
      // mist pooling over marshes, rivers and lake shores in the early morning
      if (dawn > 0.05 && (b === B.SWAMP || W.river[i] || this.water[i] === 2)) {
        const ph = Math.sin(t * 0.3 + hash2(x, y, 71) * 6);
        ctx.fillStyle = `rgba(232,238,246,${(0.16 + ph * 0.06) * dawn})`;
        for (let k = 0; k < 3; k++) { const ox = Math.round(((hash2(x, y, 72 + k) * 8 + t * 0.6) % 10) * 2) / 2 - 1, oy = Math.round(hash2(y, x, 75 + k) * 12) / 2; ctx.fillRect(X + ox, Y + oy, 5 + k, 2); }
      }
      if (night < 0.3) continue;
      // stars mirrored in calm open water
      if (this.water[i] === 1 && hash2(x, y, 81) < 0.25) {
        const tw = Math.sin(t * (1 + hash2(x, y, 82) * 2) + x * 3);
        if (tw > 0.1) {
          const sx = X + ((hash2(x, y, 83) * 14) | 0) / 2, sy = Y + ((hash2(y, x, 84) * 14) | 0) / 2;
          ctx.fillStyle = `rgba(250,252,255,${Math.min(1, 0.95 * night * tw)})`; ctx.fillRect(sx, sy, 0.5, 0.5);
          if (hash2(x, y, 89) < 0.3 && tw > 0.6) { ctx.fillStyle = `rgba(220,232,255,${0.55 * night * tw})`; ctx.fillRect(sx - 0.5, sy, 0.5, 0.5); ctx.fillRect(sx + 0.5, sy, 0.5, 0.5); ctx.fillRect(sx, sy - 0.5, 0.5, 0.5); ctx.fillRect(sx, sy + 0.5, 0.5, 0.5); } // the brightest twinkle as little crosses
          this.light(sx, sy, 1.5, 3);
        }
      }
      // fireflies over grass, forest edges and marsh on summer nights
      if (warm && (b === B.GRASS || b === B.FOREST || b === B.SWAMP || b === B.PLAINS || b === B.JUNGLE) && hash2(x, y, 85) < 0.07) {
        for (let k = 0; k < 2; k++) {
          const a = t * (0.5 + hash2(x, k, 86)) + hash2(y, k, 87) * 6.28;
          const fx = X + 4 + Math.cos(a) * 3 + Math.sin(a * 1.7) * 1.5, fy = Y + 3 + Math.sin(a * 0.8) * 2.5;
          const blink = Math.sin(t * 2.6 + hash2(x + k, y, 88) * 9);
          if (blink < -0.2) continue;
          ctx.fillStyle = `rgba(214,255,140,${0.9 * night})`;
          ctx.fillRect(Math.round(fx * 2) / 2, Math.round(fy * 2) / 2, 0.5, 0.5);
          this.light(fx, fy, 2.5 + blink, 4);
        }
      }
    }
  }

  // ---------- Disasters, particles, transient animations ----------
  drawEffects(ctx, v, running) {
    const st = S();
    const W = this.world, w = W.w;
    const dt = running ? 1 / 60 : 0;
    const q = SETTINGS.effectsQuality || 2;
    const inView = (x, y, R) => x + R > v.x0 && x - R < v.x1 && y + R > v.y0 && y - R < v.y1;
    // active disasters
    for (const d of st.disasters || []) {
      if (d.until < st.day) continue;
      const x = (d.tile % w) * TILE + 4, y = ((d.tile / w) | 0) * TILE + 4, R = d.r * TILE;
      if (!inView(x, y, R + 40)) continue;
      const k = q * (running ? 1 : 0);
      switch (d.type) {
        case 'volcano':
          if (Math.random() < 0.6 * k) this.add('smoke', x + (Math.random() - 0.5) * 6, y - 4, (Math.random() - 0.5) * 6, -16 - Math.random() * 10, 5 + Math.random() * 3, 3, 4, '70,64,62');
          if (Math.random() < 0.4 * k) this.add('spark', x, y - 3, (Math.random() - 0.5) * 30, -40 - Math.random() * 40, 1.2, 1.2);
          this.glowDisc(ctx, x, y, 14, '255,110,40', 0.35 + 0.15 * Math.sin(this.time * 4));
          this.light(x, y, 50, 2);
          break;
        case 'wildfire':
          // Phase 20: the burning ground itself — flickering flame tongues across the fire's reach
          if (v.z >= 1.2) for (let n = 0; n < Math.round(d.r * d.r * 2.2); n++) {
            const a = hash2(d.tile, n, 31) * TAU, rr = Math.sqrt(hash2(n, d.tile, 32)) * R;
            const fx = Math.round((x + Math.cos(a) * rr) * 2) / 2, fy = Math.round((y + Math.sin(a) * rr) * 2) / 2;
            const fr = Math.floor(this.time * 9 + n * 1.7) % 3;
            ctx.fillStyle = 'rgba(40,24,16,0.35)'; ctx.fillRect(fx - 1.5, fy - 0.5, 3, 1); // scorched ground
            ctx.drawImage(flameSprite(fr), fx - 1.5, fy - 5, 3, 5);
            if (n % 4 === 0) this.light(fx, fy, 14, 2);
          }
          for (let i = 0; i < 2 * k; i++) this.spawnAround('fire', x, y, R);
          if (Math.random() < 0.4 * k) this.spawnAround('smoke', x, y, R);
          this.light(x, y, R + 20, 2);
          break;
        case 'flood': {
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, 'rgba(70,130,200,0.38)'); g.addColorStop(0.7, 'rgba(70,130,200,0.22)'); g.addColorStop(1, 'rgba(70,130,200,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
          if (Math.random() < 0.05 * k) this.anims.push({ k: 'ring', x: x + (Math.random() - 0.5) * R, y: y + (Math.random() - 0.5) * R, t: 0, dur: 1.5, R: 10, col: '180,220,255' });
          break;
        }
        case 'drought': {
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, 'rgba(210,160,70,0.22)'); g.addColorStop(1, 'rgba(210,160,70,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
          if (Math.random() < 0.15 * k) this.spawnAround('dust', x, y, R);
          break;
        }
        case 'blizzard':
          for (let i = 0; i < 3 * k; i++) this.spawnAround('snow', x, y, R);
          ctx.fillStyle = 'rgba(230,240,255,0.12)'; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
          break;
        case 'earthquake':
          if (Math.random() < 0.5 * k) this.spawnAround('dust', x, y, R * 0.6);
          break;
        default: break;
      }
    }
    // plague motes over sick towns; fires in besieged towns
    for (const s of st.settlements) {
      if (s.dead) continue;
      const x = (s.tile % w) * TILE + 4, y = ((s.tile / w) | 0) * TILE + 4;
      if (!inView(x, y, 30)) continue;
      if (s.plague && s.plague.until > st.day) {
        if (running && Math.random() < 0.25 * q) this.add('mote', x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 16, 0, -4, 2.5, 1.2, 0, '150,220,90');
        this.glowDisc(ctx, x, y, 22, '120,200,80', 0.12);
      }
    }
    for (const a of st.armies) {
      if (!a.siege) continue;
      if (a.siege.blocked) continue;
      const s = st.settlements[a.siege.s];
      if (!s || s.dead) continue;
      const x = (s.tile % w) * TILE + 4, y = ((s.tile / w) | 0) * TILE + 4;
      if (!inView(x, y, 30)) continue;
      if (running && Math.random() < 0.3 * q) this.spawnAround('fire', x, y, 10);
      if (running && Math.random() < 0.15 * q) this.spawnAround('smoke', x, y, 10);
      // Phase 20: a few roofs ablaze, worse as the siege drags on
      const L = v.z >= 1.4 ? this.r.layouts?.get?.(s.id) : null;
      if (L) { const burn = 0.06 + Math.min(0.25, (a.siege.progress || 0) * 0.3); for (const it of L.items) { if (it.kind !== 'house' || hash2(it.x, it.y, 33) > burn) continue; const fx = it.x * TILE + 4, fy = it.y * TILE + 3; ctx.drawImage(flameSprite(Math.floor(this.time * 9 + it.x) % 3), fx - 1.5, fy - 5, 3, 5); if (running && Math.random() < 0.06 * q) this.add('smoke', fx, fy - 5, (Math.random() - 0.5) * 2, -7, 3.5, 2, 2.5, '70,64,60'); } }
      this.light(x, y, 22, 2);
    }
    // battle smoke and gun flashes
    for (const b of st.battles || []) {
      if (b.ended) continue;
      const t = b.tile ?? st.armies.find((a) => a.id === b.a)?.tile;
      if (t == null) continue;
      const x = (t % w) * TILE + 4, y = ((t / w) | 0) * TILE + 4;
      if (!inView(x, y, 30)) continue;
      if (running && Math.random() < 0.35 * q) this.spawnAround('smoke', x, y, 8);
      if (running && Math.random() < 0.25 * q) { this.add('spark', x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 20, -10, 0.25, 1.4); this.light(x, y, 18, 2); }
    }
    // particles
    for (const p of this.p) {
      if (p.x < v.x0 - 20 || p.x > v.x1 + 20 || p.y < v.y0 - 20 || p.y > v.y1 + 20) continue;
      const lf = p.life / p.max;
      switch (p.k) {
        case 'smoke': {
          // Phase 20: round pixel puffs that grow and fade (drawn at the shared 2 px per unit)
          const d = Math.max(2, Math.min(28, Math.round(p.size * 2)));
          ctx.globalAlpha = Math.min(0.75, 0.55 * lf + 0.08);
          ctx.drawImage(puffSprite(d, p.col || '128,124,120'), Math.round((p.x - d / 4) * 2) / 2, Math.round((p.y - d / 4) * 2) / 2, d / 2, d / 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'dust': ctx.fillStyle = `rgba(190,165,120,${0.35 * lf})`; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); break;
        case 'fire': {
          // Phase 20: a flame tongue — hot core, orange body, red tips — on the pixel grid
          const X = Math.round(p.x * 2) / 2, Y = Math.round(p.y * 2) / 2, sz = Math.max(0.5, Math.round(p.size * 2) / 2);
          const c = lf > 0.6 ? '255,236,140' : lf > 0.3 ? '255,146,44' : '206,64,30';
          ctx.fillStyle = `rgba(${c},${0.9 * lf + 0.1})`; ctx.fillRect(X, Y, sz, sz * 1.5);
          if (lf > 0.5) { ctx.fillStyle = `rgba(255,252,220,${lf})`; ctx.fillRect(X + sz / 4, Y + sz * 0.75, Math.max(0.5, sz / 2), Math.max(0.5, sz / 2)); }
          if (Math.random() < 0.05) this.light(p.x, p.y, 18, 2);
          break;
        }
        case 'ember': { const fl = Math.sin(p.life * 30) > 0 ? 1 : 0.5; ctx.fillStyle = `rgba(255,${170 + (lf * 70) | 0},70,${lf * fl})`; ctx.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5); break; }
        case 'spark': ctx.fillStyle = `rgba(255,${180 + (lf * 70) | 0},90,${lf})`; ctx.fillRect(p.x, p.y, p.size, p.size); break;
        case 'debris': ctx.fillStyle = `rgba(90,70,50,${Math.min(1, lf * 2)})`; ctx.fillRect(p.x, p.y, p.size, p.size); break;
        case 'mote': ctx.fillStyle = `rgba(${p.col},${Math.sin(lf * Math.PI) * 0.9})`; ctx.fillRect(p.x, p.y, p.size, p.size); break;
        case 'flake': ctx.fillStyle = `rgba(245,250,255,${lf})`; ctx.fillRect(p.x, p.y, p.size, p.size); break;
        default: break;
      }
    }
    // transient animations
    for (const a of this.anims) {
      if (a.t < 0) continue;
      const u = clamp(a.t / a.dur, 0, 1);
      if (a.k === 'ring') {
        pixelRing(ctx, a.x, a.y, Math.max(1, a.R * u), `rgba(${a.col},${(1 - u) * 0.8})`, { px: u < 0.5 ? 1.5 : 1 }); // Phase 18: crisp pixel ring
      } else if (a.k === 'meteor' && !a.hit) {
        const sx = a.x + 220 * (1 - u), sy = a.y - 260 * (1 - u);
        const g = ctx.createLinearGradient(sx + 60, sy - 70, sx, sy);
        g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(1, 'rgba(255,240,200,0.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx + 60, sy - 70); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx - 2, sy - 2, 4, 4);
        this.light(sx, sy, 40, 2);
        if (running) this.add('fire', sx, sy, 0, 0, 0.4, 2);
      } else if (a.k === 'bolt') {
        ctx.strokeStyle = `rgba(240,245,255,${1 - u})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); a.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.strokeStyle = `rgba(170,190,255,${(1 - u) * 0.5})`; ctx.lineWidth = 4;
        ctx.beginPath(); a.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        this.light(a.x, a.y, 60 * (1 - u), 3);
      }
    }
    void dt;
  }

  glowDisc(ctx, x, y, R, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  }

  // ---------- Clouds (world space, on top of everything on the ground) ----------
  drawSky(ctx, v) {
    if (!SETTINGS.clouds) return;
    const z = v.z;
    const alpha = z < 0.4 ? 0.55 : z < 1 ? 0.45 : z < 2 ? 0.3 : z < 3 ? 0.1 : 0;
    const shadowOnly = z >= 2.2; // Phase 20: close up, only the clouds' shadows sweep over the land
    if (alpha <= 0 && !shadowOnly) return;
    const CELL = 150;
    const ox = (this.time * this.wind() * 1.4) % CELL;
    const cx0 = Math.floor((v.x0 - ox - 160) / CELL), cx1 = Math.ceil((v.x1 - ox + 40) / CELL);
    const cy0 = Math.floor((v.y0 - 120) / CELL), cy1 = Math.ceil((v.y1 + 40) / CELL);
    const epoch = Math.floor((this.time * this.wind() * 1.4) / CELL);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const id = cx - epoch; // identity follows the drift
        const h = hash2(id, cy, 91);
        const x = cx * CELL + ox + hash2(id, cy, 92) * CELL * 0.7, y = cy * CELL + hash2(id, cy, 93) * CELL * 0.7;
        const c = this.cover(x, y);
        if (h > (c - 0.35) * 1.6) continue;
        const spr = this.clouds[(hash2(id, cy, 94) * this.clouds.length) | 0];
        const sc = 2 + hash2(id, cy, 95) * 2.5;
        const ww = spr.width * sc, hh = spr.height * sc;
        const dark = clamp((c - 0.55) * 2, 0, 0.6);
        // shadow on the ground
        ctx.globalAlpha = shadowOnly ? 0.14 + dark * 0.1 : alpha * 0.35;
        if (shadowOnly) { ctx.imageSmoothingEnabled = true; ctx.drawImage(spr.soft, x + 26, y + 34, ww, hh); ctx.imageSmoothingEnabled = false; continue; }
        ctx.drawImage(spr.shadow, x + 26, y + 34, ww, hh);
        ctx.globalAlpha = alpha * (0.8 + c * 0.4);
        ctx.drawImage(dark > 0.2 ? spr.dark : spr, x, y, ww, hh);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Lights ----------
  light(x, y, r, kind = 1) { if (this.darkness > 0.05 && this.lights.length < 220) this.lights.push(x, y, r, kind); }

  // ---------- Screen space: night, weather, flashes ----------
  drawScreen(ctx, v) {
    const cw = this.r.canvas.width, ch = this.r.canvas.height;
    const dpr = v.dpr, z = v.z;
    const st = S();
    const toSX = (x) => (x - this.r.cam.x) * z * dpr, toSY = (y) => (y - this.r.cam.y) * z * dpr;
    // day / night
    const sun = Math.sin(TAU * (this.tod - 0.25));
    const darkness = SETTINGS.dayNight ? clamp(-sun * 1.25 + 0.05, 0, 1) * 0.68 : 0;
    this.darkness = darkness;
    const twilight = SETTINGS.dayNight ? clamp(1 - Math.abs(sun) / 0.35, 0, 1) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Phase 20: colour grading by time of day — bright and bold by day, warm and painterly at
    // dawn and dusk (gold, then pink with violet shadows), moody blue at night (lights glow below)
    if (SETTINGS.colorGrade !== false) {
      const morning = this.tod < 0.5;
      const night = clamp(darkness / 0.68, 0, 1);
      // golden hours last longer than the strict twilight: low sun paints the whole scene
      const twilight = clamp(1 - Math.abs(sun - 0.12) / 0.42, 0, 1) * (1 - night * 0.6);
      const day = clamp(sun * 1.5, 0, 1) * (1 - twilight * 0.7);
      // 1. saturation and contrast for the whole scene in one filtered copy
      const sat = 1 + 0.2 * day + 0.1 * twilight - 0.25 * night, con = 1 + 0.06 * day + 0.04 * twilight;
      const sep = morning ? 0.12 * twilight : 0.06 * twilight;
      if (SETTINGS.gradeFilter !== false && (Math.abs(sat - 1) > 0.02 || con > 1.01 || sep > 0.01)) {
        ctx.filter = `saturate(${sat.toFixed(2)}) contrast(${con.toFixed(2)})${sep > 0.01 ? ` sepia(${sep.toFixed(2)})` : ''}`;
        ctx.drawImage(this.r.canvas, 0, 0);
        ctx.filter = 'none';
      }
      // 2. the colour of the light
      ctx.globalCompositeOperation = 'soft-light';
      if (twilight > 0.01) {
        ctx.fillStyle = morning ? `rgba(255,190,120,${0.5 * twilight})` : `rgba(255,130,150,${0.55 * twilight})`;
        ctx.fillRect(0, 0, cw, ch);
      }
      if (day > 0.01) { ctx.fillStyle = `rgba(255,236,200,${0.12 * day})`; ctx.fillRect(0, 0, cw, ch); }
      // violet shadows at dusk, a cool cast at night
      ctx.globalCompositeOperation = 'multiply';
      if (twilight > 0.01) { ctx.fillStyle = morning ? `rgba(255,206,150,${0.4 * twilight})` : `rgba(236,160,176,${0.45 * twilight})`; ctx.fillRect(0, 0, cw, ch); } // the low sun's colour over everything
      if (night > 0.01) { ctx.fillStyle = `rgba(150,170,230,${0.25 * night})`; ctx.fillRect(0, 0, cw, ch); }
      // a gentle lift of the midtones at noon
      ctx.globalCompositeOperation = 'screen';
      if (day > 0.3) { ctx.fillStyle = `rgba(255,248,225,${(day - 0.3) * 0.07})`; ctx.fillRect(0, 0, cw, ch); }
      if (twilight > 0.01) { ctx.fillStyle = morning ? `rgba(255,200,130,${0.07 * twilight})` : `rgba(150,90,170,${0.08 * twilight})`; ctx.fillRect(0, 0, cw, ch); } // a glow in the air
      ctx.globalCompositeOperation = 'source-over';
    }
    // Phase 20: shafts of sunlight slanting through the air in the golden hours
    if (SETTINGS.sunbeams !== false && SETTINGS.colorGrade !== false && v.z >= 1.4) {
      const low = clamp(1 - Math.abs(sun - 0.3) / 0.3, 0, 1) * (1 - clamp(darkness * 3, 0, 1));
      if (low > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const lean = this.tod < 0.5 ? 1 : -1; // from the east in the morning, the west in the evening
        ctx.translate(cw / 2, ch / 2); ctx.rotate(lean * 0.5); ctx.translate(-cw / 2, -ch / 2);
        const span = Math.hypot(cw, ch);
        for (let k = 0; k < 6; k++) {
          const bx = cw / 2 + ((hash2(k, 1, 61) - 0.5) * 1.4 + Math.sin(this.time * 0.05 + k) * 0.05) * cw;
          const bw = (0.03 + hash2(k, 2, 62) * 0.08) * cw;
          const a = low * (0.035 + hash2(k, 3, 63) * 0.045) * (0.7 + 0.3 * Math.sin(this.time * 0.3 + k * 2));
          const g = ctx.createLinearGradient(0, ch / 2 - span / 2, 0, ch / 2 + span / 2);
          const col = this.tod < 0.5 ? '255,230,170' : '255,190,150';
          g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.4})`); g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g; ctx.fillRect(bx - bw / 2, ch / 2 - span / 2, bw, span);
        }
        ctx.restore();
      }
    }
    if (darkness > 0.01) {
      if (!this.dark || this.dark.width !== cw || this.dark.height !== ch) this.dark = makeCanvas(cw, ch);
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, cw, ch);
      d.fillStyle = `rgba(20,14,56,${darkness})`; // Phase 16: deep blue-violet night
      d.fillRect(0, 0, cw, ch);
      d.globalCompositeOperation = 'destination-out';
      const L = this.lights;
      for (let i = 0; i < L.length; i += 4) {
        const x = toSX(L[i]), y = toSY(L[i + 1]), r = L[i + 2] * z * dpr;
        if (x < -r || y < -r || x > cw + r || y > ch + r || r < 1) continue;
        const g = d.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.drawImage(this.dark, 0, 0);
      // warm glow
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < L.length; i += 4) {
        const x = toSX(L[i]), y = toSY(L[i + 1]), r = L[i + 2] * z * dpr * 0.7;
        if (x < -r || y < -r || x > cw + r || y > ch + r || r < 1) continue;
        const col = L[i + 3] === 2 ? '255,120,40' : L[i + 3] === 3 ? '180,200,255' : L[i + 3] === 4 ? '190,255,120' : '255,190,100';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col},${0.4 * darkness})`); g.addColorStop(0.45, `rgba(${col},${0.12 * darkness})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    this.lights.length = 0;
    // weather at the view centre
    if (SETTINGS.weather && this.world) {
      const cxw = this.r.cam.x + this.r.vw / z / 2, cyw = this.r.cam.y + this.r.vh / z / 2;
      const W = this.world;
      const tx = clamp((cxw / TILE) | 0, 0, W.w - 1), ty = clamp((cyw / TILE) | 0, 0, W.h - 1);
      const temp = W.temp[ty * W.w + tx];
      const c = SETTINGS.clouds ? this.cover(cxw, cyw) : 0.5;
      let rain = clamp((c - 0.6) / 0.3, 0, 1);
      const winter = this.cur?.snowCold > 0.3;
      let snow = temp < 0.3 || (winter && temp < 0.6);
      for (const d of st.disasters || []) {
        if (d.until < st.day) continue;
        const dx = (d.tile % W.w) - tx, dy = ((d.tile / W.w) | 0) - ty;
        if (dx * dx + dy * dy > (d.r + 6) ** 2) continue;
        if (d.type === 'blizzard') { rain = 1; snow = true; }
        if (d.type === 'drought') rain = 0;
      }
      if (temp > 0.8 && !snow && W.moist[ty * W.w + tx] < 0.25) rain *= 0.2; // deserts stay dry
      this.drawPrecip(ctx, cw, ch, rain, snow, dpr);
      // morning fog in autumn months and over marshes
      const month = Math.floor((st.day % 360) / 30);
      const morning = clamp(1 - Math.abs(this.tod - 0.3) / 0.12, 0, 1);
      const night = clamp(this.darkness * 1.4, 0, 1);
      const fog = (month === 9 || month === 10 ? 0.16 : 0.025) * morning + rain * 0.06 + night * 0.07; // Phase 20: clear mornings except in autumn
      if (fog > 0.01) this.drawFogBanks(ctx, cw, ch, fog, z * dpr, night);
    }
    if (this.flash > 0.01) { ctx.fillStyle = `rgba(255,250,235,${this.flash * 0.6})`; ctx.fillRect(0, 0, cw, ch); }
    // soft vignette frames the scene
    if (SETTINGS.colorGrade !== false) {
      if (!this.vig || this.vig.w !== cw || this.vig.h !== ch) {
        const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.62);
        g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.38)');
        this.vig = { w: cw, h: ch, g };
      }
      ctx.fillStyle = this.vig.g; ctx.fillRect(0, 0, cw, ch);
      if (this.darkness > 0.1) { ctx.globalAlpha = this.darkness; if (!this.vigN || this.vigN.w !== cw || this.vigN.h !== ch) { const g2 = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.6); g2.addColorStop(0, 'rgba(30,20,70,0)'); g2.addColorStop(1, 'rgba(14,8,40,0.55)'); this.vigN = { w: cw, h: ch, g: g2 }; } ctx.fillStyle = this.vigN.g; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
    }
  }

  // Phase 16: drifting fog banks anchored to the world (they slide past as you pan)
  drawFogBanks(ctx, cw, ch, a, zz, night) {
    const cell = 220; // world px per fog cell
    const drift = this.time * 2.2;
    const wx0 = this.r.cam.x - cell, wy0 = this.r.cam.y - cell;
    const wx1 = this.r.cam.x + cw / zz + cell, wy1 = this.r.cam.y + ch / zz + cell;
    const col = night > 0.3 ? '150,160,200' : '214,220,228';
    ctx.fillStyle = `rgba(${col},${a * 0.35})`; ctx.fillRect(0, 0, cw, ch);
    let n = 0;
    for (let gy = Math.floor(wy0 / cell); gy <= Math.floor(wy1 / cell); gy++) for (let gx = Math.floor((wx0 - drift) / cell); gx <= Math.floor((wx1 - drift) / cell); gx++) {
      if (n++ > 80) return;
      const hsh = Math.abs(Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453) % 1;
      if (hsh < 0.35) continue;
      const wx = gx * cell + drift + hsh * cell * 0.6, wy = gy * cell + ((hsh * 7.3) % 1) * cell * 0.6;
      const x = (wx - this.r.cam.x) * zz, y = (wy - this.r.cam.y) * zz, r = cell * (0.6 + hsh * 0.7) * zz;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a * 1.6})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  drawPrecip(ctx, cw, ch, amount, snow, dpr) {
    const q = SETTINGS.effectsQuality || 2;
    const want = Math.round(amount * (snow ? 160 : 220) * q * (cw * ch) / (1600 * 900 * dpr * dpr) * dpr);
    while (this.drops.length < want) this.drops.push({ x: Math.random() * cw, y: Math.random() * ch, s: 0.6 + Math.random() * 0.8 });
    if (this.drops.length > want) this.drops.length = want;
    if (!want) return;
    const wind = this.wind() * 0.6 * dpr;
    const dt = 1 / 60;
    if (snow) {
      ctx.fillStyle = 'rgba(250,252,255,0.85)';
      for (const p of this.drops) {
        p.x += (wind + Math.sin(this.time * 2 + p.s * 9) * 12 * dpr) * dt; p.y += 40 * p.s * dpr * dt;
        if (p.y > ch) { p.y = -4; p.x = Math.random() * cw; }
        if (p.x > cw) p.x -= cw; else if (p.x < 0) p.x += cw;
        const sz = (1.2 + p.s) * dpr;
        ctx.fillRect(p.x, p.y, sz, sz);
      }
    } else {
      ctx.strokeStyle = 'rgba(190,210,235,0.45)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      for (const p of this.drops) {
        p.x += wind * 4 * dt; p.y += 520 * p.s * dpr * dt;
        if (p.y > ch) { p.y = -10; p.x = Math.random() * cw; }
        if (p.x > cw) p.x -= cw;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + wind * 0.04, p.y + 9 * p.s * dpr);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(20,30,50,${0.12 * amount})`; ctx.fillRect(0, 0, cw, ch);
      if (amount > 0.75 && Math.random() < 0.004) this.flash = Math.max(this.flash, 0.35);
    }
  }

  // Short text for the top bar
  label() {
    const s = this.cur || seasonOf(S().day % 360);
    const sun = Math.sin(TAU * (this.tod - 0.25));
    const part = sun > 0.35 ? (this.tod < 0.5 ? 'Morning' : 'Afternoon') : sun > -0.1 ? (this.tod < 0.5 ? 'Dawn' : 'Dusk') : 'Night';
    return { season: s.name, part };
  }
}

// ---------- Procedural sprites ----------
function makeCloudSprites() {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const w = 30 + ((k * 7) % 14), h = 14 + (k % 3) * 3;
    const cv = makeCanvas(w, h), dark = makeCanvas(w, h), shadow = makeCanvas(w, h);
    const c = cv.getContext('2d'), cd = dark.getContext('2d'), cs = shadow.getContext('2d');
    const blobs = [];
    const n = 4 + (k % 3);
    for (let i = 0; i < n; i++) blobs.push([4 + hash2(k, i, 1) * (w - 8), h * 0.45 + hash2(k, i, 2) * h * 0.3, 3 + hash2(k, i, 3) * (h * 0.45)]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let inside = false;
        for (const [bx, by, r] of blobs) if ((x - bx) ** 2 + ((y - by) * 1.3) ** 2 < r * r) { inside = true; break; }
        if (!inside) continue;
        const top = y / h;
        const v = 255 - top * 50 - (hash2(x, y, k) < 0.15 ? 10 : 0);
        c.fillStyle = `rgb(${v},${v},${Math.min(255, v + 8)})`; c.fillRect(x, y, 1, 1);
        const dv = v * 0.68;
        cd.fillStyle = `rgb(${dv},${dv},${dv + 10})`; cd.fillRect(x, y, 1, 1);
        cs.fillStyle = 'rgb(10,20,30)'; cs.fillRect(x, y, 1, 1);
      }
    }
    // Phase 20: a soft shadow at 3× resolution with a feathered edge (drawn smoothed, close up)
    const soft = makeCanvas(w * 3, h * 3), so = soft.getContext('2d');
    for (let y = 0; y < h * 3; y++) for (let x = 0; x < w * 3; x++) {
      let best = 0;
      for (const [bx, by, r] of blobs) { const dd = Math.sqrt((x / 3 - bx) ** 2 + ((y / 3 - by) * 1.3) ** 2); best = Math.max(best, (r - dd) / r); }
      if (best <= 0) continue;
      so.fillStyle = `rgba(10,20,40,${Math.min(1, best * 2.2).toFixed(3)})`; so.fillRect(x, y, 1, 1);
    }
    cv.dark = dark; cv.shadow = shadow; cv.soft = soft;
    out.push(cv);
  }
  return out;
}

function makeScarSprite(sc, W) {
  const R = Math.max(1, sc.r) * TILE + 4;
  const size = R * 2 + 2;
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  let glow = null, gctx = null;
  const cx = size / 2, cy = size / 2;
  const put = (x, y, c, g = ctx) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const seed = sc.seed || 1;
  if (sc.type === 'lava') { glow = makeCanvas(size, size); gctx = glow.getContext('2d'); }
  // world pixel of the sprite's top-left corner: scars only mark land
  const ox = (sc.tile % W.w) * TILE + 4 - cx, oy = ((sc.tile / W.w) | 0) * TILE + 4 - cy;
  const onWater = (x, y) => {
    const tx = Math.floor((ox + x) / TILE), ty = Math.floor((oy + y) / TILE);
    if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return true;
    return BIOMES[W.biome[ty * W.w + tx]].water;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      if (onWater(x, y)) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      const n = hash2(x, y, seed);
      const wob = vnoise(x / 5, y / 5, seed) * 0.35;
      if (d > 1 + wob * 0.5) continue;
      switch (sc.type) {
        case 'crater': {
          if (d < 0.55) put(x, y, n < 0.2 ? '#2a2018' : '#3a2c20');
          else if (d < 0.75) put(x, y, n < 0.3 ? '#4d3b2a' : '#5c4834');
          else if (d < 0.95 && n < 0.75) put(x, y, n < 0.3 ? '#8c7458' : '#6e5a42');
          else if (n < 0.12) put(x, y, '#5c4834');
          break;
        }
        case 'lava': {
          if (d < 0.9 && n < 0.9) put(x, y, n < 0.3 ? '#1e1a1a' : '#2c2626');
          const crack = Math.abs(vnoise(x / 3, y / 3, seed + 5) - 0.5) < 0.06 + (1 - d) * 0.06;
          if (d < 0.8 && crack) put(x, y, d < 0.35 ? '#ffd060' : '#ff6a20', gctx);
          break;
        }
        case 'ash': if (n < 0.55 * (1.1 - d)) put(x, y, n < 0.2 ? 'rgba(80,78,76,0.75)' : 'rgba(120,118,115,0.6)'); break;
        case 'burn': if (n < 0.7 * (1.15 - d)) put(x, y, n < 0.25 ? 'rgba(25,20,16,0.8)' : 'rgba(55,45,35,0.6)'); break;
        case 'dry': if (n < 0.5 * (1.1 - d)) put(x, y, n < 0.2 ? 'rgba(170,140,80,0.45)' : 'rgba(196,170,110,0.35)'); break;
        case 'cracks': {
          const a = Math.atan2(dy, dx);
          const k = Math.round(a / (TAU / 7) + vnoise(d * 3, seed, 1) * 0.6);
          const on = Math.abs(a - k * (TAU / 7) - (vnoise(d * 4, k, seed) - 0.5) * 0.4) < 0.06 + 0.04 * (1 - d);
          if (on && d > 0.1) put(x, y, 'rgba(30,22,16,0.85)');
          break;
        }
        default: break;
      }
    }
  }
  return { cv, glow, cx, cy };
}

// ---------------- Phase 20: smoke puffs and flames as pixel sprites ----------------
const PUFFS = new Map();
// A round puff `d` art pixels across: lit on top, shaded below, ragged dithered rim
export function puffSprite(d, col) {
  const key = d + ':' + col;
  let c = PUFFS.get(key);
  if (c) return c;
  c = makeCanvas(d, d);
  const x = c.getContext('2d');
  const [r, g, b] = col.split(',').map(Number);
  const R = d / 2;
  for (let py = 0; py < d; py++) for (let px = 0; px < d; px++) {
    const dx = px + 0.5 - R, dy = py + 0.5 - R, q = (dx * dx + dy * dy) / (R * R);
    if (q > 1) continue;
    if (q > 0.7 && ((px + py) & 1)) continue; // dithered rim
    const lit = dy < -R * 0.3 ? 1.18 : dy > R * 0.35 ? 0.82 : 1;
    x.fillStyle = `rgb(${Math.min(255, r * lit) | 0},${Math.min(255, g * lit) | 0},${Math.min(255, b * lit) | 0})`;
    x.fillRect(px, py, 1, 1);
  }
  PUFFS.set(key, c);
  return c;
}
const FLAMES = [];
// Flame tongues, 6×10 px, three flickering frames: red base, orange body, yellow-white core
export function flameSprite(f) {
  if (FLAMES[f]) return FLAMES[f];
  const c = makeCanvas(6, 10), x = c.getContext('2d');
  const P = (px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
  for (let py = 0; py < 10; py++) {
    const t = py / 9; // 0 top .. 1 base
    const half = Math.max(0.5, (1 - Math.abs(t - 0.75) * 1.3) * 3 * (0.75 + 0.25 * Math.sin(py * 1.7 + f * 2.1)));
    const sway = Math.round(Math.sin(py * 0.9 + f * 2) * (1 - t) * 1.2);
    for (let px = 0; px < 6; px++) {
      const dx = Math.abs(px + 0.5 - 3 - sway);
      if (dx > half) continue;
      const core = dx < half * 0.45 && t > 0.35;
      P(px, py, core ? (t > 0.7 ? '#fff6c8' : '#ffd860') : t < 0.3 ? '#d8402a' : '#ff8a2a');
    }
  }
  FLAMES[f] = c;
  return c;
}
