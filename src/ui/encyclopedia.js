// Phase 15 — the encyclopedia: a searchable reference built from the game's own data.
import { GOODS, GOOD_LIST, POPS, POP_LIST, PRODUCTION } from '../data/goods.js';
import { BUILDINGS, BUILDING_LIST } from '../data/buildings.js';
import { RESOURCES } from '../data/biomes.js';
import { TRAITS as PTRAITS, TRAIT_LIST as PTRAIT_LIST } from '../world/regions.js';
import { LAWS, LAW_CATS, GROUPS, GROUP_LIST } from '../data/politics.js';
import { TRAITS, TRAIT_LIST, LIFESTYLES, LIFESTYLE_LIST } from '../data/governments.js';
import { UNITS, UNIT_LIST } from '../data/military.js';
import { TECHS, ERAS } from '../data/techs.js';
import { MONUMENTS, MONUMENT_LIST } from '../sim/treasury.js';
import { DISASTERS, POWERS } from '../sim/disasters.js';
import { escapeHtml as E } from '../core/util.js';

const fx = (o) => Object.entries(o || {}).map(([k, v]) => `${k} ${Math.abs(v) < 1 ? (v > 0 ? '+' : '') + Math.round(v * 100) + '%' : (v > 0 ? '+' : '') + v}`).join(', ');
const ARTICLES = [
  ['Getting started', 'Choose a technology (T), build farms and a lumber camp (C), and let your camp grow into a village. Send settlers to unclaimed provinces (right-click the map). Reform into a monarchy once you know Code of Laws. Press V for an overview of what needs attention.'],
  ['Pops & living standards', 'Every settlement\'s people belong to professions. Buildings give them jobs and wages; they pay taxes and buy food, fuel, clothing and luxuries. What they can afford sets their living standard (0–10), which drives growth, stability and unrest.'],
  ['Goods & markets', 'Each realm has a market: prices rise when goods are scarce and fall when plentiful. Market levels are tiers (Local Market → Market Hall → Trade Fair → Exchange) that steady prices and unlock trade routes, merchant companies and — with a harbour in the Renaissance — the world market. Missing building materials are imported at a markup.'],
  ['Provinces, slots & traits', 'Deposits cluster by region (iron in mountains, spices in the tropics…). Buildings need the right land, and each town has limited building slots, so towns specialise. Province traits such as Fertile Valley or Rich Vein boost or limit what can be built.'],
  ['Stability & unrest', 'Stability comes from government, laws, rulers, faith, living standards and interest groups; taxes, overextension and a sprawling realm reduce it. Unrest in a settlement rises with low stability, poverty, other faiths, distance from the capital and recent conquest — and can end in revolt.'],
  ['Laws & interest groups', 'Seven interest groups gain clout from their members. Laws please some and anger others; enacting a law takes months and goes faster with support. Angry, powerful groups form movements that can force a law on you or start a revolution (Politics panel, O).'],
  ['Characters & succession', 'Rulers have skills and traits and choose a lifestyle. Marry to get children (and claims on your spouse\'s realm). Succession laws decide who inherits; partition splits the realm among children. Courtiers have opinions — and may plot (Court panel, K).'],
  ['Diplomacy & crises', 'Trade agreements, alliances and royal marriages raise opinion. Wars begin as crises: a demand (a province, tribute, vassalage, humiliation, a claim) that escalates to war unless someone backs down. AI realms make demands for things they want — land with resources they lack, rivals to humble — and only when they feel strong enough.'],
  ['War, occupation & peace', 'Armies besiege and occupy towns. Occupied towns pay nothing and add war score; at the peace table you choose which to keep. Armies far from supply lines, in winter or harsh terrain suffer attrition. Rulers and courtiers can command — and fall.'],
  ['Exploration & fog of war', 'With fog of war you only see your own region at first. Send expeditions from the Military panel or the right-click menu, exchange maps in Diplomacy; trade partners and allies share maps yearly.'],
  ['Money', 'Taxes, trade and companies bring gold; wages, armies, laws, interest and patronage cost it. Loans tide you over (too many lead to bankruptcy). Spend surpluses on monuments, patronage, mercenaries or bribes.'],
  ['Great works, inflation & administration', 'Great works (Economy panel) are repeatable landmarks built in a town of your choice: canals, cathedrals, universities, palaces, harbour works, boulevards and world\'s fairs. Hoarding more than six months of income causes inflation, which raises every gold cost. Holding more settlements than your administrative reach costs a share of taxes and trade; town halls, a Grand Palace, laws and codified law extend the reach.'],
  ['Ambitions, coalitions & world crises', 'AI realms set long ambitions (a town to take, a rival to humble) and pursue them for decades. When one realm grows too large, its neighbours may form a coalition against it, and you may be invited to join. From about year 90, world crises strike every few decades: great wars, revolutions, plagues, crashes and schisms.'],
  ['Trade routes & caravans', 'Open caravan routes in the Economy panel with realms you have a trade agreement or alliance with (both need markets). Routes raise trade income; better markets allow road convoys and merchant fleets. War and unrest invite raiders who cut a route for months, unless it is escorted. Trading posts add trade income. Caravans and ships can be seen travelling the map.'],
  ['Missions & decisions', 'The Missions panel (U) holds up to three goals that fit your realm right now, each with a reward. Decisions are great one-time choices, such as codifying the laws, founding a holy order or moving the capital, available once their conditions are met.'],
  ['Schemes & spies', 'In the Court panel, your best schemer can run schemes against realms you know: a spy network (their treasury, armies and schemes appear in Diplomacy), sowing discord, stealing a technology, or inciting revolt. Agents may be caught, which angers the target. Other realms scheme too.'],
  ['The advisor', 'The advisor card reads your realm and suggests what to do next, most urgent first. Click the advice to open the right panel, use the arrows to see more, or hide it in Settings.'],
  ['Score', 'Your score adds land, population, wealth, technology, military, culture and the spread of your dynasty. See your rank in the top bar and the full standings in the Ledger or the game menu.'],
  ['Controls', 'Right-click the map for quick actions; / searches; B builds, N jumps to an idle settlement, Tab cycles settlements, Q cycles armies, F follows an army, V opens the overview, I this encyclopedia. Space pauses, 1–5 set the speed.'],
];
function sections() {
  return [
    ['Guides', ARTICLES.map(([t, d]) => ({ t, d }))],
    ['Goods', GOOD_LIST.map((g) => ({ t: GOODS[g].name, d: `Base price ${GOODS[g].base}. Made by: ${Object.entries(PRODUCTION).filter(([, P]) => (P.pms || []).some((pm) => pm.out?.[g])).map(([k]) => BUILDINGS[k]?.name || k).join(', ') || '—'}.`, c: GOODS[g].color }))],
    ['Professions', POP_LIST.map((p) => ({ t: POPS[p].name, d: POPS[p].desc, c: POPS[p].color }))],
    ['Buildings', BUILDING_LIST.map((b) => ({ t: BUILDINGS[b].name, d: `${BUILDINGS[b].desc} Max level ${BUILDINGS[b].max}.${BUILDINGS[b].tech ? ` Needs ${TECHS.find((t) => t.id === BUILDINGS[b].tech)?.name}.` : ''}` }))],
    ['Deposits', RESOURCES.filter(Boolean).map((r) => ({ t: r.name, d: `Boosts ${r.sector} in its province.`, c: r.color }))],
    ['Province traits', PTRAIT_LIST.map((k) => ({ t: `${PTRAITS[k].icon} ${PTRAITS[k].name}`, d: PTRAITS[k].desc }))],
    ['Laws', Object.entries(LAWS).map(([, L]) => ({ t: `${L.name} (${LAW_CATS[L.cat].name})`, d: `${L.desc}${L.fx && Object.keys(L.fx).length ? ' Effects: ' + fx(L.fx) + '.' : ''} For: ${Object.entries(L.stance || {}).filter(([, v]) => v > 0).map(([g]) => GROUPS[g].name).join(', ') || '—'}. Against: ${Object.entries(L.stance || {}).filter(([, v]) => v < 0).map(([g]) => GROUPS[g].name).join(', ') || '—'}.` }))],
    ['Interest groups', GROUP_LIST.map((g) => ({ t: `${GROUPS[g].icon} ${GROUPS[g].name}`, d: GROUPS[g].desc, c: GROUPS[g].color }))],
    ['Character traits', TRAIT_LIST.map((t) => ({ t: TRAITS[t].name, d: TRAITS[t].desc }))],
    ['Lifestyles', LIFESTYLE_LIST.map((k) => ({ t: `${LIFESTYLES[k].icon} ${LIFESTYLES[k].name}`, d: `${LIFESTYLES[k].desc} Perks: ${LIFESTYLES[k].perks.map((p) => TRAITS[p].name).join(', ')}.` }))],
    ['Units', UNIT_LIST.map((u) => ({ t: UNITS[u].name, d: `${UNITS[u].desc} Attack ${UNITS[u].att}, defense ${UNITS[u].def}, ${UNITS[u].men} men, upkeep ${UNITS[u].upkeep}.${UNITS[u].race ? ' Racial unit.' : ''}` }))],
    ['Technologies', TECHS.map((t) => ({ t: t.name, d: `${ERAS[t.era].name} era. ${t.desc || ''}${t.race ? ' Racial technology.' : ''}` }))],
    ['Monuments', MONUMENT_LIST.map((k) => ({ t: `${MONUMENTS[k].icon} ${MONUMENTS[k].name}`, d: `${MONUMENTS[k].desc} Cost ${MONUMENTS[k].cost} gold. ${ERAS[MONUMENTS[k].era].name} era.` }))],
    ['Disasters', Object.values(DISASTERS).map((d) => ({ t: `${d.icon} ${d.name}`, d: d.desc }))],
    ['God powers', POWERS.filter((p) => p.id !== 'inspect').map((p) => ({ t: `${p.icon} ${p.name}`, d: `${p.desc} (sandbox mode)` }))],
  ];
}
export function encyclopedia(showModal, startQuery = '') {
  const secs = sections();
  let cur = 'Guides';
  const render = (q = '') => {
    const ql = q.trim().toLowerCase();
    const list = ql ? secs.flatMap(([n, items]) => items.filter((x) => (x.t + ' ' + x.d).toLowerCase().includes(ql)).map((x) => ({ ...x, s: n }))) : (secs.find(([n]) => n === cur)?.[1] || []);
    return `<div class="enc-nav">${secs.map(([n]) => `<button class="btn sm ${n === cur && !ql ? 'primary' : ''}" data-enc="${n}">${n}</button>`).join('')}</div>
      <div class="enc-list">${list.map((x) => `<div class="enc-item">${x.c ? `<i class="gdot" style="background:${x.c}"></i>` : ''}<b>${E(x.t)}</b>${x.s ? ` <span class="tag">${x.s}</span>` : ''}<div class="small">${E(x.d)}</div></div>`).join('') || '<div class="muted small">Nothing found.</div>'}</div>`;
  };
  showModal(`<div class="modal-box encyclopedia" style="width:min(820px,94vw)">
    <div class="row between"><div class="title-logo" style="font-size:28px;text-align:left">ENCYCLOPEDIA</div><button class="btn sm" data-action="menuItem" data-item="resume">Close</button></div>
    <input id="encSearch" placeholder="Search everything…" value="${E(startQuery)}" style="width:100%;margin:6px 0">
    <div id="encBody">${render(startQuery)}</div></div>`);
  const body = document.getElementById('encBody');
  const inp = document.getElementById('encSearch');
  inp.addEventListener('input', () => { body.innerHTML = render(inp.value); });
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-enc]'); if (b) { cur = b.dataset.enc; inp.value = ''; body.innerHTML = render(''); } });
  setTimeout(() => inp.focus(), 30);
}
