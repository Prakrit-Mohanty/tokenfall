// Self-test for the background music rules. Run: node js/game/music-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const M = require('./music.js');

const key = (o = {}) => Object.assign({ code: 'KeyN', repeat: false, typing: false, inGame: false, locked: false, zone: 'lobby' }, o);

test('every zone plays the default track until it is given its own', () => {
  for (const z of ['lobby', 'lab', 'pune', 'abz', 'airport', 'us', 'bridge', 'somewhere-new', undefined]) assert.strictEqual(M.trackFor(z), M.TRACKS.default);
  assert(/^music\/.+\.mp3$/.test(M.TRACKS.default));
});

test('a zone with its own track gets it, others keep the default', () => {
  const tracks = { default: 'music/a.mp3', pune: 'music/b.mp3' };
  assert.strictEqual(M.trackFor('pune', tracks), 'music/b.mp3');
  assert.strictEqual(M.trackFor('lobby', tracks), 'music/a.mp3');
});

test('volume: full in the world, ducked during a minigame, silent when muted', () => {
  assert.strictEqual(M.volumeFor({ muted: false, inGame: false }), M.MUSIC.volume);
  assert.strictEqual(M.volumeFor({ muted: false, inGame: true }), M.MUSIC.duck);
  assert.strictEqual(M.volumeFor({ muted: true, inGame: false }), 0);
  assert.strictEqual(M.volumeFor({ muted: true, inGame: true }), 0);
  assert(M.MUSIC.duck > 0 && M.MUSIC.duck < M.MUSIC.volume && M.MUSIC.volume <= 1);
});

test('N toggles the music in the open world (M is the map)', () => {
  assert.strictEqual(M.isMuteKey(key()), true);
});

test('N is left alone where something else owns it: chat, minigames, a locked player, the Glass Bridge; and M never mutes', () => {
  for (const o of [{ typing: true }, { inGame: true }, { locked: true }, { zone: 'bridge' }, { repeat: true }, { code: 'KeyM' }]) assert.strictEqual(M.isMuteKey(key(o)), false, JSON.stringify(o));
});

test('a saved mute flag reads back; anything else means not muted', () => {
  assert.strictEqual(M.readMuted('1'), true);
  for (const v of ['0', null, undefined, '', 'true', 'yes']) assert.strictEqual(M.readMuted(v), false, String(v));
});

done();
