// The intro cards: every game's copy keeps the rules (title 2-4 words, goal <= 15, <= 3 steps under 12 words, 2-4 controls, under 60 words in all).
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const I = require('./intro-screen.js');
const INTROS = { bridge: require('../bridge/bridge-content.js').INTRO, carrom: require('../carrom-content.js').INTRO, tower: require('../jenga-content.js').INTRO, gallery: require('../gallery-content.js').INTRO, kitchen: require('../kitchen-orders.js').INTRO };

test('the checker catches broken copy', () => {
  const bad = { title: 'Go', goal: 'x '.repeat(16), steps: ['a', 'b', 'c', 'd'], controls: [['H', 'help']], duration: '~5 min', roundCount: 5 };
  assert.strictEqual(I.checkCopy(bad).length, 4);
});
for (const [id, cfg] of Object.entries(INTROS)) test(`${id}: intro copy keeps every rule`, () => {
  assert.deepStrictEqual(I.checkCopy(cfg), []);
  assert.strictEqual(cfg.id, id);
});
done();
