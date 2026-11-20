/*!
 * Tokenfall Launcher — standalone, zero dependencies.
 * A pixel-art retro PC in a dusk grass field; power it on to boot into the Tokenfall menu.
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

/* ---------- tiny pixel-art 3D renderer (orthographic, painter's sort, palette snap) ---------- */
var CWID = 320, CHGT = 200, UP = 4;
var SCREEN = { x0: -36, x1: 36, y0: 40, y1: 95, z: 27 };
var MAT = {
  cream:  ['#FBE7C8', '#F3D1AA', '#E3AFC6', '#C994C0'],
  stand:  ['#F6DDBC', '#EBC39C', '#D6A0C0', '#BE86B6'],
  plum:   ['#8A5A80', '#74496B', '#5E3858', '#4C2B48'],
  key:    ['#B98AAE', '#A57899', '#8E6585', '#7A5574']
};
function v3(x, y, z) { return [x, y, z]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
var LIGHT = norm([-0.5, 0.8, 0.55]);
var SHADOW_DIR = [0.75, 1, -0.45];

// solid from front rect (z=zf) and back rect (z=zb), each {x0,x1,y0,y1}
function solid(list, mat, f, b, zf, zb, shadow) {
  var V = [v3(f.x0, f.y0, zf), v3(f.x1, f.y0, zf), v3(f.x1, f.y1, zf), v3(f.x0, f.y1, zf),
           v3(b.x0, b.y0, zb), v3(b.x1, b.y0, zb), v3(b.x1, b.y1, zb), v3(b.x0, b.y1, zb)];
  var c = [0, 0, 0]; V.forEach(function (p) { c[0] += p[0] / 8; c[1] += p[1] / 8; c[2] += p[2] / 8; });
  [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].forEach(function (ix) {
    var P = ix.map(function (i) { return V[i]; });
    var n = norm(cross(sub(P[1], P[0]), sub(P[3], P[0])));
    var fc = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2, (P[0][2] + P[2][2]) / 2];
    if (dot(n, sub(fc, c)) < 0) n = [-n[0], -n[1], -n[2]];
    list.push({ pts: P, n: n, mat: mat, g: list.g });
  });
  if (shadow) list.shadows.push(V);
}
function box(list, mat, x0, x1, y0, y1, z0, z1, shadow) {
  solid(list, mat, { x0: x0, x1: x1, y0: y0, y1: y1 }, { x0: x0, x1: x1, y0: y0, y1: y1 }, z1, z0, shadow);
}
// flat decal on an axis plane, pushed 0.4 out along normal
function decal(list, col, axis, at, a0, a1, b0, b1, n) {
  var o = at + 0.4 * (n[0] + n[1] + n[2]);
  var P;
  if (axis === 'z') P = [v3(a0, b0, o), v3(a1, b0, o), v3(a1, b1, o), v3(a0, b1, o)];
  else if (axis === 'x') P = [v3(o, b0, a0), v3(o, b0, a1), v3(o, b1, a1), v3(o, b1, a0)];
  else P = [v3(a0, o, b0), v3(a1, o, b0), v3(a1, o, b1), v3(a0, o, b1)];
  list.push({ pts: P, n: n, col: col, decal: true, g: list.g });
}
function buildScene() {
  var L = []; L.shadows = [];
  var push = L.push; L.push = function (f) { if (f.g === undefined) f.g = L.g; return push.call(L, f); };
  L.g = 'tower';
  box(L, 'cream', -128, -74, 0, 112, -58, 22, true);
  decal(L, '#6E4766', 'z', 22, -120, -82, 92, 98, [0, 0, 1]);
  decal(L, '#6E4766', 'z', 22, -120, -96, 82, 86, [0, 0, 1]);
  decal(L, '#D6A0C0', 'z', 22, -120, -82, 62, 64, [0, 0, 1]);
  decal(L, '#D6A0C0', 'z', 22, -120, -82, 56, 58, [0, 0, 1]);
  decal(L, '#7CF29A', 'z', 22, -88, -84, 14, 17, [0, 0, 1]);
  decal(L, '#F4DC74', 'x', -128, -36, -8, 62, 88, [-1, 0, 0]);
  decal(L, '#F4DC74', 'x', -128, -30, -24, 54, 62, [-1, 0, 0]);
  decal(L, '#F4DC74', 'x', -128, -16, -12, 57, 62, [-1, 0, 0]);
  decal(L, '#F4DC74', 'z', -58, -116, -92, 70, 92, [0, 0, -1]);
  L.g = 'stand';
  solid(L, 'stand', { x0: -40, x1: 40, y0: 0, y1: 7 }, { x0: -40, x1: 40, y0: 0, y1: 7 }, 26, -34, true);
  box(L, 'stand', -20, 20, 7, 20, -22, 6, false);
  L.g = 'monitor';
  var zf = 30, zb = 12;
  box(L, 'cream', -52, 52, 20, 40, zb, zf, true);
  box(L, 'cream', -52, 52, 95, 108, zb, zf, true);
  box(L, 'cream', -52, -36, 40, 95, zb, zf, false);
  box(L, 'cream', 36, 52, 40, 95, zb, zf, false);
  L.push({ pts: [v3(-36, 40, zf), v3(36, 40, zf), v3(36, 40, SCREEN.z), v3(-36, 40, SCREEN.z)], n: [0, 1, 0], mat: 'stand' });
  L.push({ pts: [v3(-36, 95, SCREEN.z), v3(36, 95, SCREEN.z), v3(36, 95, zf), v3(-36, 95, zf)], n: [0, -1, 0], mat: 'plum' });
  L.push({ pts: [v3(-36, 40, SCREEN.z), v3(-36, 40, zf), v3(-36, 95, zf), v3(-36, 95, SCREEN.z)], n: [1, 0, 0], mat: 'stand' });
  L.push({ pts: [v3(36, 40, zf), v3(36, 40, SCREEN.z), v3(36, 95, SCREEN.z), v3(36, 95, zf)], n: [-1, 0, 0], mat: 'plum' });
  L.push({ pts: [v3(-36, 40, SCREEN.z), v3(36, 40, SCREEN.z), v3(36, 95, SCREEN.z), v3(-36, 95, SCREEN.z)], n: [0, 0, 1], screen: true });
  solid(L, 'cream', { x0: -50, x1: 50, y0: 22, y1: 106 }, { x0: -34, x1: 34, y0: 34, y1: 94 }, zb, -46, true);
  decal(L, '#D6A0C0', 'x', 50, -6, 8, 40, 42, [1, 0, 0]);
  decal(L, '#C994C0', 'z', zf, -8, 34, 28, 32, [0, 0, 1]);
  decal(L, '#5E3858', 'z', zf, -6, 32, 29, 31, [0, 0, 1]);
  decal(L, '#C2603F', 'z', zf, -46, -36, 25, 33, [0, 0, 1]);
  decal(L, '#F28C55', 'z', zf, -45, -37, 27, 33, [0, 0, 1]);
  L.push({ pts: [v3(-31, 28, zf + 0.5), v3(-27, 28, zf + 0.5), v3(-27, 31, zf + 0.5), v3(-31, 31, zf + 0.5)], n: [0, 0, 1], led: true, decal: true });
  L.g = 'keyboard';
  solid(L, 'cream', { x0: -56, x1: 56, y0: 0, y1: 4 }, { x0: -56, x1: 56, y0: 0, y1: 10 }, 92, 52, true);
  var kt = function (z) { return 4 + (92 - z) / 40 * 6; };
  for (var r = 0; r < 4; r++) {
    for (var k = 0; k < 12; k++) {
      var z0 = 58 + r * 8, z1 = z0 + 5, x0 = -50 + k * 8.5, x1 = x0 + 6.5;
      if (r === 3 && (k < 3 || k > 8)) continue;
      if (r === 3 && k === 3) x1 = -50 + 8.5 * 8 + 6.5;
      if (r === 3 && k > 3) continue;
      L.push({ pts: [v3(x0, kt(z0) + 0.5, z0), v3(x1, kt(z0) + 0.5, z0), v3(x1, kt(z1) + 0.5, z1), v3(x0, kt(z1) + 0.5, z1)], n: norm([0, 1, 0.15]), mat: 'key', decal: true });
    }
  }
  L.g = 'mouse';
  solid(L, 'cream', { x0: 76, x1: 88, y0: 0, y1: 3 }, { x0: 77, x1: 87, y0: 0, y1: 6 }, 84, 66, true);
  decal(L, '#A57899', 'y', 6, 81.5, 82.5, 68, 75, [0, 1, 0]);
  return L;
}
var CABLE = [[0, 0, -40], [30, 0, -30], [46, 0, 10], [60, 0, 40], [82, 0, 66]];
var FONT = {
  W: ['10001', '10001', '10101', '10101', '01010'], A: ['01110', '10001', '11111', '10001', '10001'],
  K: ['10010', '10100', '11000', '10100', '10010'], E: ['11111', '10000', '11110', '10000', '11111'],
  U: ['10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '11110', '10000', '10000'], ' ': ['000', '000', '000', '000', '000'],
  L: ['10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '01110'], F: ['11111', '10000', '11110', '10000', '10000'], S: ['01111', '10000', '01110', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100'], R: ['11110', '10001', '11110', '10100', '10010'], '>': ['100', '110', '111', '110', '100'], I: ['111', '010', '010', '010', '111'], N: ['10001', '11001', '10101', '10011', '10001']
};
var FONT_S = {
  P: ['110', '101', '110', '100', '100'], O: ['111', '101', '101', '101', '111'], W: ['101', '101', '101', '111', '101'],
  E: ['111', '100', '110', '100', '111'], R: ['110', '101', '110', '101', '101'], N: ['101', '111', '111', '111', '101'],
  C: ['111', '100', '100', '100', '111'], L: ['100', '100', '100', '100', '111'], I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'], '>': ['100', '110', '111', '110', '100'], ' ': ['00', '00', '00', '00', '00']
};
var WOOD = ['#7A5034', '#8A5A3A', '#9E6842', '#A87046', '#B07A4C'];
var WOOD_GRAIN = '#8E5E3A';
var PROP_SCALE = 1.3;
var PROPS = [['plant', -245, 25], ['binders', -205, -20], ['pens', -172, -10], ['mug', 110, 30], ['phone', 155, -15], ['tray', 212, -35]];
function hash2(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hull(points) {
  var p = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
  var lo = [], up = [];
  p.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  p.slice().reverse().forEach(function (q) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

var POSES = {
  idle: { s: 0.68, pitch: 9, yaw: 18, fx: -20, fy: 104, fz: 10, hz: 136 },
  near: { s: 2.1, pitch: 2, yaw: 0, fx: 0, fy: 62, fz: 27, hz: 118 },
  into: { s: 7.5, pitch: 0, yaw: 0, fx: 0, fy: 67.5, fz: 27, hz: 118 }
};

class Component extends DCLogic {
  init() {
    if (this.ready) return;
    this.ready = true;
    this.state = { phase: 'off', sel: 0, step: 0 };
    this.cam = Object.assign({}, POSES.idle);
    this.t = 0;
    this.timers = [];
    this.scene = buildScene();
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
      { label: 'CRT scanlines', get: function () { return self.cfg.scan ? 'ON' : 'OFF'; }, change: function () { self.cfg.scan = !self.cfg.scan; } }
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
  project(p) {
    var c = this.cam, yaw = c.yaw * Math.PI / 180, pit = c.pitch * Math.PI / 180;
    var x = p[0] - c.fx, y = p[1] - c.fy, z = p[2] - c.fz;
    var x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    var y2 = y * Math.cos(pit) - z1 * Math.sin(pit), z2 = y * Math.sin(pit) + z1 * Math.cos(pit);
    return [CWID / 2 + x1 * c.s, CHGT / 2 - y2 * c.s, z2];
  }
  rotN(n) {
    var c = this.cam, yaw = c.yaw * Math.PI / 180, pit = c.pitch * Math.PI / 180;
    var z1 = -n[0] * Math.sin(yaw) + n[2] * Math.cos(yaw);
    return n[1] * Math.sin(pit) + z1 * Math.cos(pit);
  }
  shade(mat, n) {
    var d = dot(n, LIGHT), m = MAT[mat];
    return d > 0.62 ? m[0] : d > 0.2 ? m[1] : d > -0.25 ? m[2] : m[3];
  }
  draw() {
    var cv = this.canvasEl; if (!cv) return;
    var ctx = cv.getContext('2d'), self = this, on = this.state.phase !== 'off', c = this.cam, t = this.t;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    var used = {};
    var fill = function (pts, col) {
      used[col] = 1; ctx.fillStyle = col; ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.fill();
    };
    var rect = function (x, y, w, h, col) { used[col] = 1; ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    // ---- office back wall (parallax with the camera swing) and the desk top the PC stands on
    var hz = Math.round(c.hz);
    var par = -c.yaw * 1.1;
    var room = window.TokenfallOfficeRoom;
    ctx.imageSmoothingEnabled = false;
    rect(0, 0, CWID, hz, room.WALL_FILL);
    var wallX = Math.round(CWID / 2 - room.WALL_W / 2 + par * 0.5), wallY = hz - room.WALL_H;
    ctx.drawImage(room.wall(), wallX, wallY);
    room.drawWallLive(ctx, wallX, wallY, t, new Date());
    Object.keys(room.COLORS).forEach(function (col) { used[col] = 1; });
    var gh = CHGT - hz;
    for (var y2 = hz; y2 < CHGT; y2++) {
      var d = (y2 - hz) / Math.max(1, gh);
      rect(0, y2, CWID, 1, WOOD[Math.min(WOOD.length - 1, Math.floor(d * WOOD.length))]);
      if ((y2 - hz) % 3 !== 1) continue;
      for (var gi = 0; gi < 6; gi++) {
        var gx0 = ((hash2(gi, y2) * CWID * 1.5 + par * (0.4 + d)) % CWID + CWID) % CWID;
        rect(gx0, y2, 3 + Math.round(hash2(y2, gi) * 8 * (1 + d)), 1, WOOD_GRAIN);
      }
    }
    rect(0, hz, CWID, 1, '#C99260');
    // shadows
    this.scene.shadows.forEach(function (V) {
      var flat = V.map(function (p) { var k = p[1] / SHADOW_DIR[1]; return [p[0] + SHADOW_DIR[0] * k, p[2] + SHADOW_DIR[2] * k]; });
      fill(hull(flat).map(function (q) { return self.project([q[0], 0, q[1]]); }), '#5E3D28');
    });
    // cable
    used['#2A2734'] = 1; ctx.strokeStyle = '#2A2734'; ctx.lineWidth = Math.max(1, c.s * 0.8); ctx.beginPath();
    CABLE.forEach(function (p, i) { var q = self.project(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
    // desk props, farthest first; they stand beside the PC so they never interleave with its faces
    PROPS.map(function (p) { return { key: p[0], q: self.project([p[1], 0, p[2]]) }; })
      .sort(function (a, b) { return a.q[2] - b.q[2]; })
      .forEach(function (o) {
        var spr = room.SPRITES[o.key], sc = c.s * PROP_SCALE, w = spr.width * sc, h = spr.height * sc;
        var x = Math.round(o.q[0] - w / 2), y = Math.round(o.q[1] - h);
        ctx.drawImage(spr, x, y, w, h);
        room.drawPropLive(ctx, o.key, x, y, sc, t);
      });
    // faces
    // faces
    var faces = [], gd = {};
    this.scene.forEach(function (f) {
      var P = f.pts.map(function (p) { return self.project(p); });
      var avg = (P[0][2] + P[1][2] + P[2][2] + P[3][2]) / 4;
      var G = gd[f.g] || (gd[f.g] = { s: 0, n: 0 }); G.s += avg; G.n++;
      if (self.rotN(f.n) <= 0.02) return;
      faces.push({ f: f, P: P, d: avg + (f.decal ? 0.6 : 0) });
    });
    faces.forEach(function (o) { o.gd = gd[o.f.g].s / gd[o.f.g].n; });
    faces.sort(function (a, b) { return (a.gd - b.gd) || ((a.f.decal ? 1 : 0) - (b.f.decal ? 1 : 0)) || (a.d - b.d); });
    faces.forEach(function (o) {
      var f = o.f, col;
      if (f.screen) col = on ? '#140F24' : '#123A2C';
      else if (f.led) col = on ? '#7CF29A' : '#5E3858';
      else col = f.col || self.shade(f.mat, f.n);
      fill(o.P, col);
      if (f.screen && !on) {
        var z = SCREEN.z + 0.3;
        var px = function (x, y, w, h, col) { fill([self.project([x, y, z]), self.project([x + w, y, z]), self.project([x + w, y + h, z]), self.project([x, y + h, z])], col); };
        var write = function (text, font, cell, cy, col) {
          var w = 0; text.split('').forEach(function (ch) { w += (font[ch][0].length + 1) * cell; }); w -= cell;
          var x = -w / 2;
          text.split('').forEach(function (ch) {
            var g = font[ch];
            g.forEach(function (row, r) { row.split('').forEach(function (bit, k) { if (bit === '1') px(x + k * cell, cy - (r + 1) * cell, cell, cell, col); }); });
            x += (g[0].length + 1) * cell;
          });
        };
        px(-33, 91, 66, 1, '#2E7A5C');
        write('TOKEN', FONT, 1.8, 89, '#B8FFDA');
        write('FALL', FONT, 1.8, 78.5, '#B8FFDA');
        px(-33, 66, 66, 1, '#2E7A5C');
        write('> START', FONT, 1.4, 60, Math.floor(t * 1.6) % 2 === 0 ? '#8CF5BE' : '#2E7A5C');
      }
    });
    // snap every pixel to the palette    // snap every pixel to the palette -> crisp pixel art, no anti-aliasing
    var pal = Object.keys(used).map(hexToRgb);
    var img = ctx.getImageData(0, 0, cv.width, cv.height), u = new Uint32Array(img.data.buffer);
    var cache = this.qCache || (this.qCache = new Map());
    if (cache.size > 20000) cache.clear();
    var palKey = pal.map(function (q) { return q.join(','); }).join('|');
    if (palKey !== this.palKey) { cache.clear(); this.palKey = palKey; }
    var palU = pal.map(function (q) { return (255 << 24) | (q[2] << 16) | (q[1] << 8) | q[0]; });
    var prev = -1, prevOut = 0;
    for (var i = 0; i < u.length; i++) {
      var v = u[i];
      if (v === prev) { u[i] = prevOut; continue; }
      var out = cache.get(v);
      if (out === undefined) {
        var r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, bd = 1e9, best = 0;
        for (var j = 0; j < pal.length; j++) {
          var dr = r - pal[j][0], dg = g - pal[j][1], db = b - pal[j][2], dd = dr * dr + dg * dg + db * db;
          if (dd < bd) { bd = dd; best = j; if (dd === 0) break; }
        }
        out = palU[best]; cache.set(v, out);
      }
      prev = v; prevOut = out; u[i] = out;
    }
    ctx.putImageData(img, 0, 0);
    // where the screen lands on the page, for the HTML overlay
    var S = [[SCREEN.x0, SCREEN.y0], [SCREEN.x1, SCREEN.y0], [SCREEN.x1, SCREEN.y1], [SCREEN.x0, SCREEN.y1]].map(function (q) { return self.project([q[0], q[1], SCREEN.z]); });
    var xs = S.map(function (q) { return q[0]; }), ys = S.map(function (q) { return q[1]; });
    var c = this.cam, facing = Math.abs(c.yaw) < 1.5 && Math.abs(c.pitch) < 4 && c.s > 1.95;
    this.ov = { l: Math.min.apply(0, xs) * UP, t: Math.min.apply(0, ys) * UP, w: (Math.max.apply(0, xs) - Math.min.apply(0, xs)) * UP, h: (Math.max.apply(0, ys) - Math.min.apply(0, ys)) * UP, o: on && facing ? 1 : 0 };
  }
  componentDidMount() {
    this.init();
    var self = this, last = 0, lastO = -1;
    var step = function (now) {
      var dt = last ? Math.min(50, now - last) / 1000 : 0.016;
      last = now; self.t += dt;
      var p = self.state.phase, target;
      if (p === 'off') {
        target = Object.assign({}, POSES.idle);
        if ((self.props.orbit ?? true) && self.cfg.motion) target.yaw = 18 + Math.sin(self.t * 2 * Math.PI / 20) * 15;
      } else if (p === 'zoom' || p === 'done') target = POSES.into;
      else target = POSES.near;
      var k = Math.min(1, dt * (p === 'zoom' ? 3.2 : 2.4)), c = self.cam;
      ['s', 'pitch', 'yaw', 'fx', 'fy', 'fz', 'hz'].forEach(function (key) { c[key] += (target[key] - c[key]) * k; });
      if (p !== 'done') self.draw();
      var o = self.ov;
      if (o.o !== lastO || (o.o && (Math.abs(o.l - (self.lastL || 0)) > 0.5 || Math.abs(o.w - (self.lastW || 0)) > 0.5))) {
        lastO = o.o; self.lastL = o.l; self.lastW = o.w; self.forceUpdate();
      }
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  componentWillUnmount() { this.clear(); if (this.raf) cancelAnimationFrame(this.raf); if (this.chip) this.chip.close(); }
  renderVals() {
    this.init();
    var self = this, st = this.state, p = st.phase, o = this.ov;
    var on = p !== 'off';
    return {
      bg: '#0B1917',
      cursor: on ? 'default' : 'pointer',
      showSettings: this.settingsOpen,
      scanDisplay: this.cfg.scan ? 'block' : 'none',
      openSettings: this.openSettings, closeSettings: this.closeSettings, stop: this.stop,
      settingRows: this.ROWS.map(function (r, i) {
        var on3 = i === self.setSel, v = r.get();
        return { label: r.label, value: v, mark: on3 ? '▶' : '', change: self.rowChange[i], hover: self.rowHover[i],
          bg: on3 ? '#2A1F4A' : 'transparent', color: on3 ? '#FF6F91' : '#EDE9F7', valColor: v === 'OFF' ? '#8A7FA8' : '#9FE7FF' };
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
        return { label: label, mark: sel ? '▶' : '', color: sel ? '#FF6F91' : '#EDE9F7', go: self.menuGo[i], hover: self.menuHover[i] };
      }),
      rootRef: this.rootRef, canvasRef: this.canvasRef,
      onKey: this.onKey, onPower: this.onPower, onPcClick: this.onPcClick,
      toMenu: this.toMenu, reset: this.reset
    };
  }
}

/* ---------------- DOM layer (replaces the design-tool template) ---------------- */
var CSS = "\na{color:#FF6F91}a:hover{color:#FFB3C6}\n.root:focus{outline:none}\n.spr{background-repeat:no-repeat;image-rendering:pixelated}\n.scan{background:repeating-linear-gradient(to bottom,rgba(255,255,255,.04) 0 2px,rgba(0,0,0,.22) 2px 4px);pointer-events:none}\n.vig{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.5) 100%);pointer-events:none}\n.stars{width:2px;height:2px;background:transparent;box-shadow:24px 40px #9FE7FF,80px 120px #fff,140px 60px #9FE7FF,210px 150px #fff,300px 50px #fff,350px 130px #9FE7FF,420px 70px #fff,480px 160px #9FE7FF,520px 40px #fff,60px 220px #fff,170px 250px #9FE7FF,260px 200px #fff,390px 240px #fff,460px 210px #9FE7FF,530px 270px #fff,110px 290px #9FE7FF,330px 290px #fff,30px 160px #fff,250px 100px #9FE7FF,500px 110px #fff,90px 380px #fff,300px 400px #9FE7FF,470px 360px #fff}\n.blink{animation:blink 1s steps(1) infinite}\n@keyframes blink{50%{opacity:0}}\n.crton{animation:crton .45s ease-out both}\n@keyframes crton{0%{transform:scale(1,.004);filter:brightness(4)}60%{transform:scale(1,.004);filter:brightness(4)}100%{transform:scale(1,1);filter:brightness(1)}}\n.item{background:none;border:0;padding:6px 10px;min-height:44px;font-family:'Baloo 2','Nunito',sans-serif;font-size:30px;cursor:pointer;text-align:left;display:flex;gap:12px;align-items:center}\n.back{background:none;border:2px solid #FF6F91;color:#FF6F91;font-family:'Baloo 2','Nunito',sans-serif;font-size:16px;padding:8px 16px;min-height:44px;cursor:pointer}\n.back:hover{background:#FF6F91;color:#140F24}\n.setrow{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:48px;padding:0 14px;border:0;font-family:'Baloo 2','Nunito',sans-serif;font-size:18px;cursor:pointer;text-align:left}\n.setrow:focus-visible{outline:3px solid #9FE7FF;outline-offset:1px}\n.hud{background:#3A2470;color:#FFE6EC;border:0;font-family:'Baloo 2','Nunito',sans-serif;font-size:16px;padding:0 22px;min-height:48px;cursor:pointer;box-shadow:4px 4px 0 rgba(42,24,48,.35)}\n.hud:hover{background:#55349A}\n.hud:focus-visible,.back:focus-visible,.item:focus-visible{outline:3px solid #FFE6EC;outline-offset:2px}\n.enter{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;background:#FF6F91;color:#140F24;font-family:'Baloo 2','Nunito',sans-serif;font-size:24px;text-decoration:none;box-shadow:6px 6px 0 #8B6CFF}\n.enter:hover{background:#FFB3C6;color:#140F24}\n\n.tf-host{position:relative;overflow:hidden;background:#0B1917}\n.tf-stage{position:absolute;left:0;top:0;width:1280px;height:800px;transform-origin:0 0}\n.tf-crt{position:absolute;inset:0;background:#140F24}\n.tf-host button{font-family:'Baloo 2','Nunito',sans-serif}\n.tf-host .enter{border:0;cursor:pointer}\n";
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function screenHTML(v) {
  if (!v.isOn) return '';
  var h = '';
  if (v.isBoot) {
    h += '<div style="position:absolute;inset:0;padding:36px 34px;display:flex;flex-direction:column;gap:12px;color:#9FE7FF;font-size:19px">';
    v.bootLines.forEach(function (l) { h += '<p style="margin:0">' + esc(l.text) + '</p>'; });
    h += '<div style="margin-top:14px;width:360px;height:22px;border:2px solid #9FE7FF;padding:2px;box-sizing:border-box"><div style="height:100%;width:' + v.bootPct + '%;background:#FF6F91"></div></div></div>';
  }
  if (v.isMenu) {
    h += '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;border-top:14px solid #FF6F91;border-bottom:14px solid #5B3FA8;box-sizing:border-box">' +
      '<div style="border:4px solid #8B6CFF;padding:10px 36px;box-shadow:0 0 0 4px #140F24,0 0 0 8px #5B3FA8"><h1 style="margin:0;font-size:44px;font-weight:700;letter-spacing:3px;color:#FF6F91;text-shadow:4px 4px 0 #5B3FA8">TOKENFALL</h1></div>' +
      '<div style="display:flex;flex-direction:column;gap:2px">';
    v.menu.forEach(function (m, i) { h += '<button class="item" data-act="menu" data-i="' + i + '" style="color:' + m.color + '"><span style="width:22px;color:#FF6F91">' + m.mark + '</span><span>' + esc(m.label) + '</span></button>'; });
    h += '</div>' +
      '<p class="blink" style="margin:0;font-size:14px;color:#9FE7FF">↑ ↓ to choose · Enter to select</p></div>';
  }
  if (v.isControls) {
    h += '<div style="position:absolute;inset:0;padding:28px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:26px;color:#FF6F91;text-shadow:3px 3px 0 #5B3FA8">CONTROLS</h2><button class="back" data-act="toMenu">Back · Esc</button></div>' +
      '<div style="display:grid;grid-template-columns:200px 1fr;gap:14px 16px;font-size:17px">' +
      [['Arrows / WASD', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['E', 'Interact'], ['V', 'Switch view'], ['G', 'Glitch Log']].map(function (r) { return '<span style="color:#9FE7FF">' + r[0] + '</span><span style="color:#EDE9F7">' + r[1] + '</span>'; }).join('') +
      '</div></div>';
  }
  if (v.isZoom) h += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><p class="blink" style="margin:0;font-size:24px;color:#FF6F91">LOADING…</p></div>';
  return h;
}
function chromeHTML(v) {
  var h = '';
  if (v.showSettings) {
    h += '<div data-act="closeSettings" style="position:absolute;inset:0;z-index:6;background:rgba(8,6,20,.55);display:flex;align-items:center;justify-content:center">' +
      '<div role="dialog" aria-label="Settings" data-act="stop" style="width:460px;background:#1A1430;border:4px solid #8B6CFF;box-shadow:0 0 0 4px #140F24,8px 8px 0 4px rgba(0,0,0,.35);padding:24px 28px;display:flex;flex-direction:column;gap:18px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:26px;color:#FF6F91;text-shadow:3px 3px 0 #5B3FA8">SETTINGS</h2><button class="back" data-act="closeSettings">Close · Esc</button></div><div style="display:flex;flex-direction:column;gap:6px">';
    v.settingRows.forEach(function (r, i) {
      h += '<button class="setrow" data-act="setting" data-i="' + i + '" style="background:' + r.bg + ';color:' + r.color + '"><span style="display:flex;gap:10px;align-items:center"><span style="width:18px;color:#FF6F91">' + r.mark + '</span>' + esc(r.label) + '</span><span style="color:' + r.valColor + '">◀ ' + r.value + ' ▶</span></button>';
    });
    h += '</div><p style="margin:0;font-size:12px;color:#9FE7FF">↑ ↓ choose · ← → or Enter change · Esc close</p></div></div>';
  }
  if (v.isOff) h += '<div style="position:absolute;left:0;right:0;bottom:36px;display:flex;justify-content:center"><button class="hud" data-act="power"><span class="blink">▶</span>&nbsp; Power on</button></div>';
  if (v.showOff) h += '<div style="position:absolute;right:24px;bottom:24px"><button class="hud" data-act="power">Power off</button></div>';
  return h;
}

var styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return; styleInjected = true;
  if (!document.querySelector('link[data-tf-font]')) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-tf-font', '');
    l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600&display=swap'; document.head.appendChild(l);
  }
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}

function mount(container, opts) {
  opts = opts || {};
  if (!window.TokenfallOfficeRoom) throw new Error('TokenfallLauncher: load launcher/office-room.js before mounting');
  injectStyle();
  container.classList.add('tf-host');
  container.innerHTML = '<div class="tf-stage"><div class="root" tabindex="0" style="width:1280px;height:800px;position:relative;overflow:hidden;background:#0B1917;font-family:\'Baloo 2\',\'Nunito\',sans-serif">' +
    '<canvas width="640" height="400" role="img" aria-label="A retro beige computer with a tower, keyboard and mouse on an office desk at dusk, between binders, a plant, a mug, a desk phone and a corkboard" style="position:absolute;left:0;top:0;width:1280px;height:800px;image-rendering:pixelated"></canvas>' +
    '<div class="tf-ov" style="position:absolute;overflow:hidden;background:#140F24"><div class="tf-ovin" style="position:absolute;left:0;top:0;width:552px;height:421px;transform-origin:0 0"><div class="tf-screen"></div>' +
    '<div class="scan" style="position:absolute;inset:0"></div><div class="vig" style="position:absolute;inset:0"></div></div></div>' +
    '<div style="position:absolute;right:24px;top:24px;z-index:5"><button class="hud" data-act="openSettings" aria-haspopup="dialog"><svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" style="vertical-align:-2px;margin-right:8px"><path fill="currentColor" d="M7 0h2v2h2v2h2v2h2v4h-2v2h-2v2H9v2H7v-2H5v-2H3v-2H1V6h2V4h2V2h2zm0 5v1H6v4h1v1h2v-1h1V6H9V5z"/></svg>Settings</button></div>' +
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
      crt.innerHTML = '<div class="stars" style="position:absolute;left:0;top:0"></div><div class="tf-crt-body"></div>';
      crtBody = crt.lastChild; scr.appendChild(crt); lastScreen = null;
    } else if (!isOn && crt) {
      scr.removeChild(crt); crt = crtBody = null; lastScreen = null;
    }
  }
  c._render = function () {
    vals = c.renderVals();
    var hadFocus = rootEl.contains(document.activeElement);
    ov.style.cssText = 'position:absolute;overflow:hidden;background:#140F24;left:' + vals.ovLeft + 'px;top:' + vals.ovTop + 'px;width:' + vals.ovW + 'px;height:' + vals.ovH + 'px;opacity:' + vals.ovOpacity + ';pointer-events:' + vals.ovPointer;
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
  }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', fit);
  fit();
  c._render();
  c.componentDidMount();
  if (opts.autofocus !== false) rootEl.focus({ preventScroll: true });

  return {
    destroy: function () { c.componentWillUnmount(); if (ro) ro.disconnect(); else window.removeEventListener('resize', fit); container.innerHTML = ''; container.classList.remove('tf-host'); },
    powerOn: function () { if (c.state.phase === 'off') c.boot(); },
    reset: function () { c.reset(); }
  };
}
return { mount: mount, version: '1.0.0' };
});
