// Uplink — core: canvas, input, audio, save, text helpers. Everything hangs off window.U.
(function () {
  const U = (window.U = {});
  U.TILE = 16;
  U.SCALE = 2; // world pixels -> screen pixels
  U.W = 768;
  U.H = 432;
  U.VW = U.W / U.SCALE; // view size in world pixels
  U.VH = U.H / U.SCALE;

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  canvas.width = U.W;
  canvas.height = U.H;
  U.canvas = canvas;
  U.ctx = canvas.getContext('2d');

  function fit() {
    const s = Math.min(window.innerWidth / U.W, window.innerHeight / U.H);
    stage.style.width = Math.floor(U.W * s) + 'px';
    stage.style.height = Math.floor(U.H * s) + 'px';
    stage.style.setProperty('--s', s.toFixed(3));
  }
  window.addEventListener('resize', fit);
  fit();

  // ---- input: physical keys map to actions; U.keys = held, U.pressed = this frame ----
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'act', Enter: 'act', KeyZ: 'act', KeyE: 'act',
    Escape: 'back', KeyX: 'back',
    KeyC: 'companion', KeyM: 'mute', KeyR: 'retry', KeyN: 'new',
    ShiftLeft: 'run', ShiftRight: 'run',
  };
  U.keys = {};
  U.pressed = {};
  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (!U.keys[k]) U.pressed[k] = true;
    U.keys[k] = true;
    U.audio.init();
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) U.keys[k] = false;
  });
  window.addEventListener('blur', () => U.clearInput());
  U.hit = (k) => !!U.pressed[k];
  U.clearInput = () => {
    for (const k in U.keys) U.keys[k] = false;
    U.pressed = {};
  };
  U.endFrame = () => {
    U.pressed = {};
  };

  // ---- audio: tiny WebAudio chiptune synth ----
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const beat = (p) => p.flatMap((n) => [n, 0, n, 0]);
  const TRACKS = {
    title: {
      bpm: 84,
      melody: [69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 0, 72, 0, 0, 71, 0, 69, 0, 0, 72, 0, 0, 76, 0, 79, 0, 0, 77, 0, 0, 76, 0],
      bass: beat([45, 45, 41, 43, 45, 45, 41, 40]),
    },
    pune: {
      bpm: 112,
      melody: [74, 0, 78, 0, 81, 0, 78, 76, 74, 0, 71, 0, 74, 76, 0, 0, 78, 0, 81, 0, 83, 0, 81, 78, 76, 0, 74, 0, 71, 0, 0, 0],
      bass: beat([50, 50, 55, 57, 47, 47, 55, 57]),
    },
    mini: {
      bpm: 140,
      melody: [72, 76, 79, 76, 72, 76, 79, 84, 81, 79, 76, 72, 74, 76, 74, 0, 72, 76, 79, 76, 72, 76, 79, 84, 86, 84, 81, 79, 76, 74, 72, 0],
      bass: beat([48, 48, 53, 55, 48, 48, 53, 55]),
    },
  };

  U.audio = {
    ctx: null,
    master: null,
    muted: false,
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      if (this.music.pending) this.music.play(this.music.pending);
    },
    tone(freq, dur, type, vol, at) {
      if (!this.ctx) return;
      const t = at || this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol || 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    sfx(name) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const seq = (notes, step, type, vol) => notes.forEach((m, i) => this.tone(midi(m), step * 1.2, type, vol, now + i * step));
      switch (name) {
        case 'blip': this.tone(1200, 0.025, 'square', 0.025); break;
        case 'move': this.tone(700, 0.04, 'square', 0.05); break;
        case 'select': seq([76, 83], 0.06, 'square', 0.08); break;
        case 'good': seq([72, 76, 79, 84], 0.06, 'square', 0.08); break;
        case 'bad': this.tone(140, 0.3, 'sawtooth', 0.08); break;
        case 'badge': seq([72, 76, 79, 84, 79, 84, 88], 0.09, 'square', 0.1); break;
        case 'door': seq([60, 55], 0.08, 'triangle', 0.15); break;
        case 'boot': seq([48, 55, 60, 64, 67, 72, 76, 79, 84], 0.14, 'triangle', 0.15); break;
        case 'open': seq([79, 86], 0.05, 'sine', 0.1); break;
      }
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    },
  };

  U.audio.music = {
    name: null,
    track: null,
    timer: null,
    pending: null,
    play(name) {
      const a = U.audio;
      if (this.name === name && this.timer) return;
      this.stop();
      if (!a.ctx) {
        this.pending = name;
        return;
      }
      this.pending = null;
      this.name = name;
      this.track = TRACKS[name];
      this.step = 0;
      this.next = a.ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.tick(), 25);
    },
    stop() {
      clearInterval(this.timer);
      this.timer = null;
      this.name = null;
      this.pending = null;
    },
    tick() {
      const a = U.audio;
      const tr = this.track;
      const sd = 60 / tr.bpm / 4;
      if (this.next < a.ctx.currentTime - 0.2) this.next = a.ctx.currentTime + 0.05; // tab was asleep
      while (this.next < a.ctx.currentTime + 0.12) {
        const i = this.step % tr.melody.length;
        if (tr.melody[i]) a.tone(midi(tr.melody[i]), sd * 1.8, 'square', 0.03, this.next);
        const b = tr.bass[i % tr.bass.length];
        if (b) a.tone(midi(b), sd * 1.8, 'triangle', 0.08, this.next);
        this.next += sd;
        this.step++;
      }
    },
  };

  // ---- save ----
  U.save = {
    key: 'uplink.save.v1',
    load() {
      try {
        return JSON.parse(localStorage.getItem(this.key));
      } catch (e) {
        return null;
      }
    },
    write(s) {
      try {
        localStorage.setItem(this.key, JSON.stringify(s));
      } catch (e) {}
    },
    clear() {
      try {
        localStorage.removeItem(this.key);
      } catch (e) {}
    },
  };

  // ---- misc helpers ----
  U.rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  };

  // ---- text & UI (screen space) ----
  U.font = (size, pixel) => `${size}px ${pixel ? '"Press Start 2P"' : '"VT323"'}, monospace`;
  U.text = (str, x, y, o = {}) => {
    const c = U.ctx;
    c.font = U.font(o.size || 24, o.pixel);
    c.textAlign = o.align || 'left';
    c.textBaseline = 'top';
    if (o.shadow !== false) {
      c.fillStyle = o.shadowColor || 'rgba(0,0,0,0.6)';
      c.fillText(str, x + 2, y + 2);
    }
    c.fillStyle = o.color || '#fff';
    c.fillText(str, x, y);
  };
  U.wrap = (str, maxW, size, pixel) => {
    const c = U.ctx;
    c.font = U.font(size, pixel);
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (line && c.measureText(test).width > maxW) {
          out.push(line);
          line = word;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  };
  // Largest size <= `size` at which `str` fits in maxW on one line.
  U.fit = (str, maxW, size, pixel) => {
    const c = U.ctx;
    let s = size;
    c.font = U.font(s, pixel);
    while (s > 12 && c.measureText(str).width > maxW) {
      s--;
      c.font = U.font(s, pixel);
    }
    return s;
  };
  U.panel = (x, y, w, h, o = {}) => {
    const c = U.ctx;
    c.fillStyle = o.outline || '#0b0a12';
    c.fillRect(x - 4, y - 4, w + 8, h + 8);
    c.fillStyle = o.border || '#f4ead5';
    c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = o.fill || '#1b1830';
    c.fillRect(x, y, w, h);
  };
})();
