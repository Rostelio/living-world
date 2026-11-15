// Electron screenshot script for Phase 21: missions, schemes, trade routes, advisor, caravans.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '777'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js'); const D = await import('./src/sim/disasters.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 80 + 160; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
const st = G.state;
const routed = st.civs.filter((c) => c.alive && st.routes.some((r) => r.a === c.id || r.b === c.id)).sort((a, b) => b.settlements.length - a.settlements.length)[0] || st.civs.find((c) => c.alive);
D.setPlayer(routed.id);
const me = st.civs[st.playerId];
me.autoBuild = false; me.autoResearch = false;
const R = window.LW.renderer; R.atmo.tod = 0.45;
const route = st.routes.find((r) => r.a === me.id || r.b === me.id);
const mid = route ? (() => { const a = st.settlements[st.civs[route.a].capital].tile, b = st.settlements[st.civs[route.b].capital].tile; return Math.round(((a % R.world.w) + (b % R.world.w)) / 2) + Math.round((((a / R.world.w) | 0) + ((b / R.world.w) | 0)) / 2) * R.world.w; })() : me.capital;
window.__shots = [
  () => { R.centerOn(mid, 2); for (let i = 0; i < 30; i++) R.draw(1 / 30, 0.5, true); },
  () => { ui.openPanel('missions'); },
  () => { ui.openPanel('court'); },
  () => { ui.openPanel('economy'); setTimeout(() => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('Trade routes'))?.scrollIntoView(), 50); },
];
