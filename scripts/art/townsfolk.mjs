// townsfolk_<race>: the small villagers in towns. 32×32 canvas, feet on row 30 (outline on 31),
// centred on x = 16, facing right (the game mirrors them for left). Chibi proportions: a big head
// on a small body, a 1 px ink outline and 3–4 tone ramps from art/palette.gpl.
// Frames per role: 0..3 walk, 4..5 work, 6 idle — the same frame numbers the game asks for.
import { Pix } from './pix.mjs';
import { R, SKIN, INK } from './palette.mjs';
import { KEY } from './kit.mjs';

export const ROLES = ['farmer', 'woodcutter', 'miner', 'crafter', 'merchant', 'priest', 'guard', 'noble', 'child', 'hauler'];

const HAIR = { humans: R.hairBrown, elves: R.hairBlond, dwarves: R.hairGinger, orcs: R.hairBlack, lizardfolk: null, halflings: R.hairBrown };
// clothes per role: shirt ramp, trousers ramp, boots colour
const DRESS = {
  farmer: { shirt: R.green, pants: R.brown, boots: R.wood[0] },
  woodcutter: { shirt: R.red, pants: R.brown, boots: R.wood[0], plaid: true },
  miner: { shirt: R.steel, pants: R.brown, boots: R.ink[2] },
  crafter: { shirt: R.blue, pants: R.brown, boots: R.wood[0], apron: R.wood },
  merchant: { shirt: R.ochre, pants: R.red, boots: R.wood[0], sash: R.red },
  priest: { shirt: R.cream, pants: R.cream, boots: R.wood[1], robe: true, trim: R.gold },
  guard: { shirt: R.steel, pants: R.blue, boots: R.ink[2], tabard: R.blue },
  noble: { shirt: R.purple, pants: R.purple, boots: R.ink[2], robe: true, trim: R.gold, cape: R.red },
  child: { shirt: R.ochre, pants: R.brown, boots: R.wood[1] },
  hauler: { shirt: R.cream, pants: R.wood, boots: R.wood[0] },
  // soldiers (soldier_<race>): tunics and shields in KEY colours, tinted with the realm colour in game
  spear: { shirt: KEY, pants: R.brown, boots: R.ink[2] },
  bow: { shirt: KEY, pants: R.brown, boots: R.wood[0] },
  gun: { shirt: KEY, pants: R.steel, boots: R.ink[2] },
};

export function townsfolkFrame(race, role, f) {
  const g = new Pix(32, 32);
  const skin = SKIN[race] || R.skinHuman;
  const D = DRESS[role];
  const child = role === 'child';
  const short = race === 'dwarves' || race === 'halflings';
  const broad = race === 'dwarves' || race === 'orcs';
  const walk = f <= 3, work = f === 4 || f === 5, up = f === 4;
  const bob = walk && (f === 1 || f === 3) ? -1 : 0;

  // ---- layout ----
  const bx = broad ? 12 : child ? 14 : 13, bw = broad ? 8 : child ? 4 : 6;           // body x and width
  const bodyRows = child ? 3 : short ? 4 : 5;
  const legRows = child || short ? 1 : 2;
  const feetY = 30, bodyBot = feetY - legRows - 1 + bob, bodyTop = bodyBot - bodyRows + 1;
  const headH = child ? 6 : 7, hx = child ? 13 : 12, hw = child ? 7 : 8;
  const ht = bodyTop - headH;                                                            // head top row
  const H = (r) => ht + r;                                                               // head row → y

  // ---- legs and feet ----
  const legW = 2;
  let lx = bx + (broad ? 1 : 0), rx = bx + bw - legW - (broad ? 1 : 0);
  let lLift = 0, rLift = 0;
  if (walk) {
    if (f === 0) { lx += 1; rx -= 1; }
    if (f === 2) { lx -= 1; rx += 1; }
    if (f === 1) lLift = 1;
    if (f === 3) rLift = 1;
  }
  const bare = race === 'halflings' || race === 'lizardfolk';
  const foot = bare ? skin[1] : D.boots;
  if (!D.robe) {
    for (const [x, lift, back] of [[rx, rLift, true], [lx, lLift, false]]) {
      g.r(x, bodyBot + 1, legW, feetY - bodyBot - 1 - lift, back ? D.pants[1] : D.pants[2]);
      g.r(x, feetY - lift, legW + (race === 'halflings' ? 1 : 0), 1, foot);
    }
  } else {
    // robe down to the feet, the hem sways while walking
    const sway = walk ? (f === 0 ? 1 : f === 2 ? -1 : 0) : 0;
    for (let y = bodyBot + 1; y <= feetY - 1; y++) {
      const k = y - bodyBot;
      g.r(bx - (k > 1 ? 1 : 0) + (k > 1 ? sway : 0), y, bw + (k > 1 ? 2 : 0), 1, D.shirt[2]);
    }
    g.r(bx - 1 + sway, feetY - 1, bw + 2, 1, D.trim ? D.trim[2] : D.shirt[1]);
    g.p(bx + 1 + sway, feetY, foot); g.p(bx + bw - 2 + sway, feetY, foot);
    g.over((x, y) => y > bodyBot && y < feetY - 1 && x >= bx + bw - 1 + sway, D.shirt[1]);
    g.over((x, y) => y > bodyBot && y < feetY - 1 && x <= bx + sway, D.shirt[3]);
  }

  // ---- cape (behind the body) ----
  if (D.cape) g.r(bx - 2, bodyTop, 2, feetY - bodyTop, D.cape[1]).r(bx - 2, bodyTop, 1, feetY - bodyTop - 1, D.cape[2]);

  // ---- lizard tail (behind) ----
  if (race === 'lizardfolk') {
    const tw = walk ? (f % 2 ? 1 : 0) : 0;
    g.r(bx - 2, bodyBot - 1, 2, 2, skin[2]).r(bx - 4, bodyBot + tw, 3, 1, skin[2]).p(bx - 5, bodyBot + 1 + tw, skin[1]).p(bx - 4, bodyBot + 1 + tw, skin[1]);
  }

  // ---- back arm ----
  const armRows = child ? 3 : 4;
  const swing = walk ? (f === 0 ? 1 : f === 2 ? -1 : 0) : 0;
  const carryUp = role === 'hauler' && walk;
  if (!carryUp) {
    g.r(bx - 1, bodyTop - swing, 1, armRows - 1, D.shirt[1]).p(bx - 1, bodyTop - swing + armRows - 1, skin[1]);
  }

  // ---- body ----
  g.r(bx, bodyTop, bw, bodyRows, D.shirt[2]);
  g.r(bx, bodyTop, 1, bodyRows, D.shirt[3]);
  g.r(bx + bw - 1, bodyTop, 1, bodyRows, D.shirt[1]);
  g.r(bx, bodyBot, bw, 1, D.shirt[1]);
  if (D.plaid) for (let y = bodyTop; y <= bodyBot; y++) for (let x = bx; x < bx + bw; x++) if ((x + y) % 3 === 0) g.p(x, y, R.red[0]);
  if (D.apron) { g.r(bx + 1, bodyTop + 1, bw - 2, bodyRows - 1, D.apron[2]).r(bx + 1, bodyTop + 1, bw - 2, 1, D.apron[3]); }
  if (D.tabard) { g.r(bx + 2, bodyTop, bw - 4, bodyRows + 1, D.tabard[2]).p(bx + 2, bodyTop + 1, R.gold[3]); }
  if (D.sash) g.line(bx, bodyTop, bx + bw - 1, bodyBot - 1, D.sash[2]);
  if (D.trim && D.robe) { g.r(bx + Math.floor(bw / 2) - 1, bodyTop, 1, bodyRows, D.trim[2]); }
  if (!D.robe && !D.tabard && !child) g.r(bx, bodyBot - 1, bw, 1, R.wood[1]).p(bx + bw - 2, bodyBot - 1, R.gold[2]); // belt + buckle

  // ---- head ----
  const head = (r, a, b, c) => g.r(hx + a, H(r), b - a + 1, 1, c);
  head(0, 1, hw - 2, skin[2]);
  for (let r = 1; r < headH - 1; r++) head(r, 0, hw - 1, skin[2]);
  head(headH - 1, 1, hw - 2, skin[1]);
  g.r(hx + 1, H(1), 2, 1, skin[3]);
  g.p(hx + hw - 1, H(headH - 2), skin[1]);                                  // cheek shade
  if (race === 'lizardfolk') {                                               // snout forward
    g.r(hx + hw, H(3), 2, 3, skin[2]).r(hx + hw, H(5), 2, 1, skin[1]).p(hx + hw + 1, H(3), skin[1]);
    g.r(hx + 1, H(headH - 1), hw - 1, 1, skin[3]);                            // pale throat
  }
  if (race === 'orcs') head(headH - 1, 0, hw - 1, skin[1]);                 // heavy jaw

  // ---- face ----
  const ex = hx + hw - 4, ey = H(child ? 2 : 3);
  const eyeH = race === 'orcs' ? 1 : 2;
  if (race === 'lizardfolk') { g.p(ex + 1, ey, R.gold[3]).p(ex + 1, ey + 1, INK); }
  else { g.r(ex, ey + (eyeH === 1 ? 1 : 0), 1, eyeH, INK).r(ex + 2, ey + (eyeH === 1 ? 1 : 0), 1, eyeH, INK); }
  if (race === 'orcs') { g.r(ex - 1, ey, 4, 1, skin[0]); g.p(ex + 2, H(headH - 1), R.cream[3]).p(ex - 1, H(headH - 1), R.cream[2]); }
  if (race !== 'lizardfolk' && race !== 'orcs' && role !== 'guard' && !SOLDIER.has(role)) g.p(ex + 3, ey + 2, R.pink[2]);     // blush
  g.p(hx + 1, H(4), skin[1]);                                                 // ear

  // ---- hair ----
  const hair = role === 'noble' && race === 'humans' ? R.hairBlond : role === 'child' && race === 'humans' ? R.hairGinger : HAIR[race];
  const hatted = ['farmer', 'miner', 'merchant', 'guard', 'noble'].includes(role);
  if (hair) {
    if (race === 'orcs') {
      g.r(hx + 2, H(-1), 3, 1, hair[1]).r(hx + 1, H(0), 4, 1, hair[2]).r(hx + 3, H(-2), 1, 1, hair[1]);
    } else {
      head(0, 1, hw - 2, hair[2]);
      head(1, 0, hw - 1, hair[2]);
      head(2, 0, hw - 4, hair[2]);
      g.r(hx, H(3), 2, 2, hair[1]).p(hx, H(5), hair[1]);
      g.r(hx + 2, H(0), 3, 1, hair[3]);
      if (race === 'halflings') for (const x of [1, 3, 5]) g.p(hx + x, H(-1), hair[2]);
      if (race === 'elves') { g.r(hx - 1, H(2), 2, 6, hair[2]).r(hx - 1, H(6), 1, 2, hair[1]); g.p(hx - 1, H(3), skin[2]).p(hx - 2, H(2), skin[2]); }
      g.p(hx + 1, H(4), skin[1]);
    }
  }
  if (race === 'lizardfolk') { for (const x of [1, 3, 5]) g.p(hx + x, H(-1), R.red[2]); g.r(hx + 1, H(0), 5, 1, R.red[1]); }
  if (race === 'dwarves') {                                                   // big beard over the chest
    g.r(hx + 2, H(5), hw - 2, 2, hair[2]).r(bx + 1, bodyTop, bw - 2, 2, hair[2]).r(bx + 2, bodyTop + 2, bw - 4, 1, hair[1]);
    g.r(ex - 1, H(5), 4, 1, hair[3]);
  }
  if (race === 'humans' && role === 'woodcutter') g.r(hx + 3, H(6), hw - 4, 1, hair[1]);

  // ---- hats ----
  if (role === 'farmer') { g.r(hx - 2, H(1), hw + 4, 1, R.straw[2]).r(hx + 1, H(-1), hw - 2, 2, R.straw[2]).r(hx + 1, H(-1), hw - 2, 1, R.straw[3]).r(hx + 1, H(0), hw - 2, 1, R.red[2]); }
  if (role === 'miner') { g.r(hx + 1, H(-1), hw - 2, 1, R.gold[2]).r(hx, H(0), hw, 2, R.gold[2]).r(hx + 1, H(-1), 2, 1, R.gold[3]).r(hx, H(1), hw, 1, R.gold[1]).p(hx + hw - 2, H(0), R.fire[4]); }
  if (role === 'merchant') { g.r(hx, H(1), hw + 1, 1, R.red[1]).r(hx + 1, H(-1), hw - 2, 2, R.red[2]).p(hx + 1, H(-2), R.cream[3]).p(hx, H(-3), R.cream[3]); }
  if (role === 'bow') g.r(hx, H(-1), hw, 3, R.green[2]).r(hx, H(-1), hw - 2, 1, R.green[3]).r(hx - 1, H(2), 2, 4, R.green[1]);
  if (role === 'gun') g.r(hx, H(-1), hw, 2, R.ink[2]).r(hx - 1, H(1), hw + 2, 1, R.ink[2]).p(hx + 3, H(-1), R.gold[2]);
  if (role === 'guard' || role === 'spear') { g.r(hx, H(-1), hw, 3, R.steel[2]).r(hx + 1, H(-1), hw - 3, 1, R.steel[3]).r(hx, H(2), 3, 2, R.steel[1]).p(hx + 3, H(-2), R.red[2]); }
  if (role === 'noble') { for (const x of [1, 3, 5]) g.p(hx + x + (child ? 0 : 0), H(-2), R.gold[3]); g.r(hx + 1, H(-1), hw - 2, 1, R.gold[2]).p(hx + 3, H(-1), R.red[2]); }
  if (role === 'priest' && race !== 'lizardfolk') g.r(hx, H(0), 1, 6, D.shirt[1]).r(hx - 1, H(1), 1, 6, D.shirt[1]); // hood back

  // ---- front arm, tools ----
  const fa = bx + bw;                                                           // front arm column
  const hand = (x, y) => g.p(x, y, skin[2]);
  const sleeve = (x, y, n) => g.r(x, y, 1, n, D.shirt[2]);
  const T = { farmer: 'hoe', woodcutter: 'axe', miner: 'pick', crafter: 'hammer' }[role];
  if (role === 'guard' || role === 'spear') {
    const thrust = f === 4 ? 1 : 0;
    const sx = fa + 1 + thrust;
    g.line(sx, ht - 4, sx, feetY, R.wood[2]).r(sx, ht - 6, 1, 2, R.steel[3]).p(sx, ht - 7, R.steel[4]);
    sleeve(fa, bodyTop, 2); hand(fa + thrust, bodyTop + 2);
  } else if (role === 'bow') {
    const bx2 = fa + 2, by2 = bodyTop - 1, drawn = f === 4;
    for (let dy = -5; dy <= 5; dy++) g.p(bx2 + (Math.abs(dy) < 3 ? 1 : 0) + (Math.abs(dy) < 5 ? 0 : -1), by2 + dy, R.wood[2]);
    g.line(bx2 - (drawn ? 2 : 0), by2, bx2 - 1, by2 - 5, R.cream[3]).line(bx2 - (drawn ? 2 : 0), by2, bx2 - 1, by2 + 5, R.cream[3]);
    if (work) g.line(bx2 - 3, by2, bx2 + 4, by2, R.wood[1]).p(bx2 + 5, by2, R.steel[3]);
    sleeve(fa, bodyTop, 2); hand(fa + 1, by2);
  } else if (role === 'gun') {
    if (work) { g.line(bx, bodyTop + 1, fa + 6, bodyTop + 1, R.wood[1]).line(fa + 2, bodyTop, fa + 7, bodyTop, R.ink[2]); if (f === 4) g.r(fa + 8, bodyTop - 1, 2, 3, R.fire[3]).p(fa + 10, bodyTop, R.fire[4]); sleeve(fa, bodyTop, 2); hand(fa + 1, bodyTop + 1); }
    else { g.line(fa, bodyTop + 3, fa + 3, ht - 3, R.ink[2]).line(fa - 1, bodyTop + 3, fa, bodyTop + 1, R.wood[1]); sleeve(fa, bodyTop + swing, 2); hand(fa, bodyTop + swing + 2); }
  } else if (work && T) {
    const hy = bodyTop + 1;
    sleeve(fa, bodyTop - (up ? 2 : 0), 2); hand(fa + 1, hy - (up ? 3 : -1));
    if (up) {
      const tx = fa + 3, ty = ht - 2;
      g.line(fa + 1, hy - 2, tx, ty, R.wood[2]);
      if (T === 'hoe') g.r(tx, ty, 3, 1, R.steel[2]).p(tx + 2, ty + 1, R.steel[2]);
      if (T === 'axe') g.r(tx, ty - 1, 2, 3, R.steel[2]).p(tx + 1, ty - 1, R.steel[3]);
      if (T === 'pick') g.r(tx - 2, ty, 5, 1, R.steel[2]).p(tx - 2, ty + 1, R.steel[1]).p(tx + 2, ty + 1, R.steel[1]);
      if (T === 'hammer') g.r(tx - 1, ty - 1, 3, 2, R.steel[2]).r(tx - 1, ty - 1, 3, 1, R.steel[3]);
    } else {
      const tx = fa + 5, ty = feetY - 1;
      g.line(fa + 1, hy + 1, tx, ty - 1, R.wood[2]);
      if (T === 'hoe') g.r(tx, ty - 1, 1, 3, R.steel[2]);
      if (T === 'axe') g.r(tx, ty - 1, 2, 2, R.steel[2]).p(tx + 1, ty, R.steel[3]);
      if (T === 'pick') g.r(tx, ty - 2, 1, 3, R.steel[2]).p(tx - 1, ty - 3, R.steel[1]);
      if (T === 'hammer') g.r(tx - 1, ty - 1, 3, 2, R.steel[2]).r(tx - 1, ty - 1, 3, 1, R.steel[3]);
    }
  } else if (work && role === 'merchant') {
    sleeve(fa, bodyTop - 1, 2); hand(fa, bodyTop - 2); g.r(fa + 1, bodyTop - 3, 2, 2, R.gold[2]).p(fa + 1, bodyTop - 3, R.gold[3]);
  } else if (work && role === 'priest') {
    sleeve(fa, bodyTop - 1, 2); hand(fa, bodyTop - 2); g.r(fa + 1, bodyTop - 4, 1, 3, R.gold[2]).r(fa, bodyTop - 3, 3, 1, R.gold[2]);
  } else if (work && (role === 'child' || role === 'noble')) {
    sleeve(fa, bodyTop - 2, 2); hand(fa, bodyTop - (up ? 4 : 3));
  } else if (work && role === 'hauler') {
    sleeve(fa, bodyTop, 2); hand(fa, bodyTop + 2); g.r(fa + 1, bodyTop + 1, 3, 3, R.wood[2]).r(fa + 1, bodyTop + 1, 3, 1, R.wood[3]);
  } else if (carryUp) {
    // crate held on the head with both hands
    const cy = ht - 4, cx = hx;
    g.r(cx, cy, hw, 4, R.wood[2]).r(cx, cy, hw, 1, R.wood[3]).r(cx, cy + 3, hw, 1, R.wood[1]).line(cx + 1, cy + 1, cx + hw - 2, cy + 2, R.wood[1]);
    g.r(hx - 1, ht - 1, 1, 3, D.shirt[1]).r(fa, ht - 1, 1, 3, D.shirt[2]).p(hx - 1, ht - 1, skin[2]).p(fa, ht - 1, skin[2]);
  } else {
    sleeve(fa, bodyTop + swing, armRows - 1); hand(fa, bodyTop + swing + armRows - 1);
    if (role === 'merchant') g.r(bx + 1, bodyBot - 1, 2, 2, R.wood[2]).p(bx + 1, bodyBot - 1, R.gold[3]);  // coin pouch
  }

  if (role === 'spear') g.r(bx - 2, bodyTop, 4, 5, KEY[2]).r(bx - 2, bodyTop, 4, 1, KEY[3]).r(bx - 2, bodyTop + 4, 4, 1, KEY[1]).p(bx - 1, bodyTop + 2, R.gold[3]).p(bx, bodyTop + 2, R.gold[3]);
  g.outline(INK);
  return g;
}

const SOLDIER = new Set(['spear', 'bow', 'gun']);
export function soldiers(race) {
  const frames = [], tags = [];
  for (const role of SOLDIER) {
    const s = frames.length;
    for (let f = 0; f < 7; f++) frames.push(townsfolkFrame(race, role, f));
    tags.push([`${role}_walk`, s, s + 3, 140], [`${role}_work`, s + 4, s + 5, 220], [`${role}_idle`, s + 6, s + 6, 500]);
  }
  return { frames, tags, layer: 'soldier' };
}

export function townsfolk(race) {
  const frames = [], tags = [];
  for (const role of ROLES) {
    const s = frames.length;
    for (let f = 0; f < 7; f++) frames.push(townsfolkFrame(race, role, f));
    tags.push([`${role}_walk`, s, s + 3, 140], [`${role}_work`, s + 4, s + 5, 220], [`${role}_idle`, s + 6, s + 6, 500]);
  }
  return { frames, tags, layer: 'villager' };
}
