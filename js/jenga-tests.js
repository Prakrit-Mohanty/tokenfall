// Self-test for Token Tower: content, the statics engine, the run generator and its fairness. Run: node js/jenga-tests.js
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { test, done, mean, words, addRank, uniform } = require('./test-kit.js');
const E = require('./jenga-engine.js');
const G = require('./jenga-generator.js');
const BG = require('./bridge-generator.js');
const C = require('./jenga-content.js');
const { LIMITS, CARDS } = C;

const N = 500;
const rngOf = (s) => BG.mulberry32(s);
const noRandom = (fn) => { const r = Math.random; Math.random = () => { throw new Error('Math.random is not allowed here'); }; try { return fn(); } finally { Math.random = r; } };
const fill = (s, b) => BG.fill(s, b);
function* combos(params) {   // every sample of a param table (an object entry binds several names at once)
  let acc = [{}];
  for (const k of Object.keys(params)) { const n = []; for (const a of acc) for (const v of params[k]) n.push(Object.assign({}, a, v && typeof v === 'object' ? v : { [k]: v })); acc = n; }
  yield* acc;
}

// ================================================================= content
test('content: 19 cards, 4+ variants each, a flip variant each, 4+ wrong tags each, ids that cannot collide with the other games', () => {
  const bridge = require('./bridge-content.js'), carrom = require('./carrom-content.js'), ids = new Set();
  assert.strictEqual(CARDS.length, 19);
  for (const c of CARDS) {
    assert(c.id.startsWith('J') && !bridge.CARDS.some((b) => b.id === c.id) && !carrom.CARDS.some((b) => b.id === c.id), c.id);
    assert(c.variants.length >= LIMITS.minVariants, c.id + ' variants'); assert(c.variants.some((v) => v.flip), c.id + ' needs a flip variant');
    assert(c.idea && c.title && C.SIDES[c.side], c.id);
    for (const v of c.variants) { assert(!ids.has(v.id), 'duplicate ' + v.id); ids.add(v.id); assert(v.wrong.length >= LIMITS.minWrong, v.id); for (const w of v.wrong) assert(w.breaks && w.text, w.id); }
  }
  assert.deepStrictEqual(SIDES_OF(['JF1', 'JF2', 'JF3']), ['approach', 'proof', 'pilot']);
});
function SIDES_OF(ids) { return ids.map((id) => CARDS.find((c) => c.id === id).counts); }

test('content: every sample of every variant respects the string limits (stem <= 28 words, tags <= 30 chars, within 25% of the correct tag, no unfilled {})', () => {
  let n = 0;
  for (const c of CARDS) for (const v of c.variants) for (const p of combos(v.params)) {
    const d = C.derive(v, p); assert(d, v.id + ' derive'); const b = Object.assign({}, p, d); n++;
    assert(words(fill(v.stem, b)) <= LIMITS.stemWords, v.id + ' stem');
    const cor = fill(v.correct, b), wr = v.wrong.map((w) => fill(w.text, b));
    for (const t of [cor].concat(wr)) { assert(t.length <= LIMITS.tagChars && !/[{}]/.test(t) && !/all of the above/i.test(t), v.id + ': ' + t); }
    for (const t of wr) assert(Math.min(t.length, cor.length) / Math.max(t.length, cor.length) >= LIMITS.lenRatio, `${v.id}: "${t}" vs "${cor}"`);
    assert.strictEqual(new Set([cor].concat(wr)).size, wr.length + 1, v.id + ' duplicate tags');
    for (const w of v.wrong) assert(!/[{}]/.test(fill(w.breaks, b)), w.id);
  }
  console.log('   ' + n + ' param samples checked');
});

test('content: the computed card (agents never ... 90/95/99 % over 5-20 steps): k = round(10 x (p/100)^n), and three-plus decoys at least 1 from k and from each other', () => {
  const want = { '90/5': 6, '90/10': 3, '90/20': 1, '95/10': 6, '95/20': 4, '99/10': 9, '99/20': 8 }, v = CARDS.find((c) => c.id === 'JG2').variants[0];
  for (const k in want) {
    const [p, n] = k.split('/').map(Number), d = C.derive(v, { p, n }), runs = [d.d1, d.d2, d.d3, d.d4].map((s) => parseInt(s, 10));
    assert.strictEqual(parseInt(d.k1, 10), want[k], k);
    assert(runs.every((r) => Math.abs(r - want[k]) >= 1) && new Set(runs).size === 4 && runs.every((r) => r >= 0 && r <= 10), k + ' ' + runs);
  }
});

// ================================================================= the statics engine
const rng0 = rngOf(2024);
const starts = Array.from({ length: 60 }, () => E.makeTower(rng0));
const withPlacements = starts.map((s, i) => {   // some towers with a few legal placements on top, to get partial layers and lean
  let t = s.tower; const r = rngOf(900 + i);
  for (let j = 0; j < i % 7; j++) { const sl = E.slots(t); if (!sl.legal.length) break; t = E.applyPlace(t, { id: 'p' + j, answerText: 'x' }, sl.legal[(r() * sl.legal.length) | 0]).tower; }
  return t;
});

test('engine: a full tower is stable with a large margin, and every interface holds the same 1.5 widths', () => {
  const st = E.stability(E.fullTower());
  assert(st.minMargin >= 0.45 && E.band(st.minMargin) === 'green', 'min ' + st.minMargin);
  assert(st.byInterface.every((m) => m >= 0.45));
  const hull = st.hullPoints; assert(hull.length >= 4);
});
test('engine: removing a whole side of a layer (the middle block and one outer block) goes negative; one outer block alone does not', () => {
  const t = E.fullTower(), two = E.removeBlock(E.removeBlock(t, 'b5.1'), 'b5.2'), one = E.removeBlock(t, 'b5.2');
  const st = E.stability(two);
  assert(st.minMargin < 0 && E.band(st.minMargin) === 'tip' && st.weakestInterface === 5, JSON.stringify(st.weakest));
  assert(E.stability(one).minMargin >= 0.45);
  assert(E.stability(E.removeBlock(E.removeBlock(t, 'b5.0'), 'b5.1')).minMargin < 0, 'either side');
});
test('engine: centre pulls from a full tower stay stable with the full margin, in every layer 1-14', () => {
  const t = E.fullTower();
  for (let k = 1; k <= 14; k++) { assert(E.canPull(t, 'b' + k + '.1'), 'layer ' + k); assert(E.pullMargin(t, 'b' + k + '.1') >= 0.45); }
  assert(!E.canPull(t, 'b15.1') && !E.canPull(t, 'b0.1'), 'not the top layer, not the table layer');
});
test('engine: an off-centre heavy top tips (8 full layers, then six single blocks hanging at u = 1.2)', () => {
  const t = E.fullTower(8);
  for (let k = 8; k < 14; k++) t.layers.push([{ id: 'h' + k, layer: k, uCoord: 1.2 }]);
  const st = E.stability(t);
  assert(st.minMargin < 0 && E.band(st.minMargin) === 'tip', 'margin ' + st.minMargin);
  assert(st.comPoint && st.hullPoints.length >= 3);
  const centred = E.fullTower(8); for (let k = 8; k < 14; k++) centred.layers.push([{ id: 'c' + k, layer: k, uCoord: 0 }]);
  assert(E.stability(centred).minMargin >= 0.45, 'the same weight over the middle holds');
});
test('engine: bands (green >= 0.25, amber 0.08-0.25, red 0-0.08, tip < 0) and the wrong-try shake lowers the displayed margin for about 10 s', () => {
  assert.deepStrictEqual([0.5, 0.25, 0.2, 0.08, 0.05, 0, -0.01].map(E.band), ['green', 'green', 'amber', 'amber', 'red', 'red', 'tip']);
  assert(E.shakePenalty(2, 0) > E.shakePenalty(1, 0) && E.shakePenalty(1, 5) < E.shakePenalty(1, 0) && E.shakePenalty(2, 10) === 0);
});
test('engine: pure and deterministic: no Math.random, equal inputs give equal outputs, inputs are never mutated', () => {
  noRandom(() => {
    const a = E.makeTower(rngOf(5)), b = E.makeTower(rngOf(5));
    assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a.pulled, E.makeTower(rngOf(6)).pulled);
    assert.deepStrictEqual(E.stability(a.tower), E.stability(b.tower));
    const before = JSON.stringify(a.tower), id = E.blocks(a.tower).find((x) => E.canPull(a.tower, x.id)).id;
    E.applyPull(a.tower, id); E.applyPlace(a.tower, { id: 'n' }, 0); E.placementRange(a.tower, { id: 'n' }); E.stability(a.tower);
    assert.strictEqual(JSON.stringify(a.tower), before, 'mutated');
    const s1 = E.collapseInit(a.tower, rngOf(3)), s2 = E.collapseInit(a.tower, rngOf(3));
    for (let i = 0; i < 60; i++) { E.collapseStep(s1, 1 / 60); E.collapseStep(s2, 1 / 60); }
    assert.deepStrictEqual(s1, s2);
  });
});
test('engine: start towers have 4-6 pulls, one per layer and none in the top or bottom two, every pull still stable, final stability >= 0.2', () => {
  for (const s of starts) {
    assert(s.pulled.length >= 4 && s.pulled.length <= 6); assert.strictEqual(new Set(s.pulled.map((p) => p.layer)).size, s.pulled.length);
    assert(s.pulled.every((p) => p.layer >= 2 && p.layer <= 13)); assert(E.stability(s.tower).minMargin >= 0.2);
    assert.strictEqual(E.blocks(s.tower).length, 48 - s.pulled.length);
  }
  assert(new Set(starts.map((s) => s.pulled.map((p) => p.id).join())).size > 40, 'different seeds, different damage');
});
test('engine: canPull is exactly "pull margin >= 0.12 and every block still supported", and monotonic in the threshold', () => {
  for (const t of withPlacements) for (const b of E.blocks(t)) {
    const m = E.pullMargin(t, b.id), top = E.topLayer(t);
    assert.strictEqual(E.canPull(t, b.id), m >= 0.12);
    if (E.canPull(t, b.id, 0.3)) assert(E.canPull(t, b.id), 'a stricter threshold cannot allow more');
    if (b.layer < 1 || b.layer >= top) assert.strictEqual(m, -Infinity);
    else if (m >= 0.12) { const after = E.stability(E.removeBlock(t, b.id)); assert(after.minMargin > E.UNSUPPORTED && after.minMargin >= 0.12); }
  }
});
test('engine: placementRange equals a brute-force stability() check of every legal position, on the layer it names', () => {
  let fresh = 0;
  for (const t of withPlacements) {
    const r = E.placementRange(t, { id: 'x' }), sl = E.slotsAt(t, r.layer), slow = sl.legal.filter((u) => E.stability(E.applyPlace(t, { id: 'x' }, u, r.layer).tower).minMargin >= E.LIM.place);
    const fast = r.ranges.flatMap(([a, b]) => { const o = []; for (let u = a; u <= b + 1e-9; u = E.snap(u + E.STEP)) o.push(u); return o; });
    assert.deepStrictEqual(fast, slow); assert(Math.abs(r.free - slow.length / sl.legal.length) < 1e-12);
    if (r.layer !== E.slots(t).layer) { fresh++; assert(r.fresh && r.layer === E.slots(t).layer + 1 && E.placementRange.length >= 0); const own = E.slots(t); assert(!slowOk(t, own), 'only when the partly built layer cannot take it'); }
  }
  console.log('   ' + fresh + ' of ' + withPlacements.length + ' towers send the block to a fresh layer');
});
function slowOk(t, s) { const ok = s.legal.filter((u) => E.stability(E.applyPlace(t, { id: 'x' }, u, s.layer).tower).minMargin >= E.LIM.place); return ok.length > 0 && ok.length / s.legal.length >= E.LIM.free; }
test('engine: a block placed past the tower\'s edge always tips; the top layer fills to 3 blocks, then a fresh perpendicular layer starts', () => {
  for (const t of withPlacements) for (const u of E.slots(t).legal.filter((x) => Math.abs(x) > E.HALF + 1e-9)) assert(E.stability(E.applyPlace(t, { id: 'x' }, u).tower).minMargin < 0, 'u ' + u);
  let t = E.fullTower(4); assert.strictEqual(E.slots(t).layer, 4);
  t = E.applyPlace(t, { id: 'a' }, -1).tower; t = E.applyPlace(t, { id: 'b' }, 0).tower;
  assert.throws(() => E.applyPlace(t, { id: 'c' }, -0.5), /cannot place/, 'no overlap');
  assert.strictEqual(E.slots(t).layer, 4); assert.deepStrictEqual(E.slots(t).legal.filter((u) => u > -1.95 && u < 0.95), [], 'only the gaps beside the two blocks are legal'); assert(E.slots(t).legal.includes(1) && E.slots(t).legal.includes(2));
  t = E.applyPlace(t, { id: 'c', answerText: 'Hi' }, 1).tower; assert.strictEqual(E.slots(t).layer, 5); assert.strictEqual(t.layers[4][2].answerText, 'Hi');
  assert.strictEqual(E.stability(t).minMargin >= 0.45, true);
});
test('engine: the collapse settles (finite numbers, resting on the table or the floor), the same every time, and it starts at the weak interface', () => {
  const t = E.stability(E.removeBlock(E.removeBlock(E.fullTower(), 'b6.1'), 'b6.2')).minMargin < 0 ? E.removeBlock(E.removeBlock(E.fullTower(), 'b6.1'), 'b6.2') : null;
  const S = E.collapseInit(t, rngOf(1)); let steps = 0;
  assert.strictEqual(S.k0, 6); assert(S.bodies.filter((b) => b.released === 0).every((b) => b.layer > 6));
  while (!E.collapseDone(S) && steps++ < 60 * 12) E.collapseStep(S, 1 / 60);
  assert(E.collapseDone(S), 'still moving after ' + S.t.toFixed(1) + ' s');
  for (const b of S.bodies) { assert(b.pos.concat([b.tx, b.tz, b.yaw]).every(Number.isFinite)); assert(b.pos[1] >= S.opt.floorY); }
  const above = S.bodies.filter((b) => b.layer > 6), moved = above.filter((b) => Math.hypot(b.pos[0], b.pos[2]) > 1.5).length;
  assert(moved > above.length / 2, 'the top half should fly outward');
});

// ================================================================= the generator
const runs = Array.from({ length: N }, (_, i) => G.composeRun(G.seedFor('player-' + i, 0)));
const qs = runs.flatMap((r) => r.questions);
const opts = (q) => q.options;

test('seedFor: deterministic, per player and run, and not the bridge\'s or carrom\'s stream', () => {
  assert.strictEqual(G.seedFor('amy', 3), G.seedFor('amy', 3)); assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('amy', 4)); assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('raj', 3));
  assert.notStrictEqual(G.seedFor('amy', 3), BG.seedFor('amy', 3)); assert.notStrictEqual(G.seedFor('amy', 3), require('./carrom-generator.js').seedFor('amy', 3));
});
test('composeRun: deterministic (no Math.random) and the runSpec is plain JSON', () => {
  noRandom(() => { const a = G.composeRun(77), b = G.composeRun(77); assert.deepStrictEqual(a, b); assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), a); });
  assert.notDeepStrictEqual(G.composeRun(77), G.composeRun(78));
});
test('shape: 7 questions = the four sides in a seeded order, then the 3-question finale on one scenario', () => {
  const orders = new Set();
  for (const r of runs) {
    assert.strictEqual(r.questions.length, 7); const sides = r.questions.slice(0, 4).map((q) => q.side); orders.add(sides.join());
    assert.deepStrictEqual([...sides].sort(), ['agents', 'approach', 'pilot', 'proof']);
    assert.deepStrictEqual(r.questions.slice(4).map((q) => q.conceptId), ['JF1', 'JF2', 'JF3']);
    assert.strictEqual(new Set(r.questions.slice(4).map((q) => q.scenario)).size, 1); assert.strictEqual(r.questions[4].scenario, r.finale.scenario);
    assert(r.questions.slice(0, 4).every((q) => q.kind === 'side' && !q.scenario) && r.questions.slice(4).every((q) => q.kind === 'finale'));
    assert.strictEqual(r.start.pulled.length, r.start.pulled.length >= 4 && r.start.pulled.length <= 6 ? r.start.pulled.length : -1);
  }
  assert(orders.size >= 20, 'side order varies: ' + orders.size);
});
test('questions: exactly one correct candidate, 4 numbered options, no duplicate tag texts, string limits hold', () => {
  for (const q of qs) {
    assert.strictEqual(opts(q).length, 4); assert.deepStrictEqual(opts(q).map((o) => o.n), [1, 2, 3, 4]);
    assert.strictEqual(opts(q).filter((o) => o.correct).length, 1); assert(opts(q)[q.correctN - 1].correct);
    assert.strictEqual(new Set(opts(q).map((o) => o.text)).size, 4);
    assert(words(q.stem) <= LIMITS.stemWords && !/\{\w+\}/.test(q.stem), q.stem);
    const cl = opts(q)[q.correctN - 1].text.length;
    for (const o of opts(q)) { assert(o.text.length <= LIMITS.tagChars && !/\{\w+\}/.test(o.text) && !/all of the above/i.test(o.text), o.text); assert(Math.min(o.text.length, cl) / Math.max(o.text.length, cl) >= LIMITS.lenRatio, o.text); if (!o.correct) assert(o.breaks && !/\{\w+\}/.test(o.breaks), 'breaks'); }
  }
});
test('candidates: pullable at their question, layers 2 to top-2, four layers (span >= 3), both faces; the plan can always place the correct block with >= 20% of the span free', () => {
  for (const r of runs) {
    let T = JSON.parse(JSON.stringify(r.start.tower));
    for (const q of r.questions) {
      const top = E.topLayer(T), bs = opts(q).map((o) => E.find(T, o.blockId));
      assert(bs.every((b) => b && E.canPull(T, b.id) && b.layer >= 2 && b.layer <= top - 2), 'candidate not pullable');
      assert(new Set(bs.map((b) => b.layer)).size === 4 && Math.max(...bs.map((b) => b.layer)) - Math.min(...bs.map((b) => b.layer)) >= 2);
      assert(new Set(opts(q).map((o) => o.face)).size >= 2, 'two faces'); assert(opts(q).every((o) => o.face === (o.layer % 2 ? (q.view.sz > 0 ? 'S' : 'N') : (q.view.sx > 0 ? 'E' : 'W'))));
      const cb = opts(q)[q.correctN - 1], range = G.placeable(T, cb.blockId); assert(range && range.free >= 0.2, 'doomed tower');
      T = E.applyPlace(E.applyPull(T, cb.blockId), { id: cb.blockId, answerText: cb.text }, q.place.uCoord, q.place.layer).tower;
      assert(E.stability(T).minMargin >= E.LIM.place, 'the planned placement is stable');
    }
    assert.deepStrictEqual(T, G.replay(r, 7)); assert(E.height(T) >= 17);
  }
});
test('robust to the player: whatever stable spot they pick (low end, high end, random), every later question can still be resolved and placed', () => {
  for (const policy of ['lo', 'hi', 'rand']) for (const r of runs.slice(0, 160)) {
    let T = JSON.parse(JSON.stringify(r.start.tower)); const rr = rngOf(r.seed);
    for (const q0 of r.questions) {
      const q = G.resolveQuestion(T, q0); assert(q, `${policy}: question ${q0.id} has no pullable set`);
      const cb = opts(q)[q.correctN - 1], range = G.placeable(T, cb.blockId); assert(range, `${policy}: correct pull cannot be placed`);
      assert.deepStrictEqual(opts(q).map((o) => o.text), opts(q0).map((o) => o.text), 'words never change');
      let u; if (policy === 'rand') { const us = range.ranges.flatMap(([a, b]) => { const o = []; for (let x = a; x <= b + 1e-9; x = E.snap(x + E.STEP)) o.push(x); return o; }); u = us[(rr() * us.length) | 0]; } else u = E.choosePlacement(range, policy);
      T = E.applyPlace(E.applyPull(T, cb.blockId), { id: cb.blockId, answerText: cb.text }, u, range.layer).tower;
      assert(E.stability(T).minMargin >= E.LIM.place);
    }
  }
});
test('resolveQuestion leaves a valid question alone, and re-deals only the blocks of an invalid one', () => {
  const r = runs[0], q = r.questions[0]; assert.strictEqual(G.resolveQuestion(r.start.tower, q), q);
  const broken = E.removeBlock(r.start.tower, opts(q)[0].blockId), fixed = G.resolveQuestion(broken, q);
  assert(fixed && fixed !== q && fixed.options.every((o) => E.find(broken, o.blockId)) && fixed.correctN === q.correctN);
  assert.deepStrictEqual(fixed.options.map((o) => o.text), opts(q).map((o) => o.text)); assert.deepStrictEqual(G.resolveQuestion(broken, q), fixed, 'deterministic');
});
test('fairness: the correct candidate\'s number, layer, slot, pull margin and tag-length rank are uniform (within 8%)', () => {
  const num = [0, 0, 0, 0], layer = [0, 0, 0, 0], slot = [0, 0, 0], marg = [0, 0, 0, 0], len = [0, 0, 0, 0];
  for (const r of runs) {
    let T = JSON.parse(JSON.stringify(r.start.tower));
    for (const q of r.questions) {
      const ci = q.correctN - 1; num[ci]++; slot[opts(q)[ci].slot]++;
      addRank(layer, opts(q).map((o) => o.layer), ci); addRank(marg, opts(q).map((o) => E.pullMargin(T, o.blockId)), ci); addRank(len, opts(q).map((o) => o.text.length), ci);
      const cb = opts(q)[ci]; T = E.applyPlace(E.applyPull(T, cb.blockId), { id: cb.blockId, answerText: cb.text }, q.place.uCoord, q.place.layer).tower;
      assert.strictEqual(q.rank, opts(q).filter((o) => o.text.length < cb.text.length).length, 'q.rank is the real length rank');
    }
  }
  uniform('number 1-4', num); uniform('layer rank (low to high)', layer); uniform('slot (left, middle, right)', slot); uniform('pull-margin rank', marg); uniform('tag-length rank (short to long)', len);
  const mc = qs.filter((q) => opts(q)[q.correctN - 1].text.length > Math.max(...opts(q).filter((o) => !o.correct).map((o) => o.text.length))).length / qs.length;
  console.log(`   correct tag is the longest in ${(100 * mc).toFixed(1)}% of questions (25% if there is no tell)`);
});
test('different players get different questions, answers, starting towers and block positions; two random seeds share < 30% of (concept, variant, params)', () => {
  const sig = (r) => r.questions.map((q) => [q.conceptId, q.variantId, JSON.stringify(q.params)].join('|'));
  assert.strictEqual(new Set(runs.map((r) => r.start.pulled.map((p) => p.id).join())).size > N * 0.9, true, 'start towers');
  assert(new Set(runs.map((r) => r.questions.flatMap((q) => opts(q).map((o) => o.blockId)).join())).size > N * 0.98, 'block positions');
  assert(new Set(runs.map((r) => r.questions.map((q) => q.options[q.correctN - 1].text).join())).size > N * 0.95, 'answers');
  const pr = rngOf(9); let tot = 0, worst = 0; const M = 2000;
  for (let i = 0; i < M; i++) { const x = (pr() * N) | 0, y = (x + 1 + ((pr() * (N - 1)) | 0)) % N, a = sig(runs[x]), b = sig(runs[y]), sh = a.filter((x, k) => x === b[k]).length / 7; tot += sh; worst = Math.max(worst, sh); }
  console.log(`   mean shared ${(100 * tot / M).toFixed(1)}%, worst pair ${(100 * worst).toFixed(0)}%`);
  assert(tot / M < 0.3);
});
test('anti-repeat: never a variant from the player\'s last 3 Token Tower runs; weak concepts come back more often, mastered ones less', () => {
  for (let p = 0; p < 25; p++) {
    const hist = { runs: [], concepts: {} };
    for (let n = 0; n < 12; n++) {
      const r = G.composeRun(G.seedFor('hist-' + p, n), hist), last = hist.runs.slice(-3).flatMap((x) => x.variants);
      assert(r.seen.every((v) => !last.includes(v)), `player ${p} run ${n} repeats a recent variant`);
      hist.runs.push({ variants: r.seen });
    }
  }
  const mastered = { runs: [], concepts: { JA1: { mastered: true }, JA3: { mastered: true }, JA4: { mastered: true }, JA2: { mastered: false, wrongTries: 3 } } };
  const pick = Array.from({ length: 300 }, (_, i) => G.composeRun(G.seedFor('w', i), mastered).questions.find((q) => q.side === 'approach').conceptId);
  const share = pick.filter((c) => c === 'JA2').length / pick.length; console.log(`   the missed concept is dealt ${(100 * share).toFixed(0)}% of the time (25% with no history)`);
  assert(share > 0.5);
});
test('rerollQuestion: a fresh variant of the same concept, the same blocks, correct number and placement, so every later tower is unchanged', () => {
  let changed = 0;
  for (const r of runs.slice(0, 120)) for (const i of [0, 2, 4, 6]) {
    const { spec, question } = G.rerollQuestion(r, i), q = r.questions[i];
    assert.strictEqual(question.conceptId, q.conceptId); assert.strictEqual(question.correctN, q.correctN); assert.deepStrictEqual(question.place, q.place);
    assert.deepStrictEqual(question.options.map((o) => o.blockId), q.options.map((o) => o.blockId)); assert.deepStrictEqual(G.replay(spec, 7).layers.map((l) => l.map((b) => [b.id, b.uCoord])), G.replay(r, 7).layers.map((l) => l.map((b) => [b.id, b.uCoord])));
    assert.strictEqual(question.options.filter((o) => o.correct).length, 1); assert.strictEqual(new Set(question.options.map((o) => o.text)).size, 4);
    if (q.kind === 'side') { assert.notStrictEqual(question.variantId, q.variantId); assert(!r.questions.some((x) => x.variantId === question.variantId)); changed++; } else assert.strictEqual(question.scenario, q.scenario);
    assert.strictEqual(spec.questions[i], question); assert.strictEqual(r.questions[i].variantId, q.variantId, 'the original is untouched');
  }
  assert(changed > 100);
});
test('pace: 7 questions x about 35 s stays under the 5:00 clock', () => {
  for (const r of runs) { assert.strictEqual(r.clockSec, 300); assert(r.estSeconds === 7 * 35 && r.estSeconds < r.clockSec); }
});

test('the other games\' tests still pass (bridge, carrom)', () => {
  for (const f of ['bridge-tests.js', 'carrom-tests.js', 'carrom-physics-tests.js', 'carrom-play-tests.js', 'carrom-progress-tests.js', 'carrom-world-tests.js']) {
    const out = execFileSync('node', [path.join(__dirname, f)], { encoding: 'utf8' });
    console.log('   ' + f + ': ' + out.trim().split('\n').pop());
  }
});
done();
