import { ensureMonsters } from './monsters.js';
import { ensureReligion } from './religion.js';
import { ensurePhase21 } from './depth.js';
import { ensurePhase19 } from './latebalance.js';
// Phase 12 state: treasury (loans, monuments, mercenaries) and the fog of war.
import { ensurePhase12Treasury } from './treasury.js';
import { ensureFog } from './fog.js';
import { ensurePhase14Markets } from './markets.js';
import { ensurePhase17Memory } from './memory.js';
import { ensurePhase17Stories } from './stories.js';

export function ensurePhase12(st, opts = null) {
  ensurePhase12Treasury(st);
  ensureFog(st, opts ? (opts.fog ?? !opts.sandbox) : null);
  ensurePhase14Markets(st);
  ensurePhase17Memory(st);
  ensurePhase17Stories(st);
  ensurePhase19(st);
  ensurePhase21(st);
  ensureReligion(st);
  ensureMonsters(st);
  st.version = Math.max(st.version || 0, 14);
}
