// Spot Shot — gameplay. Browser: window.GalleryPlay. Node: require('./gallery-play.js') (the pure rules).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run     the rules of a run: tokens (threats + 2 a round), the five magnifier charges, judging every card, the combo, the round logs, the score
//   describe(entry, idea)      the debrief Concept Card for one card: what you did, the tell, the idea
//   tradeoff(score)            the one-line trade-off: shooting everything tanks accuracy, shooting nothing tanks catch rate
// Browser:
//   install(TF)                builds the HUD and the game on gallery-world.js, takes over the stall's E (TF.stall.open) and the keys
//
// THE GAME
//  A carnival stall on the south lawn. Five rounds: the four sides in a seeded order, then the finale "Rush hour". Each round: a brief (about 8 s, E starts it), about 40 s of play,
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
    run.shoot = (uid, t) => {
      const R = run.round; if (!R || R.closed) return { kind: 'none' };
      if (R.ammo <= 0) { R.dry++; return { kind: 'dry' }; }
      R.ammo--; const hit = uid && R.byUid[uid] && !R.done.has(uid) ? uid : null; R.shots.push({ t, uid: hit });
      if (!hit) return { kind: 'miss', ammo: R.ammo };
      const entry = E.entryFor(R.byUid[hit], 'shot', R.inspected.has(hit), t), ribbon = settle(R, entry);
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
  const roundLine = (s) => `Stopped ${s.stopped} of ${s.threats} threats (${Math.round(100 * s.catchRate)}%) · accuracy ${s.accuracy == null ? '–' : Math.round(100 * s.accuracy) + '%'} · ${s.leaks} slipped through · ${s.friendly} real shot · ${s.ammoLeft} tokens left`;

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
    let S = null, hud = null;
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
      else if (name === 'dry') a.tone(700, 0.04, 'square', 0.03);
      else if (name === 'combo') { a.tone(659, 0.1, 'triangle', 0.07); a.tone(784, 0.1, 'triangle', 0.07, 0.08); a.tone(1047, 0.25, 'triangle', 0.07, 0.16); }
      else if (name === 'murmur') { const f = 130 + Math.random() * 90; a.tone(f, 0.9, 'triangle', 0.012); a.tone(f * 1.26, 0.8, 'triangle', 0.008, 0.2); a.noise(0.7, 0.012, 300); }
      else a.play(name);
    }

    // ---- HUD: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text. A round strip, a status block with gems, a hint line, the brief, the round result, the reading panel ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .gp-top { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 640px)); padding: 6px 14px 8px; text-align: center; display: none; background: rgba(10,12,20,.95); border-color: var(--gold); }
        .gp-top .k { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .gp-top .t { font-size: clamp(16px, 1.5vw, 20px); line-height: 1.25; margin: 2px 0 4px; color: var(--ink); }
        .gp-top .pips { display: flex; gap: 4px; justify-content: center; } .gp-top .pips i { width: 26px; height: 7px; border: 1px solid rgba(243,234,214,.45); }
        .gp-top .pips i.done { border-color: transparent; background: var(--c); } .gp-top .pips i.cur { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .gp-top .ribbon { display: none; margin-top: 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .2em; color: var(--gold); } .gp-top .ribbon.on { display: block; }
        .gp-stat { position: absolute; top: 214px; right: 18px; text-align: right; padding: 7px 12px; font-size: 14px; line-height: 1.75; display: none; min-width: 190px; }
        .gp-stat .clock { font-family: 'Cinzel', serif; font-size: 22px; letter-spacing: .08em; } .gp-stat .clock.low { color: var(--hot); } .gp-stat b { color: var(--gold); font-weight: 600; }
        .gp-stat .gems { display: inline-flex; gap: 6px; vertical-align: middle; flex-wrap: wrap; justify-content: flex-end; max-width: 130px; }
        .gp-gem { width: 9px; height: 9px; background: var(--c); transform: rotate(45deg); box-shadow: 0 0 8px var(--c); } .gp-gem.off { background: transparent; box-shadow: none; border: 1px solid rgba(243,234,214,.35); }
        .gp-stat kbd, .gp-msg kbd, .gp-brief kbd, .gp-help kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .gp-msg { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); max-width: min(620px, calc(100vw - 420px)); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.3; background: rgba(10,12,20,.93); }
        .gp-brief { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; text-align: center; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .gp-brief .k { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: .16em; color: var(--gold); } .gp-brief .t { font-size: 24px; margin: 8px 0; line-height: 1.25; } .gp-brief .m { font-size: 15px; opacity: .85; } .gp-brief .go { margin: 10px 0 0; font-size: 14px; color: var(--gold); text-align: right; }
        .gp-rs { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 32px)); padding: 8px 16px 9px; text-align: center; display: none; font-size: 16px; line-height: 1.4; background: rgba(10,12,20,.96); border-color: var(--gold); }
        .gp-rs h5 { margin: 0 0 3px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); } .gp-rs .go { color: var(--gold); font-size: 14px; margin-top: 3px; }
        .gp-read { position: absolute; left: 18px; top: 90px; width: min(380px, calc(100vw - 36px)); max-height: calc(100vh - 220px); overflow-y: auto; padding: 8px 12px 10px; display: none; font-size: 20px; line-height: 1.3; background: rgba(10,12,20,.96); pointer-events: auto; }
        .gp-read h5 { margin: 0 0 6px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); } .gp-read div.c { margin: 0 0 9px; padding-left: 8px; border-left: 3px solid var(--gold); }
        .gp-read small { display: block; font-size: 14px; letter-spacing: .04em; color: var(--gold); } .gp-read i { display: block; font-style: normal; font-size: 16px; opacity: .85; margin-top: 2px; }
        .gp-help { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .gp-help h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); } .gp-help ul { margin: 0; padding-left: 20px; } .gp-help li { margin: 5px 0; } .gp-help .go { text-align: right; font-size: 14px; color: var(--gold); margin: 10px 0 0; }
        @media (max-width: 1100px) { .gp-top { left: 18px; transform: none; width: calc(100vw - 280px); top: 70px; } .gp-stat { top: auto; bottom: 80px; left: 18px; right: auto; text-align: left; } .gp-stat .gems { justify-content: flex-start; } }   /* the strip clears the party list; the status block sits over the counter, not the shelves */
        .gallery-on .gp-top, .gallery-on .gp-stat, .gallery-on .gp-msg, .gallery-on .gp-brief, .gallery-on .gp-rs, .gallery-on .gp-read, .gallery-on .gs-read, .gallery-on .gs-tag { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .gallery-on #chat, .gallery-on #help { display: none; }   /* the chat log and key hints sit over the stall; the stall has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      const h = { style, top: mk('gp-top'), stat: mk('gp-stat'), msg: mk('gp-msg'), brief: mk('gp-brief'), rs: mk('gp-rs'), read: mk('gp-read'), help: mk('gp-help'), topKey: '', statKey: '', readKey: '' };
      h.stat.style.setProperty('--hot', STYLE[3].css);
      return h;
    }
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open);
    const helpOpen = () => !!hud && hud.help.style.display === 'block';
    const sideName = (s) => C.SIDES[s].name;
    const sideCss = (s) => (s === 'rush' ? 'var(--gold)' : STYLE[SIDE_SLOT[s]].css);
    const say = (html, secs = 2.6) => { S.hint = secs; hud.msg.innerHTML = html; hud.msg.style.display = 'block'; };
    const gems = (n, total, color) => Array.from({ length: Math.max(n, total) }, (_, i) => `<i class="gp-gem ${i < n ? '' : 'off'}" style="--c:${color}"></i>`).join('');
    const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

    function drawHud(dt) {
      if (!S || !hud) return;
      const run = S.run, R = run.round, r = R && R.r, talking = TF.talking, helping = helpOpen(), shown = S.on && !talking && !helping;
      const inRound = !!r && ['play', 'debrief'].includes(S.phase);
      // the round strip: which round, what the rule is, the five round pips and the combo ribbon
      hud.top.style.display = shown && inRound && S.phase === 'play' ? 'block' : 'none';
      const topKey = [run.i, S.phase, S.combo].join('|');
      if (inRound && topKey !== hud.topKey) {
        hud.topKey = topKey;
        const pips = run.spec.rounds.map((x, i) => `<i class="${i < run.logs.length ? 'done' : ''}${i === run.i ? ' cur' : ''}" style="--c:${sideCss(x.side)}"></i>`).join('');
        hud.top.innerHTML = `<div class="k">ROUND ${run.i + 1} OF ${run.spec.rounds.length} · ${esc(sideName(r.side).toUpperCase())}</div><div class="t">${esc(r.kind === 'finale' ? r.banner[1] : r.brief)}</div><div class="pips" aria-hidden="true">${pips}</div><div class="ribbon ${S.combo >= RULES.COMBO ? 'on' : ''}">COMBO × ${S.combo}</div>`;
      }
      // the status block: the round clock and the gems (tokens left, leaks, friendly fire, magnifier charges)
      hud.stat.style.display = shown && inRound ? 'block' : 'none';
      if (inRound) {
        const left = Math.max(0, Math.ceil(r.playSec - S.world.t)), sc = S.phase === 'debrief' ? S.rsScore : null, entries = [...R.done.values()];
        const leaks = entries.filter((e) => e.event === 'leak').length, fr = entries.filter((e) => e.event === 'friendly').length;
        const key = [left, R.ammo, leaks, fr, run.charges, S.phase, muted(), !!sc].join('|');
        if (key !== hud.statKey) {
          hud.statKey = key;
          hud.stat.innerHTML = `<div class="clock ${left <= 8 && S.phase === 'play' ? 'low' : ''}">${S.phase === 'play' ? clock(left) : 'DONE'}</div>Tokens <span class="gems">${gems(R.ammo, R.ammoStart, 'var(--gold)')}</span><br>Slipped through <span class="gems">${gems(leaks, 0, STYLE[3].css)}</span><br>Friendly fire <span class="gems">${gems(fr, 0, STYLE[0].css)}</span><br>Magnifier <span class="gems">${gems(run.charges, RULES.MAGNIFIER, STYLE[2].css)}</span><br><kbd>H</kbd> help · <kbd>Tab</kbd> read · <kbd>M</kbd> ${muted() ? 'off' : 'on'} · <kbd>Esc</kbd> leave`;
        }
      }
      if (S.hint > 0) { S.hint -= dt; hud.msg.style.display = S.hint <= 0 || !shown ? 'none' : 'block'; }
      else if (shown && S.phase === 'play' && coachSeen < 3 && !cardOpen()) { hud.msg.innerHTML = 'Click or <kbd>Space</kbd> shoots a threat. Spare the real ones: let them pass. Hold <kbd>F</kbd> (or the right button) on a card to inspect it.'; hud.msg.style.display = 'block'; }
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
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.help.innerHTML = '<h3>SPOT SHOT</h3><ul><li>Paper cards slide along three shelves towards the ticket windows. <b>Shoot the threats</b> (fakes, scams, poisoned inputs) with a click, a tap or <kbd>Space</kbd>; <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move the reticle.</li><li><b>Spare the real ones:</b> let them pass and they are delivered. Shooting a real card is friendly fire. A threat that reaches the window is a leak.</li><li>Each round gives threats + 2 tokens, and a shot that hits nothing still costs one. <b>Inspect</b> a card (hold <kbd>F</kbd>, the right button or a long press, about 0.6 s) to read its verification line: five magnifier charges for the whole run.</li><li>Some cards are traps: they look the wrong way round. A right call on a trap you did not inspect is a lucky shot and never counts towards mastery.</li><li><kbd>Tab</kbd> lists the cards in big text. <kbd>M</kbd> sound. <kbd>E</kbd> continues. <kbd>Esc</kbd> leaves (finished rounds are kept).</li></ul><p class="go"><kbd>H</kbd> or <kbd>E</kbd> to close</p>';
      hud.help.style.display = on ? 'block' : 'none';
    }

    // ---- flow ----
    const afterTalk = (fn) => { S.waitTalk = fn; };
    function startRun(quiet) {
      const r = progress.newRun(), spec = E.composeRun(E.seedFor(r.playerId, r.runIndex), r.history);
      S = { on: true, run: createRun(spec), runInfo: r, phase: 'intro', world, briefT: 0, hint: 0, waitTalk: null, read: false, combo: 0, inspectText: {}, landing: {}, rsScore: null, queue: [], murmurT: 0, endT: 0, summary: null };
      emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed });
      if (quiet) { TF.banner('A new row', 'New cards'); beginRound(0); return; }
      TF.banner('Spot Shot', 'Shoot the threats, spare the real');
      TF.talk('Spot Shot', coachSeen === 0
        ? ['Step right up! Five rounds at the Spot Shot stall, one token popper.', 'Shoot the fakes, scams and poisoned inputs. Spare the real ones: just let them pass. Not sure? Hold F on a card to inspect it. You get five magnifier charges for the whole run.', 'Click or press Space to shoot, arrow keys move the reticle. Tab lists the cards in big text. M mutes. Esc leaves.']
        : ['Back at the stall? Same rules: shoot the threats, spare the real, inspect when it matters.']);
      afterTalk(() => beginRound(0));
    }
    function beginRound(i) {
      const run = S.run, R = run.begin(i), r = R.r;
      world.clearRound(); world.loadRound(r); world.run(false); S.combo = 0; S.phase = 'brief'; S.inspectText = {}; S.landing = {}; S.hint = 0; S.read = false; S.endT = 0; hud.topKey = hud.statKey = hud.readKey = '';
      emit('round', { index: i, items: r.items.map((c) => c.itemId) });
      if (r.kind === 'finale') { TF.banner(r.banner[0], r.banner[1]); hud.brief.style.display = 'none'; S.briefT = 3; return; }
      hud.brief.innerHTML = `<div class="k">ROUND ${i + 1} OF ${run.spec.rounds.length} · ${esc(sideName(r.side).toUpperCase())}</div><div class="t">${esc(r.brief)}</div><div class="m">${R.ammoStart} tokens this round · ${run.charges} magnifier charge${run.charges === 1 ? '' : 's'} left</div><p class="go"><kbd>E</kbd> Start ▼</p>`;
      hud.brief.style.display = 'block'; S.briefT = 8;
    }
    function startPlay() {
      if (!S || S.phase !== 'brief') return;
      hud.brief.style.display = 'none'; S.phase = 'play'; S.murmurT = 0; sfx('chime'); world.run(true);
    }
    // ---- the world's events ----
    function onShoot(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.run.shoot(ev.uid, world.t); if (res.kind === 'miss') { S.landing.miss = true; return; }
      if (res.kind !== 'hit') return;
      const e = res.entry; S.landing[e.uid] = e; S.combo = S.run.round.combo;
      world.resolve(e.uid, 'shot', { stamp: e.stamp, tone: e.shoot ? 'threat' : 'rueful' });
      if (!e.shoot) say(`That one was real. <b>${esc(e.stamp)}</b>: friendly fire.`);
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
      if (res.kind === 'leak') { world.resolve(ev.uid, 'leaked', { stamp: 'SLIPPED THROUGH', tone: 'leak' }); world.gate(lane, 'leak'); world.cameraShake(0.3, 0.04); sfx('leak'); say('A threat slipped through.', 1.8); }
      else { world.resolve(ev.uid, 'delivered', { tone: 'ok' }); world.gate(lane, 'ok'); sfx('ding'); }
      if (res.ribbon) { sfx('combo'); say(`<b>COMBO × ${S.combo}</b>`, 1.6); }
    }
    function onInspect(ev) {
      if (!S || S.phase !== 'play') return;
      const r = S.run.inspect(ev.uid, world.t); if (!r) return;
      S.inspectText[ev.uid] = r.text; world.showInspect(ev.uid, r.text); sfx('scan'); emit('inspect', { uid: ev.uid, charges: r.charges });
    }
    function onDry() { if (S && S.phase === 'play' && S.run.round && S.run.round.ammo <= 0) { S.run.round.dry++; sfx('dry'); say('Out of tokens: let the rest pass.', 1.8); } }

    // ---- the debrief: the round's numbers, then up to 3 Concept Cards (E to continue) ----
    function endRound() {
      const run = S.run, log = run.finishRound(world.t), sc = E.scoreRound(log);
      for (const e of log.entries) emit('answer', { credit: true, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, shoot: e.shoot, action: e.action, correct: e.correct, lucky: e.lucky, inspected: e.inspected });
      S.phase = 'debrief'; S.rsScore = sc; S.queue = E.debriefPicks(log, 3); S.queueN = S.queue.length; world.run(false); S.read = false; hud.statKey = '';
      const name = sideName(log.side);
      hud.rs.innerHTML = `<h5>ROUND ${run.i + 1} · ${esc(name.toUpperCase())}</h5>${esc(roundLine(sc))}<div class="go"><kbd>E</kbd> ${S.queue.length ? 'Concept cards' : 'Next'} ▼</div>`; hud.rs.style.display = 'block';
      sfx('chime'); TF.sys(`Round ${run.i + 1}: stopped ${sc.stopped} of ${sc.threats} threats, accuracy ${sc.accuracy == null ? '–' : Math.round(100 * sc.accuracy) + '%'}.`);
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
      if (S.run && S.phase !== 'done') {   // cards of finished rounds were credited as they went; the ones settled in the round left behind are kept as partial attempts
        for (const e of S.run.partial()) emit('answer', { credit: false, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, shoot: e.shoot, action: e.action, correct: e.correct, lucky: e.lucky, inspected: e.inspected });
        const part = S.run.score(false); emit('abandon', { rounds: S.run.logs.length, leaks: part.leaks, friendly: part.friendly, timeMs: Math.round(S.run.elapsed * 1000) });
      }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); S.on = false;
      if (play.modal && play.modal.open()) { play.modal.hide && play.modal.hide(); }
      const s = S; S = null;
      if (hud) for (const k of ['top', 'stat', 'msg', 'brief', 'rs', 'read', 'help']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('gallery-on'); world.run(false); world.leave();
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
      if (e.code === 'KeyE' && !e.repeat) { if (helpOpen()) showHelp(false); else if (!TF.talking) closeCard(); return true; }
      if (e.code === 'Tab') { if (!e.repeat && S.phase === 'play') S.read = !S.read; return true; }
      if (cardOpen() || helpOpen() || TF.talking || S.phase !== 'play') return true;   // the card has the keys
      if (e.code === 'Space') bumpCoach();
      return world.keys.onKey(e) || true;   // the world takes the arrows, Space and F; everything else is swallowed: no walking, no stray jumps, no camera switch
    }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      const paused = S.phase !== 'play' || TF.talking || cardOpen() || helpOpen() || document.hidden;
      if (S.phase === 'play') { world.run(!paused); if (!paused) S.run.elapsed += dt; }
      if (S.phase === 'brief' && !TF.talking && !helpOpen() && !document.hidden) { S.briefT -= dt; if (S.briefT <= 0) startPlay(); }
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
      hud = hud || makeHud();
      return world.enter(() => { document.getElementById('ui').classList.add('gallery-on'); startRun(false); });
    };
    play.register = function () {
      world.open = play.open;
      world.canShoot = () => !!(S && S.on && S.phase === 'play' && !TF.talking && !cardOpen() && !helpOpen() && !document.hidden && S.run.canShoot());   // refused: the world emits 'dry'
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
  return { RULES, TRADE, createRun, describe, tradeoff, roundLine, create, install };
});
