# Prakrit · Tokenfall character (with bike)

> **Claude Code:** only read this README and `js/tokenfall-characters.js` (~16 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Prakrit in his racing suit, clay-toy 3D style, plus his Yamaha bike. To try it, run `npx serve .` and open `index.html`.

The player is the same `tokenfall-characters.js` as the roster pack, with Prakrit and bike support added. It's a drop-in replacement for that file, so drop `prakrit.webp` and `prakrit-bike.webp` into the same `sprites/` folder as the others and everything works together.

| Move | Directions | Key |
|---|---|---|
| idle | 8 | – |
| walk | 8 (7 frames) | Arrows / WASD |
| run | 8 (12 frames) | Shift |
| jump | 8 (12 frames) | Space |
| crouch | 4 (12 frames, holds) | C |
| bike | 8 still poses; leaned-in riding frame when moving left/right; 2.8× walk speed | B (toggle) |

Jump and crouch are disabled while he's on the bike.

## Use it

```js
const hero = TokenfallCharacters.create('prakrit', '/tokenfall/sprites/', { x: 400, y: 450 });
hero.setInput({ up: true, right: true });   // or hero.walkTo(x, y)
hero.do('bike');                            // toggle bike; also 'jump' | 'crouch' | 'run'
hero.update(dtMs, { width, height }); hero.draw(ctx);
hero.onBike                                 // true while riding
```

Demo widget: `TokenfallCharacters.mount(el, { assetsBase: '/tokenfall/sprites/', characters: ['prakrit'] })`. React: `<TokenfallCharacters character="prakrit" characters={['prakrit']} />`.

## Sprite specs

- **`prakrit.webp`:** 250 × 230 cells, feet at (125, 222), standing height about 172 px. Rows: idle 0–7, walk 8–15, run 16–23, crouch 24–27 (down, up, left, right), jump 28–35.
- **8-direction order:** 0, 45 … 315. 0 means facing the camera, then clockwise; 90 is facing right.
- **`prakrit-bike.webp`:** 418 × 385 cells, ground point at (209, 381). Rows 0–7 hold one still pose each, in the same 8-angle order. Rows 8 and 9 hold the 4-frame lean-in for riding right and left; the player uses the last frame of each. Same scale as Prakrit on foot.
- **JSON:** `prakrit.json` and `prakrit-bike.json` use the TexturePacker JSON-hash format, for Phaser, Pixi, Godot or Unity.

## Prompt for Claude Code

> Add Prakrit from `./prakrit/`. Copy `sprites/` into our public sprites folder and use `js/tokenfall-characters.js` (it replaces the roster pack's copy). Create him with `TokenfallCharacters.create('prakrit', base)`, call `update`/`draw` every frame, map B to `do('bike')`. Read only `prakrit/README.md` and `js/tokenfall-characters.js`. Don't open the image files.
