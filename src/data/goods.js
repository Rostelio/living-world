// ================= Goods =================
// mod: which civ modifier scales production of this good (race, techs, government…)
export const GOODS = {
  grain: { name: 'Grain', base: 2, mod: 'food', color: '#e6c04a', icon: 'food' },
  fish: { name: 'Fish', base: 2.2, mod: 'food', color: '#6fc3e8', icon: 'food' },
  wood: { name: 'Wood', base: 2, mod: 'wood', color: '#9c6b3e', icon: 'wood' },
  stone: { name: 'Stone', base: 2.5, mod: 'stone', color: '#b8b2a6', icon: 'stone' },
  iron: { name: 'Iron', base: 4, mod: 'iron', color: '#8f9aa6', icon: 'iron' },
  coal: { name: 'Coal', base: 4, mod: 'iron', color: '#3d3d40', icon: 'iron' },
  tools: { name: 'Tools', base: 8, mod: 'iron', color: '#a0786a', icon: 'iron' },
  cloth: { name: 'Cloth', base: 5, mod: 'gold', color: '#d8c8a8', icon: 'gold' },
  clothes: { name: 'Clothes', base: 9, mod: 'gold', color: '#c06a8a', icon: 'gold' },
  furniture: { name: 'Furniture', base: 10, mod: 'gold', color: '#7a5230', icon: 'wood' },
  liquor: { name: 'Liquor', base: 7, mod: 'gold', color: '#b0563a', icon: 'food' },
  paper: { name: 'Paper', base: 8, mod: 'gold', color: '#f0ead6', icon: 'knowledge' },
  glass: { name: 'Glass', base: 10, mod: 'stone', color: '#9ad4e8', icon: 'stone' },
  weapons: { name: 'Weapons', base: 14, mod: 'iron', color: '#6c7a89', icon: 'defense' },
  steel: { name: 'Steel', base: 14, mod: 'iron', color: '#5c6a7a', icon: 'iron' },
  spices: { name: 'Spices', base: 15, mod: 'gold', color: '#d97a2a', icon: 'gold' },
  horses: { name: 'Horses', base: 12, mod: 'food', color: '#c48a52', icon: 'food' },
  luxuries: { name: 'Luxuries', base: 25, mod: 'gold', color: '#e6b422', icon: 'gold' },
};
export const GOOD_LIST = Object.keys(GOODS);
// Substitutable groups for needs (cheapest available is bought first)
export const GROUPS = {
  food: ['grain', 'fish'],
  fuel: ['wood', 'coal'],
  clothing: ['clothes', 'cloth'],
};

// ================= Pops =================
// needs: per person per month. basic must be met to grow; comfort & luxury raise standard of living.
export const NEEDS = {
  basic: { food: 0.5, fuel: 0.04 },
  comfort: { clothing: 0.04, furniture: 0.015, liquor: 0.03 },
  luxury: { luxuries: 0.012, spices: 0.012, glass: 0.008, paper: 0.008 },
};
export const POPS = {
  peasants: { name: 'Peasants', color: '#8fb04a', wage: 0.7, needs: { basic: 1, comfort: 0.4, luxury: 0 }, desc: 'Farm the land. Unemployed people fall back to subsistence farming.' },
  laborers: { name: 'Laborers', color: '#b0874a', wage: 1, needs: { basic: 1, comfort: 0.7, luxury: 0.1 }, desc: 'Work lumber camps, quarries, mines, harbours and mills.' },
  craftsmen: { name: 'Craftsmen', color: '#c96a3a', wage: 1.4, needs: { basic: 1, comfort: 1.2, luxury: 0.3 }, desc: 'Turn raw goods into tools, clothes, furniture, liquor and more.' },
  merchants: { name: 'Merchants', color: '#e6b422', wage: 2.2, needs: { basic: 1, comfort: 1.5, luxury: 1 }, desc: 'Run markets and banks; profit from trade.' },
  clergy: { name: 'Clergy', color: '#d8d0ff', wage: 1.6, needs: { basic: 1, comfort: 1.2, luxury: 0.6 }, desc: 'Staff temples, libraries and universities. Paid by the state.' },
  soldiers: { name: 'Soldiers', color: '#a33a3a', wage: 1.2, needs: { basic: 1.2, comfort: 1, luxury: 0.2 }, desc: 'Garrison barracks. Paid by the state.' },
  aristocrats: { name: 'Aristocrats', color: '#9b59b6', wage: 4, needs: { basic: 1, comfort: 2.5, luxury: 4 }, desc: 'Own land and pre-industrial workshops; run town halls.' },
  capitalists: { name: 'Capitalists', color: '#2fbf71', wage: 6, needs: { basic: 1, comfort: 2.5, luxury: 5 }, desc: 'Own factories, mills and banks (Industrial era).' },
};
export const POP_LIST = Object.keys(POPS);
// state-paid pop types (wages come from the treasury)
export const STATE_PAID = { clergy: 0.35, soldiers: 0.3 };

// ================= Production =================
// For each building: jobs per level, and production methods (the best one whose tech
// is known is used automatically). io: per worker per month. q: province quality key.
// owner: who takes the profits (aristocrats, or capitalists once Industrial).
export const PRODUCTION = {
  farm: { jobs: { peasants: 20 }, q: 'food', pms: [
    { name: 'Slash & burn', out: { grain: 1.0 } },
    { name: 'Irrigated fields', tech: 'agriculture', out: { grain: 1.2 } },
    { name: 'Crop rotation', tech: 'crop_rotation', in: { tools: 0.01 }, out: { grain: 1.55 } },
    { name: 'Mechanised farming', tech: 'industrialization', in: { tools: 0.02, coal: 0.01 }, out: { grain: 2.2 } },
  ] },
  pasture: { jobs: { peasants: 10 }, q: 'food', pms: [
    { name: 'Herding', out: { cloth: 0.12, horses: 0.015 } },
    { name: 'Selective breeding', tech: 'crop_rotation', out: { cloth: 0.18, horses: 0.025 } },
  ] },
  port: { jobs: { laborers: 15 }, q: 'fish', pms: [
    { name: 'Fishing boats', out: { fish: 1.1 } },
    { name: 'Deep-sea fleets', tech: 'navigation', out: { fish: 1.6 } },
    { name: 'Steam trawlers', tech: 'steam_power', in: { coal: 0.02 }, out: { fish: 2.2 } },
  ] },
  lumber_camp: { jobs: { laborers: 10 }, q: 'wood', pms: [
    { name: 'Hand axes', out: { wood: 1.1 } },
    { name: 'Iron saws', tech: 'iron_working', in: { tools: 0.01 }, out: { wood: 1.5 } },
    { name: 'Steam sawmill', tech: 'steam_power', in: { coal: 0.02, tools: 0.01 }, out: { wood: 2.3 } },
  ] },
  quarry: { jobs: { laborers: 10 }, q: 'stone', pms: [
    { name: 'Hand quarrying', out: { stone: 0.7 } },
    { name: 'Iron chisels', tech: 'iron_working', in: { tools: 0.01 }, out: { stone: 1.0 } },
    { name: 'Blasting', tech: 'gunpowder', in: { tools: 0.015 }, out: { stone: 1.4 } },
  ] },
  mine: { jobs: { laborers: 12 }, q: 'iron', pms: [
    { name: 'Open pits', out: { iron: 0.45 } },
    { name: 'Deep shafts', tech: 'engineering', in: { tools: 0.01, wood: 0.02 }, out: { iron: 0.65 } },
    { name: 'Coal seams', tech: 'steam_power', in: { tools: 0.015 }, out: { iron: 0.8, coal: 0.6 } },
  ] },
  plantation: { jobs: { peasants: 12 }, q: 'spices', pms: [
    { name: 'Spice gardens', out: { spices: 0.1 } },
    { name: 'Colonial plantations', tech: 'navigation', out: { spices: 0.16 } },
  ] },
  smithy: { jobs: { craftsmen: 8 }, pms: [
    { name: 'Bronze casting', out: { tools: 0.08 }, in: { iron: 0.08, wood: 0.04 } },
    { name: 'Blacksmiths', tech: 'iron_working', in: { iron: 0.12, wood: 0.04 }, out: { tools: 0.14, weapons: 0.04 } },
    { name: 'Gunsmiths', tech: 'gunpowder', in: { iron: 0.14, wood: 0.05, coal: 0.02 }, out: { tools: 0.15, weapons: 0.08 } },
  ] },
  weaver: { jobs: { craftsmen: 8 }, pms: [
    { name: 'Hand looms', in: { cloth: 0.2 }, out: { clothes: 0.17 } },
    { name: 'Spinning wheels', tech: 'guilds', in: { cloth: 0.22 }, out: { clothes: 0.24 } },
  ] },
  carpenter: { jobs: { craftsmen: 8 }, pms: [
    { name: 'Joinery', in: { wood: 0.25 }, out: { furniture: 0.1 } },
    { name: 'Cabinet makers', tech: 'guilds', in: { wood: 0.28, tools: 0.01 }, out: { furniture: 0.15 } },
  ] },
  brewery: { jobs: { craftsmen: 8 }, pms: [
    { name: 'Brewing', in: { grain: 0.35 }, out: { liquor: 0.2 } },
    { name: 'Distilling', tech: 'scholasticism', in: { grain: 0.4, wood: 0.03 }, out: { liquor: 0.3 } },
  ] },
  paper_mill: { jobs: { craftsmen: 6 }, pms: [
    { name: 'Papyrus & parchment', in: { wood: 0.2 }, out: { paper: 0.08 } },
    { name: 'Rag paper', tech: 'printing_press', in: { wood: 0.22, cloth: 0.03 }, out: { paper: 0.16 } },
  ] },
  glassworks: { jobs: { craftsmen: 6 }, pms: [
    { name: 'Glassblowing', in: { stone: 0.15, wood: 0.15 }, out: { glass: 0.08 } },
    { name: 'Coal furnaces', tech: 'steam_power', in: { stone: 0.18, coal: 0.08 }, out: { glass: 0.15 } },
  ] },
  jeweller: { jobs: { craftsmen: 5 }, pms: [
    { name: 'Goldsmiths', in: { cloth: 0.08, spices: 0.02, glass: 0.01 }, out: { luxuries: 0.06 } },
    { name: 'Luxury ateliers', tech: 'banking', in: { cloth: 0.08, spices: 0.02, glass: 0.015 }, out: { luxuries: 0.09 } },
  ] },
  textile_mill: { jobs: { laborers: 30, capitalists: 1 }, industrial: true, pms: [
    { name: 'Water mills', in: { cloth: 0.3 }, out: { clothes: 0.38 } },
    { name: 'Steam looms', tech: 'steam_power', in: { cloth: 0.35, coal: 0.04 }, out: { clothes: 0.55 } },
  ] },
  foundry: { jobs: { laborers: 25, capitalists: 1 }, industrial: true, pms: [
    { name: 'Blast furnaces', in: { iron: 0.3, coal: 0.3 }, out: { steel: 0.25 } },
  ] },
  factory: { jobs: { laborers: 40, capitalists: 2 }, industrial: true, pms: [
    { name: 'Assembly lines', in: { steel: 0.08, wood: 0.15 }, out: { tools: 0.18, furniture: 0.14, weapons: 0.08 } },
  ] },
  // Service buildings
  market: { jobs: { merchants: 5 } },
  bank: { jobs: { merchants: 6, capitalists: 1 } },
  temple: { jobs: { clergy: 5 } },
  library: { jobs: { clergy: 5 }, scholars: true, in: { paper: 0.02 } },
  university: { jobs: { clergy: 12 }, scholars: true, in: { paper: 0.03 } },
  observatory: { jobs: { clergy: 6 }, scholars: true, in: { glass: 0.02 } },
  hospital: { jobs: { clergy: 4 } },
  town_hall: { jobs: { aristocrats: 4 } },
  barracks: { jobs: { soldiers: 15 } },
  granary: { jobs: { laborers: 3 } },
  warehouse: { jobs: { laborers: 4 } },
  railway_station: { jobs: { laborers: 12 }, in: { coal: 0.03 } },
};

export const NEED_TIERS = ['basic', 'comfort', 'luxury'];
export const TIER_WEIGHT = { basic: 0.5, comfort: 0.3, luxury: 0.2 };

export function activePM(type, techs) {
  const p = PRODUCTION[type];
  if (!p?.pms) return null;
  let best = p.pms[0];
  for (const pm of p.pms) if (!pm.tech || techs.includes(pm.tech)) best = pm;
  return best;
}
