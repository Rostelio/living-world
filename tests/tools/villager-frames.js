// Renders the code-drawn villager of one race, every role, into 16×16 frames (feet at the
// bottom centre) for a starter Aseprite file. Run in screenshot mode:
//   LW_RACE=humans LW_SHOT=<dir> LW_SHOT_SCRIPT=tests/tools/villager-frames.js npx electron .
const { tinyPerson } = await import('./src/render/sprites16.js');
const RACE = window.__race || 'humans';
// the same looks as ROLE_LOOK in src/render/people.js; guards take a neutral blue for the realm colour
const ROLES = {
  farmer: { body: '#8a6a3a', hat: '#d8c070', tool: 'hoe', carry: '#e8c860' },
  woodcutter: { body: '#6e4a2e', hat: null, tool: 'axe', carry: '#8a5a2e' },
  miner: { body: '#5c6670', hat: '#d0b040', tool: 'pick', carry: '#9a968e' },
  crafter: { body: '#4e6a8a', hat: null, tool: 'hammer', carry: '#c08a50' },
  merchant: { body: '#c89a28', hat: '#7a3a2a', tool: null, carry: '#e6c068' },
  priest: { body: '#e8e2f2', hat: null, tool: null, carry: null },
  guard: { body: '#3f6fb0', hat: '#9aa4ae', tool: 'spear', carry: null },
  noble: { body: '#7a3a8a', hat: '#e6c068', tool: null, carry: null },
  child: { body: '#b86a4a', hat: null, tool: null, carry: null, small: true },
  hauler: { body: '#7a6a5a', hat: null, tool: null, carry: '#a07848' },
};
const files = [], tags = [];
let n = 0;
for (const [role, L] of Object.entries(ROLES)) {
  const start = n;
  for (let f = 0; f < 7; f++) {
    const working = f >= 4 && f <= 5;
    const look = { body: L.body, hat: L.hat, small: L.small, tool: working || role === 'guard' ? L.tool : null, carry: role === 'hauler' && f < 4 ? L.carry : null };
    const spr = tinyPerson(RACE, look, f, 1);
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(spr, 5, 7); // 7×9 figure, feet on the bottom row, centred on x = 8
    files.push({ name: `f${n}.png`, data: c.toDataURL('image/png') });
    n++;
  }
  tags.push([`${role}_walk`, start, start + 3, 125], [`${role}_work`, start + 4, start + 5, 200], [`${role}_idle`, start + 6, start + 6, 500]);
}
files.push({ name: 'tags.txt', data: tags.map((t) => t.join(' ')).join('\n') + '\n' });
window.__files = files;
window.__shots = [];
