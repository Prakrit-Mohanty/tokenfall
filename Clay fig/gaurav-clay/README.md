# Gaurav · Clay · Tokenfall character

> **Claude Code:** only read this README and `js/gaurav-clay.js` (~13 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Playable Gaurav in the glossy clay-toy 3D style, shot from a slightly raised camera. He walks in 4 directions. No dependencies, no build step. Try it with `npx serve .` and open `index.html`.

## Files

```
gaurav-clay/
├── index.html               demo
├── js/gaurav-clay.js        the player (UMD: <script>, import, require)
├── react/GauravClay.jsx     React / Next.js component ('use client')
├── react/App.example.jsx
└── sprites/
    ├── gaurav-clay.webp     sprite atlas, 280 KB (binary, don't read)
    ├── gaurav-clay.json     TexturePacker "JSON hash" (frames + meta.frameTags), for Phaser / Pixi / Godot / Unity
    └── reference.png        model pose
```

## Use it

Plain HTML:

```html
<div id="stage"></div>
<script src="/tokenfall/gaurav-clay.js"></script>
<script>
  const ctl = GauravClay.mount(document.getElementById('stage'), { src: '/tokenfall/gaurav-clay.webp' });
</script>
```

React / Next.js: copy `js/` and `react/` side by side, put `gaurav-clay.webp` at `public/tokenfall/gaurav-clay.webp`, then:

```jsx
import GauravClay from './react/GauravClay';
<GauravClay ref={hero} onState={(s) => console.log(s.label)} />   // hero.current.do('jump')
```

`mount` options / component props: `src`, `width` (860), `height` (620), `scale` (1), `speed` (200 px/s), `background` ('#335C44', null = transparent), `buttons`, `keyboard` (true | 'window' | false), `hud`, `autofocus`, `onState`.

Low level, for your own canvas and loop: `new GauravClay.Character(img, { x, y, scale })` → `setInput({up,down,left,right,run})`, `do('jump')`, `update(dtMs, {width,height})`, `draw(ctx)`, `state = { anim, dir, frame, label, lift }`.

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | walk |
| Shift (hold) | run (walk frames, faster) |
| Space | jump (hop in standing pose) |

## Sprite specs

Cell 250 × 230, feet anchor (125, 222), standing height ~172 px. 4 rows per animation in this order: down, up, left, right. Scale with smoothing on, since it's a 3D render. His head is locked to the same spot and size in every frame.

| Anim | Rows | Frames | ms/frame |
|---|---|---|---|
| idle | 0–3 | 1 | – |
| walk | 4–7 | 8 | 95 (run: 60) |

## Prompt for Claude Code

> Add the Gaurav clay character from `./gaurav-clay/`. Serve `sprites/gaurav-clay.webp` publicly. Use `react/GauravClay.jsx` if this is React, otherwise `GauravClay.mount` (or `GauravClay.Character` for an existing game loop) from `js/gaurav-clay.js`. Read only `gaurav-clay/README.md` and `js/gaurav-clay.js`. Don't open the image files.
