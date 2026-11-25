# TokenFall overnight performance pass (2026-11-26)

Branch `overnight/perf-2026-11-26`, local only and never pushed; `main` is untouched. All numbers below come from `tools/perf-probe.mjs`. It loads each zone cold in headless Chrome 1280×720 (Metal ANGLE, M-series Mac) with a fresh profile and the cache disabled. The quality tier is forced to high (`?q=2`), the adaptive resolution is frozen, and each figure is the median of 2 loads. Raw data is in `perf/baseline.json` and `perf/after.json`, with readable tables in `perf/baseline.md` and `perf/after.md`.

## How the branch was set up (read this first)

- The main checkout had 32 uncommitted changes, plus `.glb` files and a new `js/models/supercars.js`. Another Claude session was also active in that folder: files were modified at 01:13 and a second dev server was running. I did not touch that working copy. Instead:
  - commit `2fc718e` is a snapshot of the working tree exactly as it was at 01:21 (its uncommitted WIP, unchanged). I made it with a temporary index, so the main checkout's index and files were not modified.
  - all work happened in a separate worktree, `../tokenfall-overnight`, on `overnight/perf-2026-11-26`. A second detached worktree, `../tokenfall-baseline` at `503dc53` (snapshot plus probe only), served the "before" build for the screenshot comparisons. You can remove both with `git worktree remove`.
- Servers: `localhost:8091` was already serving the main checkout, which does not contain this work. So I served the branch with the same no-cache server on `:8092` and the baseline on `:8093`. Every before/after number compares 8093 with 8092 on the same machine and in the same session.
- `npm test` passed after every commit (23 suites). The only new runtime dependency is a vendored 29 KB meshopt decoder. `puppeteer-core`, `@gltf-transform/*`, `meshoptimizer`, `sharp`, `pixelmatch` and `pngjs` are devDependencies, used only by the tools.

## Before / after per zone

| zone | time to playable (s) | MB downloaded | main-thread script (ms) | JS heap (MB) | draw calls | textures | programs | frame() CPU median (ms) |
|---|---|---|---|---|---|---|---|---|
| lobby | 5.87 → 4.05 | 84.8 → 45.1 | 4925 → 3644 | 25.8 → 23.2 | 872 → 854 | 143 → 121 | 58 → 47 | 4.5 → 4.5 |
| pune | 5.96 → 3.29 | 84.8 → 52.2 | 5698 → 3017 | 26.2 → 25.7 | 927 → 901 | 111 → 82 | 54 → 40 | 4.8 → 4.9 |
| abz | 5.85 → 3.13 | 84.8 → 44.4 | 6013 → 2450 | 26.3 → 22.9 | **2059 → 686** | 125 → 103 | 51 → 40 | **5.7 → 3.5** |
| lab (HQ) | 5.34 → 3.34 | 84.8 → 44.4 | 4646 → 2638 | 25.0 → 22.0 | 487 → 469 | 115 → 93 | 50 → 39 | 4.2 → 3.5 |
| airport | 5.83 → 3.15 | 117.6 → 65.3 | 5165 → 2601 | 25.2 → 22.5 | 412 → 384 | 129 → 101 | 52 → 38 | 3.2 → 4.3 |
| us | 5.57 → 3.13 | 84.8 → 44.4 | 4925 → 2696 | 24.7 → 21.6 | 253 → 230 | 95 → 77 | 49 → 40 | 3.6 → 3.8 |
| bridge (minigame) | 5.88 → 3.10 | 84.8 → 44.4 | 4730 → 2269 | 25.7 → 22.6 | 262 → 189 | 98 → 71 | 52 → 39 | 3.5 → 2.8 |
| kitchen (minigame) | 5.48 → 2.94 | 84.8 → 45.2 | 4659 → 2236 | 24.5 → 21.7 | 254 → 226 | 85 → 57 | 41 → 27 | 4.3 → 3.9 |

How to read these columns:
- **Time to playable** runs from navigation start until `#loading` is removed and two `requestAnimationFrame`s have passed, so the first game frame has been drawn. The server is localhost, so this is CPU/GPU-bound rather than network-bound. On a real connection the 40–52 MB saved per load matters far more than these seconds suggest.
- **Main-thread script** is Chrome's `ScriptDuration` up to measurement. It includes about 3 s of frame sampling, so compare the change between columns, not the absolute value.
- **frame() CPU** is noisy at about ±1 ms between runs; see `runs` in the JSON. Only the ABZ drop is clearly real, and it is backed by draw calls falling 3×. The airport/US rises are inside the noise: the per-run values were 3.2/4.8 before and 4.3/4.3 after.
- Bridge and kitchen are the two minigame rooms that are real zones. Carrom, Token Tower and Spot Shot are tables inside the lobby/HQ, so the lobby and lab rows cover them. `?zone=archive` from the README no longer exists.
- Lights (unchanged): each zone has 1 hemisphere, 1 directional (the only shadow caster) and 2 spot lights. Point lights lit per zone: lobby 17, pune 14, lab 13, abz 9, airport 7, us 6, kitchen 6, bridge 5. The scene holds 60 point lights in total.

## Changes, with commits

| commit | change | effect | visual check |
|---|---|---|---|
| `578f99a` | `cars.js` + `supercars.js` + `bikes.js` + `robodog.js` (26 MB of base64) become `assets/models/*.glb`. Compression: meshopt, 16-bit positions, 10-bit normals, 14-bit UVs, no octahedral filter, no material dedup (`sportsCar` recolours the material named `paint`). `js/model-files.js` fetches each model when the zone its copy stands in is entered (`setZone`), or as soon as `travel()` starts towards that zone. | 26.4 MB → 8.7 MB, and only the start zone's models load at boot | close-ups of the 10 model instances nearest the spawn in lobby and Pune: 0.00–0.01 % of pixels differ |
| `7441674` | `js/sprites/chars-sheet.js` (55 MB of base64 WebP) becomes `assets/sprites/*.webp`, byte for byte the same images | 55 MB → 41 MB on the wire, and V8 no longer parses a 55 MB string | same pixels by construction |
| `5fe129d` | NPCs in other zones are hidden. Character cards have `frustumCulled = false` because the shader places the vertices, so every NPC in every zone was drawn, shadow-mapped, and had its sheet uploaded on the first frame. | **biggest boot win**: about 1.9 s of `texImage2D` on the first frame was uploads of sprite sheets for NPCs 300 m away | NPCs in other zones are past the 220 m far plane |
| `cc610e4` | follow-up to `5fe129d`: the destination zone's NPCs become visible when `travel()` starts, so their sheets upload under the fade-out | worst frame after arriving goes back to the old figures (lobby→pune 200 ms vs 217, →abz 117 vs 133, →lab 117 vs 117, →us 100 vs 100) | see Risks |
| `0cd5dcb` | the airport's `airport_pack_total.glb` (meshopt, **not quantised**, because `airport-assets.js` bakes and merges raw vertex arrays and three r128 reads quantised ints raw) and the A320 (PNG → lossless WebP) are served from `assets/models/airport-*.glb`. The originals stay at the root as sources. | 33.5 MB → 21.4 MB, airport zone only | 8 airport model close-ups: 0.00 % before the RNG note below |
| `7ede609` | the ABZ window city: about 700 static blocks, each a `BoxGeometry` with a 6-entry material array (6 draws per building). They are merged into one mesh per material in the city's own frame; the instanced trees and the transparent sky stay separate. | ABZ draws 2059 → 686, frame() 5.7 → 3.5 ms | view out of the window: 0.01–0.03 % |
| `5939fcd` | Pune's `stepTraffic` runs only while you are in Pune | about 0.08 ms per frame in every other zone; cars wait where they were | Pune is 300 m from everything else |

Tooling commits: `559a421` (dev dependencies), `503dc53` (`tools/perf-probe.mjs` and the baseline), `be8172c` and `f97a5db` (`tools/shots.mjs`, frozen-time screenshots, and `tools/shot-diff.mjs`), `8b6d1ab` (`tools/frame-profile.mjs`), `66c7438` (`perf/unused-files.md`), `81bab98` (after-data and screenshots).

**file:// still works.** The README says opening `index.html` from disk works, so nothing embedded was removed. `js/model-files.js` and `js/sprites/chars-sheet-files.js` check `location.protocol === 'file:'` and `document.write` the original `.js` packs, keeping the old path. I verified this in headless Chrome: from `file://…/index.html?zone=pune`, 30 glTF roots loaded, `CHAR_SHEETS` were data URIs, and there were no errors. The airport `.glb` files could never load from file://, which is unchanged: they fall back to the stand-ins.

### How visuals were checked
`tools/shots.mjs` makes every `requestAnimationFrame` receive the same timestamp, so the game's `dt` is 0 from its first frame, and it seeds `Math.random`. It then screenshots each zone's spawn view, close-ups of every glTF model in the zone, and ABZ's city. `tools/shot-diff.mjs` (pixelmatch, threshold 0.1) compares them. Images are in `perf/shots/frozen-{before,after,diff}`, with scores in `frozen-diff.txt`.

Noise floor: the same build shot twice gives up to 4.5 % on bridge (animated tiles) and 0.95 % on the lobby (sub-pixel NPC/name-tag offsets). Every spawn-view difference after the changes looked the same as that noise when I inspected it by eye: NPC outlines shifted by a pixel, the chat line, the pulsing key highlight in the minigame intro cards. Nothing appeared or disappeared.

The only differences outside that pattern are airport close-ups 4, 5 and 7, at 0.6–1.4 %. That is the terrazzo floor, which `airport.js:264` draws with unseeded `Math.random()` chips. Its pattern depends on how many random numbers were consumed before the airport texture is built, and the traffic gating changes that count. In the real game the pattern differs every session anyway; the crops look the same apart from chip positions.

## Phase 3 findings: cost per frame

`tools/frame-profile.mjs` wraps every `anim`/`life`/`zoneTick` callback, takes a sampling heap profile over 4 s, and buckets one frame's draws by object. Results are in `perf/frame-profile-{before,after}.json`.

- **The per-frame JS callbacks are cheap.** All 71 `anim` and 30 `life` callbacks together cost about 0.3 ms per frame. The biggest was Pune traffic at 0.08 ms, now gated to Pune.
- **Per-frame allocations** are under about 1 KB per frame (anime.js, `slice`/`replace` inside three). There was nothing to fix there.
- **Zones that keep updating while you're not in them:** every `anim`/`life` callback runs in every zone. Several already early-out (the story corner, the ABZ city's visibility, TOKEN-1's eyes). Pune traffic was the only measurable one, and it is gated now. The others cost under 0.05 ms each and were not worth the risk.
- **Draw calls dominate frame CPU.**
  - ABZ was the outlier and is fixed.
  - In the lobby and Pune, most remaining draws are `userData.dyn` objects (robots, minigame props, traffic, parked models loaded after `mergeStatic`) plus about 300–580 shadow-map and post-processing draws.
  - `js/storycorner.js:28` adds 213 unmerged meshes after `mergeStatic` runs. Most are static (houses, tea party, ladder), but the group is mixed with the animated pup, train and Zs.
- **Shadow casters:** the sun is the only shadow light. About 1200–1900 casting meshes are visible per zone; NPC culling cut about 690 in the lobby (1979 → 1287).
- **Point lights:** 5–17 lit per zone, plus 2 spots. In three r128's forward renderer, every lit `MeshStandardMaterial` fragment loops over all of them. The lobby, with 17, pays the most on the GPU. I did not change any light, because each removal is a visible change.
- **Shader recompiles on travel.** Each zone lights a different number of point lights, so three's program key (`numPointLights`) changes and every material recompiles on the first visit. That is the 100–217 ms frame on arrival, which existed before tonight.
- **Texture memory: probably the most important finding for weaker GPUs.** The 22 character sprite sheets are 4096 px wide and 1269–5968 px tall: about **1.1 GB of VRAM with mipmaps** once all of them have been seen. Before tonight all of them uploaded on the first frame. Now only the current zone's sheets upload, but a player who visits every zone still ends up holding all of them.

## What I did not do, and why

- **Smaller or recompressed sprite sheets.** This is the biggest remaining win (VRAM and upload time), but any resampling or lossy re-encode changes how the characters look, and the brief said no visible change. See Next steps.
- **Texture downsizing in the car GLBs.** The car textures are already 64–1024 px JPEGs, at most about 200 KB each; geometry was 85 % of the bytes. Re-encoding the JPEGs would only lose quality.
- **Lossy WebP for the A320.** Its 20 PNG textures total about 16 MB. Lossless WebP saved only 2.5 MB; lossy at q90 would save about 12 MB more, but it is a visible-change risk.
- **Draco.** Meshopt needs no WASM fetch from gstatic and decodes faster; r128's GLTFLoader supports both.
- **Material dedup before `mergeStatic`.** Merged meshes in Pune use 223 materials but only 144 distinct ones, so dedup would save about 80 draws in Pune; it saves nothing in the lobby (90 → 86) or HQ (45 → 45). I skipped it because `daylight.js` and the props mutate some materials by reference, and a deduped material would stop following those changes.
- **Re-running `mergeStatic` after the minigames install, and merging the story corner.** Modules keep references to their meshes (`hero.g.visible`, sparkles, ghosts), and I could not prove which of them are never touched again.
- **Fewer or padded point lights.** Fewer is a visible change. Padding every zone to the same count would stop the travel recompiles but would add per-fragment cost in the zones that have fewer lights.
- **`createImageBitmap` for the sheets.** This would take decoding off the main thread, but browser premultiplication rounds differently from GL's `UNPACK_PREMULTIPLY_ALPHA`, so the pixels might not match.
- **Deleting anything.** `perf/unused-files.md` lists about 1 GB in 794 tracked files that the game never requests: mostly the source models and sprite sources under the root folders, the `*.standalone.html` viewers and `old/`. It also lists what loads only conditionally (the picker videos in `launcher/`, the music).
- **Idle prefetch of other zones' models.** The brief said "loaded only when a zone needs them", so models load on zone entry, or at `travel()` start, which gives them the 480 ms fade.

## Risks for the reviewer

1. **Pop-in on first entry.** Cars, bikes and the dog in a zone arrive after its fade begins. On localhost they are in place before the fade ends. On a slow connection a parked car can appear a moment after you arrive. Colliders for parked cars are created when the model loads, which is unchanged: it was already async.
2. **A stall during the first fade-out into each office.** The destination's sprite sheets now upload during the fade-out. That gives one frame of 180–320 ms on the first visit to ABZ, HQ or US (lobby→pune: none). The CSS opacity fade runs on the compositor, so it keeps going, but the game frame under it freezes briefly. Arrival frames match the old ones.
3. **Off-zone NPC visibility now follows `c.zone`.** Any future feature that shows an NPC outside its `zone` would hide it. The rule is one line in `js/game/loop.js:113`. The hero is excluded; minigames already toggle `hero.g.visible` themselves.
4. **Quantised car meshes.** Any future code that reads car vertex positions directly would get raw int16 values, because r128 does not denormalise. `Box3.setFromObject` is fine, since GLTFLoader sets dequantised bounds. The airport GLBs are deliberately not quantised for this reason.
5. **Stale packs.** The `.glb` and `.webp` files are build outputs. If someone re-runs `tools/cars-pack.py` and friends, they must then run `node tools/models-pack.mjs`, or the http build will keep serving the old models while file:// shows the new ones.
6. **Snapshot commit `2fc718e`.** It contains the other session's uncommitted WIP as it was at 01:21. If that work continued afterwards, the main checkout is newer than this branch's base, so rebase or cherry-pick the `perf:` commits onto it.

## Suggested next steps (biggest first)

1. **Character sprite sheets:** about 1.1 GB of VRAM and about 60–230 ms of upload each.
   - Check the on-screen size of a character against the 2.5× atlas. If 1.25× is indistinguishable, halving the scale quarters the VRAM.
   - Alternatively ship KTX2/Basis (r128 has `KTX2Loader`).
   - Also consider dropping mipmaps for the aux maps (already done) and for sheets that are never minified.
2. **Point-light budget per material.** For example, bake the lobby's 17 lamps into emissive plus a light map, or give far-away lamps `distance` cut-offs and turn off the ones that are off-screen (`capLamps` already exists for the low tier).
3. **Equalise each zone's light count** to kill the 100–217 ms recompile on first arrival. Alternatively, pre-compile each zone's programs with `renderer.compile` during the travel fade, with that zone's lights enabled.
4. **Material dedup plus `mergeStatic` after `TF.boot()`,** behind an explicit opt-in such as `userData.static = true` on the minigame and story-corner pieces.
5. **Network:** enable gzip/brotli on the real host (the JS and `.json` compress about 4×), and set long cache lifetimes for `assets/`, since the files are content-stable.
6. Keep `tools/perf-probe.mjs` and `tools/shots.mjs` in CI to catch regressions. One probe run over all zones takes about 5 min.

## Phase 5 audit

See `perf/audit/AUDIT.md`; I fixed nothing from it. In short:
- **UI:** the minigame intro card runs off the left edge when Large text is on, and the keyboard diagram's key labels are 9 px.
- **Console:** every zone is clean apart from a missing favicon; the airport also shows three GLTFLoader UV-set warnings that predate tonight.
- **Walkability:** every portal and interactable in ABZ, HQ, US and the airport can be reached. The ABZ "Black Diamond" meeting room (and the one next to it) and the HQ Board Room have walkable floors but no door gap.
