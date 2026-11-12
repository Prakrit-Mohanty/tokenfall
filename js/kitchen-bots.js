// Prompt Kitchen — the test bots (Node only; the browser never loads this file). One executor plays a shift through the engine's own actions with realistic timings
// (walk 4.2 units/s, pick-up and drop 0.3 s, chop 1.2 s, sieve 1.2 s, wipe 1.5 s, cook hold 2 s then 4 s cooking, 10 s burn, tank 2,400); the planners only differ in WHAT they put in the pots.
//   run(spec, planner) -> { score, state, actions }       actions = the log that playActions() replays to the same result
const E = require('./kitchen-engine.js');
const C = require('./kitchen-content.js');
const BG = require('./bridge-generator.js');
const { RUN } = C, R = RUN.time, L = E.LAYOUT;

const straight = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) * L.detour;
let dist = straight;   // setDist(f) swaps in real walking paths (kitchen-world-tests.js); setDist() restores the straight line
const potAt = (i) => L.pots[i], knobAt = (i) => L.knobs[i];

// ---------------------------------------------------------------- planners: (ticket, spec, state) -> { pick: { chunkId: version }, dial, pot, stock, wipe, noWipe }
//   pot: 'same' (the pot that holds this chat's residue) | 'clean' (an empty pot, wiped if need be) | 'free' (any idle pot; wiped only if it holds another chat) | 'least' (the idle pot with the least residue, never wiped)
const essentialsFull = (t) => Object.fromEntries(t.chunks.filter((c) => c.role === 'essential' || c.role === 'stable').map((c) => [c.id, 'full']));
const greedy = (order) => (t) => {
  const cs = t.chunks.slice().sort(order), pick = {}, cap = RUN.capacity - RUN.dial.short;
  let fill = 0;
  for (const c of cs) if (fill + c.tokens.full <= cap) { pick[c.id] = 'full'; fill += c.tokens.full; }
  return { pick, dial: 'short', pot: 'free', wipe: true };
};
const PLANNERS = {
  ideal: (t, spec) => { const p = spec.plans[t.uid]; return { pick: p.pick, dial: p.dial, pot: p.pot === 'wipe' ? 'clean' : p.pot, stock: p.stock || null, wipe: p.pot !== 'same' }; },
  allIn: greedy((a, b) => a.slot - b.slot),
  instructionOnly: () => ({ pick: { ask: 'full' }, dial: 'short', pot: 'free', wipe: true }),
  smallestFirst: greedy((a, b) => a.tokens.full - b.tokens.full),
  largestFirst: greedy((a, b) => b.tokens.full - a.tokens.full),
  neverWipe: (t, spec) => { const p = spec.plans[t.uid]; return { pick: p.pick, dial: p.dial, pot: 'least', wipe: false, noWipe: true }; },
  alwaysWipeNoSummary: (t, spec) => { const p = spec.plans[t.uid], pick = Object.assign({}, p.pick); for (const c of t.chunks) if (c.role === 'history') delete pick[c.id]; return { pick, dial: p.dial, pot: 'clean', wipe: true }; },
  // the stricter reading of "always wipe, no summary": it wipes before every ticket and never compresses anything (no chopping, no sieving), so history and big documents go in whole
  alwaysWipeFullSize: (t) => ({ pick: Object.fromEntries(t.chunks.filter((c) => c.role === 'essential' || c.role === 'stable' || c.role === 'history').map((c) => [c.id, 'full'])), dial: t.reply.need, pot: 'clean', wipe: true }),
  random: (t, spec, st, rng) => {
    const pick = {};
    for (const c of t.chunks) if (rng() < 0.5) { const vs = ['full', 'summary', 'excerpt'].filter((v) => c.tokens[v] != null); pick[c.id] = vs[(rng() * vs.length) | 0]; }
    return { pick, dial: ['line', 'short', 'full'][(rng() * 3) | 0], pot: 'free', wipe: rng() < 0.5 };
  },
};

// ---------------------------------------------------------------- the executor
function run(spec, plannerName, seed) {
  const plan = PLANNERS[plannerName], rng = BG.mulberry32(BG.hash32('bot:' + plannerName + ':' + spec.seed + ':' + (seed || 0)));
  const st = E.newState(spec), actions = [];
  let T = 0, pos = { x: L.start.x, z: L.start.z }, carry = null;
  const act = (a) => { const e = Object.assign({ t: T }, a); actions.push(e); return E.act(st, e); };
  const walk = (to) => { T += dist(pos, to) / R.walk; pos = { x: to.x, z: to.z }; };
  const jobs = new Map();   // ticket uid -> { plan, pot, started, done, failed }

  function servingDish() { return Object.values(st.dishes).find((d) => (d.status === 'ready' || (d.status === 'cooking' && T >= d.readyT))); }
  function serve(d) {
    walk(knobAt(d.stove)); E.advance(st, T); const r = act({ a: 'take', stove: d.stove }); T += R.pickup;
    if (!r.ok) return;
    // the ideal bot clears the pot while it stands there, unless the follow-up ticket of this chat is planned to continue in it
    if (plannerName === 'ideal') { const keep = spec.tickets.some((u) => u.chainOf === d.ticket && spec.plans[u.uid].cont); if (!keep) { walk(potAt(st.stoves[d.stove].pot)); T += R.wipe; act({ a: 'wipe', pot: st.stoves[d.stove].pot }); } }
    walk(L.window); act({ a: 'serve', dish: r.dish }); T += R.pickup;
  }
  const potFree = (i) => !st.pots[i].busy;
  // pick the pot for a new job: returns { pot, wipe } or null (wait)
  function choosePot(t, p) {
    const idle = [0, 1].filter(potFree);
    if (!idle.length) return null;
    const resOf = (i) => st.pots[i].residue, same = idle.find((i) => resOf(i) && resOf(i).items.some((x) => x.chat === t.chat));
    if (p.pot === 'same') return same != null ? { pot: same, wipe: false } : null;
    if (p.pot === 'least') return { pot: idle.slice().sort((a, b) => (resOf(a) ? resOf(a).tokens : 0) - (resOf(b) ? resOf(b).tokens : 0))[0], wipe: false };
    const empty = idle.find((i) => !resOf(i) && !st.pots[i].items.length);
    if (p.pot === 'clean' || p.pot === 'free') {
      if (empty != null && !(p.wipe && p.pot === 'clean' && false)) return { pot: empty, wipe: false };
      const i = idle[0]; return { pot: i, wipe: true };
    }
    return { pot: idle[0], wipe: false };
  }
  function trip(t, c, ver, potI, fromStock) {
    // one crate: fetch, process if the plan wants a smaller version, carry to the pot
    if (fromStock) { walk(L.stockShelf); const r = act({ a: 'stock', key: fromStock, ticket: t.uid }); T += R.pickup; if (!r.ok) return false; walk(potAt(potI)); act({ a: 'load', pot: potI, item: r.item }); T += R.pickup; return true; }
    walk(L.crates[c.slot]); const g = act({ a: 'grab', ticket: t.uid, chunk: c.id }); T += R.pickup; if (!g.ok) return false;
    if (ver !== 'full') { const how = ver === 'summary' ? 'chop' : 'sieve', stn = ver === 'summary' ? L.chop : L.sieve; walk(stn); T += how === 'chop' ? R.chop : R.sieve; const m = act({ a: 'make', item: g.item, how }); if (!m.ok) return false; }
    walk(potAt(potI)); act({ a: 'load', pot: potI, item: g.item }); T += R.pickup; return true;
  }
  // a whole job as a list of steps; each returns false to abandon the ticket
  function startJob(tx) {
    const t = tx.tk, p = plan(t, spec, st, rng), where = choosePot(t, p);
    if (!where) return null;
    const j = { t, p, pot: where.pot, steps: [], idx: 0 };
    if (where.wipe && !p.noWipe) j.steps.push(() => { walk(potAt(where.pot)); T += R.wipe; return act({ a: 'wipe', pot: where.pot }).ok; });
    const ids = Object.keys(p.pick), chunks = ids.map((id) => t.chunks.find((c) => c.id === id)).filter(Boolean).sort((a, b) => (b.role === 'stable') - (a.role === 'stable') || a.slot - b.slot);
    for (const c of chunks) {
      if (c.role === 'stable' && p.stock === 'prep') {
        j.steps.push(() => { walk(L.crates[c.slot]); const g = act({ a: 'grab', ticket: t.uid, chunk: c.id }); T += R.pickup; if (!g.ok) return false; walk(L.stockShelf); T += R.stockPrep; const r = act({ a: 'prep', item: g.item }); return r.ok && (j.key = r.key, true); });
        j.steps.push(() => trip(t, c, 'full', where.pot, j.key));
      } else if (c.role === 'stable' && p.stock === 'use') {
        j.steps.push(() => { const key = Object.keys(st.stock).find((k) => st.stock[k].chunk === c.id); return key ? trip(t, c, 'full', where.pot, key) : trip(t, c, 'full', where.pot); });
      } else j.steps.push(() => trip(t, c, p.pick[c.id], where.pot));
    }
    j.steps.push(() => {
      walk(knobAt(where.pot)); act({ a: 'dial', stove: where.pot, dial: p.dial }); T += R.cook;
      const r = act({ a: 'cook', stove: where.pot, ticket: t.uid }); return r.ok;
    });
    return j;
  }
  function abandon(j) {
    // a refused or failed job leaves its chunks in the pot; a bot that wipes cleans up, the never-wipe bot does not
    if (!j.p.noWipe) { walk(potAt(j.pot)); T += R.wipe; act({ a: 'wipe', pot: j.pot }); }
  }

  let job = null, guard = 0;
  while (T < RUN.shift && guard++ < 5000) {
    E.advance(st, T);
    const d = servingDish();
    if (d && !carry) { serve(d); continue; }
    if (job) {
      const ok = job.steps[job.idx]();
      E.advance(st, T);
      if (!ok) { abandon(job); jobs.set(job.t.uid, 'failed'); job = null; continue; }
      job.idx++; if (job.idx >= job.steps.length) { jobs.set(job.t.uid, 'cooked'); job = null; }
      continue;
    }
    const rail = st.tickets.filter((x) => x.status === 'live' && !jobs.has(x.tk.uid)).sort((a, b) => a.expireAt - b.expireAt);
    let started = false;
    for (const tx of rail) { const j = startJob(tx); if (j) { job = j; jobs.set(tx.tk.uid, 'running'); started = true; break; } }
    if (started) continue;
    // nothing to do: wait for the next spawn or the next dish
    const nexts = [];
    const head = st.tickets.find((x) => x.status === 'queued'); if (head) nexts.push(Math.max(head.tk.spawn, T + 0.05));
    for (const dd of Object.values(st.dishes)) if (dd.status === 'cooking') nexts.push(dd.readyT);
    T = Math.max(T + 0.05, Math.min(...nexts, RUN.shift));
  }
  E.advance(st, RUN.shift);
  return { score: E.scoreShift(st), state: st, actions };
}

const setDist = (f) => { dist = f || straight; };
// ---------------------------------------------------------------- a scripted player for the rules facade (kitchen-play.js createRun): the same run.do calls the world makes
const assert = require('assert');
const waitFor = (run, f, max = 200) => { let n = 0; while (!f() && n++ < max) run.advance(0.5); return f(); };
const potWith = (run, chat) => run.st.pots.findIndex((p) => p.residue && p.residue.items.some((x) => x.chat === chat));
// serves one ticket through run.do, following the engine's ideal line (or a variation of it: o.pick, o.dial, o.pot, o.keep)
function serve(run, tk, o = {}) {
  const plan = run.spec.plans[tk.uid], st = run.st, log = [];
  assert(waitFor(run, () => st.tickets.find((x) => x.tk.uid === tk.uid).status === 'live', 600), 'the ticket spawns'); run.selectUid(tk.uid);
  let pot = plan.cont ? potWith(run, tk.chat) : st.pots.findIndex((p) => !p.busy && !p.residue && !p.items.length);
  if (pot < 0) { pot = st.pots.findIndex((p) => !p.busy); run.do({ do: 'wipe', pot }); }
  if (o.pot != null) pot = o.pot;
  const pick = o.pick || plan.pick, ids = Object.keys(pick).sort((a, b) => (tk.chunks.find((c) => c.id === b).role === 'stable') - (tk.chunks.find((c) => c.id === a).role === 'stable'));
  for (const id of ids) {
    const ch = tk.chunks.find((c) => c.id === id);
    if (ch.role === 'stable' && plan.stock === 'prep') { let g = run.do({ do: 'grab', crate: ch.slot }); assert(g.ok, 'grab'); assert(run.do({ do: 'prep', item: g.item }).ok); run.advance(0.3); const s = run.do({ do: 'stock' }); assert(s.ok, 'stock'); assert(run.do({ do: 'load', pot, item: s.item }).ok); continue; }
    if (ch.role === 'stable' && plan.stock === 'use') { const s = run.do({ do: 'stock' }); if (s.ok) { assert(run.do({ do: 'load', pot, item: s.item }).ok); continue; } }
    let g = run.do({ do: 'grab', crate: ch.slot }); assert(g.ok, 'grab ' + id); let item = g.item;
    if (pick[id] !== 'full') { const m = run.do({ do: pick[id] === 'summary' ? 'chop' : 'sieve', item }); assert(m.ok, 'make ' + pick[id] + ' ' + id); item = m.item; }
    const l = run.do({ do: 'load', pot, item }); assert(l.ok, 'load ' + id); run.advance(0.4);
  }
  run.do({ do: 'dial', stove: pot, dial: o.dial || plan.dial });
  const c = run.do({ do: 'cook', stove: pot }); log.push(c);
  if (!c.ok) return { cook: c };
  waitFor(run, () => run.dishStatus(pot) === 'ready'); const t = run.do({ do: 'take', stove: pot }); assert(t.ok, 'take');
  const r = run.do({ do: 'serve', item: t.item });
  if (!o.keep) { const follow = run.spec.tickets.some((u) => u.chainOf === tk.uid && run.spec.plans[u.uid].cont); if (!follow) run.do({ do: 'wipe', pot }); }
  return { cook: c, serve: r, pot };
}
const playAll = (run, o) => { for (const tk of run.spec.tickets) { const r = serve(run, tk, o && o(tk)); assert(r.serve, 'served ' + tk.variantId); } };


module.exports = { run, PLANNERS, setDist, waitFor, potWith, serve, playAll };
