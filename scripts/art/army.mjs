// soldier_<race> (spear / bow / gun, from townsfolk.mjs), cavalry_<race> (32×32: light_ride,
// light_idle, heavy_ride, heavy_idle), siege_engine (32×32: catapult, catapult_fire, cannon,
// cannon_fire), creature_{dragon,wyvern,giant,troll} (64×64: fly or walk, idle), lair (32×32),
// caravan (32×32: move). Riders' tunics use the KEY colours (tinted with the realm colour).
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';
import { KEY } from './kit.mjs';
import { townsfolkFrame, soldiers } from './townsfolk.mjs';
import { animalFrame } from './animals.mjs';

export { soldiers };
const SHADOW = '#241a2448';
function shadow(g, cx, cy, rx, ry = 1.5) { const s = new Pix(g.w, g.h); s.ellipse(cx, cy, rx, ry, SHADOW); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!g.alpha(x, y) && s.alpha(x, y)) g.p(x, y, SHADOW); return g; }
function tri(g, a, b, c, col) {
  const [x0, x1] = [Math.min(a[0], b[0], c[0]), Math.max(a[0], b[0], c[0])], [y0, y1] = [Math.min(a[1], b[1], c[1]), Math.max(a[1], b[1], c[1])];
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
    const p = [x + 0.5, y + 0.5], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g.p(x, y, col);
  }
  return g;
}

// ---------------- cavalry ----------------
function cavalryFrame(race, heavy, k, riding) {
  const g = new Pix(32, 32);
  const horse = animalFrame('horse', riding ? 'walk' : 'idle', riding ? k : 0);
  if (heavy) horse.recolor([[R.wood[0], R.steel[1]], [R.wood[1], R.steel[2]], [R.wood[2], R.steel[3]], [R.wood[3], R.steel[4]]]);
  g.draw(horse);
  // the rider: the soldier's upper half, seated on the horse's back
  const rider = townsfolkFrame(race, 'spear', 6);
  const seatY = riding && (k === 1 || k === 3) ? 16 : 17;
  for (let y = 0; y < 27; y++) for (let x = 0; x < 32; x++) {
    const c = rider.get(x, y); if (!c) continue;
    const dy = y - 27 + seatY, dx = x - 3;
    if (dy >= 0 && dy < 32 && dx >= 0) g.p(dx, dy, c);
  }
  if (heavy) g.r(10, 19, 9, 2, KEY[2]).r(10, 19, 9, 1, KEY[3]);                       // barding cloth
  g.r(12, seatY + 1, 3, 2, R.brown[1]);                                                 // saddle / leg
  return g;
}

// ---------------- siege engines ----------------
function siegeFrame(cannon, fire) {
  const g = new Pix(32, 32);
  for (const x of [9, 21]) g.ellipse(x, 27, 3, 3, R.wood[1]), g.p(x, 27, R.wood[3]);
  if (cannon) {
    g.r(8, 21, 16, 4, R.wood[2]).r(8, 21, 16, 1, R.wood[3]);
    g.r(10, 16, 16, 5, R.ink[2]).r(10, 16, 16, 1, R.steel[2]).r(24, 15, 3, 7, R.ink[1]).r(8, 17, 3, 3, R.ink[2]);
    if (fire) g.r(27, 15, 3, 6, R.fire[3]).r(29, 16, 3, 4, R.fire[4]).p(26, 13, R.stone[3]).p(28, 12, R.stone[3]);
  } else {
    g.r(5, 22, 22, 3, R.wood[2]).r(5, 22, 22, 1, R.wood[3]);
    g.r(14, 12, 3, 10, R.wood[1]).r(12, 20, 7, 2, R.wood[0]);
    const tipX = fire ? 26 : 8, tipY = fire ? 6 : 11;
    g.line(16, 18, tipX, tipY, R.wood[2]).line(16, 19, tipX, tipY + 1, R.wood[1]);
    g.ellipse(tipX, tipY - 1, 2, 1.5, R.wood[0]); if (!fire) g.ellipse(tipX, tipY - 2, 1.5, 1.5, R.stone[3]);
    g.line(16, 18, 22, 22, R.cream[2]);
  }
  g.outline(INK);
  return shadow(g, 16, 30, 12);
}

// ---------------- creatures (64×64, facing right) ----------------
function winged(k, { body, belly, wing, size = 1, horns = true, arms = true }) {
  const g = new Pix(64, 64);
  const S = (v) => Math.round(v * size), cx = 30, cy = 36;
  const flap = [[-26, -26], [-8, -30], [14, -12], [-8, -30]][k % 4];               // wing tip relative to the shoulder
  const sh = [cx + S(2), cy - S(4)], rear = [cx - S(10), cy - S(2)];
  const tip = [sh[0] + S(flap[0] * 0.5), sh[1] + S(flap[1])];
  // far wing (darker)
  tri(g, [sh[0] + 3, sh[1]], [tip[0] + 5, tip[1] + 2], [rear[0] + 6, rear[1]], wing[0]);
  // tail
  for (let i = 0; i < 16; i++) { const t = i / 15, x = cx - S(10) - S(16) * t, y = cy + S(2) + Math.sin(t * 3) * S(4); g.ellipse(x, y, Math.max(0.6, S(3) * (1 - t)), Math.max(0.6, S(2.5) * (1 - t)), body[1]); }
  tri(g, [cx - S(27), cy + S(4)], [cx - S(31), cy], [cx - S(30), cy + S(8)], body[2]);
  // body
  g.ellipse(cx, cy, S(12), S(6.5), body[2]);
  g.over((x, y) => y < cy - S(3) && Math.abs(x - cx) < S(12), body[3]);
  g.over((x, y) => y > cy + S(2) && Math.abs(x - cx) < S(11), belly);
  // legs
  if (arms) g.r(cx + S(5), cy + S(5), S(3), S(4), body[1]).p(cx + S(7), cy + S(9), R.cream[3]);
  g.r(cx - S(6), cy + S(5), S(3), S(5), body[1]).p(cx - S(4), cy + S(10), R.cream[3]);
  // neck and head
  for (let i = 0; i <= 10; i++) { const t = i / 10; g.ellipse(cx + S(9) + S(8) * t, cy - S(3) - S(10) * t, S(3), S(3), body[2]); }
  const hx = cx + S(17), hy = cy - S(16);
  g.ellipse(hx + S(3), hy, S(5), S(3), body[2]); g.r(hx + S(3), hy + 1, S(5), S(2), belly); g.p(hx + S(2), hy - 1, R.gold[3]).p(hx + S(3), hy - 1, INK);
  if (horns) g.line(hx - S(1), hy - S(2), hx - S(4), hy - S(6), R.cream[3]).line(hx + S(1), hy - S(3), hx - S(1), hy - S(7), R.cream[2]);
  for (let i = 0; i < 5; i++) g.p(cx - S(8) + i * S(4), cy - S(7), body[0]);                // back spikes
  // near wing
  tri(g, sh, tip, rear, wing[2]);
  tri(g, sh, [tip[0], tip[1]], [sh[0] - S(4), sh[1] + S(2)], wing[3]);
  g.line(sh[0], sh[1], tip[0], tip[1], wing[0]);
  for (const f of [0.35, 0.65]) g.line(sh[0], sh[1], Math.round(tip[0] + (rear[0] - tip[0]) * f), Math.round(tip[1] + (rear[1] - tip[1]) * f), wing[1]);
  g.outline(INK);
  return g;
}
function brute(k, { skin, cloth, club, hunch = 0, tusks = false, beard = null }) {
  const g = new Pix(64, 64);
  const step = [2, 0, -2, 0][k % 4], bob = k % 2 ? -1 : 0;
  const top = 14 + hunch + bob, hipY = 42 + bob;
  // legs
  g.r(26 + step, hipY, 5, 61 - hipY, skin[1]).r(34 - step, hipY, 5, 61 - hipY, skin[2]);
  g.r(25 + step, 59, 7, 2, R.brown[1]).r(33 - step, 59, 7, 2, R.brown[1]);
  // body
  g.ellipse(32 + hunch, top + 17, 11, 13, cloth[2]);
  g.over((x, y) => y < top + 10, skin[2]);
  g.r(22 + hunch, hipY - 6, 21, 6, cloth[1]).r(22 + hunch, hipY - 6, 21, 1, cloth[3]);
  g.over((x, y) => x < 27 + hunch && y > top + 4, cloth[3]);
  // back arm
  g.r(20 + hunch, top + 8, 4, 18 + hunch, skin[1]);
  // head
  const hx = 34 + hunch * 2, hy = top - 6 + hunch;
  g.ellipse(hx, hy, 6, 6, skin[2]); g.r(hx - 4, hy - 5, 6, 2, skin[3]);
  g.p(hx + 2, hy - 1, INK).p(hx + 4, hy - 1, INK).r(hx + 1, hy - 2, 5, 1, skin[0]);
  if (tusks) g.p(hx + 2, hy + 3, R.cream[3]).p(hx + 5, hy + 3, R.cream[3]);
  if (beard) g.ellipse(hx + 1, hy + 5, 5, 4, beard[2]).r(hx - 3, hy - 7, 9, 2, beard[2]);
  // front arm and club
  const swing = k === 1 ? -3 : k === 3 ? 3 : 0;
  g.r(42 + hunch, top + 8 + swing, 5, 16 + hunch, skin[2]).r(42 + hunch, top + 8 + swing, 1, 16, skin[3]);
  const cx0 = 46 + hunch, cy0 = top + 24 + hunch + swing;
  g.line(cx0, cy0, cx0 + 8, cy0 - 14, club[1]).line(cx0 + 1, cy0, cx0 + 9, cy0 - 14, club[2]);
  g.ellipse(cx0 + 9, cy0 - 16, 3, 4, club[2]); g.p(cx0 + 8, cy0 - 18, club[3]);
  g.outline(INK);
  return shadow(g, 32, 61, 14, 2);
}

const DRAGON = { body: R.red, belly: R.ochre[3], wing: [R.red[0], R.red[1], R.red[2], R.ochre[2]] };
const WYVERN = { body: R.green, belly: R.straw[3], wing: [R.green[0], R.green[1], R.teal[2], R.teal[3]], size: 0.8, horns: false, arms: false };
const GIANT = { skin: R.skinDwarf, cloth: R.brown, club: R.wood, beard: R.hairBrown };
const TROLL = { skin: ['#2a3a32', '#4a5e4a', '#6e8064', '#94a684'], cloth: R.soil, club: R.stone, hunch: 3, tusks: true };

// ---------------- lair and caravan ----------------
function lair() {
  const g = new Pix(32, 32);
  g.ellipse(16, 27, 15, 13, R.stone[2]); g.over((x, y) => y > 27, null); for (let y = 28; y < 32; y++) for (let x = 0; x < 32; x++) g.clear(x, y);
  g.over((x, y) => (x * 5 + y * 3) % 11 === 0, R.stone[1]); g.over((x, y) => y < 18 && x < 16, R.stone[3]);
  g.ellipse(16, 27, 6, 7, R.ink[0]); for (let x = 0; x < 32; x++) g.clear(x, 28);
  g.r(5, 25, 3, 1, R.cream[3]).p(6, 24, R.cream[3]).r(24, 26, 4, 1, R.cream[3]).p(27, 25, R.cream[2]);
  g.p(14, 24, R.gold[3]).p(17, 25, R.gold[2]).p(15, 26, R.gold[3]);
  g.outline(INK);
  return shadow(g, 16, 28, 14);
}
function caravan(k) {
  const g = new Pix(32, 32);
  const ox = animalFrame('horse', 'walk', k * 2);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = ox.get(x, y); if (c && x + 4 < 32) g.p(x + 4, y, c); }
  g.r(1, 17, 16, 8, R.wood[2]).r(1, 17, 16, 1, R.wood[3]).r(1, 24, 16, 1, R.wood[0]);
  g.ellipse(9, 16, 8, 6, R.cream[2]); g.over((x, y) => y > 17 && x < 18 && x > 0 && g.get(x, y) && y < 18, R.cream[1]);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const c = g.get(x, y); if (c && y < 17 && y > 9) g.p(x, y, x % 5 === 0 ? R.cream[1] : y < 13 ? R.cream[3] : R.cream[2]); }
  g.line(16, 22, 18, 22, R.wood[1]);
  for (const x of [5, 13]) { g.ellipse(x, 26, 3, 3, R.wood[1]); g.p(x, 26, R.wood[3]).p(x + (k ? 1 : 0), 24 + (k ? 1 : 0), R.wood[0]); }
  g.outline(INK);
  return shadow(g, 14, 29, 13);
}

const RACES = ['humans', 'elves', 'dwarves', 'orcs', 'lizardfolk', 'halflings'];
export const ARMY = {};
for (const r of RACES) {
  ARMY['soldier_' + r] = () => soldiers(r);
  ARMY['cavalry_' + r] = () => {
    const frames = [], tags = [];
    for (const heavy of [false, true]) {
      const n = heavy ? 'heavy' : 'light', a = frames.length;
      for (let k = 0; k < 4; k++) frames.push(cavalryFrame(r, heavy, k, true));
      frames.push(cavalryFrame(r, heavy, 0, false));
      tags.push([n + '_ride', a, a + 3, 120], [n + '_idle', a + 4, a + 4, 500]);
    }
    return { frames, tags, layer: 'cavalry' };
  };
}
ARMY.siege_engine = () => ({ frames: [siegeFrame(false, false), siegeFrame(false, true), siegeFrame(true, false), siegeFrame(true, true)], tags: [['catapult', 0, 1, 300], ['cannon', 2, 3, 300]], layer: 'siege' });
for (const [id, spec, fly] of [['creature_dragon', DRAGON, true], ['creature_wyvern', WYVERN, true], ['creature_giant', GIANT, false], ['creature_troll', TROLL, false]]) {
  ARMY[id] = () => {
    const draw = (k) => (fly ? winged(k, spec) : brute(k, spec));
    return { frames: [0, 1, 2, 3].map(draw).concat([draw(0)]), tags: [[fly ? 'fly' : 'walk', 0, 3, fly ? 150 : 220], ['idle', 4, 4, 800]], layer: id.slice(9) };
  };
}
ARMY.lair = () => ({ frames: [lair()], tags: [], layer: 'lair' });
ARMY.caravan = () => ({ frames: [caravan(0), caravan(1)], tags: [['move', 0, 1, 200]], layer: 'caravan' });
