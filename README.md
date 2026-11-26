# TokenFall

An HD-2D pixel-art game set in the Calfus offices, for learning AI literacy. Plain HTML + JavaScript, rendered with [Three.js](https://threejs.org/) r128 (loaded from a CDN). No build step.

## Run it

```
npm run dev
```

(That runs `tools/dev-server.py`, a plain Python file server that tells the browser not to cache, so a normal refresh always shows your latest edits; there are no dependencies to install.)

Then open http://127.0.0.1:8765/. Opening `index.html` directly from disk works too.

Handy URL options: `?zone=lab` (or `pune`, `abz`, `bridge`, `airport`, `us`, `blr` (the Bengaluru office), `archive` (the airport's baggage hall), `kitchen`) starts in an area and skips the launcher, `?at=x,z` starts at a position, `?board=sample` fills the leaderboard with sample rows, `?intro` replays TOKEN-1's first-meeting intro even after you joined.

Every `npm run dev` start is a fresh game: the first page load after a restart clears saved progress (TOKEN-1, parts, Glitch Log, minigame progress and tips) and shows the title screen again; refreshes during the same run keep progress, and settings (sound, music, large text, daylight) always stay. Other ways of serving the page never clear anything.

## Layout

```
index.html          page shell: HUD markup and the script list (load order matters)
css/game.css        HUD and UI styles
music/              background tracks (royalty-free); music.js TRACKS maps zones to them
css/token1.css      TOKEN-1 portrait, accuracy ring, speech bubble, cards and toasts
launcher/           start screen (retro PC → menu); start.js holds the game until Enter, ?zone= / ?at= skip it
js/game/            the game, one file per system (classic scripts sharing one global scope)
  setup.js            renderer, scene, camera views, seeded random
  textures.js         pixel-art canvas textures
  geometry.js         mesh helpers + world registries (colliders, walkable areas, interactables, portals, lights)
  props.js            trees, bushes, lamps, benches, signs
  buildings.js        lobby buildings, gates, the ABZ tower, bikes, street lights
  crescent-bay.js     Calfus at 35 Crescent Bay, Balewadi, measured off the team's photos: the glass front on its 1.24 m module, the stack parkers, the EV bay, the lobby and lift (up to the HQ floor), the gates, the two-wheeler row, the service alley
  portals.js          water and the teleporter pads
  river.js            the lobby river: flowing water shader, leaves, fish shadows, ten kinds of leaping fish, the waterfall off the island (tested: river-tests.js)
  arch-bridge.js      the stone footbridge over the river, paved with the road's own stones
  lobby-village.js    the lobby: a village of homes, plaza, roads, river, pond, the minigame lawn
  station.js          the railway station north of the river: platform, station house, footbridge, the Bengaluru Express (a steam locomotive and four coaches: board it to travel)
  village-ai.js       AI set pieces: TOKEN-1's body, neural-net sculpture, ticker, model servers, art wall, robot dog
  game-events.js      minigame start / answer / end, re-fired as TokenFall.on('game')
  token1.js           TOKEN-1: waits by the spawn until you accept its mission, then follows you; accuracy meter
                      (right +3, wrong -2) is the final score, saved in the browser
  token1-meter.js     the accuracy meter, its five repair stages and save/load (pure, tested)
  token1-follow.js    follow steering: slot behind the hero, wall sliding, snap when far or stuck, small while walking (pure, tested)
  music.js            background music: per-zone track (default everywhere for now), ducked in minigames, N toggles (M opens the lobby map)
  token1-lines.js     TOKEN-1's script: first-meeting dialogue, mission card, per-game how-to and its wrong "tips" (tested)
  token1-ui.js        TOKEN-1's HUD portrait, speech bubble, welcome/help cards, result toasts, fly-off to the HUD
  village-robots.js   robot arm, barista, chess table, sweeper, parcel lockers
  leaderboard.js      most-correct-answers board; games report through TokenFall.leaderboard.set
  areas.js            AREAS registry + placeholder shell
  office-kit.js       shared office pieces: desks, meeting rooms, sofas, garlands, faders
  office-hq.js        Calfus HQ office (zone "lab")
  office-abz.js       ABZ office (zone "abz"), 15th floor
  build-areas.js      builds the HQ and ABZ offices, the airport, the US office, then Pune
  airport.js          Pune Airport (lobby's west gate): check-in, departures board, Gate 7 to the US office
  office-us.js        Calfus US office, Pleasanton: window desks, logo wall, ping-pong, kitchen, meeting rooms
  office-blr.js       Calfus Bengaluru office (zone "blr", by train from the lobby): desk pods, Cubbon and Lalbagh rooms, filter coffee, the mural
  city.js             city pieces: apartments, bus stop, traffic lanes and signals
  pune.js             Pune: main road, the park, ABZ, khau galli, bike taxi (Crescent Bay itself: crescent-bay.js)
  effects.js          static batching, ambient life, dust, sun/sky
  grounding.js        contact shadows: a soft shade under everything that stands on a floor, so nothing looks like it floats
  characters.js       hero and NPC sprites, wandering
  ui.js               chat, dialogue, banners, keyboard
  post.js             tilt-shift, bloom, colour grade
  loop.js             zones and travel, camera, frame loop
  main.js             window.TokenFall API for modules, then boot
js/bridge/          The Glass Bridge minigame (plugs in through window.TokenFall)
js/carrom-*.js      House Rules Carrom (HQ carrom table)
js/jenga-*.js       Token Tower (lobby, by Home)
js/gallery-*.js     Spot Shot (lobby, by Home)
js/kitchen-*.js     Token Brew Kitchen (Token Brew's staff door: 5 orders, 3 taps each: pick the pot, add only what is needed, serve.
                    Add or change questions in js/kitchen-orders.js; `node js/kitchen-orders.js` checks the bank)
                    every minigame's tests: npm test
launcher/           the retro-PC start screen
js/sprites/         sprite player + Aditya's sheet
assets/             source sprite sheet
old/                earlier prototypes, not used
tools/              dev-server.py; bridge-patch.js and carrom-patch.js (historical records of the lobby.html integrations)
```

Files in `js/game/` see each other's functions and constants directly, so a new file only needs a `<script>` tag in `index.html` after the files it uses.

## Credits

- The station's locomotive is "Hogwarts Express - Locomotive" by [Nathaniel Onandia](https://sketchfab.com/nathanielonandia), from [Sketchfab](https://sketchfab.com/3d-models/hogwarts-express-locomotive-373a1594ecd24ee59f4517cb2d5a7b96), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Changed for the game: compressed by `tools/train-pack.mjs` (meshes joined, textures shrunk to WebP) into `assets/models/train-loco.glb`, recoloured a little in the game, and its lettering and crests redrawn as TokenFall's own (`station.js`). The original is `hogwarts_express_-_locomotive.glb`.
