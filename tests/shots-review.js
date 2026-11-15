// Electron screenshot script for an art review at several zoom levels and times of day.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 60 + 150; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
for (const id of ['log', 'nav', 'bottomRight']) document.getElementById(id)?.classList.add('hidden');
G.dirty.owners = true;
const R = window.LW.renderer;
const live = G.state.settlements.filter((s) => !s.dead).sort((a, b) => b.pop - a.pop);
const town = live[0], village = live.find((s) => s.stage === 1) || live[5];
const perf = async (tod, zoom) => { R.atmo.tod = tod; R.centerOn(town.tile, zoom); for (let i = 0; i < 10; i++) R.draw(0.016, 0.5, false); const t0 = performance.now(); for (let i = 0; i < 40; i++) R.draw(0.016, 0.5, false); return ((performance.now() - t0) / 40).toFixed(1); };
const { SETTINGS } = await import('./src/ui/settings.js');
await perf(0.45, 1.3); await perf(0.45, 1.3);
for (const [label, f, sh] of [['all on', true, true], ['no grade filter', false, true], ['no shadows', true, false], ['neither', false, false]]) { SETTINGS.gradeFilter = f; SETTINGS.shadows = sh; console.error(`PERF ${label}: z3 ${await perf(0.45, 3)} z1.3 ${await perf(0.45, 1.3)} dpr ${window.devicePixelRatio} canvas ${R.canvas.width}x${R.canvas.height}`); }
SETTINGS.gradeFilter = true; SETTINGS.shadows = true;
console.error(`PERF ms/frame: day z3 ${await perf(0.45, 3)}, dusk z3 ${await perf(0.74, 3)}, night z3 ${await perf(0.95, 3)}, day z1.3 ${await perf(0.45, 1.3)}, day z0.35 ${await perf(0.45, 0.35)}`);
window.__shots = [
  () => { R.atmo.tod = 0.45; R.centerOn(town.tile, 0.35); },
  () => { R.atmo.tod = 0.45; R.centerOn(town.tile, 1.3); },
  () => { R.atmo.tod = 0.45; R.centerOn(town.tile, 3); },
  () => { R.atmo.tod = 0.45; R.centerOn(village.tile, 6); },
  () => { R.atmo.tod = 0.92; R.centerOn(town.tile, 3); },
  () => { R.atmo.tod = 0.71; R.centerOn(town.tile, 3); },
  () => { R.atmo.tod = 0.45; R.centerOn(town.tile, 8); },
  () => { R.atmo.tod = 0.45; G.state.day += 210; R.centerOn(village.tile, 6); }, // winter
];
