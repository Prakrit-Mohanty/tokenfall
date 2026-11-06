// Self-test for Token Tower progress: mastery, partial credit, the history the generator reads, the shared store, the export section and the migration. Run: node js/jenga-progress-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const JP = require('./jenga-progress.js');
const G = require('./jenga-generator.js');
const BP = require('./bridge-progress.js');
const CP = require('./carrom-progress.js');
const C = require('./jenga-content.js');

const ans = (o) => Object.assign({ type: 'answer', credit: true, conceptId: 'JA1', variantId: 'JA1a', correct: true, firstTry: true }, o);
const fresh = () => ({ d: JP.emptyData(), cur: { runIndex: 0, run: null } });
const feed = (st, events) => events.forEach((e) => JP.applyEvent(st.d, e, st.cur));

test('a first-try correct pull in two DIFFERENT variants on two DIFFERENT runs masters a concept; a repeat of one variant, or both in one run, does not', () => {
  const a = fresh(); feed(a, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), { type: 'finish', stars: 3, placed: 7 }, { type: 'run', runIndex: 1, seed: 2 }, ans({ variantId: 'JA1c' })]);
  assert(a.d.concepts.JA1.mastered);
  const same = fresh(); feed(same, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), { type: 'run', runIndex: 1, seed: 2 }, ans({})]); assert(!same.d.concepts.JA1.mastered, 'same variant twice');
  const one = fresh(); feed(one, [{ type: 'run', runIndex: 0, seed: 1 }, ans({}), ans({ variantId: 'JA1c' })]); assert(!one.d.concepts.JA1.mastered, 'both in one run');
  const miss = fresh(); feed(miss, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ firstTry: false }), { type: 'run', runIndex: 1, seed: 2 }, ans({ variantId: 'JA1c', firstTry: false })]); assert(!miss.d.concepts.JA1.mastered, 'right, but not on the first pull');
});
test('counts: a wrong pull is a wrong try, not an attempt; a right answer is an attempt; a timed-out question is an attempt and a miss; Esc keeps a partial attempt and never masters', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ correct: false, firstTry: false, wrongId: 'JA1a.w2' }), ans({ firstTry: false }), ans({ conceptId: 'JA2', variantId: 'JA2a', correct: false, firstTry: false, timedOut: true })]);
  const c = s.d.concepts; assert.deepStrictEqual([c.JA1.attempts, c.JA1.wrongTries, c.JA1.firstTryCorrect, c.JA1.wrong['JA1a.w2']], [1, 1, 0, 1]); assert.deepStrictEqual([c.JA2.attempts, c.JA2.timedOut, c.JA2.wrongTries], [1, 1, 0]);
  const p = fresh(); feed(p, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ credit: false }), { type: 'run', runIndex: 1, seed: 2 }, ans({ credit: false, variantId: 'JA1c' }), { type: 'abandon', placed: 1, seen: ['JA1a', 'JA1c'] }]);
  assert.deepStrictEqual([p.d.concepts.JA1.partial, p.d.concepts.JA1.attempts, p.d.concepts.JA1.mastered], [2, 0, false]); assert.strictEqual(p.d.runs[1].finished, false);
});
test('runs are recorded: { seed, stars, placed, wrongTries, tipped, height, timeMs }; the history keeps 30 and hands the generator its variants, misses and mastery', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 77, seen: ['JA1a'] }, ans({ correct: false, firstTry: false, wrongId: 'x' }), { type: 'finish', stars: 2, placed: 7, wrongTries: 2, tipped: false, why: 'done', height: 23, points: 19, tokens: 310, timeMs: 201000, seen: ['JA1a', 'JG1b'] }]);
  assert.deepStrictEqual(s.d.runs[0], { runIndex: 0, seed: 77, finished: true, stars: 2, placed: 7, wrongTries: 2, tipped: false, why: 'done', height: 23, points: 19, tokens: 310, timeMs: 201000, variants: ['JA1a', 'JG1b'] });
  const h = JP.historyFor(s.d); assert.deepStrictEqual(h.runs, [{ variants: ['JA1a', 'JG1b'] }]); assert.deepStrictEqual(h.concepts.JA1, { attempts: 0, wrongTries: 1, mastered: false });
  const spec = G.composeRun(7, h); assert(spec.seen.every((v) => !['JA1a', 'JG1b'].includes(v)), 'the generator avoids the last run\'s variants');
  const many = fresh(); for (let i = 0; i < 40; i++) feed(many, [{ type: 'run', runIndex: i, seed: i }]); assert.strictEqual(many.d.runs.length, 30);
});
test('side bars: the four sides in the answer-slot colours; the finale feeds approach, proof and pilot; a side never met gets a neutral weight, a mastered one a low one', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'JF1', variantId: 'JF1a' }), { type: 'run', runIndex: 1, seed: 2 }, ans({ conceptId: 'JF1', variantId: 'JF1b' })]);
  const st = JP.sideStats(s.d); assert.deepStrictEqual(st.map((x) => x.id), ['approach', 'agents', 'proof', 'pilot']); assert(st[0].mastered === 1 && st[1].mastered === 0);
  const w = JP.sideWeights(s.d); assert.deepStrictEqual(w, { approach: 2.1, agents: 1.5, proof: 1.5, pilot: 1.5 }, 'one of five approach concepts mastered: 0.5 + 2 x 0.8');
  const all = fresh(); feed(all, [{ type: 'run', runIndex: 0, seed: 1 }]);
  const cards = C.CARDS.filter((c) => c.side === 'agents'); cards.forEach((c) => { feed(all, [ans({ conceptId: c.id, variantId: c.variants[0].id })]); });
  feed(all, [{ type: 'run', runIndex: 1, seed: 2 }]); cards.forEach((c) => { feed(all, [ans({ conceptId: c.id, variantId: c.variants[1].id })]); });
  assert.strictEqual(JP.sideWeights(all.d).agents, 0.5, 'a side with every concept mastered is dealt least'); assert.strictEqual(JP.sideStats(all.d)[1].mastery, 1);
  const colours = require('./carrom-world.js').STYLE.map((x) => x.css); assert.strictEqual(colours.length, 4);
});
test('revisit list: missed concepts first (wrong tries and timeouts), each with its one-line idea; mastered concepts never appear', () => {
  const s = fresh(); feed(s, [{ type: 'run', runIndex: 0, seed: 1 }, ans({ conceptId: 'JG2', variantId: 'JG2c', correct: false, firstTry: false, wrongId: 'a' }), ans({ conceptId: 'JG2', variantId: 'JG2c', correct: false, firstTry: false, wrongId: 'b' }), ans({ conceptId: 'JU1', variantId: 'JU1a', correct: false, firstTry: false, timedOut: true }), ans({ conceptId: 'JE1', variantId: 'JE1a' })]);
  const r = JP.revisitList(s.d); assert.deepStrictEqual(r.map((x) => x.id), ['JG2', 'JU1', 'JE1']); assert(r[0].idea === C.CARDS.find((c) => c.id === 'JG2').idea && /2 misses/.test(r[0].note));
});
test('the shared store: one export for every game, with a clearly named "jenga" section', () => {
  const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; })();
  const shared = BP.create({ storage: mem }), a = JP.create({ shared }); a.attach({ debrief: null }, { sys() {} });
  const r = a.newRun(); assert.strictEqual(r.runIndex, 0); a.onEvent({ type: 'run', runIndex: 0, seed: 5, seen: ['JA1a'] }); a.onEvent(ans({})); a.onEvent({ type: 'finish', stars: 3, placed: 7, wrongTries: 0, height: 23, points: 21, tokens: 365, timeMs: 180000, why: 'done' });
  const exp = shared.exportJSON(); assert.strictEqual(exp.schema, 2); assert(exp.games.includes('jenga')); assert.strictEqual(exp.jenga.game, 'Uplink · Token Tower'); assert.strictEqual(exp.jenga.summary.runsFinished, 1); assert.strictEqual(exp.jenga.summary.tallestTower, 23);
  assert.strictEqual(exp.jenga.concepts.length, 19); assert(exp.jenga.concepts.find((c) => c.id === 'JA1').firstTryCorrect === 1); assert(exp.concepts, 'the bridge\'s own fields stay where they were');
});
test('migration: a save from before Token Tower (the bridge\'s data and the carrom slot) loads untouched, gains an empty "jenga" slot, and nothing else moves', () => {
  const old = { v: 1, playerId: 'p-old', runCount: 3, concepts: { T1: { attempts: 4, firstTryCorrect: 3, falls: 1, variantsSeen: ['T1a'], firstTry: [{ v: 'T1a', r: 0 }], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} } }, runs: [{ runIndex: 0, seed: 9, finished: true, stars: 3, falls: 0, scansUsed: 0, tokens: 100, bestStreak: 5, seconds: 200, variants: ['T1a'] }], topicWeights: { tokens: 1.2 },
    carrom: { v: 1, runCount: 2, concepts: { CW1: { attempts: 2, firstTryCorrect: 2, strikes: 0, partial: 0, variantsSeen: ['CW1a'], firstTry: [{ v: 'CW1a', r: 0 }], shots: [1, 1], mastered: false, wrong: {} } }, runs: [], sideWeights: { works: 1.1 } } };
  const m = { [BP.KEY]: JSON.stringify(old) }, mem = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const shared = BP.create({ storage: mem }), before = JSON.stringify(shared.data); assert.strictEqual(shared.data.jenga, undefined, 'no slot yet');
  const a = JP.create({ shared }); assert.deepStrictEqual(a.data, JP.emptyData()); a.newRun(); a.onEvent({ type: 'run', runIndex: 0, seed: 1, seen: [] }); a.onEvent(ans({}));
  const after = JSON.parse(m[BP.KEY]); assert.deepStrictEqual(after.carrom, old.carrom); assert.deepStrictEqual(after.concepts, old.concepts); assert.deepStrictEqual(after.runs, old.runs); assert.strictEqual(after.playerId, 'p-old'); assert.deepStrictEqual(after.topicWeights, old.topicWeights);
  assert.strictEqual(after.jenga.runCount, 1); assert.strictEqual(after.jenga.concepts.JA1.attempts, 1); assert.strictEqual(after.v, 1, 'the data version stays 1');
  const again = BP.create({ storage: mem }), b = JP.create({ shared: again }); assert.strictEqual(b.data.concepts.JA1.attempts, 1, 'reloaded'); assert(before.indexOf('jenga') < 0);
  const bridgeSide = CP.bridgeTopicsMastered(again.data); assert.deepStrictEqual(bridgeSide, { mastered: 0, total: 7 });
});
done();
