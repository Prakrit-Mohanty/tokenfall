// Token Tower — gameplay. Browser: window.JengaPlay. Node: require('./jenga-play.js') (the pure rules).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run     7 questions, wrong tries, points, stars, the clock; run.pull(n) decides what a pull meant, run.place(tipped) what a placement did
//   pointsFor, starsFor, nearestLegal, RULES
// Browser:
//   install(TF)                builds the HUD and the game on jenga-world.js, takes over the table's E (TF.tower.open) and the keys
//
// THE GAME
//  A tower stands on the table in the plaza. Each question lights four blocks, each carrying an answer. Pick one (1-4 or a click) and hold Space for about half a second to
//  pull it. The right block slides out, lifts and hovers over the top: set it down where the stability gauge stays green, with Space or a click, and its answer is engraved on
//  the top face. A wrong block jams a third of the way out and slides back: a Concept Card ("You pulled: ..."), and the tower gets more nervous (try 1 a jolt, try 2 a heavy sway).
//  THE THIRD WRONG TRY, over the whole run, brings the tower down. A stack that tips (the weight outside what holds it up) brings it down too.
//  Points: 3 for the right block on the first pull of a question, 2 on the second, 1 on the third. Stars: 3 = all 7 placed with at most 1 wrong try in the run, 2 = all 7 placed,
//  1 = at least 4 placed (also when the 5:00 clock ends, which leaves the tower standing and flags the unanswered questions for spaced retrieval), else 0.
//  "First try" for mastery means the right pull with no wrong pull on that question before it.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./jenga-engine.js') : root.JengaEngine, isNode ? require('./jenga-generator.js') : root.JengaGenerator, isNode ? require('./jenga-content.js') : root.JENGA_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.JengaPlay = api;
})(this, function (E, G, CONTENT, CW) {
  const RULES = { MAX_WRONG: 3, STAR3_WRONG: 1, STAR1_PLACED: 4, MAX_POINTS: 21 };
  const pointsFor = (tries) => (tries <= 1 ? 3 : tries === 2 ? 2 : 1);
  const starsFor = (placed, total, wrong) => (placed >= total ? (wrong <= RULES.STAR3_WRONG ? 3 : 2) : placed >= RULES.STAR1_PLACED ? 1 : 0);
  const snap = E.snap;
  // the legal position (a list of [lo, hi] runs) nearest to u, on the 0.05 grid
  function nearestLegal(legal, u) {
    let best = null, bd = Infinity;
    for (const [a, b] of legal) { const c = Math.max(a, Math.min(b, u)), d = Math.abs(c - u); if (d < bd) { bd = d; best = c; } }
    return best == null ? null : snap(best);
  }

  // ---------------------------------------------------------------- a whole run
  function createRun(spec) {
    const run = { spec, i: 0, wrong: 0, placed: 0, over: null, started: false, clock: spec.clockSec, elapsed: 0, answers: [], sent: 0,
      qs: spec.questions.map(() => ({ tries: 0, struck: new Set(), solved: false, placed: false, tipped: false, points: 0, ans: null })) };
    run.q = () => spec.questions[run.i]; run.st = () => run.qs[run.i]; run.total = () => spec.questions.length;
    run.start = () => { run.started = true; };
    run.tick = (dt) => { if (!run.started || run.over) return; run.elapsed += dt; run.clock = Math.max(0, run.clock - dt); if (run.clock === 0) run.over = 'timeout'; };
    const base = (q) => ({ conceptId: q.conceptId, variantId: q.variantId, side: q.side, kind: q.kind });

    // n: the number the player pulled. What did that pull mean?
    run.pull = (n) => {
      const q = run.q(), st = run.st(), o = q.options[n - 1];
      if (!o || st.solved || st.struck.has(n) || run.over) return null;
      st.tries++;
      if (o.correct) {
        st.solved = true; st.points = pointsFor(st.tries);
        st.ans = Object.assign({ correct: true, firstTry: st.tries === 1, tries: st.tries }, base(q)); run.answers.push(st.ans);
        return { kind: 'right', points: st.points, tries: st.tries };
      }
      run.wrong++; st.struck.add(n);
      run.answers.push(Object.assign({ correct: false, firstTry: false, wrongId: o.id }, base(q)));
      const collapse = run.wrong >= RULES.MAX_WRONG; if (collapse) run.over = 'wrongs';
      return { kind: 'wrong', level: run.wrong, collapse, struck: n, card: { lead: 'You pulled:', text: o.text, breaks: o.breaks, idea: q.idea } };
    };
    // the block is down: did it tip the tower?
    run.place = (tipped) => {
      const st = run.st();
      if (tipped) { run.over = 'tipped'; st.tipped = true; if (st.ans) st.ans.toppled = true; return { kind: 'tipped' }; }
      st.placed = true; run.placed++;
      const last = run.i >= run.total() - 1; if (last) run.over = 'done';
      return { kind: last ? 'done' : 'next' };
    };
    run.advance = () => { if (run.i < run.total() - 1) { run.i++; return true; } return false; };
    // the clock ended: every question still unsolved is flagged, so its idea comes back
    run.giveUp = () => { spec.questions.forEach((q, k) => { if (!run.qs[k].solved) run.answers.push(Object.assign({ correct: false, firstTry: false, timedOut: true }, base(q))); }); };
    run.points = () => run.qs.reduce((n, s) => n + s.points, 0);
    run.stars = () => starsFor(run.placed, run.total(), run.wrong);
    run.summary = () => ({
      stars: run.stars(), placed: run.placed, total: run.total(), wrongTries: run.wrong, points: run.points(), why: run.over, tipped: run.over === 'tipped', collapsed: run.over === 'wrongs' || run.over === 'tipped',
      answers: run.answers.slice(), seed: spec.seed, seen: spec.seen.slice(), flagged: [...new Set(run.answers.filter((a) => !a.correct && !a.wrongId).map((a) => a.conceptId))],
    });
    return run;
  }

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    const memory = (fixed) => { let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10); return { newRun: () => ({ playerId: id, runIndex: n++, history: { runs: [], concepts: {} } }), onEvent() {} }; };
    let progress = opts.progress || memory(opts.fixed);
    const play = { debrief: null, modal: null, useProgress(p) { progress = p; } }, listeners = {};
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    const STYLE = CW.STYLE, SIDE_SLOT = { approach: 0, agents: 1, proof: 2, pilot: 3 }, BAND_SLOT = { green: 1, amber: 0, red: 3, tip: 3 };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const REDUCED = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let S = null, hud = null; const held = {};

    // ---- sound: the bridge's synth and its M mute, plus the tower's voices (a drawer sliding, a clunk, a wood knock, a rumble) ----
    const audio = () => (bridge && bridge.audio) || null, muted = () => !!(audio() && audio().muted);
    function sfx(name) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'friction') { a.noise(0.2, 0.06, 900); a.tone(120, 0.22, 'sawtooth', 0.02, 0, 90); }
      else if (name === 'clunk') { a.tone(95, 0.24, 'triangle', 0.12, 0, 52); a.noise(0.09, 0.14, 500); }
      else if (name === 'knock') { a.noise(0.05, 0.16, 1800); a.tone(260, 0.08, 'square', 0.04, 0, 180); a.tone(130, 0.12, 'triangle', 0.06, 0.02); }
      else if (name === 'lift') a.tone(420, 0.14, 'triangle', 0.05, 0, 640);
      else if (name === 'rumble') { a.tone(48, 1.9, 'sawtooth', 0.12, 0, 28); a.tone(72, 1.5, 'triangle', 0.09, 0.05, 40); a.noise(1.5, 0.12, 120); a.noise(0.7, 0.2, 900, 0.5); }
      else if (name === 'tick') a.tone(1000, 0.05, 'square', 0.035);
      else a.play(name);
    }

    // ---- HUD: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text. A question card, a status block, a gauge while placing, one hint line ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .tq { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(780px, calc(100vw - 640px)); padding: 6px 14px 9px; text-align: center; display: none; background: rgba(10,12,20,.95); border-color: var(--gold); }
        .tq .k { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .tq .t { font-size: clamp(17px, 1.7vw, 23px); line-height: 1.2; margin: 2px 0 6px; color: #fff8e6; text-shadow: 0 1px 0 #000; }
        .tq .a { display: grid; gap: 4px; grid-template-columns: repeat(2, 1fr); text-align: left; }
        .tq.nolegend .a { display: none; }
        .tq .a > div { display: flex; gap: 8px; align-items: center; padding: 3px 8px; background: rgba(255,255,255,.07); border: 1px solid rgba(217,180,106,.35); font-size: 15px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tq .a > div.out { opacity: .45; text-decoration: line-through; } .tq .a i { font-style: normal; flex: none; font-size: 17px; }
        .ts { position: absolute; top: 214px; right: 18px; text-align: right; padding: 7px 12px; font-size: 14px; line-height: 1.7; display: none; min-width: 170px; }
        .ts b { color: #ffe39a; font-weight: 600; } .ts kbd, .tm kbd, .th kbd, .tg kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .ts .pips { display: flex; gap: 3px; justify-content: flex-end; margin: 0 0 4px; }
        .ts .pips i { width: 15px; height: 8px; border: 1px solid rgba(243,234,214,.45); } .ts .pips i.done { border-color: transparent; background: var(--c); } .ts .pips i.cur { border-color: #ffe39a; box-shadow: 0 0 0 1px #ffe39a; }
        .ts .clock { font-family: 'Cinzel', serif; font-size: 22px; letter-spacing: .08em; } .ts .clock.low { color: var(--hot); }
        .ts .gems { display: inline-flex; gap: 8px; vertical-align: middle; } .tgem { width: 9px; height: 9px; background: var(--gold); transform: rotate(45deg); box-shadow: 0 0 8px var(--gold); } .tgem.hot { background: var(--hot); box-shadow: 0 0 8px var(--hot); }
        .tm { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); max-width: min(560px, calc(100vw - 420px)); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.3; background: rgba(10,12,20,.93); }
        .tg { position: absolute; left: 18px; bottom: 22px; width: 232px; padding: 8px 12px 9px; display: none; font-size: 14px; line-height: 1.35; background: rgba(10,12,20,.94); }
        .tg h5 { margin: 0 0 5px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); display: flex; justify-content: space-between; } .tg h5 span { font-family: 'Pixelify Sans'; letter-spacing: .04em; color: var(--c); font-size: 15px; }
        .tg .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); margin-bottom: 7px; } .tg .bar i { display: block; height: 100%; background: var(--c); transition: width .08s; }
        .tg canvas { display: block; width: 112px; height: 112px; margin: 0 auto 4px; background: rgba(255,255,255,.04); border: 1px solid rgba(217,180,106,.3); } .tg p { margin: 0; opacity: .85; }
        .th { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(620px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .th h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); } .th ul { margin: 0; padding-left: 20px; } .th li { margin: 5px 0; } .th .go { text-align: right; font-size: 14px; color: var(--gold); margin: 10px 0 0; }
        @media (max-width: 1100px) { .tq { width: calc(100vw - 32px); top: 70px; } .ts { top: auto; bottom: 80px; } .tg { bottom: 80px; } }
        .tower-on .tq, .tower-on .ts, .tower-on .tm, .tower-on .th, .tower-on .tg, .tower-on .tt-tag { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .tower-on #chat, .tower-on #help { display: none; }   /* the chat log and key hints sit over the tower; the tower has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      const h = { style, q: mk('tq'), s: mk('ts'), m: mk('tm'), g: mk('tg'), h: mk('th'), qKey: '', sKey: '', gKey: '' };
      h.s.style.setProperty('--hot', STYLE[3].css); h.g.innerHTML = '<h5>STABILITY <span id="tgBand">green</span></h5><div class="bar"><i id="tgFill"></i></div><canvas id="tgDiag" width="224" height="224"></canvas><p id="tgNote"></p>';
      h.gc = h.g.querySelector('#tgDiag'); h.gf = h.g.querySelector('#tgFill'); h.gb = h.g.querySelector('#tgBand'); h.gn = h.g.querySelector('#tgNote');
      return h;
    }
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open);
    const helpOpen = () => !!hud && hud.h.style.display === 'block';
    const sideName = (s) => CONTENT.SIDES[s].name;
    function say(html, secs = 2.8) { S.hint = secs; hud.m.innerHTML = html; hud.m.style.display = 'block'; }
    function drawHud(dt) {
      if (!S || !hud) return;
      const run = S.run, q = run.q(), talking = TF.talking, helping = helpOpen(), on = S.on && !talking && !helping && S.phase !== 'done' && S.phase !== 'collapse' && !(S.phase === 'card' && cardOpen());
      const key = [run.i, S.phase === 'card', helping, talking, S.legend, [...run.st().struck].join(), S.phase === 'collapse'].join('|');
      hud.q.style.display = on ? 'block' : 'none'; hud.q.classList.toggle('nolegend', !S.legend);
      if (key !== hud.qKey) {
        hud.qKey = key;
        const kicker = q.kind === 'finale' ? `ROLLOUT CASE · DECISION ${run.i - 3} OF 3` : `QUESTION ${run.i + 1} OF ${run.total()} · ${sideName(q.side).toUpperCase()}`;
        hud.q.innerHTML = `<div class="k">${esc(kicker)}</div><div class="t">${esc(q.stem)}</div><div class="a">${q.options.map((o) => `<div class="${run.st().struck.has(o.n) ? 'out' : ''}"><i style="color:${STYLE[o.n - 1].css}">${STYLE[o.n - 1].mark}</i><b>${o.n}</b><span>${esc(o.text)}</span></div>`).join('')}</div>`;
      }
      hud.s.style.display = on || (S.phase === 'card' && cardOpen()) ? 'block' : 'none';
      const secs = Math.ceil(run.clock), sKey = [secs, run.wrong, run.i, run.placed, run.points(), muted()].join('|');
      if (sKey !== hud.sKey) {
        hud.sKey = sKey;
        const pips = run.qs.map((st, i) => `<i class="${st.placed ? 'done' : ''}${i === run.i ? ' cur' : ''}" style="--c:${run.spec.questions[i].kind === 'finale' ? 'var(--gold)' : STYLE[SIDE_SLOT[run.spec.questions[i].side]].css}"></i>`).join('');
        const gems = Array.from({ length: RULES.MAX_WRONG }, (_, i) => `<i class="tgem ${i < run.wrong ? 'hot' : ''}"></i>`).join('');   // gold while a try is still free, red once spent
        hud.s.innerHTML = `<div class="pips" aria-hidden="true">${pips}</div><div class="clock ${secs <= 30 ? 'low' : ''}">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</div>Wrong tries <span class="gems">${gems}</span><br>Placed <b>${run.placed}/${run.total()}</b> · Points <b>${run.points()}</b><br><kbd>H</kbd> help · <kbd>M</kbd> ${muted() ? 'off' : 'on'} · <kbd>Esc</kbd> leave`;
      }
      hud.g.style.display = on && S.phase === 'place' ? 'block' : 'none';
      if (S.hint > 0) { S.hint -= dt; hud.m.style.display = S.hint <= 0 || !on ? 'none' : 'block'; }
      else if (on && S.phase === 'select' && coachSeen < 3 && !cardOpen()) { hud.m.innerHTML = 'Press <kbd>1</kbd>-<kbd>4</kbd> or click a block, then hold <kbd>Space</kbd> to pull it. <kbd>A</kbd><kbd>D</kbd> turn the view.'; hud.m.style.display = 'block'; }
      else if (on && S.phase === 'place') { hud.m.innerHTML = 'Move the block with the mouse or <kbd>←</kbd><kbd>→</kbd>. <kbd>Space</kbd> or a click sets it down.'; hud.m.style.display = 'block'; }
      else hud.m.style.display = 'none';
    }
    const COACH_KEY = 'tokenfall.tower.coach'; let coachSeen = 0;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; } catch (e) {}
    const bumpCoach = () => { coachSeen++; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.h.innerHTML = '<h3>TOKEN TOWER</h3><ul><li>Four blocks carry four answers. Press <kbd>1</kbd>-<kbd>4</kbd> or click the block you think is right, then hold <kbd>Space</kbd> to pull it.</li><li>Right block: it slides out and hovers. Set it on top where the gauge stays green: <kbd>←</kbd><kbd>→</kbd> or the mouse, then <kbd>Space</kbd> or a click.</li><li>Wrong block: it jams and slides back, a Concept Card shows why, and the tower gets nervous. Three wrong tries in a run bring it down. A stack that tips does too.</li><li><kbd>A</kbd><kbd>D</kbd> or a drag turn the view. <kbd>Tab</kbd> hides the answer list. <kbd>M</kbd> sound. <kbd>E</kbd> continues. <kbd>Esc</kbd> leaves (progress is kept, without mastery credit for an unfinished run).</li></ul><p class="go"><kbd>H</kbd> or <kbd>E</kbd> to close</p>';
      hud.h.style.display = on ? 'block' : 'none';
    }

    // ---- the gauge: green / amber / red, and a top-down look at the weakest interface (the centre of mass against what holds it up) ----
    const BAND_NOTE = { green: 'Well supported.', amber: 'Getting thin.', red: 'About to go.', tip: 'It will tip.' };
    function drawGauge() {
      const st = S.st, m = S.shown, band = E.band(m), c = STYLE[BAND_SLOT[band]].css;
      const key = [S.u, S.layer, Math.round(m * 100), band].join('|'); if (key === hud.gKey) return; hud.gKey = key;
      hud.g.style.setProperty('--c', c); hud.gb.textContent = band === 'tip' ? 'TIPS' : band; hud.gf.style.width = Math.round(clamp(m / 0.6, 0.03, 1) * 100) + '%';
      const g = hud.gc.getContext('2d'), N = 224, k = N / 4.4, X = (x) => N / 2 + x * k, Z = (z) => N / 2 + z * k;   // 4.4 block widths across
      g.clearRect(0, 0, N, N); g.strokeStyle = 'rgba(243,234,214,.35)'; g.lineWidth = 2; g.strokeRect(X(-1.5), Z(-1.5), 3 * k, 3 * k);   // the tower's footprint
      if (st.hullPoints.length) { g.beginPath(); st.hullPoints.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath(); g.fillStyle = 'rgba(125,255,138,.22)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(125,255,138,.9)'; g.stroke(); }
      if (st.comPoint) { g.beginPath(); g.arc(X(st.comPoint[0]), Z(st.comPoint[1]), 9, 0, 6.2832); g.fillStyle = c; g.fill(); g.lineWidth = 3; g.strokeStyle = '#14100a'; g.stroke(); }
      const w = st.weakest, where = !w ? '' : w.kind === 'block' ? `the block itself, layer ${w.layer + 1}` : `layers ${w.k + 1} and ${w.k + 2}`;
      hud.gn.innerHTML = `${BAND_NOTE[band]} Weakest: ${esc(where)}. The dot is the weight above, the green shape is what holds it up.`;
    }

    // ---- flow ----
    const afterTalk = (fn) => { S.waitTalk = fn; };
    function startRun(quiet) {
      const r = progress.newRun(), spec = G.composeRun(G.seedFor(r.playerId, r.runIndex), r.history);
      S = { on: true, run: createRun(spec), runInfo: r, phase: 'intro', T: JSON.parse(JSON.stringify(spec.start.tower)), q: null, block: null, pulled: null, R: null, u: 0, layer: 0, st: null, shown: 0.5, legend: true, sinceWrong: 99, hint: 0,
        waitTalk: null, brief: 0, cardOut: null, afterCard: null, maxH: E.height(spec.start.tower), summary: null, lastSecs: -1 };
      world.setTower(S.T); emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed, seen: spec.seen.slice() });
      if (quiet) { TF.banner('A new tower', 'New questions'); showQuestion(); return; }
      TF.banner('Token Tower', 'Pull the block that carries the answer');
      TF.talk('Token Tower', coachSeen === 0
        ? ['Welcome to the Token Tower. Seven blocks, seven answers.', 'Pick the block that carries the right answer and hold Space to pull it. Wrong block? A Concept Card, and the tower gets nervous. Three wrong tries and it falls.', 'Then set your block on top, steady. A and D turn the view. Tab hides the list. M mutes. Esc leaves.']
        : ['Back for another tower? Same rules: pull right, stack steady.']);
      afterTalk(showQuestion);
    }
    function showQuestion() {
      const run = S.run, q0 = run.q(), q = G.resolveQuestion(S.T, q0) || q0;
      S.q = q; S.phase = 'select'; run.start(); S.hint = 0; hud.qKey = '';
      world.setQuestion(q, S.T);
    }
    function onPull(n) {   // the world says the hold is done: what did the pull mean?
      if (!S || S.phase !== 'select') return;
      S.phase = 'pulling'; const out = S.run.pull(n); if (!out) { S.phase = 'select'; return; }
      emit('pull', { kind: out.kind, tries: S.run.st().tries });
      world.resolvePull(out.kind === 'right', (how) => {
        if (!S) return;
        if (how === 'held') return picked(n);
        world.mark(n); S.sinceWrong = 0; world.shake(out.level >= 2 ? 2 : 1); if (!REDUCED && out.level >= 2) world.cameraShake(0.5, 0.012);
        TF.sys(`Not that block. Wrong try ${out.level} of ${RULES.MAX_WRONG}.`);
        S.phase = 'card'; S.cardOut = out; bridge.card.show(out.card);
      });
    }
    function picked(n) {   // the right block hovers over the tower
      const o = S.q.options[n - 1], block = { id: o.blockId, answerText: o.text };
      S.block = block; S.pulled = E.applyPull(S.T, block.id); S.R = E.placementRange(S.pulled, block); S.layer = S.R.layer; S.u = E.choosePlacement(S.R, 'mid'); S.phase = 'place'; hud.gKey = '';
      world.setHeld(S.u, S.layer, o.text); updatePlace(); sfx('chime');
      if (S.run.st().tries === 1) TF.sys('Right block! Set it on top, steady.'); else TF.sys('That one. Set it on top, steady.');
    }
    function updatePlace() {
      const res = E.applyPlace(S.pulled, S.block, S.u, S.layer); S.st = E.stability(res.tower);
      S.shown = S.st.minMargin - E.shakePenalty(S.run.wrong, S.sinceWrong);
      world.setHeld(S.u, S.layer); world.setGhost(S.u, S.layer, E.band(S.shown)); S.placeKey = S.u + '|' + S.layer;
    }
    function setU(u) { const n = nearestLegal(S.R.legal, u); if (n != null && n !== S.u) { S.u = n; updatePlace(); } }
    function release() {
      if (!S || S.phase !== 'place') return;
      S.phase = 'settling'; const u = S.u, layer = S.layer, res = E.applyPlace(S.pulled, S.block, u, layer), m = E.stability(res.tower).minMargin;
      world.drop(u, layer, () => landed(res.tower, m, u, layer));
    }
    function landed(T2, m, u, layer) {
      const run = S.run; world.dropHeld(); world.setTower(T2); S.T = T2; S.maxH = Math.max(S.maxH, E.height(T2)); sfx('knock'); world.puff(layer, u);
      if (m < 0) { run.place(true); startCollapse('tipped'); return; }   // the weight sat outside what holds it up
      const out = run.place(false); world.sway(0.12 * (1 - Math.min(1, m)));   // a small sway, bigger the thinner the margin
      TF.sys(`Placed: the tower is ${E.height(T2)} layers. ${run.placed} of ${run.total()}.`); emit('placed', { index: run.i, margin: +m.toFixed(3), height: E.height(T2) });
      if (out.kind === 'done') { finish('done'); return; }
      run.advance(); world.clearQuestion(); S.phase = 'between'; S.brief = 0.9;
    }
    function closeCard() {
      if (!S || S.phase !== 'card') return;
      bridge.card.hide(); const out = S.cardOut, then = S.afterCard; S.cardOut = null; S.afterCard = null;
      if (then) { then(); return; }
      if (out && out.collapse) { startCollapse('wrongs'); return; }
      S.phase = 'select';
    }

    // ---- the fall ----
    function startCollapse(why) {
      S.phase = 'collapse'; world.hideGhost(); hud.g.style.display = 'none';
      TF.banner('The tower fell!', why === 'tipped' ? 'The weight sat outside what holds it up' : 'Three wrong tries');
      world.collapse(S.T, S.run.spec.seed + 977 * S.run.wrong + S.run.i, () => {
        if (!S) return;
        if (why === 'tipped') { setTimeout(() => { if (!S) return; S.phase = 'card'; bridge.card.show({ line: 'Your stack tipped: the weight sat outside what holds it up.', idea: S.run.q().idea, hint: 'Continue' }); S.afterCard = () => finish('tipped'); }, 700); }
        else setTimeout(() => S && finish('wrongs'), 700);
      });
    }
    function timeUp() {
      S.phase = 'timeup'; bridge.card.hide(); world.dropHeld(); world.hideGhost(); world.clearQuestion(); hud.g.style.display = 'none';
      TF.banner('Time is up', 'The tower stands'); S.run.giveUp(); finish('timeout');
    }

    // ---- ending the run ----
    function flush(credit) {   // answers are credited when the run ends; leaving with Esc keeps them, without mastery credit
      const run = S.run, fresh = run.answers.slice(run.sent); run.sent = run.answers.length;
      for (const a of fresh) emit('answer', Object.assign({ credit }, a));
    }
    function finish(why) {
      const run = S.run; run.over = run.over || why; flush(true);
      const sum = run.summary(); sum.height = S.maxH; sum.seconds = Math.round(run.elapsed); sum.timeMs = Math.round(run.elapsed * 1000); sum.tokens = Math.round(sum.points * 15) + 25 * Math.max(0, sum.stars - 1);   // 15 a point, and 25 for every star after the first
      sum.playerId = S.runInfo.playerId; sum.runIndex = S.runInfo.runIndex; sum.why = why;
      if (why === 'done') { sfx('chime'); TF.banner('The tower stands', `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`); }
      emit('finish', sum); S.phase = 'done'; S.summary = sum; world.clearQuestion();
      if (play.debrief) play.debrief(sum);
      else { TF.talk('Token Tower', [`${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${sum.placed} of ${sum.total} placed, ${sum.wrongTries} wrong ${sum.wrongTries === 1 ? 'try' : 'tries'}.`, sum.flagged.length ? 'A few ideas will come back next time. That is the point.' : 'Come back for a different tower.']); afterTalk(() => leave()); }
    }
    play.closeDebrief = () => { if (!S || S.phase !== 'done') return; if (S.summary.collapsed) { const keep = S.legend; startRun(true); S.legend = keep; } else leave(); };   // a fallen tower is rebuilt with a new seed; a standing one is left
    function leave() {
      if (!S) return;
      if (S.run && S.phase !== 'done') { flush(false); emit('abandon', { seen: S.run.spec.seen.slice(), placed: S.run.placed, wrongTries: S.run.wrong, points: S.run.points(), timeMs: Math.round(S.run.elapsed * 1000) }); }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); S.on = false;
      if (play.modal && play.modal.open()) { play.modal.hide && play.modal.hide(); }
      const s = S; S = null; for (const k in held) held[k] = false;
      if (hud) for (const k of ['q', 's', 'm', 'g', 'h']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('tower-on'); world.leave();
      return s;
    }

    // ---- input ----
    function onKey(e) {
      if (!S || !S.on) return false;
      const a = audio(); if (a && a.init) a.init();
      if (play.modal && play.modal.open()) { if (['KeyE', 'Escape', 'Enter'].includes(e.code) && !e.repeat) play.modal.close(); else if (play.modal.key) play.modal.key(e); return true; }
      if (e.code === 'Escape' && !e.repeat) { if (helpOpen()) showHelp(false); else leave(); return true; }
      if (e.code === 'KeyM' && !e.repeat) { a && a.toggle(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { showHelp(!helpOpen()); return true; }
      if (e.code === 'KeyE' && !e.repeat) { if (helpOpen()) showHelp(false); else closeCard(); return true; }
      if (e.code === 'Tab' && !e.repeat) { S.legend = !S.legend; hud.qKey = ''; return true; }
      if (cardOpen() || helpOpen() || TF.talking || S.phase === 'collapse' || S.phase === 'done' || S.phase === 'intro') return true;   // the card has the keys
      if (S.phase === 'place') {
        if (e.code === 'Space') { if (!e.repeat) release(); return true; }
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { held[e.code] = true; if (!e.repeat) setU(S.u + (e.code === 'ArrowRight' ? 1 : -1) * world.screenSign(S.layer) * 0.05); return true; }
      }
      if (S.phase === 'select' && /^Digit[1-4]$/.test(e.code) && !e.repeat) bumpCoach();
      return world.keys.onKey(e) || true;   // the world takes A/D, 1-4 and the Space hold; everything else is swallowed: no walking, no stray jumps, no camera switch
    }
    function onKeyUp(e) { held[e.code] = false; }
    function onPointerMove(e) {
      if (!S || S.phase !== 'place' || (world.state.drag && world.state.drag.moved)) return;
      const lat = world.lateralAt(e.clientX, e.clientY, S.layer); if (lat != null) setU(lat);
    }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      S.sinceWrong += dt;
      if (S.phase === 'between') { S.brief -= dt; if (S.brief <= 0) showQuestion(); }
      const live = ['select', 'pulling', 'place', 'settling'].includes(S.phase) && !TF.talking && !cardOpen() && !helpOpen();
      if (live) {
        const run = S.run; run.tick(dt); const secs = Math.ceil(run.clock);
        if (secs !== S.lastSecs) { if (secs <= 10 && secs > 0 && S.lastSecs !== -1) sfx('tick'); S.lastSecs = secs; }
        if (run.over === 'timeout') { timeUp(); return; }
        if (S.phase === 'place') {
          const dir = (held.ArrowRight ? 1 : 0) - (held.ArrowLeft ? 1 : 0);
          if (dir) setU(S.u + dir * world.screenSign(S.layer) * 1.1 * dt);   // arrow keys: about a block width a second
          else if (S.placeKey !== S.u + '|' + S.layer || S.sinceWrong < 11) updatePlace();   // the shake lowers the shown margin for ~10 s
          drawGauge();
        }
      }
      drawHud(dt);
    }

    // ---- entry ----
    play.open = () => {
      hud = hud || makeHud();
      return world.enter(() => { document.getElementById('ui').classList.add('tower-on'); startRun(false); });
    };
    play.register = function () {
      world.open = play.open;
      TF.life.push((t, dt) => frame(t, dt));
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on ? onKey(e) : prev ? prev(e) : false);
      addEventListener('keyup', onKeyUp);
      TF.renderer.domElement.addEventListener('pointermove', onPointerMove);
      world.on('pull', onPull); world.on('click', () => release());
      world.on('friction', () => sfx('friction')); world.on('clunk', () => sfx('clunk')); world.on('lift', () => sfx('lift')); world.on('rumble', () => sfx('rumble'));
      addEventListener('blur', () => { for (const k in held) held[k] = false; });
    };
    Object.assign(play, { leave, release, closeCard, onKey, setU });
    Object.defineProperties(play, { state: { get: () => S }, hud: { get: () => hud } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.tower, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.jengaPlay = play;
    return play;
  }
  return { RULES, pointsFor, starsFor, nearestLegal, createRun, create, install };
});
