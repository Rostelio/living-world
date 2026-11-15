// Phase 15 — "Learn to play": a guided first game with objectives that check themselves.
import { G, S, player } from '../sim/state.js';
import { escapeHtml as E } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const cap = () => S().settlements[player().capital];
const lvlAny = (b) => player().settlements.some((id) => (S().settlements[id].buildings[b] || 0) > 0 || S().settlements[id].queue.some((q) => q.type === b));
export const STEPS = [
  { t: 'Welcome to Living World', d: 'Drag the map or use WASD to look around, scroll to zoom. The game starts paused — press <b>Space</b> (or a speed button top-right) to let time flow.', done: () => G.ui.speed > 0 || S().day > 2, glow: '#tbSpeed' },
  { t: 'Choose research', d: 'Knowledge unlocks buildings and eras. Press <b>T</b> and pick a technology — <b>Agriculture</b> or <b>Stoneworking</b> are good first choices.', done: () => !!player().research.current || player().techs.length > 0, glow: '#nav [data-panel="technology"]' },
  { t: 'Build a Lumber Camp', d: 'Your people need wood. Press <b>B</b> to open Construction for your camp and build a <b>Lumber Camp</b>.', done: () => lvlAny('lumber_camp'), glow: '#nav [data-panel="construction"]' },
  { t: 'Feed your people', d: 'Build another <b>Farmstead</b> (level 2 needs a Village — until then, a Pasture or Quarry also helps). Farms are free of building slots.', done: () => (cap()?.buildings.farm || 0) >= 2 || lvlAny('pasture') || lvlAny('quarry'), glow: '#nav [data-panel="construction"]' },
  { t: 'Read the Overview', d: 'Press <b>V</b> any time: it shows your rank, money, what needs attention, and what every settlement is building.', done: () => !!G.ui.seen?.overview, glow: '#nav [data-panel="overview"]' },
  { t: 'Grow into a Village', d: 'Let time pass (keys <b>1–5</b> change speed). At about 60 people your camp becomes a <b>Village</b>, with more building slots.', done: () => (cap()?.stage || 0) >= 1 },
  { t: 'Expand your realm', d: '<b>Right-click</b> an empty province next to your lands and choose <b>Send settlers</b>. New settlements claim more land and resources.', done: () => player().settlements.length >= 2 || S().units.some((u) => u.civ === player().id) },
  { t: 'Become a kingdom', d: 'Research <b>Code of Laws</b>, then reform into a <b>Monarchy</b> in the Government panel (<b>G</b>): more stability and a proper royal court.', done: () => player().gov !== 'tribal', glow: '#nav [data-panel="government"]' },
  { t: 'Open a market', d: 'With <b>Currency</b>, build a <b>Market</b>. Markets are tiers that steady prices and open trade routes.', done: () => lvlAny('market'), glow: '#nav [data-panel="construction"]' },
  { t: 'Make a friend', d: 'In Diplomacy (<b>R</b>), propose a <b>trade agreement</b> or alliance with a neighbour. Trade brings gold and goods.', done: () => S().civs.some((c) => c.id !== player().id && (G.diplo?.rel?.(player().id, c.id)?.trade || G.diplo?.rel?.(player().id, c.id)?.ally)), glow: '#nav [data-panel="diplomacy"]' },
  { t: 'Open a caravan route', d: 'With a market and a trade partner, open a <b>caravan route</b> in the Economy panel (<b>E</b>). Watch the caravans travel the map; in wartime, an escort keeps raiders away.', done: () => (S().routes || []).some((r) => r.a === player().id || r.b === player().id) },
  { t: 'Follow your missions', d: 'Press <b>U</b> for <b>Missions</b>: a few goals that fit your realm right now, each with a reward, and great <b>decisions</b> you can take once the realm is ready. The <b>advisor</b> in the corner also suggests what to do next.', done: () => !!G.ui.seenMissions },
  { t: 'Raise an army', d: 'Neighbours may covet your land. In the Military panel (<b>M</b>) — or by selecting your capital — recruit a few regiments.', done: () => S().armies.some((a) => a.civ === player().id), glow: '#nav [data-panel="military"]' },
  { t: 'Shape your laws', d: 'In Politics (<b>O</b>) pick a law to debate. Each pleases some interest groups and angers others.', done: () => !!player().enact || Object.keys(player().laws || {}).some((k) => player().laws[k] !== ({ land: 'serfdom', tax: 'land_tax', trade: 'mercantilism', church: 'state_religion', army: 'peasant_levies', school: 'no_schools', labor: 'no_protections', welfare: 'no_welfare' })[k]), glow: '#nav [data-panel="politics"]' },
  { t: 'Look things up', d: 'Press <b>I</b> to open the <b>Encyclopedia</b>: every good, building, law, trait and mechanic explained.', done: () => !!G.ui.seen?.encyclopedia },
  { t: 'You know the basics!', d: 'The world is yours now: grow, trade, marry, scheme and conquer. Your <b>score and rank</b> sit in the top bar; open the game menu for the full standings. Good luck!', done: () => false, final: true },
];

export function tutorialActive() { return !!S()?.tutorial && !S().tutorial.done; }
export function startTutorial(st) { st.tutorial = { step: 0, done: false }; }
export function updateTutorial() {
  const box = $('tutorial');
  if (!box) return;
  document.querySelectorAll('.tut-glow').forEach((x) => x.classList.remove('tut-glow'));
  if (!tutorialActive()) { box.classList.add('hidden'); return; }
  const T = S().tutorial;
  let s = STEPS[T.step];
  while (s && !s.final && safe(s.done)) { T.step++; s = STEPS[T.step]; }
  if (!s) { T.done = true; box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const html = `<div class="tut-head"><span>📜 Learn to play · ${T.step + 1}/${STEPS.length}</span><button class="tut-x" data-tut="end" title="End the tutorial">✕</button></div>
    <div class="tut-title">${E(s.t)}</div><div class="tut-text">${s.d}</div>
    <div class="tut-bar"><i style="width:${(T.step / (STEPS.length - 1)) * 100}%"></i></div>
    <div class="tut-actions">${s.final ? '<button class="btn sm primary" data-tut="end">Finish</button>' : '<button class="btn sm" data-tut="skip">Skip this step</button>'}</div>`;
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
  if (s.glow) document.querySelectorAll(s.glow).forEach((x) => x.classList.add('tut-glow'));
}
function safe(fn) { try { return fn(); } catch { return false; } }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tut]');
  if (!b || !S()?.tutorial) return;
  if (b.dataset.tut === 'skip') S().tutorial.step++;
  else S().tutorial.done = true;
  updateTutorial();
});
