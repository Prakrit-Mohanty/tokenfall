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
  assert(L.INTRO.length >= 3 && L.INTRO.length <= 9);
  for (const l of L.INTRO) assert(l.length <= 120, 'line too long for the dialog box: ' + l);
  assert(/\?$/.test(L.INTRO[L.INTRO.length - 1]), 'the last line asks the player');
});

test('the intro tells the story hook: an update told to make him faster removed his modules', () => {
  const text = L.INTRO.join(' ').toLowerCase();
  for (const w of ['faster', 'five', '10%']) assert(text.includes(w), 'intro is missing: ' + w);
});

test('the intro first says who TOKEN-1 is: the office AI helper, before anything goes wrong', () => {
  const first = L.INTRO.slice(0, 2).join(' ').toLowerCase();
  assert(first.includes('token-1') && first.includes('ai') && first.includes('help'), first);
});

test('the intro spells out the journey: office to office, each part inside a game, colleagues and their glitches on the way', () => {
  const text = L.INTRO.join(' ').toLowerCase();
  for (const w of ['office to office', 'part', 'game', 'colleague', 'glitch log']) assert(text.includes(w), 'intro is missing: ' + w);
  assert(!/colleague[^.]*(hand|give)[^.]*part/.test(text), 'colleagues no longer hand parts back');
  for (const office of ['crescent bay', 'abz', 'pleasanton']) assert(text.includes(office), 'intro does not name ' + office);
});

test('the mission card lists the five parts with the game and place that hold each one', () => {
  const E = require('./encounter-script.js');
  const parts = L.missionParts(E.PARTS);
  assert.strictEqual(parts.length, 5);
  for (const p of Object.values(E.PARTS)) assert(parts.some((x) => x.includes(p.name) && x.includes(p.game) && x.includes(p.where)), p.name);
});

test('the mission copy names the rule numbers it promises', () => {
  const M = require('./token1-meter.js');
  assert(L.MISSION.title && L.MISSION.accept && L.MISSION.later);
  const rules = L.MISSION.rules(M.METER), text = JSON.stringify(rules);
  assert.strictEqual(rules.length, 3);
  assert(text.includes(`+${M.METER.up}%`) && text.includes(`${M.METER.down}%`), text);
});

done();
