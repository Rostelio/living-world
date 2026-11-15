// Electron script: which drawImage calls in the close-up view break the 2-art-pixels-per-world-pixel grid?
// LW_SHOT=<dir> LW_SHOT_SCRIPT=tests/pixel-audit.js npx electron .
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 40; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal();
const R = window.LW.renderer;
const town = G.state.settlements.filter((s) => !s.dead).sort((a, b) => b.pop - a.pop)[0];
R.centerOn(town.tile, 4);
await new Promise((r) => setTimeout(r, 500));
const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage;
const stats = new Map();
proto.drawImage = function (img, ...a) {
  if (this.canvas === R.canvas) {
    let sw, sh, dw, dh;
    if (a.length === 2) { sw = img.width; sh = img.height; dw = img.width; dh = img.height; }
    else if (a.length === 4) { sw = img.width; sh = img.height; dw = a[2]; dh = a[3]; }
    else { sw = a[2]; sh = a[3]; dw = a[6]; dh = a[7]; }
    const ratio = Math.round((sw / dw) * 100) / 100;
    const where = (new Error().stack.split('\n')[2] || '').replace(/.*\/src\//, '').replace(/\)$/, '');
    const k = `${ratio} | ${where}`;
    stats.set(k, (stats.get(k) || 0) + 1);
  }
  return orig.call(this, img, ...a);
};
await new Promise((r) => setTimeout(r, 400));
proto.drawImage = orig;
console.error('AUDIT\n' + [...stats].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}\t${k}`).join('\n'));
window.__shots = [];
