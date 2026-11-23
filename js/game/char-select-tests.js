// Self-test for the character pick. Run: node js/game/char-select-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const CS = require('./char-select.js');

// a stand-in for window.localStorage
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('the roster is the four characters, each with a name, a specialty and a line', () => {
  assert.deepStrictEqual(CS.ROSTER.map((r) => r.id), ['saanvi', 'riya', 'mehta', 'aarav']);
  for (const r of CS.ROSTER) assert(r.name && r.blurb && r.specialty, `${r.id} has no name, line or specialty`);
  assert.deepStrictEqual(CS.ROSTER.map((r) => r.specialty), ['Validates output', 'Saves tokens', 'Human in the loop', 'Reads the question first']);
});

test('nothing saved means the default pick', () => {
  assert.strictEqual(CS.getChoice(memory()), CS.DEFAULT);
  assert.strictEqual(CS.DEFAULT, 'saanvi');
});

test('a saved pick comes back', () => {
  const s = memory();
  CS.setChoice('riya', s);
  assert.strictEqual(CS.getChoice(s), 'riya');
});

test('a saved value that is not on the roster falls back to the default', () => {
  const s = memory();
  s.setItem(CS.KEY, 'aditya');
  assert.strictEqual(CS.getChoice(s), CS.DEFAULT);
  s.setItem(CS.KEY, '');
  assert.strictEqual(CS.getChoice(s), CS.DEFAULT);
});

test('setChoice ignores ids that are not on the roster', () => {
  const s = memory();
  CS.setChoice('prakrit', s);
  assert.strictEqual(s.getItem(CS.KEY), null);
});

test('blocked storage never throws: the default pick, and the save is dropped', () => {
  assert.strictEqual(CS.getChoice(blocked), CS.DEFAULT);
  assert.strictEqual(CS.getChoice(null), CS.DEFAULT);
  assert.doesNotThrow(() => CS.setChoice('aarav', blocked));
});

test('the NPC list leaves out the character the player walks as, and nothing else', () => {
  const lobby = ['rosa_j', 'sudhanshu', 'gaurav', 'saanvi', 'mehta', 'aarav', 'riya'];
  assert.deepStrictEqual(CS.npcNames(lobby, 'riya'), ['rosa_j', 'sudhanshu', 'gaurav', 'saanvi', 'mehta', 'aarav']);
  assert.deepStrictEqual(CS.npcNames(lobby, 'mehta'), ['rosa_j', 'sudhanshu', 'gaurav', 'saanvi', 'aarav', 'riya']);
  assert.strictEqual(lobby.length, 7, 'the input list is not changed');
});

test('there are six tips of one or two short lines, and tipFor wraps round them', () => {
  assert.strictEqual(CS.TIPS.length, 6);
  for (const t of CS.TIPS) assert(t.length <= 80, `too long for two lines: ${t}`);
  assert.strictEqual(CS.tipFor(0), CS.TIPS[0]);
  assert.strictEqual(CS.tipFor(6), CS.TIPS[0]);
  assert.strictEqual(CS.tipFor(-1), CS.TIPS[5]);
});

done();
