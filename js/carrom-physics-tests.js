// Self-test for the carrom physics. Run: node js/carrom-physics-tests.js
const assert = require('assert');
const P = require('./carrom-physics.js');
const { mulberry32 } = require('./bridge-generator.js');   // the bridge's seeded RNG: tests only, the physics itself never draws a random number
const { CFG } = P;

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };

// ---- seeded fixtures ----
function randomLayout(rng, n = 6) {
  const coins = [];
  for (let tries = 0; coins.length < n && tries < 500; tries++) {
    const x = 18 + rng() * 64, y = 14 + rng() * 56;
    if (coins.every((c) => Math.hypot(c.x - x, c.y - y) > CFG.R_COIN * 2 + 0.3)) coins.push({ id: 'c' + coins.length, x, y });
  }
  return coins;
}
const randomShot = (rng, power) => ({ strikerX: CFG.X_MIN + rng() * (CFG.X_MAX - CFG.X_MIN), angle: -60 + rng() * 120, power: power == null ? rng() : power });
const fixtures = (seed, count, power) => { const rng = mulberry32(seed); return Array.from({ length: count }, () => ({ state: P.createState({ coins: randomLayout(rng), strikerX: 50 }), shot: randomShot(rng, power) })); };

test('determinism: the same shot gives an identical state hash and event list, run after run', () => {
  for (const { state, shot } of fixtures(1, 200)) {
    const before = P.stateHash(state), a = P.runShot(state, shot, { hits: true }), b = P.runShot(state, shot, { hits: true });
    assert.strictEqual(P.stateHash(a.finalState), P.stateHash(b.finalState));
    assert.deepStrictEqual(a.events, b.events);
    assert.strictEqual(P.stateHash(state), before, 'runShot must not mutate its input');
    const viaJson = P.runShot(JSON.parse(JSON.stringify(state)), shot, { hits: true });   // a state that was saved and loaded behaves the same
    assert.strictEqual(P.stateHash(viaJson.finalState), P.stateHash(a.finalState));
  }
  const [{ state, shot }] = fixtures(2, 1, 0.8);
  assert.notStrictEqual(P.stateHash(P.runShot(state, shot).finalState), P.stateHash(P.runShot(state, Object.assign({}, shot, { angle: shot.angle + 0.5 })).finalState), 'a different shot gives a different state');
});

test('no coin leaves the board, at any step, including full-power shots', () => {
  let steps = 0;
  for (const power of [null, 1]) for (const { state, shot } of fixtures(3, 150, power)) {
    const s = P.cloneState(state); P.applyShot(s, shot);
    for (let i = 0; i < CFG.MAX_STEPS && P.step(s); i++, steps++) {
      for (const b of s.bodies) {
        if (!b.alive) { assert(b.pocket >= 0 && b.vx === 0 && b.vy === 0); continue; }
        assert(b.x >= b.r - 1e-9 && b.x <= CFG.SIZE - b.r + 1e-9 && b.y >= b.r - 1e-9 && b.y <= CFG.SIZE - b.r + 1e-9, `${b.id} at ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
        assert(Number.isFinite(b.x) && Number.isFinite(b.vx));
      }
    }
  }
  console.log(`   ${steps} steps checked`);
});

test('energy never increases: only friction, restitution < 1 and sinking take it away', () => {
  let worst = 0, steps = 0;
  for (const power of [null, 1]) for (const { state, shot } of fixtures(4, 150, power)) {
    const s = P.cloneState(state); P.applyShot(s, shot);
    let e = P.kineticEnergy(s);
    for (let i = 0; i < CFG.MAX_STEPS && P.step(s); i++, steps++) {
      const e2 = P.kineticEnergy(s); worst = Math.max(worst, e2 - e); assert(e2 <= e + 1e-9, `energy rose ${e} -> ${e2} at step ${i}`); e = e2;
    }
    assert.strictEqual(e, 0, 'every shot ends with the table at rest');
  }
  console.log(`   ${steps} steps checked, largest single-step rise ${worst}`);
});

test('no tunnelling at max power: the striker always meets the coin it is aimed at', () => {
  let n = 0;
  for (let ang = -80; ang <= 80; ang += 2) for (const dist of [8, 14, 22, 35, 50, 68]) {
    const sx = 50, a = ang * Math.PI / 180, x = sx + Math.sin(a) * dist, y = CFG.BASE_Y - Math.cos(a) * dist;
    if (x < 12 || x > 88 || y < 12 || y > 80) continue;
    const r = P.runShot(P.createState({ coins: [{ id: 'T', x, y }], strikerX: sx }), { strikerX: sx, angle: ang, power: 1 });
    assert.strictEqual(r.first, 'T', `angle ${ang}, distance ${dist}`); n++;
  }
  console.log(`   ${n} head-on full-power shots, all connected`);
});

test('no tunnelling at max power: a fast coin never passes through a row of coins or a wall', () => {
  // a tight row across the board; the striker comes straight up the middle at full power
  const coins = [-8.8, -4.4, 0, 4.4, 8.8].map((dx, i) => ({ id: 'r' + i, x: 50 + dx, y: 40 }));
  let minRatio = 9;
  for (let ang = -6; ang <= 6; ang += 1) {
    const s = P.createState({ coins, strikerX: 50 }); P.applyShot(s, { strikerX: 50, angle: ang, power: 1 });
    for (let i = 0; i < CFG.MAX_STEPS && P.step(s); i++) {
      const live = s.bodies.filter((b) => b.alive);
      for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) minRatio = Math.min(minRatio, Math.hypot(live[a].x - live[b].x, live[a].y - live[b].y) / (live[a].r + live[b].r));
    }
  }
  console.log(`   deepest overlap seen: ${((1 - minRatio) * 100).toFixed(1)}% of the touching distance`);
  assert(minRatio > 0.8, 'bodies never sink deep into each other');
});

test('substeps converge: first contact is exact at any step size; sunk coins agree except where bounces make a shot chaotic', () => {
  const keep = [CFG.MAX_STEP, CFG.MAX_SUB], at = (fx, ms, sub) => { CFG.MAX_STEP = ms; CFG.MAX_SUB = sub; const out = fx.map(({ state, shot }) => P.runShot(state, shot)); [CFG.MAX_STEP, CFG.MAX_SUB] = keep; return out; };
  const sunk = (r) => r.sunk.map((e) => e.id + '@' + e.pocket).sort().join(',');
  for (const [power, need] of [[1, 0.6], [0.5, 0.85]]) {
    const fx = fixtures(5, 300, power), ref = at(fx, 0.0125, 1600), prod = at(fx, CFG.MAX_STEP, CFG.MAX_SUB);
    const first = prod.filter((r, i) => r.first === ref[i].first).length, same = prod.filter((r, i) => sunk(r) === sunk(ref[i])).length;
    console.log(`   power ${power}: first contact ${first}/300, same coins sunk ${same}/300 (vs 64x the resolution)`);
    assert.strictEqual(first, 300, 'the intended coin never depends on the substep size');
    assert(same / 300 >= need, `sunk coins agree for at least ${need * 100}% of shots`);
  }
});

test('pockets: a coin can be sunk into each of the four corners, and the event says which', () => {
  for (let pocket = 0; pocket < 4; pocket++) {
    let found = null;
    for (let sx = 12; sx <= 88 && !found; sx += 4) for (let ang = -85; ang <= 85 && !found; ang += 1) for (const power of [0.5, 0.8, 1]) {
      const r = P.runShot(P.createState({ coins: [{ id: 'T', x: 50, y: 50 }], strikerX: sx }), { strikerX: sx, angle: ang, power });
      const sink = r.sunk.find((e) => e.id === 'T');
      if (sink && sink.pocket === pocket) { found = { sx, ang, power, sink }; break; }
    }
    assert(found, 'pocket ' + pocket + ' is reachable'); assert.strictEqual(found.sink.striker, false);
  }
});

test('the striker can be pocketed too (a foul the game can score), and no coin is "first touched" then', () => {
  let found = null;
  for (let sx = 10; sx <= 90 && !found; sx += 10) for (let ang = -88; ang <= 88 && !found; ang += 1) {
    const r = P.runShot(P.createState({ coins: [], strikerX: sx }), { strikerX: sx, angle: ang, power: 1 });
    if (r.sunk.some((e) => e.striker)) found = r;
  }
  assert(found, 'some full-power shot on an empty board drops the striker in a pocket');
  assert.strictEqual(found.first, null); assert.strictEqual(found.finalState.bodies[0].alive, false);
});

test('first contact is the first coin touched, whatever drops later', () => {
  const coins = [{ id: 'near', x: 50, y: 60 }, { id: 'far', x: 50, y: 30 }];
  const r = P.runShot(P.createState({ coins, strikerX: 50 }), { strikerX: 50, angle: 0, power: 0.9 });
  assert.strictEqual(r.first, 'near');
  assert.strictEqual(r.events.find((e) => e.type === 'first').coin, 'near');
  assert.strictEqual(r.events.filter((e) => e.type === 'first').length, 1);
});

test('every shot comes to rest within the cut-off, and a zero-power shot does nothing', () => {
  let longest = 0;
  for (const { state, shot } of fixtures(6, 300)) { const r = P.runShot(state, shot); assert.strictEqual(r.reason, 'rest'); assert(P.isResting(r.finalState)); longest = Math.max(longest, r.steps); }
  const r0 = P.runShot(P.createState({ coins: [{ id: 'a', x: 40, y: 40 }], strikerX: 50 }), { strikerX: 50, angle: 10, power: 0 });
  assert.strictEqual(r0.steps, 0); assert.strictEqual(r0.finalState.bodies[1].x, 40);
  console.log(`   longest shot: ${(longest / 120).toFixed(1)} s`);
  assert(longest <= CFG.MAX_STEPS);
});

test('a hard hit moves the coin the way physics says: momentum goes along the line of centres, and energy is lost', () => {
  const r = P.runShot(P.createState({ coins: [{ id: 'T', x: 50, y: 60 }], strikerX: 50 }), { strikerX: 50, angle: 0, power: 0.5 }, { maxSteps: 20 });
  const T = r.finalState.bodies[1], S = r.finalState.bodies[0];
  assert(T.vy < 0 && Math.abs(T.vx) < 1e-9, 'a dead-centre hit sends the coin straight up');
  assert(S.vy < 0 && S.vy > T.vy, 'the heavier striker follows more slowly');
});

test('free spots: a blocked spot is moved to the nearest free one; pockets, walls and bodies are respected', () => {
  const s = P.createState({ coins: [{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 54.5, y: 50 }], strikerX: 50 });
  assert(!P.isFree(s, 50, 50, CFG.R_COIN) && !P.isFree(s, 1, 1, CFG.R_COIN) && !P.isFree(s, 2, 50, CFG.R_COIN) && P.isFree(s, 30, 30, CFG.R_COIN));
  const fs = P.freeSpot(s, 52, 50, CFG.R_COIN);
  assert(P.isFree(s, fs.x, fs.y, CFG.R_COIN)); assert(Math.hypot(fs.x - 52, fs.y - 50) < 8, 'it is close to where it was asked');
  assert.deepStrictEqual(P.freeSpot(s, 30, 30), { x: 30, y: 30 });
  assert.deepStrictEqual(P.freeSpot(s, 52, 50), P.freeSpot(s, 52, 50), 'deterministic');
  const own = P.freeSpot(s, 50, 50, CFG.R_COIN, 'a'); assert.deepStrictEqual(own, { x: 50, y: 50 }, 'its own spot is free for itself');
});

test('two coins touching or nearly touching at spawn stay put; overlapping ones are pushed apart by a shot, not launched', () => {
  const touching = P.createState({ coins: [{ id: 'a', x: 40, y: 40 }, { id: 'b', x: 44.4, y: 40 }], strikerX: 80 });
  const r = P.runShot(touching, { strikerX: 80, angle: 0, power: 0.2 });
  assert.strictEqual(r.finalState.bodies[1].x, 40); assert.strictEqual(r.finalState.bodies[2].x, 44.4);
  const stacked = P.createState({ coins: [{ id: 'a', x: 30, y: 30 }, { id: 'b', x: 30, y: 30 }, { id: 'c', x: 31, y: 30 }], strikerX: 80 });
  const s = P.cloneState(stacked); P.applyShot(s, { strikerX: 80, angle: 0, power: 0.05 });   // a gentle shot elsewhere sets the loop running
  for (let i = 0; i < 120; i++) P.step(s);
  for (const b of s.bodies.slice(1)) assert(Number.isFinite(b.x) && Math.hypot(b.vx, b.vy) < 5, 'no explosion');
});

test('speed: a shot costs well under a millisecond, so the layout validator can run thousands per round', () => {
  const fx = fixtures(7, 400), t0 = process.hrtime.bigint();
  let steps = 0; for (const { state, shot } of fx) steps += P.runShot(state, shot).steps;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`   ${fx.length} shots, ${steps} steps in ${ms.toFixed(1)} ms: ${(ms / fx.length * 1000).toFixed(0)} us per shot, ${(fx.length / ms * 300).toFixed(0)} shots in a 300 ms budget`);
  assert(ms / fx.length < 3, 'under 3 ms per shot on any machine');
});

test('single coin: aimed straight at any pocket from anywhere near the middle, the coin falls in (all four corners are equally reachable)', () => {
  const rng = mulberry32(21); let n = 0;
  for (let i = 0; i < 300; i++) {
    const x = 34 + rng() * 32, y = 34 + rng() * 32, corner = i % 4, [px, py] = P.POCKETS[corner], angle = Math.atan2(px - x, -(py - y)) / (Math.PI / 180), d = Math.hypot(px - x, py - y);
    const power = Math.min(1, Math.max(0.5, d * 1.4 / (0.5556 * CFG.VMAX)));
    const r = P.runFlick(P.createState({ coins: [{ id: 'c', x, y }], striker: false }), 0, { angle, power });
    assert.strictEqual(r.pocket, corner, `from ${x.toFixed(1)},${y.toFixed(1)} into pocket ${corner}`); n++;
  }
  console.log(`   ${n} flicks, every one sank in the pocket it was aimed at`);
});

test('single coin: the aim line is honest: travelDistance matches how far the coin really rolls', () => {
  for (const power of [0.15, 0.3, 0.5, 0.8, 1]) {
    const s = P.createState({ coins: [{ id: 'c', x: 50, y: 98 }], striker: false });
    // roll along the south cushion's inside edge direction (east) on a board wide enough: start west, aim east, check before any wall
    const st = P.cloneState(s); st.bodies[0].x = 2.2; st.bodies[0].y = 50; P.flick(st, 0, { angle: 90, power });
    const d = P.travelDistance(power); if (d > 90) continue;
    for (let i = 0; i < CFG.MAX_STEPS && P.step(st); i++);
    assert(Math.abs((st.bodies[0].x - 2.2) - d) < 0.3, `power ${power}: predicted ${d.toFixed(2)}, rolled ${(st.bodies[0].x - 2.2).toFixed(2)}`);
  }
  assert(P.travelDistance(1) > 250 && P.travelDistance(0) === 0);
});

test('single coin: a short flick stops short of the pocket (a miss costs only time), and the run is deterministic', () => {
  const s = P.createState({ coins: [{ id: 'c', x: 50, y: 50 }], striker: false }), shot = { angle: -45, power: 0.12 };
  const a = P.runFlick(s, 0, shot), b = P.runFlick(s, 0, shot);
  assert.strictEqual(a.pocket, null); assert.strictEqual(a.reason, 'rest'); assert.strictEqual(P.stateHash(a.finalState), P.stateHash(b.finalState));
  assert(Math.hypot(a.finalState.bodies[0].x - 50, a.finalState.bodies[0].y - 50) > 5, 'it moved');
});

test('four baselines: the striker can start on any side, and a hit always pushes the coin away from it', () => {
  assert.deepStrictEqual(P.SIDES, ['S', 'W', 'N', 'E']);
  const at = (s, t) => P.strikerAt(s, t); assert.deepStrictEqual([at('S', 50), at('N', 50), at('W', 50), at('E', 50)], [{ x: 50, y: 80 }, { x: 50, y: 20 }, { x: 20, y: 50 }, { x: 80, y: 50 }]);
  assert.deepStrictEqual(at('S', 3), { x: 10, y: 80 }, 'the lane is clamped to its ends');
  for (const side of P.SIDES) for (const t of [20, 50, 80]) {
    const L = P.strikerAt(side, t), coin = { id: 'c', x: 50, y: 50 }, ang = Math.atan2(coin.x - L.x, -(coin.y - L.y)) / (Math.PI / 180);
    const s = P.createState({ coins: [coin], strikerX: t, side }); P.applyShot(s, { side, strikerX: t, angle: ang, power: 0.5 });
    for (let i = 0; i < 400 && s.first === null && P.step(s); i++);
    assert.strictEqual(s.first, 'c', `${side} ${t}: the striker aimed at the coin touches it first`);
    const c = s.bodies[1], away = (c.x - L.x) * (50 - L.x) + (c.y - L.y) * (50 - L.y); for (let i = 0; i < 3; i++) P.step(s);
    assert(Math.hypot(c.vx, c.vy) > 20 && c.vx * (50 - L.x) + c.vy * (50 - L.y) > 0, `${side} ${t}: the coin is sent away from the striker`);
  }
});

console.log(`\n${checks} checks passed`);
