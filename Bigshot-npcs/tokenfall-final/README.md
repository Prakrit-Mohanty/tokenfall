# Tokenfall final roster

> **AI assistant (Claude Code, Copilot, Cursor, etc.):** only read this README and `js/tokenfall-characters.js` (~17 KB). Don't open `sprites/*.webp`, `*.png` or `*.json` sprite data. They're images and frame tables, and reading them wastes context.

Ten characters in the clay-toy 3D style, as sprite sheets with a tiny player. No dependencies, no build step. To try it in VS Code, run `npx serve .` in this folder (or use the Live Server extension) and open `index.html`.

| Key | id | Name |
|---|---|---|
| 1 | `murali` | Murali |
| 2 | `salim` | Salim |
| 3 | `amit` | Amit |
| 4 | `jacintha` | Jacintha |
| 5 | `kartik` | Kartik |
| 6 | `arvind` | Arvind |
| 7 | `rajiv` | Rajiv |
| 8 | `brian` | Brian |
| 9 | `baljeet` | Baljeet |
| 0 | `rohit` | Rohit |

Every character has the same moves:

| Move | Directions | Frames | Key |
|---|---|---|---|
| idle | 8 | 1 | – |
| walk | 8 | 6 | Arrows / WASD |
| run | 8 | the walk, played faster | Shift |
| talk | 8 | 8 (170 ms each) | E |
| jump | 8 | standing hop | Space |

## Use it

```js
const hero = TokenfallCharacters.create('murali', '/tokenfall/sprites/', { x: 400, y: 450 });
hero.setInput({ up: true, right: true });   // or hero.walkTo(x, y)
hero.do('talk');                            // also 'jump' | 'run'
hero.update(dtMs, { width, height }); hero.draw(ctx);
```

Demo widget: `TokenfallCharacters.mount(el, { assetsBase: '/tokenfall/sprites/' })`. React / Next.js: `<TokenfallCharacters character="salim" />` from `react/TokenfallCharacters.jsx`.

## Sprite specs

- **`<id>.webp`:** 8 columns × 24 rows of 250 × 230 cells. Feet at (125, 222); standing height about 172 px, the same for all ten.
- **Rows:** idle 0–7, walk 8–15 (6 frames), talk 16–23 (8 frames).
- **8-direction order:** 0, 45 … 315. 0 means facing the camera, then clockwise; 90 is facing right.
- **`<id>.json`:** TexturePacker JSON-hash frame tables (`idle_<angle>`, `walk_<angle>_<i>`, `talk_<angle>_<i>`) for Phaser, Pixi, Godot or Unity.
- **`<id>-portrait.png`:** front-facing picture for character pickers.
- Lossless PNGs of every sheet are in `tokenfall-final-extras.zip`.

## Prompt for your AI assistant in VS Code

> Add the Tokenfall final roster from `./tokenfall-final/`. Copy `sprites/` into our public sprites folder and use `js/tokenfall-characters.js` as the character player. Create a player with `TokenfallCharacters.create(id, base)` and call `update`/`draw` every frame. Map E to `do('talk')`, Space to `do('jump')`, Shift to run. Read only `tokenfall-final/README.md` and `js/tokenfall-characters.js`. Don't open the image or JSON sprite files.
