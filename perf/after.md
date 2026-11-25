Probe: 2026-11-25T21:27:28.198Z, http://localhost:8092, 1280x720, tier forced high (?q=2), median of 2 cold loads per zone.

| zone | playable | settled | bytes | reqs | script | heap | calls | tris | geos | texs | progs | lights lit (point/shadow) | meshes vis | casters vis | frame cpu med/p95 | anim/life |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lobby | 4.05 s | 4.05 s | 45.1 MB | 172 | 3644 ms | 23.2 MB | 854 | 1353k | 495 | 121 | 47 | 21 (17/1) of 64 | 2241 | 1287 | 4.5/5.2 ms | 71/30 |
| pune | 3.29 s | 3.29 s | 52.2 MB | 183 | 3017 ms | 25.7 MB | 901 | 2700k | 533 | 82 | 40 | 18 (14/1) of 64 | 2646 | 1858 | 4.9/6 ms | 71/30 |
| abz | 3.13 s | 3.13 s | 44.4 MB | 170 | 2450 ms | 22.9 MB | 686 | 2550k | 502 | 103 | 40 | 13 (9/1) of 64 | 2273 | 1211 | 3.5/4.3 ms | 71/30 |
| lab | 3.34 s | 3.34 s | 44.4 MB | 170 | 2638 ms | 22 MB | 469 | 313k | 184 | 93 | 39 | 17 (13/1) of 64 | 2004 | 1214 | 3.5/4.7 ms | 71/30 |
| airport | 3.15 s | 3.15 s | 65.3 MB | 172 | 2601 ms | 22.5 MB | 384 | 697k | 272 | 101 | 38 | 11 (7/1) of 64 | 1791 | 965 | 4.3/5 ms | 71/30 |
| us | 3.13 s | 3.13 s | 44.4 MB | 170 | 2696 ms | 21.6 MB | 230 | 206k | 115 | 77 | 40 | 10 (6/1) of 64 | 2000 | 1212 | 3.8/4.7 ms | 71/30 |
| bridge | 3.10 s | 3.10 s | 44.4 MB | 170 | 2269 ms | 22.6 MB | 189 | 311k | 154 | 71 | 39 | 9 (5/1) of 67 | 2166 | 1204 | 2.8/4.9 ms | 74/30 |
| kitchen | 2.94 s | 2.94 s | 45.2 MB | 171 | 2236 ms | 21.7 MB | 226 | 1033k | 159 | 57 | 27 | 10 (6/1) of 64 | 1975 | 1202 | 3.9/4.6 ms | 71/30 |

Largest files (zone "lobby", bytes on the wire; script = V8 compile + evaluate on the main thread, plus background parse):

| file | bytes | script |
|---|---|---|
| assets/sprites/aarav.webp | 3621 KB |  |
| assets/sprites/saanvi.webp | 2775 KB |  |
| assets/sprites/riya.webp | 2713 KB |  |
| assets/sprites/mehta.webp | 2440 KB |  |
| assets/sprites/sudhanshu.webp | 2332 KB |  |
| assets/sprites/aditya.webp | 1705 KB |  |
| js/models/street-props.js | 1633 KB | 7 ms |
| assets/sprites/aarav.aux.webp | 1455 KB |  |
| assets/sprites/sudhanshu.aux.webp | 1156 KB |  |
| assets/sprites/saanvi.aux.webp | 1123 KB |  |
| assets/sprites/gaurav.webp | 1094 KB |  |
| assets/sprites/riya.aux.webp | 1059 KB |  |
| assets/sprites/mehta.aux.webp | 993 KB |  |
| assets/sprites/jacintha.webp | 948 KB |  |
| assets/sprites/aditya.aux.webp | 935 KB |  |
| assets/sprites/rohit.webp | 902 KB |  |
| assets/sprites/murali.webp | 868 KB |  |
| assets/sprites/amit.webp | 867 KB |  |
| assets/sprites/salim.webp | 859 KB |  |
| assets/sprites/baljeet.webp | 855 KB |  |
| assets/sprites/rajiv.webp | 831 KB |  |
| assets/sprites/prakrit_ride_mehta.webp | 827 KB |  |
| assets/sprites/kartik.webp | 822 KB |  |
| assets/sprites/arvind.webp | 811 KB |  |
| assets/sprites/prakrit_ride_aarav.webp | 807 KB |  |
