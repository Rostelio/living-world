// Generates desktop/build/icon.png (1024x1024 pixel-art banner) with no dependencies.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GRID = [
  '................................',
  '................................',
  '..............#.................',
  '..............##RRRR............',
  '..............##RRRRRR..........',
  '..............##RRYRRR..........',
  '..............##RRRRRR..........',
  '..............##RRRR............',
  '..............#.................',
  '.....S..S.....#.....S..S........',
  '.....SSSS.....#.....SSSS........',
  '.....SSSS....SSS....SSSS........',
  '.....SSSSSSSSSSSSSSSSSSS........',
  '.....SSSSSSSSSSSSSSSSSSS........',
  '.....SSSDSSSSSSSSSSSDSSS........',
  '.....SSSSSSSSSSSSSSSSSSS........',
  '.....SSSSSSSSSDDSSSSSSSS........',
  '.....SSSSSSSSDDDDSSSSSSS........',
  '..GGGSSSSSSSSDDDDSSSSSSSGGG.....',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG....',
  'GGgGGGGgGGGGGGGGgGGGGGgGGGGGG...',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..',
  'BBBBBBBBGGGGGGGGGGGGGGGBBBBBBBBB',
  'BBBBbBBBBBBGGGGGGGGGBBBBBBbBBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BBbBBBBBBBBBBBbBBBBBBBBBBBBbBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BBBBBBBbBBBBBBBBBBBBbBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
];
const PAL = {
  '.': [24, 40, 70], '#': [42, 29, 18], R: [200, 60, 50], Y: [242, 201, 76], S: [150, 144, 132], D: [42, 29, 18],
  G: [96, 160, 70], g: [70, 130, 52], B: [40, 92, 150], b: [120, 170, 220],
};
const SIZE = 1024, CELL = SIZE / 32;
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    const ch = GRID[Math.floor(y / CELL)][Math.floor(x / CELL)];
    const [r, g, b] = PAL[ch];
    // rounded-square mask for a modern app icon
    const m = 90, cx = Math.max(m - x, 0, x - (SIZE - 1 - m)), cy = Math.max(m - y, 0, y - (SIZE - 1 - m));
    const inside = cx * cx + cy * cy <= m * m;
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = inside ? 255 : 0;
  }
}
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.join(__dirname, 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Wrote', out, png.length, 'bytes');
