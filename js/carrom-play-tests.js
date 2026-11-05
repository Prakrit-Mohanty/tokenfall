// Self-test for the carrom rules engine (carrom-play.js, the pure part) with the real physics and scripted players. Run: node js/carrom-play-tests.js
const assert = require('assert');
const Play = require('./carrom-play.js');
const P = require('./carrom-physics.js');
const G = require('./carrom-generator.js');
const { mulberry32 } = require('./bridge-generator.js');
const { RULES, pointsFor, starsFor, aimGuide, angleTo, createRound, createRun, memoryProgress } = Play;
const { CFG } = P;

let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const specs = Array.from({ length: 150 }, (_, i) => G.composeRun(G.seedFor('play-' + i, 0)));

// a shot the way the game plays it: the striker from a baseline, the one coin where it is; which pocket (corner) did the coin fall into?
const shotAt = (pos, shot) => ({ pocket: G.shotResult(pos, shot).pocket });
const ghost = (tg) => shotAt(tg.start, tg.ghost);
const aimed = (tg, corner) => shotAt(tg.start, G.ghostFor(tg.start, corner));   // a shot into a given pocket, from a side facing away from it
const SHORT = { side: 'S', strikerX: 50, angle: 85, power: 0.1 };               // goes nowhere near the coin

test('points and stars: 3 / 2 / 1 by shots; 3 stars need 13+ and at most one strike, 2 need 9+', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 9].map(pointsFor), [3, 2, 1, 1, 1]);
  assert.strictEqual(starsFor(15, 0), 3); assert.strictEqual(starsFor(13, 1), 3); assert.strictEqual(starsFor(13, 2), 2); assert.strictEqual(starsFor(12.9, 0), 2);
  assert.strictEqual(starsFor(9, 5), 2); assert.strictEqual(starsFor(8.9, 0), 1); assert.strictEqual(starsFor(0, 4), 1);
});

test('the aim guide tells the truth: where the striker first touches the coin, where the coin heads, and the pocket it is heading for', () => {
  const rng = mulberry32(5); let hits = 0, pockets = 0, agree = 0, misses = 0;
  for (let i = 0; i < 800; i++) {
    const coin = { x: 36 + rng() * 28, y: 36 + rng() * 28 }, side = P.SIDES[i % 4], t = 12 + rng() * 76, L = P.strikerAt(side, t), angle = angleTo(side, t, coin) + (rng() - 0.5) * 16, g = aimGuide(coin, side, t, angle);
    const s = P.createState({ coins: [{ id: 'c', x: coin.x, y: coin.y }], strikerX: t, side }); P.applyShot(s, { side, strikerX: t, angle, power: 1 });
    if (!g.hit) {   // a predicted miss: nothing is touched on the way to the cushion the guide ends at (after that it bounces, which the straight line does not follow)
      misses++; const len = Math.hypot(g.end.x - L.x, g.end.y - L.y);
      for (let k = 0; k < 400 && s.first === null && Math.hypot(s.bodies[0].x - L.x, s.bodies[0].y - L.y) < len - 1.2 && P.step(s); k++);
      assert.strictEqual(s.first, null, 'a predicted miss misses'); continue;
    }
    for (let k = 0; k < 400 && s.first === null && P.step(s); k++);
    hits++; assert.strictEqual(s.first, 'c', 'a predicted touch touches');
    const c = s.bodies[1]; for (let k = 0; k < 12 && Math.hypot(c.vx, c.vy) === 0; k++) P.step(s);   // a grazing touch can take a substep longer to push
    const sp = Math.hypot(c.vx, c.vy); if (sp === 0) continue; for (let k = 0; k < 2; k++) P.step(s);
    const sp2 = Math.hypot(c.vx, c.vy), dir = { x: c.vx / sp2, y: c.vy / sp2 }; assert(dir.x * g.depart.dx + dir.y * g.depart.dy > 0.9999, 'the coin leaves along the predicted line (exactly, now that collisions happen at the instant of contact)');
    if (g.depart.corner != null) { pockets++; const r = G.shotResult(coin, { side, strikerX: t, angle, power: 1 }); if (r.pocket === g.depart.corner) agree++; }
  }
  console.log(`   ${hits} predicted touches and ${misses} misses matched the physics; of ${pockets} lines running into a pocket, ${agree} really sank there`); assert(hits > 100 && misses > 10 && pockets > 20 && agree / pockets >= 0.9);
});

test('a shot straight into any pocket is judged by the pocket it fell into: the right one scores, any other is a strike with its own misconception card', () => {
  let right = 0, wrong = 0;
  for (const spec of specs) for (const round of spec.rounds) for (const q of round.questions) {
    const tgs = createRound({ questions: [q], clock: 55, kind: q.kind, side: q.side }).st().targets;
    for (const corner of [0, 1, 2, 3]) {
      const R = createRound({ questions: [q], clock: 55, kind: q.kind, side: q.side }), tg = R.target(), res = aimed(tg, corner), opt = q.options.find((o) => o.corner === corner);
      assert.strictEqual(res.pocket, corner, 'every pocket is a straight flick away'); const out = R.judge(res);
      if (opt.id === tg.correct.id) { right++; assert.strictEqual(out.kind, 'right'); assert.strictEqual(out.pts, 3); assert.strictEqual(R.strikes, 0); }
      else {
        wrong++; assert.strictEqual(out.kind, 'wrong'); assert.strictEqual(R.strikes, 1); assert.strictEqual(out.card.lead, 'You sank:'); assert(out.card.text.includes(opt.text)); assert(out.card.breaks && out.card.breaks.length > 10); assert.strictEqual(out.card.idea, q.idea);
        if (q.kind === 'sort') assert(out.card.text.includes('→') && out.card.text.includes(tg.item.text), 'a sort card names the item and the pocket it went into');
        else assert.strictEqual(out.card.breaks, opt.breaks);
      }
    }
  }
  console.log(`   ${right} right and ${wrong} wrong sinks over ${specs.length} runs, every one judged by the pocket alone`); assert(right > 0 && wrong === right * 3);
});

test('a coin that stops short or misses is only time: no strike, the shot count goes up, and the round is not over', () => {
  const round = specs[0].rounds.find((r) => r.kind === 'pick'), q = round.questions[0], R = createRound(round);
  for (let i = 0; i < 3; i++) { const res = shotAt(R.target().start, SHORT); assert.strictEqual(res.pocket, null); const out = R.judge(res); assert.strictEqual(out.kind, 'miss'); assert.strictEqual(out.pts, 0); }
  assert.strictEqual(R.strikes, 0); assert.strictEqual(R.shots, 3); assert(!R.over && !R.done);
});

test('scoring: right on the first shot = 3, after one miss = 2, after two = 1; the shots since the last answer are what count', () => {
  const round = specs[1].rounds.find((r) => r.kind === 'pick'), run = (misses) => { const R = createRound(round); for (let i = 0; i < misses; i++) R.judge(shotAt(R.target().start, SHORT)); return { R, o: R.judge(ghost(R.target())) }; };
  assert.deepStrictEqual([0, 1, 2, 5].map((m) => run(m).o.pts), [3, 2, 1, 1]);
  const r2 = run(2); assert.strictEqual(r2.R.points(), 1); assert.strictEqual(r2.R.strikes, 0);
  assert(r2.R.answers[0].correct && r2.R.answers[0].firstTry && r2.R.answers[0].shots === 3, 'three shots, still a first-try answer: a miss is skill, not knowledge');
});

test('two strikes: the round ends, the ghost is due, it scores 0 and is flagged; the lost answer is recorded', () => {
  const round = specs[2].rounds.find((r) => r.kind === 'pick'), q = round.questions[0], R = createRound(round), wrongs = q.options.filter((o) => !o.correct);
  const o1 = R.judge(aimed(R.target(), wrongs[0].corner)); assert.strictEqual(o1.kind, 'wrong'); assert.strictEqual(o1.over, null); assert.strictEqual(R.over, null);
  const o2 = R.judge(aimed(R.target(), wrongs[1].corner)); assert.strictEqual(o2.kind, 'wrong'); assert.strictEqual(o2.over, 'strikes'); assert.strictEqual(R.over, 'strikes');
  assert.strictEqual(R.judge(shotAt(R.target().start, SHORT)), null, 'no more shots after the second strike');
  R.giveUp(); assert.strictEqual(R.points(), 0); assert(R.flagged()); assert(R.answers.some((a) => a.timedOut)); assert(R.answers.filter((a) => !a.correct).every((a) => !a.firstTry));
});

test('the clock only runs while ticked, hits zero once, then the round is over with a timeout; the round clocks are 55, 90 and 70 s', () => {
  const R = createRound(specs[3].rounds.find((r) => r.kind === 'pick')); assert.strictEqual(R.clock, 55);
  R.tick(10); assert.strictEqual(R.clock, 45); R.tick(44.5); assert(Math.abs(R.clock - 0.5) < 1e-9 && !R.over); R.tick(1); assert.strictEqual(R.clock, 0); assert.strictEqual(R.over, 'timeout');
  assert.strictEqual(R.judge({ pocket: null }), null);
  const sorts = specs[3].rounds.find((r) => r.kind === 'sort'), finale = specs[3].rounds[4]; assert.strictEqual(createRound(sorts).clock, 90); assert.strictEqual(createRound(finale).clock, 70);
});

test('sort rounds: three items one after another, averaged; a wrong pocket names the item and the pocket; items done before a ghost keep their points', () => {
  const round = specs.flatMap((s) => s.rounds).find((r) => r.kind === 'sort'), q = round.questions[0], R = createRound(round);
  assert.strictEqual(R.target().item.id, q.items[0].id);
  const o = R.judge(ghost(R.target())); assert.strictEqual(o.kind, 'right'); assert(o.nextItem && !o.solvedQ); assert.strictEqual(R.target().item.id, q.items[1].id, 'the next item is up'); assert.strictEqual(+R.points().toFixed(4), 1, '3 points of 3 items averaged is 1');
  const wrongs = q.options.filter((x) => x.id !== R.target().correct.id);
  R.judge(aimed(R.target(), wrongs[0].corner)); R.judge(aimed(R.target(), wrongs[1].corner)); assert.strictEqual(R.over, 'strikes');
  R.giveUp(); assert.strictEqual(+R.points().toFixed(4), 1, 'the item sunk right keeps its 3 of 9 points'); assert.strictEqual(R.answers.filter((a) => a.timedOut).length, 2, 'the two items never answered are recorded as lost');
  const full = createRound(round); let pts = 0; for (let k = 0; k < 3; k++) { const out = full.judge(ghost(full.target())); assert.strictEqual(out.kind, 'right'); pts += out.pts; } assert(full.done || full.st().solved.size === 3); assert.strictEqual(+full.points().toFixed(4), 3);
});

test('the finale: two questions on one scenario; the round score is their average', () => {
  const round = specs[4].rounds[4], R = createRound(round);
  const o1 = R.judge(ghost(R.target())); assert.strictEqual(o1.kind, 'right'); assert(o1.nextQ && !R.done); assert.strictEqual(R.qi, 1);
  assert.strictEqual(R.judge(shotAt(R.target().start, SHORT)).kind, 'miss');
  const o2 = R.judge(ghost(R.target())); assert.strictEqual(o2.kind, 'right'); assert(R.done); assert.strictEqual(R.points(), 2.5, '(3 + 2) / 2');
});

test('a perfect player: every right pocket found first time gives 15 points, three stars, no strikes, all first-try', () => {
  for (const spec of specs) {
    const run = createRun(spec);
    for (const round of spec.rounds) {
      const R = run.round();
      while (!R.done) assert.strictEqual(R.judge(ghost(R.target())).kind, 'right');
      run.advance();
    }
    assert.strictEqual(+run.total().toFixed(6), 15); assert.strictEqual(run.stars(), 3); assert.strictEqual(run.strikes(), 0); assert(run.answers().every((a) => a.correct && a.firstTry)); assert.strictEqual(run.summary().knewButMissed, 0);
  }
  console.log(`   ${specs.length} perfect runs`);
});

test('a player who guesses wrong first: one strike per wrong answer, then right; the stars follow the points and strikes', () => {
  const spec = specs[5], run = createRun(spec);
  for (const round of spec.rounds) {
    const R = run.round();
    while (!R.done) {
      const q = R.q(), tg = R.target();
      if (R.strikes === 0 && q.kind === 'pick') { const bad = q.options.find((o) => !o.correct); assert.strictEqual(R.judge(aimed(tg, bad.corner)).kind, 'wrong'); }
      assert.strictEqual(R.judge(ghost(R.target())).kind, 'right');
    }
    run.advance();
  }
  const s = run.summary(); assert(s.strikes >= 3); assert(s.points < 15 && s.points > 5); assert.strictEqual(s.stars, starsFor(s.points, s.strikes)); assert(s.answers.some((a) => !a.correct) && s.answers.some((a) => a.correct && !a.firstTry));
});

test('invariants over thousands of random shots: strikes never pass two; a pocket is a verdict, no pocket is only time', () => {
  const rng = mulberry32(9); let shots = 0, verdicts = 0;
  for (let k = 0; k < 300; k++) {
    const round = specs[k % specs.length].rounds[(k * 7) % 5], R = createRound(round);
    for (let s = 0; s < 30 && !R.over && !R.done; s++) {
      const tg = R.target(), shot = { side: P.SIDES[(rng() * 4) | 0], strikerX: 12 + rng() * 76, angle: 0, power: 0.3 + rng() * 0.7 }; shot.angle = angleTo(shot.side, shot.strikerX, tg.start) + (rng() - 0.5) * 24; const res = shotAt(tg.start, shot), before = R.strikes, out = R.judge(res); shots++;
      if (res.pocket == null) { assert.strictEqual(out.kind, 'miss'); assert.strictEqual(R.strikes, before); } else { verdicts++; assert(out.kind === 'right' || out.kind === 'wrong'); }
      assert(R.strikes <= RULES.MAX_STRIKES);
    }
  }
  console.log(`   ${shots} random shots, ${verdicts} of them fell in a pocket`); assert(shots > 1000 && verdicts > 100);
});

test('progress memory: mastery needs a first-try right answer in two different variants on two different runs; leaving mid-round earns nothing', () => {
  const pr = memoryProgress({ playerId: 't' }), ans = (v, extra) => Object.assign({ type: 'answer', credit: true, conceptId: 'CW1', variantId: v, correct: true, firstTry: true }, extra);
  let r = pr.newRun(); pr.onEvent(ans('CW1a')); pr.onEvent({ type: 'finish', seen: ['CW1a'] });
  r = pr.newRun(); pr.onEvent(ans('CW1a')); assert(!r.history.concepts.CW1.mastered); pr.onEvent({ type: 'finish', seen: ['CW1a'] });
  r = pr.newRun(); pr.onEvent(ans('CW1b', { credit: false })); pr.onEvent({ type: 'abandon', seen: ['CW1b'] });
  r = pr.newRun(); assert(!r.history.concepts.CW1.mastered, 'same variant twice, and an uncredited one, is not mastery'); pr.onEvent(ans('CW1b')); pr.onEvent({ type: 'finish', seen: ['CW1b'] });
  r = pr.newRun(); assert(r.history.concepts.CW1.mastered); assert.strictEqual(r.history.runs.length, 4);
  assert.strictEqual(G.composeRun(G.seedFor('t', 4), r.history).rounds.length, 5, 'the generator accepts what the store hands back');
});

console.log(`\n${checks} checks passed`);
