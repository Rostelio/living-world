// Electron screenshot script: readability options (large text + high contrast) with a panel open.
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const ev = await import('./src/sim/events.js'); const ui = await import('./src/ui/ui.js'); const S = await import('./src/ui/settings.js');
const G = window.LW.G;
for (let i = 0; i < 360 * 20; i++) { window.LW.simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
ui.hideModal();
window.__shots = [
  () => { ui.openPanel('overview'); },
  () => { S.SETTINGS.textSize = 'large'; S.SETTINGS.highContrast = true; S.saveSettings(); ui.openPanel('economy'); },
  () => { S.SETTINGS.textSize = 'normal'; S.SETTINGS.highContrast = false; S.saveSettings(); ui.hideModal(); },
];
