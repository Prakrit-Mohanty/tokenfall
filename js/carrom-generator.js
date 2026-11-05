// House Rules Carrom — run generator. Pure and deterministic: same (seed, history) -> identical runSpec JSON.
// Browser: window.CarromGenerator. Node: require('./carrom-generator.js').
//
//   seedFor(playerId, runIndex)       -> 32-bit seed, salted so a player's carrom run N and bridge run N do not share a random stream
//   composeRun(seed, history)         -> runSpec (plain JSON, ghost shots included)
//   rerollRound(spec, roundIndex, history?) -> { spec, round }   the same concept as a DIFFERENT variant; other rounds untouched
//   verifyQuestion(question)          re-simulates every stored ghost shot; true when all still work
//   ghostFor(start, corner)           the stored shot that sinks a coin from `start` into pocket `corner`: { side, strikerX, angle, power }
//   shotResult(start, shot)           plays a striker shot on the real physics: { pocket (the corner the coin fell into, or null), strikerAlive }
//
// THE GAME: one coin on the board, four pockets that ARE the answers. The player shoots the coin with the striker (pull back, let go) into the pocket
// whose answer they think is right. Nothing blocks the coin and no text sits on the board: each pocket is marked by a colour and a shape, and the
// answers are listed under those marks in the question card. The striker can start from any of the four baselines (S, W, N, E): a pocket on the
// striker's own side is almost unreachable (a hit always pushes the coin away), so each pocket is shot from one of the two sides facing away from it.
//
// Built on the bridge generator's seeded helpers (hash32, mulberry32, shuffle, weightedPick, sampleParams, fill, conceptWeight, recentInfo,
// pickVariant), so history means the same thing in both games:
//   history = { runs: [ { variants: ['CW1a', ...] } ],                  oldest -> newest, every variant shown incl. rerolls
//               concepts: { CW1: { attempts, falls, mastered } } }       falls = strikes; mastered = first-try in two variants on two runs
//
// runSpec: { v: 2, seed, order, rounds, seen, clockSeconds }
//   order: the four sides in a seeded order; the finale ('case') is always last.
//   round: { id, index, side, kind: 'pick' | 'sort' | 'case', clock, reroll, questions: [question] }   (the finale has two questions)
//   question: { id, kind, conceptId, variantId, scenario, side (the mastery bar it feeds), title, idea, stem, params, options, ... }
//     options: [{ id, text, corner, correct?, tagId?, breaks? }]  slot 0..3 = colour/shape 0..3 (amber triangle, green circle, cyan diamond, rose square);
//              corner: the pocket it sits on, 0 NW, 1 NE, 2 SE, 3 SW (the physics' numbering)
//     pick: correct: the right option's id; start: { x, y } where the coin begins; ghost: { side, strikerX, angle, power }
//     sort: items: [{ id, text, pocket (the right option's id), breaks: { <option id>: sentence }, flip, start, ghost }] sunk one after another
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./bridge-generator.js') : root.BridgeGenerator, isNode ? require('./carrom-content.js') : root.CARROM_CONTENT, isNode ? require('./carrom-physics.js') : root.CarromPhysics);
  if (isNode) module.exports = api;
  else root.CarromGenerator = api;
})(this, function (BG, CONTENT, P) {
  const { hash32, mulberry32, shuffle, pick, weightedPick, sampleParams, fill, conceptWeight, recentInfo, pickVariant } = BG;
  const { CARDS, SIDES } = CONTENT;
  const CFG = P.CFG, DEG = Math.PI / 180;
  const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const SIDE_ORDER = ['works', 'limits', 'bias', 'owns'];
  const CLOCK = { pick: 55, sort: 90, case: 70 };   // seconds; the worst case is 3 x 55 + 90 + 70 = 325 s
  const START_R = 14, CENTRE = CFG.SIZE / 2, FLIP_SHARE = 1 / 3;
  const AIM_TOL = { deg: 1, power: 0.08 };           // a ghost shot must still sink the coin with the aim off by this much
  const FAR = [['S', 'E'], ['S', 'W'], ['N', 'W'], ['N', 'E']];   // per pocket (NW, NE, SE, SW): the two baselines it is far from
  const LANES = [14, 23, 32, 41, 50, 59, 68, 77, 86];

  const seedFor = (playerId, runIndex) => BG.seedFor(playerId + ':carrom', runIndex);
  const roundRng = (seed, index, reroll) => mulberry32(hash32(`${seed}:round:${index}:${reroll}`));
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- the coin and its ghost shot
  // the coin starts somewhere in a disc round the middle: every pocket 46 to 78 units away
  function startSpot(rng) { const r = START_R * Math.sqrt(rng()), a = rng() * 2 * Math.PI; return { x: r2(CENTRE + Math.cos(a) * r), y: r2(CENTRE + Math.sin(a) * r) }; }
  function shotResult(start, shot) {
    const s = P.createState({ coins: [{ id: 'c', x: start.x, y: start.y }], strikerX: shot.strikerX, side: shot.side }); P.applyShot(s, shot);
    for (let i = 0; i < CFG.MAX_STEPS && P.step(s); i++);
    const c = s.bodies[1]; return { pocket: c.alive ? null : c.pocket, strikerAlive: s.bodies[0].alive };
  }
  const sinks = (start, shot, corner) => { const r = shotResult(start, shot); return r.pocket === corner && r.strikerAlive; };
  const robust = (start, shot, corner) => [[0, 1], [-AIM_TOL.deg, 1], [AIM_TOL.deg, 1], [0, 1 - AIM_TOL.power], [0, 1 + AIM_TOL.power]].every(([da, mp]) => sinks(start, Object.assign({}, shot, { angle: shot.angle + da, power: Math.min(1, shot.power * mp) }), corner));
  // The shot that sinks the coin in `corner`: aim the striker at the ghost-ball point (where it must touch the coin to send it at the pocket) from each lane position on the
  // two baselines facing away from the pocket, keep the shot with the widest window of angles that still sink it, and aim at the middle of that window.
  function ghostFor(start, corner) {
    const [px, py] = P.POCKETS[corner], dx = px - start.x, dy = py - start.y, d = Math.hypot(dx, dy), n = { x: dx / d, y: dy / d }, rr = CFG.R_COIN + CFG.R_STRIKER;
    const gx = start.x - n.x * rr, gy = start.y - n.y * rr, cands = [];
    for (const side of FAR[corner]) for (const t of LANES) {
      const L = P.strikerAt(side, t), sx = gx - L.x, sy = gy - L.y, sd = Math.hypot(sx, sy), cut = Math.acos(Math.max(-1, Math.min(1, (sx * n.x + sy * n.y) / sd)));
      if (cut > 55 * DEG || Math.hypot(L.x - start.x, L.y - start.y) < rr + 6) continue;
      const a0 = Math.atan2(sx, -sy) / DEG, v = (1.5 * d / 0.5556) / (1.425 * Math.max(0.5, Math.cos(cut))), p = Math.min(1, Math.max(0.3, r2(v / CFG.VMAX)));
      let run = 0, bw = 0, bc = 0, rs = 0;
      for (let da = -3; da <= 3.001; da += 0.5) {
        if (sinks(start, { side, strikerX: t, angle: a0 + da, power: p }, corner)) { if (!run) rs = da; run += 0.5; if (run > bw) { bw = run; bc = rs + (run - 0.5) / 2; } } else run = 0;
      }
      if (bw >= 2) cands.push({ w: bw, shot: { side, strikerX: t, angle: r2(a0 + bc), power: p } });
    }
    cands.sort((a, b) => b.w - a.w);
    for (const c of cands.slice(0, 4)) if (robust(start, c.shot, corner)) return Object.assign(c.shot, { width: c.w });
    return cands.length ? Object.assign(cands[0].shot, { width: cands[0].w }) : null;
  }
  const ghostWidth = (g) => (g ? g.width : 0);

  // ---------------------------------------------------------------- questions
  const base = (id, card, variant, params) => ({
    id, kind: card.format, conceptId: card.id, variantId: variant.id, scenario: variant.scenario || null, side: card.side === 'case' ? card.counts : card.side,
    title: card.title, idea: card.idea, stem: fill(variant.stem, params), params,
  });

  function makePick(rng, card, variant, qid) {
    const params = sampleParams(rng, variant.params), q = base(qid, card, variant, params), pk = variant.pick;
    const wrongs = shuffle(rng, pk.wrong).slice(0, 3), correctSlot = (rng() * 4) | 0, corners = shuffle(rng, [0, 1, 2, 3]);
    let w = 0;
    q.options = [0, 1, 2, 3].map((i) => i === correctSlot
      ? { id: 'o' + i, text: fill(pk.correct, params), corner: corners[i], correct: true, tagId: variant.id + '.c' }
      : { id: 'o' + i, text: fill(wrongs[w].text, params), corner: corners[i], correct: false, tagId: wrongs[w].id, breaks: fill(wrongs[w++].breaks, params) });
    q.correct = 'o' + correctSlot; q.start = startSpot(rng); q.ghost = ghostFor(q.start, corners[correctSlot]);
    return q;
  }

  // three items covering at least two pockets; a "with a tool" twin (flip) in about a third of runs, never next to its base item
  function chooseItems(rng, items) {
    const flips = items.filter((x) => x.flip), plain = items.filter((x) => !x.flip), wantFlip = rng() < FLIP_SHARE && flips.length;
    for (let t = 0; t < 60; t++) {
      let chosen;
      if (wantFlip) { const f = pick(rng, flips); chosen = [f].concat(shuffle(rng, plain.filter((x) => x.id !== f.pair)).slice(0, 2)); }
      else chosen = shuffle(rng, plain).slice(0, 3);
      if (new Set(chosen.map((x) => x.pocket)).size >= 2) return shuffle(rng, chosen);
    }
    throw new Error('carrom-generator: could not draw items that cover two pockets');
  }
  function makeSort(rng, card, variant, qid) {
    const params = sampleParams(rng, variant.params), q = base(qid, card, variant, params), { pockets, items: pool } = variant.sort;
    const items = chooseItems(rng, pool), corners = shuffle(rng, [0, 1, 2, 3]);
    q.options = shuffle(rng, pockets).map((p, i) => ({ id: p.id, text: p.label, corner: corners[i] }));
    q.items = items.map((it) => {
      const start = startSpot(rng), corner = q.options.find((o) => o.id === it.pocket).corner;
      return { id: it.id, text: it.text, pocket: it.pocket, breaks: it.breaks, flip: !!it.flip, start, ghost: ghostFor(start, corner) };
    });
    return q;
  }

  // ---------------------------------------------------------------- rounds
  // a variant of `card` other than the ones in `avoid` (a reroll), preferring ones not seen in the last runs
  function freshVariant(rng, card, info, avoid) {
    const v = pickVariant(rng, card, info, avoid);
    if (!avoid.has(v.id)) return v;
    const others = card.variants.filter((x) => !avoid.has(x.id)), unseen = others.filter((x) => !info.recent.has(x.id));
    return pick(rng, unseen.length ? unseen : others);
  }
  const questionFor = (rng, card, variant, qid) => (card.format === 'sort' ? makeSort : makePick)(rng, card, variant, qid);

  // keep: { conceptId, avoid: Set of variant ids } for a reroll
  function buildRound(seed, history, info, index, side, reroll, keep, used) {
    const rng = roundRng(seed, index, reroll), id = 'r' + (index + 1);
    const round = { id, index, side, kind: side === 'case' ? 'case' : SIDES[side].format, clock: 0, reroll, questions: [] };
    if (side === 'case') {
      const avoid = new Set(keep ? keep.avoid : used), c1 = CARD.CF1, c2 = CARD.CF2;
      const v1 = keep ? freshVariant(rng, c1, info, avoid) : pickVariant(rng, c1, info, avoid), v2 = c2.variants.find((v) => v.scenario === v1.scenario);
      round.questions = [makePick(rng, c1, v1, id + 'q1'), makePick(rng, c2, v2, id + 'q2')];
      round.clock = CLOCK.case;
    } else {
      const card = keep ? CARD[keep.conceptId] : weightedPick(rng, CARDS.filter((c) => c.side === side), (c) => conceptWeight(history, c.id));
      const v = keep ? freshVariant(rng, card, info, keep.avoid) : pickVariant(rng, card, info, used);
      round.questions = [questionFor(rng, card, v, id + 'q1')];
      round.clock = CLOCK[card.format];
    }
    return round;
  }
  const summarize = (spec) => {
    spec.seen = spec.rounds.flatMap((r) => r.questions.map((q) => q.variantId)).concat(spec.rerolled || []);
    spec.clockSeconds = spec.rounds.reduce((n, r) => n + r.clock, 0);
    return spec;
  };

  function composeRun(seed, history = {}) {
    const info = recentInfo(history), order = shuffle(mulberry32(seed), SIDE_ORDER).concat('case'), used = new Set(), rounds = [];
    order.forEach((side, i) => {
      const r = buildRound(seed, history, info, i, side, 0, null, used);
      r.questions.forEach((q) => used.add(q.variantId));
      rounds.push(r);
    });
    return summarize({ v: 2, seed, order, rounds, rerolled: [] });
  }

  function rerollRound(spec, index, history = {}) {
    const old = spec.rounds[index], info = recentInfo(history);
    const keep = { conceptId: old.questions[0].conceptId, avoid: new Set(old.questions.map((q) => q.variantId)) };
    const round = buildRound(spec.seed, history, info, index, old.side, old.reroll + 1, keep, new Set());
    const next = JSON.parse(JSON.stringify(spec));
    next.rounds[index] = round;
    next.rerolled = (spec.rerolled || []).concat(old.questions.map((q) => q.variantId));
    return { spec: summarize(next), round };
  }

  // every stored ghost shot, run again: it must sink the coin in the pocket of the right answer, still with the aim a degree and the power 8% off
  function verifyQuestion(q) {
    const targets = q.kind === 'pick' ? [{ start: q.start, ghost: q.ghost, option: q.options.find((o) => o.correct) }] : q.items.map((it) => ({ start: it.start, ghost: it.ghost, option: q.options.find((o) => o.id === it.pocket) }));
    return targets.every((t) => t.ghost && robust(t.start, t.ghost, t.option.corner));
  }

  return { SIDE_ORDER, CLOCK, START_R, AIM_TOL, seedFor, composeRun, rerollRound, verifyQuestion, ghostFor, shotResult, startSpot };
});
