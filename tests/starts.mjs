// Early game: can every start grow into a village? node tests/starts.mjs
const root = new URL('../src/', import.meta.url).href;
const { G } = await import(root + 'sim/state.js');
const { newGame } = await import(root + 'sim/setup.js');
const { simDay } = await import(root + 'sim/sim.js');
const SM = await import(root + 'sim/settlements.js');
const ev = await import(root + 'sim/events.js');
let stuck = 0, n = 0, events = 0;
for (const race of ['humans', 'elves', 'dwarves', 'orcs', 'halflings', 'lizardfolk']) {
  const row = [];
  for (let seed = 1; seed <= 8; seed++) {
    newGame({ seed: seed * 101, size: 'medium', race, aiCount: 7 });
    const me = G.state.civs[0]; me.autoBuild = true; me.autoResearch = true;
    const s = G.state.settlements[me.settlements[0]];
    while (G.state.day < 8 * 360) { simDay(); for (const p of [...G.state.pendingEvents]) { events++; ev.resolveEvent(p.id, 0); } }
    n++; if (s.stage < 1) stuck++;
    row.push(`${Math.round(s.pop)}p/st${s.stage}/${Math.round(me.stock.wood)}w`);
  }
  console.log(race.padEnd(10), row.join(' '));
}
console.log(`${n - stuck}/${n} starts became villages within 8 years; player events ${(events / n / 8).toFixed(2)} per year`);
