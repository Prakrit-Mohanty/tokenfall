// TokenFall launcher: the office around the 3D PC. A back wall (window onto a dusk city, poster, corkboard, clock)
// baked once, plus desk props as small sprites the launcher places in 3D. COLORS lists every colour drawn here so
// the launcher's palette snap keeps them exact.
(function (root) {
'use strict';
var WALL_W = 400, WALL_H = 150;
var COLORS = {};
var C = {
  wall: '#4B4868', wallLine: '#45425F', wallDark: '#3E3A57', skirting: '#2E2A44',
  frame: '#2E3248', sill: '#5A5E7E', sillHi: '#6E7294',
  bldg: '#262D5B', bldgHi: '#2E3365', litWarm: '#F6D58A', litCool: '#C9C3FF',
  slat: '#5E4780', slatHi: '#774F84', cord: '#925883',
  paper: '#F3EAD6', paperLo: '#E2D9C4', steel: '#8C93A8', steelHi: '#A8AEC0', steelLo: '#6E7488',
  ink: '#2A2438', pink: '#FF6F91', gold: '#D9B46A', red: '#D9483F', blue: '#3F6FA8', green: '#4E8A5A',
  cork: '#C9925A', corkLo: '#B07A48', corkHi: '#D8A46C', corkFrame: '#8A5A36', corkFrameHi: '#A87048',
  shadow: '#5E3D28', steamNear: '#B9B6CA', steamFar: '#8F8CA6', ledOn: '#E2463C', ledOff: '#5A2A2A'
};
var DUSK = ['#161B40', '#1B2148', '#202751', '#262D5B', '#2E3365', '#3A386E', '#4A3F78', '#5E4780', '#774F84', '#925883', '#AE6280', '#C86E7C'];
var FONT3 = {
  A: '010101111101101', C: '011100100100011', D: '110101101101110', I: '111010010010111', O: '010101101101010',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', Y: '101101010010010', ' ': '000000000000000'
};
Object.keys(C).forEach(function (k) { COLORS[C[k]] = 1; });

function px(g, x, y, w, h, c) { COLORS[c] = 1; g.fillStyle = c; g.fillRect(x, y, w, h); }
function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function text(g, s, x, y, c) {
  s.split('').forEach(function (ch, i) {
    var bits = FONT3[ch] || FONT3[' '];
    for (var b = 0; b < 15; b++) if (bits[b] === '1') px(g, x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1, c);
  });
}
function roundRect(g, x, y, w, h, r, c) {
  for (var j = 0; j < h; j++) {
    var d = j < r ? r - j : j >= h - r ? j - (h - r - 1) : 0;
    var inset = d ? Math.ceil(r - Math.sqrt(r * r - d * d)) : 0;
    px(g, x + inset, y + j, w - 2 * inset, 1, c);
  }
}
function line(g, x0, y0, x1, y1, c) {
  var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (var i = 0; i <= n; i++) px(g, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, c);
}
function canvas(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function stickyNote(g, x, y, w, h, col, lo, lines, pin) {
  px(g, x, y, w, h, col);
  px(g, x, y + h - 1, w, 1, lo); px(g, x + w - 1, y, 1, h, lo);
  for (var i = 0; i < lines; i++) px(g, x + 2, y + 3 + i * 3, w - 5 - (i % 2) * 2, 1, lo);
  if (pin) { px(g, x + (w >> 1) - 1, y - 1, 2, 2, C.red); px(g, x + (w >> 1) - 1, y - 1, 1, 1, '#F07A6E'); }
}

/* ---------- back wall ---------- */
var LIT = [], CLOCK = { x: 330, y: 20, r: 13 };

function brick(g) {
  px(g, 0, 0, WALL_W, WALL_H, C.wall);
  for (var b = 0; b * 8 < WALL_H; b++) {
    px(g, 0, b * 8 + 7, WALL_W, 1, C.wallLine);
    for (var x = b % 2 ? 8 : 0; x < WALL_W; x += 16) px(g, x, b * 8, 1, 7, C.wallLine);
  }
  px(g, 0, WALL_H - 6, WALL_W, 2, C.wallDark);
  px(g, 0, WALL_H - 4, WALL_W, 4, C.skirting);
}

function poster(g) {
  px(g, 50, 4, 68, 20, C.frame);
  px(g, 52, 6, 64, 16, '#1F2440');
  text(g, 'STAY CURIOUS', 52 + ((64 - 47) >> 1), 11, C.pink);
  px(g, 56, 13, 1, 1, C.gold); px(g, 111, 13, 1, 1, C.gold);
}

function windowView(g) {
  var gx = 43, gy = 33, gw = 78, gh = 84;
  px(g, 40, 30, 84, 92, C.frame);
  for (var y = 0; y < gh; y++) px(g, gx, gy + y, gw, 1, DUSK[Math.min(DUSK.length - 1, Math.floor(y / gh * DUSK.length))]);
  [[45, 12, 72], [59, 9, 62], [70, 13, 80], [85, 10, 56], [97, 12, 70], [111, 9, 84]].forEach(function (bd) {
    var x = bd[0], w = bd[1], top = bd[2];
    px(g, x, top, w, gy + gh - top, C.bldg); px(g, x, top, 1, gy + gh - top, C.bldgHi);
    for (var wx = x + 2; wx < x + w - 1; wx += 3) {
      for (var wy = top + 3; wy < gy + gh - 2; wy += 4) {
        if (hash(wx, wy) < 0.5) continue;
        px(g, wx, wy, 1, 2, hash(wy, wx) > 0.8 ? C.litCool : C.litWarm);
        if (wy >= 74) LIT.push([wx, wy]);
      }
    }
  });
  for (var sy = gy; sy < 66; sy += 6) { px(g, gx, sy, gw, 1, C.slatHi); px(g, gx, sy + 1, gw, 2, C.slat); }
  px(g, gx, 66, gw, 2, C.slatHi);
  px(g, 64, gy, 1, 33, C.cord); px(g, 100, gy, 1, 33, C.cord);
  px(g, 81, gy, 2, gh, C.frame);
  px(g, 38, 120, 88, 4, C.sill); px(g, 38, 120, 88, 1, C.sillHi);
  stickyNote(g, 114, 28, 12, 11, '#F2B05A', '#C98A3E', 2);
}

function corkboard(g) {
  var ox = 42;
  px(g, 234 + ox, 40, 80, 76, C.corkFrame); px(g, 234 + ox, 40, 80, 1, C.corkFrameHi);
  px(g, 237 + ox, 43, 74, 70, C.cork);
  for (var i = 0; i < 160; i++) px(g, 237 + ox + Math.floor(hash(i, 1) * 74), 43 + Math.floor(hash(i, 2) * 70), 1, 1, i % 3 ? C.corkLo : C.corkHi);
  stickyNote(g, 240 + ox, 46, 14, 14, '#F2D36B', '#C9A848', 3, true);
  stickyNote(g, 258 + ox, 50, 14, 14, '#F29BB0', '#C87088', 3, true);
  px(g, 278 + ox, 46, 28, 24, C.paper); px(g, 278 + ox, 69, 28, 1, C.paperLo);
  px(g, 281 + ox, 49, 1, 18, C.ink); px(g, 281 + ox, 66, 22, 1, C.ink);
  [[284, 5, C.blue], [289, 9, C.green], [294, 12, C.gold], [299, 16, C.pink]].forEach(function (b) { px(g, b[0] + ox, 66 - b[1], 3, b[1], b[2]); });
  px(g, 291 + ox, 45, 2, 2, C.red);
  stickyNote(g, 242 + ox, 68, 14, 14, '#8FD8E8', '#5FAABC', 3, true);
  px(g, 262 + ox, 76, 28, 28, C.paper); px(g, 262 + ox, 76, 28, 5, C.red); px(g, 266 + ox, 75, 1, 3, C.ink); px(g, 285 + ox, 75, 1, 3, C.ink);
  for (var r = 0; r < 5; r++) for (var c = 0; c < 7; c++) px(g, 265 + ox + c * 3, 84 + r * 4, 2, 2, '#C9C1AE');
  px(g, 276 + ox, 87, 5, 1, C.red); px(g, 276 + ox, 91, 5, 1, C.red); px(g, 275 + ox, 88, 1, 3, C.red); px(g, 281 + ox, 88, 1, 3, C.red);
  stickyNote(g, 294 + ox, 78, 14, 14, '#A8E07A', '#7AB050', 3, true);
  px(g, 240 + ox, 88, 20, 22, C.paper); px(g, 240 + ox, 109, 20, 1, C.paperLo);
  text(g, 'TODO', 242 + ox, 90, C.ink);
  for (var t = 0; t < 3; t++) { px(g, 242 + ox, 97 + t * 4, 2, 2, C.steel); px(g, 246 + ox, 98 + t * 4, 11 - t * 2, 1, C.steelLo); }
  px(g, 249 + ox, 87, 2, 2, C.red);
}

function clockFace(g) {
  var cx = CLOCK.x, cy = CLOCK.y, r = CLOCK.r;
  for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
    var d = Math.sqrt(x * x + y * y);
    if (d <= r) px(g, cx + x, cy + y, 1, 1, d > r - 2 ? C.frame : C.paper);
  }
  px(g, cx - 1, cy - r + 3, 2, 2, C.ink); px(g, cx - 1, cy + r - 4, 2, 2, C.ink);
  px(g, cx - r + 3, cy - 1, 2, 2, C.ink); px(g, cx + r - 4, cy - 1, 2, 2, C.ink);
}

var wallCv = null;
function wall() {
  if (wallCv) return wallCv;
  wallCv = canvas(WALL_W, WALL_H);
  var g = wallCv.getContext('2d');
  LIT = [];
  brick(g); poster(g); windowView(g); corkboard(g); clockFace(g);
  return wallCv;
}

// clock hands from the real time + a few city windows blinking, drawn over the baked wall at (ox, oy)
function drawWallLive(g, ox, oy, t, now) {
  for (var i = 0; i < 4 && LIT.length; i++) {
    var w = LIT[(Math.floor(t * 0.7) * 7 + i * 13) % LIT.length];
    px(g, ox + w[0], oy + w[1], 1, 2, C.bldg);
  }
  var cx = ox + CLOCK.x, cy = oy + CLOCK.y, sec = now.getSeconds(), min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
  var hand = function (frac, len, c) { var a = frac * Math.PI * 2; line(g, cx, cy, cx + Math.sin(a) * len, cy - Math.cos(a) * len, c); };
  hand(hr / 12, 6, C.ink); hand(min / 60, 9, C.ink); hand(sec / 60, 10, C.red);
  px(g, cx, cy, 1, 1, C.red);
}

/* ---------- desk props: each sprite is bottom-aligned, last row is its contact shadow ---------- */
function sprite(w, h, draw) { var cv = canvas(w, h); draw(cv.getContext('2d'), w, h); return cv; }

var SPRITES = {
  binders: sprite(36, 41, function (g) {
    [['#B8473F', '#8E3530', '#D06058', 38], ['#3F6FA8', '#2E5288', '#5A88C0', 34], ['#D9B46A', '#B08A48', '#ECCB86', 40],
     ['#4E8A5A', '#3A6A44', '#68A474', 36], ['#7A5AA0', '#5E4480', '#9478BA', 33]].forEach(function (b, i) {
      var x = 1 + i * 7, h = b[3], y = 40 - h;
      px(g, x, y, 7, h, b[0]); px(g, x + 6, y, 1, h, b[1]); px(g, x, y, 6, 1, b[2]);
      px(g, x + 2, y + 6, 3, 8, C.paper); px(g, x + 3, 40 - 14, 1, 2, C.ink);
    });
    px(g, 0, 40, 36, 1, C.shadow);
  }),
  plant: sprite(36, 47, function (g) {
    [[-0.55, 18, '#5E8A3A'], [0.5, 20, '#78A048'], [-1.1, 13, '#466C2C'], [1.1, 14, '#5E8A3A'], [0.05, 25, '#78A048'], [-0.25, 22, '#466C2C']].forEach(function (f) {
      for (var i = 0; i < f[1]; i++) {
        var w = i < f[1] * 0.2 || i > f[1] * 0.8 ? 1 : 2;
        px(g, Math.round(18 + f[0] * i), 28 - Math.round(i * (Math.abs(f[0]) > 1 ? 0.6 : 1)), w, 1, f[2]);
      }
    });
    px(g, 10, 30, 16, 16, '#C07A4A'); px(g, 23, 31, 3, 15, '#9A5C36'); px(g, 8, 28, 20, 3, '#D8935E');
    px(g, 9, 46, 19, 1, C.shadow);
  }),
  mug: sprite(16, 17, function (g) {
    px(g, 0, 1, 12, 15, '#E9E2D2'); px(g, 10, 1, 2, 15, '#C9C1AE'); px(g, 0, 0, 12, 1, '#F7F2E6');
    px(g, 1, 1, 10, 2, '#5A3A24'); px(g, 0, 6, 12, 2, C.pink);
    px(g, 12, 4, 3, 1, '#C9C1AE'); px(g, 14, 4, 1, 6, '#C9C1AE'); px(g, 12, 9, 3, 1, '#C9C1AE');
    px(g, 0, 16, 16, 1, C.shadow);
  }),
  phone: sprite(38, 23, function (g) {
    roundRect(g, 0, 0, 38, 7, 3, '#2F3342'); px(g, 4, 0, 30, 1, '#4E546A');
    px(g, 2, 7, 34, 15, '#2F3342'); px(g, 3, 7, 32, 2, '#454A5C');
    for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) px(g, 19 + c * 4, 10 + r * 3, 2, 2, C.steel);
    px(g, 5, 10, 9, 4, '#3B5A6E'); px(g, 6, 11, 7, 2, '#9FE7FF');
    px(g, 1, 22, 37, 1, C.shadow);
  }),
  pens: sprite(10, 36, function (g) {
    px(g, 2, 5, 1, 12, C.red); px(g, 5, 8, 1, 9, C.frame);
    px(g, 7, 3, 2, 14, C.gold); px(g, 7, 1, 2, 2, C.paper); px(g, 7, 0, 2, 1, '#3A2E2A');
    px(g, 0, 18, 10, 17, C.blue); px(g, 8, 18, 2, 17, '#2E5288'); px(g, 0, 17, 10, 1, '#5A88C0');
    px(g, 0, 35, 10, 1, C.shadow);
  }),
  tray: sprite(32, 19, function (g) {
    px(g, 3, 0, 26, 3, C.paper); px(g, 2, 3, 28, 2, C.paperLo);
    px(g, 0, 5, 32, 13, C.steel); px(g, 0, 5, 32, 1, C.steelHi); px(g, 0, 14, 32, 4, C.steelLo);
    px(g, 11, 8, 10, 3, C.paper);
    px(g, 0, 18, 32, 1, C.shadow);
  })
};

// animated bits on a placed sprite; (x, y) is its top-left on screen and sc its scale
function drawPropLive(g, key, x, y, sc, t) {
  var dot = function (lx, ly, w, h, c) { px(g, x + lx * sc, y + ly * sc, Math.max(1, w * sc), Math.max(1, h * sc), c); };
  if (key === 'mug') {
    for (var k = 0; k < 2; k++) for (var j = 1; j < 11; j++) {
      if ((j + Math.floor(t * 8)) % 3 === 0) continue;
      dot(4 + k * 4 + Math.round(Math.sin(j * 0.7 - t * 3 + k * 2) * 1.2), -j, 1, 1, j < 6 ? C.steamNear : C.steamFar);
    }
  } else if (key === 'phone') {
    dot(7, 16, 2, 2, Math.floor(t * 1.2) % 2 ? C.ledOn : C.ledOff);
  }
}

root.TokenfallOfficeRoom = { WALL_W: WALL_W, WALL_H: WALL_H, WALL_FILL: C.wall, COLORS: COLORS, wall: wall, drawWallLive: drawWallLive, SPRITES: SPRITES, drawPropLive: drawPropLive };
})(typeof window !== 'undefined' ? window : this);
