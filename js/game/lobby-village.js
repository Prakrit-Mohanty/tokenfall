// TokenFall: the village lobby. A paved plaza with the coin fountain in a reflecting pool and four roads out: west past the
// food stalls to the airport, east past Token Brew to Pune, south past the pond to the Glass Bridge, north over the river
// to HQ. Modern homes ring the plaza; holo signs, info screens, an EV bay, the Prompt Lab pavilion and a few robots add the AI era.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const V_PLAZA = [-12, -10, 12, 10];
const V_ROADS = [[-2.6, -30.5, 2.6, -10], [-2.6, 10, 2.6, 46], [-46, -2.6, -12, 2.6], [12, -2.6, 46, 2.6]];
const V_RIVER = [-80, -37.5, 80, -30.5];
const V_POND = [25, 25, 8];
const V_MOW = [-43, 6, -35, 14];
const V_GAMES_LAWN = [-28.2, -9, -16.9, -2.6];
const V_GAME_SPOTS = { tower: [[-26, -6.5]], stall: [[-20.5, -4.6]] };
const V_HALF = 46;
const V_LED = 0x8fe8ff;
const V_LED_WARM = 0xffe2b0;
const V_LED_COOL = 0xe6f2ff;
const V_SPAWN = [0, 13];
const SEED_AFTER_LOBBY = 1643086149;
const V_STALLS = [
  ['Chai Tapri', 0xb8543c, ['Cutting chai, extra strong. ☕', 'The chaiwala swears his recipe is "fine-tuned". On 40 years of customers.']],
  ['Vada Pav Corner', 0xc98a3a, ['Two vada pav, extra chutney!', 'Fun fact: a model\'s "context window" is like this plate. Only so much fits.']],
  ['Dosa Point', 0x4a7a5e, ['One masala dosa, crispy.', 'The menu is 40 tokens long. The queue is longer.']],
];
const V_BOT_CYCLE = 54;
const V_BOT_DOCK = [38.9, -3.5];
const V_HOMES = [
  { x: -19, z: -12.5, w: 9, d: 7, wall: 0xf2efe8, style: 'flat', solar: true, label: ['Home', '#9dff9f'], labelRight: true, inter: ['Home', 'Knock', ['Nobody\'s home right now.', 'A note on the door: “Moving in soon — your own space in TokenFall!”']] },
  { x: -32, z: -13, w: 8, d: 7, wall: 0xe8e2d6, style: 'mono', storeys: 2, clad: true, flue: true },
  { x: -26, z: -25, w: 10, d: 8, wall: 0xefe6d8, style: 'gable', storeys: 2, led: true },
  { x: 20, z: -13, w: 10, d: 7, wall: 0xd9cfbf, style: 'flat', cafe: true, label: ['TOKEN BREW', '#ffd27a'], inter: ['Token Brew', 'Order', ['One masala chai, coming up! ☕', 'Fun fact: this sentence is about 12 tokens long.']] },
  { x: 33, z: -13, w: 8, d: 7, wall: 0xf2efe8, style: 'mono', solar: true },
  { x: 12.5, z: -24, w: 8, d: 7, ry: -Math.PI / 2, wall: 0xc8c2b8, style: 'flat', storeys: 2, clad: true },
  { x: 28, z: -25, w: 10, d: 8, wall: 0xe8e2d6, style: 'gable', flue: true },
  { x: -10.5, z: 21, w: 8, d: 7, ry: Math.PI / 2, wall: 0xefe6d8, style: 'mono', led: true },
  { x: -10.5, z: 33, w: 8, d: 7, ry: Math.PI / 2, wall: 0xf2efe8, style: 'flat', solar: true, clad: true },
  { x: -27, z: 21, w: 10, d: 8, wall: 0xd9cfbf, style: 'mono', storeys: 2, solar: true },
  { x: -33, z: 35, w: 9, d: 7, ry: Math.PI, wall: 0xe8e2d6, style: 'gable', flue: true },
  { x: 10.5, z: 15, w: 8, d: 7, ry: -Math.PI / 2, wall: 0xf2efe8, style: 'flat', led: true },
  { x: 27, z: 9.5, w: 9, d: 7, ry: Math.PI, wall: 0xefe6d8, style: 'mono', clad: true, solar: true },
  { x: 38, z: 12, w: 8, d: 7, ry: Math.PI, wall: 0xc8c2b8, style: 'gable' },
  { x: 39, z: 32, w: 9, d: 7, ry: -Math.PI / 2, wall: 0xf2efe8, style: 'flat', solar: true },
  { x: 10.5, z: 38, w: 8, d: 7, ry: -Math.PI / 2, wall: 0xd9cfbf, style: 'mono', clad: true, flue: true },
];
const V_EXTRA_PATHS = [[0, -42.2, 5, 9.4], [5.15, 26, 5.1, 1.8], [32.4, -6, 5.6, 3]];
const V_FENCES = [[-14, -4, -14, -9.5], [14.5, 4, 14.5, 7.5], [-14.5, 4, -14.5, 9], [-34, -4.2, -38, -4.2], [29.5, 4.2, 31, 4.2]];
const V_LAMPS = [[-11.4, -9.4, 1], [11.4, 9.4, 1], [-11.4, 9.4, 0], [11.4, -9.4, 0], [-3.6, -14, 0], [3.6, -17, 1], [-3.6, 16, 1], [3.6, 30, 0], [-16, -3.6, 1], [-30, 3.6, 0], [16, 3.6, 1], [30, -3.6, 0], [-3.6, -28.5, 0], [3.6, 35, 0]];
const V_HOLOS = [[0, -10.8, 0, '▲ HQ'], [-12.8, 0, Math.PI / 2, '◀ AIRPORT'], [12.8, 0, -Math.PI / 2, 'PUNE ▶'], [0, 10.8, Math.PI, '▼ GLASS BRIDGE']];
const V_AI_TIPS = ['AI tip: an AI can sound sure of itself and still be wrong. Check answers that matter.', 'AI tip: give it context. "Summarise this for a new joiner" beats "summarise this".', 'AI tip: never paste passwords or private customer data into a chatbot.'];

const vInRect = (r, x, z, m = 0) => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m;
const vOnRoad = (x, z) => vInRect(V_PLAZA, x, z) || V_ROADS.some((r) => vInRect(r, x, z));

// the home's door sits in its wood volume; walk straight out of it until a road, and pave that strip
function vDoor(c) {
  const ry = c.ry || 0, dx = c.w * .31, s = Math.sin(ry), cs = Math.cos(ry);
  return { x: c.x + cs * dx + s * (c.d / 2 - .6), z: c.z - s * dx + cs * (c.d / 2 - .6), dirX: Math.round(s), dirZ: Math.round(cs) };
}
function vDoorPath(c) {
  const d = vDoor(c);
  for (let t = .6; t < 9; t += .2) {
    if (!vOnRoad(d.x + d.dirX * t, d.z + d.dirZ * t)) continue;
    const cx = d.x + d.dirX * t / 2, cz = d.z + d.dirZ * t / 2;
    return d.dirX ? [cx, cz, t, 1.6] : [cx, cz, 1.6, t];
  }
  return null;
}
const V_PATHS = [...V_HOMES.map(vDoorPath).filter(Boolean), ...V_EXTRA_PATHS];
const vPaved = (x, z, m = 0) => vInRect(V_PLAZA, x, z, m) || V_ROADS.some((r) => vInRect(r, x, z, m)) || V_PATHS.some(([px, pz, w, d]) => vInRect([px - w / 2, pz - d / 2, px + w / 2, pz + d / 2], x, z, m));
const vWater = (x, z, m = 0) => vInRect(V_RIVER, x, z, m) || Math.hypot(x - V_POND[0], z - V_POND[1]) < V_POND[2] + m;
const vClear = (x, z, m) => !vPaved(x, z, m) && !vWater(x, z, m) && !vInRect(V_MOW, x, z, m) && !vInRect(V_GAMES_LAWN, x, z, m) && !(walkable(x, z) && blocked(x, z, m));

const vCache = {};
const vOnce = (key, make) => vCache[key] || (vCache[key] = make());
const vTint = (tex, s, color, side) => vOnce(tex.uuid + color + (side || ''), () => std(tex, s, { color, ...(side ? { side } : {}) }));
const vGlass = () => vOnce('glass', () => new THREE.MeshStandardMaterial({ color: 0xcfeef0, transparent: true, opacity: .26, roughness: .05, depthWrite: false }));
const vGlow = (color) => vOnce('glow' + color, () => glowStrip(color));
const vMetalRoof = () => vOnce('metalRoof', () => new THREE.MeshStandardMaterial({ color: 0x3e434c, roughness: .45, metalness: .35 }));
const vLitDouble = () => vOnce('litDouble', () => { const m = MAT.glassLit.clone(); m.side = THREE.DoubleSide; return m; });

// a box inside a rotated group: world colliders are added separately by the caller
const gbox = (g, w, h, d, m, x, y, z, o = {}) => box(w, h, d, m, x, y, z, { ...o, p: g });
function vFootprint(x, z, w, d, ry, pad = 0) {
  const turned = Math.abs(Math.sin(ry)) > .5, hw = (turned ? d : w) / 2 + pad, hd = (turned ? w : d) / 2 + pad;
  return [x - hw, z - hd, x + hw, z + hd];
}
function vGroup(x, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); return g; }
function vTri(g, m, a, b, c) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([a[2], a[1], b[2], b[1], c[2], c[1]], 2));
  geo.computeVertexNormals();
  return add(new THREE.Mesh(geo, m), g);
}

function vGable(g, w, d, wallH, rise, roofM, wallM) {
  const ov = .45, half = d / 2 + ov, ang = Math.atan2(rise, d / 2), slope = half / Math.cos(ang);
  for (const s of [-1, 1]) {
    const r = gbox(g, w + ov * 2, .2, slope, roofM, 0, 0, 0);
    r.position.set(0, wallH + rise - (half / 2) * Math.tan(ang) + .1, s * half / 2); r.rotation.x = s * ang;
  }
  for (const s of [-1, 1]) vTri(g, wallM, [s * w / 2, wallH, -d / 2], [s * w / 2, wallH, d / 2], [s * w / 2, wallH + rise, 0]);
  return { ang, half };
}

function vPane(g, x, y, z, w, h, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  gbox(p, w + .12, h + .12, .08, MAT.metal, 0, -.06, 0);
  gbox(p, w, h, .1, MAT.glassLit, 0, 0, .01, { cast: false });
}

function vRoof(g, c, H, mw, mx, sw, sx, sideH) {
  const { w, d, style, solar } = c;
  if (style === 'flat') {
    gbox(g, mw + .7, .24, d + .7, MAT.roofFlat, mx, H, 0);
    gbox(g, sw + .4, .2, d - .3, MAT.concrete, sx, .3 + sideH, -.3);
    if (solar) for (let i = 0; i < Math.floor(mw / 2); i++) { const p = gbox(g, 1.6, .06, 1.4, MAT.solar, 0, 0, 0); p.position.set(mx - mw / 2 + 1.2 + i * 2, H + .5, -.6); p.rotation.x = -.3; }
    else gbox(g, mw - .6, .3, d - 1, MAT.hedge, mx, H + .24, 0, { cast: false });
    return H + .24;
  }
  if (style === 'mono') {
    const rise = 1.5, ang = Math.atan2(rise, d), L = (d + 1) / Math.cos(ang);
    const r = gbox(g, w + .8, .22, L, vMetalRoof(), 0, 0, 0); r.position.set(0, H + rise / 2 + .1, 0); r.rotation.x = ang;
    gbox(g, w, rise, .2, vTint(TX.plaster, 1, c.wall), 0, H, -d / 2 + .1);
    const sideM = vTint(TX.plaster, 1, c.wall, THREE.DoubleSide);
    for (const s of [-1, 1]) vTri(g, sideM, [s * w / 2, H, d / 2], [s * w / 2, H, -d / 2], [s * w / 2, H + rise, -d / 2]);
    if (solar) for (let i = 0; i < Math.floor(w / 2.2); i++) { const p = gbox(g, 1.8, .06, 2.2, MAT.solar, 0, 0, 0); p.position.set(-w / 2 + 1.3 + i * 2.2, H + rise / 2 + .3, -.2); p.rotation.x = ang; }
    return H;
  }
  const rise = d * .62, { ang, half } = vGable(g, w, d, H, rise, vMetalRoof(), vTint(TX.plaster, 1, c.wall, THREE.DoubleSide));
  vTri(g, vLitDouble(), [w / 2 + .03, H + .2, -d / 2 + .6], [w / 2 + .03, H + .2, d / 2 - .6], [w / 2 + .03, H + rise - .5, 0]);
  if (solar) for (let i = 0; i < Math.floor(w / 2.2); i++) { const p = gbox(g, 1.8, .06, 1.6, MAT.solar, 0, 0, 0); p.position.set(-w / 2 + 1.3 + i * 2.2, H + rise * .45 + .2, half * .45); p.rotation.x = ang; }
  return H;
}

// a modern home: a rendered main volume with big glazing, a recessed wood or clad volume with the door, and one of three roofs
function vHome(c) {
  const { x, z, w, d, ry = 0, storeys = 1, wall, style, label, labelRight, led, flue, clad, cafe, inter } = c;
  const g = vGroup(x, z, ry), H = .3 + storeys * 3, wallM = vTint(TX.plaster, 1, wall), sideM = clad ? MAT.cladding : MAT.wood;
  const mw = w * .62, sw = w - mw, mx = -w / 2 + mw / 2, sx = w / 2 - sw / 2, sideH = style === 'flat' ? H - 1 : H - .3;
  gbox(g, w + .4, .3, d + .4, MAT.concrete, 0, 0, 0);
  gbox(g, mw, H - .3, d, wallM, mx, .3, 0);
  gbox(g, sw, sideH, d - .6, sideM, sx, .3, -.3);

  const glassW = cafe ? mw - .4 : mw * .7;
  gbox(g, glassW, 2.4, .1, MAT.glassLit, mx, .35, d / 2 + .03, { cast: false });
  for (const k of [-.5, 0, .5]) gbox(g, .08, 2.4, .14, MAT.metal, mx + k * glassW, .35, d / 2 + .04);
  gbox(g, glassW + .1, .1, .16, MAT.metal, mx, 2.75, d / 2 + .04);
  if (storeys > 1) vPane(g, mx, 4.6, d / 2 + .03, mw * .8, .9);
  for (const s of [-1, 1]) for (let f = 0; f < storeys; f++) vPane(g, s * (w / 2 + .03), 1.9 + f * 3, s > 0 ? -.3 : 0, 1.3, 1.3, s * Math.PI / 2);
  if (cafe) {
    gbox(g, glassW + .6, .08, 1.6, MAT.awning, mx, 2.95, d / 2 + .75);
    const menu = ledSign(['CHAI · COFFEE · SNACKS'], '#ffd27a', 0, 0, 0, glassW * .8, .42); g.add(menu); menu.position.set(mx, 3.35, d / 2 + .08);
  }

  const doorZ = d / 2 - .6;
  gbox(g, 1.1, 2.3, .12, MAT.darkWood, sx, .3, doorZ + .02); gbox(g, .05, .8, .06, MAT.warmGlow, sx + .38, 1.1, doorZ + .1, { cast: false });
  gbox(g, .14, .34, .1, MAT.warmGlow, sx - .8, 2, doorZ + .06, { cast: false });
  gbox(g, 1.6, .15, .7, MAT.concrete, sx, 0, doorZ + .35);
  if (!cafe) { gbox(g, 1.9, .45, .5, MAT.concrete, mx, 0, d / 2 + .5); gbox(g, 1.8, .4, .4, MAT.hedge, mx, .45, d / 2 + .5, { cast: false }); }

  const eave = vRoof(g, c, H, mw, mx, sw, sx, sideH);
  gbox(g, mw + .2, .05, .05, vGlow(led ? V_LED : V_LED_WARM), mx, eave - .14, d / 2 + .12, { cast: false });
  if (flue) { gbox(g, .2, 2.4, .2, MAT.metal, -w / 2 + 1, H - .2, -d / 4); g.updateMatrixWorld(true); vSmoke(g.localToWorld(new THREE.Vector3(-w / 2 + 1, H + 2.4, -d / 4))); }
  colBox(...vFootprint(x, z, w, d, ry, .25));

  const s = Math.sin(ry), cs = Math.cos(ry), door = vDoor(c);
  if (label) {
    const lx = labelRight ? w / 2 - .5 : -w / 2 + .9, lz = d / 2 + 1.6, wx = x + cs * lx + s * lz, wz = z - s * lx + cs * lz;
    ledSign([label[0]], label[1], wx, 1.7, wz, 2.6, .55, ry); box(.1, 1.45, .1, MAT.metal, wx, 0, wz); colCirc(wx, wz, .2);
  }
  if (inter) { const [name, verb, lines] = inter; INTER.push({ x: door.x + door.dirX * 1.4, z: door.z + door.dirZ * 1.4, r: 1.7, label: name, verb, act: () => talk(name, lines) }); }
}

// chimney and flue smoke: chunky puffs that rise and fade
const vSmokeSpots = [];
function vSmoke(p) { vSmokeSpots.push([p.x, p.y, p.z, rnd() * 9]); }
function vSmokePoints() {
  const per = 6, n = vSmokeSpots.length * per, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const puff = canvasTex(8, 8, (g) => { g.fillStyle = '#f4efe6'; g.fillRect(2, 1, 4, 6); g.fillRect(1, 2, 6, 4); }, { nearest: true });
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: puff, size: .6, transparent: true, opacity: .6, depthWrite: false }));
  pts.userData.dyn = true; pts.frustumCulled = false; scene.add(pts);
  anim.push((t) => {
    vSmokeSpots.forEach(([x, y, z, ph], s) => { for (let i = 0; i < per; i++) { const k = (t * .2 + ph + i / per) % 1, j = (s * per + i) * 3; pos[j] = x + k * 1.1 + Math.sin(t + i) * .15; pos[j + 1] = y + k * 3.5; pos[j + 2] = z - k * .5; } });
    geo.attributes.position.needsUpdate = true;
  });
}

function vGround() {
  plane(240, 240, MAT.grass, 0, 0, 0, 2);
  plane(24, 20, MAT.paver, 0, .014, 0, 2);
  for (const [x0, z0, x1, z1] of V_ROADS) {
    const w = x1 - x0, d = z1 - z0, alongX = w > d;
    plane(w, d, MAT.paver, (x0 + x1) / 2, .012, (z0 + z1) / 2, 3);
    for (const s of [-1, 1]) box(alongX ? w : .3, .1, alongX ? .3 : d, MAT.concrete, alongX ? (x0 + x1) / 2 : (s < 0 ? x0 : x1), 0, alongX ? (s < 0 ? z0 : z1) : (z0 + z1) / 2, { cast: false });
  }
  for (const [x, z, w, d] of V_PATHS) plane(w, d, MAT.concrete, x, .013, z, 1.5);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.8, 48), MAT.concrete); ring.rotation.x = -Math.PI / 2; ring.position.set(0, .016, 0); ring.receiveShadow = true; scene.add(ring);
  // LED lines round the plaza edge, open where the roads leave it
  const [px0, pz0, px1, pz1] = V_PLAZA, led = vGlow(V_LED_COOL);
  for (const z of [pz0 + .15, pz1 - .15]) for (const [a, b] of [[px0, -2.6], [2.6, px1]]) box(b - a, .03, .08, led, (a + b) / 2, .015, z, { cast: false });
  for (const x of [px0 + .15, px1 - .15]) for (const [a, b] of [[pz0, -2.6], [2.6, pz1]]) box(.08, .03, b - a, led, x, .015, (a + b) / 2, { cast: false });
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

// the coin fountain stands in a round reflecting pool with a cyan LED rim
function vFountain() {
  const rim = add(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, .42, 48), MAT.concrete)); rim.position.set(0, .21, 0);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.38, 48), waterMat); pool.rotation.x = -Math.PI / 2; pool.position.set(0, .4, 0); scene.add(pool);
  const led = new THREE.Mesh(new THREE.TorusGeometry(3.62, .04, 4, 64), vGlow(V_LED)); led.rotation.x = -Math.PI / 2; led.position.set(0, .43, 0); scene.add(led);
  tokenFountain(0, 0); COL[COL.length - 1].r = 3.7;
}

function vRiverAndBridge() {
  const [x0, z0, x1, z1] = V_RIVER, zc = (z0 + z1) / 2, w = z1 - z0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, w), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(0, .05, zc); scene.add(water);
  for (const [a, b] of [[x0, -2.6], [2.6, x1]]) {
    for (const z of [z0, z1]) box(b - a, .35, .4, MAT.concrete, (a + b) / 2, 0, z);
    colBox(Math.max(a, -V_HALF), z0 - .2, Math.min(b, V_HALF), z1 + .2);
  }
  box(5, .14, w + 1.4, MAT.wood, 0, .05, zc);
  for (const s of [-1, 1]) {
    for (let z = z0 - .6; z <= z1 + .7; z += 1.5) box(.08, 1.1, .08, MAT.metal, s * 2.45, .19, z);
    box(.06, .85, w + 1.4, vGlass(), s * 2.45, .3, zc, { cast: false });
    box(.12, .08, w + 1.5, MAT.metal, s * 2.45, 1.26, zc);
    box(.05, .04, w + 1.4, vGlow(V_LED_COOL), s * 2.38, .22, zc, { cast: false });
    colBox(s * 2.45 - .12, z0 - .7, s * 2.45 + .12, z1 + .7);
  }
  for (let i = 0; i < 160; i++) { const x = rr(-60, 60), z = (rnd() < .5 ? z0 : z1) + rr(-.5, .5); if (Math.abs(x) > 3.4) box(.06, rr(.7, 1.5), .06, MAT.leafB, x, 0, z, { cast: false }); }
}

function vPond() {
  const [px, pz, r] = V_POND;
  const shore = new THREE.Mesh(new THREE.RingGeometry(r - .2, r + 1.4, 40), MAT.dirt); shore.rotation.x = -Math.PI / 2; shore.position.set(px, .01, pz); shore.receiveShadow = true; scene.add(shore);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 40), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(px, .05, pz); scene.add(water);
  colCirc(px, pz, r - .2);
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.283, d = rr(1.2, r - 1); const p = add(new THREE.Mesh(new THREE.CircleGeometry(rr(.3, .55), 10, .4, 5.6), MAT.leafA), null, false); p.rotation.x = -Math.PI / 2; p.position.set(px + Math.cos(a) * d, .07, pz + Math.sin(a) * d); }
  for (let i = 0; i < 120; i++) { const a = rnd() * 6.283, d = r + rr(-.4, .8), x = px + Math.cos(a) * d, zz = pz + Math.sin(a) * d; if (!(x < px - r + 1.5 && Math.abs(zz - pz) < 1.6)) box(.06, rr(.8, 1.6), .06, MAT.leafB, x, 0, zz, { cast: false }); }
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, m = add(new THREE.Mesh(jitterSphere(rr(.35, .7), 1), MAT.stone)); m.position.set(px + Math.cos(a) * (r + .6), .15, pz + Math.sin(a) * (r + .6)); }
  box(6, .16, 1.8, MAT.wood, px - r + 2.6, .1, pz);
  for (const dx of [0, 2.6, 5.2]) for (const s of [-1, 1]) box(.16, .9, .16, MAT.darkWood, px - r + dx, -.4, pz + s * .85);
  const boat = new THREE.Group(); boat.userData.dyn = true; scene.add(boat);
  box(2.4, .4, 1, MAT.darkWood, 0, 0, 0, { p: boat }); box(2.2, .06, .8, MAT.wood, 0, .34, 0, { p: boat });
  anim.push((t) => { boat.position.set(px - r + 4.4, .02 + Math.sin(t * 1.3) * .04, pz + 1.7); boat.rotation.set(0, .25, Math.sin(t * .9) * .03); });
  INTER.push({ x: px - r - .6, z: pz, r: 1.6, label: 'Pond', verb: 'Look', act: () => talk('Pond', ['Lily pads drift on the still water.', 'Someone left a note in the boat: "Training data: 1 duck, 3 frogs, 0 fish."']) });
}

function vStall(x, z, ry, name, colour, lines) {
  const g = vGroup(x, z, ry), back = new THREE.MeshStandardMaterial({ color: colour, roughness: .85 });
  gbox(g, 3, 1, .9, MAT.wood, 0, 0, .2); gbox(g, 3.1, .08, 1, MAT.wood, 0, 1, .2);
  gbox(g, 3.2, 2.7, .15, back, 0, 0, -.85);
  for (const dx of [-1.5, 1.5]) gbox(g, .1, 2.6, .1, MAT.metal, dx, 0, .7);
  gbox(g, 3.5, .1, 1.8, MAT.awning, 0, 2.6, -.05); gbox(g, 2, .06, .08, MAT.warmGlow, 0, 2.54, .5, { cast: false });
  for (let i = 0; i < 3; i++) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .22, 10), MAT.metal), g); p.position.set(-.8 + i * .8, 1.19, .1); }
  gbox(g, .5, .32, .04, MAT.screen, 1.1, 1.08, .66, { cast: false });
  const s = Math.sin(ry), c = Math.cos(ry);
  signBoard(name, x - s * .7, 2.95, z - c * .7, 2.6, .44, ry, { size: 18, bg: '#2a1a12', edge: '#120a06', color: '#ffe3a0', w: 220, h: 40 });
  colBox(...vFootprint(x, z, 3.3, 1.9, ry));
  INTER.push({ x: x + s * 1.7, z: z + c * 1.7, r: 1.4, label: name, verb: 'Order', act: () => talk(name, lines) });
}

function vStage() {
  const x0 = -12, x1 = -7, z0 = -24.5, z1 = -16.5, mz = (z0 + z1) / 2;
  box(x1 - x0, .7, z1 - z0, MAT.wood, (x0 + x1) / 2, 0, mz); box(.3, 4.4, z1 - z0 + .3, MAT.metal, x0 - .15, 0, mz);
  for (const z of [z0, z1]) box(.2, 5.4, .2, MAT.metal, x1 - .2, 0, z);
  for (const z of [z0, z1]) box(x1 - x0 + .2, .18, .18, MAT.metal, (x0 + x1) / 2, 5.3, z);
  box(.18, .18, z1 - z0, MAT.metal, x1 - .2, 5.3, mz);
  for (const z of [z0 + 1.5, mz, z1 - 1.5]) box(.3, .22, .3, vGlow(V_LED_COOL), x1 - .2, 5.06, z, { cast: false });
  ledSign(['TokenFall Talks', 'Fridays · 5 pm'], '#8fe8ff', x0 + .05, 2.8, mz, 6.4, 2.4, Math.PI / 2, [256, 96]);
  for (const z of [z0 + 1, z1 - 1]) box(.7, 1.2, .7, MAT.metal, x0 + .6, .7, z);
  colBox(x0 - .3, z0, x1, z1);
  for (const [x, h] of [[-6.2, .3], [-5.3, .5]]) { box(.75, h, z1 - z0 - 1.6, MAT.concrete, x, 0, mz); box(.7, .06, z1 - z0 - 1.7, MAT.wood, x, h, mz); colBox(x - .38, z0 + .8, x + .38, z1 - .8); }
  pointLight('lobby', 0xe6f0ff, 1.2, 8, x1 - .6, 3.2, mz);
  INTER.push({ x: -4, z: mz, r: 1.8, label: 'Stage', verb: 'Read', act: () => talk('TokenFall Talks', ['This Friday: "Why does my chatbot sound so sure?" Confidence is not the same as being right.', 'Next week: open mic. Bring your best prompt.']) });
}

function vLeaderboard() {
  const cx = 8.6, z = -12.6;
  for (const s of [-1, 1]) { box(.5, .4, .5, MAT.concrete, cx + s * 4, 0, z); box(.36, 5.6, .36, MAT.metal, cx + s * 4, .4, z); }
  box(8.2, 4.5, .24, MAT.metal, cx, 1.05, z - .1);
  const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.18), boardScreenMaterial()), null, false); scr.position.set(cx, 3.3, z + .03);
  box(8.6, .1, .1, vGlow(V_LED), cx, 5.36, z + .06, { cast: false }); box(8.6, .1, .1, vGlow(V_LED), cx, 1.06, z + .06, { cast: false });
  ledSign(['LEADERBOARD'], '#ffd27a', cx, .62, z + .02, 3.2, .5);
  colBox(cx - 4.3, z - .35, cx + 4.3, z + .3);
  INTER.push({ x: cx, z: z + 2.2, r: 2.6, label: 'Leaderboard', verb: 'View', act: openBoard });
}

function vHQ() {
  const front = hq(0, -52);
  INTER.push({ x: 0, z: front + 1.4, r: 1.8, label: 'HQ Office', verb: 'Read', act: () => talk('HQ Office', ['The doors are locked. A sign says: “Coming soon.”', 'Looking for the office? It\'s in the Calfus building, through the Pune gate.']) });
}

function vFence(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.6)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i <= n; i++) box(.12, 1, .12, MAT.metal, x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n);
  for (const y of [.25, .5, .75]) box(alongX ? len : .06, .14, alongX ? .06 : len, MAT.wood, (x0 + x1) / 2, y, (z0 + z1) / 2);
  colBox(Math.min(x0, x1) - .1, Math.min(z0, z1) - .1, Math.max(x0, x1) + .1, Math.max(z0, z1) + .1);
}

// slim pole, flat LED head on a short arm; lit ones throw a cool-white light
function vLamp(x, z, lit) {
  box(.3, .14, .3, MAT.concrete, x, 0, z); box(.1, 4.2, .1, MAT.metal, x, .14, z);
  box(.9, .08, .1, MAT.metal, x + .4, 4.26, z); box(.7, .1, .34, MAT.metal, x + .75, 4.2, z); box(.6, .03, .28, vGlow(V_LED_COOL), x + .75, 4.17, z, { cast: false });
  colCirc(x, z, .2);
  if (lit) pointLight('lobby', 0xe6f0ff, 1.6, 9, x + .75, 3.9, z + .1);
}
function vPathLights() {
  for (const [x0, z0, x1, z1] of V_ROADS) {
    const alongX = x1 - x0 > z1 - z0, a = alongX ? x0 : z0, b = alongX ? x1 : z1;
    for (let t = a + 3; t < b - 1; t += 7) for (const edge of alongX ? [z0 - .45, z1 + .45] : [x0 - .45, x1 + .45]) {
      const x = alongX ? t : edge, z = alongX ? edge : t;
      if (V_PATHS.some(([px, pz, w, d]) => vInRect([px - w / 2, pz - d / 2, px + w / 2, pz + d / 2], x, z, .6)) || vInRect(V_GAMES_LAWN, x, z, .2) || blocked(x, z, .1)) continue;
      box(.16, .55, .16, MAT.metal, x, 0, z); box(.18, .08, .18, vGlow(V_LED_COOL), x, .45, z, { cast: false }); colCirc(x, z, .12);
    }
  }
}

// a hologram: cyan text floating over a small emitter, readable from both sides
function vHolo(x, z, ry, text) {
  const tex = canvasTex(160, 32, (g) => { g.font = '600 18px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(143,232,255,.22)'; g.fillRect(0, 4, 160, 24); g.fillStyle = '#bff4ff'; g.fillText(text, 80, 17); }, { nearest: true });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
  for (const s of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, .6), m); p.rotation.y = s; g.add(p); }
  box(.5, .06, .5, MAT.metal, x, 0, z, { cast: false }); box(.36, .03, .36, vGlow(V_LED), x, .06, z, { cast: false });
  anim.push((t) => { g.position.set(x, 2.5 + Math.sin(t * 1.6 + x) * .06, z); g.rotation.y = ry; m.opacity = .78 + Math.sin(t * 9 + z) * .06; });
}

// an info screen's face: a cyan title, then the body word-wrapped and shrunk until every line fits the screen
function vTotemTex(title, body) {
  const W = 128, H = 160, pad = 8, font = (px) => `600 ${px}px "Pixelify Sans", monospace`;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#15171d'; g.fillRect(0, 0, W, H); g.fillStyle = '#2c303a'; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let tp = 22; g.font = font(tp); while (tp > 10 && g.measureText(title).width > W - pad * 2) g.font = font(--tp);
    g.fillStyle = '#8fe8ff'; g.fillText(title, W / 2, 22);
    const wrap = (px) => { g.font = font(px); return body.flatMap((para) => para.split(' ').reduce((ls, w) => { const cur = ls[ls.length - 1]; if (cur && g.measureText(cur + ' ' + w).width <= W - pad * 2) ls[ls.length - 1] = cur + ' ' + w; else ls.push(w); return ls; }, [])); };
    let px = 17, lines = wrap(px);
    while (px > 8 && (lines.length * px * 1.3 > H - 50 || lines.some((l) => g.measureText(l).width > W - pad * 2))) lines = wrap(--px);
    g.fillStyle = '#d6ecff';
    const top = 42 + (H - 50 - lines.length * px * 1.3) / 2;
    lines.forEach((l, i) => g.fillText(l, W / 2, top + (i + .5) * px * 1.3));
  }, { nearest: true });
}

function vTotem(x, z, title, body, name, talkLines) {
  box(1.3, 2.3, .22, MAT.metal, x, 0, z);
  const t = vTotemTex(title, body), m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.4, roughness: .5 });
  const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), m), null, false); scr.position.set(x, 1.4, z + .12);
  box(1.3, .05, .05, vGlow(V_LED), x, 2.3, z + .1, { cast: false });
  colBox(x - .7, z - .15, x + .7, z + .15);
  INTER.push({ x, z: z + 1.2, r: 1.4, label: name, verb: 'Read', act: () => talk(name, talkLines) });
}

function vEvBay() {
  const ch = (x, z) => { box(.4, 1.5, .3, MAT.metal, x, 0, z); box(.3, .3, .04, MAT.screen, x, 1, z + .16, { cast: false }); box(.42, .06, .32, vGlow(V_LED), x, 1.5, z, { cast: false }); colBox(x - .25, z - .2, x + .25, z + .2); };
  ch(29.9, -7.2);
  const g = vGroup(32.3, -6.2, Math.PI / 2), paint = new THREE.MeshStandardMaterial({ color: 0x2f8f8a, roughness: .35, metalness: .4 });
  gbox(g, 1.8, .55, 4, paint, 0, .3, 0); gbox(g, 1.6, .5, 2.2, paint, 0, .85, -.2); gbox(g, 1.62, .38, 2.22, vGlass(), 0, .9, -.2, { cast: false });
  for (const sx of [-.85, .85]) for (const sz of [-1.3, 1.3]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .22, 10), MAT.metal), g); w.rotation.z = Math.PI / 2; w.position.set(sx, .32, sz); }
  gbox(g, 1.4, .08, .05, vGlow(0xfff0c0), 0, .55, 2.01, { cast: false }); gbox(g, 1.4, .08, .05, vGlow(0xff3020), 0, .55, -2.01, { cast: false });
  const cable = new THREE.MeshStandardMaterial({ color: V_LED, emissive: V_LED, emissiveIntensity: 1 });
  box(.06, .06, 1.4, cable, 30.4, .9, -6.6, { cast: false }).userData.dyn = true;
  anim.push((t) => { cable.emissiveIntensity = .6 + (Math.sin(t * 4) * .5 + .5) * 1.4; });
  colBox(30.2, -7.2, 34.4, -5.2);
  ledSign(['EV CHARGING'], '#8fe8ff', 32.3, 2.6, -7.9, 2.4, .42);
}

function vSmartBench(x, z, ry) {
  bench(x, z, ry);
  const g = vGroup(x, z, ry);
  for (const dx of [-.85, .85]) gbox(g, .08, 2.2, .08, MAT.metal, dx, 0, -.42);
  const p = gbox(g, 2.1, .06, 1, MAT.solar, 0, 0, 0); p.position.set(0, 2.25, -.1); p.rotation.x = .18;
  gbox(g, .3, .04, .04, vGlow(V_LED), 0, .62, -.27, { cast: false });
}

function vPromptLab() {
  const x = 10, z = 26, g = vGroup(x, z, -Math.PI / 2), w = 6, d = 4.6, H = 3, glass = vGlass();
  gbox(g, w + .4, .2, d + .4, MAT.concrete, 0, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gbox(g, .14, H, .14, MAT.metal, sx * w / 2, .2, sz * d / 2);
  gbox(g, w, H - .2, .06, glass, 0, .2, -d / 2, { cast: false });
  for (const sx of [-1, 1]) gbox(g, .06, H - .2, d, glass, sx * w / 2, .2, 0, { cast: false });
  for (const sx of [-1, 1]) gbox(g, w / 2 - .8, H - .2, .06, glass, sx * (w / 4 + .4), .2, d / 2, { cast: false });
  gbox(g, w + 1.2, .22, d + 1.2, MAT.roofFlat, 0, H + .2, 0); gbox(g, w + 1.2, .05, .05, vGlow(V_LED), 0, H + .12, d / 2 + .62, { cast: false });
  gbox(g, 4, .08, .9, MAT.wood, 0, .95, -1.4); for (const dx of [-1.6, 1.6]) gbox(g, .1, .75, .8, MAT.metal, dx, .2, -1.4);
  for (const dx of [-1.3, 0, 1.3]) { gbox(g, .9, .55, .05, MAT.screen, dx, 1.12, -1.7, { cast: false }); const st = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 10), MAT.metal), g); st.position.set(dx, .45, -.6); }
  const sign = ledSign(['PROMPT LAB'], '#8fe8ff', 0, 0, 0, 2.6, .45); g.add(sign); sign.position.set(0, H + .55, d / 2 + .62);
  pointLight('lobby', 0xe6f0ff, .9, 6, x, 2.4, z);
  colBox(...vFootprint(x, z, w + .2, d + .2, -Math.PI / 2));
  INTER.push({ x: x - d / 2 - 1.4, z, r: 1.6, label: 'Prompt Lab', verb: 'Peek', act: () => talk('Prompt Lab', ['The doors are glass, the screens are on, the chairs are empty.', 'A sign: “Opening soon — practise writing clear prompts and spotting made-up answers.”']) });
}

// a delivery robot that runs the Pune road and docks at the parcel lockers, and a robot mower on the west lawn
function vRobots() {
  const shell = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: .5 }), faceTex = ledTex(['^ ^'], '#8fe8ff', 32, 16), face = std(faceTex, 0, { emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.2 });
  const bot = new THREE.Group(); bot.userData.dyn = true; scene.add(bot);
  box(.7, .5, .9, shell, 0, .16, 0, { p: bot }); box(.5, .22, .02, face, 0, .44, .46, { p: bot, cast: false });
  for (const sx of [-.36, .36]) for (const sz of [-.3, .3]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .1, 10), MAT.metal), bot); w.rotation.z = Math.PI / 2; w.position.set(sx, .13, sz); }
  box(.04, .5, .04, MAT.metal, -.25, .66, -.3, { p: bot }); box(.12, .12, .12, glowStrip(0xff8a5c), -.25, 1.14, -.3, { p: bot, cast: false });
  anim.push((t) => {
    const u = t % V_BOT_CYCLE, ease = (f) => f * f * (3 - 2 * f);
    let x = 14, z = -1.3, ry = Math.PI / 2;
    if (u < 20) x = 14 + ease(u / 20) * (V_BOT_DOCK[0] - 14);
    else if (u < 28) { const f = u < 21 ? u - 20 : u < 27 ? 1 : 28 - u; x = V_BOT_DOCK[0]; z = -1.3 + ease(f) * (V_BOT_DOCK[1] + 1.3); ry = Math.PI / 2 + ease(f) * Math.PI / 2; }
    else if (u < 48) { x = V_BOT_DOCK[0] - ease((u - 28) / 20) * (V_BOT_DOCK[0] - 14); ry = -Math.PI / 2; }
    bot.position.set(x, 0, z); bot.rotation.y = ry;
  });

  const mower = new THREE.Group(); mower.userData.dyn = true; scene.add(mower);
  box(.9, .28, 1.1, new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: .5 }), 0, .1, 0, { p: mower }); box(.5, .05, .5, shell, 0, .38, -.1, { p: mower }); box(.14, .08, .06, glowStrip(0xffb347), 0, .3, .56, { p: mower, cast: false });
  const [mx0, mz0, mx1, mz1] = V_MOW, lanes = 5, laneW = (mz1 - mz0) / (lanes - 1);
  anim.push((t) => { const u = (t * .06) % lanes, lane = u | 0, f = u - lane, dir = lane % 2 ? -1 : 1; mower.position.set(dir > 0 ? mx0 + f * (mx1 - mx0) : mx1 - f * (mx1 - mx0), 0, mz0 + lane * laneW); mower.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; });

}

function vFoliage() {
  const leaves = [MAT.leafA, MAT.leafB, MAT.leafC];
  for (const [x, z, s, leaf] of [[-10.6, -8.6, 1, MAT.blossom], [10.6, 8.6, .9, MAT.leafC], [-6.5, 27, 1.1, MAT.leafA], [6.6, -18, 1, MAT.leafB], [-17, 12, 1.1, MAT.blossom], [17, 18, 1.2, MAT.leafA], [24, -20, 1, MAT.blossom]]) tree(x, z, s, leaf);
  for (let i = 0, n = 0; i < 400 && n < 40; i++) {
    const x = rr(-V_HALF + 2, V_HALF - 2), z = rr(-V_HALF + 2, V_HALF - 2);
    if (!vClear(x, z, 2.2)) continue;
    tree(x, z, rr(.85, 1.3), leaves[rnd() * 3 | 0], false); colCirc(x, z, .4); n++;
  }
  for (let i = 0, n = 0; i < 900 && n < 150; i++) {
    const x = rr(-75, 75), z = rr(-75, 75);
    if (Math.abs(x) < V_HALF + 2 && Math.abs(z) < V_HALF + 2 && z > -40) continue;
    if (vWater(x, z, 1.5) || (Math.abs(x) < 12 && z < -40 && z > -60)) continue;
    tree(x, z, rr(1, 1.6), leaves[rnd() * 3 | 0], false); n++;
  }
  for (let i = 0, n = 0; i < 1200 && n < 120; i++) {
    const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF), edge = vPaved(x, z, 2.4) && !vPaved(x, z, .9);
    if ((edge || rnd() < .3) && vClear(x, z, .7)) { bush(x, z, rr(.7, 1.1), leaves[rnd() * 3 | 0]); n++; }
  }
  for (let i = 0; i < 30; i++) { const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF); if (vClear(x, z, .8)) { const m = add(new THREE.Mesh(jitterSphere(rr(.4, .9), 1), MAT.stone)); m.position.set(x, .2, z); colCirc(x, z, .5); } }
  for (const [x, z] of [[8.4, 6.4]]) {
    const bed = add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.85, .45, 24), MAT.concrete)); bed.position.set(x, .22, z);
    bush(x - .4, z + .1, 1, MAT.leafC); tree(x + .3, z - .2, .7, MAT.blossom, false); colCirc(x, z, 1.9);
  }
}

function vGrass() {
  const lawn = () => { const x = rr(-60, 60), z = rr(-60, 60); return vPaved(x, z, .3) || vWater(x, z, .3) || (walkable(x, z) && blocked(x, z, -.1)) ? null : [x, z]; };
  scatter(TX.grassTuft, 6000, .6, lawn);
  const fern = canvasTex(16, 16, (g) => { for (const [x, c] of [[4, '#4f8a34'], [8, '#5f9a3a'], [12, '#4f8a34']]) { g.fillStyle = c; for (let y = 2; y < 16; y++) { g.fillRect(x, y, 1, 1); if (y % 2) { g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1); } } } }, { nearest: true });
  scatter(fern, 900, .9, () => { const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF); return vPaved(x, z, 2.5) && !vPaved(x, z, .6) && !vWater(x, z, .2) && !blocked(x, z, -.1) ? [x, z] : null; });
  TX.flowers.forEach((ft) => scatter(ft, 160, .5, () => { const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF); return vPaved(x, z, 1.8) && !vPaved(x, z, .5) && !vWater(x, z) && !blocked(x, z, -.1) ? [x, z] : null; }));
}

function buildVillageLobby() {
  vGround();
  WALK.push([-V_HALF, -47.5, V_HALF, V_HALF]);
  vRiverAndBridge();
  vPond();
  vHQ();
  for (const c of V_HOMES) vHome(c);
  umbrellaTable(14.4, -6.6, MAT.umbrellaA); umbrellaTable(14.2, -4.2, MAT.umbrellaB);
  vFountain();
  V_STALLS.forEach(([name, colour, lines], i) => vStall(-17 - i * 4.4, 5.6, Math.PI, name, colour, lines));
  vStage();
  vLeaderboard();
  vPromptLab();
  vEvBay();
  buildVillageAI();
  for (const [x, z, lit] of V_LAMPS) vLamp(x, z, !!lit);
  for (const [x, z, ry] of [[-6, -8.6, 0], [6, 8.6, Math.PI], [-6, 8.6, Math.PI], [11, -6.5, -Math.PI / 2]]) vSmartBench(x, z, ry);
  for (const f of V_FENCES) vFence(...f);
  for (const [x, z] of [[-12.6, 3.6], [12.6, -3.6], [4.6, -10.8]]) pot(x, z);
  for (const [x, z, ry, text] of V_HOLOS) vHolo(x, z, ry, text);
  vTotem(-5.6, 11.4, 'WELCOME', ['▲ HQ', '◀ Airport', 'Pune ▶', '▼ Glass Bridge'], 'Directory', ['Welcome to TokenFall!', 'West, past the food stalls: the airport, with flights to the Calfus US office in Pleasanton. East, past Token Brew: Pune, home of the Calfus office. South, past the pond: the Glass Bridge. North, over the river: HQ.', 'The lawn in front of Home has two games: Token Tower and Spot Shot. The carrom table is in the HQ office, through Pune.', 'The leaderboard by the plaza shows who has the most correct answers.']);
  vTotem(5.6, 11.4, 'AI TIP', ['Sounding sure is not the same as being right.'], 'AI Tips', V_AI_TIPS);

  gate(-40, 0, Math.PI / 2, 'Airport', 0xffb347, 'lobby', 'airport');
  gate(40, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');
  gate(0, 40, 0, 'The Glass Bridge', 0xffd27a, 'lobby', 'bridge'); sparkles(0, 40, 0xffd27a, 34, 1.3, 3.6);
  ledSign(['▼ The Glass Bridge'], '#ffe39a', 0, 5.4, 40, 3.8, .55);

  vPathLights();
  vRobots();
  vFoliage();
  vSmokePoints();
  vGrass();
  if (new URLSearchParams(location.search).get('board') === 'sample') useSampleBoard();
  // everything built after the lobby continues from a fixed seed, so redesigning the lobby never reshuffles the other zones
  seed = SEED_AFTER_LOBBY;
}

const VILLAGE = {
  build: buildVillageLobby, spawn: V_SPAWN, spawnDir: 'up', npcBounds: [-11, -9, 11, 9],
  returns: { airport: [-37, 0], pune: [37, 0], bridge: [0, 37] },
  petals: [[-10.6, -8.6], [-17, 12]], lightPoles: [],
  dof: { farStart: 14, farRange: 50, edgeBlur: .25 },
  minigameSpots: V_GAME_SPOTS,
};
