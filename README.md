# TokenFall

An HD-2D pixel-art game set in the Calfus offices, for learning AI literacy. Plain HTML + JavaScript, rendered with [Three.js](https://threejs.org/) r128 (loaded from a CDN). No build step.

## Run it

```
npm run dev
```

(That just runs `python3 -m http.server 8765`; there are no dependencies to install.)

Then open http://127.0.0.1:8765/. Opening `index.html` directly from disk works too.

Handy URL options: `?zone=lab` (or `pune`, `abz`, `bridge`, `archive`) starts in an area, `?at=x,z` starts at a position.

## Layout

```
index.html          page shell: HUD markup and the script list (load order matters)
css/game.css        HUD and UI styles
js/game/            the game, one file per system (classic scripts sharing one global scope)
  setup.js            renderer, scene, camera views, seeded random
  textures.js         pixel-art canvas textures
  geometry.js         mesh helpers + world registries (colliders, walkable areas, interactables, portals, lights)
  props.js            trees, bushes, lamps, benches, signs
  buildings.js        lobby buildings, gates, Crescent Bay (Calfus), the ABZ tower, bikes, street lights
  portals.js          water and the teleporter pads
  lobby.js            the main plaza
  areas.js            AREAS registry + placeholder shell
  office-kit.js       shared office pieces: desks, meeting rooms, sofas, garlands, faders
  office-hq.js        Calfus HQ office (zone "lab")
  office-abz.js       ABZ office (zone "abz"), 15th floor
  build-areas.js      builds the offices, Data Archive and Pune
  effects.js          static batching, ambient life, dust, sun/sky
  characters.js       hero and NPC sprites, wandering
  ui.js               chat, dialogue, banners, keyboard
  post.js             tilt-shift, bloom, colour grade
  loop.js             zones and travel, camera, frame loop
  main.js             window.TokenFall API for modules, then boot
js/bridge/          The Glass Bridge minigame (plugs in through window.TokenFall); tests: npm test
js/sprites/         sprite player + Aditya's sheet
assets/             source sprite sheet
old/                earlier prototypes, not used
tools/              bridge-patch.js (historical record of the bridge integration)
```

Files in `js/game/` see each other's functions and constants directly, so a new file only needs a `<script>` tag in `index.html` after the files it uses.
