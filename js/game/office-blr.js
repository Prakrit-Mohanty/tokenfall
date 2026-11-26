// TokenFall: the Calfus Bengaluru office (zone "blr"), where the train from the lobby's station brings you. An open floor high above the Garden
// City: a window wall over rain trees, apartment blocks and the metro's purple line; two desk pods by the glass; the Cubbon and Lalbagh meeting
// rooms down the west wall; a lounge under a Namma Bengaluru mural; the filter-coffee counter; the Calfus C by the way in, and the train home.
// A first pass from what Bengaluru offices are like, not from photos of this one: tell us what it really looks like and it will.
// Classic script: shares one global scope with the other js/game files; loaded after office-us.js (its windows, plants) and city.js.

const BLR_HALF = [11, 8];

// the mural over the lounge: Vidhana Soudha, a rain tree, an auto and a cup of filter coffee under "Namma Bengaluru"
function blrMuralTex() {
  return canvasTex(512, 256, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 256); sky.addColorStop(0, '#f7d9b0'); sky.addColorStop(1, '#f3bd9f'); g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#efc062'; g.beginPath(); g.arc(420, 70, 34, 0, 7); g.fill();   // the sun
    // Vidhana Soudha: a long colonnade, a portico and the big dome
    g.fillStyle = '#f6ecd9'; g.fillRect(120, 140, 260, 70); g.fillRect(205, 105, 90, 40); g.beginPath(); g.arc(250, 105, 38, Math.PI, 0); g.fill(); g.fillRect(246, 52, 8, 20);
    g.fillStyle = '#cdbd9f'; for (let x = 128; x < 380; x += 14) g.fillRect(x, 150, 5, 56); for (let x = 210; x < 292; x += 12) g.fillRect(x, 112, 4, 30);
    // a rain tree, wide as a street
    g.fillStyle = '#7a5a3a'; g.fillRect(52, 150, 12, 70); g.fillStyle = '#8fc47f'; for (const [x, y, r] of [[30, 140, 34], [60, 120, 40], [95, 140, 32], [58, 152, 30]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    // an auto, yellow and green
    g.fillStyle = '#5e9d5a'; g.fillRect(398, 178, 70, 30); g.fillStyle = '#f4dc92'; g.beginPath(); g.moveTo(398, 178); g.quadraticCurveTo(430, 140, 468, 178); g.fill();
    g.fillStyle = '#5a4256'; for (const x of [408, 458]) { g.beginPath(); g.arc(x, 210, 9, 0, 7); g.fill(); }
    // a tumbler of kaapi in its davara
    g.fillStyle = '#b9a3b0'; g.fillRect(330, 214, 30, 8); g.fillRect(336, 190, 18, 26); g.fillStyle = '#e8d6b8'; g.fillRect(338, 186, 14, 6);
    g.fillStyle = '#5a4256'; g.fillRect(0, 222, 512, 34); g.font = '700 26px "Baloo 2", Poppins, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#f6ecd9'; g.fillText('NAMMA BENGALURU', 256, 247);
  }, { keep: true, smooth: true });
}

function buildBLR(a) {
  const { cx, cz } = a, [hx, hz] = BLR_HALF, X = (v) => cx + v, Z = (v) => cz + v;
  withSideRandom(() => {
    const M = usMaterials();
    const oak = std(canvasTex(64, 32, (g) => { for (let x = 0; x < 64; x += 8) { g.fillStyle = ['#d9b98c', '#cfae7e', '#e2c497', '#c9a676'][(x / 8) % 4]; g.fillRect(x, 0, 8, 32); } g.fillStyle = 'rgba(120,80,40,.2)'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 32); g.fillRect(0, 15, 64, 1); }, { keep: true }), 1.6);
    const teal = new THREE.MeshStandardMaterial({ color: PAL.teal, roughness: .8 }), plum = new THREE.MeshStandardMaterial({ color: PAL.lilac, roughness: .85 });
    // ---- the floor, the walls (windows north, a low south wall so the camera sees in), the lights ----
    plane(2 * hx, 2 * hz, oak, cx, .012, cz, 1.6);
    WALK.push([X(-hx + .3), Z(-hz + .3), X(hx - .3), Z(hz - .3)]);
    usWindows(X(-hx), Z(-hz), X(hx), Z(-hz), M, [7.4, 14.6]);
    for (const s of [-1, 1]) { box(.3, 3.7, 2 * hz, M.white, X(s * hx), 0, cz); colBox(X(s * hx) - .2, Z(-hz), X(s * hx) + .2, Z(hz)); }
    box(2 * hx, 1.1, .3, M.white, cx, 0, Z(hz)); colBox(X(-hx), Z(hz) - .2, X(hx), Z(hz) + .2);
    for (const [x, z] of [[-5, -3], [4, -3], [0, 4]]) pointLight('blr', 0xfff0d8, 1.2, 12, X(x), 3.2, Z(z));
    // ---- the view: the Garden City far below, apartment blocks, rain trees and the purple metro line on its viaduct ----
    plane(180, 90, MAT.darkGrass, cx, -11, cz - 52, 2);
    const blockTex = std(canvasTex(32, 64, (g) => { g.fillStyle = '#efe3cf'; g.fillRect(0, 0, 32, 64); for (let y = 4; y < 64; y += 8) for (let x = 3; x < 32; x += 8) { g.fillStyle = (x * 7 + y) % 5 ? '#8ea7b8' : '#f0d9a0'; g.fillRect(x, y, 4, 4); } }, { keep: true }), 4);
    for (const [x, z, w, d, h] of [[-38, -40, 12, 10, 26], [-20, -52, 10, 9, 34], [-2, -44, 14, 10, 22], [18, -56, 11, 10, 38], [34, -42, 12, 10, 28], [52, -58, 14, 11, 30], [-56, -60, 12, 12, 32]]) box(w, h, d, blockTex, X(x), -11, Z(z), { cast: false });
    for (let i = 0; i < 26; i++) { const t = tree(X(rr(-70, 70)), Z(rr(-62, -22)), rr(1.6, 2.4), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false); t.position.y = -11; }
    { const mz = Z(-30), metro = new THREE.MeshStandardMaterial({ color: 0x8e5bb5, roughness: .5 });
      box(170, .7, 1.8, MAT.concrete, cx, -4.4, mz, { cast: false }); for (let x = -80; x <= 80; x += 16) box(.9, 6.6, .9, MAT.concrete, X(x), -11, mz, { cast: false });
      box(26, 1.7, 1.5, metro, X(-12), -3.7, mz, { cast: false }); box(26, .3, 1.52, MAT.white, X(-12), -2.6, mz, { cast: false }); }
    INTER.push({ x: X(-1), z: Z(-hz + 1.3), r: 2.2, label: 'The view', verb: 'Look', act: () => talk('Bengaluru', ['The Garden City: rain trees as far as you can see, and the purple metro line gliding past.', 'Somewhere down there the Outer Ring Road is doing 4 km/h. You came by train. Smart.']) });

    // ---- by the glass: two desk pods ----
    deskCluster(X(-5.2), Z(-4.4), 3, false); deskCluster(X(3.6), Z(-4.4), 3, false);
    for (const [x, z] of [[-10.2, -6.9], [9.9, -6.9], [-.8, -6.8]]) bigPlant(X(x), Z(z));
    // ---- the west wall: the Cubbon and Lalbagh rooms ----
    room(X(-hx + .2), Z(-1.2), X(-6.4), Z(3.2), 'e', 'Cubbon', ['The Cubbon room. On the whiteboard: "Ship small, check often."', 'Someone has drawn a rain tree in the corner. It has better leaves than the architecture diagram.'], { small: true });
    room(X(-hx + .2), Z(3.6), X(-6.4), Z(hz - .2), 'e', 'Lalbagh', ['The Lalbagh room. Booked every afternoon this week for "prompt reviews".', 'A sticky note on the screen: "If the AI sounds sure, ask it how it knows."'], { small: true, sGlass: true });
    // ---- the lounge under the mural ----
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshStandardMaterial({ map: blrMuralTex(), roughness: .8 }));
    mural.position.set(X(hx) - .17, 2.1, Z(.6)); mural.rotation.y = -Math.PI / 2; scene.add(mural);
    INTER.push({ x: X(hx - 2.2), z: Z(.6), r: 1.8, label: 'Namma Bengaluru', verb: 'Look', act: () => talk('Namma Bengaluru', ['A mural down the wall: Vidhana Soudha, a rain tree, an auto, and a tumbler of filter coffee.', 'Painted by the team in one long weekend. The auto took three tries.']) });
    plane(4.2, 3, plum, X(5.6), .018, Z(.9), 1); sofa(X(5.6), Z(2.4), Math.PI, 1, teal); sofa(X(8.1), Z(.9), -Math.PI / 2, .8, teal);
    { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .06, 24), MAT.walnut)); t.position.set(X(5.4), .42, Z(.8)); box(.12, .4, .12, MAT.charcoal, X(5.4), 0, Z(.8)); colCirc(X(5.4), Z(.8), .6); }
    for (const [x, z] of [[2.6, .2], [2.8, 1.8]]) tubChair(X(x), Z(z));
    vinePole(X(9.6), Z(-2.6)); fernPot(X(hx - .8), Z(4.6));
    // ---- the filter-coffee counter, north-east ----
    { const x = X(hx - 1.6), z = Z(-3.4);
      box(.9, .95, 3.2, MAT.white, x, 0, z); box(1, .06, 3.3, MAT.walnut, x, .95, z);
      box(.5, .55, .45, MAT.chrome, x, 1.01, z - 1); box(.36, .3, .05, MAT.charcoal, x - .26, 1.2, z - 1);
      const steel = new THREE.MeshStandardMaterial({ color: 0xc6ccd4, roughness: .25, metalness: .6 });
      for (let i = 0; i < 4; i++) { const zz = z + .1 + i * .32; const d = add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .07, .05, 14), steel), null, false); d.position.set(x - .1, 1, zz); const tm = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .13, 12), steel), null, false); tm.position.set(x - .1, 1.09, zz); }
      signBoard('Filter Kaapi', x - .48, 1.75, z, 1.6, .38, -Math.PI / 2, { size: 18, bg: PAL.peach });
      colBox(x - .5, z - 1.7, x + .5, z + 1.7);
      INTER.push({ x: x - 1.3, z, r: 1.5, label: 'Filter Kaapi', verb: 'Pour', act: () => talk('Filter Kaapi', ['You pour the coffee from the tumbler into the davara and back, from a height, until it froths. Perfect.', 'A note by the decoction: "Context matters. So does decoction. Never skip either."']) }); }
    // ---- the way in: the Calfus C, a little reception desk, the train home ----
    { const c = document.createElement('canvas'); c.width = 227; c.height = 256; const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * 227 / 256, 1.6), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .05, roughness: .45, side: THREE.DoubleSide }));
      logo.position.set(X(hx) - .2, 2.1, Z(5.4)); logo.rotation.y = -Math.PI / 2; logo.castShadow = true; scene.add(logo);
      calfusLogo((img) => { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); t.needsUpdate = true; }); }
    signBoard('Calfus · Bengaluru', X(hx) - .18, 3.05, Z(5.4), 2.4, .4, -Math.PI / 2, { size: 18, bg: PAL.cream });
    box(2.2, 1, .7, MAT.walnut, X(5.2), 0, Z(6.6)); box(2.3, .06, .8, MAT.white, X(5.2), 1, Z(6.6)); colBox(X(4), Z(6.2), X(6.4), Z(7));
    INTER.push({ x: X(5.2), z: Z(5.6), r: 1.4, label: 'Reception', verb: 'Say hi', act: () => talk('Reception', ['Welcome to Calfus Bengaluru! Sign the visitor book, grab a coffee, and say hi to the team.', 'Train back to TokenFall is by the door, any time.']) });
    portal(X(9), Z(6.4), 0xb48ce6, 'blr', 'lobby', 'Train to TokenFall');
  });
  Object.assign(NPC_TALK, {   // what the Bengaluru team says (main.js makes them)
    'kavya.n': ['Welcome to Bengaluru! Coffee is by the window. Filter, obviously.', 'We check every AI answer before it goes to a client. Every single one.'],
    'rohan.b': ['You came by train? Lucky. The Outer Ring Road was a car park this morning.', 'I asked an AI for the fastest route here. It said "teleport". Technically true.'],
    'divya.s': ['Tip from the Bengaluru team: ask the model where it got that, then go and read it yourself.', 'The Cubbon room has the good whiteboard. Do not tell Pune.'],
  });
  NPC_BOUNDS.blr = [X(-5), Z(-1.8), X(8), Z(5)];
}

// the Bengaluru team: name, where they start (from the office's centre); main.js makes them and they wander the floor
const BLR_TEAM = [['kavya.n', 2, -1.5], ['rohan.b', -3, 1.6], ['divya.s', 6.4, -1]];

