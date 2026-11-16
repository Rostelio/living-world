// tile_<biome>: seamless 32×32 ground textures for each land biome, tags spring, summer, autumn,
// winter with 2 variants each. The game samples them through its wandering biome edges (GPU
// terrain and baked chunks) and adds the slope light on top, so these stay fairly flat: a base
// tone with soft patches and small details, never touching the tile edge with a detail, so any
// tile and variant joins any other.
import { Pix } from './pix.mjs';
import { R } from './palette.mjs';

const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// value noise that repeats every 32 px
function pnoise(x, y, cell, seed) {
  const n = 32 / cell, fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
  const sm = (t) => t * t * (3 - 2 * t), ux = sm(fx - ix), uy = sm(fy - iy);
  const L = (i, j) => rnd(((i % n) + n) % n, ((j % n) + n) % n, seed);
  const a = L(ix, iy), b = L(ix + 1, iy), c = L(ix, iy + 1), d = L(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ramps (darkest → lightest) per biome and season; winter without snow is a dull summer
const G = {
  grass: { spring: ['#2e6a2e', '#428c3a', '#5aa846', '#82c45a', '#b4e07a'], summer: ['#2a5e2c', '#3a7e36', '#4f9a3c', '#6fb44c', '#9cd064'], autumn: ['#5a6428', '#7a8232', '#98a03e', '#b4b452', '#d4cc6e'], winter: ['#3e5a3a', '#506e46', '#627e52', '#7a9264', '#9aae80'] },
  plains: { spring: ['#5a7a2a', '#7a9a36', '#9cb646', '#bccc5e', '#dae482'], summer: ['#6a7428', '#8a9432', '#a8b044', '#c4c85a', '#e0dc7c'], autumn: ['#7a6428', '#9c8232', '#bca244', '#d4bc5a', '#ead47c'], winter: ['#6a6a46', '#828054', '#9a9664', '#b2ac78', '#cac292'] },
  forest: { spring: ['#1e4a26', '#2a6230', '#3a7c38', '#56984a', '#80b85e'], summer: ['#1a4024', '#24562c', '#336e34', '#4a8a44', '#6aa656'], autumn: ['#4a3a1c', '#665026', '#826a30', '#a08a3e', '#c4ac56'], winter: ['#2a3e30', '#36503a', '#466244', '#5a7652', '#748c66'] },
  jungle: { spring: ['#14402a', '#1c5a32', '#26743a', '#3a904a', '#5aae5c'], summer: ['#123a26', '#1a522e', '#246c36', '#348846', '#52a458'], autumn: ['#123a26', '#1a522e', '#246c36', '#348846', '#52a458'], winter: ['#16402c', '#1e5634', '#2a6e3e', '#3c884c', '#5aa25e'] },
  taiga: { spring: ['#1e3e34', '#2a5444', '#386a52', '#4e8262', '#6e9c78'], summer: ['#1c3a32', '#284e40', '#36644e', '#4a7a5e', '#6a9474'], autumn: ['#2e3a2c', '#404e36', '#546240', '#6c7a4e', '#8a9464'], winter: ['#2e4040', '#3e5250', '#4e6460', '#647a74', '#82948c'] },
  desert: { spring: ['#a8763a', '#c49448', '#dcb064', '#ecc87e', '#f6e0a0'], summer: ['#a46e34', '#c08c42', '#d8a85c', '#eac276', '#f6dc98'], autumn: ['#a46e34', '#c08c42', '#d8a85c', '#eac276', '#f6dc98'], winter: ['#9a7240', '#b68e50', '#cca868', '#dec080', '#ecd69e'] },
  beach: { spring: ['#b8965a', '#d4b276', '#e8cc8e', '#f4e0aa', '#fcf0cc'], summer: ['#b8965a', '#d4b276', '#e8cc8e', '#f4e0aa', '#fcf0cc'], autumn: ['#b0905a', '#ccac74', '#e0c48c', '#eed8a6', '#f8eac6'], winter: ['#a8946a', '#c4ae84', '#d8c49c', '#e6d6b4', '#f2e6d0'] },
  tundra: { spring: ['#4a5a44', '#627254', '#7a8a66', '#94a07c', '#b2bc98'], summer: ['#4a5a44', '#627254', '#7a8a66', '#94a07c', '#b2bc98'], autumn: ['#5a5440', '#746c50', '#8c8462', '#a49c78', '#bcb494'], winter: ['#5a6464', '#727c7a', '#8a9490', '#a2aca6', '#bcc4be'] },
  snow: { spring: ['#8a9ab8', '#a8b8d0', '#c8d4e4', '#e2eaf4', '#ffffff'], summer: ['#8a9ab8', '#a8b8d0', '#c8d4e4', '#e2eaf4', '#ffffff'], autumn: ['#8a9ab8', '#a8b8d0', '#c8d4e4', '#e2eaf4', '#ffffff'], winter: ['#8a9ab8', '#a8b8d0', '#c8d4e4', '#e2eaf4', '#ffffff'] },
  hills: { spring: ['#3e6a2a', '#568636', '#70a244', '#90bc58', '#b8d878'], summer: ['#46642a', '#5e7e34', '#789a42', '#94b454', '#b8cc70'], autumn: ['#64602a', '#827c34', '#a09842', '#bab254', '#d4cc72'], winter: ['#4c5a3e', '#62704c', '#78865a', '#909c6e', '#acb688'] },
  mountain: { spring: ['#3e3a40', '#58525a', '#726c70', '#8e8888', '#aca6a2'], summer: ['#3e3a40', '#58525a', '#726c70', '#8e8888', '#aca6a2'], autumn: ['#423a3a', '#5c5250', '#766c66', '#92887e', '#aea498'], winter: ['#464650', '#5e5e6a', '#787a84', '#9496a0', '#b2b4bc'] },
  swamp: { spring: ['#283c26', '#36502e', '#46643a', '#5a7a48', '#76945c'], summer: ['#263a26', '#344c2e', '#445e38', '#567446', '#708c58'], autumn: ['#3a3a22', '#4e4c2a', '#625e34', '#7a7442', '#968c56'], winter: ['#2e3a32', '#3c4a3e', '#4c5a4a', '#5e6c5a', '#788470'] },
};
const FLOWERS = [R.pink[3], R.gold[3], R.white[3], R.purple[3], R.red[3]];

function texture(biome, season, v) {
  const g = new Pix(32, 32);
  const r = G[biome][season];
  const seed = biome.length * 31 + 7;
  // base: soft patches in 3 tones (2 lightest-but-one + darker), no dithering
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const n = pnoise(x, y, 8, seed) * 0.6 + pnoise(x, y, 4, seed + 1) * 0.4;
    const lo = biome === 'snow' ? r[3] : r[1];
    g.p(x, y, n > 0.76 ? r[3] : n < 0.24 ? lo : r[2]);
  }
  // details: placed inside 2..29 so tiles always join cleanly
  const spots = (n, s) => Array.from({ length: n }, (_, i) => [2 + Math.floor(rnd(i, v + 1, s) * 27), 2 + Math.floor(rnd(v + 3, i, s + 1) * 27), i]);
  const tuft = (x, y, c1, c2) => g.p(x, y, c1).p(x - 1, y - 1, c1).p(x + 1, y - 1, c1).p(x, y - 1, c2).p(x - 1, y - 2, c2);
  switch (biome) {
    case 'grass': case 'hills': case 'plains':
      for (const [x, y] of spots(biome === 'plains' ? 9 : 7, seed)) tuft(x, y, r[1], r[4]);
      if (biome === 'plains') for (const [x, y] of spots(6, seed + 5)) g.r(x, y - 2, 1, 3, r[4]).p(x, y, r[1]);
      if (season === 'spring' || (season === 'summer' && biome !== 'plains')) for (const [x, y, i] of spots(season === 'spring' ? 5 : 2, seed + 9)) g.p(x, y, FLOWERS[(i + v) % 5]);
      if (season === 'autumn') for (const [x, y, i] of spots(4, seed + 13)) g.p(x, y, i % 2 ? R.fire[2] : R.ochre[2]);
      break;
    case 'forest': case 'taiga': case 'jungle':
      for (const [x, y, i] of spots(10, seed)) g.p(x, y, i % 3 ? r[0] : r[4]).p(x + 1, y, r[1]);
      for (const [x, y] of spots(4, seed + 2)) tuft(x, y, r[1], r[3]);
      if (biome === 'forest' && season !== 'winter') for (const [x, y, i] of spots(season === 'autumn' ? 10 : 3, seed + 4)) g.p(x, y, season === 'autumn' ? [R.fire[2], R.red[2], R.gold[2]][i % 3] : R.wood[2]);
      if (biome === 'jungle') for (const [x, y] of spots(5, seed + 6)) g.line(x, y, x + 2, y - 2, r[3]).p(x + 1, y, r[3]);
      if (biome === 'taiga') for (const [x, y] of spots(5, seed + 8)) g.p(x, y, R.wood[1]).p(x + 1, y + 1, R.wood[1]);
      break;
    case 'desert': case 'beach':
      for (let y = 3; y < 30; y += 6) for (let x = 2; x < 30; x++) { const yy = y + Math.round(Math.sin((x + v * 5) / 4) * 1.2); if ((x + y + v) % 7 < 5) g.p(x, yy, r[biome === 'desert' ? 1 : 3]); }
      for (const [x, y, i] of spots(4, seed + 3)) g.p(x, y, biome === 'beach' ? (i % 2 ? R.pink[3] : R.white[3]) : r[0]);
      break;
    case 'tundra':
      for (const [x, y] of spots(5, seed)) g.r(x, y, 2, 1, R.stone[3]).p(x, y + 1, R.stone[1]);
      for (const [x, y] of spots(6, seed + 2)) g.p(x, y, r[4]).p(x + 1, y, r[3]);
      break;
    case 'snow':
      for (const [x, y] of spots(6, seed)) g.p(x, y, '#ffffff').p(x + 1, y + 1, r[3]);
      for (const [x, y] of spots(3, seed + 1)) g.r(x, y, 3, 1, r[2]);
      break;
    case 'mountain':
      for (const [x, y] of spots(5, seed)) g.line(x, y, x + 3, y + 1, r[0]).p(x, y - 1, r[4]);
      for (const [x, y] of spots(6, seed + 2)) g.r(x, y, 2, 2, r[3]).p(x + 1, y + 1, r[1]);
      break;
    case 'swamp':
      for (const [x, y] of spots(7, seed)) g.r(x, y - 2, 1, 3, r[3]).p(x, y - 3, R.wood[1]);
      for (const [x, y] of spots(5, seed + 1)) g.r(x, y, 2, 1, r[0]);
      break;
  }
  return g;
}

export const BIOME_TILES = ['grass', 'plains', 'forest', 'jungle', 'taiga', 'desert', 'beach', 'tundra', 'snow', 'hills', 'mountain', 'swamp'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export function groundSheet(biome) {
  const frames = [], tags = [];
  SEASONS.forEach((s) => { const a = frames.length; frames.push(texture(biome, s, 0), texture(biome, s, 1)); tags.push([s, a, a + 1, 1000]); });
  return { frames, tags, layer: biome, cols: 8 };
}
