// Electron screenshot script: LW_SHOT=<dir> LW_SHOT_SCRIPT=tests/shots-phase19.js npx electron .
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 170; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
G.dirty.owners = true;
const R = window.LW.renderer; R.atmo.tod = 0.45;
const live = G.state.settlements.filter((s) => !s.dead);
const metro = live.filter((s) => s.stage >= 3 && G.state.civs[s.civ].race !== 'elves' && G.state.civs[s.civ].race !== 'lizardfolk').sort((a, b) => (b.works?.length || 0) - (a.works?.length || 0) || b.pop - a.pop);
const D = await import('./src/sim/disasters.js');
const big = G.state.civs.filter((c) => c.alive).sort((a, b) => b.settlements.length - a.settlements.length)[0];
if (!G.state.civs[0].alive && D.setPlayer) D.setPlayer(big.id);
const me = G.state.civs[G.state.playerId];
console.error('METRO ' + metro.slice(0, 3).map((s) => s.name + ':' + s.stage + ':' + (s.works || []).join('/')).join(' ') + ' player alive ' + me.alive);
window.__shots = [
  () => { R.centerOn(metro[0].tile, 5); },
  () => { R.centerOn(metro[1].tile, 4); },
  () => { R.centerOn(metro[0].tile, 2); },
  () => { ui.refreshAll?.(true); ui.openPanel('economy'); setTimeout(() => document.querySelectorAll('.monuments')[1]?.scrollIntoView(), 50); },
  async () => { const I = await import('./src/ui/i18n.js'); I.initI18n('uk'); ui.openPanel('economy'); setTimeout(() => document.querySelectorAll('.monuments')[1]?.scrollIntoView(), 80); },
];
