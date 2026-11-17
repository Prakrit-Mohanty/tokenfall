// Self-test for the minigame event adapter. Run: node js/game/game-events-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const { forward } = require('./game-events.js');

const fakePlay = () => {
  const listeners = {};
  return {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return fn; },
    emit(type, data = {}) { const e = Object.assign({ type, at: 1 }, data); (listeners[type] || []).forEach((f) => f(e)); },
  };
};

const collect = () => { const got = []; return { got, fire: (e) => got.push(e) }; };

test('run becomes a start event named after the game', () => {
  const carrom = fakePlay(), { got, fire } = collect();
  forward({ carrom }, fire);
  carrom.emit('run', { runIndex: 3 });
  assert.deepStrictEqual(got, [{ game: 'carrom', phase: 'start', completed: false, stars: null }]);
});

test('finish becomes a completed end event carrying the stars', () => {
  const jenga = fakePlay(), { got, fire } = collect();
  forward({ jenga }, fire);
  jenga.emit('finish', { stars: 2, points: 9 });
  assert.deepStrictEqual(got, [{ game: 'jenga', phase: 'end', completed: true, stars: 2 }]);
});

test('abandon becomes an incomplete end event with no stars', () => {
  const gallery = fakePlay(), { got, fire } = collect();
  forward({ gallery }, fire);
  gallery.emit('abandon', { rounds: 1 });
  assert.deepStrictEqual(got, [{ game: 'gallery', phase: 'end', completed: false, stars: null }]);
});

test('a finish without a numeric star count reports null, not undefined or NaN', () => {
  const bridge = fakePlay(), { got, fire } = collect();
  forward({ bridge }, fire);
  bridge.emit('finish', {});
  bridge.emit('finish', { stars: '3' });
  assert.deepStrictEqual(got.map((e) => e.stars), [null, null]);
});

test('other in-game events (shot, round, ghost, fall) are not forwarded', () => {
  const carrom = fakePlay(), { got, fire } = collect();
  forward({ carrom }, fire);
  for (const t of ['shot', 'round', 'ghost', 'fall']) carrom.emit(t, { stars: 3, correct: true });
  assert.strictEqual(got.length, 0);
});

test('answer becomes an answer event carrying only whether it was correct', () => {
  const gallery = fakePlay(), { got, fire } = collect();
  forward({ gallery }, fire);
  gallery.emit('answer', { correct: true, conceptId: 'G1', credit: false });
  gallery.emit('answer', { correct: false, wrongId: 'x' });
  assert.deepStrictEqual(got, [{ game: 'gallery', phase: 'answer', correct: true }, { game: 'gallery', phase: 'answer', correct: false }]);
});

test('an answer without a boolean correct flag is dropped, never counted as wrong', () => {
  const jenga = fakePlay(), { got, fire } = collect();
  forward({ jenga }, fire);
  jenga.emit('answer', {}); jenga.emit('answer', { correct: 'yes' }); jenga.emit('answer', { correct: 1 });
  assert.strictEqual(got.length, 0);
});

test('a game that is not loaded is skipped and the others still forward', () => {
  const jenga = fakePlay(), { got, fire } = collect();
  forward({ carrom: undefined, gallery: null, jenga, bridge: {} }, fire);
  jenga.emit('run');
  assert.deepStrictEqual(got.map((e) => e.game), ['jenga']);
});

test('each game keeps its own name when several are forwarded', () => {
  const carrom = fakePlay(), jenga = fakePlay(), { got, fire } = collect();
  forward({ carrom, jenga }, fire);
  jenga.emit('run'); carrom.emit('finish', { stars: 1 });
  assert.deepStrictEqual(got.map((e) => [e.game, e.phase]), [['jenga', 'start'], ['carrom', 'end']]);
});

test('a throwing listener cannot break the game that emitted the event', () => {
  const carrom = fakePlay(), errors = [], err = console.error;
  console.error = (...a) => errors.push(a);
  try {
    forward({ carrom }, () => { throw new Error('boom'); });
    let after = false;
    carrom.on('finish', () => { after = true; });
    assert.doesNotThrow(() => carrom.emit('finish', { stars: 3 }));
    assert(after, 'the game\'s own later finish listener still ran');
    assert.strictEqual(errors.length, 1, 'the failure is logged, not swallowed');
  } finally { console.error = err; }
});

test('forwarding twice is not needed: one forward, one event per emit', () => {
  const bridge = fakePlay(), { got, fire } = collect();
  forward({ bridge }, fire);
  bridge.emit('run'); bridge.emit('run');
  assert.strictEqual(got.length, 2);
});

done();
