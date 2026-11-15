# Audio slots

Living World makes all of its sound in code. Any part can be replaced with a recording: put the file in this folder and name it in `manifest.json`.

| Group | Slots | How it plays |
|---|---|---|
| `music` | `menu`, `peace`, `war`, `night` | Loops while that mood lasts, and crossfades when the mood changes |
| `ambience` | `wind`, `surf`, `birds`, `night`, `rain`, `town`, `fire` | Loops quietly. Each layer's volume follows what the camera sees and the time of day |
| `sfx` | `quake`, `meteor`, `lightning`, `fire`, `eruption`, `plague`, `bless`, `curse`, `flood`, `wind`, `click`, `build`, `research`, `war`, `battle`, `victory`, `defeat`, `event`, `toast`, `coin`, `era`, `settle`, `ship`, `birth` | Plays once |

Example:

```json
{ "music": { "peace": "music/village-morning.ogg" }, "ambience": { "surf": "amb/waves.ogg" }, "sfx": { "coin": "sfx/coin.wav" } }
```

Use only recordings you have the rights to.
