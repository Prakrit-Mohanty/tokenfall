// GameHUD pure helpers: the m:ss clock, scores, warning thresholds, the 3-row control cap.
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const H = require('./game-hud.js');

test('time is m:ss, rounds up, never negative', () => {
  assert.strictEqual(H.fmtTime(0), '0:00'); assert.strictEqual(H.fmtTime(9.2), '0:10'); assert.strictEqual(H.fmtTime(75), '1:15'); assert.strictEqual(H.fmtTime(-3), '0:00');
});
test('score: whole numbers stay whole (0, not 0.0); a half point keeps one decimal', () => {
  assert.strictEqual(H.fmtScore(0), '0'); assert.strictEqual(H.fmtScore(12), '12'); assert.strictEqual(H.fmtScore(7.5), '7.5'); assert.strictEqual(H.fmtScore(3.0000001), '3');
});
test('warnings: amber under 30 s, red under 10 s, countdowns only', () => {
  assert.strictEqual(H.timeLevel(30, true), ''); assert.strictEqual(H.timeLevel(29, true), 'warn'); assert.strictEqual(H.timeLevel(10, true), 'warn');
  assert.strictEqual(H.timeLevel(9, true), 'crit'); assert.strictEqual(H.timeLevel(5, false), '');
});
test('at most three control rows', () => {
  assert.strictEqual(H.controlRows([['H', 'Help'], ['M', 'Mute'], ['Esc', 'Leave'], ['F', 'Hint']]).length, 3);
  assert.deepStrictEqual(H.controlRows(null), []);
});
done();
