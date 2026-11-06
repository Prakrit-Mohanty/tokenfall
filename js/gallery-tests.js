// Self-test for Spot Shot: the bank, the run generator, the schedule, the hit test, judging, scoring and the replay. Run: node js/gallery-tests.js
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { test, done, mean } = require('./test-kit.js');
const E = require('./gallery-engine.js');
const BG = require('./bridge-generator.js');
const C = require('./gallery-content.js');
const { LIMITS, CONCEPTS, SIDE_IDS } = C;

const N = 500;
const noRandom = (fn) => { const r = Math.random; Math.random = () => { throw new Error('Math.random is not allowed here'); }; try { return fn(); } finally { Math.random = r; } };
const runs = Array.from({ length: N }, (_, i) => E.composeRun(BG.hash32('seed' + i), null));
const allRounds = runs.flatMap((r) => r.rounds), sideRounds = allRounds.filter((r) => r.kind === 'side');
function* combos(params) { let acc = [{}]; for (const k of Object.keys(params)) { const n = []; for (const a of acc) for (const v of params[k]) n.push(Object.assign({}, a, { [k]: v })); acc = n; } yield* acc; }

// ================================================================= the bank
test('content: 4 sides x 4 concepts, 4+ variants and 16+ cards per side, every variant two twin pairs (2 threats, 2 legit), ids that cannot collide with the other games', () => {
  const bridge = require('./bridge-content.js'), carrom = require('./carrom-content.js'), jenga = require('./jenga-content.js'), ids = new Set(), other = new Set([bridge, carrom, jenga].flatMap((m) => m.CARDS.map((c) => c.id)));
  for (const side of SIDE_IDS) {
    const cs = CONCEPTS.filter((c) => c.side === side), vs = cs.flatMap((c) => c.variants);
    assert.strictEqual(cs.length, 4, side); assert(vs.length >= LIMITS.minVariants && vs.length * 4 >= LIMITS.minItems * 3, side);
    assert(vs.flatMap((v) => v.items).length >= LIMITS.minItems);
    for (const c of cs) { assert(!other.has(c.id) && c.id.startsWith('X') && c.idea && c.title && c.variants.length >= 2, c.id); assert(!ids.has(c.id)); ids.add(c.id); }
    for (const v of vs) {
      assert(!ids.has(v.id)); ids.add(v.id); assert.strictEqual(v.items.length, 4, v.id); assert.strictEqual(v.items.filter((i) => i.shoot).length, 2, v.id);
      assert(E.twinPairs(v.items.map((i) => ({ twin: i.cue, shoot: i.shoot }))) >= LIMITS.minPairs, v.id + ' needs 2 twin pairs');
      for (const i of v.items) { assert(!ids.has(i.id)); ids.add(i.id); }
    }
  }
});
test('content: string limits hold over every param fill (card <= 140, inspect <= 90, stamp <= 18, brief <= 20 words), nothing is left unfilled, every trap has an inspect line, only .example domains', () => {
  let n = 0;
  for (const c of CONCEPTS) for (const v of c.variants) {
    assert(v.brief.trim().split(/\s+/).length <= LIMITS.briefWords, v.id + ' brief');
    const used = new Set();
    for (const it of v.items) {
      assert(it.inspect && it.stamp && it.tell && (it.shoot ? it.leak : it.friendly) && it.cue && ['clear', 'trap'].includes(it.kind), it.id);
      for (const m of JSON.stringify(it).matchAll(/\{(\w+)\}/g)) { assert(v.params[m[1]], it.id + ' unknown param ' + m[1]); used.add(m[1]); }
      assert(!/https?:|www\.|[\w-]+\.(com|org|net|io|co|in)\b/i.test(JSON.stringify(it)), it.id + ' real-looking domain');
      for (const p of combos(v.params)) {
        const e = C.expand(it, p); n++;
        assert(e.card.body.length <= LIMITS.body && e.inspect.length <= LIMITS.inspect && e.stamp.length <= LIMITS.stamp, `${it.id} ${e.stamp} ${e.card.body.length}`);
        assert(!/\{\w+\}/.test(JSON.stringify(e)), it.id + ' unfilled');
      }
    }
    for (const k of Object.keys(v.params)) assert(used.has(k), v.id + ' unused param ' + k);
  }
  console.log(`   ${n} filled cards checked`);
});

// ================================================================= the generator
test('composeRun: deterministic (no Math.random), the runSpec is plain JSON, a different seed gives a different run', () => {
  noRandom(() => { for (const s of [1, 2, 3, 99]) { const a = E.composeRun(s, null), b = E.composeRun(s, null); assert.deepStrictEqual(a, b); assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), a); } });
  assert.notDeepStrictEqual(E.composeRun(1, null), E.composeRun(2, null));
  assert.strictEqual(E.seedFor('p-1', 0), E.seedFor('p-1', 0)); assert.notStrictEqual(E.seedFor('p-1', 0), E.seedFor('p-2', 0)); assert.notStrictEqual(E.seedFor('p-1', 0), BG.seedFor('p-1', 0));
});
test('shape: 5 rounds = the four sides in a seeded order, then the finale; 10 cards a round (12 in the finale), ammo = threats + 2, 5 magnifier charges', () => {
  const orders = new Set();
  for (const r of runs) {
    assert.strictEqual(r.rounds.length, 5); assert.deepStrictEqual([...r.order].sort(), [...SIDE_IDS].sort()); orders.add(r.order.join());
    r.rounds.forEach((x, i) => {
      assert.strictEqual(x.index, i); assert.strictEqual(x.kind, i < 4 ? 'side' : 'finale'); assert.strictEqual(x.side, i < 4 ? r.order[i] : 'rush');
      assert.strictEqual(x.items.length, i < 4 ? 10 : 12); assert.strictEqual(x.schedule.length, x.items.length);
      assert.strictEqual(x.ammo, x.items.filter((c) => c.shoot).length + 2, 'ammo is threats + 2');
      if (i < 4) { assert.strictEqual(x.brief, C.SIDES[x.side].brief); assert(x.items.every((c) => c.side === x.side)); } else { assert.strictEqual(x.brief, null); assert.deepStrictEqual(x.banner, C.FINALE.banner); }
    });
    assert.strictEqual(r.magnifier, 5);
  }
  assert(orders.size >= 20, 'the side order varies');
});
test('every round: threat ratio in [0.35, 0.65] and not constant; at least 2 traps and 2 twin pairs (finale: 3 traps, 3 pairs, 2+ cards from each side)', () => {
  const ratios = new Set(), perRun = new Set();
  for (const r of runs) {
    perRun.add(r.rounds.slice(0, 4).map((x) => x.threats).join());
    for (const x of r.rounds) {
      const k = x.threats / x.items.length; assert(k >= 0.35 && k <= 0.65, 'ratio ' + k); ratios.add(x.kind + x.threats);
      if (x.kind === 'side') { assert(E.countTraps(x.items) >= 2 && E.twinPairs(x.items) >= 2); }
      else { assert(E.countTraps(x.items) >= C.FINALE.minTraps && E.twinPairs(x.items) >= C.FINALE.minPairs); for (const s of SIDE_IDS) assert(x.items.filter((c) => c.side === s).length >= C.FINALE.minPerSide, 'finale side ' + s); }
    }
  }
  console.log('   threat counts seen: ' + [...ratios].sort().join(' ') + '; ' + perRun.size + ' different threat patterns across runs');
  assert(ratios.size >= 5 && perRun.size > 20);
});
test('no card twice in a run; every run covers all four sides plus the finale', () => {
  for (const r of runs) { const ids = r.rounds.flatMap((x) => x.items.map((c) => c.itemId)); assert.strictEqual(new Set(ids).size, ids.length); assert.strictEqual(new Set(r.rounds.map((x) => x.side)).size, 5); }
});
test('different players get different runs: two random seeds share < 30% of (concept, variant, card, params) triples', () => {
  const keyOf = (c) => [c.conceptId, c.variantId, c.itemId, JSON.stringify(c.params)].join('|'), plainOf = (c) => [c.conceptId, c.variantId, c.itemId].join('|');
  let sh = 0, shPlain = 0, n = 0, worst = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const a = runs[i].rounds.flatMap((x) => x.items), b = new Set(runs[i + 1].rounds.flatMap((x) => x.items).map(keyOf)), bp = new Set(runs[i + 1].rounds.flatMap((x) => x.items).map(plainOf));
    const s = a.filter((c) => b.has(keyOf(c))).length / a.length; sh += s; shPlain += a.filter((c) => bp.has(plainOf(c))).length / a.length; n++; worst = Math.max(worst, s);
  }
  console.log(`   mean shared ${(100 * sh / n).toFixed(1)}% (without the filled params ${(100 * shPlain / n).toFixed(1)}%), worst pair ${(100 * worst).toFixed(0)}%`);
  assert(sh / n < 0.3 && shPlain / n < 0.3);
});
test('anti-repeat: never a card from the player\'s last run; cards of the last 3 runs return only when the bank runs out (a 48-card side cannot avoid 3 runs of 13); a missed concept comes back more often', () => {
  let rep1 = 0, rep3 = 0, total = 0, chains = 0;
  for (let p = 0; p < 150; p++) {
    const hist = { runs: [], concepts: {} };
    for (let k = 0; k < 6; k++) {
      const r = E.composeRun(BG.hash32('p' + p + ':' + k), hist), items = r.rounds.flatMap((x) => x.items.map((c) => c.itemId)), last = new Set(hist.runs.length ? hist.runs[hist.runs.length - 1].items : []);
      const recent = new Set(hist.runs.slice(-3).flatMap((h) => h.items));
      if (hist.runs.length) { total += items.length; rep1 += items.filter((i) => last.has(i)).length; rep3 += items.filter((i) => recent.has(i)).length; chains++; }
      hist.runs.push({ items });
    }
  }
  console.log(`   repeats of the last run: ${rep1} of ${total}; of the last 3 runs: ${(100 * rep3 / total).toFixed(1)}%`);
  const random = 1 - (1 - 13 / 48) * (1 - 13 / 48) * (1 - 13 / 48);   // what a draw that ignored the history would repeat
  console.log(`   a random draw would repeat ${(100 * random).toFixed(0)}%`);
  assert.strictEqual(rep1, 0); assert(rep3 / total < 0.45 && rep3 / total < random / 1.5);
  const share = (hist) => { let hit = 0, n = 0; for (let s = 0; s < 300; s++) for (const x of E.composeRun(BG.hash32('w' + s), hist).rounds.filter((r) => r.side === 'claims')) { n += x.items.length; hit += x.items.filter((c) => c.conceptId === 'XC3').length; } return hit / n; };
  const base = share(null), weak = share({ concepts: { XC3: { attempts: 6, misses: 5, mastered: false }, XC1: { mastered: true }, XC2: { mastered: true }, XC4: { mastered: true } } });
  console.log(`   the missed concept is dealt ${(100 * weak).toFixed(0)}% of the time (${(100 * base).toFixed(0)}% with no history)`);
  assert(weak > base + 0.1);
});

// ================================================================= fairness: no tell
function independent(label, bucketOf, tol = 0.08) {
  const b = {}; let t = 0, n = 0;
  for (const r of allRounds) { const bs = bucketOf(r); r.items.forEach((c, i) => { const k = bs[i]; (b[k] = b[k] || { n: 0, t: 0 }).n++; b[k].t += c.shoot ? 1 : 0; n++; t += c.shoot ? 1 : 0; }); }
  const overall = t / n, ks = Object.keys(b).sort();
  console.log(`   ${label}: ${ks.map((k) => k + ' ' + (100 * b[k].t / b[k].n).toFixed(1) + '%').join('  ')}  (overall ${(100 * overall).toFixed(1)}%)`);
  for (const k of ks) assert(Math.abs(b[k].t / b[k].n - overall) < tol, `${label} ${k} tells the label`);
}
const rankBucket = (vals) => vals.map((v) => { const lo = vals.filter((x) => x < v).length, eq = vals.filter((x) => x === v).length; return Math.min(3, Math.floor(4 * (lo + eq / 2) / vals.length)); });
test('fairness: whether a card is a threat is independent of its lane, direction, speed, spawn time, popup flag and text length (within 8%)', () => {
  independent('lane', (r) => r.schedule.map((e) => e.lane));
  independent('direction', (r) => r.schedule.map((e) => e.dir));
  independent('popup', (r) => r.schedule.map((e) => e.popup));
  independent('speed quartile', (r) => rankBucket(r.schedule.map((e) => e.speed)));
  independent('spawn-time quartile', (r) => rankBucket(r.schedule.map((e) => e.spawnTime)));
  independent('text-length quartile', (r) => rankBucket(r.items.map((c) => c.card.body.length)));
  independent('trap or clear', (r) => r.items.map((c) => c.kind));
});
test('fairness: trap cards look like clear cards (the same fields, the same kinds of text); the lanes are near uniform, and every card gets a clear shot', () => {
  const lane = [0, 0, 0]; let pop = 0, n = 0;
  for (const r of allRounds) for (const e of r.schedule) { lane[e.lane]++; pop += e.popup ? 1 : 0; n++; }
  console.log(`   lanes ${lane.map((x) => (100 * x / n).toFixed(1) + '%').join(' ')}, popups ${(100 * pop / n).toFixed(1)}%`);
  for (const x of lane) assert(Math.abs(x / n - 1 / 3) < 0.04);
  assert(pop / n > 0.15 && pop / n < 0.4);
  const shape = (c) => Object.keys(c.card).sort().join() + '|' + Object.keys(c).filter((k) => k !== 'leak' && k !== 'friendly').sort().join();
  for (const r of runs.slice(0, 60)) { const shapes = new Set(r.rounds.flatMap((x) => x.items.map(shape))); assert(shapes.size <= 3, 'items differ in shape: ' + shapes.size); }
});

// ================================================================= the schedule
test('schedule: traversal 6-8 s (finale 5-6 s) on screen, spacing about 3.6 s (finale 3.0 s), even lanes left to right, odd lanes right to left', () => {
  for (const r of allRounds) {
    const [t0, t1] = r.kind === 'finale' ? [5, 6] : [6, 8], gaps = [];
    r.schedule.forEach((e, i) => {
      assert(e.dur >= t0 && e.dur <= t1, 'dur ' + e.dur); assert.strictEqual(e.dir, e.lane % 2 === 0 ? 1 : -1); assert(e.lane >= 0 && e.lane < 3); assert(e.popup ? e.x0 > 0.15 && e.x0 < 0.6 : e.x0 === 0);
      assert(Math.abs(e.endTime - (e.spawnTime + e.rise + e.dur)) < 1e-9); assert.strictEqual(e.uid, r.items[i].uid);
      if (i) gaps.push(e.spawnTime - r.schedule[i - 1].spawnTime);
    });
    const g = mean(gaps), want = r.kind === 'finale' ? 3.0 : 3.6; assert(Math.abs(g - want) < 0.5, 'spacing ' + g);
  }
});
test('schedule: at most 5 cards on screen at any time, and two cards in one lane never come closer than a card width', () => {
  let worst = 0;
  for (const r of allRounds) {
    worst = Math.max(worst, E.maxOnScreen(r.schedule));
    for (let t = 0; t < r.playSec; t += 0.1) { const on = r.schedule.filter((e) => E.cardPose(e, t).state !== 'pending' && E.cardPose(e, t).state !== 'gone'); assert(on.length <= 5, 'on screen ' + on.length);
      for (let lane = 0; lane < 3; lane++) { const ps = on.filter((e) => e.lane === lane).map((e) => E.progress(e, t)).sort((a, b) => a - b); for (let i = 1; i < ps.length; i++) assert(ps[i] - ps[i - 1] >= E.GAP - 1e-9, 'cards overlap in a lane'); } }
  }
  console.log('   most cards on screen at once: ' + worst); assert(worst <= 5);
});
test('pace: the estimated run (briefs + play + debriefs) is under 5:00 in every run', () => {
  const est = runs.map((r) => r.estSeconds); console.log(`   mean ${mean(est).toFixed(0)} s, longest ${Math.max(...est).toFixed(0)} s, shortest ${Math.min(...est).toFixed(0)} s`);
  for (const r of runs) { assert(r.estSeconds < 300, 'too long: ' + r.estSeconds); assert(r.estSeconds > 220); assert(r.rounds.every((x) => x.playSec > 30 && x.playSec < 50)); }
  assert.strictEqual(E.estimateSeconds(runs[0]), runs[0].estSeconds);
});

// ================================================================= the aiming geometry
const cam = E.LAYOUT.camera, ASPECT = 16 / 9;
const entry = (lane, p, over) => Object.assign({ uid: 'e' + lane, lane, dir: E.LAYOUT.lanes ? (lane % 2 === 0 ? 1 : -1) : 1, x0: 0, popup: false, rise: 0, dur: 7, speed: 1 / 7, spawnTime: 0 - p * 7, endTime: 7 - p * 7 }, over);
test('hit test: the ray from the camera through the reticle hits the card under it; a miss, a card still rising behind the barrier and a card that has left are not hit', () => {
  const e = entry(0, 0.5), c = E.cardPose(e, 0), n = E.ndcOf(cam, ASPECT, [c.x, c.y, c.z]);
  assert(Math.abs(c.x) < 1e-9 && c.state === 'moving');
  const ray = E.rayFromNdc(cam, ASPECT, n.x, n.y); assert.strictEqual(E.hitTest([e], 0, ray).uid, 'e0');
  const back = E.rayFromNdc(cam, ASPECT, n.x, n.y); const k = (c.z - back.o[2]) / back.d[2];
  for (const k2 of [0, 1, 2]) assert(Math.abs(back.o[k2] + back.d[k2] * k - [c.x, c.y, c.z][k2]) < 1e-9, 'the ray passes through the point');
  assert.strictEqual(E.hitTest([e], 0, E.rayFromNdc(cam, ASPECT, n.x + 0.5, n.y)), null, 'a miss');
  const rising = entry(1, 0, { x0: 0.4, popup: true, rise: 0.45, speed: 0.6 / 7, spawnTime: 0 }), r0 = E.cardPose(rising, 0.2), rn = E.ndcOf(cam, ASPECT, [r0.x, r0.y, r0.z]);
  assert.strictEqual(r0.state, 'rising'); assert.strictEqual(E.hitTest([rising], 0.2, E.rayFromNdc(cam, ASPECT, rn.x, rn.y)), null, 'behind the barrier');
  const m = E.cardPose(rising, 1), mn = E.ndcOf(cam, ASPECT, [m.x, m.y, m.z]); assert.strictEqual(E.hitTest([rising], 1, E.rayFromNdc(cam, ASPECT, mn.x, mn.y)).uid, 'e1');
  assert.strictEqual(E.cardPose(e, 99).state, 'gone'); assert.strictEqual(E.hitTest([e], 99, ray), null);
});
test('hit test: two cards overlapping under the reticle - the front one is hit (and the one behind once the front one is out of the way)', () => {
  const front = entry(0, 0.5), c0 = E.cardPose(front, 0), top = [c0.x, c0.y + 0.28, c0.z], ray = E.rayFromNdc(cam, ASPECT, E.ndcOf(cam, ASPECT, top).x, E.ndcOf(cam, ASPECT, top).y);
  const k = (E.LAYOUT.lanes[1].z - ray.o[2]) / ray.d[2], x1 = ray.o[0] + ray.d[0] * k, behind = entry(1, 0.5);
  behind.dir = 1; behind.spawnTime = -(0.5 + x1 / E.LAYOUT.rail) * 7;   // lane 1 card placed so the same ray crosses it too
  assert(Math.abs(E.cardPose(behind, 0).x - x1) < 1e-9);
  assert.strictEqual(E.hitTest([behind, front], 0, ray).uid, 'e0', 'the nearer shelf wins whatever the list order');
  assert.strictEqual(E.hitTest([front, behind], 0, ray).uid, 'e0');
  assert.strictEqual(E.hitTest([front, behind], 0, ray, new Set(['e0'])).uid, 'e1');
});

// ================================================================= judging and scoring
test('judge: threat shot = stopped, threat through the counter = a leak, legit shot = friendly fire, legit delivered = fine; a right call on a trap nobody inspected is lucky', () => {
  const th = { shoot: true, kind: 'clear' }, lg = { shoot: false, kind: 'clear' }, tt = { shoot: true, kind: 'trap' }, lt = { shoot: false, kind: 'trap' };
  assert.deepStrictEqual(E.judge(th, 'shot', false), { correct: true, lucky: false, event: 'stopped', action: 'shot' });
  assert.deepStrictEqual(E.judge(th, 'leaked', false), { correct: false, lucky: false, event: 'leak', action: 'leaked' });
  assert.deepStrictEqual(E.judge(lg, 'shot', false), { correct: false, lucky: false, event: 'friendly', action: 'shot' });
  assert.deepStrictEqual(E.judge(lg, 'delivered', false), { correct: true, lucky: false, event: 'delivered', action: 'delivered' });
  assert(E.judge(tt, 'shot', false).lucky && !E.judge(tt, 'shot', true).lucky, 'a trap shot without inspecting is lucky, after inspecting it is verified');
  assert(E.judge(lt, 'delivered', false).lucky && !E.judge(lt, 'delivered', true).lucky);
  assert(!E.judge(tt, 'leaked', false).lucky && !E.judge(lt, 'shot', false).lucky, 'a wrong call is never lucky');
  assert.strictEqual(E.judge(th, 'delivered', false).event, 'leak'); assert.strictEqual(E.judge(lg, 'leaked', false).event, 'delivered');
});
test('stars: 3 = catch rate and accuracy both at least 85% and 3 traps inspected; 2 = both at least 65%; 1 = finished; nothing if the run was left', () => {
  const s = (c, a, t) => ({ catchRate: c, accuracy: a, trapsInspected: t });
  assert.strictEqual(E.starsFor(s(0.9, 0.9, 3), true), 3); assert.strictEqual(E.starsFor(s(0.9, 0.9, 2), true), 2, 'needs 3 verified traps');
  assert.strictEqual(E.starsFor(s(0.84, 0.95, 5), true), 2); assert.strictEqual(E.starsFor(s(0.95, 0.84, 5), true), 2); assert.strictEqual(E.starsFor(s(0.65, 0.65, 0), true), 2);
  assert.strictEqual(E.starsFor(s(0.64, 0.9, 5), true), 1); assert.strictEqual(E.starsFor(s(0.9, 0.5, 5), true), 1); assert.strictEqual(E.starsFor(s(0, null, 0), true), 1); assert.strictEqual(E.starsFor(s(1, 1, 5), false), 0);
});

// ---- a scripted player: for every card, find a moment when the reticle on its centre really hits it, then inspect and/or shoot
function aim(sched, e, t) { const c = E.cardPose(e, t); return E.ndcOf(cam, ASPECT, [c.x, c.y, c.z]); }
function window_(sched, e) {
  for (let t = e.spawnTime + e.rise + 0.2; t < e.endTime - 0.4; t += 0.1) {
    const a = aim(sched, e, t), b = aim(sched, e, t + 0.15), h1 = E.hitTest(sched, t, E.rayFromNdc(cam, ASPECT, a.x, a.y)), h2 = E.hitTest(sched, t + 0.15, E.rayFromNdc(cam, ASPECT, b.x, b.y));
    if (h1 && h2 && h1.uid === e.uid && h2.uid === e.uid) return t;
  }
  return null;
}
let noWindow = 0, cards = 0;
function script(round, mode, budget) {   // mode: 'perfect' (threats only), 'verify' (perfect, and inspect traps while charges last), 'all', 'none'
  const out = [], by = Object.fromEntries(round.items.map((i) => [i.uid, i]));
  for (const e of round.schedule) {
    const it = by[e.uid], t = window_(round.schedule, e); cards++; if (t == null) { noWindow++; continue; }
    let ts = t;
    if (mode === 'verify' && it.kind === 'trap' && budget.n > 0) { budget.n--; const a = aim(round.schedule, e, t); out.push({ t, kind: 'inspect', nx: a.x, ny: a.y }); ts = t + 0.1; }
    if (mode === 'all' || ((mode === 'perfect' || mode === 'verify') && it.shoot)) { const a = aim(round.schedule, e, ts); out.push({ t: ts, kind: 'shoot', nx: a.x, ny: a.y }); }
  }
  return out;
}
function playRun(spec, mode) { const budget = { n: spec.magnifier }; return spec.rounds.map((r) => { const charges = budget.n, log = E.playRound(r, script(r, mode, budget), { charges }); budget.n = log.charges; return log; }); }
const botRuns = runs.slice(0, 40);
const results = {};
for (const mode of ['verify', 'perfect', 'all', 'none']) results[mode] = botRuns.map((r) => E.scoreRun(playRun(r, mode)));
test('play: almost every card gets a clear moment to shoot (the front card never hides all of another)', () => {
  console.log(`   ${noWindow} of ${cards} scripted cards had no clear moment`); assert(noWindow / cards < 0.01);
});
test('play: a shot that hits nothing still costs a token; at zero tokens a shot does nothing; ammo is threats + 2', () => {
  const r = runs[3].rounds[0], e = r.schedule[0], t = window_(r.schedule, e), a = aim(r.schedule, e, t), miss = { kind: 'shoot', nx: -0.95, ny: -0.9 };
  const spray = Array.from({ length: r.ammo }, (_, i) => Object.assign({ t: 0.1 + i * 0.01 }, miss));
  const log = E.playRound(r, spray.concat([{ t, kind: 'shoot', nx: a.x, ny: a.y }]));
  assert.strictEqual(log.ammoLeft, 0); assert.strictEqual(log.shots.length, r.ammo); assert(log.shots.every((s) => s.uid === null)); assert.strictEqual(log.dry, 1);
  assert(log.entries.every((x) => x.action !== 'shot'), 'with no token left the card is not hit');
  const one = E.playRound(r, [{ t, kind: 'shoot', nx: a.x, ny: a.y }]); assert.strictEqual(one.ammoLeft, r.ammo - 1); assert.strictEqual(one.entries.find((x) => x.uid === e.uid).action, 'shot');
  assert.strictEqual(E.scoreRound(log).emptyShots, r.ammo);
});
test('play: inspecting spends a charge and verifies that card; with no charges left nothing happens; a card is inspected once', () => {
  const r = runs[5].rounds[1], e = r.schedule[2], t = window_(r.schedule, e), a = aim(r.schedule, e, t), ins = { t, kind: 'inspect', nx: a.x, ny: a.y };
  const log = E.playRound(r, [ins, Object.assign({}, ins, { t: t + 0.1 })], { charges: 5 }); assert.strictEqual(log.charges, 4); assert.strictEqual(log.inspects.length, 1);
  assert.strictEqual(log.entries.find((x) => x.uid === e.uid).inspected, true);
  const none = E.playRound(r, [ins], { charges: 0 }); assert.strictEqual(none.inspects.length, 0); assert.strictEqual(none.entries.find((x) => x.uid === e.uid).inspected, false);
});
test('scoring: a careful player (shoot the threats, inspect the traps) earns 3 stars; shooting everything or nothing scores badly; a lucky shot on a trap never counts', () => {
  const stat = (m) => ({ stars: results[m].map((s) => s.stars), catchRate: mean(results[m].map((s) => s.catchRate)), accuracy: mean(results[m].filter((s) => s.accuracy != null).map((s) => s.accuracy)), lucky: mean(results[m].map((s) => s.lucky)), tr: mean(results[m].map((s) => s.trapsInspected)) });
  const v = stat('verify'), p = stat('perfect'), a = stat('all'), n = stat('none');
  console.log(`   verify: catch ${(100 * v.catchRate).toFixed(0)}% accuracy ${(100 * v.accuracy).toFixed(0)}% inspected ${v.tr.toFixed(1)} stars ${mean(v.stars).toFixed(2)}`);
  console.log(`   perfect, no inspecting: stars ${mean(p.stars).toFixed(2)}, lucky shots ${p.lucky.toFixed(1)}   shoot everything: catch ${(100 * a.catchRate).toFixed(0)}% accuracy ${(100 * a.accuracy).toFixed(0)}% stars ${mean(a.stars).toFixed(2)}   shoot nothing: catch ${(100 * n.catchRate).toFixed(0)}% stars ${mean(n.stars).toFixed(2)}`);
  assert(v.catchRate > 0.97 && v.accuracy > 0.97 && v.stars.every((s) => s === 3), 'careful play'); assert(v.tr >= 3);
  assert(p.stars.every((s) => s === 2) && p.lucky > 5, 'right every time but never verified: 2 stars (lucky shots)');
  assert(a.stars.every((s) => s === 1) && a.catchRate < 0.85 && a.accuracy < 0.65, 'spraying: out of tokens, many friendly hits');
  assert(n.stars.every((s) => s === 1) && n.catchRate === 0, 'shooting nothing: every threat leaks');
  // mastery: a variant with a lucky trap is not clean; the same run with the inspections is
  for (const s of results.perfect) for (const c of Object.values(s.perConcept)) assert(c.luckyShots === 0 || c.cleanVariants.length < c.variantsSeen.length);
  const lucky = results.perfect[0], verified = results.verify[0]; assert(Object.values(lucky.perConcept).reduce((x, c) => x + c.inspectedCorrect, 0) === 0 && lucky.trapsInspected === 0);
  assert(Object.values(verified.perConcept).reduce((x, c) => x + c.inspectedCorrect, 0) === verified.trapsInspected && verified.trapsInspected <= 5);
});
test('scoring: per round and per run, catch rate = stopped / threats, accuracy = right shots / shots at cards, leaks, friendly fire and tokens left add up', () => {
  const logs = playRun(runs[7], 'all'), sc = E.scoreRun(logs);
  for (const l of logs) { const s = E.scoreRound(l), th = l.entries.filter((e) => e.shoot).length; assert.strictEqual(s.threats, th); assert.strictEqual(s.stopped + s.leaks, th); assert.strictEqual(s.shotsAtCards, s.correctShots + s.friendly);
    assert(Math.abs(s.catchRate - s.stopped / th) < 1e-9); assert.strictEqual(s.ammoLeft + l.shots.length, s.ammoStart); assert.strictEqual(s.delivered, l.entries.filter((e) => !e.shoot && e.action === 'delivered').length); }
  assert.strictEqual(sc.threats, logs.reduce((n, l) => n + E.scoreRound(l).threats, 0)); assert.strictEqual(sc.rounds.length, 5); assert.strictEqual(sc.finished, true);
  assert.strictEqual(E.scoreRun(logs.slice(0, 2)).stars, 0, 'a run left early earns no stars'); assert.strictEqual(E.scoreRun(logs.slice(0, 2)).finished, false);
  const n = E.scoreRun(playRun(runs[7], 'none')); assert.strictEqual(n.accuracy, null, 'no shots at cards, no accuracy');
});
test('debrief: up to 3 cards, the player\'s mistakes first (a leak, then friendly fire), then the trap items, one concept each while there is a choice', () => {
  for (const mode of ['all', 'none', 'verify', 'perfect']) for (const r of runs.slice(0, 10)) for (const l of playRun(r, mode)) {
    const d = E.debriefPicks(l, 3), bad = l.entries.filter((e) => !e.correct);
    assert(d.length <= 3 && new Set(d).size === d.length);
    assert.deepStrictEqual(d.slice(0, Math.min(3, bad.length)).map((e) => e.correct), d.slice(0, Math.min(3, bad.length)).map(() => false), 'mistakes first');
    if (d.length > bad.length) for (const e of d.slice(bad.length)) assert(e.kind === 'trap', 'then trap items');
    const leaks = d.filter((e) => e.event === 'leak'), fr = d.filter((e) => e.event === 'friendly'); if (leaks.length && fr.length) assert(d.indexOf(leaks[0]) < d.indexOf(fr[0]));
  }
});
test('replay: the same runSpec and the same scripted inputs give the identical logs and score, every time', () => {
  noRandom(() => { for (const mode of ['verify', 'all']) for (const r of runs.slice(0, 6)) { const a = playRun(r, mode), b = playRun(JSON.parse(JSON.stringify(r)), mode); assert.deepStrictEqual(a, b); assert.deepStrictEqual(E.scoreRun(a), E.scoreRun(b)); } });
});
test('rerollRound: a fresh draw of the same side (or the finale), none of the run\'s other cards, every other round untouched, deterministic, still a valid round', () => {
  let n = 0;
  for (const r of runs.slice(0, 150)) for (const i of [0, 2, 3, 4]) {
    const { spec, round } = E.rerollRound(r, i), again = E.rerollRound(r, i), old = r.rounds[i];
    assert.deepStrictEqual(again.spec, spec); assert.strictEqual(spec.rounds[i], round);
    assert.strictEqual(round.side, old.side); assert.strictEqual(round.kind, old.kind); assert.strictEqual(round.index, i);
    spec.rounds.forEach((x, k) => { if (k !== i) assert.deepStrictEqual(x, r.rounds[k]); });
    const others = new Set(r.rounds.filter((_, k) => k !== i).flatMap((x) => x.items.map((c) => c.itemId))), mine = round.items.map((c) => c.itemId);
    assert(mine.every((id) => !others.has(id)), 'a reroll never repeats a card of the run'); assert(mine.every((id) => !old.items.some((c) => c.itemId === id)), 'and is not the same draw');
    assert.strictEqual(round.ammo, round.items.filter((c) => c.shoot).length + 2); assert(E.twinPairs(round.items) >= (round.kind === 'finale' ? 3 : 2) && E.countTraps(round.items) >= (round.kind === 'finale' ? 3 : 2));
    assert(round.items.length === old.items.length && round.threats / round.items.length >= 0.35 && round.threats / round.items.length <= 0.65);
    assert(E.maxOnScreen(round.schedule) <= 5); assert(spec.estSeconds < 300); assert.deepStrictEqual(r, runs[runs.indexOf(r)], 'the original is untouched'); n++;
  }
  assert(n === 600);
});

// ================================================================= the other games
test('the other games\' tests still pass (bridge, carrom, token tower)', () => {
  for (const f of ['bridge-tests.js', 'carrom-tests.js', 'carrom-physics-tests.js', 'carrom-play-tests.js', 'carrom-progress-tests.js', 'carrom-world-tests.js', 'jenga-world-tests.js', 'jenga-play-tests.js', 'jenga-progress-tests.js']) {
    const out = execFileSync('node', [path.join(__dirname, f)], { encoding: 'utf8' });
    console.log('   ' + f + ': ' + out.trim().split('\n').pop());
  }
});
done();
