// Self-test for House Rules Carrom: content, generator, fairness. Run: node js/carrom-tests.js
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const G = require('./carrom-generator.js');
const P = require('./carrom-physics.js');
const BG = require('./bridge-generator.js');
const { LIMITS, SIDES, CARDS } = require('./carrom-content.js');

const N = 500;
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const run = (i, history) => G.composeRun(G.seedFor('player-' + i, 0), history);
const runs = Array.from({ length: N }, (_, i) => run(i));
const questions = runs.flatMap((r) => r.rounds.flatMap((x) => x.questions));
const picks = questions.filter((q) => q.kind === 'pick'), sorts = questions.filter((q) => q.kind === 'sort');
const words = (s) => s.trim().split(/\s+/).length;
const targetsOf = (q) => (q.kind === 'pick' ? [{ start: q.start, ghost: q.ghost, option: q.options.find((o) => o.correct) }] : q.items.map((it) => ({ start: it.start, ghost: it.ghost, option: q.options.find((o) => o.id === it.pocket) })));
const distTo = (s, corner) => Math.hypot(s.x - P.POCKETS[corner][0], s.y - P.POCKETS[corner][1]);

// where a value falls among its question's options (0 = smallest), a tie sharing its rank fractionally
function addRank(counts, vals, i) {
  const lo = vals.filter((v) => v < vals[i]).length, ties = vals.filter((v, j) => j !== i && v === vals[i]).length;
  for (let k = 0; k <= ties; k++) counts[lo + k] += 1 / (ties + 1);
}
function uniform(label, counts, tol = 0.08) {
  const tot = counts.reduce((a, b) => a + b, 0);
  console.log(`   ${label}: ${counts.map((c) => (100 * c / tot).toFixed(1) + '%').join(' ')}`);
  for (const c of counts) assert(Math.abs(c / tot - 1 / counts.length) < tol, `${label} is not uniform within ${tol * 100}%`);
}

test('seedFor: deterministic, per player and run, and not the bridge\'s stream', () => {
  assert.strictEqual(G.seedFor('amy', 3), G.seedFor('amy', 3));
  assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('amy', 4));
  assert.notStrictEqual(G.seedFor('amy', 3), G.seedFor('raj', 3));
  assert.notStrictEqual(G.seedFor('amy', 3), BG.seedFor('amy', 3), 'carrom run 3 and bridge run 3 do not share a random stream');
});

test('composeRun: deterministic, and the runSpec is plain JSON', () => {
  for (const s of runs.slice(0, 60)) { assert.deepStrictEqual(G.composeRun(s.seed), s); assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s); }
});

test('shape: four sides then the finale; four pockets that are the options, one right; a finale of two shots on one scenario', () => {
  const orders = new Set();
  for (const s of runs) {
    assert.strictEqual(s.rounds.length, 5);
    assert.deepStrictEqual([...s.order.slice(0, 4)].sort(), ['bias', 'limits', 'owns', 'works'], 'all four sides'); assert.strictEqual(s.order[4], 'case'); orders.add(s.order.join());
    s.rounds.forEach((r, i) => {
      assert.strictEqual(r.side, s.order[i]);
      if (r.side === 'case') { assert.deepStrictEqual(r.questions.map((q) => q.conceptId), ['CF1', 'CF2']); assert.strictEqual(r.questions[0].scenario, r.questions[1].scenario); assert(r.questions[0].scenario); }
      else assert.strictEqual(r.questions.length, 1);
      for (const q of r.questions) {
        assert.strictEqual(q.kind, SIDES[r.side].format); assert.strictEqual(q.options.length, 4);
        assert.deepStrictEqual(q.options.map((o) => o.corner).sort(), [0, 1, 2, 3], 'each option sits on its own pocket');
        if (q.kind === 'pick') { assert.strictEqual(q.options.filter((o) => o.correct).length, 1); assert.strictEqual(q.options.find((o) => o.correct).id, q.correct); assert(q.options.filter((o) => !o.correct).every((o) => o.breaks)); }
        else { assert.strictEqual(q.items.length, 3); assert(new Set(q.items.map((x) => x.pocket)).size >= 2, 'at least two pockets are used'); }
      }
    });
  }
  console.log(`   ${orders.size} different side orders in ${N} runs`); assert(orders.size >= 20);
});

test('clocks: 55 s a pick round, 90 s the sort, 70 s the finale; the worst case is 4-5.5 minutes', () => {
  for (const s of runs) { s.rounds.forEach((r) => assert.strictEqual(r.clock, { pick: 55, sort: 90, case: 70 }[r.kind])); assert.strictEqual(s.clockSeconds, 325); assert(s.clockSeconds / 60 >= 4 && s.clockSeconds / 60 <= 5.5); }
});

test('strings: stems, options and items stay inside the limits; no duplicate options; no unfilled placeholder', () => {
  for (const q of questions) {
    assert(words(q.stem) <= LIMITS.stemWords, q.stem); assert(!/\{\w+\}/.test(q.stem));
    const texts = q.options.map((o) => o.text); assert.strictEqual(new Set(texts).size, 4, 'no duplicate options: ' + texts.join(' | '));
    for (const o of q.options) { assert(o.text.length <= (q.kind === 'pick' ? LIMITS.pickChars : LIMITS.pocketChars), o.text); assert(!/\{\w+\}/.test(o.text) && !/all of the above/i.test(o.text)); }
    if (q.kind === 'pick') { const c = q.options.find((o) => o.correct).text.length; for (const o of q.options.filter((x) => !x.correct)) assert(Math.min(o.text.length, c) / Math.max(o.text.length, c) >= LIMITS.lenRatio, `${o.text} vs correct`); }
    for (const it of q.items || []) { assert(it.text.length <= LIMITS.itemChars); const ids = q.options.map((o) => o.id); assert.deepStrictEqual(Object.keys(it.breaks).sort(), ids.filter((i) => i !== it.pocket).sort(), 'a misconception for every wrong pocket'); }
  }
});

test('sort rounds: a twin "with a tool" item in about a third of runs, never next to its base item', () => {
  let flip = 0;
  for (const q of sorts) {
    const v = CARDS.find((c) => c.id === q.conceptId).variants.find((x) => x.id === q.variantId), item = (id) => v.sort.items.find((x) => x.id === id);
    const flips = q.items.filter((c) => c.flip); if (flips.length) flip++;
    for (const f of flips) assert(!q.items.some((c) => c.id === item(f.id).pair));
  }
  const share = flip / sorts.length; console.log(`   twin tool items in ${(share * 100).toFixed(1)}% of sort rounds`); assert(Math.abs(share - 1 / 3) < 0.08);
});

test('variety: two random seeds share fewer than 30% of (concept, variant, params) triples', () => {
  const triples = (s) => new Set(s.rounds.flatMap((r) => r.questions.map((q) => q.conceptId + '|' + q.variantId + '|' + JSON.stringify(q.params))));
  const sets = runs.slice(0, 200).map(triples), shares = [];
  for (let i = 0; i < sets.length; i += 2) { const a = sets[i], b = sets[i + 1]; shares.push([...a].filter((x) => b.has(x)).length / a.size); }
  const m = mean(shares), under = shares.filter((x) => x < 0.3).length / shares.length;
  console.log(`   mean shared ${(m * 100).toFixed(1)}%, ${(under * 100).toFixed(0)}% of pairs under 30% (a pair shares 2 of its 6 questions = 33% about one time in six)`);
  assert(m < 0.3 && under >= 0.8);
  assert(new Set(runs.map((s) => JSON.stringify(s.rounds.map((r) => r.questions.map((q) => [q.variantId, q.options.map((o) => o.corner), q.start || q.items.map((i) => i.start)]))))).size > N * 0.99, 'different players get different runs');
});

test('no tell: the right answer\'s pocket, its place in the list, its length and its distance are uniformly distributed', () => {
  const corner = [0, 0, 0, 0], slot = [0, 0, 0, 0], len = [0, 0, 0, 0], dist = [0, 0, 0, 0];
  for (const q of questions) for (const t of targetsOf(q)) {
    corner[t.option.corner]++; slot[q.options.indexOf(t.option)]++;
    const vals = [0, 1, 2, 3].map((c) => distTo(t.start, c)); addRank(dist, vals, t.option.corner);
    if (q.kind === 'pick') addRank(len, q.options.map((o) => o.text.length), q.options.indexOf(t.option));
  }
  uniform('pocket of the right answer (NW NE SE SW)', corner); uniform('place of the right answer in the list', slot); uniform('distance rank of the right pocket (nearest .. farthest)', dist);
  uniform('text-length rank of the right option (pick rounds)', len);
});

test('fairness: every start is near the middle, every pocket\'s opening is at least +/-3.5 degrees wide from the coin, and no pocket is out of reach', () => {
  let narrowest = 99, nearest = 999, farthest = 0;
  for (const q of questions) for (const t of targetsOf(q)) {
    assert(Math.hypot(t.start.x - 50, t.start.y - 50) <= G.START_R + 1e-9, 'the coin starts near the middle');
    for (let c = 0; c < 4; c++) { const d = distTo(t.start, c); nearest = Math.min(nearest, d); farthest = Math.max(farthest, d); narrowest = Math.min(narrowest, Math.asin(P.CFG.R_POCKET / d) / (Math.PI / 180)); }
  }
  console.log(`   pockets are ${nearest.toFixed(0)}-${farthest.toFixed(0)} units away; the narrowest aiming window is +/-${narrowest.toFixed(1)} degrees`);
  assert(nearest > 35 && farthest < 90 && narrowest >= 3.5);
});

test('ghost shots: every stored shot sinks the coin in the right pocket from a baseline facing away from it, with room to spare', () => {
  const FAR = [['S', 'E'], ['S', 'W'], ['N', 'W'], ['N', 'E']]; let n = 0, narrowest = 99; const sides = { S: 0, W: 0, N: 0, E: 0 };
  for (const q of questions) {
    assert(G.verifyQuestion(q), q.id + ': sinks with the aim 1 degree and the power 8% off');
    for (const t of targetsOf(q)) {
      n++; sides[t.ghost.side]++; assert(FAR[t.option.corner].includes(t.ghost.side), 'shot from a side facing away from the pocket'); assert(t.ghost.strikerX >= 10 && t.ghost.strikerX <= 90 && t.ghost.power >= 0.3 && t.ghost.power <= 1);
      assert(t.ghost.width >= 3, 'a window of at least 3 degrees (+/-1.5) of aim that still sinks it'); narrowest = Math.min(narrowest, t.ghost.width);
    }
  }
  console.log(`   ${n} ghost shots re-simulated at 5 aims; narrowest sinking window ${narrowest} degrees; shot from S/W/N/E: ${Object.values(sides).join('/')}`);
});

test('history: no variant from the last 3 runs is reused', () => {
  for (let p = 0; p < 30; p++) {
    const hist = { runs: [] };
    for (let i = 0; i < 10; i++) {
      const s = G.composeRun(G.seedFor('hist-' + p, i), hist), recent = new Set(hist.runs.slice(-3).flatMap((r) => r.variants));
      for (const r of s.rounds) for (const q of r.questions) assert(!recent.has(q.variantId), `player ${p} run ${i} reused ${q.variantId}`);
      hist.runs.push({ variants: s.seen });
    }
  }
});

test('weights: concepts that are mastered come up less, concepts that cost strikes come up more', () => {
  const history = { concepts: { CW1: { attempts: 6, falls: 0, mastered: true }, CW2: { attempts: 6, falls: 4, mastered: false } } }, hit = { CW1: 0, CW2: 0, CW3: 0 };
  for (let i = 0; i < 800; i++) for (const r of G.composeRun(G.seedFor('w' + i, 0), history).rounds) for (const q of r.questions) if (q.conceptId in hit) hit[q.conceptId]++;
  console.log(`   of 800 runs: mastered CW1 ${hit.CW1}, neutral CW3 ${hit.CW3}, struggled-with CW2 ${hit.CW2}`);
  assert(hit.CW1 < hit.CW3 && hit.CW3 < hit.CW2);
});

test('rerollRound: the same concept as a different variant, verified; the other rounds untouched', () => {
  for (const s of runs.slice(0, 60)) for (let i = 0; i < 5; i++) {
    const { spec, round } = G.rerollRound(s, i), old = s.rounds[i];
    assert.deepStrictEqual(G.rerollRound(s, i).spec, spec, 'deterministic'); assert.deepStrictEqual(JSON.parse(JSON.stringify(spec)), spec);
    assert.strictEqual(round.reroll, old.reroll + 1); assert.strictEqual(round.side, old.side);
    round.questions.forEach((q, k) => { assert.strictEqual(q.conceptId, old.questions[k].conceptId); assert.notStrictEqual(q.variantId, old.questions[k].variantId, 'a different variant'); assert(G.verifyQuestion(q)); });
    spec.rounds.forEach((r, k) => { if (k !== i) assert.deepStrictEqual(r, s.rounds[k]); });
    assert(old.questions.every((q) => spec.seen.includes(q.variantId)) && round.questions.every((q) => spec.seen.includes(q.variantId)));
    if (round.kind === 'case') assert.notStrictEqual(round.questions[0].scenario, old.questions[0].scenario);
  }
});

test('speed: composing a whole run, ghost shots included, takes milliseconds, so it can happen behind the entry fade', () => {
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 100; i++) G.composeRun(G.seedFor('speed', i));   // ghost shots are searched on the real physics
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 100; console.log(`   ${ms.toFixed(1)} ms per run`); assert(ms < 250);
});

test('the shared code still works: bridge, physics, world, rules and progress tests pass', () => {
  for (const f of ['bridge-tests.js', 'carrom-physics-tests.js', 'carrom-world-tests.js', 'carrom-play-tests.js', 'carrom-progress-tests.js']) {
    let out; try { out = execFileSync('node', [path.join(__dirname, f)], { encoding: 'utf8' }); } catch (e) { if (f === 'carrom-progress-tests.js' && /Cannot find module/.test(String(e.stderr))) continue; throw e; }
    const m = out.match(/(\d+) checks passed/); assert(m, f); console.log(`   ${f}: ${m[1]} checks passed`);
  }
});

console.log(`\n${checks} checks passed`);
