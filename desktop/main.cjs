// Living World — desktop shell (Electron).
// Serves the game from a private app:// scheme so ES modules load without a web server.
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const SMOKE = process.env.LW_SMOKE_TEST === '1';
const DIAG = process.env.LW_DIAG === '1';
const SHOT = process.env.LW_SHOT || ''; // directory: render a few screenshots and quit
// Test runs get their own storage so they never touch the player's saves.
if (SMOKE || DIAG || SHOT) app.setPath('userData', path.join(app.getPath('temp'), 'living-world-test'));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function serveApp() {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
    if (!require('fs').existsSync(file)) return new Response('Not found', { status: 404 }); // e.g. a sprite not drawn yet
    return net.fetch(pathToFileURL(file).toString());
  });
}

function buildMenu(win) {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Game',
      submenu: [
        { label: 'Toggle Full Screen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => win.reload() },
        { label: 'Open Error Log', click: () => shell.openPath(path.join(app.getPath('userData'), 'error.log')) },
        { label: 'Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => win.webContents.toggleDevTools() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    backgroundColor: '#120e0a',
    title: 'Living World',
    show: !SMOKE,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: !(SMOKE || DIAG || SHOT) },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Keep in-page shortcuts (Ctrl/Cmd+S quick save) working; never navigate away.
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  // Keep a log of in-game errors so problems can be diagnosed (Game → Open Error Log).
  const fs = require('fs');
  win.webContents.on('console-message', (e) => {
    if (e.level !== 'error') return;
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'error.log'), `${new Date().toISOString()} ${e.message} (${e.sourceId || ''}:${e.lineNumber || ''})\n`); } catch { /* ignore */ }
  });
  buildMenu(win);
  win.loadURL('app://game/index.html');
  if (SMOKE) runSmokeTest(win);
  if (DIAG) runDiag(win);
  if (SHOT) runShots(win);
  return win;
}

// Headless self-test used by `npm run smoke`: start a world, simulate, report, quit.
function runSmokeTest(win) {
  win.webContents.on('console-message', (e) => { if (e.level === 'warning' || e.level === 'error') console.log('[page]', e.message, e.sourceId || '', e.lineNumber || ''); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        await new Promise((r) => setTimeout(r, 500));
        document.getElementById('ssStart').click();
        await new Promise((r) => setTimeout(r, 2500));
        const { G, simDay } = window.LW;
        // real game loop must advance time on its own
        const errs = [];
        window.addEventListener('error', (e) => errs.push(e.message + ' ' + (e.error && e.error.stack || '').slice(0, 400)));
        const d0 = G.state.day;
        window.LW.setSpeed ? window.LW.setSpeed(3) : document.querySelectorAll('.speed button')[3].click();
        await new Promise((r) => setTimeout(r, 3000));
        const loopDays = G.state.day - d0;
        if (loopDays < 1) return { ok: false, error: 'game loop does not advance', errs };
        const t0 = performance.now();
        for (let i = 0; i < 360 * 20; i++) simDay();
        localStorage.setItem('lw.smoke', '1');
        return { ok: true, loopDays, errs, day: G.state.day, civs: G.state.civs.length, settlements: G.state.settlements.length, ms: Math.round(performance.now() - t0), storage: localStorage.getItem('lw.smoke') };
      })()`);
      console.log('SMOKE_RESULT ' + JSON.stringify(result));
    } catch (e) {
      console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, error: String(e) }));
    }
    app.quit();
  });
}

// Diagnostic: try every stored save with the real game loop.
function runDiag(win) {
  win.webContents.on('console-message', (e) => { if (e.level === 'warning' || e.level === 'error') console.log('[page]', e.message, e.sourceId || '', e.lineNumber || ''); });
  win.webContents.once('did-finish-load', async () => {
    const r = await win.webContents.executeJavaScript(`(async () => {
      const out = [];
      const errs = [];
      window.addEventListener('error', (e) => errs.push(e.message + ' ' + (e.error && e.error.stack || '').slice(0, 600)));
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('livingworld.save.') && !k.endsWith('.meta'));
      out.push({ keys, settings: Object.keys(localStorage).filter((k) => !k.startsWith('livingworld.save.')) });
      // real interactive loop in a visible window
      await new Promise((r) => setTimeout(r, 800));
      document.getElementById('ssStart').click();
      await new Promise((r) => setTimeout(r, 3000));
      const a0 = window.LW.G.state.day;
      [...document.querySelectorAll('.speed button')][3].click();
      await new Promise((r) => setTimeout(r, 4000));
      out.push({ newGameLoop: window.LW.G.state.day - a0, modal: !!document.querySelector('#modal:not(.hidden) .modal-box'), errs: [...errs] });
      const recipes = [{ size: 'medium', race: 'humans', aiCount: 7 }, { size: 'small', mapType: 'continents', seed: 4111, aiCount: 5, startEra: 0, race: 'elves' }, { size: 'medium', mapType: 'archipelago', seed: 7302, aiCount: 7, startEra: 1, race: 'orcs' }, { size: 'large', mapType: 'pangaea', seed: 9157, aiCount: 9, startEra: 2, race: 'dwarves' }, { size: 'medium', mapType: 'highlands', seed: 2468, aiCount: 7, startEra: 0, race: 'halflings' }];
      for (const r of recipes) {
        window.LW.start(r);
        await new Promise((res) => setTimeout(res, 2500));
        const b0 = window.LW.G.state.day;
        [...document.querySelectorAll('.speed button')][5].click();
        for (let i = 0; i < 6; i++) { await new Promise((res) => setTimeout(res, 1000)); const c = document.querySelector('[data-action=eventChoice]'); if (c) c.click(); }
        [...document.querySelectorAll('.speed button')][0].click();
        out.push({ recipe: r.mapType || 'default', days: window.LW.G.state.day - b0, loopErrors: window.LW.errors.slice(), errs: [...errs] });
      }
      const SV = await import('./src/sim/save.js');
      for (const k of keys) {
        errs.length = 0;
        const slot = k.slice('livingworld.save.'.length);
        try {
          const meta = JSON.parse(localStorage.getItem(k + '.meta') || '{}');
          const btn = [...document.querySelectorAll('[data-slot]')].find((b) => b.dataset.slot === slot);
          SV.loadGame(slot);
          const d0 = window.LW.G.state.day;
          let simErr = null;
          try { for (let i = 0; i < 60; i++) window.LW.simDay(); } catch (e) { simErr = String(e.stack).slice(0, 800); }
          out.push({ slot, version: meta.version, d0, d1: window.LW.G.state.day, simErr, errs: [...errs] });
        } catch (e) { out.push({ slot, loadErr: String(e.stack).slice(0, 800) }); }
      }
      return out;
    })()`).catch((e) => String(e));
    console.log('DIAG ' + JSON.stringify(r, null, 1));
    app.quit();
  });
}

// Screenshot mode: LW_SHOT=<dir> LW_SHOT_SCRIPT=<js returning a list of steps>
function runShots(win) {
  const fs = require('fs');
  win.webContents.on('console-message', (e) => { if (e.level === 'error') console.log('[page]', e.message); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const script = fs.readFileSync(process.env.LW_SHOT_SCRIPT, 'utf8');
      await win.webContents.executeJavaScript(`(async () => { ${script}\n })()`);
      const n = await win.webContents.executeJavaScript('window.__shots.length');
      for (let i = 0; i < n; i++) {
        await win.webContents.executeJavaScript(`window.__shots[${i}]()`);
        await new Promise((r) => setTimeout(r, Number(process.env.LW_SHOT_WAIT || 700)));
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SHOT, `shot${i}.png`), img.resize({ width: 1200 }).toPNG());
      }
      // files the script wants written (e.g. art slot templates): [{ name, data: dataURL | text }]
      const files = await win.webContents.executeJavaScript('window.__files || []');
      for (const f of files) {
        const out = path.join(SHOT, f.name);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, f.data.startsWith('data:') ? Buffer.from(f.data.split(',')[1], 'base64') : f.data);
      }
      console.log('SHOTS_DONE', n, 'FILES', files.length);
    } catch (e) { console.log('SHOTS_FAIL', String(e)); }
    app.quit();
  });
}

app.whenReady().then(() => {
  serveApp();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin' || SMOKE || DIAG || SHOT) app.quit(); });
