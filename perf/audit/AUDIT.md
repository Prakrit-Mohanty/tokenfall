# Audit (no fixes)

Run with `node tools/audit.mjs` against the branch build on `:8092`, headless Chrome at 1280×720. Data is in `ui.json`, `walk.json` and `console.json`; screenshots are in `ui/` and `walk/`. Nothing in the game was changed for this audit.

## 1. UI text: clipped, cut off or hard to read

For each zone, the audit checks every visible element that holds text in five states: the plain HUD, Settings open, the glitch log (G), large text on (L), and the nearest interactable's action triggered (E). It flags text that overflows a box with hidden overflow, text that runs past the viewport, text whose centre is covered by another element, and fonts under 10 px. No panel had text clipped by `overflow`. These are the real findings, most important first:

| # | where | what | evidence |
|---|---|---|---|
| 1 | **minigame intro card with Large text on** (bridge and kitchen; the shared `.panel.gintro`) | At 1280×720 the card is wider than the viewport. Its left column starts at x = −4, so the title, goal, the "How to play" list, "~5 min · 8 questions" and "Don't show again" all lose their first letters at the left edge, and the card's bottom sits over the HUD key help. | `ui/bridge-large-text.webp`, `ui/kitchen-large-text.webp` (in the bridge shot the audit's own Esc also opened the "Leave this game?" box; ignore that) |
| 2 | intro card keyboard diagram, both minigames | The modifier labels under the keys ("control", "option", "command") are 9 px, below a readable size even at normal text size. | `ui/bridge-hud.webp`, `ui/kitchen-hud.webp` |
| 3 | lobby world map (the signpost / map board) | Map labels are SVG `<text>` at 7–7.5 px (e.g. "TOKENFALL", "TOKEN BREW", "Spot Shot", "Homes", "Pond"). They are legible on a desktop screen but small; on a phone they would not be. | `ui/lobby-interact.webp` |
| 4 | NPC name tags and speech bubbles near the top edge | The tags do not clamp to the viewport, so a tag or bubble for an NPC near the top of the view is cut off: lobby `ishaan.b` at y = −11, ABZ bubble "quiet hours until three" at y = −3. Tags for NPCs that are off-screen to the side stay `display:block` far outside the viewport (e.g. x = −859); they are invisible, but each is a DOM node repositioned every frame. | `ui/lobby-hud.webp`, `ui/abz-hud.webp` |
| 5 | Large-text banner | The centre banner ("Large text / On (L to switch off)") is drawn over the hero's own name tag. | `ui/lobby-large-text.webp` |
| 6 | US office, large text | Baljeet's name tag is covered by the party list panel once that panel grows with large text. | `ui/us-large-text.webp` |
| 7 | lobby, top right (seen in the probe shot `perf/shots/baseline/lobby.png`) | A world-space sign's text ("Spot Shot …") shows through behind the Settings button and party panel. It is a 3D sign, not DOM, so the detector cannot catch it; noted from the screenshot. | `perf/shots/baseline/lobby.png` |

The Settings panel, the glitch log, and the HQ, airport and Pune HUDs were clean at both text sizes.

## 2. Console errors per zone

| zone | errors / warnings (load, then each panel opened) |
|---|---|
| all 8 | `404 /favicon.ico` (one per load; there is no favicon) |
| airport | 3× `THREE.GLTFLoader: Custom UV set 1 for texture metalnessMap / roughnessMap / normalMap not yet supported.` These come from the A320 GLB. The same warnings appear on the untouched baseline build (checked on `:8093`), so they predate tonight. The A320's metal/roughness/normal maps use UV set 1, which three r128 ignores, so those maps are sampled with UV 0 (`airport-assets.js` already drops `normalMap`). |

There were no page errors and no failed requests besides the favicon in any zone. That includes opening Settings, the glitch log, large text, and triggering the nearest interactable.

## 3. Things blocking footpaths (ABZ, HQ, US office, airport)

Method: a 0.2 m grid over each zone's walkable rectangles (`WALK`). Each cell is tested with the game's own `blocked(x, z)` at the hero's padding (0.32 m, traffic ignored), then flood-filled from the spawn point. The maps are in `walk/<zone>.png`:
- dark: not walkable
- grey: blocked by a collider
- white: reachable
- **red: walkable floor nobody can reach**
- blue: interactables (magenta if unreachable)
- yellow: portals
- green: spawn

| zone | free floor reached | unreachable floor | what it is | evidence |
|---|---|---|---|---|
| ABZ | 396 of 411 m² | 7.7 m² at (−10, 290.4) and 6.7 m² at (−10, 287.1) | **The "Black Diamond" meeting room and the room next to it are sealed.** Their floors are registered as walkable, but the glass walls have no door gap, so you can see in and never enter. | `walk/abz.png`, `walk/abz-island-0.webp`, `walk/abz-island-1.webp` |
| HQ (lab) | 276 of 283 m² | 5.0 m² at (−6.8, −282.4); 1.2 and 0.9 m² slivers | **The Board Room ("AI literacy 101") is sealed**: the wall line along its front has no opening, so its floor is unreachable. The two slivers are gaps between furniture and walls. | `walk/lab.png`, `walk/lab-island-0.webp` |
| US office | 151 of 153 m² | 2.5 m² at (−294.7, −293.9) | The inside of the glass desk pod by the "Pleasanton" sign: enclosed on all sides. Probably intended (a pod), but its floor is in `WALK`. | `walk/us.png`, `walk/us-island-0.webp` |
| airport | 421 of 433 m² | 11.6 m² at (−310.6, −8.8) | The strip behind the check-in counters (the staff side), closed off by the counters and bag-drop belts. This looks intentional. | `walk/airport.png`, `walk/airport-island-0.webp` |

Every interactable and every portal in these four zones can be reached from the spawn: none is magenta on the maps. Nothing blocks a main walkway outright. The findings above are rooms or pockets whose floor is walkable but whose walls have no way in. Whether the ABZ and HQ meeting rooms are meant to be enterable is a design question; if they are not, removing their floor from `WALK` would make that explicit.
