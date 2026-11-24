// TokenFall launcher: the golden-hour city outside the ABZ window (Baner, Pune, seen from the 15th floor).
// Soft rounded toy blocks with rooftop tanks, stair cabins, balconies and laundry; roads with little cars and autos,
// the metro on its viaduct, round trees and palms, a hazy hill line, puffy cumulus and drifting birds.
// Buildings and clouds are merged into a few meshes with the sunset light baked into vertex colours (sunlit faces
// orange-gold, shade faces violet), so the whole city costs a handful of draw calls. build(THREE, room) returns
// { group, update(t) }; office-room.js adds it behind the window.
(function (root) {
'use strict';
var G = -420, TW = 40, TH = 30;
var SUN = [1150, 820, -8700];
var KEY = (function () { var v = [0.8, 0.42, 0.4], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
var FACADES = ['#F6E7C8', '#F5C7A6', '#BFE3CC', '#F6E08E', '#AFCFE8', '#D9805E', '#C9C0D6', '#F2DCC0', '#F7D3B5'];
function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

/* ---------- facade tiles: one window per TW x TH cell ---------- */
function drawWindows(g, w, h) {
  g.fillStyle = '#E4E4E4'; g.fillRect(0, 0, w, h);
  window.TokenfallOfficeRoom.rr(g, 27, 19, 74, 58, 12, '#A9A4A8');
  var pane = g.createLinearGradient(0, 22, 0, 74);
  pane.addColorStop(0, '#8F86B4'); pane.addColorStop(0.55, '#D59EA6'); pane.addColorStop(1, '#F2B596');
  window.TokenfallOfficeRoom.rr(g, 30, 22, 68, 52, 10, pane);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(40, 26); g.lineTo(56, 26); g.lineTo(42, 52); g.lineTo(34, 52); g.closePath(); g.fill();
  window.TokenfallOfficeRoom.rr(g, 24, 78, 80, 6, 3, '#FFFFFF');
}
function drawBalcony(g, w, h) {
  g.fillStyle = '#E4E4E4'; g.fillRect(0, 0, w, h);
  var rr = window.TokenfallOfficeRoom.rr;
  rr(g, 30, 10, 68, 70, 10, '#A39EA6');
  var pane = g.createLinearGradient(0, 12, 0, 78);
  pane.addColorStop(0, '#8A82B2'); pane.addColorStop(0.6, '#D69CA4'); pane.addColorStop(1, '#EFAE92');
  rr(g, 33, 13, 62, 66, 8, pane);
  g.fillStyle = '#FFFFFF'; g.fillRect(20, 80, 88, 9);
  g.fillStyle = '#F4F4F4'; g.fillRect(22, 58, 84, 4);
  for (var x = 26; x < 106; x += 10) g.fillRect(x, 58, 2.5, 22);
}
function drawBillboard(g, w, h) {
  var R = window.TokenfallOfficeRoom;
  R.rr(g, 0, 0, w, h, 12, '#F5C842');
  g.fillStyle = '#5B4520'; g.font = '600 ' + Math.round(h * 0.34) + 'px ' + R.FONT_UI; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HOMES IN BANER', w / 2, h * 0.42);
  R.rr(g, w * 0.3, h * 0.66, w * 0.4, h * 0.12, h * 0.06, '#E8742F');
}

function build(THREE, room) {
  var group = new THREE.Group(), anim = [];
  var lin = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var SHADE = lin('#9C8CCB'), WARM = lin('#FFBF86'), RIM = lin('#FFD9A0');

  // rounded box, cheap enough to merge by the hundred
  function rbox(w, h, d, r) {
    r = Math.min(r, w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5);
    var sw = w - 2 * r, sh = h - 2 * r, s = new THREE.Shape();
    s.moveTo(-sw / 2, -sh / 2); s.lineTo(sw / 2, -sh / 2); s.lineTo(sw / 2, sh / 2); s.lineTo(-sw / 2, sh / 2); s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals();
    return g;
  }
  var boxG = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), cylG = new THREE.CylinderGeometry(1, 1, 1, 12).toNonIndexed(), ballG = new THREE.IcosahedronGeometry(1, 1);

  // a batch merges many shapes into one mesh with the sunset baked into vertex colours
  function Batch(map, fog) { this.p = []; this.c = []; this.u = []; this.map = map; this.fog = fog !== false; }
  Batch.prototype.add = function (geo, x, y, z, o) {
    o = o || {};
    var g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal;
    var ry = o.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry), sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1;
    var col = typeof o.color === 'string' ? lin(o.color) : o.color, bx = o.box, glow = o.glow || 0;
    for (var i = 0; i < P.count; i++) {
      var lx = P.getX(i) * sx, ly = P.getY(i) * sy, lz = P.getZ(i) * sz;
      var nx = N.getX(i) / sx, ny = N.getY(i) / sy, nz = N.getZ(i) / sz, nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      var wx = x + lx * cs + lz * sn, wy = y + ly, wz = z - lx * sn + lz * cs, rnx = nx * cs + nz * sn, rnz = -nx * sn + nz * cs;
      this.p.push(wx, wy, wz);
      var ndl = rnx * KEY[0] + ny * KEY[1] + rnz * KEY[2];
      var lit = Math.min(1, Math.max(0, (ndl - 0.05) / 0.6)) * (1 - glow) + glow;
      var edge = 1 - Math.max(Math.abs(rnx), Math.abs(ny), Math.abs(rnz));
      var amb = 0.62 + 0.38 * Math.min(1, Math.max(0, (wy - G) / 700));
      this.c.push(
        col.r * (SHADE.r * (1 - lit) + WARM.r * lit) * amb + RIM.r * edge * lit * 0.9,
        col.g * (SHADE.g * (1 - lit) + WARM.g * lit) * amb + RIM.g * edge * lit * 0.9,
        col.b * (SHADE.b * (1 - lit) + WARM.b * lit) * amb + RIM.b * edge * lit * 0.9);
      if (!bx || Math.abs(ny) > 0.7) this.u.push(0.03, 0.03);
      else if (Math.abs(nz) >= Math.abs(nx)) this.u.push((P.getX(i) + bx.w / 2) / TW, (P.getY(i) + bx.h / 2) / TH);
      else this.u.push((P.getZ(i) + bx.d / 2) / TW, (P.getY(i) + bx.h / 2) / TH);
    }
  };
  Batch.prototype.mesh = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, map: this.map || null, fog: this.fog }));
  };
  var tile = function (draw) { var t = room.canvasTex(THREE, 128, 96, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  var winB = new Batch(tile(drawWindows)), balB = new Batch(tile(drawBalcony)), bare = new Batch(null);
  var litWin = [];

  /* ground and roads */
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 16000), new THREE.MeshBasicMaterial({ color: lin('#B89784') }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, G, -6000); group.add(ground);
  var ROWS = [-1500, -2050, -2650, -3300, -4000, -4800, -5700, -6700, -7700];
  var roads = [], lamps = [];
  ROWS.forEach(function (z, r) {
    if (r % 2) return;
    var rz = z + 300, xm = 900 + Math.abs(rz) * 0.9;
    bare.add(boxG, 0, G + 1, rz, { sx: xm * 2, sy: 2, sz: 80, color: '#8E8296' });
    bare.add(boxG, 0, G + 2, rz - 46, { sx: xm * 2, sy: 3, sz: 12, color: '#D9C2B0' });
    bare.add(boxG, 0, G + 2, rz + 46, { sx: xm * 2, sy: 3, sz: 12, color: '#D9C2B0' });
    roads.push({ z: rz, xm: xm });
    for (var x = -xm; x < xm; x += 170) { lamps.push(x, G + 34, rz - 52, x + 85, G + 34, rz + 52); bare.add(cylG, x, G + 17, rz - 52, { sx: 1.6, sy: 34, sz: 1.6, color: '#6E6478' }); }
  });

  /* trees: instanced round canopies in mixed greens */
  var trees = [];
  var tree = function (x, z, s, y) { trees.push([x, z, s, y]); };
  roads.forEach(function (rd, i) { for (var x = -rd.xm; x < rd.xm; x += 95 + hash(i, x | 0) * 70) { tree(x, rd.z - 66, 26 + hash(x | 0, i) * 18); if (hash(i, x | 0) > 0.4) tree(x + 40, rd.z + 66, 24 + hash(i + 7, x | 0) * 18); } });

  /* buildings */
  var bid = 0;
  function building(x, z, nx, nz, floors, near) {
    var id = bid++, w = nx * TW, d = nz * TW, h = floors * TH + 10, top = G + h;
    var col = FACADES[Math.floor(hash(id, 3) * FACADES.length)];
    var useBal = near && hash(id, 4) > 0.45;
    (useBal ? balB : winB).add(rbox(w, h, d, 7), x, G + h / 2, z, { color: col, box: { w: w, h: h, d: d } });
    // parapet with a soft rounded cap
    var pc = new THREE.Color(col).lerp(new THREE.Color('#FFFFFF'), 0.45).getStyle();
    bare.add(rbox(w + 4, 12, 6, 2.5), x, top + 5, z + d / 2 - 1, { color: pc });
    bare.add(rbox(w + 4, 12, 6, 2.5), x, top + 5, z - d / 2 + 1, { color: pc });
    bare.add(rbox(6, 12, d, 2.5), x - w / 2 + 1, top + 5, z, { color: pc });
    bare.add(rbox(6, 12, d, 2.5), x + w / 2 - 1, top + 5, z, { color: pc });
    // stair cabin, Sintex tanks, solar panels, AC units, railings, terrace plants
    var cx = x + (hash(id, 5) - 0.5) * (w - 70), cz = z + (hash(id, 6) - 0.5) * (d - 60);
    if (hash(id, 7) > 0.25) bare.add(rbox(52, 40, 44, 6), cx, top + 20, cz, { color: pc });
    var tanks = 1 + Math.floor(hash(id, 8) * 3);
    for (var k = 0; k < tanks; k++) {
      var tx = x + (hash(id, 10 + k) - 0.5) * (w - 40), tz = z + (hash(id, 20 + k) - 0.5) * (d - 40), blue = hash(id, 30 + k) > 0.55;
      bare.add(boxG, tx, top + 6, tz, { sx: 26, sy: 12, sz: 26, color: '#9C8E8A' });
      bare.add(cylG, tx, top + 23, tz, { sx: 11, sy: 22, sz: 11, color: blue ? '#3C6CB0' : '#2C2A34' });
      bare.add(ballG, tx, top + 34, tz, { sx: 11, sy: 4, sz: 11, color: blue ? '#3C6CB0' : '#2C2A34' });
    }
    if (hash(id, 9) > 0.6) for (var s = 0; s < 3; s++) bare.add(boxG, x - w / 4 + s * 30, top + 12, z + d / 4, { sx: 26, sy: 3, sz: 20, color: '#33446E', glow: 0.3 });
    if (hash(id, 11) > 0.55) {
      bare.add(boxG, x, top + 24, z + d / 2 - 2, { sx: w, sy: 2, sz: 2, color: '#F4F0EA' });
      bare.add(boxG, x - w / 2 + 2, top + 24, z, { sx: 2, sy: 2, sz: d, color: '#F4F0EA' });
      for (var pp = -w / 2; pp <= w / 2; pp += 24) bare.add(boxG, x + pp, top + 18, z + d / 2 - 2, { sx: 2, sy: 12, sz: 2, color: '#F4F0EA' });
    }
    if (hash(id, 12) > 0.6) for (var b = 0; b < 4; b++) tree(x - w / 2 + 20 + b * 22, z + d / 2 - 22, 9, top + 8);
    // the street-facing face: AC units, awnings, laundry, warm lit windows
    for (var fy = 1; fy < floors; fy++) for (var fx = 0; fx < nx; fx++) {
      var hv = hash(id * 31 + fx, fy), wxp = x - w / 2 + TW * (fx + 0.5), wyp = G + TH * (fy + 0.5) + 5;
      if (hv < 0.09) litWin.push([wxp, wyp, z + d / 2 + 0.7, hash(fy, id) > 0.5 ? '#FFD27A' : '#FFB45E']);
      else if (near && hv < 0.15) bare.add(rbox(14, 10, 8, 2), wxp + 15, wyp - 10, z + d / 2 + 4, { color: '#EEEAE6' });
      else if (near && hv < 0.19) bare.add(rbox(30, 3, 12, 1.4), wxp, wyp + 12, z + d / 2 + 6, { color: ['#E8736A', '#4FA3A5', '#F2C14E', '#7C6CC4'][Math.floor(hv * 100) % 4] });
      else if (useBal && hv < 0.25) for (var l = 0; l < 3; l++) bare.add(boxG, wxp - 10 + l * 10, wyp - 4, z + d / 2 + 3, { sx: 7, sy: 9, sz: 1, color: ['#E8736A', '#F7F2E8', '#5FA8D8', '#F2C14E', '#B87CC4'][(fy + l + fx) % 5], glow: 0.3 });
    }
    // left-hand buildings show their sunlit side to us: a few lit windows there too
    if (x < 0 && hash(id, 13) > 0.5) for (var sy2 = 2; sy2 < floors; sy2 += 3) litWin.push([x + w / 2 + 0.7, G + TH * (sy2 + 0.5) + 5, z, '#FFC46A', true]);
  }
  ROWS.forEach(function (z, r) {
    var xm = 700 + Math.abs(z) * 0.85, x = -xm, near = z > -3400;
    while (x < xm) {
      var nx = 3 + Math.floor(hash(r, x | 0) * 5), w = nx * TW, cx = x + w / 2;
      var skip = (z > -2100 && cx > 260 && cx < 1020) || (z < -2400 && z > -2900 && cx > -620 && cx < -40);
      if (!skip) {
        var cap = near ? 4 + Math.floor(hash(x | 0, r) * 6) : 6 + Math.floor(hash(x | 0, r) * 7);
        if (hash(r + 3, x | 0) > 0.9) cap += 8 + Math.floor(hash(r, x | 0) * 8);
        building(cx, z + (hash(r, (x | 0) + 1) - 0.5) * 60, nx, 4 + Math.floor(hash(x | 0, r + 5) * 3), cap, near);
      } else if (z > -2100) tree(cx, z, 40);
      x += w + 40 + hash(x | 0, r + 9) * 80;
      if (hash(r + 11, x | 0) > 0.8) { tree(x + 30, z, 34); tree(x + 70, z + 30, 30); x += 110; }
    }
  });

  /* the big terracotta tower on the right: recessed balconies, glass doors, rails, slab edges, a roof-garden crown */
  var KX = 640, KZ = -1750, kw = 460, kd = 300, kf = 30, kh = kf * TH + 20, ktop = G + kh;
  bare.add(rbox(kw - 30, kh, kd - 40, 10), KX, G + kh / 2, KZ - 20, { color: '#C9694A' });
  for (var pi = 0; pi <= 5; pi++) bare.add(rbox(18, kh, 40, 5), KX - kw / 2 + 9 + pi * (kw - 18) / 5, G + kh / 2, KZ + kd / 2 - 20, { color: '#D57A55' });
  for (var f = 0; f < kf; f++) {
    var fy0 = G + f * TH + 20;
    bare.add(rbox(kw + 6, 6, 44, 2.5), KX, fy0, KZ + kd / 2 - 18, { color: '#F4E0C8' });
    for (var bb = 0; bb < 5; bb++) {
      var bxp = KX - kw / 2 + 9 + (bb + 0.5) * (kw - 18) / 5, hv2 = hash(f, bb + 40);
      bare.add(boxG, bxp, fy0 + 16, KZ + kd / 2 - 40, { sx: 62, sy: 26, sz: 2, color: hv2 > 0.88 ? '#FFC870' : f % 3 ? '#A98FB8' : '#C7A0B4', glow: hv2 > 0.88 ? 1 : 0 });
      bare.add(boxG, bxp, fy0 + 17, KZ + kd / 2 + 1, { sx: 80, sy: 2.4, sz: 2.4, color: '#F6EEE6' });
      bare.add(boxG, bxp, fy0 + 10, KZ + kd / 2 + 1, { sx: 80, sy: 1.6, sz: 1.6, color: '#F6EEE6' });
      if (hv2 < 0.07) for (var lq = 0; lq < 3; lq++) bare.add(boxG, bxp - 14 + lq * 12, fy0 + 11, KZ + kd / 2 + 2, { sx: 8, sy: 10, sz: 1, color: ['#E8736A', '#5FA8D8', '#F2C14E'][lq], glow: 0.3 });
    }
  }
  bare.add(rbox(kw + 10, 18, kd, 6), KX, ktop + 9, KZ - 10, { color: '#E8C7AE' });
  bare.add(rbox(kw - 60, 50, kd - 70, 10), KX, ktop + 34, KZ - 20, { color: '#F1DCC6' });
  bare.add(rbox(kw - 120, 10, kd - 120, 5), KX, ktop + 66, KZ - 20, { color: '#A8714C' });
  for (var gb = 0; gb < 14; gb++) tree(KX - kw / 2 + 20 + gb * 32, KZ + kd / 2 - 30 - (gb % 2) * 20, 13 + (gb % 3) * 3, ktop + 26);

  // terraced tower with a roof garden
  [[360, 24], [300, 26], [230, 27]].forEach(function (s, n) {
    var h = s[1] * TH; winB.add(rbox(s[0], h, 260 - n * 40, 12), -330 + n * 30, G + h / 2, -2500, { color: n % 2 ? '#F2E7D6' : '#E6D6C0', box: { w: s[0], h: h, d: 260 - n * 40 } });
  });
  // light-blue glass office block
  winB.add(rbox(384, 640, 288, 10), -900, G + 320, -2600, { color: '#A9D2EA', box: { w: 384, h: 640, d: 288 } });

  // billboard
  bare.add(cylG, -700, G + 180, -3300, { sx: 8, sy: 360, sz: 8, color: '#8C8C88' });
  bare.add(rbox(310, 130, 8, 4), -700, G + 400, -3304, { color: '#9A9A94', ry: 0.3 });
  var board = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), new THREE.MeshBasicMaterial({ map: room.canvasTex(THREE, 400, 160, drawBillboard) }));
  board.position.set(-698, G + 400, -3298); board.rotation.y = 0.3; group.add(board);

  // far construction towers with cranes
  [[-2200, -8000], [600, -8300], [2600, -7800], [-4200, -7600]].forEach(function (c, n) {
    winB.add(rbox(260, 900, 220, 8), c[0], G + 450, c[1], { color: '#D8D2CC', box: { w: 260, h: 900, d: 220 } });
    for (var q = 0; q < 4; q++) bare.add(boxG, c[0] - 110 + q * 73, G + 960, c[1], { sx: 10, sy: 120, sz: 10, color: '#B9B2AE' });
    bare.add(boxG, c[0] + 160, G + 650, c[1], { sx: 18, sy: 1300, sz: 18, color: '#E8B840' });
    bare.add(boxG, c[0] + 160 + (n % 2 ? -140 : 140), G + 1300, c[1], { sx: 520, sy: 14, sz: 14, color: '#E8B840' });
    bare.add(boxG, c[0] + 160 + (n % 2 ? 250 : -250), G + 1300, c[1], { sx: 60, sy: 40, sz: 30, color: '#8E8A86' });
    bare.add(boxG, c[0] + 160, G + 1280, c[1], { sx: 40, sy: 30, sz: 30, color: '#F2F0E6' });
  });

  // metro viaduct on round pillars
  var path = new THREE.CatmullRomCurve3([[3200, -900], [2400, -1200], [1500, -1600], [900, -2200], [400, -3100], [-300, -4300], [-1400, -6200]].map(function (q) { return new THREE.Vector3(q[0], G + 150, q[1]); }));
  bare.add(new THREE.TubeGeometry(path, 120, 26, 8, false), 0, 0, 0, { color: '#EDE6DE', sy: 0.55 });
  for (var qq = 0; qq <= 26; qq++) { var pt = path.getPoint(qq / 26); bare.add(cylG, pt.x, G + 70, pt.z, { sx: 15, sy: 150, sz: 15, color: '#DCD4CC' }); }

  [winB, balB, bare].forEach(function (b) { group.add(b.mesh()); });

  /* instanced trees (scene-lit so they catch the warm rim light) */
  var greens = ['#6FA85A', '#86B865', '#5E9A55', '#9CC56E', '#4F8A52', '#7FB060'].map(lin);
  var treeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: '#FFFFFF' }), trees.length);
  var m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  trees.forEach(function (t, i) {
    var y = t[3] !== undefined ? t[3] : G + t[2] * 0.8;
    m4.compose(v3.set(t[0], y, t[1]), q4, s3.set(t[2], t[2] * 0.85, t[2])); treeMesh.setMatrixAt(i, m4);
    treeMesh.setColorAt(i, greens[i % greens.length]);
  });
  group.add(treeMesh);

  // a few coconut palms
  var palmM = new THREE.MeshLambertMaterial({ color: lin('#5E9A4E') }), trunkM = new THREE.MeshLambertMaterial({ color: lin('#9A7452') });
  [[-760, -1420, 300], [-1180, -1960, 340], [160, -2260, 280], [1500, -2050, 320], [-2000, -2300, 300]].forEach(function (p, n) {
    var palm = new THREE.Group(); palm.position.set(p[0], G, p[1]); group.add(palm);
    for (var s = 0; s < 4; s++) { var seg = new THREE.Mesh(new THREE.CylinderGeometry(5 - s * 0.6, 6 - s * 0.6, p[2] / 4, 8), trunkM); seg.position.set(s * s * 3, p[2] / 8 + s * p[2] / 4, 0); seg.rotation.z = -s * 0.06; palm.add(seg); }
    for (var lf = 0; lf < 7; lf++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), palmM), a = lf / 7 * Math.PI * 2 + n;
      leaf.scale.set(46, 4, 11); leaf.position.set(27 + Math.cos(a) * 34, p[2] - 4, Math.sin(a) * 34); leaf.rotation.set(0, -a, -0.45); palm.add(leaf);
    }
  });

  /* lit windows (golden-hour lights coming on) */
  var lwG = new THREE.PlaneGeometry(26, 20), lw = new THREE.InstancedMesh(lwG, new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }), litWin.length);
  litWin.forEach(function (w, i) {
    q4.setFromAxisAngle(v3.set(0, 1, 0), w[4] ? Math.PI / 2 : 0);
    m4.compose(new THREE.Vector3(w[0], w[1], w[2]), q4, s3.set(1, 1, 1)); lw.setMatrixAt(i, m4); lw.setColorAt(i, lin(w[3]));
  });
  group.add(lw);

  /* streetlights and traffic */
  var dotTex = room.canvasTex(THREE, 64, 64, function (g) { var r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  var lampG = new THREE.BufferGeometry(); lampG.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
  group.add(new THREE.Points(lampG, new THREE.PointsMaterial({ map: dotTex, color: '#FFC46A', size: 5, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  var cars = [], carCols = ['#F4F1EA', '#E8736A', '#5FA8D8', '#3E3A48', '#C9C3BC', '#E8C53A', '#E8C53A', '#7FB060'];
  roads.slice(0, 4).forEach(function (rd, r) {
    for (var c = 0; c < 14; c++) {
      var dir = c % 2 ? 1 : -1, auto = carCols[c % carCols.length] === '#E8C53A';
      cars.push({ z: rd.z + dir * 20, xm: rd.xm, x: (hash(r, c) * 2 - 1) * rd.xm, v: dir * (50 + hash(c, r) * 50), auto: auto, col: lin(carCols[(c + r) % carCols.length]) });
    }
  });
  var carMesh = new THREE.InstancedMesh(rbox(40, 16, 20, 6), new THREE.MeshLambertMaterial({ color: '#FFFFFF' }), cars.length);
  cars.forEach(function (c, i) { carMesh.setColorAt(i, c.col); });
  group.add(carMesh);
  var lightPos = new Float32Array(cars.length * 6), lightCol = new Float32Array(cars.length * 6);
  cars.forEach(function (c, i) { lightCol.set([1, 0.92, 0.7, 1, 0.25, 0.2], i * 6); });
  var carLG = new THREE.BufferGeometry();
  carLG.setAttribute('position', new THREE.BufferAttribute(lightPos, 3)); carLG.setAttribute('color', new THREE.BufferAttribute(lightCol, 3));
  group.add(new THREE.Points(carLG, new THREE.PointsMaterial({ map: dotTex, size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  anim.push(function (t, dt) {
    cars.forEach(function (c, i) {
      c.x += c.v * dt; if (c.x > c.xm) c.x = -c.xm; if (c.x < -c.xm) c.x = c.xm;
      m4.compose(v3.set(c.x, G + 10, c.z), q4.identity(), s3.set(c.auto ? 0.7 : 1, c.auto ? 1.15 : 1, c.auto ? 0.9 : 1)); carMesh.setMatrixAt(i, m4);
      var f = c.v > 0 ? 1 : -1;
      lightPos.set([c.x + f * 21, G + 9, c.z, c.x - f * 21, G + 9, c.z], i * 6);
    });
    carMesh.instanceMatrix.needsUpdate = true; carLG.attributes.position.needsUpdate = true;
  });

  // the metro gliding along the viaduct
  var train = [], trainM = new THREE.MeshLambertMaterial({ color: lin('#F6F3EE') }), stripeM = new THREE.MeshBasicMaterial({ color: lin('#FFD58A'), toneMapped: false });
  for (var tc = 0; tc < 3; tc++) {
    var car = new THREE.Group(); group.add(car);
    car.add(new THREE.Mesh(rbox(110, 26, 28, 9), trainM));
    var st = new THREE.Mesh(new THREE.BoxGeometry(96, 6, 29), stripeM); st.position.y = 3; car.add(st);
    var base = new THREE.Mesh(new THREE.BoxGeometry(104, 4, 29), new THREE.MeshLambertMaterial({ color: lin('#2E9AA8') })); base.position.y = -9; car.add(base);
    train.push(car);
  }
  var tan = new THREE.Vector3();
  anim.push(function (t) {
    var u0 = (t / 70) % 1;
    train.forEach(function (car, i) {
      var u = u0 - i * 0.022, vis = u > 0.02 && u < 0.97;
      car.visible = vis; if (!vis) return;
      path.getPoint(u, car.position); car.position.y = G + 172; path.getTangent(u, tan);
      car.rotation.y = Math.atan2(-tan.z, tan.x);
    });
  });

  /* hazy hill line on the horizon */
  var hillM = new THREE.MeshBasicMaterial({ color: lin('#C997A2'), fog: false });
  [[-5200, 1200, 260], [-2600, 1500, 330], [300, 1300, 220], [3200, 1700, 360], [6200, 1400, 280], [-8000, 1600, 300]].forEach(function (h) {
    var hm = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hillM);
    hm.scale.set(h[1], h[2], 500); hm.position.set(h[0], G, -8650); group.add(hm);
  });

  /* Animal Crossing cumulus: clustered lobes, flat bottoms, lit orange-gold toward the low sun, lilac in shade */
  var C_LIT = lin('#FFB45E'), C_RIM = lin('#FFE6B0'), C_SHADE = lin('#C59BC0'), C_MID = lin('#F2A6A8');
  // a cumulus from a seed: a random count of lobes scattered along a random length, some bunched into a tall tower, some a long flat bank,
  // each lobe its own size and height, so no two clouds share a shape
  function cumulus(seed, R) {
    var lobes = [], n = 6 + Math.floor(hash(seed, 1) * 9), len = R * (1.4 + hash(seed, 2) * 2.4), tall = hash(seed, 3);
    for (var i = 0; i < n; i++) {
      var f = hash(seed, i + 3) - 0.5, edge = 1 - Math.abs(f) * 1.7, r = R * (0.55 + hash(seed, i + 9) * 0.45) * (0.6 + Math.max(0, edge) * 0.6);
      lobes.push([f * len, R * (0.1 + hash(seed, i + 15) * 0.35) + Math.max(0, edge) * tall * R * 0.6, (hash(seed, i + 21) - 0.5) * R * 0.8, r]);
    }
    var tops = Math.floor(hash(seed, 4) * 4 * tall);
    for (var j = 0; j < tops; j++) lobes.push([(hash(seed, j + 30) - 0.5) * len * 0.5, R * (0.6 + tall * 0.7 + hash(seed, j + 40) * 0.4), 0, R * (0.4 + hash(seed, j + 50) * 0.3)]);
    var p = [], c = [], sg = new THREE.SphereGeometry(1, 18, 12).toNonIndexed(), P = sg.attributes.position;
    lobes.forEach(function (l) {
      for (var i = 0; i < P.count; i++) {
        var nx = P.getX(i), ny = P.getY(i), nz = P.getZ(i), x = l[0] + nx * l[3], y = l[1] + ny * l[3], z = l[2] + nz * l[3] * 0.8;
        if (y < 0) y *= 0.12;
        p.push(x, y, z);
        c.push(nx, ny, nz);
      }
    });
    return { p: p, n: c };
  }
  var clouds = [];
  function addCloud(x, y, z, R, seed, speed) {
    var cl = cumulus(seed, R), cols = [], L = new THREE.Vector3();
    for (var i = 0; i < cl.p.length; i += 3) {
      L.set(SUN[0] - (x + cl.p[i]), SUN[1] - (y + cl.p[i + 1]), SUN[2] - (z + cl.p[i + 2])).normalize();
      var nx = cl.n[i], ny = cl.n[i + 1], nz = cl.n[i + 2], ndl = nx * L.x + ny * L.y + nz * L.z;
      var lit = Math.min(1, Math.max(0, (ndl + 0.25) / 0.8)), rim = Math.pow(1 - Math.abs(nz), 2.5);
      var under = Math.max(0, -ny) * 0.6;
      var k = Math.min(1, lit + under);
      var r = C_SHADE.r * (1 - k) + (C_MID.r * (1 - lit) + C_LIT.r * lit) * k, g = C_SHADE.g * (1 - k) + (C_MID.g * (1 - lit) + C_LIT.g * lit) * k, b = C_SHADE.b * (1 - k) + (C_MID.b * (1 - lit) + C_LIT.b * lit) * k;
      cols.push(r + C_RIM.r * rim * k * 0.6, g + C_RIM.g * rim * k * 0.6, b + C_RIM.b * rim * k * 0.6);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cl.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
    m.position.set(x, y, z); group.add(m); clouds.push({ m: m, v: speed, x0: x });
  }
  // scattered at random over three depths, each its own size, speed and shape (no rows)
  [[10, -8200, 150, 260, 600, 1300, 28], [7, -7200, 220, 420, 1200, 2300, 45], [5, -6400, 280, 480, 2100, 3100, 65]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) {
      var sd = li * 50 + k + 1;
      addCloud(-8000 + hash(sd, 60) * 16000, L[4] + hash(sd, 61) * (L[5] - L[4]), L[1] + (hash(sd, 62) - 0.5) * 600, L[2] + hash(sd, 63) * (L[3] - L[2]), sd, L[6] * (0.7 + hash(sd, 64) * 0.6));
    }
  });
  // thin glowing streaks low near the horizon
  var wispM = new THREE.MeshBasicMaterial({ color: lin('#FFC29A'), transparent: true, opacity: 0.6, fog: false, depthWrite: false, toneMapped: false });
  [[-3000, 520, 1800], [1800, 600, 2400], [-600, 760, 1400], [4200, 450, 1600], [400, 380, 2600]].forEach(function (w) {
    var wm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8), wispM); wm.scale.set(w[2], 16, 60); wm.position.set(w[0], w[1], -8450); group.add(wm);
  });
  // the clouds drift right with the breeze, the nearer layers faster (wrapping round)
  anim.push(function (t) {
    clouds.forEach(function (c) { var x = c.x0 + t * c.v; c.m.position.x = ((x + 9000) % 18000 + 18000) % 18000 - 9000; });
  });

  /* birds drifting across */
  var birdM = new THREE.MeshBasicMaterial({ color: lin('#5E4868'), fog: false }), birds = [];
  for (var bi = 0; bi < 7; bi++) {
    var bird = new THREE.Group(), wg = new THREE.BoxGeometry(22, 2.2, 5);
    var wl = new THREE.Mesh(wg, birdM), wr = new THREE.Mesh(wg, birdM);
    wl.position.x = -10; wr.position.x = 10; bird.add(wl); bird.add(wr);
    bird.position.set(-2400 + (bi % 4) * 90 + hash(bi, 1) * 200, 1050 + hash(bi, 2) * 260 + (bi % 3) * 40, -3600 - hash(bi, 3) * 400);
    group.add(bird); birds.push({ g: bird, l: wl, r: wr, x0: bird.position.x, ph: bi * 1.3 });
  }
  anim.push(function (t) {
    birds.forEach(function (b) {
      var x = b.x0 + t * 160; b.g.position.x = ((x + 3200) % 6400 + 6400) % 6400 - 3200;   // across the window in ~20 s, then round again
      var a = Math.sin(t * 7 + b.ph) * 0.5; b.g.position.y += Math.sin(t * 1.3 + b.ph) * 0.6;   // flapping, bobbing a little
      b.l.rotation.z = a; b.r.rotation.z = -a;
    });
  });

  var last = 0;
  return {
    group: group,
    update: function (t) { var dt = Math.min(0.1, Math.max(0, t - last)); last = t; anim.forEach(function (fn) { fn(t, dt); }); }
  };
}

root.TokenfallOfficeCity = { build: build };
})(typeof window !== 'undefined' ? window : this);
