// Water: tile_{deep|ocean|shallow|lake} and shore_foam, 32×32 seamless textures with a looping
// 8-frame animation (tag flow). They go into the ground atlas (src/render/ground-art.js) on the
// water biomes' rows; the terrain painters darken them with depth. Waves are short pixel strokes
// on periodic sine fields, so every frame tiles and frame 8 is frame 0 again.
import { Pix } from './pix.mjs';

const TAU = Math.PI * 2;
const rnd = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// periodic value noise on a 32-px torus
function pnoise(x, y, cell, seed) {
  const n = 32 / cell, fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
  let ux = fx - ix, uy = fy - iy; ux = ux * ux * (3 - 2 * ux); uy = uy * uy * (3 - 2 * uy);
  const v = (i, j) => rnd(((i % n) + n) % n, ((j % n) + n) % n, seed);
  return (v(ix, iy) * (1 - ux) + v(ix + 1, iy) * ux) * (1 - uy) + (v(ix, iy + 1) * (1 - ux) + v(ix + 1, iy + 1) * ux) * uy;
}

const KINDS = {
  //          dark       base       light      crest      calm (fewer, smaller waves)
  deep: { r: ['#14234e', '#1a2c5c', '#22386c', '#3a5a90'], crest: 1.45, spark: 0.004 },
  ocean: { r: ['#1f3f7a', '#27508e', '#2f60a2', '#6a9ad0'], crest: 1.3, spark: 0.006 },
  shallow: { r: ['#2f7aa8', '#3a8cb8', '#4aa2c8', '#a0dcec'], crest: 1.2, spark: 0.008, caustic: true },
  lake: { r: ['#2a6a8a', '#33789a', '#3e88a8', '#90c8d8'], crest: 1.5, spark: 0.004 },
};

function water(kind, f) {
  const K = KINDS[kind], g = new Pix(32, 32), ph = (f / 8) * TAU;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const u = x / 32, v = y / 32;
    // soft static tone patches
    const tone = pnoise(x, y, 8, 7) * 0.5 + pnoise(x, y, 4, 8) * 0.5;
    let c = tone > 0.72 ? K.r[2] : tone < 0.26 && (x + y) % 2 ? K.r[0] : K.r[1];
    // two crossing swell fields drifting with the frame
    const w = Math.sin(TAU * (u * 2 + v * 3) + ph) + 0.7 * Math.sin(TAU * (u * -1 + v * 4) - ph * 2) + 0.35 * Math.sin(TAU * (u * 3 - v * 1) + ph);
    const band = Math.floor(y / 2) % 2;                      // strokes are drawn on alternate rows: a flat, painted look
    if (w > K.crest && band === 0) c = K.r[3];
    else if (w > K.crest - 0.35 && band === 0) c = K.r[2];
    else if (w < -K.crest - 0.15 && band === 1) c = K.r[0];
    if (K.caustic) {                                         // a light net of caustics under the shallows
      const cn = Math.abs(pnoise(x, y, 8, 11) - pnoise((x + f * 4) % 32, y, 8, 12));
      if (cn < 0.018) c = K.r[2];
    }
    if (rnd(x, y, 100 + f) < K.spark) c = '#e8f6ff';         // glints
    g.p(x, y, c);
  }
  return g;
}

// shore foam: white lace with holes, edges washing back and forth; transparent elsewhere
function foam(f) {
  const g = new Pix(32, 32), ph = (f / 8) * TAU;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    void ph;
    const v = pnoise(x, y, 8, 21) * 0.4 + pnoise((x + f * 4) % 32, (y + f * 4) % 32, 8, 22) * 0.4 + pnoise(x, y, 4, 23) * 0.2;
    if (v > 0.62) g.p(x, y, '#f4fbff');
    else if (v > 0.56) g.p(x, y, '#c8e6f2');
    else if (v > 0.53 && (x + y) % 2) g.p(x, y, '#c8e6f2b0');
  }
  return g;
}

const sheet = (fn) => () => ({ frames: [0, 1, 2, 3, 4, 5, 6, 7].map(fn), tags: [['flow', 0, 7, 250]] });
export const WATER = {
  tile_deep: sheet((f) => water('deep', f)),
  tile_ocean: sheet((f) => water('ocean', f)),
  tile_shallow: sheet((f) => water('shallow', f)),
  tile_lake: sheet((f) => water('lake', f)),
  shore_foam: sheet(foam),
};
