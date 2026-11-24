/*!
 * Tokenfall Launcher — standalone, zero dependencies.
 * A cosy, toy-like retro PC on a sunny office desk (Three.js); power it on to boot into the Tokenfall menu.
 *
 *   <div id="launcher" style="width:100%;height:100vh"></div>
 *   <script src="tokenfall-launcher.js"><\/script>
 *   <script>
 *     TokenfallLauncher.mount(document.getElementById('launcher'), {
 *       onStart: function () { location.href = '/game'; }
 *     });
 *   <\/script>
 *
 * Also works as an ES/CommonJS import:  import TokenfallLauncher from './tokenfall-launcher.js'
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TokenfallLauncher = api;
})(this, function () {
'use strict';
var DESIGN_W = 1280, DESIGN_H = 800;
function DCLogic() {}
DCLogic.prototype.setState = function (o) { Object.assign(this.state, o); this._render && this._render(); };
DCLogic.prototype.forceUpdate = function () { this._render && this._render(); };

var MENU = ['START', 'CONTROLS', 'SETTINGS'];
var MENU_START = 0, MENU_CONTROLS = 1, MENU_SETTINGS = 2;
var VOLS = [['LOW', 0.22], ['MEDIUM', 0.45], ['HIGH', 0.75]];
function sanitizeCfg(sv) {
  var vol = Number.isInteger(sv.vol) && sv.vol >= 0 && sv.vol < VOLS.length ? sv.vol : 1;
  return { vol: vol, sfx: sv.sfx !== false, motion: sv.motion !== false, scan: sv.scan !== false };
}

/* ---------- tiny chiptune: square lead, pulse arp, triangle bass, noise drums ---------- */
// calm lo-fi loop in C: Fmaj7 - Em7 - Dm7 - Cmaj7, twice
var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
var ROOTS = [41, 40, 38, 36];
var ARP = [0, 1, 2, 3, 2, 1, 2, 3];
var LEAD = [
  [0, 72, 4], [4, 76, 4], [8, 74, 6], [14, 72, 2],
  [16, 71, 4], [20, 67, 4], [24, 74, 8],
  [32, 72, 4], [36, 69, 4], [40, 77, 6], [46, 76, 2],
  [48, 76, 12], [60, 72, 4],
  [64, 81, 4], [68, 79, 4], [72, 76, 8],
  [80, 79, 4], [84, 76, 4], [88, 74, 8],
  [96, 77, 4], [100, 76, 4], [104, 74, 4], [108, 72, 4],
  [112, 72, 16]
];
function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function Chip() {
  var AC = window.AudioContext || window.webkitAudioContext;
  this.ctx = new AC();
  this.master = this.ctx.createGain(); this.master.gain.value = 0; this.master.connect(this.ctx.destination);
  var len = this.ctx.sampleRate * 0.3, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  this.noise = buf;
  var real = new Float32Array(32), imag = new Float32Array(32);
  for (var n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
  this.pulse = this.ctx.createPeriodicWave(real, imag);
  this.step = 0; this.next = 0; this.spb = 60 / 100 / 4;
  this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.ctx.destination);
}
Chip.prototype.tone = function (type, freq, t, dur, vol) {
  var o = this.ctx.createOscillator(), g = this.ctx.createGain();
  if (type === 'pulse') o.setPeriodicWave(this.pulse); else o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
};
Chip.prototype.hit = function (t, kick) {
  if (kick) {
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.14); return;
  }
  var s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g2 = this.ctx.createGain();
  s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000;
  g2.gain.setValueAtTime(0.05, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f); f.connect(g2); g2.connect(this.master); s.start(t); s.stop(t + 0.06);
};
Chip.prototype.schedule = function () {
  var c = this.ctx;
  if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
  while (this.next < c.currentTime + 0.15) {
    var st = this.step % 128, t = this.next, bar = Math.floor(st / 16) % 4, s16 = st % 16, self = this;
    LEAD.forEach(function (n) { if (n[0] === st) { self.tone('triangle', midiHz(n[1]), t, self.spb * n[2] * 0.95, 0.16); self.tone('pulse', midiHz(n[1] + 12), t, self.spb * n[2] * 0.6, 0.012); } });
    if (st % 2 === 0) this.tone('pulse', midiHz(CHORDS[bar][ARP[s16 / 2]] + 12), t, this.spb * 1.9, 0.022);
    if (s16 === 0) this.tone('triangle', midiHz(ROOTS[bar]), t, this.spb * 7.5, 0.24);
    if (s16 === 8) this.tone('triangle', midiHz(ROOTS[bar] + 7), t, this.spb * 7.5, 0.2);
    if (s16 === 0 || s16 === 10) this.hit(t, true);
    if (s16 === 4 || s16 === 12) this.hit(t, false);
    this.step++; this.next += this.spb;
  }
};
Chip.prototype.sfx = function (kind) {
  var c = this.ctx, t = c.currentTime + 0.005, self = this;
  if (c.state === 'suspended') c.resume();
  var blip = function (type, f0, f1, at, dur, vol) {
    var o = c.createOscillator(), g = c.createGain();
    if (type === 'pulse') o.setPeriodicWave(self.pulse); else o.type = type;
    o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g); g.connect(self.sfxGain); o.start(at); o.stop(at + dur + 0.02);
  };
  if (kind === 'move') blip('square', 880, 0, t, 0.045, 0.12);
  else if (kind === 'select') { blip('square', 660, 0, t, 0.06, 0.14); blip('square', 990, 0, t + 0.06, 0.09, 0.14); }
  else if (kind === 'back') { blip('square', 660, 0, t, 0.06, 0.12); blip('square', 440, 0, t + 0.06, 0.09, 0.12); }
  else if (kind === 'power') { blip('square', 160, 900, t, 0.25, 0.14); blip('pulse', 1320, 0, t + 0.27, 0.12, 0.08); }
  else if (kind === 'off') blip('square', 700, 90, t, 0.3, 0.12);
  else if (kind === 'start') [523, 659, 784, 1047].forEach(function (f, i) { blip('square', f, 0, t + i * 0.07, i === 3 ? 0.3 : 0.08, 0.13); });
};
Chip.prototype.start = function () {
  var self = this;
  if (this.ctx.state === 'suspended') this.ctx.resume();
  this.master.gain.cancelScheduledValues(this.ctx.currentTime);
  this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
  this.master.gain.linearRampToValueAtTime(this.vol == null ? 0.45 : this.vol, this.ctx.currentTime + 1.2);
  if (!this.timer) this.timer = setInterval(function () { self.schedule(); }, 25);
};
Chip.prototype.setVolume = function (v) {
  this.vol = v;
  if (!this.timer) return;
  var now = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(now); this.master.gain.setValueAtTime(this.master.gain.value, now);
  this.master.gain.linearRampToValueAtTime(v, now + 0.25);
};
Chip.prototype.stop = function () {
  var self = this, now = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(now);
  this.master.gain.setValueAtTime(this.master.gain.value, now);
  this.master.gain.linearRampToValueAtTime(0, now + 0.3);
  setTimeout(function () { if (self.timer) { clearInterval(self.timer); self.timer = null; } }, 350);
};
Chip.prototype.close = function () { if (this.timer) clearInterval(this.timer); try { this.ctx.close(); } catch (e) {} };
var BOOT = ['CALFUS-86 BIOS v1.0', 'MEMORY CHECK ... 640K OK', 'LOADING OFFICE ... OK', 'STARTING TOKENFALL'];

/* ---------- the PC, built from soft rounded Three.js shapes; the office around it is launcher/office-room.js ---------- */
var SCREEN = { x0: -30, x1: 30, y0: 12, y1: 57.8, z: -1 };
function drawStartScreen(g, w, h, blink) {
  var room = window.TokenfallOfficeRoom, F = room.FONT_UI;
  var bg = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.7);
  bg.addColorStop(0, '#3E7A72'); bg.addColorStop(1, '#1D3F45');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(190,255,220,.8)'; g.shadowBlur = 24;
  g.fillStyle = '#FFF1D6'; g.font = '600 ' + Math.round(h * 0.2) + 'px ' + F;
  g.fillText('TOKEN', w / 2, h * 0.3); g.fillText('FALL', w / 2, h * 0.5);
  g.shadowBlur = 0;
  room.rr(g, w * 0.2, h * 0.64, w * 0.6, 4, 2, 'rgba(190,255,220,.35)');
  if (blink) {
    g.shadowColor = 'rgba(255,160,190,.9)'; g.shadowBlur = 20;
    g.fillStyle = '#FFB3C6'; g.font = '600 ' + Math.round(h * 0.13) + 'px ' + F;
    g.fillText('▶ START', w / 2, h * 0.79);
  }
}
function buildPC(THREE) {
  var room = window.TokenfallOfficeRoom, group = new THREE.Group();
  var M = function (col, o) { return room.mat(THREE, col, o); };
  var add = function (parent, geo, material, x, y, z) { var m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  var box = function (parent, material, w, h, d, r, x, y, z) { return add(parent, room.roundedBox(THREE, w, h, d, r), material, x, y, z); };
  var black = M('#0B0C0E', { roughness: 0.6, metalness: 0 }), silver = M('#C9CCD2', { roughness: 0.3, metalness: 0.6 });
  var cy = (SCREEN.y0 + SCREEN.y1) / 2;
  // slim black flat monitor on a silver stand
  box(group, silver, 34, 1.6, 22, 0.8, 0, 0.8, -6);
  box(group, silver, 7, 34, 3, 1.4, 0, 18, -10).rotation.x = -0.08;
  box(group, silver, 12, 10, 3, 1.4, 0, cy - 6, SCREEN.z - 5);
  box(group, black, SCREEN.x1 - SCREEN.x0 + 4.4, SCREEN.y1 - SCREEN.y0 + 5.6, 2.6, 1.2, 0, cy - 0.6, SCREEN.z - 1.4);
  var scrGeo = new THREE.PlaneGeometry(SCREEN.x1 - SCREEN.x0, SCREEN.y1 - SCREEN.y0);
  var blink = true;
  var scrTex = room.canvasTex(THREE, 640, 488, function (g, w, h) { drawStartScreen(g, w, h, blink); });
  var screen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })); screen.position.set(0, cy, SCREEN.z); group.add(screen);
  var off = new THREE.Mesh(scrGeo, M('#16181C', { roughness: 0.2 })); off.position.set(0, cy, SCREEN.z - 0.05); group.add(off);
  var glowTex = room.canvasTex(THREE, 128, 128, function (g) {
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#9FF0C8', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(76, 60, 1); glow.position.set(0, cy, SCREEN.z + 1); group.add(glow);
  var led = add(group, new THREE.SphereGeometry(0.6, 10, 8), M('#555', { emissive: '#7CF29A', emissiveIntensity: 0 }), SCREEN.x1 - 2, SCREEN.y0 - 2.4, SCREEN.z + 0.1);
  // slim pale keyboard and mouse
  var kb = new THREE.Group(); kb.position.set(-4, 0, 16); kb.rotation.x = 0.04; group.add(kb);
  box(kb, M('#F2F0EA', { roughness: 0.45 }), 44, 1.4, 13, 0.6, 0, 0.7, 0);
  var capG = room.roundedBox(THREE, 2.6, 0.9, 2.4, 0.4), capM = M('#FFFFFF', { roughness: 0.4 });
  for (var r = 0; r < 4; r++) for (var k = 0; k < 14; k++) {
    if (r === 3 && k > 0 && k < 13 && k !== 4) continue;
    var wide = r === 3 && k === 4;
    var cap = add(kb, wide ? room.roundedBox(THREE, 2.6 + 3 * 8, 0.9, 2.4, 0.4) : capG, capM, -19.5 + k * 3 + (wide ? 12 : 0), 1.7, -4.5 + r * 3);
    cap.castShadow = false;
  }
  var mouse = add(group, new THREE.SphereGeometry(1, 24, 16), M('#F2F0EA', { roughness: 0.45 }), 30, 0, 18); mouse.scale.set(3.2, 1.8, 5);
  return {
    group: group, textures: [scrTex, glowTex],
    setOn: function (on, t) {
      screen.visible = !on;
      glow.material.color.set(on ? '#C9B6FF' : '#9FF0C8');
      led.material.emissiveIntensity = on ? 1.6 : 0.2;
      var b = Math.floor(t * 1.6) % 2 === 0;
      if (b !== blink) { blink = b; scrTex.redraw(); }
    }
  };
}

// camera orbits a target point; dist/fov set the zoom
var POSES = {
  idle: { dist: 360, fov: 50, pitch: -6, yaw: 2, tx: 0, ty: 84, tz: -20, swing: 4 },
  near: { dist: 150, fov: 30, pitch: 1, yaw: 0, tx: 0, ty: 34.9, tz: SCREEN.z },
  into: { dist: 36, fov: 30, pitch: 0, yaw: 0, tx: 0, ty: 34.9, tz: SCREEN.z }
};

class Component extends DCLogic {
  init() {
    if (this.ready) return;
    this.ready = true;
    this.state = { phase: 'off', sel: 0, step: 0 };
    this.cam = Object.assign({}, POSES.idle);
    this.t = 0;
    this.timers = [];
    this.ov = { l: 0, t: 0, w: 0, h: 0, o: 0 };
    var self = this;
    this.musicOn = true;
    this.cfg = { vol: 1, sfx: true, motion: true, scan: true };
    try { var sv = JSON.parse(localStorage.getItem('tokenfall.settings') || 'null'); if (sv && typeof sv === 'object') { this.musicOn = sv.music !== false; this.cfg = sanitizeCfg(sv); } } catch (e) {}
    this.settingsOpen = false; this.setSel = 0;
    this.saveCfg = function () { try { localStorage.setItem('tokenfall.settings', JSON.stringify(Object.assign({ music: self.musicOn }, self.cfg))); } catch (e) {} };
    this.ROWS = [
      { label: 'Music', get: function () { return self.musicOn ? 'ON' : 'OFF'; }, change: function () { self.toggleMusic(); } },
      { label: 'Volume', get: function () { return VOLS[self.cfg.vol][0]; }, change: function (dir) { self.cfg.vol = (self.cfg.vol + (dir || 1) + 3) % 3; if (self.chip) self.chip.setVolume(VOLS[self.cfg.vol][1]); } },
      { label: 'Sound effects', get: function () { return self.cfg.sfx ? 'ON' : 'OFF'; }, change: function () { self.cfg.sfx = !self.cfg.sfx; } },
      { label: 'Camera motion', get: function () { return self.cfg.motion ? 'ON' : 'OFF'; }, change: function () { self.cfg.motion = !self.cfg.motion; } },
      { label: 'Screen texture', get: function () { return self.cfg.scan ? 'ON' : 'OFF'; }, change: function () { self.cfg.scan = !self.cfg.scan; } }
    ];
    this.rowChange = this.ROWS.map(function (r, i) { return function (e, dir) { if (e && e.stopPropagation) e.stopPropagation(); self.setSel = i; r.change(typeof dir === 'number' ? dir : 1); if (i !== 0) self.sfx('select'); self.saveCfg(); self.forceUpdate(); }; });
    this.rowHover = this.ROWS.map(function (_, i) { return function () { if (self.setSel !== i) { self.setSel = i; self.sfx('move'); self.forceUpdate(); } }; });
    this.stop = function (e) { if (e && e.stopPropagation) e.stopPropagation(); };
    this.openSettings = function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.settingsOpen = true; self.setSel = 0; self.sfx('select'); self.focusRoot(); self.forceUpdate(); };
    this.closeSettings = function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.settingsOpen = false; self.sfx('back'); self.focusRoot(); self.forceUpdate(); };
    this.rootRef = function (el) { self.rootEl = el; };
    this.ensureMusic = function () {
      if (!self.musicOn) return;
      try { if (!self.chip) self.chip = new Chip(); self.chip.vol = VOLS[self.cfg.vol][1]; self.chip.start(); self.musicPlaying = true; } catch (e) {}
    };
    this.sfx = function (k) { if (!self.cfg.sfx) return; try { if (!self.chip) self.chip = new Chip(); self.chip.sfx(k); } catch (e) {} };
    this.onAnyInput = function () { if (!self.musicPlaying) { self.ensureMusic(); self.forceUpdate(); } };
    this.toggleMusic = function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      self.musicOn = !self.musicOn; self.sfx('select'); self.saveCfg();
      if (self.musicOn) self.ensureMusic();
      else if (self.chip) { self.chip.stop(); self.musicPlaying = false; }
      self.forceUpdate();
    };
    this.canvasRef = function (el) { self.canvasEl = el; };
    this.onPower = function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (self.state.phase === 'off') self.boot(); else self.reset(); };
    this.onPcClick = function () { if (self.state.phase === 'off') self.boot(); };
    this.toMenu = function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.sfx('back'); self.setState({ phase: 'menu' }); self.focusRoot(); };
    this.reset = function () { self.sfx('off'); self.clear(); self.setState({ phase: 'off', sel: 0, step: 0 }); };
    this.menuGo = MENU.map(function (_, i) { return function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.activate(i); }; });
    this.menuHover = MENU.map(function (_, i) { return function () { if (self.state.sel !== i) { self.sfx('move'); self.setState({ sel: i }); } }; });
    this.onKey = function (e) {
      if (!self.musicPlaying) { self.ensureMusic(); self.forceUpdate(); }
      var k = e.key, p = self.state.phase;
      if (self.settingsOpen) {
        var nR = self.ROWS.length;
        if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); self.closeSettings(); }
        else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); self.setSel = (self.setSel + 1) % nR; self.sfx('move'); self.forceUpdate(); }
        else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); self.setSel = (self.setSel + nR - 1) % nR; self.sfx('move'); self.forceUpdate(); }
        else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); self.rowChange[self.setSel](null, -1); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'Enter' || k === ' ') { e.preventDefault(); self.rowChange[self.setSel](null, 1); }
        return;
      }
      if (p === 'off' && (k === 'Enter' || k === ' ')) { e.preventDefault(); self.boot(); return; }
      if (p === 'menu') {
        if (k === 'ArrowDown' || k === 's') { e.preventDefault(); self.sfx('move'); self.setState({ sel: (self.state.sel + 1) % MENU.length }); }
        else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); self.sfx('move'); self.setState({ sel: (self.state.sel + MENU.length - 1) % MENU.length }); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); self.activate(self.state.sel); }
      } else if (p === 'controls' && (k === 'Escape' || k === 'Backspace' || k === 'Enter')) {
        e.preventDefault(); self.sfx('back'); self.setState({ phase: 'menu' });
      }
    };
  }
  clear() { this.timers.forEach(function (t) { clearTimeout(t); }); this.timers = []; }
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
  focusRoot() { var el = this.rootEl; if (el && el.focus) setTimeout(function () { el.focus({ preventScroll: true }); }, 0); }
  boot() {
    var self = this;
    this.sfx('power');
    this.clear();
    this.setState({ phase: 'boot', step: 0, sel: 0 });
    this.focusRoot();
    [1100, 1500, 1900, 2300, 2700].forEach(function (ms, i) { self.later(ms, function () { self.setState({ step: i + 1 }); }); });
    this.later(3200, function () { self.setState({ phase: 'menu' }); });
  }
  activate(i) {
    var self = this;
    this.sfx(i === MENU_START ? 'start' : 'select');
    if (i === MENU_START) { this.setState({ phase: 'zoom' }); this.later(1300, function () { self.setState({ phase: 'done' }); if (self.onEnter) self.onEnter(); }); }
    else if (i === MENU_SETTINGS) { this.settingsOpen = true; this.setSel = 0; this.forceUpdate(); }
    else if (i === MENU_CONTROLS) this.setState({ phase: 'controls' });
  }
  setupGL() {
    var THREE = window.THREE, cv = this.canvasEl;
    var r = this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.setPixelRatio(1);
    var scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, DESIGN_W / DESIGN_H, 2, 20000);
    this.room = window.TokenfallOfficeRoom.build(THREE); scene.add(this.room.group);
    scene.fog = this.room.fog; r.setClearColor(this.room.clear);
    this.pc = buildPC(THREE); scene.add(this.pc.group);
    var self = this;
    // canvas text waits for the rounded UI font
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 40px "Baloo 2"')]).then(function () { if (self.renderer) { self.room.redraw(); self.pc.textures[0].redraw(); } }).catch(function () {});
  }
  setPixelRatio(k) {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(3, (window.devicePixelRatio || 1) * k));
    this.renderer.setSize(DESIGN_W, DESIGN_H, false);
  }
  draw() {
    if (!this.renderer) return;
    var THREE = window.THREE, c = this.cam, cam = this.camera, on = this.state.phase !== 'off';
    var yaw = c.yaw * Math.PI / 180, pit = c.pitch * Math.PI / 180;
    cam.fov = c.fov; cam.updateProjectionMatrix();
    cam.position.set(c.tx + c.dist * Math.sin(yaw) * Math.cos(pit), c.ty + c.dist * Math.sin(pit), c.tz + c.dist * Math.cos(yaw) * Math.cos(pit));
    cam.lookAt(c.tx, c.ty, c.tz);
    cam.updateMatrixWorld();
    this.room.update(this.t, new Date());
    this.pc.setOn(on, this.t);
    this.renderer.render(this.scene, cam);
    // where the screen lands on the stage, for the HTML overlay
    var xs = [], ys = [], v = new THREE.Vector3();
    [[SCREEN.x0, SCREEN.y0], [SCREEN.x1, SCREEN.y0], [SCREEN.x1, SCREEN.y1], [SCREEN.x0, SCREEN.y1]].forEach(function (q) {
      v.set(q[0], q[1], SCREEN.z).project(cam); xs.push((v.x + 1) / 2 * DESIGN_W); ys.push((1 - v.y) / 2 * DESIGN_H);
    });
    var facing = Math.abs(c.yaw) < 1.5 && Math.abs(c.pitch) < 4 && c.dist < 230;
    this.ov = { l: Math.min.apply(0, xs), t: Math.min.apply(0, ys), w: Math.max.apply(0, xs) - Math.min.apply(0, xs), h: Math.max.apply(0, ys) - Math.min.apply(0, ys), o: on && facing ? 1 : 0 };
  }
  componentDidMount() {
    this.init();
    try { this.setupGL(); } catch (e) { this.renderer = null; console.error(e); }
    var self = this, last = 0, lastO = -1;
    var step = function (now) {
      var dt = last ? Math.min(50, now - last) / 1000 : 0.016;
      last = now; self.t += dt;
      var p = self.state.phase, target;
      if (p === 'off') {
        target = Object.assign({}, POSES.idle);
        if ((self.props.orbit ?? true) && self.cfg.motion) target.yaw = POSES.idle.yaw + Math.sin(self.t * 2 * Math.PI / 20) * POSES.idle.swing;
      } else if (p === 'zoom' || p === 'done') target = POSES.into;
      else target = POSES.near;
      var k = Math.min(1, dt * (p === 'zoom' ? 3.2 : 2.4)), c = self.cam;
      ['dist', 'fov', 'pitch', 'yaw', 'tx', 'ty', 'tz'].forEach(function (key) { c[key] += (target[key] - c[key]) * k; });
      if (p !== 'done') self.draw();
      var o = self.ov;
      if (o.o !== lastO || (o.o && (Math.abs(o.l - (self.lastL || 0)) > 0.5 || Math.abs(o.w - (self.lastW || 0)) > 0.5))) {
        lastO = o.o; self.lastL = o.l; self.lastW = o.w; self.forceUpdate();
      }
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  componentWillUnmount() {
    this.clear(); if (this.raf) cancelAnimationFrame(this.raf); if (this.chip) this.chip.close();
    if (this.renderer) {
      this.scene.traverse(function (o) { if (o.isMesh || o.isSprite) { if (o.geometry) o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer = null;
    }
  }
  renderVals() {
    this.init();
    var self = this, st = this.state, p = st.phase, o = this.ov;
    var on = p !== 'off';
    return {
      bg: '#F6E2C2',
      cursor: on ? 'default' : 'pointer',
      showSettings: this.settingsOpen,
      scanDisplay: this.cfg.scan ? 'block' : 'none',
      openSettings: this.openSettings, closeSettings: this.closeSettings, stop: this.stop,
      settingRows: this.ROWS.map(function (r, i) {
        var on3 = i === self.setSel, v = r.get();
        return { label: r.label, value: v, mark: on3 ? '▶' : '', change: self.rowChange[i], hover: self.rowHover[i],
          bg: on3 ? '#FFE7EC' : '#F7EBD8', color: on3 ? '#C9577A' : '#6B5B45', valColor: v === 'OFF' ? '#B3A28A' : '#5FA88E' };
      }),
      musicLabel: !this.musicOn ? '♪ Music: off' : this.musicPlaying ? '♪ Music: on' : '♪ Click to play music',
      musicPressed: this.musicOn && this.musicPlaying ? 'true' : 'false',
      onAnyInput: this.onAnyInput, toggleMusic: this.toggleMusic,
      ovLeft: o.l.toFixed(1), ovTop: o.t.toFixed(1), ovW: o.w.toFixed(1), ovH: o.h.toFixed(1),
      ovScale: (o.w / 552 || 0.01).toFixed(4), ovOpacity: o.o, ovPointer: o.o ? 'auto' : 'none',
      isOff: p === 'off',
      showOff: on && p !== 'done' && p !== 'zoom',
      isOn: on && p !== 'done',
      isBoot: p === 'boot',
      isMenu: p === 'menu',
      isControls: p === 'controls',
      isZoom: p === 'zoom',
      bootLines: BOOT.slice(0, Math.min(BOOT.length, st.step)).map(function (t) { return { text: t }; }),
      bootPct: Math.min(100, st.step * 20),
      menu: MENU.map(function (label, i) {
        var sel = i === st.sel;
        return { label: label, mark: sel ? '▶' : '', color: sel ? '#FFB3C6' : '#FFF1D6', go: self.menuGo[i], hover: self.menuHover[i] };
      }),
      rootRef: this.rootRef, canvasRef: this.canvasRef,
      onKey: this.onKey, onPower: this.onPower, onPcClick: this.onPcClick,
      toMenu: this.toMenu, reset: this.reset
    };
  }
}

/* ---------------- DOM layer (replaces the design-tool template) ---------------- */
var CSS = "\n.root:focus{outline:none}\n.scan{background:repeating-linear-gradient(to bottom,rgba(255,255,255,.035) 0 2px,rgba(0,20,30,.12) 2px 4px);pointer-events:none}\n.vig{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 60%,rgba(10,30,36,.45) 100%);pointer-events:none}\n.blink{animation:blink 1.2s ease-in-out infinite}\n@keyframes blink{50%{opacity:.25}}\n.crton{animation:crton .5s ease-out both}\n@keyframes crton{0%{transform:scale(1,.01);filter:brightness(3)}55%{transform:scale(1,.01);filter:brightness(3)}100%{transform:scale(1,1);filter:brightness(1)}}\n.item{background:none;border:0;border-radius:999px;padding:4px 22px 4px 12px;min-height:48px;font-family:'Baloo 2','Nunito',sans-serif;font-weight:600;font-size:30px;cursor:pointer;text-align:left;display:flex;gap:12px;align-items:center;transition:background .15s}\n.item.on{background:rgba(255,179,198,.16)}\n.back{background:#FFF6E6;border:0;border-radius:999px;color:#6B5B45;font-family:'Baloo 2','Nunito',sans-serif;font-weight:600;font-size:16px;padding:8px 18px;min-height:44px;cursor:pointer;box-shadow:0 3px 0 #E2C9A4}\n.back:hover{background:#FFE7EC}\n.setrow{box-sizing:border-box!important;display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;margin:0;min-height:48px;padding:0 16px;border:0;border-radius:16px;font-family:'Baloo 2','Nunito',sans-serif;font-weight:600;font-size:18px;cursor:pointer;text-align:left;transition:background .15s}\n.setrow:focus-visible{outline:3px solid #F59AB0;outline-offset:1px}\n.hud{display:inline-flex;align-items:center;gap:8px;background:#FFF6E6;color:#6B5B45;border:0;border-radius:999px;font-family:'Baloo 2','Nunito',sans-serif;font-weight:600;font-size:17px;padding:0 24px;min-height:50px;cursor:pointer;box-shadow:0 4px 0 #E2C9A4,0 10px 24px rgba(120,80,40,.25);transition:transform .15s,box-shadow .15s}\n.hud:hover{transform:translateY(-2px);box-shadow:0 6px 0 #E2C9A4,0 14px 28px rgba(120,80,40,.28)}\n.hud:active{transform:translateY(2px);box-shadow:0 2px 0 #E2C9A4,0 6px 14px rgba(120,80,40,.25)}\n.hud.go{background:#F59AB0;color:#FFFFFF;font-size:20px;padding:0 32px;min-height:58px;box-shadow:0 5px 0 #D97A94,0 12px 28px rgba(200,90,120,.35)}\n.hud.go:hover{box-shadow:0 7px 0 #D97A94,0 16px 32px rgba(200,90,120,.38)}\n.hud .dot{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.3);font-size:12px}\n.hud:focus-visible,.back:focus-visible,.item:focus-visible{outline:3px solid #F59AB0;outline-offset:3px}\n\n.tf-host{position:relative;overflow:hidden;background:#F6E2C2}\n.tf-stage{position:absolute;left:0;top:0;width:1280px;height:800px;transform-origin:0 0}\n.tf-crt{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#3E7A72,#1D3F45)}\n.tf-host button{font-family:'Baloo 2','Nunito',sans-serif}\n.hud kbd{font:inherit;font-size:13px;margin-left:6px;padding:1px 9px;border-radius:999px;background:rgba(255,255,255,.3)}\n";
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function screenHTML(v) {
  if (!v.isOn) return '';
  var h = '';
  if (v.isBoot) {
    h += '<div style="position:absolute;inset:0;padding:40px 44px;display:flex;flex-direction:column;gap:12px;color:#CFF7E4;font-size:21px;font-weight:600">';
    v.bootLines.forEach(function (l) { h += '<p style="margin:0">' + esc(l.text) + '</p>'; });
    h += '<div style="margin-top:14px;width:360px;height:22px;border-radius:999px;background:rgba(255,255,255,.14);padding:4px;box-sizing:border-box"><div style="height:100%;border-radius:999px;transition:width .3s;width:' + v.bootPct + '%;background:#FFB3C6"></div></div></div>';
  }
  if (v.isMenu) {
    h += '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;box-sizing:border-box">' +
      '<div style="padding:6px 34px;border-radius:999px;background:rgba(255,246,230,.1)"><h1 style="margin:0;font-size:48px;font-weight:600;letter-spacing:2px;color:#FFF1D6;text-shadow:0 0 18px rgba(190,255,220,.55),0 3px 0 #D97A94">TOKENFALL</h1></div>' +
      '<div style="display:flex;flex-direction:column;gap:2px">';
    v.menu.forEach(function (m, i) { h += '<button class="item' + (m.mark ? ' on' : '') + '" data-act="menu" data-i="' + i + '" style="color:' + m.color + '"><span style="width:22px;font-size:20px;color:#FFB3C6">' + m.mark + '</span><span>' + esc(m.label) + '</span></button>'; });
    h += '</div>' +
      '<p class="blink" style="margin:0;font-size:16px;font-weight:600;color:#CFF7E4">↑ ↓ to choose · Enter to select</p></div>';
  }
  if (v.isControls) {
    h += '<div style="position:absolute;inset:0;padding:34px 40px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:30px;font-weight:600;color:#FFF1D6;text-shadow:0 3px 0 #D97A94">CONTROLS</h2><button class="back" data-act="toMenu">Back · Esc</button></div>' +
      '<div style="display:grid;grid-template-columns:200px 1fr;gap:14px 16px;font-size:17px">' +
      [['Arrows / WASD', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['E', 'Interact'], ['V', 'Switch view'], ['G', 'Glitch Log']].map(function (r) { return '<span style="justify-self:start;padding:2px 12px;border-radius:10px;background:#FFF6E6;color:#6B5B45;font-weight:600">' + r[0] + '</span><span style="color:#FFF1D6;font-weight:600">' + r[1] + '</span>'; }).join('') +
      '</div></div>';
  }
  if (v.isZoom) h += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><p class="blink" style="margin:0;font-size:28px;font-weight:600;color:#FFB3C6">Loading…</p></div>';
  return h;
}
function chromeHTML(v) {
  var h = '';
  if (v.showSettings) {
    h += '<div data-act="closeSettings" style="position:absolute;inset:0;z-index:6;background:rgba(120,80,50,.28);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center">' +
      '<div role="dialog" aria-label="Settings" data-act="stop" style="box-sizing:border-box;width:460px;background:#FFF8EC;border-radius:28px;box-shadow:0 8px 0 #E8CFA8,0 24px 50px rgba(110,70,40,.3);padding:26px 30px;display:flex;flex-direction:column;gap:18px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:28px;font-weight:600;color:#6B5B45">Settings</h2><button class="back" data-act="closeSettings">Close · Esc</button></div><div style="display:flex;flex-direction:column;gap:6px">';
    v.settingRows.forEach(function (r, i) {
      h += '<button class="setrow" data-act="setting" data-i="' + i + '" style="box-sizing:border-box;width:100%;background:' + r.bg + ';color:' + r.color + '"><span style="display:flex;gap:10px;align-items:center"><span style="width:18px;color:#F59AB0">' + r.mark + '</span>' + esc(r.label) + '</span><span style="margin-left:auto;text-align:right;white-space:nowrap;color:' + r.valColor + '">◀ ' + r.value + ' ▶</span></button>';
    });
    h += '</div><p style="margin:0;font-size:14px;color:#9C8468">↑ ↓ choose · ← → or Enter change · Esc close</p></div></div>';
  }
  if (v.isOff) h += '<div style="position:absolute;left:0;right:0;bottom:36px;display:flex;justify-content:center"><button class="hud go" data-act="power"><span class="dot">▶</span>Power on<kbd>Enter</kbd></button></div>';
  if (v.showOff) h += '<div style="position:absolute;right:24px;bottom:24px"><button class="hud" data-act="power">Power off</button></div>';
  return h;
}

var styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return; styleInjected = true;
  if (!document.querySelector('link[data-tf-font]')) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-tf-font', '');
    l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600&family=Nunito:wght@400;700&display=swap'; document.head.appendChild(l);
  }
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}

function mount(container, opts) {
  opts = opts || {};
  if (!window.TokenfallOfficeRoom || !window.THREE) throw new Error('TokenfallLauncher: load three.js and launcher/office-room.js before mounting');
  injectStyle();
  container.classList.add('tf-host');
  container.innerHTML = '<div class="tf-stage"><div class="root" tabindex="0" style="width:1280px;height:800px;position:relative;overflow:hidden;background:#F6E2C2;font-family:\'Baloo 2\',\'Nunito\',sans-serif">' +
    '<canvas role="img" aria-label="A cosy retro beige computer with a tower, keyboard and mouse on a sunny wooden office desk, between binders, a plant, a pen cup, a mug, a desk phone and a printer, under a window, a corkboard and a clock" style="position:absolute;left:0;top:0;width:1280px;height:800px"></canvas>' +
    '<div class="tf-ov" style="position:absolute;overflow:hidden;background:#1D3F45"><div class="tf-ovin" style="position:absolute;left:0;top:0;width:552px;height:421px;transform-origin:0 0"><div class="tf-screen"></div>' +
    '<div class="scan" style="position:absolute;inset:0"></div><div class="vig" style="position:absolute;inset:0"></div></div></div>' +
    '<div style="position:absolute;right:24px;top:24px;z-index:5"><button class="hud" data-act="openSettings" aria-haspopup="dialog"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>Settings</button></div>' +
    '<div class="tf-chrome"></div></div></div>';
  var stage = container.querySelector('.tf-stage'), rootEl = container.querySelector('.root'), canvas = container.querySelector('canvas');
  var ov = container.querySelector('.tf-ov'), ovin = container.querySelector('.tf-ovin'), scr = container.querySelector('.tf-screen');
  var scan = container.querySelector('.scan'), chrome = container.querySelector('.tf-chrome');

  var c = new Component();
  c.props = { orbit: opts.orbit !== false };
  c.state = {};
  c.init();
  c.rootRef(rootEl); c.canvasRef(canvas);
  var lastScreen = null, lastChrome = null, vals = null, crt = null, crtBody = null;
  // the CRT node lives for the whole power-on so its squash animation plays once, not on every re-render
  function syncCrt(isOn) {
    if (isOn && !crt) {
      crt = document.createElement('div'); crt.className = 'tf-crt crton';
      crt.innerHTML = '<div class="tf-crt-body"></div>';
      crtBody = crt.lastChild; scr.appendChild(crt); lastScreen = null;
    } else if (!isOn && crt) {
      scr.removeChild(crt); crt = crtBody = null; lastScreen = null;
    }
  }
  c._render = function () {
    vals = c.renderVals();
    var hadFocus = rootEl.contains(document.activeElement);
    ov.style.cssText = 'position:absolute;overflow:hidden;background:#1D3F45;border-radius:' + (vals.ovW * 0.012).toFixed(1) + 'px;left:' + vals.ovLeft + 'px;top:' + vals.ovTop + 'px;width:' + vals.ovW + 'px;height:' + vals.ovH + 'px;opacity:' + vals.ovOpacity + ';pointer-events:' + vals.ovPointer;
    ovin.style.transform = 'scale(' + vals.ovScale + ')';
    scan.style.display = vals.scanDisplay;
    canvas.style.cursor = vals.cursor;
    syncCrt(vals.isOn);
    var s = screenHTML(vals); if (crtBody && s !== lastScreen) { crtBody.innerHTML = s; lastScreen = s; }
    var ch = chromeHTML(vals); if (ch !== lastChrome) { chrome.innerHTML = ch; lastChrome = ch; }
    // a clicked button may just have been replaced; keep keyboard input inside the launcher
    if (hadFocus && !rootEl.contains(document.activeElement)) rootEl.focus({ preventScroll: true });
  };
  c.onEnter = function () {
    if (c.chip) c.chip.stop();
    container.dispatchEvent(new CustomEvent('tokenfall:start', { bubbles: true }));
    if (opts.onStart) opts.onStart();
  };

  // wire events (delegated)
  var lastHover = null;
  rootEl.addEventListener('keydown', function (e) { c.onKey(e); });
  rootEl.addEventListener('pointerdown', function () { c.onAnyInput(); });
  canvas.addEventListener('click', function () { c.onPcClick(); });
  rootEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t || !rootEl.contains(t)) return;
    var a = t.getAttribute('data-act'), i = +t.getAttribute('data-i');
    if (a === 'stop') { e.stopPropagation(); return; }
    e.stopPropagation();
    if (a === 'menu') vals.menu[i].go(e);
    else if (a === 'setting') vals.settingRows[i].change(e);
    else if (a === 'power') c.onPower(e);
    else if (c[a]) c[a](e);
  });
  rootEl.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-act]'); if (t === lastHover) return; lastHover = t; if (!t) return;
    var a = t.getAttribute('data-act'), i = +t.getAttribute('data-i');
    if (a === 'menu') vals.menu[i].hover(); else if (a === 'setting') vals.settingRows[i].hover();
  });

  // fit 1280x800 design into the container
  function fit() {
    var w = container.clientWidth || DESIGN_W, h = container.clientHeight || DESIGN_H;
    var k = opts.fit === false ? 1 : Math.min(w / DESIGN_W, h / DESIGN_H);
    stage.style.transform = 'translate(' + ((w - DESIGN_W * k) / 2) + 'px,' + ((h - DESIGN_H * k) / 2) + 'px) scale(' + k + ')';
    // render at the real on-screen resolution, not the 1280x800 design size
    c.setPixelRatio(k);
  }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', fit);
  c._render();
  c.componentDidMount();
  fit();
  if (opts.autofocus !== false) rootEl.focus({ preventScroll: true });

  return {
    destroy: function () { c.componentWillUnmount(); if (ro) ro.disconnect(); else window.removeEventListener('resize', fit); container.innerHTML = ''; container.classList.remove('tf-host'); },
    powerOn: function () { if (c.state.phase === 'off') c.boot(); },
    reset: function () { c.reset(); }
  };
}
return { mount: mount, version: '1.0.0' };
});
