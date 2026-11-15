// Electron script: write a template PNG for every art slot plus art/slots.json.
// LW_SHOT=art LW_SHOT_SCRIPT=tests/art-export.js npx electron .
await new Promise((r) => setTimeout(r, 900));
document.getElementById('ssSeed').value = '4242'; document.getElementById('ssFog').value = 'off'; document.getElementById('ssStart').click();
await new Promise((r) => setTimeout(r, 3500));
const { SLOT_LOG } = await import('./src/render/pixelkit.js');
const B = await import('./src/render/buildings16.js');
const T = await import('./src/render/town16.js');
const O = await import('./src/render/tiles16.js');
const { RACES } = await import('./src/data/races.js');
const { BUILDINGS } = await import('./src/data/buildings.js');
const { WORK_LIST } = await import('./src/sim/latebalance.js');
const races = Object.keys(RACES);
for (const r of races) {
  for (let t = 0; t <= 3; t++) { B.house16(r, t); }
  for (const k of [...Object.keys(BUILDINGS), 'campfire', 'walls_tower']) B.special16(k, r, '#c0392b');
  for (const s of [2, 3]) for (const v of [0, 1]) T.townhouse16(r, s, v);
}
for (const id of WORK_LIST) T.work16(id);
for (let t = 0; t <= 3; t++) { T.treehouse16(t); T.hillhome16(t, false); T.stilt16(t); T.tent16(t, '#c0392b'); }
for (const k of ['oak', 'birch', 'pine', 'palm', 'jungle', 'bush', 'rock', 'mound', 'peak', 'peak_snow', 'reeds', 'cactus', 'flowers', 'dead']) for (let s = 0; s <= 3; s++) for (let v = 0; v < 3; v++) O.objectSprite(k, s, v);
const safe = (k) => k.replace(/[^a-z0-9_-]+/gi, '_');
const files = [];
const slots = {};
for (const [key, e] of SLOT_LOG) {
  if (!e.canvas) continue;
  const name = `templates/${e.kind}/${safe(key)}.png`;
  slots[key] = { w: e.w, h: e.h, kind: e.kind, template: name };
  files.push({ name, data: e.canvas.toDataURL('image/png') });
}
files.push({ name: 'slots.json', data: JSON.stringify({ about: 'Every sprite slot: size in pixels and a template drawn by the game. Draw a PNG of the same size (or exactly 2x/3x), save it in this folder and add it to manifest.json.', slots }, null, 1) });
window.__files = files;
window.__shots = [];
