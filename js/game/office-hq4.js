// TokenFall: Calfus HQ, fourth floor (zone "lab4"), from the fourth floor's fire escape plan and photos (Cb 4th/).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// Same building as the second floor (office-hq.js): the same outline (about 27.5 m by 14.4 m, the north-east corner sticking out), the same
// scale-up S, polished concrete, window walls and lamp recipe, two storeys higher. The plan on the wall is drawn with north to the left; turned
// so the lift is at the south like downstairs, the floor reads:
//   south: the lift and electrical duct, the fire-exit stairs east of them, the waiting area in front (check sofa, teal chair, the Sprint banner)
//   middle: Rajgad (round table) and Lohagad (grey marble) facing the main corridor, a 4' passage between them to the toilets
//   east: the pantry galley along the east windows, the collab area: the sectional against the brick wall, the chessboard, the carrom table by the window
//   north-east: four desk pods and two half rows, and three phone booths with white cabinets against them at the window in the corner that sticks out
//   west: Torna (live-edge table) at the north end, four benching rows along the windows, Cabin 1 and Sinhagad (brick wall) at the south end
//   north: a bar counter with stools along the windows
function buildOffice4(a) {
  const S = 1.4, { cx, cz } = a, X = x => cx + x * S, Z = z => cz + z * S, L = v => v * S, ZN = a.key;
  KIT_ZONE = ZN;   // the kit's chandeliers and room faders belong to this floor while it builds
  const plum = MAT.charcoal; MAT.charcoal = new THREE.MeshStandardMaterial({ color: 0x4b4c50, roughness: .6 });   // up here the office chairs, monitors and keyboards are charcoal grey (black in the photos; the palette's floor turns true black plum)
  const GROUND = -11.8, facade = [MAT.glass, MAT.glass, MAT.concrete, MAT.concrete, MAT.glass, MAT.glass], SE = Z(13.4);

  // ---- materials from the photos ----
  const col = (c, r = .7, x = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: 0 }, x));
  const graphite = col(0x2f3236, .5);                                     // the black Crittall-style frames of the glass rooms
  const brick = std(canvasTex(64, 64, (g) => {
    g.fillStyle = '#b9aea2'; g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const x = c * 16 + (r % 2) * 8, t = .85 + rnd() * .3;
      g.fillStyle = rgb([156, 72, 50], t); g.fillRect(x + 1, r * 8 + 1, 15, 7);
      g.fillStyle = rgb([120, 52, 38], t); g.fillRect(x + 1, r * 8 + 7, 15, 1);
    }
  }), 1.2);
  const whiteTile = std(canvasTex(32, 32, (g) => {
    g.fillStyle = '#c9cbcb'; g.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) { g.fillStyle = rgb([236, 238, 236], .97 + rnd() * .05); g.fillRect(c * 16 + (r % 2) * 8 + 1, r * 8 + 1, 15, 7); }
  }), .8);
  const veins = (base, vein) => canvasTex(64, 64, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 64, 64); g.strokeStyle = vein; g.lineWidth = 1;
    for (let v = 0; v < 5; v++) { g.beginPath(); let x = rnd() * 64, y = 0; g.moveTo(x, y); while (y < 64) { x += (rnd() - .45) * 14; y += 6 + rnd() * 8; g.lineTo(x, y); } g.stroke(); }
  });
  const blackMarble = std(veins('#26272a', 'rgba(230,230,230,.55)'), 1.6, { roughness: .25 });
  const greyMarble = std(veins('#6c6660', 'rgba(235,228,220,.6)'), 1.4, { roughness: .3 });
  const whiteStone = col(0xe6e4de, .35);
  const liveEdge = std(canvasTex(64, 16, (g) => { for (let y = 0; y < 16; y++) { g.fillStyle = rgb([176, 104, 52], .85 + .2 * Math.sin(y * 1.3) + rnd() * .08); g.fillRect(0, y, 64, 1); } }), 1.2, { roughness: .45 });
  const carpet = std(canvasTex(32, 32, (g, W, H) => noiseFill(g, W, H, [150, 150, 148], .14)), 1);
  const plaid = std(canvasTex(32, 32, (g) => {
    g.fillStyle = '#d8ccb6'; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(92,70,58,.55)';
    for (let i = 0; i < 32; i += 8) { g.fillRect(i, 0, 2, 32); g.fillRect(0, i, 32, 2); }
    g.fillStyle = 'rgba(70,90,110,.35)'; for (let i = 4; i < 32; i += 8) { g.fillRect(i, 0, 1, 32); g.fillRect(0, i, 32, 1); }
  }, { nearest: true }), .7);
  const leather = col(0x4a4a4d, .5), teal = col(0x1f6f7c, .8), velvet = col(0x1f5a4a, .85), oakPale = col(0xd9cdb6, .7), felt = col(0xd9a83a, .95);
  const greyPlaster = col(0x8f8d89, .95);                               // the floor's grey lime-plaster walls and pillars
  const floor4 = MAT.oFloor.clone(); floor4.color.setScalar(.82);         // a shade darker than downstairs: the ceiling up here is open and grey
  const cabinet = std(canvasTex(32, 32, (q) => { q.fillStyle = '#f1efe9'; q.fillRect(0, 0, 32, 32); q.fillStyle = '#c9c6bf'; q.fillRect(0, 0, 1, 32); q.fillRect(0, 31, 32, 1); q.fillStyle = '#8c8a86'; q.fillRect(27, 12, 1, 8); }, { nearest: true }), .6, { roughness: .5 });
  const ledBar = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, emissive: 0xeef2ff, emissiveIntensity: 1.2 });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xe6bd6a, emissive: 0xffc870, emissiveIntensity: .55, metalness: .6, roughness: .2 });
  // the gold crystal chandeliers in the photos: three tiers of hanging prisms on gold rings, one warm lamp, a soft pool on the floor
  const crystalChandelier = (x, z, y = 2.75) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.6, 6), MAT.chrome); rod.position.y = 1.55; g.add(rod);
    const prism = new THREE.CylinderGeometry(.035, .02, .36, 5);
    for (const [r, n, h] of [[.55, 22, 0], [.4, 16, .22], [.24, 10, .42]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 4, 24), crystal); ring.rotation.x = Math.PI / 2; ring.position.y = h + .18; g.add(ring);
      for (let i = 0; i < n; i++) { const a = i / n * 6.283, c = new THREE.Mesh(prism, crystal); c.position.set(Math.cos(a) * r, h, Math.sin(a) * r); g.add(c); }
    }
    pointLight(ZN, 0xffcf8a, 1.6, 9, x, y - .3, z);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, .03, z); pool.userData.dyn = true; scene.add(pool);
  };
  const ledLine = (x, z, len, ns) => box(ns ? .07 : len, .04, ns ? len : .07, ledBar, x, 2.95, z, { cast: false });   // the linear pendants over the desks
  const blind = col(0xe0d3b6, 1, { transparent: true, opacity: .82, side: THREE.DoubleSide });
  const hazard = std(canvasTex(32, 4, (g) => { for (let x = 0; x < 32; x += 8) { g.fillStyle = '#f2c418'; g.fillRect(x, 0, 4, 4); g.fillStyle = '#222'; g.fillRect(x + 4, 0, 4, 4); } }, { nearest: true }), 0);
  const painting = (draw) => new THREE.MeshStandardMaterial({ map: canvasTex(128, 96, draw, { keep: true, smooth: true }), roughness: .8 });
  const wave = painting((g) => {
    const s = g.createLinearGradient(0, 0, 0, 96); s.addColorStop(0, '#f1e6d2'); s.addColorStop(1, '#d9c8a8'); g.fillStyle = s; g.fillRect(0, 0, 128, 96);
    for (const [y, c] of [[52, '#25456e'], [62, '#3d6e9e'], [72, '#c9a35a'], [82, '#1c3150']]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, 96); for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x / 18 + y) * 8); g.lineTo(128, 96); g.fill(); }
    g.strokeStyle = '#b08a4a'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 92);
  });
  const abstract = painting((g) => {
    g.fillStyle = '#ece8e2'; g.fillRect(0, 0, 128, 96);
    for (const [x, y, r, c] of [[40, 40, 34, '#d8574a'], [86, 58, 28, '#9aa4ae'], [60, 70, 18, '#2f3a48'], [100, 26, 14, '#e9a090']]) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * .7, .6, 0, 7); g.fill(); }
    g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 80); g.bezierCurveTo(50, 10, 80, 90, 120, 20); g.stroke();
  });
  const hang = (m, w, h, x, y, z, ry, parent = scene) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p); return p; };
  const roomDress = (x0, z0, x1, z1) => plane(x1 - x0 - .3, z1 - z0 - .3, carpet, (x0 + x1) / 2, .018, (z0 + z1) / 2, 1);   // the rooms' grey carpet
  const glassRoom = (x0, z0, x1, z1, front, name, lines, o = {}) => { room(x0, z0, x1, z1, front, name, lines, Object.assign({ wall: graphite }, o)); roomDress(x0, z0, x1, z1); };
  const twoSided = (m) => m.userData.two || (m.userData.two = Object.assign(m.clone(), { side: THREE.DoubleSide }));
  // the teal and green velvet tub chairs from the photos: a round seat, a curved shell back wrapping round to the arms, four splayed wooden legs
  const shellChair = (x, z, ry, m = teal) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .34, 6), MAT.walnut), g); l.position.set(dx, .17, dz); l.rotation.set(dz * .5, 0, -dx * .5); }
    const seat = add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .29, .14, 18), m), g); seat.position.y = .4;
    const back = add(new THREE.Mesh(new THREE.CylinderGeometry(.33, .3, .42, 18, 1, true, Math.PI * .35, Math.PI * 1.3), twoSided(m)), g); back.position.y = .66;
    colCirc(x, z, .38);
  };
  // the beige leather bar chairs at the window counter and in the booths: a black pole and foot ring, a padded seat with a low curved back (toward +z)
  const barSeat = col(0xc9b39a, .75);
  const barChair = (x, z, turn = 0) => {   // turn: which way the low back sits (0: toward +z, PI/2: toward +x)
    box(.05, .7, .05, MAT.charcoal, x, 0, z); box(.38, .02, .38, MAT.charcoal, x, .02, z);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.17, .012, 4, 16), MAT.gold)); ring.rotation.x = Math.PI / 2; ring.position.set(x, .3, z);
    const seat = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .09, 16), barSeat)); seat.position.set(x, .74, z);
    const back = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .3, 16, 1, true, turn - Math.PI * .4, Math.PI * .8), twoSided(barSeat))); back.position.set(x, .93, z);
  };

  // ---- meeting-room furniture, laid out from the photos (each room's own group, so it fades with the room) ----
  const tan = col(0xa36f45, .6), greyLeather = col(0x8e8d8a, .55);
  const toward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);   // the turn that points a chair's front (+z) at (tx, tz)
  // a high-backed swivel chair: padded seat, back and arms, a chrome column on a star base
  const officeChair = (x, z, ry, m, p) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; p.add(c);
    box(.5, .1, .48, m, 0, .44, 0, { p: c }); box(.48, .64, .09, m, 0, .5, -.25, { p: c });
    for (const sx of [-1, 1]) box(.05, .18, .34, m, sx * .27, .54, -.02, { p: c });
    box(.07, .4, .07, MAT.chrome, 0, .04, 0, { p: c }); box(.6, .04, .06, MAT.chrome, 0, .02, 0, { p: c }); box(.06, .04, .6, MAT.chrome, 0, .02, 0, { p: c });
  };
  // a table top on a dark pedestal frame; lx along x, lz along z
  const table = (cx, cz, lx, lz, top, p) => {
    box(lx, .06, lz, top, cx, .72, cz, { p }); box(.12, .66, .12, MAT.charcoal, cx - (lx > lz ? lx * .3 : 0), .06, cz - (lx > lz ? 0 : lz * .3), { p }); box(.12, .66, .12, MAT.charcoal, cx + (lx > lz ? lx * .3 : 0), .06, cz + (lx > lz ? 0 : lz * .3), { p });
    box(.06, .02, .3, MAT.charcoal, cx, .78, cz, { p, cast: false });   // the cable box in the middle
  };
  // a wall screen facing +z after the turn ry
  // the screens are off in every photo: dark glass with a soft sheen (a texture keeps it dark; a plain colour would be lifted to the palette's floor)
  const tvOff = std(canvasTex(64, 36, (q) => { const gr = q.createLinearGradient(0, 0, 64, 36); gr.addColorStop(0, '#30333a'); gr.addColorStop(.45, '#23262b'); gr.addColorStop(.55, '#3d4149'); gr.addColorStop(1, '#202227'); q.fillStyle = gr; q.fillRect(0, 0, 64, 36); }, { smooth: true }), 0, { roughness: .12, metalness: .2 });
  const offFaces = [MAT.charcoal, MAT.charcoal, MAT.charcoal, MAT.charcoal, tvOff, MAT.charcoal];
  // the small things: remotes on the tables, switch and AC panels by the doors, bins in the corners, books on a shelf
  const remote = (x, z, ry, p) => box(.05, .02, .16, MAT.charcoal, x, .75, z, { p, ry, cast: false });
  const panel = (x, y, z, ry, p) => box(.12, .12, .02, MAT.white, x, y, z, { p, ry, cast: false });
  const binAt = (x, z, p) => { const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .3, 10), MAT.charcoal), p); b.position.set(x, .15, z); };
  const books = (x, y, z, w, p) => { for (let bx = x - w / 2 + .03; bx < x + w / 2 - .05;) { const t = .03 + decorRandom() * .03; box(t, .17 + decorRandom() * .08, .18, [MAT.pink, MAT.navy3, MAT.yellowBoard, MAT.white, MAT.walnut][decorRandom() * 5 | 0], bx, y, z, { p }); bx += t + .006; } };
  const tv = (x, y, z, ry, w, faces, p) => { const t = new THREE.Mesh(new THREE.BoxGeometry(w, w * .57, .06), faces); t.position.set(x, y, z); t.rotation.y = ry; add(t, p, false); };
  // the whiteboard on a wooden easel, as in every room's photo
  const easel = (x, z, ry, p) => {
    const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.y = ry; p.add(e);
    for (const sx of [-.32, .32]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, 1.75, 6), MAT.walnut), e); l.position.set(sx, .86, 0); l.rotation.z = -sx * .12; }
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, 1.6, 6), MAT.walnut), e); b.position.set(0, .8, -.32); b.rotation.x = -.25;
    box(.86, .66, .03, MAT.white, 0, 1.0, .04, { p: e }); box(.9, .04, .06, MAT.chrome, 0, .98, .06, { p: e });
  };
  const credenza = (x, z, len, ry, p) => { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; p.add(c); box(len, .72, .45, oakPale, 0, 0, 0, { p: c }); box(.02, .6, .02, MAT.charcoal, 0, .06, .23, { p: c }); };
  const ginkgo = painting((q) => {
    q.fillStyle = '#efeae0'; q.fillRect(0, 0, 128, 96); q.save(); q.translate(64, 70);
    for (let i = -6; i <= 6; i++) { q.fillStyle = i % 2 ? '#c9a24e' : '#a9803a'; q.beginPath(); q.moveTo(0, 0); q.arc(0, 0, 44, -Math.PI / 2 + i * .2 - .1, -Math.PI / 2 + i * .2 + .1); q.fill(); }
    q.strokeStyle = '#6b5530'; q.lineWidth = 2; q.beginPath(); q.moveTo(0, 0); q.lineTo(6, 24); q.stroke(); q.restore();
    q.strokeStyle = '#2a2a2a'; q.lineWidth = 4; q.strokeRect(2, 2, 124, 92);
  });
  const goldTree = (x, y, z, p) => { const t = add(new THREE.Mesh(new THREE.ConeGeometry(.12, .4, 7), MAT.gold), p); t.position.set(x, y + .26, z); box(.1, .06, .1, MAT.charcoal, x, y, z, { p }); };
  // a fan palm in a patterned pot (the one by the window counter)
  const palm = (x, z) => {
    const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .2, .5, 12), std(canvasTex(16, 16, (q) => { q.fillStyle = '#ece8e0'; q.fillRect(0, 0, 16, 16); q.fillStyle = '#3a3a3c'; for (let i = 0; i < 16; i += 4) { q.fillRect(i, 0, 2, 16); } }, { nearest: true }), .4))); pot.position.set(x, .25, z);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, f = new THREE.Mesh(new THREE.BoxGeometry(.16, .02, .85), MAT.leafA); f.rotation.order = 'YXZ'; f.rotation.set(-.55 - (i % 3) * .2, a, 0); f.position.set(x + Math.sin(a) * .32, .95 + (i % 3) * .18, z + Math.cos(a) * .32); add(f); }
    colCirc(x, z, .3);
  };

  // ---- the shell: four storeys of glass under us, the slab, the floor (as on the second floor) ----
  plane(130, 130, MAT.darkGrass, cx, GROUND, Z(-4), 2);
  plane(150, 6, MAT.concrete, cx, GROUND + .01, SE + 5.6, 1.5); plane(150, 3, MAT.paver, cx, GROUND + .02, SE + 2, 3);   // road and pavement
  for (const x of [-30, -14, 2, 18, 34]) box(4.2, .12, .5, MAT.white, cx + x, GROUND + .01, SE + 5.6, { cast: false });
  faceBox(L(14.4) + .3, -GROUND - .05, L(26.2) + .3, facade, X(0), GROUND, Z(.3)); faceBox(L(5.2) + .3, -GROUND - .05, L(1.3) + .3, facade, X(4.6), GROUND, Z(-13.45));
  box(L(14.4) + .5, .3, L(26.2) + .5, MAT.concrete, X(0), -.32, Z(.3)); box(L(5.2) + .5, .3, L(1.3) + .5, MAT.concrete, X(4.6), -.32, Z(-13.45));
  plane(L(14.4), L(26.2), floor4, X(0), .012, Z(.3), 5); plane(L(5.2), L(1.3), floor4, X(4.6), .012, Z(-13.45), 5);
  box(L(16), .5, 1.6, MAT.concrete, cx, -.49, SE + 1, { cast: false });
  WALK.push([X(-7.2) + .2, Z(-12.8) + .2, X(7.2) - .2, SE - .2], [X(2) + .2, Z(-14.1) + .2, X(7.2) - .2, Z(-12.8) + .4]);
  NPC_BOUNDS[ZN] = [X(-7), Z(-12.5), X(7), Z(9.3)];

  // window walls, as downstairs, with the beige roller blinds pulled a third of the way down
  const windowRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = x0 === x1 ? Math.PI / 2 : 0;
    const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = ry; scene.add(g);
    box(len, .55, .3, MAT.plaster, 0, 0, 0, { p: g }); box(len, 2.55, .06, MAT.paneGlass, 0, .55, 0, { p: g, cast: false });
    box(len, .3, .3, MAT.plaster, 0, 3.1, 0, { p: g });
    for (let s = 0; s <= len; s += 3.6) box(.14, 3.4, .32, MAT.paneFrame, s - len / 2, 0, 0, { p: g });
    box(len, .75, .02, blind, 0, 2.35, .12, { p: g, cast: false });
  };
  windowRun(X(-7.2), Z(-12.8), X(2), Z(-12.8));
  windowRun(X(2), Z(-14.1), X(7.2), Z(-14.1));
  box(.3, 3.4, L(1.3), MAT.plaster, X(2), 0, Z(-13.45)); colBox(X(2) - .15, Z(-14.1), X(2) + .15, Z(-12.8));
  windowRun(X(-7.2), Z(-12.8), X(-7.2), Z(5.3));
  sunShafts(ZN, X(-7.2) + .1, Z(-12.8), Z(5.3), 3.6, .55, 3.1);   // the same low afternoon sun through the west windows
  box(.3, 3.4, L(8.1), MAT.plaster, X(-7.2), 0, Z(9.35));
  windowRun(X(7.2), Z(-14.1), X(7.2), Z(3.5));
  box(.3, 3.4, L(9.9), MAT.plaster, X(7.2), 0, Z(8.45));
  for (let i = 0; i < 16; i++) tree(cx + rr(-24, 24), cz + rr(-34, -26), rr(1.2, 1.7), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false).position.y = GROUND;
  for (let i = 0; i < 14; i++) { const s = rnd() < .5 ? -1 : 1; tree(cx + s * rr(13, 24), cz + rr(-24, 12), rr(1.2, 1.6), MAT.leafB, false).position.y = GROUND; }
  pointLight(ZN, 0xfff0dc, 1.05, 15, X(-4), 2.4, Z(-11)); pointLight(ZN, 0xfff0dc, 1.05, 15, X(4.5), 2.4, Z(-11.5)); pointLight(ZN, 0xfff0dc, .9, 13, X(-5.6), 2.4, Z(-1));
  INTER.push({ x: X(-6.2), z: Z(-12.1), r: 1.6, label: 'The view', verb: 'Look', act: () => talk('Fourth floor', ['Balewadi from four floors up: new towers, a green-netted one still going up, and the hills beyond.', 'Two floors above the Prompt Lab. Same chai, better view.']) });

  // ---- south: the lift and electrical duct, the fire-exit stairs, the waiting area ----
  box(L(14.4), 1.1, .2, MAT.plaster, X(0), 0, SE); colBox(X(-7.2), SE - .2, X(7.2), SE + .2);
  const LX = X(-1.05), LZ = Z(9.5), EX = X(.95), lift = grp();
  box(L(4), 3.4, SE - LZ, MAT.plaster, X(-.4), 0, (LZ + SE) / 2, { p: lift });
  box(2.8, 3.4, .1, blackMarble, LX, 0, LZ - .05, { p: lift });   // the lift's black marble wall
  for (const dx of [-.31, .31]) box(.6, 2.3, .06, MAT.steel, LX + dx, 0, LZ - .12, { p: lift });
  box(.02, 2.32, .07, MAT.charcoal, LX, 0, LZ - .13, { p: lift }); box(1.5, .14, .08, MAT.steel, LX, 2.3, LZ - .12, { p: lift });
  box(.12, .3, .04, MAT.steel, LX + .95, 1.05, LZ - .12, { p: lift });
  box(.8, 2.2, .06, MAT.slat, EX, 0, LZ - .03, { p: lift }); box(.7, .28, .07, MAT.elecSign, EX, 1.75, LZ - .06, { p: lift, s: 0 });
  makeFader(compact(lift), () => hero.zone === ZN && hero.x > X(-3.4) && hero.x < X(2.2) && hero.y < LZ + .1 && hero.y > Z(1));
  colBox(X(-2.4), LZ - .1, X(1.6), SE);
  plane(1.6, .14, hazard, LX, .02, LZ - .3);
  ledSign(['LIFT · Ground · 2 · 4'], '#f6e3b4', LX, 3.75, LZ - .05, 1.9, .34);
  const g = AREAS.pune;   // the lift takes you down to the Calfus building's front doors, or to the second floor
  portal(LX, LZ - 1.3, a.color, ZN, 'pune', 'Ground Floor', { at: [g.cx + CB_ARRIVE[0], g.cz + CB_ARRIVE[1]] });
  INTER.push({ x: LX + 1.3, z: LZ - .45, r: 1, label: 'Lift · Floor 2', verb: 'Ride down', act: () => { if (!traveling) travel({ to: 'lab', zone: ZN }); } });
  INTER.push({ x: EX, z: LZ - .7, r: 1, label: 'Electrical Duct', verb: 'Read', act: () => talk('Electrical Duct', ['AUTHORISED PERSONNEL ONLY.', 'Same duct as downstairs, two floors further up. Still no Wi-Fi password taped inside.']) });
  // the fire-exit stairs, a closed block east of the lift with its door onto the waiting area; the toilets north of it, the service shaft by the pantry
  const core = grp(), WX = X(1.6);
  box(L(5.6), 3.4, SE - Z(6.4), MAT.concrete, X(4.4), 0, (Z(6.4) + SE) / 2, { p: core });
  box(.08, 2.4, 1.3, MAT.exit, WX - .04, 0, Z(7.3), { p: core }); box(.1, .1, 1.45, MAT.charcoal, WX - .05, 2.4, Z(7.3), { p: core });
  makeFader(compact(core), () => hero.zone === ZN && hero.x > X(1) && hero.y < SE && hero.y > Z(6.4) - 8);
  colBox(WX, Z(6.4), X(7.2), SE);
  const wc = grp();
  box(L(3.8), 3.4, L(7.4), MAT.plaster, X(3.3), 0, Z(2.7), { p: wc });   // the women's and men's toilets
  box(L(2), 3.4, L(2.9), MAT.plaster, X(6.2), 0, Z(4.95), { p: wc });     // the shaft south of the pantry
  for (const z of [2.4, 3.5]) box(.06, 2.2, .9, MAT.slat, X(1.4) - .03, 0, Z(z), { p: wc });
  box(L(3.8), 3.4, .06, brick, X(3.3), 0, Z(-1) - .03, { p: wc });         // the collab area's brick wall
  box(2.7, .85, .06, MAT.charcoal, X(3.3), 1.35, Z(-1) - .09, { p: wc }); box(2.6, .76, .02, MAT.screens[3], X(3.3), 1.4, Z(-1) - .13, { p: wc });
  makeFader(compact(wc), () => hero.zone === ZN && hero.x > X(1) && hero.y < Z(6.4) && hero.y > Z(-1) - 8);
  colBox(X(1.4), Z(-1), X(5.2), Z(6.4)); colBox(X(5.2), Z(3.5), X(7.2), Z(6.4));
  signBoard('TOILETS', X(1.4) - .12, 2.55, Z(2.95), 1.1, .3, Math.PI / 2, { size: 18, bg: PAL.plum, w: 150, h: 40 });
  INTER.push({ x: X(1.4) - .5, z: Z(2.95), r: 1.2, label: 'Toilets', verb: 'Read', act: () => talk('Toilets', ['Women\'s first, men\'s just past it, down the little passage.', 'A note by the basin: "Turn the tap off. The planet is not a test environment."']) });
  INTER.push({ x: WX - .6, z: Z(7.3), r: 1.1, label: 'Emergency Exit', verb: 'Read', act: () => talk('Emergency Exit', ['FIRE EXIT · STAIRCASE. A 4 on the landing, black granite steps, the red hose reel on the wall.', 'Two floors down is the Prompt Lab. The lift is quicker, and it does not set off the alarm.']) });
  // the waiting area: the check sofa under the wave painting, a teal chair by the fire door, the Sprint banner by the lift, a plant
  sofa(X(.2), Z(6.6) + .6, 0, .85, plaid);   // against Rajgad's back wall, facing the lift
  { const w = hang(wave, 1.5, 1.1, X(.2), 1.75, Z(6.6) + .12, 0), sc = box(.9, .16, .14, crystal, X(.2), 2.5, Z(6.6) + .18, { cast: false }); w.userData.dyn = sc.userData.dyn = true; makeFader([w, sc], () => hero.zone === ZN && hero.x > X(-1.9) - .6 && hero.x < X(1.4) + .6 && hero.y < Z(6.6) && hero.y > Z(3.8) - 8); }   // fades with the room
  shellChair(X(1.15), Z(7.9), -Math.PI / 2);   // by the fire door
  { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .03, 16), MAT.white)); t.position.set(X(1.15), .55, Z(7.9) + .6); box(.04, .55, .04, MAT.walnut, X(1.15), 0, Z(7.9) + .6); colCirc(X(1.15), Z(7.9) + .6, .22); }   // its little round side table
  bigPlant(X(1.4), Z(6.6) + .5);   // the tall plant beside the sofa
  bigPlant(X(.3), Z(9.2));
  {
    const banner = new THREE.MeshStandardMaterial({ map: canvasTex(128, 320, (q) => {
      const s = q.createLinearGradient(0, 0, 0, 320); s.addColorStop(0, '#0d1418'); s.addColorStop(1, '#16302c'); q.fillStyle = s; q.fillRect(0, 0, 128, 320);
      q.fillStyle = '#fff'; q.font = '600 9px Arial'; q.fillText('Calfus  ⊗  Aetherion', 8, 18);
      q.fillStyle = '#fff'; q.font = '800 15px Arial'; q.fillText('SCHRÖDINGER\'S', 8, 150); q.fillStyle = '#5fe0c0'; q.font = 'italic 800 24px Arial'; q.fillText('SPRINT', 8, 176);
      q.fillStyle = '#5fe0c0'; q.font = '800 17px Arial'; q.fillText('DECEMBER', 8, 262); q.fillText('4–5, 2026', 8, 282);
    }, { keep: true, smooth: true }) });
    const bx = X(-2.05), bz = LZ - .3;   // west of the lift doors, in front of the marble
    hang(banner, .8, 2, bx, 1.08, bz, 0); box(.86, .07, .22, MAT.steel, bx, 0, bz); colBox(bx - .45, bz - .15, bx + .45, bz + .15);
    INTER.push({ x: bx + .2, z: bz - .9, r: 1, label: 'Schrödinger\'s Sprint', verb: 'Read', act: () => talk('Schrödinger\'s Sprint', ['The same roll-up banner as in the lobby: a 36-hour hackathon, December 4 to 5, 2026.', '"From first line to enterprise-ready." Someone has pencilled a team name on the back.']) });
  }
  crystalChandelier(X(-.3), Z(8.1));
  pointLight(ZN, 0xffb060, 1.1, 6, X(0), .5, Z(8.2));
  INTER.push({ x: X(-.3), z: Z(8.1), r: 1.4, label: 'Waiting Area', verb: 'Read', act: () => talk('Fourth Floor', ['Welcome to the fourth floor!', 'Meeting rooms named after the Sahyadri forts: Rajgad and Lohagad in the middle, Torna, Cabin 1 and Sinhagad down the west side.', 'Desks to the north, the collab area and pantry to the north-east.']) });

  // ---- the middle: Rajgad and Lohagad facing the corridor, the 4' passage to the toilets between them ----
  glassRoom(X(-1.9), Z(3.8), X(1.4), Z(6.6), 'w', 'Rajgad', ['Rajgad.', 'A round walnut table, three mesh chairs, a whiteboard on an easel. On it: "Hallucination = confident + wrong. Ask for sources."'], { table: 'none', tv: false, sMat: greyPlaster, dress: (g) => {   // round walnut table, three mesh chairs, a work desk with two monitors in the back corner, the screen on the south wall, the easel by the door
    const x0 = X(-1.9), x1 = X(1.4), z0 = Z(3.8), z1 = Z(6.6), cx = (x0 + x1) / 2 - .1, cz = (z0 + z1) / 2 + .2;
    const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .05, 24), MAT.walnut), g); t.position.set(cx, .74, cz); box(.14, .72, .14, MAT.charcoal, cx, 0, cz, { p: g });
    for (const [dx, dz] of [[0, -.95], [.95, .1], [-.1, .95]]) officeChair(cx + dx, cz + dz, toward(cx + dx, cz + dz, cx, cz), MAT.charcoal, g);
    const dx0 = x1 - .85, dz0 = z0 + .45;
    box(1.3, .05, .6, MAT.walnut, dx0, .72, dz0, { p: g }); box(.5, .72, .55, MAT.walnut, dx0 + .38, 0, dz0, { p: g });
    for (const mx of [-.25, .25]) { box(.5, .32, .03, MAT.charcoal, dx0 + mx, .92, dz0 - .15, { p: g }); box(.46, .28, .01, nextScreen(), dx0 + mx, .94, dz0 - .13, { p: g }); }
    officeChair(dx0, dz0 + .65, Math.PI, greyLeather, g);
    tv(cx, 1.55, z1 - .14, Math.PI, 1.6, offFaces, g); box(.02, .45, .02, MAT.charcoal, cx + .35, .9, z1 - .14, { p: g, cast: false });   // its cable hanging down
    easel(x0 + .7, z0 + .65, toward(x0 + .7, z0 + .65, cx, cz), g);
    keyboardAt(dx0, .77, dz0 + .12, 1, g); box(.1, .05, .05, MAT.charcoal, dx0, 1.1, dz0 - .15, { p: g });   // keyboard, and the webcam between the monitors
    box(.14, .02, .3, MAT.white, cx, .77, cz, { p: g, cast: false });   // the white cable box on the table
    panel(x1 - .12, 1.25, cz + .9, Math.PI / 2, g); binAt(x1 - .3, z1 - .3, g);
    colCirc(cx, cz, 1.25); colBox(dx0 - .65, z0, dx0 + .65, dz0 + .35);
  } });
  glassRoom(X(-1.9), Z(-1.1), X(1.4), Z(1.9), 'w', 'Lohagad', ['Lohagad.', 'Grey marble, tan leather chairs, a gold ginkgo leaf on the wall.', 'Today\'s slide: “Context windows: what a model can hold in mind at once.”'], { table: 'none', tv: false, sMat: greyPlaster, dress: (g) => {   // table north-south toward the two screens, the ginkgo pillar between two credenzas at the south end, felt on the east wall
    const x0 = X(-1.9), x1 = X(1.4), z0 = Z(-1.1), z1 = Z(1.9), cx = (x0 + x1) / 2 + .15, cz = (z0 + z1) / 2 + .1;
    table(cx, cz, 1.1, 2.4, greyMarble, g);
    for (const dz of [-.75, 0, .75]) for (const sx of [-1, 1]) officeChair(cx + sx * .95, cz + dz, toward(cx + sx * .95, 0, cx, 0), tan, g);
    for (const dx of [-.68, .68]) tv(cx + dx, 1.5, z0 + .14, 0, 1.32, offFaces, g); box(.8, .07, .08, MAT.charcoal, cx, 1.02, z0 + .17, { p: g });   // two screens side by side, the video bar under them
    box(.5, 3, .25, greyPlaster, cx, 0, z1 - .22, { p: g }); hang(ginkgo, .55, .75, cx, 1.65, z1 - .35, Math.PI, g);   // the pillar with the ginkgo
    credenza(cx - 1.05, z1 - .35, 1.1, Math.PI, g); credenza(cx + 1.05, z1 - .35, 1.1, Math.PI, g);
    deskPlant(cx - 1.3, .72, z1 - .35, g); deskPlant(cx - .85, .72, z1 - .35, g); goldTree(cx + 1.15, .72, z1 - .35, g);
    for (const [dz, y] of [[-1.1, .9], [-.35, 1.4], [.4, .7], [1.15, 1.25]]) box(.03, .9, .6, felt, x1 - .13, y, cz + dz, { p: g, s: 0 });
    easel(x1 - .55, cz + .55, toward(x1 - .55, cz + .55, cx, cz), g);   // in front of the felt panels
    { const gl = add(new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), MAT.chrome), g); gl.position.set(cx + .72, .92, z1 - .35); box(.08, .1, .08, MAT.charcoal, cx + .72, .72, z1 - .35, { p: g }); }   // the globe on the credenza
    remote(cx - .2, cz - .5, .3, g); remote(cx + .25, cz + .6, -.2, g); panel(x0 + .45, 1.25, z0 + .13, 0, g); binAt(x0 + .3, z1 - .3, g);
    colBox(cx - 1.2, cz - 1.4, cx + 1.2, cz + 1.4); colBox(cx - 1.65, z1 - .6, cx + 1.65, z1);
  } });

  // ---- the main corridor running north ----
  for (const z of [-4, 3.5]) crystalChandelier(X(-2.55), Z(z));
  ledSign(['FIRE EXIT'], '#7dff9a', X(-2.55), 2.75, Z(-1.5), 1.1, .3);

  // ---- west side, from the north: Torna, four benching rows along the windows, the printer by the pillar, Cabin 1 and Sinhagad ----
  const WR = X(-7.2) + .15, CX1 = X(-3.6);   // CX1: Cabin 1's glass front, set back to leave Sinhagad's door room beside it   // the west rooms stand right against the outer wall
  glassRoom(WR, Z(-10.5), X(-3.2), Z(-7.3), 'e', 'Torna', ['Torna, the big one.', 'A live-edge slab of wood for a table, eight grey chairs, two red-and-grey abstracts on the wall.', 'On the screen: “Evaluate before you automate.”'], { table: 'none', tv: false, sGlass: true, dress: (g) => {   // the live-edge table east-west, the two screens on a stand at the window end, bookshelf and the two abstracts on the north wall, glass to the desks
    const x0 = WR, x1 = X(-3.2), z0 = Z(-10.5), z1 = Z(-7.3), cx = (x0 + x1) / 2 + .2, cz = (z0 + z1) / 2 + .1;
    table(cx, cz, 3.2, 1.15, liveEdge, g);
    for (const dx of [-1.2, -.4, .4, 1.2]) for (const sz of [-1, 1]) officeChair(cx + dx, cz + sz * .95, toward(0, cz + sz * .95, 0, cz), greyLeather, g);
    for (const dz of [-.6, .6]) tv(x0 + .45, 1.55, cz + dz, Math.PI / 2, 1.15, offFaces, g); box(.08, .07, .8, MAT.charcoal, x0 + .47, 1.05, cz, { p: g });   // the camera bar under the screens
    box(.1, 1.2, .1, MAT.charcoal, x0 + .4, 0, cz, { p: g }); box(.5, .04, 1.1, MAT.charcoal, x0 + .4, .02, cz, { p: g });   // the screens' stand
    box(1.3, 2.1, .35, oakPale, x0 + .9, 0, z0 + .3, { p: g });
    for (const y of [.55, 1.05, 1.55]) box(1.24, .03, .3, MAT.white, x0 + .9, y, z0 + .28, { p: g });
    box(.03, 2.04, .3, MAT.white, x0 + .9, .03, z0 + .28, { p: g });
    box(.2, .25, .15, MAT.pink, x0 + .6, 1.08, z0 + .3, { p: g }); goldTree(x0 + 1.2, .58, z0 + .3, g); deskPlant(x0 + .6, .58, z0 + .3, g); box(.3, .2, .18, MAT.yellowBoard, x0 + 1.15, 1.58, z0 + .3, { p: g });
    for (const dx of [-.15, 1.0]) hang(abstract, 1.0, 1.35, cx + dx, 1.65, z0 + .13, 0, g);
    books(x0 + .6, 1.585, z0 + .3, .5, g); books(x0 + .9, .06, z0 + .3, 1.1, g);
    { const sh = add(new THREE.Mesh(new THREE.TorusGeometry(.1, .035, 6, 14), MAT.gold), g); sh.position.set(x0 + 1.1, 1.2, z0 + .3); }   // the gold shell sculpture
    for (const y of [.95, 1.95]) box(x1 - x0, .04, .06, graphite, (x0 + x1) / 2, y, z1, { p: g, cast: false });   // the black glazing grid on the glass to the desks
    for (let x = x0 + 1.1; x < x1 - .3; x += 1.1) box(.04, 2.78, .06, graphite, x, .1, z1, { p: g, cast: false });
    remote(cx - .6, cz + .2, .4, g); panel(x1 - 1.2, 1.25, z0 + .13, 0, g);
    easel(x1 - .6, z0 + .6, toward(x1 - .6, z0 + .6, cx, cz), g);
    colBox(cx - 1.75, cz - 1.4, cx + 1.75, cz + 1.4); colBox(x0, z0, x0 + 1.6, z0 + .5); colBox(x0, cz - 1.1, x0 + .7, cz + 1.1);
  } });
  box(L(2.1), .9, .4, MAT.white, X(-4.3), 0, Z(-10.5) - .3); colBox(X(-5.35), Z(-10.5) - .5, X(-3.25), Z(-10.5) - .1);   // storage
  for (const z of [-5.75, -3.1, -.45, 2.2]) deskCluster(X(-5.2), Z(z), 3, false, { tight: true, pitch: 1.5 });
  for (let z = -6.4; z < 5; z += 2.2) deskPlant(X(-7.2) + .06, .55, Z(z));   // plants on the west window sill
  { // Cabin 1's back is a solid grey plaster wall running along x from the west windows to the pillar at its corner; the printer stands against it by the pillar,
    // the open bookshelf and an abstract further along, as in the photos. It fades with the cabin when it would hide you.
    const px = CX1 - .3, pz = Z(5.3) - .1, wz = Z(5.3) - .2, g = grp();   // wz: the wall's north face
    box(1, 3.4, .8, greyPlaster, px, 0, pz); colBox(px - .5, pz - .4, px + .5, pz + .4);   // the pillar
    box(px - .5 - WR, 3.4, .1, greyPlaster, (WR + px - .5) / 2, 0, wz + .05, { p: g });
    hang(abstract, 1.1, .8, X(-5.1), 1.8, wz - .01, Math.PI, g);
    makeFader(compact(g), () => hero.zone === ZN && hero.x > WR - .6 && hero.x < px + .6 && hero.y < Z(5.3) && hero.y > Z(5.3) - 8);
    const cx2 = px - .5 - .35, cz2 = wz - .26;
    box(.6, .75, .5, oakPale, cx2, 0, cz2); box(.5, .32, .44, MAT.white, cx2, .75, cz2); box(.36, .03, .22, MAT.charcoal, cx2, 1.07, cz2 - .05);
    colBox(cx2 - .3, cz2 - .25, cx2 + .3, cz2 + .25);
    INTER.push({ x: cx2, z: cz2 - .8, r: 1, label: 'Printer', verb: 'Look', act: () => talk('Printer', ['PC LOAD LETTER.', 'Even on the fourth floor, nobody knows what that means.']) });
    const bz = wz - .16;
    box(1.4, 1.8, .3, oakPale, X(-6.1), 0, bz); for (const y of [.6, 1.2]) box(1.34, .03, .28, MAT.white, X(-6.1), y, bz - .02);
    box(.2, .25, .15, MAT.pink, X(-6.1) - .35, 1.23, bz - .05); deskPlant(X(-6.1) + .3, .63, bz - .05);
    colBox(X(-6.1) - .7, bz - .15, X(-6.1) + .7, bz + .15); }
  bigPlant(X(-6.5), Z(4.1));
  glassRoom(WR, Z(5.3), CX1, Z(8.6), 'e', 'Cabin 1', ['Cabin 1.', 'A six-foot desk, a side cabinet, three chairs for visitors. The door is usually open.'], { table: 'none', tv: false, sMat: greyPlaster, dress: (g) => {   // the desk facing the door, a grey high-back chair behind it, two visitors' chairs, a side cabinet on the back wall
    const x0 = WR, x1 = CX1, z0 = Z(5.3), z1 = Z(8.6), cz = (z0 + z1) / 2, dx0 = x0 + 1.8;
    box(.85, .05, 1.8, MAT.walnut, dx0, .72, cz, { p: g }); box(.8, .7, .06, MAT.walnut, dx0, 0, cz - .85, { p: g }); box(.8, .7, .06, MAT.walnut, dx0, 0, cz + .85, { p: g });
    box(.04, .34, .55, MAT.charcoal, dx0 - .2, .9, cz, { p: g }); box(.01, .3, .5, nextScreen(), dx0 - .22, .92, cz, { p: g });
    officeChair(dx0 - .75, cz, Math.PI / 2, greyLeather, g);
    for (const dz of [-.55, .55]) officeChair(dx0 + .85, cz + dz, -Math.PI / 2, MAT.charcoal, g);
    box(.45, .7, 1.4, MAT.walnut, x0 + .3, 0, cz, { p: g }); deskPlant(x0 + .3, .7, cz + .4, g);
    box(.13, .02, .4, MAT.charcoal, dx0 - .25, .77, cz, { p: g }); box(.21, .006, .3, MAT.white, dx0 + .1, .77, cz + .5, { p: g, ry: .2 }); box(.08, .015, .17, MAT.charcoal, dx0, .77, cz - .55, { p: g });
    binAt(x0 + .3, z1 - .35, g); panel(x1 - 1, 1.25, z0 + .13, 0, g);
    colBox(dx0 - .45, cz - .95, dx0 + .45, cz + .95); colBox(x0, cz - .7, x0 + .55, cz + .7);
  } });
  // Sinhagad runs east right up to the lift's wall (no passage beside the lift); its door is at the north-east corner, onto the corridor
  const SZ0 = Z(8.6) + .25, SX1 = X(-2.4) - .1;
  crystalChandelier((WR + SX1) / 2 + .2, (SZ0 + SE - .2) / 2 + .1, 2.6);   // Sinhagad's own chandelier, seen through its glass from the lobby
  glassRoom(WR, SZ0, SX1, SE - .2, 'n', 'Sinhagad', ['Sinhagad.', 'A white stone table, grey leather chairs, and the brick wall with two screens.', 'Someone left the whiteboard full: “Tokens in, tokens out, and the bill in the middle.”'], { table: 'none', tv: false, sMat: greyPlaster, doorAt: (CX1 + .12 + SX1 - .12) / 2 - WR, doorW: 1.4, dress: (g) => {   // white table east-west toward the brick wall and its two screens, grey chairs, the easel by the glass, a crystal chandelier
    const x0 = WR, x1 = SX1, z0 = SZ0, z1 = SE - .2, cx = (x0 + x1) / 2 + .2, cz = (z0 + z1) / 2 + .1;
    table(cx, cz, 3.4, 1.2, whiteStone, g);
    for (const dx of [-1.1, 0, 1.1]) for (const sz of [-1, 1]) officeChair(cx + dx, cz + sz * 1.0, toward(0, cz + sz, 0, cz), greyLeather, g);
    officeChair(cx + 2.15, cz, -Math.PI / 2, greyLeather, g);
    for (const dz of [-.74, .74]) tv(x0 + .16, 1.65, cz + dz, Math.PI / 2, 1.42, offFaces, g);
    remote(cx - .5, cz + .3, .2, g); remote(cx + .6, cz - .25, -.3, g); panel(x1 - .12, 1.25, z0 + .9, Math.PI / 2, g);
    box(.06, .08, .9, MAT.charcoal, x0 + .17, 1.12, cz, { p: g });   // the soundbar
    easel(x1 - .65, z0 + .75, toward(x1 - .65, z0 + .75, cx, cz), g);
    const bin = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .3, 10), MAT.charcoal), g); bin.position.set(x0 + .35, .15, z1 - .4);
    colBox(cx - 1.85, cz - 1.45, cx + 2.5, cz + 1.45);
  } });
  box(.02, 3, SE - .2 - SZ0 - .3, brick, WR + .11, 0, (SZ0 + SE - .2) / 2);

  // ---- north: the counter with stools along the windows ----
  const NZ = Z(-12.8) + .3;
  box(X(.9) - X(-6.6), .06, .45, MAT.walnut, (X(.9) + X(-6.6)) / 2, 1.05, NZ); for (let x = -6.5; x < 1; x += 2.2) box(.05, 1.05, .05, MAT.white, X(x), 0, NZ);
  for (const x of [-5.9, -4.6, -3.3, -2, -.7, .5]) barChair(X(x), NZ + .45);
  colBox(X(-6.6), NZ - .25, X(.9), NZ + .25);
  bigPlant(X(.9), Z(-11.6));
  palm(X(-6.95), Z(-12.25));   // the fan palm at the west end of the window counter

  for (const z of [-5.75, -3.1, -.45, 2.2]) ledLine(X(-5.2), Z(z), 4.2, false);
  for (const x of [4.55, 1.5]) for (const z of [-9.3, -6.1]) ledLine(X(x), Z(z), 2.8, true);
  // ---- north-east: four desk pods, two half rows by the corridor, tall storage, the phone booths in the corner ----
  for (const x of [4.55, 1.5]) for (const z of [-9.3, -6.1]) deskCluster(X(x), Z(z), 2, true);
  for (const zc of [-9.3, -6.1]) {   // a single row of desks, everyone facing the corridor
    const r = new THREE.Group(); r.position.set(X(-.95), 0, Z(zc)); r.rotation.y = Math.PI / 2; scene.add(r);
    box(3.1, .05, .62, MAT.walnut, 0, .72, 0, { p: r }); for (const x of [-1.5, 0, 1.5]) box(.06, .72, .56, MAT.white, x, 0, 0, { p: r });
    for (const x of [-.75, .75]) { box(.6, .36, .04, MAT.charcoal, x, .9, -.2, { p: r }); box(.56, .32, .02, nextScreen(), x, .92, -.175, { p: r }); keyboardAt(x, .77, .1, 1, r); deskClutter(x + .4, .77, .15, r); chair(x, .8, 1, r); }
    colBox(X(-.95) - .35, Z(zc) - 1.6, X(-.95) + 1.1, Z(zc) + 1.6);
  }
  box(.5, .95, L(9), MAT.white, X(7.2) - .4, 0, Z(-6.1)); colBox(X(7.2) - .65, Z(-10.6), X(7.2), Z(-1.6));   // low cabinets down the east windows, plants on top
  for (const z of [-10, -8.2, -6.2, -4.4, -2.4]) deskPlant(X(7.2) - .4, .95, Z(z));
  // three phone booths at the window: black frames, a glass front, a high counter, two stools, yellow felt on the wall
  const bz0 = Z(-14.1) + .15, bz1 = Z(-12), bzm = (bz0 + bz1) / 2, FZ = Z(-11) + .1;   // FZ: the line of the wall and white cabinet in front of the booths
  for (const [p0, p1] of [[2.2, 3.85], [3.85, 5.5], [5.5, 7.2]]) {
    const x0 = X(p0) + .04, x1 = Math.min(X(p1), X(7.2) - .15), xm = (x0 + x1) / 2, w = x1 - x0, last = p1 === 7.2;
    // the corner booth is longer: it runs on to the white cabinet (its front), and its door is in its side, facing the passage, at right angles to the other two
    const end = last ? FZ - .15 : bz1;
    box(.08, 2.5, bz1 - bz0, graphite, x0, 0, bzm); box(.08, 2.5, end - bz0, graphite, x1, 0, (bz0 + end) / 2);
    const door = (len, cx, cz, along) => {   // a black-framed glass door: frame, pane, two glazing bars, a pull handle
      const B = (a, h, y, c = true) => along ? box(a, h, .06, graphite, cx, y, cz, { cast: c }) : box(.06, h, a, graphite, cx, y, cz, { cast: c });
      B(len, .1, 0); B(len, .14, 2.36); along ? box(len - .1, 2.26, .04, MAT.pane, cx, .1, cz, { cast: false }) : box(.04, 2.26, len - .1, MAT.pane, cx, .1, cz, { cast: false });
      for (const y of [.95, 1.75]) B(len - .1, .04, y, false);
      along ? box(.04, .5, .07, graphite, cx + len * .3, .75, cz + .05) : box(.07, .5, .04, graphite, cx - .05, .75, cz + len * .3);
    };
    if (last) { box(.08, 2.5, .08, graphite, x0, 0, bz1); door(end - bz1, x0, (bz1 + end) / 2, false); }
    else door(w, xm, bz1, true);
    box(.03, .8, (bz1 - bz0) * .6, felt, x0 + .06, .95, bzm, { s: 0 });
    if (!last) { box(w - .3, .05, .45, oakPale, xm, 1.02, bz0 + .3); box(.05, 1.02, .05, graphite, xm, 0, bz0 + .3); barChair(xm - w * .2, bz0 + .85); barChair(xm + w * .2, bz0 + .85); }
    else {   // windows on two sides; the counter runs along the side wall toward the window, the stools face that wall, switch plates above
      const d = bz1 - bz0;
      box(.45, .05, d - .5, oakPale, x0 + .3, 1.02, bzm + .15); box(.05, 1.02, .05, graphite, x0 + .45, 0, bzm + d / 2 - .25);
      barChair(x0 + .85, bzm - .2, Math.PI / 2); barChair(x0 + .85, bzm + .45, Math.PI / 2);
      for (const dz of [-.3, -.1, .05]) box(.02, .07, .07, MAT.charcoal, x0 + .06, 1.3, bzm + dz, { cast: false });
      INTER.push({ x: x0 - .6, z: (bz1 + end) / 2, r: 1, label: 'Corner Booth', verb: 'Read', act: () => talk('Corner Booth', ['The long one in the corner, glass on two sides, the door round the side.', 'Whoever books it never seems to finish their call.']) });
    }
    colBox(x0 - .04, bz0, x1, end + .05);
  }
  { // a passage's width in front of the booths (you walk into it from the west end): a pale plaster wall along the first two, the white cabinet in front of the last one, by the east windows
    const pale = col(0xc8c3ba, .9), fz = FZ, w0 = X(2) + .15, w1 = X(5.5), c1 = X(7.2) - .15;   // on the line of the window's step, starting at the corner
    const g = grp();   // fades when you are in the passage behind it
    box(w1 - w0, 2.5, .3, pale, (w0 + w1) / 2, 0, fz, { p: g }); colBox(w0, fz - .15, w1, fz + .15);
    // the red-and-blue abstract on its office side, as on the wall at the end of the desks in the photos
    hang(painting((q) => {
      q.fillStyle = '#f1ece4'; q.fillRect(0, 0, 128, 96);
      for (const [x, y, rx, ry, a, c] of [[44, 50, 40, 26, -.5, '#c8463a'], [84, 40, 34, 22, .4, '#2f5d8c'], [70, 62, 22, 14, .2, '#e8a07a'], [30, 30, 16, 10, .8, '#7fa6c9']]) { q.fillStyle = c; q.beginPath(); q.ellipse(x, y, rx, ry, a, 0, 7); q.fill(); }
      q.strokeStyle = '#1f2430'; q.lineWidth = 2; q.beginPath(); q.moveTo(8, 70); q.bezierCurveTo(40, 20, 90, 90, 120, 26); q.stroke();
      q.strokeStyle = '#d9c9a8'; q.lineWidth = 4; q.strokeRect(2, 2, 124, 92);
    }), 1.7, 1.2, (w0 + w1) / 2, 1.5, fz + .16, 0, g);
    box(c1 - w1, 2.2, .3, cabinet, (w1 + c1) / 2, 0, fz, { p: g }); colBox(w1, fz - .15, c1, fz + .15);
    makeFader(compact(g), () => hero.zone === ZN && hero.x > w0 - .6 && hero.x < c1 + .6 && hero.y < fz && hero.y > fz - 8);
  }
  INTER.push({ x: X(6.4), z: Z(-11) + 1.1, r: 1.3, label: 'Phone Booths', verb: 'Read', act: () => talk('Phone Booths', ['Three booths at the window, each with a high counter and two stools.', 'The best view on the floor, and you only get it while you are on mute.']) });

  // ---- the collab area, as in the photo: the sectional's back against the brick wall under the screens, its chaise at the west end by the pillar,
  // the gold coffee table with a chessboard at the east end, the carrom table and green tub chairs by the east windows, one rug under it all ----
  const BW = Z(-1) - .06, SX = X(3.3), SZ = BW - .5;   // the brick wall's face; the sofa's middle
  plane(L(5.6), L(3.4), MAT.felt, X(4.2), .02, Z(-2.8), 1);
  box(.7, 3.4, .7, MAT.plaster, X(1.4) + .2, 0, Z(-1) - .2); colBox(X(1.4) - .15, Z(-1) - .55, X(1.4) + .55, Z(-1));   // the pillar at the brick wall's west end
  sofa(SX, SZ, Math.PI, 1, leather);
  box(.95, .42, 1.8, leather, SX - .83, 0, BW - .95); colBox(SX - 1.3, BW - 1.85, SX - .35, BW);   // the chaise
  bigPlant(SX - 1.72, BW - .45);
  const chess = std(canvasTex(8, 8, (q) => { for (let i = 0; i < 64; i++) { q.fillStyle = (i + (i >> 3)) % 2 ? '#5a3a24' : '#ead8b8'; q.fillRect(i % 8, i >> 3, 1, 1); } }, { nearest: true }), 0);
  { const x = SX + 1.6, z = BW - .9;
    box(.5, .38, .5, MAT.gold, x, 0, z); box(.66, .04, .66, MAT.charcoal, x, .38, z); box(.36, .02, .36, chess, x, .42, z);
    for (let i = 0; i < 6; i++) { const pc = add(new THREE.Mesh(new THREE.CylinderGeometry(.012, .02, .05, 6), i % 2 ? MAT.charcoal : MAT.white)); pc.position.set(x - .14 + (i % 3) * .14, .455, z + (i < 3 ? -.15 : .15)); }
    colBox(x - .33, z - .33, x + .33, z + .33);
    INTER.push({ x: x - .2, z: z - .9, r: 1, label: 'Chessboard', verb: 'Look', act: () => talk('Chessboard', ['A game left mid-move on the coffee table. White is a knight up.', 'A sticky note: "Do not touch. Resuming after standup."']) }); }
  const tx = X(5.7), tz = Z(-3.6);
  for (const [dx, dz, ry] of [[-.95, 0, Math.PI / 2], [.95, 0, -Math.PI / 2], [0, -.95, 0], [0, .95, Math.PI]]) shellChair(tx + dx, tz + dz, ry, velvet);
  for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box(.05, .6, .05, MAT.charcoal, tx + dx, 0, tz + dz);
  box(1, .07, 1, MAT.carrom, tx, .6, tz, { s: 0 }); colCirc(tx, tz, .6);
  INTER.push({ x: tx - 1.7, z: tz, r: 1.3, label: 'Carrom Board', verb: 'Look', act: () => talk('Carrom Board', ['The fourth floor\'s board, by the window. The striker is missing, again.', 'The tournament table is two floors down, by the collab sofa on the second floor.']) });
  INTER.push({ x: SX + .4, z: BW - 1.6, r: 1.3, label: 'Collab Area', verb: 'Look', act: () => talk('Collab Area', ['The black leather sectional against the brick wall, two screens above it.', 'Friday demos happen here. So does Friday cricket on the big screen.']) });
  crystalChandelier(tx, tz);

  // ---- the pantry: a galley along the east windows, open to the collab area: white brick tiles, the counter, the water dispenser, the bins ----
  const PX = X(5.2), EW = X(7.2) - .15, CZ = Z(1.15), PS = Z(3.5);
  box(.03, 1.3, L(4.4), whiteTile, PX + .015, .9, CZ, { s: 0 });
  box(.6, .9, L(3.4), oakPale, PX + .3, 0, CZ - .5); box(.64, .05, L(3.4), MAT.white, PX + .32, .9, CZ - .5);
  box(.38, .75, L(3.2), graphite, PX + .19, 1.75, CZ - .5);
  for (const [z, h] of [[-1.6, .5], [-1.1, .42]]) { const u = add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, h, 12), MAT.steel)); u.position.set(PX + .3, .95 + h / 2, CZ + z); }
  box(.4, .42, .35, MAT.charcoal, PX + .3, .95, CZ + .2);   // the coffee machine
  for (let i = 0; i < 4; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .09, 8), MAT.white)); c.position.set(PX + .42, 1, CZ - .3 + i * .1); }
  colBox(PX, CZ - .5 - L(1.7), PX + .65, CZ - .5 + L(1.7));
  const DZ = PS - .5;   // the water dispenser at the far end
  box(.38, 1.05, .38, MAT.white, PX + .3, 0, DZ);
  const bottle = add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .48, 12), new THREE.MeshStandardMaterial({ color: 0x3a8fd6, transparent: true, opacity: .8, roughness: .2 }))); bottle.position.set(PX + .3, 1.3, DZ);
  colBox(PX, DZ - .25, PX + .45, PS);
  for (const [z, lid] of [[0, 0x2f7de0], [.55, 0x2aa05a]]) {   // wet and dry waste by the window, and the extinguisher
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .18, .7, 14), MAT.chrome)); b.position.set(EW - .3, .35, Z(-.7) + z);
    const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .03, 14), new THREE.MeshStandardMaterial({ color: lid }))); l.position.set(EW - .3, .71, Z(-.7) + z);
  }
  { const f = add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .5, 10), new THREE.MeshStandardMaterial({ color: 0xc8251c, roughness: .5 }))); f.position.set(EW - .25, .25, Z(-.7) + 1.05); }
  colBox(EW - .55, Z(-.7) - .25, EW, Z(-.7) + 1.2);
  pointLight(ZN, 0xffd6a0, 1, 7, (PX + EW) / 2, 2.6, CZ);
  INTER.push({ x: (PX + EW) / 2, z: CZ, r: 1.5, label: 'Pantry', verb: 'Look', act: () => talk('Pantry', ['White brick tiles, two urns of chai and coffee, the water dispenser at the end.', 'Wet waste and dry waste by the window. The fourth floor actually sorts it.']) });

  KIT_ZONE = 'lab'; MAT.charcoal = plum;
}
