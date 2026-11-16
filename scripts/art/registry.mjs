// Every id that scripts/art/build.mjs can generate, mapped to its generator.
import { townsfolk } from './townsfolk.mjs';

const RACES = ['humans', 'elves', 'dwarves', 'orcs', 'lizardfolk', 'halflings'];
export const GENERATORS = {};
for (const r of RACES) GENERATORS['townsfolk_' + r] = () => townsfolk(r);
import { animalSheet } from './animals.mjs';
for (const k of ['sheep', 'cow', 'pig', 'goat', 'horse', 'chicken', 'dog']) GENERATORS['livestock_' + k] = () => animalSheet(k, { livestock: true });
for (const k of ['deer', 'boar', 'goat', 'wolf', 'bear']) GENERATORS['wildlife_' + k] = () => animalSheet(k === 'goat' ? 'wgoat' : k, { livestock: false });
import { houseSheet } from './houses.mjs';
for (const r of RACES) GENERATORS['house_' + r] = () => houseSheet(r);
import { SMALL, BIG, smallSheet, bigSheet, campfireSheet, windmillSheet } from './specials.mjs';
for (const k of Object.keys(SMALL)) GENERATORS['building_' + k] = () => smallSheet(k);
for (const k of Object.keys(BIG)) GENERATORS['building_' + k] = () => bigSheet(k);
GENERATORS.campfire = campfireSheet;
GENERATORS.windmill = windmillSheet;
import { treehouseSheet, hillhomeSheet, tentSheet, stiltSheet, townhouseSheet } from './homes.mjs';
GENERATORS.home_treehouse = treehouseSheet;
GENERATORS.home_hillhome = hillhomeSheet;
GENERATORS.home_tent = tentSheet;
GENERATORS.home_stilt = stiltSheet;
for (const r of RACES) GENERATORS['townhouse_' + r] = () => townhouseSheet(r);
import { NATURE } from './nature.mjs';
for (const [id, fn] of Object.entries(NATURE)) GENERATORS[id] = () => ({ ...fn(), layer: id.replace(/^(tree|nature)_/, '') });
import { BIOME_TILES, groundSheet } from './ground.mjs';
for (const b of BIOME_TILES) GENERATORS['tile_' + b] = () => groundSheet(b);
import { TOWN } from './town.mjs';
for (const [id, fn] of Object.entries(TOWN)) GENERATORS[id] = () => ({ layer: id, ...fn() });
