// Per-sprite settings for the Aseprite sprites (src/sprites.js), and the list of sprite ids the
// game knows about (see assets/ASSETS.md). Ids not listed here can still be loaded through
// assets/sprites/index.json.
//
// anchor: 'bottom' — bottom-centre, the feet (characters, animals, buildings, effects)
//         'top-left' — the tile corner (ground tiles, roads, walls, fences)
// ox, oy: extra offset of the anchor in art pixels (positive = the anchor moves right / down
//         inside the picture, so the picture moves left / up on screen)
// scale:  art pixels per drawn pixel when the picture was drawn bigger than its slot (keep 1)

// Art density: Aseprite sprites have 4 art pixels per world pixel (a map tile is 32×32), twice
// the old code-drawn art (16×16 per tile). A sprite that replaces a code-drawn picture is
// therefore exactly twice its size.
export const ART_PER_WORLD = 4;
export const ART_SCALE = 2; // Aseprite pixels per code-drawn pixel

const RACES = ['humans', 'elves', 'dwarves', 'orcs', 'lizardfolk', 'halflings'];
const each = (prefix, list) => list.map((k) => `${prefix}_${k}`);

export const SPRITE_IDS = [
  // characters
  ...each('townsfolk', RACES), ...each('person', RACES), 'soldier_infantry', 'soldier_archer', 'cavalry', 'siege_engine', 'explorer',
  'caravan', 'cart', 'fishing_boat', 'ship_war', 'ship_transport',
  ...each('livestock', ['sheep', 'cow', 'pig', 'goat', 'horse', 'chicken', 'dog']), ...each('beast', ['sheep', 'cow', 'horse', 'warhorse']),
  'scene_walker', 'scene_soldier', 'scene_rider', ...each('portrait', RACES), 'advisor_portrait',
  // enemies
  ...each('creature', ['dragon', 'wyvern', 'giant', 'troll']), 'lair', ...each('wildlife', ['deer', 'boar', 'goat', 'wolf', 'bear']), 'sea_whale', 'sea_serpent',
  // tiles and backgrounds
  ...each('tile', ['grass', 'plains', 'forest', 'jungle', 'taiga', 'desert', 'tundra', 'snow', 'hills', 'mountain', 'swamp', 'beach', 'deep', 'ocean', 'shallow', 'lake']),
  'shore_autotile', 'river_autotile', 'scar_burn', 'scar_crater', 'scar_flood',
  ...each('tree', ['oak', 'birch', 'pine', 'palm', 'jungle', 'dead']),
  ...each('nature', ['bush', 'rock', 'mound', 'peak', 'peak_snow', 'tuft', 'pebbles', 'mushroom', 'lily', 'reeds', 'cactus', 'flowers']),
  'road_dirt', 'road_stone', 'road_paved', 'bridge', 'yard', 'plaza_plain', 'plaza_well', 'plaza_fountain', 'wall_stone', 'wall_palisade', 'wall_tower', 'wall_gate', 'fence', 'field',
  ...each('prop', ['barrel', 'crate', 'woodpile', 'flowers', 'lamp', 'bush', 'sack', 'anvil', 'rack', 'scarecrow']),
  ...each('house', RACES), ...each('townhouse', RACES), ...each('home', ['treehouse', 'hillhome', 'tent', 'stilt']), 'boardwalk', 'rope_bridge',
  ...each('building', ['town_hall', 'temple', 'market', 'library', 'granary', 'warehouse', 'barracks', 'brewery', 'lumber_camp', 'mine', 'quarry', 'port',
    'walls_tower', 'bank', 'hospital', 'observatory', 'aqueduct', 'textile_mill', 'foundry', 'power_plant', 'newspaper',
    'castle', 'star_fort', 'university', 'railway_station', 'factory']),
  'campfire', 'windmill', ...each('great_work', ['cathedral', 'university', 'palace', 'canal', 'harbour_works', 'boulevards', 'world_fair']),
  'shrine', 'camp_tent', ...each('house_old', RACES),
  'atlas_glyph_mountain', 'atlas_glyph_tree', 'atlas_glyph_ship', 'atlas_paper', 'scene_sky', 'scene_hills_far', 'scene_hills_mid', 'scene_hills_near',
  'scene_house', 'scene_tent', 'scene_special', 'scene_windmill', 'scene_tree', 'title_backdrop',
  // UI and icons
  ...each('icon', ['food', 'wood', 'stone', 'iron', 'gold', 'knowledge', 'pop', 'stability', 'defense', 'housing']),
  'ui_frames', 'ui_wood', 'ui_wood_dark', 'ui_paper', 'flag_parts', 'ribbon', 'ui_frame_wood', 'ui_frame_paper', 'ui_frame_pixel', 'cursor', 'compass', 'army_badge', 'siege_ring', 'god_cursor',
  ...each('vignette', ['alliance', 'city', 'crown', 'death', 'era', 'faith', 'hero', 'plague', 'revolt', 'ship', 'war']),
  // effects
  'fx_chimney_smoke', 'fx_torch', 'fx_washing_line', 'fx_scaffolding', 'fx_flame',
  ...each('fx', ['smoke', 'dust', 'fire', 'spark', 'debris', 'mote', 'flake', 'ember']), 'fx_ring', 'fx_meteor', 'fx_bolt',
  ...each('fx_disaster', ['fire', 'flood', 'drought', 'eruption', 'plague', 'quake', 'blizzard', 'curse', 'bless']),
  'fx_water_sparkle', 'fx_water_foam', 'fx_water_fish', 'fx_mist', 'fx_star', 'fx_firefly', 'fx_rain', 'fx_snow', 'fx_cloud', 'fx_fog_bank', 'fx_arrow',
  'fx_battle_clash', 'fx_sea_clash',
];

// Ids starting with these are laid on the tile grid: anchored at the top-left corner
const TILE_PREFIXES = ['tile_', 'shore_', 'river_', 'road_', 'yard', 'plaza_', 'wall', 'fence', 'field', 'bridge', 'boardwalk', 'scar_', 'atlas_paper', 'scene_sky', 'scene_hills', 'ui_frame', 'title_'];

// Per-sprite overrides. Example: a character whose feet stand 2 px above the bottom of its canvas:
//   townsfolk_humans: { oy: -2 },
export const SPRITE_CONFIG = {
};

const CACHE = new Map();
export function configFor(id) {
  let c = CACHE.get(id);
  if (c) return c;
  const anchor = TILE_PREFIXES.some((p) => id.startsWith(p)) ? 'top-left' : 'bottom';
  c = { anchor, ox: 0, oy: 0, scale: 1, ...(SPRITE_CONFIG[id] || {}) };
  CACHE.set(id, c);
  return c;
}
