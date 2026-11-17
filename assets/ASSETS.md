# Living World — art inventory (step 1)

All in-game graphics are currently drawn in code (`fillRect`, `arc`, paths, gradients, pixel-by-pixel baking into small cached canvases).
This file lists every one of them so they can be redrawn in Aseprite and exported as `assets/sprites/<id>.png` + `<id>.json`.

**How to read the tables**

- **id** is snake_case and is also the file name. `{a|b|c}` means one file per value, e.g. `wildlife_{deer|boar}` = `wildlife_deer`, `wildlife_boar`.
- **in-game size** is the size of today's code-drawn picture, in its pixels (16 per map tile). **Aseprite canvases are twice that** (32 per tile): see the canvas table further down.
- **states** come from the game logic (the frame numbers the code already asks for). Nothing extra is invented. Left/right is a mirror (`flipX`), so no left-facing frames are needed.
- **frames** is the frame count *per file*.
- **priority**: 1 = always on screen, 2 = frequent, 3 = rare.
- **status**: everything is `code-drawn` today.
- ⚠ marks an object whose in-game size does not match the 64×64 character canvas or the tile grid. The options are in [Size mismatch](#size-mismatch-64-vs-the-games-pixel-grid).

## Scale: the game's pixel grid

| thing | value | where |
|---|---|---|
| map tile | 8 world px (`TILE = 8`) | src/render/terrain.js:6 |
| code-drawn art on the map | 2 px per world px → 16×16 px per tile | src/render/tiles16.js, buildings16.js, town16.js |
| **Aseprite sprites** | **4 px per world px → 32×32 px per tile** (`ART_PER_WORLD`, `ART_SCALE`) | src/sprite-config.js |
| zoom | snapped to whole device pixels per art pixel | src/render/renderer.js:74 (`resize`), `snapZoom` |
| side-view scenes | 270 art px tall, anchored to the bottom, integer-scaled | src/render/scene.js:245 |
| UI | HTML/CSS; pixel textures from small canvases | src/ui/skin.js, src/ui/pixelskin.js |

**Tile size: 32×32** (chosen 2026-11-16, "a bit bigger"): twice the detail of the code-drawn 16×16 tiles, same map area, no change to the game grid or logic. A sprite that replaces a code-drawn picture is exactly twice its size.

---

## 1. Characters

### People on the map

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `townsfolk_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` ⚠ | small villager. One sheet per race; roles (farmer, woodcutter, miner, crafter, merchant, priest, guard, noble, child, hauler) differ by clothes, hat, tool and carried item | src/render/sprites16.js:126 `tinyPerson`; used in src/render/people.js:94 `settlementPeople` | 7×9 | walk (4), work (2), idle (1) — `frameOf`, people.js:35 | 7 × 10 roles = 70 | 1 | Aseprite (scripts/art) |
| `person_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` ⚠ | larger figure at close zoom: settlers, explorers, soldiers in formation | src/render/sprites16.js:27 `personSprite`; src/render/people.js:37 `figure` | 10×12 | walk (4), work/attack (2), idle (1) | 7 × 6 looks (worker, soldier, archer, guard, noble, settler) = 42 | 2 | code-drawn |
| `soldier_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` | army soldiers (spear, bow, gun; tunic and shield tinted with the realm colour) in formations and battles (shield or bow on `person_*`) | src/render/people.js:294 `army`, :341 `battle`; src/render/warfx.js:19 `formation`, :65 `battleScene` | 10×12 | march (4), fight (2), idle (1) | 7 | 2 | Aseprite (scripts/art) |
| `cavalry_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` | rider on a horse (light, heavy) | src/render/people.js:417 `cavalry` (rider + `farmAnimal('horse')`) | 10×12 rider on 10×7 horse | gallop (2), stand (1) | 3 | 2 | Aseprite (scripts/art) |
| `siege_engine` | catapult / cannon at sieges | src/render/people.js:434 `siegeEngine` | ~12×10 | idle (1), fire (1) | 2 | 3 | Aseprite (scripts/art) |
| `explorer` | explorer and settler units moving on the map | src/render/renderer.js:807 `drawExplorers`, :1294 `drawUnit` | ~10×12 | walk (4), idle (1) | 5 | 2 | code-drawn |
| `caravan` | trade caravan (cart and ox) | src/render/town16.js:400 `caravan16`; renderer.js:98 `drawCaravans` | 16×10 | move (2) | 2 | 2 | Aseprite (scripts/art) |
| `cart`, `fishing_boat` | small life near towns | src/render/fx.js:359 `drawLife` | ~8×6 | move (2) | 2 each | 2 | code-drawn |
| `ship_{war\|transport}` | fleets at sea | src/render/renderer.js:965 `drawShip`, :987 `drawFleetsWorld` | ~16×12 at scale 1 | sail (1); the bob is done in code | 1 each | 2 | code-drawn |

### Animals (livestock)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `livestock_{sheep\|cow\|pig\|goat\|horse\|chicken\|dog}` | farm animals in pens and yards | src/render/sprites16.js:175 `farmAnimal`; people.js:212 `livestock`, :234 `yardLife` | 10×7 | walk (2), graze (1) | 3 | 2 | Aseprite (scripts/art) |
| `beast_{sheep\|cow\|horse\|warhorse}` | larger HD animal at close zoom | src/render/sprites16.js:91 `animalSprite` | 14×11 | walk (2) | 2 | 3 | code-drawn |

### Side-view scenes (Visit town / Watch battle)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `scene_walker` | townsperson walking along the street | src/render/scene.js:120 `walker` | 5×9 ⚠ | walk (4) | 4 × 6 races = 24 | 3 | code-drawn |
| `scene_soldier` | soldier in the battle line | src/render/scene.js:129 `soldier` | 10×13 ⚠ | march/fight (4) | 4 | 3 | code-drawn |
| `scene_rider` | cavalry in the battle line | src/render/scene.js:144 `rider` | 14×14 ⚠ | gallop (2) | 2 | 3 | code-drawn |

### Portraits

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `portrait_{race}` | ruler / heir / character portrait, put together from layers (face, hair, beard, crown, traits) by age band | src/render/sprites.js:359 `portraitUrl`, :446 `portraitImg` | 32×32 | age band (4: child, adult, middle, old) × crown (2) | 8 per race; hair and beard as parts → see note | 2 | code-drawn |
| `advisor_portrait` | the advisor face in the advisor bubble | src/ui/advisor.js:49 `portrait` | ~24×24 | idle (1) | 1 | 2 | code-drawn |

> Portraits are built procedurally per character (every ruler looks different). In Aseprite this is best done as **parts sheets** (faces, hair, beards, crowns per race) that the code stacks, rather than one image per person.

---

## 2. Enemies (creatures and wild animals)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `creature_{dragon\|wyvern\|giant\|troll}` | monsters that raid from lairs | src/render/town16.js:428 `creature16`; drawn in renderer.js (monster markers) | 24×18 | fly / walk (2) | 2 | 3 | Aseprite (scripts/art) |
| `lair` | creature lair (cave mouth with bones and gold) | src/render/town16.js:420 `lair16` | 16×12 | static (1) | 1 | 3 | Aseprite (scripts/art) |
| `wildlife_{deer\|boar\|goat\|wolf\|bear}` | wild animals that roam, breed and hunt | src/render/sprites16.js:91 `animalSprite`; people.js:260 `wildlife`, :401 `animal` | 14×11 | walk (2) | 2 | 2 | Aseprite (scripts/art) |
| `sea_{whale\|serpent}` | sea creatures painted on the atlas | src/render/atlas.js:20 `bakeAtlas` | ~12×8 | static (1) | 1 | 3 | code-drawn |

---

## 3. Tiles and backgrounds

### Terrain (proposed 16×16 tiles)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `tile_{grass\|plains\|forest\|jungle\|taiga\|desert\|tundra\|snow\|hills\|mountain\|swamp\|beach}` | ground for each land biome; currently dithered per pixel | src/render/tiles16.js (Tiles16 chunk baking, ground pass), :597 `terrainPalette`; GPU version src/render/terrainGL.js | 16×16 | season (4: spring, summer, autumn, winter) × 4 variants | 16 | 1 | Aseprite (scripts/art) |
| `tile_{deep\|ocean\|shallow\|lake}` | water bands | src/render/tiles16.js (water bands); terrainGL.js shader | 16×16 | wave (4); winter ice for lake | 4 (+1 ice) | 1 | code-drawn |
| `shore_autotile` | coast and biome edges | src/render/tiles16.js (shorelines) | 16×16 | 16 edge/corner cases (4-bit mask) | 16 | 1 | code-drawn |
| `river_autotile` | rivers | src/render/tiles16.js (rivers) | 16×16 | 16 masks | 16 | 1 | code-drawn |
| `scar_{burn\|crater\|flood}` | marks left by disasters | src/render/fx.js:267 `drawScars`, :891 `makeScarSprite` | ~16×16 | fade is done in code | 1 each | 3 | code-drawn |

### Nature objects (on tiles)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `tree_{oak\|birch\|pine\|palm\|jungle\|dead}` | trees | src/render/tiles16.js:121 `objectSprite`, :271 `tileObjects`; close zoom src/render/detail.js:50 `treeSprite` | 16×16 (some 16×24) | season (4) × variant (3) | 12 | 1 | Aseprite (scripts/art) |
| `nature_{bush\|rock\|mound\|peak\|peak_snow\|tuft\|pebbles\|mushroom\|lily\|reeds\|cactus\|flowers}` | ground decoration | src/render/tiles16.js:121 `objectSprite` | 8×8 – 16×16 | variant (2); snow on some in winter | 2 | 1 | Aseprite (scripts/art) |

### Town ground, roads and walls (16×16 autotiles)

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `road_{dirt\|stone\|paved}` | square pixel roads | src/render/town16.js:55 `path16`; renderer.js:1345 `drawRoads` | 16×16 | 16 masks (neighbours N/E/S/W) | 16 | 1 | Aseprite (scripts/art) |
| `bridge` | road bridge over a river | src/render/town16.js:80 `bridge16` | 16×16 | horizontal, vertical | 2 | 2 | Aseprite (scripts/art) |
| `yard` | packed earth around houses | src/render/town16.js:39 `yard16`; renderer.js:657 `drawTownGround` | 16×16 | variant (2), snowy (1) | 3 | 1 | Aseprite (scripts/art) |
| `plaza_{plain\|well\|fountain}` | town square | src/render/town16.js:95 `plaza16` | 16×16 | fountain water (2) | 1–2 | 1 | Aseprite (scripts/art) |
| `wall_{stone\|palisade}` | town wall | src/render/town16.js:106 `wall16`; renderer.js:695 `drawTileWalls` | 16×16 | 16 masks | 16 | 2 | Aseprite (scripts/art) |
| `wall_tower`, `wall_gate` | wall tower and gate | src/render/town16.js:119 `tower16`, :126 `gate16` | 16×16 | gate: horizontal, vertical | 1, 2 | 2 | Aseprite (scripts/art) |
| `fence` | field and pen fences | src/render/town16.js:246 `fence16`; renderer.js:613 `drawFieldDetail` | 16×16 | 16 masks | 16 | 2 | Aseprite (scripts/art) |
| `field` | crop field | src/render/buildings16.js:274 `field16`; src/render/sprites.js:339 `fieldSprites` | 16×16 | growth by season (4) | 4 | 1 | Aseprite (scripts/art) |
| `prop_{barrel\|crate\|woodpile\|flowers\|lamp\|bush\|sack\|anvil\|rack\|scarecrow}` | small town props | src/render/town16.js:133 `prop16` | ~6×6 – 8×10 | static (1); lamp lit at night is done in code | 1 | 2 | Aseprite (scripts/art) |

### Buildings

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `house_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` | ordinary homes; tier grows with the town | src/render/buildings16.js:69 `house16`; renderer.js:1172 `drawSettlement` | 16×16 | tier (4) × roof variant (3) | 12 | 1 | Aseprite (scripts/art) |
| `townhouse_{humans\|elves\|dwarves\|orcs\|lizardfolk\|halflings}` | 2–3 storey town houses in big cities (tags storeys2, storeys3; 2 variants each) | src/render/town16.js:283 `townhouse16` | 16×24 ⚠ | 2 storeys, 3 storeys | 2 | 1 | Aseprite (scripts/art) |
| `home_{treehouse\|hillhome\|tent\|stilt}` | race-style homes (elves, halflings, orcs, lizardfolk) | src/render/town16.js:162 `treehouse16` (16×24), :180 `hillhome16`, :196 `tent16`, :211 `stilt16` | 16×16 (treehouse 16×24 ⚠) | tier (2–3) | 3 | 1 | Aseprite (scripts/art) |
| `boardwalk`, `rope_bridge` | lizardfolk boardwalk, elven rope bridge | src/render/town16.js:227 `boardwalk16`, :235 `ropeBridge` | 16×16 | 16 masks / horizontal-vertical | 16, 2 | 2 | code-drawn |
| `building_{temple\|market\|library\|granary\|warehouse\|barracks\|brewery\|lumber_camp\|mine\|quarry\|port\|walls_tower\|bank\|hospital\|observatory\|aqueduct\|textile_mill\|foundry\|power_plant\|newspaper\|railway_station\|factory}` | special buildings, one each (`power_plant` and `newspaper` have no own drawing yet and use the default look) | src/render/buildings16.js:135 `special16`; src/render/sprites.js:202 `drawSpecial` (older 8 px) | 16×16 | static (1) | 1 | 2 | Aseprite (scripts/art) |
| `building_{town_hall\|castle\|star_fort\|university}` | big special buildings | src/render/buildings16.js:135 `special16` (`BIG16`) | 32×32 ⚠ (2×2 tiles) | static (1) | 1 | 2 | Aseprite (scripts/art) |
| `campfire` | campfire in camps and villages | src/render/buildings16.js:135 `special16` + src/render/fx.js:971 `flameSprite` | 16×16 | burn (3) | 3 | 2 | Aseprite (scripts/art) |
| `windmill` | windmill | src/render/town16.js:373 `windmill16` | 16×24 ⚠ | sails turning (4) | 4 | 2 | Aseprite (scripts/art) |
| `great_work_{cathedral\|university\|palace\|canal\|harbour_works\|boulevards\|world_fair}` | great works | src/render/town16.js:309 `work16` | 32×32 ⚠ | static (1) | 1 | 3 | code-drawn |
| `shrine` | holy-site marker | src/render/renderer.js (holy-site shrines) | ~8×10 | static (1) | 1 | 3 | code-drawn |
| `camp_tent` | army camp and siege camp tents | src/render/town16.js:360 `campTent8`; warfx.js:92 `siegeCamp`, :190 `armyCamp` | 8×8 | static (1) | 1 | 2 | code-drawn |
| `house_old_{race}` | older 8 px house set (still used at far zoom) | src/render/sprites.js:109 `drawHouse`, :315 `houseSprite` | 8×8 | tier (4) | 4 | 2 | code-drawn |

### Atlas (zoomed-out map) and scene backgrounds

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `atlas_glyph_{mountain\|tree\|ship}` | hand-drawn map symbols when zoomed out | src/render/atlas.js:20 `bakeAtlas` | ~8×8 | variant (3) | 3 | 2 | code-drawn |
| `atlas_paper` | parchment texture under the atlas | src/render/atlas.js:20 `bakeAtlas` | 64×64 (repeating) | static (1) | 1 | 2 | code-drawn |
| `scene_sky` | sky behind side-view scenes | src/render/scene.js:24 `sky` | 480×270 | time of day (4: dawn, day, dusk, night) | 4 | 3 | code-drawn |
| `scene_hills_{far\|mid\|near}` | parallax hills | src/render/scene.js:245 `paint` | 480×~120, repeating | static (1) | 1 | 3 | code-drawn |
| `scene_{house\|tent\|special\|windmill\|tree}` | side-view buildings and trees (per race for houses) | src/render/scene.js:50 `house`, :69 `tent`, :76 `special`, :92 `windmill`, :100 `tree` | 20–60 tall | windmill sails (4); others static | 1–4 | 3 | code-drawn |
| `title_backdrop` | title-screen background | src/ui/titlebg.js:7 `showTitleBackdrop` | full screen (redraws the live map) | static (1) | 1 | 3 | code-drawn |

---

## 4. UI and icons

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `icon_{food\|wood\|stone\|iron\|gold\|knowledge\|pop\|stability\|defense\|housing}` | resource icons in the top bar and panels | src/render/sprites.js:25 `ICONS`, :38 `iconCanvas` | 8×8 | static (1) | 1 | 1 | Aseprite (scripts/art) |
| `flag_parts` | realm flags (field pattern + charge + colours per realm) | src/render/sprites.js:69 `drawFlag`, :90 `flagUrl` | 12×8 | patterns as frames, colours applied in code | ~12 | 1 | code-drawn |
| `ribbon` | name tags over towns (9-slice) | src/render/renderer.js:1511 `drawRibbon` | 9-slice, 3×3 parts | normal, capital | 2 | 1 | code-drawn |
| `ui_frame_{wood\|paper\|pixel}` | panel and dialog frames (9-slice) | src/ui/skin.js:16 `wood`, :31 `paper`, :42 `frame`; src/ui/pixelskin.js:6 `frame` | 9-slice, ~24×24 | static (1) | 1 | 1 | Aseprite (scripts/art) |
| `cursor` | mouse cursor | src/ui/pixelskin.js:89 `cursorUrl` | 16×16 (shown ×2) | normal (1) | 1 | 1 | Aseprite (scripts/art) |
| `compass` | compass rose on the atlas | src/render/atlas.js:169 `drawCompass` | ~32×32 | static (1) | 1 | 2 | code-drawn |
| `army_badge` | banner over armies (strength, colour) | src/render/renderer.js:1076 `drawArmyBadges` | ~10×12 | static (1) | 1 | 2 | code-drawn |
| `siege_ring` | ring around a besieged town | src/render/renderer.js:948 `drawSiegeRing` | 16×16 | turning (4) | 4 | 3 | code-drawn |
| `god_cursor` | sandbox power cursor | src/render/renderer.js:832 `drawGodCursor` | 16×16 | per power (≈10) | 10 | 3 | code-drawn |
| `vignette_{alliance\|city\|crown\|death\|era\|faith\|hero\|plague\|revolt\|ship\|war}` | small pictures in the Chronicle | src/ui/chronicle.js:13 `vignette` | 24×18 | static (1) | 1 | 3 | code-drawn |

---

## 5. Effects

| id | what it is | where in code (file:line) | in-game size, px | states / animations | frames (estimate) | priority | status |
|---|---|---|---|---|---|---|---|
| `fx_chimney_smoke` | smoke from houses | src/render/fx.js:293 `settlementExtras`, :950 `puffSprite` | 4×4 | rise / fade (4) | 4 | 1 | code-drawn |
| `fx_torch` | torches and window lights at night | src/render/fx.js:293 `settlementExtras` | 3×5 | flicker (3) | 3 | 1 | code-drawn |
| `fx_washing_line`, `fx_scaffolding` | washing lines; scaffolding on buildings under construction | src/render/fx.js:293 `settlementExtras` | 16×8, 16×16 | flap (2), static (1) | 2, 1 | 2 | code-drawn |
| `fx_flame` | fire on burning towns, campfires | src/render/fx.js:971 `flameSprite` | 6×10 | burn (3) | 3 | 2 | code-drawn |
| `fx_{smoke\|dust\|fire\|spark\|debris\|mote\|flake\|ember}` | particles | src/render/fx.js:465 `drawEffects` | 1×1 – 4×4 | life (3–4) | 4 | 2 | code-drawn |
| `fx_ring` | expanding ring (god powers, events) | src/render/fx.js:465 `drawEffects` (`k: 'ring'`) | 16–48 | grow (5) | 5 | 3 | code-drawn |
| `fx_meteor`, `fx_bolt` | meteor and lightning strikes | src/render/fx.js:80, :465 | 16×48 | fall (4), strike (3) | 4, 3 | 3 | code-drawn |
| `fx_disaster_{fire\|flood\|drought\|eruption\|plague\|quake\|blizzard\|curse\|bless}` | disaster overlays | src/render/fx.js:73 `onFx`, :465 `drawEffects` | 16×16 tiles over the area | loop (4) | 4 | 3 | code-drawn |
| `fx_water_{sparkle\|foam\|fish}` | glints, coast foam, jumping fish | src/render/fx.js:213 `drawWater` | 2×2 – 6×4 | sparkle (3), foam (4), jump (4) | 3–4 | 1 | code-drawn |
| `fx_{mist\|star\|firefly}` | mist, stars, fireflies at night | src/render/fx.js:420 `drawNature` | 1×1 – 32×8 | twinkle (2), glow (3) | 2–3 | 2 | code-drawn |
| `fx_{rain\|snow}` | rain and snow | src/render/fx.js:812 `drawPrecip` | 1×4, 2×2 | fall (1) | 1 | 2 | code-drawn |
| `fx_cloud` | clouds and their shadows | src/render/fx.js:620 `drawSky`, :855 `makeCloudSprites` | 48×24 – 96×40 | variant (4) | 4 | 2 | code-drawn |
| `fx_fog_bank` | rolling fog | src/render/fx.js:792 `drawFogBanks` | 64×24 | variant (3) | 3 | 3 | code-drawn |
| `fx_arrow` | arrow volleys in battle | src/render/people.js:381 `drawArrows` | 3×1 | fly (1) | 1 | 2 | code-drawn |
| `fx_{battle_clash\|sea_clash}` | dust and clash marks at battles | src/render/warfx.js:65 `battleScene`, :150 `seaClash` | 24×16 | loop (4) | 4 | 2 | code-drawn |

### Stays drawn in code (not sprites)

These are data-driven shapes or full-screen light, not pictures, so they stay in code:
colour grading, sunbeams and night light (fx.js:657 `drawScreen`), fog of war (renderer.js:799), borders and frontiers (renderer.js:1378), trade routes (renderer.js:1052), the minimap (renderer.js:1488), floating text and labels (renderer.js:748, :1394), the map editor overlay (renderer.js:842) and the GPU terrain shader as a fast path (terrainGL.js).

---

## Size mismatch: 64×64 vs the game's pixel grid

The spec asks for 64×64 character canvases. The map's real sizes are much smaller:

| object | in-game today | 64×64 would be |
|---|---|---|
| townsfolk | 7×9 | about 7× taller than a house |
| house | 16×16 | 4 tiles wide |
| creature | 24×18 | — |
| side-view walker | 5×9 in a 270 px tall scene | 1/4 of the scene height |

Making all characters 64×64 would mean scaling the whole world ×4: four times as many pixels to bake per tile, and the map at a fixed zoom would show 1/16 of what it shows now. Options:

- **A (chosen, then doubled).** The map keeps its grid at **32×32 per tile**: map characters on a **32×32** canvas (the figure is about 14×18 inside it), buildings 32×32 / 32×48 / 64×64. **64×64 is also used where the camera is close**: side-view scenes, portraits, the Chronicle.
- **B.** Draw everything at 64×64 and scale map sprites down ×1/4. ✗ Shrinking pixel art throws away 15 of every 16 pixels, so the art turns to mush. Not recommended.
- **C.** Raise the map art density from 2 to 8 art px per world px, so a tile is 64×64. ✗ About 16× more memory for baked chunks, slower, and the zoom levels and UI would need redoing. Not recommended.

Objects flagged ⚠ that are taller or wider than one tile (`townhouse`, treehouse, `windmill` 32×48; big buildings and great works 64×64) are fine on the grid: they are 1×1.5 or 2×2 tiles, anchored bottom-centre.

## Proposed internal resolution

- **Map:** the map has no fixed resolution, because it zooms. Close up, the zoom snaps so that one Aseprite pixel = a **whole number** of screen pixels: 4, 8, 12, 16… screen px per world px (×1, ×2, ×3, ×4 per art pixel). One step further out (2 screen px per world px) sprites are shown at half size, averaged. Further out the zoom is free, as before. The camera moves in whole pixels.
- **Side-view scenes:** **640×360** internal (16:9), scaled ×2 → 1280×720, ×3 → 1920×1080, ×4 → 2560×1440, ×6 → 3840×2160; any extra space is letterboxed. That size fits 64×64 characters well (a 64-px figure is about 1/6 of the height, so a whole street fits). Today it is 480×270; going up to 640×360 only changes the scene drawing.
- **UI:** stays HTML/CSS; icons and frames are shown at ×2 or ×3 with `image-rendering: pixelated`.

## Note: the art-slot system already exists

`src/render/pixelkit.js` (`loadArt`, `artFor`) with `art/manifest.json` and `art/slots.json` (505 slots) already lets a PNG replace a generated sprite by key, but without Aseprite JSON, tags or frame durations. In step 2, `src/sprites.js` will take over that job: keep the slot keys as aliases so nothing breaks, and point them at the new ids.

## Aseprite canvas and tags (option A)

The size of the Aseprite canvas (File ▸ New, 32 px per map tile) and the tags each sprite must have. `npm run sprites` checks every export against this table.
`{role}` means one tag per villager role: farmer, woodcutter, miner, crafter, merchant, priest, guard, noble, child, hauler.
Sprites marked **exact** replace a ready-made picture of that size, so the canvas must match to the pixel (otherwise the game keeps the old picture and warns once in the console). The others are placed by their anchor (bottom-centre), so the size is a recommendation.

<!-- sprite-specs: start -->
| id | canvas | required tags | optional tags |
|---|---|---|---|
| townsfolk_* | 32×32 | {role}_walk, {role}_work, {role}_idle | |
| person_* | 32×32 | walk, work, idle | {role}_walk, {role}_work, {role}_idle |
| soldier_* | 32×32 | spear_walk, spear_work, spear_idle, bow_walk, bow_work, bow_idle, gun_walk, gun_work, gun_idle | |
| cavalry_* | 32×32 | light_ride, light_idle, heavy_ride, heavy_idle | |
| siege_engine | 32×32 | catapult, cannon | |
| livestock_* | 32×32 | walk | graze, idle |
| wildlife_* | 32×32 | walk | idle |
| creature_dragon, creature_wyvern | 64×64 | fly | idle |
| creature_giant, creature_troll | 64×64 | walk | idle |
| lair | 32×32 | | |
| caravan | 32×32 | move | |
| windmill | 32×48 exact | turn | |
| house_* | 32×32 exact | tier0, tier1, tier2, tier3 | |
| townhouse_* | 32×48 exact | storeys2, storeys3 | |
| home_treehouse | 32×48 exact | tier0, tier1, tier2, tier3 | |
| home_hillhome, home_tent, home_stilt | 32×32 exact | tier0, tier1, tier2, tier3 | |
| building_town_hall, building_castle, building_star_fort, building_university | 64×64 exact | | {race} |
| building_* | 32×32 exact | | {race} |
| campfire | 32×32 exact | | |
| tree_oak, tree_birch | 32×44 exact | spring, summer, autumn, winter | |
| tree_pine | 28×48 exact | spring, summer, autumn, winter | |
| tree_palm, tree_jungle | 36×44 exact | spring, summer, autumn, winter | |
| tree_dead | 24×28 exact | spring, summer, autumn, winter | |
| nature_bush, nature_rock | 20×16 exact | | spring, summer, autumn, winter |
| nature_mound | 32×20 exact | | spring, summer, autumn, winter |
| nature_peak, nature_peak_snow | 36×48 exact | | spring, summer, autumn, winter |
| nature_tuft | 14×12 exact | | spring, summer, autumn, winter |
| nature_pebbles, nature_lily | 14×8 exact | | spring, summer, autumn, winter |
| nature_mushroom | 12×12 exact | | spring, summer, autumn, winter |
| nature_reeds | 20×20 exact | | spring, summer, autumn, winter |
| nature_cactus | 20×28 exact | | spring, summer, autumn, winter |
| nature_flowers | 16×12 exact | | spring, summer, autumn, winter |
| tile_* | 32×32 exact | spring, summer, autumn, winter | |
| road_* | 32×32 exact | road, street | |
| yard | 32×32 exact | grass, snow | |
| plaza_* | 32×32 exact | | |
| bridge | 32×32 exact | wood, stone | |
| wall_stone, wall_palisade | 32×32 exact | whole, broken | |
| wall_tower | 32×32 exact | stone, palisade | |
| wall_gate | 32×32 exact | stone, palisade | |
| fence | 32×32 exact | | |
| field | 32×32 exact | stage0, stage1, stage2, stage3, stage4, stage5 | |
| prop_* | 16×16 exact | | |
| icon_* | 16×16 exact | | |
| ui_frames | 24×24 exact | panel, modal, parch, btn, btn_hover, btn_down, btn_gold, inset, god, tip, btn_wood, carved | |
| cursor | 32×32 exact | | |
| ui_wood, ui_wood_dark | 64×32 exact | | |
| ui_paper | 64×64 exact | | |
<!-- sprite-specs: end -->

Sprites not in this table can be drawn already, but the game does not use them yet (they still need hooking up).
- `{race}` tags on buildings: one frame per race (`humans`, `elves`, ...); without them frame 0 is used for every race.
- Houses: the frames inside `tier0`..`tier3` are the roof variants (up to 3).
- Trees and nature: the frames inside a season tag are the variants.

## Summary

| group | files (ids) | frames (estimate) |
|---|---|---|
| Characters — people, units, vehicles | 6 + 6 + 2 + 1 + 1 + 1 + 1 + 2 + 2 = **22** | 420 + 252 + 14 + 3 + 2 + 5 + 2 + 4 + 2 = **704** |
| Characters — animals | 7 + 4 = **11** | 21 + 8 = **29** |
| Characters — scenes and portraits | 3 + 6 + 1 = **10** | 24 + 4 + 2 + 48 + 1 = **79** |
| Enemies | 4 + 1 + 5 + 2 = **12** | 8 + 1 + 10 + 2 = **21** |
| Terrain and nature | 12 + 4 + 1 + 1 + 3 + 6 + 12 = **39** | 192 + 17 + 16 + 16 + 3 + 72 + 24 = **340** |
| Town ground, roads, walls | 3 + 1 + 1 + 3 + 1 + 2 + 1 + 1 + 10 = **23** | 48 + 2 + 3 + 4 + 16 + 3 + 16 + 4 + 10 = **106** |
| Buildings | 6 + 1 + 4 + 2 + 21 + 5 + 1 + 1 + 7 + 1 + 1 + 6 = **56** | 72 + 2 + 12 + 18 + 21 + 5 + 3 + 4 + 7 + 1 + 1 + 24 = **170** |
| Atlas and scene backgrounds | 3 + 1 + 1 + 3 + 5 + 1 = **14** | 9 + 1 + 4 + 3 + 8 + 1 = **26** |
| UI and icons | 10 + 1 + 1 + 3 + 1 + 1 + 1 + 1 + 1 + 11 = **31** | 10 + 12 + 2 + 3 + 1 + 1 + 1 + 4 + 10 + 11 = **55** |
| Effects | 1 + 1 + 2 + 1 + 8 + 1 + 2 + 9 + 3 + 3 + 2 + 1 + 1 + 1 + 2 = **38** | 4 + 3 + 3 + 3 + 32 + 5 + 7 + 36 + 11 + 7 + 2 + 4 + 3 + 1 + 8 = **129** |
| **Total** | **≈ 256 files** | **≈ 1,659 frames** |

Most of the frames sit in a few sheets: townsfolk (420, because of 10 roles × 6 races) and terrain (192). Two ways to cut the work:

- Draw roles as **parts** (hat, tool, carried item) layered by code. That brings townsfolk down to about 6 × 7 = 42 base frames plus about 30 parts, and `person_*` likewise.
- Draw the seasons as **palette swaps** in code. That cuts terrain and trees by about ×4.

With both, the total drops to roughly **900 frames**.

**Suggested order** (priority 1 first, largest visual gain): `tile_*` + `shore/river_autotile` → `house_*` + `road_*` + `yard`/`plaza` → `tree_*`/`nature_*` → `townsfolk_*` → `icon_*` + `ui_frame_*` + `ribbon` → the rest by priority.
