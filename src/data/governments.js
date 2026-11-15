export const GOVERNMENTS = {
  tribal: {
    id: 'tribal', name: 'Tribal Government', realm: (n) => `${n} Tribes`, title: ['Chieftain', 'Chieftess'],
    desc: 'Loose kinship rule. +10% growth, -10% knowledge.', fx: { growth: 0.1, knowledge: -0.1 }, succession: 'heir',
  },
  monarchy: {
    id: 'monarchy', name: 'Monarchy', realm: (n) => `Kingdom of ${n}`, title: ['King', 'Queen'],
    desc: '+6 stability, +1 admin.', fx: { stability: 6, admin: 1 }, succession: 'heir',
    requires: { tech: 'code_of_laws', stage: 1 },
  },
  republic: {
    id: 'republic', name: 'Republic', realm: (n) => `Republic of ${n}`, title: ['Consul', 'Consul'],
    desc: '+15% gold, +10% knowledge, -3 stability. Rulers elected every 8 years.', fx: { gold: 0.15, knowledge: 0.1, stability: -3 }, succession: 'election',
    requires: { tech: 'republicanism', stage: 2 },
  },
  theocracy: {
    id: 'theocracy', name: 'Theocracy', realm: (n) => `Holy ${n}`, title: ['High Priest', 'High Priestess'],
    desc: '+12 stability, -10% knowledge.', fx: { stability: 12, knowledge: -0.1 }, succession: 'election',
    requires: { tech: 'theology', building: 'temple' },
  },
  empire: {
    id: 'empire', name: 'Empire', realm: (n) => `${n} Empire`, title: ['Emperor', 'Empress'],
    desc: '+10% production, +2 admin, -4 stability.', fx: { food: 0.1, wood: 0.1, stone: 0.1, iron: 0.1, gold: 0.1, admin: 2, stability: -4 }, succession: 'heir',
    requires: { gov: 'monarchy', provinces: 12, tech: 'feudalism' },
  },
  dictatorship: {
    id: 'dictatorship', name: 'Dictatorship', realm: (n) => `${n} State`, title: ['Dictator', 'Dictator'],
    desc: '+25% build speed, +10% taxes, -10 stability.', fx: { build: 0.25, tax: 0.1, stability: -10 }, succession: 'seize',
    requires: { stage: 1 },
  },
};

export const SUCCESSION_LAWS = {
  primogeniture: { name: 'Primogeniture', desc: 'The eldest child inherits, even as a minor (regency). Stable, but a weak heir is still heir.' },
  elective: { name: 'Elective', desc: 'The most capable adult child is chosen by the council. Better rulers, but rivals may contest it. −2 stability.' },
  partition: { name: 'Partition', desc: 'The realm is divided among the adult children: the eldest keeps the capital, younger siblings found realms of their own (same house, allied). +3 stability — the nobles like it.' },
};

export const TRAITS = {
  wise: { name: 'Wise', fx: { knowledge: 0.12 }, desc: '+12% knowledge' },
  ambitious: { name: 'Ambitious', fx: { growth: 0.05 }, desc: '+5% growth, eager to expand', expand: 1.3 },
  greedy: { name: 'Greedy', fx: { tax: 0.15, stability: -3 }, desc: '+15% taxes, -3 stability' },
  just: { name: 'Just', fx: { stability: 5 }, desc: '+5 stability' },
  builder: { name: 'Builder', fx: { build: 0.2 }, desc: '+20% build speed' },
  brave: { name: 'Brave', fx: { defense: 10 }, desc: '+10 defense' },
  cruel: { name: 'Cruel', fx: { stability: -4, tax: 0.1 }, desc: '-4 stability, +10% taxes' },
  diligent: { name: 'Diligent', fx: { food: 0.05, wood: 0.05, stone: 0.05 }, desc: '+5% food, wood and stone' },
  lazy: { name: 'Lazy', fx: { build: -0.15 }, desc: '-15% build speed' },
  pious: { name: 'Pious', fx: { stability: 3 }, desc: '+3 stability' },
  charismatic: { name: 'Charismatic', fx: { stability: 2, gold: 0.05 }, desc: '+2 stability, +5% gold' },
  frugal: { name: 'Frugal', fx: { cost: -0.1 }, desc: '-10% construction costs' },
  // Phase 11
  genius: { name: 'Genius', fx: { knowledge: 0.15, stability: 1 }, desc: '+15% knowledge, +1 stability; all skills higher', rare: true },
  strong: { name: 'Strong', fx: { defense: 6 }, desc: '+6 defense; healthier, lives longer' },
  sickly: { name: 'Sickly', fx: { stability: -1 }, desc: '-1 stability; more likely to die young' },
  schemer: { name: 'Schemer', fx: {}, desc: 'Master of intrigue: plots succeed more often' },
  paranoid: { name: 'Paranoid', fx: { stability: -1 }, desc: 'Sees plots everywhere: hard to assassinate, uncovers conspiracies' },
  honest: { name: 'Honest', fx: { stability: 2 }, desc: '+2 stability; courtiers trust them; bad at intrigue' },
};
export const TRAIT_LIST = Object.keys(TRAITS);
// Opposites that never appear together
export const TRAIT_OPPOSITES = [['lazy', 'builder'], ['lazy', 'diligent'], ['just', 'cruel'], ['strong', 'sickly'], ['honest', 'schemer'], ['frugal', 'greedy']];

// A ruler's lifelong focus: earns experience each year and, at 100, a new trait and +1 skill.
export const LIFESTYLES = {
  diplomacy: { name: 'Diplomacy', stat: 'dip', icon: '✉', perks: ['charismatic', 'just', 'honest'], desc: 'Courtly grace: better opinions abroad and at court.' },
  martial: { name: 'Martial', stat: 'mar', icon: '⚔', perks: ['brave', 'strong'], desc: 'Drill and command: stronger armies.' },
  stewardship: { name: 'Stewardship', stat: 'stw', icon: '◎', perks: ['diligent', 'frugal', 'builder'], desc: 'Ledgers and estates: richer lands.' },
  learning: { name: 'Learning', stat: 'lrn', icon: '✎', perks: ['wise', 'genius'], desc: 'Books and scholars: more knowledge.' },
  intrigue: { name: 'Intrigue', stat: 'int', icon: '☽', perks: ['schemer', 'paranoid'], desc: 'Spies and secrets: plots succeed, plots against you fail.' },
};
export const LIFESTYLE_LIST = Object.keys(LIFESTYLES);
export const STAT_NAMES = { dip: 'Diplomacy', mar: 'Martial', stw: 'Stewardship', lrn: 'Learning', int: 'Intrigue' };

export const PERSONALITIES = {
  expansionist: { name: 'Expansionist', expand: 1.7, build: 0.9, tax: 0.22, tags: { food: 1.3, admin: 1.3, build: 1.0, econ: 0.9, military: 1.0, science: 0.8 }, pri: { food: 30, wood: 25, stone: 15, iron: 10, gold: 10, knowledge: 10 } },
  diplomatic: { name: 'Diplomatic', expand: 1.0, build: 1.0, tax: 0.18, tags: { food: 1, admin: 1.4, build: 1, econ: 1.2, military: 0.6, science: 1.2 }, pri: { food: 25, wood: 20, stone: 10, iron: 5, gold: 20, knowledge: 20 } },
  isolationist: { name: 'Isolationist', expand: 0.55, build: 1.3, tax: 0.15, tags: { food: 1.2, admin: 1.1, build: 1.4, econ: 1, military: 1, science: 1.1 }, pri: { food: 30, wood: 20, stone: 20, iron: 10, gold: 10, knowledge: 10 } },
  trader: { name: 'Trade-oriented', expand: 1.0, build: 1.1, tax: 0.2, tags: { food: 1, admin: 1, build: 1, econ: 1.7, military: 0.6, science: 1 }, pri: { food: 25, wood: 20, stone: 10, iron: 5, gold: 30, knowledge: 10 } },
  militaristic: { name: 'Militaristic', expand: 1.3, build: 1.0, tax: 0.25, tags: { food: 1, admin: 0.9, build: 1, econ: 0.8, military: 1.8, science: 0.8 }, pri: { food: 25, wood: 20, stone: 15, iron: 25, gold: 10, knowledge: 5 } },
  defensive: { name: 'Defensive', expand: 0.8, build: 1.2, tax: 0.18, tags: { food: 1.1, admin: 1.1, build: 1.3, econ: 0.9, military: 1.4, science: 0.9 }, pri: { food: 25, wood: 20, stone: 25, iron: 15, gold: 10, knowledge: 5 } },
};
export const PERSONALITY_LIST = Object.keys(PERSONALITIES);

export const SECTORS = ['food', 'wood', 'stone', 'iron', 'gold', 'knowledge'];
