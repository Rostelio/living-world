// Electron check for the Aseprite sprite system with the test placeholder (townsfolk_humans):
//   node tests/make-placeholder.mjs && LW_SHOT=<dir> LW_SHOT_SCRIPT=tests/shots-sprites.js npx electron .
// Prints SPRITES {...}: whether the sheet loaded, the frames the Animator stepped through, and the
// colour under a villager on two frames 250 ms apart. Shots: frame A, frame B, F2 debug view.
await new Promise((r) => setTimeout(r, 900));
const human = [...document.querySelectorAll('.race')].find((el) => /human/i.test(el.textContent || el.dataset.race || ''));
human?.click();
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ui = await import('./src/ui/ui.js'); ui.hideModal(); document.getElementById('toasts').style.display = 'none';
const SP = await import('./src/sprites.js');
const G = window.LW.G, R = window.LW.renderer;
const ev = await import('./src/sim/events.js');
for (let i = 0; i < 360 * 3; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal();
const st = G.state;
const town = st.settlements.filter((s) => !s.dead && st.civs[s.civ].race === 'humans').sort((a, b) => b.pop - a.pop)[0];
const out = { loaded: SP.hasSprite('townsfolk_humans'), sheets: SP.SPRITES.sheets.size, town: town?.name };
// 1) the Animator on its own: forward loop through the "idle" tag with 250 ms frames
const an = new SP.Animator('townsfolk_humans').play('idle');
const seq = []; for (let k = 0; k < 6; k++) { seq.push(an.frame); an.update(0.25); }
out.animatorFrames = seq.join(',');
let ended = 0; const once = new SP.Animator('townsfolk_humans').play('idle', { loop: false, onEnd: () => ended++ });
for (let k = 0; k < 8; k++) once.update(0.25);
out.playOnce = { frame: once.frame, done: once.done, onEndCalls: ended };
// 2) on the map: villagers drawn with the placeholder; read the colour of their pixels on two frames
R.atmo.tod = 0.45; R.centerOn(town.tile, 4);
const draw = (n, dt) => { for (let i = 0; i < n; i++) R.draw(dt, 0.5, true); };
draw(30, 0.02);
const sample = () => {
  const c = R.ctx.getImageData(0, 0, R.canvas.width, R.canvas.height).data;
  let orange = 0, blue = 0;
  for (let i = 0; i < c.length; i += 16) {
    if (c[i] > 200 && c[i + 1] > 90 && c[i + 1] < 150 && c[i + 2] < 70) orange++;
    if (c[i] < 80 && c[i + 1] > 90 && c[i + 1] < 140 && c[i + 2] > 200) blue++;
  }
  return { orange, blue };
};
out.samples = [];
for (let k = 0; k < 4; k++) { draw(1, 0.25); out.samples.push(sample()); }
console.error('SPRITES ' + JSON.stringify(out));
window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })); // unpause so the villagers move
window.__shots = [
  () => { draw(1, 0.25); },
  () => { draw(1, 0.25); },
  () => { SP.toggleDebug(true); draw(1, 0.25); },
  () => { R.centerOn(town.tile, 8); draw(1, 0.25); },
];
