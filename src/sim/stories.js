// Phase 17 — living stories: multi-step event chains that unfold over months and years, and
// legendary heroes (generals, sages, saints, adventurers, architects) who rise, do great deeds,
// die and are remembered. Chain steps are scheduled in st.stories; heroes live in civ.heroes.
import { G, S, log, civOf } from './state.js';
import { invalidateMods } from './mods.js';
import { personName } from '../core/names.js';
import { remember } from './memory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const setts = (c) => c.settlements.map((id) => S().settlements[id]).filter(Boolean);
const largest = (c) => setts(c).sort((a, b) => b.pop - a.pop)[0];
const income = (c) => Math.max(10, (c.last?.tax || 0) + (c.last?.gold || 0));
const gold = (c, m) => { c.treasury += income(c) * m; };
const stab = (c, v) => { c.stability = clamp(c.stability + v, 0, 100); };
const unrest = (s, v) => { if (s) s.unrest = clamp((s.unrest || 0) + v, 0, 100); };
const addMod = (c, name, fx, months) => { c.modifiers ??= []; c.modifiers.push({ name, fx, until: months < 0 ? -1 : S().day + months * 30 }); invalidateMods(c); };
const research = (c, f) => { c.research.pool += (c.research.current ? 120 * (c.era + 1) : 30 * (c.era + 1)) * f; };
const town = (x) => S().settlements[x.s];
const tname = (x) => town(x)?.name || 'the town';
// a town of the realm (not the capital if possible)
const someTown = (c) => { const l = setts(c).filter((s) => !s.isCapital && s.pop > 40); return l.length ? l[G.rng.int(0, l.length - 1)] : largest(c); };

// Schedule the next step of a story
export function schedule(c, ev, ctx, months) {
  const st = S();
  st.stories ??= [];
  st.stories.push({ civ: c.id, ev, ctx: { ...ctx }, due: st.day + Math.round(months * 30) });
}
const chronicle = (c, text) => log(text, { civ: c.id, type: 'info', major: true });

// ---------------- Story chains ----------------
// Starting events carry a weight (they enter the normal monthly pool); follow-ups have weight 0
// and are raised only by schedule().
export const CHAIN_EVENTS = [
  // ---- The new creed (heresy) ----
  {
    id: 'heresy_1', title: 'A Preacher of a New Creed', weight: 0.7, chain: 'The New Creed',
    cond: (c) => { const s = someTown(c); return s && c.settlements.length >= 3 && c.era >= 1 ? { s: s.id } : false; },
    text: (c, x) => `In the market square of ${tname(x)} a barefoot preacher draws great crowds, teaching that the old rites are hollow and the priests corrupt.`,
    options: [
      { label: 'Arrest the preacher', desc: 'Order is kept for now… but a martyr may be made', ai: 1.2, fx: (c, x) => { stab(c, 1); if (G.rng.chance(0.6)) schedule(c, 'heresy_martyr', x, G.rng.int(6, 12)); } },
      { label: 'Hold a debate at court', desc: '+15% research; the creed may still spread', ai: 1, fx: (c, x) => { research(c, 0.15); if (G.rng.chance(0.5)) schedule(c, 'heresy_spread', x, G.rng.int(10, 18)); } },
      { label: 'Let them preach', desc: 'Tolerance: +3 stability now; the creed will spread', ai: 0.8, fx: (c, x) => { stab(c, 3); schedule(c, 'heresy_spread', x, G.rng.int(8, 14)); } },
    ],
  },
  {
    id: 'heresy_martyr', title: 'The Martyr', weight: 0, chain: 'The New Creed',
    text: (c, x) => `The imprisoned preacher has died in our dungeons. Crowds in ${tname(x)} carry relics of the "martyr" through the streets and curse the crown.`,
    options: [
      { label: 'Crush the cult', desc: '−6 stability, +25 unrest there; the creed is broken', ai: 1, fx: (c, x) => { stab(c, -6); unrest(town(x), 25); chronicle(c, `${c.displayName} crushed the cult of the martyr of ${tname(x)}.`); } },
      { label: 'Build a shrine to the martyr', desc: '−3 gold-months; +4 stability for 5 years', ai: 1.2, fx: (c, x) => { gold(c, -3); addMod(c, `Shrine of the Martyr`, { stability: 4 }, 60); chronicle(c, `A shrine to the martyr of ${tname(x)} was raised by ${c.displayName}.`); } },
    ],
  },
  {
    id: 'heresy_spread', title: 'The Creed Spreads', weight: 0, chain: 'The New Creed',
    text: (c, x) => `The teachings first heard in ${tname(x)} are now spoken in every town of the realm. The priests demand action; the people want change.`,
    options: [
      { label: 'Call a great council', desc: '−4 gold-months; +6 stability for 10 years', ai: 1.2, fx: (c) => { gold(c, -4); addMod(c, 'Council of Faith', { stability: 6 }, 120); chronicle(c, `${c.displayName} called a great council of faith and healed the rift.`); } },
      { label: 'Embrace the reform', desc: '−10 stability now; +12% knowledge and +5% gold for 15 years', ai: 0.8, fx: (c) => { stab(c, -10); addMod(c, 'Reformed faith', { knowledge: 0.12, gold: 0.05 }, 180); chronicle(c, `The Reformation: ${c.displayName} embraced the new creed.`); } },
    ],
  },

  // ---- The pretender ----
  {
    id: 'pretender_1', title: 'A Stranger Claims the Blood', weight: 0.6, chain: 'The Pretender',
    cond: (c) => (c.ruler && c.ruler.age > 35 && c.stability < 70 && c.settlements.length >= 2 ? { s: (someTown(c) || {}).id } : false),
    text: (c, x) => `A young man has appeared in ${tname(x)} claiming to be a lost child of the royal house, hidden away at birth. Some nobles whisper that he has the old king's eyes.`,
    options: [
      { label: 'Imprison him quietly', desc: '−2 stability; the matter may not end there', ai: 1.2, fx: (c, x) => { stab(c, -2); if (G.rng.chance(0.4)) schedule(c, 'pretender_escape', x, G.rng.int(6, 14)); } },
      { label: 'Hear his case at court', desc: 'A trial will reveal the truth — whatever it is', ai: 1, fx: (c, x) => schedule(c, 'pretender_trial', x, G.rng.int(3, 6)) },
      { label: 'Pay him to vanish', desc: '−3 gold-months; the story ends', ai: 0.8, fx: (c) => gold(c, -3) },
    ],
  },
  {
    id: 'pretender_trial', title: 'The Trial of the Pretender', weight: 0, chain: 'The Pretender',
    text: (c, x) => (x.true ? `Old servants testify, a birthmark is shown, letters are read aloud: the stranger is truly of the royal blood!` : `Witness after witness contradicts him. The "lost heir" is the son of a cobbler from ${tname(x)}.`),
    pre: (c, x) => { x.true = G.rng.chance(0.35); },
    options: [
      { label: 'Welcome him / pardon him', desc: 'If true: a new member of the family (+3 stability). If false: mercy (+2 stability)', ai: 1, fx: (c, x) => { stab(c, x.true ? 3 : 2); if (x.true && G.characters?.makeNoble) { const p = G.characters.makeNoble(c, { dynasty: c.ruler.dynasty, age: 22 }); c.family.push(p); chronicle(c, `${p.name}, a lost child of House ${c.ruler.dynasty}, was restored to the family.`); } } },
      { label: 'Banish him', desc: 'If true: −6 stability and he may return with an army', ai: 1, fx: (c, x) => { if (x.true) { stab(c, -6); if (G.rng.chance(0.5)) schedule(c, 'pretender_escape', x, G.rng.int(12, 24)); } } },
    ],
  },
  {
    id: 'pretender_escape', title: 'The Pretender Returns', weight: 0, chain: 'The Pretender',
    text: (c, x) => `The pretender has gathered disaffected nobles and sellswords near ${tname(x)}, and marches under a stolen banner.`,
    options: [
      { label: 'Meet him in battle', desc: 'The realm splits: a claimant rises in revolt', ai: 0.8, fx: (c) => { if (G.civilWar && c.settlements.length >= 3) G.civilWar(c, 'claimant'); else stab(c, -8); chronicle(c, `A pretender rose against ${c.displayName}.`); } },
      { label: 'Buy off his followers', desc: '−8 gold-months; −4 stability', ai: 1.2, fx: (c) => { gold(c, -8); stab(c, -4); } },
    ],
  },

  // ---- The far expedition ----
  {
    id: 'expedition_1', title: 'Maps of the Unknown', weight: 0.6, chain: 'The Far Expedition',
    cond: (c) => (c.era >= 1 && c.treasury > income(c) * 5 ? {} : false),
    text: (c) => `A bold captain at the court of ${c.displayName} asks for ships and gold to seek the lands beyond the edge of our maps.`,
    options: [
      { label: 'Fund the expedition', desc: '−5 gold-months; they will return… or not', ai: 1, fx: (c, x) => { gold(c, -5); x.captain = personName(c.race, 'm', G.rng); schedule(c, 'expedition_return', x, G.rng.int(12, 30)); } },
      { label: 'Not worth the gold', desc: 'Nothing happens', ai: 1, fx: () => {} },
    ],
  },
  {
    id: 'expedition_return', title: 'The Expedition Returns', weight: 0, chain: 'The Far Expedition',
    pre: (c, x) => { x.fate = G.rng.chance(0.65) ? 'rich' : G.rng.chance(0.5) ? 'poor' : 'lost'; },
    text: (c, x) => (x.fate === 'rich' ? `Sails on the horizon! Captain ${x.captain} returns with spices, strange beasts and charts of distant shores.` : x.fate === 'poor' ? `Captain ${x.captain} returns, ragged and half-starved, with little but tales.` : `A single battered ship limps home. Captain ${x.captain} and most of the crew were lost to storms and strange seas.`),
    options: [
      { label: 'Hear their tale', desc: 'Rich: +10 gold-months, +30% research. Poor: +10% research. Lost: −3 stability', ai: 1, fx: (c, x) => { if (x.fate === 'rich') { gold(c, 10); research(c, 0.3); chronicle(c, `Captain ${x.captain} of ${c.displayName} returned from the far seas laden with treasure.`); } else if (x.fate === 'poor') research(c, 0.1); else { stab(c, -3); chronicle(c, `Captain ${x.captain}'s expedition was lost at sea.`); } } },
    ],
  },

  // ---- The sickness from the south ----
  {
    id: 'plague_rumour', title: 'Rumours of Sickness', weight: 0.5, chain: 'The Great Sickness',
    cond: (c) => { const s = largest(c); return s && s.pop > 400 ? { s: s.id } : false; },
    text: (c, x) => `Traders arriving in ${tname(x)} speak of a coughing sickness emptying the towns of distant lands.`,
    options: [
      { label: 'Close the gates to traders', desc: '−15% gold for 1 year; the sickness probably passes us by', ai: 1, fx: (c, x) => { addMod(c, 'Closed gates', { gold: -0.15 }, 12); if (G.rng.chance(0.25)) schedule(c, 'plague_arrives', x, G.rng.int(4, 8)); } },
      { label: 'Keep trade flowing', desc: 'Commerce continues… at a risk', ai: 1, fx: (c, x) => { if (G.rng.chance(0.75)) schedule(c, 'plague_arrives', x, G.rng.int(3, 7)); } },
    ],
  },
  {
    id: 'plague_arrives', title: 'The Sickness Arrives', weight: 0, chain: 'The Great Sickness',
    text: (c, x) => `The sickness has reached ${tname(x)}. Carts of the dead rattle through the streets at night.`,
    options: [
      { label: 'Quarantine and physicians', desc: '−4 gold-months; −8% population there', ai: 1.2, fx: (c, x) => { gold(c, -4); const s = town(x); if (s) s.pop *= 0.92; schedule(c, 'plague_after', x, G.rng.int(8, 14)); } },
      { label: 'Pray for deliverance', desc: '−18% population there, −3 stability', ai: 1, fx: (c, x) => { const s = town(x); if (s) s.pop *= 0.82; stab(c, -3); schedule(c, 'plague_after', x, G.rng.int(8, 14)); chronicle(c, `The Great Sickness ravaged ${tname(x)}.`); } },
    ],
  },
  {
    id: 'plague_after', title: 'After the Sickness', weight: 0, chain: 'The Great Sickness',
    text: (c, x) => `The sickness has passed. With so many gone, the survivors of ${tname(x)} demand better wages, and empty fields wait for hands.`,
    options: [
      { label: 'Raise wages', desc: '−2 gold-months; +10% growth and +3 stability for 5 years', ai: 1.2, fx: (c) => { gold(c, -2); addMod(c, 'Dear labour', { growth: 0.1, stability: 3 }, 60); } },
      { label: 'Bind them to the land', desc: '+10% food for 5 years; +15 unrest there', ai: 1, fx: (c, x) => { addMod(c, 'Bound peasantry', { food: 0.1 }, 60); unrest(town(x), 15); } },
    ],
  },

  // ---- The beast of the wilds (and a hero) ----
  {
    id: 'beast_1', title: 'A Beast in the Wilds', weight: 0.6, chain: 'The Beast',
    cond: (c) => { const s = someTown(c); return s ? { s: s.id, beast: ['great wyrm', 'shadow wolf', 'giant boar', 'troll', 'wyvern'][G.rng.int(0, 4)] } : false; },
    text: (c, x) => `Shepherds near ${tname(x)} tell of a ${x.beast} that carries off flocks and children. Villages are emptying.`,
    options: [
      { label: 'Offer a reward for its head', desc: '−3 gold-months; a hero may answer the call', ai: 1.2, fx: (c, x) => { gold(c, -3); schedule(c, 'beast_hunt', x, G.rng.int(2, 6)); } },
      { label: 'Send the soldiers', desc: '−3% population there; +10 unrest there', ai: 1, fx: (c, x) => { const s = town(x); if (s) s.pop *= 0.97; unrest(s, 10); } },
    ],
  },
  {
    id: 'beast_hunt', title: 'The Hunt', weight: 0, chain: 'The Beast',
    pre: (c, x) => { x.win = G.rng.chance(0.7); x.hunter = personName(c.race, G.rng.chance(0.5) ? 'm' : 'f', G.rng); },
    text: (c, x) => (x.win ? `${x.hunter}, a wanderer of no name, returns from the hills dragging the head of the ${x.beast}. The people of ${tname(x)} carry them on their shoulders.` : `${x.hunter} went into the hills after the ${x.beast} and did not return.`),
    options: [
      { label: 'Honour the hunter', desc: 'If victorious: they become a hero of the realm', ai: 1, fx: (c, x) => { if (!x.win) { stab(c, -2); return; } if ((c.heroes || []).some((h) => h.alive && h.kind === 'adventurer')) { stab(c, 3); gold(c, 1); chronicle(c, `${x.hunter} slew the ${x.beast} of ${tname(x)}.`); } else addHero(c, 'adventurer', { name: x.hunter, deed: `slew the ${x.beast} of ${tname(x)}` }); } },
    ],
  },
];

// Raise due story steps (monthly)
export function storiesMonthly() {
  const st = S();
  if (!st.stories?.length) return;
  const due = st.stories.filter((s) => s.due <= st.day);
  if (!due.length) return;
  st.stories = st.stories.filter((s) => s.due > st.day);
  for (const s of due) {
    const c = civOf(s.civ);
    const ev = CHAIN_EVENTS.find((e) => e.id === s.ev);
    if (!c?.alive || !ev) continue;
    if (s.ctx.s != null && (!st.settlements[s.ctx.s] || st.settlements[s.ctx.s].dead || st.settlements[s.ctx.s].civ !== c.id)) continue;
    ev.pre?.(c, s.ctx);
    if (c.isPlayer) st.pendingEvents.push({ id: st.nextEventId++, ev: ev.id, civ: c.id, ctx: s.ctx, day: st.day });
    else { const opt = G.rng.weighted(ev.options, (o) => o.ai); try { opt.fx(c, s.ctx); } catch (e) { console.warn('story step failed', e); } }
  }
}

// ---------------- Heroes & legends ----------------
export const HERO_KINDS = {
  general: { name: 'General', icon: '⚔', fx: { defense: 12 }, legacy: { defense: 4 }, epithets: ['the Lion', 'the Unbroken', 'Ironhand', 'the Hammer', 'Stormbanner'], deeds: ['held the pass against a host thrice their number', 'drilled the levies into a feared army', 'rode down a band of raiders', 'won a famous duel before the walls'] },
  sage: { name: 'Sage', icon: '✎', fx: { knowledge: 0.15 }, legacy: { knowledge: 0.04 }, epithets: ['the Wise', 'Starreader', 'the Learned', 'Lorekeeper'], deeds: ['wrote a great book of the heavens', 'founded a school of philosophers', 'charted the motion of the stars', 'invented a clever water-wheel'] },
  saint: { name: 'Saint', icon: '✝', fx: { stability: 5 }, legacy: { stability: 2 }, epithets: ['the Blessed', 'the Merciful', 'the Pure', 'of the Poor'], deeds: ['healed the sick of a whole town', 'walked unharmed through a burning village', 'reconciled two feuding houses', 'fed the hungry through a hard winter'] },
  adventurer: { name: 'Adventurer', icon: '✦', fx: { gold: 0.06 }, legacy: { gold: 0.02 }, epithets: ['the Wanderer', 'Dragonbane', 'the Bold', 'Farstrider'], deeds: ['returned from the deep wilds with a dragon\'s hoard', 'mapped a hidden valley', 'rescued a merchant caravan from bandits', 'found a lost tomb of the ancients'] },
  architect: { name: 'Architect', icon: '⌂', fx: { build: 0.2 }, legacy: { build: 0.05 }, epithets: ['the Builder', 'Stonehand', 'the Master'], deeds: ['raised a soaring bridge', 'designed a great hall', 'drained a marsh for new fields', 'built an aqueduct of marvellous skill'] },
};
export const HERO_LIST = Object.keys(HERO_KINDS);

export function addHero(c, kind, opts = {}) {
  const st = S();
  const K = HERO_KINDS[kind];
  c.heroes ??= [];
  const gender = opts.gender || (G.rng.chance(0.5) ? 'm' : 'f');
  const h = {
    id: (st.nextHeroId = (st.nextHeroId || 0) + 1), kind, name: opts.name || personName(c.race, gender, G.rng), gender,
    epithet: '', born: st.day, dies: st.day + 360 * G.rng.int(12, 32), alive: true, deeds: opts.deed ? [opts.deed] : [],
  };
  { let hs = h.id * 7919; for (const ch of h.name) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0; h.epithet = K.epithets[hs % K.epithets.length]; }
  c.heroes.push(h);
  addMod(c, `Hero: ${h.name} ${h.epithet}`, K.fx, -1);
  log(`${K.icon} A hero rises in ${c.displayName}: ${h.name} ${h.epithet}, ${K.name.toLowerCase()}${opts.deed ? `, who ${opts.deed}` : ''}.`, { civ: c.id, type: c.isPlayer ? 'good' : 'world', toast: c.isPlayer, major: true });
  return h;
}
const heroName = (h) => `${h.name} ${h.epithet}`;
export function heroesYearly(c) {
  const st = S();
  if (!c.alive) return;
  c.heroes ??= [];
  const living = c.heroes.filter((h) => h.alive);
  // a new hero, rarely — more likely in stable, advanced realms
  if (living.length < 2 && c.settlements.length >= 2 && G.rng.chance(clamp(0.018 + c.era * 0.004 + (c.stability - 50) / 4000, 0.005, 0.04))) {
    const wars = st.wars.some((w) => w.att.includes(c.id) || w.def.includes(c.id));
    const kinds = HERO_LIST.filter((k) => !living.some((h) => h.kind === k));
    const kind = wars && kinds.includes('general') && G.rng.chance(0.5) ? 'general' : kinds[G.rng.int(0, kinds.length - 1)];
    if (kind) addHero(c, kind);
  }
  for (const h of living) {
    const K = HERO_KINDS[h.kind];
    if (st.day >= h.dies) {
      h.alive = false; h.died = st.day;
      c.modifiers = (c.modifiers || []).filter((m) => m.name !== `Hero: ${heroName(h)}`);
      addMod(c, `Legacy of ${heroName(h)}`, K.legacy, 1200); // remembered for about a century
      log(`${K.icon} ${heroName(h)} of ${c.displayName} has died. Their legend will be told for generations.`, { civ: c.id, type: c.isPlayer ? 'bad' : 'world', toast: c.isPlayer, major: true });
      continue;
    }
    if (G.rng.chance(0.3)) {
      const d = K.deeds[G.rng.int(0, K.deeds.length - 1)];
      if (!h.deeds.includes(d)) {
        h.deeds.push(d);
        if (h.kind === 'adventurer') gold(c, 2);
        if (h.kind === 'sage') research(c, 0.1);
        log(`${K.icon} ${heroName(h)} ${d}.`, { civ: c.id, type: c.isPlayer ? 'good' : 'world', major: h.deeds.length <= 3 });
      }
    }
    // a hero general takes command of the largest army in wartime
    if (h.kind === 'general') {
      const army = st.armies.filter((a) => a.civ === c.id).sort((a, b) => Object.values(b.units).reduce((s, n) => s + n, 0) - Object.values(a.units).reduce((s, n) => s + n, 0))[0];
      if (army && !army.general?.hero) army.general = { name: heroName(h), gender: h.gender, skill: 6, trait: 'inspiring', hero: h.id, kind: 'hero' };
    }
    // a saint may be sent to aid a suffering friend
    if (h.kind === 'saint' && G.rng.chance(0.05)) {
      const friend = st.civs.find((o) => o.alive && o.id !== c.id && o.stability < 35 && (c.contacts || []).includes(o.id));
      if (friend) { friend.stability = Math.min(100, friend.stability + 6); remember(friend.id, c.id, 'hero_saved'); h.deeds.push(`brought hope to the suffering people of ${friend.baseName}`); }
    }
  }
}

export function ensurePhase17Stories(st) {
  st.stories ??= [];
  st.nextHeroId ??= 0;
  st.battleReports ??= [];
  for (const c of st.civs) c.heroes ??= [];
}
