// Token Brew Kitchen — world tests (plain node): the pure part of kitchen-world.js: the staff door and the fixed camera.
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const W = require('./kitchen-world.js');

test('door: the staff door is the cafe\'s own door, placed by the lobby (lobbySpots.kitchen): the board stands between the stand point and the door, leaves the stand point clear by the hero\'s width, and the way back out is in front of it', () => {
  // the village's Token Brew: a home at (20, -13), 10 wide and 7 deep, facing +z; its door is at (x + 0.31 w, z + d/2 - 0.6) (lobby-village.js vDoor)
  const home = { x: 20, z: -13, w: 10, d: 7 }, door = [home.x + 0.31 * home.w, home.z + home.d / 2 - 0.6], spot = { door, dir: [0, 1], stand: [door[0], door[1] + 1.4], ret: [door[0], door[1] + 2.1] };
  const s = W.doorSpot(spot), hero = 0.32; assert.strictEqual(W.doorSpot(null), null, 'no spot, no entrance');
  const inBox = (b, x, z, pad) => x > b[0] - pad && x < b[2] + pad && z > b[1] - pad && z < b[3] + pad;
  assert(s.board[1] > door[1] && s.board[1] < spot.stand[1], 'the board is between the door and the stand point'); assert(!inBox(s.box, spot.stand[0], spot.stand[1], hero), 'the stand point is clear of the board');
  assert(!inBox(s.box, spot.ret[0], spot.ret[1], hero), 'so is the way back out'); assert(s.posts.every(([x, z]) => x >= s.box[0] - 0.05 && x <= s.box[2] + 0.05), 'the posts hold the board up at its ends');
  assert.strictEqual(s.retDir, 'down'); assert.strictEqual(s.ry, 0); assert(Math.hypot(spot.stand[0] - door[0], spot.stand[1] - door[1]) <= W.DOOR.r, 'the prompt reaches the door');
  const counter = [home.x + (-home.w / 2 + home.w * 0.62 / 2), home.z + home.d / 2 + 1.4]; assert(Math.hypot(spot.stand[0] - counter[0], spot.stand[1] - counter[1]) > 1.7 + W.DOOR.r, 'the chai counter\'s prompt (radius 1.7) and the door\'s do not overlap');
  const east = W.doorSpot({ door: [0, 0], dir: [1, 0], stand: [1.4, 0], ret: [2.1, 0] }); assert.strictEqual(east.retDir, 'right'); assert(Math.abs(east.ry - Math.PI / 2) < 1e-9);
});

test('camera: the whole room (its floor corners and the back wall top) is on screen at 16:9, 16:10, 4:3, a square window and a phone, and the view looks at the same spot every time', () => {
  for (const [name, a] of [['16:9', 16 / 9], ['16:10', 1.6], ['4:3', 4 / 3], ['square', 1], ['phone', 0.5]]) {
    const v = W.fitView(a); let worst = 0;
    for (const p of W.framePoints()) { const q = W.project(v, a, p); assert(q.z > 0, name + ' behind the camera'); worst = Math.max(worst, Math.abs(q.x), Math.abs(q.y)); }
    assert(worst <= 0.97, name + ' the frame reaches ' + worst.toFixed(2));
    if (a === 16 / 9) { const l = W.project(v, a, [W.ROOM.x0, 0, W.ROOM.zBack]), r = W.project(v, a, [W.ROOM.x1, 0, W.ROOM.zBack]); assert((r.x - l.x) / 2 > 0.55, 'the room fills most of the width at 16:9'); }
    assert.deepStrictEqual(v.look, W.CAMERA.look);
  }
});

test('zone: the kitchen sits far from every other area (600 m east), and its room is wider than deep, so the steep camera frames it', () => {
  assert.deepStrictEqual(W.ZONE, { cx: 600, cz: 0 }); assert(W.ROOM.x1 - W.ROOM.x0 > W.ROOM.zFront - W.ROOM.zBack); assert(W.ROOM.x0 < 0 && W.ROOM.x1 > 0);
});
done();
