// Sprites drawn in Aseprite. Each sprite is a pair in assets/sprites/:
//   <id>.png   the sheet
//   <id>.json  Aseprite export, "Array" format, with tags (meta.frameTags) and frame durations
// A sprite that has no files is simply missing: the game draws the old code-drawn version
// instead (src/legacy-draw.js). Rendering only — nothing here touches the simulation.
//
// Export from Aseprite:  File ▸ Export Sprite Sheet ▸ Output: JSON Data, "Array", Meta: Tags
//   (trim is fine: spriteSourceSize is respected), or from the command line:
//   aseprite -b townsfolk_humans.aseprite --sheet townsfolk_humans.png --data townsfolk_humans.json \
//            --format json-array --list-tags --trim
import { SPRITE_IDS, configFor, ART_SCALE } from './sprite-config.js';

export const SPRITES = {
  base: 'assets/sprites/',
  sheets: new Map(), // id -> Sheet
  loaded: false,
  debug: false, // F2: outlines, anchors and hitboxes
  marks: [], // what was drawn this frame, for the debug overlay
};

// ---------------- Loading ----------------
class Sheet {
  constructor(id, img, data) {
    this.id = id;
    this.img = img;
    this.cfg = configFor(id);
    const frames = Array.isArray(data.frames) ? data.frames : Object.values(data.frames || {}); // tolerate the "Hash" export too
    this.frames = frames.map((f) => ({
      x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h,
      // where the trimmed piece sits inside the untrimmed frame
      ox: f.spriteSourceSize?.x || 0, oy: f.spriteSourceSize?.y || 0,
      sw: f.sourceSize?.w ?? f.frame.w, sh: f.sourceSize?.h ?? f.frame.h,
      ms: f.duration || 100,
    }));
    this.tags = new Map();
    for (const t of data.meta?.frameTags || []) {
      this.tags.set(t.name, { from: t.from, to: t.to, dir: t.direction || 'forward', repeat: Number(t.repeat) || 0 });
    }
    // the untrimmed frame size (every frame of one sprite shares it)
    this.w = this.frames[0]?.sw || img.width;
    this.h = this.frames[0]?.sh || img.height;
  }
  // Frame indices of a tag, in play order for one pass
  order(tag) {
    const t = this.tags.get(tag);
    if (!t) return null;
    const up = []; for (let i = t.from; i <= t.to; i++) up.push(i);
    const down = up.slice().reverse();
    switch (t.dir) {
      case 'reverse': return down;
      case 'pingpong': return up.length > 1 ? up.concat(down.slice(1, -1)) : up;
      case 'pingpong_reverse': return down.length > 1 ? down.concat(up.slice(1, -1)) : down;
      default: return up;
    }
  }
}

function loadImage(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}
async function loadOne(id) {
  try {
    const res = await fetch(SPRITES.base + id + '.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const img = await loadImage(SPRITES.base + (data.meta?.image ? data.meta.image.split(/[\\/]/).pop() : id + '.png'));
    if (!img) { console.warn(`sprite ${id}: the PNG is missing — using the code-drawn version`); return null; }
    const sh = new Sheet(id, img, data);
    if (!sh.frames.length) return null;
    SPRITES.sheets.set(id, sh);
    return sh;
  } catch {
    return null; // no file: fall back quietly
  }
}
// Load every sprite before the game starts. assets/sprites/index.json (a list of ids) is used when
// it exists; otherwise every id from sprite-config.js is tried. Missing files are not errors.
export async function preloadSprites(ids = null) {
  let list = ids;
  if (!list) {
    try {
      const res = await fetch(SPRITES.base + 'index.json', { cache: 'no-store' });
      if (res.ok) { const j = await res.json(); list = Array.isArray(j) ? j : j.sprites; }
    } catch { /* no index: try them all */ }
  }
  list ||= SPRITE_IDS;
  await Promise.all([...new Set(list)].map(loadOne));
  SPRITES.loaded = true;
  return SPRITES.sheets.size;
}
export const hasSprite = (id) => SPRITES.sheets.has(id);
export const sheetOf = (id) => SPRITES.sheets.get(id) || null;

// ---------------- Animator ----------------
// play(tag) starts a tag (no restart if it is already playing), update(dt) advances it by dt
// SECONDS (the game's own unit) using each frame's duration in ms from the JSON.
// loop: true (default) repeats forever; false plays once, holds the last frame and calls onEnd.
// A tag with Aseprite's "Repeat" field set plays that many times unless loop is given.
export class Animator {
  constructor(id) {
    this.id = id;
    this.tag = null;
    this.seq = null;
    this.i = 0; // position in seq
    this.t = 0; // ms spent on the current frame
    this.loop = true;
    this.passes = Infinity;
    this.done = false;
    this.onEnd = null;
  }
  get sheet() { return SPRITES.sheets.get(this.id) || null; }
  play(tag, { loop, onEnd = null, restart = false } = {}) {
    if (!restart && tag === this.tag && !this.done) return this;
    const sh = this.sheet;
    this.tag = tag;
    this.i = 0; this.t = 0; this.done = false; this.onEnd = onEnd;
    this.seq = sh ? sh.order(tag) || sh.frames.map((_, k) => k) : null;
    const rep = sh?.tags.get(tag)?.repeat || 0;
    this.passes = loop === true ? Infinity : loop === false ? 1 : rep > 0 ? rep : Infinity;
    this.left = this.passes;
    return this;
  }
  update(dt) {
    const sh = this.sheet;
    if (!sh || this.done) return this;
    if (!this.seq) this.seq = sh.order(this.tag) || sh.frames.map((_, k) => k);
    this.t += dt * 1000;
    let guard = 64;
    while (guard-- > 0) {
      const ms = sh.frames[this.seq[this.i]]?.ms || 100;
      if (this.t < ms) break;
      this.t -= ms;
      if (this.i + 1 < this.seq.length) { this.i++; continue; }
      if (--this.left > 0) { this.i = 0; continue; }
      this.done = true; this.t = 0;
      const cb = this.onEnd; this.onEnd = null;
      if (cb) cb(this);
      break;
    }
    return this;
  }
  get frame() { return this.seq ? this.seq[this.i] ?? 0 : 0; }
}

// One animator per thing on screen, kept beside it (never written into game objects)
const ANIMS = new WeakMap();
export function animFor(owner, id) {
  let byId = ANIMS.get(owner);
  if (!byId) { byId = new Map(); ANIMS.set(owner, byId); }
  let a = byId.get(id);
  if (!a) { a = new Animator(id); byId.set(id, a); }
  return a;
}
// play(tag) + update(dt) for a thing's own animator in one call; returns the frame index
export function animate(owner, id, tag, dt) {
  const a = animFor(owner, id).play(tag);
  a.update(Math.max(0, Math.min(0.25, dt || 0)));
  return a.frame;
}
// A looping tag's frame at a given clock time, for things that have no animator of their own
export function frameAt(id, tag, seconds) {
  const sh = SPRITES.sheets.get(id);
  if (!sh) return -1;
  const seq = sh.order(tag) || sh.frames.map((_, k) => k);
  let total = 0; for (const f of seq) total += sh.frames[f].ms;
  let t = ((seconds * 1000) % total + total) % total;
  for (const f of seq) { if (t < sh.frames[f].ms) return f; t -= sh.frames[f].ms; }
  return seq[0];
}
// The first tag of a list that the sprite has (e.g. ['farmer_walk', 'walk'])
export function pickTag(id, tags) {
  const sh = SPRITES.sheets.get(id);
  if (!sh) return null;
  for (const t of tags) if (t && sh.tags.has(t)) return t;
  return null;
}

// ---------------- Drawing ----------------
// draw(ctx, id, x, y, opts) puts the sprite's anchor at (x, y) in the current units.
// opts: frame (index) | anim (Animator) | tag (first frame of it); flipX; scale = units per art
// pixel (1 on screen, 0.5 on the map where 2 art px make a world px).
// Anchor: bottom-centre for characters, top-left for tiles (sprite-config.js), plus offsets.
// Returns false when the sprite does not exist, so the caller draws the old version instead.
export function draw(ctx, id, x, y, opts = {}) {
  const sh = SPRITES.sheets.get(id);
  if (!sh) return false;
  let fi = opts.frame;
  if (fi == null && opts.anim) fi = opts.anim.frame;
  if (fi == null && opts.tag) fi = sh.tags.get(opts.tag)?.from ?? 0;
  const f = sh.frames[fi ?? 0] || sh.frames[0];
  const s = opts.scale || 1;
  const cfg = sh.cfg;
  // anchor inside the untrimmed frame, in art pixels (whole pixels only)
  const axA = cfg.anchor === 'top-left' ? 0 : Math.floor(f.sw / 2);
  const ayA = cfg.anchor === 'top-left' ? 0 : f.sh;
  // the anchor point on screen, snapped to the art-pixel grid
  const ax = Math.round(x / s) * s, ay = Math.round(y / s) * s;
  const left = ax + (f.ox - axA - (cfg.ox || 0)) * s;
  const top = ay + (f.oy - ayA - (cfg.oy || 0)) * s;
  // whole pixels when an art pixel covers one or more screen pixels; when it covers less (far
  // zoom), average instead of dropping pixels
  const m = ctx.getTransform();
  ctx.imageSmoothingEnabled = Math.hypot(m.a, m.b) * s < 0.99;
  if (opts.flipX) {
    ctx.save();
    ctx.translate(ax * 2, 0); ctx.scale(-1, 1);
    ctx.drawImage(sh.img, f.x, f.y, f.w, f.h, left, top, f.w * s, f.h * s);
    ctx.restore();
  } else ctx.drawImage(sh.img, f.x, f.y, f.w, f.h, left, top, f.w * s, f.h * s);
  ctx.imageSmoothingEnabled = false;
  if (SPRITES.debug) mark(ctx, ax + (-axA - (cfg.ox || 0)) * s, ay + (-ayA - (cfg.oy || 0)) * s, f.sw * s, f.sh * s, ax, ay, true);
  return true;
}

// The frame as a stand-alone canvas of the untrimmed size — for code that takes ready-made
// canvases (buildings, trees, icons). Returns null when the sprite is missing, or when its size
// differs from the slot it would fill (want = [w, h]): then the old version stays.
const FRAMEC = new Map();
const WARNED = new Set();
export function frameCanvas(id, fi = 0, want = null) {
  const sh = SPRITES.sheets.get(id);
  if (!sh) return null;
  const f = sh.frames[fi] || sh.frames[0];
  if (want && (f.sw !== want[0] || f.sh !== want[1])) {
    if (!WARNED.has(id)) { WARNED.add(id); console.warn(`sprite ${id}: frames are ${f.sw}×${f.sh}, this slot needs ${want[0]}×${want[1]} — using the code-drawn version`); }
    return null;
  }
  const key = id + '#' + fi;
  let c = FRAMEC.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = f.sw; c.height = f.sh;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(sh.img, f.x, f.y, f.w, f.h, f.ox, f.oy, f.w, f.h);
  c._art = true;
  FRAMEC.set(key, c);
  return c;
}
// Frame k of a tag (or frame k of the sheet when the tag is missing)
export function tagFrame(id, tag, k = 0) {
  const sh = SPRITES.sheets.get(id);
  if (!sh) return -1;
  const t = tag && sh.tags.get(tag);
  if (t) return t.from + (((k % (t.to - t.from + 1)) + (t.to - t.from + 1)) % (t.to - t.from + 1));
  return ((k % sh.frames.length) + sh.frames.length) % sh.frames.length;
}
// For the sprite factories: the Aseprite frame (tag, k) when the sprite exists and is exactly
// twice the size of the code-drawn canvas it replaces (ART_SCALE); otherwise that canvas.
export function fromSheet(id, tag, k, legacy) {
  if (!SPRITES.sheets.has(id)) return legacy;
  const fi = tagFrame(id, tag, k);
  return (fi >= 0 && frameCanvas(id, fi, [legacy.width * ART_SCALE, legacy.height * ART_SCALE])) || legacy;
}
// Is any sprite whose id starts with one of these prefixes loaded?
export const anySheet = (...prefixes) => [...SPRITES.sheets.keys()].some((id) => prefixes.some((p) => id.startsWith(p)));

// ---------------- Pixel-crisp canvases ----------------
// Call after every canvas resize: resizing a canvas resets its context, smoothing included.
export function crisp(ctx) {
  ctx.imageSmoothingEnabled = false;
  if (ctx.canvas?.style) ctx.canvas.style.imageRendering = 'pixelated';
  return ctx;
}
// The largest whole-number scale at which w×h fits into W×H (never below 1)
export const intScale = (W, H, w, h) => Math.max(1, Math.floor(Math.min(W / w, H / h)));

// ---------------- Debug overlay (F2) ----------------
// Every sprite (and every code-drawn stand-in at a hooked spot) records its box and anchor in
// device pixels; the renderer draws them, with the click hitboxes, at the end of the frame.
export function mark(ctx, x, y, w, h, ax, ay, art = false) {
  if (!SPRITES.debug) return;
  const m = ctx.getTransform();
  const P = (px, py) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f];
  const [x0, y0] = P(x, y), [x1, y1] = P(x + w, y + h), [px, py] = P(ax, ay);
  SPRITES.marks.push({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), ax: px, ay: py, art });
}
export function beginFrame() { SPRITES.marks.length = 0; }
// hits: [{x, y, w, h}] click hitboxes in CSS pixels; dpr converts them to device pixels
export function drawDebug(ctx, hits = [], dpr = 1) {
  if (!SPRITES.debug) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const lw = Math.max(1, Math.round(dpr));
  ctx.lineWidth = lw;
  const o = lw / 2;
  let art = 0;
  for (const m of SPRITES.marks) {
    if (m.art) art++;
    ctx.strokeStyle = m.art ? 'rgba(80,255,120,0.9)' : 'rgba(255,200,60,0.75)';
    ctx.strokeRect(Math.round(m.x) + o, Math.round(m.y) + o, Math.max(1, Math.round(m.w) - lw), Math.max(1, Math.round(m.h) - lw));
    ctx.fillStyle = '#ff3a6a'; // the anchor: a small cross
    ctx.fillRect(Math.round(m.ax) - 3 * lw, Math.round(m.ay) - (lw >> 1), 7 * lw, lw);
    ctx.fillRect(Math.round(m.ax) - (lw >> 1), Math.round(m.ay) - 3 * lw, lw, 7 * lw);
  }
  ctx.strokeStyle = 'rgba(80,200,255,0.95)';
  for (const h of hits) ctx.strokeRect(Math.round(h.x * dpr) + o, Math.round(h.y * dpr) + o, Math.round(h.w * dpr) - lw, Math.round(h.h * dpr) - lw);
  // a caption at the bottom centre: green = Aseprite sprite, yellow = code-drawn, blue = click hitbox
  const text = `SPRITE DEBUG (F2) · sheets ${SPRITES.sheets.size} · drawn ${SPRITES.marks.length}: ${art} Aseprite (green), ${SPRITES.marks.length - art} code (yellow) · hitboxes ${hits.length} (blue) · anchors (pink)`;
  ctx.font = `${Math.round(11 * dpr)}px monospace`;
  const tw = ctx.measureText(text).width, cx = Math.round((ctx.canvas.width - tw) / 2), cy = ctx.canvas.height - Math.round(40 * dpr);
  ctx.fillStyle = 'rgba(10,8,20,0.8)';
  ctx.fillRect(cx - 8 * dpr, cy - 14 * dpr, tw + 16 * dpr, 20 * dpr);
  ctx.fillStyle = '#e8f0ff';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}
export function toggleDebug(on = !SPRITES.debug) { SPRITES.debug = on; SPRITES.marks.length = 0; return on; }
