import { RNG } from '../core/rng.js';

// Global container. `world` is static & regenerated from seed; `state` is the
// fully serializable dynamic simulation state (what gets saved / synced).
export const G = {
  world: null,
  state: null,
  rng: null,
  listeners: { event: [], ownership: [], settlement: [], month: [], fx: [] },
  dirty: { owners: true, roads: true },
};

export const S = () => G.state;
export const civOf = (id) => G.state.civs[id];
export const player = () => G.state.civs[G.state.playerId];
export const settlement = (id) => G.state.settlements[id];

export function on(type, fn) { G.listeners[type].push(fn); }
export function emit(type, payload) { for (const fn of G.listeners[type]) fn(payload); }

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const MONTH_NAMES = ['Frostmoot', 'Thawmonth', 'Seedtide', 'Greenleaf', 'Bloomrise', 'Highsun', 'Goldfield', 'Harvest', 'Leaffall', 'Mistmoot', 'Darkmonth', 'Yulewane'];

export function dateOf(day) {
  const d = day % DAYS_PER_MONTH + 1;
  const m = Math.floor(day / DAYS_PER_MONTH) % MONTHS_PER_YEAR;
  const y = Math.floor(day / (DAYS_PER_MONTH * MONTHS_PER_YEAR)) + 1;
  return { d, m, y, monthName: MONTH_NAMES[m] };
}
export function dateStr(day) {
  const { d, monthName, y } = dateOf(day);
  return `${d} ${monthName}, Year ${y}`;
}
export function shortDate(day) {
  const { m, y } = dateOf(day);
  return `${MONTH_NAMES[m].slice(0, 3)} Y${y}`;
}

// Major world events are also written to the permanent world chronicle.
const MAJOR = /WAR!|falls to|collapsed|enters the .* Era|reforms from|REVOLUTION|revolution triumphs|independence|claims the throne|deposed|becomes a vassal|is crushed|House .* (loses the throne|rises)|founded .* in|has grown into a (City|Metropolis)|forge an alliance/;

// Event log. type: info | good | bad | world
export function log(text, opts = {}) {
  const st = G.state;
  const entry = { day: st.day, text, type: opts.type || 'info', civ: opts.civ ?? -1, toast: !!opts.toast, tile: opts.tile ?? -1 };
  st.log.push(entry);
  if (st.log.length > 250) st.log.splice(0, st.log.length - 250);
  if (opts.major || MAJOR.test(text)) {
    st.chronicle ??= [];
    // Settlement foundings are only chronicled for cities (too frequent otherwise)
    if (!/founded .* in/.test(text) || entry.civ === st.playerId) {
      st.chronicle.push({ day: st.day, text, civ: entry.civ, tile: entry.tile });
      if (st.chronicle.length > 600) st.chronicle.splice(0, st.chronicle.length - 600);
    }
  }
  emit('event', entry);
}

export function makeRng(seed) { G.rng = new RNG(seed); return G.rng; }
