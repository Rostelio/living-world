// Electron screenshot script for Stage E: atlas, ribbon labels, panels and a parchment event page.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js'); const D = await import('./src/sim/disasters.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 40 + 160; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
const big = G.state.civs.filter((c) => c.alive).sort((a, b) => b.settlements.length - a.settlements.length)[0];
if (!G.state.civs[0].alive) D.setPlayer(big.id);
const me = G.state.civs[G.state.playerId];
const R = window.LW.renderer; R.atmo.tod = 0.45;
const cap = G.state.settlements[me.capital];
window.__shots = [
  () => { ui.hideModal(); R.centerOn(cap.tile, 0.3); },
  () => { R.centerOn(cap.tile, 1.3); },
  () => { ui.openPanel('economy'); },
  () => { ui.eventModal({ id: 99999, ev: 'harvest', civ: me.id, ctx: {}, day: G.state.day }); },
  async () => { const I = await import('./src/ui/i18n.js'); I.initI18n('uk'); ui.eventModal({ id: 99999, ev: 'harvest', civ: me.id, ctx: {}, day: G.state.day }); },
];
