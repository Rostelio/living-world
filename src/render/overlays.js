import { G, S } from '../sim/state.js';
import { BIOMES, RESOURCES } from '../data/biomes.js';
import { hexToRgb, shade, clamp } from '../core/util.js';
import { makeCanvas } from './sprites.js';
import { atWar, allied, inTruce } from '../sim/diplomacy.js';
import { SETTINGS } from '../ui/settings.js';
// Phase 17: a colour-blind-safe palette (Okabe–Ito and friends), with lightness varied for more realms
const CB = [[0, 114, 178], [230, 159, 0], [86, 180, 233], [0, 158, 115], [240, 228, 66], [213, 94, 0], [204, 121, 167], [120, 120, 120], [0, 70, 120], [150, 100, 0], [40, 110, 150], [0, 100, 70], [170, 160, 40], [140, 60, 0], [140, 70, 110], [200, 200, 200]];

export const BS = 8; // border canvas pixels per tile (Phase 20: whole pixels, no half-pixel blur)

export class Overlays {
  constructor(world) {
    this.world = world;
    const { w, h } = world;
    this.owner = makeCanvas(w, h);
    this.border = makeCanvas(w * BS, h * BS);
    this.heat = makeCanvas(w, h);
    this.heatMode = null;
    this.edgeCache = new Map();
    this.civLabels = [];
  }

  rebuildOwners() {
    const W = this.world, st = S();
    const { w, h, N, province } = W;
    if (st.provinces.length !== W.provinces.length) return; // world and state out of step (mid-load)
    // Political fill
    const octx = this.owner.getContext('2d');
    const img = octx.createImageData(w, h);
    const civRgb = st.civs.map((c) => (SETTINGS.colorBlind ? CB[c.id % CB.length] : hexToRgb(c.color)));
    const own = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const p = province[i];
      if (p < 0) continue;
      const o = st.provinces[p].owner;
      own[i] = o;
      if (o < 0) continue;
      const c = civRgb[o];
      const claimed = st.provinces[p].settlement < 0;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = claimed ? 150 : 220;
    }
    octx.putImageData(img, 0, 0);
    this.own = own;

    // Borders
    const bctx = this.border.getContext('2d');
    bctx.clearRect(0, 0, this.border.width, this.border.height);
    const civBright = st.civs.map((c) => `rgb(${shade(civRgb[c.id], 0.25).map(Math.round).join(',')})`);
    const civDark = st.civs.map((c) => `rgb(${shade(civRgb[c.id], -0.35).map(Math.round).join(',')})`);
    bctx.fillStyle = 'rgba(20,14,8,0.28)';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p = province[i];
        if (x < w - 1) {
          const q = province[i + 1];
          if (p !== q && p >= 0 && q >= 0 && own[i] === own[i + 1]) bctx.fillRect((x + 1) * BS - 1, y * BS, 1, BS);
        }
        if (y < h - 1) {
          const q = province[i + w];
          if (p !== q && p >= 0 && q >= 0 && own[i] === own[i + w]) bctx.fillRect(x * BS, (y + 1) * BS - 1, BS, 1);
        }
      }
    }
    // Realm borders: dual-colour strips inside each side
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const o = own[i];
        if (o < 0) continue;
        const X = x * BS, Y = y * BS;
        const diff = (j) => own[j] !== o;
        bctx.fillStyle = civBright[o];
        if (x === 0 || diff(i - 1)) bctx.fillRect(X, Y, 2, BS);
        if (x === w - 1 || diff(i + 1)) bctx.fillRect(X + BS - 2, Y, 2, BS);
        if (y === 0 || diff(i - w)) bctx.fillRect(X, Y, BS, 2);
        if (y === h - 1 || diff(i + w)) bctx.fillRect(X, Y + BS - 2, BS, 2);
        bctx.fillStyle = civDark[o];
        if (x > 0 && diff(i - 1) && province[i - 1] >= 0) bctx.fillRect(X, Y, 1, BS);
        if (y > 0 && diff(i - w) && province[i - w] >= 0) bctx.fillRect(X, Y, BS, 1);
      }
    }
    // Phase 16: frontier banner spots — sparse land tiles on realm borders
    this.frontier = [];
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, o = own[i];
      if (o < 0) continue;
      const nb = [i - 1, i + 1, i - w, i + w].find((j) => own[j] >= 0 && own[j] !== o);
      if (nb === undefined) continue;
      if (((x * 73856093) ^ (y * 19349663)) % 23 !== 0) continue;
      this.frontier.push({ x, y, civ: o });
    }
    this.computeCivLabels(own);
    this.heatMode = null;
  }

  computeCivLabels(own) {
    const W = this.world, st = S();
    const { w, N } = W;
    const acc = st.civs.map(() => ({ n: 0, x: 0, y: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 }));
    for (let i = 0; i < N; i++) {
      const o = own[i];
      if (o < 0) continue;
      const a = acc[o];
      const x = i % w, y = (i / w) | 0;
      a.n++; a.x += x; a.y += y;
      if (x < a.minX) a.minX = x; if (x > a.maxX) a.maxX = x;
      if (y < a.minY) a.minY = y; if (y > a.maxY) a.maxY = y;
    }
    this.civLabels = acc.map((a, id) => (a.n ? { civ: id, n: a.n, x: a.x / a.n, y: a.y / a.n, span: Math.max(a.maxX - a.minX, 4) } : null)).filter(Boolean);
  }

  // Heatmap modes: population, development, resources
  rebuildHeat(mode) {
    const W = this.world, st = S();
    const { w, h, N, province } = W;
    const ctx = this.heat.getContext('2d');
    const img = ctx.createImageData(w, h);
    const val = new Float32Array(W.provinces.length);
    let max = 0;
    if (mode === 'population') {
      for (const s of st.settlements) if (!s.dead) val[s.province] = s.pop;
      max = Math.max(1, ...val);
    } else if (mode === 'development') {
      for (const s of st.settlements) {
        if (s.dead) continue;
        let lv = 0;
        for (const k in s.buildings) lv += s.buildings[k];
        val[s.province] = s.stage * 4 + lv;
        for (const c of s.claims) val[c] = Math.max(val[c], (s.stage * 4 + lv) * 0.4);
      }
      max = Math.max(1, ...val);
    } else if (mode === 'unrest') {
      for (const s of st.settlements) {
        if (s.dead) continue;
        val[s.province] = Math.max(1, s.unrest || 0);
        for (const c of s.claims) val[c] = Math.max(1, (s.unrest || 0) * 0.7);
      }
      max = 100;
    } else if (mode === 'military') {
      // Diplomatic stance toward the player: self, ally/vassal, enemy, neutral
      const me = st.playerId;
      const pal = SETTINGS.colorBlind ? { // blue / orange instead of green / red
        self: [0, 114, 178], ally: [86, 180, 233], subject: [0, 158, 115], enemy: [213, 94, 0], truce: [240, 228, 66], neutral: [130, 130, 130],
      } : {
        self: [90, 200, 110], ally: [80, 140, 240], subject: [70, 200, 200], enemy: [230, 60, 45], truce: [230, 170, 60], neutral: [120, 115, 110],
      };
      const civColor = st.civs.map((c) => {
        if (c.id === me) return pal.self;
        if (atWar(me, c.id)) return pal.enemy;
        if (allied(me, c.id)) return pal.ally;
        if (c.overlord === me || st.civs[me].overlord === c.id) return pal.subject;
        if (inTruce(me, c.id)) return pal.truce;
        return pal.neutral;
      });
      for (let i = 0; i < N; i++) {
        const p = province[i];
        if (p < 0) continue;
        const o = st.provinces[p].owner;
        if (o < 0) { img.data[i * 4 + 3] = 0; continue; }
        const c = civColor[o];
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 170;
      }
      ctx.putImageData(img, 0, 0);
      this.heatMode = mode;
      return;
    } else if (mode === 'resources') {
      W.provinces.forEach((P, i) => { const p = P.pot; val[i] = p.food + p.wood + p.stone + p.iron * 1.5 + p.gold * 2; });
      max = Math.max(...val);
    }
    const ramp = (t) => {
      // dark blue -> teal -> yellow -> red
      const stops = [[30, 40, 90], [40, 140, 150], [240, 210, 80], [220, 60, 40]];
      const f = clamp(t, 0, 1) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(f)), r = f - k;
      return stops[k].map((v, j) => v + (stops[k + 1][j] - v) * r);
    };
    for (let i = 0; i < N; i++) {
      const p = province[i];
      if (p < 0) continue;
      const v = val[p];
      if (mode !== 'resources' && v <= 0) { img.data[i * 4 + 3] = 90; img.data[i * 4] = 20; img.data[i * 4 + 1] = 20; img.data[i * 4 + 2] = 30; continue; }
      const t = mode === 'population' ? Math.sqrt(v / max) : v / max;
      const c = ramp(t);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 190;
    }
    ctx.putImageData(img, 0, 0);
    this.heatMode = mode;
    void h; void BIOMES; void RESOURCES;
  }

  // Rectangles (tile units) outlining a province, for selection highlight.
  provinceEdges(p) {
    if (this.edgeCache.has(p)) return this.edgeCache.get(p);
    const W = this.world;
    const { w, h, province } = W;
    const rects = [];
    for (const i of W.provinces[p].tiles) {
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || province[i - 1] !== p) rects.push([x, y, 0.15, 1]);
      if (x === w - 1 || province[i + 1] !== p) rects.push([x + 0.85, y, 0.15, 1]);
      if (y === 0 || province[i - w] !== p) rects.push([x, y, 1, 0.15]);
      if (y === h - 1 || province[i + w] !== p) rects.push([x, y + 0.85, 1, 0.15]);
    }
    this.edgeCache.set(p, rects);
    return rects;
  }
}
