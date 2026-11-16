// A tiny pixel canvas for generating the game's Aseprite art in Node (no dependencies):
// draw with palette colours, add the ink outline, mirror, and write PNG files.
import fs from 'node:fs';
import zlib from 'node:zlib';

export const hex = (h) => {
  if (Array.isArray(h)) return h;
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), s.length > 6 ? parseInt(s.slice(6, 8), 16) : 255];
};

export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  p(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!c || !this.in(x, y)) return this;
    const [r, g, b, a = 255] = hex(c), i = (y * this.w + x) * 4;
    this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = a;
    return this;
  }
  get(x, y) { if (!this.in(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null; }
  alpha(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  clear(x, y) { if (this.in(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4); return this; }
  r(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); return this; }
  // horizontal spans: rows = [[x0, x1], ...] from row y down
  rows(y, spans, c) { spans.forEach(([a, b], j) => { if (a != null) for (let x = a; x <= b; x++) this.p(x, y + j, c); }); return this; }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.p(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.35), ny = (y - cy) / (ry + 0.35);
      if (nx * nx + ny * ny <= 1) this.p(x, y, c);
    }
    return this;
  }
  // paint c over every filled pixel where test(x, y) is true (used for shading passes)
  over(test, c) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.alpha(x, y) && test(x, y)) this.p(x, y, c); return this; }
  // a 1 px ink outline around everything drawn (4-neighbour, like the reference packs)
  outline(c, { diag = false } = {}) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y)) continue;
      const n = this.alpha(x + 1, y) || this.alpha(x - 1, y) || this.alpha(x, y + 1) || this.alpha(x, y - 1)
        || (diag && (this.alpha(x + 1, y + 1) || this.alpha(x - 1, y - 1) || this.alpha(x + 1, y - 1) || this.alpha(x - 1, y + 1)));
      if (n) add.push([x, y]);
    }
    for (const [x, y] of add) this.p(x, y, c);
    return this;
  }
  draw(src, ox = 0, oy = 0) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.p(x + ox, y + oy, c); } return this; }
  flip() { const m = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.get(x, y); if (c) m.p(this.w - 1 - x, y, c); } return m; }
  clone() { const m = new Pix(this.w, this.h); m.d.set(this.d); return m; }
  // swap colours (exact matches): map = [[from, to], ...]
  recolor(map) {
    const m = map.map(([a, b]) => [hex(a), hex(b)]);
    for (let i = 0; i < this.d.length; i += 4) for (const [a, b] of m) if (this.d[i] === a[0] && this.d[i + 1] === a[1] && this.d[i + 2] === a[2] && this.d[i + 3]) { this.d[i] = b[0]; this.d[i + 1] = b[1]; this.d[i + 2] = b[2]; break; }
    return this;
  }
  png() { return encodePNG(this.w, this.h, this.d); }
  save(file) { fs.writeFileSync(file, this.png()); return this; }
}

// ---- PNG (RGBA, 8-bit) ----
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// a contact sheet of frames, scaled up, on a checker-free backdrop (for reviewing art)
export function contactSheet(frames, { cols = 8, scale = 6, bg = '#6f9a54', gap = 2 } = {}) {
  const fw = frames[0].w, fh = frames[0].h, rows = Math.ceil(frames.length / cols);
  const W = (cols * (fw + gap) + gap) * scale, H = (rows * (fh + gap) + gap) * scale;
  const s = new Pix(W, H); s.r(0, 0, W, H, bg);
  frames.forEach((f, i) => {
    const ox = (gap + (i % cols) * (fw + gap)) * scale, oy = (gap + Math.floor(i / cols) * (fh + gap)) * scale;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const c = f.get(x, y); if (c) s.r(ox + x * scale, oy + y * scale, scale, scale, c); }
  });
  return s;
}
