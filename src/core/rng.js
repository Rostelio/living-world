// Deterministic seeded RNG (mulberry32). All simulation randomness goes through
// an RNG instance so a game can be replayed / saved / (later) run in lockstep multiplayer.
export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  weighted(items, wf) {
    let tot = 0;
    for (const it of items) tot += Math.max(0, wf(it));
    if (tot <= 0) return null;
    let r = this.next() * tot;
    for (const it of items) {
      r -= Math.max(0, wf(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stateless hash -> [0,1). Used for cosmetic per-tile / per-pixel variation.
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
