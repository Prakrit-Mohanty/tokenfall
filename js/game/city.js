// TokenFall: city building blocks used by Pune (pune.js): apartments, the bus stop, bins, manholes,
// and traffic (autos and cars on lanes, signals at a junction). withSideRandom keeps the shared rnd() sequence unchanged.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// runs fn with rnd() as usual, then rewinds the seed so code after it sees the same numbers as if fn never ran
function withSideRandom(fn) { const s0 = seed; try { return fn(); } finally { seed = s0; } }

const SHOP_NAMES = ['Chai & Snacks', 'Xerox · Stationery', 'Medical', 'Misal House', 'Mobile Repair', 'Bakery', 'Juice Centre', 'Kirana Store'];
const LIGHT_CYCLE = 20;

// a Pune apartment block: plaster body, a balcony slab and a row of windows per floor, water tanks on the roof
function apartment(x, z, w, d, h) {
  const front = z + d / 2, floors = Math.max(3, Math.round(h / 3));
  box(w, h, d, MAT.plaster, x, 0, z);
  for (let i = 1; i < floors; i++) {
    const y = i * h / floors;
    box(w + .3, .14, .9, MAT.concrete, x, y - .07, front + .4);
    for (let k = 0; k < Math.floor(w / 2.2); k++) framedWindow(x - w / 2 + 1.1 + k * 2.2, y - 1.7, front, .9, 1.1, rnd() < .35 ? MAT.glassLit : MAT.glass, 1, decorRandom() < .3);
  }
  for (let k = 0; k < 2; k++) { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .9, 10), MAT.charcoal || MAT.metal)); t.position.set(x - w / 4 + k * w / 2, h + .45, z); }
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
  for (const [dx, lid] of [[0, PAL.sage], [.55, PAL.sky]]) {
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .7, 12), MAT.metal)); b.position.set(x + dx, .35, z);
    const l = add(new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .05, 12), new THREE.MeshStandardMaterial({ color: lid }))); l.position.set(x + dx, .72, z);
  }
  colBox(x - .3, z - .3, x + .85, z + .3);
}

function manholes(points) { for (const [x, z] of points) { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .02, 14), MAT.metal), null, false); m.position.set(x, .025, z); } }

const traffic = { lanes: [], lights: [], blockers: [] };

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

// a scooter, ridden or parked: o.rider adds a rider with a jacket and helmet in the given colours
function scooter(color, o = {}) {
  const g = new THREE.Group(); scene.add(g);
  const body = new THREE.MeshStandardMaterial({ color, roughness: .45 }), dark = MAT.charcoal || MAT.metal;
  box(.32, .3, 1.25, body, 0, .28, 0, { p: g }); box(.34, .52, .3, body, 0, .28, .53, { p: g }); box(.28, .12, .66, dark, 0, .58, -.15, { p: g });
  box(.56, .05, .05, MAT.metal, 0, 1.02, .6, { p: g }); box(.05, .44, .05, MAT.metal, 0, .6, .63, { p: g });
  box(.16, .08, .04, glowStrip(0xfff0c0), 0, .74, .69, { p: g, cast: false }); box(.16, .05, .04, glowStrip(0xff3020), 0, .52, -.64, { p: g, cast: false });
  for (const z of [-.48, .52]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .12, 12), dark), g); w.rotation.z = Math.PI / 2; w.position.set(0, .23, z); }
  if (!o.rider) return g;
  const jacket = new THREE.MeshStandardMaterial({ color: o.jacket, roughness: .7 }), helmet = new THREE.MeshStandardMaterial({ color: o.helmet, roughness: .4 }), skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: .7 });
  const r = new THREE.Group(); r.position.set(0, .66, .05); g.add(r);
  box(.34, .2, .48, dark, 0, 0, 0, { p: r }); box(.4, .54, .3, jacket, 0, .2, .05, { p: r });
  for (const s of [-1, 1]) box(.1, .38, .1, jacket, s * .23, .4, .25, { p: r });
  box(.16, .1, .14, skin, 0, .74, .08, { p: r }); box(.3, .3, .32, helmet, 0, .82, .06, { p: r }); box(.26, .1, .04, MAT.glass, 0, .89, .23, { p: r, cast: false });
  return g;
}

// a lane runs along `axis` at `fixed`; d is the travel direction (+1/-1); vehicles wrap from `from` to `to`; stopAt is one stop line or a list
function lane(axis, fixed, d, from, to, stopAt, light, cars) {
  const L = { axis, fixed, d, from, to, stopAt, light, cars: [] };
  for (const [s, kind, color] of cars) {
    const g = kind === 'auto' ? autoRickshaw(color) : kind === 'scooter' ? scooter(color, { rider: true, jacket: [0x2a3a5a, PAL.coral, 0x3f6a3a, PAL.paint][rnd() * 4 | 0], helmet: [0x1c1c20, 0xe8e6e0, PAL.coral][rnd() * 3 | 0] }) : car(0, 0, 0, color, { collide: false });
    g.userData.dyn = true; compact(g);
    g.rotation.y = axis === 'z' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = { g, s, v: 0, cruise: kind === 'auto' ? 4.2 : kind === 'scooter' ? 6.2 : 5.5, len: kind === 'auto' ? 2.8 : kind === 'scooter' ? 1.9 : 4.4 };
    L.cars.push(v); place(L, v);
  }
  traffic.lanes.push(L);
  return L;
}
function place(L, v) { L.axis === 'z' ? v.g.position.set(L.fixed, 0, v.s) : v.g.position.set(v.s, 0, L.fixed); }

function trafficLights(jx, jz, ox = 3.7, oz = 3.7) {
  const mk = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .05, roughness: .4 });
  const heads = { ns: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)], ew: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)] };
  for (const [px, pz] of [[jx - ox, jz - oz], [jx + ox, jz + oz]]) {
    box(.14, 3, .14, MAT.metal, px, 0, pz); colCirc(px, pz, .15);
    for (const [key, ry] of [['ns', 0], ['ew', Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(px, 2.3, pz); g.rotation.y = ry; scene.add(g);
      box(.34, 1, .24, MAT.charcoal || MAT.metal, 0, 0, 0, { p: g });
      heads[key].forEach((m, i) => box(.2, .2, .04, m, 0, .78 - i * .3, .13, { p: g, cast: false }));
    }
  }
  traffic.lights.push(heads);
}

// light colour for a direction at time t: north-south green for 8 s, amber 2 s, then east-west
function lightState(dir, t) {
  const p = t % LIGHT_CYCLE, ns = p < 8 ? 'green' : p < 10 ? 'amber' : 'red', ew = p < 10 ? 'red' : p < 18 ? 'green' : 'amber';
  return dir === 'ns' ? ns : ew;
}

function stepTraffic(t, dt) {
  for (const heads of traffic.lights) for (const dir of ['ns', 'ew']) { const st = lightState(dir, t); ['red', 'amber', 'green'].forEach((c, i) => { heads[dir][i].emissiveIntensity = c === st ? 2.2 : .05; }); }
  const obstacles = traffic.blockers.map((b) => b()).filter(Boolean);
  if (hero && hero.zone === 'pune') obstacles.push({ x: hero.x, z: hero.y });
  for (const L of traffic.lanes) {
    const order = L.cars.slice().sort((a, b) => (b.s - a.s) * L.d);
    order.forEach((v, i) => {
      let target = v.cruise;
      const toStop = Math.min(...[].concat(L.stopAt).map((at) => (at - v.s) * L.d).filter((d) => d > 0), Infinity), st = lightState(L.light, t);
      if (st !== 'green' && toStop < 14 && !(st === 'amber' && toStop < 3)) target = Math.min(target, Math.max(0, toStop - .3) * 1.1);
      const ahead = order[i - 1];
      if (ahead) target = Math.min(target, Math.max(0, (ahead.s - v.s) * L.d - (ahead.len + v.len) / 2 - 1.2) * 1.2);
      for (const o of obstacles) {
        const lat = Math.abs((L.axis === 'z' ? o.x : o.z) - L.fixed), fwd = ((L.axis === 'z' ? o.z : o.x) - v.s) * L.d;
        if (lat < 1.6 && fwd > 0 && fwd < 7) target = 0;
      }
      v.v += Math.max(-8 * dt, Math.min(3 * dt, target - v.v));
      v.s += v.v * dt * L.d;
      if ((v.s - L.to) * L.d > 0) v.s = L.from;
      place(L, v);
    });
  }
}
