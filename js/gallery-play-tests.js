// Self-test for the Spot Shot rules: tokens, magnifier charges, judging, the combo, the round logs, the debrief card and the trade-off line. Run: node js/gallery-play-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const P = require('./gallery-play.js');
const E = require('./gallery-engine.js');
const C = require('./gallery-content.js');
const BG = require('./bridge-generator.js');

const spec = E.composeRun(BG.hash32('rules'), null), round = (i) => spec.rounds[i];
const cam = E.LAYOUT.camera, ASPECT = 16 / 9;

test('tokens: a round gives threats + 2; a shot that hits nothing still costs one; with none left a shot does nothing and is counted as dry', () => {
  const run = P.createRun(spec), R = run.begin(0), n = round(0).threats + 2;
  assert.strictEqual(R.ammo, n); assert(run.canShoot());
  for (let k = 0; k < n; k++) { const r = run.shoot(null, k); assert.strictEqual(r.kind, 'miss'); assert.strictEqual(r.ammo, n - k - 1); }
  assert.strictEqual(R.ammo, 0); assert(!run.canShoot()); const dry = run.shoot(round(0).items[0].uid, 9); assert.strictEqual(dry.kind, 'dry'); assert.strictEqual(R.dry, 1); assert.strictEqual(R.done.size, 0, 'a dry shot settles nothing');
  assert.strictEqual(R.shots.length, n);
});
test('judging a shot: a threat is stopped, a real card is friendly fire; a card is settled once, so a second shot at it is a miss that still costs a token', () => {
  const run = P.createRun(spec); run.begin(0); const [th, lg] = [round(0).items.find((c) => c.shoot), round(0).items.find((c) => !c.shoot)];
  const a = run.shoot(th.uid, 1), b = run.shoot(lg.uid, 2), again = run.shoot(th.uid, 3);
  assert.deepStrictEqual([a.kind, a.entry.event, a.entry.correct], ['hit', 'stopped', true]); assert.deepStrictEqual([b.kind, b.entry.event, b.entry.correct], ['hit', 'friendly', false]);
  assert.strictEqual(again.kind, 'miss'); assert.strictEqual(run.round.ammo, round(0).ammo - 3);
});
test('judging a pass: a threat that reaches the ticket window is a leak, a real card is delivered; a settled card cannot pass again', () => {
  const run = P.createRun(spec); run.begin(1); const th = round(1).items.find((c) => c.shoot), lg = round(1).items.find((c) => !c.shoot);
  const a = run.pass(th.uid, 5), b = run.pass(lg.uid, 6);
  assert.deepStrictEqual([a.kind, a.entry.correct, a.entry.action], ['leak', false, 'leaked']); assert.deepStrictEqual([b.kind, b.entry.correct, b.entry.action], ['delivered', true, 'delivered']);
  assert.strictEqual(run.pass(th.uid, 7), null); assert.strictEqual(run.pass('nope', 7), null);
});
test('magnifier: five charges for the WHOLE run (not per round), once per card, never on a settled card; inspecting a trap first makes the right call verified, not lucky', () => {
  const run = P.createRun(spec); let used = 0;
  for (let i = 0; i < 5; i++) {
    run.begin(i); const r = round(i);
    for (const it of r.items) { const x = run.inspect(it.uid, 1); if (x) { used++; assert.strictEqual(x.text, it.inspect); assert.strictEqual(x.charges, 5 - used); assert.strictEqual(run.inspect(it.uid, 2), null, 'once per card'); } }
    run.finishRound(99);
  }
  assert.strictEqual(used, 5); assert.strictEqual(run.charges, 0); assert(!run.canInspect());
  const r2 = P.createRun(spec); r2.begin(0); const trap = round(0).items.find((c) => c.kind === 'trap' && c.shoot), other = round(0).items.find((c) => c.kind === 'trap' && !c.shoot);
  assert(r2.inspect(trap.uid, 1)); assert(r2.shoot(trap.uid, 2).entry.inspected && !r2.shoot(trap.uid, 2).entry); // second shot misses
  const a = P.createRun(spec); a.begin(0); const lucky = a.shoot(trap.uid, 1).entry; assert(lucky.lucky && !lucky.inspected, 'a right call on a trap nobody inspected is lucky');
  const b = P.createRun(spec); b.begin(0); b.inspect(trap.uid, 1); const verified = b.shoot(trap.uid, 2).entry; assert(!verified.lucky && verified.inspected && verified.correct);
  const c = P.createRun(spec); c.begin(0); c.inspect(other.uid, 1); c.shoot(trap.uid, 1); const x = c.pass(other.uid, 9).entry; assert(x.correct && !x.lucky && x.inspected, 'a verified real trap, let through');
  const d = P.createRun(spec); d.begin(0); d.shoot(trap.uid, 1); assert.strictEqual(d.inspect(trap.uid, 2), null, 'a settled card cannot be inspected');
});
test('combo: three right calls in a row ring the ribbon (every third); a leak or a friendly hit breaks it', () => {
  const r = round(0), legit = r.items.filter((c) => !c.shoot), th = r.items.find((c) => c.shoot), run = P.createRun(spec); run.begin(0);
  const res = legit.slice(0, 4).map((c) => run.pass(c.uid, 1)); assert.deepStrictEqual(res.map((x) => x.ribbon), [false, false, true, false]); assert.strictEqual(run.round.combo, 4);
  assert.strictEqual(run.pass(th.uid, 2).ribbon, false); assert.strictEqual(run.round.combo, 0, 'a leak breaks the combo'); assert.strictEqual(run.round.bestCombo, 4);
  const run2 = P.createRun(spec); run2.begin(0); run2.pass(legit[0].uid, 1); run2.pass(legit[1].uid, 1); run2.shoot(legit[2].uid, 2); assert.strictEqual(run2.round.combo, 0, 'friendly fire breaks it');
});
test('a round log: every card exactly once in schedule order, anything left on the shelf counts as passed; the partial cards of an unfinished round are what Esc keeps', () => {
  const run = P.createRun(spec); run.begin(2); const r = round(2); run.shoot(r.items[0].uid, 1); run.pass(r.items[1].uid, 2);
  assert.deepStrictEqual(run.partial().map((e) => e.uid), [r.items[0].uid, r.items[1].uid]);
  const log = run.finishRound(60); assert.deepStrictEqual(log.entries.map((e) => e.uid), r.items.map((c) => c.uid)); assert.strictEqual(log.entries.length, r.items.length);
  assert.strictEqual(log.ammoStart, r.ammo); assert.strictEqual(log.index, 2); assert.strictEqual(log.side, r.side); assert.deepStrictEqual(run.partial(), [], 'a finished round has nothing partial');
  assert(log.entries.slice(2).every((e) => e.action === (e.shoot ? 'leaked' : 'delivered')));
  assert.strictEqual(run.shoot(r.items[3].uid, 61).kind, 'none', 'a closed round takes no more shots');
});
test('the rules agree with the engine: a scripted player fed through createRun (hit test, shots, passes) gets exactly the logs and score of E.playRound', () => {
  const win = (sched, e) => { for (let t = e.spawnTime + e.rise + 0.2; t < e.endTime - 0.4; t += 0.1) { const a = at(e, t), b = at(e, t + 0.15), h1 = E.hitTest(sched, t, E.rayFromNdc(cam, ASPECT, a.x, a.y)), h2 = E.hitTest(sched, t + 0.15, E.rayFromNdc(cam, ASPECT, b.x, b.y)); if (h1 && h2 && h1.uid === e.uid && h2.uid === e.uid) return t; } return null; };
  function at(e, t) { const c = E.cardPose(e, t); return E.ndcOf(cam, ASPECT, [c.x, c.y, c.z]); }
  for (const sd of [3, 4, 5]) {
    const sp = E.composeRun(sd, null), run = P.createRun(sp), logs = [];
    sp.rounds.forEach((r, i) => {
      const by = Object.fromEntries(r.items.map((c) => [c.uid, c])), inputs = [];
      r.schedule.forEach((e, k) => { const t = win(r.schedule, e); if (t == null) return; if (by[e.uid].kind === 'trap' && k % 2 === 0) { const a = at(e, t); inputs.push({ t, kind: 'inspect', nx: a.x, ny: a.y }); } if (by[e.uid].shoot || k % 5 === 0) { const a = at(e, t + 0.1); inputs.push({ t: t + 0.1, kind: 'shoot', nx: a.x, ny: a.y }); } });
      const charges = run.charges, expect = E.playRound(r, inputs, { charges }); run.begin(i);
      const shotUids = new Set();
      inputs.map((x, n) => [x, n]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).forEach(([x]) => {
        const hit = E.hitTest(r.schedule, x.t, E.rayFromNdc(cam, ASPECT, x.nx, x.ny), shotUids);
        if (x.kind === 'shoot') { const res = run.shoot(hit ? hit.uid : null, x.t); if (hit && res.kind === 'hit') shotUids.add(hit.uid); } else if (hit) run.inspect(hit.uid, x.t);
      });
      for (const e of r.schedule) run.pass(e.uid, e.endTime);
      const log = run.finishRound(0); logs.push(log);
      assert.deepStrictEqual(log.entries.map((e) => [e.uid, e.action, e.correct, e.lucky, e.inspected]), expect.entries.map((e) => [e.uid, e.action, e.correct, e.lucky, e.inspected]));
      assert.strictEqual(log.ammoLeft, expect.ammoLeft); assert.strictEqual(log.charges, expect.charges); assert.deepStrictEqual(log.shots.map((s) => s.uid), expect.shots.map((s) => s.uid));
    });
    assert(run.score(true).rounds.length === 5 && run.score().finished);
  }
});
test('invariants over 300 runs of random play: tokens never below zero or above threats + 2, charges stay in 0..5, every card ends settled exactly once, a run left early earns no stars', () => {
  for (let s = 0; s < 300; s++) {
    const sp = E.composeRun(BG.hash32('r' + s), null), run = P.createRun(sp), rng = BG.mulberry32(s + 1);
    for (let i = 0; i < (s % 5) + 1; i++) {
      const r = sp.rounds[i], R = run.begin(i);
      for (let k = 0; k < 40; k++) { const it = r.items[(rng() * r.items.length) | 0], x = rng(); if (x < 0.4) run.shoot(rng() < 0.2 ? null : it.uid, k); else if (x < 0.6) run.inspect(it.uid, k); else run.pass(it.uid, k); assert(R.ammo >= 0 && R.ammo <= r.ammo && run.charges >= 0 && run.charges <= 5); }
      const log = run.finishRound(99); assert.strictEqual(new Set(log.entries.map((e) => e.uid)).size, r.items.length); assert(log.shots.length <= r.ammo);
    }
    if (s % 5 !== 4) assert.strictEqual(run.score().stars, 0, 'unfinished');
  }
});
test('the debrief card: what you did, the card text, the tell and the idea; a lucky call says so; a verified one says you inspected it', () => {
  const r = round(0), idea = 'IDEA', mk = (shoot, kind, action, inspected) => E.entryFor(Object.assign({}, r.items.find((c) => c.shoot === shoot && c.kind === kind) || r.items[0], { shoot, kind }), action, inspected, 1);
  const leak = P.describe(mk(true, 'clear', 'passed', false), idea), fr = P.describe(mk(false, 'clear', 'shot', false), idea), ok = P.describe(mk(true, 'clear', 'shot', false), idea);
  assert.strictEqual(leak.lead, 'You let this slip through:'); assert.strictEqual(fr.lead, 'You shot a real one:'); assert.strictEqual(ok.lead, 'You shot:');
  assert.strictEqual(P.describe(mk(true, 'trap', 'shot', false), idea).lead, 'You shot it (a lucky call: you did not inspect it):'); assert.strictEqual(P.describe(mk(true, 'trap', 'shot', true), idea).lead, 'You inspected it, then shot:');
  assert.strictEqual(P.describe(mk(false, 'trap', 'passed', false), idea).lead, 'You let it through (a lucky call: you did not inspect it):'); assert.strictEqual(P.describe(mk(false, 'clear', 'passed', false), idea).lead, 'You let it through:');
  assert.strictEqual(P.describe(mk(false, 'trap', 'passed', true), idea).lead, 'You inspected it and let it through:');
  const e = mk(true, 'clear', 'passed', false), d = P.describe(e, idea); assert.deepStrictEqual([d.text, d.breaks, d.breaksLabel, d.idea, d.ideaLabel], [e.card.body, e.tell, 'The tell:', idea, 'The idea:']);
  for (const c of C.CONCEPTS) assert(c.idea.length < 140 && !/\n/.test(c.idea), c.id + ' idea is one line');
});
test('trade-off: one line that always explains it ("Shooting everything tanks accuracy; shooting nothing tanks catch rate"), with a verdict that follows the numbers', () => {
  const t = (catchRate, accuracy) => P.tradeoff({ catchRate, accuracy });
  for (const [c, a] of [[1, 1], [0.7, 0.7], [0.5, 0.9], [0.9, 0.4], [0, null]]) { const l = t(c, a); assert(l.endsWith(P.TRADE) && !/\n/.test(l)); }
  assert(/steady/i.test(t(0.9, 0.9)) && /fair/i.test(t(0.7, 0.7)) && /slipped/i.test(t(0.5, 0.9)) && /trigger/i.test(t(0.9, 0.4)) && /slipped/i.test(t(0, null)));
  assert.strictEqual(P.TRADE, 'Shooting everything tanks accuracy; shooting nothing tanks catch rate.');
  assert(/Stopped 4 of 5 threats \(80%\) · accuracy 80% · 1 slipped through · 1 real shot · 3 tokens left/.test(P.roundLine({ stopped: 4, threats: 5, catchRate: 0.8, accuracy: 0.8, leaks: 1, friendly: 1, ammoLeft: 3 })));
});
done();
