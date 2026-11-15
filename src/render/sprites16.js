// Phase 13 — animated pixel sprites for people and animals (close-up view).
// People are 8×11 px (drawn at half scale: 4×5.5 world px), animals ~12×9.
import { RACES } from '../data/races.js';
import { makeCanvas } from './sprites.js';
import { ramp } from './tiles16.js';

const cache = new Map();
const css = (c) => (typeof c === 'string' ? c : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
function sheet(w, h, draw) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const P = (px, py, pw = 1, ph = 1, col = '#000') => { x.fillStyle = css(col); x.fillRect(px, py, pw, ph); };
  draw(P);
  // outline
  const d = x.getImageData(0, 0, w, h);
  const a = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : d.data[(py * w + px) * 4 + 3]);
  const out = [];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (a(px, py) < 60 && (a(px + 1, py) > 200 || a(px - 1, py) > 200 || a(px, py + 1) > 200 || a(px, py - 1) > 200)) out.push((py * w + px) * 4);
  for (const o of out) { d.data[o] = 30; d.data[o + 1] = 20; d.data[o + 2] = 26; d.data[o + 3] = 220; }
  x.putImageData(d, 0, 0);
  return c;
}
function mirror(c) { const m = makeCanvas(c.width, c.height); const x = m.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return m; }

// look: { body, hat, legs, tool, carry, shield, gun, bow, helm }
// frame: 0..3 walk, 4..5 work, 6 idle; dir: 1 right, -1 left
export function personSprite(race, look, frame, dir) {
  const key = `p:${race}:${look.body}:${look.hat}:${look.legs}:${look.tool}:${look.carry}:${look.shield}:${look.bow}:${look.gun}:${look.helm}:${look.small}:${frame}`;
  let pair = cache.get(key);
  if (!pair) {
    const R = RACES[race] || RACES.humans;
    const skin = ramp(R.skin);
    const body = ramp(look.body || '#8a6a3a');
    const legs = look.legs || '#3b2a1e';
    const short = race === 'dwarves' || race === 'halflings' || look.small;
    const c = sheet(10, 12, (P) => {
      const oy = short ? 2 : 0;
      const walk = frame < 4 ? [0, 1, 0, -1][frame] : 0;
      const work = frame === 4 ? -1 : frame === 5 ? 1 : 0;
      // legs
      P(3 + (walk > 0 ? 1 : 0), 9, 1, 2 - (walk < 0 ? 1 : 0), legs);
      P(5 - (walk < 0 ? 1 : 0), 9, 1, 2 - (walk > 0 ? 1 : 0), legs);
      if (race !== 'halflings') { P(3 + (walk > 0 ? 1 : 0), 10, 1, 1, '#1e140e'); P(5 - (walk < 0 ? 1 : 0), 10, 1, 1, '#1e140e'); }
      // body
      P(3, 5 + oy, 3, 4 - oy, body.mid); P(3, 5 + oy, 1, 4 - oy, body.lt); P(5, 5 + oy, 1, 4 - oy, body.dk);
      P(3, 8, 3, 1, body.dk2);
      // arms (swing)
      P(2, 5 + oy + (walk > 0 ? 1 : 0), 1, 3, skin.mid); P(6, 5 + oy + (walk < 0 ? 1 : 0) + work, 1, 3, skin.dk);
      // head
      const hy = 2 + oy;
      P(3, hy, 3, 3, skin.mid); P(3, hy, 1, 3, skin.lt); P(5, hy + 1, 1, 1, '#1a1010');
      if (race === 'elves') P(2, hy, 1, 1, skin.mid);
      if (race === 'orcs') { P(5, hy + 2, 1, 1, '#f0ead8'); }
      if (race === 'lizardfolk') { P(6, hy + 1, 1, 2, skin.mid); P(1, 8, 2, 1, skin.dk); P(3, hy - 1, 1, 1, '#c94a3a'); }
      if (race === 'dwarves') { P(3, hy + 2, 3, 2, '#8a5a30'); P(4, hy + 4, 2, 1, '#8a5a30'); }
      // hair or hat / helm
      if (look.helm) { P(3, hy - 1, 3, 2, look.helm); P(2, hy, 1, 1, ramp(look.helm).dk); }
      else if (look.hat) P(2, hy - 1, 5, 1, look.hat), P(3, hy - 2, 3, 1, look.hat);
      else if (race !== 'lizardfolk' && race !== 'orcs') P(3, hy - 1, 3, 1, race === 'elves' ? '#e8d8a0' : race === 'halflings' ? '#7a4a2a' : '#5a3a22');
      // tools and gear
      const t = look.tool;
      if (t === 'spear') { P(7, 0, 1, 10, '#8a6a44'); P(7, 0, 1, 1, '#d8dee4'); }
      else if (t === 'axe' || t === 'pick' || t === 'hoe' || t === 'hammer') {
        const up = work < 0;
        P(7, up ? 2 : 5, 1, 4, '#8a6a44');
        P(t === 'axe' ? 7 : 6, up ? 1 : 4, t === 'hammer' ? 2 : 2, t === 'axe' ? 2 : 1, t === 'hoe' ? '#9aa0a6' : '#b8c0c8');
      }
      if (look.bow) { P(7, 3, 1, 6, '#7a5530'); P(8, 4, 1, 4, '#d8d0c0'); }
      if (look.gun) { P(6, 6, 3, 1, '#3a3a40'); P(7, 7, 1, 1, '#6a4a2a'); }
      if (look.shield) { P(1, 5 + oy, 2, 4, look.shield); P(1, 5 + oy, 2, 1, ramp(look.shield).lt); }
      if (look.carry) { P(2, hy - 3, 5, 2, look.carry); P(2, hy - 3, 5, 1, ramp(look.carry).lt); }
    });
    pair = [c, mirror(c)];
    cache.set(key, pair);
  }
  return dir < 0 ? pair[1] : pair[0];
}

// Animals: deer, boar, goat, wolf, bear, sheep, cow, horse
const BEAST = {
  deer: { body: '#a0714a', head: '#a0714a', legs: '#5a3a22', w: 9, h: 4, tail: '#f2ece0', antlers: true },
  boar: { body: '#5b4636', head: '#4a3a2c', legs: '#2a1e16', w: 8, h: 4, tusks: true },
  goat: { body: '#e6e0d4', head: '#d8d2c6', legs: '#8a8276', w: 7, h: 4, horns: true },
  wolf: { body: '#8a929c', head: '#7d8590', legs: '#4a5058', w: 9, h: 3, ears: true, tail: '#6a7078' },
  bear: { body: '#4a3424', head: '#3d2b1f', legs: '#2a1c12', w: 10, h: 5 },
  sheep: { body: '#f4f0e6', head: '#3a3330', legs: '#3a3330', w: 7, h: 4, fluffy: true },
  cow: { body: '#f4f0e8', head: '#f4f0e8', legs: '#5a4a3a', w: 9, h: 4, spots: '#3a2a20' },
  horse: { body: '#7a4e2e', head: '#7a4e2e', legs: '#3a2a1e', w: 10, h: 4, mane: '#3a2216', tail: '#3a2216' },
  warhorse: { body: '#d8d8d8', head: '#d8d8d8', legs: '#5a5a5a', w: 10, h: 4, mane: '#8a8a8a', tail: '#8a8a8a' },
};
export function animalSprite(kind, frame, dir) {
  const key = `a:${kind}:${frame}`;
  let pair = cache.get(key);
  if (!pair) {
    const A = BEAST[kind] || BEAST.deer;
    const W = 14, H = 11;
    const c = sheet(W, H, (P) => {
      const b = ramp(A.body);
      const x0 = 2, y0 = 10 - 2 - A.h;
      const st = frame % 2;
      // legs
      for (const [lx, ph] of [[x0, 0], [x0 + 2, 1], [x0 + A.w - 3, 1], [x0 + A.w - 1, 0]]) P(lx + (st === ph ? 1 : 0), y0 + A.h, 1, 2, A.legs);
      // body
      P(x0, y0, A.w, A.h, b.mid); P(x0, y0, A.w, 1, b.lt); P(x0, y0 + A.h - 1, A.w, 1, b.dk);
      if (A.fluffy) for (let i = 0; i < A.w; i += 2) P(x0 + i, y0 - 1, 1, 1, b.lt);
      if (A.spots) { P(x0 + 2, y0 + 1, 2, 2, A.spots); P(x0 + 6, y0, 1, 2, A.spots); }
      if (A.tail) P(x0 - 1, y0 + 1, 1, 2, A.tail);
      // head (to the right)
      const hx = x0 + A.w - 1, hy = y0 - 2;
      P(hx, hy, 3, 3, A.head); P(hx + 2, hy + 2, 1, 1, ramp(A.head).dk); P(hx + 1, hy + 1, 1, 1, '#111');
      if (A.mane) P(hx - 1, hy, 2, 3, A.mane);
      if (A.antlers) { P(hx, hy - 2, 1, 2, '#d8c8a0'); P(hx + 2, hy - 2, 1, 2, '#d8c8a0'); P(hx - 1, hy - 3, 1, 1, '#d8c8a0'); P(hx + 3, hy - 3, 1, 1, '#d8c8a0'); }
      if (A.ears) { P(hx, hy - 1, 1, 1, A.head); P(hx + 2, hy - 1, 1, 1, A.head); }
      if (A.horns) P(hx, hy - 1, 2, 1, '#9a9080');
      if (A.tusks) P(hx + 3, hy + 2, 1, 1, '#f0ead8');
    });
    pair = [c, mirror(c)];
    cache.set(key, pair);
  }
  return dir < 0 ? pair[1] : pair[0];
}

// ---------------- Phase 20: small townsfolk and farm animals ----------------
// Townsfolk are 7×9 px (3.5×4.5 world px, about half a house): small and readable, like the
// people of a real town seen from the hills. Frames: 0..3 walk, 4..5 work, 6 idle.
export function tinyPerson(race, look, frame, dir) {
  const key = `tp:${race}:${look.body}:${look.hat}:${look.tool}:${look.carry}:${look.small}:${look.shield}:${look.bow}:${look.gun}:${frame}`;
  let pair = cache.get(key);
  if (!pair) {
    const R = RACES[race] || RACES.humans;
    const skin = ramp(R.skin), body = ramp(look.body || '#8a6a3a');
    const short = race === 'dwarves' || race === 'halflings' || look.small;
    const c = makeCanvas(7, 9), x = c.getContext('2d');
    const P = (px, py, pw, ph, col) => { x.fillStyle = css(col); x.fillRect(px, py, pw, ph); };
    const o = short ? 1 : 0; // short folk: head and body one pixel lower
    const walk = frame < 4 ? [0, 1, 0, -1][frame] : 0, work = frame === 4 ? -1 : frame === 5 ? 1 : 0;
    // feet
    P(2 + (walk > 0 ? 1 : 0), 8, 1, 1, '#2a1c14'); P(4 - (walk < 0 ? 1 : 0), 8, 1, 1, '#2a1c14');
    // body (tunic) with lit and shaded sides
    P(2, 4 + o, 3, 4 - o, body.mid); P(2, 4 + o, 1, 4 - o, body.lt); P(4, 4 + o, 1, 4 - o, body.dk);
    // arms
    P(1, 4 + o + (walk > 0 ? 1 : 0), 1, 2, skin.mid); P(5, 4 + o + (walk < 0 ? 1 : 0) + (work > 0 ? 1 : 0), 1, 2, skin.dk);
    // head
    P(2, 2 + o, 3, 2, skin.mid); P(2, 2 + o, 1, 2, skin.lt); P(4, 3 + o, 1, 1, '#1a1010');
    if (race === 'orcs') P(3, 3 + o, 1, 1, '#f0ead8');
    if (race === 'dwarves') P(2, 4 + o, 3, 1, '#8a5a30');
    if (race === 'lizardfolk') P(5, 3 + o, 1, 1, skin.mid);
    // hair / hat
    if (look.hat) { P(1, 1 + o, 5, 1, look.hat); P(2, o, 3, 1, look.hat); }
    else if (race !== 'lizardfolk' && race !== 'orcs') P(2, 1 + o, 3, 1, race === 'elves' ? '#e8d8a0' : race === 'halflings' ? '#7a4a2a' : '#5a3a22');
    // tool or load
    const t = look.tool;
    if (t === 'spear') { P(6, 0, 1, 8, '#8a6a44'); P(6, 0, 1, 1, '#d8dee4'); }
    else if (t) { P(6, work < 0 ? 1 : 3, 1, 4, '#8a6a44'); P(5, work < 0 ? 1 : 3, 2, 1, '#b8c0c8'); }
    if (look.carry) { P(1, o - 0, 5, 1, look.carry); }
    if (look.shield) { P(0, 4 + o, 2, 3, look.shield); P(0, 4 + o, 2, 1, ramp(look.shield).lt); }
    if (look.bow) { P(6, 2, 1, 5, '#7a5530'); }
    if (look.gun) { P(4, 5 + o, 3, 1, '#3a3a40'); }
    pair = [c, mirror(c)];
    cache.set(key, pair);
  }
  return dir < 0 ? pair[1] : pair[0];
}

// Farm animals at town scale (10×7 px = 5×3.5 world px). Frames: 0..1 walk, 2 grazing (head down).
const FARM = {
  sheep: { body: '#f4f0e6', head: '#3a3330', legs: '#3a3330', w: 5, h: 3, fluffy: true },
  cow: { body: '#f4f0e8', head: '#f4f0e8', legs: '#5a4a3a', w: 6, h: 3, spots: '#3a2a20' },
  pig: { body: '#e8a8a0', head: '#e8a8a0', legs: '#b07068', w: 5, h: 3, snout: '#c87878' },
  goat: { body: '#d8d0c0', head: '#c8c0b0', legs: '#6a6256', w: 5, h: 2, horns: true },
  horse: { body: '#7a4e2e', head: '#7a4e2e', legs: '#3a2a1e', w: 6, h: 3, mane: '#3a2216' },
  chicken: { body: '#f6f2ea', head: '#f6f2ea', legs: '#e0a030', w: 2, h: 2, comb: '#d83a2a' },
  dog: { body: '#a8784a', head: '#a8784a', legs: '#6a4a2a', w: 4, h: 2, tail: '#8a5a32' },
};
export function farmAnimal(kind, frame, dir) {
  const key = `fa:${kind}:${frame}`;
  let pair = cache.get(key);
  if (!pair) {
    const A = FARM[kind] || FARM.sheep;
    const c = makeCanvas(10, 7), x = c.getContext('2d');
    const P = (px, py, pw, ph, col) => { x.fillStyle = css(col); x.fillRect(px, py, pw, ph); };
    const b = ramp(A.body);
    const x0 = 1, y0 = 6 - A.h - 1;
    const st = frame === 1;
    // legs
    if (kind === 'chicken') { P(x0 + (st ? 1 : 0), 6, 1, 1, A.legs); }
    else for (const [lx, ph] of [[x0, 0], [x0 + A.w - 1, 1]]) P(lx + (st === !!ph ? 1 : 0) - (lx > x0 && st === !!ph ? 1 : 0), y0 + A.h, 1, 6 - y0 - A.h + 1, A.legs);
    // body: top lit, belly shaded
    P(x0, y0, A.w, A.h, b.mid); P(x0, y0, A.w, 1, b.lt); P(x0, y0 + A.h - 1, A.w, 1, b.dk);
    if (A.fluffy) { P(x0 + 1, y0 - 1, A.w - 2, 1, b.lt); }
    if (A.spots) { P(x0 + 1, y0 + 1, 2, 1, A.spots); P(x0 + 4, y0, 1, 1, A.spots); }
    if (A.tail) P(x0 - 1, y0 - 1, 1, 2, A.tail);
    if (A.mane) P(x0 + A.w - 2, y0 - 1, 2, 1, A.mane);
    // head: up, or down to the grass when grazing
    const graze = frame === 2;
    const hx = x0 + A.w, hy = graze ? y0 + A.h - 1 : y0 - 1;
    P(hx, hy, 2, 2, A.head); P(hx + 1, hy, 1, 1, '#111');
    if (A.snout) P(hx + 1, hy + 1, 1, 1, A.snout);
    if (A.horns) P(hx, hy - 1, 1, 1, '#9a9080');
    if (A.comb) P(hx, hy - 1, 1, 1, A.comb);
    if (kind === 'chicken') P(hx + 2, hy + 1, 1, 1, '#e0a030');
    // a dark rim along the bottom edge only, so they sit on the grass
    pair = [c, mirror(c)];
    cache.set(key, pair);
  }
  return dir < 0 ? pair[1] : pair[0];
}
