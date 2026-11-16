// npm run sprites — exports every art/<id>.aseprite to assets/sprites/<id>.png + <id>.json
// (json-array, by rows, with tags, no trim) and checks each export against the canvas and tag
// table in assets/ASSETS.md. It only reports problems; it never changes the art.
//   ASEPRITE_PATH  path to the Aseprite program (from the environment or a .env file)
//   npm run sprites -- hero        export and check only art/hero.aseprite
//   npm run sprites -- --check     check the existing exports without running Aseprite
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SPRITE_IDS } from '../src/sprite-config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'art'), OUT = path.join(ROOT, 'assets', 'sprites');
const ROLES = ['farmer', 'woodcutter', 'miner', 'crafter', 'merchant', 'priest', 'guard', 'noble', 'child', 'hauler'];
const RACES = ['humans', 'elves', 'dwarves', 'orcs', 'lizardfolk', 'halflings'];
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));

// ---- .env (KEY=value lines; real environment variables win) ----
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---- the canvas / tag table from ASSETS.md ----
function readSpecs() {
  const md = fs.readFileSync(path.join(ROOT, 'assets', 'ASSETS.md'), 'utf8');
  const block = md.split('<!-- sprite-specs: start -->')[1]?.split('<!-- sprite-specs: end -->')[0];
  if (!block) throw new Error('assets/ASSETS.md has no sprite-specs table');
  const list = (cell) => cell.split(',').map((t) => t.trim()).filter(Boolean);
  const specs = [];
  for (const line of block.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || cells[0] === 'id' || /^-+$/.test(cells[0])) continue;
    const size = cells[1].match(/(\d+)\s*[×x]\s*(\d+)/);
    specs.push({ ids: list(cells[0]), w: size ? +size[1] : null, h: size ? +size[2] : null, exact: /exact/.test(cells[1]), required: list(cells[2]), optional: list(cells[3]) });
  }
  return specs;
}
const matches = (pattern, id) => (pattern.endsWith('*') ? id.startsWith(pattern.slice(0, -1)) : pattern === id);
const expand = (tags) => tags.flatMap((t) => (t.includes('{role}') ? ROLES.map((r) => t.replace('{role}', r)) : t.includes('{race}') ? RACES.map((r) => t.replace('{race}', r)) : [t]));

// ---- check one exported sprite ----
function check(id, specs) {
  const problems = [], notes = [];
  const jsonFile = path.join(OUT, id + '.json'), pngFile = path.join(OUT, id + '.png');
  if (!fs.existsSync(jsonFile) || !fs.existsSync(pngFile)) return { problems: ['no export (assets/sprites/' + id + '.png/.json missing)'], notes };
  let data;
  try { data = JSON.parse(fs.readFileSync(jsonFile, 'utf8')); } catch (e) { return { problems: ['the JSON cannot be read: ' + e.message], notes }; }
  const frames = Array.isArray(data.frames) ? data.frames : null;
  if (!frames) problems.push('frames are not an array: export with --format json-array ("Array" in the dialog)');
  if (!frames?.length) return { problems: problems.concat('no frames'), notes };
  if (!SPRITE_IDS.includes(id)) problems.push('the game does not know this id (not in src/sprite-config.js / ASSETS.md) — check the file name');
  const sizes = new Set(frames.map((f) => `${f.sourceSize?.w ?? f.frame.w}×${f.sourceSize?.h ?? f.frame.h}`));
  if (sizes.size > 1) problems.push('frames have different sizes: ' + [...sizes].join(', '));
  if (frames.some((f) => f.trimmed)) notes.push('frames are trimmed (the game handles it, but the standard is no trim)');
  const [w, h] = [...sizes][0].split('×').map(Number);
  const spec = specs.find((s) => s.ids.some((p) => matches(p, id)));
  const tags = (data.meta?.frameTags || []).map((t) => t.name);
  if (!data.meta?.frameTags) problems.push('no tags in the JSON: export with --list-tags ("Meta: Tags" in the dialog)');
  if (!spec) notes.push('no row in the ASSETS.md canvas table: size and tags not checked');
  else {
    if (spec.w && (w !== spec.w || h !== spec.h)) (spec.exact ? problems : notes).push(`canvas is ${w}×${h}, ASSETS.md says ${spec.w}×${spec.h}${spec.exact ? ' (must match exactly)' : ''}`);
    const need = expand(spec.required), may = expand(spec.optional);
    const missing = need.filter((t) => !tags.includes(t));
    if (missing.length) problems.push('missing tags: ' + missing.join(', '));
    const unused = tags.filter((t) => !need.includes(t) && !may.includes(t));
    if (unused.length) notes.push('tags the game does not use: ' + unused.join(', '));
  }
  for (const t of data.meta?.frameTags || []) if (t.to >= frames.length || t.from > t.to) problems.push(`tag ${t.name} points outside the frames`);
  return { problems, notes, size: `${w}×${h}`, frames: frames.length, tags: tags.length };
}

// ---- find Aseprite ----
function aseprite() {
  const p = process.env.ASEPRITE_PATH;
  if (p && fs.existsSync(p)) return p;
  if (p) { console.error(`ASEPRITE_PATH points to a file that does not exist: ${p}`); process.exit(1); }
  const guesses = ['/Applications/Aseprite.app/Contents/MacOS/aseprite', 'C:\\Program Files\\Aseprite\\aseprite.exe', 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\aseprite.exe'];
  const g = guesses.find((x) => fs.existsSync(x));
  if (g) { console.log(`ASEPRITE_PATH is not set; using ${g} (set it in .env, see .env.example)`); return g; }
  console.error('Set ASEPRITE_PATH to the Aseprite program (copy .env.example to .env).'); process.exit(1);
}

const specs = readSpecs();
let sources = fs.existsSync(ART) ? fs.readdirSync(ART).filter((f) => /\.(aseprite|ase)$/i.test(f)) : [];
if (only.length) sources = sources.filter((f) => only.includes(f.replace(/\.(aseprite|ase)$/i, '')));
const ids = sources.map((f) => f.replace(/\.(aseprite|ase)$/i, ''));
if (checkOnly) { for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (f.endsWith('.json')) { const id = f.slice(0, -5); if (!ids.includes(id) && (!only.length || only.includes(id))) ids.push(id); } }
if (!ids.length) { console.log('Nothing to do: no art/*.aseprite files' + (only.length ? ' named ' + only.join(', ') : '') + '.'); process.exit(0); }

const exe = checkOnly ? null : aseprite();
fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const id of ids) {
  const src = sources.find((f) => f.replace(/\.(aseprite|ase)$/i, '') === id);
  if (exe && src) {
    try {
      execFileSync(exe, ['-b', path.join(ART, src), '--sheet', path.join(OUT, id + '.png'), '--data', path.join(OUT, id + '.json'), '--format', 'json-array', '--sheet-type', 'rows', '--list-tags'], { stdio: 'pipe' });
    } catch (e) { console.log(`✗ ${id}: Aseprite failed — ${String(e.stderr || e.message).trim()}`); bad++; continue; }
  }
  const r = check(id, specs);
  const head = r.size ? ` (${r.size}, ${r.frames} frames, ${r.tags} tags)` : '';
  console.log(`${r.problems.length ? '✗' : '✓'} ${id}${head}`);
  for (const p of r.problems) console.log('    problem: ' + p);
  for (const n of r.notes) console.log('    note:    ' + n);
  if (r.problems.length) bad++;
}
console.log(bad ? `\n${bad} of ${ids.length} sprite(s) have problems. Fix them in Aseprite and run npm run sprites again.` : `\nAll ${ids.length} sprite(s) exported and checked.`);
process.exit(bad ? 1 : 0);
