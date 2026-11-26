// The character pick, shown once after the launcher's START. A cream panel over the same sunny sky and hills as the launcher's menu: the chosen character stands big on a bobbing grass island on the left; on
// the right are their name, specialty chip, line, a tip and a clip of them walking round the real lobby (launcher/preview-<id>.mp4, recorded from the game by
// tools/record-previews.mjs); below, all four to choose from. The look is in css/char-select.css, the roster, specialties and tips in js/game/char-select.js.
// Left / Right (or A / D) choose, Enter or the Start button begins; a click on a character chooses them. Keys stop at the screen, so the hero does not move while picking.
// The big figure is the idle frame (facing the camera) cut out of the game's own atlas, so it is as sharp as the figure in the world.
// Browser only: window.CharSelectScreen.run() shows it and resolves with the chosen id (it has already saved it through CharSelect.setChoice).
(function () {
  // the part of the 250x230 source cell the standing figure fills (source px): the atlas frames are 2.5x that
  const CROP = { x: 40, y: 40, w: 170, h: 190 };
  const UPSCALE = 1.4;   // the figure is shown at most this many times its real pixel size (1 = one image pixel per screen pixel, the sharpest; more is bigger and softer)
  const portrait = (id) => `tokenfall-characters/sprites/${id}-portrait.png`;

  // main.js already decodes every atlas (sheetImgs): use that copy when it is there, so the picker does not decode them twice
  const atlasImg = (id) => (typeof sheetImgs !== 'undefined' && sheetImgs[id]) || Object.assign(new Image(), { src: window.CHAR_SHEETS[id] });
  const ready = (img) => img.complete && img.naturalWidth;

  // draws the character's idle frame into host (a canvas the size of CROP at atlas scale); the portrait image stands in if the atlas is not there
  function drawFigure(id, host) {
    const c = window.CHARS && window.CHARS[id], sheet = window.CHAR_SHEETS && window.CHAR_SHEETS[id];
    if (!c || !sheet) { host.innerHTML = `<img class="cp-fallback" src="${portrait(id)}" alt="">`; return; }
    const s = c.atlas.scale, [ax, ay, w, h, bx, by] = c.rects[c.animations.idle_down.start];
    const cv = document.createElement('canvas');
    cv.width = Math.round(CROP.w * s); cv.height = Math.round(CROP.h * s);
    cv.style.setProperty('--fit', c.fit || 1);   // the game scales each figure by its fit so all four stand the same height
    cv.style.height = Math.round(cv.height / (window.devicePixelRatio || 1) * UPSCALE) + 'px';   // sized by its real pixels: a sharp screen gets a smaller figure, never a stretched one
    host.appendChild(cv);
    const img = atlasImg(id);
    const draw = () => cv.getContext('2d').drawImage(img, ax, ay, w, h, Math.round((bx - CROP.x) * s), Math.round((by - CROP.y) * s), w, h);
    if (ready(img)) draw(); else img.addEventListener('load', draw, { once: true });
  }

  // the headshots in the strip: every character cut from the same box of their idle frame (the same 90x84 source px, centred on the figure and starting just above its top),
  // so all four heads are the same size and in the same place; the portrait image stands in if the atlas is not there
  // above: how far above the figure's top the window starts (source px), different for each because hair and glasses make the tops differ (Riya's bun, Saanvi's glasses): it is set so
  // all four pairs of eyes land at the same height in the box
  const HEAD = { w: 90, h: 84, above: { saanvi: 5, riya: -6, mehta: 7, aarav: -0.5 } };
  function drawHead(id, host) {
    const c = window.CHARS && window.CHARS[id], sheet = window.CHAR_SHEETS && window.CHAR_SHEETS[id];
    if (!c || !sheet) { host.innerHTML = `<img src="${portrait(id)}" alt="">`; return; }
    const s = c.atlas.scale, [ax, ay, w, h, bx, by, bw] = c.rects[c.animations.idle_down.start];
    const cv = document.createElement('canvas');
    cv.width = Math.round(HEAD.w * s); cv.height = Math.round(HEAD.h * s);
    host.appendChild(cv);
    const img = atlasImg(id), fit = c.fit || 1;   // fit evens out the figures' heights, so the heads come out the same size
    // the crop window's corner in cell px (atlas scale): centred on the figure's box, a little above its top; the frame is drawn where it sat in the cell, relative to that
    const draw = () => cv.getContext('2d').drawImage(img, ax, ay, w, h, Math.round(bx * s - ((bx + bw / 2) * s - cv.width / 2)), Math.round(HEAD.above[id] * s), w, h);
    if (ready(img)) draw(); else img.addEventListener('load', draw, { once: true });
  }

  function run() {
    return new Promise((done) => {
      const CS = window.CharSelect, roster = CS.ROSTER;
      let sel = Math.max(0, roster.findIndex((r) => r.id === CS.getChoice()));
      const tipAt = roster.map((_, i) => i);   // each character's place in the tip pool: they start on different tips, and each pick moves that character on to the next
      const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

      const el = document.createElement('div');
      el.id = 'charpick'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choose your character');
      el.innerHTML = `<div class="cp-backdrop"><i class="c1"></i><i class="c2"></i><i class="c3"></i><b class="h1"></b><b class="h2"></b></div>
      <div class="cp-frame">
        <div class="cp-top"><span>Choose your character</span></div>
        <div class="cp-main">
          <div class="cp-stage"><div class="cp-platform"></div>${roster.map(() => '<div class="cp-art"></div>').join('')}</div>
          <div class="cp-info">
            <h1 class="cp-name"></h1>
            <span class="cp-chip"></span>
            <p class="cp-blurb"></p>
            <div class="cp-card cp-tip"><span class="cp-label">Tip</span><p></p></div>
            <div class="cp-card cp-preview">${roster.map((r) => `<video class="cp-clip" src="launcher/preview-${r.id}.mp4" muted loop playsinline preload="auto" aria-hidden="true"></video>`).join('')}<span class="cp-label">Out in the plaza</span></div>
          </div>
        </div>
        <div class="cp-strip">
          <span class="cp-keys"><kbd>&larr;</kbd><kbd>&rarr;</kbd> choose</span>
          <div class="cp-pick">
            <button type="button" tabindex="-1" class="cp-btn cp-arrow" data-step="-1" aria-label="Previous character">&#8249;</button>
            ${roster.map((r) => `<div class="cp-thumb" data-character="${r.id}"><div class="cp-face"></div><span class="cp-tname">${r.name}</span></div>`).join('')}
            <button type="button" tabindex="-1" class="cp-btn cp-arrow" data-step="1" aria-label="Next character">&#8250;</button>
          </div>
          <span class="cp-startwrap"><button type="button" tabindex="-1" class="cp-btn cp-go">Start <kbd>Enter</kbd></button></span>
        </div>
      </div>`;
      const q = (s) => el.querySelector(s);
      const arts = [...el.querySelectorAll('.cp-art')], thumbs = [...el.querySelectorAll('.cp-thumb')], clips = [...el.querySelectorAll('.cp-clip')];
      const info = q('.cp-info');
      roster.forEach((r, i) => drawFigure(r.id, arts[i]));
      el.querySelectorAll('.cp-face').forEach((f, i) => drawHead(roster[i].id, f));
      clips.forEach((v) => v.addEventListener('error', () => q('.cp-preview').classList.add('off')));   // a browser that cannot play the clips just goes without the box

      const show = (i, animate) => {
        const was = sel;
        sel = (i + roster.length) % roster.length;
        if (animate && sel !== was) tipAt[sel] += 1;
        const r = roster[sel];
        arts.forEach((a, j) => a.classList.toggle('on', j === sel));
        thumbs.forEach((t, j) => t.classList.toggle('sel', j === sel));
        q('.cp-name').textContent = r.name; q('.cp-chip').textContent = r.specialty; q('.cp-blurb').textContent = r.blurb; q('.cp-tip p').textContent = CS.tipFor(tipAt[sel]);
        clips.forEach((v, j) => {   // the chosen one plays from the start (reduced motion: it stays on its first frame), the others rest
          v.classList.toggle('on', j === sel);
          if (j === sel && !still) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
        });
        if (animate && !still && info.animate) info.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
      };
      // the picker fades out over the loading screen (260 ms, opacity only, on the compositor) instead of cutting to it; the game's own work starts after
      let leaving = false;
      const confirm = () => {
        if (leaving) return; leaving = true;
        CS.setChoice(roster[sel].id);
        const id = roster[sel].id, go = () => { if (!el.isConnected) return; el.remove(); done(id); };
        if (still || !window.anime || !anime.waapi) return go();
        el.style.pointerEvents = 'none';
        setTimeout(go, 600);   // never leave the picker up if the animation does not report back
        anime.waapi.animate(el, { opacity: 0, duration: 260, ease: 'out(3)', onComplete: go });
      };

      thumbs.forEach((t, i) => { t.addEventListener('click', () => show(i, true)); t.addEventListener('dblclick', confirm); });
      el.querySelectorAll('.cp-arrow').forEach((a) => a.addEventListener('click', () => show(sel + Number(a.dataset.step), true)));
      q('.cp-go').addEventListener('click', confirm);
      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        const k = e.key;
        if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); show(sel + 1, true); }
        else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); show(sel - 1, true); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); confirm(); }
      });
      el.addEventListener('keyup', (e) => e.stopPropagation());

      document.body.appendChild(el);
      show(sel, false);
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => el.classList.add('on'));
    });
  }
  window.CharSelectScreen = { run };
})();
