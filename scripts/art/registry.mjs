// Every id that scripts/art/build.mjs can generate, mapped to its generator.
import { townsfolk } from './townsfolk.mjs';

const RACES = ['humans', 'elves', 'dwarves', 'orcs', 'lizardfolk', 'halflings'];
export const GENERATORS = {};
for (const r of RACES) GENERATORS['townsfolk_' + r] = () => townsfolk(r);
import { animalSheet } from './animals.mjs';
for (const k of ['sheep', 'cow', 'pig', 'goat', 'horse', 'chicken', 'dog']) GENERATORS['livestock_' + k] = () => animalSheet(k, { livestock: true });
for (const k of ['deer', 'boar', 'goat', 'wolf', 'bear']) GENERATORS['wildlife_' + k] = () => animalSheet(k === 'goat' ? 'wgoat' : k, { livestock: false });
