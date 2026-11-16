// livestock_<kind> and wildlife_<species>: side-view animals facing right on a 32×32 canvas,
// hooves on row 30 (outline on 31), centred on x = 16. Built from shaded parts (body, legs, neck,
// head) plus each species' features. Tags: walk (4), idle (2), graze (2, livestock only).
import { Pix } from './pix.mjs';
import { R, INK } from './palette.mjs';

// shade a part: light on top, dark underneath, by row inside its own bounding box
function shaded(w, h, fill, ramp, { top = 0.3, bottom = 0.72 } = {}) {
  const l = new Pix(w, h); fill(l);
  let y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (l.alpha(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const span = Math.max(1, y1 - y0);
  return l.over((x, y) => true, ramp[2]).over((x, y) => (y - y0) / span <= top, ramp[3]).over((x, y) => (y - y0) / span >= bottom, ramp[1]);
}

const SPECIES = {
  // ---- livestock (about 20×14 inside the canvas) ----
  sheep: { rx: 7, ry: 4.5, leg: 3, legW: 1, legC: R.ink[2], hoof: R.ink[1], body: R.cream, wool: true, head: R.hairBlack, hw: 4, hh: 4, neck: [1, 2], ear: true },
  cow: { rx: 8.5, ry: 4.5, leg: 4, legW: 2, legC: R.cream[2], hoof: R.ink[2], body: R.white, spots: R.hairBlack, head: R.white, hw: 5, hh: 4, neck: [0, 1], horns: R.cream[3], muzzle: R.pink[3], udder: R.pink[2], tail: R.white[1] },
  pig: { rx: 7, ry: 4, leg: 2, legW: 2, legC: R.pink[2], hoof: R.pink[0], body: R.pink, head: R.pink, hw: 5, hh: 4, neck: [-1, 0], snout: R.pink[1], curl: true, ear: true },
  goat: { rx: 6, ry: 3.5, leg: 4, legW: 1, legC: R.stone[2], hoof: R.ink[2], body: R.cream, head: R.cream, hw: 4, hh: 4, neck: [1, 3], horns: R.stone[1], beard: R.cream[1], tail: R.cream[3] },
  horse: { rx: 8, ry: 4, leg: 6, legW: 2, legC: R.wood[1], hoof: R.ink[1], body: R.wood, head: R.wood, hw: 6, hh: 4, neck: [2, 5], mane: R.hairBlack[2], tailLong: R.hairBlack[2], muzzle: R.wood[0], blaze: R.cream[3] },
  chicken: { rx: 3.5, ry: 3, leg: 2, legW: 1, legC: R.gold[2], hoof: R.gold[1], body: R.white, head: R.white, hw: 3, hh: 3, neck: [0, 2], comb: R.red[2], beak: R.gold[2], feathers: true, small: true },
  dog: { rx: 5.5, ry: 3, leg: 4, legW: 1, legC: R.ochre[1], hoof: R.wood[0], body: R.ochre, head: R.ochre, hw: 5, hh: 4, neck: [1, 2], earFlop: R.wood[1], tailUp: R.ochre[2], muzzle: R.cream[3] },
  // ---- wildlife (about 26×20) ----
  deer: { rx: 8, ry: 4, leg: 7, legW: 1, legC: R.wood[2], hoof: R.ink[1], body: R.ochre, belly: R.cream[3], head: R.ochre, hw: 5, hh: 4, neck: [2, 5], antlers: R.cream[2], tail: R.cream[3], ear: true, dots: R.cream[3] },
  boar: { rx: 9, ry: 5, leg: 3, legW: 2, legC: R.brown[0], hoof: R.ink[0], body: R.brown, head: R.brown, hw: 6, hh: 5, neck: [-2, 0], tusks: R.cream[3], bristle: R.hairBlack[1], snout: R.pink[1], ear: true },
  wgoat: { rx: 7, ry: 4, leg: 5, legW: 1, legC: R.stone[1], hoof: R.ink[1], body: R.stone, head: R.stone, hw: 4, hh: 4, neck: [1, 3], bigHorns: R.cream[1], beard: R.white[2], tail: R.white[3] },
  wolf: { rx: 8, ry: 3.5, leg: 5, legW: 1, legC: R.steel[1], hoof: R.ink[1], body: ['#2a2e3c', '#4c5468', '#6c748a', '#959cb0'], belly: '#b8bccb', head: ['#2a2e3c', '#4c5468', '#6c748a', '#959cb0'], hw: 6, hh: 4, neck: [1, 2], pointy: true, bushy: R.steel[2], muzzle: R.white[2] },
  bear: { rx: 10.5, ry: 6.5, leg: 4, legW: 3, legC: R.brown[1], hoof: R.ink[1], body: R.brown, head: R.brown, hw: 7, hh: 6, neck: [-2, 0], round: true, muzzle: R.ochre[1] },
};

export function animalFrame(kind, mode, k) {
  const S = SPECIES[kind];
  const g = new Pix(32, 32);
  const headLen = S.hw + Math.max(0, S.neck[0]);
  const cx = Math.round(16 - headLen / 2 + 0.5), bodyBot = 30 - S.leg, cy = bodyBot - S.ry;
  const walk = mode === 'walk', graze = mode === 'graze';
  const bob = walk && (k === 1 || k === 3) ? -1 : 0;
  const ccy = cy + bob;

  // ---- legs: far pair dark, near pair light; diagonal pairs swing together ----
  const swingA = walk ? [1, 0, -1, 0][k] : 0, swingB = -swingA;
  const liftA = walk && k === 1 ? 1 : 0, liftB = walk && k === 3 ? 1 : 0;
  const backX = Math.round(cx - S.rx + 2), frontX = Math.round(cx + S.rx - 2 - S.legW);
  const leg = (x, sw, lift, near) => {
    const top = Math.round(ccy + S.ry * 0.4), len = 30 - top - lift;
    g.r(x + sw, top, S.legW, len, near ? S.legC : R.ink[2]);
    g.r(x + sw, 30 - lift, S.legW, 1, S.hoof);
  };
  leg(backX + 1, swingB, liftB, false); leg(frontX + 1, swingA, liftA, false);

  // ---- tail (behind the body) ----
  const tx = Math.round(cx - S.rx), ty = Math.round(ccy - S.ry + 1);
  const flick = mode === 'idle' && k === 1 ? 1 : 0;
  if (S.tail) g.r(tx - 1, ty + 1, 1, 2 + flick, S.tail);
  if (S.tailLong) g.r(tx - 1, ty, 2, 1, S.tailLong).r(tx - 2, ty + 1, 1, 6 - flick, S.tailLong);
  if (S.curl) g.p(tx - 1, ty + 1, R.pink[2]).p(tx - 2, ty, R.pink[2]).p(tx - 1, ty - 1 + flick, R.pink[2]);
  if (S.tailUp) g.line(tx, ty + 1, tx - 2, ty - 2 - flick, S.tailUp);
  if (S.bushy) g.r(tx - 3, ty + 1, 4, 2, S.bushy).p(tx - 4, ty + 2 + flick, S.bushy).p(tx - 3, ty + 3, R.white[3]);
  if (S.feathers) g.r(tx - 1, ty - 2, 2, 3, R.white[2]).p(tx - 2, ty - 3 + flick, R.white[2]);

  // ---- body ----
  const body = shaded(32, 32, (l) => l.ellipse(cx, ccy, S.rx, S.ry, '#fff'), S.body);
  if (S.belly) body.over((x, y) => y > ccy + S.ry * 0.55, S.belly);
  if (S.spots) body.over((x, y) => ((x * 7 + y * 3) % 11 < 2 && (x + y) % 5 < 3) || (x > cx - 3 && x < cx && y < ccy), S.spots[2]);
  if (S.dots) body.over((x, y) => y < ccy - 1 && (x + 2 * y) % 5 === 0, S.dots);
  if (S.wool) body.over((x, y) => (x + y) % 3 === 0, S.body[3]);
  g.draw(body);
  if (S.wool) for (let x = Math.round(cx - S.rx + 1); x <= cx + S.rx - 1; x += 2) g.p(x, Math.round(ccy - S.ry - 1), S.body[3]);
  if (S.bristle) g.r(Math.round(cx - 3), Math.round(ccy - S.ry - 1), 8, 1, S.bristle).r(cx - 1, Math.round(ccy - S.ry - 2), 4, 1, S.bristle);
  if (S.udder) g.r(cx + 1, Math.round(ccy + S.ry), 3, 1, S.udder);

  // ---- near legs ----
  leg(backX, swingA, liftA, true); leg(frontX, swingB, liftB, true);

  // ---- neck and head ----
  const nx = Math.round(cx + S.rx - 2), ny = Math.round(ccy - S.ry * 0.3);
  const chew = graze && k === 1 ? 1 : 0;
  let hx = nx + S.neck[0] + 1, hy = Math.round(ccy - S.ry - S.neck[1]);
  if (graze) { hx = nx + 2; hy = 30 - S.hh - chew + 1; }
  if (mode === 'idle' && k === 1 && !S.small) hy += 0;
  g.line(nx, ny, hx + 1, hy + S.hh - 1, S.head[2]).line(nx, ny + 1, hx + 1, hy + S.hh, S.head[1]);
  if (S.legW > 1 || S.rx > 7) g.line(nx - 1, ny, hx, hy + S.hh - 1, S.head[2]);
  if (S.mane) for (let d = 1; d <= 2; d++) g.line(nx - d, ny + d - 1, hx + 1 - d, hy + S.hh, S.head[2 - (d > 1 ? 1 : 0)]);
  if (S.mane && !graze) g.line(nx - 3, ny - 1, hx - 1, hy, S.mane).line(nx - 4, ny, hx - 2, hy + 1, S.mane);
  const head = shaded(32, 32, (l) => {
    if (S.round) l.ellipse(hx + S.hw / 2, hy + S.hh / 2, S.hw / 2, S.hh / 2, '#fff');
    else { l.r(hx, hy, S.hw - 1, S.hh, '#fff'); l.r(hx + S.hw - 1, hy + 1, 1, S.hh - 1, '#fff'); }
  }, S.head, { top: 0.25, bottom: 0.8 });
  g.draw(head);
  const fx = hx + S.hw - 1;                                    // front of the face
  if (S.muzzle) g.r(fx - 1, hy + S.hh - 2, 2, 2, S.muzzle);
  if (S.snout) g.r(fx, hy + S.hh - 3, 2, 2, S.snout).p(fx + 1, hy + S.hh - 3, R.pink[0]);
  if (S.blaze) g.r(hx + 1, hy, 2, 1, S.blaze);
  if (S.beak) g.p(fx + 1, hy + 1, S.beak);
  if (S.comb) g.r(hx, hy - 1, 2, 1, S.comb).p(fx, hy + 2, S.comb);
  if (S.beard) g.r(fx - 1, hy + S.hh, 1, 2, S.beard);
  if (S.tusks) g.p(fx, hy + S.hh - 2, S.tusks).p(fx, hy + S.hh - 3, S.tusks);
  // eye
  g.p(fx - (S.small ? 1 : 2), hy + 1, INK);
  // ears and horns
  if (S.ear) g.p(hx, hy - 1, S.head[1]).p(hx + 1, hy - 1, S.head[2]);
  if (S.pointy) g.r(hx + 1, hy - 2, 1, 2, S.head[2]).r(hx + 3, hy - 2, 1, 2, S.head[1]);
  if (S.round) g.r(hx, hy - 1, 2, 1, S.head[1]).r(hx + S.hw - 3, hy - 1, 2, 1, S.head[1]);
  if (S.earFlop) g.r(hx, hy, 2, 3, S.earFlop);
  if (S.horns) g.p(hx + 1, hy - 1, S.horns).p(hx, hy - 2, S.horns);
  if (S.bigHorns) g.line(hx + 1, hy - 1, hx - 1, hy - 3, S.bigHorns).line(hx - 1, hy - 3, hx - 3, hy - 1, S.bigHorns).p(hx - 3, hy, S.bigHorns);
  if (S.antlers) {
    const a = S.antlers, bx = hx + 1, by = hy - 1;
    g.line(bx, by, bx - 1, by - 4, a).line(bx - 1, by - 2, bx - 3, by - 3, a).line(bx + 2, by, bx + 3, by - 4, a).line(bx + 3, by - 2, bx + 5, by - 3, a);
  }
  g.outline(INK);
  return g;
}

export function animalSheet(kind, { livestock }) {
  const frames = [], tags = [];
  const push = (name, mode, n, ms) => { const s = frames.length; for (let k = 0; k < n; k++) frames.push(animalFrame(kind, mode, k)); tags.push([name, s, s + n - 1, ms]); };
  push('walk', 'walk', 4, kind === 'chicken' ? 110 : 150);
  push('idle', 'idle', 2, 600);
  if (livestock) push('graze', 'graze', 2, 400);
  return { frames, tags, layer: kind };
}
