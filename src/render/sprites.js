import { RACES } from '../data/races.js';
import { frameCanvas, tagFrame, tintKey, SPRITES } from '../sprites.js';
import { hexToRgb, rgbToHex, shade } from '../core/util.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawPixels(ctx, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

// ---------- UI icons (8x8) ----------
const ICONS = {
  food: { rows: ['..y..y..', '.yYy.yY.', '..yy.y..', '.yYyyY..', '..yYy...', '...g....', '...g....', '..g.g...'], pal: { y: '#f2c94c', Y: '#c9962a', g: '#6fb04a' } },
  wood: { rows: ['........', '.bbbbbl.', 'bBBBBBlL', '.bbbbbl.', '.bbbbbl.', 'bBBBBBlL', '.bbbbbl.', '........'], pal: { b: '#9c6b3e', B: '#6e4626', l: '#e0b77a', L: '#b98a52' } },
  stone: { rows: ['........', '...ss...', '..sSSs..', '.sSSssd.', '.ssSsdd.', 'sSSssdds', 'ssssdddd', '........'], pal: { s: '#a9a49b', S: '#d4d0c8', d: '#77726b' } },
  iron: { rows: ['........', '........', '..iiiii.', '.iIIIIi.', 'iIIIIiid', 'iiiiiddd', '........', '........'], pal: { i: '#8f9aa6', I: '#c9d3dc', d: '#5c6670' } },
  gold: { rows: ['..yyyy..', '.yYYYYy.', 'yYyyyyYo', 'yYyYYyYo', 'yYyYYyYo', 'yYyyyyYo', '.oYYYYo.', '..oooo..'], pal: { y: '#f2c94c', Y: '#fff1a8', o: '#b8860b' } },
  knowledge: { rows: ['........', '.pppppp.', '.pwwwwpd', '.pwkkwpd', '.pwwwwpd', '.pwkkwpd', '.ppppppd', '..ddddd.'], pal: { p: '#5a7bd8', w: '#f4efe0', k: '#7a7468', d: '#2f3f7a' } },
  pop: { rows: ['...ss...', '..ssss..', '...ss...', '..cccc..', '.cccccc.', '..cccc..', '..c..c..', '..c..c..'], pal: { s: '#e2b48c', c: '#5d9cec' } },
  stability: { rows: ['........', 'y..y..y.', 'yy.yy.yy', 'yyyyyyyy', 'yrYyyrYy', 'yyyyyyyy', 'oooooooo', '........'], pal: { y: '#f2c94c', Y: '#fff1a8', r: '#d94a3d', o: '#b8860b' } },
  defense: { rows: ['.ssssss.', 'sSSSSSSs', 'sSrrrrSs', 'sSrSSrSs', 'sSrrrrSs', '.sSSSSs.', '..sSSs..', '...ss...'], pal: { s: '#6c7a89', S: '#aab7c4', r: '#d94a3d' } },
  housing: { rows: ['...rr...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wwddww.', '.wwddww.', '.wwddww.'], pal: { r: '#b4513a', w: '#e6d3a8', d: '#6e4626' } },
};
const iconCache = {};
export function iconCanvas(name, scale = 2) {
  const key = name + scale;
  if (iconCache[key]) return iconCache[key];
  const ic = ICONS[name] || ICONS.food;
  const c = makeCanvas(8 * scale, 8 * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const art = frameCanvas('icon_' + name, 0, [16, 16]); // Aseprite icons are 16×16 (twice the 8×8 code ones) // Aseprite sprite if there is one
  if (art) { ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 0, 0, 8, 8); } else drawPixels(ctx, ic.rows, ic.pal);
  iconCache[key] = c;
  return c;
}
const iconUrlCache = {};
export function iconUrl(name) {
  if (!iconUrlCache[name]) iconUrlCache[name] = iconCanvas(name, 4).toDataURL();
  return iconUrlCache[name];
}
export function iconImg(name, cls = 'ico') {
  return `<img class="${cls}" src="${iconUrl(name)}" alt="${name}">`;
}

// ---------- Flags ----------
const EMBLEMS = [
  ['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'], // diamond
  ['..x..', '..x..', 'xxxxx', '..x..', '..x..'], // cross
  ['.xxx.', 'xxxxx', 'xxxxx', 'xxxxx', '.xxx.'], // disc
  ['x.x.x', 'xxxxx', 'xxxxx', '.xxx.', '.....'], // crown
  ['..x..', '.xxx.', 'xxxxx', '..x..', '.xxx.'], // tree
  ['.xx..', 'x....', 'x....', 'x....', '.xx..'], // moon
  ['xxxxx', 'x.x.x', 'xxxxx', '.x.x.', '.....'], // skull-ish
  ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'], // saltire
];
export function drawFlag(ctx, flag, x, y, w = 15, h = 10) {
  const { pattern, c1, c2, c3, emblem } = flag;
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  switch (pattern) {
    case 1: ctx.fillRect(x, y + (h >> 1), w, h - (h >> 1)); break;
    case 2: ctx.fillRect(x + (w >> 1), y, w - (w >> 1), h); break;
    case 3: ctx.fillRect(x + Math.round(w / 3), y, Math.round(w / 3), h); break;
    case 4: ctx.fillRect(x, y + Math.round(h / 3), w, Math.round(h / 3)); break;
    case 5: ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); break;
    case 6: for (let i = 0; i < w; i++) ctx.fillRect(x + i, y + Math.floor((i / w) * h), 1, h - Math.floor((i / w) * h)); break;
    default: break;
  }
  const e = EMBLEMS[emblem % EMBLEMS.length];
  ctx.fillStyle = c3 === c1 || c3 === c2 ? '#f5f0e1' : c3;
  const ex = x + Math.floor((w - 5) / 2), ey = y + Math.floor((h - 5) / 2);
  drawPixels(ctx, e, { x: ctx.fillStyle }, ex, ey);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y + h - 1, w, 1);
}
const flagUrlCache = new Map();
export function flagUrl(civ) {
  const key = JSON.stringify(civ.flag);
  if (flagUrlCache.has(key)) return flagUrlCache.get(key);
  const c = makeCanvas(15, 10);
  drawFlag(c.getContext('2d'), civ.flag, 0, 0);
  const url = c.toDataURL();
  flagUrlCache.set(key, url);
  return url;
}
export function flagImg(civ, cls = 'flag') {
  return `<img class="${cls}" src="${flagUrl(civ)}" alt="flag">`;
}

// ---------- Settlement sprites ----------
// Houses are drawn procedurally per race style and tier, cached as small canvases.
const spriteCache = new Map();

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawHouse(ctx, race, tier) {
  const R = RACES[race];
  const roof = hexToRgb(R.roof), wall = hexToRgb(R.wall);
  const rf = rgbToHex(roof), rfD = rgbToHex(shade(roof, -0.3)), rfL = rgbToHex(shade(roof, 0.2));
  const wl = rgbToHex(wall), wlD = rgbToHex(shade(wall, -0.25));
  const door = '#3b2a1a', win = tier >= 2 ? '#f6d776' : '#3b2a1a';
  const out = '#1b140e';
  if (race === 'halflings') {
    // Hill burrow: turf mound with a round door
    const turf = tier >= 2 ? '#5c9a44' : '#4f8a3a', turfD = '#3a6a2c', turfL = '#7cbb5a';
    const rows = [[2, 4], [1, 6], [0, 8], [0, 8], [0, 8]];
    rows.forEach(([x0, w], i) => { px(ctx, x0, 3 + i, w, 1, turf); });
    px(ctx, 2, 3, 4, 1, turfL); px(ctx, 6, 5, 2, 3, turfD);
    px(ctx, 3, 5, 2, 3, tier >= 1 ? '#e8b84a' : '#a0783a'); px(ctx, 3, 5, 2, 1, '#c99a3a');
    px(ctx, 4, 6, 1, 1, '#5a3a1a');
    if (tier >= 1) px(ctx, 6, 5, 1, 1, '#f6d776');
    if (tier >= 2) { px(ctx, 1, 6, 1, 1, '#f6d776'); px(ctx, 6, 1, 1, 2, '#8a8478'); }
    if (tier >= 3) { px(ctx, 0, 2, 2, 1, '#d94a3d'); px(ctx, 2, 2, 1, 1, '#f2c94c'); }
    return;
  }
  if (race === 'lizardfolk') {
    if (tier === 0) {
      // Reed dome
      const reed = '#8a8a4a', reedD = '#5e6a32';
      [[3, 2], [2, 4], [1, 6], [1, 6], [0, 8]].forEach(([x0, w], i) => px(ctx, x0, 3 + i, w, 1, i % 2 ? reedD : reed));
      px(ctx, 3, 6, 2, 2, out);
      return;
    }
    // Stilt hut with thatched roof
    px(ctx, 1, 6, 1, 2, '#5e4528'); px(ctx, 6, 6, 1, 2, '#5e4528');
    px(ctx, 0, 5, 8, 1, '#7a5a3a');
    px(ctx, 1, 3, 6, 2, wl); px(ctx, 6, 3, 1, 2, wlD);
    for (let y = 0; y < 3; y++) px(ctx, 3 - y, y, 2 + 2 * y, 1, y === 2 ? rfD : rf);
    px(ctx, 3, 3, 2, 2, door);
    if (tier >= 2) { px(ctx, 1, 3, 1, 1, '#f6d776'); px(ctx, 3, 0, 2, 1, '#c9a227'); }
    if (tier >= 3) px(ctx, 0, 2, 8, 1, rfL);
    return;
  }
  if (race === 'orcs' && tier <= 1 || race === 'humans' && tier === 0) {
    // Tent / hide hut
    const hide = race === 'orcs' ? '#8a6a44' : '#c9b28a', hideD = race === 'orcs' ? '#5e4528' : '#977f5c';
    for (let y = 0; y < 6; y++) {
      const half = Math.floor(y * 0.6) + 1;
      px(ctx, 4 - half, 1 + y, half, 1, hide);
      px(ctx, 4, 1 + y, half, 1, hideD);
    }
    px(ctx, 4, 0, 1, 2, race === 'orcs' ? '#e8e0c8' : '#6e4626');
    px(ctx, 3, 5, 2, 2, door);
    if (race === 'orcs') { px(ctx, 1, 6, 1, 1, '#e8e0c8'); px(ctx, 7, 6, 1, 1, '#e8e0c8'); }
    return;
  }
  if (race === 'elves') {
    const w = tier >= 2 ? 7 : 6;
    px(ctx, 1, 4, w - 1, 3, wl); px(ctx, w - 1, 4, 1, 3, wlD);
    // rounded leaf roof
    px(ctx, 2, 1, w - 3, 1, rfL); px(ctx, 1, 2, w - 1, 2, rf); px(ctx, 0, 3, w + 1, 1, rfD);
    px(ctx, 3, 5, 1, 2, door);
    if (tier >= 2) { px(ctx, 5, 5, 1, 1, win); px(ctx, 3, 0, 2, 1, rfL); }
    if (tier >= 3) px(ctx, 4, 0, 1, 1, '#f6f1d8');
    return;
  }
  if (race === 'dwarves') {
    const st = '#8a8478', stD = '#5e594f', stL = '#b3ad9f';
    const h = tier >= 2 ? 6 : 5;
    px(ctx, 0, 8 - h, 8, h, st); px(ctx, 6, 8 - h, 2, h, stD); px(ctx, 0, 8 - h, 8, 1, stL);
    // crenellations
    px(ctx, 0, 7 - h, 1, 1, stL); px(ctx, 3, 7 - h, 1, 1, stL); px(ctx, 6, 7 - h, 1, 1, stL);
    px(ctx, 3, 5, 2, 3, out);
    px(ctx, 3, 4, 2, 1, '#e0a84a');
    if (tier >= 2) { px(ctx, 1, 8 - h + 2, 1, 1, win); px(ctx, 6, 8 - h + 2, 1, 1, win); }
    if (tier >= 3) px(ctx, 1, 8 - h - 2, 1, 2, rf);
    return;
  }
  // Peaked roof house (humans, orc longhouses)
  const tall = tier >= 3 ? 1 : 0;
  const wallTop = 4 - tall;
  const wallC = tier >= 3 && race === 'humans' ? '#b8b0a2' : wl;
  const wallCD = tier >= 3 && race === 'humans' ? '#8c8578' : wlD;
  px(ctx, 1, wallTop, 6, 8 - wallTop, wallC);
  px(ctx, 6, wallTop, 1, 8 - wallTop, wallCD);
  for (let y = 0; y < 4; y++) {
    px(ctx, 3 - y, wallTop - 3 + y, 1, 1, rfL);
    px(ctx, 4 - y, wallTop - 3 + y, 1 + 2 * y, 1, rf);
    px(ctx, 4 + y, wallTop - 3 + y, 1, 1, rfD);
  }
  px(ctx, 0, wallTop, 8, 1, rfD);
  px(ctx, 3, 6, 2, 2, door);
  if (tier >= 1) px(ctx, 5, wallTop + 1 + tall, 1, 1, win);
  if (tier >= 2) px(ctx, 2, wallTop + 1 + tall, 1, 1, win);
  if (race === 'orcs') { px(ctx, 0, wallTop - 1, 1, 1, '#e8e0c8'); px(ctx, 7, wallTop - 1, 1, 1, '#e8e0c8'); px(ctx, 4, wallTop - 4, 1, 1, '#c0392b'); }
  if (tier >= 2 && race === 'humans') px(ctx, 5, wallTop - 4, 1, 2, '#6b5a4a'); // chimney
}

function drawSpecial(ctx, kind, race, civColor) {
  const R = RACES[race];
  const roof = R.roof, wall = R.wall;
  switch (kind) {
    case 'town_hall':
      px(ctx, 1, 6, 14, 9, wall); px(ctx, 12, 6, 3, 9, '#00000033');
      for (let y = 0; y < 5; y++) px(ctx, 6 - y, 1 + y, 4 + 2 * y, 1, roof);
      px(ctx, 0, 6, 16, 1, '#2a1d12');
      px(ctx, 7, 11, 2, 4, '#3b2a1a');
      px(ctx, 3, 8, 2, 2, '#f6d776'); px(ctx, 11, 8, 2, 2, '#f6d776');
      px(ctx, 8, 0, 1, 3, '#2a1d12'); px(ctx, 9, 0, 3, 2, civColor);
      break;
    case 'temple':
      px(ctx, 1, 4, 6, 4, '#e8e2d2'); px(ctx, 1, 3, 6, 1, '#c8c0aa');
      px(ctx, 2, 1, 4, 2, race === 'orcs' ? '#7a2a1f' : '#d4af37'); px(ctx, 3, 0, 2, 1, race === 'orcs' ? '#7a2a1f' : '#f2d27a');
      px(ctx, 3, 5, 2, 3, '#3b2a1a');
      break;
    case 'market':
      px(ctx, 0, 3, 4, 1, '#d94a3d'); px(ctx, 0, 2, 4, 1, '#f5f0e1');
      px(ctx, 4, 3, 4, 1, '#3d7fd9'); px(ctx, 4, 2, 4, 1, '#f5f0e1');
      px(ctx, 0, 4, 1, 4, '#6e4626'); px(ctx, 3, 4, 1, 4, '#6e4626'); px(ctx, 7, 4, 1, 4, '#6e4626');
      px(ctx, 1, 6, 2, 1, '#f2c94c'); px(ctx, 5, 6, 2, 1, '#7fd16b');
      break;
    case 'library':
      px(ctx, 1, 3, 6, 5, '#d9d2bf'); px(ctx, 0, 2, 8, 1, '#3f5ea8'); px(ctx, 1, 1, 6, 1, '#5a7bd8');
      px(ctx, 2, 4, 1, 3, '#a39a8c'); px(ctx, 5, 4, 1, 3, '#a39a8c'); px(ctx, 3, 5, 2, 3, '#3b2a1a');
      break;
    case 'university':
      px(ctx, 1, 4, 14, 4, '#e2dccb'); px(ctx, 5, 1, 6, 3, '#5a7bd8'); px(ctx, 6, 0, 4, 1, '#8fa8ef');
      for (let i = 2; i < 14; i += 3) px(ctx, i, 5, 1, 3, '#a39a8c');
      break;
    case 'granary':
      px(ctx, 2, 3, 4, 5, '#c9a46a'); px(ctx, 5, 3, 1, 5, '#9c7b48'); px(ctx, 1, 2, 6, 1, roof); px(ctx, 2, 1, 4, 1, roof); px(ctx, 3, 0, 2, 1, roof);
      break;
    case 'warehouse':
      px(ctx, 0, 3, 8, 5, '#8a6a44'); px(ctx, 0, 2, 8, 1, '#5e4528'); px(ctx, 3, 5, 2, 3, '#3b2a1a'); px(ctx, 0, 3, 8, 1, '#a88456');
      break;
    case 'barracks':
      px(ctx, 0, 3, 8, 5, '#7b5b3a'); px(ctx, 0, 2, 8, 1, '#4a3420');
      px(ctx, 1, 4, 2, 2, civColor); px(ctx, 5, 4, 2, 2, civColor); px(ctx, 3, 5, 2, 3, '#2a1d12');
      break;
    case 'brewery':
      px(ctx, 1, 3, 6, 5, '#9c6b3e'); px(ctx, 1, 2, 6, 1, roof);
      px(ctx, 2, 5, 2, 2, '#6e4626'); px(ctx, 5, 5, 2, 2, '#6e4626'); px(ctx, 2, 6, 2, 0.5, '#c9962a');
      break;
    case 'lumber_camp':
      px(ctx, 0, 5, 6, 1, '#9c6b3e'); px(ctx, 1, 6, 6, 1, '#7a5230'); px(ctx, 0, 7, 6, 1, '#9c6b3e');
      px(ctx, 5, 5, 1, 1, '#e0b77a'); px(ctx, 6, 6, 1, 1, '#e0b77a'); px(ctx, 6, 3, 2, 2, '#6e4626'); px(ctx, 6, 2, 2, 1, '#e0b77a');
      break;
    case 'mine':
      px(ctx, 0, 2, 8, 6, '#6f665c'); px(ctx, 1, 1, 6, 1, '#8a8176'); px(ctx, 2, 4, 4, 4, '#1b140e');
      px(ctx, 2, 3, 4, 1, '#7a5230'); px(ctx, 1, 4, 1, 4, '#7a5230'); px(ctx, 6, 4, 1, 4, '#7a5230');
      break;
    case 'quarry':
      px(ctx, 0, 4, 8, 4, '#bdb7ab'); px(ctx, 1, 5, 3, 2, '#e1dccf'); px(ctx, 5, 6, 2, 2, '#8f897d'); px(ctx, 0, 4, 8, 1, '#8f897d');
      break;
    case 'port':
      px(ctx, 0, 3, 8, 1, '#7a5230'); px(ctx, 0, 4, 1, 3, '#5e4528'); px(ctx, 7, 4, 1, 3, '#5e4528');
      px(ctx, 3, 0, 1, 3, '#5e4528'); px(ctx, 4, 0, 2, 2, '#f5f0e1');
      break;
    case 'walls_tower':
      px(ctx, 1, 1, 6, 7, '#8f897d'); px(ctx, 5, 1, 2, 7, '#6f6a60'); px(ctx, 1, 0, 1, 1, '#8f897d'); px(ctx, 3, 0, 1, 1, '#8f897d'); px(ctx, 5, 0, 1, 1, '#8f897d');
      px(ctx, 3, 3, 1, 2, '#1b140e');
      break;
    case 'textile_mill': case 'foundry': case 'factory':
      px(ctx, 0, 3, 8, 5, kind === 'foundry' ? '#5c4a44' : '#9b4a35'); px(ctx, 0, 2, 8, 1, '#3e2f2a');
      px(ctx, 6, 0, 1, 3, '#3e2f2a'); px(ctx, 1, 4, 1, 1, '#f6d776'); px(ctx, 3, 4, 1, 1, '#f6d776');
      break;
    case 'castle':
      px(ctx, 2, 5, 12, 10, '#8f897d'); px(ctx, 11, 5, 3, 10, '#6f6a60');
      px(ctx, 0, 2, 4, 13, '#a39d90'); px(ctx, 12, 2, 4, 13, '#7d776c');
      for (const x of [0, 2, 12, 14]) px(ctx, x, 1, 1, 1, '#a39d90');
      for (let x = 4; x < 12; x += 2) px(ctx, x, 4, 1, 1, '#a39d90');
      px(ctx, 6, 10, 4, 5, '#2a1d12'); px(ctx, 6, 9, 4, 1, '#5e594f');
      px(ctx, 1, 6, 1, 2, '#1b140e'); px(ctx, 13, 6, 1, 2, '#1b140e');
      px(ctx, 7, 0, 1, 4, '#2a1d12'); px(ctx, 8, 0, 3, 2, civColor);
      break;
    case 'star_fort':
      px(ctx, 3, 3, 10, 10, '#9c9484'); px(ctx, 5, 5, 6, 6, '#6b8a4a');
      for (const [x, y] of [[0, 6], [13, 6], [6, 0], [6, 13]]) px(ctx, x, y, 3, 3, '#b3ab9a');
      px(ctx, 7, 7, 2, 2, civColor); px(ctx, 3, 3, 10, 1, '#c8c0aa');
      break;
    case 'aqueduct':
      px(ctx, 0, 1, 8, 2, '#c8c0aa'); px(ctx, 0, 1, 8, 1, '#5a8ac8');
      for (const x of [0, 3, 6]) px(ctx, x, 3, 2, 5, '#a39a8c');
      px(ctx, 2, 3, 1, 1, '#a39a8c'); px(ctx, 5, 3, 1, 1, '#a39a8c');
      break;
    case 'hospital':
      px(ctx, 1, 3, 6, 5, '#ece6d6'); px(ctx, 1, 2, 6, 1, '#a39a8c');
      px(ctx, 3, 4, 2, 3, '#d94a3d'); px(ctx, 2, 5, 4, 1, '#d94a3d');
      break;
    case 'observatory':
      px(ctx, 1, 4, 6, 4, '#d9d2bf'); px(ctx, 2, 2, 4, 2, '#8fa8ef'); px(ctx, 3, 1, 2, 1, '#8fa8ef');
      px(ctx, 5, 1, 3, 1, '#3b2a1a'); px(ctx, 3, 5, 2, 3, '#3b2a1a');
      break;
    case 'bank':
      px(ctx, 0, 2, 8, 1, '#c8c0aa'); px(ctx, 1, 1, 6, 1, '#e8e0c8');
      for (const x of [1, 3, 5]) px(ctx, x, 3, 1, 4, '#ece6d6');
      px(ctx, 0, 7, 8, 1, '#a39a8c'); px(ctx, 6, 3, 1, 4, '#ece6d6'); px(ctx, 3, 0, 2, 1, '#f2c94c');
      break;
    case 'railway_station':
      px(ctx, 0, 2, 8, 4, '#9b4a35'); px(ctx, 0, 1, 8, 1, '#3e2f2a'); px(ctx, 2, 3, 1, 1, '#f6d776'); px(ctx, 5, 3, 1, 1, '#f6d776');
      px(ctx, 0, 6, 8, 1, '#5c5048'); px(ctx, 0, 7, 8, 1, '#8a8176');
      for (const x of [1, 4, 7]) px(ctx, x, 6, 1, 2, '#3b2a1a');
      break;
    case 'campfire':
      px(ctx, 2, 5, 4, 1, '#6e4626'); px(ctx, 3, 3, 2, 2, '#f08a24'); px(ctx, 3, 2, 1, 1, '#f6d776'); px(ctx, 4, 4, 1, 1, '#f6d776');
      break;
    default:
      px(ctx, 1, 2, 6, 6, '#999');
  }
}

export function houseSprite(race, tier) {
  const key = `h:${race}:${tier}`;
  if (!spriteCache.has(key)) {
    const c = makeCanvas(8, 8);
    drawHouse(c.getContext('2d'), race, tier);
    spriteCache.set(key, c);
  }
  return spriteCache.get(key);
}

export const BIG_SPRITES = { town_hall: 16, university: 16, castle: 16, star_fort: 16 };
export function specialSprite(kind, race, civColor) {
  const key = `s:${kind}:${race}:${civColor}`;
  if (!spriteCache.has(key)) {
    const size = BIG_SPRITES[kind] || 8;
    const c = makeCanvas(size, size);
    drawSpecial(c.getContext('2d'), kind, race, civColor);
    spriteCache.set(key, c);
  }
  return spriteCache.get(key);
}

// Field tile (crop rows)
let fieldCache = null;
export function fieldSprites() {
  if (fieldCache) return fieldCache;
  fieldCache = [];
  const sets = [['#c9b04a', '#a8913a'], ['#8fbf4a', '#6f9a36'], ['#d8c068', '#b49c4c']];
  for (const [a, b] of sets) {
    const c = makeCanvas(8, 8);
    const ctx = c.getContext('2d');
    px(ctx, 0, 0, 8, 8, a);
    for (let y = 1; y < 8; y += 2) px(ctx, 0, y, 8, 1, b);
    px(ctx, 0, 0, 8, 1, '#7a6a3a33'); px(ctx, 0, 0, 1, 8, '#7a6a3a33');
    fieldCache.push(c);
  }
  return fieldCache;
}

// ---------- Character portraits (Phase 11) ----------
// A 32×32 pixel portrait, generated from the character's id, race, age, gender and traits.
const portraitCache = new Map();
const HAIR = ['#2a1d14', '#5a3a22', '#8a5a2e', '#c89048', '#e8d090', '#7a2a1a', '#3a3a3a'];
const shadeHex = (hex, f) => rgbToHex(shade(hexToRgb(hex), f));
export function portraitUrl(p, race, opts = {}) {
  if (!p) return '';
  const ageBand = p.age < 16 ? 0 : p.age < 45 ? 1 : p.age < 62 ? 2 : 3;
  const key = `${p.id}:${p.name}:${race}:${ageBand}:${opts.crown ? 1 : 0}:${opts.bg || ''}:${(p.traits || []).join(',')}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  if (SPRITES.sheets.has('portrait_' + race)) {
    const url = portraitArt(p, race, opts, ageBand);
    if (url) { portraitCache.set(key, url); return url; }
  }
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d');
  const R = RACES[race] || RACES.humans;
  let seed = (p.id || 1) * 2654435761 >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  // background: realm colour with a vignette
  const bg = opts.bg || '#3a2c1d';
  P(0, 0, 32, 32, shadeHex(bg, -0.45)); P(2, 2, 28, 28, shadeHex(bg, -0.2));
  for (let i = 0; i < 6; i++) P(2 + i * 5, 2, 2, 28, shadeHex(bg, -0.27));
  const skin = R.skin;
  const skinD = shadeHex(skin, -0.22), skinL = shadeHex(skin, 0.15);
  const male = p.gender !== 'f';
  const old = ageBand >= 2, elder = ageBand === 3, child = ageBand === 0;
  let hair = HAIR[(rnd() * HAIR.length) | 0];
  if (race === 'elves') hair = ['#e8d8a0', '#c0a060', '#2a1d14', '#d8d8e8'][(rnd() * 4) | 0];
  if (race === 'orcs') hair = '#1a1410';
  if (old) hair = elder ? '#e8e8e8' : '#a8a8a8';
  const cloth = opts.crown ? (opts.robe || '#7a1f2a') : ['#2e5fa8', '#3a6a3a', '#6a3a2a', '#4a3a6a', '#7a6a3a'][(rnd() * 5) | 0];
  const ox = child ? 1 : 0, oy = child ? 3 : 0;
  // shoulders / clothes
  P(5, 25, 22, 7, cloth); P(5, 25, 22, 1, shadeHex(cloth, 0.2)); P(14, 25, 4, 7, shadeHex(cloth, -0.25));
  if (opts.crown) { P(5, 26, 22, 1, '#e6c068'); P(15, 27, 2, 2, '#e6c068'); }
  // neck
  P(13 + ox, 21 + oy, 6 - ox * 2, 4, skinD);
  // head shape (race)
  const hw = race === 'dwarves' ? 14 : race === 'halflings' ? 12 : 12, hx = 16 - hw / 2 + 0;
  const hy = 7 + oy, hh = race === 'lizardfolk' ? 13 : 14;
  P(hx + 1, hy, hw - 2, hh, skin); P(hx, hy + 2, hw, hh - 4, skin);
  P(hx, hy + 2, 2, hh - 5, skinL); P(hx + hw - 2, hy + 3, 2, hh - 6, skinD);
  if (race === 'lizardfolk') { P(hx + hw - 1, hy + 7, 4, 4, skin); P(hx + hw + 1, hy + 9, 2, 1, skinD); for (let i = 0; i < 5; i++) P(hx + 2 + ((rnd() * (hw - 4)) | 0), hy + 1 + ((rnd() * 10) | 0), 1, 1, skinD); P(hx + 3, hy - 2, 1, 3, '#c94a3a'); P(hx + 6, hy - 3, 1, 4, '#c94a3a'); P(hx + 9, hy - 2, 1, 3, '#c94a3a'); }
  // ears
  if (race === 'elves') { P(hx - 3, hy + 4, 3, 2, skin); P(hx - 4, hy + 2, 2, 2, skin); P(hx + hw, hy + 4, 3, 2, skin); P(hx + hw + 2, hy + 2, 2, 2, skin); }
  else if (race !== 'lizardfolk') { P(hx - 1, hy + 6, 1, 3, skinD); P(hx + hw, hy + 6, 1, 3, skinD); }
  if (race === 'orcs') { P(hx - 2, hy + 5, 2, 2, skin); P(hx + hw, hy + 5, 2, 2, skin); }
  // eyes & brows
  const ey = hy + 6;
  const eye = race === 'lizardfolk' ? '#e8c020' : race === 'orcs' ? '#c8302a' : ['#3a6aa8', '#5a3a1a', '#3a7a3a', '#2a2a2a'][(rnd() * 4) | 0];
  P(hx + 2, ey, 3, 2, '#f4f0e8'); P(hx + hw - 5, ey, 3, 2, '#f4f0e8');
  P(hx + 3, ey, 2, 2, eye); P(hx + hw - 4, ey, 2, 2, eye);
  const angry = (p.traits || []).includes('cruel') || race === 'orcs';
  P(hx + 2, ey - 2 + (angry ? 1 : 0), 3, 1, shadeHex(hair, -0.1)); P(hx + hw - 5, ey - 2 + (angry ? 1 : 0), 3, 1, shadeHex(hair, -0.1));
  // nose & mouth
  if (race !== 'lizardfolk') { P(15, ey + 2, 2, 3, skinD); P(16, ey + 4, 1, 1, shadeHex(skin, -0.35)); }
  const smile = (p.traits || []).some((t) => ['charismatic', 'just', 'honest'].includes(t));
  P(14, ey + 6, 4, 1, shadeHex(skin, -0.45)); if (smile) { P(13, ey + 5, 1, 1, shadeHex(skin, -0.45)); P(18, ey + 5, 1, 1, shadeHex(skin, -0.45)); }
  if (race === 'orcs') { P(13, ey + 5, 1, 2, '#f0ead8'); P(18, ey + 5, 1, 2, '#f0ead8'); }
  // wrinkles
  if (old) { P(hx + 2, ey + 3, 2, 1, skinD); P(hx + hw - 4, ey + 3, 2, 1, skinD); if (elder) P(hx + 3, hy + 2, hw - 6, 1, skinD); }
  // hair
  if (race !== 'lizardfolk') {
    const long = !male || race === 'elves';
    P(hx, hy - 1, hw, 3, hair); P(hx - 1, hy + 1, 2, 5, hair); P(hx + hw - 1, hy + 1, 2, 5, hair);
    if (long) { P(hx - 1, hy + 6, 2, 10, hair); P(hx + hw - 1, hy + 6, 2, 10, hair); }
    if (race === 'halflings') for (let i = 0; i < 6; i++) P(hx + i * 2, hy - 2, 2, 2, shadeHex(hair, 0.15));
    P(hx + 2, hy - 1, 4, 1, shadeHex(hair, 0.25));
    if (elder && male && race === 'humans') P(hx + 3, hy - 1, hw - 6, 2, skin); // balding
  }
  // beard
  if (male && !child && (race === 'dwarves' || (race !== 'elves' && race !== 'lizardfolk' && rnd() < 0.55))) {
    const bl = race === 'dwarves' ? 10 : 4;
    P(hx + 1, ey + 5, hw - 2, 2, hair); P(hx + 2, ey + 7, hw - 4, bl - 2, hair); if (race === 'dwarves') { P(hx + 4, ey + 7 + bl - 2, hw - 8, 3, hair); P(13, ey + 8, 1, 4, shadeHex(hair, 0.2)); }
    P(14, ey + 6, 4, 1, shadeHex(skin, -0.45));
  }
  // crown or circlet
  if (opts.crown) {
    const gold = '#e6c068', gd = '#a8802a';
    P(hx, hy - 3, hw, 3, gold); P(hx, hy - 1, hw, 1, gd);
    for (let i = 0; i < 3; i++) P(hx + 1 + i * ((hw - 3) / 2), hy - 6, 2, 3, gold);
    P(15, hy - 2, 2, 1, '#c0392b');
  }
  if ((p.traits || []).includes('wise') || (p.traits || []).includes('genius')) P(hx + 2, ey - 1, hw - 4, 1, 'rgba(240,240,255,0.25)');
  if ((p.traits || []).includes('sickly')) P(hx + 1, hy + 2, hw - 2, hh - 3, 'rgba(160,200,140,0.18)');
  if ((p.traits || []).includes('brave') || (p.traits || []).includes('strong')) P(hx + hw - 4, ey + 2, 1, 4, shadeHex(skin, -0.4)); // scar
  // frame
  ctx.strokeStyle = '#0c0906'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, 31, 31);
  P(1, 1, 30, 1, 'rgba(255,230,170,0.25)');
  const url = c.toDataURL();
  portraitCache.set(key, url);
  if (portraitCache.size > 600) portraitCache.delete(portraitCache.keys().next().value);
  return url;
}
// Portraits from the Aseprite parts sheet portrait_<race> (scripts/art/portraits.mjs): a 64×64 bust
// in layers (head by gender, age and look; beard; crown; scar), hair and clothes recoloured from
// their key colours, over the realm's colour.
const HAIRK = [[0x00, 0x5a, 0x5a], [0x00, 0xa0, 0xa0], [0x00, 0xd2, 0xd2], [0x70, 0xff, 0xff]];
function recolorHair(src, hair) {
  const to = [-0.45, -0.2, 0, 0.25].map((f) => hexToRgb(shadeHex(hair, f)));
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), q = d.data;
  for (let i = 0; i < q.length; i += 4) {
    if (!q[i + 3] || q[i] !== 0 && q[i] !== 0x70) continue;
    const k = HAIRK.findIndex((h) => h[0] === q[i] && h[1] === q[i + 1] && h[2] === q[i + 2]);
    if (k >= 0) [q[i], q[i + 1], q[i + 2]] = to[k];
  }
  x.putImageData(d, 0, 0);
  return c;
}
function portraitArt(p, race, opts, ageBand) {
  const id = 'portrait_' + race;
  let seed = ((p.id || 1) * 2654435761 + 977) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const male = p.gender !== 'f', look = rnd() < 0.5 ? 0 : 1;
  const head = frameCanvas(id, tagFrame(id, male ? 'm' : 'f', ageBand * 2 + look));
  if (!head || head.width !== 64) return null;
  let hair = HAIR[(rnd() * HAIR.length) | 0];
  if (race === 'elves') hair = ['#e8d8a0', '#c0a060', '#2a1d14', '#d8d8e8'][(rnd() * 4) | 0];
  if (race === 'orcs') hair = ['#1a1410', '#3a2a1a'][(rnd() * 2) | 0];
  if (race === 'lizardfolk') hair = ['#c94a3a', '#e0a030', '#3a8ac8', '#8a4ac8'][(rnd() * 4) | 0];
  if (ageBand >= 2 && race !== 'lizardfolk') hair = ageBand === 3 ? '#e8e8e8' : '#a8a8a8';
  const cloth = opts.crown ? (opts.robe || '#7a1f2a') : ['#2e5fa8', '#3a6a3a', '#6a3a2a', '#4a3a6a', '#7a6a3a'][(rnd() * 5) | 0];
  const c = makeCanvas(64, 64), ctx = c.getContext('2d');
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const bg = opts.bg || '#3a2c1d';
  P(0, 0, 64, 64, shadeHex(bg, -0.45)); P(3, 3, 58, 58, shadeHex(bg, -0.2));
  for (let i = 0; i < 7; i++) P(5 + i * 8, 3, 3, 58, shadeHex(bg, -0.26));
  P(3, 3, 58, 1, shadeHex(bg, 0.05));
  const layer = (tag, k) => { const f = frameCanvas(id, tagFrame(id, tag, k)); if (f) ctx.drawImage(recolorHair(f, hair), 0, 0); };
  ctx.drawImage(tintKey(recolorHair(head, hair), cloth), 0, 0);
  const beard = male && ageBand > 0 && (race === 'dwarves' || (race !== 'elves' && race !== 'lizardfolk' && rnd() < 0.55));
  if (beard) layer('beard', ageBand);
  const tr = p.traits || [];
  if (tr.includes('brave') || tr.includes('strong')) layer('scar', ageBand);
  if (opts.crown) layer('crown', ageBand);
  if (tr.includes('sickly')) { ctx.globalCompositeOperation = 'source-atop'; P(16, 8, 32, 36, 'rgba(160,200,140,0.16)'); ctx.globalCompositeOperation = 'source-over'; }
  ctx.strokeStyle = '#0c0906'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 62);
  P(2, 2, 60, 1, 'rgba(255,230,170,0.3)');
  return c.toDataURL();
}
export function portraitImg(p, race, opts = {}) {
  if (!p) return '<span class="portrait empty"></span>';
  return `<img class="portrait ${opts.cls || ''}" src="${portraitUrl(p, race, opts)}" alt="${(p.name || '').replace(/"/g, '')}">`;
}
