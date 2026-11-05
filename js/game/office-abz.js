// TokenFall: ABZ office (zone "abz"), from its floor plan, on the 15th floor.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= ABZ office (Calfus), from its floor plan =================
// Plan coordinates in metres: x 0 → 20 west to east, y -1.46 → 16.8 north to south, the lobby sticks out west (x -4 → 0).
// Scaled up by S like the HQ office so there's room to walk; furniture stays real size.
// Everything is laid out in plan orientation, then turned a quarter so the lobby is at the south and you walk in facing north.
function buildABZ(a) {
  const S = 1.4, { cx, cz } = a, X = x => cx + (x - 10) * S, Z = y => cz + (y - 7.7) * S, L = v => v * S;
  const n0 = scene.children.length, c0 = COL.length, w0 = WALK.length, i0 = INTER.length, b0 = BEADS.length, fades = [];
  // solid that fades when it would hide the player (anything tall that ends up between the camera and the floor)
  const solidF = (x0, y0, x1, y1, h, m, extra) => { const g = grp(), [x, z, w, d] = span(x0, y0, x1, y1); box(w, h, d, m, x, 0, z, { p: g }); colBox(X(x0), Z(y0), X(x1), Z(y1)); if (extra) extra(g); fades.push(g); return g; };
  const span = (x0, y0, x1, y1) => [(X(x0) + X(x1)) / 2, (Z(y0) + Z(y1)) / 2, X(x1) - X(x0), Z(y1) - Z(y0)];
  const floor = (x0, y0, x1, y1, m, y, s) => { const [x, z, w, d] = span(x0, y0, x1, y1); plane(w, d, m, x, y, z, s); };
  const solid = (x0, y0, x1, y1, h, m) => { const [x, z, w, d] = span(x0, y0, x1, y1); box(w, h, d, m, x, 0, z); colBox(X(x0), Z(y0), X(x1), Z(y1)); };
  // materials
  const wood = std(canvasTex(32, 32, (g, W, H) => {
    const tones = [[212, 194, 166], [200, 181, 152], [218, 202, 176], [194, 174, 146]];
    for (let x = 0; x < W; x++) { const k = x >> 3; for (let y = 0; y < H; y++) P(g, x, y, tones[k % 4], x % 8 === 0 || (y + k * 11) % 32 === 0 ? .82 : 1 + (rnd() - .5) * .05); }
  }), 1.6, { roughness: 1 });
  const tile = (base, n) => canvasTex(32, 32, (g, W, H) => { noiseFill(g, W, H, base, .04); g.fillStyle = rgb(base, .8); for (let i = 0; i < 32; i += 32 / n) { g.fillRect(i, 0, 1, 32); g.fillRect(0, i, 32, 1); } });
  const carpet = std(TX.concrete, 1.5, { roughness: 1 }); carpet.color.setRGB(.42, .43, .47);
  const grey = std(tile([150, 152, 156], 2), 1.2, { roughness: 1 }), beige = std(tile([214, 208, 196], 2), 1.4, { roughness: 1 });
  const wallM = std(TX.plaster, 1); wallM.color.setRGB(.82, .82, .8);
  const black = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: .35 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9e1cd, roughness: .6 });
  const chairM = new THREE.MeshStandardMaterial({ color: 0xa3a7ad, roughness: .7 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x6b2e1c, roughness: .55, side: THREE.DoubleSide });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: .8, side: THREE.DoubleSide });
  const H = 3.2;

  // floors: wood everywhere, carpet under the desks, tiles in the pantry and lobby, dark in the bathrooms
  floor(0, -1.46, 20, 16.8, wood, .012, 1.6);
  for (const r of [[5.81, -1.46, 10.5, 5.16], [7, 6.68, 15.1, 12.63], [6.97, 13.67, 15.95, 16.8], [0, 13.67, 6.97, 16.8], [10.5, -1.46, 15.95, 1.85], [15.95, -1.46, 20, 4.95], [15.95, 10.86, 20, 16.8]]) floor(...r, carpet, .016, 1.5);
  floor(0, 5.16, 4.32, 11.48, grey, .016, 1.2); floor(4.32, -1.46, 5.81, 5.16, grey, .016, 1.2);
  floor(-4, 9.6, 0, 16, beige, .012, 1.4);
  // this floor is the 15th: the tower's glass drops away below the slab, with the city far beneath
  const G = -42, facade = [MAT.glass, MAT.glass, MAT.concrete, MAT.concrete, MAT.glass, MAT.glass];
  for (const [x0, y0, x1, y1] of [[0, -1.46, 20, 16.8], [-4, 9.6, 0, 16]]) {
    const [x, z, w, d] = span(x0, y0, x1, y1);
    box(w + .5, .4, d + .5, MAT.concrete, x, -.4, z); faceBox(w + .3, -G - .45, d + .3, facade, x, G, z);
  }
  plane(420, 420, MAT.concrete, cx, G, cz, 6);
  for (let k = -200; k <= 200; k += 34) { plane(9, 420, MAT.flag, cx + k, G + .02, cz, 4); plane(420, 9, MAT.flag, cx, G + .03, cz + k, 4); }
  for (let i = -170; i <= 170; i += 34) for (let j = -170; j <= 170; j += 34) {
    if (Math.abs(i) < 30 && Math.abs(j) < 30) continue;   // our own tower
    const h = rr(4, 26), w = rr(12, 22), d = rr(12, 22);
    if (rnd() < .2) { plane(24, 24, MAT.darkGrass, cx + i + 17, G + .04, cz + j + 17, 2); for (let t = 0; t < 4; t++) tree(cx + i + 17 + rr(-8, 8), cz + j + 17 + rr(-8, 8), rr(1.6, 2.4), MAT.leafB, false).position.y = G; continue; }
    faceBox(w, h, d, [MAT.glass, MAT.glass, MAT.roofFlat, MAT.concrete, MAT.glass, MAT.glass], cx + i + 17, G, cz + j + 17);
  }
  WALK.push([X(0) + .2, Z(-1.46) + .2, X(20) - .2, Z(16.8) - .2], [X(-4) + .2, Z(9.6) + .2, X(0) + .6, Z(16) - .2]);

  // outer walls: full height north, east and west; low along the south so the camera can see in
  solid(-.12, -1.58, 20.12, -1.46, H, wallM);
  // the back (plan east) wall is one long window from end to end
  {
    const zc = (Z(-1.46) + Z(16.8)) / 2, len = Z(16.8) - Z(-1.46), wx = X(20.06);
    box(.3, .55, len, MAT.plaster, wx, 0, zc); box(.12, H - .85, len, MAT.window, wx, .55, zc); box(.3, .3, len, MAT.plaster, wx, H - .3, zc);
    for (let t = 0; t <= len + .01; t += len / 7) box(.32, H, .14, MAT.charcoal, wx, 0, Z(-1.46) + t);
    colBox(X(20), Z(-1.46), X(20.12), Z(16.8));
  }
  // the wall between the lobby and the office (south once turned): door with garlands, the Calfus logo on the lobby side
  const lobbyWall = solidF(-.12, -1.46, 0, 11.95, H, wallM, g => {
    box(.14, H, Z(16.8) - Z(13.25), wallM, X(-.06), 0, (Z(13.25) + Z(16.8)) / 2, { p: g });
    box(.14, H - 2.4, L(1.3), wallM, X(-.06), 2.4, Z(12.6), { p: g });
    for (const y of [11.95, 13.25]) box(.12, 2.4, .12, black, X(-.06), 0, Z(y), { p: g });
  });
  colBox(X(-.12), Z(13.25), X(0), Z(16.8));
  for (const y of [11.95, 13.25]) garlandV(X(-.2), Z(y), .1, 2.35);
  solid(0, 16.8, 20, 16.92, H, wallM);
  // the lobby, sticking out to the west (south once turned): low outer wall where the camera looks in
  solid(-4.12, 9.48, 0, 9.6, H, wallM); solid(-4.12, 9.6, -4, 16, 1.1, wallM); solid(-4.12, 16, 0, 16.12, H, wallM);

  // glass partitions: black frames, glass panes, marigold garlands on the door posts
  const gwall = (xa, za, xb, zb, doors = []) => {
    const horiz = za === zb, len = horiz ? xb - xa : zb - za, GH = 2.9;
    const at = t => horiz ? [xa + t, za] : [xa, za + t];
    const seg = (t0, t1, y, h, m, th) => { const [x, z] = at((t0 + t1) / 2); horiz ? box(t1 - t0, h, th, m, x, y, z, { cast: m !== MAT.pane }) : box(th, h, t1 - t0, m, x, y, z, { cast: m !== MAT.pane }); };
    const spans = []; let t = 0;
    for (const [d0, d1] of doors) { if (d0 > t) spans.push([t, d0]); t = d1; }
    if (t < len) spans.push([t, len]);
    for (const [t0, t1] of spans) {
      seg(t0, t1, .06, GH - .12, MAT.pane, .04); seg(t0, t1, 0, .06, black, .08);
      const [x0, z0] = at(t0), [x1, z1] = at(t1); colBox(Math.min(x0, x1) - .08, Math.min(z0, z1) - .08, Math.max(x0, x1) + .08, Math.max(z0, z1) + .08);
    }
    seg(0, len, GH - .06, .08, black, .08);
    const posts = new Set([0, len]); for (let u = 1.4; u < len - .4; u += 1.4) posts.add(u);
    for (const [d0, d1] of doors) { posts.add(d0); posts.add(d1); }
    for (const u of posts) { const [x, z] = at(u); box(.07, GH, .07, black, x, 0, z); }
    for (const [d0, d1] of doors) for (const u of [d0, d1]) { const [x, z] = at(u); garlandV(x + (horiz ? 0 : -.07), z + (horiz ? .07 : 0), .1, GH - .1); }
  };
  // a glass wall along plan coordinates, with one door centred at plan position `door`
  const glass = (x0, y0, x1, y1, door) => {
    const horiz = y0 === y1, a0 = horiz ? X(x0) : Z(y0), dc = door == null ? null : (horiz ? X(door) : Z(door)) - a0;
    gwall(X(x0), Z(y0), X(x1), Z(y1), dc == null ? [] : [[dc - .6, dc + .6]]);
  };
  const plate = (name, x, y, z, ry) => signBoard(name, x, y, z, 1.3, .32, ry, { size: 16, bg: '#18191c', edge: '#2c2e33', color: '#f3ead6', w: 170, h: 42 });
  const sitAt = (x, z, ry, m = chairM) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); chair(0, 0, 1, g, m); };
  // meeting table: long (along z or x) with chairs down both sides, or round with four chairs
  const mtable = (x, z, len, alongZ, per) => {
    alongZ ? box(1.1, .05, len, cream, x, .72, z) : box(len, .05, 1.1, cream, x, .72, z);
    for (const s2 of [-1, 1]) alongZ ? box(.9, .72, .06, black, x, 0, z + s2 * (len / 2 - .15)) : box(.06, .72, .9, black, x + s2 * (len / 2 - .15), 0, z);
    for (let i = 0; i < per; i++) for (const s2 of [-1, 1]) {
      const t = -len / 2 + (i + .5) * len / per;
      alongZ ? sitAt(x + s2 * 1, z + t, s2 > 0 ? Math.PI / 2 : -Math.PI / 2) : sitAt(x + t, z + s2 * 1, s2 > 0 ? 0 : Math.PI);
    }
    alongZ ? colBox(x - .6, z - len / 2, x + .6, z + len / 2) : colBox(x - len / 2, z - .6, x + len / 2, z + .6);
  };
  const rtable = (x, z, r = .55) => {
    const top = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, .05, 20), cream)); top.position.set(x, .74, z);
    box(.1, .72, .1, black, x, 0, z);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + .4; sitAt(x + Math.cos(an) * (r + .45), z + Math.sin(an) * (r + .45), Math.PI / 2 - an); }
    colCirc(x, z, r + .1);
  };
  const tv = (x, z, ry) => box(1.6, .9, .06, black, x, 1.2, z, { ry });
  const room = (name, lines, px, pz, ry) => { plate(name, px, 2.6, pz, ry); INTER.push({ x: px + Math.sin(ry) * 1.1, z: pz + Math.cos(ry) * 1.1, r: 1.3, label: name, verb: 'Read', act: () => talk(name, lines) }); };

  // ---- north-west: bathrooms, the corridor beside them, the server room ----
  solidF(0, -1.46, 4.32, 2.57, H, black); solidF(0, 2.57, 4.32, 5.16, H, black);
  box(.06, 2.2, .9, MAT.slat, X(4.32) + .03, 0, Z(.6)); box(.06, 2.2, .9, MAT.slat, X(4.32) + .03, 0, Z(3.8));
  plate('Bathrooms', X(4.32) + .1, 2.6, Z(2.2), Math.PI / 2);
  solidF(5.75, -1.46, 5.81, 5.16, H, wallM);
  box(.4, .6, .25, new THREE.MeshStandardMaterial({ color: 0xc0281c }), X(5.3), .9, Z(-1.3));
  const bin = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .18, .6, 12), black)); bin.position.set(X(4.8), .3, Z(-.9));
  solidF(2.84, 5.16, 4.32, 8.35, H, wallM);
  box(.06, 2.2, .9, MAT.slat, X(4.32) + .03, 0, Z(6.8)); plate('Server', X(4.32) + .1, 2.6, Z(6.8), Math.PI / 2);

  // ---- pantry: counter along the north wall, two wooden tables, water dispenser, a painting ----
  // the pantry is glass on the workspace side, with its door there, and glass on the entrance side too
  glass(4.29, 8.35, 4.29, 11.48, 9.9);
  glass(0, 11.48, 4.32, 11.48);
  const PZ = Z(5.16) + .32;
  box(X(2.8) - X(.05), .9, .6, MAT.walnut, (X(.05) + X(2.8)) / 2, 0, PZ); box(X(2.8) - X(.05), .05, .64, MAT.white, (X(.05) + X(2.8)) / 2, .9, PZ);
  box(X(2.8) - X(.05), .7, .36, MAT.cabinet, (X(.05) + X(2.8)) / 2, 1.6, Z(5.16) + .2);
  box(.5, .3, .38, black, X(.8), .95, PZ); const kettle = add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, .22, 10), MAT.steel)); kettle.position.set(X(1.6), 1.06, PZ);
  colBox(X(0), Z(5.16), X(2.8), PZ + .32);
  const plank = new THREE.MeshStandardMaterial({ color: 0xc08a4c, roughness: .7 });
  for (const tx of [.75, 2.8]) {
    const x = X(tx), z = Z(9.95);
    box(1.3, .05, .85, plank, x, .74, z); for (const [dx, dz] of [[-.58, -.35], [.58, -.35], [-.58, .35], [.58, .35]]) box(.06, .74, .06, plank, x + dx, 0, z + dz);
    for (const dx of [-.35, .35]) { box(.44, .05, .42, plank, x + dx, .45, z + .7); box(.44, .5, .05, plank, x + dx, .45, z + .9); for (const [lx, lz] of [[-.19, .52], [.19, .52], [-.19, .88], [.19, .88]]) box(.04, .45, .04, plank, x + dx + lx, 0, z + lz); }
    colBox(x - .7, z - .45, x + .7, z + 1);
  }
  box(.38, .9, .38, MAT.white, X(4.05), 0, Z(9.2)); const jug = add(new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .42, 12), new THREE.MeshStandardMaterial({ color: 0x2f4f9e, roughness: .3 }))); jug.position.set(X(4.05), 1.11, Z(9.2)); colCirc(X(4.05), Z(9.2), .3);
  const art = canvasTex(32, 40, (g, W, Hh) => { g.fillStyle = '#f2efe8'; g.fillRect(0, 0, W, Hh); for (let i = 0; i < 14; i++) { g.fillStyle = ['#3a8fb8', '#c83a3a', '#2a2a40', '#6ab06a', '#8a4ab0'][i % 5]; g.globalAlpha = .7; g.beginPath(); g.arc(6 + rnd() * 20, 8 + rnd() * 24, 2 + rnd() * 5, 0, 6.3); g.fill(); } g.globalAlpha = 1; });
  const artM = new THREE.MeshStandardMaterial({ map: art });
  const pic = new THREE.Mesh(new THREE.BoxGeometry(.04, 1.1, .9), [artM, black, black, black, black, black]); pic.position.set(X(0) + .04, 1.8, Z(9.6)); add(pic);
  plate('Pantry', X(4.29) + .1, 2.6, Z(9.9), Math.PI / 2);
  INTER.push({ x: X(1.8), z: Z(8), r: 1.6, label: 'Pantry', verb: 'Look', act: () => talk('Pantry', ['The ABZ pantry: a counter, two wooden tables, and the water dispenser by the wall.']) });

  // egg chairs (brown shells on thin legs), used in the entrance and the lounge
  const egg = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const shell = add(new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 10, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), brown), g); shell.position.y = .82; shell.rotation.x = -.35;
    for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .5, 6), black), g); l.position.set(dx, .25, dz); }
    colCirc(x, z, .45);
  };
  // ---- entrance: egg chairs, a small white table, a water dispenser ----
  egg(X(1.4), Z(12.1), 0); egg(X(3.1), Z(12.1), 0);
  const st = add(new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .5, 16), MAT.white)); st.position.set(X(2.25), .25, Z(12.1)); colCirc(X(2.25), Z(12.1), .3);
  box(.36, .9, .36, MAT.white, X(.35), 0, Z(11.75)); const jug2 = add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .4, 12), new THREE.MeshStandardMaterial({ color: 0x2f4f9e, roughness: .3 }))); jug2.position.set(X(.35), 1.1, Z(11.75)); colCirc(X(.35), Z(11.75), .3);

  // ---- meeting rooms ----
  glass(0, 13.67, 3.47, 13.67, 2.6); glass(3.47, 13.67, 6.97, 13.67, 5.9); glass(3.47, 13.67, 3.47, 16.8); glass(6.97, 13.67, 6.97, 16.8);
  rtable(X(1.7), Z(15.3)); room('ACE', ['ACE.'], X(1.2), Z(13.67) + .1, 0);
  mtable(X(5.2), Z(15.3), 1.8, false, 2); tv(X(3.47) + .1, Z(15.3), Math.PI / 2); room('ARENA', ['ARENA.'], X(4.6), Z(13.67) + .1, 0);
  glass(15.95, 10.86, 20, 10.86); glass(15.95, 10.86, 15.95, 16.8, 11.9);
  mtable(X(18), Z(14.1), 5.4, true, 5); tv(X(18), Z(16.8) - .2, 0); room('Half Dome', ['Half Dome.'], X(15.95) - .1, Z(13.4), -Math.PI / 2);
  glass(15.95, -1.46, 15.95, 2.57, 1.7); glass(15.95, 2.57, 20, 2.57); glass(15.95, 2.57, 15.95, 4.95, 3.75); glass(15.95, 4.95, 20, 4.95);
  mtable(X(18.1), Z(.55), 4.2, true, 4); tv(X(18.1), Z(-1.46) + .2, 0); room('Black Diamond', ['Black Diamond.'], X(15.95) - .1, Z(.3), -Math.PI / 2);
  mtable(X(17.6), Z(3.76), 1.6, false, 2); box(.6, .9, L(1.4), MAT.white, X(20) - .4, 0, Z(3.76)); room('Yorker', ['Yorker.'], X(15.95) - .1, Z(2.8), -Math.PI / 2);
  glass(10.5, 1.85, 13.25, 1.85, 11.9); glass(13.25, 1.85, 15.95, 1.85, 14.6); glass(13.25, -1.46, 13.25, 1.85); glass(10.5, -1.46, 10.5, 1.85);
  mtable(X(11.9), Z(.1), 1.4, false, 1); tv(X(11.9), Z(-1.46) + .2, 0); room('Center Court', ['Center Court.'], X(11.2), Z(1.85) + .1, 0);
  mtable(X(14.6), Z(.1), 1.4, false, 1); box(.8, 1.5, .4, MAT.white, X(15.2), 0, Z(-1.1)); room('Minecraft', ['Minecraft.'], X(13.9), Z(1.85) + .1, 0);

  // ---- desks: cream benches running north-south, black monitors, grey chairs ----
  // sides: -1 seats on the west side, 1 on the east; a double bench has both
  const bench = (x, y0, y1, sides) => {
    const xc = X(x), z0 = Z(y0), z1 = Z(y1), len = z1 - z0, W = sides.length > 1 ? 1.5 : .75, n = Math.max(1, Math.floor(len / 1.35)), p = len / n;
    box(W, .04, len, cream, xc, .72, (z0 + z1) / 2);
    for (const t of [.1, len / 2, len - .1]) box(W - .1, .72, .05, black, xc, 0, z0 + t);
    if (sides.length > 1) box(.03, .32, len - .1, MAT.fabric, xc, .76, (z0 + z1) / 2);
    for (let i = 0; i < n; i++) {
      const z = z0 + (i + .5) * p;
      for (const s2 of sides) {
        const mx = xc + s2 * (sides.length > 1 ? .22 : -.12);
        box(.05, .34, .58, black, mx, .9, z); box(.02, .3, .54, MAT.monitor, mx + s2 * .03, .92, z); box(.2, .14, .2, black, mx, .76, z);
        box(.14, .02, .4, black, xc + s2 * (W / 2 - .2), .76, z);
        sitAt(xc + s2 * (W / 2 + .42), z, s2 > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    colBox(xc - W / 2, z0, xc + W / 2, z1);
  };
  bench(6.27, -.9, 4.6, [1]); bench(8.9, -.9, 4.6, [-1, 1]);
  box(X(10.2) - X(6.6), .9, .45, MAT.white, (X(6.6) + X(10.2)) / 2, 0, Z(-1.46) + .3); colBox(X(6.6), Z(-1.46), X(10.2), Z(-1.46) + .55);
  bench(12.1, 3.8, 6.2, [-1, 1]); bench(14.6, 3.8, 6.2, [-1]);
  bench(7.4, 7.1, 12.2, [1]); bench(10, 7.1, 12.2, [-1, 1]); bench(13.6, 7.1, 12.2, [-1]);
  bench(7.3, 14.1, 16.5, [1]); bench(10.3, 14.1, 16.5, [-1, 1]); bench(13, 14.1, 16.5, [-1, 1]);

  // ---- lounge: egg chairs on a blue rug, carrom with four chairs, teal sofa, stools and a counter by the east wall ----
  const rug = std(canvasTex(16, 16, (g, W, Hh) => { for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) P(g, x, y, ((x >> 2) + (y >> 2)) % 2 ? [52, 92, 150] : [226, 230, 236]); }, { nearest: true }), 1);
  floor(16.3, 4.95, 18.6, 6.05, rug, .02, 1);
  egg(X(16.9), Z(5.5), Math.PI); egg(X(18), Z(5.5), Math.PI);
  const ctx = X(17.6), ctz = Z(9.05);
  for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box(.06, .6, .06, black, ctx + dx, 0, ctz + dz);
  box(1, .07, 1, MAT.carrom, ctx, .6, ctz, { s: 0 }); colCirc(ctx, ctz, .6);
  for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; sitAt(ctx + Math.cos(an) * 1, ctz + Math.sin(an) * 1, Math.PI / 2 - an, MAT.white); }
  INTER.push({ x: ctx, z: ctz + 1.8, r: 1.4, label: 'Carrom Board', verb: 'Play', act: () => talk('Carrom Board', ['A carrom board in the ABZ lounge.']) });
  sofa(X(17.6), Z(10.4), Math.PI, 1, new THREE.MeshStandardMaterial({ color: 0x1f6b66, roughness: .8 }));
  // a wooden bar counter along the window, with stools in front (the same walnut-on-white-legs bar as the HQ)
  const BX = X(20) - .4, bz0 = Z(4.95) + .12, bz1 = Z(10.86) - .12;   // the full window between the meeting rooms
  box(.5, .06, bz1 - bz0, MAT.walnut, BX, 1.05, (bz0 + bz1) / 2);
  for (let z = bz0 + .2; z < bz1; z += 1.9) box(.05, 1.05, .05, MAT.white, BX, 0, z);
  colBox(BX - .3, bz0, X(20), bz1);
  for (let z = bz0 + .7; z < bz1 - .4; z += 1.3) { stool(X(20) - 1.05, z); colCirc(X(20) - 1.05, z, .25); }

  // ---- plants in black pots ----
  const plant = (x, z) => {
    const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.26, .2, .5, 10), black)); p.position.set(x, .25, z);
    for (let i = 0; i < 9; i++) { const g = new THREE.Group(); g.position.set(x, .45, z); g.rotation.y = i / 9 * 6.283; scene.add(g); const b = add(new THREE.Mesh(boxGeo(.07, .95, .02, 0), leaf), g, false); b.position.set(.12, .4, 0); b.rotation.z = -.45 - (i % 3) * .12; }
    colCirc(x, z, .32);
  };
  for (const [x, y] of [[9.95, -.4], [15.2, 10.3], [14.3, 12.5], [7.3, 13.35], [15.5, 14.8]]) plant(X(x), Z(y));

  // ---- lobby: plants, the Calfus logo on the wall, the garlanded door into the office, a standee ----
  for (const y of [10.1, 10.75, 11.4]) plant(X(-.55), Z(y));
  const logo = canvasTex(160, 48, (g, W, Hh) => {
    g.clearRect(0, 0, W, Hh); g.font = '700 34px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
    const tw = g.measureText('Calfus').width, x0 = (W - tw) / 2, cw = g.measureText('C').width;
    g.fillStyle = '#5a6f9c'; g.fillText('Calfus', x0, Hh / 2 + 2);
    g.fillStyle = '#3fc6b8'; g.beginPath(); g.arc(x0 + cw * .78, Hh / 2 - 8, 4, 0, 6.3); g.fill();
  });
  logo.magFilter = THREE.LinearFilter;
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .78), new THREE.MeshStandardMaterial({ map: logo, alphaTest: .4, emissive: 0x5a6f9c, emissiveMap: logo, emissiveIntensity: .6 }));
  lg.position.set(X(-.12) - .03, 2.1, Z(10.7)); lg.rotation.y = -Math.PI / 2; lobbyWall.add(lg);
  box(.06, 1.1, .7, black, X(-.5), 1.1, Z(14.4)); box(.04, 1.1, .04, black, X(-.5), 0, Z(14.4)); colCirc(X(-.5), Z(14.4), .3);
  const lbin = add(new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .6, 12), new THREE.MeshStandardMaterial({ color: 0x2a2116 }))); lbin.position.set(X(-.45), .3, Z(13.65));
  INTER.push({ x: X(-.9), z: Z(12.6), r: 1.4, label: 'ABZ Office', verb: 'Read', act: () => talk('ABZ Office', ['Welcome to the Calfus office at ABZ.', 'Through this door: the pantry on your left, the desks ahead, the meeting rooms around the edges.']) });
  // lights
  for (const [x, y] of [[8, 2], [11, 9.5], [11, 15], [17.5, 8], [2, 8], [-2, 12.6]]) pointLight('abz', 0xfff0dc, 1.2, 14, X(x), 2.8, Z(y));

  // turn the whole floor a quarter (plan west → south, plan north → west), colliders and all
  const rot = (x, z) => [cx + (z - cz), cz - (x - cx)], UPY = new THREE.Vector3(0, 1, 0);
  for (const o of scene.children.slice(n0)) { [o.position.x, o.position.z] = rot(o.position.x, o.position.z); o.rotateOnWorldAxis(UPY, Math.PI / 2); }
  const rect = (x0, z0, x1, z1) => { const [ax, az] = rot(x0, z0), [bx, bz] = rot(x1, z1); return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]; };
  for (const c of COL.slice(c0)) {
    if (c.r !== undefined) [c.x, c.z] = rot(c.x, c.z);
    else if (c.ex !== undefined) { [c.ex, c.ez] = rot(c.ex, c.ez); [c.rx, c.rz] = [c.rz, c.rx]; }
    else [c.x0, c.z0, c.x1, c.z1] = rect(c.x0, c.z0, c.x1, c.z1);
  }
  for (let i = w0; i < WALK.length; i++) WALK[i] = rect(...WALK[i]);
  for (const it of INTER.slice(i0)) [it.x, it.z] = rot(it.x, it.z);
  for (const b of BEADS.slice(b0)) [b[0], b[2]] = rot(b[0], b[2]);
  for (const g of fades) {
    const bb = new THREE.Box3().setFromObject(g);
    makeFader(compact(g), () => hero.zone === 'abz' && hero.x > bb.min.x - .6 && hero.x < bb.max.x + .6 && hero.y < bb.max.z && hero.y > bb.min.z - 8);
  }
  const [px, pz] = rot(X(-2.5), Z(15.1));
  portal(px, pz, 0x7dff8a, 'abz', 'pune', 'Pune', { at: [AREAS.pune.cx + 28.3, AREAS.pune.cz - .7] });
}
