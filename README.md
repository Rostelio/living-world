# Living World — Grand Strategy

A 2D pixel-art, real-time grand strategy / civilization simulation set in a procedurally generated fantasy world. Inspired by WorldBox, Crusader Kings and Europa Universalis. You guide one civilization from a tribal campfire through four historical eras while autonomous rival civilizations grow, reform and advance on their own.

## Running

No build step and no dependencies beyond Python 3 and a modern browser.

```bash
./start.command          # macOS: double-click it in Finder, or run in Terminal
python3 serve.py         # any OS, then open http://localhost:8417
```

(ES modules can't load from `file://`, so a local server is needed. `serve.py` disables caching so edits show up on reload.)

### Desktop app (PC & macOS)

Living World also ships as a desktop application (Electron). Ready-built packages are in `dist/`:

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `dist/Living World-1.0.0-arm64.dmg` |
| macOS (Intel) | `dist/Living World-1.0.0.dmg` |
| Windows (x64, portable) | `dist/Living World-1.0.0-win.zip` → unzip and run `Living World.exe` |

The builds are not code-signed: macOS asks you to right-click → **Open** the first time when the app came from another computer; Windows SmartScreen may ask you to click **More info → Run anyway**.

Developing and rebuilding (needs Node.js):

```bash
npm install          # Electron + electron-builder
npm start            # run the desktop app from source
npm run smoke        # headless self-test inside the desktop shell
npm run dist:mac     # build macOS DMGs
npm run dist:win     # build the Windows zip
```

A Windows *installer* (NSIS) can be produced by building on Windows, or on an Intel/Rosetta Mac, after switching `build.win.target` back to `nsis`.

## What's in this build (Phase 1 + most of Phase 2)

| Area | Implemented |
|---|---|
| World generation | Seeded continents, islands, mountains/hills, rivers & lakes, climate → 12 biomes, resource deposits (iron, gold, stone, fertile soil, fish, game, horses) |
| Provinces | ~250 organic provinces (terrain-weighted flood fill; mountains & rivers form borders), adjacency, coast/river flags, economic potential |
| Races | Humans, Elves, Dwarves, Orcs — distinct modifiers, habitats, architecture and unique technologies |
| Settlements | Camp → Village → Town → City → Metropolis; automatic housing growth; player-managed construction queue (19 building types); towns extend influence over neighbouring provinces |
| Economy | Food / wood / stone / iron / gold / knowledge; automatic worker allocation per settlement driven by national priorities; taxes, upkeep, corruption, storage caps, famine |
| Expansion | Send settlers (visible caravans walking an A* path) to found new settlements; roads between settlements |
| Technology | 41 techs over Ancient → Medieval → Renaissance → Industrial, race-unique techs, knowledge diffusion from neighbours, cost scaling for large realms |
| Government | Tribal, Monarchy, Republic, Theocracy, Empire, Dictatorship; rulers with traits, ages, heirs, dynasties, elections; nation persists through dynasty changes; stability system |
| AI civilizations | Six personalities (expansionist, diplomatic, isolationist, trader, militaristic, defensive) with adaptive strategies (famine relief, restoring order, consolidation), autonomous research, construction, expansion and reforms |
| Ecosystem | Deer, boar, goats, wolves and bears that wander, breed, hunt and are hunted by settlements |
| UI | Top bar (flag, ruler, date, treasury, resources, stability), Economy/Diplomacy/Military/Government/Technology/Construction/Population panels, province/settlement context panel, map modes (political, terrain, resources, population, development), minimap, event log, toasts, tooltips |
| Time | Pause + 5 speeds, 12-month calendar |
| Save/Load | Local quick/auto saves + JSON export. Only dynamic state is saved (~125 KB); the world regenerates from its seed. Simulation is deterministic (verified), which also keeps lockstep multiplayer possible later |

### Phase 3 — Grand strategy

| Area | Implemented |
|---|---|
| Diplomacy | Opinion between every pair of civs (race kinship & ancient enmities, borders, treaties, wars, gifts, grievances, government, temperament); gifts, trade agreements, alliances; AI proposals arrive as offers you accept or reject; acceptance previews with reasons |
| Trade | Trade agreements pay both partners monthly (scaled by population & markets), boost knowledge diffusion; drawn as animated routes in the Trade map mode |
| Military | 11 regiment types incl. gunpowder/industrial units and race-unique Knights, Elven Rangers, Ironbreakers, Berserkers; recruitment draws population and costs gold/iron/wood; generals with skill & traits; split / merge / disband / replace general; upkeep and food supply, attrition outside your land |
| Movement | Select an army and right-click to march (A* with roads, respects borders: own, allied, vassal, enemy or unclaimed land only) |
| Battles | Fought day by day: attack vs defense, terrain (hills/mountains/forest defence, cavalry penalties in rough ground, archer volleys & forest bonus), generals, era, morale and routs; losers retreat |
| Sieges & conquest | Standing in an enemy province besieges its settlement (siege power vs walls, size and defense tech; garrison can block weak sieges) — success transfers the settlement and its lands. Unsettled enemy land is occupied after 20 days |
| Wars | Wars with sides, allies called in, war score, exhaustion, AI peace offers (white peace, tribute, vassalage), 10-year truces, vassals paying tribute and wars of independence; war weariness lowers stability |
| AI | Personality-driven recruitment, army targeting (prey, sieges, retreats), war declarations based on relative coalition strength & opinion, trade/alliance diplomacy. No wars before year 20; the player has a grace period until year 35 |
| UI | Rebuilt Diplomacy and Military panels, army panel, war & offer indicators in the top bar, Diplomatic (F6) and Trade (F7) map modes, battle/siege effects, game-over screen with "observe the world" |

### Phase 4 — Advanced simulation

| Area | Implemented |
|---|---|
| Dynasties & characters | Rulers have Diplomacy / Martial / Stewardship / Learning attributes that shape the realm; royal families with children who are born, grow up and are educated (choose their education via events); succession laws (Primogeniture or Elective); regencies for child rulers; chronicle of past rulers and dynasties |
| Succession crises | Heirless deaths bring a new house to power and may spark a **War of Succession**; passed-over siblings can claim the throne |
| Unrest | Per-settlement unrest from low stability, taxes, foreign rule (settlements keep their founding culture), recent conquest, distance from the capital, war exhaustion, sieges and famine; reduced by temples, town halls, castles and garrisons. Unrest cuts production and taxes. Unrest map mode (F8) |
| Revolutions & civil wars | High unrest → **separatist revolts** that can win independence as new nations; prolonged collapse of stability → **revolution** (if it wins, the government is overthrown, e.g. monarchy → republic); **pretenders** fight for the crown. Rebels raise armies and fight with the normal war system; the nation persists through it all |
| Battles | Day-by-day battles with **Skirmish → Melee → Pursuit** phases (archers dominate early, cavalry runs down routing troops), stances (Aggressive / Balanced / Defensive), withdrawal, and a live battle view in the army panel |
| Sieges & fortifications | Castles (Medieval) and Star Forts (Gunpowder); siege phases (encircled, breached, starving); storm the walls with shown odds; besieged settlements lose people and output |
| Advanced AI | Aggressive expansion makes neighbours hostile and triggers **coalitions**; AI rivals; personalities drift with each new ruler's temperament; AI assaults walls when the odds are good |
| History | 26 historical events with choices — generic (plague, fire, gold rush, intrigue…), era-driven (printing press, exploration, labour movements) and race-specific (Elven Council of the Eldest, Dwarven deep delving, Orcish warbands, Human merchant guilds) — plus 8 new race-unique Renaissance/Industrial technologies. Timed and permanent modifiers |

Older saves (Phases 1–3) are migrated on load.

### Phase 5 — Polish & expansion

| Area | Implemented |
|---|---|
| New races | **Lizardfolk** (swamp & jungle breeders, slow innovators, dislike the cold; reed domes & stilt huts; Saurus Warriors) and **Halflings** (hill-country farmers & brewers, very stable, weak in war; turf burrows; Slingers) — each with 4 unique technologies and 2 race events |
| Content | 3 new technologies (Medicine, Astronomy, Electricity), 5 new buildings (Aqueduct, Hospital, Observatory, Bank, Railway Station) with sprites, 10 new events (golden ages, dark times, royal marriages, bandits, storms, heresy, inventors, mercenaries, earthquakes, trade fairs) — 40 events total |
| Interface | **Alerts bar** (research, idle builders, famine, debt, sieges, invasions, revolt risk, missing heir); **Ledger** (L): sortable realm rankings, a permanent **World Chronicle** of major events, and world statistics; Settings (autosave interval, wildlife/villagers, edge panning, interface size, war confirmation, pause on battle) |
| Saves | Save manager with named saves, delete, storage usage, export & **import from file**, rotating autosaves (3 slots), save validation and versioning |
| Performance | Profiled a large 12-civ world: AI army orders and hunting were the hotspots (peacetime path-finding retries, O(settlements×animals) scans). Now ~4× faster (≈125 ms per simulated year late-game on a large map). Optional profiler: `LW.G.profile = {}` |
| Balance | Late-game stability now averages 40–55 instead of 75 (era-driven social change, realm size), corruption 3.5%/month above the reserve, AI wars more frequent (≈20–25 wars and a handful of revolts per 120 years among 10 realms) |

## Controls

| Input | Action |
|---|---|
| Drag / WASD / arrows | Pan |
| Scroll / Z X | Zoom |
| Click | Select province / settlement / army |
| Right-click | March the selected army |
| Space, 1–5, + / − | Pause, speed |
| E R M G T C P L | Economy, Diplomacy (Relations), Military, Government, Technology, Construction, Population, Ledger |
| F1–F8 | Map modes (political, terrain, resources, population, development, diplomatic, trade, unrest) |
| H | Jump to capital |
| Ctrl/Cmd+S | Quick save |
| Esc | Close panel / game menu |

## Architecture

```
src/
  core/      rng (seeded), noise, names, utils
  data/      biomes, races, buildings & stages, techs, governments/traits/personalities
  world/     worldgen (terrain, climate, rivers, biomes, resources), provinces
  sim/       state (single serializable state object), setup, sim tick, economy,
             settlements & construction, colonize (units), tech, government, ai,
             wildlife, pathfind (A*), mods (modifier aggregation), save
  render/    terrain baking (8px/tile pixel art), overlays (political/borders/heatmaps),
             sprites (procedural pixel art: houses per race, buildings, icons, flags), renderer
  ui/        panels (HTML panels), ui (top bar, log, modals, input wiring)
  main.js    game loop, input
```

Key design choices:

- **Simulation is separate from rendering.** `G.state` is plain JSON-serializable data; all randomness goes through a seeded RNG. The renderer only reads state.
- **Scalable level of detail.** Daily ticks cover only cheap things (unit movement, wildlife, construction progress). The economy runs monthly as aggregates per settlement, and politics and AI strategy run yearly. Individual villagers are purely cosmetic and only exist for settlements on screen when zoomed in. 250 simulated years with 8 civilizations takes ~16 s headless.
- **World is static and regenerated from the seed**, so saves stay small and multiplayer clients would only need to sync commands.

## Balance snapshot (headless, auto-play)

Medieval Era around year 30–50, Renaissance around year 90–110, Industrial around year 150–200, and the map is mostly settled by year 50–80. Balance is a first pass. Orcs (fast growth) and expansionist AIs tend to snowball until warfare exists to check them.

### Phase 6 — Seas & desktop

| Area | Implemented |
|---|---|
| Sea travel | Realms with **Sailing** and a **Harbour** move settlers and armies across water automatically: one pathfinder plans mixed land/sea routes (boarding is cheap at your own harbours, slow from open beaches). Ships are drawn at sea |
| Overseas expansion | Free coastal provinces within 45 tiles of a harbour can be colonised on other islands and continents; AI realms colonise overseas too |
| Navies | Galleys (Sailing), Carracks (Navigation), Ironclads (Steam Power) built at harbours; fleets with admirals, morale and upkeep; select a fleet and right-click the sea to sail |
| Naval war | Day-by-day naval battles; warships **intercept** enemy armies crossing the sea unless your own fleet escorts them within 2 tiles; **blockades** of enemy harbours (−50% trade, −30% taxes, +unrest, faster sieges) |
| AI | AI builds harbours when it runs out of land, keeps a navy sized to its rivals, hunts weaker fleets, blockades enemy ports, invades overseas, and declares war on realms reachable by sea |
| Desktop | Electron app for macOS (Apple Silicon & Intel DMGs) and Windows (portable zip), served from a private `app://` scheme, with a Content-Security-Policy, fullscreen toggle, persistent saves and a built-in smoke test |

### Phase 7 — Sound, maps & scenarios

| Area | Implemented |
|---|---|
| Music | Fully generative score synthesized live with Web Audio (no audio files): modal chord progressions, pads, bass and a lead instrument that changes with your era — flute (Ancient), lute (Medieval), harpsichord (Renaissance), piano (Industrial). Turns martial with drums when your realm is at war; calm themes on menus and in the editor |
| Sound effects | Synthesized cues for war declarations, battles (victory & defeat), construction, discoveries, new eras, settlements, births, trade, naval battles, events, notifications and interface clicks |
| Sound settings | Master / music / effects volume, mute (♪ button in the top bar) |
| World types | Continents, Pangaea, Archipelago and Highlands on the new-game screen |
| Map editor | Start from a generated world, empty ocean or empty land; paint 16 terrain types with an adjustable brush (coasts and shallows form automatically), draw rivers, place resources, preview provinces, undo/redo; place civilizations (race, name, colour, starting size, AI personality) |
| Scenarios | Starting era and extra random rivals; the player picks which placed civilization to play. Maps are saved to a library, exported/imported as `.lwmap.json` files (≈10–20 KB), and embedded in saved games. Four built-in scenarios: *Dawn of Peoples*, *Age of Sail*, *Clash of Empires*, *Kingdoms of the Peaks* |

Open the editor from the start screen: **Scenarios & Map Editor → New map…** Editor controls: left-drag paints, right-drag or Space+drag pans, scroll zooms, `[` `]` brush size, Ctrl/Cmd+Z undo, Ctrl/Cmd+S save.

### Phase 8 — Pops, markets & statecraft (inspired by Victoria 3 and Europa Universalis V)

A deep rework of the economy and society. Saves from earlier versions load and are migrated (old stockpiles become grain/wood/stone, populations are split into professions), but the game balance is new.

| Area | Implemented |
|---|---|
| Pops | Every settlement's population is split into 8 professions: peasants, laborers, craftsmen, merchants, clergy, soldiers, aristocrats and capitalists (Industrial era). Buildings provide jobs; people move into jobs that pay better than farming. Clergy and soldiers are paid by the state |
| Living standards | Pops earn wages (or profits as owners), pay taxes and buy needs in tiers: basic (food, fuel), comfort (clothing, furniture, liquor) and luxury (luxuries, spices, glass, paper). What they can afford sets a 0–10 standard of living that feeds stability, growth and unrest |
| Goods | 18 goods across the eras, from grain, fish, wood and stone up to tools, cloth, paper, glass, weapons, steel, coal and luxuries. Buildings have production methods that upgrade automatically with technology (e.g. hand looms → textile mills) |
| Markets | Each realm has its own market, and prices follow supply and demand (0.5–3× the base price). Goods flow between markets linked by trade agreements, vassalage and alliances. A shortfall in building or recruitment costs is **imported for gold at 2.5× the market price**; build cards show the import cost |
| Diplomatic plays | Wars start as crises: the instigator makes a demand (conquest, tribute, vassalage or humiliation), tension rises each month, third parties take sides, and the target can give in or the instigator can back down before it becomes a war over that demand |
| Culture & faith | One base faith per race, with heresies that split off and spread. Settlements convert and assimilate over time, while temples speed this up. Policies: tolerant or enforced faith, accepted cultures, and adopting a new state faith. Faith affects opinion between realms |
| Cabinet & advisors | 2–4 cabinet seats with advisors who have skill, speciality and salary. Each can be assigned one of eight actions: boost economy, research, stability, trade or the military, improve relations, convert or integrate a settlement |
| Control | Policies only, mostly automatic. The panels show markets, pops, demographics, cabinet and crises |

Balance (headless auto-play, medium world): no realm-wide famines; living standards around 5.5–7. The Medieval era arrives around year 40–60, the Renaissance around 90–120 and the Industrial era around 180–200 for the leading realms. Expect roughly 20 crises and 10 wars per century.

### Phase 9 — Living graphics, disasters & god powers

| Area | Implemented |
|---|---|
| Map art | Richer pixel terrain: round broadleaf trees, conifers and palms with shadows, double-peaked mountains with lit and shaded faces and snowcaps, rounded hills, dunes, reeds, flowers and rocks, and wet-sand shorelines |
| Seasons | Snow spreads across cold lands in winter (deep winter reaches the temperate belt), forests turn orange and red in autumn, and rivers and coasts freeze in the far north |
| Living water | Surf rolls along coasts, light glints on open water, and rivers visibly flow downstream |
| Living settlements | Carts travel the roads, fishing boats work the harbours, construction shows scaffolding with a crane and a progress bar, industry smokes, chimneys smoke in winter, and windows light up at night |
| Day & night | A full day/night cycle: dusk and dawn tints, dark nights lit by towns, campfires, fires and lava |
| Weather | Drifting pixel clouds with shadows, rain or snow depending on climate and season, storms with lightning flashes, and morning fog in autumn |
| Effects | Battle smoke and gun flashes, burning besieged towns, screen shake, and animated disasters |
| Natural disasters | Plague (spreads along roads), earthquakes, volcanic eruptions (lava and ash), droughts, floods, wildfires (spread through forests), great blizzards and the rare meteor. They kill people, destroy buildings and cut harvests, and leave scars on the land: craters, lava fields, ash and burnt forest. Frequency is chosen on the new-game screen (off / rare / normal / frequent) |
| Sandbox mode | A new game mode with a god-powers bar: rule any realm, found a new people, bless or curse, raise an army, lightning, meteor, earthquake, volcano, plague, drought, flood, wildfire, incite revolt, start a war, force peace, and terraforming brushes (grassland, forest, desert, hills, mountains, snow) |
| Interface | Restyled panels, buttons, tooltips, top bar and minimap; the season and time of day in the top bar; a **Trends** tab in the Ledger with yearly charts of population, treasury, living standard, stability, knowledge, regiments and technologies, compared with rival realms |
| Settings | Toggles for seasons, day/night, clouds, weather, ambient life and screen shake, plus an effects-quality level |
| Desktop | The game loop survives errors and shows them on screen; the Mac app writes an error log (**Game → Open Error Log**) |

Phase 8 saves load in Phase 9 with normal disasters switched on. Terraforming is stored in the save and reapplied when it loads.

### Phase 10 — Interest groups, laws & a livelier world (graphics inspired by WorldBox's style, with original art)

| Area | Implemented |
|---|---|
| Interest groups | Seven groups — Landowners, Rural Folk, the Devout, Burghers, Industrialists, Workers, Armed Forces — draw clout from the Phase 8 pops (numbers × wealth), weighted by the form of government and by laws. Each has an approval (−10 … +10) built from the laws it likes or hates, its members' living standard, stability and more; happy groups add stability, angry ones cost it |
| Laws | Eight categories (Land, Taxation, Trade, Church & State, Army, Education, Labour, Welfare), 25 laws unlocked by technology. Laws change taxes, knowledge, growth, trade volume, import prices, army costs, owners' share of profits, peasants' job mobility, and the living standard of the poor; schools and welfare cost gold every month |
| Enacting laws | One law at a time is debated: months to pass depend on support from the groups; low support stalls the debate. The Politics panel (**O**) shows clout, approval with reasons, movements, and every law with who backs or opposes it |
| Movements | Angry, organised groups build a movement. At 100% they demand a law: give in (the law passes at once) or refuse (stability falls, unrest rises, and a strong group may start a revolution). Political awareness grows with the era, schools and republics, so tribal peoples rarely revolt over laws. AI realms debate and pass laws too |
| Little people | Villagers with jobs walk between home and work: farmers in the fields, woodcutters and miners carrying logs and stone, crafters, merchants, priests, guards, nobles and children. They go home at night; sheep and cows graze near pastures; wild animals are proper sprites (deer with antlers, wolves, boars, goats, bears) |
| Armies & battles | Close up, armies are crowds in formation — spearmen, archers, horsemen and knights, musketeers, catapults and cannons — with a standard bearer. Battles are two crowds clashing, with arrows in flight, musket smoke, and fallen soldiers left on the field |
| Close-up zoom | Zoom up to 16× (was 6×). Crops grow with the seasons (furrows, sprouts, green, golden, stubble, snow), fences ring the fields, and houses gain doors, windows and chimneys |
| Bolder style | A brighter, more saturated palette and crisper tiles; the realm colour fades when zoomed in so the land shows through |

Phase 9 saves load in Phase 10: every realm starts with the traditional laws (serfdom, land tax, mercantilism, state religion, levies, no schools, no workers' rights, no welfare).

### Phase 11 — Characters & dynasties, a pixel-art interface and sharper graphics

| Area | Implemented |
|---|---|
| Characters | Rulers, consorts, children and courtiers have five skills (Diplomacy, Martial, Stewardship, Learning and the new **Intrigue**) and traits, including the new Genius, Strong, Sickly, Schemer, Paranoid and Honest. Every character has a generated pixel **portrait** (race, age, hair, beards, scars, crowns) |
| Lifestyles | Pick your ruler's lifelong focus (Diplomacy, Martial, Stewardship, Learning, Intrigue): experience every year, and at 100 a new trait and +1 skill |
| Marriage | Rulers marry. Without a consort few children are born. Propose a **royal marriage** to another realm from Diplomacy (they accept if they like you): +20 opinion, and your children gain a **claim** on their throne. AI courts propose matches to you |
| Claims & inheritance | Press a blood claim with the new **Demand: our claim** crisis (a member of your house takes their throne and they become your vassal). If a house dies out without an heir, a realm with a claim inherits it in a personal union |
| Partition | A new succession law: the eldest keeps the capital and younger adult children found allied realms of the same house (+3 stability while you live). Some tribal AI realms use it, so realms fragment and dynasties spread |
| Court & plots | A court of 2–7 nobles whose opinion affects stability. Gift them gold or banish them. Disloyal, ambitious courtiers plot murder; your Intrigue (and Paranoia) uncovers plots, which you can **expose**. Send agents to **assassinate** a rival ruler or heir: success depends on both rulers' Intrigue; if discovered, they will hate you |
| Dynasties | Same-house realms like each other (+25 opinion); the Court panel lists your house's realms, claims and past rulers |
| Court panel | New panel (**K**): ruler, lifestyle, consort, children and their education, courtiers, plots and dynasty. Diplomacy shows each foreign ruler's portrait, traits and consort |
| Pixel interface | Every frame, button, slot, tooltip, toast and scrollbar is drawn as pixel art (nine-slice pixel frames generated at start-up), with a pixel font, hard pixel shadows, segmented bars and a pixel cursor |
| Sharper graphics | Buildings use upscaled pixel-art sprites with outlines and lighting when zoomed in; at close zoom forests show hand-shaded trees that change with the seasons (blossom in spring, green in summer, orange and red in autumn, bare and snowy in winter; pines get snow) |
| Screenshots | `LW_SHOT=<dir> LW_SHOT_SCRIPT=<file> npx electron .` renders scripted scenes to PNG (used for visual testing) |

Phase 10 saves load in Phase 11: rulers gain an Intrigue skill and every realm gets a court; consorts and claims come with time.

### Phase 12 — Gold sinks, deeper warfare, exploration & fog of war

| Area | Implemented |
|---|---|
| Loans | Borrow (about eight months of income) at interest; the crown borrows automatically when the treasury runs dry. Five loans is the limit — beyond that, **bankruptcy** (debts torn up, mercenaries desert, −25 stability, five years of ruined credit). AI realms in peacetime cut costs instead of borrowing |
| Royal patronage | A standing share of income (5–35%) spent on festivals, alms and grants for stability and a little knowledge |
| Great monuments | Ten unique world wonders across the eras (Great Library, Colossus, Hanging Gardens, Grand Temple, Great Wall, Royal Palace, Star Observatory, Grand Bazaar, Crystal Palace, Grand Railway Terminus). Funded with a share of monthly income; the first realm to finish one owns it forever |
| Mercenaries | Four companies for hire each year: an up-front fee plus monthly pay; unpaid mercenaries desert |
| Bribes & forged claims | Buy an interest group's goodwill (+4 approval for 3 years); pay scribes to forge a claim on a neighbour's throne (about a year; discovery angers them) |
| Balance | Corruption grows faster on very large hoards; great cities grow more slowly; the AI spends its wealth (monuments, patronage, bribes, mercenaries, claims). In tests the richest realm holds roughly nine months of income instead of piling up gold, and bankruptcies are rare |
| Occupation | Captured towns are **occupied**, not annexed: they pay their owner nothing and add war score every month. Marching an army in liberates them. A realm wholly occupied capitulates |
| Peace deals | At the peace table pick which occupied towns to keep — each costs war score (bigger towns and capitals cost more). The AI demands towns the same way. Everything else is returned |
| Commanders | Appoint your ruler or a courtier to lead an army: their Martial skill and traits become the general's skill and trait. Commanders can fall in battle — a ruler's death means succession. The AI puts its best martial characters in charge |
| Supply & terrain | Armies beyond 14 tiles of their own towns (or occupied ones) suffer attrition and lose morale; harsh winters, desert heat, jungle fever, mountains and swamps add attrition (halved by Logisticians). Attacking across a river costs 22% attack; walls, castles and star forts strengthen defenders at the town itself |
| Fog of war | Optional (on by default, off in sandbox): you start knowing only your own region. Your towns, armies, fleets and settlers, your allies and vassals reveal the land. Unknown realms, armies and towns stay hidden; charted land you can't currently see is dimmed |
| Exploration | Send up to three expeditions (Military panel → click a place on the map); they steer along coasts and cross the sea once you know Sailing. Exchange maps in Diplomacy; trade partners and allies share maps every year. Discovering a realm is announced |

Phase 11 saves load in Phase 12 with fog of war off.

### Phase 13 — A cosy fantasy pixel look

Inspired by the general style of modern fantasy and medieval pixel games (hand-crafted tiles, outlines, warm palettes, lots of small life) — all art is original and generated in code.

| Area | Implemented |
|---|---|
| 16×16 terrain | Zoomed in (1.8× and closer) the world is drawn from a 16×16 tileset — twice the pixel density of the overview map. Each biome has its own textured ground (tufts and flowers, dune ripples, lichen, marsh pools), biomes blend with dithered edges, coasts have wet sand and foam that follow the shoreline pixel by pixel, the sea darkens smoothly with depth, and rivers run in banked channels |
| Standing objects | Outlined, shaded sprites with drop shadows: oaks (with apples), birches, pines, palms, jungle trees, bushes, rocks, rounded hills, varied mountain peaks with snowcaps, reeds, cacti, dead trees, wildflowers — sorted so taller things overlap what is behind them |
| Seasons | Blossom in spring, full green in summer, orange and red forests and golden grass in autumn, bare branches, snowy pines and a ragged snow line in winter; rivers and lakes freeze where the ground is snowy |
| Buildings | Redrawn at 16×16 (32×32 for town halls, castles, star forts and universities) with a style per race: half-timbered cottages and stone townhouses (humans), leaf-roofed tree-houses and white towers (elves), rune-doored stone halls (dwarves), hide huts and spiked longhouses (orcs), stilt huts and jade step-shrines (lizardfolk), hill burrows with round doors and gardens (halflings). Markets with striped awnings, temples with stained glass, mills with smoking chimneys, piers with boats, mine mouths with carts and more. Fields show furrows and crops that change through the year |
| Characters & animals | Animated 8×11 sprites with walk and work frames: villagers by job (farmers with hoes, woodcutters, miners, merchants, priests, guards, nobles, children) and race (elf ears, dwarf beards, orc tusks, lizardfolk snouts and tails); soldiers with helmets, shields in their realm's colour, bows and guns; cavalry on horses (knights on armoured greys); deer, boars, goats, wolves, bears, sheep and cows |
| Light & mood | Warm colour grading by day, amber dusk and dawn, a soft vignette, flickering torches at halls, castles, temples and markets at night, lit windows |
| Interface | Wooden frames with brass rivets, parchment panel headers, parchment tooltips and notices, wooden buttons |
| Performance | Terrain chunks are baked a slice at a time (≤ ~10 ms per frame) and cached; drawing stays at 1–6 ms per frame at every zoom. New settings: high-detail tiles, colour grading |

### Phase 14 — Balance, unique provinces, developing markets, faster controls

| Area | Implemented |
|---|---|
| Regional resources | Deposits now cluster by geology and climate and are rarer but richer: iron belts and gold in the mountains, coal basins, gems and marble seams, vineyard slopes in warm hills, salt flats, spice groves in the tropics, horse steppes, fertile river valleys, fishing banks offshore. New deposits: coal, spices, gems, wine, salt, marble. (Applied on top of each map with its own random stream, so maps and provinces are unchanged.) |
| Province traits | Each province can have up to three: Fertile Valley, Rich Vein, Trade Crossroads, Holy Site, Marshland, Barren Land, Timberland, Fishing Banks, Natural Harbour, Highlands, Open Steppe — boosting yields, adding or capping building levels, adding or removing slots, taxes, trade, defense or stability |
| Building rules | Buildings need the right land: mines need ore, quarries rocky land or marble, plantations spice groves, jewellers gold or gems, lumber camps woodland, farms workable soil. Each settlement has limited building slots (3/5/7/9/11 by size; farms, walls, roads, granaries, warehouses, aqueducts, halls and castles are free), so towns specialise. The Construction panel shows slots, traits, deposits, three suggested buildings and what is impossible here |
| Market tiers | Market levels are tiers — Local Market, Market Hall, Trade Fair, Exchange — each steadying prices and unlocking more trade |
| Trade routes | Open and upgrade routes with linked realms: caravans → road convoys → merchant fleets (need market tiers, The Wheel, Sailing and harbours). Routes multiply trade capacity; unrouted links trade only a little |
| World market | From the Renaissance, realms with a harbour and a Trade Fair join a sea-borne world market that evens out prices and moves surpluses to shortages |
| Merchant companies | Charter up to three companies for goods you export (Market Hall needed); they earn monthly profit from exports and widen trade |
| Anti-snowball | Realms beyond their administrative reach lose efficiency and suffer "Sprawling realm" unrest; in tests the largest realm keeps about a quarter of all settlements and all realms survive 150 years |
| Calmer pace | Speeds are now ½, 1½, 4, 10 and 30 days per second (speed 1 ≈ 12 minutes per year) |
| Difficulty | Easy / Normal / Hard on the new-game screen (bonuses for you or the AI, default disaster rate) |
| Faster controls | Right-click the map (with no army selected) for a quick-action menu; **/** or **Ctrl+F** search; **B** build here, **N** next idle settlement, **Tab** cycle settlements, **Q** cycle armies, **F** follow an army |

Old saves load in Phase 14; their deposits and province traits are redistributed.

### Phase 15 — Learn to play, score, clearer feedback, wars with a purpose

| Area | Implemented |
|---|---|
| Learn to play | A **📜 Learn to play** button on the start screen opens a small, easy world with a guided tutorial card: 14 steps that check themselves off (unpause, research, build, read the overview, grow, expand, become a kingdom, open a market, trade, raise an army, debate a law, use the encyclopedia), with the relevant button glowing |
| Encyclopedia | Press **I** (or the game menu): a searchable reference built from the game's data — guides to every mechanic, plus goods, professions, buildings, deposits, province traits, laws, interest groups, character traits, lifestyles, units, technologies, monuments, disasters and god powers |
| Score & ranking | Score from land, population, wealth, technology, military, culture and dynasty; your rank sits in the top bar; a Score column in the Ledger and Trends; **Score & summary** in the game menu (and when your realm falls) shows the breakdown, the score race of the great realms, the ranking and moments of your reign |
| Overview | Press **V**: rank, treasury, stability trend, population growth, living standard and research at a glance; a "Needs attention" list with one-click fixes (idle towns, no research, famine, losses, unrest, movements, plots, demands, offers, missing heir); construction in every town with a suggested build; market shortages and surpluses; recent events |
| Map feedback | Your settlements show status markers on the map (🔨 progress, 💤 idle, ⚠ unrest, 🍞 hunger, ☣ plague, 🏰 siege, ⚑ occupied); things that happen to your realm float briefly over the place they happen |
| Wars with a purpose | AI realms weigh every neighbour each year: the best objective (a border town worth having — above all for deposits or traits they lack — a blood claim, a rival to humble, a rich neighbour's gold, vassalage of the weak), their power with allies against the target's, and their readiness (treasury, stability, exhaustion, recent wars). They act only when it is worth it, and say why: "demands the surrender of Narkrag — for its rich vein" |

### Phase 16 — Visual patch: atlas, organic towns, roads & rivers, atmosphere, menus

| Area | What changed |
|---|---|
| Atlas zoom-out | When you zoom far out, the world turns into an illustrated parchment map: watercolour lands, inked coasts with ripple hatching, mountain, hill and tree glyphs, ink rivers, sea serpents and a compass rose. It can be turned off in Settings (Atlas map) |
| Organic towns | Winding lanes run out from the town centre, with a round plaza and a well or fountain in larger places. Houses sit off the grid, and walls follow the town edge. Each people builds its own way: elves scatter among trees, dwarves pack tight blocks, orcs ring a central fire, halflings spread over the hills and lizardfolk cling to the water |
| Roads & rivers | Roads wind smoothly and change with the era: dirt tracks, then cobbles (era 2), then paved roads (era 3+), with bridges where they cross rivers. Rivers meander, and waterfalls foam where they drop from the hills. On the atlas, roads become dashed ink tracks |
| Borders | Realm borders are painted with soft edges, and small banners mark the frontier when you zoom in |
| Atmosphere | Brighter, cosier days. Deep blue-violet nights with a darker vignette and stronger candle and torch glow. Drifting fog banks at dawn, in autumn and at night |
| Menus | The title screen shows a slowly drifting atlas of a random world behind the menu. The top bar groups resources into Realm, Goods and Learning |

### Phase 17 — Living stories, battles & sieges, translations

| Area | What changed |
|---|---|
| Rulers who remember | Every realm remembers what others did to it: wars declared, towns taken, alliances betrayed, humiliations, gifts and help in war. Memories fade over decades, slower under a vengeful ruler and faster under a forgiving one. Rulers' traits set their temperament (warlike, vengeful, loyal, treacherous, greedy), which shapes war plans, grudges and whether allies answer the call. AI realms now go to war to retake lost towns or to avenge old wrongs. The Diplomacy panel shows each ruler's temperament and what each side remembers |
| Event chains | Stories unfold over months and years with choices that lead somewhere: *The New Creed* (a preacher, a martyr, a reformation), *The Pretender* (a lost heir, a trial, a revolt), *The Far Expedition*, *The Great Sickness* and *The Beast* (a monster and the hero who slays it). The event window shows which story you are in |
| Heroes & legends | Rarely, a general, sage, saint, adventurer or architect rises. They give the realm a bonus, do deeds that enter the chronicle, lead your largest army in wartime (generals) or bring hope to suffering neighbours (saints). When they die, their legacy lasts about a century. They are listed in the Court panel |
| The Chronicle (J) | An illustrated book of your realm's history: one chapter per reign, with pixel vignettes for wars, crowns, heroes, plagues, ships and cities, the heroes of each age, and what happened meanwhile in the world |
| Battles & sieges | Close up, armies fight in formation: an infantry line, archers behind, cavalry on the wings and engines at the rear, closing in over the first days. Beaten armies flee in disorder. Besiegers pitch a camp of tents with siege engines or rams, stones fly into the town, the walls breach on the besiegers' side and the town burns. At sea, fleets trade broadsides, ships burn and wreckage drifts |
| Battle reports | Every major battle gets a report (Military panel) with the commanders, forces, losses and why it was won: numbers, generalship, terrain, walls, river crossings, cavalry on open or rough ground, archers in the woods, a newer age of weapons, stance and morale |
| Translations | Ukrainian alongside English (Settings → Language). Everything is translated: menus, panels, tooltips, the tutorial and encyclopedia, descriptions of races, buildings, technologies, laws and units, every event and story with names filled in, and the messages in the log and chronicle. Names of people, towns and realms stay as generated, but their titles are translated ("Королівство X", "Племена X"). The Ukrainian text lives in `src/ui/lang-uk.js` and `src/ui/lang-uk-events.js` |
| Settings & keys | Every hotkey can be rebound (Settings → Key bindings). Low, Normal and High graphics presets. A colour-blind-friendly map palette (blue and orange instead of green and red) |
| Speed & stability | Autosaves rotate through three slots without copying, so the newest good save is never overwritten. Every save is read back after writing, and damaged saves are detected on load. After an internal error the game writes a rescue save |
| Fix | The Phase 16 title backdrop no longer covers the start menu |
| Fix | Realms born at the end of a month (for example a pretender's revolt from a story chain) could stop the simulation at the month's trade step. New realms now always start with empty monthly figures |

### Phase 18 — The pixel grid: square roads, grid towns, tile walls

| Area | What changed |
|---|---|
| Roads & streets | Roads and town streets are square path tiles that snap to the grid: straight runs, right-angle turns and crossroads that join their neighbours. They are dirt, then cobbles (era 2), then paving (era 3+), with plank or stone bridge tiles over rivers and water. Zoomed out they are square tracks; on the atlas, dashed square lines |
| Grid towns | Every building sits on whole tiles. Halls, castles and universities take 2×2 tiles, and nothing overlaps. Clean yard ground covers trees and rocks under buildings. Homes prefer spots beside a street. Only small props (barrels, crates, wood piles, flowers, lamp posts) sit slightly off the grid for variety. Larger places get a paved square with a well or fountain |
| Walls & gates | Walls are pixel wall pieces along tile edges with corner towers, and a gate wherever a street or road leaves town. The outline is smoothed so walls run in long straight stretches. Besieged walls break open on the attackers' side |
| Each people's towns | Elves live in treehouses in the forest, joined by rope bridges. Dwarves dig homes into hills behind stone doors. Orcs pitch hide tents inside wooden palisades. Lizardfolk raise stilt huts over the shallows, joined to the shore by boardwalks |
| Farms | Fields are fenced plots that change with the seasons, with the odd scarecrow |
| Armies | Armies at rest pitch a small camp (tents, a fire, the banner and two guards) instead of standing in a block |
| Crisp effects & labels | Rings, cursors and markers are drawn with square pixels, not smooth circles. Town names no longer overlap: the most important are placed first, others shift up or down or are hidden when crowded, and your own towns always keep their names |

## Possible next steps

Playtest-driven balancing (especially the Phase 8 economy), a tutorial and encyclopedia, code signing & auto-updates for the desktop builds, multiplayer on top of the deterministic simulation, a tutorial and in-game encyclopedia.

## Fixes after Phase 18 (early game & slimmer roads)

- **Wood no longer runs out at the start.** Lumber camps can be built when there is woodland in the province *or in a neighbouring one* (timber is hauled in at half yield). Idle peasants also gather a little brushwood everywhere.
- **Camps can grow into villages.** Tribal camps raise huts of hide, turf and reed for free, so a camp is no longer stuck at ~50 people for lack of wood; it reaches 60 and becomes a village, and can send settlers (needs 45 people).
- **Slimmer roads and walls.** Roads are a narrow track down the middle of the tile, streets slightly wider; bridges, stone walls, palisades, towers and gates are thin lines along tile edges.
- **Crash fix:** realms born mid-month (civil wars, pretenders) now start with a market, which fixes an occasional "Internal error in simulation".

## Phase 19 — the late game

**Gold keeps its meaning**
- **Administration:** a realm with more settlements than its administrative reach pays a share of taxes and trade (up to 40%) for governors, clerks and courts. Town halls, laws, the cabinet and a Grand Palace raise the reach.
- **Inflation:** a treasury of more than six months' income drives prices up (up to +50% on every gold cost). Spending or investing brings it back down. Shown in the Economy panel.
- **Great Works** (Economy panel): Grand Canal, Cathedral, University, Grand Palace, Harbour Works, Boulevards & Parks and the World's Fair. Each is built in a town of your choice, every town can host each work once, and the World's Fair can be held again every 40 years. Costs grow with your income, and each further work of a kind adds less. Finished works stand in town as 2×2 landmarks.
- **Smarter AI spending:** the AI builds great works, pours part of large hoards into them, and subsidises struggling allies.

**A world that keeps moving**
- **Ambitions:** AI realms set themselves a goal that lasts decades: take a certain town, humble a rival or dominate a neighbour. They will fight for it even at near-equal strength. A realm's ambition shows in the Diplomacy panel.
- **Coalitions:** when one realm holds about a quarter of all settlements, its worried neighbours ally against it and strike when together they are strong enough. You may be invited to join, or be the target.
- **World crises** from about year 90, every 30–50 years: a Great War between the great powers, a Revolution in a big unstable realm, the Great Pestilence, the Great Crash (rich treasuries lose a third) and the Great Schism of a faith.

**Pace and balance**
- Research speeds up in later eras (+15% / +45% / +80%), and big realms pay a little less extra per tech, so the whole tree is reached in about 200 years.
- Dwarves are stronger: −5% food and growth instead of −15%.
- Young realms (one or two settlements) see about one event a year from 12 new early events: wanderers, wild herds, caravans, wolves, fallen timber, the first harvest and more.
- **Less sprawl:** big towns show fewer houses and build tall 2–3 storey town houses instead, and the fields around a town are capped.

**Tests** now live in `tests/`:
- `node tests/balance.mjs [seed] [years] [race]`
- `node tests/determinism.mjs [years]`
- `node tests/starts.mjs`
- `tests/shots-phase19.js`, the Electron screenshot script.

## Phase 20 — graphics overhaul

The overhaul runs in five stages:
- **A.** Foundation
- **B.** Terrain and water
- **C.** Buildings, people and animals
- **D.** Atmosphere and light
- **E.** Interface and world map

The look follows the time of day: bright and bold by day, warm and painterly at dawn and dusk, moody and glowing at night.

**Stage A: foundation (done)**
- **One pixel size:** close up, zoom rests only on steps where each art pixel covers a whole number of screen pixels, and the camera glides between them. The camera also lands on whole pixels, so nothing shimmers. Camp tents and children were redrawn to the shared 16 px per tile grid.
- **Coloured outlines:** sprites are outlined with a dark, violet-leaning shade of their own colour instead of black.
- **Sun shadows:** buildings, homes and landmarks cast shadows away from the sun. The shadows are long and sideways in the morning and evening, short at noon, and faint at night. You can turn them off in Settings.
- **Colour moods:**
  - Day: richer colour and contrast.
  - Dawn: gold.
  - Dusk: rose light with violet shadows.
  - Night: cool blue, with warm lights.
  - The richer colours can be turned off in Settings.
- **Crisp realm borders:** borders are drawn with whole pixels, with no blurry half-pixel strips.
- **Art slots:** any sprite can be replaced by a hand-drawn PNG. See `art/README.md`. `art/slots.json` lists all 505 slots with sizes and templates.

**Stage B: terrain and water (done)**
- **Painted ground:**
  - Ground is shaded through five-tone colour ramps with ordered dithering.
  - Large soft patches, medium clumps and the slope's light replace per-pixel noise.
  - Grass gets scattered blades.
- **Organic biome edges:** each pixel's biome comes from a tile grid warped by two layers of smooth noise. Forest, grass, plains, desert and snow meet in hand-drawn-looking curves instead of tile squares.
- **Height:** slopes are lit from the upper left. Mountains are shaded rock with lit crests and shadowed ridge backs. Peak sprites stand only on the high summits, and hills have fewer mounds.
- **Marshes:** smooth pools with muddy rims and sky glints replace the old 4×4 blocks.
- **Ground detail:** grass tufts, pebbles, forest mushrooms (more in autumn) and lily pads on lake shallows.
- **Water:**
  - Depth falls in dithered bands from turquoise shallows to navy deeps, with light ripples of sand under the shallows.
  - Trees and rocks on the water's edge are mirrored in it.
  - Buildings on the shore, or on stilts, have rippling reflections.
  - Fish swim and now and then leap with spreading rings.
  - Coastal foam moves in whole pixels.
- **Borders** are quieter close up.

**Stage C: buildings, people and animals (done)**
- **Townsfolk at town scale:**
  - People are 7×9-pixel figures, about half a house tall, with walk and work frames.
  - At home or visiting they go indoors instead of standing at doors, and only people in the town square stay out to chat.
  - They walk along the streets in right-angle legs, and start out either indoors or on their way to work.
  - Soldiers and riders use the same scale.
- **Farm animals:** sheep, cows and horses are smaller and lower their heads to graze. Hens peck in the side yards, and a dog trots after the townsfolk (humans, halflings, dwarves, orcs).
- **Houses:**
  - Roofs come in three tones (the race's own, weathered, slate or moss), so streets match without looking identical.
  - Snow settles on roofs in winter.
  - Hearth smoke rises all year, thicker in winter.
  - Washing lines sway in some yards on fair days.
- **Windmills:** farming towns with two or more farms get a windmill whose sails turn.

**Stage D: atmosphere and light (done)**
- **Cloud shadows:** close up, the clouds' shadows sweep over land and sea (the clouds themselves only show further out).
- **Sunbeams:** shafts of warm light slant through the air in the golden hours. They come from the east in the morning and the west in the evening, and can be turned off in Settings.
- **Dawn mist:** mist pools over marshes, rivers and lake shores in the early morning.
- **Night:**
  - Fireflies drift and blink over grass, forest and marsh on summer nights, each with a tiny green glow.
  - Stars twinkle on calm open water.
  - Town and window lights glow as before.
- **Fire:**
  - Wildfires show flickering flame tongues across their whole reach, with scorched ground, rising embers and dark smoke.
  - Besieged towns have roofs ablaze, more as the siege goes on.
  - Smoke is drawn as round, dithered pixel puffs instead of squares.

**Stage E: interface and world map (done)**
- **Illustrated world map** (zoomed far out):
  - Drawn at twice the detail, with richer watercolour washes, relief light on the land and a sheet that darkens at its edges like old paper.
  - The sea deepens in bands away from the shore, with ripple lines and a pale shallow rim, and the coast is inked twice.
  - Mountain ranges have sunlit faces and snowy peaks. Forests are tree clusters, and hills, marsh reeds, dunes and grass tufts are inked.
  - Sea serpents, whales and sailing ships appear in the open sea.
- **Ribbon name tags:** towns are named on parchment ribbons with tails in the realm's colour, and capitals carry a little crown.
- **Fewer labels:** camps are named only close up, villages from mid zoom, and towns and capitals further out. Your own towns always keep their names.
- **Wood and parchment interface:**
  - Panels and dialogs sit in a carved pixel wood frame with brass corner studs, over dark plank texture.
  - The top bar and menu buttons are wood planks, and buttons and cards have crisp pixel bevels.
  - Event pages are parchment letters.
  - The textures are drawn by code at start-up (`src/ui/skin.js`).
- **Sea colours** on the simple map now match the close-up sea, so there are no seams while terrain fills in.

## Phase 21 — sound, depth and polish

**Sound and music**
- **Soundscape:** what the camera sees and the time of day shape the sound.
  - Wind gusts, stronger far out, on heights and in storms.
  - Surf swells along the coast.
  - Birdsong by day, busiest at dawn.
  - Crickets on summer nights, and owls in night forests.
  - Rain.
  - The murmur, hammers and bells of a town close up.
  - Crackling fire near wildfires and sieges.
  - It has its own volume slider in Settings.
- **Music:**
  - A quieter night theme with a harp answering the melody.
  - Each people has its own early-era voice: elven harp, lizardfolk marimba, dwarven horn, halfling lute, and orc war drums even in peace.
- **Audio slots:** `audio/manifest.json` can name real recordings for any music mood, ambience layer or sound effect, and anything not listed stays generated. See `audio/README.md`.

**Gameplay depth**
- **Trade on the map:**
  - The Economy panel has a Trade Routes card for opening and upgrading caravan routes.
  - Caravans, convoys and merchant ships travel between the capitals on the map.
  - War and unrest invite raiders, who cut a route for months and leave a burnt-out cart.
  - An escort makes raids rare, and the AI escorts in wartime.
  - A new Trading Post building adds +12% trade.
- **Missions** (new panel, key **U**): up to three goals that fit the realm right now, such as growing a village, a second settlement, a city, opening trade, an alliance, an army, a new era, a great work, full granaries or stability. Each has a reward.
- **Decisions:** eight great one-time choices: codify the laws, found a holy order, the King's highways, a great tournament, found an academy, move the capital, unite our people, and open the gates.
- **Court intrigue:**
  - The Court panel has schemes run by your best schemer: spy network, sow discord, steal knowledge and incite revolt.
  - Each scheme has a chance to stay hidden, and caught agents anger the target.
  - Spy reports appear in Diplomacy, and AI realms scheme against their rivals.
- **Advisor:** a portrait card that reads the realm and suggests what to do next, most urgent first. Click it to open the right panel; it can be hidden in Settings.

**Polish**
- Terrain keeps the old season until the whole view of the new one is ready, then switches at once, and the coming season is pre-painted.
- Cloud shadows are soft and feathered.
- Mornings are clear except in autumn.
- Stars on the water are brighter and twinkle.

**Balance and onboarding**
- AI realms leave a small young player realm (3 settlements or fewer) alone for 60 years (90 on easy), unless there is real bad blood or overwhelming strength.
- Lizardfolk are steadier: +18% food, +12% growth, −10% knowledge.
- New tutorial steps (open a caravan route, follow your missions) and new encyclopedia guides: great works, inflation and administration; ambitions, coalitions and crises; trade routes; missions and decisions; schemes; the advisor.

**Project:** now under git (`main` branch).

## Phase 22

**Bug hunt:** `tests/bughunt.js` plays long games while clicking every enabled button, changing selects, switching language and checking the state for broken numbers. Three seeds, about 6,800 clicks across 61 kinds of action and up to 136 game years: no errors found.

**Graphics card terrain** (hybrid WebGL)
- From zoom 2 inward, a shader on the graphics card paints the ground and water every frame, with the same look as before: painted dithered ground, wandering biome edges, lit slopes and ridges, marsh pools, snow, banded water, wet sand and surf.
- It renders once per art pixel and is scaled up crisply.
- Terrain no longer pops in when you pan, and the water moves: drifting wave strokes, shimmering shallows and pulsing surf.
- Trees, rocks and rivers are still baked, now in half the time, and drawn on top.
- Far out, the cached terrain is still used because it's cheaper there.
- It can be turned off in Settings.

**Side-view scenes:**
- **🔭 Visit** (on any town's panel) opens the town as a wide painted side view at pixel-art resolution, scaled up crisply:
  - The sky, sun, moon, stars and clouds follow the hour.
  - Mountains and hills drift with the camera.
  - The town's own buildings stand in a row in its people's style: half-timbered houses (taller in cities), orc tents, town hall, castle, temple, market stalls, library, granary, barracks, harbour crane, mine, lumber yard, windmill.
  - Walls appear if it has walls, and boats if it's on the coast.
  - Townsfolk and a cart pass by, chimneys smoke, it rains or snows, and windows and lamps glow at night.
  - Drag to look along the town; Esc closes.
- **⚔ Watch the battle** (in a battle report) shows the two armies meeting: infantry with shields and spears, archers loosing arrows, cavalry, muskets smoking in later eras, the dust of the melee, the fallen, the rout and who held the field.

**The Modern era** (fifth era, after the Industrial era; needs 5 Industrial techs):
- **Techs:** Electricity (+20% knowledge, +10% production), Telegraph (+2 administration, +10% taxes), Mass Media (+5 stability), Modern Medicine (+20% growth, +15% housing), Combustion Engine (+30% build speed, +10% gold) and Machine Guns (+60 defence).
- **Buildings:** Power Plant and Newspaper.
- **Units:** Regulars (machine-gun infantry) and Howitzers.
- Research runs faster in this era (×2.2).
- In test games, realms reach it around years 150–200.

**Religions and holy wars:**
- **Holy sites:** each old faith has two sacred provinces, marked on the map with a small shrine in the faith's colour. Holding your faith's sites gives +3 stability each, and losing them to unbelievers costs stability.
- **Head of the faith:** the realm with the most devotion (holy sites, faithful towns, temples) leads the faith (+4 stability) and alone may call a holy war.
- **Missionaries** carry faiths from temple towns into restless towns across the border.
- **Holy wars:** the head of a faith calls the faithful to retake a holy site held by unbelievers, and co-religionists join the war. At most one holy war per faith every 25 years; the AI calls them too.
- **Reform the Faith:** a decision from the Renaissance that founds a Reformed faith (+8% knowledge) at −15 stability.
- The faith card in the Government panel shows all of this.

**Creatures and hero quests:**
- **Creatures:** dragons, giants, trolls and wyverns keep lairs in the wild, away from towns. You can see them on the map, a dragon circling over its cave.
- **Raids:** creatures raid nearby towns, killing people and carrying off gold to their hoard; dragons set fires. Walls, castles and nearby armies drive them off.
- **Storming a lair:** march an army onto it to storm it and win the hoard.
- **Quests:** in the Court panel, heroes can be sent to:
  - Slay the Beast: its hoard, and a chance of an artifact (best odds with a dragon).
  - Seek Lost Treasure: gold, and a small chance of an artifact.
  - Search the Ruins: research.
  - Success depends on the hero's kind and past deeds. Heroes may never come back.
- **Artifacts:** six legendary artifacts with permanent bonuses: the Sunblade, Crown of Ages, the Star Atlas, Horn of Plenty, the Golden Scale and the Dragon-bone Bow.
- New beasts move into empty wilds over time, and AI heroes go questing too.

**Readability and accessibility:**
- **Settings:** text size (Small, Normal or Large), High contrast (solid panels, brighter text, firmer lines) and Reduce motion (no screen shake, flashes or panel animations).
- **Easier to read:** secondary text is brighter, and tooltips are larger with more line spacing.
- **Small screens:** on narrow windows the realm subtitle and resource deltas hide, and the left menu shrinks to icons. The advisor moves up on short screens.
- **Fix:** inflation now only applies to real hoards (above 1,500 gold plus 400 per settlement), so small young realms saving up are no longer charged +50% prices.
