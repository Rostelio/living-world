// Electron screenshot script for Stage D: cloud shadows, dawn mist & sunbeams, night fireflies, fire.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 40 + 160; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
for (const id of ['log', 'nav', 'bottomRight']) document.getElementById(id)?.classList.add('hidden');
const R = window.LW.renderer, W = R.world, A = R.atmo;
const live = G.state.settlements.filter((s) => !s.dead).sort((a, b) => b.pop - a.pop);
const town = live[0];
// a town by water for the night scene
const wet = live.find((s) => { const x = s.tile % W.w, y = (s.tile / W.w) | 0; let n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (A.water[(y + dy) * W.w + x + dx]) n++; return n > 12; }) || town;
const warm = (tod, n = 90) => { A.tod = tod; for (let i = 0; i < n; i++) { A.update(1 / 30, true); R.draw(1 / 30, 0.5, true); } A.tod = tod; };
window.__shots = [
  () => { R.centerOn(town.tile, 3); warm(0.5); },
  () => { R.centerOn(wet.tile, 3); warm(0.27); },
  () => { R.centerOn(wet.tile, 4); warm(0.95); },
  () => { G.state.disasters.push({ type: 'wildfire', tile: town.tile + 6, r: 3, until: G.state.day + 60, start: G.state.day }); R.centerOn(town.tile + 6, 4); warm(0.62, 120); },
];
