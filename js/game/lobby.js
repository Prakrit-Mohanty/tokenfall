// TokenFall: the lobby (main plaza).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= lobby layout =================
const PLAZA = [-15, -12, 15, 5.5];
const POOL = [5, 8.6, 13.4, 14.4];
function inPlaza(x, z, m = 0) { return x > PLAZA[0] - m && x < PLAZA[2] + m && z > PLAZA[1] - m && z < PLAZA[3] + m; }
function onPath(x, z, m = 0) { return (Math.abs(z) < 2.1 + m && Math.abs(x) > 14 && Math.abs(x) < 50) || (x > -2.2 - m && x < 2.2 + m && z > 4 && z < 19); }
function inPool(x, z, m = 0) { return x > POOL[0] - m && x < POOL[2] + m && z > POOL[1] - m && z < POOL[3] + m; }

function buildLobby() {
  plane(160, 160, MAT.grass, 0, 0, -10, 2);
  plane(PLAZA[2] - PLAZA[0], PLAZA[3] - PLAZA[1], MAT.paver, (PLAZA[0] + PLAZA[2]) / 2, .012, (PLAZA[1] + PLAZA[3]) / 2, 3);
  plane(36, 4.2, MAT.paver, -32, .011, 0, 3); plane(36, 4.2, MAT.paver, 32, .011, 0, 3);
  plane(4.4, 14, MAT.paver, 0, .011, 12, 3);
  // darker inlay ring around the fountain, and flower planters along the lawn edge
  const inlay = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 40), MAT.flag); inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, .014, -3); inlay.receiveShadow = true; scene.add(inlay);
  const inlay2 = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.7, 48), MAT.flag); inlay2.rotation.x = -Math.PI / 2; inlay2.position.set(0, .014, -3); inlay2.receiveShadow = true; scene.add(inlay2);
  for (const side of [-1, 1]) { box(9.6, .4, 1, MAT.concrete, side * 8, 0, 6.3); plane(9.3, .75, MAT.dirt, side * 8, .41, 6.3, 1); colBox(side * 8 - 4.8, 5.8, side * 8 + 4.8, 6.8); }
  // kerb along the lawn edge
  box(PLAZA[2] - PLAZA[0] + .3, .1, .3, MAT.concrete, 0, 0, PLAZA[3], { cast: false });
  WALK.push([-17.2, -11.4, 17.2, 18.4]);
  WALK.push([-19.4, -1.9, -17, 1.9]); WALK.push([17, -1.9, 19.4, 1.9]);

  // north side: modern house, HQ, cafe
  const hqFront = hq(0, -15.6);
  // placeholder until this building gets its own map (the office moved into the Calfus building in Pune)
  INTER.push({ x: 0, z: hqFront + 1.4, r: 1.8, label: 'HQ Office', verb: 'Read', act: () => talk('HQ Office', ['The doors are locked. A sign says: “Coming soon.”', 'Looking for the office? It\'s in the Calfus building, through the Pune gate.']) });
  const houseFront = modernHouse(-13.4, -15);
  INTER.push({ x: -14.9, z: houseFront + 1.9, r: 1.6, label: 'Home', verb: 'Knock', act: () => talk('Home', ['Nobody\'s home right now.', 'A note on the door: “Moving in soon — your own space in TokenFall!”']) });
  const cafeFront = cafe(13.4, -14.6);
  INTER.push({ x: 13.4, z: cafeFront + 1.2, r: 1.7, label: 'Token Brew', verb: 'Order', act: () => talk('Token Brew', ['One masala chai, coming up! ☕', 'Fun fact: this sentence is about 12 tokens long.']) });
  const umb = [MAT.umbrellaA, MAT.umbrellaB];
  umbrellaTable(10.6, -8, umb[0]); umbrellaTable(14, -6.8, umb[1]); umbrellaTable(10.9, -4.6, umb[1]);
  hedgeRow(-10.1, -13.2, -8.6, -12.6); hedgeRow(8.6, -13.2, 10.6, -12.6); hedgeRow(16.2, -13.2, 17.9, -12.6);

  // boundary hedges with openings for the side gates
  hedgeRow(-18.2, -13.2, -17.4, -2.3); hedgeRow(-18.2, 2.3, -17.4, 19);
  hedgeRow(17.4, -13.2, 18.2, -2.3); hedgeRow(17.4, 2.3, 18.2, 19);

  // side gates
  gate(-17.8, 0, Math.PI / 2, 'Data Archive', 0xffb347, 'lobby', 'archive');
  gate(17.8, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');
  gate(0, 17.6, 0, 'The Glass Bridge', 0xffd27a, 'lobby', 'bridge'); sparkles(0, 17.6, 0xffd27a, 34, 1.3, 3.6);
  ledSign(['▼ The Glass Bridge'], '#ffe39a', 0, 5.4, 17.6, 3.8, .55);
  for (const [sx, txt, col] of [[-14.6, '◀ Data Archive', '#ffcf7a'], [14.6, 'Pune ▶', '#9dff9f']]) {
    ledSign([txt], col, sx, 1.75, -2.6, 2.6, .5);
    box(.1, 1.5, .1, MAT.metal, sx - 1.1, 0, -2.66); box(.1, 1.5, .1, MAT.metal, sx + 1.1, 0, -2.66); colBox(sx - 1.3, -2.85, sx + 1.3, -2.45);
  }

  // centrepiece: a floating token over a round fountain
  const ped = add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, .5, 28), MAT.concrete)); ped.position.set(0, .25, -3);
  const fw = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), waterMat); fw.rotation.x = -Math.PI / 2; fw.position.set(0, .51, -3); scene.add(fw);
  const coinFace = std(TX.coin, 0, { emissive: 0xffffff, emissiveMap: TX.coin, emissiveIntensity: .35, roughness: .5, metalness: .3 });
  const coin = add(new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .16, 32), [MAT.gold, coinFace, coinFace]));
  coin.rotation.x = Math.PI / 2;
  const coinG = new THREE.Group(); coinG.add(coin); scene.add(coinG); coinG.userData.dyn = true;
  anim.push(t => { coinG.position.set(0, 2.2 + Math.sin(t * 1.4) * .15, -3); coinG.rotation.y = t * .7; });
  colCirc(0, -3, 1.95);
  INTER.push({ x: 0, z: -.6, r: 1.6, label: 'The Token', verb: 'Inspect', act: () => talk('The Token', ['A giant golden token hovers over the fountain.', 'Models don\'t read words — they read tokens: small chunks of text.', '“TokenFall” might be 3 tokens. Or 2. It depends on the model!', 'Rumour: the glass bridge south of here only holds up the right answer.']) });

  // directory totem
  box(1.7, .2, .5, MAT.concrete, -4.6, 0, -1.6); box(.16, 2.4, .16, MAT.metal, -5.3, .2, -1.6); box(.16, 2.4, .16, MAT.metal, -3.9, .2, -1.6);
  ledSign(['▲ HQ Office', '◀ Data Archive', 'Pune ▶', 'Glass Bridge ▼'], '#d6ecff', -4.6, 1.75, -1.5, 1.6, 1.5, 0, [200, 192]);
  colBox(-5.5, -1.85, -3.7, -1.35);
  INTER.push({ x: -4.6, z: -.6, r: 1.4, label: 'Directory', verb: 'Read', act: () => talk('Directory', ['Welcome to TokenFall!', 'North: the HQ office, through the front doors. West: the Data Archive. East: Pune, home of the Calfus office. South: the Glass Bridge.', 'Walk into a glowing portal to travel.']) });

  // notice board
  box(.1, 2, .1, MAT.metal, 3.6, 0, -1.6); box(.1, 2, .1, MAT.metal, 5.6, 0, -1.6);
  const paper = std(canvasTex(32, 20, (g) => { g.fillStyle = '#b48a5a'; g.fillRect(0, 0, 32, 20); for (const [x, y, w, h, c] of [[2, 2, 9, 11, '#efe4c8'], [13, 3, 8, 7, '#f6d98a'], [23, 2, 7, 10, '#efe4c8'], [13, 11, 9, 7, '#cfe6f0']]) { g.fillStyle = c; g.fillRect(x, y, w, h); g.fillStyle = '#8a7a60'; for (let yy = y + 2; yy < y + h - 1; yy += 2) g.fillRect(x + 1, yy, w - 2, 1); g.fillStyle = '#c0392b'; g.fillRect(x + (w >> 1), y, 1, 1); } }, { nearest: true }), 0);
  const pb = add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, .08), [MAT.metal, MAT.metal, MAT.metal, MAT.metal, paper, MAT.metal])); pb.position.set(4.6, 1.3, -1.56);
  colBox(3.4, -1.85, 5.8, -1.35);
  INTER.push({ x: 4.6, z: -.6, r: 1.4, label: 'Notice Board', verb: 'Read', act: () => talk('Notice Board', ['📌 Week 1 — What even is a token?', '📌 Prompt Lab opens soon: learn to talk to models clearly.', '📌 New: the Glass Bridge, south of the plaza. Pick the right tile. Or don\'t.', '📌 Lost: one rubber duck. Answers to “Debug”.']) });

  // plaza furniture
  streetLamp(-14.2, -9.8, 'lobby'); streetLamp(14.2, -2.8, 'lobby', false); streetLamp(-14.2, 4.6, 'lobby'); streetLamp(14.2, 4.6, 'lobby');
  planterTree(-10, -5.5, MAT.leafA, 1.1); planterTree(-10, 1.2, MAT.blossom, .95); planterTree(9.6, 1.2, MAT.leafC, 1);
  bench(-7.2, 3.6); bench(6.8, 3.6); bench(-12.6, -2.2, Math.PI / 2);
  for (const bx of [-2.8, 2.8]) for (const bz of [7, 10, 13, 16]) bollard(bx, bz);
  // bike rack
  for (let i = 0; i < 4; i++) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(.35, .04, 6, 12, Math.PI), MAT.metal)); r.position.set(-8.4 + i * .5, .05, -9.6); }
  colBox(-8.8, -9.8, -6.6, -9.4);

  // reflecting pool with a timber deck
  const [p0, q0, p1, q1] = POOL, pw = p1 - p0, pd = q1 - q0, pcx = (p0 + p1) / 2, pcz = (q0 + q1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(pcx, .2, pcz); scene.add(water);
  for (const [w, d, x, z] of [[pw + .7, .35, pcx, q0], [pw + .7, .35, pcx, q1], [.35, pd, p0, pcz], [.35, pd, p1, pcz]]) box(w, .32, d, MAT.concrete, x, 0, z);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 1 });
  for (const [px, pz, s] of [[6.4, 9.8, .45], [11.8, 13.2, .38], [7.4, 13.4, .3], [12.2, 9.6, .34], [9.8, 12.6, .28]]) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(s, 10, .4, 5.6), padMat); pad.rotation.x = -Math.PI / 2; pad.position.set(px, .215, pz); pad.receiveShadow = true; scene.add(pad);
  }
  const koiMat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0x803010, roughness: .6 });
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(.38, .04, .14), koiMat); scene.add(k); k.userData.dyn = true;
    const ph = i * 1.7, sp = .3 + i * .07, ax = 3 - i * .5, az = 1.8 - i * .3;
    anim.push(t => { const a = t * sp + ph; k.position.set(pcx + Math.cos(a) * ax, .205, pcz + Math.sin(a) * az); k.rotation.y = -a; });
  }
  box(1.8, .2, pd + .4, MAT.wood, p0 - 1.1, 0, pcz, { cast: false });
  colBox(p0 - .2, q0 - .2, p1 + .2, q1 + .2);
  INTER.push({ x: p0 - 1.1, z: pcz, r: 1.5, label: 'Pool', verb: 'Look', act: () => talk('Pool', ['The water is clear and calm.', 'A koi blinks at you. It seems to know something about gradient descent.']) });
  bench(15.6, 11.5, -Math.PI / 2);

  // park: lawn, trees, a flower bed
  tree(-12, 9, 1.2, MAT.leafB); tree(-6.5, 15.5, 1, MAT.leafA); tree(-14.8, 15.4, 1.1, MAT.leafC); tree(15.2, 16, 1, MAT.blossom); tree(5, 17, .9, MAT.leafC);
  bush(-4.6, 8, .9, MAT.leafA); bush(15.4, 6.9, .9); bush(-15.6, 6.4, 1, MAT.leafC);
  box(5, .35, 2.4, MAT.concrete, -9, 0, 12.2, { cast: false }); plane(4.7, 2.1, MAT.dirt, -9, .36, 12.2, 1); colBox(-11.5, 11, -6.5, 13.4);
  bench(-9, 14.4, Math.PI);

  // background: office towers beyond the campus
  for (const [x, z, w, h] of [[-30, -34, 12, 16], [-14, -40, 10, 22], [2, -38, 12, 14], [18, -36, 10, 19], [33, -32, 12, 12], [-40, -22, 8, 10], [42, -18, 9, 13], [-24, -26, 6, 8], [26, -25, 7, 9]]) {
    officeBlock(x, z, w, 8, h, { units: 2, collide: false, fins: rnd() < .5 ? 2.5 : 0 });
  }
  // trees outside the hedges
  for (let i = 0; i < 70; i++) {
    const x = rr(-55, 55), z = rr(-30, 34);
    if ((x > -20 && x < 20 && z > -19 && z < 26) || onPath(x, z, 1.5)) continue;
    tree(x, z, rr(.9, 1.5), [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0], false);
  }
  // a row of low rooftops in front of the camera; they get the tilt-shift blur
  for (let i = 0; i < 4; i++) {
    const rx = -18 + i * 12 + rr(-1, 1), rz = 31 + rr(-.5, .5);
    officeBlock(rx, rz, 9, 4, rr(3.2, 4.4), { floors: 1, units: 2, collide: false });
  }
  tree(-8, 27.5, 1.4, MAT.leafB, false); tree(12, 27.2, 1.3, MAT.leafA, false); tree(1, 28.5, 1.2, MAT.leafC, false);

  // grass tufts and flowers
  const grassSpot = () => { const x = rr(-50, 50), z = rr(-30, 30); return inPlaza(x, z, .4) || onPath(x, z, .3) || inPool(x, z, 1.4) || (x > -20 && x < 20 && z < -12.4) || (blocked(x, z, -.1) && walkable(x, z)) ? null : [x, z]; };
  scatter(TX.grassTuft, 3400, .55, grassSpot);
  TX.flowers.forEach(ft => scatter(ft, 140, .5, () => {
    const r = rnd();
    if (r < .4) return [rr(-11.3, -6.7), rr(11.2, 13.2), .36];
    if (r < .7) { const side = rnd() < .5 ? -1 : 1; return [side * rr(3.4, 12.6), rr(5.95, 6.65), .4]; }
    return grassSpot();
  }));
}
