// Phase 16 — the atlas: when zoomed far out the world becomes an illustrated parchment map
// (watercolour lands, inked coasts with ripple hatching, tree and mountain glyphs, ink
// rivers, sea serpents) — baked once per world at 4 px per tile.
import { B, BIOMES } from '../data/biomes.js';
import { hash2 } from '../core/rng.js';
import { makeCanvas } from './sprites.js';

export const APX = 8; // atlas pixels per tile (Phase 20: twice the detail)
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const PAPER = hex('#eedcb2'), PAPER_D = hex('#d4bb88'), INK = [62, 40, 24];
// Phase 20: richer watercolour washes and a sea that deepens away from the shore
const WASH = {
  [B.FOREST]: hex('#7fa660'), [B.JUNGLE]: hex('#5f9a52'), [B.TAIGA]: hex('#86a284'), [B.GRASS]: hex('#b9c97a'), [B.PLAINS]: hex('#d2c982'),
  [B.DESERT]: hex('#e8c27c'), [B.BEACH]: hex('#ecd49a'), [B.TUNDRA]: hex('#c2c4ac'), [B.SNOW]: hex('#f6f3ea'), [B.HILLS]: hex('#c4b47c'),
  [B.MOUNTAIN]: hex('#b0a48e'), [B.SWAMP]: hex('#93a47a'),
};
const SEA_BANDS = ['#d2e2d2', '#bcd6cc', '#a4c6c2', '#8fb6b8', '#7ea6b0', '#7099a8'].map(hex);

export function bakeAtlas(world) {
  const { w, h, N, biome, river, riverNext, seed, height, temp } = world;
  const S = seed & 0xffff;
  const W = w * APX, H = h * APX;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const isW = (i) => BIOMES[biome[i]].water;
  // distance to land for sea tiles (bands and ripple hatching), up to 9
  const dist = new Uint8Array(N).fill(12);
  const q = [];
  for (let i = 0; i < N; i++) if (!isW(i)) { dist[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k]; if (dist[i] >= 11) continue;
    const x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
  }
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      // jittered sampling for soft watercolour edges
      const j1 = hash2(px >> 2, py >> 2, S + 51), j2 = hash2(py >> 2, px >> 2, S + 52);
      const tx = Math.min(w - 1, Math.max(0, ((px + ((j1 * 9) | 0) - 4) / APX) | 0)), ty = Math.min(h - 1, Math.max(0, ((py + ((j2 * 9) | 0) - 4) / APX) | 0));
      const i = ty * w + tx;
      const stain = hash2(px >> 5, py >> 5, S + 53) * 0.5 + hash2(px >> 4, py >> 4, S + 54) * 0.5;
      // the sheet darkens toward its edges, like old paper
      const ex = Math.min(px, W - 1 - px) / W, ey = Math.min(py, H - 1 - py) / H, edge = Math.max(0, 0.06 - Math.min(ex, ey)) / 0.06;
      const paper = mix(mix(PAPER, PAPER_D, stain * 0.5), [150, 110, 64], edge * 0.45);
      let col;
      if (isW(i)) {
        const band = SEA_BANDS[Math.min(5, Math.max(0, dist[i] - 1))];
        col = mix(paper, band, 0.7);
        // ripple hatching: dashed lines following the coast at distances 1..3
        const dd = dist[i];
        if (dd >= 1 && dd <= 3) {
          const sub = ((px % APX) + (py % APX)) % APX;
          if (sub === (dd * 2) % APX && hash2(px >> 3, py >> 3, S + 55) < 0.7) col = mix(col, [70, 100, 112], 0.3);
        }
        // a light shallow band hugging the land
        if (dd === 1 && ((px + py) & 1) === 0) col = mix(col, [236, 244, 230], 0.25);
      } else {
        col = mix(paper, WASH[biome[i]] || paper, 0.78);
        // relief: light from the upper left on the height field
        const hl = (height[i] - (height[Math.min(N - 1, i + w + 1)] ?? height[i])) * 2.2;
        col = mix(col, hl > 0 ? [255, 246, 220] : [80, 60, 40], Math.min(0.25, Math.abs(hl)));
      }
      // grain
      const n = hash2(px, py, S + 56);
      if (n < 0.05) col = mix(col, INK, 0.07);
      const o = (py * W + px) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  // inked coastline, two pixels on the land side
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (isW(i)) continue;
    const put = (px, py, a = 1) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const o = (py * W + px) * 4; d[o] = d[o] * (1 - a) + INK[0] * a; d[o + 1] = d[o + 1] * (1 - a) + INK[1] * a; d[o + 2] = d[o + 2] * (1 - a) + INK[2] * a; };
    if (x > 0 && isW(i - 1)) for (let k = 0; k < APX; k++) { put(x * APX, y * APX + k); put(x * APX + 1, y * APX + k, 0.35); }
    if (x < w - 1 && isW(i + 1)) for (let k = 0; k < APX; k++) { put(x * APX + APX - 1, y * APX + k); put(x * APX + APX - 2, y * APX + k, 0.35); }
    if (y > 0 && isW(i - w)) for (let k = 0; k < APX; k++) { put(x * APX + k, y * APX); put(x * APX + k, y * APX + 1, 0.35); }
    if (y < h - 1 && isW(i + w)) for (let k = 0; k < APX; k++) { put(x * APX + k, y * APX + APX - 1); put(x * APX + k, y * APX + APX - 2, 0.35); }
  }
  ctx.putImageData(img, 0, 0);
  // rivers in blue ink
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(50,90,130,0.8)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (!river[i] || riverNext[i] < 0) continue;
    const a = i, b = riverNext[i];
    ctx.moveTo((a % w) * APX + 4, ((a / w) | 0) * APX + 4); ctx.lineTo((b % w) * APX + 4, ((b / w) | 0) * APX + 4);
  }
  ctx.stroke();
  const ink = 'rgba(62,40,24,0.9)';
  // glyphs, sorted top to bottom so lower ones overlap
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const b = biome[i];
    const r = hash2(x, y, S + 57);
    const X = x * APX + 4, Y = y * APX + 6;
    if (b === B.MOUNTAIN && r < 0.75) {
      // a little range: two or three inked peaks, sunlit west faces, snow on the high ones
      const n = 1 + (r < 0.35 ? 1 : 0) + (r < 0.12 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const ox = (k - (n - 1) / 2) * 5 + (hash2(x, y + k, S + 58) - 0.5) * 2, hh = 7 + hash2(x + k, y, S + 59) * 5;
        const px = X + ox, base = Y + 2;
        ctx.fillStyle = 'rgba(232,222,198,0.95)'; ctx.beginPath(); ctx.moveTo(px - hh * 0.6, base); ctx.lineTo(px, base - hh); ctx.lineTo(px + hh * 0.6, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(110,86,62,0.7)'; ctx.beginPath(); ctx.moveTo(px, base - hh); ctx.lineTo(px + hh * 0.6, base); ctx.lineTo(px + hh * 0.1, base); ctx.closePath(); ctx.fill();
        if (height[i] > 0.74 || temp[i] < 0.35) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.moveTo(px - hh * 0.2, base - hh * 0.66); ctx.lineTo(px, base - hh); ctx.lineTo(px + hh * 0.2, base - hh * 0.66); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - hh * 0.6, base); ctx.lineTo(px, base - hh); ctx.lineTo(px + hh * 0.6, base); ctx.stroke();
      }
    } else if (b === B.HILLS && r < 0.5) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(X, Y + 2, 4, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,86,62,0.5)'; ctx.beginPath(); ctx.moveTo(X + 1, Y - 1); ctx.lineTo(X + 3, Y + 1); ctx.stroke();
    } else if ((b === B.FOREST || b === B.TAIGA || b === B.JUNGLE) && r < 0.7) {
      const pine = b === B.TAIGA, palm = b === B.JUNGLE;
      const n = 1 + (r < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const tx = X + (k ? 3 : -2) + (hash2(x, y + k, S + 60) - 0.5) * 2, ty = Y + (k ? 1 : -1);
        ctx.strokeStyle = ink; ctx.lineWidth = 0.7;
        if (pine) { ctx.fillStyle = 'rgba(60,96,70,0.9)'; ctx.beginPath(); ctx.moveTo(tx - 2.5, ty + 2); ctx.lineTo(tx, ty - 4); ctx.lineTo(tx + 2.5, ty + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else {
          ctx.fillStyle = palm ? 'rgba(60,120,56,0.9)' : 'rgba(84,124,54,0.9)';
          ctx.beginPath(); ctx.arc(tx, ty - 1, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(200,220,140,0.6)'; ctx.fillRect(tx - 1.6, ty - 2.6, 1.2, 1); // sunlit leaves
          ctx.fillStyle = ink; ctx.fillRect(tx - 0.4, ty + 1.6, 0.8, 1.6);
        }
      }
    } else if (b === B.SWAMP && r < 0.4) {
      ctx.strokeStyle = 'rgba(60,84,56,0.85)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let k = 0; k < 3; k++) { ctx.moveTo(X - 2 + k * 2, Y + 2); ctx.lineTo(X - 2 + k * 2 + 0.4, Y - 1.5); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(80,120,130,0.5)'; ctx.fillRect(X - 3, Y + 2, 6, 1);
    } else if (b === B.DESERT && r < 0.18) {
      ctx.strokeStyle = 'rgba(150,104,54,0.65)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(X, Y + 4, 4.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if ((b === B.GRASS || b === B.PLAINS) && r < 0.05) {
      ctx.strokeStyle = 'rgba(100,120,60,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(X - 1, Y + 1); ctx.lineTo(X, Y - 1); ctx.moveTo(X + 1, Y + 1); ctx.lineTo(X + 1.5, Y - 0.5); ctx.stroke();
    }
  }
  // sea serpents, whales and sailing ships in the open sea
  const deep = [];
  for (let i = 0; i < N; i += 5) if (isW(i) && dist[i] >= 7) deep.push(i);
  const nS = Math.min(9, Math.floor(deep.length / 350));
  for (let k = 0; k < nS; k++) {
    const i = deep[Math.floor(hash2(k, 7, S + 58) * deep.length)];
    const X = (i % w) * APX, Y = ((i / w) | 0) * APX;
    const kind = k % 3;
    if (kind === 0) { // serpent: humps above the waves
      ctx.strokeStyle = 'rgba(52,80,84,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let t = 0; t <= 30; t++) { const xx = X + t * 2, yy = Y + Math.sin(t * 0.45) * 5; if (t) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(52,80,84,0.9)'; ctx.beginPath(); ctx.arc(X + 62, Y + Math.sin(30 * 0.45) * 5, 3, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 1) { // ship under sail
      ctx.fillStyle = 'rgba(110,70,40,0.9)'; ctx.beginPath(); ctx.moveTo(X - 8, Y); ctx.lineTo(X + 8, Y); ctx.lineTo(X + 5, Y + 4); ctx.lineTo(X - 5, Y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(244,236,214,0.95)'; ctx.fillRect(X - 5, Y - 11, 4, 9); ctx.fillRect(X + 1, Y - 13, 5, 11);
      ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.strokeRect(X - 5, Y - 11, 4, 9); ctx.strokeRect(X + 1, Y - 13, 5, 11);
      ctx.fillStyle = '#a8402a'; ctx.fillRect(X + 3, Y - 16, 3, 2);
      ctx.strokeStyle = 'rgba(70,100,112,0.6)'; ctx.beginPath(); ctx.moveTo(X - 14, Y + 5); ctx.lineTo(X - 9, Y + 5); ctx.moveTo(X - 18, Y + 7); ctx.lineTo(X - 12, Y + 7); ctx.stroke();
    } else { // whale spouting
      ctx.fillStyle = 'rgba(70,90,110,0.85)'; ctx.beginPath(); ctx.ellipse(X, Y, 9, 3.5, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(70,100,112,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X - 3, Y - 4); ctx.quadraticCurveTo(X - 6, Y - 10, X - 9, Y - 8); ctx.moveTo(X - 3, Y - 4); ctx.quadraticCurveTo(X, Y - 10, X + 3, Y - 8); ctx.stroke();
    }
  }
  return cv;
}

// Compass rose in screen space
export function drawCompass(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(70,48,30,0.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, long = k % 2 === 0 ? r * 1.15 : r * 0.7;
    ctx.fillStyle = k % 2 === 0 ? (k === 0 ? '#a8402a' : 'rgba(70,48,30,0.9)') : 'rgba(150,120,80,0.9)';
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * long, -Math.cos(a) * long); ctx.lineTo(Math.sin(a + 0.3) * r * 0.22, -Math.cos(a + 0.3) * r * 0.22); ctx.lineTo(Math.sin(a - 0.3) * r * 0.22, -Math.cos(a - 0.3) * r * 0.22); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(70,48,30,0.95)'; ctx.font = `700 ${Math.round(r * 0.45)}px "Pixelify Sans", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r * 1.42);
  ctx.restore();
}
