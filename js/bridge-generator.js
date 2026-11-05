// The Glass Bridge — run generator. Pure and deterministic: same (seed, history) -> identical runSpec JSON.
// Browser: window.BridgeGenerator. Node: require('./bridge-generator.js').
//
//   seedFor(playerId, runIndex)      -> 32-bit seed = hash(playerId + ':' + runIndex)
//   composeRun(seed, history, opts?) -> runSpec (plain JSON)
//   rerollRow(spec, rowIndex)        -> { spec, row }   fresh variant of the same concept after a fall
//   insertBonusRow(spec, rowIndex)   -> { spec, row }   spaced-retrieval row 2-3 rows later (row is null if none inserted)
//   pick, shuffle, weightedPick, sampleParams, fill, conceptWeight, recentInfo, pickVariant   the seeded helpers, shared with carrom-generator.js
//
// history (all optional):
//   { runs: [ { variants: ['T1a', ...] }, ... ],              // oldest -> newest; every variant shown, incl. rerolls
//     concepts: { T1: { attempts, falls, mastered } },        // mastered = first-try correct in two different variants on two runs
//     topicWeights: { tokens: 1.5, ... } }                    // optional: weak topics win the double slot in stages 1 and 2 more often
//
// runSpec: { v, seed, avoid, seen, counters, stages, boss, rows, sequence }
//   rows are in course order. A row: { id, stage, boss, bonus, of, reroll, conceptId, topic, zone, level, variantId,
//   scenario, params, stem, idea, tiles: [{ id, text, correct, breaks? }] in lane order (left -> right), correctLane }.
//   sequence: [{type:'start'}, {type:'row', row:id}, {type:'interlude', kind, seed}, {type:'checkpoint'}, ..., {type:'end'}].
// Boss rows keep their variant on reroll (it is the only one that fits the scenario) and re-sample params, tiles and lane.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./bridge-content.js') : root.BRIDGE_CONTENT);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BridgeGenerator = api;
})(this, function (CONTENT) {
  const { TOPICS, CARDS } = CONTENT;
  const CARD = {};
  for (const c of CARDS) CARD[c.id] = c;

  const STAGES = [
    { id: 's1', zone: 'amber', topics: ['tokens', 'safety'], level: 1 },
    { id: 's2', zone: 'green', topics: ['models', 'prompts'], level: 2 },
    { id: 's3', zone: 'cyan', topics: ['verify', 'guardrails', 'approvals'], level: 2.5 },
  ];
  const BOSS_CARDS = ['B1', 'B2', 'B3'];
  const INTERLUDES = ['stones', 'moving', 'beam', 'vanish'];
  const RECENT_RUNS = 3;

  // ---- seeded randomness ----
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedFor = (playerId, runIndex) => hash32(playerId + ':' + runIndex);
  const pick = (rng, a) => a[(rng() * a.length) | 0];
  function shuffle(rng, a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }
  function weightedPick(rng, items, w) {
    const ws = items.map(w), total = ws.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
    return items[items.length - 1];
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---- rendering ----
  function sampleParams(rng, params) {
    const b = {};
    for (const k in params) {
      const v = pick(rng, params[k]);
      if (v && typeof v === 'object') Object.assign(b, v); else b[k] = v;
    }
    return b;
  }
  const fill = (s, b) => s.replace(/\{(\w+)\}/g, (m, k) => (k in b ? b[k] : m));

  // ---- lanes: uniform, but never 3 correct tiles in a row on the same side ----
  const sideOf = (lane, n) => (n === 2 ? (lane ? 'R' : 'L') : 'LCR'[lane]);
  const sideAt = (rows, i) => (rows[i] ? sideOf(rows[i].correctLane, rows[i].tiles.length) : null);
  function laneOptions(n, prev, next) {
    return [...Array(n).keys()].filter((l) => {
      const s = sideOf(l, n), p1 = prev[prev.length - 1], p2 = prev[prev.length - 2], n1 = next[0], n2 = next[1];
      return !((p1 === s && p2 === s) || (p1 === s && n1 === s) || (n1 === s && n2 === s));
    });
  }

  // ---- one row ----
  function makeRow(rng, card, variant, meta, lanePrev, laneNext) {
    const n = card.tiles, params = sampleParams(rng, variant.params);
    const wrongIdx = shuffle(rng, variant.wrong.map((_, i) => i)).slice(0, n - 1).sort((a, b) => a - b);
    const lane = pick(rng, laneOptions(n, lanePrev, laneNext));  // callers guarantee at least one legal lane
    const wrongs = shuffle(rng, wrongIdx).map((i) => variant.wrong[i]);
    const tiles = [];
    for (let l = 0, w = 0; l < n; l++) {
      if (l === lane) tiles.push({ id: variant.id + '.c', text: fill(variant.correct, params), correct: true });
      else { const x = wrongs[w++]; tiles.push({ id: x.id, text: fill(x.text, params), correct: false, breaks: fill(x.breaks, params) }); }
    }
    return {
      id: meta.id, stage: meta.stage, boss: !!card.boss, bonus: !!meta.bonus, of: meta.of || null, reroll: meta.reroll || 0,
      conceptId: card.id, topic: card.topic, zone: card.zone, level: card.level,
      variantId: variant.id, scenario: variant.scenario || null, params,
      stem: fill(variant.stem, params), idea: card.idea, tiles, correctLane: lane,
    };
  }

  // ---- choosing concepts and variants ----
  function conceptWeight(history, id) {
    const h = (history && history.concepts && history.concepts[id]) || {};
    return (h.mastered ? 0.35 : 1.4) + 0.6 * Math.min(h.falls || 0, 4);
  }
  const normalCards = (topic) => CARDS.filter((c) => c.topic === topic && !c.boss);

  function recentInfo(history) {
    const runs = (history && history.runs) || [];
    const last = runs.slice(-RECENT_RUNS), recent = new Set(), lastSeen = {};
    last.forEach((r, i) => (r.variants || []).forEach((v) => { recent.add(v); lastSeen[v] = i; }));
    return { recent, lastSeen };
  }
  // a variant unseen in the last 3 runs; if the player has seen them all, the one seen longest ago
  function pickVariant(rng, card, info, used) {
    const vs = card.variants;
    let c = vs.filter((v) => !info.recent.has(v.id) && !used.has(v.id));
    if (!c.length) c = vs.filter((v) => !info.recent.has(v.id));
    if (!c.length) { const oldest = Math.min(...vs.map((v) => info.lastSeen[v.id])); c = vs.filter((v) => info.lastSeen[v.id] === oldest); }
    return pick(rng, c);
  }
  function pickScenario(rng, info) {
    const all = [...new Set(CARD.B1.variants.map((v) => v.scenario))];
    const seen = (s) => CARD.B1.variants.concat(CARD.B2.variants, CARD.B3.variants).some((v) => v.scenario === s && info.recent.has(v.id));
    const fresh = all.filter((s) => !seen(s));
    return pick(rng, fresh.length ? fresh : all);
  }

  function stageCards(rng, stage, si, history) {
    const w = (c) => conceptWeight(history, c.id) / (1 + Math.abs(c.level - stage.level));
    let picks;
    if (stage.topics.length === 2) {
      // three rows over two topics: one topic gets two (weaker topic more likely), the other one
      const tw = (t) => normalCards(t).reduce((a, c) => a + conceptWeight(history, c.id), 0) * ((history && history.topicWeights && history.topicWeights[t]) || 1);
      const double = weightedPick(rng, stage.topics, tw), single = stage.topics.find((t) => t !== double);
      picks = normalCards(double).concat(weightedPick(rng, normalCards(single), w));
    } else picks = stage.topics.map((t) => weightedPick(rng, normalCards(t), w));
    return shuffle(rng, picks);
  }

  // ---- the run ----
  function composeRun(seed, history) {
    const rng = mulberry32(seed), info = recentInfo(history), used = new Set();
    const order = []; // [{ card, stage }]
    STAGES.forEach((st, si) => stageCards(rng, st, si, history).forEach((card) => order.push({ card, stage: si + 1 })));
    const scenario = pickScenario(rng, info);
    BOSS_CARDS.forEach((id) => order.push({ card: CARD[id], stage: 'boss' }));

    const rows = [];
    order.forEach(({ card, stage }, i) => {
      const variant = card.boss ? card.variants.find((v) => v.scenario === scenario) : pickVariant(rng, card, info, used);
      used.add(variant.id);
      rows.push(makeRow(rng, card, variant, { id: 'r' + String(i + 1).padStart(2, '0'), stage }, rows.map((_, j) => sideAt(rows, j)), []));
    });

    const kinds = shuffle(rng, INTERLUDES).slice(0, 3);
    const sequence = [{ type: 'start' }], stages = [];
    STAGES.forEach((st, si) => {
      const ids = rows.filter((r) => r.stage === si + 1).map((r) => r.id);
      stages.push({ id: st.id, zone: st.zone, rowIds: ids, interlude: kinds[si] });
      sequence.push({ type: 'row', row: ids[0] }, { type: 'row', row: ids[1] }, { type: 'interlude', kind: kinds[si], seed: (rng() * 4294967296) >>> 0 }, { type: 'row', row: ids[2] }, { type: 'checkpoint' });
    });
    const bossIds = rows.filter((r) => r.boss).map((r) => r.id);
    bossIds.forEach((id) => sequence.push({ type: 'row', row: id }));
    sequence.push({ type: 'end' });

    return {
      v: 1, seed, avoid: [...info.recent], seen: rows.map((r) => r.variantId), counters: { reroll: {}, bonus: 0 },
      stages, boss: { scenario, rowIds: bossIds }, rows, sequence,
    };
  }

  // ---- after a fall: same concept, different variant, re-shuffled ----
  const layoutKey = (r) => r.stem + '|' + r.tiles.map((t) => t.text).join('|');
  function rerollRow(spec, rowIndex) {
    const s = clone(spec), old = s.rows[rowIndex], card = CARD[old.conceptId];
    const n = (s.counters.reroll[old.id] = (s.counters.reroll[old.id] || 0) + 1);
    const rng = mulberry32(hash32(s.seed + ':' + old.id + ':r' + n));
    const inRun = new Set(s.rows.filter((r) => r.conceptId === old.conceptId).map((r) => r.variantId));
    const avoid = new Set(s.avoid), seen = new Set(s.seen);
    let pool = card.boss ? card.variants.filter((v) => v.id === old.variantId) : card.variants.filter((v) => v.id !== old.variantId);
    for (const keep of [(v) => !inRun.has(v.id) && !avoid.has(v.id) && !seen.has(v.id), (v) => !inRun.has(v.id) && !avoid.has(v.id), (v) => !inRun.has(v.id)]) {
      const f = pool.filter(keep); if (f.length && !card.boss) { pool = f; break; }
    }
    const prev = [sideAt(s.rows, rowIndex - 2), sideAt(s.rows, rowIndex - 1)].filter(Boolean), next = [sideAt(s.rows, rowIndex + 1), sideAt(s.rows, rowIndex + 2)].filter(Boolean);
    let row;
    for (let i = 0; i < 30; i++) {
      row = makeRow(rng, card, pick(rng, pool), { id: old.id, stage: old.stage, bonus: old.bonus, of: old.of, reroll: n }, prev, next);
      if (layoutKey(row) !== layoutKey(old)) break;
    }
    s.rows[rowIndex] = row;
    if (!s.seen.includes(row.variantId)) s.seen.push(row.variantId);
    return { spec: s, row };
  }

  // ---- spaced retrieval: a missed concept comes back 2-3 rows later (never inside the boss) ----
  function insertBonusRow(spec, rowIndex) {
    const miss = spec.rows[rowIndex];
    if (miss.boss || miss.bonus || spec.rows.some((r) => r.bonus && r.conceptId === miss.conceptId)) return { spec, row: null };
    const s = clone(spec), card = CARD[miss.conceptId];
    const rng = mulberry32(hash32(s.seed + ':bonus:' + miss.id));
    const lastNormal = s.rows.map((r) => r.boss).lastIndexOf(false);
    const want = Math.min(rowIndex + 2 + ((rng() * 2) | 0), lastNormal);
    // the wanted spot, then its neighbours, until the bonus row has a legal lane (2-tile rows can be boxed in)
    const around = [];
    for (let d = 0; d <= lastNormal - rowIndex; d++) for (const x of d ? [want - d, want + d] : [want]) if (x >= rowIndex && x <= lastNormal) around.push(x);
    const sidesAround = (a) => [[sideAt(s.rows, a - 1), sideAt(s.rows, a)].filter(Boolean), [sideAt(s.rows, a + 1), sideAt(s.rows, a + 2)].filter(Boolean)];
    const after = around.find((a) => laneOptions(card.tiles, ...sidesAround(a)).length);
    if (after === undefined) return { spec, row: null };
    const inRun = new Set(s.rows.filter((r) => r.conceptId === miss.conceptId).map((r) => r.variantId));
    const avoid = new Set(s.avoid), seen = new Set(s.seen);
    let pool = card.variants.filter((v) => !inRun.has(v.id));
    for (const keep of [(v) => !avoid.has(v.id) && !seen.has(v.id), (v) => !avoid.has(v.id)]) { const f = pool.filter(keep); if (f.length) { pool = f; break; } }
    if (!pool.length) pool = card.variants.filter((v) => v.id !== miss.variantId);
    const host = s.rows[after], id = 'b' + ++s.counters.bonus;
    const [prev, next] = sidesAround(after);
    const row = makeRow(rng, card, pick(rng, pool), { id, stage: host.stage, bonus: true, of: miss.id }, prev, next);
    s.rows.splice(after + 1, 0, row);
    s.sequence.splice(s.sequence.findIndex((x) => x.type === 'row' && x.row === host.id) + 1, 0, { type: 'row', row: id });
    for (const st of s.stages) { const k = st.rowIds.indexOf(host.id); if (k >= 0) st.rowIds.splice(k + 1, 0, id); }
    s.seen.push(row.variantId);
    return { spec: s, row };
  }

  // the seeded-choice helpers below are also what carrom-generator.js builds on (history shape, anti-repeat and weighting included)
  return { STAGES, INTERLUDES, hash32, mulberry32, seedFor, composeRun, rerollRow, insertBonusRow, pick, shuffle, weightedPick, sampleParams, fill, conceptWeight, recentInfo, pickVariant };
});
