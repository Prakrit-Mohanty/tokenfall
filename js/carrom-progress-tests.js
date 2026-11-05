// Self-test for carrom progress: mastery, the shared store, the combined export, and migration of saves made before carrom existed. Run: node js/carrom-progress-tests.js
const assert = require('assert');
const CP = require('./carrom-progress.js');
const BP = require('./bridge-progress.js');
const BC = require('./bridge-content.js');
const C = require('./carrom-content.js');
const G = require('./carrom-generator.js');
const P = require('./carrom-physics.js');
const Play = require('./carrom-play.js');

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const memStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, raw: m }; };

// play a whole run with the real engine and physics, feeding the adapter exactly the events carrom-play.js emits
function playRun(adapter, { perfect = true, abandonAfter = null, wrongFirst = false } = {}) {
  const r = adapter.newRun(), spec = G.composeRun(G.seedFor(r.playerId, r.runIndex), r.history), run = Play.createRun(spec);
  adapter.onEvent({ type: 'run', runIndex: r.runIndex, seed: spec.seed, seen: spec.seen.slice() });
  const flush = (R, credit) => { for (const a of R.answers.slice(R.sent || 0)) adapter.onEvent(Object.assign({ type: 'answer', credit }, a)); R.sent = R.answers.length; };
  const sink = (tg, corner) => ({ pocket: G.shotResult(tg.start, G.ghostFor(tg.start, corner)).pocket });
  for (let i = 0; i < spec.rounds.length; i++) {
    const R = run.round();
    if (abandonAfter === i) {   // answer one thing, then leave mid-round
      const tg = R.target(); R.judge(sink(tg, tg.correct.corner)); flush(R, false);
      adapter.onEvent({ type: 'abandon', seen: spec.seen.slice(), points: run.total() }); return { run, spec, abandoned: true };
    }
    while (!R.done) {
      const q = R.q(), tg = R.target();
      if (wrongFirst && R.strikes === 0 && q.kind === 'pick') R.judge(sink(tg, q.options.find((o) => o.id !== tg.correct.id).corner));
      if (R.over) { R.giveUp(); break; }
      assert.strictEqual(R.judge(sink(R.target(), R.target().correct.corner)).kind, 'right');
    }
    flush(R, true); R.done = true; run.advance();
  }
  const sum = run.summary(); sum.seconds = 200; sum.tokens = Math.round(sum.points * 20) + 25 * (sum.stars - 1);
  adapter.onEvent(Object.assign({ type: 'finish' }, sum));
  return { run, spec, sum };
}

test('mastery: a first-try right answer in two different variants on two different runs; the same variant twice, or an uncredited one, is not enough', () => {
  const d = CP.emptyData(), cur = { runIndex: 0, run: null }, ans = (v, extra) => Object.assign({ type: 'answer', credit: true, conceptId: 'CW1', variantId: v, correct: true, firstTry: true, shots: 1 }, extra);
  CP.applyEvent(d, { type: 'run', runIndex: 0, seed: 1, seen: [] }, cur); CP.applyEvent(d, ans('CW1a'), cur); CP.applyEvent(d, { type: 'finish', stars: 3, points: 15, strikes: 0, tokens: 1, seconds: 1 }, cur);
  CP.applyEvent(d, { type: 'run', runIndex: 1, seed: 2, seen: [] }, cur); CP.applyEvent(d, ans('CW1a'), cur); assert(!d.concepts.CW1.mastered, 'the same variant on another run is not enough');
  CP.applyEvent(d, ans('CW1b', { credit: false }), cur); assert(!d.concepts.CW1.mastered); assert.strictEqual(d.concepts.CW1.partial, 1, 'kept as a partial attempt'); assert.strictEqual(d.concepts.CW1.attempts, 2);
  CP.applyEvent(d, ans('CW1b'), cur); assert(d.concepts.CW1.mastered, 'CW1a first-try on run 0 and CW1b first-try on run 1: two variants on two runs');
  CP.applyEvent(d, { type: 'finish', stars: 3, points: 15, strikes: 0, tokens: 1, seconds: 1 }, cur);
  CP.applyEvent(d, { type: 'run', runIndex: 2, seed: 3, seen: [] }, cur); CP.applyEvent(d, ans('CW3a', { conceptId: 'CW3' }), cur); CP.applyEvent(d, ans('CW3b', { conceptId: 'CW3' }), cur);
  assert(!d.concepts.CW3.mastered, 'two different variants on the SAME run is not enough');
  const w = { type: 'answer', credit: true, conceptId: 'CW2', variantId: 'CW2a', correct: false, firstTry: false, wrongId: 'CW2a.w1', shots: 1 }; CP.applyEvent(d, w, cur); CP.applyEvent(d, w, cur);
  assert.strictEqual(d.concepts.CW2.strikes, 2); assert.deepStrictEqual(d.concepts.CW2.wrong, { 'CW2a.w1': 2 }); assert(!d.concepts.CW2.mastered);
});

test('four sides, with the finale feeding the bias and accountability bars; perfect play masters everything', () => {
  const stats = CP.sideStats(CP.emptyData()); assert.deepStrictEqual(stats.map((s) => s.id), ['works', 'limits', 'bias', 'owns']); assert.deepStrictEqual(stats.map((s) => s.total), [5, 1, 6, 5]);
  const a = CP.create(), runs = 30; let mastered = null;
  for (let i = 0; i < runs; i++) { playRun(a); if (mastered === null && Object.values(a.data.concepts).filter((c) => c.mastered).length === C.CARDS.length) mastered = i + 1; }
  console.log(`   every one of the ${C.CARDS.length} concepts mastered after ${mastered} perfect runs (one concept per side per run, two sightings each: 10 is the floor for the five-concept sides)`); assert(mastered !== null && mastered >= 10 && mastered <= 25);
  assert(CP.sideStats(a.data).every((s) => s.mastery === 1 && s.mastered === s.total)); assert(Object.values(a.data.sideWeights).every((w) => w === 0.5));
});

test('weights follow play: a player who keeps missing one side sees it more, and the generator accepts the history', () => {
  const a = CP.create(); playRun(a); playRun(a, { wrongFirst: true });
  const h = CP.historyFor(a.data), g = G.composeRun(G.seedFor('x', 0), h); assert.strictEqual(g.rounds.length, 5);
  assert(Object.values(h.concepts).some((c) => c.falls > 0), 'strikes are the falls the generator weighs');
  const rev = CP.revisitList(a.data); assert(rev.length > 0 && rev.every((r) => r.idea && r.title && r.sideName)); assert(rev[0].strikes >= rev[rev.length - 1].strikes, 'the most struck concepts first');
});

test('leaving mid-round: the answer is kept as a partial attempt, nothing is mastered, the run is recorded as unfinished', () => {
  const a = CP.create(), out = playRun(a, { abandonAfter: 1 }); assert(out.abandoned);
  const last = a.data.runs[a.data.runs.length - 1]; assert.strictEqual(last.finished, false);
  assert(Object.values(a.data.concepts).some((c) => c.partial > 0)); assert(Object.values(a.data.concepts).every((c) => c.partial === 0 || c.attempts >= c.partial - 1));
  const partialConcept = Object.values(a.data.concepts).find((c) => c.partial > 0); assert(!partialConcept.mastered); assert.strictEqual(partialConcept.firstTry.length, 0);
});

test('one store, one export: carrom lives in a slot of the bridge\'s saved data and the export carries both games under named sections', () => {
  const st = memStorage(), shared = BP.create({ storage: st, fixed: { playerId: 'amy' } }), a = CP.create({ shared });
  const before = shared.exportJSON(); assert.strictEqual(before.schema, 1, 'no section yet: the export is exactly what it always was'); assert(!('carrom' in before));
  a.attach({ leave() {} }, { talk() {}, sys() {} });
  playRun(a); playRun(a);
  const exp = shared.exportJSON();
  assert.strictEqual(exp.schema, 2); assert.deepStrictEqual(exp.games, ['bridge', 'carrom']);
  assert.strictEqual(exp.game, 'Uplink · The Glass Bridge', 'the bridge fields are where they were'); assert(Array.isArray(exp.topics) && Array.isArray(exp.concepts));
  assert.strictEqual(exp.carrom.game, 'Uplink · House Rules Carrom'); assert.strictEqual(exp.carrom.sides.length, 4); assert.strictEqual(exp.carrom.concepts.length, C.CARDS.length); assert.strictEqual(exp.carrom.summary.runsFinished, 2);
  assert(exp.carrom.runs.every((r) => typeof r.stars === 'number'));
  JSON.parse(JSON.stringify(exp));
  const saved = JSON.parse(st.raw[BP.KEY + ':amy']); assert.strictEqual(saved.v, 1); assert(saved.carrom && saved.carrom.runs.length === 2, 'saved in the same blob, at the same version');
  assert.strictEqual(a.data.runCount, 2); assert.strictEqual(shared.data.runCount, 0, 'carrom never touches the bridge\'s run counter');
});

test('migration: a save made before carrom existed loads untouched, gains carrom only when played, and no bridge progress is lost either way', () => {
  // an old save written by the bridge alone: play bridge-style events into it, snapshot the raw JSON
  const st = memStorage(), old = BP.create({ storage: st, fixed: { playerId: 'raj' } });
  for (let i = 0; i < 3; i++) {
    const r = old.newRun(); old.onEvent({ type: 'run', runIndex: r.runIndex, seed: 1, seen: ['T1a'] });
    old.onEvent({ type: 'answer', conceptId: 'T1', variantId: 'T1' + 'abc'[i], correct: true, firstTry: true, ms: 1000 }); old.onEvent({ type: 'finish', stars: 3, falls: 0, scans: 0, tokens: 100, bestStreak: 5, seconds: 100, seen: ['T1a'] });
  }
  const rawOld = st.raw[BP.KEY + ':raj']; const oldBlob = JSON.parse(rawOld); assert(!('carrom' in oldBlob), 'a save from before carrom has no carrom slot');
  // a fresh page load with carrom installed
  const reloaded = BP.create({ storage: st, fixed: { playerId: 'raj' } }), a = CP.create({ shared: reloaded });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(reloaded.data)), oldBlob, 'loading changes nothing');
  assert.strictEqual(reloaded.exportJSON().schema, 1, 'and without carrom the export is the old one');
  const bridgeConcepts = JSON.stringify(reloaded.data.concepts), bridgeRuns = JSON.stringify(reloaded.data.runs), bridgeCount = reloaded.data.runCount;
  playRun(a); playRun(a);
  const after = JSON.parse(st.raw[BP.KEY + ':raj']);
  assert.strictEqual(JSON.stringify(after.concepts), bridgeConcepts, 'bridge concepts identical after carrom was played'); assert.strictEqual(JSON.stringify(after.runs), bridgeRuns); assert.strictEqual(after.runCount, bridgeCount);
  assert(after.carrom && after.carrom.runCount === 2);
  // and the other direction: bridge play after carrom does not disturb carrom
  const carromBlob = JSON.stringify(after.carrom), again = BP.create({ storage: st, fixed: { playerId: 'raj' } }); const r = again.newRun(); again.onEvent({ type: 'run', runIndex: r.runIndex, seed: 2, seen: [] }); again.onEvent({ type: 'finish', stars: 2, falls: 1, scans: 0, tokens: 10, bestStreak: 1, seconds: 10, seen: [] });
  assert.strictEqual(JSON.stringify(JSON.parse(st.raw[BP.KEY + ':raj']).carrom), carromBlob, 'the carrom slot survives a bridge run');
});

test('"Bridge mastery: x of 7 topics" counts topics whose every concept is mastered', () => {
  assert.deepStrictEqual(CP.bridgeTopicsMastered({ concepts: {} }), { mastered: 0, total: 7 });
  const concepts = {}; for (const c of BC.CARDS) if (c.topic === 'tokens' || c.topic === 'safety') concepts[c.id] = { mastered: true };
  assert.deepStrictEqual(CP.bridgeTopicsMastered({ concepts }), { mastered: 2, total: 7 });
  const half = {}; for (const c of BC.CARDS.filter((x) => x.topic === 'models')) half[c.id] = { mastered: c.id === 'M1' }; assert.strictEqual(CP.bridgeTopicsMastered({ concepts: half }).mastered, 0, 'models has M1, M2 and the boss: all must be mastered');
  assert.strictEqual(CP.bridgeTopicsMastered(null).mastered, 0);
});

test('the carrom export section is self-describing: sides, concepts with their ideas, runs, weights; no personal data beyond the player id', () => {
  const a = CP.create(); playRun(a); const s = a.exportSection();
  assert.deepStrictEqual(Object.keys(s), ['game', 'schema', 'exportedAt', 'summary', 'mastery', 'sides', 'concepts', 'runs', 'sideWeights']);
  assert(s.concepts.every((c) => c.idea && c.title && ['works', 'limits', 'bias', 'owns'].includes(c.side))); assert(s.summary.tokensBanked > 0 && s.summary.bestStars === 3);
  assert(s.concepts.filter((c) => c.attempts > 0).length >= 5);
});

console.log(`\n${checks} checks passed`);
