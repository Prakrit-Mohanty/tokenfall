// TokenFall: Pune, a city street. A wide concrete main road runs from Crescent Bay east to ABZ, crossed by two side streets
// at signal junctions; office towers, mixed-use blocks with shops, a fuel station, apartment rows and a glass office on
// stilts line it; autos park along the kerbs, a metro viaduct runs over the west end, a khau galli opens opposite ABZ,
// and a bike taxi rides you between Crescent Bay and ABZ, following the traffic.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const PUNE_MZ = 16;
const PUNE_RX = 14.5;
const PUNE_RX2 = 60;
const PUNE_ABZ = [92, -4.5];
const PUNE_CAMPUS = [22, 28, 53, 46];
const PUNE_GALLI = [104, 25, 112, 50];
const PUNE_SQUARE = [96, 50, 120, 62];
const PUNE_ROAD_X = [-160, 260];
const PUNE_PARK_AISLE = -13.3;   // the Crescent Bay car park's aisle and driveway, x from cx: the north kerb is cut for it
const PUNE_LANE_X = [-70, 160];
const PUNE_LANES = { eastOuter: 12.6, eastInner: 14.6, westInner: 17.4, westOuter: 19.4 };
const PUNE_TAXI_STANDS = { cb: [5, 8.6], abz: [80, 8.6] };
const PUNE_TAXI_BAY = PUNE_MZ - 5.05;
const PUNE_DOF = { farStart: 14, farRange: 50, edgeBlur: .25 };
const PUNE_WALLS = [0xf2ece0, 0xf3e3b8, 0xf2d2cc, 0xd8e6ee, 0xe8e2d6, 0xf0dcc0];
const PUNE_FOOD = [['Amruttulya Chai', 0xb8543c, ['Cutting chai, ₹12. Strong enough to fix any bug.', 'The tea master says his recipe has never been "retrained".']], ['Vada Pav', 0xc98a3a, ['Two vada pav with garlic chutney!', 'A model would call this "two tokens of happiness".']], ['Misal House', 0xa8432c, ['Misal pav, extra tarri.', 'Spice level: "are you sure?"']], ['Juice Centre', PAL.leaf, ['Sugarcane juice, fresh.', 'The menu changes with the season, unlike some training data.']], ['Bhel & Pani Puri', PAL.rose, ['Pani puri, six pieces. Pace yourself.', 'Fun fact: nobody has ever eaten just one.']], ['Bakery', 0x8a6a3a, ['Shrewsbury-style biscuits, still warm.', 'Fresh batch every hour. Fresher than most chatbots\' knowledge.']], ['Momos', 0x6a5a8a, ['Steamed momos with red chutney.', 'Eight per plate, counted carefully.']], ['Kulfi', 0x3f6f9f, ['Malai kulfi on a stick.', 'It melts faster than a deadline.']]];

const pMats = {};
const pOnce = (key, make) => pMats[key] || (pMats[key] = make());

// ---------------------------------------------------------------- materials drawn for Pune (pixel textures, like the rest of the game)
function puneMaterials() {
  // Pune's footpaths (only Pune's: the lobby keeps its pastel tile): basket-weave pavers (pavement_1.glb via tools/roads-pack.py), a texture every ~2.4 m
  // (callers lay it every 3 m, hence the repeat), so each brick is a real ~20 x 10 cm
  const brick = pOnce('brick', () => { const t = new THREE.TextureLoader().load(window.ROAD_TEX.pavers); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.25, 1.25); t.anisotropy = 8; return std(t, 0, { roughness: .9 }); });
  const granite = pOnce('granite', () => std(canvasTex(32, 16, (g) => {
    g.fillStyle = PAL.paint; g.fillRect(0, 0, 32, 16);
    for (let y = 0; y < 16; y += 8) for (let x = (y / 8) * 4; x < 36; x += 8) { g.fillStyle = [PAL.paint, PAL.paintLight, PAL.plum][rnd() * 3 | 0]; g.fillRect(x - 4, y, 7, 7); }
    for (const x of [6, 22]) { g.fillStyle = PAL.paintLight; g.fillRect(x, 2, 2, 5); g.fillRect(x + 4, 10, 2, 5); }
  }, { nearest: false }), 1.2, { roughness: .7, metalness: 0 }));
  // the road surfaces (js/models/road-tex.js, tools/roads-pack.py): asphalt for every road, and the two-lane street strip (edge lines and a dashed centre) for the side streets
  const roadTex = (k) => { const t = new THREE.TextureLoader().load(window.ROAD_TEX[k]); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const concrete = pOnce('roadConcrete', () => std(roadTex('asphalt'), 4, { roughness: .92 }));
  const street = pOnce('roadStreet', () => std(roadTex('street'), 0, { roughness: .92 }));
  const tabebuia = pOnce('tabebuia', () => std(canvasTex(16, 16, (g) => {
    g.fillStyle = '#e88ab0'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 40; i++) { g.fillStyle = ['#f4a8c8', '#c8648c', '#5f8a3a'][i % 3]; g.fillRect(rnd() * 16 | 0, rnd() * 16 | 0, 1, 1); }
  }, { nearest: true }), 0));
  return { brick, granite, concrete, tabebuia, street };
}

// ---------------------------------------------------------------- ground: the concrete road, brick footpaths, two side streets
function puneGround(cx, cz, M) {
  plane(460, 360, std(TX.concrete, 1.5, { roughness: 1, color: 0x8a8c90 }), cx + 50, -.012, cz + 20, 1.5);
  const [x0, x1] = PUNE_ROAD_X, rl = x1 - x0, rm = (x0 + x1) / 2;
  plane(rl, 12, M.concrete, cx + rm, .02, cz + PUNE_MZ, 4);
  // lane markings on the main road, kept out of the junctions: a solid double centre line, dashed lines between the two lanes each way, solid edge lines
  const paint = pOnce('roadPaint', () => new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: .8 })), amber = pOnce('roadAmber', () => new THREE.MeshStandardMaterial({ color: 0xf0c060, roughness: .8 }));
  for (const [a, b] of [[x0, PUNE_RX - 6], [PUNE_RX + 6, PUNE_RX2 - 6], [PUNE_RX2 + 6, x1]]) {
    for (const dz of [-.14, .14]) box(b - a, .01, .1, amber, cx + (a + b) / 2, .021, cz + PUNE_MZ + dz, { cast: false });
    for (const dz of [-5.4, 5.4]) box(b - a, .01, .12, paint, cx + (a + b) / 2, .021, cz + PUNE_MZ + dz, { cast: false });
    for (const dz of [-2.4, 2.4]) for (let x = a + 1; x + 3 <= b; x += 6) box(3, .01, .12, paint, cx + x + 1.5, .021, cz + PUNE_MZ + dz, { cast: false });
  }
  const runs = [[x0, PUNE_RX - 3], [PUNE_RX + 3, PUNE_RX2 - 3], [PUNE_RX2 + 3, x1]];
  for (const [a, b] of runs) {
    for (const z of [PUNE_MZ - 7.5, PUNE_MZ + 7.5]) plane(b - a, 3, M.brick, cx + (a + b) / 2, .024, cz + z, 3);
    { const p = a > x0 ? a + 1.8 : a, q = b < x1 ? b - 1.8 : b;   // stopped short of the side streets' own footpaths, so it never cuts across one
      for (const z of [PUNE_MZ - 9.16, PUNE_MZ + 9.16]) box(q - p, .045, .32, MAT.concrete, cx + (p + q) / 2, 0, cz + z, { cast: false }); }   // the pale edging band at the back of every footpath, against the forecourts and the ground behind
    for (const z of [PUNE_MZ - 6.1, PUNE_MZ + 6.1]) {
      const cut = z < PUNE_MZ && a < PUNE_PARK_AISLE && b > PUNE_PARK_AISLE ? [PUNE_PARK_AISLE - 2.6, PUNE_PARK_AISLE + 2.6] : null;   // the dropped kerb at the car park's driveway
      for (const [p, q] of cut ? [[a, cut[0]], [cut[1], b]] : [[a, b]]) box(q - p, .16, .22, MAT.concrete, cx + (p + q) / 2, 0, cz + z, { cast: false });
    }
  }
  for (const sx of [PUNE_RX, PUNE_RX2]) {
    { const g = new THREE.PlaneGeometry(6, 230); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 230 / 9);   // the strip once across, a tile every 9 m along
      const me = new THREE.Mesh(g, M.street); me.position.set(cx + sx, .021, cz - 5); me.receiveShadow = true; scene.add(me); }
    for (const s of [-3.9, 3.9]) for (const [z0, z1] of [[-120, PUNE_MZ - 6], [PUNE_MZ + 6, 110]]) plane(1.8, z1 - z0, M.brick, cx + sx + s, .025, cz + (z0 + z1) / 2, 3);
    // the side streets' footpaths get what the main road's have: a kerb at the road (x ±3) and a pale edging band at the back (x ±4.8)
    for (const s of [-1, 1]) for (const [z0, z1] of [[-120, PUNE_MZ - 9], [PUNE_MZ + 9, 110]]) {
      box(.22, .16, z1 - z0, MAT.concrete, cx + sx + s * 3, 0, cz + (z0 + z1) / 2, { cast: false });
      box(.32, .045, z1 - z0, MAT.concrete, cx + sx + s * 4.96, 0, cz + (z0 + z1) / 2, { cast: false });
    }
  }
  const yb = pOnce('yb', () => std(canvasTex(8, 2, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1c1c20' : '#f2c418'; g.fillRect(i, 0, 1, 2); } }, { nearest: true }), 1));
  for (const x of [36, 118]) box(.6, .08, 11.6, yb, cx + x, .02, cz + PUNE_MZ, { cast: false });
  // zebra crossings: over the main road either side of each junction and at the khau galli, over each side street at both footpaths
  const Mz = cz + PUNE_MZ, gx = cx + (PUNE_GALLI[0] + PUNE_GALLI[2]) / 2;
  for (let t = -5.5; t <= 5.5; t += 1) for (const x of [cx + PUNE_RX - 5.4, cx + PUNE_RX + 5.4, cx + PUNE_RX2 - 5.4, cx + PUNE_RX2 + 5.4, gx]) box(x === gx ? 4 : 2.4, .015, .5, MAT.white, x, .022, Mz + t, { cast: false });
  for (const sx of [PUNE_RX, PUNE_RX2]) for (let t = -2.5; t <= 2.5; t += 1) for (const z of [Mz - 7.5, Mz + 7.5]) box(.5, .015, 2.4, MAT.white, cx + sx + t, .023, z, { cast: false });
  manholes([[cx + 20, cz + PUNE_MZ - 2], [cx + 70, cz + PUNE_MZ + 2], [cx - 30, cz + PUNE_MZ - 1.5], [cx + 44, cz + PUNE_MZ + 3]]);
}

// a low black granite wall with a planter strip behind it; gaps let you through
function graniteWall(M, x0, x1, z, gaps, side, trees) {
  const cuts = [x0, ...gaps.flatMap((g) => [g - 1.3, g + 1.3]), x1];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2;
    box(b - a, 1.2, .4, M.granite, m, 0, z);
    box(b - a, .3, 2.2, MAT.concrete, m, 0, z - side * 1.3, { cast: false }); plane(b - a - .2, 2, MAT.dirt, m, .31, z - side * 1.3, 1);
    for (let x = a + 1; x < b - .5; x += 1.4) bush(x, z - side * 1.3, rr(.55, .8), [MAT.leafA, MAT.leafC][rnd() * 2 | 0]);
    for (let x = a + 3; x < b - 2; x += 6) tree(x, z - side * 1.6, rr(.9, 1.2), trees, false);
    colBox(a, Math.min(z, z - side * 2.4) - .2, b, Math.max(z, z - side * 2.4) + .2);
  }
}

// ---------------------------------------------------------------- buildings
// a Pune block with shops on the ground floor and balconies above; facing +1 fronts it towards +z, -1 towards -z
function puneBlock(x, front, w, d, h, { facing = -1, shops = true } = {}) {
  const f = facing, wall = vTint(TX.plaster, 1, PUNE_WALLS[rnd() * PUNE_WALLS.length | 0]), floors = Math.max(3, Math.round(h / 3));
  box(w, h, d, wall, x, 0, front - f * d / 2);
  for (let i = 1; i < floors; i++) {
    const y = i * h / floors;
    box(w + .3, .14, .9, MAT.concrete, x, y - .07, front + f * .4);
    box(w + .3, .5, .06, MAT.metal, x, y, front + f * .82, { cast: false });
    for (let k = 0; k < Math.floor(w / 2.2); k++) {
      const wx = x - w / 2 + 1.1 + k * 2.2;
      framedWindow(wx, y - 1.7, front, .9, 1.1, rnd() < .4 ? MAT.glassLit : MAT.glass, f, decorRandom() < .3);
      if (rnd() < .3) box(.7, .45, .35, MAT.white, wx + .9, y - 1.2, front + f * .2);
      if (rnd() < .22) box(.5, .45, .03, pOnce('laundry' + (k % 4), () => new THREE.MeshStandardMaterial({ color: [PAL.coral, PAL.sky, PAL.gold, 0xe8e6e0][k % 4], roughness: 1 })), wx, y - .05 - .45, front + f * .84, { cast: false });
    }
  }
  for (let k = 0; k < 2; k++) { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .9, 10), MAT.charcoal)); t.position.set(x - w / 4 + k * w / 2, h + .45, front - f * d / 2); }
  if (shops) {
    const n = Math.max(1, Math.floor(w / 4.5)), sw = w / n;
    for (let i = 0; i < n; i++) {
      const sx = x - w / 2 + sw * (i + .5);
      box(sw - .3, 2.2, .06, rnd() < .75 ? MAT.glassLit : MAT.metal, sx, .3, front + f * .04, { cast: false, s: 0 });
      box(sw - .2, .1, 1, MAT.awning, sx, 2.6, front + f * .5);
      signBoard(SHOP_NAMES[rnd() * SHOP_NAMES.length | 0], sx, 3.05, front + f * .08, sw - .5, .42, f > 0 ? 0 : Math.PI, { size: 18, bg: ['#7a2a24', '#24527a', '#2a6a3a', '#6a4a1a'][rnd() * 4 | 0], color: '#fff3d0', w: 200, h: 40 });
    }
  }
  colBox(x - w / 2, Math.min(front, front - f * d), x + w / 2, Math.max(front, front - f * d));
}

// the north side between the two junctions: a glass office tower on a plaza, and a mixed-use block with shops
function puneTowers(cx, cz, M) {
  const front = cz + 4;
  plane(30, 2.84, cbStone(), cx + 37, .022, front + 1.42, 2);   // its plaza in the same stone as the forecourts round it, stopping at the footpath's edging band (z 6.84), not running over the footpath
  officeBlock(cx + 30, front - 8, 15, 16, 30, { floors: 9, fins: 2.5, front: MAT.glass, side: MAT.cladding });
  ledSign(['SKYLINE TOWER'], '#d6ecff', cx + 30, 3.6, front + .1, 3.6, .5);
  for (const x of [24, 36]) { box(1.8, .5, 1.8, MAT.concrete, cx + x, 0, front + 2.6); bush(cx + x, front + 2.6, .9, MAT.leafA); colBox(cx + x - .9, front + 1.7, cx + x + .9, front + 3.5); }
  puneBlock(cx + 46.5, front, 11, 12, 22, { facing: 1 });
  INTER.push({ x: cx + 30, z: front + 1.6, r: 1.8, label: 'Skyline Tower', verb: 'Look', act: () => talk('Skyline Tower', ['Thirty floors of glass. The lifts have a waiting list.', 'A screen in the lobby: "Today\'s town hall: AI at work — what changes, what doesn\'t."']) });
}

// a fuel station on the corner before ABZ: a canopy, two pump islands, a price board and a kiosk
function puneFuel(cx, cz) {
  const x = cx + 70, z = cz + 1, teal = pOnce('fuelTeal', () => new THREE.MeshStandardMaterial({ color: 0x2a8a8a, roughness: .5 }));
  plane(14, 12, MAT.concrete, x, .021, z, 1.5);
  box(13, .7, 8.5, MAT.white, x, 4.6, z); box(13.1, .25, 8.6, teal, x, 4.6, z);
  for (const [dx, dz] of [[-4.5, -2.6], [4.5, -2.6], [-4.5, 2.6], [4.5, 2.6]]) { box(.4, 4.6, .4, MAT.white, x + dx, 0, z + dz); colCirc(x + dx, z + dz, .3); }
  for (const dx of [-2.2, 2.2]) {
    box(1, .25, 4.2, MAT.concrete, x + dx, 0, z);
    for (const dz of [-1.1, 1.1]) { box(.6, 1.5, .5, teal, x + dx, .25, z + dz); box(.4, .3, .04, MAT.screen, x + dx, 1.25, z + dz + .26, { cast: false }); }
    colBox(x + dx - .55, z - 2.15, x + dx + .55, z + 2.15);
  }
  box(5, 3, 3, MAT.plaster, x, 0, z - 5.5); box(4, 2.2, .06, MAT.glassLit, x, .3, z - 3.97, { cast: false }); colBox(x - 2.5, z - 7, x + 2.5, z - 4);
  box(.3, 3.4, .3, MAT.metal, x + 6.2, 0, z + 5.2); colCirc(x + 6.2, z + 5.2, .25);
  ledSign(['FUEL', 'PETROL 106.3', 'DIESEL 92.8'], '#ffd27a', x + 6.2, 4.1, z + 5.2, 1.6, 1.4, 0, [128, 112]);
  pointLight('pune', 0xfff2dc, 1.3, 11, x, 4.2, z);
  INTER.push({ x, z: z + 3.4, r: 1.8, label: 'Fuel station', verb: 'Look', act: () => talk('Fuel station', ['"Petrol or diesel?"', 'The attendant keeps a tally of electric scooters that never stop here. It\'s getting long.']) });
}

// the glass office on stilts on the south side, with a granite wall and a gate
function puneCampus(cx, cz, M) {
  const [x0, z0, x1, z1] = PUNE_CAMPUS.map((v, i) => v + (i % 2 ? cz : cx)), W = x1 - x0, D = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, lift = 6, H = 12;
  plane(W + 2, D + 1, MAT.paver, mx, .018, mz - .5, 3);
  for (let x = x0 + 2.5; x <= x1 - 2; x += 6.5) for (let z = z0 + 2; z <= z1 - 2; z += 6) { box(.5, lift, .5, MAT.white, x, 0, z); colCirc(x, z, .35); }
  box(7, lift, 6, MAT.glassLit, mx, 0, mz, { cast: false }); colBox(mx - 3.5, mz - 3, mx + 3.5, mz + 3);
  box(W + 3, .6, D + 2, MAT.white, mx, lift, mz);
  faceBox(W + 3, H, D + 2, [MAT.glass, MAT.glass, MAT.roofFlat, MAT.glass, MAT.glass, MAT.glass], mx, lift + .6, mz);
  for (let k = 1; k < 4; k++) box(W + 3.2, .25, D + 2.2, MAT.white, mx, lift + .6 + k * H / 4, mz);
  pointLight('pune', 0xfff0d8, 1.2, 14, mx, lift - 1, mz);
  graniteWall(M, x0 - 3, x1 + 1.5, cz + PUNE_MZ + 9.3, [mx], -1, M.tabebuia);
  for (const [x, z] of [[x0 + 3, z0 - .5], [x1 - 3, z0 - .5]]) { treeGrate(x, z); tree(x, z, 1.1, M.tabebuia); }
  INTER.push({ x: mx, z: mz + 4, r: 2, label: 'Tech Park', verb: 'Look', act: () => talk('Tech Park', ['A glass office floating on white columns. The shade underneath is the best spot on the street at 2 pm.', 'Through the glass: rows of people in meetings about meetings.']) });
}

function puneViaduct(cx, cz) {
  const z = cz + PUNE_MZ, x0 = cx - 58, x1 = cx + 8, len = x1 - x0;
  // (no pillars: the deck runs clear over the road in front of Crescent Bay)
  box(len, 1.2, 8, MAT.concrete, (x0 + x1) / 2, 8, z); for (const s of [-1, 1]) box(len, 1, .3, MAT.concrete, (x0 + x1) / 2, 9.2, z + s * 3.85);
  box(len, .2, .2, MAT.metal, (x0 + x1) / 2, 9.4, z, { cast: false });
}

// the south side: a continuous row of taller blocks with shops, broken by the side streets, the campus and the khau galli
function puneSouthRow(cx, cz) {
  const gaps = [[PUNE_RX - 5, PUNE_RX + 5], [PUNE_RX2 - 5, PUNE_RX2 + 5], [PUNE_CAMPUS[0] - 4, PUNE_CAMPUS[2] + 3], [PUNE_GALLI[0], PUNE_GALLI[2]]];
  let x = -58;
  while (x < 148) {
    const w = rr(9, 14), mid = x + w / 2, gap = gaps.find(([a, b]) => mid + w / 2 > a && mid - w / 2 < b);
    if (gap) { x = gap[1] + .2; continue; }
    puneBlock(cx + mid, cz + PUNE_MZ + 9, w - .3, rr(10, 13), rr(14, 28));
    x += w;
  }
  for (let x2 = -50; x2 < 145; x2 += rr(12, 16)) if (!(x2 > PUNE_SQUARE[0] - 6 && x2 < PUNE_SQUARE[2] + 4) && !(x2 > PUNE_CAMPUS[0] - 6 && x2 < PUNE_CAMPUS[2] + 6) && Math.abs(x2 - PUNE_RX2) > 9) puneBlock(cx + x2, cz + PUNE_MZ + 34, rr(10, 14), 10, rr(26, 40), { shops: false });
  for (const [a, b] of [[PUNE_GALLI[0] - 7, PUNE_GALLI[0]], [PUNE_GALLI[2], PUNE_GALLI[2] + 7]]) puneBlock(cx + (a + b) / 2, cz + PUNE_GALLI[1] + 13, b - a, 11, rr(9, 13), { shops: false });
}

function puneNorthBlocks(cx, cz) {
  for (const [x, z, w, d, h, o] of [[-38, -6, 10, 14, 16, { side: MAT.cladding }], [-14, -22, 14, 8, 14, { floors: 4, fins: 2.5 }], [4, -24, 12, 7, 18, { floors: 5 }], [42, -26, 14, 8, 24, { floors: 7, fins: 3 }], [74, -24, 12, 8, 20, {}], [114, -10, 14, 12, 22, { fins: 2.5 }], [134, -10, 12, 12, 16, { side: MAT.cladding }], [114, -32, 16, 10, 30, { floors: 8 }], [138, -30, 14, 10, 26, {}]])
    officeBlock(cx + x, cz + z, w, d, h, { ...o, front: rnd() < .5 ? MAT.glass : MAT.glassLit });
}

// ---------------------------------------------------------------- the rest of the city, out to the fog
const PUNE_BACK_STREETS = [['x', -46, -160, 260], ['x', 74, -160, 260], ['z', -80, -140, 190], ['z', 180, -140, 190]];

// a cheap distant building: glass office, banded apartment block, or a tower with a crown
function puneFiller(x, z, w, d, h, M) {
  const kind = rnd();
  if (kind < .4) {
    faceBox(w, h, d, [MAT.glass, MAT.glass, MAT.roofFlat, MAT.glass, MAT.glass, MAT.glass], x, 0, z);
    for (let y = 4; y < h - 1; y += 4) box(w + .2, .3, d + .2, MAT.concrete, x, y, z, { cast: false });
  } else if (kind < .85) {
    box(w, h, d, vTint(TX.plaster, 1, PUNE_WALLS[rnd() * PUNE_WALLS.length | 0]), x, 0, z);
    for (let y = 3; y < h - 1; y += 3) { box(w + .5, .14, d + .5, MAT.concrete, x, y, z, { cast: false }); box(w + .04, 1, d + .04, rnd() < .3 ? MAT.glassLit : MAT.glass, x, y + .8, z, { cast: false, s: 2 }); }
    const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1, 10), MAT.charcoal)); t.position.set(x + w / 4, h + .5, z);
  } else {
    faceBox(w * .8, h * 1.3, d * .8, [MAT.glass, MAT.glass, MAT.roofFlat, MAT.glass, MAT.glass, MAT.glass], x, 0, z);
    box(w * .5, 3, d * .5, MAT.white, x, h * 1.3, z); box(.2, 4, .2, MAT.metal, x, h * 1.3 + 3, z);
  }
}

function puneCityFill(cx, cz, M) {
  for (const [axis, at, a, b] of PUNE_BACK_STREETS) {
    if (axis === 'x') { plane(b - a, 10, M.concrete, cx + (a + b) / 2, .019, cz + at, 4); for (const s of [-4.1, 4.1]) plane(b - a, 1.8, M.brick, cx + (a + b) / 2, .022, cz + at + s, 3); }
    else { plane(10, b - a, M.concrete, cx + at, .019, cz + (a + b) / 2, 4); for (const s of [-4.1, 4.1]) plane(1.8, b - a, M.brick, cx + at + s, .022, cz + (a + b) / 2, 3); }
  }
  const streets = PUNE_BACK_STREETS.map(([axis, at]) => (axis === 'x' ? [-1e9, at - 6, 1e9, at + 6] : [at - 6, -1e9, at + 6, 1e9]))
    .concat([PUNE_RX, PUNE_RX2].map((sx) => [sx - 6, -1e9, sx + 6, 1e9]), [[-1e9, PUNE_MZ - 9, 1e9, PUNE_MZ + 9]]);
  const hits = (r, x0, z0, x1, z1) => r[0] < x1 && r[2] > x0 && r[1] < z1 && r[3] > z0;
  const taken = (x0, z0, x1, z1) => WALK.some((w) => w[0] < cx + 400 && hits(w, x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5))
    || COL.some((c) => (c.r !== undefined ? c.x > x0 - c.r - 1 && c.x < x1 + c.r + 1 && c.z > z0 - c.r - 1 && c.z < z1 + c.r + 1 : c.x0 !== undefined && hits([c.x0, c.z0, c.x1, c.z1], x0 - 1, z0 - 1, x1 + 1, z1 + 1)))
    || streets.some((s) => hits([cx + s[0], cz + s[1], cx + s[2], cz + s[3]], x0, z0, x1, z1));
  for (let gx = -160; gx < 260; gx += 17) for (let gz = -150; gz < 200; gz += 17) {
    const w = rr(10, 14), d = rr(10, 14), x = cx + gx + rr(0, 15 - w), z = cz + gz + rr(0, 15 - d);
    if (taken(x - w / 2, z - d / 2, x + w / 2, z + d / 2)) continue;
    const far = Math.hypot(gx - 45, gz - 20), h = rr(12, 30) + Math.min(24, far / 8);
    puneFiller(x, z, w, d, h, M);
  }
}

// ---------------------------------------------------------------- the khau galli and the peepal tree square, opposite ABZ
function puneGalli(cx, cz) {
  const [gx0, gz0, gx1, gz1] = PUNE_GALLI, [sx0, sz0, sx1, sz1] = PUNE_SQUARE, gm = (gx0 + gx1) / 2, sm = (sx0 + sx1) / 2;
  plane(gx1 - gx0, gz1 - gz0, MAT.flag, cx + gm, .02, cz + (gz0 + gz1) / 2, 2.5);
  plane(sx1 - sx0, sz1 - sz0, MAT.flag, cx + sm, .02, cz + (sz0 + sz1) / 2, 2.5);
  PUNE_FOOD.forEach(([name, colour, lines], i) => {
    const west = i % 2 === 0, z = gz0 + 4 + Math.floor(i / 2) * 5.2;
    vStall(cx + (west ? gx0 + 1.1 : gx1 - 1.1), cz + z, west ? Math.PI / 2 : -Math.PI / 2, name, colour, lines);
  });
  const bulbs = [];
  for (let z = gz0 + 2; z < gz1 - 1; z += 4) for (let k = 0; k <= 10; k++) { const t = k / 10; bulbs.push([cx + gx0 + .8 + t * (gx1 - gx0 - 1.6), 3.4 - Math.sin(t * Math.PI) * .45, cz + z + t * 2]); }
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc070, emissiveIntensity: 2.6 }), bulbs.length);
  const d = new THREE.Object3D(); bulbs.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); }); scene.add(bm);
  pointLight('pune', 0xffc878, 1.4, 12, cx + gm, 3, cz + gz0 + 10);
  const tx = cx + sm, tz = cz + (sz0 + sz1) / 2;
  const ring = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, .5, 24), MAT.stone)); ring.position.set(tx, .25, tz);
  plane(4.6, 4.6, MAT.dirt, tx, .51, tz, 1);
  tree(tx, tz, 2.3, MAT.leafB, false); colCirc(tx, tz, 2.7);
  for (const [dx, dz, r] of [[-8, -4, 0], [8, -4, 0], [-8, 4, Math.PI], [8, 4, Math.PI]]) bench(tx + dx, tz + dz, r);
  for (const [dx, dz] of [[-10.5, -5], [10.5, -5], [-10.5, 5], [10.5, 5]]) pot(tx + dx, tz + dz, 1.1);
  INTER.push({ x: tx, z: tz + 3.4, r: 1.8, label: 'Peepal katta', verb: 'Sit', act: () => talk('Peepal katta', ['The old peepal tree. Half the neighbourhood\'s gossip happens on this ring of stone.', 'Someone is explaining large language models to a very patient uncle.']) });
}

function puneABZ(cx, cz) {
  const [ax, az] = PUNE_ABZ, tf = finTower(cx + ax, cz + az);
  plane(30, 11.5, cbStone(), cx + ax, .018, cz + az + 5.6, 2);   // the forecourt in Crescent Bay's sandy stone tiles, not the lobby's pastel pavers
  for (const x of [-12, -6.6, 6.6, 12]) palm(cx + ax + x, tf + 3, rr(3.2, 3.8));
  ledSign(['ABZ'], '#9fd8ff', cx + ax, 2.15, tf + .45, 2.4, .5);
  portal(cx + ax, tf + 1.6, 0x9fd8ff, 'pune', 'abz', 'ABZ Office');
}

// Crescent Bay car park, laid out like a real one: a 5 m two-way aisle down the middle that runs on south as a driveway over the footpath, through a dropped
// kerb (PUNE_PARK_GAP, cut in puneGround) onto the main road; five 2.8 m car bays along the west side, cars nose-in to the aisle; a two-wheeler row on the east
function puneParking(cx, cz, asphalt) {
  const lot = cx - 14.6, ax = cx + PUNE_PARK_AISLE, W = MAT.white;
  plane(12.8, 15, asphalt, lot, .02, cz - 1.5, 1.5);
  plane(5, 4.2, asphalt, ax, .03, cz + 8, 1.5);   // the driveway over the footpath to the road
  // car bays: lines across the west strip (x 279.2-284.2), a stop line at the head of each
  const BAYS = [-7.2, -4.4, -1.6, 1.2, 4];
  for (let k = 0; k <= BAYS.length; k++) box(5, .015, .1, W, cx - 18.3, .022, cz - 8.6 + k * 2.8, { cast: false });
  box(.1, .015, 14, W, ax - 2.5, .022, cz - 1.6, { cast: false });
  // the aisle: a dashed centre line, then IN / OUT arrows and a give-way line at the road
  for (let z = -8; z < 9; z += 2) box(.1, .015, 1, W, ax, .022, cz + z, { cast: false });
  // a painted arrow along z, pointing dir (+1 south to the road, -1 north into the lot): a flat decal, drawn once
  const ARROW = pOnce('parkArrow', () => new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (g) => { g.fillStyle = '#eeeae2'; g.beginPath(); g.moveTo(32, 4); g.lineTo(60, 44); g.lineTo(42, 44); g.lineTo(42, 124); g.lineTo(22, 124); g.lineTo(22, 44); g.lineTo(4, 44); g.closePath(); g.fill(); }, { smooth: true }), transparent: true, depthWrite: false }));
  const arrow = (x, z, dir) => { const m = plane(.7, 1.6, ARROW, x, .024, z); m.rotation.z = dir > 0 ? Math.PI : 0; };
  arrow(ax - 1.25, cz + 4.5, -1); arrow(ax + 1.25, cz + 4.5, 1);   // in on the left lane, out on the right (Indian roads drive on the left)
  for (let x = -2.3; x <= 2.3; x += .7) box(.4, .015, .14, W, ax + x, .032, cz + 9.6, { cast: false });
  // the parked cars, nose-in to the aisle
  const CARS = [['bmw', 'BMW M3 GTR', ['The BMW M3 GTR in its racing livery.', 'It looks like it would rather be on a highway than in a car park.']], ['jesko', 'Koenigsegg Jesko', ['A Koenigsegg Jesko in orange, all carbon wing and gold wheels.', 'Somebody at Crescent Bay is doing very well.']],
    ['m4', 'BMW M4', ['A widebody BMW M4 in deep teal.']], ['creta', 'Hyundai Creta', ['A white Creta. Parked politely, for once.']], ['scorpio', 'Mahindra Scorpio-N', ['A red Scorpio-N, big enough to park two Omnis in.']]];
  CARS.forEach(([kind, name, lines], i) => { sportsCar(kind, cx - 18.3, cz + BAYS[i], Math.PI / 2); INTER.push({ x: ax - 1.4, z: cz + BAYS[i], r: 1.3, label: name, verb: 'Look', act: () => talk(name, lines) }); });
  // two-wheelers along the east strip (x 289.2-291.8), angled to the aisle
  const BIKES = [['r15', 'Yamaha R15M', 'A Yamaha R15M in metallic grey, with blue wheels and gold forks.'], ['vstrom', 'Suzuki V-Strom', 'A yellow Suzuki V-Strom SX, ready for a long ride.'],
    ['avenger', 'Bajaj Avenger', 'A Bajaj Avenger 180 cruiser, all chrome and low seat.'], ['thruxton', 'Royal Enfield Thruxton', 'A red and black café racer with wire wheels and clip-on bars.'],
    ['gsxr', 'Suzuki GSX-R 750', 'A 2010 Suzuki GSX-R 750. Somebody here likes their mornings fast.']];
  box(.1, .015, 11, W, ax + 2.5, .022, cz - 2.5, { cast: false });
  for (let k = 0; k <= BIKES.length; k++) box(2.4, .015, .08, W, cx - 9.6, .022, cz - 8 + k * 2, { cast: false });   // inside the lot's east edge
  BIKES.forEach(([kind, name, line], i) => { const z = cz - 7 + i * 2; if (kind === 'avenger' || kind === 'gsxr') bikeModel(kind, cx - 9.6, z, -Math.PI / 2, { lean: .08 }); else bike(cx - 9.6, z, -Math.PI / 2, kind);   // rear wheel to the kerb, front to the aisle   // the modelled ones where we have them
    INTER.push({ x: ax + 1.6, z, r: 1, label: name, verb: 'Look', act: () => talk(name, [line]) }); });
  // floodlights: two tall poles over the bays, lit day and night (the building's shadow falls across the lot all afternoon), outside the daylight's lamp dimming
  for (const [x, z] of [[cx - 21.4, cz - 5.5], [cx - 21.4, cz + 1.8]]) {   // behind the cars, outside the lot, the lamp arms reaching over them
    streetProp('lamp', x, 0, z, Math.PI / 2).scale.setScalar(1.25); colCirc(x, z, .25);
    const l = new THREE.PointLight(0xfff1dc, 2.4, 14, 1.4); l.position.set(x + 1.1, 4.4, z); scene.add(l);
    const fill = new THREE.SpotLight(0xfff6ea, 1.6, 18, .9, .6, 1); fill.position.set(x + 6, 7, z); fill.target.position.set(x + 3, 0, z); scene.add(fill, fill.target);
  }
  // the name board is a gantry over the entrance, where the driveway meets the footpath, high enough to drive under; at the back of the lot a small P sign
  ledSign(['Crescent Bay Parking'], '#9fd0ff', ax, 3.4, cz + 8.6, 5.4, .55, 0, [480, 52], PLAIN);
  for (const s2 of [-2.9, 2.9]) { box(.14, 3.7, .14, MAT.metal, ax + s2, 0, cz + 8.6); colCirc(ax + s2, cz + 8.6, .15); }
  { // a proper parking sign (the old LED "P" read as a floating key): a blue plate with a white P and a white border, on a grey pole
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1f5fbf'; g.fillRect(8, 8, 112, 112);
    g.fillStyle = '#ffffff'; g.font = '700 96px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 70);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
    box(.1, 2.3, .1, MAT.metal, lot, 0, cz - 8.95);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.7, .7, .04), [MAT.metal, MAT.metal, MAT.metal, MAT.metal, new THREE.MeshStandardMaterial({ map: t, roughness: .6 }), MAT.metal]);
    plate.position.set(lot, 2.0, cz - 8.88); plate.castShadow = true; scene.add(plate);
  }
  // a low kerb round the lot (cut only for the driveway) and bollards along the footpath side: where the parking ends and the walkway begins
  const KERB = pOnce('parkKerb', () => new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: .8 })), x0 = lot - 6.4, x1 = lot + 6.4, z0 = cz - 9, z1 = cz + 6;
  box(.18, .14, z1 - z0, KERB, x0, 0, (z0 + z1) / 2); box(.18, .14, z1 - z0, KERB, x1, 0, (z0 + z1) / 2); box(x1 - x0, .14, .18, KERB, lot, 0, z0);
  for (const [a, b] of [[x0, ax - 2.5], [ax + 2.5, x1]]) { box(b - a, .14, .18, KERB, (a + b) / 2, 0, z1); for (let x = a + .6; x < b - .3; x += 1.6) post(.09, .7, MAT.metal, x, 0, z1 + .3, .08); }
  for (const z of [cz + 6, cz + 10]) for (const s2 of [-1, 1]) box(.18, .14, .01, KERB, ax + s2 * 2.5, 0, z);
  for (const s2 of [-1, 1]) box(.18, .14, 4, KERB, ax + s2 * 2.5, 0, cz + 8);   // the driveway's own kerbs out to the road
}

// ---------------------------------------------------------------- street furniture, parked autos, traffic
function puneStreet(cx, cz) {
  const nz = cz + PUNE_MZ - 7.3, sz = cz + PUNE_MZ + 7.3, nearStreet = (x) => Math.abs(x - PUNE_RX) < 6 || Math.abs(x - PUNE_RX2) < 6;
  for (let x = -52; x < 146; x += 14) {
    if (!nearStreet(x) && Object.values(PUNE_TAXI_STANDS).every(([sx]) => Math.abs(x - sx) > 3)) streetLight(cx + x, nz - .9, 0, 1);
    if (!nearStreet(x + 7) && Math.abs(x + 7 - (PUNE_GALLI[0] + PUNE_GALLI[2]) / 2) > 6) streetLight(cx + x + 7, sz + .9, 0, -1);
  }
  busStop(cx + 112, nz - .6);
  const parked = (x, z, ry, c) => { const a = autoRickshaw(c); a.position.set(x, 0, z); a.rotation.y = ry; colBox(x - 1.5, z - .75, x + 1.5, z + .75); };
  for (const x of [26, 29.3, 44, 47.3]) parked(cx + x, cz + PUNE_MZ - 5.35, Math.PI / 2, rnd() < .85 ? PAL.gold : PAL.sage);
  for (const x of [-36, -32.7, -20, -16.7, 70, 73.3, 92]) parked(cx + x, cz + PUNE_MZ + 5.35, -Math.PI / 2, rnd() < .85 ? PAL.gold : PAL.sage);
  bins(cx + 104, nz - .9); bins(cx - 6, sz + 1);
  for (const [x, z] of [[cx + 106.4, nz - .9], [cx - 3.6, sz + 1]]) { streetProp('hydrant', x, 0, z, 0); colCirc(x, z, .25); }   // a fire hydrant by each pair of bins
  const M = cz + PUNE_MZ, J1 = cx + PUNE_RX, J2 = cx + PUNE_RX2, [x0, x1] = PUNE_LANE_X, L = PUNE_LANES;
  trafficLights(J1, M, 4.6, 6.7); trafficLights(J2, M, 4.6, 6.7);
  const eastStops = [J1 - 6.8, J2 - 6.8], westStops = [J1 + 6.8, J2 + 6.8];
  // the cars in traffic take turns from one fixed rotation, so every model shows up as often as the others (two each), spread out instead of bunched
  const ROTA = ['creta', 'm4', 'scorpio', 'eeco', 'omni', 'bmw', 'jesko', 'cybertruck'];
  let rota = 0; const nextCar = () => ROTA[rota++ % ROTA.length];
  lane('x', cz + L.eastOuter, 1, cx + x0, cx + x1, eastStops, 'ew', [[cx - 30, nextCar()], [cx + 40, 'auto', PAL.gold], [cx + 100, nextCar()], [cx + 10, 'scooter', 0xe8e6e0], [cx + 72, nextCar()], [cx + 130, 'evel']]);
  lane('x', cz + L.eastInner, 1, cx + x0, cx + x1, eastStops, 'ew', [[cx - 10, nextCar()], [cx + 70, nextCar()], [cx + 125, 'auto', PAL.sage], [cx + 30, 'scooter', PAL.coral], [cx + 100, nextCar()], [cx - 40, 'evel']]);
  lane('x', cz + L.westInner, -1, cx + x1, cx + x0, westStops, 'ew', [[cx + 120, nextCar()], [cx + 20, 'auto', PAL.gold], [cx + 80, nextCar()], [cx + 50, 'scooter', 0x1c1c20], [cx - 20, nextCar()], [cx + 60, 'evel']]);
  lane('x', cz + L.westOuter, -1, cx + x1, cx + x0, westStops, 'ew', [[cx + 95, 'auto', PAL.sage], [cx - 20, nextCar()], [cx + 50, nextCar()], [cx + 130, nextCar()], [cx + 15, 'scooter', 0x3f8a4a], [cx + 160, 'evel']]);   // Evel Knievel, riding the main road
  for (const [J, cars] of [[J1, [[cz - 40, nextCar()], [cz + 40, 'auto', PAL.gold]]], [J2, [[cz - 20, 'auto', PAL.gold], [cz + 55, nextCar()]]]]) {
    lane('z', J - 1.5, 1, cz - 70, cz + 80, M - 6.8, 'ns', cars);
    lane('z', J + 1.5, -1, cz + 80, cz - 70, M + 6.8, 'ns', cars.map(([s, k, c]) => [s + 30, ROTA.includes(k) ? nextCar() : k, c ^ 0x202020]));   // the other way: its own cars from the rotation
  }
  life.push((t, dt) => stepTraffic(t, dt));
}

// ---------------------------------------------------------------- street life: trees, carts, parked two-wheelers, poles and wires, billboards
const PUNE_CARTS = [[106.8, 8.4, 'Vada Pav Cart', 0xc98a3a, ['Hot vada pav, ₹20. The bus-stop special.', 'The chutney recipe is a family secret. Not even the model knows it.']], [26, 23.6, 'Fruit Cart', PAL.leaf, ['Mangoes, bananas, chikoo.', 'Priced per dozen, haggled per piece.']], [86, 23.6, 'Coconut Water', 0x5f8a3a, ['One tender coconut, cut fresh.', 'Nature\'s electrolyte. No prompt needed.']], [-36, 23.6, 'Flower Stall', PAL.rose, ['Mogra and marigold garlands.', 'They smell better than any generated description of them.']]];
const PUNE_BILLBOARDS = [[-27, 8.2, ['LEARN AI', 'one token at a time']], [124, 8.2, ['CHAI BREAK?', 'Amruttulya, 2 min ->']]];

function puneTreeRows(cx, cz, M) {   // the street trees stand mid-footpath (3 m wide, kerb at 6.1 m from the road's centre line), so their 1.3 m surrounds stay off the kerb
  const keep = (x, avoid) => avoid.every(([a, r]) => Math.abs(x - a) > r);
  const lights = (base) => Array.from({ length: 16 }, (_, k) => [base + k * 14, 1.6]);
  const north = [[PUNE_RX, 7], [PUNE_RX2, 7], [5, 3.5], [80, 3.5], [112, 3], ...PUNE_CARTS.map(([x]) => [x, 2.5]), ...lights(-52), ...PUNE_BILLBOARDS.map(([x]) => [x, 4])];   // no tree in front of a billboard
  const south = [[PUNE_RX, 7], [PUNE_RX2, 7], [108, 6], [45.5, 6], ...PUNE_CARTS.map(([x]) => [x, 2.5]), ...lights(-45)];
  for (let x = -20; x < 136; x += 9) if (keep(x, north)) { treeGrate(cx + x, cz + PUNE_MZ - 7.5, 1.3); tree(cx + x, cz + PUNE_MZ - 7.5, rr(.85, 1.1), [MAT.leafA, MAT.leafC, M.tabebuia][rnd() * 3 | 0], false); colCirc(cx + x, cz + PUNE_MZ - 7.5, .35); }
  for (let x = -54; x < 140; x += 9) if (keep(x, south)) { treeGrate(cx + x, cz + PUNE_MZ + 7.5, 1.3); tree(cx + x, cz + PUNE_MZ + 7.5, rr(.85, 1.1), [MAT.leafA, MAT.leafB, M.tabebuia][rnd() * 3 | 0], false); colCirc(cx + x, cz + PUNE_MZ + 7.5, .35); }
}

function puneCart(cx, cz, [x, z, name, colour, lines]) {
  const px = cx + x, pz = cz + z, umb = new THREE.MeshStandardMaterial({ color: colour, roughness: .8, side: THREE.DoubleSide });
  box(1.6, .8, .8, MAT.wood, px, .35, pz); box(1.7, .06, .9, MAT.wood, px, 1.15, pz);
  for (const s of [-1, 1]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .08, 12), MAT.charcoal)); w.rotation.x = Math.PI / 2; w.position.set(px + s * .5, .32, pz + s * .45); }
  box(.05, 2.2, .05, MAT.metal, px + .6, 1.15, pz);
  const u = add(new THREE.Mesh(new THREE.ConeGeometry(1.1, .5, 8, 1, true), umb)); u.position.set(px + .6, 3.4, pz);
  for (let k = 0; k < 6; k++) { const b = add(new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: [PAL.gold, 0xe8476a, 0x9ad36a, 0xf2a03a][k % 4] }))); b.position.set(px - .55 + k * .22, 1.27, pz + (k % 2 ? .15 : -.15)); }
  signBoard(name, px, 1.55, pz + .46, 1.5, .32, 0, { size: 16, bg: '#2a1a12', color: '#ffe3a0', w: 180, h: 36 });
  colBox(px - .9, pz - .5, px + .9, pz + .5);
  INTER.push({ x: px, z: pz + (z < PUNE_MZ ? 1 : -1), r: 1.8, label: name, verb: 'Buy', act: () => talk(name, lines) });
}

function puneParkedTwoWheelers(cx, cz) {
  const colours = [0x1c1c20, 0xe8e6e0, PAL.coral, PAL.periwinkle, 0x8a8a90];
  for (let k = 0; k < 8; k++) { const s = scooter(colours[(k * 3) % 5]); s.position.set(cx + 41.5 + k * 1.1, 0, cz + PUNE_MZ + 7.9); s.rotation.y = Math.PI * .9; }
  colBox(cx + 40.9, cz + PUNE_MZ + 7.2, cx + 49.8, cz + PUNE_MZ + 8.6);
  for (let k = 0; k < 6; k++) { const s = scooter(colours[(k * 2 + 1) % 5]); s.position.set(cx + 88 + k * 1.1, 0, cz + PUNE_MZ - 7.9); s.rotation.y = Math.PI * .1; }
  colBox(cx + 87.4, cz + PUNE_MZ - 8.6, cx + 94.6, cz + PUNE_MZ - 7.2);
}

function punePolesAndWires(cx, cz) {
  const z = cz + PUNE_MZ + 8.6, xs = [];
  for (let x = -50; x < 140; x += 18) if (Math.abs(x - PUNE_RX) > 6 && Math.abs(x - PUNE_RX2) > 6 && Math.abs(x - 108) > 6) xs.push(cx + x);
  for (const x of xs) { box(.2, 8, .2, MAT.concrete, x, 0, z); box(1.4, .12, .12, MAT.metal, x, 7.4, z); colCirc(x, z, .15); }
  const pts = [];
  for (let i = 1; i < xs.length; i++) for (const dz of [-.6, 0, .6]) for (let k = 0; k < 8; k++) {
    const t0 = k / 8, t1 = (k + 1) / 8, sag = (t) => -Math.sin(t * Math.PI) * .9;
    pts.push(xs[i - 1] + (xs[i] - xs[i - 1]) * t0, 7.5 + sag(t0), z + dz, xs[i - 1] + (xs[i] - xs[i - 1]) * t1, 7.5 + sag(t1), z + dz);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1c1c20 })));
}

function puneBillboards(cx, cz) {
  for (const [x, z, lines] of PUNE_BILLBOARDS) {
    for (const s of [-1.6, 1.6]) box(.2, 2.6, .2, MAT.metal, cx + x + s, 0, cz + z);
    box(4.6, 2.4, .2, MAT.metal, cx + x, 2.5, cz + z - .05);
    ledSign(lines, '#ffe9a8', cx + x, 3.7, cz + z + .07, 4.3, 2.1, 0, [256, 120], PLAIN);
    colBox(cx + x - 1.8, cz + z - .2, cx + x + 1.8, cz + z + .2);
  }
}

// ---------------------------------------------------------------- the bike taxi, a road user like any other
// is there a car within `back` metres behind or `front` metres ahead of x in any of the given main-road lanes?
function laneTraffic(lanes, x, back, front, dir) {
  return traffic.lanes.some((L) => L.axis === 'x' && lanes.includes(L) && L.cars.some((c) => { const rel = (c.s - x) * (dir || L.d); return rel > -back && rel < front; }));
}

// the rider is Prakrit on his Yamaha, a character sprite (SHAPE.prakrit in characters.js). RECKLESS: he speeds and weaves through the traffic
const RECKLESS = true;
function bikeTaxi(cx, cz) {
  const g = new THREE.Object3D(), drv = makeChar('Prakrit', 0, 0, { look: 'prakrit', zone: 'pune' }), stands = {}, names = { cb: 'Crescent Bay', abz: 'ABZ' };
  for (const [k, [x, z]] of Object.entries(PUNE_TAXI_STANDS)) {
    stands[k] = [cx + x, cz + z];
    box(.12, 2.2, .12, MAT.metal, cx + x - 1.4, 0, cz + z - .4); colCirc(cx + x - 1.4, cz + z - .4, .15);
    ledSign(['BIKE TAXI'], '#ffd27a', cx + x - 1.4, 2.5, cz + z - .4, 1.8, .4);
    box(3, .015, 1.2, new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: .9 }), cx + x, .03, cz + PUNE_TAXI_BAY, { cast: false });
  }
  let drvP = null;   // the bike with you behind Prakrit: the sheet for your pick, made on the first ride (there is no hero yet while the world is being built)
  const S = { at: 'cb', mode: 'idle', path: null, s: 0, v: 0, dest: null, model: g };
  // g is the bike's path-follower; a sprite takes its spot and heading. Empty (fetching you, or parked): one of the 8 still poses, or the leaned-in riding frame on the straight.
  // With you aboard: drvP, the bike with you seated behind Prakrit (profile only: upright when still, leaning in as it pulls away), and you are hidden; its zone is not the world's, so it has no second name tag.
  const face = (moving) => {
    const ry = g.rotation.y, side = Math.sin(ry), riding = S.mode === 'ride';
    if (riding && !drvP) { drvP = makeChar('Prakrit', 0, 0, { look: 'prakrit_ride_' + CharSelect.getChoice(), zone: 'pune-ride' }); drvP.noLift = true; }
    const d = riding ? drvP : drv;
    drv.g.visible = !riding; if (drvP) drvP.g.visible = riding; if (hero) hero.g.visible = !riding;   // (no hero yet while the world is being built)
    d.x = g.position.x; d.y = g.position.z; d.moving = moving;
    if (riding) { const anim = moving ? 'ride' : 'idle'; if (d.anim !== anim) d.t = 0; d.anim = anim; d.dir = side >= 0 ? 'right' : 'left'; }   // the lean-in restarts each time it pulls away
    else if (moving && Math.abs(side) > .9) { d.anim = 'ride'; d.dir = side > 0 ? 'right' : 'left'; }
    else { d.anim = 'idle'; d.dir = String(Math.round((((ry * 180 / Math.PI) % 360) + 360) % 360 / 45) % 8 * 45); }
  };
  const park = (k) => { const [x] = stands[k]; g.position.set(x, 0, cz + PUNE_TAXI_BAY); g.rotation.y = k === 'cb' ? Math.PI / 2 : -Math.PI / 2; face(false); };
  park('cb');
  traffic.blockers.push(() => (S.mode === 'idle' ? null : { x: g.position.x, z: g.position.z }));

  // out into the lane for your direction (eastbound on the north side, westbound across on the south side), along, back in
  const route = (from, to) => {
    const [fx] = stands[from], [tx] = stands[to], dir = Math.sign(tx - fx), laneZ = cz + (dir > 0 ? PUNE_LANES.eastOuter : PUNE_LANES.westOuter);
    const bay = cz + PUNE_TAXI_BAY, pts = [[fx, bay], [fx + dir * 4, laneZ], [tx - dir * 4, laneZ], [tx, bay]];
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push({ a: pts[i - 1], b: pts[i], L, s0: total }); total += L; }
    const own = traffic.lanes.find((L) => L.axis === 'x' && Math.abs(L.fixed - laneZ) < .01);
    const crossed = traffic.lanes.filter((L) => L.axis === 'x' && (dir > 0 ? L.fixed <= laneZ + .01 : L.fixed >= cz + PUNE_LANES.eastOuter - .01) && Math.abs(L.fixed - laneZ) < 8);
    return { segs, total, dir, laneZ, own, crossed };
  };
  const at = (path, s) => {
    const i = path.segs.findIndex((q) => s <= q.s0 + q.L), seg = path.segs[i < 0 ? path.segs.length - 1 : i], k = Math.min(1, (s - seg.s0) / seg.L);
    return { x: seg.a[0] + (seg.b[0] - seg.a[0]) * k, z: seg.a[1] + (seg.b[1] - seg.a[1]) * k, ry: Math.atan2(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]), seg: i < 0 ? path.segs.length - 1 : i };
  };
  const go = (from, to, rider) => { S.mode = rider ? 'ride' : 'fetch'; S.path = route(from, to); S.s = 0; S.v = 0; S.dest = to; };

  const book = (here) => {
    if (S.mode !== 'idle') { talk('Bike taxi', ['Prakrit is on the way. Watch the road!']); return; }
    const other = here === 'cb' ? 'abz' : 'cb';
    if (S.at !== here) { go(S.at, here, false); talk('Bike taxi', [`Ride booked to ${names[other]}. Prakrit is coming from ${names[S.at]}.`, 'Wait by the yellow box, then press E again to hop on.']); return; }
    TF.lockPlayer(true); go(here, other, true); face(false); TF.ambience?.horn();
  };
  for (const k of Object.keys(stands)) {
    const other = k === 'cb' ? 'abz' : 'cb';
    INTER.push({ x: stands[k][0], z: stands[k][1], r: 1.8, label: 'Bike taxi', get verb() { return S.mode === 'idle' && S.at === k ? `Ride to ${names[other]}` : 'Book'; }, act: () => book(k) });
  }

  // how fast the bike may go right now: the car ahead, the red light, and a clear gap before pulling out or cutting back in
  const allowed = (t, p) => {
    const P = S.path, x = g.position.x, d = P.dir;
    // Prakrit rides flat out: well over the limit, no braking for the car ahead or the lights (he weaves past instead, see the lane swerve below)
    let cap = S.mode === 'ride' ? 22 : 26;
    cap = Math.min(cap, Math.max(1.2, Math.sqrt(2 * 10 * (P.total - S.s))));
    if (p.seg === 0 && S.s < .5 && laneTraffic(P.crossed, P.segs[0].b[0], 14, 6, null)) return 0;
    if (p.seg === 1 && !RECKLESS) {
      for (const c of P.own.cars) { const gap = (c.s - x) * d - c.len / 2 - .9; if (gap > -1 && gap < 30) cap = Math.min(cap, Math.max(0, gap - 2) * 1.2); }
      const st = lightState('ew', t), toStop = Math.min(...[].concat(P.own.stopAt).map((s) => (s - x) * d).filter((q) => q > 0), Infinity);
      if (st !== 'green' && toStop < 14) cap = Math.min(cap, Math.max(0, toStop - .3) * 1.1);
      const exitX = P.segs[2].a[0];
      if ((exitX - x) * d < 3 && laneTraffic(P.crossed.filter((L) => L !== P.own), exitX, 12, 5, null)) cap = Math.min(cap, Math.max(0, (exitX - x) * d - .2) * 1.5);
    }
    return cap;
  };

  life.push((t, dt) => {
    if (drvP && S.mode === 'ride') drvP.t += dt * 1000;   // nothing else steps this sprite's clock
    if (S.mode === 'idle') { TF.ambience?.engine(0, 0); return; }
    const here = at(S.path, S.s), cap = allowed(t, here);
    S.v = cap < S.v ? Math.max(cap, S.v - 14 * dt) : Math.min(cap, S.v + (RECKLESS ? 11 : 3.5) * dt);
    S.s = Math.min(S.path.total, S.s + S.v * dt);
    const p = at(S.path, S.s);
    // the swerve: on the straight, a car close ahead in his lane sends him into the next lane over (the inner one), and back out past it
    let wantLat = 0;
    if (RECKLESS && p.seg === 1) {
      const P = S.path, d = P.dir, other = P.laneZ === cz + PUNE_LANES.eastOuter ? cz + PUNE_LANES.eastInner : cz + PUNE_LANES.westInner, off = other - P.laneZ;
      const close = (L) => L && L.cars.some((c) => { const gap = (c.s - p.x) * d; return gap > -3 && gap < 16; });
      const ownL = P.own, innerL = traffic.lanes.find((L) => L.axis === 'x' && Math.abs(L.fixed - other) < .01);
      S.weave = close(ownL) && !close(innerL) ? 1 : close(innerL) && !close(ownL) ? 0 : (S.weave ?? 0);
      wantLat = S.weave * off;
    }
    S.lat = (S.lat || 0) + (wantLat - (S.lat || 0)) * Math.min(1, dt * 6);
    g.position.set(p.x, 0, p.z + S.lat); g.rotation.y += Math.atan2(Math.sin(p.ry - g.rotation.y), Math.cos(p.ry - g.rotation.y)) * Math.min(1, dt * 8);
    face(S.v > .3);
    TF.ambience?.engine(S.v, zone !== 'pune' ? 0 : S.mode === 'ride' ? 1 : Math.max(0, 1 - Math.hypot(p.x - hero.x, p.z - hero.y) / 45));   // heard in Pune, fading with distance when it is only fetching you
    if (S.mode === 'ride') { hero.x = p.x; hero.y = p.z + S.lat; hero.dir = Math.sin(g.rotation.y) >= 0 ? 'right' : 'left'; }
    if (S.s < S.path.total) return;
    const riding = S.mode === 'ride';
    S.mode = 'idle'; S.at = S.dest; park(S.at); TF.ambience?.engine(0, 0);
    if (!riding && zone === 'pune') TF.ambience?.horn();   // here: beep-beep
    if (riding) {
      const [x, z] = stands[S.at]; hero.x = x; hero.y = z - .6; hero.dir = 'down'; TF.lockPlayer(false);
      log('', `Bike taxi: dropped at ${names[S.at]}. ₹${S.at === 'abz' ? 32 : 30}, paid by UPI. Rate Prakrit: ★★★★★`, true);
    }
  });
  return S;
}

// ---------------------------------------------------------------- Pune
// the sandy stone tiles (stone_pavement_tiles.glb via tools/roads-pack.py): the Crescent Bay forecourt and the ground all round it, ~25 cm each,
// laid with a 2 m step (the texture holds 8 x 3 of them)
const cbStone = () => pOnce('cbStone', () => { const t = new THREE.TextureLoader().load(window.ROAD_TEX.stone); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 8 / 3); t.anisotropy = 8; return std(t, 0, { roughness: .9 }); });
function buildPune(a) {
  const { cx, cz } = a;
  areaShell(a, MAT.paver, cbStone(), false, false, [7, 3.5]);   // the ground round Crescent Bay: the forecourt's stone tiles, not grey concrete
  withSideRandom(() => {
    const M = puneMaterials(), asphalt = std(TX.concrete, 1.5, { roughness: .8 }); asphalt.color.setRGB(.36, .37, .41);
    puneGround(cx, cz, M);
    // the Crescent Bay forecourt (and only this): the sandy stone tiles, ~25 cm each (the texture holds 8 x 3 of them, laid every 2 m)
    // it stops where the footpath starts (z +7: the pavers run 7 to 10 m south), with a pale stone edging band between the two, so the office front reads apart from the street
    // and it stops at the side street's footpath (x +9.7): it used to run on over the footpath and the street itself
    plane(30.7, 16, cbStone(), cx - 5.65, .016, cz - 1, 2);
    box(.32, .045, 16, MAT.concrete, cx + 9.54, 0, cz - 1, { cast: false });   // its edge against the side street's footpath
    WALK.push([cx - 24, cz - 14, cx + 130, cz + PUNE_MZ - 6], [cx - 55, cz + PUNE_MZ - 6, cx + 145, cz + PUNE_MZ + 9]);
    WALK.push([cx + PUNE_GALLI[0], cz + PUNE_GALLI[1] - 1, cx + PUNE_GALLI[2], cz + PUNE_GALLI[3] + 1], [cx + PUNE_SQUARE[0], cz + PUNE_SQUARE[1], cx + PUNE_SQUARE[2], cz + PUNE_SQUARE[3]]);
    WALK.push([cx + PUNE_CAMPUS[0] - 2, cz + PUNE_MZ + 9, cx + PUNE_CAMPUS[2] + 2, cz + PUNE_CAMPUS[3] + .5]);
    for (const sx of [PUNE_RX, PUNE_RX2]) WALK.push([cx + sx - 5, cz - 34, cx + sx + 5, cz - 14]);
    WALK.push([cx + PUNE_RX2 - 5, cz + PUNE_MZ + 9, cx + PUNE_RX2 + 5, cz + 50]);
    const cf = calfusHQ(cx, cz - 5.6);
    portal(cx - 2.5, cf + 1.7, 0x5cd6ff, 'pune', 'lab', 'Crescent Bay');
    pointLight('pune', 0xffe0b0, 1.6, 12, cx + 4, 3, cz + 2);
    puneParking(cx, cz, asphalt);
    puneABZ(cx, cz);
    puneTowers(cx, cz, M);
    puneFuel(cx, cz);
    puneCampus(cx, cz, M);
    puneGalli(cx, cz);
    puneSouthRow(cx, cz);
    puneNorthBlocks(cx, cz);
    puneStreet(cx, cz);
    PUNE_CARTS.forEach((c) => puneCart(cx, cz, c));
    puneParkedTwoWheelers(cx, cz);
    punePolesAndWires(cx, cz);
    puneBillboards(cx, cz);
    puneTreeRows(cx, cz, M);
    PUNE_TAXI = bikeTaxi(cx, cz);
    puneCityFill(cx, cz, M);
    for (const [x, z] of [[9.6, -3.5], [-6, 5.5], [20, -8], [108, 2], [79, -12], [-22, 7], [54, -8]]) { treeGrate(cx + x, cz + z, 2); tree(cx + x, cz + z, rr(1, 1.3), [MAT.leafA, MAT.leafC, M.tabebuia][rnd() * 3 | 0]); }
  });
  NPC_BOUNDS.pune = [cx - 20, cz - 10, cx + 120, cz + 8];
  TF.zoneEnv.pune = { near: 60, far: 190 };
}

let PUNE_TAXI = null;
