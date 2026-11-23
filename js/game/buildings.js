// TokenFall: buildings: lobby HQ, house, cafe, gates, Calfus (Crescent Bay), the ABZ fin tower, bikes, street lights.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= buildings =================
// box with its own material (and texture scale) per face: [+x, -x, top, bottom, front, back]
function faceBox(w, h, d, mats, x, y, z) {
  const me = new THREE.Mesh(boxGeo(w, h, d, mats.map(m => m.userData.s || 0)), mats);
  me.position.set(x, y + h / 2, z); return add(me);
}
// a flower box: a coral planter with a row of leafy blobs and a few blossoms. Visual only (it sits against a wall, inside the walking pad). parent: a group, for coordinates local to it.
function flowerBox(x, y, z, w, parent) {
  box(w, .22, .24, MAT.pot, x, y, z, { cast: false, p: parent });
  const n = Math.max(2, Math.round(w / .4));
  for (let i = 0; i < n; i++) {
    const bx = x - w / 2 + (i + .5) * w / n, m = add(new THREE.Mesh(jitterSphere(.16 + decorRandom() * .06, 1), decorRandom() < .3 ? MAT.leafLav : MAT.leafA), parent, false); m.position.set(bx, y + .3, z);
    if (decorRandom() < .6) { const b = add(new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), MAT.blossom), parent, false); b.position.set(bx + .06, y + .46, z + .1); }
  }
}
// a cream-framed window with a sill (and a flower box if asked) for facades built from plain boxes; f is which way the facade faces in z (+1 or -1); y is the bottom of the glass
function framedWindow(x, y, z, w, h, mat, f = 1, flowers = false) {
  box(w + .26, h + .26, .05, MAT.trim, x, y - .13, z - f * .02, { cast: false, s: 0 });
  box(w, h, .06, mat, x, y, z + f * .03, { cast: false, s: 0 });
  box(w + .44, .1, .26, MAT.trim, x, y - .2, z + f * .12, { cast: false });
  if (flowers) flowerBox(x, y - .62, z + f * .2, w + .1);
}
function officeBlock(cx, cz, W, D, H, o = {}) {
  const front = cz + D / 2, s = o.side || MAT.concrete;
  box(W + .4, .3, D + .4, MAT.concrete, cx, 0, cz);
  faceBox(W, H, D, [s, s, MAT.roofFlat, s, o.front || MAT.glass, s], cx, .3, cz);
  const floors = o.floors || Math.max(1, Math.round(H / 3));
  for (let i = 1; i < floors; i++) box(W + .12, .24, .32, MAT.concrete, cx, .3 + i * H / floors - .12, front + .06);
  for (const [w, d, x, z] of [[W + .1, .22, cx, front - .05], [W + .1, .22, cx, cz - D / 2 + .05], [.22, D, cx - W / 2 + .05, cz], [.22, D, cx + W / 2 - .05, cz]]) box(w, .5, d, MAT.concrete, x, H + .3, z);
  for (let i = 0; i < (o.units ?? 2); i++) box(rr(1.2, 2.2), rr(.6, 1.1), rr(1, 1.6), MAT.metal, cx + rr(-W / 3, W / 3), H + .3, cz + rr(-D / 4, D / 4));
  if (o.fins) for (let x = cx - W / 2 + 1.5; x < cx + W / 2 - 1; x += o.fins) box(.14, H - .2, .45, MAT.wood, x, .4, front + .2, { cast: false });
  // soft finishing: cream corner pilasters, a trim cap on the parapet, and a row of flower boxes along the foot of the front (between the fins, clear of the door)
  for (const sx of [-1, 1]) box(.5, H, .5, MAT.trim, cx + sx * W / 2, .3, front, { cast: false });
  box(W + .3, .14, .4, MAT.trim, cx, H + .8, front - .05, { cast: false });
  if (o.planters !== false) for (let x = cx - W / 2 + 1.5 + (o.fins ? o.fins / 2 : 0); x < cx + W / 2 - 1; x += o.fins || 2.8) if (Math.abs(x - cx) > (o.door ?? 3.4)) flowerBox(x, .32, front + .3, Math.min(1.6, (o.fins || 2.8) - .8));
  if (o.collide !== false) colBox(cx - W / 2 - .2, cz - D / 2 - .2, cx + W / 2 + .2, front + .2);
  return front;
}
function hq(cx, cz) {
  const W = 17, D = 8, H = 9, front = officeBlock(cx, cz, W, D, H, { floors: 3, units: 3, fins: 3 });
  // entrance: lit glass doors under a concrete canopy
  box(5, .16, 1.5, MAT.concrete, cx, 0, front + .75, { cast: false });   // the door step
  box(3.6, 2.7, .1, MAT.glassLit, cx, .3, front + .08, { cast: false });
  box(7, .24, 2.8, MAT.concrete, cx, 3.05, front + 1.4);
  box(5.6, .05, .3, MAT.warmGlow, cx, 3.0, front + 2.3, { cast: false });
  for (const s of [-1, 1]) { box(.16, 3.05, .16, MAT.metal, cx + s * 3.2, 0, front + 2.6); colCirc(cx + s * 3.2, front + 2.6, .15); }
  ledSign(['HQ Office'], '#8fe3ff', cx, 3.17, front + 2.84, 3.4, .42);
  ledSign(['TOKENFALL'], '#ffe39a', cx, H + 1.3, front + .05, 5.6, 1.1, 0, [256, 56]);
  pointLight('lobby', 0xffd090, 1.2, 7, cx, 2.6, front + 2);
  for (const s of [-1, 1]) { pot(cx + s * 4.4, front + .7, 1.1); pot(cx + s * 5.4, front + .6, .9); }
  return front;
}
// the real Calfus building: a glass-fronted block with white cladding down its side, and a taller grey tower
// with the Calfus logo, a column of windows with little awnings, and vertical louvres on the far edge
function calfusHQ(cx, cz) {
  const panel = (base, joints) => refineTexture(canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, base, .05);
    g.fillStyle = rgb(base, .82); for (const [x, y, w, h] of joints) g.fillRect(x, y, w, h);
  }), 70, 70, (g, W, H) => {
    noiseFill(g, W, H, base, .05, 1, decorRandom);
    const k = W / 32; g.fillStyle = rgb(base, .82);
    for (const [x, y, w, h] of joints) g.fillRect(Math.round(x * k), Math.round(y * k), w > 1 ? Math.round(w * k) : 1, h > 1 ? Math.round(h * k) : 1);
    g.fillStyle = rgb(base, 1.06); for (const [x, y, w, h] of joints) if (w > 1) g.fillRect(0, Math.round(y * k) + 1, W, 1);
  });
  const curtainDraw = (k) => (g, W, H) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = y / H, sheen = ((x + y) % Math.round(23 * k) < 3 * k) ? 26 : 0;
      let c = [150 - t * 22 + sheen, 200 - t * 28 + sheen, 226 - t * 24 + sheen];   // soft sky-blue glass
      if (x % Math.round(16 * k) === 0 || y === 0) c = palRGB(PAL.cream); else if (y >= Math.round(25 * k) && y <= Math.round(26.5 * k)) c = palRGB(PAL.periwinkle);
      P(g, x, y, c);
    }
  };
  const curtain = std(refineTexture(canvasTex(32, 32, curtainDraw(1), { nearest: true }), 70, 70, curtainDraw(70 / 32)), 2.2, { roughness: .4, metalness: 0 });
  const white = std(panel(palRGB(PAL.cream), [[0, 0, 32, 1], [0, 16, 32, 1], [0, 0, 1, 32], [16, 0, 1, 32]]), 2.2);
  const grey = std(panel(palRGB(PAL.lilac, .88), [[0, 0, 32, 1], [0, 16, 32, 1], [0, 0, 1, 32]]), 2.2);
  // squashed in height so the whole front, logo included, fits in the game camera's narrow view
  const F = cz, D = 7, bz = F - D / 2, HM = 4.9, HT = 6.2;
  box(15, .3, D + 1.4, MAT.concrete, cx + .5, 0, bz + .4);
  // glass block on the left, white cladding on its side
  faceBox(8, HM, D, [white, white, MAT.roofFlat, white, curtain, white], cx - 2.5, .3, bz);
  box(8.3, .4, D + .3, MAT.concrete, cx - 2.5, HM + .3, bz);
  for (const [y, z] of [[1.8, bz - 1.2], [3.3, bz + 1.6], [2.5, bz + 2.4]]) box(.06, .9, .7, MAT.charcoal, cx - 6.53, y, z);   // the little angled side windows
  // grey tower on the right, a little proud of the glass
  faceBox(4.6, HT, D + .6, [grey, grey, MAT.roofFlat, grey, grey, grey], cx + 3.8, .3, bz);
  box(2, 1.2, 2.4, grey, cx + 3, HT + .3, bz - 1.4);
  for (let i = 0; i < 2; i++) {
    box(1.3, 1.25, .08, curtain, cx + 4.9, 1.1 + i * 1.95, F + .34, { cast: false });
    const aw = add(new THREE.Mesh(boxGeo(1.5, .08, .45, 0), MAT.metal)); aw.position.set(cx + 4.9, 2.42 + i * 1.95, F + .5); aw.rotation.x = .35;
  }
  const logo = canvasTex(160, 40, (g, W, H) => {
    g.fillStyle = rgb(palRGB(PAL.lilac, .88)); g.fillRect(0, 0, W, H);
    g.font = '700 30px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
    const tw = g.measureText('Calfus').width, x0 = (W - tw) / 2, cw = g.measureText('C').width;
    g.fillStyle = '#ffffff'; g.fillText('Calfus', x0, H / 2 + 2);
    g.fillStyle = '#3fc6b8'; g.beginPath(); g.arc(x0 + cw * .78, H / 2 - 7, 3.6, 0, 6.3); g.fill();
  });
  logo.magFilter = THREE.LinearFilter;
  const logoM = new THREE.MeshStandardMaterial({ map: logo, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: .45, roughness: .6 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, .06), [grey, grey, grey, grey, logoM, grey]); sign.position.set(cx + 3.8, HT - .5, F + .34); add(sign);
  // vertical louvres down the far edge
  box(1.4, HT - 1, D - .4, MAT.charcoal, cx + 6.8, .3, bz - .3);
  for (let x = cx + 6.15; x < cx + 7.5; x += .2) box(.05, HT - 1.2, .3, MAT.metal, x, .4, F - .45);
  // entrance: lit glass doors under a canopy
  box(3.6, .16, 1.2, MAT.concrete, cx - 2.5, 0, F + .6, { cast: false });   // the door step
  for (const dx of [-5.3, .3]) flowerBox(cx + dx, .32, F + .3, 1.5);
  box(2.8, 2.6, .1, MAT.glassLit, cx - 2.5, .3, F + .06, { cast: false });
  box(4.6, .22, 2.2, MAT.concrete, cx - 2.5, 2.95, F + 1.1);
  for (const s of [-1, 1]) { box(.14, 2.95, .14, MAT.metal, cx - 2.5 + s * 2.1, 0, F + 2.05); colCirc(cx - 2.5 + s * 2.1, F + 2.05, .15); }
  ledSign(['Crescent Bay'], '#8ff0e4', cx - 2.5, 3.2, F + 2.22, 2.6, .4, 0, undefined, PLAIN);
  pointLight('pune', 0xffd090, 1.3, 7, cx - 2.5, 2.6, F + 2);
  colBox(cx - 6.8, F - D - .2, cx + 7.7, F + .45);
  return F;
}
// the office tower across the street from Calfus: lit shops on the ground floor, a white band above them,
// then floors of glass behind close-set silver fins that rise past the roof as a crown with blue lights
function finTower(cx, cz) {
  const W = 16, D = 11, H = 7.4, F = cz, bz = F - D / 2, x0 = cx - W / 2;
  box(W + .6, .3, D + .6, MAT.concrete, cx, 0, bz);
  faceBox(W, H, D, [MAT.glass, MAT.glass, MAT.roofFlat, MAT.glass, MAT.glass, MAT.glass], cx, .3, bz);
  // ground floor shops, wrapped round the street corner
  box(W + .08, 1.7, D + .08, MAT.glassLit, cx, .3, bz, { cast: false });
  for (let x = x0; x <= x0 + W + .01; x += 2.66) box(.3, 1.7, .3, MAT.white, x, .3, F + .05);
  for (let z = F; z >= F - D - .01; z -= 2.75) box(.3, 1.7, .3, MAT.white, x0 - .05, .3, z);
  const shop = [0xffd27a, 0x8fe3ff, 0xff9ab8, 0xb6ff9a, 0xffffff];
  for (let i = 0; i < 6; i++) box(1.2, .22, .05, glowStrip(shop[i % shop.length]), x0 + 1.33 + i * 2.66, 1.72, F + .1, { cast: false });
  box(W + .5, .45, D + .5, MAT.white, cx, 2, bz);
  box(W + .3, .12, D + .3, MAT.chrome, cx, 4.7, bz);
  // fins on the street front and the side facing Calfus; every third one runs higher, with a blue light on top
  const led = glowStrip(0x6fd4ff);
  const fin = (x, z, i, side) => {
    const h = H - 2.15 + (i % 3 ? .45 : 1);
    side ? box(.32, h, .06, MAT.chrome, x, 2.45, z) : box(.06, h, .32, MAT.chrome, x, 2.45, z);
    if (i % 3 === 0) box(.1, .22, .1, led, x, 2.45 + h - .22, z, { cast: false });
  };
  let i = 0;
  for (let x = x0 + .2; x < x0 + W; x += .42) fin(x, F + .18, i++, false);
  i = 0;
  for (let z = F - .2; z > F - D; z -= .42) fin(x0 - .18, z, i++, true);
  pointLight('pune', 0xffe0bc, 1.4, 12, cx - 4, 3, F + 2.5);
  pointLight('pune', 0xffd090, 1.1, 8, cx + 3, 1.2, F + 1.5);
  colBox(x0 - .4, F - D - .3, x0 + W + .3, F + .4);
  return F;
}
function palm(x, z, h = 3.4) {
  const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, h, 7), MAT.bark)); t.position.set(x, h / 2, z); t.rotation.z = .05;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283, g = new THREE.Group(); g.position.set(x + .08, h, z); g.rotation.y = a; scene.add(g);
    const f = add(new THREE.Mesh(boxGeo(1.6, .05, .42, 0), MAT.leafA), g); f.position.x = .75; f.rotation.z = -.38;
  }
  colCirc(x, z, .3);
}
// o.collide false for moving traffic (no static colliders); returns the car's group
// a toy car, built into group g (z is forward): a chunky rounded body, a bubble cabin, round wheels with cream hubs, soft round lamps. Shared by the parked cars and the EV bay.
let carMats;   // the car's own glass and tyres (the lobby builds before the office kit's materials exist)
function carBody(g, color) {
  carMats = carMats || { pane: new THREE.MeshStandardMaterial({ color: 0xd2e8ee, transparent: true, opacity: .3, roughness: .2, depthWrite: false }), tyre: new THREE.MeshStandardMaterial({ color: PAL.plum, roughness: .8 }) };
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: 0 });
  box(1.8, .62, 4, paint, 0, .3, 0, { p: g }); box(1.62, .4, 2.0, carMats.pane, 0, .92, -.2, { p: g, cast: false });
  const roof = add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), paint), g); roof.scale.set(.86, .34, 1.12); roof.position.set(0, 1.2, -.2);
  for (const sx of [-.9, .9]) for (const sz of [-1.3, 1.3]) {
    const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .26, 28), carMats.tyre), g); w.rotation.z = Math.PI / 2; w.position.set(sx, .36, sz);
    const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .28, 20), MAT.umbrellaA), g, false); hub.rotation.z = Math.PI / 2; hub.position.set(sx, .36, sz);
  }
  for (const [sx, sz, c] of [[-.55, 2.02, 0xfff0c0], [.55, 2.02, 0xfff0c0], [-.55, -2.02, 0xff9a86], [.55, -2.02, 0xff9a86]]) { const l = add(new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), glowStrip(c)), g, false); l.position.set(sx, .56, sz); }
}
function car(x, z, ry, color, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  carBody(g, color);
  if (o.collide !== false) { colCirc(x - Math.sin(ry), z - Math.cos(ry), 1); colCirc(x + Math.sin(ry), z + Math.cos(ry), 1); }
  return g;
}
// the modelled sports cars (js/models/cars.js, from tools/cars-pack.py): 'bmw' (BMW M3 GTR), 'jesko' (Koenigsegg Jesko), 'creta' (Hyundai Creta), 'm4' (BMW M4 widebody), 'cybertruck' (Tesla Cybertruck), 'scorpio' (Mahindra Scorpio-N), 'eeco' (Maruti Suzuki Eeco) or 'omni' (Maruti Omni), 4.4 m like car(),
// facing +z. Each model is parsed once (GLTFLoader, async) and every copy shares its geometry and materials; the group is returned at once and fills in
const SPORTS = {};
function sportsCar(kind, x, z, ry, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  if (!SPORTS[kind]) SPORTS[kind] = new Promise((done) => {
    const bin = atob(window.CAR_MODELS[kind]), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', (gl) => { gl.scene.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = !m.material.transparent; m.receiveShadow = true;
      // lit like the rest of the game: its textures are plain (linear) colour, not sRGB, and nothing is metal (with no environment map metalness only darkens)
      const mat = m.material; if (mat.map) { mat.map.encoding = THREE.LinearEncoding; mat.map.needsUpdate = true; }
      mat.metalness = 0; mat.roughness = Math.max(mat.roughness, .45); mat.needsUpdate = true;
    }); done(gl.scene); }, (e) => console.warn('car model', kind, e));
  });
  // the collider is the model's own footprint, measured once it has loaded (so a long truck or a wide body is solid right to its edges); o.onSize(len, wide) gets its size
  SPORTS[kind].then((model) => {
    const m = model.clone(true), b = new THREE.Box3().setFromObject(m), len = b.max.z - b.min.z, wide = b.max.x - b.min.x;   // measured in the model's own frame, before it is turned
    g.add(m);
    if (o.onSize) o.onSize(len, wide);
    if (o.collide !== false) { g.updateMatrixWorld(true); const w = new THREE.Box3().setFromObject(m); colBox(w.min.x + .05, w.min.z + .05, w.max.x - .05, w.max.z - .05); }
  });
  return g;
}
// the modelled motorbikes (js/models/bikes.js, tools/bikes-pack.py): 'avenger' (Bajaj Avenger), 'gsxr' (Suzuki GSX-R 750), 'evel' (Evel Knievel on his Triumph),
// front at +z; o.lean tips it onto its side stand. Parsed once each with GLTFLoader, lit like the rest of the game
const BIKE_MODEL = {};
function bikeModel(kind, x, z, ry, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, ry, o.lean || 0); scene.add(g);
  if (!window.BIKE_MODELS || !window.BIKE_MODELS[kind]) return g;
  if (!BIKE_MODEL[kind]) BIKE_MODEL[kind] = new Promise((done) => {
    const bin = atob(window.BIKE_MODELS[kind]), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', (gl) => {
      gl.scene.traverse((m) => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const mt = m.material; if (mt.map) { mt.map.encoding = THREE.LinearEncoding; mt.map.needsUpdate = true; } mt.metalness = 0; mt.roughness = Math.max(mt.roughness, .4); mt.needsUpdate = true; });
      done(gl.scene);
    }, (e) => console.warn('bike model', kind, e));
  });
  BIKE_MODEL[kind].then((m) => g.add(m.clone(true)));
  return g;
}
// parked motorbikes, leaning on their side stands: 'r15' (Yamaha R15M), 'vstrom' (Suzuki V-Strom SX),
// 'avenger' (Bajaj Avenger), 'thruxton' (café racer). Local axes: x across the bike, z forward.
function bike(x, z, ry, kind) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, ry, .12); scene.add(g);
  const paint = (c, m = .45) => new THREE.MeshStandardMaterial({ color: c, roughness: .28, metalness: m });
  const V = (a, b, c) => new THREE.Vector3(a, b, c), UP = V(0, 1, 0);
  const part = (w, h, d, m, px, py, pz, rx = 0) => { const me = add(new THREE.Mesh(boxGeo(w, h, d, 0), m), g); me.position.set(px, py, pz); me.rotation.x = rx; return me; };
  const tube = (a, b, r, m) => {
    const d = b.clone().sub(a), me = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m), g);
    me.position.copy(a).add(b).multiplyScalar(.5); me.quaternion.setFromUnitVectors(UP, d.normalize()); return me;
  };
  const blob = (r, m, px, py, pz, sx, sy, sz) => { const me = add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m), g); me.position.set(px, py, pz); me.scale.set(sx, sy, sz); return me; };
  // wheel: tyre, rim, hub, and either wire spokes or a few cast spokes; a brake disc up front
  const wheel = (wz, r, rim, spoked, disc) => {
    const tyre = add(new THREE.Mesh(new THREE.TorusGeometry(r - .055, .06, 8, 24), MAT.charcoal), g); tyre.rotation.y = Math.PI / 2; tyre.position.set(0, r, wz);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(r - .11, .018, 6, 24), rim), g); ring.rotation.y = Math.PI / 2; ring.position.set(0, r, wz);
    const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .14, 10), MAT.chrome), g); hub.rotation.z = Math.PI / 2; hub.position.set(0, r, wz);
    const n = spoked ? 12 : 5;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, k = r - .12; tube(V(0, r, wz), V(0, r + Math.sin(a) * k, wz + Math.cos(a) * k), spoked ? .006 : .02, spoked ? MAT.chrome : rim); }
    if (disc) { const dsk = add(new THREE.Mesh(new THREE.CylinderGeometry(r * .5, r * .5, .01, 18), MAT.steel), g); dsk.rotation.z = Math.PI / 2; dsk.position.set(-.08, r, wz); }
  };
  const fork = (top, axle, m) => { for (const s2 of [-1, 1]) tube(V(s2 * .09, top[0], top[1]), V(s2 * .09, axle[0], axle[1]), .03, m); };
  const bars = (y, z2, w, m, rise = 0) => { tube(V(-w / 2, y + rise, z2 - .06), V(w / 2, y + rise, z2 - .06), .016, m); for (const s2 of [-1, 1]) part(.04, .04, .1, MAT.charcoal, s2 * (w / 2 - .02), y + rise, z2 - .06); };
  const mirrors = (y, z2, w) => { for (const s2 of [-1, 1]) { tube(V(s2 * w / 2, y, z2), V(s2 * (w / 2 + .05), y + .18, z2 - .02), .008, MAT.charcoal); part(.1, .06, .02, MAT.charcoal, s2 * (w / 2 + .06), y + .2, z2 - .02); } };
  const swing = (pz, ax, ay, m) => { for (const s2 of [-1, 1]) tube(V(s2 * .1, .42, pz), V(s2 * .1, ay, ax), .022, m); };
  const lamp = (px, py, pz, r, m) => { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * .85, .12, 14), m), g); l.rotation.x = Math.PI / 2; l.position.set(px, py, pz); part(r * 1.5, r * 1.5, .01, glowStrip(0xfff2d0), px, py, pz + .065); };
  const tail = (py, pz) => part(.12, .04, .03, glowStrip(0xff2a1a), 0, py, pz);
  tube(V(-.1, .36, -.05), V(-.3, .02, .05), .012, MAT.charcoal);   // side stand
  if (kind === 'r15') {
    const grey = paint(0x8a9098, .6), blue = paint(0x1f4fd8), gold = paint(0xd4a017, .7);
    const W = .66, R = .3;
    wheel(W, R, blue, false, true); wheel(-W, R, blue, false, false);
    fork([.96, .4], [R, W], gold); swing(-.05, -W, R, grey);
    part(.42, .3, .5, grey, 0, .66, .38, -.3); part(.36, .26, .36, grey, 0, .86, .52, -.45);
    for (const s2 of [-1, 1]) part(.08, .04, .03, glowStrip(0xd8f0ff), s2 * .08, .8, .73);
    part(.26, .16, .02, MAT.pane, 0, 1.02, .6, -.9);
    part(.42, .22, .46, grey, 0, .9, .08, .12); part(.1, .23, .46, paint(0x16181c), 0, .91, .08, .12);
    part(.34, .12, .3, blue, 0, .7, .1);
    part(.3, .3, .4, MAT.charcoal, 0, .45, .02);
    part(.28, .06, .34, MAT.charcoal, 0, .9, -.28); part(.2, .07, .22, grey, 0, .98, -.52, .2);
    part(.18, .1, .36, grey, 0, 1.0, -.72, .35); tail(1.02, -.9);
    tube(V(.12, .32, -.05), V(.16, .5, -.48), .055, MAT.charcoal); tube(V(.16, .5, -.48), V(.17, .53, -.52), .045, MAT.chrome);
    bars(.92, .42, .6, MAT.charcoal); mirrors(.98, .5, .46);
  } else if (kind === 'vstrom') {
    const yellow = paint(0xf2b705), black = paint(0x17181b, .2);
    const Wf = .74, Wr = -.7, Rf = .36, Rr = .33;
    wheel(Wf, Rf, MAT.charcoal, false, true); wheel(Wr, Rr, MAT.charcoal, false, false);
    fork([1.1, .46], [Rf, Wf], MAT.chrome); swing(-.05, Wr, Rr, black);
    part(.26, .05, .34, yellow, 0, .8, .86, .35); part(.2, .04, .34, black, 0, .7, .8, .2);
    part(.4, .32, .32, yellow, 0, 1.05, .58, -.25); lamp(0, 1.03, .74, .07, black);
    part(.3, .38, .02, MAT.pane, 0, 1.34, .52, -.4);
    part(.46, .28, .5, yellow, 0, 1.06, .14, .05); part(.5, .2, .34, black, 0, .86, .24);
    part(.32, .34, .42, MAT.charcoal, 0, .56, 0); part(.3, .05, .36, MAT.steel, 0, .32, .06);
    part(.3, .07, .6, black, 0, 1.06, -.36); part(.34, .04, .36, black, 0, 1.13, -.8);
    for (const s2 of [-1, 1]) tube(V(s2 * .17, 1.1, -.6), V(s2 * .17, 1.12, -.96), .015, black);
    tube(V(.14, .42, -.1), V(.2, .74, -.64), .07, MAT.steel); tail(1.08, -.98);
    bars(1.18, .42, .74, MAT.charcoal, .04); for (const s2 of [-1, 1]) part(.08, .08, .12, black, s2 * .36, 1.22, .36);
    mirrors(1.22, .4, .6);
  } else if (kind === 'avenger') {
    const black = paint(0x101114, .5);
    const Wf = .82, Wr = -.72, Rf = .31, Rr = .33;
    wheel(Wf, Rf, MAT.charcoal, false, true); wheel(Wr, Rr, MAT.charcoal, false, false);
    const ft = add(new THREE.Mesh(new THREE.TorusGeometry(Rr - .06, .08, 8, 24), MAT.charcoal), g); ft.rotation.y = Math.PI / 2; ft.position.set(0, Rr, Wr);   // fat rear tyre
    fork([1.02, .5], [Rf, Wf], MAT.chrome); swing(-.1, Wr, Rr, black);
    lamp(0, .98, .72, .11, MAT.chrome);
    part(.16, .04, .42, black, 0, .66, .86, .3);
    blob(.2, black, 0, .86, .24, 1, .7, 1.7); part(.06, .02, .36, MAT.chrome, 0, 1.0, .24);
    part(.3, .3, .38, MAT.chrome, 0, .5, .06); part(.26, .2, .2, MAT.charcoal, 0, .72, .1);
    part(.36, .08, .44, MAT.charcoal, 0, .7, -.22); part(.3, .09, .3, MAT.charcoal, 0, .82, -.56); part(.22, .26, .04, MAT.chrome, 0, .95, -.74);
    part(.2, .05, .52, black, 0, .66, -.72, -.25); tail(.72, -.98);
    tube(V(.16, .34, .1), V(.2, .42, -.95), .045, MAT.chrome);
    for (const s2 of [-1, 1]) tube(V(s2 * .08, 1.02, .5), V(s2 * .1, 1.2, .44), .018, MAT.chrome);
    bars(1.16, .48, .78, MAT.chrome, .04); mirrors(1.2, .44, .66);
  } else {   // café racer: long flat tank with knee pads, humped seat, round lamp, clip-ons, wire wheels, twin peashooters
    const red = paint(0xb3171c, .55), black = paint(0x121316, .4);
    const W = .7, R = .32;
    wheel(W, R, MAT.chrome, true, true); wheel(-W, R, MAT.chrome, true, false);
    fork([.98, .46], [R, W], MAT.chrome); swing(-.05, -W, R, black);
    lamp(0, .9, .62, .1, black);
    part(.16, .04, .4, black, 0, .68, .74, .35);
    blob(.2, red, 0, .92, .14, 1.05, .62, 1.9); part(.05, .015, .5, black, 0, 1.045, .14, .02); for (const s2 of [-1, 1]) part(.02, .1, .16, MAT.charcoal, s2 * .2, .88, .02);
    part(.3, .36, .4, MAT.chrome, 0, .52, .04); part(.22, .22, .22, MAT.charcoal, 0, .76, .02);
    part(.26, .07, .4, black, 0, .92, -.34); part(.24, .14, .16, red, 0, .99, -.6, -.2);
    part(.18, .05, .4, black, 0, .72, -.72, -.2); tail(.82, -.94);
    for (const s2 of [-1, 1]) tube(V(s2 * .15, .36, .12), V(s2 * .2, .52, -.95), .04, MAT.chrome);
    bars(.9, .48, .58, MAT.charcoal); mirrors(.88, .5, .6);
  }
  const sx = Math.sin(ry) * .55, sz = Math.cos(ry) * .55;
  colCirc(x + sx, z + sz, .45); colCirc(x - sx, z - sz, .45);
}
// the modelled street lamp, its arm reaching out along (dx, dz), scaled up a little to the old 4.2 m pole
function streetLight(x, z, dx, dz) {
  const s = 1.1; streetProp('lamp', x, 0, z, Math.atan2(dx, dz)).scale.setScalar(s);
  const b = add(new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 10), MAT.warmGlow), undefined, false); b.position.set(x + dx * .89 * s, 3.3 * s, z + dz * .89 * s);
  colCirc(x, z, .2);
}
function modernHouse(cx, cz) {
  const W = 6.4, D = 5, front = cz + D / 2;
  box(W + .4, .3, D + .4, MAT.concrete, cx, 0, cz);
  box(W * .55, 3.1, D, MAT.cladding, cx - W * .225, .3, cz);
  box(W * .45, 3.1, D, MAT.plaster, cx + W * .275, .3, cz);
  box(2.1, 1.9, .08, MAT.glassLit, cx + W * .275, .85, front + .05, { cast: false });
  box(2.3, .12, .14, MAT.metal, cx + W * .275, 2.75, front + .08);
  box(1, 2.2, .08, MAT.metal, cx - W * .3, .3, front + .05); box(.08, 1.6, .02, MAT.warmGlow, cx - W * .3 + .3, .6, front + .1, { cast: false });
  box(.9, .9, .08, MAT.glassLit, cx - W * .05, 1.6, front + .05, { cast: false });
  const roof = add(new THREE.Mesh(boxGeo(W + .9, .2, D + 1.4, [1, 1, 1, 1, 1, 1]), MAT.roofFlat)); roof.position.set(cx, 3.75, cz + .2); roof.rotation.x = -.16;
  for (let i = 0; i < 3; i++) { const p = add(new THREE.Mesh(boxGeo(1.4, .06, 1, 0), MAT.solar)); p.position.set(cx - 1.8 + i * 1.6, 3.9 + .12, cz - .6); p.rotation.x = -.16; }
  box(3.4, .18, 1.4, MAT.wood, cx - W * .2, 0, front + .7);
  pot(cx + W * .1, front + .7, .8); pot(cx + W * .45, front + .7, .9);
  box(.3, 1.1, .3, MAT.metal, cx + W / 2 + .8, 0, front + 1); box(.42, .3, .42, MAT.plaster, cx + W / 2 + .8, 1.1, front + 1);
  colCirc(cx + W / 2 + .8, front + 1, .3);
  pointLight('lobby', 0xffc070, 1.6, 6, cx + W * .275, 1.6, front + 1.1);
  colBox(cx - W / 2 - .2, cz - D / 2 - .2, cx + W / 2 + .2, front + 1.4);
  return front;
}
function cafe(cx, cz) {
  const W = 5.4, D = 4, front = officeBlock(cx, cz, W, D, 3.3, { floors: 1, units: 1, front: MAT.glassLit, side: MAT.cladding });
  const aw = add(new THREE.Mesh(boxGeo(W + .4, .08, 1.5, 0), MAT.awning)); aw.position.set(cx, 3.05, front + .65); aw.rotation.x = .32;
  ledSign(['TOKEN BREW'], '#ffd27a', cx, 4.1, front + .1, 3.4, .55);
  return front;
}
// steel gateway frame; the glowing portal sits inside it
// rising, twinkling sparkles that mark something you can play (the minigames)
function sparkles(x, z, color, n = 26, r = .8, h = 2.4) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = new THREE.Color(color), seed = [];
  for (let i = 0; i < n; i++) seed.push({ a: rnd() * 6.283, r: r * (.35 + rnd() * .65), sp: .22 + rnd() * .3, ph: rnd(), tw: 3 + rnd() * 4 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const star = canvasTex(32, 32, g => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }, { nearest: false });   // a soft round glow, not a pixel cross
  const mat = new THREE.PointsMaterial({ map: star, size: .2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.userData.dyn = true; scene.add(pts);
  anim.push(t => {
    seed.forEach((s, i) => {
      const f = (t * s.sp + s.ph) % 1, a = s.a + t * .5, k = Math.sin(f * Math.PI) * (.6 + .4 * Math.sin(t * s.tw + s.ph * 9));
      pos[i * 3] = x + Math.cos(a) * s.r; pos[i * 3 + 1] = .15 + f * h; pos[i * 3 + 2] = z + Math.sin(a) * s.r;
      col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
    });
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
  });
}
function gate(x, z, ry, title, color, zone, to) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const strip = glowStrip(color);
  for (const s of [-1, 1]) {
    box(.5, .3, .5, MAT.concrete, s * 2.05, 0, 0, { p: g }); box(.36, 4.3, .36, MAT.metal, s * 2.05, .3, 0, { p: g });
    box(.06, 3.8, .06, strip, s * 1.85, .45, 0, { p: g, cast: false });
  }
  box(4.8, .42, .5, MAT.metal, 0, 4.5, 0, { p: g }); box(3.8, .06, .06, strip, 0, 4.42, 0, { p: g, cast: false });
  const cos = Math.cos(ry), sin = Math.sin(ry);
  for (const s of [-1, 1]) colCirc(x + s * 2.05 * cos, z - s * 2.05 * sin, .3);
  portal(x, z, color, zone, to, title);
}
