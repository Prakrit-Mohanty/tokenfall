// GameHUD: the one side panel every minigame shows (round, time, mistakes, score, controls), plus the "Leave this game?" confirm.
// Browser: window.GameHUD.create(opts). Node: require('./game-hud.js') for the pure helpers (fmtTime, fmtScore, timeLevel, controlRows).
//
//   const hud = GameHUD.create();
//   hud.update({
//     round: { n: 2, total: 5, label: 'Round' },          // "Round 2 of 5" + a thin bar
//     time: { secs: 74, countdown: true } | null,          // "Time left" / "Time", m:ss; null hides the row (untimed game)
//     mistakes: { n: 1, max: 3 } | { lives: 2 } | { n: 1 } | null,   // "Mistakes 1/3", "Lives 2 left", "Mistakes 1"
//     score: 12,                                            // whole numbers; a half point shows as 7.5
//     extras: [{ label: 'Hints', value: '2 left' }],        // optional labelled rows
//     controls: [['H', 'Help'], ['M', 'Mute'], ['Esc', 'Leave']],   // at most 3 rows are drawn
//   });
//   hud.show(true | false);
//   hud.confirmLeave(onLeave);    // opens the confirm; Enter or the button leaves, Esc or Stay closes it
//   hud.handleKey(e) -> true when the confirm took the key (call it first in the game's key handler)
(function () {
  const WARN = 30, CRIT = 10, MAX_CONTROLS = 3;
  const LEAVE_TEXT = 'Leave this game? Your finished rounds are saved.';

  const fmtTime = (secs) => { const s = Math.max(0, Math.ceil(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const fmtScore = (n) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  // only a countdown warns: an elapsed clock is never "running out"
  const timeLevel = (secs, countdown) => (!countdown ? '' : secs < CRIT ? 'crit' : secs < WARN ? 'warn' : '');
  const controlRows = (controls) => (controls || []).slice(0, MAX_CONTROLS);

  const api = { fmtTime, fmtScore, timeLevel, controlRows, WARN, CRIT, MAX_CONTROLS, LEAVE_TEXT };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CSS = `
    .ghud { position: absolute; top: 76px; transform: none; right: 18px;   /* top right, under the Settings button */
            width: 220px; box-sizing: border-box; padding: 10px 14px 12px; display: none; font-size: 16px; line-height: 1.35; color: #f3ead6; background: rgba(32, 22, 19, .95); font-variant-ligatures: none; z-index: 5; }
    .ghud .r { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 0 0 7px; }
    .ghud .l { font-size: 14px; letter-spacing: .06em; color: #d9c9a3; }
    .ghud .v { color: #fff3d0; }
    .ghud .bar { height: 5px; margin: -3px 0 9px; background: rgba(243, 234, 214, .18); } .ghud .bar i { display: block; height: 100%; background: #ffd27a; }
    .ghud .time { margin: 0 0 8px; } .ghud .time .v { display: block; font-size: 50px; line-height: 1; font-weight: 600; letter-spacing: .01em; }
    .ghud .time.warn .v { color: #ffb347; } .ghud .time.crit .v { color: #ff7a6b; animation: ghud-pulse 1s ease-in-out infinite; }
    @keyframes ghud-pulse { 50% { opacity: .55; } }
    @media (prefers-reduced-motion: reduce) { .ghud .time.crit .v { animation: none; } }
    .ghud .ic { margin-right: 6px; color: #ff9d8a; }
    .ghud .keys { margin: 9px 0 0; padding: 8px 0 0; border-top: 1px solid rgba(243, 234, 214, .2); }
    .ghud .keys div { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; font-size: 15px; }
    .ghud kbd { font: inherit; font-size: 14px; min-width: 30px; text-align: center; padding: 0 5px; color: #2a1d12; background: #ffd27a; border-radius: 3px; }
    .ghud .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 1100px) {   /* narrow: one compact row of icons and numbers, above the bottom key strip */
      .ghud { top: auto; transform: none; bottom: 120px; width: auto; display: none; padding: 6px 10px; }
      .ghud.on { display: flex !important; gap: 12px; align-items: center; }
      .ghud .r, .ghud .time { margin: 0; } .ghud .l, .ghud .bar, .ghud .keys, .ghud .x { display: none; } .ghud .time .v { font-size: 20px; display: inline; }
      .ghud [data-i]::before { content: attr(data-i); margin-right: 4px; color: #d9c9a3; }
      body.ghud-on .t1-hud { display: none !important; }   /* the TOKEN-1 badge would sit on the full-width question banner */
    }
    .gconfirm { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 32px)); padding: 18px 22px; display: none; text-align: center; font-size: 20px; line-height: 1.4; color: #f3ead6; background: rgba(32, 22, 19, .97); z-index: 70; }
    .gconfirm p { margin: 0 0 14px; } .gconfirm button { font: inherit; font-size: 17px; margin: 0 6px; padding: 5px 16px; cursor: pointer; color: #f3ead6; background: transparent; border: 1px solid rgba(243, 234, 214, .5); }
    .gconfirm button.go { color: #2a1d12; background: #ffd27a; border-color: #ffd27a; } .gconfirm button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .gconfirm kbd { font: inherit; font-size: 14px; margin-left: 6px; opacity: .8; }`;

  function create() {
    if (!document.getElementById('ghud-css')) { const s = document.createElement('style'); s.id = 'ghud-css'; s.textContent = CSS; document.head.appendChild(s); }
    const ui = document.getElementById('ui') || document.body;
    const el = document.createElement('div'); el.className = 'panel ghud'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Game status');
    const box = document.createElement('div'); const live = document.createElement('div'); live.className = 'sr'; live.setAttribute('aria-live', 'polite');
    el.append(box, live); ui.appendChild(el);
    const dlg = document.createElement('div'); dlg.className = 'panel gconfirm'; dlg.setAttribute('role', 'alertdialog'); dlg.setAttribute('aria-label', 'Leave this game');
    dlg.innerHTML = `<p>${esc(LEAVE_TEXT)}</p><button type="button" class="stay">Stay<kbd>Esc</kbd></button><button type="button" class="go">Leave<kbd>Enter</kbd></button>`;
    ui.appendChild(dlg);
    let key = '', lastLevel = '', lastMistakes = null, onLeave = null;

    const say = (text, urgent) => { live.setAttribute('aria-live', urgent ? 'assertive' : 'polite'); live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };
    const closeConfirm = () => { dlg.style.display = 'none'; onLeave = null; };
    dlg.querySelector('.stay').onclick = closeConfirm;
    dlg.querySelector('.go').onclick = () => { const f = onLeave; closeConfirm(); if (f) f(); };

    function update(o) {
      const t = o.time, level = t ? timeLevel(t.secs, t.countdown) : '', m = o.mistakes;
      const k = JSON.stringify([o.round, t && [Math.ceil(t.secs), t.countdown], m, o.score, o.extras, o.controls]);
      if (k === key) return; key = k;
      // screen readers hear a warning once as the clock crosses 30 s and 10 s, and every new mistake
      if (level && level !== lastLevel) say(`${level === 'crit' ? CRIT : WARN} seconds left`, level === 'crit');
      lastLevel = level;
      const mCount = m ? (m.lives != null ? -m.lives : m.n) : null;
      if (lastMistakes != null && mCount != null && mCount > lastMistakes) say(m.lives != null ? `Lives: ${m.lives} left` : `Mistake. ${m.n}${m.max ? ' of ' + m.max : ''}`);
      lastMistakes = mCount;
      let h = '';
      if (o.round) {
        const label = o.round.label || 'Round', n = Math.min(o.round.n, o.round.total);
        h += `<div class="r" data-i="#"><span class="l">${esc(label)}</span><span class="v">${n} of ${o.round.total}</span></div><div class="bar"><i style="width:${Math.round((100 * n) / Math.max(1, o.round.total))}%"></i></div>`;
      }
      if (t) h += `<div class="time ${level}" data-i="⏱"><span class="l">${t.countdown ? 'Time left' : 'Time'}</span><span class="v" role="timer">${fmtTime(t.secs)}</span></div>`;
      if (m) {
        const v = m.lives != null ? `${m.lives} left` : m.max ? `${m.n}/${m.max}` : String(m.n);
        h += `<div class="r" data-i="✕"><span class="l">${m.lives != null ? 'Lives' : 'Mistakes'}</span><span class="v"><span class="ic x" aria-hidden="true">✕</span>${v}</span></div>`;
      }
      if (o.score != null) h += `<div class="r" data-i="★"><span class="l">Score</span><span class="v">${fmtScore(o.score)}</span></div>`;
      for (const x of o.extras || []) h += `<div class="r x"><span class="l">${esc(x.label)}</span><span class="v">${esc(x.value)}</span></div>`;
      const rows = controlRows(o.controls);
      if (rows.length) h += `<div class="keys">${rows.map(([kk, verb]) => `<div><kbd>${esc(kk)}</kbd><span>${esc(verb)}</span></div>`).join('')}</div>`;
      box.innerHTML = h;
    }

    return {
      el, update,
      show(on) { el.style.display = on ? 'block' : 'none'; el.classList.toggle('on', !!on); document.body.classList.toggle('ghud-on', !!on); if (!on) closeConfirm(); },
      confirmLeave(fn) { onLeave = fn; dlg.style.display = 'block'; dlg.querySelector('.go').focus(); },
      confirmOpen: () => dlg.style.display === 'block',
      handleKey(e) {
        if (dlg.style.display !== 'block') return false;
        if (!e.repeat && e.code === 'Escape') closeConfirm();
        else if (!e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter')) dlg.querySelector('.go').click();
        return true;   // the game sees no keys while the confirm is up
      },
      reset() { key = ''; lastLevel = ''; lastMistakes = null; },
      dispose() { el.remove(); dlg.remove(); },
    };
  }

  window.GameHUD = Object.assign({ create }, api);
})();
