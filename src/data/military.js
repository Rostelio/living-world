// Regiment types. cls: inf | rng | cav | sie (terrain & tactics).
// men: population drawn per regiment. att/def per regiment. siege: siege power.
export const UNITS = {
  infantry: { name: 'Infantry', cls: 'inf', att: 3, def: 3, speed: 1, siege: 0.25, men: 10, upkeep: 0.25, cost: { gold: 12, wood: 4 }, desc: 'Reliable line troops (spears and shields).' },
  archers: { name: 'Archers', cls: 'rng', att: 3.4, def: 2, speed: 1, siege: 0.1, men: 10, upkeep: 0.3, cost: { gold: 14, wood: 8 }, desc: 'Strong opening volleys; good in forests.' },
  cavalry: { name: 'Cavalry', cls: 'cav', att: 5, def: 3, speed: 1.7, siege: 0, men: 8, upkeep: 0.6, cost: { gold: 28, iron: 6, horses: 1 }, tech: 'bronze_working', barracks: true, desc: 'Fast and hard-hitting. Weak in rough terrain.' },
  siege: { name: 'Siege Engines', cls: 'sie', att: 1, def: 1, speed: 0.7, siege: 4, men: 6, upkeep: 0.5, cost: { gold: 30, wood: 30, iron: 8 }, tech: 'engineering', barracks: true, desc: 'Breaks walls. Fragile in open battle.' },
  musketeers: { name: 'Musketeers', cls: 'inf', att: 6, def: 5, speed: 1, siege: 0.4, men: 10, upkeep: 0.45, cost: { gold: 30, weapons: 3 }, tech: 'gunpowder', barracks: true, desc: 'Gunpowder infantry.' },
  artillery: { name: 'Artillery', cls: 'sie', att: 4, def: 1.5, speed: 0.8, siege: 10, men: 6, upkeep: 0.8, cost: { gold: 60, steel: 8, coal: 4 }, tech: 'steam_power', barracks: true, desc: 'Cannons that shatter fortresses.' },
  regulars: { name: 'Regulars', cls: 'inf', att: 15, def: 13, speed: 1.2, siege: 0.6, men: 10, upkeep: 1, cost: { gold: 75, weapons: 5, steel: 3 }, tech: 'machine_guns', barracks: true, desc: 'Modern infantry with machine guns.' },
  howitzers: { name: 'Howitzers', cls: 'sie', att: 7, def: 2, speed: 0.9, siege: 16, men: 6, upkeep: 1.2, cost: { gold: 100, steel: 12, coal: 6 }, tech: 'machine_guns', barracks: true, desc: 'Heavy guns that flatten any fortress.' },
  riflemen: { name: 'Riflemen', cls: 'inf', att: 10, def: 8, speed: 1.1, siege: 0.5, men: 10, upkeep: 0.7, cost: { gold: 50, weapons: 4, steel: 2 }, tech: 'rifling', barracks: true, desc: 'Industrial-era infantry.' },
  // Race-unique
  knights: { name: 'Knights', cls: 'cav', att: 7.5, def: 5, speed: 1.6, siege: 0, men: 8, upkeep: 0.9, cost: { gold: 45, weapons: 2, horses: 1 }, tech: 'chivalry', race: 'humans', barracks: true, desc: 'Human heavy cavalry.' },
  rangers: { name: 'Elven Rangers', cls: 'rng', att: 5.5, def: 2.5, speed: 1.2, siege: 0.1, men: 8, upkeep: 0.5, cost: { gold: 30, wood: 12 }, tech: 'sylvan_lore', race: 'elves', desc: 'Deadly archers, superb in forests.' },
  ironbreakers: { name: 'Ironbreakers', cls: 'inf', att: 4.5, def: 7, speed: 0.9, siege: 0.5, men: 10, upkeep: 0.6, cost: { gold: 35, iron: 15 }, tech: 'runesmithing', race: 'dwarves', barracks: true, desc: 'Dwarven heavy infantry.' },
  berserkers: { name: 'Berserkers', cls: 'inf', att: 7, def: 2.5, speed: 1.1, siege: 0.3, men: 10, upkeep: 0.45, cost: { gold: 24, iron: 6 }, tech: 'war_drums', race: 'orcs', morale: 0.3, desc: 'Orcish shock troops that never break easily.' },
  saurus: { name: 'Saurus Warriors', cls: 'inf', att: 5.5, def: 5, speed: 1, siege: 0.3, men: 10, upkeep: 0.5, cost: { gold: 28, iron: 6, grain: 10 }, tech: 'marsh_lore', race: 'lizardfolk', barracks: true, desc: 'Scaled shock infantry, tireless in the swamp.' },
  slingers: { name: 'Halfling Slingers', cls: 'rng', att: 3.8, def: 2, speed: 1.1, siege: 0.1, men: 8, upkeep: 0.2, cost: { gold: 9, wood: 3 }, tech: 'hearth_and_home', race: 'halflings', desc: 'Cheap, accurate skirmishers.' },
};
export const UNIT_LIST = Object.keys(UNITS);

export const GENERAL_TRAITS = {
  aggressive: { name: 'Aggressive', att: 0.15, desc: '+15% attack' },
  cautious: { name: 'Cautious', def: 0.15, desc: '+15% defense' },
  siegemaster: { name: 'Siege Master', siege: 0.5, desc: '+50% siege speed' },
  logistician: { name: 'Logistician', speed: 0.25, desc: '+25% speed, less attrition' },
  inspiring: { name: 'Inspiring', morale: 0.25, desc: 'Morale breaks slower' },
  tactician: { name: 'Tactician', att: 0.08, def: 0.08, desc: '+8% attack and defense' },
  reckless: { name: 'Reckless', att: 0.2, def: -0.1, desc: '+20% attack, -10% defense' },
};
export const GENERAL_TRAIT_LIST = Object.keys(GENERAL_TRAITS);

// Terrain modifiers for the defender and for unit classes
import { B } from './biomes.js';
export const TERRAIN_DEF = { [B.HILLS]: 0.25, [B.MOUNTAIN]: 0.45, [B.FOREST]: 0.15, [B.JUNGLE]: 0.2, [B.SWAMP]: 0.1, [B.TAIGA]: 0.12 };
export const ROUGH = new Set([B.HILLS, B.MOUNTAIN, B.FOREST, B.JUNGLE, B.SWAMP, B.TAIGA]);
export const WOODS = new Set([B.FOREST, B.JUNGLE, B.TAIGA]);
