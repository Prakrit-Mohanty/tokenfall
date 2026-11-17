// Self-test for TOKEN-1's accuracy meter. Run: node js/game/token1-meter-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const M = require('./token1-meter.js');

const answerAll = (s, list) => list.reduce((acc, c) => M.applyAnswer(acc, c), s);

test('a fresh meter starts low, with nothing answered', () => {
  assert.deepStrictEqual(M.createMeter(), { accuracy: M.METER.start, correct: 0, wrong: 0 });
  assert(M.METER.start > 0 && M.METER.start < 30);
});

test('a right answer raises accuracy, a wrong one lowers it, and both are counted', () => {
  const up = M.applyAnswer(M.createMeter(), true), down = M.applyAnswer(up, false);
  assert.strictEqual(up.accuracy, M.METER.start + M.METER.up);
  assert.strictEqual(down.accuracy, M.METER.start + M.METER.up - M.METER.down);
  assert.deepStrictEqual([down.correct, down.wrong], [1, 1]);
});

test('right outweighs wrong: alternating answers still makes progress', () => {
  const s = answerAll(M.createMeter(), [true, false, true, false, true, false]);
  assert(s.accuracy > M.METER.start);
});

test('accuracy never drops below 0, and recovers from the floor', () => {
  const floor = answerAll(M.createMeter(), Array(40).fill(false));
  assert.strictEqual(floor.accuracy, 0);
  assert.strictEqual(M.applyAnswer(floor, true).accuracy, M.METER.up);
  assert.strictEqual(floor.wrong, 40);
});

test('accuracy never rises above 100', () => {
  const s = answerAll(M.createMeter(), Array(60).fill(true));
  assert.strictEqual(s.accuracy, 100);
  assert.strictEqual(M.applyAnswer(s, false).accuracy, 100 - M.METER.down);
});

test('applyAnswer returns a new state and leaves the old one untouched', () => {
  const s = M.createMeter(), frozen = JSON.stringify(s);
  const next = M.applyAnswer(s, true);
  assert.notStrictEqual(next, s);
  assert.strictEqual(JSON.stringify(s), frozen);
});

test('a non-boolean answer is ignored, not treated as wrong', () => {
  const s = M.createMeter();
  for (const v of [undefined, null, 1, 'true', {}]) assert.strictEqual(M.applyAnswer(s, v), s);
});

test('stages split the bar into five repair levels at 20-point boundaries', () => {
  const at = (a) => M.stage({ accuracy: a, correct: 0, wrong: 0 });
  assert.deepStrictEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(at), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.strictEqual(M.STAGES.length, 5);
  for (const s of M.STAGES) assert(s.name && s.line, 'each stage needs a name and a TOKEN-1 line');
});

test('the final score reports accuracy, counts and the hit rate', () => {
  const s = answerAll(M.createMeter(), [true, true, true, false]);
  assert.deepStrictEqual(M.finalScore(s), { accuracy: s.accuracy, correct: 3, wrong: 1, answered: 4, rate: 75 });
});

test('the final score with nothing answered has no hit rate rather than a divide-by-zero', () => {
  assert.deepStrictEqual(M.finalScore(M.createMeter()), { accuracy: M.METER.start, correct: 0, wrong: 0, answered: 0, rate: null });
});

test('a saved meter loads back exactly', () => {
  const s = answerAll(M.createMeter(), [true, false, true]);
  assert.deepStrictEqual(M.load(M.save(s)), s);
});

test('a missing, corrupt or tampered save loads as a fresh meter', () => {
  const bad = [null, undefined, '', 'not json', 'null', '[]', '"x"', '{}',
    JSON.stringify({ accuracy: '50', correct: 1, wrong: 0 }),
    JSON.stringify({ accuracy: 150, correct: 1, wrong: 0 }),
    JSON.stringify({ accuracy: -1, correct: 1, wrong: 0 }),
    JSON.stringify({ accuracy: 50, correct: -2, wrong: 0 }),
    JSON.stringify({ accuracy: 50, correct: 1.5, wrong: 0 }),
    JSON.stringify({ accuracy: 50, correct: 1 })];
  for (const raw of bad) assert.deepStrictEqual(M.load(raw), M.createMeter(), 'should reset: ' + raw);
});

done();
