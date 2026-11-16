// The Living World palette: one shared set of colour ramps (darkest first) for all Aseprite art.
// Shadows lean toward violet, lights toward warm yellow, so every material sits in one warm, cosy
// world. `node scripts/art/build.mjs --palette` writes it to art/palette.gpl for Aseprite.
export const INK = '#241a24'; // the outline around every sprite
export const RAMPS = {
  ink: ['#120c14', '#241a24', '#3a2c38'],
  // skin, one ramp per race
  skinHuman: ['#7a4436', '#b8714f', '#e2a47a', '#f5cda2'],
  skinElf: ['#8e6458', '#cf9c80', '#efc8aa', '#fbe5cf'],
  skinDwarf: ['#6e3a2e', '#a86048', '#d48c66', '#ecb48a'],
  skinOrc: ['#283f2a', '#47703a', '#73a04a', '#a6c96c'],
  skinLizard: ['#183f42', '#28705e', '#45a06c', '#86cc84'],
  skinHalfling: ['#84483a', '#c27a58', '#eaae84', '#f9d6ae'],
  // hair
  hairBrown: ['#2c1a1c', '#4f3024', '#7a4a30', '#a06a40'],
  hairBlond: ['#8a5a2c', '#c08c3c', '#e2bc58', '#f6e090'],
  hairSilver: ['#5a5c72', '#8e94ac', '#c4cadc', '#eef0f6'],
  hairBlack: ['#141018', '#28202e', '#3e3446', '#5a4e62'],
  hairGinger: ['#5e2418', '#9a3e22', '#cc6430', '#ec9a50'],
  // cloth and materials
  red: ['#4a1624', '#862a32', '#c4423c', '#ec7656'],
  blue: ['#1a2248', '#2c4482', '#4672b8', '#80acde'],
  teal: ['#163a40', '#22665e', '#3a9a84', '#78ccaa'],
  green: ['#1a3424', '#2a5e34', '#48903e', '#88c45a'],
  leaf: ['#173326', '#235334', '#357a3c', '#5aa244', '#94cc5c'],
  brown: ['#2e1c16', '#56351f', '#84562e', '#b28048'],
  ochre: ['#5c3c1c', '#9c6a26', '#d4a23c', '#f0d070'],
  gold: ['#6a3e16', '#b0742a', '#e8b440', '#fbe484'],
  purple: ['#2a1a44', '#4c2c74', '#7446a4', '#a678d2'],
  pink: ['#6a2a46', '#ae4a6a', '#e07c8a', '#f8b4b0'],
  cream: ['#8a7a6e', '#bcae9a', '#e2d8c2', '#fbf6e8'],
  white: ['#7c7c96', '#b4b6c8', '#e2e2ec', '#ffffff'],
  steel: ['#2e3240', '#525a6e', '#848ea4', '#c2cad8', '#eef2f6'],
  stone: ['#3a3640', '#5e5a62', '#8a8488', '#b6b0aa', '#dcd6cc'],
  wood: ['#3a2216', '#62391f', '#8e5a2e', '#b88246'],
  straw: ['#7a5a22', '#b48a34', '#dcbc5a', '#f4e08e'],
  soil: ['#3a2618', '#5e3e26', '#86603c', '#ac8656'],
  water: ['#1c2a5a', '#284a8a', '#3a76b4', '#5aa6d4', '#a0dcec'],
  fire: ['#7a1c18', '#c4401c', '#f08a24', '#fcd25a', '#fff6c0'],
};

// convenience: R.blue[2] etc, plus lookups by race
export const R = RAMPS;
export const SKIN = { humans: R.skinHuman, elves: R.skinElf, dwarves: R.skinDwarf, orcs: R.skinOrc, lizardfolk: R.skinLizard, halflings: R.skinHalfling };

export function gpl() {
  const lines = ['GIMP Palette', 'Name: Living World', 'Columns: 8', '#'];
  for (const [name, ramp] of Object.entries(RAMPS)) ramp.forEach((h, i) => {
    const n = parseInt(h.slice(1), 16);
    lines.push(`${String((n >> 16) & 255).padStart(3)} ${String((n >> 8) & 255).padStart(3)} ${String(n & 255).padStart(3)}\t${name} ${i + 1}`);
  });
  return lines.join('\n') + '\n';
}
