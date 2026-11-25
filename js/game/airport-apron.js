// TokenFall: the view through Pune Airport's glass wall. A chunky storybook airliner (lathe-turned fuselage with a painted livery,
// swept wings, engines with spinning fans, an upswept tail), the apron with our own plane docked at Gate 7, a concourse across the way
// with planes at its jet bridges, two planes that slowly taxi past the window, take off and later land again, a baggage train
// looping round our plane, a tower, a hangar and drifting clouds. A window seat lets you sit and watch it all.
// Classic script: shares one global scope with the other js/game files; buildApron(cx, cz) is called from buildAirport (airport.js).

const AP_LIVERY = [
  { main: '#2aa59a', acc: '#f2b53a', name: 'TOKENAIR' },
  { main: '#ff7a6a', acc: '#3a5aa0', name: 'CHAI AIR' },
  { main: '#4a7fe0', acc: '#ff9a3a', name: 'PROMPTJET' },
  { main: '#9a6ad8', acc: '#ffd04a', name: 'VECTOR AIR' },
  { main: '#f2a03a', acc: '#3a7a5a', name: 'GPU AIR' },
];
const AP_L = 19, AP_R = 1.35, AP_Y = 2.4;   // fuselage length, radius, centre height
const AP_ONCE = {};
// the blinking lights of planes that are running: one shared strobe and beacon material, flashed from buildApron's anim
const AP_FLASH = { strobe: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 }), beacon: new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff2a1a, emissiveIntensity: 0 }) };
const apOnce = (k, f) => AP_ONCE[k] || (AP_ONCE[k] = f());

// the fuselage: a lathe from tail (local x -L/2) to nose (+L/2), the tail cone swept up
function apFuselageGeo() {
  return apOnce('fus', () => {
    const pts = [], N = 80;
    for (let j = 0; j <= N; j++) {
      const y = j / N * AP_L; let r;
      if (y < 5.5) r = .3 + (AP_R - .3) * Math.sin(y / 5.5 * Math.PI / 2);
      else if (y < AP_L - 3.2) r = AP_R;
      else { const s = (y - (AP_L - 3.2)) / 3.2; r = AP_R * Math.sqrt(Math.max(0, 1 - Math.pow(s, 2.2))); }
      pts.push(new THREE.Vector2(Math.max(r, 1e-3), y));
    }
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateZ(-Math.PI / 2); g.translate(-AP_L / 2, 0, 0);   // lathe axis -> +x; lathe x -> down, so u .25 is the belly, .75 the crown
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x < -4) p.setY(i, p.getY(i) + Math.pow((-4 - x) / 5.5, 2) * 1.0); }
    g.computeVertexNormals(); return g;
  });
}
// the livery, painted on the lathe's (u around, v along) map; v = 1 is the nose, the canvas top
function apLiveryMat(L) {
  return apOnce('liv' + L.name, () => {
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const U = (u) => u * W, V = (v) => (1 - v) * H;
    const band = (u0, u1, v0, v1, c) => { g.fillStyle = c; g.fillRect(U(u0), V(v1), U(u1) - U(u0), V(v0) - V(v1)); };
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, W, H);
    band(.1, .4, 0, 1, '#dfe5ec');                                                     // pale belly
    band(.6, .9, 0, .26, L.main);                                                      // the crown of the tail cone in the airline colour
    for (const [a, b] of [[.03, .065], [.435, .47]]) { band(a, b, .05, .9, L.acc); band(a + .035, b + .02, .05, .9, L.main); }   // cheatlines under the windows
    g.fillStyle = '#2b3a4a';
    for (let v = .3; v < .82; v += .022) for (const u of [.965, .535]) { const x = U(u) - 6, y = V(v) - 5; g.beginPath(); g.roundRect ? g.roundRect(x, y, 12, 10, 4) : g.rect(x, y, 12, 10); g.fill(); }
    for (const [u0, u1] of [[.88, .975], [.525, .62]]) { g.beginPath(); g.moveTo(U(u0), V(.945)); g.lineTo(U(u1), V(.94)); g.lineTo(U(u1), V(.915)); g.lineTo(U(u0), V(.905)); g.closePath(); g.fill(); }   // cockpit glass
    g.strokeStyle = '#9aa6b2'; g.lineWidth = 2;
    for (const v of [.855, .22]) for (const u of [.925, .505]) g.strokeRect(U(u), V(v + .02), 26, 30);   // doors
    g.save(); g.translate(U(.905), V(.62)); g.rotate(-Math.PI / 2); g.fillStyle = L.main; g.font = '700 30px "Fredoka", "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.name, 0, 0); g.restore();
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, roughness: .35, metalness: .05 });
  });
}
const apMat = (k, c, o = {}) => apOnce('m' + k, () => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .5 }, o)));
// a flat swept panel (wing, stabiliser, fin) from an outline, extruded thin with soft edges
function apPanel(pts, depth) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 });
}
function apLogoMat(L) {
  return apOnce('logo' + L.name, () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.fillStyle = L.acc; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '700 64px "Fredoka", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.name[0], 64, 68);
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, alphaTest: .5, roughness: .5 });
  });
}

// one airliner, nose along local +x, wheels on y = 0. Returns { g, gear, fans }
function apPlane(L, live = false) {
  const g = new THREE.Group(), gear = [], fans = [];
  const put = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const wingM = apMat('wing', 0xe9edf2, { roughness: .4 }), main = apMat('main' + L.main, new THREE.Color(L.main)), acc = apMat('acc' + L.acc, new THREE.Color(L.acc));
  const dark = apMat('dark', 0x30363e, { roughness: .7 }), metal = apMat('metal', 0xb8c0ca, { roughness: .3, metalness: .6 });
  put(apFuselageGeo(), apLiveryMat(L), 0, AP_Y, 0);
  // wings: low, swept, a little dihedral, coloured winglets
  for (const s of [1, -1]) {
    const geo = apOnce('wing' + s, () => { const k = apPanel([[2.2, 0], [-1.9, 0], [-4.1, s * 8.6], [-2.8, s * 8.6]], .22); k.rotateX(Math.PI / 2); return k; });
    const w = put(geo, wingM, -.4, AP_Y - .55, 0); w.rotation.x = s * -.07;
    const wl = put(apOnce('winglet', () => new THREE.BoxGeometry(1.2, 1.3, .14)), acc, -3.6, AP_Y + .2, s * 8.85); wl.rotation.z = -.35;
    // engine under each wing: cowl, accent lip, dark intake, a spinning fan, a pylon
    const ex = 1.3, ez = s * 3.3, ey = AP_Y - 1.5;
    const cowl = put(apOnce('cowl', () => { const k = new THREE.CylinderGeometry(.66, .55, 2.5, 22); k.rotateZ(Math.PI / 2); return k; }), wingM, ex, ey, ez);
    put(apOnce('lip', () => { const k = new THREE.TorusGeometry(.62, .1, 10, 24); k.rotateY(Math.PI / 2); return k; }), acc, ex + 1.25, ey, ez);
    put(apOnce('intake', () => { const k = new THREE.CircleGeometry(.56, 22); k.rotateY(Math.PI / 2); return k; }), dark, ex + 1.2, ey, ez);
    const fan = new THREE.Group(); fan.position.set(ex + 1.22, ey, ez); g.add(fan); fans.push(fan);
    for (let b = 0; b < 6; b++) { const bl = put(apOnce('blade', () => new THREE.BoxGeometry(.04, .5, .14)), metal, 0, 0, 0, fan); bl.rotation.x = b * Math.PI / 3; bl.position.set(0, Math.cos(b * Math.PI / 3) * .25, Math.sin(b * Math.PI / 3) * .25); }
    put(apOnce('spinner', () => { const k = new THREE.SphereGeometry(.16, 12, 8); k.scale(1.4, 1, 1); return k; }), metal, ex + 1.28, ey, ez);
    put(apOnce('pylon', () => new THREE.BoxGeometry(1.8, .7, .2)), wingM, ex - .2, ey + .6, ez);
    cowl.rotation.x = 0;
  }
  // tail: stabilisers and the fin with the airline's roundel
  for (const s of [1, -1]) {
    const geo = apOnce('stab' + s, () => { const k = apPanel([[-6.9, 0], [-8.7, 0], [-9.6, s * 3.4], [-8.9, s * 3.4]], .14); k.rotateX(Math.PI / 2); return k; });
    put(geo, wingM, 0, AP_Y + .9, 0);
  }
  put(apOnce('fin', () => { const k = apPanel([[-6.2, 0], [-9.3, 0], [-9.9, 4.0], [-8.6, 4.0]], .18); k.translate(0, 0, -.09); return k; }), main, 0, AP_Y + .55, 0);
  for (const s of [1, -1]) { const lg = put(apOnce('logoG', () => new THREE.PlaneGeometry(1.5, 1.5)), apLogoMat(L), -8.2, AP_Y + 2.6, s * .2); lg.rotation.y = s > 0 ? 0 : Math.PI; }
  // landing gear: rounded tyres on silver hubs, an oleo strut (grey cylinder, chrome piston), a torque link, the axle and a gear door
  const tyre = apOnce('tyreL', () => { const k = new THREE.LatheGeometry([[.15, -.12], [.27, -.135], [.33, -.11], [.355, -.05], [.36, 0], [.355, .05], [.33, .11], [.27, .135], [.15, .12]].map(([r, y]) => new THREE.Vector2(r, y)), 22); k.rotateX(Math.PI / 2); return k; });
  const hub = apOnce('hub', () => { const k = new THREE.CylinderGeometry(.19, .19, .25, 16); k.rotateX(Math.PI / 2); return k; });
  const cap = apOnce('hubcap', () => { const k = new THREE.CylinderGeometry(.09, .12, .27, 12); k.rotateX(Math.PI / 2); return k; });
  const chrome = apMat('chrome', 0xe6eaee, { roughness: .15, metalness: .9 }), grey = apMat('gearGrey', 0x8a929c, { roughness: .4, metalness: .5 }), rubber = apMat('rubber', 0x23262b, { roughness: .9 });
  const wheel = (gg, wx, wz, sc) => { const w = new THREE.Group(); w.position.set(wx, .36 * sc, wz); w.scale.setScalar(sc); gg.add(w);
    put(tyre, rubber, 0, 0, 0, w); put(hub, grey, 0, 0, 0, w); put(cap, chrome, 0, 0, 0, w); return w; };
  for (const [x, z, nose] of [[7, 0, true], [-.9, 1.3, false], [-.9, -1.3, false]]) {
    const gg = new THREE.Group(); gg.position.set(x, 0, z); g.add(gg); gear.push(gg);
    const sc = nose ? .78 : 1, top = nose ? 1.15 : 1.5;
    put(apOnce('oleo' + nose, () => new THREE.CylinderGeometry(nose ? .09 : .13, nose ? .09 : .13, top - .75, 12)), grey, 0, .75 + (top - .75) / 2, 0, gg);
    put(apOnce('piston' + nose, () => new THREE.CylinderGeometry(nose ? .06 : .085, nose ? .06 : .085, .5, 12)), chrome, 0, .55, 0, gg);
    const tl = put(apOnce('torque', () => new THREE.BoxGeometry(.05, .32, .07)), grey, .13, .62, 0, gg); tl.rotation.z = .5;
    put(apOnce('axle', () => new THREE.CylinderGeometry(.05, .05, .7, 8).rotateX(Math.PI / 2)), grey, 0, .36 * sc, 0, gg);
    for (const s of [-1, 1]) wheel(gg, 0, s * (nose ? .2 : .25), sc);
    const door = put(apOnce('gdoor' + nose, () => new THREE.BoxGeometry(nose ? .9 : 1.1, nose ? .5 : .7, .04)), wingM, 0, top - .25, nose ? .32 : (z > 0 ? -.3 : .3), gg);
    if (nose) { const tlt = put(apOnce('taxiLt', () => new THREE.SphereGeometry(.07, 10, 8)), apMat('lampW', 0xffffff, { emissive: 0xfff6d8, emissiveIntensity: 1.6 }), .15, .95, 0, gg); tlt.castShadow = false; }
  }
  // engine tails: an exhaust cone and nozzle ring behind each fan cowl
  for (const s of [1, -1]) {
    const ex = 1.3, ez = s * 3.3, ey = AP_Y - 1.5;
    put(apOnce('nozzle', () => { const k = new THREE.CylinderGeometry(.42, .55, .5, 18); k.rotateZ(Math.PI / 2); return k; }), grey, ex - 1.45, ey, ez);
    put(apOnce('plug', () => { const k = new THREE.ConeGeometry(.3, .9, 16); k.rotateZ(Math.PI / 2); return k; }), apMat('plug', 0x5a5e66, { roughness: .4, metalness: .6 }), ex - 2.0, ey, ez);
    // flap-track fairings: three slim pods under the trailing edge
    for (const sp of [2.6, 4.6, 6.6]) { const pod = put(apOnce('pod', () => { const k = new THREE.SphereGeometry(.16, 12, 8); k.scale(5, 1, 1); return k; }), wingM, -1.7 - 2.2 * sp / 8.6, AP_Y - .82 + sp * .07, s * sp); pod.castShadow = false; }
  }
  // belly fairing where the wing meets the body, an APU exhaust in the tail cone, antennas
  put(apOnce('belly', () => { const k = new THREE.SphereGeometry(1, 20, 12); k.scale(4.2, .55, 1.25); return k; }), apMat('bellyGrey', 0xdfe5ec, { roughness: .4 }), -.6, AP_Y - .95, 0);
  put(apOnce('apu', () => { const k = new THREE.CylinderGeometry(.14, .14, .3, 10); k.rotateZ(Math.PI / 2); return k; }), dark, -9.55, AP_Y + 1.02, 0);
  for (const [ax, ay] of [[2.5, AP_Y + 1.38], [-3, AP_Y + 1.38], [1, AP_Y - 1.4]]) { const an = put(apOnce('ant', () => new THREE.BoxGeometry(.35, .25, .04)), dark, ax, ay + (ay > AP_Y ? .1 : -.1), 0); an.rotation.z = .4; }
  // lights: red (left) and green (right) on the wingtips, white strobes on the tips and tail, red beacons top and bottom
  const lamp = (m, x, y, z) => { const k = put(apOnce('lamp', () => new THREE.SphereGeometry(.11, 10, 8)), m, x, y, z); k.castShadow = false; return k; };
  lamp(apMat('navR', 0xff3030, { emissive: 0xff2020, emissiveIntensity: 1.4 }), -3.3, AP_Y + .1, -8.7);
  lamp(apMat('navG', 0x30ff60, { emissive: 0x20ff50, emissiveIntensity: 1.4 }), -3.3, AP_Y + .1, 8.7);
  const strobe = live ? AP_FLASH.strobe : apMat('strobeOff', 0xf0f0f0), beacon = live ? AP_FLASH.beacon : apMat('beaconOff', 0x8a2a2a);
  for (const [x, y, z] of [[-3.9, AP_Y + .1, -8.65], [-3.9, AP_Y + .1, 8.65], [-9.62, AP_Y + 1.0, 0]]) lamp(strobe, x, y, z);
  for (const y of [AP_Y + 1.42, AP_Y - 1.42]) lamp(beacon, 0, y, 0);
  return { g, gear, fans };
}

// a route made of straight runs, turns and pauses; speed changes evenly along each piece. rev: moving tail first (a pushback).
function apSample(p, f, out) {
  if (p.arc) {
    const a = p.a0 + (p.a1 - p.a0) * f, d = Math.sign(p.a1 - p.a0);
    out.x = p.c[0] + p.R * Math.cos(a); out.z = p.c[1] + p.R * Math.sin(a); out.y = 0;
    out.yaw = Math.atan2(-(Math.cos(a) * d), -Math.sin(a) * d); out.climb = 0;
  } else {
    const [ax, ay, az] = p.a, [bx, by, bz] = p.b;
    out.x = ax + (bx - ax) * f; out.y = ay + (by - ay) * f; out.z = az + (bz - az) * f;
    out.yaw = Math.atan2(-(bz - az), bx - ax); out.climb = Math.atan2(by - ay, Math.hypot(bx - ax, bz - az));
  }
  if (p.rev) { out.yaw += Math.PI; out.climb = 0; }
  return out;
}
function apRoute(pieces) {
  let T = 0, prev = null;
  for (const p of pieces) {
    if (p.wait != null) { p.L = 0; p.T = p.wait; p.hold = Object.assign({}, prev); }
    else {
      p.L = p.arc ? Math.abs(p.a1 - p.a0) * p.R : Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]);
      p.T = 2 * p.L / (p.v0 + p.v1); prev = apSample(p, 1, {});
    }
    p.t0 = T; T += p.T;
  }
  for (const p of pieces) if (p.wait != null && !p.hold.yaw && p.hold.yaw !== 0) p.hold = Object.assign({}, prev);   // a pause before any move holds where the loop ends
  return { pieces, T };
}
// where a route puts a plane at time t: position, heading, climb, and which piece (for the tug)
function apAt(route, t, out) {
  t = ((t % route.T) + route.T) % route.T;
  let p = route.pieces[0]; for (const q of route.pieces) if (t >= q.t0) p = q;
  const tau = t - p.t0;
  out.hidden = !!p.hidden; out.p = p; out.f = p.T ? tau / p.T : 1;
  if (p.wait != null) return Object.assign(out, p.hold, { hidden: !!p.hidden, p, f: out.f });
  const s = p.v0 * tau + .5 * (p.v1 - p.v0) / p.T * tau * tau;
  return apSample(p, Math.min(1, s / p.L), out);
}
// the pushback tug: a low yellow tractor with a towbar to the nose wheel
function apTug(parent) {
  const t = new THREE.Group(); t.userData.dyn = true;
  const m = (w, h, d, mat, x, y, z) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); k.position.set(x, y + h / 2, z); k.castShadow = true; t.add(k); return k; };
  m(2.6, .7, 1.7, apMat('tug', 0xf2c418, { roughness: .5 }), 0, .25, 0); m(.9, .6, 1.3, apMat('bgl', 0x5a7a90, { roughness: .2, metalness: .3 }), -.6, .95, 0);
  m(.95, .08, 1.4, apMat('tug', 0xf2c418), -.6, 1.55, 0); m(2.4, .1, .12, apMat('dark', 0x30363e), 2.3, .45, 0);
  const beacon = m(.16, .16, .16, apMat('beacon', 0xff8a2a, { emissive: 0xff6a00, emissiveIntensity: 1 }), -.6, 1.63, 0); beacon.castShadow = false;
  for (const [x, z] of [[.8, .8], [.8, -.8], [-.8, .8], [-.8, -.8]]) { const w = new THREE.Mesh(apOnce('vw', () => { const k = new THREE.CylinderGeometry(.38, .38, .3, 12); k.rotateX(Math.PI / 2); return k; }), apMat('dark', 0x30363e)); w.position.set(x, .38, z); t.add(w); }
  parent.add(t); return t;
}


// ---- ground textures, painted once on canvases ----
const apCanvas = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); return cv; };
const apRnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
// apron concrete: one tile is 4 x 4 slabs of 5 m, each its own shade, with aggregate speckle, broom lines, sealed joints, a few hairline cracks and stains
function apConcrete() {
  return apOnce('concrete', () => {
    const cv = apCanvas(1024, 1024, (g, W) => {
      const S = W / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 196 + Math.round((apRnd() - .5) * 18); g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(i * S, j * S, S, S); }
      for (let k = 0; k < 26000; k++) { const l = apRnd() < .5; g.fillStyle = l ? `rgba(255,255,255,${.05 + apRnd() * .08})` : `rgba(70,74,80,${.05 + apRnd() * .1})`; g.fillRect(apRnd() * W, apRnd() * W, 1 + (apRnd() < .2), 1); }
      g.strokeStyle = 'rgba(120,124,130,.07)'; g.lineWidth = 1; for (let y = 0; y < W; y += 3) { g.beginPath(); g.moveTo(0, y + apRnd()); g.lineTo(W, y + apRnd()); g.stroke(); }
      for (let k = 0; k < 9; k++) { const x = apRnd() * W, y = apRnd() * W, r = 20 + apRnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,58,56,.16)'); gr.addColorStop(1, 'rgba(60,58,56,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.strokeStyle = 'rgba(80,84,90,.35)'; for (let k = 0; k < 6; k++) { let x = apRnd() * W, y = apRnd() * W; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (apRnd() - .5) * 40; y += (apRnd() - .3) * 30; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i <= 4; i++) { g.fillStyle = '#7c8086'; g.fillRect(i * S - 2, 0, 4, W); g.fillRect(0, i * S - 2, W, 4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(i * S + 2, 0, 1, W); g.fillRect(0, i * S + 2, W, 1); }
    });
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(13, 4.5); t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, roughness: .92 });
  });
}
function apAsphalt() {
  return apOnce('asphalt', () => {
    const cv = apCanvas(512, 256, (g, W, H) => {
      g.fillStyle = '#44484e'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 14000; k++) { g.fillStyle = apRnd() < .5 ? `rgba(255,255,255,${apRnd() * .07})` : `rgba(0,0,0,${apRnd() * .12})`; g.fillRect(apRnd() * W, apRnd() * H, 1, 1); }
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(20,20,22,${.08 + apRnd() * .12})`; g.lineWidth = 3 + apRnd() * 5; const y = H * .3 + apRnd() * H * .4, x = apRnd() * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60 + apRnd() * 120, y + (apRnd() - .5) * 6); g.stroke(); }   // rubber from touchdowns
    });
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 1); t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, roughness: .95 });
  });
}
function apGrass() {
  return apOnce('grassT', () => {
    const cv = apCanvas(256, 256, (g, W) => {
      g.fillStyle = '#86c064'; g.fillRect(0, 0, W, W);
      for (let k = 0; k < 5000; k++) { const c = [[110, 178, 82], [140, 200, 100], [96, 160, 74], [160, 206, 112]][Math.floor(apRnd() * 4)]; g.fillStyle = `rgba(${c},.5)`; g.fillRect(apRnd() * W, apRnd() * W, 2, 2); }
    });
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 14);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
}
// a stand's paint, nose at the bottom of the canvas: red equipment-restraint box, hatched no-parking under the bridge, dashed GSE parking
// bays with their labels, the nose-wheel stop bar and the stand number on its black-and-yellow board
function apStandDecal(num) {
  return apOnce('stand' + num, () => {
    const W = 512, H = 768, k = W / 24;   // 24 m by 36 m
    const cv = apCanvas(W, H, (g) => {
      const px = (dx) => (dx + 12) * k, py = (dn) => H - dn * k;   // dn: metres from the nose end
      g.lineWidth = 6; g.strokeStyle = '#d8332a'; g.strokeRect(px(-7.5), py(23), 15 * k, 22 * k);
      g.font = '700 22px "Fredoka", sans-serif'; g.fillStyle = '#d8332a'; g.textAlign = 'center'; g.fillText('ERA', px(0), py(22.2));
      g.strokeStyle = '#f4f4f0'; g.lineWidth = 3; g.strokeRect(px(1.6), py(4.5), 2.2 * k, 4.2 * k);
      g.save(); g.beginPath(); g.rect(px(1.6), py(4.5), 2.2 * k, 4.2 * k); g.clip(); for (let x = -100; x < 200; x += 14) { g.beginPath(); g.moveTo(px(1.6) + x, py(4.5)); g.lineTo(px(1.6) + x + 90, py(.3)); g.stroke(); } g.restore();
      g.setLineDash([16, 12]); for (const x0 of [-11.5, 8.6]) { g.strokeRect(px(x0), py(21), 2.8 * k, 17 * k); } g.setLineDash([]);
      g.save(); g.fillStyle = '#f4f4f0'; g.font = '700 26px "Fredoka", sans-serif'; for (const x0 of [-10.1, 10]) { g.save(); g.translate(px(x0), py(12.5)); g.rotate(-Math.PI / 2); g.fillText('GSE', 0, 8); g.restore(); } g.restore();
      g.fillStyle = '#f2c418'; g.fillRect(px(-1.6), py(2.7), 3.2 * k, .35 * k); g.font = '700 20px "Fredoka", sans-serif'; g.fillText('A320  STOP', px(0), py(1.9));
      g.fillStyle = '#1e1e22'; g.fillRect(px(-1.8), py(31.5), 3.6 * k, 2.6 * k); g.fillStyle = '#f2c418'; g.fillRect(px(-1.5), py(31.2), 3 * k, 2 * k);
      g.fillStyle = '#1e1e22'; g.font = '700 40px "Fredoka", sans-serif'; g.textBaseline = 'middle'; g.fillText(num, px(0), py(30.2));
    });
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  });
}
function apMarkings(X, Z, gp, RW) {
  const white = apMat('white', 0xf6f6f2), yellow = apMat('yel', 0xf2c418, { roughness: .8 });
  // our stand (nose at z -14, plane along -z) and the four concourse stands (nose at z -75, along +z)
  const d = gp(24, 36, apStandDecal('7'), X(9.8), Z(-14 - 18 + .5), .011); d.castShadow = false;
  ['21', '22', '23', '24'].forEach((n, i) => { const m = gp(24, 36, apStandDecal(n), X(-30 + i * 20), Z(-75 + 18 - .5), .011); m.rotation.z = Math.PI; });
  // runway: edge lines, touchdown-zone bars, aiming points and its numbers
  for (const s of [-1, 1]) gp(250, .4, white, X(0), Z(RW + s * 5.6), .006);
  for (const [x0, dir] of [[-104, 1], [98, -1]]) for (let k = 0; k < 3; k++) for (const s of [-1, 1]) gp(6, .7, white, X(x0 + dir * (18 + k * 12)), Z(RW + s * 2.6), .006);
  for (const [x0, dir] of [[-104, 1], [98, -1]]) for (const s of [-1, 1]) gp(14, 1.5, white, X(x0 + dir * 50), Z(RW + s * 3), .006);
  for (const [txt, x, rot] of [['27', -108, -Math.PI / 2], ['09', 102, Math.PI / 2]]) {
    const m = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(apCanvas(128, 128, (g) => { g.fillStyle = '#fff'; g.font = '700 100px "Fredoka", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 70); })), transparent: true, depthWrite: false });
    const p = gp(6, 6, m, X(x), Z(RW), .007); p.rotation.z = rot;
  }
  // edge lights: white along the runway, blue along the taxiways out to it; little posts with glowing caps
  const wl = apMat('rwLight', 0xffffff, { emissive: 0xfff6d8, emissiveIntensity: 1.2 }), bl = apMat('twLight', 0x4a7aff, { emissive: 0x3a6aff, emissiveIntensity: 1.3 }), post = apMat('ltPost', 0x6a6e74);
  const light = (m, x, z) => { box(.08, .3, .08, post, X(x), 0, Z(z), { cast: false }); const c = new THREE.Mesh(apOnce('ltCap', () => new THREE.SphereGeometry(.1, 8, 6)), m); c.position.set(X(x), .34, Z(z)); scene.add(c); };
  for (let x = -120; x <= 120; x += 10) for (const s of [-1, 1]) light(wl, x, RW + s * 6.4);
  for (let z = -56; z >= RW + 14; z -= 6) for (const x of [-62.5, -47.5, 47.5, 62.5]) light(bl, x, z);
  for (let x = -40; x <= 40; x += 8) for (const s of [-1, 1]) light(bl, x, -42 + s * 7.5);
  // taxiway signs: black-on-yellow direction boards and a red runway-holding sign at each runway entry
  const sign = (x, z, ry, parts) => {
    const W = 512, H = 96, cv = apCanvas(W, H, (g) => {
      let cx0 = 0; for (const [txt, bg, fg, w] of parts) { g.fillStyle = bg; g.fillRect(cx0, 0, w * W, H); g.fillStyle = fg; g.font = '700 62px "Fredoka", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx0 + w * W / 2, H / 2 + 3); cx0 += w * W; }
    });
    const fm = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), emissive: 0xffffff, emissiveMap: new THREE.CanvasTexture(cv), emissiveIntensity: .25 });
    const bodyM = apMat('signBody', 0x2a2c30);
    const sg = new THREE.Mesh(new THREE.BoxGeometry(3.2, .7, .3), [bodyM, bodyM, bodyM, bodyM, fm, fm]); sg.position.set(X(x), .75, Z(z)); sg.rotation.y = ry; sg.castShadow = true; scene.add(sg);
    for (const s of [-1.2, 1.2]) box(.12, .45, .12, post, X(x) + Math.cos(ry) * s, 0, Z(z) - Math.sin(ry) * s, { cast: false });
  };
  sign(-64, -60, Math.PI / 2, [['B', '#1e1e22', '#f2c418', .3], ['← 27', '#f2c418', '#1e1e22', .7]]);
  sign(64, -60, -Math.PI / 2, [['B', '#1e1e22', '#f2c418', .3], ['09 →', '#f2c418', '#1e1e22', .7]]);
  for (const x of [-64, 64]) sign(x, RW + 14, x < 0 ? Math.PI / 2 : -Math.PI / 2, [['27-09', '#c8241e', '#ffffff', 1]]);
  sign(-22, -33, 0, [['A', '#1e1e22', '#f2c418', .3], ['GATES 21-24 ↑', '#f2c418', '#1e1e22', .7]]);
}
// the work around a parked plane, all at our Gate 7 plane unless noted; a wind sock by the runway
function apEquipment(X, Z, dynRoot) {
  const white = apMat('white', 0xf6f6f2), dark = apMat('dark', 0x30363e), yel = apMat('gseYel', 0xf2c418, { roughness: .55 }), glassM = apMat('bgl', 0x5a7a90, { roughness: .2, metalness: .3 });
  const steel = apMat('steelG', 0x9aa2ac, { roughness: .35, metalness: .5 }), rubber = apMat('rubber', 0x23262b, { roughness: .9 });
  const wheel = apOnce('gseW', () => { const k = new THREE.CylinderGeometry(.28, .28, .22, 14); k.rotateX(Math.PI / 2); return k; });
  const veh = (x, z, ry) => { const g = new THREE.Group(); g.position.set(X(x), 0, Z(z)); g.rotation.y = ry; scene.add(g); return g; };
  const bx = (p, w, h, d, m, x, y, z) => { const k = new THREE.Mesh(boxGeo(w, h, d, 0), m); k.position.set(x, y + h / 2, z); k.castShadow = true; k.receiveShadow = true; p.add(k); return k; };
  const wheels = (p, xs, zs) => { for (const x of xs) for (const z of zs) { const w = new THREE.Mesh(wheel, rubber); w.position.set(x, .28, z); w.castShadow = true; p.add(w); } };
  // belt loader at the forward hold (the plane's right side, facing -x here): a low truck with a sloping conveyor up to the door
  { const g = veh(5.6, -19.5, 0);
    bx(g, 3.2, .6, 1.4, yel, -.6, .25, 0); bx(g, .9, .8, 1.2, yel, -2, .85, 0); bx(g, .7, .5, 1.1, glassM, -2, 1.1, 0); wheels(g, [-1.6, .6], [-.62, .62]);
    const belt = bx(g, 4.2, .12, .8, dark, .6, 1.05, 0); belt.rotation.z = .27; for (const s of [-1, 1]) { const r = bx(g, 4.2, .25, .06, steel, .6, 1.15, s * .45); r.rotation.z = .27; }
    for (const [x, y, w, d] of [[-.2, .3, .5, .45], [.9, .62, .55, .4], [1.7, .85, .45, .45]]) { const b = bx(g, w, .32, d, apMat('bagC' + x, [0x3a6ad0, 0xc8402a, 0x2a8a5a][Math.round(x + 1) % 3]), x, y + .9, 0); b.rotation.z = .27; } }
  // catering truck with its box raised on a scissor lift to the rear right door
  { const g = veh(5.2, -29.5, 0);
    bx(g, 1.5, 1.4, 2, white, -2.6, .4, 0); bx(g, .1, .6, 1.7, glassM, -3.36, 1.1, 0); bx(g, 4.6, .3, 2, dark, -.2, .4, 0); wheels(g, [-2.6, -.4, 1.4], [-.9, .9]);
    for (const s of [-1, 1]) for (const k of [0, 1]) { const arm = bx(g, 2.8, .1, .08, steel, .6, .9 + k * .55, s * .9); arm.rotation.z = (k ? -1 : 1) * .38; }
    bx(g, 3.6, 1.7, 2.1, white, .6, 1.85, 0); bx(g, 3.62, .25, 2.12, apMat('main#ff7a6a', new THREE.Color('#ff7a6a')), .6, 2.9, 0); bx(g, .5, .08, 1.4, steel, 2.6, 1.85, 0); }
  // ground power unit by the nose, its cable to the plug under the cockpit
  { const g = veh(13.2, -13.6, Math.PI / 2); bx(g, 1.6, .9, 1, yel, 0, .3, 0); bx(g, 1.62, .1, 1.02, dark, 0, 1.2, 0); wheels(g, [-.5, .5], [-.52, .52]);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 3.2, 6), dark); c.position.set(X(11.6), .2, Z(-15.4)); c.rotation.set(Math.PI / 2, 0, .95); scene.add(c); }
  // chocks on every wheel of our plane: nose wheels at z -16.5, mains at -24.4
  for (const [x, z] of [[9.8, -16.5], [8.5, -24.4], [11.1, -24.4]]) for (const dz of [-.45, .45]) { const ch = new THREE.Mesh(apOnce('chock', () => new THREE.BoxGeometry(.5, .16, .16)), yel); ch.position.set(X(x), .08, Z(z + dz)); scene.add(ch); }
  // a row of baggage containers on dollies, waiting
  for (let i = 0; i < 3; i++) { const g = veh(-9.5, -18 - i * 2.3, 0);
    bx(g, 1.7, .2, 1.7, dark, 0, .35, 0); wheels(g, [-.6, .6], [-.7, .7]); bx(g, .9, .1, .1, steel, -1.25, .4, 0);
    const c = bx(g, 1.5, 1.4, 1.5, apMat('uld', 0xc8ccd2, { roughness: .35, metalness: .4 }), 0, .55, 0); bx(g, 1.2, 1.1, .02, apMat('uldCurtain', 0x3a5aa0), 0, .7, .76); }
  // a pushback tug resting by the concourse, a belt loader at gate 23
  { const g = veh(-18, -70, Math.PI / 2); bx(g, 2.6, .7, 1.7, yel, 0, .25, 0); bx(g, .9, .6, 1.3, glassM, -.6, .95, 0); wheels(g, [-.8, .8], [-.8, .8]); }
  { const g = veh(13.6, -66, Math.PI); bx(g, 3.2, .6, 1.4, yel, -.6, .25, 0); wheels(g, [-1.6, .6], [-.62, .62]); const belt = bx(g, 4.2, .12, .8, dark, .6, 1.05, 0); belt.rotation.z = .27; }
  // the wind sock on its mast by the runway, swinging a little in the breeze
  box(.16, 7, .16, apMat('ltPost', 0x6a6e74), X(84), 0, Z(-104));
  const sock = new THREE.Group(); sock.position.set(X(84), 6.8, Z(-104)); sock.userData.dyn = true; dynRoot.add(sock);
  const sockM = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(apCanvas(64, 256, (g) => { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff6a1a'; g.fillRect(0, i * 51, 64, 52); } })), side: THREE.DoubleSide, roughness: .8 });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.18, .45, 3, 14, 1, true).rotateZ(Math.PI / 2).translate(1.5, 0, 0), sockM); sock.add(cone);
  anim.push((t) => { if (typeof zone !== 'undefined' && zone !== 'airport') return; sock.rotation.y = -.5 + Math.sin(t * .4) * .25; cone.rotation.z = -.12 + Math.sin(t * 1.3) * .05; });
}

function buildApron(cx, cz) {
  const X = (v) => cx + v, Z = (v) => cz + v;
  const RW = -115, TW = -42;
  // everything that moves lives in one group, shown only while you are in the airport (it is only animated there, and would otherwise sit
  // wherever it was made, which for a new group is the world origin: the lobby fountain)
  const dynRoot = new THREE.Group(); dynRoot.userData.dyn = true; dynRoot.visible = false; scene.add(dynRoot);
  anim.push(() => { dynRoot.visible = typeof zone !== 'undefined' && zone === 'airport'; });
  // ground: pale concrete apron in big slabs, grass beyond the concourse, the runway behind it
  const slab = apConcrete();
  const gp = (w, d, m, x, z, y) => { const k = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); k.rotation.x = -Math.PI / 2; k.position.set(x, y, z); k.receiveShadow = true; scene.add(k); return k; };
  gp(260, 90, slab, X(0), Z(-55), -.005);
  const grass = apGrass(), asphalt = apAsphalt(), white = apMat('white', 0xf6f6f2), yellow = apMat('yel', 0xf2c418, { roughness: .8 });
  gp(260, 60, grass, X(0), Z(-130), -.004);
  gp(260, 12, asphalt, X(0), Z(RW), .002);
  for (let x = -125; x < 125; x += 8) gp(4, .35, white, X(x), Z(RW), .006);
  for (const e of [-118, 112]) for (let k = -4; k <= 4; k++) gp(5, .5, white, X(e), Z(RW + k * 1.2), .006);   // threshold piano keys
  // taxi lines: the loop the moving planes follow, and the lead-in to our gate
  const yl = (x0, z0, x1, z1) => { const k = gp(Math.hypot(x1 - x0, z1 - z0), .22, yellow, X((x0 + x1) / 2), Z((z0 + z1) / 2), .008); k.rotation.z = Math.atan2(-(z1 - z0), x1 - x0); };
  const ya = (c0, c1, R, a0, a1) => { for (let i = 0; i < 10; i++) { const p = (k) => [c0 + R * Math.cos(a0 + (a1 - a0) * k / 10), c1 + R * Math.sin(a0 + (a1 - a0) * k / 10)]; const [u0, w0] = p(i), [u1, w1] = p(i + 1); yl(u0, w0, u1, w1); } };
  yl(-45, TW, 45, TW); yl(-55, -52, -55, RW + 10); yl(55, -52, 55, RW + 10);
  ya(-45, -52, 10, Math.PI, Math.PI / 2); ya(45, -52, 10, Math.PI / 2, 0); ya(-45, RW + 10, 10, -Math.PI / 2, -Math.PI); ya(45, RW + 10, 10, 0, -Math.PI / 2);
  yl(9.8, -14, 9.8, TW); gp(4, .5, apMat('red', 0xe0483a), X(9.8), Z(-13.4), .009);
  apMarkings(X, Z, gp, RW); apEquipment(X, Z, dynRoot);

  // our plane at Gate 7, nose to the glass, with the jet bridge to its front door
  const ours = apPlane(AP_LIVERY[0], true); ours.g.userData.dyn = true; ours.g.position.set(X(9.8), 0, Z(-14 - AP_L / 2)); ours.g.rotation.y = -Math.PI / 2; scene.add(ours.g);
  const bridgeM = apMat('bridge', 0xe4e6e2, { roughness: .6 }), glassM = apMat('bgl', 0x5a7a90, { roughness: .2, metalness: .3 });
  box(1.8, 2.5, 6.6, bridgeM, X(12), 2.1, Z(-13.4)); box(1.84, .5, 6.4, glassM, X(12), 3.4, Z(-13.4), { cast: false });
  box(2.4, 2.6, 2.2, bridgeM, X(12.2), 2.05, Z(-17.2)); box(.5, 2.2, .5, apMat('dark', 0x30363e), X(12), 0, Z(-15.6)); box(1.6, .5, .8, apMat('dark', 0x30363e), X(12), 0, Z(-15.6));
  // service: a fuel truck, cones, a stairs truck at the rear door
  const truck = (x, z, ry, col) => { const t = new THREE.Group(); t.position.set(X(x), 0, Z(z)); t.rotation.y = ry; scene.add(t);
    const m = (w, h, d, mat, px, py, pz) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); k.position.set(px, py + h / 2, pz); k.castShadow = true; t.add(k); };
    m(1.6, 1.2, 1.7, apMat('cab' + col, col), 2, .4, 0); m(.1, .5, 1.4, glassM, 2.8, .9, 0); m(3.4, 1.3, 1.8, white, -.5, .4, 0);
    for (const [wx, wz] of [[2, .9], [2, -.9], [-1.4, .9], [-1.4, -.9]]) { const w = new THREE.Mesh(apOnce('vw', () => { const k = new THREE.CylinderGeometry(.38, .38, .3, 12); k.rotateX(Math.PI / 2); return k; }), apMat('dark', 0x30363e)); w.position.set(wx, .38, wz); t.add(w); } return t; };
  truck(16, -26, Math.PI / 2, 0xf2b53a);
  for (const [x, z] of [[8, -12.6], [11.6, -12.6], [17, -32], [2.6, -32]]) { const c = new THREE.Mesh(apOnce('cone', () => new THREE.ConeGeometry(.18, .5, 10)), apMat('cone', 0xff7a2a)); c.position.set(X(x), .25, Z(z)); scene.add(c); }

  const parked = [];
  // the concourse across the apron: low terminal, window band, jet bridges, light masts, planes at three of four gates
  const termM = apMat('term', 0xe8e2d6, { roughness: .7 }), roofM = apMat('roof', 0x8fa2b0, { roughness: .5 });
  box(84, 6, 8, termM, X(0), 0, Z(-88)); box(84.4, 1.8, .1, glassM, X(0), 2.2, Z(-83.95), { cast: false }); box(86, .6, 9, roofM, X(0), 6, Z(-88));
  for (let i = 0; i < 4; i++) {
    const gx = -30 + i * 20;
    box(1.6, 2.2, 8, bridgeM, X(gx + 2.4), 2.2, Z(-80)); box(.4, 2.2, .4, apMat('dark', 0x30363e), X(gx + 2.4), 0, Z(-78));
    gp(.22, 18, yellow, X(gx), Z(-66), .008);
    if (i === 1) continue;
    const p = apPlane(AP_LIVERY[(i + 1) % 4]); p.g.userData.dyn = true; p.g.position.set(X(gx), 0, Z(-75 + AP_L / 2)); p.g.rotation.y = Math.PI / 2; scene.add(p.g); parked.push(p);
  }
  for (const x of [-40, -20, 0, 20, 40]) { box(.35, 14, .35, apMat('pole', 0x8a9098), X(x), 0, Z(-82)); box(2.2, .3, .5, apMat('pole', 0x8a9098), X(x), 14, Z(-82)); for (const d of [-.7, 0, .7]) box(.5, .2, .4, apMat('lamp', 0xfff2c8, { emissive: 0xfff2c8, emissiveIntensity: .6 }), X(x + d), 13.8, Z(-81.9), { cast: false }); }
  // control tower and a curved hangar off to the sides
  const towerG = new THREE.Group(); towerG.userData.dyn = true; scene.add(towerG);
  { const scene = towerG;   // the stand-in tower, swapped for the kit's when the models arrive
    const tw = apMat('tower', 0xf0ebe0); const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 22, 18), tw); sh.position.set(X(72), 11, Z(-96)); sh.castShadow = true; scene.add(sh);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 3.2, 16), glassM); cab.position.set(X(72), 23.6, Z(-96)); scene.add(cab);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.2, .8, 16), apMat('main#ff7a6a', new THREE.Color('#ff7a6a'))); cap.position.set(X(72), 25.6, Z(-96)); scene.add(cap);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4, 6), apMat('pole', 0x8a9098)); ant.position.set(X(72), 28, Z(-96)); scene.add(ant); }
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 30, 24, 1, false, 0, Math.PI), apMat('hangar', 0xc8d4dc, { roughness: .4, metalness: .3 }));
    h.rotation.z = Math.PI / 2; h.rotation.y = Math.PI / 2; h.position.set(X(-78), 0, Z(-98)); h.castShadow = true; h.userData.dyn = true; scene.add(h); towerG.userData.hangar = h; }

  // two planes on one loop, half a loop apart: pushed back from the empty concourse gate by a tug, a slow taxi past the window,
  // takeoff, gone for a while, then a landing, the taxi back, and nose-in at the gate again where the tug waits
  const H = Math.PI / 2, G = -10, GZ = -75 + AP_L / 2;
  const route = apRoute([
    { a: [G, 0, GZ], b: [G, 0, -52], v0: 1, v1: 1.2, rev: true, tug: 'push' },          // pushback, tail first
    { arc: true, c: [-20, -52], R: 10, a0: 0, a1: H, v0: 1.2, v1: .6, rev: true, tug: 'push' },   // swung round onto the taxiway
    { wait: 6, tug: 'leave' },                                                            // towbar off, the tug drives away
    { a: [-20, 0, TW], b: [45, 0, TW], v0: 1.2, v1: 4 },                                  // the slow pass in front of the window
    { arc: true, c: [45, -52], R: 10, a0: H, a1: 0, v0: 4, v1: 5 },
    { a: [55, 0, -52], b: [55, 0, RW + 10], v0: 5, v1: 5 },
    { arc: true, c: [45, RW + 10], R: 10, a0: 0, a1: -H, v0: 5, v1: 3 },                  // lines up on the runway
    { wait: 5 },
    { a: [45, 0, RW], b: [-62, 0, RW], v0: .5, v1: 46 },                                 // takeoff roll
    { a: [-62, 0, RW], b: [-240, 50, RW], v0: 46, v1: 56 },                               // climb out to the west
    { wait: 22, hidden: true },
    { a: [230, 46, RW], b: [60, 0, RW], v0: 40, v1: 34 },                                 // final approach from the east
    { a: [60, 0, RW], b: [-30, 0, RW], v0: 34, v1: 8 },                                   // rollout
    { a: [-30, 0, RW], b: [-45, 0, RW], v0: 8, v1: 5 },
    { arc: true, c: [-45, RW + 10], R: 10, a0: -H, a1: -Math.PI, v0: 5, v1: 5 },
    { a: [-55, 0, RW + 10], b: [-55, 0, -52], v0: 5, v1: 5 },
    { arc: true, c: [-45, -52], R: 10, a0: Math.PI, a1: H, v0: 5, v1: 4 },
    { a: [-45, 0, TW], b: [-20, 0, TW], v0: 4, v1: 3 },
    { arc: true, c: [-20, -52], R: 10, a0: H, a1: 0, v0: 3, v1: 2 },                     // turns in to the gate
    { a: [G, 0, -52], b: [G, 0, GZ], v0: 2, v1: .3 },                                    // nose in, stops at the line
    { wait: 26, tug: 'park' },                                                            // parked; the tug arrives and hooks up
  ]);
  const movers = [0, .5].map((k, i) => { const p = apPlane(AP_LIVERY[i ? 2 : 4], true); p.g.userData.dyn = true; p.g.rotation.order = 'YZX'; dynRoot.add(p.g); return { ...p, off: k * route.T, pitch: 0, st: {}, tug: apTug(dynRoot) }; });
  window.__apron = { movers, route };   // for poking at from the console
  const tv = new THREE.Vector3();
  const local = (s, lx, lz) => tv.set(X(s.x) + Math.cos(s.yaw) * lx + Math.sin(s.yaw) * lz, 0, Z(s.z) - Math.sin(s.yaw) * lx + Math.cos(s.yaw) * lz);
  anim.push((t) => {
    if (typeof zone !== 'undefined' && zone !== 'airport') return;
    for (const m of movers) {
      const s = apAt(route, t + m.off, m.st);
      m.g.visible = !s.hidden;
      if (!s.hidden) {
        m.g.position.set(X(s.x), s.y, Z(s.z)); m.g.rotation.y = s.yaw;
        const want = s.climb > .01 ? s.climb : s.y > .5 ? .07 : 0;          // nose up on the climb, a gentle flare coming in
        m.pitch += (want - m.pitch) * .06; m.g.rotation.z = m.pitch;
        for (const gg of m.gear) gg.visible = s.y < 9;
        for (const f of m.fans) f.rotation.x = t * (s.p.tug ? 2 : 14);
      }
      // the tug: under the nose with its towbar on the nose wheel while hooked up; drives in from the side, away again after
      const tug = s.p.tug, k = s.f;
      let on = !!tug, lx = 10.4, lz = 0, ry = s.yaw + Math.PI;
      if (tug === 'park') { if (k < .5) on = false; else if (k < .8) { const e = (k - .5) / .3, q = 1 - e; lx = 10.4 + q * 6; lz = q * 9; ry = s.yaw + Math.PI + q * 1.2; } }
      if (tug === 'leave') { lx = 10.4 + k * 6; lz = -k * 10; ry = s.yaw + Math.PI - k * 1.3; if (k > .95) on = false; }
      m.tug.visible = on;
      if (on) { const p = local(s, lx, lz); m.tug.position.copy(p); m.tug.rotation.y = ry; m.tug.children[4].visible = t % .8 < .4; }
    }
    for (const f of ours.fans) f.rotation.x = t * .6;   // idling slowly at the gate
    AP_FLASH.strobe.emissiveIntensity = (t % 1.2 < .06 || (t % 1.2 > .14 && t % 1.2 < .2)) ? 3 : 0;   // double flash
    AP_FLASH.beacon.emissiveIntensity = .4 + 1.8 * Math.max(0, Math.sin(t * 5));
  });

  // a baggage train looping round our plane's rear: a tug and three carts on a rounded rectangle
  const loop = [[-1, -12], [-1, -33], [-6, -33], [-6, -12]], segs = []; let LL = 0;
  for (let i = 0; i < 4; i++) { const a = loop[i], b = loop[(i + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s0: LL }); LL += l; }
  const onLoop = (s) => { s = ((s % LL) + LL) % LL; const q = segs.find((g) => s < g.s0 + g.l) || segs[3], f = (s - q.s0) / q.l; return [q.a[0] + (q.b[0] - q.a[0]) * f, q.a[1] + (q.b[1] - q.a[1]) * f, Math.atan2(-(q.b[1] - q.a[1]), q.b[0] - q.a[0])]; };
  const train = [];
  const mk = (w, h, d, mat, y, p) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); k.position.y = y + h / 2; k.castShadow = true; p.add(k); return k; };
  { const t = new THREE.Group(); t.userData.dyn = true; mk(1.6, .7, 1.1, apMat('cab' + 0xf2b53a, 0xf2b53a), .25, t); mk(.7, .6, 1, glassM, .95, t).position.x = -.3; dynRoot.add(t); train.push(t); }
  for (let i = 0; i < 3; i++) { const t = new THREE.Group(); t.userData.dyn = true; mk(1.5, .5, 1, apMat('cart', 0x3a6ad0), .3, t); mk(1.5, .5, 1, apMat('bags', 0xc89a5a), .8, t).scale.set(.85, 1, .8); mk(1.6, .08, 1.1, apMat('cart', 0x3a6ad0), 1.4, t); dynRoot.add(t); train.push(t); }
  const wheels = apOnce('cw', () => { const k = new THREE.CylinderGeometry(.2, .2, .14, 10); k.rotateX(Math.PI / 2); return k; });
  for (const t of train) for (const [wx, wz] of [[.5, .5], [.5, -.5], [-.5, .5], [-.5, -.5]]) { const w = new THREE.Mesh(wheels, apMat('dark', 0x30363e)); w.position.set(wx, .2, wz); t.add(w); }
  anim.push((t) => {
    if (typeof zone !== 'undefined' && zone !== 'airport') return;
    train.forEach((c, i) => { const [x, z, yaw] = onLoop(t * 2.2 - i * 2); c.position.set(X(x), 0, Z(z)); c.rotation.y += (((yaw - c.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * .15; });
  });

  // puffy clouds drifting east, unfogged so they stay bright against the sky
  const cloudM = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa8b4, fog: false });
  const puff = new THREE.SphereGeometry(1, 14, 10), clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(); c.userData.dyn = true; const n = 4 + (i % 4), sc = 5 + (i * 37 % 7);
    for (let k = 0; k < n; k++) { const p = new THREE.Mesh(puff, cloudM); p.position.set((k - n / 2) * 1.3, Math.sin(k * 2.1) * .4 + (k % 2) * .5, Math.cos(k * 1.7) * .6); p.scale.setScalar(1 + ((k * 13) % 5) * .18); c.add(p); }
    c.scale.set(sc, sc * .6, sc * .8); c.position.set(-150 + i * 19, 15 + (i * 23 % 18), -135 - (i * 41 % 60)); c.userData.x0 = c.position.x; dynRoot.add(c); clouds.push(c);
  }
  anim.push((t) => { if (typeof zone !== 'undefined' && zone !== 'airport') return; for (const c of clouds) c.position.x = X(((c.userData.x0 + t * .7 + 160) % 320) - 160); });
  TF.zoneEnv.airport = { near: 60, far: 215 };
  // the real models (airport-assets.js) replace the stand-ins the first time you come in
  const swap = (p, name, len) => { const m = apAsset(name, len); if (!m) return; for (const c of [...p.g.children]) p.g.remove(c); p.g.add(m); p.gear = []; p.fans = []; };
  TF.on('enter', (prev, z) => { if (z === 'airport') apWhenAssets(() => {
    if (swap.done) return; swap.done = true;
    swap(ours, 'a320', 21);                                                        // the A320 at Gate 7
    [['183Airplane', 22], ['181Airplane', 21], ['182Airplane', 25]].forEach(([n, l], i) => parked[i] && swap(parked[i], n, l));
    swap(movers[0], '184Airplane', 19); swap(movers[1], '181Airplane', 21);
    for (const c of [...towerG.children]) towerG.remove(c); towerG.userData.hangar.visible = false;
    apPlace('02ControlTower', X(72), Z(-96), 0, null, .32); apPlace('04Hangar', X(-78), Z(-100), 0, 40);
    apApronKit(X, Z);
  }); });
}

// airport lounge chairs (like the long recliners by the gates): one shaped navy cushion running from a padded headrest down a
// reclined back, a flat seat and a sloping leg rest, on a pale wood shell, with an aluminium armrest and a splayed cast foot.
// Built from a side profile extruded across the width. Facing the glass (feet towards it, -z).
const LOUNGE_PATH = [[-.55, 1.24], [-.42, 1.0], [-.13, .5], [0, .45], [.38, .44], [.62, .4], [1.02, .3]];   // (forward, height) along the top of the cushion
function apBand(path, off, t, width, bevel) {
  const nrm = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [-dy / l, dx / l];
  });
  const top = path.map((p, i) => [p[0] - nrm[i][0] * off, p[1] - nrm[i][1] * off]), bot = path.map((p, i) => [p[0] - nrm[i][0] * (off + t), p[1] - nrm[i][1] * (off + t)]);
  const pts = top.concat(bot.reverse());
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))), { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateY(Math.PI / 2); g.translate(-width / 2, 0, 0); return g;   // forward -> -z, across -> x
}
function apLoungeChair(x, z) {
  const navy = apMat('cognac', 0x8a4e2a, { roughness: .75 }), navyDk = apMat('cognacDk', 0x5e321a, { roughness: .8 }), wood = apMat('ash', 0xc89a6a, { roughness: .55 });   // cognac leather on a warm ash shell
  const alu = apMat('alu', 0xc4cad2, { roughness: .3, metalness: .6 });
  const put = (geo, m, px, py, pz) => { const k = new THREE.Mesh(geo, m); k.position.set(x + px, py, z + pz); k.castShadow = true; k.receiveShadow = true; scene.add(k); return k; };
  put(apOnce('lgCush', () => apBand(LOUNGE_PATH, 0, .085, .58, .025)), navy, 0, 0, 0);
  put(apOnce('lgShell', () => apBand(LOUNGE_PATH, .11, .04, .64, .012)), wood, 0, 0, 0);
  put(apOnce('lgHead', () => apBand(LOUNGE_PATH.slice(0, 3), -.05, .07, .54, .03)), navyDk, 0, 0, 0);   // the darker head pad, a little proud
  // aluminium armrest on the right: a flat bar on a swept strut down to the shell
  put(apOnce('lgArm', () => new THREE.BoxGeometry(.07, .05, .5)), alu, .36, .7, -.05);
  const st = put(apOnce('lgStrut', () => new THREE.BoxGeometry(.06, .34, .06)), alu, .35, .52, -.24); st.rotation.x = .5;
  const st2 = put(apOnce('lgStrut', () => new THREE.BoxGeometry(.06, .34, .06)), alu, .35, .52, .14); st2.rotation.x = -.4;
  // cast hub and splayed feet with black glides
  put(apOnce('lgHub', () => new THREE.SphereGeometry(.11, 14, 10)), alu, 0, .24, -.2);
  for (const [dx, dz] of [[.26, -.55], [-.26, -.55], [.26, .2], [-.26, .2]]) {
    const leg = put(apOnce('lgLeg', () => new THREE.CylinderGeometry(.035, .045, .38, 10)), alu, dx / 2, .13, -.2 + dz / 2 - .1);
    leg.rotation.set(-dz * 1.1, 0, dx * 1.6);
    put(apOnce('lgGlide', () => new THREE.CylinderGeometry(.06, .06, .03, 12)), navyDk, dx * .95, .015, -.3 + dz * .95);
  }
}
function apSideTable(x, z) {
  const top = apMat('walnut', 0x6a4428, { roughness: .6 }), alu = apMat('alu', 0xc4cad2, { roughness: .3, metalness: .6 });
  box(.5, .05, .62, top, x, .5, z); box(.07, .5, .07, alu, x, 0, z); box(.36, .03, .36, alu, x, 0, z);
}
// the row by the glass; E in reach of any chair sits you in that one, facing the planes, the camera over your shoulder.
// E, Esc or any move key stands you up again, just behind the chair.
function apLoungeRow(X, Z) {
  // the window lounge, after the warm modern gate lounges: four cognac lounge chairs, a tan sofa with two round ottomans and a low
  // table, a high table with stools, all on the warm carpet (gateSeven lays it); every seat can be sat in
  const zc = -6.4, xs = [.8, 2.2, 3.6, 5.0];
  for (const x of xs) apLoungeChair(X(x), Z(zc));
  for (const x of [2.9, 5.85]) apSideTable(X(x), Z(zc - .1));
  colBox(X(.2), Z(zc - 1.1), X(6.2), Z(zc + .6));
  // the sofa: chunky tan cushions on a walnut plinth, facing the glass; ottomans and a low round table in front
  const tan = apMat('sofaTan', 0xc8925a, { roughness: .85 }), tanDk = apMat('sofaTanDk', 0xa8743e, { roughness: .9 }), walnut = apMat('walnut', 0x6a4428, { roughness: .6 }), rust = apMat('ottoRust', 0xc8642e, { roughness: .9 });
  const sx = -2.0, sz = -5.9;
  box(2.9, .14, .95, walnut, X(sx), .06, Z(sz)); box(2.8, .26, .9, tanDk, X(sx), .2, Z(sz));
  for (const k of [-1, 0, 1]) box(.88, .18, .78, tan, X(sx + k * .9), .44, Z(sz - .04));
  for (const k of [-1, 0, 1]) box(.86, .5, .24, tan, X(sx + k * .9), .5, Z(sz + .34));
  for (const s2 of [-1, 1]) box(.24, .62, .92, tanDk, X(sx + s2 * 1.45), .2, Z(sz));
  colBox(X(sx - 1.6), Z(sz - .5), X(sx + 1.6), Z(sz + .5));
  for (const [ox, oz, m] of [[-2.85, -7.55, rust], [-1.15, -7.7, tan]]) {
    const o = new THREE.Mesh(apOnce('otto', () => new THREE.CylinderGeometry(.36, .38, .4, 24)), m); o.position.set(X(ox), .2, Z(oz)); o.castShadow = true; o.receiveShadow = true; scene.add(o);
    const t = new THREE.Mesh(apOnce('ottoTop', () => { const k = new THREE.SphereGeometry(.36, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); k.scale(1, .22, 1); return k; }), m); t.position.set(X(ox), .4, Z(oz)); scene.add(t);
    colCirc(X(ox), Z(oz), .42);
  }
  { const t = new THREE.Mesh(apOnce('lowTable', () => new THREE.CylinderGeometry(.42, .42, .05, 28)), walnut); t.position.set(X(-2.0), .38, Z(-8.5)); t.castShadow = true; scene.add(t);
    box(.08, .36, .08, walnut, X(-2.0), 0, Z(-8.5)); colCirc(X(-2.0), Z(-8.5), .45); }
  // a high round table with three stools by the glass, near the gate
  { const hx = 7.5, hz = -8.5, steel = apMat('alu', 0xc4cad2, { roughness: .3, metalness: .6 }), olive = apMat('stoolSeat', 0x8a8a5a, { roughness: .8 });
    const top = new THREE.Mesh(apOnce('hiTop', () => new THREE.CylinderGeometry(.55, .55, .05, 28)), walnut); top.position.set(X(hx), 1.05, Z(hz)); top.castShadow = true; scene.add(top);
    box(.14, 1.03, .14, walnut, X(hx), 0, Z(hz)); box(.6, .04, .6, walnut, X(hx), 0, Z(hz));
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + .5, x = X(hx) + Math.cos(a) * .85, z = Z(hz) + Math.sin(a) * .85;
      const seat = new THREE.Mesh(apOnce('stool', () => new THREE.CylinderGeometry(.2, .18, .08, 18)), olive); seat.position.set(x, .74, z); seat.castShadow = true; scene.add(seat);
      for (const [dx, dz] of [[.12, .12], [-.12, .12], [.12, -.12], [-.12, -.12]]) box(.03, .72, .03, steel, x + dx, 0, z + dz, { cast: false }); }
    colCirc(X(hx), Z(hz), 1.1); }
  // sitting: E near any seat; E, Esc or a move key stands you up behind it
  let sitting = null, since = 0;
  const stand = () => { if (!sitting) return; hero.y = sitting.back; sitting = null; TF.lockPlayer(false); TF.cameraRestore(900); };
  window.addEventListener('keydown', (e) => {
    if (!sitting || performance.now() - since < 400) return;
    if (['e', 'E', 'Escape', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) { e.stopPropagation(); stand(); }
  }, true);
  const seat = (x, z, back, label, msg) => INTER.push({ x: X(x), z: Z(z + .6), r: 1.45, label, verb: 'Sit', act: () => {
    sitting = { back: Z(back) }; since = performance.now();
    hero.x = X(x); hero.y = Z(z - .15); hero.dir = 'up'; TF.lockPlayer(true);
    TF.cameraTo(new THREE.Vector3(X(x + 1.25), 2.35, Z(z + 3.1)), new THREE.Vector3(X(x - .3), 4.2, Z(-60)), 1400, 54);
    log('', msg, true);
  } });
  for (const x of xs) seat(x, zc, zc + 1.05, 'Lounge chair', '🛋️ You sink into the lounge chair and watch the planes. Press E or Esc to stand up.');
  for (const k of [-1, 0, 1]) seat(sx + k * .9, sz, sz + 1.0, 'Sofa', '🛋️ You settle into the sofa with a view of the apron. Press E or Esc to stand up.');
}
// the kit's vehicles and furniture, placed once the models are in: ground vehicles on the apron, and bins, ad stands, a kiosk,
// and an extinguisher inside the hall
function apApronKit(X, Z) {
  const put = (n, x, z, ry, len, k) => apPlace(n, X(x), Z(z), ry, len, k);
  put('20PassengerBus', -22, -60, 0, 12);
  put('19Firetruck', 62, -88, Math.PI / 2, 6.5);
  put('211BaggageTruck', -14, -28, Math.PI / 2, 3.6); put('212BaggageTruck', -36, -63, 0, 3.4); put('213BaggageTruck', -40.5, -63, 0, 3.4);
  for (let i = 0; i < 5; i++) put(['05Container', '05Container2', '05Container3', '05Container4', '05Container5'][i], -70 + i * 3.2, -84, 0, 2.8);
  put('03AirplaneStairs', 33.5, -58, Math.PI / 2, 5.5);
  // inside the hall (it spans x -16..16, z -10..10)
  for (const [x, z] of [[-13.6, 5.8], [-15.3, 3.4]]) put('14Trashcan', x, z, 0, null, 1);
  for (const [x, z, ry] of [[-15.3, 1.2, Math.PI / 2], [15.3, 1.2, -Math.PI / 2], [15.3, -4.5, -Math.PI / 2]]) { put('15Advertising', x, z, ry, null, 1); colBox(X(x) - .5, Z(z) - .8, X(x) + .5, Z(z) + .8); }
  put('174Model', -15.3, -.8, Math.PI / 2, null, 1); colBox(X(-15.7), Z(-1.3), X(-14.9), Z(-.3));
  put('176Model', 15.6, 3.2, -Math.PI / 2, null, 1);
}
