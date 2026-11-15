// Phase 14 — difficulty levels: bonuses for the player or the AI, and default disaster rates.
export const DIFFICULTY = {
  easy: { name: 'Easy', desc: 'Forgiving: +20% taxes and building speed, +6 stability, +10% growth for you; AI realms a little weaker; rare disasters.', player: { tax: 0.2, build: 0.2, stability: 6, growth: 0.1 }, ai: { tax: -0.1, build: -0.1 }, disasters: 'rare' },
  normal: { name: 'Normal', desc: 'The intended balance.', player: {}, ai: {}, disasters: 'normal' },
  hard: { name: 'Hard', desc: 'Unforgiving: AI realms +20% taxes, building and growth, +5 stability; you get −5 stability; frequent disasters.', player: { stability: -5 }, ai: { tax: 0.2, build: 0.2, growth: 0.12, stability: 5, defense: 8 }, disasters: 'frequent' },
};
