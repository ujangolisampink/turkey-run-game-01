# Gobble Run — The Great Thanksgiving Escape

[![Make.fun bounty](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01)
[![Rank](https://make.fun/badge/turkey-run-game-01/ujangolisampink/turkey-run-game-01/rank.svg)](https://make.fun/bounty/turkey-run-game-01)
[![Reward](https://make.fun/badge/turkey-run-game-01/ujangolisampink/turkey-run-game-01/reward.svg)](https://make.fun/bounty/turkey-run-game-01)

A 3D endless-runner game for the [Make.fun bounty "Make the best turkey escape game"](https://make.fun/bounty/turkey-run-game-01).

You are the turkey. Thanksgiving is coming, the farmer is right behind you,
and the farm is full of ovens, carving knives, hay bales and fences. Run
1000 metres down the farm lane to the forest and you are free — lose all
3 lives, or let the farmer catch you, and you are dinner.

## How to play

- **Left / Right** (or A / D): switch lane. Click the left or right side of the screen to steer.
- **Up / Space**: jump over hay bales, fences and pumpkins.
- **Down / S**: slide under the swinging carving knife.
- **P**: pause. **M**: mute.
- Grab **corn** (+50 points, and it buys distance from the farmer) and
  **cranberries** (+25). The oven is too hot to jump on — change lane.
- The farmer never stops gaining: keep running clean and keep grabbing corn.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files
(Three.js is vendored under `game/vendor/`; the four farm textures under
`game/assets/` are AI-generated photographs).

## Layout

- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — the page, HUD and menus.
- `game/src/` — the game, one job per file: `config.js` (tuning), `random.js`
  (seeded PRNG), `input.js` (keyboard + pointer), `audio.js` (procedural
  WebAudio effects), `world.js` (the scrolling autumn farm), `entities.js`
  (turkey, farmer, hazards, pickups), `main.js` (loop, states, collisions),
  `shots.js` (screenshot staging with an autopilot).
- `screenshots/` — four real renders of the game's own code.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT. See [LICENSE](LICENSE).
