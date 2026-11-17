// Self-test for TOKEN-1's script. Run: node js/game/token1-lines-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const L = require('./token1-lines.js');

const FORWARDED_GAMES = ['bridge', 'carrom', 'jenga', 'gallery'];

test('every game the adapter forwards has a name, a three-step how-to and a prediction', () => {
  assert.deepStrictEqual(Object.keys(L.GAMES).sort(), FORWARDED_GAMES.slice().sort());
  for (const [k, g] of Object.entries(L.GAMES)) {
    assert(g.name && g.where && g.predict, k);
    assert.strictEqual(g.howto.length, 3, k + ' needs exactly three steps');
    for (const s of g.howto) assert(s.length > 10 && s.length <= 90, `${k} step too long for the card: ${s}`);
  }
});

test('the intro is a short dialogue that ends by asking for help', () => {
  assert(L.INTRO.length >= 3 && L.INTRO.length <= 5);
  for (const l of L.INTRO) assert(l.length <= 120, 'line too long for the dialog box: ' + l);
  assert(/\?$/.test(L.INTRO[L.INTRO.length - 1]), 'the last line asks the player');
});

test('the mission copy names the rule numbers it promises', () => {
  const M = require('./token1-meter.js');
  assert(L.MISSION.title && L.MISSION.accept && L.MISSION.later);
  const rules = L.MISSION.rules(M.METER), text = JSON.stringify(rules);
  assert.strictEqual(rules.length, 3);
  assert(text.includes(`+${M.METER.up}%`) && text.includes(`${M.METER.down}%`), text);
});

done();
