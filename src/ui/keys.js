// Phase 17 — key rebinding. Each action has a default key; players may move actions to other
// keys. Pressed keys are translated back to the default key of their action, so the rest of the
// game's input code keeps working with the defaults. Stored in settings, never in saves.
import { SETTINGS } from './settings.js';

export const KEY_ACTIONS = [
  ['pause', 'Pause / resume', ' '], ['speed1', 'Speed 1', '1'], ['speed2', 'Speed 2', '2'], ['speed3', 'Speed 3', '3'], ['speed4', 'Speed 4', '4'], ['speed5', 'Speed 5', '5'],
  ['panUp', 'Pan up', 'w'], ['panLeft', 'Pan left', 'a'], ['panDown', 'Pan down', 's'], ['panRight', 'Pan right', 'd'],
  ['zoomIn', 'Zoom in', 'z'], ['zoomOut', 'Zoom out', 'x'], ['capital', 'Jump to capital', 'h'],
  ['overview', 'Overview', 'v'], ['economy', 'Economy', 'e'], ['diplomacy', 'Diplomacy', 'r'], ['military', 'Military', 'm'], ['government', 'Government', 'g'],
  ['court', 'Court', 'k'], ['politics', 'Politics', 'o'], ['technology', 'Technology', 't'], ['construction', 'Construction', 'c'], ['population', 'Population', 'p'], ['missions', 'Missions', 'u'], ['ledger', 'Ledger', 'l'],
  ['encyclopedia', 'Encyclopedia', 'i'], ['chronicle', 'Chronicle', 'j'], ['build', 'Build here', 'b'], ['idle', 'Next idle settlement', 'n'], ['nextArmy', 'Next army', 'q'], ['focus', 'Focus selection', 'f'], ['search', 'Search', '/'],
];
const DEFAULT = Object.fromEntries(KEY_ACTIONS.map(([id, , k]) => [id, k]));
export const keyFor = (id) => SETTINGS.keys?.[id] ?? DEFAULT[id];
export const keyLabel = (k) => (k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

let map = null, mapFor = null;
function build() {
  map = new Map();
  for (const [id, , def] of KEY_ACTIONS) {
    const k = keyFor(id);
    map.set(k, def);
  }
  // a default key whose action moved elsewhere (and that nothing else took) does nothing now
  for (const [id, , def] of KEY_ACTIONS) if (keyFor(id) !== def && !map.has(def)) map.set(def, null);
  mapFor = JSON.stringify(SETTINGS.keys || {});
}
// pressed key (lower-case) → the default key the game logic understands, or null to ignore
export function remapKey(k) {
  if (!SETTINGS.keys || !Object.keys(SETTINGS.keys).length) return k;
  if (!map || mapFor !== JSON.stringify(SETTINGS.keys)) build();
  return map.has(k) ? map.get(k) : k;
}
export function bindKey(id, k) {
  SETTINGS.keys ??= {};
  // the key leaves any other action that had it
  for (const [other] of KEY_ACTIONS) if (other !== id && keyFor(other) === k) SETTINGS.keys[other] = DEFAULT[id];
  if (k === DEFAULT[id]) delete SETTINGS.keys[id]; else SETTINGS.keys[id] = k;
  map = null;
}
export function resetKeys() { SETTINGS.keys = {}; map = null; }
