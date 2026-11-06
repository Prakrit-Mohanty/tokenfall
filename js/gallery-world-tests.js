// Self-test for the pure part of Spot Shot's world: the stall-to-lobby mapping, the camera fit, the reticle, the inspect hold, the card text. Run: node js/gallery-world-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const W = require('./gallery-world.js');
const E = require('./gallery-engine.js');
const BG = require('./bridge-generator.js');

const at = [10, 18.2];
test('mapping: stall-local x is the lobby\'s x, local z runs north from the counter, y is unchanged, and the mapping inverts', () => {
  assert.deepStrictEqual(W.toWorld(at, [0, 1, 0]), [10, 1, 18.2]); assert.deepStrictEqual(W.toWorld(at, [2, 2, 3]), [12, 2, 15.2]);
  for (const p of [[-2.5, 1.2, 0.9], [2.5, 2.06, 2.3], [0, 0, 0]]) assert.deepStrictEqual(W.fromWorld(at, W.toWorld(at, p)).map((v) => +v.toFixed(9)), p);
  // the shelves sit north of the counter and inside the stall's footprint (x 6.65 to 13.35, z 14.9 to 18.7), clear of the pool deck's collider (z <= 14.6 + 0.32)
  for (const ln of E.LAYOUT.lanes) { const w = W.toWorld(at, [0, ln.y, ln.z]); assert(w[2] < 18.2 && w[2] > 14.95); }
  assert(W.toWorld(at, [E.LAYOUT.rail / 2 + 0.7, 0, 3.1])[0] < 13.5, 'ticket windows stay inside the posts');
});
test('camera: the whole rail and both ticket windows are on screen at 16:9, 4:3, 1:1 and a tall phone window; the engine and the world agree on the camera', () => {
  const half = E.LAYOUT.rail / 2 + 0.8;
  for (const aspect of [16 / 9, 16 / 10, 4 / 3, 1, 0.56]) {
    const cam = W.fitCam(aspect);
    for (const ln of E.LAYOUT.lanes) for (const x of [-half, half]) { const n = E.ndcOf(cam, aspect, [x, ln.y, ln.z]); assert(Math.abs(n.x) <= 1, `aspect ${aspect.toFixed(2)} lane ${ln.z}: x ${n.x.toFixed(2)} is off screen`); assert(Math.abs(n.y) <= 1); }
    assert.strictEqual(cam.fov, E.LAYOUT.camera.fov); assert.deepStrictEqual(cam.look, E.LAYOUT.camera.look);
  }
  assert.deepStrictEqual(W.fitCam(16 / 9).pos, E.LAYOUT.camera.pos, 'at 16:9 the layout camera is used as it is');
  assert(W.fitCam(1).pos[2] < E.LAYOUT.camera.pos[2], 'a narrower window pulls the camera back (further south)');
  // a card in the middle of a lane: aiming at its projected centre hits it from every fitted camera
  const round = E.composeRun(11, null).rounds[0], e = round.schedule[0], t = e.spawnTime + e.rise + 2, c = E.cardPose(e, t);
  for (const aspect of [16 / 9, 4 / 3, 0.8]) { const cam = W.fitCam(aspect), n = E.ndcOf(cam, aspect, [c.x, c.y, c.z]); assert.strictEqual(E.hitTest(round.schedule, t, E.rayFromNdc(cam, aspect, n.x, n.y)).uid, e.uid); }
});
test('screen directions: even lanes run left to right on screen, odd lanes right to left (x grows to the right of the camera)', () => {
  const cam = W.fitCam(16 / 9), e = (lane) => ({ lane, dir: lane % 2 === 0 ? 1 : -1, x0: 0, rise: 0, dur: 7, speed: 1 / 7, spawnTime: 0, uid: 'l' + lane });
  for (const lane of [0, 1, 2]) {
    const a = E.cardPose(e(lane), 1), b = E.cardPose(e(lane), 4), na = E.ndcOf(cam, 16 / 9, [a.x, a.y, a.z]).x, nb = E.ndcOf(cam, 16 / 9, [b.x, b.y, b.z]).x;
    assert(lane % 2 === 0 ? nb > na : nb < na, 'lane ' + lane);
  }
});
test('reticle: arrow keys move it, Shift is faster, opposite keys cancel, and it never leaves the screen', () => {
  let r = { nx: 0, ny: 0 };
  r = W.stepReticle(r, { right: true }, 0.5); assert(r.nx > 0.4 && r.ny === 0);
  const slow = W.stepReticle({ nx: 0, ny: 0 }, { up: true }, 0.1), fast = W.stepReticle({ nx: 0, ny: 0 }, { up: true, shift: true }, 0.1); assert(fast.ny > slow.ny * 2);
  assert.deepStrictEqual(W.stepReticle({ nx: 0.3, ny: -0.2 }, { left: true, right: true }, 1), { nx: 0.3, ny: -0.2 });
  for (let i = 0; i < 100; i++) r = W.stepReticle(r, { right: true, up: true }, 0.1); assert(r.nx === 1 && r.ny === 1);
  for (let i = 0; i < 100; i++) r = W.stepReticle(r, { left: true, down: true, shift: true }, 0.1); assert(r.nx === -1 && r.ny === -1);
});
test('inspect hold: about 0.6 s on one card; moving to another card or off every card starts again', () => {
  let h = { uid: null, t: 0 }; const step = (uid, dt) => (h = W.holdStep(h, uid, dt));
  assert(!step('a', 0.3).done && Math.abs(h.progress - 0.5) < 1e-9); assert(!step('a', 0.29).done); assert(step('a', 0.05).done && h.progress === 1);
  h = { uid: null, t: 0 }; step('a', 0.4); assert(h.progress > 0.6 && !h.done); step('b', 0.1); assert(h.uid === 'b' && Math.abs(h.t - 0.1) < 1e-9, 'a different card starts again from zero'); step('b', 0.4); step(null, 0.1); assert(h.t === 0 && h.progress === 0, 'off every card resets');
  assert.strictEqual(W.HOLD, 0.6);
});
test('card text: wrapping keeps every word, never overflows a line, and cuts a word that is wider than the line', () => {
  const measure = (s) => s.length * 9;
  let n = 0;
  for (const c of require('./gallery-content.js').CONCEPTS) for (const v of c.variants) for (const it of v.items) {
    const lines = W.wrapLines(it.card.body, 296, measure); n++;
    assert(lines.every((l) => measure(l) <= 296), it.id + ' overflows'); assert.strictEqual(lines.join(' ').replace(/\s+/g, ' '), it.card.body.replace(/\s+/g, ' ').trim());
    assert(lines.length <= 7 + 1, it.id + ' needs ' + lines.length + ' lines');
  }
  assert.deepStrictEqual(W.wrapLines('a verylongwordhere b', 45, measure).every((l) => measure(l) <= 45), true); assert.deepStrictEqual(W.wrapLines('', 100, measure), []);
  console.log('   ' + n + ' card bodies wrapped at 296 px');
});
test('a card shows what it is, never what it must be: the text a card shows carries no threat flag, kind, cue, stamp or tell', () => {
  const run = E.composeRun(BG.hash32('look'), null);
  for (const it of run.rounds.flatMap((r) => r.items)) {
    const shown = W.cardText(it.card).join(' | ');
    assert(shown.startsWith(W.TYPE_LABEL[it.card.type]), shown); for (const secret of [it.stamp, it.tell, it.inspect]) assert(!shown.includes(secret), 'a card must not print its own verdict: ' + secret);
  }
  assert.deepStrictEqual(W.cardText({ type: 'email', from: 'A', subject: 'S', body: 'B' }), ['EMAIL', 'A', 'S', 'B']); assert.deepStrictEqual(W.cardText({ type: 'voice', from: 'A', body: 'B' }), ['VOICE NOTE', 'A', 'B']);
});
done();
