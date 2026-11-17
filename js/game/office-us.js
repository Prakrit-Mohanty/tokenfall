// TokenFall: Calfus US office, Pleasanton, California (zone "us"), laid out from photos taken in the middle of the floor.
//   north: the window wall (red-brown frames, blinds) with white columns; west: windows at the north end, then white wall
//   desks: butcher-block sit-stand pods along the windows and by the west wall, vine poles and potted plants between them
//   east: the exit door and the Calfus logo wall, the ping-pong table in front of it
//   south-east corner: the tall whiteboard wall and fern, the half wall with the plaque, the Silverton and Mission doors
//   south, from the east: the glass meeting room, the printer, two phone booths, the kitchen whiteboard, the kitchenette,
//   the teal wall, and the Diablo door
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const US_HALF = [10, 7.5];
const US_EXIT = [8.3, -5.6];

function usMaterials() {
  const carpet = pOnce('usCarpet', () => std(canvasTex(32, 32, (g) => { g.fillStyle = '#7a7670'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 160; i++) { g.fillStyle = ['#6e6a64', '#86827a', '#73706a'][i % 3]; g.fillRect(rnd() * 32 | 0, rnd() * 32 | 0, 1, 1); } }, { nearest: true }), 1.5, { roughness: 1 }));
  const maple = pOnce('usMaple', () => std(canvasTex(32, 16, (g) => { for (let x = 0; x < 32; x += 4) { g.fillStyle = ['#d8b482', '#cfa874', '#e0bd8c', '#c89e6a'][(x / 4) % 4]; g.fillRect(x, 0, 4, 16); } g.fillStyle = 'rgba(120,80,40,.25)'; for (let x = 0; x < 32; x += 4) g.fillRect(x, 0, 1, 16); }, { nearest: true }), .6, { roughness: .6 }));
  const frame = pOnce('usFrame', () => new THREE.MeshStandardMaterial({ color: 0x7a3020, roughness: .6 }));
  const teal = pOnce('usTeal', () => new THREE.MeshStandardMaterial({ color: 0x2ab3a6, roughness: .8 }));
  const door = pOnce('usDoor', () => std(canvasTex(16, 32, (g) => { g.fillStyle = '#8a4a26'; g.fillRect(0, 0, 16, 32); for (let i = 0; i < 40; i++) { g.fillStyle = ['#7a3e1e', '#9a5a32'][i % 2]; g.fillRect(rnd() * 16 | 0, rnd() * 32 | 0, 1, 3); } }, { nearest: true }), 0, { roughness: .5 }));
  const white = pOnce('usWall', () => new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: .85 }));
  const board = pOnce('usBoard', () => std(canvasTex(256, 128, (g) => {
    g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 256, 128);
    const ink = (c, w = 2) => { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w; };
    g.font = '600 10px "Pixelify Sans", monospace';
    ink('#1c1c20'); for (const [x, y, t] of [[14, 20, 'prompt'], [76, 20, 'model'], [138, 20, 'answer'], [200, 20, 'check']]) { g.strokeRect(x - 4, y - 10, 46, 16); g.fillText(t, x, y + 1); }
    for (const x of [56, 118, 180]) { g.beginPath(); g.moveTo(x, 15); g.lineTo(x + 16, 15); g.lineTo(x + 12, 12); g.moveTo(x + 16, 15); g.lineTo(x + 12, 18); g.stroke(); }
    ink('#c0392b'); g.fillText('tokens:', 14, 52); ['To', 'ken', 'Fall', ' is', ' fun'].forEach((t, i) => { g.strokeRect(62 + i * 30, 42, 28, 14); g.fillText(t, 64 + i * 30, 52); });
    ink('#2a6aa0'); g.fillText('sure != right', 14, 80); g.beginPath(); g.moveTo(14, 84); g.lineTo(96, 84); g.stroke();
    ink('#2a8a4a'); g.fillText('context in -> better out', 120, 80); g.beginPath(); g.arc(200, 108, 14, 0, 6.3); g.stroke(); g.fillText('RAG?', 186, 112);
    ink('#1c1c20', 1); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(20 + i * 16, 120); g.lineTo(28 + i * 16, 104 - i * 3); g.stroke(); }
  }, { nearest: true }), 0, { roughness: .3 }));
  return { carpet, maple, frame, teal, door, white, board };
}

// a sit-stand desk: maple top, grey T-legs, a big monitor, a black mesh chair; dir is the way the person faces (+1/-1 along z)
function usDesk(x, z, dir, M, p) {
  box(1.5, .05, .75, M.maple, x, .72, z, { p });
  for (const s of [-1, 1]) { box(.08, .72, .08, MAT.metal, x + s * .62, 0, z, { p }); box(.08, .04, .7, MAT.metal, x + s * .62, 0, z, { p }); }
  box(.9, .45, .04, MAT.charcoal, x, .95, z - dir * .25, { p }); box(.84, .4, .02, nextScreen(), x, .97, z - dir * .225, { p });
  box(.06, .22, .06, MAT.charcoal, x, .77, z - dir * .27, { p });
  keyboardAt(x, .77, z + dir * .05, dir, p); deskClutter(x + .5, .77, z + dir * .15, p);
  chair(x, z + dir * .75, dir, p);
  if (rnd() < .3) { const t = add(new THREE.Mesh(new THREE.BoxGeometry(.18, .14, .18), MAT.pink), p); t.position.set(x - .55, .84, z + dir * .1); }
  box(.9, .02, .6, MAT.charcoal, x, 0, z + dir * .75, { p, cast: false });
}

// back-to-back pod: `n` desks per side; along = 'x' runs the pod east-west, 'z' north-south
function usPod(x, z, n, along, M) {
  const g = new THREE.Group(); g.position.set(x, 0, z); if (along === 'z') g.rotation.y = Math.PI / 2; scene.add(g);
  for (let i = 0; i < n; i++) for (const side of [-1, 1]) usDesk(-((n - 1) * 1.6) / 2 + i * 1.6, side * .4, side, M, g);
  const hx = n * .8 + .2, hz = 1.6;
  along === 'z' ? colBox(x - hz, z - hx, x + hz, z + hx) : colBox(x - hx, z - hz, x + hx, z + hz);
}

function vinePole(x, z) {
  box(.08, 3.4, .08, MAT.white, x, 0, z);
  for (let y = .4; y < 3.3; y += .22) { const l = add(new THREE.Mesh(jitterSphere(rr(.12, .22), 0), [MAT.leafA, MAT.leafC][rnd() * 2 | 0])); l.position.set(x + Math.sin(y * 7) * .16, y, z + Math.cos(y * 5) * .16); }
  for (let i = 0; i < 4; i++) { const l = add(new THREE.Mesh(jitterSphere(.16, 0), MAT.leafA)); l.position.set(x + rr(-.5, .5), rr(2.4, 3.2), z + rr(-.5, .5)); }
  colCirc(x, z, .15);
}

function fernPot(x, z) {
  const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.32, .22, .9, 12), MAT.charcoal)); p.position.set(x, .45, z);
  for (let i = 0; i < 5; i++) { const l = add(new THREE.Mesh(jitterSphere(rr(.28, .38), 1), MAT.leafB)); l.position.set(x + rr(-.25, .25), 1 + rr(0, .35), z + rr(-.25, .25)); }
  colCirc(x, z, .35);
}

// the north windows: sill, blinds glass, red-brown mullions, a white column every few bays
function usWindows(x0, z0, x1, z1, M, columns = []) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = x0 === x1 ? Math.PI / 2 : 0, g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = ry; scene.add(g);
  box(len, .8, .3, M.white, 0, 0, 0, { p: g }); box(len, 2.4, .1, MAT.window, 0, .8, 0, { p: g, cast: false }); box(len, .5, .3, M.white, 0, 3.2, 0, { p: g });
  for (let s = 0; s <= len + .01; s += 1.8) box(.1, 2.4, .16, M.frame, s - len / 2, .8, 0, { p: g });
  box(len, .08, .16, M.frame, 0, 1.95, 0, { p: g, cast: false });
  for (const c of columns) { box(.8, 3.7, .8, M.white, c - len / 2, 0, .4, { p: g }); if (!ry) colBox(x0 + c - .4, z0, x0 + c + .4, z0 + .8); }
  colBox(Math.min(x0, x1) - .2, Math.min(z0, z1) - .2, Math.max(x0, x1) + .2, Math.max(z0, z1) + .2);
}

function buildUS(a) {
  const { cx, cz } = a, [hx, hz] = US_HALF, X = (v) => cx + v, Z = (v) => cz + v;
  withSideRandom(() => {
    const M = usMaterials();
    plane(160, 140, MAT.darkGrass, cx, -4.6, cz - 20, 2);
    for (let i = 0; i < 22; i++) tree(cx + rr(-34, 34), cz + rr(-34, -12), rr(1.2, 1.8), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false).position.y = -4.6;
    for (const [x, s] of [[-36, 14], [-6, 18], [26, 16]]) { const h = add(new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), pOnce('hills', () => new THREE.MeshStandardMaterial({ color: 0x9a8a52, roughness: 1 }))), null, false); h.scale.set(1.6, .4, 1); h.position.set(cx + x, -4.6, cz - 64); }
    plane(2 * hx, 2 * hz, M.carpet, cx, .012, cz, 1.5);
    WALK.push([X(-hx + .3), Z(-hz + .3), X(hx - .3), Z(hz - .3)]);

    // walls: windows on the north and the north end of the west, white elsewhere; the south wall is low so the camera sees in
    usWindows(X(-hx), Z(-hz), X(hx), Z(-hz), M, [6, 14]);
    usWindows(X(-hx), Z(-hz), X(-hx), Z(-3), M);
    box(.3, 3.7, hz + 3, M.white, X(-hx), 0, Z((hz - 3) / 2)); colBox(X(-hx) - .2, Z(-3), X(-hx) + .2, Z(hz));
    box(.3, 3.7, 2 * hz, M.white, X(hx), 0, cz); colBox(X(hx) - .2, Z(-hz), X(hx) + .2, Z(hz));
    box(2 * hx, 1.1, .3, M.white, cx, 0, Z(hz)); colBox(X(-hx), Z(hz) - .2, X(hx), Z(hz) + .2);
    sunShafts('us', X(-hx) + .1, Z(-hz), Z(-3), 1.8, .8, 3.2);
    for (const [x, z] of [[-5, -4], [4, -4], [0, 3]]) pointLight('us', 0xfff2dc, 1.2, 12, X(x), 3.2, Z(z));

    // desks: two pods by the windows, a long pod down the middle, one by the west wall; vine poles and plants between them
    usPod(X(-6.2), Z(-5.1), 2, 'x', M);
    usPod(X(-1), Z(-3.6), 3, 'z', M);
    usPod(X(4.6), Z(-5.1), 2, 'x', M);
    usPod(X(-6.6), Z(1.2), 2, 'x', M);
    for (const [x, z] of [[-3.6, -6], [2.2, -6.2], [-9.1, -1.4]]) vinePole(X(x), Z(z));
    for (const [x, z] of [[-9.2, -6.7], [8.8, -6.6], [-9.2, 3.4]]) bigPlant(X(x), Z(z));

    // east: the exit door, the logo wall with the Calfus C, the ping-pong table, the glass meeting room, phone booths, the printer
    const [ex, ez] = US_EXIT;
    box(.1, 2.3, 1.1, M.door, X(hx) - .2, 0, Z(-5.6)); box(.12, .3, .9, MAT.charcoal, X(hx) - .2, 2.4, Z(-5.6)); ledSign(['EXIT'], '#7dff8a', X(hx) - .25, 2.75, Z(-5.6), .8, .3, -Math.PI / 2);
    box(.4, 3.7, 6, M.white, X(hx) - .5, 0, Z(-.6));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .2, 8, 36, Math.PI * 1.62), MAT.charcoal); ring.position.set(X(hx) - .8, 2.1, Z(-.6)); ring.rotation.set(0, -Math.PI / 2, Math.PI * .19); ring.castShadow = true; scene.add(ring);
    const tip = Math.PI * .16, dot = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .1, 20), M.teal); dot.rotation.z = Math.PI / 2; dot.position.set(X(hx) - .86, 2.1 + .98 * Math.sin(tip), Z(-.6) + .98 * Math.cos(tip)); scene.add(dot);
    fernPot(X(hx) - 1, Z(-3.9));
    INTER.push({ x: X(hx) - 2.4, z: Z(-.6), r: 1.8, label: 'Calfus', verb: 'Look', act: () => talk('Calfus · Pleasanton', ['The Calfus C, on the wall of the US office.', 'Same company, eleven and a half hours apart. Someone is always awake.']) });
    // the ping-pong table runs parallel to the logo wall; cues on a shelf underneath, the ball holder on the end
    const tx = X(6.4), tz = Z(.6);
    box(1.52, .08, 2.74, MAT.charcoal, tx, .74, tz); box(1.52, .01, .02, MAT.white, tx, .82, tz - 1.36, { cast: false }); box(1.52, .01, .02, MAT.white, tx, .82, tz + 1.36, { cast: false });
    box(1.7, .16, .03, MAT.white, tx, .82, tz); box(1.7, .02, .04, MAT.charcoal, tx, .98, tz);
    for (const s of [-1, 1]) { box(1.3, .74, .12, MAT.charcoal, tx, 0, tz + s * 1.1); box(.06, .7, .06, MAT.chrome, tx + .7, .02, tz + s * 1.15); }
    box(1.2, .06, 2.2, MAT.charcoal, tx, .18, tz);
    for (const dx of [-.3, -.1, .1, .3]) box(.03, .03, 1.5, M.maple, tx + dx, .23, tz);
    box(.06, .22, .3, MAT.charcoal, tx - .79, .5, tz + .9);
    for (let i = 0; i < 4; i++) { const b = add(new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), pOnce('pingBall', () => new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: .5 })))); b.position.set(tx - .82, .56 + (i % 2) * .08, tz + .84 + (i > 1 ? .1 : 0)); }
    colBox(tx - .85, tz - 1.45, tx + .85, tz + 1.45);
    // south-east corner, right of the logo wall: the tall whiteboard wall with a fern, a half-height wall with the plaque,
    // and behind it a short corridor with the Silverton and Mission doors in the east wall, entered from its south end
    const CX = 8.2, wbWall = new THREE.Group(); scene.add(wbWall);
    box(.3, 3, 1.8, M.white, X(CX), 0, Z(3.6), { p: wbWall });
    const bigBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.8), M.board); bigBoard.position.set(X(CX) - .16, 1.6, Z(3.6)); bigBoard.rotation.y = -Math.PI / 2; wbWall.add(bigBoard);
    box(.25, 1.2, 1.6, M.white, X(CX), 0, Z(5.3));
    const half = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .9), M.board); half.position.set(X(CX) - .14, .65, Z(5.3)); half.rotation.y = -Math.PI / 2; scene.add(half);
    box(.1, .5, .8, M.maple, X(CX), 1.2, Z(5)); signBoard('Great leaders inspire greatness', X(CX) - .08, 1.55, Z(5), 1.4, .24, -Math.PI / 2, { size: 12, bg: '#f4f2ec', color: '#1c1c20', w: 220, h: 36 });
    colBox(X(CX) - .2, Z(2.7), X(CX) + .2, Z(6.1));
    fernPot(X(CX) - .8, Z(3.4));
    INTER.push({ x: X(CX) - 1.3, z: Z(4.2), r: 1.4, label: 'Whiteboard', verb: 'Read', act: () => talk('Whiteboard', ['A wall-sized whiteboard, covered edge to edge in boxes and arrows.', 'In the corner, in red: "prompt -> model -> answer -> CHECK."']) });
    makeFader(compact(wbWall), () => hero.zone === 'us' && hero.x > X(CX - 1.6) && hero.x < X(CX + 1.6) && hero.y < Z(2.7) && hero.y > Z(2.7) - 3.5);
    [['Silverton', 3.6], ['Mission', 5.4]].forEach(([name, dz]) => {
      const z = Z(dz);
      box(.08, 2.3, 1.1, M.door, X(hx) - .2, 0, z); box(.1, .1, 1.3, MAT.charcoal, X(hx) - .2, 2.3, z);
      signBoard(name, X(hx) - .25, 1.6, z + .85, .9, .24, -Math.PI / 2, { size: 13, bg: '#f4f2ec', color: '#1c1c20', w: 160, h: 36 });
      INTER.push({ x: X(hx) - .9, z, r: 1, label: name, verb: 'Knock', act: () => talk(name, [`The ${name} room. Booked, as always.`]) });
    });

    // behind the table along the south wall: the glass meeting room, the printer, two phone booths
    const glass = new THREE.Group(); scene.add(glass);
    const [gx0, gz0, gx1, gz1] = [X(4), Z(4.5), X(6.4), Z(hz - .2)];
    for (const [a1, b1, a2, b2] of [[gx0, gz0, gx1, gz0], [gx0, gz0, gx0, gz1], [gx1, gz0, gx1, gz1]]) {
      const len = Math.hypot(a2 - a1, b2 - b1), horiz = b1 === b2, mx = (a1 + a2) / 2, mz = (b1 + b2) / 2;
      box(horiz ? len : .06, 2.9, horiz ? .06 : len, MAT.pane, mx, .05, mz, { p: glass, cast: false });
      box(horiz ? len : .07, .7, horiz ? .07 : len, M.white, mx, 1, mz, { p: glass, cast: false });
      box(horiz ? len : .1, .1, horiz ? .1 : len, MAT.charcoal, mx, 2.95, mz, { p: glass });
      for (const t of [0, 1]) box(.1, 3, .1, MAT.charcoal, horiz ? a1 + t * len : a1, 0, horiz ? b1 : b1 + t * len, { p: glass });
      colBox(Math.min(a1, a2) - .1, Math.min(b1, b2) - .1, Math.max(a1, a2) + .1, Math.max(b1, b2) + .1);
    }
    box(1.4, .06, .9, MAT.walnut, (gx0 + gx1) / 2, .72, (gz0 + gz1) / 2 + .3, { p: glass }); for (const s of [-1, 1]) chair((gx0 + gx1) / 2 + s * .4, (gz0 + gz1) / 2 - .4, -1, glass);
    for (const [dx, c] of [[-.6, MAT.screen], [.6, MAT.glassLit]]) { box(.8, .6, .04, MAT.white, (gx0 + gx1) / 2 + dx, 1.5, gz1 - .05, { p: glass }); box(.66, .48, .02, c, (gx0 + gx1) / 2 + dx, 1.56, gz1 - .08, { p: glass, cast: false }); }
    signBoard('Pleasanton', (gx0 + gx1) / 2, 2.4, gz0 - .05, 1.4, .3, Math.PI, { size: 15, bg: '#1c1c20', color: '#f0eee8', w: 160, h: 36 });
    fernPot(gx0 + .5, gz0 + .5);
    box(.7, .9, .6, MAT.white, X(3.5), 0, Z(hz - .5)); colBox(X(3.15), Z(hz - .85), X(3.85), Z(hz));
    for (const x of [2.5, 1.2]) {
      box(1.2, 2.3, 1.2, MAT.charcoal, X(x), 0, Z(hz - .65)); box(.9, 1.8, .04, MAT.pane, X(x), .3, Z(hz - 1.27), { cast: false }); box(.05, .9, .05, M.maple, X(x) + .28, .7, Z(hz - 1.31));
      colBox(X(x) - .65, Z(hz - 1.3), X(x) + .65, Z(hz));
    }
    portal(X(ex), Z(ez), 0xffb347, 'us', 'airport', 'Fly to Pune', { at: [AREAS.airport.cx + AIRPORT_GATE[0] - 3, AREAS.airport.cz + AIRPORT_GATE[1] + 4.6] });

    // the kitchen whiteboard wall, the kitchenette behind it, the teal wall, then the Diablo door
    const WZ = 5;
    const core = new THREE.Group(); scene.add(core);
    box(1.8, 3, .25, M.white, X(-.5), 0, Z(WZ), { p: core });
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), M.board); wb.position.set(X(-.5), 1.6, Z(WZ) - .14); wb.rotation.y = Math.PI; core.add(wb);
    box(.25, 3, hz - WZ, M.white, X(-1.4), 0, Z((WZ + hz) / 2), { p: core });
    box(2.6, .9, .6, MAT.white, X(-2.9), 0, Z(hz - .45), { p: core }); box(2.7, .06, .66, MAT.concrete, X(-2.9), .9, Z(hz - .45), { p: core });
    for (const x of [-3.7, -3]) box(.5, .3, .36, MAT.charcoal, X(x), .96, Z(hz - .45), { p: core });
    box(.24, .34, .26, MAT.chrome, X(-2.2), .96, Z(hz - .45), { p: core }); box(.5, .7, .4, MAT.chrome, X(-1.8), 0, Z(hz - .5), { p: core });
    plane(2.8, hz - WZ, pOnce('kitchenTile', () => std(canvasTex(16, 16, (g) => { g.fillStyle = '#ece6da'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#d8d0c2'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }, { nearest: true }), .6)), X(-2.9), .016, Z((WZ + hz) / 2), 1);
    box(2.4, 3, .25, M.teal, X(-5.6), 0, Z(WZ), { p: core });
    box(.18, .5, .18, pOnce('extRed', () => new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: .4 })), X(-6), .9, Z(WZ) - .18, { p: core });
    box(1.1, .8, .04, MAT.white, X(-5.4), 1.8, Z(WZ) - .16, { p: core }); box(.9, .6, .02, MAT.screen, X(-5.4), 1.8, Z(WZ) - .18, { p: core, cast: false });
    box(.25, 3, hz - WZ, M.white, X(-4.4), 0, Z((WZ + hz) / 2), { p: core });
    colBox(X(-1.4), Z(WZ) - .15, X(.4), Z(WZ) + .15); colBox(X(-6.8), Z(WZ) - .15, X(-4.4), Z(WZ) + .15);
    colBox(X(-1.55), Z(WZ), X(-1.25), Z(hz)); colBox(X(-4.55), Z(WZ), X(-4.25), Z(hz)); colBox(X(-4.3), Z(hz - .8), X(-1.4), Z(hz));
    INTER.push({ x: X(-2.9), z: Z(hz - 1.4), r: 1.4, label: 'Kitchen', verb: 'Look', act: () => talk('Kitchen', ['Two microwaves, one coffee machine, and a very long queue at 12:30.', 'A note on the fridge: "Label your lunch. The AI will not guess whose it is."']) });
    INTER.push({ x: X(-.5), z: Z(WZ - 1.2), r: 1.4, label: 'Whiteboard', verb: 'Read', act: () => talk('Whiteboard', ['prompt -> model -> answer -> check.', '"Sounding sure is not the same as being right." Someone underlined it twice.']) });
    makeFader(compact(core), () => hero.zone === 'us' && hero.y < Z(WZ) && hero.y > Z(WZ) - 3.5 && hero.x > X(-7) && hero.x < X(.6));
    fernPot(X(-1.1), Z(WZ - .55));
    box(1.1, 2.3, .08, M.door, X(-7.6), 0, Z(hz) - .2); box(1.3, .1, .1, MAT.charcoal, X(-7.6), 2.3, Z(hz) - .2);
    signBoard('Diablo', X(-6.7), 1.6, Z(hz) - .25, .9, .24, Math.PI, { size: 13, bg: '#f4f2ec', color: '#1c1c20', w: 160, h: 36 });
    INTER.push({ x: X(-7.6), z: Z(hz) - 1, r: 1, label: 'Diablo', verb: 'Knock', act: () => talk('Diablo', ['The Diablo room. Booked, as always.']) });
  });
}
