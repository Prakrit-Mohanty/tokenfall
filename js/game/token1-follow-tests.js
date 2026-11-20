// Self-test for TOKEN-1's follow steering. Run: node js/game/token1-follow-tests.js
const assert = require('assert');
const { test, done } = require('../test-kit.js');
const F = require('./token1-follow.js');

const free = () => false;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const bot = (x, z, o = {}) => Object.assign({ x, z, heading: 0, stuck: 0, moving: false }, o);
const run = (b, target, n, isBlocked = free, dt = .05) => { for (let i = 0; i < n; i++) b = F.step({ bot: b, target, home: target, dt, isBlocked }); return b; };

test('the follow slot sits behind the hero and to one side, for every facing', () => {
  const g = F.FOLLOW.gap, sd = F.FOLLOW.side;
  assert.deepStrictEqual(F.slotFor({ x: 0, y: 0, dir: 'down' }), { x: -sd, z: -g });
  assert.deepStrictEqual(F.slotFor({ x: 0, y: 0, dir: 'up' }), { x: sd, z: g });
  assert.deepStrictEqual(F.slotFor({ x: 0, y: 0, dir: 'right' }), { x: -g, z: sd });
  assert.deepStrictEqual(F.slotFor({ x: 0, y: 0, dir: 'left' }), { x: g, z: -sd });
});

test('an unknown facing falls back to "down" instead of producing NaN', () => {
  for (const dir of [undefined, null, '', 'diagonal']) assert.deepStrictEqual(F.slotFor({ x: 5, y: 5, dir }), F.slotFor({ x: 5, y: 5, dir: 'down' }));
});

test('it walks toward the slot no faster than its walking speed', () => {
  const b = F.step({ bot: bot(0, 0), target: { x: 2, z: 0 }, home: { x: 2, z: 0 }, dt: .1, isBlocked: free });
  assert(near(b.x, F.FOLLOW.speed * .1) && b.z === 0 && b.moving);
});

test('far behind, it jogs to catch up', () => {
  const b = F.step({ bot: bot(0, 0), target: { x: 6, z: 0 }, home: { x: 6, z: 0 }, dt: .1, isBlocked: free });
  assert(near(b.x, F.FOLLOW.catchUp * .1));
});

test('it stops at the slot instead of overshooting or jittering', () => {
  const b = run(bot(0, 0), { x: 1, z: 0 }, 60);
  assert(near(b.x, 1, F.FOLLOW.arrive) && !b.moving);
  const again = F.step({ bot: b, target: { x: 1, z: 0 }, home: { x: 1, z: 0 }, dt: .05, isBlocked: free });
  assert.strictEqual(again.x, b.x);
});

test('a huge frame gap cannot fling it past the slot', () => {
  const b = F.step({ bot: bot(0, 0), target: { x: 1, z: 0 }, home: { x: 1, z: 0 }, dt: 5, isBlocked: free });
  assert(b.x <= 1 + 1e-9);
});

test('beyond the teleport distance (a door, a ride) it snaps straight to the slot', () => {
  const b = F.step({ bot: bot(0, 0), target: { x: 300, z: 0 }, home: { x: 301, z: 0 }, dt: .05, isBlocked: free });
  assert.deepStrictEqual([b.x, b.z, b.stuck], [300, 0, 0]);
});

test('a snap onto a blocked slot lands on the hero instead', () => {
  const b = F.step({ bot: bot(0, 0), target: { x: 300, z: 0 }, home: { x: 301, z: 2 }, dt: .05, isBlocked: (x) => x === 300 });
  assert.deepStrictEqual([b.x, b.z], [301, 2]);
});

test('against a wall it slides along the free axis', () => {
  const wall = (x) => x > .5;
  const b = run(bot(.5, 0), { x: 3, z: 3 }, 10, wall);
  assert(b.x === .5 && b.z > 1 && b.moving && b.stuck === 0, `slid to ${b.x},${b.z}`);
});

test('fully boxed in, it waits, counts the time stuck, and then snaps to the slot', () => {
  const box = (x, z) => !(near(x, 0) && near(z, 0)) && !(x === 2 && z === 2);
  let b = F.step({ bot: bot(0, 0), target: { x: 2, z: 2 }, home: { x: 2, z: 2 }, dt: .1, isBlocked: box });
  assert.deepStrictEqual([b.x, b.z, b.moving], [0, 0, false]);
  assert(near(b.stuck, .1));
  b = run(b, { x: 2, z: 2 }, Math.ceil(F.FOLLOW.stuckSnap / .05) + 1, box);
  assert.deepStrictEqual([b.x, b.z], [2, 2]);
});

test('step returns a new bot and leaves the old one untouched', () => {
  const a = bot(0, 0), frozen = JSON.stringify(a);
  const b = F.step({ bot: a, target: { x: 2, z: 0 }, home: { x: 2, z: 0 }, dt: .1, isBlocked: free });
  assert.notStrictEqual(a, b); assert.strictEqual(JSON.stringify(a), frozen);
});

test('it turns to face the way it walks', () => {
  const b = run(bot(0, 0), { x: 0, z: 3 }, 40);
  assert(Math.abs(Math.sin(b.heading - Math.atan2(0, 1))) < .2, 'heading ' + b.heading);
});

const HERO_SPEED = 3.3;
const walkWith = (hero0, vx, vz, seconds, slot = (h) => F.slotFor(h), b0) => {
  const dt = 1 / 60, frames = Math.round(seconds / dt), out = [];
  let hero = Object.assign({}, hero0), b = b0 || bot(slot(hero).x, slot(hero).z);
  for (let i = 0; i < frames; i++) {
    hero = Object.assign({}, hero, { x: hero.x + vx * dt, y: hero.y + vz * dt });
    b = F.step({ bot: b, target: slot(hero), home: { x: hero.x, z: hero.y }, dt, isBlocked: free });
    out.push(b);
  }
  return out;
};
const flipsOf = (list, f) => list.slice(1).filter((e, i) => f(e) !== f(list[i])).length;

test('following a hero who walks steadily at 60 fps, it keeps walking: no stop-go flicker', () => {
  const frames = walkWith({ x: 0, y: 0, dir: 'left' }, -HERO_SPEED, 0, 3);
  const settled = frames.slice(30);
  assert.strictEqual(flipsOf(settled, (e) => e.moving), 0, `moving flipped ${flipsOf(settled, (e) => e.moving)} times`);
  assert(settled.every((e) => e.moving));
});

test('uneven frames and a hero whose pace stutters near the walking threshold still cause no flicker', () => {
  let hero = { x: 0, y: 0 }, b = bot(-1.4, .9), flips = 0, prev = null;
  for (let i = 0; i < 600; i++) {
    const dt = i % 2 ? 1 / 30 : 1 / 120, v = [.7, 1.2, .3, 1][i % 4];
    hero = { x: hero.x + v * dt, y: 0 };
    b = F.step({ bot: b, target: F.slotFor(hero, Math.PI / 2), home: { x: hero.x, z: 0 }, dt, isBlocked: free });
    if (i > 60 && prev !== null && prev !== b.moving) flips++;
    prev = b.moving;
  }
  assert.strictEqual(flips, 0, `moving flipped ${flips} times`);
});

test('when the hero stops it walks into its spot and settles once, without twitching', () => {
  const walking = walkWith({ x: 0, y: 0, dir: 'left' }, -HERO_SPEED, 0, 2);
  const stopped = walkWith({ x: -HERO_SPEED * 2, y: 0, dir: 'left' }, 0, 0, 2, undefined, walking[walking.length - 1]);
  assert.strictEqual(flipsOf(stopped, (e) => e.moving), 1, 'one transition: walking -> settled');
  assert(!stopped[stopped.length - 1].moving);
});

test('the follow spot turns smoothly with the walking direction instead of jumping sides', () => {
  const a = F.slotFor({ x: 0, y: 0 }, Math.PI / 4), b = F.slotFor({ x: 0, y: 0 }, Math.PI / 4 + .02);
  assert(Math.hypot(a.x - b.x, a.z - b.z) < .05, 'a small turn moves the spot a little');
  assert.deepStrictEqual(F.slotFor({ x: 0, y: 0, dir: 'up' }, Math.atan2(0, 1)), F.slotFor({ x: 0, y: 0, dir: 'down' }), 'a heading wins over the sprite facing');
});

test('the walking direction follows the hero velocity and holds when the hero stops', () => {
  const a0 = 0;
  const turned = F.facingToward(a0, { vx: 1, vz: 0 }, 1 / 60);
  assert(turned > a0 && turned < Math.PI / 2, 'eases toward +x, not snapping');
  assert.strictEqual(F.facingToward(1.2, { vx: 0, vz: 0 }, 1 / 60), 1.2, 'standing still keeps the last direction');
  assert.strictEqual(F.facingToward(1.2, { vx: .01, vz: 0 }, 1 / 60), 1.2, 'a tiny drift does not count as walking');
});

test('while the hero is on the move it is small; after standing still a moment it is full size', () => {
  assert.strictEqual(F.sizeFor(0), F.FOLLOW.small);
  assert.strictEqual(F.sizeFor(F.FOLLOW.growAfter - .01), F.FOLLOW.small);
  assert.strictEqual(F.sizeFor(F.FOLLOW.growAfter), 1);
  assert.strictEqual(F.sizeFor(60), 1);
  assert(F.FOLLOW.small > .3 && F.FOLLOW.small < .8);
});

test('a missing or broken still-time counts as moving, never as NaN', () => {
  for (const v of [undefined, null, NaN, -1]) assert.strictEqual(F.sizeFor(v), F.FOLLOW.small);
});

test('the Talk prompt: always before TOKEN-1 joins, afterwards only when standing still and nothing else is in reach', () => {
  const g = F.FOLLOW.growAfter;
  assert.strictEqual(F.promptOn({ joined: false, still: 0, crowded: true }), true);
  assert.strictEqual(F.promptOn({ joined: true, still: 0, crowded: false }), false, 'walking');
  assert.strictEqual(F.promptOn({ joined: true, still: g - 0.01, crowded: false }), false, 'only just stopped');
  assert.strictEqual(F.promptOn({ joined: true, still: g, crowded: false }), true, 'standing still');
  assert.strictEqual(F.promptOn({ joined: true, still: 10, crowded: true }), false, 'a station is in reach: it keeps the prompt');
  assert.strictEqual(F.promptOn({ joined: true, still: undefined, crowded: false }), false, 'a missing still-time counts as moving');
});

done();
