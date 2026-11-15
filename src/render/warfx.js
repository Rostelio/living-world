// Phase 17 — war on the map, close up: battle formations (infantry line, archers behind,
// cavalry on the wings, engines at the rear) that close in as the fight goes on; routing
// armies; siege camps with tents, engines, flying stones and breached walls; naval clashes
// with broadsides, burning ships and wreckage. Render-only: nothing here touches the game state.
import { S } from '../sim/state.js';
import { UNITS } from '../data/military.js';
import { RACES } from '../data/races.js';
import { STAGES } from '../data/buildings.js';
import { TILE } from './terrain.js';
import { figure, cavalry, siegeEngine, VIEW } from './people.js';

const groupRoster = (roster) => {
  const g = { inf: [], rng: [], cav: [], sie: [] };
  for (const u of roster) (g[u.cls] || g.inf).push(u);
  return g;
};

// One army in battle order. cx = its front line, dir = facing (+1 right, -1 left)
export function formation(ctx, people, a, cx, cy, civ, dir, t, closing, routing = false) {
  // thin the roster so each figure stands for a company and the ranks stay readable
  const full = people.roster(a);
  const keep = Math.max(1, Math.ceil(full.length / 18));
  const g = groupRoster(full.filter((_, i) => i % keep === 0));
  const skin = RACES[civ.race].skin;
  const sp = VIEW.hd ? 3.2 : 2.4; // spacing along the line
  const col = (list, x0, xStep, perCol) => list.map((u, i) => ({ u, x: x0 - dir * Math.floor(i / perCol) * xStep, y: cy + ((i % perCol) - (Math.min(perCol, list.length) - 1) / 2) * sp }));
  const per = Math.max(3, Math.min(6, Math.ceil(g.inf.length / 2) || 3));
  const halfH = ((Math.min(per, Math.max(g.inf.length, 1)) - 1) / 2) * sp;
  const spots = [
    ...col(g.inf, cx, 2.8, per),
    ...col(g.rng, cx - dir * (Math.ceil(g.inf.length / per) * 2.8 + 2), 2.8, per),
    ...g.cav.map((u, i) => ({ u, x: cx - dir * (Math.floor(i / 2) * 3.4) + dir * (closing > 0.6 ? 2 : 0), y: cy + (i % 2 ? 1 : -1) * (halfH + 3.4 + Math.floor(i / 4) * 2.6) })),
    ...g.sie.map((u, i) => ({ u, x: cx - dir * (Math.ceil(g.inf.length / per) * 2.8 + Math.ceil(g.rng.length / per) * 2.8 + 5 + i * 3.5), y: cy + (i % 2) * 3 })),
  ];
  spots.sort((p, q) => p.y - q.y);
  spots.forEach(({ u, x, y }, i) => {
    let ux = x, uy = y;
    const ph = t + i * 0.37;
    let d = dir;
    if (routing) { // scattered and fleeing
      const h = Math.sin(i * 12.9898) * 43758.5453 % 1;
      ux += -dir * (h * 4) + Math.sin(t * 9 + i) * 0.5; uy += (h - 0.5) * 5; d = -dir;
    } else if (closing > 0) {
      ux += dir * Math.sin(t * 7 + i * 1.7) * 0.5 * (u.cls === 'inf' ? 1 : 0.3);
    }
    if (u.cls === 'cav') cavalry(ctx, ux, uy, civ.color, skin, d, ph, true, u.type === 'knights', civ.race);
    else if (u.cls === 'sie') siegeEngine(ctx, ux, uy, u.type === 'artillery', d, !routing && closing > 0 && Math.sin(t * 3 + i) > 0.95);
    else {
      const gun = ['musketeers', 'riflemen'].includes(u.type);
      figure(ctx, ux, uy, { body: civ.color, skin, race: civ.race, legs: '#2a1d14', helm: u.cls === 'rng' ? null : gun ? '#3a3a40' : '#9aa4ae', hat: u.cls === 'rng' ? '#5a7a3a' : null, tool: u.cls === 'rng' || gun || routing ? null : 'spear', shield: u.cls === 'inf' && !gun && !routing ? civ.color : null, bow: u.cls === 'rng', gun, moving: routing || closing < 0.5, working: !routing && closing >= 0.5, phase: ph, dir: d });
      if (gun && !routing && Math.sin(t * 4 + i * 2.3) > 0.96) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(ux + 1.4 * dir, uy - 2.2, 0.8, 0.6); people.r.atmo.add('smoke', ux + 1.6 * dir, uy - 2, dir * 2, -1, 1.2, 0.8, 1, '200,200,200'); }
    }
  });
  if (!routing) { // standard behind the line
    const fx = cx - dir * 3, fy = cy - halfH - 2;
    ctx.fillStyle = '#2a1d12'; ctx.fillRect(fx, fy - 6, 0.35, 6.5);
    ctx.fillStyle = civ.color; ctx.fillRect(fx + 0.35, fy - 6 + Math.sin(t * 3) * 0.2, 2.6, 1.7);
  } else { // a dropped banner on the ground
    ctx.fillStyle = civ.color; ctx.fillRect(cx - 1, cy + 2, 2.4, 0.8);
  }
  return spots.length;
}

// A land battle: two formations closing in over the first days, then the melee
export function battleScene(ctx, people, b, running) {
  const st = S(), W = people.r.world, t = people.r.time;
  const A = st.armies.find((x) => x.id === b.a), D = st.armies.find((x) => x.id === b.d);
  const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
  const closing = Math.min(1, (b.day + (running ? (t % 1) : 0)) / 3);
  const gap = 18 - closing * 14.5;
  if (A) formation(ctx, people, A, x - gap / 2, y, st.civs[A.civ], 1, t, closing);
  if (D) formation(ctx, people, D, x + gap / 2, y, st.civs[D.civ], -1, t, closing);
  // dust of the melee where the lines meet
  if (closing > 0.6) for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(200,180,140,${0.18 + Math.random() * 0.2})`; ctx.fillRect(x - 2 + Math.random() * 4, y - 3 + Math.random() * 6, 1.4, 1.4); }
  // volleys of arrows from the archers in the opening phase
  if (running && Math.random() < (closing < 0.8 ? 0.55 : 0.25)) {
    const fromA = Math.random() < 0.5, src = fromA ? A : D;
    if (src && Object.keys(src.units).some((k) => UNITS[k]?.cls === 'rng' && src.units[k] > 0)) {
      const sx = x + (fromA ? -gap / 2 - 5 : gap / 2 + 5), sy = y + (Math.random() - 0.5) * 4;
      people.arrows.push({ x0: sx, y0: sy, x1: x + (fromA ? gap / 2 + 1 : -gap / 2 - 1) + (Math.random() - 0.5) * 2, y1: y + (Math.random() - 0.5) * 4, t: 0, dur: 0.6 });
    }
  }
}

// ---------------- Sieges ----------------
// Direction (radians) from the town to the besieging army — the side the camp and breach face
export function siegeAngle(s, a, w) {
  const sx = s.tile % w, sy = (s.tile / w) | 0, ax = a.tile % w, ay = (a.tile / w) | 0;
  if (ax === sx && ay === sy) return (s.id * 2.399) % (Math.PI * 2);
  return Math.atan2(ay - sy, ax - sx);
}
export function siegeCamp(ctx, r, a, s, civ) {
  const W = r.world, t = r.time;
  const sx = (s.tile % W.w) * TILE + 4, sy = ((s.tile / W.w) | 0) * TILE + 4;
  const ang = siegeAngle(s, a, W.w);
  const R = (STAGES[s.stage].radius + 1.4) * TILE;
  // tents in an arc on the army's side
  for (let k = -3; k <= 3; k++) {
    const an = ang + k * 0.22, rr = R + 4 + (k & 1) * 3;
    const x = sx + Math.cos(an) * rr, y = sy + Math.sin(an) * rr;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 3, y + 1.6, 6.2, 1);
    ctx.fillStyle = k % 2 ? '#e8dcc0' : civ.color;
    ctx.beginPath(); ctx.moveTo(x - 3, y + 1.8); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3, y + 1.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 3, y + 1.8); ctx.lineTo(x + 0.6, y + 1.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 0.3, y - 0.2, 0.6, 1.6);
  }
  // camp fire
  { const x = sx + Math.cos(ang) * (R + 9), y = sy + Math.sin(ang) * (R + 9), fl = (Math.sin(t * 13) + 1) / 2;
    ctx.fillStyle = `rgba(255,${150 + fl * 90},60,0.9)`; ctx.fillRect(x - 0.6, y - 0.8 - fl * 0.6, 1.2, 1.4); r.atmo.light(x, y, 9, 2); }
  // engines facing the walls, and stones / shot flying into the town
  const eng = Object.keys(a.units).filter((k) => UNITS[k]?.cls === 'sie' && a.units[k] > 0);
  const cannon = eng.includes('artillery');
  const n = Math.max(eng.length ? 2 : 1, Math.min(3, Math.ceil((a.units.siege || 0) + (a.units.artillery || 0))));
  for (let k = 0; k < n; k++) {
    const an = ang + (k - (n - 1) / 2) * 0.3, rr = R - 1;
    const x = sx + Math.cos(an) * rr, y = sy + Math.sin(an) * rr;
    const dir = Math.cos(an) > 0 ? -1 : 1;
    if (eng.length) siegeEngine(ctx, x, y, cannon, dir, Math.sin(t * 2.2 + k * 2) > 0.97);
    else { // a battering ram at the gate
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 2, y - 1, 4, 2); ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 2.5 + Math.sin(t * 4) * 0.6, y - 0.4, 5, 0.8);
    }
    // projectile arc (deterministic per time slot so it looks continuous)
    const cyc = (t * 0.6 + k * 0.37) % 1;
    if (eng.length && cyc < 0.7) {
      const u = cyc / 0.7;
      const tx = sx + Math.cos(an) * 2, ty = sy + Math.sin(an) * 2;
      const px = x + (tx - x) * u, py = y + (ty - y) * u - Math.sin(u * Math.PI) * 9;
      ctx.fillStyle = cannon ? '#2a2a2a' : '#8a8070'; ctx.fillRect(px - 0.6, py - 0.6, 1.2, 1.2);
      if (u > 0.93) r.atmo.add('smoke', tx, ty, 0, -2, 1.2, 1.2, 1.5, '170,160,150');
    }
  }
  // the town burns once the walls are breached
  const prog = a.siege?.progress || 0;
  if (prog > 55 && Math.random() < 0.3) {
    const an = ang + (Math.random() - 0.5) * 1.2, d = Math.random() * R * 0.6;
    r.atmo.add('smoke', sx + Math.cos(an) * d, sy + Math.sin(an) * d - 2, (Math.random() - 0.5), -3, 2.5, 1.3, 2, '80,70,64');
    r.atmo.light(sx + Math.cos(an) * d, sy + Math.sin(an) * d, 10, 2);
  }
}
// Walls with a breach: segments on the besiegers' side crumble as the siege progresses
export function isBreached(seg, cx, cy, ang, progress) {
  if (progress < 40) return false;
  const [x, y] = seg;
  const a = Math.atan2(y - cy, x - cx);
  let d = Math.abs(a - ang); if (d > Math.PI) d = Math.PI * 2 - d;
  return d < 0.15 + (progress - 40) / 220;
}

// ---------------- Naval clashes ----------------
export function seaClash(ctx, r, b, running) {
  const st = S(), W = r.world, t = r.time;
  const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
  const sides = [[st.fleets.find((f) => f.id === b.a), -1, b.lossA || 0], [st.fleets.find((f) => f.id === b.d), 1, b.lossD || 0]];
  for (const [f, side, loss] of sides) {
    const civ = st.civs[side < 0 ? b.ac : b.dc];
    if (!civ) continue;
    const n = f ? Math.min(4, Math.max(1, Math.ceil(Object.values(f.ships).reduce((s, v) => s + v, 0) / 2))) : 0;
    for (let k = 0; k < n; k++) {
      const sx = x + side * (6 + (k % 2) * 4), sy = y - 5 + k * 3.4;
      r.drawShip(ctx, sx, sy, civ.color, 0.9);
      if (running && Math.sin(t * 5 + k * 1.9 + side) > 0.9) { // broadside
        ctx.fillStyle = '#fff2b0'; ctx.fillRect(sx - side * 4, sy + 0.6, 1, 0.8);
        r.atmo.add('smoke', sx - side * 4.5, sy, -side * 3, -1, 1.6, 1.4, 1.5, '220,220,220');
      }
      if (k < Math.round(loss)) { // burning ship
        if (Math.random() < 0.4) r.atmo.add('smoke', sx, sy - 4, 0, -4, 2, 1.1, 1.6, '70,60,56');
        ctx.fillStyle = `rgba(255,${120 + Math.random() * 100},40,0.9)`; ctx.fillRect(sx - 1 + Math.random() * 2, sy - 3 - Math.random() * 2, 1, 1.2);
        r.atmo.light(sx, sy - 2, 9, 2);
      }
    }
  }
  // cannonballs across the gap and splashes
  if (running) {
    const cyc = (t * 1.3) % 1, from = Math.floor(t * 1.3) % 2 ? -1 : 1;
    const px = x + from * 6 - from * 12 * cyc, py = y - 2 + Math.sin(t * 3) * 2 - Math.sin(cyc * Math.PI) * 3;
    ctx.fillStyle = '#222'; ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
    if (cyc > 0.9) { ctx.fillStyle = 'rgba(230,245,255,0.9)'; ctx.fillRect(px - 1, py, 2, 0.8); }
  }
  // wreckage drifting where ships went down
  const wrecks = Math.min(6, Math.round((b.lossA || 0) + (b.lossD || 0)));
  for (let k = 0; k < wrecks; k++) {
    const h = (Math.sin((b.id + k) * 12.9898) * 43758.5453) % 1;
    const wx = x + (h - 0.5) * 16 + Math.sin(t * 0.5 + k) * 0.6, wy = y + 5 + ((h * 7) % 1) * 4;
    ctx.fillStyle = '#5e3d22'; ctx.fillRect(wx, wy, 2.4, 0.7); ctx.fillStyle = '#3e2814'; ctx.fillRect(wx + 0.6, wy - 0.6, 0.4, 0.6);
  }
}

// ---------------- Camps ----------------
// An army at rest pitches tents on its tile: a few tents in rows, a fire, the banner and two guards
export function armyCamp(ctx, r, a, x, y, civ, tent) {
  const t = r.time;
  const n = Math.min(4, 1 + Math.ceil(Object.values(a.units).reduce((s, v) => s + v, 0) / 4));
  const spots = [[-3, -1.5], [1, -1.5], [-3, 1.5], [1, 1.5]];
  for (let k = 0; k < n; k++) { const [ox, oy] = spots[k]; ctx.drawImage(tent, Math.round((x + ox) * 2) / 2, Math.round((y + oy - 3) * 2) / 2, 4, 4); }
  const fl = (Math.sin(t * 13 + a.id) + 1) / 2;
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(Math.round(x * 2) / 2 - 1, Math.round(y * 2) / 2 + 3, 2, 0.5);
  ctx.fillStyle = `rgba(255,${150 + fl * 90},60,0.95)`; ctx.fillRect(Math.round(x * 2) / 2 - 0.5, Math.round(y * 2) / 2 + 2 - (fl > 0.5 ? 0.5 : 0), 1, 1);
  r.atmo.light(x, y + 2, 10, 2);
  // banner
  ctx.fillStyle = '#2a1d12'; ctx.fillRect(Math.round(x * 2) / 2 + 4, Math.round(y * 2) / 2 - 6, 0.5, 7);
  ctx.fillStyle = civ.color; ctx.fillRect(Math.round(x * 2) / 2 + 4.5, Math.round(y * 2) / 2 - 6, 2.5, 1.5);
  // two guards by the fire
  const skin = RACES[civ.race].skin;
  for (const [gx, d] of [[-4.5, 1], [5.5, -1]]) figure(ctx, x + gx, y + 4, { body: civ.color, skin, race: civ.race, legs: '#2a1d14', helm: '#9aa4ae', tool: 'spear', shield: civ.color, moving: false, working: false, phase: t + gx, dir: d });
}
