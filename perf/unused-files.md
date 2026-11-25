# Files the game never loads at runtime

Nothing was deleted. Method: every URL requested by the 16 cold loads in perf/baseline.json (8 zones x 2), minus files whose name appears in the runtime code outside comments (those load conditionally, listed at the end). Paths are as of the start-of-night snapshot (commit 2fc718e).

**998 MB in 794 tracked files** are never requested. Grouped by top-level folder or root file:

| size | files | path | what it looks like |
|---:|---:|---|---|
| 208.0 MB | 20 | `american-road-intersection/` | source model (road textures / props packs) |
| 119.3 MB | 8 | `hyundai-creta-2016/` | source model / sprite sources for the tools/*-pack.py packers |
| 105.0 MB | 5 | `robo-dog/` | source model for js/models/robodog.js |
| 59.7 MB | 21 | `2022-mahindra-scorpio-n/` | source model / sprite sources for the tools/*-pack.py packers |
| 52.7 MB | 6 | `street-and-city-props-dumpster-traffic-light/` | source for js/models/street-props.js |
| 51.8 MB | 46 | `Bigshot-npcs/` | sources for the senior NPC sprites |
| 51.7 MB | 30 | `low-poly-autorickshaw-aka-tuktuk/` | source for js/models/autorickshaw.js |
| 47.5 MB | 8 | `hyundai-creta new/` | source model / sprite sources for the tools/*-pack.py packers |
| 37.2 MB | 17 | `2019-koenigsegg-jesko/` | source model / sprite sources for the tools/*-pack.py packers |
| 29.1 MB | 6 | `tokenfall-characters-extras/` | sources |
| 22.7 MB | 295 | `sudhanshu-3d-extras/` | source model / sprite sources for the tools/*-pack.py packers |
| 22.3 MB | 19 | `bmw-m4-modified-widebody/` | source model / sprite sources for the tools/*-pack.py packers |
| 20.9 MB | 1 | `bajaj_avenger_180cc_redux.glb` | source model / sprite sources for the tools/*-pack.py packers |
| 17.0 MB | 4 | `abz-view/` | source model / sprite sources for the tools/*-pack.py packers |
| 14.9 MB | 1 | `2010_suzuki_gsx-r_750.glb` | source model / sprite sources for the tools/*-pack.py packers |
| 14.6 MB | 4 | `road--avenue--street/` | source model / sprite sources for the tools/*-pack.py packers |
| 12.6 MB | 6 | `prakrit-passengers-extras/` | source model / sprite sources for the tools/*-pack.py packers |
| 11.2 MB | 2 | `car-concept/` | source model / sprite sources for the tools/*-pack.py packers |
| 10.7 MB | 1 | `tokenfall-characters.standalone.html` | standalone viewer page / image |
| 9.8 MB | 3 | `prakrit-extras/` | source model / sprite sources for the tools/*-pack.py packers |
| 8.6 MB | 10 | `2024-maruti-suzuki-eeco/` | source model / sprite sources for the tools/*-pack.py packers |
| 8.4 MB | 19 | `tokenfall-characters/` | character viewer + sources for chars-pack |
| 8.3 MB | 1 | `stone_pavement_tiles.glb` | source model / sprite sources for the tools/*-pack.py packers |
| 7.7 MB | 115 | `gaurav-npc-extras/` | source model / sprite sources for the tools/*-pack.py packers |
| 7.5 MB | 2 | `small-van/` | source model / sprite sources for the tools/*-pack.py packers |
| 5.1 MB | 16 | `prakrit-passengers/` | source model / sprite sources for the tools/*-pack.py packers |
| 4.3 MB | 56 | `Clay fig/` | source model / sprite sources for the tools/*-pack.py packers |
| 3.5 MB | 1 | `prakrit.standalone_1.html` | standalone viewer page / image |
| 3.1 MB | 18 | `bmw-m3-gtr-nfs-mw/` | source model / sprite sources for the tools/*-pack.py packers |
| 2.8 MB | 1 | `pavement_1.glb` | source model / sprite sources for the tools/*-pack.py packers |
| 2.7 MB | 9 | `prakrit/` | source model / sprite sources for the tools/*-pack.py packers |
| 2.4 MB | 2 | `assets/` | source sprite sheets `aditya.png`, `hero.png` (tonight's `assets/models` and `assets/sprites` are new and loaded) |
| 2.4 MB | 1 | `sudhanshu3d.standalone.html` | standalone viewer page / image |
| 2.2 MB | 8 | `aditya-3d/` | source model / sprite sources for the tools/*-pack.py packers |
| 2.0 MB | 5 | `launcher/` | **keep**: the picker videos and backdrop, loaded on the normal start path only (see below) |
| 1.9 MB | 8 | `sudhanshu-3d/` | source model / sprite sources for the tools/*-pack.py packers |
| 1.6 MB | 2 | `ferrari-458-italia/` | source model / sprite sources for the tools/*-pack.py packers |
| 1.2 MB | 2 | `tesla-cybertruck/` | source model / sprite sources for the tools/*-pack.py packers |
| 0.9 MB | 1 | `gaurav-npc.standalone.html` | standalone viewer page / image |
| 0.8 MB | 1 | `undefinedbridge.png` | standalone viewer page / image |
| 0.8 MB | 1 | `undefinedpune.png` | standalone viewer page / image |
| 0.7 MB | 7 | `gaurav-npc/` | source model / sprite sources for the tools/*-pack.py packers |
| 0.3 MB | 32 | `tests (npm test)` |  |

Smaller groups (under 200 KB each) are left out of the table.

## Named by runtime code but not requested in the probes (conditional, keep)

- `old/`: the README calls it "earlier prototypes, not used"; nothing requests it.
- `launcher/preview-*.mp4`, `launcher/select-backdrop.jpg`: the character picker, shown only on the normal start path (the probes use `?zone=`)

## Also not needed at runtime after tonight (kept for file:// and as packer input)

- `js/models/cars.js`, `supercars.js`, `bikes.js`, `robodog.js`, `js/sprites/chars-sheet.js`: loaded only when the page is opened from file://; over http the game uses `assets/models/*.glb` and `assets/sprites/*.webp`.
- `airport_pack_total.glb`, `a320-200_with_cockpit_ver_viii.glb`: sources for `assets/models/airport-*.glb`.

Untracked or ignored and also unused: `evel-knievel-triumph-rocket-1028s.zip` (106 MB), `2024-maruti-suzuki-eeco/source/eeco.rar`.
