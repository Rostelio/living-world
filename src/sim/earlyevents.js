// Phase 19 — small happenings for young realms (one or two settlements), so the first decades
// are not empty, and the coalition invitation raised by latebalance.js.
import { G, S, civOf } from './state.js';
import { invalidateMods } from './mods.js';
import { storageCaps } from './settlements.js';
import { joinCoalition } from './latebalance.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const setts = (c) => c.settlements.map((id) => S().settlements[id]).filter(Boolean);
const home = (c) => S().settlements[c.capital] || setts(c)[0];
const young = (c) => c.settlements.length <= 2 && (home(c)?.stage ?? 9) <= 1;
const stab = (c, v) => { c.stability = clamp(c.stability + v, 0, 100); };
const add = (c, g, n) => { c.stock[g] = clamp((c.stock[g] || 0) + n, 0, storageCaps(c)[g === 'fish' ? 'grain' : g] ?? 9999); };
const people = (c, n) => { const s = home(c); if (!s) return; const f = (s.pop + n) / Math.max(1, s.pop); s.pop += n; if (s.pops) for (const k in s.pops) s.pops[k] *= f; s.housing = Math.max(s.housing, Math.ceil(s.pop * 1.05)); };
const addMod = (c, name, fx, months) => { c.modifiers ??= []; c.modifiers.push({ name, fx, until: S().day + months * 30 }); invalidateMods(c); };
const learn = (c, n) => { c.research.pool += n; };
const hname = (c) => home(c)?.name || 'our camp';
const P = (c) => G.world.provinces[home(c)?.province] || {};

export const EARLY_EVENTS = [
  {
    id: 'early_wanderers', title: 'Wanderers at the Fire', weight: 1.4, cond: (c) => young(c),
    text: (c) => `A ragged band of wanderers — a dozen men, women and children — comes to the fires of ${hname(c)} and asks to stay.`,
    options: [
      { label: 'Welcome them', desc: '+12 people, −20 grain', ai: 1.4, fx: (c) => { people(c, 12); add(c, 'grain', -20); } },
      { label: 'Trade with them and send them on', desc: '+15 gold', ai: 0.6, fx: (c) => { c.treasury += 15; } },
    ],
  },
  {
    id: 'early_herd', title: 'A Wild Herd', weight: 1.2, cond: (c) => young(c),
    text: (c) => `Hunters from ${hname(c)} have found a great herd of wild cattle grazing in a hidden valley.`,
    options: [
      { label: 'A great hunt', desc: '+60 grain now', ai: 1, fx: (c) => add(c, 'grain', 60) },
      { label: 'Try to tame them', desc: '+8% food for 10 years', ai: 1, fx: (c) => addMod(c, 'Tamed herds', { food: 0.08 }, 120) },
    ],
  },
  {
    id: 'early_cave', title: 'The Painted Cave', weight: 1, cond: (c) => young(c),
    text: (c) => `Children playing near ${hname(c)} crawled into a cave whose walls are painted with beasts and strange stars.`,
    options: [
      { label: 'Study the paintings', desc: '+40 research', ai: 1, fx: (c) => learn(c, 40) },
      { label: 'Make it a sacred place', desc: '+5 stability for 5 years', ai: 1, fx: (c) => addMod(c, 'Sacred cave', { stability: 5 }, 60) },
    ],
  },
  {
    id: 'early_smith', title: 'A Travelling Smith', weight: 1, cond: (c) => young(c) && c.treasury >= 20,
    text: () => 'A smith with a cart of tools and a little iron offers to work for us through the winter.',
    options: [
      { label: 'Hire the smith', desc: '−20 gold; +15 tools, +10 iron', ai: 1, fx: (c) => { c.treasury -= 20; add(c, 'tools', 15); add(c, 'iron', 10); } },
      { label: 'We cannot spare the coin', desc: 'Nothing happens', ai: 0.5, fx: () => {} },
    ],
  },
  {
    id: 'early_caravan', title: 'A Trading Caravan', weight: 1.2, cond: (c) => young(c) && (c.stock.grain || 0) > 60,
    text: (c) => `A caravan of pack animals winds into ${hname(c)}. Its traders want grain for the road and pay in good coin — or in timber.`,
    options: [
      { label: 'Sell grain for gold', desc: '−40 grain, +30 gold', ai: 1, fx: (c) => { add(c, 'grain', -40); c.treasury += 30; } },
      { label: 'Trade grain for timber', desc: '−40 grain, +50 wood', ai: 1, fx: (c) => { add(c, 'grain', -40); add(c, 'wood', 50); } },
      { label: 'Keep our grain', desc: 'Nothing happens', ai: 0.4, fx: () => {} },
    ],
  },
  {
    id: 'early_wolves', title: 'Wolves in the Night', weight: 1, cond: (c) => young(c),
    text: (c) => `A wolf pack has been taking sheep from the pens of ${hname(c)}. The herders are afraid to sleep.`,
    options: [
      { label: 'Hunt them down', desc: '−4 people, +3 stability, +20 grain', ai: 1, fx: (c) => { people(c, -4); stab(c, 3); add(c, 'grain', 20); } },
      { label: 'Build stout pens', desc: '−15 wood, +2 stability', ai: 1, fx: (c) => { add(c, 'wood', -15); stab(c, 2); } },
    ],
  },
  {
    id: 'early_storyteller', title: 'The Storyteller', weight: 1, cond: (c) => young(c),
    text: () => 'An old storyteller arrives with tales of distant peoples, rich valleys and the roads between them.',
    options: [
      { label: 'Listen to the tales', desc: '+4 stability for 3 years', ai: 1, fx: (c) => addMod(c, 'Old tales', { stability: 4 }, 36) },
      { label: 'Ask about the lands around us', desc: '+30 research', ai: 1, fx: (c) => learn(c, 30) },
    ],
  },
  {
    id: 'early_fish', title: 'The Fish Are Running', weight: 1.2, cond: (c) => young(c) && (P(c).coastal || P(c).river),
    text: (c) => `The waters by ${hname(c)} are thick with fish this season — nets come up full every morning.`,
    options: [
      { label: 'Fish day and night', desc: '+80 grain', ai: 1, fx: (c) => add(c, 'grain', 80) },
      { label: 'Hold a feast', desc: '+40 grain, +4 stability', ai: 1, fx: (c) => { add(c, 'grain', 40); stab(c, 4); } },
    ],
  },
  {
    id: 'early_storm_wood', title: 'Fallen Timber', weight: 1.3, cond: (c) => young(c) && (c.stock.wood || 0) < 80,
    text: () => 'A great storm has felled a stand of old trees a day\'s walk from camp. The trunks lie ready for the axe.',
    options: [
      { label: 'Send everyone to haul it', desc: '+70 wood, −2 stability', ai: 1.2, fx: (c) => { add(c, 'wood', 70); stab(c, -2); } },
      { label: 'Take only what we need', desc: '+35 wood', ai: 1, fx: (c) => add(c, 'wood', 35) },
    ],
  },
  {
    id: 'early_rivals', title: 'Strangers Camp Nearby', weight: 0.9, cond: (c) => young(c),
    text: (c) => `Another band has made camp a few hours from ${hname(c)}. Their scouts watch our hunters.`,
    options: [
      { label: 'Drive them away', desc: '+5 stability, −3 people', ai: 1, fx: (c) => { stab(c, 5); people(c, -3); } },
      { label: 'Invite them to join us', desc: '+18 people, −30 grain, −3 stability', ai: 1, fx: (c) => { people(c, 18); add(c, 'grain', -30); stab(c, -3); } },
    ],
  },
  {
    id: 'early_elder', title: 'The Elder Passes', weight: 0.8, cond: (c) => young(c),
    text: (c) => `The eldest of ${hname(c)}, who remembered the old ways, has died. The people gather to choose who will advise the chief.`,
    options: [
      { label: 'A wise woman', desc: '+10% knowledge for 10 years', ai: 1, fx: (c) => addMod(c, 'Wise counsel', { knowledge: 0.1 }, 120) },
      { label: 'A strong hunter', desc: '+10% food for 10 years', ai: 1, fx: (c) => addMod(c, 'Hunter\'s counsel', { food: 0.1 }, 120) },
    ],
  },
  {
    id: 'early_festival', title: 'First Harvest', weight: 1, cond: (c) => young(c) && (c.stock.grain || 0) > 80,
    text: () => 'The first good harvest is in. The people want to dance and give thanks.',
    options: [
      { label: 'A great festival', desc: '−40 grain, +6 stability, +5% growth for 5 years', ai: 1, fx: (c) => { add(c, 'grain', -40); stab(c, 6); addMod(c, 'Harvest festival', { growth: 0.05 }, 60); } },
      { label: 'Store it for winter', desc: 'Nothing lost', ai: 0.6, fx: () => {} },
    ],
  },
  // raised by latebalance.js when a coalition forms against the strongest realm
  {
    id: 'coalition_invite', title: 'A Coalition Forms', weight: 0, cond: () => false,
    text: (c, x) => `Envoys arrive from realms alarmed by the might of ${civOf(x.t).displayName}. They have sworn to stand together against it and ask us to join them.`,
    options: [
      { label: 'Join the coalition', desc: 'Alliances with every member; they may call on us to march', ai: 1, fx: (c) => { joinCoalition(c.id); } },
      { label: 'Stay out of it', desc: 'Nothing changes', ai: 1, fx: () => {} },
    ],
  },
];
