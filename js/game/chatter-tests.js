// Self-test for the bots' chatter. Run: node js/game/chatter-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const C = require('./chatter.js');

const LOBBY = ['rosa_j', 'chaiwala', 'pixelpriya', 'bobby5', 'sudhanshu', 'gaurav', 'saanvi', 'mehta', 'aarav', 'riya'], OFFICE = ['rahul.k', 'meera_s', 'devansh', 'sana.k', 'arjun_p'], PUNE = ['ananya.r', 'kabir_m', 'sneha.d'];
const ALL = [...LOBBY, ...OFFICE, ...PUNE];   // every bot main.js creates
const GAMES = /glass bridge|token tower|spot shot|carrom|token mill|token brew|token-1/i;
const seeded = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('every bot has a pool of its own: at least 6 lines, two or more about the minigames, none shared with another bot', () => {
  const seen = new Map();
  for (const n of ALL) {
    const pool = C.POOLS[n]; assert(pool && pool.length >= 6, n + ' has a pool');
    assert(pool.filter((l) => GAMES.test(l)).length >= 2, n + ' talks about the minigames');
    for (const l of pool) { assert(!seen.has(l), `"${l}" is in both ${seen.get(l)} and ${n}`); seen.set(l, n); assert(l.length <= 100 && l.trim() === l, 'a clean, short line: ' + l); }
  }
  assert.deepStrictEqual(Object.keys(C.POOLS).sort(), ALL.slice().sort(), 'no pool for a bot that does not exist');
});

test('a line is not repeated within the last 10 messages, and nobody speaks twice in a row (10 lobby bots, 3000 messages)', () => {
  for (const seed of [1, 2, 3]) {
    const chat = C.create(seeded(seed)), bots = LOBBY.map((name) => ({ name })), said = []; let prev = null;
    for (let i = 0; i < 3000; i++) {
      const b = chat.speaker(bots), text = chat.line(b.name);
      assert.notStrictEqual(b.name, prev, 'same bot twice'); prev = b.name;
      assert(text && C.POOLS[b.name].includes(text), 'a line from its own pool');
      assert(!said.slice(-C.MEMORY).includes(text), `repeat within ${C.MEMORY}: "${text}"`);
      said.push(text);
    }
    assert(new Set(said).size === LOBBY.reduce((n, b) => n + C.POOLS[b].length, 0), 'in the long run every line gets said');
  }
});

test('different bots say different things: no two bots draw from the same pool', () => {
  const chat = C.create(seeded(9)), a = new Set(), b = new Set();
  for (let i = 0; i < 200; i++) { a.add(chat.line('rosa_j')); b.add(chat.line('gaurav')); }
  assert(![...a].some((l) => b.has(l)));
});

test('edge cases: a bot with no pool takes the fallback list, a lone bot may talk again, an empty room is quiet, a used-up pool still answers', () => {
  const chat = C.create(seeded(4));
  assert(['x', 'y'].includes(chat.line('someone_new', ['x', 'y'])));
  assert.strictEqual(chat.line('someone_new', []), '');
  assert.strictEqual(C.create().speaker([]), null);
  assert.strictEqual(C.create().speaker([{ name: 'solo' }]).name, 'solo');
  const lone = C.create(seeded(5)), solo = [{ name: 'rahul.k' }];
  for (let i = 0; i < 40; i++) { const b = lone.speaker(solo), t = lone.line(b.name); assert(t); assert.notStrictEqual(t, lone.recent[lone.recent.length - 2], 'never the line just said'); }
  assert(lone.recent.length <= C.MEMORY);
});

done();
