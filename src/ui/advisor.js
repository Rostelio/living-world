// Phase 21 — the advisor: a small card with a portrait that reads the state of the realm and
// suggests what to do next (most urgent first). Click the advice to open the right panel.
import { G, S, player } from '../sim/state.js';
import { projectLedger } from '../sim/economy.js';
import { storageCaps } from '../sim/settlements.js';
import { warsOf, militaryStrength, coalitionStrength } from '../sim/diplomacy.js';
import { adminShare } from '../sim/latebalance.js';
import { MISSIONS, DECISION_LIST, canTakeDecision, DECISIONS, routeRaided } from '../sim/depth.js';
import { canOpenRoute, linkedForTrade, routeBetween } from '../sim/markets.js';
import { SETTINGS } from './settings.js';

const setts = (c) => c.settlements.map((id) => S().settlements[id]).filter(Boolean);
// Each tip: [severity 0..3, text, panel to open]
export function adviceFor(c) {
  const st = S(), out = [];
  const L = projectLedger(c);
  const caps = storageCaps(c);
  if (!c.research.current && !c.autoResearch) out.push([3, 'Our scholars sit idle. Choose something to research.', 'technology']);
  const idle = setts(c).filter((s) => !s.queue.length);
  if (idle.length && !c.autoBuild) out.push([2, `${idle.length === 1 ? idle[0].name + ' has' : idle.length + ' settlements have'} nothing to build. Idle builders waste a season.`, 'construction']);
  if (L.starving || (c.stock.grain || 0) < caps.grain * 0.08) out.push([3, 'The granaries are nearly empty. Build farms or pastures, or fish from the coast, before hunger comes.', 'construction']);
  if ((c.stock.wood || 0) < 15 && c.settlements.length <= 3) out.push([2, 'We are short of wood. A lumber camp near woodland keeps the houses going up.', 'construction']);
  if (L.net.gold < -0.5 && c.treasury < L.tax * 6) out.push([3, `We lose ${Math.round(-L.net.gold)} gold a month. Raise taxes, cut costs or open trade.`, 'economy']);
  if (c.stability < 35) out.push([3, `Stability is ${Math.round(c.stability)}. Unrest and revolts follow. Temples, lower taxes and popular laws help.`, 'government']);
  const restless = setts(c).filter((s) => (s.unrest || 0) > 60);
  if (restless.length) out.push([2, `${restless[0].name}${restless.length > 1 ? ` and ${restless.length - 1} more` : ''} may rise in revolt. Station troops or ease the burden.`, 'population']);
  if ((c.inflation || 0) > 8) out.push([2, `Hoarded gold drives prices up ${Math.round(c.inflation)}%. Spend it: a great work, patronage, or an army.`, 'economy']);
  if (adminShare(c) >= 0.12) out.push([1, `Governing so many towns costs ${Math.round(adminShare(c) * 100)}% of our income. Town halls, a Grand Palace or codified laws extend our reach.`, 'economy']);
  for (const o of st.civs) if (o.alive && o.ambition?.def === c.id) { out.push([2, `${o.displayName} has set its sights on us: it wants to ${o.ambition.type === 'region' ? 'take ' + (st.settlements[o.ambition.target]?.name || 'our land') : 'humble us'}. Allies and walls will help.`, 'diplomacy']); break; }
  if (st.coalition?.target === c.id) out.push([3, `A coalition of ${st.coalition.members.length} realms has formed against us. Make friends, or be ready for war.`, 'diplomacy']);
  for (const w of warsOf(c.id)) {
    const foes = w.att.includes(c.id) ? w.def : w.att;
    const theirs = foes.reduce((s, f) => s + coalitionStrength(f), 0);
    if (theirs > coalitionStrength(c.id) * 1.3) { out.push([3, `In the ${w.name} the enemy is stronger. Hire mercenaries, call allies, or seek peace.`, 'military']); break; }
  }
  for (const r of st.routes || []) if ((r.a === c.id || r.b === c.id) && routeRaided(r) && !r.escort?.[c.id]) { out.push([1, 'Raiders cut one of our trade routes. An escort keeps the caravans safe.', 'economy']); break; }
  const partner = st.civs.find((o) => o.alive && o.id !== c.id && linkedForTrade(c.id, o.id) && !routeBetween(c.id, o.id) && canOpenRoute(c.id, o.id).ok);
  if (partner) out.push([1, `We could open a caravan route with ${partner.baseName}.`, 'economy']);
  const dec = DECISION_LIST.find((id) => canTakeDecision(c, id).ok);
  if (dec) out.push([1, `A great decision is ready: ${DECISIONS[dec].name}.`, 'missions']);
  for (const id of c.missions?.active || []) { const [cur, goal] = MISSIONS[id].check(c); if (cur / goal >= 0.75 && cur < goal) { out.push([0, `Nearly there: ${MISSIONS[id].name} (${cur}/${goal}).`, 'missions']); break; } }
  const sender = setts(c).find((s) => s.pop >= 45);
  if (sender && c.settlements.length < 4 && st.day > 360 * 2) out.push([1, `${sender.name} is big enough to send settlers. Right-click a free province nearby to found a new town.`, null]);
  if (!out.length) out.push([0, militaryStrength(c.id) < 5 ? 'All is quiet. A few regiments would keep it that way.' : 'All is well in the realm. Grow, trade, and plan your next great work.', 'overview']);
  return out.sort((a, b) => b[0] - a[0]);
}

// a little portrait: an old counsellor with a grey beard and a scholar's cap (24×24)
function portrait() {
  const c = document.createElement('canvas'); c.width = 24; c.height = 24;
  const x = c.getContext('2d');
  const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  P(0, 0, 24, 24, '#2c2014'); P(1, 1, 22, 22, '#4a3a5a');
  P(6, 16, 12, 8, '#5a3a7a'); P(6, 16, 12, 1, '#7a5a9a'); // robe
  P(8, 6, 8, 9, '#e8c4a0'); P(8, 6, 2, 9, '#f4d8b8'); // face
  P(9, 9, 2, 1, '#2a1a10'); P(13, 9, 2, 1, '#2a1a10'); // eyes
  P(7, 12, 10, 6, '#d8d8d0'); P(9, 18, 6, 2, '#c8c8c0'); P(11, 13, 2, 1, '#8a6a5a'); // beard, mouth
  P(7, 3, 10, 4, '#3a2a5a'); P(9, 1, 6, 2, '#3a2a5a'); P(11, 0, 2, 1, '#e6c068'); // cap and tassel
  return c.toDataURL();
}

let idx = 0, last = 0, tips = [];
export function initAdvisor(openPanel) {
  if (document.getElementById('advisor')) return;
  const el = document.createElement('div');
  el.id = 'advisor';
  el.className = 'hidden';
  el.innerHTML = `<img alt="" src="${portrait()}"><div class="adv-body"><div class="adv-head"><b>Advisor</b><span class="adv-nav"><button data-adv="prev" title="Previous">‹</button><span class="adv-n"></span><button data-adv="next" title="Next">›</button><button data-adv="hide" title="Hide (turn it back on in Settings)">×</button></span></div><div class="adv-text"></div></div>`;
  document.getElementById('app').appendChild(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-adv]');
    if (b) { e.stopPropagation(); if (b.dataset.adv === 'next') idx++; else if (b.dataset.adv === 'prev') idx--; else { SETTINGS.advisor = false; el.classList.add('hidden'); return; } render(); return; }
    const t = tips[((idx % tips.length) + tips.length) % tips.length];
    if (t?.[2]) openPanel(t[2]);
  });
}
function render() {
  const el = document.getElementById('advisor');
  if (!el || !tips.length) return;
  const i = ((idx % tips.length) + tips.length) % tips.length;
  const [sev, text] = tips[i];
  el.querySelector('.adv-text').textContent = text;
  el.querySelector('.adv-n').textContent = `${i + 1}/${tips.length}`;
  el.dataset.sev = sev;
}
// called every frame-ish; refreshes the advice every two seconds
export function updateAdvisor(show) {
  const el = document.getElementById('advisor');
  if (!el) return;
  const on = show && SETTINGS.advisor !== false && G.state && player()?.alive;
  el.classList.toggle('hidden', !on);
  if (!on) return;
  const now = performance.now();
  if (now - last < 2000) return;
  last = now;
  const prevTop = tips[0]?.[1];
  tips = adviceFor(player());
  if (tips[0]?.[1] !== prevTop) idx = 0;
  render();
}
