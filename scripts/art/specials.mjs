// building_<kind> (32×32, one tile), the big buildings (64×64, 2×2 tiles), campfire and windmill.
// Banners use the KEY colours from kit.mjs, which the game swaps for the realm's colour.
import { Pix } from './pix.mjs';
import { R } from './palette.mjs';
import { wall, roof, tri, dome, cone, door, win, chimney, banner, flowers, finish, blank } from './kit.mjs';

const BRICK = ['#4a1e1c', '#7a3428', '#a4503a', '#c87a5a'];
const crate = (g, x, y, s = 4) => g.r(x, y, s, s, R.wood[2]).r(x, y, s, 1, R.wood[3]).r(x, y + s - 1, s, 1, R.wood[1]).line(x, y + 1, x + s - 1, y + s - 2, R.wood[1]);
const barrel = (g, x, y) => g.r(x, y, 4, 5, R.wood[2]).r(x, y, 1, 5, R.wood[3]).r(x + 3, y, 1, 5, R.wood[1]).r(x, y + 1, 4, 1, R.steel[1]).r(x, y + 3, 4, 1, R.steel[1]);
const sack = (g, x, y) => g.r(x, y + 1, 4, 3, R.cream[2]).r(x + 1, y, 2, 1, R.cream[2]).r(x, y + 1, 1, 3, R.cream[3]).p(x + 1, y, R.wood[1]);
const column = (g, x, y, h) => g.r(x, y, 2, h, R.white[3]).r(x + 1, y, 1, h, R.white[1]).r(x - 1, y, 4, 1, R.white[2]).r(x - 1, y + h - 1, 4, 1, R.white[2]);
const smokestack = (g, x, y, h) => g.r(x, y, 3, h, BRICK[2]).r(x, y, 1, h, BRICK[3]).r(x + 2, y, 1, h, BRICK[1]).r(x - 1, y, 5, 2, R.ink[2]).r(x, y + 4, 3, 1, R.stone[3]);
const sawtooth = (g, x, y, w, ramp) => { for (let i = 0; i < w; i += 6) { for (let j = 0; j < 6 && i + j < w; j++) g.r(x + i + j, y + 5 - j, 1, j + 1, j < 2 ? R.water[3] : ramp[2 - (j > 3 ? 1 : 0)]); } return g; };

export const SMALL = {
  temple(g) {
    g.r(3, 26, 26, 3, R.cream[2]).r(3, 26, 26, 1, R.cream[3]).r(5, 25, 22, 1, R.cream[3]);
    g.r(6, 13, 20, 12, R.cream[2]).r(6, 13, 20, 1, R.cream[3]);
    for (const x of [7, 12, 19, 24]) column(g, x, 13, 12);
    door(g, 14, 18, 4, 7, R.wood);
    tri(g, 16, 4, 9, 13, R.cream, { seams: false }); g.line(16, 3, 3, 12, R.gold[2]).line(16, 3, 29, 12, R.gold[2]);
    g.ellipse(16, 9, 2, 2, R.purple[3]).p(16, 9, R.gold[3]);
    return finish(g, 16, 29, 14);
  },
  market(g) {
    const aw = [[R.red, R.cream], [R.blue, R.cream]];
    for (let s = 0; s < 2; s++) {
      const x0 = 2 + s * 15;
      g.r(x0, 12, 1, 17, R.wood[1]).r(x0 + 12, 12, 1, 17, R.wood[1]);
      for (let i = 0; i < 13; i++) g.r(x0 + i, 9, 1, 5, aw[s][Math.floor(i / 2) % 2][i % 2 ? 2 : 3]);
      for (let i = 0; i < 13; i += 2) g.p(x0 + i, 14, aw[s][0][2]);
      g.r(x0 + 1, 20, 11, 5, R.wood[2]).r(x0 + 1, 20, 11, 1, R.wood[3]);
      const goods = s ? [R.green[3], R.fire[2], R.red[3], R.gold[3]] : [R.red[2], R.gold[2], R.pink[2], R.green[2]];
      goods.forEach((c, i) => g.r(x0 + 2 + i * 2 + (i > 1 ? 1 : 0), 18, 2, 2, c));
    }
    crate(g, 13, 24); sack(g, 18, 25);
    return finish(g, 16, 29, 15);
  },
  library(g) {
    wall(g, 4, 13, 24, 16, R.cream, 'stone');
    roof(g, 3, 6, 26, 7, R.purple);
    dome(g, 16, 6, 5, 5, R.purple, { clipBottom: 6 }); g.p(16, 0, R.gold[3]);
    for (const x of [7, 22]) win(g, x, 16, 3, 7, true);
    door(g, 14, 21, 4, 8); g.r(12, 16, 8, 3, R.wood[2]).r(13, 17, 2, 1, R.red[2]).r(15, 17, 1, 1, R.blue[2]).r(16, 17, 2, 1, R.green[2]);
    return finish(g, 16, 29, 14);
  },
  granary(g) {
    wall(g, 9, 13, 14, 16, R.straw, 'planks');
    cone(g, 16, 2, 12, 9, R.red);
    door(g, 14, 22, 4, 7);
    sack(g, 3, 25); sack(g, 5, 22); sack(g, 25, 25); g.r(24, 23, 3, 2, R.straw[3]);
    return finish(g, 16, 29, 14);
  },
  warehouse(g) {
    wall(g, 2, 14, 28, 15, R.wood, 'planks');
    roof(g, 1, 6, 30, 8, R.brown);
    g.r(10, 18, 12, 11, R.wood[1]).r(10, 18, 12, 1, R.wood[3]).r(16, 18, 1, 11, R.wood[0]).line(10, 18, 15, 28, R.wood[0]).line(21, 18, 17, 28, R.wood[0]);
    crate(g, 3, 25); crate(g, 25, 25); crate(g, 26, 21, 3);
    return finish(g, 16, 29, 15);
  },
  barracks(g) {
    wall(g, 2, 15, 22, 14, R.wood, 'logs');
    roof(g, 1, 7, 24, 8, R.red);
    door(g, 11, 21, 4, 8); win(g, 5, 19, 3, 3, true); win(g, 18, 19, 3, 3, true);
    banner(g, 27, 4, 7, 3);
    g.r(26, 21, 1, 8, R.wood[1]).r(24, 22, 5, 1, R.wood[2]).ellipse(26, 19, 1.5, 1.5, R.straw[2]);
    return finish(g, 16, 29, 15);
  },
  brewery(g) {
    wall(g, 2, 15, 20, 14, R.cream, 'timber');
    roof(g, 1, 6, 22, 9, R.brown);
    door(g, 9, 21, 4, 8); win(g, 4, 19, 3, 3, true); win(g, 16, 19, 3, 3, true);
    barrel(g, 23, 24); barrel(g, 27, 24); barrel(g, 25, 19);
    g.r(14, 11, 4, 4, R.gold[2]).r(14, 11, 4, 1, R.white[3]).p(18, 12, R.gold[1]).p(18, 13, R.gold[1]);
    return finish(g, 16, 29, 15);
  },
  lumber_camp(g) {
    for (const [y, n, ox] of [[23, 4, 2], [19, 3, 4], [15, 2, 6]]) for (let i = 0; i < n; i++) {
      const x = ox + i * 5; g.r(x, y, 5, 5, R.wood[2]).r(x, y, 5, 1, R.wood[3]).ellipse(x + 2, y + 2, 1.5, 1.5, R.straw[3]).p(x + 2, y + 2, R.wood[2]);
    }
    g.r(23, 23, 6, 5, R.wood[2]).r(23, 23, 6, 1, R.straw[3]).r(23, 24, 1, 4, R.wood[3]);
    g.line(25, 22, 27, 15, R.wood[1]).r(26, 14, 3, 3, R.steel[2]).p(28, 14, R.steel[4]);
    return finish(g, 16, 29, 14);
  },
  mine(g) {
    dome(g, 16, 29, 14, 15, R.stone, { clipBottom: 29 });
    g.over((x, y) => (x * 7 + y * 5) % 13 === 0, R.stone[1]);
    g.r(10, 15, 12, 14, R.ink[1]);
    g.r(9, 14, 14, 2, R.wood[2]).r(9, 14, 14, 1, R.wood[3]).r(9, 14, 2, 15, R.wood[2]).r(21, 14, 2, 15, R.wood[1]);
    g.r(11, 27, 10, 1, R.steel[1]).r(11, 28, 10, 1, R.wood[1]);
    g.r(13, 22, 6, 4, R.steel[2]).r(13, 22, 6, 1, R.steel[3]).p(14, 21, R.gold[3]).p(16, 21, R.gold[2]).p(17, 21, R.stone[3]);
    g.p(10, 18, R.fire[3]).p(21, 18, R.fire[3]);
    return finish(g, 16, 29, 15);
  },
  quarry(g) {
    const st = R.stone;
    g.r(2, 19, 28, 10, st[1]).r(2, 19, 28, 1, st[3]);
    g.r(5, 13, 22, 6, st[2]).r(5, 13, 22, 1, st[4]);
    g.r(9, 8, 14, 5, st[3]).r(9, 8, 14, 1, st[4]);
    g.over((x, y) => y > 8 && (x + y * 3) % 9 === 0, st[0]);
    for (const [x, y] of [[4, 24], [11, 25], [22, 23]]) g.r(x, y, 5, 4, st[3]).r(x, y, 5, 1, st[4]).r(x + 4, y, 1, 4, st[1]);
    g.line(19, 26, 24, 20, R.wood[2]).r(23, 19, 3, 2, R.steel[2]);
    return finish(g, 16, 29, 15);
  },
  port(g) {
    g.r(0, 22, 32, 8, R.water[2]).r(0, 22, 32, 1, R.water[3]);
    for (let x = 2; x < 32; x += 6) g.p(x, 25, R.water[4]).p(x + 3, 28, R.water[3]);
    g.r(16, 14, 16, 4, R.wood[2]).r(16, 14, 16, 1, R.wood[3]);
    for (let x = 17; x < 32; x += 2) g.p(x, 15, R.wood[1]);
    for (const x of [17, 23, 29]) g.r(x, 18, 2, 10, R.wood[0]);
    g.r(3, 21, 11, 4, R.wood[2]).r(3, 21, 11, 1, R.wood[3]).r(4, 25, 9, 1, R.wood[1]);
    g.r(8, 6, 1, 15, R.wood[0]).r(4, 8, 4, 10, R.cream[3]).r(4, 8, 1, 10, R.white[3]).r(9, 9, 3, 8, R.cream[2]);
    banner(g, 8, 4, 2, 3);
    g.r(26, 3, 2, 11, R.wood[1]).r(20, 3, 8, 2, R.wood[2]).line(21, 5, 21, 10, R.ink[2]); crate(g, 19, 10, 4);
    return finish(g, 16, 29, 15, 1);
  },
  walls_tower(g) {
    wall(g, 8, 8, 16, 21, R.stone, 'stone');
    for (let x = 7; x < 25; x += 4) g.r(x, 4, 3, 4, R.stone[3]).r(x, 4, 3, 1, R.stone[4]);
    g.r(7, 7, 18, 2, R.stone[3]);
    win(g, 15, 13, 2, 4, true); win(g, 15, 21, 2, 3, false);
    banner(g, 22, 0, 5, 3);
    return finish(g, 16, 29, 10);
  },
  bank(g) {
    g.r(3, 26, 26, 3, R.white[2]).r(3, 26, 26, 1, R.white[3]);
    g.r(5, 13, 22, 13, R.cream[3]);
    for (const x of [6, 11, 19, 24]) column(g, x, 13, 13);
    door(g, 14, 18, 4, 8, R.wood);
    tri(g, 16, 5, 8, 13, R.white, { seams: false }); g.r(3, 12, 26, 1, R.white[1]);
    g.ellipse(16, 9, 2, 2, R.gold[2]).p(15, 8, R.gold[3]);
    return finish(g, 16, 29, 14);
  },
  hospital(g) {
    wall(g, 3, 13, 26, 16, R.white, 'plain');
    roof(g, 2, 6, 28, 7, R.steel);
    g.r(13, 15, 6, 2, R.red[2]).r(15, 13, 2, 6, R.red[2]);
    for (const x of [5, 23]) { win(g, x, 16, 3, 3, true); win(g, x, 22, 3, 3, true); }
    door(g, 14, 22, 4, 7, R.blue);
    return finish(g, 16, 29, 15);
  },
  observatory(g) {
    wall(g, 6, 17, 20, 12, R.stone, 'stone');
    dome(g, 16, 17, 10, 10, R.steel, { clipBottom: 17 });
    g.r(15, 8, 2, 9, R.ink[2]);
    g.line(17, 10, 26, 3, R.gold[2]).line(18, 11, 27, 4, R.gold[1]).r(26, 2, 3, 2, R.gold[3]);
    door(g, 14, 22, 4, 7); win(g, 8, 21, 2, 3, true); win(g, 22, 21, 2, 3, true);
    return finish(g, 16, 29, 13);
  },
  aqueduct(g) {
    const st = R.cream;
    g.r(0, 8, 32, 6, st[2]).r(0, 8, 32, 1, st[3]).r(0, 13, 32, 1, st[1]);
    g.r(0, 6, 32, 2, R.water[3]).r(0, 6, 32, 1, R.water[4]);
    for (const x of [0, 11, 22]) { g.r(x, 14, 4, 15, st[2]).r(x, 14, 1, 15, st[3]).r(x + 3, 14, 1, 15, st[1]); }
    for (const x of [4, 15, 26]) { for (let i = 0; i < 7; i++) { const d = Math.round(Math.sqrt(Math.max(0, 9 - (i - 3) ** 2))); g.r(x + i, 14, 1, 3 - d + 1, st[2]); } }
    g.over((x, y) => y > 8 && y < 29 && (x + y * 2) % 7 === 0, st[1]);
    return finish(g, 16, 29, 15, 1);
  },
  textile_mill(g) {
    smokestack(g, 24, 2, 13);
    wall(g, 2, 15, 28, 14, BRICK, 'brick');
    sawtooth(g, 2, 9, 28, R.steel);
    for (let x = 5; x < 28; x += 6) win(g, x, 19, 3, 4, true);
    g.r(13, 25, 6, 4, R.ink[1]);
    for (const [x, c] of [[3, R.red], [7, R.blue], [22, R.gold]]) g.r(x, 26, 3, 3, c[2]).r(x, 26, 3, 1, c[3]);
    return finish(g, 16, 29, 15);
  },
  foundry(g) {
    smokestack(g, 5, 1, 14); smokestack(g, 23, 3, 12);
    wall(g, 2, 14, 28, 15, BRICK, 'brick');
    roof(g, 1, 10, 30, 4, R.steel, { inset: 1 });
    g.r(11, 19, 10, 10, R.ink[1]).r(12, 21, 8, 8, R.fire[2]).r(13, 23, 6, 6, R.fire[3]).r(14, 25, 4, 4, R.fire[4]);
    win(g, 4, 18, 3, 3, true); win(g, 25, 18, 3, 3, true);
    return finish(g, 16, 29, 15);
  },
  factory(g) {
    smokestack(g, 4, 0, 14); smokestack(g, 11, 2, 12);
    wall(g, 2, 14, 28, 15, BRICK, 'brick');
    sawtooth(g, 14, 8, 16, R.steel);
    for (let x = 4; x < 28; x += 5) win(g, x, 18, 2, 4, true);
    g.r(20, 23, 8, 6, R.steel[1]).r(20, 23, 8, 1, R.steel[3]);
    for (let y = 24; y < 29; y += 2) g.r(20, y, 8, 1, R.steel[2]);
    return finish(g, 16, 29, 15);
  },
  power_plant(g) {
    g.r(19, 3, 9, 26, R.stone[2]).r(19, 3, 2, 26, R.stone[3]).r(26, 3, 2, 26, R.stone[1]);
    for (const y of [6, 12]) g.r(19, y, 9, 2, R.red[2]);
    g.r(18, 2, 11, 1, R.stone[3]);
    wall(g, 2, 14, 18, 15, BRICK, 'brick');
    roof(g, 1, 10, 20, 4, R.steel, { inset: 1 });
    g.line(5, 17, 8, 21, R.gold[3]).line(8, 21, 6, 21, R.gold[3]).line(6, 21, 9, 26, R.gold[3]);
    win(g, 12, 18, 3, 4, true);
    return finish(g, 16, 29, 15);
  },
  newspaper(g) {
    wall(g, 3, 13, 26, 16, BRICK, 'brick');
    roof(g, 2, 6, 28, 7, R.steel);
    g.r(6, 14, 20, 5, R.cream[3]).r(6, 14, 20, 1, R.white[3]);
    for (let x = 8; x < 25; x += 2) g.p(x, 16, R.ink[2]);
    g.r(8, 17, 6, 1, R.ink[2]).r(16, 17, 8, 1, R.ink[3]);
    door(g, 14, 22, 4, 7); win(g, 6, 22, 3, 3, true); win(g, 23, 22, 3, 3, true);
    g.r(25, 26, 5, 3, R.white[3]).r(25, 26, 5, 1, R.white[2]).r(26, 24, 4, 2, R.cream[3]);
    return finish(g, 16, 29, 15);
  },
  railway_station(g) {
    wall(g, 3, 9, 26, 12, BRICK, 'brick');
    roof(g, 2, 3, 28, 6, R.steel);
    g.ellipse(16, 6, 2.5, 2.5, R.white[3]).line(16, 6, 16, 4, R.ink[2]).line(16, 6, 17, 6, R.ink[2]);
    for (const x of [6, 12, 19, 25]) win(g, x, 12, 2, 4, true);
    g.r(0, 22, 32, 2, R.stone[2]).r(0, 22, 32, 1, R.stone[3]);
    g.r(0, 27, 32, 1, R.steel[2]).r(0, 25, 32, 1, R.steel[2]);
    for (let x = 1; x < 32; x += 3) g.r(x, 24, 1, 5, R.wood[1]);
    g.r(4, 20, 12, 5, R.ink[2]).r(4, 20, 12, 1, R.steel[2]).r(12, 16, 3, 4, R.ink[2]).r(5, 17, 4, 3, R.red[2]).p(15, 22, R.fire[3]);
    return finish(g, 16, 29, 15, 1);
  },
};

export function campfire() {
  const g = blank();
  for (const [x, y] of [[9, 24], [21, 24], [15, 27], [8, 27], [22, 27], [12, 28], [19, 28]]) g.r(x, y, 3, 2, R.stone[2]).p(x, y, R.stone[3]);
  g.line(10, 26, 21, 22, R.wood[1]).line(10, 22, 21, 26, R.wood[2]);
  g.r(13, 17, 6, 7, R.fire[1]).r(14, 15, 4, 8, R.fire[2]).r(15, 13, 2, 9, R.fire[3]).r(15, 19, 2, 3, R.fire[4]).p(16, 11, R.fire[3]);
  return finish(g, 16, 27, 9);
}

// ---------------- big buildings (64×64) ----------------
export const BIG = {
  town_hall(g) {
    wall(g, 6, 30, 52, 27, R.cream, 'timber');
    roof(g, 3, 12, 58, 18, R.red);
    wall(g, 24, 16, 16, 14, R.cream, 'timber');
    tri(g, 32, 4, 13, 10, R.red); g.r(31, 0, 2, 4, R.gold[2]).p(31, 0, R.gold[3]);
    win(g, 29, 20, 6, 6, true);
    door(g, 28, 44, 8, 13, R.wood);
    for (const x of [11, 19, 41, 49]) { win(g, x, 35, 4, 5, true); win(g, x, 46, 4, 5, true); }
    banner(g, 7, 13, 10, 5); banner(g, 51, 13, 10, 5);
    g.r(24, 57, 16, 2, R.stone[3]).r(26, 59, 12, 1, R.stone[2]);
    flowers(g, 8, 55, 8); flowers(g, 48, 55, 8);
    return finish(g, 32, 59, 28, 3);
  },
  castle(g) {
    const st = R.stone;
    wall(g, 6, 28, 52, 30, st, 'stone');
    for (let x = 5; x < 59; x += 5) g.r(x, 24, 3, 4, st[3]).r(x, 24, 3, 1, st[4]);
    g.r(5, 27, 54, 2, st[3]);
    for (const tx of [1, 47]) { wall(g, tx, 14, 16, 44, st, 'stone'); cone(g, tx + 8, 2, 13, 9, R.blue); win(g, tx + 6, 22, 3, 5, true); win(g, tx + 6, 36, 3, 5, true); }
    wall(g, 22, 10, 20, 24, st, 'stone');
    for (let x = 21; x < 43; x += 5) g.r(x, 6, 3, 4, st[3]).r(x, 6, 3, 1, st[4]);
    win(g, 26, 16, 3, 5, true); win(g, 35, 16, 3, 5, true);
    g.r(25, 40, 14, 18, R.ink[1]); for (let x = 26; x < 39; x += 3) g.r(x, 41, 1, 17, R.steel[1]); for (let y = 43; y < 58; y += 4) g.r(25, y, 14, 1, R.steel[1]);
    g.r(24, 38, 16, 2, st[3]);
    banner(g, 31, 0, 6, 5);
    banner(g, 10, 30, 9, 4); banner(g, 49, 30, 9, 4);
    return finish(g, 32, 59, 30, 3);
  },
  star_fort(g) {
    const st = R.stone, grass = R.leaf;
    const pts = [[32, 4], [60, 22], [52, 58], [12, 58], [4, 22]];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      let inside = false;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xi, yi] = pts[a], [xj, yj] = pts[b]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) g.p(x, y, y < 18 ? st[3] : st[2]);
    }
    g.outline(st[1]);
    const inner = [[32, 12], [52, 25], [46, 52], [18, 52], [12, 25]];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      let inside = false;
      for (let a = 0, b = inner.length - 1; a < inner.length; b = a++) { const [xi, yi] = inner[a], [xj, yj] = inner[b]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) g.p(x, y, (x * 3 + y * 5) % 11 === 0 ? grass[3] : grass[2]);
    }
    wall(g, 24, 24, 16, 18, st, 'stone'); g.r(23, 22, 18, 2, st[4]);
    for (let x = 23; x < 41; x += 4) g.r(x, 20, 2, 2, st[3]);
    door(g, 30, 34, 4, 8); win(g, 26, 27, 2, 3, true); win(g, 36, 27, 2, 3, true);
    for (const [x, y] of [[14, 26], [47, 26], [20, 50], [41, 50], [31, 13]]) g.r(x, y, 4, 2, R.ink[2]).p(x + 3, y, R.steel[2]);
    banner(g, 31, 8, 6, 5);
    return finish(g, 32, 59, 28, 3);
  },
  university(g) {
    g.r(4, 54, 56, 4, R.cream[2]).r(4, 54, 56, 1, R.cream[3]);
    wall(g, 6, 26, 52, 28, R.cream, 'stone');
    g.r(4, 22, 56, 4, R.cream[3]).r(4, 25, 56, 1, R.cream[1]);
    for (let x = 10; x < 56; x += 8) column(g, x, 26, 28);
    dome(g, 32, 22, 14, 16, R.blue, { clipBottom: 21 }); g.r(17, 21, 30, 1, R.blue[0]);
    g.r(31, 2, 2, 5, R.gold[2]).p(31, 2, R.gold[3]);
    door(g, 28, 40, 8, 14, R.wood);
    for (const x of [14, 46]) win(g, x, 32, 4, 8, true);
    banner(g, 56, 6, 8, 4);
    return finish(g, 32, 59, 28, 3);
  },
};

// ---------------- windmill (32×48, sails turning) ----------------
export function windmillFrame(k) {
  const g = new Pix(32, 48);
  for (let y = 18; y < 46; y++) { const hw = Math.round(5 + (y - 18) * 0.18); g.r(16 - hw, y, hw * 2, 1, R.cream[2]); g.p(16 - hw, y, R.cream[3]); g.p(16 + hw - 1, y, R.cream[1]); g.p(16 + hw - 2, y, R.cream[1]); }
  g.over((x, y) => y > 18 && (y % 4 === 0) && (x + y) % 3 === 0, R.cream[1]);
  cone(g, 16, 10, 10, 7, R.red);
  door(g, 14, 39, 4, 7); win(g, 15, 27, 2, 3, true);
  const a0 = (k / 4) * (Math.PI / 2) + 0.35;
  for (let b = 0; b < 4; b++) {
    const a = a0 + (b * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const ox = -sa, oy = ca;
    for (let t = 3; t <= 12; t++) {
      const x = 16 + ca * t, y = 17 + sa * t;
      g.p(x, y, R.wood[1]);
      if (t > 4) for (let s = 1; s <= 3; s++) g.p(x + ox * s, y + oy * s, (t + s) % 3 === 0 ? R.wood[2] : R.cream[3]);
    }
  }
  g.r(15, 16, 3, 3, R.wood[0]).p(16, 17, R.gold[2]);
  return finish(g, 16, 46, 9);
}

export function smallSheet(kind) { return { frames: [SMALL[kind](blank())], tags: [], layer: kind }; }
export function bigSheet(kind) { return { frames: [BIG[kind](blank(64, 64))], tags: [], layer: kind }; }
export const campfireSheet = () => ({ frames: [campfire()], tags: [], layer: 'campfire' });
export function windmillSheet() { const frames = [0, 1, 2, 3].map(windmillFrame); return { frames, tags: [['turn', 0, 3, 180]], layer: 'windmill' }; }
