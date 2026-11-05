// House Rules Carrom — gameplay. Browser: window.CarromPlay. Node: require('./carrom-play.js') (the pure rules engine).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run        rounds, strikes, points, stars for one run
//   createRound(round) -> R       one round: clock, strikes, scoring; R.judge({ pocket }) decides what a shot meant
//   aimGuide(coin, side, t, angle)  where a straight shot from the striker first touches the coin, and the line the coin then leaves along
//   pointsFor, starsFor, memoryProgress, RULES
// Browser:
//   install(TF)                   builds the HUD and controls on carrom-world.js, takes over the table's E (TF.carrom.open) and the keys
//
// THE GAME
//  One coin and a striker. The four pockets are the four answers: shoot the coin into the pocket whose answer you think is right. Pull back from the striker
//  and let go (or arrows and Space). The striker starts on a baseline and can be moved along it (A / D), or to another baseline (Tab, or click a baseline):
//  a hit always pushes the coin away from the striker, so a pocket is shot at from one of the two sides facing away from it.
//  Strikes: two per round. The wrong pocket is a strike and a Concept Card ("You sank: ..."); the coin goes back to where it was. A coin that stops on the
//  board costs only time and stays where it stopped (one that ends up far from the middle is nudged back towards it).
//  At two strikes, or when the clock runs out, a ghost shot shows the answer and the round is flagged for spaced retrieval.
//  Points: 3 if the right pocket was found on the first shot since the last answer, 2 on the second, 1 on the third or later. A sort round (three
//  items, one coin each in turn) averages its items; the finale averages its two questions. Items answered right before a ghost keep their points
//  (SORT_PARTIAL_CREDIT). Stars: 3 for 13+ of 15 with at most one strike in the whole run, 2 for 9+, 1 finished.
//  "First try" for mastery means a right pocket with no strike on that answer before it; a missed shot is skill, not knowledge.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./carrom-physics.js') : root.CarromPhysics, isNode ? require('./carrom-generator.js') : root.CarromGenerator, isNode ? require('./carrom-content.js') : root.CARROM_CONTENT);
  if (isNode) module.exports = api;
  else root.CarromPlay = api;
})(this, function (P, G, CONTENT) {
  const CFG = P.CFG, DEG = Math.PI / 180;
  const RULES = { MAX_STRIKES: 2, STAR3_POINTS: 13, STAR3_STRIKES: 1, STAR2_POINTS: 9, MAX_POINTS: 15, SORT_PARTIAL_CREDIT: true, COMFORT_R: 24 };
  const pointsFor = (shots) => (shots <= 1 ? 3 : shots === 2 ? 2 : 1);
  const starsFor = (total, strikes) => (total >= RULES.STAR3_POINTS && strikes <= RULES.STAR3_STRIKES ? 3 : total >= RULES.STAR2_POINTS ? 2 : 1);

  // ---------------------------------------------------------------- the aim guide
  // A straight shot from the striker (on `side`, at lane position t) at `angle` degrees (0 = north, clockwise). Returns where the striker's centre is when it first
  // touches the coin (or reaches a cushion), and, if it touches, the line the coin leaves along: which pocket that line runs into (if any) and where it ends.
  function aimGuide(coin, side, t, angle) {
    const L = P.strikerAt(side, t), a = angle * DEG, dx = Math.sin(a), dy = -Math.cos(a), rr = CFG.R_COIN + CFG.R_STRIKER, lo = CFG.R_STRIKER, hi = CFG.SIZE - CFG.R_STRIKER;
    const fx = L.x - coin.x, fy = L.y - coin.y, b = fx * dx + fy * dy, disc = b * b - (fx * fx + fy * fy - rr * rr);
    const tw = Math.min(dx > 1e-9 ? (hi - L.x) / dx : dx < -1e-9 ? (lo - L.x) / dx : Infinity, dy > 1e-9 ? (hi - L.y) / dy : dy < -1e-9 ? (lo - L.y) / dy : Infinity);
    const s = disc >= 0 ? -b - Math.sqrt(disc) : -1;
    if (s >= 0 && s <= tw) {
      const px = L.x + dx * s, py = L.y + dy * s, nx = (coin.x - px) / rr, ny = (coin.y - py) / rr;
      // the coin leaves along (nx, ny): into a pocket, or to the cushion
      let end = Infinity, corner = null;
      const cw = Math.min(nx > 1e-9 ? (CFG.SIZE - CFG.R_COIN - coin.x) / nx : nx < -1e-9 ? (CFG.R_COIN - coin.x) / nx : Infinity, ny > 1e-9 ? (CFG.SIZE - CFG.R_COIN - coin.y) / ny : ny < -1e-9 ? (CFG.R_COIN - coin.y) / ny : Infinity);
      end = cw;
      P.POCKETS.forEach(([qx, qy], c) => {
        const gx = coin.x - qx, gy = coin.y - qy, bb = gx * nx + gy * ny, dd = bb * bb - (gx * gx + gy * gy - CFG.R_POCKET * CFG.R_POCKET);
        if (dd < 0) return; const u = -bb - Math.sqrt(dd); if (u >= 0 && u < end) { end = u; corner = c; }
      });
      return { hit: true, side, striker: L, end: { x: px, y: py }, depart: { x: coin.x, y: coin.y, dx: nx, dy: ny, corner, length: end } };
    }
    return { hit: false, side, striker: L, end: { x: L.x + dx * tw, y: L.y + dy * tw }, depart: null };
  }
  // the angle that points the striker at the coin
  const angleTo = (side, t, coin) => { const L = P.strikerAt(side, t); return Math.atan2(coin.x - L.x, -(coin.y - L.y)) / DEG; };

  // ---------------------------------------------------------------- one round
  const targetsOf = (q) => (q.kind === 'pick'
    ? [{ id: q.id, correct: q.options.find((o) => o.correct), start: q.start, ghost: q.ghost }]
    : q.items.map((it) => ({ id: it.id, item: it, correct: q.options.find((o) => o.id === it.pocket), start: it.start, ghost: it.ghost })));
  function createRound(round) {
    const R = { round, qi: 0, clock: round.clock, strikes: 0, shots: 0, over: null, done: false, answers: [],
      qs: round.questions.map((q) => ({ targets: targetsOf(q), idx: 0, solved: new Set(), pts: {}, attempts: 0, struck: new Set(), strikesHere: 0 })) };
    R.q = () => round.questions[R.qi]; R.st = () => R.qs[R.qi]; R.target = () => R.st().targets[R.st().idx];
    R.tick = (dt) => { if (R.done || R.over) return; R.clock = Math.max(0, R.clock - dt); if (R.clock === 0) R.over = 'timeout'; };
    const answer = (q, tg, f) => R.answers.push(Object.assign({ coinId: tg.id, conceptId: q.conceptId, variantId: q.variantId, side: q.side, kind: q.kind, scenario: q.scenario }, f));

    // res: { pocket: corner the coin fell into, or null } from the physics. What did that shot mean?
    R.judge = (res) => {
      if (R.done || R.over) return null;
      const q = R.q(), st = R.st(), tg = R.target(); R.shots++; st.attempts++;
      const out = { kind: 'miss', pocket: res.pocket, pts: 0, solvedQ: false, nextQ: false, nextItem: false, over: null, card: null, shots: st.attempts };
      const opt = res.pocket == null ? null : q.options.find((o) => o.corner === res.pocket);
      if (opt && opt.id === tg.correct.id) {
        out.kind = 'right'; st.solved.add(st.idx); out.pts = st.pts[st.idx] = pointsFor(st.attempts);
        answer(q, tg, { correct: true, firstTry: q.kind === 'pick' ? st.strikesHere === 0 : !st.struck.has(tg.id), shots: st.attempts, pocket: opt.id });
        st.attempts = 0;
        if (st.solved.size >= st.targets.length) { out.solvedQ = true; if (R.qi < round.questions.length - 1) { R.qi++; out.nextQ = true; } else R.done = true; }
        else { st.idx++; out.nextItem = true; }
      } else if (opt) {
        out.kind = 'wrong'; R.strikes++; st.strikesHere++; st.struck.add(tg.id);
        out.card = q.kind === 'pick' ? { lead: 'You sank:', text: opt.text, breaks: opt.breaks, idea: q.idea } : { lead: 'You sank:', text: `${tg.item.text} → ${opt.text}`, breaks: tg.item.breaks[opt.id], idea: q.idea };
        answer(q, tg, { correct: false, firstTry: false, shots: st.attempts, wrongId: q.kind === 'pick' ? opt.tagId : tg.id + '>' + opt.id });
        if (R.strikes >= RULES.MAX_STRIKES) R.over = out.over = 'strikes';
      }
      return out;
    };
    // what a ghost shot has to show (the targets of the current question still to answer), and the answers lost with them
    R.unsolved = () => R.st().targets.filter((t, i) => !R.st().solved.has(i));
    R.giveUp = () => { const q = R.q(); for (const t of R.unsolved()) answer(q, t, { correct: false, firstTry: false, shots: R.st().attempts, timedOut: true }); R.done = true; };
    R.flagged = () => !!R.over || R.strikes > 0;
    R.points = () => {
      if (R.over && !RULES.SORT_PARTIAL_CREDIT && round.kind === 'sort') return 0;
      return round.questions.reduce((n, q, i) => n + Object.values(R.qs[i].pts).reduce((a, b) => a + b, 0) / R.qs[i].targets.length, 0) / round.questions.length;
    };
    return R;
  }

  // ---------------------------------------------------------------- a whole run
  function createRun(spec) {
    const run = { spec, i: 0, rounds: spec.rounds.map(createRound), finished: false };
    run.round = () => run.rounds[run.i];
    run.total = () => run.rounds.reduce((n, r) => n + r.points(), 0);
    run.strikes = () => run.rounds.reduce((n, r) => n + r.strikes, 0);
    run.answers = () => run.rounds.flatMap((r) => r.answers);
    run.advance = () => { if (run.i < run.rounds.length - 1) { run.i++; return true; } run.finished = true; return false; };
    run.stars = () => starsFor(run.total(), run.strikes());
    run.summary = () => {
      const answers = run.answers();
      return { stars: run.stars(), points: +run.total().toFixed(2), strikes: run.strikes(), seed: spec.seed, seen: spec.seen,
        rounds: run.rounds.map((r) => ({ side: r.round.side, kind: r.round.kind, points: +r.points().toFixed(2), strikes: r.strikes, over: r.over, flagged: r.flagged() })),
        answers, knewButMissed: answers.filter((a) => a.correct && a.shots >= 3).length, flagged: run.rounds.filter((r) => r.flagged()).map((r) => r.round.questions[0].conceptId) };
    };
    return run;
  }

  // ---------------------------------------------------------------- per-page memory, used until carrom-progress.js exists
  function memoryProgress(fixed) {
    const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10);
    let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const runs = [], concepts = {}; let cur = 0;
    return {
      newRun() { cur = n; return { playerId: id, runIndex: n++, history: { runs: runs.slice(), concepts } }; },
      onEvent(e) {
        if (e.type === 'answer' && e.credit) {
          const c = concepts[e.conceptId] = concepts[e.conceptId] || { attempts: 0, falls: 0, firstTry: [], mastered: false };
          c.attempts++; if (!e.correct) c.falls++;
          if (e.correct && e.firstTry && !c.firstTry.some((x) => x.v === e.variantId && x.r === cur)) c.firstTry.push({ v: e.variantId, r: cur });
          c.mastered = c.firstTry.some((a, i) => c.firstTry.some((b, j) => j > i && a.v !== b.v && a.r !== b.r));
        } else if (e.type === 'finish' || e.type === 'abandon') runs.push({ variants: e.seen || [] });
      },
    };
  }

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const { THREE } = TF, bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    // carrom never feeds the bridge's progress object (its run counter and history are the bridge's own); carrom-progress.js passes its own namespaced store in
    let progress = opts.progress || memoryProgress(opts.fixed);
    const play = { debrief: null, modal: null, useProgress(p) { progress = p; } }, listeners = {};   // modal: a panel that has taken over the keys (the table report)
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    const CSS = { amber: '#ffb347', green: '#7dff8a', cyan: '#5cd6ff', rose: '#ff9db8', gold: '#ffd27a' };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const PULL_MAX = 34, PULL_MIN = 2.5, GRAB = 5.5, LANE_GRAB = 5,   // grab: within this of the striker starts a pull-back (it is 3.2 wide); anywhere else on a baseline moves the striker there
       CHARGE_SECS = 1.3, TURN = 40, SLIDE = 38, REDUCED = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let S = null, hud = null, fx = null;
    const A = { side: 'S', t: 50, angle: 0, power: 0, charging: false, drag: false, hint: 0 };   // side: the baseline the striker is on; t: its place along it
    const held = {};

    // ---- sound: the bridge's synth and its M mute, plus the carrom voices (clack, drop, tick) ----
    const audio = () => (bridge && bridge.audio) || null;
    let lastClack = -1;
    function sfx(name, v = 1) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'clack') { const now = a.ctx.currentTime; if (now - lastClack < 0.03) return; lastClack = now; a.noise(0.03, 0.08 + 0.1 * v, 2800); a.tone(900 + 700 * v, 0.045, 'square', 0.03 + 0.04 * v); }
      else if (name === 'drop') { a.tone(320, 0.22, 'triangle', 0.09, 0, 110); a.noise(0.07, 0.1, 700); a.tone(1320, 0.06, 'square', 0.04, 0.12); a.tone(1760, 0.1, 'square', 0.04, 0.17); }
      else if (name === 'tick') a.tone(1000, 0.05, 'square', 0.035);
      else a.play(name);
    }
    const muted = () => !!(audio() && audio().muted);

    // ---- HUD: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text. Three things only: the question card, a small status block, one hint line ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .cq { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(780px, calc(100vw - 640px)); padding: 6px 14px 9px; text-align: center; display: none; background: rgba(10,12,20,.95); border-color: var(--gold); }
        .cq .k { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .cq .t { font-size: clamp(17px, 1.7vw, 23px); line-height: 1.2; margin: 2px 0 6px; color: #fff8e6; text-shadow: 0 1px 0 #000; }
        .cq .it { display: inline-block; margin: 0 0 6px; padding: 2px 12px; font-size: clamp(16px, 1.5vw, 20px); color: #1a140c; background: var(--gold); }
        .cq .a { display: grid; gap: 4px; grid-template-columns: repeat(2, 1fr); text-align: left; }
        .cq .a > div { display: flex; gap: 8px; align-items: center; padding: 3px 8px; background: rgba(255,255,255,.07); border: 1px solid rgba(217,180,106,.35); font-size: 15px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cq .a i { font-style: normal; flex: none; font-size: 17px; }
        .cs { position: absolute; top: 214px; right: 18px; text-align: right; padding: 7px 12px; font-size: 14px; line-height: 1.7; display: none; min-width: 170px; }
        .cs b { color: #ffe39a; font-weight: 600; } .cs kbd, .cm kbd, .ch kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .cs .pips { display: flex; gap: 3px; justify-content: flex-end; margin: 0 0 4px; }
        .cs .pips i { width: 15px; height: 8px; border: 1px solid rgba(243,234,214,.45); } .cs .pips i.done { border-color: transparent; background: var(--c); } .cs .pips i.cur { border-color: #ffe39a; box-shadow: 0 0 0 1px #ffe39a; }
        .cs .clock { font-family: 'Cinzel', serif; font-size: 22px; letter-spacing: .08em; } .cs .clock.low { color: #ff8f7a; }
        .cs .gems { display: inline-flex; gap: 8px; vertical-align: middle; } .cg { width: 9px; height: 9px; background: var(--gold); transform: rotate(45deg); box-shadow: 0 0 8px var(--gold); } .cg.hot { background: #ff7a5c; box-shadow: 0 0 8px #ff7a5c; }
        .cm { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); max-width: min(560px, calc(100vw - 420px)); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.3; background: rgba(10,12,20,.93); }
        .ch { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(620px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .ch h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); } .ch ul { margin: 0; padding-left: 20px; } .ch li { margin: 5px 0; } .ch .go { text-align: right; font-size: 14px; color: var(--gold); margin: 10px 0 0; }
        @media (max-width: 1100px) { .cq { width: calc(100vw - 32px); top: 70px; } .cs { top: auto; bottom: 80px; } }
        .carrom-on .bc, .carrom-on .cq, .carrom-on .cs, .carrom-on .cm, .carrom-on .ch { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .carrom-on #chat, .carrom-on #help { display: none; }   /* the chat log and key hints sit over the pockets; the table has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      return { style, q: mk('cq'), s: mk('cs'), m: mk('cm'), h: mk('ch'), qKey: '', sKey: '' };
    }
    const sideName = (s) => CONTENT.SIDES[s].name;
    const MARK = ['▲', '●', '◆', '■'], SLOT_CSS = [CSS.amber, CSS.green, CSS.cyan, CSS.rose];
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open);
    function say(html, secs = 2.6) { A.hint = secs; hud.m.innerHTML = html; hud.m.style.display = 'block'; }
    function drawHud(dt) {
      if (!S || !hud) return;
      const R = S.run.round(), q = R.q(), st = R.st(), talking = TF.talking, helping = hud.h.style.display === 'block', on = S.on && !talking && !helping && S.phase !== 'done';   // at the end the report has the screen
      const key = [S.run.i, R.qi, st.idx, S.phase === 'card', helping, talking].join('|');
      hud.q.style.display = on && !cardOpen() ? 'block' : 'none';
      if (key !== hud.qKey) {
        hud.qKey = key;
        const kicker = R.round.kind === 'case' ? `FINALE · CASE FILE · shot ${R.qi + 1} of 2` : `ROUND ${S.run.i + 1} OF 5 · ${sideName(q.side).toUpperCase()}`;
        const item = q.kind === 'sort' ? `<div class="it">Item ${st.idx + 1} of ${st.targets.length}: ${esc(st.targets[st.idx].item.text)}</div>` : '';
        hud.q.innerHTML = `<div class="k">${esc(kicker)}</div><div class="t">${esc(q.stem)}</div>${item}<div class="a">${q.options.map((o, i) => `<div><i style="color:${SLOT_CSS[i]}">${MARK[i]}</i><span>${esc(o.text)}</span></div>`).join('')}</div>`;
      }
      hud.s.style.display = on || cardOpen() ? 'block' : 'none';
      const secs = Math.ceil(R.clock), sKey = [secs, R.strikes, S.run.i, S.run.total().toFixed(1), muted()].join('|');
      if (sKey !== hud.sKey) {
        hud.sKey = sKey;
        const pips = S.run.rounds.map((r, i) => `<i class="${r.done ? 'done' : ''}${i === S.run.i ? ' cur' : ''}" style="--c:${CSS[CONTENT.SIDES[r.round.side].zone]}"></i>`).join('');
        const gems = Array.from({ length: RULES.MAX_STRIKES }, (_, i) => `<i class="cg ${i < R.strikes ? 'hot' : ''}"></i>`).join('');   // gold while a strike is still free, red once spent
        hud.s.innerHTML = `<div class="pips" aria-hidden="true">${pips}</div><div class="clock ${secs <= 10 ? 'low' : ''}">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</div>Strikes <span class="gems">${gems}</span><br>Points <b>${S.run.total().toFixed(1)}</b><br><kbd>H</kbd> help · <kbd>M</kbd> ${muted() ? 'off' : 'on'} · <kbd>Esc</kbd> leave`;
      }
      if (A.hint > 0) { A.hint -= dt; hud.m.style.display = A.hint <= 0 || !on ? 'none' : 'block'; }
      else if (on && S.phase === 'aim' && coachSeen < 3 && !cardOpen()) { hud.m.innerHTML = 'Pull back from the striker and let go. Press <kbd>Tab</kbd> or click a baseline to shoot from another side.'; hud.m.style.display = 'block'; }
      else hud.m.style.display = 'none';
    }
    const COACH_KEY = 'tokenfall.carrom.coach'; let coachSeen = 0;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; } catch (e) {}
    const bumpCoach = () => { coachSeen++; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.h.innerHTML = '<h3>HOUSE RULES</h3><ul><li>The four pockets are the four answers. Flick the coin into the one you think is right.</li><li>Pull back from the striker and let go: the farther you pull, the harder the shot. Or <kbd>←</kbd><kbd>→</kbd> turn, hold <kbd>Space</kbd> and release. <kbd>A</kbd><kbd>D</kbd> slide the striker.</li><li>A hit pushes the coin away from the striker, so shoot from a side facing away from your pocket: <kbd>Tab</kbd> or a click on any baseline moves the striker there. The dotted line shows where the coin will go.</li><li>Wrong pocket: a strike and a Concept Card (<kbd>E</kbd> continues). Two strikes, or no time, and the ghost shows the answer. A coin that stops on the board only costs time.</li><li><kbd>M</kbd> sound · <kbd>Esc</kbd> leave (progress is kept).</li></ul><p class="go"><kbd>H</kbd> or <kbd>E</kbd> to close</p>';
      hud.h.style.display = on ? 'block' : 'none';
    }
    const helpOpen = () => !!hud && hud.h.style.display === 'block';

    // ---- effects: the dotted aim line and the golden token burst, instanced; created on entry and disposed on leaving ----
    function makeFx() {
      const top = world.mapper.top;
      const dotGeo = new THREE.CircleGeometry(0.0048, 10), dotMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.98, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      const dots = new THREE.InstancedMesh(dotGeo, dotMat, 90); dots.frustumCulled = false; dots.renderOrder = 4; TF.scene.add(dots);
      const tokGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.0016, 10), tokMat = new THREE.MeshStandardMaterial({ color: 0xf1c657, emissive: 0xb8862c, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 });
      const toks = new THREE.InstancedMesh(tokGeo, tokMat, 64); toks.frustumCulled = false; TF.scene.add(toks);
      const d = new THREE.Object3D(), TP = Array.from({ length: 64 }, () => ({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0 })); let cursor = 0, count = 0;
      for (let i = 0; i < 90; i++) { d.scale.setScalar(0); d.updateMatrix(); dots.setMatrixAt(i, d.matrix); }
      for (let i = 0; i < 64; i++) { d.scale.setScalar(0); d.updateMatrix(); toks.setMatrixAt(i, d.matrix); }
      return {
        lines(segs) {   // dotted lines, [x0, y0, x1, y1, endRing]: the last dot of a line is bigger when it ends in a ring
          let n = 0;
          for (const [x0, y0, x1, y1, endRing] of segs) {
            const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.floor(len / 2.8));
            for (let k = 1; k <= steps && n < 90; k++) { const w = world.mapper.toWorld(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps); d.position.set(w.x, top + 0.004, w.z); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.setScalar(k === steps && endRing ? 1.9 : 1); d.updateMatrix(); dots.setMatrixAt(n++, d.matrix); }
          }
          for (let i = n; i < 90; i++) { d.scale.setScalar(0); d.updateMatrix(); dots.setMatrixAt(i, d.matrix); }
          dots.instanceMatrix.needsUpdate = true;
        },
        clear() { for (let i = 0; i < 90; i++) { d.scale.setScalar(0); d.updateMatrix(); dots.setMatrixAt(i, d.matrix); } dots.instanceMatrix.needsUpdate = true; },
        burst(bx, by, n = 14) {
          const w = world.mapper.toWorld(bx, by);
          for (let k = 0; k < n; k++) { const p = TP[cursor++ % 64], a = (k / n) * 6.283 + cursor, sp = 0.16 + (k % 4) * 0.05; p.pos.set(w.x, top + 0.01, w.z); p.vel.set(Math.cos(a) * sp, 0.55 + (k % 3) * 0.12, Math.sin(a) * sp); p.life = 0.9 + (k % 5) * 0.06; p.spin = k * 0.7; }
          count = 64;
        },
        update(dt) {
          if (!count) return; let any = false;
          for (let i = 0; i < 64; i++) {
            const p = TP[i]; if (p.life <= 0) { if (p.spin !== null) { d.scale.setScalar(0); d.updateMatrix(); toks.setMatrixAt(i, d.matrix); p.spin = null; } continue; }
            any = true; p.life -= dt; p.vel.y -= 1.9 * dt; p.pos.addScaledVector(p.vel, dt); p.spin += dt * 9;
            d.position.copy(p.pos); d.rotation.set(p.spin, p.spin * 0.6, 0); d.scale.setScalar(Math.min(1, p.life / 0.3)); d.updateMatrix(); toks.setMatrixAt(i, d.matrix);
          }
          toks.instanceMatrix.needsUpdate = true; if (!any) count = 0;
        },
        dispose() { TF.scene.remove(dots); TF.scene.remove(toks); dotGeo.dispose(); dotMat.dispose(); tokGeo.dispose(); tokMat.dispose(); dots.dispose(); toks.dispose(); },
      };
    }

    // ---- the coin and the striker: where they are, and the little animations (appearing, sinking, being set back) ----
    const coinMesh = () => world.coin, strikerMesh = () => world.striker;
    const r2 = (v) => Math.round(v * 100) / 100;
    const lane = () => P.strikerAt(A.side, A.t);
    function putStriker() { const L = lane(); world.setStriker(L.x, L.y, true); }
    function putCoin(x, y, appear) { S.cx = x; S.cy = y; S.anim = appear ? { kind: 'in', t: 0 } : null; world.setCoin(x, y, true); coinMesh().scale.setScalar(appear ? 0.15 : 1); }
    function tweenCoin(dt) {
      const a = S.anim, m = coinMesh(); if (!a) return; a.t += dt;
      if (a.kind === 'in') { const k = Math.min(1, a.t / 0.3); m.scale.setScalar(0.15 + 0.85 * (1 - (1 - k) * (1 - k))); if (k >= 1) S.anim = null; }
      else if (a.kind === 'drop') { const k = Math.min(1, a.t / 0.28), w = world.mapper.toWorld(P.POCKETS[a.corner][0], P.POCKETS[a.corner][1]); m.visible = true; m.position.x = a.x0 + (w.x - a.x0) * k; m.position.z = a.z0 + (w.z - a.z0) * k; m.scale.setScalar(1 - 0.9 * k); if (k >= 1) { m.visible = false; m.scale.setScalar(1); S.anim = null; } }
      else if (a.kind === 'glide') { const k = Math.min(1, a.t / 0.35), e = k * k * (3 - 2 * k); world.setCoin(a.x0 + (a.x1 - a.x0) * e, a.y0 + (a.y1 - a.y0) * e, true); if (k >= 1) { S.cx = a.x1; S.cy = a.y1; S.anim = null; } }
    }
    function setBack() {   // a coin that came to rest far from the middle is nudged back towards it: every pocket stays a fair shot away
      const dx = S.cx - 50, dy = S.cy - 50, d = Math.hypot(dx, dy); if (d <= RULES.COMFORT_R) return;
      S.anim = { kind: 'glide', t: 0, x0: S.cx, y0: S.cy, x1: r2(50 + dx / d * RULES.COMFORT_R), y1: r2(50 + dy / d * RULES.COMFORT_R) };
    }
    function aimAtCoin() { A.angle = angleTo(A.side, A.t, { x: S.cx, y: S.cy }); }
    const SIDE_CYCLE = ['S', 'W', 'N', 'E'];
    function setLane(side, t) { A.side = side; A.t = clamp(t, CFG.X_MIN, CFG.X_MAX); putStriker(); aimAtCoin(); }

    // ---- flow ----
    function afterTalk(fn) { S.waitTalk = fn; }
    function startRun() {
      const r = progress.newRun(), spec = G.composeRun(G.seedFor(r.playerId, r.runIndex), r.history);
      S = { on: true, run: createRun(spec), runInfo: r, phase: 'intro', state: null, sim: null, anim: null, cx: 50, cy: 50, prev: null, shake: { t: 0, d: 1, m: 0 }, ghost: null, waitTalk: null, brief: 0, lastSecs: -1, startedAt: Date.now(), cardOut: null, ghostCard: false, pendingNext: false, roundDone: false };
      emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed, seen: spec.seen.slice() });
      TF.talk('devansh', coachSeen === 0
        ? ['Welcome to the carrom table. House rules: the pockets are the answers.', 'Shoot the coin into the pocket you think is right. Wrong pocket? A Concept Card and a strike. Two strikes and I show you how it is done.', 'Pull back from the striker and let go. Tab or a click on a baseline moves you to another side. M mutes. Esc leaves.']
        : ['Back for another? Same rules: the pockets are the answers.']);
      afterTalk(() => startRound(0));
    }
    function showQuestion() {   // the four pockets get their marks; the coin appears, the striker on the south baseline
      const R = S.run.round(), q = R.q(), tg = R.target();
      world.setPockets(q.options); world.pulse(0, false); A.power = 0; A.charging = false; A.drag = false;
      putCoin(tg.start.x, tg.start.y, true); S.prev = { x: tg.start.x, y: tg.start.y }; A.side = 'S'; A.t = 50; putStriker(); aimAtCoin();
    }
    function startRound(i) { S.run.i = i; S.phase = 'brief'; S.brief = 0.9; S.lastSecs = -1; showQuestion(); }

    const newState = (side, t) => P.createState({ coins: [{ id: 'c', x: S.cx, y: S.cy }], strikerX: t, side });
    function shoot() {
      if (!S || S.phase !== 'aim' || A.power < 0.05) { A.power = 0; A.charging = false; return; }
      const st = newState(A.side, A.t); P.applyShot(st, { side: A.side, strikerX: A.t, angle: A.angle, power: A.power });
      S.prev = { x: S.cx, y: S.cy }; S.state = st; S.sim = { acc: 0, events: [], power: A.power, sink: null, strikerSunk: false }; S.phase = 'rolling'; S.anim = null;
      sfx('clack', A.power); clearGuide(); A.power = 0; A.charging = false;
      if (S.run.round().shots === 0 && coachSeen < 3) bumpCoach();
    }
    const pocketXY = (p) => ({ x: P.POCKETS[p][0], y: P.POCKETS[p][1] });
    const showBodies = (st) => { const s = st.bodies[0], c = st.bodies[1]; if (s.alive) world.setStriker(s.x, s.y, true); else strikerMesh().visible = false; if (c.alive) world.setCoin(c.x, c.y, true); };
    function sinkEvent(e, st) {
      const b = st.bodies.find((x) => x.id === e.id), pk = pocketXY(e.pocket); sfx('drop'); fx.burst(pk.x, pk.y, e.striker ? 6 : 14);
      if (!e.striker) { const w = world.mapper.toWorld(b.x, b.y); S.anim = { kind: 'drop', t: 0, corner: e.pocket, x0: w.x, z0: w.z }; }
    }
    function rolling(dt) {
      const sim = S.sim; sim.acc += Math.min(dt, 0.05);
      while (sim.acc >= CFG.DT) {
        sim.acc -= CFG.DT; const n = sim.events.length;
        if (!P.step(S.state, sim.events, true)) { endShot(); return; }
        for (let k = n; k < sim.events.length; k++) {
          const e = sim.events[k];
          if (e.type === 'hit') sfx('clack', clamp(e.v / 220, 0.1, 1)); else if (e.type === 'wall') sfx('clack', clamp(e.v / 400, 0.05, 0.6));
          else if (e.type === 'sink') { if (e.striker) sim.strikerSunk = true; else sim.sink = e.pocket; sinkEvent(e, S.state); }
        }
      }
      showBodies(S.state);
    }
    function endShot() {
      const sim = S.sim, R = S.run.round(), c = S.state.bodies[1]; S.sim = null;
      if (c.alive) { S.cx = c.x; S.cy = c.y; }
      putStriker();   // the striker goes back to its place on the baseline
      const out = R.judge({ pocket: sim.sink }); if (!out) return;
      emit('shot', { kind: out.kind, shots: out.shots });
      if (out.kind === 'right') {
        sfx('chime'); world.pulse(out.pocket, true); setTimeout(() => { if (S) world.pulse(0, false); }, 1200);
        if (out.solvedQ && !out.nextQ) { roundEnd(); return; }
        S.phase = 'between'; S.brief = 1.1; S.pendingNext = true; return;
      }
      if (out.kind === 'wrong') {
        sfx('crack'); if (!REDUCED) S.shake = { t: 0.28, d: 0.28, m: 0.012 };
        TF.sys(`Not that pocket. Strike ${R.strikes} of ${RULES.MAX_STRIKES}.`);
        S.phase = 'card'; S.cardOut = out; bridge.card.show(out.card); return;
      }
      // a miss: only time is lost, and the coin stays where it stopped
      S.phase = 'aim'; setBack(); aimAtCoin();
      say(S.state.first == null ? 'The striker missed the coin. Line it up and pull back again.' : sim.strikerSunk ? 'The striker fell in a pocket. Only time lost.' : 'No pocket that time. Try another angle, or another side (Tab).');
    }
    function closeCard() {
      if (!S || S.phase !== 'card') return;
      bridge.card.hide(); const out = S.cardOut; S.cardOut = null;
      if (S.ghostCard) { S.ghostCard = false; roundEnd(); return; }
      if (out && out.over) { startGhost(out.over); return; }
      S.phase = 'aim'; putCoin(S.prev.x, S.prev.y, true); putStriker(); aimAtCoin();   // the coin comes back to where it was
    }

    // ---- the ghost shot: the stored shot that sinks the coin in the right pocket, played on the real physics ----
    function startGhost(why) {
      const R = S.run.round(), q = R.q(); clearGuide();
      TF.banner(why === 'timeout' ? 'Time is up' : 'Two strikes', 'Watch how it is done');
      emit('ghost', { why, conceptId: q.conceptId });
      S.ghost = { list: R.unsolved(), i: -1, hold: 0, rest: false }; S.phase = 'ghost'; nextGhost();
    }
    function nextGhost() {
      const g = S.ghost; g.i++;
      if (g.i >= g.list.length) { ghostDone(); return; }
      const t = g.list[g.i], sh = t.ghost, st = P.createState({ coins: [{ id: 'c', x: t.start.x, y: t.start.y }], strikerX: sh.strikerX, side: sh.side });
      putCoin(t.start.x, t.start.y, true); const L = P.strikerAt(sh.side, sh.strikerX); world.setStriker(L.x, L.y, true); world.pulse(t.correct.corner, true); g.hold = 0; g.rest = false; g.wait = 0.9;   // a beat to see the set-up, then the shot
      g.state = st; g.shot = sh; g.sim = null;
    }
    function ghostStep(dt) {
      const g = S.ghost;
      if (g.wait > 0) { g.wait -= dt; if (g.wait <= 0) { P.applyShot(g.state, g.shot); g.sim = { acc: 0, events: [] }; sfx('clack', g.shot.power); } return; }
      if (g.sim) {
        const sim = g.sim; sim.acc += Math.min(dt, 0.05);
        while (sim.acc >= CFG.DT) {
          sim.acc -= CFG.DT; const n = sim.events.length;
          if (!P.step(g.state, sim.events, true)) { g.sim = null; g.rest = true; break; }
          for (let k = n; k < sim.events.length; k++) { const e = sim.events[k]; if (e.type === 'hit') sfx('clack', clamp(e.v / 220, 0.1, 1)); else if (e.type === 'sink') sinkEvent(e, g.state); }
        }
        showBodies(g.state);
      } else { g.hold += dt; if (g.hold > 1.2) { world.pulse(0, false); nextGhost(); } }
    }
    function ghostDone() {
      const R = S.run.round(), q = R.q(), left = R.unsolved();
      R.giveUp(); S.ghost = null; world.pulse(0, false); S.phase = 'card'; S.ghostCard = true; S.cardOut = null;
      const text = q.kind === 'pick' ? q.options.find((o) => o.correct).text : left.map((t) => `${t.item.text} → ${t.correct.text}`).join('; ');
      bridge.card.show({ lead: left.length > 1 ? 'The answers:' : 'The answer:', text, idea: q.idea, hint: 'Continue' });
    }

    // ---- ending a round and the run ----
    function flush(credit) {   // answers are credited when their round is complete; leaving mid-round keeps them, without mastery credit
      for (const R of S.run.rounds) { const fresh = R.answers.slice(R.sent || 0); R.sent = R.answers.length; for (const a of fresh) emit('answer', Object.assign({ credit }, a)); }
    }
    function roundEnd() {
      const R = S.run.round(); R.done = true; flush(true);
      emit('round', { index: S.run.i, side: R.round.side, points: +R.points().toFixed(2), strikes: R.strikes, over: R.over, flagged: R.flagged() });
      TF.sys(`Round ${S.run.i + 1}: ${R.points().toFixed(1)} point${R.points() === 1 ? '' : 's'}${R.flagged() ? '. This idea comes back later.' : '.'}`);
      S.phase = 'between'; S.brief = 1.4; S.pendingNext = false; S.roundDone = true;
    }
    function finish() {
      S.run.finished = true; const sum = S.run.summary(); sum.seconds = Math.round((Date.now() - S.startedAt) / 1000); sum.tokens = Math.round(sum.points * 20) + 25 * (sum.stars - 1); sum.playerId = S.runInfo.playerId; sum.runIndex = S.runInfo.runIndex;   // 20 a point, and 25 for every star after the first
      sfx('chime'); TF.banner('The table is clear', `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`);
      emit('finish', sum); S.phase = 'done'; S.summary = sum; world.setPockets([]); coinMesh().visible = false; strikerMesh().visible = false;
      if (play.debrief) play.debrief(sum);
      else { TF.talk('devansh', [`${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${sum.points.toFixed(1)} of 15 points, ${sum.strikes} strike${sum.strikes === 1 ? '' : 's'}.`, sum.flagged.length ? 'A few ideas will come back next time. That is the point.' : 'Clean table. Come back for a different set of questions.']); afterTalk(() => leave()); }
    }

    // ---- leaving: Esc, or the end ----
    function leave() {
      if (!S) return;
      if (S.run && !S.run.finished) { flush(false); emit('abandon', { seen: S.run.spec.seen.slice(), points: S.run.total() }); }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); clearGuide(); S.on = false;
      const s = S; S = null; A.charging = A.drag = false; for (const k in held) held[k] = false;
      if (fx) { fx.dispose(); fx = null; }
      if (hud) for (const k of ['q', 's', 'm', 'h']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('carrom-on'); world.leave();
      return s;
    }

    // ---- aim guide: the striker's path to the coin, then where the struck coin heads (to its pocket, if it is heading for one) ----
    function clearGuide() { if (fx) fx.clear(); }
    function updateGuide() {
      if (!fx) return;
      if (!(canAim() && (A.drag || A.charging || held.ArrowLeft || held.ArrowRight || held.KeyA || held.KeyD))) { fx.clear(); return; }
      const g = aimGuide({ x: S.cx, y: S.cy }, A.side, A.t, A.angle), L = g.striker, segs = [[L.x, L.y, g.end.x, g.end.y, false]];
      if (g.depart) { const d = g.depart, len = d.corner != null ? d.length : Math.min(d.length, 26); segs.push([d.x + d.dx * CFG.R_COIN * 1.3, d.y + d.dy * CFG.R_COIN * 1.3, d.x + d.dx * len, d.y + d.dy * len, true]); }
      fx.lines(segs);
    }

    // ---- input ----
    const canAim = () => S && S.on && S.phase === 'aim' && !TF.talking && !cardOpen() && !helpOpen();
    function onKey(e) {
      if (!S || !S.on) return false;
      const a = audio(); if (a && a.init) a.init();
      if (play.modal && play.modal.open()) { if (['KeyE', 'Escape', 'Enter'].includes(e.code) && !e.repeat) play.modal.close(); else if (play.modal.key) play.modal.key(e); return true; }
      if (e.code === 'Escape' && !e.repeat) { if (helpOpen()) showHelp(false); else leave(); return true; }
      if (e.code === 'KeyM' && !e.repeat) { a && a.toggle(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { showHelp(!helpOpen()); return true; }
      if (e.code === 'KeyE' && !e.repeat) { if (helpOpen()) showHelp(false); else closeCard(); return true; }
      if (e.code === 'Tab' && !e.repeat) { if (canAim()) { const k = SIDE_CYCLE.indexOf(A.side); setLane(SIDE_CYCLE[(k + (e.shiftKey ? 3 : 1)) % 4], A.t); } return true; }
      held[e.code] = true;
      if (e.code === 'Space') { if (canAim() && !e.repeat) { A.charging = true; A.power = 0.05; } return true; }
      return true;   // everything else is swallowed while the table is up: no walking, no stray jumps, no camera switch
    }
    function onKeyUp(e) { held[e.code] = false; if (e.code === 'Space' && S && A.charging) { A.charging = false; if (canAim()) shoot(); else A.power = 0; } }
    let ptr = null;
    const boardOf = (e) => world.screenToBoard(e.clientX, e.clientY);
    // which baseline (and where along it) is the board point b on, if it is on one?
    function laneAt(b) {
      let best = null;
      for (const side of SIDE_CYCLE) {
        const p0 = P.strikerAt(side, 50), vertical = side === 'W' || side === 'E', across = vertical ? Math.abs(b.x - p0.x) : Math.abs(b.y - p0.y), along = vertical ? b.y : b.x;
        if (across <= LANE_GRAB + 1.5 && along >= CFG.X_MIN - 2 && along <= CFG.X_MAX + 2 && (!best || across < best.across)) best = { side, t: along, across };
      }
      return best;
    }
    function onPointerDown(e) {
      if (!canAim() || e.button > 0) return; const b = boardOf(e); if (!b) return;
      const L = lane(), a = audio(); if (a && a.init) a.init();
      if (Math.hypot(b.x - L.x, b.y - L.y) <= GRAB) { A.drag = true; ptr = e.pointerId; try { e.target.setPointerCapture(e.pointerId); } catch (x) {} onPointerMove(e); e.preventDefault(); return; }   // pull back from the striker
      const ln = laneAt(b); if (ln && Math.hypot(b.x - S.cx, b.y - S.cy) > CFG.R_COIN + CFG.R_STRIKER + 1) { setLane(ln.side, ln.t); e.preventDefault(); }   // a click on a baseline moves the striker there
    }
    function onPointerMove(e) {
      if (!A.drag || e.pointerId !== ptr) return; const b = boardOf(e); if (!b) return;
      const L = lane(), dx = L.x - b.x, dy = L.y - b.y, len = Math.hypot(dx, dy);   // the shot goes the way the striker is pulled from: opposite the pointer
      A.power = len < PULL_MIN ? 0 : clamp(len / PULL_MAX, 0.05, 1);
      if (len >= PULL_MIN) A.angle = Math.atan2(dx, -dy) / DEG;
    }
    function onPointerUp(e) { if (!A.drag || e.pointerId !== ptr) return; A.drag = false; ptr = null; if (canAim() && A.power >= 0.06) shoot(); else A.power = 0; }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      tweenCoin(dt);
      if (S.phase === 'brief') { S.brief -= dt; if (S.brief <= 0) S.phase = 'aim'; }
      else if (S.phase === 'between') {
        S.brief -= dt;
        if (S.brief <= 0) {
          if (S.pendingNext) { S.pendingNext = false; showQuestion(); S.phase = 'aim'; }
          else if (S.roundDone) { S.roundDone = false; if (S.run.advance()) startRound(S.run.i); else finish(); }
        }
      }
      else if (S.phase === 'ghost') ghostStep(dt);
      else if (S.phase === 'aim' || S.phase === 'rolling') {
        const R = S.run.round();
        if (!TF.talking && !cardOpen()) {
          R.tick(dt); const secs = Math.ceil(R.clock);
          if (secs !== S.lastSecs) { if (secs <= 5 && secs > 0 && S.lastSecs !== -1) sfx('tick'); S.lastSecs = secs; }
          if (R.over === 'timeout') { S.sim = null; clearGuide(); A.charging = false; A.drag = false; bridge.card.hide(); startGhost('timeout'); }
        }
        if (S.phase === 'rolling') rolling(dt);
        else if (canAim()) {
          if (held.ArrowLeft) A.angle -= TURN * dt; if (held.ArrowRight) A.angle += TURN * dt; if (A.angle > 180) A.angle -= 360; if (A.angle < -180) A.angle += 360;
          const slide = (held.KeyD ? 1 : 0) - (held.KeyA ? 1 : 0);
          if (slide) { A.t = clamp(A.t + slide * SLIDE * dt, CFG.X_MIN, CFG.X_MAX); putStriker(); if (!A.drag) aimAtCoin(); }
          if (A.charging) A.power = Math.min(1, A.power + dt / CHARGE_SECS);
          updateGuide();
        }
      }
      if (fx) fx.update(dt);
      drawHud(dt);
      if (S.shake.t > 0) { S.shake.t -= dt; const m = S.shake.m * Math.max(0, S.shake.t / S.shake.d); TF.camera.position.x += (Math.random() - 0.5) * m; TF.camera.position.z += (Math.random() - 0.5) * m; }
    }

    // ---- entry ----
    play.open = () => {
      hud = hud || makeHud();
      return world.enter(() => { document.getElementById('ui').classList.add('carrom-on'); fx = makeFx(); startRun(); });
    };
    play.register = function () {
      world.open = play.open;
      TF.life.push((t, dt) => frame(t, dt));
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on ? onKey(e) : prev ? prev(e) : false);
      addEventListener('keyup', onKeyUp);
      const el = TF.renderer.domElement; el.style.touchAction = 'none';
      el.addEventListener('pointerdown', onPointerDown); el.addEventListener('pointermove', onPointerMove); el.addEventListener('pointerup', onPointerUp); el.addEventListener('pointercancel', onPointerUp);
      addEventListener('blur', () => { A.charging = false; A.drag = false; for (const k in held) held[k] = false; });
    };
    Object.assign(play, { leave, shoot, closeCard, onKey, A, aimGuide });
    Object.defineProperties(play, { state: { get: () => S }, fx: { get: () => fx } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.carrom, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.carromPlay = play;
    return play;
  }
  return { RULES, pointsFor, starsFor, aimGuide, angleTo, createRound, createRun, memoryProgress, create, install };
});
