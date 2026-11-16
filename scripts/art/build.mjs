// Builds the game's Aseprite art from the generators in scripts/art: each id becomes
// art/<id>.aseprite (frames + tags, editable by hand afterwards) and is then exported to
// assets/sprites/<id>.png/.json with `npm run sprites`.
//   node scripts/art/build.mjs townsfolk_humans townsfolk_elves   build these ids
//   node scripts/art/build.mjs townsfolk_*                        every id starting with townsfolk_
//   node scripts/art/build.mjs --preview <ids>                    only write enlarged previews to art/previews
//   node scripts/art/build.mjs --palette                          write art/palette.gpl
// Hand edits: once an .aseprite file has been edited in Aseprite, add its id to art/hand-edited.txt
// and this script will never overwrite it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contactSheet } from './pix.mjs';
import { gpl } from './palette.mjs';
import { GENERATORS } from './registry.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = path.join(ROOT, 'art');
const args = process.argv.slice(2);
const previewOnly = args.includes('--preview');

if (args.includes('--palette')) { fs.writeFileSync(path.join(ART, 'palette.gpl'), gpl()); console.log('wrote art/palette.gpl'); }

const all = Object.keys(GENERATORS);
const wanted = args.filter((a) => !a.startsWith('--')).flatMap((a) => (a.endsWith('*') ? all.filter((id) => id.startsWith(a.slice(0, -1))) : [a]));
const unknown = wanted.filter((id) => !GENERATORS[id]);
if (unknown.length) { console.error('No generator for: ' + unknown.join(', ')); process.exit(1); }
if (!wanted.length) { if (!args.includes('--palette')) console.log('Ids with a generator:\n  ' + all.join('\n  ')); process.exit(0); }

const handFile = path.join(ART, 'hand-edited.txt');
const hand = new Set(fs.existsSync(handFile) ? fs.readFileSync(handFile, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : []);

// Aseprite: same lookup as scripts/export-sprites.mjs
function aseprite() {
  const envFile = path.join(ROOT, '.env');
  if (!process.env.ASEPRITE_PATH && fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^\s*ASEPRITE_PATH\s*=\s*(.*?)\s*$/m);
    if (m) process.env.ASEPRITE_PATH = m[1].replace(/^["']|["']$/g, '');
  }
  const guesses = [process.env.ASEPRITE_PATH, '/Applications/Aseprite.app/Contents/MacOS/aseprite', 'C:\\Program Files\\Aseprite\\aseprite.exe'];
  const g = guesses.find((x) => x && fs.existsSync(x));
  if (!g) { console.error('Aseprite not found: set ASEPRITE_PATH in .env'); process.exit(1); }
  return g;
}

fs.mkdirSync(path.join(ART, 'previews'), { recursive: true });
const built = [];
for (const id of wanted) {
  const { frames, tags, layer = 'art', cols } = GENERATORS[id]();
  contactSheet(frames, { cols: cols || Math.min(frames.length, 14), scale: frames[0].w > 48 ? 3 : 5 }).save(path.join(ART, 'previews', id + '.png'));
  if (previewOnly) { console.log(`preview art/previews/${id}.png (${frames.length} frames)`); continue; }
  if (hand.has(id)) { console.log(`skip ${id}: listed in art/hand-edited.txt`); continue; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-art-'));
  frames.forEach((f, i) => f.save(path.join(dir, `f${i}.png`)));
  fs.writeFileSync(path.join(dir, 'tags.txt'), tags.map((t) => t.join(' ')).join('\n') + '\n');
  execFileSync(aseprite(), ['-b', '--script-param', `dir=${dir}`, '--script-param', `out=${path.join(ART, id + '.aseprite')}`, '--script-param', `layer=${layer}`, '--script', path.join(ROOT, 'scripts', 'art', 'build-aseprite.lua')], { stdio: 'pipe' });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`built art/${id}.aseprite (${frames.length} frames, ${tags.length} tags)`);
  built.push(id);
}
if (built.length) execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(ROOT, 'scripts', 'export-sprites.mjs'), ...built], { stdio: 'inherit' });
