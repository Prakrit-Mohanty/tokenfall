# Aditya 3D · Tokenfall character

> **Claude Code:** only read this README and `js/aditya3d.js` (~14 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Playable 3D-chibi Aditya. 13 animations, no dependencies, no build step. Open `index.html` through a local server (`npx serve .`) to try it.

## Files

```
aditya-3d/
├── index.html            demo
├── js/aditya3d.js        the player (UMD: <script>, import, require)
├── react/Aditya3D.jsx    React / Next.js component ('use client')
├── react/App.example.jsx
└── sprites/
    ├── aditya3d.webp     sprite atlas, 2.2 MB (binary, don't read)
    ├── aditya3d.json     TexturePacker "JSON hash" (frames + meta.frameTags), for Phaser / Pixi / Godot / Unity
    └── reference.png     model pose
```

## Use it

Plain HTML:

```html
<div id="stage"></div>
<script src="/tokenfall/aditya3d.js"></script>
<script>
  const ctl = Aditya3D.mount(document.getElementById('stage'), { src: '/tokenfall/aditya3d.webp' });
  ctl.do('celebrate');   // trigger any action from your own UI
</script>
```

React / Next.js: copy `js/` and `react/` (side by side), put `aditya3d.webp` at `public/tokenfall/aditya3d.webp`, then:

```jsx
import Aditya3D from './react/Aditya3D';
<Aditya3D ref={hero} onState={(s) => console.log(s.label)} />   // hero.current.do('nap')
```

`mount` options / component props: `src`, `width` (860), `height` (620), `scale` (1), `speed` (200 px/s), `background` ('#335C44', null = transparent), `buttons`, `keyboard` (true | 'window' | false), `hud`, `autofocus`, `onState`.

Low level: `new Aditya3D.Character(img, { x, y, scale })` → `setInput({up,down,left,right,run})`, `do(action)`, `update(dtMs, {width,height})`, `draw(ctx)`, `state = { anim, dir, frame, label, lift }`.

## Actions

| Key | Action | Type |
|---|---|---|
| Arrows / WASD | walk | 4 directions |
| Shift | run | 4 directions |
| Space | `jump` | once, 4 directions |
| E | `celebrate` | once, front only |
| F | `interact` | once, 4 directions |
| C | `crouch` | toggle, 4 directions |
| V | `sit` | toggle, 4 directions |
| G | `pickup` (coin) | once, front only |
| B | `box` (put down) | once, front only |
| Z | `nap` | toggle, front only, loops while asleep |
| T | `trip` | once, front only |
| X | `faint` | toggle, 4 directions |

Moving cancels poses and actions.

## Sprite specs

Cell 250 × 230, feet anchor (125, 222), standing height 172 px. Directional animations use 4 rows (down, up, left, right). Front-only ones use 1 row. It's a 3D render, so scale it with smoothing on. Rows: idle 0, walk 4, run 8, jump 12, faint 16, crouch 20, sit 24, interact 28, celebrate 32, nap 33, pickup 34, box 35, trip 36.

## Prompt for Claude Code

> Add the Aditya 3D character from `./aditya-3d/`. Serve `sprites/aditya3d.webp` publicly. Use `react/Aditya3D.jsx` if this is React, otherwise `Aditya3D.mount` from `js/aditya3d.js`. Read only `aditya-3d/README.md` and `js/aditya3d.js`. Don't open the image files.
