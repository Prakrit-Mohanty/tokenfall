// IntroScreen: the one pre-game card every minigame shows, driven by a config from the game's content file. The same card is the H help overlay.
// Browser: window.IntroScreen.create(cfg). Node: require('./intro-screen.js') for checkCopy (the copy rules, run by the tests).
//
//   cfg = { id, title, goal, steps: [..], controls: [[input, action], ..], duration: '~5 min', roundCount: 8, roundWord: 'questions' }
//   const intro = IntroScreen.create(cfg);
//   intro.skipped()                 -> true when the player ticked "Don't show again" (stored in localStorage)
//   intro.open({ onStart })         the pre-game card: Start / Enter calls onStart
//   intro.open({ help: true })      the same content as help: H, Esc or Enter closes it
//   intro.handleKey(e) -> true when the card took the key (call it early in the game's key handler; Esc on the start card is left to the game)
//   intro.isOpen(), intro.close()
(function () {
  const RULES = { titleWords: [2, 4], goalWords: 15, steps: 3, stepWords: 11, controls: [2, 4], totalWords: 59 };
  const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

  // every copy rule from the brief; returns a list of problems (empty = fine)
  function checkCopy(cfg) {
    const p = [], tw = words(cfg.title), steps = cfg.steps || [], controls = cfg.controls || [];
    if (tw < RULES.titleWords[0] || tw > RULES.titleWords[1]) p.push(`title has ${tw} words (2 to 4)`);
    if (words(cfg.goal) > RULES.goalWords) p.push(`goal has ${words(cfg.goal)} words (15 max)`);
    if (!steps.length || steps.length > RULES.steps) p.push(`${steps.length} steps (1 to 3)`);
    steps.forEach((s, i) => { if (words(s) > RULES.stepWords) p.push(`step ${i + 1} has ${words(s)} words (under 12)`); });
    if (controls.length < RULES.controls[0] || controls.length > RULES.controls[1]) p.push(`${controls.length} controls (2 to 4)`);
    const total = [cfg.title, cfg.goal, ...steps, ...controls.flat(), lineText(cfg)].reduce((n, s) => n + words(s), 0);
    if (total > RULES.totalWords) p.push(`${total} visible words (under 60)`);
    return p;
  }
  const lineText = (cfg) => `${cfg.duration} · ${cfg.roundCount} ${cfg.roundWord || 'rounds'}`;

  const api = { checkCopy, RULES, words, lineText };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CSS = `
    .gintro { position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; padding: 20px 26px 18px; display: none; color: #f3ead6; background: rgba(32, 22, 19, .97); font-size: 19px; line-height: 1.4; z-index: 60; font-variant-ligatures: none; }
    .panel.gintro h2 { margin: 0 0 4px; font-family: var(--font-secondary); font-size: 26px; line-height: 1.2; text-transform: none; letter-spacing: .04em; color: #ffd27a; font-weight: 700; }
    .gintro .goal { margin: 0 0 12px; color: #fff3d0; }
    .gintro ol { margin: 0 0 12px; padding-left: 24px; } .gintro li { margin: 3px 0; }
    .gintro .ctl { display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; align-items: center; margin: 0 0 12px; font-size: 17px; }
    .gintro kbd { font: inherit; font-size: 15px; min-width: 34px; text-align: center; padding: 0 6px; color: #2a1d12; background: #ffd27a; border-radius: 3px; justify-self: start; }
    .gintro .meta { margin: 0 0 14px; font-size: 16px; color: #d9c9a3; }
    .gintro .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .gintro button { font: inherit; font-size: 19px; padding: 6px 22px; cursor: pointer; color: #2a1d12; background: #ffd27a; border: 0; }
    .gintro button:focus-visible, .gintro input:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .gintro .hint { font-size: 15px; color: #d9c9a3; } .gintro label { font-size: 15px; color: #d9c9a3; cursor: pointer; display: flex; gap: 6px; align-items: center; }`;

  function create(cfg) {
    if (!document.getElementById('gintro-css')) { const s = document.createElement('style'); s.id = 'gintro-css'; s.textContent = CSS; document.head.appendChild(s); }
    const KEY = `tokenfall.${cfg.id}.introSkip`;
    const el = document.createElement('div'); el.className = 'panel gintro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', `gintro-${cfg.id}`);
    (document.getElementById('ui') || document.body).appendChild(el);
    let mode = null, onStart = null;

    const skipped = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
    const setSkip = (on) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} };

    function render(help) {
      el.innerHTML = `<h2 id="gintro-${cfg.id}">${esc(cfg.title)}</h2><p class="goal">${esc(cfg.goal)}</p>`
        + `<ol>${cfg.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
        + `<div class="ctl">${cfg.controls.map(([k, a]) => `<kbd>${esc(k)}</kbd><span>${esc(a)}</span>`).join('')}</div>`
        + `<p class="meta">${esc(lineText(cfg))}</p>`
        + (help
          ? `<div class="row"><span class="hint">Press H or Esc to close</span><button type="button" data-a="close">Back to game</button></div>`
          : `<div class="row"><label><input type="checkbox" data-a="skip"${skipped() ? ' checked' : ''}> Don't show again</label><button type="button" data-a="start">Start</button></div><p class="hint" style="margin:8px 0 0;text-align:right">Press Enter to start</p>`);
      el.querySelector('button').onclick = (e) => { e.currentTarget.blur(); help ? close() : start(); };
      const box = el.querySelector('[data-a="skip"]'); if (box) box.onchange = () => setSkip(box.checked);
    }
    function start() { const f = onStart; close(); if (f) f(); }
    function close() { el.style.display = 'none'; mode = null; onStart = null; }
    function open(o = {}) {
      mode = o.help ? 'help' : 'start'; onStart = o.onStart || null; render(!!o.help);
      el.style.display = 'block'; el.querySelector('button').focus({ preventScroll: true });
    }
    function handleKey(e) {
      if (!mode) return false;
      if (e.repeat) return true;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { mode === 'help' ? close() : start(); return true; }
      if (mode === 'help' && (e.code === 'Escape' || e.code === 'KeyH')) { close(); return true; }
      if (mode === 'start' && e.code === 'Escape') return false;   // the game asks "Leave this game?"
      if (e.code === 'KeyM') return false;                          // mute still works
      return true;                                                  // nothing else reaches the game while the card is up
    }
    return { open, close, handleKey, skipped, isOpen: () => !!mode, mode: () => mode, el };
  }

  window.IntroScreen = Object.assign({ create }, api);
})();
