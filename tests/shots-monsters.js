// Electron screenshot script: a dragon's lair and another beast on the map, close up.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '777'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ui = await import('./src/ui/ui.js'); ui.hideModal(); document.getElementById('toasts')?.remove();
const G = window.LW.G, R = window.LW.renderer;
const ms = G.state.monsters.filter((m) => m.alive);
const dragon = ms.find((m) => m.kind === 'dragon') || ms[0], other = ms.find((m) => m.kind === 'giant' || m.kind === 'troll') || ms[1];
window.__shots = [
  () => { R.atmo.tod = 0.45; R.centerOn(dragon.lair, 4); },
  () => { R.atmo.tod = 0.45; R.centerOn(other.lair, 5); },
];
for (const m of [dragon, other]) { R.centerOn(m.lair, 4); for (let i = 0; i < 40; i++) R.draw(0.03, 0.5, true); }
