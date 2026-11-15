// Phase 17 — translations. English is the source language; other languages map English text to
// their own. `t()` translates strings in code; a DOM pass translates rendered interface text
// (exact phrases and patterned sentences), so panels don't need rewriting call by call.
// Translation is display-only: it never touches the game state or saves.
import { UK, UK_PATTERNS, ukPost } from './lang-uk.js';

export const LANGS = { en: 'English', uk: 'Українська' };
let lang = 'en';
let DICT = null, PATS = [];
export const currentLang = () => lang;
export function setLang(l) {
  lang = LANGS[l] ? l : 'en';
  DICT = lang === 'uk' ? UK : null;
  CACHE.clear(); SHAPES.clear();
  PATS = lang === 'uk' ? UK_PATTERNS : [];
  document.documentElement.lang = lang;
  if (DICT) translateDom(document.body);
}

// Translate one string (exact phrase, then patterns); unknown text is returned unchanged
const CACHE = new Map();
let depth = 0;
export const STATS = { ms: 0, calls: 0, miss: 0 };
const SHAPES = new Map();
const NUM = /[0-9]+(?:[.,][0-9]+)*/g;
export function t(s) {
  if (!DICT || s == null) return s;
  const k = String(s);
  const c = CACHE.get(k);
  if (c !== undefined) return c;
  // same sentence with different numbers? reuse its translation template
  const nums = depth === 0 ? k.match(NUM) : null;
  let shape = null;
  if (nums) {
    shape = k.replace(NUM, '\u0001');
    const tpl = SHAPES.get(shape);
    if (tpl !== undefined) { let i = 0; const r = tpl === null ? k : tpl.replace(/\u0001/g, () => nums[i++]); CACHE.set(k, r); return r; }
  }
  if (depth > 10) return k;
  depth++;
  let r;
  STATS.miss++;
  try { r = tr0(k); } catch { r = k; } finally { depth--; }
  if (lang === 'uk') r = ukPost(r);
  if (CACHE.size > 6000) CACHE.clear();
  CACHE.set(k, r);
  if (shape) {
    // remember the template only if the numbers survive in the same order
    const rn = r.match(NUM) || [];
    if (r === k) SHAPES.set(shape, null);
    else if (rn.length === nums.length && rn.every((x, i) => x === nums[i])) { let i = 0; SHAPES.set(shape, r.replace(NUM, () => (i++, '\u0001'))); }
    if (SHAPES.size > 4000) SHAPES.clear();
  }
  return r;
}
function tr0(k) {
  const hit = DICT[k];
  if (hit != null) return hit;
  const tr = k.trim();
  // several lines (tooltips): translate each line
  if (tr.includes('\n')) return k.replace(tr, tr.split('\n').map((x) => (x.trim() ? tr0(x) : x)).join('\n'));
  if (tr !== k && DICT[tr] != null) return k.replace(tr, DICT[tr]);
  for (const [re, fn] of PATS) { const m = tr.match(re); if (!m) continue; const r = typeof fn === 'function' ? fn(m, t) : tr.replace(re, fn); if (r && r !== tr) return k.replace(tr, r); }
  // several sentences: translate each one, if every one is known
  const sents = tr.split(/(?<=[.!?])\s+(?=[A-Z+\-−(])/);
  if (sents.length > 1) { const rs = sents.map((x) => t(x)); if (rs.every((x, i) => x !== sents[i])) return k.replace(tr, rs.join(' ')); }
  // "Label: rest" — translate both halves
  const lab = tr.match(/^([A-Z][\w ’'&-]{1,30}): (.+)$/);
  if (lab) { const a1 = t(lab[1]), b1 = t(lab[2]); if (a1 !== lab[1] && b1 !== lab[2]) return k.replace(tr, `${a1}: ${b1}`); }
  // lists ("A, B · C"): translate the parts that are known, keep names as they are
  if (/, | · /.test(tr)) { const parts = tr.split(/(, | · )/); let any = false; const out = parts.map((p) => { if (p === ', ' || p === ' · ') return p; const r = DICT[p.trim()] != null ? p.replace(p.trim(), DICT[p.trim()]) : p; if (r !== p) any = true; return r; }); if (any) return k.replace(tr, out.join('')); }
  // a leading icon or emoji: translate the words after it
  const lead = tr.match(/^([^A-Za-z]{1,4})([A-Z].*)$/);
  if (lead) { const r = tr0(lead[2]); if (r !== lead[2]) return k.replace(tr, lead[1] + r); }
  return k;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS']);
function translateNode(n) {
  if (n.nodeType === 3) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-z]/.test(v) || v.length > 400) return;
    const r = t(v);
    if (r !== v) n.nodeValue = r;
    return;
  }
  if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.dataset?.noTr != null) return;
  for (const a of ['title', 'placeholder']) { const v = n.getAttribute?.(a); if (v && /[A-Za-z]/.test(v)) { const r = t(v); if (r !== v) n.setAttribute(a, r); } }
  for (const c of n.childNodes) translateNode(c);
}
export function translateDom(root) { if (DICT && root) translateNode(root); }

// Watch the interface: anything rendered gets translated on the fly
let obs = null;
export function initI18n(l) {
  setLang(l);
  if (obs) return;
  obs = new MutationObserver((muts) => {
    if (!DICT) return;
    const t0 = performance.now();
    for (const m of muts) {
      try {
        if (m.type === 'characterData') translateNode(m.target);
        else for (const n of m.addedNodes) translateNode(n);
      } catch (e) { console.warn('translate', e); }
    }
    STATS.ms += performance.now() - t0; STATS.calls++;
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}
