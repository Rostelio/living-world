import { G, S, log, civOf } from './state.js';
import { RACES } from '../data/races.js';
import { BUILDINGS } from '../data/buildings.js';
import { invalidateMods } from './mods.js';
import { lvl, storageCaps } from './settlements.js';
import { warsOf, rel, opinion, declareWar, canDeclareWar, militaryStrength } from './diplomacy.js';
import { heirOf, educateHeir, rulerFullName, succeed } from './government.js';
import { techCost } from './tech.js';
import { createArmy } from './military.js';
import { escapeHtml as E } from '../core/util.js';
import { CHAIN_EVENTS } from './stories.js';
import { EARLY_EVENTS } from './earlyevents.js';

// ---------------- Effect helpers ----------------
const income = (c) => Math.max(10, (c.last?.tax || 0) + (c.last?.gold || 0));
const setts = (c) => c.settlements.map((id) => S().settlements[id]);
const largest = (c) => setts(c).sort((a, b) => b.pop - a.pop)[0];
const addMod = (c, name, fx, months) => {
  c.modifiers ??= [];
  c.modifiers.push({ name, fx, until: months < 0 ? -1 : S().day + months * 30 });
  invalidateMods(c);
};
const gold = (c, months) => { c.treasury += income(c) * months; };
const stab = (c, v) => { c.stability = Math.max(0, Math.min(100, c.stability + v)); };
const research = (c, frac) => { if (c.research.current) c.research.pool += techCost(c, c.research.current) * frac; else c.research.pool += 30 * (c.era + 1); };
const food = (c, f) => { c.stock.grain = Math.max(0, Math.min(storageCaps(c).grain, c.stock.grain + storageCaps(c).grain * f)); };

const yearsAtPeace = (c) => {
  const st = S();
  if (warsOf(c.id).length) return 0;
  return (st.day - (c.lastWarDay ?? 0)) / 360;
};

// ---------------- Event definitions ----------------
// Each: cond(civ) -> ctx|false, text(civ, ctx), options [{label, desc, ai, fx(civ, ctx)}]
export const EVENTS = [
  // Phase 11: a foreign court proposes a royal marriage (raised by characters.js)
  {
    id: 'marriage_offer', title: 'A Royal Match', weight: 0,
    cond: () => false,
    text: (c, x) => `Envoys from ${civOf(x.from).displayName} propose that ${c.ruler.name} wed a scion of House ${civOf(x.from).ruler.dynasty}. The match would bind our realms, and any children would hold a claim on their throne.`,
    options: [
      { label: 'Accept the match', desc: 'Royal marriage: +20 opinion between our realms; our children gain a claim on their throne', ai: 1, fx: (c, x) => { if (G.characters.canMarry(x.from, c.id).ok && !c.ruler.spouse) { const p = G.characters.marry(c.id, x.from, true); G.characters.noteMarriage(c, x.from, p); } } },
      { label: 'Decline politely', desc: 'They are a little offended (−10 opinion)', ai: 1, fx: (c, x) => { G.characters.declined(c.id, x.from); } },
    ],
  },
  // Phase 10: an angry interest group's movement reaches boiling point (raised by politics.js, never at random)
  {
    id: 'movement', title: 'A Movement Demands Change', weight: 0,
    cond: () => false,
    text: (c, x) => `The ${G.politics.groupName(x.g)} have organised a mass movement. Crowds fill the streets of ${S().settlements[c.capital]?.name || 'the capital'}${x.demand ? ` demanding ${G.politics.lawName(x.demand)}` : ''}. If we refuse, they may rise in revolution.`,
    options: [
      { label: 'Give in to their demands', desc: 'The demanded law takes effect at once; −4 stability; the group calms down', ai: 1, fx: (c, x) => G.politics.concedeMovement(c, x.g, x.demand) },
      { label: 'Refuse and restore order', desc: '−8 stability, unrest rises; a strong group may start a revolution', ai: 1, fx: (c, x) => G.politics.refuseMovement(c, x.g) },
    ],
  },
  {
    id: 'plague', title: 'Plague', weight: 1,
    cond: (c) => { const s = largest(c); return s && s.pop > 300 ? { s: s.id } : false; },
    text: (c, x) => `A wasting sickness spreads through the crowded streets of ${S().settlements[x.s].name}.`,
    options: [
      { label: 'Quarantine the city', desc: '−8% population (halved with a Hospital), −2 gold-months, −3 stability', ai: 2, fx: (c, x) => { const s = S().settlements[x.s]; s.pop *= lvl(s, 'hospital') ? 0.96 : 0.92; gold(c, -2); stab(c, -3); } },
      { label: 'Pray and endure', desc: '−18% population (halved with a Hospital); +3 stability if it has a temple', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; s.pop *= lvl(s, 'hospital') ? 0.91 : 0.82; if (lvl(s, 'temple')) stab(c, 3); } },
    ],
  },
  {
    id: 'harvest', title: 'Bountiful Harvest', weight: 1.2,
    cond: (c) => (c.settlements.length ? {} : false),
    text: () => 'Sun and rain have favoured the fields. The granaries overflow.',
    options: [
      { label: 'Store the surplus', desc: '+60% food storage filled', ai: 1, fx: (c) => food(c, 0.6) },
      { label: 'Hold a harvest festival', desc: '+8 stability for 2 years', ai: 1, fx: (c) => addMod(c, 'Harvest festival', { stability: 8 }, 24) },
    ],
  },
  {
    id: 'fire', title: 'Great Fire', weight: 0.8,
    cond: (c) => { const s = setts(c).find((x) => x.stage >= 2 && Object.keys(x.buildings).length); return s ? { s: s.id } : false; },
    text: (c, x) => `Fire races through the timber quarters of ${S().settlements[x.s].name}.`,
    options: [
      { label: 'Pay to rebuild at once', desc: '−4 gold-months, −10% population', ai: 2, fx: (c, x) => { gold(c, -4); S().settlements[x.s].pop *= 0.9; } },
      { label: 'Let it burn out', desc: 'Lose a building level, −15% population', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; const k = Object.keys(s.buildings).filter((b) => b !== 'town_hall'); if (k.length) { const b = k[G.rng.int(0, k.length - 1)]; s.buildings[b]--; if (!s.buildings[b]) delete s.buildings[b]; s.rev++; } s.pop *= 0.85; } },
    ],
  },
  {
    id: 'gold_rush', title: 'Gold Rush', weight: 0.6,
    cond: (c) => { const s = setts(c).find((x) => G.world.provinces[x.province].resources[2]); return s ? { s: s.id } : false; },
    text: (c, x) => `Prospectors strike a rich vein near ${S().settlements[x.s].name}.`,
    options: [
      { label: 'Claim it for the crown', desc: '+8 gold-months, −3 stability', ai: 2, fx: (c) => { gold(c, 8); stab(c, -3); } },
      { label: 'Let settlers flock in', desc: '+20% population there, +2 gold-months', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; s.pop *= 1.2; s.housing = Math.max(s.housing, Math.ceil(s.pop * 1.05)); gold(c, 2); } },
    ],
  },
  {
    id: 'scholar', title: 'A Wandering Scholar', weight: 1,
    cond: (c) => ({}),
    text: (c) => `A learned traveller arrives at the court of ${rulerFullName(c)}, offering their knowledge.`,
    options: [
      { label: 'Fund their research', desc: '−2 gold-months, +40% of current research', ai: 2, fx: (c) => { gold(c, -2); research(c, 0.4); } },
      { label: 'Make them the heir\'s tutor', desc: 'The heir will be educated as a scholar', ai: 1, fx: (c) => educateHeir(c, 'scholar') },
      { label: 'Send them away', desc: 'Nothing happens', ai: 0.3, fx: () => {} },
    ],
  },
  {
    id: 'comet', title: 'Comet in the Sky', weight: 0.6,
    cond: () => ({}),
    text: () => 'A blazing star crosses the night sky. The people whisper of omens.',
    options: [
      { label: 'Proclaim it a blessing', desc: '+6 stability for 3 years (−2 if the realm is unstable)', ai: 1, fx: (c) => addMod(c, 'Heavenly omen', { stability: c.stability > 40 ? 6 : -2 }, 36) },
      { label: 'Ask the scholars', desc: '+20% of current research', ai: 1, fx: (c) => research(c, 0.2) },
    ],
  },
  {
    id: 'tax_revolt', title: 'Tax Protests', weight: 1.4,
    cond: (c) => (c.taxRate > 0.25 && c.settlements.length > 1 ? {} : false),
    text: () => 'Crowds gather in the markets, shouting against the tax collectors.',
    options: [
      { label: 'Lower taxes', desc: 'Tax −5%, +5 stability', ai: 2, fx: (c) => { c.taxRate = Math.max(0, c.taxRate - 0.05); stab(c, 5); } },
      { label: 'Disperse the crowds', desc: '+20 unrest in your largest settlement', ai: 1, fx: (c) => { const s = largest(c); s.unrest = Math.min(100, (s.unrest || 0) + 20); } },
    ],
  },
  {
    id: 'intrigue', title: 'Noble Intrigue', weight: 0.9,
    cond: (c) => (['monarchy', 'empire'].includes(c.gov) ? {} : false),
    text: () => 'Great houses conspire at court, seeking to weaken the throne.',
    options: [
      { label: 'Buy their loyalty', desc: '−4 gold-months', ai: 2, fx: (c) => gold(c, -4) },
      { label: 'Exile the ringleaders', desc: '−6 stability for 2 years, ruler gains Cruel or Just', ai: 1, fx: (c) => { addMod(c, 'Purged nobility', { stability: -6 }, 24); const t = G.rng.chance(0.5) ? 'cruel' : 'just'; if (!c.ruler.traits.includes(t) && !c.ruler.traits.includes(t === 'cruel' ? 'just' : 'cruel')) c.ruler.traits.push(t); invalidateMods(c); } },
    ],
  },
  {
    id: 'education', title: 'Education of the Heir', weight: 2,
    cond: (c) => { const h = heirOf(c); return h && h.age >= 8 && h.age < 16 && !h.edu ? {} : false; },
    text: (c) => `${heirOf(c).name}, heir to the realm, is old enough for formal education.`,
    options: [
      { label: 'Training at arms', desc: 'Martial education (Brave)', ai: 1, fx: (c) => educateHeir(c, 'martial') },
      { label: 'The great libraries', desc: 'Scholarly education (Wise)', ai: 1, fx: (c) => educateHeir(c, 'scholar') },
      { label: 'Life at court', desc: 'Diplomatic education (Charismatic)', ai: 1, fx: (c) => educateHeir(c, 'diplomat') },
      { label: 'The treasury ledgers', desc: 'Stewardship education (Diligent)', ai: 1, fx: (c) => educateHeir(c, 'steward') },
    ],
  },
  {
    id: 'illness', title: 'The Ruler Falls Ill', weight: 1,
    cond: (c) => (c.ruler.age > 45 ? {} : false),
    text: (c) => `${rulerFullName(c)} is bedridden with a fever.`,
    options: [
      { label: 'Summon the best physicians', desc: '−3 gold-months, small risk of death', ai: 2, fx: (c) => { gold(c, -3); if (G.rng.chance(0.1)) succeed(c, 'death'); } },
      { label: 'Trust in rest', desc: 'Larger risk of death', ai: 1, fx: (c) => { if (G.rng.chance(0.3)) succeed(c, 'death'); } },
    ],
  },
  {
    id: 'monument', title: 'A Great Work', weight: 0.7,
    cond: (c) => (c.stock.stone > 150 && c.settlements.length >= 2 && !c.flags?.monument ? {} : false),
    text: (c) => `The architects of ${c.baseName} propose a monument to the glory of the realm.`,
    options: [
      { label: 'Build the monument', desc: '−150 stone, −4 gold-months, permanent +3 stability', ai: 1.5, fx: (c) => { c.stock.stone -= 150; gold(c, -4); addMod(c, 'Great monument', { stability: 3 }, -1); (c.flags ??= {}).monument = 1; } },
      { label: 'Not now', desc: 'Nothing happens', ai: 1, fx: () => {} },
    ],
  },
  {
    id: 'deserters', title: 'Deserters', weight: 1.2,
    cond: (c) => { const w = warsOf(c.id)[0]; return w && (w.att.includes(c.id) ? w.exhA : w.exhD) > 15 ? {} : false; },
    text: () => 'Weary soldiers slip away from camp by night.',
    options: [
      { label: 'Pardon them', desc: '+4 stability, armies lose 5%', ai: 1, fx: (c) => { stab(c, 4); for (const a of S().armies) if (a.civ === c.id) for (const k in a.units) a.units[k] *= 0.95; } },
      { label: 'Hang them as an example', desc: '−4 stability, armies regain morale', ai: 1, fx: (c) => { stab(c, -4); for (const a of S().armies) if (a.civ === c.id) a.morale = Math.min(1, a.morale + 0.25); } },
    ],
  },
  {
    id: 'border_incident', title: 'Border Incident', weight: 1,
    cond: (c) => { const o = c.contacts.find((x) => civOf(x).alive && opinion(c.id, x) < -15); return o != null ? { o } : false; },
    text: (c, x) => `Soldiers of ${civOf(x.o).displayName} have burned a farmstead on our side of the border.`,
    options: [
      { label: 'Demand reparations', desc: '+3 gold-months if they pay, worse relations', ai: 1, fx: (c, x) => { rel(c.id, x.o).grudge += 15; if (G.rng.chance(0.4)) gold(c, 3); } },
      { label: 'Let it pass', desc: '−2 stability', ai: 1, fx: (c) => stab(c, -2) },
    ],
  },
  // ---- Era events ----
  {
    id: 'printing', title: 'The Printed Word', weight: 1.5,
    cond: (c) => (c.techs.includes('printing_press') && !c.flags?.printing ? {} : false),
    text: () => 'Pamphlets and books spread ideas faster than any edict can follow.',
    options: [
      { label: 'Embrace the new learning', desc: '+15% knowledge for 10 years, −4 stability for 2 years', ai: 1.5, fx: (c) => { addMod(c, 'Age of print', { knowledge: 0.15 }, 120); addMod(c, 'Radical pamphlets', { stability: -4 }, 24); (c.flags ??= {}).printing = 1; } },
      { label: 'License the presses', desc: '+2 stability for 10 years', ai: 1, fx: (c) => { addMod(c, 'Licensed presses', { stability: 2 }, 120); (c.flags ??= {}).printing = 1; } },
    ],
  },
  {
    id: 'workers', title: 'The Workers Organise', weight: 1.5,
    cond: (c) => (c.era >= 3 && !c.flags?.workers ? {} : false),
    text: () => 'Factory hands demand shorter hours and fair wages.',
    options: [
      { label: 'Grant reforms', desc: '−6 gold-months, +6 stability permanently', ai: 1.5, fx: (c) => { gold(c, -6); addMod(c, 'Labour reforms', { stability: 6 }, -1); (c.flags ??= {}).workers = 1; } },
      { label: 'Break the strikes', desc: '+10% production for 5 years, unrest everywhere +25', ai: 1, fx: (c) => { addMod(c, 'Strikebreaking', { food: 0.1, wood: 0.1, stone: 0.1, iron: 0.1, gold: 0.1 }, 60); for (const s of setts(c)) s.unrest = Math.min(100, (s.unrest || 0) + 25); (c.flags ??= {}).workers = 1; } },
    ],
  },
  {
    id: 'exploration', title: 'Voyages of Discovery', weight: 1,
    cond: (c) => (c.techs.includes('navigation') && setts(c).some((s) => s.buildings.port) && !c.flags?.explore ? {} : false),
    text: () => 'Captains seek royal backing to sail beyond the known seas.',
    options: [
      { label: 'Fund the expedition', desc: '−5 gold-months; may bring riches and knowledge', ai: 1.2, fx: (c) => { gold(c, -5); (c.flags ??= {}).explore = 1; if (G.rng.chance(0.7)) { gold(c, 12); research(c, 0.5); log(`The expedition of ${c.baseName} returns laden with treasure and charts.`, { civ: c.id, type: c.isPlayer ? 'good' : 'world', toast: c.isPlayer }); } } },
      { label: 'Too risky', desc: 'Nothing happens', ai: 1, fx: (c) => { (c.flags ??= {}).explore = 1; } },
    ],
  },
  // ---- Race events ----
  {
    id: 'elf_council', title: 'Council of the Eldest', weight: 1.2, race: 'elves',
    cond: () => ({}),
    text: () => 'The eldest of the elves warn that contact with short-lived peoples corrupts the old ways.',
    options: [
      { label: 'Heed the Eldest', desc: '+8 stability for 5 years, −15% gold for 5 years', ai: 1, fx: (c) => { addMod(c, 'Old ways', { stability: 8, gold: -0.15 }, 60); } },
      { label: 'Embrace the wider world', desc: '+15% knowledge for 5 years, −5 stability for 2 years', ai: 1, fx: (c) => { addMod(c, 'Open borders', { knowledge: 0.15 }, 60); addMod(c, 'Angered elders', { stability: -5 }, 24); } },
    ],
  },
  {
    id: 'elf_grove', title: 'The Sacred Grove', weight: 1, race: 'elves',
    cond: (c) => (c.stock.wood < storageCaps(c).wood * 0.3 ? {} : false),
    text: () => 'Woodcutters eye an ancient grove sacred to our people.',
    options: [
      { label: 'Protect the grove', desc: '+4 stability for 5 years', ai: 1.5, fx: (c) => addMod(c, 'Sacred grove', { stability: 4 }, 60) },
      { label: 'Harvest it', desc: 'Wood storage filled, −8 stability for 3 years', ai: 0.6, fx: (c) => { c.stock.wood = storageCaps(c).wood; addMod(c, 'Desecrated grove', { stability: -8 }, 36); } },
    ],
  },
  {
    id: 'dwarf_delve', title: 'Delving Too Deep', weight: 1.2, race: 'dwarves',
    cond: (c) => { const s = setts(c).find((x) => x.buildings.mine); return s ? { s: s.id } : false; },
    text: (c, x) => `Miners beneath ${S().settlements[x.s].name} have broken into vast unknown caverns. Something stirs below.`,
    options: [
      { label: 'Delve deeper', desc: 'Great riches… or disaster', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; if (G.rng.chance(0.6)) { gold(c, 15); c.stock.iron += 200; log(`Untold riches are found beneath ${s.name}!`, { civ: c.id, type: c.isPlayer ? 'good' : 'world', toast: c.isPlayer }); } else { s.pop *= 0.75; stab(c, -10); log(`Horror in the deeps! ${s.name} loses a quarter of its people.`, { civ: c.id, type: c.isPlayer ? 'bad' : 'world', toast: true, tile: s.tile }); } } },
      { label: 'Seal the tunnels', desc: '+3 stability', ai: 1, fx: (c) => stab(c, 3) },
    ],
  },
  {
    id: 'dwarf_ancestors', title: 'Hall of Ancestors', weight: 1, race: 'dwarves',
    cond: (c) => (c.stock.stone > 100 && !c.flags?.ancestors ? {} : false),
    text: () => 'The clans ask that the names of the ancestors be carved in a great hall.',
    options: [
      { label: 'Carve the hall', desc: '−100 stone, permanent +2 stability', ai: 1.5, fx: (c) => { c.stock.stone -= 100; addMod(c, 'Hall of Ancestors', { stability: 2 }, -1); (c.flags ??= {}).ancestors = 1; } },
      { label: 'Refuse', desc: '−3 stability for 2 years', ai: 0.5, fx: (c) => addMod(c, 'Dishonoured ancestors', { stability: -3 }, 24) },
    ],
  },
  {
    id: 'orc_hunt', title: 'The Great Hunt', weight: 1.2, race: 'orcs',
    cond: () => ({}),
    text: () => 'The warbands call for a great hunt to prove their strength.',
    options: [
      { label: 'Let the hunt begin', desc: 'Food stores filled +40%, +5 stability for 2 years', ai: 1.5, fx: (c) => { food(c, 0.4); addMod(c, 'Great Hunt', { stability: 5 }, 24); } },
      { label: 'Forbid it', desc: '−4 stability', ai: 0.5, fx: (c) => stab(c, -4) },
    ],
  },
  {
    id: 'orc_waaagh', title: 'The Warbands Grow Restless', weight: 1.5, race: 'orcs',
    cond: (c) => { if (yearsAtPeace(c) < 10 || c.overlord >= 0) return false; const t = c.contacts.filter((x) => canDeclareWar(c.id, x).ok).sort((a, b) => militaryStrength(a) - militaryStrength(b))[0]; return t != null ? { t } : false; },
    text: (c, x) => `Too long at peace! The warbands demand blood — and ${civOf(x.t).displayName} looks weak.`,
    options: [
      { label: 'WAR!', desc: `Declare war; +10 stability for 2 years`, ai: 2, fx: (c, x) => { if (declareWar(c.id, x.t).ok) addMod(c, 'Blood and glory', { stability: 10 }, 24); } },
      { label: 'Calm the warbands', desc: '−8 stability for 2 years', ai: 1, fx: (c) => addMod(c, 'Restless warbands', { stability: -8 }, 24) },
    ],
  },
  {
    id: 'human_guilds', title: 'The Merchant Guilds', weight: 1, race: 'humans',
    cond: (c) => (setts(c).some((s) => s.buildings.market) ? {} : false),
    text: () => 'Wealthy merchants petition for a royal charter and guild privileges.',
    options: [
      { label: 'Grant the charter', desc: '+15% gold for 10 years, −3 stability for 3 years', ai: 1.5, fx: (c) => { addMod(c, 'Guild charter', { gold: 0.15 }, 120); addMod(c, 'Nobles resent the guilds', { stability: -3 }, 36); } },
      { label: 'Refuse', desc: '+2 stability', ai: 1, fx: (c) => stab(c, 2) },
    ],
  },
  {
    id: 'human_pilgrimage', title: 'Pilgrimage', weight: 1, race: 'humans',
    cond: (c) => (setts(c).some((s) => s.buildings.temple) ? {} : false),
    text: () => 'Pilgrims gather to journey to a holy site.',
    options: [
      { label: 'The ruler leads them', desc: '−3 gold-months, ruler becomes Pious, +6 stability for 5 years', ai: 1, fx: (c) => { gold(c, -3); if (!c.ruler.traits.includes('pious')) c.ruler.traits.push('pious'); addMod(c, 'Holy pilgrimage', { stability: 6 }, 60); } },
      { label: 'Bless them from afar', desc: '+2 stability', ai: 1, fx: (c) => stab(c, 2) },
    ],
  },
  {
    id: 'golden_age', title: 'A Golden Age', weight: 1.5,
    cond: (c) => (c.stability > 72 && c.treasury > 0 && c.settlements.length >= 3 && !c.modifiers.some((m) => m.name.startsWith('Golden Age')) ? {} : false),
    text: (c) => `Peace and plenty reign across ${c.displayName}. Poets already call this a golden age.`,
    options: [
      { label: 'An age of learning', desc: '+20% knowledge for 15 years', ai: 1, fx: (c) => addMod(c, 'Golden Age of learning', { knowledge: 0.2 }, 180) },
      { label: 'An age of commerce', desc: '+15% gold and +5% growth for 15 years', ai: 1, fx: (c) => addMod(c, 'Golden Age of commerce', { gold: 0.15, growth: 0.05 }, 180) },
      { label: 'An age of building', desc: '+25% build speed for 15 years', ai: 1, fx: (c) => addMod(c, 'Golden Age of building', { build: 0.25 }, 180) },
    ],
  },
  {
    id: 'dark_times', title: 'Dark Times', weight: 1.5,
    cond: (c) => (c.stability < 25 && c.settlements.length >= 2 ? {} : false),
    text: () => 'Bread is scarce, faith is shaken and the streets grow dangerous. The people look for someone to blame.',
    options: [
      { label: 'Open the royal granaries', desc: '−50% food stores, +8 stability', ai: 1.5, fx: (c) => { c.stock.grain *= 0.5; stab(c, 8); } },
      { label: 'Blame the court ministers', desc: '+5 stability, ruler loses a positive trait', ai: 1, fx: (c) => { stab(c, 5); const good = ['just', 'charismatic', 'wise', 'diligent', 'builder']; const i = c.ruler.traits.findIndex((t) => good.includes(t)); if (i >= 0) c.ruler.traits.splice(i, 1); invalidateMods(c); } },
      { label: 'Endure', desc: 'Nothing changes', ai: 0.5, fx: () => {} },
    ],
  },
  {
    id: 'royal_wedding', title: 'A Royal Match', weight: 1.2,
    cond: (c) => { const h = heirOf(c); if (!h || h.age < 16) return false; const o = c.contacts.find((x) => civOf(x).alive && !civOf(x).rebel && opinion(c.id, x) > -5 && !warsOf(c.id).some((w) => w.att.includes(x) || w.def.includes(x))); return o != null ? { o } : false; },
    text: (c, x) => `${civOf(x.o).displayName} proposes a marriage between ${heirOf(c).name} and one of their nobles.`,
    options: [
      { label: 'Celebrate the union', desc: 'Relations greatly improve; a chance of alliance', ai: 1.5, fx: (c, x) => { const r = rel(c.id, x.o); r.gift = Math.min(60, r.gift + 30); if (!r.ally && G.rng.chance(c.isPlayer ? 0.5 : 0.35)) { r.ally = true; log(`${c.displayName} and ${civOf(x.o).displayName} are joined by marriage and alliance.`, { civ: c.id, type: c.isPlayer ? 'good' : 'world', toast: c.isPlayer }); } } },
      { label: 'Decline politely', desc: 'Slightly worse relations', ai: 0.6, fx: (c, x) => { rel(c.id, x.o).grudge += 8; } },
    ],
  },
  {
    id: 'bandits', title: 'Bandits on the Roads', weight: 1.2,
    cond: (c) => { const s = setts(c).find((x) => (x.unrest || 0) > 30); return s ? { s: s.id } : false; },
    text: (c, x) => `Outlaws prey on travellers near ${S().settlements[x.s].name}, and trade dries up.`,
    options: [
      { label: 'Hire them as soldiers', desc: '−2 gold-months, gain 2 regiments of infantry there', ai: 1, fx: (c, x) => { gold(c, -2); const s = S().settlements[x.s]; const a = createArmy(c, s.tile, s.id); a.units.infantry = 2; a.morale = 0.7; } },
      { label: 'Hunt them down', desc: '−15 unrest there, −1 gold-month', ai: 1.5, fx: (c, x) => { gold(c, -1); const s = S().settlements[x.s]; s.unrest = Math.max(0, s.unrest - 15); } },
    ],
  },
  {
    id: 'storm', title: 'The Great Storm', weight: 0.8,
    cond: (c) => { const s = setts(c).find((x) => G.world.provinces[x.province].coastal && x.stage >= 1); return s ? { s: s.id } : false; },
    text: (c, x) => `A furious storm batters the coast around ${S().settlements[x.s].name}.`,
    options: [
      { label: 'Rebuild the harbour', desc: '−3 gold-months, −5% population there', ai: 1.5, fx: (c, x) => { gold(c, -3); S().settlements[x.s].pop *= 0.95; } },
      { label: 'Abandon the waterfront', desc: '−12% population there, lose 30% of food stores', ai: 1, fx: (c, x) => { S().settlements[x.s].pop *= 0.88; c.stock.grain *= 0.7; c.stock.fish *= 0.7; } },
    ],
  },
  {
    id: 'heresy', title: 'A New Faith', weight: 1,
    cond: (c) => (setts(c).some((s) => s.buildings.temple) && c.era >= 1 ? {} : false),
    text: () => 'A charismatic preacher gathers followers, denouncing the old priesthood.',
    options: [
      { label: 'Tolerate the new faith', desc: '+10% knowledge for 10 years, −4 stability for 3 years (−8 in a theocracy)', ai: 1, fx: (c) => { addMod(c, 'Religious freedom', { knowledge: 0.1 }, 120); addMod(c, 'Schism', { stability: c.gov === 'theocracy' ? -8 : -4 }, 36); } },
      { label: 'Persecute the heretics', desc: '+3 stability, +15 unrest in two settlements', ai: c => (c.gov === 'theocracy' ? 2 : 1), fx: (c) => { stab(c, 3); for (const s of setts(c).slice(0, 2)) s.unrest = Math.min(100, (s.unrest || 0) + 15); } },
    ],
  },
  {
    id: 'inventor', title: 'A Brilliant Inventor', weight: 1,
    cond: (c) => (c.era >= 2 ? {} : false),
    text: () => 'A tinkerer presents plans for a marvellous machine, if only the crown will fund it.',
    options: [
      { label: 'Fund the invention', desc: '−4 gold-months; likely a great leap in research', ai: 1.3, fx: (c) => { gold(c, -4); research(c, G.rng.chance(0.75) ? 0.8 : 0.1); } },
      { label: 'Show them the door', desc: 'Nothing happens', ai: 1, fx: () => {} },
    ],
  },
  {
    id: 'mercenaries', title: 'Sellswords for Hire', weight: 1.2,
    cond: (c) => (warsOf(c.id).length && c.treasury > income(c) * 6 ? {} : false),
    text: () => 'A company of hardened mercenaries offers its services — for the right price.',
    options: [
      { label: 'Hire the company', desc: '−6 gold-months; 5 veteran regiments at the capital', ai: 1.5, fx: (c) => { gold(c, -6); const cap = S().settlements[c.capital]; if (cap) { const a = createArmy(c, cap.tile, cap.id); a.name = 'Free Company'; a.units.infantry = 3; a.units.archers = 1; a.units.cavalry = 1; a.general.skill = Math.min(5, a.general.skill + 1); } } },
      { label: 'We fight our own wars', desc: 'Nothing happens', ai: 1, fx: () => {} },
    ],
  },
  {
    id: 'earthquake', title: 'Earthquake', weight: 0.6,
    cond: (c) => { const s = setts(c).find((x) => (G.world.provinces[x.province].biomes[13] || 0) > 3 && x.stage >= 1); return s ? { s: s.id } : false; },
    text: (c, x) => `The mountains shake and buildings crumble in ${S().settlements[x.s].name}.`,
    options: [
      { label: 'Send aid', desc: '−3 gold-months, −5% population', ai: 1.5, fx: (c, x) => { gold(c, -3); S().settlements[x.s].pop *= 0.95; } },
      { label: 'They must fend for themselves', desc: '−12% population, +20 unrest there', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; s.pop *= 0.88; s.unrest = Math.min(100, (s.unrest || 0) + 20); } },
    ],
  },
  {
    id: 'trade_fair', title: 'The Great Fair', weight: 1,
    cond: (c) => (setts(c).some((s) => s.buildings.market) && Object.keys(S().diplo || {}).some((k) => S().diplo[k].trade && k.split('-').map(Number).includes(c.id)) ? {} : false),
    text: () => 'Merchants from distant lands gather for a great trade fair.',
    options: [
      { label: 'Tax the merchants', desc: '+5 gold-months', ai: 1.2, fx: (c) => gold(c, 5) },
      { label: 'Let trade flow freely', desc: '+10% gold for 5 years, +2 stability', ai: 1, fx: (c) => { addMod(c, 'Free fair', { gold: 0.1 }, 60); stab(c, 2); } },
    ],
  },
  {
    id: 'lizard_spawning', title: 'Spawning Season', weight: 1.2, race: 'lizardfolk',
    cond: (c) => (c.stock.grain > storageCaps(c).grain * 0.4 ? {} : false),
    text: () => 'The warm rains have come and the spawning pools teem with eggs.',
    options: [
      { label: 'Guard the clutches', desc: '−30% food stores, +10% population everywhere', ai: 1.5, fx: (c) => { c.stock.grain *= 0.7; for (const s of setts(c)) { s.pop *= 1.1; s.housing = Math.max(s.housing, Math.ceil(s.pop)); } } },
      { label: 'Let nature decide', desc: '+3% population everywhere', ai: 1, fx: (c) => { for (const s of setts(c)) s.pop *= 1.03; } },
    ],
  },
  {
    id: 'lizard_cold', title: 'The Long Cold', weight: 1, race: 'lizardfolk',
    cond: () => ({}),
    text: () => 'An unseasonable chill grips the land. Our people grow sluggish and slow.',
    options: [
      { label: 'Light great fires', desc: '−40% of wood stores', ai: 1.5, fx: (c) => { c.stock.wood *= 0.6; } },
      { label: 'Wait for warmth', desc: '−15% production for 1 year', ai: 1, fx: (c) => addMod(c, 'Torpor', { food: -0.15, wood: -0.15, stone: -0.15, iron: -0.15, gold: -0.15 }, 12) },
    ],
  },
  {
    id: 'halfling_feast', title: 'Midsummer Feast', weight: 1.2, race: 'halflings',
    cond: (c) => (c.stock.grain > storageCaps(c).grain * 0.3 ? {} : false),
    text: () => 'Every hall and hollow prepares for the great midsummer feast.',
    options: [
      { label: 'A feast to remember!', desc: '−35% food stores, +10 stability for 2 years', ai: 1.5, fx: (c) => { c.stock.grain *= 0.65; addMod(c, 'Midsummer feast', { stability: 10 }, 24); } },
      { label: 'A modest supper', desc: '+2 stability', ai: 1, fx: (c) => stab(c, 2) },
    ],
  },
  {
    id: 'halfling_wanderlust', title: 'Wanderlust', weight: 1, race: 'halflings',
    cond: (c) => { const s = largest(c); return s && s.pop > 120 ? { s: s.id } : false; },
    text: (c, x) => `Restless young folk of ${S().settlements[x.s].name} long to see the wide world.`,
    options: [
      { label: 'Give them our blessing', desc: '−6% population there; they return with tales and coin (+30% research, +3 gold-months)', ai: 1, fx: (c, x) => { S().settlements[x.s].pop *= 0.94; research(c, 0.3); gold(c, 3); } },
      { label: 'Keep them home', desc: '+5 unrest there', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; s.unrest = Math.min(100, (s.unrest || 0) + 5); } },
    ],
  },
  {
    id: 'rebel_fervor', title: 'Seditious Whispers', weight: 1.5,
    cond: (c) => { const s = setts(c).find((x) => (x.unrest || 0) > 45 && !x.isCapital); return s ? { s: s.id } : false; },
    text: (c, x) => `Agitators stir up the people of ${S().settlements[x.s].name} against our rule.`,
    options: [
      { label: 'Grant local privileges', desc: '−3 gold-months, −25 unrest there', ai: 1.5, fx: (c, x) => { gold(c, -3); const s = S().settlements[x.s]; s.unrest = Math.max(0, s.unrest - 25); } },
      { label: 'Send in the soldiers', desc: 'Raise a garrison there (2 regiments); −10 unrest', ai: 1, fx: (c, x) => { const s = S().settlements[x.s]; const a = createArmy(c, s.tile, s.id); a.units.infantry = 2; s.pop -= 15; s.unrest = Math.max(0, s.unrest - 10); } },
    ],
  },
];
EVENTS.push(...CHAIN_EVENTS); // Phase 17: story chains
EVENTS.push(...EARLY_EVENTS); // Phase 19: young realms, coalition invitations
const BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ---------------- Engine ----------------
export function eventsMonthly(civ) {
  const st = S();
  if (!civ.alive || !civ.settlements.length) return;
  const youngRealm = civ.settlements.length <= 2 && (st.settlements[civ.capital]?.stage ?? 9) <= 1;
  if (!G.rng.chance(youngRealm ? 1 / 12 : 1 / 30)) return; // young realms see more happen
  if (civ.isPlayer && st.pendingEvents.some((p) => p.civ === civ.id)) return;
  const pool = [];
  for (const ev of EVENTS) {
    if (ev.race && ev.race !== civ.race) continue;
    if (!ev.weight) continue;
    if ((civ.eventSeen?.[ev.id] ?? -99999) > st.day - 360 * 8) continue;
    const ctx = ev.cond(civ);
    if (ctx) pool.push([ev, ctx]);
  }
  const pick = G.rng.weighted(pool, (p) => p[0].weight);
  if (!pick) return;
  const [ev, ctx] = pick;
  (civ.eventSeen ??= {})[ev.id] = st.day;
  if (civ.isPlayer) {
    st.pendingEvents.push({ id: st.nextEventId++, ev: ev.id, civ: civ.id, ctx, day: st.day });
  } else {
    const opt = G.rng.weighted(ev.options, (o) => (typeof o.ai === 'function' ? o.ai(civ) : o.ai));
    opt.fx(civ, ctx);
  }
}

export function eventView(pe) {
  const ev = BY_ID[pe.ev];
  const civ = civOf(pe.civ);
  return { title: ev.title, chain: ev.chain || null, text: ev.text(civ, pe.ctx), options: ev.options.map((o) => ({ label: o.label, desc: o.desc })) };
}

export function resolveEvent(peId, idx) {
  const st = S();
  const pe = st.pendingEvents.find((p) => p.id === peId);
  if (!pe) return;
  st.pendingEvents = st.pendingEvents.filter((p) => p !== pe);
  const ev = BY_ID[pe.ev];
  const civ = civOf(pe.civ);
  const opt = ev.options[idx] || ev.options[0];
  try { opt.fx(civ, pe.ctx); } catch (e) { console.warn('event effect failed', e); }
  log(`${ev.title}: ${opt.label}.`, { civ: civ.id, type: 'info' });
}

// Expire timed modifiers
export function cleanModifiers(civ) {
  if (!civ.modifiers?.length) return;
  const day = S().day;
  const before = civ.modifiers.length;
  civ.modifiers = civ.modifiers.filter((m) => m.until < 0 || m.until > day);
  if (civ.modifiers.length !== before) invalidateMods(civ);
}
void RACES; void BUILDINGS; void E;
