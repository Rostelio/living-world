// Settlement stages
export const STAGES = [
  { name: 'Tribal Camp', short: 'Camp', minPop: 0, density: 2.5, radius: 1, req: [] },
  { name: 'Village', short: 'Village', minPop: 60, density: 6, radius: 2, req: [] },
  { name: 'Town', short: 'Town', minPop: 250, density: 16, radius: 3, req: ['town_hall'] },
  { name: 'City', short: 'City', minPop: 900, density: 38, radius: 4, req: ['town_hall', 'market'] },
  { name: 'Metropolis', short: 'Metropolis', minPop: 3000, density: 75, radius: 5, req: ['town_hall', 'market', 'library'] },
];

// Player-managed buildings. Residential housing is built automatically.
// Jobs and production methods for each building live in data/goods.js (PRODUCTION).
// Costs are paid in goods from the realm's market (and gold from the treasury).
export const BUILDINGS = {
  // --- Raw goods ---
  farm: { name: 'Farmsteads', icon: 'food', max: 5, stage: 0, cost: { wood: 15, gold: 5 }, days: 30, desc: 'Peasants grow grain.' },
  pasture: { name: 'Pastures', icon: 'food', max: 3, stage: 0, needs: 'pasture', cost: { wood: 15, gold: 8 }, days: 30, desc: 'Peasants raise sheep and horses: wool cloth and horses. Needs grass or plains.' },
  port: { name: 'Harbour', icon: 'gold', max: 3, stage: 1, tech: 'sailing', needs: 'coastal', cost: { wood: 70, stone: 20, gold: 20 }, days: 70, tax: 0.15, desc: 'Laborers catch fish; ships and trade by sea. +15% taxes. Coastal only.' },
  lumber_camp: { name: 'Lumber Camp', icon: 'wood', max: 5, stage: 0, cost: { wood: 10, gold: 5 }, days: 25, desc: 'Laborers fell timber.' },
  quarry: { name: 'Quarry', icon: 'stone', max: 4, stage: 0, tech: 'stoneworking', needs: 'stone', cost: { wood: 30, gold: 10 }, days: 40, desc: 'Laborers cut stone. Needs rocky land.' },
  mine: { name: 'Mine', icon: 'iron', max: 4, stage: 1, tech: 'mining', needs: 'iron', cost: { wood: 40, stone: 20, gold: 20 }, days: 60, desc: 'Laborers dig iron (and coal, with Steam Power). Needs ore.' },
  plantation: { name: 'Plantation', icon: 'gold', max: 3, stage: 1, tech: 'currency', needs: 'spices', cost: { wood: 40, gold: 30 }, days: 60, desc: 'Peasants grow spices. Needs jungle, desert or swamp.' },
  // --- Workshops (craftsmen) ---
  smithy: { name: 'Smithy', icon: 'iron', max: 4, stage: 1, tech: 'bronze_working', cost: { wood: 40, stone: 20, iron: 10, gold: 15 }, days: 50, desc: 'Craftsmen forge iron into tools (and weapons, with Iron Working).' },
  weaver: { name: 'Weaver', icon: 'gold', max: 4, stage: 1, cost: { wood: 35, gold: 15 }, days: 45, desc: 'Craftsmen sew cloth into clothes.' },
  carpenter: { name: 'Carpenter', icon: 'wood', max: 4, stage: 1, tech: 'the_wheel', cost: { wood: 30, stone: 10, gold: 15 }, days: 45, desc: 'Craftsmen make furniture from wood.' },
  brewery: { name: 'Brewery', icon: 'food', max: 3, stage: 1, tech: 'brewing', cost: { wood: 50, stone: 30, gold: 30 }, days: 60, stability: 2, tax: 0.05, desc: 'Craftsmen brew grain into liquor. +2 stability.' },
  paper_mill: { name: 'Paper Mill', icon: 'knowledge', max: 3, stage: 1, tech: 'writing', cost: { wood: 50, stone: 20, gold: 25 }, days: 60, desc: 'Craftsmen make paper from wood. Scholars use paper.' },
  glassworks: { name: 'Glassworks', icon: 'stone', max: 3, stage: 2, tech: 'engineering', cost: { stone: 60, wood: 40, tools: 10, gold: 40 }, days: 80, desc: 'Craftsmen make glass from sand (stone) and fuel.' },
  jeweller: { name: 'Jeweller', icon: 'gold', max: 3, stage: 2, tech: 'guilds', cost: { stone: 40, tools: 10, gold: 80 }, days: 90, desc: 'Craftsmen craft luxuries from cloth, spices and glass.' },
  // --- Storage & civic ---
  granary: { name: 'Granary', icon: 'food', max: 3, stage: 0, tech: 'agriculture', cost: { wood: 30, stone: 10 }, days: 40, storage: { food: 300 }, growth: 0.06, desc: '+300 grain & fish storage, +6% growth.' },
  warehouse: { name: 'Warehouse', icon: 'wood', max: 3, stage: 1, cost: { wood: 50, stone: 20 }, days: 45, storage: { all: 200 }, desc: '+200 storage for every good.' },
  town_hall: { name: 'Town Hall', icon: 'stability', max: 1, stage: 1, cost: { wood: 80, stone: 50, gold: 40 }, days: 90, stability: 3, admin: 1, desc: 'Required for Town. Aristocrats administer. +3 stability, +1 admin.' },
  trading_post: { name: 'Trading Post', icon: 'gold', max: 2, stage: 1, tech: 'currency', cost: { wood: 40, stone: 15, gold: 25 }, days: 50, trade: 0.12, tax: 0.03, desc: 'Warehouses and a caravanserai for foreign merchants: +12% trade, +3% taxes. Caravans stop here.' },
  market: { name: 'Market', icon: 'gold', max: 4, stage: 1, tech: 'currency', cost: { wood: 50, stone: 30, gold: 30 }, days: 60, tax: 0.15, trade: 0.15, desc: 'Merchants trade: +15% taxes, +15% trade. Each level is a market tier: Local Market → Market Hall → Trade Fair → Exchange (steadier prices, trade routes, companies, the world market). Required for City.' },
  bank: { name: 'Bank', icon: 'gold', max: 2, stage: 3, tech: 'banking', cost: { stone: 150, glass: 10, gold: 200 }, days: 150, tax: 0.15, trade: 0.2, desc: 'Merchants and capitalists: +15% taxes, +20% trade.' },
  temple: { name: 'Temple', icon: 'stability', max: 3, stage: 0, tech: 'mysticism', cost: { wood: 30, stone: 40, gold: 20 }, days: 70, stability: 4, convert: 1, desc: 'Clergy: +4 stability, converts people to the state faith.' },
  library: { name: 'Library', icon: 'knowledge', max: 4, stage: 1, tech: 'writing', cost: { wood: 40, stone: 40, gold: 40 }, days: 70, desc: 'Clergy scholars produce knowledge (more with paper).' },
  university: { name: 'University', icon: 'knowledge', max: 2, stage: 3, tech: 'scholasticism', cost: { stone: 150, glass: 10, paper: 20, gold: 120 }, days: 150, desc: 'Many scholars (more with paper).' },
  observatory: { name: 'Observatory', icon: 'knowledge', max: 1, stage: 2, tech: 'astronomy', cost: { stone: 150, glass: 30, gold: 120 }, days: 150, desc: 'Scholars study the heavens (more with glass).' },
  hospital: { name: 'Hospital', icon: 'pop', max: 2, stage: 2, tech: 'medicine', cost: { stone: 80, wood: 60, cloth: 20, gold: 80 }, days: 120, growth: 0.08, stability: 1, desc: '+8% growth, +1 stability. Eases plagues.' },
  aqueduct: { name: 'Aqueduct', icon: 'housing', max: 1, stage: 2, tech: 'engineering', cost: { stone: 160, wood: 40, gold: 60 }, days: 150, growth: 0.1, housing: 0.15, desc: '+10% growth, +15% housing.' },
  road: { name: 'Road', icon: 'stone', max: 1, stage: 1, tech: 'the_wheel', needs: 'neighbor', cost: { stone: 30, wood: 20, gold: 15 }, days: 60, growth: 0.05, tax: 0.1, desc: 'Paves a road to the nearest friendly settlement. +5% growth, +10% taxes.' },
  railway_station: { name: 'Railway Station', icon: 'stone', max: 1, stage: 2, tech: 'railways', cost: { steel: 60, stone: 100, gold: 150 }, days: 180, growth: 0.05, tax: 0.15, trade: 0.2, desc: '+5% growth, +15% taxes, +20% trade. Burns coal.' },
  // --- Military ---
  barracks: { name: 'Barracks', icon: 'iron', max: 3, stage: 1, tech: 'bronze_working', cost: { wood: 50, stone: 20, iron: 10 }, days: 50, stability: 1, defense: 10, desc: 'Soldiers garrison here; needed for advanced units. +10 defense.' },
  walls: { name: 'Walls', icon: 'stone', max: 3, stage: 2, tech: 'masonry', cost: { stone: 120, wood: 30, gold: 30 }, days: 120, defense: 25, desc: 'Fortifications. +25 defense per level.' },
  castle: { name: 'Castle', icon: 'defense', max: 1, stage: 2, tech: 'feudalism', cost: { stone: 220, wood: 60, gold: 80 }, days: 180, defense: 40, stability: 2, fort: 1.5, garrison: 4, desc: 'A stone keep. Fortification +1.5, garrison +4, +2 stability.' },
  star_fort: { name: 'Star Fort', icon: 'defense', max: 1, stage: 3, tech: 'gunpowder', cost: { stone: 400, iron: 60, gold: 200 }, days: 240, defense: 60, fort: 2.5, garrison: 6, desc: 'Angled bastions built to resist cannon. Fortification +2.5, garrison +6.' },
  // --- Industry (capitalists) ---
  textile_mill: { name: 'Textile Mill', icon: 'gold', max: 3, stage: 2, tech: 'textiles', cost: { wood: 120, stone: 60, tools: 30, gold: 80 }, days: 120, desc: 'Laborers mass-produce clothes from cloth.' },
  foundry: { name: 'Foundry', icon: 'iron', max: 3, stage: 2, tech: 'steam_power', cost: { stone: 150, tools: 40, iron: 60, gold: 120 }, days: 150, desc: 'Laborers smelt iron and coal into steel.' },
  factory: { name: 'Factory', icon: 'gold', max: 3, stage: 3, tech: 'industrialization', cost: { steel: 50, tools: 40, stone: 150, gold: 200 }, days: 180, desc: 'Laborers make tools, furniture and weapons from steel and wood.' },
};
export const BUILDING_LIST = Object.keys(BUILDINGS);

export function maxLevel(def, stage) {
  return def.max === 1 ? 1 : Math.min(def.max, stage + 1);
}
