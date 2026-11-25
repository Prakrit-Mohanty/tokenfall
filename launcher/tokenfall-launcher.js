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
var DESIGN_W = 1280, DESIGN_H = 800, DESIGN_A = 1280 / 800;   // the stage is 800 tall and as wide as the window's shape (fit() resizes DESIGN_W), so the scene fills any window
function DCLogic() {}
DCLogic.prototype.setState = function (o) { Object.assign(this.state, o); this._render && this._render(); };
DCLogic.prototype.forceUpdate = function () { this._render && this._render(); };

var MENU = ['START', 'CONTROLS', 'SETTINGS'];
var MENU_START = 0, MENU_CONTROLS = 1, MENU_SETTINGS = 2;
var VOLS = [['LOW', 0.22], ['MEDIUM', 0.45], ['HIGH', 0.75]];
function sanitizeCfg(sv) {
  var vol = Number.isInteger(sv.vol) && sv.vol >= 0 && sv.vol < VOLS.length ? sv.vol : 1;
  return { vol: vol, sfx: sv.sfx !== false, motion: sv.motion !== false, scan: sv.scan === true };
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
var SCREEN = { x0: -48, x1: 48, y0: 34, y1: 88, z: -2 };
function drawStartScreen(g, w, h, blink) {
  var room = window.TokenfallOfficeRoom, F = room.FONT_UI;
  var bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#A9DDF2'); bg.addColorStop(0.5, '#D6EEF2'); bg.addColorStop(1, '#FFF1D6');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#9DD17A'; g.beginPath(); g.ellipse(w / 2, h * 1.18, w * 0.75, h * 0.36, 0, 0, Math.PI * 2); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  // the sticker logo (as css/sticker-logo.css draws it on the menu): a white cut-out with a drop shadow, a coloured rim pushed back into a deeper 3D side, a sky-white face
  var fs = Math.round(h * 0.21), ext = fs * 0.1;
  g.font = '700 ' + fs + 'px ' + F;
  [['TOKEN', 0.27, '#FF6A1E', '#C2321E'], ['FALL', 0.48, '#E838C4', '#7A2CB0']].forEach(function (l) {
    var x = w / 2, y = h * l[1], k;
    g.save(); g.shadowColor = 'rgba(20,30,90,.35)'; g.shadowBlur = fs * 0.12; g.shadowOffsetY = fs * 0.06;
    g.lineWidth = fs * 0.5; g.strokeStyle = '#FFFFFF'; g.strokeText(l[0], x, y + ext); g.restore();
    g.lineWidth = fs * 0.5; g.strokeStyle = '#FFFFFF'; for (k = 0; k <= ext; k += 2) g.strokeText(l[0], x, y + k);
    g.lineWidth = fs * 0.2; g.strokeStyle = l[3]; for (k = 1; k <= ext; k += 1.5) g.strokeText(l[0], x, y + k);
    g.strokeStyle = l[2]; g.strokeText(l[0], x, y);
    var face = g.createLinearGradient(0, y - fs * 0.4, 0, y + fs * 0.4); face.addColorStop(0, '#FFFFFF'); face.addColorStop(0.5, '#F4FBFF'); face.addColorStop(1, '#C9E8FF');
    g.fillStyle = face; g.fillText(l[0], x, y);
  });
  if (blink) {
    room.rr(g, w * 0.32, h * 0.66, w * 0.36, h * 0.16, h * 0.08, '#FFF6E6');
    g.lineWidth = 4; g.strokeStyle = '#8A5A34'; g.stroke();
    g.fillStyle = '#7A4A26'; g.font = '600 ' + Math.round(h * 0.1) + 'px ' + F;
    g.fillText('▶ START', w / 2, h * 0.745);
  }
}
function buildPC(THREE) {
  var room = window.TokenfallOfficeRoom, group = new THREE.Group();
  var M = function (col, o) { return room.mat(THREE, col, o); };
  var add = function (parent, geo, material, x, y, z) { var m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  var box = function (parent, material, w, h, d, r, x, y, z) { return add(parent, room.roundedBox(THREE, w, h, d, r), material, x, y, z); };
  var alu = M('#E6E6EA', { roughness: 0.3, metalness: 0.55, emissive: '#5A4A40', emissiveIntensity: 0.55 }), white = M('#F7F7F5', { roughness: 0.35 });
  var pink = M('#F7C3CF', { roughness: 0.32, metalness: 0.35, emissive: '#5A3A3A', emissiveIntensity: 0.4 }), pinkDeep = M('#EFA9BA', { roughness: 0.32, metalness: 0.35, emissive: '#4A2E30', emissiveIntensity: 0.4 }), pinkStand = M('#EDB3C1', { roughness: 0.3, metalness: 0.4, emissive: '#4A2E30', emissiveIntensity: 0.4 });
  var bezel = M('#FBF9F6', { roughness: 0.2, emissive: '#5A4A40', emissiveIntensity: 0.35 });
  var W = SCREEN.x1 - SCREEN.x0, H = SCREEN.y1 - SCREEN.y0, cy = (SCREEN.y0 + SCREEN.y1) / 2, B = 1.8, CHIN = 15;
  // pastel-pink all-in-one: white bezel round the screen, a soft pink chin and a pink blade stand
  var bodyH = H + 2 * B + CHIN, bodyY = SCREEN.y0 - B - CHIN + bodyH / 2;
  box(group, pinkDeep, W + 2 * B + 0.6, bodyH + 0.6, 2.2, 1.1, 0, bodyY, SCREEN.z - 1.7);
  box(group, pink, W + 2 * B - 0.4, CHIN + 0.6, 0.8, 0.35, 0, SCREEN.y0 - B - CHIN / 2, SCREEN.z - 0.45);
  box(group, bezel, W + 2 * B, H + 2 * B, 0.6, 0.28, 0, cy, SCREEN.z - 0.35);
  add(group, new THREE.SphereGeometry(0.3, 10, 8), M('#2A2A30', { roughness: 0.2 }), 0, SCREEN.y1 + B * 0.5, SCREEN.z - 0.02);
  var mark = room.canvasTex(THREE, 128, 32, function (g, w, h) { g.fillStyle = 'rgba(190,110,130,.35)'; g.font = '600 18px ' + room.FONT_UI; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('tokenfall', w / 2, h / 2 + 1); });
  var markM = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: mark, transparent: true }));
  markM.position.set(0, SCREEN.y0 - B - CHIN / 2, SCREEN.z - 0.38); group.add(markM);
  // flat pink blade stand on a rectangular foot
  var blade = box(group, pinkStand, 24, 32, 1.4, 0.6, 0, 17, SCREEN.z - 6); blade.rotation.x = -0.12;
  box(group, pinkStand, 24, 1, 18, 0.45, 0, 0.5, SCREEN.z - 9);
  // the screen itself
  var scrGeo = new THREE.PlaneGeometry(W, H), blink = true;
  var scrTex = room.canvasTex(THREE, 640, 360, function (g, w, h) { drawStartScreen(g, w, h, blink); });
  var screen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })); screen.position.set(0, cy, SCREEN.z); group.add(screen);
  var off = new THREE.Mesh(scrGeo, M('#0B0C0F', { roughness: 0.2 })); off.position.set(0, cy, SCREEN.z - 0.02); group.add(off);
  // soft warm reflection streak across the glass
  var streakTex = room.canvasTex(THREE, 256, 128, function (g, w, h) {
    var gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0.3, 'rgba(255,220,170,0)'); gr.addColorStop(0.45, 'rgba(255,220,170,.55)'); gr.addColorStop(0.52, 'rgba(255,230,190,.2)'); gr.addColorStop(0.6, 'rgba(255,220,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  var streak = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * B, H + 2 * B), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.position.set(0, cy, SCREEN.z + 0.08); group.add(streak);
  var glowTex = room.canvasTex(THREE, 128, 128, function (g) {
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#9FF0C8', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(W * 1.2, H * 1.25, 1); glow.position.set(0, cy, SCREEN.z + 1); group.add(glow);
  var led = add(group, new THREE.SphereGeometry(0.18, 8, 6), M('#555', { emissive: '#7CF29A', emissiveIntensity: 0 }), 1.2, SCREEN.y1 + B * 0.5, SCREEN.z - 0.02);
  // slim pink-framed keyboard with white keys, a trackpad and a white mouse with a pink underside
  var kb = new THREE.Group(); kb.position.set(-6, 0, 16); kb.rotation.x = 0.03; group.add(kb);
  box(kb, pink, 42, 1, 12.5, 0.45, 0, 0.5, 0);
  var capG = room.roundedBox(THREE, 2.5, 0.5, 2.3, 0.22);
  for (var r = 0; r < 5; r++) for (var k = 0; k < 14; k++) {
    if (r === 4 && k > 0 && k < 13 && k !== 4) continue;
    var wide = r === 4 && k === 4;
    var cap = add(kb, wide ? room.roundedBox(THREE, 2.5 + 2.8 * 8, 0.5, 2.3, 0.22) : capG, white, -18.2 + k * 2.8 + (wide ? 11.2 : 0), 1.15, -5 + r * 2.5);
    cap.castShadow = false;
  }
  box(group, alu, 13, 0.6, 11, 0.28, 24, 0.3, 17);
  var mouse = add(group, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), white, 36, 0.35, 18); mouse.scale.set(2.8, 1.1, 5);
  add(group, new THREE.CylinderGeometry(1, 1, 0.35, 24), pinkDeep, 36, 0.18, 18).scale.set(2.8, 1, 5);
  return {
    group: group, textures: [scrTex, glowTex, mark, streakTex],
    setOn: function (on, t) {
      screen.visible = !on;
      glow.material.color.set(on ? '#FFE9C0' : '#CFEFFF');
      led.material.emissiveIntensity = on ? 1.2 : 0;
      var b = Math.floor(t * 1.6) % 2 === 0;
      if (b !== blink) { blink = b; scrTex.redraw(); }
    }
  };
}

// camera orbits a target point; dist/fov set the zoom
var POSES = {
  idle: { dist: 360, fov: 50, pitch: -6, yaw: 2, tx: 0, ty: 61, tz: SCREEN.z, swing: 4 },   // aimed at the screen centre, so the start button sits in the middle of the window
  near: { dist: 178, fov: 30, pitch: 1, yaw: 0, tx: 0, ty: 60.4, tz: SCREEN.z },
  into: { dist: 42, fov: 30, pitch: 0, yaw: 0, tx: 0, ty: 61, tz: SCREEN.z }
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
    this.cfg = { vol: 1, sfx: true, motion: true, scan: false };
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
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 40px "Fredoka"')]).then(function () { if (self.renderer) { self.room.redraw(); self.pc.textures[0].redraw(); } }).catch(function () {});
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
    // a window narrower than the 16:10 design keeps the same width of scene in view (wider vertical angle) rather than cropping the sides
    var a = DESIGN_W / DESIGN_H; cam.aspect = a;
    cam.fov = a >= DESIGN_A ? c.fov : 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * DESIGN_A / a) * 180 / Math.PI; cam.updateProjectionMatrix();
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
    var facing = Math.abs(c.yaw) < 1.5 && Math.abs(c.pitch) < 4 && c.dist < 260;
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
          bg: on3 ? '#FFE9C4' : '#F7EBD8', color: on3 ? '#B5651D' : '#6B5B45', valColor: v === 'OFF' ? '#B3A28A' : '#5FA88E' };
      }),
      musicLabel: !this.musicOn ? '♪ Music: off' : this.musicPlaying ? '♪ Music: on' : '♪ Click to play music',
      musicPressed: this.musicOn && this.musicPlaying ? 'true' : 'false',
      onAnyInput: this.onAnyInput, toggleMusic: this.toggleMusic,
      ovLeft: o.l.toFixed(1), ovTop: o.t.toFixed(1), ovW: o.w.toFixed(1), ovH: o.h.toFixed(1),
      ovScale: (o.w / 640 || 0.01).toFixed(4), ovOpacity: o.o, ovPointer: o.o ? 'auto' : 'none',
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
        return { label: label, mark: sel ? '▶' : '', color: sel ? '#FFC46A' : '#FFF1D6', go: self.menuGo[i], hover: self.menuHover[i] };
      }),
      rootRef: this.rootRef, canvasRef: this.canvasRef,
      onKey: this.onKey, onPower: this.onPower, onPcClick: this.onPcClick,
      toMenu: this.toMenu, reset: this.reset
    };
  }
}

/* ---------------- DOM layer (replaces the design-tool template) ---------------- */
var CSS = "\n.root:focus{outline:none}\n.scan{background:repeating-linear-gradient(to bottom,rgba(255,255,255,.05) 0 2px,rgba(90,60,30,.04) 2px 4px);pointer-events:none}\n.vig{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 60%,rgba(120,80,40,.18) 100%);pointer-events:none}\n.blink{animation:blink 1.2s ease-in-out infinite}\n@keyframes blink{50%{opacity:.25}}\n.crton{animation:crton .5s ease-out both}\n@keyframes crton{0%{transform:scale(1,.01);filter:brightness(3)}55%{transform:scale(1,.01);filter:brightness(3)}100%{transform:scale(1,1);filter:brightness(1)}}\n.item{background:none;border:0;border-radius:999px;padding:4px 22px 4px 12px;min-height:48px;font-family:'Fredoka','Nunito',sans-serif;font-weight:600;font-size:30px;cursor:pointer;text-align:left;display:flex;gap:12px;align-items:center;transition:background .15s}\n.item.on{background:rgba(255,196,106,.16)}\n.back{background:#FFF6E6;border:0;border-radius:999px;color:#6B5B45;font-family:'Fredoka','Nunito',sans-serif;font-weight:600;font-size:16px;padding:8px 18px;min-height:44px;cursor:pointer;box-shadow:0 3px 0 #E2C9A4}\n.back:hover{background:#FFE9C4}\n.setrow{box-sizing:border-box!important;display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;margin:0;min-height:48px;padding:0 16px;border:0;border-radius:16px;font-family:'Fredoka','Nunito',sans-serif;font-weight:600;font-size:18px;cursor:pointer;text-align:left;transition:background .15s}\n.setrow:focus-visible{outline:3px solid #E98A3A;outline-offset:1px}\n.hud{display:inline-flex;align-items:center;gap:8px;background:#FFF6E6;color:#6B5B45;border:0;border-radius:999px;font-family:'Fredoka','Nunito',sans-serif;font-weight:600;font-size:17px;padding:0 24px;min-height:50px;cursor:pointer;box-shadow:0 4px 0 #E2C9A4,0 10px 24px rgba(120,80,40,.25);transition:transform .15s,box-shadow .15s}\n.hud:hover{transform:translateY(-2px);box-shadow:0 6px 0 #E2C9A4,0 14px 28px rgba(120,80,40,.28)}\n.hud:active{transform:translateY(2px);box-shadow:0 2px 0 #E2C9A4,0 6px 14px rgba(120,80,40,.25)}\n.hud:focus-visible,.back:focus-visible,.item:focus-visible{outline:3px solid #E98A3A;outline-offset:3px}\n\n.tf-host{position:relative;overflow:hidden;background:#F6E2C2}\n.tf-stage{position:absolute;left:0;top:0;width:1280px;height:800px;transform-origin:0 0}\n.tf-crt{position:absolute;inset:0;background:#D6EEF2}\n.tf-sky{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#A9DDF2 0%,#D6EEF2 45%,#FFF1D6 100%)}\n.tf-sky i{position:absolute;background:#FFFFFF;border-radius:999px;opacity:.9;box-shadow:24px -14px 0 4px #FFFFFF,52px 0 0 -2px #FFFFFF;animation:tfdrift 40s linear infinite}\n.tf-sky .c1{left:40px;top:40px;width:70px;height:26px}.tf-sky .c2{left:470px;top:70px;width:60px;height:22px;animation-duration:55s}.tf-sky .c3{left:250px;top:24px;width:46px;height:18px;opacity:.7;animation-duration:70s}\n@keyframes tfdrift{from{transform:translateX(-30px)}to{transform:translateX(30px)}}\n.tf-hill{position:absolute;left:-60px;right:-60px;bottom:-150px;height:210px;border-radius:50%;background:radial-gradient(ellipse at 50% 20%,#B8E08E,#8CC46A);box-shadow:inset 0 6px 0 rgba(255,255,255,.35)}\n.tf-hill.b{left:300px;right:-200px;bottom:-170px;background:#9DD17A;opacity:.85}\n.tf-pane{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-sizing:border-box}\n.tf-logo{position:relative;display:flex;flex-direction:column;align-items:center;transform-origin:50% 0;animation:tfbob 3.2s ease-in-out infinite}\n@keyframes tfbob{0%,100%{translate:0 0}50%{translate:0 -3px}}\n.tf-welcome{margin:0 0 -6px;font-family:'Nunito',sans-serif;font-style:italic;font-weight:700;font-size:17px;color:#7A4A26;position:relative;z-index:2;background:#FFF6E6;padding:0 12px;border-radius:999px;border:2px solid #C79A6A}\n.tf-plaque{position:relative;padding:10px 34px 12px;border-radius:26px;background:linear-gradient(180deg,#F2C98F,#D99E5E);border:4px solid #8A5A34;box-shadow:0 6px 0 #8A5A34,0 14px 22px rgba(120,70,30,.28),inset 0 0 0 3px rgba(255,236,200,.35),inset 0 4px 0 rgba(255,255,255,.35),inset 0 -5px 0 rgba(120,70,30,.18);background-image:repeating-linear-gradient(180deg,rgba(150,90,40,.10) 0 2px,transparent 2px 13px),linear-gradient(180deg,#F4CF98,#D89A58)}\n.tf-plaque::before,.tf-plaque::after{content:'';position:absolute;top:50%;width:9px;height:9px;margin-top:-5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#FFE7BE,#9A6A3E);box-shadow:0 1px 0 rgba(90,50,20,.5)}.tf-plaque::before{left:12px}.tf-plaque::after{right:12px}\n.tf-word{margin:0;font-family:'Fredoka','Nunito',sans-serif;font-weight:600;font-size:60px;line-height:1.05;letter-spacing:2px;white-space:nowrap}\n.tf-l{position:relative;display:inline-block;color:#FFDA85;-webkit-text-stroke:7px #6E4020;paint-order:stroke fill;text-shadow:0 5px 0 #6E4020,0 9px 8px rgba(80,40,10,.32)}\n.tf-l::after{content:attr(data-t);position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:0;background:linear-gradient(180deg,#FFF6D8 0%,#FFE29A 42%,#F7B955 100%);-webkit-background-clip:text;background-clip:text;text-shadow:none;pointer-events:none}\n.tf-leaf{position:absolute;top:-12px;right:22px;z-index:3;width:30px;height:24px}\n.tf-leaf i{position:absolute;width:20px;height:12px;border-radius:0 100% 0 100%;background:#6FBF5A;border:2px solid #3F7F3A}.tf-leaf i+i{left:12px;top:6px;transform:rotate(60deg);background:#8FD06A}\n.tf-stk{margin:0 0 2px;font-size:66px}.tf-hd-logo .stk{font-size:74px;margin:0}\n.tf-tag{margin-top:-8px;position:relative;z-index:2;padding:1px 14px;border-radius:999px;background:#4FB3A9;color:#FFFFFF;font-family:'Fredoka',sans-serif;font-weight:600;font-size:15px;border:2px solid #2F7F78;rotate:-3deg}\n.tf-start{position:relative;display:inline-flex;align-items:center;gap:10px;margin-top:8px;padding:2px 34px;min-height:50px;border-radius:999px;background:#FFF6E6;border:3px solid #8A5A34;color:#7A4A26;font-family:'Fredoka',sans-serif;font-weight:600;font-size:28px;cursor:pointer;box-shadow:0 5px 0 #8A5A34,0 10px 16px rgba(120,70,30,.18);transition:transform .15s,box-shadow .15s,background .15s}\n.tf-start:active,.tf-sub:active{transform:translateY(3px)!important;box-shadow:0 2px 0 #9A5418!important}\n.tf-start.on{background:linear-gradient(180deg,#FFE29A 0%,#FFCB6B 55%,#F2AE4E 100%);border-color:#9A5418;color:#6E3A10;box-shadow:0 5px 0 #9A5418,0 12px 20px rgba(150,80,20,.25),0 0 0 6px rgba(255,240,200,.75),inset 0 3px 0 rgba(255,255,255,.55);transform:translateY(-2px) scale(1.04)}\n.tf-arrow{font-size:16px;display:inline-block;opacity:0}.tf-start.on .tf-arrow{opacity:1;animation:tfnudge .8s ease-in-out infinite}\n@keyframes tfnudge{50%{transform:translateX(5px)}}\n.tf-sub{padding:2px 20px;min-height:36px;border-radius:999px;background:#FFF6E6;border:2px solid #B88A5C;color:#7A4A26;font-family:'Fredoka',sans-serif;font-weight:600;font-size:17px;cursor:pointer;box-shadow:0 3px 0 #B88A5C;transition:transform .15s,box-shadow .15s,background .15s}\n.tf-sub.on{background:#FFE3A8;border-color:#9A5418;box-shadow:0 4px 0 #9A5418,0 0 0 4px rgba(255,236,190,.7);transform:translateY(-2px)}\n.tf-start:focus-visible,.tf-sub:focus-visible{outline:3px solid #E98A3A;outline-offset:3px}\n.tf-press{margin:6px 0 0;animation:tfsoft 2.4s ease-in-out infinite;font-family:'Fredoka',sans-serif;font-weight:600;font-size:15px;color:#4E6B3A;background:rgba(255,246,230,.75);padding:0 12px;border-radius:999px}\n@keyframes tfsoft{50%{opacity:.6}}\n.tf-press kbd{font:inherit;padding:0 8px;border-radius:999px;background:#7A4A26;color:#FFF6E6}\n.tf-ver{position:absolute;right:14px;bottom:8px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:12px;color:#5E7A48}\n.tf-card{display:flex;flex-direction:column;padding:14px 20px;border-radius:22px;background:rgba(255,248,236,.94);border:3px solid #C79A6A;box-shadow:0 4px 0 #C79A6A;color:#6B4A2E;font-family:'Fredoka',sans-serif;font-weight:600}\n.tf-h2{margin:0;font-size:26px;color:#7A4A26}\n.tf-key{justify-self:start;padding:1px 10px;border-radius:10px;background:#FFE3A8;border:2px solid #C79A6A;color:#6E3A10;font-size:14px}\n.tf-bar{margin-top:6px;height:18px;border-radius:999px;background:#EADBC4;border:2px solid #C79A6A;padding:2px;box-sizing:border-box}.tf-bar div{height:100%;border-radius:999px;background:linear-gradient(90deg,#8FD06A,#F6B85A);transition:width .3s}\n.tf-loading{margin:6px 0 0;font-family:'Fredoka',sans-serif;font-weight:600;font-size:26px;color:#7A4A26}\n.tf-loading span{display:inline-block;animation:tfhop 1s ease-in-out infinite}.tf-loading span+span{animation-delay:.15s}.tf-loading span+span+span{animation-delay:.3s}\n@keyframes tfhop{50%{transform:translateY(-6px)}}\n.tf-host button{font-family:'Fredoka','Nunito',sans-serif}\n\n.tf-hd{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#4FA6EE 0%,#8CCBF6 45%,#BFE6FA 75%,#D8F1FB 100%)}\n.tf-hd-sun{position:absolute;left:150px;top:40px;width:56px;height:56px;border-radius:50%;background:#FFFFFF;box-shadow:0 0 30px 18px rgba(255,255,255,.75),0 0 90px 50px rgba(255,255,255,.3)}\n.tf-cl{position:absolute;width:200px;height:90px;transform-origin:0 0}\n.tf-cl i{position:absolute;border-radius:50%;background:radial-gradient(circle at 50% 30%,#FFFFFF 55%,#E6E4F8 80%,#CFCDEE 100%)}\n.tf-hd .tf-cl.d1{animation:tfcl 9s ease-in-out infinite}.tf-hd .tf-cl.d2{animation:tfcl 12s ease-in-out infinite reverse}.tf-hd .tf-cl.d3{animation:tfcl 15s ease-in-out infinite}\n@keyframes tfcl{50%{translate:22px 0}}\n.tf-hd-logo{position:absolute;left:0;right:0;top:46px;display:flex;flex-direction:column;align-items:center;line-height:.86;animation:tfhdin .7s cubic-bezier(.2,1.6,.4,1) both,tffloat 3.4s 0.7s ease-in-out infinite}\n@keyframes tfhdin{from{transform:scale(.4);opacity:0}}@keyframes tffloat{50%{translate:0 -5px}}\n.tf-hd-logo b.x{position:relative;font-family:'Fredoka',sans-serif;font-weight:800;font-size:76px;letter-spacing:2px;color:#FFD45E;-webkit-text-stroke:10px #6A3E1C;paint-order:stroke fill;text-shadow:0 6px 0 #6A3E1C,0 12px 14px rgba(40,60,110,.3)}\n.tf-hd-logo b.x::after{content:attr(data-t);position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:0;background:linear-gradient(180deg,#FFF7CF 0%,#FFE07A 38%,#FFC83E 62%,#F29A22 100%);-webkit-background-clip:text;background-clip:text;text-shadow:none}\n.tf-hd-coin{position:absolute;left:50%;top:-18px;margin-left:140px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:800 22px 'Fredoka',sans-serif;color:#8A5212;background:radial-gradient(circle at 35% 30%,#FFF3B8,#FFC93E 55%,#E39A1E);border:3px solid #6A3E1C;box-shadow:0 4px 0 #6A3E1C;z-index:2;animation:tfcoin 2.2s ease-in-out infinite}\n@keyframes tfcoin{0%,100%{transform:translateY(0) rotate(-12deg)}50%{transform:translateY(8px) rotate(10deg)}}\n.tf-hd-bar{position:absolute;left:50%;bottom:44px;width:300px;height:34px;margin-left:-150px;box-sizing:border-box;padding:5px;border-radius:999px;background:linear-gradient(180deg,#E8F6FF,#A9D4EE);box-shadow:0 3px 0 #6E9FC0,0 8px 16px rgba(40,80,130,.25);overflow:hidden}\n.tf-hd-bar::before{content:'';position:absolute;inset:5px;border-radius:999px;background:#4A86B0;box-shadow:inset 0 3px 4px rgba(0,30,60,.35)}\n.tf-hd-fill{position:absolute;left:5px;top:5px;bottom:5px;width:0;border-radius:999px;background:linear-gradient(180deg,#FFF6B0,#FFD84A 50%,#F2B428);box-shadow:inset 0 -3px 0 rgba(200,120,0,.35);animation:tffill 2.9s cubic-bezier(.4,.1,.3,1) .2s forwards}\n@keyframes tffill{to{width:calc(100% - 10px)}}\n.tf-hd-bar span{position:relative;display:block;text-align:center;line-height:24px;font:800 17px 'Fredoka',sans-serif;letter-spacing:1px;color:#FFFFFF;-webkit-text-stroke:4px #1F3550;paint-order:stroke fill}\n.tf-hd-bar span i{font-style:normal;animation:tfdot 1.2s infinite}.tf-hd-bar span i+i{animation-delay:.2s}.tf-hd-bar span i+i+i{animation-delay:.4s}@keyframes tfdot{0%,20%{opacity:0}40%,100%{opacity:1}}\n.tf-bank{position:absolute;inset:0;pointer-events:none}.tf-bank i{position:absolute;border-radius:50%}.tf-bank b{position:absolute;left:0;right:0;bottom:0}\n.tf-bank.t0 i,.tf-bank.t0 b{background:#B9CDF2}.tf-bank.t0 i{background:radial-gradient(circle at 45% 30%,#E4ECFF 0%,#C8D6F6 55%,#AFC2EC 100%)}.tf-bank.t0{animation:tfcl 16s ease-in-out infinite}\n.tf-bank.t1 i,.tf-bank.t1 b{background:#DCDDF6}.tf-bank.t1 i{background:radial-gradient(circle at 45% 28%,#FFFFFF 0%,#EEEEFC 50%,#D4D3F2 100%)}.tf-bank.t1{animation:tfcl 12s ease-in-out infinite reverse}\n.tf-bank.t2 i,.tf-bank.t2 b{background:#F1F0FC}.tf-bank.t2 i{background:radial-gradient(circle at 45% 25%,#FFFFFF 0%,#FFFFFF 45%,#ECEBFB 75%,#DAD8F4 100%);box-shadow:0 -2px 6px rgba(255,255,255,.6)}.tf-bank.t2{animation:tfcl 9s ease-in-out infinite}\n.tf-bank.t3 i{background:radial-gradient(circle at 45% 25%,#FFFFFF 0%,#FFFFFF 50%,#F0EFFC 78%,#E0DEF6 100%)}.tf-bank.t3 b{background:linear-gradient(180deg,#F4F3FD 0%,#DCEBF8 60%,#B9E0F4 100%)}.tf-bank.t3{animation:tfcl 7s ease-in-out infinite reverse}\n.tf-part{position:absolute;inset:0;pointer-events:none;display:none}\n.tf-arrive .tf-part{display:block;animation:tfpanup 1.4s cubic-bezier(.6,0,.25,1) forwards}\n.tf-arrive .tf-sky,.tf-arrive .tf-pane{animation:tfrise 1.4s cubic-bezier(.6,0,.25,1) both}\n.tf-part .tf-hd-fill{animation:none;width:calc(100% - 10px)}.tf-part .tf-hd-logo{animation:none}\n@keyframes tfpanup{to{transform:translateY(-100%)}}@keyframes tfrise{from{transform:translateY(100%)}}\n";
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// the New Horizons-style wooden sign logo; k scales it for the smaller boot / loading headers
function logoHTML(k) {
  var letters = '<span class="tf-l" data-t="TokenFall">TokenFall</span>';
  return '<div class="tf-logo" style="transform:scale(' + k + ')">' +
    '<div class="tf-leaf"><i></i><i></i></div>' +
    '<p class="tf-welcome">Welcome to</p>' +
    '<h1 class="stk tf-stk" aria-label="TokenFall"><b data-t="TOKEN">TOKEN</b><b class="b2" data-t="FALL">FALL</b></h1>' +
    '<span class="tf-tag">Calfus</span></div>';
}
// a puffy cartoon cloud: overlapping white balls with a lavender belly; x, y in screen px, s its scale
function cloudHTML(x, y, s, cls) {
  var balls = [[0, 26, 46], [30, 6, 62], [74, 0, 70], [118, 14, 56], [150, 30, 40]];
  return '<div class="tf-cl ' + (cls || '') + '" style="left:' + x + 'px;top:' + y + 'px;transform:scale(' + s + ')">' +
    balls.map(function (b) { return '<i style="left:' + b[0] + 'px;top:' + b[1] + 'px;width:' + b[2] + 'px;height:' + b[2] + 'px"></i>'; }).join('') + '</div>';
}
// a cloud bank across the screen: puffs of mixed sizes along a wavy line, on a flat base so no gaps show; tone 0 is the back (bluish), 2 the front (white)
function bankHTML(y, tone, seed) {
  var h = '', x = -40, n = seed;
  var rnd = function () { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  while (x < 700) { var d = 70 + rnd() * 70; h += '<i style="left:' + x.toFixed(0) + 'px;top:' + (y - d / 2 + rnd() * 26 - 13).toFixed(0) + 'px;width:' + d.toFixed(0) + 'px;height:' + d.toFixed(0) + 'px"></i>'; x += d * (.45 + rnd() * .2); }
  return '<div class="tf-bank t' + tone + '">' + h + '<b style="top:' + y + 'px"></b></div>';
}
// the loading screen: high in the clouds, the chunky TOKEN / FALL logo and a pill-shaped bar that fills while the office "boots"
function loaderHTML() {
  return '<div class="tf-hd"><div class="tf-hd-sun"></div>' +
    cloudHTML(60, 70, .9, 'd1') + cloudHTML(420, 40, .7, 'd2') +
    '<div class="tf-hd-logo"><h1 class="stk" aria-label="TokenFall"><b data-t="TOKEN">TOKEN</b><b class="b2" data-t="FALL">FALL</b></h1></div>' +
    bankHTML(232, 0, 7) + bankHTML(262, 1, 31) + bankHTML(296, 2, 59) + bankHTML(346, 3, 83) +
    '<div class="tf-hd-bar"><div class="tf-hd-fill"></div><span>Loading<i>.</i><i>.</i><i>.</i></span></div></div>';
}
// the clouds the camera falls back through when the menu arrives: they part to the sides and fade, revealing the field
function partHTML() {
  return '<div class="tf-part">' + loaderHTML() + '</div>';
}
function screenHTML(v) {
  if (!v.isOn) return '';
  var h = '<div class="tf-sky"><i class="c1"></i><i class="c2"></i><i class="c3"></i><div class="tf-hill"></div><div class="tf-hill b"></div></div>';
  if (v.isBoot) return loaderHTML();
  if (v.isMenu) {
    var m = v.menu;
    h += '<div class="tf-pane" style="padding-top:8px">' + logoHTML(0.9) +
      '<button class="tf-start' + (m[0].mark ? ' on' : '') + '" data-act="menu" data-i="0"><span class="tf-arrow">▶</span>' + esc(m[0].label) + '</button>' +
      '<div style="display:flex;gap:12px;margin-top:2px">' +
      [1, 2].map(function (i) { return '<button class="tf-sub' + (m[i].mark ? ' on' : '') + '" data-act="menu" data-i="' + i + '">' + esc(m[i].label.charAt(0) + m[i].label.slice(1).toLowerCase()) + '</button>'; }).join('') +
      '</div><p class="tf-press">Press <kbd>Enter</kbd> · ↑ ↓ to choose</p></div><span class="tf-ver">Ver. 1.0</span>' + partHTML();
  }
  if (v.isControls) {
    h += '<div class="tf-pane" style="padding:22px 36px">' +
      '<div class="tf-card" style="width:100%;box-sizing:border-box;gap:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 class="tf-h2">Controls</h2><button class="back" data-act="toMenu">Back · Esc</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,auto 1fr);gap:10px 12px;align-items:center;font-size:16px">' +
      [['Arrows / WASD', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['E', 'Interact'], ['V', 'Switch view'], ['G', 'Glitch Log']].map(function (r) { return '<span class="tf-key">' + r[0] + '</span><span>' + r[1] + '</span>'; }).join('') +
      '</div></div></div>';
  }
  if (v.isZoom) h += '<div class="tf-pane">' + logoHTML(0.75) + '<p class="tf-loading">Loading<span>.</span><span>.</span><span>.</span></p></div>';
  return h;
}
function chromeHTML(v) {
  var h = '';
  if (v.showSettings) {
    h += '<div data-act="closeSettings" style="position:absolute;inset:0;z-index:6;background:rgba(120,80,50,.28);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center">' +
      '<div role="dialog" aria-label="Settings" data-act="stop" style="box-sizing:border-box;width:460px;background:#FFF8EC;border-radius:28px;box-shadow:0 8px 0 #E8CFA8,0 24px 50px rgba(110,70,40,.3);padding:26px 30px;display:flex;flex-direction:column;gap:18px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:28px;font-weight:600;color:#6B5B45">Settings</h2><button class="back" data-act="closeSettings">Close · Esc</button></div><div style="display:flex;flex-direction:column;gap:6px">';
    v.settingRows.forEach(function (r, i) {
      h += '<button class="setrow" data-act="setting" data-i="' + i + '" style="box-sizing:border-box;width:100%;background:' + r.bg + ';color:' + r.color + '"><span style="display:flex;gap:10px;align-items:center"><span style="width:18px;color:#E98A3A">' + r.mark + '</span>' + esc(r.label) + '</span><span style="margin-left:auto;text-align:right;white-space:nowrap;color:' + r.valColor + '">◀ ' + r.value + ' ▶</span></button>';
    });
    h += '</div><p style="margin:0;font-size:14px;color:#9C8468">↑ ↓ choose · ← → or Enter change · Esc close</p></div></div>';
  }
  if (v.showOff) h += '<div style="position:absolute;right:24px;bottom:24px"><button class="hud" data-act="power">Power off</button></div>';
  return h;
}

var styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return; styleInjected = true;
  if (!document.querySelector('link[data-tf-font]')) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-tf-font', '');
    l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;700&display=swap'; document.head.appendChild(l);
  }
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}

function mount(container, opts) {
  opts = opts || {};
  if (!window.TokenfallOfficeRoom || !window.THREE) throw new Error('TokenfallLauncher: load three.js and launcher/office-room.js before mounting');
  injectStyle();
  container.classList.add('tf-host');
  container.innerHTML = '<div class="tf-stage"><div class="root" tabindex="0" style="width:1280px;height:800px;position:relative;overflow:hidden;background:#F6E2C2;font-family:\'Fredoka\',\'Nunito\',sans-serif">' +
    '<canvas role="img" aria-label="A pink all-in-one computer on a long oak counter in front of tall office windows, looking over a golden-hour city. Its screen says Token Fall, Start: press Enter or click to power on" style="position:absolute;left:0;top:0;width:1280px;height:800px"></canvas>' +
    '<div class="tf-ov" style="position:absolute;overflow:hidden;background:#D6EEF2"><div class="tf-ovin" style="position:absolute;left:0;top:0;width:640px;height:360px;transform-origin:0 0"><div class="tf-screen"></div>' +
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
  var lastScreen = null, lastPhase = null, lastChrome = null, vals = null, crt = null, crtBody = null;
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
    ov.style.cssText = 'position:absolute;overflow:hidden;background:#D6EEF2;border-radius:' + (vals.ovW * 0.012).toFixed(1) + 'px;left:' + vals.ovLeft + 'px;top:' + vals.ovTop + 'px;width:' + vals.ovW + 'px;height:' + vals.ovH + 'px;opacity:' + vals.ovOpacity + ';pointer-events:' + vals.ovPointer;
    ovin.style.transform = 'scale(' + vals.ovScale + ')';
    scan.style.display = vals.scanDisplay;
    canvas.style.cursor = vals.cursor;
    syncCrt(vals.isOn);
    if (crtBody && vals.isMenu && lastPhase === 'boot') { crtBody.classList.add('tf-arrive'); var body = crtBody; setTimeout(function () { body.classList.remove('tf-arrive'); }, 1500); }
    lastPhase = vals.isBoot ? 'boot' : vals.isMenu ? 'menu' : 'other';
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

  // fit the design (800 tall, the window's width) into the container
  function fit() {
    var w = container.clientWidth || DESIGN_W, h = container.clientHeight || DESIGN_H;
    if (opts.fit !== false) { DESIGN_W = Math.max(480, Math.round(DESIGN_H * w / h)); rootEl.style.width = canvas.style.width = DESIGN_W + 'px'; }   // match the window's shape: no bars at the sides
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
