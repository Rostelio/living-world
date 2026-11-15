// Electron bug hunt: plays long games while clicking every enabled button it can find in the
// panels and dialogs, changing selects, switching language, and checking the state for NaNs.
// LW_SHOT=<dir> LW_SHOT_SCRIPT=tests/bughunt.js npx electron .     (prints BUGHUNT … at the end)
const SEED = Number(window.__bugSeed || 4242), ITER = Number(window.__bugIter || 260);
const SKIP = new Set(['menuItem', 'bindKey', 'resetKeys', 'gfxPreset']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(900);
const races = [...document.querySelectorAll('.race')];
const pickRace = races.length ? races[SEED % races.length] : null;
pickRace?.click();
document.getElementById('ssSeed').value = String(SEED);
document.getElementById('ssStart').click();
await sleep(3500);
const ui = await import('./src/ui/ui.js');
const I = await import('./src/ui/i18n.js');
const { PANEL_ORDER } = await import('./src/ui/panels.js');
const G = window.LW.G;
const found = new Map();
const note = (kind, msg) => { const k = kind + ': ' + String(msg).slice(0, 220); found.set(k, (found.get(k) || 0) + 1); };
window.addEventListener('error', (e) => note('window.onerror', e.message));
window.addEventListener('unhandledrejection', (e) => note('promise', e.reason?.message || e.reason));
const origErr = console.error.bind(console);
console.error = (...a) => { const s = a.map((x) => (x && x.message) || String(x)).join(' '); if (!/^BUGHUNT/.test(s)) note('console.error', s); origErr(...a); };
let r = 1; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
const pick = (l) => l[Math.floor(rnd() * l.length)];
const visible = (el) => !!(el.offsetParent || el.getClientRects().length);
let clicks = 0, actions = new Map();
for (let it = 0; it < ITER; it++) {
  // let time pass; answer any events by clicking a choice now and then
  const days = 10 + Math.floor(rnd() * 90);
  for (let d = 0; d < days; d++) {
    try { window.LW.simDay(); } catch (e) { note('simDay', e.message); }
    for (const p of [...(G.state.pendingEvents || [])]) { try { ui.eventModal(p); const b = [...document.querySelectorAll('[data-action="eventChoice"]')]; if (b.length) { pick(b).click(); clicks++; } else ui.hideModal(); } catch (e) { note('event', e.message); } }
  }
  if (!G.state.civs[G.state.playerId]?.alive) { note('info', 'player realm fell — took over another realm'); const D = await import('./src/sim/disasters.js'); const o = G.state.civs.filter((c) => c.alive && c.settlements.length).sort((a, b) => b.settlements.length - a.settlements.length)[0]; if (o) D.setPlayer(o.id); }
  // open a random panel and press a few of its buttons
  try { ui.openPanel(pick(PANEL_ORDER)[0]); } catch (e) { note('openPanel', e.message); }
  await sleep(5);
  for (let k = 0; k < 3; k++) {
    const els = [...document.querySelectorAll('[data-action]')].filter((el) => !el.disabled && visible(el) && !SKIP.has(el.dataset.action));
    if (!els.length) break;
    const el = pick(els);
    actions.set(el.dataset.action, (actions.get(el.dataset.action) || 0) + 1);
    try { el.click(); clicks++; } catch (e) { note('click ' + el.dataset.action, e.message); }
    await sleep(2);
    // map-picking modes (build here, recruit, explore) wait for a map click: cancel them
    if (G.ui.pick || G.ui.mode) { G.ui.pick = null; }
  }
  // selects and toggles in the open panel
  const sels = [...document.querySelectorAll('select[data-input], input[type=checkbox][data-input]')].filter(visible);
  if (sels.length && rnd() < 0.3) { const s = pick(sels); try { if (s.tagName === 'SELECT' && s.options.length) { s.selectedIndex = Math.floor(rnd() * s.options.length); } else s.checked = !s.checked; s.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { note('input', e.message); } }
  if (rnd() < 0.05) { try { I.initI18n(rnd() < 0.5 ? 'uk' : 'en'); } catch (e) { note('lang', e.message); } }
  if (rnd() < 0.3) { try { ui.hideModal(); } catch (e) { note('hideModal', e.message); } }
  // invariants
  for (const c of G.state.civs) {
    if (!c.alive) continue;
    for (const k of ['treasury', 'stability', 'inflation']) if (c[k] != null && !Number.isFinite(c[k])) note('NaN', `${c.baseName}.${k} = ${c[k]}`);
    for (const g in c.stock) if (!Number.isFinite(c.stock[g])) note('NaN', `${c.baseName}.stock.${g}`);
  }
  for (const s of G.state.settlements) if (!s.dead && (!Number.isFinite(s.pop) || !Number.isFinite(s.housing))) note('NaN', `settlement ${s.name} pop/housing`);
  try { window.LW.renderer.draw(0.016, 0.5, true); } catch (e) { note('draw', e.message); }
}
for (const e of window.LW.errors || []) note('guard ' + e.where, e.message + ' @ ' + (e.stack || '').split('\n')[1]?.trim());
console.error('BUGHUNT ' + JSON.stringify({ seed: SEED, iterations: ITER, clicks, year: Math.floor(G.state.day / 360), distinctActions: actions.size, found: [...found].map(([k, n]) => `${n}× ${k}`) }, null, 1));
window.__shots = [];
