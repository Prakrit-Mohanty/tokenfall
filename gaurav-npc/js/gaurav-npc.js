/*!
 * gaurav-npc.js — Gaurav (3D chibi) NPC for Tokenfall.
 * He wanders, stops now and then to say a quote, and says one every time the player walks up to him.
 * No dependencies. Works as <script>, ES import (via bundler) or require().
 *
 *   const npc = new GauravNPC.NPC(img, { x: 300, y: 400 });
 *   // every frame:
 *   npc.update(dtMs, { player: { x, y }, bounds: { minX, maxX, minY, maxY } });
 *   npc.draw(ctx);          // sprite + shadow + name tag + speech bubble
 *   npc.say();              // make him talk now (e.g. on click / E key)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GauravNPC = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Atlas: cell 250x230, feet anchor (125,222), standing height 172 px. 4 rows per animation: down, up, left, right.
  var DATA = {
    cell: { w: 250, h: 230 }, anchor: { x: 125, y: 222 },
    animations: {
      idle: { row: 0, frames: 11, ms: 200 },
      walk: { row: 4, frames: 10, ms: 95 },
      talk: { row: 8, frames: 4,  ms: 320 }   // rest, half-raise, open hands, half-raise
    }
  };
  var DIR = { down: 0, up: 1, left: 2, right: 3 };

  // Edit these. Hindi (Devanagari) or anything else is fine.
  var QUOTES = [
    'जल्दी का काम शैतान का।',
    'बूँद-बूँद से घड़ा भरता है।',
    'करत-करत अभ्यास के, जड़मति होत सुजान।',
    'अधजल गगरी छलकत जाय।',
    'जहाँ चाह, वहाँ राह।',
    'धीरे-धीरे रे मना, धीरे सब कुछ होय।',
    'अब पछताए होत क्या, जब चिड़िया चुग गई खेत।',
    'नाच न जाने आँगन टेढ़ा।',
    'मेहनत का फल मीठा होता है।',
    'काम ही पूजा है।'
  ];

  function NPC(image, opts) {
    opts = opts || {};
    this.image = image;
    this.data = DATA;
    this.x = opts.x == null ? 300 : opts.x;
    this.y = opts.y == null ? 400 : opts.y;
    this.scale = opts.scale == null ? 1 : opts.scale;          // number, or function(y) -> number for perspective
    this.speed = opts.speed == null ? 75 : opts.speed;          // px/s
    this.quotes = opts.quotes || QUOTES.slice();
    this.talkMs = opts.talkMs == null ? 3800 : opts.talkMs;    // how long a bubble stays up
    this.nearDist = opts.nearDist == null ? 130 : opts.nearDist; // "approached" distance
    this.ambient = opts.ambient !== false;                      // say lines on his own while wandering
    this.wander = opts.wander !== false;
    this.name = opts.name == null ? 'Gaurav' : opts.name;      // null hides the tag
    this.font = opts.font || "600 15px 'Noto Sans Devanagari', system-ui, sans-serif";
    this.onSay = opts.onSay || null;
    this.dir = 'down'; this.mode = 'idle'; this.t = 0; this.modeT = 0; this.wait = 2500;
    this.tx = this.x; this.ty = this.y; this.qi = Math.floor(Math.random() * this.quotes.length);
    this.quote = ''; this.cool = 3000; this.nextTalk = 7000; this.wasNear = false;
    this.frame = 0;
  }
  NPC.QUOTES = QUOTES;
  NPC.prototype.k = function (y) { return typeof this.scale === 'function' ? this.scale(y == null ? this.y : y) : this.scale; };
  NPC.prototype.face = function (p) {
    var dx = p.x - this.x, dy = p.y - this.y;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  NPC.prototype.say = function (text, player) {
    if (player) this.face(player);
    this.mode = 'talk'; this.modeT = 0;
    this.quote = text || this.quotes[this.qi++ % this.quotes.length];
    this.cool = this.talkMs + 600; this.nextTalk = 9000 + Math.random() * 7000;
    if (this.onSay) this.onSay(this.quote);
  };
  NPC.prototype.update = function (dt, env) {
    env = env || {};
    var p = env.player, b = env.bounds || { minX: 60, maxX: 800, minY: 200, maxY: 700 };
    this.t += dt; this.modeT += dt; this.cool -= dt; this.nextTalk -= dt;
    var near = !!p && Math.hypot(p.x - this.x, (p.y - this.y) * 1.3) < this.nearDist * this.k();
    var arrived = near && !this.wasNear; this.wasNear = near;
    if (this.mode === 'talk') {
      if (near) this.face(p);
      if (this.modeT > this.talkMs) { this.mode = 'idle'; this.modeT = 0; this.wait = 1500 + Math.random() * 2000; }
    } else if (arrived && this.cool <= 0) {
      this.say(null, p);
    } else if (this.ambient && this.nextTalk <= 0) {
      this.say();
    } else {
      if (this.mode === 'idle' && this.wander && this.modeT > this.wait) {
        this.tx = b.minX + Math.random() * (b.maxX - b.minX);
        this.ty = b.minY + Math.random() * (b.maxY - b.minY);
        this.mode = 'walk'; this.modeT = 0;
      }
      if (this.mode === 'walk') {
        if (near) { this.mode = 'idle'; this.modeT = 0; this.wait = 800; this.face(p); }
        else {
          var dx = this.tx - this.x, dy = this.ty - this.y, v = this.speed * this.k() * dt / 1000;
          if (Math.hypot(dx, dy) <= v) { this.x = this.tx; this.y = this.ty; this.mode = 'idle'; this.modeT = 0; this.wait = 1500 + Math.random() * 3000; }
          else if (Math.abs(dx) > 2) { this.x += Math.sign(dx) * Math.min(v, Math.abs(dx)); this.dir = dx > 0 ? 'right' : 'left'; }  // one axis at a time
          else { this.y += Math.sign(dy) * Math.min(v, Math.abs(dy)); this.dir = dy > 0 ? 'down' : 'up'; }
        }
      }
    }
    var A = this.data.animations[this.mode];
    this.frame = Math.floor((this.mode === 'idle' ? this.t : this.modeT) / A.ms) % A.frames;
    return { mode: this.mode, dir: this.dir, frame: this.frame, talking: this.mode === 'talk', quote: this.mode === 'talk' ? this.quote : '' };
  };
  NPC.prototype.draw = function (ctx) {
    var D = this.data, A = D.animations[this.mode], k = this.k(), cw = D.cell.w, ch = D.cell.h;
    var row = A.row + DIR[this.dir];
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath();
    ctx.ellipse(this.x, this.y - 2 * k, 40 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (this.image && this.image.complete) {
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.image, this.frame * cw, row * ch, cw, ch,
        Math.round(this.x - D.anchor.x * k), Math.round(this.y + 2 - D.anchor.y * k), cw * k, ch * k);
      ctx.restore();
    }
    var top = this.y - 172 * k;
    if (this.mode === 'talk') this.drawBubble(ctx, this.quote, this.x, top - 8);
    else if (this.name) this.drawTag(ctx, this.name, this.x, top - 14);
  };
  NPC.prototype.drawTag = function (ctx, text, cx, y) {
    ctx.save(); ctx.font = "600 13px system-ui, sans-serif";
    var w = ctx.measureText(text).width + 20;
    ctx.fillStyle = 'rgba(21,19,29,0.85)'; roundRect(ctx, cx - w / 2, y - 22, w, 24, 6); ctx.fill();
    ctx.fillStyle = '#E9935A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, y - 10);
    ctx.restore();
  };
  NPC.prototype.drawBubble = function (ctx, text, cx, bottom) {
    ctx.save(); ctx.font = this.font;
    var maxW = 240, lines = wrap(ctx, text, maxW), lh = 22, padX = 14, padY = 10;
    var w = Math.min(maxW, Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }))) + padX * 2;
    var h = lines.length * lh + padY * 2;
    var cw = ctx.canvas.width / (ctx.getTransform ? ctx.getTransform().a : 1);
    var x = Math.max(6, Math.min(cw - w - 6, cx - w / 2)), y = Math.max(6, bottom - 10 - h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, x, y + 4, w, h, 12); ctx.fill();
    ctx.fillStyle = '#FFF8EC'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 9, y + h); ctx.lineTo(cx + 9, y + h); ctx.lineTo(cx, y + h + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1E1B29'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach(function (l, i) { ctx.fillText(l, x + w / 2, y + padY + lh * i + lh / 2); });
    ctx.restore();
  };
  function wrap(ctx, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- mount(): demo widget. A simple "you" marker walks with arrows/WASD; Gaurav reacts. ----------
  function mount(container, opts) {
    opts = opts || {};
    var doc = container.ownerDocument || document;
    var W = opts.width || 860, H = opts.height || 620;
    var canvas = doc.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.tabIndex = 0;
    canvas.style.cssText = 'width:100%;max-width:' + W + 'px;aspect-ratio:' + W + '/' + H + ';border-radius:12px;outline:none;cursor:pointer';
    canvas.setAttribute('aria-label', 'Gaurav NPC demo. Arrow keys or WASD move the player marker. Walk up to Gaurav or click him.');
    container.appendChild(canvas);
    var img = new Image(); img.src = opts.src || 'sprites/gaurav.webp';
    var npc = new NPC(img, Object.assign({ x: W * 0.35, y: H * 0.6 }, opts.npc || {}));
    var you = { x: W * 0.75, y: H * 0.75 }, held = {};
    var bounds = { minX: 80, maxX: W - 80, minY: 230, maxY: H - 20 };
    var KM = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    var kd = function (e) { var k = KM[(e.key || '').toLowerCase()]; if (k) { e.preventDefault(); held[k] = true; } };
    var ku = function (e) { var k = KM[(e.key || '').toLowerCase()]; if (k) held[k] = false; };
    canvas.addEventListener('keydown', kd); canvas.addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', function (e) {
      canvas.focus(); var r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
      if (Math.abs(px - npc.x) < 45 && py > npc.y - 180 && py < npc.y + 5) npc.say(null, you);
    });
    var ctx = canvas.getContext('2d'), last = 0, raf = 0, alive = true;
    function frame(t) {
      if (!alive) return;
      var dt = last ? Math.min(50, t - last) : 16; last = t;
      var v = 200 * dt / 1000;
      you.x = Math.max(bounds.minX, Math.min(bounds.maxX, you.x + ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * v));
      you.y = Math.max(bounds.minY, Math.min(bounds.maxY, you.y + ((held.down ? 1 : 0) - (held.up ? 1 : 0)) * v));
      npc.update(dt, { player: you, bounds: bounds });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = opts.background || '#335C44'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2;
      for (var gx = 0; gx <= W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy <= H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      var drawYou = function () {
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(you.x, you.y, 22, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#E9935A'; ctx.beginPath(); ctx.arc(you.x, you.y - 22, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#15131D'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('you', you.x, you.y - 18);
      };
      if (you.y < npc.y) { drawYou(); npc.draw(ctx); } else { npc.draw(ctx); drawYou(); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if (opts.autofocus !== false) setTimeout(function () { try { canvas.focus({ preventScroll: true }); } catch (e) {} }, 0);
    return { npc: npc, canvas: canvas, destroy: function () { alive = false; cancelAnimationFrame(raf); canvas.remove(); } };
  }

  return { NPC: NPC, mount: mount, DATA: DATA, QUOTES: QUOTES };
}));
