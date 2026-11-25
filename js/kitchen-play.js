// Token Brew Kitchen — the game. Browser: window.KitchenPlay. Node: require('./kitchen-play.js') (the pure rules and the pictures).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run   a shift over the orders of kitchen-orders.js: which order and which step it is, what may be tapped, the one sentence to show, what should glow, the pot's
//                            contents, the serve and its stars
//   faceSvg(i, mood), potSvg(id)   the pictures: a customer's round face (happy, sad or neutral) and a small, medium or large pot
// Browser:
//   install(TF)   builds the screen on kitchen-world.js: the shift starts by itself when the player comes into the kitchen; everything is click or tap
//
// THE GAME (stage 3 of 4: the whole shift, the timer and the results)
//  5 orders, 3 taps each. Each shows ONE step at a time with a glowing highlight and a bobbing arrow on what to tap next: (1) READ THE ORDER, tap "Got it"; (2) PICK THE POT, small, medium or
//  large model, whichever fits the job; (3) ADD ONLY WHAT IS NEEDED: each card goes in the pot (the job needs it) or in the bin (junk). The pot has ONE fill line: stay under it. Then SERVE:
//  the customer reacts with a happy or sad face and one plain sentence, and the order earns 1-3 stars (the right pot, the right cards and no junk, under the line).
//  Order 5 has a gentle timer (75 s from Got it; running out serves what is in the pot). One instruction banner on top shows one short sentence for the current step; "?" repeats it. Order 1 is the tutorial: only the right pot can be tapped and only needed cards appear, so
//  nothing can go wrong. Keys are extras: 1 2 3 pick a pot, Space / Enter go on (Got it, Serve, next order), H repeats the instruction, Esc leaves.
//  After order 5: the results, the total stars and a 3-bullet recap (right-size the model, trim the context, check before serving) with how the player did at each.
//  The same events as ever tell the rest of the game how it went: run, shift, answer (one per served order), finish, abandon (progress: kitchen-progress.js; the TOKEN-1 meter: game-events.js).
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-orders.js') : root.KITCHEN_ORDERS);
  if (isNode) module.exports = api;
  else root.KitchenPlay = api;
})(this, function (O) {
  const STEPS = ['read', 'pot', 'add', 'react'];   // 'add' ends with Serve; after the last order the run is 'done'
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ================================================================ pure: the rules
  function createRun(spec) {
    const run = { spec, i: 0, step: 'read', pot: null, result: null, cards: [], log: [], done: false, timer: null };
    const order = () => spec.orders[run.i];
    const load = () => { run.cards = order().cards.map((c) => ({ id: c.id, state: 'idle' })); run.pot = null; run.result = null; run.timer = null; };
    load();
    run.order = order;
    run.total = spec.orders.length;
    const card = (id) => order().cards.find((c) => c.id === id), state = (id) => run.cards.find((c) => c.id === id);
    run.gotIt = () => { if (run.step !== 'read') return false; run.step = 'pot'; if (order().ramp.timer) run.timer = { total: O.TIMER.seconds, left: O.TIMER.seconds }; return true; };   // the timer starts when the order is read
    // the tutorial lets only the fitting pot be tapped; from order 2 on all three can
    run.canPick = (potId) => run.step === 'pot' && O.POTS.some((p) => p.id === potId) && (!order().ramp.onlyRightPot || potId === order().need);
    run.pickPot = (potId) => {
      if (run.step !== 'pot') return { ok: false, reason: 'step' };
      if (!run.canPick(potId)) return { ok: false, reason: 'locked', nudge: 'That pot is locked for now. Tap the glowing one.' };
      run.pot = O.judgePot(order(), potId); run.step = 'add';   // the verdict waits for Serve
      return Object.assign({ ok: true }, run.pot);
    };
    // ---- the cards: each goes in the pot, in the bin, or back (idle). The tutorial has nothing to bin ----
    run.cardViews = () => run.cards.map((s) => { const c = card(s.id); return { id: c.id, label: c.label, w: c.w, icon: c.icon, state: s.state }; });   // never says which is junk
    run.place = (id, dest) => {
      if (run.step !== 'add' || !state(id)) return { ok: false, reason: 'step' };
      if (!['pot', 'bin', 'idle'].includes(dest)) return { ok: false, reason: 'dest' };
      if (dest === 'bin' && order().ramp.onlyRightPot) return { ok: false, reason: 'locked', nudge: 'Everything here is needed. Tap Pot.' };
      state(id).state = dest; return { ok: true, id, dest };
    };
    run.level = () => run.cards.reduce((n, s) => n + (s.state === 'pot' ? card(s.id).w : 0), 0);   // blocks in the pot
    run.line = () => order().line;
    run.over = () => run.level() > run.line();
    run.binned = () => run.cards.filter((s) => s.state === 'bin').length;
    run.sorted = () => run.step === 'add' && run.cards.every((s) => s.state !== 'idle');
    const inPot = () => run.cards.filter((s) => s.state === 'pot').map((s) => s.id);
    const settle = (r) => { run.result = r; run.step = 'react'; run.timer = null; run.log.push({ order: order().no, task: order().task, concept: order().concept, ask: order().ask, icon: order().icon, total: r.total, stars: r.stars, kind: r.kind }); };
    run.serve = () => {
      if (run.step !== 'add') return { ok: false, reason: 'step' };
      if (!run.sorted()) return { ok: false, reason: 'unsorted', nudge: 'Sort every card first: Pot or Bin.' };
      const r = O.judgeServe(order(), run.pot.potId, inPot()); settle(r);
      return Object.assign({ ok: true }, r);
    };
    // ---- the gentle timer (order 5): time only runs while the pot or the cards are being worked on; at zero the customer gets what is in the pot ----
    const timed = () => !!run.timer && (run.step === 'pot' || run.step === 'add');
    run.timeUp = () => {
      if (!timed()) return null;
      const r = O.judgeServe(order(), run.pot ? run.pot.potId : null, inPot(), true); settle(r);
      return Object.assign({ ok: true, late: true }, r);
    };
    run.tick = (dt) => { if (!timed()) return null; run.timer.left = Math.max(0, run.timer.left - dt); return run.timer.left <= 0 ? run.timeUp() : null; };
    run.timeFrac = () => (run.timer ? run.timer.left / run.timer.total : null);
    run.next = () => {
      if (run.step !== 'react') return false;
      if (run.i + 1 >= run.total) { run.done = true; run.step = 'done'; return true; }
      run.i++; run.step = 'read'; load(); return true;
    };
    // ---- the ONE sentence for this step, at most about a dozen words ----
    run.banner = () => {
      const o = order(), r = o.ramp;
      if (run.step === 'read') return 'Read the order, then tap Got it.';
      if (run.step === 'pot') return r.onlyRightPot ? `Tap the glowing ${o.need} pot. It fits this job.` : 'Pick the pot that fits the job.';
      if (run.step === 'add') return run.sorted() ? 'Check the pot, then tap Serve.' : r.onlyRightPot ? 'Tap Pot to add each card.' : r.junk ? 'Pot for what the job needs. Bin for the rest.' : 'Add what the job needs. Stay under the line.';
      if (run.step === 'react') return run.i + 1 >= run.total ? 'Tap See how it went.' : 'Tap Next order to go on.';   // what the customer says is on the card
      return 'Shift done!';
    };
    // what should glow and bob: Got it, the one pot the tutorial wants (later orders: the whole row), the next card in the tutorial (later: the cards), then Serve
    run.target = () => {
      const r = order().ramp;
      if (run.step === 'read') return { kind: 'gotit' };
      if (run.step === 'pot') return r.onlyRightPot ? { kind: 'pot', id: order().need } : { kind: 'pots' };
      if (run.step === 'add') {
        if (run.sorted()) return { kind: 'serve' };
        const first = run.cards.find((s) => s.state === 'idle');
        return r.onlyRightPot ? { kind: 'card', id: first.id } : { kind: 'cards' };
      }
      return null;
    };
    run.mood = () => (run.step === 'react' ? (run.result.happy ? 'happy' : 'sad') : 'neutral');
    run.stepNo = () => Math.max(1, Math.min(3, STEPS.indexOf(run.step) + 1));   // the dots: read, pot, add (Serve ends it)
    // the three ideas of the recap, each with how many of the orders went right for it: the pot (size), only the right cards (trim), under the line (check)
    run.recap = () => O.CONCEPTS.map((c) => { const key = { size: 'pot', trim: 'clean', check: 'line' }[c.id]; return { id: c.id, title: c.title, line: c.recap, got: run.log.filter((x) => x.stars[key]).length, of: run.log.length }; });
    run.cleanVariants = () => run.log.reduce((m, x) => { if (x.total === 3) (m[x.concept] = m[x.concept] || []).push(x.task); return m; }, {});   // the perfect orders, by lesson: what progress masters
    run.stars = () => run.log.reduce((n, x) => n + x.total, 0);
    run.maxStars = () => 3 * run.total;
    run.shiftStars = () => { const f = run.stars() / run.maxStars(); return f >= 0.8 ? 3 : f >= 0.5 ? 2 : f > 0.2 ? 1 : 0; };   // the whole shift, for the rest of the game
    return run;
  }

  // ================================================================ pure: the pictures
  const SKIN = ['#ffe0c2', '#f1c27d', '#c68642', '#8d5524', '#ffdbac'], HAIR = ['#3a2f3c', '#6b3f2a', '#c4544f', '#e6c36e', '#4d3b4c'], SHIRT = ['#d98590', '#aecab2', '#e6c36e', '#b7a6cc', '#8fb4cc'];
  function faceSvg(i, mood) {
    const n = ((i % 5) + 5) % 5, skin = SKIN[n], hair = HAIR[(n * 2 + 1) % 5], shirt = SHIRT[n];
    const mouth = mood === 'happy' ? 'M27 51 Q40 67 53 51' : mood === 'sad' ? 'M29 62 Q40 50 51 62' : 'M31 57 L49 57';
    const brows = mood === 'sad' ? '<path d="M22 30 L34 34 M58 30 L46 34" fill="none" stroke="#3a2f3c" stroke-width="3" stroke-linecap="round"/>' : '';
    const eyes = mood === 'happy' ? '<path d="M25 41 Q30 34 35 41 M45 41 Q50 34 55 41" fill="none" stroke="#3a2f3c" stroke-width="3.4" stroke-linecap="round"/>' : '<circle cx="30" cy="40" r="3.8" fill="#3a2f3c"/><circle cx="50" cy="40" r="3.8" fill="#3a2f3c"/>';
    return `<svg class="kq-face" viewBox="0 0 80 96" role="img" aria-label="${mood} customer"><ellipse cx="40" cy="86" rx="28" ry="22" fill="${shirt}"/><circle cx="40" cy="42" r="29" fill="${skin}"/>`
      + `<path d="M11 38 Q12 9 40 9 Q68 9 69 38 Q59 22 40 22 Q21 22 11 38Z" fill="${hair}"/>${eyes}${brows}<circle cx="21" cy="52" r="4.6" fill="#d98590" opacity=".55"/><circle cx="59" cy="52" r="4.6" fill="#d98590" opacity=".55"/>`
      + `<path d="${mouth}" fill="none" stroke="#3a2f3c" stroke-width="3.2" stroke-linecap="round"/></svg>`;
  }
  const POT_COL = { small: '#4f9d94', medium: '#d98a4e', large: '#c4544f' }, POT_SCALE = { small: 0.6, medium: 0.8, large: 1 };
  function potSvg(id) {
    const c = POT_COL[id], k = POT_SCALE[id];
    return `<svg class="kq-potsvg" viewBox="0 0 160 136" role="img" aria-label="${id} pot"><g transform="translate(80 128) scale(${k}) translate(-80 -128)"><ellipse cx="80" cy="127" rx="64" ry="7" fill="rgba(0,0,0,.2)"/>`
      + `<path d="M26 60 H134 V96 Q134 122 108 122 H52 Q26 122 26 96Z" fill="${c}"/><path d="M26 60 H36 V102 Q38 112 50 117 Q26 112 26 96Z" fill="rgba(255,255,255,.22)"/>`
      + `<path d="M28 70 Q6 70 8 88 Q10 98 28 96 M132 70 Q154 70 152 88 Q150 98 132 96" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`
      + `<rect x="20" y="50" width="120" height="14" rx="7" fill="#f3e6cf"/><path d="M42 50 Q80 6 118 50Z" fill="#f3e6cf"/><path d="M42 50 Q80 6 118 50" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="3"/><circle cx="80" cy="20" r="7" fill="#dca63a"/></g></svg>`;
  }
  const SEG = ['#e6c36e', '#aecab2', '#b7a6cc', '#8fb4cc', '#d98590', '#d98a4e'];   // the colours of the cards in the pot, in the order they were dropped in

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    const memory = (fixed) => { let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10); return { newRun: () => ({ playerId: id, runIndex: n++, history: { runs: [], concepts: {} } }), onEvent() {} }; };
    let progress = opts.progress || memory(opts.fixed);
    const play = { debrief: null, modal: null, useProgress(p) { progress = p; } }, listeners = {};
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    let S = null, hud = null, ghud = null, intro = null;   // ghud: the shared side panel, intro: the shared intro card (js/game)
    const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- sound: the bridge's synth and its M mute ----
    const audio = () => (bridge && bridge.audio) || null;
    function sfx(name) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'tick') a.tone(740, 0.06, 'triangle', 0.04);
      else if (name === 'ding') { a.tone(880, 0.12, 'sine', 0.08); a.tone(1320, 0.3, 'sine', 0.08, 0.09); }
      else if (name === 'oops') a.tone(300, 0.22, 'triangle', 0.06, 0, 200);
      else if (name === 'drop') a.tone(260, 0.07, 'square', 0.03, 0, 160);
      else if (name === 'bell') { a.tone(1568, 0.6, 'sine', 0.07); a.tone(2349, 0.4, 'sine', 0.035, 0.01); }
    }

    // ---- the screen: the lobby's .panel look, Baloo 2 for labels, Poppins for text; big, simple, one thing at a time ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        html body .kq { pointer-events: auto; position: absolute; font-family: var(--font-primary); color: var(--ink); background: rgba(32, 22, 19, .97); border-color: var(--gold); animation: kq-in .35s ease both; }
        .kq-top { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: min(880px, calc(100vw - 32px)); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }   /* the banner and the task chip stack, so they never overlap whatever their heights */
        html body .kq-top .kq { position: relative; animation: none; }
        .kq-banner { width: 100%; padding: 10px 16px 12px; display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: center; }
        .kq-prog { font-family: var(--font-secondary); font-size: 18px; letter-spacing: .06em; color: var(--gold); text-align: center; line-height: 1.2; }
        .kq-dots { display: flex; gap: 7px; justify-content: center; margin-top: 5px; } .kq-dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--gold); } .kq-dots i.on { background: var(--gold); } .kq-dots i.now { box-shadow: 0 0 0 3px rgba(217, 180, 106, .45); }
        .kq-clock { grid-column: 1 / -1; display: none; align-items: center; gap: 10px; margin-top: 2px; font-family: var(--font-secondary); font-size: 20px; } .kq-clock div { flex: 1; height: 12px; border-radius: 6px; background: rgba(255, 255, 255, .15); overflow: hidden; } .kq-clock i { display: block; height: 100%; background: var(--gold); transition: width .3s linear; } .kq-clock.low i { background: #ff9a6a; } .kq-clock span { min-width: 3.2em; text-align: right; }
        .kq-say { font-family: var(--font-secondary); font-size: 28px; line-height: 1.2; text-align: center; } .kq-say.flash { animation: kq-flash .8s ease; }
        html body .kq .kq-help { font: 700 24px var(--font-secondary); width: 44px; height: 44px; padding: 0; border-radius: 50%; color: #3B2A14; background: var(--gold); border: 0; box-shadow: none; cursor: pointer; }
        .kq-ticket { top: calc(var(--kq-top, 100px) + clamp(14px, (100vh - 560px) * 0.25, 90px)); left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - var(--kq-top, 100px) - 126px); overflow-y: auto; padding: 18px 22px 22px; text-align: center; display: none; }
        .kq-who { display: flex; align-items: center; gap: 12px; justify-content: center; font-family: var(--font-secondary); font-size: 24px; color: var(--gold); } .kq-who .kq-face { width: 64px; height: 76px; }
        .kq-job { display: flex; align-items: center; gap: 16px; justify-content: center; margin: 12px 0 4px; text-align: left; } .kq-icon { font-size: 64px; line-height: 1; } .kq-ask { font-family: var(--font-secondary); font-size: 34px; line-height: 1.15; } .kq-detail { font-size: 20px; opacity: .85; margin-top: 4px; }
        html body .kq .kq-btn { position: relative; font: 700 26px var(--font-secondary); color: #3B2A14; background: var(--gold); border: 0; border-radius: 14px; padding: 10px 36px; box-shadow: 0 3px 0 rgba(0, 0, 0, .35); cursor: pointer; margin-top: 16px; }
        html body .kq .kq-btn:hover { background: #ecc77f; }
        .kq-ticket .kq-btn { margin-top: 48px; }
        html body .kq .kq-btn.quiet { background: transparent; color: var(--ink); border: 2px solid var(--gold); font-size: 22px; padding: 8px 22px; box-shadow: none; }
        html body .kq .kq-btn.quiet:hover { background: rgba(217, 180, 106, .2); }
        .kq-chip { display: none; align-items: center; gap: 10px; padding: 6px 16px; font-family: var(--font-secondary); font-size: 22px; }
        .kq-chip span { font-size: 30px; }
        .kq-shelf { bottom: 90px; left: 50%; transform: translateX(-50%); width: min(960px, calc(100vw - 32px)); padding: 26px 16px 12px; display: none; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        html body .kq-shelf .kq-pot { position: relative; font-family: var(--font-secondary); color: var(--ink); background: rgba(255, 255, 255, .07); border: 3px solid transparent; border-radius: 18px; box-shadow: none; padding: 6px 8px 10px; cursor: pointer; text-align: center; transition: transform .15s, background .15s; }
        html body .kq-shelf .kq-pot:hover:not(.locked) { transform: translateY(-4px); background: rgba(217, 180, 106, .2); }
        .kq-potsvg { width: 100%; height: 130px; } .kq-pn { font-size: 24px; line-height: 1.1; } .kq-pm { font-size: 18px; opacity: .9; } .kq-pb { font-family: var(--font-primary); font-size: 16px; opacity: .8; }
        html body .kq-shelf .kq-pot.locked { opacity: .35; cursor: not-allowed; filter: grayscale(.7); }
        html body .kq-shelf .kq-pot.kq-glow { border-color: var(--gold); background: rgba(217, 180, 106, .14); animation: kq-glow 1.1s ease-in-out infinite; }
        .kq-add { bottom: 90px; left: 50%; transform: translateX(-50%); width: min(940px, calc(100vw - 32px)); max-height: calc(100vh - var(--kq-top, 150px) - 104px); overflow-y: auto; padding: 22px 16px 14px; display: none; grid-template-columns: 1fr auto; gap: 18px; }
        .kq-tray { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-content: start; }
        .kq-card { position: relative; border: 3px solid transparent; border-radius: 16px; background: rgba(255, 255, 255, .07); padding: 8px 6px 8px; text-align: center; font-family: var(--font-secondary); transition: opacity .2s, border-color .2s; }
        .kq-card.glow, .kq-card.cards { border-color: var(--gold); } .kq-card.glow { background: rgba(217, 180, 106, .14); animation: kq-glow 1.1s ease-in-out infinite; }
        .kq-card.pot { border-color: #6ee07a; background: rgba(110, 224, 122, .1); } .kq-card.bin { opacity: .5; border-color: rgba(255, 255, 255, .25); }
        .kq-ci { font-size: 38px; line-height: 1.1; } .kq-cl { font-size: 20px; line-height: 1.15; min-height: 46px; display: flex; align-items: center; justify-content: center; } .kq-cw { font-size: 18px; letter-spacing: 2px; color: var(--gold); line-height: 1; }
        .kq-cb { display: flex; gap: 6px; justify-content: center; margin-top: 6px; } .kq-card.glow .kq-cb { margin-top: 38px; } .kq-cs { font-family: var(--font-primary); font-size: 16px; align-self: center; opacity: .9; }
        html body .kq .kq-cb button { position: relative; font: 700 19px var(--font-secondary); color: #3B2A14; background: var(--gold); border: 0; border-radius: 10px; padding: 5px 14px; box-shadow: 0 2px 0 rgba(0, 0, 0, .35); cursor: pointer; }
        html body .kq .kq-cb button[data-place=bin] { background: #e9bcb4; } html body .kq .kq-cb button[data-place=idle] { background: transparent; color: var(--ink); border: 2px solid var(--gold); box-shadow: none; padding: 3px 12px; font-size: 17px; }
        html body .kq .kq-cb button:hover { filter: brightness(1.12); }
        .kq-side { display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-width: 250px; }
        .kq-potname { font-family: var(--font-secondary); font-size: 20px; text-align: center; line-height: 1.1; } .kq-potname .kq-potsvg { height: 62px; display: block; margin: 0 auto 2px; }
        .kq-gb { display: flex; gap: 22px; align-items: flex-end; margin-top: 4px; }
        .kq-gwrap { position: relative; padding-right: 74px; } .kq-gauge { position: relative; width: 112px; height: 220px; border: 4px solid var(--pc, var(--gold)); border-top-color: rgba(255, 255, 255, .25); border-radius: 0 0 26px 26px; background: rgba(255, 255, 255, .06); }
        .kq-fill { position: absolute; inset: 0; display: flex; flex-direction: column-reverse; border-radius: 0 0 22px 22px; overflow: hidden; } .kq-fill i { display: block; border-top: 2px solid rgba(32, 22, 19, .55); transition: height .25s; }
        .kq-fl { position: absolute; left: -14px; right: -14px; border-top: 4px dashed var(--gold); pointer-events: none; } .kq-fl span { position: absolute; left: 100%; bottom: -3px; margin-left: 6px; font: 700 16px var(--font-secondary); color: var(--gold); white-space: nowrap; }
        .kq-gauge.over { border-color: #ff7a7a; animation: kq-shake .4s ease 2; } .kq-over { position: absolute; left: 60px; top: 14px; transform: translateX(-50%); font: 700 22px var(--font-secondary); color: #ff7a7a; white-space: nowrap; display: none; }
        .kq-gauge.over + .kq-over { display: block; }
        .kq-bin { text-align: center; font-family: var(--font-secondary); } .kq-bi { display: block; font-size: 54px; line-height: 1; } .kq-bn { font-size: 20px; opacity: .9; } .kq-bin.tossed .kq-bi { animation: kq-toss .4s ease; }
        .kq-add .kq-serve { margin-top: 10px; font-size: 30px; padding: 12px 48px; } .kq-serve.off { opacity: .5; }
        .kq-arrow { position: absolute; left: 50%; top: -44px; transform: translateX(-50%); font-size: 40px; line-height: 1; color: var(--gold); text-shadow: 0 2px 0 rgba(0, 0, 0, .55); pointer-events: none; animation: kq-bob .8s ease-in-out infinite; display: none; }
        .kq-arrow.row { top: -34px; } .kq-cb .kq-arrow { font-size: 30px; top: -36px; display: block; }
        .kq-react { top: calc(var(--kq-top, 100px) + 14px); left: 50%; transform: translateX(-50%); width: min(600px, calc(100vw - 32px)); max-height: calc(100vh - var(--kq-top, 100px) - 126px); overflow-y: auto; padding: 12px 22px 16px; text-align: center; display: none; }
        .kq-react .kq-face { width: 92px; height: 110px; } .kq-react .kq-line { font-family: var(--font-secondary); font-size: 28px; line-height: 1.25; margin-top: 6px; }
        .kq-stars { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 10px; } .kq-stars span { font-family: var(--font-secondary); font-size: 20px; padding: 3px 12px; border-radius: 999px; border: 2px solid rgba(255, 255, 255, .25); opacity: .65; } .kq-stars span.ok { border-color: var(--gold); color: var(--gold); opacity: 1; }
        .kq-end { top: calc(var(--kq-top, 100px) + 14px); left: 50%; transform: translateX(-50%); width: min(620px, calc(100vw - 32px)); max-height: calc(100vh - var(--kq-top, 100px) - 126px); overflow-y: auto; padding: 16px 22px 20px; text-align: center; display: none; }
        .kq-big { font-size: 52px; color: var(--gold); letter-spacing: 8px; line-height: 1.15; } .kq-sum { font-family: var(--font-secondary); font-size: 26px; margin-bottom: 6px; }
        .kq-end h3 { margin: 12px 0 4px; font: 700 18px var(--font-secondary); letter-spacing: .12em; color: var(--gold); text-transform: uppercase; }
        .kq-recap { list-style: none; margin: 0; padding: 0; text-align: left; } .kq-recap li { display: grid; grid-template-columns: 236px 1fr auto; gap: 4px 12px; align-items: center; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, .12); font-size: 19px; line-height: 1.3; } .kq-recap li > b { font-family: var(--font-secondary); font-size: 22px; color: var(--gold); } .kq-recap li > span { font-size: 18px; opacity: .92; }
        .kq-recap em { font-style: normal; font-family: var(--font-secondary); font-size: 20px; padding: 2px 12px; border-radius: 999px; border: 2px solid var(--gold); color: var(--gold); white-space: nowrap; } .kq-recap em.all { background: var(--gold); color: #3B2A14; } .kq-recap small { grid-column: 2 / -1; font-size: 16px; color: #6ee07a; }
        .kq-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
        .kq-back { left: 16px; bottom: 16px; padding: 6px 8px; } html body .kq-back .kq-btn { margin: 0; font-size: 22px; padding: 8px 18px; } .kq-back kbd { font: inherit; opacity: .8; margin-left: 8px; font-size: 16px; }
        @keyframes kq-in { from { opacity: 0; margin-top: 10px; } to { opacity: 1; margin-top: 0; } }
        @keyframes kq-bob { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(10px); } }
        @keyframes kq-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(217, 180, 106, .75); } 50% { box-shadow: 0 0 0 10px rgba(217, 180, 106, 0); } }
        @keyframes kq-flash { 0%, 100% { color: var(--ink); } 30% { color: var(--gold); } }
        @keyframes kq-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes kq-toss { 0% { transform: scale(1); } 40% { transform: scale(1.25) rotate(-10deg); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .kq, .kq-arrow, .kq-glow, .kq-card.glow, .kq-say.flash, .kq-gauge.over, .kq-bin.tossed .kq-bi { animation: none; } .kq-glow, .kq-card.glow { box-shadow: 0 0 0 5px rgba(217, 180, 106, .8); } .kq-arrow { transform: translateX(-50%); } }
        @media (max-width: 860px) { .kq-add { grid-template-columns: 1fr; } .kq-side { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 12px; } .kq-gauge { height: 150px; } }
        @media (max-width: 760px) { .kq-recap li { grid-template-columns: 1fr auto; } .kq-recap li > span { grid-column: 1 / -1; } .kq-banner { grid-template-columns: 1fr auto; } .kq-prog { grid-column: 1 / -1; } .kq-say { font-size: 22px; } .kq-ask { font-size: 26px; } .kq-potsvg { height: 90px; } .kq-pn { font-size: 20px; } .kq-pb { display: none; } .kq-tray { grid-template-columns: repeat(2, 1fr); } }
        #ui.big > .kq-top { zoom: 1.2; } #ui.big > .kq-add { max-height: calc((100vh - var(--kq-top, 150px) - 124px) / 1.2); } #ui.big > .kq-end, #ui.big > .kq-react, #ui.big > .kq-ticket { max-height: calc((100vh - 126px) / 1.2 - var(--kq-top, 100px) - 14px); }   /* zoomed panels: their lengths are scaled by 1.2 too */
        #ui.big > .kq-top, #ui.big > .kq-ticket, #ui.big > .kq-shelf, #ui.big > .kq-add, #ui.big > .kq-react, #ui.big > .kq-end { max-width: calc((100vw - 32px) / 1.2); }
        @media (max-height: 760px) { .kq-ci { font-size: 28px; } .kq-cl { font-size: 17px; min-height: 38px; } .kq-cw { font-size: 15px; } .kq-card { padding: 5px 4px; } html body .kq .kq-cb button { font-size: 16px; padding: 3px 12px; } .kq-cb { margin-top: 4px; } .kq-card.glow .kq-cb { margin-top: 32px; }
          .kq-gauge { height: 150px; } .kq-potname { font-size: 17px; } .kq-potname .kq-potsvg { height: 44px; } .kq-bi { font-size: 40px; } .kq-bn { font-size: 17px; } .kq-add { padding: 14px 12px 10px; } .kq-add .kq-serve { font-size: 24px; padding: 8px 36px; } .kq-side { min-width: 230px; }
          .kq-say { font-size: 24px; } .kq-ask { font-size: 28px; } .kq-icon { font-size: 48px; } .kq-potsvg { height: 100px; } .kq-react .kq-face { width: 76px; height: 92px; } .kq-react .kq-line { font-size: 24px; } .kq-big { font-size: 42px; } .kq-recap li { padding: 5px 0; } }
        .kq button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
        body.kitchen-on .kq-clock { display: none !important; }   /* the shared side panel shows the time */
        body.kitchen-on .dl-btn, body.kitchen-on #chat, body.kitchen-on #help, body.kitchen-on #party, body.kitchen-on #loc, body.kitchen-on #banner, body.kitchen-on .t1-hud, body.kitchen-on .t1-toast, body.kitchen-on .t1-say { display: none !important; }   /* one thing at a time: the lobby's chat, key hints, party list, place name, arrival banner and TOKEN-1's badge stay out of the kitchen */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls, html) => { const e = document.createElement('div'); e.className = 'panel kq ' + cls; if (html) e.innerHTML = html; e.style.display = 'none'; ui.appendChild(e); return e; };
      const h = { style, ui, keys: {} };
      h.top = document.createElement('div'); h.top.className = 'kq-top'; ui.appendChild(h.top);
      h.banner = mk('kq-banner', '<div class="kq-prog"><div class="kq-no"></div><div class="kq-dots"><i></i><i></i><i></i></div></div><div class="kq-say" role="status" aria-live="polite"></div><button class="kq-help" type="button" aria-label="Repeat the instruction" title="Repeat the instruction (H)">?</button><div class="kq-clock" role="timer" aria-label="Time left"><div><i></i></div><span></span></div>');
      h.ticket = mk('kq-ticket', '<div class="kq-who"></div><div class="kq-job"><div class="kq-icon"></div><div><div class="kq-ask"></div><div class="kq-detail"></div></div></div><button class="kq-btn" type="button" data-act="gotit">Got it<div class="kq-arrow">▼</div></button>');
      h.chip = mk('kq-chip');
      h.top.append(h.banner, h.chip);
      h.shelf = mk('kq-shelf', '<div class="kq-arrow row">▼</div>' + O.POTS.map((p) => `<button class="kq-pot" type="button" data-pot="${p.id}" aria-label="${esc(p.name)}: ${esc(p.model)}, ${esc(p.blurb)}">${potSvg(p.id)}<div class="kq-pn">${esc(p.name)}</div><div class="kq-pm">${esc(p.model)}</div><div class="kq-pb">${esc(p.blurb)}</div><div class="kq-arrow">▼</div></button>`).join(''));
      h.add = mk('kq-add', '<div class="kq-tray"></div><div class="kq-side"><div class="kq-potname"></div><div class="kq-gb"><div class="kq-gwrap"><div class="kq-gauge"><div class="kq-fill"></div><div class="kq-fl"><span>FILL LINE</span></div></div><div class="kq-over">Overflow!</div></div><div class="kq-bin"><span class="kq-bi">🗑️</span><span class="kq-bn"></span></div></div><button class="kq-btn kq-serve" type="button" data-act="serve">Serve<div class="kq-arrow">▼</div></button></div>');
      h.react = mk('kq-react', '<div class="kq-reface"></div><div class="kq-line" role="status"></div><div class="kq-stars"></div><button class="kq-btn" type="button" data-act="next"></button>');
      h.end = mk('kq-end');
      h.back = mk('kq-back', '<button class="kq-btn quiet" type="button" data-act="back">← Back to the cafe<kbd>Esc</kbd></button>');
      h.clock = h.banner.querySelector('.kq-clock'); h.clockBar = h.clock.querySelector('i'); h.clockText = h.clock.querySelector('span');
      h.say = h.banner.querySelector('.kq-say'); h.no = h.banner.querySelector('.kq-no'); h.dots = [...h.banner.querySelectorAll('.kq-dots i')];
      h.pots = Object.fromEntries([...h.shelf.querySelectorAll('.kq-pot')].map((b) => [b.dataset.pot, b])); h.rowArrow = h.shelf.querySelector('.kq-arrow.row'); h.gotArrow = h.ticket.querySelector('.kq-arrow');
      h.tray = h.add.querySelector('.kq-tray'); h.gauge = h.add.querySelector('.kq-gauge'); h.fill = h.add.querySelector('.kq-fill'); h.fl = h.add.querySelector('.kq-fl'); h.bin = h.add.querySelector('.kq-bin'); h.serve = h.add.querySelector('.kq-serve'); h.serveArrow = h.serve.querySelector('.kq-arrow');
      h.banner.querySelector('.kq-help').addEventListener('click', (e) => { e.currentTarget.blur(); repeat(); });
      h.ticket.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); if (b.dataset.act === 'gotit') gotIt(); } });
      h.shelf.addEventListener('click', (e) => { const b = e.target.closest('.kq-pot'); if (b) { b.blur(); pick(b.dataset.pot); } });
      h.add.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); if (b.dataset.act === 'serve') serve(); else if (b.dataset.place) place(b.dataset.card, b.dataset.place); });
      h.react.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); next(); } });
      h.end.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); if (b.dataset.act === 'export') exportProgress(); else restart(); });
      h.back.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); exit(); } });
      return h;
    }
    const all = () => ['banner', 'ticket', 'chip', 'shelf', 'add', 'react', 'end', 'back'];
    function layout() { if (hud) hud.ui.style.setProperty('--kq-top', Math.ceil(hud.top.getBoundingClientRect().bottom) + 'px'); }   // how far down the banner stack reaches: the panels below keep clear of it
    const blocks = (n) => '▮'.repeat(n);

    // ---- drawing the current step ----
    function render() {
      if (!S || !hud) return;
      const run = S.run, step = run.step;
      drawGhud();
      if (run.done) { renderEnd(); return; }
      const o = run.order(), tgt = run.target();
      hud.banner.style.display = 'grid'; hud.back.style.display = 'block';
      hud.no.textContent = `Order ${o.no} of ${run.total}`;
      hud.dots.forEach((d, i) => { d.className = i < run.stepNo() ? 'on' : ''; if (i === run.stepNo() - 1) d.classList.add('now'); });
      hud.say.textContent = run.banner();
      const key = o.id + ':' + S.round;
      if (hud.keys.order !== key) {   // a new order: its ticket
        hud.keys.order = key;
        hud.ticket.querySelector('.kq-who').innerHTML = faceSvg(o.customer.face, 'neutral') + `<span>${esc(o.customer.name)} orders:</span>`;
        hud.ticket.querySelector('.kq-icon').textContent = o.icon; hud.ticket.querySelector('.kq-ask').textContent = o.ask; hud.ticket.querySelector('.kq-detail').textContent = o.detail;
        hud.chip.innerHTML = `<span>${o.icon}</span>${esc(o.ask)}`;
      }
      hud.end.style.display = 'none'; drawClock(run);
      hud.ticket.style.display = step === 'read' ? 'block' : 'none'; hud.gotArrow.style.display = tgt && tgt.kind === 'gotit' ? 'block' : 'none';
      hud.chip.style.display = step === 'pot' || step === 'add' || step === 'react' ? 'flex' : 'none';
      hud.shelf.style.display = step === 'pot' ? 'grid' : 'none';
      hud.rowArrow.style.display = tgt && tgt.kind === 'pots' ? 'block' : 'none';
      for (const p of O.POTS) {
        const b = hud.pots[p.id], glow = tgt && (tgt.kind === 'pots' || (tgt.kind === 'pot' && tgt.id === p.id));
        b.className = 'kq-pot' + (glow ? ' kq-glow' : '') + (step === 'pot' && !run.canPick(p.id) ? ' locked' : '');
        b.querySelector('.kq-arrow').style.display = tgt && tgt.kind === 'pot' && tgt.id === p.id ? 'block' : 'none';
        b.setAttribute('aria-disabled', step === 'pot' && !run.canPick(p.id) ? 'true' : 'false');
      }
      hud.add.style.display = step === 'add' ? 'grid' : 'none';
      if (step === 'add') renderAdd(run, o, tgt);
      hud.react.style.display = step === 'react' ? 'block' : 'none';
      if (step === 'react') renderReact(run, o);
      layout();
    }
    function renderAdd(run, o, tgt) {
      const tutorial = o.ramp.onlyRightPot;
      hud.tray.innerHTML = run.cardViews().map((c) => {
        const glow = tgt && tgt.kind === 'card' && tgt.id === c.id, cards = tgt && tgt.kind === 'cards' && c.state === 'idle';
        const body = c.state === 'idle'
          ? `<div class="kq-cb"><button type="button" data-card="${c.id}" data-place="pot">Pot${glow ? '<div class="kq-arrow">▼</div>' : ''}</button>${tutorial ? '' : `<button type="button" data-card="${c.id}" data-place="bin">Bin</button>`}</div>`
          : `<div class="kq-cb"><span class="kq-cs">${c.state === 'pot' ? 'in the pot' : 'in the bin'}</span><button type="button" data-card="${c.id}" data-place="idle">Undo</button></div>`;
        return `<div class="kq-card ${c.state}${glow ? ' glow' : ''}${cards ? ' cards' : ''}"><div class="kq-ci">${c.icon}</div><div class="kq-cl">${esc(c.label)}</div><div class="kq-cw" role="img" aria-label="size ${c.w}">${blocks(c.w)}</div>${body}</div>`;
      }).join('');
      const H = O.GAUGE, inPot = run.cards.filter((s) => s.state === 'pot');
      hud.fill.innerHTML = inPot.map((s, i) => { const c = o.cards.find((x) => x.id === s.id); return `<i style="height:${(100 * c.w / H).toFixed(2)}%;background:${SEG[i % SEG.length]}" title="${esc(c.label)}"></i>`; }).join('');
      hud.fl.style.bottom = (100 * run.line() / H).toFixed(2) + '%';
      hud.gauge.className = 'kq-gauge' + (run.over() ? ' over' : ''); hud.gauge.style.setProperty('--pc', run.pot ? POT_COL[run.pot.potId] : '#d9b46a');
      hud.add.querySelector('.kq-potname').innerHTML = run.pot ? potSvg(run.pot.potId) + esc(O.POTS.find((p) => p.id === run.pot.potId).name) : '';
      hud.bin.querySelector('.kq-bn').textContent = run.binned() ? `× ${run.binned()}` : 'junk goes here';
      hud.bin.style.visibility = tutorial ? 'hidden' : 'visible';
      hud.serve.className = 'kq-btn kq-serve' + (run.sorted() ? '' : ' off'); hud.serve.setAttribute('aria-disabled', run.sorted() ? 'false' : 'true');
      hud.serveArrow.style.display = tgt && tgt.kind === 'serve' ? 'block' : 'none';
    }
    function renderReact(run, o) {
      const r = run.result;
      hud.react.querySelector('.kq-reface').innerHTML = faceSvg(o.customer.face, run.mood());
      hud.react.querySelector('.kq-line').textContent = r.why;
      hud.react.querySelector('.kq-stars').innerHTML = [['pot', 'Right pot'], ['clean', 'Right cards'], ['line', 'Under the line']].map(([k, label]) => `<span class="${r.stars[k] ? 'ok' : ''}">${r.stars[k] ? '★' : '☆'} ${label}</span>`).join('');
      hud.react.querySelector('.kq-btn').textContent = run.i + 1 >= run.total ? 'See how it went' : 'Next order →';
    }
    function renderEnd() {
      const run = S.run, mx = run.maxStars(), rating = run.shiftStars(), sec = Math.round((S.endMs - S.t0) / 1000), mastered = (id) => !!(progress.data && progress.data.concepts && progress.data.concepts[id] && progress.data.concepts[id].mastered);
      for (const k of ['ticket', 'chip', 'shelf', 'add', 'react']) hud[k].style.display = 'none';
      hud.banner.style.display = 'grid'; hud.back.style.display = 'block'; hud.say.textContent = 'Shift done!'; hud.no.textContent = `${run.total} orders`; drawClock(run);
      hud.dots.forEach((d) => { d.className = 'on'; });
      hud.end.innerHTML = `<div class="kq-big" role="img" aria-label="${rating} of 3 stars">${'★'.repeat(rating)}${'☆'.repeat(3 - rating)}</div><div class="kq-sum">${run.stars()} of ${mx} stars · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</div>`
        + `<h3>What you practised</h3><ul class="kq-recap">${run.recap().map((x) => `<li><b>${esc(x.title)}</b><span>${esc(x.line)}</span><em class="${x.got === x.of ? 'all' : ''}">${x.got} of ${x.of}</em>${mastered(x.id) ? '<small>★ You have mastered this one</small>' : ''}</li>`).join('')}</ul>`
        + `<div class="kq-acts"><button class="kq-btn" type="button" data-act="again">Play again</button>${progress.download ? '<button class="kq-btn quiet" type="button" data-act="export">Export progress</button>' : ''}</div>`;
      hud.end.style.display = 'block'; layout();
    }
    // the timer bar (order 5 only): a calm bar and the seconds left; it turns orange in the last quarter, with no flashing and no sound
    function drawClock(run) {
      const f = run.timeFrac();
      hud.clock.style.display = f == null ? 'none' : 'flex';
      if (f == null) { hud.clock.dataset.on = ''; return; }
      const left = Math.ceil(run.timer.left);
      if (hud.clock.dataset.on !== '1') { hud.clock.dataset.on = '1'; layout(); }
      hud.clockBar.style.width = (100 * f).toFixed(1) + '%'; hud.clock.classList.toggle('low', f < 0.25); hud.clockText.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    // the shared side panel: the order, the timer (order 5 only), the stars so far; hidden on the results
    function drawGhud() {
      const run = S.run; ghud.show(!run.done);
      ghud.update({ round: { n: run.i + 1, total: run.total, label: 'Order' }, time: run.timer ? { secs: run.timer.left, countdown: true } : null, mistakes: null, score: run.stars(),
        controls: [['H', 'Help'], ['M', audio() && audio().muted ? 'Unmute' : 'Mute'], ['Esc', 'Leave']] });
    }
    function flashSay() { if (!hud || reduced()) return; hud.say.classList.remove('flash'); void hud.say.offsetWidth; hud.say.classList.add('flash'); }
    const nudge = (text) => { hud.say.textContent = text; flashSay(); };

    // ---- the taps ----
    function gotIt() { if (!S || !S.run.gotIt()) return; sfx('tick'); render(); }
    function pick(id) {
      if (!S) return;
      const r = S.run.pickPot(id);
      if (!r.ok) { if (r.reason === 'locked') { sfx('oops'); nudge(r.nudge); } return; }
      sfx('tick'); render();   // the verdict on the pot comes with the serve
    }
    function place(id, dest) {
      if (!S) return;
      const r = S.run.place(id, dest);
      if (!r.ok) { if (r.reason === 'locked') { sfx('oops'); nudge(r.nudge); } return; }
      sfx(dest === 'bin' ? 'drop' : 'tick'); render();
      if (dest === 'bin' && !reduced()) { hud.bin.classList.remove('tossed'); void hud.bin.offsetWidth; hud.bin.classList.add('tossed'); }
      if (S.run.over()) sfx('oops');
    }
    function serve() {
      if (!S) return;
      const run = S.run, r = run.serve();
      if (!r.ok) { if (r.reason === 'unsorted') { sfx('oops'); nudge(r.nudge); } return; }
      served(run, r);
    }
    function served(run, r) {   // the order is over (Serve, or the timer): the reaction, and what the rest of the game is told
      sfx(r.happy ? 'ding' : 'oops'); world.react(r.happy); render();
      const o = run.order();
      emit('answer', { credit: true, conceptId: o.concept, variantId: o.task, kind: r.kind, clean: r.total === 3, ok: r.happy });
    }
    function next() { if (!S || !S.run.next()) return; sfx('tick'); if (S.run.done) finishShift(); render(); }
    function finishShift() {
      const run = S.run; S.finished = true; S.endMs = performance.now(); sfx('bell');
      emit('finish', { seed: run.spec.seed, playerId: S.runInfo.playerId, runIndex: S.runInfo.runIndex, why: 'done', stars: run.shiftStars(), points: run.stars(), maxPoints: run.maxStars(),
        timeMs: Math.round(S.endMs - S.t0), clean: run.cleanVariants(), variants: run.spec.orders.map((x) => x.task) });
    }
    function exportProgress() { if (progress.download) { progress.download(); TF.sys && TF.sys('Progress exported as JSON (all games).'); } }
    function restart() { if (!S) return; sfx('tick'); S = null; startShift(); }   // a fresh shift: new orders, new run
    function repeat() {   // "?": the instruction for this step, again, and the arrows start their bobbing again so the eye finds what to tap
      if (!S || S.run.done) return; sfx('tick'); hud.say.textContent = S.run.banner(); flashSay();
      hud.ui.querySelectorAll('.kq-arrow').forEach((a) => { a.style.animation = 'none'; void a.offsetWidth; a.style.animation = ''; });
    }
    function exit() { if (!S) return; if (!world.exit()) leave(); }

    // ---- flow ----
    function startShift() {
      if (S) return;
      hud = hud || makeHud(); ghud = ghud || window.GameHUD.create(); ghud.reset(); intro = intro || window.IntroScreen.create(O.INTRO);
      const r = progress.newRun(), spec = O.buildShift(r.playerId, r.runIndex), run = createRun(spec);
      S = { on: true, run, runInfo: r, t0: performance.now(), endMs: 0, round: Math.random(), finished: false, lastMs: 0 };
      document.body.classList.add('kitchen-on'); hud.keys = {};
      emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed }); emit('shift', { variants: spec.orders.map((o) => o.task) });
      const go = () => { sfx('bell'); render(); };
      if (intro.skipped()) go(); else intro.open({ onStart: go });
    }
    function leave() {
      if (!S) return;
      if (!S.finished) emit('abandon', { served: S.run.log.length, spills: 0, timeMs: Math.round(performance.now() - S.t0) });   // left before the end: no mastery
      S = null; document.body.classList.remove('kitchen-on'); if (ghud) ghud.show(false); if (intro) intro.close();
      if (hud) for (const k of all()) hud[k].style.display = 'none';
    }
    play.closeDebrief = () => exit();

    // ---- keys: extras for the mouse and the touch screen ----
    function onKey(e) {
      if (!S || !S.on) return false;
      const a = audio(); if (a && a.init) a.init();
      if (ghud.handleKey(e)) return true;
      if (intro.handleKey(e)) { if (e.code === 'KeyM' && !e.repeat) a && a.toggle && a.toggle(); return true; }
      if (e.code === 'Escape') { if (!e.repeat) ghud.confirmLeave(exit); return true; }
      if (e.code === 'KeyM' && !e.repeat) { a && a.toggle && a.toggle(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { intro.open({ help: true }); return true; }   // the "?" button still repeats the step's instruction
      const step = S.run.step, focus = document.activeElement;
      if ((e.code === 'Space' || e.code === 'Enter') && focus && focus.tagName === 'BUTTON' && focus.closest('.kq')) return false;   // a button reached with Tab: Space or Enter presses that button
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault();
        if (step === 'read') gotIt(); else if (step === 'add') serve(); else if (step === 'react') next(); else if (step === 'done') restart();
        return true;
      }
      if (/^Digit[123]$/.test(e.code) && !e.repeat) { if (step === 'pot') pick(O.POTS[+e.code.slice(-1) - 1].id); return true; }
      return false;
    }

    // ---- entry ----
    // ---- the clock: real seconds (a hidden tab pauses the frames; the jump after it is capped), only ticking in order 5 ----
    function frame() {
      if (!S || !S.on) return;
      const now = performance.now(), dt = S.lastMs ? Math.min(0.5, (now - S.lastMs) / 1000) : 0; S.lastMs = now;
      const run = S.run; if (!run.timer || intro.isOpen() || ghud.confirmOpen()) return;   // the clock stops while help or the leave confirm is up
      const r = run.tick(dt);
      if (r) served(run, r); else { drawClock(run); drawGhud(); }
    }
    play.register = function () {
      TF.life.push(() => frame());
      addEventListener('resize', layout);
      world.on('enter', () => startShift());
      world.on('leave', () => leave());
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on && onKey(e)) || (prev ? prev(e) : false);
    };
    Object.assign(play, { leave, exit, onKey });
    Object.defineProperties(play, { state: { get: () => S }, hud: { get: () => hud } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.kitchen, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.kitchenPlay = play;
    return play;
  }
  return { STEPS, SEG, createRun, faceSvg, potSvg, create, install };
});
