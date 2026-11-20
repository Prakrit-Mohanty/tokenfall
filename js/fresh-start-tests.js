// Self-test for the fresh start on a dev-server restart. Run: node js/fresh-start-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const F = require('./fresh-start.js');

const SAVED = ['tf.token1.meter', 'tf.token1.joined', 'tf.token1.away', 'tf.token1.modules', 'tf.encounter.cleared', 'tokenfall.bridge.v1', 'tokenfall.bridge.v1:ana', 'tokenfall.carrom.coach', 'tokenfall.tower.coach',
  'tokenfall.sound', 'tokenfall.settings', 'tokenfall.daylight', 'tokenfall.bigtext', 'tf.music.muted', 'tokenfall.mill.relaxed', 'someone-else', F.BOOT_KEY];

test('a new server start clears every bit of game progress', () => {
  const gone = F.plan({ boot: 'b2', seen: 'b1', keys: SAVED });
  for (const k of ['tf.token1.meter', 'tf.token1.joined', 'tf.token1.away', 'tf.token1.modules', 'tf.encounter.cleared', 'tokenfall.bridge.v1', 'tokenfall.bridge.v1:ana', 'tokenfall.carrom.coach', 'tokenfall.tower.coach']) assert(gone.includes(k), k);
});

test('a new server start keeps the player\'s settings and other sites\' keys', () => {
  const gone = F.plan({ boot: 'b2', seen: 'b1', keys: SAVED });
  for (const k of ['tokenfall.sound', 'tokenfall.settings', 'tokenfall.daylight', 'tokenfall.bigtext', 'tf.music.muted', 'tokenfall.mill.relaxed', 'someone-else', F.BOOT_KEY]) assert(!gone.includes(k), k);
});

test('the very first visit to a running server starts fresh too', () => {
  assert(F.plan({ boot: 'b1', seen: null, keys: SAVED }).includes('tf.token1.joined'));
});

test('a refresh during the same server run keeps progress', () => {
  assert.deepStrictEqual(F.plan({ boot: 'b1', seen: 'b1', keys: SAVED }), []);
});

test('a page served without a server start id (any other host) never clears anything', () => {
  for (const boot of [null, undefined, '']) assert.deepStrictEqual(F.plan({ boot, seen: 'b1', keys: SAVED }), [], String(boot));
});

test('apply clears the planned keys, the launcher flag, and remembers this server start', () => {
  const store = (init) => { const m = new Map(Object.entries(init)); return { m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const local = store({ 'tf.token1.joined': '1', 'tokenfall.sound': '0', [F.BOOT_KEY]: 'old' }), session = store({ 'tf.started': '1' });
  const cleared = F.apply({ boot: 'new', local, session });
  assert.deepStrictEqual(cleared, ['tf.token1.joined']);
  assert.deepStrictEqual([...local.m.entries()].sort(), [[F.BOOT_KEY, 'new'], ['tokenfall.sound', '0']]);
  assert.strictEqual(session.getItem('tf.started'), null);
  assert.deepStrictEqual(F.apply({ boot: 'new', local, session }), [], 'a second load in the same run clears nothing');
});

test('blocked storage (private window) is survived, not thrown', () => {
  const broken = { get length() { throw new Error('denied'); }, getItem() { throw new Error('denied'); } };
  assert.deepStrictEqual(F.apply({ boot: 'new', local: broken, session: broken }), []);
});

done();
