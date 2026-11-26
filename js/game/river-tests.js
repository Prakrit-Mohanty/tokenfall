// TokenFall: river tests (plain node): the current is quickest mid-stream, the sliding patterns wrap without a seam, and every fish leaps from open
// water into open water, clear of the kerbs and the bridge, where the player can see it.
//   node js/game/river-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const { RIVER, RIVER_SPEEDS, RIVER_LEAPS, RIVER_FISH, riverWrap, riverFlowAt, riverPlanJump, riverRng, RIVER_HEAD, RIVER_SURFACE } = require('./river.js');

const LOBBY_RIVER = { x0: -53, x1: 53, zc: -34, hw: 3.5 - RIVER.KERB };   // lobby-village.js: V_RIVER = [-53, -37.5, 53, -30.5]
const E = 1e-9;

test('the current runs fastest mid-stream and eases off smoothly toward the kerbs', () => {
  assert(Math.abs(riverFlowAt(0) - RIVER.MID) < E && Math.abs(riverFlowAt(1) - RIVER.EDGE) < E);
  let last = Infinity;
  for (let a = 0; a <= 1 + E; a += .01) { const v = riverFlowAt(a); assert(v <= last + E, 'never speeds up toward the bank'); assert(Math.abs(v - last) < .06 || last === Infinity, 'no jump in speed'); last = v; }
  assert.strictEqual(riverFlowAt(-.4), riverFlowAt(.4), 'the same on both sides of mid-stream');
});

test('the flow offsets stay inside the wrap and advance by exactly speed x time, modulo the wrap', () => {
  const rng = riverRng(7);
  for (let i = 0; i < 2000; i++) {
    const t = rng() * 1e5, dt = rng() * .05;
    for (const v of RIVER_SPEEDS) {
      const a = riverWrap(v * t), b = riverWrap(v * (t + dt));
      assert(a >= 0 && a < RIVER.WRAP && b >= 0 && b < RIVER.WRAP);
      const step = ((b - a) % RIVER.WRAP + RIVER.WRAP) % RIVER.WRAP;
      assert(Math.abs(step - v * dt) < 1e-6, 'a frame moves the water by its speed, also across the wrap');
    }
  }
});

test('every pattern the water slides repeats exactly over the wrap, so the jump back to zero never shows', () => {
  // a lattice pattern scaled by s along the river repeats every 289 / s metres; the wrap must hold a whole number of those repeats
  const src = RIVER_HEAD + RIVER_SURFACE, scales = [];
  for (const m of src.matchAll(/p[ME][12](?:\s*\+\s*vec2\([^)]*\))?\s*\*\s*(?:vec2\(\s*([\d.]+)|([\d.]+))/g)) scales.push(+(m[1] || m[2]));
  const dash = /vec2 c = p \* vec2\(([\d.]+),/.exec(src); assert(dash, 'the dash cells are found'); scales.push(+dash[1]);
  assert(scales.length >= 12, 'found the sliding patterns (' + scales.length + ')');
  for (const s of scales) { const n = RIVER.WRAP * s / 289; assert(Math.abs(n - Math.round(n)) < 1e-9, `a pattern scaled ${s} along the river would show a seam at the wrap`); }
});

test('a fish leaps from open water and lands in open water: clear of the kerbs, the bridge and the river\'s ends', () => {
  const rng = riverRng(42), { x0, x1, zc, hw } = LOBBY_RIVER, lane = hw - .75;
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const hero = { x: x0 + 4 + rng() * (x1 - x0 - 8), z: zc - 2 + rng() * 28 }, j = riverPlanJump(rng, hero, LOBBY_RIVER);
    if (!j) continue; n++;
    for (const [x, z] of [[j.x, j.z], [j.ex, j.ez]]) { assert(Math.abs(z - zc) <= lane + E, 'off the kerbs'); assert(x >= x0 + 3 - E && x <= x1 - 3 + E, 'not at the island\'s edge'); }
    assert(!(Math.min(j.x, j.ex) < RIVER.DECK[1] + 1.2 && Math.max(j.x, j.ex) > RIVER.DECK[0] - 1.2), 'never under the bridge or over it');
    const len = Math.hypot(j.ex - j.x, j.ez - j.z); assert(len > 1.2 && len < 2.7, 'a leap of a metre or two');
    assert(j.h >= .55 && j.h <= 1.2, 'up to about a metre high');
    const flight = 2 * Math.sqrt(2 * j.h / 9.8); assert(j.dur >= flight - E && j.dur <= flight * 1.1 + E, 'it flies for as long as a fish thrown that high would');
  }
  assert(n > 3000, 'most tries find a leap (' + n + ')');
});

test('every way of leaping (a somersault, a flying fish\'s glide, a shoal, a pufferfish) stays in open water, at its own length and height', () => {
  const rng = riverRng(11), { x0, x1, zc, hw } = LOBBY_RIVER, lane = hw - .75;
  for (const [style, L] of Object.entries(RIVER_LEAPS)) {
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      const j = riverPlanJump(rng, { x: x0 + 4 + rng() * (x1 - x0 - 8), z: zc + 2 + rng() * 20 }, LOBBY_RIVER, style);
      if (!j) continue; n++;
      assert.strictEqual(j.style, style);
      for (const [x, z] of [[j.x, j.z], [j.ex, j.ez]]) assert(Math.abs(z - zc) <= lane + E && x >= x0 + 3 - E && x <= x1 - 3 + E, style + ': in open water');
      assert(!(Math.min(j.x, j.ex) < RIVER.DECK[1] + 1.2 && Math.max(j.x, j.ex) > RIVER.DECK[0] - 1.2), style + ': clear of the bridge');
      const len = Math.hypot(j.ex - j.x, j.ez - j.z); assert(len >= L.len[0] - E && len <= L.len[1] + E, style + ': its own length');
      assert(j.h >= L.h[0] - E && j.h <= L.h[1] + E && j.dur > .3 && j.dur < 1.6, style + ': its own height and a believable time in the air');
    }
    assert(n > 1000, style + ' finds room to leap (' + n + ')');
  }
  assert(RIVER_LEAPS.glide.len[0] > RIVER_LEAPS.leap.len[1] && RIVER_LEAPS.glide.h[1] < RIVER_LEAPS.leap.h[1], 'a flying fish goes further and lower than a leap');
  assert(Object.keys(RIVER_FISH).length >= 8, 'plenty of kinds of fish');
});

test('fish leap where the player can see them, and mostly upstream', () => {
  const rng = riverRng(3), { zc } = LOBBY_RIVER;
  assert.strictEqual(riverPlanJump(rng, { x: 10, z: zc - 6 }, LOBBY_RIVER), null, 'not from across the river (the camera looks the other way)');
  assert.strictEqual(riverPlanJump(rng, { x: 10, z: zc + 40 }, LOBBY_RIVER), null, 'not from far off');
  let up = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const hero = { x: -30 + rng() * 60, z: zc + 3 + rng() * 15 }, j = riverPlanJump(rng, hero, LOBBY_RIVER);
    if (!j) continue; n++;
    assert(Math.abs(j.x - Math.max(-49, Math.min(49, hero.x))) <= 9 + E, 'it leaves the water within 9 m of the player');
    if (j.ex < j.x) up++;
  }
  assert(up / n > .6, 'most leap upstream, against the current (' + (100 * up / n).toFixed(0) + '%)');
});

done();
