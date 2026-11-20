// TOKEN-1's on-screen parts: the HUD portrait with its accuracy ring, a speech bubble over its head, the welcome/help
// card (takes the keys until closed; with actions, only their keys), the "!" over its head, result toasts (never take the keys, so they can show over a minigame), floating
// +/- numbers, and the fly-off / fly-back between the world and the HUD. DOM only; token1.js decides what to show.
(function () {
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (el, props) => {
    if (window.anime && !REDUCED) return window.anime.animate(el, props);
    if (props.onComplete) props.onComplete();
    return null;
  };

  const FACE = [['#ff6a5a', false], ['#ff6a5a', false], ['#ffd27a', true], ['#ffd27a', true], ['#7ff0c0', true]];

  const face = (px, stage) => {
    const c = document.createElement('canvas'), g = c.getContext('2d'), [eye, steady] = FACE[stage] || FACE[0];
    c.width = c.height = 16; c.style.width = c.style.height = px + 'px';
    g.fillStyle = '#e8e4dc'; g.fillRect(2, 4, 12, 10); g.fillStyle = '#888'; g.fillRect(7, 1, 2, 3); g.fillStyle = '#ffb347'; g.fillRect(6, 0, 4, 2);
    g.fillStyle = '#122'; g.fillRect(3, 6, 10, 6); g.fillStyle = eye;
    g.fillRect(4, 7, 2, 2); g.fillRect(6, 10, 4, 1);
    if (steady) g.fillRect(10, 7, 2, 2); else g.fillRect(10, 8, 2, 1);
    if (stage >= 4) { g.fillRect(5, 9, 1, 1); g.fillRect(10, 9, 1, 1); }
    return c;
  };

  const create = () => {
    const root = document.createElement('div'); root.id = 't1';
    const hud = document.createElement('div'), bub = document.createElement('div'), layer = document.createElement('div');
    hud.className = 't1-hud panel'; hud.tabIndex = 0; hud.setAttribute('role', 'button');
    root.append(layer, hud, bub); document.getElementById('ui').appendChild(root);

    let onIcon = () => {}, card = null, cardClose = null, toastEl = null, toastT = 0, bubT = 0;
    hud.addEventListener('click', () => onIcon());
    hud.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onIcon(); } });

    const setHud = ({ accuracy, stage, stageName, away }) => {
      hud.className = `t1-hud panel s${stage}${away ? ' t1-away' : ''}`;
      hud.setAttribute('aria-label', `TOKEN-1, accuracy ${accuracy} percent. ${away ? 'Call it back' : 'Send it away'}`);
      hud.innerHTML = `<div class="t1-ring" style="--t1-p:${accuracy}"><div></div></div><div><div class="t1-name">TOKEN-1</div><div class="t1-pct">${accuracy}%</div><div class="t1-st">${stageName} · accuracy</div></div>`;
      hud.querySelector('.t1-ring > div').appendChild(face(34, stage));
    };

    const say = (html, ms = 4200) => { bub.innerHTML = `<div class="t1-bub panel">${html}</div>`; clearTimeout(bubT); bubT = setTimeout(() => (bub.innerHTML = ''), ms); };
    const hideSay = () => { clearTimeout(bubT); bub.innerHTML = ''; };
    const placeSay = (p) => { const el = bub.firstChild; if (!el) return; el.style.display = p.ok ? '' : 'none'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; };

    let cardActions = null;
    const onCardKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (!cardActions) { closeCard(); return; }
      const hit = cardActions.find((a) => a.key === e.key);
      if (hit) closeCard(hit.act);
    };
    const closeCard = (then) => {
      if (!card) return;
      removeEventListener('keydown', onCardKey, true);
      const el = card, done = cardClose; card = null; cardClose = null; cardActions = null;
      animate(el, { opacity: 0, duration: 160, ease: 'inQuad', onComplete: () => el.remove() });
      if (typeof then === 'function') then();
      if (done) done();
    };
    const showCard = (title, html, onClose, actions, kicker) => {
      if (card) closeCard();
      card = document.createElement('div'); card.className = 't1-card panel'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', title);
      const foot = actions
        ? `<div class="t1-btns">${actions.map((a, i) => `<button type="button" class="t1-btn${a.primary ? ' t1-primary' : ''}" data-i="${i}">${a.label} <kbd>${a.key === 'Enter' ? '⏎' : 'Esc'}</kbd></button>`).join('')}</div>`
        : '<div class="t1-foot">press any key ▸</div>';
      card.innerHTML = `${kicker ? `<div class="t1-kicker">${kicker}</div>` : ''}<h2>${title}</h2><div class="t1-line"></div><div class="t1-body">${html}</div>${foot}`;
      cardActions = actions || null; cardClose = onClose || null;
      if (actions) card.querySelectorAll('.t1-btn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); closeCard(actions[+b.dataset.i].act); }));
      else card.addEventListener('click', () => closeCard());
      root.appendChild(card); addEventListener('keydown', onCardKey, true);
      const primary = card.querySelector('.t1-primary'); if (primary) primary.focus({ preventScroll: true });
      animate(card, { opacity: [0, 1], scale: [.96, 1], duration: 260, ease: 'outQuad' });
    };

    const markEl = document.createElement('div'); markEl.className = 't1-mark'; markEl.textContent = '!'; markEl.style.display = 'none'; layer.appendChild(markEl);
    const mark = (on) => { markEl.style.display = on ? '' : 'none'; };
    const placeMark = (p) => { if (markEl.style.display === 'none') return; markEl.style.left = p.x + 'px'; markEl.style.top = (p.y - 26 + Math.sin(performance.now() / 260) * 5) + 'px'; markEl.style.visibility = p.ok ? '' : 'hidden'; };
    const showHud = (on) => { hud.style.display = on ? '' : 'none'; };

    const toast = (title, html, ms = 5200) => {
      if (toastEl) toastEl.remove();
      const el = toastEl = document.createElement('div'); el.className = 't1-toast panel'; el.setAttribute('role', 'status');
      el.innerHTML = `<h2>${title}</h2><div class="t1-line"></div>${html}`; root.appendChild(el);
      animate(el, { opacity: [0, 1], translateY: [-8, 0], duration: 260, ease: 'outQuad' });
      clearTimeout(toastT); toastT = setTimeout(() => animate(el, { opacity: 0, duration: 300, onComplete: () => { el.remove(); if (toastEl === el) toastEl = null; } }), ms);
    };

    const float = (text, good, p) => {
      const el = document.createElement('div'); el.className = `t1-float ${good ? 't1-good' : 't1-bad'}`; el.textContent = text;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; layer.appendChild(el);
      animate(el, { top: p.y - 54, opacity: [1, 0], duration: 1100, ease: 'outQuad', onComplete: () => el.remove() });
      setTimeout(() => el.remove(), 1600);
    };

    const iconPoint = () => { const r = hud.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40, ok: true }; };

    const fly = (from, to, stage, onDone) => {
      const el = document.createElement('div'); el.className = 't1-ghost'; el.appendChild(face(40, stage)); layer.appendChild(el);
      el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
      animate(el, { left: [from.x, to.x], top: [from.y, to.y], rotate: [0, -20], duration: 620, ease: 'inOutQuad', onComplete: () => { el.remove(); if (onDone) onDone(); } });
    };
    const bump = () => animate(hud, { scale: [1.18, 1], duration: 420, ease: 'outBack' });

    return { setHud, showHud, onIconClick: (fn) => (onIcon = fn), say, hideSay, placeSay, showCard, closeCard, cardOpen: () => !!card, toast, float, iconPoint, fly, bump, face, mark, placeMark };
  };

  window.Token1UI = { create, animate };
})();
