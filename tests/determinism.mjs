// Same seed, same world: node tests/determinism.mjs [years]
const root = new URL('../src/', import.meta.url).href;
const { G } = await import(root + 'sim/state.js');
const { newGame } = await import(root + 'sim/setup.js');
const { simDay } = await import(root + 'sim/sim.js');
const ev = await import(root + 'sim/events.js');
const years = +(process.argv[2] || 40);
function run() {
  newGame({ seed: 4242, size: 'medium', race: 'humans', aiCount: 7 });
  G.state.civs[0].autoBuild = true; G.state.civs[0].autoResearch = true;
  while (G.state.day < years * 360) { simDay(); for (const p of [...G.state.pendingEvents]) ev.resolveEvent(p.id, 0); }
  return JSON.stringify(G.state, (k, v) => (k.startsWith('_') ? undefined : v));
}
const a = run(), b = run();
console.log(a === b ? `determinism OK (${years} years, ${(a.length / 1e6).toFixed(2)} MB)` : 'DETERMINISM FAILED');
process.exit(a === b ? 0 : 1);
