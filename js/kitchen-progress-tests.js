// Prompt Kitchen — progress tests (plain node): mastery, partial credit, the history the generator reads, the skill bars, the shared store, the export section and the migration of an older save.
//   node js/kitchen-progress-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const KP = require('./kitchen-progress.js');
const P = require('./kitchen-play.js');
const E = require('./kitchen-engine.js');
const B = require('./kitchen-bots.js');
const C = require('./kitchen-content.js');
const BP = require('./bridge/bridge-progress.js');
const CP = require('./carrom-progress.js');

const ans = (o) => Object.assign({ type: 'answer', credit: true, conceptId: 'K2', variantId: 'K2-1a', kind: 'served', clean: true }, o);
const fin = (clean, o) => Object.assign({ type: 'finish', stars: 2, coins: 300, spills: 1, spent: 1700, idealTokens: 1500, timeMs: 255000, clean }, o);
const fresh = () => ({ d: KP.emptyData(), cur: { runIndex: 0, run: null } });
const feed = (st, events) => events.forEach((e) => KP.applyEvent(st.d, e, st.cur));
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

test('mastery: a clean order in two DIFFERENT variants on two DIFFERENT runs masters a concept; the same variant twice, or both in one run, does not; an unfinished run masters nothing', () => {
  const a = fresh(); feed(a, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ K2: ['K2-1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ K2: ['K2-2a'] })]); assert(a.d.concepts.K2.mastered);
  const same = fresh(); feed(same, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ K2: ['K2-1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ K2: ['K2-1a'] })]); assert(!same.d.concepts.K2.mastered, 'same variant twice');
  const one = fresh(); feed(one, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ K2: ['K2-1a', 'K2-2a'] })]); assert(!one.d.concepts.K2.mastered, 'both in one run');
  const ab = fresh(); feed(ab, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ credit: false }), { type: 'abandon', timeMs: 1 }, { type: 'run', runIndex: 1, seed: 2 }, ans({ credit: false, variantId: 'K2-2a' }), { type: 'abandon', timeMs: 1 }]); assert(!ab.d.concepts.K2.mastered && ab.d.concepts.K2.partial === 2);
  const none = fresh(); feed(none, [{ type: 'run', runIndex: 0, seed: 1 }, fin({}), { type: 'run', runIndex: 1, seed: 2 }, fin({})]); assert(!none.d.concepts.K2);
});

test('counts: attempts, clean orders, leaks, cut-offs, over-stuffed, rambling, missed points and customers who left; an order from a shift left with Esc is a partial attempt, never an attempt or a fall', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), ans({ kind: 'bleed', clean: false }), ans({ kind: 'cutoff', clean: false }), ans({ kind: 'overstuffed', clean: false }), ans({ kind: 'rambling', clean: false }), ans({ kind: 'missing', clean: false }), ans({ kind: 'left', clean: false }), ans({ credit: false, variantId: 'K2-2a' })]);
  const c = s.d.concepts.K2; assert.deepStrictEqual([c.attempts, c.clean, c.bleeds, c.cutoffs, c.overstuffed, c.rambling, c.missed, c.left, c.partial], [7, 1, 1, 1, 1, 1, 1, 1, 1]); assert.deepStrictEqual(c.variantsSeen, ['K2-1a', 'K2-2a']);
  feed(s, [ans({ conceptId: 'NOPE' })]); assert(!s.d.concepts.NOPE, 'a concept this game does not have is ignored');
});

test('runs are recorded ({ seed, stars, coins, spills, tokensSpent, idealTokens, timeMs, variants }), the history keeps 30 and hands the generator its variants, falls and mastery', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 77 }, { type: 'shift', variants: ['K1-1a', 'K2-1a'] }, { type: 'shift', variants: ['K2-1a', 'K3-1b'] }, ans({ kind: 'bleed', clean: false }), ans({ kind: 'left', clean: false }), fin({ K2: ['K2-1a'] })]);
  assert.deepStrictEqual(s.d.runs[0], { runIndex: 0, seed: 77, finished: true, stars: 2, coins: 300, spills: 1, tokensSpent: 1700, idealTokens: 1500, timeMs: 255000, variants: ['K1-1a', 'K2-1a', 'K3-1b'] });
  const h = KP.historyFor(s.d); assert.deepStrictEqual(h.runs, [{ variants: ['K1-1a', 'K2-1a', 'K3-1b'] }]); assert.deepStrictEqual(h.concepts.K2, { attempts: 2, falls: 2, mastered: false });
  const spec = E.composeShift(7, h); assert(spec.tickets.every((t) => !['K1-1a', 'K2-1a', 'K3-1b'].includes(t.variantId)), 'the generator avoids the last run\'s variants');
  const many = fresh(); for (let i = 0; i < 40; i++) feed(many, [{ type: 'run', runIndex: i, seed: i }]); assert.strictEqual(many.d.runs.length, 30);
  const half = fresh(); feed(half, [{ type: 'run', runIndex: 0, seed: 1 }, { type: 'shift', variants: ['K5-1a'] }, { type: 'abandon', timeMs: 5, spills: 2 }]); assert.deepStrictEqual(half.d.runs[0].variants, ['K5-1a']); assert.strictEqual(half.d.runs[0].finished, false);
});

test('skill bars: the four skills in the amber / green / cyan / rose slots with their concepts; the weak-concept weights follow the shared formula (low once mastered, higher with each fall)', () => {
  const st = KP.skillStats(KP.emptyData()); assert.deepStrictEqual(st.map((x) => x.id), ['spend', 'signal', 'chat', 'clean']); assert.deepStrictEqual(st.map((x) => x.total), [2, 3, 2, 2]);
  assert.deepStrictEqual(Object.values(KP.SKILL_STYLE).map((x) => x.name), ['amber', 'green', 'cyan', 'rose']); assert.deepStrictEqual(st.map((x) => x.zone), ['amber', 'green', 'cyan', 'rose']);
  const w0 = KP.conceptWeights(KP.emptyData()); assert(Object.values(w0).every((v) => v === 1.4) && Object.keys(w0).length === 9);
  const all = fresh(); feed(all, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'K5', variantId: 'K5-1a' }), fin({ K5: ['K5-1a'], K8: ['K8-1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ K5: ['K5-2a'], K8: ['K8-2a'] })]);
  assert.strictEqual(KP.skillStats(all.d)[2].mastery, 1); assert.strictEqual(all.d.weights.K5, 0.35);
  const miss = fresh(); feed(miss, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ kind: 'bleed', clean: false }), ans({ kind: 'missing', clean: false })]); assert.strictEqual(miss.d.weights.K2, +(1.4 + 1.2).toFixed(3)); assert(E.composeShift(1, KP.historyFor(all.d)), 'the history shape is accepted');
});

test('revisit list: concepts fallen on most first (a leak counts most), each with its one-line idea and how it went wrong; mastered concepts never appear', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'K6', variantId: 'K6-1a', kind: 'bleed', clean: false }), ans({ conceptId: 'K6', variantId: 'K6-1a', kind: 'bleed', clean: false }), ans({ conceptId: 'K3', variantId: 'K3-1a', kind: 'missing', clean: false }), ans({ conceptId: 'K7', variantId: 'K7-1a', kind: 'rambling', clean: false })]);
  const r = KP.revisitList(s.d); assert.deepStrictEqual(r.map((x) => x.id), ['K6', 'K3', 'K7']); assert(r[0].idea === C.CONCEPTS.find((c) => c.id === 'K6').idea && /2 leaks/.test(r[0].note) && /1 missed the point/.test(r[1].note) && /1 rambling/.test(r[2].note));
  s.d.concepts.K6.mastered = true; assert(!KP.revisitList(s.d).some((x) => x.id === 'K6'));
});

// a whole run, played by the scripted player through the rules, feeds the adapter exactly as kitchen-play.js emits to it
function playOne(a, o) {
  const r = a.newRun(), spec = E.composeShift(E.seedFor(r.playerId, r.runIndex), r.history), run = P.createRun(spec);
  a.onEvent({ type: 'run', runIndex: r.runIndex, seed: spec.seed }); a.onEvent({ type: 'shift', variants: [...new Set(spec.tickets.map((t) => t.variantId))] });
  B.playAll(run, o); E.advance(run.st, 255);
  for (const x of run.st.results) { const tk = run.st.by[x.ticket]; a.onEvent({ type: 'answer', credit: true, conceptId: tk.concept, variantId: tk.variantId, kind: P.flagOf(x), clean: !!x.clean }); }
  const sum = P.summary(run); a.onEvent(Object.assign({ type: 'finish', clean: Object.fromEntries(Object.entries(sum.byConcept).map(([id, c]) => [id, c.variants])) }, sum)); return sum;
}
test('a whole shift played through the rules feeds the adapter: stats, clean variants, the export and the history all follow, and two perfect runs master concepts', () => {
  const storage = mem(), shared = BP.create({ storage }), a = KP.create({ shared }); a.attach({ debrief: null }, { sys() {}, talk() {} });
  const s1 = playOne(a), s2 = playOne(a), d = a.data;
  assert.strictEqual(d.runCount, 2); assert(d.runs.every((r) => r.finished && r.stars === 3 && r.variants.length >= 13 - 2)); assert(s1.coins === 455 && s2.stars === 3);
  assert.strictEqual(Object.values(d.concepts).reduce((n, c) => n + c.attempts, 0), 26); assert(Object.values(d.concepts).every((c) => c.bleeds === 0 && c.left === 0));
  assert(d.runs[1].variants.every((v) => !d.runs[0].variants.includes(v)), 'run 2 shares no variant with run 1');
  assert(Object.values(d.concepts).some((c) => c.mastered), 'perfect play on two runs masters something'); assert(Object.values(d.concepts).every((c) => c.cleanRuns.every((x) => x.r === 0 || x.r === 1)));
  const exp = shared.exportJSON(); assert.strictEqual(exp.schema, 2); assert(exp.games.includes('kitchen')); assert.strictEqual(exp.kitchen.game, 'Uplink · Prompt Kitchen'); assert.strictEqual(exp.kitchen.summary.runsFinished, 2); assert.strictEqual(exp.kitchen.concepts.length, 9);
  assert.strictEqual(exp.kitchen.summary.ordersServed, 26); assert(exp.concepts, 'the bridge\'s own fields stay where they were'); assert.strictEqual(exp.kitchen.runs[0].coins, 455); assert.strictEqual(exp.kitchen.skills.length, 4);
});

test('the shared store: one export for every game, with a clearly named "kitchen" section beside the other games', () => {
  const storage = mem(), shared = BP.create({ storage }); CP.create({ shared }).attach({ debrief: null }, { sys() {} }); const a = KP.create({ shared }); a.attach({}, {});
  a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 5 }); a.onEvent(ans({})); a.onEvent(fin({ K2: ['K2-1a'] }));
  const exp = shared.exportJSON(); assert(exp.games.includes('kitchen') && exp.games.includes('carrom')); assert.strictEqual(exp.kitchen.summary.runsStarted, 1); assert.strictEqual(exp.kitchen.concepts.find((c) => c.id === 'K2').attempts, 1);
  assert.deepStrictEqual(Object.keys(exp.kitchen).sort(), ['concepts', 'exportedAt', 'game', 'mastery', 'runs', 'schema', 'skills', 'summary', 'weights']);
});

test('migration: a save from before Prompt Kitchen (the bridge, carrom, the tower, spot shot and the mill) loads untouched, gains an empty "kitchen" slot, and nothing else moves', () => {
  const old = { v: 1, playerId: 'p-old', runCount: 3, concepts: { T1: { attempts: 4, firstTryCorrect: 3, falls: 1, variantsSeen: ['T1a'], firstTry: [{ v: 'T1a', r: 0 }], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} } }, runs: [{ runIndex: 0, seed: 9 }], topicWeights: {},
    carrom: { v: 1, runCount: 2, concepts: { CW1: { attempts: 2, firstTryCorrect: 2, strikes: 0, partial: 0, variantsSeen: ['CW1a'], firstTry: [{ v: 'CW1a', r: 0 }], shots: [1, 1], mastered: false, wrong: {} } }, runs: [], sideWeights: { works: 1.1 } },
    jenga: { v: 1, runCount: 1, concepts: { JA1: { attempts: 1, firstTryCorrect: 1, wrongTries: 0, timedOut: 0, partial: 0, toppled: 0, variantsSeen: ['JA1a'], firstTry: [{ v: 'JA1a', r: 0 }], wrong: {}, mastered: false } }, runs: [], sideWeights: {} },
    gallery: { v: 1, runCount: 2, concepts: { XC1: { attempts: 4, correctHandled: 3, wrong: 1, luckyShots: 1, inspectedCorrect: 0, partial: 0, variantsSeen: ['XC1a'], clean: [{ v: 'XC1a', r: 0 }], mastered: false } }, runs: [], sideWeights: {} },
    mill: { v: 1, runCount: 1, concepts: { MD1: { attempts: 2, correct: 1, laxErrors: 1, strictErrors: 0, dropped: 0, partial: 0, variantsSeen: ['MD1a'], clean: [], mastered: false } }, runs: [], sideWeights: { doors: 1.2 } } };
  const m = { [BP.KEY]: JSON.stringify(old) }, storage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage }); assert.strictEqual(shared.data.kitchen, undefined, 'no slot yet');
  const a = KP.create({ shared }); assert.deepStrictEqual(a.data, KP.emptyData()); a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 1 }); a.onEvent(ans({}));
  const after = JSON.parse(m[BP.KEY]); for (const k of ['carrom', 'jenga', 'gallery', 'mill', 'concepts', 'runs', 'topicWeights']) assert.deepStrictEqual(after[k], old[k], k + ' is untouched'); assert.strictEqual(after.playerId, 'p-old'); assert.strictEqual(after.runCount, 3);
  assert.strictEqual(after.kitchen.runCount, 1); assert.strictEqual(after.kitchen.concepts.K2.attempts, 1); assert.strictEqual(after.v, 1, 'the data version stays 1');
  const again = BP.create({ storage }), b = KP.create({ shared: again }); assert.strictEqual(b.data.concepts.K2.attempts, 1, 'reloaded'); assert.deepStrictEqual(CP.bridgeTopicsMastered(again.data), { mastered: 0, total: 7 });
  assert.strictEqual(BP.create({ storage: { getItem: () => null, setItem() {} } }).data.kitchen, undefined, 'a brand-new player has no slot until Prompt Kitchen is played');
});
done();
