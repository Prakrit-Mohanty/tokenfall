// Token Tower — run generator. Pure and deterministic: same (seed, history) -> identical runSpec JSON. Built on bridge-generator.js (imported, not copied):
// the seeded helpers (hash32, mulberry32, pick, shuffle, weightedPick, sampleParams, fill), conceptWeight, recentInfo and eligibleVariants (the last 3 runs' anti-repeat).
// Browser: window.JengaGenerator. Node: require('./jenga-generator.js').
//
//   seedFor(playerId, runIndex)        -> 32-bit seed = hash('jenga:' + playerId + ':' + runIndex): its own stream, not the bridge's or carrom's
//   composeRun(seed, history)          -> runSpec (plain JSON)
//   rerollQuestion(spec, index)        -> { spec, question }   a fresh variant of the same concept; the blocks, the correct number and the placement stay, so later towers hold
//   resolveQuestion(tower, question)   -> question | null      at question time: if the player's earlier placements made a candidate unpullable, re-pick the blocks (texts and numbers stay)
//   replay(spec, upTo)                 -> tower                the tower after the first `upTo` questions along the canonical path
//   estimateSeconds(spec)              -> 7 x about 35 s
//
// history (all optional, the shape the shared store hands over):
//   { runs: [ { variants: ['JA1a', ...] }, ... ],                          // oldest -> newest
//     concepts: { JA1: { attempts, wrongTries, mastered }, ... } }          // mastered = first-try pulls right in two different variants on two runs
//
// runSpec: { v, game, seed, avoid, seen, start: { tower, pulled }, clockSec, paceSec, estSeconds, finale: { scenario }, questions }
//   question: { id, index, kind: 'side' | 'finale', side, conceptId, title, variantId, scenario, params, stem, idea, rank, rseed, view: { corner, sx, sz },
//               options: [ { n: 1..4, blockId, layer, uCoord, slot, face, text, correct, id, breaks? } ], correctN, place: { layer, uCoord } }
//   rank = the correct tag's length rank among the four (0 = shortest). The bank's correct tags run long, so each question's target rank is balanced across the run and the
//   variant and the three wrong tags are chosen to land on it: otherwise "the longest tag is right" would be a tell.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./jenga-content.js') : root.JENGA_CONTENT, isNode ? require('./jenga-engine.js') : root.JengaEngine, isNode ? require('./bridge-generator.js') : root.BridgeGenerator);
  if (isNode) module.exports = api;
  else root.JengaGenerator = api;
})(this, function (C, E, BG) {
  const { CARDS } = C;
  const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const SIDE_IDS = ['approach', 'agents', 'proof', 'pilot'], FINALE = ['JF1', 'JF2', 'JF3'];
  const PACE = 35, CLOCK = 300, ATTEMPTS = 40, CORNERS = ['NE', 'NW', 'SE', 'SW'];
  const seedFor = (playerId, runIndex) => BG.hash32('jenga:' + playerId + ':' + runIndex);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---------------------------------------------------------------- the words: variants, params, the three wrong tags, the length rank
  function rankVec(correctLen, wrongLens) {   // where the correct tag's length falls among the four; a tie shares its rank (the same rule jenga-tests.js applies)
    const v = [0, 0, 0, 0], lo = wrongLens.filter((x) => x < correctLen).length, ties = wrongLens.filter((x) => x === correctLen).length;
    for (let k = 0; k <= ties; k++) v[lo + k] += 1 / (ties + 1);
    return v;
  }
  function entriesFor(rng, variant) {   // one param sample, every choice of 3 wrong tags
    let b = null;
    for (let i = 0; i < 12 && !b; i++) { const p = BG.sampleParams(rng, variant.params), d = C.derive(variant, p); if (d) b = Object.assign({}, p, d); }
    const f = (s) => BG.fill(s, b), wrong = variant.wrong.map((w) => ({ id: w.id, text: f(w.text), breaks: f(w.breaks) })), correct = f(variant.correct), out = [];
    for (let i = 0; i < wrong.length; i++) for (let j = i + 1; j < wrong.length; j++) for (let k = j + 1; k < wrong.length; k++) {
      const tri = [wrong[i], wrong[j], wrong[k]];
      out.push({ variant, params: b, stem: f(variant.stem), correct, tri, vec: rankVec(correct.length, tri.map((w) => w.text.length)) });
    }
    return out;
  }
  const mass = (list, r) => list.reduce((a, e) => a + e.vec[r], 0) / list.length;
  function chooseEntry(rng, byVariant, r) {   // variants by how well they reach rank r, then the triple
    const vs = byVariant.map((l) => ({ l, w: mass(l, r) })), total = vs.reduce((a, x) => a + x.w, 0);
    const list = (total > 0 ? BG.weightedPick(rng, vs, (x) => x.w) : BG.pick(rng, vs)).l;
    return total > 0 ? BG.weightedPick(rng, list, (e) => e.vec[r]) : BG.pick(rng, list);
  }
  const feasible = (byVariant) => [0, 1, 2, 3].filter((r) => byVariant.some((l) => l.some((e) => e.vec[r] > 0)));

  // ---------------------------------------------------------------- the questions (everything but the blocks)
  function planQuestions(rng, history) {
    const info = BG.recentInfo(history), wh = { concepts: {} };
    for (const id in (history && history.concepts) || {}) { const c = history.concepts[id]; wh.concepts[id] = { mastered: c.mastered, falls: c.wrongTries != null ? c.wrongTries : c.falls || 0 }; }
    const used = new Set(), slots = [];
    for (const side of BG.shuffle(rng, SIDE_IDS)) {
      const cards = CARDS.filter((c) => c.side === side), card = BG.weightedPick(rng, cards, (c) => BG.conceptWeight(wh, c.id));
      const vs = BG.eligibleVariants(card, info, used); vs.forEach((v) => used.add(v.id));
      slots.push({ kind: 'side', side, card, pool: vs.map((v) => entriesFor(rng, v)) });
    }
    const scenarios = [...new Set(CARD.JF1.variants.map((v) => v.scenario))];
    const fresh = scenarios.filter((s) => !FINALE.some((id) => CARD[id].variants.some((v) => v.scenario === s && info.recent.has(v.id))));
    const scenario = BG.pick(rng, fresh.length ? fresh : scenarios);
    for (const id of FINALE) { const v = CARD[id].variants.find((x) => x.scenario === scenario); slots.push({ kind: 'finale', side: 'case', card: CARD[id], pool: [entriesFor(rng, v)] }); }
    // balance the target ranks across the run: each question, in random order, takes the least-used rank its card can reach
    const counts = [0, 0, 0, 0];
    for (const i of BG.shuffle(rng, slots.map((_, i) => i))) {
      const F = feasible(slots[i].pool), least = Math.min(...F.map((r) => counts[r]));
      slots[i].rank = BG.pick(rng, F.filter((r) => counts[r] === least)); counts[slots[i].rank]++;
    }
    return { scenario, items: slots.map((s) => ({ slot: s, entry: chooseEntry(rng, s.pool, s.rank) })) };
  }

  // ---------------------------------------------------------------- the blocks
  const sidesOf = (corner) => ({ sx: corner[1] === 'E' ? 1 : -1, sz: corner[0] === 'S' ? 1 : -1 });   // the two faces the camera sees from this corner
  const faceOf = (b, v) => (b.layer % 2 === 0 ? (v.sx > 0 ? 'E' : 'W') : (v.sz > 0 ? 'S' : 'N'));
  function pickCandidates(rng, tower) {
    const top = E.topLayer(tower), pool = E.blocks(tower).filter((b) => b.layer >= 2 && b.layer <= top - 2 && E.canPull(tower, b.id));   // pullable ones only, so the slot draw below is fair
    for (let t = 0; t < 30 && pool.length >= 4; t++) {
      const left = pool.slice(), got = [];
      while (got.length < 4 && left.length) {
        const slot = BG.pick(rng, [...new Set(left.map(E.slotOf))]), b = BG.pick(rng, left.filter((x) => E.slotOf(x) === slot));
        left.splice(left.indexOf(b), 1);
        if (!got.some((g) => g.layer === b.layer)) got.push(b);
      }
      if (got.length === 4 && got.some((b) => b.layer % 2) && got.some((b) => b.layer % 2 === 0)) return got;
    }
    return null;
  }
  function placeable(tower, blockId) {   // after the correct pull, a fifth or more of the lateral span must still be stable
    const r = E.placementRange(E.applyPull(tower, blockId), { id: blockId });
    return r.ranges.length > 0 && r.free >= E.LIM.free ? r : null;
  }
  const optionFor = (b, v) => ({ blockId: b.id, layer: b.layer, uCoord: b.uCoord, slot: E.slotOf(b), face: faceOf(b, v) });
  function dealBlocks(q, blocks) { q.options.forEach((o, i) => Object.assign(o, optionFor(blocks[i], q.view))); }

  function valid(tower, q) {
    const top = E.topLayer(tower), bs = q.options.map((o) => E.find(tower, o.blockId));
    if (bs.some((b) => !b || b.layer < 2 || b.layer > top - 2 || !E.canPull(tower, b.id))) return false;
    if (new Set(bs.map((b) => b.layer)).size < 4 || !bs.some((b) => b.layer % 2) || !bs.some((b) => b.layer % 2 === 0)) return false;
    return !!placeable(tower, q.options.find((o) => o.correct).blockId);
  }
  // the player's earlier placements shift the weight above every layer, so a block that was pullable in the plan may not be now: re-pick the blocks, never the words
  function resolveQuestion(tower, q) {
    if (valid(tower, q)) return q;
    const rng = BG.mulberry32(BG.hash32(q.rseed + ':' + E.blocks(tower).length + ':' + E.topLayer(tower))), out = clone(q);
    for (let t = 0; t < 20; t++) {
      const B = pickCandidates(rng, tower); if (!B) return null;
      const bs = BG.shuffle(rng, B); dealBlocks(out, bs);
      if (placeable(tower, bs[out.correctN - 1].id)) return out;
    }
    return null;
  }

  // ---------------------------------------------------------------- composing
  function buildQuestion(item, i, seed, rng) {
    const { slot, entry } = item, texts = BG.shuffle(rng, [{ text: entry.correct, correct: true, id: entry.variant.id + '.c' }].concat(entry.tri.map((w) => Object.assign({ correct: false }, w))));
    const view = Object.assign({ corner: BG.pick(rng, CORNERS) }, {}); Object.assign(view, sidesOf(view.corner));
    const lens = texts.map((t) => t.text.length), ci = texts.findIndex((t) => t.correct);
    const options = texts.map((t, k) => { const o = { n: k + 1, text: t.text, correct: t.correct, id: t.id }; if (t.breaks) o.breaks = t.breaks; return o; });
    return {
      id: 'q' + (i + 1), index: i, kind: slot.kind, side: slot.side, conceptId: slot.card.id, title: slot.card.title, variantId: entry.variant.id, scenario: entry.variant.scenario || null,
      params: entry.params, stem: entry.stem, idea: slot.card.idea, rank: lens.filter((x) => x < lens[ci]).length, rseed: BG.hash32(seed + ':q' + i), view, options, correctN: ci + 1, place: null,
    };
  }
  // walk the run as a player would: pull the correct block, drop it at the policy's spot; null when any question cannot be placed
  function walk(spec, policy, canonical, rng) {
    let T = clone(spec.start.tower);
    for (const q of spec.questions) {
      let cur = q;
      if (canonical && !q.options[0].blockId) {   // first pass: choose the blocks now
        let done = false;
        for (let t = 0; t < 25 && !done; t++) {
          const B = pickCandidates(rng, T); if (!B) return null;
          const bs = BG.shuffle(rng, B), cb = bs[q.correctN - 1];
          if (placeable(T, cb.id)) { dealBlocks(q, bs); done = true; }
        }
        if (!done) return null;
      } else if (!canonical) { cur = resolveQuestion(T, q); if (!cur) return null; }
      const o = cur.options[cur.correctN - 1], r = placeable(T, o.blockId);
      if (!r) return null;
      const u = E.choosePlacement(r, policy), res = E.applyPlace(E.applyPull(T, o.blockId), { id: o.blockId, answerText: o.text }, u, r.layer);
      if (canonical) q.place = { layer: res.layer, uCoord: u };
      T = res.tower;
    }
    return T;
  }
  function composeRun(seed, history) {
    const info = BG.recentInfo(history), plan = planQuestions(BG.mulberry32(seed), history);
    for (let a = 0; a < ATTEMPTS; a++) {
      const rng = BG.mulberry32((seed ^ Math.imul(a + 1, 0x9e3779b1)) >>> 0), start = E.makeTower(rng);
      const spec = { v: 1, game: 'tower', seed, avoid: [...info.recent], seen: [], start: { tower: start.tower, pulled: start.pulled }, clockSec: CLOCK, paceSec: PACE, estSeconds: 0, finale: { scenario: plan.scenario }, questions: [] };
      plan.items.forEach((it, i) => { const q = buildQuestion(it, i, seed, rng); q.options.forEach((o) => Object.assign(o, { blockId: '' })); spec.questions.push(q); spec.seen.push(q.variantId); });
      if (!walk(spec, 'mid', true, rng)) continue;
      if (!walk(spec, 'lo', false) || !walk(spec, 'hi', false)) continue;   // the likely placements, low and high: re-roll the damage if any question could become unplaceable
      spec.estSeconds = estimateSeconds(spec);
      return spec;
    }
    throw new Error('no placeable run for seed ' + seed);
  }
  const estimateSeconds = (spec) => spec.questions.length * spec.paceSec;

  function replay(spec, upTo) {
    let T = clone(spec.start.tower);
    for (const q of spec.questions.slice(0, upTo)) { const o = q.options[q.correctN - 1]; T = E.applyPlace(E.applyPull(T, o.blockId), { id: o.blockId, answerText: o.text }, q.place.uCoord, q.place.layer).tower; }
    return T;
  }
  // a fresh variant of the same concept, same blocks: the correct number and the placement stay, so every later tower is unchanged
  function rerollQuestion(spec, index) {
    const s = clone(spec), q = s.questions[index], card = CARD[q.conceptId], rng = BG.mulberry32(BG.hash32(q.rseed + ':reroll:' + q.variantId));
    const taken = new Set(s.questions.filter((_, i) => i !== index).map((x) => x.variantId).concat(s.seen.filter((_, i) => i !== index)));
    const own = card.variants.filter((v) => v.scenario === q.scenario || !q.scenario);
    let vs = own.filter((v) => v.id !== q.variantId && !taken.has(v.id) && !s.avoid.includes(v.id));
    if (!vs.length) vs = own.filter((v) => v.id !== q.variantId && !taken.has(v.id));
    if (q.kind === 'finale' || !vs.length) vs = own.filter((v) => v.id === q.variantId || q.kind === 'finale' ? v.id === q.variantId : false).concat(vs);
    const pool = vs.map((v) => entriesFor(rng, v)), F = feasible(pool), r = F.includes(q.rank) ? q.rank : BG.pick(rng, F), entry = chooseEntry(rng, pool, r);
    const texts = BG.shuffle(rng, entry.tri.map((w) => Object.assign({ correct: false }, w)));
    const fresh = [{ n: 0, text: entry.correct, correct: true, id: entry.variant.id + '.c' }].concat(texts), keep = q.options.map((o) => ({ blockId: o.blockId, layer: o.layer, uCoord: o.uCoord, slot: o.slot, face: o.face }));
    let w = 1; q.options = q.options.map((o, k) => {
      const t = k + 1 === q.correctN ? fresh[0] : fresh[w++], n = { n: k + 1, text: t.text, correct: t.correct, id: t.id }; if (t.breaks) n.breaks = t.breaks;
      return Object.assign(n, keep[k]);
    });
    const lens = q.options.map((o) => o.text.length);
    Object.assign(q, { variantId: entry.variant.id, params: entry.params, stem: entry.stem, rank: lens.filter((x) => x < lens[q.correctN - 1]).length });
    s.seen[index] = q.variantId;
    return { spec: s, question: q };
  }

  return { SIDE_IDS, FINALE, PACE, CLOCK, seedFor, composeRun, rerollQuestion, resolveQuestion, replay, estimateSeconds, rankVec, pickCandidates, placeable };
});
