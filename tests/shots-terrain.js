// Electron screenshot script for terrain and water close-ups (no simulation needed).
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ui = await import('./src/ui/ui.js'); const { B } = await import('./src/data/biomes.js');
ui.hideModal(); document.getElementById('toasts')?.remove();
window.LW.G.state.day = 360 * 0 + 165; // early summer for the close-ups
R0: void 0;
for (const id of ['log', 'nav', 'bottomRight']) document.getElementById(id)?.classList.add('hidden');
const R = window.LW.renderer, W = R.world; R.tiles16?.cache?.clear?.();
// a tile whose 9×9 neighbourhood has the most of the wanted biomes
function find(pred, need) {
  let best = 0, bt = 0;
  for (let y = 6; y < W.h - 6; y += 2) for (let x = 6; x < W.w - 6; x += 2) {
    let n = 0; const seen = new Set();
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const b = W.biome[(y + dy) * W.w + x + dx]; if (pred(b)) { n++; seen.add(b); } }
    const v = n * Math.min(need, seen.size);
    if (v > best) { best = v; bt = y * W.w + x; }
  }
  return bt;
}
const T = {
  hills: find((b) => b === B.HILLS || b === B.MOUNTAIN || b === B.GRASS, 3),
  coast: find((b) => b === B.SHALLOW || b === B.BEACH || b === B.GRASS || b === B.OCEAN, 4),
  swamp: find((b) => b === B.SWAMP || b === B.FOREST || b === B.LAKE, 3),
  desert: find((b) => b === B.DESERT || b === B.PLAINS || b === B.GRASS, 3),
};
window.__shots = [
  () => { R.atmo.tod = 0.45; R.centerOn(T.hills, 4); },
  () => { R.atmo.tod = 0.45; R.centerOn(T.coast, 4); },
  () => { R.atmo.tod = 0.45; R.centerOn(T.swamp, 4); },
  () => { R.atmo.tod = 0.45; R.centerOn(T.desert, 3); },
  () => { R.atmo.tod = 0.45; R.centerOn(T.coast, 2); },
];
// let chunks bake
for (const t of Object.values(T)) { R.centerOn(t, 4); for (let i = 0; i < 60; i++) R.draw(0.016, 0.5, false); }
