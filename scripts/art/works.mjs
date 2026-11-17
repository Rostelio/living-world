// Great works: great_work_<id>, 64×64 landmarks that stand on 2×2 tiles in town (src/render/town16.js
// work16). Front view, light from the top-left, ink outline, as in art/STYLE.md. Flags use the KEY
// colours so the game paints them in the realm's colour.
import { R } from './palette.mjs';
import { wall, roof, tri, dome, cone, door, win, banner, flowers, finish, blank, KEY } from './kit.mjs';

const column = (g, x, y, h, ramp = R.white) => g.r(x, y, 2, h, ramp[3]).r(x + 1, y, 1, h, ramp[1]).r(x - 1, y, 4, 1, ramp[2]).r(x - 1, y + h - 1, 4, 1, ramp[2]);
const water = (g, x, y, w, h) => {
  g.r(x, y, w, h, R.water[2]).r(x, y, w, 1, R.water[3]).r(x, y + h - 1, w, 1, R.water[1]);
  for (let yy = y + 2; yy < y + h - 1; yy += 3) for (let xx = x + ((yy * 5) % 7); xx < x + w - 2; xx += 9) g.r(xx, yy, 3, 1, R.water[4]);
  return g;
};
const rose = (g, cx, cy, r) => {
  g.ellipse(cx, cy, r, r, R.ink[1]);
  g.ellipse(cx, cy, r - 1, r - 1, R.blue[2]);
  for (let a = 0; a < 8; a++) g.line(cx, cy, Math.round(cx + Math.cos(a * Math.PI / 4) * (r - 1)), Math.round(cy + Math.sin(a * Math.PI / 4) * (r - 1)), a % 2 ? R.red[2] : R.gold[3]);
  g.p(cx, cy, R.white[3]);
  return g;
};
const tree = (g, x, y) => {
  g.r(x, y + 5, 2, 5, R.wood[1]);
  g.ellipse(x + 1, y + 3, 5, 4, R.leaf[2]); g.ellipse(x, y + 2, 3, 2, R.leaf[3]); g.p(x - 1, y + 1, R.leaf[4]);
  return g;
};

export const WORKS = {
  cathedral(g) {
    const st = R.stone;
    g.r(6, 58, 52, 3, st[3]).r(6, 58, 52, 1, st[4]);
    wall(g, 6, 34, 52, 24, st, 'stone');                                     // nave
    roof(g, 4, 24, 56, 10, R.steel, { inset: 3 });
    for (const x of [10, 18, 42, 50]) { win(g, x, 40, 3, 9, false, st[0]); g.p(x + 1, 39, st[1]); }
    for (const x of [6, 14, 46, 54]) g.r(x, 30, 3, 28, st[3]).r(x + 2, 30, 1, 28, st[1]).r(x, 28, 3, 2, st[4]); // buttresses
    wall(g, 24, 14, 16, 44, st, 'stone');                                    // west front tower
    cone(g, 32, 0, 15, 9, R.steel);
    g.r(31, 0, 2, 2, R.gold[3]).r(30, 1, 4, 1, R.gold[2]);
    rose(g, 32, 24, 5);
    door(g, 28, 44, 8, 14, R.wood);
    g.r(27, 42, 10, 1, st[4]);
    for (const x of [24, 39]) g.r(x, 14, 1, 44, st[1]);
    g.r(23, 13, 18, 2, st[4]);
    for (let x = 24; x < 40; x += 3) g.p(x, 12, st[3]);
    flowers(g, 8, 56, 12); flowers(g, 44, 56, 12);
    return finish(g, 32, 61, 28, 2);
  },
  university(g) {
    g.r(3, 56, 58, 4, R.cream[2]).r(3, 56, 58, 1, R.cream[3]).r(6, 60, 52, 1, R.cream[1]);
    wall(g, 4, 30, 56, 26, R.cream, 'stone');
    roof(g, 2, 24, 60, 7, R.red, { inset: 2 });
    for (const x of [8, 16, 44, 52]) { win(g, x, 36, 4, 6, true); win(g, x, 46, 4, 6, true); }
    wall(g, 22, 22, 20, 34, R.white, 'plain');                               // portico
    tri(g, 32, 12, 10, 12, R.white); g.r(20, 21, 24, 2, R.white[3]);
    g.ellipse(32, 18, 2, 2, R.gold[2]); g.p(31, 17, R.gold[3]);
    for (let x = 23; x < 42; x += 5) column(g, x, 24, 32);
    door(g, 29, 44, 6, 12, R.wood);
    // clock tower behind the pediment
    wall(g, 28, 2, 8, 10, R.cream, 'plain'); g.ellipse(32, 7, 2, 2, R.white[3]); g.p(32, 6, R.ink[1]).p(33, 7, R.ink[1]);
    cone(g, 32, -2, 4, 5, R.blue);
    banner(g, 4, 12, 9, 5); banner(g, 55, 12, 9, 5);
    tree(g, 1, 46); tree(g, 61, 46);
    return finish(g, 32, 61, 30, 2);
  },
  palace(g) {
    const W = ['#8a7a6e', '#c8b894', '#ecdcb4', '#fff6e0'];
    g.r(2, 57, 60, 3, R.stone[3]).r(2, 57, 60, 1, R.stone[4]);
    wall(g, 2, 32, 60, 25, W, 'plain');
    for (let x = 4; x < 60; x += 6) { win(g, x + 1, 37, 3, 6, true, W[0]); win(g, x + 1, 48, 3, 6, true, W[0]); }
    g.r(2, 44, 60, 1, W[3]).r(2, 31, 60, 2, W[3]);
    roof(g, 1, 24, 62, 8, R.blue, { inset: 2 });
    for (const x of [2, 50]) { wall(g, x, 18, 12, 39, W, 'plain'); dome(g, x + 6, 18, 6, 7, R.blue, { clipBottom: 17 }); g.r(x + 5, 8, 2, 4, R.gold[2]); win(g, x + 4, 24, 4, 6, true, W[0]); }
    wall(g, 22, 14, 20, 43, W, 'plain');                                      // central block
    dome(g, 32, 14, 10, 11, R.gold, { clipBottom: 13 }); g.r(22, 13, 20, 1, R.gold[1]);
    g.r(31, 0, 2, 4, R.gold[3]); banner(g, 31, -1, 4, 6);
    win(g, 29, 18, 6, 8, true, W[0]);
    door(g, 27, 44, 10, 13, R.red);
    g.r(25, 41, 14, 2, R.gold[2]).r(25, 41, 14, 1, R.gold[3]);
    flowers(g, 4, 55, 18); flowers(g, 42, 55, 18);
    return finish(g, 32, 61, 30, 2);
  },
  canal(g) {
    const st = R.stone;
    g.r(0, 18, 64, 4, R.leaf[2]).r(0, 18, 64, 1, R.leaf[3]).r(0, 46, 64, 4, R.leaf[2]).r(0, 49, 64, 1, R.leaf[1]);
    g.r(0, 22, 64, 4, st[3]).r(0, 22, 64, 1, st[4]).r(0, 42, 64, 4, st[2]).r(0, 45, 64, 1, st[1]);
    for (let x = 2; x < 64; x += 6) g.p(x, 24, st[1]).p(x + 3, 44, st[1]);
    water(g, 0, 26, 64, 16);
    // lock: two pairs of timber gates and a stone lock house
    for (const x of [18, 40]) { g.r(x, 24, 4, 20, R.wood[1]).r(x, 24, 1, 20, R.wood[3]); for (let y = 27; y < 42; y += 4) g.r(x, y, 4, 1, R.wood[0]); g.r(x - 1, 22, 6, 2, R.wood[2]); }
    wall(g, 24, 4, 16, 14, st, 'stone'); roof(g, 22, -2, 20, 7, R.red, { inset: 3 });
    door(g, 30, 10, 4, 8); win(g, 26, 8, 3, 3, true); win(g, 36, 8, 3, 3, true);
    // a barge waiting at the lock
    g.r(46, 31, 14, 5, R.wood[2]).r(46, 31, 14, 1, R.wood[3]).r(47, 36, 12, 1, R.wood[0]);
    g.r(49, 28, 4, 3, R.cream[2]).r(54, 29, 3, 2, R.straw[2]);
    banner(g, 4, 6, 6, 5); tree(g, 58, 4); tree(g, 8, 50);
    return finish(g, 32, 61, 30, 1);
  },
  harbour_works(g) {
    const st = R.stone;
    water(g, 0, 40, 64, 22);
    wall(g, 0, 32, 64, 9, st, 'stone'); g.r(0, 32, 64, 1, st[4]);             // quay
    for (const x of [6, 26, 46]) g.r(x, 41, 2, 10, R.wood[1]).r(x, 41, 1, 10, R.wood[3]); // piers
    // warehouse
    wall(g, 2, 16, 22, 16, R.brown, 'planks'); roof(g, 0, 8, 26, 9, R.red, { inset: 3 });
    door(g, 9, 22, 8, 10, R.wood, { arch: false }); win(g, 4, 20, 3, 3); win(g, 19, 20, 3, 3);
    // lighthouse
    wall(g, 50, 8, 8, 24, R.white, 'plain'); for (let y = 12; y < 32; y += 6) g.r(50, y, 8, 2, R.red[2]);
    g.r(49, 4, 10, 4, R.ink[2]).r(50, 5, 8, 2, R.fire[3]).r(51, 5, 2, 1, R.fire[4]); cone(g, 54, 0, 4, 5, R.red);
    // crane with a hanging crate
    g.r(32, 6, 2, 26, R.wood[1]).r(32, 6, 1, 26, R.wood[3]).r(26, 6, 18, 2, R.wood[2]).r(26, 6, 18, 1, R.wood[3]);
    g.line(33, 12, 28, 8, R.wood[1]); g.r(42, 8, 1, 12, R.ink[2]); g.r(40, 20, 5, 4, R.wood[2]).r(40, 20, 5, 1, R.wood[3]);
    // ship at the quay
    g.r(14, 46, 22, 5, R.wood[1]).r(14, 46, 22, 1, R.wood[3]).r(16, 51, 18, 1, R.wood[0]);
    g.r(24, 30, 1, 16, R.wood[0]); g.r(18, 32, 6, 9, R.cream[3]).r(25, 33, 5, 8, R.cream[2]);
    banner(g, 24, 26, 3, 4);
    for (const [x, y] of [[28, 28], [36, 28]]) g.r(x, y, 4, 4, R.wood[2]).r(x, y, 4, 1, R.wood[3]);
    return finish(g, 32, 63, 0, 0);
  },
  boulevards(g) {
    const st = R.stone, paved = ['#6e6252', '#a89880', '#cebc9c', '#e8dcc0'];
    g.r(0, 6, 64, 58, R.leaf[2]);
    for (let y = 6; y < 64; y += 3) for (let x = (y * 7) % 5; x < 64; x += 7) g.p(x, y, R.leaf[3]);
    g.r(0, 28, 64, 10, paved[2]).r(27, 6, 10, 58, paved[2]);                  // crossing avenues
    for (let x = 0; x < 64; x += 4) g.p(x, 33, paved[1]); for (let y = 6; y < 64; y += 4) g.p(32, y, paved[1]);
    g.r(0, 28, 64, 1, paved[3]).r(0, 37, 64, 1, paved[0]).r(27, 6, 1, 58, paved[3]).r(36, 6, 1, 58, paved[0]);
    // round plaza and fountain
    g.ellipse(32, 33, 12, 9, paved[3]); g.ellipse(32, 33, 11, 8, paved[2]);
    g.ellipse(32, 34, 7, 5, st[3]); g.ellipse(32, 34, 6, 4, R.water[2]); g.ellipse(31, 33, 3, 2, R.water[3]);
    g.r(31, 24, 2, 9, st[4]).r(32, 24, 1, 9, st[2]); g.r(29, 22, 6, 2, st[3]);
    g.p(30, 21, R.water[4]).p(33, 21, R.water[4]).p(28, 23, R.water[4]).p(35, 23, R.water[4]);
    for (const [x, y] of [[6, 12], [18, 12], [46, 12], [58, 12], [6, 44], [18, 44], [46, 44], [58, 44]]) tree(g, x, y);
    for (const x of [10, 52]) { g.r(x, 26, 1, 4, R.ink[2]); g.r(x - 1, 24, 3, 2, R.fire[3]); }   // street lamps
    for (const x of [22, 41]) { g.r(x, 40, 1, 4, R.ink[2]); g.r(x - 1, 38, 3, 2, R.fire[3]); }
    flowers(g, 4, 25, 18); flowers(g, 42, 25, 18);
    banner(g, 26, 4, 6, 4);
    return finish(g, 32, 63, 0, 0);
  },
  world_fair(g) {
    const iron = R.steel, glass = ['#3a6a8a', '#6aa6c8', '#a6d8ec', '#e4f6fc'];
    g.r(2, 56, 60, 4, R.cream[2]).r(2, 56, 60, 1, R.cream[3]);
    // long glass hall
    for (let y = 30; y < 56; y++) for (let x = 4; x < 60; x++) g.p(x, y, (x - 4) % 6 === 0 || (y - 30) % 6 === 0 ? iron[2] : y < 36 ? glass[3] : glass[2]);
    for (let i = 0; i < 8; i++) g.r(4 + i, 30 - i, 56 - i * 2, 1, i % 2 ? glass[3] : glass[2]);  // pitched glass roof
    g.r(4, 30, 56, 1, iron[3]);
    // central glass dome
    dome(g, 32, 24, 14, 16, glass, { clipBottom: 23 });
    for (const dx of [-8, 0, 8]) g.line(32, 8, 32 + dx, 23, iron[2]);
    g.r(18, 23, 28, 1, iron[2]);
    g.r(31, 2, 2, 6, iron[1]); banner(g, 32, 1, 4, 6);
    // entrance and flags
    door(g, 28, 46, 8, 10, R.red, { arch: true });
    g.r(26, 43, 12, 2, R.gold[2]).r(26, 43, 12, 1, R.gold[3]);
    for (const [x, K] of [[6, KEY], [14, [R.red[0], R.red[1], R.red[2], R.red[3]]], [48, [R.blue[0], R.blue[1], R.blue[2], R.blue[3]]], [56, KEY]]) banner(g, x, 12, 5, 4, K);
    return finish(g, 32, 61, 30, 2);
  },
};

export function workSheet(kind) { return { frames: [WORKS[kind](blank(64, 64))], tags: [], layer: kind }; }
