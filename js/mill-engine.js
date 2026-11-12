// Token Mill — engine: the run generator, the belt clock, the ladder judge with the desk rule, and scoring. Pure and deterministic (no Math.random, no DOM, no clock).
// Built on bridge-generator.js (imported, not copied): hash32, mulberry32, pick, shuffle, weightedPick, sampleParams and conceptWeight.
// Browser: window.MillEngine. Node: require('./mill-engine.js').
//
//   seedFor(playerId, runIndex)       -> 32-bit seed = hash('mill:' + playerId + ':' + runIndex): its own stream, not the other games'
//   composeRun(seed, history)         -> runSpec (plain JSON)
//   scheduleShift(shift)              -> [{ uid, itemId, t0 }]     t0 = belt time (seconds) at which the crate enters the sorting zone
//   rerollShift(spec, i, history)     -> { spec, shift }           a fresh draw for shift i (same side, or the finale); every other shift stays
//   beltClock(brakes, rate)           -> { s(t), t(s), used }      belt time as a pure function of real time and the brake log (3 s of brake at 40% speed per shift)
//   cratePos(t0, s) / inZone(t0, s)   -> where a crate is on the belt at belt time s (x in metres along the sorting zone, -6 .. +6)
//   judge(item, binId, opts)          -> { correct, direction: 'lax' | 'strict' | 'dropped' | null, severe, stamp, rankGap, reveal? }
//   deskState(routes, capacity)       -> which routes to REVIEW EACH found the desk jammed
//   playShift(shift, inputs, opts)    -> log      a scripted shift: the same spec and inputs always give the same log (the tests' replay)
//   scoreShift(log) / scoreRun(logs)  -> accuracy, spills, dropped, line cost vs ideal cost, stars, per concept
//
// history (all optional, the shape the shared store hands over):
//   { runs: [ { items: ['MD1a.1', ...] }, ... ],                                   // oldest -> newest: every crate shown
//     concepts: { MD1: { attempts, misses, mastered }, ... } }                      // mastered = clean variants in two different variants across runs
//
// runSpec: { v, game, seed, avoid, order, estSeconds, shifts: [shift x 5] }
//   shift: { index, kind: 'shift' | 'finale', side, brief, bins, desk, spacing, traverse, rseed, waves?, counts, pairs, concepts, beltSec, crates, schedule }
//   crate (a record, strings already filled): { uid, itemId, side, conceptId, variantId, twin, cue, kind, bin, rank, text, chips, full, tell, laxStamp, strictStamp,
//     confidence?, stakes?, missing?, outputRight?, params, wave }
//   A shift is 12 crates built from twin pairs (two crates sharing a cue with different correct bins) and single crates; the finale is 14 crates in four waves (4, 4, 3, 3), one wave
//   per side, whose bin plates flip between waves. Which bin is correct is drawn to be independent of spawn order, text length and chip count.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./mill-content.js') : root.MILL_CONTENT, isNode ? require('./bridge/bridge-generator.js') : root.BridgeGenerator);
  if (isNode) module.exports = api;
  else root.MillEngine = api;
})(this, function (C, BG) {
  const { SIDE_IDS, SIDES, RUN, FINALE } = C;
  const ATTEMPTS = 1600, ZONE = { x0: -6, x1: 6 }, SPEED = (ZONE.x1 - ZONE.x0) / RUN.traverse, FINALE_DESK = 2;   // belt speed in metres per belt second; the finale's REVIEW EACH desk (a wave of 3-4)
  const STAT = { shift: [0, 0, 0], finale: [0, 0, 0], attempts: 0 };   // how far the freshness rule had to relax (tests and tuning read it)
  const seedFor = (playerId, runIndex) => BG.hash32('mill:' + playerId + ':' + runIndex);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const binXs = [0, 1, 2, 3].map((k) => ZONE.x0 + (k + 0.5) * ((ZONE.x1 - ZONE.x0) / 4));   // the centres of the four bins along the zone: -4.5, -1.5, 1.5, 4.5

  // ---------------------------------------------------------------- the bank, indexed by unit: a twin pair, or a single clear / trap crate
  const UNITS = {}, ITEM = {}, VARIANT = {};
  for (const c of C.CONCEPTS) for (const v of c.variants) {
    VARIANT[v.id] = { concept: c, variant: v };
    const cues = {};
    for (const it of v.items) { ITEM[it.id] = it; (UNITS[c.side] = UNITS[c.side] || []); if (it.kind === 'twin') (cues[it.cue] = cues[it.cue] || []).push(it); else UNITS[c.side].push({ key: it.id, type: it.kind, conceptId: c.id, variantId: v.id, items: [it] }); }
    for (const cue of Object.keys(cues)) UNITS[c.side].push({ key: v.id + ':' + cue, type: 'pair', conceptId: c.id, variantId: v.id, items: cues[cue] });
  }
  const UNIT = Object.fromEntries(Object.values(UNITS).flat().map((u) => [u.key, u]));
  const rankOf = (side, binId) => SIDES[side].bins.findIndex((b) => b.id === binId);

  // a crate record: the item with its placeholders filled; a variant's params are sampled once per shift, from a stream of its own
  function crate(item, rseed, wave) {
    const vid = item.id.replace(/\.\d+$/, ''), { concept, variant } = VARIANT[vid], params = BG.sampleParams(BG.mulberry32(BG.hash32(rseed + ':' + vid)), variant.params), e = C.expand(item, params);
    const r = { uid: item.id, itemId: item.id, side: concept.side, conceptId: concept.id, variantId: vid, twin: item.cue ? vid + ':' + item.cue : null, cue: item.cue, kind: item.kind, bin: item.bin, rank: rankOf(concept.side, item.bin),
      text: e.text, chips: e.chips, full: e.full, tell: e.tell, laxStamp: e.laxStamp, strictStamp: e.strictStamp, params, wave: wave || 0 };
    for (const k of ['confidence', 'stakes', 'missing', 'outputRight']) if (item[k] != null) r[k] = item[k];
    return r;
  }
  const countTraps = (crates) => crates.filter((c) => c.kind === 'trap').length;
  function twinPairs(crates) {   // twin pairs that are present whole in a shift: a twin key with two crates of different bins
    const m = {}; for (const c of crates) if (c.twin) (m[c.twin] = m[c.twin] || new Set()).add(c.bin);
    return Object.values(m).filter((s) => s.size >= 2).length;
  }

  // ---------------------------------------------------------------- the belt: its clock, and where a crate is on it
  // The belt's own clock runs at 1 (0.75 for the relaxed belt) and at brakeSpeed times that while the brake is held; crates enter the zone at fixed belt times, so a brake slows
  // everything together and never bunches them up. brakes: [{ t0, t1 }] in real seconds; the total held is capped at RUN.brake (3 s) a shift and never refilled.
  function normalizeBrakes(brakes) {
    const out = []; let left = RUN.brake;
    for (const b of (brakes || []).slice().sort((x, y) => x.t0 - y.t0)) {
      const a = Math.max(b.t0, out.length ? out[out.length - 1].t1 : 0), len = Math.min(left, b.t1 - a); if (len <= 0) continue;
      out.push({ t0: a, t1: a + len }); left -= len;
    }
    return out;
  }
  function beltClock(brakes, rate) {
    const r = rate || 1, bs = normalizeBrakes(brakes);
    const s = (t) => { let belt = 0, at = 0; for (const b of bs) { if (t <= b.t0) break; belt += (b.t0 - at) * r; const e = Math.min(t, b.t1); belt += (e - b.t0) * r * RUN.brakeSpeed; at = e; if (t <= b.t1) return belt; } return belt + (t - at) * r; };
    const tOf = (target) => { let belt = 0, at = 0; for (const b of bs) { const pre = (b.t0 - at) * r; if (target <= belt + pre) return at + (target - belt) / r; belt += pre; const len = (b.t1 - b.t0) * r * RUN.brakeSpeed; if (target <= belt + len) return b.t0 + (target - belt) / (r * RUN.brakeSpeed); belt += len; at = b.t1; } return at + (target - belt) / r; };
    return { s, t: tOf, used: bs.reduce((n, b) => n + (b.t1 - b.t0), 0), brakes: bs };
  }
  const cratePos = (t0, s) => ZONE.x0 + SPEED * (s - t0);   // x along the zone: -6 at the hopper, +6 at the pit
  const inZone = (t0, s) => s >= t0 && s < t0 + RUN.traverse;
  const binAt = (x) => { const k = Math.floor((x - ZONE.x0) / ((ZONE.x1 - ZONE.x0) / 4)); return k >= 0 && k < 4 ? k : -1; };   // the bin chute under x, or -1

  // ---------------------------------------------------------------- what the generator reads from the player's history
  function context(history) {
    const runs = (history && history.runs) || [], items = (r) => (r && r.items) || [];
    const recent = new Set(); runs.slice(-3).forEach((r) => items(r).forEach((i) => recent.add(i)));
    const wh = { concepts: {} }; for (const id in (history && history.concepts) || {}) { const c = history.concepts[id]; wh.concepts[id] = { mastered: c.mastered, falls: c.misses != null ? c.misses : c.wrongTries || 0 }; }
    return { last: new Set(items(runs[runs.length - 1])), recent, wh };
  }
  const seenIn = (set) => (u) => u.items.some((i) => set.has(i.id));
  // n units of one type for a side: each pick from the freshest tier that has any (no crate from the last 3 runs, else none from the last run, else any), relaxed when the attempts fail; the weaker concepts weigh more and a
  // concept or a variant already picked weighs less, so a shift spreads over the lessons. The caller marks the units used.
  function pickUnits(rng, pool, n, ctx, used, lvl) {   // lvl 0: freshest tier first; 1: only "not in the last run" or any; 2: anything (when freshness would starve a bin)
    const left = pool.filter((u) => !u.items.some((i) => used.has(i.id))), out = [], cv = {}, vv = {};
    for (let k = 0; k < n && left.length; k++) {
      const all = [left.filter((u) => !seenIn(ctx.recent)(u)), left.filter((u) => !seenIn(ctx.last)(u)), left], tiers = lvl >= 2 ? [left] : lvl === 1 ? all.slice(1) : all, list = tiers.find((t) => t.length);
      const u = BG.weightedPick(rng, list, (x) => BG.conceptWeight(ctx.wh, x.conceptId) * Math.pow(0.6, cv[x.conceptId] || 0) * Math.pow(0.8, vv[x.variantId] || 0));
      out.push(u); cv[u.conceptId] = (cv[u.conceptId] || 0) + 1; vv[u.variantId] = (vv[u.variantId] || 0) + 1; left.splice(left.indexOf(u), 1);
    }
    return out;
  }
  const mark = (used, units) => units.forEach((u) => u.items.forEach((i) => used.add(i.id)));

  // ---------------------------------------------------------------- fairness: the correct bin must not give itself away
  const midRanks = (v) => v.map((x) => v.filter((y) => y < x).length + (v.filter((y) => y === x).length - 1) / 2);
  function corr(xs, ys) {   // Pearson on mid-ranks (Spearman); 0 when either side has no spread
    const a = midRanks(xs), b = midRanks(ys), n = xs.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }
  // a candidate set of crates passes when no cue (text length, chip count) lines up with the correct bin: the cue's rank must not correlate with the bin's rank by more than `tol`. The rest of
  // the independence is in the bank itself: every bin's crates are spread evenly over the lengths (mill-tests.js measures it on generated runs)
    function unbiased(crates, tol) {
    const rank = crates.map((c) => c.rank);
    return Math.abs(corr(crates.map((c) => c.text.length), rank)) <= tol && Math.abs(corr(crates.map((c) => c.chips.length), rank)) <= tol;
  }
  const longestRun = (crates) => { let best = 1, cur = 1; for (let i = 1; i < crates.length; i++) { cur = crates[i].bin === crates[i - 1].bin ? cur + 1 : 1; best = Math.max(best, cur); } return best; };
  // the spawn order: no more than 2 in a row for one bin, and the position in the line says nothing about the bin
  function order(rng, crates, tol) {
    let best = null, bestScore = Infinity;
    for (let a = 0; a < 80; a++) {
      const o = BG.shuffle(rng, crates), run = longestRun(o); if (run > 2) continue;
      const sc = Math.abs(corr(o.map((_, i) => i), o.map((c) => c.rank)));
      if (sc <= tol) return o; if (sc < bestScore) { best = o; bestScore = sc; }
    }
    return best;
  }

  // ---------------------------------------------------------------- one standard shift: 12 crates
  function composition(rng) {   // twin pairs, trap crates and clear crates: 12 = 2 x pairs + traps + clears, with at least 3 pairs, 2 or 3 traps and few clear crates (a side has 20 pairs but only 10 traps and 10 clears)
    const opts = []; for (let p = 3; p <= 5; p++) for (let t = 2; t <= 3; t++) if (12 - 2 * p - t >= 0) opts.push({ p, t, c: 12 - 2 * p - t });
    return BG.pick(rng, opts);
  }
  function buildShift(rng, index, side, ctx, used, seed, tag) {
    const pool = UNITS[side], S = SIDES[side], cap = RUN.desk;
    for (let a = 0; a < ATTEMPTS; a++) {
      const lvl = Math.min(2, Math.floor(a / 200)), fresh = a < 200 ? 0 : a < 1200 ? 1 : 2, tol = 0.15 + 0.1 * lvl, comp = composition(rng), take = new Set(used);
      const pairs = pickUnits(rng, pool.filter((u) => u.type === 'pair'), comp.p, ctx, take, fresh); mark(take, pairs);
      const traps = pickUnits(rng, pool.filter((u) => u.type === 'trap'), comp.t, ctx, take, fresh); mark(take, traps);
      const clears = pickUnits(rng, pool.filter((u) => u.type === 'clear'), comp.c, ctx, take, fresh);
      const units = pairs.concat(traps, clears), rseed = BG.hash32(seed + ':shift:' + index + tag), crates = units.flatMap((u) => u.items).map((it) => crate(it, rseed, 0));
      if (crates.length !== RUN.crates) continue;
      const counts = S.bins.map((b) => crates.filter((c) => c.bin === b.id).length);
      if (counts.some((n) => n < 2 || n > 5)) continue;
      if (side === 'tiers' && counts[2] > RUN.reviewCap) continue;
      if (!unbiased(crates, tol)) continue;
      const ordered = order(rng, crates, tol); if (!ordered) continue;
      STAT.shift[fresh]++; STAT.attempts += a + 1;
      return { units, shift: finishShift({ index, kind: 'shift', side, brief: S.brief, bins: S.bins, desk: cap, spacing: RUN.spacing, rseed, counts, pairs: units.filter((u) => u.type === 'pair').map((u) => u.key), concepts: [...new Set(crates.map((c) => c.conceptId))] }, ordered) };
    }
    throw new Error('no shift for ' + side + ' seed ' + seed);
  }
  function finishShift(base, crates) {
    const shift = Object.assign({}, base, { crates }); shift.schedule = scheduleShift(shift); shift.beltSec = beltSecOf(shift); return shift;
  }

  // ---------------------------------------------------------------- the finale: 14 crates in four waves, one per side; the plates flip between waves
  function buildFinale(rng, index, ctx, used, seed, tag) {
    const sizes = FINALE.waves;
    for (let a = 0; a < ATTEMPTS; a++) {
      const take = new Set(used), sides = BG.shuffle(rng, SIDE_IDS), waves = [], taken = [], fresh = a < 200 ? 0 : a < 1200 ? 1 : 2;
      let ok = true;
      sides.forEach((side, w) => {
        if (!ok) return;
        const pool = UNITS[side], n = sizes[w], shape = n === 4 ? BG.pick(rng, [[2, 0, 0], [1, 1, 1], [1, 2, 0]]) : BG.pick(rng, [[1, 1, 0], [1, 0, 1]]);   // [pairs, traps, clears]
        const pairs = pickUnits(rng, pool.filter((u) => u.type === 'pair'), shape[0], ctx, take, fresh); mark(take, pairs);
        const traps = pickUnits(rng, pool.filter((u) => u.type === 'trap'), shape[1], ctx, take, fresh); mark(take, traps);
        const clears = pickUnits(rng, pool.filter((u) => u.type === 'clear'), shape[2], ctx, take, fresh); mark(take, clears);
        taken.push(...pairs, ...traps, ...clears);
        const rseed = BG.hash32(seed + ':wave:' + index + ':' + w + tag), cr = pairs.concat(traps, clears).flatMap((u) => u.items).map((it) => crate(it, rseed, w));
        const cap = side === 'tiers' ? FINALE_DESK : 99; if (cr.filter((c) => c.bin === 'review').length > cap) { ok = false; return; }
        const o = order(rng, cr, 0.6); if (!o || longestRun(o) > 2) { ok = false; return; }
        waves.push({ side, size: n, crates: o });
      });
      if (!ok) continue;
      const crates = waves.flatMap((w) => w.crates);
      if (crates.length !== FINALE.crates || countTraps(crates) < FINALE.minTraps || waves.reduce((n, w) => n + twinPairs(w.crates), 0) < FINALE.minPairs) continue;
      const rseed = BG.hash32(seed + ':finale:' + index + tag);
      const base = { index, kind: 'finale', side: 'rush', brief: waves[0] ? SIDES[waves[0].side].brief : '', bins: SIDES[waves[0].side].bins, desk: FINALE_DESK, spacing: FINALE.spacing, rseed, banner: FINALE.banner,
        waves: waves.map((w) => ({ side: w.side, size: w.size, brief: SIDES[w.side].brief, bins: SIDES[w.side].bins, uids: w.crates.map((c) => c.uid) })), counts: null,
        pairs: taken.filter((u) => u.type === 'pair').map((u) => u.key), concepts: [...new Set(crates.map((c) => c.conceptId))] };
      STAT.finale[fresh]++;
      return { units: taken, shift: finishShift(base, crates) };
    }
    throw new Error('no finale for seed ' + seed);
  }

  function composeRun(seed, history) {
    const rng = BG.mulberry32(seed), ctx = context(history), used = new Set(), order_ = BG.shuffle(rng, SIDE_IDS), shifts = [];
    order_.forEach((side, i) => { const r = buildShift(rng, i, side, ctx, used, seed, ''); mark(used, r.units); shifts.push(r.shift); });
    shifts.push(buildFinale(rng, order_.length, ctx, used, seed, '').shift);
    const spec = { v: 1, game: 'mill', seed, avoid: [...ctx.recent], order: order_, estSeconds: 0, shifts };
    spec.estSeconds = estimateSeconds(spec);
    return spec;
  }
  // a fresh draw for shift i: the same side (or the finale), none of the crates any shift of the run already shows; the other shifts are untouched
  function rerollShift(spec, i, history) {
    const s = clone(spec), old = s.shifts[i], n = ((s.rerolls = s.rerolls || {})[i] = (s.rerolls[i] || 0) + 1), tag = ':reroll' + n, ctx = context(history || { runs: [{ items: [...s.avoid] }] });
    const rng = BG.mulberry32(BG.hash32(s.seed + ':reroll:' + i + ':' + n)), used = new Set();
    s.shifts.forEach((sh) => sh.crates.forEach((c) => used.add(c.itemId)));   // the old shift's crates too: a reroll is never the same draw
    const r = old.kind === 'finale' ? buildFinale(rng, i, ctx, used, s.seed, tag) : buildShift(rng, i, old.side, ctx, used, s.seed, tag);
    s.shifts[i] = r.shift; s.estSeconds = estimateSeconds(s);
    return { spec: s, shift: r.shift };
  }

  // ---------------------------------------------------------------- the schedule: a crate enters the zone every `spacing` belt seconds; in the finale the new wave waits 1.2 s more
  function scheduleShift(shift) {
    const out = []; let t = 0;
    shift.crates.forEach((c, i) => { if (i && c.wave !== shift.crates[i - 1].wave) t += FINALE.pause; out.push({ uid: c.uid, itemId: c.itemId, t0: +t.toFixed(6), wave: c.wave }); t += shift.spacing; });
    return out;
  }
  const beltSecOf = (shift) => shift.schedule[shift.schedule.length - 1].t0 + RUN.traverse;   // the belt phase ends when the last crate leaves the zone
  // every plate flips when the last crate of the old wave has passed its bin and before the first crate of the new wave gets there: [{ wave, bin, at }] in belt seconds
  function plateFlips(shift) {
    if (shift.kind !== 'finale') return [];
    const out = [];
    for (let w = 1; w < shift.waves.length; w++) {
      const prev = shift.schedule.filter((e) => e.wave === w - 1), next = shift.schedule.find((e) => e.wave === w), lastOld = prev[prev.length - 1].t0;
      for (let b = 0; b < 4; b++) { const off = (binXs[b] - ZONE.x0) / SPEED; out.push({ wave: w, bin: b, at: +(((lastOld + off) + (next.t0 + off)) / 2).toFixed(6) }); }
    }
    return out;
  }
  const maxInZone = (schedule) => { let m = 0; for (const e of schedule) m = Math.max(m, schedule.filter((o) => o.t0 <= e.t0 && o.t0 + RUN.traverse > e.t0).length); return m; };
  // briefs + belts + debriefs; `maxBrake` adds the most the brake can add to every belt (3 s held slows the belt clock by 3 x (1 - brakeSpeed) = 1.8 s)
  function estimateSeconds(spec, opts) {
    const extra = opts && opts.maxBrake ? RUN.brake * (1 - RUN.brakeSpeed) : 0;
    return spec.shifts.reduce((s, sh) => s + RUN.brief + sh.beltSec + extra + RUN.debrief, 0);
  }

  // ---------------------------------------------------------------- judging: the ladder
  // The four bins run from the most permissive (rank 0) to the strictest (rank 3). A bin of lower rank than the right one is TOO LAX (the unsafe direction); two ranks or more is a SPILL.
  // A bin of higher rank is TOO STRICT (the wasteful direction). binId null = the crate reached the pit: dropped. opts.jammed: the REVIEW EACH desk is already full, so the crate counts as too strict.
  function judge(item, binId, opts) {
    const side = item.side, correct = rankOf(side, item.bin);
    const base = { correct: false, direction: null, severe: false, stamp: '', rankGap: 0 };
    if (binId == null) return Object.assign(base, { direction: 'dropped', stamp: 'DROPPED' });
    const chosen = rankOf(side, binId), gap = chosen - correct;
    let out;
    if (opts && opts.jammed && binId === 'review') out = Object.assign(base, { direction: 'strict', stamp: 'DESK JAMMED', rankGap: Math.max(1, gap), overGated: true });
    else if (gap === 0) out = Object.assign(base, { correct: true });
    else if (gap < 0) out = Object.assign(base, { direction: 'lax', severe: gap <= -2, stamp: item.laxStamp, rankGap: -gap });
    else out = Object.assign(base, { direction: 'strict', stamp: item.strictStamp, rankGap: gap });
    if (side === 'checks' && binId === 'send' && item.outputRight != null) out.reveal = item.outputRight ? 'WENT OUT FINE' : 'WAS WRONG';   // the hidden truth of an AUTO-SEND
    return out;
  }
  // routes: [{ uid, bin, t }] in the order they happened; the desk holds `capacity` crates a shift: the one after that is jammed
  function deskState(routes, capacity) {
    let used = 0; const jammed = routes.map((r) => { if (r.bin !== 'review') return false; used++; return used > capacity; });
    return { used, jammed, over: used > capacity };
  }

  // ---------------------------------------------------------------- a scripted shift
  // inputs: [{ t, kind: 'route', uid, bin }] and [{ kind: 'brake', t0, t1 }] (real seconds in the shift). A route counts only while the crate is in the zone and still unsettled; a crate that
  // leaves the zone unrouted reaches the pit: dropped. The log keeps what the debrief needs.
  function playShift(shift, inputs, opts) {
    const o = Object.assign({ rate: 1 }, opts), clock = beltClock(inputs.filter((x) => x.kind === 'brake'), o.rate), by = Object.fromEntries(shift.crates.map((c) => [c.uid, c])), t0Of = Object.fromEntries(shift.schedule.map((e) => [e.uid, e.t0]));
    const routes = [], settled = new Map();
    inputs.filter((x) => x.kind === 'route').map((x, i) => [x, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).forEach(([x]) => {
      const c = by[x.uid]; if (!c || settled.has(x.uid) || rankOf(c.side, x.bin) < 0) return;
      if (!inZone(t0Of[x.uid], clock.s(x.t))) return;
      settled.set(x.uid, { bin: x.bin, t: x.t }); routes.push({ uid: x.uid, bin: x.bin, t: x.t });
    });
    const desk = deskState(routes, shift.desk), jam = new Map(routes.map((r, i) => [r.uid, desk.jammed[i]]));
    const entries = shift.crates.map((c) => { const s = settled.get(c.uid); return entryFor(c, s ? s.bin : null, s ? s.t : clock.t(t0Of[c.uid] + RUN.traverse), !!jam.get(c.uid)); });
    return { index: shift.index, kind: shift.kind, side: shift.side, desk: desk.used, deskCap: shift.desk, brakeUsed: clock.used, endT: clock.t(shift.beltSec), entries };
  }

  // what a shift's log keeps about one crate once it is settled: its own words (for the debrief), where it went (binId, or null = the pit) and how it was judged
  function entryFor(c, binId, t, jammed) {
    const j = judge(c, binId, { jammed: !!jammed });
    return Object.assign({ uid: c.uid, itemId: c.itemId, side: c.side, conceptId: c.conceptId, variantId: c.variantId, kind: c.kind, wave: c.wave, correctBin: c.bin, correctRank: c.rank, chosen: binId || null,
      chosenRank: binId ? rankOf(c.side, binId) : null, action: binId ? 'routed' : 'dropped', t, tell: c.tell, text: c.text, full: c.full, chips: c.chips }, j);
  }

  // ---------------------------------------------------------------- scoring
  function tally(entries) {
    const n = entries.length, ok = entries.filter((e) => e.correct), cost = entries.reduce((s, e) => s + (e.chosenRank == null ? 0 : RUN.costs[e.chosenRank]), 0), ideal = entries.reduce((s, e) => s + RUN.costs[e.correctRank], 0);
    return { total: n, correct: ok.length, accuracy: n ? ok.length / n : 1, severe: entries.filter((e) => e.severe).length, dropped: entries.filter((e) => e.action === 'dropped').length, lax: entries.filter((e) => e.direction === 'lax').length,
      strict: entries.filter((e) => e.direction === 'strict').length, overGated: entries.filter((e) => e.overGated).length, cost, idealCost: ideal };
  }
  const scoreShift = (log) => Object.assign(tally(log.entries), { index: log.index, kind: log.kind, side: log.side, desk: log.desk, deskCap: log.deskCap });
  // 3 stars: accuracy at least 85%, no spills and at most 2 dropped; 2: accuracy at least 65% and at most 2 spills; 1: finished; nothing for a run left early
  const starsFor = (s, finished) => (!finished ? 0 : s.accuracy >= 0.85 && s.severe === 0 && s.dropped <= 2 ? 3 : s.accuracy >= 0.65 && s.severe <= 2 ? 2 : 1);
  // per concept: attempts, correct, lax and strict errors, dropped, variants seen, and the variants CLEAN in this run: at least 75% of that variant's crates for the concept routed correctly
  // (and at least 3 of them, so a lone crate cannot count). Two clean variants on two runs make a mastered concept (the progress adapter applies that).
  function scoreRun(logs, opts) {
    const entries = logs.flatMap((l) => l.entries), finished = opts && opts.finished != null ? opts.finished : logs.length === RUN.shifts, perConcept = {}, groups = {};
    for (const e of entries) {
      const c = perConcept[e.conceptId] = perConcept[e.conceptId] || { attempts: 0, correct: 0, laxErrors: 0, strictErrors: 0, dropped: 0, variantsSeen: [], cleanVariants: [] };
      c.attempts++; if (e.correct) c.correct++; if (e.direction === 'lax') c.laxErrors++; if (e.direction === 'strict') c.strictErrors++; if (e.action === 'dropped') c.dropped++;
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      const g = groups[e.conceptId + '|' + e.variantId] = groups[e.conceptId + '|' + e.variantId] || { c: e.conceptId, v: e.variantId, n: 0, ok: 0 }; g.n++; if (e.correct) g.ok++;
    }
    for (const g of Object.values(groups)) if (g.n >= 3 && g.ok / g.n >= 0.75) perConcept[g.c].cleanVariants.push(g.v);
    const t = tally(entries);
    return Object.assign(t, { finished, stars: starsFor(t, finished), perConcept, shifts: logs.map(scoreShift) });
  }
  // up to n entries for a shift's debrief: severe first, then too lax, then too strict, then dropped; a new concept first while there is a choice
  function debriefPicks(log, n) {
    const rank = (e) => (e.severe ? 0 : e.direction === 'lax' ? 1 : e.direction === 'strict' ? 2 : e.direction === 'dropped' ? 3 : 9), bad = log.entries.filter((e) => rank(e) < 9).sort((a, b) => rank(a) - rank(b) || a.t - b.t), out = [], seen = new Set();
    for (const e of bad) if (out.length < (n || 3) && !seen.has(e.conceptId)) { out.push(e); seen.add(e.conceptId); }
    for (const e of bad) if (out.length < (n || 3) && !out.includes(e)) out.push(e);
    return out;
  }

  return { STAT, ZONE, SPEED, FINALE_DESK, SIDE_IDS, UNITS, ITEM, binXs, seedFor, composeRun, rerollShift, scheduleShift, plateFlips, estimateSeconds, maxInZone, twinPairs, countTraps, context, corr, normalizeBrakes, beltClock, cratePos, inZone, binAt,
    judge, entryFor, deskState, playShift, scoreShift, scoreRun, starsFor, debriefPicks, rankOf, beltSecOf };
});
