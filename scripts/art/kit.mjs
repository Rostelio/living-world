// Building parts for the generated art: shaded walls, shingle roofs, doors, windows, chimneys,
// domes, cones, banners. Front view with the light from the top-left, as in art/STYLE.md.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

// Banners and flags are drawn in these key colours; the game swaps them for the realm's colour.
export const KEY = ['#5a005a', '#a000a0', '#e600e6', '#ff70ff'];

export function wall(g, x, y, w, h, ramp, style = 'plain', beam = R.wood[0]) {
  g.r(x, y, w, h, ramp[2]);
  if (style === 'stone' || style === 'brick') {
    for (let yy = y; yy < y + h; yy++) {
      const row = yy - y;
      if (row % 3 === 2) { g.r(x, yy, w, 1, ramp[1]); continue; }
      const off = Math.floor(row / 3) % 2 ? 2 : 0;
      for (let xx = x + off; xx < x + w; xx += 5) g.p(xx, yy, ramp[1]);
      if (row % 3 === 0) for (let xx = x + off + 1; xx < x + w; xx += 5) g.p(xx, yy, ramp[3]);
    }
  }
  if (style === 'planks') for (let xx = x + 2; xx < x + w; xx += 3) g.r(xx, y, 1, h, ramp[1]);
  if (style === 'logs') for (let yy = y + 1; yy < y + h; yy += 2) g.r(x, yy, w, 1, ramp[1]);
  g.r(x, y, 1, h, ramp[3]);
  g.r(x + w - 1, y, 1, h, ramp[1]);
  if (style === 'timber') {
    g.r(x, y, w, 1, beam).r(x, y + h - 1, w, 1, beam).r(x, y + Math.floor(h / 2), w, 1, beam);
    for (let xx = x; xx < x + w; xx += 6) g.r(xx, y, 1, h, beam);
    g.r(x + w - 1, y, 1, h, beam);
  }
  g.r(x, y + h - 1, w, 1, ramp[0] || ramp[1]);
  return g;
}

// roof seen from the front: a trapezoid of shingle rows, ridge on top, eaves at the bottom
export function roof(g, x, y, w, h, ramp, { inset = Math.min(4, Math.floor(h / 2)), style = 'shingle' } = {}) {
  for (let i = 0; i < h; i++) {
    const ins = Math.round(inset * (1 - i / Math.max(1, h - 1)));
    const x0 = x + ins, x1 = x + w - 1 - ins;
    const band = Math.floor((i - 1) / 2), bandRow = (i - 1) % 2;
    let c = i === 0 ? ramp[3] : i === h - 1 ? ramp[0] : bandRow === 1 ? ramp[1] : ramp[2];
    if (i > 0 && i < h - 1 && i < h / 3 && bandRow === 0) c = ramp[3];
    g.r(x0, y + i, x1 - x0 + 1, 1, c);
    if (style === 'shingle' && i > 0 && i < h - 1 && bandRow === 0) for (let xx = x0 + (band % 2 ? 1 : 3); xx < x1; xx += 4) g.p(xx, y + i, ramp[1]);
    if (style === 'thatch' && i > 0 && i < h - 1) for (let xx = x0 + ((i * 3) % 4); xx < x1; xx += 4) g.p(xx, y + i, i % 2 ? ramp[1] : ramp[3]);
    g.p(x0, y + i, i === h - 1 ? ramp[0] : ramp[3]); g.p(x1, y + i, ramp[1]);
  }
  if (style === 'thatch') for (let xx = x + 1; xx < x + w - 1; xx += 2) g.p(xx, y + h, ramp[1]);   // ragged eaves
  return g;
}
// a triangle (gable end, tent, A-frame) with apex at (cx, y)
export function tri(g, cx, y, h, half, ramp, { seams = true } = {}) {
  for (let i = 0; i < h; i++) {
    const hw = Math.round(((i + 1) / h) * half);
    g.r(cx - hw, y + i, hw, 1, ramp[3]).r(cx, y + i, hw, 1, ramp[2]);
    if (seams && i % 3 === 2) { g.r(cx - hw, y + i, hw, 1, ramp[2]).r(cx, y + i, hw, 1, ramp[1]); }
    g.p(cx + hw - 1, y + i, ramp[1]);
  }
  return g;
}
export function dome(g, cx, cy, rx, ry, ramp, { clipBottom = cy } = {}) {
  for (let y = Math.floor(cy - ry); y <= clipBottom; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x - cx) / (rx + 0.3), ny = (y - cy) / (ry + 0.3);
    if (nx * nx + ny * ny > 1) continue;
    const lit = nx * -0.6 + ny * -0.8;
    g.p(x, y, lit > 0.55 ? ramp[3] : lit > -0.1 ? ramp[2] : ramp[1]);
  }
  return g;
}
export function cone(g, cx, top, h, half, ramp) {
  for (let i = 0; i < h; i++) {
    const hw = Math.max(1, Math.round(((i + 1) / h) * half));
    g.r(cx - hw, top + i, hw, 1, i % 3 === 2 ? ramp[2] : ramp[3]).r(cx, top + i, hw, 1, i % 3 === 2 ? ramp[0] : ramp[1]);
  }
  return g;
}
export function door(g, x, y, w, h, ramp = R.wood, { arch = true, knob = R.gold[2] } = {}) {
  g.r(x - 1, y - 1, w + 2, h + 1, ramp[0]);
  g.r(x, y, w, h, ramp[2]);
  for (let xx = x + 1; xx < x + w; xx += 2) g.r(xx, y, 1, h, ramp[1]);
  g.r(x, y, 1, h, ramp[3]);
  if (arch) { g.p(x - 1, y - 1, null); g.clear(x - 1, y - 1).clear(x + w, y - 1); g.p(x, y, ramp[0]).p(x + w - 1, y, ramp[0]); }
  if (knob) g.p(x + w - 2, y + Math.floor(h / 2), knob);
  return g;
}
export function win(g, x, y, w = 4, h = 4, lit = false, frame = R.wood[1]) {
  g.r(x - 1, y - 1, w + 2, h + 2, frame);
  g.r(x, y, w, h, lit ? R.fire[3] : R.water[3]);
  if (!lit) g.p(x, y, R.water[4]).p(x + 1, y, R.water[4]);
  else g.r(x, y, w, 1, R.fire[4]);
  if (w >= 3) g.r(x + Math.floor(w / 2), y, 1, h, frame);
  if (h >= 4) g.r(x, y + Math.floor(h / 2), w, 1, frame);
  g.r(x - 1, y + h, w + 2, 1, R.wood[2]);
  return g;
}
export function chimney(g, x, y, h = 6) {
  g.r(x, y, 3, h, R.stone[2]).r(x, y, 1, h, R.stone[3]).r(x + 2, y, 1, h, R.stone[1]).r(x - 1, y, 5, 1, R.stone[3]).p(x + 1, y + 2, R.stone[1]);
  return g;
}
export function banner(g, x, y, h = 6, w = 4, K = KEY) {
  g.r(x, y - 1, 1, h + 5, R.wood[0]).p(x, y - 2, R.gold[3]);
  g.r(x + 1, y, w, h, K[2]).r(x + 1, y, w, 1, K[3]).r(x + w, y, 1, h, K[1]);
  g.p(x + 1, y + h, K[2]).p(x + w, y + h, K[1]);
  g.p(x + 1 + Math.floor(w / 2), y + 2, R.gold[3]);
  return g;
}
export function flowers(g, x, y, w) {
  g.r(x, y, w, 2, R.leaf[2]).r(x, y, w, 1, R.leaf[3]);
  const cols = [R.pink[2], R.gold[3], R.red[3], R.purple[3], R.white[3]];
  for (let i = 0; i < w; i += 2) g.p(x + i, y - 1 + (i % 4 ? 1 : 0), cols[(x + i) % cols.length]);
  return g;
}
// finish: ink outline, then a soft ground shadow under the building
export function finish(g, cx, cy, rx, ry = 2) {
  g.outline(INK);
  const sh = new Pix(g.w, g.h);
  sh.ellipse(cx, cy, rx, ry, '#241a2450');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!g.alpha(x, y) && sh.alpha(x, y)) g.p(x, y, '#241a2450');
  return g;
}
export const blank = (w = 32, h = 32) => new Pix(w, h);
