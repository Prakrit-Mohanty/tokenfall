# Gaurav · Tokenfall NPC

> **Claude Code:** only read this README and `js/gaurav-npc.js` (~12 KB). Don't open `sprites/*.webp` or `*.png`. They're images, and reading them wastes context.

Gaurav is an NPC, not a playable character. He wanders, stops now and then to say a line, and says one **every time the player walks up to him**. While he talks, a speech bubble shows the quote (Hindi by default) and he plays a slow 4-frame talking loop, facing the player. No dependencies, no build step.

## Files

```
gaurav-npc/
├── index.html            demo (run with: npx serve .)
├── js/gaurav-npc.js      the NPC (UMD: <script>, import, require)
├── react/GauravNPC.jsx   useGauravNPC() hook + a demo component ('use client')
└── sprites/
    ├── gaurav.webp       sprite atlas, 660 KB (binary, don't read)
    ├── gaurav.json       TexturePacker "JSON hash" (frames + meta.frameTags), for Phaser / Pixi / Godot / Unity
    └── reference.png     model pose
```

## Drop it into an existing canvas game

```js
const img = new Image(); img.src = '/tokenfall/gaurav.webp';
const gaurav = new GauravNPC.NPC(img, {
  x: 300, y: 420,
  scale: (y) => 0.42 + 0.26 * (y - 372) / 332,  // number, or a function of y for perspective
  quotes: ['...'],                              // optional, replaces the defaults
  onSay: (text) => console.log('Gaurav:', text) // optional, e.g. push into your chat log
});

// every frame
gaurav.update(dtMs, { player: { x: player.x, y: player.y }, bounds: { minX: 80, maxX: 780, minY: 380, maxY: 700 } });
gaurav.draw(ctx);           // shadow + sprite + name tag, or speech bubble while talking

// on demand (E key, click…)
gaurav.say(null, player);   // next quote, facing the player
gaurav.say('Custom line');  // specific text
```

`x, y` is the point under his feet. Draw him in y-order with your other sprites.

Options: `x`, `y`, `scale` (1), `speed` (75 px/s), `quotes`, `talkMs` (3800), `nearDist` (130), `ambient` (true, he talks on his own every 9–16 s), `wander` (true), `name` ('Gaurav', or null to hide the tag), `font` (bubble font), `onSay(text)`.

`update()` returns `{ mode: 'idle'|'walk'|'talk', dir, frame, talking, quote }`. Use it if you'd rather render the bubble in your own UI.

The bubble uses Noto Sans Devanagari if the page loads it (see `index.html`). Otherwise it falls back to the system font.

## React / Next.js

Copy `js/` and `react/` side by side, and put `gaurav.webp` at `public/tokenfall/gaurav.webp`.

```jsx
import { useGauravNPC } from './react/GauravNPC';
const gaurav = useGauravNPC('/tokenfall/gaurav.webp', { x: 300, y: 420 });
// in your loop: gaurav.current?.update(dt, {...}); gaurav.current?.draw(ctx);
```

## Sprite specs

Cell 250 × 230, feet anchor (125, 222), standing height 172 px. 4 rows per animation in this order: down, up, left, right. Scale with smoothing on, since it's a 3D render.

| Anim | Rows | Frames | ms/frame |
|---|---|---|---|
| idle | 0–3 | 11 | 200 |
| walk | 4–7 | 10 | 95 |
| talk | 8–11 | 4 | 320 (rest, half-raise, open hands, half-raise; loops) |

## Prompt for Claude Code

> Add Gaurav from `./gaurav-npc/` as an NPC in the plaza. Serve `sprites/gaurav.webp` publicly. Create a `GauravNPC.NPC`, call `update(dt, { player, bounds })` and `draw(ctx)` every frame, and depth-sort him with the other sprites by `y`. Pipe `onSay` into the chat log. Read only `gaurav-npc/README.md` and `js/gaurav-npc.js`. Don't open the image files.
