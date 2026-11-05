// Self-test for the Glass Bridge content + generator. Run: node js/bridge-tests.js
const assert = require('assert');
const G = require('./bridge-generator.js');
const { LIMITS, TOPICS, CARDS } = require('./bridge-content.js');

const N = 500;
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const card = (id) => CARDS.find((c) => c.id === id);
const spec = (i, history) => G.composeRun(G.seedFor('player-' + i, 0), history);
const specs = Array.from({ length: N }, (_, i) => spec(i));
const normalRows = (s) => s.rows.filter((r) => !r.boss);

test('seedFor: deterministic, and different players/runs get different seeds', () => {
  assert.strictEqual(G.seedFor('amy', 3), G.seedFor('amy', 3));
  assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('amy', 4));
  assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('raj', 3));
});

test('composeRun: deterministic, and the runSpec is plain JSON', () => {
  for (const s of specs.slice(0, 50)) {
    assert.deepStrictEqual(G.composeRun(s.seed), s);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s);
  }
});

test('shape: 12 question rows, 3 stages of 3, a boss of 3 in the right order, 3 distinct interludes', () => {
  for (const s of specs) {
    assert.strictEqual(s.rows.length, 12);
    assert.deepStrictEqual(s.stages.map((st) => st.rowIds.length), [3, 3, 3]);
    assert.deepStrictEqual(s.rows.slice(9).map((r) => r.conceptId), ['B1', 'B2', 'B3']);
    assert.strictEqual(new Set(s.stages.map((st) => st.interlude)).size, 3);
    assert.deepStrictEqual(s.sequence.map((x) => x.type).filter((t) => t !== 'row').join(','), 'start,interlude,checkpoint,interlude,checkpoint,interlude,checkpoint,end');
    assert.deepStrictEqual(s.sequence.filter((x) => x.type === 'row').map((x) => x.row), s.rows.map((r) => r.id));
    assert.strictEqual(new Set(s.rows.map((r) => r.id)).size, 12);
    assert.strictEqual(new Set(normalRows(s).map((r) => r.conceptId)).size, 9, 'nine different concepts');
  }
});

test('each row has exactly one correct tile, in the lane it claims, with the card\'s tile count', () => {
  for (const s of specs) for (const r of s.rows) {
    assert.strictEqual(r.tiles.length, card(r.conceptId).tiles);
    assert.strictEqual(r.tiles.filter((t) => t.correct).length, 1);
    assert(r.tiles[r.correctLane].correct);
    for (const t of r.tiles) assert.strictEqual(!t.correct, typeof t.breaks === 'string' && t.breaks.length > 0);
  }
});

test('no duplicate tile texts in a row', () => {
  for (const s of specs) for (const r of s.rows) assert.strictEqual(new Set(r.tiles.map((t) => t.text.toLowerCase())).size, r.tiles.length, r.id + ' ' + r.stem);
});

test('length limits hold, and every placeholder is filled', () => {
  for (const s of specs) for (const r of s.rows) {
    assert(r.stem.split(/\s+/).length <= LIMITS.stemWords, r.stem);
    for (const t of r.tiles) { assert(t.text.length <= LIMITS.tileChars, t.text); assert(!/[{}]/.test(t.text + (t.breaks || '')), t.text); }
    assert(!/[{}]/.test(r.stem + r.idea), r.stem);
  }
});

test('every run covers all 7 topics', () => {
  for (const s of specs) assert.strictEqual(new Set(normalRows(s).map((r) => r.topic)).size, Object.keys(TOPICS).length);
});

test('stage zones: amber -> green -> cyan, and tiles per row 2 / 3 / 3', () => {
  for (const s of specs) s.stages.forEach((st, i) => {
    for (const id of st.rowIds) { const r = s.rows.find((x) => x.id === id); assert.strictEqual(r.zone, ['amber', 'green', 'cyan'][i]); assert.strictEqual(r.tiles.length, i ? 3 : 2); }
  });
});

test('difficulty ramps by stage', () => {
  const avg = (si) => mean(specs.flatMap((s) => s.stages[si].rowIds.map((id) => s.rows.find((r) => r.id === id).level)));
  const a = [avg(0), avg(1), avg(2)];
  assert(a[0] < a[1] && a[1] < a[2], a.join(' < '));
});

test('stage-internal order and interlude types are shuffled', () => {
  for (let si = 0; si < 3; si++) assert(new Set(specs.map((s) => s.stages[si].rowIds.map((id) => s.rows.find((r) => r.id === id).topic).join())).size >= 3);
  assert.deepStrictEqual([...new Set(specs.flatMap((s) => s.stages.map((st) => st.interlude)))].sort(), G.INTERLUDES.slice().sort());
});

test('different seeds share fewer than 30% of (concept, variant, params) triples', () => {
  const triples = (s) => new Set(s.rows.map((r) => [r.conceptId, r.variantId, JSON.stringify(r.params)].join('|')));
  const T = specs.map(triples), shares = [];
  for (let i = 0; i < 2000; i++) {
    const a = (i * 7) % N, b = (i * 13 + 1) % N;
    if (a === b) continue;
    shares.push([...T[a]].filter((x) => T[b].has(x)).length / 12);
  }
  // independent random runs can't guarantee every pair (the boss's three rows move together with its scenario),
  // so: the typical pair (mean) and at least 90% of pairs stay under 30%
  const sorted = shares.slice().sort((x, y) => x - y), under = shares.filter((x) => x < 0.3).length / shares.length;
  console.log(`   shared triples: mean ${(100 * mean(shares)).toFixed(1)}%, ${(100 * under).toFixed(1)}% of pairs under 30%, worst ${(100 * sorted[sorted.length - 1]).toFixed(1)}%`);
  assert(mean(shares) < 0.3 && under >= 0.9);
});

test('lane distribution is balanced within 5%, and no more than 2 correct tiles in a row on one side', () => {
  const count = { 2: [0, 0], 3: [0, 0, 0] };
  for (const s of specs) {
    for (const r of s.rows) count[r.tiles.length][r.correctLane]++;
    const sides = s.rows.map((r) => (r.tiles.length === 2 ? 'LR'[r.correctLane] : 'LCR'[r.correctLane]));
    for (let i = 2; i < sides.length; i++) assert(!(sides[i] === sides[i - 1] && sides[i] === sides[i - 2]), sides.join(''));
  }
  for (const n of [2, 3]) {
    const tot = count[n].reduce((a, b) => a + b, 0);
    console.log(`   ${n}-tile lanes: ${count[n].map((c) => (100 * c / tot).toFixed(1) + '%').join(' ')}`);
    for (const c of count[n]) assert(Math.abs(c / tot - 1 / n) < 0.05);
  }
});

test('the correct answer\'s length rank is uniform within 8% (no length tell)', () => {
  const rank = { 2: [0, 0], 3: [0, 0, 0] };
  for (const s of specs) for (const r of s.rows) {
    const L = r.tiles[r.correctLane].text.length, others = r.tiles.filter((t) => !t.correct).map((t) => t.text.length);
    const lo = others.filter((x) => x < L).length, ties = others.filter((x) => x === L).length;
    for (let k = 0; k <= ties; k++) rank[r.tiles.length][lo + k] += 1 / (ties + 1);
  }
  for (const n of [2, 3]) {
    const tot = rank[n].reduce((a, b) => a + b, 0);
    console.log(`   ${n}-tile correct is shortest..longest: ${rank[n].map((c) => (100 * c / tot).toFixed(1) + '%').join(' ')}`);
    for (const c of rank[n]) assert(Math.abs(c / tot - 1 / n) < 0.08);
  }
});

test('history: no variant from the last 3 runs is reused (boss scenarios too)', () => {
  for (let p = 0; p < 40; p++) {
    const runs = [];
    for (let i = 0; i < 12; i++) {
      const s = G.composeRun(G.seedFor('hist-' + p, i), { runs });
      const recent = new Set(runs.slice(-3).flatMap((r) => r.variants));
      for (const r of s.rows) assert(!recent.has(r.variantId), `player ${p} run ${i} reused ${r.variantId}`);
      runs.push({ variants: s.seen });
    }
  }
});

test('history: missed / unmastered concepts are favoured, mastered ones are not', () => {
  const freq = (history, id) => mean(Array.from({ length: N }, (_, i) => (spec(i, history).rows.some((r) => r.conceptId === id) ? 1 : 0)));
  const base = freq(undefined, 'T2');
  const missed = freq({ concepts: { T2: { attempts: 4, falls: 3, mastered: false }, T1: { mastered: true } } }, 'T2');
  const mastered = freq({ concepts: { T2: { mastered: true }, T1: { attempts: 3, falls: 2 } } }, 'T2');
  console.log(`   T2 appears: ${(100 * base).toFixed(0)}% baseline, ${(100 * missed).toFixed(0)}% when missed, ${(100 * mastered).toFixed(0)}% when mastered`);
  assert(missed > base + 0.05 && mastered < base - 0.05);
});

test('rerollRow: same concept, a different variant, re-shuffled, and nothing else changes', () => {
  for (const s of specs.slice(0, 200)) for (const i of [0, 4, 7]) {
    const { spec: t, row } = G.rerollRow(s, i), old = s.rows[i];
    assert.strictEqual(row.conceptId, old.conceptId);
    assert.notStrictEqual(row.variantId, old.variantId);
    assert.notStrictEqual(row.tiles.map((x) => x.text).join(), old.tiles.map((x) => x.text).join());
    assert.strictEqual(row.tiles.filter((x) => x.correct).length, 1);
    assert.deepStrictEqual(t.rows.filter((_, j) => j !== i), s.rows.filter((_, j) => j !== i));
    assert.deepStrictEqual(G.rerollRow(s, i).row, row, 'deterministic');
  }
});

test('rerollRow: a second reroll differs again, and the lane rule still holds', () => {
  for (const s of specs.slice(0, 100)) {
    let t = s;
    for (let k = 0; k < 3; k++) {
      const before = t.rows[5], { spec: u, row } = G.rerollRow(t, 5);
      assert.notStrictEqual(row.tiles.map((x) => x.text).join(), before.tiles.map((x) => x.text).join());
      t = u;
    }
    const sides = t.rows.map((r) => (r.tiles.length === 2 ? 'LR'[r.correctLane] : 'LCR'[r.correctLane]));
    for (let i = 2; i < sides.length; i++) assert(!(sides[i] === sides[i - 1] && sides[i] === sides[i - 2]), sides.join(''));
  }
});

test('rerollRow on a boss row keeps the scenario but re-deals the tiles', () => {
  for (const s of specs.slice(0, 100)) for (const i of [9, 10, 11]) {
    const { row } = G.rerollRow(s, i), old = s.rows[i];
    assert.strictEqual(row.variantId, old.variantId);
    assert.strictEqual(row.scenario, old.scenario);
    assert(row.tiles.map((x) => x.text).join() !== old.tiles.map((x) => x.text).join() || row.stem !== old.stem);
  }
});

test('insertBonusRow: same concept, different variant, 2-3 rows later, never inside the boss, once per concept', () => {
  let inserted = 0;
  for (const s of specs.slice(0, 200)) for (const i of [0, 3, 6, 8]) {
    const { spec: t, row } = G.insertBonusRow(s, i);
    assert(row, 'a bonus row is inserted for a normal row');
    inserted++;
    const at = t.rows.findIndex((r) => r.id === row.id), miss = s.rows[i];
    assert(at > i && at <= Math.min(i + 4, 9), `row ${i} -> ${at}`);
    assert.strictEqual(row.conceptId, miss.conceptId);
    assert.notStrictEqual(row.variantId, miss.variantId);
    assert(row.bonus && row.of === miss.id);
    assert.deepStrictEqual(t.rows.slice(-3).map((r) => r.conceptId), ['B1', 'B2', 'B3']);
    assert.deepStrictEqual(t.sequence.filter((x) => x.type === 'row').map((x) => x.row), t.rows.map((r) => r.id));
    assert.strictEqual(G.insertBonusRow(t, i).row, null, 'once per concept');
    const sides = t.rows.map((r) => (r.tiles.length === 2 ? 'LR'[r.correctLane] : 'LCR'[r.correctLane]));
    for (let k = 2; k < sides.length; k++) assert(!(sides[k] === sides[k - 1] && sides[k] === sides[k - 2]));
  }
  assert.strictEqual(G.insertBonusRow(specs[0], 10).row, null, 'no bonus for a boss row');
});

test('two players get visibly different runs', () => {
  const a = G.composeRun(G.seedFor('alice', 0)), b = G.composeRun(G.seedFor('bob', 0));
  assert(a.rows.map((r) => r.correctLane).join() !== b.rows.map((r) => r.correctLane).join());
  assert(a.rows.filter((r, i) => r.variantId === b.rows[i].variantId).length < 6);
  assert(a.rows.map((r) => r.tiles.map((t) => t.text).join()).join() !== b.rows.map((r) => r.tiles.map((t) => t.text).join()).join());
});


// ---------------------------------------------------------------- world layout (pure geometry, no 3D)
const W = require('./bridge-world.js');
const { DIM, PHYS } = W;
const layouts = specs.slice(0, 200).map((s) => ({ s, L: W.computeLayout(s) }));
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('jump calibration: a plain walking jump clears every normal gap with room to spare; nothing skips a row or crosses the moving gap', () => {
  const walk = PHYS.reach(PHYS.WALK), walkNoCoyote = PHYS.reach(PHYS.WALK, false), run = PHYS.reach(PHYS.RUN);
  console.log(`   air ${PHYS.AIR}s, apex ${PHYS.APEX.toFixed(2)}; reach: walk ${walkNoCoyote.toFixed(2)} (${walk.toFixed(2)} with coyote), run ${run.toFixed(2)}; gaps: lane ${DIM.LANE_GAP}, row ${DIM.ROW_GAP}, stone ${DIM.STONE_GAP}, vanish ${DIM.VANISH_GAP}, ferry ${DIM.MOVE_GAP}, moving void ${DIM.MOVE_VOID}`);
  for (const [name, gap] of [['row', DIM.ROW_GAP], ['lane', DIM.LANE_GAP], ['stone', DIM.STONE_GAP], ['vanish', DIM.VANISH_GAP], ['ferry', DIM.MOVE_GAP]]) assert(walkNoCoyote >= gap + 0.3, `a walking jump clears the ${name} gap with 0.3 to spare`);
  assert(run < DIM.ROW_GAP + DIM.TILE_D + DIM.ROW_GAP, 'no jump reaches the row after next');
  assert(run < DIM.MOVE_VOID, 'the moving gap needs the ferry');
  assert(PHYS.APEX > 0.6 && PHYS.AIR > 0.4 && PHYS.AIR < 0.7 && PHYS.COYOTE >= 0.15 && PHYS.BUFFER >= 0.15);
});

test('layout: rows, tiles, gaps and platforms are placed exactly as designed', () => {
  for (const { s, L } of layouts) {
    assert.strictEqual(L.rows.length, 12);
    assert.deepStrictEqual(L.platforms.map((p) => p.kind), ['start', 'checkpoint', 'checkpoint', 'checkpoint', 'end']);
    assert.strictEqual(L.interludes.length, 3);
    const major = L.platforms.map((p) => ({ zs: p.zs, zn: p.zn })).concat(L.rows.map((r) => ({ zs: r.zs, zn: r.zn })), L.interludes.map((i) => ({ zs: i.zs, zn: i.zn }))).sort((a, b) => b.zs - a.zs);
    for (let i = 1; i < major.length; i++) assert(near(major[i - 1].zn - major[i].zs, DIM.ROW_GAP), 'every item is one row gap after the previous one');
    for (const r of L.rows) {
      assert(near(r.zs - r.zn, DIM.TILE_D));
      assert.strictEqual(r.tiles.length, s.rows[r.index].tiles.length);
      r.tiles.forEach((t, i) => { assert(near(t.x1 - t.x0, DIM.TILE_W)); if (i) assert(near(t.x0 - r.tiles[i - 1].x1, DIM.LANE_GAP)); });
      assert(near(r.tiles[0].x0 + r.tiles[r.n - 1].x1, 2 * L.cx), 'centred on the course');
      assert(r.tiles[r.n - 1].x1 - L.cx <= DIM.HALF_W, 'inside the walkable width');
    }
    assert(L.platforms.every((p) => p.w / 2 <= DIM.HALF_W + 0.5));
  }
});

test('layout: surfaceAt finds tiles and platforms, and the gaps are the void', () => {
  for (const { L } of layouts.slice(0, 60)) {
    const start = L.platforms[0];
    assert.strictEqual(W.surfaceAt(L, L.cx, start.zc - 0.4, 0).kind, 'platform', 'the spawn point is solid');
    for (const r of L.rows) {
      for (const t of r.tiles) { const s = W.surfaceAt(L, t.x, r.zc, 0); assert(s && s.kind === 'tile' && s.rowId === r.id); }
      for (let i = 1; i < r.n; i++) assert.strictEqual(W.surfaceAt(L, (r.tiles[i - 1].x1 + r.tiles[i].x0) / 2, r.zc, 0), null, 'between lanes is void');
      assert.strictEqual(W.surfaceAt(L, r.tiles[0].x, r.zs + DIM.ROW_GAP / 2, 0), null, 'between rows is void');
      assert.strictEqual(W.surfaceAt(L, r.tiles[0].x0 - 0.1, r.zc, 0), null, 'beside the row is void');
      assert(W.surfaceAt(L, r.tiles[0].x0 - 0.1, r.zc, 0, PHYS.LAND_PAD), 'the landing hitbox is generous');
    }
    assert(L.walk[0] < L.cx - DIM.PLAT_W / 2 + 1 && L.walk[2] > L.cx + DIM.PLAT_W / 2 - 1 && L.walk[1] < L.north && L.walk[3] > L.south);
  }
});

test('layout: interludes behave (moving platform shuttles, tiles vanish on a timing, everything is reachable)', () => {
  const kinds = new Set();
  for (const { L } of layouts) for (const il of L.interludes) {
    kinds.add(il.kind);
    const solid = il.pieces.filter((p) => p.kind !== 'moving' && p.kind !== 'vanish');
    if (il.kind === 'stones') for (let i = 1; i < il.pieces.length; i++) assert(near(il.pieces[i - 1].z0 - il.pieces[i].z1, DIM.STONE_GAP), 'stone gaps');
    if (il.kind === 'moving') {
      const mv = il.pieces.find((p) => p.kind === 'moving'), padS = il.pieces.find((p) => p.id === 'padS'), padN = il.pieces.find((p) => p.id === 'padN');
      const r0 = W.movingRect(mv, -mv.phase + 0), r1 = W.movingRect(mv, -mv.phase + mv.period * 0.56);
      assert(near(padS.z0 - r0.z1, DIM.MOVE_GAP) && near(r1.z0 - padN.z1, DIM.MOVE_GAP), 'the ferry comes within a hop of both pads');
      assert(padS.z0 - r0.z1 <= PHYS.reach(PHYS.WALK, false) && r1.z0 - padN.z1 <= PHYS.reach(PHYS.WALK, false));
      assert(padS.z0 - padN.z1 > PHYS.reach(PHYS.RUN), 'the pads are too far apart to jump');
      assert.strictEqual(W.surfaceAt(L, L.cx, (r0.z0 + r0.z1) / 2, -mv.phase).kind, 'moving');
    }
    if (il.kind === 'vanish') {
      const padsAt = il.pieces.filter((p) => p.kind === 'pad').map((p) => p.id);
      assert.deepStrictEqual(padsAt, ['padS', 'isl', 'padN'], 'solid ground at the start, the middle and the end');
    }
    if (il.kind === 'vanish') for (const v of il.pieces.filter((p) => p.kind === 'vanish')) {
      let on = 0; for (let t = 0; t < v.period; t += 0.05) on += W.vanishState(v, t).visible ? 1 : 0;
      assert(Math.abs(on / (v.period / 0.05) - v.on / v.period) < 0.03, 'visible for the stated fraction');
      assert(W.vanishState(v, (v.period - v.phase) % v.period + 0.01).visible && !W.vanishState(v, (v.on - v.phase + v.period) % v.period + 0.01).visible);
    }
    if (il.kind === 'beam') assert(near(il.pieces.find((p) => p.kind === 'beam').x1 - il.pieces.find((p) => p.kind === 'beam').x0, DIM.BEAM_W));
  }
  assert.strictEqual(kinds.size, 4, 'all four interlude kinds occur');
});

test('layout: deterministic, a bonus row lengthens the course by exactly one row, colours follow the stages', () => {
  const s = specs[3], a = W.computeLayout(s), b = W.computeLayout(s);
  assert.deepStrictEqual(a, b);
  const { spec: t } = G.insertBonusRow(s, 1), c = W.computeLayout(t);
  assert(near(c.length - a.length, DIM.TILE_D + DIM.ROW_GAP), 'one more row pitch');
  assert.deepStrictEqual(c.rows.filter((r) => !r.bonus).map((r) => r.id), a.rows.map((r) => r.id));
  assert.strictEqual(W.colorAt(a, a.south + 3), 'amber');
  assert.strictEqual(W.colorAt(a, a.rows[0].zc), 'amber');
  assert.strictEqual(W.colorAt(a, a.rows[4].zc), 'green');
  assert.strictEqual(W.colorAt(a, a.rows[7].zc), 'cyan');
  assert.strictEqual(W.colorAt(a, a.rows[10].zc), 'gold');
  assert.deepStrictEqual(a.rows.slice(9).map((r) => r.label), ['BOSS 1/3', 'BOSS 2/3', 'BOSS 3/3']);
  assert.deepStrictEqual(a.rows.slice(0, 9).map((r) => r.label), Array.from({ length: 9 }, (_, i) => 'ROW ' + (i + 1)));
  assert.strictEqual(c.rows.filter((r) => r.label === 'BONUS').length, 1);
});


// ---------------------------------------------------------------- the motor: jump feel and the real course
const P = require('./bridge-play.js');
const DT = 1 / 60;
const flat = () => (pad) => ({ id: 'ground' });   // ground everywhere

test('motor: the jump lasts as long as PHYS.AIR and peaks at PHYS.APEX', () => {
  const m = P.createMotor(); let t = 0, apex = 0, jumped = false;
  for (let i = 0; i < 120; i++) {
    const ev = P.stepMotor(m, DT, i === 0, flat());
    if (ev.jumped) jumped = true;
    apex = Math.max(apex, m.alt);
    if (jumped && ev.landed) { t = i * DT; break; }
  }
  assert(jumped && Math.abs(t - PHYS.AIR) < 0.04, 'airtime ' + t);
  assert(Math.abs(apex - PHYS.APEX) < 0.03, 'apex ' + apex);
});

test('motor: coyote time lets a jump through just after the edge, and no later', () => {
  for (const [wait, ok] of [[PHYS.COYOTE * 0.5, true], [PHYS.COYOTE * 0.9, true], [PHYS.COYOTE * 1.3, false]]) {
    const m = P.createMotor(); let ground = true, jumped = false;
    P.stepMotor(m, DT, false, () => ground ? { id: 'g' } : null);
    ground = false;
    for (let t = 0; t < wait; t += DT) P.stepMotor(m, DT, false, () => null);
    const ev = P.stepMotor(m, DT, true, () => null); jumped = ev.jumped;
    assert.strictEqual(jumped, ok, `press ${wait}s after the edge`);
  }
});

test('motor: a jump pressed shortly before landing still fires on landing', () => {
  for (const [lead, ok] of [[PHYS.BUFFER * 0.6, true], [PHYS.BUFFER * 0.9, true], [PHYS.BUFFER * 2, false]]) {
    const m = P.createMotor(); let jumpsAfterLanding = 0;
    P.stepMotor(m, DT, true, flat());                       // jump
    let landed = false, i = 0;
    for (; i < 200 && !landed; i++) {                        // fly until `lead` before the landing
      const timeLeft = m.vy < 0 ? (-Math.abs(m.vy) + Math.sqrt(m.vy * m.vy + 2 * PHYS.GRAVITY * m.alt)) / PHYS.GRAVITY : Infinity;   // exact time to touchdown
      const press = timeLeft <= lead && !m._pressed; if (press) m._pressed = true;
      const ev = P.stepMotor(m, DT, press, flat());
      if (ev.landed) { landed = true; if (ev.jumped) jumpsAfterLanding++; }
    }
    assert.strictEqual(jumpsAfterLanding > 0, ok, `press ${lead}s before landing`);
  }
});

test('motor: once the glass shatters the fall is committed (no coyote jump, no landing back on the previous platform)', () => {
  const m = P.createMotor(), ground = () => ({ id: 'g' });
  P.stepMotor(m, DT, false, ground);            // standing on the doomed tile
  m.doomed = true;                              // it shatters
  let jumped = false, landed = false;
  for (let i = 0; i < 120; i++) { const ev = P.stepMotor(m, DT, i > 1 && i < 10, ground); jumped = jumped || ev.jumped; landed = landed || !!ev.landed; }   // spamming Space over solid ground
  assert(!jumped && !landed && m.alt < -9, 'it just falls');
  assert.strictEqual(P.createMotor().doomed, false, 'a fresh motor (after respawn) is normal');
});

// hero runs north at a fixed speed on the real course and presses jump at the last moment
function cross(L, from, dir, speed, { maxT = 3 } = {}) {
  const m = P.createMotor(); let x = from.x, z = from.z; const T0 = 0;
  const probe = (pad) => W.surfaceAt(L, x, z, T0, pad);
  P.stepMotor(m, DT, false, probe);
  for (let t = 0; t < maxT; t += DT) {
    const nx = x + dir[0] * speed * DT, nz = z + dir[1] * speed * DT;
    const wasGrounded = m.grounded, ahead = W.surfaceAt(L, nx, nz, T0, PHYS.EDGE);
    const press = m.grounded && !ahead;                      // jump as the edge arrives
    x = nx; z = nz;
    const ev = P.stepMotor(m, DT, press, probe);
    if (ev.landed) return { landed: ev.landed, x, z, t };
    if (m.alt < -3) return { landed: null, t };
  }
  return { landed: null, t: maxT };
}

test('motor on the real course: a walking jump crosses a row gap, a running one too, and neither skips the row', () => {
  for (const { L } of layouts.slice(0, 60)) {
    const start = L.platforms[0], first = L.rows[0], tile = first.tiles[Math.floor(first.n / 2)];
    const from = { x: tile.x, z: start.zn + 0.3 };
    for (const speed of [PHYS.WALK, PHYS.RUN]) {
      const r = cross(L, from, [0, -1], speed);
      assert(r.landed && r.landed.kind === 'tile' && r.landed.rowId === first.id, `a jump at ${speed} lands on the first row`);
    }
    let row = first;
    for (const next of L.rows.slice(1, 3)) {
      if (next.zs > row.zn) break;
      if (L.interludes.some((il) => il.zs < row.zn && il.zs > next.zs)) break;   // an interlude sits between these two
      const lane = Math.min(Math.floor(next.n / 2), next.n - 1);
      const r = cross(L, { x: next.tiles[lane].x, z: row.zn + 0.3 }, [0, -1], PHYS.WALK);
      assert(r.landed && r.landed.rowId === next.id, 'a walking jump reaches the next row');
      row = next;
    }
  }
});

test('motor on the real course: a walk-jump crosses the gap between lanes, in both directions', () => {
  for (const { L } of layouts.slice(0, 60)) for (const r of L.rows.filter((x) => x.n === 3)) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 1], [1, 0]]) {
      const from = { x: r.tiles[a].x + (b > a ? 1 : -1) * 1.2, z: r.zc }, dir = [b > a ? 1 : -1, 0];
      const res = cross(L, from, dir, PHYS.WALK);
      assert(res.landed && res.landed.lane === b, `lane ${a} -> ${b}`);
    }
  }
});

test('motor on the real course: stone gaps are walk-jumps, the moving platform gap is not a jump', () => {
  for (const { L } of layouts) for (const il of L.interludes) {
    if (il.kind === 'stones') for (let i = 1; i < il.pieces.length; i++) {
      const a = il.pieces[i - 1], b = il.pieces[i], x = Math.max(a.x0, b.x0) + 0.5 * (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const r = cross(L, { x, z: a.z0 + 0.4 }, [0, -1], PHYS.WALK);
      assert(r.landed && r.landed.id === b.id, 'stone ' + i);
    }
    if (il.kind === 'moving') {
      const padS = il.pieces.find((p) => p.id === 'padS');
      let r = cross(L, { x: L.cx, z: padS.z0 + 0.3 }, [0, -1], PHYS.RUN, { maxT: 1.2 });
      assert(!r.landed || r.landed.kind === 'moving', 'the 9-wide gap cannot be jumped');
    }
  }
});

// ---- every answer must be reachable: the generator may put the right tile in ANY lane, whatever lane you stand in
const allLinked = (L) => new Set(L.rows.map((r) => r.id));
const staticL = (L) => Object.assign({}, L, { surfaces: L.surfaces.filter((s) => s.kind !== 'moving').map((s) => (s.kind === 'vanish' ? Object.assign({}, s, { kind: 'stone' }) : s)) });   // interludes with their timing taken out
function runToward(L, x, z, tile, linked) {   // a run-jump steering at the nearest point of `tile` (there is full air control), pressed as the edge arrives
  const tx = Math.max(tile.x0 + 0.4, Math.min(tile.x1 - 0.4, x)), tz = tile.z1 - 0.4, d = Math.hypot(tx - x, tz - z), vx = ((tx - x) / d) * PHYS.RUN * DT, vz = ((tz - z) / d) * PHYS.RUN * DT;
  const m = P.createMotor(); let px = x, pz = z;
  const probe = (pad) => W.surfaceAt(L, px, pz, 0, pad, undefined, linked);
  P.stepMotor(m, DT, false, probe);
  for (let t = 0; t < 3; t += DT) {
    const ahead = W.surfaceAt(L, px + vx, pz + vz, 0, PHYS.EDGE, undefined, linked), press = m.grounded && !ahead;
    px += vx; pz += vz; const ev = P.stepMotor(m, DT, press, probe);
    if (ev.landed) return ev.landed;
    if (m.alt < -3) return null;
  }
  return null;
}
function runNorth(L, x, z, linked) {   // a run-jump straight north from (x, z), pressed as the edge arrives
  const m = P.createMotor(); let px = x, pz = z;
  const probe = (pad) => W.surfaceAt(L, px, pz, 0, pad, undefined, linked);
  P.stepMotor(m, DT, false, probe);
  for (let t = 0; t < 3; t += DT) {
    const nz = pz - PHYS.RUN * DT, ahead = W.surfaceAt(L, px, nz, 0, PHYS.EDGE, undefined, linked), press = m.grounded && !ahead;
    pz = nz; const ev = P.stepMotor(m, DT, press, probe);
    if (ev.landed) return ev.landed;
    if (m.alt < -3) return null;
  }
  return null;
}
const walkable = (L, x0, x1, z, linked) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 0.1) if (!W.surfaceAt(L, x, z, 0, PHYS.EDGE, undefined, linked)) return false; return true; };

test('why the lanes link up: without links the far lanes of two 3-tile rows are out of any jump\'s reach', () => {
  const edge = DIM.TILE_W + 2 * DIM.LANE_GAP, diag = Math.hypot(edge, DIM.ROW_GAP);
  console.log(`   lane 0 -> lane 2 across a row gap: ${diag.toFixed(2)} on the diagonal, a run-jump reaches ${PHYS.reach(PHYS.RUN).toFixed(2)}`);
  assert(diag > PHYS.reach(PHYS.RUN) + 1);
  const L = layouts[0].L; const row = L.rows.find((r) => r.n === 3);
  assert.strictEqual(W.surfaceAt(L, (row.tiles[0].x1 + row.tiles[1].x0) / 2, row.zc, 0, 0), null, 'the links are not there before the row is answered');
  const s = W.surfaceAt(L, (row.tiles[0].x1 + row.tiles[1].x0) / 2, row.zc, 0, 0, undefined, new Set([row.id]));
  assert(s && s.kind === 'link', 'they are solid once it is');
});

test('every lane of every row is reachable from every lane of the row before (walk the linked row, then run-jump)', () => {
  let pairs = 0;
  for (const { L } of layouts.slice(0, 60)) {
    const linked = allLinked(L);
    for (let k = 0; k + 1 < L.rows.length; k++) {
      const a = L.rows[k], b = L.rows[k + 1];
      if (Math.abs(a.zn - DIM.ROW_GAP - b.zs) > 1e-6) continue;   // an interlude sits between these two
      for (const ta of a.tiles) for (const tb of b.tiles) {
        pairs++;
        assert(walkable(L, ta.x, tb.x, a.zc, linked), `walk from lane ${ta.lane} to ${tb.lane} along the answered row`);
        const land = runNorth(L, tb.x, a.zn + 0.3, linked);
        assert(land && land.kind === 'tile' && land.rowId === b.id && land.lane === tb.lane, `${a.id} lane ${ta.lane} -> ${b.id} lane ${tb.lane}`);
      }
    }
  }
  console.log(`   ${pairs} lane-to-lane transitions checked, all reachable`);
});

test('every lane of the first row after a platform is reachable', () => {
  for (const { L } of layouts.slice(0, 60)) for (const plat of L.platforms.slice(0, 4)) {
    const next = L.rows.find((r) => Math.abs(plat.zn - DIM.ROW_GAP - r.zs) < 1e-6); if (!next) continue;
    for (const tb of next.tiles) {
      const land = runNorth(L, tb.x, plat.zn + 0.3, allLinked(L));
      assert(land && land.rowId === next.id && land.lane === tb.lane, `${plat.kind} -> ${next.id} lane ${tb.lane}`);
    }
  }
});

test('every interlude can be entered from the row before and left to any lane of the row after', () => {
  let n = 0;
  for (const { L } of layouts.slice(0, 120)) {
    const S2 = staticL(L), linked = allLinked(L);
    for (const il of L.interludes) {
      const before = L.rows.find((r) => Math.abs(r.zn - DIM.ROW_GAP - il.zs) < 1e-6), after = L.rows.find((r) => Math.abs(il.zn - DIM.ROW_GAP - r.zs) < 1e-6);
      const solid = il.pieces.filter((p) => p.kind !== 'moving');
      const first = solid.filter((p) => Math.abs(p.z1 - il.zs) < 1e-6), last = solid.filter((p) => Math.abs(p.z0 - il.zn) < 1e-6);
      if (before) {   // in: stand anywhere on the answered row that lines up with the first piece
        const x = (Math.max(first[0].x0, before.tiles[0].x0) + Math.min(first[0].x1, before.tiles[before.n - 1].x1)) / 2;
        assert(walkable(S2, before.tiles[0].x, x, before.zc, linked));
        const land = runNorth(S2, x, before.zn + 0.3, linked);
        assert(land && il.pieces.some((p) => p.id === land.id), il.kind + ' entry'); n++;
      }
      if (after) for (const tb of after.tiles) {   // out: from the last piece, to every lane
        const lp = last.slice().sort((p, q) => Math.abs((p.x0 + p.x1) / 2 - tb.x) - Math.abs((q.x0 + q.x1) / 2 - tb.x))[0];   // the nearest exit piece
        const home = Math.max(lp.x0 + 0.2, Math.min(lp.x1 - 0.2, tb.x)), tile = { x0: tb.x0, x1: tb.x1, z0: after.zn, z1: after.zs };
        const land = runToward(S2, home, lp.z0 + 0.3, tile, linked);   // stand at the edge of the exit piece nearest the lane, then steer
        assert(land && land.rowId === after.id && land.lane === tb.lane, `${il.kind} exit -> lane ${tb.lane}`); n++;
      }
    }
  }
  console.log(`   ${n} interlude entries and exits checked`);
});

test('stars: 3 needs at most 2 knowledge falls and no Scan; 2 at most 5; a Scan caps at 2', () => {
  assert.strictEqual(P.starsFor({ falls: 0, scans: 0 }), 3);
  assert.strictEqual(P.starsFor({ falls: 2, scans: 0 }), 3);
  assert.strictEqual(P.starsFor({ falls: 3, scans: 0 }), 2);
  assert.strictEqual(P.starsFor({ falls: 5, scans: 0 }), 2);
  assert.strictEqual(P.starsFor({ falls: 6, scans: 0 }), 1);
  assert.strictEqual(P.starsFor({ falls: 0, scans: 1 }), 2);
  assert.strictEqual(P.starsFor({ falls: 9, scans: 2 }), 1);
});

test('memory progress: runs advance, history carries over, two first-try variants master a concept', () => {
  const pr = P.memoryProgress({ playerId: 'z', runIndex: 4 });
  assert.strictEqual(pr.newRun().runIndex, 4); assert.strictEqual(pr.newRun().runIndex, 5);
  pr.onEvent({ type: 'answer', conceptId: 'T1', variantId: 'T1a', correct: true, firstTry: true });
  assert(!pr.newRun().history.concepts.T1.mastered);
  pr.onEvent({ type: 'answer', conceptId: 'T1', variantId: 'T1a', correct: true, firstTry: true });
  assert(!pr.newRun().history.concepts.T1.mastered, 'the same variant twice does not count');
  pr.onEvent({ type: 'answer', conceptId: 'T1', variantId: 'T1b', correct: true, firstTry: true });
  assert(pr.newRun().history.concepts.T1.mastered);
  pr.onEvent({ type: 'finish', seen: ['T1a'] });
  assert.deepStrictEqual(pr.newRun().history.runs, [{ variants: ['T1a'] }]);
});


// ---------------------------------------------------------------- progress, mastery, persistence
const PR = require('./bridge-progress.js');
const ans = (conceptId, variantId, o = {}) => Object.assign({ type: 'answer', conceptId, variantId, correct: true, firstTry: true, ms: 4000, wrongId: null }, o);
const fresh = () => ({ d: PR.emptyData('tester'), cur: { runIndex: 0, run: null } });
const feed = (s, ...events) => { for (const e of events) PR.applyEvent(s.d, e, s.cur); return s; };

test('mastery: a first-try correct answer in two different variants on two different runs, nothing less', () => {
  let s = fresh();
  feed(s, { type: 'run', runIndex: 0, seed: 1 }, ans('T1', 'T1a'), ans('T1', 'T1b'));
  assert(!s.d.concepts.T1.mastered, 'two variants within one run is not enough');
  s = fresh();
  feed(s, { type: 'run', runIndex: 0 }, ans('T1', 'T1a'), { type: 'run', runIndex: 1 }, ans('T1', 'T1a'));
  assert(!s.d.concepts.T1.mastered, 'the same variant again on another run is not enough');
  feed(s, { type: 'run', runIndex: 2 }, ans('T1', 'T1b'));
  assert(s.d.concepts.T1.mastered, 'a different variant on a different run is');
  s = fresh();
  feed(s, { type: 'run', runIndex: 0 }, ans('T2', 'T2a', { firstTry: false }), { type: 'run', runIndex: 1 }, ans('T2', 'T2b', { firstTry: false }), { type: 'run', runIndex: 2 }, ans('T2', 'T2c'));
  assert(!s.d.concepts.T2.mastered, 'correct but not first try never counts');
  assert.strictEqual(PR.topicStats(s.d)[0].mastery, 0.25, 'one first-try success is half a concept');
});

test('answers: attempts, falls, wrong tiles hit and the average answer time', () => {
  const s = feed(fresh(), { type: 'run', runIndex: 0 }, ans('M1', 'M1a', { correct: false, firstTry: false, wrongId: 'M1a.w2', ms: 6000 }), ans('M1', 'M1b', { firstTry: false, ms: 2000 }));
  const c = s.d.concepts.M1;
  assert.deepStrictEqual([c.attempts, c.falls, c.firstTryCorrect, c.avgAnswerMs, c.wrong['M1a.w2']], [2, 1, 0, 4000, 1]);
  assert.deepStrictEqual(c.variantsSeen, ['M1a', 'M1b']);
});

test('runs: started, finished and abandoned runs are all remembered; the list is capped', () => {
  const s = fresh();
  feed(s, { type: 'run', runIndex: 0, seed: 7, seen: ['T1a'] }, ans('T1', 'T1b'), { type: 'abandon', falls: 1 });
  feed(s, { type: 'run', runIndex: 1, seed: 8, seen: ['S1a'] }, { type: 'finish', stars: 2, falls: 3, scans: 1, tokens: 80, bestStreak: 4, seconds: 300, seen: ['S1a', 'S1b'] });
  assert.deepStrictEqual(s.d.runs.map((r) => [r.finished, r.stars]), [[false, 0], [true, 2]]);
  assert.deepStrictEqual(s.d.runs[0].variants, ['T1a', 'T1b'], 'answers add the variants seen');
  assert.deepStrictEqual(PR.historyFor(s.d).runs.map((r) => r.variants), [['T1a', 'T1b'], ['S1a', 'S1b']]);
  for (let i = 0; i < 50; i++) feed(s, { type: 'run', runIndex: 2 + i }, { type: 'abandon' });
  assert.strictEqual(s.d.runs.length, 30);
});

test('topics: seven bars in the zone colours, boss concepts count, weights favour the weak', () => {
  const s = fresh();
  assert.strictEqual(PR.topicStats(s.d).length, 7);
  assert.deepStrictEqual(PR.topicStats(s.d).map((t) => t.total), [2, 2, 3, 2, 2, 3, 3], 'models, guardrails and approvals include their boss concept');
  assert.deepStrictEqual(PR.topicStats(s.d).map((t) => t.zone), ['amber', 'amber', 'green', 'green', 'cyan', 'cyan', 'cyan']);
  feed(s, { type: 'run', runIndex: 0 }, ans('T1', 'T1a'), { type: 'run', runIndex: 1 }, ans('T1', 'T1b'));   // tokens: T1 mastered, T2 untouched
  feed(s, ans('S1', 'S1a', { correct: false, firstTry: false }));                                          // safety: a fall, nothing mastered
  const stat = Object.fromEntries(PR.topicStats(s.d).map((t) => [t.id, t]));
  assert.strictEqual(stat.tokens.mastery, 0.5); assert.strictEqual(stat.tokens.mastered, 1); assert.strictEqual(stat.safety.mastery, 0);
  const w = s.d.topicWeights;
  assert(w.safety > w.tokens, 'safety is weaker than tokens');
  assert.strictEqual(w.verify, 1.5, 'an unmet topic is neutral');
  assert(w.tokens > 0.5 && w.safety <= 2.5);
});

test('revisit list: only met, unmastered concepts, the most-missed first, with the idea', () => {
  const s = feed(fresh(), { type: 'run', runIndex: 0 }, ans('G1', 'G1a', { correct: false, firstTry: false }), ans('G1', 'G1b', { correct: false, firstTry: false }), ans('A1', 'A1a', { correct: false, firstTry: false }), ans('P1', 'P1a'));
  const r = PR.revisitList(s.d);
  assert.deepStrictEqual(r.map((x) => x.id), ['G1', 'A1', 'P1']);
  assert(r[0].title === 'Rules, not requests' && r[0].idea.length > 10 && r[0].topicName === 'Guardrails');
  assert.strictEqual(PR.revisitList(s.d, 2).length, 2);
});

test('storage: round trip, corrupt data, a broken browser, and per-player keys', () => {
  const mem = {}; const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const a = PR.create({ storage });
  const r0 = a.newRun(); assert.strictEqual(r0.runIndex, 0);
  a.onEvent({ type: 'run', runIndex: 0, seed: 5, seen: ['T1a'] }); a.onEvent(ans('T1', 'T1a'));
  const b = PR.create({ storage });                               // a new page load
  assert.strictEqual(b.data.playerId, a.data.playerId);
  assert.strictEqual(b.newRun().runIndex, 1, 'the run index carries on');
  assert.strictEqual(b.data.concepts.T1.attempts, 1);
  assert.deepStrictEqual(Object.keys(mem), [PR.KEY], 'one key');
  mem[PR.KEY] = '{ not json';
  assert.strictEqual(PR.create({ storage }).data.runCount, 0, 'corrupt data starts fresh');
  mem[PR.KEY] = JSON.stringify({ v: 2, concepts: {}, runs: [] });
  assert.strictEqual(PR.create({ storage }).data.runCount, 0, 'an unknown version starts fresh');
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const c = PR.create({ storage: broken }); c.onEvent({ type: 'run', runIndex: 0 }); c.onEvent(ans('T1', 'T1a'));
  assert.strictEqual(c.storageOk(), false); assert.strictEqual(c.data.concepts.T1.attempts, 1, 'still works in memory');
  const f = PR.create({ storage, fixed: { playerId: 'sam', runIndex: 3 } });
  assert.strictEqual(f.newRun().runIndex, 3, 'a fixed runIndex is the first run'); assert.strictEqual(f.newRun().runIndex, 4); assert.strictEqual(f.data.playerId, 'sam');
  assert(Object.keys(mem).includes(PR.KEY + ':sam'), 'a fixed player gets its own key');
});

test('export: plain JSON for the HR rubric, all 17 concepts, no raw run specs', () => {
  const s = feed(fresh(), { type: 'run', runIndex: 0, seed: 9 }, ans('T1', 'T1a'), { type: 'finish', stars: 3, falls: 0, scans: 0, tokens: 125, bestStreak: 3, seconds: 400, seen: ['T1a'] });
  const x = PR.buildExport(s.d, new Date('2026-11-05T10:00:00Z'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(x)), x);
  assert.strictEqual(x.concepts.length, 17); assert.strictEqual(x.topics.length, 7);
  assert.deepStrictEqual([x.summary.runsFinished, x.summary.bestStars, x.summary.tokensBanked, x.summary.conceptsTotal], [1, 3, 125, 17]);
  assert(x.concepts.find((c) => c.id === 'T1').title === 'Shared budget' && x.exportedAt.startsWith('2026-11-05'));
  assert(!JSON.stringify(x).includes('"rows"'), 'no question content is dumped');
});

test('generator honours topicWeights: a weak topic takes the double slot more often', () => {
  const tally = (tw) => { let tokens = 0; for (let i = 0; i < 400; i++) { const s = G.composeRun(G.seedFor('w' + i, 0), { topicWeights: tw }); if (s.rows.filter((r) => r.topic === 'tokens' && !r.boss).length === 2) tokens++; } return tokens / 400; };
  const even = tally({}), weak = tally({ tokens: 2.5, safety: 0.5 }), strong = tally({ tokens: 0.5, safety: 2.5 });
  console.log(`   tokens gets the double slot: ${(100 * even).toFixed(0)}% even, ${(100 * weak).toFixed(0)}% when weak, ${(100 * strong).toFixed(0)}% when strong`);
  assert(weak > even + 0.1 && strong < even - 0.1);
});

test('end to end: a player who answers well masters concepts over runs and the weights follow', () => {
  const pr = PR.create({ storage: { getItem: () => null, setItem() {} } });
  let masteredAt = null;
  for (let i = 0; i < 40; i++) {
    const r = pr.newRun(), s = G.composeRun(G.seedFor(r.playerId, r.runIndex), r.history);
    pr.onEvent({ type: 'run', runIndex: r.runIndex, seed: s.seed, seen: s.seen });
    for (const row of s.rows) pr.onEvent(ans(row.conceptId, row.variantId, { rowId: row.id, firstTry: true }));
    pr.onEvent({ type: 'finish', stars: 3, falls: 0, scans: 0, tokens: 300, bestStreak: 12, seconds: 300, seen: s.seen });
    const m = Object.values(pr.data.concepts).filter((c) => c.mastered).length;
    if (m === 17 && masteredAt === null) masteredAt = i + 1;
  }
  console.log(`   all 17 concepts mastered after ${masteredAt} perfect runs`);
  assert(masteredAt !== null && masteredAt <= 25, 'perfect play masters everything');
  const stats = PR.topicStats(pr.data);
  assert(stats.every((t) => t.mastery === 1));
  assert(Object.values(pr.data.topicWeights).every((w) => w === 0.5), 'nothing is weak any more');
});

console.log(`\n${checks} checks passed`);
