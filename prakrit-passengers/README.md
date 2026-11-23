# Prakrit + passengers · Tokenfall

> **Claude Code:** only read this README and `js/tokenfall-characters.js` (~21 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Prakrit on his Yamaha with Riya, Aarav, Mr. Mehta or Saanvi riding behind him. Every pair has all 8 directions plus the riding lean-in frames for left and right. To try it, run `npx serve .` and open `index.html`, then press **P** to change the passenger.

`js/tokenfall-characters.js` replaces the copy from the roster and Prakrit packs. Everything those packs did still works, so put the new `duo-*.webp` files in the same `sprites/` folder as the others.

## How riding works

| Who | Call | Key |
|---|---|---|
| Prakrit | `hero.setPassenger('riya')` (or `'aarav'`, `'mehta'`, `'saanvi'`, `null` to ride alone). This also puts him on the bike. | P cycles: none → Riya → Aarav → Mr. Mehta → Saanvi |
| Prakrit | `hero.do('passenger')` cycles like the P key; `hero.do('bike')` gets on/off | B |
| Riya, Aarav, Mr. Mehta, Saanvi | `hero.do('bike')`: they ride behind Prakrit, so the pair is drawn and controlled as one sprite | B |

- The bike moves at 2.8× walking speed. Jump and crouch are off while riding.
- Standing still or moving up, down or diagonally shows the still pose for that direction.
- Moving left or right shows the fully leaned frame. Pass `{ leanIn: true }` to `create()` or `mount()` to play the lean-in frames first (110 ms each) and then hold the last one.
- `hero.state.label` reads e.g. "Riding with Riya" or "Riding behind Prakrit". `hero.onBike` and `hero.passenger` tell you the current setup.

```js
const hero = TokenfallCharacters.create('prakrit', '/tokenfall/sprites/', { x: 400, y: 450 });
hero.setPassenger('mehta');          // on the bike, Mr. Mehta behind
hero.setInput({ right: true });       // rides right, leaned in
hero.update(dtMs, { width, height }); hero.draw(ctx);

const riya = TokenfallCharacters.create('riya', '/tokenfall/sprites/');
riya.do('bike');                      // Riya hops on behind Prakrit
```

For the multiplayer case (two players, one bike), hide the passenger's own character and call `setPassenger(theirId)` on Prakrit. Clear it with `setPassenger(null)` when they hop off.

## Sprite specs

- **`duo-riya.webp`, `duo-aarav.webp`, `duo-mehta.webp`, `duo-saanvi.webp`:** 418 × 390 cells, ground point at (209, 386).
  - Rows 0–7 hold one still pose each at 0, 45 … 315. 0 means facing the camera, then clockwise; 90 is facing right.
  - Row 8 is riding right and row 9 is riding left: 4 lean-in frames (Saanvi has 3); the last is fully leaned.
  - Same scale as `prakrit-bike.webp`, so the bike is the same size with or without a passenger.
- **JSON:** each sheet has a TexturePacker JSON-hash file (`duo_<angle>`, `ride_90_<i>`, `ride_270_<i>`) for Phaser, Pixi, Godot or Unity.
- **Also included:** `prakrit.webp` and `prakrit-bike.webp` so the demo runs on its own. The other four characters' walking sheets are in the roster pack. You only need them if those characters walk around on foot.
- Lossless PNGs of the duo sheets are in `prakrit-passengers-extras.zip`.

## Prompt for Claude Code

> Add riding pillion from `./prakrit-passengers/`. Copy `sprites/` into our public sprites folder (next to the roster sprites) and replace our `tokenfall-characters.js` with `js/tokenfall-characters.js`. When a player gets on behind Prakrit, hide their character and call `prakrit.setPassenger(id)`; on hop-off call `setPassenger(null)` and show them again next to the bike. Read only `prakrit-passengers/README.md` and `js/tokenfall-characters.js`. Don't open the image files.
