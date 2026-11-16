# Living World art style

All art is original. The packs below were shared as **style references only**: their look
(proportions, outline, shading, colour mood) guides ours. No pixels, shapes or palettes are
copied from them, and none of their files are in this repository.

References: MiniFolks (Humans, Villagers 1 & 2, Forest Animals, Heroes) by LYASeeK and Dreamir,
The Fan-tasy Tileset and its Castles & Fortresses add-on by Ventilatore, PixelHole's Overworld
Tileset, The Magic Market by GFragger, UI Mega Pack by ToffeeCraft, 16x16 RPG Item Pack by
Alex's Assets, Skeletons Pack by MonoPixelArt, Heraldry Constructor by MedievalMore.

## Rules

- **Scale:** 32 art pixels per map tile (see assets/ASSETS.md). Never mix pixel sizes in one sprite.
- **Outline:** a 1 px ink outline (`#241a24`, palette "ink 2") around the silhouette. Inside a
  sprite, separate parts with the darkest tone of the part's own ramp, not with ink.
- **Light:** from the top-left. Each material uses a 3–4 tone ramp from `art/palette.gpl`:
  light on top and on the left, dark underneath and on the right.
- **Colour mood:** warm and saturated, like the references: shadows lean violet, lights lean
  warm yellow. Use only palette colours.
- **People:** chibi. The head is about 40% of the figure (8×7 px on a 14×18 villager), two 1×2 px
  eyes, a pink blush pixel, 1 px arms. Each race keeps its silhouette: elf ears and long hair,
  dwarf beard and broad body, orc tusks and topknot, lizardfolk snout, crest and tail, halfling
  curls and bare feet.
- **Animals:** side view, facing right (the game mirrors them). Far legs in ink-dark, near legs in
  the leg colour, shaded body (light back, dark belly).
- **Facing:** everything that moves faces right; left is a mirror.
- **No anti-aliasing**, no soft gradients, no semi-transparent pixels except shadows the game adds.

## Workflow

- Generated art: `node scripts/art/build.mjs <ids>` draws the sprites in code (scripts/art/*.mjs),
  writes `art/<id>.aseprite` with frames and tags, then exports and checks it (`npm run sprites`).
  Previews go to `art/previews/<id>.png`.
- To hand-edit a sprite in Aseprite, add its id to `art/hand-edited.txt` first, so the generator
  never overwrites your work. Then edit, save and run `npm run sprites -- <id>`.
