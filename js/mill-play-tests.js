// Self-test for the Token Mill rules: routing, the ladder, the REVIEW EACH desk, the pit, the combo, the shift logs, the debrief card and the trade-off line. Run: node js/mill-play-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const P = require('./mill-play.js');
const E = require('./mill-engine.js');
const C = require('./mill-content.js');
const BG = require('./bridge-generator.js');
const { RUN, SIDES } = C;

const spec = E.composeRun(BG.hash32('rules'), null), sh = (i) => spec.shifts[i], inside = (sh_, e) => e.t0 + 3.2;   // a belt time when the crate is in the zone
const idx = (side, binId) => E.rankOf(side, binId);

test('routing: a crate may be routed only while it is in the zone and not yet settled; the plate position (1-4) and the crate\'s own side decide the bin; bad positions do nothing', () => {
  const run = P.createRun(spec); run.begin(0); const e = sh(0).schedule[0], c = sh(0).crates.find((x) => x.uid === e.uid);
  assert(!run.canRoute(e.uid, e.t0 - 0.1) && run.canRoute(e.uid, e.t0) && run.canRoute(e.uid, e.t0 + 6.99) && !run.canRoute(e.uid, e.t0 + 7), 'the zone is [t0, t0 + 7)'); assert(!run.canRoute('nope', e.t0 + 1));
  assert.strictEqual(run.route(e.uid, 4, 1, e.t0 + 1), null); assert.strictEqual(run.route(e.uid, -1, 1, e.t0 + 1), null); assert.strictEqual(run.route(e.uid, 0, 1, e.t0 - 1), null);
  const r = run.route(e.uid, c.rank, 5, inside(sh(0), e)); assert.deepStrictEqual([r.kind, r.entry.correct, r.entry.chosen, r.entry.action], ['routed', true, c.bin, 'routed']);
  assert.strictEqual(run.route(e.uid, 0, 6, e.t0 + 4), null, 'a settled crate cannot be routed again'); assert(!run.canRoute(e.uid, e.t0 + 4)); assert.strictEqual(run.pit(e.uid, 9), null);
});
test('the ladder through the rules: every (plate, crate) pair gives exactly E.judge\'s verdict; a spill is two bins or more too lax; too strict is never a spill', () => {
  let n = 0;
  for (const side of C.SIDE_IDS) for (let want = 0; want < 4; want++) {
    const i = spec.shifts.findIndex((s) => s.side === side), s = sh(i), c = s.crates.find((x) => x.rank === want) || spec.shifts.flatMap((x) => x.crates).find((x) => x.side === side && x.rank === want);
    for (let got = 0; got < 4; got++) {
      const run = P.createRun(spec); run.begin(i); const own = s.crates.find((x) => x.rank === want); if (!own) continue;
      const res = run.route(own.uid, got, 3, s.schedule.find((e) => e.uid === own.uid).t0 + 2), j = E.judge(own, SIDES[side].bins[got].id); n++;
      assert.deepStrictEqual([res.entry.correct, res.entry.direction, res.entry.severe, res.entry.rankGap, res.entry.stamp], [j.correct, j.direction, j.severe, j.rankGap, j.stamp]);
      assert.strictEqual(res.entry.severe, got - want <= -2);
    }
  }
  assert(n >= 40);
});
test('the REVIEW EACH desk: the 7th crate sent there in a shift is DESK JAMMED (too strict, over-gated, wrong even where REVIEW EACH was right); other bins are never jammed', () => {
  const i = spec.shifts.findIndex((s) => s.side === 'tiers'), s = sh(i), run = P.createRun(spec); run.begin(i); const out = [];
  s.schedule.slice(0, 9).forEach((e) => { const c = s.crates.find((x) => x.uid === e.uid), r = run.route(e.uid, 2, 1, e.t0 + 2); out.push(r ? [r.jammed, r.entry.stamp, r.entry.overGated || false, r.entry.correct, c.bin] : null); });
  assert.deepStrictEqual(out.slice(0, 9).map((x) => x && x[0]), [false, false, false, false, false, false, true, true, true]); assert(out.slice(6).every((x) => x[1] === 'DESK JAMMED' && x[2] === true && x[3] === false));
  assert(run.shift.reviewCount === 9); const run2 = P.createRun(spec); run2.begin(i); s.schedule.forEach((e) => { const r = run2.route(e.uid, 1, 1, e.t0 + 2); assert(!r.jammed); });
  const fin = spec.shifts[4]; assert.strictEqual(fin.desk, E.FINALE_DESK);
});
test('the pit: a crate that reaches the end of the zone unrouted (or held) is dropped; a dropped crate is wrong, breaks the combo and is never routed afterwards', () => {
  const run = P.createRun(spec); run.begin(2); const s = sh(2), e = s.schedule[0], r = run.pit(e.uid, 9);
  assert.deepStrictEqual([r.kind, r.entry.action, r.entry.direction, r.entry.correct, r.entry.stamp, r.entry.chosen], ['dropped', 'dropped', 'dropped', false, 'DROPPED', null]); assert.strictEqual(run.shift.combo, 0);
  assert.strictEqual(run.route(e.uid, 0, 9, e.t0 + 3), null); assert.strictEqual(run.pit(e.uid, 10), null);
});
test('combo: 4 right in a row ring the ribbon (every 4th); a wrong route, a spill or a dropped crate breaks it', () => {
  const run = P.createRun(spec); run.begin(0); const s = sh(0), ribbons = [];
  s.schedule.slice(0, 6).forEach((e) => { const c = s.crates.find((x) => x.uid === e.uid); ribbons.push(run.route(e.uid, c.rank, 1, e.t0 + 2).ribbon); });
  assert.deepStrictEqual(ribbons, [false, false, false, true, false, false]); assert.strictEqual(run.shift.combo, 6);
  const e7 = s.schedule[6], c7 = s.crates.find((x) => x.uid === e7.uid); run.route(e7.uid, (c7.rank + 1) % 4, 1, e7.t0 + 2); assert.strictEqual(run.shift.combo, 0); assert.strictEqual(run.shift.bestCombo, 6);
});
test('a shift log: every crate once in schedule order, anything left on the belt counts as dropped, the log is what E.scoreShift reads; partial crates are what Esc keeps', () => {
  const run = P.createRun(spec); run.begin(3); const s = sh(3), a = s.schedule[0], b = s.schedule[1]; run.route(a.uid, 0, 1, a.t0 + 2); run.pit(b.uid, 2);
  assert.deepStrictEqual(run.partial().map((x) => x.uid), [a.uid, b.uid]);
  const log = run.finish([{ t0: 3, t1: 5 }], 60); assert.deepStrictEqual(log.entries.map((x) => x.uid), s.crates.map((c) => c.uid)); assert.strictEqual(log.entries.length, 12);
  assert(log.entries.slice(2).every((x) => x.action === 'dropped')); assert.strictEqual(log.brakeUsed, 2); assert.strictEqual(log.deskCap, 6); assert.strictEqual(log.index, 3); assert.deepStrictEqual(run.partial(), []);
  assert.strictEqual(run.route(s.schedule[3].uid, 0, 61, s.schedule[3].t0 + 2), null, 'a closed shift takes nothing'); const sc = E.scoreShift(log); assert.strictEqual(sc.total, 12); assert.strictEqual(sc.dropped, 11, 'ten left on the belt and one in the pit');
});
test('the rules agree with the engine: a scripted player (routes and brakes) fed through createRun gets exactly the logs and score of E.playShift, in every shift of a run', () => {
  for (const sd of [3, 4, 5]) for (const mode of ['perfect', 'lax', 'strict', 'mixed']) {
    const sp = E.composeRun(sd, null), run = P.createRun(sp);
    sp.shifts.forEach((s, i) => {
      const brakes = i % 2 ? [{ t0: 4, t1: 6.5 }, { t0: 20, t1: 21.5 }] : [], clock = E.beltClock(brakes), inputs = brakes.map((b) => Object.assign({ kind: 'brake' }, b));
      s.schedule.forEach((e, k) => { const c = s.crates.find((x) => x.uid === e.uid), bin = mode === 'perfect' ? c.rank : mode === 'lax' ? 0 : mode === 'strict' ? 3 : (k % 4 === 3 ? null : (c.rank + k) % 4); if (bin == null) return; inputs.push({ kind: 'route', uid: e.uid, bin: SIDES[c.side].bins[bin].id, t: clock.t(e.t0 + 3.4) }); });
      const expect = E.playShift(s, inputs); run.begin(i);
      for (const x of inputs.filter((y) => y.kind === 'route').sort((a, b) => a.t - b.t)) run.route(x.uid, E.rankOf(s.crates.find((c) => c.uid === x.uid).side, x.bin), x.t, clock.s(x.t));
      for (const c of s.crates) run.pit(c.uid, clock.t(s.schedule.find((e) => e.uid === c.uid).t0 + RUN.traverse));
      const log = run.finish(brakes, 0);
      assert.deepStrictEqual(log.entries.map((x) => [x.uid, x.action, x.chosen, x.correct, x.direction, x.severe, x.stamp, x.overGated || false]), expect.entries.map((x) => [x.uid, x.action, x.chosen, x.correct, x.direction, x.severe, x.stamp, x.overGated || false]));
      assert.deepStrictEqual([log.desk, log.deskCap, log.brakeUsed], [expect.desk, expect.deskCap, expect.brakeUsed]); assert(Math.abs(log.endT - expect.endT) < 1e-9);
      assert.deepStrictEqual(E.scoreShift(log), E.scoreShift(expect));
    });
    assert.strictEqual(run.score(true).shifts.length, 5);
  }
});
test('invariants over 300 runs of random play: a crate is settled exactly once, the desk count never falls, accuracy stays in 0..1, a run left early earns no stars', () => {
  for (let s = 0; s < 300; s++) {
    const sp = E.composeRun(BG.hash32('r' + s), null), run = P.createRun(sp), rng = BG.mulberry32(s + 1);
    for (let i = 0; i < (s % 5) + 1; i++) {
      const z = sp.shifts[i], R = run.begin(i); let last = 0;
      for (let k = 0; k < 40; k++) { const e = z.schedule[(rng() * z.schedule.length) | 0]; if (rng() < 0.7) run.route(e.uid, (rng() * 4) | 0, k, e.t0 + rng() * 8); else run.pit(e.uid, k); assert(R.reviewCount >= last); last = R.reviewCount; }
      const log = run.finish([], 99); assert.strictEqual(new Set(log.entries.map((x) => x.uid)).size, z.crates.length); const sc = E.scoreShift(log); assert(sc.accuracy >= 0 && sc.accuracy <= 1 && sc.total === z.crates.length);
    }
    if (s % 5 !== 4) assert.strictEqual(run.score().stars, 0, 'unfinished');
  }
});
test('the debrief card: where you sent it, where it belongs and why, with the labels of the crate\'s own side; a jam, a drop and the AUTO-SEND truth are each said', () => {
  const find = (side, f) => { for (const r of [spec]) for (const s of r.shifts) for (const c of s.crates) if (c.side === side && f(c)) return c; };
  const lax = E.entryFor(find('tiers', (c) => c.rank === 2), 'auto', 5, false), d = P.describe(lax, 'IDEA', 6);
  assert.strictEqual(d.lead, 'You sent:'); assert.strictEqual(d.text, `${lax.text} → RUN AUTO`); assert.strictEqual(d.breaksLabel, 'It belongs in REVIEW EACH:'); assert.strictEqual(d.breaks, lax.tell); assert.deepStrictEqual([d.idea, d.ideaLabel], ['IDEA', 'The idea:']);
  const drop = P.describe(E.entryFor(find('doors', () => true), null, 5, false), 'I'); assert.strictEqual(drop.lead, 'It reached the pit:'); assert(!/→/.test(drop.text));
  const rev = find('tiers', (c) => c.rank === 1), jam = P.describe(E.entryFor(rev, 'review', 5, true), 'I', 6); assert.strictEqual(jam.lead, 'You sent (the desk was jammed):'); assert(/holds 6 a shift/.test(jam.breaks) && jam.breaks.endsWith(rev.tell));
  const wrong = find('checks', (c) => !c.outputRight && c.rank === 2), rv = P.describe(E.entryFor(wrong, 'send', 5, false), 'I'); assert(/\(It was wrong\.\)$/.test(rv.breaks) && rv.breaksLabel === 'It belongs in EXPERT REVIEW:');
  const fine = find('checks', (c) => c.outputRight && c.rank === 1), fv = P.describe(E.entryFor(fine, 'send', 5, false), 'I'); assert(/went out fine/i.test(fv.breaks));
  for (const c of C.CONCEPTS) assert(c.idea.length < 140 && !/\n/.test(c.idea), c.id + ' idea is one line');
});
test('trade-off: one line that always explains it ("Over-locking costs capacity; under-locking costs incidents"), with a verdict that follows the numbers', () => {
  const t = (o) => P.tradeoff(Object.assign({ severe: 0, cost: 50, idealCost: 50, dropped: 0, accuracy: 1 }, o));
  for (const o of [{}, { severe: 5 }, { cost: 120 }, { dropped: 4 }, { accuracy: 0.5 }]) { const l = t(o); assert(l.endsWith(P.TRADE) && !/\n/.test(l)); }
  assert(/steady/i.test(t({})) && /spills/i.test(t({ severe: 3 })) && /locks/i.test(t({ cost: 90 })) && /pit/i.test(t({ dropped: 3 })) && /fair/i.test(t({ accuracy: 0.7 })));
  assert.strictEqual(P.TRADE, 'Over-locking costs capacity; under-locking costs incidents.');
  assert.strictEqual(P.shiftLine({ accuracy: 0.75, correct: 9, total: 12, severe: 1, dropped: 0, cost: 40, idealCost: 36 }), 'Accuracy 75% (9 of 12) · 1 spill · 0 dropped · line cost 40 against an ideal 36');
});
done();
