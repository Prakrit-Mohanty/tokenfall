# Tokenfall Characters

> **Claude Code:** only read this README and `js/tokenfall-characters.js` (~14 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

The playable roster plus Gaurav, in the clay-toy 3D style, as sprite sheets with a tiny player. No dependencies, no build step. Try it: `npx serve .` then open `index.html`.

| id | Name | Facings | Moves |
|---|---|---|---|
| `saanvi` | Saanvi | 8 | idle, walk, run, jump (8 dirs) · crouch (4 dirs) |
| `mehta` | Mr. Mehta | 8 | idle, walk, run, jump (8 dirs) · crouch (4 dirs) |
| `aarav` | Aarav | 8 | idle, walk, run, jump (8 dirs) · crouch (4 dirs) |
| `riya` | Riya | 8 | idle, walk (8 dirs) · run, jump, crouch (4 dirs) |
| `gaurav` | Gaurav | 12 | idle, walk, run (12 dirs) · talk (4 dirs) · jump = hop in standing pose |

When an animation has fewer directions than the character is facing, the player uses the nearest one.

## Files

```
tokenfall-characters/
├── index.html                     demo with character picker
├── js/tokenfall-characters.js     the player (UMD: <script>, import, require)
├── react/TokenfallCharacters.jsx  React / Next.js component + useTokenfallCharacter() hook
└── sprites/
    ├── <id>.webp                  sprite atlas per character (binary, don't read)
    ├── <id>.json                  TexturePacker "JSON hash" (frames + meta.frameTags + meta.animations)
    └── <id>-portrait.png          picker / character-select image
```

## Use it

Demo widget (picker, keyboard, buttons, click-to-walk):

```html
<div id="stage"></div>
<script src="/tokenfall/tokenfall-characters.js"></script>
<script>
  const ctl = TokenfallCharacters.mount(document.getElementById('stage'), {
    assetsBase: '/tokenfall/sprites/', character: 'riya',
    onSelect: (id) => localStorage.setItem('tokenfall.char', id)
  });
</script>
```

Inside your own game loop (one character per player):

```js
const hero = TokenfallCharacters.create('aarav', '/tokenfall/sprites/', { x: 400, y: 450, scale: 0.8 });
hero.setInput({ up: true, right: true, run: false }); // any combo, diagonals included
hero.walkTo(x, y);                                     // or click-to-move, any angle
hero.do('jump');                                       // 'jump' | 'crouch' (toggle) | 'talk' (Gaurav) | 'run' (toggle)
// each frame:
hero.update(dtMs, { width, height }); hero.draw(ctx);  // y-sort characters by hero.y before drawing
```

`hero.state` = `{ anim, angle, frame, label, lift }`. `hero.actions()` lists what that character supports. Set `hero.angle` (degrees, 0 = facing camera, clockwise) to face a direction without moving. That's handy for multiplayer: send `{x, y, angle, anim}` and draw remote players with the same calls.

React / Next.js: copy `js/` and `react/` side by side, put `sprites/` at `public/tokenfall/sprites/`, then `<TokenfallCharacters character="mehta" />` or `useTokenfallCharacter('saanvi')`.

## Sprite specs

- Every cell is 250 × 230 px. Feet anchor is at (125, 222). Standing height is ~172 px, and all five characters are matched to that.
- Angles: 0 = facing the camera, then clockwise. 90 = facing right, 180 = back, 270 = facing left.
- 8-direction rows go 0, 45 … 315. 12-direction rows go 0, 30 … 330. 4-direction rows go down (0), up (180), left (270), right (90).
- Row layout, frame counts and per-frame jump heights are in `ROSTER` at the top of the JS and in each JSON's `meta.animations`.
- Every frame is lined up so the head stays put, which stops sliding and size pulsing.
- It's a 3D render, so scale with smoothing on.

## Prompt for Claude Code

> Add the Tokenfall characters from `./tokenfall-characters/` as the player characters. Serve `sprites/` publicly. Use `TokenfallCharacters.create(id, base)` for each player inside our game loop (call `update` and `draw` every frame, y-sort with other sprites). Map our movement input to `setInput` / `walkTo`, and Space/C/E to `do('jump' | 'crouch' | 'talk')`. Use `<id>-portrait.png` on the character-select screen. Read only `tokenfall-characters/README.md` and `js/tokenfall-characters.js`. Don't open the image files.
