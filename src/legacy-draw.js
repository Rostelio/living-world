// The code-drawn graphics that Aseprite sprites replace (src/sprites.js). When a sprite has no
// files yet, the game draws these instead. Moved here unchanged from src/render/people.js and the
// draw calls in src/render/renderer.js; the sprite factories they use (sprites16.js, town16.js,
// buildings16.js, tiles16.js, sprites.js icons) stay where they are and are listed at the end.
import { personSprite, animalSprite, tinyPerson, farmAnimal } from './render/sprites16.js';
import { caravan16, lair16, creature16, windmill16, townhouse16, treehouse16, hillhome16, tent16, stilt16, work16, prop16 } from './render/town16.js';
import { house16, special16, field16 } from './render/buildings16.js';
import { objectSprite } from './render/tiles16.js';
import { iconCanvas, iconUrl, flagUrl, portraitUrl } from './render/sprites.js';
import { SETTINGS } from './ui/settings.js';

// ---------- A single figure (feet at x,y; ~3.4 world px tall) ----------
// Close-up mode: real animated sprites instead of rectangles
export const VIEW = { hd: false };
const frameOf = (o) => (o.moving ? Math.floor(o.phase * 8) % 4 : o.working ? 4 + (Math.floor(o.phase * 5) % 2) : 0);
const snap = (v) => Math.round(v * 2) / 2; // Phase 20: whole art pixels
export function legacyFigure(ctx, x, y, o) {
  if (VIEW.hd && (o.tiny || SETTINGS.smallPeople !== false)) { // Phase 20: everyone on the town scale
    const spr = tinyPerson(o.race || 'humans', { body: o.body, hat: o.helm || o.hat, tool: o.tool, carry: o.carry, small: o.small, shield: o.shield, bow: o.bow, gun: o.gun }, frameOf(o), o.dir || 1);
    ctx.fillStyle = 'rgba(20,14,30,0.22)'; ctx.fillRect(snap(x - 1), snap(y - 0.5), 2.5, 0.5); // a dot of shadow at the feet
    ctx.drawImage(spr, snap(x - 1.75), snap(y - 4.5), 3.5, 4.5);
    return;
  }
  if (VIEW.hd) {
    const look = { body: o.body, hat: o.hat, legs: o.legs, tool: o.tool, carry: o.carry, small: o.small, shield: o.shield, bow: o.bow, gun: o.gun, helm: o.helm };
    const spr = personSprite(o.race || 'humans', look, frameOf(o), o.dir || 1);
    const sc = 0.5; // Phase 20: every figure on the same 2-pixels-per-unit grid
    ctx.drawImage(spr, x - 5 * sc, y - 11 * sc, 10 * sc, 12 * sc);
    return;
  }
  const k = o.small ? 0.72 : 1;
  const step = o.moving ? Math.sin(o.phase * 12) : 0;
  const work = o.working ? Math.sin(o.phase * 9) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 0.8 * k, y - 0.15, 1.6 * k, 0.4);
  // legs
  ctx.fillStyle = o.legs || '#3b2a1e';
  ctx.fillRect(x - 0.45 * k + step * 0.25, y - 1 * k, 0.35 * k, 1 * k);
  ctx.fillRect(x + 0.1 * k - step * 0.25, y - 1 * k, 0.35 * k, 1 * k);
  // body
  const by = y - 2.2 * k + (o.moving ? Math.abs(step) * -0.15 : 0);
  ctx.fillStyle = o.body;
  ctx.fillRect(x - 0.6 * k, by, 1.2 * k, 1.3 * k);
  // head
  ctx.fillStyle = o.skin;
  ctx.fillRect(x - 0.42 * k, by - 0.85 * k, 0.84 * k, 0.85 * k);
  if (o.hat) { ctx.fillStyle = o.hat; ctx.fillRect(x - 0.5 * k, by - 0.95 * k, 1 * k, 0.32 * k); }
  // tool
  const d = o.dir || 1;
  if (o.tool) {
    ctx.fillStyle = o.tool === 'spear' ? '#cfd6dd' : '#6e5636';
    if (o.tool === 'spear') ctx.fillRect(x + 0.7 * d, by - 1.6, 0.2, 3.2);
    else {
      const a = work * 0.6;
      ctx.fillRect(x + 0.6 * d, by - 0.6 + a, 0.22, 1.6);
      ctx.fillStyle = o.tool === 'hoe' ? '#9aa0a6' : o.tool === 'axe' ? '#b8c0c8' : '#8a9096';
      ctx.fillRect(x + (0.6 * d) - (d < 0 ? 0.5 : 0), by - 0.7 + a, 0.7, 0.3);
    }
  }
  if (o.carry) { ctx.fillStyle = o.carry; ctx.fillRect(x - 0.55 * k, by - 1.45 * k, 1.1 * k, 0.6 * k); }
}

// ---------- Small draws moved out of people.js / renderer.js (unchanged) ----------
// livestock and yard animals (close-up), people.js livestock() / yardLife()
export function legacyFarmAnimal(ctx, m, fr, dir) { const spr = farmAnimal(m.kind, fr, dir); ctx.drawImage(spr, snap(m.x - 2.5), snap(m.y - 3.5), 5, 3.5); }
// wildlife (close-up), people.js wildlife()
export function legacyWildlife(ctx, a, X, Y, moving, dir, time) { const spr = animalSprite(a.sp, moving ? Math.floor((time + a.id) * 6) % 2 : 0, dir); const k = a.sp === 'bear' ? 1.2 : 1; ctx.drawImage(spr, X - 3.5 * k, Y - 5.5 * k, 7 * k, 5.5 * k); }
// creature lair and creature, renderer.js draw()
export function legacyLair(ctx, lx, ly) { ctx.drawImage(lair16(), lx - 4, ly - 4, 8, 6); }
export function legacyCreature(ctx, m, mx, my, fly, time) { ctx.drawImage(creature16(m.kind, Math.floor(time * (fly ? 4 : 2) + m.id)), mx - 6, my - 4.5, 12, 9); }
// trade caravan, renderer.js drawCaravans()
export function legacyCaravan(ctx, color, X, Y, time, k) { ctx.drawImage(caravan16(color, Math.floor(time * 4 + k) % 2), X - 4, Y - 4, 8, 5); }

// ---------- Code-drawn sprite factories (stay in their files; listed for reference) ----------
export const LEGACY_FACTORIES = {
  townsfolk: tinyPerson, person: personSprite, livestock: farmAnimal, wildlife: animalSprite,
  creature: creature16, lair: lair16, caravan: caravan16, windmill: windmill16,
  house: house16, townhouse: townhouse16, home_treehouse: treehouse16, home_hillhome: hillhome16, home_tent: tent16, home_stilt: stilt16,
  building: special16, great_work: work16, field: field16, prop: prop16, nature: objectSprite,
  icon: iconCanvas, icon_url: iconUrl, flag: flagUrl, portrait: portraitUrl,
};
