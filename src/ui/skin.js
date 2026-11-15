// Phase 20 — the interface skin: pixel textures drawn once at start-up (wood planks, parchment,
// a carved wooden frame with brass corner studs) and handed to the stylesheet as CSS variables.
import { hash2 } from '../core/rng.js';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const P = (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px, py, pw, ph); };
  draw(P, x);
  return c.toDataURL('image/png');
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

// dark planks with grain and the odd knot (64×32, tiles seamlessly)
function wood(base = [58, 42, 26]) {
  return canvas(64, 32, (P) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
      const plank = y >> 3;
      const g = Math.sin((x + plank * 17) * 0.21 + Math.sin(y * 0.9 + plank) * 1.3) * 0.5 + 0.5;
      const n = hash2(x, y, 401 + plank);
      const f = 0.86 + g * 0.16 + (n < 0.08 ? -0.08 : n > 0.95 ? 0.06 : 0) + (plank % 2 ? 0.04 : 0);
      P(x, y, 1, 1, rgb(base[0] * f, base[1] * f, base[2] * f));
    }
    for (let p = 0; p < 4; p++) P(0, p * 8 + 7, 64, 1, rgb(base[0] * 0.55, base[1] * 0.55, base[2] * 0.55)); // plank seams
    for (let p = 0; p < 4; p++) P(0, p * 8, 64, 1, rgb(base[0] * 1.12, base[1] * 1.12, base[2] * 1.1));
    for (const [kx, ky] of [[14, 3], [47, 20]]) { P(kx, ky, 3, 2, rgb(base[0] * 0.6, base[1] * 0.6, base[2] * 0.6)); P(kx + 1, ky, 1, 1, rgb(base[0] * 0.45, base[1] * 0.45, base[2] * 0.45)); }
  });
}
// parchment: warm paper with fibres, faint stains and specks (64×64)
function paper() {
  return canvas(64, 64, (P) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const st = (hash2(x >> 3, y >> 3, 411) + hash2(x >> 2, y >> 2, 412)) * 0.5;
      const n = hash2(x, y, 413);
      const f = 1 - st * 0.07 + (n < 0.05 ? -0.06 : 0) + (hash2(x, y >> 1, 414) < 0.03 ? 0.04 : 0);
      P(x, y, 1, 1, rgb(236 * f, 219 * f, 178 * f));
    }
  });
}
// carved frame for border-image (24×24, 8 px slices): dark rim, lit bevel, gold rule, brass studs
function frame() {
  return canvas(24, 24, (P) => {
    P(0, 0, 24, 24, '#2c2014');
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if (hash2(i, j, 421) < 0.15) P(i, j, 1, 1, '#36281a');
    P(0, 0, 24, 1, '#0c0906'); P(0, 23, 24, 1, '#0c0906'); P(0, 0, 1, 24, '#0c0906'); P(23, 0, 1, 24, '#0c0906');
    P(1, 1, 22, 1, '#7a5e36'); P(1, 1, 1, 22, '#6a5030'); // lit top-left bevel
    P(1, 22, 22, 1, '#140e08'); P(22, 1, 1, 22, '#1a120a'); // shaded bottom-right
    P(6, 6, 12, 1, '#b8913f'); P(6, 17, 12, 1, '#7a5e2a'); P(6, 6, 1, 12, '#a07e36'); P(17, 6, 1, 12, '#7a5e2a'); // gold inner rule
    P(7, 7, 10, 10, 'rgba(0,0,0,0)');
    for (const [cx, cy] of [[3, 3], [19, 3], [3, 19], [19, 19]]) { P(cx, cy, 2, 2, '#c8a050'); P(cx, cy, 1, 1, '#f0d890'); P(cx + 1, cy + 1, 1, 1, '#6a4a1a'); }
  });
}

export function initSkin() {
  const root = document.documentElement.style;
  root.setProperty('--wood-tex', `url(${wood()})`);
  root.setProperty('--wood-dark', `url(${wood([40, 29, 18])})`);
  root.setProperty('--paper-tex', `url(${paper()})`);
  root.setProperty('--frame', `url(${frame()})`);
  document.body.classList.add('skin20');
}
