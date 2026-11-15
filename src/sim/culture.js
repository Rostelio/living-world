// Cultures & faiths (Phase 8, after Europa Universalis V).
// Each race begins with its own faith; heresies split off in troubled lands.
// Settlements have a culture (their people's race) and a faith; realms have a
// state faith, a tolerance policy and a list of accepted cultures.
import { G, S, log, civOf } from './state.js';
import { RACES } from '../data/races.js';
import { invalidateMods } from './mods.js';
import { lvl } from './settlements.js';

export const BASE_FAITHS = {
  radiant: { name: 'Church of the Radiant Sun', short: 'Radiance', race: 'humans', color: '#f2c94c', fx: { stability: 2 }, desc: 'Order, law and the light of the sun.' },
  grove: { name: 'The Eternal Grove', short: 'Grove', race: 'elves', color: '#2fbf71', fx: { knowledge: 0.05 }, desc: 'The living forest remembers all.' },
  ancestors: { name: 'Halls of the Ancestors', short: 'Ancestor Cult', race: 'dwarves', color: '#b9770e', fx: { stone: 0.05, iron: 0.05 }, desc: 'Honour the dead who carved the deeps.' },
  bloodgods: { name: 'The Blood Gods', short: 'Blood Gods', race: 'orcs', color: '#c0392b', fx: { defense: 10 }, desc: 'Strength is worship; battle is prayer.' },
  serpent: { name: 'The Coiled Serpent', short: 'Serpent Cult', race: 'lizardfolk', color: '#16a085', fx: { growth: 0.05 }, desc: 'The world-serpent sheds its skin and is reborn.' },
  hearth: { name: 'The Hearth Mothers', short: 'Hearth', race: 'halflings', color: '#e67e22', fx: { food: 0.05 }, desc: 'Home, harvest and a full table.' },
};
const RACE_FAITH = Object.fromEntries(Object.entries(BASE_FAITHS).map(([id, f]) => [f.race, id]));
export const raceFaith = (race) => RACE_FAITH[race];
const PREFIX = ['Reformed', 'True', 'Free', 'Old', 'New', 'Mystic', 'Ascetic', 'Purified', 'Twilight', 'Dawn'];
const HERESY_FX = [{ stability: 2 }, { knowledge: 0.06 }, { gold: 0.06 }, { growth: 0.05 }, { defense: 10 }, { food: 0.05 }];

export function ensureFaiths(st) {
  st.faiths ??= {};
  for (const id in BASE_FAITHS) st.faiths[id] ??= { id, ...BASE_FAITHS[id], parent: null, root: id, founded: 0 };
  st.nextFaithId ??= 1;
  for (const c of st.civs) {
    c.faith ??= raceFaith(c.race);
    c.tolerance ??= 'tolerant';
    c.accepted ??= [];
  }
  for (const s of st.settlements) {
    s.faith ??= st.civs[s.civ].faith;
    s.convert ??= 0; s.assim ??= 0;
  }
}
export const faithOf = (id) => S().faiths?.[id];
export const faithName = (id) => faithOf(id)?.name ?? '—';
export const sameFamily = (a, b) => a && b && faithOf(a)?.root === faithOf(b)?.root;
export const acceptedCulture = (civ, race) => race === civ.race || civ.accepted.includes(race);
export const maxAccepted = (civ) => 1 + Math.min(3, civ.era);

// ---------------- Unrest & opinion contributions ----------------
export function religionUnrest(civ, s) {
  const items = [];
  if (s.faith && s.faith !== civ.faith) items.push([`Other faith (${faithOf(s.faith)?.short || '?'})`, civ.tolerance === 'enforced' ? 12 : sameFamily(s.faith, civ.faith) ? 3 : 5]);
  if (s.culture && s.culture !== civ.race) {
    if (acceptedCulture(civ, s.culture)) items.push([`Accepted culture (${RACES[s.culture].adj})`, 3]);
    else items.push([`Foreign culture (${RACES[s.culture].adj})`, 15]);
  }
  return items;
}
export function faithOpinion(a, b) {
  const A = civOf(a), B = civOf(b);
  if (!A.faith || !B.faith) return null;
  if (A.faith === B.faith) return ['Same faith', 12];
  if (sameFamily(A.faith, B.faith)) return ['Related faiths', 3];
  return ['Different faiths', -6];
}

// ---------------- Monthly: conversion, assimilation, heresy ----------------
export function cultureMonthly(civ) {
  const st = S();
  const setts = civ.settlements.map((id) => st.settlements[id]);
  for (const s of setts) {
    if (s.faith !== civ.faith) {
      const enforced = civ.tolerance === 'enforced';
      s.convert += (enforced ? 0.5 : 0.12) + lvl(s, 'temple') * (enforced ? 0.5 : 0.15);
      if (s.convert >= 100) {
        const from = faithOf(s.faith)?.short;
        s.faith = civ.faith; s.convert = 0;
        if (civ.isPlayer) log(`${s.name} converts from ${from} to ${faithOf(civ.faith).short}.`, { civ: civ.id, type: 'good', tile: s.tile });
      }
    } else s.convert = 0;
    if (s.culture !== civ.race) {
      s.assim += (s.faith === civ.faith ? 0.12 : 0.05) * (acceptedCulture(civ, s.culture) ? 0.5 : 1);
      if (s.assim >= 100) {
        const from = RACES[s.culture].adj;
        s.culture = civ.race; s.assim = 0; s.conquered = null; s.rev++;
        if (civ.isPlayer) log(`The ${from} people of ${s.name} now consider themselves ${RACES[civ.race].adj}.`, { civ: civ.id, type: 'good', tile: s.tile });
      }
    } else s.assim = 0;
  }
  // Heresies arise in troubled lands and spread to restless neighbours.
  for (const s of setts) {
    if ((s.unrest || 0) > 45 && lvl(s, 'temple') + (s.stage >= 2 ? 1 : 0) > 0 && G.rng.chance(0.0025)) {
      const h = createHeresy(s.faith, civ);
      s.faith = h; s.convert = 0;
      log(`A new faith, ${faithOf(h).name}, takes hold in ${s.name}!`, { civ: civ.id, type: civ.isPlayer ? 'bad' : 'world', toast: civ.isPlayer, tile: s.tile, major: true });
      break;
    }
  }
  const W = G.world;
  for (const s of setts) {
    const f = faithOf(s.faith);
    if (!f?.parent || s.faith === civ.faith) continue;
    for (const o of setts) {
      if (o === s || o.faith === s.faith || !sameFamily(o.faith, s.faith) || (o.unrest || 0) < 30) continue;
      const d = Math.hypot((o.tile % W.w) - (s.tile % W.w), ((o.tile / W.w) | 0) - ((s.tile / W.w) | 0));
      if (d < 25 && G.rng.chance(0.03)) { o.faith = s.faith; o.convert = 0; }
    }
  }
  // AI realms may embrace a faith that has won over most of their people.
  if (!civ.isPlayer && setts.length >= 3) {
    const count = {};
    for (const s of setts) count[s.faith] = (count[s.faith] || 0) + s.pop;
    const total = setts.reduce((a, s) => a + s.pop, 0);
    for (const fid in count) if (fid !== civ.faith && count[fid] > total * 0.6 && G.rng.chance(0.2)) { adoptFaith(civ, fid); break; }
  }
}

export function createHeresy(parentId, civ) {
  const st = S();
  const parent = faithOf(parentId) || faithOf(raceFaith(civ.race));
  const id = 'h' + st.nextFaithId++;
  const used = new Set(Object.values(st.faiths).map((f) => f.name));
  let name;
  for (let k = 0; k < 20; k++) { name = `${G.rng.pick(PREFIX)} ${parent.short}`; if (!used.has(name)) break; }
  const shade = (hex, amt) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + amt)).toString(16).padStart(2, '0')).join('');
  st.faiths[id] = { id, name, short: name, race: parent.race, parent: parent.id, root: parent.root, founded: st.day, color: shade(parent.color, G.rng.chance(0.5) ? 50 : -50), fx: G.rng.pick(HERESY_FX), desc: `A heresy of ${parent.name}.` };
  return id;
}

// ---------------- Policies ----------------
export function setTolerance(civ, mode) {
  if (civ.tolerance === mode) return { ok: false };
  civ.tolerance = mode;
  civ.stability = Math.max(0, civ.stability - 4);
  return { ok: true };
}
export function acceptCulture(civ, race) {
  if (civ.accepted.includes(race) || race === civ.race) return { ok: false, reason: 'Already accepted' };
  if (civ.accepted.length >= maxAccepted(civ)) return { ok: false, reason: `At most ${maxAccepted(civ)} accepted cultures in this era` };
  if (civ.treasury < 100) return { ok: false, reason: 'Needs 100 gold' };
  civ.treasury -= 100;
  civ.accepted.push(race);
  civ.stability = Math.max(0, civ.stability - 5);
  log(`${civ.displayName} accepts the ${RACES[race].adj} people as equals.`, { civ: civ.id, type: civ.isPlayer ? 'good' : 'world', major: true });
  return { ok: true };
}
export function revokeCulture(civ, race) {
  civ.accepted = civ.accepted.filter((r) => r !== race);
  civ.stability = Math.max(0, civ.stability - 3);
}
export function adoptFaith(civ, faithId) {
  if (civ.faith === faithId) return { ok: false };
  const from = faithOf(civ.faith)?.name;
  civ.faith = faithId;
  civ.stability = Math.max(0, civ.stability - 15);
  invalidateMods(civ);
  const msg = `${civ.displayName} abandons ${from} and embraces ${faithOf(faithId).name}.`;
  civ.history.push({ day: S().day, text: msg });
  log(msg, { civ: civ.id, type: civ.isPlayer ? 'info' : 'world', toast: civ.isPlayer, major: true });
  return { ok: true };
}

// AI policy choices (yearly)
export function aiCultureYearly(civ) {
  if (civ.isPlayer) return;
  const want = ['militaristic', 'defensive'].includes(civ.personality) ? 'enforced' : 'tolerant';
  if (civ.tolerance !== want && G.rng.chance(0.2)) setTolerance(civ, want);
  const counts = {};
  for (const id of civ.settlements) { const s = S().settlements[id]; if (s.culture !== civ.race) counts[s.culture] = (counts[s.culture] || 0) + 1; }
  for (const r in counts) if (counts[r] >= 3 && !civ.accepted.includes(r) && civ.stability > 45 && G.rng.chance(0.3)) { acceptCulture(civ, r); break; }
}

// Population of a realm by culture and by faith (for panels)
export function realmDemographics(civ) {
  const cultures = {}, faiths = {};
  for (const id of civ.settlements) {
    const s = S().settlements[id];
    cultures[s.culture] = (cultures[s.culture] || 0) + s.pop;
    faiths[s.faith] = (faiths[s.faith] || 0) + s.pop;
  }
  return { cultures, faiths };
}
