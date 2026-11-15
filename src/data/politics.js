// Phase 10 — interest groups and laws (inspired by Victoria 3).
// Groups draw their members from the Phase 8 pops; laws change the economy and society.

// pops: share of each profession that backs the group
export const GROUPS = {
  landowners: { name: 'Landowners', short: 'Landowners', color: '#c9a050', icon: '♜', pops: { aristocrats: 1, peasants: 0.04 }, desc: 'Nobles and great estate holders. Want serfdom, low land taxes and a strong church.' },
  rural: { name: 'Rural Folk', short: 'Rural', color: '#8fbf5a', icon: '❀', pops: { peasants: 0.96 }, desc: 'Peasants and smallholders. Want land of their own, light taxes and relief in hard times.' },
  devout: { name: 'The Devout', short: 'Devout', color: '#c8b8ff', icon: '✝', pops: { clergy: 1, peasants: 0.0 }, desc: 'Priests and the faithful. Want a state religion and church schools.' },
  burghers: { name: 'Burghers', short: 'Burghers', color: '#e6b422', icon: '⚖', pops: { merchants: 1, craftsmen: 1 }, desc: 'Merchants, artisans and guild masters. Want guilds, fair taxes and trade.' },
  industrialists: { name: 'Industrialists', short: 'Industry', color: '#2fbf71', icon: '⚙', pops: { capitalists: 1 }, desc: 'Factory owners and financiers. Want free trade and no labour rules.' },
  workers: { name: 'Workers', short: 'Workers', color: '#e05a4a', icon: '✊', pops: { laborers: 1 }, desc: 'Labourers in mills, mines and camps. Want protections, welfare and schools.' },
  armed: { name: 'Armed Forces', short: 'Army', color: '#a33a3a', icon: '⚔', pops: { soldiers: 1, aristocrats: 0.25 }, desc: 'Officers and soldiers. Want a strong professional army.' },
};
export const GROUP_LIST = Object.keys(GROUPS);

// How much political weight each profession carries (wealth and organisation).
export const POP_WEIGHT = { peasants: 0.35, laborers: 0.7, craftsmen: 1.4, merchants: 3, clergy: 2.5, soldiers: 1.6, aristocrats: 9, capitalists: 14 };

// Governments give some groups a louder voice.
export const GOV_VOICE = {
  tribal: { rural: 1.6, armed: 1.4, devout: 1.2 },
  monarchy: { landowners: 1.5, devout: 1.2, armed: 1.2 },
  republic: { burghers: 1.6, rural: 1.2, workers: 1.2, landowners: 0.8 },
  theocracy: { devout: 2.2, landowners: 1.1 },
  empire: { landowners: 1.4, armed: 1.6 },
  dictatorship: { armed: 2.2, industrialists: 1.2, burghers: 0.8 },
};

// Law effects:
//  fx      → regular modifiers (food, gold, tax, knowledge, growth, build, stability, defense, admin, cost)
//  hooks   → ownerShare (profit share taken by owners), mobility (how freely peasants change jobs),
//            trade (cross-market trade volume), markup (import price multiplier), recruit/upkeep (army costs),
//            welfare (gold per 100 people per month, raises poor pops' living standard), school (gold per 100 people)
//  voice   → multiplies a group's clout
//  stance  → group → -2..+2 (opposes … supports)
export const LAW_CATS = {
  land: { name: 'Land', icon: '❀' },
  tax: { name: 'Taxation', icon: '◎' },
  trade: { name: 'Trade', icon: '⚓' },
  church: { name: 'Church & State', icon: '✝' },
  army: { name: 'Army', icon: '⚔' },
  school: { name: 'Education', icon: '✎' },
  labor: { name: 'Labour', icon: '⚒' },
  welfare: { name: 'Welfare', icon: '♥' },
};
export const CAT_LIST = Object.keys(LAW_CATS);

export const LAWS = {
  // Land
  serfdom: { cat: 'land', name: 'Serfdom', desc: 'Peasants are bound to the estates.', fx: { food: 0.04 }, hooks: { ownerShare: 0.34, mobility: 0.45 }, stance: { landowners: 2, rural: -2, burghers: -1, industrialists: -1, workers: -1 } },
  tenant_farming: { cat: 'land', name: 'Tenant Farming', desc: 'Peasants rent their land and may leave it.', tech: 'feudalism', fx: {}, hooks: { ownerShare: 0.25, mobility: 1 }, stance: { landowners: 1, rural: 0, burghers: 1 } },
  homesteading: { cat: 'land', name: 'Homesteading', desc: 'Free land for those who work it: more growth, fewer estates.', tech: 'banking', fx: { growth: 0.08, food: 0.03 }, hooks: { ownerShare: 0.16, mobility: 1.35 }, stance: { landowners: -2, rural: 2, burghers: 1, industrialists: 1, workers: 1 } },
  // Taxation
  land_tax: { cat: 'tax', name: 'Land Tax', desc: 'Only land is taxed — easy to collect, little revenue.', fx: { tax: -0.08, stability: 1 }, stance: { landowners: -1, rural: -1, burghers: 1, industrialists: 1 } },
  per_capita: { cat: 'tax', name: 'Per-Capita Tax', desc: 'Every head pays the same: efficient but hard on the poor.', tech: 'currency', fx: { tax: 0.1, stability: -2 }, stance: { landowners: 2, rural: -2, workers: -2, burghers: 0 } },
  proportional_tax: { cat: 'tax', name: 'Proportional Tax', desc: 'Everyone pays a share of their income.', tech: 'code_of_laws', fx: { tax: 0.12 }, stance: { landowners: -1, burghers: 1, rural: 1, workers: 1 } },
  income_tax: { cat: 'tax', name: 'Graduated Income Tax', desc: 'The rich pay more — the richest revenue there is.', tech: 'parliament', fx: { tax: 0.24 }, stance: { landowners: -2, industrialists: -2, burghers: -1, workers: 2, rural: 1 } },
  // Trade
  mercantilism: { cat: 'trade', name: 'Mercantilism', desc: 'Hoard gold, export more than you import.', fx: { gold: 0.05 }, hooks: { trade: 0.85, markup: 2.4 }, stance: { landowners: 1, burghers: 0, industrialists: -1 } },
  protectionism: { cat: 'trade', name: 'Protectionism', desc: 'Tariffs shield home industry from foreign goods.', tech: 'guilds', fx: { build: 0.04 }, hooks: { trade: 0.6, markup: 3 }, stance: { burghers: 2, workers: 1, industrialists: 0, landowners: -1 } },
  free_trade: { cat: 'trade', name: 'Free Trade', desc: 'Open markets: more trade, cheaper imports.', tech: 'banking', fx: { gold: 0.06 }, hooks: { trade: 1.45, markup: 1.8 }, stance: { industrialists: 2, burghers: 1, workers: -1, landowners: -1 } },
  // Church & state
  state_religion: { cat: 'church', name: 'State Religion', desc: 'The faith is the law of the land.', fx: { stability: 3, knowledge: -0.04 }, voice: { devout: 1.5 }, stance: { devout: 2, landowners: 1, burghers: -1, industrialists: -1 } },
  freedom_of_conscience: { cat: 'church', name: 'Freedom of Conscience', desc: 'The state favours one faith but tolerates all.', tech: 'scholasticism', fx: { stability: 1, knowledge: 0.04 }, stance: { devout: -1, burghers: 1, rural: 0, industrialists: 1 } },
  secularism: { cat: 'church', name: 'Secularism', desc: 'Church and state are separate.', tech: 'printing_press', fx: { knowledge: 0.12, stability: -2 }, voice: { devout: 0.5 }, stance: { devout: -2, landowners: -1, burghers: 1, industrialists: 2, workers: 1 } },
  // Army
  peasant_levies: { cat: 'army', name: 'Peasant Levies', desc: 'Farmers called to arms when needed: cheap but weak.', fx: {}, hooks: { recruit: 0.85, upkeep: 0.85 }, stance: { landowners: 1, armed: -1, rural: -1 } },
  professional_army: { cat: 'army', name: 'Professional Army', desc: 'Paid, drilled soldiers.', tech: 'chivalry', fx: { defense: 10 }, hooks: { recruit: 1.1, upkeep: 1.25 }, voice: { armed: 1.3 }, stance: { armed: 2, landowners: 0, burghers: 1 } },
  mass_conscription: { cat: 'army', name: 'Mass Conscription', desc: 'Every young man serves: huge, cheap armies.', tech: 'rifling', fx: { growth: -0.03, defense: 5 }, hooks: { recruit: 0.7, upkeep: 0.9 }, voice: { armed: 1.2 }, stance: { armed: 1, rural: -2, workers: -1, industrialists: -1 } },
  // Education
  no_schools: { cat: 'school', name: 'No Schools', desc: 'Learning is for the few.', fx: {}, stance: { landowners: 1, devout: 0, workers: -1, burghers: -1 } },
  religious_schools: { cat: 'school', name: 'Religious Schools', desc: 'The clergy teach children to read scripture.', tech: 'writing', fx: { knowledge: 0.1, stability: 1 }, hooks: { school: 0.03 }, voice: { devout: 1.15 }, stance: { devout: 2, landowners: 0, burghers: 1, industrialists: -1 } },
  public_schools: { cat: 'school', name: 'Public Schools', desc: 'Free schools for every child: much more knowledge, at a cost.', tech: 'printing_press', fx: { knowledge: 0.28 }, hooks: { school: 0.09 }, stance: { devout: -1, landowners: -1, burghers: 1, workers: 2, industrialists: 1 } },
  // Labour
  no_protections: { cat: 'labor', name: 'No Workers’ Rights', desc: 'Owners set wages and hours as they please.', fx: {}, hooks: { ownerShare: 0.0 }, stance: { industrialists: 2, landowners: 1, workers: -2 } },
  guild_charters: { cat: 'labor', name: 'Guild Charters', desc: 'Guilds protect their crafts and members.', tech: 'guilds', fx: { build: -0.03, stability: 1 }, hooks: { ownerShare: -0.04 }, voice: { burghers: 1.2 }, stance: { burghers: 2, industrialists: -1, workers: 1 } },
  worker_protections: { cat: 'labor', name: 'Worker Protections', desc: 'Limits on hours, safety rules and fair wages.', tech: 'industrialization', fx: { stability: 2 }, hooks: { ownerShare: -0.08, poorSol: 0.4 }, voice: { workers: 1.3 }, stance: { workers: 2, industrialists: -2, burghers: 0, landowners: -1 } },
  // Welfare
  no_welfare: { cat: 'welfare', name: 'No Welfare', desc: 'Each fends for themselves.', fx: {}, stance: { industrialists: 1, landowners: 1, workers: -1, rural: -1 } },
  poor_relief: { cat: 'welfare', name: 'Poor Relief', desc: 'Alms and bread for the destitute.', tech: 'code_of_laws', fx: { stability: 2 }, hooks: { welfare: 0.05, poorSol: 0.35 }, stance: { devout: 1, rural: 1, workers: 1, industrialists: -1 } },
  social_security: { cat: 'welfare', name: 'Social Security', desc: 'Pensions and insurance for all.', tech: 'industrialization', fx: { stability: 4, growth: 0.03 }, hooks: { welfare: 0.14, poorSol: 0.8 }, stance: { workers: 2, rural: 1, industrialists: -2, landowners: -1 } },
};
export const LAW_LIST = Object.keys(LAWS);
export const DEFAULT_LAWS = { land: 'serfdom', tax: 'land_tax', trade: 'mercantilism', church: 'state_religion', army: 'peasant_levies', school: 'no_schools', labor: 'no_protections', welfare: 'no_welfare' };
export const lawsIn = (cat) => LAW_LIST.filter((k) => LAWS[k].cat === cat);
