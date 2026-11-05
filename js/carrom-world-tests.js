// Self-test for the pure part of carrom-world.js (the board <-> world mapping and the coin styles). Run: node js/carrom-world-tests.js
// The scene itself (camera, light, plates, textures) is checked in a real browser: see the "how to test" notes in the step report.
const assert = require('assert');
const W = require('./carrom-world.js');
const P = require('./carrom-physics.js');
const { mulberry32 } = require('./bridge-generator.js');
const { CFG } = P;

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const TABLE = { x: 0.49, z: -309.01, top: 0.67, size: 1 };   // the HQ table, as the lobby reports it

test('mapper: board <-> world round-trips, the board is centred on the table and a unit is about 8 mm', () => {
  const m = W.makeMapper(TABLE), rng = mulberry32(1);
  for (let i = 0; i < 200; i++) { const bx = rng() * 100, by = rng() * 100, w = m.toWorld(bx, by), b = m.toBoard(w.x, w.z); assert(Math.abs(b.x - bx) < 1e-9 && Math.abs(b.y - by) < 1e-9); assert.strictEqual(w.y, TABLE.top); }
  const c = m.toWorld(50, 50); assert(Math.abs(c.x - TABLE.x) < 1e-12 && Math.abs(c.z - TABLE.z) < 1e-12);
  assert(Math.abs(m.u - 0.008125) < 1e-9); assert(Math.abs(m.play - 0.8125) < 1e-9, 'the playing area is the table minus the printed frame');
  const nw = m.toWorld(0, 0), se = m.toWorld(100, 100); assert(Math.abs((se.x - nw.x) - m.play) < 1e-9);
});

test('mapper: the pocket circles sit on the black squares the lobby\'s carrom texture already prints in its corners', () => {
  const m = W.makeMapper(TABLE), p = m.toWorld(P.POCKETS[0][0], P.POCKETS[0][1]);
  const fromEdge = (p.x - (TABLE.x - TABLE.size / 2)), square = 4.5 / 32;   // the texture's square is 3 px wide starting 3 px in: centre 4.5 px of 32
  console.log(`   pocket centre ${(fromEdge * 100).toFixed(1)} cm from the table edge, printed square ${(square * 100).toFixed(1)} cm`);
  assert(Math.abs(fromEdge - square) < 0.005);
  assert(P.POCKETS.every(([x, y]) => x === 6 || x === 94) && P.POCKETS.every(([x, y]) => y === 6 || y === 94));
});

test('the four coin styles differ in colour and in shape, so colour is never the only cue', () => {
  assert.strictEqual(new Set(W.STYLE.map((s) => s.hex)).size, 4); assert.strictEqual(new Set(W.STYLE.map((s) => s.glyph)).size, 4);
  assert.deepStrictEqual(W.STYLE.map((s) => s.name), ['amber', 'green', 'cyan', 'rose']);
});

test('the coin is drawn a little larger than its physics circle, but never so large that it overlaps the cushion visibly', () => {
  const m = W.makeMapper(TABLE), drawn = P.CFG.R_COIN * W.COIN_SCALE, overlap = (drawn - P.CFG.R_COIN) * m.u * 1000;
  console.log(`   drawn radius ${drawn.toFixed(2)} units, up to ${overlap.toFixed(1)} mm past the physics circle`); assert(overlap < 8 && W.COIN_SCALE > 1);
});

console.log(`\n${checks} checks passed`);
