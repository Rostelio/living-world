export const B = {
  DEEP: 0, OCEAN: 1, SHALLOW: 2, BEACH: 3, GRASS: 4, PLAINS: 5, FOREST: 6, JUNGLE: 7,
  TAIGA: 8, DESERT: 9, TUNDRA: 10, SNOW: 11, HILLS: 12, MOUNTAIN: 13, SWAMP: 14, LAKE: 15,
};

// yields: per-tile economic potential used to rate provinces (0..1 scale-ish)
export const BIOMES = [];
function def(id, name, color, o = {}) {
  BIOMES[id] = {
    id, name, color,
    water: !!o.water,
    cost: o.cost ?? 1,
    yields: Object.assign({ food: 0, wood: 0, stone: 0, iron: 0, gold: 0 }, o.yields || {}),
  };
}
def(B.DEEP, 'Deep Ocean', [22, 62, 132], { water: true, cost: 99 });
def(B.OCEAN, 'Ocean', [34, 96, 176], { water: true, cost: 99 });
def(B.SHALLOW, 'Shallows', [56, 146, 208], { water: true, cost: 99 });
def(B.LAKE, 'Lake', [62, 146, 210], { water: true, cost: 99 });
def(B.BEACH, 'Beach', [240, 220, 146], { cost: 1, yields: { food: 0.3, gold: 0.05 } });
def(B.GRASS, 'Grassland', [96, 186, 72], { cost: 1, yields: { food: 1.0, wood: 0.15 } });
def(B.PLAINS, 'Plains', [178, 196, 78], { cost: 1, yields: { food: 0.75, gold: 0.05 } });
def(B.FOREST, 'Forest', [44, 136, 58], { cost: 1.6, yields: { food: 0.35, wood: 1.0 } });
def(B.JUNGLE, 'Jungle', [30, 124, 52], { cost: 2.2, yields: { food: 0.45, wood: 0.9, gold: 0.05 } });
def(B.TAIGA, 'Taiga', [50, 108, 82], { cost: 1.6, yields: { food: 0.2, wood: 0.85 } });
def(B.DESERT, 'Desert', [234, 200, 116], { cost: 1.5, yields: { food: 0.03, stone: 0.3, gold: 0.12 } });
def(B.TUNDRA, 'Tundra', [148, 166, 136], { cost: 1.4, yields: { food: 0.15, stone: 0.1 } });
def(B.SNOW, 'Snowfield', [238, 244, 250], { cost: 2.5, yields: {} });
def(B.HILLS, 'Hills', [138, 158, 78], { cost: 2, yields: { food: 0.3, stone: 0.9, iron: 0.35, gold: 0.04 } });
def(B.MOUNTAIN, 'Mountains', [132, 122, 114], { cost: 5, yields: { stone: 1, iron: 0.7, gold: 0.12 } });
def(B.SWAMP, 'Swamp', [70, 112, 78], { cost: 2.5, yields: { food: 0.3, wood: 0.4 } });

export const R = { NONE: 0, IRON: 1, GOLD: 2, STONE: 3, FERTILE: 4, FISH: 5, GAME: 6, HORSES: 7, COAL: 8, SPICES: 9, GEMS: 10, WINE: 11, SALT: 12, MARBLE: 13 };
export const RESOURCES = [
  null,
  { id: 1, key: 'iron', name: 'Iron Ore', sector: 'iron', bonus: 1.6, color: '#9aa4b0' },
  { id: 2, key: 'gold', name: 'Gold Vein', sector: 'gold', bonus: 1.5, color: '#f2c94c' },
  { id: 3, key: 'stone', name: 'Quarry Stone', sector: 'stone', bonus: 0.9, color: '#c8c2b8' },
  { id: 4, key: 'fertile', name: 'Fertile Soil', sector: 'food', bonus: 0.6, color: '#7fd16b' },
  { id: 5, key: 'fish', name: 'Fishing Grounds', sector: 'food', bonus: 0.5, color: '#6fc3e8' },
  { id: 6, key: 'game', name: 'Game', sector: 'food', bonus: 0.35, color: '#c48a52' },
  { id: 7, key: 'horses', name: 'Wild Horses', sector: 'gold', bonus: 0.35, color: '#e0b48a' },
  // Phase 14 — regional specialties (rarer, richer deposits)
  { id: 8, key: 'coal', name: 'Coal Seam', sector: 'iron', bonus: 0.8, color: '#4a4a52' },
  { id: 9, key: 'spices', name: 'Spice Groves', sector: 'gold', bonus: 0.9, color: '#e07a3a' },
  { id: 10, key: 'gems', name: 'Gem Deposits', sector: 'gold', bonus: 1.6, color: '#c070e0' },
  { id: 11, key: 'wine', name: 'Vineyard Slopes', sector: 'food', bonus: 0.5, color: '#8a2a5a' },
  { id: 12, key: 'salt', name: 'Salt Flats', sector: 'food', bonus: 0.45, color: '#e8e8f0' },
  { id: 13, key: 'marble', name: 'Marble', sector: 'stone', bonus: 1.3, color: '#f2ece0' },
];

export const isWater = (b) => BIOMES[b].water;
