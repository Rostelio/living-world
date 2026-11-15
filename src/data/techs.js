export const ERAS = [
  { name: 'Ancient', cost: 80, unlockNeed: 0 },
  { name: 'Medieval', cost: 1100, unlockNeed: 6 },
  { name: 'Renaissance', cost: 9000, unlockNeed: 6 },
  { name: 'Industrial', cost: 32000, unlockNeed: 6 },
];

// fx: additive bonuses (0.1 = +10%) except stability/defense/admin (flat).
// tags drive AI preference. race: unique to that race.
const T = (id, era, name, desc, fx, tags, extra = {}) => ({ id, era, name, desc, fx, tags, ...extra });

export const TECHS = [
  // Ancient
  T('agriculture', 0, 'Agriculture', '+15% food. Unlocks Granary.', { food: 0.15 }, ['food']),
  T('stoneworking', 0, 'Stoneworking', '+10% stone. Unlocks Quarry.', { stone: 0.1 }, ['build']),
  T('mining', 0, 'Mining', '+10% iron. Unlocks Mine.', { iron: 0.1 }, ['build', 'military']),
  T('mysticism', 0, 'Mysticism', '+2 stability. Unlocks Temple.', { stability: 2 }, ['admin']),
  T('writing', 0, 'Writing', '+10% knowledge. Unlocks Library.', { knowledge: 0.1 }, ['science']),
  T('currency', 0, 'Currency', '+10% gold. Unlocks Market.', { gold: 0.1 }, ['econ']),
  T('bronze_working', 0, 'Bronze Working', '+5 defense. Unlocks Barracks.', { defense: 5 }, ['military']),
  T('the_wheel', 0, 'The Wheel', '+10% build speed. Unlocks Road.', { build: 0.1 }, ['build', 'econ']),
  T('sailing', 0, 'Sailing', 'Unlocks Harbour.', { food: 0.05 }, ['econ', 'food']),
  T('masonry', 0, 'Masonry', '+10% stone, +10% housing. Unlocks Walls.', { stone: 0.1, housing: 0.1 }, ['build', 'military']),
  T('code_of_laws', 0, 'Code of Laws', '+1 admin. Enables Monarchy.', { admin: 1 }, ['admin']),
  // Medieval
  T('feudalism', 1, 'Feudalism', '+3 stability, +1 admin.', { stability: 3, admin: 1 }, ['admin', 'military']),
  T('crop_rotation', 1, 'Crop Rotation', '+20% food.', { food: 0.2 }, ['food']),
  T('brewing', 1, 'Brewing', 'Unlocks Brewery.', { growth: 0.03 }, ['econ']),
  T('scholasticism', 1, 'Scholasticism', '+15% knowledge. Unlocks University.', { knowledge: 0.15 }, ['science']),
  T('engineering', 1, 'Engineering', '+20% build speed, +10% housing.', { build: 0.2, housing: 0.1 }, ['build']),
  T('guilds', 1, 'Guilds', '+15% gold.', { gold: 0.15 }, ['econ']),
  T('theology', 1, 'Theology', '+2 stability. Enables Theocracy.', { stability: 2 }, ['admin']),
  T('iron_working', 1, 'Iron Working', '+20% iron, +10 defense.', { iron: 0.2, defense: 10 }, ['military']),
  T('medicine', 1, 'Medicine', '+5% growth. Unlocks Hospital.', { growth: 0.05 }, ['food']),
  T('astronomy', 2, 'Astronomy', '+10% knowledge. Unlocks Observatory.', { knowledge: 0.1 }, ['science']),
  T('electricity', 3, 'Electricity', '+15% knowledge, +10% gold.', { knowledge: 0.15, gold: 0.1 }, ['science', 'econ']),
  // Renaissance
  T('banking', 2, 'Banking', '+20% gold, +10% taxes.', { gold: 0.2, tax: 0.1 }, ['econ']),
  T('printing_press', 2, 'Printing Press', '+25% knowledge.', { knowledge: 0.25 }, ['science']),
  T('textiles', 2, 'Textiles', 'Unlocks Textile Mill.', { gold: 0.05 }, ['econ']),
  T('navigation', 2, 'Navigation', '+10% food, +10% gold.', { food: 0.1, gold: 0.1 }, ['econ', 'food']),
  T('republicanism', 2, 'Republicanism', '+1 admin. Enables Republic.', { admin: 1 }, ['admin']),
  T('architecture', 2, 'Architecture', '+25% housing, +10% build speed.', { housing: 0.25, build: 0.1 }, ['build']),
  T('gunpowder', 2, 'Gunpowder', '+25 defense.', { defense: 25 }, ['military']),
  // Industrial
  T('steam_power', 3, 'Steam Power', '+15% wood/stone. Unlocks Foundry.', { wood: 0.15, stone: 0.15 }, ['build']),
  T('industrialization', 3, 'Industrialization', '+10% all production. Unlocks Factory.', { food: 0.1, wood: 0.1, stone: 0.1, iron: 0.1, gold: 0.1 }, ['econ']),
  T('sanitation', 3, 'Sanitation', '+15% growth, +25% housing.', { growth: 0.15, housing: 0.25 }, ['food']),
  T('railways', 3, 'Railways', '+25% build speed, +10% taxes.', { build: 0.25, tax: 0.1 }, ['build', 'econ']),
  T('scientific_method', 3, 'Scientific Method', '+30% knowledge.', { knowledge: 0.3 }, ['science']),
  T('rifling', 3, 'Rifling', '+40 defense.', { defense: 40 }, ['military']),

  // Race-unique technologies
  T('chivalry', 1, 'Chivalry', 'Human: +4 stability, +10 defense.', { stability: 4, defense: 10 }, ['military', 'admin'], { race: 'humans' }),
  T('mercantilism', 2, 'Mercantilism', 'Human: +25% gold.', { gold: 0.25 }, ['econ'], { race: 'humans' }),
  T('sylvan_lore', 0, 'Sylvan Lore', 'Elven: +20% wood, +10% food.', { wood: 0.2, food: 0.1 }, ['food', 'build'], { race: 'elves' }),
  T('astral_scholarship', 1, 'Astral Scholarship', 'Elven: +30% knowledge.', { knowledge: 0.3 }, ['science'], { race: 'elves' }),
  T('deep_delving', 0, 'Deep Delving', 'Dwarven: +20% iron and stone.', { iron: 0.2, stone: 0.2 }, ['build'], { race: 'dwarves' }),
  T('runesmithing', 1, 'Runesmithing', 'Dwarven: +20 defense, +15% iron.', { defense: 20, iron: 0.15 }, ['military'], { race: 'dwarves' }),
  T('blood_rites', 0, 'Blood Rites', 'Orcish: +15% growth, +2 stability.', { growth: 0.15, stability: 2 }, ['food', 'admin'], { race: 'orcs' }),
  T('war_drums', 1, 'War Drums', 'Orcish: +15 defense, +3 stability.', { defense: 15, stability: 3 }, ['military'], { race: 'orcs' }),
  T('colonial_charters', 2, 'Colonial Charters', 'Human: +1 admin, +10% growth.', { admin: 1, growth: 0.1 }, ['admin', 'food'], { race: 'humans' }),
  T('parliament', 3, 'Parliament', 'Human: +6 stability, +15% taxes.', { stability: 6, tax: 0.15 }, ['admin', 'econ'], { race: 'humans' }),
  T('living_architecture', 2, 'Living Architecture', 'Elven: +20% housing, +3 stability.', { housing: 0.2, stability: 3 }, ['build'], { race: 'elves' }),
  T('arcane_academies', 3, 'Arcane Academies', 'Elven: +30% knowledge.', { knowledge: 0.3 }, ['science'], { race: 'elves' }),
  T('steamforges', 2, 'Steamforges', 'Dwarven: +25% iron, +15% build speed.', { iron: 0.25, build: 0.15 }, ['build', 'military'], { race: 'dwarves' }),
  T('clockwork_engines', 3, 'Clockwork Engines', 'Dwarven: +10% all production, +20 defense.', { food: 0.1, wood: 0.1, stone: 0.1, iron: 0.1, gold: 0.1, defense: 20 }, ['econ', 'military'], { race: 'dwarves' }),
  T('warband_confederation', 2, 'Warband Confederation', 'Orcish: +2 admin, +5% growth.', { admin: 2, growth: 0.05 }, ['admin'], { race: 'orcs' }),
  T('marsh_lore', 0, 'Marsh Lore', 'Lizardfolk: +15% food, +5% growth. Unlocks Saurus Warriors.', { food: 0.15, growth: 0.05 }, ['food'], { race: 'lizardfolk' }),
  T('serpent_priests', 1, 'Serpent Priests', 'Lizardfolk: +4 stability, +10% knowledge.', { stability: 4, knowledge: 0.1 }, ['admin', 'science'], { race: 'lizardfolk' }),
  T('jade_trade', 2, 'Jade Trade', 'Lizardfolk: +20% gold.', { gold: 0.2 }, ['econ'], { race: 'lizardfolk' }),
  T('bog_iron', 3, 'Bog Iron Works', 'Lizardfolk: +30% iron, +15 defense.', { iron: 0.3, defense: 15 }, ['military', 'build'], { race: 'lizardfolk' }),
  T('hearth_and_home', 0, 'Hearth and Home', 'Halfling: +3 stability, +10% housing. Unlocks Slingers.', { stability: 3, housing: 0.1 }, ['admin', 'build'], { race: 'halflings' }),
  T('master_brewers', 1, 'Master Brewers', 'Halfling: +10% gold, +2 stability.', { gold: 0.1, stability: 2 }, ['econ'], { race: 'halflings' }),
  T('hidden_doors', 2, 'Hidden Doors', 'Halfling: +25 defense, +2 stability.', { defense: 25, stability: 2 }, ['military'], { race: 'halflings' }),
  T('great_kitchens', 3, 'Great Kitchens', 'Halfling: +20% food, +10% growth.', { food: 0.2, growth: 0.1 }, ['food'], { race: 'halflings' }),
  T('iron_horde', 3, 'Iron Horde', 'Orcish: +25% iron, +25 defense.', { iron: 0.25, defense: 25 }, ['military'], { race: 'orcs' }),
];
export const TECH = Object.fromEntries(TECHS.map((t) => [t.id, t]));
