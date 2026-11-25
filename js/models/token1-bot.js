// TokenFall: TOKEN-1's body, a chunky toy robot in the lobby's soft style. A squircle TV head with a glossy visor (two glowing eyes that blink and
// glance about, a smile, blush), dial ears, a springy antenna whose amber bulb blinks; a round tummy with a porthole where a little Calfus token
// spins, a five-light repair meter under it (lit by TOKEN-1's accuracy), a wind-up key turning on its back and a name plate on the back of its head.
// It is broken, so a plaster sits on its head and now and then it glitches: eyes go amber and squint, a spark pops. It hovers in a teal cup on a
// flickering thruster. vaiGreeter (village-ai.js) builds it; token1.js drives g / body / head / arms / tip (follow, bob, wave, bulb).
// Classic script: shares one global scope with the other js/game files, loaded before main.js builds the world.

// a rounded box with one smooth surface (a superellipsoid): k 1 is an ellipsoid, smaller k is boxier. Normals are exact, so there is no seam
function t1Squircle(w, h, d, k = .5, seg = 40) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)), p = g.attributes.position, n = g.attributes.normal, A = [w / 2, h / 2, d / 2];
  const sg = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const u = [p.getX(i), p.getY(i), p.getZ(i)], q = u.map((c, j) => sg(c, k) * A[j]), nn = u.map((c, j) => sg(c, 2 - k) / A[j]), l = Math.hypot(...nn) || 1;
    p.setXYZ(i, q[0], q[1], q[2]); n.setXYZ(i, nn[0] / l, nn[1] / l, nn[2] / l);
  }
  return g;
}
// where a squircle's front (side = 1) or back (side = -1) surface is at (x, y) from its centre, and which way it faces there
function t1Surface(S, x, y, side = 1) {
  const m = 2 / S.k, a = S.w / 2, b = S.h / 2, c = S.d / 2, fx = Math.pow(Math.abs(x / a), m), fy = Math.pow(Math.abs(y / b), m);
  const z = side * c * Math.pow(Math.max(0, 1 - fx - fy), 1 / m);
  const sg = (v) => Math.sign(v) * Math.pow(Math.abs(v), m - 1);
  const n = new THREE.Vector3(sg(x / a) / a, sg(y / b) / b, sg(z / c) / c).normalize();
  return { z, n };
}
// a mesh stuck onto a squircle's surface, facing out along it; lift raises it off the surface
const T1_Z = new THREE.Vector3(0, 0, 1);
function t1Stick(parent, S, cy, mesh, x, y, lift = 0, side = 1) {
  const s = t1Surface(S, x, y, side);
  mesh.position.set(x + s.n.x * lift, cy + y + s.n.y * lift, s.z + s.n.z * lift); mesh.quaternion.setFromUnitVectors(T1_Z, s.n);
  parent.add(mesh); return mesh;
}

function token1Bot(x, z) {
  const once = (k, f) => (typeof vOnce === 'function' ? vOnce('t1' + k, f) : f());
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: 0 }, o));
  const M = {
    shell: once('shell', () => mat(0xf8f2e6, { roughness: .42 })),
    accent: once('accent', () => mat(0x74c4cf, { roughness: .45 })),
    accentDeep: once('accentDeep', () => mat(0x4f9fb0, { roughness: .5 })),
    visor: once('visor', () => mat(0x26304a, { roughness: .18 })),
    joint: once('joint', () => mat(0x9a8ea0, { roughness: .6 })),
    gold: MAT.gold,
    eye: once('eye', () => new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x8fe8ff, emissiveIntensity: 1.5 })),
    eyeOdd: once('eyeOdd', () => new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6 })),
    white: once('white', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 })),
    cheek: once('cheek', () => new THREE.MeshStandardMaterial({ color: 0xff9fb0, emissive: 0xff7f98, emissiveIntensity: .55, transparent: true, opacity: .9 })),
    plaster: once('plaster', () => mat(0xf1c39e, { roughness: .8 })),
    pad: once('pad', () => mat(0xfbe6d2, { roughness: .9 })),
    glass: once('glass', () => mat(0x1d2740, { roughness: .12 })),
    ledOff: once('ledOff', () => mat(0x3a3f55, { roughness: .4 })),
    ledR: once('ledR', () => new THREE.MeshStandardMaterial({ color: 0xff8a8a, emissive: 0xff5a6a, emissiveIntensity: 1.6 })),
    ledY: once('ledY', () => new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.5 })),
    ledG: once('ledG', () => new THREE.MeshStandardMaterial({ color: 0x9ff0b8, emissive: 0x5fe08a, emissiveIntensity: 1.5 })),
  };
  const mesh = (geo, m, p, cast = true) => add(new THREE.Mesh(geo, m), p, cast);
  const sphere = (r, m, p, px, py, pz, s = [1, 1, 1]) => { const o = mesh(new THREE.SphereGeometry(r, 24, 16), m, p); o.position.set(px, py, pz); o.scale.set(...s); return o; };
  const lathe = (pts, m, p, seg = 48) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m, p);

  const g = new THREE.Group(); g.userData.dyn = true; g.position.set(x, 0, z); scene.add(g);
  const body = new THREE.Group(); g.add(body);

  // ---- the hover cup and its thruster ----
  lathe([[0, .3], [.15, .3], [.25, .33], [.32, .4], [.37, .5], [.395, .6], [.4, .66], [.37, .68]], M.accent, body);
  const trim = mesh(new THREE.TorusGeometry(.392, .026, 10, 48), M.gold, body); trim.rotation.x = Math.PI / 2; trim.position.y = .665;
  for (let i = 0; i < 8; i++) {   // little rivets round the cup
    const a = i / 8 * Math.PI * 2 + .2; sphere(.022, M.accentDeep, body, Math.sin(a) * .34, .45, Math.cos(a) * .34);
  }
  const jet = mesh(new THREE.CylinderGeometry(.12, .15, .05, 24), M.joint, body); jet.position.y = .29;
  const jetGlow = mesh(new THREE.CircleGeometry(.1, 24), M.eye, body, false); jetGlow.rotation.x = Math.PI / 2; jetGlow.position.y = .264;
  const flameMat = once('flame', () => new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.09, .26, 16, 1, true), flameMat); flame.rotation.x = Math.PI; flame.position.y = .14; body.add(flame);

  // ---- the tummy: porthole with a spinning token, the repair meter, a vent and the wind-up key behind ----
  const T = { w: .8, h: .74, d: .68, k: .7 }, TY = .88;
  const torso = mesh(t1Squircle(T.w, T.h, T.d, T.k), M.shell, body); torso.position.y = TY;
  const port = new THREE.Group(); t1Stick(body, T, TY, port, 0, .06, 0);
  const rim = mesh(new THREE.TorusGeometry(.135, .032, 12, 40), M.gold, port); rim.position.z = .012;
  const win = mesh(new THREE.CircleGeometry(.13, 32), M.glass, port, false); win.position.z = .006;
  const coinFace = once('coinFace', () => std(TX.coin, 0, { emissive: 0xffffff, emissiveMap: TX.coin, emissiveIntensity: .45, roughness: .4 }));
  const coin = mesh(new THREE.CylinderGeometry(.085, .085, .022, 32), [M.gold, coinFace, coinFace], port, false); coin.rotation.x = Math.PI / 2; coin.position.z = .04;
  const coinSpin = new THREE.Group(); port.add(coinSpin); coinSpin.position.z = .04; coin.position.z = 0; coinSpin.add(coin);
  const shine = mesh(new THREE.TorusGeometry(.1, .012, 6, 16, Math.PI * .45), M.white, port, false); shine.position.z = .03; shine.rotation.z = Math.PI * .55;
  const leds = [];
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(t1Squircle(.045, .028, .03, .45, 16), M.ledOff); leds.push(t1Stick(body, T, TY, l, (i - 2) * .062, -.2, .006)); }
  for (let i = 0; i < 3; i++) t1Stick(body, T, TY, new THREE.Mesh(t1Squircle(.2, .022, .03, .4, 16), M.joint), -.13, -.06 + i * .05, .002, -1);   // vent slots on the back
  const key = new THREE.Group(); t1Stick(body, T, TY, key, 0, .1, 0, -1);
  const stem = mesh(new THREE.CylinderGeometry(.026, .026, .16, 12), M.gold, key); stem.rotation.x = Math.PI / 2; stem.position.z = .07;
  const bow = new THREE.Group(); bow.position.z = .16; key.add(bow);
  for (const s of [-1, 1]) { const lobe = mesh(new THREE.TorusGeometry(.065, .026, 10, 24), M.gold, bow); lobe.position.x = s * .085; }
  sphere(.04, M.gold, bow, 0, 0, 0);

  // ---- neck ----
  const neck = mesh(new THREE.CylinderGeometry(.11, .13, .2, 20), M.joint, body); neck.position.y = 1.29;
  for (const y of [1.25, 1.33]) { const r = mesh(new THREE.TorusGeometry(.12, .018, 8, 24), M.accentDeep, body); r.rotation.x = Math.PI / 2; r.position.y = y; }

  // ---- head: squircle TV with a visor face ----
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); body.add(head);
  const H = { w: .92, h: .66, d: .7, k: .5 }, HY = .34;
  const skull = mesh(t1Squircle(H.w, H.h, H.d, H.k), M.shell, head); skull.position.y = HY;
  const bezel = mesh(t1Squircle(.76, .5, .14, .45), M.accent, head); bezel.position.set(0, HY - .01, t1Surface(H, 0, -.01).z - .05);
  const F = { w: .66, h: .42, d: .16, k: .45 }, FZ = bezel.position.z + .005, FY = HY - .01;
  const visor = mesh(t1Squircle(F.w, F.h, F.d, F.k), M.visor, head); visor.position.set(0, FY, FZ);
  const face = new THREE.Group(); head.add(face); face.position.set(0, FY, FZ);
  const onFace = (m, fx, fy, lift = .004) => { const s = t1Surface(F, fx, fy); m.position.set(fx, fy, s.z + lift); m.quaternion.setFromUnitVectors(T1_Z, s.n); face.add(m); return m; };
  const eyeRig = new THREE.Group(); face.add(eyeRig);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.eye); const p = t1Surface(F, s * .14, .035);
    e.position.set(s * .14, .035, p.z - .004); e.scale.set(.068, .092, .028); eyeRig.add(e);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(.019, 12, 8), M.white); hi.position.set(s * .14 + .022, .07, p.z + .022); eyeRig.add(hi);
    return { e, hi };
  });
  const smile = onFace(new THREE.Mesh(new THREE.TorusGeometry(.045, .011, 8, 20, Math.PI), M.eye), 0, -.08, .006); smile.rotateZ(Math.PI);
  for (const s of [-1, 1]) { const c = onFace(new THREE.Mesh(new THREE.CircleGeometry(.045, 20), M.cheek), s * .225, -.06, .006); c.scale.set(1, .62, 1); }
  // the name plate on the back of the head
  const plateTex = once('plateTex', () => canvasTex(256, 64, (c) => {
    c.fillStyle = '#4f9fb0'; c.beginPath(); c.roundRect ? c.roundRect(4, 4, 248, 56, 22) : c.rect(4, 4, 248, 56); c.fill();
    c.fillStyle = '#fff8ec'; c.font = '700 38px Fredoka, "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TOKEN-1', 128, 34);
  }, { smooth: true, keep: true }));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.4, .1), once('plate', () => new THREE.MeshStandardMaterial({ map: plateTex, transparent: true, roughness: .6 })));
  t1Stick(head, H, HY, plate, 0, .02, .006, -1); plate.rotateZ(Math.PI);   // the half-turn onto the back leaves it upside down
  // ears: dials, one of them turning
  const ears = [-1, 1].map((s) => {
    const ear = new THREE.Group(); ear.position.set(s * (H.w / 2 - .01), HY, 0); head.add(ear);
    const can = mesh(new THREE.CylinderGeometry(.13, .14, .09, 28), M.accent, ear); can.rotation.z = Math.PI / 2; can.position.x = s * .04;
    const dial = new THREE.Group(); dial.position.x = s * .095; ear.add(dial);
    const cap = mesh(new THREE.CylinderGeometry(.085, .085, .03, 24), M.gold, dial); cap.rotation.z = Math.PI / 2;
    const notch = mesh(new THREE.BoxGeometry(.02, .1, .025), M.accentDeep, dial); notch.position.x = s * .016;
    return dial;
  });
  // the plaster on top of its head
  const top = t1Surface({ w: H.w, h: H.d, d: H.h, k: H.k }, -.2, .1);
  const aid = new THREE.Group(); aid.position.set(-.2, HY + top.z + .004, .1); head.add(aid);
  for (const r of [.55, -.55]) { const b = mesh(t1Squircle(.24, .014, .075, .3, 16), M.plaster, aid); b.rotation.y = r; }
  const padM = mesh(t1Squircle(.07, .02, .06, .3, 12), M.pad, aid); padM.position.y = .004;
  // antenna: a gold socket, a coiled spring and the amber bulb (token1.js blinks the bulb: parts.tip)
  const antenna = new THREE.Group(); antenna.position.set(.12, HY + H.h / 2 - .02, -.04); head.add(antenna);
  sphere(.06, M.gold, antenna, 0, 0, 0, [1, .6, 1]);
  const coil = new THREE.Curve(); coil.getPoint = (u, out = new THREE.Vector3()) => out.set(Math.cos(u * Math.PI * 10) * .028, .02 + u * .2, Math.sin(u * Math.PI * 10) * .028);
  mesh(new THREE.TubeGeometry(coil, 120, .01, 6), M.joint, antenna);
  const tip = sphere(.07, glowStrip(0xffb347), antenna, 0, .28, 0); tip.castShadow = false;
  sphere(.025, M.white, tip, -.025, .03, .04);

  // ---- arms: a shoulder ball, a soft upper arm, an elbow, a mitten hand with a thumb ----
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * .49, 1.06, 0); body.add(a);
    sphere(.11, M.accent, a, 0, 0, 0);
    const up = mesh(new THREE.CylinderGeometry(.06, .055, .24, 16), M.shell, a); up.position.y = -.17;
    sphere(.065, M.joint, a, 0, -.31, 0);
    const fore = mesh(new THREE.CylinderGeometry(.055, .05, .12, 16), M.shell, a); fore.position.y = -.38;
    sphere(.1, M.shell, a, 0, -.49, 0, [.9, 1, .78]);
    sphere(.042, M.shell, a, -s * .07, -.46, .04);
    const cuff = mesh(new THREE.TorusGeometry(.058, .016, 8, 20), M.accent, a); cuff.rotation.x = Math.PI / 2; cuff.position.y = -.42;
    return a;
  });

  // a soft glow on the ground under it says it hovers
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowDisc(V_LED)); glow.rotation.x = -Math.PI / 2; glow.position.y = .03; g.add(glow);
  // the glitch spark: a little four-point star that pops off the plaster
  const sparkTex = once('spark', () => canvasTex(64, 64, (c) => {
    const r = c.createRadialGradient(32, 32, 0, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,230,1)'); r.addColorStop(.25, 'rgba(255,220,120,.9)'); r.addColorStop(1, 'rgba(255,180,60,0)');
    c.fillStyle = r; c.beginPath(); c.moveTo(32, 0); c.quadraticCurveTo(36, 28, 64, 32); c.quadraticCurveTo(36, 36, 32, 64); c.quadraticCurveTo(28, 36, 0, 32); c.quadraticCurveTo(28, 28, 32, 0); c.fill();
  }, { smooth: true, keep: true }));
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); spark.visible = false; head.add(spark);

  // ---- little life: blinking, glancing, the key, the coin, the spring, the thruster, the meter and a glitch now and then ----
  const accuracy = () => { try { const a = TF.token1 && TF.token1.accuracy; const v = typeof a === 'function' ? a() : a; return typeof v === 'number' ? v : 12; } catch (e) { return 12; } };
  let nextBlink = 2, nextGlitch = 6 + Math.random() * 6, glitchEnd = -1;
  anim.push((t) => {
    if (!g.visible) return;
    // blink (sometimes twice), squint while glitching
    if (t > nextBlink + .5) nextBlink = t + 2.4 + Math.random() * 2.6 + (Math.random() < .25 ? -2.25 : 0);
    const bk = t > nextBlink ? Math.min(1, Math.abs((t - nextBlink) / .07 - 1)) : 1, glitching = t < glitchEnd;
    const open = glitching ? .3 : Math.max(.08, bk);
    eyes.forEach(({ e, hi }) => { e.scale.y = .092 * open; e.material = glitching ? M.eyeOdd : M.eye; hi.visible = open > .5; });
    eyeRig.position.x = Math.sin(t * .53) * Math.sin(t * .21) * .03; eyeRig.position.y = Math.sin(t * .37) * .008;
    head.rotation.z = Math.sin(t * .9) * .04 + (glitching ? Math.sin(t * 60) * .03 : 0);
    head.rotation.x = Math.sin(t * .6) * .03;
    antenna.rotation.x = Math.sin(t * 3.1) * .1; antenna.rotation.z = Math.sin(t * 2.3) * .12;
    bow.rotation.z = -t * 1.6; coinSpin.rotation.y = t * 2.2; ears[0].rotation.x = t * .9; ears[1].rotation.x = Math.sin(t * .5) * .6;
    flame.scale.set(1, .8 + Math.sin(t * 31) * .12 + Math.sin(t * 17.3) * .1, 1); flameMat.opacity = .38 + Math.sin(t * 23) * .08;
    // the meter: one light per 20% accuracy; red, then amber, then green; the top lit one flickers, it is still unsure
    const lit = Math.max(1, Math.min(5, Math.ceil(accuracy() / 20))), on = lit <= 1 ? M.ledR : lit <= 3 ? M.ledY : M.ledG;
    leds.forEach((l, i) => { l.material = i < lit && !(i === lit - 1 && Math.sin(t * 9) > .55) ? on : M.ledOff; });
    // a glitch: amber squint and a spark off the plaster for a third of a second
    if (t > nextGlitch) { glitchEnd = t + .35; nextGlitch = t + 7 + Math.random() * 8; }
    spark.visible = glitching;
    if (glitching) { const k = (glitchEnd - t) / .35; spark.position.set(-.2 + Math.sin(t * 40) * .03, HY + .42 + (1 - k) * .1, .1); spark.scale.setScalar(.12 + k * .16); spark.material.rotation = t * 6; }
  });
  return { g, body, head, arms, tip };
}
