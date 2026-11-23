// Token Brew Kitchen — progress tests (plain node): mastery, the counters, the recorded runs, a whole shift played through the rules, the shared store, the export section and the migration of older saves.
//   node js/kitchen-progress-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const KP = require('./kitchen-progress.js');
const P = require('./kitchen-play.js');
const O = require('./kitchen-orders.js');
const BP = require('./bridge/bridge-progress.js');
const CP = require('./carrom-progress.js');

const ans = (o) => Object.assign({ type: 'answer', conceptId: 'size', variantId: 'translate', kind: 'ok', clean: true }, o);
const fin = (clean, o) => Object.assign({ type: 'finish', stars: 2, points: 11, maxPoints: 15, timeMs: 180000, clean }, o);
const fresh = () => ({ d: KP.emptyData(), cur: { runIndex: 0, run: null } });
const feed = (st, events) => events.forEach((e) => KP.applyEvent(st.d, e, st.cur));
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const needs = (o) => o.cards.filter((c) => c.kind === 'need').map((c) => c.id);

test('mastery: a perfect order in two DIFFERENT tasks on two DIFFERENT runs masters a concept; the same task twice, or both in one run, does not; an unfinished run masters nothing', () => {
  const a = fresh(); feed(a, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ size: ['translate'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ size: ['report'] })]); assert(a.d.concepts.size.mastered);
  const same = fresh(); feed(same, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ size: ['translate'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ size: ['translate'] })]); assert(!same.d.concepts.size.mastered, 'same task twice');
  const one = fresh(); feed(one, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ size: ['translate', 'report'] })]); assert(!one.d.concepts.size.mastered, 'both in one run');
  const ab = fresh(); feed(ab, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), { type: 'abandon', timeMs: 1 }, { type: 'run', runIndex: 1, seed: 2 }, ans({ variantId: 'report' }), { type: 'abandon', timeMs: 1 }]); assert(!ab.d.concepts.size.mastered && ab.d.concepts.size.attempts === 2, 'what was served counts, but nothing is mastered');
  const none = fresh(); feed(none, [{ type: 'run', runIndex: 0, seed: 1 }, fin({}), { type: 'run', runIndex: 1, seed: 2 }, fin({})]); assert(!none.d.concepts.size);
  assert(KP.isMastered({ cleanRuns: [{ v: 'a', r: 0 }, { v: 'b', r: 1 }] }) && !KP.isMastered({ cleanRuns: [{ v: 'a', r: 0 }, { v: 'a', r: 1 }] }) && !KP.isMastered({ cleanRuns: [{ v: 'a', r: 0 }] }));
});

test('counts: attempts, perfect orders and each kind of fall (wrong pot, junk in the pot, overflow, something left out, too late); a concept this game does not have is ignored', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), ans({ kind: 'wrongpot', clean: false }), ans({ kind: 'junk', clean: false }), ans({ kind: 'overflow', clean: false }), ans({ kind: 'missing', clean: false }), ans({ kind: 'late', clean: false }), ans({ variantId: 'report' })]);
  const c = s.d.concepts.size; assert.deepStrictEqual([c.attempts, c.clean, c.wrongPot, c.junk, c.overflow, c.missing, c.late], [7, 2, 1, 1, 1, 1, 1]); assert.deepStrictEqual(c.variantsSeen, ['translate', 'report']);
  feed(s, [ans({ conceptId: 'NOPE' }), ans({ conceptId: 'K2', variantId: 'K2-1a' })]); assert(!s.d.concepts.NOPE && !s.d.concepts.K2, 'a concept this game does not have (the old kitchen\'s K2 included) is ignored');
  assert.deepStrictEqual(O.CONCEPTS.map((x) => x.id), ['size', 'trim', 'check']);
});

test('runs are recorded ({ seed, stars, points, maxPoints, timeMs, variants }), the history keeps 30, and a shift left half way keeps its variants but is not finished', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 77 }, { type: 'shift', variants: ['translate', 'report'] }, { type: 'shift', variants: ['report', 'agenda'] }, ans({ kind: 'junk', clean: false }), fin({ size: ['translate'] })]);
  assert.deepStrictEqual(s.d.runs[0], { runIndex: 0, seed: 77, finished: true, stars: 2, points: 11, maxPoints: 15, timeMs: 180000, variants: ['translate', 'report', 'agenda'] });
  const many = fresh(); for (let i = 0; i < 40; i++) feed(many, [{ type: 'run', runIndex: i, seed: i }]); assert.strictEqual(many.d.runs.length, 30);
  const half = fresh(); feed(half, [{ type: 'run', runIndex: 0, seed: 1 }, { type: 'shift', variants: ['papers'] }, { type: 'abandon', timeMs: 5 }]); assert.deepStrictEqual(half.d.runs[0].variants, ['papers']); assert.strictEqual(half.d.runs[0].finished, false); assert.strictEqual(half.d.runs[0].timeMs, 5);
  const stray = fresh(); feed(stray, [fin({ size: ['x'] }), { type: 'abandon' }, { type: 'shift', variants: ['a'] }]); assert.deepStrictEqual(stray.d.concepts, {}, 'events with no run in progress change nothing');
});

test('concept stats: the three lessons in order, each with its idea, how many orders and how many perfect, and whether it is mastered', () => {
  assert.deepStrictEqual(KP.conceptStats(KP.emptyData()).map((x) => [x.id, x.attempts, x.mastered]), [['size', 0, false], ['trim', 0, false], ['check', 0, false]]);
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'trim', variantId: 'agenda' }), ans({ conceptId: 'trim', variantId: 'compare', kind: 'junk', clean: false }), fin({ trim: ['agenda'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ trim: ['compare'] })]);
  const t = KP.conceptStats(s.d).find((x) => x.id === 'trim'); assert.deepStrictEqual([t.attempts, t.clean, t.mastered], [2, 1, true]); assert(t.idea.length > 0 && t.title === 'Trim the context');
});

// a whole shift, played perfectly through the rules, feeds the adapter exactly as kitchen-play.js emits to it
function playOne(a, perfect = true) {
  const r = a.newRun(), spec = O.buildShift(r.playerId, r.runIndex), run = P.createRun(spec);
  a.onEvent({ type: 'run', runIndex: r.runIndex, seed: spec.seed }); a.onEvent({ type: 'shift', variants: spec.orders.map((o) => o.task) });
  while (!run.done) {
    const o = run.order(); run.gotIt(); run.pickPot(perfect || o.ramp.onlyRightPot ? o.need : O.POTS.find((p) => p.id !== o.need).id);   // the tutorial locks the other pots
    for (const c of o.cards) run.place(c.id, o.ramp.onlyRightPot || needs(o).includes(c.id) ? 'pot' : 'bin');
    const s = run.serve(); a.onEvent({ type: 'answer', credit: true, conceptId: o.concept, variantId: o.task, kind: s.kind, clean: s.total === 3, ok: s.happy }); run.next();
  }
  const sum = { stars: run.shiftStars(), points: run.stars(), maxPoints: run.maxStars(), timeMs: 1000, clean: run.cleanVariants() };
  a.onEvent(Object.assign({ type: 'finish' }, sum)); return { run, sum };
}
test('a whole shift played through the rules feeds the adapter: stats, perfect tasks and the export follow, and two perfect runs master the lessons', () => {
  const storage = mem(), shared = BP.create({ storage }), a = KP.create({ shared }); a.attach({}, { sys() {} });
  const s1 = playOne(a), s2 = playOne(a), d = a.data;
  assert.strictEqual(d.runCount, 2); assert(d.runs.every((r) => r.finished && r.stars === 3 && r.points === 15 && r.variants.length === 5)); assert.strictEqual(s1.sum.points, 15); assert.strictEqual(s2.sum.stars, 3);
  assert.strictEqual(Object.values(d.concepts).reduce((n, c) => n + c.attempts, 0), 10); assert.strictEqual(d.concepts.size.attempts, 4); assert.strictEqual(d.concepts.trim.attempts, 4); assert.strictEqual(d.concepts.check.attempts, 2);
  assert(Object.values(d.concepts).every((c) => c.clean === c.attempts && c.wrongPot === 0 && c.junk === 0 && c.overflow === 0 && c.missing === 0));
  assert(d.concepts.size.mastered && d.concepts.trim.mastered, 'two perfect runs master the lessons that have two orders a shift');
  const exp = shared.exportJSON(); assert.strictEqual(exp.schema, 2); assert(exp.games.includes('kitchen')); assert.strictEqual(exp.kitchen.game, 'Uplink · Token Brew Kitchen'); assert.strictEqual(exp.kitchen.summary.runsFinished, 2);
  assert.strictEqual(exp.kitchen.summary.ordersServed, 10); assert.strictEqual(exp.kitchen.summary.ordersPerfect, 10); assert.strictEqual(exp.kitchen.concepts.length, 3); assert(exp.concepts, 'the bridge\'s own fields stay where they were'); assert.strictEqual(exp.kitchen.runs[0].points, 15);
  assert(exp.kitchen.summary.conceptsMastered >= 2); assert.deepStrictEqual(exp.kitchen.concepts.map((c) => c.id), ['size', 'trim', 'check']);
  const bad = playOne(a, false); assert(bad.sum.stars < 3 && a.data.concepts.size.wrongPot >= 1, 'a wrong pot every time is counted as such'); assert.deepStrictEqual(a.data.runs[2].variants.length, 5);
});

test('the shared store: one export for every game, with a clearly named "kitchen" section beside the other games, and the adapter offers the download the results screen uses', () => {
  const storage = mem(), shared = BP.create({ storage }); CP.create({ shared }).attach({ debrief: null }, { sys() {} }); const a = KP.create({ shared }); a.attach({}, {});
  a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 5 }); a.onEvent(ans({})); a.onEvent(fin({ size: ['translate'] }));
  const exp = shared.exportJSON(); assert(exp.games.includes('kitchen') && exp.games.includes('carrom')); assert.strictEqual(exp.kitchen.summary.runsStarted, 1); assert.strictEqual(exp.kitchen.concepts.find((c) => c.id === 'size').attempts, 1);
  assert.deepStrictEqual(Object.keys(exp.kitchen).sort(), ['concepts', 'exportedAt', 'game', 'mastery', 'runs', 'schema', 'summary']); assert.strictEqual(typeof a.download, 'function');
  assert.deepStrictEqual(a.exportSection().summary, exp.kitchen.summary, 'the section on its own is the same');
});

test('migration: a save from before the kitchen (the bridge, carrom, the tower, spot shot and the mill) loads untouched, gains an empty "kitchen" slot, and nothing else moves', () => {
  const old = { v: 1, playerId: 'p-old', runCount: 3, concepts: { T1: { attempts: 4, firstTryCorrect: 3, falls: 1, variantsSeen: ['T1a'], firstTry: [{ v: 'T1a', r: 0 }], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} } }, runs: [{ runIndex: 0, seed: 9 }], topicWeights: {},
    carrom: { v: 1, runCount: 2, concepts: { CW1: { attempts: 2, firstTryCorrect: 2, strikes: 0, partial: 0, variantsSeen: ['CW1a'], firstTry: [{ v: 'CW1a', r: 0 }], shots: [1, 1], mastered: false, wrong: {} } }, runs: [], sideWeights: { works: 1.1 } },
    jenga: { v: 1, runCount: 1, concepts: { JA1: { attempts: 1, firstTryCorrect: 1, wrongTries: 0, timedOut: 0, partial: 0, toppled: 0, variantsSeen: ['JA1a'], firstTry: [{ v: 'JA1a', r: 0 }], wrong: {}, mastered: false } }, runs: [], sideWeights: {} },
    gallery: { v: 1, runCount: 2, concepts: { XC1: { attempts: 4, correctHandled: 3, wrong: 1, luckyShots: 1, inspectedCorrect: 0, partial: 0, variantsSeen: ['XC1a'], clean: [{ v: 'XC1a', r: 0 }], mastered: false } }, runs: [], sideWeights: {} },
    mill: { v: 1, runCount: 1, concepts: { MD1: { attempts: 2, correct: 1, laxErrors: 1, strictErrors: 0, dropped: 0, partial: 0, variantsSeen: ['MD1a'], clean: [], mastered: false } }, runs: [], sideWeights: { doors: 1.2 } } };
  const m = { [BP.KEY]: JSON.stringify(old) }, storage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage }); assert.strictEqual(shared.data.kitchen, undefined, 'no slot yet');
  const a = KP.create({ shared }); assert.deepStrictEqual(a.data, KP.emptyData()); a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 1 }); a.onEvent(ans({}));
  const after = JSON.parse(m[BP.KEY]); for (const k of ['carrom', 'jenga', 'gallery', 'mill', 'concepts', 'runs', 'topicWeights']) assert.deepStrictEqual(after[k], old[k], k + ' is untouched'); assert.strictEqual(after.playerId, 'p-old'); assert.strictEqual(after.runCount, 3);
  assert.strictEqual(after.kitchen.runCount, 1); assert.strictEqual(after.kitchen.concepts.size.attempts, 1); assert.strictEqual(after.v, 1, 'the data version stays 1');
  const again = BP.create({ storage }), b = KP.create({ shared: again }); assert.strictEqual(b.data.concepts.size.attempts, 1, 'reloaded'); assert.deepStrictEqual(CP.bridgeTopicsMastered(again.data), { mastered: 0, total: 7 });
  assert.strictEqual(BP.create({ storage: { getItem: () => null, setItem() {} } }).data.kitchen, undefined, 'a brand-new player has no slot until the kitchen is played');
});

test('migration: a save from the earlier kitchen (nine token-economy concepts) loads, keeps its old concepts exactly as they were, counts runs on from where they stopped, and the export lists only the new lessons', () => {
  const oldKitchen = { v: 1, runCount: 4, concepts: { K2: { attempts: 6, clean: 4, variantsSeen: ['K2-1a', 'K2-2a'], bleeds: 1, cutoffs: 0, overstuffed: 1, rambling: 0, missed: 0, left: 0, partial: 0, cleanRuns: [{ v: 'K2-1a', r: 0 }, { v: 'K2-2a', r: 2 }], mastered: true } },
    runs: [{ runIndex: 3, seed: 8, finished: true, stars: 2, coins: 300, spills: 1, tokensSpent: 1700, idealTokens: 1500, timeMs: 255000, variants: ['K2-1a'] }], weights: { K2: 0.35 } };
  const m = { [BP.KEY]: JSON.stringify({ v: 1, playerId: 'p-k', runCount: 0, concepts: {}, runs: [], topicWeights: {}, kitchen: oldKitchen }) }, storage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage }), a = KP.create({ shared }); a.attach({}, {}); const r = a.newRun(); assert.strictEqual(r.runIndex, 4, 'run numbers go on from the old count'); assert.strictEqual(r.playerId, 'p-k');
  a.onEvent({ type: 'run', runIndex: 4, seed: 1 }); a.onEvent(ans({})); a.onEvent(fin({ size: ['translate'] }));
  const k = JSON.parse(m[BP.KEY]).kitchen; assert.deepStrictEqual(k.concepts.K2, oldKitchen.concepts.K2, 'the old concept is kept untouched'); assert.deepStrictEqual(k.runs[0], oldKitchen.runs[0]); assert.strictEqual(k.runs.length, 2); assert.strictEqual(k.concepts.size.attempts, 1);
  const exp = shared.exportJSON().kitchen; assert.deepStrictEqual(exp.concepts.map((c) => c.id), ['size', 'trim', 'check']); assert.strictEqual(exp.summary.ordersServed, 1, 'the old orders are not counted as these');
});
done();
