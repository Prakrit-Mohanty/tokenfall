// Self-test for the pure part of the Token Tower world: poses, pull directions, orbit maths, tag layout. Run: node js/jenga-world-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const W = require('./jenga-world.js');
const E = require('./jenga-engine.js');
const G = require('./jenga-generator.js');
const CW = require('./carrom-world.js');

test('the answer slots use the same colour and shape language as House Rules Carrom (amber triangle, green circle, cyan diamond, rose square)', () => {
  assert.strictEqual(W.STYLE, CW.STYLE); assert.deepStrictEqual(W.STYLE.map((s) => s.glyph), ['triangle', 'circle', 'diamond', 'square']);
});
test('blockPose: even layers lie along X, odd along Z; a block sits half its height above its layer; the standard slots are one block width apart', () => {
  const a = W.blockPose({ layer: 0, uCoord: 1 }), b = W.blockPose({ layer: 1, uCoord: 1 }), s = W.blockSize();
  assert.deepStrictEqual([a.x, a.z, a.ry], [0, W.UNIT, 0]); assert.deepStrictEqual([b.x, b.z], [W.UNIT, 0]); assert(Math.abs(b.ry - Math.PI / 2) < 1e-12);
  assert(Math.abs(a.y - s.hgt / 2) < 1e-12 && Math.abs(b.y - 1.5 * s.hgt) < 1e-12);
  assert(Math.abs(s.len / s.wid - 3) < 1e-12 && Math.abs(s.len / s.hgt - 5) < 1e-12, 'the brief\'s 5 : 1.67 : 1');
});
test('every question\'s face letters agree with the direction the world pulls the block, for 200 seeds', () => {
  for (let i = 0; i < 200; i++) for (const q of G.composeRun(G.seedFor('w' + i, 0)).questions) for (const o of q.options) {
    const d = W.pullVec({ layer: o.layer }, q.view), f = W.FACE[o.face]; assert.deepStrictEqual(d, f, o.face);
    assert(d[0] * q.view.sx + d[1] * q.view.sz > 0, 'out of a face the camera sees');
  }
});
test('the camera turns to the corner whose two faces the candidates leave by: it sits on that side of the tower, and the turn takes the short way round', () => {
  for (const [corner, sx, sz] of [['NE', 1, -1], ['NW', -1, -1], ['SE', 1, 1], ['SW', -1, 1]]) {
    const az = W.azFor({ sx, sz }), p = W.orbitPose({ az, el: 0.3, dist: 7, lift: 0 }, [0, 2, 0]);
    assert(Math.sign(p.pos[0]) === sx && Math.sign(p.pos[2]) === sz, corner); assert(Math.abs(Math.hypot(p.pos[0], p.pos[2]) - 7 * Math.cos(0.3)) < 1e-9); assert(Math.abs(p.pos[1] - (2 + 7 * Math.sin(0.3))) < 1e-9);
  }
  let a = 3, steps = 0; while (a !== -3 && steps++ < 100) a = W.easeAngle(a, -3, 0.1);
  assert(steps < 10, 'from 3 to -3 radians is a 0.28 turn through pi, not a 6 radian one'); assert(Math.abs(W.wrap(7) - (7 - 2 * Math.PI)) < 1e-12);
});
test('frame: a taller tower gets a further, higher view, never below the 16-layer one; a narrower lens stands further back, and the tower always fills the same share of the view', () => {
  const a = W.frame(10), b = W.frame(16), c = W.frame(19); assert.deepStrictEqual(a, b); assert(c.dist > b.dist && c.lookY > b.lookY);
  assert(W.frame(16, 26).dist > W.frame(16, 48).dist * 1.8);
  for (const fov of [26, 48, 60]) { const f = W.frame(16, fov), h = 16 * W.blockSize().hgt, shown = 2 * f.dist * Math.tan(fov * Math.PI / 360); assert(h / shown > 0.45 && h / shown < 0.65, fov + ': ' + (h / shown)); }
});
test('clearReach: a lamp pole on the sightline pulls the camera in (never below 78%); wide props and poles off to the side or behind are ignored', () => {
  const at = [0, 0], reach = 5, pole = { x: 3, z: 3, r: 0.2 };   // on the diagonal, 4.2 out
  assert(W.clearReach(at, Math.PI / 4, reach, [pole]) < reach); assert(W.clearReach(at, Math.PI / 4, reach, [pole]) >= reach * 0.78);
  assert.strictEqual(W.clearReach(at, -Math.PI / 4, reach, [pole]), reach, 'a pole behind the tower');
  assert.strictEqual(W.clearReach(at, Math.PI / 4, reach, [{ x: 3, z: 3, r: 1.1 }]), reach, 'an umbrella table: the camera is above it');
  assert.strictEqual(W.clearReach(at, Math.PI / 4, reach, [{ x: 1.4, z: 4.2, r: 0.2 }]), reach, 'a pole well off the line');
  assert.strictEqual(W.clearReach(at, Math.PI / 4, reach, [{ x: 0.4, z: 0.4, r: 0.2 }]), reach, 'something at the table itself');
  const near = W.clearReach(at, 0, 5, [{ x: 0, z: 4, r: 0.2 }]); assert(Math.abs(near - 3.9) < 0.31 || near === 5 * 0.78);
});
test('deconflict: tags that would overlap are pushed apart, tags that do not are left alone, and the same input gives the same layout', () => {
  const mk = () => [{ x: 400, y: 200, w: 160, h: 28 }, { x: 430, y: 205, w: 160, h: 28 }, { x: 410, y: 210, w: 150, h: 28 }, { x: 900, y: 300, w: 100, h: 28 }];
  const r = W.deconflict(mk(), 4), far = mk()[3];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const a = r[i], b = r[j]; assert(Math.abs(a.y - b.y) >= 28 + 3.9 || Math.abs(a.x - b.x) >= (a.w + b.w) / 2, `${i} and ${j} still overlap`); }
  assert.deepStrictEqual(r[3], far); assert.deepStrictEqual(W.deconflict(mk(), 4), r);
});
test('tint: each block a stable, slightly different shade of wood', () => {
  const t = E.blocks(E.fullTower()).map((b) => W.tint(b.id)); assert(t.every((x) => x >= 0.9 && x <= 1.1)); assert(new Set(t.map((x) => x.toFixed(3))).size >= 35); assert.strictEqual(W.tint('b3.1'), W.tint('b3.1'));
});
done();
