/*!
 * sudhanshu3d.js — Sudhanshu (3D chibi) sprite player for Tokenfall.
 * No dependencies. Works as <script>, ES import (via bundler) or require().
 *
 *   const ctl = Sudhanshu3D.mount(el, { src: 'sprites/sudhanshu3d.webp' });   // full playable widget
 *   // or low level:
 *   const hero = new Sudhanshu3D.Character(img, { x: 400, y: 400 });
 *   hero.setInput({ right: true, run: false }); hero.do('jump');
 *   hero.update(dtMs, { width, height }); hero.draw(ctx);
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sudhanshu3D = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Atlas layout. Cell 250x230, feet anchor (125,222). Standing height 172px.
  // Directional animations take 4 rows: down, up, left, right. Front-only ones take 1 row.
  var DATA = {
    cell: { w: 250, h: 230 }, anchor: { x: 125, y: 222 },
    animations: {
      idle:      { frames: 11, directional: true, row: 0,  ms: 160, loop: true },
      walk:      { frames: 11, directional: true, row: 4,  ms: 83,  loop: true },
      run:       { frames: 10, directional: true, row: 8,  ms: 60,  loop: true },
      jump:      { frames: 11, directional: true, row: 12, ms: 80,  air: [3, 7], lift: 34 },
      nap:       { frames: 12, directional: true, row: 16, ms: 180, loopFrom: 7, loopTo: 8, loopMs: 650 },
      celebrate: { frames: 12, directional: true, row: 20, ms: 95 }
    }
  };
  var DIR = { down: 0, up: 1, left: 2, right: 3 };
  var POSES = ['nap'];                       // toggle on/off, hold a frame
  var SHOTS = ['jump', 'celebrate']; // play once, then idle
  var LABELS = {
    idle: 'Idle', walk: 'Walking', run: 'Running', jump: 'Jumping', faint: 'Fainted', crouch: 'Crouching',
    sit: 'Sitting', interact: 'Interacting', celebrate: 'Celebrating', nap: 'Napping',
    pickup: 'Picking up a coin', box: 'Putting the box down', trip: 'Tripped'
  };
  var ACTIONS = [
    { id: 'jump', label: 'Jump', key: 'Space' }, { id: 'run', label: 'Run', key: 'Shift' },
    { id: 'celebrate', label: 'Celebrate', key: 'E' }, { id: 'nap', label: 'Nap', key: 'Z' }
  ];
  var KEYMAP = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  var KEYACT = { ' ': 'jump', e: 'celebrate', z: 'nap' };

  function Character(image, opts) {
    opts = opts || {};
    this.image = image;
    this.data = opts.data || DATA;
    this.scale = opts.scale == null ? 1 : opts.scale;
    this.speed = opts.speed == null ? 200 : opts.speed;   // px/s at scale 1
    this.runMult = opts.runMult == null ? 1.8 : opts.runMult;
    this.x = opts.x == null ? 400 : opts.x;
    this.y = opts.y == null ? 400 : opts.y;
    this.dir = opts.dir || 'down';
    this.shadow = opts.shadow !== false;
    this.onState = opts.onState || null;
    this.input = { up: false, down: false, left: false, right: false, run: false };
    this.pose = null; this.poseT = 0;
    this.shot = null; this.shotT = 0;
    this.t = 0; this.moving = false;
    this._last = '';
    this.state = { anim: 'idle', dir: this.dir, frame: 0, label: 'Idle', lift: 0 };
  }
  Character.prototype.setInput = function (o) { for (var k in o) this.input[k] = !!o[k]; };
  Character.prototype.trigger = function (name) {
    var A = this.data.animations[name]; if (!A) return;
    this.pose = null; this.shot = name; this.shotT = 0;
    if (!A.directional) this.dir = 'down';
  };
  Character.prototype.toggle = function (name) {
    var A = this.data.animations[name]; if (!A) return;
    this.shot = null;
    this.pose = this.pose === name ? null : name; this.poseT = 0;
    if (this.pose && !A.directional) this.dir = 'down';
  };
  Character.prototype.do = function (name) {
    if (name === 'run') { this.input.run = !this.input.run; return; }
    if (POSES.indexOf(name) >= 0) this.toggle(name); else if (SHOTS.indexOf(name) >= 0) this.trigger(name);
  };
  Character.prototype.stop = function () { this.pose = null; this.shot = null; };
  Character.prototype.update = function (dt, bounds) {
    var I = this.input, A = this.data.animations;
    var dx = (I.right ? 1 : 0) - (I.left ? 1 : 0), dy = (I.down ? 1 : 0) - (I.up ? 1 : 0);
    this.moving = dx !== 0 || dy !== 0;
    this.t += dt;
    if (this.moving) {
      if (this.shot !== 'jump') this.shot = null;
      this.pose = null;
      var len = Math.sqrt(dx * dx + dy * dy), v = this.speed * this.scale * (I.run ? this.runMult : 1) * dt / 1000;
      this.x += dx / len * v; this.y += dy / len * v;
      if (bounds) {
        var m = 50 * this.scale;
        this.x = Math.max(m, Math.min(bounds.width - m, this.x));
        this.y = Math.max(180 * this.scale, Math.min(bounds.height - 10, this.y));
      }
      this.dir = dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (this.pose) this.poseT += dt;
    if (this.shot) {
      this.shotT += dt;
      var S = A[this.shot];
      if (this.shotT > S.frames * S.ms + (this.shot === 'jump' ? 0 : 150)) this.shot = null;
    }
    // resolve animation + frame
    var anim = 'idle', frame = 0, lift = 0, a;
    if (this.moving) { anim = I.run ? 'run' : 'walk'; a = A[anim]; frame = Math.floor(this.t / a.ms) % a.frames; }
    else { a = A.idle; frame = Math.floor(this.t / a.ms) % a.frames; }
    if (this.pose) {
      anim = this.pose; a = A[anim]; var pt = this.poseT;
      if (a.loopFrom != null) {
        var intro = a.loopFrom + 1;
        frame = pt < intro * a.ms ? Math.floor(pt / a.ms) : a.loopFrom + Math.floor((pt - intro * a.ms) / a.loopMs) % (a.loopTo - a.loopFrom + 1);
      } else frame = Math.min(a.hold != null ? a.hold : a.frames - 1, Math.floor(pt / a.ms));
    }
    if (this.shot) {
      anim = this.shot; a = A[anim];
      var ft = this.shotT / a.ms; frame = Math.min(a.frames - 1, Math.floor(ft));
      if (a.air && ft >= a.air[0] && ft <= a.air[1] + 1) lift = Math.sin((ft - a.air[0]) / (a.air[1] + 1 - a.air[0]) * Math.PI) * a.lift;
    }
    this.state = { anim: anim, dir: this.dir, frame: frame, label: LABELS[anim], lift: lift, running: !!I.run };
    var sig = anim + this.dir + (I.run ? 1 : 0);
    if (this.onState && sig !== this._last) { this._last = sig; this.onState(this.state); }
    return this.state;
  };
  Character.prototype.draw = function (ctx) {
    var D = this.data, s = this.state, A = D.animations[s.anim], k = this.scale;
    var row = A.row + (A.directional ? DIR[s.dir] : 0);
    var cw = D.cell.w, ch = D.cell.h;
    if (this.shadow) {
      var sh = 1 - s.lift / 180;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath();
      ctx.ellipse(this.x, this.y - 2 * k, 40 * k * sh, 9 * k * sh, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (!this.image || !this.image.complete) return;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.image, s.frame * cw, row * ch, cw, ch,
      Math.round(this.x - D.anchor.x * k), Math.round(this.y - D.anchor.y * k - s.lift * k), cw * k, ch * k);
    ctx.restore();
  };

  // ---------- mount(): full widget with canvas, keyboard, buttons ----------
  function mount(container, opts) {
    opts = opts || {};
    var doc = container.ownerDocument || document;
    var W = opts.width || 860, H = opts.height || 620;
    var wrap = doc.createElement('div');
    wrap.style.cssText = 'position:relative;display:flex;flex-direction:column;gap:12px;font-family:system-ui,sans-serif;color:#EDE9F7';
    var canvas = doc.createElement('canvas');
    var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.cssText = 'width:100%;max-width:' + W + 'px;aspect-ratio:' + W + '/' + H + ';border-radius:12px;outline:none;touch-action:none;cursor:pointer';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Sudhanshu play field. Arrow keys or WASD walk, Shift runs, Space jumps.');
    wrap.appendChild(canvas);
    var bar = null;
    if (opts.buttons !== false) {
      bar = doc.createElement('div');
      bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-width:' + W + 'px';
      ACTIONS.forEach(function (a) {
        var b = doc.createElement('button'); b.type = 'button';
        b.textContent = a.label + ' · ' + a.key; b.dataset.act = a.id;
        b.style.cssText = 'height:40px;padding:0 14px;border-radius:8px;border:0;background:#2A2638;color:#EDE9F7;font:600 14px system-ui,sans-serif;cursor:pointer';
        b.addEventListener('click', function () { hero.do(a.id); paintRun(); canvas.focus(); });
        bar.appendChild(b);
      });
      var pad = doc.createElement('div'); pad.style.cssText = 'display:flex;gap:6px;margin-left:auto';
      [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']].forEach(function (p) {
        var b = doc.createElement('button'); b.type = 'button'; b.textContent = p[1]; b.setAttribute('aria-label', 'Walk ' + p[0]);
        b.style.cssText = 'width:44px;height:40px;border-radius:8px;border:0;background:#2A2638;color:#EDE9F7;font-size:16px;cursor:pointer;touch-action:none';
        var on = function (e) { e.preventDefault(); var o = {}; o[p[0]] = true; hero.setInput(o); };
        var off = function () { var o = {}; o[p[0]] = false; hero.setInput(o); };
        b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, off); });
        pad.appendChild(b);
      });
      bar.appendChild(pad);
      wrap.appendChild(bar);
    }
    container.appendChild(wrap);
    function paintRun() {
      if (!bar) return; var b = bar.querySelector('[data-act="run"]');
      if (b) { b.textContent = 'Run' + (hero.input.run && !shiftDown ? ': on' : '') + ' · Shift'; }
    }
    var img = new Image();
    img.src = opts.src || 'sprites/sudhanshu3d.webp';
    var hero = new Character(img, { x: W / 2, y: H * 0.7, scale: opts.scale || 1, speed: opts.speed, onState: opts.onState });
    var ctx = canvas.getContext('2d');
    var bg = opts.background === undefined ? '#335C44' : opts.background;
    var shiftDown = false, runToggle = false;
    function key(e, down) {
      var k = (e.key || '').toLowerCase();
      shiftDown = !!e.shiftKey; hero.input.run = shiftDown || runToggle;
      if (KEYMAP[k]) { e.preventDefault(); var o = {}; o[KEYMAP[k]] = down; hero.setInput(o); return; }
      if (!down || e.repeat) return;
      if (KEYACT[k]) { e.preventDefault(); hero.do(KEYACT[k]); }
    }
    var kd = function (e) { key(e, true); }, ku = function (e) { key(e, false); };
    var target = opts.keyboard === 'window' ? window : canvas;
    if (opts.keyboard !== false) { target.addEventListener('keydown', kd); target.addEventListener('keyup', ku); }
    canvas.addEventListener('blur', function () { hero.setInput({ up: false, down: false, left: false, right: false }); });
    canvas.addEventListener('pointerdown', function () { canvas.focus(); });
    var origDo = hero.do.bind(hero);
    hero.do = function (n) { if (n === 'run') { runToggle = !runToggle; hero.input.run = runToggle; paintRun(); return; } origDo(n); };
    var raf = 0, last = 0, alive = true;
    function frame(t) {
      if (!alive) return;
      var dt = last ? Math.min(50, t - last) : 16; last = t;
      hero.update(dt, { width: W, height: H });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (bg) {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2;
        for (var gx = 0; gx <= W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (var gy = 0; gy <= H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      }
      hero.draw(ctx);
      if (opts.hud !== false) {
        ctx.font = '600 14px system-ui,sans-serif'; ctx.fillStyle = 'rgba(21,19,29,0.8)';
        var txt = 'Sudhanshu · facing ' + hero.state.dir + ' · ' + hero.state.label;
        var tw = ctx.measureText(txt).width; ctx.fillRect(12, 12, tw + 20, 28);
        ctx.fillStyle = '#EDE9F7'; ctx.fillText(txt, 22, 31);
        if (doc.activeElement !== canvas) {
          var hint = 'Click here · arrows/WASD walk · Shift runs · Space jumps';
          var hw = ctx.measureText(hint).width; ctx.fillStyle = 'rgba(21,19,29,0.85)';
          ctx.fillRect(W / 2 - hw / 2 - 14, H - 52, hw + 28, 32); ctx.fillStyle = '#EDE9F7'; ctx.fillText(hint, W / 2 - hw / 2, H - 31);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if (opts.autofocus !== false) setTimeout(function () { try { canvas.focus({ preventScroll: true }); } catch (e) {} }, 0);
    return {
      hero: hero, canvas: canvas, actions: ACTIONS,
      do: function (n) { hero.do(n); },
      destroy: function () {
        alive = false; cancelAnimationFrame(raf);
        if (opts.keyboard !== false) { target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); }
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    };
  }

  return { Character: Character, mount: mount, DATA: DATA, ACTIONS: ACTIONS, LABELS: LABELS, POSES: POSES, SHOTS: SHOTS };
}));
