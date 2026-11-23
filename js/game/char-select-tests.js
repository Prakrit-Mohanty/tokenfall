// Self-test for the character pick. Run: node js/game/char-select-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const CS = require('./char-select.js');

// a stand-in for window.localStorage
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('the roster is the four characters, each with a name and a line', () => {
  assert.deepStrictEqual(CS.ROSTER.map((r) => r.id), ['saanvi', 'riya', 'mehta', 'aarav']);
  for (const r of CS.ROSTER) assert(r.name && r.blurb, `${r.id} has no name or line`);
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

test('the default look is the original hair and no accessories', () => {
  assert.deepStrictEqual(CS.getLook(memory()), { hair: 'original', acc: { clip: false, scarf: false, charm: false } });
});

test('a saved look comes back, and unknown hair or accessory values are dropped', () => {
  const s = memory();
  CS.setLook({ hair: 'auburn', acc: { clip: true, scarf: 'yes', charm: true, hat: true } }, s);
  assert.deepStrictEqual(CS.getLook(s), { hair: 'auburn', acc: { clip: true, scarf: false, charm: true } });
  s.setItem(CS.LOOK_KEY, '{"hair":"green"}');
  assert.strictEqual(CS.getLook(s).hair, 'original');
  s.setItem(CS.LOOK_KEY, 'not json');
  assert.strictEqual(CS.getLook(s).hair, 'original');
  s.setItem(CS.LOOK_KEY, 'null');
  assert.strictEqual(CS.getLook(s).hair, 'original');
});

test('blocked storage gives the default look', () => {
  assert.deepStrictEqual(CS.getLook(blocked).hair, 'original');
  assert.doesNotThrow(() => CS.setLook({ hair: 'black' }, blocked));
});

test('the original hair turns nothing; a chosen colour turns the hue, saturation and value from the sprite\'s own hair', () => {
  assert.strictEqual(CS.hairShift('saanvi', 'original'), null);
  assert.strictEqual(CS.hairShift('aditya', 'black'), null, 'a character with no measured hair is left alone');
  const b = CS.hairShift('mehta', 'black');
  assert(Math.abs(b.kv - 0.16 / 0.349) < 1e-9 && Math.abs(b.ks - 0.12 / 0.398) < 1e-9, 'value and saturation ratios');
  assert(b.dh >= 0 && b.dh < 1, 'the hue turn wraps into [0, 1)');
  const blonde = CS.hairShift('riya', 'blonde');
  assert(Math.abs(blonde.dh - (0.11 - 0.03)) < 1e-9, 'a plain hue turn when the target is above the sprite\'s hue');
  const auburn = CS.hairShift('saanvi', 'auburn');
  assert(auburn.dh > 0.9 && auburn.dh < 1, 'a turn below zero wraps round');
  assert.deepStrictEqual([auburn.from, auburn.vMax], [0.5, 0.6], 'the key is the character\'s own (Saanvi\'s long hair starts lower)');
  assert(CS.hairShift('riya', 'black').from > auburn.from, 'the others start at the head');
  assert(CS.hairShift('riya', 'black').hMax < CS.hairShift('mehta', 'black').hMax, 'Riya\'s hair is told from her skin by hue');
});

done();
