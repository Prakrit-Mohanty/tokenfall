// Self-test for the Token Tower rules: scoring, stars, the three-wrong collapse, tipping, the clock, and whole runs played against the engine. Run: node js/jenga-play-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const P = require('./jenga-play.js');
const E = require('./jenga-engine.js');
const G = require('./jenga-generator.js');
const BG = require('./bridge-generator.js');

const spec = G.composeRun(G.seedFor('rules', 0));
const wrongOf = (q) => q.options.filter((o) => !o.correct).map((o) => o.n);

test('points: 3 for the right block on the first pull of a question, 2 on the second, 1 on the third; stars follow the brief', () => {
  assert.deepStrictEqual([1, 2, 3, 4].map(P.pointsFor), [3, 2, 1, 1]);
  assert.deepStrictEqual([[7, 0], [7, 1], [7, 2], [6, 0], [4, 0], [3, 0]].map(([placed, wrong]) => P.starsFor(placed, 7, wrong)), [3, 3, 2, 1, 1, 0]);
});
test('nearestLegal: the closest legal position on the 0.05 grid, inside a run or at its end', () => {
  const legal = [[-2, -2], [1, 2]];
  assert.strictEqual(P.nearestLegal(legal, 1.43), 1.45); assert.strictEqual(P.nearestLegal(legal, 0), 1); assert.strictEqual(P.nearestLegal(legal, -0.9), -2); assert.strictEqual(P.nearestLegal(legal, 9), 2); assert.strictEqual(P.nearestLegal([], 0), null);
});
test('a perfect run: every question pulled right first time and placed is 3 stars and 21 points, and every answer is a first try', () => {
  const run = P.createRun(spec);
  for (let k = 0; k < 7; k++) { const q = run.q(), out = run.pull(q.correctN); assert.strictEqual(out.kind, 'right'); assert.strictEqual(out.points, 3); const r = run.place(false); assert.strictEqual(r.kind, k === 6 ? 'done' : 'next'); run.advance(); }
  const s = run.summary(); assert.strictEqual(s.stars, 3); assert.strictEqual(s.points, 21); assert.strictEqual(s.placed, 7); assert.strictEqual(s.why, 'done'); assert(!s.collapsed && s.answers.length === 7 && s.answers.every((a) => a.correct && a.firstTry));
});
test('a wrong pull is a Concept Card ("You pulled: ...", why it breaks, the idea), strikes that block out, and the question carries on for 2 points', () => {
  const run = P.createRun(spec), q = run.q(), n = wrongOf(q)[0], out = run.pull(n), o = q.options[n - 1];
  assert.deepStrictEqual([out.kind, out.level, out.collapse], ['wrong', 1, false]); assert.deepStrictEqual(out.card, { lead: 'You pulled:', text: o.text, breaks: o.breaks, idea: q.idea });
  assert.strictEqual(run.pull(n), null, 'a struck block cannot be pulled again'); assert.strictEqual(run.wrong, 1);
  const r = run.pull(q.correctN); assert.deepStrictEqual([r.kind, r.points, r.tries], ['right', 2, 2]);
  assert.strictEqual(run.pull(q.correctN), null, 'a solved question is closed');
  const a = run.answers; assert.deepStrictEqual(a.map((x) => [x.correct, x.firstTry]), [[false, false], [true, false]]); assert.strictEqual(a[0].wrongId, o.id);
});
test('the THIRD wrong try of the run collapses the tower, whichever questions they fall in; with one wrong try you can still get 3 stars, with two only 2', () => {
  for (let i = 0; i < 100; i++) {
    const sp = G.composeRun(G.seedFor('w' + i, 0)), run = P.createRun(sp); let level = 0, last = null;
    for (let k = 0; k < 3; k++) { const q = run.q(), n = wrongOf(q)[k % 3]; last = run.pull(n); level++; assert.strictEqual(last.level, level); if (k < 2) { assert(!last.collapse && !run.over); run.pull(q.correctN); run.place(false); run.advance(); } }
    assert(last.collapse && run.over === 'wrongs'); const s = run.summary(); assert(s.collapsed && !s.tipped && s.why === 'wrongs'); assert.strictEqual(run.pull(run.q().correctN), null, 'nothing more after the fall');
    assert.strictEqual(s.stars, 0); assert(s.placed === 2);
  }
  const play = (wrong) => { const run = P.createRun(spec); for (let k = 0; k < 7; k++) { const q = run.q(); if (k < wrong) run.pull(wrongOf(q)[0]); run.pull(q.correctN); run.place(false); run.advance(); } return run.stars(); };
  assert.deepStrictEqual([play(0), play(1), play(2)], [3, 3, 2]);
});
test('a stack that tips ends the run: the correct answer stays credited but is flagged toppled; stars come from what was placed (4 or more is one star)', () => {
  const run = P.createRun(spec);
  for (let k = 0; k < 4; k++) { run.pull(run.q().correctN); run.place(false); run.advance(); }
  run.pull(run.q().correctN); const r = run.place(true); assert.strictEqual(r.kind, 'tipped');
  const s = run.summary(); assert(s.tipped && s.collapsed && s.why === 'tipped' && s.placed === 4 && s.stars === 1); assert(s.answers[4].correct && s.answers[4].toppled);
  const early = P.createRun(spec); early.pull(early.q().correctN); early.place(true); assert.strictEqual(early.stars(), 0, 'fewer than 4 placed on a collapse is 0 stars');
});
test('the clock: runs from the first question only, ends the run at zero, and every unsolved question is flagged for spaced retrieval', () => {
  const run = P.createRun(spec); run.tick(100); assert.strictEqual(run.clock, 300, 'not started yet'); run.start();
  for (let k = 0; k < 3; k++) { run.pull(run.q().correctN); run.place(false); run.advance(); }
  run.tick(299); assert(!run.over); run.tick(2); assert.strictEqual(run.over, 'timeout'); assert.strictEqual(run.clock, 0);
  run.giveUp(); const s = run.summary(); assert.strictEqual(s.placed, 3); assert.strictEqual(s.stars, 0);
  assert.deepStrictEqual(s.flagged, spec.questions.slice(3).map((q) => q.conceptId)); assert.strictEqual(s.answers.filter((a) => a.timedOut).length, 4);
  const late = P.createRun(spec); late.start(); for (let k = 0; k < 4; k++) { late.pull(late.q().correctN); late.place(false); late.advance(); } late.tick(400); late.giveUp(); assert.strictEqual(late.stars(), 1, 'the clock ending with 4 placed is still one star');
});

// ---- whole runs against the real engine: nothing the rules promise depends on luck ----
function playOut(sp, policy, rng) {
  const run = P.createRun(sp); let T = JSON.parse(JSON.stringify(sp.start.tower));
  for (;;) {
    const q = G.resolveQuestion(T, run.q()); assert(q, 'no pullable set'); const out = run.pull(q.correctN); assert.strictEqual(out.kind, 'right');
    const o = q.options[q.correctN - 1], block = { id: o.blockId, answerText: o.text }, pulled = E.applyPull(T, block.id), R = E.placementRange(pulled, block); assert(R.ranges.length && R.free >= 0.2, 'a correct pull is always placeable');
    let u;
    if (policy === 'reckless') u = R.layer === E.slotsAt(pulled, R.layer).layer ? E.slotsAt(pulled, R.layer).legal.filter((x) => Math.abs(x) > 1.5)[0] : 0;
    else if (policy === 'rand') { const us = R.ranges.flatMap(([a, b]) => { const r = []; for (let x = a; x <= b + 1e-9; x = E.snap(x + E.STEP)) r.push(x); return r; }); u = us[(rng() * us.length) | 0]; } else u = E.choosePlacement(R, policy);
    const res = E.applyPlace(pulled, block, u, R.layer), m = E.stability(res.tower).minMargin, step = run.place(m < 0);
    if (m < 0) assert(policy === 'reckless', 'a stable placement tipped the tower');
    T = res.tower; if (step.kind !== 'next') return run; run.advance();
  }
}
test('played out against the engine: a steady player (middle, low end, high end, random) always finishes with 7 placed and 3 stars; a block set past the edge always tips', () => {
  for (let i = 0; i < 120; i++) {
    const sp = G.composeRun(G.seedFor('p' + i, 0));
    for (const pol of ['mid', 'lo', 'hi', 'rand']) { const run = playOut(sp, pol, BG.mulberry32(i + 1)); assert.strictEqual(run.over, 'done'); assert.strictEqual(run.placed, 7); assert.strictEqual(run.stars(), 3); assert.strictEqual(run.points(), 21); }
    const run = playOut(sp, 'reckless'); assert.strictEqual(run.over, 'tipped'); assert(run.summary().collapsed && run.placed === 0, 'tipped on the very first block');
  }
});
done();
