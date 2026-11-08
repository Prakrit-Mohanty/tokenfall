// TokenFall: Calfus HQ office (zone "lab"), from the second-floor fire escape plan.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// Floor plan, from the building's fire escape plan (second floor). The layout follows the plan (about 27.5 m by 14.4 m),
// scaled up by S so there is room to walk around; furniture stays real size. Camera looks north and you arrive by the lift at the south.
//   west side: Board Room and Huddle Room by the lift, four desk pods along the west windows, Conference Room at the north end
//   middle: the Prompt Lab and Token Room, with the toilets behind them, a row of desks facing the collab area, and the collab area to the north
//   east side: the fire-exit stairs by the lift, the pantry along the east windows, two desk pods,
//   a tile wall with a desk facing it, and the calling rooms in the north-east corner
function buildOffice(a) {
  const S = 1.4, { cx, cz } = a, X = x => cx + x * S, Z = z => cz + z * S, L = v => v * S;
  // this is the second floor: the ground sits a storey below, with the floor below's glass facade under us
  const GROUND = -4.6, facade = [MAT.glass, MAT.glass, MAT.concrete, MAT.concrete, MAT.glass, MAT.glass], SE = Z(13.4);
  plane(130, 130, MAT.darkGrass, cx, GROUND, Z(-4), 2);
  plane(150, 6, MAT.concrete, cx, GROUND + .01, SE + 5.6, 1.5); plane(150, 3, MAT.paver, cx, GROUND + .02, SE + 2, 3);   // road and pavement
  for (const x of [-30, -14, 2, 18, 34]) box(4.2, .12, .5, MAT.white, cx + x, GROUND + .01, SE + 5.6, { cast: false });
  faceBox(L(14.4) + .3, -GROUND - .05, L(26.2) + .3, facade, X(0), GROUND, Z(.3)); faceBox(L(5.2) + .3, -GROUND - .05, L(1.3) + .3, facade, X(4.6), GROUND, Z(-13.45));
  box(L(14.4) + .5, .3, L(26.2) + .5, MAT.concrete, X(0), -.32, Z(.3)); box(L(5.2) + .5, .3, L(1.3) + .5, MAT.concrete, X(4.6), -.32, Z(-13.45));   // slab edge between floors
  plane(L(14.4), L(26.2), MAT.oFloor, X(0), .012, Z(.3), 5); plane(L(5.2), L(1.3), MAT.oFloor, X(4.6), .012, Z(-13.45), 5);
  box(L(16), .5, 1.6, MAT.concrete, cx, -.49, SE + 1, { cast: false });
  WALK.push([X(-7.2) + .2, Z(-12.8) + .2, X(7.2) - .2, SE - .2], [X(2) + .2, Z(-14.1) + .2, X(7.2) - .2, Z(-12.8) + .4]);

  // outer walls: windows on the north, west and east. The north-east corner sticks out past the rest of the north wall
  const windowRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = x0 === x1 ? Math.PI / 2 : 0;
    const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = ry; scene.add(g);
    box(len, .55, .3, MAT.plaster, 0, 0, 0, { p: g }); box(len, 2.55, .12, MAT.window, 0, .55, 0, { p: g, cast: false });   // glass lets the sun in; sill, header and mullions cast box(len, .3, .3, MAT.plaster, 0, 3.1, 0, { p: g });
    for (let s = 0; s <= len; s += 3.6) box(.14, 3.4, .32, MAT.charcoal, s - len / 2, 0, 0, { p: g });
  };
  windowRun(X(-7.2), Z(-12.8), X(2), Z(-12.8));
  windowRun(X(2), Z(-14.1), X(7.2), Z(-14.1));
  box(.3, 3.4, L(1.3), MAT.plaster, X(2), 0, Z(-13.45)); colBox(X(2) - .15, Z(-14.1), X(2) + .15, Z(-12.8));
  windowRun(X(-7.2), Z(-12.8), X(-7.2), Z(6));
  sunShafts('lab', X(-7.2) + .1, Z(-12.8), Z(6), 3.6, .55, 3.1);   // the low afternoon sun comes in through the west windows
  box(.3, 3.4, L(7.4), MAT.plaster, X(-7.2), 0, Z(9.7));
  windowRun(X(7.2), Z(-14.1), X(7.2), Z(3.9));
  for (let i = 0; i < 16; i++) tree(cx + rr(-24, 24), cz + rr(-34, -26), rr(1.2, 1.7), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false).position.y = GROUND;
  for (let i = 0; i < 14; i++) { const s = rnd() < .5 ? -1 : 1; tree(cx + s * rr(13, 24), cz + rr(-24, 12), rr(1.2, 1.6), MAT.leafB, false).position.y = GROUND; }
  pointLight('lab', 0xd6e8ff, 1.3, 16, X(-4), 2.4, Z(-11)); pointLight('lab', 0xd6e8ff, 1.3, 16, X(5), 2.4, Z(-12)); pointLight('lab', 0xd6e8ff, 1.1, 14, X(-5.6), 2.4, Z(-1));

  // ---- south: the lift and electrical duct, the fire-exit stairs, and the waiting area in front ----
  box(L(14.4), 1.1, .2, MAT.plaster, X(0), 0, SE); colBox(X(-7.2), SE - .2, X(7.2), SE + .2);
  const LX = X(-1.1), LZ = Z(9.7), EX = X(.7), lift = grp();
  box(L(3.8), 3.4, SE - LZ, MAT.plaster, X(-.6), 0, (LZ + SE) / 2, { p: lift });
  box(2.6, 3.4, .1, MAT.marble, LX, 0, LZ - .05, { p: lift });
  for (const dx of [-.31, .31]) box(.6, 2.3, .06, MAT.steel, LX + dx, 0, LZ - .12, { p: lift });
  box(.02, 2.32, .07, MAT.charcoal, LX, 0, LZ - .13, { p: lift }); box(1.5, .14, .08, MAT.steel, LX, 2.3, LZ - .12, { p: lift });
  box(.12, .3, .04, MAT.steel, LX + .95, 1.05, LZ - .12, { p: lift });
  box(.8, 2.2, .06, MAT.slat, EX, 0, LZ - .03, { p: lift }); box(.7, .28, .07, MAT.elecSign, EX, 1.75, LZ - .06, { p: lift, s: 0 });
  makeFader(compact(lift), () => hero.zone === 'lab' && hero.x > X(-3.4) && hero.x < X(2.2) && hero.y < LZ + .1 && hero.y > Z(1));
  colBox(X(-2.5), LZ - .1, X(1.3), SE);
  box(1.6, .02, .9, MAT.charcoal, LX, 0, LZ - .6, { cast: false });
  garlandV(LX - .85, LZ - .16, .9, 2.5, true); garlandV(LX + .85, LZ - .16, .9, 2.5, true);
  ledSign(['LIFT · Ground'], '#f6e3b4', LX, 3.75, LZ - .05, 1.8, .34);
  const g = AREAS.pune;   // the lift takes you back down, out of the Calfus building's front doors
  portal(LX, LZ - 1.3, a.color, 'lab', 'pune', 'Ground Floor', { at: [g.cx - 2.5, g.cz - 1.7] });
  INTER.push({ x: EX, z: LZ - .7, r: 1, label: 'Electrical Duct', verb: 'Read', act: () => talk('Electrical Duct', ['AUTHORISED PERSONNEL ONLY.', 'Behind this door: the cables that keep every model in this office running.']) });
  // the fire-exit stairs, a closed block east of the lift with its door onto the waiting area
  const core = grp(), WX = X(1.44);
  box(L(4.26), 3.4, L(7.44), MAT.concrete, X(3.57), 0, Z(9.68), { p: core });
  box(.08, 2.4, 1.3, MAT.exit, WX - .04, 0, Z(7.05), { p: core }); box(.1, .1, 1.45, MAT.charcoal, WX - .05, 2.4, Z(7.05), { p: core });
  // toilets: the women's toilet behind the Token Room, two men's toilets behind the Prompt Lab, a short lobby between them
  box(L(3.86), 3.4, L(2.9), MAT.plaster, X(3.37), 0, Z(4.51), { p: core });
  for (const x of [2.4, 4.3]) box(.9, 2.2, .06, MAT.slat, X(x), 0, Z(3.05) - .03, { p: core });
  box(.3, 3.4, L(9.5), MAT.plaster, X(7.2), 0, Z(8.65), { p: core });   // east outer wall past the pantry
  makeFader(compact(core), () => hero.zone === 'lab' && hero.x > X(.8) && hero.y < Z(5.9) && hero.y > Z(-9));
  colBox(WX, Z(3.05), X(5.7), SE); colBox(X(5.7), Z(3.9), X(7.2), SE);
  const herWc = grp();
  box(L(3.86), 3.4, L(2.8), MAT.plaster, X(3.37), 0, Z(.2), { p: herWc });
  box(.9, 2.2, .06, MAT.slat, X(3.4), 0, Z(1.6) + .03, { p: herWc });
  makeFader(compact(herWc), () => hero.zone === 'lab' && hero.x > X(.8) && hero.x < X(5.8) && hero.y < Z(1.6) && hero.y > Z(-9));
  colBox(WX, Z(-1.2), X(5.3), Z(1.6));
  signBoard('TOILETS', WX - .12, 2.55, Z(2.33), 1.1, .3, Math.PI / 2, { size: 18, bg: '#1d2b4a', edge: '#0e1628', color: '#ffffff', w: 150, h: 40 });
  INTER.push({ x: WX - .4, z: Z(2.33), r: 1.2, label: 'Toilets', verb: 'Read', act: () => talk('Toilets', ['Women\'s on the left, men\'s on the right.', 'Wash your hands. The models are not the only thing that can catch a bug.']) });
  // waiting area: tile wall and planter ahead of the lift, plants by the stairs
  const PZ = Z(5.25) + .35, PW = L(3.3), PC = X(-.5);
  box(PW, .95, .6, MAT.slat, PC, 0, PZ); box(PW + .1, .08, .68, MAT.walnut, PC, .95, PZ);
  box(PW - .1, .04, .04, MAT.ledStrip, PC, .86, PZ + .32, { cast: false });
  for (let x = -PW / 2 + .25; x <= PW / 2 - .2; x += .42) { const l = add(new THREE.Mesh(jitterSphere(rr(.2, .28), 1), MAT.leafA)); l.position.set(PC + x, 1.12, PZ + rr(-.1, .1)); }
  garlandSwag(PC - PW / 2 + .1, PC + PW / 2 - .1, PZ + .35, .9, .3, 3);
  colBox(PC - PW / 2, Z(5.25), PC + PW / 2, PZ + .35);
  bigPlant(WX - .45, Z(6.2)); bigPlant(WX - .45, Z(7.9));
  pointLight('lab', 0xffb060, 1.1, 6, PC, .5, Z(6.6));
  chandelier(X(-.6), Z(7.6));
  INTER.push({ x: PC, z: PZ + .8, r: 1.6, label: 'Front Desk', verb: 'Read', act: () => talk('Front Desk', ['Welcome to the TokenFall office!', 'Desks are down the left, meeting rooms in the middle, and the collab area is at the far end.', 'The marigolds went up for Diwali.']) });
  INTER.push({ x: WX - .6, z: Z(7.05), r: 1.1, label: 'Emergency Exit', verb: 'Read', act: () => talk('Emergency Exit', ['FIRE EXIT · STAIRCASE.', 'Please don\'t. It sets off the alarm, and the stairwell has no Wi-Fi.']) });

  // ---- west side, from the lift going north ----
  room(X(-7), Z(8.7), X(-2.8), SE - .2, 'e', 'Board Room', ['The Board Room.', 'Big decisions happen here. Soon: big lessons about how AI models make decisions.'], { table: 'long', seats: 3, along: true, doorAt: .75 });
  room(X(-7), Z(6.1), X(-3.5), Z(8.55), 'e', 'Huddle Room', ['The Huddle Room.', 'Small room, quick chats. Perfect for a five-minute lesson on what a model can and can\'t know.'], { table: 'round' });
  box(.8, .9, .7, MAT.white, X(-5.2), 0, Z(5.7)); colBox(X(-5.2) - .4, Z(5.7) - .35, X(-5.2) + .4, Z(5.7) + .35);   // storage
  // four desk pods along the west windows, two computers on each side
  for (const z of [-5.6, -2.6, .4, 3.5]) deskCluster(X(-5.75), Z(z), 2, false);
  room(X(-7), Z(-10.5), X(-3.1), Z(-7.2), 'e', 'Conference Room', ['The Conference Room.', 'Today\'s slide: “AI literacy 101: what models are good at, and where they go wrong.”', 'In the corner there is a terminal for the Glass Bridge: pick the right tile, or fall.'], { table: 'long', seats: 3, along: true, sGlass: true });
  if (TF.officeEntrance) { TF.officeEntrance({ x: X(-3.1) - .55, z: Z(-10.5) + .6, near: [X(-3.1) - .5, Z(-10.5) + 1.9] }); sparkles(X(-3.1) - .55, Z(-10.5) + 1.3, 0xffd27a, 22, .6, 2.4); }
  box(L(2.6), .9, .4, MAT.white, X(-4.4), 0, Z(-10.5) - .35); colBox(X(-5.7), Z(-10.5) - .55, X(-3.1), Z(-10.5) - .15);   // storage

  // ---- main corridor running north ----
  for (const z of [-4, 2.5]) chandelier(X(-2.8), Z(z));
  ledSign(['FIRE EXIT'], '#7dff9a', X(-2.8), 2.75, Z(-1.5), 1.1, .3);

  // ---- middle block: the Prompt Lab and Token Room facing the corridor, a row of desks on its north face ----
  room(X(-2.25), Z(3.2), X(1.3), Z(5.25), 'w', 'Prompt Lab', ['The Prompt Lab.', 'A prompt is just the instructions you give a model. Clear context in, better answers out.', 'Sessions start here soon!'], { table: 'round', sMat: MAT.tile });
  room(X(-2.25), Z(-1.2), X(1.44), Z(1.6), 'w', 'Token Room', ['The Token Room.', 'Models read text as tokens, small chunks of words. More tokens means more to read (and pay for).'], { table: 'long', seats: 2, along: true });
  const DZ = Z(-1.2) - .45, DX = X(1.7);
  box(6.9, .05, .6, MAT.walnut, DX, .72, DZ); for (const dx of [-3.4, -1.15, 1.15, 3.4]) box(.05, .72, .55, MAT.white, DX + dx, 0, DZ);
  box(6.8, .4, .04, MAT.fabric, DX, .77, DZ + .27);
  for (const dx of [-2.6, -.87, .87, 2.6]) { box(.6, .36, .04, MAT.charcoal, DX + dx, .9, DZ + .17); box(.56, .32, .02, nextScreen(), DX + dx, .92, DZ + .14); keyboardAt(DX + dx, .77, DZ - .06, -1); deskClutter(DX + dx + .5, .77, DZ - .12); chair(DX + dx, DZ - .75, -1); }
  colBox(DX - 3.5, DZ - .3, DX + 3.5, Z(-1.2));

  // ---- pantry: a galley along the east windows, open to the north ----
  // wooden base cabinets with a white top, black glass wall cabinets, green diamond tiles, tea/coffee urns, black fridge
  const PX = X(5.45), EW = X(7.2) - .15, CZ = Z(1.1), PS = Z(3.9);
  box(.15, 3.4, L(5.25), MAT.plaster, PX - .075, 0, Z(1.27)); box(EW - PX, 3.4, .25, MAT.plaster, (PX + EW) / 2, 0, PS - .12);
  colBox(PX - .3, Z(-1.35), PX, PS); colBox(PX, PS - .25, EW, PS);
  box(.6, .9, 4.4, MAT.walnut, PX + .3, 0, CZ); box(.64, .05, 4.4, MAT.white, PX + .32, .9, CZ);
  box(.02, .7, 4.4, MAT.greenTile, PX + .01, .95, CZ, { s: 0 });
  box(.38, .75, 4.2, MAT.cabinet, PX + .19, 1.7, CZ);
  for (let z = -2; z <= 2.1; z += .75) box(.4, .75, .03, MAT.charcoal, PX + .2, 1.7, CZ + z);
  for (const [z, h] of [[-.9, .5], [-.4, .42], [1.1, .55]]) { const u = add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, h, 12), MAT.steel)); u.position.set(PX + .3, .95 + h / 2, CZ + z); }
  box(.04, .45, .32, MAT.yellowBoard, PX + .2, .95, CZ + .3);
  for (let i = 0; i < 4; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .09, 8), MAT.white)); c.position.set(PX + .4, 1, CZ + .5 + i * .1); }
  const FZ = PS - .7;
  box(.75, 1.95, .75, MAT.charcoal, PX + .38, 0, FZ); box(.03, .9, .04, MAT.chrome, PX + .77, .9, FZ - .2); box(.25, .3, 1, MAT.white, EW - .1, 2.4, CZ);
  colBox(PX, CZ - 2.2, PX + .8, PS - .25);
  // water jugs and the wet and dry waste bins by the window
  const jug = new THREE.MeshStandardMaterial({ color: 0x48c2d4, transparent: true, opacity: .75, roughness: .2 });
  for (let i = 0; i < 3; i++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .48, 12), jug); j.position.set(EW - .3 - i * .05, .24, CZ + 1.2 + i * .4); scene.add(j); }
  const BZ = Z(-1.35) + .7;
  for (const [z, lid] of [[0, 0x2f7de0], [.7, 0x2aa05a]]) {
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .18, .7, 14), MAT.chrome)); b.position.set(EW - .3, .35, BZ + z);
    const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .03, 14), new THREE.MeshStandardMaterial({ color: lid }))); l.position.set(EW - .3, .71, BZ + z);
  }
  colBox(EW - .6, BZ - .3, EW, BZ + 1); colBox(EW - .6, CZ + 1, EW, CZ + 2.2);
  const diya = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: .6, roughness: .35, emissive: 0x4a3000 });
  for (let i = 0; i < 9; i++) { const dd = add(new THREE.Mesh(new THREE.ConeGeometry(.06, .1, 6), diya), null, false); dd.position.set(PX + .02, 2.9 - i * .2, Z(-1.35) + .6); }
  pointLight('lab', 0xffd6a0, 1, 7, (PX + EW) / 2, 2.6, CZ);
  INTER.push({ x: (PX + EW) / 2, z: CZ, r: 1.5, label: 'Pantry', verb: 'Look', act: () => talk('Pantry', ['Filter coffee, masala chai, and a sign: “Everyone has to use this kitchen. Let\'s keep it nice.”', 'Wet waste and dry waste bins are by the window. Please sort your trash.']) });

  // ---- east side going north: two desk pods, a desk facing the tile wall, the calling rooms behind it ----
  for (const z of [-7.95, -4.9]) deskCluster(X(7.2) - 1.85, Z(z), 2, false);   // pushed up against the east windows
  const TW = Z(-11.35);
  // the tile wall runs from the window corner right across to the east windows, hiding the calling rooms behind it
  const T0 = X(2) - .15;
  // the short return at its west end, by the window, has the doorway to the calling rooms behind it
  const T1 = EW, RZ0 = Z(-12.8), RZ1 = TW - .15, D0 = (RZ0 + RZ1) / 2 - .65, D1 = D0 + 1.3;
  box(T1 - T0, 3.4, .3, MAT.tile, (T0 + T1) / 2, 0, TW); colBox(T0, TW - .15, T1, TW + .15);
  box(.3, 3.4, D0 - RZ0, MAT.tile, X(2), 0, (RZ0 + D0) / 2); box(.3, 3.4, RZ1 - D1, MAT.tile, X(2), 0, (D1 + RZ1) / 2); box(.3, 1, D1 - D0, MAT.tile, X(2), 2.4, (D0 + D1) / 2);
  box(.34, 2.4, .08, MAT.walnut, X(2), 0, D0); box(.34, 2.4, .08, MAT.walnut, X(2), 0, D1);
  colBox(T0, RZ0, X(2) + .15, D0); colBox(T0, D1, X(2) + .15, RZ1);
  const WD = X(7.2) - 1.85, WZ = TW + .6;
  box(3.4, .05, .6, MAT.walnut, WD, .72, WZ); for (const dx of [-1.65, 1.65]) box(.05, .72, .55, MAT.white, WD + dx, 0, WZ);
  for (const dx of [-.85, .85]) { box(.6, .36, .04, MAT.charcoal, WD + dx, .9, WZ - .2); box(.56, .32, .02, nextScreen(), WD + dx, .92, WZ - .17); keyboardAt(WD + dx, .77, WZ + .08, 1); deskClutter(WD + dx + .5, .77, WZ + .12); chair(WD + dx, WZ + .75, 1); }
  colBox(WD - 1.7, WZ - .3, WD + 1.7, WZ + .3);
  // two glass calling rooms in the corner, doors facing west
  const bx0 = X(5.67), bx1 = EW, bm = (bx0 + bx1) / 2, bw = bx1 - bx0;
  for (const [z0, z1] of [[Z(-14.1) + .15, Z(-12.7)], [Z(-12.7) + .05, TW - .16]]) {
    const g = grp(), zm = (z0 + z1) / 2, d = z1 - z0;
    box(.08, 2.5, d, MAT.walnut, bx0, 0, zm, { p: g }); box(.04, 2.3, d - .2, MAT.pane, bx0, .1, zm, { p: g, cast: false });
    for (const z of [z0, z1]) box(bw, 2.5, .08, MAT.walnut, bm, 0, z, { p: g });
    box(bw, .08, d, MAT.walnut, bm, 2.5, zm, { p: g });
    box(.5, .05, .6, MAT.walnut, bx1 - .3, .72, zm, { p: g }); stool(bx1 - .85, zm);
    makeFader(compact(g), () => hero.zone === 'lab' && hero.x > bx0 - 1 && hero.y < z1 && hero.y > z0 - 8);
    colBox(bx0 - .07, z0, bx1, z1);
  }
  INTER.push({ x: bx0 - .7, z: Z(-12.7), r: 1.3, label: 'Calling Rooms', verb: 'Read', act: () => talk('Calling Rooms', ['Two soundproof booths for calls.', 'Book one before your client call, not during it.']) });

  // ---- north: the collab area (sofa, armchairs, the carrom table), the window bar ----
  // a compact group: the sofa and armchairs a little south of the plan, the carrom table just in front of them, the rug under both
  const SZ = Z(-10.15) + .8, tx = X(.35), tz = SZ + 4.4;
  plane(L(3), tz + 1.6 - (SZ - .6), MAT.felt, X(.3), .02, (SZ - .6 + tz + 1.6) / 2, 1);
  sofa(X(.3), SZ, 0, .8);
  tubChair(X(1.3), SZ + 1.6); tubChair(X(-.75), SZ + 1.6);
  for (const [dx, dz] of [[-.95, 0], [.95, 0], [0, -.95], [0, .95]]) tubChair(tx + dx, tz + dz);
  for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box(.06, .6, .06, MAT.charcoal, tx + dx, 0, tz + dz);
  box(1, .07, 1, MAT.carrom, tx, .6, tz, { s: 0 }); colCirc(tx, tz, .6);
  for (let i = 0; i < 9; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .015, 8), i % 3 ? (i % 2 ? MAT.charcoal : MAT.white) : MAT.pink)); c.position.set(tx + rr(-.3, .3), .68, tz + rr(-.3, .3)); }
  INTER.push({ x: tx, z: tz + 1.6, r: 1.5, label: 'Carrom Board', verb: 'Play', act: () => talk('Carrom Board', ['Someone left a game half finished. The queen is still on the board.', 'Carrom tournaments: coming soon to TokenFall!']) });
  chandelier(X(.3), (SZ + tz) / 2, 3.15);
  // a counter with stools along the north windows, including the bit behind the tile wall
  const NZ = Z(-12.8) + .3, N2 = Z(-14.1) + .3;
  box(X(1.9) - X(-7), .06, .45, MAT.walnut, (X(1.9) + X(-7)) / 2, 1.05, NZ); for (let x = -6.9; x < 2; x += 2.2) box(.05, 1.05, .05, MAT.white, X(x), 0, NZ);
  for (const x of [1.44, -.1, -1.87, -3.5, -5, -6.4]) stool(X(x), NZ + .45);
  colBox(X(-7), NZ - .25, X(1.9), NZ + .25);
  box(X(5.5) - X(2.2), .06, .45, MAT.walnut, (X(5.5) + X(2.2)) / 2, 1.05, N2); for (const x of [2.3, 5.4]) box(.05, 1.05, .05, MAT.white, X(x), 0, N2);
  for (const x of [2.7, 4]) stool(X(x), N2 + .45);
  colBox(X(2.2), N2 - .25, X(5.5), N2 + .25);

  // all the marigold beads in one draw call
  const bead = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, emissive: 0x6a2a00, emissiveIntensity: .35 }), BEADS.length);
  const d = new THREE.Object3D(), col = new THREE.Color();
  BEADS.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(rnd() * 3, rnd() * 3, 0); d.scale.setScalar(rr(.85, 1.2)); d.updateMatrix(); bead.setMatrixAt(i, d.matrix); bead.setColorAt(i, col.set(p[3] ? (i % 4 < 2 ? 0xf28ab0 : 0xffd23a) : rnd() < .55 ? 0xff9a1a : 0xffc61a)); });
  bead.castShadow = true; scene.add(bead);
}
