// Interface art: icon_<name> (16×16), ui_frames (24×24 nine-slice frames, 8 px corners, one tag
// per frame: panel, modal, parch, btn, btn_hover, btn_down, btn_gold, inset, god, tip, btn_wood,
// carved), cursor (32×32), ui_wood / ui_wood_dark (64×32 tiling planks), ui_paper (64×64).
// Flat colours, a dark outline, rounded corners and a soft bevel, as in art/STYLE.md.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------- icons (16×16) ----------------
const ICON = {
  food(g) { // wheat sheaf and a loaf
    for (const [x, t] of [[5, 2], [8, 1], [11, 2]]) { g.line(x, t + 4, 8, 11, R.straw[1]); for (let y = t; y < t + 5; y++) g.p(x - 1 + (y % 2), y, R.gold[2]).p(x + (y % 2), y, R.gold[3]); }
    g.r(6, 9, 5, 1, R.red[2]);
    g.ellipse(8, 13, 5, 2, R.ochre[2]); g.r(5, 12, 6, 1, R.ochre[3]).p(6, 13, R.ochre[1]).p(9, 13, R.ochre[1]);
  },
  wood(g) {
    for (const [x, y] of [[2, 9], [8, 9], [5, 4]]) { g.r(x, y, 7, 5, R.wood[2]).r(x, y, 7, 1, R.wood[3]).r(x, y + 4, 7, 1, R.wood[1]); g.ellipse(x + 6, y + 2, 1.5, 2, R.straw[3]); g.p(x + 6, y + 2, R.wood[2]); }
  },
  stone(g) {
    g.ellipse(6, 10, 5, 4, R.stone[2]); g.ellipse(11, 11, 4, 3, R.stone[1]); g.ellipse(8, 6, 4, 3, R.stone[3]);
    g.p(6, 5, R.stone[4]).p(7, 5, R.stone[4]).p(3, 9, R.stone[3]).line(9, 11, 12, 12, R.stone[0]);
  },
  iron(g) {
    for (const [x, y, c] of [[2, 9, R.steel], [8, 9, R.steel], [5, 5, R.steel]]) { g.r(x + 1, y, 5, 4, c[2]).r(x, y + 1, 7, 3, c[2]).r(x + 1, y, 5, 1, c[4]).r(x, y + 3, 7, 1, c[1]); }
  },
  gold(g) {
    for (const [x, y] of [[3, 10], [3, 8], [3, 6], [9, 10], [9, 8]]) { g.r(x, y, 5, 2, R.gold[2]).r(x, y, 5, 1, R.gold[3]).p(x + 4, y + 1, R.gold[1]); }
    g.ellipse(11, 4, 3, 3, R.gold[2]); g.p(10, 3, R.gold[4] || R.gold[3]).p(11, 4, R.gold[1]);
  },
  knowledge(g) { // open book
    g.r(2, 4, 6, 9, R.cream[3]).r(8, 4, 6, 9, R.cream[2]).r(7, 4, 2, 10, R.blue[1]);
    for (let y = 6; y < 12; y += 2) g.r(3, y, 4, 1, R.stone[2]).r(9, y, 4, 1, R.stone[2]);
    g.r(1, 12, 14, 2, R.blue[2]).r(1, 12, 14, 1, R.blue[3]);
  },
  pop(g) {
    g.ellipse(5, 5, 2, 2, R.skinHuman[2]); g.r(3, 8, 5, 6, R.blue[2]).r(3, 8, 1, 6, R.blue[3]);
    g.ellipse(11, 5, 2, 2, R.skinHalfling[2]); g.r(9, 8, 5, 6, R.red[2]).r(9, 8, 1, 6, R.red[3]);
    g.p(5, 3, R.hairBrown[2]).p(4, 3, R.hairBrown[2]).p(11, 3, R.hairGinger[2]).p(10, 3, R.hairGinger[2]);
  },
  stability(g) { // crown
    g.r(2, 7, 12, 5, R.gold[2]).r(2, 11, 12, 2, R.gold[1]);
    for (const x of [2, 7, 13]) g.r(x - (x === 7 ? 0 : 0), 3 + (x === 7 ? 0 : 1), x === 7 ? 2 : 1, 4, R.gold[2]).p(x, 2 + (x === 7 ? 0 : 1), R.gold[3]);
    g.r(2, 7, 12, 1, R.gold[3]).p(5, 9, R.red[2]).p(8, 9, R.blue[3]).p(11, 9, R.red[2]);
  },
  defense(g) { // shield
    for (let y = 2; y < 14; y++) { const hw = y < 9 ? 6 : 6 - (y - 8); g.r(8 - hw, y, hw, 1, R.steel[3]).r(8, y, hw, 1, R.steel[2]); }
    for (let y = 4; y < 12; y++) { const hw = y < 9 ? 3 : 3 - (y - 9); if (hw > 0) g.r(8 - hw, y, hw * 2, 1, R.red[2]); }
    g.r(7, 4, 2, 8, R.gold[3]).r(5, 6, 6, 2, R.gold[3]);
  },
  housing(g) {
    for (let i = 0; i < 6; i++) g.r(8 - i - 2, 2 + i, (i + 2) * 2, 1, i < 2 ? R.red[3] : R.red[2]);
    g.r(3, 8, 10, 6, R.cream[2]).r(3, 8, 1, 6, R.cream[3]).r(12, 8, 1, 6, R.cream[1]);
    g.r(7, 10, 2, 4, R.wood[1]).r(4, 9, 2, 2, R.fire[3]).r(10, 9, 2, 2, R.fire[3]);
  },
};
function icon(name) { const g = new Pix(16, 16); ICON[name](g); g.outline(INK); return g; }

// ---------------- nine-slice frames (24×24, 8 px corners) ----------------
// o outline, t/l lit rim, b/r shaded rim, a accent rule, f fill, s stud
function frame({ o = INK, lit, shade, fill, accent, studs, pressed = false, raised = false, inset = false }) {
  const g = new Pix(24, 24);
  g.r(0, 0, 24, 24, o);
  for (const [x, y] of [[0, 0], [23, 0], [0, 23], [23, 23]]) g.clear(x, y);           // rounded corners
  if (inset) { g.r(1, 1, 22, 22, fill).r(1, 1, 22, 2, shade).r(1, 1, 2, 22, shade).r(1, 21, 22, 2, lit).r(21, 1, 2, 22, lit); return g; }
  g.r(1, 1, 22, 22, raised || pressed ? fill : lit);
  if (raised) { g.r(1, 1, 22, 1, lit).r(1, 1, 1, 21, lit).r(1, 20, 22, 3, shade).r(22, 1, 1, 22, shade).r(2, 19, 20, 1, shade); g.p(2, 2, lit); return g; }
  if (pressed) { g.r(1, 1, 22, 2, shade).r(1, 1, 1, 22, shade).r(1, 22, 22, 1, lit); return g; }
  g.r(3, 3, 18, 18, shade);                                                              // frame band: lit outer, shaded inner
  g.r(1, 21, 22, 2, shade).r(21, 1, 2, 22, shade);
  if (accent) g.r(4, 4, 16, 16, accent).r(4, 19, 16, 1, accent);
  g.r(5, 5, 14, 14, fill);
  if (accent) g.r(5, 5, 14, 1, shade).r(5, 5, 1, 14, shade);
  if (studs) for (const [x, y] of [[2, 2], [20, 2], [2, 20], [20, 20]]) g.r(x, y, 2, 2, studs[2]).p(x, y, studs[3]).p(x + 1, y + 1, studs[1]);
  return g;
}
const WOODF = { lit: '#8e5a2e', shade: '#3e2616', fill: '#2a1c12', accent: '#a8782e', studs: R.gold };
export const FRAMES = {
  panel: { ...WOODF },
  modal: { ...WOODF, lit: '#a06a36', accent: R.gold[2] },
  parch: { o: '#4a2e14', lit: R.cream[3], shade: '#c8aa78', fill: '#ecdcb4', accent: '#a8864e' },
  btn: { raised: true, lit: '#9a7a48', fill: '#5a4426', shade: '#2e2010' },
  btn_hover: { raised: true, lit: '#c8a060', fill: '#6e5430', shade: '#3a2814' },
  btn_down: { pressed: true, lit: '#7a6040', fill: '#4a371f', shade: '#22180c' },
  btn_gold: { raised: true, o: '#3a2006', lit: R.gold[3], fill: R.gold[2], shade: R.gold[1] },
  inset: { inset: true, o: '#0c0806', lit: '#3a2e20', shade: '#060403', fill: '#16100b' },
  god: { o: '#0c0806', lit: '#7a62a8', shade: '#1a1226', fill: '#261a33', accent: '#a88ad8' },
  tip: { o: '#4a2e14', lit: R.cream[3], shade: '#c8aa78', fill: '#ecdcb4' },
  btn_wood: { raised: true, o: '#140a04', lit: '#c08a52', fill: '#8a5a32', shade: '#4a2e18' },
  carved: { ...WOODF, fill: '#00000000' },
};

// ---------------- cursor (32×32) ----------------
function cursor() {
  const g = new Pix(32, 32);
  for (let y = 0; y < 22; y++) { const w = Math.min(y, 14 - Math.max(0, y - 14) * 2); if (w > 0) g.r(1, 1 + y, w, 1, y < 4 ? R.white[3] : R.cream[3]); }
  g.r(1, 1, 2, 20, R.white[3]);
  g.line(6, 20, 10, 28, R.gold[2]).line(7, 20, 11, 28, R.gold[2]).line(8, 19, 12, 27, R.gold[3]);
  g.over((x, y) => x > 3 && y > 6 && x + 1 < y * 0.8, R.gold[2]);
  g.outline(INK);
  return g;
}

// ---------------- textures ----------------
function planks(base) {
  const g = new Pix(64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const plank = y >> 3, row = y & 7;
    const grain = Math.sin((x + plank * 17) * 0.21 + Math.sin(y * 0.9 + plank) * 1.3);
    let c = base[2];
    if (grain > 0.75) c = base[3]; else if (grain < -0.85) c = base[1];
    if (row === 0) c = base[3];
    if (row === 7) c = base[0];
    if (((x + plank * 23) % 32) === 0 && row > 0 && row < 7) c = base[0];                // plank ends
    if (rnd(x >> 1, y, plank) < 0.03 && row > 1 && row < 6) c = base[1];
    g.p(x, y, c);
  }
  return g;
}
function paper() {
  const g = new Pix(64, 64);
  const r = ['#c8aa78', '#dcc496', '#ecdcb4', '#f6ead0'];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const st = (rnd(x >> 3, y >> 3, 411) + rnd(x >> 2, y >> 2, 412)) * 0.5, n = rnd(x, y, 413);
    g.p(x, y, n < 0.03 ? r[1] : st > 0.82 ? r[1] : n > 0.985 ? r[3] : r[2]);
  }
  return g;
}

export const ICON_NAMES = Object.keys(ICON);
export const UI = {};
for (const n of ICON_NAMES) UI['icon_' + n] = () => ({ frames: [icon(n)], tags: [] });
UI.ui_frames = () => { const names = Object.keys(FRAMES); return { frames: names.map((n) => frame(FRAMES[n])), tags: names.map((n, i) => [n, i, i, 1000]), cols: 12 }; };
UI.cursor = () => ({ frames: [cursor()], tags: [] });
UI.ui_wood = () => ({ frames: [planks(['#2a1c10', '#3a2a1a', '#4a3622', '#5e4630'])], tags: [] });
UI.ui_wood_dark = () => ({ frames: [planks(['#1a120a', '#261a10', '#322216', '#40301e'])], tags: [] });
UI.ui_paper = () => ({ frames: [paper()], tags: [] });
