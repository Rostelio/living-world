// Test placeholder for the Aseprite sprite system: a 128×64 PNG with two 64×64 frames in
// different colours, and an Aseprite "json-array" file with an "idle" tag.
//   node tests/make-placeholder.mjs [id]        writes assets/sprites/<id>.png + .json
//   node tests/make-placeholder.mjs [id] --rm   deletes them again
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const id = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'townsfolk_humans';
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'sprites');
const png = path.join(dir, id + '.png'), json = path.join(dir, id + '.json');
if (process.argv.includes('--rm')) {
  for (const f of [png, json]) if (fs.existsSync(f)) fs.unlinkSync(f);
  if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  console.log('removed placeholder', id);
  process.exit(0);
}

// ---- pixels: frame 0 warm orange, frame 1 cold blue; a dark outline and a white "foot" mark ----
const W = 128, H = 64;
const px = Buffer.alloc(W * H * 4);
const put = (x, y, [r, g, b, a = 255]) => { const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a; };
for (let f = 0; f < 2; f++) {
  const fill = f === 0 ? [232, 120, 40] : [50, 110, 230];
  for (let y = 8; y < 64; y++) for (let x = 16; x < 48; x++) {
    const edge = x === 16 || x === 47 || y === 8 || y === 63;
    put(f * 64 + x, y, edge ? [30, 20, 40] : fill);
  }
  for (let x = 30; x < 34; x++) put(f * 64 + x, 62, [255, 255, 255]); // bottom centre
}

// ---- PNG encoder (RGBA, no filter) ----
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

// ---- Aseprite json-array data ----
const frame = (i) => ({
  filename: `${id} ${i}.aseprite`,
  frame: { x: i * 64, y: 0, w: 64, h: 64 }, rotated: false, trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 },
  duration: 250,
});
const data = {
  frames: [frame(0), frame(1)],
  meta: {
    app: 'https://www.aseprite.org/', version: '1.3', image: id + '.png', format: 'RGBA8888',
    size: { w: W, h: H }, scale: '1',
    frameTags: [{ name: 'idle', from: 0, to: 1, direction: 'forward', color: '#000000ff' }],
    layers: [{ name: 'Layer 1', opacity: 255, blendMode: 'normal' }], slices: [],
  },
};
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(png, file);
fs.writeFileSync(json, JSON.stringify(data, null, 1));
console.log('wrote', path.relative(process.cwd(), png), 'and', path.relative(process.cwd(), json));
