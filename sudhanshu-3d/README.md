# Sudhanshu 3D · Tokenfall character

> **Claude Code:** only read this README and `js/sudhanshu3d.js` (~13 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Playable 3D-chibi Sudhanshu. Every animation works in all 4 directions. No dependencies, no build step. Try it with `npx serve .` and open `index.html`.

## Files

```
sudhanshu-3d/
├── index.html               demo
├── js/sudhanshu3d.js        the player (UMD: <script>, import, require)
├── react/Sudhanshu3D.jsx    React / Next.js component ('use client')
├── react/App.example.jsx
└── sprites/
    ├── sudhanshu3d.webp     sprite atlas, 1.8 MB (binary, don't read)
    ├── sudhanshu3d.json     TexturePacker "JSON hash" (frames + meta.frameTags), for Phaser / Pixi / Godot / Unity
    └── reference.png        model pose
```

## Use it

Plain HTML:

```html
<div id="stage"></div>
<script src="/tokenfall/sudhanshu3d.js"></script>
<script>
  const ctl = Sudhanshu3D.mount(document.getElementById('stage'), { src: '/tokenfall/sudhanshu3d.webp' });
  ctl.do('celebrate');   // trigger an action from your own UI
</script>
```

React / Next.js: copy `js/` and `react/` (side by side), put `sudhanshu3d.webp` at `public/tokenfall/sudhanshu3d.webp`, then:

```jsx
import Sudhanshu3D from './react/Sudhanshu3D';
<Sudhanshu3D ref={hero} onState={(s) => console.log(s.label)} />   // hero.current.do('nap')
```

`mount` options / component props: `src`, `width` (860), `height` (620), `scale` (1), `speed` (200 px/s), `background` ('#335C44', null = transparent), `buttons`, `keyboard` (true | 'window' | false), `hud`, `autofocus`, `onState`.

Low level: `new Sudhanshu3D.Character(img, { x, y, scale })` → `setInput({up,down,left,right,run})`, `do(action)`, `update(dtMs, {width,height})`, `draw(ctx)`, `state = { anim, dir, frame, label, lift }`.

## Actions

| Key | Action | Type |
|---|---|---|
| Arrows / WASD | walk | loop |
| Shift (hold) | run | loop |
| Space | `jump` | once |
| E | `celebrate` | once |
| Z | `nap` | toggle: yawns, lies down, then loops sleeping. Moving wakes him |

## Sprite specs

Cell 250 × 230, feet anchor (125, 222), standing height 172 px. Each animation uses 4 rows (down, up, left, right). Scale with smoothing on, because it's a 3D render.

| Anim | Row | Frames | ms/frame |
|---|---|---|---|
| idle | 0 | 11 | 160 |
| walk | 4 | 11 | 83 |
| run | 8 | 10 | 60 |
| jump | 12 | 11 | 80 (lift 34 px over frames 3–7) |
| nap | 16 | 12 | 180, then loop frames 7–8 at 650 |
| celebrate | 20 | 12 | 95 |

## Prompt for Claude Code

> Add the Sudhanshu 3D character from `./sudhanshu-3d/`. Serve `sprites/sudhanshu3d.webp` publicly. Use `react/Sudhanshu3D.jsx` if this is React, otherwise `Sudhanshu3D.mount` from `js/sudhanshu3d.js`. Read only `sudhanshu-3d/README.md` and `js/sudhanshu3d.js`. Don't open the image files.
