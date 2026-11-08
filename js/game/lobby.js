// TokenFall: the lobby, a waterfront campus. A canal runs across the middle with two footbridges: the HQ, the Token Brew
// cafe and Home on the north bank, the promenade, the arrival plaza, the Token monument, food stalls, a small stage and
// the boulevard to the Glass Bridge on the south bank. The three gates stay put: every zone returns you beside them.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= lobby layout =================
const NORTH_BANK = [-17.4, -12.4, 17.4, -7.9];
const CANAL = [-50, -7.9, 50, -3.6];
const PROMENADE = [-17.4, -3.6, 17.4, 2.5];
const ARRIVAL = [-7, 2.5, 7, 8];
const FOOD = [8, 3.6, 17.2, 12];
const STAGE = [-16.8, 10.2, -13.2, 15.4];
const FOUNTAIN = [0, -.9];
const WEST_BED = [-9.5, 5.4];
const BRIDGES_X = [-7, 7];
const SEED_AFTER_LOBBY = 1643086149;
const STALLS = [
  [5.2, 'Chai Tapri', 0xb8543c, ['Cutting chai, extra strong. ☕', 'The chaiwala swears his recipe is "fine-tuned". On 40 years of customers.']],
  [7.8, 'Vada Pav Corner', 0xc98a3a, ['Two vada pav, extra chutney!', 'Fun fact: a model\'s "context window" is like this plate. Only so much fits.']],
  [10.4, 'Dosa Point', 0x4a7a5e, ['One masala dosa, crispy.', 'The menu is 40 tokens long. The queue is longer.']],
];

function inRect(r, x, z, m = 0) { return x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m; }
function onPath(x, z, m = 0) { return (Math.abs(z) < 2.1 + m && Math.abs(x) > 17 && Math.abs(x) < 50) || (x > -2.2 - m && x < 2.2 + m && z > 8 && z < 19); }
function paved(x, z, m = 0) {
  return [NORTH_BANK, CANAL, PROMENADE, ARRIVAL, FOOD].some(r => inRect(r, x, z, m)) || inRect(STAGE, x, z, m + 2.5) || onPath(x, z, m) || Math.hypot(x - FOUNTAIN[0], z - FOUNTAIN[1]) < 2.9 + m;
}

// the canal: stone coping on both banks (open where the bridges land), water, koi, colliders, and the two footbridges
function canal() {
  const [, z0, , z1] = CANAL, zc = (z0 + z1) / 2, w = z1 - z0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(100, w), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(0, .06, zc); scene.add(water);
  const gaps = BRIDGES_X.map(x => [x - 1.25, x + 1.25]).sort((a, b) => a[0] - b[0]);
  const spans = []; let t = -50;
  for (const [g0, g1] of gaps) { spans.push([t, g0]); t = g1; }
  spans.push([t, 50]);
  for (const [a, b] of spans) {
    for (const z of [z0, z1]) box(b - a, .35, .4, MAT.stone, (a + b) / 2, 0, z);
    if (Math.max(a, -17.4) < Math.min(b, 17.4)) colBox(Math.max(a, -17.4), z0 - .2, Math.min(b, 17.4), z1 + .2);
  }
  for (const bx of BRIDGES_X) {
    box(2.5, .12, w + .9, MAT.wood, bx, 0, zc);
    for (let z = z0 - .3; z <= z1 + .3; z += .5) box(2.3, .02, .06, MAT.darkWood, bx, .12, z, { cast: false });
    for (const s2 of [-1, 1]) {
      box(.08, .95, w + .9, MAT.wood, bx + s2 * 1.2, .12, zc); box(.14, .1, w + 1, MAT.darkWood, bx + s2 * 1.2, 1.07, zc);
      for (const z of [z0 - .45, z1 + .45]) box(.18, 1.2, .18, MAT.darkWood, bx + s2 * 1.2, 0, z);
      colBox(bx + s2 * 1.2 - .1, z0 - .45, bx + s2 * 1.2 + .1, z1 + .45);
    }
  }
  const koiMat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0x803010, roughness: .6 });
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(.38, .04, .14), koiMat); scene.add(k); k.userData.dyn = true;
    const sp = (.6 + i * .15) * (i % 2 ? 1 : -1), ph = i * 7.3, lane = zc + (i % 3 - 1) * .9;
    anim.push(t => { const x = ((t * sp + ph) % 36 + 54) % 36 - 18; k.position.set(x, .08, lane + Math.sin(t * .8 + i) * .25); k.rotation.y = sp > 0 ? 0 : Math.PI; });
  }
  INTER.push({ x: -11, z: z1 + 1, r: 1.8, label: 'Canal', verb: 'Look', act: () => talk('Canal', ['The water is clear and calm. Koi drift under the bridges.', 'A koi blinks at you. It seems to know something about gradient descent.']) });
}

// the centrepiece: a two-tier fountain with arcing jets and the Calfus coin floating above it
function tokenFountain(fx, fz) {
  const basin = add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, .5, 36), MAT.stone)); basin.position.set(fx, .25, fz);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2, 36), waterMat); pool.rotation.x = -Math.PI / 2; pool.position.set(fx, .51, fz); scene.add(pool);
  const tier = add(new THREE.Mesh(new THREE.CylinderGeometry(.65, .85, 1, 20), MAT.stone)); tier.position.set(fx, .5, fz);
  const top = new THREE.Mesh(new THREE.CircleGeometry(.56, 20), waterMat); top.rotation.x = -Math.PI / 2; top.position.set(fx, 1.01, fz); scene.add(top);
  const JETS = 12, DROPS = 8, pos = new Float32Array(JETS * DROPS * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const jets = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcdeeff, size: .085, transparent: true, opacity: .85 })); jets.userData.dyn = true; jets.frustumCulled = false; scene.add(jets);
  anim.push(t => {
    for (let j = 0; j < JETS; j++) for (let k = 0; k < DROPS; k++) {
      const a = j / JETS * 6.283, u = (t * .9 + k / DROPS + j * .13) % 1, r = .6 + u * 1.25, i = (j * DROPS + k) * 3;
      pos[i] = fx + Math.cos(a) * r; pos[i + 1] = 1 + Math.sin(u * Math.PI) * .8 - u * .45; pos[i + 2] = fz + Math.sin(a) * r;
    }
    geo.attributes.position.needsUpdate = true;
  });
  const coinFace = std(TX.coin, 0, { emissive: 0xffffff, emissiveMap: TX.coin, emissiveIntensity: .35, roughness: .5, metalness: .3 });
  const coin = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .18, 32), [MAT.gold, coinFace, coinFace])); coin.rotation.x = Math.PI / 2;
  const coinG = new THREE.Group(); coinG.add(coin); scene.add(coinG); coinG.userData.dyn = true;
  anim.push(t => { coinG.position.set(fx, 2.8 + Math.sin(t * 1.4) * .15, fz); coinG.rotation.y = t * .7; });
  colCirc(fx, fz, 2.45);
  INTER.push({ x: fx, z: fz + 3, r: 1.5, label: 'The Token', verb: 'Inspect', act: () => talk('The Token', ['A giant golden token hovers over the fountain.', 'Models don\'t read words — they read tokens: small chunks of text.', '“TokenFall” might be 3 tokens. Or 2. It depends on the model!', 'Rumour: the glass bridge south of here only holds up the right answer.']) });
}

// a street-food stall facing west: counter, posts, canopy, a warm light under it, and a name board
function foodStall(sx, sz, name, colour, lines) {
  const wall = new THREE.MeshStandardMaterial({ color: colour, roughness: .85 });
  box(.9, 1, 2.1, MAT.wood, sx, 0, sz); box(1, .08, 2.2, MAT.wood, sx, 1, sz);
  box(.15, 2.7, 2.3, wall, sx + .95, 0, sz);
  for (const dz of [-1.08, 1.08]) box(.1, 2.6, .1, MAT.metal, sx - .48, 0, sz + dz);
  box(1.7, .1, 2.5, MAT.awning, sx + .1, 2.6, sz); box(.08, .06, 1.6, MAT.warmGlow, sx - .3, 2.54, sz, { cast: false });
  signBoard(name, sx - .7, 2.95, sz, 2.3, .42, Math.PI / 2, { size: 18, bg: '#2a1a12', edge: '#120a06', color: '#ffe3a0', w: 220, h: 40 });
  for (let i = 0; i < 3; i++) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .22, 10), MAT.metal)); p.position.set(sx + .1, 1.19, sz - .6 + i * .6); }
  colBox(sx - .5, sz - 1.15, sx + 1.05, sz + 1.15);
  INTER.push({ x: sx - 1.4, z: sz, r: 1.3, label: name, verb: 'Order', act: () => talk(name, lines) });
}

// a small amphitheatre: a stage against the west hedge facing east, three stepped rows of seats in front
function amphitheatre() {
  const [x0, z0, x1, z1] = STAGE, mz = (z0 + z1) / 2;
  box(x1 - x0, .45, z1 - z0, MAT.wood, (x0 + x1) / 2, 0, mz); box(.3, 3, z1 - z0 + .3, MAT.darkWood, x0 - .1, 0, mz);
  ledSign(['TokenFall Talks', 'Fridays · 5 pm'], '#ffe39a', x0 + .08, 2.2, mz, 3.2, .9, Math.PI / 2, [256, 72]);
  colBox(x0 - .3, z0, x1, z1);
  [[x1 + 1.6, .25], [x1 + 2.5, .5], [x1 + 3.4, .75]].forEach(([x, h]) => { box(.85, h, z1 - z0 - .4, MAT.stone, x, 0, mz); colBox(x - .43, z0 + .2, x + .43, z1 - .2); });
  pointLight('lobby', 0xffd08a, 1.2, 7, x1 - .5, 2.8, mz);
  INTER.push({ x: x1 + .7, z: z1 + .4, r: 1.6, label: 'Stage', verb: 'Read', act: () => talk('TokenFall Talks', ['This Friday: "Why does my chatbot sound so sure?" Confidence is not the same as being right.', 'Next week: open mic. Bring your best prompt.']) });
}

// campus skyline behind the north bank, in the same building styles as the Pune block
function campusSkyline() {
  for (const [x, z, w, h] of [[-36, -30, 12, 14], [-22, -36, 11, 22], [-6, -42, 13, 18], [10, -38, 12, 26], [26, -34, 11, 16], [40, -26, 10, 12]]) officeBlock(x, z, w, 9, h, { units: 2, collide: false, fins: rnd() < .5 ? 2.5 : 0, front: rnd() < .5 ? MAT.glassLit : MAT.glass });
  for (const [x, z, h] of [[-46, -14, 12], [-30, -48, 30], [24, -50, 34], [48, -8, 14]]) apartment(x, z, 10, 9, h);
}

function buildLobby() {
  plane(160, 160, MAT.grass, 0, 0, -10, 2);
  // paving: the north bank terrace, the promenade along the water, the arrival plaza, the food court, side paths, the boulevard
  for (const [r, m, s] of [[NORTH_BANK, MAT.paver, 3], [PROMENADE, MAT.paver, 3], [ARRIVAL, MAT.flag, 2.5], [FOOD, MAT.flag, 2.5]]) plane(r[2] - r[0], r[3] - r[1], m, (r[0] + r[2]) / 2, .012, (r[1] + r[3]) / 2, s);
  plane(36, 4.2, MAT.paver, -32, .011, 0, 3); plane(36, 4.2, MAT.paver, 32, .011, 0, 3);
  plane(4.4, 11, MAT.paver, 0, .011, 13.5, 3);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.85, 40), MAT.flag); ring.rotation.x = -Math.PI / 2; ring.position.set(FOUNTAIN[0], .014, FOUNTAIN[1]); ring.receiveShadow = true; scene.add(ring);
  WALK.push([-17.2, -12.4, 17.2, 18.4]);
  WALK.push([-19.4, -1.9, -17, 1.9]); WALK.push([17, -1.9, 19.4, 1.9]);

  // north bank: Home, HQ, the Token Brew cafe with its terrace tables, planters, hedges between them
  const hqFront = hq(0, -15.6);
  // placeholder until this building gets its own map (the office moved into the Calfus building in Pune)
  INTER.push({ x: 0, z: hqFront + 1.4, r: 1.8, label: 'HQ Office', verb: 'Read', act: () => talk('HQ Office', ['The doors are locked. A sign says: “Coming soon.”', 'Looking for the office? It\'s in the Calfus building, through the Pune gate.']) });
  const houseFront = modernHouse(-13.4, -15);
  INTER.push({ x: -14.9, z: houseFront + 1.9, r: 1.6, label: 'Home', verb: 'Knock', act: () => talk('Home', ['Nobody\'s home right now.', 'A note on the door: “Moving in soon — your own space in TokenFall!”']) });
  const cafeFront = cafe(13.4, -14.6);
  INTER.push({ x: 13.4, z: cafeFront + 1.2, r: 1.7, label: 'Token Brew', verb: 'Order', act: () => talk('Token Brew', ['One masala chai, coming up! ☕', 'Fun fact: this sentence is about 12 tokens long.']) });
  hedgeRow(-10.1, -13.2, -8.6, -12.6); hedgeRow(8.6, -13.2, 10.6, -12.6); hedgeRow(16.2, -13.2, 17.9, -12.6);
  umbrellaTable(10.3, -9.9, MAT.umbrellaA); umbrellaTable(13.4, -9.4, MAT.umbrellaB);
  for (const x of [-2.6, 2.6]) pot(x, -10.9, 1.1);   // small pots by the HQ door; the forecourt must stay open to both bridges
  for (const x of [-14.6, -11.6]) { box(1.8, .35, 1.1, MAT.concrete, x, 0, -9.3, { cast: false }); plane(1.6, .9, MAT.dirt, x, .36, -9.3, 1); colBox(x - .9, -9.85, x + .9, -8.75); }
  streetLamp(-4.6, -9.2, 'lobby'); streetLamp(4.6, -9.2, 'lobby', false);

  // the canal across the middle, with its two footbridges
  canal();

  // boundary hedges (open where the canal passes) and the three gates, which stay where every zone returns you
  hedgeRow(-18.2, -13.2, -17.4, -8.2); hedgeRow(-18.2, -3.3, -17.4, -2.3); hedgeRow(-18.2, 2.3, -17.4, 19);
  hedgeRow(17.4, -13.2, 18.2, -8.2); hedgeRow(17.4, -3.3, 18.2, -2.3); hedgeRow(17.4, 2.3, 18.2, 19);
  gate(-17.8, 0, Math.PI / 2, 'Data Archive', 0xffb347, 'lobby', 'archive');
  gate(17.8, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');
  gate(0, 17.6, 0, 'The Glass Bridge', 0xffd27a, 'lobby', 'bridge'); sparkles(0, 17.6, 0xffd27a, 34, 1.3, 3.6);
  ledSign(['▼ The Glass Bridge'], '#ffe39a', 0, 5.4, 17.6, 3.8, .55);
  for (const [sx, txt, col] of [[-14.6, '◀ Data Archive', '#ffcf7a'], [14.6, 'Pune ▶', '#9dff9f']]) {
    ledSign([txt], col, sx, 1.75, 2.9, 2.6, .5);
    box(.1, 1.5, .1, MAT.metal, sx - 1.1, 0, 2.84); box(.1, 1.5, .1, MAT.metal, sx + 1.1, 0, 2.84); colBox(sx - 1.3, 2.65, sx + 1.3, 3.05);
  }

  // promenade: warm lamps along the water, benches looking out over it
  for (const x of [-12, -4, 4, 12]) streetLamp(x, -3.1, 'lobby', x === -4 || x === 12);
  for (const x of [-15, -9.4, 9.4, 15]) bench(x, 2.1, Math.PI);

  // arrival plaza: the directory and notice board flank the spot where you arrive, the Token monument to the west
  box(1.7, .2, .5, MAT.concrete, -4.2, 0, .4); box(.16, 2.4, .16, MAT.metal, -4.9, .2, .4); box(.16, 2.4, .16, MAT.metal, -3.5, .2, .4);
  ledSign(['▲ HQ · Token Brew · Home', '◀ Data Archive', 'Pune ▶', 'Glass Bridge ▼'], '#d6ecff', -4.2, 1.75, .5, 1.6, 1.5, 0, [200, 192]);
  colBox(-5.1, .15, -3.3, .65);
  INTER.push({ x: -4.2, z: 1.4, r: 1.4, label: 'Directory', verb: 'Read', act: () => talk('Directory', ['Welcome to TokenFall!', 'Across the bridges: the HQ office, the Token Brew cafe and Home. West: the Data Archive. East: Pune, home of the Calfus office. South: the Glass Bridge.', 'Walk into a glowing portal to travel.']) });
  box(.1, 2, .1, MAT.metal, 3.2, 0, .4); box(.1, 2, .1, MAT.metal, 5.2, 0, .4);
  const paper = std(canvasTex(32, 20, (g) => { g.fillStyle = '#b48a5a'; g.fillRect(0, 0, 32, 20); for (const [x, y, w, h, c] of [[2, 2, 9, 11, '#efe4c8'], [13, 3, 8, 7, '#f6d98a'], [23, 2, 7, 10, '#efe4c8'], [13, 11, 9, 7, '#cfe6f0']]) { g.fillStyle = c; g.fillRect(x, y, w, h); g.fillStyle = '#8a7a60'; for (let yy = y + 2; yy < y + h - 1; yy += 2) g.fillRect(x + 1, yy, w - 2, 1); g.fillStyle = '#c0392b'; g.fillRect(x + (w >> 1), y, 1, 1); } }, { nearest: true }), 0);
  const pb = add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, .08), [MAT.metal, MAT.metal, MAT.metal, MAT.metal, paper, MAT.metal])); pb.position.set(4.2, 1.3, .44);
  colBox(3, .15, 5.4, .65);
  INTER.push({ x: 4.2, z: 1.4, r: 1.4, label: 'Notice Board', verb: 'Read', act: () => talk('Notice Board', ['📌 Week 1 — What even is a token?', '📌 Prompt Lab opens soon: learn to talk to models clearly.', '📌 New: the Glass Bridge, south of the plaza. Pick the right tile. Or don\'t.', '📌 Lost: one rubber duck. Answers to “Debug”.']) });
  tokenFountain(FOUNTAIN[0], FOUNTAIN[1]);
  // where the Token used to stand: a round flower bed
  const bed = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, .35, 28), MAT.concrete)); bed.position.set(WEST_BED[0], .175, WEST_BED[1]);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), MAT.dirt); soil.rotation.x = -Math.PI / 2; soil.position.set(WEST_BED[0], .36, WEST_BED[1]); soil.receiveShadow = true; scene.add(soil);
  colCirc(WEST_BED[0], WEST_BED[1], 1.7);
  for (const x of [-5.4, 5.4]) pot(x, 7.4, .9);

  // south-east: three food stalls along the hedge and their tables; south-west: the small stage
  for (const [z, name, colour, lines] of STALLS) foodStall(15.6, z, name, colour, lines);
  umbrellaTable(10.4, 6, MAT.umbrellaB); umbrellaTable(11.4, 9.8, MAT.umbrellaA);
  streetLamp(9, 11.8, 'lobby');
  amphitheatre();

  // the boulevard south: trees either side, lamps at its ends, gardens beyond
  for (const z of [10, 14]) for (const s2 of [-1, 1]) tree(s2 * 3.6, z, .9, [MAT.leafA, MAT.leafC][(z / 4 + s2 + 2) % 2 | 0]);
  for (const s2 of [-1, 1]) streetLamp(s2 * 3, 17.4, 'lobby', s2 > 0);
  tree(-7.6, 16.4, 1.1, MAT.leafB); tree(7.2, 15.8, 1, MAT.blossom); tree(13.4, 16.6, 1.1, MAT.leafC); tree(-10.6, 9.8, .9, MAT.blossom);
  for (const [x, z] of [[-6.4, 12.2], [6.4, 13.4], [11.6, 14.6]]) { box(2.4, .35, 1.4, MAT.concrete, x, 0, z, { cast: false }); plane(2.2, 1.2, MAT.dirt, x, .36, z, 1); colBox(x - 1.2, z - .7, x + 1.2, z + .7); }
  bush(-15.8, 7.4, .9, MAT.leafC); bush(5.6, 9.6, .8, MAT.leafA);
  bench(-6.4, 14.1, Math.PI); bench(8.8, 15.2, Math.PI);

  // the campus beyond the hedges: skyline, trees, a row of low rooftops in front of the camera
  campusSkyline();
  for (let i = 0; i < 70; i++) {
    const x = rr(-55, 55), z = rr(-30, 34);
    if ((x > -20 && x < 20 && z > -19 && z < 26) || (Math.abs(z) < 3.6 && Math.abs(x) < 50) || (z > -9.5 && z < -2)) continue;
    tree(x, z, rr(.9, 1.5), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false);
  }
  for (let i = 0; i < 4; i++) {
    const rx = -18 + i * 12 + rr(-1, 1), rz = 31 + rr(-.5, .5);
    officeBlock(rx, rz, 9, 4, rr(3.2, 4.4), { floors: 1, units: 2, collide: false });
  }
  tree(-8, 27.5, 1.4, MAT.leafB, false); tree(12, 27.2, 1.3, MAT.leafA, false); tree(1, 28.5, 1.2, MAT.leafC, false);

  // grass tufts and flowers on the lawns, never on paving, water or in front of the north buildings
  const grassSpot = () => { const x = rr(-50, 50), z = rr(-30, 30); return paved(x, z, .4) || (x > -20 && x < 20 && z < -12.4) || (blocked(x, z, -.1) && walkable(x, z)) ? null : [x, z]; }
  scatter(TX.grassTuft, 3400, .55, grassSpot);
  const beds = [[-14.6, -9.3], [-11.6, -9.3], [-6.4, 12.2], [6.4, 13.4], [11.6, 14.6], WEST_BED, WEST_BED];
  TX.flowers.forEach(ft => scatter(ft, 140, .5, () => {
    if (rnd() < .65) { const [x, z] = beds[rnd() * beds.length | 0]; return [x + rr(-.8, .8), z + rr(-.45, .45), .37]; }
    return grassSpot();
  }));
  // everything built after the lobby continues from a fixed seed, so redesigning the lobby never reshuffles the other zones
  seed = SEED_AFTER_LOBBY;
}

const WATERFRONT = {
  build: buildLobby, spawn: [0, 2.6], spawnDir: 'down', npcBounds: null, returns: {},
  petals: [[-10, 1.2], [15.2, 16]], lightPoles: [[9.2, -9.9], [15.9, -9.9], [15.9, -3.6], [9.2, -3.6]],
};
