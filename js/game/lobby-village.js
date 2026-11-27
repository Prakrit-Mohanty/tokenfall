// TokenFall: the village lobby. A paved plaza with the coin fountain in a reflecting pool and four roads out: west past the
// food stalls to the airport, east past Token Brew to Pune, south past the pond to the Glass Bridge, north over the arched bridge
// to the railway station (trains to Bengaluru). Modern homes ring the plaza; holo signs, info screens, an EV bay, the Prompt Lab pavilion and a few robots add the AI era.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const V_PLAZA = [-12, -10, 12, 10];
const V_ROADS = [[-2.6, -30.5, 2.6, -10], [-2.6, 10, 2.6, 46], [-46, -2.6, -12, 2.6], [12, -2.6, 46, 2.6]];
const V_ISLAND = 53;   // the lobby is a floating island: its lawn, its river and its tufts end here, 7 m beyond where the hero can walk (dreamworld.js dresses the edge)
const V_RIVER = [-V_ISLAND, -37.5, V_ISLAND, -30.5];
const V_POND = [25, 25, 8];
const V_PLANTER = [8.4, 6.4, 1.8];   // the round planter bed on the plaza (x, z, radius): the paving makes room for it
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
  { x: -19, z: -12.5, w: 9, d: 7, wall: PAL.peach, style: 'flat', solar: true, label: ['Home', '#9dff9f'], labelRight: true, inter: ['Home', 'Knock', ['Nobody\'s home right now.', 'A note on the door: “Moving in soon — your own space in TokenFall!”']] },
  { x: -32, z: -13, w: 8, d: 7, wall: PAL.mint, style: 'mono', storeys: 2, clad: true, flue: true },
  { x: -26, z: -25, w: 10, d: 8, wall: PAL.butter, style: 'gable', storeys: 2, led: true },
  { x: 20, z: -13, w: 10, d: 7, wall: PAL.sky, style: 'flat', cafe: true, label: ['TOKEN BREW', '#ffd27a'], inter: ['Token Brew', 'Order', ['One masala chai, coming up! ☕', 'Fun fact: this sentence is about 12 tokens long.', 'Kitchen\'s short-staffed. Want a shift? Take the staff door at the right-hand end of my front wall: look for the twinkle and the board.']] },
  { x: 33, z: -13, w: 8, d: 7, wall: PAL.blush, style: 'mono', solar: true },
  { x: 12.5, z: -24, w: 8, d: 7, ry: -Math.PI / 2, wall: PAL.cream, style: 'flat', storeys: 2, clad: true },
  { x: 28, z: -25, w: 10, d: 8, wall: PAL.lilac, style: 'gable', flue: true },
  { x: -10.5, z: 21, w: 8, d: 7, ry: Math.PI / 2, wall: PAL.sage, style: 'mono', led: true },
  { x: -10.5, z: 33, w: 8, d: 7, ry: Math.PI / 2, wall: PAL.peach, style: 'flat', solar: true, clad: true },
  { x: -27, z: 21, w: 10, d: 8, wall: PAL.mint, style: 'mono', storeys: 2, solar: true },
  { x: -33, z: 35, w: 9, d: 7, ry: Math.PI, wall: PAL.butter, style: 'gable', flue: true },
  { x: 10.5, z: 15, w: 8, d: 7, ry: -Math.PI / 2, wall: PAL.sky, style: 'flat', led: true },
  { x: 27, z: 9.5, w: 9, d: 7, ry: Math.PI, wall: PAL.blush, style: 'mono', clad: true, solar: true },
  { x: 38, z: 12, w: 8, d: 7, ry: Math.PI, wall: PAL.cream, style: 'gable' },
  { x: 39, z: 32, w: 9, d: 7, ry: -Math.PI / 2, wall: PAL.lilac, style: 'flat', solar: true },
  { x: 10.5, z: 38, w: 8, d: 7, ry: -Math.PI / 2, wall: PAL.sage, style: 'mono', clad: true, flue: true },
];
const V_EXTRA_PATHS = [[0, -42.2, 5, 9.4], [5.15, 26, 5.1, 1.8], [32.4, -6, 5.6, 3]];
const V_FENCES = [[-14, -4, -14, -9.5], [14.5, 4, 14.5, 7.5], [-14.5, 4, -14.5, 9], [-34, -4.2, -38, -4.2], [29.5, 4.2, 31, 4.2]];
const V_LAMPS = [[-11.4, -9.4, 1], [11.4, 9.4, 1], [-11.4, 9.4, 0], [11.4, -9.4, 0], [-3.6, -14, 0], [3.6, -17, 1], [-3.6, 16, 1], [3.6, 30, 0], [-13.4, -3.6, 1], [-30, 3.6, 0], [16, 3.6, 1], [30, -3.6, 0], [-3.6, -28.5, 0], [3.6, 35, 0]];
const V_HOLOS = [[0, -10.8, 0, '▲ STATION'], [-12.8, 0, Math.PI / 2, '◀ AIRPORT'], [12.8, 0, -Math.PI / 2, 'PUNE ▶'], [0, 10.8, Math.PI, '▼ GLASS BRIDGE']];
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
// the Token Brew Kitchen's staff door is Token Brew's own door: where it is, where to stand, where the hero comes back out (kitchen-world.js adds the board, the twinkle and the prompt)
V_GAME_SPOTS.kitchen = (() => { const d = vDoor(V_HOMES.find((h) => h.cafe)); return { door: [d.x, d.z], dir: [d.dirX, d.dirZ], stand: [d.x + d.dirX * 1.4, d.z + d.dirZ * 1.4], ret: [d.x + d.dirX * 2.1, d.z + d.dirZ * 2.1] }; })();
const vPaved = (x, z, m = 0) => vInRect(V_PLAZA, x, z, m) || V_ROADS.some((r) => vInRect(r, x, z, m)) || V_PATHS.some(([px, pz, w, d]) => vInRect([px - w / 2, pz - d / 2, px + w / 2, pz + d / 2], x, z, m));
const vWater = (x, z, m = 0) => vInRect(V_RIVER, x, z, m) || Math.hypot(x - V_POND[0], z - V_POND[1]) < V_POND[2] + m;
const V_STATION = [-32, -53, 19.8, -40.4];   // the station: the platform, its steps, the station house and the footbridge's stairs (station.js)
const vClear = (x, z, m) => !vPaved(x, z, m) && !vWater(x, z, m) && !vInRect(V_MOW, x, z, m) && !vInRect(V_GAMES_LAWN, x, z, m) && !vInRect(V_STATION, x, z, m) && !(walkable(x, z) && blocked(x, z, m));

const vCache = {};
const vOnce = (key, make) => vCache[key] || (vCache[key] = make());
const vTint = (tex, s, color, side) => vOnce(tex.uuid + color + (side || ''), () => std(tex, s, { color, ...(side ? { side } : {}) }));
const vGlass = () => vOnce('glass', () => new THREE.MeshStandardMaterial({ color: 0xcfeef0, transparent: true, opacity: .26, roughness: .05, depthWrite: false }));
const vGlow = (color) => vOnce('glow' + color, () => glowStrip(color));
const vMetalRoof = () => vOnce('metalRoof', () => new THREE.MeshStandardMaterial({ color: PAL.coral, roughness: .7, metalness: 0 }));   // a soft terracotta roof (it was dark metal)
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

function vPane(g, x, y, z, w, h, ry = 0, flowers = false) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  gbox(p, w + .26, h + .26, .1, MAT.trim, 0, -.13, 0);
  gbox(p, w, h, .1, MAT.glassLit, 0, 0, .01, { cast: false });
  gbox(p, w + .44, .1, .26, MAT.trim, 0, -.2, .08, { cast: false });   // the sill
  if (flowers) flowerBox(0, -.62, .22, w, p);
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

  if (!cafe) {   // ivy hanging from the eave at both ends of the front, dotted with blossoms (from the separate decor sequence)
    for (const k of [-1, 1]) for (let v = 0; v < 2; v++) {
      const len = 1.1 + decorRandom() * 1.5, vx = mx + k * (mw / 2 - .16 - v * .26), leafM = decorRandom() < .3 ? MAT.leafLav : MAT.leafB;
      gbox(g, .24, len, .05, leafM, vx, H - len, d / 2 + .06, { cast: false });
      for (let b = 0; b < 3; b++) gbox(g, .09, .09, .09, MAT.blossom, vx + (decorRandom() - .5) * .2, H - decorRandom() * len, d / 2 + .1, { cast: false });
    }
  }
  const glassW = cafe ? mw - .4 : mw * .7;
  gbox(g, glassW, 2.4, .1, MAT.glassLit, mx, .35, d / 2 + .03, { cast: false });
  for (const k of [-.5, 0, .5]) gbox(g, .12, 2.4, .16, MAT.trim, mx + k * glassW, .35, d / 2 + .04);
  gbox(g, glassW + .3, .16, .2, MAT.trim, mx, 2.75, d / 2 + .04);
  for (const k of [-1, 1]) gbox(g, .26, H - .3, .26, MAT.trim, mx + k * mw / 2, .3, d / 2);   // cream corner pilasters
  if (storeys > 1) vPane(g, mx, 4.6, d / 2 + .03, mw * .8, .9, 0, true);
  for (const s of [-1, 1]) for (let f = 0; f < storeys; f++) vPane(g, s * (w / 2 + .03), 1.9 + f * 3, s > 0 ? -.3 : 0, 1.3, 1.3, s * Math.PI / 2);
  if (cafe) {
    gbox(g, glassW + .6, .08, 1.6, MAT.awning, mx, 2.95, d / 2 + .75);
    const menu = ledSign(['CHAI · COFFEE · SNACKS'], '#ffd27a', 0, 0, 0, glassW * .8, .42); g.add(menu); menu.position.set(mx, 3.35, d / 2 + .08);
  }

  const doorZ = d / 2 - .6;
  gbox(g, 1.1, 2.3, .12, MAT.darkWood, sx, .3, doorZ + .02); gbox(g, .05, .8, .06, MAT.warmGlow, sx + .38, 1.1, doorZ + .1, { cast: false });
  gbox(g, .14, .34, .1, MAT.warmGlow, sx - .8, 2, doorZ + .06, { cast: false });
  gbox(g, 1.6, .15, .7, MAT.concrete, sx, 0, doorZ + .35);
  gbox(g, 1.5, .14, .2, MAT.trim, sx, 2.62, doorZ + .02); for (const k of [-1, 1]) gbox(g, .15, 2.4, .2, MAT.trim, sx + k * .62, .3, doorZ + .02);   // the door surround
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
  if (inter) {
    const [name, verb, lines] = inter;
    // the cafe's counter is its glass front; its own door is the way into the Token Brew Kitchen (kitchen-world.js), so the two prompts are a few metres apart
    const at = cafe ? { x: x + cs * mx + s * (d / 2 + 1.4), z: z - s * mx + cs * (d / 2 + 1.4) } : { x: door.x + door.dirX * 1.4, z: door.z + door.dirZ * 1.4 };
    INTER.push({ x: at.x, z: at.z, r: 1.7, label: name, verb, act: () => talk(name, lines) });
  }
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
  PAVE_U.uPlaza.value.set(...V_PLAZA); PAVE_U.uFount.value.set(0, 0); PAVE_U.uWalk.value[0].set(0, V_ROADS[0][1], 0, V_ROADS[1][3]); PAVE_U.uWalk.value[1].set(V_ROADS[2][0], 0, V_ROADS[3][2], 0);   // the border band, the fountain's rings of stone (paving.js: the inlay band is cut from the field's own stone), and the stone worn pale along the two roads
  plane(2 * V_ISLAND, 2 * V_ISLAND, MAT.grass, 0, 0, 0, 2);
  // the paving: every area lays its own whole stones from its own edges (paving-layout.js), the fountain keeps its rings (paving.js), and the field is cut round the fountain's accent line and the planter
  const FO = 6.95;   // where the fountain's rings end (paving.js FO)
  // the north road and the path beyond the river stop where the bridge's deck (arch-bridge.js) takes over: its stones run on from theirs
  const toBridge = [V_ROADS[0][0], ARCH.zS, V_ROADS[0][2], V_ROADS[0][3]], [px, pz, pw, pd] = V_EXTRA_PATHS[0], pN = pz - pd / 2, fromBridge = [px, (pN + ARCH.zN) / 2, pw, ARCH.zN - pN];
  const plan = {
    plaza: V_PLAZA, roads: [toBridge, ...V_ROADS.slice(1)], paths: V_PATHS.map((p) => (p === V_EXTRA_PATHS[0] ? fromBridge : p)), bothEnds: [fromBridge],   // bothEnds: the path from the bridge to the station is open at both ends
    discs: [{ x: 0, z: 0, Rs: [FO], r0: 3.6, outerW: .6, ringless: true }, { x: V_PLANTER[0], z: V_PLANTER[1], Rs: [2.55, 2.6, 2.65, 2.7, 2.75, 2.8, 2.85, 2.9, 2.95, 3, 3.05, 3.1], r0: V_PLANTER[2] - .05, outerW: .6 }],
  };
  const layout = pavingLayout(plan);
  buildPaving(layout, [0, 0, 3.6, FO]);
  // the kerbs: one style along the paving's whole outline (kerb.js): flush against its edge on the grass side, round at every outside corner, mitred at every inside corner, stopping only where the paving carries on
  // (a road's far end, a path's door end). The same carved stone as the fountain's bowls.
  const kp = kerbPlan(layout.areas, plan);
  buildKerbs(kerbChains(kp.areas, kp.open), stoneRoundMaterial({ c: [0, 0], n: 0 }));
  // LED lines round the plaza edge, open where the roads leave it
  const [px0, pz0, px1, pz1] = V_PLAZA, led = vGlow(V_LED_COOL);
  for (const z of [pz0 + .15, pz1 - .15]) for (const [a, b] of [[px0, -2.6], [2.6, px1]]) box(b - a, .03, .08, led, (a + b) / 2, .015, z, { cast: false });
  for (const x of [px0 + .15, px1 - .15]) for (const [a, b] of [[pz0, -2.6], [2.6, pz1]]) box(.08, .03, b - a, led, x, .015, (a + b) / 2, { cast: false });
}

// the centrepiece: a hollow stone basin holding a two-bowl fountain, with the Calfus coin floating above it.
// One lathe profile per piece, so the lip, bowls and stem are smooth curves (no stacked cylinders, nothing poking through anything)
const arc = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const curve = (pts, n = 14) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(n).map(p => [p.x, p.y]);
function lathe(pts, mat, seg = 96) {   // pts are [radius, height], walked so that the surface faces to the right of the walk (outwards going up)
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), uv = g.attributes.uv, p = g.attributes.position;
  // the lathe's own V runs by point index, which squeezes short stretches of the profile; take it from height + radius so the tile keeps one scale everywhere
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, (p.getY(i) + Math.hypot(p.getX(i), p.getZ(i))) * 1.2);
  return add(new THREE.Mesh(g, mat));
}
function waterDisc(r, y) { const w = new THREE.Mesh(new THREE.CircleGeometry(r, 96), waterMat); w.rotation.x = -Math.PI / 2; w.position.y = y; scene.add(w); return w; }
function goldRing(r, y, tube = .035) { const m = add(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 96), MAT.gold), null, false); m.rotation.x = Math.PI / 2; m.position.y = y; return m; }

// white marble with soft grey veins and a few warm gold threads, polished; the lathe's UVs tile it 8 times round and ~1.2 per metre up
function marbleMaterial() {
  return vOnce('marble', () => {
    const tex = canvasTex(512, 512, (g, W, H) => {
      g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, W, H);
      let sd = 77; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${225 + r() * 20 | 0},${222 + r() * 20 | 0},${218 + r() * 20 | 0},.25)`; g.beginPath(); g.arc(r() * W, r() * H, 10 + r() * 40, 0, 6.3); g.fill(); }   // cloudy depth
      const vein = (w, col, n) => { for (let k = 0; k < n; k++) {   // wandering veins that wrap left-right and top-bottom, so the tile repeats seamlessly
        let x = r() * W, y = r() * H, a = r() * 6.3; g.strokeStyle = col; g.lineWidth = w * (.5 + r()); g.lineCap = 'round';
        for (let s = 0; s < 70; s++) { a += (r() - .5) * .7; const nx = x + Math.cos(a) * 7, ny = y + Math.sin(a) * 7;
          for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(nx + ox, ny + oy); g.stroke(); }
          x = nx; y = ny; if (r() < .04) g.lineWidth *= .7; } } };
      vein(2.2, 'rgba(150,150,160,.35)', 7); vein(1, 'rgba(120,122,135,.45)', 10); vein(1.2, 'rgba(205,165,90,.45)', 3);
    }, { keep: true });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: .22, metalness: 0, color: 0xffffff });
  });
}

function tokenFountain(fx, fz) {
  const root = new THREE.Group(); root.position.set(fx, 0, fz); scene.add(root);
  const mount = (o) => { scene.remove(o); root.add(o); return o; };
  // basin: low step, wall, a rounded coping, then the inside wall down to the floor
  // stone like the paving: the basin is 24 stones round in courses .35 high (their joints line up with the paving's 24 wedges), the bowls and stem one carved block
  const basinStone = marbleMaterial(), carvedStone = basinStone.clone();
  carvedStone.side = THREE.DoubleSide; if (carvedStone.emissive) { carvedStone.emissive.set(0xfff4e6); carvedStone.emissiveIntensity = .22; }   // the bowls' undersides and the stem read as lit marble through the water, not a dark hole   // polished white marble, so the fountain reads as a grand centrepiece, not more paving
  mount(lathe([[3.72, 0], [3.72, .1], [3.56, .14], [3.5, .2], [3.5, .55], ...arc(3.3, .55, .2, 0, Math.PI), [3.1, .3], [2.95, .2], [0, .2]], basinStone));
  mount(waterDisc(3.13, .47));
  // pedestal, lower bowl, stem, upper bowl (one profile; the inner surfaces hold the bowl water)
  mount(lathe([[1.05, .2], [1.05, .28], [.9, .36], [.5, .44], [.34, .56], [.3, .85],
    ...curve([[.3, .85], [.7, .92], [1.15, 1.04], [1.45, 1.2], [1.52, 1.28]], 14), ...arc(1.45, 1.28, .07, 0, Math.PI, 6),
    ...curve([[1.38, 1.28], [1.22, 1.17], [.9, 1.08], [.55, 1.03], [.3, 1.02]], 14), [.26, 1.2], [.26, 1.4],
    ...curve([[.26, 1.4], [.5, 1.43], [.75, 1.52], [.9, 1.66], [.96, 1.72]], 12), ...arc(.9, 1.72, .06, 0, Math.PI, 6),
    ...curve([[.84, 1.72], [.72, 1.62], [.5, 1.55], [0, 1.52]], 10)], carvedStone));
  mount(waterDisc(1.28, 1.19)); mount(waterDisc(.78, 1.63));
  for (const [r, y] of [[1.45, 1.35], [.9, 1.78]]) mount(goldRing(r, y, .04));   // a gold ring along each bowl's crest
  for (const [r, y] of [[3.1, .56]]) {   // one thin highlight at the water's edge; nothing glows outside the rim
    const led = new THREE.Mesh(new THREE.TorusGeometry(r, .035, 6, 128), vGlow(V_LED)); led.rotation.x = Math.PI / 2; led.position.y = y; mount(led); }

  // the moving water: sheets over each lip, jets from the rim, and foam, rings, droplets and mist where it all lands (fountain-water.js)
  fountainWater(root, { basin: [.47, 3.13], low: [1.19, 1.28], up: [1.63, .78] });

  const coinFace = std(TX.coin, 0, { emissive: 0xffffff, emissiveMap: TX.coin, emissiveIntensity: .35, roughness: .5, metalness: .3 });
  const coin = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .18, 96), [MAT.gold, coinFace, coinFace])); coin.rotation.x = Math.PI / 2;
  const coinG = new THREE.Group(); coinG.add(coin); coinG.scale.setScalar(.88); scene.add(coinG); coinG.userData.dyn = true;
  anim.push(t => { coinG.position.set(fx, 2.95 + Math.sin(t * 1.4) * .12, fz); coinG.rotation.y = t * .7; });
  colCirc(fx, fz, 3.75);
  INTER.push({ x: fx, z: fz + 3, r: 1.5, label: 'The Token', verb: 'Inspect', act: () => talk('The Token', ['A giant golden token hovers over the fountain.', 'Models don\'t read words — they read tokens: small chunks of text.', '“TokenFall” might be 3 tokens. Or 2. It depends on the model!', 'Rumour: the glass bridge south of here only holds up the right answer.']) });
}

function vFountain() { tokenFountain(0, 0); }

function vRiverAndBridge() {
  const [x0, z0, x1, z1] = V_RIVER, zc = (z0 + z1) / 2, w = z1 - z0;
  riverWater(V_RIVER);   // the moving water, the leaves riding it and the fish (river.js)
  const bw = ARCH.x1 + ARCH.curb;   // the river's kerbs run up to the bridge's stone walls
  for (const [a, b] of [[x0, -bw], [bw, x1]]) {
    for (const z of [z0, z1]) box(b - a, .35, .4, MAT.concrete, (a + b) / 2, 0, z);
    colBox(Math.max(a, -V_HALF), z0 - .2, Math.min(b, V_HALF), z1 + .2);
  }
  archBridge();   // the stone arch, paved like the road it carries on from (arch-bridge.js)
  for (let i = 0; i < 70; i++) { const x = rr(-V_ISLAND + 1, V_ISLAND - 1), z = (rnd() < .5 ? z0 : z1) + rr(-.5, .5); if (Math.abs(x) > 3.4) box(.06, rr(.7, 1.5), .06, MAT.leafB, x, 0, z, { cast: false }); }
}

function vPond() {
  const [px, pz, r] = V_POND;
  const shore = new THREE.Mesh(new THREE.RingGeometry(r - .2, r + 1.4, 40), MAT.dirt); shore.rotation.x = -Math.PI / 2; shore.position.set(px, .01, pz); shore.receiveShadow = true; scene.add(shore);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 40), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(px, .05, pz); scene.add(water);
  colCirc(px, pz, r - .2);
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.283, d = rr(1.2, r - 1); const p = add(new THREE.Mesh(new THREE.CircleGeometry(rr(.3, .55), 10, .4, 5.6), MAT.leafA), null, false); p.rotation.x = -Math.PI / 2; p.position.set(px + Math.cos(a) * d, .07, pz + Math.sin(a) * d); }
  for (let i = 0; i < 50; i++) { const a = rnd() * 6.283, d = r + rr(-.4, .8), x = px + Math.cos(a) * d, zz = pz + Math.sin(a) * d; if (!(x < px - r + 1.5 && Math.abs(zz - pz) < 1.6)) box(.06, rr(.8, 1.6), .06, MAT.leafB, x, 0, zz, { cast: false }); }
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
  signBoard(name, x - s * .7, 2.95, z - c * .7, 2.6, .44, ry, { size: 18, bg: colour, w: 220, h: 40 });
  colBox(...vFootprint(x, z, 3.3, 1.9, ry)); contact(x, z, 2.2, 1.5, ry);
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
  pointLight('lobby', 0xffe2b8, 1.2, 8, x1 - .6, 3.2, mz);
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
  colCirc(x, z, .2); contact(x, z, .75); lampPool(x + .75, z + .1, 3.6, lit ? 1 : .5);
  if (lit) pointLight('lobby', 0xffe2b8, 1.6, 9, x + .75, 3.9, z + .1);
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
  const tex = canvasTex(160, 32, (g) => { g.font = `600 18px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(143,232,255,.22)'; g.fillRect(0, 4, 160, 24); g.fillStyle = '#bff4ff'; g.fillText(text, 80, 17); }, { nearest: true });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
  for (const s of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, .6), m); p.rotation.y = s; g.add(p); }
  box(.5, .06, .5, MAT.metal, x, 0, z, { cast: false }); box(.36, .03, .36, vGlow(V_LED), x, .06, z, { cast: false });
  anim.push((t) => { g.position.set(x, 2.5 + Math.sin(t * 1.6 + x) * .06, z); g.rotation.y = ry; m.opacity = .78 + Math.sin(t * 9 + z) * .06; });
}

// an info screen's face: a cyan title, then the body word-wrapped and shrunk until every line fits the screen
function vTotemTex(title, body) {
  const W = 128, H = 160, pad = 8, font = (px) => `600 ${px}px ${SIGN_FONT}`;
  return canvasTex(W, H, (g) => {
    g.fillStyle = PAL.plum; g.fillRect(0, 0, W, H); g.fillStyle = PAL.paint; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3);
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
  colBox(x - .7, z - .15, x + .7, z + .15); contact(x, z, 1.15, .6);
  INTER.push({ x, z: z + 1.2, r: 1.4, label: name, verb: 'Read', act: () => talk(name, talkLines) });
}

// the lobby's directory: a painted wooden signboard on two posts under a little roof, one coloured arrow plank per destination (pointing the way
// it lies as you face the board), each with its picture, so it reads at a glance. Drawn at 512 x 640 and redrawn once the round sign face has loaded.
const DIR_ROWS = [['Station', '🚆', 'up', '#3fa89c', '#23705f'], ['Airport', '✈️', 'left', '#4f9fe0', '#2a63a0'], ['Pune', '🛺', 'right', '#f08a3c', '#b0521a'], ['Glass Bridge', '🌉', 'down', '#e2a93a', '#9a6a14']];
function drawDirectory(g, W, H) {
  const F = (px) => `700 ${px}px "Fredoka", ${SIGN_FONT}`;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // the painted board: cream, with soft vertical grain and a darker rim
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff6e2'); bg.addColorStop(1, '#f6e2c0'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = .07; g.fillStyle = '#8a5a34'; for (let x = 0; x < W; x += 18) g.fillRect(x + ((x * 7) % 5), 0, 2, H); g.globalAlpha = 1;
  g.lineWidth = 14; g.strokeStyle = '#e2c49a'; g.strokeRect(7, 7, W - 14, H - 14);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  // the heading on a teal ribbon
  g.fillStyle = '#2f8f86'; g.beginPath(); g.moveTo(40, 50); g.lineTo(W - 40, 50); g.lineTo(W - 62, 92); g.lineTo(W - 40, 134); g.lineTo(40, 134); g.lineTo(62, 92); g.closePath(); g.fill();
  rr(70, 44, W - 140, 84, 22); g.fillStyle = '#4fb3a9'; g.fill();
  g.font = F(56); g.lineWidth = 10; g.strokeStyle = '#1f5f58'; g.strokeText('Welcome!', W / 2, 88); g.fillStyle = '#ffffff'; g.fillText('Welcome!', W / 2, 88);
  g.font = F(24); g.fillStyle = '#a07850'; g.fillText('TokenFall Lobby', W / 2, 160);
  // the arrow planks
  DIR_ROWS.forEach(([name, icon, dir, col, dk], i) => {
    const y = 196 + i * 106, h = 84, x0 = 40, x1 = W - 40, tip = 40;
    const plank = (dy) => {
      g.beginPath();
      if (dir === 'left') { g.moveTo(x0, y + dy + h / 2); g.lineTo(x0 + tip, y + dy); g.lineTo(x1 - 14, y + dy); g.arcTo(x1, y + dy, x1, y + dy + h, 14); g.arcTo(x1, y + dy + h, x0, y + dy + h, 14); g.lineTo(x0 + tip, y + dy + h); }
      else if (dir === 'right') { g.moveTo(x1, y + dy + h / 2); g.lineTo(x1 - tip, y + dy + h); g.lineTo(x0 + 14, y + dy + h); g.arcTo(x0, y + dy + h, x0, y + dy, 14); g.arcTo(x0, y + dy, x1, y + dy, 14); g.lineTo(x1 - tip, y + dy); }
      else rr(x0, y + dy, x1 - x0, h, 18);
      g.closePath();
    };
    plank(8); g.fillStyle = dk; g.fill();
    plank(0); const pg = g.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, col); pg.addColorStop(1, dk); g.fillStyle = col; g.fill(); g.globalAlpha = .25; g.fillStyle = pg; g.fill(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.28)'; rr(x0 + 22, y + 8, x1 - x0 - 44, 10, 5); g.fill();
    // the picture in a white disc, at the end the plank does not point to
    const ix = dir === 'right' ? x0 + 52 : dir === 'left' ? x1 - 52 : x0 + 52;
    g.beginPath(); g.arc(ix, y + h / 2, 30, 0, Math.PI * 2); g.fillStyle = '#fffaf0'; g.fill();
    g.font = '36px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(icon, ix, y + h / 2 + 2);
    // the name, and for up / down a round arrow badge
    let tx = (x0 + x1) / 2 + (dir === 'left' ? -16 : dir === 'right' ? 16 : 22);
    let fs = 40; g.font = F(fs); while (g.measureText(name).width > 250 && fs > 24) g.font = F(--fs);
    g.lineWidth = 8; g.strokeStyle = dk; g.strokeText(name, tx, y + h / 2 + 2); g.fillStyle = '#ffffff'; g.fillText(name, tx, y + h / 2 + 2);
    if (dir === 'up' || dir === 'down') {
      const bx = x1 - 46, by = y + h / 2; g.beginPath(); g.arc(bx, by, 24, 0, Math.PI * 2); g.fillStyle = '#fffaf0'; g.fill();
      g.beginPath(); const s = dir === 'up' ? -1 : 1; g.moveTo(bx, by + 13 * s); g.lineTo(bx - 13, by - 6 * s); g.lineTo(bx + 13, by - 6 * s); g.closePath(); g.fillStyle = dk; g.fill();
    }
  });
}
function vDirectory(x, z, name, talkLines) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640; const g = c.getContext('2d'); drawDirectory(g, 512, 640);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  if (document.fonts && document.fonts.load) document.fonts.load('700 40px "Fredoka"').then(() => { g.clearRect(0, 0, 512, 640); drawDirectory(g, 512, 640); t.needsUpdate = true; }).catch(() => {});
  const W = 1.5, H = 1.875, base = .55;
  for (const dx of [-W / 2 - .02, W / 2 + .02]) box(.14, base + H + .25, .14, MAT.darkWood, x + dx, 0, z);   // the two posts
  box(W + .16, H + .16, .1, MAT.darkWood, x, base - .08, z);                                                  // the frame behind the board
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: t, roughness: .8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .18 }));
  add(face, null, false); face.position.set(x, base + H / 2, z + .06);
  // a little gabled roof over it
  for (const s of [-1, 1]) { const r = box(W / 2 + .32, .07, .4, MAT.wood, x + s * (W / 4 + .1), base + H + .28, z); r.rotation.z = -s * .32; }
  box(.4, .3, .3, MAT.darkWood, x - W / 2 + .1, 0, z + .32); box(.4, .3, .3, MAT.darkWood, x + W / 2 - .1, 0, z + .32);   // two planter boxes at its foot
  colBox(x - W / 2 - .2, z - .2, x + W / 2 + .2, z + .5); contact(x, z, 1.2, .6);
  INTER.push({ x, z: z + 1.2, r: 1.4, label: name, verb: 'Read', act: () => talk(name, talkLines) });
}

// the lobby map: a park-style interpretive board on two legs, tilted back for reading, beside the directory. A drawn plan of the village (north up):
// the plaza and fountain in the middle, the station over the river, the airport west, Pune east, the pond and the Glass Bridge south, with a legend and a
// "you are here" pin. 768 x 480, redrawn once the sign face has loaded.
function drawLobbyMap(g, W, H) {
  const F = (w, px) => `${w} ${px}px "Fredoka", ${SIGN_FONT}`;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#4a2e36'; g.fillRect(0, 0, W, H);                                                    // the board's dark frame
  g.fillStyle = '#9cc84a'; g.fillRect(14, 14, W - 28, 50);                                           // the title strip
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = F(700, 30); g.fillStyle = '#2f4a12'; g.fillText('TOKENFALL LOBBY  ·  MAP', 30, 40);
  // the plan
  const mx = 24, my = 78, mw = 470, mh = 378; rr(mx, my, mw, mh, 10); g.fillStyle = '#f4efe2'; g.fill();
  g.save(); rr(mx, my, mw, mh, 10); g.clip();
  const zone = (x, y, w, h, c, r = 18) => { rr(mx + x, my + y, w, h, r); g.fillStyle = c; g.fill(); };
  g.fillStyle = '#7cc0e8'; g.beginPath(); g.moveTo(mx, my + 64); g.bezierCurveTo(mx + 150, my + 40, mx + 300, my + 92, mx + mw, my + 58); g.lineTo(mx + mw, my + 92); g.bezierCurveTo(mx + 300, my + 124, mx + 150, my + 72, mx, my + 98); g.closePath(); g.fill();   // the river
  zone(170, 8, 130, 46, '#e04a5a');                // the station, over the river
  zone(8, 120, 120, 170, '#f2b23a');               // the airport, west
  zone(342, 120, 120, 170, '#3fa89c');             // Pune, east
  zone(150, 128, 170, 150, '#ecdcc0', 75);         // the plaza
  g.beginPath(); g.arc(mx + 235, my + 203, 26, 0, Math.PI * 2); g.fillStyle = '#7cc0e8'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();   // the fountain
  zone(130, 300, 90, 60, '#7cc0e8', 30);           // the pond
  zone(250, 300, 110, 66, '#8f6ad8');              // the Glass Bridge, south
  g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round';                                    // the paths out of the plaza
  for (const [x0, y0, x1, y1] of [[235, 128, 235, 54], [150, 203, 128, 203], [320, 203, 342, 203], [270, 278, 300, 300]]) { g.beginPath(); g.moveTo(mx + x0, my + y0); g.lineTo(mx + x1, my + y1); g.stroke(); }
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = F(700, 20);
  for (const [t, x, y] of [['Station', 235, 31], ['Airport', 68, 205], ['Pune', 402, 205], ['Glass', 305, 324], ['Bridge', 305, 346]]) g.fillText(t, mx + x, my + y);
  g.fillStyle = '#7a5a3a'; g.font = F(600, 15); g.fillText('Plaza', mx + 235, my + 250); g.fillText('Pond', mx + 175, my + 330);
  // you are here: a red pin at the south-west of the plaza
  const px = mx + 196, py = my + 262; g.beginPath(); g.arc(px, py - 16, 11, 0, Math.PI * 2); g.moveTo(px - 10, py - 12); g.lineTo(px, py + 2); g.lineTo(px + 10, py - 12); g.fillStyle = '#e8322a'; g.fill(); g.beginPath(); g.arc(px, py - 16, 4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  g.restore();
  // the compass
  g.fillStyle = '#4a2e36'; g.font = F(700, 16); g.fillText('N', mx + mw - 24, my + mh - 46); g.beginPath(); g.moveTo(mx + mw - 24, my + mh - 38); g.lineTo(mx + mw - 31, my + mh - 18); g.lineTo(mx + mw - 17, my + mh - 18); g.closePath(); g.fill();
  // the legend
  const lx = 512; g.textAlign = 'left';
  [['#e04a5a', 'Station', 'Trains to Bengaluru'], ['#f2b23a', 'Airport', 'Flights to Pleasanton'], ['#3fa89c', 'Pune', 'Crescent Bay · ABZ'], ['#8f6ad8', 'Glass Bridge', 'Guess the right tile'], ['#ecdcc0', 'Plaza', 'Fountain · leaderboard']].forEach(([c, t, sub], i) => {
    const y = 92 + i * 66; g.fillStyle = c; g.fillRect(lx, y, W - lx - 26, 6);
    rr(lx, y + 16, 22, 22, 5); g.fill(); g.fillStyle = '#ffffff'; g.font = F(700, 21); g.fillText(t, lx + 32, y + 28);
    g.fillStyle = '#d9c3cb'; g.font = F(500, 15); g.fillText(sub, lx + 32, y + 50);
  });
  g.fillStyle = '#e8322a'; g.beginPath(); g.arc(lx + 11, 438, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.font = F(700, 19); g.fillText('You are here', lx + 32, 439);
}
// the board's face around the illustrated map: a wooden frame with corner bolts, a green title strip with a pin, the map, and a "press E" tag
// the board's plain map: sea, a green island, the river, sandy paths to the four places, each a big coloured disc with its name, and the pin
function simpleMap(g, x, y, w, h) {
  const F = (px) => `700 ${px}px "Fredoka", ${SIGN_FONT}`, cx = x + w / 2, cy = y + h / 2 + 4, RX = w * .44, RY = h * .41;
  const rr = (px, py, pw, ph, r) => { g.beginPath(); g.moveTo(px + r, py); g.arcTo(px + pw, py, px + pw, py + ph, r); g.arcTo(px + pw, py + ph, px, py + ph, r); g.arcTo(px, py + ph, px, py, r); g.arcTo(px, py, px + pw, py, r); g.closePath(); };
  // sea with a few wave ticks
  g.fillStyle = '#9fd8f2'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
  for (const [a, b] of [[.08, .12], [.86, .18], [.1, .85], [.9, .82], [.5, .06], [.32, .93]]) { g.beginPath(); g.arc(x + w * a, y + h * b, 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  // the island: a soil edge under a grass top, a lighter meadow
  g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(cx, cy + 12, RX, RY, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5e9a2e'; g.beginPath(); g.ellipse(cx, cy + 5, RX, RY, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9ed35a'; g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b4e070'; g.beginPath(); g.ellipse(cx - RX * .45, cy - RY * .45, RX * .3, RY * .18, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(cx + RX * .5, cy + RY * .5, RX * .28, RY * .16, 0, 0, Math.PI * 2); g.fill();
  // the river and its bridge
  const rv = (t) => [x + w * (.13 + .74 * t), cy - RY * .55 - Math.sin(t * Math.PI * 2) * 10 + (t - .5) * 10];
  g.strokeStyle = '#3e9fd8'; g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); for (let t = 0; t <= 1.001; t += .05) { const [px, py] = rv(t); t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  g.strokeStyle = '#7cc8f0'; g.lineWidth = 6; g.stroke();
  // paths from the plaza, with a darker edge
  const ends = { Station: [cx, cy - RY * .82], Airport: [cx - RX * .8, cy], Pune: [cx + RX * .8, cy], 'Glass Bridge': [cx, cy + RY * .8] };
  for (const [wd, col] of [[18, '#e2b06a'], [12, '#f8d8a0']]) { g.strokeStyle = col; g.lineWidth = wd; for (const k in ends) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(ends[k][0], ends[k][1]); g.stroke(); } }
  const [bx, by] = [cx, rv(.5)[1]]; g.fillStyle = '#a0683a'; g.fillRect(bx - 14, by - 13, 28, 26); g.fillStyle = '#c8915a'; for (let k = -10; k <= 10; k += 5) g.fillRect(bx - 14, by + k - 1, 28, 2.5);
  // little buildings: the station, cafe, homes; the pond; the tower block
  const house = (hx, hy, bw, bh, wall, roof) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(hx - bw / 2 + 3, hy - bh + 4, bw, bh); g.fillStyle = wall; g.fillRect(hx - bw / 2, hy - bh, bw, bh); g.fillStyle = roof; g.beginPath(); g.moveTo(hx - bw / 2 - 4, hy - bh); g.lineTo(hx, hy - bh - bw * .45); g.lineTo(hx + bw / 2 + 4, hy - bh); g.fill(); g.fillStyle = '#5a3a2a'; g.fillRect(hx - 3, hy - 9, 6, 9); };
  { const hx = cx + 46, hy = cy - RY * .8; g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(hx - 13, hy - 40, 30, 44); g.fillStyle = '#d8d4cc'; g.fillRect(hx - 16, hy - 44, 30, 44); g.fillStyle = '#e04a5a'; g.fillRect(hx - 16, hy - 48, 30, 6); g.fillStyle = '#7ab8e0'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(hx - 12 + c * 9, hy - 40 + r * 9, 6, 6); }
  house(cx + RX * .4, cy - RY * .12, 26, 16, '#f6e2c0', '#c0503a'); g.fillStyle = '#e04a5a'; for (let k = 0; k < 4; k++) g.fillRect(cx + RX * .4 - 13 + k * 7, cy - RY * .12 - 18, 4, 4);   // Token Brew
  house(cx - RX * .42, cy + RY * .2, 20, 14, '#f6e2c0', '#d06b4a'); house(cx - RX * .25, cy + RY * .32, 20, 14, '#f6e2c0', '#6a7cc0');
  g.fillStyle = '#e8b04a'; for (let k = 0; k < 5; k++) g.fillRect(cx - RX * .38 - 6, cy - RY * .3 - k * 7, 14, 6); g.strokeStyle = '#a0701a'; g.lineWidth = 1; for (let k = 0; k < 5; k++) g.strokeRect(cx - RX * .38 - 6, cy - RY * .3 - k * 7, 14, 6);   // Token Tower
  g.fillStyle = '#3e9fd8'; g.beginPath(); g.ellipse(cx - RX * .55, cy + RY * .52, 26, 13, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7fbf4a'; g.beginPath(); g.arc(cx - RX * .55 - 8, cy + RY * .52, 4, 0, Math.PI * 2); g.fill();
  // trees round the edge
  const tree = (tx, ty) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(tx + 2, ty + 2, 8, 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(tx - 1.5, ty - 6, 3, 7); g.fillStyle = '#3f8f3a'; g.beginPath(); g.arc(tx, ty - 11, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5fb04c'; g.beginPath(); g.arc(tx - 2.5, ty - 13, 4, 0, Math.PI * 2); g.fill(); };
  for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2 + .1, r = .78 + ((k * 37) % 10) / 70; const tx = cx + Math.cos(a) * RX * r, ty = cy + Math.sin(a) * RY * r; if (Math.abs(Math.cos(a)) > .95 || Math.abs(Math.sin(a)) > .93) continue; tree(tx, ty); }
  for (const [a, b] of [[.25, .45], [-.3, -.6], [.6, .3], [-.65, -.15], [.15, .62], [-.1, -.35]]) tree(cx + RX * a, cy + RY * b);
  // the plaza and fountain
  g.fillStyle = '#efd6a6'; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d6b27a'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#4fb0e6'; g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
  // the portals at the ends of the paths, then their name tags
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [t, col] of [['Station', '#e04a5a'], ['Airport', '#f0a030'], ['Pune', '#3fae55'], ['Glass Bridge', '#8f6ad8']]) {
    const [px, py] = ends[t];
    if (t !== 'Station') { g.fillStyle = col; g.globalAlpha = .35; g.beginPath(); g.ellipse(px, py, 18, 9, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.ellipse(px, py, 14, 7, 0, 0, Math.PI * 2); g.stroke(); }
    g.font = F(19); const tw = g.measureText(t).width + 26, ty = t === 'Glass Bridge' ? py + 22 : py - 26;
    g.fillStyle = 'rgba(0,0,0,.2)'; rr(px - tw / 2, ty - 14, tw, 32, 16); g.fill();
    g.fillStyle = col; rr(px - tw / 2, ty - 17, tw, 32, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.fillText(t, px, ty - 1);
  }
  // you are here
  const px = cx - 30, py = cy + 40; g.fillStyle = '#e8322a'; g.beginPath(); g.arc(px, py - 14, 10, 0, Math.PI * 2); g.moveTo(px - 9, py - 10); g.lineTo(px, py + 2); g.lineTo(px + 9, py - 10); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py - 14, 4, 0, Math.PI * 2); g.fill();
}
function drawBoardArt(g, W, H) {
  const F = (w, px) => `${w} ${px}px "Fredoka", ${SIGN_FONT}`;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const wood = g.createLinearGradient(0, 0, 0, H); wood.addColorStop(0, '#8a5a34'); wood.addColorStop(1, '#5e3a20'); g.fillStyle = wood; g.fillRect(0, 0, W, H);
  g.globalAlpha = .12; g.fillStyle = '#2a160a'; for (let y = 4; y < H; y += 9) g.fillRect(0, y + ((y * 13) % 4), W, 1.5); g.globalAlpha = 1;
  for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = '#d9c09a'; g.fill(); g.beginPath(); g.arc(x - 1, y - 1, 2, 0, Math.PI * 2); g.fillStyle = '#fff3dc'; g.fill(); }
  // the title strip
  rr(26, 22, W - 52, 54, 14); g.fillStyle = '#7cbf3a'; g.fill(); rr(26, 22, W - 52, 54, 14); g.lineWidth = 4; g.strokeStyle = '#4f8a22'; g.stroke();
  g.beginPath(); g.arc(58, 49, 13, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.moveTo(58, 58); g.lineTo(51, 47); g.arc(58, 45, 7, Math.PI * .85, Math.PI * .15); g.closePath(); g.fillStyle = '#e8322a'; g.fill();
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = F(700, 30); g.lineWidth = 6; g.strokeStyle = '#3c6e18'; g.lineJoin = 'round'; g.strokeText('TokenFall Lobby Map', 82, 50); g.fillStyle = '#ffffff'; g.fillText('TokenFall Lobby Map', 82, 50);
  // the map, cropped from the illustration's middle, on a cream mat
  const mx = 26, my = 88, mw = W - 52, mh = H - 114; rr(mx, my, mw, mh, 16); g.fillStyle = '#fff8ec'; g.fill();
  g.save(); rr(mx + 6, my + 6, mw - 12, mh - 12, 12); g.clip();
  simpleMap(g, mx + 6, my + 6, mw - 12, mh - 12);
  g.restore();
  // press E
  g.font = F(700, 18); const tw = g.measureText('Press E for the full map').width + 30; rr(W - 36 - tw, H - 50, tw, 32, 16); g.fillStyle = 'rgba(40,24,16,.85)'; g.fill();
  g.fillStyle = '#ffe9b8'; g.textAlign = 'center'; g.fillText('Press E for the full map', W - 36 - tw / 2, H - 33);
}
function vLobbyMap(x, z, ry) {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 960; const g = c.getContext('2d'); g.scale(2, 2); drawLobbyMap(g, 768, 480);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  // once the sign face has loaded, the board shows the same illustrated map as the full-screen one (world-map.js), framed as a park board
  // the board keeps it simple from a distance: a few big shapes and names; the full illustrated map opens with E (world-map.js)
  if (document.fonts && document.fonts.load) document.fonts.load('700 30px "Fredoka"').then(() => {
    g.clearRect(0, 0, 768, 480); drawBoardArt(g, 768, 480, null); t.needsUpdate = true;
  }).catch(() => {});
  const grp = vGroup(x, z, ry), W = 2.2, H = 1.375;
  for (const dx of [-W / 2 + .2, W / 2 - .2]) gbox(grp, .08, 1.05, .08, MAT.metal, dx, 0, 0);                  // the two legs
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + .06, H + .06, .06), [MAT.darkWood, MAT.darkWood, MAT.darkWood, MAT.darkWood, new THREE.MeshStandardMaterial({ map: t, roughness: .75, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .15 }), MAT.darkWood]);
  board.position.set(0, 1.05 + Math.sin(.5) * H / 2 - .1, .2); board.rotation.x = -.5; board.castShadow = true; grp.add(board);   // tilted back, like a park board
  colBox(x - W / 2, z - .4, x + W / 2, z + .4); contact(x, z, 1.3, .5);
  INTER.push({ x, z: z + 1.3, r: 1.5, label: 'Lobby map', verb: 'Open map', act: () => WorldMap.open() });   // the full-screen isometric map (world-map.js)
}

// the lobby's fingerpost: a weathered wooden post with a capped top and a brass knob, and four arrow arms pointing the real way to each place
// (the station north, Airport west, Pune east, the Glass Bridge south), each with a cream name plate carved in dark letters on both faces. The whole
// post is turned a little so every arm shows a face to the camera, the way a photo of one catches it.
function fingerLabel(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = '#f4ecdc'; g.beginPath(); g.roundRect ? g.roundRect(6, 10, 500, 108, 16) : g.rect(6, 10, 500, 108); g.fill();
    g.strokeStyle = 'rgba(80,60,40,.35)'; g.lineWidth = 4; g.stroke();
    let fs = 78; const font = () => `700 ${fs}px "Fredoka", ${SIGN_FONT}`; g.font = font(); while (g.measureText(text).width > 460 && fs > 40) { fs -= 2; g.font = font(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(text, 257, 69);   // the carved edge catching the light
    g.fillStyle = '#2b2620'; g.fillText(text, 256, 66);
  };
  draw(); const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  if (document.fonts && document.fonts.load) document.fonts.load('700 60px "Fredoka"').then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return t;
}
function vFingerpost(x, z, name, talkLines) {
  const grp = vGroup(x, z, .55), H = 3.1;
  const wood = MAT.wood, dark = MAT.darkWood;
  gbox(grp, .26, H, .26, wood, 0, 0, 0);                                                       // the post
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.26, .2, 4), dark); cap.rotation.y = Math.PI / 4; cap.position.y = H + .1; cap.castShadow = true; grp.add(cap);
  gbox(grp, .36, .06, .36, dark, 0, H - .02, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: .4, metalness: .3 })); knob.position.y = H + .26; grp.add(knob);
  // one arm: an arrow board 1.55 m long, pointed at its far end, along the arm's own +x; name plates on both faces
  const L = 1.55, T = .34, D = .07, shape = new THREE.Shape();
  shape.moveTo(-.12, -T / 2); shape.lineTo(L - .26, -T / 2); shape.lineTo(L, 0); shape.lineTo(L - .26, T / 2); shape.lineTo(-.12, T / 2); shape.closePath();
  const armGeo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }); armGeo.translate(0, 0, -D / 2);
  // [text, the world direction it points (rad: 0 east, PI/2 north, PI west, -PI/2 south), height]
  for (const [text, dir, y] of [['Station', Math.PI / 2, 2.78], ['Pune', 0, 2.5], ['Airport', Math.PI, 2.16], ['Glass Bridge', -Math.PI / 2, 1.88]]) {
    const arm = new THREE.Group(); arm.rotation.y = dir - .55; arm.position.y = y; grp.add(arm);
    const board = new THREE.Mesh(armGeo, wood); board.castShadow = true; arm.add(board);
    const lab = new THREE.MeshStandardMaterial({ map: fingerLabel(text), roughness: .85, transparent: true });
    const plate = (side) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.08, .27), lab); m.position.set(.2 + .54, 0, side * (D / 2 + .016)); if (side < 0) { m.rotation.y = Math.PI; m.position.x = .2 + .54; } arm.add(m); };
    plate(1); plate(-1);
  }
  colCirc(x, z, .3); contact(x, z, .5, .5);
  INTER.push({ x, z: z + 1.2, r: 1.4, label: name, verb: 'Read', act: () => talk(name, talkLines) });
}

function vEvBay() {
  const ch = (x, z) => { box(.4, 1.5, .3, MAT.metal, x, 0, z); box(.3, .3, .04, MAT.screen, x, 1, z + .16, { cast: false }); box(.42, .06, .32, vGlow(V_LED), x, 1.5, z, { cast: false }); colBox(x - .25, z - .2, x + .25, z + .2); };
  ch(29.9, -7.2);
  sportsCar('cybertruck', 32.3, -6.2, Math.PI / 2);   // on charge; solid to the edges of its own 5.7 m body
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
  pointLight('lobby', 0xffe2b8, .9, 6, x, 2.4, z);
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
    if (vWater(x, z, 1.5) || (Math.abs(x) < 12 && z < -40 && z > -60) || (z < -48 && z > -53) || vInRect(V_STATION, x, z, 1.5)) continue;   // nor on the railway or the station (station.js)
    tree(x, z, rr(1, 1.6), leaves[rnd() * 3 | 0], false); n++;
  }
  for (let i = 0, n = 0; i < 1200 && n < 120; i++) {
    const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF), edge = vPaved(x, z, 2.4) && !vPaved(x, z, .9);
    if ((edge || rnd() < .3) && vClear(x, z, .7)) { bush(x, z, rr(.7, 1.1), leaves[rnd() * 3 | 0]); n++; }
  }
  for (let i = 0; i < 30; i++) { const x = rr(-V_HALF, V_HALF), z = rr(-V_HALF, V_HALF); if (vClear(x, z, .8)) { const m = add(new THREE.Mesh(jitterSphere(rr(.4, .9), 1), MAT.stone)); m.position.set(x, .2, z); colCirc(x, z, .5); } }
  for (const [x, z] of [V_PLANTER]) {
    // a lathe, so the rim has the kerb's rounded top edge (radius .07, in the same steps)
    const bed = lathe([[1.85, 0], [1.8, .38], ...arc(1.73, .38, .07, 0, Math.PI / 2, 6), [0, .45]], stoneRoundMaterial({ c: [x, z], n: 12, h: .45, y0: 0, rows: [.9, 1.35, 1.8] }), 24); bed.position.set(x, 0, z);
    bush(x - .4, z + .1, 1, MAT.leafC); tree(x + .3, z - .2, .7, MAT.blossom, false); colCirc(x, z, 1.9);
  }
}

function vGrass(edgeAt) {
  // Clumps sit where something meets the lawn: just off a path, a wall, a fence, a trunk or a prop (the shade map says where), in small deliberate groups at least 2.4 m apart, with open grass between.
  // Each group is two blade clumps; every third one also has clover, a flower colour (cream, blush, butter, lilac in turn) or a fern. About half the count the lawn had before.
  const open = (x, z) => !(vPaved(x, z, .3) || vWater(x, z, .3) || vInRect(V_STATION, x, z, .3) || (walkable(x, z) && blocked(x, z, -.1)));
  const spots = [];
  for (let i = 0; i < 9000 && spots.length < 110; i++) {
    const x = rr(-V_ISLAND + 2, V_ISLAND - 2), z = rr(-V_ISLAND + 2, V_ISLAND - 2), e = edgeAt(x, z);
    if (e < .3 || e > .85 || !open(x, z) || spots.some((q) => (q[0] - x) ** 2 + (q[1] - z) ** 2 < 5.8)) continue;
    spots.push([x, z]);
  }
  // pick(): `per` plants close round each spot in turn (a few stay put if the ground there is not open)
  const around = (pts, per, spread) => { let k = 0; return () => { const m = pts[(k++ / per | 0) % pts.length]; if (!m) return null; const a = rnd() * 6.283, d = spread * Math.sqrt(rnd()), x = m[0] + Math.cos(a) * d, z = m[1] + Math.sin(a) * d; return open(x, z) ? [x, z] : null; }; };
  const every = (n, r) => spots.filter((_, i) => i % n === r);
  scatter(TX.grassTuft, spots.length * 2, .75, around(spots, 2, .55), true, true);
  scatter(TX.clover, every(3, 1).length * 2, .45, around(every(3, 1), 2, .5), true);
  scatter(TX.fern, every(3, 2).length, .6, around(every(3, 2), 1, .3), true, true);
  const fl = every(3, 0); TX.flowers.forEach((ft, c) => { const pts = fl.filter((_, i) => i % 4 === c); scatter(ft, pts.length * 4, .5, around(pts, 4, .5)); });
}

// Soft shade where the lawn meets something: paths and the plaza, walls, trunks and posts (every collider), the river and pond. Baked once, after the lobby is dressed, into the map the grass shader reads
// (GRASS_U.uEdge, geometry.js): 1 at the edge, easing to 0 a metre or two out, so detail and shade gather there and the open middle stays calm.
function vGrassShade() {
  const N = 384, S = 2 * V_ISLAND, k = N / S, a = new Float32Array(N * N);
  const splat = (x0, z0, x1, z1, R, amp, dist) => {   // dist(x, z): how far a point is from the shape (0 inside); x0..z1 is its bounding box
    const i0 = Math.max(0, Math.floor((x0 - R + V_ISLAND) * k)), i1 = Math.min(N - 1, Math.ceil((x1 + R + V_ISLAND) * k));
    const j0 = Math.max(0, Math.floor((z0 - R + V_ISLAND) * k)), j1 = Math.min(N - 1, Math.ceil((z1 + R + V_ISLAND) * k));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = 1 - dist((i + .5) / k - V_ISLAND, (j + .5) / k - V_ISLAND) / R;
      if (t > 0) a[j * N + i] = Math.max(a[j * N + i], amp * t * t * (3 - 2 * t));
    }
  };
  const rect = (x0, z0, x1, z1, R, amp) => splat(x0, z0, x1, z1, R, amp, (x, z) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)));
  const disc = (cx, cz, r, R, amp) => splat(cx - r, cz - r, cx + r, cz + r, R, amp, (x, z) => Math.max(0, Math.hypot(x - cx, z - cz) - r));
  rect(...V_PLAZA, 1.7, 1); for (const r of V_ROADS) rect(...r, 1.7, 1);
  for (const [px, pz, w, d] of V_PATHS) rect(px - w / 2, pz - d / 2, px + w / 2, pz + d / 2, 1.4, .9);
  rect(...V_RIVER, 1.3, .8); disc(V_POND[0], V_POND[1], V_POND[2], 1.3, .8);
  for (const c of COL) {
    if (c.r !== undefined) disc(c.x, c.z, c.r, 1.1, .85);
    else if (c.ex !== undefined) disc(c.ex, c.ez, Math.min(c.rx, c.rz), 1.1 + Math.abs(c.rx - c.rz), .85);
    else rect(c.x0, c.z0, c.x1, c.z1, Math.min(c.x1 - c.x0, c.z1 - c.z0) > 3 ? 1.8 : 1.1, c.x1 - c.x0 > 3 ? 1 : .85);
  }
  const px = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) px[i * 4] = Math.round(255 * a[i]);
  const tex = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  GRASS_U.uEdge.value = tex; GRASS_U.uBox.value.set(-V_ISLAND, -V_ISLAND, S);
  return (x, z) => { const i = Math.floor((x + V_ISLAND) * k), j = Math.floor((z + V_ISLAND) * k); return i < 0 || j < 0 || i >= N || j >= N ? 0 : a[j * N + i]; };   // the shade at a point, 0-1
}

function buildVillageLobby() {
  contactOn = true;   // props.js: record contact shading and lamp pools while the lobby builds
  vGround();
  WALK.push([-V_HALF, -47.5, V_HALF, V_HALF]);
  vRiverAndBridge();
  vPond();
  vStation();   // the railway station, where HQ's locked doors were (station.js)
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
  vLobbyMap(-3.9, 10.9, 0);   // on the grass corner where the south road leaves the plaza (road edge x -2.6, plaza edge z 10)
  vFingerpost(-6.4, 11.6, 'Signpost', ['Welcome to TokenFall!', 'West, past the food stalls: the airport, with flights to the Calfus US office in Pleasanton. East, past Token Brew: Pune, home of the Calfus office. South, past the pond: the Glass Bridge. North, over the river: the station, with trains to the Calfus Bengaluru office.', 'The lawn in front of Home has two games: Token Tower and Spot Shot. The carrom table is in the HQ office, through Pune.', 'Token Brew is short-staffed! Take a shift in the kitchen, through the staff door at the cafe: pack the pot light, leave room for the reply, never reuse a pot between customers.', 'The leaderboard by the plaza shows who has the most correct answers.']);
  vTotem(5.6, 11.4, 'AI TIP', ['Sounding sure is not the same as being right.'], 'AI Tips', V_AI_TIPS);

  gate(-40, 0, Math.PI / 2, 'Airport', 0xffb347, 'lobby', 'airport');
  gate(40, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');
  gate(0, 40, 0, 'The Glass Bridge', 0xffd27a, 'lobby', 'bridge'); sparkles(0, 40, 0xffd27a, 34, 1.3, 3.6);
  ledSign(['▼ The Glass Bridge'], '#ffe39a', 0, 5.4, 40, 3.8, .55);

  vPathLights();
  vRobots();
  vFoliage();
  vSmokePoints();
  vGrass(vGrassShade());
  flushContacts();
  if (new URLSearchParams(location.search).get('board') === 'sample') useSampleBoard();
  // everything built after the lobby continues from a fixed seed, so redesigning the lobby never reshuffles the other zones
  seed = SEED_AFTER_LOBBY;
}

const VILLAGE = {
  build: buildVillageLobby, spawn: V_SPAWN, spawnDir: 'up', npcBounds: [-11, -9, 11, 9],
  returns: { airport: [-37, 0], pune: [37, 0], bridge: [0, 37], blr: [.29, -47.7] },   // blr: off the train, on the station platform (station.js)
  petals: [[-10.6, -8.6], [-17, 12]], lightPoles: [],
  dof: { farStart: 14, farRange: 50, edgeBlur: .25 },
  minigameSpots: V_GAME_SPOTS,
};
