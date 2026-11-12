// Prompt Kitchen — engine: the shift generator, the pot / stove / stock state machine, the dish judge, the ideal-line solver and scoring.
// Pure and deterministic (no Math.random, no DOM, no clock). Built on bridge-generator.js (imported, not copied): hash32, mulberry32, pick, shuffle, weightedPick, sampleParams, conceptWeight.
// Browser: window.KitchenEngine. Node: require('./kitchen-engine.js').
//
//   seedFor(playerId, runIndex)       -> 32-bit seed = hash('kitchen:' + playerId + ':' + runIndex): its own stream, not the other games'
//   composeShift(seed, history)       -> shiftSpec (plain JSON): 13 tickets in three phases, with spawn times, timers, jittered chunk sizes and a shuffled crate slot per chunk
//   rerollOrder(spec, i, history)     -> { spec, tickets }   a fresh draw for the unit that holds ticket i (a K5 / K9 chain moves as one); every other ticket stays
//   planShift(spec) / solveIdeal(t, ctx) -> the minimum-token valid line (packing x versions x dial x continue-or-wipe x stock), its par tokens, and its action list
//   newState(spec), advance(state, t), act(state, action) -> the state machine: every station action is a pure function of the state and a timestamp
//   judgeDish(ticket, pot, dial)      -> { quality, stamp, bleed, missing, tokens, reply }  in the order of the spec: bleed, missing, cut off, over-stuffed, rambling, served
//   scoreOrder / scoreShift / starsFor -> coins per order, the shift total, stars, spills, tokens spent vs ideal vs tank, and clean orders per concept
//   playActions(spec, actions)        -> a scripted shift: the same spec and the same action log always give the same result (the tests' replay)
//
// history (all optional, the shape the shared store hands over):
//   { runs: [ { variants: ['K1-1a', ...] }, ... ],                     // oldest -> newest
//     concepts: { K1: { attempts, falls, mastered }, ... } }            // falls = bleeds + cut-offs + over-stuffed + rambling
//
// RULES: the places where the spec was silent and a choice was made (each one is a switch; kitchen-tests.js prints them). See the report that came with this file.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-content.js') : root.KITCHEN_CONTENT, isNode ? require('./bridge/bridge-generator.js') : root.BridgeGenerator);
  if (isNode) module.exports = api;
  else root.KitchenEngine = api;
})(this, function (C, BG) {
  const { RUN } = C, DIALS = ['line', 'short', 'full'], DRANK = { line: 0, short: 1, full: 2 }, VERS = ['full', 'summary', 'excerpt'];
  // the places where the spec was silent and a choice was made. Each is a real switch that the tests can flip; the choices that are not switches (stock: the first use writes the cache
  // at full price and starts a 60 s clock that is not refreshed, nothing is paid at prep) are written down in the header and the report.
  const RULES = {
    helpfulMissingFree: true,            // a missing helpful slot costs nothing; including a helpful crate only costs tokens
    historyWithResidueIsDuplicate: true, // the "Chat so far" crate loaded into a pot that already holds the chat counts as a duplicate (60%)
    fairnessIncludesAsk: true,           // the size / essential correlation guard counts the ask-line crates too
    ejectOnDrop: true,                   // oldest-first pot: items pop out as soon as the fill passes capacity, and again at cook time for the dial
  };
  const SPAWN = { early: RUN.spawn };      // seconds between the first nine tickets (phases 1 and 2); phase 3 is spaced around the K9 gap. the spec's 19 s
  const ATTEMPTS = 60, JITTER = 0.15, RECENT = 3;
  const STAT = { shifts: 0, attempts: 0, relaxed: [0, 0, 0], unfair: 0 };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const seedFor = (playerId, runIndex) => BG.hash32('kitchen:' + playerId + ':' + runIndex);
  const isEss = (c) => c.role === 'essential' || c.role === 'stable';
  const dialTok = (d) => RUN.dial[d];

  // ---------------------------------------------------------------- the stations: one layout the world builds and the bots walk (metres, from the kitchen's centre; z grows towards the pass)
  const LAYOUT = {
    crates: [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].map((x) => ({ x, z: -6.8 })), chop: { x: -5.6, z: -4.4 }, sieve: { x: 5.6, z: -4.4 }, stockShelf: { x: 0, z: -6.8 },
    stoves: [{ x: -2.4, z: -3.3 }, { x: 2.4, z: -3.3 }],           // the bodies: the corridor between them runs from the pantry down to the pass
    pots: [{ x: -1.6, z: -3.75 }, { x: 1.6, z: -3.75 }], knobs: [{ x: -1.6, z: -2.95 }, { x: 1.6, z: -2.95 }],   // where the hero stands to load / wipe a pot, and to dial / cook / take at its stove
    window: { x: 0, z: -1.4 }, rail: { x: -8, z: -2.4 }, start: { x: 0, z: -1.6 }, detour: 1.1,
  };

  // ---------------------------------------------------------------- what the generator reads from the player's history
  function context(history) {
    const runs = (history && history.runs) || [], vs = (r) => (r && r.variants) || [];
    return { last3: new Set(runs.slice(-RECENT).flatMap(vs)), last1: new Set(vs(runs[runs.length - 1])), history: history || {} };
  }
  // the variants of a concept a shift may deal: not used yet in this shift, and fresh (not in the last 3 runs, else not in the last run, else any)
  function eligible(concept, ctx, used, pred) {
    const all = C.VARIANTS.filter((v) => v.concept === concept && !used.has(v.id) && (!pred || pred(v)));
    for (const [tier, ok] of [[0, (v) => !ctx.last3.has(v.id)], [1, (v) => !ctx.last1.has(v.id)], [2, () => true]]) {
      const c = all.filter(ok);
      if (c.length) { STAT.relaxed[tier]++; return c; }
    }
    return [];
  }

  // ---------------------------------------------------------------- tickets: a variant (or its prior) with params filled, sizes jittered and crates shuffled
  const chatOf = (t, p) => (t.chat ? C.fill(t.chat.id, p) : 'solo:' + t.uid);
  function scaleChunk(c, f) {
    const k = {}; let prev = Infinity;
    for (const v of VERS) if (c.tokens[v] != null) { k[v] = Math.max(1, Math.min(prev - 1, Math.round(c.tokens[v] * f))); prev = k[v]; }
    return Object.assign({}, c, { tokens: k });
  }
  function record(body, params, jit, rng, meta) {
    const e = C.fillDeep(body, params);
    const slots = BG.shuffle(rng, e.chunks.map((_, i) => i));
    const t = Object.assign({}, e, meta, {
      prior: undefined, twin: undefined, params: undefined,
      chunks: e.chunks.map((c, i) => Object.assign(scaleChunk(c, jit[c.id] || 1), { slot: slots[i], uid: meta.uid + '.' + c.id })),
    });
    t.chat = chatOf(Object.assign({}, e, { uid: meta.uid }), params);
    delete t.prior; delete t.twin; delete t.params;
    return t;
  }

  // ---------------------------------------------------------------- the ideal-line solver
  // every packing of a ticket: which crate versions go in. noise and duplicate crates never help; a history crate only helps when the pot was wiped.
  function* packings(t, allowHistory) {
    const cs = t.chunks.filter((c) => c.role !== 'noise' && c.role !== 'duplicate' && (c.role !== 'history' || allowHistory)), pick = {};
    function* rec(i, fill, cov) {
      if (i === cs.length) { yield { pick: Object.assign({}, pick), fill, cov }; return; }
      yield* rec(i + 1, fill, cov);
      const c = cs[i];
      for (const v of VERS) if (c.tokens[v] != null) { pick[c.id] = v; yield* rec(i + 1, fill + c.tokens[v], cov.concat(c.covers[v] || [])); delete pick[c.id]; }
    }
    yield* rec(0, 0, []);
  }
  // res = the residue of the pot we continue in ({ tokens, cov }) or null; stockWarm = a prepped stable crate is priced at the discount
  function solveIdeal(t, o) {
    o = o || {};
    const res = o.residue || null, need = t.reply.need, dial = dialTok(need), req = t.slots.required, cap = o.capacity || RUN.capacity;
    let best = null;
    for (const p of packings(t, !res)) {
      const fill = p.fill + (res ? res.tokens : 0);
      if (fill + dial > cap) continue;
      const cov = new Set(p.cov.concat(res ? res.cov : []));
      if (!req.every((s) => cov.has(s))) continue;
      let spent = fill + dial;
      if (o.stockWarm) for (const c of t.chunks) if (c.role === 'stable' && p.pick[c.id] === 'full') spent -= c.tokens.full - Math.ceil(RUN.stock.rate * c.tokens.full);
      if (!best || spent < best.spent) best = { spent, fill, pick: p.pick, dial: need, ties: 0 }; else if (spent === best.spent) best.ties++;
    }
    return best;
  }
  const residueOf = (t, pick, dial) => ({ tokens: t.chunks.reduce((n, c) => n + (pick[c.id] ? c.tokens[pick[c.id]] : 0), 0) + dialTok(dial), cov: t.chunks.flatMap((c) => (pick[c.id] ? c.covers[pick[c.id]] || [] : [])), chat: t.chat });
  const sameLine = (a, b) => a && Object.keys(a.pick).sort().map((k) => k + ':' + a.pick[k]).join() === Object.keys(b.pack).sort().map((k) => k + ':' + b.pack[k]).join() && a.dial === b.dial;

  // the ideal plan of a whole shift: one line per ticket, in spawn order. a K5 follow-up compares continuing in the residue pot with wiping; a K6 ticket needs a clean pot; a K9 pair
  // preps the stable crate as stock when the second ticket comes inside the stock's 60 s
  function planShift(spec) {
    const plans = {}, by = Object.fromEntries(spec.tickets.map((t) => [t.uid, t]));
    for (const t of spec.tickets) {
      const p = { uid: t.uid };
      if (t.chainOf && t.chainRole === 'second' && t.concept === 'K5') {
        const first = plans[t.chainOf], res = residueOf(by[t.chainOf], first.pick, first.dial);
        const cont = solveIdeal(t, { residue: res }), wipe = solveIdeal(t, {});
        if (cont && (!wipe || cont.spent <= wipe.spent)) Object.assign(p, cont, { cont: true, pot: 'same' }); else Object.assign(p, wipe, { cont: false, pot: 'wipe' });
      } else if (t.chainOf && t.chainRole === 'second' && t.concept === 'K9') {
        const first = plans[t.chainOf], warm = t.gap + RUN.stockMargin <= RUN.stock.seconds;
        const s = solveIdeal(t, { stockWarm: warm });
        Object.assign(p, s, { stock: warm ? 'use' : null, pot: 'clean' });
        if (warm) first.stock = 'prep';
      } else Object.assign(p, solveIdeal(t, {}), { pot: t.concept === 'K6' ? 'clean' : 'free' });
      plans[t.uid] = p;
    }
    return plans;
  }

  // ---------------------------------------------------------------- the generator
  const fairR = (tickets, onlyDecision) => {
    const xs = [], ys = [];
    for (const t of tickets) for (const c of t.chunks) { if (onlyDecision && c.id === 'ask') continue; xs.push(c.tokens.full); ys.push(isEss(c) ? 1 : 0); }
    return spearman(xs, ys);
  };
  function rank(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = m; i = j + 1; }
    return r;
  }
  function spearman(x, y) {
    const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let c = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? c / Math.sqrt(da * db) : 0;
  }

  // one variant's tickets: jitter every crate +-15% (all versions of a crate share one factor), keeping the author's best line true at this size
  function dealVariant(v, rng, params, uidBase, phase, extra) {
    const ids = [...new Set(v.chunks.map((c) => c.id).concat(v.prior ? v.prior.chunks.map((c) => c.id) : []))];
    for (let tries = 0; tries < 40; tries++) {
      const jit = {};
      for (const id of ids) jit[id] = tries === 39 ? 1 : 1 + (rng() * 2 - 1) * JITTER;
      const out = [];
      if (v.prior) out.push(record(v.prior, params, jit, rng, Object.assign({ uid: uidBase + 'a', phase, variantId: v.id, concept: v.concept, order: v.order, chainRole: 'first', idea: v.idea, breaks: v.breaks }, extra)));
      out.push(record(v, params, jit, rng, Object.assign({ uid: uidBase + (v.prior ? 'b' : ''), phase, variantId: v.id, concept: v.concept, order: v.order, chainRole: v.prior ? 'second' : null, gap: v.gap || 0, idea: v.idea, breaks: v.breaks, rush: !!extra.rush, after: v.after || null }, extra)));
      if (v.prior) out[1].chainOf = out[0].uid;
      if (checkLine(v, out)) return out;
    }
    throw new Error('no valid sizes for ' + v.id);
  }
  // the engine's solver must reach the author's best line at this size
  function checkLine(v, ts) {
    const t = ts[ts.length - 1], bp = v.best;
    if (v.concept === 'K9') { const a = solveIdeal(ts[0], {}), b = solveIdeal(t, {}); return a && b && sameLine(a, v.prior.best) && sameLine(b, bp); }
    if (v.concept === 'K5') {
      const first = solveIdeal(ts[0], {}); if (!first || !sameLine(first, v.prior.best)) return false;
      const res = residueOf(ts[0], first.pick, first.dial), cont = solveIdeal(t, { residue: res }), wipe = solveIdeal(t, {});
      const useCont = cont && (!wipe || cont.spent <= wipe.spent), got = useCont ? cont : wipe;
      return got && !!useCont === bp.cont && sameLine(got, bp);
    }
    const s = solveIdeal(t, {});
    return s && sameLine(s, bp);
  }

  // which variant fills each slot of a shift: phase 1 is K1, K2, K7 and one more drawn from the weakest of the three; phase 2 is K3, K4 and the K5 -> K6 chain; phase 3 is K9 (two
  // tickets), K8 and the rush mix (any single-ticket variant not used earlier, drawn from the player's weakest concepts)
  function build(rng, ctx) {
    const used = new Set();
    const draw = (concept, pred) => {
      const c = eligible(concept, ctx, used, pred);
      if (!c.length) throw new Error('no variant left for ' + concept);
      const v = BG.pick(rng, c); used.add(v.id); return v;
    };
    const wpick = (ids) => { const w = ids.map((id) => BG.conceptWeight(ctx.history, id)); let r = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r < 0) return ids[i]; } return ids[ids.length - 1]; };
    const out = { K1: draw('K1'), K2: draw('K2'), K7: draw('K7') };
    out.extra = draw(wpick(['K1', 'K2', 'K7']));
    for (const k of ['K3', 'K4', 'K5', 'K6', 'K9', 'K8']) out[k] = draw(k);
    // the rush mix never lands on a concept already used twice: three of a concept's four variants in one shift would leave the next run one fresh variant
    const uses = (k) => [...used].filter((id) => C.variantById[id].concept === k).length;
    const rushConcepts = [...new Set(C.ORDERS.filter((o) => o.rush).map((o) => o.concept))].filter((k) => uses(k) < 2);
    out.rush = draw(wpick(rushConcepts), (v) => v.rush);
    return out;
  }

  function composeShift(seed, history) {
    const ctx = context(history);
    let last = null;
    for (let a = 0; a < ATTEMPTS; a++) {
      const rng = BG.mulberry32(BG.hash32(seed + ':' + a)), pick = build(rng, ctx), tickets = [];
      const add = (v, phase, extra, shared) => {
        const params = shared || BG.sampleParams(rng, v.params);
        tickets.push(...dealVariant(v, rng, params, 't' + (tickets.length + 1), phase, extra || {}));
        return params;
      };
      for (const v of BG.shuffle(rng, [pick.K1, pick.K2, pick.K7, pick.extra])) add(v, 1);
      for (const k of BG.shuffle(rng, ['K3', 'K4', 'K5'])) {
        const params = add(pick[k], 2);
        if (k === 'K5') { const other = { otherName: params.name, otherRef: params.ref }; add(pick.K6, 2, other, Object.assign(BG.sampleParams(rng, pick.K6.params), other)); }
      }
      add(pick.K9, 3);
      for (const [v, extra] of BG.shuffle(rng, [[pick.K8, {}], [pick.rush, { rush: true }]])) add(v, 3, extra);
      // K9's second ticket was dealt with the first; it spawns last
      const k9b = tickets.findIndex((t) => t.concept === 'K9' && t.chainRole === 'second'); tickets.push(tickets.splice(k9b, 1)[0]);
      tickets.forEach((t, i) => { t.idx = i; });
      schedule(tickets);
      last = { tickets, attempt: a };
      if (Math.abs(fairR(tickets, !RULES.fairnessIncludesAsk)) < 0.25) break;
      if (a === ATTEMPTS - 1) STAT.unfair++;
    }
    STAT.shifts++; STAT.attempts += last.attempt + 1;
    const spec = { v: 1, game: 'kitchen', seed, avoid: [...ctx.last3], brief: RUN.brief, shift: RUN.shift, debrief: RUN.debrief, tank: RUN.tank, tickets: last.tickets, attempt: last.attempt };
    spec.plans = planShift(spec);
    return spec;
  }

  // spawn times: the first nine tickets are evenly spaced; phase 3 opens with K9's first ticket, its second spawns `gap` seconds later, the other two are spaced between
  function schedule(tickets) {
    tickets.forEach((t, i) => { if (i < 9) t.spawn = +(i * SPAWN.early).toFixed(2); t.ttl = RUN.phases[t.phase - 1].ticket; });
    const a = tickets.find((t) => t.concept === 'K9' && t.chainRole === 'first'), b = tickets.find((t) => t.concept === 'K9' && t.chainRole === 'second');
    a.spawn = +(9 * SPAWN.early).toFixed(2); b.spawn = +(a.spawn + b.gap).toFixed(2);
    const mid = tickets.filter((t) => t.phase === 3 && t !== a && t !== b);
    mid.forEach((t, k) => { t.spawn = +(a.spawn + b.gap * (k + 1) / (mid.length + 1)).toFixed(2); });
    tickets.sort((x, y) => x.spawn - y.spawn || x.idx - y.idx); tickets.forEach((t, i) => { t.idx = i; });
    return tickets;
  }

  // a fresh draw for the unit that holds ticket i (a K5 / K9 chain moves as one): the same concept, another variant, every other ticket stays
  function rerollOrder(spec, i, history) {
    const s = clone(spec), old = s.tickets[i], n = (s.rerolls = s.rerolls || {}), key = old.concept;
    n[key] = (n[key] || 0) + 1;
    const ctx = context(history || { runs: [{ variants: s.tickets.map((t) => t.variantId) }] }), used = new Set(s.tickets.map((t) => t.variantId));
    const cand = eligible(old.concept, ctx, used, old.rush ? (v) => v.rush : null);
    if (!cand.length) return { spec: s, tickets: [] };
    const rng = BG.mulberry32(BG.hash32(s.seed + ':reroll:' + key + ':' + n[key])), v = BG.pick(rng, cand), params = BG.sampleParams(rng, v.params);
    const extra = old.rush ? { rush: true } : old.otherName ? { otherName: old.otherName, otherRef: old.otherRef } : {};
    Object.assign(params, extra);
    const fresh = dealVariant(v, rng, params, 'r' + n[key] + key, old.phase, extra), unit = s.tickets.filter((t) => t.variantId === old.variantId);
    unit.forEach((t) => { const f = fresh.find((x) => x.chainRole === t.chainRole); s.tickets[s.tickets.indexOf(t)] = f; });
    s.tickets.forEach((t, k) => { t.idx = k; });
    schedule(s.tickets);
    s.plans = planShift(s);
    return { spec: s, tickets: fresh };
  }

  // ---------------------------------------------------------------- the state machine
  // pots hold items ({ uid, ticket, chunk, version, ... }) and, after a dish is taken, a residue (the chunks used plus the reply tokens, kept as chat history)
  function newState(spec) {
    return {
      spec, t: 0, tank: spec.tank, coins: 0, seq: 0, items: {}, dishes: {}, stock: {}, floor: [], results: [], log: [], spent: 0,
      tickets: spec.tickets.map((tk) => ({ tk, status: 'queued', spawnAt: null, expireAt: null })),
      pots: [0, 1].map((id) => ({ id, items: [], residue: null, busy: false })), stoves: [0, 1].map((id) => ({ id, pot: id, dial: 'short', dish: null })),
      by: Object.fromEntries(spec.tickets.map((t) => [t.uid, t])),
    };
  }
  const policyOf = (state, ticket) => RUN.phases[(state.by[ticket] || { phase: 1 }).phase - 1].policy;
  const live = (state) => state.tickets.filter((x) => x.status === 'live');
  const itemTokens = (it) => it.tokens[it.version];
  const fillOf = (pot) => pot.items.reduce((n, it) => n + itemTokens(it), 0) + (pot.residue ? pot.residue.tokens : 0);

  // move the clock: tickets spawn (at most 3 on the rail) and leave in time order, dishes burn, stock goes off
  function advance(state, t) {
    if (t < state.t) t = state.t;
    for (;;) {
      const rail = live(state), head = state.tickets.find((x) => x.status === 'queued'), evs = rail.map((x) => [x.expireAt, 'exp', x]);
      if (head && rail.length < RUN.maxTickets) evs.push([Math.max(head.tk.spawn, state.t), 'spawn', head]);
      evs.sort((a, b) => a[0] - b[0]);
      const e = evs[0]; if (!e || e[0] > t) break;
      state.t = e[0];
      if (e[1] === 'exp') { e[2].status = 'expired'; state.coins += RUN.coins.left; state.results.push({ ticket: e[2].tk.uid, stamp: 'Customer left', coins: RUN.coins.left, quality: 0, left: true, at: e[0], flags: [], bleed: false }); }
      else { e[2].status = 'live'; e[2].spawnAt = e[0]; e[2].expireAt = e[0] + e[2].tk.ttl; }
    }
    for (const d of Object.values(state.dishes)) { if (d.status === 'cooking' && t >= d.readyT) d.status = 'ready'; if (d.status === 'ready' && t > d.burnT) { d.status = 'burnt'; state.log.push({ t: d.burnT, e: 'burn', dish: d.id }); } }
    for (const k of Object.keys(state.stock)) { const s = state.stock[k]; if (s.warmUntil != null && t > s.warmUntil) delete state.stock[k]; }
    state.t = t;
  }
  const mkItem = (state, tk, c) => { const id = 'i' + (++state.seq); return (state.items[id] = { uid: id, ticket: tk.uid, chat: tk.chat, chunk: c.id, label: c.label, role: c.role, version: 'full', tokens: Object.assign({}, c.tokens), covers: clone(c.covers), stock: false }); };

  const fail = (reason) => ({ ok: false, reason });
  // an action log entry: { t, a, ...args }. Returns { ok, reason?, ... }; the same state and the same entry always give the same answer.
  function act(state, e) {
    advance(state, e.t);
    const R = RUN.time, it = e.item && state.items[e.item];
    switch (e.a) {
      case 'grab': { const x = state.by[e.ticket], c = x && x.chunks.find((k) => k.id === e.chunk); if (!c) return fail('no crate'); const tx = state.tickets.find((q) => q.tk.uid === e.ticket); if (!tx || tx.status !== 'live') return fail('not on the rail'); return { ok: true, item: mkItem(state, x, c).uid }; }
      case 'make': {
        if (!it) return fail('nothing carried'); const v = e.how === 'chop' ? 'summary' : 'excerpt';
        if (it.version !== 'full') return fail('already processed'); if (it.tokens[v] == null) return fail('no ' + v + ' version');
        if (it.stock) return fail('stock is used unchanged'); it.version = v; return { ok: true, version: v };
      }
      case 'prep': {
        if (!it || it.role !== 'stable' || it.version !== 'full') return fail('only a stable crate in full');
        const key = it.chunk + ':' + it.tokens.full; state.stock[key] = state.stock[key] || { key, chunk: it.chunk, label: it.label, tokens: it.tokens.full, warmUntil: null, preppedAt: e.t, covers: it.covers, role: it.role };
        delete state.items[it.uid]; return { ok: true, key };
      }
      case 'stock': {
        const s = state.stock[e.key]; if (!s) return fail('no stock');
        const tk = state.by[e.ticket], id = 'i' + (++state.seq);
        state.items[id] = { uid: id, ticket: e.ticket, chat: tk.chat, chunk: s.chunk, label: s.label, role: s.role, version: 'full', tokens: { full: s.tokens }, covers: clone(s.covers), stock: s.key, first: false };
        return { ok: true, item: id };
      }
      case 'load': {
        const pot = state.pots[e.pot]; if (!it) return fail('nothing carried'); if (pot.busy) return fail('pot busy');
        if (it.stock) it.first = !pot.items.length && !pot.residue;
        pot.items.push(it); it.at = e.t; it.ord = ++state.seq;
        const out = { ok: true, ejected: [] };
        if (RUN.phases[(state.by[it.ticket] || { phase: 1 }).phase - 1].policy === 'oldest-first' && RULES.ejectOnDrop) eject(state, pot, 0, out.ejected);
        return out;
      }
      case 'dial': { state.stoves[e.stove].dial = e.dial; return { ok: true }; }
      case 'wipe': { const pot = state.pots[e.pot]; if (pot.busy) return fail('pot busy'); pot.items = []; pot.residue = null; return { ok: true }; }
      case 'cook': {
        const st = state.stoves[e.stove], pot = state.pots[st.pot], tx = state.tickets.find((q) => q.tk.uid === e.ticket);
        if (st.dish || pot.busy) return fail('busy'); if (!tx || tx.status !== 'live') return fail('not on the rail');
        if (!pot.items.length) return fail('empty');
        const pol = RUN.phases[tx.tk.phase - 1].policy, dial = dialTok(st.dial), ejected = [];
        if (pol === 'oldest-first') eject(state, pot, dial, ejected);
        else if (fillOf(pot) + dial > RUN.capacity) return Object.assign(fail('lid'), { fill: fillOf(pot), dial });
        const cost = price(state, pot, e.t, false) + (pot.residue ? pot.residue.tokens : 0) + dial;
        if (cost > state.tank) return Object.assign(fail('gas'), { cost });
        price(state, pot, e.t, true);
        state.tank -= cost; state.spent += cost;
        const d = { id: 'd' + (++state.seq), ticket: e.ticket, stove: e.stove, startT: e.t, readyT: e.t + R.cooking, burnT: e.t + R.cooking + R.burn, status: 'cooking', items: pot.items.slice(), residue: pot.residue, dial: st.dial, spent: cost };
        state.dishes[d.id] = d; st.dish = d.id; pot.busy = true;
        return { ok: true, dish: d.id, spent: cost, ejected, readyT: d.readyT };
      }
      case 'take': {
        const st = state.stoves[e.stove], d = st.dish && state.dishes[st.dish]; if (!d) return fail('no dish'); if (d.status === 'cooking') return fail('still cooking');
        const pot = state.pots[st.pot]; st.dish = null; pot.busy = false;
        pot.residue = { tokens: d.items.reduce((n, x) => n + itemTokens(x), 0) + (d.residue ? d.residue.tokens : 0) + dialTok(d.dial), items: d.items.concat(d.residue ? d.residue.items : []), chats: d.items.map((x) => x.chat).concat(d.residue ? d.residue.chats : []) };
        pot.items = [];
        if (d.status === 'burnt') { d.status = 'ruined'; return Object.assign(fail('burnt'), { dish: d.id }); }
        d.status = 'carried'; return { ok: true, dish: d.id };
      }
      case 'serve': {
        const d = state.dishes[e.dish]; if (!d || d.status !== 'carried') return fail('no dish');
        const tx = state.tickets.find((q) => q.tk.uid === d.ticket); if (tx.status !== 'live') { d.status = 'late'; return fail('ticket gone'); }
        const j = judgeDish(tx.tk, d, e.t), par = state.spec.plans[d.ticket].spent, o = scoreOrder(j, d, par, tx.spawnAt, tx.tk.ttl, e.t);
        d.status = 'served'; tx.status = 'done'; state.coins += o.coins;
        const r = Object.assign({ ticket: d.ticket, at: e.t, spent: d.spent, par }, j, o); state.results.push(r); return Object.assign({ ok: true }, r);
      }
    }
    return fail('unknown action ' + e.a);
  }
  // an oldest-first pot: while the fill (and the dial) pass capacity, the oldest item hops out onto the floor; the residue is the oldest of all
  function eject(state, pot, dial, out) {
    while (fillOf(pot) + dial > RUN.capacity && (pot.residue || pot.items.length)) {
      if (pot.residue && pot.residue.items.length) { const x = pot.residue.items.shift(); pot.residue.tokens -= itemTokens(x); out.push({ item: x.uid, residue: true }); if (!pot.residue.items.length) pot.residue = null; continue; }
      if (pot.residue) { out.push({ residue: true }); pot.residue = null; continue; }
      const x = pot.items.shift(); state.floor.push(x); out.push({ item: x.uid });
    }
  }
  // what the pot costs at cook time: stock used FIRST in an empty pot, inside its 60 s, pays the discount; its first use pays full and starts the clock
  function price(state, pot, t, commit) {
    let n = 0;
    for (const it of pot.items) {
      let tok = itemTokens(it);
      if (it.stock && it.first) {
        const s = state.stock[it.stock];
        if (s && s.warmUntil != null && t <= s.warmUntil) tok = Math.ceil(RUN.stock.rate * tok);
        else if (s && commit) s.warmUntil = t + RUN.stock.seconds;
      }
      n += tok;
    }
    return n;
  }

  // ---------------------------------------------------------------- judging
  const STAMPS = { bleed: "LEAKED ANOTHER CUSTOMER'S ORDER", missing: 'MISSED THE POINT', cutoff: 'CUT OFF', overstuffed: 'OVER-STUFFED', rambling: 'RAMBLING', served: 'SERVED' };
  // d = a dish { items, residue, dial }. Order of the spec: bleed, missing slot, cut off, noise or duplicate, dial above the need, served.
  function judgeDish(t, d) {
    const items = d.items.concat(d.residue ? d.residue.items : []), all = items, need = t.reply.need, F = t.failReplies, L = t.reply.lines;
    const tokens = d.items.reduce((n, x) => n + itemTokens(x), 0) + (d.residue ? d.residue.tokens : 0) + dialTok(d.dial);
    const foreign = all.some((x) => x.chat !== t.chat);
    const base = { tokens, bleed: false, missing: [], flags: [] };
    if (foreign) return Object.assign(base, { quality: 0, stamp: STAMPS.bleed, bleed: true, reply: F.bleed });
    const cov = new Set(all.flatMap((x) => x.covers[x.version] || [])), missing = t.slots.required.concat(RULES.helpfulMissingFree ? [] : t.slots.helpful).filter((s) => !cov.has(s));
    if (missing.length) return Object.assign(base, { quality: 0, stamp: STAMPS.missing, missing, reply: F[missing[0]] || F.TASK });
    if (DRANK[d.dial] < DRANK[need]) return Object.assign(base, { quality: 0, stamp: STAMPS.cutoff, flags: ['cutoff'], reply: L.cut });
    const resHas = !!(d.residue && d.residue.items.length), seen = new Set();
    let noisy = false;
    for (const x of d.items) {
      if (x.role === 'noise' || x.role === 'duplicate' || (x.role === 'history' && resHas && RULES.historyWithResidueIsDuplicate)) noisy = true;
      const key = x.ticket + ':' + x.chunk; if (seen.has(key)) noisy = true; seen.add(key);
    }
    if (noisy) return Object.assign(base, { quality: RUN.coins.quality.overstuffed, stamp: STAMPS.overstuffed, flags: ['overstuffed'], reply: F.noise });
    if (DRANK[d.dial] > DRANK[need]) return Object.assign(base, { quality: RUN.coins.quality.rambling, stamp: STAMPS.rambling, flags: ['rambling'], reply: L.rambling });
    return Object.assign(base, { quality: 1, stamp: STAMPS.served, reply: L.good });
  }

  // ---------------------------------------------------------------- scoring
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // coins for one served dish: base 20 x quality, a token tip against par, a speed tip in the first half of the timer; a leak scores -5 and counts as a spill
  function scoreOrder(j, d, par, spawnAt, ttl, now) {
    const K = RUN.coins, o = { coins: 0, tip: 0, speed: 0, spill: false };
    if (j.bleed) return Object.assign(o, { coins: K.bleed, spill: true });
    if (j.quality <= 0) return o;
    const spent = d.spent;
    o.base = K.base * j.quality; o.tip = Math.round(K.tip * clamp((K.par * par - spent) / (K.parBand * par), 0, 1));
    o.speed = now - spawnAt <= ttl / 2 ? K.speed : 0; o.coins = o.base + o.tip + o.speed;
    o.clean = j.quality >= K.quality.rambling && spent <= K.clean * par + 1e-9;   // 1.15 * 100 is 114.99999999999999
    return o;
  }
  const IDEAL_TOTAL = RUN.orders * RUN.coins.ideal;
  const starsFor = (coins, spills) => (coins >= RUN.stars[2] * IDEAL_TOTAL && !spills ? 3 : coins >= RUN.stars[1] * IDEAL_TOTAL ? 2 : coins >= RUN.stars[0] * IDEAL_TOTAL ? 1 : 0);
  function scoreShift(state) {
    const rs = state.results, spills = rs.filter((r) => r.bleed).length, coins = rs.reduce((n, r) => n + r.coins, 0), by = {};
    const idealTokens = state.spec.tickets.reduce((n, t) => n + state.spec.plans[t.uid].spent, 0);
    for (const r of rs) {
      if (r.left) continue;
      const t = state.by[r.ticket], c = (by[t.concept] = by[t.concept] || { orders: 0, clean: 0, bleeds: 0, cutoffs: 0, overstuffed: 0, rambling: 0, variants: [] });
      c.orders++; if (r.clean && !r.bleed) c.clean++; if (r.bleed) c.bleeds++; if (r.flags.includes('cutoff')) c.cutoffs++; if (r.flags.includes('overstuffed')) c.overstuffed++; if (r.flags.includes('rambling')) c.rambling++;
      if (r.clean && !c.variants.includes(t.variantId)) c.variants.push(t.variantId);
    }
    return { coins, ideal: IDEAL_TOTAL, pct: coins / IDEAL_TOTAL, spills, stars: starsFor(coins, spills), spent: state.spent, idealTokens, tank: state.spec.tank, served: rs.filter((r) => !r.left && r.quality > 0).length, byConcept: by };
  }
  // a scripted shift: actions = [{ t, a, ... }] in time order; the result depends only on spec and actions
  function playActions(spec, actions) {
    const s = newState(spec), outs = [];
    for (const e of actions) outs.push(act(s, e));
    advance(s, RUN.shift);
    return { state: s, score: scoreShift(s), outs };
  }
  const estimateSeconds = () => RUN.brief + RUN.shift + RUN.debrief;

  return { RULES, SPAWN, STAT, LAYOUT, STAMPS, seedFor, context, eligible, composeShift, rerollOrder, schedule, solveIdeal, planShift, residueOf, sameLine, fairR, spearman, newState, advance, act, fillOf, price, judgeDish, scoreOrder, scoreShift, starsFor, playActions, estimateSeconds, IDEAL_TOTAL };
});
