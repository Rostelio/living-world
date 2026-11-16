// Town ground on the tile grid (src/render/town16.js, buildings16.js field16), 32×32 per tile:
// road_<style> (tags road / street, 16 frames = neighbour mask N1 E2 S4 W8), yard (grass / snow,
// 3 variants), plaza_<kind>, bridge (wood / stone: vertical, horizontal), wall_<stone|palisade>
// (whole / broken: vertical, horizontal; the game centres them on tile edges), wall_tower and
// wall_gate (stone / palisade), fence (16 masks), field (stage0..stage5 × 3 soils), prop_<kind> 16×16.
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------- roads ----------------
const ROAD = [
  { fill: R.soil[3], dark: R.soil[2], edge: R.soil[1], hi: '#c8a474' },              // dirt
  { fill: R.stone[3], dark: R.stone[2], edge: R.stone[1], hi: R.stone[4] },          // cobble
  { fill: '#a8a29a', dark: '#8a847c', edge: R.stone[1], hi: '#c4beb4' },             // paved
];
function road(mask, style, half) {
  const g = new Pix(32, 32), C = ROAD[style];
  const a = 16 - half, b = 16 + half;
  const rects = [[a, a, b - a, b - a]];
  if (mask & 1) rects.push([a, 0, b - a, a]);
  if (mask & 2) rects.push([b, a, 32 - b, b - a]);
  if (mask & 4) rects.push([a, b, b - a, 32 - b]);
  if (mask & 8) rects.push([0, a, a, b - a]);
  const inRoad = (x, y) => rects.some(([rx, ry, w, h]) => x >= rx && y >= ry && x < rx + w && y < ry + h);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inRoad(x, y)) continue;
    let c = C.fill;
    if (style === 0) { const n = rnd(x, y, 5); c = n < 0.08 ? C.dark : n > 0.95 ? C.hi : C.fill; const lane = Math.abs((mask & 5 ? x : y) - 16); if (lane === half - 2 && rnd(x >> 1, y >> 1, 9) < 0.7) c = C.dark; }
    if (style === 1) { const row = y >> 2, cx = (x + (row % 2) * 2) % 4, cy = y % 4; c = cx === 3 || cy === 3 ? C.dark : cx === 0 && cy === 0 ? C.hi : C.fill; }
    if (style === 2) { const cy = y % 8, cx = (x + ((y >> 3) % 2) * 4) % 8; c = cy === 7 || cx === 7 ? C.dark : C.fill; }
    g.p(x, y, c);
  }
  // a soft edge one pixel outside the road (packed earth / kerb), not on tile borders the road crosses
  const edge = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (!inRoad(x, y) && (inRoad(x + 1, y) || inRoad(x - 1, y) || inRoad(x, y + 1) || inRoad(x, y - 1))) edge.push([x, y]);
  for (const [x, y] of edge) g.p(x, y, style === 0 ? (rnd(x, y, 3) < 0.5 ? C.edge : null) || C.dark : C.edge);
  return g;
}

// ---------------- yard ----------------
function yard(v, snow) {
  const g = new Pix(32, 32);
  const r = snow ? ['#a8b8d0', '#c8d4e4', '#e2eaf4', '#ffffff'] : ['#3a7e36', '#4f9a3c', '#62aa48', '#80c058'];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const n = rnd(x >> 1, y >> 1, 40 + v); g.p(x, y, n < 0.12 ? r[0 + 1] : n > 0.9 ? r[3] : r[2]); }
  if (!snow) for (let i = 0; i < 5; i++) { const x = 3 + Math.floor(rnd(i, v, 1) * 24), y = 3 + Math.floor(rnd(v, i, 2) * 24); g.ellipse(x, y, 2.5, 1.5, R.soil[3]); g.p(x - 1, y, R.soil[2]); }
  if (!snow) for (let i = 0; i < 6; i++) { const x = 2 + Math.floor(rnd(i, v, 3) * 27), y = 3 + Math.floor(rnd(v, i, 4) * 26); g.p(x, y, r[0]).p(x, y - 1, r[3]); }
  return g;
}

// ---------------- plaza ----------------
function plaza(kind) {
  const g = new Pix(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const row = y >> 3, cx = (x + (row % 2) * 4) % 8, cy = y % 8;
    g.p(x, y, cy === 7 || cx === 7 ? R.stone[2] : cy === 0 || cx === 0 ? R.cream[2] : (rnd(x >> 3, y >> 3, 7) < 0.3 ? R.stone[3] : R.cream[1]));
  }
  if (kind === 'well') {
    const w = new Pix(32, 32);
    w.ellipse(16, 18, 7, 5, R.stone[2]); w.ellipse(16, 17, 5, 3, R.water[1]); w.r(13, 15, 5, 1, R.water[3]);
    w.r(8, 6, 2, 13, R.wood[1]).r(22, 6, 2, 13, R.wood[1]).r(7, 4, 18, 3, R.red[1]).r(7, 4, 18, 1, R.red[2]).line(16, 7, 16, 14, R.ink[2]).r(15, 13, 3, 2, R.wood[2]);
    w.outline(INK); g.draw(w);
  }
  if (kind === 'fountain') {
    const w = new Pix(32, 32);
    w.ellipse(16, 18, 12, 8, R.stone[3]); w.ellipse(16, 18, 10, 6, R.water[2]); w.ellipse(14, 16, 6, 3, R.water[3]);
    w.r(14, 8, 4, 10, R.stone[3]).r(14, 8, 1, 10, R.stone[4]).r(17, 8, 1, 10, R.stone[1]).ellipse(16, 8, 3, 1.5, R.stone[3]);
    w.r(15, 3, 2, 5, R.water[4]).p(13, 5, R.water[4]).p(18, 5, R.water[4]).p(12, 7, R.water[3]).p(19, 7, R.water[3]);
    w.outline(INK); g.draw(w);
  }
  return g;
}

// ---------------- bridge ----------------
function bridge(horiz, stone) {
  const g = new Pix(32, 32);
  const deck = stone ? R.stone : R.wood, rail = stone ? R.stone[1] : R.wood[0];
  if (horiz) {
    g.r(0, 12, 32, 10, deck[2]).r(0, 12, 32, 2, deck[3]).r(0, 21, 32, 1, deck[0]);
    for (let x = 2; x < 32; x += stone ? 8 : 4) g.r(x, 14, 1, 7, deck[1]);
    g.r(0, 10, 32, 2, rail).r(0, 22, 32, 2, rail);
    for (let x = 2; x < 32; x += 10) g.r(x, 8, 2, 3, rail).r(x, 24, 2, 4, stone ? R.stone[1] : R.wood[0]);
  } else {
    g.r(11, 0, 10, 32, deck[2]).r(11, 0, 2, 32, deck[3]).r(19, 0, 2, 32, deck[1]);
    for (let y = 2; y < 32; y += stone ? 8 : 4) g.r(13, y, 6, 1, deck[1]);
    g.r(9, 0, 2, 32, rail).r(21, 0, 2, 32, rail);
  }
  return g;
}

// ---------------- walls ----------------
function wall(hz, palisade, broken) {
  const g = new Pix(32, 32);
  if (palisade) {
    for (let i = 0; i < 32; i += 4) {
      if (broken && i > 8 && i < 22) continue;
      if (hz) g.r(i, 8, 3, 11, R.wood[2]).r(i, 8, 1, 11, R.wood[3]).r(i + 2, 8, 1, 11, R.wood[1]).p(i + 1, 7, R.wood[3]).r(i, 15, 4, 1, R.wood[0]);
      else g.r(13, i, 6, 3, R.wood[2]).r(13, i, 6, 1, R.wood[3]).r(13, i + 2, 6, 1, R.wood[1]);
    }
  } else if (hz) {
    g.r(0, 11, 32, 7, R.stone[2]).r(0, 11, 32, 1, R.stone[4]).r(0, 17, 32, 1, R.stone[1]);
    for (let y = 13; y < 17; y += 2) for (let x = (y % 4 ? 0 : 2); x < 32; x += 5) g.p(x, y, R.stone[1]);
    for (let x = 0; x < 32; x += 5) g.r(x, 8, 3, 3, R.stone[3]).r(x, 8, 3, 1, R.stone[4]);
    if (broken) for (let y = 7; y < 19; y++) for (let x = 10; x < 22; x++) if (rnd(x, y) < 0.8 || y < 14) g.clear(x, y);
    if (broken) g.r(9, 17, 3, 2, R.stone[2]).r(20, 16, 2, 2, R.stone[3]);
  } else {
    g.r(13, 0, 6, 32, R.stone[2]).r(13, 0, 1, 32, R.stone[4]).r(18, 0, 1, 32, R.stone[1]);
    for (let y = 2; y < 32; y += 4) g.r(14, y, 4, 1, R.stone[1]);
    if (broken) for (let y = 10; y < 22; y++) for (let x = 12; x < 20; x++) if (rnd(x, y) < 0.85) g.clear(x, y);
  }
  g.outline(INK);
  return g;
}
function tower(palisade) {
  const g = new Pix(32, 32), m = palisade ? R.wood : R.stone;
  g.r(10, 8, 12, 18, m[2]).r(10, 8, 2, 18, m[3]).r(20, 8, 2, 18, m[1]);
  g.r(8, 5, 16, 4, m[3]).r(8, 5, 16, 1, m[palisade ? 3 : 4]);
  for (let x = 8; x < 24; x += 4) g.r(x, 3, 2, 2, m[3]);
  g.r(14, 13, 4, 5, R.ink[1]).p(15, 14, R.fire[3]);
  if (!palisade) for (let y = 11; y < 25; y += 3) g.p(12 + (y % 2) * 6, y, m[1]);
  g.r(10, 25, 12, 1, m[0]);
  g.outline(INK);
  return g;
}
function gate(hz, palisade) {
  const g = new Pix(32, 32), m = palisade ? R.wood : R.stone;
  if (hz) {
    for (const x of [2, 23]) g.r(x, 6, 7, 14, m[2]).r(x, 6, 2, 14, m[3]).r(x, 4, 7, 2, m[3]);
    g.r(9, 8, 14, 3, m[3]).r(9, 8, 14, 1, m[palisade ? 3 : 4]);
    g.r(10, 11, 12, 7, R.wood[1]); for (let x = 11; x < 22; x += 3) g.r(x, 11, 1, 7, R.wood[0]);
  } else {
    for (const y of [2, 23]) g.r(11, y, 10, 7, m[2]).r(11, y, 10, 2, m[3]);
    g.r(13, 9, 6, 14, R.wood[1]); for (let y = 10; y < 23; y += 3) g.r(13, y, 6, 1, R.wood[0]);
  }
  g.outline(INK);
  return g;
}
function fence(mask) {
  const g = new Pix(32, 32);
  const rail = R.wood[2], post = R.wood[0];
  if (mask & 1) { g.r(0, 1, 32, 2, rail).r(0, 1, 32, 1, R.wood[3]); for (let x = 0; x < 32; x += 8) g.r(x, 0, 2, 5, post); }
  if (mask & 4) { g.r(0, 29, 32, 2, rail).r(0, 29, 32, 1, R.wood[3]); for (let x = 0; x < 32; x += 8) g.r(x, 27, 2, 5, post); }
  if (mask & 8) { g.r(1, 0, 2, 32, rail); for (let y = 0; y < 32; y += 8) g.r(0, y, 4, 2, post); }
  if (mask & 2) { g.r(29, 0, 2, 32, rail); for (let y = 0; y < 32; y += 8) g.r(28, y, 4, 2, post); }
  return g;
}

// ---------------- fields ----------------
// stage: 0 bare (tilled), 1 sprouts, 2 green, 3 ripe, 4 harvested (sheaves), 5 snow
function field(v, stage) {
  const g = new Pix(32, 32);
  const soil = [R.soil, ['#3e2818', '#62422a', '#8a6440', '#b08a5c'], ['#36241a', '#5a3e2a', '#7e5a3c', '#a47c52']][v % 3];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) g.p(x, y, y % 4 === 3 ? soil[1] : y % 4 === 0 ? soil[3] : soil[2]);
  const rows = (fn) => { for (let y = 1; y < 32; y += 4) for (let x = ((y >> 2) % 2) * 2 + 1; x < 31; x += 4) fn(x, y); };
  if (stage === 1) rows((x, y) => g.p(x, y, R.leaf[4]).p(x + 1, y + 1, R.leaf[3]));
  if (stage === 2) rows((x, y) => g.r(x, y - 1, 3, 3, R.leaf[3]).p(x + 1, y - 1, R.leaf[4]).p(x + 1, y + 1, R.leaf[2]));
  if (stage === 3) rows((x, y) => g.r(x, y - 1, 3, 3, R.straw[2]).p(x + 1, y - 1, R.straw[3]).p(x, y - 1, R.gold[3]).p(x + 2, y + 1, R.straw[1]));
  if (stage === 4) { rows((x, y) => g.p(x, y, R.straw[1])); for (const [x, y] of [[8, 10], [22, 20], [12, 24]]) { g.r(x, y, 5, 6, R.straw[2]).r(x, y, 5, 1, R.straw[3]).r(x, y + 3, 5, 1, R.straw[1]); } }
  if (stage === 5) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) g.p(x, y, y % 4 === 3 ? '#a8b8d0' : rnd(x, y, 3) < 0.08 ? '#c8d4e4' : '#eef2f8');
  return g;
}

// ---------------- props (16×16) ----------------
function prop(kind) {
  const g = new Pix(16, 16);
  switch (kind) {
    case 'barrel': g.r(4, 4, 8, 10, R.wood[2]).r(4, 4, 2, 10, R.wood[3]).r(10, 4, 2, 10, R.wood[1]).r(4, 6, 8, 1, R.steel[1]).r(4, 11, 8, 1, R.steel[1]).r(5, 4, 6, 1, R.wood[3]); break;
    case 'crate': g.r(2, 6, 12, 8, R.wood[2]).r(2, 6, 12, 2, R.wood[3]).r(2, 6, 1, 8, R.wood[1]).r(13, 6, 1, 8, R.wood[1]).line(3, 8, 12, 13, R.wood[1]); break;
    case 'woodpile': for (const [x, y] of [[1, 9], [6, 9], [11, 9], [3, 5], [8, 5]]) g.r(x, y, 5, 4, R.wood[2]).ellipse(x + 2, y + 1.5, 1, 1, R.straw[3]); break;
    case 'flowers': g.r(2, 10, 12, 4, R.leaf[2]).r(2, 10, 12, 1, R.leaf[3]); [[3, 8, R.pink[2]], [6, 7, R.gold[3]], [9, 8, R.purple[3]], [12, 7, R.white[3]], [5, 10, R.red[3]]].forEach(([x, y, c]) => g.p(x, y, c).p(x - 1, y + 1, c).p(x + 1, y + 1, c).p(x, y + 1, R.gold[2])); break;
    case 'lamp': g.r(7, 4, 2, 12, R.ink[2]).r(5, 1, 6, 4, R.ink[2]).r(6, 2, 4, 3, R.fire[3]).p(7, 2, R.fire[4]).r(5, 15, 6, 1, R.ink[2]); break;
    case 'bush': g.ellipse(8, 10, 6, 4, R.leaf[2]); g.ellipse(7, 9, 4, 3, R.leaf[3]); g.p(5, 7, R.leaf[4]).p(9, 7, R.leaf[4]); break;
    case 'sack': g.ellipse(8, 10, 4.5, 4, R.cream[2]); g.r(6, 4, 4, 3, R.cream[2]).r(6, 6, 4, 1, R.wood[1]).r(5, 8, 2, 4, R.cream[3]); break;
    case 'anvil': g.r(2, 7, 12, 3, R.steel[1]).r(2, 7, 12, 1, R.steel[3]).r(1, 7, 2, 2, R.steel[1]).r(6, 10, 4, 3, R.steel[0]).r(4, 13, 8, 2, R.wood[1]); break;
    case 'rack': g.r(2, 3, 2, 12, R.wood[0]).r(12, 3, 2, 12, R.wood[0]).r(2, 5, 12, 1, R.wood[2]); g.r(4, 6, 8, 5, R.cream[3]).r(4, 6, 8, 1, R.cream[2]).p(6, 8, R.wood[1]); break;
    case 'scarecrow': g.r(7, 6, 2, 10, R.wood[1]).r(2, 7, 12, 2, R.wood[2]).r(6, 3, 4, 4, R.straw[3]).r(5, 2, 6, 2, R.straw[1]).r(6, 8, 4, 5, R.purple[2]).p(7, 4, INK).p(9, 4, INK).p(2, 9, R.straw[3]).p(13, 9, R.straw[3]); break;
  }
  g.outline(INK);
  return g;
}

// ---------------- sheets ----------------
const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
export const TOWN = {};
['dirt', 'stone', 'paved'].forEach((name, style) => {
  TOWN['road_' + name] = () => ({ frames: [...range(16, (m) => road(m, style, 4)), ...range(16, (m) => road(m, style, 6))], tags: [['road', 0, 15, 1000], ['street', 16, 31, 1000]], cols: 16 });
});
TOWN.yard = () => ({ frames: [...range(3, (v) => yard(v, false)), ...range(3, (v) => yard(v, true))], tags: [['grass', 0, 2, 1000], ['snow', 3, 5, 1000]] });
for (const k of ['plain', 'well', 'fountain']) TOWN['plaza_' + k] = () => ({ frames: [plaza(k)], tags: [] });
TOWN.bridge = () => ({ frames: [bridge(false, false), bridge(true, false), bridge(false, true), bridge(true, true)], tags: [['wood', 0, 1, 1000], ['stone', 2, 3, 1000]] });
for (const [id, pal] of [['wall_stone', false], ['wall_palisade', true]]) TOWN[id] = () => ({ frames: [wall(false, pal, false), wall(true, pal, false), wall(false, pal, true), wall(true, pal, true)], tags: [['whole', 0, 1, 1000], ['broken', 2, 3, 1000]] });
TOWN.wall_tower = () => ({ frames: [tower(false), tower(true)], tags: [['stone', 0, 0, 1000], ['palisade', 1, 1, 1000]] });
TOWN.wall_gate = () => ({ frames: [gate(false, false), gate(true, false), gate(false, true), gate(true, true)], tags: [['stone', 0, 1, 1000], ['palisade', 2, 3, 1000]] });
TOWN.fence = () => ({ frames: range(16, fence), tags: [], cols: 16 });
TOWN.field = () => { const frames = [], tags = []; for (let s = 0; s < 6; s++) { tags.push(['stage' + s, frames.length, frames.length + 2, 1000]); for (let v = 0; v < 3; v++) frames.push(field(v, s)); } return { frames, tags, cols: 18 }; };
for (const k of ['barrel', 'crate', 'woodpile', 'flowers', 'lamp', 'bush', 'sack', 'anvil', 'rack', 'scarecrow']) TOWN['prop_' + k] = () => ({ frames: [prop(k)], tags: [] });
