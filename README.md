# PORT SOLARA — An Open-World Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sheeran154/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sheeran154/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**PORT SOLARA** is a complete, original open-world crime game in the spirit of GTA 6, built from scratch for the make.fun "Make GTA 6" bounty. You are Jace "Jay" Moreno, a getaway driver back in his hometown of Port Solara — a sun-soaked coastal city of downtown towers, a harbor, a beach, and the Barrio Sol. You owe the Marlin Club, and the only way out is six jobs: stealing cars, wrecking rivals, running packages, losing the heat, and one last bank job.

Everything is 100% original: our own city, characters, vehicles, names, story, art, and music. Nothing from Rockstar's GTA series or any other commercial game. All sound is synthesized live with WebAudio — no audio files, no network requests.

## How to run

```sh
node serve.ts
# then open http://localhost:8080
```

Or serve `game/` with any static file server. The game is plain static files — no build step, no network.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| SHIFT | Run |
| E | Enter / exit car · interact (meet Sal, grab the cash) |
| Mouse | Aim |
| Click | Shoot |
| SPACE | Handbrake |
| M | Phone — job list (ENTER starts the next job) |
| ESC | Pause (save game there) |

## Features

- **A living city to explore** — Downtown, Port Harbor, Solara Beach, Barrio Sol, North Industrial, Marina District and Old Town, with traffic, pedestrians, parks, docks and a beach.
- **Cars to steal and drive** — 7 car types with arcade handling, drift and handbrake; steal a traffic car and the driver flees.
- **Wanted level** — 0–5 stars. Crimes raise the heat; Solara PD sends cruisers that chase and ram you, and officers on foot who run you down. Stay clean and the heat bleeds off.
- **Missions and a story** — six jobs with briefs, markers, and cash rewards, from "Welcome Back" to "The Big Score" bank heist.
- **Combat** — pistol and SMG pickups, muzzle flash, explosions, pedestrians who flee gunfire.
- **HUD with minimap** — cash, health, wanted stars, objective banner, live minimap with mission marker, cops and the player arrow.
- **Save** — progress (cash, missions, position) saves to localStorage; autosaves after every mission, plus manual save in the pause menu. Continue from the start screen.
- **Sound** — synthesized engine hum, two-tone police sirens, gunshots, explosions, pickups, and a looping bass groove. No audio files.

## Structure

- `game/index.html` — page + canvas
- `game/src/main.js` — game loop, player, camera, missions, wanted, saves
- `game/src/city.js` — the city: roads, buildings, districts, landmarks
- `game/src/vehicles.js` — car physics, traffic AI, parked cars
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — wanted level, cop cars, foot officers
- `game/src/combat.js` — shooting
- `game/src/missions.js` — the six story jobs
- `game/src/render.js` — world drawing
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — WebAudio synthesis
- `game/src/effects.js` — particles, skid marks, floating text
- `game/src/input.js` — keyboard + mouse
- `game/src/save.js` — localStorage saves

## License

MIT — see LICENSE.
