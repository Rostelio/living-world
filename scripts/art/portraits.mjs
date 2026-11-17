// Character portraits: portrait_<race> is a sheet of 64×64 parts the game layers over the realm's
// background (src/render/sprites.js portraitUrl). Tags: m and f (8 frames each: age band × 2 looks,
// frame = age * 2 + look; ages child, adult, middle, old), beard, crown, scar (4 frames each, one
// per age band). Clothes use the KEY colours (tinted with the robe colour) and hair uses HAIRK
// (tinted with the character's hair colour), so one sheet serves every character of a race.
// advisor_portrait is a fixed 48×48 face for the advisor card.
import { Pix } from './pix.mjs';
import { R, INK, SKIN } from './palette.mjs';
import { KEY } from './kit.mjs';

export const HAIRK = ['#005a5a', '#00a0a0', '#00d2d2', '#70ffff'];
const EYES = { humans: ['#5a3a1a', '#3a6aa8'], elves: ['#3a8a5a', '#6a5aa8'], dwarves: ['#5a3a1a', '#3a5a7a'], orcs: ['#c8302a', '#d8a020'], lizardfolk: ['#e8c020', '#e88a20'], halflings: ['#5a3a1a', '#3a7a3a'] };

function geom(race, age) {
  const child = age === 0;
  let rx = race === 'dwarves' || race === 'orcs' ? 14 : race === 'lizardfolk' ? 12 : 13, ry = race === 'halflings' ? 14 : 15;
  if (child) { rx -= 2; ry -= 2; }
  const cy = child ? 30 : 26;
  return { cx: 32, cy, rx, ry, ey: cy + 1, child };
}
const inFace = (x, y, G, race) => {
  const nx = (x + 0.5 - G.cx) / G.rx, ny = (y + 0.5 - G.cy) / G.ry;
  if (nx * nx + ny * ny > 1) return false;
  const taper = race === 'dwarves' || race === 'orcs' ? 0.35 : 0.6;
  return !(ny > 0.3 && Math.abs(nx) > 1 - (ny - 0.3) * taper);
};

function shoulders(g, G) {
  for (let y = 46; y < 64; y++) {
    const hw = Math.min(28, 13 + (y - 46) * 1.1);
    for (let x = Math.round(G.cx - hw); x < Math.round(G.cx + hw); x++) {
      const t = (x - (G.cx - hw)) / (2 * hw);
      g.p(x, y, t < 0.18 ? KEY[3] : t > 0.8 ? KEY[1] : KEY[2]);
    }
  }
  g.line(G.cx - 6, 46, G.cx - 1, 52, KEY[0]).line(G.cx + 5, 46, G.cx, 52, KEY[0]);
}

function head(race, gender, age, look) {
  const g = new Pix(64, 64), G = geom(race, age), S = SKIN[race], { cx, cy, rx, ry, ey } = G;
  const H = HAIRK, male = gender === 'm', old = age >= 2, elder = age === 3;
  // long hair falls behind the head and over the shoulders
  const longBack = (!male && !(race === 'dwarves' && look === 1) && !(race === 'orcs')) || (race === 'elves' && look === 0);
  // neck and shoulders
  shoulders(g, G);
  if (longBack && race !== 'lizardfolk') {
    const end = race === 'elves' ? 56 : 52;
    for (let y = cy - ry - 2; y < end; y++) {
      const hw = y < cy ? (rx + 3) * Math.sqrt(Math.max(0, 1 - ((y - cy) / (ry + 2)) ** 2)) : rx + 3 - Math.max(0, y - 44) * 0.7;
      for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
        if (y >= end - 3 && ((x >> 1) + y) % 2) continue;                        // ragged ends
        if (y > cy + ry - 4 && Math.abs(x + 0.5 - cx) < 8) continue;               // parted round the neck
        g.p(x, y, x < cx - rx ? H[2] : x > cx + rx - 1 ? H[0] : (x + (y >> 2)) % 6 === 0 ? H[2] : H[1]);
      }
    }
  }
  if (race === 'dwarves' && !male && look === 1) for (const s of [-1, 1]) for (let y = ey; y < 60; y++) { const x = cx + s * (rx + 1); g.r(x - 1, y, 3, 1, (y >> 1) % 2 ? H[1] : H[2]); if (y % 7 === 0) g.r(x - 1, y, 3, 1, R.gold[2]); }
  if (race === 'orcs' && !male) for (let y = cy; y < 58; y++) { g.r(cx + rx - 1, y, 3, 1, (y >> 1) % 2 ? H[1] : H[0]); }
  g.r(cx - 5, cy + ry - 4, 10, 46 - (cy + ry - 4), S[1]).r(cx - 5, cy + ry - 4, 2, 46 - (cy + ry - 4), S[2]);   // neck
  for (let i = 0; i < 6; i++) g.r(cx - 5 + i, 46 + i, Math.max(0, 10 - i * 2), 1, S[1]);
  // ears
  if (race === 'elves') for (const s of [-1, 1]) { for (let i = 0; i < 8; i++) g.r(cx + s * (rx - 1 + i) - (s < 0 ? 1 : 0), ey + 3 - i, 2, 3, i > 5 ? S[3] : S[2]); }
  else if (race === 'orcs') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.r(cx + s * (rx - 1 + i) - (s < 0 ? 1 : 0), ey + 1 - i, 2, 4 - i, S[2]);
  else if (race !== 'lizardfolk') for (const s of [-1, 1]) { g.ellipse(cx + s * rx, ey + 3, 2, 3, S[2]); g.p(cx + s * rx, ey + 3, S[1]); }
  // face, lit from the top-left
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    if (!inFace(x, y, G, race)) continue;
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, lit = -0.65 * nx - 0.45 * ny;
    g.p(x, y, lit > 0.45 ? S[3] : lit > -0.3 ? S[2] : S[1]);
  }
  if (race === 'lizardfolk') {                              // scaly muzzle and scales
    g.ellipse(cx, ey + 7, 7, 4, S[2]); g.r(cx - 6, ey + 9, 13, 1, S[1]);
    g.p(cx - 2, ey + 5, S[0]).p(cx + 2, ey + 5, S[0]);
    for (let i = 0; i < 9; i++) g.p(cx - rx + 3 + ((i * 7) % (rx * 2 - 5)), cy - ry + 4 + ((i * 5) % 9), S[1]);
  }
  // eyes and brows
  const iris = EYES[race][look % 2], big = G.child ? 1 : 0;
  for (const ex of [cx - 7, cx + 4]) {
    g.r(ex, ey, 4, 3 + big, '#f4f0e8');
    g.r(ex + 1, ey, 2, 3 + big, iris);
    if (race === 'lizardfolk' || race === 'orcs') g.r(ex + 1, ey, 1, 3 + big, INK); else g.p(ex + 2, ey + 1, INK).p(ex + 1, ey + 1, INK);
    g.p(ex + 1, ey, '#ffffff');
    g.r(ex, ey - 1, 4, 1, S[1]);
    const angry = race === 'orcs';
    if (race !== 'lizardfolk') g.r(ex, ey - 3 + (angry && ex > cx ? 1 : 0), 4, 1, H[0]).p(angry ? (ex < cx ? ex + 3 : ex) : -1, ey - 2, H[0]);
  }
  // nose and mouth
  if (race === 'dwarves') { g.ellipse(cx, ey + 5, 2.5, 2.5, S[2]); g.r(cx + 1, ey + 5, 2, 2, S[1]).p(cx - 1, ey + 4, S[3]); }
  else if (race === 'orcs') g.r(cx - 2, ey + 5, 5, 2, S[1]).p(cx - 1, ey + 6, S[0]).p(cx + 1, ey + 6, S[0]);
  else if (race !== 'lizardfolk') g.r(cx, ey + 3, 1, 3, S[1]).p(cx + 1, ey + 5, S[0]);
  const my = ey + (race === 'lizardfolk' ? 9 : 8);
  g.r(cx - 2, my, 5, 1, S[0]);
  if (!male && race !== 'lizardfolk') g.r(cx - 2, my, 5, 1, R.red[1]).r(cx - 1, my + 1, 3, 1, R.pink[1]);
  if (race === 'orcs') g.r(cx - 3, my - 2, 1, 2, R.cream[3]).r(cx + 3, my - 2, 1, 2, R.cream[3]);
  if (race === 'halflings' || G.child) g.r(cx - 8, ey + 4, 2, 1, R.pink[2]).r(cx + 7, ey + 4, 2, 1, R.pink[2]);
  // age
  if (old) { g.r(cx - 6, ey + 4, 3, 1, S[1]).r(cx + 4, ey + 4, 3, 1, S[1]).line(cx - 4, ey + 6, cx - 4, ey + 8, S[1]).line(cx + 4, ey + 6, cx + 4, ey + 8, S[1]); }
  if (elder) g.r(cx - 4, cy - ry + 4, 9, 1, S[1]).r(cx - 3, cy - ry + 6, 7, 1, S[1]);
  // hair (or a lizard's crest)
  const top = cy - ry;
  if (race === 'lizardfolk') {
    const n = look ? 5 : 3;
    for (let i = 0; i < n; i++) { const x = cx - (n - 1) * 2 + i * 4, h = 6 - Math.abs(i - (n - 1) / 2) * 1.5; for (let j = 0; j < h; j++) g.r(x - 1 + (j > h / 2 ? 0 : 0), top - j + 1, 2, 1, j < 2 ? H[1] : H[2]); g.p(x, top - Math.floor(h) + 1, H[3]); }
    g.line(cx - rx + 1, ey - 4, cx - rx - 2, ey + 4, H[1]).line(cx + rx - 1, ey - 4, cx + rx + 2, ey + 4, H[0]);
  } else {
    const bald = elder && male && look === 0 && (race === 'humans' || race === 'dwarves');
    const shaved = race === 'orcs' && male && look === 0;
    for (let y = top - 2; y < ey - 2; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / (rx + 1.5), ny = (y + 0.5 - (cy - 2)) / (ry + 1);
      if (nx * nx + ny * ny > 1) continue;
      const fringe = y < top + 4 + (male ? 0 : 1) + ((x * 3) % 5 === 0 ? 1 : 0);
      const side = Math.abs(x - cx) > rx - 3 && y < ey - 2;
      if (!(fringe || side)) continue;
      if (bald && fringe && Math.abs(x - cx) < rx - 3) continue;
      if (shaved && Math.abs(x - cx) > 2) continue;
      const lit = -0.6 * nx - 0.5 * ny;
      g.p(x, y, lit > 0.55 ? H[3] : lit > 0 ? H[2] : lit > -0.45 ? H[1] : H[0]);
    }
    if (shaved) for (let j = 0; j < 7; j++) g.r(cx - 1, top - 2 - j, 3, 1, j % 2 ? H[1] : H[2]);  // topknot
    if (race === 'halflings') for (let i = 0; i < 6; i++) { g.ellipse(cx - rx + 2 + i * 4, top - 1, 2.2, 2.2, H[2]); g.p(cx - rx + 1 + i * 4, top - 2, H[3]); }
    if (!male && look === 1 && race !== 'dwarves' && race !== 'orcs') { g.ellipse(cx, top - 4, 5, 4, H[2]); g.r(cx - 3, top - 6, 3, 1, H[3]).r(cx + 2, top - 3, 2, 2, H[0]); }
    if (male && look === 1 && race !== 'orcs' && race !== 'elves') g.r(cx - rx - 1, ey - 2, 3, 6, H[1]).r(cx + rx - 1, ey - 2, 3, 6, H[0]); // sideburns
    if (race === 'elves' && look === 1) g.r(cx - rx - 1, top + 2, rx * 2 + 3, 1, R.gold[3]);                                    // circlet of a different kind
  }
  g.outline(INK);
  return g;
}

function beard(race, age) {
  const g = new Pix(64, 64);
  if (age === 0) return g;
  const G = geom(race, age), { cx, cy, ry, ey } = G, H = HAIRK;
  for (let y = ey + 4; y <= cy + ry + 3; y++) for (let x = cx - G.rx - 1; x <= cx + G.rx + 1; x++) {
    if (!inFace(x, y, G, race) && !inFace(x, y - 2, G, race)) continue;
    if (y < ey + 8 && Math.abs(x - cx) < G.rx - 3 - (y - ey - 4)) continue;      // cheeks stay bare above the jaw
    if (y === ey + 8 && Math.abs(x - cx) < 3) continue;                           // the mouth shows
    g.p(x, y, (x * 3 + y) % 7 === 0 ? H[0] : x < cx - 4 ? H[2] : x > cx + 4 ? H[0] : H[1]);
  }
  g.r(cx - 5, ey + 6, 11, 2, H[2]).r(cx - 5, ey + 7, 11, 1, H[1]).p(cx - 6, ey + 8, H[1]).p(cx + 6, ey + 8, H[0]); // moustache
  if (race === 'dwarves') {
    for (let y = cy + ry; y < 62; y++) { const hw = Math.max(2, 10 - (y - cy - ry) * 0.45); for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) g.p(x, y, (x + y) % 4 === 0 ? H[0] : x < cx - 2 ? H[2] : H[1]); }
    g.r(cx - 3, 52, 6, 2, R.gold[2]).r(cx - 3, 52, 6, 1, R.gold[3]);
  }
  g.outline(INK);
  return g;
}

function crown(race, age) {
  const g = new Pix(64, 64), G = geom(race, age), { cx, cy, ry } = G, w = G.rx * 2 - (G.child ? 4 : 2), x0 = cx - w / 2, y = cy - ry - 2;
  g.r(x0, y, w, 4, R.gold[2]).r(x0, y, w, 1, R.gold[3]).r(x0, y + 3, w, 1, R.gold[1]);
  for (let i = 0; i < 5; i++) { const px = Math.round(x0 + i * (w - 2) / 4); const h = i === 2 ? 5 : i % 2 ? 2 : 4; g.r(px, y - h, 2, h, R.gold[2]).p(px, y - h, R.gold[3]); }
  g.r(cx - 1, y + 1, 2, 2, R.red[2]).p(x0 + 3, y + 1, R.blue[3]).p(x0 + w - 4, y + 1, R.blue[3]);
  // an ermine collar over the robe
  for (let yy = 46; yy < 50; yy++) { const hw = Math.min(28, 13 + (yy - 46) * 1.1) + 1; g.r(Math.round(cx - hw), yy, Math.round(hw * 2), 1, yy === 46 ? R.white[3] : R.white[2]); }
  for (let x = cx - 12; x < cx + 13; x += 5) g.r(x, 47 + (x % 2), 1, 2, INK);
  g.outline(INK);
  return g;
}

function scar(race, age) {
  const g = new Pix(64, 64);
  if (age === 0) return g;
  const G = geom(race, age), S = SKIN[race];
  g.line(G.cx + 5, G.ey - 3, G.cx + 8, G.ey + 5, S[0]);
  for (let i = 0; i < 3; i++) g.p(G.cx + 6 + (i % 2), G.ey - 1 + i * 2, S[3]);
  return g;
}

export function portraitSheet(race) {
  const frames = [], tags = [];
  for (const gender of ['m', 'f']) { const from = frames.length; for (let a = 0; a < 4; a++) for (let v = 0; v < 2; v++) frames.push(head(race, gender, a, v)); tags.push([gender, from, frames.length - 1, 1000]); }
  for (const [name, fn] of [['beard', beard], ['crown', crown], ['scar', scar]]) { const from = frames.length; for (let a = 0; a < 4; a++) frames.push(fn(race, a)); tags.push([name, from, frames.length - 1, 1000]); }
  return { frames, tags, cols: 8, layer: race };
}

// the advisor: an old counsellor with a long white beard, a scholar's cap and a purple robe
export function advisorSheet() {
  const g = new Pix(48, 48), S = R.skinHuman, cx = 24;
  g.r(0, 0, 48, 48, R.ink[1]).r(2, 2, 44, 44, '#3a2e4a');
  for (let y = 2; y < 46; y += 4) g.r(2, y, 44, 1, '#43365a');
  for (let y = 34; y < 46; y++) { const hw = Math.min(20, 10 + (y - 34)); g.r(cx - hw, y, hw * 2, 1, y === 34 ? R.purple[3] : R.purple[2]).p(cx - hw, y, R.purple[3]).p(cx + hw - 1, y, R.purple[1]); }
  g.r(cx - 1, 34, 2, 12, R.gold[2]);
  for (let y = 12; y < 30; y++) for (let x = cx - 9; x < cx + 9; x++) { const nx = (x + 0.5 - cx) / 9, ny = (y + 0.5 - 21) / 9.5; if (nx * nx + ny * ny <= 1) g.p(x, y, -0.6 * nx - 0.4 * ny > 0.4 ? S[3] : nx > 0.5 ? S[1] : S[2]); }
  g.ellipse(cx - 9, 21, 1.5, 2.5, S[1]); g.ellipse(cx + 9, 21, 1.5, 2.5, S[1]);
  for (const ex of [cx - 6, cx + 2]) { g.r(ex, 19, 4, 2, '#f4f0e8').r(ex + 1, 19, 2, 2, '#3a6aa8').p(ex + 1, 19, '#fff'); g.r(ex - 1, 17, 6, 1, R.white[2]); }
  g.r(cx - 7, 22, 4, 1, S[1]).r(cx + 3, 22, 4, 1, S[1]);
  g.r(cx, 21, 1, 3, S[1]);
  // beard
  for (let y = 24; y < 44; y++) { const hw = y < 28 ? 9 : Math.max(2, 9 - (y - 28) * 0.45); for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) g.p(x, y, (x + y) % 5 === 0 ? R.white[1] : x < cx - 2 ? R.white[3] : R.white[2]); }
  g.r(cx - 2, 26, 5, 1, S[0]);
  // cap with a tassel
  g.r(cx - 10, 9, 20, 5, R.purple[1]).r(cx - 10, 9, 20, 1, R.purple[2]).r(cx - 8, 5, 16, 4, R.purple[1]).r(cx - 8, 5, 16, 1, R.purple[2]);
  g.r(cx - 10, 12, 20, 2, R.gold[2]);
  g.line(cx + 7, 5, cx + 11, 11, R.gold[3]).r(cx + 10, 11, 2, 3, R.gold[2]);
  g.outline(INK);
  // a frame
  for (let i = 0; i < 48; i++) { g.p(i, 0, '#120c08').p(i, 47, '#120c08').p(0, i, '#120c08').p(47, i, '#120c08'); g.p(i, 1, '#8a6d3e').p(1, i, '#8a6d3e'); }
  return { frames: [g], tags: [], layer: 'advisor' };
}
