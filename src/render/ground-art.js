// Aseprite ground textures (tile_<biome>, 32×32, tags spring..winter × 2 variants) packed into
// one atlas for the terrain painters: row = biome id (16 rows), column = season * 2 + variant.
// Biomes without a sprite stay transparent there, and the painters keep their procedural ground.
import { SPRITES, tagFrame, frameCanvas } from '../sprites.js';
import { B } from '../data/biomes.js';

const NAMES = {
  [B.GRASS]: 'grass', [B.PLAINS]: 'plains', [B.FOREST]: 'forest', [B.JUNGLE]: 'jungle', [B.TAIGA]: 'taiga', [B.DESERT]: 'desert',
  [B.BEACH]: 'beach', [B.TUNDRA]: 'tundra', [B.SNOW]: 'snow', [B.HILLS]: 'hills', [B.MOUNTAIN]: 'mountain', [B.SWAMP]: 'swamp',
};
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const GROUND_W = 256, GROUND_H = 512;

let atlas; // undefined: not built yet; null: no ground sprites
export function groundAtlas() {
  if (atlas !== undefined) return atlas;
  const c = document.createElement('canvas');
  c.width = GROUND_W; c.height = GROUND_H;
  const x = c.getContext('2d');
  let any = false;
  for (const [b, name] of Object.entries(NAMES)) {
    const id = 'tile_' + name;
    if (!SPRITES.sheets.has(id)) continue;
    SEASONS.forEach((s, si) => {
      for (let v = 0; v < 2; v++) {
        const f = frameCanvas(id, tagFrame(id, s, v), [32, 32]);
        if (f) { x.drawImage(f, (si * 2 + v) * 32, +b * 32); any = true; }
      }
    });
  }
  atlas = any ? c : null;
  return atlas;
}

// For the CPU chunk baker (16 px per tile): the atlas at half size, each texel the average of
// 2×2 art pixels. texel(b, col, x, y) → [r, g, b] or null where the biome has no sprite.
let half;
export function groundTexels16() {
  if (half !== undefined) return half;
  const a = groundAtlas();
  if (!a) return (half = null);
  const src = a.getContext('2d').getImageData(0, 0, GROUND_W, GROUND_H).data;
  const W = GROUND_W / 2, H = GROUND_H / 2, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, bl = 0, al = 0;
    for (let k = 0; k < 4; k++) { const o = ((y * 2 + (k >> 1)) * GROUND_W + x * 2 + (k & 1)) * 4; r += src[o]; g += src[o + 1]; bl += src[o + 2]; al += src[o + 3]; }
    const o = (y * W + x) * 4; d[o] = r / 4; d[o + 1] = g / 4; d[o + 2] = bl / 4; d[o + 3] = al / 4;
  }
  half = {
    texel(b, col, x, y) {
      const o = ((b * 16 + y) * W + col * 16 + x) * 4;
      return d[o + 3] > 127 ? [d[o], d[o + 1], d[o + 2]] : null;
    },
  };
  return half;
}
