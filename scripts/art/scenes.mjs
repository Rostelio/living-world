// Side-view scene art (src/render/scene.js), drawn at the scene's own pixel size (it is 270 px tall
// and scaled up whole). Front views, light from the top-left, ink outline, everyone faces right.
//   scene_house_<race> 32×48: tier1/tier2/tier3 × 3 looks (one, two, three storeys)
//   scene_tent 24×24 ×2, scene_special 64×64 (one tag per building), scene_windmill 32×48 turn ×4,
//   scene_tree 24×32 (oak ×3, pine ×2, palm ×2),
//   scene_walker_<race> 8×12 (r0..r4 roles and child, walk ×4), scene_soldier_<race> 12×16
//   (inf, rng, gun, walk ×4), scene_rider_<race> 16×16 (ride ×2).
// Window glass is WIN and chimney tops CHIM exactly, so the game can find them (night lights, smoke).
import { Pix } from './pix.mjs';
import { R, INK, SKIN } from './palette.mjs';
import { KEY } from './kit.mjs';

export const WIN = '#7ab4d6', CHIM = '#8a7a70';
const WALLS = {
  humans: { wall: R.cream, roof: R.red, beam: R.wood[1] },
  elves: { wall: ['#8a7a5a', '#c8b88a', '#e8dcb4', '#f6eed4'], roof: R.leaf.slice(1), beam: R.wood[2] },
  dwarves: { wall: R.stone.slice(0, 4), roof: R.steel.slice(0, 4), beam: R.stone[0] },
  orcs: { wall: R.wood, roof: R.brown, beam: R.wood[0] },
  lizardfolk: { wall: R.straw, roof: R.ochre, beam: R.wood[1] },
  halflings: { wall: R.cream, roof: R.green, beam: R.wood[1] },
};

function window_(g, x, y, w = 3, h = 4, round = false) {
  g.r(x - 1, y - 1, w + 2, h + 2, R.wood[0]);
  g.r(x, y, w, h, WIN);
  if (round) g.p(x - 1, y - 1, R.wood[0]);
  g.p(x, y, '#c6e6f2');
  g.r(x - 1, y + h + 1, w + 2, 1, R.wood[3]);
}
function gable(g, cx, y, half, h, ramp) {
  for (let i = 0; i < h; i++) {
    const hw = Math.round(((i + 1) / h) * half);
    g.r(cx - hw, y + i, hw, 1, i % 3 === 2 ? ramp[1] : ramp[3]).r(cx, y + i, hw, 1, i % 3 === 2 ? ramp[0] : ramp[2]);
  }
}

function house(race, tier, v) {
  const g = new Pix(32, 48), W = WALLS[race];
  const storeys = tier, w = tier === 3 ? 18 : 20 + (v % 2) * 4, x0 = 16 - Math.floor(w / 2), wh = storeys * 9 + 4, base = 47, y0 = base - wh;
  const wall = W.wall;
  if (race === 'lizardfolk') {                                    // a hut on stilts
    for (const x of [x0 + 2, x0 + w - 4]) g.r(x, base - 6, 2, 7, R.wood[1]).r(x, base - 6, 1, 7, R.wood[2]);
    g.r(x0, base - 7, w, 2, R.wood[2]).r(x0, base - 7, w, 1, R.wood[3]);
    const top = base - 7 - (wh - 4);
    g.r(x0 + 1, top, w - 2, wh - 4, wall[2]);
    for (let xx = x0 + 2; xx < x0 + w - 2; xx += 2) g.r(xx, top, 1, wh - 4, wall[1]);
    g.r(x0 + 1, top, 1, wh - 4, wall[3]);
    window_(g, x0 + 3, top + 3, 3, 3); g.r(16 - 2, base - 7 - 7, 4, 7, R.wood[0]);
    for (let i = 0; i < 9; i++) { const hw = Math.round(((i + 1) / 9) * (w / 2 + 3)); for (let xx = 16 - hw; xx < 16 + hw; xx++) g.p(xx, top - 9 + i, (xx + i) % 3 ? W.roof[2] : W.roof[1]); }
    g.r(16 - Math.round(w / 2 + 3), top - 1, Math.round(w + 6), 1, W.roof[0]);
    g.outline(INK);
    return g;
  }
  // walls
  g.r(x0, y0, w, wh, wall[2]).r(x0, y0, 2, wh, wall[3]).r(x0 + w - 2, y0, 2, wh, wall[1]);
  if (race === 'humans' || race === 'halflings') for (let k = 0; k < storeys; k++) { g.r(x0, y0 + k * 9, w, 1, W.beam); g.r(x0 + 3, y0 + k * 9, 1, 9, W.beam); g.r(x0 + w - 4, y0 + k * 9, 1, 9, W.beam); if (k === 0) g.line(x0 + 3, y0 + 9, x0 + 7, y0 + 1, W.beam); }
  if (race === 'dwarves') for (let yy = y0 + 2; yy < base; yy += 3) for (let xx = x0 + 1 + ((yy / 3) % 2) * 2; xx < x0 + w - 2; xx += 5) g.r(xx, yy, 4, 1, wall[1]);
  if (race === 'elves') for (let xx = x0 + 3; xx < x0 + w - 2; xx += 4) g.r(xx, y0, 1, wh, wall[1]);
  if (race === 'orcs') for (let yy = y0 + 2; yy < base; yy += 2) g.r(x0, yy, w, 1, wall[1]);
  g.r(x0, base - 1, w, 1, wall[0]);
  // windows on every storey (round ones for halflings and elves), door below
  const round = race === 'halflings' || race === 'elves';
  for (let k = 0; k < storeys; k++) for (let wx = x0 + 4; wx < x0 + w - 5; wx += 7) if (k > 0 || Math.abs(wx + 2 - 16) > 5) window_(g, wx + 1, y0 + 3 + k * 9, 3, 4, round);
  if (race === 'halflings') { g.ellipse(16, base - 3, 3, 4, R.green[2]); g.r(13, base - 3, 7, 3, R.green[2]); g.p(17, base - 3, R.gold[3]); g.ellipse(16, base - 4, 4, 5, R.wood[1]); g.ellipse(16, base - 3, 3, 4, R.green[2]); g.r(13, base - 3, 7, 3, R.green[2]); g.p(18, base - 3, R.gold[3]); }
  else { g.r(14, base - 8, 5, 8, R.wood[0]).r(15, base - 7, 3, 7, R.wood[2]).p(17, base - 4, R.gold[3]); }
  // roof
  const rh = race === 'dwarves' ? 7 : 10, top = y0 - rh;
  if (race === 'elves') {
    for (let i = 0; i < rh; i++) { const hw = Math.round((w / 2 + 2) * Math.sin(((i + 1) / rh) * Math.PI / 2)); g.r(16 - hw, top + i, hw, 1, W.roof[3]).r(16, top + i, hw, 1, W.roof[2]); }
    g.r(15, top - 3, 2, 3, W.roof[2]).p(15, top - 3, W.roof[3]);
    for (let xx = 16 - w / 2; xx < 16 + w / 2; xx += 3) g.p(xx, top + rh - 1, W.roof[1]).p(xx + 1, top + rh, R.leaf[3]);
  } else if (race === 'halflings') {
    for (let i = 0; i < rh; i++) { const hw = Math.round((w / 2 + 2) * Math.sqrt((i + 1) / rh)); g.r(16 - hw, top + i, hw * 2, 1, i < 3 ? W.roof[3] : W.roof[2]); }
    for (let xx = 16 - w / 2; xx < 16 + w / 2; xx += 4) g.p(xx, top + 4 + (xx % 3), [R.pink[2], R.gold[3], R.white[3]][xx % 3]);
  } else {
    gable(g, 16, top, Math.floor(w / 2) + 2, rh, W.roof);
    g.r(16 - Math.floor(w / 2) - 2, y0 - 1, w + 4, 1, W.roof[0]);
  }
  // chimney (not on elf houses)
  if (race !== 'elves') { const cx = 16 + Math.floor(w / 2) - 5; g.r(cx, top + 1, 3, 6, R.stone[2]).r(cx, top + 1, 1, 6, R.stone[3]).r(cx - 1, top, 5, 1, CHIM); }
  if (v === 2 && race === 'humans') g.r(x0 + 1, base - 3, 4, 2, R.leaf[2]).p(x0 + 2, base - 4, R.pink[2]).p(x0 + 4, base - 4, R.gold[3]);
  g.outline(INK);
  return g;
}

function tent(v) {
  const g = new Pix(24, 24), hide = v ? ['#4a3220', '#6a4a2e', '#8a6a44', '#a88a5a'] : ['#3e2a1a', '#5e4228', '#7a5a3a', '#987850'];
  for (let i = 0; i < 17; i++) { const hw = Math.round(i * 0.62) + 1; g.r(12 - hw, 6 + i, hw, 1, hide[3]).r(12, 6 + i, hw, 1, hide[2]); if (i % 4 === 3) g.r(12 - hw, 6 + i, hw * 2, 1, hide[1]); }
  g.line(11, 0, 11, 7, R.cream[3]).line(13, 1, 13, 7, R.cream[2]).line(9, 2, 11, 6, R.wood[1]);
  g.r(10, 15, 4, 8, R.ink[0]).p(11, 15, hide[0]);
  g.r(4, 13, 16, 2, KEY[2]).r(4, 13, 16, 1, KEY[3]);
  g.r(5, 16, 2, 2, R.bone || R.cream[3]);
  g.outline(INK);
  return g;
}

// ---------------- special buildings (64×64, bottom-centre) ----------------
const ST = R.stone;
function flag(g, x, y, h = 9) { g.r(x, y, 1, h, R.wood[0]); g.r(x + 1, y, 6, 4, KEY[2]).r(x + 1, y, 6, 1, KEY[3]).r(x + 6, y + 1, 1, 3, KEY[1]); }
const SPECIAL = {
  town_hall(g) {
    g.r(15, 40, 34, 24, R.cream[2]).r(15, 40, 2, 24, R.cream[3]).r(47, 40, 2, 24, R.cream[1]);
    for (const x of [15, 31, 48]) g.r(x, 40, 1, 24, R.wood[1]); g.r(15, 40, 34, 1, R.wood[1]).r(15, 51, 34, 1, R.wood[1]);
    gable(g, 32, 28, 20, 12, R.red); g.r(12, 39, 40, 1, R.red[0]);
    g.r(28, 10, 8, 30, ST[2]).r(28, 10, 2, 30, ST[3]).r(34, 10, 2, 30, ST[1]);
    g.ellipse(32, 18, 3, 3, R.cream[3]); g.p(32, 16, INK).p(32, 17, INK).p(33, 18, INK);
    gable(g, 32, 2, 6, 8, R.red); flag(g, 31, -4, 7);
    g.r(29, 52, 6, 12, R.wood[0]).r(30, 53, 4, 11, R.wood[2]);
    for (const x of [19, 41]) { window_(g, x, 44, 4, 5); window_(g, x, 55, 4, 5); }
  },
  castle(g) {
    g.r(10, 30, 44, 34, ST[2]);
    for (let y = 31; y < 64; y += 3) for (let x = 10 + ((y / 3) % 2) * 2; x < 54; x += 5) g.r(x, y, 4, 1, ST[1]);
    for (let x = 10; x < 54; x += 4) g.r(x, 27, 2, 3, ST[2]).p(x, 27, ST[3]);
    for (const tx of [2, 50]) { g.r(tx, 14, 12, 50, ST[2]).r(tx, 14, 2, 50, ST[3]).r(tx + 10, 14, 2, 50, ST[1]); for (let k = 0; k < 12; k += 3) g.r(tx + k, 10, 2, 4, ST[2]); window_(g, tx + 4, 22, 3, 5); window_(g, tx + 4, 38, 3, 5); flag(g, tx + 5, 0, 10); }
    g.r(26, 44, 12, 20, R.ink[1]); g.ellipse(32, 44, 6, 4, R.ink[1]);
    for (let x = 27; x < 38; x += 3) g.r(x, 42, 1, 22, R.steel[1]);
    window_(g, 20, 36, 3, 4); window_(g, 41, 36, 3, 4);
  },
  temple(g) {
    g.r(14, 38, 36, 26, R.white[3]).r(14, 38, 2, 26, '#ffffff').r(48, 38, 2, 26, R.white[1]);
    for (let x = 17; x < 48; x += 6) g.r(x, 42, 2, 22, R.white[2]).r(x + 1, 42, 1, 22, R.white[1]);
    gable(g, 32, 28, 20, 10, R.steel);
    g.r(27, 8, 10, 30, R.white[3]).r(35, 8, 2, 30, R.white[1]);
    gable(g, 32, 0, 6, 8, R.steel); g.r(31, -3, 2, 4, R.gold[2]);
    window_(g, 30, 14, 4, 7, true); g.ellipse(32, 30, 3, 3, R.blue[2]); g.p(32, 30, R.gold[3]);
    g.r(29, 50, 6, 14, R.wood[0]).r(30, 51, 4, 13, R.wood[2]);
  },
  market(g) {
    for (let k = 0; k < 3; k++) {
      const x = 4 + k * 19;
      for (let s = 0; s < 16; s += 2) g.r(x + s, 38, 2, 5, (s / 2 + k) % 2 ? KEY[2] : R.cream[3]);
      g.r(x, 43, 16, 1, R.wood[0]);
      g.r(x, 43, 1, 21, R.wood[1]).r(x + 15, 43, 1, 21, R.wood[1]);
      g.r(x + 1, 54, 14, 3, R.wood[2]).r(x + 1, 54, 14, 1, R.wood[3]);
      const goods = [[R.red[2], R.gold[3]], [R.leaf[3], R.fire[2]], [R.purple[2], R.cream[3]]][k];
      for (let i = 0; i < 4; i++) g.r(x + 2 + i * 3, 52, 2, 2, goods[i % 2]);
      g.r(x + 3, 57, 10, 7, R.wood[1]);
    }
  },
  library(g) {
    g.r(8, 30, 48, 34, R.cream[3]).r(8, 30, 2, 34, R.white[3]).r(54, 30, 2, 34, R.cream[1]);
    g.r(6, 28, 52, 3, R.cream[2]).r(6, 28, 52, 1, R.white[3]);
    for (let x = 12; x < 54; x += 7) g.r(x, 32, 2, 32, R.white[3]).r(x + 1, 32, 1, 32, R.white[1]);
    for (let y = 8; y < 28; y++) { const hw = Math.round(14 * Math.sqrt(1 - ((y - 28) / 20) ** 2)); g.r(32 - hw, y, hw, 1, R.blue[3]).r(32, y, hw, 1, R.blue[2]); }
    g.r(31, 3, 2, 6, R.gold[2]);
    g.r(28, 50, 8, 14, R.wood[0]).r(29, 51, 6, 13, R.wood[2]);
    window_(g, 17, 38, 3, 6); window_(g, 44, 38, 3, 6);
  },
  granary(g) {
    g.r(18, 30, 28, 34, R.straw[2]).r(18, 30, 3, 34, R.straw[3]).r(43, 30, 3, 34, R.straw[1]);
    for (let y = 34; y < 64; y += 6) g.r(18, y, 28, 1, R.wood[1]);
    gable(g, 32, 18, 16, 12, R.red);
    g.r(28, 50, 8, 14, R.wood[0]).r(29, 51, 6, 13, R.wood[2]).line(29, 51, 34, 63, R.wood[1]);
    window_(g, 30, 36, 4, 4);
    for (const x of [8, 50]) g.r(x, 56, 6, 8, R.straw[2]).r(x, 56, 6, 1, R.straw[3]).r(x + 2, 56, 2, 8, R.wood[1]);
  },
  barracks(g) {
    g.r(6, 38, 52, 26, ST[2]).r(6, 38, 2, 26, ST[3]).r(56, 38, 2, 26, ST[1]);
    for (let y = 40; y < 64; y += 3) for (let x = 6 + ((y / 3) % 2) * 2; x < 58; x += 5) g.r(x, y, 4, 1, ST[1]);
    for (let x = 6; x < 58; x += 4) g.r(x, 34, 2, 4, ST[2]).p(x, 34, ST[3]);
    g.r(26, 48, 12, 16, R.wood[0]).r(27, 49, 10, 15, R.wood[2]);
    flag(g, 52, 20, 14);
    for (const x of [12, 44]) { g.r(x, 44, 1, 18, R.wood[2]); g.r(x - 1, 42, 3, 3, R.steel[3]); }
    window_(g, 16, 44, 3, 4); window_(g, 45, 44, 3, 4);
  },
  port(g) {
    g.r(0, 52, 64, 4, R.wood[2]).r(0, 52, 64, 1, R.wood[3]);
    for (let x = 2; x < 64; x += 8) g.r(x, 56, 3, 8, R.wood[1]);
    g.r(4, 34, 22, 18, R.brown[2]).r(4, 34, 2, 18, R.brown[3]); for (let x = 8; x < 26; x += 4) g.r(x, 34, 1, 18, R.brown[1]);
    gable(g, 15, 24, 13, 10, R.red); window_(g, 9, 40, 3, 3); g.r(16, 42, 6, 10, R.wood[0]);
    g.r(44, 8, 2, 44, R.wood[1]).r(30, 8, 22, 2, R.wood[2]).r(30, 8, 22, 1, R.wood[3]);
    g.line(45, 16, 36, 9, R.wood[1]); g.r(33, 10, 1, 14, INK); g.r(31, 24, 5, 4, R.wood[2]).r(31, 24, 5, 1, R.wood[3]);
    for (const [x, y] of [[50, 48], [56, 48], [53, 44]]) g.r(x, y, 4, 4, R.wood[2]).r(x, y, 4, 1, R.wood[3]).p(x + 3, y + 3, R.wood[1]);
  },
  mine(g) {
    for (let i = 0; i < 28; i++) { const hw = Math.round(i * 1.15); for (let x = 32 - hw; x < 32 + hw; x++) g.p(x, 36 + i, (x + i * 3) % 7 === 0 ? ST[1] : x < 32 - hw / 3 ? ST[3] : ST[2]); }
    g.r(24, 48, 16, 16, R.ink[0]);
    g.r(22, 46, 20, 3, R.wood[2]).r(22, 46, 20, 1, R.wood[3]).r(22, 46, 3, 18, R.wood[1]).r(39, 46, 3, 18, R.wood[1]);
    g.r(44, 58, 12, 4, R.wood[1]).r(45, 54, 10, 4, R.steel[2]).r(46, 53, 4, 2, R.stone[3]).r(51, 53, 3, 2, R.gold[3]);
    g.r(45, 62, 2, 2, INK).r(53, 62, 2, 2, INK);
    g.r(12, 58, 8, 1, R.wood[1]).r(12, 56, 1, 2, R.wood[1]);
  },
  lumber_camp(g) {
    for (let k = 0; k < 5; k++) { const y = 60 - k * 4, x = 8 + (k % 2) * 3, w = 30 - k * 3; g.r(x, y, w, 4, k % 2 ? R.wood[2] : R.wood[3]).r(x, y + 3, w, 1, R.wood[1]); g.ellipse(x + 1, y + 2, 1.5, 2, R.straw[3]); g.p(x + 1, y + 2, R.wood[2]); }
    g.r(46, 50, 10, 4, R.wood[1]).r(46, 54, 2, 10, R.wood[1]).r(54, 54, 2, 10, R.wood[1]);
    g.r(50, 38, 1, 12, R.wood[2]).r(48, 37, 5, 3, R.steel[3]).p(48, 37, R.steel[4]);
    g.r(40, 58, 4, 6, R.wood[2]).r(40, 58, 4, 1, R.straw[3]);
  },
};
SPECIAL.university = SPECIAL.library; SPECIAL.warehouse = SPECIAL.granary; SPECIAL.quarry = SPECIAL.mine;
export const SPECIAL_KINDS = ['town_hall', 'castle', 'temple', 'market', 'library', 'granary', 'barracks', 'port', 'mine', 'lumber_camp'];
function special(kind) { const g = new Pix(64, 64); SPECIAL[kind](g); g.outline(INK); return g; }

function windmill(k) {
  const g = new Pix(32, 48), st = R.cream;
  for (let y = 18; y < 48; y++) { const hw = 5 + Math.round((y - 18) * 0.2); g.r(16 - hw, y, hw, 1, st[3]).r(16, y, hw, 1, st[2]); }
  g.r(14, 40, 4, 8, R.wood[0]).r(15, 41, 2, 7, R.wood[2]); window_(g, 15, 26, 2, 3);
  g.r(11, 15, 10, 4, R.wood[2]).r(11, 15, 10, 1, R.wood[3]).r(12, 14, 8, 1, R.wood[1]);
  const a0 = (k / 4) * (Math.PI / 2);
  for (let b = 0; b < 4; b++) {
    const a = a0 + (b * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let r = 1; r <= 13; r++) {
      g.p(Math.round(16 + ca * r), Math.round(16 + sa * r), R.wood[1]);
      if (r > 3) for (let s = 1; s <= 3; s++) g.p(Math.round(16 + ca * r - sa * s), Math.round(16 + sa * r + ca * s), (r + s) % 2 ? R.cream[3] : R.cream[2]);
    }
  }
  g.r(15, 15, 2, 2, R.wood[0]);
  g.outline(INK);
  return g;
}

function tree(kind, v) {
  const g = new Pix(24, 32);
  if (kind === 'pine') {
    const L = v ? R.leaf.slice(0, 4) : ['#173326', '#1f4a36', '#2e6a46', '#4a8a5a'];
    g.r(11, 26, 2, 6, R.wood[1]);
    for (let tier = 0; tier < 4; tier++) { const y0 = 2 + tier * 6; for (let i = 0; i < 9; i++) { const hw = Math.round(2 + i * (0.6 + tier * 0.15)); g.r(12 - hw, y0 + i, hw, 1, L[3]).r(12, y0 + i, hw, 1, L[2]); if (i === 8) g.r(12 - hw, y0 + i, hw * 2, 1, L[1]); } }
  } else if (kind === 'palm') {
    for (let y = 10; y < 32; y++) { const x = 11 + Math.round(Math.sin(y * 0.15 + v) * 2); g.r(x, y, 2, 1, y % 3 ? R.wood[2] : R.wood[1]); }
    const cx = 11 + Math.round(Math.sin(10 * 0.15 + v) * 2);
    for (const [dx, dy, len] of [[-1, 0.3, 9], [1, 0.3, 9], [-1, -0.4, 7], [1, -0.4, 7], [0.3, -1, 5]]) for (let r = 0; r < len; r++) { const x = Math.round(cx + 1 + dx * r), y = Math.round(10 + dy * r + (r * r) / 18); g.p(x, y, R.leaf[3]).p(x, y + 1, R.leaf[2]); }
    g.r(cx, 11, 3, 2, R.brown[2]);
  } else {
    const L = [R.leaf.slice(1), ['#235334', '#3a7a3c', '#5aa244', '#94cc5c'], ['#1f4a30', '#2e6a3a', '#48903e', '#7ab85a']][v];
    g.r(11, 20, 3, 12, R.wood[1]).r(11, 20, 1, 12, R.wood[2]).line(12, 24, 8, 20, R.wood[1]);
    for (const [cx, cy, r] of [[12, 12, 8], [7, 15, 5], [17, 15, 5], [12, 7, 5]]) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r); if (d > 1) continue;
      const lit = (cx - x) * 0.6 + (cy - y) * 0.8;
      g.p(x, y, lit > r * 0.4 ? L[3] : lit > -r * 0.2 ? L[2] : L[1]);
    }
    if (v === 1) g.p(9, 10, R.red[3]).p(15, 13, R.red[3]).p(12, 16, R.red[3]);
  }
  g.outline(INK);
  return g;
}

// ---------------- little people ----------------
const ROLES = [ // [tunic ramp, hat]
  [R.brown, 'straw'], [KEY, 'helm'], [R.blue, null], [R.ochre, 'red'], [R.purple, 'gold'],
];
function walker(race, role, f, child = false) {
  const g = new Pix(8, 12), S = SKIN[race], [tun, hat] = child ? [R.teal, null] : ROLES[role], o = child ? 3 : 0;
  const st = [0, 1, 0, -1][f];
  // legs
  g.r(2 + (st > 0 ? 1 : 0), 9, 1, 3 - (st > 0 ? 1 : 0), R.ink[2]).r(4 - (st < 0 ? 1 : 0), 9, 1, 3 - (st < 0 ? 1 : 0), R.ink[2]);
  // body
  g.r(2, 5 + o, 4, 4 - o, tun[2]).r(2, 5 + o, 1, 4 - o, tun[3]).r(5, 5 + o, 1, 4 - o, tun[1]);
  g.p(1, 6 + o + (st > 0 ? 1 : 0), S[2]).p(6, 6 + o + (st < 0 ? 1 : 0), S[2]);
  // head
  g.r(2, 1 + o, 4, 4, S[2]).r(2, 1 + o, 1, 4, S[3]).p(5, 2 + o, INK).p(5, 4 + o, S[1]);
  if (race === 'elves') g.p(1, 2 + o, S[2]);
  if (race === 'orcs') g.p(5, 4 + o, R.cream[3]);
  if (race === 'lizardfolk') g.r(5, 3 + o, 2, 2, S[2]).p(3, o, R.red[2]);
  if (hat === 'straw') g.r(1, 1 + o, 6, 1, R.straw[3]).r(2, o, 4, 1, R.straw[2]);
  else if (hat === 'helm') g.r(2, o, 4, 2, R.steel[3]).p(2, o, R.steel[4]);
  else if (hat === 'red') g.r(2, o, 4, 2, R.red[2]);
  else if (hat === 'gold') g.r(2, o, 4, 1, R.purple[1]).p(3, o - 1 < 0 ? 0 : o, R.gold[3]);
  else if (race !== 'lizardfolk') g.r(2, 1 + o, 4, 1, R.hairBrown[2]).p(2, 2 + o, R.hairBrown[2]);
  if (race === 'dwarves' && !child) g.r(3, 4 + o, 3, 2, R.hairGinger[2]);
  g.outline(INK);
  return g;
}
export function walkerSheet(race) {
  const frames = [], tags = [];
  for (let r = 0; r < 5; r++) { tags.push(['r' + r, frames.length, frames.length + 3, 140]); for (let f = 0; f < 4; f++) frames.push(walker(race, r, f)); }
  tags.push(['child', frames.length, frames.length + 3, 140]); for (let f = 0; f < 4; f++) frames.push(walker(race, 0, f, true));
  return { frames, tags, layer: race };
}

function soldier(race, cls, f) {
  const g = new Pix(12, 16), S = SKIN[race], st = [0, 1, 0, -1][f];
  // legs and boots
  g.r(4 + (st > 0 ? 1 : 0), 11, 1, 4, R.wood[0]).r(6 - (st < 0 ? 1 : 0), 11, 1, 4, R.wood[0]).r(4 + (st > 0 ? 1 : 0), 15, 2, 1, INK).r(6 - (st < 0 ? 1 : 0), 15, 2, 1, INK);
  // tunic in the realm colour, belt
  g.r(4, 6, 4, 5, KEY[2]).r(4, 6, 1, 5, KEY[3]).r(7, 6, 1, 5, KEY[1]).r(4, 9, 4, 1, R.wood[0]).p(5, 9, R.gold[3]);
  // head
  g.r(5, 2, 3, 4, S[2]).p(7, 3, INK).p(5, 2, S[3]);
  if (race === 'orcs') g.p(7, 5, R.cream[3]);
  if (race === 'lizardfolk') g.r(8, 4, 1, 2, S[2]);
  if (race === 'dwarves') g.r(5, 5, 3, 2, R.hairGinger[2]);
  if (cls === 'gun') g.r(4, 1, 5, 2, R.ink[2]).r(4, 1, 5, 1, R.ink[3]);
  else if (cls === 'rng') g.r(4, 1, 4, 2, R.leaf[2]).p(4, 3, R.leaf[1]).p(4, 4, R.leaf[1]);
  else g.r(4, 1, 4, 2, R.steel[3]).r(3, 2, 6, 1, R.steel[2]).p(4, 1, R.steel[4]);
  if (cls === 'rng') { g.line(10, 2, 10, 11, R.wood[2]).p(9, 1, R.wood[2]).p(9, 12, R.wood[2]).line(9, 2, 9, 11, R.cream[3]); g.r(8, 7, 2, 1, S[2]); }
  else if (cls === 'gun') { g.r(6, 7, 6, 1, R.ink[2]).r(5, 8, 3, 1, R.wood[2]).p(8, 7, S[2]); }
  else { g.r(9, 0, 1, 13, R.wood[2]).r(9, 0, 1, 2, R.steel[4]).p(8, 7, S[2]); g.r(2, 6, 3, 5, KEY[2]).r(2, 6, 3, 1, KEY[3]).p(3, 8, R.gold[3]); }
  g.outline(INK);
  return g;
}
export function soldierSheet(race) {
  const frames = [], tags = [];
  for (const cls of ['inf', 'rng', 'gun']) { tags.push([cls, frames.length, frames.length + 3, 140]); for (let f = 0; f < 4; f++) frames.push(soldier(race, cls, f)); }
  return { frames, tags, layer: race };
}
function rider(race, f) {
  const g = new Pix(16, 16), S = SKIN[race], H = R.brown;
  // horse
  g.r(2, 8, 10, 4, H[2]).r(2, 8, 10, 1, H[3]).r(2, 11, 10, 1, H[1]);
  g.r(11, 5, 2, 5, H[2]).r(12, 3, 3, 3, H[2]).p(14, 4, INK).r(11, 4, 1, 5, R.ink[2]);
  for (const [x, d] of [[3, f ? 1 : 0], [5, f ? 0 : 1], [9, f ? 1 : 0], [11, f ? 0 : 1]]) g.r(x + d, 12, 1, 4, H[1]);
  g.r(1, 9, 1, 4, R.ink[2]);
  g.r(5, 8, 4, 2, KEY[2]).r(5, 8, 4, 1, KEY[3]);
  // rider
  g.r(6, 3, 3, 5, KEY[2]).r(6, 3, 1, 5, KEY[3]);
  g.r(6, 0, 3, 3, S[2]).p(8, 1, INK).r(6, 0, 3, 1, R.steel[3]);
  g.r(10, 0, 1, 9, R.wood[2]).p(10, 0, R.steel[4]);
  g.outline(INK);
  return g;
}
export const riderSheet = (race) => ({ frames: [rider(race, 0), rider(race, 1)], tags: [['ride', 0, 1, 160]], layer: race });

export function houseSheet(race) {
  const frames = [], tags = [];
  for (let t = 1; t <= 3; t++) { tags.push(['tier' + t, frames.length, frames.length + 2, 1000]); for (let v = 0; v < 3; v++) frames.push(house(race, t, v)); }
  return { frames, tags, layer: race };
}
export const SCENE = {
  scene_tent: () => ({ frames: [tent(0), tent(1)], tags: [], layer: 'tent' }),
  scene_special: () => ({ frames: SPECIAL_KINDS.map(special), tags: SPECIAL_KINDS.map((k, i) => [k, i, i, 1000]), layer: 'special' }),
  scene_windmill: () => ({ frames: [0, 1, 2, 3].map(windmill), tags: [['turn', 0, 3, 180]], layer: 'windmill' }),
  scene_tree: () => ({ frames: [tree('oak', 0), tree('oak', 1), tree('oak', 2), tree('pine', 0), tree('pine', 1), tree('palm', 0), tree('palm', 1)], tags: [['oak', 0, 2, 1000], ['pine', 3, 4, 1000], ['palm', 5, 6, 1000]], layer: 'tree' }),
};
