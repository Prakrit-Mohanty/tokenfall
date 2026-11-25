// TokenFall launcher: the ABZ office window workstation (15th floor, Baner) in soft rounded Three.js. A tall window bay
// with charcoal mullions, a half-drawn backlit roller blind and a granite sill; a narrow oak standing desk and a bar stool;
// and the golden-hour city below (office-city.js). build(THREE) returns { group, fog, sky, update(t, now), redraw() }; the room owns its
// lights. roundedBox / mat / canvasTex / rr are shared with the launcher's PC.
(function (root) {
'use strict';
var FONT_UI = '"Fredoka", "Nunito", system-ui, sans-serif';
var PAL = {
  oak: '#E9CFA6', oakEdge: '#D9B988', steel: '#4A4D55', charcoal: '#3A3D44', granite: '#26272C',
  plaster: '#F0DCC2', blind: '#E9D6B2', floor: '#C9BBA8', haze: '#EDB09A', sky: '#F2A07A',
  ink: '#6B5B45', paper: '#FFF8EA'
};

function mat(THREE, col, o) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.72, metalness: 0 }, o || {}));
}
// rounded, bevelled box centred on the origin
var boxCache = {};
function roundedBox(THREE, w, h, d, r) {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  var key = [w, h, d, r].join(',');
  if (boxCache[key]) return boxCache[key];
  var sw = w - 2 * r, sh = h - 2 * r, cr = Math.min(r, sw / 2, sh / 2) * 0.9, s = new THREE.Shape();
  var x0 = -sw / 2, y0 = -sh / 2;
  s.moveTo(x0 + cr, y0); s.lineTo(x0 + sw - cr, y0); s.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + cr);
  s.lineTo(x0 + sw, y0 + sh - cr); s.quadraticCurveTo(x0 + sw, y0 + sh, x0 + sw - cr, y0 + sh);
  s.lineTo(x0 + cr, y0 + sh); s.quadraticCurveTo(x0, y0 + sh, x0, y0 + sh - cr);
  s.lineTo(x0, y0 + cr); s.quadraticCurveTo(x0, y0, x0 + cr, y0);
  var g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 6, curveSegments: 8 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  return (boxCache[key] = g);
}
function canvasTex(THREE, w, h, draw) {
  var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  var tx = new THREE.CanvasTexture(cv);
  tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
  tx.redraw = function () { var g = cv.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h); tx.needsUpdate = true; };
  tx.redraw();
  return tx;
}
function rr(g, x, y, w, h, r, fill) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
}
function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

/* ---------- painted textures ---------- */
function drawSky(g, w, h) {
  var sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7E86C2'); sky.addColorStop(0.3, '#B996C4'); sky.addColorStop(0.5, '#F2A3A6'); sky.addColorStop(0.68, '#FFAA70'); sky.addColorStop(0.85, '#FF8F3C'); sky.addColorStop(1, '#FFB45E');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  var sun = g.createRadialGradient(w * 0.6, h * 0.72, 0, w * 0.6, h * 0.72, w * 0.45);
  sun.addColorStop(0, 'rgba(255,240,190,1)'); sun.addColorStop(0.05, 'rgba(255,214,120,.95)'); sun.addColorStop(0.25, 'rgba(255,150,70,.45)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
}
function drawFloor(g, w, h) {
  // warm honey oak planks: each plank its own tone, soft grain, staggered joints
  var rows = 8, ph = h / rows;
  for (var r = 0; r < rows; r++) {
    var y = r * ph, off = hash(r, 3) * w;
    for (var k = -1; k < 3; k++) {
      var x0 = off + k * w / 2, t = hash(r, k + 5);
      g.fillStyle = 'hsl(' + (30 + t * 6) + ',' + (52 + t * 12) + '%,' + (60 + t * 9) + '%)';
      g.fillRect(((x0 % w) + w) % w - (k === -1 ? w : 0), y, w / 2, ph);
      g.fillRect(((x0 % w) + w) % w - w, y, w / 2, ph);
    }
    for (var i = 0; i < 9; i++) {
      g.strokeStyle = i % 2 ? 'rgba(150,90,40,.18)' : 'rgba(255,230,190,.22)'; g.lineWidth = 1.5 + hash(r, i) * 2; g.beginPath();
      var gy = y + 6 + hash(r, i + 20) * (ph - 12), gx = hash(i, r) * w;
      g.moveTo(gx, gy); g.bezierCurveTo(gx + 60, gy + 3, gx + 120, gy - 3, gx + 200, gy); g.stroke();
    }
    g.fillStyle = 'rgba(110,64,30,.35)'; g.fillRect(0, y, w, 2);
    [0, 1].forEach(function (k) { g.fillRect(((off + k * w / 2) % w + w) % w, y, 2, ph); });
  }
}
function drawRug(g, w, h) {
  var cx = w / 2, cy = h / 2;
  [['#D98C6A', 1], ['#F6DDB8', 0.86], ['#E9B48A', 0.74], ['#FFF1DC', 0.62], ['#F2C6A0', 0.38], ['#FFF1DC', 0.22]].forEach(function (c) {
    g.fillStyle = c[0]; g.beginPath(); g.arc(cx, cy, w / 2 * c[1], 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = 'rgba(255,255,255,.5)';
  for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * w * 0.4, 5, 0, Math.PI * 2); g.fill(); }
}
function drawOak(g, w, h) {
  g.fillStyle = PAL.oak; g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  for (var i = 0; i < 36; i++) {
    var y = hash(i, 7) * h, x = hash(i, 8) * w - 60, len = 160 + hash(i, 9) * 300;
    g.strokeStyle = i % 2 ? 'rgba(196,150,96,.28)' : 'rgba(255,240,214,.45)'; g.lineWidth = 2 + hash(i, 5) * 3;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len / 3, y + 4, x + len * 2 / 3, y - 4, x + len, y); g.stroke();
  }
}
function drawWifi(g, w, h) {
  rr(g, 0, 0, w, h, 10, '#FFFFFF');
  g.strokeStyle = '#3A3D44'; g.lineWidth = 6; g.lineCap = 'round';
  [16, 28, 40].forEach(function (r) { g.beginPath(); g.arc(w / 2, h * 0.5, r, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); });
  g.fillStyle = '#3A3D44'; g.beginPath(); g.arc(w / 2, h * 0.5, 5, 0, Math.PI * 2); g.fill();
  g.font = '600 18px ' + FONT_UI; g.textAlign = 'center'; g.fillText('ABZ-GUEST', w / 2, h * 0.8);
}
function softDot(THREE) {
  return canvasTex(THREE, 128, 128, function (g) {
    var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

/* ---------- scene ---------- */
// units are cm; the desk top is y=0, the floor y=-105, the window wall z=-60
function build(THREE) {
  var group = new THREE.Group(), textures = [];
  var M = function (col, o) { return mat(THREE, col, o); };
  var add = function (parent, geo, material, x, y, z) { var m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  var box = function (parent, material, w, h, d, r, x, y, z) { return add(parent, roundedBox(THREE, w, h, d, r), material, x, y, z); };
  var tex = function (w, h, draw) { var t = canvasTex(THREE, w, h, draw); textures.push(t); return t; };
  var plane = function (parent, w, h, material, x, y, z) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m; };
  var FY = -105, WZ = -60, CEIL = 250, WX0 = -246, WX1 = 246, SILL = FY + 20;
  var plaster = M(PAL.plaster, { roughness: 0.95 }), charcoal = M(PAL.charcoal, { roughness: 0.45, metalness: 0.3 });

  /* the room */
  var floorTex = tex(512, 512, drawFloor); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(5, 5);
  floorTex.repeat.set(4, 6);
  plane(group, 1400, 1100, M('#FFFFFF', { map: floorTex, roughness: 0.38, metalness: 0.05 }), 0, FY, WZ + 550).rotation.x = -Math.PI / 2;
  var rug = new THREE.Mesh(new THREE.CircleGeometry(70, 48), M('#FFFFFF', { map: tex(256, 256, drawRug), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-62, FY + 0.5, 90); rug.receiveShadow = true; group.add(rug);
  // window wall: a continuous glass façade of three tall bays; only a low plaster upstand under the sill
  var WALLH = CEIL - FY, BAY = (WX1 - WX0) / 3;
  box(group, plaster, 600, WALLH, 20, 2, WX1 + 310, (CEIL + FY) / 2, WZ - 10);
  box(group, plaster, 600, WALLH, 20, 2, WX0 - 310, (CEIL + FY) / 2, WZ - 10);
  // warm walnut slat ceiling across the whole room, slats running front to back, with a glowing linear LED and pendant lamps
  box(group, M('#4A3020', { roughness: 0.9 }), 1500, 10, 900, 2, 0, CEIL + 12, 380).castShadow = false;
  var walnut = M('#9A6440', { roughness: 0.55 }), slatG = roundedBox(THREE, 8, 9, 880, 3);
  for (var b = -52; b <= 52; b++) { var sl = add(group, slatG, b % 3 ? walnut : M('#8A5636', { roughness: 0.55 }), b * 13, CEIL + 2, 380); sl.castShadow = false; }
  var led = new THREE.Mesh(roundedBox(THREE, 1300, 3, 5, 1.4), new THREE.MeshBasicMaterial({ color: '#FFE2A8', toneMapped: false })); led.position.set(0, CEIL - 3, 70); group.add(led);
  box(group, M('#2E2A28'), 1310, 4, 12, 1.5, 0, CEIL - 1, 70).castShadow = false;
  // left: frosted pale-green glass partition in a black frame, an office desk glimpsed through it
  var PX = WX0 - 30; // the meeting-room partitions sit at ±PX
  var frost = new THREE.MeshStandardMaterial({ color: '#D5E6D6', transparent: true, opacity: 0.84, roughness: 1, depthWrite: false });
  var part = plane(group, 240, WALLH, frost, PX, (CEIL + FY) / 2, WZ + 120); part.rotation.y = Math.PI / 2; part.renderOrder = 2; part.receiveShadow = false;
  box(group, charcoal, 5, WALLH, 5, 1.5, PX, (CEIL + FY) / 2, WZ + 240);
  box(group, charcoal, 5, 5, 240, 1.5, PX, FY + 3, WZ + 120);
  box(group, charcoal, 5, 4, 240, 1.5, PX, 40, WZ + 120);
  var part2 = plane(group, 240, WALLH, frost, -PX, (CEIL + FY) / 2, WZ + 120); part2.rotation.y = -Math.PI / 2; part2.renderOrder = 2; part2.receiveShadow = false;
  box(group, charcoal, 5, WALLH, 5, 1.5, -PX, (CEIL + FY) / 2, WZ + 240);
  box(group, charcoal, 5, 5, 240, 1.5, -PX, FY + 3, WZ + 120);
  box(group, charcoal, 5, 4, 240, 1.5, -PX, 40, WZ + 120);

  /* the glazing: white columns between bays, slim charcoal frames and a transom about desk height, granite sill */
  var WH = CEIL - 6 - SILL;
  for (var c = 0; c <= 3; c++) box(group, M('#F6F3EE', { roughness: 0.6 }), 9, WH + 6, 14, 3, WX0 + c * BAY, SILL + WH / 2, WZ);
  for (var n = 0; n < 3; n++) {
    var bx = WX0 + BAY * (n + 0.5);
    box(group, charcoal, BAY - 8, 4, 7, 1.5, bx, -14, WZ);
    box(group, charcoal, 3.5, WH, 6, 1.2, bx - BAY / 2 + 6, SILL + WH / 2, WZ - 1);
    box(group, charcoal, 3.5, WH, 6, 1.2, bx + BAY / 2 - 6, SILL + WH / 2, WZ - 1);
    // blinds rolled right up into their slim cassettes
    box(group, M('#FFFFFF'), BAY - 10, 8, 10, 3.5, bx, CEIL - 10, WZ + 7);
    if (n === 0) {
      var beadG = new THREE.SphereGeometry(0.55, 6, 4), beadM = M('#E8E3DA');
      for (var k = 0; k < 40; k++) { var bd = add(group, beadG, beadM, bx - BAY / 2 + 12 + Math.sin(k * 0.08) * 0.6, CEIL - 14 - k * 1.6, WZ + 9); bd.castShadow = false; }
    }
  }
  box(group, charcoal, WX1 - WX0, 5, 9, 2, 0, CEIL - 3, WZ);
  box(group, M(PAL.granite, { roughness: 0.18, metalness: 0.1 }), 1300, SILL - FY, 30, 3, 0, (SILL + FY) / 2, WZ + 4);
  var glass = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, WH), new THREE.MeshStandardMaterial({ color: '#DDEBF2', transparent: true, opacity: 0.05, roughness: 0.05, depthWrite: false }));
  glass.position.set(0, SILL + WH / 2, WZ - 2); group.add(glass);
  // a little potted plant on the counter
  var pot = new THREE.Group(); pot.position.set(-150, 0, -6); group.add(pot);
  add(pot, new THREE.CylinderGeometry(7, 5.5, 11, 24), M('#F1EDE4', { roughness: 0.5 }), 0, 5.5, 0);
  add(pot, new THREE.CylinderGeometry(6.4, 6.4, 1, 20), M('#6B4A32'), 0, 10.6, 0);
  var leafG = new THREE.SphereGeometry(1, 16, 10);
  [[0, 17, 0, 6, '#7DBF68'], [-5, 14, 2, 5, '#6FAE5C'], [5, 15, -1, 5, '#8FCB74'], [-2, 21, -2, 4.5, '#9AD27E'], [3, 20, 3, 4, '#6FAE5C']].forEach(function (l) {
    var m = add(pot, leafG, M(l[4], { roughness: 0.6 }), l[0], l[1], l[2]); m.scale.set(l[3] * 1.1, l[3] * 0.8, l[3]);
  });
  // clear acrylic Wi-Fi card on the sill
  var acr = new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.3, roughness: 0.05 });
  var stand = new THREE.Group(); stand.position.set(-60, SILL + 0.5, WZ + 12); stand.rotation.y = 0.25; group.add(stand);
  box(stand, acr, 14, 1.6, 6, 0.6, 0, 0.8, 0);
  box(stand, acr, 12, 16, 0.8, 0.3, 0, 9, -1).rotation.x = -0.15;
  plane(stand, 10, 13, M('#FFFFFF', { map: tex(160, 208, drawWifi) }), 0, 9, -0.4).rotation.x = -0.15;

  /* narrow standing desk: thin pale oak top, gunmetal square legs + cross bar, black cable box */
  // through the frosted glass: a neighbouring desk, white chair and monitor
  var beyond = new THREE.Group(); beyond.position.set(-380, FY, WZ + 110); group.add(beyond);
  box(beyond, M('#EFE7DA'), 140, 4, 70, 2, 0, 74, 0);
  box(beyond, M('#2E3036'), 60, 38, 4, 2, 0, 104, -20);
  box(beyond, M('#FAF7F0'), 50, 8, 48, 4, 20, 46, 50);
  box(beyond, M('#F3E6CF'), 46, 50, 8, 4, 20, 76, 72);
  add(beyond, new THREE.CylinderGeometry(3, 3, 40, 10), M('#D8D8D8', { metalness: 0.5, roughness: 0.4 }), 20, 22, 50);
  var beyond2 = new THREE.Group(); beyond2.position.set(380, FY, WZ + 110); group.add(beyond2);
  box(beyond2, M('#EFE7DA'), 160, 4, 90, 2, 0, 74, 0);
  box(beyond2, M('#FAF7F0'), 46, 8, 46, 4, -30, 46, 60); box(beyond2, M('#F3E6CF'), 44, 46, 8, 4, -30, 74, 82);
  box(beyond2, M('#FAF7F0'), 46, 8, 46, 4, 30, 46, 60); box(beyond2, M('#F3E6CF'), 44, 46, 8, 4, 30, 74, 82);
  // a coffee mug on the desk, steam rising
  var mug = new THREE.Group(); mug.position.set(44, 0, 8); group.add(mug);
  add(mug, new THREE.CylinderGeometry(4, 3.7, 9, 24), M('#F5EFE4', { roughness: 0.35 }), 0, 4.5, 0);
  add(mug, new THREE.CylinderGeometry(3.5, 3.5, 0.4, 20), M('#6B4026', { roughness: 0.2 }), 0, 8.4, 0);
  add(mug, new THREE.TorusGeometry(2.4, 0.8, 8, 16), M('#F5EFE4', { roughness: 0.35 }), 4.2, 4.6, 0);
  var steam = [];
  var oakTex = tex(512, 256, drawOak);
  oakTex.wrapS = THREE.RepeatWrapping; oakTex.repeat.set(4, 1);
  var DW = (WX1 + 30) - PX - 6;
  box(group, M('#FFFFFF', { map: oakTex, roughness: 0.5 }), DW, 3.2, 58, 1.4, 0, -1.6, 2);
  var gun = M(PAL.steel, { roughness: 0.35, metalness: 0.55 });
  var oakM = M('#FFFFFF', { map: oakTex, roughness: 0.5 });
  [-1, 1].forEach(function (f) { box(group, oakM, 4, -FY - 3.2, 54, 1.6, f * (DW / 2 - 4), (FY - 3.2) / 2, 2); });
  box(group, gun, 6, -FY - 3.2, 6, 1.5, 0, (FY - 3.2) / 2, -16);
  box(group, gun, 36, 2.4, 24, 1, 0, FY + 1.2, -16);
  box(group, gun, DW - 12, 5, 2, 0.8, 0, -8, -22);
  box(group, M('#1E1F23', { roughness: 0.5 }), 38, 9, 16, 2.5, 18, -9, -12);

  /* cosy touches: pendant lamps over the counter, a hanging plant, a big floor plant and a backpack */
  var lampDot = softDot(THREE); textures.push(lampDot);
  var shadeM = M('#FFF1DC', { roughness: 0.5, emissive: '#FFB866', emissiveIntensity: 0.35, side: THREE.DoubleSide });
  var lamps = [];
  [-200, 0, 200].forEach(function (x, i) {
    var lp = new THREE.Group(); lp.position.set(x, 0, 6); group.add(lp);
    var drop = 132 + (i % 2) * 10;
    add(lp, new THREE.CylinderGeometry(6, 6, 2, 20), M('#2E2A28'), 0, CEIL - 1, 0);
    add(lp, new THREE.CylinderGeometry(0.35, 0.35, CEIL - drop, 6), M('#2E2A28'), 0, (CEIL + drop) / 2, 0).castShadow = false;
    var shade = add(lp, new THREE.SphereGeometry(16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shadeM, 0, drop - 12, 0); shade.scale.y = 0.85; shade.castShadow = false;
    add(lp, new THREE.TorusGeometry(16, 1, 8, 32), M('#E8A85C', { roughness: 0.4 }), 0, drop - 12, 0).rotation.x = Math.PI / 2;
    add(lp, new THREE.SphereGeometry(5, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFE7B0', toneMapped: false }), 0, drop - 13, 0).castShadow = false;
    var g = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampDot, color: '#FFC27A', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.scale.set(90, 90, 1); g.position.set(0, drop - 14, 0); lp.add(g);
    var pl = new THREE.PointLight('#FFB868', 0.55, 320, 2); pl.position.set(0, drop - 16, 0); lp.add(pl);
    lamps.push(g);
  });
  var hang = new THREE.Group(); hang.position.set(-238, 0, 40); group.add(hang);
  add(hang, new THREE.CylinderGeometry(0.3, 0.3, 50, 4), M('#C8B29A'), 0, CEIL - 25, 0).castShadow = false;
  var hpot = add(hang, new THREE.SphereGeometry(13, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#F1E2CC', { roughness: 0.6 }), 0, CEIL - 50, 0);
  add(hang, new THREE.CylinderGeometry(12.6, 12.6, 1, 20), M('#6B4A32'), 0, CEIL - 50, 0);
  var vineM = [M('#6FAE5C'), M('#8FCB74'), M('#5E9A4E')], vg = new THREE.SphereGeometry(1, 10, 8);
  for (var v = 0; v < 9; v++) {
    var va = v / 9 * Math.PI * 2, len = 5 + (v % 4) * 3;
    for (var k = 0; k < len; k++) {
      var leaf = add(hang, vg, vineM[(v + k) % 3], Math.cos(va) * (11 + k * 0.5) + Math.sin(k * 0.9 + v) * 1.5, CEIL - 50 - k * 5, Math.sin(va) * (11 + k * 0.5));
      leaf.scale.set(3.4, 2, 2.6); leaf.rotation.y = va + k; leaf.castShadow = false;
    }
  }
  // monstera in a big pot, front right
  var mon = new THREE.Group(); mon.position.set(205, FY, 70); group.add(mon);
  add(mon, new THREE.CylinderGeometry(22, 17, 40, 32), M('#E8D2B4', { roughness: 0.6 }), 0, 20, 0);
  add(mon, new THREE.TorusGeometry(21.5, 2.6, 10, 32), M('#F2E2CA'), 0, 40, 0).rotation.x = Math.PI / 2;
  add(mon, new THREE.CylinderGeometry(20, 20, 1, 24), M('#6B4A32'), 0, 39, 0);
  var stemM = M('#5E9A4E'), monLeaf = [M('#4F9A4A', { roughness: 0.5 }), M('#63AE55', { roughness: 0.5 }), M('#3F8740', { roughness: 0.5 })];
  for (var ml = 0; ml < 11; ml++) {
    var ma = ml * 2.4, mh = 70 + (ml % 4) * 18, mr = 16 + (ml % 3) * 9;
    var st = add(mon, new THREE.CylinderGeometry(0.9, 1.1, mh - 30, 6), stemM, Math.cos(ma) * mr * 0.45, 40 + (mh - 30) / 2, Math.sin(ma) * mr * 0.45);
    st.rotation.z = -Math.cos(ma) * 0.3; st.rotation.x = Math.sin(ma) * 0.3; st.castShadow = false;
    var lf = add(mon, new THREE.SphereGeometry(1, 20, 10), monLeaf[ml % 3], Math.cos(ma) * mr, mh, Math.sin(ma) * mr);
    lf.scale.set(17, 1.6, 12); lf.rotation.set(Math.sin(ma) * 0.5, -ma, -Math.cos(ma) * 0.6);
  }
  // a backpack leaning by the stool
  var bag = new THREE.Group(); bag.position.set(-140, FY, 120); bag.rotation.y = 0.6; group.add(bag);
  box(bag, M('#E8826A', { roughness: 0.8 }), 28, 38, 16, 7, 0, 19, 0);
  box(bag, M('#F2A58A', { roughness: 0.8 }), 20, 16, 6, 4, 0, 12, 9);
  add(bag, new THREE.TorusGeometry(5, 1.2, 8, 16, Math.PI), M('#C9634E'), 0, 38, 0);

  /* black bar stool front-left: round padded seat, hoop back, footrest ring */
  var stool = new THREE.Group(); stool.position.set(-62, FY, 80); stool.rotation.y = 0.5; group.add(stool);
  var blk = M('#232428', { roughness: 0.5, metalness: 0.2 }), pad = M('#2A2B30', { roughness: 0.75 });
  var seat = add(stool, new THREE.CylinderGeometry(19, 18, 7, 40), pad, 0, 74, 0);
  var cush = add(stool, new THREE.SphereGeometry(19, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), pad, 0, 77.5, 0); cush.scale.y = 0.22;
  var hoop = add(stool, new THREE.TorusGeometry(17, 1.6, 10, 40, Math.PI), blk, 0, 92, -4); hoop.rotation.x = -0.25;
  [-1, 1].forEach(function (s) { add(stool, new THREE.CylinderGeometry(1.4, 1.4, 18, 10), blk, s * 17, 83, -6); });
  add(stool, new THREE.TorusGeometry(19, 1.4, 10, 48), blk, 0, 30, 0).rotation.x = Math.PI / 2;
  [0, 1, 2, 3].forEach(function (i) {
    var a = i / 4 * Math.PI * 2 + Math.PI / 4, leg = add(stool, new THREE.CylinderGeometry(1.5, 1.6, 74, 10), blk, Math.cos(a) * 17, 36, Math.sin(a) * 17);
    leg.rotation.z = Math.cos(a) * 0.13; leg.rotation.x = -Math.sin(a) * 0.13;
  });
  seat.castShadow = true;

  /* the golden-hour city below (launcher/office-city.js) */
  var cityApi = root.TokenfallOfficeCity.build(THREE, root.TokenfallOfficeRoom), city = cityApi.group; group.add(city);
  plane(city, 26000, 9000, new THREE.MeshBasicMaterial({ map: tex(1024, 512, drawSky), fog: false }), 0, 1200, -9000).receiveShadow = false;

  /* light: hazy sky fill + warm sun from the upper right, pouring through the window */
  group.add(new THREE.HemisphereLight('#9C8FD6', '#D98A58', 0.42));
  group.add(new THREE.AmbientLight('#FFC9A0', 0.08));
  var sun = new THREE.DirectionalLight('#FF9440', 3.0);
  sun.position.set(520, 170, -700); sun.target.position.set(-60, FY, 160);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5; sun.shadow.radius = 8;
  var sc = sun.shadow.camera; sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520; sc.near = 50; sc.far = 2200;
  group.add(sun); group.add(sun.target);
  var fill = new THREE.DirectionalLight('#FF9A50', 0.5); fill.position.set(700, 160, 200); group.add(fill);
  // soft glow where the sun hits the glass, and a faint shaft of light in the air
  var dot = softDot(THREE); textures.push(dot);
  for (var si = 0; si < 3; si++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, opacity: 0, depthWrite: false })); mug.add(sp); steam.push(sp); }
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#FFB060', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(700, 500, 1); glow.position.set(180, 120, WZ - 6); group.add(glow);
  // a big low sun sitting just left of the terracotta tower
  var disc = canvasTex(THREE, 256, 256, function (g) {
    var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(0.36, 'rgba(255,226,150,1)'); r.addColorStop(0.42, 'rgba(255,190,100,.6)'); r.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  }); textures.push(disc);
  var sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  sunDisc.scale.set(2600, 2600, 1); sunDisc.position.set(1150, 820, -8700); city.add(sunDisc);
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#FF9A48', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(7000, 4200, 1); halo.position.set(1150, 760, -8500); city.add(halo);
  var bloom = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#FFD08A', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bloom.scale.set(2200, 2000, 1); bloom.position.set(1150, 820, -8400); city.add(bloom);
  var shaftM = new THREE.MeshBasicMaterial({ map: dot, color: '#FFA050', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  var shaft = new THREE.Mesh(new THREE.PlaneGeometry(260, 520), shaftM); shaft.position.set(-30, 30, 90); shaft.rotation.set(-0.75, 0.35, 0.6); group.add(shaft);

  return {
    group: group, textures: textures, fog: new THREE.Fog(PAL.haze, 1200, 9000), clear: PAL.sky,
    update: function (t) {
      steam.forEach(function (sp, i) {
        var k = (t * 0.3 + i / steam.length) % 1;
        sp.position.set(Math.sin(k * 6 + i * 2) * 1.2, 11 + k * 16, 0); sp.scale.setScalar(3 + k * 7); sp.material.opacity = Math.sin(k * Math.PI) * 0.4;
      });
      cityApi.update(t);
      glow.material.opacity = 0.2 + Math.sin(t * 0.6) * 0.03;
      lamps.forEach(function (g, i) { g.material.opacity = 0.42 + Math.sin(t * 1.3 + i) * 0.03; });
      shaftM.opacity = 0.28 + Math.sin(t * 0.4 + 1) * 0.05;
    },
    redraw: function () { textures.forEach(function (tx) { tx.redraw(); }); }
  };
}

root.TokenfallOfficeRoom = { build: build, roundedBox: roundedBox, mat: mat, canvasTex: canvasTex, rr: rr, PAL: PAL, FONT_UI: FONT_UI };
})(typeof window !== 'undefined' ? window : this);
