// Phase 20 — shared pixel-art tools: coloured ("selective") outlines, cast shadows that follow
// the sun, and the PNG art slots that let hand-drawn sprites replace the code-drawn ones.
import { makeCanvas } from './sprites.js';

// ---------------- Selective outline ----------------
// Instead of a black line, each outline pixel takes a dark, slightly purple-shifted shade of the
// sprite pixel it borders. Sprites read as part of the scene instead of stickers on top of it.
export function selectiveOutline(d, w, h, inside = 200, empty = 90, alpha = 235) {
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d.data[(y * w + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (A(x, y) >= empty) continue;
    let best = -1, ba = inside;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const a = A(x + dx, y + dy); if (a > ba) { ba = a; best = ((y + dy) * w + x + dx) * 4; } }
    if (best >= 0) out.push([(y * w + x) * 4, best]);
  }
  for (const [o, s] of out) {
    const r = d.data[s], g = d.data[s + 1], b = d.data[s + 2];
    // darken to ~30% and lean towards violet: coloured, never pure black
    d.data[o] = Math.round(r * 0.3 + 14); d.data[o + 1] = Math.round(g * 0.26 + 8); d.data[o + 2] = Math.round(b * 0.34 + 22); d.data[o + 3] = alpha;
  }
}

// ---------------- Cast shadows ----------------
// A black silhouette of the sprite, squashed and sheared away from the sun, drawn at its feet.
const SIL = new WeakMap();
function silhouette(img) {
  let c = SIL.get(img);
  if (c) return c;
  c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#1a1030';
  x.fillRect(0, 0, img.width, img.height);
  SIL.set(img, c);
  return c;
}
export const SUN = { dx: 0.5, len: 0.45, alpha: 0.26 };
// Update from the time of day (0 = midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset)
export function setSun(tod, darkness) {
  const ang = (tod - 0.5) * Math.PI * 2; // 0 at noon
  const elev = Math.max(0, Math.cos(ang));
  SUN.dx = -Math.sin(ang) * 0.9; // morning sun in the east throws shadows west
  SUN.len = 0.28 + (1 - elev) * 0.42;
  SUN.alpha = darkness > 0.3 ? 0.12 : 0.26 * (0.6 + 0.4 * elev);
}
// Draw the shadow of `img` whose bottom edge stands at (x, base) and is w×h world px
export function castShadow(ctx, img, x, base, w, h) {
  if (!img || SUN.alpha < 0.02) return;
  const sil = silhouette(img);
  ctx.save();
  ctx.globalAlpha = SUN.alpha;
  // map the sprite's bottom row to the ground line; its top leans along the sun direction
  ctx.transform(1, 0, -SUN.dx * SUN.len * 1.6, SUN.len, x, base);
  ctx.drawImage(sil, 0, -h, w, h);
  ctx.restore();
}

// ---------------- Art slots ----------------
// art/manifest.json lists PNG files keyed by sprite slot (the same keys the code-drawn sprites use).
// A PNG that exists replaces the generated sprite; everything else stays code-drawn.
export const ART = { loaded: false, images: new Map(), version: 0 };
export async function loadArt() {
  try {
    const res = await fetch('art/manifest.json', { cache: 'no-store' });
    if (!res.ok) { ART.loaded = true; return 0; }
    const man = await res.json();
    const entries = Object.entries(man.sprites || {});
    await Promise.all(entries.map(([key, file]) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => { ART.images.set(key, img); ok(); };
      img.onerror = () => { console.warn('art slot: could not load', file); ok(); };
      img.src = 'art/' + file;
    })));
    ART.version++;
  } catch { /* no art folder: all sprites are code-drawn */ }
  ART.loaded = true;
  return ART.images.size;
}
// A hand-drawn replacement for a slot, as a canvas of exactly w×h (scaled by whole steps if
// the PNG was drawn at 2× or 3×), or null.
const ARTC = new Map();
export function artFor(key, w, h) {
  const img = ART.images.get(key);
  if (!img) return null;
  let c = ARTC.get(key);
  if (c && c.width === w && c.height === h) return c;
  c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0, w, h);
  c._art = true;
  ARTC.set(key, c);
  return c;
}
// Every slot the game asks for is recorded, so the exporter can list them all for an artist
export const SLOT_LOG = new Map();
export function noteSlot(key, w, h, kind) { if (!SLOT_LOG.has(key)) SLOT_LOG.set(key, { w, h, kind }); }
// Record a generated sprite as a slot and return the hand-drawn PNG for it if there is one
export function slot(key, c, kind = 'sprite') { noteSlot(key, c.width, c.height, kind); const e = SLOT_LOG.get(key); if (!e.canvas) e.canvas = c; return artFor(key, c.width, c.height) || c; }

// ---------------- Snow on roofs ----------------
// A winter copy of a sprite: the top two pixels under the outline of every column turn to snow.
const SNOW = new WeakMap();
export function snowCap(img) {
  let c = SNOW.get(img);
  if (c) return c;
  c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height;
  for (let px = 0; px < W; px++) {
    let y0 = -1;
    for (let py = 0; py < H; py++) if (d.data[(py * W + px) * 4 + 3] > 200) { y0 = py; break; }
    if (y0 < 0 || y0 > H * 0.6) continue;
    for (let k = 1; k <= 2; k++) {
      const o = ((y0 + k) * W + px) * 4;
      if (y0 + k >= H || d.data[o + 3] < 200) break;
      const sh = k === 2 || px > W * 0.55;
      d.data[o] = sh ? 200 : 242; d.data[o + 1] = sh ? 214 : 247; d.data[o + 2] = sh ? 236 : 252;
    }
  }
  x.putImageData(d, 0, 0);
  SNOW.set(img, c);
  return c;
}
