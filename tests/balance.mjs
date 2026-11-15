// Long-run balance check: node tests/balance.mjs [seed] [years] [race]
// Prints every 50 years: realms alive, towns per realm, eras, techs, wars, treasuries, inflation.
const root = new URL('../src/', import.meta.url).href;
const { G } = await import(root + 'sim/state.js');
const { newGame } = await import(root + 'sim/setup.js');
const { simDay } = await import(root + 'sim/sim.js');
const ev = await import(root + 'sim/events.js');
const { TECHS } = await import(root + 'data/techs.js');
const seed = +(process.argv[2] || 777), years = +(process.argv[3] || 250), race = process.argv[4] || 'humans';
newGame({ seed, size: 'medium', race, aiCount: 7 });
G.state.civs[0].autoBuild = true; G.state.civs[0].autoResearch = true;
let fell = 0;
const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  while (G.state.day < y * 360) { simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, G.state.day % 2); }
  if (!fell && !G.state.civs[0].alive) { fell = y; console.log('  player fell in year', y); }
  if (y % 50 === 0) {
    const st = G.state, al = st.civs.filter((c) => c.alive && c.settlements.length), ch = st.chronicle || [];
    const inWin = (e) => e.day > (y - 50) * 360;
    console.log(`y${y} alive ${al.length} | towns ${al.map((c) => c.race[0] + c.settlements.length).join(' ')} | eras ${al.map((c) => c.era).join('')} | techs max ${Math.max(...al.map((c) => c.techs.length))}/${TECHS.length}`);
    console.log(`     wars(50y) ${ch.filter((e) => inWin(e) && /WAR!/.test(e.text)).length} | gold k ${al.map((c) => Math.round(c.treasury / 1000)).join(',')} | infl ${al.map((c) => Math.round(c.inflation || 0)).join(',')} | works ${al.reduce((s, c) => s + (c.works || []).length, 0)} | ambitions ${al.filter((c) => c.ambition).length} | coalition ${st.coalition ? 'vs ' + st.civs[st.coalition.target].baseName : '-'}`);
  }
}
const ch = G.state.chronicle || [];
for (const e of ch.filter((e) => /GREAT|REVOLUTION|coalition|ambition|PESTILENCE|CRASH|SCHISM/i.test(e.text)).slice(-10)) console.log('   *', Math.floor(e.day / 360), e.text.slice(0, 150));
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(1));
