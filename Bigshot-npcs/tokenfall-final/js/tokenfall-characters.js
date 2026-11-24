/*!
 * tokenfall-characters.js — Tokenfall final roster (Murali, Salim, Amit, Jacintha, Kartik, Arvind, Rajiv, Brian, Baljeet, Rohit).
 * No dependencies. UMD: <script>, ES import (via bundler) or require().
 *
 *   const ctl = TokenfallCharacters.mount(el, { assetsBase: '/tokenfall/sprites/', character: 'riya' });
 *   // or, inside your own game loop:
 *   const hero = TokenfallCharacters.create('aarav', '/tokenfall/sprites/', { x: 400, y: 450 });
 *   hero.setInput({ left: true, run: true }); hero.do('jump');
 *   hero.update(dtMs, { width, height }); hero.draw(ctx);
 *
 * Angles: 0 = facing the camera, then clockwise: 90 = facing right, 180 = back, 270 = facing left.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokenfallCharacters = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Every atlas: cells 250x230, feet anchor (125, 222), standing height ~172 px.
  // dirs: 8 -> rows at 0,45,...,315; 12 -> rows at 0,30,...,330; 4 -> rows down(0), up(180), left(270), right(90).
  var CELL = { w: 250, h: 230 }, ANCHOR = { x: 125, y: 222 };
  // All atlases: 8 cols x 24 rows. idle rows 0-7, walk rows 8-15 (6 frames), talk rows 16-23 (8 frames); 8 facings each.
  var ROSTER = {
    murali: { name: 'Murali', file: 'murali.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    salim: { name: 'Salim', file: 'salim.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    amit: { name: 'Amit', file: 'amit.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    jacintha: { name: 'Jacintha', file: 'jacintha.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    kartik: { name: 'Kartik', file: 'kartik.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    arvind: { name: 'Arvind', file: 'arvind.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    rajiv: { name: 'Rajiv', file: 'rajiv.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    brian: { name: 'Brian', file: 'brian.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    baljeet: { name: 'Baljeet', file: 'baljeet.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } },
    rohit: { name: 'Rohit', file: 'rohit.webp', walkFps: 9, runFps: 15, anims: {
      idle: { row: 0,  dirs: 8, frames: 1 },
      walk: { row: 8,  dirs: 8, frames: 6 },
      run:  { row: 8,  dirs: 8, frames: 6 },                  // walk frames, played faster
      talk: { row: 16, dirs: 8, frames: 8, ms: 170 },
      jump: { row: 0,  dirs: 8, frames: 1, ms: 620, arc: 50 } } }
  };
  var ORDER = ['murali', 'salim', 'amit', 'jacintha', 'kartik', 'arvind', 'rajiv', 'brian', 'baljeet', 'rohit'];
  var LABELS = { idle: 'Idle', walk: 'Walking', run: 'Running', jump: 'Jumping', crouch: 'Crouching', talk: 'Talking' };

  function norm(d) { return ((d % 360) + 360) % 360; }
  function rowOffset(dirs, ang) {
    ang = norm(ang);
    if (dirs === 4) { var a4 = (Math.round(ang / 90) * 90) % 360; return { 0: 0, 180: 1, 270: 2, 90: 3 }[a4]; }
    if (dirs === 8) return (Math.round(ang / 45) % 8);
    // 12: exact diagonals (two arrow keys) map to the 30/120/240/330 views
    var diag = { 45: 1, 135: 4, 225: 8, 315: 11 }[Math.round(ang)];
    return diag != null ? diag : Math.round(ang / 30) % 12;
  }

  function Character(id, image, opts) {
    opts = opts || {};
    this.id = id; this.def = ROSTER[id]; this.image = image;
    this.x = opts.x == null ? 400 : opts.x; this.y = opts.y == null ? 400 : opts.y;
    this.scale = opts.scale == null ? 1 : opts.scale;
    this.speed = opts.speed == null ? 200 : opts.speed; this.runMult = opts.runMult == null ? 1.8 : opts.runMult;
    this.angle = 0; this.input = { up: false, down: false, left: false, right: false, run: false };
    this.target = null; this.shot = null; this.shotT = 0; this.pose = null; this.poseT = 0; this.t = 0;
    this.shadow = opts.shadow !== false; this.onState = opts.onState || null; this._sig = '';
    this.state = { anim: 'idle', angle: 0, frame: 0, label: 'Idle', lift: 0 };
  }
  Character.prototype.actions = function () {
    var a = this.def.anims, out = ['jump', 'run'];
    if (a.crouch) out.push('crouch'); if (a.talk) out.push('talk'); return out;
  };
  Character.prototype.setInput = function (o) { for (var k in o) this.input[k] = !!o[k]; if (o.up || o.down || o.left || o.right) this.target = null; };
  Character.prototype.walkTo = function (x, y) { this.target = { x: x, y: y }; this.pose = null; };
  Character.prototype.do = function (name) {
    var A = this.def.anims;
    if (name === 'run') { this.input.run = !this.input.run; return; }
    if (name === 'crouch' && A.crouch) {
      if (this.pose === 'crouch') { this.pose = null; this.shot = 'stand'; this.shotT = (A.crouch.hold + 1) * A.crouch.ms; }
      else { this.pose = 'crouch'; this.poseT = 0; this.shot = null; }
      return;
    }
    if ((name === 'jump' || name === 'talk') && A[name]) { if (this.shot !== name) { this.shot = name; this.shotT = 0; this.pose = null; } }
  };
  Character.prototype.update = function (dt, bounds) {
    var I = this.input, A = this.def.anims;
    var dx = (I.right ? 1 : 0) - (I.left ? 1 : 0), dy = (I.down ? 1 : 0) - (I.up ? 1 : 0);
    if (!dx && !dy && this.target) {
      var tx = this.target.x - this.x, ty = this.target.y - this.y, td = Math.hypot(tx, ty);
      if (td < 4) this.target = null; else { dx = tx / td; dy = ty / td; }
    }
    var moving = !!(dx || dy);
    this.t += dt;
    if (moving) {
      if (this.shot && this.shot !== 'jump') this.shot = null;
      this.pose = null;
      var len = Math.hypot(dx, dy), v = this.speed * this.scale * (I.run ? this.runMult : 1) * dt / 1000;
      if (this.target) v = Math.min(v, Math.hypot(this.target.x - this.x, this.target.y - this.y));
      this.x += dx / len * v; this.y += dy / len * v;
      if (bounds) { var m = 50 * this.scale; this.x = Math.max(m, Math.min(bounds.width - m, this.x)); this.y = Math.max(180 * this.scale, Math.min(bounds.height - 10, this.y)); }
      this.angle = norm(Math.atan2(dx, dy) * 180 / Math.PI);
    }
    var anim = 'idle', frame = 0, lift = 0, a;
    if (moving) { anim = I.run ? 'run' : 'walk'; frame = Math.floor(this.t / 1000 * (I.run ? this.def.runFps : this.def.walkFps)) % A[anim].frames; }
    if (this.pose === 'crouch') { this.poseT += dt; a = A.crouch; anim = 'crouch'; frame = Math.min(a.hold, Math.floor(this.poseT / a.ms)); }
    if (this.shot) {
      this.shotT += dt;
      var key = this.shot === 'stand' ? 'crouch' : this.shot; a = A[key];
      var total = a.frames * a.ms;
      if (this.shotT >= total + (key === 'talk' ? 2400 : 0)) this.shot = null;
      else {
        anim = key; frame = key === 'talk' ? Math.floor(this.shotT / a.ms) % a.frames : Math.min(a.frames - 1, Math.floor(this.shotT / a.ms));
        if (key === 'jump') lift = a.lift ? a.lift[frame] : Math.sin(Math.min(1, this.shotT / total) * Math.PI) * a.arc;
      }
    }
    this.state = { anim: anim, angle: this.angle, frame: frame, label: anim === 'crouch' && this.shot === 'stand' ? 'Standing up' : LABELS[anim], lift: lift, running: !!I.run };
    var sig = anim + '|' + Math.round(this.angle);
    if (this.onState && sig !== this._sig) { this._sig = sig; this.onState(this.state); }
    return this.state;
  };
  Character.prototype.draw = function (ctx) {
    var s = this.state, a = this.def.anims[s.anim], k = this.scale;
    var row = a.row + rowOffset(a.dirs, s.angle);
    if (this.shadow) {
      var sh = 1 - s.lift / 180;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath();
      ctx.ellipse(this.x, this.y - 2 * k, 40 * k * sh, 9 * k * sh, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (!this.image || !this.image.complete) return;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.image, s.frame * CELL.w, row * CELL.h, CELL.w, CELL.h,
      Math.round(this.x - ANCHOR.x * k), Math.round(this.y - ANCHOR.y * k - s.lift * k), CELL.w * k, CELL.h * k);
    ctx.restore();
  };

  var cache = {};
  function loadImage(src) { if (!cache[src]) { var i = new Image(); i.src = src; cache[src] = i; } return cache[src]; }
  function create(id, assetsBase, opts) {
    opts = opts || {};
    var src = (opts.sources && opts.sources[id]) || ((assetsBase || 'sprites/') + ROSTER[id].file);
    return new Character(id, loadImage(src), opts);
  }

  // ---------- mount(): demo widget with character picker, keyboard, buttons, click-to-walk ----------
  function mount(container, opts) {
    opts = opts || {};
    var doc = container.ownerDocument || document, W = opts.width || 860, H = opts.height || 620;
    var base = opts.assetsBase || 'sprites/';
    var wrap = doc.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;font:500 14px system-ui,sans-serif;color:#EDE9F7';
    var canvas = doc.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.tabIndex = 0;
    canvas.style.cssText = 'width:100%;max-width:' + W + 'px;aspect-ratio:' + W + '/' + H + ';border-radius:12px;outline:none;touch-action:none;cursor:pointer';
    canvas.setAttribute('aria-label', 'Play field. Arrow keys or WASD walk, Shift runs, Space jumps, C crouches, E talks. Click to walk there.');
    var picker = doc.createElement('div'); picker.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-width:' + W + 'px';
    var bar = doc.createElement('div'); bar.style.cssText = picker.style.cssText;
    wrap.appendChild(picker); wrap.appendChild(canvas); wrap.appendChild(bar); container.appendChild(wrap);
    var hero, held = { up: 0, down: 0, left: 0, right: 0 }, shift = false, runToggle = false;
    function btn(label, fn, pressed) {
      var b = doc.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'height:38px;padding:0 14px;border-radius:8px;border:2px solid ' + (pressed ? '#E9935A' : 'transparent') + ';background:' + (pressed ? '#3A3550' : '#2A2638') + ';color:#EDE9F7;font:600 14px system-ui,sans-serif;cursor:pointer';
      b.addEventListener('click', function () { fn(); canvas.focus(); }); return b;
    }
    function renderUI() {
      picker.innerHTML = ''; bar.innerHTML = '';
      ORDER.forEach(function (id, i) { picker.appendChild(btn((i === 9 ? 0 : i + 1) + ' · ' + ROSTER[id].name, function () { select(id); }, hero && hero.id === id)); });
      var keys = { jump: 'Space', run: 'Shift', crouch: 'C', talk: 'E' };
      hero.actions().forEach(function (a) { bar.appendChild(btn(a[0].toUpperCase() + a.slice(1) + (a === 'run' && runToggle ? ': on' : '') + ' · ' + keys[a], function () { if (a === 'run') { runToggle = !runToggle; renderUI(); } else hero.do(a); })); });
    }
    function select(id) {
      var old = hero; hero = create(id, base, { x: old ? old.x : W / 2, y: old ? old.y : H * 0.7, scale: opts.scale, speed: opts.speed, sources: opts.sources, onState: opts.onState });
      if (old) hero.angle = old.angle;
      renderUI(); if (opts.onSelect) opts.onSelect(id);
    }
    select(opts.character && ROSTER[opts.character] ? opts.character : ORDER[0]);
    var KM = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    var kd = function (e) {
      var k = (e.key || '').toLowerCase(); shift = !!e.shiftKey;
      if (KM[k]) { e.preventDefault(); held[KM[k]] = 1; hero.target = null; return; }
      if (e.repeat) return;
      if (k === ' ') { e.preventDefault(); hero.do('jump'); }
      else if (k === 'c') hero.do('crouch'); else if (k === 'e') hero.do('talk');
      else if (k >= '0' && k <= '9') { var n = k === '0' ? 10 : +k; if (n <= ORDER.length) select(ORDER[n - 1]); }
    };
    var ku = function (e) { var k = (e.key || '').toLowerCase(); shift = !!e.shiftKey; if (KM[k]) held[KM[k]] = 0; };
    var target = opts.keyboard === 'window' ? window : canvas;
    if (opts.keyboard !== false) { target.addEventListener('keydown', kd); target.addEventListener('keyup', ku); }
    canvas.addEventListener('blur', function () { held = { up: 0, down: 0, left: 0, right: 0 }; });
    canvas.addEventListener('pointerdown', function (e) {
      canvas.focus(); var r = canvas.getBoundingClientRect();
      hero.walkTo((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
    });
    var ctx = canvas.getContext('2d'), bg = opts.background === undefined ? '#335C44' : opts.background, last = 0, raf = 0, alive = true;
    function frame(t) {
      if (!alive) return;
      var dt = last ? Math.min(50, t - last) : 16; last = t;
      hero.input.up = !!held.up; hero.input.down = !!held.down; hero.input.left = !!held.left; hero.input.right = !!held.right; hero.input.run = shift || runToggle;
      hero.update(dt, { width: W, height: H });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      if (bg) {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2;
        for (var gx = 0; gx <= W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (var gy = 0; gy <= H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      }
      hero.draw(ctx);
      if (opts.hud !== false) {
        var txt = hero.def.name + ' · ' + Math.round(hero.angle) + '° · ' + hero.state.label;
        ctx.font = '600 14px system-ui,sans-serif'; ctx.fillStyle = 'rgba(21,19,29,0.8)'; ctx.fillRect(12, 12, ctx.measureText(txt).width + 20, 28);
        ctx.fillStyle = '#EDE9F7'; ctx.fillText(txt, 22, 31);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if (opts.autofocus !== false) setTimeout(function () { try { canvas.focus({ preventScroll: true }); } catch (e) {} }, 0);
    return {
      get hero() { return hero; }, canvas: canvas, select: select, do: function (n) { hero.do(n); },
      destroy: function () { alive = false; cancelAnimationFrame(raf); if (opts.keyboard !== false) { target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); } wrap.remove(); }
    };
  }

  return { ROSTER: ROSTER, ORDER: ORDER, CELL: CELL, ANCHOR: ANCHOR, Character: Character, create: create, mount: mount, rowOffset: rowOffset };
}));
