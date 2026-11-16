import { personSprite, animalSprite, tinyPerson, farmAnimal } from './sprites16.js';
// Phase 10 — the little people: villagers at work, livestock, wildlife sprites,
// armies drawn as crowds and battles fought soldier by soldier. Cosmetic only
// (uses Math.random, never the simulation's random generator).
import { S } from '../sim/state.js';
import { RACES } from '../data/races.js';
import { UNITS } from '../data/military.js';
import { SPECIES } from '../sim/wildlife.js';
import { hash2 } from '../core/rng.js';
import { TILE } from './terrain.js';
import { SETTINGS } from '../ui/settings.js';
import { hasSprite, pickTag, animate, tagFrame, draw as drawSprite, mark, SPRITES } from '../sprites.js';
import { ART_PER_WORLD } from '../sprite-config.js';
import { VIEW, legacyFigure, legacyFarmAnimal, legacyWildlife } from '../legacy-draw.js';
export { VIEW };

const rnd = Math.random;
const L_RACE_DOGS = new Set(['humans', 'halflings', 'dwarves', 'orcs']);
const ROLE_LOOK = {
  farmer: { body: '#8a6a3a', hat: '#d8c070', tool: 'hoe', carry: '#e8c860' },
  woodcutter: { body: '#6e4a2e', hat: null, tool: 'axe', carry: '#8a5a2e' },
  miner: { body: '#5c6670', hat: '#d0b040', tool: 'pick', carry: '#9a968e' },
  crafter: { body: '#4e6a8a', hat: null, tool: 'hammer', carry: '#c08a50' },
  merchant: { body: '#c89a28', hat: '#7a3a2a', tool: null, carry: '#e6c068' },
  priest: { body: '#e8e2f2', hat: null, tool: null, carry: null },
  guard: { body: null, hat: '#9aa4ae', tool: 'spear', carry: null },
  noble: { body: '#7a3a8a', hat: '#e6c068', tool: null, carry: null },
  child: { body: '#b86a4a', hat: null, tool: null, carry: null, small: true },
  hauler: { body: '#7a6a5a', hat: null, tool: null, carry: '#a07848' },
};
const WORK_KINDS = {
  woodcutter: ['lumber_camp'], miner: ['mine', 'quarry'], crafter: ['brewery', 'textile_mill', 'foundry', 'factory', 'granary', 'warehouse'],
  merchant: ['market', 'bank'], priest: ['temple', 'library', 'university', 'observatory', 'hospital'], guard: ['barracks', 'castle', 'star_fort', 'town_hall'], noble: ['town_hall', 'castle'],
};

// ---------- A single figure (feet at x,y) ----------
// An Aseprite sprite when one exists (townsfolk_<race> / person_<race>), else the code-drawn one.
const MAP = 1 / ART_PER_WORLD; // world px per Aseprite pixel on the map
const snap = (v) => Math.round(v * 2) / 2; // Phase 20: whole art pixels
const STATE = (o) => (o.moving ? 'walk' : o.working ? 'work' : 'idle');
export function figure(ctx, x, y, o) {
  if (VIEW.hd) {
    const tiny = o.tiny || SETTINGS.smallPeople !== false;
    // townsfolk sheets are for villagers (they have a role); soldiers keep the code-drawn look for now
    const id = (tiny ? 'townsfolk_' : 'person_') + (o.race || 'humans');
    if (o.role && hasSprite(id)) {
      const st = STATE(o);
      const tag = pickTag(id, [o.role && `${o.role}_${st}`, st, 'idle']);
      // its own animator when the caller keeps the figure between frames, else the code's own step
      const fr = o.ref ? animate(o.ref, id, tag, o.dt) : tagFrame(id, tag, o.moving ? Math.floor(o.phase * 8) : o.working ? Math.floor(o.phase * 5) : 0);
      ctx.fillStyle = 'rgba(20,14,30,0.22)'; ctx.fillRect(snap(x - 1), snap(y - 0.5), 2.5, 0.5);
      drawSprite(ctx, id, x, y, { frame: fr, flipX: (o.dir || 1) < 0, scale: MAP });
      return;
    }
    if (SPRITES.debug) { if (tiny) mark(ctx, snap(x - 1.75), snap(y - 4.5), 3.5, 4.5, x, y); else mark(ctx, x - 2.5, y - 5.5, 5, 6, x, y); }
  }
  legacyFigure(ctx, x, y, o);
}

// Farm animals as Aseprite sprites (livestock_<kind>); false when there is none
function stockSprite(ctx, m, state, dir, dt) {
  const id = 'livestock_' + m.kind;
  if (!hasSprite(id)) { if (SPRITES.debug) mark(ctx, snap(m.x - 2.5), snap(m.y - 3.5), 5, 3.5, m.x, m.y); return false; }
  drawSprite(ctx, id, m.x, m.y, { frame: animate(m, id, pickTag(id, [state, 'idle', 'walk']), dt), flipX: dir < 0, scale: MAP });
  return true;
}

export class People {
  constructor(renderer) {
    this.r = renderer;
    this.agents = new Map();
    this.bodies = new Map(); // battle id -> [{x,y,c,t}]
    this.arrows = [];
    this.lastLoss = new Map();
  }
  reset() { this.agents.clear(); this.bodies.clear(); this.arrows.length = 0; this.lastLoss.clear(); }

  // ---------- Villagers ----------
  settlementPeople(ctx, s, L, z, dt, running) {
    if (!SETTINGS.showVillagers || z < 1.4 || !L.houseTiles.length) return;
    const st = S();
    const civ = st.civs[s.civ];
    const skin = RACES[L.race].skin;
    const q = SETTINGS.effectsQuality || 2;
    const want = Math.max(3, Math.min(10 + q * 12, Math.round(s.pop / (z >= 3 ? 9 : 14))));
    let rec = this.agents.get(s.id);
    if (!rec || rec.L !== L) {
      rec = { L, list: rec?.list || [], spots: this.spots(L) };
      this.agents.set(s.id, rec);
      for (const a of rec.list) this.assign(a, rec, s);
    }
    const list = rec.list;
    while (list.length < want) { const a = this.spawn(rec, s); if (!a) break; list.push(a); }
    if (list.length > want) list.length = want;
    const night = (this.r.atmo.darkness || 0) > 0.4;
    for (const a of list) {
      if (running) this.step(a, rec, s, dt, night);
      if (a.inside) continue; // at home: indoors, not standing at the door
      const look = ROLE_LOOK[a.role];
      figure(ctx, a.x, a.y, { tiny: true,
        body: look.body || civ.color, hat: look.hat, tool: a.state === 'work' || a.role === 'guard' ? look.tool : null, skin, small: look.small, race: L.race,
        moving: a.state === 'walk', working: a.state === 'work', phase: a.phase, dir: a.dir, carry: a.carry,
        role: a.role, ref: a, dt: running ? dt : 0,
      });
    }
    // livestock near pastures
    if (s.buildings.pasture && rec.spots.fields.length) this.livestock(ctx, s, rec, dt, running);
    if (VIEW.hd && z >= 2.5) this.yardLife(ctx, s, rec, dt, running, list);
  }

  spots(L) {
    const P = (it) => ({ x: it.x * TILE + 4, y: it.y * TILE + 6 });
    const work = {};
    for (const it of L.items) if (it.kind !== 'house') (work[it.kind] ||= []).push(P(it));
    const streets = [...(L.streets || []).filter((p) => !p.water), ...(L.plaza || [])].map((p) => ({ x: p.x * TILE + 4, y: p.y * TILE + 5 }));
    return { streets, homes: L.houseTiles.map((c) => ({ x: c.x * TILE + 4, y: c.y * TILE + 7 })), fields: L.fields.map((f) => ({ x: f.x * TILE + 4, y: f.y * TILE + 4 })), work, center: L.center ? { x: L.center.x * TILE + 4, y: L.center.y * TILE + 6 } : null };
  }
  pickRole(s) {
    const p = s.pops || { peasants: s.pop };
    let tot = 0; for (const k in p) tot += p[k];
    let r = rnd() * (tot * 1.12);
    if (r > tot) return 'child';
    const order = [['peasants', 'farmer'], ['laborers', null], ['craftsmen', 'crafter'], ['merchants', 'merchant'], ['clergy', 'priest'], ['soldiers', 'guard'], ['aristocrats', 'noble'], ['capitalists', 'noble']];
    for (const [k, role] of order) {
      r -= p[k] || 0;
      if (r <= 0) {
        if (role) return role;
        const b = s.buildings;
        return b.lumber_camp && (!b.mine && !b.quarry || rnd() < 0.5) ? 'woodcutter' : b.mine || b.quarry ? 'miner' : 'hauler';
      }
    }
    return 'farmer';
  }
  spawn(rec, s) {
    const h = rec.spots.homes[(rnd() * rec.spots.homes.length) | 0];
    if (!h) return null;
    const a = { x: h.x + rnd() * 2, y: h.y, tx: h.x, ty: h.y, role: this.pickRole(s), state: 'idle', t: rnd() * 4, phase: rnd() * 10, dir: 1, carry: null, home: h, work: null, inside: true, route: [] };
    this.assign(a, rec, s);
    // Phase 20: some start out and about — on a street, heading to work — the rest are indoors
    const st = rec.spots.streets;
    if (st?.length && rnd() < 0.45) { const p = st[(rnd() * st.length) | 0]; a.x = p.x; a.y = p.y; a.inside = false; this.go(a, rec, a.work.x, a.work.y, a.role === 'child' ? 'idle' : 'work'); }
    return a;
  }
  assign(a, rec, s) {
    const sp = rec.spots;
    let w = null;
    if (a.role === 'farmer' && sp.fields.length) w = sp.fields[(rnd() * sp.fields.length) | 0];
    else if (WORK_KINDS[a.role]) {
      for (const k of WORK_KINDS[a.role]) if (sp.work[k]?.length) { w = sp.work[k][(rnd() * sp.work[k].length) | 0]; break; }
    }
    if (!w) w = a.role === 'child' || a.role === 'hauler' || !sp.center ? sp.homes[(rnd() * sp.homes.length) | 0] : sp.center;
    a.work = w ? { x: w.x + (rnd() - 0.5) * 5, y: w.y + (rnd() - 0.5) * 3 } : a.home;
    a.home = sp.homes[(rnd() * sp.homes.length) | 0] || a.home;
    void s;
  }
  step(a, rec, s, dt, night) {
    a.phase += dt;
    const look = ROLE_LOOK[a.role];
    if (a.state === 'walk') {
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      const sp = (a.role === 'child' ? 5 : 3.2) * dt;
      if (d < 0.4 && a.route?.length) { const n = a.route.shift(); a.tx = n.x; a.ty = n.y; return; } // next street corner
      if (d < 0.4) {
        a.state = a.next; a.t = a.state === 'work' ? 2 + rnd() * 4 : 2 + rnd() * 5; if (a.state === 'work') a.carry = null;
        const c = rec.spots.center; // idle by a house (home or a visit): step indoors; in the square: stay and chat
        a.inside = a.state === 'idle' && !(c && Math.hypot(a.x - c.x, a.y - c.y) < 10);
      }
      else { a.x += (dx / d) * Math.min(d, sp); a.y += (dy / d) * Math.min(d, sp); if (Math.abs(dx) > 0.2) a.dir = dx > 0 ? 1 : -1; }
      return;
    }
    a.t -= dt;
    if (a.t > 0) return;
    if (night && a.role !== 'guard') { if (!a.inside) this.go(a, rec, a.home.x, a.home.y, 'idle'); else a.t = 2; return; }
    if (a.state === 'work') {
      // head home with the goods
      a.carry = look.carry; this.go(a, rec, a.home.x + (rnd() - 0.5) * 1, a.home.y, 'idle');
    } else {
      if (rnd() < 0.15) this.assign(a, rec, s);
      a.inside = false;
      this.go(a, rec, a.work.x + (rnd() - 0.5) * 3, a.work.y + (rnd() - 0.5) * 2, a.role === 'child' ? 'idle' : 'work');
    }
  }
  // Phase 20: walk by way of the streets — to the nearest street, along to the street nearest
  // the goal, then to the goal itself (right-angle legs, like people on real lanes)
  go(a, rec, x, y, next) {
    const st = rec.spots.streets;
    a.state = 'walk'; a.next = next; a.route = [];
    if (st?.length && Math.hypot(x - a.x, y - a.y) > 6) {
      const near = (px, py) => { let b = null, bd = 1e9; for (const p of st) { const d = Math.abs(p.x - px) + Math.abs(p.y - py); if (d < bd) { bd = d; b = p; } } return b; };
      const s1 = near(a.x, a.y), s2 = near(x, y);
      a.route.push({ x: s1.x, y: a.y }, { x: s1.x, y: s1.y });
      if (s2 !== s1) a.route.push({ x: s2.x, y: s1.y }, { x: s2.x, y: s2.y });
      a.route.push({ x, y: s2.y }, { x, y });
    } else a.route.push({ x, y: a.y }, { x, y });
    const f = a.route.shift(); a.tx = f.x; a.ty = f.y;
  }

  livestock(ctx, s, rec, dt, running) {
    rec.stock ||= [];
    const n = Math.min(10, 2 + s.buildings.pasture * 2);
    while (rec.stock.length < n) {
      const f = rec.spots.fields[(rnd() * rec.spots.fields.length) | 0];
      rec.stock.push({ x: f.x + (rnd() - 0.5) * 8, y: f.y + (rnd() - 0.5) * 6, cx: f.x, cy: f.y, kind: rnd() < 0.6 ? 'sheep' : 'cow', t: rnd() * 3, vx: 0, vy: 0, phase: rnd() * 9 });
    }
    for (const m of rec.stock) {
      if (running) {
        m.t -= dt; m.phase += dt;
        if (m.t <= 0) { m.t = 1.5 + rnd() * 4; const moving = rnd() < 0.5; m.vx = moving ? (rnd() - 0.5) * 1.6 : 0; m.vy = moving ? (rnd() - 0.5) * 1 : 0; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (Math.abs(m.x - m.cx) > 7) m.vx = -m.vx; if (Math.abs(m.y - m.cy) > 5) m.vy = -m.vy;
      }
      const dir = m.vx < 0 ? -1 : 1;
      if (VIEW.hd) {
        const fr = m.vx ? Math.floor(m.phase * 6) % 2 : (Math.sin(m.phase * 0.7) > -0.3 ? 2 : 0);
        if (!stockSprite(ctx, m, m.vx ? 'walk' : fr === 2 ? 'graze' : 'idle', dir, running ? dt : 0)) legacyFarmAnimal(ctx, m, fr, dir);
        continue;
      }
      if (m.kind === 'sheep') animal(ctx, m.x, m.y, { body: '#f2efe6', head: '#3a3330', legs: '#3a3330', w: 1.8, h: 1.2, dir, phase: m.phase, moving: !!m.vx });
      else animal(ctx, m.x, m.y, { body: '#f4f0e8', spots: '#3a2a20', head: '#f4f0e8', legs: '#5a4a3a', w: 2.4, h: 1.4, dir, phase: m.phase, moving: !!m.vx });
    }
  }

  // Phase 20: hens pecking round the houses and a dog trotting after someone
  yardLife(ctx, s, rec, dt, running, people) {
    if (!rec.yard) {
      rec.yard = [];
      const homes = rec.spots.homes;
      const n = Math.min(6, 1 + Math.floor(homes.length / 6));
      for (let k = 0; k < n; k++) { const h = homes[(rnd() * homes.length) | 0]; const ox = rnd() < 0.5 ? -4.5 : 4.5; if (h) rec.yard.push({ kind: 'chicken', x: h.x + ox, y: h.y + 0.5, cx: h.x + ox, cy: h.y + 0.5, t: rnd() * 2, phase: rnd() * 9, dir: 1 }); }
      if (homes.length > 3 && L_RACE_DOGS.has(rec.L.race)) rec.yard.push({ kind: 'dog', x: homes[0].x, y: homes[0].y, t: 0, phase: 0, dir: 1, follow: 0 });
    }
    for (const m of rec.yard) {
      if (running) {
        m.phase += dt; m.t -= dt;
        if (m.kind === 'chicken') {
          if (m.t <= 0) { m.t = 0.6 + rnd() * 1.5; m.tx = m.cx + (rnd() - 0.5) * 4; m.ty = m.cy + (rnd() - 0.5) * 2; }
          if (m.tx != null) { const dx = m.tx - m.x; m.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 2); m.y += Math.sign(m.ty - m.y) * Math.min(Math.abs(m.ty - m.y), dt * 2); if (Math.abs(dx) > 0.1) m.dir = dx > 0 ? 1 : -1; }
        } else {
          const p = people.find((q) => !q.inside) || null;
          if (p) { const dx = p.x - 2 * p.dir - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy); if (d > 1.5) { const sp = Math.min(d, dt * 5); m.x += (dx / d) * sp; m.y += (dy / d) * sp; m.dir = dx > 0 ? 1 : -1; m.moving = true; } else m.moving = false; }
        }
      }
      const fr = m.kind === 'chicken' ? (Math.sin(m.phase * 3) > 0.6 ? 2 : 0) : m.moving ? Math.floor(m.phase * 8) % 2 : 0;
      if (!stockSprite(ctx, m, m.kind === 'chicken' ? (fr === 2 ? 'graze' : 'idle') : m.moving ? 'walk' : 'idle', m.dir, running ? dt : 0)) legacyFarmAnimal(ctx, m, fr, m.dir);
    }
  }

  // ---------- Wildlife ----------
  wildlife(ctx, v, dayFrac, seen = () => true) {
    const st = S();
    const wdt = this.r.time - (this._wt ?? this.r.time); this._wt = this.r.time; // animation clock
    const W = this.r.world;
    for (const a of st.animals) {
      const ax = a.t % W.w, ay = (a.t / W.w) | 0;
      if (ax * TILE < v.x0 - 8 || ax * TILE > v.x1 || ay * TILE < v.y0 - 8 || ay * TILE > v.y1) continue;
      if (!seen(a.t)) continue;
      const px = a.pt % W.w, py = (a.pt / W.w) | 0;
      const fx = px + (ax - px) * dayFrac, fy = py + (ay - py) * dayFrac;
      const X = fx * TILE + 2 + (a.id % 4), Y = fy * TILE + 5 + ((a.id >> 2) % 3);
      const sp = SPECIES[a.sp];
      const moving = a.t !== a.pt;
      const dir = ax >= px ? 1 : -1;
      const big = a.sp === 'bear' ? 1.35 : a.sp === 'wolf' || a.sp === 'boar' ? 1 : 1.05;
      if (VIEW.hd) {
        const id = 'wildlife_' + a.sp;
        if (hasSprite(id)) drawSprite(ctx, id, X, Y, { frame: animate(a, id, pickTag(id, [moving ? 'walk' : 'idle', 'walk']), wdt), flipX: dir < 0, scale: MAP });
        else { if (SPRITES.debug) mark(ctx, X - 3.5, Y - 5.5, 7, 5.5, X, Y); legacyWildlife(ctx, a, X, Y, moving, dir, this.r.time); }
        continue;
      }
      animal(ctx, X, Y, { body: sp.color, head: sp.color, legs: a.sp === 'goat' ? '#8a8276' : '#3a2a1e', w: 2.2 * big, h: 1.2 * big, dir, phase: this.r.time + a.id, moving, antlers: a.sp === 'deer' && a.id % 2 === 0, ears: a.sp === 'wolf', tusks: a.sp === 'boar' });
    }
  }

  // ---------- Armies ----------
  // Figures for an army: [{cls, type}] — about two figures per regiment, capped
  roster(a) {
    const out = [];
    let tot = 0; for (const k in a.units) tot += a.units[k];
    const cap = 8 + (SETTINGS.effectsQuality || 2) * 8;
    const scale = Math.min(2, cap / Math.max(1, tot));
    for (const k in a.units) {
      const n = Math.max(a.units[k] > 0 ? 1 : 0, Math.round(a.units[k] * scale));
      for (let i = 0; i < n; i++) out.push({ cls: UNITS[k]?.cls || 'inf', type: k });
    }
    const order = { cav: 0, inf: 1, rng: 2, sie: 3 };
    out.sort((p, q) => order[p.cls] - order[q.cls]);
    return out;
  }
  army(ctx, a, x, y, z, civ, opts = {}) {
    const skin = RACES[civ.race].skin;
    const roster = opts.roster || this.roster(a);
    const moving = !!a.path?.length && !opts.fighting;
    const dir = opts.dir ?? 1;
    const perRow = Math.max(3, Math.ceil(Math.sqrt(roster.length * 1.6)));
    const t = this.r.time;
    roster.forEach((u, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const sp = VIEW.hd ? 2.2 : 1.7, rs = VIEW.hd ? 1.9 : 1.6;
      let ux = x + (col - (perRow - 1) / 2) * sp + (row % 2) * 0.6;
      let uy = y - 2 + row * rs;
      if (opts.fighting) {
        ux += dir * (Math.sin(t * 7 + i * 1.7) * 0.6 + (row === 0 ? 1 : 0));
        uy += Math.sin(t * 5 + i) * 0.2;
      }
      const ph = t + i * 0.37;
      if (u.cls === 'cav') cavalry(ctx, ux, uy, civ.color, skin, dir, ph, moving || opts.fighting, u.type === 'knights', civ.race);
      else if (u.cls === 'sie') siegeEngine(ctx, ux, uy, u.type === 'artillery', dir, opts.fighting && Math.sin(t * 3 + i) > 0.97);
      else {
        const gun = ['musketeers', 'riflemen'].includes(u.type);
        figure(ctx, ux, uy, { body: civ.color, skin, race: civ.race, legs: '#2a1d14', helm: u.cls === 'rng' ? null : gun ? '#3a3a40' : '#9aa4ae', hat: u.cls === 'rng' ? '#5a7a3a' : null, tool: u.cls === 'rng' || gun ? null : 'spear', shield: u.cls === 'inf' && !gun ? civ.color : null, bow: u.cls === 'rng', gun, moving, working: opts.fighting && !moving, phase: ph, dir });
        if (u.cls === 'rng' && !VIEW.hd) { ctx.fillStyle = '#7a5530'; ctx.fillRect(ux + 0.65 * dir - 0.1, uy - 3, 0.22, 2); }
        if (gun && opts.fighting && Math.sin(t * 4 + i * 2.3) > 0.96) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(ux + 1.4 * dir, uy - 2.2, 0.8, 0.6); this.r.atmo.add('smoke', ux + 1.6 * dir, uy - 2, dir * 2, -1, 1.2, 0.8, 1, '200,200,200'); }
      }
    });
    // standard bearer
    const fx = x + dir * ((perRow / 2) * (VIEW.hd ? 2.8 : 1.7) + 1.2), fy = y - 1;
    ctx.fillStyle = '#2a1d12'; ctx.fillRect(fx, fy - 6, 0.35, 6.5);
    ctx.fillStyle = civ.color; ctx.fillRect(fx + 0.35, fy - 6 + Math.sin(t * 3) * 0.2, 2.6, 1.7);
    return roster;
  }

  // Phase 17: remember losses for the fallen-soldier markers (formations draw the living)
  trackLosses(b) {
    const st = S(), W = this.r.world;
    const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
    const lost = (b.lossA || 0) + (b.lossD || 0);
    const prev = this.lastLoss.get(b.id) ?? lost;
    if (lost > prev) {
      const arr = this.bodies.get(b.id) || [];
      const n = Math.min(6, Math.ceil((lost - prev) * 3));
      for (let i = 0; i < n && arr.length < 60; i++) { const fromA = Math.random() < (b.lossA || 0) / Math.max(1e-6, lost); arr.push({ x: x + (Math.random() - 0.5) * 9, y: y + (Math.random() - 0.5) * 6, c: st.civs[fromA ? b.ac : b.dc]?.color || '#777', r: Math.random() < 0.5 }); }
      this.bodies.set(b.id, arr);
    }
    this.lastLoss.set(b.id, lost);
  }
  battle(ctx, b, z, running) {
    const st = S();
    const W = this.r.world;
    const A = st.armies.find((x) => x.id === b.a), D = st.armies.find((x) => x.id === b.d);
    const x = (b.tile % W.w) * TILE + 4, y = ((b.tile / W.w) | 0) * TILE + 4;
    if (!b.ended) {
      if (A) this.army(ctx, A, x - 5, y, z, st.civs[A.civ], { fighting: true, dir: 1 });
      if (D) this.army(ctx, D, x + 5, y, z, st.civs[D.civ], { fighting: true, dir: -1 });
      // arrows from archers
      if (running && Math.random() < 0.35) {
        const fromA = Math.random() < 0.5;
        const src = fromA ? A : D;
        if (src && Object.keys(src.units).some((k) => UNITS[k]?.cls === 'rng' && src.units[k] > 0)) {
          const sx = x + (fromA ? -7 : 7), sy = y - 1 + (Math.random() - 0.5) * 3;
          this.arrows.push({ x0: sx, y0: sy, x1: x + (fromA ? 4 : -4) + (Math.random() - 0.5) * 3, y1: y + (Math.random() - 0.5) * 3, t: 0, dur: 0.6 });
        }
      }
      // fallen soldiers accumulate with losses
      const key = b.id;
      const lost = (b.lossA || 0) + (b.lossD || 0);
      const prev = this.lastLoss.get(key) ?? lost;
      if (lost > prev) {
        const arr = this.bodies.get(key) || [];
        const n = Math.min(6, Math.ceil((lost - prev) * 3));
        for (let i = 0; i < n && arr.length < 60; i++) {
          const side = Math.random() < (b.lossA || 0) / Math.max(1e-6, lost) ? A : D;
          arr.push({ x: x + (Math.random() - 0.5) * 9, y: y + (Math.random() - 0.5) * 5, c: side ? st.civs[side.civ].color : '#777', r: Math.random() < 0.5 });
        }
        this.bodies.set(key, arr);
      }
      this.lastLoss.set(key, lost);
    }
    // bodies on the field (stay until the battle record is cleared)
    for (const bd of this.bodies.get(b.id) || []) {
      ctx.fillStyle = 'rgba(120,20,16,0.55)'; ctx.fillRect(bd.x - 0.4, bd.y + 0.2, 1.2, 0.5);
      ctx.fillStyle = bd.c; ctx.fillRect(bd.x - 0.8, bd.y - 0.2, 1.6, 0.6);
      ctx.fillStyle = '#d8b08c'; ctx.fillRect(bd.x + (bd.r ? 0.8 : -1.3), bd.y - 0.2, 0.5, 0.5);
    }
  }

  drawArrows(ctx, dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.t += dt;
      const u = a.t / a.dur;
      if (u >= 1) { this.arrows.splice(i, 1); continue; }
      const x = a.x0 + (a.x1 - a.x0) * u, y = a.y0 + (a.y1 - a.y0) * u - Math.sin(u * Math.PI) * 4;
      const nx = a.x0 + (a.x1 - a.x0) * (u + 0.05), ny = a.y0 + (a.y1 - a.y0) * (u + 0.05) - Math.sin((u + 0.05) * Math.PI) * 4;
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.25;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (nx - x) * 4, y + (ny - y) * 4); ctx.stroke();
    }
  }
  pruneBattles() {
    const ids = new Set(S().battles.map((b) => b.id));
    for (const k of this.bodies.keys()) if (!ids.has(k)) this.bodies.delete(k);
    for (const k of this.lastLoss.keys()) if (!ids.has(k)) this.lastLoss.delete(k);
  }
}

// ---------- Small sprites ----------
export function animal(ctx, x, y, o) {
  const d = o.dir;
  const st = o.moving ? Math.sin(o.phase * 11) * 0.25 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - o.w / 2, y - 0.1, o.w, 0.35);
  ctx.fillStyle = o.legs;
  const lx = [x - o.w / 2 + 0.2, x - o.w / 2 + 0.6, x + o.w / 2 - 0.8, x + o.w / 2 - 0.4];
  lx.forEach((lxx, i) => ctx.fillRect(lxx + (i % 2 ? st : -st), y - 0.75, 0.25, 0.75));
  ctx.fillStyle = o.body; ctx.fillRect(x - o.w / 2, y - 0.75 - o.h, o.w, o.h);
  if (o.spots) { ctx.fillStyle = o.spots; ctx.fillRect(x - 0.3, y - 0.6 - o.h, 0.6, 0.5); ctx.fillRect(x + 0.5, y - 1.1, 0.4, 0.3); }
  const hx = d > 0 ? x + o.w / 2 - 0.1 : x - o.w / 2 - 0.7;
  ctx.fillStyle = o.head; ctx.fillRect(hx, y - 1.05 - o.h, 0.8, 0.75);
  if (o.antlers) { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(hx + 0.2, y - 1.7 - o.h, 0.15, 0.65); ctx.fillRect(hx + 0.5, y - 1.6 - o.h, 0.15, 0.55); }
  if (o.ears) { ctx.fillStyle = o.head; ctx.fillRect(hx + 0.1, y - 1.35 - o.h, 0.2, 0.3); ctx.fillRect(hx + 0.5, y - 1.35 - o.h, 0.2, 0.3); }
  if (o.tusks) { ctx.fillStyle = '#f0ead8'; ctx.fillRect(hx + (d > 0 ? 0.6 : 0), y - 0.65 - o.h, 0.2, 0.25); }
  ctx.fillStyle = '#111'; ctx.fillRect(hx + (d > 0 ? 0.45 : 0.15), y - 0.9 - o.h, 0.15, 0.15);
}
export function cavalry(ctx, x, y, color, skin, dir, ph, moving, heavy, race) {
  if (VIEW.hd) {
    // Phase 20: town scale — a small horse and rider
    const horse = farmAnimal('horse', moving ? Math.floor(ph * 7) % 2 : 0, dir);
    ctx.drawImage(horse, snap(x - 2.5), snap(y - 3.5), 5, 3.5);
    const rider = tinyPerson(race || 'humans', { body: color, hat: heavy ? '#c0c8d0' : '#9aa4ae', tool: 'spear', shield: heavy ? color : null }, 6, dir);
    ctx.drawImage(rider, snap(x - 1.75), snap(y - 6.5), 3.5, 4.5);
    return;
  }
  animal(ctx, x, y, { body: heavy ? '#d8d8d8' : '#7a4e2e', head: heavy ? '#d8d8d8' : '#7a4e2e', legs: '#3a2a1e', w: 2.6, h: 1.2, dir, phase: ph, moving });
  if (heavy) { ctx.fillStyle = color; ctx.fillRect(x - 1.1, y - 1.9, 2.2, 0.4); }
  // rider
  ctx.fillStyle = color; ctx.fillRect(x - 0.45, y - 3.2, 0.9, 1.2);
  ctx.fillStyle = skin; ctx.fillRect(x - 0.35, y - 3.9, 0.7, 0.7);
  ctx.fillStyle = heavy ? '#c0c8d0' : '#9aa4ae'; ctx.fillRect(x - 0.4, y - 4.05, 0.8, 0.3);
  ctx.fillStyle = '#cfd6dd'; ctx.fillRect(x + 0.4 * dir, y - 4.6, 0.18, 2.6);
}
export function siegeEngine(ctx, x, y, cannon, dir, fire) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 1.4, y - 0.1, 2.8, 0.35);
  ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 1, y - 0.7, 0.6, 0.6); ctx.fillRect(x + 0.5, y - 0.7, 0.6, 0.6);
  if (cannon) {
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(x - 1.2, y - 1.5, 2.6, 0.7);
    if (fire) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(x + 1.4 * dir, y - 1.6, 1, 0.8); }
  } else {
    ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 1.3, y - 1.2, 2.6, 0.5);
    ctx.fillRect(x - 0.1, y - 3, 0.3, 1.9);
    ctx.fillRect(x - 0.1 - dir * 0.9, y - 3.1, 1.6, 0.25);
  }
}
void hash2;
