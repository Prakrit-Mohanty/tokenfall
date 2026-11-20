// The Arena screen for glitch battles: the glitch on a platform top right, TOKEN-1 bottom left, a muddle bar and his accuracy bar, and a
// storybook text box that shows lines and answer moves. Also the "!" that pops over a colleague who spots you. Takes the keys while open.
// DOM only; encounter.js runs the battle. Browser: window.EncounterUI.
(function () {
  const ADVANCE = [' ', 'Enter', 'e', 'E'];
  const TYPE_MS = 18;

  const animate = (el, props) => window.Token1UI.animate(el, props);
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stageColor = (accuracy) => `var(--t1-s${window.Token1Meter.stage({ accuracy })})`;

  const create = () => {
    const S = window.EncounterSprites, ui = document.getElementById('ui'), root = document.createElement('div'), mark = document.createElement('div');
    root.id = 'enc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-live', 'polite');
    mark.className = 'enc-mark'; mark.textContent = '!'; mark.style.display = 'none';
    ui.append(root, mark);

    let live = false, onKey = null, typing = null, full = '', glitch = null, sayEl = null;
    const $ = (sel) => root.querySelector(sel);

    const setT1 = (lit) => { const t = S.token1(7, lit); t.classList.add('enc-idle'); $('.enc-sp.me').replaceChildren(t); };

    const bars = (acc, muddle) => {
      const a = $('.enc-bar.acc > i'); a.style.width = acc + '%'; a.style.background = stageColor(acc); $('.enc-av').textContent = acc + '%';
      $('.enc-bar.muddle > i').style.width = muddle + '%'; $('.enc-mv').textContent = muddle + '%';
    };

    const build = ({ acc, place }) => {
      root.setAttribute('aria-label', `Glitch battle: ${glitch.name}`);
      root.innerHTML = `<div class="enc-sky"></div><div class="enc-pad foe"></div><div class="enc-pad me"></div>
        <div class="enc-sp foe"></div><div class="enc-sp me"></div>
        <div class="enc-plate foe panel"><div class="enc-nm">${glitch.name.toUpperCase()}</div><div class="enc-bar muddle"><i></i></div><div class="enc-sub"><span>Muddle</span><span class="enc-mv"></span></div></div>
        <div class="enc-plate me panel"><div class="enc-nm">TOKEN-1</div><div class="enc-bar acc"><i></i></div><div class="enc-sub"><span>Accuracy</span><span class="enc-av"></span></div></div>
        <div class="enc-box panel"><span class="enc-who"></span><div class="enc-say"></div><div class="enc-moves"></div><div class="enc-next">${place} · press <kbd>Space</kbd> ▸</div></div>
        <div class="enc-reward panel"></div>`;
      const foe = S.glitch(glitch.sprite, 7); foe.classList.add('enc-wob'); $('.enc-sp.foe').appendChild(foe);
      for (let i = 0; i < 3; i++) { const q = document.createElement('span'); q.className = 'enc-q'; q.textContent = '?'; q.style.left = 20 + i * 30 + '%'; q.style.animationDelay = i * .8 + 's'; $('.enc-sp.foe').appendChild(q); }
      sayEl = $('.enc-say'); setT1(false); bars(acc, 100);
    };

    const finishTyping = () => { clearInterval(typing); typing = null; sayEl.innerHTML = full; };

    const type = (html) => {
      full = html; clearInterval(typing);
      if (reduced()) { sayEl.innerHTML = html; return; }
      const plain = html.replace(/<[^>]+>/g, ''); let n = 0;
      typing = setInterval(() => { n += 2; if (n >= plain.length) finishTyping(); else sayEl.textContent = plain.slice(0, n); }, TYPE_MS);
    };

    // who: 'foe' | 't1' | 'nar'; next() runs when the player presses Space / Enter / E or clicks
    const say = (who, html, next) => {
      const tag = $('.enc-who');
      tag.className = `enc-who ${who}`; tag.textContent = who === 'foe' ? glitch.name.toUpperCase() : who === 't1' ? 'TOKEN-1' : '';
      $('.enc-moves').replaceChildren(); $('.enc-next').style.visibility = '';
      type(html);
      onKey = (e) => {
        if (!ADVANCE.includes(e.key)) return;
        if (typing) { finishTyping(); return; }
        onKey = null; next();
      };
    };

    // four answer moves; keys 1-4 or a click picks one
    const ask = (stem, opts, pick) => {
      const tag = $('.enc-who'); tag.className = 'enc-who foe'; tag.textContent = glitch.name.toUpperCase();
      clearInterval(typing); typing = null; sayEl.textContent = stem; $('.enc-next').style.visibility = 'hidden';
      const box = $('.enc-moves'); box.replaceChildren();
      const choose = (i) => { onKey = null; box.querySelectorAll('button').forEach((b) => (b.disabled = true)); pick(opts[i]); };
      opts.forEach((o, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'enc-move'; b.innerHTML = `<kbd>${i + 1}</kbd> `; b.append(o.text);
        b.addEventListener('click', (e) => { e.stopPropagation(); choose(i); }); box.appendChild(b);
      });
      onKey = (e) => { const i = Number(e.key) - 1; if (i >= 0 && i < opts.length) choose(i); };
    };

    const shake = (sel) => { const el = $(sel); el.classList.remove('enc-hit'); void el.offsetWidth; el.classList.add('enc-hit'); };

    const floatAt = (text, good) => {
      const r = $('.enc-bar.acc').getBoundingClientRect(), u = root.getBoundingClientRect(), el = document.createElement('div');
      el.className = `enc-float ${good ? 'good' : 'bad'}`; el.textContent = text; el.style.left = r.left - u.left + r.width / 2 + 'px'; el.style.top = r.top - u.top - 10 + 'px';
      root.appendChild(el);
      animate(el, { translateY: -50, opacity: [1, 0], duration: 1000, ease: 'outQuad', onComplete: () => el.remove() });
    };

    const hit = ({ correct, acc, prevAcc, muddle }) => {
      shake(correct ? '.enc-sp.foe' : '.enc-sp.me');
      const d = acc - prevAcc;
      if (d) floatAt(d > 0 ? `+${d}%` : `−${-d}%`, d > 0);
      bars(acc, muddle);
    };

    const calm = () => $('.enc-sp.foe').classList.add('enc-calm');

    // spec: { kicker, icon: text or a canvas, title, lines: [html], slots: [true/false per slot] }
    const fillCard = (r, { kicker, icon, title, lines, slots }) => {
      r.innerHTML = `<div class="k">${kicker}</div><div class="enc-chip"></div><h2>${title.toUpperCase()}</h2>${lines.map((l, i) => `<p class="${i ? 'enc-lesson' : ''}">${l}</p>`).join('')}
        <div class="enc-slots">${slots.map((got) => `<span class="${got ? 'got' : ''}"></span>`).join('')}</div><div class="enc-foot">press <kbd>Space</kbd> ▸</div>`;
      if (typeof icon === 'string') r.querySelector('.enc-chip').textContent = icon; else r.querySelector('.enc-chip').appendChild(icon);
      r.classList.add('on');
      animate(r, { scale: [.6, 1], opacity: [0, 1], duration: 500, ease: 'outBack' });
    };

    const card = (spec, next) => {
      const r = $('.enc-reward'); fillCard(r, spec);
      onKey = (e) => { if (ADVANCE.includes(e.key)) { onKey = null; r.classList.remove('on'); next(); } };
    };

    // a card on its own, over the world (a part won back after a minigame)
    const cardAlone = (spec, done) => {
      root.innerHTML = '<div class="enc-dim"></div><div class="enc-reward panel"></div>'; root.style.opacity = '';
      live = true; root.classList.add('live'); addEventListener('keydown', keys, true);
      fillCard($('.enc-reward'), spec);
      onKey = (e) => { if (ADVANCE.includes(e.key)) { onKey = null; close(done); } };
    };

    // the Glitch Log: every glitch, the beaten ones with their sprite, mistake and lesson
    const book = (entries, done) => {
      const got = entries.filter((e) => e.caught).length;
      root.innerHTML = `<div class="enc-dim"></div><div class="enc-book panel" role="document"><div class="k">GLITCH LOG · ${got} / ${entries.length}</div><h2>GLITCHES YOU HAVE MET</h2>
        <div class="enc-pages">${entries.map((e) => `<div class="enc-page${e.caught ? '' : ' unknown'}" data-id="${e.id}"><div class="enc-pic"></div><div><b>${e.caught ? e.name : '???'}</b>
          <span>${e.caught ? e.mistake : 'Not met yet'}</span>${e.caught ? `<i>${e.lesson}</i>` : ''}</div></div>`).join('')}</div><div class="enc-foot">press <kbd>G</kbd> or <kbd>Esc</kbd> to close</div></div>`;
      entries.forEach((e) => root.querySelector(`.enc-page[data-id="${e.id}"] .enc-pic`).appendChild(S.glitch(e.sprite, 2.4)));
      live = true; root.classList.add('live'); addEventListener('keydown', keys, true);
      animate(root.querySelector('.enc-book'), { scale: [.92, 1], opacity: [0, 1], duration: 260, ease: 'outQuad' });
      onKey = (e) => { if (['g', 'G', 'Escape', ' ', 'Enter', 'e', 'E'].includes(e.key)) { onKey = null; close(done); } };
    };

    const keys = (e) => {
      if (!live) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat && onKey) onKey(e);
    };
    root.addEventListener('click', () => { if (onKey) onKey({ key: ' ' }); });

    const open = (setup, ready) => {
      glitch = setup.glitch; build(setup); live = true; onKey = null; root.classList.add('live');
      addEventListener('keydown', keys, true);
      animate($('.enc-sky'), { clipPath: ['circle(0% at 50% 50%)', 'circle(80% at 50% 50%)'], duration: 650, ease: 'inOutQuad' });
      animate($('.enc-sp.foe'), { translateX: [400, 0], duration: 700, delay: 300, ease: 'outQuad' });
      animate($('.enc-sp.me'), { translateX: [-400, 0], duration: 700, delay: 300, ease: 'outQuad' });
      animate(root.querySelectorAll('.enc-plate, .enc-box'), { opacity: [0, 1], duration: 300, delay: 800 });
      setTimeout(ready, reduced() ? 0 : 850);
    };

    const close = (done) => {
      live = false; onKey = null; clearInterval(typing); typing = null; removeEventListener('keydown', keys, true);
      animate(root, { opacity: [1, 0], duration: 350, onComplete: () => { root.classList.remove('live'); root.style.opacity = ''; root.innerHTML = ''; done(); } });
    };

    // p: a screen point { x, y, ok } over the colleague's head, or null to hide
    const showMark = (p) => {
      mark.style.display = p && p.ok ? '' : 'none';
      if (p) { mark.style.left = p.x + 'px'; mark.style.top = p.y + 'px'; }
    };

    return { open, close, say, ask, hit, calm, card, cardAlone, book, showMark, sprite: (kind, scale) => S.glitch(kind, scale), active: () => live };
  };

  window.EncounterUI = { create };
})();
