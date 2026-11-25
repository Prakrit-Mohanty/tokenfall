// Spot Shot — gameplay. Browser: window.GalleryPlay. Node: require('./gallery-play.js') (the pure rules).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run     the rules of a run: tokens (threats + 2 a round), the five checks, judging every card, the combo, the round logs, the score
//   tutorialRound(round)       the practice round: one threat of the first round, gliding slowly on the middle shelf, three shots
//   describe(entry, idea)      the debrief Concept Card for one card: what you did, the tell, the idea
//   tradeoff(score)            the one-line trade-off: shooting everything tanks accuracy, shooting nothing tanks catch rate
// Browser:
//   install(TF)                builds the HUD and the game on gallery-world.js, takes over the stall's E (TF.stall.open) and the keys
//
// THE GAME
//  A carnival stall on the south lawn. Three short rounds: two of the sides in a seeded order, then the finale "Rush hour". Each round: a brief (about 8 s, E starts it), about 40 s of play,
//  then a debrief of up to 3 Concept Cards (E to continue). Paper cards slide along three shelves towards ticket windows. Shoot the threats (click, tap or Space; arrow keys move the
//  reticle), spare the real ones (let them pass: delivered), and inspect a card first when it matters (hold F, right button or a long press, about 0.6 s: one magnifier charge, five a run).
//  A shot that hits nothing still costs a token. A threat that reaches the ticket window is a leak; a real card that is shot is friendly fire.
//  Stars: 3 = catch rate and accuracy both at least 85% and 3 traps inspected before the right call; 2 = both at least 65%; 1 = finished. A right call on a trap nobody inspected is a
//  "lucky shot": it scores in the round and never counts towards mastery. Esc leaves; the cards already settled are kept as partial attempts.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./gallery-engine.js') : root.GalleryEngine, isNode ? require('./gallery-content.js') : root.GALLERY_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.GalleryPlay = api;
})(this, function (E, C, CW) {
  const RULES = { COMBO: 3, ROUNDS: C.RUN.rounds, MAGNIFIER: C.RUN.magnifier };
  const TRADE = 'Shooting everything tanks accuracy; shooting nothing tanks catch rate.';

  // ================================================================ pure
  function createRun(spec) {
    const run = { spec, i: -1, charges: spec.magnifier, logs: [], round: null, elapsed: 0 };
    run.begin = (i) => {   // a round starts: its tokens, a fresh combo, nothing settled
      const r = spec.rounds[i]; run.i = i;
      run.round = { r, ammo: r.ammo, ammoStart: r.ammo, shots: [], inspects: [], inspected: new Set(), done: new Map(), combo: 0, bestCombo: 0, dry: 0, closed: false, byUid: Object.fromEntries(r.items.map((it) => [it.uid, it])) };
      return run.round;
    };
    run.canShoot = () => !!run.round && !run.round.closed && run.round.ammo > 0;
    run.canInspect = () => !!run.round && !run.round.closed && run.charges > 0;
    const settle = (R, entry) => { R.done.set(entry.uid, entry); R.combo = entry.correct ? R.combo + 1 : 0; R.bestCombo = Math.max(R.bestCombo, R.combo); return entry.correct && R.combo % RULES.COMBO === 0; };   // the ribbon: 3 right calls in a row
    // uid: the card the shot hit (the world's hit test decides), or null. A shot that hits nothing still costs a token; with none left it does nothing.
    run.shoot = (uid, t, off) => {
      const R = run.round; if (!R || R.closed) return { kind: 'none' };
      if (R.ammo <= 0) { R.dry++; return { kind: 'dry' }; }
      R.ammo--; const hit = uid && R.byUid[uid] && !R.done.has(uid) ? uid : null; R.shots.push({ t, uid: hit });
      if (!hit) return { kind: 'miss', ammo: R.ammo };
      const entry = E.entryFor(R.byUid[hit], 'shot', R.inspected.has(hit), t), ribbon = settle(R, entry), ring = E.ringFor(off ? off.dx : 0, off ? off.dy : 0);
      entry.ring = ring.name; entry.points = entry.shoot ? ring.points : 0;   // dead centre scores most; a real card shot scores nothing
      return { kind: 'hit', entry, ribbon, ammo: R.ammo };
    };
    // a card reached the ticket window and nobody shot it: a threat leaks, a real card is delivered
    run.pass = (uid, t) => {
      const R = run.round; if (!R || R.closed || !R.byUid[uid] || R.done.has(uid)) return null;
      const entry = E.entryFor(R.byUid[uid], 'passed', R.inspected.has(uid), t), ribbon = settle(R, entry);
      return { kind: entry.event, entry, ribbon };
    };
    run.inspect = (uid, t) => {   // one charge, once per card, only while it is still on the shelf
      const R = run.round; if (!R || R.closed || run.charges <= 0 || !R.byUid[uid] || R.inspected.has(uid) || R.done.has(uid)) return null;
      run.charges--; R.inspected.add(uid); R.inspects.push({ t, uid });
      return { text: R.byUid[uid].inspect, charges: run.charges };
    };
    run.finishRound = (t) => {
      const R = run.round; R.closed = true;
      const entries = R.r.items.map((it) => R.done.get(it.uid) || E.entryFor(it, 'passed', R.inspected.has(it.uid), t));   // anything still on the shelf counts as having passed
      const log = { index: R.r.index, kind: R.r.kind, side: R.r.side, ammoStart: R.ammoStart, ammoLeft: R.ammo, charges: run.charges, dry: R.dry, shots: R.shots, inspects: R.inspects, entries };
      run.logs.push(log); return log;
    };
    run.partial = () => (run.round && !run.round.closed ? [...run.round.done.values()] : []);   // the cards settled in a round that was left unfinished
    run.score = (finished) => E.scoreRun(run.logs, { finished: finished != null ? finished : run.logs.length === spec.rounds.length });
    return run;
  }

  // the practice round before the very first run: one threat from round 1 (its inspect line is the worked example) on the middle shelf, about twice as slow as a real card, with no timer to beat
  const PRACTICE_SECS = 14;
  function tutorialRound(r0) {
    const it = r0.items.find((x) => x.shoot && x.inspect) || r0.items[0], t0 = 0.8;
    const e = { uid: it.uid, itemId: it.itemId, lane: 1, dir: -1, x0: 0, popup: false, rise: 0, dur: PRACTICE_SECS, speed: 1 / PRACTICE_SECS, spawnTime: t0, endTime: t0 + PRACTICE_SECS };   // lane 1 runs right to left
    return Object.assign({}, r0, { items: [it], threats: it.shoot ? 1 : 0, ammo: 3, schedule: [e], playSec: e.endTime });
  }

  // what the debrief card says about one settled card
  function describe(e, idea) {
    const how = { stopped: e.inspected ? 'You inspected it, then shot:' : e.kind === 'trap' ? 'You shot it (a lucky call: you did not inspect it):' : 'You shot:',
      leak: 'You let this slip through:', friendly: 'You shot a real one:',
      delivered: e.inspected ? 'You inspected it and let it through:' : e.kind === 'trap' ? 'You let it through (a lucky call: you did not inspect it):' : 'You let it through:' };
    return { lead: how[e.event], text: e.card.body, breaks: e.tell, breaksLabel: 'The tell:', idea, ideaLabel: 'The idea:' };
  }
  function tradeoff(s) {
    const verdict = s.accuracy != null && s.accuracy < 0.65 ? 'Quick on the trigger.' : s.catchRate < 0.65 ? 'Too many slipped through.' : s.catchRate >= 0.85 && s.accuracy != null && s.accuracy >= 0.85 ? 'A steady balance.' : 'A fair balance.';
    return `${verdict} ${TRADE}`;
  }
  const roundLine = (s) => `Stopped ${s.stopped} of ${s.threats} threats (${Math.round(100 * s.catchRate)}%) · accuracy ${s.accuracy == null ? '–' : Math.round(100 * s.accuracy) + '%'} · ${s.leaks} missed · ${s.friendly} real cards hit · ${s.ammoLeft} shots left · ${s.points || 0} points`;

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    const memory = (fixed) => { let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10); return { newRun: () => ({ playerId: id, runIndex: n++, history: { runs: [], concepts: {} } }), onEvent() {} }; };
    let progress = opts.progress || memory(opts.fixed);
    const play = { debrief: null, modal: null, tradeoff, useProgress(p) { progress = p; } }, listeners = {};
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    const STYLE = CW.STYLE, SIDE_SLOT = { claims: 0, asking: 1, poison: 2, labels: 3 };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let S = null, hud = null, ghud = null, intro = null;   // ghud: the shared side panel, intro: the shared intro card (js/game)
    const COACH_KEY = 'tokenfall.gallery.coach'; let coachSeen = 0;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; } catch (e) {}
    const bumpCoach = () => { coachSeen++; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };

    // ---- sound: the bridge's synth and its M mute, plus the stall's voices (a pop, a stamp, a bell, a thunk, a ding, a crowd murmur) ----
    const audio = () => (bridge && bridge.audio) || null, muted = () => !!(audio() && audio().muted);
    function sfx(name) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'pop') { a.noise(0.08, 0.18, 1500); a.tone(520, 0.09, 'square', 0.05, 0, 900); }
      else if (name === 'stamp') { a.tone(110, 0.12, 'triangle', 0.14, 0, 60); a.noise(0.05, 0.12, 700); }
      else if (name === 'bell') { a.tone(1568, 0.5, 'sine', 0.07); a.tone(2349, 0.35, 'sine', 0.035, 0.01); }
      else if (name === 'ding') { a.tone(880, 0.12, 'sine', 0.08); a.tone(1320, 0.3, 'sine', 0.08, 0.09); }
      else if (name === 'thunk') { a.tone(150, 0.12, 'triangle', 0.1, 0, 80); a.noise(0.04, 0.08, 500); }
      else if (name === 'leak') { a.tone(180, 0.35, 'sawtooth', 0.07, 0, 90); a.noise(0.2, 0.1, 300); }
      else if (name === 'friendly') { a.tone(330, 0.12, 'triangle', 0.07, 0, 220); a.tone(247, 0.2, 'triangle', 0.06, 0.1); }
      else if (name === 'hit') { a.tone(1400, 0.05, 'square', 0.05, 0, 2000); a.noise(0.03, 0.08, 2500); }
      else if (name === 'dry') a.tone(700, 0.04, 'square', 0.03);
      else if (name === 'combo') { a.tone(659, 0.1, 'triangle', 0.07); a.tone(784, 0.1, 'triangle', 0.07, 0.08); a.tone(1047, 0.25, 'triangle', 0.07, 0.16); }
      else if (name === 'murmur') { const f = 130 + Math.random() * 90; a.tone(f, 0.9, 'triangle', 0.012); a.tone(f * 1.26, 0.8, 'triangle', 0.008, 0.2); a.noise(0.7, 0.012, 300); }
      else a.play(name);
    }

    // ---- HUD: the lobby's .panel look, Baloo 2 for titles, Nunito for text. A round strip, a status block with gems, a hint line, the brief, the round result, the reading panel ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .gp-top { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 640px)); padding: 6px 14px 8px; text-align: center; display: none; background: rgba(10,12,20,.95); border-color: var(--gold); }
        .gp-top .k { font-family: var(--font-secondary); font-size: 16px; letter-spacing: .14em; color: var(--gold); }
        .gp-top .t { font-size: clamp(16px, 1.5vw, 20px); line-height: 1.25; margin: 2px 0 4px; color: var(--ink); }
        .gp-top .pips { display: flex; gap: 4px; justify-content: center; } .gp-top .pips i { width: 26px; height: 7px; border: 1px solid rgba(243,234,214,.45); }
        .gp-top .pips i.done { border-color: transparent; background: var(--c); } .gp-top .pips i.cur { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .gp-top .ribbon { display: none; margin-top: 4px; font-family: var(--font-secondary); font-size: 16px; letter-spacing: .2em; color: var(--gold); } .gp-top .ribbon.on { display: block; }
        .gp-msg kbd, .gp-brief kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .gp-msg { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); max-width: min(620px, max(300px, calc(100vw - 760px))); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.3; background: rgba(10,12,20,.93); }
        .gp-brief { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; text-align: center; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .gp-brief .k { font-family: var(--font-secondary); font-size: 16px; letter-spacing: .16em; color: var(--gold); } .gp-brief .t { font-size: 24px; margin: 8px 0; line-height: 1.25; } .gp-brief .m { font-size: 16px; opacity: .85; } .gp-brief .go { margin: 10px 0 0; font-size: 16px; color: var(--gold); text-align: right; }
        .gp-rs { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 32px)); padding: 8px 16px 9px; text-align: center; display: none; font-size: 16px; line-height: 1.4; background: rgba(10,12,20,.96); border-color: var(--gold); }
        .gp-rs .rc { margin-top: 3px; font-size: 16px; line-height: 1.35; text-align: left; } .gp-rs .rc b { color: var(--gold); font-weight: 600; }
        .gp-rs h5 { margin: 0 0 3px; font-family: var(--font-secondary); font-size: 16px; letter-spacing: .14em; color: var(--gold); } .gp-rs .go { color: var(--gold); font-size: 16px; margin-top: 3px; }
        .gp-rs.sum { padding: 14px 18px 12px; border-radius: 20px; }
        .gp-rs .hd { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0 0 10px; }
        .gp-rs .hd .pill { font-family: var(--font-secondary); font-size: 13px; letter-spacing: .12em; padding: 3px 10px; border-radius: 999px; background: var(--gold); color: #2a1d12; }
        .gp-rs .hd .nm { font-family: var(--font-secondary); font-size: 22px; letter-spacing: .06em; color: #fff3d0; }
        .gp-rs .tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 0 0 10px; }
        .gp-rs .tile { padding: 8px 4px 7px; border-radius: 12px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
        .gp-rs .tile b { display: block; font-size: 24px; line-height: 1.1; color: #fff; font-weight: 700; } .gp-rs .tile span { display: block; font-size: 12px; letter-spacing: .04em; color: #cdbfa0; margin-top: 2px; }
        .gp-rs .tile.good b { color: #8ee08e; } .gp-rs .tile.bad b { color: #ff8f80; } .gp-rs .tile.gold b { color: var(--gold); }
        .gp-rs .ring { width: 44px; height: 44px; margin: 0 auto 2px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#8ee08e calc(var(--p) * 1%), rgba(255,255,255,.12) 0); }
        .gp-rs .ring i { width: 34px; height: 34px; border-radius: 50%; background: rgba(10,12,20,.96); display: grid; place-items: center; font-style: normal; font-size: 13px; font-weight: 700; color: #fff; }
        .gp-rs .verdict { font-size: 15px; color: #fff3d0; margin: 0 0 8px; }
        .gp-rs .mis { display: flex; flex-direction: column; gap: 6px; margin: 0 0 10px; text-align: left; }
        .gp-rs .mi { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 4px 10px; padding: 7px 10px; border-radius: 10px; background: rgba(255,120,100,.08); box-shadow: inset 3px 0 0 #ff8f80; font-size: 15px; line-height: 1.3; }
        .gp-rs .mi.ok { background: rgba(140,224,140,.08); box-shadow: inset 3px 0 0 #8ee08e; grid-template-columns: auto 1fr; }
        .gp-rs .mi .tag { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding: 1px 7px; border-radius: 6px; background: #ff8f80; color: #2a1010; font-weight: 700; align-self: center; }
        .gp-rs .mi.ok .tag { background: #8ee08e; color: #10240f; }
        .gp-rs .mi b { color: var(--gold); font-weight: 700; white-space: nowrap; } .gp-rs .mi .why { color: #e4d8bd; }
        .gp-rs .acts { display: flex; justify-content: center; gap: 10px; }
        .gp-rs .acts .b { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 15px; color: #2a1d12; background: var(--gold); box-shadow: 0 3px 0 #b8862e; }
        .gp-rs .acts .b.ghost { background: rgba(255,255,255,.1); color: #f3ead6; box-shadow: none; }
        .gp-rs .acts kbd { font: 700 12px var(--font-secondary); padding: 1px 6px; border-radius: 5px; background: rgba(0,0,0,.18); color: inherit; }
        @media (max-width: 640px) { .gp-rs .tiles { grid-template-columns: repeat(3, 1fr); } }
        .gp-read { position: absolute; left: 18px; top: 90px; width: min(380px, calc(100vw - 36px)); max-height: calc(100vh - 220px); overflow-y: auto; padding: 8px 12px 10px; display: none; font-size: 20px; line-height: 1.3; background: rgba(10,12,20,.96); pointer-events: auto; }
        .gp-read h5 { margin: 0 0 6px; font-family: var(--font-secondary); font-size: 16px; letter-spacing: .14em; color: var(--gold); } .gp-read div.c { margin: 0 0 9px; padding-left: 8px; border-left: 3px solid var(--gold); }
        .gp-read small { display: block; font-size: 16px; letter-spacing: .04em; color: var(--gold); } .gp-read i { display: block; font-style: normal; font-size: 16px; opacity: .85; margin-top: 2px; }
        .gallery-on .gp-top, .gallery-on .gp-msg, .gallery-on .gp-brief, .gallery-on .gp-rs, .gallery-on .gp-read, .gallery-on .gs-read, .gallery-on .gs-tag { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .gallery-on #chat, .gallery-on #help { display: none; }   /* the chat log and key hints sit over the stall; the stall has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      const h = { style, top: mk('gp-top'), msg: mk('gp-msg'), brief: mk('gp-brief'), rs: mk('gp-rs'), read: mk('gp-read'), topKey: '', readKey: '' };
      return h;
    }
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open);
    const helpOpen = () => !!intro && intro.isOpen();
    const sideName = (s) => C.SIDES[s].name;
    const cardName = (e) => esc(e.card.subject ? `${e.card.from}: ${e.card.subject}` : e.card.from);   // how a card is named in a message
    const sideCss = (s) => (s === 'rush' ? 'var(--gold)' : STYLE[SIDE_SLOT[s]].css);
    const say = (html, secs = 2.6) => { S.hint = secs; hud.msg.innerHTML = html; hud.msg.style.display = 'block'; };

    function drawHud(dt) {
      if (!S || !hud) return;
      const run = S.run, R = run.round, r = R && R.r, talking = TF.talking, helping = helpOpen(), shown = S.on && !talking && !helping;
      const inRound = !!r && ['play', 'debrief'].includes(S.phase);
      // the round strip: which round, what the rule is, the five round pips and the combo ribbon
      hud.top.style.display = shown && inRound && S.phase === 'play' ? 'block' : 'none';
      const topKey = [run.i, S.phase, S.combo].join('|');
      if (inRound && topKey !== hud.topKey) {
        hud.topKey = topKey;
        const pips = S.tutorial ? '' : run.spec.rounds.map((x, i) => `<i class="${i < run.logs.length ? 'done' : ''}${i === run.i ? ' cur' : ''}" style="--c:${sideCss(x.side)}"></i>`).join('');
        hud.top.innerHTML = `<div class="k">${S.tutorial ? 'PRACTICE DUCK' : `ROUND ${run.i + 1} OF ${run.spec.rounds.length} · ${esc(sideName(r.side).toUpperCase())}`}</div><div class="t">${S.tutorial ? 'Read it, inspect it, then decide: shoot it or spare it.' : esc(r.kind === 'finale' ? r.banner[1] : r.brief)}</div><div class="pips" aria-hidden="true">${pips}</div><div class="ribbon ${S.combo >= RULES.COMBO ? 'on' : ''}">COMBO × ${S.combo}</div>`;
      }
      // the shared side panel: round, clock, mistakes (missed threats + real cards shot), score, shots and checks left
      ghud.show(shown && inRound);
      if (inRound) {
        const entries = [...R.done.values()], pts = entries.reduce((n, e) => n + (e.points || 0), 0), bad = entries.filter((e) => e.event === 'leak' || e.event === 'friendly').length;
        ghud.update({
          round: S.tutorial ? { n: 1, total: 1, label: 'Practice' } : { n: run.i + 1, total: run.spec.rounds.length, label: 'Round' },
          time: S.tutorial || S.phase !== 'play' ? null : { secs: Math.max(0, r.playSec - S.world.t), countdown: true },
          mistakes: { n: bad }, score: pts,
          extras: [{ label: 'Shots', value: `${R.ammo} left` }, { label: 'Inspections', value: `${run.charges} left` }],
          controls: [['H', 'Help'], ['M', muted() ? 'Unmute' : 'Mute'], ['Esc', 'Leave']],
        });
      }
      if (S.hint > 0) { S.hint -= dt; hud.msg.style.display = S.hint <= 0 || !shown ? 'none' : 'block'; }
      else if (shown && S.phase === 'play' && S.tutorial && !R.done.size && !cardOpen()) { const seen = S.inspectText[r.items[0].uid]; hud.msg.innerHTML = seen ? `Inspected: <b>${esc(seen)}</b> That is proof of fakery, so <b>shoot it</b> (click or <kbd>Space</kbd>). A card you can trace to a real source? Spare it.` : 'Practice duck. Read the card, then hold <kbd>F</kbd> on it to inspect it. It is free here.'; hud.msg.style.display = 'block'; }
      else if (shown && S.phase === 'play' && S.coach && !S.tutorial && run.i < 3 && !cardOpen()) { hud.msg.innerHTML = COACH[run.i]; hud.msg.style.display = 'block'; }
      else hud.msg.style.display = 'none';
      // the reading panel (Tab): every card on screen, in large text, left to right
      hud.read.style.display = shown && S.read && S.phase === 'play' ? 'block' : 'none';
      if (S.read && S.phase === 'play') {
        const vis = world.visibleCards(), key = vis.map((v) => v.uid + (S.inspectText[v.uid] ? '*' : '')).join();
        if (key !== hud.readKey) {
          hud.readKey = key;
          hud.read.innerHTML = '<h5>ON THE SHELVES, LEFT TO RIGHT</h5>' + (vis.length ? vis.map((v) => `<div class="c"><small>${esc(v.text[0])} · ${esc(v.text[1])}</small>${v.card.subject ? `<b>${esc(v.card.subject)}</b> ` : ''}${esc(v.card.body)}${S.inspectText[v.uid] ? `<i>Inspected: ${esc(S.inspectText[v.uid])}</i>` : ''}</div>`).join('') : '<div class="c">Nothing on the shelves right now.</div>');
        }
      }
    }
    const COACH = ['Click or <kbd>Space</kbd> to shoot a threat. Aim for the bullseye: the middle scores most. Let real ones pass.', 'Not sure about a card? Hold <kbd>F</kbd> on it to check it. You get 5 checks a run.', 'Three right calls in a row make a combo.'];
    function showHelp(on) { if (intro) { if (on) intro.open({ help: true }); else intro.close(); } }   // H: the intro card, as help

    // ---- flow ----
    const afterTalk = (fn) => { S.waitTalk = fn; };
    function startRun(quiet) {
      const r = progress.newRun(), spec = E.shorten(E.composeRun(E.seedFor(r.playerId, r.runIndex), r.history));
      S = { on: true, coach: coachSeen < 3, oneLine: coachSeen >= 2, run: createRun(spec), runInfo: r, phase: 'intro', world, briefT: 0, hint: 0, waitTalk: null, read: false, combo: 0, inspectText: {}, landing: {}, rsScore: null, queue: [], murmurT: 0, endT: 0, summary: null };
      emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed });
      if (!quiet && coachSeen === 0) { S.real = S.run; S.tutorial = true; S.run = createRun(Object.assign({}, spec, { rounds: [tutorialRound(spec.rounds[0])] })); }   // the very first visit: a practice duck before the real run (it is never scored or reported)
      if (quiet) { TF.banner('A new row', 'New cards'); beginRound(0); return; }
      const hello = () => { TF.banner('Spot Shot', 'Shoot the threats, spare the real'); TF.talk('Spot Shot', [coachSeen === 0 ? 'Step right up! Press H any time to see how to play.' : 'Back at the stall? Good luck!']); bumpCoach(); afterTalk(() => { hud.brief.style.display = 'none'; beginRound(0); }); };
      if (intro.skipped()) hello(); else intro.open({ onStart: hello });
    }
    function beginRound(i) {
      const run = S.run, R = run.begin(i), r = R.r;
      world.clearRound(); world.loadRound(r); world.run(false); S.combo = 0; S.phase = 'brief'; S.inspectText = {}; S.landing = {}; S.hint = 0; S.read = false; S.endT = 0; hud.topKey = hud.readKey = '';
      if (!S.tutorial) emit('round', { index: i, items: r.items.map((c) => c.itemId) });
      if (S.tutorial) { hud.brief.innerHTML = '<div class="k">PRACTICE DUCK</div><div class="t">One slow duck. Read it, inspect it, decide.</div><div class="m">No timer and nothing is scored.</div><p class="go"><kbd>Enter</kbd> Start ▼</p>'; hud.brief.style.display = 'block'; S.briefT = 8; return; }
      if (r.kind === 'finale') { TF.banner(r.banner[0], r.banner[1]); hud.brief.style.display = 'none'; S.briefT = 3; return; }
      hud.brief.innerHTML = `<div class="k">ROUND ${i + 1} OF ${run.spec.rounds.length} · ${esc(sideName(r.side).toUpperCase())}</div><div class="t">${esc(r.brief)}</div>${S.oneLine ? '' : `<div class="m">${R.ammoStart} shots this round · ${run.charges} inspection${run.charges === 1 ? '' : 's'} left</div>`}<p class="go"><kbd>Enter</kbd> Start ▼</p>`;
      hud.brief.style.display = 'block'; S.briefT = 8;
    }
    function startPlay() {
      if (!S || S.phase !== 'brief') return;
      hud.brief.style.display = 'none'; S.phase = 'play'; S.murmurT = 0; sfx('chime'); world.run(true);
    }
    // ---- the world's events ----
    function onShoot(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.run.shoot(ev.uid, world.t, ev); if (res.kind === 'miss') { S.landing.miss = true; world.marker('miss'); say('Missed: no card under the reticle.', 1.4); return; }
      if (res.kind !== 'hit') return;
      const e = res.entry; S.landing[e.uid] = e; S.combo = S.run.round.combo;
      world.resolve(e.uid, 'shot', { stamp: e.stamp, tone: e.shoot ? 'threat' : 'rueful', reason: e.reason }); world.marker(e.shoot ? 'good' : 'bad'); sfx('hit');
      if (!e.shoot) { world.flash('bad'); say(`That one was real: <b>${cardName(e)}</b>. ${esc(e.reason)}`, 3.2); } else world.flash('good');
      if (e.points) { say(`<b>+${e.points}</b> ${esc(e.ring)} · ${esc(e.reason)}`, 2.6); if (e.points >= 100) { world.slowmo(0.4); sfx('combo'); } }
      if (res.ribbon) { sfx('combo'); say(`<b>COMBO × ${S.combo}</b>`, 1.6); }
    }
    function onLand(ev) {
      if (!S || S.phase !== 'play') return;
      const e = ev.uid && S.landing[ev.uid]; if (!e) { sfx('thunk'); return; }
      if (e.shoot) { sfx('pop'); sfx('stamp'); world.ring(); } else { sfx('friendly'); sfx('stamp'); }
    }
    function onPass(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.run.pass(ev.uid, world.t); if (!res) return;
      const e = res.entry, c = world.state.cards.get(ev.uid), lane = c ? c.e.lane : 0; S.combo = S.run.round.combo;
      if (res.kind === 'leak') { world.flash('bad'); world.resolve(ev.uid, 'leaked', { stamp: 'SLIPPED THROUGH', tone: 'leak', reason: e.reason }); world.gate(lane, 'leak'); world.cameraShake(0.3, 0.04); sfx('leak'); say(`<b>${cardName(e)}</b> slipped through. ${esc(e.reason)}`, 3.4); }
      else { world.resolve(ev.uid, 'delivered', { tone: 'ok' }); world.note(ev.uid, `Spared: ${e.reason}`, 'ok'); world.gate(lane, 'ok'); sfx('ding'); }
      if (res.ribbon) { sfx('combo'); say(`<b>COMBO × ${S.combo}</b>`, 1.6); }
    }
    function onInspect(ev) {
      if (!S || S.phase !== 'play') return;
      const r = S.run.inspect(ev.uid, world.t); if (!r) return;
      S.inspectText[ev.uid] = r.text; world.showInspect(ev.uid, r.text); sfx('scan'); emit('inspect', { uid: ev.uid, charges: r.charges });
    }
    function onDry() { if (S && S.phase === 'play' && S.run.round && S.run.round.ammo <= 0) { S.run.round.dry++; sfx('dry'); say('Out of shots: let the rest pass.', 1.8); } }

    // ---- the debrief: the round's numbers, then up to 3 Concept Cards (E to continue) ----
    // the round's mistakes, each with its reason: threats that slipped through, honest cards that were shot
    function recap(entries) {
      const bad = entries.filter((e) => e.event === 'leak' || e.event === 'friendly'), x = `<span style="color:${STYLE[3].css}">✗</span>`;
      if (!bad.length) return '<div class="rc">Every threat stopped and every honest card spared.</div>';
      return bad.slice(0, 4).map((e) => `<div class="rc">${x} ${e.event === 'leak' ? 'Missed' : 'Shot an honest card'}: <b>${cardName(e)}</b>. ${esc(e.reason)}</div>`).join('') + (bad.length > 4 ? `<div class="rc">…and ${bad.length - 4} more.</div>` : '');
    }
    // the round's summary card: a header pill, six stat tiles (a ring for threats stopped), a one-line verdict, the mistakes as rows, the two keys as buttons
    function roundHTML(i, name, sc, entries, cards) {
      const pct = Math.round(100 * sc.catchRate), acc = sc.accuracy == null ? '–' : Math.round(100 * sc.accuracy) + '%';
      const tile = (v, label, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${label}</span></div>`;
      const tiles = `<div class="tile"><div class="ring" style="--p:${pct}"><i>${pct}%</i></div><span>${sc.stopped} of ${sc.threats} stopped</span></div>`
        + tile(acc, 'accuracy', sc.accuracy == null ? '' : sc.accuracy >= .8 ? 'good' : sc.accuracy < .6 ? 'bad' : '')
        + tile(sc.leaks, 'missed', sc.leaks ? 'bad' : 'good') + tile(sc.friendly, 'real cards hit', sc.friendly ? 'bad' : 'good')
        + tile(sc.ammoLeft, 'shots left') + tile(sc.points || 0, 'points', 'gold');
      const bad = entries.filter((e) => e.event === 'leak' || e.event === 'friendly');
      const rows = bad.length ? bad.slice(0, 4).map((e) => `<div class="mi"><span class="tag">${e.event === 'leak' ? 'Missed' : 'Real card hit'}</span><b>${cardName(e)}</b><span class="why">${esc(e.reason)}</span></div>`).join('')
        + (bad.length > 4 ? `<div class="mi ok" style="background:none;box-shadow:none"><span class="why">…and ${bad.length - 4} more.</span></div>` : '')
        : '<div class="mi ok"><span class="tag">Clean</span><span class="why">Every threat stopped and every honest card spared.</span></div>';
      const verdict = tradeoff(sc).split('. ')[0].replace(/\.?$/, '.');
      return `<div class="hd"><span class="pill">ROUND ${i + 1}</span><span class="nm">${esc(name)}</span></div><div class="tiles">${tiles}</div><p class="verdict">${esc(verdict)}</p><div class="mis">${rows}</div>`
        + `<div class="acts"><span class="b"><kbd>Enter</kbd>${cards ? 'Concept cards' : 'Next round'}</span><span class="b ghost"><kbd>Esc</kbd>Skip</span></div>`;
    }
    function endRound() {
      if (S.tutorial) return endPractice();
      const run = S.run, log = run.finishRound(world.t), sc = E.scoreRound(log);
      for (const e of log.entries) emit('answer', { credit: true, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, shoot: e.shoot, action: e.action, correct: e.correct, lucky: e.lucky, inspected: e.inspected });
      S.phase = 'debrief'; S.rsScore = sc; S.queue = E.debriefPicks(log, 2); S.queueN = S.queue.length; world.run(false); S.read = false;
      const name = sideName(log.side);
      hud.rs.innerHTML = roundHTML(run.i, name, sc, log.entries, S.queue.length); hud.rs.classList.add('sum'); hud.rs.style.display = 'block';
      sfx('chime'); TF.sys(`Round ${run.i + 1}: stopped ${sc.stopped} of ${sc.threats} threats, accuracy ${sc.accuracy == null ? '–' : Math.round(100 * sc.accuracy) + '%'}.`);
    }
    // the practice duck is done: the worked example, then the real run
    function endPractice() {
      const R = S.run.round, it = R.r.items[0], e = R.done.get(it.uid), said = !e ? '' : e.event === 'stopped' ? 'You shot it: the right call.' : 'You let it through, but it was a fake.';
      S.phase = 'lesson'; world.run(false); S.read = false;
      hud.rs.classList.remove('sum'); hud.rs.innerHTML = `<h5>WORKED EXAMPLE</h5>The card said: “${esc(it.card.body)}” (${esc(it.card.from)}).<br>Checking it showed: <b>${esc(it.inspect)}</b><br>${said} ${esc(it.tell)}<br>Had the check shown a real source you can open, you would spare it, even if a detector score looked scary.<div class="go"><kbd>Enter</kbd> Start round 1 ▼</div>`; hud.rs.style.display = 'block'; sfx('chime');
    }
    function endLesson() {
      hud.rs.style.display = 'none'; S.run = S.real; S.tutorial = false; world.clearRound(); beginRound(0);
    }
    function nextCard() {
      if (!S || S.phase !== 'debrief') return;
      const e = S.queue.shift();
      if (!e) { hud.rs.style.display = 'none'; const run = S.run; if (run.i >= run.spec.rounds.length - 1) finish(); else beginRound(run.i + 1); return; }
      const d = describe(e, C.byId[e.conceptId].idea); d.hint = S.queue.length ? 'Next card' : 'Continue';
      bridge.card.show(d);
    }
    function closeCard() {
      if (!S) return;
      if (S.phase === 'brief') { startPlay(); return; }
      if (S.phase === 'lesson') { endLesson(); return; }
      if (S.phase !== 'debrief') return;
      if (cardOpen()) bridge.card.hide();
      nextCard();
    }
    function finish() {
      const run = S.run, sum = run.score(true);
      Object.assign(sum, { seed: run.spec.seed, playerId: S.runInfo.playerId, runIndex: S.runInfo.runIndex, timeMs: Math.round(run.elapsed * 1000), why: 'done',
        clean: Object.fromEntries(Object.entries(sum.perConcept).map(([id, c]) => [id, c.cleanVariants])) });
      S.phase = 'done'; S.summary = sum; world.clearRound(); hud.rs.style.display = 'none'; sfx('chime');
      TF.banner('Row cleared', `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`);
      emit('finish', sum);
      if (play.debrief) play.debrief(sum);
      else { TF.talk('Spot Shot', [`${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} Catch rate ${Math.round(100 * sum.catchRate)}%, accuracy ${sum.accuracy == null ? '–' : Math.round(100 * sum.accuracy) + '%'}.`, tradeoff(sum)]); afterTalk(() => leave()); }
    }
    play.closeDebrief = () => { if (!S || S.phase !== 'done') return; leave(); };
    function leave() {
      if (!S) return;
      if (S.run && S.phase !== 'done' && !S.tutorial) {   // cards of finished rounds were credited as they went; the ones settled in the round left behind are kept as partial attempts
        for (const e of S.run.partial()) emit('answer', { credit: false, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, shoot: e.shoot, action: e.action, correct: e.correct, lucky: e.lucky, inspected: e.inspected });
        const part = S.run.score(false); emit('abandon', { rounds: S.run.logs.length, leaks: part.leaks, friendly: part.friendly, timeMs: Math.round(S.run.elapsed * 1000) });
      }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); if (ghud) ghud.show(false); S.on = false;
      if (play.modal && play.modal.open()) { play.modal.hide && play.modal.hide(); }
      const s = S; S = null;
      if (hud) for (const k of ['top', 'msg', 'brief', 'rs', 'read']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('gallery-on'); world.run(false); world.leave();
      return s;
    }

    // ---- input ----
    function onKey(e) {
      if (!S || !S.on) return false;
      const a = audio(); if (a && a.init) a.init();
      if (ghud && ghud.handleKey(e)) return true;
      if (intro && intro.handleKey(e)) { if (e.code === 'KeyM' && !e.repeat) a && a.toggle(); return true; }
      if (play.modal && play.modal.open()) { if (['KeyE', 'Escape', 'Enter'].includes(e.code) && !e.repeat) play.modal.close(); else if (play.modal.key) play.modal.key(e); return true; }
      { const code = e.code === 'Enter' ? 'KeyE' : e.code === 'Escape' && S.phase === 'debrief' && !helpOpen() ? 'KeyS' : e.code; if (code !== e.code) e = { code, key: e.key, repeat: e.repeat, shiftKey: e.shiftKey, preventDefault() {}, stopPropagation() {} }; }   // Enter works as E; Esc skips like S while the round's cards are up (otherwise it leaves)
      if (e.code === 'Escape' && !e.repeat) { ghud.confirmLeave(leave); return true; }
      if (e.code === 'KeyM' && !e.repeat) { a && a.toggle(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { showHelp(!helpOpen()); return true; }
      if (e.code === 'KeyE' && !e.repeat) { if (helpOpen()) showHelp(false); else if (!TF.talking) closeCard(); return true; }
      if (e.code === 'KeyS' && !e.repeat && S.phase === 'debrief' && !helpOpen()) { S.queue.length = 0; if (cardOpen()) bridge.card.hide(); nextCard(); return true; }
      if (e.code === 'Tab') { if (!e.repeat && S.phase === 'play') S.read = !S.read; return true; }
      if (cardOpen() || helpOpen() || ghud.confirmOpen() || TF.talking || S.phase !== 'play') return true;   // the card has the keys
      return world.keys.onKey(e) || true;   // the world takes the arrows, Space and F; everything else is swallowed: no walking, no stray jumps, no camera switch
    }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      const paused = S.phase !== 'play' || TF.talking || cardOpen() || helpOpen() || ghud.confirmOpen() || document.hidden;
      if (S.phase === 'play') { world.run(!paused); if (!paused) S.run.elapsed += dt; }
      if (S.phase === 'brief' && !TF.talking && !helpOpen() && !ghud.confirmOpen() && !document.hidden) { S.briefT -= dt; if (S.briefT <= 0) startPlay(); }
      if (S.phase === 'play' && !paused) {
        S.murmurT -= dt; if (S.murmurT <= 0) { S.murmurT = 1.5 + Math.random() * 0.8; sfx('murmur'); }
        const R = S.run.round, r = R.r;
        if (world.t >= r.playSec + 0.3 && R.done.size >= r.items.length) { S.endT += dt; if (S.endT > 0.9) { endRound(); return; } }
        else if (world.t > r.playSec + 4) { endRound(); return; }
      }
      drawHud(dt);
    }

    // ---- entry ----
    play.open = () => {
      hud = hud || makeHud(); ghud = ghud || window.GameHUD.create(); ghud.reset(); intro = intro || window.IntroScreen.create(C.INTRO);
      return world.enter(() => { document.getElementById('ui').classList.add('gallery-on'); startRun(false); });
    };
    play.register = function () {
      world.open = play.open;
      world.canShoot = () => !!(S && S.on && S.phase === 'play' && !TF.talking && !cardOpen() && !helpOpen() && !ghud.confirmOpen() && !document.hidden && S.run.canShoot());   // refused: the world emits 'dry'
      world.canInspect = () => !!(S && S.on && S.phase === 'play' && S.run.canInspect());
      TF.life.push((t, dt) => frame(t, dt));
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on ? onKey(e) : prev ? prev(e) : false);
      world.on('shoot', onShoot); world.on('land', onLand); world.on('pass', onPass); world.on('inspect', onInspect); world.on('dry', onDry); world.on('bell', () => sfx('bell')); world.on('exit', () => leave());
    };
    Object.assign(play, { leave, closeCard, onKey });
    Object.defineProperties(play, { state: { get: () => S }, hud: { get: () => hud } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.stall, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.galleryPlay = play;
    return play;
  }
  return { RULES, TRADE, PRACTICE_SECS, createRun, tutorialRound, describe, tradeoff, roundLine, create, install };
});
