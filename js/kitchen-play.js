// Prompt Kitchen — gameplay. Browser: window.KitchenPlay. Node: require('./kitchen-play.js') (the pure rules).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run     a shift over the engine's state machine: the clock, which ticket is selected, what the world may do (facts / do), the views the world draws (crates, pots,
//                              tickets), the events a tick raises (a ticket arrives, leaves, a dish burns), the score
//   describe(res, ticket)      the debrief Concept Card of one order: "Order: <request>", what happened, why it works that way, the idea
//   debriefPicks(run, n)       up to n orders, worst first: leaks, missed points, cut-offs, customers who left, over-stuffed, rambling, then a lost tip
//   waste(run)                 where the extra tokens went: noise, oversize replies, history carried, unused stock
//   coachHint(run, facts)      the guided first order's hint bubbles (skippable)
// Browser:
//   install(TF)                builds the HUD and the game on kitchen-world.js: E at the Ticket Rail starts a shift, the world's E / 1-3 / Tab work the stations, R reads, H helps, M mutes
//
// THE GAME
//  One shift of 4:15 in the Token Brew kitchen: a skippable 12 s briefing, 13 orders in three phases (Warm-up, Lunch, Rush), a debrief of about 25 s. Tickets arrive about every 19 s, three on
//  the rail at most; the pantry shows the SELECTED ticket's chunks. Grab chunks, trim them (chopping board = summary, sieve = excerpt), load a pot (260 tokens: the prompt AND the reply live in
//  it), set the dial (one line 20, short 50, full 120), cook, serve at the pass. The gas tank is the shift's token allowance. A pot that still holds another customer's order LEAKS it (wipe it
//  first). In the Rush phase a full pot pops its oldest items out. Esc leaves the shift: what was served is kept as partial attempts, with no mastery credit.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-engine.js') : root.KitchenEngine, isNode ? require('./kitchen-content.js') : root.KITCHEN_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.KitchenPlay = api;
})(this, function (E, C, CW) {
  const { RUN } = C, RULES = { COMBO: 3, COACH_RUNS: 3, MSG: 2.6 };
  const SLOT = { spend: 0, signal: 1, chat: 2, clean: 3 };   // the mastery-bar colours: amber, green, cyan, rose
  const KINDS = { bleed: 0, missing: 1, cutoff: 2, left: 3, overstuffed: 4, rambling: 5, tip: 6 };
  const NEED_WORDS = { line: 'one line', short: 'a short reply', full: 'a full reply' };

  // ================================================================ pure
  const view = (it) => it && { uid: it.uid, ticket: it.ticket, label: it.label, role: it.role, version: it.version, tokens: it.tokens[it.version], all: it.tokens, stock: it.stock || false, dish: false };
  function createRun(spec) {
    const st = E.newState(spec), run = { spec, st, t: 0, sel: null, combo: 0, bestCombo: 0, dropped: {}, known: new Set(), logN: 0, ended: false, customers: {} };
    const live = () => st.tickets.filter((x) => x.status === 'live');
    run.live = live;
    const fix = () => { if (!live().some((x) => x.tk.uid === run.sel)) run.sel = live().length ? live()[0].tk.uid : null; };
    // the clock moves by dt seconds; returns what happened since the last call
    run.advance = (dt) => {
      const ev = [], before = st.results.length;
      run.t = Math.min(spec.shift, run.t + dt); E.advance(st, run.t);
      for (const x of st.tickets) if (x.status !== 'queued' && !run.known.has(x.tk.uid)) { run.known.add(x.tk.uid); ev.push({ type: 'spawn', ticket: x.tk }); }
      for (const r of st.results.slice(before)) if (r.left) ev.push({ type: 'left', ticket: st.by[r.ticket], res: r });
      for (const l of st.log.slice(run.logN)) if (l.e === 'burn') ev.push({ type: 'burn', dish: st.dishes[l.dish] });
      run.logN = st.log.length; fix(); return ev;
    };
    // Tab / Shift+Tab / E at the rail: the next live ticket in the rail's order
    run.select = (dir) => {
      const l = live(); if (!l.length) return null;
      const i = l.findIndex((x) => x.tk.uid === run.sel); run.sel = l[((i < 0 ? 0 : i) + (dir < 0 ? -1 : 1) + l.length) % l.length].tk.uid; return run.sel;
    };
    run.selectUid = (uid) => { if (live().some((x) => x.tk.uid === uid)) run.sel = uid; return run.sel; };
    run.ticket = () => (run.sel ? st.by[run.sel] : null);
    run.crates = () => { const tk = run.ticket(); return Array.from({ length: 6 }, (_, i) => { const c = tk && tk.chunks.find((q) => q.slot === i); return c ? { label: c.label, tokens: c.tokens.full } : null; }); };
    run.ticketViews = () => live().map((x) => ({ uid: x.tk.uid, request: x.tk.request, skill: SLOT[C.SKILL_OF[x.tk.concept]] || 0, timer: Math.max(0, (x.expireAt - run.t) / x.tk.ttl) }));
    run.selIndex = () => Math.max(0, live().findIndex((x) => x.tk.uid === run.sel));
    // what the pot gauges show: the residue first (as history), then what was put in; a cooking dish counts down, a waiting dish burns
    run.potViews = () => st.pots.map((p, i) => {
      const s = st.stoves[i], d = s.dish && st.dishes[s.dish], R = RUN.time;
      const fill = (p.residue ? p.residue.items : []).map((x) => ({ tokens: x.tokens[x.version], conv: x.chat, kind: 'residue' })).concat(p.items.map((x) => ({ tokens: x.tokens[x.version], conv: x.chat, kind: x.stock ? 'stock' : 'chunk' })));
      let status = 'idle', timer = null;
      if (d && d.status === 'cooking') { status = 'cooking'; timer = (run.t - d.startT) / R.cooking; } else if (d && d.status === 'ready') { status = 'ready'; timer = 1 - (run.t - d.readyT) / R.burn; } else if (d && (d.status === 'burnt')) { status = 'burnt'; timer = 0; }
      return { fill, capacity: RUN.capacity, dialTokens: RUN.dial[s.dial], dial: s.dial, status, timer };
    });
    run.dishStatus = (i) => { const s = st.stoves[i], d = s.dish && st.dishes[s.dish]; return d ? d.status : null; };
    // ---- the world's questions and orders ----
    run.facts = (c) => ({
      carry: c ? (c.dish ? { dish: true } : { dish: false, role: c.role, version: c.version, canChop: c.version === 'full' && c.all.summary != null && !c.stock, canSieve: c.version === 'full' && c.all.excerpt != null && !c.stock, stable: c.role === 'stable', stock: !!c.stock }) : null,
      pots: st.pots.map((p) => ({ items: p.items.length, residue: !!p.residue, busy: p.busy })), stoves: st.stoves.map((s) => ({ dish: s.dish ? st.dishes[s.dish].status : null })), stockHas: Object.keys(st.stock).length > 0,
    });
    run.stockCount = () => Object.keys(st.stock).length;
    run.do = (a) => {
      const T = run.t, it = a.item && st.items[a.item.uid] ? a.item : null, act = (e) => E.act(st, Object.assign({ t: T }, e));
      let r;
      switch (a.do) {
        case 'grab': {
          const tk = run.ticket(); if (!tk) return { ok: false, reason: 'no ticket', hint: 'No ticket on the rail yet.' };
          const ch = tk.chunks.find((c) => c.slot === a.crate); if (!ch) return { ok: false, reason: 'empty crate', hint: 'That crate is empty.' };
          r = act({ a: 'grab', ticket: tk.uid, chunk: ch.id }); return r.ok ? { ok: true, item: view(st.items[r.item]) } : Object.assign(r, { hint: 'That ticket has left.' });
        }
        case 'pickup': return run.dropped[a.uid] ? { ok: true, item: run.dropped[a.uid] } : { ok: false, reason: 'gone' };
        case 'load': {
          if (!it) return { ok: false, reason: 'nothing carried' };
          r = act({ a: 'load', pot: a.pot, item: it.uid }); if (!r.ok) return Object.assign(r, { hint: 'That pot is busy cooking.' });
          const ejected = (r.ejected || []).filter((x) => x.item).map((x) => { const v = view(st.items[x.item]); run.dropped[v.uid] = v; return { item: v }; });
          return { ok: true, ejected, popped: (r.ejected || []).length };
        }
        case 'chop': case 'sieve': { if (!it) return { ok: false }; r = act({ a: 'make', item: it.uid, how: a.do }); return r.ok ? { ok: true, item: view(st.items[it.uid]) } : Object.assign(r, { hint: 'Nothing more to take out of that.' }); }
        case 'prep': return it ? act({ a: 'prep', item: it.uid }) : { ok: false };
        case 'stock': { const key = Object.keys(st.stock)[0], tk = run.ticket(); if (!key || !tk) return { ok: false, reason: 'no stock' }; r = act({ a: 'stock', key, ticket: tk.uid }); return r.ok ? { ok: true, item: view(st.items[r.item]) } : Object.assign(r, { hint: 'The stock has gone off.' }); }
        case 'dial': return act({ a: 'dial', stove: a.stove, dial: a.dial });
        case 'wipe': return act({ a: 'wipe', pot: a.pot });
        case 'cook': {
          const tk = run.ticket(); if (!tk) return { ok: false, reason: 'no ticket', hint: 'Select a ticket first (Tab).' };
          r = act({ a: 'cook', stove: a.stove, ticket: tk.uid });
          if (!r.ok) r.hint = r.reason === 'lid' ? "Lid won't close: the pot plus that reply is over 260 tokens." : r.reason === 'gas' ? 'Out of gas: the tank cannot pay for this.' : r.reason === 'empty' ? 'The pot is empty.' : 'That stove is busy.';
          return r;
        }
        case 'take': { r = act({ a: 'take', stove: a.stove }); return r.ok ? { ok: true, item: { dish: true, uid: r.dish, ticket: st.dishes[r.dish].ticket } } : Object.assign(r, { hint: r.reason === 'burnt' ? 'It burnt. The tokens are spent, the dish is ruined.' : 'Still cooking.' }); }
        case 'serve': {
          if (!it && !(a.item && a.item.dish)) return { ok: false };
          r = act({ a: 'serve', dish: a.item.uid }); if (!r.ok) return Object.assign(r, { hint: 'That customer has left.' });
          run.combo = r.quality === 1 && !r.bleed ? run.combo + 1 : 0; run.bestCombo = Math.max(run.bestCombo, run.combo); r.ribbon = r.quality === 1 && run.combo > 0 && run.combo % RULES.COMBO === 0; return r;
        }
      }
      return { ok: false, reason: 'unknown' };
    };
    run.dishItem = (it) => (it && it.dish ? Object.assign({ st: 1 }, it) : it);
    run.over = () => run.t >= spec.shift - 1e-9;
    run.score = () => E.scoreShift(st);
    run.phase = () => [...run.known].reduce((m, uid) => Math.max(m, st.by[uid].phase), 1);
    return run;
  }

  // the cards of a debrief: for each order, the Order line, what happened, why it works that way, the idea
  const flagOf = (res) => (res.bleed ? 'bleed' : res.left ? 'left' : res.missing && res.missing.length ? 'missing' : res.flags && res.flags.includes('cutoff') ? 'cutoff' : res.flags && res.flags.includes('overstuffed') ? 'overstuffed' : res.flags && res.flags.includes('rambling') ? 'rambling' : 'tip');
  function describe(res, ticket) {
    const flag = flagOf(res), B = ticket.breaks, par = res.par, spent = res.spent;
    const why = { bleed: B.bleed, missing: B.missing, cutoff: B.cutoff, overstuffed: B.overstuffed, rambling: B.rambling, left: 'A ticket has a timer: trimming and cooking take time too, so pick the cheapest line that still covers the order.', tip: `The line cost ${spent} tokens against a par of ${par}: trimming what the order does not need would have saved some.` }[flag];
    const what = flag === 'left' ? 'The customer left before the order was served.' : `${res.stamp}${res.reply ? ': “' + res.reply + '”' : ''} (${spent} tokens, par ${par}; ${res.coins >= 0 ? '+' : ''}${res.coins} coins)`;
    const breaks = `${what} ${why}`;
    return { lead: 'Order:', text: ticket.request, line: null, what, breaks, breaksLabel: 'What happened and why:', idea: ticket.idea, ideaLabel: 'The idea:', flag, card: { line: ticket.idea, breaks: `“${ticket.request}” ${breaks}`, breaksLabel: 'Order:' } };   // the card opens on the one-line idea, the longer text below
  }
  function debriefPicks(run, n = 4) {
    const rows = [];
    for (const r of run.st.results) {
      const tk = run.st.by[r.ticket], flag = flagOf(r);
      if (flag === 'tip' && !(r.quality > 0 && r.tip < RUN.coins.tip)) continue;
      rows.push({ res: r, ticket: tk, flag, rank: KINDS[flag], lost: flag === 'tip' ? RUN.coins.tip - r.tip : Math.abs(r.coins - RUN.coins.ideal) });
    }
    return rows.sort((a, b) => a.rank - b.rank || b.lost - a.lost || a.res.at - b.res.at).slice(0, n);
  }
  // where the extra tokens went: noise (crates the order did not need), replies longer than needed, history paid for again, stock prepped and never used at a discount
  function waste(run) {
    const out = { noise: 0, oversize: 0, history: 0, stock: 0 };
    for (const d of Object.values(run.st.dishes)) {
      const tk = run.st.by[d.ticket], resHas = !!(d.residue && d.residue.items.length);
      for (const x of d.items) if (x.role === 'noise' || x.role === 'duplicate' || (x.role === 'history' && resHas)) out.noise += x.tokens[x.version];
      out.oversize += Math.max(0, RUN.dial[d.dial] - RUN.dial[tk.reply.need]); out.history += d.residue ? d.residue.tokens : 0;
    }
    for (const s of Object.values(run.st.stock)) if (s.warmUntil == null) out.stock += s.tokens;
    return out;
  }
  function summary(run) {
    const sc = run.score(), idealTokens = sc.idealTokens, w = waste(run);
    const served = run.st.results.filter((r) => !r.left);
    return Object.assign({}, sc, { tank: run.spec.tank, idealTokens, waste: w, timeMs: Math.round(run.t * 1000), bestCombo: run.bestCombo, cleanOrders: served.filter((r) => r.clean).length, orders: run.spec.tickets.length, answered: served.length });
  }
  // the guided first order: one bubble at a time, from what the hands and the pots hold
  function coachHint(run, f) {
    if (!run.spec.tickets[0] || run.st.results.length) return null;
    const pot = f.pots.find((p) => p.items > 0), dish = f.stoves.find((s) => s.dish);
    if (dish && dish.dish !== 'cooking') return 'Tap E at the stove to take the dish, then serve it at the pass window.';
    if (f.stoves.some((s) => s.dish === 'cooking')) return 'It is cooking (the model is thinking). Do not leave it more than 10 seconds once it is ready.';
    if (f.carry && f.carry.dish) return 'Carry the dish to the pass window and tap E.';
    if (pot) return 'Press 1, 2 or 3 near the stove to set the reply length (line, short, full), then HOLD E at the stove to cook.';
    if (f.carry) return 'Tap E at a pot to put it in. Hold E at the chopping board (summary) or the sieve (excerpt) to make it smaller first.';
    return 'Read the ticket, then tap E at a crate to grab a chunk. Take only what the order needs.';
  }

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    const memory = (fixed) => { let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10); return { newRun: () => ({ playerId: id, runIndex: n++, history: { runs: [], concepts: {} } }), onEvent() {} }; };
    let progress = opts.progress || memory(opts.fixed);
    const play = { debrief: null, modal: null, useProgress(p) { progress = p; } }, listeners = {};
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    const STYLE = CW.STYLE, esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let S = null, hud = null;
    const COACH_KEY = 'tokenfall.kitchen.coach'; let coachSeen = 0;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; } catch (e) {}
    const bumpCoach = (n = 1) => { coachSeen += n; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };   // once per play; X skips the coaching for good
    const TIP2 = 'Lunch: wipe a pot before it holds a new customer.';   // the Warm-up has the guided first order, the Rush a banner

    // ---- sound: the bridge's synth and its M mute, plus the kitchen's voices (chopping, sizzle, bell, siren, steam) ----
    const audio = () => (bridge && bridge.audio) || null, muted = () => !!(audio() && audio().muted);
    function sfx(name) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'chop') { a.noise(0.05, 0.12, 900); a.tone(180, 0.08, 'square', 0.05, 0, 90); a.tone(180, 0.08, 'square', 0.05, 0.1, 90); }
      else if (name === 'sieve') { a.noise(0.4, 0.07, 3200); a.tone(1200, 0.12, 'triangle', 0.02, 0.05, 1500); }
      else if (name === 'sizzle') a.noise(0.7, 0.045, 4200);
      else if (name === 'steam') a.noise(0.5, 0.07, 2600);
      else if (name === 'lid') { a.noise(0.35, 0.09, 2200); a.tone(120, 0.2, 'triangle', 0.1, 0, 70); }
      else if (name === 'bell') { a.tone(1568, 0.6, 'sine', 0.07); a.tone(2349, 0.4, 'sine', 0.035, 0.01); }
      else if (name === 'ding') { a.tone(880, 0.12, 'sine', 0.08); a.tone(1320, 0.3, 'sine', 0.08, 0.09); }
      else if (name === 'siren') { a.tone(520, 0.45, 'sawtooth', 0.05, 0, 840); a.tone(840, 0.45, 'sawtooth', 0.05, 0.45, 520); a.noise(0.3, 0.08, 400); }
      else if (name === 'burn') { a.tone(110, 0.5, 'sawtooth', 0.07, 0, 60); a.noise(0.4, 0.07, 800); }
      else if (name === 'combo') { a.tone(659, 0.1, 'triangle', 0.07); a.tone(784, 0.1, 'triangle', 0.07, 0.08); a.tone(1047, 0.25, 'triangle', 0.07, 0.16); }
      else if (name === 'stamp') { a.tone(110, 0.12, 'triangle', 0.14, 0, 60); a.noise(0.05, 0.12, 700); }
      else if (name === 'grab') a.tone(420, 0.06, 'square', 0.025, 0, 560);
      else if (name === 'drop') a.tone(260, 0.07, 'square', 0.03, 0, 160);
      else if (name === 'tick') a.tone(740, 0.06, 'triangle', 0.04);
      else a.play(name);
    }

    // ---- HUD: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .kp-top { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 640px)); padding: 6px 14px 7px; text-align: center; display: none; background: rgba(32, 22, 19,.95); border-color: var(--gold); }
        .kp-top .k { font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .14em; color: var(--gold); } .kp-top .row { font-size: 16px; margin-top: 3px; } .kp-top .clock { font-family: 'Cinzel', serif; font-size: 22px; letter-spacing: .08em; }
        .kp-top b { color: var(--gold); font-weight: 600; } .kp-top .gas { display: inline-block; width: 110px; height: 9px; vertical-align: middle; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.4); } .kp-top .gas i { display: block; height: 100%; background: var(--gold); }
        .kp-top .rule { margin-top: 4px; font-size: 16px; line-height: 1.35; color: var(--hot); } .kp-top .ribbon { margin-top: 3px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .2em; color: var(--gold); }
        .kp-rail { position: absolute; top: 88px; left: 18px; width: 290px; display: none; } .kp-rail .t { margin: 0 0 6px; padding: 6px 10px 8px; font-size: 16px; line-height: 1.35; background: rgba(32, 22, 19,.93); border-left: 6px solid var(--c); }
        .kp-rail .t.sel { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); } .kp-rail .t b { color: var(--c); margin-right: 4px; } .kp-rail .bar { height: 6px; margin-top: 5px; background: rgba(255,255,255,.12); } .kp-rail .bar i { display: block; height: 100%; background: var(--gold); } .kp-rail .bar i.low { background: var(--hot); }
        .kp-rail .none { padding: 6px 10px; font-size: 16px; opacity: .8; background: rgba(32, 22, 19,.9); } .kp-rail small { display: block; margin-top: 4px; font-size: 16px; line-height: 1.35; opacity: .75; letter-spacing: .04em; }
        .kp-carry { position: absolute; left: 18px; bottom: 22px; padding: 6px 12px; font-size: 16px; display: none; } .kp-carry b { color: var(--gold); font-weight: 600; }
        .kp-msg { position: absolute; left: 50%; bottom: 140px; transform: translateX(-50%); max-width: min(640px, calc(100vw - 420px)); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.4; background: rgba(32, 22, 19,.93); }
        .kp-brief { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); width: min(620px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 18px; line-height: 1.4; background: rgba(32, 22, 19,.96); }
        .kp-brief .k { font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .16em; color: var(--gold); } .kp-brief ul { margin: 8px 0 8px; padding-left: 20px; } .kp-brief li { margin: 4px 0; } .kp-brief .go { text-align: right; color: var(--gold); font-size: 14px; }
        .kp-rs { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 32px)); padding: 8px 16px 9px; display: none; font-size: 16px; line-height: 1.4; background: rgba(32, 22, 19,.96); border-color: var(--gold); }
        .kp-rs h5 { margin: 0 0 4px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .14em; color: var(--gold); } .kp-rs .bars div { display: grid; grid-template-columns: 140px 1fr 70px; gap: 8px; align-items: center; margin: 2px 0; font-size: 16px; }
        .kp-rs .bar { height: 10px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .kp-rs .bar i { display: block; height: 100%; } .kp-rs .w { margin-top: 5px; font-size: 16px; line-height: 1.4; opacity: .9; } .kp-rs .go { color: var(--gold); font-size: 14px; margin-top: 4px; }
        .kp-read { position: absolute; right: 18px; top: 150px; width: min(420px, calc(100vw - 36px)); max-height: calc(100vh - 250px); overflow-y: auto; padding: 8px 12px 10px; display: none; font-size: 19px; line-height: 1.4; background: rgba(32, 22, 19,.96); }
        .kp-read h5 { margin: 8px 0 5px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .14em; color: var(--gold); } .kp-read h5:first-child { margin-top: 0; } .kp-read div.c { margin: 0 0 8px; padding-left: 8px; border-left: 3px solid var(--gold); }
        .kp-read small { display: block; font-size: 16px; opacity: .8; } .kp-read .req { margin-bottom: 6px; } .kp-read .pot { font-size: 16px; margin: 3px 0; }
        .kp-help { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 18px; line-height: 1.4; background: rgba(32, 22, 19,.96); pointer-events: auto; }
        .kp-help h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); } .kp-help ul { margin: 0; padding-left: 20px; } .kp-help li { margin: 5px 0; } .kp-help .go { text-align: right; font-size: 14px; margin-top: 8px; color: var(--gold); }
        .kp-top kbd, .kp-rail kbd, .kp-brief kbd, .kp-help kbd, .kp-rs kbd, .kp-msg kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .kp-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s; }
        @media (max-width: 1100px) { .kp-top { left: 330px; transform: none; width: calc(100vw - 640px); min-width: 300px; top: 12px; } .kp-rail { top: 78px; } .kp-read { top: 200px; } }
        .kitchen-on .kp-top, .kitchen-on .kp-rail, .kitchen-on .kp-msg, .kitchen-on .kp-brief, .kitchen-on .kp-rs, .kitchen-on .kp-read, .kitchen-on .kp-carry { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .kitchen-on #chat, .kitchen-on #help { display: none; }   /* the chat log and key hints sit over the kitchen; the kitchen has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      const h = { style, top: mk('kp-top'), rail: mk('kp-rail'), carry: mk('kp-carry'), msg: mk('kp-msg'), brief: mk('kp-brief'), rs: mk('kp-rs'), read: mk('kp-read'), help: mk('kp-help'), keys: {} };
      h.flash = document.createElement('div'); h.flash.className = 'kp-flash'; ui.appendChild(h.flash);
      for (const k of ['top', 'rail', 'brief', 'rs', 'read', 'msg']) h[k].style.setProperty('--hot', STYLE[3].css);
      h.rail.className = 'kp-rail'; return h;
    }
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open), helpOpen = () => !!hud && hud.help.style.display === 'block';
    const clock = (secs) => { const n = Math.max(0, Math.ceil(secs)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
    const flash = (good) => { if (!hud || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const f = hud.flash; f.style.background = good ? 'rgba(217,180,106,.3)' : 'rgba(220,50,50,.32)'; f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 150); };   // gold on a good dish, red on a mistake
    const say = (html, secs = RULES.MSG) => { S.hint = secs; hud.msg.innerHTML = html; hud.msg.style.display = 'block'; };
    const modalOpen = () => !!(play.modal && play.modal.open());

    function drawHud(dt) {
      if (!S || !hud) return;
      const run = S.run, inShift = S.phase === 'play', shown = S.on && !TF.talking && !helpOpen() && !cardOpen();
      hud.top.style.display = shown && inShift ? 'block' : 'none';
      if (inShift) {
        const left = RUN.shift - run.t, ph = RUN.phases[run.phase() - 1], gas = run.st.tank, key = [Math.ceil(left), run.st.coins, gas, ph.n, run.combo >= RULES.COMBO, muted()].join('|');
        if (key !== hud.keys.top) {
          hud.keys.top = key;
          hud.top.innerHTML = `<div class="k">SHIFT · PHASE ${ph.n} · ${ph.name.toUpperCase()}</div><div class="row"><span class="clock">${clock(left)}</span> · Coins <b>${run.st.coins}</b> · Tokens left <span class="gas"><i style="width:${Math.round(100 * gas / run.spec.tank)}%"></i></span> <b>${gas.toLocaleString('en-US')}</b></div>`
            + (ph.policy === 'oldest-first' ? `<div class="rule">${esc(RUN.rushNote)}</div>` : '') + `<div class="ribbon" style="display:${run.combo >= RULES.COMBO ? 'block' : 'none'}">COMBO × ${run.combo}</div>`;
        }
      }
      hud.rail.style.display = shown && inShift ? 'block' : 'none';
      if (inShift) {
        const tv = run.ticketViews(), key = tv.map((t) => t.uid + Math.round(t.timer * 40)).join() + run.sel;
        if (key !== hud.keys.rail) {
          hud.keys.rail = key;
          hud.rail.innerHTML = (tv.length ? tv.map((t) => `<div class="t ${t.uid === run.sel ? 'sel' : ''}" style="--c:${STYLE[t.skill].css}"><b>${STYLE[t.skill].mark}</b>${esc(t.request)}<div class="bar"><i class="${t.timer < 0.25 ? 'low' : ''}" style="width:${Math.round(100 * t.timer)}%"></i></div></div>`).join('') : '<div class="none">No tickets right now.</div>') + '<small><kbd>Tab</kbd> selects a ticket · the pantry shows its chunks</small>';
        }
      }
      const carry = world.state.carry;
      hud.carry.style.display = shown && inShift && carry ? 'block' : 'none';
      if (carry) hud.carry.innerHTML = carry.dish ? 'Carrying <b>a dish</b>: serve it at the pass' : `Carrying <b>${esc(carry.label)}</b> · ${carry.version} · ${carry.tokens} tokens`;
      if (S.hint > 0) { S.hint -= dt; hud.msg.style.display = S.hint <= 0 || !shown ? 'none' : 'block'; }
      else if (shown && inShift && S.coach) { const h = coachHint(run, run.facts(carry)); if (h) { hud.msg.innerHTML = esc(h) + ' <kbd>X</kbd> skips hints'; hud.msg.style.display = 'block'; } else hud.msg.style.display = 'none'; }
      else hud.msg.style.display = 'none';
      hud.read.style.display = shown && S.read && inShift ? 'block' : 'none';
      if (S.read && inShift) {
        const tk = run.ticket(), pots = run.potViews(), key = [run.sel, JSON.stringify(pots.map((p) => p.fill)), pots.map((p) => p.dial).join()].join('|');
        if (key !== hud.keys.read) {
          hud.keys.read = key;
          const potHtml = pots.map((p, i) => `<div class="pot"><b>Pot ${i + 1}</b> · ${p.dial} (${p.dialTokens}) · ${p.fill.reduce((n, f) => n + f.tokens, 0)} / ${p.capacity}${p.fill.length ? '<small>' + p.fill.map((f) => (f.kind === 'residue' ? 'history ' : '') + f.tokens).join(' + ') + '</small>' : ''}</div>`).join('');
          hud.read.innerHTML = `<h5>SELECTED ORDER</h5>` + (tk ? `<div class="req">${esc(tk.request)}<small>Reply: ${NEED_WORDS[tk.reply.need]} · ${esc(tk.reply.need)} = ${RUN.dial[tk.reply.need]} tokens</small></div><h5>THE PANTRY</h5>` + tk.chunks.slice().sort((a, b) => a.slot - b.slot).map((c) => `<div class="c"><small>Crate ${c.slot + 1} · ${c.tokens.full} tokens${c.tokens.summary != null ? ' · can be summarised' : ''}${c.tokens.excerpt != null ? ' · can be sieved' : ''}</small><b>${esc(c.label)}</b>: ${esc(c.preview)}</div>`).join('') : '<div class="c">No ticket selected.</div>') + `<h5>THE POTS</h5>${potHtml}`;
        }
      }
    }
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.help.innerHTML = `<h3>PROMPT KITCHEN</h3><ul><li>The <b>pot</b> is the context window: what you put in <b>and</b> the reply share its 260 tokens. Put in only what the order needs.</li><li><kbd>E</kbd> tap: grab a chunk, put it in a pot, take a dish, serve at the pass, drop. <kbd>E</kbd> hold: chop (summary), sieve (excerpt), wipe a pot, cook, prep stock.</li><li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> near a stove sets the reply: one line (20), short (50), full (120). <kbd>Tab</kbd> selects a ticket. <kbd>R</kbd> reads the order in large text. <kbd>M</kbd> mutes.</li><li>A pot that still holds another customer's order <b>leaks</b> it: wipe it, or use the other pot. A chat that is long is cheaper to start fresh with a summary.</li><li><kbd>Esc</kbd> leaves the shift. What you served is kept, with no mastery credit.</li></ul><div class="go"><kbd>H</kbd> or <kbd>E</kbd> closes</div>`;
      hud.help.style.display = on ? 'block' : 'none';
    }

    // ---- flow ----
    const afterTalk = (fn) => { S.waitTalk = fn; };
    function startShift() {
      const r = progress.newRun(), spec = E.composeShift(E.seedFor(r.playerId, r.runIndex), r.history), run = createRun(spec);
      S = { on: true, run, runInfo: r, phase: 'intro', briefT: 0, hint: 0, waitTalk: null, read: false, seen: coachSeen, coach: coachSeen < RULES.COACH_RUNS, queue: [], rsScore: null, lastMs: 0, sizzleT: 0, phaseSeen: 1, summary: null, customerOf: {}, nextCustomer: 0 };
      emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed }); bumpCoach(); emit('shift', { variants: [...new Set(spec.tickets.map((t) => t.variantId))] });
      document.getElementById('ui').classList.add('kitchen-on'); hud.keys = {}; world.busy(true);
      TF.banner('Token Brew Kitchen', 'Short-staffed: 13 orders, one tank of gas');
      TF.talk('Ticket Rail', S.seen === 0
        ? ["Kitchen's short-staffed. Thirteen orders, one tank of gas.", 'The pot is the model\'s context window: your chunks AND its reply share 260 tokens. Pack only what each order needs, and trim the rest at the board.', 'Cook it, serve it, and never reuse a pot that still holds another customer. Esc leaves. H is help.']
        : ['Back on the pass? Same rules: pack light, leave room for the reply, wipe between customers.']);
      afterTalk(showBrief);
    }
    function showBrief() {
      S.phase = 'brief'; S.briefT = RUN.brief;
      hud.brief.innerHTML = `<div class="k">TOKEN BREW KITCHEN · THE SHIFT</div><ul><li>Thirteen orders in three phases: <b>Warm-up</b>, <b>Lunch</b>, <b>Rush</b>. A new ticket about every 19 seconds.</li>${S.seen >= 2 ? '' : `<li>The tank is your token allowance: <b>${RUN.tank.toLocaleString('en-US')}</b>. Spend less than the order's par and earn a tip.</li><li>Press <kbd>Tab</kbd> to pick a ticket. The pantry shows its chunks.</li>`}</ul><div class="go"><kbd>E</kbd> starts the shift</div>`;
      hud.brief.style.display = 'block';
    }
    function startPlay() {
      if (!S || S.phase !== 'brief') return;
      hud.brief.style.display = 'none'; S.phase = 'play'; S.lastMs = performance.now(); S.run.advance(0); world.setPlaying(true); sfx('bell');
      world.setCrates(S.run.crates(), false); syncWorld(true);
    }

    // ---- the world's events ----
    let potKey = '', crateKey = '', ticketKey = '';
    function syncWorld(force) {
      const run = S.run;
      const ck = run.sel + '|' + run.ticket()?.uid; if (force || ck !== crateKey) { if (crateKey && !force) world.setCrates(run.crates(), true); crateKey = ck; }
      const tv = run.ticketViews(), tk = tv.map((t) => t.uid + ':' + Math.round(t.timer * 20)).join() + run.sel; if (force || tk !== ticketKey) { ticketKey = tk; world.setTickets(tv, run.selIndex()); }
      const pv = run.potViews(), pk = JSON.stringify(pv.map((p) => [p.fill.map((f) => f.tokens + f.kind), p.dial, p.status, p.timer == null ? null : Math.round(p.timer * 20)])); if (force || pk !== potKey) { potKey = pk; world.setPots(pv); }
      for (let i = 0; i < 2; i++) { const d = run.dishStatus(i); world.setStoveDish(i, d === 'ready' || d === 'cooking' || d === 'burnt' ? d : null); world.steam(i, d === 'cooking'); }
    }
    const customerFor = (tk) => { if (S.customerOf[tk.uid] == null) S.customerOf[tk.uid] = S.nextCustomer++ % 5; return S.customerOf[tk.uid]; };
    function onTick(ev) {
      for (const e of ev) {
        if (e.type === 'spawn') { sfx('tick'); customerFor(e.ticket); if (e.ticket.phase > S.phaseSeen) { S.phaseSeen = e.ticket.phase; if (e.ticket.phase === 2 && S.coach) say(TIP2, 4); if (e.ticket.phase === 3) { TF.banner('Rule change', RUN.rushNote.replace('Rule change: ', '')); TF.sys(RUN.rushNote); sfx('bell'); } } }
        else if (e.type === 'left') { sfx('burn'); const c = customerFor(e.ticket); flash(false); world.stamp(c, 'Customer left', 'bad'); setTimeout(() => S && world.bubble(c, null), 3200); say('A customer left. <b>-5</b>', 2); }
        else if (e.type === 'burn') { sfx('burn'); flash(false); say('<b>BURNT.</b> A dish waited more than 10 seconds: ruined, the tokens are spent.', 3); }
      }
    }
    function onTap(ev) {
      if (!S || S.phase !== 'play') return;
      const a = ev.a, r = ev.r || {};
      if (a.hint) return;
      if (a.do === 'grab' && r.ok) sfx('grab'); else if (a.do === 'drop') sfx('drop'); else if (a.do === 'load' && r.ok) { sfx('drop'); if (r.popped) { sfx('lid'); say(`<b>${r.popped} item${r.popped === 1 ? '' : 's'} popped out</b> of the full pot: the oldest go first.`, 3); } }
      else if (a.do === 'take' && r.ok) sfx('grab'); else if (a.do === 'serve' && r.ok) onServe(r);
      else if (a.do === 'cycle') { S.run.select(1); sfx('tick'); }
      else if (r.ok === false && /lid|gas/.test(r.reason || '')) { sfx('lid'); world.steam(a.stove || 0, true); setTimeout(() => S && world.steam(a.stove || 0, false), 700); }
    }
    function onWork(ev) {
      if (!S || S.phase !== 'play') return;
      const k = ev.h.kind, r = ev.r || {};
      if (k === 'chop') sfx('chop'); else if (k === 'sieve') sfx('sieve'); else if (k === 'prep') { sfx('drop'); if (r.ok) say('<b>Stock prepped.</b> Drop it into an empty pot FIRST: the next use inside 60 seconds costs 10%.', 3.4); }
      else if (k === 'wipe') { sfx('steam'); say('Pot wiped: a fresh chat.', 1.6); }
      else if (k === 'cook') { if (r.ok) { sfx('sizzle'); S.sizzleT = 0.8; } else { sfx('lid'); say(`<b>${esc(r.hint || r.reason)}</b>`, 2.6); world.steam(ev.h.stove, true); setTimeout(() => S && world.steam(ev.h.stove, false), 700); } }
    }
    function onServe(r) {
      const tk = S.run.st.by[r.ticket], c = customerFor(tk);
      world.stamp(c, `${r.stamp}: ${r.reply}`, r.quality === 1 ? 'ok' : r.quality > 0 ? 'meh' : 'bad'); setTimeout(() => S && world.bubble(c, null), 4200);
      sfx('stamp');
      if (r.bleed) { flash(false); sfx('siren'); world.siren(2.4); say(`<b>${esc(r.stamp)}</b> -5 coins`, 3); }
      else if (r.quality === 1) { flash(true); sfx('ding'); world.burst(0, -1.4); say(`<b>${esc(r.stamp)}</b> +${r.coins} coins`, 2); if (r.ribbon) { sfx('combo'); say(`<b style="font-size:28px">COMBO × ${S.run.combo}</b> +${r.coins} coins`, 2.2); } }
      else { if (!r.quality) flash(false); say(`<b>${esc(r.stamp)}</b> ${r.coins ? '+' + r.coins + ' coins' : ''}`, 2.6); }
    }

    // ---- the debrief: a few lines at the rail, the receipt, then up to 4 Concept Cards (E to continue) ----
    function endShift() {
      const run = S.run; run.advance(0); E.advance(run.st, RUN.shift); S.phase = 'debrief'; world.setPlaying(false); world.carry(null); world.floor.clear();
      S.rsScore = summary(run); S.queue = debriefPicks(run, 4);
      for (let i = 0; i < 2; i++) world.steam(i, false);
      emitAnswers(true); hud.keys = {};
      const s = S.rsScore, w = s.waste, mx = Math.max(s.tank, s.spent, s.idealTokens, 1), bar = (n, color) => `<span class="bar"><i style="width:${Math.round(100 * n / mx)}%;background:${color}"></i></span>`;
      hud.rs.innerHTML = `<h5>THE SHIFT · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)} · ${s.coins} of ${s.ideal} coins</h5><div class="bars"><div><span>${s.spent > s.idealTokens ? STYLE[3].mark : STYLE[1].mark} Tokens spent</span>${bar(s.spent, s.spent > s.idealTokens ? STYLE[3].css : STYLE[1].css)}<span>${s.spent}</span></div><div><span>${STYLE[1].mark} Best line</span>${bar(s.idealTokens, STYLE[1].css)}<span>${s.idealTokens}</span></div><div><span>${STYLE[0].mark} Token tank</span>${bar(s.tank, STYLE[0].css)}<span>${s.tank}</span></div></div>`
        + `<div class="w">Where the extra went: ${w.noise} in noise and copies · ${w.oversize} in longer replies than needed · ${w.history} in history carried · ${w.stock} in stock never used. ${s.spills} leak${s.spills === 1 ? '' : 's'}.</div><div class="go"><kbd>E</kbd> ${S.queue.length ? 'Concept cards' : 'Next'} · <kbd>S</kbd> skip ▼</div>`;
      hud.rs.style.display = 'block'; hud.top.style.display = hud.rail.style.display = hud.read.style.display = hud.carry.style.display = 'none'; sfx('bell');
      TF.sys(`Shift over: ${s.coins} coins, ${s.spills} leak${s.spills === 1 ? '' : 's'}, ${s.spent} tokens against an ideal ${s.idealTokens}.`);
      TF.talk('Ticket Rail', [`${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)} ${s.stars === 3 ? 'Light packing, room for every reply, no leaks.' : s.stars === 2 ? 'A good line. A few tokens went where they did not need to.' : s.stars === 1 ? 'You got through the rush. The tank got through you.' : 'The tickets won this one. Tomorrow is another shift.'}`, `${s.spent} tokens spent against an ideal ${s.idealTokens}. ${w.noise + w.oversize + w.history ? 'Most of the extra: ' + (w.noise >= w.oversize && w.noise >= w.history ? 'filler and copies in the pot.' : w.oversize >= w.history ? 'replies longer than the order needed.' : 'chat history paid for again.') : 'Almost none wasted.'}`]);
      afterTalk(() => {});
    }
    function emitAnswers(credit) {
      const run = S.run, seen = new Set();
      for (const r of run.st.results) {
        seen.add(r.ticket); const tk = run.st.by[r.ticket];
        emit('answer', { credit, conceptId: tk.concept, variantId: tk.variantId, kind: flagOf(r), clean: !!r.clean, ok: r.quality === 1 && !r.bleed });
      }
      if (credit) for (const tk of run.spec.tickets) if (!seen.has(tk.uid)) emit('answer', { credit, conceptId: tk.concept, variantId: tk.variantId, kind: 'left', clean: false, ok: false });
    }
    function nextCard() {
      if (!S || S.phase !== 'debrief') return;
      const row = S.queue.shift();
      if (!row) { hud.rs.style.display = 'none'; finish(); return; }
      bridge.card.show(Object.assign({}, describe(row.res, row.ticket).card, { hint: S.queue.length ? 'Next card · S skips' : 'Continue' }));
    }
    function closeCard() {
      if (!S) return;
      if (S.phase === 'brief') { startPlay(); return; }
      if (S.phase !== 'debrief') return;
      if (cardOpen()) bridge.card.hide();
      nextCard();
    }
    function finish() {
      const run = S.run, sum = summary(run);
      Object.assign(sum, { seed: run.spec.seed, playerId: S.runInfo.playerId, runIndex: S.runInfo.runIndex, why: 'done', clean: Object.fromEntries(Object.entries(sum.byConcept).map(([id, c]) => [id, c.variants])), variants: [...new Set(run.spec.tickets.map((t) => t.variantId))] });
      S.phase = 'done'; S.summary = sum; sfx('bell'); TF.banner('Shift over', `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`);
      emit('finish', sum);
      if (play.debrief) play.debrief(sum);
      else { TF.talk('Ticket Rail', [`${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${sum.coins} coins, ${sum.spills} leak${sum.spills === 1 ? '' : 's'}.`]); afterTalk(() => leave()); }
    }
    play.closeDebrief = () => { if (!S || S.phase !== 'done') return; leave(); };
    function cleanup() { world.setPlaying(false); world.carry(null); world.floor.clear(); world.setCrates(null); world.setTickets([], 0); for (let i = 0; i < 5; i++) world.bubble(i, null); for (let i = 0; i < 2; i++) { world.steam(i, false); world.setStoveDish(i, null); } world.setPots([0, 1].map(() => ({ fill: [], capacity: RUN.capacity, dialTokens: RUN.dial.short, dial: 'short', status: 'idle' }))); }
    function leave() {
      if (!S) return;
      if (S.run && S.phase !== 'done') {   // what was served is kept as partial attempts: no mastery, no misses
        if (S.phase === 'play') emitAnswers(false);
        emit('abandon', { served: S.run.st.results.filter((r) => !r.left).length, spills: S.run.st.results.filter((r) => r.bleed).length, timeMs: Math.round(S.run.t * 1000) });
      }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); S.on = false;
      if (modalOpen()) play.modal.hide && play.modal.hide();
      S = null; cleanup(); world.busy(false);
      if (hud) for (const k of ['top', 'rail', 'carry', 'msg', 'brief', 'rs', 'read', 'help']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('kitchen-on'); potKey = crateKey = ticketKey = '';
    }

    // ---- input ----
    function onKey(e) {
      if (!S || !S.on) return false;
      const a = audio(); if (a && a.init) a.init();
      if (modalOpen()) { if (['KeyE', 'Escape', 'Enter'].includes(e.code) && !e.repeat) play.modal.close(); else if (play.modal.key) play.modal.key(e); return true; }
      if ((e.code === 'Escape' || (e.code === 'KeyS' && S.phase === 'debrief' && !helpOpen() && !TF.talking)) && !e.repeat) {
        if (helpOpen()) showHelp(false);
        else if (S.phase === 'debrief') { if (cardOpen()) bridge.card.hide(); S.queue = []; hud.rs.style.display = 'none'; finish(); }   // the shift is over and already credited: Esc skips to the summary
        else leave();
        return true;
      }
      if (e.code === 'KeyM' && !e.repeat) { a && a.toggle(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { showHelp(!helpOpen()); return true; }
      if (S.phase === 'brief' && e.code === 'KeyE' && !e.repeat) { if (helpOpen()) showHelp(false); else if (!TF.talking) startPlay(); return true; }
      if ((S.phase === 'debrief') && e.code === 'KeyE' && !e.repeat) { if (!TF.talking) closeCard(); return true; }
      if (S.phase === 'play') {
        if (e.code === 'KeyR' && !e.repeat) { S.read = !S.read; return true; }
        if (e.code === 'KeyX' && !e.repeat) { S.coach = false; bumpCoach(3); return true; }
        if (e.code === 'KeyE' && helpOpen() && !e.repeat) { showHelp(false); return true; }
      }
      return false;   // the world takes E, 1-3, Tab and Esc during a shift; the hero keeps walking
    }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      const nowMs = performance.now(), real = S.lastMs ? Math.min(0.5, (nowMs - S.lastMs) / 1000) : 0; S.lastMs = nowMs;
      const paused = S.phase !== 'play' || TF.talking || cardOpen() || helpOpen() || document.hidden || modalOpen();
      if (S.phase === 'brief' && !TF.talking && !helpOpen() && !document.hidden) { S.briefT -= real; if (S.briefT <= 0) startPlay(); }
      if (S.phase === 'play') {
        world.setPlaying(!paused);
        if (!paused) {
          onTick(S.run.advance(real)); syncWorld(false);
          if (S.sizzleT > 0) S.sizzleT -= real; else if (S.run.st.stoves.some((s) => s.dish && S.run.st.dishes[s.dish].status === 'cooking')) { S.sizzleT = 0.9; sfx('sizzle'); }
          if (S.run.over()) { endShift(); return; }
        }
      }
      drawHud(real);
    }

    // ---- entry ----
    play.open = () => {
      hud = hud || makeHud();
      if (S) return false;
      if (TF.talking || TF.traveling) return false;
      startShift(); return true;
    };
    play.register = function () {
      world.open = play.open;
      world.attach({
        facts: () => (S && S.run ? S.run.facts(world.state.carry) : { carry: null, pots: [{}, {}], stoves: [{}, {}], stockHas: false }),
        do: (a) => (S && S.run && S.phase === 'play' ? S.run.do(a) : { ok: false, reason: 'no shift' }),
        dropped: (it) => { if (S && S.run) S.run.dropped[it.uid] = it; }, stockCount: () => (S && S.run ? S.run.stockCount() : 0),
      });
      world.on('cycle', (dir) => { if (S && S.phase === 'play') { S.run.select(dir); sfx('tick'); syncWorld(false); } });
      world.on('tap', onTap); world.on('work', onWork); world.on('exit', () => leave());
      world.on('dial', () => { if (S && S.phase === 'play') sfx('tick'); });
      TF.life.push((t, dt) => frame(t, dt));
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on && onKey(e)) || (prev ? prev(e) : false);
      TF.on('enter', (a, b) => { if (a === 'kitchen' && b !== 'kitchen' && S) leave(); });
    };
    Object.assign(play, { leave, closeCard, onKey });
    Object.defineProperties(play, { state: { get: () => S }, hud: { get: () => hud } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.kitchen, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.kitchenPlay = play;
    return play;
  }
  return { RULES, SLOT, KINDS, view, createRun, describe, debriefPicks, waste, summary, coachHint, flagOf, create, install };
});
