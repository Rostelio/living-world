// Phase 16 — title screen backdrop: a slowly drifting illustrated atlas of a random world,
// with cloud shadows, a compass rose and a gentle day tint. Removes itself once a game starts.
import { generateWorld } from '../world/worldgen.js';
import { bakeAtlas, drawCompass, APX } from '../render/atlas.js';
import { SPRITES, frameCanvas, tagFrame } from '../sprites.js';

// The painted valley (scripts/art/title.mjs title_backdrop): four 480×270 layers scaled up by a
// whole number to cover the screen, the far ones drifting slower than the near ones, with clouds.
function paintValley(ctx, Wd, Hd, t) {
  const L = ['sky', 'far', 'mid', 'near'].map((n) => frameCanvas('title_backdrop', tagFrame('title_backdrop', n, 0)));
  if (L.some((c) => !c)) return false;
  const k = Math.max(Math.ceil(Hd / 270), Math.ceil(Wd / 480)), lw = 480 * k, y0 = Hd - 270 * k;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2e4a86'; ctx.fillRect(0, 0, Wd, Hd);
  const x0 = Math.round((Wd - lw) / 2);
  ctx.drawImage(L[0], x0, y0, lw, 270 * k);
  // clouds high in the sky, drifting right
  if (SPRITES.sheets.has('fx_cloud')) for (let i = 0; i < 5; i++) {
    const c = frameCanvas('fx_cloud', (i * 3 + 1) % 8);
    if (!c) continue;
    const span = Wd + 64 * k * 2, x = ((i * 0.23 * span + t * (2 + i * 0.6) * k) % span) - 64 * k, y = y0 + (14 + ((i * 37) % 70)) * k;
    ctx.globalAlpha = 0.85; ctx.drawImage(c, Math.round(x), Math.round(y), 64 * k, 32 * k); ctx.globalAlpha = 1;
  }
  [[L[1], 1.2], [L[2], 3], [L[3], 7]].forEach(([img, sp]) => {
    const off = Math.round((t * sp) % 480) * k;
    for (let x = -off; x < Wd; x += lw) ctx.drawImage(img, x, y0, lw, 270 * k);
  });
  return true;
}

let cv = null, raf = 0;
export function showTitleBackdrop() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.id = 'titleBg';
  // inside #app, just above the map canvas, so the menus (z-index 40) stay on top
  const map = document.getElementById('map');
  if (map) map.after(cv); else document.body.prepend(cv);
  let atlas = null;
  setTimeout(() => {
    if (SPRITES.sheets.has('title_backdrop')) return; // the painted valley needs no world
    try { atlas = bakeAtlas(generateWorld((Math.random() * 1e6) | 0, 'small', 'continents')); } catch (e) { console.warn('title backdrop', e); }
  }, 30);
  const t0 = performance.now();
  const frame = () => {
    if (!cv) return;
    const top = document.getElementById('topbar');
    if (top && !top.classList.contains('hidden')) { hideTitleBackdrop(); return; }
    const dpr = window.devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a120a'; ctx.fillRect(0, 0, W, H);
    const t = (performance.now() - t0) / 1000;
    if (SPRITES.sheets.has('title_backdrop')) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      paintValley(ctx, cv.width, cv.height, t);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else if (atlas) {
      const scale = Math.max(W / (atlas.width * 0.7), H / (atlas.height * 0.7));
      const vw = W / scale, vh = H / scale;
      const ox = (atlas.width - vw) * (0.5 + 0.5 * Math.sin(t * 0.018)), oy = (atlas.height - vh) * (0.5 + 0.5 * Math.cos(t * 0.013));
      ctx.globalAlpha = Math.min(1, t / 1.5);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(atlas, ox, oy, vw, vh, 0, 0, W, H);
      // drifting cloud shadows
      for (let k = 0; k < 7; k++) {
        const x = ((k * 397 + t * 9) % (W + 600)) - 300, y = (k * 211) % H, r = 160 + (k % 3) * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(40,30,20,0.13)'); g.addColorStop(1, 'rgba(40,30,20,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      drawCompass(ctx, W - 90, H - 100, 44, 0.8 * ctx.globalAlpha);
      ctx.globalAlpha = 1;
    }
    // warm vignette so the menu stays readable
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(20,12,6,0.15)'); g.addColorStop(1, 'rgba(20,12,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    void APX;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
export function hideTitleBackdrop() {
  cancelAnimationFrame(raf);
  cv?.remove(); cv = null;
}
