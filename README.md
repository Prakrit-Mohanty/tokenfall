# TokenFall

An HD-2D pixel-art game set in the Calfus offices, for learning AI literacy. Plain HTML + JavaScript, rendered with [Three.js](https://threejs.org/) r128 (loaded from a CDN). No build step.

## Run it

```
npm run dev
```

(That runs `tools/dev-server.py`, a plain Python file server that tells the browser not to cache, so a normal refresh always shows your latest edits; there are no dependencies to install.)

Then open http://127.0.0.1:8765/. Opening `index.html` directly from disk works too.

Handy URL options: `?zone=lab` (or `pune`, `abz`, `bridge`, `archive`, `kitchen`) starts in an area and skips the launcher, `?at=x,z` starts at a position, `?board=sample` fills the leaderboard with sample rows.

## Layout

```
index.html          page shell: HUD markup and the script list (load order matters)
css/game.css        HUD and UI styles
launcher/           start screen (retro PC → menu); start.js holds the game until Enter, ?zone= / ?at= skip it
js/game/            the game, one file per system (classic scripts sharing one global scope)
  setup.js            renderer, scene, camera views, seeded random
  textures.js         pixel-art canvas textures
  geometry.js         mesh helpers + world registries (colliders, walkable areas, interactables, portals, lights)
  props.js            trees, bushes, lamps, benches, signs
  buildings.js        lobby buildings, gates, Crescent Bay (Calfus), the ABZ tower, bikes, street lights
  portals.js          water and the teleporter pads
  lobby-village.js    the lobby: a village of homes, plaza, roads, river, pond, the minigame lawn
  village-ai.js       AI set pieces: TOKEN-1, neural-net sculpture, ticker, model servers, art wall, robot dog
  village-robots.js   robot arm, barista, chess table, sweeper, parcel lockers
  leaderboard.js      most-correct-answers board; games report through TokenFall.leaderboard.set
  areas.js            AREAS registry + placeholder shell
  office-kit.js       shared office pieces: desks, meeting rooms, sofas, garlands, faders
  office-hq.js        Calfus HQ office (zone "lab")
  office-abz.js       ABZ office (zone "abz"), 15th floor
  build-areas.js      builds the offices and the Data Archive, then Pune
  city.js             city pieces: apartments, bus stop, traffic lanes and signals
  pune.js             Pune: main road, Crescent Bay, the park, ABZ, khau galli, bike taxi
  effects.js          static batching, ambient life, dust, sun/sky
  characters.js       hero and NPC sprites, wandering
  ui.js               chat, dialogue, banners, keyboard
  post.js             tilt-shift, bloom, colour grade
  loop.js             zones and travel, camera, frame loop
  main.js             window.TokenFall API for modules, then boot
js/bridge/          The Glass Bridge minigame (plugs in through window.TokenFall)
js/carrom-*.js      House Rules Carrom (HQ carrom table)
js/jenga-*.js       Token Tower (lobby, by Home)
js/gallery-*.js     Spot Shot (lobby, by Home)
js/mill-*.js        Token Mill (Data Archive: a conveyor of crates to route by a sample policy)
js/kitchen-*.js     Prompt Kitchen (Token Brew's staff door: token saving and context management; kitchen-bots.js is test-only)
                    every minigame's tests: npm test
launcher/           the retro-PC start screen
js/sprites/         sprite player + Aditya's sheet
assets/             source sprite sheet
old/                earlier prototypes, not used
tools/              dev-server.py; bridge-patch.js and carrom-patch.js (historical records of the lobby.html integrations)
```

Files in `js/game/` see each other's functions and constants directly, so a new file only needs a `<script>` tag in `index.html` after the files it uses.
