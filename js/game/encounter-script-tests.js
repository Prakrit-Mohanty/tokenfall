// Self-test for the glitch encounter rules. Run: node js/game/encounter-script-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const E = require('./encounter-script.js');

const CARROM = require('../carrom-content.js');
const BRIDGE = require('../bridge/bridge-content.js');
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const spot = (id) => E.SPOTS.find((s) => s.id === id);

test('each of the five parts belongs to one minigame, in story order', () => {
  assert.deepStrictEqual(Object.values(E.PARTS).map((p) => p.id).sort(), [...E.MODULE_ORDER].sort());
  assert.deepStrictEqual(Object.keys(E.PARTS).sort(), ['bridge', 'carrom', 'gallery', 'jenga', 'kitchen']);
  for (const [game, p] of Object.entries(E.PARTS)) assert(p.name && p.icon && p.gain && p.lesson && p.game && p.where, game);
});

test('finishing a minigame gives its part; unknown games give none', () => {
  assert.strictEqual(E.partFor('carrom').id, 'factcheck');
  assert.strictEqual(E.partFor('jenga').id, 'askfirst');
  assert.strictEqual(E.partFor('nope'), null);
});

test('colleagues no longer hand out parts: no glitch carries one', () => {
  for (const [id, g] of Object.entries(E.GLITCHES)) assert.strictEqual(g.module, undefined, id);
});

test('every spot has a colleague and a hello; battles bring a glitch and win/lose lines; scenes do not battle', () => {
  for (const s of E.SPOTS) {
    assert(['door', 'scene', 'wander'].includes(s.kind), s.id + ' kind');
    assert(s.who && s.hello.length >= 1, s.id + ' who/hello');
    if (s.kind === 'scene') { assert.strictEqual(s.glitch, undefined, s.id + ' scene has no glitch'); continue; }
    assert(E.GLITCHES[s.glitch] && s.win.length && s.lose.length, s.id + ' glitch/lines');
  }
});

test('exactly four colleagues: the lobby, in front of ABZ, on the way to the airport, towards Bangalore', () => {
  assert.deepStrictEqual(E.SPOTS.map((s) => s.id), ['lobby', 'abz', 'airport-road', 'bangalore-road']);
  assert.deepStrictEqual(spot('abz').at.portal, { zone: 'pune', to: 'abz' });
  assert.deepStrictEqual(spot('airport-road').at.portal, { zone: 'lobby', to: 'airport' });
  const b = spot('bangalore-road');
  assert.strictEqual(b.at.zone, 'lobby');
  assert(b.at.z < E.SPOTS.find((s) => s.id === 'lobby').at.z - 10, 'Bangalore is straight ahead (north) of the lobby colleague');
});

test('the lobby colleague is a first, gentle battle that explains the Glitch Log', () => {
  const s = spot('lobby');
  assert(/glitch log/i.test([...s.hello, ...s.win].join(' ')), 'mentions the Glitch Log');
  assert.strictEqual(s.kind, 'wander');
});

test('the Bangalore colleague sends you to the train at the station across the bridge', () => {
  assert(/bangalore/i.test(spot('bangalore-road').hello.join(' ')));
  assert(/train/i.test(spot('bangalore-road').hello.join(' ')) && /station/i.test(spot('bangalore-road').hello.join(' ')));
});

test('each colleague with a part to point at names that minigame', () => {
  const pointing = E.SPOTS.filter((s) => s.points);
  assert.deepStrictEqual(pointing.map((s) => s.id).sort(), ['abz', 'airport-road', 'bangalore-road']);
  for (const s of pointing) {
    const p = E.PARTS[s.points];
    assert(p, `${s.id} points nowhere`);
    assert([...s.hello, ...s.win].join(' ').includes(p.game), `${s.id} never names ${p.game}`);
  }
});

test('every glitch can be met somewhere, so the Glitch Log can be completed', () => {
  const met = new Set(E.SPOTS.filter((s) => s.glitch).map((s) => s.glitch));
  assert.deepStrictEqual([...met].sort(), Object.keys(E.GLITCHES).sort());
});

test('the Glitch Log lists every glitch; beaten ones show their name and lesson, the rest stay hidden', () => {
  const log = E.logEntries(['abz']);
  assert.strictEqual(log.length, 4);
  const slate = log.find((e) => e.id === 'slate'), echo = log.find((e) => e.id === 'echo');
  assert.deepStrictEqual([slate.caught, slate.name, !!slate.lesson, !!slate.mistake], [true, 'Blank Slate', true, true]);
  assert.strictEqual(echo.caught, false);
  assert.strictEqual(E.logEntries([]).filter((e) => e.caught).length, 0);
});

test('the Glitch Log ignores scenes and unknown spot ids', () => {
  assert.strictEqual(E.logEntries(['nowhere', 'crescent-bay']).filter((e) => e.caught).length, 0);
});

test('a colleague on a path notices you from at least 4 m away, like a line of sight', () => {
  for (const s of E.SPOTS.filter((x) => x.kind === 'wander')) assert(s.at.r >= 4, `${s.id} only notices you at ${s.at.r} m`);
});

test('walking into the radius from outside triggers once', () => {
  let s = E.sight({ armed: false, d: 6, r: 4.5 });
  assert.deepStrictEqual(s, { armed: true, trigger: false });
  s = E.sight({ armed: s.armed, d: 4.4, r: 4.5 });
  assert.deepStrictEqual(s, { armed: false, trigger: true });
});

test('standing inside the radius (after a battle, or arriving through a door) never triggers', () => {
  let s = { armed: false };
  for (const d of [1.5, 2, 3, 4.4, 4.49]) { s = E.sight({ armed: s.armed, d, r: 4.5 }); assert.strictEqual(s.trigger, false, `at ${d} m`); }
});

test('after a battle, stepping just outside the radius and back in triggers again', () => {
  let s = { armed: false };
  s = E.sight({ armed: s.armed, d: 4.6, r: 4.5 });
  s = E.sight({ armed: s.armed, d: 4.3, r: 4.5 });
  assert.strictEqual(s.trigger, true);
});

test('spot ids are unique', () => {
  assert.strictEqual(new Set(E.SPOTS.map((s) => s.id)).size, E.SPOTS.length);
});

test('a spot triggers only for a joined player and only until it is cleared', () => {
  assert.strictEqual(E.shouldTrigger({ spot: spot('abz'), joined: true, cleared: [] }), true);
  assert.strictEqual(E.shouldTrigger({ spot: spot('abz'), joined: false, cleared: [] }), false);
  assert.strictEqual(E.shouldTrigger({ spot: spot('abz'), joined: true, cleared: ['abz'] }), false);
  assert.strictEqual(E.shouldTrigger({ spot: undefined, joined: true, cleared: [] }), false);
});

test('the question bank takes plain Carrom and Bridge questions, each with one right and three wrong answers', () => {
  const bank = E.questionBank(CARROM, BRIDGE);
  assert(bank.length >= 40, `${bank.length} questions`);
  for (const q of bank) {
    assert(q.id && q.stem && q.correct && q.wrong.length >= 3, q.id);
    assert(![q.stem, q.correct, ...q.wrong.map((w) => w.text)].some((t) => t.includes('{')), q.id + ' has a placeholder');
  }
  assert.strictEqual(new Set(bank.map((q) => q.id)).size, bank.length);
});

test('a missing or malformed content bank gives an empty bank, not a crash', () => {
  assert.deepStrictEqual(E.questionBank(undefined, null), []);
  assert.deepStrictEqual(E.questionBank({ CARDS: [{ variants: [{}] }] }, { CARDS: 'x' }), []);
});

test('picking questions skips ones already used and never repeats within a battle', () => {
  const bank = E.questionBank(CARROM, BRIDGE), used = bank.slice(0, 10).map((q) => q.id);
  const picked = E.pickQuestions({ bank, n: 5, used, rng: seq(0) });
  assert.strictEqual(picked.length, 5);
  assert.strictEqual(new Set(picked.map((q) => q.id)).size, 5);
  assert(picked.every((q) => !used.includes(q.id)));
});

test('when every question has been used, picking starts over instead of returning nothing', () => {
  const bank = E.questionBank(CARROM, BRIDGE).slice(0, 4);
  const picked = E.pickQuestions({ bank, n: 3, used: bank.map((q) => q.id), rng: seq(.5) });
  assert.strictEqual(picked.length, 3);
});

test('a question offers its right answer and three wrong ones, shuffled, with the right one marked', () => {
  const q = E.questionBank(CARROM, BRIDGE)[0], opts = E.options(q, seq(.9, .1, .5, .3));
  assert.strictEqual(opts.length, 4);
  assert.strictEqual(opts.filter((o) => o.correct).length, 1);
  assert.strictEqual(opts.find((o) => o.correct).text, q.correct);
});

test('a battle is won by enough right answers, lowering the muddle each time', () => {
  let b = E.newBattle(E.BATTLE.turns);
  for (let i = 0; i < E.BATTLE.toClear; i++) { assert.strictEqual(b.done, false); b = E.answer(b, true); }
  assert.deepStrictEqual([b.done, b.won, b.muddle], [true, true, 0]);
});

test('a wrong answer uses a turn but leaves the muddle alone', () => {
  const b = E.answer(E.newBattle(E.BATTLE.turns), false);
  assert.deepStrictEqual([b.muddle, b.turn, b.done], [100, 1, false]);
});

test('running out of turns loses the battle with the glitch still standing', () => {
  let b = E.newBattle(E.BATTLE.turns);
  for (let i = 0; i < E.BATTLE.turns; i++) b = E.answer(b, i === 0);
  assert.deepStrictEqual([b.done, b.won], [true, false]);
  assert(b.muddle > 0);
});

test('answering a finished battle changes nothing', () => {
  let b = E.newBattle(E.BATTLE.turns);
  for (let i = 0; i < E.BATTLE.toClear; i++) b = E.answer(b, true);
  assert.strictEqual(E.answer(b, true), b);
});

test('a short wandering battle can still be won', () => {
  assert(E.BATTLE.wanderTurns >= E.BATTLE.toClear);
});

test('recovering a part adds it once, in story order, and leaves the old list untouched', () => {
  const a = ['memory'], b = E.recover(a, 'factcheck');
  assert.deepStrictEqual(b, ['factcheck', 'memory']);
  assert.deepStrictEqual(a, ['memory']);
  assert.deepStrictEqual(E.recover(b, 'memory'), b);
  assert.deepStrictEqual(E.recover(b, 'bogus'), b);
});

test('saved parts and cleared spots load back; junk, unknown ids and duplicates are dropped', () => {
  assert.deepStrictEqual(E.loadModules(JSON.stringify(['examples', 'factcheck'])), ['factcheck', 'examples']);
  assert.deepStrictEqual(E.loadCleared(JSON.stringify(['abz', 'lobby', 'abz', 'nowhere', 3])), ['abz', 'lobby']);
  for (const raw of [null, '', 'nope', '{}', '42', '"factcheck"', 'null']) {
    assert.deepStrictEqual(E.loadModules(raw), [], String(raw));
    assert.deepStrictEqual(E.loadCleared(raw), [], String(raw));
  }
});

done();
