// Phase 14 — faster controls: right-click context menu on the map, search (/ or Ctrl+F),
// and hotkeys for common actions.
import { G, S, player } from '../sim/state.js';
import { escapeHtml as E } from '../core/util.js';
import { canColonize } from '../sim/colonize.js';
import { fogOn, isExplored, knowsRealm, sendExplorer } from '../sim/fog.js';
import { STAGES } from '../data/buildings.js';

let hooks = {};
export function initQuick(h) { hooks = h; }
const $ = (id) => document.getElementById(id);

// ---------- context menu ----------
export function openContextMenu(x, y, tile) {
  const st = S();
  const W = G.world;
  const me = player();
  if (tile < 0) return;
  const pid = W.province[tile];
  const items = [];
  if (fogOn() && !isExplored(tile)) items.push(['🧭', 'Send an expedition here', () => hooks.toastResult(sendExplorer(me, tile), 'The expedition sets out.')]);
  else if (pid >= 0) {
    const ps = st.provinces[pid];
    const s = ps.settlement >= 0 ? st.settlements[ps.settlement] : null;
    const P = W.provinces[pid];
    items.push(['🔍', `Inspect ${E(s ? s.name : P.name)}`, () => hooks.selectProvince(pid)]);
    if (s && s.civ === me.id) {
      items.push(['🏗', 'Build here…', () => { G.ui.buildSid = s.id; hooks.openPanel('construction'); }]);
      items.push(['⚔', 'Recruit here…', () => { hooks.selectProvince(pid); }]);
      if (s.queue.length) items.push(['⏳', `Building: ${s.queue.length} in queue`, () => { G.ui.buildSid = s.id; hooks.openPanel('construction'); }]);
    } else if (ps.owner < 0) {
      const c = canColonize(me, pid);
      items.push(['🏕', c.ok ? 'Send settlers here' : `Settlers: ${E(c.reason || 'not possible')}`, c.ok ? () => hooks.colonize(pid) : null]);
      if (fogOn()) items.push(['🧭', 'Send an expedition here', () => hooks.toastResult(sendExplorer(me, tile), 'The expedition sets out.')]);
    } else if (ps.owner !== me.id) {
      const o = st.civs[ps.owner];
      if (knowsRealm(o.id)) {
        items.push(['✉', `Diplomacy with ${E(o.baseName)}`, () => { G.ui.diploFocus = o.id; hooks.openPanel('diplomacy'); }]);
        items.push(['👑', `View their court`, () => { G.ui.diploFocus = o.id; hooks.openPanel('diplomacy'); }]);
      }
    }
    if (st.sandbox) items.push(['✦', 'God powers: pick one in the bar below', null]);
  }
  items.push(['⌖', 'Centre the map here', () => hooks.focusTile(tile)]);
  const m = $('ctxMenu');
  m.innerHTML = items.map(([ic, label, fn], i) => `<button class="cm-item" data-i="${i}" ${fn ? '' : 'disabled'}><span class="cm-ic">${ic}</span>${label}</button>`).join('');
  m.classList.remove('hidden');
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  m.onclick = (e) => { const b = e.target.closest('.cm-item'); if (!b || b.disabled) return; const fn = items[+b.dataset.i][2]; closeContextMenu(); fn?.(); };
}
export function closeContextMenu() { $('ctxMenu')?.classList.add('hidden'); }
window.addEventListener('pointerdown', (e) => { if (!e.target.closest('#ctxMenu')) closeContextMenu(); }, true);

// ---------- search ----------
export function openSearch() {
  const st = S();
  if (!st) return;
  const box = $('searchBox');
  box.classList.remove('hidden');
  box.innerHTML = '<input id="searchInput" placeholder="Find a settlement, realm or province…" autocomplete="off"><div id="searchResults"></div><div class="small muted">Enter: go · Esc: close</div>';
  const inp = $('searchInput');
  const render = () => {
    const q = inp.value.trim().toLowerCase();
    const res = [];
    if (q.length >= 1) {
      for (const s of st.settlements) if (!s.dead && isExplored(s.tile) && s.name.toLowerCase().includes(q)) res.push(['🏘', s.name, `${STAGES[s.stage].name} · ${st.civs[s.civ].baseName}`, s.tile, s.province]);
      for (const c of st.civs) if (c.alive && knowsRealm(c.id) && c.displayName.toLowerCase().includes(q)) { const cap = st.settlements[c.capital]; if (cap) res.push(['👑', c.displayName, 'realm', cap.tile, cap.province]); }
      G.world.provinces.forEach((P, i) => { if (P.name.toLowerCase().includes(q) && isExplored(P.center)) res.push(['▦', P.name, 'province', P.center, i]); });
    }
    box.results = res.slice(0, 12);
    $('searchResults').innerHTML = box.results.map(([ic, name, sub], i) => `<button class="sr ${i === 0 ? 'on' : ''}" data-i="${i}"><span>${ic}</span><b>${E(name)}</b><small>${E(sub)}</small></button>`).join('') || (q ? '<div class="small muted">Nothing found.</div>' : '');
  };
  const go = (i) => { const r = box.results?.[i]; if (!r) return; closeSearch(); hooks.focusTile(r[3]); hooks.selectProvince(r[4]); };
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(0); if (e.key === 'Escape') closeSearch(); e.stopPropagation(); });
  $('searchResults').onclick = (e) => { const b = e.target.closest('.sr'); if (b) go(+b.dataset.i); };
  inp.focus();
}
export function closeSearch() { $('searchBox')?.classList.add('hidden'); }
export const searchOpen = () => !$('searchBox')?.classList.contains('hidden');

// ---------- hotkeys ----------
let cycle = { town: -1, army: -1 };
export function quickKey(k, e) {
  const st = S();
  const me = player();
  if (!st || !me) return false;
  if (k === '/' || ((e.ctrlKey || e.metaKey) && k === 'f')) { e.preventDefault(); openSearch(); return true; }
  if (e.ctrlKey || e.metaKey) return false;
  const setts = me.settlements.map((id) => st.settlements[id]);
  if (k === 'tab') {
    e.preventDefault();
    if (!setts.length) return true;
    cycle.town = (cycle.town + (e.shiftKey ? -1 : 1) + setts.length) % setts.length;
    const s = setts[cycle.town]; hooks.focusTile(s.tile); hooks.selectProvince(s.province);
    return true;
  }
  if (k === 'n') {
    const idle = setts.filter((s) => !s.queue.length);
    if (!idle.length) { hooks.toast('Every settlement is building something.', 'info'); return true; }
    cycle.town = (cycle.town + 1) % idle.length;
    const s = idle[cycle.town % idle.length]; hooks.focusTile(s.tile); G.ui.buildSid = s.id; hooks.openPanel('construction');
    return true;
  }
  if (k === 'b') {
    const sel = G.ui.ctx != null ? st.provinces[G.ui.ctx]?.settlement : -1;
    const s = sel >= 0 && st.settlements[sel]?.civ === me.id ? st.settlements[sel] : st.settlements[me.capital];
    if (s) { G.ui.buildSid = s.id; hooks.openPanel('construction'); }
    return true;
  }
  if (k === 'q') {
    const armies = st.armies.filter((a) => a.civ === me.id);
    if (!armies.length) { hooks.toast('No armies.', 'info'); return true; }
    cycle.army = (cycle.army + 1) % armies.length;
    const a = armies[cycle.army]; hooks.focusTile(a.tile); hooks.selectArmy(a.id);
    return true;
  }
  if (k === 'f') { G.ui.follow = G.ui.ctxArmy != null && !G.ui.follow ? G.ui.ctxArmy : null; hooks.toast(G.ui.follow != null ? 'Following the army (F to stop).' : 'Stopped following.', 'info'); return true; }
  return false;
}
