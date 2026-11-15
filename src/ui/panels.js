import { HERO_KINDS } from '../sim/stories.js';
import { ROUTE_NAMES, canOpenRoute, routeBetween, linkedForTrade } from '../sim/markets.js';
import { MISSIONS, DECISIONS, DECISION_LIST, canTakeDecision, decisionCost, SCHEMES, SCHEME_LIST, schemeCost, schemeOdds, canScheme, spymaster, spiedOn, escortCost, routeRaided } from '../sim/depth.js';
import { WORKS, WORK_LIST, WORK_RATES, canBuildWork, workCost, adminShare, adminReach, ambitionText } from '../sim/latebalance.js';
import { temperament, memoryValue, memoryText } from '../sim/memory.js';
import { scoreOf, SCORE_PARTS, rankings } from '../sim/score.js';
import { TRAITS as PTRAITS } from '../world/regions.js';
import { slotsOf, slotsUsed } from '../sim/settlements.js';
import { suggestBuildings } from '../sim/ai.js';
import { G, S, player, dateStr, shortDate } from '../sim/state.js';
import { fmt, fmtSigned, escapeHtml as E } from '../core/util.js';
import { BIOMES, RESOURCES } from '../data/biomes.js';
import { RACES } from '../data/races.js';
import { BUILDINGS, BUILDING_LIST, STAGES, maxLevel } from '../data/buildings.js';
import { TECHS, ERAS, TECH } from '../data/techs.js';
import { GROUPS, GROUP_LIST, LAWS, LAW_CATS, CAT_LIST, lawsIn } from '../data/politics.js';
import { groupsStability, awareness, supportFor, enactMonths, approvalBreakdown, MOOD, movementDemand, lawAvailable, supporters } from '../sim/politics.js';
import { GOVERNMENTS, TRAITS, PERSONALITIES } from '../data/governments.js';
import { GOODS, GOOD_LIST, POPS, POP_LIST, PRODUCTION, activePM } from '../data/goods.js';
import { mods } from '../sim/mods.js';
import { projectLedger, stabilityBreakdown, treasuryReserve, settlementSummary, goodsBalance, basePrice } from '../sim/economy.js';
import { faithOf, faithName, realmDemographics, acceptedCulture, maxAccepted } from '../sim/culture.js';
import { ACTIONS, ACTION_LIST, seats, hireCost, salary, skillFor } from '../sim/cabinet.js';
import { DEMANDS, playsOf, canStartPlay, playOdds } from '../sim/plays.js';
import { canBuild, buildCost, storageCaps, maxHousing, quality, lvl, civPopulation, settlementsOf, sumBuildingField, importCost } from '../sim/settlements.js';
import { canResearch, techCost, eraUnlocked, diffusion } from '../sim/tech.js';
import { canColonize, colonyCost } from '../sim/colonize.js';
import { rulerFullName, reformCheck, heirOf } from '../sim/government.js';
import { SUCCESSION_LAWS } from '../data/governments.js';
import { unrestBreakdown } from '../sim/unrest.js';
import { battleOf, siegePhase, assaultOdds } from '../sim/military.js';
import {
  SHIPS, SHIP_LIST, canSail, portSettlements, canBuildShip, shipCost, fleetCount, fleetUpkeep, fleetPower, fleetSpeed, blockadedSet, portWater,
} from '../sim/naval.js';
import { iconImg, flagImg, portraitImg } from '../render/sprites.js';
import { debt, loanSize, maxLoans, PATRONAGE, MONUMENTS, MONUMENT_LIST, INVEST_RATES, monumentOwner, canBuildMonument, ensureMercs, canHireMercs, mercUpkeep, bribeCost, canFabricate } from '../sim/treasury.js';
import { commanderOptions, attritionOf, supplyDistance, SUPPLY_RANGE, occupiedBySide, settlementValue, provincesCost } from '../sim/warfare.js';
import { fogOn, knowsRealm, canExchangeMaps, canSendExplorer, explorerCost } from '../sim/fog.js';
import { LIFESTYLES, LIFESTYLE_LIST, STAT_NAMES } from '../data/governments.js';
import { ensureCharacters, courtierOpinion, courtStability, successChance, dynastyRealms, claimsOf, hasClaim, canMarry, marriageScore, canAssassinate } from '../sim/characters.js';
import { UNITS, UNIT_LIST, GENERAL_TRAITS } from '../data/military.js';
import {
  rel, opinion, opinionBreakdown, atWar, warBetween, warsOf, sideOf, inTruce, evaluate, canTrade, tradeIncome,
  canDeclareWar, coalitionStrength, armyPower, militaryStrength as militaryStrengthOf,
} from '../sim/diplomacy.js';
import {
  armyCount, armyUpkeep, canRecruit, unitCost, garrisonOf, fortification, armySpeed, siegePower, generalCost, militaryStrengthLabel,
} from '../sim/military.js';

export const gdot = (g) => `<i class="gdot" style="background:${GOODS[g]?.color || '#888'}" title="${GOODS[g]?.name || g}"></i>`;
const goodName = (g) => GOODS[g]?.name || g;
const SECTOR_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', gold: 'Gold' };
const solCls = (v) => (v >= 6.5 ? 'good' : v < 4 ? 'bad' : '');

export function costHtml(cost, civ) {
  if (!cost) return '';
  return `<span class="cost">${Object.entries(cost).map(([k, v]) => {
    const have = k === 'gold' ? civ.treasury : (civ.stock[k] || 0);
    const imp = k !== 'gold' && have < v;
    return `<span class="${imp ? 'imp' : have < v ? 'short' : ''}" title="${k === 'gold' ? 'Gold' : goodName(k) + (imp ? ' — shortfall will be imported' : '')}">${k === 'gold' ? iconImg('gold', 'ico sm') : gdot(k)}${fmt(v)}</span>`;
  }).join('')}${(() => { const g = importCost(civ, cost); return g > 0.5 ? `<span class="imp" title="Gold to import missing goods (${2.5}× market price)">+${iconImg('gold', 'ico sm')}${fmt(g)} import</span>` : ''; })()}</span>`;
}

const head = (title, extra = '') => `<div class="panel-head"><h2>${title}</h2>${extra}<button class="x" data-action="close">✕</button></div>`;
const stat = (label, value, cls = '') => `<div class="stat"><span class="muted">${label}</span><b class="${cls}">${value}</b></div>`;
const signCls = (v) => (v > 0.05 ? 'good' : v < -0.05 ? 'bad' : '');

// ---------------- Economy ----------------
function treasurySection(civ) {
  const st = S();
  let h = '<h3>Crown Finances</h3>';
  // loans
  const loans = civ.loans || [];
  h += `<div class="card"><div class="row between"><b>Loans</b><span class="small muted">debt ${fmt(debt(civ))} gold</span></div>`;
  if (!loans.length) h += '<div class="small muted">No debts. When the treasury runs dry the crown borrows automatically; five loans is the limit, and beyond that lies bankruptcy.</div>';
  loans.forEach((l, i) => { h += `<div class="row between small"><span>${fmt(l.amount)} gold at ${(l.rate * 1200).toFixed(1)}%/year (${fmt(l.amount * l.rate)}/month)</span><button class="btn sm" data-action="repayLoan" data-i="${i}" ${civ.treasury >= l.amount ? '' : 'disabled'}>Repay</button></div>`; });
  h += `<div style="margin-top:4px"><button class="btn sm" data-action="takeLoan" ${loans.length < maxLoans ? '' : 'disabled'}>Borrow ${fmt(loanSize(civ))} gold</button></div></div>`;
  // patronage
  h += '<div class="card"><b>Royal patronage</b><div class="small muted">A standing share of income spent on festivals, alms, roads and grants: stability and a little knowledge.</div><div class="row" style="gap:3px;margin-top:3px">';
  PATRONAGE.forEach((v, i) => { h += `<button class="btn sm ${(civ.patronage || 0) === i ? 'primary' : ''}" data-action="patronage" data-lvl="${i}">${i ? Math.round(v * 100) + '%' : 'None'}</button>`; });
  h += '</div></div>';
  // monuments
  h += '<div class="card"><b>Great Monuments</b><div class="small muted">Unique in the world: the first realm to finish one owns it forever. Funded with a share of monthly income.</div>';
  if (civ.project) {
    const M = MONUMENTS[civ.project.id];
    h += `<div class="row between" style="margin-top:4px"><span>${M.icon} <b>${M.name}</b> <span class="small muted">${M.desc}</span></span><button class="btn sm" data-action="cancelMonument">Abandon (½ back)</button></div>
      <div class="bar" style="margin:3px 0"><i style="width:${Math.min(100, (civ.project.invested / M.cost) * 100)}%"></i></div><div class="row between small"><span>${fmt(civ.project.invested)} / ${fmt(M.cost)} gold</span><span class="row" style="gap:2px">${INVEST_RATES.map((v, i) => `<button class="btn sm ${civ.project.rate === i ? 'primary' : ''}" data-action="investRate" data-lvl="${i}">${i ? Math.round(v * 100) + '%' : 'Pause'}</button>`).join('')}</span></div>`;
  }
  h += '<div class="monuments">';
  for (const id of MONUMENT_LIST) {
    const M = MONUMENTS[id];
    const owner = monumentOwner(id);
    const ok = canBuildMonument(civ, id);
    const cls = owner === civ.id ? 'mine' : owner >= 0 ? 'taken' : !ok.ok ? 'locked' : '';
    h += `<button class="mon ${cls}" ${ok.ok && civ.project?.id !== id ? `data-action="startMonument" data-id="${id}"` : 'disabled'} title="${E(`${M.name}: ${M.desc} Cost ${M.cost} gold.${owner >= 0 ? ' Built by ' + st.civs[owner].displayName + '.' : ok.ok ? '' : ' ' + ok.reason}`)}"><span class="mi">${M.icon}</span><span>${E(M.name)}</span><small>${owner >= 0 ? E(st.civs[owner].baseName) : fmt(M.cost)}</small></button>`;
  }
  h += '</div></div>';
  // Phase 19: great works — repeatable landmarks built in your towns
  h += '<div class="card"><b>Great Works</b><div class="small muted">Canals, cathedrals, universities, palaces and fairs, built in a town of your choice. Each town can host each work once; the cost grows with your income.</div>';
  if (civ.work) {
    const Wk = WORKS[civ.work.id], ws = st.settlements[civ.work.s];
    h += `<div class="row between" style="margin-top:4px"><span>${Wk.icon} <b>${E(Wk.name)}</b> in ${E(ws?.name || '?')}</span><button class="btn sm" data-action="cancelWork">Abandon (½ back)</button></div>
      <div class="bar" style="margin:3px 0"><i style="width:${Math.min(100, (civ.work.invested / civ.work.cost) * 100)}%"></i></div><div class="row between small"><span>${fmt(civ.work.invested)} / ${fmt(civ.work.cost)} gold</span><span class="row" style="gap:2px">${WORK_RATES.map((v, i) => `<button class="btn sm ${civ.work.rate === i ? 'primary' : ''}" data-action="workRate" data-lvl="${i}">${i ? Math.round(v * 100) + '%' : 'Pause'}</button>`).join('')}</span></div>`;
  }
  h += '<div class="monuments">';
  const towns = civ.settlements.map((id) => st.settlements[id]).sort((a, b) => b.pop - a.pop);
  for (const id of WORK_LIST) {
    const Wk = WORKS[id];
    const where = towns.find((t) => canBuildWork(civ, id, t).ok);
    const why = where ? '' : (towns.length ? canBuildWork(civ, id, towns[0]).reason : 'No towns');
    const n = (civ.works || []).filter((w) => w.id === id).length;
    h += `<button class="mon ${where ? '' : 'locked'}" ${where && !civ.work ? `data-action="startWork" data-id="${id}" data-s="${where.id}"` : 'disabled'} title="${E(`${Wk.name}: ${Wk.desc}${where ? ` Next in ${where.name}, cost ${fmt(workCost(civ, id))} gold.` : ' ' + why}${n ? ` Built ${n}×.` : ''}`)}"><span class="mi">${Wk.icon}</span><span>${E(Wk.name)}</span><small>${n ? `${n}× · ` : ''}${where ? fmt(workCost(civ, id)) : '—'}</small></button>`;
  }
  h += '</div></div>';
  // Phase 21: trade routes — caravans and fleets on the map; raids, escorts, upgrades
  h += '<div class="card"><b>🐫 Trade routes</b><div class="small muted">Routes carry goods between markets (you can watch the caravans on the map). War and unrest invite raiders, who cut a route for months; an escort makes raids rare.</div>';
  const mine = (st.routes || []).filter((r) => r.a === civ.id || r.b === civ.id);
  for (const r of mine) {
    const o = st.civs[r.a === civ.id ? r.b : r.a];
    const esc = !!r.escort?.[civ.id];
    h += `<div class="row between" style="margin-top:4px"><span>${E(ROUTE_NAMES[r.level])} with <b>${E(o.baseName)}</b>${routeRaided(r) ? ` <span class="tag bad">raided · ${Math.ceil((r.raid.until - st.day) / 30)} mo</span>` : ''}</span><span class="row" style="gap:3px"><button class="btn sm ${esc ? 'primary' : ''}" data-action="escort" data-id="${r.id}" data-on="${esc ? 0 : 1}" title="Guards ride with the caravans: ${escortCost(r)} gold a month">${esc ? '🛡 Escorted' : '🛡 Escort'} (${escortCost(r)}/mo)</button>${canOpenRoute(civ.id, o.id).ok ? `<button class="btn sm" data-action="openRoute" data-id="${o.id}">Upgrade · ${fmt(canOpenRoute(civ.id, o.id).cost)}</button>` : ''}</span></div>`;
  }
  const partners = st.civs.filter((o) => o.alive && o.id !== civ.id && linkedForTrade(civ.id, o.id) && !routeBetween(civ.id, o.id));
  for (const o of partners) { const ok = canOpenRoute(civ.id, o.id); h += `<div class="row between small" style="margin-top:3px"><span>${E(o.baseName)}</span><button class="btn sm" ${ok.ok ? `data-action="openRoute" data-id="${o.id}"` : 'disabled'} title="${E(ok.reason || '')}">Open a caravan route${ok.ok ? ` · ${fmt(ok.cost)}` : ''}</button></div>`; }
  if (!mine.length && !partners.length) h += '<div class="small muted" style="margin-top:4px">Sign a trade agreement or alliance in Diplomacy, and build a market, to open routes.</div>';
  h += '</div>';
  return h;
}

function economy(civ) {
  const L = projectLedger(civ);
  const caps = storageCaps(civ);
  let h = head('Economy');
  h += '<div class="panel-body">';
  h += '<h3>National Treasury</h3><div class="grid2">';
  h += stat('Treasury', `${iconImg('gold', 'ico sm')} ${fmt(civ.treasury)}`, civ.treasury < 0 ? 'bad' : '');
  h += stat('Monthly balance', fmtSigned(L.net.gold), signCls(L.net.gold));
  h += stat('Taxes on income', '+' + fmt(L.tax), 'good');
  h += stat('Trade & duties', '+' + fmt(L.trade), 'good');
  h += stat('Tribute', fmtSigned(L.tribute), signCls(L.tribute));
  h += stat('Clergy, soldiers & officials', '-' + fmt(L.stateWages), 'bad');
  h += stat('Cabinet salaries', '-' + fmt(L.salaries), L.salaries > 0.05 ? 'bad' : 'muted');
  h += stat('Army & navy', '-' + fmt(L.military), L.military > 0.05 ? 'bad' : 'muted');
  h += stat('Mercenaries', '-' + fmt(L.mercs || 0), L.mercs > 0.05 ? 'bad' : 'muted');
  h += stat('Loan interest', '-' + fmt(L.interest || 0), L.interest > 0.05 ? 'bad' : 'muted');
  h += stat('Monument works', '-' + fmt(L.monument || 0), L.monument > 0.05 ? 'bad' : 'muted');
  h += stat('Royal patronage', '-' + fmt(L.patronage || 0), L.patronage > 0.05 ? 'bad' : 'muted');
  h += stat('Administration', `<span title="${E(`Governors, clerks and courts for ${civ.settlements.length} settlements; your reach is about ${Math.round(adminReach(civ))}. Raise it with administration (town halls, palaces, laws, cabinet).`)}">-${fmt(L.admin || 0)} (${Math.round(adminShare(civ) * 100)}%)</span>`, L.admin > 0.05 ? 'bad' : 'muted');
  h += stat('Great works', '-' + fmt(L.works || 0), L.works > 0.05 ? 'bad' : 'muted');
  h += stat('Inflation', `<span title="Hoarding more than six months of income drives prices up. All gold costs are raised by this much. Spend or invest the treasury to bring it down.">${(civ.inflation || 0) > 0.5 ? '+' + Math.round(civ.inflation) + '% prices' : 'none'}</span>`, (civ.inflation || 0) > 5 ? 'bad' : 'muted');
  h += '</div>' + treasurySection(civ) + '<div class="grid2">';
  h += stat('Building upkeep', '-' + fmt(L.upkeep), 'bad');
  h += stat('Corruption', L.corruption > 0.05 ? '-' + fmt(L.corruption) : '0', L.corruption > 0.05 ? 'bad' : 'muted');
  h += '</div>';
  h += `<h3>Taxation</h3><div class="slider-row"><span>Income tax</span><input type="range" min="0" max="50" step="1" value="${Math.round(civ.taxRate * 100)}" data-input="tax"><b>${Math.round(civ.taxRate * 100)}%</b></div>`;
  h += `<div class="small muted">Taxes take a share of every pop's income — less money for their needs, so living standards fall as taxes rise. Gold hoarded beyond ${fmt(treasuryReserve(civ))} loses 3.5% per month to corruption.</div>`;
  h += `<h3>Market of ${E(civ.baseName)}</h3><div class="small muted" style="margin-bottom:4px">Prices follow supply and demand. Dear goods (red) are worth producing — or importing through trade agreements.</div>`;
  h += '<table><tr><th>Good</th><th>Price</th><th>Made</th><th>Wanted</th><th>Stock</th></tr>';
  for (const r of goodsBalance(civ)) {
    if (r.supply < 0.05 && r.demand < 0.05 && r.stock < 0.5) continue;
    const pct = Math.round((r.price / r.base) * 100);
    const cls = pct >= 130 ? 'bad' : pct <= 75 ? 'good' : '';
    h += `<tr><td>${gdot(r.g)} ${goodName(r.g)}</td><td class="${cls}" title="Base ${r.base.toFixed(2)}">${r.price.toFixed(2)} <span class="small">${pct}%</span></td><td>${fmt(r.supply)}</td><td>${fmt(r.demand)}</td><td class="muted">${fmt(r.stock)}/${fmt(caps[r.g])}</td></tr>`;
  }
  h += '</table>';
  h += '<h3>Advisors</h3>';
  h += `<label class="toggle"><input type="checkbox" data-input="autoBuild" ${civ.autoBuild ? 'checked' : ''}> Royal architect: automatically construct buildings</label>`;
  h += `<label class="toggle"><input type="checkbox" data-input="autoResearch" ${civ.autoResearch ? 'checked' : ''}> Court scholar: automatically choose research</label>`;
  h += '<h3>Settlements</h3><table><tr><th>Settlement</th><th>Pop</th><th>Living std.</th><th>Produces</th></tr>';
  for (const s of settlementsOf(civ)) {
    const top = Object.entries(s.prod || {}).sort((a, b) => b[1] * basePrice(b[0]) - a[1] * basePrice(a[0])).slice(0, 3);
    h += `<tr class="click" data-action="focusSettlement" data-id="${s.id}"><td>${E(s.name)}</td><td>${fmt(s.pop)}</td><td class="${solCls(s.sol ?? 5)}">${(s.sol ?? 5).toFixed(1)}</td><td class="small">${top.map(([g, v]) => `${gdot(g)}${fmt(v)}`).join(' ')}</td></tr>`;
  }
  h += '</table></div>';
  return h;
}

// ---------------- Diplomacy ----------------
const OFFER_TEXT = {
  trade: 'proposes a trade agreement', alliance: 'proposes an alliance',
  peace_white: 'offers a white peace', peace_gold: 'demands tribute for peace', peace_vassal: 'demands your vassalage for peace', peace_goal: 'demands its war goal for peace',
};
const likely = (ev) => ev.accept ? `<span class="good small">Likely to accept (${ev.score > 0 ? '+' : ''}${ev.score})</span>` : `<span class="bad small">Will refuse (${ev.score})</span>`;
const evTip = (ev) => E(ev.reasons.map(([l, v]) => `${l}: ${v > 0 ? '+' : ''}${v}`).join('\n'));

function warBar(w, me) {
  const side = sideOf(w, me);
  const my = side === 'att' ? w.score : -w.score;
  const pct = 50 + my / 2;
  return `<div class="bar" style="height:10px;position:relative"><i style="width:${pct}%;background:linear-gradient(90deg,#4c7a3a,#8fd16b)"></i></div><div class="row between small muted"><span>War score ${my > 0 ? '+' : ''}${Math.round(my)}</span><span>Exhaustion ${Math.round(side === 'att' ? w.exhA : w.exhD)}</span><span>${w.battles} battles</span></div>`;
}

function diplomacy(civ) {
  const st = S();
  const me = civ.id;
  let h = head('Diplomacy');
  h += '<div class="panel-body">';
  if (st.offers.some((o) => o.to === me)) {
    h += '<h3>Pending Proposals</h3>';
    for (const o of st.offers.filter((x) => x.to === me)) {
      const F = st.civs[o.from];
      h += `<div class="card row between"><div class="row">${flagImg(F)}<span><b style="color:${F.color}">${E(F.displayName)}</b> ${OFFER_TEXT[o.type]}${o.amount ? ` (${o.amount} gold)` : ''}.</span></div><div class="row"><button class="btn sm primary" data-action="offer" data-id="${o.id}" data-accept="1">Accept</button><button class="btn sm" data-action="offer" data-id="${o.id}" data-accept="0">Reject</button></div></div>`;
    }
  }
  const crises = playsOf(me);
  if (crises.length) {
    h += '<h3>Crises</h3>';
    for (const p of crises) {
      const A = st.civs[p.att], D = st.civs[p.def];
      const what = p.type === 'conquest' ? `cede ${E(st.settlements[p.target]?.name || 'a province')}` : DEMANDS[p.type].short;
      const odds = playOdds(p);
      h += `<div class="card"><div><b style="color:${A.color}">${E(A.baseName)}</b> demands <b>${what}</b> from <b style="color:${D.color}">${E(D.baseName)}</b></div>`;
      h += `<div class="bar" style="margin:4px 0;height:9px"><i style="width:${Math.min(100, p.escalation)}%;background:linear-gradient(90deg,#e6c068,#e46b5a)"></i></div><div class="small muted">Escalation ${Math.min(100, Math.round(p.escalation))}% — war at 100%. Backers: ${[A.baseName, ...p.attB.map((c) => st.civs[c].baseName)].map(E).join(', ')} vs ${[D.baseName, ...p.defB.map((c) => st.civs[c].baseName)].map(E).join(', ')} · odds ${odds.toFixed(2)}:1</div>`;
      if (p.att === me) h += `<div style="margin-top:4px"><button class="btn sm" data-action="backDown" data-id="${p.id}">Back down (−8 stability)</button></div>`;
      if (p.def === me) h += `<div class="row" style="gap:4px;margin-top:4px"><button class="btn sm" data-action="concedePlay" data-id="${p.id}">Concede</button><span class="small muted">or stand firm and prepare for war</span></div>`;
      h += '</div>';
    }
  }
  if (civ.overlord >= 0) h += `<div class="card small">You are a vassal of <b>${E(st.civs[civ.overlord].displayName)}</b>: you pay 25% of taxes in tribute and cannot declare war (except for independence).</div>`;

  const others = st.civs.filter((c) => c.id !== me && (c.alive || !c.rebel) && knowsRealm(c.id));
  const unknown = st.civs.filter((c) => c.alive && c.id !== me && !knowsRealm(c.id)).length;
  others.sort((a, b) => (b.alive - a.alive) || (atWar(me, b.id) - atWar(me, a.id)) || (civ.contacts.includes(b.id) - civ.contacts.includes(a.id)) || civPopulation(b) - civPopulation(a));
  h += '<h3>Civilizations of the World</h3>';
  if (unknown) h += `<div class="small muted" style="margin-bottom:4px">🧭 ${unknown} realm${unknown === 1 ? ' is' : 's are'} still unknown to us — send expeditions (Military panel) or exchange maps.</div>`;
  const myStr = coalitionStrength(me);
  for (const o of others) {
    const neighbour = civ.contacts.includes(o.id);
    const cap = st.settlements[o.capital];
    h += `<div class="card">`;
    h += `<div class="row">${flagImg(o)}<b style="font-family:var(--pixel);font-size:15px;color:${o.color};cursor:pointer" ${o.alive && cap ? `data-action="focusSettlement" data-id="${cap.id}"` : ''}>${E(o.displayName)}</b>`;
    if (!o.alive) { h += '<span class="tag bad">Fallen</span></div></div>'; continue; }
    const r = rel(me, o.id);
    if (atWar(me, o.id)) h += '<span class="tag bad">At war</span>';
    if (r.ally) h += '<span class="tag good">Ally</span>';
    if (r.trade) h += '<span class="tag gold">Trade</span>';
    if (inTruce(me, o.id)) h += `<span class="tag">Truce until Y${Math.floor(r.truce / 360) + 1}</span>`;
    if (o.overlord === me) h += '<span class="tag good">Our vassal</span>';
    if (civ.overlord === o.id) h += '<span class="tag bad">Our overlord</span>';
    if (o.overlord >= 0 && o.overlord !== me) h += `<span class="tag">Vassal of ${E(st.civs[o.overlord].baseName)}</span>`;
    if (neighbour) h += '<span class="tag">Neighbour</span>';
    if (o.rebel) h += `<span class="tag bad">${{ separatist: 'Separatists', revolution: 'Revolutionaries', claimant: 'Pretender' }[o.rebel.type]}</span>`;
    if (civ.rival === o.id || o.rival === me) h += '<span class="tag bad">Rival</span>';
    if ((o.ae || 0) > 30) h += '<span class="tag bad">Aggressive</span>';
    if (r.marriage) h += '<span class="tag good">💍 Marriage</span>';
    if (hasClaim(me, o.id)) h += '<span class="tag gold" title="Our house has a blood claim on their throne">Claim</span>';
    if (hasClaim(o.id, me)) h += '<span class="tag bad" title="Their house has a claim on our throne">Claims us</span>';
    h += '</div>';
    h += `<div class="row ruler-line">${portraitImg(o.ruler, o.race, { crown: true, bg: o.color, cls: 'sm' })}<div class="small"><b>${E(rulerFullName(o))}</b>, ${o.ruler.age} · House ${E(o.ruler.dynasty)}<div class="muted">${o.ruler.traits.map((t) => TRAITS[t]?.name).join(', ')}${o.ruler.spouse ? ` · married to ${E(o.ruler.spouse.name)}` : ' · unmarried'}</div></div></div>`;
    const op = opinion(me, o.id);
    const opTip = E(opinionBreakdown(me, o.id).map(([l, v]) => `${l}: ${v > 0 ? '+' : ''}${v}`).join('\n'));
    const ratio = coalitionStrength(o.id) / Math.max(1, myStr);
    h += `<div class="grid2 small" style="margin-top:6px">`;
    h += stat('Opinion', `<span title="${opTip}" style="cursor:help">${op > 0 ? '+' : ''}${op}</span>`, op > 10 ? 'good' : op < -10 ? 'bad' : '');
    h += stat('Military', militaryStrengthLabel(ratio), ratio > 1.15 ? 'bad' : ratio < 0.85 ? 'good' : '');
    h += stat('Race', RACES[o.race].name) + stat('Government', GOVERNMENTS[o.gov].name);
    h += stat('Ruler', E(rulerFullName(o))) + stat('Era', ERAS[o.era].name);
    h += stat('Population', fmt(civPopulation(o))) + stat('Personality', PERSONALITIES[o.personality]?.name ?? '—');
    h += stat('Faith', `<span style="color:${faithOf(o.faith)?.color}">${E(faithOf(o.faith)?.short || '—')}</span>`) + stat('Living std.', (o.sol ?? 5).toFixed(1));
    h += stat('Temperament', `<span title="How their ruler's character shapes war, grudges and loyalty">${E(temperament(o).label)}</span>`);
    if (spiedOn(civ, o.id)) { // Phase 21: what our spies report
      const regs = st.armies.filter((a) => a.civ === o.id).reduce((s, a) => s + Object.values(a.units).reduce((x, y) => x + y, 0), 0);
      h += stat('👁 Spies: treasury', fmt(o.treasury)) + stat('👁 Spies: regiments', fmt(regs));
      if (o.schemes?.length) h += stat('👁 Spies: schemes', o.schemes.map((x) => `${SCHEMES[x.kind].name} vs ${st.civs[x.target]?.baseName}`).join(', '), 'bad');
    }
    if (o.ambition) h += stat('Ambition', `<span title="A long-term goal this realm pursues for decades">To ${E(ambitionText(o))}</span>`, o.ambition.def === me ? 'bad' : '');
    if (st.coalition && (st.coalition.target === o.id || st.coalition.members.includes(o.id))) h += stat('Coalition', st.coalition.target === o.id ? `<span class="bad">Target of a coalition of ${st.coalition.members.length}</span>` : `Member, against ${E(st.civs[st.coalition.target].baseName)}`);
    h += `</div>`;
    // Phase 17: what they remember of us, and we of them
    { const mem = []; for (const [X, Y, who] of [[o, me, 'They remember'], [civ, o.id, 'We remember']]) for (const m of X.memory || []) { if (m.about !== Y) continue; const v = memoryValue(X, m); if (Math.abs(v) >= 1) mem.push(`<div class="small ${v < 0 ? 'bad' : 'good'}">${E(X.baseName)} remembers: ${E(st.civs[Y].baseName)} ${E(memoryText(m))} <span class="muted">(${v > 0 ? '+' : ''}${Math.round(v)})</span></div>`); }
      if (mem.length) h += `<div style="margin-top:6px">${mem.slice(0, 6).join('')}</div>`; }
    // Actions
    h += '<div class="row" style="flex-wrap:wrap;gap:4px;margin-top:8px">';
    const war = warBetween(me, o.id);
    if (war?.civil) {
      h += `<button class="btn sm" data-action="concede" data-war="${war.id}">Concede to the rebels</button></div>`;
      h += `<div class="small" style="margin-top:4px">${E(war.name)} — civil war. Rebels win at +60 war score, loyalists at −50.</div>${warBar(war, me)}`;
    } else if (war) {
      const ev = (t, amount) => evaluate(me, o.id, t, { war, amount });
      const amt = Math.round(Math.max(50, o.treasury * 0.5));
      h += `<button class="btn sm" data-action="peace" data-civ="${o.id}" data-type="peace_white" title="${evTip(ev('peace_white'))}">White peace</button>`;
      h += `<button class="btn sm" data-action="peace" data-civ="${o.id}" data-type="peace_gold" data-amount="${amt}" title="${evTip(ev('peace_gold', amt))}">Demand ${amt} gold</button>`;
      h += `<button class="btn sm" data-action="peace" data-civ="${o.id}" data-type="peace_vassal" title="${evTip(ev('peace_vassal'))}">Demand vassalage</button>`;
      h += `</div><div class="small" style="margin-top:4px">${E(war.name)}</div>${warBar(war, me)}<div class="small muted">White peace: ${likely(ev('peace_white'))}</div>`;
      // occupied towns at the peace table
      const side = sideOf(war, me);
      const occ = occupiedBySide(war, side);
      const theirOcc = occupiedBySide(war, side === 'att' ? 'def' : 'att');
      if (occ.length) {
        G.ui.peacePick ??= {};
        const pick = (G.ui.peacePick[war.id] ||= new Set(occ.map((x) => x.id)));
        for (const id of [...pick]) if (!occ.some((x) => x.id === id)) pick.delete(id);
        const ids = [...pick];
        const pe = evaluate(me, o.id, 'peace_provinces', { war, setts: ids });
        h += `<div class="card peace"><b>Occupied towns</b> <span class="small muted">— pick what to keep; each costs war score</span>`;
        for (const x of occ) h += `<label class="row small" style="gap:6px"><input type="checkbox" data-action="peacePick" data-war="${war.id}" data-id="${x.id}" ${pick.has(x.id) ? 'checked' : ''}> ${E(x.name)}${x.isCapital ? ' <span class="tag gold">capital</span>' : ''}<span class="muted" style="margin-left:auto">${settlementValue(x)} war score</span></label>`;
        h += `<div class="row between small" style="margin-top:4px"><span>Total ${provincesCost(ids)} · our war score ${Math.round(side === 'att' ? war.score : -war.score)}</span><button class="btn sm ${pe.accept ? 'primary' : ''}" data-action="peaceProvinces" data-civ="${o.id}" data-war="${war.id}" ${ids.length ? '' : 'disabled'} title="${evTip(pe)}">Demand ${ids.length} town${ids.length === 1 ? '' : 's'}${pe.accept ? '' : ' ✗'}</button></div></div>`;
      }
      if (theirOcc.length) h += `<div class="small bad">They occupy ${theirOcc.map((x) => E(x.name)).join(', ')}. Liberate them by marching an army in.</div>`;
    } else {
      h += `<button class="btn sm" data-action="gift" data-civ="${o.id}" ${civ.treasury < 50 ? 'disabled' : ''}>Gift 50 ${iconImg('gold', 'ico sm')}</button>`;
      { const mc = canMarry(me, o.id); const ok = mc.ok && marriageScore(me, o.id) > 0; h += `<button class="btn sm" data-action="marry" data-civ="${o.id}" ${mc.ok ? '' : 'disabled'} title="${E(mc.ok ? (ok ? 'They would accept: royal marriage, +20 opinion, our children gain a claim on their throne.' : 'They would refuse — improve their opinion of us first.') : mc.reason)}">💍 Propose marriage${mc.ok && !ok ? ' ✗' : ''}</button>`; }
      { const fc = canFabricate(civ, o.id); if (!(civ.claims || []).includes(o.id)) h += `<button class="btn sm" data-action="fabricate" data-civ="${o.id}" ${fc.ok ? '' : 'disabled'} title="${E(fc.ok ? `Pay scribes ${fc.cost} gold to forge a claim to their throne (about a year). Risk: discovery angers them.` : fc.reason)}">📜 Forge claim</button>`; }
      if (fogOn()) { const mx = canExchangeMaps(me, o.id); h += `<button class="btn sm" data-action="exchangeMaps" data-civ="${o.id}" ${mx.ok ? '' : 'disabled'} title="${E(mx.ok ? 'Share charts: reveals their lands and their neighbours.' : mx.reason)}">🗺 Exchange maps</button>`; }
      for (const who of ['ruler', 'heir']) { const ac = canAssassinate(me, o.id, who); h += `<button class="btn sm" data-action="assassinate" data-civ="${o.id}" data-who="${who}" ${ac.ok ? '' : 'disabled'} title="${E(ac.ok ? `Costs ${ac.cost} gold. Our ruler's intrigue against theirs decides success; if discovered they will hate us.` : ac.reason)}">🗡 ${who === 'heir' ? 'Heir' : 'Ruler'}</button>`; }
      if (r.trade) h += `<button class="btn sm" data-action="cancelTrade" data-civ="${o.id}">Cancel trade</button>`;
      else if (canTrade(me, o.id)) { const ev = evaluate(me, o.id, 'trade'); h += `<button class="btn sm" data-action="propose" data-civ="${o.id}" data-type="trade" title="${evTip(ev)}">Propose trade${ev.accept ? '' : ' ✗'}</button>`; }
      if (r.ally) h += `<button class="btn sm" data-action="breakAlliance" data-civ="${o.id}">Break alliance</button>`;
      else { const ev = evaluate(me, o.id, 'alliance'); h += `<button class="btn sm" data-action="propose" data-civ="${o.id}" data-type="alliance" title="${evTip(ev)}">Propose alliance${ev.accept ? '' : ' ✗'}</button>`; }
      const dw = canDeclareWar(me, o.id);
      if (!dw.ok) h += `<button class="btn sm" disabled title="${E(dw.reason)}">Make demands</button>`;
      else for (const k in DEMANDS) { const c = canStartPlay(me, o.id, k); h += `<button class="btn sm" style="border-color:#a33" data-action="startPlay" data-civ="${o.id}" data-type="${k}" ${c.ok ? '' : 'disabled'} title="${E(c.ok ? DEMANDS[k].desc + ' Starts a crisis that can lead to war.' : c.reason)}">Demand: ${DEMANDS[k].short}</button>`; }
      h += '</div>';
      if (r.trade) h += `<div class="small muted" style="margin-top:4px">Trade income: +${fmt(tradeIncome(me, o.id))} gold/month</div>`;
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ---------------- Military ----------------
function military(civ) {
  const st = S();
  const m = mods(civ);
  const ui = G.ui;
  let h = head('Military');
  h += '<div class="panel-body">';
  const wars = warsOf(civ.id);
  if (wars.length) {
    h += '<h3>Wars</h3>';
    for (const w of wars) {
      const side = sideOf(w, civ.id);
      const foes = (side === 'att' ? w.def : w.att).map((c) => st.civs[c]);
      const friends = (side === 'att' ? w.att : w.def).filter((c) => c !== civ.id).map((c) => st.civs[c]);
      h += `<div class="card"><b>${E(w.name)}</b><div class="small">Against: ${foes.map((f) => `<span style="color:${f.color}">${E(f.baseName)}</span>`).join(', ')}${friends.length ? ` · With: ${friends.map((f) => E(f.baseName)).join(', ')}` : ''}</div>${warBar(w, civ.id)}<div class="small muted">Negotiate peace from the Diplomacy panel (R).</div></div>`;
    }
  }
  // Phase 17: battle reports
  { const reps = (st.battleReports || []).filter((r) => r.ac === civ.id || r.dc === civ.id).slice(-6).reverse();
    if (reps.length) {
      h += '<h3>Battle Reports</h3>';
      for (const r of reps) { const won = r.winner === civ.id; const foe = st.civs[r.ac === civ.id ? r.dc : r.ac];
        h += `<div class="card small click" style="cursor:pointer;border-left:3px solid ${won ? 'var(--good)' : 'var(--bad)'}" data-action="battleReport" data-id="${r.id}"><b>${won ? '🏆 Victory' : '✗ Defeat'} at ${E(r.place)}</b> <span class="muted">Y${Math.floor(r.day / 360) + 1} · vs ${E(foe?.baseName || '?')}</span><div class="muted">${E(r.why[0])}</div></div>`; }
    } }
  const armies = st.armies.filter((a) => a.civ === civ.id);
  h += '<h3>Mercenary Companies</h3><div class="small muted" style="margin-bottom:4px">Ready-made armies for hire. They cost a fee up front and gold every month — and desert if unpaid.</div>';
  if (!st.mercs?.length) h += '<div class="small muted">No companies seek employment this year.</div>';
  for (const mc of st.mercs || []) {
    const ok = canHireMercs(civ, mc);
    const n = Object.values(mc.units).reduce((x, y) => x + y, 0);
    h += `<div class="bitem"><span>⚔</span><div><div class="nm">${E(mc.name)}</div><div class="ds">${n} regiments (${Object.entries(mc.units).map(([k, v]) => `${v} ${UNITS[k].name.toLowerCase()}`).join(', ')}) · captain ${E(mc.captain)} ${'★'.repeat(mc.skill)} · ${mc.upkeep} gold/month</div></div><button class="btn sm" data-action="hireMercs" data-id="${mc.id}" ${ok.ok ? '' : 'disabled'} title="${E(ok.ok ? '' : ok.reason)}">Hire ${fmt(mc.cost)} ${iconImg('gold', 'ico sm')}</button></div>`;
  }
  if (fogOn()) {
    const ec = canSendExplorer(civ, 0);
    h += `<h3>Exploration</h3><div class="small muted">Expeditions travel toward a place you pick on the map and chart the lands they pass (they cross the sea once you know Sailing).</div><div style="margin-top:4px"><button class="btn sm" data-action="pickExplorer" ${ec.ok || ec.reason === 'Pick a place on the map' ? '' : 'disabled'} title="${E(ec.reason || '')}">🧭 Send an expedition (${explorerCost(civ)} gold)</button> <span class="small muted">${st.explorers.filter((e) => e.civ === civ.id).length}/3 under way</span></div>`;
  }
  h += `<h3>Armies <span class="muted small">upkeep ${fmt(armyUpkeep(civ) + mercUpkeep(civ))} gold/month</span></h3>`;
  if (!armies.length) h += '<div class="muted small">No standing armies. Recruit regiments below.</div>';
  else {
    h += '<table><tr><th>Army</th><th>Regiments</th><th>General</th><th>Morale</th><th>Status</th></tr>';
    for (const a of armies) {
      h += `<tr class="click" data-action="selectArmy" data-id="${a.id}"><td>${E(a.name)}${a.merc ? ' <span class="tag">merc</span>' : ''}</td><td>${fmt(armyCount(a))}</td><td>${E(a.general.name)} ${'★'.repeat(a.general.skill)}</td><td>${Math.round(a.morale * 100)}%</td><td class="muted">${armyStatus(a)}</td></tr>`;
    }
    h += '</table><div class="small muted" style="margin-top:4px">Click an army to select it, then <b>right-click</b> the map to move. Armies besiege enemy settlements and occupy enemy land automatically.</div>';
  }
  // Recruitment
  const setts = settlementsOf(civ).filter((s) => s.stage >= 1);
  h += '<h3>Recruit Regiments</h3>';
  if (!setts.length) h += '<div class="muted small">Recruitment requires a settlement of Village size.</div>';
  else {
    if (ui.recruitSid == null || !setts.find((s) => s.id === ui.recruitSid)) ui.recruitSid = setts[0].id;
    const s = st.settlements[ui.recruitSid];
    h += '<div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:6px">' + setts.map((x) => `<button class="btn sm ${x.id === ui.recruitSid ? 'primary' : ''}" data-action="pickRecruit" data-sid="${x.id}">${E(x.name)}</button>`).join('') + '</div>';
    h += `<div class="small muted" style="margin-bottom:6px">${E(s.name)}: ${fmt(s.pop)} people · Barracks ${lvl(s, 'barracks')} (each level −10% cost). New regiments join an idle army in the settlement.</div><div class="blist">`;
    for (const k of UNIT_LIST) {
      const U = UNITS[k];
      const r = canRecruit(civ, s, k);
      if (r.hidden) continue;
      const cost = r.cost || unitCost(civ, s, k);
      h += `<div class="bitem ${r.ok ? '' : 'locked'}"><span>${iconImg('defense')}</span><div><div class="nm">${U.name} <span class="tag">⚔${U.att} 🛡${U.def}${U.siege >= 1 ? ' ⛫' + U.siege : ''}</span></div><div class="ds">${U.desc} ${U.men} people, ${U.upkeep} gold/month.</div>${r.ok ? '' : `<div class="ds bad">${r.reason}</div>`}</div><div style="text-align:right">${costHtml(cost, civ)}<br><button class="btn sm" data-action="recruit" data-sid="${s.id}" data-type="${k}" ${r.ok ? '' : 'disabled'}>Recruit</button></div></div>`;
    }
    h += '</div>';
  }
  // ---- Navy ----
  h += `<h3>Navy <span class="muted small">upkeep ${fmt(fleetUpkeep(civ))} gold/month</span></h3>`;
  if (!canSail(civ)) {
    h += `<div class="card small muted">Research <b>Sailing</b> and build a <b>Harbour</b> in a coastal settlement to build warships and to send settlers and armies across the sea.</div>`;
  } else {
    const fleets = st.fleets.filter((f) => f.civ === civ.id);
    if (fleets.length) {
      h += '<table><tr><th>Fleet</th><th>Ships</th><th>Admiral</th><th>Morale</th><th>Status</th></tr>';
      for (const f of fleets) h += `<tr class="click" data-action="selectFleet" data-id="${f.id}"><td>${E(f.name)}</td><td>${fmt(fleetCount(f))}</td><td>${E(f.admiral.name)} ${'★'.repeat(f.admiral.skill)}</td><td>${Math.round(f.morale * 100)}%</td><td class="muted">${fleetStatus(f)}</td></tr>`;
      h += '</table>';
    } else h += '<div class="muted small">No warships. Armies and settlers can still sail, but enemy fleets may intercept them.</div>';
    const yards = portSettlements(civ);
    if (ui.yardSid == null || !yards.find((s) => s.id === ui.yardSid)) ui.yardSid = yards[0]?.id;
    const ys = st.settlements[ui.yardSid];
    if (ys) {
      h += '<div class="row" style="flex-wrap:wrap;gap:4px;margin:8px 0 6px">' + yards.map((x) => `<button class="btn sm ${x.id === ui.yardSid ? 'primary' : ''}" data-action="pickYard" data-sid="${x.id}">⚓ ${E(x.name)}</button>`).join('') + '</div><div class="blist">';
      for (const k of SHIP_LIST) {
        const S2 = SHIPS[k];
        const r = canBuildShip(civ, ys, k);
        if (r.hidden) continue;
        h += `<div class="bitem ${r.ok ? '' : 'locked'}"><span>⚓</span><div><div class="nm">${S2.name} <span class="tag">⚔${S2.att} 🛡${S2.def} ⛵${S2.speed}</span></div><div class="ds">${S2.desc} ${S2.upkeep} gold/month.</div>${r.ok ? '' : `<div class="ds bad">${r.reason}</div>`}</div><div style="text-align:right">${costHtml(r.cost || shipCost(civ, ys, k), civ)}<br><button class="btn sm" data-action="buildShip" data-sid="${ys.id}" data-type="${k}" ${r.ok ? '' : 'disabled'}>Build</button></div></div>`;
      }
      h += '</div>';
    }
    h += '<div class="small muted" style="margin-top:4px">Fleets fight enemy ships, intercept armies at sea, escort your own crossings, and blockade enemy harbours (−50% trade, −30% taxes, faster sieges).</div>';
  }
  h += '<h3>Fortifications</h3><table><tr><th>Settlement</th><th>Garrison</th><th>Walls</th><th>Fortification</th></tr>';
  for (const s of settlementsOf(civ)) {
    h += `<tr class="click" data-action="focusSettlement" data-id="${s.id}"><td>${E(s.name)}</td><td>${fmt(garrisonOf(s))}</td><td>${lvl(s, 'walls')}</td><td>×${fortification(s).toFixed(1)}</td></tr>`;
  }
  h += `</table><div class="small muted" style="margin-top:6px">National defense bonus: +${m.defense}. Higher fortification slows enemy sieges.</div>`;
  h += '</div>';
  return h;
}

export function fleetStatus(f) {
  if (f.battle >= 0) return 'In battle';
  if (f.retreating) return 'Returning to port';
  if (f.path.length) return 'Under sail';
  const bl = [...blockadedSet()].find(([, c]) => c === f.civ);
  const docked = S().settlements.some((s) => s.civ === f.civ && s.buildings.port && portWater(s) === f.tile);
  if (docked) return 'In harbour';
  return bl ? 'Blockading' : 'At anchor';
}

export function fleetPanel(id) {
  const st = S();
  const f = st.fleets.find((x) => x.id === id);
  if (!f) return null;
  const civ = st.civs[f.civ];
  const mine = civ.id === st.playerId;
  let h = head(E(f.name), flagImg(civ));
  h += '<div class="panel-body">';
  h += `<div class="small" style="color:${civ.color}">${E(civ.displayName)}</div><div class="small muted">${fleetStatus(f)}</div>`;
  h += `<h3>Admiral</h3><div class="card"><b>${E(f.admiral.name)}</b> <span style="color:var(--gold)">${'★'.repeat(f.admiral.skill)}</span><span class="muted">${'★'.repeat(Math.max(0, 5 - f.admiral.skill))}</span></div>`;
  h += '<h3>Ships</h3><table><tr><th>Type</th><th>Count</th><th>Att</th><th>Def</th></tr>';
  for (const k in f.ships) h += `<tr><td>${SHIPS[k].name}</td><td>${f.ships[k].toFixed(1)}</td><td>${SHIPS[k].att}</td><td>${SHIPS[k].def}</td></tr>`;
  h += '</table>';
  h += `<div class="grid2 small" style="margin-top:6px">${stat('Morale', Math.round(f.morale * 100) + '%', f.morale < 0.4 ? 'bad' : '')}${stat('Strength', fmt(fleetPower(f)))}${stat('Speed', fleetSpeed(f).toFixed(1) + ' tiles/day')}${stat('Upkeep', fmt(Object.entries(f.ships).reduce((a, [k, v]) => a + v * SHIPS[k].upkeep, 0)) + ' gold')}</div>`;
  if (mine) {
    const others = st.fleets.filter((x) => x !== f && x.civ === f.civ && x.tile === f.tile);
    h += '<h3>Orders</h3><div class="small muted" style="margin-bottom:6px"><b>Right-click</b> on the sea (or a coast) to sail. Park next to an enemy harbour to blockade it.</div><div class="row" style="flex-wrap:wrap;gap:4px">';
    h += `<button class="btn sm" data-action="fleetHome" data-id="${f.id}">Return to port</button><button class="btn sm" data-action="fleetStop" data-id="${f.id}">Halt</button>`;
    for (const o of others) h += `<button class="btn sm" data-action="fleetMerge" data-id="${f.id}" data-other="${o.id}">Merge ${E(o.name)}</button>`;
    h += `<button class="btn sm" style="border-color:#a33" data-action="fleetDisband" data-id="${f.id}" ${f.battle < 0 ? '' : 'disabled'}>Scuttle</button></div>`;
  }
  h += '</div>';
  return h;
}

export function armyStatus(a) {
  if (a.battle >= 0) return 'In battle';
  if (G.world && BIOMES[G.world.biome[a.tile]].water) return 'At sea';
  if (a.siege) return a.siege.blocked ? 'Siege blocked (garrison too strong)' : `Besieging ${S().settlements[a.siege.s].name} (${Math.floor(a.siege.progress)}%)`;
  if (a.occ) return `Occupying (${a.occ.days}/20 days)`;
  if (a.retreating) return 'Retreating';
  if (a.path.length) return 'Marching';
  return 'Idle';
}

export function armyPanel(id) {
  const st = S();
  const a = st.armies.find((x) => x.id === id);
  if (!a) return null;
  const civ = st.civs[a.civ];
  const mine = civ.id === st.playerId;
  const g = a.general, gt = GENERAL_TRAITS[g.trait];
  let h = head(E(a.name), flagImg(civ));
  h += '<div class="panel-body">';
  h += `<div class="small" style="color:${civ.color}">${E(civ.displayName)}</div>`;
  h += `<div class="small muted">${armyStatus(a)} · ${E(G.world.provinces[G.world.province[a.tile]]?.name || 'Wilderness')}</div>`;
  h += '<h3>Commander</h3>';
  if (g.kind) { const who = g.kind === 'ruler' ? civ.ruler : civ.court?.find((c) => c.id === g.charId); if (who) h += `<div class="row" style="gap:6px;margin-bottom:4px">${portraitImg(who, who.race || civ.race, { crown: g.kind === 'ruler', bg: civ.color, cls: 'sm' })}<span class="small">${g.kind === 'ruler' ? 'Your ruler leads in person — beware, rulers can fall in battle.' : 'A courtier of your realm.'}</span></div>`; }
  h += `<div class="card"><b>${E(g.name)}</b> <span style="color:var(--gold)">${'★'.repeat(g.skill)}</span><span class="muted">${'★'.repeat(Math.max(0, 5 - g.skill))}</span><br><span class="tag gold">${gt.name}</span><span class="small muted">${gt.desc}</span></div>`;
  if (mine && !a.merc) {
    const opts = commanderOptions(civ);
    if (opts.length) h += `<div class="row" style="gap:3px;flex-wrap:wrap;margin-top:4px"><span class="small muted">Appoint:</span>${opts.map((o) => `<button class="btn sm ${g.charId === o.p.id ? 'primary' : ''}" data-action="appointCommander" data-id="${a.id}" data-who="${o.id}" title="Martial ${o.p.stats?.mar ?? '?'}">${E(o.label)} ★${Math.max(1, Math.round((o.p.stats?.mar ?? 2) / 2))}</button>`).join('')}</div>`;
  }
  if (a.merc) h += `<div class="small muted">Mercenaries: ${a.merc.upkeep} gold a month. They desert if the treasury runs dry.</div>`;
  const at = attritionOf(a);
  const sd = supplyDistance(a);
  h += `<div class="small" style="margin-top:4px">Supply: ${sd <= SUPPLY_RANGE ? `<span class="good">within supply lines</span> (${sd} tiles)` : `<span class="bad">beyond supply lines</span> (${sd} tiles, limit ${SUPPLY_RANGE})`}${at.total > 0 ? ` · <span class="bad">attrition ${(at.total * 100).toFixed(1)}%/month</span> (${at.items.map(([k]) => k).join(', ')})` : ''}</div>`;
  h += '<h3>Composition</h3><table><tr><th>Regiment</th><th>Count</th><th>Att</th><th>Def</th></tr>';
  for (const k in a.units) h += `<tr><td>${UNITS[k].name}</td><td>${a.units[k].toFixed(1)}</td><td>${UNITS[k].att}</td><td>${UNITS[k].def}</td></tr>`;
  h += '</table>';
  h += `<div class="grid2 small" style="margin-top:6px">${stat('Morale', Math.round(a.morale * 100) + '%', a.morale < 0.4 ? 'bad' : '')}${stat('Strength', fmt(armyPower(a)))}${stat('Speed', armySpeed(a).toFixed(2) + ' /day')}${stat('Siege power', siegePower(a).toFixed(1))}</div>`;
  // Live battle
  const b = battleOf(a);
  if (b && !b.ended) {
    const foe = st.armies.find((x) => x.id === (b.a === a.id ? b.d : b.a));
    const fc = foe ? st.civs[foe.civ] : null;
    h += `<h3>Battle — ${b.phase}, day ${b.day}</h3>`;
    h += `<canvas id="battleCanvas" data-battle="${b.id}" data-army="${a.id}" width="312" height="150" style="width:100%;image-rendering:pixelated;border:1px solid var(--line);border-radius:3px;background:#1a1410"></canvas>`;
    h += `<div class="row between small"><span style="color:${civ.color}">${E(a.name)}: ${fmt(armyCount(a))} · morale ${Math.round(a.morale * 100)}%</span><span style="color:${fc?.color}">${foe ? `${E(foe.name)}: ${fmt(armyCount(foe))} · morale ${Math.round(foe.morale * 100)}%` : ''}</span></div>`;
    h += `<div class="small muted">Losses: ours ${(b.a === a.id ? b.lossA : b.lossD).toFixed(1)}, theirs ${(b.a === a.id ? b.lossD : b.lossA).toFixed(1)} regiments. Skirmish (days 1–3) favours archers; then lines clash in melee; the victor's cavalry pursues.</div>`;
    if (mine) h += `<div style="margin-top:6px"><button class="btn sm" style="border-color:#a33" data-action="armyWithdraw" data-id="${a.id}">Withdraw from battle (−8%)</button></div>`;
  }
  if (a.siege) {
    const s = st.settlements[a.siege.s];
    h += `<h3>Siege of ${E(s.name)}</h3><div class="small">${siegePhase(a)} · ${Math.floor(a.siege.progress)}% · day ${a.siege.days || 0}</div><div class="bar" style="margin-top:3px"><i style="width:${Math.min(100, a.siege.progress)}%;background:linear-gradient(90deg,#a33,#e46b5a)"></i></div>`;
    h += `<div class="small muted">Garrison ${fmt(garrisonOf(s))} · Fortification ×${fortification(s).toFixed(1)}. After 60 days the defenders begin to starve.</div>`;
    if (mine && !a.siege.blocked) h += `<div style="margin-top:6px"><button class="btn sm" style="border-color:#a33" data-action="armyAssault" data-id="${a.id}">Storm the walls (${Math.round(assaultOdds(a) * 100)}% chance)</button></div>`;
  }
  if (mine) {
    h += '<h3>Battle Stance</h3><div class="row" style="gap:4px">';
    for (const [k, l, d] of [['aggressive', 'Aggressive', '+15% attack, −10% defense, morale breaks faster'], ['balanced', 'Balanced', 'No modifiers'], ['defensive', 'Defensive', '+20% defense, −12% attack']]) {
      h += `<button class="btn sm ${(a.stance || 'balanced') === k ? 'primary' : ''}" data-action="armyStance" data-id="${a.id}" data-stance="${k}" title="${d}">${l}</button>`;
    }
    h += '</div>';
  }
  if (mine) {
    const others = st.armies.filter((x) => x !== a && x.civ === a.civ && x.tile === a.tile);
    h += `<h3>Orders</h3><div class="small muted" style="margin-bottom:6px"><b>Right-click</b> on the map to march. Standing in an enemy province besieges its settlement or occupies its land.${canSail(civ) ? ' Armies sail automatically to other shores — escort them with a fleet, or enemy warships may intercept them.' : ''}</div>`;
    h += '<div class="row" style="flex-wrap:wrap;gap:4px">';
    h += `<button class="btn sm" data-action="armyHome" data-id="${a.id}">Return home</button>`;
    h += `<button class="btn sm" data-action="armyStop" data-id="${a.id}">Halt</button>`;
    h += `<button class="btn sm" data-action="armySplit" data-id="${a.id}" ${armyCount(a) >= 2 && a.battle < 0 ? '' : 'disabled'}>Split</button>`;
    for (const o of others) h += `<button class="btn sm" data-action="armyMerge" data-id="${a.id}" data-other="${o.id}">Merge ${E(o.name)}</button>`;
    h += `<button class="btn sm" data-action="armyGeneral" data-id="${a.id}">New general (${generalCost(civ)} ${iconImg('gold', 'ico sm')})</button>`;
    h += `<button class="btn sm" style="border-color:#a33" data-action="armyDisband" data-id="${a.id}" ${a.battle < 0 ? '' : 'disabled'}>Disband</button>`;
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ---------------- Government ----------------
function government(civ) {
  const m = mods(civ);
  const g = GOVERNMENTS[civ.gov];
  const r = civ.ruler;
  let h = head('Government');
  h += '<div class="panel-body">';
  h += `<div class="row">${flagImg(civ, 'flag big')}<div><div style="font-family:var(--pixel);font-size:20px;color:var(--gold)">${E(civ.displayName)}</div><div class="muted small">${g.name} · ${RACES[civ.race].name} · ${ERAS[civ.era].name} Era</div></div></div>`;
  h += '<h3>Ruler</h3><div class="card">';
  h += `<div class="row between"><b style="font-family:var(--pixel);font-size:16px">${E(rulerFullName(civ))}</b><span class="muted">Age ${r.age}</span></div>`;
  h += `<div class="small muted">House ${E(r.dynasty)} · reigning since ${shortDate(r.since)}</div>`;
  h += `<div style="margin-top:6px">${r.traits.map((t) => `<span class="tag gold" title="${TRAITS[t].desc}">${TRAITS[t].name}</span><span class="small muted">${TRAITS[t].desc}</span><br>`).join('')}</div>`;
  const statRow = (s) => s ? `<div class="grid2 small" style="margin-top:6px;grid-template-columns:repeat(5,1fr)">${[['dip', 'Diplomacy'], ['mar', 'Martial'], ['stw', 'Stewardship'], ['lrn', 'Learning'], ['int', 'Intrigue']].map(([k, l]) => `<div title="${l}"><span class="muted">${l.slice(0, 3)}</span> <b style="color:${s[k] >= 7 ? 'var(--good)' : s[k] <= 3 ? 'var(--bad)' : 'var(--text)'}">${s[k] ?? '–'}</b></div>`).join('')}</div>` : '<div class="small muted">Not yet educated</div>';
  h += statRow(r.stats);
  h += `<div class="small muted" style="margin-top:4px">Stewardship raises taxes & build speed, Learning knowledge, Martial defense, Diplomacy stability.</div>`;
  if (civ.regencyUntil > S().day) h += `<div class="small bad" style="margin-top:4px">A regency council rules until Y${Math.floor(civ.regencyUntil / 360) + 1}.</div>`;
  h += '</div>';
  if (g.succession === 'heir') {
    const heir = heirOf(civ);
    h += `<h3>Royal Family</h3>`;
    if (!civ.family.length) h += '<div class="card small bad">No children — the dynasty is at risk. Without an heir a new house takes the throne, and a succession war may follow.</div>';
    for (const c of [...civ.family].sort((a, b) => b.age - a.age)) {
      h += `<div class="card"><div class="row between"><b>${E(c.name)}${c === heir ? ' <span class="tag gold">Heir</span>' : ''}</b><span class="muted small">${c.gender === 'f' ? 'Daughter' : 'Son'}, age ${c.age}${c.edu ? ` · ${c.edu} education` : ''}</span></div>${c.traits.map((t) => `<span class="tag">${TRAITS[t].name}</span>`).join('')}${c.age >= 16 ? statRow(c.stats) : ''}</div>`;
    }
    h += '<h3>Succession Law</h3>';
    for (const [k, L] of Object.entries(SUCCESSION_LAWS)) {
      const cur = (civ.law || 'primogeniture') === k;
      h += `<div class="bitem"><span>${iconImg('stability')}</span><div><div class="nm">${L.name}${cur ? ' <span class="tag gold">Current</span>' : ''}</div><div class="ds">${L.desc}</div></div>${cur ? '<span></span>' : `<button class="btn sm" data-action="setLaw" data-law="${k}" ${civ.treasury >= 60 ? '' : 'disabled'}>Adopt (60 ${iconImg('gold', 'ico sm')}, −5 stab)</button>`}</div>`;
    }
  } else h += `<div class="small muted" style="margin-top:6px">Succession: ${g.succession === 'election' ? 'rulers are elected' : 'power is seized by the strongest'}</div>`;
  if (civ.modifiers?.length) {
    h += '<h3>Active Modifiers</h3>' + civ.modifiers.map((md) => `<div class="stat"><span>${E(md.name)} <span class="muted small">${md.until < 0 ? 'permanent' : 'until ' + shortDate(md.until)}</span></span><b class="small">${Object.entries(md.fx).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.abs(v) < 1 ? Math.round(v * 100) + '%' : v}`).join(', ')}</b></div>`).join('');
  }
  h += '<h3>Standing in the World</h3><div class="grid2">';
  h += stat('Aggressive expansion', Math.round(civ.ae || 0), civ.ae > 30 ? 'bad' : '');
  h += stat('Rival', civ.rival != null ? E(S().civs[civ.rival].baseName) : '—');
  h += '</div><div class="small muted">Conquest and war declarations raise aggressive expansion: neighbours grow hostile and may form coalitions against you. It fades with time.</div>';
  if (civ.dynasties?.length) h += '<h3>Dynasties</h3>' + civ.dynasties.slice(-8).map((d) => `<div class="stat"><span>House ${E(d.name)}</span><span class="muted small">${shortDate(d.from)} – ${d.to != null ? shortDate(d.to) : 'present'}</span></div>`).join('');
  if (civ.rulers?.length) h += '<h3>Past Rulers</h3>' + civ.rulers.slice(-10).reverse().map((x) => `<div class="stat small"><span>${E(x.name)} <span class="muted">of House ${E(x.dynasty)}</span></span><span class="muted">${shortDate(x.from)} – ${shortDate(x.to)} · ${x.cause}</span></div>`).join('');

  const sb = stabilityBreakdown(civ, m);
  h += `<h3>Stability — ${Math.round(civ.stability)} <span class="muted small">(trending to ${Math.round(sb.target)})</span></h3><div class="bar stab"><i style="width:${civ.stability}%"></i></div>`;
  h += '<div style="margin-top:6px">' + sb.items.map(([l, v]) => stat(E(l), (v > 0 ? '+' : '') + v, signCls(v))).join('') + '</div>';
  h += `<div class="small muted" style="margin-top:4px">Stability scales all production (×${(0.75 + 0.5 * civ.stability / 100).toFixed(2)}) and growth.</div>`;

  // ---- Cabinet ----
  const nSeats = seats(civ);
  h += `<h3>Cabinet <span class="muted small">${civ.cabinet.length}/${nSeats} seats · salaries ${fmt(civ.cabinet.reduce((t, a) => t + salary(a), 0))} gold/month</span></h3>`;
  const st2 = S();
  const targetOpts = (a) => {
    const A = ACTIONS[a.action];
    if (!A.target) return '';
    let opts;
    if (A.target === 'civ') opts = st2.civs.filter((o) => o.alive && o.id !== civ.id).map((o) => [o.id, o.baseName]);
    else opts = civ.settlements.map((id) => st2.settlements[id]).filter((x) => (a.action === 'convert' ? x.faith !== civ.faith : x.culture !== civ.race)).map((x) => [x.id, x.name]);
    if (!opts.length) return '<span class="small muted">No target available</span>';
    return `<select data-input="advTarget" data-id="${a.id}">${opts.map(([v, l]) => `<option value="${v}" ${a.target === v ? 'selected' : ''}>${E(l)}</option>`).join('')}</select>`;
  };
  for (const a of civ.cabinet) {
    h += `<div class="card"><div class="row between"><b>${E(a.name)}</b><span style="color:var(--gold)">${'★'.repeat(a.skill)}</span></div>`;
    h += `<div class="small muted">Speciality: ${ACTIONS[a.spec].name} (+1 skill)</div>`;
    h += `<div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap"><select data-input="advAction" data-id="${a.id}">${ACTION_LIST.map((k) => `<option value="${k}" ${a.action === k ? 'selected' : ''}>${ACTIONS[k].name}</option>`).join('')}</select>${targetOpts(a)}<button class="btn sm" data-action="dismissAdvisor" data-id="${a.id}">Dismiss</button></div>`;
    h += `<div class="small muted" style="margin-top:3px">${ACTIONS[a.action].desc} Effective skill ${skillFor(a, a.action)}.</div></div>`;
  }
  if (civ.cabinet.length < nSeats) {
    h += '<div class="small muted" style="margin:4px 0">Candidates:</div>';
    for (const c of civ.candidates) {
      h += `<div class="bitem"><span>★${c.skill}</span><div><div class="nm">${E(c.name)}</div><div class="ds">Skill ${c.skill} · speciality ${ACTIONS[c.spec].name} · salary ${salary(c)}/month</div></div><button class="btn sm" data-action="hireAdvisor" data-id="${c.id}" ${civ.treasury >= hireCost(c) ? '' : 'disabled'}>Hire (${hireCost(c)} ${iconImg('gold', 'ico sm')})</button></div>`;
    }
  }
  h += '<div class="small muted" style="margin-top:4px">More seats come with Monarchy or Empire and in the Renaissance era.</div>';
  // ---- Faith ----
  const sf = faithOf(civ.faith);
  h += `<h3>State Faith</h3><div class="card"><b style="color:${sf?.color}">${E(sf?.name || '—')}</b>${sf?.parent ? ' <span class="tag">Heresy</span>' : ''}<div class="small muted">${E(sf?.desc || '')}</div><div class="small">Blessing: ${Object.entries(sf?.fx || {}).map(([k, v]) => `${k} ${Math.abs(v) < 1 ? '+' + Math.round(v * 100) + '%' : '+' + v}`).join(', ')}</div><div class="small muted">Religious policy: <b>${civ.tolerance === 'enforced' ? 'Enforced' : 'Tolerant'}</b> (change it in the Population panel)</div></div>`;
  h += '<h3>Government Reform</h3><div class="small muted" style="margin-bottom:6px">Your nation persists through every change of ruler, dynasty and government.</div>';
  for (const id in GOVERNMENTS) {
    const G2 = GOVERNMENTS[id];
    const chk = reformCheck(civ, id);
    const cur = civ.gov === id;
    h += `<div class="bitem ${!cur && !chk.ok ? 'locked' : ''}"><span>${iconImg('stability')}</span><div><div class="nm">${G2.name}${cur ? ' <span class="tag gold">Current</span>' : ''}</div><div class="ds">${G2.desc}</div>${!cur && chk.reasons?.length ? `<div class="ds bad">Needs: ${chk.reasons.join(', ')}</div>` : ''}</div>`;
    h += cur ? '<span></span>' : `<button class="btn sm" data-action="reform" data-gov="${id}" ${chk.ok ? '' : 'disabled'}>Adopt ${iconImg('gold', 'ico sm')}${chk.cost}</button>`;
    h += '</div>';
  }
  if (civ.history.length) {
    h += '<h3>Chronicle</h3>' + civ.history.slice(-12).reverse().map((e) => `<div class="small" style="margin:3px 0"><span class="muted">${shortDate(e.day)}</span> ${E(e.text)}</div>`).join('');
  }
  h += '</div>';
  return h;
}

// ---------------- Technology ----------------
function technology(civ) {
  const cur = civ.research.current;
  let h = head('Technology');
  h += '<div class="panel-body">';
  if (cur) {
    const t = TECHS.find((x) => x.id === cur);
    const cost = techCost(civ, cur);
    h += `<div class="card"><div class="row between"><b>Researching: ${t.name}</b><span>${fmt(civ.research.pool)} / ${cost}</span></div><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (civ.research.pool / cost) * 100)}%"></i></div></div>`;
  } else {
    h += `<div class="card"><b class="bad">No research selected.</b> <span class="muted small">Knowledge accumulates (${fmt(civ.research.pool)} stored) until you choose a technology.</span></div>`;
  }
  h += `<label class="toggle"><input type="checkbox" data-input="autoResearch" ${civ.autoResearch ? 'checked' : ''}> Court scholar chooses research automatically</label>`;
  h += `<div class="small muted">Technologies known by neighbouring civilizations are cheaper (trade & cultural exchange). Dashed cards are unique to your race.</div>`;
  ERAS.forEach((era, ei) => {
    const unlocked = eraUnlocked(civ, ei);
    const techs = TECHS.filter((t) => t.era === ei && (!t.race || t.race === civ.race));
    const known = techs.filter((t) => civ.techs.includes(t.id)).length;
    h += `<div class="era"><h3>${era.name} Era <span class="muted small">${known}/${techs.length}${unlocked ? '' : ` · requires ${era.unlockNeed} ${ERAS[ei - 1].name} techs`}</span></h3><div class="techgrid">`;
    for (const t of techs) {
      const isKnown = civ.techs.includes(t.id);
      const can = canResearch(civ, t);
      const cls = isKnown ? 'known' : cur === t.id ? 'current' : can ? '' : 'locked';
      const d = diffusion(civ, t.id);
      h += `<div class="tech ${cls} ${t.race ? 'unique' : ''}" ${can && !isKnown ? `data-action="research" data-id="${t.id}"` : ''}>`;
      h += `${!isKnown && unlocked ? `<span class="tc">${techCost(civ, t.id)}${d > 0 ? ` <span class="good">−${Math.round(d * 100)}%</span>` : ''}</span>` : ''}<div class="tn">${isKnown ? '✓ ' : ''}${t.name}</div><div class="td">${t.desc}</div></div>`;
    }
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// Current production method of a building type, as a one-line recipe.
function pmLine(civ, type) {
  const pm = activePM(type, civ.techs);
  if (!pm) return '';
  const side = (o) => Object.entries(o || {}).map(([g, v]) => `${gdot(g)}${goodName(g)}`).join(' + ');
  const jobs = Object.entries(PRODUCTION[type].jobs || {}).map(([t, n]) => `${n} ${POPS[t].name.toLowerCase()}`).join(', ');
  return `<div class="ds"><b>${pm.name}:</b> ${pm.in ? side(pm.in) + ' → ' : ''}${side(pm.out)} <span class="muted">(${jobs} per level)</span></div>`;
}

// ---------------- Construction ----------------
function buildingList(civ, s) {
  let h = '<div class="blist">';
  const rows = [];
  for (const type of BUILDING_LIST) {
    const def = BUILDINGS[type];
    const r = canBuild(civ, s, type);
    if (r.hidden && !lvl(s, type)) continue;
    const level = lvl(s, type);
    const cost = r.cost || buildCost(civ, s, type);
    const maxed = level >= def.max;
    rows.push({ type, def, r, level, cost, maxed });
  }
  rows.sort((a, b) => (b.r.ok - a.r.ok) || (a.maxed - b.maxed));
  // Phase 14: what this land allows
  const P = G.world.provinces[s.province];
  const deps = Object.entries(P.resources || {}).map(([r, n]) => `<span class="tag" style="border-color:${RESOURCES[r].color};color:${RESOURCES[r].color}">${RESOURCES[r].name}${n > 1 ? ' ×' + n : ''}</span>`).join('');
  const traits = (P.traits || []).map((t) => `<span class="tag gold" title="${E(PTRAITS[t].desc)}">${PTRAITS[t].icon} ${PTRAITS[t].name}</span>`).join('');
  h = `<div class="card small"><div class="row between"><b>Building slots ${slotsUsed(s)}/${slotsOf(s)}</b><span class="muted">grow the town for more · farms, walls, roads, granaries & halls are free</span></div>${traits || deps ? `<div style="margin-top:3px">${traits}${deps}</div>` : '<div class="muted">No special deposits or traits.</div>'}</div>` + h;
  const sug = suggestBuildings(civ, s, 3);
  if (sug.length) h += `<div class="quickbuild"><span class="small muted">Suggested:</span>${sug.map((t) => `<button class="btn sm primary" data-action="build" data-sid="${s.id}" data-type="${t}" title="${E(BUILDINGS[t].desc)}">${iconImg(BUILDINGS[t].icon, 'ico sm')} ${BUILDINGS[t].name}</button>`).join('')}</div>`;
  const blocked = rows.filter((x) => x.r.land && !x.level);
  for (const { type, def, r, level, cost, maxed } of rows.filter((x) => !(x.r.land && !x.level))) {
    h += `<div class="bitem ${r.ok ? '' : 'locked'}"><span>${iconImg(def.icon)}</span><div><div class="nm">${def.name} ${level ? `<span class="tag">Lv ${level}/${maxLevel(def, s.stage)}</span>` : ''}</div><div class="ds">${def.desc}</div>${pmLine(civ, type)}`;
    if (!r.ok && !maxed) h += `<div class="ds bad">${r.reason}</div>`;
    h += `</div><div style="text-align:right">${maxed ? '<span class="muted small">Max</span>' : `${costHtml(cost, civ)}<br><button class="btn sm" data-action="build" data-sid="${s.id}" data-type="${type}" ${r.ok ? '' : 'disabled'}>Build</button>`}</div></div>`;
  }
  if (blocked.length) h += `<details class="blocked"><summary class="small muted">Not possible on this land (${blocked.length})</summary>${blocked.map((x) => `<div class="small"><b>${x.def.name}</b> — <span class="bad">${E(x.r.reason)}</span></div>`).join('')}</details>`;
  return h + '</div>';
}

function queueHtml(civ, s) {
  if (!s.queue.length) return '<div class="muted small">Nothing under construction.</div>';
  return s.queue.map((q, i) => `<div class="queue-item">${iconImg(BUILDINGS[q.type].icon, 'ico sm')}<span style="min-width:110px">${BUILDINGS[q.type].name}</span><div class="bar"><i style="width:${i === 0 ? Math.min(100, (q.progress / q.total) * 100) : 0}%"></i></div><span class="small muted">${i === 0 ? Math.max(0, Math.ceil((q.total - q.progress) / mods(civ).build)) + 'd' : 'queued'}</span><button class="btn sm ghost" data-action="cancel" data-sid="${s.id}" data-idx="${i}" title="Cancel (50% refund)">✕</button></div>`).join('');
}

function construction(civ) {
  const ui = G.ui;
  const setts = settlementsOf(civ);
  if (ui.buildSid == null || !setts.find((s) => s.id === ui.buildSid)) ui.buildSid = setts[0]?.id;
  const s = S().settlements[ui.buildSid];
  let h = head('Construction');
  h += '<div class="panel-body">';
  h += `<div class="small muted">You direct major construction; houses and homes grow on their own as population rises (${iconImg('housing', 'ico sm')} uses wood, and stone from Town size).</div>`;
  h += `<label class="toggle"><input type="checkbox" data-input="autoBuild" ${civ.autoBuild ? 'checked' : ''}> Royal architect builds automatically</label>`;
  h += '<div class="row" style="flex-wrap:wrap;gap:4px;margin:8px 0">' + setts.map((x) => `<button class="btn sm ${x.id === ui.buildSid ? 'primary' : ''}" data-action="pickBuild" data-sid="${x.id}">${E(x.name)}${x.queue.length ? ` (${x.queue.length})` : ''}</button>`).join('') + '</div>';
  if (s) {
    h += `<h3>${E(s.name)} — ${STAGES[s.stage].name}</h3>`;
    h += queueHtml(civ, s);
    h += '<h3>Available Buildings</h3>' + buildingList(civ, s);
  }
  h += '</div>';
  return h;
}

// ---------------- Population ----------------
function population(civ) {
  const m = mods(civ);
  const setts = settlementsOf(civ);
  const total = civPopulation(civ);
  let h = head('Population');
  h += '<div class="panel-body">';
  h += '<div class="grid2">';
  h += stat('Total population', fmt(total));
  h += stat('Living standard', `<span class="${solCls(civ.sol ?? 5)}">${(civ.sol ?? 5).toFixed(1)} / 10</span>`);
  h += stat('Growth modifier', '×' + m.growth.toFixed(2));
  h += stat('Housing modifier', '×' + m.housing.toFixed(2));
  h += '</div>';
  // Pops by profession
  const agg = {};
  for (const t of POP_LIST) agg[t] = { n: 0, sol: 0, inc: 0 };
  for (const s of setts) for (const t of POP_LIST) {
    const n = s.pops?.[t] || 0;
    agg[t].n += n; agg[t].sol += (s.solBy?.[t] ?? 5) * n; agg[t].inc += (s.inc?.[t] || 0) * n;
  }
  h += '<h3>Pops</h3><table><tr><th>Profession</th><th>People</th><th>Share</th><th>Income</th><th>Living std.</th></tr>';
  for (const t of POP_LIST) {
    const a = agg[t];
    if (a.n < 0.5) continue;
    const sol = a.sol / a.n;
    h += `<tr title="${POPS[t].desc}"><td><i class="gdot" style="background:${POPS[t].color}"></i> ${POPS[t].name}</td><td>${fmt(a.n)}</td><td>${Math.round((a.n / Math.max(1, total)) * 100)}%</td><td>${(a.inc / a.n).toFixed(2)}</td><td class="${solCls(sol)}">${sol.toFixed(1)}</td></tr>`;
  }
  h += '</table><div class="small muted" style="margin-top:4px">Living standard (0–10) = how much of their basic, comfort and luxury needs pops can afford and find in the market. Low standards breed unrest; high ones speed growth and draw migrants.</div>';
  // Cultures & faiths
  const demo = realmDemographics(civ);
  h += `<h3>Cultures</h3>`;
  for (const [r, n] of Object.entries(demo.cultures).sort((a, b) => b[1] - a[1])) {
    const acc = acceptedCulture(civ, r);
    h += `<div class="row between small" style="margin:3px 0"><span>${RACES[r].adj} — ${fmt(n)} (${Math.round((n / Math.max(1, total)) * 100)}%) ${r === civ.race ? '<span class="tag gold">Ruling</span>' : acc ? '<span class="tag good">Accepted</span>' : '<span class="tag bad">Foreign</span>'}</span>`;
    if (r !== civ.race) h += acc ? `<button class="btn sm" data-action="revokeCulture" data-race="${r}">Revoke</button>` : `<button class="btn sm" data-action="acceptCulture" data-race="${r}" ${civ.accepted.length < maxAccepted(civ) && civ.treasury >= 100 ? '' : 'disabled'} title="100 gold, −5 stability. Max ${maxAccepted(civ)} in this era.">Accept</button>`;
    h += '</div>';
  }
  h += '<div class="small muted">Foreign cultures add unrest (+15); accepted ones only +3. People slowly assimilate — faster with a cabinet advisor integrating them.</div>';
  h += `<h3>Faiths</h3>`;
  for (const [f, n] of Object.entries(demo.faiths).sort((a, b) => b[1] - a[1])) {
    const F = faithOf(f);
    h += `<div class="row between small" style="margin:3px 0"><span><i class="gdot" style="background:${F?.color}"></i> ${E(F?.name || f)} — ${Math.round((n / Math.max(1, total)) * 100)}% ${f === civ.faith ? '<span class="tag gold">State faith</span>' : F?.parent ? '<span class="tag">Heresy</span>' : ''}</span>${f !== civ.faith ? `<button class="btn sm" data-action="adoptFaith" data-faith="${f}" title="Make this the state faith: −15 stability">Adopt</button>` : ''}</div>`;
  }
  h += `<div class="row" style="gap:4px;margin-top:6px"><span class="small muted">Religious policy:</span><button class="btn sm ${civ.tolerance === 'tolerant' ? 'primary' : ''}" data-action="tolerance" data-mode="tolerant" title="Other faiths: +5 unrest (+3 if related). Slow conversion.">Tolerant</button><button class="btn sm ${civ.tolerance === 'enforced' ? 'primary' : ''}" data-action="tolerance" data-mode="enforced" title="Other faiths: +12 unrest. Fast conversion, especially with temples.">Enforced</button></div>`;
  h += '<h3>Settlements</h3><table><tr><th>Name</th><th>Size</th><th>Pop</th><th>Std.</th><th>People</th><th>Faith</th></tr>';
  for (const s of setts.sort((a, b) => b.pop - a.pop)) {
    h += `<tr class="click" data-action="focusSettlement" data-id="${s.id}"><td>${s.isCapital ? '★ ' : ''}${E(s.name)}</td><td>${STAGES[s.stage].short}</td><td>${fmt(s.pop)}</td><td class="${solCls(s.sol ?? 5)}">${(s.sol ?? 5).toFixed(1)}</td><td class="small">${RACES[s.culture].adj}</td><td class="small"><i class="gdot" style="background:${faithOf(s.faith)?.color}"></i>${E(faithOf(s.faith)?.short || '')}</td></tr>`;
  }
  h += '</table></div>';
  return h;
}

// ---------------- Province / settlement context ----------------
export function provincePanel(pid) {
  const st = S();
  const W = G.world;
  const P = W.provinces[pid];
  const ps = st.provinces[pid];
  const me = player();
  const owner = ps.owner >= 0 ? st.civs[ps.owner] : null;
  const s = ps.settlement >= 0 ? st.settlements[ps.settlement] : null;
  let h = head(E(s ? s.name : P.name), owner ? flagImg(owner) : '');
  h += '<div class="panel-body">';
  h += `<div class="small muted">${s ? `${s.isCapital ? '★ Capital · ' : ''}${STAGES[s.stage].name} in ${E(P.name)}` : ps.claimedBy >= 0 ? `Province under the influence of ${E(st.settlements[ps.claimedBy].name)}` : 'Unclaimed wilderness'}${owner ? ` · <span style="color:${owner.color}">${E(owner.displayName)}</span>` : ''}</div>`;

  if (s) {
    const civ = st.civs[s.civ];
    const mine = civ.id === me.id;
    const r = settlementSummary(civ, s);
    h += `<div class="row" style="margin:6px 0"><button class="btn sm" data-action="viewTown" data-id="${s.id}">🔭 Visit ${E(s.name)}</button></div>`; // Phase 22: the side-view scene
    h += '<h3>Settlement</h3><div class="grid2">';
    h += stat(`${iconImg('pop', 'ico sm')} Population`, fmt(s.pop));
    h += stat(`${iconImg('housing', 'ico sm')} Housing`, `${fmt(s.housing)} / ${fmt(maxHousing(civ, s))}`);
    h += stat('Founded', shortDate(s.founded));
    h += stat('Claimed provinces', s.claims.length);
    h += '</div>';
    const next = STAGES[s.stage + 1];
    if (next) {
      const reqs = next.req.filter((x) => !lvl(s, x)).map((x) => BUILDINGS[x].name);
      h += `<div class="small" style="margin-top:6px">Next: <b>${next.name}</b> at ${next.minPop} pop${reqs.length ? ` <span class="muted">· needs ${reqs.join(', ')}</span>` : ''}</div><div class="bar" style="margin-top:3px"><i style="width:${Math.min(100, (s.pop / next.minPop) * 100)}%"></i></div>`;
    }
    {
      const ub = unrestBreakdown(civ, s);
      const u = Math.round(s.unrest || 0);
      const tip = E(ub.items.map(([l, v]) => `${l}: ${v > 0 ? '+' : ''}${v}`).join('\n') || 'Content');
      h += `<div class="row between small" style="margin-top:8px"><span title="${tip}" style="cursor:help">Unrest <b class="${u > 60 ? 'bad' : u > 35 ? '' : 'good'}">${u}</b> <span class="muted">→ ${Math.round(ub.target)}</span></span><span class="muted">${RACES[s.culture || civ.race].adj} people${s.conquered != null ? ' · conquered ' + shortDate(s.conquered) : ''}</span></div><div class="bar" style="margin-top:3px"><i style="width:${u}%;background:linear-gradient(90deg,#e6c068,#e46b5a)"></i></div>`;
      if (u > 60) h += '<div class="small bad">Revolt is likely! Garrison an army here, build temples, lower taxes, or raise stability.</div>';
    }
    if (mine) {
      h += '<h3>Pops</h3><div class="popbar">' + POP_LIST.filter((t) => r.pops[t] > 0.5).map((t) => `<i style="flex:${r.pops[t]};background:${POPS[t].color}" title="${POPS[t].name}: ${fmt(r.pops[t])} · living std. ${(r.solBy[t] ?? 5).toFixed(1)} · income ${(r.inc[t] || 0).toFixed(2)}"></i>`).join('') + '</div>';
      h += '<div class="small" style="margin-top:3px">' + POP_LIST.filter((t) => r.pops[t] > 0.5).map((t) => `<span style="white-space:nowrap;margin-right:8px"><i class="gdot" style="background:${POPS[t].color}"></i>${POPS[t].name} ${fmt(r.pops[t])}${t !== 'peasants' && r.jobs[t] > 0 ? `<span class="muted">/${fmt(r.jobs[t])}</span>` : ''}</span>`).join('') + '</div>';
      h += `<div class="small" style="margin-top:4px">Living standard <b class="${solCls(r.sol)}">${r.sol.toFixed(1)}</b> · food supply ${Math.round(r.foodSat * 100)}%</div>`;
      const prod = Object.entries(r.prod).filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1]);
      h += '<h3>Monthly Production</h3>' + (prod.length ? '<div class="small">' + prod.map(([g, v]) => `<span style="white-space:nowrap;margin-right:10px">${gdot(g)}${goodName(g)} ${fmt(v)}</span>`).join('') + '</div>' : '<div class="muted small">Nothing yet.</div>');
      const methods = Object.keys(s.buildings).map((k) => [k, activePM(k, civ.techs)]).filter(([, pm]) => pm);
      if (methods.length) h += '<div class="small muted" style="margin-top:4px">' + methods.map(([k, pm]) => `${BUILDINGS[k].name}: ${pm.name}`).join(' · ') + '</div>';
    }
    h += `<div class="small" style="margin-top:6px">${RACES[s.culture].adj} people${s.culture !== civ.race ? ` <span class="muted">(assimilating ${Math.floor(s.assim || 0)}%)</span>` : ''} · <i class="gdot" style="background:${faithOf(s.faith)?.color}"></i>${E(faithName(s.faith))}${s.faith !== civ.faith ? ` <span class="muted">(converting ${Math.floor(s.convert || 0)}%)</span>` : ''}</div>`;
    const built = Object.entries(s.buildings).filter(([, v]) => v > 0);
    h += '<h3>Buildings</h3>' + (built.length ? built.map(([k, v]) => `<span class="tag">${BUILDINGS[k].name}${v > 1 ? ' ' + v : ''}</span>`).join('') : '<span class="muted small">Only homes so far.</span>');
    if (mine) {
      h += '<h3>Construction</h3>' + queueHtml(civ, s);
      h += `<div style="margin-top:6px"><button class="btn sm" data-action="openBuild" data-sid="${s.id}">Open construction menu</button></div>`;
    }
  }

  // Armies in the province
  const here = st.armies.filter((a) => G.world.province[a.tile] === pid);
  if (here.length) {
    h += '<h3>Armies Present</h3>';
    for (const a of here) {
      const c = st.civs[a.civ];
      h += `<div class="row between small" style="cursor:pointer;padding:2px 0" data-action="selectArmy" data-id="${a.id}"><span>${flagImg(c)} <span style="color:${c.color}">${E(a.name)}</span> · ${fmt(armyCount(a))} regiments</span><span class="muted">${armyStatus(a)}</span></div>`;
    }
  }
  if (s) {
    const besiegers = st.armies.filter((a) => a.siege && a.siege.s === s.id);
    if (besiegers.length) h += `<div class="card small bad" style="margin-top:6px">Under siege! Progress ${Math.floor(Math.max(...besiegers.map((a) => a.siege.progress)))}% · Garrison ${fmt(garrisonOf(s))} · Fortification ×${fortification(s).toFixed(1)}</div>`;
    if (s.civ === me.id && s.stage >= 1) h += `<div style="margin-top:6px"><button class="btn sm" data-action="openRecruit" data-sid="${s.id}">Recruit troops here</button></div>`;
  }

  // Province terrain
  h += '<h3>Province</h3>';
  const biomeList = Object.entries(P.biomes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b, n]) => `${BIOMES[b].name} ${Math.round((n / P.tiles.length) * 100)}%`);
  h += `<div class="small">${biomeList.join(' · ')}</div>`;
  h += `<div class="small muted">${P.tiles.length} tiles${P.river ? ' · river' : ''}${P.coastal ? ' · coastal' : ''}</div>`;
  const resList = Object.entries(P.resources).map(([r, n]) => `<span class="tag" style="border-color:${RESOURCES[r].color};color:${RESOURCES[r].color}">${RESOURCES[r].name}${n > 1 ? ' ×' + n : ''}</span>`);
  if (resList.length) h += `<div style="margin-top:4px">${resList.join('')}</div>`;
  if (P.traits?.length) h += `<div style="margin-top:4px">${P.traits.map((t) => `<span class="tag gold" title="${E(PTRAITS[t].desc)}">${PTRAITS[t].icon} ${PTRAITS[t].name}</span>`).join('')}</div><div class="small muted">${P.traits.map((t) => PTRAITS[t].desc).join(' ')}</div>`;
  const q = s ? quality(s) : null;
  const pot = P.pot;
  const stars = (v) => '★'.repeat(Math.max(0, Math.min(5, Math.round(v * 3)))) + '<span class="muted">' + '★'.repeat(Math.max(0, 5 - Math.min(5, Math.round(v * 3)))) + '</span>';
  h += '<div class="grid2 small" style="margin-top:6px">';
  for (const k of ['food', 'wood', 'stone', 'iron', 'gold']) h += `<div class="row between"><span>${iconImg(k, 'ico sm')} ${SECTOR_NAMES[k]}</span><span style="color:var(--gold)">${stars(pot[k])}</span></div>`;
  h += '</div>';
  void q;

  // Colonize action
  if (s && blockadedSet().has(s.id)) h += `<div class="card small bad" style="margin-top:6px">Blockaded by the fleet of ${E(st.civs[blockadedSet().get(s.id)].displayName)}: trade −50%, taxes −30%.</div>`;
  if (!s && me.alive) {
    const c = canColonize(me, pid);
    const cost = c.cost || colonyCost(me);
    h += '<h3>Settle</h3>';
    h += `<div class="small muted">Send 20 settlers from your nearest settlement to found a new camp here.</div>`;
    h += `<div class="row between" style="margin-top:6px">${costHtml(cost, me)}<button class="btn primary sm" data-action="colonize" data-pid="${pid}" ${c.ok ? '' : 'disabled'}>Send settlers</button></div>`;
    if (!c.ok) h += `<div class="small bad" style="margin-top:4px">${c.reason}</div>`;
  }
  h += '</div>';
  return h;
}

// ---------------- Ledger: rankings, chronicle, world ----------------
function ledger(civ) {
  const st = S();
  const ui = G.ui;
  ui.ledgerTab ??= 'realms';
  let h = head('Ledger');
  h += '<div class="panel-body">';
  h += '<div class="row" style="gap:4px;margin-bottom:8px">' + [['realms', 'Realms'], ['trends', 'Trends'], ['chronicle', 'World Chronicle'], ['world', 'The World']].map(([k, l]) => `<button class="btn sm ${ui.ledgerTab === k ? 'primary' : ''}" data-action="ledgerTab" data-tab="${k}">${l}</button>`).join('') + '</div>';
  if (ui.ledgerTab === 'realms') {
    const rows = st.civs.filter((c) => c.alive).map((c) => ({
      c, pop: civPopulation(c), prov: st.provinces.filter((p) => p.owner === c.id).length, setts: c.settlements.length,
      mil: Math.round(militaryStrengthOf(c.id)), techs: c.techs.length, gold: c.treasury, stab: c.stability, score: scoreOf(c).total,
    }));
    const key = ui.ledgerSort || 'score';
    rows.sort((a, b) => b[key] - a[key]);
    const th = (k, l) => `<th style="cursor:pointer" data-action="ledgerSort" data-key="${k}">${l}${key === k ? ' ▼' : ''}</th>`;
    h += `<table><tr><th>#</th><th>Realm</th>${th('score', 'Score')}${th('pop', 'Pop')}${th('prov', 'Prov')}${th('mil', 'Army')}${th('techs', 'Tech')}${th('gold', 'Gold')}${th('stab', 'Stab')}</tr>`;
    rows.forEach((r, i) => {
      const cap = st.settlements[r.c.capital];
      h += `<tr class="click" ${cap ? `data-action="focusSettlement" data-id="${cap.id}"` : ''} style="${r.c.id === civ.id ? 'background:rgba(230,192,104,.12)' : ''}"><td class="muted">${i + 1}</td><td>${flagImg(r.c)} <span style="color:${r.c.color}">${E(r.c.displayName)}</span><div class="muted small">${RACES[r.c.race].name} · ${GOVERNMENTS[r.c.gov].name} · ${ERAS[r.c.era].name}</div></td><td><b>${fmt(r.score)}</b></td><td>${fmt(r.pop)}</td><td>${r.prov}</td><td>${fmt(r.mil)}</td><td>${r.techs}</td><td>${fmt(r.gold)}</td><td>${Math.round(r.stab)}</td></tr>`;
    });
    h += '</table><div class="small muted" style="margin-top:4px">Click a column to sort, a realm to visit its capital.</div>';
  } else if (ui.ledgerTab === 'trends') {
    h += trendsView(civ);
  } else if (ui.ledgerTab === 'chronicle') {
    ui.chronFilter ??= 'all';
    h += '<button class="btn gold" data-action="openChronicle" style="width:100%;margin-bottom:6px">📖 Open the illustrated Chronicle of your realm (J)</button>';
    h += '<div class="row" style="gap:4px;margin-bottom:6px">' + [['all', 'Whole world'], ['mine', 'My realm'], ['wars', 'Wars & conquest']].map(([k, l]) => `<button class="btn sm ${ui.chronFilter === k ? 'primary' : ''}" data-action="chronFilter" data-f="${k}">${l}</button>`).join('') + '</div>';
    let list = [...(st.chronicle || [])].reverse();
    if (ui.chronFilter === 'mine') list = list.filter((e) => e.civ === civ.id);
    if (ui.chronFilter === 'wars') list = list.filter((e) => /WAR|falls|Battle|vassal|REVOLUTION|independence|throne|crushed/.test(e.text));
    if (!list.length) h += '<div class="muted small">History has yet to be written.</div>';
    let lastYear = -1;
    for (const e of list.slice(0, 200)) {
      const y = Math.floor(e.day / 360) + 1;
      if (y !== lastYear) { h += `<div style="font-family:var(--pixel);color:var(--gold);margin-top:8px">Year ${y}</div>`; lastYear = y; }
      h += `<div class="small ${e.tile >= 0 ? 'click' : ''}" style="padding:2px 0 2px 8px;border-left:2px solid ${st.civs[e.civ]?.color || 'var(--line)'};margin:2px 0;${e.tile >= 0 ? 'cursor:pointer' : ''}" ${e.tile >= 0 ? `data-action="focusTile" data-tile="${e.tile}"` : ''}>${E(e.text)}</div>`;
    }
  } else {
    const alive = st.civs.filter((c) => c.alive);
    let pop = 0; for (const c of alive) pop += civPopulation(c);
    const biggest = [...alive].sort((a, b) => st.provinces.filter((p) => p.owner === b.id).length - st.provinces.filter((p) => p.owner === a.id).length)[0];
    const advanced = [...alive].sort((a, b) => b.techs.length - a.techs.length)[0];
    const fallen = st.civs.filter((c) => !c.alive && !c.rebel).length;
    h += '<div class="grid2">';
    h += stat('Year', Math.floor(st.day / 360) + 1) + stat('Living realms', alive.length);
    h += stat('World population', fmt(pop)) + stat('Fallen realms', fallen);
    h += stat('Active wars', st.wars.length) + stat('Settlements', st.settlements.filter((s) => !s.dead).length);
    h += stat('Largest realm', biggest ? E(biggest.baseName) : '—') + stat('Most advanced', advanced ? E(advanced.baseName) : '—');
    h += stat('Armies in the field', st.armies.length) + stat('Unclaimed provinces', st.provinces.filter((p) => p.owner < 0).length);
    h += '</div>';
    h += '<h3>Peoples of the World</h3>';
    const byRace = {};
    for (const c of alive) byRace[c.race] = (byRace[c.race] || 0) + civPopulation(c);
    const tot = Math.max(1, pop);
    for (const [r, p] of Object.entries(byRace).sort((a, b) => b[1] - a[1])) {
      h += `<div class="row between small"><span>${RACES[r].name}</span><span>${fmt(p)} (${Math.round((p / tot) * 100)}%)</span></div><div class="bar" style="margin:2px 0 6px"><i style="width:${(p / tot) * 100}%;background:${RACES[r].colors[0]}"></i></div>`;
    }
    h += '<h3>Wildlife</h3>';
    const counts = {};
    for (const a of st.animals) counts[a.sp] = (counts[a.sp] || 0) + 1;
    h += Object.entries(counts).map(([k, v]) => `<span class="tag">${k}: ${v}</span>`).join('');
  }
  h += '</div>';
  return h;
}

// ---------------- Overview (Phase 15): the state of the realm at a glance ----------------
function overview(civ) {
  const st = S();
  const L = projectLedger(civ);
  const rk = rankings();
  const rank = rk.findIndex((x) => x.c.id === civ.id) + 1;
  const hist = civ.hist || [];
  const ago = hist.length > 5 ? hist[hist.length - 6] : hist[0];
  let pop = 0; for (const id of civ.settlements) pop += st.settlements[id].pop;
  const growth = ago ? pop - ago[1] : 0;
  let h = head('Overview');
  h += '<div class="panel-body">';
  h += '<div class="ov-stats">';
  const tile = (label, value, sub, cls = '') => `<div class="ov-stat"><div class="small muted">${label}</div><b class="${cls}">${value}</b><div class="small muted">${sub}</div></div>`;
  h += tile('Rank', `#${rank || '–'} / ${rk.length}`, `score ${fmt(scoreOf(civ).total)}`);
  h += tile('Treasury', fmt(civ.treasury), `${fmtSigned(L.net.gold)} / month`, signCls(L.net.gold));
  h += tile('Stability', Math.round(civ.stability), stabilityBreakdown(civ).target > civ.stability + 2 ? 'rising' : stabilityBreakdown(civ).target < civ.stability - 2 ? 'falling' : 'steady', civ.stability < 35 ? 'bad' : civ.stability > 60 ? 'good' : '');
  h += tile('Population', fmt(pop), ago ? `${fmtSigned(growth)} in 5 years` : '—', growth >= 0 ? 'good' : 'bad');
  h += tile('Living standard', (civ.sol ?? 0).toFixed(1), (civ.sol ?? 5) >= 6.5 ? 'prosperous' : (civ.sol ?? 5) < 4 ? 'poor' : 'getting by');
  h += tile('Research', civ.research.current ? E(TECHS.find((t) => t.id === civ.research.current)?.name || '') : '<span class="bad">none</span>', `${fmt(L.knowledge)} / month · ${ERAS[civ.era].name}`);
  h += '</div>';
  // Needs attention
  const todo = [];
  const setts = civ.settlements.map((id) => st.settlements[id]);
  const idle = setts.filter((s) => !s.queue.length);
  if (!civ.research.current && !civ.autoResearch) todo.push(['bad', '⚗ No research chosen', 'Knowledge is being wasted.', 'data-action="open" data-panel="technology"', 'Choose']);
  if (civ.last?.starving) todo.push(['bad', '🍞 Famine', 'Not enough grain and fish reach the people.', 'data-action="open" data-panel="economy"', 'Economy']);
  if (L.net.gold < -1 && civ.treasury < 300) todo.push(['bad', '◎ Losing money', `${fmtSigned(L.net.gold)} gold a month — trim the army, raise taxes or build markets.`, 'data-action="open" data-panel="economy"', 'Economy']);
  if (idle.length && !civ.autoBuild) todo.push(['warn', `💤 ${idle.length} settlement${idle.length === 1 ? '' : 's'} building nothing`, idle.slice(0, 4).map((s) => E(s.name)).join(', '), `data-action="openBuild" data-sid="${idle[0].id}"`, 'Build']);
  for (const s of setts.filter((x) => (x.unrest || 0) >= 50).slice(0, 3)) todo.push(['bad', `⚠ Unrest in ${E(s.name)} (${Math.round(s.unrest)})`, 'Garrison an army, build a temple, or improve living standards.', `data-action="focusSettlement" data-id="${s.id}"`, 'Go']);
  for (const g of GROUP_LIST) { const grp = civ.groups?.[g]; if (grp && grp.movement >= 40) todo.push(['warn', `✊ ${GROUPS[g].name} movement ${Math.round(grp.movement)}%`, 'Enact a law they want or bribe them before it boils over.', 'data-action="open" data-panel="politics"', 'Politics']); }
  if (st.plots.some((p) => p.target === civ.id && p.discovered)) todo.push(['bad', '🗡 A plot against you', 'Expose it in the Court panel.', 'data-action="open" data-panel="court"', 'Court']);
  if (GOVERNMENTS[civ.gov].succession === 'heir' && !civ.family?.length && civ.ruler.age > 30) todo.push(['warn', '♛ No heir', civ.ruler.spouse ? 'Without children another house will take the throne.' : 'Your ruler is unmarried — arrange a marriage in Diplomacy.', 'data-action="open" data-panel="court"', 'Court']);
  for (const p of (st.plays || []).filter((x) => x.def === civ.id)) todo.push(['bad', `⚑ ${E(st.civs[p.att].displayName)} makes demands`, 'Give in, or prepare for war (Diplomacy).', 'data-action="open" data-panel="diplomacy"', 'Diplomacy']);
  for (const o of (st.offers || []).filter((x) => x.to === civ.id).slice(0, 3)) todo.push(['info', `✉ Offer from ${E(st.civs[o.from].displayName)}`, 'Answer it in Diplomacy.', 'data-action="open" data-panel="diplomacy"', 'Answer']);
  h += '<h3>Needs attention</h3>';
  if (!todo.length) h += '<div class="small good">All is well in the realm.</div>';
  for (const [cls, t, d, act, btn] of todo) h += `<div class="todo ${cls}"><div><b>${t}</b><div class="small muted">${d}</div></div><button class="btn sm" ${act}>${btn}</button></div>`;
  // Wars
  const wars = warsOf(civ.id);
  if (wars.length) {
    h += '<h3>Wars</h3>';
    for (const w of wars) h += `<div class="card small"><b>${E(w.name)}</b>${warBar(w, civ.id)}</div>`;
  }
  // Construction across the realm
  h += '<h3>Construction</h3><table class="ov-build">';
  for (const s of setts) {
    const q = s.queue[0];
    let cell;
    if (q) cell = `${BUILDINGS[q.type].name} <span class="muted">${Math.round((q.progress / Math.max(1, q.total)) * 100)}%</span>${s.queue.length > 1 ? ` <span class="muted">+${s.queue.length - 1}</span>` : ''}`;
    else { const sug = suggestBuildings(civ, s, 1)[0]; cell = sug ? `<button class="btn sm" data-action="build" data-sid="${s.id}" data-type="${sug}">Build ${BUILDINGS[sug].name}</button>` : '<span class="muted">nothing affordable</span>'; }
    h += `<tr><td><span class="click" data-action="focusSettlement" data-id="${s.id}">${E(s.name)}</span> <span class="muted small">${STAGES[s.stage].short}</span></td><td class="small">${slotsUsed(s)}/${slotsOf(s)}</td><td class="small">${cell}</td></tr>`;
  }
  h += '</table>';
  // Market highlights
  const goods = goodsBalance(civ).filter((r) => r.supply + r.demand > 1);
  const short = goods.filter((r) => r.price > r.base * 1.4).sort((a, b) => b.price / b.base - a.price / a.base).slice(0, 4);
  const glut = goods.filter((r) => r.price < r.base * 0.75).sort((a, b) => a.price / a.base - b.price / b.base).slice(0, 4);
  if (short.length || glut.length) {
    h += '<h3>Markets</h3><div class="grid2 small">';
    h += `<div><b class="bad">Shortages</b>${short.map((r) => `<div>${gdot(r.g)}${goodName(r.g)} <span class="muted">×${(r.price / r.base).toFixed(1)} price</span></div>`).join('') || '<div class="muted">none</div>'}</div>`;
    h += `<div><b class="good">Surpluses</b>${glut.map((r) => `<div>${gdot(r.g)}${goodName(r.g)} <span class="muted">×${(r.price / r.base).toFixed(1)} price</span></div>`).join('') || '<div class="muted">none</div>'}</div>`;
    h += '</div>';
  }
  // Recent events
  const recent = st.log.filter((e) => e.civ === civ.id).slice(-8).reverse();
  if (recent.length) h += '<h3>Recently</h3>' + recent.map((e) => `<div class="small ${e.tile >= 0 ? 'click' : ''}" ${e.tile >= 0 ? `data-action="focusTile" data-tile="${e.tile}"` : ''} style="padding:1px 0 1px 6px;border-left:3px solid ${e.type === 'good' ? 'var(--good)' : e.type === 'bad' ? 'var(--bad)' : 'var(--line2)'}">${E(e.text)}</div>`).join('');
  h += '</div>';
  return h;
}

// ---------------- Court (Phase 11) ----------------
const STATS5 = [['dip', 'Dip'], ['mar', 'Mar'], ['stw', 'Stw'], ['lrn', 'Lrn'], ['int', 'Int']];
const statPips = (s) => s ? `<div class="pips">${STATS5.map(([k, l]) => `<span title="${STAT_NAMES[k]}" class="${s[k] >= 7 ? 'good' : s[k] <= 3 ? 'bad' : ''}"><i>${l}</i>${s[k] ?? '–'}</span>`).join('')}</div>` : '<div class="small muted">Not yet educated</div>';
const traitTags = (p) => (p.traits || []).map((t) => `<span class="tag gold" title="${E(TRAITS[t]?.desc || '')}">${E(TRAITS[t]?.name || t)}</span>`).join('');
function personCard(p, race, opts = {}) {
  return `<div class="person ${opts.cls || ''}">${portraitImg(p, race, { crown: opts.crown, bg: opts.bg })}<div class="pi"><div class="row between"><b>${E(opts.title || p.name)}</b>${opts.tag || ''}</div><div class="small muted">${opts.sub || ''}</div>${traitTags(p)}${p.stats || opts.stats ? statPips(p.stats) : ''}${opts.extra || ''}</div></div>`;
}
function court(civ) {
  const st = S();
  let h = head('Court');
  h += '<div class="panel-body">';
  const r = civ.ruler;
  const g = GOVERNMENTS[civ.gov];
  ensureCharacters(civ);
  // Ruler
  const ls = r.lifestyle ? LIFESTYLES[r.lifestyle] : null;
  h += personCard(r, civ.race, { crown: true, bg: civ.color, title: rulerFullName(civ), cls: 'big', sub: `Age ${r.age} · House ${E(r.dynasty)} · reigning since ${shortDate(r.since)}${r.claim >= 0 && st.civs[r.claim]?.alive ? ` · claim on ${E(st.civs[r.claim].baseName)}` : ''}` });
  // Phase 21: court intrigue — schemes against other realms
  {
    const sm = spymaster(civ);
    const targets = (civ.contacts || []).map((id) => st.civs[id]).filter((o) => o?.alive).sort((a, b) => opinion(civ.id, a.id) - opinion(civ.id, b.id));
    G.ui.schemeTarget = targets.some((o) => o.id === G.ui.schemeTarget) ? G.ui.schemeTarget : targets[0]?.id;
    h += `<h3>Schemes</h3><div class="small muted">Your schemer: <b>${E(sm.name || '—')}</b> (intrigue ${sm.int}${sm.schemer ? ', a born schemer' : ''}). Agents may be caught, which angers the target.</div>`;
    for (const [i, sc] of (civ.schemes || []).entries()) h += `<div class="card" style="margin-top:4px"><div class="row between"><span>${SCHEMES[sc.kind].icon} <b>${E(SCHEMES[sc.kind].name)}</b> against ${E(st.civs[sc.target]?.baseName || '?')}</span><button class="btn sm" data-action="cancelScheme" data-i="${i}">Recall</button></div><div class="bar" style="margin:3px 0"><i style="width:${(sc.progress / sc.months) * 100}%"></i></div><div class="small muted">${sc.progress}/${sc.months} months · ${Math.round(sc.odds * 100)}% chance to stay hidden</div></div>`;
    if (targets.length) {
      h += `<div class="row" style="gap:6px;margin:6px 0"><span class="small">Target</span><select data-input="schemeTarget">${targets.map((o) => `<option value="${o.id}" ${o.id === G.ui.schemeTarget ? 'selected' : ''}>${E(o.displayName)} (${opinion(civ.id, o.id) > 0 ? '+' : ''}${opinion(civ.id, o.id)})</option>`).join('')}</select></div><div class="row" style="flex-wrap:wrap;gap:4px">`;
      for (const k of SCHEME_LIST) { const ok = canScheme(civ, G.ui.schemeTarget, k); h += `<button class="btn sm" ${ok.ok ? `data-action="scheme" data-k="${k}"` : 'disabled'} title="${E(`${SCHEMES[k].desc} ${SCHEMES[k].months} months, ${schemeCost(civ, k)} gold, ${Math.round(schemeOdds(civ, G.ui.schemeTarget, k) * 100)}% to stay hidden.${ok.ok ? '' : ' ' + ok.reason}`)}">${SCHEMES[k].icon} ${E(SCHEMES[k].name)}</button>`; }
      h += '</div>';
    }
  }
  h += '<h3>Lifestyle</h3><div class="lifestyles">';
  for (const k of LIFESTYLE_LIST) {
    const L = LIFESTYLES[k];
    h += `<button class="ls ${r.lifestyle === k ? 'on' : ''}" data-action="lifestyle" data-ls="${k}" title="${E(L.name + ': ' + L.desc + ' Perks: ' + L.perks.map((t) => TRAITS[t].name).join(', '))}"><span class="lsi">${L.icon}</span>${L.name}</button>`;
  }
  h += '</div>';
  if (ls) h += `<div class="row" style="gap:6px;margin-top:4px"><span class="small muted">${ls.name} mastery</span><div class="bar" style="flex:1"><i style="width:${Math.min(100, r.xp || 0)}%"></i></div><span class="small">${Math.round(r.xp || 0)}/100</span></div><div class="small muted">Next: +1 ${STAT_NAMES[ls.stat]}${ls.perks.find((t) => !r.traits.includes(t)) ? ` and the trait ${TRAITS[ls.perks.find((t) => !r.traits.includes(t))].name}` : ''}.</div>`;
  else h += '<div class="small muted">Choose a lifestyle: your ruler gains experience every year and, at 100, a new trait and +1 skill.</div>';
  // Phase 17: heroes & legends
  { const hs = civ.heroes || []; const live = hs.filter((x) => x.alive), dead = hs.filter((x) => !x.alive).slice(-4).reverse();
    h += '<h3>Heroes & Legends</h3>';
    if (!hs.length) h += '<div class="small muted">No heroes have risen yet. Stable, advanced realms — and brave deeds in hard times — give birth to legends.</div>';
    for (const x of live) { const K = HERO_KINDS[x.kind]; h += `<div class="card small"><b>${K.icon} ${E(x.name)} ${E(x.epithet)}</b> — ${K.name}, age ${Math.floor((st.day - x.born) / 360) + 20}<div class="muted">${Object.entries(K.fx).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.abs(v) < 1 ? Math.round(v * 100) + '%' : v} ${k}`).join(', ')}</div>${x.deeds.length ? `<div>${x.deeds.map((d) => '• ' + E(d)).join('<br>')}</div>` : ''}</div>`; }
    for (const x of dead) h += `<div class="small muted">† ${HERO_KINDS[x.kind].icon} ${E(x.name)} ${E(x.epithet)} — remembered${x.deeds[0] ? ' for ' + E(x.deeds[0]) : ''}</div>`;
  }
  // Spouse
  h += '<h3>Consort</h3>';
  if (r.spouse) {
    const from = r.spouse.from >= 0 ? st.civs[r.spouse.from] : null;
    h += personCard(r.spouse, r.spouse.race || civ.race, { sub: `Age ${r.spouse.age} · House ${E(r.spouse.dynasty)}${from ? ` · from ${E(from.displayName)}` : ' · a noble of the realm'}` });
  } else h += `<div class="card small">${g.succession === 'heir' ? 'Unmarried. Without a consort few children are born. Propose a royal marriage from the <b>Diplomacy</b> panel to bind another realm to yours — your children will hold a claim on their throne.' : 'Rulers here are not of a royal house.'}</div>`;
  // Children
  if (g.succession === 'heir') {
    const heir = heirOf(civ);
    h += '<h3>Children</h3>';
    if (!civ.family.length) h += '<div class="card small bad">No children — the house is at risk. Without an heir another house takes the throne (or a claimant realm inherits it).</div>';
    for (const c of [...civ.family].sort((a, b) => b.age - a.age)) {
      const claim = c.claim >= 0 && st.civs[c.claim]?.alive ? `<span class="tag gold" title="Through their other parent">Claim: ${E(st.civs[c.claim].baseName)}</span>` : '';
      const edu = c.age < 16 ? `<div class="row" style="gap:3px;margin-top:3px">${['martial', 'scholar', 'diplomat', 'steward'].map((f) => `<button class="btn sm ${c.edu === f ? 'primary' : ''}" data-action="educateChild" data-id="${c.id}" data-focus="${f}">${f}</button>`).join('')}</div>` : '';
      h += personCard(c, civ.race, { sub: `${c.gender === 'f' ? 'Daughter' : 'Son'}, age ${c.age}${c.edu ? ` · ${c.edu} education` : ''}`, tag: c === heir ? '<span class="tag gold">Heir</span>' : '', extra: claim + edu, stats: c.age >= 16 });
    }
    h += `<div class="small muted">Succession: <b>${SUCCESSION_LAWS[civ.law || 'primogeniture']?.name}</b> (change it in Government).${civ.law === 'partition' ? ' On your death, younger adult children will receive part of the realm.' : ''}</div>`;
  }
  // Courtiers
  h += `<h3>Courtiers</h3><div class="small muted" style="margin-bottom:4px">Nobles of the realm. Their mood adds ${fmtSigned(courtStability(civ))} stability. Disloyal, ambitious courtiers may plot against you.</div>`;
  for (const c of civ.court) {
    const op = courtierOpinion(civ, c);
    const tip = `Opinion target ${Math.round(op.target)}:\n` + op.items.map(([k, v]) => `${k}: ${fmtSigned(v)}`).join('\n');
    const plotting = st.plots.some((p) => p.plotter === c.id && p.discovered);
    const opBar = `<div class="row" style="gap:6px" title="${E(tip)}"><span class="small muted">Opinion</span><div class="bar op" style="flex:1"><i style="width:${(c.opinion + 100) / 2}%;background:${c.opinion > 20 ? 'var(--good)' : c.opinion < -20 ? 'var(--bad)' : 'var(--gold)'}"></i></div><b class="small">${Math.round(c.opinion)}</b></div>`;
    const acts = `<div class="row" style="gap:3px;margin-top:3px"><button class="btn sm" data-action="giftCourtier" data-id="${c.id}">Gift ${30 + 10 * (civ.era || 0)} ${iconImg('gold', 'ico sm')}</button><button class="btn sm" data-action="banishCourtier" data-id="${c.id}" title="Removes them from court. Others resent it (−6 opinion, −2 stability).">Banish</button></div>`;
    h += personCard(c, c.race || civ.race, { title: `${c.title} ${c.name}`, sub: `Age ${c.age} · House ${E(c.dynasty)}${c.ambition > 0.7 ? ' · ambitious' : ''}`, tag: plotting ? '<span class="tag bad">Plotting!</span>' : '', extra: opBar + acts, cls: 'courtier' });
  }
  // Plots
  const against = st.plots.filter((p) => p.target === civ.id && p.discovered);
  const ours = st.plots.filter((p) => p.owner === civ.id);
  h += '<h3>Intrigue</h3>';
  if (!against.length && !ours.length) h += '<div class="small muted">No known plots. Your spymaster is your ruler\'s Intrigue skill; Paranoid rulers are hard to kill.</div>';
  for (const p of against) {
    const c = civ.court.find((x) => x.id === p.plotter);
    h += `<div class="card plot bad"><div class="row between"><b>🗡 ${c ? `${E(c.title)} ${E(c.name)}` : E(st.civs[p.owner]?.displayName || 'Unknown')} plots to murder ${p.who === 'heir' ? 'the heir' : 'you'}</b><button class="btn sm" data-action="exposePlot" data-id="${p.id}">Expose</button></div><div class="bar movement"><i style="width:${Math.min(100, p.progress)}%"></i></div></div>`;
  }
  for (const p of ours) {
    const T = st.civs[p.target];
    h += `<div class="card plot"><div class="row between"><b>🗡 Plot against the ${p.who} of ${E(T.displayName)}</b><button class="btn sm" data-action="cancelPlot" data-id="${p.id}">Abandon</button></div><div class="bar"><i style="width:${Math.min(100, p.progress)}%"></i></div><div class="small muted">Success chance ≈ ${Math.round(successChance(p) * 100)}%</div></div>`;
  }
  // Dynasty
  h += `<h3>House ${E(r.dynasty)}</h3>`;
  const realms = dynastyRealms(r.dynasty);
  h += `<div class="small">Rules ${realms.length} realm${realms.length === 1 ? '' : 's'}: ${realms.map((c) => `<span style="color:${c.color}">${E(c.displayName)}</span>`).join(', ')}</div>`;
  const claims = claimsOf(civ);
  if (claims.length) h += `<div class="small">Claims: ${claims.map((id) => `<span class="tag gold">${E(st.civs[id].displayName)}</span>`).join('')} — press them with a <b>Demand: our claim</b> in Diplomacy, or inherit if their house dies out.</div>`;
  if (civ.rulers?.length) h += '<div class="small muted" style="margin-top:4px">Past rulers: ' + civ.rulers.slice(-6).reverse().map((x) => `${E(x.name)} (${x.cause})`).join(' · ') + '</div>';
  h += '</div>';
  return h;
}

// ---------------- Politics (Phase 10) ----------------
function politics(civ) {
  const ui = G.ui;
  let h = head('Politics');
  h += '<div class="panel-body">';
  const gs = groupsStability(civ);
  const aw = awareness(civ);
  h += `<div class="grid2">${stat('Interest groups → stability', fmtSigned(gs), signCls(gs))}${stat('Political awareness', Math.round(aw * 100) + '%')}</div>`;
  h += '<div class="small muted" style="margin:4px 0 8px">Groups gain clout from their members\' numbers and wealth. They like or dislike laws; angry, powerful groups build movements that can force a law on you or start a revolution. Awareness (era, schools, government) decides how much laws matter to them.</div>';
  // Law being debated
  if (civ.enact) {
    const L = LAWS[civ.enact.law];
    const sup = supportFor(civ, civ.enact.law);
    const months = enactMonths(civ);
    h += `<div class="card enact"><div class="row between"><b>Debating: ${E(L.name)}</b><button class="btn sm" data-action="cancelEnact">Abandon</button></div>
      <div class="bar" style="margin:6px 0"><i style="width:${Math.min(100, civ.enact.progress)}%"></i></div>
      <div class="row between small"><span>Support <b class="${sup > 0.1 ? 'good' : sup < -0.1 ? 'bad' : ''}">${Math.round(sup * 100)}%</b></span><span class="muted">≈ ${months} month${months === 1 ? '' : 's'} left</span></div>
      <div class="small muted">Low support makes debate slow and can set it back.</div></div>`;
  }
  // Interest groups
  h += '<h3>Interest groups</h3><div class="igroups">';
  for (const g of [...GROUP_LIST].sort((a, b) => (civ.groups[b]?.clout || 0) - (civ.groups[a]?.clout || 0))) {
    const grp = civ.groups[g] || { clout: 0, approval: 0, movement: 0 };
    const G_ = GROUPS[g];
    const [mood, cls] = MOOD(grp.approval);
    const bd = approvalBreakdown(civ, g);
    const tip = `${G_.desc}\n\nApproval target ${fmtSigned(bd.target)}:\n` + bd.items.map(([k, v]) => `${k}: ${fmtSigned(v)}`).join('\n');
    const demand = grp.movement > 0 ? movementDemand(civ, g) : null;
    h += `<div class="igroup ${grp.clout < 0.02 ? 'weak' : ''}" title="${E(tip)}">
      <div class="ig-icon" style="background:${G_.color}">${G_.icon}</div>
      <div class="ig-main"><div class="row between"><b>${E(G_.name)}</b><span class="tag ${cls}">${mood} ${fmtSigned(grp.approval)}</span></div>
      <div class="row" style="gap:6px"><div class="bar" style="flex:1"><i style="width:${Math.round(grp.clout * 100)}%;background:${G_.color}"></i></div><span class="small" style="width:34px;text-align:right">${Math.round(grp.clout * 100)}%</span></div>
      ${grp.clout >= 0.02 ? `<div class="row" style="gap:4px;margin-top:2px"><button class="btn sm" data-action="bribeGroup" data-g="${g}" ${civ.treasury >= bribeCost(civ, g) && !((grp.bribeUntil || 0) > S().day) ? '' : 'disabled'} title="Buy their goodwill: +4 approval for 3 years.">💰 Bribe (${fmt(bribeCost(civ, g))})</button>${(grp.bribeUntil || 0) > S().day ? '<span class="small muted">bought until ' + shortDate(grp.bribeUntil) + '</span>' : ''}</div>` : ''}
      ${grp.movement > 0 ? `<div class="small bad">Movement ${Math.round(grp.movement)}% — demands ${E(demand ? LAWS[demand].name : '—')}</div><div class="bar movement"><i style="width:${grp.movement}%"></i></div>` : ''}</div></div>`;
  }
  h += '</div>';
  // Laws
  h += '<h3>Laws</h3>';
  for (const c of CAT_LIST) {
    const cur = civ.laws[c];
    h += `<div class="lawcat"><div class="lc-name">${LAW_CATS[c].icon} ${LAW_CATS[c].name}</div><div class="lc-laws">`;
    for (const id of lawsIn(c)) {
      const L = LAWS[id];
      const on = id === cur;
      const av = lawAvailable(civ, id);
      const debating = civ.enact?.law === id;
      let sub = '';
      if (on) sub = '<span class="good">In force</span>';
      else if (!av.ok) sub = `<span class="muted">Needs ${E(TECH[L.tech]?.name || L.tech)}</span>`;
      else {
        const sp = supportFor(civ, id);
        sub = `<span class="${sp > 0.1 ? 'good' : sp < -0.1 ? 'bad' : 'muted'}">Support ${Math.round(sp * 100)}%</span>`;
      }
      const { pro, con } = supporters(civ, id);
      const fx = [...Object.entries(L.fx || {}).map(([k, v]) => `${k} ${Math.abs(v) < 1 ? fmtSigned(Math.round(v * 100)) + '%' : fmtSigned(v)}`), ...lawHookText(L)].join(', ');
      const tip = `${L.name}: ${L.desc}${fx ? `\nEffects: ${fx}` : ''}${pro.length ? `\nFor: ${pro.map((g) => GROUPS[g].name).join(', ')}` : ''}${con.length ? `\nAgainst: ${con.map((g) => GROUPS[g].name).join(', ')}` : ''}`;
      const canClick = !on && av.ok && !civ.enact;
      h += `<button class="law ${on ? 'on' : ''} ${debating ? 'debating' : ''} ${!av.ok ? 'locked' : ''}" ${canClick ? `data-action="enactLaw" data-law="${id}"` : 'disabled'} title="${E(tip)}">
        <div class="ln">${E(L.name)}</div><div class="small">${debating ? '<span class="gold">Debating…</span>' : sub}</div>
        <div class="lg">${pro.map((g) => `<i style="background:${GROUPS[g].color}" title="${GROUPS[g].name} support">${GROUPS[g].icon}</i>`).join('')}${con.length ? '<span class="vs">✕</span>' : ''}${con.map((g) => `<i class="con" style="background:${GROUPS[g].color}" title="${GROUPS[g].name} oppose">${GROUPS[g].icon}</i>`).join('')}</div></button>`;
    }
    h += '</div></div>';
  }
  h += '</div>';
  return h;
}
function lawHookText(L) {
  const k = L.hooks || {};
  const out = [];
  if (k.ownerShare != null && L.cat === 'land') out.push(`owners take ${Math.round(k.ownerShare * 100)}% of profits`);
  if (k.ownerShare && L.cat === 'labor') out.push(`owners' share ${fmtSigned(Math.round(k.ownerShare * 100))}%`);
  if (k.mobility != null && k.mobility !== 1) out.push(`peasants change jobs ${k.mobility > 1 ? 'faster' : 'slower'}`);
  if (k.trade != null && k.trade !== 1) out.push(`trade ×${k.trade}`);
  if (k.markup) out.push(`imports at ${k.markup}× price`);
  if (k.recruit && k.recruit !== 1) out.push(`recruiting ×${k.recruit}`);
  if (k.upkeep && k.upkeep !== 1) out.push(`army upkeep ×${k.upkeep}`);
  if (k.welfare) out.push(`costs ${k.welfare} gold / 100 people / month`);
  if (k.school) out.push(`costs ${k.school} gold / 100 people / month`);
  if (k.poorSol) out.push(`+${k.poorSol} living standard for the poor`);
  return out;
}

// ---------------- Charts ----------------
export const METRICS = [
  ['score', 'Score', 8, fmt], ['pop', 'Population', 1, fmt], ['gold', 'Treasury', 2, fmt], ['sol', 'Living standard', 3, (v) => v.toFixed(1)],
  ['stab', 'Stability', 4, (v) => Math.round(v)], ['know', 'Knowledge / month', 5, (v) => v.toFixed(0)], ['army', 'Regiments', 6, (v) => v.toFixed(0)], ['tech', 'Technologies', 7, (v) => v],
];
// Simple SVG line chart. series: [{ name, color, pts: [[x, y]], bold }]
export function lineChart(series, { w = 520, h = 170, fmtY = fmt, title = '' } = {}) {
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return '<div class="muted small" style="padding:10px 0">Not enough history yet — trends are recorded every year.</div>';
  const pad = { l: 44, r: 10, t: 14, b: 18 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (y0 > 0 && y0 < y1 * 0.5) y0 = 0;
  if (y1 === y0) { y1 += 1; y0 -= y0 > 0 ? 1 : 0; }
  if (x1 === x0) x1 += 1;
  const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const Y = (y) => h - pad.b - ((y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = y0 + ((y1 - y0) * k) / 4, yy = Y(v);
    g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}" class="ch-grid"/><text x="${pad.l - 5}" y="${yy + 3}" class="ch-ax" text-anchor="end">${E(String(fmtY(v)))}</text>`;
  }
  for (let k = 0; k <= 4; k++) { const v = Math.round(x0 + ((x1 - x0) * k) / 4); g += `<text x="${X(v)}" y="${h - 4}" class="ch-ax" text-anchor="middle">Y${v + 1}</text>`; }
  let lines = '';
  for (const s of [...series].sort((a, b) => (a.bold ? 1 : 0) - (b.bold ? 1 : 0))) {
    if (s.pts.length < 2) continue;
    const d = s.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
    const last = s.pts[s.pts.length - 1];
    lines += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.bold ? 2.6 : 1.4}" stroke-linejoin="round" opacity="${s.bold ? 1 : 0.8}"><title>${E(s.name)}</title></path>`;
    lines += `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="${s.bold ? 3.2 : 2.2}" fill="${s.color}"><title>${E(s.name)}: ${E(String(fmtY(last[1])))} (year ${last[0] + 1})</title></circle>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none">${title ? `<text x="${pad.l}" y="10" class="ch-title">${E(title)}</text>` : ''}${g}${lines}</svg>`;
}
function sparkline(pts, color, w = 120, h = 30) {
  if (pts.length < 2) return '<span class="muted small">—</span>';
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (y1 === y0) y1 += 1;
  const X = (i) => (i / (pts.length - 1)) * (w - 4) + 2, Y = (y) => h - 3 - ((y - y0) / (y1 - y0)) * (h - 6);
  const d = pts.map(([, y], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/><path d="${d}L${w - 2},${h}L2,${h}Z" fill="${color}" opacity=".12"/></svg>`;
}
function trendsView(civ) {
  const st = S();
  const ui = G.ui;
  ui.trend ??= 'pop';
  const hist = civ.hist || [];
  let h = '<h3>My realm</h3><div class="spark-grid">';
  for (const [k, label, idx, f] of METRICS) {
    const pts = hist.map((r) => [r[0], r[idx]]);
    const last = pts.length ? pts[pts.length - 1][1] : null;
    const prev = pts.length > 10 ? pts[pts.length - 11][1] : pts[0]?.[1];
    const ch = last != null && prev != null ? last - prev : 0;
    h += `<div class="spark-card ${ui.trend === k ? 'on' : ''}" data-action="trendMetric" data-k="${k}"><div class="small muted">${label}</div><div class="row between"><b>${last != null ? f(last) : '—'}</b><small class="${ch > 0 ? 'good' : ch < 0 ? 'bad' : 'muted'}">${pts.length > 1 ? (ch > 0 ? '▲' : ch < 0 ? '▼' : '•') + ' 10y' : ''}</small></div>${sparkline(pts, 'var(--gold)')}</div>`;
  }
  h += '</div>';
  const [, label, idx, f] = METRICS.find((m) => m[0] === ui.trend);
  // Compare: the player's realm and the 7 largest on this metric
  const alive = st.civs.filter((c) => c.hist?.length);
  const lastOf = (c) => c.hist[c.hist.length - 1][idx];
  const top = alive.filter((c) => c.alive && c.id !== civ.id).sort((a, b) => lastOf(b) - lastOf(a)).slice(0, 7);
  const series = [civ, ...top].filter((c) => c.hist?.length).map((c) => ({ name: c.displayName, color: c.color, bold: c.id === civ.id, pts: c.hist.map((r) => [r[0], r[idx]]) }));
  h += `<h3>${label} — compared</h3>` + lineChart(series, { fmtY: f });
  h += '<div class="legend">' + series.map((s) => `<span><i style="background:${s.color}"></i>${E(s.name)}</span>`).join('') + '</div>';
  return h;
}

// Phase 21: missions (goals that fit the moment) and decisions (big one-time choices)
function missions(civ) {
  const st = S();
  G.ui.seenMissions = true;
  let h = head('Missions');
  h += '<div class="panel-body">';
  h += '<h3>Current missions</h3><div class="small muted" style="margin-bottom:6px">Goals that fit your realm right now. Complete one and a new one takes its place.</div>';
  const m = civ.missions || { active: [], done: [] };
  if (!m.active.length) h += '<div class="small muted">New missions arrive at the start of each month.</div>';
  for (const id of m.active) {
    const M = MISSIONS[id]; const [cur, goal] = M.check(civ);
    const rw = Object.entries(M.reward).map(([k, v]) => ({ gold: `gold (${v} months of income)`, stab: `+${v} stability`, know: 'research', admin: `+${v} administration` }[k])).join(', ');
    h += `<div class="card"><div class="row between"><b>${M.icon} ${E(M.name)}</b><span class="small">${fmt(cur)} / ${fmt(goal)}</span></div><div class="small muted">${E(M.desc)} Reward: ${E(rw)}.</div><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, (cur / goal) * 100)}%"></i></div></div>`;
  }
  if (m.done.length) h += `<div class="small muted" style="margin-top:6px">Completed: ${m.done.map((id) => E(MISSIONS[id].name)).join(' · ')}</div>`;
  h += '<h3>Decisions</h3><div class="small muted" style="margin-bottom:6px">Great choices that can each be made once, when the realm is ready.</div>';
  for (const id of DECISION_LIST) {
    const D = DECISIONS[id]; const ok = canTakeDecision(civ, id); const done = (civ.decisions || []).includes(id);
    h += `<div class="card"><div class="row between"><b>${D.icon} ${E(D.name)}</b>${done ? '<span class="tag good">Done</span>' : `<button class="btn sm ${ok.ok ? 'primary' : ''}" ${ok.ok ? `data-action="decision" data-id="${id}"` : 'disabled'} title="${E(ok.reason || '')}">Decide · ${fmt(decisionCost(civ, id))} gold</button>`}</div><div class="small muted">${E(D.desc)} Effect: ${E(D.fx)}. Needs ${E(D.need)}.</div></div>`;
  }
  h += '</div>';
  void st;
  return h;
}

export const PANELS = { overview, economy, diplomacy, military, government, court, politics, technology, construction, population, ledger, missions };
export const PANEL_ORDER = [
  ['overview', 'Overview', 'stability', 'V'],
  ['economy', 'Economy', 'gold', 'E'],
  ['diplomacy', 'Diplomacy', 'stability', 'R'],
  ['military', 'Military', 'defense', 'M'],
  ['government', 'Government', 'stability', 'G'],
  ['court', 'Court', 'stability', 'K'],
  ['politics', 'Politics', 'pop', 'O'],
  ['technology', 'Technology', 'knowledge', 'T'],
  ['construction', 'Construction', 'housing', 'C'],
  ['population', 'Population', 'pop', 'P'],
  ['missions', 'Missions', 'knowledge', 'U'],
  ['ledger', 'Ledger', 'knowledge', 'L'],
];
void dateStr;
