// TokenFall: the Settings button at the top right of the open world, and its panel: time of day, music (on/off and loudness), large text, the camera
// view and the controls. It takes over from daylight.js's own sun button (hidden in css/settings.css); the full time console is one click further.
// Hidden while a minigame is open or the world is loading (css/settings.css). Esc closes it.
// Classic script: shares one global scope with the other js/game files, loaded after ui.js by index.html.
(() => {
  const ui = document.getElementById('ui');
  const MOOD_ICONS = [['Morning', 8, '🌅'], ['Afternoon', 14, '☀️'], ['Evening', 18.5, '🌇'], ['Night', 22.5, '🌙']];
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'st-btn'; btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>Settings';
  const wrap = document.createElement('div'); wrap.className = 'st-back'; wrap.hidden = true;
  wrap.innerHTML = '<div class="st-card" role="dialog" aria-label="Settings"><div class="st-head"><h2>Settings</h2><button type="button" class="st-x" data-a="close">Close · Esc</button></div><div class="st-body"></div></div>';
  ui.append(btn, wrap);
  const body = wrap.querySelector('.st-body');
  const bigOn = () => ui.classList.contains('big');
  const hourNow = () => (TF.daylight ? TF.daylight.state.hour : 14);

  function render() {
    const m = TF.music, h = hourNow();
    const near = MOOD_ICONS.reduce((a, b) => (Math.abs(b[1] - h) < Math.abs(a[1] - h) ? b : a));
    body.innerHTML =
      `<section><h3>Time of day</h3><div class="st-moods">${MOOD_ICONS.map((x) => `<button type="button" class="st-mood${x === near ? ' on' : ''}" data-a="hour" data-v="${x[1]}"><span>${x[2]}</span>${x[0]}</button>`).join('')}</div>` +
      `<button type="button" class="st-link" data-a="console">More time controls…</button></section>` +
      `<section><h3>Music</h3><div class="st-row"><button type="button" class="st-tog${m && !m.muted ? ' on' : ''}" data-a="music" aria-pressed="${!!(m && !m.muted)}"><i></i>${m && !m.muted ? 'On' : 'Off'}</button>` +
      `<input type="range" min="0" max="100" value="${Math.round((m ? m.volume : .32) * 100)}" data-a="vol" aria-label="Music volume"${m && m.muted ? ' disabled' : ''}></div></section>` +
      `<section><h3>Display</h3><div class="st-row"><span>Large text</span><button type="button" class="st-tog${bigOn() ? ' on' : ''}" data-a="big" aria-pressed="${bigOn()}"><i></i>${bigOn() ? 'On' : 'Off'}</button></div>` +
      `<div class="st-row"><span>Camera</span><div class="st-seg"><button type="button" class="${camView === 0 ? 'on' : ''}" data-a="cam" data-v="0">Close</button><button type="button" class="${camView === 1 ? 'on' : ''}" data-a="cam" data-v="1">Wide</button></div></div></section>` +
      `<section><h3>Controls</h3><div class="st-keys">${[['WASD', 'Move'], ['Shift', 'Run'], ['Space', 'Jump'], ['E', 'Interact'], ['V', 'View'], ['M', 'Music'], ['G', 'Glitch log'], ['L', 'Large text']].map((k) => `<kbd>${k[0]}</kbd><span>${k[1]}</span>`).join('')}</div></section>`;
  }
  // the time console opened from here gets a Back button at its top left, which returns to this panel
  let back = null;
  const backBtn = () => {
    if (back) return back;
    const h = document.querySelector('.dl-box h3'); back = document.createElement('button'); back.type = 'button'; back.className = 'dl-back'; back.textContent = '‹ Back'; back.hidden = true;
    h.prepend(back);
    back.addEventListener('click', () => { back.hidden = true; TF.daylight.close(); setTimeout(open, 180); });
    h.querySelector('[data-x]').addEventListener('click', () => { back.hidden = true; });
    return back;
  };
  addEventListener('keydown', (e) => { if (back && !back.hidden && (e.code === 'Escape' || e.code === 'KeyE')) back.hidden = true; }, true);
  const open = () => { render(); wrap.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { wrap.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.blur(); };
  btn.addEventListener('click', () => (wrap.hidden ? open() : close()));
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) return close();
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') return close();
    if (a === 'hour' && TF.daylight) TF.daylight.set({ hour: +b.dataset.v }, 1100);
    if (a === 'console' && TF.daylight) { close(); if (TF.daylight.open()) backBtn().hidden = false; return; }
    if (a === 'music' && TF.music) TF.music.setMuted(!TF.music.muted);
    if (a === 'big') { ui.classList.toggle('big'); try { localStorage.setItem('tokenfall.bigtext', bigOn() ? '1' : '0'); } catch (err) { /* not saved */ } }
    if (a === 'cam') setCamView(+b.dataset.v);
    if (a !== 'vol') render();
  });
  wrap.addEventListener('input', (e) => { if (e.target.dataset.a === 'vol' && TF.music) TF.music.setVolume(e.target.value / 100); });
  // Esc closes it; while it is open the keys do not walk the hero
  addEventListener('keydown', (e) => { if (wrap.hidden) return; if (e.code === 'Escape') close(); if (!/^(INPUT)$/.test((document.activeElement || {}).tagName)) e.stopImmediatePropagation(); }, true);
  // a game opening closes it
  new MutationObserver(() => { if (ui.dataset.play === '1' && !wrap.hidden) close(); }).observe(ui, { attributes: true, attributeFilter: ['data-play'] });
})();
