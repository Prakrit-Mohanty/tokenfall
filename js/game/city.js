// TokenFall: the city around the Pune block: a skyline and streets beyond it, traffic with lights at the junction,
// street details (crossings, median, bus stop, bins, bollards) and greenery. Built inside withSideRandom so the
// shared rnd() sequence, and so every other random placement in the game, stays exactly as it was.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// runs fn with rnd() as usual, then rewinds the seed so code after it sees the same numbers as if fn never ran
function withSideRandom(fn) { const s0 = seed; try { return fn(); } finally { seed = s0; } }

const SHOP_NAMES = ['Chai & Snacks', 'Xerox · Stationery', 'Medical', 'Misal House', 'Mobile Repair', 'Bakery', 'Juice Centre', 'Kirana Store'];
const HOARDINGS = [['TokenFall', 'learn AI, one token at a time'], ['Now hiring', 'AI engineers · Pune']];
const LIGHT_CYCLE = 20;
const CROSS_Z = 28.5;

// the city: ground, a cross street behind the block, rows of offices, apartments and shops, a taller skyline row
function cityBackdrop(cx, cz, asphalt) {
  plane(280, 210, std(TX.concrete, 1.5, { roughness: 1, color: 0x8a8c90 }), cx + 7, -.012, cz - 20, 1.5);
  plane(116, 6, asphalt, cx + 7, .02, cz - CROSS_Z, 1.5); plane(6, 40, asphalt, cx + 14.5, .02, cz - 50, 1.5);
  for (const s2 of [-3.9, 3.9]) plane(116, 1.8, MAT.paver, cx + 7, .024, cz - CROSS_Z + s2, 3);
  const row = (xs, front, hMin, hMax, shops) => xs.forEach(([x, w]) => {
    const d = rr(9, 13), h = rr(hMin, hMax), zc = cz + front - d / 2;
    if (rnd() < .5) officeBlock(cx + x, zc, w, d, h, { front: rnd() < .5 ? MAT.glass : MAT.glassLit, side: [MAT.concrete, MAT.plaster, MAT.cladding][rnd() * 3 | 0], collide: false });
    else apartment(cx + x, zc, w, d, h);
    if (shops) shopRow(cx + x, cz + front, w);
  });
  row([[-44, 10], [-32, 10], [-20, 11], [-8, 10], [4, 11], [24, 10], [36, 11], [48, 10], [60, 10]], -(CROSS_Z + 5), 9, 22, true);
  row([[-40, 12], [-22, 12], [-2, 14], [30, 12], [52, 13]], -(CROSS_Z + 21.5), 18, 34, false);
  for (const z of [-12, 0, 12, 24]) { const d = 8; officeBlock(cx - 44, cz + z - d / 2, 9, d, rr(8, 16), { side: MAT.plaster, collide: false }); apartment(cx + 53, cz + z - d / 2, 9, d, rr(10, 20)); }
  HOARDINGS.forEach(([a, b], i) => hoarding(cx + [-13.75, 29.75][i], cz - CROSS_Z - 3.9, [a, b]));
}

// a Pune apartment block: plaster body, a balcony slab and a row of windows per floor, water tanks on the roof
function apartment(x, z, w, d, h) {
  const front = z + d / 2, floors = Math.max(3, Math.round(h / 3));
  box(w, h, d, MAT.plaster, x, 0, z);
  for (let i = 1; i < floors; i++) {
    const y = i * h / floors;
    box(w + .3, .14, .9, MAT.concrete, x, y - .07, front + .4);
    for (let k = 0; k < Math.floor(w / 2.2); k++) box(.9, 1.1, .06, rnd() < .35 ? MAT.glassLit : MAT.glass, x - w / 2 + 1.1 + k * 2.2, y - 1.7, front + .03, { cast: false, s: 0 });
  }
  for (let k = 0; k < 2; k++) { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .9, 10), MAT.charcoal || MAT.metal)); t.position.set(x - w / 4 + k * w / 2, h + .45, z); }
}

// shopfronts along a building's ground floor (facing +z): lit glass, a striped awning and a name board
function shopRow(x, front, w) {
  const n = Math.max(1, Math.floor(w / 4.5)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const sx = x - w / 2 + sw * (i + .5);
    box(sw - .3, 2.2, .06, rnd() < .7 ? MAT.glassLit : MAT.metal, sx, .3, front + .04, { cast: false, s: 0 });
    box(sw - .2, .1, 1, MAT.awning, sx, 2.6, front + .5);
    signBoard(SHOP_NAMES[rnd() * SHOP_NAMES.length | 0], sx, 3.05, front + .08, sw - .5, .42, 0, { size: 18, bg: ['#7a2a24', '#24527a', '#2a6a3a', '#6a4a1a'][rnd() * 4 | 0], color: '#fff3d0', w: 200, h: 40 });
  }
}

// a unipole hoarding standing in the gap between two buildings, its board above the rooftops
function hoarding(x, z, lines) {
  box(.4, 23.2, .4, MAT.metal, x, 0, z); box(4.8, .16, .5, MAT.metal, x, 23.1, z);
  ledSign(lines, '#ffe9a8', x, 24.2, z, 4.6, 1.6, 0, [256, 96], PLAIN);
}

// zebra crossings on the four arms of the junction at (jx, jz); roads are 6 m wide
function crossings(jx, jz) {
  for (let i = 0; i < 6; i++) {
    const t = -2.5 + i;
    for (const s2 of [-1, 1]) {
      box(2.4, .015, .5, MAT.white, jx + s2 * 5.3, .022, jz + t, { cast: false });
      box(.5, .015, 2.4, MAT.white, jx + t, .022, jz + s2 * 5.3, { cast: false });
    }
  }
}

// a planted median down the main road, broken at the junction
function median(x0, x1, z) {
  const len = x1 - x0, mx = (x0 + x1) / 2;
  box(len, .2, .9, MAT.concrete, mx, 0, z, { cast: false }); plane(len - .2, .7, MAT.grass, mx, .21, z, 2);
  for (let x = x0 + 1.5; x < x1 - 1; x += 3) bush(x, z, .55);
}

function busStop(x, z) {
  for (const dx of [-1.5, 1.5]) box(.08, 2.4, .08, MAT.metal, x + dx, 0, z + .5);
  box(3.3, .08, 1.4, MAT.metal, x, 2.4, z); box(3.2, 1.9, .05, MAT.pane, x, .45, z - .55, { cast: false });
  box(2.4, .08, .45, MAT.wood, x, .45, z - .25); for (const dx of [-1, 1]) box(.06, .45, .4, MAT.metal, x + dx, 0, z - .25);
  ledSign(['PMPML · Bus Stop'], '#ffd27a', x, 2.75, z + .5, 2.6, .36, 0, [256, 40], PLAIN);
  colBox(x - 1.65, z - .65, x + 1.65, z + .2);
  INTER.push({ x, z: z + 1.1, r: 1.6, label: 'Bus Stop', verb: 'Read', act: () => talk('Bus Stop', ['PMPML buses to Baner, Hinjewadi and Swargate.', 'Next bus: whenever it feels like it.']) });
}

function bins(x, z) {
  for (const [dx, lid] of [[0, 0x2aa05a], [.55, 0x2f7de0]]) {
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .7, 12), MAT.metal)); b.position.set(x + dx, .35, z);
    const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .05, 12), new THREE.MeshStandardMaterial({ color: lid }))); l.position.set(x + dx, .72, z);
  }
  colBox(x - .3, z - .3, x + .85, z + .3);
}

function bollards(points) { for (const [x, z] of points) { box(.18, .8, .18, MAT.charcoal || MAT.metal, x, 0, z); box(.22, .06, .22, MAT.ledStrip || MAT.warmGlow, x, .7, z, { cast: false }); colCirc(x, z, .14); } }

function manholes(points) { for (const [x, z] of points) { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .02, 14), MAT.metal), null, false); m.position.set(x, .025, z); } }

// street trees on a grass verge along a straight pavement line; skip() leaves gaps for lights, stops and crossings
function avenue(axis, fixed, from, to, step, skip) {
  const len = to - from, mid = (from + to) / 2;
  axis === 'z' ? plane(.75, len, MAT.grass, fixed, .028, mid, 2) : plane(len, .75, MAT.grass, mid, .028, fixed, 2);
  for (let t = from + step / 2; t < to; t += step) {
    if (skip(t)) continue;
    const s = rr(.85, 1.1);
    axis === 'z' ? tree(fixed, t, s, [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0]) : tree(t, fixed, s, [MAT.leafA, MAT.leafB, MAT.leafC][rnd() * 3 | 0]);
  }
}

const traffic = { lanes: [], lights: null };

// ---- traffic: vehicles drive on the left along fixed lanes, stop at red, keep their distance and wait for you ----
function autoRickshaw(color) {
  const g = new THREE.Group(); scene.add(g);
  const yellow = new THREE.MeshStandardMaterial({ color, roughness: .5 }), black = MAT.charcoal || MAT.metal;
  box(1.3, .55, 2.2, black, 0, .25, -.1, { p: g }); box(1.1, .55, .5, yellow, 0, .3, 1.05, { p: g });
  box(1.36, .09, 1.95, yellow, 0, 1.55, -.15, { p: g }); for (const [dx, dz] of [[-.62, .75], [.62, .75], [-.62, -1.05], [.62, -1.05]]) box(.06, .75, .06, black, dx, .8, dz, { p: g });
  box(1.2, .5, .1, black, 0, .8, -1.1, { p: g });
  for (const [dx, dz] of [[0, 1.1], [-.55, -.8], [.55, -.8]]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .16, 10), black), g); w.rotation.z = Math.PI / 2; w.position.set(dx, .24, dz); }
  box(.5, .1, .05, glowStrip(0xfff0c0), 0, .45, 1.31, { p: g, cast: false });
  return g;
}

// a lane runs along `axis` at `fixed`; d is the travel direction (+1/-1); vehicles wrap from `from` to `to`
function lane(axis, fixed, d, from, to, stopAt, light, cars) {
  const L = { axis, fixed, d, from, to, stopAt, light, cars: [] };
  for (const [s, kind, color] of cars) {
    const g = kind === 'auto' ? autoRickshaw(color) : car(0, 0, 0, color, { collide: false });
    g.userData.dyn = true; compact(g);
    g.rotation.y = axis === 'z' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = { g, s, v: 0, cruise: kind === 'auto' ? 4.2 : 5.5, len: kind === 'auto' ? 2.8 : 4.4 };
    L.cars.push(v); place(L, v);
  }
  traffic.lanes.push(L);
  return L;
}
function place(L, v) { L.axis === 'z' ? v.g.position.set(L.fixed, 0, v.s) : v.g.position.set(v.s, 0, L.fixed); }

function trafficLights(jx, jz) {
  const mk = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .05, roughness: .4 });
  const heads = { ns: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)], ew: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)] };
  for (const [px, pz] of [[jx - 3.7, jz - 3.7], [jx + 3.7, jz + 3.7]]) {
    box(.14, 3, .14, MAT.metal, px, 0, pz); colCirc(px, pz, .15);
    for (const [key, ry] of [['ns', 0], ['ew', Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(px, 2.3, pz); g.rotation.y = ry; scene.add(g);
      box(.34, 1, .24, MAT.charcoal || MAT.metal, 0, 0, 0, { p: g });
      heads[key].forEach((m, i) => box(.2, .2, .04, m, 0, .78 - i * .3, .13, { p: g, cast: false }));
    }
  }
  traffic.lights = heads;
}

// light colour for a direction at time t: north-south green for 8 s, amber 2 s, then east-west
function lightState(dir, t) {
  const p = t % LIGHT_CYCLE, ns = p < 8 ? 'green' : p < 10 ? 'amber' : 'red', ew = p < 10 ? 'red' : p < 18 ? 'green' : 'amber';
  return dir === 'ns' ? ns : ew;
}

function stepTraffic(t, dt) {
  if (traffic.lights) for (const dir of ['ns', 'ew']) { const st = lightState(dir, t); ['red', 'amber', 'green'].forEach((c, i) => { traffic.lights[dir][i].emissiveIntensity = c === st ? 2.2 : .05; }); }
  for (const L of traffic.lanes) {
    const order = L.cars.slice().sort((a, b) => (b.s - a.s) * L.d);
    order.forEach((v, i) => {
      let target = v.cruise;
      const toStop = (L.stopAt - v.s) * L.d, st = lightState(L.light, t);
      if (st !== 'green' && toStop > 0 && toStop < 14 && !(st === 'amber' && toStop < 3)) target = Math.min(target, Math.max(0, toStop - .3) * 1.1);
      const ahead = order[i - 1];
      if (ahead) target = Math.min(target, Math.max(0, (ahead.s - v.s) * L.d - (ahead.len + v.len) / 2 - 1.2) * 1.2);
      if (hero && hero.zone === 'pune') {
        const lat = Math.abs((L.axis === 'z' ? hero.x : hero.y) - L.fixed), fwd = ((L.axis === 'z' ? hero.y : hero.x) - v.s) * L.d;
        if (lat < 1.6 && fwd > 0 && fwd < 7) target = 0;
      }
      v.v += Math.max(-8 * dt, Math.min(3 * dt, target - v.v));
      v.s += v.v * dt * L.d;
      if ((v.s - L.to) * L.d > 0) v.s = L.from;
      place(L, v);
    });
  }
}

// everything above, laid out round the existing block: east street at x = RX, main road at z = MZ
function buildCity(a, RX, MZ, asphalt) {
  const { cx, cz } = a;
  withSideRandom(() => {
    cityBackdrop(cx, cz, asphalt);
    crossings(RX, MZ);
    median(cx - 36, RX - 8, MZ); median(RX + 8, cx + 46, MZ);
    busStop(cx - 12, cz + 8.6);
    bins(cx - 9.4, cz + 8.4); bins(cx + 20.4, cz - .9);
    bollards([[cx + 20.6, cz - 4], [cx + 20.6, cz - 2.6]]);
    manholes([[RX - 1.2, cz - 8], [RX + 1.4, cz + 22], [cx - 20, MZ + 1.2], [cx + 32, MZ - 1.3]]);
    const lights = { w: [-14, -4, 6], e: [-11, 1], n: [-18, -6, 24, 34] };
    const near = (t, list, base, r = 2.4) => list.some(l => Math.abs(t - (base + l)) < r);
    const crossStreet = t => Math.abs(t - (cz - CROSS_Z)) < 5.5;
    avenue('z', RX - 3.4, cz - 34, cz + 34, 6.5, t => Math.abs(t - MZ) < 7.5 || crossStreet(t) || near(t, lights.w, cz));
    avenue('z', RX + 3.4, cz - 34, cz + 34, 6.5, t => Math.abs(t - MZ) < 7.5 || crossStreet(t) || near(t, lights.e, cz));
    avenue('x', MZ - 3.4, cx - 36, cx + 46, 7, t => Math.abs(t - RX) < 8 || near(t, lights.n, cx) || Math.abs(t - (cx - 12)) < 3);
    avenue('x', MZ + 3.4, cx - 36, cx + 46, 7, t => Math.abs(t - RX) < 8);
    for (let x = cx + 20.6; x < cx + 36.2; x += 1.1) if (Math.abs(x - (cx + 28.3)) > 2.4) bush(x, cz - .3, .5);
  });
  trafficLights(RX, MZ);
  lane('z', RX - 1.5, -1, cz + 34, cz - 58, MZ + 6.8, 'ns', [[cz + 1.5, 'car', 0xe8e8ec], [cz + 20, 'auto', 0xf2c418]]);
  lane('z', RX + 1.5, 1, cz - 58, cz + 34, MZ - 6.8, 'ns', [[cz - 5.5, 'car', 0x2a4f9e], [cz - 30, 'auto', 0xf2c418]]);
  lane('x', MZ + 1.5, -1, cx + 46, cx - 36, RX + 6.8, 'ew', [[cx - 8, 'car', 0xb02a2a], [cx + 30, 'auto', 0xf2c418], [cx + 6, 'car', 0xd8d4c8]]);
  lane('x', MZ - 1.5, 1, cx - 36, cx + 46, RX - 6.8, 'ew', [[cx + 26, 'car', 0x55595f], [cx - 24, 'car', 0x3a7a5a], [cx - 2, 'auto', 0xf2c418]]);
  life.push((t, dt) => stepTraffic(t, dt));
}
