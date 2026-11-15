// Electron screenshot script for Phase 22 side-view scenes.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js');
const G = window.LW.G;
G.state.civs.forEach((c) => { c.autoBuild = true; c.autoResearch = true; });
for (let i = 0; i < 360 * 70 + 160; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal(); document.getElementById('toasts')?.remove();
const st = G.state;
const byRace = {}; for (const s of st.settlements) { if (s.dead) continue; const r = st.civs[s.civ].race; if (!byRace[r] || s.pop > byRace[r].pop) byRace[r] = s; }
const towns = Object.values(byRace).sort((a, b) => b.pop - a.pop);
const rep = (st.battleReports || []).slice(-1)[0];
window.__shots = [
  () => ui.openScene({ type: 'town', id: towns[0].id, tod: 0.45 }),
  () => ui.openScene({ type: 'town', id: towns[0].id, tod: 0.74 }),
  () => ui.openScene({ type: 'town', id: towns[0].id, tod: 0.93 }),
  () => ui.openScene({ type: 'town', id: towns[1].id, tod: 0.4 }),
  () => ui.openScene({ type: 'town', id: towns[2].id, tod: 0.55 }),
  () => { if (rep) ui.openScene({ type: 'battle', report: rep, tod: 0.5 }); },
];
