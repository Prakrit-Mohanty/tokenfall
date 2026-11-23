// Token Brew Kitchen — game tests (plain node): the orders data (kitchen-orders.js), the shuffle, the pot and serve judging, and the pure rules and pictures of kitchen-play.js.
const assert = require('assert');
const { test, done, words } = require('./test-kit.js');
const O = require('./kitchen-orders.js');
const P = require('./kitchen-play.js');

const shift = (id = 'p1', n = 0) => O.buildShift(id, n);
const run = (id, n) => P.createRun(shift(id, n));
const needs = (o) => o.cards.filter((c) => c.kind === 'need').map((c) => c.id), junk = (o) => o.cards.filter((c) => c.kind === 'junk').map((c) => c.id);
// play the current order: read, pick the pot, put `inPot` in the pot and everything else in the bin (the tutorial has no bin: everything goes in the pot)
function play(r, potId, inPot) {
  r.gotIt(); assert(r.pickPot(potId).ok, 'the pot can be picked'); const o = r.order();
  for (const c of o.cards) assert(r.place(c.id, inPot.includes(c.id) ? 'pot' : 'bin').ok, c.id);
  return r.serve();
}
const atOrder = (r, i) => { r.i = i; r.step = 'read'; r.cards = r.order().cards.map((c) => ({ id: c.id, state: 'idle' })); return r; };

test('data: the task bank is sound (asks of 6 words or fewer, 4 needed cards and 3+ junk cards each, sizes and labels in limits, every kind of pot has enough jobs, no duplicate ids)', () => {
  assert.deepStrictEqual(O.validate(), []);
  assert.deepStrictEqual(O.POTS.map((p) => p.id), ['small', 'medium', 'large']);
  for (const t of O.TASKS) { assert(words(t.ask) <= 6, t.id); assert(t.detail.length <= 60, t.id); const u = t.items.filter((x) => x.kind === 'need').reduce((n, x) => n + x.w, 0); assert(u + O.SLACK.loose <= O.GAUGE - 1, t.id + ': the fill line fits the gauge'); }
  // the checker really checks: bad tasks are reported
  const bad = { id: 'x', need: 'huge', icon: '', ask: 'one two three four five six seven', detail: 'y'.repeat(61), items: [{ kind: 'need', label: 'a', w: 3, icon: '' }, { kind: 'junk', label: 'a', w: 1, icon: '', why: '' }] }; O.TASKS.push(bad);
  try { assert(O.validate().length >= 8, 'the faults are named: ' + O.validate().length); } finally { O.TASKS.pop(); }
  assert.deepStrictEqual(O.validate(), []);
});

test('shift: 5 orders (small, large, medium, small, large), the tutorial first, each task from the bank and never repeated, a customer with a face and a name on every ticket', () => {
  const s = shift(); assert.strictEqual(s.orders.length, 5);
  assert.deepStrictEqual(s.orders.map((o) => o.need), ['small', 'large', 'medium', 'small', 'large']);
  assert.deepStrictEqual(s.orders.map((o) => o.no), [1, 2, 3, 4, 5]);
  assert.strictEqual(new Set(s.orders.map((o) => o.task)).size, 5, 'no task twice in a shift');
  for (const o of s.orders) {
    const t = O.TASKS.find((x) => x.id === o.task); assert(t && t.need === o.need && t.ask === o.ask && t.icon === o.icon);
    assert(o.customer.name && o.customer.face >= 0 && o.customer.face < 5); assert(O.CONCEPTS.some((c) => c.id === o.concept));
  }
  assert.strictEqual(new Set(s.orders.map((o) => o.customer.name)).size, 5, 'five different customers');
});

test('cards: 4 to 6 cards an order, every needed card of the task is there, junk only where the ramp says, the fill line a little above what the job needs, and no card id twice', () => {
  for (let n = 0; n < 30; n++) {
    const s = shift('c' + n, n);
    for (const o of s.orders) {
      assert(o.cards.length >= 4 && o.cards.length <= 6, o.cards.length + ' cards'); assert.strictEqual(new Set(o.cards.map((c) => c.id)).size, o.cards.length);
      const task = O.TASKS.find((t) => t.id === o.task), want = task.items.filter((x) => x.kind === 'need').map((x) => x.label).sort();
      assert.deepStrictEqual(o.cards.filter((c) => c.kind === 'need').map((c) => c.label).sort(), want);
      assert.strictEqual(junk(o).length, o.ramp.junk ? O.JUNK_SHOWN : 0);
      const u = o.cards.filter((c) => c.kind === 'need').reduce((a, c) => a + c.w, 0); assert.strictEqual(o.line, u + (o.ramp.tight ? O.SLACK.tight : O.SLACK.loose)); assert(o.line < O.GAUGE);
      for (const c of o.cards) assert(c.label && c.icon && c.w >= 1 && c.w <= 3 && (c.kind === 'need' || (c.w >= 2 && c.why)));
    }
  }
});

test('ramp: ONE new thing per order: only the tutorial locks the pots, junk arrives at order 3, a tighter line at 4, a timer only at 5', () => {
  const s = shift(), r = s.orders.map((o) => o.ramp);
  assert.deepStrictEqual(r.map((x) => !!x.onlyRightPot), [true, false, false, false, false]);
  assert.deepStrictEqual(r.map((x) => !!x.junk), [false, false, true, true, true]);
  assert.deepStrictEqual(r.map((x) => !!x.tight), [false, false, false, true, true]);
  assert.deepStrictEqual(r.map((x) => !!x.timer), [false, false, false, false, true]);
  assert.deepStrictEqual(s.orders.map((o) => junk(o).length), [0, 0, 2, 2, 2]); assert(s.orders[3].line - s.orders[3].cards.filter((c) => c.kind === 'need').reduce((a, c) => a + c.w, 0) < s.orders[2].line - s.orders[2].cards.filter((c) => c.kind === 'need').reduce((a, c) => a + c.w, 0), 'order 4 leaves less room than order 3');
  s.orders[0].ramp.junk = true; assert(!shift().orders[0].ramp.junk, 'a shift owns its own ramp: editing one does not leak into the next');
});

test('shuffle: the same player and run always get the same shift; another run or player gets another; over 60 players every job turns up, the tutorial job varies, and the cards come in different orders', () => {
  assert.deepStrictEqual(shift('ann', 3), shift('ann', 3));
  assert.notDeepStrictEqual(shift('ann', 3).orders.map((o) => o.task), shift('ann', 4).orders.map((o) => o.task));
  const seen = new Set(), firsts = new Set(), orders = new Set(); let same = 0;
  for (let i = 0; i < 60; i++) { const s = shift('pl' + i, i % 5); s.orders.forEach((o) => seen.add(o.task)); firsts.add(s.orders[0].task); orders.add(s.orders[2].cards.map((c) => c.label).join('|')); if (JSON.stringify(s.orders.map((o) => o.task)) === JSON.stringify(shift('pl0', 0).orders.map((o) => o.task))) same++; }
  assert.strictEqual(seen.size, O.TASKS.length, 'every task is used'); assert(firsts.size >= 3, 'the tutorial job varies too'); assert(same < 10, 'most players do not get the same shift'); assert(orders.size > 30, 'cards are shuffled');
  assert.notStrictEqual(O.seedFor('a', 1), O.seedFor('a', 2)); assert.notStrictEqual(O.seedFor('a', 1), O.seedFor('b', 1));
});

test('pot: right only when the pot is the one that fits; every wrong pick says in a plain sentence what it cost, and there is a different sentence for each pairing', () => {
  const sentences = new Set();
  for (const need of O.NEEDS) for (const pot of O.NEEDS) {
    const j = O.judgePot({ need }, pot); assert.strictEqual(j.right, need === pot); assert.strictEqual(j.verdict, need === pot ? 'right' : O.POTS.findIndex((p) => p.id === pot) > O.POTS.findIndex((p) => p.id === need) ? 'tooBig' : 'tooSmall');
    assert(j.why.length > 0 && words(j.why) <= 14, j.why); assert.strictEqual(j.stars, need === pot ? 1 : 0); sentences.add(j.why);
  }
  assert.strictEqual(sentences.size, 9);
  assert.strictEqual(O.judgePot({ need: 'small' }, 'large').why, 'The big pot for a tiny job cost extra.'); assert.strictEqual(O.judgePot({ need: 'large' }, 'small').why, 'The small pot ran out of steam on a big job.');
});

test('serve: three stars (the right pot, the right cards and no junk, under the line); the customer says the biggest slip first: overflow, wrong pot, junk, left out; 2 stars or more is a happy face', () => {
  const o = shift('s1', 0).orders[3], ok = needs(o), j = junk(o), fix = (potId, ids) => O.judgeServe(o, potId, ids);   // order 4: junk, and a tight line
  let r = fix(o.need, ok); assert.deepStrictEqual(r.stars, { pot: true, clean: true, line: true }); assert.strictEqual(r.total, 3); assert.strictEqual(r.kind, 'ok'); assert(r.happy); assert.strictEqual(r.why, O.SAY.ok);
  r = fix(o.need, ok.concat(j[0])); assert.strictEqual(r.kind, 'overflow', 'one junk card is too much for a tight line'); assert.deepStrictEqual(r.stars, { pot: true, clean: false, line: false }); assert.strictEqual(r.total, 1); assert(!r.happy); assert.strictEqual(r.why, O.SAY.overflow);
  r = fix('large', ok); assert.strictEqual(r.kind, 'wrongpot'); assert.deepStrictEqual(r.stars, { pot: false, clean: true, line: true }); assert.strictEqual(r.total, 2); assert(r.happy, 'two stars still smiles'); assert.strictEqual(r.why, O.judgePot(o, 'large').why);
  r = fix(o.need, ok.slice(1)); assert.strictEqual(r.kind, 'missing'); assert.deepStrictEqual(r.stars, { pot: true, clean: false, line: true }); assert(/^You left out /.test(r.why)); assert.deepStrictEqual(r.missing, [o.cards.find((c) => c.id === ok[0]).label]);
  r = fix('large', ok.concat(j)); assert.strictEqual(r.total, 0); assert.strictEqual(r.kind, 'overflow', 'an overflow outranks the wrong pot'); assert(!r.happy);
  // a loose line forgives one junk card but it still costs the "right cards" star, and says why in the junk's own words
  const o3 = shift('s1', 0).orders[2], j3 = o3.cards.find((c) => c.kind === 'junk');
  r = O.judgeServe(o3, o3.need, needs(o3).concat(j3.id)); assert.strictEqual(r.kind, 'junk'); assert.deepStrictEqual(r.stars, { pot: true, clean: false, line: true }); assert.strictEqual(r.why, j3.why); assert.deepStrictEqual(r.junkIn, [j3.label]);
  assert.strictEqual(O.judgeServe(o3, o3.need, needs(o3).concat(junk(o3))).kind, 'overflow', 'both junk cards overflow even the loose line');
  r = O.judgeServe(o3, o3.need, []); assert.strictEqual(r.kind, 'missing', 'an empty pot is missing everything'); assert.strictEqual(r.level, 0);
});

test('flow: read, then the pot, then the cards, then Serve, then the reaction: each step only from the one before; Got it twice, a pot or a card too early do nothing', () => {
  const r = run(); const o = r.order(); assert.strictEqual(r.step, 'read'); assert.strictEqual(r.stepNo(), 1);
  assert.deepStrictEqual(r.pickPot('small'), { ok: false, reason: 'step' }, 'no pot before the order is read'); assert.deepStrictEqual(r.place(o.cards[0].id, 'pot'), { ok: false, reason: 'step' }); assert.strictEqual(r.serve().reason, 'step');
  assert(r.gotIt()); assert.strictEqual(r.step, 'pot'); assert(!r.gotIt(), 'Got it only works once'); assert.strictEqual(r.stepNo(), 2); assert.strictEqual(r.place(o.cards[0].id, 'pot').reason, 'step', 'no cards before the pot');
  const p = r.pickPot(o.need); assert(p.ok && p.right); assert.strictEqual(r.step, 'add'); assert.strictEqual(r.stepNo(), 3); assert.strictEqual(r.pickPot('small').reason, 'step', 'one pick per order');
  assert.strictEqual(r.result, null, 'the verdict waits for Serve'); assert.strictEqual(r.serve().reason, 'unsorted', 'Serve waits for every card to be sorted'); assert(/Sort every card/.test(r.serve().nudge));
  for (const c of o.cards) r.place(c.id, 'pot'); const s = r.serve(); assert(s.ok); assert.strictEqual(r.step, 'react'); assert.strictEqual(r.serve().reason, 'step', 'served once'); assert.strictEqual(r.place(o.cards[0].id, 'idle').reason, 'step');
  assert(r.next()); assert.strictEqual(r.i, 1); assert.strictEqual(r.step, 'read'); assert(!r.next(), 'next only from the reaction');
});

test('tutorial: only the fitting pot can be tapped, nothing can be binned, there are only needed cards, a wrong tap says so kindly and changes nothing, and every way of playing it earns 3 stars', () => {
  for (let n = 0; n < 40; n++) {
    const r = run('t' + n, n), o = r.order(); assert(o.ramp.onlyRightPot && o.need === 'small'); assert.strictEqual(junk(o).length, 0); r.gotIt();
    for (const p of O.POTS) assert.strictEqual(r.canPick(p.id), p.id === o.need);
    for (const p of O.POTS.filter((x) => x.id !== o.need)) { const x = r.pickPot(p.id); assert(!x.ok && x.reason === 'locked' && /glowing/.test(x.nudge)); assert.strictEqual(r.step, 'pot'); }
    assert(r.pickPot(o.need).ok);
    const bin = r.place(o.cards[0].id, 'bin'); assert(!bin.ok && bin.reason === 'locked' && /Tap Pot/.test(bin.nudge)); assert.strictEqual(r.cards[0].state, 'idle');
    // the guide: the arrow is on the first card that is still waiting, then on Serve
    for (let k = 0; k < o.cards.length; k++) { assert.deepStrictEqual(r.target(), { kind: 'card', id: r.cards.find((s) => s.state === 'idle').id }); r.place(r.cards.find((s) => s.state === 'idle').id, 'pot'); }
    assert.deepStrictEqual(r.target(), { kind: 'serve' }); assert.strictEqual(r.banner(), 'Check the pot, then tap Serve.');
    const s = r.serve(); assert(s.ok && s.total === 3 && s.happy && s.kind === 'ok'); assert(!r.over());
  }
});

test('cards: a card goes in the pot, in the bin, or back (Undo); the pot\'s level adds the card sizes; over the fill line is flagged and undoing fixes it; the bin counts', () => {
  const r = atOrder(run('g1', 0), 3); r.step = 'add'; r.pot = O.judgePot(r.order(), 'small'); const o = r.order(), n = needs(o), j = junk(o);
  assert.strictEqual(r.level(), 0); assert(!r.over()); assert.strictEqual(r.line(), o.line);
  for (const id of n) r.place(id, 'pot'); const base = r.level(); assert.strictEqual(base, o.cards.filter((c) => c.kind === 'need').reduce((a, c) => a + c.w, 0)); assert(!r.over()); assert(!r.sorted(), 'junk cards still unsorted');
  assert.strictEqual(r.place(j[0], 'pot').ok, true); assert(r.over(), 'a junk card tips a tight line over'); assert.strictEqual(r.level(), base + o.cards.find((c) => c.id === j[0]).w);
  r.place(j[0], 'idle'); assert(!r.over()); r.place(j[0], 'bin'); r.place(j[1], 'bin'); assert.strictEqual(r.binned(), 2); assert(r.sorted()); assert.deepStrictEqual(r.target(), { kind: 'serve' }); assert.strictEqual(r.banner(), 'Check the pot, then tap Serve.');
  assert.deepStrictEqual(r.place('nope', 'pot'), { ok: false, reason: 'step' }); assert.deepStrictEqual(r.place(n[0], 'oven'), { ok: false, reason: 'dest' });
  const v = r.cardViews(); assert.strictEqual(v.length, o.cards.length); assert(v.every((c) => !('kind' in c) && !('why' in c)), 'the screen is never told which card is junk');
  assert.strictEqual(r.serve().total, 3); assert.strictEqual(r.result.kind, 'ok');
});

test('order 2 on: all three pots can be tapped and the bin works; a wrong pot is only found out at Serve, with the reason and a sad face; the right everything makes a happy one', () => {
  for (const i of [1, 2, 3, 4]) {
    const r = atOrder(run('o' + i, i), i), o = r.order(); r.gotIt(); assert(!o.ramp.onlyRightPot); for (const p of O.POTS) assert(r.canPick(p.id));
    const wrong = O.POTS.find((p) => p.id !== o.need).id, s = play(r, wrong, needs(o)); assert(s.ok && !s.stars.pot); assert.strictEqual(r.mood(), s.happy ? 'happy' : 'sad');
    const r2 = atOrder(run('o' + i, i), i); const best = play(r2, o.need, needs(o)); assert.strictEqual(best.total, 3); assert.strictEqual(r2.mood(), 'happy'); assert.strictEqual(r2.result.why, O.SAY.ok);
  }
  const r3 = atOrder(run(), 2); r3.gotIt(); assert(!r3.canPick('zzz') && r3.pickPot('zzz').reason === 'locked', 'an unknown pot is not a pot');
  const r4 = atOrder(run('o4', 3), 3), o4 = r4.order(); assert(play(r4, o4.need, needs(o4).concat(junk(o4)[0])).kind === 'overflow'); assert.strictEqual(r4.mood(), 'sad'); assert.strictEqual(r4.result.why, O.SAY.overflow); assert.strictEqual(r4.banner(), 'Tap Next order to go on.', 'the banner says what to tap; the customer says why');
});

test('instruction: one short sentence per step (a dozen words at most), the tutorial names the pot, "?" shows the same sentence again, and what should glow follows the step', () => {
  const r = run(); const said = [r.banner()]; assert.strictEqual(r.banner(), 'Read the order, then tap Got it.'); assert.deepStrictEqual(r.target(), { kind: 'gotit' });
  r.gotIt(); said.push(r.banner()); assert(/glowing small pot/.test(r.banner())); assert.deepStrictEqual(r.target(), { kind: 'pot', id: 'small' });
  r.pickPot('small'); said.push(r.banner()); assert.strictEqual(r.banner(), 'Tap Pot to add each card.');
  for (const c of r.order().cards) r.place(c.id, 'pot'); said.push(r.banner()); r.serve(); said.push(r.banner()); assert.strictEqual(r.target(), null);
  for (const s of said) assert(words(s) <= 12, s);
  assert.strictEqual(said[said.length - 1], 'Tap Next order to go on.'); const last = atOrder(run(), 4); last.step = 'react'; last.result = { why: 'x' }; assert.strictEqual(last.banner(), 'Tap See how it went.');
  const r2 = atOrder(run(), 1); r2.gotIt(); assert.strictEqual(r2.banner(), 'Pick the pot that fits the job.'); assert.deepStrictEqual(r2.target(), { kind: 'pots' }); r2.pickPot('large'); assert.strictEqual(r2.banner(), 'Add what the job needs. Stay under the line.'); assert.deepStrictEqual(r2.target(), { kind: 'cards' });
  const r3 = atOrder(run(), 2); r3.gotIt(); r3.pickPot('medium'); assert.strictEqual(r3.banner(), 'Pot for what the job needs. Bin for the rest.'); assert(words(r3.banner()) <= 12);
  assert.strictEqual(r3.banner(), r3.banner(), 'asking again changes nothing');
});

test('shift: five orders in a row, each served earns its stars, the last one ends the run (done, a shift rating, nothing more to tap), and the log keeps every order', () => {
  const r = run('end', 0), sc = [];
  for (let i = 0; i < 5; i++) { const o = r.order(); assert.strictEqual(r.i, i); const s = play(r, o.need, needs(o)); assert.strictEqual(s.total, 3); sc.push(s.total); assert(r.next()); }
  assert(r.done && r.step === 'done'); assert.strictEqual(r.log.length, 5); assert.strictEqual(r.stars(), 15); assert.strictEqual(r.maxStars(), 15); assert.strictEqual(r.shiftStars(), 3); assert(!r.next() && !r.gotIt());
  assert.deepStrictEqual(r.log.map((x) => x.order), [1, 2, 3, 4, 5]); assert(r.log.every((x) => x.kind === 'ok' && x.ask && x.icon));
  const worst = run('end', 1); for (let i = 0; i < 5; i++) { const o = worst.order(), wrong = O.POTS.find((p) => p.id !== o.need && Math.abs(O.POTS.findIndex((q) => q.id === p.id) - O.POTS.findIndex((q) => q.id === o.need)) === 2) || O.POTS.find((p) => p.id !== o.need); if (i === 0) { worst.gotIt(); worst.pickPot(o.need); for (const c of o.cards) worst.place(c.id, 'pot'); worst.serve(); } else { play(worst, wrong.id, i < 2 ? needs(o) : needs(o).concat(junk(o))); } worst.next(); }
  assert(worst.done); assert(worst.stars() < 8 && worst.shiftStars() < 3, 'a poor shift is rated lower: ' + worst.stars());
  const half = run('x', 0); half.log = [{ total: 3 }, { total: 3 }, { total: 2 }, { total: 0 }, { total: 0 }]; assert.strictEqual(half.shiftStars(), 2); half.log = []; assert.strictEqual(half.shiftStars(), 0);
});

test('timer: none before order 5; order 5 starts a generous one when the order is read, it only runs while the pot or cards are being worked on, and each tap leaves most of it', () => {
  const r = run('tm', 0);
  for (let i = 0; i < 4; i++) { const o = r.order(); assert(!o.ramp.timer); r.gotIt(); assert.strictEqual(r.timer, null, 'no timer on order ' + o.no); assert.strictEqual(r.timeFrac(), null); assert.strictEqual(r.tick(1000), null); play(Object.assign(r, { step: 'pot' }), o.need, needs(o)); r.step = 'react'; r.cards = o.cards.map((c) => ({ id: c.id, state: 'idle' })); r.next(); }
  assert.strictEqual(r.i, 4); const o5 = r.order(); assert(o5.ramp.timer && o5.ramp.junk && o5.ramp.tight); assert(O.TIMER.seconds >= 60, 'generous: ' + O.TIMER.seconds);
  assert.strictEqual(r.timer, null, 'not before Got it'); assert.strictEqual(r.tick(30), null, 'reading the order costs nothing'); r.gotIt(); assert.deepStrictEqual(r.timer, { total: O.TIMER.seconds, left: O.TIMER.seconds }); assert.strictEqual(r.timeFrac(), 1);
  assert.strictEqual(r.tick(5), null); assert.strictEqual(r.timer.left, O.TIMER.seconds - 5); r.pickPot(o5.need); for (const c of o5.cards) r.place(c.id, needs(o5).includes(c.id) ? 'pot' : 'bin'); assert(r.timeFrac() > 0.85, 'a quick player has most of it left');
  const s = r.serve(); assert(s.ok && s.total === 3); assert.strictEqual(r.timer, null, 'Serve stops the clock'); assert.strictEqual(r.timeFrac(), null); assert.strictEqual(r.tick(999), null, 'no time passes in the reaction');
});

test('timer: when it runs out the customer gets what is in the pot: partial credit, "too late" unless the pot was already perfect, a missing pot counts as the wrong one, and the run goes on', () => {
  const mk = () => { const r = run('tu', 0); r.i = 4; r.step = 'read'; r.cards = r.order().cards.map((c) => ({ id: c.id, state: 'idle' })); r.gotIt(); return r; };
  let r = mk(); const o = r.order(); r.pickPot(o.need); for (const id of needs(o).slice(0, 2)) r.place(id, 'pot');
  assert.strictEqual(r.tick(O.TIMER.seconds - 1), null); const t = r.tick(2); assert(t && t.ok && t.late); assert.strictEqual(t.kind, 'late'); assert.strictEqual(t.why, O.SAY.late); assert.strictEqual(r.step, 'react'); assert.strictEqual(r.timer, null);
  assert.deepStrictEqual(t.stars, { pot: true, clean: false, line: true }, 'the right pot and the cards so far still count'); assert.strictEqual(r.log.length, 1); assert.strictEqual(r.log[0].kind, 'late'); assert.strictEqual(r.timeUp(), null, 'only once');
  assert(r.next() && r.done);
  r = mk(); const n = r.tick(1000); assert(n.late && !n.stars.pot && n.total <= 1, 'no pot picked: nothing to serve with'); assert.strictEqual(r.pot, null);
  r = mk(); r.pickPot(o.need); for (const id of needs(o)) r.place(id, 'pot'); const p = r.tick(1000); assert.strictEqual(p.kind, 'ok', 'a perfect pot left unserved still counts as perfect'); assert.strictEqual(p.total, 3);
  r = mk(); r.pickPot(o.need); for (const c of o.cards) r.place(c.id, 'pot'); const q = r.tick(1000); assert(q.late && q.kind === 'late' && !q.stars.line, 'an overflowing pot is too late and over the line'); assert(r.cardViews().every((c) => c.state === 'pot'));
});

test('recap: the three ideas, each with how many orders went right for it (the pot, the right cards, under the line), and the perfect tasks by lesson for progress', () => {
  const r = run('rc', 0), want = [];
  for (let i = 0; i < 5; i++) { const o = r.order(); const wrong = i === 1 ? O.POTS.find((p) => p.id !== o.need).id : o.need; play(r, wrong, i === 3 && !o.ramp.onlyRightPot ? needs(o).concat(junk(o)[0]) : needs(o)); want.push(r.result.total); r.next(); }
  const rc = r.recap(); assert.deepStrictEqual(rc.map((x) => x.id), ['size', 'trim', 'check']); assert(rc.every((x) => x.of === 5 && x.line && x.title));
  assert.deepStrictEqual(rc.map((x) => x.got), [4, 4, 4], 'one wrong pot (order 2), one junk card (order 4), which also overflowed the tight line');
  // the junk in order 4 loses "right cards" AND "under the line"; the wrong pot in order 2 loses the pot
  const cv = r.cleanVariants(); assert.deepStrictEqual(Object.keys(cv).sort(), ['check', 'size', 'trim']); assert.strictEqual(cv.size.length, 1); assert.strictEqual(cv.trim.length, 1); assert.strictEqual(cv.check.length, 1);
  assert.strictEqual(r.log[1].total, 2); assert.strictEqual(r.log[3].total, 1); assert(r.log.every((x) => x.stars && x.task && x.concept)); assert.deepStrictEqual(r.log.map((x) => x.total), want);
  assert.deepStrictEqual(O.CONCEPTS.map((c) => c.recap.length > 0 && c.recap.length <= 80), [true, true, true]);
  const none = run('rc', 1); assert.deepStrictEqual(none.recap().map((x) => [x.got, x.of]), [[0, 0], [0, 0], [0, 0]]); assert.deepStrictEqual(none.cleanVariants(), {});
});

test('pictures: a face for every customer and mood (happy and sad differ), three pots of growing size, all well-formed svg', () => {
  const moods = ['happy', 'sad', 'neutral'];
  for (let i = 0; i < 5; i++) { const f = moods.map((m) => P.faceSvg(i, m)); for (const s of f) { assert(/^<svg [^>]*>.*<\/svg>$/.test(s)); assert((s.match(/<svg/g) || []).length === 1); } assert.strictEqual(new Set(f).size, 3, 'the three moods differ'); }
  assert.notStrictEqual(P.faceSvg(0, 'happy'), P.faceSvg(1, 'happy'), 'customers differ'); assert.strictEqual(P.faceSvg(7, 'happy'), P.faceSvg(2, 'happy'), 'faces wrap'); assert.doesNotThrow(() => P.faceSvg(-3, 'sad'));
  const scale = (id) => +P.potSvg(id).match(/scale\(([\d.]+)\)/)[1]; assert(scale('small') < scale('medium') && scale('medium') < scale('large'));
  for (const p of O.POTS) { const s = P.potSvg(p.id); assert(/^<svg /.test(s) && /<\/svg>$/.test(s) && s.includes(`aria-label="${p.id} pot"`)); }
  assert(P.SEG.length >= 6 && new Set(P.SEG).size === P.SEG.length, 'a colour for every card that can be in the pot');
});
done();
