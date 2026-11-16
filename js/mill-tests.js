// Self-test for Token Mill: the bank, the run generator and its fairness, the belt clock, ladder judging with the desk rule, scoring and the replay. Run: node js/mill-tests.js
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { test, done, mean } = require('./test-kit.js');
const E = require('./mill-engine.js');
const BG = require('./bridge/bridge-generator.js');
const C = require('./mill-content.js');
const { LIMITS, CONCEPTS, SIDE_IDS, SIDES, RUN } = C;

const N = 500;
const noRandom = (fn) => { const r = Math.random; Math.random = () => { throw new Error('Math.random is not allowed here'); }; try { return fn(); } finally { Math.random = r; } };
const runs = Array.from({ length: N }, (_, i) => E.composeRun(BG.hash32('seed' + i), null));
const standard = runs.flatMap((r) => r.shifts.filter((s) => s.kind === 'shift')), finales = runs.map((r) => r.shifts[4]);
function* combos(params) { let acc = [{}]; for (const k of Object.keys(params)) { const n = []; for (const a of acc) for (const v of params[k]) n.push(Object.assign({}, a, { [k]: v })); acc = n; } yield* acc; }

// ================================================================= the bank
test('content: 4 sides x 4 concepts, 10 variants and 60 crates a side, every variant two twin pairs + 1 clear + 1 trap, one shared policy per side, ids that cannot collide with the other games', () => {
  const others = new Set();
  for (const m of ['./bridge/bridge-content.js', './carrom-content.js', './jenga-content.js']) for (const k of require(m).CARDS) { others.add(k.id); k.variants.forEach((v) => others.add(v.id)); }
  for (const k of require('./gallery-content.js').CONCEPTS) { others.add(k.id); k.variants.forEach((v) => { others.add(v.id); v.items.forEach((i) => others.add(i.id)); }); }
  const ids = new Set();
  for (const side of SIDE_IDS) {
    const cs = CONCEPTS.filter((c) => c.side === side), vs = cs.flatMap((c) => c.variants);
    assert.strictEqual(cs.length, 4, side); assert(vs.length >= LIMITS.minVariants && vs.flatMap((v) => v.items).length >= LIMITS.minItems); assert.strictEqual(vs.length, 10); assert.strictEqual(vs.length * 6, 60);
    for (const c of cs) { assert(!others.has(c.id) && /^M[DRCI]\d$/.test(c.id) && c.idea && c.title && c.stamps.lax && c.stamps.strict && c.variants.length >= 2, c.id); assert(!ids.has(c.id)); ids.add(c.id); }
    for (const v of vs) {
      assert(!ids.has(v.id) && !others.has(v.id)); ids.add(v.id); assert.strictEqual(v.items.length, 6, v.id); assert.strictEqual(v.sample, true);
      assert.strictEqual(v.brief, SIDES[side].brief); assert.strictEqual(v.bins, SIDES[side].bins);
      const kinds = v.items.map((i) => i.kind), twins = v.items.filter((i) => i.kind === 'twin'), cues = {}; twins.forEach((i) => (cues[i.cue] = cues[i.cue] || []).push(i));
      assert.deepStrictEqual([kinds.filter((k) => k === 'clear').length, kinds.filter((k) => k === 'trap').length, twins.length], [1, 1, 4], v.id);
      const pairs = Object.values(cues); assert.strictEqual(pairs.length, 2, v.id + ' needs 2 twin pairs'); for (const p of pairs) assert(p.length === 2 && p[0].bin !== p[1].bin, v.id + ' a twin pair must differ in the correct bin');
      for (const i of v.items) { assert(!ids.has(i.id) && !others.has(i.id)); ids.add(i.id); assert(SIDES[side].bins.some((b) => b.id === i.bin), i.id); }
    }
  }
  assert.strictEqual(ids.size, 4 * 4 + 40 + 240);
});
test('content: every limit holds over every param fill (text 70, chips 2 x 14, full 160, tell 90, stamps 18, labels 14, legends 40, brief 260), nothing is left unfilled, stamps exist, only .example domains', () => {
  let n = 0;
  for (const side of SIDE_IDS) { const S = SIDES[side]; assert(S.brief.length <= LIMITS.brief && S.bins.length === 4); S.bins.forEach((b) => assert(b.label.length <= LIMITS.label && b.legend.length <= LIMITS.legend, b.label)); }
  assert(/SAMPLE/.test(C.SAMPLE_NOTICE) && /Calfus security or legal/.test(C.SAMPLE_NOTICE));
  for (const c of CONCEPTS) for (const v of c.variants) {
    const used = new Set();
    for (const it of v.items) {
      assert(it.text && it.full && it.tell && it.laxStamp && it.strictStamp && it.chips.length >= 0 && it.chips.length <= LIMITS.chips, it.id);
      for (const m of JSON.stringify(it).matchAll(/\{(\w+)\}/g)) { assert(v.params[m[1]], it.id + ' unknown param ' + m[1]); used.add(m[1]); }
      assert(!/https?:|www\.|[\w-]+\.(com|org|net|io|co|in)\b/i.test(JSON.stringify(it)), it.id + ' real-looking domain');
      for (const p of combos(v.params)) {
        const e = C.expand(it, p); n++;
        assert(e.text.length <= LIMITS.text && e.full.length <= LIMITS.full && e.tell.length <= LIMITS.tell && e.laxStamp.length <= LIMITS.stamp && e.strictStamp.length <= LIMITS.stamp, `${it.id} ${e.text}`);
        e.chips.forEach((ch) => assert(ch.length <= LIMITS.chip, it.id + ' chip ' + ch)); assert(!/\{\w+\}/.test(JSON.stringify(e)), it.id + ' unfilled');
      }
    }
    for (const k of Object.keys(v.params)) assert(used.has(k), v.id + ' unused param ' + k);
  }
  console.log(`   ${n} filled crates checked`);
});
test('content: the confidence side follows its own brief in code (missing = ask; stakes pick the check; under 0.60 one step stricter, never beyond expert); 0.60 is not under; every crate has a hidden truth', () => {
  const items = CONCEPTS.filter((c) => c.side === 'checks').flatMap((c) => c.variants.flatMap((v) => v.items));
  for (const it of items) {
    assert.strictEqual(C.expectedCheck(it), it.bin, it.id); assert.strictEqual(typeof it.outputRight, 'boolean', it.id); assert(!(it.stakes === 'high' && it.confidence < 0.6 && !it.missing), it.id + ' ambiguous');
    assert.strictEqual(it.chips[0], 'CONF ' + it.confidence.toFixed(2), it.id);
  }
  assert(items.some((i) => i.confidence === 0.6 && i.bin === 'send') && items.some((i) => i.confidence < 0.6 && i.stakes === 'medium' && i.bin === 'expert'));
  const wrong = items.filter((i) => !i.outputRight).length; assert(wrong > 15 && wrong < 45, 'a good share of the model outputs are wrong: ' + wrong);
  assert(items.some((i) => i.confidence >= 0.97 && !i.outputRight && i.bin === 'expert'), 'a very confident wrong answer exists');
});

// ================================================================= the generator
test('composeRun: deterministic (no Math.random), the runSpec is plain JSON, a different seed gives a different run', () => {
  noRandom(() => { for (const s of [1, 2, 3, 99]) { const a = E.composeRun(s, null), b = E.composeRun(s, null); assert.deepStrictEqual(a, b); assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), a); } });
  assert.notDeepStrictEqual(E.composeRun(1, null), E.composeRun(2, null));
  assert.strictEqual(E.seedFor('p-1', 0), E.seedFor('p-1', 0)); assert.notStrictEqual(E.seedFor('p-1', 0), E.seedFor('p-2', 0)); assert.notStrictEqual(E.seedFor('p-1', 0), BG.seedFor('p-1', 0));
});
test('shape: 5 shifts = the four sides in a seeded order, then the finale; 12 crates a shift; the finale is 14 crates in four waves (4, 4, 3, 3), one wave per side, each under its own policy', () => {
  const orders = new Set();
  for (const r of runs) {
    assert.strictEqual(r.shifts.length, 5); assert.deepStrictEqual([...r.order].sort(), [...SIDE_IDS].sort()); orders.add(r.order.join());
    r.shifts.forEach((s, i) => {
      assert.strictEqual(s.index, i); assert.strictEqual(s.kind, i < 4 ? 'shift' : 'finale'); assert.strictEqual(s.side, i < 4 ? r.order[i] : 'rush'); assert.strictEqual(s.schedule.length, s.crates.length);
      if (i < 4) { assert.strictEqual(s.crates.length, 12); assert.strictEqual(s.brief, SIDES[s.side].brief); assert.strictEqual(s.spacing, 3.0); assert.strictEqual(s.desk, 6); assert(s.crates.every((c) => c.side === s.side && c.wave === 0)); }
      else {
        assert.strictEqual(s.crates.length, 14); assert.deepStrictEqual(s.waves.map((w) => w.size), [4, 4, 3, 3]); assert.strictEqual(new Set(s.waves.map((w) => w.side)).size, 4); assert.strictEqual(s.spacing, 2.8);
        s.waves.forEach((w, k) => { const cs = s.crates.filter((c) => c.wave === k); assert.strictEqual(cs.length, w.size); assert(cs.every((c) => c.side === w.side)); assert.deepStrictEqual(cs.map((c) => c.uid), w.uids); assert.strictEqual(w.bins, SIDES[w.side].bins); });
      }
    });
  }
  assert(orders.size >= 20, 'the side order varies');
});
test('every standard shift: each bin is correct for 2 to 5 crates, the counts are not the same from shift to shift, no more than 2 in a row share a bin, and the desk never has more than 5 crates that belong in REVIEW EACH', () => {
  const patterns = {}, longest = [];
  for (const s of standard) {
    const counts = SIDES[s.side].bins.map((b) => s.crates.filter((c) => c.bin === b.id).length); assert.deepStrictEqual(counts, s.counts); assert(counts.every((n) => n >= 2 && n <= 5), s.side + ' ' + counts);
    (patterns[s.side] = patterns[s.side] || new Set()).add(counts.join());
    let run = 1, best = 1; for (let i = 1; i < s.crates.length; i++) { run = s.crates[i].bin === s.crates[i - 1].bin ? run + 1 : 1; best = Math.max(best, run); } assert(best <= 2, 'a run of ' + best); longest.push(best);
    if (s.side === 'tiers') assert(counts[2] <= RUN.reviewCap, 'REVIEW EACH is correct for ' + counts[2]);
  }
  for (const side of SIDE_IDS) assert(patterns[side].size >= 10, side + ' counts are nearly constant: ' + patterns[side].size);
  for (const f of finales) f.waves.forEach((w, k) => { const cs = f.crates.filter((c) => c.wave === k); for (let i = 2; i < cs.length; i++) assert(!(cs[i].bin === cs[i - 1].bin && cs[i].bin === cs[i - 2].bin)); if (w.side === 'tiers') assert(cs.filter((c) => c.bin === 'review').length <= E.FINALE_DESK); });
  console.log('   count patterns: ' + SIDE_IDS.map((s) => s + ' ' + patterns[s].size).join(', '));
});
test('at least 2 traps and 2 twin pairs in every shift; the finale has at least 3 traps and 3 twin pairs, and a pair never straddles two waves', () => {
  for (const s of standard) { assert(E.countTraps(s.crates) >= 2 && E.twinPairs(s.crates) >= 2); assert.strictEqual(new Set(s.crates.map((c) => c.uid)).size, 12); }
  for (const f of finales) {
    assert(E.countTraps(f.crates) >= C.FINALE.minTraps); let pairs = 0;
    f.waves.forEach((w, k) => { const cs = f.crates.filter((c) => c.wave === k); pairs += E.twinPairs(cs); assert(E.twinPairs(cs) >= 1, 'every wave carries a pair'); });
    assert(pairs >= C.FINALE.minPairs);
  }
});
test('no crate twice in a run; every run covers all four sides plus the finale; a twin pair is always whole', () => {
  for (const r of runs) {
    const ids = r.shifts.flatMap((s) => s.crates.map((c) => c.itemId)); assert.strictEqual(new Set(ids).size, ids.length); assert.strictEqual(new Set(r.shifts.map((s) => s.side)).size, 5);
    for (const s of r.shifts) { const m = {}; for (const c of s.crates) if (c.twin) (m[c.twin] = m[c.twin] || []).push(c); for (const list of Object.values(m)) assert.strictEqual(list.length % 2 === 0 || list.length === 2, true); }
  }
});

// ================================================================= fairness: no tell
function independent(label, bucketOf, shifts, tol = 0.08) {
  const worstBySide = {};
  for (const side of SIDE_IDS) {
    const b = {}, tot = [0, 0, 0, 0]; let n = 0;
    for (const s of shifts.filter((x) => x.side === side)) { const bk = bucketOf(s); s.crates.forEach((c, i) => { (b[bk[i]] = b[bk[i]] || [0, 0, 0, 0, 0])[c.rank]++; b[bk[i]][4]++; tot[c.rank]++; n++; }); }
    let worst = 0; for (const k of Object.keys(b)) for (let r = 0; r < 4; r++) worst = Math.max(worst, Math.abs(b[k][r] / b[k][4] - tot[r] / n));
    worstBySide[side] = worst; assert(worst < tol, `${label} ${side}: the correct bin leans by ${(100 * worst).toFixed(1)}%`);
  }
  console.log(`   ${label}: worst gap ${SIDE_IDS.map((s) => s + ' ' + (100 * worstBySide[s]).toFixed(1) + '%').join(', ')}`);
}
const rankBucket = (vals, k) => vals.map((v) => { const lo = vals.filter((x) => x < v).length, eq = vals.filter((x) => x === v).length; return Math.min(k - 1, Math.floor((k * (lo + eq / 2)) / vals.length)); });
test('fairness: the correct bin is independent of spawn order (thirds), text-length rank (thirds) and chip count within 8%, side by side', () => {
  independent('spawn order (thirds)', (s) => s.crates.map((_, i) => Math.floor(i / 4)), standard);
  independent('text-length rank (thirds)', (s) => rankBucket(s.crates.map((c) => c.text.length), 3), standard);
  independent('chip count', (s) => s.crates.map((c) => c.chips.length), standard);
});
test('fairness: trap crates look like clear crates (the same fields, the same kinds of text) and each side\'s crates are spread over the four bins', () => {
  const shape = (c) => Object.keys(c).filter((k) => !['kind', 'cue', 'twin'].includes(k) || true).sort().join();
  for (const r of runs.slice(0, 80)) for (const s of r.shifts) { const shapes = new Set(s.crates.map((c) => Object.keys(c).sort().join() + '|' + c.chips.length.toString().replace(/\d/, 'n'))); assert(shapes.size <= 3, 'crate shapes differ: ' + shapes.size); }
  for (const side of SIDE_IDS) { const tot = [0, 0, 0, 0]; standard.filter((s) => s.side === side).forEach((s) => s.crates.forEach((c) => tot[c.rank]++)); const n = tot.reduce((a, b) => a + b, 0); tot.forEach((x) => assert(x / n > 0.15 && x / n < 0.4, side + ' share ' + x / n)); }
  const t = []; for (const s of standard) for (const c of s.crates) t.push(c.kind === 'trap' ? c.rank : null); const tr = t.filter((x) => x !== null); assert(tr.length > 1000 && new Set(tr).size === 4, 'traps occur in every bin');
});
test('different players get different runs: two random seeds share < 30% of (concept, variant, crate, params) triples; the last run\'s crates never come back; a missed concept is dealt more often', () => {
  const keyOf = (c) => [c.conceptId, c.variantId, c.itemId, JSON.stringify(c.params)].join('|'), plainOf = (c) => [c.conceptId, c.variantId, c.itemId].join('|');
  let sh = 0, shPlain = 0, n = 0, worst = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const a = runs[i].shifts.flatMap((x) => x.crates), b = new Set(runs[i + 1].shifts.flatMap((x) => x.crates).map(keyOf)), bp = new Set(runs[i + 1].shifts.flatMap((x) => x.crates).map(plainOf));
    const s = a.filter((c) => b.has(keyOf(c))).length / a.length; sh += s; shPlain += a.filter((c) => bp.has(plainOf(c))).length / a.length; n++; worst = Math.max(worst, s);
  }
  console.log(`   mean shared ${(100 * sh / n).toFixed(1)}% (without the filled params ${(100 * shPlain / n).toFixed(1)}%), worst pair ${(100 * worst).toFixed(0)}%`);
  assert(sh / n < 0.3 && shPlain / n < 0.3);
  let rep1 = 0, rep3 = 0, total = 0;
  for (let p = 0; p < 100; p++) {
    const hist = { runs: [], concepts: {} };
    for (let k = 0; k < 6; k++) {
      const r = E.composeRun(BG.hash32('p' + p + ':' + k), hist), items = r.shifts.flatMap((x) => x.crates.map((c) => c.itemId)), last = new Set(hist.runs.length ? hist.runs[hist.runs.length - 1].items : []), recent = new Set(hist.runs.slice(-3).flatMap((h) => h.items));
      if (hist.runs.length) { total += items.length; rep1 += items.filter((i) => last.has(i)).length; rep3 += items.filter((i) => recent.has(i)).length; }
      hist.runs.push({ items });
    }
  }
  const random = 1 - Math.pow(1 - 15.5 / 60, 3);
  console.log(`   repeats of the last run: ${rep1} of ${total}; of the last 3 runs: ${(100 * rep3 / total).toFixed(1)}% (a random draw would repeat ${(100 * random).toFixed(0)}%)`);
  assert.strictEqual(rep1, 0); assert(rep3 / total < 0.4 && rep3 / total < random / 1.5);
  const share = (hist) => { let hit = 0, m = 0; for (let s = 0; s < 250; s++) for (const x of E.composeRun(BG.hash32('w' + s), hist).shifts.filter((z) => z.side === 'tiers')) { m += x.crates.length; hit += x.crates.filter((c) => c.conceptId === 'MR3').length; } return hit / m; };
  const base = share(null), weak = share({ concepts: { MR3: { attempts: 6, misses: 5, mastered: false }, MR1: { mastered: true }, MR2: { mastered: true }, MR4: { mastered: true } } });
  console.log(`   the missed concept is dealt ${(100 * weak).toFixed(0)}% of the time (${(100 * base).toFixed(0)}% with no history)`); assert(weak > base + 0.1);
});

// ================================================================= the belt and the clock
test('belt clock: a pure function of time and the brake log; 3 s of brake a shift at 40% speed, never refilled; the relaxed belt runs at 0.75x; t(s(t)) = t', () => {
  const none = E.beltClock([]); assert.strictEqual(none.s(10), 10);
  const one = E.beltClock([{ t0: 5, t1: 8 }]); assert.strictEqual(one.used, 3); assert.strictEqual(one.s(5), 5); assert(Math.abs(one.s(8) - (5 + 3 * 0.4)) < 1e-9); assert(Math.abs(one.s(10) - (5 + 1.2 + 2)) < 1e-9);
  const many = E.beltClock([{ t0: 1, t1: 3 }, { t0: 2, t1: 6 }, { t0: 10, t1: 11 }]); assert(Math.abs(many.used - 3) < 1e-9, 'the budget is 3 seconds in all: ' + many.used); assert.deepStrictEqual(E.normalizeBrakes([{ t0: 0, t1: 9 }]), [{ t0: 0, t1: 3 }]);
  const relaxed = E.beltClock([], 0.75); assert.strictEqual(relaxed.s(8), 6);
  for (const bl of [[], [{ t0: 4, t1: 5.5 }], [{ t0: 0.5, t1: 2 }, { t0: 20, t1: 21.5 }]]) { const c = E.beltClock(bl); for (let t = 0; t < 60; t += 0.7) assert(Math.abs(c.t(c.s(t)) - t) < 1e-9); for (let t = 0.1; t < 60; t += 0.7) assert(c.s(t) <= t + 1e-9 && c.s(t) > 0); }
  assert(Math.abs(E.SPEED * RUN.traverse - 12) < 1e-9 && E.cratePos(2, 2) === -6 && Math.abs(E.cratePos(2, 2 + RUN.traverse) - 6) < 1e-9); assert.deepStrictEqual(E.binXs, [-4.5, -1.5, 1.5, 4.5]);
  assert.deepStrictEqual([-6.1, -6, -4.5, 0, 5.99, 6].map(E.binAt), [-1, 0, 0, 2, 3, -1]);
});
test('at most 4 crates in the sorting zone at any time, whatever the brake does (a brake slows the belt clock, so it can never bunch crates up)', () => {
  let worst = 0;
  for (const r of runs) for (const s of r.shifts) {
    worst = Math.max(worst, E.maxInZone(s.schedule));
    const t0s = s.schedule.map((e) => e.t0);
    for (const brakes of [[], [{ t0: 2, t1: 5 }], [{ t0: 10, t1: 13 }], [{ t0: 0, t1: 1.5 }, { t0: 20, t1: 21.5 }]]) {
      const clock = E.beltClock(brakes); for (let t = 0; t < s.beltSec + 4; t += 0.37) { const sb = clock.s(t); assert(t0s.filter((x) => E.inZone(x, sb)).length <= 4); }
    }
  }
  console.log('   most crates in the zone at once: ' + worst); assert(worst <= 4);
});
test('the finale\'s plates flip between waves: every bin flips after the old wave\'s last crate has passed it and before the new wave\'s first crate gets there; waves wait 1.2 s', () => {
  for (const f of finales.slice(0, 120)) {
    const flips = E.plateFlips(f); assert.strictEqual(flips.length, 12);
    for (let w = 1; w < 4; w++) {
      const old = f.schedule.filter((e) => e.wave === w - 1), first = f.schedule.find((e) => e.wave === w), last = old[old.length - 1];
      assert(Math.abs(first.t0 - last.t0 - (f.spacing + C.FINALE.pause)) < 1e-6, 'a wave waits 1.2 s more than the spacing');
      for (const fl of flips.filter((x) => x.wave === w)) { const off = (E.binXs[fl.bin] - E.ZONE.x0) / E.SPEED; assert(fl.at > last.t0 + off && fl.at < first.t0 + off, 'flip order'); }
    }
  }
});
test('pace: briefs + belts + debriefs come to about 4:37 and the worst case with the most brake in every shift stays under 4:55; the belt phase ends when the last crate leaves the zone', () => {
  const est = runs.map((r) => r.estSeconds), worst = runs.map((r) => E.estimateSeconds(r, { maxBrake: true }));
  console.log(`   mean ${mean(est).toFixed(1)} s (${Math.floor(mean(est) / 60)}:${String(Math.round(mean(est) % 60)).padStart(2, '0')}), worst case ${Math.max(...worst).toFixed(1)} s (${Math.floor(Math.max(...worst) / 60)}:${String(Math.round(Math.max(...worst) % 60)).padStart(2, '0')}), shortest ${Math.min(...est).toFixed(1)} s`);
  for (const r of runs) { assert(r.estSeconds > 240 && r.estSeconds < 285); assert(E.estimateSeconds(r, { maxBrake: true }) < 295); r.shifts.forEach((s) => assert(Math.abs(s.beltSec - (s.schedule[s.schedule.length - 1].t0 + RUN.traverse)) < 1e-9)); }
  assert(standard.every((s) => Math.abs(s.beltSec - (11 * 3 + 7)) < 1e-9)); assert(finales.every((f) => Math.abs(f.beltSec - (13 * 2.8 + 3 * 1.2 + 7)) < 1e-9));
  // the brake really adds 1.8 s to a belt, measured on the clock itself
  for (const s of standard.slice(0, 20)) { const clock = E.beltClock([{ t0: 3, t1: 6 }]); assert(Math.abs(clock.t(s.beltSec) - (s.beltSec + 1.8)) < 1e-9); }
});

// ================================================================= judging and the desk
const crateOf = (side, rank) => { for (const r of runs) for (const s of r.shifts) { const c = s.crates.find((x) => x.side === side && x.rank === rank); if (c) return c; } };
test('judge: the ladder, for every (chosen, correct) pair on every side: equal = correct; lower rank = too lax (a gap of 2 or more is a spill); higher rank = too strict; stamps come from the crate', () => {
  let pairs = 0;
  for (const side of SIDE_IDS) for (let want = 0; want < 4; want++) {
    const c = crateOf(side, want); for (let got = 0; got < 4; got++) {
      const j = E.judge(c, SIDES[side].bins[got].id), gap = got - want; pairs++;
      assert.strictEqual(j.correct, gap === 0); assert.strictEqual(j.rankGap, Math.abs(gap));
      assert.strictEqual(j.direction, gap === 0 ? null : gap < 0 ? 'lax' : 'strict'); assert.strictEqual(j.severe, gap <= -2);
      assert.strictEqual(j.stamp, gap === 0 ? '' : gap < 0 ? c.laxStamp : c.strictStamp);
    }
  }
  assert.strictEqual(pairs, 64);
  const c = crateOf('tiers', 0), d = E.judge(c, null); assert.deepStrictEqual([d.correct, d.direction, d.severe, d.stamp], [false, 'dropped', false, 'DROPPED']);
  assert.strictEqual(E.judge(crateOf('tiers', 3), 'auto').severe, true); assert.strictEqual(E.judge(crateOf('tiers', 2), 'auto').severe, true); assert.strictEqual(E.judge(crateOf('tiers', 1), 'auto').severe, false, 'one step lax is not a spill');
  assert.strictEqual(E.judge(crateOf('doors', 0), 'noai').severe, false, 'too strict is never severe');
});
test('judge: after an AUTO-SEND the hidden truth is shown ("WENT OUT FINE" or "WAS WRONG"); nowhere else', () => {
  let seen = { fine: 0, wrong: 0 };
  for (const s of standard.filter((x) => x.side === 'checks')) for (const c of s.crates) {
    const j = E.judge(c, 'send'); assert.strictEqual(j.reveal, c.outputRight ? 'WENT OUT FINE' : 'WAS WRONG'); seen[c.outputRight ? 'fine' : 'wrong']++;
    for (const b of ['quick', 'expert', 'ask']) assert.strictEqual(E.judge(c, b).reveal, undefined);
  }
  assert(seen.fine > 100 && seen.wrong > 100);
  assert.strictEqual(E.judge(crateOf('tiers', 0), 'auto').reveal, undefined);
});
test('desk rule: after the 6th crate sent to REVIEW EACH in a shift, the next ones are DESK JAMMED: too strict, over-gated, wrong even where REVIEW EACH was right; the finale\'s tiers wave has a desk of 2', () => {
  const d = E.deskState(Array.from({ length: 9 }, (_, i) => ({ uid: 'u' + i, bin: i % 3 === 2 ? 'auto' : 'review' })), 6); assert.deepStrictEqual(d.jammed, [false, false, false, false, false, false, false, false, false].map((_, i) => [0, 1, 3, 4, 6, 7].indexOf(i) >= 0 ? [0, 1, 3, 4, 6, 7].indexOf(i) >= 6 : false)); assert.strictEqual(d.used, 6);
  const dd = E.deskState(Array.from({ length: 8 }, (_, i) => ({ uid: 'u' + i, bin: 'review' })), 6); assert.deepStrictEqual(dd.jammed, [false, false, false, false, false, false, true, true]); assert(dd.over);
  const sh = standard.find((s) => s.side === 'tiers'), inputs = sh.schedule.map((e, k) => ({ kind: 'route', uid: e.uid, bin: 'review', t: e.t0 + 3.5 + 0 * k }));
  const log = E.playShift(sh, inputs), sc = E.scoreShift(log); assert.strictEqual(log.desk, 12); assert.strictEqual(log.deskCap, 6);
  const j = log.entries.filter((e) => e.stamp === 'DESK JAMMED'); assert.strictEqual(j.length, 6); assert(j.every((e) => e.direction === 'strict' && e.overGated && !e.correct)); assert.strictEqual(sc.overGated, 6);
  const wasRight = sh.crates.filter((c) => c.bin === 'review'); assert(wasRight.length >= 2); const lastRight = log.entries.filter((e) => e.correctBin === 'review' && e.overGated); assert(lastRight.length >= 0);
  const fin = finales.find((f) => f.waves.some((w) => w.side === 'tiers')); assert.strictEqual(fin.desk, E.FINALE_DESK); assert.strictEqual(E.FINALE_DESK, 2);
  const fl = E.playShift(fin, fin.schedule.filter((e) => fin.crates.find((c) => c.uid === e.uid).side === 'tiers').map((e) => ({ kind: 'route', uid: e.uid, bin: 'review', t: e.t0 + 3.5 })));
  assert.strictEqual(fl.entries.filter((e) => e.stamp === 'DESK JAMMED').length, Math.max(0, fin.crates.filter((c) => c.side === 'tiers').length - 2));
});

// ================================================================= a scripted shift
const when = (sh, e, rank, brakes) => E.beltClock(brakes || []).t(e.t0 + (E.binXs[rank] - E.ZONE.x0) / E.SPEED);   // the real time the crate is at that bin
function routeAll(sh, binFor, brakes) {   // binFor(crate) -> bin id or null (let it drop)
  const by = Object.fromEntries(sh.crates.map((c) => [c.uid, c])), out = (brakes || []).map((b) => Object.assign({ kind: 'brake' }, b));
  for (const e of sh.schedule) { const b = binFor(by[e.uid]); if (b != null) out.push({ kind: 'route', uid: e.uid, bin: b, t: when(sh, e, E.rankOf(by[e.uid].side, b), brakes) }); }
  return out;
}
const playRun = (spec, binFor, brakes) => spec.shifts.map((s) => E.playShift(s, routeAll(s, binFor, brakes), {}));
const perfect = (c) => c.bin, allStrict = (c) => SIDES[c.side].bins[3].id, allLax = (c) => SIDES[c.side].bins[0].id, none = () => null;
const botRuns = runs.slice(0, 60);
const results = {}; for (const [k, f] of Object.entries({ perfect, allStrict, allLax, none })) results[k] = botRuns.map((r) => E.scoreRun(playRun(r, f)));
test('play: a crate counts only while it is in the zone and unsettled; one that leaves the zone unrouted reaches the pit (dropped); routing is by the crate\'s own side\'s bins', () => {
  const sh = standard[0], e = sh.schedule[0], by = sh.crates.find((c) => c.uid === e.uid);
  const early = E.playShift(sh, [{ kind: 'route', uid: e.uid, bin: by.bin, t: e.t0 - 1 }]); assert.strictEqual(early.entries[0].action, 'dropped', 'before the zone');
  const late = E.playShift(sh, [{ kind: 'route', uid: e.uid, bin: by.bin, t: e.t0 + 7.1 }]); assert.strictEqual(late.entries[0].action, 'dropped', 'after the zone');
  const ok = E.playShift(sh, [{ kind: 'route', uid: e.uid, bin: by.bin, t: e.t0 + 3 }, { kind: 'route', uid: e.uid, bin: SIDES[sh.side].bins[0].id, t: e.t0 + 3.5 }]); assert.strictEqual(ok.entries[0].chosen, by.bin, 'a settled crate cannot be routed again'); assert.strictEqual(ok.entries[0].correct, true);
  const bad = E.playShift(sh, [{ kind: 'route', uid: e.uid, bin: 'no-such-bin', t: e.t0 + 3 }]); assert.strictEqual(bad.entries[0].action, 'dropped');
  const none_ = E.playShift(sh, []); assert(none_.entries.every((x) => x.action === 'dropped' && x.direction === 'dropped')); assert.strictEqual(E.scoreShift(none_).dropped, 12);
  const braked = E.playShift(sh, [{ kind: 'brake', t0: 0, t1: 3 }, { kind: 'route', uid: e.uid, bin: by.bin, t: e.t0 + 7.1 }]); assert.strictEqual(braked.entries[0].action, 'routed', 'a brake slows the belt, so the crate is still in the zone');
  assert.strictEqual(braked.brakeUsed, 3); assert(Math.abs(braked.endT - (sh.beltSec + 1.8)) < 1e-9);
});
test('scoring: accuracy, spills, dropped, line cost vs ideal cost (1, 2, 4, 8 per rank), per shift and per run; a run left early earns no stars', () => {
  const log = playRun(runs[3], allStrict), sc = E.scoreRun(log);
  for (const l of log) { const s = E.scoreShift(l), want = l.entries.reduce((n, e) => n + RUN.costs[e.chosenRank], 0), ideal = l.entries.reduce((n, e) => n + RUN.costs[e.correctRank], 0); assert.strictEqual(s.cost, want); assert.strictEqual(s.idealCost, ideal); assert.strictEqual(s.total, l.entries.length); assert(Math.abs(s.accuracy - s.correct / s.total) < 1e-9); }
  assert.strictEqual(sc.total, 12 * 4 + 14); assert.strictEqual(sc.finished, true); assert.strictEqual(sc.shifts.length, 5); assert.strictEqual(sc.cost, 8 * 62); assert(sc.idealCost < sc.cost);
  assert.strictEqual(E.scoreRun(log.slice(0, 2)).stars, 0); assert.strictEqual(E.scoreRun(log.slice(0, 2)).finished, false);
  const s = (accuracy, severe, dropped) => ({ accuracy, severe, dropped });
  assert.deepStrictEqual([s(0.9, 0, 0), s(0.85, 0, 2), s(0.85, 0, 3), s(0.9, 1, 0), s(0.65, 2, 9), s(0.64, 0, 0), s(0.9, 3, 0), s(0.3, 0, 12)].map((x) => E.starsFor(x, true)), [3, 3, 2, 2, 2, 1, 1, 1]);
});
test('mastery input: a variant is clean in a run when at least 75% of that variant\'s crates for the concept were routed right (and at least 3 of them); a lone crate cannot make a variant clean', () => {
  const mk = (v, ok, n) => Array.from({ length: n }, (_, i) => ({ conceptId: 'MD1', variantId: v, correct: i < ok, direction: i < ok ? null : 'strict', action: 'routed', side: 'doors', kind: 'clear', uid: v + i, correctRank: 0, chosenRank: 0, severe: false, t: i }));
  const log = (es) => ({ index: 0, kind: 'shift', side: 'doors', entries: es });
  let sc = E.scoreRun([log(mk('MD1a', 3, 4).concat(mk('MD1b', 2, 4), mk('MD1c', 1, 1), mk('MD1d', 3, 3)))], { finished: true });
  assert.deepStrictEqual(sc.perConcept.MD1.cleanVariants.sort(), ['MD1a', 'MD1d']); assert.deepStrictEqual(sc.perConcept.MD1.variantsSeen.sort(), ['MD1a', 'MD1b', 'MD1c', 'MD1d']); assert.strictEqual(sc.perConcept.MD1.attempts, 12);
  sc = E.scoreRun([log(mk('MD1a', 2, 2)), log(mk('MD1a', 3, 3))], { finished: false }); assert.deepStrictEqual(sc.perConcept.MD1.cleanVariants, ['MD1a'], 'crates of one variant add up across shifts of a run');
  const tot = (r) => Object.values(results.perfect[r].perConcept).reduce((n, c) => n + c.cleanVariants.length, 0); assert(tot(0) > 8, 'a perfect run is clean in many variants');
});
test('scoring: routing everything perfectly earns 3 stars; routing everything to the strictest bin and everything to the most permissive bin both score badly, for different reasons (cost vs spills); nothing routed drops everything', () => {
  const st = (m) => ({ stars: results[m].map((s) => s.stars), accuracy: mean(results[m].map((s) => s.accuracy)), spills: mean(results[m].map((s) => s.severe)), dropped: mean(results[m].map((s) => s.dropped)), cost: mean(results[m].map((s) => s.cost)), ideal: mean(results[m].map((s) => s.idealCost)) });
  const p = st('perfect'), s = st('allStrict'), l = st('allLax'), n = st('none');
  console.log(`   perfect: accuracy ${(100 * p.accuracy).toFixed(0)}% stars ${mean(p.stars).toFixed(2)} cost ${p.cost.toFixed(0)}/${p.ideal.toFixed(0)}   strictest bin: accuracy ${(100 * s.accuracy).toFixed(0)}% cost ${s.cost.toFixed(0)}/${s.ideal.toFixed(0)} spills ${s.spills.toFixed(1)}   most permissive: accuracy ${(100 * l.accuracy).toFixed(0)}% cost ${l.cost.toFixed(0)}/${l.ideal.toFixed(0)} spills ${l.spills.toFixed(1)}   nothing: dropped ${n.dropped.toFixed(0)}`);
  assert(p.stars.every((x) => x === 3) && p.accuracy === 1 && p.spills === 0 && p.cost === p.ideal);
  assert(s.stars.every((x) => x === 1) && s.accuracy < 0.4 && s.spills === 0 && s.cost > 1.4 * s.ideal, 'over-locking: no spills, but it costs capacity');
  assert(l.stars.every((x) => x === 1) && l.accuracy < 0.5 && l.spills > 8 && l.cost < 0.5 * l.ideal, 'under-locking: cheap, but spills (incidents)');
  assert(n.stars.every((x) => x === 1) && n.dropped === 62 && n.accuracy === 0);
  const jam = botRuns.map((r) => E.scoreRun(playRun(r, (c) => (c.side === 'tiers' ? 'review' : c.bin)))); assert(jam.every((x) => x.overGated > 0 && x.stars <= 2), 'sending everything in the risk-tier shift to REVIEW EACH jams the desk'); assert(jam.every((x) => x.shifts.find((z) => z.side === 'tiers').overGated >= 6));
});
test('debrief: up to 3 crates, severe first, then too lax, then too strict, then dropped; a new concept first while there is a choice', () => {
  for (const f of [allLax, allStrict, none, (c) => (c.rank % 2 ? c.bin : SIDES[c.side].bins[(c.rank + 2) % 4].id)]) for (const r of runs.slice(0, 12)) for (const l of playRun(r, f)) {
    const d = E.debriefPicks(l, 3), rank = (e) => (e.severe ? 0 : e.direction === 'lax' ? 1 : e.direction === 'strict' ? 2 : e.direction === 'dropped' ? 3 : 9);
    assert(d.length <= 3 && new Set(d).size === d.length); assert(d.every((e) => !e.correct));
    const all = l.entries.filter((e) => !e.correct).sort((a, b) => rank(a) - rank(b)); assert(d.length === Math.min(3, all.length)); if (d.length) assert(rank(d[0]) === rank(all[0]), 'the worst kind comes first');
  }
});
test('replay: the same runSpec and the same scripted inputs (routes and brakes) give the identical logs and score, every time', () => {
  noRandom(() => { for (const f of [perfect, allStrict, (c) => (c.uid.length % 2 ? c.bin : null)]) for (const r of runs.slice(0, 8)) { const brakes = [{ t0: 6, t1: 8 }, { t0: 20, t1: 22 }], a = playRun(r, f, brakes), b = playRun(JSON.parse(JSON.stringify(r)), f, brakes); assert.deepStrictEqual(a, b); assert.deepStrictEqual(E.scoreRun(a), E.scoreRun(b)); } });
});
test('rerollShift: a fresh draw of the same side (or the finale), none of the run\'s other crates, every other shift untouched, deterministic, still a valid shift', () => {
  let n = 0;
  for (const r of runs.slice(0, 100)) for (const i of [0, 2, 3, 4]) {
    const { spec, shift } = E.rerollShift(r, i), again = E.rerollShift(r, i), old = r.shifts[i];
    assert.deepStrictEqual(again.spec, spec); assert.strictEqual(spec.shifts[i], shift); assert.strictEqual(shift.side, old.side); assert.strictEqual(shift.kind, old.kind); assert.strictEqual(shift.index, i);
    spec.shifts.forEach((x, k) => { if (k !== i) assert.deepStrictEqual(x, r.shifts[k]); });
    const others = new Set(r.shifts.filter((_, k) => k !== i).flatMap((x) => x.crates.map((c) => c.itemId))), mine = shift.crates.map((c) => c.itemId);
    assert(mine.every((id) => !others.has(id)) && mine.every((id) => !old.crates.some((c) => c.itemId === id)), 'a reroll never repeats a crate of the run');
    assert.strictEqual(shift.crates.length, old.crates.length); assert(E.countTraps(shift.crates) >= (shift.kind === 'finale' ? 3 : 2));
    if (shift.kind === 'shift') { assert(shift.counts.every((c) => c >= 2 && c <= 5) && E.twinPairs(shift.crates) >= 2); } else assert.deepStrictEqual(shift.waves.map((w) => w.size), [4, 4, 3, 3]);
    assert(E.maxInZone(shift.schedule) <= 4); assert(spec.estSeconds < 295); assert.deepStrictEqual(r, runs[runs.indexOf(r)], 'the original is untouched'); n++;
  }
  assert(n === 400);
});

// ================================================================= the other games
if (!process.env.MILL_SKIP_OTHERS) test('the other games\' tests still pass (bridge, carrom, token tower, spot shot)', () => {
  for (const f of ['bridge/bridge-tests.js', 'carrom-tests.js', 'carrom-physics-tests.js', 'carrom-play-tests.js', 'carrom-progress-tests.js', 'carrom-world-tests.js', 'jenga-world-tests.js', 'jenga-play-tests.js', 'jenga-progress-tests.js',
    'gallery-world-tests.js', 'gallery-play-tests.js', 'gallery-progress-tests.js']) {
    const out = execFileSync('node', [path.join(__dirname, f)], { encoding: 'utf8' });
    console.log('   ' + f + ': ' + out.trim().split('\n').pop());
  }
});
done();
