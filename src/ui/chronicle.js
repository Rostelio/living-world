// Phase 17 — the Chronicle: an illustrated book of your realm's history. Each chapter is a
// reign; entries carry a small pixel vignette (war, crown, hero, plague, ship, castle …).
// Built only from the saved chronicle and ruler list — it never changes the game state.
import { S, player } from '../sim/state.js';
import { makeCanvas } from '../render/sprites.js';
import { frameCanvas } from '../sprites.js';
import { escapeHtml as E } from '../core/util.js';
import { rulerFullName } from '../sim/government.js';
import { HERO_KINDS } from '../sim/stories.js';
import { t } from './i18n.js';

// ---- vignettes: 24×18 pixel pictures, drawn once per kind ----
const VIG = {};
function vignette(kind) {
  if (VIG[kind]) return VIG[kind];
  const art = frameCanvas('vignette_' + kind, 0, [48, 36]);
  if (art) return (VIG[kind] = art.toDataURL());
  const c = makeCanvas(24, 18);
  const x = c.getContext('2d');
  const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  // sky & ground
  P(0, 0, 24, 18, '#e8d6a8'); P(0, 13, 24, 5, '#b8a070');
  const ink = '#3a2614';
  switch (kind) {
    case 'war':
      for (let i = 0; i < 10; i++) { P(6 + i, 3 + i, 1, 1, '#9aa4ae'); P(17 - i, 3 + i, 1, 1, '#9aa4ae'); }
      P(5, 12, 4, 1, '#7a5a30'); P(15, 12, 4, 1, '#7a5a30'); P(11, 1, 2, 2, '#c03020');
      break;
    case 'crown':
      P(6, 7, 12, 5, '#e6b840'); P(6, 4, 2, 3, '#e6b840'); P(11, 3, 2, 4, '#e6b840'); P(16, 4, 2, 3, '#e6b840'); P(8, 9, 2, 2, '#c03030'); P(14, 9, 2, 2, '#3060c0'); P(6, 11, 12, 1, '#a07820');
      break;
    case 'death':
      P(8, 4, 8, 7, '#f0ead8'); P(9, 6, 2, 2, ink); P(13, 6, 2, 2, ink); P(10, 11, 4, 2, '#f0ead8'); P(10, 12, 1, 1, ink); P(13, 12, 1, 1, ink);
      break;
    case 'city':
      P(3, 8, 5, 5, '#c8b8a0'); P(9, 5, 6, 8, '#d8c8b0'); P(16, 7, 5, 6, '#c8b8a0'); P(3, 6, 5, 2, '#a04030'); P(9, 3, 6, 2, '#a04030'); P(16, 5, 5, 2, '#a04030'); P(11, 9, 2, 4, ink);
      break;
    case 'hero':
      P(11, 3, 3, 3, '#e8c8a0'); P(10, 6, 5, 5, '#3060a0'); P(10, 11, 2, 2, ink); P(13, 11, 2, 2, ink); P(16, 1, 1, 10, '#c8ccd4'); P(15, 8, 3, 1, '#a07820');
      for (const [a, b] of [[4, 2], [20, 4], [6, 9], [19, 10]]) P(a, b, 1, 1, '#ffd84a');
      break;
    case 'plague':
      P(0, 0, 24, 13, '#c8c8a0'); P(8, 4, 8, 7, '#d0e0b0'); P(9, 6, 2, 2, '#3a5a20'); P(13, 6, 2, 2, '#3a5a20'); for (let i = 0; i < 6; i++) P(2 + i * 4, 1 + (i % 2), 1, 1, '#6a8a40');
      break;
    case 'ship':
      P(0, 12, 24, 6, '#5a88b0'); P(5, 10, 14, 3, '#7a4e2a'); P(11, 2, 1, 8, ink); P(12, 3, 6, 6, '#f4ecd8'); P(5, 3, 6, 5, '#f4ecd8');
      break;
    case 'alliance':
      P(4, 8, 8, 3, '#e8c8a0'); P(12, 8, 8, 3, '#c8a078'); P(10, 7, 4, 5, '#e8c8a0'); P(2, 7, 3, 5, '#3060a0'); P(19, 7, 3, 5, '#a03030');
      break;
    case 'faith':
      P(11, 2, 2, 11, '#e6c868'); P(8, 5, 8, 2, '#e6c868'); for (const [a, b] of [[4, 4], [19, 6], [6, 10], [18, 1]]) P(a, b, 1, 1, '#fff4c0');
      break;
    case 'era':
      P(8, 5, 8, 8, '#f0b040'); P(10, 3, 4, 12, '#f0b040'); P(6, 7, 12, 4, '#f0b040'); P(10, 7, 4, 4, '#ffe08a');
      break;
    case 'revolt':
      P(4, 4, 1, 9, ink); P(5, 4, 7, 4, '#c03020'); for (let i = 0; i < 4; i++) P(13 + i * 2, 9 - (i % 2), 2, 4, '#7a5a40');
      break;
    default:
      P(5, 3, 14, 11, '#f4ecd8'); P(5, 3, 14, 1, '#c8b080'); P(5, 13, 14, 1, '#c8b080'); for (let i = 0; i < 4; i++) P(7, 5 + i * 2, 10 - (i % 2) * 3, 1, '#7a6a50');
  }
  // inked frame
  x.strokeStyle = ink; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 23, 17);
  VIG[kind] = c.toDataURL();
  return VIG[kind];
}
export function entryKind(text) {
  if (/hero rises|Their legend|Dragonbane|slew the/i.test(text)) return 'hero';
  if (/WAR!|War ends|falls to|takes|crushed|Battle|besieg/i.test(text)) return 'war';
  if (/throne|crowned|House .* rises|succeeds|claims the throne|regency/i.test(text)) return 'crown';
  if (/collapsed|vanished|has died|dies/i.test(text)) return 'death';
  if (/Sickness|plague|famine/i.test(text)) return 'plague';
  if (/Captain|expedition|sea|fleet/i.test(text)) return 'ship';
  if (/alliance|marriage|trade agreement/i.test(text)) return 'alliance';
  if (/shrine|council|faith|Reformation|creed|temple/i.test(text)) return 'faith';
  if (/Era|reforms from/i.test(text)) return 'era';
  if (/REVOLUTION|revolution|independence|pretender|rebel/i.test(text)) return 'revolt';
  if (/City|Metropolis|founded|grown into|wonder|monument/i.test(text)) return 'city';
  return 'scroll';
}

// Chapters = reigns of the player's realm (oldest first)
function chapters(civ) {
  const st = S();
  const out = (civ.rulers || []).map((r) => ({ title: r.name, house: r.dynasty, from: r.from, to: r.to, cause: r.cause }));
  out.push({ title: rulerFullName(civ), house: civ.ruler.dynasty, from: civ.ruler.since ?? 0, to: st.day, current: true });
  if (out.length && out[0].from > 0) out.unshift({ title: t('The Founding'), house: '', from: 0, to: out[0].from });
  return out;
}

let page = -1;
export function openChronicle(showModal, at = null) {
  const st = S();
  const civ = player();
  const ch = chapters(civ);
  if (at != null) page = at; if (page < 0 || page >= ch.length) page = ch.length - 1;
  const c = ch[page];
  const mine = (st.chronicle || []).filter((e) => e.day >= c.from && e.day <= c.to && (e.civ === civ.id || /WAR!/.test(e.text) && e.text.includes(civ.baseName)));
  const world = (st.chronicle || []).filter((e) => e.day >= c.from && e.day <= c.to && e.civ !== civ.id && !mine.includes(e)).slice(-6);
  const y = (d) => Math.floor(d / 360) + 1;
  const entry = (e) => `<div class="chr-entry"><img class="chr-vig" src="${vignette(entryKind(e.text))}" alt=""><div><div class="chr-year">${t('Year')} ${y(e.day)}</div><div>${E(e.text)}</div></div></div>`;
  const heroes = (civ.heroes || []).filter((h) => h.born <= c.to && (h.died ?? st.day) >= c.from);
  const left = `<div class="chr-page left">
      <div class="chr-chapter">${t('Chapter')} ${page + 1}</div>
      <div class="chr-title">${E(c.title)}</div>
      <div class="chr-sub">${c.house ? `${t('House')} ${E(c.house)} · ` : ''}${t('Year')} ${y(c.from)}–${c.current ? t('today') : y(c.to)}${c.cause ? ` · ${E(c.cause)}` : ''}</div>
      <div class="chr-illu"><img src="${vignette(c.current ? 'crown' : c.cause && /died|death|age/i.test(c.cause) ? 'death' : 'crown')}" alt=""></div>
      ${heroes.length ? `<div class="chr-h">${t('Heroes of this age')}</div>${heroes.map((h) => `<div class="chr-hero">${HERO_KINDS[h.kind]?.icon || '✦'} <b>${E(h.name)} ${E(h.epithet)}</b>, ${E(HERO_KINDS[h.kind]?.name.toLowerCase() || '')}${h.deeds.length ? ` — ${E(h.deeds.slice(0, 2).join('; '))}` : ''}${h.alive ? '' : ' †'}</div>`).join('')}` : ''}
      ${world.length ? `<div class="chr-h">${t('Meanwhile in the world')}</div>${world.map((e) => `<div class="chr-world">${E(e.text)}</div>`).join('')}` : ''}
    </div>`;
  const right = `<div class="chr-page right">${mine.length ? mine.slice(-14).map(entry).join('') : `<div class="chr-empty">${t('A quiet age: no great deeds were written down.')}</div>`}</div>`;
  showModal(`<div class="modal-box chronicle-book">
    <div class="chr-head"><span class="chr-book-title">${t('The Chronicle of')} ${E(civ.displayName)}</span>
      <span class="chr-nav"><button class="btn sm" data-action="chronPage" data-p="${page - 1}" ${page <= 0 ? 'disabled' : ''}>◀</button> ${page + 1} / ${ch.length} <button class="btn sm" data-action="chronPage" data-p="${page + 1}" ${page >= ch.length - 1 ? 'disabled' : ''}>▶</button></span></div>
    <div class="chr-spread">${left}${right}</div>
    <div class="actions"><button class="btn" data-action="menuItem" data-item="resume">${t('Close the book')}</button></div>
  </div>`);
}
