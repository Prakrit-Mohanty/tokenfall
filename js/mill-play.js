// Token Mill — gameplay. Browser: window.MillPlay. Node: require('./mill-play.js') (the pure rules).
//
// Pure (tested in Node, no DOM):
//   createRun(spec) -> run     the rules of a run: routing a crate to a bin, the REVIEW EACH desk, crates that reach the pit, the combo, the shift logs, the score
//   describe(entry, idea, cap) the debrief Concept Card for one crate: what you sent where, why it belongs where it does, the idea
//   tradeoff(score)            the one-line trade-off: over-locking costs capacity, under-locking costs incidents
// Browser:
//   install(TF)                builds the HUD and the game on mill-world.js, takes over the Control Desk's E (TF.mill.open) and the keys
//
// THE GAME
//  A conveyor belt in the Data Archive. Five shifts: the four sides in a seeded order, then the finale "Rush hour" (four waves, the bin plates flip between them). Each shift: a brief
//  (the SAMPLE house policy and the four bins), about 40 s of belt, a debrief of up to 3 Concept Cards (E to continue). Crates ride past four bins; route each one to the bin the policy says
//  (drag it onto a bin, click it then click a bin, or Tab to select and 1-4). Hold Space to brake (3 s a shift). A crate that reaches the pit is dropped.
//  The ladder: bins run from the most permissive (1) to the strictest (4). A lower bin than the right one is TOO LAX (a gap of 2 or more is a SPILL); a higher one is TOO STRICT. After the 6th
//  crate sent to REVIEW EACH in a shift the desk is jammed. Stars: 3 = accuracy at least 85%, no spills, at most 2 dropped; 2 = accuracy at least 65% and at most 2 spills; 1 = finished.
//  Esc leaves; the crates already settled are kept as partial attempts.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./mill-engine.js') : root.MillEngine, isNode ? require('./mill-content.js') : root.MILL_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.MillPlay = api;
})(this, function (E, C, CW) {
  const { RUN, SIDES } = C;
  const RULES = { COMBO: 4, SHIFTS: RUN.shifts };
  const TRADE = 'Over-locking costs capacity; under-locking costs incidents.';

  // ================================================================ pure
  function createRun(spec) {
    const run = { spec, i: -1, logs: [], shift: null, elapsed: 0 };
    run.begin = (i) => {
      const sh = spec.shifts[i]; run.i = i;
      run.shift = { sh, entries: new Map(), routes: [], reviewCount: 0, combo: 0, bestCombo: 0, closed: false, byUid: Object.fromEntries(sh.crates.map((c) => [c.uid, c])), t0Of: Object.fromEntries(sh.schedule.map((e) => [e.uid, e.t0])) };
      return run.shift;
    };
    const settle = (R, entry) => { R.entries.set(entry.uid, entry); R.combo = entry.correct ? R.combo + 1 : 0; R.bestCombo = Math.max(R.bestCombo, R.combo); return entry.correct && R.combo % RULES.COMBO === 0; };   // the ribbon: 4 right in a row
    // a crate may be routed while it is in the sorting zone (at belt time bt) and not yet settled
    run.canRoute = (uid, bt) => { const R = run.shift; return !!R && !R.closed && !!R.byUid[uid] && !R.entries.has(uid) && E.inZone(R.t0Of[uid], bt); };
    // binIdx 0..3 = the plate's position, rank 0 (most permissive) .. 3; the crate's own side decides what that bin is
    run.route = (uid, binIdx, t, bt) => {
      const R = run.shift; if (!run.canRoute(uid, bt) || !(binIdx >= 0 && binIdx < 4)) return null;
      const c = R.byUid[uid], binId = SIDES[c.side].bins[binIdx].id;
      if (binId === 'review') R.reviewCount++;
      const jammed = binId === 'review' && R.reviewCount > R.sh.desk, entry = E.entryFor(c, binId, t, jammed), ribbon = settle(R, entry);
      R.routes.push({ uid, bin: binId, t }); return { kind: 'routed', entry, ribbon, jammed };
    };
    // the crate reached the end of the zone unrouted (or while held): it falls into the pit
    run.pit = (uid, t) => { const R = run.shift; if (!R || R.closed || !R.byUid[uid] || R.entries.has(uid)) return null; const entry = E.entryFor(R.byUid[uid], null, t, false); settle(R, entry); return { kind: 'dropped', entry, ribbon: false }; };
    run.finish = (brakes, t) => {
      const R = run.shift; R.closed = true; const clock = E.beltClock(brakes || []);
      const entries = R.sh.crates.map((c) => R.entries.get(c.uid) || E.entryFor(c, null, t, false));   // anything still on the belt counts as dropped
      const log = { index: R.sh.index, kind: R.sh.kind, side: R.sh.side, desk: R.reviewCount, deskCap: R.sh.desk, brakeUsed: clock.used, endT: clock.t(R.sh.beltSec), entries };
      run.logs.push(log); return log;
    };
    run.partial = () => (run.shift && !run.shift.closed ? [...run.shift.entries.values()] : []);   // the crates settled in a shift that was left unfinished
    run.score = (finished) => E.scoreRun(run.logs, { finished: finished != null ? finished : run.logs.length === spec.shifts.length });
    return run;
  }

  // what the debrief card says about one settled crate: where it went, where it belongs and why
  function describe(e, idea, cap) {
    const bins = SIDES[e.side].bins, chosen = e.chosen ? bins[E.rankOf(e.side, e.chosen)].label : null, right = bins[e.correctRank].label;
    const lead = e.direction === 'dropped' ? 'It reached the pit:' : e.overGated ? 'You sent (the desk was jammed):' : 'You sent:';
    let breaks = e.tell; if (e.overGated) breaks = `The desk holds ${cap || RUN.desk} a shift, so gating everything jams it. ` + (e.correctBin === 'review' ? 'This one did belong here.' : e.tell);
    if (e.reveal) breaks += ` (${e.reveal === 'WAS WRONG' ? 'It was wrong.' : 'It went out fine, this time.'})`;
    return { lead, text: chosen ? `${e.text} → ${chosen}` : e.text, breaks, breaksLabel: `It belongs in ${right}:`, idea, ideaLabel: 'The idea:' };
  }
  function tradeoff(s) {
    const verdict = s.severe >= 3 ? 'Too many spills.' : s.idealCost && s.cost > 1.5 * s.idealCost ? 'Heavy on the locks.' : s.dropped > 2 ? 'Crates fell in the pit.' : s.accuracy >= 0.85 ? 'A steady line.' : 'A fair line.';
    return `${verdict} ${TRADE}`;
  }
  const shiftLine = (s) => `Accuracy ${Math.round(100 * s.accuracy)}% (${s.correct} of ${s.total}) · ${s.severe} spill${s.severe === 1 ? '' : 's'} · ${s.dropped} dropped · line cost ${s.cost} against an ideal ${s.idealCost}`;

  // ================================================================ the browser game
  function create(TF, world, opts = {}) {
    const bridge = opts.bridge || (typeof window !== 'undefined' ? window.bridgePlay : null);
    const memory = (fixed) => { let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0; const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10); return { newRun: () => ({ playerId: id, runIndex: n++, history: { runs: [], concepts: {} } }), onEvent() {} }; };
    let progress = opts.progress || memory(opts.fixed);
    const play = { debrief: null, modal: null, tradeoff, useProgress(p) { progress = p; } }, listeners = {};
    play.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    const STYLE = CW.STYLE, SIDE_SLOT = { doors: 0, tiers: 1, checks: 2, incidents: 3 };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let S = null, hud = null;
    const COACH_KEY = 'tokenfall.mill.coach', RELAX_KEY = 'tokenfall.mill.relaxed'; let coachSeen = 0, relaxed = false;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; relaxed = localStorage.getItem(RELAX_KEY) === '1'; } catch (e) {}
    const bumpCoach = () => { coachSeen++; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };
    const setRelaxed = (on) => { relaxed = !!on; world.state.rate = relaxed ? RUN.relaxed : 1; try { localStorage.setItem(RELAX_KEY, relaxed ? '1' : '0'); } catch (e) {} };

    // ---- sound: the bridge's synth and its M mute, plus the mill's voices (a belt hum, a clunk, a ding, a siren, a bell, steam) ----
    const audio = () => (bridge && bridge.audio) || null, muted = () => !!(audio() && audio().muted);
    function sfx(name) {
      const a = audio(); if (!a || !a.ctx || a.muted) return;
      if (name === 'hum') { a.tone(58, 1.3, 'sawtooth', 0.012); a.tone(87, 1.1, 'triangle', 0.008, 0.1); a.noise(0.5, 0.008, 250); }
      else if (name === 'clunk') { a.tone(95, 0.24, 'triangle', 0.12, 0, 52); a.noise(0.09, 0.14, 500); }
      else if (name === 'ding') { a.tone(880, 0.12, 'sine', 0.08); a.tone(1320, 0.3, 'sine', 0.08, 0.09); }
      else if (name === 'siren') { a.tone(520, 0.45, 'sawtooth', 0.05, 0, 840); a.tone(840, 0.45, 'sawtooth', 0.05, 0.45, 520); }
      else if (name === 'spill') { a.tone(180, 0.5, 'sawtooth', 0.09, 0, 70); a.noise(0.35, 0.16, 300); a.tone(520, 0.45, 'sawtooth', 0.05, 0, 840); a.tone(840, 0.45, 'sawtooth', 0.05, 0.45, 520); }
      else if (name === 'bell') { a.tone(1568, 0.6, 'sine', 0.07); a.tone(2349, 0.4, 'sine', 0.035, 0.01); }
      else if (name === 'steam') a.noise(0.5, 0.07, 2600);
      else if (name === 'stamp') { a.tone(110, 0.12, 'triangle', 0.14, 0, 60); a.noise(0.05, 0.12, 700); }
      else if (name === 'combo') { a.tone(659, 0.1, 'triangle', 0.07); a.tone(784, 0.1, 'triangle', 0.07, 0.08); a.tone(1047, 0.25, 'triangle', 0.07, 0.16); }
      else if (name === 'grab') a.tone(420, 0.06, 'square', 0.025, 0, 560);
      else a.play(name);
    }

    // ---- HUD: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .mp-top { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(780px, calc(100vw - 640px)); padding: 6px 14px 8px; text-align: center; display: none; background: rgba(10,12,20,.95); border-color: var(--gold); }
        .mp-top .k { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .mp-top .t { font-size: clamp(14px, 1.25vw, 17px); line-height: 1.25; margin: 2px 0 4px; color: var(--ink); }
        .mp-top .pips { display: flex; gap: 4px; justify-content: center; } .mp-top .pips i { width: 26px; height: 7px; border: 1px solid rgba(243,234,214,.45); }
        .mp-top .pips i.done { border-color: transparent; background: var(--c); } .mp-top .pips i.cur { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .mp-top .ribbon { display: none; margin-top: 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .2em; color: var(--gold); } .mp-top .ribbon.on { display: block; }
        .mp-stat { position: absolute; bottom: 22px; right: 18px; text-align: right; padding: 7px 12px; font-size: 14px; line-height: 1.75; display: none; min-width: 200px; }
        .mp-stat .clock { font-family: 'Cinzel', serif; font-size: 22px; letter-spacing: .08em; } .mp-stat b { color: var(--gold); font-weight: 600; }
        .mp-stat .gems { display: inline-flex; gap: 6px; vertical-align: middle; flex-wrap: wrap; justify-content: flex-end; max-width: 130px; }
        .mp-gem { width: 9px; height: 9px; background: var(--c); transform: rotate(45deg); box-shadow: 0 0 8px var(--c); } .mp-gem.off { background: transparent; box-shadow: none; border: 1px solid rgba(243,234,214,.35); }
        .mp-brake { display: inline-block; width: 110px; height: 9px; vertical-align: middle; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.4); } .mp-brake i { display: block; height: 100%; background: var(--gold); }
        .mp-stat kbd, .mp-msg kbd, .mp-brief kbd, .mp-help kbd, .mp-rs kbd, .mp-legend kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .mp-legend { position: absolute; left: 18px; bottom: 84px; width: 300px; padding: 7px 10px 8px; display: none; font-size: 14px; line-height: 1.3; }
        .mp-legend h5 { margin: 0 0 4px; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: .14em; color: var(--gold); }
        .mp-legend div.r { display: grid; grid-template-columns: 26px 1fr; gap: 6px; align-items: baseline; margin: 2px 0; } .mp-legend b { font-size: 15px; } .mp-legend small { display: block; opacity: .8; font-size: 12px; }
        .mp-msg { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); max-width: min(640px, calc(100vw - 420px)); padding: 7px 16px; text-align: center; display: none; font-size: 17px; line-height: 1.3; background: rgba(10,12,20,.93); }
        .mp-brief { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 19px; line-height: 1.4; background: rgba(10,12,20,.96); }
        .mp-brief .k { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: .16em; color: var(--gold); } .mp-brief .s { font-size: 12px; letter-spacing: .08em; color: var(--hot); margin: 2px 0 6px; } .mp-brief .t { font-size: 21px; margin: 6px 0 10px; line-height: 1.3; }
        .mp-brief .bins { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 15px; } .mp-brief .bins span { display: block; opacity: .85; font-size: 13px; } .mp-brief .go { margin: 10px 0 0; font-size: 14px; color: var(--gold); text-align: right; }
        .mp-rs { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(780px, calc(100vw - 32px)); padding: 8px 16px 9px; text-align: center; display: none; font-size: 16px; line-height: 1.4; background: rgba(10,12,20,.96); border-color: var(--gold); }
        .mp-rs h5 { margin: 0 0 3px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); } .mp-rs .go { color: var(--gold); font-size: 14px; margin-top: 3px; }
        .mp-read { position: absolute; right: 18px; top: 110px; width: min(400px, calc(100vw - 36px)); max-height: calc(100vh - 330px); overflow-y: auto; padding: 8px 12px 10px; display: none; font-size: 19px; line-height: 1.3; background: rgba(10,12,20,.96); pointer-events: auto; }
        .mp-read h5 { margin: 0 0 6px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); } .mp-read div.c { margin: 0 0 9px; padding-left: 8px; border-left: 3px solid var(--gold); } .mp-read small { display: block; font-size: 13px; letter-spacing: .04em; color: var(--gold); } .mp-read i { display: block; font-style: normal; font-size: 15px; opacity: .85; margin-top: 2px; }
        .mp-help { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(660px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 18px; line-height: 1.4; background: rgba(10,12,20,.96); pointer-events: auto; }
        .mp-help h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); } .mp-help ul { margin: 0; padding-left: 20px; } .mp-help li { margin: 5px 0; } .mp-help label { display: block; margin: 10px 0 0; cursor: pointer; } .mp-help .go { text-align: right; font-size: 14px; color: var(--gold); margin: 10px 0 0; }
        @media (max-width: 1100px) { .mp-top { left: 18px; transform: none; width: calc(100vw - 280px); top: 70px; } .mp-legend { bottom: 84px; width: 250px; } .mp-read { top: 140px; } }
        .mill-on .mp-top, .mill-on .mp-stat, .mill-on .mp-msg, .mill-on .mp-brief, .mill-on .mp-rs, .mill-on .mp-read, .mill-on .mp-legend, .mill-on .mw-read { font-variant-ligatures: none; }   /* the pixel font draws "fi" as an A */
        .mill-on #chat, .mill-on #help { display: none; }   /* the chat log and key hints sit over the mill; the mill has its own hints */`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      const h = { style, top: mk('mp-top'), stat: mk('mp-stat'), legend: mk('mp-legend'), msg: mk('mp-msg'), brief: mk('mp-brief'), rs: mk('mp-rs'), read: mk('mp-read'), help: mk('mp-help'), topKey: '', statKey: '', readKey: '', legKey: '' };
      h.stat.style.setProperty('--hot', STYLE[3].css); h.brief.style.setProperty('--hot', STYLE[3].css);
      h.help.addEventListener('change', (e) => { if (e.target && e.target.id === 'mpRelax') setRelaxed(e.target.checked); });
      return h;
    }
    const cardOpen = () => !!(bridge && bridge.card && bridge.card.open);
    const helpOpen = () => !!hud && hud.help.style.display === 'block';
    const sideCss = (s) => (s === 'rush' ? 'var(--gold)' : STYLE[SIDE_SLOT[s]].css);
    const sideName = (s) => (s === 'rush' ? 'Rush hour' : SIDES[s].name);
    const say = (html, secs = 2.6) => { S.hint = secs; hud.msg.innerHTML = html; hud.msg.style.display = 'block'; };
    const gems = (n, total, color) => Array.from({ length: Math.max(n, total) }, (_, i) => `<i class="mp-gem ${i < n ? '' : 'off'}" style="--c:${color}"></i>`).join('');
    const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const binsNow = () => S.legend;   // what the four plates say right now (the finale flips them wave by wave)

    function drawHud(dt) {
      if (!S || !hud) return;
      const run = S.run, R = run.shift, sh = R && R.sh, shown = S.on && !TF.talking && !helpOpen(), inShift = !!sh && ['play', 'debrief'].includes(S.phase);
      hud.top.style.display = shown && inShift && S.phase === 'play' ? 'block' : 'none';
      const topKey = [run.i, S.phase, S.combo, S.wave, S.policy].join('|');
      if (inShift && topKey !== hud.topKey) {
        hud.topKey = topKey;
        const pips = run.spec.shifts.map((x, i) => `<i class="${i < run.logs.length ? 'done' : ''}${i === run.i ? ' cur' : ''}" style="--c:${sideCss(x.side)}"></i>`).join('');
        const name = sh.kind === 'finale' ? `RUSH HOUR · WAVE ${S.wave + 1} OF 4 · ${sideName(sh.waves[S.wave].side).toUpperCase()}` : sideName(sh.side).toUpperCase();
        hud.top.innerHTML = `<div class="k">SHIFT ${run.i + 1} OF ${run.spec.shifts.length} · ${esc(name)} · SAMPLE POLICY</div><div class="t">${esc(S.policy)}</div><div class="pips" aria-hidden="true">${pips}</div><div class="ribbon ${S.combo >= RULES.COMBO ? 'on' : ''}">COMBO × ${S.combo}</div>`;
      }
      hud.stat.style.display = shown && inShift ? 'block' : 'none';
      if (inShift) {
        const entries = [...R.entries.values()], spills = entries.filter((e) => e.severe).length, dropped = entries.filter((e) => e.action === 'dropped').length, left = Math.max(0, Math.ceil((sh.beltSec - world.bt) / (relaxed ? RUN.relaxed : 1)));
        const brakeLeft = world.brakeLeft, key = [left, entries.length, spills, dropped, R.reviewCount, Math.round(brakeLeft * 10), S.phase, muted(), relaxed].join('|');
        if (key !== hud.statKey) {
          hud.statKey = key;
          const deskRow = sh.side === 'tiers' || (sh.kind === 'finale' && sh.waves.some((w) => w.side === 'tiers')) ? `<br>Review desk <span class="gems">${gems(Math.min(R.reviewCount, sh.desk), sh.desk, STYLE[1].css)}</span>` : '';
          hud.stat.innerHTML = `<div class="clock">${S.phase === 'play' ? clock(left) : 'DONE'}</div>Routed <b>${entries.length}/${sh.crates.length}</b><br>Spills <span class="gems">${gems(spills, 0, STYLE[3].css)}</span><br>Dropped <span class="gems">${gems(dropped, 0, STYLE[0].css)}</span>${deskRow}<br>Brake <span class="mp-brake"><i style="width:${Math.round(100 * brakeLeft / RUN.brake)}%"></i></span><br><kbd>H</kbd> menu · <kbd>R</kbd> read · <kbd>M</kbd> ${muted() ? 'off' : 'on'} · <kbd>Esc</kbd> leave`;
        }
      }
      hud.legend.style.display = shown && inShift && S.phase === 'play' ? 'block' : 'none';
      const lk = S.legend.map((b) => b.id).join();
      if (inShift && lk + S.wave !== hud.legKey) { hud.legKey = lk + S.wave; hud.legend.innerHTML = '<h5>THE BINS · 1 MOST PERMISSIVE .. 4 STRICTEST</h5>' + S.legend.map((b, k) => `<div class="r"><b style="color:${STYLE[k].css}">${STYLE[k].mark}${k + 1}</b><span><b>${esc(b.label)}</b><small>${esc(b.legend)}</small></span></div>`).join(''); }
      if (S.hint > 0) { S.hint -= dt; hud.msg.style.display = S.hint <= 0 || !shown ? 'none' : 'block'; }
      else if (shown && S.phase === 'play' && coachSeen < 3 && !cardOpen()) { hud.msg.innerHTML = 'Drag a crate onto a bin, or click it then click a bin. <kbd>Tab</kbd> selects, <kbd>1</kbd>-<kbd>4</kbd> routes, hold <kbd>Space</kbd> to brake.'; hud.msg.style.display = 'block'; }
      else hud.msg.style.display = 'none';
      hud.read.style.display = shown && S.read && S.phase === 'play' ? 'block' : 'none';
      if (S.read && S.phase === 'play') {
        const vis = world.visibleCrates(), key = vis.map((v) => v.uid).join();
        if (key !== hud.readKey) { hud.readKey = key; hud.read.innerHTML = '<h5>IN THE ZONE, NEAREST THE PIT FIRST</h5>' + (vis.length ? vis.map((v) => `<div class="c"><small>${v.chips.map(esc).join(' · ')}</small>${esc(v.full)}</div>`).join('') : '<div class="c">Nothing in the zone right now.</div>'); }
      }
    }
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.help.innerHTML = `<h3>TOKEN MILL</h3><ul><li>Crates ride the belt past four bins, from the most permissive (1) to the strictest (4). Read the <b>sample policy</b> on the board and route each crate to the bin it says: <b>drag</b> it onto a bin, or <b>click</b> it and then click a bin, or <kbd>Tab</kbd> to select and <kbd>1</kbd>-<kbd>4</kbd> to route.</li><li>Too lax (a lower bin than the right one) is the unsafe direction, and two bins or more is a <b>spill</b>. Too strict wastes capacity. A crate that reaches the pit is dropped.</li><li>Hold <kbd>Space</kbd> to slow the belt to 40%: 3 seconds a shift, never refilled. <kbd>R</kbd> shows the crates in large text. <kbd>M</kbd> sound. <kbd>E</kbd> continues. <kbd>Esc</kbd> leaves (settled crates are kept, without mastery credit).</li></ul><label><input type="checkbox" id="mpRelax" ${relaxed ? 'checked' : ''}> Relaxed belt (0.75× speed; the run is longer)</label><p class="go"><kbd>H</kbd> or <kbd>E</kbd> to close</p>`;
      hud.help.style.display = on ? 'block' : 'none';
    }

    // ---- flow ----
    const afterTalk = (fn) => { S.waitTalk = fn; };
    function startRun(quiet) {
      const r = progress.newRun(), spec = E.composeRun(E.seedFor(r.playerId, r.runIndex), r.history);
      S = { on: true, run: createRun(spec), runInfo: r, phase: 'intro', briefT: 0, hint: 0, waitTalk: null, read: false, combo: 0, landing: {}, queue: [], rsScore: null, humT: 0, endT: 0, summary: null, legend: SIDES.doors.bins, wave: 0, policy: '', flips: [], changes: [] };
      world.state.rate = relaxed ? RUN.relaxed : 1; emit('run', { playerId: r.playerId, runIndex: r.runIndex, seed: spec.seed });
      if (quiet) { TF.banner('A new shift', 'New crates'); beginShift(0); return; }
      TF.banner('Token Mill', 'Route every crate to the right bin');
      TF.talk('Control Desk', coachSeen === 0
        ? ['Welcome to the Token Mill. Five shifts, one belt.', 'Crates come down the belt. Read the policy on the board and send each one to the bin it names: drag it, or click it and click a bin. Too lax is unsafe, too strict is wasteful.', 'Space brakes the belt for three seconds a shift. R reads the crates in big text. M mutes. Esc leaves. The policies are a sample: security and legal will replace them.']
        : ['Back on the floor? Same rules: read the policy, route each crate, brake if you must.']);
      afterTalk(() => beginShift(0));
    }
    function beginShift(i) {
      const run = S.run, R = run.begin(i), sh = R.sh;
      world.clearShift(); world.loadShift(sh); world.run(false); S.combo = 0; S.phase = 'brief'; S.landing = {}; S.hint = 0; S.read = false; S.endT = 0; S.wave = 0; S.legend = (sh.kind === 'finale' ? sh.waves[0].bins : sh.bins).slice();
      S.policy = sh.kind === 'finale' ? sh.waves[0].brief : sh.brief; S.flips = sh.kind === 'finale' ? E.plateFlips(sh).map((f) => Object.assign({ done: false }, f)) : [];
      S.changes = sh.kind === 'finale' ? sh.waves.slice(1).map((w, k) => { const prev = sh.schedule.filter((e) => e.wave === k), last = prev[prev.length - 1]; return { wave: k + 1, at: last.t0 + sh.spacing, done: false }; }) : [];
      hud.topKey = hud.statKey = hud.readKey = hud.legKey = '';
      emit('shift', { index: i, items: sh.crates.map((c) => c.itemId) });
      const first = sh.kind === 'finale' ? sh.waves[0] : sh, name = sh.kind === 'finale' ? `RUSH HOUR · WAVE 1 OF 4 · ${sideName(first.side).toUpperCase()}` : sideName(sh.side).toUpperCase();
      hud.brief.innerHTML = `<div class="k">SHIFT ${i + 1} OF ${run.spec.shifts.length} · ${esc(name)}</div><div class="s">${esc(C.SAMPLE_NOTICE)}</div><div class="t">${esc(first.brief)}</div><div class="bins">${first.bins.map((b, k) => `<div><b style="color:${STYLE[k].css}">${STYLE[k].mark}${k + 1}</b> ${esc(b.label)}<span>${esc(b.legend)}</span></div>`).join('')}</div>${sh.kind === 'finale' ? `<div class="s" style="color:var(--gold)">Four waves. The plates flip between them: read the banner.</div>` : ''}<p class="go"><kbd>E</kbd> Start the belt ▼</p>`;
      hud.brief.style.display = 'block'; S.briefT = RUN.brief;
    }
    function startPlay() { if (!S || S.phase !== 'brief') return; hud.brief.style.display = 'none'; S.phase = 'play'; S.humT = 0; sfx('bell'); world.run(true); }

    // ---- the world's events ----
    function onRoute(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.run.route(ev.uid, ev.bin, world.rt, world.bt); if (!res) return;
      const e = res.entry; S.landing[e.uid] = res; S.combo = S.run.shift.combo; sfx('grab');
      if (res.ribbon) { sfx('combo'); say(`<b>COMBO × ${S.combo}</b>`, 1.6); }
    }
    function onLand(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.landing[ev.uid]; if (!res) return; const e = res.entry, bin = ev.bin;
      if (e.correct) { world.burst(bin); sfx('ding'); }
      else if (e.direction === 'lax') { world.stamp(e.uid, { text: e.stamp, tone: e.severe ? 'spill' : 'lax', bin }); world.siren(e.severe ? 2.6 : 1.4); if (e.severe) { world.cameraShake(0.5, 0.06); sfx('spill'); say(`<b>SPILL.</b> ${esc(e.stamp)}`, 2.2); } else sfx('siren'); }
      else { world.stamp(e.uid, { text: e.stamp, tone: 'strict', bin }); world.steam(bin); sfx('clunk'); sfx('steam'); if (e.overGated) say('<b>DESK JAMMED.</b> Gating everything wastes the reviewer.', 2.4); }
      if (e.reveal) setTimeout(() => { if (S && S.phase === 'play') world.stamp(e.uid, { text: e.reveal, tone: e.reveal === 'WAS WRONG' ? 'spill' : 'ok', bin }); }, 900);
    }
    function onPit(ev) {
      if (!S || S.phase !== 'play') return;
      const res = S.run.pit(ev.uid, world.rt); if (!res) return; S.combo = 0;
      world.stamp(ev.uid, { text: 'DROPPED', tone: 'strict', bin: -1 }); world.steam(-1); sfx('clunk'); say(ev.held ? 'It reached the pit while you held it: dropped.' : 'A crate fell in the pit: dropped.', 2.2);
    }
    const onBrake = (ev) => { if (S && S.phase === 'play') sfx(ev.on ? 'steam' : 'grab'); };
    const onBrakeEmpty = () => { if (S && S.phase === 'play') say('The brake is spent for this shift.', 2); };

    // ---- the debrief: the shift's numbers, then up to 3 Concept Cards (E to continue) ----
    function endShift() {
      const run = S.run, log = run.finish(world.brakes, world.rt), sc = E.scoreShift(log);
      for (const e of log.entries) emit('answer', { credit: true, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, correct: e.correct, direction: e.direction, severe: e.severe });
      S.phase = 'debrief'; S.rsScore = sc; S.queue = E.debriefPicks(log, 3); world.run(false); S.read = false; hud.statKey = '';
      const name = log.kind === 'finale' ? 'RUSH HOUR' : sideName(log.side).toUpperCase(), maxc = Math.max(sc.cost, sc.idealCost, 1);
      hud.rs.innerHTML = `<h5>SHIFT ${run.i + 1} · ${esc(name)}</h5>${esc(shiftLine(sc))}<div class="go"><kbd>E</kbd> ${S.queue.length ? 'Concept cards' : 'Next'} ▼</div>`; hud.rs.style.display = 'block'; void maxc;
      sfx('bell'); TF.sys(`Shift ${run.i + 1}: ${sc.correct} of ${sc.total} routed right, ${sc.severe} spill${sc.severe === 1 ? '' : 's'}, ${sc.dropped} dropped.`);
    }
    function nextCard() {
      if (!S || S.phase !== 'debrief') return;
      const e = S.queue.shift();
      if (!e) { hud.rs.style.display = 'none'; const run = S.run; if (run.i >= run.spec.shifts.length - 1) finish(); else beginShift(run.i + 1); return; }
      const d = describe(e, C.byId[e.conceptId].idea, S.run.logs[S.run.logs.length - 1].deskCap); d.hint = S.queue.length ? 'Next card' : 'Continue'; bridge.card.show(d);
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
      Object.assign(sum, { seed: run.spec.seed, playerId: S.runInfo.playerId, runIndex: S.runInfo.runIndex, timeMs: Math.round(run.elapsed * 1000), why: 'done', relaxed,
        clean: Object.fromEntries(Object.entries(sum.perConcept).map(([id, c]) => [id, c.cleanVariants])) });
      S.phase = 'done'; S.summary = sum; world.clearShift(); hud.rs.style.display = 'none'; hud.legend.style.display = 'none'; sfx('bell');
      TF.banner('Shift over', `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`);
      emit('finish', sum);
      if (play.debrief) play.debrief(sum);
      else { TF.talk('Control Desk', [`${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} Accuracy ${Math.round(100 * sum.accuracy)}%, ${sum.severe} spill${sum.severe === 1 ? '' : 's'}.`, tradeoff(sum)]); afterTalk(() => leave()); }
    }
    play.closeDebrief = () => { if (!S || S.phase !== 'done') return; leave(); };
    function leave() {
      if (!S) return;
      if (S.run && S.phase !== 'done') {   // crates of finished shifts were credited as they went; the ones settled in the shift left behind are kept as partial attempts
        for (const e of S.run.partial()) emit('answer', { credit: false, conceptId: e.conceptId, variantId: e.variantId, itemId: e.itemId, side: e.side, kind: e.kind, correct: e.correct, direction: e.direction, severe: e.severe });
        const part = S.run.score(false); emit('abandon', { shifts: S.run.logs.length, spills: part.severe, dropped: part.dropped, timeMs: Math.round(S.run.elapsed * 1000) });
      }
      bridge && bridge.card && bridge.card.hide(); showHelp(false); S.on = false;
      if (play.modal && play.modal.open()) { play.modal.hide && play.modal.hide(); }
      S = null;
      if (hud) for (const k of ['top', 'stat', 'legend', 'msg', 'brief', 'rs', 'read', 'help']) hud[k].style.display = 'none';
      document.getElementById('ui').classList.remove('mill-on'); world.run(false); world.leave();
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
      if (e.code === 'KeyR' && !e.repeat) { if (S.phase === 'play') S.read = !S.read; return true; }
      if (cardOpen() || helpOpen() || TF.talking || S.phase !== 'play') return true;   // the card has the keys
      if (/^Digit[1-4]$/.test(e.code)) bumpCoach();
      return world.keys.onKey(e) || true;   // the world takes Tab, 1-4 and Space; everything else is swallowed: no walking, no stray jumps, no camera switch
    }

    // ---- per frame ----
    function frame(t, dt) {
      if (!S || !S.on) return;
      if (S.waitTalk && !TF.talking) { const f = S.waitTalk; S.waitTalk = null; f(); if (!S) return; }
      const paused = S.phase !== 'play' || TF.talking || cardOpen() || helpOpen() || document.hidden;
      if (S.phase === 'play') { world.run(!paused); if (paused) world.setBrake(false); else S.run.elapsed += dt; }
      if (S.phase === 'brief' && !TF.talking && !helpOpen() && !document.hidden) { S.briefT -= dt; if (S.briefT <= 0) startPlay(); }
      if (S.phase === 'play' && !paused) {
        S.humT -= dt; if (S.humT <= 0) { S.humT = 1.2; sfx('hum'); }
        const R = S.run.shift, sh = R.sh, bt = world.bt;
        for (const c of S.changes) if (!c.done && bt >= c.at) {   // a shift change: a bell, the pause, and the new policy on the banner
          c.done = true; S.wave = c.wave; const w = sh.waves[c.wave]; S.policy = w.brief; sfx('bell'); world.bell();
          TF.banner('Shift change', `${sideName(w.side)}: ${w.bins.map((b) => b.label).join(' · ')}`); TF.sys(`Shift change: ${sideName(w.side)}. New plates: ${w.bins.map((b, k) => `${k + 1} ${b.label}`).join(', ')}.`);
        }
        for (const f of S.flips) if (!f.done && bt >= f.at) { f.done = true; const b = sh.waves[f.wave].bins[f.bin]; S.legend[f.bin] = b; world.flipPlate(f.bin, b); }   // each plate flips as the old wave has passed it
        if (R.entries.size >= sh.crates.length && bt >= sh.beltSec - 0.01) { S.endT += dt; if (S.endT > 0.9) { endShift(); return; } }
        else if (bt > sh.beltSec + 4) { endShift(); return; }
      }
      drawHud(dt);
    }

    // ---- entry ----
    play.open = () => {
      hud = hud || makeHud();
      return world.enter(() => { document.getElementById('ui').classList.add('mill-on'); startRun(false); });
    };
    play.register = function () {
      world.open = play.open;
      world.canRoute = (uid) => !!(S && S.on && S.phase === 'play' && !TF.talking && !cardOpen() && !helpOpen() && !document.hidden && S.run.canRoute(uid, world.bt));
      world.canGrab = (uid) => world.canRoute(uid);
      TF.life.push((t, dt) => frame(t, dt));
      const prev = TF.onKey; TF.onKey = (e) => (S && S.on ? onKey(e) : prev ? prev(e) : false);
      world.on('route', onRoute); world.on('land', onLand); world.on('pit', onPit); world.on('brake', onBrake); world.on('brakeEmpty', onBrakeEmpty); world.on('exit', () => leave());
    };
    Object.assign(play, { leave, closeCard, onKey, setRelaxed });
    Object.defineProperties(play, { state: { get: () => S }, hud: { get: () => hud } });
    return play;
  }

  function install(TF, opts = {}) {
    const world = TF.mill, play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') window.millPlay = play;
    return play;
  }
  return { RULES, TRADE, createRun, describe, tradeoff, shiftLine, create, install };
});
