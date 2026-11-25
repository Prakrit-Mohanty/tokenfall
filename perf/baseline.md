Probe: 2026-11-25T20:13:17.157Z, http://localhost:8092, 1280x720, tier forced high (?q=2), median of 2 cold loads per zone.

| zone | playable | settled | bytes | reqs | script | heap | calls | tris | geos | texs | progs | lights lit (point/shadow) | meshes vis | casters vis | frame cpu med/p95 | anim/life |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lobby | 5.87 s | 5.87 s | 84.8 MB | 128 | 4925 ms | 25.8 MB | 872 | 1353k | 495 | 143 | 58 | 21 (17/1) of 64 | 2978 | 1979 | 4.5/5.2 ms | 71/30 |
| pune | 5.96 s | 5.96 s | 84.8 MB | 128 | 5698 ms | 26.2 MB | 927 | 2700k | 537 | 111 | 54 | 18 (14/1) of 64 | 2757 | 1919 | 4.8/6 ms | 71/30 |
| abz | 5.85 s | 5.85 s | 84.8 MB | 128 | 6013 ms | 26.3 MB | 2059 | 2550k | 565 | 125 | 51 | 13 (9/1) of 64 | 3099 | 1919 | 5.7/7.1 ms | 71/30 |
| lab | 5.34 s | 5.34 s | 84.8 MB | 128 | 4646 ms | 25 MB | 487 | 313k | 184 | 115 | 50 | 17 (13/1) of 64 | 2758 | 1919 | 4.2/5 ms | 71/30 |
| airport | 5.83 s | 5.83 s | 117.6 MB | 130 | 5165 ms | 25.2 MB | 412 | 698k | 272 | 129 | 52 | 11 (7/1) of 64 | 2571 | 1683 | 3.2/4.4 ms | 71/30 |
| us | 5.57 s | 5.57 s | 84.8 MB | 128 | 4925 ms | 24.7 MB | 253 | 206k | 115 | 95 | 49 | 10 (6/1) of 64 | 2758 | 1919 | 3.6/4.6 ms | 71/30 |
| bridge | 5.88 s | 5.88 s | 84.8 MB | 128 | 4730 ms | 25.7 MB | 262 | 310k | 170 | 98 | 52 | 9 (5/1) of 67 | 2960 | 1919 | 3.5/4.9 ms | 86/30 |
| kitchen | 5.48 s | 5.48 s | 84.8 MB | 128 | 4659 ms | 24.5 MB | 254 | 1034k | 159 | 85 | 41 | 10 (6/1) of 64 | 2753 | 1917 | 4.3/5.2 ms | 71/30 |

Largest files (zone "lobby", bytes on the wire; script = V8 compile + evaluate on the main thread, plus background parse):

| file | bytes | script |
|---|---|---|
| js/sprites/chars-sheet.js | 54653 KB | 115 ms |
| js/models/cars.js | 14543 KB | 40 ms |
| js/models/supercars.js | 7465 KB | 19 ms |
| js/models/bikes.js | 4631 KB | 12 ms |
| js/models/street-props.js | 1633 KB | 9 ms |
| js/models/robodog.js | 1142 KB | 3 ms |
| js/models/autorickshaw.js | 348 KB | 2 ms |
| js/models/road-tex.js | 193 KB | 2 ms |
| cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | 119 KB | 17 ms |
| js/sprites/chars-data.js | 88 KB | 1 ms |
| js/game/lobby-village.js | 71 KB | 2 ms |
| js/gallery-content.js | 63 KB | 1 ms |
| js/game/pune.js | 56 KB | 1 ms |
| js/carrom-content.js | 56 KB | 1 ms |
| launcher/tokenfall-launcher.js | 55 KB | 1 ms |
| js/game/airport-apron.js | 53 KB | 1 ms |
| js/carrom-play.js | 50 KB | 1 ms |
| js/bridge/bridge-world.js | 48 KB | 1 ms |
| js/game/world-map.js | 48 KB | 1 ms |
| js/kitchen-play.js | 47 KB | 0 ms |
| js/jenga-content.js | 46 KB | 2 ms |
| js/gallery-world.js | 45 KB | 1 ms |
| js/bridge/bridge-play.js | 44 KB | 1 ms |
| js/jenga-world.js | 42 KB | 1 ms |
| js/bridge/bridge-content.js | 40 KB | 1 ms |
