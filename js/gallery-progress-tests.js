// Self-test for Spot Shot progress: mastery, partial credit, the history the generator reads, the shared store, the export section and the migration. Run: node js/gallery-progress-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const GP = require('./gallery-progress.js');
const E = require('./gallery-engine.js');
const P = require('./gallery-play.js');
const BP = require('./bridge-progress.js');
const CP = require('./carrom-progress.js');
const C = require('./gallery-content.js');
const BG = require('./bridge-generator.js');

const ans = (o) => Object.assign({ type: 'answer', credit: true, conceptId: 'XC1', variantId: 'XC1a', correct: true, lucky: false, inspected: false, kind: 'clear' }, o);
const fin = (clean, o) => Object.assign({ type: 'finish', stars: 2, catchRate: 0.9, accuracy: 0.9, leaks: 1, friendly: 1, trapsInspected: 2, lucky: 3, timeMs: 270000, clean }, o);
const fresh = () => ({ d: GP.emptyData(), cur: { runIndex: 0, run: null } });
const feed = (st, events) => events.forEach((e) => GP.applyEvent(st.d, e, st.cur));

test('mastery: clean handling in two DIFFERENT variants on two DIFFERENT runs masters a concept; the same variant twice, or both in one run, does not', () => {
  const a = fresh(); feed(a, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), fin({ XC1: ['XC1a'] }), { type: 'run', runIndex: 1, seed: 2 }, ans({ variantId: 'XC1c' }), fin({ XC1: ['XC1c'] })]);
  assert(a.d.concepts.XC1.mastered);
  const same = fresh(); feed(same, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ XC1: ['XC1a'] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ XC1: ['XC1a'] })]); assert(!same.d.concepts.XC1.mastered, 'same variant twice');
  const one = fresh(); feed(one, [{ type: 'run', runIndex: 0, seed: 1 }, fin({ XC1: ['XC1a', 'XC1c'] })]); assert(!one.d.concepts.XC1.mastered, 'both in one run');
  const none = fresh(); feed(none, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ lucky: true, kind: 'trap' }), fin({ XC1: [] }), { type: 'run', runIndex: 1, seed: 2 }, fin({ XC1: [] })]); assert(!none.d.concepts.XC1.mastered, 'a lucky shot is never clean');
  const ab = fresh(); feed(ab, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ credit: false }), { type: 'abandon', timeMs: 1000 }, { type: 'run', runIndex: 1, seed: 2 }, ans({ credit: false, variantId: 'XC1c' }), { type: 'abandon', timeMs: 1000 }]); assert(!ab.d.concepts.XC1.mastered, 'an unfinished run masters nothing');
});
test('counts: right and wrong calls, lucky shots and verified traps; a card from a round left with Esc is a partial attempt, never an attempt or a miss', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), ans({ correct: false }), ans({ kind: 'trap', lucky: true }), ans({ kind: 'trap', inspected: true }), ans({ credit: false, variantId: 'XC1c' }), ans({ conceptId: 'XW2', variantId: 'XW2a', correct: false })]);
  const c = s.d.concepts; assert.deepStrictEqual([c.XC1.attempts, c.XC1.correctHandled, c.XC1.wrong, c.XC1.luckyShots, c.XC1.inspectedCorrect, c.XC1.partial], [4, 3, 1, 1, 1, 1]);
  assert.deepStrictEqual(c.XC1.variantsSeen, ['XC1a', 'XC1c']); assert.deepStrictEqual([c.XW2.attempts, c.XW2.wrong], [1, 1]);
  feed(s, [ans({ conceptId: 'NOPE' })]); assert(!s.d.concepts.NOPE, 'a concept this game does not have is ignored');
});
test('runs are recorded ({ seed, stars, catchRate, accuracy, leaks, friendly, timeMs }), the history keeps 30, and the generator reads the cards shown, the misses and the mastery', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 77 }, { type: 'round', items: ['XC1a.1', 'XC1a.2'] }, { type: 'round', items: ['XC1a.2', 'XW1a.1'] }, ans({ correct: false }), fin({}, { stars: 3 })]);
  assert.deepStrictEqual(s.d.runs[0], { runIndex: 0, seed: 77, finished: true, stars: 3, catchRate: 0.9, accuracy: 0.9, leaks: 1, friendly: 1, trapsInspected: 2, lucky: 3, timeMs: 270000, items: ['XC1a.1', 'XC1a.2', 'XW1a.1'] });
  const h = GP.historyFor(s.d); assert.deepStrictEqual(h.runs, [{ items: ['XC1a.1', 'XC1a.2', 'XW1a.1'] }]); assert.deepStrictEqual(h.concepts.XC1, { attempts: 1, misses: 1, mastered: false });
  const spec = E.composeRun(7, h); assert(spec.rounds.flatMap((r) => r.items).every((i) => !['XC1a.1', 'XC1a.2', 'XW1a.1'].includes(i.itemId)), 'the generator avoids the last run\'s cards');
  const many = fresh(); for (let i = 0; i < 40; i++) feed(many, [{ type: 'run', runIndex: i, seed: i }]); assert.strictEqual(many.d.runs.length, 30);
  const half = fresh(); feed(half, [{ type: 'run', runIndex: 0, seed: 1 }, { type: 'round', items: ['XC2a.1'] }, { type: 'abandon', timeMs: 5, leaks: 2, friendly: 1 }]); assert.deepStrictEqual(half.d.runs[0].items, ['XC2a.1'], 'a run left early still records what it showed'); assert.strictEqual(half.d.runs[0].finished, false);
});
test('side bars: the four sides in the amber / green / cyan / rose slots; a side never met gets a neutral weight, a mastered one a low one, a missed one a high one', () => {
  const st = GP.sideStats(GP.emptyData()); assert.deepStrictEqual(st.map((x) => x.id), ['claims', 'asking', 'poison', 'labels']); assert.deepStrictEqual(st.map((x) => x.total), [4, 4, 4, 4]);
  assert.deepStrictEqual(Object.values(GP.SIDE_STYLE).map((x) => x.name), ['amber', 'green', 'cyan', 'rose']);
  assert.deepStrictEqual(GP.sideWeights(GP.emptyData()), { claims: 1.5, asking: 1.5, poison: 1.5, labels: 1.5 });
  const all = fresh(); feed(all, [{ type: 'run', runIndex: 0, seed: 1 }]); const cs = C.CONCEPTS.filter((c) => c.side === 'poison');
  cs.forEach((c) => feed(all, [ans({ conceptId: c.id, variantId: c.variants[0].id })])); feed(all, [fin(Object.fromEntries(cs.map((c) => [c.id, [c.variants[0].id]]))), { type: 'run', runIndex: 1, seed: 2 }, fin(Object.fromEntries(cs.map((c) => [c.id, [c.variants[1].id]])))]);
  assert.strictEqual(GP.sideStats(all.d)[2].mastery, 1); assert.strictEqual(GP.sideWeights(all.d).poison, 0.5, 'every concept of the side mastered: dealt least');
  const miss = fresh(); feed(miss, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ correct: false })]); assert.strictEqual(GP.sideWeights(miss.d).claims, 2.5);
  assert(E.composeRun(1, GP.historyFor(all.d)), 'the history shape is accepted by the generator');
});
test('revisit list: missed and guessed concepts first, each with its one-line idea; mastered concepts never appear', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'XW4', variantId: 'XW4a', correct: false }), ans({ conceptId: 'XW4', variantId: 'XW4a', correct: false }), ans({ conceptId: 'XP2', variantId: 'XP2a', lucky: true, kind: 'trap' }), ans({ conceptId: 'XC3', variantId: 'XC3a', correct: false }), ans({ conceptId: 'XD1', variantId: 'XD1a' })]);
  const r = GP.revisitList(s.d); assert.deepStrictEqual(r.map((x) => x.id), ['XW4', 'XC3', 'XP2']); assert(r[0].idea === C.byId.XW4.idea && /2 misses/.test(r[0].note) && /1 lucky guess\b/.test(r[2].note));
  s.d.concepts.XW4.mastered = true; assert(!GP.revisitList(s.d).some((x) => x.id === 'XW4'));
});
test('a whole run played through the rules feeds the adapter: stats, clean variants, the export and the history all follow', () => {
  const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  const shared = BP.create({ storage: mem }), a = GP.create({ shared }); a.attach({ debrief: null, tradeoff: P.tradeoff }, { sys() {}, talk() {} });
  function playOne(seed) {
    const r = a.newRun(), spec = E.composeRun(E.seedFor(r.playerId, r.runIndex), r.history), run = P.createRun(spec);
    a.onEvent({ type: 'run', runIndex: r.runIndex, seed: spec.seed });
    spec.rounds.forEach((rd, i) => {
      run.begin(i); a.onEvent({ type: 'round', index: i, items: rd.items.map((c) => c.itemId) });
      for (const it of rd.items) { if (it.kind === 'trap' && run.charges > 0) run.inspect(it.uid, 1); if (it.shoot) run.shoot(it.uid, 2); else run.pass(it.uid, 3); }
      for (const e of run.finishRound(9).entries) a.onEvent({ type: 'answer', credit: true, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, shoot: e.shoot, action: e.action, correct: e.correct, lucky: e.lucky, inspected: e.inspected });
    });
    const sum = run.score(true); a.onEvent(Object.assign({ type: 'finish', timeMs: 270000, clean: Object.fromEntries(Object.entries(sum.perConcept).map(([id, c]) => [id, c.cleanVariants])) }, sum)); return sum;
  }
  const s1 = playOne(), s2 = playOne(), d = a.data;
  assert.strictEqual(d.runCount, 2); assert.strictEqual(d.runs.length, 2); assert(d.runs.every((r) => r.finished && r.items.length >= 50));
  assert(Object.values(d.concepts).reduce((n, c) => n + c.attempts, 0) === 2 * 52); assert(s1.catchRate === 1 && s1.accuracy === 1);
  assert(d.runs[1].items.every((i) => !d.runs[0].items.includes(i)), 'run 2 shares no card with run 1');
  const exp = shared.exportJSON(); assert.strictEqual(exp.schema, 2); assert(exp.games.includes('gallery')); assert.strictEqual(exp.gallery.game, 'Uplink · Spot Shot'); assert.strictEqual(exp.gallery.summary.runsFinished, 2); assert.strictEqual(exp.gallery.concepts.length, 16);
  assert.strictEqual(exp.gallery.summary.verifiedTraps + 0, Object.values(d.concepts).reduce((n, c) => n + c.inspectedCorrect, 0)); assert(exp.concepts, 'the bridge\'s own fields stay where they were'); assert(exp.gallery.runs[0].catchRate === 1);
});
test('the shared store: one export for every game, with a clearly named "gallery" section beside the other games', () => {
  const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  const shared = BP.create({ storage: mem }); CP.create({ shared }).attach({ debrief: null }, { sys() {} }); const a = GP.create({ shared }); a.attach({}, {});   // the carrom adapter adds its own section first
  a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 5 }); a.onEvent(ans({})); a.onEvent(fin({ XC1: ['XC1a'] }));
  const exp = shared.exportJSON(); assert(exp.games.includes('gallery') && exp.games.includes('carrom')); assert.strictEqual(exp.gallery.summary.runsStarted, 1); assert.strictEqual(exp.gallery.concepts.find((c) => c.id === 'XC1').attempts, 1);
  assert.deepStrictEqual(Object.keys(exp.gallery).sort(), ['concepts', 'exportedAt', 'game', 'mastery', 'runs', 'schema', 'sideWeights', 'sides', 'summary']);
});
test('migration: a save from before Spot Shot (the bridge, carrom and the tower) loads untouched, gains an empty "gallery" slot, and nothing else moves', () => {
  const old = { v: 1, playerId: 'p-old', runCount: 3, concepts: { T1: { attempts: 4, firstTryCorrect: 3, falls: 1, variantsSeen: ['T1a'], firstTry: [{ v: 'T1a', r: 0 }], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} } }, runs: [{ runIndex: 0, seed: 9 }], topicWeights: {},
    carrom: { v: 1, runCount: 2, concepts: { CW1: { attempts: 2, firstTryCorrect: 2, strikes: 0, partial: 0, variantsSeen: ['CW1a'], firstTry: [{ v: 'CW1a', r: 0 }], shots: [1, 1], mastered: false, wrong: {} } }, runs: [], sideWeights: { works: 1.1 } },
    jenga: { v: 1, runCount: 1, concepts: { JA1: { attempts: 1, firstTryCorrect: 1, wrongTries: 0, timedOut: 0, partial: 0, toppled: 0, variantsSeen: ['JA1a'], firstTry: [{ v: 'JA1a', r: 0 }], wrong: {}, mastered: false } }, runs: [], sideWeights: {} } };
  const m = { [BP.KEY]: JSON.stringify(old) }, mem = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage: mem }); assert.strictEqual(shared.data.gallery, undefined, 'no slot yet');
  const a = GP.create({ shared }); assert.deepStrictEqual(a.data, GP.emptyData()); a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 1 }); a.onEvent(ans({}));
  const after = JSON.parse(m[BP.KEY]); for (const k of ['carrom', 'jenga', 'concepts', 'runs', 'topicWeights']) assert.deepStrictEqual(after[k], old[k], k + ' is untouched'); assert.strictEqual(after.playerId, 'p-old'); assert.strictEqual(after.runCount, 3);
  assert.strictEqual(after.gallery.runCount, 1); assert.strictEqual(after.gallery.concepts.XC1.attempts, 1); assert.strictEqual(after.v, 1, 'the data version stays 1');
  const again = BP.create({ storage: mem }), b = GP.create({ shared: again }); assert.strictEqual(b.data.concepts.XC1.attempts, 1, 'reloaded');
  assert.deepStrictEqual(CP.bridgeTopicsMastered(again.data), { mastered: 0, total: 7 }, 'the "Bridge mastery x of 7 topics" line reads the same store');
  const none = { getItem: () => null, setItem() {} }; assert.strictEqual(BP.create({ storage: none }).data.gallery, undefined, 'a brand-new player has no slot until Spot Shot is played');
});
done();
