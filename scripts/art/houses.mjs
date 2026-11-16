// house_<race>: ordinary homes, 32×32 (one map tile), tags tier0..tier3 with three variants
// each (v0 the race's usual roof, v1 a weathered one, v2 slate or moss) — the game picks a
// variant per house so streets match without repeating.
import { R } from './palette.mjs';
import { wall, roof, tri, dome, cone, door, win, chimney, banner, flowers, finish, blank } from './kit.mjs';

const hide = ['#4a3020', '#7a5636', '#a88660', '#cdb08a'];
const bone = R.cream[3];
const ROOFS = {
  humans: [R.red, R.brown, R.steel],
  elves: [R.teal, R.green, R.purple],
  dwarves: [R.stone, R.steel, R.wood],
  orcs: [hide, R.brown, R.soil],
  lizardfolk: [R.straw, R.ochre, R.green],
  halflings: [R.leaf.slice(1), R.green, ['#3a4a22', '#5e7a2e', '#86a83c', '#b4cc5a']],
};
const WALLS = { humans: R.cream, elves: R.cream, dwarves: R.stone, orcs: R.wood, lizardfolk: R.wood, halflings: R.stone };

const DRAW = {
  humans(g, t, rf, v) {
    if (t === 0) {
      tri(g, 16, 7, 22, 11, hide);
      g.r(14, 20, 4, 9, R.ink[2]).r(15, 19, 2, 1, R.ink[2]);
      g.line(13, 3, 16, 8, R.wood[1]).line(19, 3, 16, 8, R.wood[1]);
      g.r(5, 28, 22, 1, hide[1]);
      return finish(g, 16, 29, 13);
    }
    if (t === 1) {
      wall(g, 7, 18, 18, 11, WALLS.humans, 'timber');
      roof(g, 4, 7, 24, 11, rf);
      door(g, 14, 22, 4, 7); win(g, 9, 21, 3, 3, false); win(g, 20, 21, 3, 3, false);
      return finish(g, 16, 29, 13);
    }
    if (t === 2) {
      chimney(g, 21, 2, 7);
      wall(g, 5, 16, 22, 13, WALLS.humans, 'timber');
      roof(g, 3, 5, 26, 11, rf);
      tri(g, 16, 9, 7, 5, WALLS.humans, { seams: false }); g.line(16, 8, 10, 15, rf[0]).line(16, 8, 22, 15, rf[0]);
      win(g, 15, 12, 2, 2, true);
      door(g, 14, 21, 4, 8); win(g, 8, 20, 4, 4, true); win(g, 20, 20, 4, 4, true);
      flowers(g, 7, 26, 6); flowers(g, 19, 26, 6);
      return finish(g, 16, 29, 14);
    }
    chimney(g, 7, 0, 6);
    wall(g, 4, 13, 24, 16, R.stone, 'stone');
    roof(g, 2, 3, 28, 10, rf);
    win(g, 7, 15, 4, 4, true); win(g, 14, 15, 4, 4, true); win(g, 21, 15, 4, 4, true);
    win(g, 7, 22, 4, 4, true); win(g, 21, 22, 4, 4, true);
    door(g, 14, 22, 4, 7, R.wood); g.r(13, 29, 6, 1, R.stone[3]);
    flowers(g, 6, 27, 6);
    return finish(g, 16, 29, 15);
  },
  elves(g, t, rf, v) {
    if (t === 0) {
      dome(g, 16, 22, 11, 11, R.leaf.slice(1), { clipBottom: 28 });
      g.over((x, y) => (x * 3 + y * 5) % 7 === 0, R.leaf[4]);
      g.r(14, 22, 4, 7, R.ink[2]).r(15, 21, 2, 1, R.ink[2]);
      return finish(g, 16, 29, 12);
    }
    if (t === 1) {
      wall(g, 9, 19, 14, 10, R.cream, 'planks');
      dome(g, 16, 17, 12, 10, rf, { clipBottom: 19 });
      g.p(16, 6, R.white[3]).p(16, 5, R.leaf[4]);
      door(g, 14, 23, 4, 6, R.green); win(g, 10, 22, 2, 3, v === 0);
      return finish(g, 16, 29, 12);
    }
    if (t === 2) {
      g.r(14, 18, 5, 12, R.wood[2]).r(14, 18, 1, 12, R.wood[3]).r(18, 18, 1, 12, R.wood[1]).r(12, 28, 9, 1, R.wood[1]).p(11, 29, R.wood[1]).p(21, 29, R.wood[1]);
      g.r(6, 19, 20, 2, R.wood[2]).r(6, 19, 20, 1, R.wood[3]);
      for (let y = 21; y < 29; y += 2) g.r(22, y, 3, 1, R.wood[1]);
      g.r(22, 21, 1, 8, R.wood[0]).r(24, 21, 1, 8, R.wood[0]);
      wall(g, 9, 12, 14, 7, R.cream, 'planks');
      win(g, 11, 14, 2, 2, true); win(g, 19, 14, 2, 2, true);
      dome(g, 16, 9, 14, 7, R.leaf.slice(1), { clipBottom: 13 });
      g.over((x, y) => y < 13 && (x * 5 + y * 3) % 9 === 0, R.leaf[4]);
      g.over((x, y) => y < 13 && (x * 7 + y) % 13 === 0, rf[3]);
      return finish(g, 16, 29, 9);
    }
    wall(g, 11, 11, 10, 18, R.cream, 'stone');
    cone(g, 16, 0, 12, 7, rf);
    g.p(16, 0, R.gold[3]);
    win(g, 14, 14, 4, 4, true); g.clear(13, 13).clear(18, 13);
    door(g, 14, 23, 4, 6, R.green);
    flowers(g, 7, 27, 4); flowers(g, 22, 27, 4);
    return finish(g, 16, 29, 11);
  },
  dwarves(g, t, rf, v) {
    const st = R.stone;
    if (t === 0) {
      dome(g, 16, 28, 13, 11, st, { clipBottom: 28 });
      g.over((x, y) => (x * 7 + y * 3) % 11 === 0, st[1]);
      g.r(13, 21, 6, 8, R.ink[1]).r(13, 21, 6, 1, R.fire[2]).r(14, 22, 4, 1, R.fire[1]);
      g.r(11, 20, 10, 1, R.wood[1]).r(11, 20, 1, 9, R.wood[1]).r(20, 20, 1, 9, R.wood[1]);
      return finish(g, 16, 29, 14);
    }
    const wide = t === 3 ? 2 : t === 2 ? 3 : 5;
    const top = t === 3 ? 10 : t === 2 ? 12 : 14;
    if (t === 2) chimney(g, 23, 2, 9);
    wall(g, wide, top, 32 - wide * 2, 29 - top, st, 'stone');
    g.r(wide - 1, top - 2, 34 - wide * 2, 2, rf[3]).r(wide - 1, top - 1, 34 - wide * 2, 1, rf[2]);
    for (let x = wide - 1; x < 33 - wide; x += 4) g.r(x, top - 4, 2, 2, rf[2]).p(x, top - 4, rf[3]);
    const dw = t === 3 ? 10 : 8, dx = 16 - dw / 2, dy = t === 3 ? 16 : 20;
    g.r(dx - 1, dy - 2, dw + 2, 2, R.gold[2]).r(dx - 1, dy - 2, dw + 2, 1, R.gold[3]);
    g.r(dx, dy, dw, 29 - dy, t >= 2 ? R.steel[2] : R.wood[2]).r(dx, dy, 1, 29 - dy, t >= 2 ? R.steel[3] : R.wood[3]).r(16, dy, 1, 29 - dy, t >= 2 ? R.steel[1] : R.wood[1]);
    if (t >= 2) for (let y = dy + 1; y < 29; y += 3) g.p(dx + 1, y, R.steel[4]).p(dx + dw - 2, y, R.steel[4]);
    g.p(16, dy - 4, R.water[4]).p(15, dy - 4, R.water[3]);
    if (t >= 2) { win(g, wide + 3, top + 4, 2, 4, true); win(g, 32 - wide - 5, top + 4, 2, 4, true); }
    if (t === 3) { win(g, wide + 3, top + 12, 2, 4, true); win(g, 32 - wide - 5, top + 12, 2, 4, true); }
    return finish(g, 16, 29, 15);
  },
  orcs(g, t, rf, v) {
    if (t <= 1) {
      tri(g, 16, 6, 23, 12, rf);
      g.r(14, 20, 4, 9, R.ink[1]).r(15, 19, 2, 1, R.ink[1]);
      g.line(12, 1, 15, 8, bone).line(20, 1, 17, 8, bone);
      if (t === 1) { g.r(7, 19, 18, 1, R.red[2]); g.r(14, 19, 4, 1, R.ink[1]); g.line(3, 25, 5, 29, bone).line(29, 25, 27, 29, bone); }
      return finish(g, 16, 29, 13);
    }
    wall(g, 3, 17, 26, 12, R.wood, 'planks');
    roof(g, 1, 7, 30, 10, rf, { style: 'thatch' });
    for (let x = 4; x < 29; x += 4) g.line(x, 3, x + 1, 7, bone);
    g.r(14, 21, 4, 8, R.ink[1]);
    g.r(6, 21, 4, 2, R.fire[3]).r(22, 21, 4, 2, R.fire[3]);
    g.r(5, 20, 6, 1, R.wood[0]).r(21, 20, 6, 1, R.wood[0]);
    if (t === 3) { banner(g, 27, 2, 7, 3, R.red); g.line(2, 25, 2, 29, bone).line(30, 25, 30, 29, bone); g.r(1, 27, 30, 1, R.wood[1]); }
    return finish(g, 16, 29, 15);
  },
  lizardfolk(g, t, rf, v) {
    if (t === 0) {
      dome(g, 16, 24, 11, 10, rf, { clipBottom: 28 });
      g.over((x, y) => x % 3 === 0, rf[1]);
      g.r(14, 22, 4, 7, R.ink[1]).r(15, 21, 2, 1, R.ink[1]);
      return finish(g, 16, 29, 12);
    }
    if (t <= 2) {
      g.r(8, 21, 2, 9, R.wood[0]).r(22, 21, 2, 9, R.wood[0]).r(15, 22, 2, 8, R.wood[0]);
      g.r(5, 20, 22, 2, R.wood[2]).r(5, 20, 22, 1, R.wood[3]);
      wall(g, 8, 13, 16, 7, R.wood, 'planks');
      tri(g, 16, 1, 14, 13, rf);
      g.over((x, y) => y < 15 && x % 2 === 0 && (y % 3 !== 2), null);
      for (let x = 4; x < 29; x += 2) g.p(x, 14, rf[1]);
      g.r(14, 15, 4, 5, R.ink[1]);
      if (t === 2) { win(g, 10, 15, 2, 2, true); win(g, 20, 15, 2, 2, true); for (let y = 23; y < 30; y += 2) g.r(13, y, 6, 1, R.wood[2]); }
      return finish(g, 16, 29, 13);
    }
    const jade = R.teal;
    g.r(3, 23, 26, 6, jade[1]).r(3, 23, 26, 1, jade[2]);
    g.r(6, 17, 20, 6, jade[2]).r(6, 17, 20, 1, jade[3]);
    g.r(9, 11, 14, 6, jade[2]).r(9, 11, 14, 1, jade[3]).r(9, 11, 1, 6, jade[3]);
    g.r(12, 5, 8, 6, R.gold[2]).r(12, 5, 8, 1, R.gold[3]).r(13, 3, 6, 2, rf[2]);
    g.r(14, 7, 4, 4, R.ink[1]);
    g.r(14, 24, 4, 5, R.ink[1]);
    for (const y of [17, 23]) g.r(14, y, 4, 1, R.gold[2]);
    return finish(g, 16, 29, 14);
  },
  halflings(g, t, rf, v) {
    const rx = t === 0 ? 11 : 14, ry = t === 0 ? 11 : 14;
    if (t >= 2) chimney(g, 22, 6, 8);
    dome(g, 16, 28, rx, ry, rf, { clipBottom: 28 });
    g.over((x, y) => (x * 5 + y * 7) % 13 === 0, rf[3]);
    for (let x = 16 - rx + 2; x < 16 + rx - 1; x += 3) g.p(x, 28 - ry + Math.round(Math.abs(x - 16) * Math.abs(x - 16) / (rx * 1.6)), rf[3]);
    const dc = [R.wood, R.gold, R.blue, R.red][t];
    g.ellipse(16, 25, 4.5, 4.5, R.stone[2]);
    g.ellipse(16, 25, 3.5, 3.5, dc[2]);
    g.over((x, y) => y > 28, null);
    for (let y = 29; y < 32; y++) for (let x = 0; x < 32; x++) g.clear(x, y);
    g.r(13, 22, 1, 7, dc[3]).p(18, 25, R.gold[3]);
    if (t >= 1) win(g, 25, 22, 2, 2, true, R.wood[1]);
    if (t >= 2) win(g, 5, 22, 2, 2, true, R.wood[1]);
    if (t === 3) { flowers(g, 4, 27, 5); flowers(g, 23, 27, 5); }
    return finish(g, 16, 29, 15);
  },
};

export function houseSheet(race) {
  const frames = [], tags = [];
  for (let t = 0; t < 4; t++) {
    const s = frames.length;
    ROOFS[race].forEach((rf, v) => frames.push(DRAW[race](blank(), t, rf, v)));
    tags.push(['tier' + t, s, s + 2, 1000]);
  }
  return { frames, tags, layer: 'house', cols: 12 };
}
