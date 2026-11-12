// Prompt Kitchen — world tests (plain node): the pure part of kitchen-world.js: the layout against the walls and counters, the stations' radii, the camera at every window shape, the E rules
// (tap, hold, drop, the nearest station by radius), the capacity gauge, and the bots re-run over REAL walking paths around the counters.
const assert = require('assert');
const { test, done, mean } = require('./test-kit.js');
const W = require('./kitchen-world.js');
const E = require('./kitchen-engine.js');
const B = require('./kitchen-bots.js');
const C = require('./kitchen-content.js');
const { RUN } = C, L0 = E.LAYOUT;

test('layout: every station can be reached from a free cell inside its own radius; the hero starts on free floor; counters sit inside the room; no two stations are confusable at a station\'s own spot', () => {
  const P = W.makePather();
  for (const s of W.STATIONS) { const c = P.cellOf(s); assert(c.gap <= s.r - 0.2, s.id + ' is ' + c.gap.toFixed(2) + ' from the nearest free floor, radius ' + s.r); }
  assert(W.walkable(L0.start.x, L0.start.z));
  for (const b of Object.values(W.BOXES)) assert(b[0] >= W.ROOM.x0 && b[2] <= W.ROOM.x1 + 0.01 && b[1] >= W.ROOM.zBack, 'a counter inside the room');
  assert(W.WALK[0] >= W.ROOM.x0 && W.WALK[2] <= W.ROOM.x1 && W.WALK[1] >= W.ROOM.zBack && W.WALK[3] <= W.ROOM.zFront);
  for (const s of W.STATIONS) { const at = P.cellOf(s), cx = W.WALK[0] + (at.cell % P.size[0] + 0.5) * 0.2, cz = W.WALK[1] + (Math.floor(at.cell / P.size[0]) + 0.5) * 0.2; const n = W.nearest({ x: cx, z: cz }, []); assert(n && n.ref.type === s.type, s.id + ' resolves to ' + (n && n.ref.id)); }
  // the portal back and the ticket rail do not share a spot
  assert(Math.hypot(9.8 - L0.rail.x, -2.4 - L0.rail.z) > 4);
  assert(W.walkable(9.8, -2.4), 'the portal stands on free floor');
});

test('layout: the staff door is the cafe\'s own door, placed by the lobby (lobbySpots.kitchen): the board stands between the stand point and the door, leaves the stand point clear by the hero\'s width, and the way back out is in front of it', () => {
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

test('camera: the whole kitchen (the room corners, the back wall top and every station) is on screen at 16:9, 16:10, 4:3, a square window and a phone', () => {
  for (const [name, a] of [['16:9', 16 / 9], ['16:10', 1.6], ['4:3', 4 / 3], ['square', 1], ['phone', 0.5]]) {
    const v = W.fitView(a); let worst = 0;
    for (const p of W.framePoints()) { const q = W.project(v, a, p); assert(q.z > 0, name + ' behind the camera'); worst = Math.max(worst, Math.abs(q.x), Math.abs(q.y)); }
    assert(worst <= 0.97, name + ' the frame reaches ' + worst.toFixed(2));
    if (a === 16 / 9) { const l = W.project(v, a, [W.ROOM.x0, 0, W.ROOM.zBack]), r = W.project(v, a, [W.ROOM.x1, 0, W.ROOM.zBack]); assert((r.x - l.x) / 2 > 0.55, 'the room fills most of the width at 16:9'); }
  }
  const v = W.fitView(16 / 9); assert.deepStrictEqual(v.look, W.CAMERA.look);
});

test('sight: from the fixed camera the hero\'s head is in view at every spot they can walk (and the chest at nearly all of them), at every window shape: nothing tall hides the work', () => {
  const P = W.makePather(), [nx, nz] = P.size;
  for (const asp of [16 / 9, 1.6, 4 / 3, 1, 0.5]) {
    const v = W.fitView(asp); let cells = 0, head = 0, chest = 0, worst = null;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (P.free[j * nx + i]) {
      const x = W.WALK[0] + (i + 0.5) * 0.2, z = W.WALK[1] + (j + 0.5) * 0.2; cells++;
      if (W.visible(v, [x, 1.75, z])) head++; else if (!worst) worst = [x.toFixed(1), z.toFixed(1)]; if (W.visible(v, [x, 1.0, z])) chest++;
    }
    assert.strictEqual(head, cells, 'the head is hidden at ' + worst + ' (aspect ' + asp.toFixed(2) + ')'); assert(chest / cells >= 0.85, 'the chest is in view in ' + (100 * chest / cells).toFixed(0) + '% of the floor');
    if (asp === 16 / 9) console.log('   at 16:9: head in view on ' + head + ' of ' + cells + ' cells, chest on ' + (100 * chest / cells).toFixed(0) + '%');
  }
  // the test would notice a tall frame: a lintel across the pass hides the hero behind it
  W.OCCLUDERS.push([-2.7, -0.7, 2.7, -0.5, 2.9]); const v = W.fitView(16 / 9); assert(!W.visible(v, [0, 1.0, -2.95]), 'the ray-cast sees a lintel'); W.OCCLUDERS.pop();
});

const facts = (o) => Object.assign({ carry: null, pots: [{ items: 0, residue: false, busy: false }, { items: 0, residue: false, busy: false }], stoves: [{ dish: null }, { dish: null }], stockHas: false }, o);
const at = (id) => ({ kind: 'station', ref: W.STATIONS.find((s) => s.id === id), d: 0 });
const chunk = (o) => Object.assign({ dish: false, role: 'essential', version: 'full', canChop: true, canSieve: true, stable: false, stock: false }, o);
test('E rules: tap grabs from a crate, loads a pot, takes a dish, serves at the window, cycles at the rail; a station takes only what it can use and says so otherwise; free floor drops', () => {
  assert.deepStrictEqual(W.tapAction(at('crate2'), facts()), { do: 'grab', crate: 2 });
  assert(W.tapAction(at('crate2'), facts({ carry: chunk() })).hint, 'full hands');
  assert.deepStrictEqual(W.tapAction(at('pot1'), facts({ carry: chunk() })), { do: 'load', pot: 1 });
  assert(W.tapAction(at('pot1'), facts({ carry: chunk({ dish: true }) })).hint, 'a dish does not go in a pot');
  assert.deepStrictEqual(W.tapAction(at('stove0'), facts({ stoves: [{ dish: 'ready' }, {}] })), { do: 'take', stove: 0 });
  assert.strictEqual(W.tapAction(at('stove0'), facts()), null);
  assert.deepStrictEqual(W.tapAction(at('window'), facts({ carry: chunk({ dish: true }) })), { do: 'serve' });
  assert(W.tapAction(at('window'), facts({ carry: chunk() })).hint, 'a chunk is not a dish');
  assert.deepStrictEqual(W.tapAction(at('rail'), facts()), { do: 'cycle' });
  assert.deepStrictEqual(W.tapAction(at('stock'), facts({ stockHas: true })), { do: 'stock' });
  assert(W.tapAction(at('chop'), facts({ carry: chunk() })).hint.includes('Hold'), 'tap on the board tells you to hold');
  assert.deepStrictEqual(W.tapAction(null, facts({ carry: chunk() })), { do: 'drop', where: 'floor' }, 'an item dropped away from a station lies where it was dropped');
  assert.strictEqual(W.tapAction(null, facts()), null);
  const fl = { kind: 'floor', ref: { item: { uid: 'i9' } }, d: 0 }; assert.deepStrictEqual(W.tapAction(fl, facts()), { do: 'pickup', uid: 'i9' }); assert(W.tapAction(fl, facts({ carry: chunk() })).hint);
});

test('E rules: hold works only where the data allows: chop and sieve need a version that exists, stock needs a whole stable chunk, wipe needs free hands and something in the pot, cook needs a loaded idle stove; times from the spec', () => {
  const T = RUN.time;
  assert.deepStrictEqual(W.holdWork(at('chop'), facts({ carry: chunk() })), { kind: 'chop', dur: T.chop }); assert.strictEqual(W.holdWork(at('chop'), facts({ carry: chunk({ canChop: false }) })), null);
  assert.deepStrictEqual(W.holdWork(at('sieve'), facts({ carry: chunk() })), { kind: 'sieve', dur: T.sieve }); assert.strictEqual(W.holdWork(at('sieve'), facts({ carry: chunk({ version: 'summary', canSieve: false }) })), null, 'a processed chunk cannot be processed again');
  assert.deepStrictEqual(W.holdWork(at('stock'), facts({ carry: chunk({ stable: true }) })), { kind: 'prep', dur: T.stockPrep }); assert.strictEqual(W.holdWork(at('stock'), facts({ carry: chunk({ stable: true, version: 'summary' }) })), null, 'a summary of the stock is a different item');
  assert.strictEqual(W.holdWork(at('stock'), facts({ carry: chunk() })), null);
  const loaded = facts({ pots: [{ items: 2, residue: false, busy: false }, { items: 0, residue: true, busy: false }] });
  assert.deepStrictEqual(W.holdWork(at('pot0'), loaded), { kind: 'wipe', dur: T.wipe, pot: 0 }); assert.deepStrictEqual(W.holdWork(at('pot1'), loaded), { kind: 'wipe', dur: T.wipe, pot: 1 }, 'a residue alone is worth wiping');
  assert.strictEqual(W.holdWork(at('pot0'), Object.assign({}, loaded, { carry: chunk() })), null, 'wiping needs free hands');
  assert.deepStrictEqual(W.holdWork(at('stove0'), loaded), { kind: 'cook', dur: T.cook, stove: 0 }); assert.strictEqual(W.holdWork(at('stove1'), loaded), null, 'nothing loaded in pot 1');
  assert.strictEqual(W.holdWork(at('stove0'), facts({ pots: loaded.pots, stoves: [{ dish: 'ready' }, {}] })), null, 'a dish waiting on the stove blocks a new cook');
  assert.strictEqual(W.holdWork(at('pot0'), facts({ pots: [{ items: 2, busy: true }, {}] })), null);
  assert.deepStrictEqual([T.chop, T.sieve, T.wipe, T.cook, T.stockPrep], [1.2, 1.2, 1.5, 2, 1.5]);
});

test('E rules: the nearest station is decided by its radius, not its tile; a dropped item wins only when it is much closer; a hold shows after 0.2 s, completes at its time and cancels when invalid', () => {
  const s = W.STATIONS.find((q) => q.id === 'crate3');
  assert.strictEqual(W.nearest({ x: s.x + s.r - 0.01, z: s.z }, []).ref.id, 'crate3'); assert.strictEqual(W.nearest({ x: -10.9, z: -6.0 }, []), null, 'out of every radius');
  assert.strictEqual(W.nearest({ x: 0.0, z: -2.2 }, []).kind, 'station');
  const f = { item: { uid: 'a' }, x: s.x, z: s.z + 0.2 }; assert.strictEqual(W.nearest({ x: s.x, z: s.z }, [f]).kind, 'station', 'a dropped item beside a station does not hide it');
  const lonely = { item: { uid: 'b' }, x: 0.2, z: -1.0 }; assert.strictEqual(W.nearest({ x: 0.2, z: -1.0 }, [lonely]).kind, 'floor');
  let h = { t: 0, dur: 1.2 }, st = W.holdStep(h, 0.1, true); assert.strictEqual(st.progress, 0, 'no ring yet'); h.t = st.t; st = W.holdStep(h, 0.15, true); assert(st.progress > 0 && !st.done);
  h.t = 1.1; st = W.holdStep(h, 0.2, true); assert(st.done && st.progress === 1); assert(W.holdStep({ t: 0.8, dur: 1.2 }, 0.1, false).cancelled);
});

test('gauge: one segment per chunk sized by tokens, the dial\'s headspace line, over-capacity flagged, the residue first', () => {
  const g = W.gaugeSegments([{ tokens: 100, conv: 'a', kind: 'residue' }, { tokens: 30, conv: 'a' }, { tokens: 14, conv: 'b' }], 260, 50, 260);
  assert.deepStrictEqual(g.segments.map((x) => [x.x, x.w]), [[0, 100], [100, 30], [130, 14]]); assert.strictEqual(g.headX, 210); assert.strictEqual(g.free, 66); assert(!g.over); assert.strictEqual(g.segments[0].kind, 'residue');
  assert(W.gaugeSegments([{ tokens: 220, conv: 'a' }], 260, 50, 260).over); assert.strictEqual(W.gaugeSegments([], 260, 120, 260).headX, 140);
  const tiny = W.gaugeSegments([{ tokens: 1, conv: 'a' }], 260, 20, 260); assert(tiny.segments[0].w >= 1);
});

test('pools: about ten chunk meshes, three ticket cards, six pantry labels, two gauges', () => {
  assert.deepStrictEqual(W.POOL, { chunks: 10, cards: 3, crates: 6, gauges: 2 }); assert.strictEqual(RUN.maxTickets, W.POOL.cards);
  assert.strictEqual(W.STATIONS.filter((s) => s.type === 'crate').length, W.POOL.crates);
});

test('walking: every pair of stations is connected around the counters (the ratio to the bots\' straight-line guess is reported; the bot test below is what decides)', () => {
  const P = W.makePather(), pts = [].concat(L0.crates, [L0.chop, L0.sieve, L0.stockShelf, L0.window, L0.start], L0.stoves); let r = [], worst = 0;
  for (const a of pts) for (const b of pts) if (a !== b) { const st = Math.hypot(a.x - b.x, a.z - b.z); if (st < 1.5) continue; const d = P.dist(a, b); assert(Number.isFinite(d), 'connected'); r.push(d / (st * L0.detour)); worst = Math.max(worst, d / (st * L0.detour)); }
  console.log('   real path / (straight x 1.1): mean ' + mean(r).toFixed(2) + ', worst leg ' + worst.toFixed(2));
});

test('bots over real paths: a second, independent sample of 300 seeds: the ideal bot scores 85%+ in 90%+ of them (the full bot suite, cheap strategies included, runs over the same paths in kitchen-tests.js)', () => {
  const P = W.makePather(); B.setDist((a, b) => P.dist(a, b));
  try {
    const ideal = Array.from({ length: 300 }, (_, i) => B.run(E.composeShift(E.seedFor('walk-' + i, i), null), 'ideal').score), ge = ideal.filter((x) => x.pct >= 0.85).length / ideal.length;
    console.log('   ideal bot over real paths: >=85% in ' + (100 * ge).toFixed(0) + '% of seeds, median ' + (100 * ideal.map((x) => x.pct).sort((a, b) => a - b)[150]).toFixed(0) + '%, served ' + mean(ideal.map((x) => x.served)).toFixed(1));
    assert(ge >= 0.9, 'ideal bot over real paths');
  } finally { B.setDist(); }
});
done();
