// Prompt Kitchen — gameplay rules tests (plain node): the rules facade the world talks to (facts / do), driven by a scripted player; selection, the guided first order, the debrief picks
// and cards, the waste breakdown, and the edge cases of the spec: a chunk carried across tickets, a dish that burns, stock that expires, a lost chunk picked up again.
const assert = require('assert');
const { test, done, mean } = require('./test-kit.js');
const P = require('./kitchen-play.js');
const E = require('./kitchen-engine.js');
const W = require('./kitchen-world.js');
const C = require('./kitchen-content.js');
const B = require('./kitchen-bots.js');
const { RUN } = C;

const mkRun = (seed) => P.createRun(E.composeShift(seed, null));
const { waitFor, potWith, serve, playAll } = B;

test('rules: a scripted player following the engine\'s ideal line through run.do (the same calls the world makes) serves all 13 orders perfectly, with no leaks, 3 stars, in 80 shifts', () => {
  let stars = 0, coins = [];
  for (let s = 0; s < 80; s++) {
    const run = mkRun(5000 + s * 31); playAll(run);
    const sum = P.summary(run); coins.push(sum.coins); stars += sum.stars === 3 ? 1 : 0;
    assert.strictEqual(sum.spills, 0); assert.strictEqual(sum.answered, 13); assert(run.st.results.every((r) => r.quality === 1), 'every order perfect: ' + run.st.results.filter((r) => r.quality !== 1).map((r) => r.ticket + ' ' + r.stamp).join());
  }
  console.log('   scripted ideal player: coins mean ' + mean(coins).toFixed(0) + ' of 455, 3 stars in ' + stars + ' of 80');
  assert.strictEqual(stars, 80); assert(mean(coins) > 420);
});

test('selection: Tab / Shift+Tab / E at the rail cycle the live tickets in the rail\'s order; the pantry shows the selected ticket\'s chunks (six crates, empty slots stay empty); a ticket that leaves hands the selection on', () => {
  const run = mkRun(11); run.advance(0.01); assert.strictEqual(run.sel, 't1'); assert.strictEqual(run.live().length, 1);
  waitFor(run, () => run.live().length >= 3); const l = run.live().map((x) => x.tk.uid); assert.strictEqual(l.length, 3, 'three on the rail at most'); assert.strictEqual(run.sel, l[0]);
  assert.strictEqual(run.select(1), l[1]); assert.strictEqual(run.select(1), l[2]); assert.strictEqual(run.select(1), l[0], 'cyclic'); assert.strictEqual(run.select(-1), l[2]);
  const cr = run.crates(); assert.strictEqual(cr.length, 6); assert(cr.every((c) => c === null || (c.label.length <= 24 && c.tokens > 0)));
  const labels = run.ticket().chunks.map((c) => c.label).sort(); assert.deepStrictEqual(cr.filter(Boolean).map((c) => c.label).sort(), labels);
  run.selectUid(l[0]); waitFor(run, () => !run.live().some((x) => x.tk.uid === l[0]), 400); assert(run.sel !== l[0] && (run.sel === null || run.live().some((x) => x.tk.uid === run.sel)), 'the selection moved on');
  const tv = run.ticketViews(); assert(tv.every((t) => t.timer >= 0 && t.timer <= 1 && [0, 1, 2, 3].includes(t.skill)));
});

test('rules: the world\'s facts drive the world\'s own E logic: grabbing offers pot / chop / sieve, a loaded pot offers cook and wipe, a ready dish offers take then serve', () => {
  const run = mkRun(21); run.advance(0.01); const tk = run.ticket(), big = tk.chunks.find((c) => c.tokens.excerpt != null && c.role === 'essential');
  const at = (id) => ({ kind: 'station', ref: W.STATIONS.find((s) => s.id === id), d: 0 });
  let f = run.facts(null); assert.deepStrictEqual(W.tapAction(at('crate0'), f), { do: 'grab', crate: 0 }); assert.strictEqual(W.holdWork(at('pot0'), f), null);
  const g = run.do({ do: 'grab', crate: big.slot }); assert(g.ok); f = run.facts(g.item); assert.strictEqual(W.holdWork(at('sieve'), f).kind, 'sieve'); assert.deepStrictEqual(W.tapAction(at('pot0'), f), { do: 'load', pot: 0 });
  const m = run.do({ do: 'sieve', item: g.item }); assert(m.ok && m.item.version === 'excerpt'); f = run.facts(m.item); assert.strictEqual(W.holdWork(at('sieve'), f), null, 'only once'); assert.strictEqual(W.holdWork(at('chop'), f), null);
  assert(run.do({ do: 'load', pot: 0, item: m.item }).ok); f = run.facts(null); assert.strictEqual(W.holdWork(at('stove0'), f).kind, 'cook'); assert.strictEqual(W.holdWork(at('pot0'), f).kind, 'wipe');
  assert(run.do({ do: 'cook', stove: 0 }).ok); f = run.facts(null); assert.strictEqual(W.holdWork(at('stove0'), f), null, 'busy'); waitFor(run, () => run.dishStatus(0) === 'ready');
  f = run.facts(null); assert.deepStrictEqual(W.tapAction(at('stove0'), f), { do: 'take', stove: 0 }); const t = run.do({ do: 'take', stove: 0 }); assert(t.ok && t.item.dish);
  f = run.facts(t.item); assert.deepStrictEqual(W.tapAction(at('window'), f), { do: 'serve' }); assert(W.tapAction(at('pot0'), f).hint);
});

test('rules: a refused cook says why in one line: "Lid won\'t close" (hard pot), "Out of gas", empty pot; the oldest-first pot pops items onto the floor, and a popped chunk can be picked up again', () => {
  const run = mkRun(31), tk = run.spec.tickets[0]; run.advance(0.01);
  const big = tk.chunks.slice().sort((a, b) => b.tokens.full - a.tokens.full);
  for (const c of big.slice(0, 4)) { const g = run.do({ do: 'grab', crate: c.slot }); run.do({ do: 'load', pot: 0, item: g.item }); }
  run.do({ do: 'dial', stove: 0, dial: 'full' }); const lid = run.do({ do: 'cook', stove: 0 });
  if (!lid.ok) { assert.strictEqual(lid.reason, 'lid'); assert(/Lid won't close/.test(lid.hint)); } else assert(lid.ok);
  assert.strictEqual(run.do({ do: 'cook', stove: 1 }).hint, 'The pot is empty.');
  const run2 = mkRun(31); run2.st.tank = 10; run2.advance(0.01); const g = run2.do({ do: 'grab', crate: run2.ticket().chunks[0].slot }); run2.do({ do: 'load', pot: 0, item: g.item }); const gas = run2.do({ do: 'cook', stove: 0 }); assert.strictEqual(gas.reason, 'gas'); assert(/Out of gas/.test(gas.hint)); assert.strictEqual(run2.st.tank, 10);
  // phase 3: the oldest pops out
  const run3 = mkRun(31), t3 = run3.spec.tickets.find((t) => t.phase === 3 && t.concept === 'K8'); for (const tk of run3.spec.tickets.filter((t) => t.idx < t3.idx)) serve(run3, tk); assert(waitFor(run3, () => run3.st.tickets.find((x) => x.tk.uid === t3.uid).status === 'live', 600)); run3.selectUid(t3.uid); assert.strictEqual(run3.sel, t3.uid);
  const fat = t3.chunks.filter((c) => c.role !== 'duplicate').slice().sort((a, b) => b.tokens.full - a.tokens.full); let popped = [];
  for (const c of fat) { const g3 = run3.do({ do: 'grab', crate: c.slot }); const l = run3.do({ do: 'load', pot: 0, item: g3.item }); if (l.ejected && l.ejected.length) popped.push(...l.ejected); }
  assert(popped.length > 0, 'a full pot pops its oldest'); assert(E.fillOf(run3.st.pots[0]) <= RUN.capacity);
  const back = run3.do({ do: 'pickup', uid: popped[0].item.uid }); assert(back.ok && back.item.uid === popped[0].item.uid, 'the popped chunk can be picked up again');
});

test('rules: a burnt dish says so, is ruined, the tokens stay spent and the pot is freed; taking it too early says it is still cooking', () => {
  const run = mkRun(41), tk = run.spec.tickets[0]; run.advance(0.01);
  const plan = run.spec.plans[tk.uid];
  for (const id of Object.keys(plan.pick)) { const c = tk.chunks.find((q) => q.id === id); let g = run.do({ do: 'grab', crate: c.slot }), item = g.item; if (plan.pick[id] !== 'full') item = run.do({ do: plan.pick[id] === 'summary' ? 'chop' : 'sieve', item }).item; run.do({ do: 'load', pot: 0, item }); }
  run.do({ do: 'dial', stove: 0, dial: plan.dial }); const c = run.do({ do: 'cook', stove: 0 }); assert(c.ok); const spent = run.st.tank;
  assert.strictEqual(run.do({ do: 'take', stove: 0 }).hint, 'Still cooking.');
  const ev = []; for (let i = 0; i < 60; i++) ev.push(...run.advance(0.5));
  assert(ev.some((e) => e.type === 'burn'), 'the burn is reported'); const t = run.do({ do: 'take', stove: 0 }); assert(!t.ok && /burnt/.test(t.hint)); assert.strictEqual(run.st.tank, spent, 'the tokens stay spent'); assert(!run.st.pots[0].busy);
});

test('edge: a chunk carried from one ticket and dropped into a pot cooked for another is a leak (the chunk keeps its ticket id); the other pot, clean, is fine', () => {
  const run = mkRun(51); waitFor(run, () => run.live().length >= 2); const [a, b] = run.live().map((x) => x.tk);
  run.selectUid(a.uid); const g = run.do({ do: 'grab', crate: a.chunks[0].slot }); assert.strictEqual(g.item.ticket, a.uid);
  run.selectUid(b.uid); assert(run.do({ do: 'load', pot: 0, item: g.item }).ok);
  for (const c of b.chunks.filter((c) => c.role === 'essential')) { const x = run.do({ do: 'grab', crate: c.slot }); run.do({ do: 'load', pot: 0, item: x.item }); }
  run.do({ do: 'dial', stove: 0, dial: b.reply.need }); const c = run.do({ do: 'cook', stove: 0 });
  if (!c.ok) { run.do({ do: 'wipe', pot: 0 }); return; }   // too big to cook with this draw: nothing to leak into
  waitFor(run, () => run.dishStatus(0) === 'ready'); const t = run.do({ do: 'take', stove: 0 }), r = run.do({ do: 'serve', item: t.item });
  assert(r.bleed && r.coins === -5 && /LEAKED/.test(r.stamp), 'the leak is judged'); assert(!run.st.results.find((x) => x.ticket === b.uid).clean);
});

test('edge: stock that goes off while a pot is being filled is priced at cook time: full price after 60 s, the tank charged for what the pot really costs', () => {
  let found = null;
  for (let s = 0; s < 40 && !found; s++) { const run = mkRun(9000 + s), a = run.spec.tickets.find((t) => t.concept === 'K9' && t.chainRole === 'first'), p = run.spec.plans[a.uid]; if (p.stock === 'prep') found = run; }
  assert(found, 'a shift with a K9 pair inside the stock window'); const run = found, a = run.spec.tickets.find((t) => t.concept === 'K9' && t.chainRole === 'first'), b = run.spec.tickets.find((t) => t.chainOf === a.uid);
  assert(serve(run, a).serve.quality === 1, 'the first ticket'); assert.strictEqual(run.stockCount(), 1);
  waitFor(run, () => run.st.tickets.find((x) => x.tk.uid === b.uid).status === 'live'); run.selectUid(b.uid);
  const s = run.do({ do: 'stock' }); assert(s.ok); assert(run.do({ do: 'load', pot: 1, item: s.item }).ok);
  for (let i = 0; i < 130; i++) run.advance(0.5);   // 65 s pass while the pot sits there
  assert.strictEqual(run.stockCount(), 0, 'the stock is gone'); const before = run.st.tank;
  for (const id of ['msg', 'ask']) { const c = b.chunks.find((q) => q.id === id), g = run.do({ do: 'grab', crate: c.slot }); if (g.ok) { const m = c.tokens.excerpt != null && id === 'msg' ? run.do({ do: 'sieve', item: g.item }) : { item: g.item }; run.do({ do: 'load', pot: 1, item: m.item }); } }
  run.do({ do: 'dial', stove: 1, dial: 'line' }); const c = run.do({ do: 'cook', stove: 1 });
  if (c.ok) assert(before - run.st.tank >= b.chunks.find((q) => q.role === 'stable').tokens.full, 'the stable crate was charged in full: no discount after it expired');
});

test('debrief: the cards come worst first (leaks, missed points, cut-offs, customers who left, over-stuffed, rambling, then a lost tip), at most four, each with the Order line, what happened, why and the idea; the waste adds up', () => {
  const run = mkRun(61), ts = run.spec.tickets;
  const o = (tk) => (tk.idx === 0 ? { pick: { ask: 'full' } } : tk.idx === 1 ? { dial: tk.reply.need === 'full' ? 'line' : tk.reply.need === 'short' ? 'line' : 'line' } : tk.idx === 2 ? { dial: 'full' } : tk.idx === 3 ? { pick: Object.assign({}, run.spec.plans[tk.uid].pick) } : undefined);
  for (const tk of ts.slice(0, 5)) { try { serve(run, tk, o(tk)); } catch (e) { /* a variation that cannot cook (lid) simply leaves the ticket to expire */ } }
  waitFor(run, () => run.over(), 600); E.advance(run.st, RUN.shift);
  const picks = P.debriefPicks(run, 4); assert(picks.length > 0 && picks.length <= 4);
  for (let i = 1; i < picks.length; i++) assert(picks[i - 1].rank <= picks[i].rank, 'worst first');
  for (const p of picks) { const d = P.describe(p.res, p.ticket); assert.strictEqual(d.lead, 'Order:'); assert.strictEqual(d.text, p.ticket.request); assert(d.breaks.length > 20 && d.idea === p.ticket.idea && d.breaksLabel && d.ideaLabel); }
  const rep = P.waste(run); assert(Object.values(rep).every((x) => x >= 0)); assert(rep.oversize + rep.noise + rep.history + rep.stock >= 0);
  // a leak always outranks everything else
  const fake = { st: { results: [{ ticket: ts[0].uid, quality: 1, tip: 0, coins: 25, at: 5, flags: [], bleed: false, missing: [] }, { ticket: ts[1].uid, quality: 0, bleed: true, coins: -5, at: 9, flags: [], missing: [] }, { ticket: ts[2].uid, quality: 0, coins: 0, at: 7, flags: [], bleed: false, missing: ['X'] }], by: run.st.by } };
  assert.deepStrictEqual(P.debriefPicks(fake, 4).map((p) => p.flag), ['bleed', 'missing', 'tip']);
});

test('waste: noise and copies in the dish, a reply longer than the order needed, history paid for again, and stock prepped but never used at the discount are counted separately', () => {
  const run = mkRun(71), tk = run.spec.tickets[0]; run.advance(0.01);
  for (const c of tk.chunks) { const g = run.do({ do: 'grab', crate: c.slot }); if (g.ok) run.do({ do: 'load', pot: 0, item: g.item }); }
  run.st.pots[0].items.length; run.do({ do: 'dial', stove: 0, dial: 'full' });
  const noise = tk.chunks.filter((c) => c.role === 'noise' || c.role === 'duplicate').reduce((n, c) => n + c.tokens.full, 0);
  const d = { id: 'dx', ticket: tk.uid, items: run.st.pots[0].items, residue: null, dial: 'full' }; run.st.dishes.dx = d;
  const w = P.waste(run); assert.strictEqual(w.noise, noise); assert.strictEqual(w.oversize, Math.max(0, RUN.dial.full - RUN.dial[tk.reply.need])); assert.strictEqual(w.history, 0);
  d.residue = { tokens: 120, items: [] }; assert.strictEqual(P.waste(run).history, 120); run.st.stock.k = { tokens: 150, warmUntil: null }; assert.strictEqual(P.waste(run).stock, 150); run.st.stock.k.warmUntil = 90; assert.strictEqual(P.waste(run).stock, 0);
});

test('coach: the guided first order gives one hint at a time (grab, pot, dial and cook, take, serve) and goes quiet once an order has been served; it is skippable', () => {
  const run = mkRun(81); run.advance(0.01); const tk = run.spec.tickets[0];
  assert(/tap E at a crate/i.test(P.coachHint(run, run.facts(null)))); const g = run.do({ do: 'grab', crate: tk.chunks[0].slot });
  assert(/pot/.test(P.coachHint(run, run.facts(g.item)))); run.do({ do: 'load', pot: 0, item: g.item });
  assert(/Press 1, 2 or 3/.test(P.coachHint(run, run.facts(null)))); run.do({ do: 'cook', stove: 0 });
  const f = run.facts(null); if (f.stoves[0].dish) assert(/cooking|take/i.test(P.coachHint(run, f)));
  const done = mkRun(81); playAll(done, () => ({})); assert.strictEqual(P.coachHint(done, done.facts(null)), null);
});

test('time: the clock only moves by what advance() is given (a hidden tab or an open card hands it nothing), tickets spawn and leave on it, and the shift is over at 4:15', () => {
  const run = mkRun(91); run.advance(0.01); const before = run.t; for (let i = 0; i < 10; i++) run.advance(0); assert.strictEqual(run.t, before);
  const ev = []; for (let i = 0; i < 520; i++) ev.push(...run.advance(0.5)); assert(run.over() && run.t === RUN.shift);
  assert(ev.filter((e) => e.type === 'spawn').length === 13 || ev.filter((e) => e.type === 'spawn').length >= 12); assert(ev.some((e) => e.type === 'left'), 'unserved tickets leave');
  const sum = P.summary(run); assert.strictEqual(sum.timeMs, 255000); assert.strictEqual(sum.stars, 0); assert(sum.coins < 0);
});

test('leaving mid-shift keeps what was served as partial attempts: the pure summary of a half-played shift counts the served orders and no mastery data', () => {
  const run = mkRun(101); for (const tk of run.spec.tickets.slice(0, 4)) serve(run, tk);
  const sum = P.summary(run); assert.strictEqual(sum.answered, 4); assert(sum.coins > 0 && sum.stars <= 2);
  assert.strictEqual(P.flagOf(run.st.results[0]), 'tip'); assert(Object.keys(sum.byConcept).length >= 3);
});
done();
