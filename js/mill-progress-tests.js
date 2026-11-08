// Self-test for Token Mill progress: mastery, partial credit, the history the generator reads, the shared store, the export section and the migration. Run: node js/mill-progress-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const MP = require('./mill-progress.js');
const E = require('./mill-engine.js');
const P = require('./mill-play.js');
const BP = require('./bridge-progress.js');
const CP = require('./carrom-progress.js');
const C = require('./mill-content.js');
const BG = require('./bridge-generator.js');

const ans = (o) => Object.assign({ type: 'answer', credit: true, conceptId: 'MD1', variantId: 'MD1a', correct: true, direction: null, severe: false }, o);
const fin = (clean, o) => Object.assign({ type: 'finish', stars: 2, accuracy: 0.8, severe: 1, dropped: 1, cost: 120, idealCost: 100, correct: 50, total: 62, timeMs: 270000, clean }, o);
const fresh = () => ({ d: MP.emptyData(), cur: { runIndex: 0, run: null } });
const feed = (st, events) => events.forEach((e) => MP.applyEvent(st.d, e, st.cur));

test('mastery: clean runs in two DIFFERENT variants on two DIFFERENT runs master a concept; the same variant twice, or both in one run, does not; an unfinished run masters nothing', () => {
  const a = fresh(); feed(a, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ MD1: ['MD1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ MD1: ['MD1b'] })]); assert(a.d.concepts.MD1.mastered);
  const same = fresh(); feed(same, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ MD1: ['MD1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ MD1: ['MD1a'] })]); assert(!same.d.concepts.MD1.mastered, 'same variant twice');
  const one = fresh(); feed(one, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ MD1: ['MD1a', 'MD1b'] })]); assert(!one.d.concepts.MD1.mastered, 'both in one run');
  const ab = fresh(); feed(ab, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ credit: false }), { type: 'abandon', timeMs: 1 }, { type: 'run', runIndex: 1, seed: 2 }, ans({ credit: false, variantId: 'MD1b' }), { type: 'abandon', timeMs: 1 }]); assert(!ab.d.concepts.MD1.mastered);
  const none = fresh(); feed(none, [{ type: 'run', runIndex: 0, seed: 1 }, fin({}), { type: 'run', runIndex: 1, seed: 2 }, fin({})]); assert(!none.d.concepts.MD1);
});
test('counts: right, too lax, too strict and dropped crates; a crate from a shift left with Esc is a partial attempt, never an attempt or a miss', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), ans({ correct: false, direction: 'lax', severe: true }), ans({ correct: false, direction: 'strict' }), ans({ correct: false, direction: 'dropped' }), ans({ credit: false, variantId: 'MD1b' }), ans({ conceptId: 'MR3', variantId: 'MR3a', correct: false, direction: 'strict' })]);
  const c = s.d.concepts; assert.deepStrictEqual([c.MD1.attempts, c.MD1.correct, c.MD1.laxErrors, c.MD1.strictErrors, c.MD1.dropped, c.MD1.partial], [4, 1, 1, 1, 1, 1]); assert.deepStrictEqual(c.MD1.variantsSeen, ['MD1a', 'MD1b']); assert.strictEqual(c.MR3.strictErrors, 1);
  feed(s, [ans({ conceptId: 'NOPE' })]); assert(!s.d.concepts.NOPE, 'a concept this game does not have is ignored');
});
test('runs are recorded ({ seed, stars, accuracy, spills, dropped, cost, idealCost, timeMs }), the history keeps 30 and hands the generator its crates, misses and mastery', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 77 }, { type: 'shift', items: ['MD1a.1', 'MD1a.2'] }, { type: 'shift', items: ['MD1a.2', 'MR1a.1'] }, ans({ correct: false, direction: 'lax' }), ans({ correct: false, direction: 'dropped' }), fin({}, { stars: 3, relaxed: true })]);
  assert.deepStrictEqual(s.d.runs[0], { runIndex: 0, seed: 77, finished: true, stars: 3, accuracy: 0.8, spills: 1, dropped: 1, cost: 120, idealCost: 100, timeMs: 270000, relaxed: true, items: ['MD1a.1', 'MD1a.2', 'MR1a.1'] });
  const h = MP.historyFor(s.d); assert.deepStrictEqual(h.runs, [{ items: ['MD1a.1', 'MD1a.2', 'MR1a.1'] }]); assert.deepStrictEqual(h.concepts.MD1, { attempts: 2, misses: 2, mastered: false });
  const spec = E.composeRun(7, h); assert(spec.shifts.flatMap((x) => x.crates).every((c) => !['MD1a.1', 'MD1a.2', 'MR1a.1'].includes(c.itemId)), 'the generator avoids the last run\'s crates');
  const many = fresh(); for (let i = 0; i < 40; i++) feed(many, [{ type: 'run', runIndex: i, seed: i }]); assert.strictEqual(many.d.runs.length, 30);
  const half = fresh(); feed(half, [{ type: 'run', runIndex: 0, seed: 1 }, { type: 'shift', items: ['MR2a.1'] }, { type: 'abandon', timeMs: 5, spills: 2, dropped: 1 }]); assert.deepStrictEqual(half.d.runs[0].items, ['MR2a.1']); assert.strictEqual(half.d.runs[0].finished, false);
});
test('side bars: the four sides in the amber / green / cyan / rose slots; a side never met gets a neutral weight, a mastered one a low one, a missed one a high one', () => {
  const st = MP.sideStats(MP.emptyData()); assert.deepStrictEqual(st.map((x) => x.id), ['doors', 'tiers', 'checks', 'incidents']); assert.deepStrictEqual(st.map((x) => x.total), [4, 4, 4, 4]);
  assert.deepStrictEqual(Object.values(MP.SIDE_STYLE).map((x) => x.name), ['amber', 'green', 'cyan', 'rose']); assert.deepStrictEqual(MP.sideWeights(MP.emptyData()), { doors: 1.5, tiers: 1.5, checks: 1.5, incidents: 1.5 });
  const all = fresh(); const cs = C.CONCEPTS.filter((c) => c.side === 'checks'); feed(all, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'MC1', variantId: 'MC1a' }), fin(Object.fromEntries(cs.map((c) => [c.id, [c.variants[0].id]]))), { type: 'run', runIndex: 1, seed: 2 }, fin(Object.fromEntries(cs.map((c) => [c.id, [c.variants[1].id]])))]);
  assert.strictEqual(MP.sideStats(all.d)[2].mastery, 1); assert.strictEqual(MP.sideWeights(all.d).checks, 0.5, 'every concept of the side mastered: dealt least');
  const miss = fresh(); feed(miss, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ correct: false, direction: 'lax' })]); assert.strictEqual(MP.sideWeights(miss.d).doors, 2.5); assert(E.composeRun(1, MP.historyFor(all.d)), 'the history shape is accepted by the generator');
});
test('revisit list: missed concepts first (too lax counts double), each with its one-line idea and which way it went wrong; mastered concepts never appear', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'MI4', variantId: 'MI4a', correct: false, direction: 'lax' }), ans({ conceptId: 'MI4', variantId: 'MI4a', correct: false, direction: 'lax' }), ans({ conceptId: 'MR3', variantId: 'MR3a', correct: false, direction: 'strict' }), ans({ conceptId: 'MD2', variantId: 'MD2a', correct: false, direction: 'dropped' }), ans({ conceptId: 'MC1', variantId: 'MC1a' })]);
  const r = MP.revisitList(s.d); assert.deepStrictEqual(r.map((x) => x.id), ['MI4', 'MD2', 'MR3']); assert(r[0].idea === C.byId.MI4.idea && /2 too lax/.test(r[0].note) && /1 dropped/.test(r[1].note) && /1 too strict/.test(r[2].note));
  s.d.concepts.MI4.mastered = true; assert(!MP.revisitList(s.d).some((x) => x.id === 'MI4'));
});
test('a whole run played through the rules feeds the adapter: stats, clean variants, the export and the history all follow', () => {
  const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  const shared = BP.create({ storage: mem }), a = MP.create({ shared }); a.attach({ debrief: null, tradeoff: P.tradeoff }, { sys() {}, talk() {} });
  function playOne() {
    const r = a.newRun(), spec = E.composeRun(E.seedFor(r.playerId, r.runIndex), r.history), run = P.createRun(spec);
    a.onEvent({ type: 'run', runIndex: r.runIndex, seed: spec.seed });
    spec.shifts.forEach((s, i) => {
      run.begin(i); a.onEvent({ type: 'shift', index: i, items: s.crates.map((c) => c.itemId) });
      s.schedule.forEach((e) => { const c = s.crates.find((x) => x.uid === e.uid); run.route(e.uid, c.rank, 1, e.t0 + 2); });
      for (const e of run.finish([], 9).entries) a.onEvent({ type: 'answer', credit: true, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, correct: e.correct, direction: e.direction, severe: e.severe });
    });
    const sum = run.score(true); a.onEvent(Object.assign({ type: 'finish', timeMs: 270000, clean: Object.fromEntries(Object.entries(sum.perConcept).map(([id, c]) => [id, c.cleanVariants])) }, sum)); return sum;
  }
  const s1 = playOne(), s2 = playOne(), d = a.data;
  assert.strictEqual(d.runCount, 2); assert(d.runs.every((r) => r.finished && r.items.length === 62 && r.stars === 3)); assert(s1.accuracy === 1 && s1.cost === s1.idealCost);
  assert.strictEqual(Object.values(d.concepts).reduce((n, c) => n + c.attempts, 0), 2 * 62); assert(d.runs[1].items.every((i) => !d.runs[0].items.includes(i)), 'run 2 shares no crate with run 1');
  assert(Object.values(d.concepts).some((c) => c.mastered), 'perfect play on two runs masters something'); assert(Object.values(d.concepts).every((c) => c.clean.every((x) => x.r === 0 || x.r === 1)));
  const exp = shared.exportJSON(); assert.strictEqual(exp.schema, 2); assert(exp.games.includes('mill')); assert.strictEqual(exp.mill.game, 'Uplink · Token Mill'); assert.strictEqual(exp.mill.summary.runsFinished, 2); assert.strictEqual(exp.mill.concepts.length, 16); assert(/SAMPLE/.test(exp.mill.sample));
  assert.strictEqual(exp.mill.summary.cratesRight, 124); assert(exp.concepts, 'the bridge\'s own fields stay where they were'); assert.strictEqual(exp.mill.runs[0].accuracy, 1);
});
test('the shared store: one export for every game, with a clearly named "mill" section beside the other games', () => {
  const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  const shared = BP.create({ storage: mem }); CP.create({ shared }).attach({ debrief: null }, { sys() {} }); const a = MP.create({ shared }); a.attach({}, {});
  a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 5 }); a.onEvent(ans({})); a.onEvent(fin({ MD1: ['MD1a'] }));
  const exp = shared.exportJSON(); assert(exp.games.includes('mill') && exp.games.includes('carrom')); assert.strictEqual(exp.mill.summary.runsStarted, 1); assert.strictEqual(exp.mill.concepts.find((c) => c.id === 'MD1').attempts, 1);
  assert.deepStrictEqual(Object.keys(exp.mill).sort(), ['concepts', 'exportedAt', 'game', 'mastery', 'runs', 'sample', 'schema', 'sideWeights', 'sides', 'summary']);
});
test('migration: a save from before Token Mill (the bridge, carrom, the tower and spot shot) loads untouched, gains an empty "mill" slot, and nothing else moves', () => {
  const old = { v: 1, playerId: 'p-old', runCount: 3, concepts: { T1: { attempts: 4, firstTryCorrect: 3, falls: 1, variantsSeen: ['T1a'], firstTry: [{ v: 'T1a', r: 0 }], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} } }, runs: [{ runIndex: 0, seed: 9 }], topicWeights: {},
    carrom: { v: 1, runCount: 2, concepts: { CW1: { attempts: 2, firstTryCorrect: 2, strikes: 0, partial: 0, variantsSeen: ['CW1a'], firstTry: [{ v: 'CW1a', r: 0 }], shots: [1, 1], mastered: false, wrong: {} } }, runs: [], sideWeights: { works: 1.1 } },
    jenga: { v: 1, runCount: 1, concepts: { JA1: { attempts: 1, firstTryCorrect: 1, wrongTries: 0, timedOut: 0, partial: 0, toppled: 0, variantsSeen: ['JA1a'], firstTry: [{ v: 'JA1a', r: 0 }], wrong: {}, mastered: false } }, runs: [], sideWeights: {} },
    gallery: { v: 1, runCount: 2, concepts: { XC1: { attempts: 4, correctHandled: 3, wrong: 1, luckyShots: 1, inspectedCorrect: 0, partial: 0, variantsSeen: ['XC1a'], clean: [{ v: 'XC1a', r: 0 }], mastered: false } }, runs: [], sideWeights: {} } };
  const m = { [BP.KEY]: JSON.stringify(old) }, mem = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage: mem }); assert.strictEqual(shared.data.mill, undefined, 'no slot yet');
  const a = MP.create({ shared }); assert.deepStrictEqual(a.data, MP.emptyData()); a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 1 }); a.onEvent(ans({}));
  const after = JSON.parse(m[BP.KEY]); for (const k of ['carrom', 'jenga', 'gallery', 'concepts', 'runs', 'topicWeights']) assert.deepStrictEqual(after[k], old[k], k + ' is untouched'); assert.strictEqual(after.playerId, 'p-old'); assert.strictEqual(after.runCount, 3);
  assert.strictEqual(after.mill.runCount, 1); assert.strictEqual(after.mill.concepts.MD1.attempts, 1); assert.strictEqual(after.v, 1, 'the data version stays 1');
  const again = BP.create({ storage: mem }), b = MP.create({ shared: again }); assert.strictEqual(b.data.concepts.MD1.attempts, 1, 'reloaded'); assert.deepStrictEqual(CP.bridgeTopicsMastered(again.data), { mastered: 0, total: 7 });
  assert.strictEqual(BP.create({ storage: { getItem: () => null, setItem() {} } }).data.mill, undefined, 'a brand-new player has no slot until Token Mill is played');
});
done();
