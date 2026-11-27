// TokenFall: Calfus HQ, third floor (zone "cb3"), up the Crescent Bay lift. Laid out from the floor's fire escape plan and the team's photos
// (CB 3rd/). The plan has east at the top; here, as on the second floor, the camera looks north and the lift is at the south.
// The plan is about 26.2 m (north-south) by 14.2 m; scaled up by S like the second floor so there is room to walk, furniture real size.
//   south: the lift (black surround, steel doors) and the electrical duct, the waiting area with its lit planter,
//          the fire-exit stairs east of it; the Mont Blanc (conference room) in the south-west corner, beside the lift
//   west:  the 4'6" passage, then Matterhorn (discussion room), four desk pods and Santis (meeting room) down the west windows
//   middle: the server room, The Dom (discussion room), the toilets, a row of desks along their north face
//   east:  the pantry along the east windows (blue cabinets, black glass wall units, the fridge)
//   north: the collab area (green curved sofa, carrom on the rug, chandeliers), two desk pods, the calling booths in the north-east corner,
//          and a long counter with stools along the north windows
// Classic script: shares one global scope with the other js/game/files; loaded after office-kit.js and office-hq.js (CB_ARRIVE from crescent-bay.js).

const CB3_TEAM = [['priya.n', -3.5, -2.2], ['omkar_s', 3.6, -8], ['tanvi.j', -1.8, -4.6]];   // world metres from the zone's centre, in open aisles: the west passage, the aisle by the north-east desks, the rug's south end

function buildCB3(a) {
  const S = 1.4, { cx, cz } = a, X = x => cx + x * S, Z = z => cz + z * S, L = v => v * S, Z3 = 'cb3';
  const W0 = -7.1, W1 = 7.1, N0 = -13.1, S0 = 13.1;   // the floor's edges, plan metres
  const prevKit = KIT_ZONE; KIT_ZONE = Z3;
  // the workspace chairs, from the photos: a black mesh task chair. A fabric seat with a rounded front, a tall mesh back in a black frame that
  // curves in at the waist and leans back a little, the back's spine down to the seat, T-shaped armrests on tall posts, a gas column, a
  // five-star nylon base on twin-wheel casters. Swapped in for the kit's chair while this floor builds, so every desk here gets it.
  const kitChair = chair, frameK = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: .55 }), seatK = new THREE.MeshStandardMaterial({ color: 0x202124, roughness: .9 });
  const meshK = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: .8, transparent: true, opacity: .88, map: canvasTex(32, 32, (g) => { g.fillStyle = '#2a2b2f'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#0c0d0f'; for (let y = 0; y < 32; y += 3) for (let x = (y / 3 % 2) * 1.5; x < 32; x += 3) g.fillRect(x, y, 1.6, 1.6); }, { keep: true }) });
  meshK.map.wrapS = meshK.map.wrapT = THREE.RepeatWrapping; meshK.map.repeat.set(4, 5);
  const seatGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(-.25, -.22); sh.lineTo(.25, -.22); sh.quadraticCurveTo(.27, .2, .2, .26); sh.lineTo(-.2, .26); sh.quadraticCurveTo(-.27, .2, -.25, -.22); const g = new THREE.ExtrudeGeometry(sh, { depth: .07, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 3 }); g.rotateX(Math.PI / 2); return g; })();
  const casterGeo = new THREE.CylinderGeometry(.03, .03, .035, 10);
  chair = (x, z, side, p, m) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side > 0 ? 0 : Math.PI; (p || scene).add(g);   // built with its back on +z, like the kit chair at side +1
    // the base: five legs, twin-wheel casters, the gas column
    for (let i = 0; i < 5; i++) { const a = i * 1.2566, leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .035, .3), frameK); leg.rotation.y = a; leg.position.set(Math.sin(a) * .15, .07, Math.cos(a) * .15); g.add(leg);
      for (const o of [-.012, .012]) { const c = new THREE.Mesh(casterGeo, frameK); c.rotation.z = Math.PI / 2; c.position.set(Math.sin(a) * .3 + o, .03, Math.cos(a) * .3); g.add(c); } }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .34, 8), frameK); col.position.y = .24; g.add(col);
    // the seat, soft black fabric
    const st = new THREE.Mesh(seatGeo, seatK); st.position.set(0, .5, -.02); g.add(st);
    // the back: two black side rails pinched at the waist, a top bar and a lumbar bar, the mesh between them, leaning back
    const bk = new THREE.Group(); bk.position.set(0, .5, .24); bk.rotation.x = .16; g.add(bk);
    for (const sx of [-1, 1]) {
      const lo = new THREE.Mesh(new THREE.BoxGeometry(.035, .3, .04), frameK); lo.position.set(sx * .2, .2, .02); lo.rotation.z = sx * -.12; bk.add(lo);
      const hi = new THREE.Mesh(new THREE.BoxGeometry(.035, .42, .04), frameK); hi.position.set(sx * .23, .55, 0); hi.rotation.z = sx * .06; bk.add(hi);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(.5, .045, .045), frameK); top.position.set(0, .77, 0); bk.add(top);
    const lum = new THREE.Mesh(new THREE.BoxGeometry(.38, .04, .04), frameK); lum.position.set(0, .08, .03); bk.add(lum);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.44, .66, .012), meshK); mesh.position.set(0, .44, 0); bk.add(mesh);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(.08, .2, .05), frameK); spine.position.set(0, .45, .2); spine.rotation.x = .5; g.add(spine);
    // T armrests on tall posts
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.04, .22, .07), frameK); post.position.set(sx * .27, .63, .02); g.add(post);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(.08, .03, .26), frameK); pad.position.set(sx * .27, .75, -.02); g.add(pad);
    }
  };
  // the third floor's chandeliers, from the photos: a champagne-gold rod and stem, two tiers of curved crystal arms, each ending in a cup with a
  // candle bulb, and strings of crystal drops hanging below; it lights the floor round it
  const crystal = new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: .15, metalness: .2, transparent: true, opacity: .85 }), champ = new THREE.MeshStandardMaterial({ color: 0xc8a96a, metalness: .7, roughness: .3 });
  const flame = new THREE.MeshBasicMaterial({ color: 0xfff1c6 });
  const chandelier = (x, z, y = 3.0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); g.userData.dyn = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.6, 6), champ); rod.position.y = .9; g.add(rod);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .7, 10), crystal); stem.position.y = -.1; g.add(stem);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8), crystal); bowl.position.y = -.45; g.add(bowl);
    for (const [n, r, h] of [[10, .62, -.25], [6, .34, .05]]) for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + h, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const arm = new THREE.Mesh(new THREE.TorusGeometry(r / 2, .018, 5, 10, Math.PI), crystal); arm.position.set(cx / 2, h - .05, cz / 2); arm.rotation.set(0, -a, Math.PI); g.add(arm);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(.06, .03, .06, 8), crystal); cup.position.set(cx, h, cz); g.add(cup);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .1, 6), MAT.white); candle.position.set(cx, h + .08, cz); g.add(candle);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), flame); bulb.scale.y = 1.5; bulb.position.set(cx, h + .16, cz); g.add(bulb);
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(.035), crystal); drop.scale.y = 1.8; drop.position.set(cx * .9, h - .28, cz * .9); g.add(drop);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .2, 3), crystal); str.position.set(cx * .9, h - .16, cz * .9); g.add(str);
    }
    pointLight(Z3, 0xffd9a0, 1.9, 10, x, y - .5, z);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, .03, z); pool.userData.dyn = true; scene.add(pool);
  };
  const green = new THREE.MeshStandardMaterial({ color: 0x3f8f6a, roughness: .85 }), blue = new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: .5 });
  const rack = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: .4, metalness: .4 }), ledG = glowStrip(0x5dff9a), ledR = glowStrip(0xff5a4a);

  // ---- the floor and the city two storeys below ----
  const GROUND = -8.2;
  plane(150, 150, MAT.darkGrass, cx, GROUND, cz, 2);
  plane(160, 6, MAT.concrete, cx, GROUND + .01, Z(S0) + 6, 1.5); plane(160, 3, MAT.paver, cx, GROUND + .02, Z(S0) + 2.4, 3);
  box(L(W1 - W0) + .3, -GROUND - .05, L(S0 - N0) + .3, MAT.glass, cx, GROUND, cz);   // the floors below: blue glass
  box(L(W1 - W0) + .5, .3, L(S0 - N0) + .5, MAT.concrete, cx, -.32, cz);
  plane(L(W1 - W0), L(S0 - N0), MAT.oFloor, cx, .012, cz, 5);
  WALK.push([X(W0) + .2, Z(N0) + .2, X(W1) - .2, Z(S0) - .2]);
  // the window bay: on the plan the north glass, with its counter and the two calling booths, stands proud of the floor's line (it hangs out
  // over the street in the photos), so the window corridor is a full passage, not a ledge
  // only the east end steps out (the plan's top-left corner): from BX0 to the east wall the glass stands NB proud; west of it the glass
  // stays on the floor's line, with the bar chairs along it
  const NB = N0 - 1.1, BX0 = 2.4, bxm = (X(BX0) + X(W1)) / 2, bwid = L(W1 - BX0);
  box(bwid + .15, -GROUND - .05, L(N0 - NB), MAT.glass, bxm, GROUND, (Z(NB) + Z(N0)) / 2); box(bwid + .25, .3, L(N0 - NB) + .2, MAT.concrete, bxm, -.32, (Z(NB) + Z(N0)) / 2);
  plane(bwid, L(N0 - NB), MAT.oFloor, bxm, .012, (Z(NB) + Z(N0)) / 2, 5);
  WALK.push([X(BX0) + .2, Z(NB) + .2, X(W1) - .2, Z(N0) + .4]);
  for (let i = 0; i < 18; i++) tree(cx + rr(-26, 26), cz + rr(-40, -30), rr(1.2, 1.8), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false).position.y = GROUND;
  for (let i = 0; i < 14; i++) { const s = rnd() < .5 ? -1 : 1; tree(cx + s * rr(15, 28), cz + rr(-26, 14), rr(1.2, 1.6), MAT.leafB, false).position.y = GROUND; }

  // ---- outer walls: glass on the north, west and most of the east; the stairs' solid wall at the south-east ----
  const windowRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = x0 === x1 ? Math.PI / 2 : 0; scene.add(g);
    box(len, .55, .3, MAT.plaster, 0, 0, 0, { p: g }); box(len, 2.55, .06, MAT.paneGlass, 0, .55, 0, { p: g, cast: false }); box(len, .3, .3, MAT.plaster, 0, 3.1, 0, { p: g });
    for (let s = 0; s <= len; s += 3.6) box(.14, 3.4, .32, MAT.paneFrame, s - len / 2, 0, 0, { p: g });
    x0 === x1 ? colBox(x0 - .15, Math.min(z0, z1), x0 + .15, Math.max(z0, z1)) : colBox(Math.min(x0, x1), z0 - .15, Math.max(x0, x1), z0 + .15);
  };
  windowRun(X(W0), Z(N0), X(BX0), Z(N0)); windowRun(X(BX0), Z(NB), X(BX0), Z(N0)); windowRun(X(BX0), Z(NB), X(W1), Z(NB));
  windowRun(X(W0), Z(N0), X(W0), Z(S0));
  windowRun(X(W1), Z(NB), X(W1), Z(6.3));
  sunShafts(Z3, X(W0) + .1, Z(N0), Z(S0 - 4), 3.6, .55, 3.1);
  box(L(W1 - W0), 1.1, .2, MAT.plaster, cx, 0, Z(S0)); colBox(X(W0), Z(S0) - .2, X(W1), Z(S0) + .2);   // the south wall, cut low so the camera sees in
  for (const [x, z] of [[-4, -9], [4, -9], [-4, 0], [4, 1], [-4, 9]]) pointLight(Z3, 0xffe6c8, 1.2, 15, X(x), 2.6, Z(z));

  // ---- south: the lift and electrical duct, the stairs, the waiting area ----
  const LX = X(-1.05), LZ = Z(9.7), EX = X(.75), lift = grp();
  box(L(3.6), 3.4, Z(S0) - LZ, MAT.plaster, X(-.4), 0, (LZ + Z(S0)) / 2, { p: lift });
  box(2.8, 3.4, .1, MAT.charcoal, LX, 0, LZ - .05, { p: lift });   // the lift's black surround
  for (const dx of [-.31, .31]) box(.6, 2.3, .06, MAT.steel, LX + dx, 0, LZ - .12, { p: lift });
  box(.02, 2.32, .07, MAT.charcoal, LX, 0, LZ - .13, { p: lift }); box(.12, .3, .04, MAT.steel, LX + .95, 1.05, LZ - .12, { p: lift });
  box(.9, 2.3, .06, MAT.slat, EX, 0, LZ - .03, { p: lift }); box(.7, .28, .07, MAT.elecSign, EX, 1.75, LZ - .06, { p: lift, s: 0 });   // the louvred duct door
  makeFader(compact(lift), () => hero.zone === Z3 && hero.x > X(-3) && hero.x < X(2) && hero.y < LZ + .1 && hero.y > Z(1));
  colBox(X(-2.2), LZ - .1, X(1.4), Z(S0));
  for (const [x, z] of [[-1.05, 9.15], [.75, 9.15]]) box(1.4, .015, .9, MAT.charcoal, X(x), 0, Z(z), { cast: false });   // the hazard-striped mats
  ledSign(['LIFT · Floor 3'], '#f6e3b4', LX, 3.75, LZ - .05, 1.8, .34);
  INTER.push({ x: LX, z: LZ - .9, r: 1.2, label: 'Lift', verb: 'Step in', act: () => LiftCar.enter('3', Z3) });   // lift-car.js: pick a floor inside
  INTER.push({ x: EX, z: LZ - .7, r: .9, label: 'Electrical Duct', verb: 'Read', act: () => talk('Electrical Duct', ['ELECTRICAL DUCT · AUTHORISED PERSONNEL ONLY.', 'The whole floor\'s power runs up through here. So does the server room\'s.']) });
  // the fire-exit stairs: a closed block east of the lift, its door onto the waiting area
  const core = grp(), SX = X(1.4);
  box(X(W1) - SX, 3.4, Z(S0) - Z(6.3), MAT.concrete, (SX + X(W1)) / 2, 0, (Z(6.3) + Z(S0)) / 2, { p: core });
  box(.08, 2.4, 1.3, MAT.exit, SX - .04, 0, Z(7.4), { p: core }); box(.1, .1, 1.45, MAT.charcoal, SX - .05, 2.4, Z(7.4), { p: core });
  makeFader(compact(core), () => hero.zone === Z3 && hero.x > X(.8) && hero.y > Z(-6) && hero.y < Z(6.3));
  colBox(SX, Z(6.3), X(W1), Z(S0));
  ledSign(['FIRE EXIT'], '#7dff9a', SX - .1, 2.75, Z(7.4), 1.1, .3, -Math.PI / 2);
  INTER.push({ x: SX - .6, z: Z(7.4), r: 1.1, label: 'Fire Exit', verb: 'Take the stairs', act: () => STAIRS.enter('3', Z3) });
  // the lit planter along the discussion room's south wall, plants
  const PZ = Z(5.5) + .4, PC = X(-.3), PW = L(3);
  box(PW, .8, .55, MAT.slat, PC, 0, PZ); box(PW + .1, .06, .62, MAT.walnut, PC, .8, PZ); box(PW - .1, .04, .04, MAT.ledStrip, PC, .1, PZ + .3, { cast: false });
  for (let x = -PW / 2 + .25; x <= PW / 2 - .2; x += .38) { const l = add(new THREE.Mesh(jitterSphere(rr(.18, .26), 1), MAT.leafA)); l.position.set(PC + x, .98, PZ + rr(-.08, .08)); }
  colBox(PC - PW / 2, PZ - .3, PC + PW / 2, PZ + .3);
  pointLight(Z3, 0xffb060, .9, 6, PC, .4, PZ + .6);
  bigPlant(X(1.05), Z(9.2));
  { const x = X(-1.85), z = Z(6.1), p = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .36, 12), MAT.white)); p.position.set(x, .18, z);   // a small potted plant by Matterhorn's corner
    for (let i = 0; i < 2; i++) { const l = add(new THREE.Mesh(jitterSphere(rr(.2, .26), 1), MAT.leafA)); l.position.set(x + rr(-.1, .1), .5 + i * .24, z + rr(-.08, .08)); }
    colCirc(x, z, .25); }
  chandelier(X(-.4), Z(7.8));
  INTER.push({ x: PC, z: PZ + .8, r: 1.4, label: 'Escape Plan', verb: 'Read', act: () => talk('Free Escape Route Plan · Third Floor', ['YOU ARE HERE: the waiting area, by the lift.', 'Desks down the west windows, the collab area at the north end, the pantry along the east side.', 'Way to fire exit: follow the green arrows to the stairs beside the lift.']) });

  // ---- west side, from the lift going north ----
  // Mont Blanc: the conference room right of the lift. Its glass front and door face north, onto the lift lobby, in line with the lift's black wall
  // laid out like the fourth floor's Cabin 1 and Sinhagad (office-hq4.js): Matterhorn's glass front is set back, and Mont Blanc's door sits in the
  // notch beside it, on Mont Blanc's north side, facing the corridor
  { const x0 = X(W0) + .1, x1 = X(-2.4) - .1, mz0 = Z(8.6) + .25;
    room(x0, mz0, x1, Z(S0) - .2, 'n', 'Mont Blanc', ['Mont Blanc: the big conference room by the lift. A long oak table, tan leather chairs, two screens by the window and a bookshelf.', 'On the screen: “Evaluating models: how do you know the answer is right?”'], { table: 'long', seats: 4, along: true, doorAt: (X(-3.6) + .12 + x1 - .12) / 2 - x0, doorW: 1.4, sMat: MAT.plaster }); }
  // Matterhorn, from the photos: grey felt walls and grey carpet, a round oak table on a white pedestal and disc, three black leather
  // swivel chairs, a screen on a mobile stand against the window blinds, a tall oak cabinet in the corner beside it, a big glass whiteboard
  // on the felt wall, a drum pendant over the table, a pothos in a white pot in the corner by the glass front
  { const m0 = X(W0) + .1, m1 = X(-3.6), n0 = Z(5.3), n1 = Z(8.6), cxm = (m0 + m1) / 2 + .35, czm = (n0 + n1) / 2;
    room(m0, n0, m1, n1, 'e', 'Matterhorn', ['Matterhorn: a round oak table, three black leather chairs, a screen by the window and a whiteboard.', 'On the whiteboard: “A model is only as good as the question you ask it.”'], { bare: true });
    const felt = new THREE.MeshStandardMaterial({ color: 0xc9c7c4, roughness: 1 }), carpet = new THREE.MeshStandardMaterial({ color: 0x8d8c8a, roughness: 1 }), leather = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: .45 });
    const oak = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: .6 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xeeeeec, roughness: .4 });
    box(m1 - m0 - .2, .015, n1 - n0 - .2, carpet, (m0 + m1) / 2, .01, czm, { cast: false });
    const fm = grp();
    box(m1 - m0 - .3, 2.8, .02, felt, (m0 + m1) / 2, .05, n0 + .12, { cast: false, p: fm });   // grey felt on the north wall (the south one stays low, so the camera sees in)
    // the table: oak top, white column, white floor disc; a cable box and a remote on it
    const top = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .04, 32), oak)); top.position.set(cxm, .74, czm);
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .7, 12), whiteM)); col.position.set(cxm, .37, czm);
    const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(.36, .38, .03, 28), whiteM)); disc.position.set(cxm, .015, czm);
    box(.22, .02, .14, whiteM, cxm + .05, .76, czm - .05); box(.16, .02, .05, leather, cxm - .12, .76, czm + .12);
    colCirc(cxm, czm, .6);
    // three black leather swivel chairs round it: five-star chrome base, gas column, seat, tall back, chrome armrests
    const exec = (a) => {
      const x = cxm + Math.cos(a) * .85, z = czm + Math.sin(a) * .85, gch = new THREE.Group(); gch.position.set(x, 0, z); gch.rotation.y = Math.PI / 2 - a; scene.add(gch);   // the seat faces local -z: turned to face the table
      for (let i = 0; i < 5; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .32), MAT.chrome); leg.rotation.y = i * 1.2566; leg.position.set(Math.sin(i * 1.2566) * .14, .05, Math.cos(i * 1.2566) * .14); gch.add(leg); }
      box(.05, .38, .05, MAT.chrome, 0, .06, 0, { p: gch, cast: false });
      box(.52, .1, .5, leather, 0, .44, 0, { p: gch }); box(.5, .62, .08, leather, 0, .54, .26, { p: gch });
      for (const sx of [-.28, .28]) { box(.04, .04, .4, MAT.chrome, sx, .66, .02, { p: gch, cast: false }); box(.03, .2, .03, MAT.chrome, sx, .46, -.12, { p: gch, cast: false }); }
      colCirc(x, z, .3);
    };
    exec(Math.PI * .9); exec(Math.PI * 1.55); exec(Math.PI * .2);
    // the screen on its mobile stand, against the window
    const sx = m0 + .45, scz = czm - .2;
    box(.08, 1.1, .06, leather, sx, 0, scz - .3); box(.08, 1.1, .06, leather, sx, 0, scz + .3); box(.5, .04, .9, leather, sx, .05, scz);
    box(.05, .7, 1.25, leather, sx + .04, 1.05, scz); box(.01, .64, 1.18, std(ledTex(['Matterhorn', 'AI literacy · 101'], '#e8f0ff', 256, 128), 0), sx + .07, 1.08, scz, { s: 0 });
    box(.06, .08, .7, leather, sx + .06, .92, scz);   // the soundbar
    colBox(sx - .3, scz - .5, sx + .3, scz + .5);
    // the tall oak cabinet in the north-west corner
    box(.5, 2.5, .9, oak, m0 + .3, 0, n0 + .6, { p: fm }); box(.52, .01, .9, MAT.charcoal, m0 + .3, 1.25, n0 + .6, { cast: false }); colBox(m0, n0, m0 + .56, n0 + 1.06);
    // the glass whiteboard on the south wall, its marker tray
    box(1.8, 1.05, .03, whiteM, cxm - .1, 1.2, n0 + .15, { p: fm }); box(.16, .06, .06, whiteM, cxm + .6, 1.16, n0 + .18);
    // the drum pendant over the table
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .14, 28, 1, true), whiteM); drum.position.set(cxm, 2.45, czm); scene.add(drum);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.37, 28), new THREE.MeshBasicMaterial({ color: 0xfffbea })); lens.rotation.x = Math.PI / 2; lens.position.set(cxm, 2.38, czm); scene.add(lens);
    pointLight(Z3, 0xfff4e0, .9, 5, cxm, 2.2, czm);
    // the pothos in a white pot on a little wooden stand, in the corner by the glass
    const px = m1 - .45, pz = n0 + .45; box(.3, .18, .3, oak, px, 0, pz);
    const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .28, 14), whiteM)); pot.position.set(px, .32, pz);
    for (let i = 0; i < 5; i++) { const l = add(new THREE.Mesh(jitterSphere(rr(.13, .18), 1), MAT.leafA)); l.position.set(px + rr(-.1, .1), .55 + i * .2, pz + rr(-.1, .1)); }
    colCirc(px, pz, .25);
    makeFader(compact(fm), () => hero.zone === Z3 && hero.x > m0 - .6 && hero.x < m1 + .6 && hero.y < n1 && hero.y > n0 - 8); }
  for (const z of [-4.8, -2.0, .8, 3.5]) deskCluster(X(-4.95), Z(z), 3, false, { pitch: 1.5 });
  // Santis, from the photos: the north-west corner room. The window (west) wall has its roller blinds and two screens side by side on a black
  // mobile stand; the north wall is grey felt with an oak cubby bookshelf (trophies, books, "Join me to change the world in 36 hours") and a
  // glass whiteboard; glass to the east (the green sofa) with the oak-framed door, and glass to the south (the desks). A long oak table with
  // rounded corners and white legs runs east-west, its head at the screens: two tan leather chairs each side and one at the east end (five in all),
  // a rectangular LED ring pendant over it, a plant and a pedal bin in the north-east corner, grey carpet tiles.
  { const s0 = X(W0) + .1, s1 = X(-3.1), t0 = Z(-10.6), t1 = Z(-6.8), tcx = (s0 + s1) / 2 + .15, tcz = (t0 + t1) / 2 + .15;
    room(s0, t0, s1, t1, 'e', 'Santis', ['Santis: a long oak table, five tan leather chairs, two screens by the window, the bookshelf of hackathon trophies and a whiteboard.', 'A cloud-shaped card on the shelf: “Join me to change the world in 36 hours.”'], { bare: true, sGlass: true, doorAt: (t1 - t0) - 1.1 });
    const tan = new THREE.MeshStandardMaterial({ color: 0xb8662e, roughness: .5 }), oakT = new THREE.MeshStandardMaterial({ color: 0xcfa36c, roughness: .55 }), wh = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: .4 });
    const felt = new THREE.MeshStandardMaterial({ color: 0xcfcdca, roughness: 1 }), carpet = new THREE.MeshStandardMaterial({ color: 0x8f8d89, roughness: 1 }), blk = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .45 });
    box(s1 - s0 - .2, .015, t1 - t0 - .2, carpet, (s0 + s1) / 2, .01, (t0 + t1) / 2, { cast: false });
    const fw = grp();   // the north wall's felt, bookshelf and whiteboard fade with the room
    box(s1 - s0 - .3, 2.85, .02, felt, (s0 + s1) / 2, .02, t0 + .12, { p: fw, cast: false });
    const bx = s0 + 1.1; box(1.2, 2.3, .32, oakT, bx, 0, t0 + .3, { p: fw });
    for (const y of [.5, .95, 1.4, 1.85]) box(1.16, .03, .3, wh, bx, y, t0 + .31, { p: fw });
    for (const dx of [-.2, .2]) box(.03, 2.24, .3, wh, bx + dx, .03, t0 + .31, { p: fw });
    box(.3, .2, .14, MAT.pink, bx - .35, 1.43, t0 + .36, { p: fw }); box(.36, .22, .03, wh, bx + .05, .98, t0 + .4, { p: fw }); box(.2, .26, .1, MAT.navy3, bx + .35, 1.88, t0 + .35, { p: fw });
    box(1.4, 1, .03, wh, bx + 1.6, 1.15, t0 + .15, { p: fw }); box(.12, .08, .07, wh, bx + 2.1, 1.1, t0 + .19, { p: fw });
    makeFader(compact(fw), () => hero.zone === Z3 && hero.x > s0 - .6 && hero.x < s1 + .6 && hero.y < t1 && hero.y > t0 - 8);
    // the table: rounded oak top, splayed white legs, two cable boxes and the remotes
    const top = new THREE.Shape(), hw = 1.3, hd = .55, rc = .25;
    top.moveTo(-hw + rc, -hd); top.lineTo(hw - rc, -hd); top.quadraticCurveTo(hw, -hd, hw, -hd + rc); top.lineTo(hw, hd - rc); top.quadraticCurveTo(hw, hd, hw - rc, hd); top.lineTo(-hw + rc, hd); top.quadraticCurveTo(-hw, hd, -hw, hd - rc); top.lineTo(-hw, -hd + rc); top.quadraticCurveTo(-hw, -hd, -hw + rc, -hd);
    const tg = new THREE.ExtrudeGeometry(top, { depth: .045, bevelEnabled: false }); tg.rotateX(-Math.PI / 2);
    const tm = add(new THREE.Mesh(tg, oakT)); tm.position.set(tcx, .72, tcz);
    for (const [dx, dz] of [[-1.05, -.4], [1.05, -.4], [-1.05, .4], [1.05, .4]]) box(.05, .72, .05, wh, tcx + dx, 0, tcz + dz, { cast: false });
    for (const dx of [-.5, .5]) box(.4, .01, .12, wh, tcx + dx, .77, tcz);
    box(.16, .015, .05, blk, tcx, .77, tcz + .2); box(.12, .015, .05, wh, tcx + .2, .77, tcz - .18);
    colBox(tcx - 1.3, tcz - .55, tcx + 1.3, tcz + .55);
    // five tan leather chairs: two north, two south, one at the east end
    const chairT = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      for (let i = 0; i < 5; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .32), MAT.chrome); leg.rotation.y = i * 1.2566; leg.position.set(Math.sin(i * 1.2566) * .14, .05, Math.cos(i * 1.2566) * .14); g.add(leg); }
      box(.05, .38, .05, MAT.chrome, 0, .06, 0, { p: g, cast: false });
      box(.5, .1, .48, tan, 0, .44, 0, { p: g }); box(.48, .6, .08, tan, 0, .54, .25, { p: g });
      colCirc(x, z, .3);
    };
    for (const dx of [-.55, .55]) { chairT(tcx + dx, tcz - .85, Math.PI); chairT(tcx + dx, tcz + .85, 0); }
    chairT(tcx + 1.65, tcz, Math.PI / 2);   // seat faces local -z: turned to face west, toward the table
    // the two screens on their black stand, at the window end, facing the table
    const sx = s0 + .45; box(.5, .04, 1.8, blk, sx, .03, tcz); for (const dz of [-.55, .55]) box(.06, 1.2, .06, blk, sx, 0, tcz + dz);
    for (const dz of [-.47, .47]) { box(.05, .62, .92, blk, sx + .05, 1.05, tcz + dz); box(.01, .56, .86, std(ledTex(['Santis', 'AI literacy · 101'], '#e8f0ff', 256, 128), 0), sx + .08, 1.08, tcz + dz, { s: 0 }); }
    box(.07, .07, .7, blk, sx + .06, .92, tcz);
    colBox(sx - .3, tcz - .95, sx + .3, tcz + .95);
    // the rectangular LED ring pendant
    const ring = grp(), glow = new THREE.MeshBasicMaterial({ color: 0xfffbea });
    for (const [w, d, x, z] of [[1.8, .08, 0, -.45], [1.8, .08, 0, .45], [.08, .98, -.9, 0], [.08, .98, .9, 0]]) { box(w, .07, d, wh, tcx + x, 2.45, tcz + z, { p: ring, cast: false }); box(w, .01, d, glow, tcx + x, 2.44, tcz + z, { p: ring, cast: false }); }
    pointLight(Z3, 0xfff4e0, 1, 6, tcx, 2.2, tcz);
    // the plant and the pedal bin in the north-east corner
    const pp = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .32, 14), new THREE.MeshStandardMaterial({ color: 0xb9ae9c }))); pp.position.set(s1 - .45, .16, t0 + .45);
    for (let i = 0; i < 4; i++) { const l = add(new THREE.Mesh(jitterSphere(rr(.16, .22), 1), MAT.leafA)); l.position.set(s1 - .45 + rr(-.1, .1), .45 + i * .2, t0 + .45 + rr(-.1, .1)); }
    const bin = add(new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .3, 12), blk)); bin.position.set(s1 - .9, .15, t0 + .3);
    colCirc(s1 - .45, t0 + .45, .25); }
  for (const z of [-5, 1.5]) chandelier(X(-2.55), Z(z));

  // ---- middle: the server room, a discussion room, the toilets, the desk row along their north face ----
  const srv = grp(), s0 = X(-2), s1 = X(1.4), sz0 = Z(-1.1), sz1 = Z(2.1);
  // the glass front: full-height panes in a thin oak frame, the glass door with its fingerprint reader
  { const zm = (sz0 + sz1) / 2, len = sz1 - sz0;
    box(.04, 2.8, len - .1, MAT.pane, s0, .1, zm, { p: srv, cast: false });
    box(.1, .1, len, MAT.walnut, s0, 0, zm, { p: srv }); box(.1, .12, len, MAT.walnut, s0, 2.9, zm, { p: srv });
    for (const z of [sz0 + .05, zm - .6, zm + .6, sz1 - .05]) box(.1, 3, .08, MAT.walnut, s0, 0, z, { p: srv });
    box(.04, .9, .04, MAT.charcoal, s0 - .05, .95, zm + .45, { p: srv }); box(.03, .14, .08, MAT.charcoal, s0 - .05, 1.3, zm + .75, { p: srv }); }
  for (const z of [sz0, sz1]) box(s1 - s0, 3, .2, MAT.plaster, (s0 + s1) / 2, 0, z, { p: srv });
  for (const [dx, n] of [[1.2, 0], [2.6, 1]]) {
    box(.75, 2.1, 1.2, rack, s0 + dx, 0, (sz0 + sz1) / 2 + (n ? .9 : -.9), { p: srv });
    for (let i = 0; i < 6; i++) box(.02, .03, .05, i % 3 ? ledG : ledR, s0 + dx - .38, .4 + i * .28, (sz0 + sz1) / 2 + (n ? .9 : -.9) + rr(-.4, .4), { p: srv, cast: false });
  }
  srv.add(signBoard('SERVER ROOM', s0 - .06, 2.2, (sz0 + sz1) / 2, 1.2, .3, -Math.PI / 2, { size: 16, bg: '#c0302a', w: 160, h: 40 }));
  makeFader(compact(srv), () => hero.zone === Z3 && hero.x > s0 - .6 && hero.y < sz1 && hero.y > sz0 - 8);
  colBox(s0 - .1, sz0 - .1, s1, sz1 + .1);
  INTER.push({ x: s0 - .7, z: (sz0 + sz1) / 2, r: 1.2, label: 'Server Room', verb: 'Read', act: () => talk('Server Room', ['SERVER ROOM · AUTHORISED PERSONNEL ONLY. A fingerprint reader by the glass door.', 'Two racks, a wall of blinking lights. The models in the cloud are much bigger; these just keep the office talking to them.']) });
  // The Dom, from the three photos: a small felt box. Grey felt on every wall, grey carpet tiles, a round oak table on a white pedestal and
  // disc with a cable box in its middle, three black leather swivel chairs (two either side of the screen, one toward the door), the screen
  // on the far (east) wall with a soundbar under it, a big glass whiteboard with its marker cup on the long wall, the white drum pendant.
  // Its oak-framed glass door and glass sidelight face west, onto the passage by the desks.
  { const d0 = X(-2), d1 = X(1.4), e0 = Z(3.2), e1 = Z(5.5), dz = (e0 + e1) / 2, tx = (d0 + d1) / 2 + .45;
    room(d0, e0, d1, e1, 'w', 'The Dom', ['The Dom: a small grey felt room. A round oak table, three black leather chairs, a screen on the wall and a big glass whiteboard.', 'Good for a five-minute chat, or for telling a model exactly what you want before you ask it.'], { bare: true });
    const felt = new THREE.MeshStandardMaterial({ color: 0xcfcdca, roughness: 1 }), carpet = new THREE.MeshStandardMaterial({ color: 0x8f8d89, roughness: 1 }), leather = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .45 });
    const oak = new THREE.MeshStandardMaterial({ color: 0xcfa36c, roughness: .6 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: .35 });
    box(d1 - d0 - .2, .015, e1 - e0 - .2, carpet, (d0 + d1) / 2, .01, dz, { cast: false });
    const fz = grp();   // the felt, the screen and the whiteboard fade with the room's walls
    box(d1 - d0 - .3, 2.85, .02, felt, (d0 + d1) / 2, .02, e0 + .12, { cast: false, p: fz });   // felt: the north wall
    box(.02, 2.85, e1 - e0 - .3, felt, d1 - .12, .02, dz, { cast: false, p: fz });               // and the east wall, behind the screen
    // the table
    const top = add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .04, 32), oak)); top.position.set(tx, .74, dz);
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .7, 12), whiteM)); col.position.set(tx, .37, dz);
    const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(.34, .36, .03, 28), whiteM)); disc.position.set(tx, .015, dz);
    box(.22, .02, .14, whiteM, tx, .76, dz); colCirc(tx, dz, .55);
    // three black leather swivel chairs
    const exec = (a) => {
      const x = tx + Math.cos(a) * .8, z = dz + Math.sin(a) * .8, gch = new THREE.Group(); gch.position.set(x, 0, z); gch.rotation.y = Math.PI / 2 - a; scene.add(gch);   // the seat faces local -z: turned to face the table
      for (let i = 0; i < 5; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .32), MAT.chrome); leg.rotation.y = i * 1.2566; leg.position.set(Math.sin(i * 1.2566) * .14, .05, Math.cos(i * 1.2566) * .14); gch.add(leg); }
      box(.05, .38, .05, MAT.chrome, 0, .06, 0, { p: gch, cast: false });
      box(.52, .1, .5, leather, 0, .44, 0, { p: gch }); box(.5, .66, .08, leather, 0, .54, .26, { p: gch });
      for (const sx of [-.28, .28]) { box(.04, .04, .4, MAT.chrome, sx, .66, .02, { p: gch, cast: false }); box(.03, .2, .03, MAT.chrome, sx, .46, -.12, { p: gch, cast: false }); }
      colCirc(x, z, .3);
    };
    exec(-Math.PI * .3); exec(Math.PI * .3); exec(Math.PI);
    // the screen on the east wall, the soundbar under it
    box(.05, .7, 1.2, leather, d1 - .16, 1.25, dz); box(.01, .64, 1.13, std(ledTex(['The Dom', 'AI literacy · 101'], '#e8f0ff', 256, 128), 0), d1 - .19, 1.28, dz, { s: 0 });
    box(.07, .07, .65, leather, d1 - .17, 1.1, dz);
    // the glass whiteboard on the long (north) wall, its marker cup
    box(2, 1.15, .03, whiteM, tx - .5, 1.05, e0 + .15, { p: fz }); box(.12, .1, .08, whiteM, tx + .35, 1.02, e0 + .2); box(.03, .1, .03, new THREE.MeshStandardMaterial({ color: 0x2f6fd8 }), tx + .33, 1.1, e0 + .2);
    // the white drum pendant
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .13, 28, 1, true), whiteM); drum.position.set(tx, 2.45, dz); scene.add(drum);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.35, 28), new THREE.MeshBasicMaterial({ color: 0xfffbea })); lens.rotation.x = Math.PI / 2; lens.position.set(tx, 2.38, dz); scene.add(lens);
    makeFader(compact(fz), () => hero.zone === Z3 && hero.x > d0 - .6 && hero.x < d1 + .6 && hero.y < e1 && hero.y > e0 - 8);
    pointLight(Z3, 0xfff4e0, .9, 5, tx, 2.2, dz); }
  // the toilets block, doors onto the short passage between the server room and the discussion room
  const wc = grp();
  box(X(5.2) - SX, 3.4, Z(6.3) - Z(-1.1), MAT.plaster, (SX + X(5.2)) / 2, 0, (Z(-1.1) + Z(6.3)) / 2, { p: wc });
  box(X(W1) - X(5.2), 3.4, Z(6.3) - Z(3.4), MAT.plaster, (X(5.2) + X(W1)) / 2, 0, (Z(3.4) + Z(6.3)) / 2, { p: wc });
  for (const z of [2.25, 3.05]) box(.06, 2.2, .7, MAT.slat, SX - .03, 0, Z(z), { p: wc });
  makeFader(compact(wc), () => hero.zone === Z3 && hero.x > X(.8) && hero.y < Z(6.3) && hero.y > Z(-10));
  colBox(SX, Z(-1.1), X(5.2), Z(6.3)); colBox(X(5.2), Z(3.4), X(W1), Z(6.3));
  signBoard('TOILETS', SX - .12, 2.55, Z(2.65), 1.1, .3, -Math.PI / 2, { size: 18, bg: PAL.plum, w: 150, h: 40 });
  INTER.push({ x: SX - .5, z: Z(2.65), r: 1.1, label: 'Toilets', verb: 'Read', act: () => talk('Toilets', ['Hers on the left, his on the right.', 'Wash your hands. The models are not the only thing that can catch a bug.']) });
  // a row of desks facing the server room and toilets, chairs to the north
  const DZ = Z(-1.1) - .45, D0 = X(-1.7), D1 = X(5), n = 6, P = (D1 - D0) / n;
  box(D1 - D0, .05, .6, MAT.walnut, (D0 + D1) / 2, .72, DZ); box(D1 - D0, .4, .04, MAT.fabric, (D0 + D1) / 2, .77, DZ + .27);
  for (let i = 0; i <= n; i++) box(.05, .72, .55, MAT.white, D0 + i * P, 0, DZ);
  for (let i = 0; i < n; i++) { const x = D0 + (i + .5) * P; box(.6, .36, .04, MAT.charcoal, x, .9, DZ + .17); box(.56, .32, .02, nextScreen(), x, .92, DZ + .14); keyboardAt(x, .77, DZ - .06, -1); deskClutter(x + .5, .77, DZ - .12); chair(x, DZ - .75, -1); }
  colBox(D0, DZ - .3, D1, Z(-1.1));

  // ---- the pantry: a galley along the window strip, open to the north. As in the photos, the kitchen is built against the inner (west) wall,
  // the glass is opposite it: blue base units and a grey top, white brick tiles, black glass wall units, the LG fridge at the north end,
  // a bar stool at the south end; along the window, the steel bins, the fire extinguisher and the water cans ----
  const PX = X(5.2), EW = X(W1) - .15, PZ0 = Z(-1.1), PZ1 = Z(3.4), CZ = (PZ0 + PZ1) / 2;
  box(.15, 3.4, PZ1 - PZ0, MAT.plaster, PX - .075, 0, CZ); colBox(PX - .3, PZ0, PX, PZ1);
  const K0 = PZ0 + .95, K1 = PZ1 - .75, KM = (K0 + K1) / 2, KL = K1 - K0;
  box(.03, 1.6, PZ1 - PZ0 - .1, MAT.tile, PX + .015, .9, CZ, { s: 0 });   // the white brick tiles
  box(.62, .88, KL, blue, PX + .31, 0, KM); box(.66, .05, KL, new THREE.MeshStandardMaterial({ color: 0x7a706a, roughness: .35 }), PX + .33, .88, KM);
  for (let z = K0 + .5; z < K1; z += .5) box(.01, .8, .01, MAT.charcoal, PX + .625, .04, z, { cast: false });   // the drawer joints
  const black = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: .15, metalness: .3 });
  box(.38, .7, KL - .2, black, PX + .19, 1.7, KM);   // black glass wall units
  for (let z = K0 + .1; z < K1 - .1; z += .55) box(.39, .68, .015, MAT.chrome, PX + .2, 1.71, z, { cast: false });
  // the sink at the far end of the counter, by the stool: a dark basin set into the top, a steel tap, a soap rack on the tiles
  { const sz = K1 - .38; box(.42, .04, .46, new THREE.MeshStandardMaterial({ color: 0x1d3b6e, roughness: .3 }), PX + .34, .875, sz, { cast: false });
    box(.04, .26, .04, MAT.chrome, PX + .1, .9, sz); box(.18, .03, .03, MAT.chrome, PX + .18, 1.14, sz);
    box(.06, .05, .2, MAT.white, PX + .05, 1.15, sz - .1); box(.07, .03, .06, MAT.pink, PX + .07, 1.2, sz - .14); }
  box(.3, .36, .3, black, PX + .3, .93, K1 - .85);  box(.36, .26, .45, black, PX + .32, .93, KM + .1);   // the coffee machine, the microwave
  { const k = add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .22, 12), MAT.steel)); k.position.set(PX + .12, 1.04, K1 - .72); }   // the kettle
  { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .22, 14), new THREE.MeshStandardMaterial({ color: 0xf2f4f6, transparent: true, opacity: .85 }))); t.position.set(PX + .45, 1.04, K1 - .95); }   // the milk tub
  box(.14, .2, .26, black, PX + .3, .93, K0 + .22);   // the toaster, by the fridge
  box(.3, .1, .22, new THREE.MeshStandardMaterial({ color: 0x3fc0b0 }), PX + .3, 1.19, KM + .1);   // a box of tissues on it
  const ban = add(new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: 0xe8c840 }))); ban.position.set(PX + .35, .93, K0 + .55);
  colBox(PX, K0, PX + .68, K1);
  // the fridge at the north end, by the way in
  box(.75, 1.95, .8, MAT.charcoal, PX + .4, 0, PZ0 + .5); box(.03, .9, .04, MAT.chrome, PX + .79, .8, PZ0 + .7); colBox(PX, PZ0 + .08, PX + .8, PZ0 + .92);
  stool(PX + .45, PZ1 - .4);
  // along the window: two steel bins and the fire extinguisher by the way in, the water cans further down
  for (const [z, lid] of [[.35, 0x2f7de0], [.85, 0x2aa05a]]) { const bn = add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .16, .62, 14), MAT.chrome)); bn.position.set(EW - .25, .31, PZ0 + z); const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .03, 14), new THREE.MeshStandardMaterial({ color: lid }))); l.position.set(EW - .25, .63, PZ0 + z); }
  { const fx = add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .5, 10), new THREE.MeshStandardMaterial({ color: 0xd8201c }))); fx.position.set(EW - .2, .25, PZ0 + 1.3); }
  const jug = new THREE.MeshStandardMaterial({ color: 0x48c2d4, transparent: true, opacity: .75, roughness: .2 });
  for (let i = 0; i < 2; i++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .48, 12), jug); j.position.set(EW - .25, .24, PZ1 - .5 - i * .4); scene.add(j); }
  colBox(EW - .45, PZ0 + .1, EW, PZ0 + 1.45); colBox(EW - .45, PZ1 - 1.1, EW, PZ1);
  pointLight(Z3, 0xffd6a0, 1, 7, (PX + EW) / 2, 2.6, CZ);
  INTER.push({ x: (PX + EW) / 2, z: PZ0 + .4, r: 1.5, label: 'Pantry', verb: 'Look', act: () => talk('Pantry', ['Blue cabinets, a black glass wall of cupboards, a coffee machine, a toaster and a microwave.', 'Tetley tissues on the microwave, a basket of bananas, a kettle, and the big LG fridge at the end. Steel bins and water cans by the window.']) });

  // ---- north: the collab area ----
  const RX = X(.2), RZ0 = Z(-10.2), RZ1 = Z(-3.8);
  plane(L(3.6), RZ1 - RZ0, MAT.felt, RX, .02, (RZ0 + RZ1) / 2, 1);
  // the green velvet sofa from the photos: two quarter-round halves meeting in a seam, making one deep horseshoe open to the south;
  // a thick rounded back all the way round, a soft seat inside it, a round bolster at each end, short dark legs under the curve
  const sc = Z(-8.2), velvet = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, side: THREE.DoubleSide, map: canvasTex(128, 128, (g) => {   // velvet: green with a soft brushed nap
    g.fillStyle = '#4a8f60'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = rr(-14, 14) | 0; g.fillStyle = `rgba(${74 + v},${143 + v},${96 + v},.5)`; g.fillRect(rr(0, 128), rr(0, 128), rr(2, 7), 1); }
  }, { keep: true }) }), dark = new THREE.MeshStandardMaterial({ color: 0x1d1f1c, roughness: .6 });
  const sector = (r0, r1, a0, a1, h, bev) => {   // an annulus slice lying on the floor, extruded up h, its edges rounded
    const sh = new THREE.Shape(); sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * .9, bevelSegments: 5, curveSegments: 40 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); return g;
  };
  const RB0 = 1.42, RS0 = .78;
  // the back's cross-section (radius from the sofa's centre, height): thick and full at the floor, a soft groove just above the base,
  // tapering as it rises to a thin rounded lip; the seat a deep pad with a rolled front edge. Each is swept round the curve (a lathe).
  const BACK = [[1.4, .1], [1.8, .1], [1.9, .16], [1.93, .26], [1.88, .31], [1.91, .37], [1.9, .52], [1.84, .7], [1.75, .86], [1.66, .96], [1.57, 1], [1.5, .97], [1.46, .88], [1.44, .7], [1.42, .44], [1.4, .1]].map(([r, y]) => new THREE.Vector2(r, y));
  const SEAT = [[RS0, .1], [RS0 - .04, .22], [RS0 - .02, .36], [RS0 + .05, .44], [RS0 + .2, .47], [RB0 + .04, .46], [RB0 + .04, .1]].map(([r, y]) => new THREE.Vector2(r, y));
  const prof = (pts) => { const sh = new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x, v.y))); return new THREE.ShapeGeometry(sh, 6); };
  for (const [f0, f1] of [[Math.PI / 2, Math.PI - .012], [Math.PI + .012, 1.5 * Math.PI]]) {   // the two halves, a hairline seam between them
    for (const pts of [BACK, SEAT]) {
      const m = add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48, f0, f1 - f0), velvet)); m.position.set(RX, 0, sc);
      for (const f of [f0, f1]) { const c = add(new THREE.Mesh(prof(pts), velvet)); c.position.set(RX, 0, sc); c.rotation.y = f - Math.PI / 2; }   // the end caps
    }
    const base = add(new THREE.Mesh(new THREE.LatheGeometry([[1.45, 0], [1.82, 0], [1.82, .1], [1.45, .1]].map(([r, y]) => new THREE.Vector2(r, y)), 40, f0 + .03, f1 - f0 - .06), dark)); base.position.set(RX, 0, sc);
  }
  for (const s of [-1, 1]) {   // the bolsters lying across the seat at each end
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, RB0 - RS0 - .05, 20), velvet));
    const t = s < 0 ? Math.PI - .22 : .22, r = (RS0 + RB0) / 2; b.rotation.set(0, -t, Math.PI / 2); b.position.set(RX + Math.cos(t) * r, .6, sc - Math.sin(t) * r); b.scale.set(1.15, 1, 1.15);
  }
  for (let i = 0; i <= 14; i++) { const t = Math.PI * i / 14; colCirc(RX + Math.cos(t) * 1.3, sc - Math.sin(t) * 1.3, .5); }
  // the coffee table in the curve: a square white marble top on a gold tapered base; a red bottle and a wooden tissue box on it
  { const tz0 = sc + .55, marble = new THREE.MeshStandardMaterial({ color: 0xf1f0ee, roughness: .25 }), gold = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: .8, roughness: .35 });
    const base = add(new THREE.Mesh(new THREE.CylinderGeometry(.26, .4, .36, 4), gold)); base.rotation.y = Math.PI / 4; base.position.set(RX, .18, tz0);
    box(.82, .05, .82, marble, RX, .36, tz0); box(.2, .1, .2, MAT.walnut, RX + .15, .41, tz0 - .1);
    const bt = add(new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .2, 10), new THREE.MeshStandardMaterial({ color: 0xd8201c }))); bt.position.set(RX - .12, .51, tz0 + .1);
    colBox(RX - .42, tz0 - .42, RX + .42, tz0 + .42); }
  // the carrom table on the rug, south of the sofa
  const tx = RX, tz = Z(-5);
  for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box(.06, .6, .06, MAT.charcoal, tx + dx, 0, tz + dz);
  box(1, .07, 1, MAT.carrom, tx, .6, tz, { s: 0 }); colCirc(tx, tz, .6);
  INTER.push({ x: tx, z: tz + 1.3, r: 1.3, label: 'Carrom Board', verb: 'Look', act: () => talk('Carrom Board', ['A carrom board on the rug, the coins mid-game.', 'The real tournament is downstairs on the second floor.']) });
  chandelier(RX, Z(-5.2), 3.3);   // one chandelier over the carrom, clear of the sofa (the photos have it over the passage, not the seat)
  bigPlant(X(-3.1) + .45, Z(-10.6) + .45);   // at Santis's north-east corner, by the window counter, away from its door
  // the north-east desks, as on the plan: two blocks of back-to-back benches, three desks a side (12 seats each), running east-west,
  // and a single row of three desks against the corridor wall, chairs facing it from the south; the calling booths in the corner
  for (const z of [-7.25, -4.4]) deskCluster(X(4.95), Z(z), 3, false, { pitch: 1.5 });
  {
    // the desks against the corridor wall's south face, as on the plan: screens to the wall, the people facing it from the south
    const rz = Z(-9.9) + .42, r0 = X(2.2), r1 = X(7.1) - .3, n = 3, P = (r1 - r0) / n;
    box(r1 - r0, .05, .6, MAT.walnut, (r0 + r1) / 2, .72, rz); box(r1 - r0, .4, .04, MAT.fabric, (r0 + r1) / 2, .77, rz - .27);
    for (let i = 0; i <= n; i++) box(.05, .72, .55, MAT.white, r0 + i * P, 0, rz);
    for (let i = 0; i < n; i++) { const x = r0 + (i + .5) * P; box(.6, .36, .04, MAT.charcoal, x, .9, rz - .17); box(.56, .32, .02, nextScreen(), x, .92, rz - .14); keyboardAt(x, .77, rz + .06, 1); deskClutter(x + .5, .77, rz + .12); chair(x, rz + .75, 1); }
    colBox(r0, rz - .3, r1, rz + .3);
  }
  // ---- the window corridor, from the photos: a long oak counter on white frames along the north glass with high Windsor bar chairs,
  // a white wall on its south side shutting it off from the desks, and at its east end two single-seat calling booths side by side,
  // each behind an oak-framed glass door: grey felt-tile walls, an oak ledge desk along the corner window, one bar chair ----
  const WZ = Z(-9.9), NZ = Z(N0) + .35, NZB = Z(NB) + .35, bx0 = X(5.5), bx1 = X(W1) - .15, bw = bx1 - bx0;
  const seatM = new THREE.MeshStandardMaterial({ color: 0x4e5964, roughness: .5 }), legM = new THREE.MeshStandardMaterial({ color: 0xc69a6e, roughness: .6 });
  const oakL = new THREE.MeshStandardMaterial({ color: 0xc8a172, roughness: .6 }), frameW = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: .5 });
  const tileF = new THREE.MeshStandardMaterial({ color: 0xd9d4d2, roughness: 1, map: canvasTex(64, 64, (g) => { g.fillStyle = '#ddd8d6'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#b9b2ae'; g.lineWidth = 2; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }, { keep: true }) });
  tileF.map.wrapS = tileF.map.wrapT = THREE.RepeatWrapping; tileF.map.repeat.set(3, 3);
  const leather3 = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: .5 });
  // a Windsor bar chair: round blue-grey seat on four splayed oak legs with a footrest ring, a hoop back on five black spindles; ry turns it to face
  const barChair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(.21, .2, .05, 18), seatM); seat.position.y = .76; g.add(seat);
    for (const [lx, lz] of [[-.13, -.13], [.13, -.13], [-.13, .13], [.13, .13]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .76, 6), legM); l.position.set(lx * 1.1, .38, lz * 1.1); l.rotation.set(lz * .35, 0, -lx * .35); g.add(l); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .01, 4, 16), legM); ring.rotation.x = Math.PI / 2; ring.position.y = .3; g.add(ring);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(.19, .018, 6, 18, Math.PI), leather3); hoop.position.set(0, 1.08, .02); hoop.rotation.y = Math.PI; g.add(hoop);
    for (let i = 0; i < 5; i++) { const t = Math.PI * (i + .5) / 5, sp = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .3, 5), leather3); sp.position.set(Math.cos(t) * .18, .93, Math.sin(t) * .18 * -1 + .02); g.add(sp); }
    colCirc(x, z, .25);
  };
  // the counter: an oak top on white frames, a cable tray under it, power boxes on top
  // two runs: along the floor's line from the west wall to the step, and out in the bay from the step to the booths
  for (const [c0, c1, NZ] of [[X(W0) + .2, X(BX0) - .2, Z(N0) + .35], [X(BX0) + .2, bx0 - .15, NZB]]) {
  box(c1 - c0, .05, .5, oakL, (c0 + c1) / 2, 1.05, NZ);
  for (let x = c0 + .1; x < c1; x += 1.6) { box(.04, 1.05, .04, frameW, x, 0, NZ - .2); box(.04, 1.05, .04, frameW, x, 0, NZ + .2); box(.04, .04, .44, frameW, x, .2, NZ); }
  for (let x = c0 + .8; x < c1 - .3; x += 1.6) box(.22, .02, .1, frameW, x, 1.085, NZ - .05);
  for (let x = c0 + .8; x < c1 - .4; x += 1.25) barChair(x, NZ + .6, Math.PI);   // facing the glass
  colBox(c0, NZ - .25, c1, NZ + .25); }
  INTER.push({ x: X(-1), z: NZ + 1, r: 1.6, label: 'Window Counter', verb: 'Look', act: () => talk('Window Counter', ['A long oak counter along the windows, high Windsor bar chairs, the roller blinds half down.', 'Open ground below, a construction site, and the towers of Baner beyond.']) });
  // the white wall between the corridor and the desks, from the collab end to the booths
  const wallG = grp(), w0 = X(1.9);
  box(bx1 - w0 + .15, 3.4, .2, MAT.plaster, (w0 + bx1) / 2, 0, WZ, { p: wallG });
  makeFader(compact(wallG), () => hero.zone === Z3 && hero.y < WZ && hero.x > w0 - 2);
  colBox(w0, WZ - .1, bx1 + .15, WZ + .1);
  // the two booths, side by side between the window and the wall, doors facing west down the corridor
  const zA = Z(NB) + .15, zM = (zA + WZ - .1) / 2;
  for (const [z0, z1] of [[zA, zM - .04], [zM + .04, WZ - .1]]) {
    const g = grp(), zm = (z0 + z1) / 2, d = z1 - z0;
    // the oak front: a full-height glass door in a deep oak frame, a black bar handle
    box(.12, 2.6, .12, oakL, bx0, 0, z0 + .06, { p: g }); box(.12, 2.6, .12, oakL, bx0, 0, z1 - .06, { p: g }); box(.12, .2, d, oakL, bx0, 2.6, zm, { p: g });
    box(.03, 2.4, d - .26, MAT.pane, bx0, .1, zm, { p: g, cast: false }); box(.04, .45, .04, leather3, bx0 - .06, .9, z1 - .25, { p: g, cast: false });
    // felt-tile walls either side, the corner window beyond
    for (const z of [z0, z1]) box(bw, 2.8, .06, tileF, (bx0 + bx1) / 2, 0, z, { p: g });
    box(.45, .04, d - .2, oakL, bx1 - .25, 1.02, zm, { p: g }); box(.03, 1.02, .03, frameW, bx1 - .45, 0, zm - d / 2 + .2, { p: g }); box(.03, 1.02, .03, frameW, bx1 - .45, 0, zm + d / 2 - .2, { p: g });
    box(.2, .02, .1, frameW, bx1 - .25, 1.05, zm + .1, { p: g });
    makeFader(compact(g), () => hero.zone === Z3 && hero.x > bx0 - 1 && hero.y < z1 && hero.y > z0 - 8);
    barChair(bx1 - .85, zm, Math.PI / 2);   // facing the window ledge
    colBox(bx0 - .07, z0, bx0 + .07, z0 + .15); colBox(bx0 - .07, z1 - .15, bx0 + .07, z1); colBox(bx0, z0, bx1, z0 + .05); colBox(bx1 - .5, z0, bx1, z1);
  }
  INTER.push({ x: bx0 - .7, z: zM, r: 1.2, label: 'Calling Rooms', verb: 'Read', act: () => talk('Calling Rooms', ['Two single-seat booths at the end of the window corridor: felt walls, a ledge desk on the corner window, one bar chair.', 'Book one before your client call, not during it.']) });

  chair = kitChair;
  NPC_BOUNDS.cb3 = [X(-6.8), Z(-12.4), X(6.8), Z(4.6)];   // the north half and the west passage down to the lift lobby; pickTarget only takes routes that are clear
  KIT_ZONE = prevKit;
}
