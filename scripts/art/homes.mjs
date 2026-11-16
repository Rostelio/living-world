// Race homes drawn by their own code paths in the game (src/render/town16.js):
// home_treehouse (elves, 32×48), home_hillhome (dwarves on hills: turf / rocky), home_tent (orcs,
// realm-coloured band in KEY colours), home_stilt (lizardfolk) — tags tier0..tier3 — and the
// tall town houses of big cities, townhouse_<race> (32×48, tags storeys2 / storeys3, 2 variants).
import { Pix } from './pix.mjs';
import { R } from './palette.mjs';
import { wall, roof, tri, dome, door, win, chimney, banner, finish, blank, KEY } from './kit.mjs';

const hide = ['#4a3020', '#7a5636', '#a88660', '#cdb08a'];
const LEAF = [R.leaf.slice(0, 4), R.leaf.slice(1), R.leaf.slice(1), R.leaf.slice(1)];

function treehouse(t) {
  const g = new Pix(32, 48);
  g.r(12, 22, 8, 25, R.wood[2]).r(12, 22, 2, 25, R.wood[3]).r(18, 22, 2, 25, R.wood[1]);
  g.r(9, 44, 14, 3, R.wood[1]).r(7, 46, 4, 1, R.wood[1]).r(21, 46, 4, 1, R.wood[1]).p(15, 34, R.wood[0]).p(16, 39, R.wood[0]);
  g.r(4, 29, 24, 2, R.wood[2]).r(4, 29, 24, 1, R.wood[3]);
  for (let y = 32; y < 46; y += 2) g.r(22, y, 4, 1, R.wood[2]);
  g.r(22, 31, 1, 15, R.wood[0]).r(25, 31, 1, 15, R.wood[0]);
  wall(g, 8, 18, 16, 11, R.cream, 'planks');
  win(g, 10, 21, 3, 3, t >= 2); win(g, 19, 21, 3, 3, t >= 2);
  door(g, 14, 23, 4, 6, R.green);
  const leaf = LEAF[t];
  dome(g, 16, 11, 15, 10, leaf, { clipBottom: 18 });
  g.over((x, y) => y <= 18 && (x * 5 + y * 3) % 9 === 0, leaf[3]);
  g.over((x, y) => y <= 18 && y > 14 && (x * 3 + y) % 5 === 0, leaf[0]);
  if (t >= 1) for (const [x, y] of [[8, 9], [22, 6], [15, 4]]) g.p(x, y, R.pink[3]);
  if (t >= 3) for (const [x, y] of [[5, 13], [26, 12], [12, 2], [20, 3]]) g.p(x, y, R.gold[4] || R.fire[4]);
  return finish(g, 16, 46, 8);
}

function hillhome(t, rocky) {
  const g = blank();
  const turf = rocky ? R.stone : R.leaf.slice(1);
  if (t >= 1) chimney(g, 22, 4, 8);
  dome(g, 16, 28, 15, 13, turf, { clipBottom: 28 });
  g.over((x, y) => (x * 5 + y * 7) % 13 === 0, rocky ? R.stone[1] : turf[3]);
  g.r(10, 18, 12, 11, R.stone[1]).r(10, 18, 12, 2, R.stone[3]).r(10, 18, 1, 11, R.stone[3]);
  g.r(12, 20, 8, 9, t >= 2 ? R.steel[2] : R.wood[2]).r(12, 20, 1, 9, t >= 2 ? R.steel[3] : R.wood[3]).r(16, 20, 1, 9, t >= 2 ? R.steel[1] : R.wood[1]);
  g.r(12, 20, 8, 1, R.gold[2]).p(18, 24, R.gold[3]);
  if (t >= 2) { win(g, 4, 22, 3, 3, true); win(g, 25, 22, 3, 3, true); }
  if (t >= 3) g.r(9, 16, 14, 1, R.gold[2]).p(16, 15, R.water[4]).p(15, 15, R.water[3]);
  return finish(g, 16, 29, 15);
}

function tent(t) {
  const g = blank();
  const h = t >= 2 ? R.wood : hide;
  tri(g, 16, 6, 23, t >= 2 ? 14 : 12, h);
  g.r(14, 20, 4, 9, R.ink[1]).r(15, 19, 2, 1, R.ink[1]);
  g.line(12, 1, 15, 8, R.cream[3]).line(20, 1, 17, 8, R.cream[3]);
  if (t >= 1) { for (let x = 6; x < 27; x++) if (Math.abs(x - 16) < 2 + (t >= 2 ? 11 : 9) * 0.6) g.p(x, 18, KEY[2]); g.r(14, 18, 4, 1, R.ink[1]); g.line(3, 25, 5, 29, R.cream[3]).line(29, 25, 27, 29, R.cream[3]); }
  for (let x = 6; x < 27; x += 4) g.p(x + (x % 3), 23, h[1]);
  if (t >= 3) banner(g, 26, 2, 6, 3);
  return finish(g, 16, 29, 13);
}

function stilt(t) {
  const g = blank();
  g.r(7, 20, 2, 10, R.wood[0]).r(23, 20, 2, 10, R.wood[0]).r(15, 21, 2, 9, R.wood[0]);
  g.r(3, 19, 26, 2, R.wood[2]).r(3, 19, 26, 1, R.wood[3]);
  wall(g, 7, 12, 18, 7, t >= 2 ? R.teal : R.wood, 'planks');
  tri(g, 16, 0, 13, 14, R.straw);
  for (let x = 3; x < 30; x += 2) g.p(x, 12, R.straw[1]);
  g.r(14, 14, 4, 5, R.ink[1]);
  if (t >= 1) win(g, 9, 14, 2, 2, true);
  if (t >= 2) win(g, 21, 14, 2, 2, true);
  if (t >= 3) g.r(15, 0, 2, 2, R.gold[3]).p(16, 3, R.gold[2]);
  return finish(g, 16, 29, 13);
}

const TALL = {
  humans: { wall: R.cream, roof: [R.red, R.brown], style: 'timber' },
  halflings: { wall: R.cream, roof: [R.green, R.leaf.slice(1)], style: 'plain' },
  dwarves: { wall: R.stone, roof: [R.steel, R.stone], style: 'stone' },
  orcs: { wall: R.wood, roof: [hide, R.brown], style: 'planks' },
  elves: { wall: R.cream, roof: [R.teal, R.green], style: 'planks' },
  lizardfolk: { wall: R.straw, roof: [R.green, R.teal], style: 'planks' },
};
function townhouse(race, storeys, v) {
  const T = TALL[race], g = new Pix(32, 48);
  const top = 46 - storeys * 11;
  chimney(g, 20, top - 13, 8);
  wall(g, 7, top, 18, 47 - top, T.wall, T.style);
  for (let k = 0; k < storeys; k++) {
    const y = top + k * 11;
    g.r(7, y, 18, 1, R.wood[0]);
    const lit = (k + v) % 2 === 0;
    win(g, 10, y + 3, 3, 4, lit); win(g, 19, y + 3, 3, 4, !lit || k === 0);
    if (k < storeys - 1) g.r(9, y + 8, 5, 1, R.wood[1]).r(18, y + 8, 5, 1, R.wood[1]);
  }
  door(g, 14, 40, 4, 7);
  tri(g, 16, top - 13, 13, 11, T.roof[v]);
  return finish(g, 16, 46, 9);
}

const tiers = (fn) => { const frames = [], tags = []; for (let t = 0; t < 4; t++) { const s = frames.length; frames.push(...fn(t)); tags.push(['tier' + t, s, frames.length - 1, 1000]); } return { frames, tags }; };
export const treehouseSheet = () => ({ ...tiers((t) => [treehouse(t)]), layer: 'treehouse' });
export const hillhomeSheet = () => ({ ...tiers((t) => [hillhome(t, false), hillhome(t, true)]), layer: 'hillhome' });
export const tentSheet = () => ({ ...tiers((t) => [tent(t)]), layer: 'tent' });
export const stiltSheet = () => ({ ...tiers((t) => [stilt(t)]), layer: 'stilt' });
export function townhouseSheet(race) {
  const frames = [townhouse(race, 2, 0), townhouse(race, 2, 1), townhouse(race, 3, 0), townhouse(race, 3, 1)];
  return { frames, tags: [['storeys2', 0, 1, 1000], ['storeys3', 2, 3, 1000]], layer: 'townhouse' };
}
