// Phase 11 — pixel-art interface skin. Frames, buttons and the cursor are drawn as tiny
// pixel images at startup and used as CSS border-images (scaled up with crisp pixels).
import { makeCanvas } from '../render/sprites.js';

// A 12×12 nine-slice frame: rows of palette letters, 4 px corners.
function frame(rows, pal) {
  const c = makeCanvas(12, 12);
  const ctx = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x, y, 1, 1); } }));
  return c.toDataURL();
}
// k = outline, o = outer rim, l = light bevel, d = dark bevel, f = fill, g = gold rule
const PANEL = [
  '.kkkkkkkkkk.',
  'kggggggggggk',
  'kgllllllllgk',
  'kgldddddddgk',
  'kgldffffffgk',
  'kgldffffffgk',
  'kgldffffffgk',
  'kgldffffffgk',
  'kgldffffffgk',
  'kgdddddddddk',
  'kggggggggggk',
  '.kkkkkkkkkk.',
];
const RAISED = [
  '.kkkkkkkkkk.',
  'kllllllllldk',
  'klfffffffddk',
  'klffffffffdk',
  'klffffffffdk',
  'klffffffffdk',
  'klffffffffdk',
  'klffffffffdk',
  'klffffffffdk',
  'kdddddddddsk',
  'kssssssssssk',
  '.kkkkkkkkkk.',
];
const PRESSED = [
  '.kkkkkkkkkk.',
  'kssssssssssk',
  'ksddddddddlk',
  'ksdffffffflk',
  'ksdffffffflk',
  'ksdffffffflk',
  'ksdffffffflk',
  'ksdffffffflk',
  'ksdffffffflk',
  'ksdffffffflk',
  'kslllllllllk',
  '.kkkkkkkkkk.',
];
const INSET = [
  'kkkkkkkkkkkk',
  'kddddddddddk',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kdffffffffok',
  'kooooooooook',
  'kkkkkkkkkkkk',
];

const CURSOR = [
  'k...............',
  'kk..............',
  'kwk.............',
  'kwwk............',
  'kwwgk...........',
  'kwwggk..........',
  'kwwgggk.........',
  'kwwggggk........',
  'kwwgggggk.......',
  'kwwggggggk......',
  'kwwgggkkkkk.....',
  'kwgkgggk........',
  'kgk.kgggk.......',
  'kk..kgggk.......',
  'k....kggk.......',
  '......kk........',
];

function cursorUrl(scale = 2) {
  const c = makeCanvas(16 * scale, 16 * scale);
  const ctx = c.getContext('2d');
  const pal = { k: '#1a1008', w: '#fff4d0', g: '#e6c068' };
  CURSOR.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x * scale, y * scale, scale, scale); } }));
  return c.toDataURL();
}

// Wooden frame with brass rivets in the corners
const WOOD = PANEL.map((r, y) => (y === 1 || y === 10 ? r.slice(0, 1) + 'r' + r.slice(2, 10) + 'r' + r.slice(11) : r));

export function applyPixelSkin() {
  const root = document.documentElement.style;
  const set = (k, url) => root.setProperty(k, `url("${url}")`);
  set('--px-panel', frame(WOOD, { k: '#140a04', g: '#7a4e2a', l: '#a06a3a', d: '#3a2412', f: '#271a10', r: '#e6c068' }));
  set('--px-modal', frame(WOOD, { k: '#140a04', g: '#8a5a30', l: '#b07a44', d: '#3a2412', f: '#271a10', r: '#ffe08a' }));
  set('--px-parch', frame(PANEL, { k: '#3a2410', g: '#9a7a4a', l: '#fff4d6', d: '#c8aa78', f: '#ecdcb4' }));
  set('--px-btn', frame(RAISED, { k: '#120c07', l: '#9a7a48', f: '#5a4426', d: '#3a2a16', s: '#22180c' }));
  set('--px-btn-hover', frame(RAISED, { k: '#120c07', l: '#c8a060', f: '#6e5430', d: '#4a361c', s: '#2a1e10' }));
  set('--px-btn-down', frame(PRESSED, { k: '#120c07', l: '#7a6040', f: '#4a371f', d: '#2a1e10', s: '#1a1208' }));
  set('--px-btn-gold', frame(RAISED, { k: '#2a1806', l: '#ffe7a6', f: '#d9a948', d: '#a8782a', s: '#6a4810' }));
  set('--px-inset', frame(INSET, { k: '#0c0806', d: '#060403', f: '#16100b', o: '#3a2e20' }));
  set('--px-god', frame(PANEL, { k: '#0c0806', g: '#a88ad8', l: '#5a4880', d: '#1a1226', f: '#261a33' }));
  set('--px-tip', frame(PANEL, { k: '#3a2410', g: '#9a7a4a', l: '#fff4d6', d: '#c8aa78', f: '#ecdcb4' }));
  set('--px-btn-wood', frame(RAISED, { k: '#140a04', l: '#c08a52', f: '#8a5a32', d: '#5a3a1e', s: '#2e1c0e' }));
  root.setProperty('--px-cursor', `url("${cursorUrl()}") 0 0, auto`);
  document.body.classList.add('pixel-ui');
}
