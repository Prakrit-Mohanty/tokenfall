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
    .gintro { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(1140px, calc(100vw - 32px)); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; padding: 26px 32px 24px; display: none; color: #f3ead6; background: rgba(32, 22, 19, .97); font-size: 19px; line-height: 1.4; z-index: 60; font-variant-ligatures: none; }
    .panel.gintro h2 { margin: 0 0 6px; font-family: var(--font-secondary); font-size: 34px; line-height: 1.2; text-transform: none; letter-spacing: .04em; color: #ffd27a; font-weight: 700; }
    .gintro .goal { margin: 0 0 20px; color: #fff3d0; font-size: 21px; }
    .gintro .gi-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 34px; align-items: stretch; }
    .gintro .gi-l { display: flex; flex-direction: column; min-width: 0; }
    .gintro .gi-r { min-width: 0; padding-left: 34px; border-left: 2px dashed rgba(255, 228, 196, .18); }
    .gintro .gi-act { margin-top: auto; padding-top: 10px; }
    .gintro .gi-lab { margin: 0 0 8px; font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #c9a873; }
    .gintro .gi-l ol { list-style: none; padding: 0; counter-reset: gis; }
    .gintro .gi-l li { counter-increment: gis; position: relative; padding-left: 40px; margin: 0 0 12px; }
    .gintro .gi-l li::before { content: counter(gis); position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; background: #ffd27a; color: #2a1d12; font-weight: 700; font-size: 16px; line-height: 28px; text-align: center; }
    @media (max-width: 860px) { .gintro .gi-cols { grid-template-columns: 1fr; gap: 16px; } .gintro .gi-r { padding-left: 0; border-left: 0; } }
    .gintro ol { margin: 0 0 12px; padding-left: 24px; } .gintro li { margin: 3px 0; }
    .gintro .ctl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; align-items: center; margin: 0 0 12px; font-size: 17px; }
    .gintro kbd { font: inherit; font-size: 15px; min-width: 34px; text-align: center; padding: 0 6px; color: #2a1d12; background: #ffd27a; border-radius: 3px; justify-self: start; }
    .gintro .meta { margin: 0 0 14px; font-size: 16px; color: #d9c9a3; }
    .gintro .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .gintro button { font: inherit; font-size: 19px; padding: 6px 22px; cursor: pointer; color: #2a1d12; background: #ffd27a; border: 0; }
    .gintro button:focus-visible, .gintro input:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .gintro .kb { margin: 4px 0 14px; padding: 9px 9px 12px; border-radius: 18px; background: linear-gradient(#d4d7dc, #aeb2ba); box-shadow: inset 0 1px 0 #fff8, 0 4px 0 #6a6e76, 0 10px 18px rgba(0,0,0,.35); }
    .gintro .kb-keys { padding: 7px; border-radius: 10px; background: #111317; box-shadow: inset 0 2px 4px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 4px; }
    .gintro .kr { display: flex; gap: 4px; }
    .gintro .k { flex: var(--w, 1) 1 0; min-width: 0; height: 35px; border-radius: 6px; background: linear-gradient(#3a3d45, #2b2e35); box-shadow: inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 #15171b, 0 1px 1px rgba(0,0,0,.5); color: #eef1f6; font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0 2px; text-align: center; overflow: hidden; white-space: nowrap; text-shadow: 0 1px 0 rgba(0,0,0,.4); transition: background .18s, box-shadow .18s, color .18s, transform .1s; }
    .gintro .k b { font-size: 12px; font-weight: 500; line-height: 1; } .gintro .k small { font-size: 9px; font-weight: 500; line-height: 1; color: #c7ccd6; letter-spacing: .01em; }
    .gintro .kr.fn .k { height: 22px; font-size: 10px; line-height: 1; padding: 0 1px; color: #c7ccd6; }
    html body #ui .panel.gintro h2 { font-size: 34px; line-height: 1.15; }
    html body #ui .panel.gintro .kb .k { font-size: 13px; line-height: 1; letter-spacing: 0; } html body #ui .panel.gintro .kb .kr.fn .k { font-size: 10px; }
    html body #ui .panel.gintro .kb .k, html body #ui .panel.gintro .kb .k * { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif !important; letter-spacing: 0; }   /* storybook.css gives every .panel .k its slab title font through an :is() that holds #help, so it carries an id's weight: #ui here outranks it */
    .gintro .k.use { background: linear-gradient(color-mix(in srgb, var(--c) 42%, #3a3d45), color-mix(in srgb, var(--c) 30%, #2b2e35)); color: #fff; font-weight: 700; box-shadow: inset 0 -2px 0 #0e0f12, 0 0 0 1px color-mix(in srgb, var(--c) 70%, transparent); }
    .gintro .k.on, .gintro .k.press { background: var(--c); color: #1c1408; text-shadow: none; box-shadow: 0 0 10px 2px var(--c), inset 0 -2px 0 rgba(0,0,0,.25); transform: translateY(1px); }
    .gintro .k.use small, .gintro .k.on small, .gintro .k.press small { color: inherit; }
    .gintro .k.hold.on { animation: gholdk 1s ease-in-out infinite; }
    @keyframes gholdk { 0%, 100% { box-shadow: 0 0 4px 1px var(--c); } 50% { box-shadow: 0 0 16px 5px var(--c); } }
    .gintro .pad { position: relative; width: 36%; height: 58px; margin: 10px auto 0; border-radius: 11px; background: linear-gradient(#b9bdc4, #a3a7af); box-shadow: inset 0 1px 2px rgba(0,0,0,.25); transition: background .18s, box-shadow .18s; }
    .gintro .pad.use { box-shadow: inset 0 1px 2px rgba(0,0,0,.25), 0 0 0 2px color-mix(in srgb, var(--c) 70%, transparent); }
    .gintro .pad.on { background: color-mix(in srgb, var(--c) 55%, #b9bdc4); box-shadow: 0 0 14px 3px var(--c); }
    .gintro .pad i { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px; border-radius: 50%; background: #fff; opacity: 0; }
    .gintro .pad.on i { animation: gtap 1s ease-out infinite; }
    @keyframes gtap { 0% { opacity: .9; transform: scale(.4); } 70% { opacity: 0; transform: scale(2.4); } 100% { opacity: 0; } }
    .gintro .ctl .row-c { display: flex; align-items: center; gap: 10px; min-width: 0; }
    @media (max-width: 560px) { .gintro .ctl { grid-template-columns: 1fr; } }
    .gintro .kc { font-size: 14px; padding: 1px 8px; border-radius: 6px; background: var(--c); color: #1c1408; font-weight: 700; justify-self: start; transition: box-shadow .18s; }
    .gintro .ctl span.act { transition: color .18s; }
    .gintro .row-c.on .kc { box-shadow: 0 0 10px 1px var(--c); } .gintro .row-c.on .act { color: #fff; }
    .gintro .hint { font-size: 15px; color: #d9c9a3; } .gintro label { font-size: 15px; color: #d9c9a3; cursor: pointer; display: flex; gap: 6px; align-items: center; }`;

  // ---- the keyboard picture: a MacBook-style keyboard and trackpad; the keys each control uses glow in that control's colour ----
  const KC = ['#ffd27a', '#7fd3ff', '#ff9a8a', '#a8f0a0'];
  const KB_ROWS = [
    { fn: true, keys: [['esc', 'esc', 1.5], ...'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ').map((f) => [f.toLowerCase(), f, 1]), ['touch', '', 1]] },
    { keys: [['`', '`', 1], ...'1234567890'.split('').map((d) => [d, d, 1]), ['-', '-', 1], ['=', '=', 1], ['del', 'delete', 1.7]] },
    { keys: [['tab', 'tab', 1.6], ...'QWERTYUIOP'.split('').map((c) => [c.toLowerCase(), c, 1]), ['[', '[', 1], [']', ']', 1], ['\\', '\\', 1]] },
    { keys: [['caps', 'caps', 1.9], ...'ASDFGHJKL'.split('').map((c) => [c.toLowerCase(), c, 1]), [';', ';', 1], ["'", "'", 1], ['ret', 'return', 2]] },
    { keys: [['lsh', 'shift', 2.4], ...'ZXCVBNM'.split('').map((c) => [c.toLowerCase(), c, 1]), [',', ',', 1], ['.', '.', 1], ['/', '/', 1], ['rsh', 'shift', 2.4]] },
    { keys: [['fn', 'fn', 1], ['ctl', '⌃|control', 1.25], ['opt', '⌥|option', 1.25], ['cmd', '⌘|command', 1.55], ['space', '', 4.9], ['cmd2', '⌘|command', 1.55], ['opt2', '⌥|option', 1.25], ['left', '◀', 1], ['ud', '▲▼', 1], ['right', '▶', 1]] },   // modifiers: the symbol over the word, as printed on a Mac
  ];
  // which keys a control's label means ("Click / Space", "Hold F", "1–4", "A / D", "1 2 3"); 'pad' is the trackpad
  function keysOf(label) {
    const out = new Set(), t = String(label);
    if (/click|drag|tap|mouse/i.test(t)) out.add('pad');
    const range = t.match(/(\d)\s*[–-]\s*(\d)/); if (range) for (let d = +range[1]; d <= +range[2]; d++) out.add(String(d));
    for (const w of t.replace(/(\d)\s*[–-]\s*(\d)/, ' ').split(/[\s\/,+]+/)) {
      const l = w.toLowerCase();
      if (l === 'space') out.add('space'); else if (l === 'esc' || l === 'escape') out.add('esc'); else if (l === 'tab') out.add('tab');
      else if (l === 'enter' || l === 'return') out.add('ret'); else if (l === 'shift') out.add('lsh'); else if (/^[a-z0-9]$/.test(l)) out.add(l);
    }
    return out;
  }
  const codeKey = (code) => code === 'Space' ? 'space' : code === 'Escape' ? 'esc' : code === 'Tab' ? 'tab' : code === 'Enter' ? 'ret' : /^Key[A-Z]$/.test(code) ? code[3].toLowerCase() : /^Digit\d$/.test(code) ? code[5] : null;
  function keyboardHTML(controls) {
    const use = {};   // key id -> control index
    controls.forEach(([k], i) => { for (const id of keysOf(k)) if (!(id in use)) use[id] = i; });
    const hold = new Set(); controls.forEach(([k], i) => { if (/hold/i.test(k)) for (const id of keysOf(k)) hold.add(id); });
    const key = ([id, cap, w]) => { const i = use[id]; return `<div class="k${i != null ? ' use' : ''}${hold.has(id) ? ' hold' : ''}" data-k="${esc(id)}"${i != null ? ` data-c="${i}" style="--w:${w};--c:${KC[i % 4]}"` : ` style="--w:${w}"`}>${cap.includes('|') ? cap.split('|').map((p, j) => j ? `<small>${esc(p)}</small>` : `<b>${esc(p)}</b>`).join('') : esc(cap)}</div>`; };
    const pi = use.pad;
    return `<div class="kb" aria-hidden="true"><div class="kb-keys">${KB_ROWS.map((r) => `<div class="kr${r.fn ? ' fn' : ''}">${r.keys.map(key).join('')}</div>`).join('')}</div>`
      + `<div class="pad${pi != null ? ' use' : ''}" data-k="pad"${pi != null ? ` data-c="${pi}" style="--c:${KC[pi % 4]}"` : ''}><i></i></div></div>`;
  }

  function create(cfg) {
    if (!document.getElementById('gintro-css')) { const s = document.createElement('style'); s.id = 'gintro-css'; s.textContent = CSS; document.head.appendChild(s); }
    const KEY = `tokenfall.${cfg.id}.introSkip`;
    const el = document.createElement('div'); el.className = 'panel gintro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', `gintro-${cfg.id}`);
    (document.getElementById('ui') || document.body).appendChild(el);
    let mode = null, onStart = null;

    const skipped = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
    const setSkip = (on) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} };

    function render(help) {
      // laid out across the screen: what to do on the left (goal, steps, then Start), how to do it on the right (the keyboard and its legend)
      el.innerHTML = `<div class="gi-cols"><div class="gi-l"><h2 id="gintro-${cfg.id}">${esc(cfg.title)}</h2><p class="goal">${esc(cfg.goal)}</p>`
        + `<div class="gi-lab">How to play</div><ol>${cfg.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
        + `<p class="meta">${esc(lineText(cfg))}</p>`
        + `<div class="gi-act">` + (help
          ? `<div class="row"><span class="hint">Press H or Esc to close</span><button type="button" data-a="close">Back to game</button></div>`
          : `<div class="row"><label><input type="checkbox" data-a="skip"${skipped() ? ' checked' : ''}> Don't show again</label><button type="button" data-a="start">Start</button></div><p class="hint" style="margin:8px 0 0;text-align:right">Press Enter to start</p>`)
        + `</div></div><div class="gi-r"><div class="gi-lab">Controls</div>` + keyboardHTML(cfg.controls)
        + `<div class="ctl">${cfg.controls.map(([k, a], i) => `<div class="row-c" data-c="${i}" style="--c:${KC[i % 4]}"><span class="kc">${esc(k)}</span><span class="act">${esc(a)}</span></div>`).join('')}</div></div></div>`;
      el.querySelector('button').onclick = (e) => { e.currentTarget.blur(); help ? close() : start(); };
      const box = el.querySelector('[data-a="skip"]'); if (box) box.onchange = () => setSkip(box.checked);
      // light one control at a time (its keys and its legend row); hovering a row holds it on that one
      let i = 0, held = null; const n = cfg.controls.length;
      const show = (c) => el.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', +x.dataset.c === c));
      clearInterval(tick); show(0); tick = setInterval(() => { if (held == null) show(i = (i + 1) % n); }, 1700);
      el.querySelectorAll('.row-c').forEach((r) => { r.onmouseenter = () => { held = +r.dataset.c; show(held); }; r.onmouseleave = () => { held = null; }; });
    }
    let tick = 0;
    // a real key press lights the same key on the picture for a moment
    function flash(code) { const id = codeKey(code); if (!id) return; const k = el.querySelector(`.k[data-k="${id}"]`); if (!k) return; if (!k.style.getPropertyValue('--c')) k.style.setProperty('--c', '#ffffff'); k.classList.add('press'); setTimeout(() => k.classList.remove('press'), 220); }
    function start() { const f = onStart; close(); if (f) f(); }
    function close() { el.style.display = 'none'; mode = null; onStart = null; clearInterval(tick); }
    function open(o = {}) {
      mode = o.help ? 'help' : 'start'; onStart = o.onStart || null; render(!!o.help);
      el.style.display = 'block'; el.querySelector('button').focus({ preventScroll: true });
    }
    function handleKey(e) {
      if (!mode) return false;
      flash(e.code);
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
