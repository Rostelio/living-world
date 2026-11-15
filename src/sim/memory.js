// Phase 17 — rulers with personalities who remember. Every realm keeps a memory of what others
// did to it (wars declared, land taken, alliances broken, gifts, help in war). Memories fade
// with time — slower under a vengeful ruler, faster under a forgiving one — and feed opinion,
// AI war plans (revenge, retaking lost towns) and loyalty to allies.
import { G, S, civOf } from './state.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const MEMORY_KINDS = {
  war_declared: { text: 'declared war on us', v: -30, years: 30 },
  land_taken: { text: 'took {s} from us', v: -30, years: 60 },
  vassalised: { text: 'forced us into vassalage', v: -25, years: 40 },
  alliance_broken: { text: 'betrayed our alliance', v: -28, years: 30 },
  offer_refused: { text: 'refused our proposal', v: -6, years: 5 },
  insulted: { text: 'insulted our court', v: -15, years: 12 },
  gift: { text: 'sent us generous gifts', v: 10, years: 10 },
  war_aid: { text: 'fought at our side', v: 20, years: 30 },
  honourable_peace: { text: 'made an honourable peace', v: 6, years: 12 },
  hero_saved: { text: 'sent their hero to aid us', v: 14, years: 20 },
};

// Temperament of a realm's current ruler (from character traits)
export function temperament(civ) {
  const t = civ?.ruler?.traits || [];
  const has = (k) => t.includes(k);
  let war = 1, grudge = 1, loyal = 1, greed = 1;
  if (has('ambitious')) war *= 1.3;
  if (has('brave')) war *= 1.12;
  if (has('cruel')) { war *= 1.12; grudge *= 1.4; }
  if (has('paranoid')) grudge *= 1.3;
  if (has('just')) { war *= 0.85; grudge *= 0.75; loyal *= 1.3; }
  if (has('honest')) { loyal *= 1.25; grudge *= 0.9; }
  if (has('pious')) war *= 0.92;
  if (has('lazy')) war *= 0.85;
  if (has('schemer')) loyal *= 0.75;
  if (has('greedy')) greed *= 1.5;
  if (has('charismatic')) grudge *= 0.9;
  const labels = [];
  if (war >= 1.25) labels.push('Warlike'); else if (war <= 0.85) labels.push('Peaceable');
  if (grudge >= 1.25) labels.push('Vengeful'); else if (grudge <= 0.8) labels.push('Forgiving');
  if (loyal >= 1.2) labels.push('Loyal'); else if (loyal <= 0.8) labels.push('Treacherous');
  if (greed > 1.2) labels.push('Greedy');
  return { war, grudge, loyal, greed, label: labels.join(', ') || 'Even-tempered' };
}

// `who` remembers what `about` did
export function remember(who, about, kind, extra = {}) {
  const st = S();
  const W = civOf(who);
  if (!W?.alive || who === about || !MEMORY_KINDS[kind]) return;
  W.memory ??= [];
  const same = W.memory.find((m) => m.about === about && m.kind === kind && (!extra.s || m.s === extra.s));
  if (same) { same.day = st.day; same.n = Math.min(3, (same.n || 1) + 1); return; }
  const m = { about, kind, day: st.day, n: 1 };
  if (extra.s != null) m.s = extra.s;
  if (extra.name) m.name = extra.name;
  W.memory.push(m);
  if (W.memory.length > 40) W.memory.shift();
}

// Strength of a memory now (signed opinion points)
export function memoryValue(civ, m) {
  const K = MEMORY_KINDS[m.kind];
  if (!K) return 0;
  const T = temperament(civ);
  const span = K.years * 360 * (K.v < 0 ? T.grudge : 1 / Math.max(0.6, T.grudge));
  const age = S().day - m.day;
  if (age >= span) return 0;
  const mult = K.v < 0 ? T.grudge : 1;
  return K.v * mult * (1 - age / span) * (1 + 0.35 * ((m.n || 1) - 1));
}
export const memoryText = (m) => (MEMORY_KINDS[m.kind]?.text || m.kind).replace('{s}', m.name || 'a town');

// Opinion items for the pair (a, b): what each remembers of the other
export function memoryItems(a, b) {
  const out = [];
  for (const [x, y] of [[a, b], [b, a]]) {
    const X = civOf(x);
    for (const m of X?.memory || []) {
      if (m.about !== y) continue;
      const v = memoryValue(X, m);
      if (Math.abs(v) < 1) continue;
      out.push([`${X.baseName} remembers: they ${memoryText(m)}`, Math.round(v * 0.5)]);
    }
  }
  return out;
}
// Total grievance `who` holds against `about` (positive number = hate)
export function grievance(who, about) {
  const W = civOf(who);
  let g = 0;
  for (const m of W?.memory || []) if (m.about === about) g -= Math.min(0, memoryValue(W, m));
  return g;
}
// Towns `who` lost to `about` that `about` still holds — revenge targets
export function lostTowns(who, about) {
  const W = civOf(who), st = S();
  const out = [];
  for (const m of W?.memory || []) {
    if (m.about !== about || m.kind !== 'land_taken' || m.s == null) continue;
    const s = st.settlements[m.s];
    if (s && !s.dead && s.civ === about && memoryValue(W, m) < -3) out.push(s);
  }
  return out;
}

export function memoryYearly(civ) {
  if (!civ.memory?.length) return;
  civ.memory = civ.memory.filter((m) => civOf(m.about)?.alive && Math.abs(memoryValue(civ, m)) >= 0.5);
}

export function ensurePhase17Memory(st) {
  for (const c of st.civs) c.memory ??= [];
}
void G; void clamp;
