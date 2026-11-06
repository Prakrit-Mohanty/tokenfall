// Spot Shot — engine: the run generator, the round scheduler, the hit test, judging and scoring. Pure and deterministic (no Math.random, no DOM, no clock).
// Built on bridge-generator.js (imported, not copied): the seeded helpers hash32, mulberry32, pick, shuffle, weightedPick, sampleParams.
// Browser: window.GalleryEngine. Node: require('./gallery-engine.js').
//
//   seedFor(playerId, runIndex)       -> 32-bit seed = hash('gallery:' + playerId + ':' + runIndex): its own stream, not the bridge's, carrom's or the tower's
//   composeRun(seed, history)         -> runSpec (plain JSON)
//   scheduleRound(round)              -> [{ uid, itemId, lane, dir, x0, popup, rise, dur, speed, spawnTime, endTime }]
//   rerollRound(spec, i)              -> { spec, round }     a fresh draw for round i (same side, or the finale); every other round stays
//   cardPose(entry, t) / hitTest(entries, t, ray, skip) / rayFromNdc(cam, aspect, nx, ny) / ndcOf(cam, aspect, point)      the aiming geometry (stall-local metres)
//   judge(item, action, inspected)    -> { correct, lucky, event, action }
//   playRound(round, inputs, opts)    -> log         a scripted round: the same spec and inputs always give the same log (the tests' replay)
//   scoreRound(log) / scoreRun(logs)  -> catch rate, accuracy, leaks, friendly fire, stars, per concept
//   debriefPicks(log, n)              -> up to 3 entries for the round debrief: mistakes first, then the trap items
//
// history (all optional, the shape the shared store hands over):
//   { runs: [ { items: ['XC1a.1', ...] }, ... ],                                   // oldest -> newest: every item shown
//     concepts: { XC1: { attempts, misses, mastered }, ... } }                      // mastered = clean handling in two different variants across runs
//
// runSpec: { v, game, seed, avoid, order, magnifier, estSeconds, rounds: [round x 5] }
//   round: { index, kind: 'side' | 'finale', side, brief | null, banner?, concepts, lead, pairs, threats, ammo, traversal, spacing, rseed, playSec, items, schedule }
//   item (a record, strings already filled): { uid, itemId, side, conceptId, variantId, twin, cue, shoot, kind, params, card, inspect, stamp, tell, leak | friendly }
//   Every round is built from twin pairs: a threat and a legit card that share a surface cue, so no single cue gives the answer. Whether a card is a threat is drawn
//   independently of its lane, direction, speed, spawn time, popup flag and text length; the ammo is always threats + 2.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./gallery-content.js') : root.GALLERY_CONTENT, isNode ? require('./bridge-generator.js') : root.BridgeGenerator);
  if (isNode) module.exports = api;
  else root.GalleryEngine = api;
})(this, function (C, BG) {
  const { SIDE_IDS, RUN, FINALE } = C;
  const ATTEMPTS = 40, MIN_GAP = 2.2, LEAD = 0.8, POP_RISE = 0.45, POP_CHANCE = 0.3, BRIEF_FINALE = 3;
  const seedFor = (playerId, runIndex) => BG.hash32('gallery:' + playerId + ':' + runIndex);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---------------------------------------------------------------- the bank, indexed by twin pair
  const PAIRS = [], PAIRS_BY_SIDE = {}, ITEM = {}, VARIANT = {};
  for (const c of C.CONCEPTS) for (const v of c.variants) {
    VARIANT[v.id] = { concept: c, variant: v };
    const cues = {};
    for (const it of v.items) { ITEM[it.id] = it; (cues[it.cue] = cues[it.cue] || {})[it.shoot ? 'T' : 'L'] = it; }
    for (const cue of Object.keys(cues)) if (cues[cue].T && cues[cue].L) {
      const p = { key: v.id + ':' + cue, side: c.side, conceptId: c.id, variantId: v.id, cue, T: cues[cue].T, L: cues[cue].L };
      PAIRS.push(p); (PAIRS_BY_SIDE[c.side] = PAIRS_BY_SIDE[c.side] || []).push(p);
    }
  }
  const PAIR = Object.fromEntries(PAIRS.map((p) => [p.key, p]));

  // an item with its placeholders filled; a variant's params are sampled once per round, from a stream of its own
  function record(item, rseed) {
    const { concept, variant } = VARIANT[item.id.replace(/\.\d+$/, '')], params = BG.sampleParams(BG.mulberry32(BG.hash32(rseed + ':' + variant.id)), variant.params), e = C.expand(item, params);
    const r = { uid: item.id, itemId: item.id, side: concept.side, conceptId: concept.id, variantId: variant.id, twin: variant.id + ':' + item.cue, cue: item.cue, shoot: item.shoot, kind: item.kind, params,
      card: e.card, inspect: e.inspect, stamp: e.stamp, tell: e.tell };
    r[item.shoot ? 'leak' : 'friendly'] = item.shoot ? e.leak : e.friendly;
    return r;
  }
  const countTraps = (items) => items.filter((i) => i.kind === 'trap').length;
  function twinPairs(items) {   // twin pairs that survive in a round: a key with both a threat and a legit card
    const m = {}; for (const i of items) (m[i.twin] = m[i.twin] || { T: 0, L: 0 })[i.shoot ? 'T' : 'L']++;
    return Object.values(m).filter((x) => x.T && x.L).length;
  }

  // ---------------------------------------------------------------- what the generator reads from the player's history
  function context(history) {
    const runs = (history && history.runs) || [], items = (r) => (r && r.items) || [];
    const recent = new Set(); runs.slice(-3).forEach((r) => items(r).forEach((i) => recent.add(i)));
    return { last: new Set(items(runs[runs.length - 1])), recent, concepts: (history && history.concepts) || {} };
  }
  const missed = (h) => (h.misses != null ? h.misses : h.wrongTries || 0);
  const conceptWeight = (ctx, id) => { const h = ctx.concepts[id] || {}; return (h.mastered ? 0.35 : 1.4) + 0.6 * Math.min(missed(h), 4); };   // the shared rule: weak concepts come back, mastered ones less

  // n distinct twin pairs of a side: not in `used`, and each pick from the freshest tier that has any: pairs with no card from the player's last 3 runs, else none from the last run,
  // else any (a bank of 48 cards per side cannot always avoid three runs of 13). Within the tier the weaker concepts weigh more, and a concept already picked weighs less so a round
  // spreads over the lessons. Returns the pairs (the caller marks them used).
  function pickPairs(rng, side, n, ctx, used) {
    const left = PAIRS_BY_SIDE[side].filter((p) => !used.has(p.T.id) && !used.has(p.L.id)), out = [], cnt = {};
    const seenIn = (set) => (p) => set.has(p.T.id) || set.has(p.L.id);
    for (let k = 0; k < n && left.length; k++) {
      const tiers = [left.filter((p) => !seenIn(ctx.recent)(p)), left.filter((p) => !seenIn(ctx.last)(p)), left], pool = tiers.find((t) => t.length);
      const w = (p) => conceptWeight(ctx, p.conceptId) * Math.pow(0.55, cnt[p.conceptId] || 0);
      const p = BG.weightedPick(rng, pool, w); out.push(p); cnt[p.conceptId] = (cnt[p.conceptId] || 0) + 1; left.splice(left.indexOf(p), 1);
    }
    return out;
  }
  const mark = (used, pairs) => pairs.forEach((p) => { used.add(p.T.id); used.add(p.L.id); });

  // ---------------------------------------------------------------- one round
  const finishRound = (r, items, pairs, rseed, extra) => {
    const round = Object.assign({ pairs: pairs.map((p) => p.key), threats: items.filter((i) => i.shoot).length, ammo: 0, traversal: r.traversal, spacing: r.spacing, rseed, items }, extra);
    round.ammo = round.threats + RUN.ammoExtra; round.schedule = scheduleRound(round); round.playSec = playSecOf(round.schedule);
    return round;
  };
  // 10 cards from 6 twin pairs: a threat count drawn from 4, 5 or 6 keeps the ratio between 0.4 and 0.6 and never constant; the rest are dropped at random from both halves
  function sideRound(rng, index, side, ctx, used, seed, tag) {
    for (let a = 0; a < ATTEMPTS; a++) {
      const pairs = pickPairs(rng, side, 6, ctx, used), tk = BG.pick(rng, [4, 5, 6]);
      const chosen = BG.shuffle(rng, BG.shuffle(rng, pairs.map((p) => p.T)).slice(0, tk).concat(BG.shuffle(rng, pairs.map((p) => p.L)).slice(0, RUN.items - tk)));
      const rseed = BG.hash32(seed + ':round:' + index + tag), items = chosen.map((it) => record(it, rseed));
      if (countTraps(items) < 2 || twinPairs(items) < 2) continue;
      const lead = VARIANT[pairs[0].variantId].variant, concepts = [...new Set(items.map((i) => i.conceptId))];
      return { pairs, round: finishRound({ traversal: RUN.traversal, spacing: RUN.spacing }, items, pairs, rseed, { index, kind: 'side', side, brief: lead.brief, banner: null, lead: lead.id, concepts }) };
    }
    throw new Error('no round for ' + side + ' seed ' + seed);
  }
  // the finale: 12 cards, 3 from each side: one twin pair and one more card (4 pairs, 4 singles); the threat count is 5, 6 or 7
  function finaleRound(rng, index, ctx, used, seed, tag) {
    for (let a = 0; a < ATTEMPTS; a++) {
      const local = new Set(used), tk = BG.pick(rng, [5, 6, 7]), polarity = BG.shuffle(rng, [0, 1, 2, 3].map((i) => i < tk - 4)), picked = [], items0 = [];
      BG.shuffle(rng, SIDE_IDS).forEach((side, i) => {
        const [p] = pickPairs(rng, side, 1, ctx, local); mark(local, [p]);
        const [q] = pickPairs(rng, side, 1, ctx, local); mark(local, [q]);
        picked.push(p, q); items0.push(p.T, p.L, polarity[i] ? q.T : q.L);
      });
      const rseed = BG.hash32(seed + ':round:' + index + tag), items = BG.shuffle(rng, items0).map((it) => record(it, rseed));
      if (countTraps(items) < FINALE.minTraps || twinPairs(items) < FINALE.minPairs || SIDE_IDS.some((s) => items.filter((i) => i.side === s).length < FINALE.minPerSide)) continue;
      const concepts = [...new Set(items.map((i) => i.conceptId))];
      return { pairs: picked, round: finishRound({ traversal: FINALE.traversal, spacing: 3.0 }, items, picked, rseed, { index, kind: 'finale', side: 'rush', brief: null, banner: FINALE.banner, lead: null, concepts }) };
    }
    throw new Error('no finale for seed ' + seed);
  }

  function composeRun(seed, history) {
    const rng = BG.mulberry32(seed), ctx = context(history), used = new Set(), order = BG.shuffle(rng, SIDE_IDS), rounds = [];
    order.forEach((side, i) => { const r = sideRound(rng, i, side, ctx, used, seed, ''); mark(used, r.pairs); rounds.push(r.round); });
    rounds.push(finaleRound(rng, order.length, ctx, used, seed, '').round);
    const spec = { v: 1, game: 'gallery', seed, avoid: [...ctx.recent], order, magnifier: RUN.magnifier, estSeconds: 0, rounds };
    spec.estSeconds = estimateSeconds(spec);
    return spec;
  }
  // a fresh draw for round i: the same side (or the finale), none of the pairs any round of the run already uses; the other rounds are untouched
  function rerollRound(spec, i, history) {
    const s = clone(spec), old = s.rounds[i], n = ((s.rerolls = s.rerolls || {})[i] = (s.rerolls[i] || 0) + 1), tag = ':reroll' + n, ctx = context(history || { runs: [{ items: [...s.avoid] }] });
    const rng = BG.mulberry32(BG.hash32(s.seed + ':reroll:' + i + ':' + n)), used = new Set();
    s.rounds.forEach((r) => r.pairs.forEach((key) => mark(used, [PAIR[key]])));   // the old round's pairs too: a reroll is never the same draw
    const r = old.kind === 'finale' ? finaleRound(rng, i, ctx, used, s.seed, tag) : sideRound(rng, i, old.side, ctx, used, s.seed, tag);
    s.rounds[i] = r.round; s.estSeconds = estimateSeconds(s);
    return { spec: s, round: r.round };
  }

  // ---------------------------------------------------------------- the schedule: lanes, directions, speeds, spawn times, popups
  // Lanes come from a shuffled bag (nearly uniform, never the same lane twice running) and every other draw ignores what the card is, so none of them can tell a threat from a legit one.
  // Even lanes slide left to right, odd lanes right to left. A popup rises behind the barrier part-way along its lane (x0 > 0), slower so it stays on screen as long as the others.
  const FIELD = { cardW: 1.1, rail: 4.2 }, GAP = FIELD.cardW / FIELD.rail + 0.05;   // two cards of one lane never come closer than a card width and a hand
  const dirOf = (lane) => (lane % 2 === 0 ? 1 : -1);
  const exitAt = (e) => e.spawnTime + e.rise + e.dur;
  function progress(e, t) {   // 0..1 along the lane, or null before it appears and after it has left
    const a = t - e.spawnTime; if (a < 0) return null;
    if (a < e.rise) return e.x0;
    const p = e.x0 + e.speed * (a - e.rise); return p >= 1 ? null : p;
  }
  const clashes = (e, others) => others.some((o) => {
    if (o.lane !== e.lane) return false;
    for (let t = Math.max(o.spawnTime, e.spawnTime); t < Math.min(exitAt(o), exitAt(e)); t += 0.1) { const a = progress(o, t), b = progress(e, t); if (a != null && b != null && Math.abs(a - b) < GAP) return true; }
    return false;
  });
  function scheduleRound(round) {
    const rng = BG.mulberry32(BG.hash32(round.rseed + ':sched')), [t0, t1] = round.traversal, out = [];
    let bag = [], last = -1, spawn = LEAD;
    const nextLane = () => {
      if (!bag.length) { do { bag = BG.shuffle(rng, [0, 1, 2]); } while (bag[0] === last); }
      return (last = bag.shift());
    };
    round.items.forEach((it, i) => {
      if (i) spawn = Math.max(out[i - 1].spawnTime + MIN_GAP, LEAD + i * round.spacing + (rng() * 2 - 1) * 0.5);
      const dur = t0 + rng() * (t1 - t0), lane0 = nextLane(), wantPop = rng() < POP_CHANCE, x0w = 0.2 + rng() * 0.35;
      let e = null;
      for (let d = 0; !e; d += 0.5) {
        for (const pop of wantPop ? [true, false] : [false]) for (let k = 0; k < 3 && !e; k++) {
          const lane = (lane0 + k) % 3, x0 = pop ? x0w : 0;
          const c = { uid: it.uid, itemId: it.itemId, lane, dir: dirOf(lane), x0, popup: pop, rise: pop ? POP_RISE : 0, dur, speed: (1 - x0) / dur, spawnTime: spawn + d };
          if (!clashes(c, out)) { c.endTime = exitAt(c); e = c; }
        }
      }
      last = e.lane; out.push(e);
    });
    return out;
  }
  const playSecOf = (schedule) => schedule.reduce((m, e) => Math.max(m, e.endTime), 0);
  const maxOnScreen = (schedule) => { let m = 0; for (const e of schedule) m = Math.max(m, schedule.filter((o) => o.spawnTime <= e.spawnTime && exitAt(o) > e.spawnTime).length); return m; };
  const estimateSeconds = (spec) => spec.rounds.reduce((s, r) => s + (r.kind === 'finale' ? BRIEF_FINALE : RUN.brief) + r.playSec + RUN.debrief, 0);

  // ---------------------------------------------------------------- the aiming geometry (stall-local metres: x right, y up, z into the stall; the counter is at z = 0)
  // Three shelves at different depths, each higher than the one in front; the camera sits behind the counter and looks at all three. In the lobby, x is the world's x and z runs north from the
  // counter (world z = counter z - local z), so the camera looks north with +x on its right.
  const LAYOUT = {
    rail: FIELD.rail, cardW: FIELD.cardW, cardH: 0.76, pad: 0.05, riseDrop: 0.78,
    lanes: [{ z: 0.9, y: 1.32 }, { z: 1.6, y: 1.84 }, { z: 2.3, y: 2.36 }],
    camera: { pos: [0, 2.0, -2.7], look: [0, 1.55, 1.4], fov: 50 },
  };
  function cardPose(e, t) {   // { x, y, z, p, state }; the state is 'pending', 'rising', 'moving' or 'gone'
    const a = t - e.spawnTime, lane = LAYOUT.lanes[e.lane];
    if (a < 0) return { state: 'pending' };
    const p = progress(e, t); if (p == null) return { state: 'gone' };
    const x = (e.dir > 0 ? -1 : 1) * (LAYOUT.rail / 2) * (1 - 2 * p);
    if (a < e.rise) { const k = a / e.rise; return { x, y: lane.y - LAYOUT.riseDrop * (1 - k * k * (3 - 2 * k)), z: lane.z, p, state: 'rising' }; }
    return { x, y: lane.y, z: lane.z, p, state: 'moving' };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function basis(cam) { const f = unit(sub(cam.look, cam.pos)), r = unit(cross([0, 1, 0], f)), u = cross(f, r); return { f, r, u, th: Math.tan(cam.fov * Math.PI / 360) }; }   // x right, y up, z forward is a left-handed frame: right = up x forward
  function rayFromNdc(cam, aspect, nx, ny) {   // from the camera through the reticle (nx, ny in -1..1)
    const b = basis(cam), d = [0, 1, 2].map((k) => b.f[k] + b.r[k] * nx * b.th * aspect + b.u[k] * ny * b.th);
    return { o: cam.pos.slice(), d: unit(d) };
  }
  function ndcOf(cam, aspect, P) { const b = basis(cam), v = sub(P, cam.pos), zc = dot(v, b.f); return { x: dot(v, b.r) / (zc * b.th * aspect), y: dot(v, b.u) / (zc * b.th) }; }
  // the front-most card under the ray: each card is a vertical rectangle on its shelf, so the nearest plane wins; a card that is still rising behind the barrier or has gone cannot be hit
  function hitTest(entries, t, ray, skip) {
    let best = null;
    for (const e of entries) {
      if (skip && skip.has(e.uid)) continue;
      const c = cardPose(e, t); if (c.state !== 'moving') continue;
      const k = (c.z - ray.o[2]) / ray.d[2]; if (!(k > 0)) continue;
      const x = ray.o[0] + ray.d[0] * k, y = ray.o[1] + ray.d[1] * k;
      if (Math.abs(x - c.x) <= LAYOUT.cardW / 2 + LAYOUT.pad && Math.abs(y - c.y) <= LAYOUT.cardH / 2 + LAYOUT.pad && (!best || k < best.k)) best = { uid: e.uid, k, x, y };
    }
    return best;
  }

  // ---------------------------------------------------------------- judging
  // action: 'shot', or 'delivered' / 'leaked' for a card that reached the counter (the two are one event seen from each side: a threat that gets through is a leak, a legit card is delivered).
  // lucky = right, but on a trap nobody inspected first: it scores in the round and never counts towards mastery.
  function judge(item, action, inspected) {
    let a = action, correct, event;
    if (a !== 'shot') a = item.shoot ? 'leaked' : 'delivered';
    if (a === 'shot') { correct = !!item.shoot; event = item.shoot ? 'stopped' : 'friendly'; } else if (a === 'leaked') { correct = false; event = 'leak'; } else { correct = true; event = 'delivered'; }
    return { correct, lucky: correct && item.kind === 'trap' && !inspected, event, action: a };
  }

  // a scripted round. inputs: [{ t, kind: 'shoot' | 'inspect', nx, ny }] (the reticle in -1..1); a shot that hits nothing still costs a token, and at zero tokens a shot does nothing.
  function playRound(round, inputs, opts) {
    const o = Object.assign({ cam: LAYOUT.camera, aspect: 16 / 9, charges: RUN.magnifier }, opts), sched = round.schedule, byUid = Object.fromEntries(round.items.map((i) => [i.uid, i]));
    const shotAt = {}, inspected = new Set(), log = { index: round.index, kind: round.kind, side: round.side, ammoStart: round.ammo, ammoLeft: round.ammo, charges: o.charges, dry: 0, shots: [], inspects: [], entries: [] };
    const skip = new Set();
    inputs.map((x, i) => [x, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).forEach(([x]) => {
      const hit = hitTest(sched, x.t, rayFromNdc(o.cam, o.aspect, x.nx, x.ny), skip);
      if (x.kind === 'shoot') {
        if (log.ammoLeft <= 0) { log.dry++; return; }
        log.ammoLeft--; log.shots.push({ t: x.t, uid: hit ? hit.uid : null });
        if (hit) { shotAt[hit.uid] = x.t; skip.add(hit.uid); }
      } else if (x.kind === 'inspect' && hit && !inspected.has(hit.uid) && log.charges > 0) { log.charges--; inspected.add(hit.uid); log.inspects.push({ t: x.t, uid: hit.uid }); }
    });
    for (const e of sched) { const shot = shotAt[e.uid] != null; log.entries.push(entryFor(byUid[e.uid], shot ? 'shot' : 'passed', inspected.has(e.uid), shot ? shotAt[e.uid] : e.endTime)); }
    return log;
  }
  // what a round's log keeps about one card once it is settled: the item's own words (for the debrief), what the player did and how it was judged
  function entryFor(it, action, inspected, t) {
    const j = judge(it, action, inspected);
    return { uid: it.uid, itemId: it.itemId, side: it.side, conceptId: it.conceptId, variantId: it.variantId, twin: it.twin, shoot: it.shoot, kind: it.kind, stamp: it.stamp, tell: it.tell, card: it.card,
      inspect: it.inspect, why: it.shoot ? it.leak : it.friendly, action: j.action, event: j.event, correct: j.correct, lucky: j.lucky, inspected: !!inspected, t };
  }

  // ---------------------------------------------------------------- scoring
  function tally(entries) {
    const threats = entries.filter((e) => e.shoot), shots = entries.filter((e) => e.action === 'shot'), stopped = threats.filter((e) => e.action === 'shot');
    return { threats: threats.length, stopped: stopped.length, catchRate: threats.length ? stopped.length / threats.length : 1, shotsAtCards: shots.length, correctShots: stopped.length,
      accuracy: shots.length ? stopped.length / shots.length : null, leaks: threats.length - stopped.length, friendly: shots.length - stopped.length, delivered: entries.filter((e) => !e.shoot && e.action === 'delivered').length,
      lucky: entries.filter((e) => e.lucky).length, trapsInspected: entries.filter((e) => e.kind === 'trap' && e.correct && e.inspected).length };
  }
  const scoreRound = (log) => Object.assign(tally(log.entries), { index: log.index, kind: log.kind, side: log.side, emptyShots: log.shots.filter((s) => !s.uid).length, ammoLeft: log.ammoLeft, ammoStart: log.ammoStart });
  // 3 stars: catch rate and accuracy both at least 85% and at least 3 traps correctly inspected; 2: both at least 65%; 1: finished. An unfinished run (Esc) earns none. No shots at cards = no accuracy.
  const starsFor = (s, finished) => (!finished ? 0 : s.catchRate >= 0.85 && s.accuracy != null && s.accuracy >= 0.85 && s.trapsInspected >= 3 ? 3 : s.catchRate >= 0.65 && s.accuracy != null && s.accuracy >= 0.65 ? 2 : 1);
  // per concept: attempts, how many were handled right, lucky shots and verified (inspected) correct traps, and the variants handled cleanly this run: every card of that concept in the variant
  // was handled right and none was a lucky guess on a trap. Two clean variants on two runs make a mastered concept (the progress adapter applies that).
  function scoreRun(logs, opts) {
    const entries = logs.flatMap((l) => l.entries), finished = opts && opts.finished != null ? opts.finished : logs.length === RUN.rounds, perConcept = {};
    for (const e of entries) {
      const c = perConcept[e.conceptId] = perConcept[e.conceptId] || { attempts: 0, correctHandled: 0, wrong: 0, luckyShots: 0, inspectedCorrect: 0, variantsSeen: [], cleanVariants: [], _bad: {} };
      c.attempts++; e.correct ? c.correctHandled++ : c.wrong++;
      if (e.lucky) c.luckyShots++; if (e.kind === 'trap' && e.correct && e.inspected) c.inspectedCorrect++;
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (!e.correct || e.lucky) c._bad[e.variantId] = true;
    }
    for (const c of Object.values(perConcept)) { c.cleanVariants = c.variantsSeen.filter((v) => !c._bad[v]); delete c._bad; }
    const t = tally(entries);
    return Object.assign(t, { finished, stars: starsFor(t, finished), perConcept, rounds: logs.map(scoreRound) });
  }
  // up to n cards for a round's debrief: what the player got wrong first (a leak, then friendly fire), then the trap items, lucky guesses before verified ones; one card per concept while there is a choice
  function debriefPicks(log, n) {
    const rank = (e) => (!e.correct ? (e.event === 'leak' ? 0 : 1) : e.kind === 'trap' ? (e.lucky ? 2 : 3) : 9), sorted = log.entries.filter((e) => rank(e) < 9).sort((a, b) => rank(a) - rank(b) || a.t - b.t), out = [];
    for (const group of [sorted.filter((e) => !e.correct), sorted.filter((e) => e.correct)]) {   // all the mistakes before any trap item; within a group, new concepts first
      const seen = new Set();
      for (const e of group) if (out.length < (n || 3) && !seen.has(e.conceptId)) { out.push(e); seen.add(e.conceptId); }
      for (const e of group) if (out.length < (n || 3) && !out.includes(e)) out.push(e);
    }
    return out;
  }

  return { LAYOUT, SIDE_IDS, PAIRS, ITEM, seedFor, composeRun, rerollRound, scheduleRound, estimateSeconds, maxOnScreen, twinPairs, countTraps, conceptWeight, context,
    cardPose, progress, hitTest, rayFromNdc, ndcOf, judge, entryFor, playRound, scoreRound, scoreRun, starsFor, debriefPicks, GAP, POP_RISE };
});
