# Art slots

Every sprite in Living World is drawn by code. Any of them can be replaced by a hand-drawn PNG.

1. Look up the sprite in `slots.json`. It gives the slot key, the size in pixels and a template image in `templates/`, which is the game's own code-drawn version to paint over.
2. Draw your PNG at exactly that size, or at exactly 2× or 3× (it is scaled down by whole steps). Use a transparent background.
3. Save it in this folder and add a line to `manifest.json`:

```json
{ "sprites": { "h:humans:2": "houses/human-house-2.png" } }
```

4. Restart the game. Any slot not listed stays code-drawn.

Notes:
- Slot kinds: `house`, `building`, `town` (paths, walls, race homes, landmarks), `nature` (trees, rocks, plants by season and variant).
- Hand-drawn art keeps its own outlines; the game does not add its coloured outline to it.
- Art density is 16 pixels per map tile. Keep that scale so every sprite shares one pixel size.
- To refresh the templates after code changes: `LW_SHOT=art LW_SHOT_SCRIPT=tests/art-export.js npx electron .`
