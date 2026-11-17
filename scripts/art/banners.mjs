// Name ribbons, flag parts and Chronicle vignettes.
//   ribbon 10×12: tags normal and capital, 3 frames each (left end, middle, right end). The tails
//     are KEY colours (tinted with the realm colour); the band is parchment.
//   flag_parts 30×20: tags cloth (1 frame: folds and edge, drawn over the coloured flag) and emblem
//     (8 frames: white charges the game tints with the flag's third colour), in the order of
//     EMBLEMS in src/render/sprites.js: diamond, cross, disc, crown, tree, moon, skull, saltire.
//   vignette_<kind> 48×36: little pictures for the Chronicle, drawn like an illuminated manuscript.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';
import { KEY } from './kit.mjs';

const SEPIA = '#3a2614';
const PAPER = ['#b8a070', '#d4be8c', '#e8d6a8', '#f4e8c8'];

// ---------------- ribbon ----------------
function ribbonPart(part, capital) {
  const g = new Pix(10, 12);
  const band = capital ? ['#a8803a', '#e8c868', '#f4dc98', '#fff2c8'] : ['#a8864e', '#d4be8c', '#ead7a8', '#fbf0d4'];
  const edge = capital ? R.gold[1] : '#2c1c10';
  if (part === 1) {                                       // middle: tiles sideways
    g.r(0, 0, 10, 1, edge).r(0, 11, 10, 1, edge);
    g.r(0, 1, 10, 10, band[2]).r(0, 1, 10, 1, band[3]).r(0, 10, 10, 1, band[1]);
    if (capital) g.r(0, 2, 10, 1, R.gold[2]).r(0, 9, 10, 1, R.gold[2]);
    for (let x = 1; x < 10; x += 4) g.p(x, 6, band[1]);
    return g;
  }
  // an end: a forked tail at x 0..5 tucked behind, then the band's curled end at x 6..9
  for (let y = 2; y < 12; y++) for (let x = 0; x < 6; x++) {
    const notch = Math.abs(y - 7) < 2 && x < 2 - Math.abs(y - 7) + 1;
    if (notch) continue;
    g.p(x, y, y === 2 ? KEY[3] : y > 9 ? KEY[1] : x > 3 ? KEY[1] : KEY[2]);
  }
  g.r(4, 3, 2, 8, KEY[0]);                               // shadow where it folds behind
  g.r(6, 0, 4, 12, edge);
  g.r(7, 1, 3, 10, band[2]).r(7, 1, 3, 1, band[3]).r(7, 10, 3, 1, band[1]).r(7, 1, 1, 10, band[1]);
  if (capital) g.r(7, 2, 3, 1, R.gold[2]).r(7, 9, 3, 1, R.gold[2]);
  g.outline(INK);
  return part === 2 ? g.flip() : g;
}
export function ribbonSheet() {
  const frames = [], tags = [];
  for (const cap of [false, true]) { tags.push([cap ? 'capital' : 'normal', frames.length, frames.length + 2, 1000]); for (const p of [0, 1, 2]) frames.push(ribbonPart(p, cap)); }
  return { frames, tags, layer: 'ribbon' };
}

// ---------------- flag parts ----------------
function cloth() {
  const g = new Pix(30, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) {
    const w = Math.sin(x * 0.42 + 0.6);                     // folds running down the cloth
    if (w > 0.75) g.p(x, y, '#ffffff38'); else if (w < -0.7) g.p(x, y, '#00000040');
  }
  for (let x = 0; x < 30; x++) g.p(x, 0, '#ffffff50').p(x, 19, '#00000060');
  for (let y = 0; y < 20; y++) g.p(0, y, '#00000060').p(1, y, '#00000030');   // the hoist, by the pole
  return g;
}
const EMB = {
  diamond(g) { for (let i = 0; i < 6; i++) g.r(15 - i, 4 + i, i * 2, 1, '#ffffff').r(15 - i, 15 - i, i * 2, 1, '#d8d8e0'); },
  cross(g) { g.r(14, 3, 3, 14, '#ffffff').r(9, 8, 13, 3, '#ffffff').r(16, 3, 1, 14, '#d8d8e0').r(9, 10, 13, 1, '#d8d8e0'); },
  disc(g) { g.ellipse(15, 10, 5, 5, '#ffffff'); g.ellipse(16, 11, 3, 3, '#e8e8ee'); for (let a = 0; a < 8; a++) g.p(Math.round(15 + Math.cos(a * Math.PI / 4) * 7), Math.round(10 + Math.sin(a * Math.PI / 4) * 7), '#ffffff'); },
  crown(g) { g.r(9, 9, 13, 6, '#ffffff').r(9, 14, 13, 1, '#d8d8e0'); for (const x of [9, 14, 20]) g.r(x, 5 + (x === 14 ? -1 : 0), 2, 4 + (x === 14 ? 1 : 0), '#ffffff').p(x, 4 + (x === 14 ? -1 : 0), '#ffffff'); g.p(12, 11, '#c8c8d0').p(15, 11, '#c8c8d0').p(18, 11, '#c8c8d0'); },
  tree(g) { g.r(14, 13, 3, 5, '#d8d8e0'); for (const [y, hw] of [[3, 1], [5, 3], [7, 4], [9, 5], [11, 6]]) g.r(15 - hw, y, hw * 2 + 1, 2, '#ffffff'); g.r(9, 12, 13, 1, '#d8d8e0'); },
  moon(g) { g.ellipse(14, 10, 6, 6, '#ffffff'); for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) if ((x - 17) ** 2 + (y - 9) ** 2 < 25) g.clear(x, y); g.p(21, 5, '#ffffff').p(22, 13, '#ffffff'); },
  skull(g) { g.ellipse(15, 8, 5, 4, '#ffffff'); g.r(12, 11, 7, 3, '#ffffff'); g.clear(12, 8).clear(13, 8).clear(17, 8).clear(18, 8).clear(13, 13).clear(15, 13).clear(17, 13); g.line(8, 16, 22, 16, '#d8d8e0').line(8, 14, 22, 18, '#ffffff'); },
  saltire(g) { for (let i = 0; i < 12; i++) { g.r(9 + i, 4 + i, 2, 1, '#ffffff'); g.r(20 - i, 4 + i, 2, 1, i % 3 ? '#ffffff' : '#e0e0e8'); } },
};
export function flagSheet() {
  const names = Object.keys(EMB);
  const frames = [cloth(), ...names.map((n) => { const g = new Pix(30, 20); EMB[n](g); return g; })];
  return { frames, tags: [['cloth', 0, 0, 1000], ['emblem', 1, names.length, 1000]], layer: 'flag' };
}

// ---------------- Chronicle vignettes (48×36) ----------------
function page(sky = PAPER[3], ground = PAPER[1]) {
  const g = new Pix(48, 36);
  g.r(0, 0, 48, 36, sky);
  for (let y = 0; y < 26; y += 2) for (let x = (y / 2) % 2; x < 48; x += 4) if (y > 14) g.p(x, y, PAPER[2]);
  g.r(0, 26, 48, 10, ground);
  for (let x = 0; x < 48; x += 3) g.p(x, 26 + (x % 4), PAPER[0]);
  g.r(0, 26, 48, 1, PAPER[0]);
  return g;
}
function frameIt(g) {
  for (let x = 0; x < 48; x++) g.p(x, 0, SEPIA).p(x, 35, SEPIA).p(x, 1, '#c8a86a').p(x, 34, '#8a6a3a');
  for (let y = 0; y < 36; y++) g.p(0, y, SEPIA).p(47, y, SEPIA).p(1, y, '#c8a86a').p(46, y, '#8a6a3a');
  for (const [x, y] of [[2, 2], [44, 2], [2, 32], [44, 32]]) g.r(x, y, 2, 2, R.gold[2]).p(x, y, R.gold[3]);
  return g;
}
const sword = (g, x0, y0, x1, y1) => { g.line(x0, y0, x1, y1, R.steel[3]); g.line(x0 + 1, y0, x1 + 1, y1, R.steel[2]); };
const VIGS = {
  war(g) {
    sword(g, 12, 4, 33, 25); sword(g, 35, 4, 14, 25);
    g.r(30, 21, 6, 2, R.wood[2]).r(11, 21, 6, 2, R.wood[2]).r(32, 23, 2, 4, R.brown[1]).r(13, 23, 2, 4, R.brown[1]);
    g.r(22, 2, 4, 4, R.red[2]).p(22, 2, R.red[3]);
    for (const [x, y] of [[8, 8], [40, 9], [24, 28]]) g.p(x, y, R.fire[3]).p(x + 1, y + 1, R.fire[2]);
    g.outline(SEPIA);
  },
  crown(g) {
    g.r(11, 14, 26, 10, R.gold[2]).r(11, 14, 26, 2, R.gold[3]).r(11, 22, 26, 2, R.gold[1]);
    for (const [x, h] of [[11, 6], [18, 8], [23, 11], [29, 8], [35, 6]]) g.r(x, 14 - h, 2, h, R.gold[2]).p(x, 14 - h, R.gold[3]).ellipse(x + 1, 13 - h, 1.2, 1.2, R.gold[3]);
    g.r(16, 17, 3, 3, R.red[2]).r(23, 17, 3, 3, R.blue[2]).r(30, 17, 3, 3, R.red[2]).p(16, 17, R.pink[3]).p(23, 17, R.blue[3]).p(30, 17, R.pink[3]);
    g.r(9, 25, 30, 2, R.purple[1]).r(9, 25, 30, 1, R.purple[2]);
    g.outline(SEPIA);
  },
  death(g) {
    g.r(18, 8, 12, 18, R.stone[3]).ellipse(24, 8, 6, 5, R.stone[3]); g.r(29, 8, 1, 18, R.stone[1]).r(18, 8, 1, 18, R.stone[4]);
    g.r(23, 10, 2, 9, R.stone[1]).r(20, 12, 8, 2, R.stone[1]);
    g.r(12, 24, 24, 2, R.soil[2]);
    for (const x of [14, 33]) { g.r(x, 21, 1, 4, R.leaf[2]); g.p(x - 1, 20, R.white[3]).p(x + 1, 20, R.white[3]).p(x, 19, R.white[3]).p(x, 20, R.gold[3]); }
    g.outline(SEPIA);
    g.p(37, 5, R.cream[1]).p(38, 4, R.cream[1]).p(39, 5, R.cream[1]);
  },
  city(g) {
    const walls = [[5, 14, 10, 12, R.red], [16, 8, 14, 18, R.blue], [31, 12, 12, 14, R.red]];
    for (const [x, y, w, h, roof] of walls) {
      g.r(x, y, w, h, R.cream[2]).r(x, y, 2, h, R.cream[3]).r(x + w - 2, y, 2, h, R.cream[1]);
      for (let i = 0; i < 5; i++) g.r(x - 1 + (4 - i), y - 5 + i, w + 2 - (4 - i) * 2, 1, i < 2 ? roof[3] : roof[2]);
      g.r(x + 3, y + 3, 2, 3, R.water[3]).r(x + w - 5, y + 3, 2, 3, R.water[3]);
    }
    g.r(21, 18, 4, 8, R.wood[1]).r(22, 2, 2, 4, R.wood[0]).r(24, 2, 5, 3, R.red[2]);
    g.outline(SEPIA);
  },
  hero(g) {
    g.r(20, 12, 8, 9, R.blue[2]).r(20, 12, 2, 9, R.blue[3]).r(20, 17, 8, 1, R.wood[1]);
    g.ellipse(24, 8, 3.5, 3.5, R.skinHuman[2]); g.r(21, 4, 7, 2, R.steel[3]);
    g.r(20, 21, 3, 6, R.wood[1]).r(25, 21, 3, 6, R.wood[1]);
    g.r(30, 2, 2, 17, R.steel[3]).r(31, 2, 1, 17, R.steel[2]).r(27, 16, 8, 2, R.gold[2]).r(30, 18, 2, 3, R.wood[1]);
    g.r(14, 12, 6, 8, R.red[2]).r(14, 12, 6, 1, R.red[3]).p(16, 15, R.gold[3]);
    g.outline(SEPIA);
    for (const [x, y] of [[6, 5], [40, 7], [9, 16], [38, 18], [11, 3]]) g.p(x, y, R.gold[3]).p(x - 1, y, R.gold[2]).p(x + 1, y, R.gold[2]).p(x, y - 1, R.gold[2]).p(x, y + 1, R.gold[2]);
  },
  plague(g) {
    g.r(2, 2, 44, 24, '#d0d0a8');
    g.ellipse(24, 14, 8, 8, '#c8dca0'); g.r(20, 11, 3, 3, R.green[1]).r(26, 11, 3, 3, R.green[1]).r(22, 17, 5, 1, R.green[1]);
    g.outline(SEPIA);
    for (let i = 0; i < 12; i++) g.p(4 + ((i * 13) % 40), 3 + ((i * 7) % 20), i % 2 ? R.green[2] : '#8aa060');
    g.r(8, 22, 4, 6, R.ink[2]).ellipse(10, 21, 2, 2, R.ink[2]).line(12, 21, 15, 23, R.cream[2]);
  },
  ship(g) {
    g.r(2, 24, 44, 10, R.water[2]); for (let x = 3; x < 45; x += 6) g.r(x, 26 + (x % 3), 3, 1, R.water[4]);
    g.r(10, 20, 28, 5, R.wood[2]).r(10, 20, 28, 1, R.wood[3]).r(12, 25, 24, 1, R.wood[0]).r(36, 18, 4, 3, R.wood[2]);
    g.r(23, 3, 1, 17, R.wood[0]);
    for (let y = 4; y < 17; y++) { g.r(24, y, 9 - Math.abs(y - 10) * 0.4, 1, R.cream[3]); g.r(14 + Math.abs(y - 10) * 0.3, y + 1, 9 - Math.abs(y - 10) * 0.3, 1, R.cream[2]); }
    g.r(24, 1, 5, 3, R.red[2]);
    g.outline(SEPIA);
  },
  alliance(g) {
    g.r(8, 15, 14, 6, R.skinHuman[2]).r(26, 15, 14, 6, R.skinElf[2]);
    g.ellipse(24, 18, 5, 4, R.skinHuman[3]); g.r(20, 15, 2, 6, R.skinHuman[1]).r(26, 15, 2, 6, R.skinElf[1]);
    g.r(3, 13, 6, 10, R.blue[2]).r(3, 13, 6, 1, R.blue[3]).r(39, 13, 6, 10, R.red[2]).r(39, 13, 6, 1, R.red[3]);
    g.r(22, 6, 4, 4, R.gold[2]).p(22, 6, R.gold[3]);
    g.outline(SEPIA);
  },
  faith(g) {
    for (let a = 0; a < 12; a++) g.line(24, 13, Math.round(24 + Math.cos(a * Math.PI / 6) * 18), Math.round(13 + Math.sin(a * Math.PI / 6) * 12), a % 2 ? PAPER[2] : R.gold[3]);
    g.r(22, 4, 4, 22, R.gold[2]).r(17, 9, 14, 4, R.gold[2]).r(22, 4, 1, 22, R.gold[3]).r(17, 9, 14, 1, R.gold[3]);
    g.r(16, 25, 16, 2, R.stone[3]);
    g.outline(SEPIA);
  },
  era(g) {
    g.ellipse(24, 16, 10, 10, R.gold[2]); g.ellipse(22, 14, 6, 6, R.gold[3]); g.ellipse(24, 16, 4, 4, R.fire[4]);
    for (let a = 0; a < 8; a++) { const ca = Math.cos(a * Math.PI / 4), sa = Math.sin(a * Math.PI / 4); g.line(Math.round(24 + ca * 12), Math.round(16 + sa * 12), Math.round(24 + ca * 16), Math.round(16 + sa * 16), R.gold[2]); }
    g.outline(SEPIA);
  },
  revolt(g) {
    g.r(10, 4, 1, 22, R.wood[0]).r(11, 4, 12, 8, R.red[2]).r(11, 4, 12, 1, R.red[3]).r(22, 5, 1, 7, R.red[1]);
    for (let i = 0; i < 5; i++) { const x = 24 + i * 4; g.r(x, 18 - (i % 2) * 2, 3, 8, [R.brown[2], R.ochre[2], R.teal[2]][i % 3]).ellipse(x + 1, 16 - (i % 2) * 2, 1.5, 1.5, R.skinHuman[2]); }
    g.line(27, 10, 30, 15, R.wood[1]).r(26, 8, 3, 2, R.steel[3]);
    g.line(38, 9, 36, 15, R.wood[1]).r(37, 7, 3, 3, R.fire[3]);
    g.outline(SEPIA);
  },
  scroll(g) {
    g.r(10, 6, 28, 22, R.cream[3]).r(10, 6, 28, 1, R.cream[2]);
    g.ellipse(10, 17, 2, 11, R.cream[1]); g.ellipse(38, 17, 2, 11, R.cream[2]);
    for (let i = 0; i < 6; i++) g.r(14, 9 + i * 3, 20 - (i % 2) * 6, 1, R.ink[2]);
    g.r(30, 23, 4, 4, R.red[2]).p(31, 24, R.red[3]);
    g.outline(SEPIA);
  },
};
export const VIGNETTE_KINDS = Object.keys(VIGS);
export function vignetteSheet(kind) {
  const g = page(); const art = new Pix(48, 36); VIGS[kind](art); g.draw(art); frameIt(g);
  return { frames: [g], tags: [], layer: kind };
}
