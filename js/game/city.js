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

// a pair of street bins: the iron cage bin and the lidded metal can
function bins(x, z) {
  streetProp('litterBin', x, 0, z, 0); streetProp('trashCan', x + .75, 0, z, .6);
  colBox(x - .35, z - .35, x + 1.05, z + .35);
}

function manholes(points) { for (const [x, z] of points) { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .02, 14), MAT.metal), null, false); m.position.set(x, .025, z); } }

const traffic = { lanes: [], lights: [], blockers: [] };

// ---- traffic: vehicles drive on the left along fixed lanes, stop at red, keep their distance and wait for you ----
// the low-poly autorickshaw model (js/models/autorickshaw.js, from tools/auto-pack.py): geometry shared by every auto, one material set per colour,
// the atlas's yellow panels repainted in `color` (keeping their shading); scaled from the model's ~3 m to the game's ~2.6 m auto
const AUTO = { geo: null, mats: new Map(), scale: .88 };
function autoMats(color) {
  if (AUTO.mats.has(color)) return AUTO.mats.get(color);
  const tex = new THREE.Texture(), img = new Image(), c = new THREE.Color(color);
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], gr = p[i + 1], b = p[i + 2];
      if (r > 120 && gr > 90 && b < gr * .55 && r - b > 90) { const l = (r + gr) / 2 / 220; p[i] = Math.min(255, c.r * 255 * l); p[i + 1] = Math.min(255, c.g * 255 * l); p[i + 2] = Math.min(255, c.b * 255 * l); }
    }
    ctx.putImageData(d, 0, 0); tex.image = cv; tex.needsUpdate = true;
  };
  img.src = window.AUTO_TEX;
  tex.anisotropy = 4;
  const m = { body: new THREE.MeshStandardMaterial({ map: tex, roughness: .55 }), cloth: new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }),
    tyre: new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), glass: new THREE.MeshStandardMaterial({ map: tex, roughness: .1, transparent: true, opacity: .55 }) };
  AUTO.mats.set(color, m); return m;
}
function autoRickshaw(color) {
  const g = new THREE.Group(); scene.add(g);
  if (!AUTO.geo) AUTO.geo = Object.fromEntries(Object.entries(window.AUTO_MODEL).map(([k, d]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3));
    geo.setIndex(d.i); geo.scale(AUTO.scale, AUTO.scale, AUTO.scale); return [k, geo];
  }));
  const mats = autoMats(color);
  for (const [k, geo] of Object.entries(AUTO.geo)) add(new THREE.Mesh(geo, mats[k] || mats.body), g, k !== 'glass');
  box(.3, .08, .04, glowStrip(0xfff0c0), 0, .44, 1.13, { p: g, cast: false });   // the headlight, for the dark
  return g;
}

// a scooter, ridden or parked: o.rider adds a rider with a jacket and helmet in the given colours
// one material per colour, shared by every scooter of it (a parked row merges into a few draws instead of three per scooter)
const SCOOTER_MATS = {}, scooterMat = (k, make) => SCOOTER_MATS[k] || (SCOOTER_MATS[k] = make());
function scooter(color, o = {}) {
  const g = new THREE.Group(); scene.add(g);
  const body = scooterMat('body' + color, () => new THREE.MeshStandardMaterial({ color, roughness: .45 })), dark = MAT.charcoal || MAT.metal;
  box(.32, .3, 1.25, body, 0, .28, 0, { p: g }); box(.34, .52, .3, body, 0, .28, .53, { p: g }); box(.28, .12, .66, dark, 0, .58, -.15, { p: g });
  box(.56, .05, .05, MAT.metal, 0, 1.02, .6, { p: g }); box(.05, .44, .05, MAT.metal, 0, .6, .63, { p: g });
  box(.16, .08, .04, scooterMat('head', () => glowStrip(0xfff0c0)), 0, .74, .69, { p: g, cast: false }); box(.16, .05, .04, scooterMat('tail', () => glowStrip(0xff3020)), 0, .52, -.64, { p: g, cast: false });
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
const MODEL_CARS = ['bmw', 'jesko', 'creta', 'm4', 'scorpio', 'eeco', 'omni', 'cybertruck'];   // the modelled cars (sportsCar); every car in traffic is one of these
function lane(axis, fixed, d, from, to, stopAt, light, cars) {
  const L = { axis, fixed, d, from, to, stopAt, light, cars: [] };
  for (const [s, kind, color] of cars) {
    let v = null;
    const g = kind === 'evel' ? bikeModel('evel', 0, 0, 0) : MODEL_CARS.includes(kind) ? sportsCar(kind, 0, 0, 0, { collide: false, onSize: (len, wide) => { v.len = len; v.wide = wide / 2; } }) : kind === 'auto' ? autoRickshaw(color) : kind === 'scooter' ? scooter(color, { rider: true, jacket: [0x2a3a5a, PAL.coral, 0x3f6a3a, PAL.paint][rnd() * 4 | 0], helmet: [0x1c1c20, 0xe8e6e0, PAL.coral][rnd() * 3 | 0] }) : car(0, 0, 0, color, { collide: false });
    g.userData.dyn = true; if (!MODEL_CARS.includes(kind)) compact(g);   // the sports cars fill in later (their model loads async)
    g.rotation.y = axis === 'z' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? Math.PI / 2 : -Math.PI / 2);
    const rash = kind === 'creta';   // a Creta always drives rash: fast, hard on the pedals, overtaking, and now and then it does not stop for you
    v = { g, s, v: 0, kind, rash, cruise: kind === 'evel' ? 10 : rash ? 8.5 : kind === 'auto' ? 4.2 : kind === 'scooter' ? 6.2 : 5.5, len: kind === 'auto' ? 2.8 : kind === 'scooter' || kind === 'evel' ? 2.4 : 4.4,
      wide: kind === 'scooter' || kind === 'evel' ? .45 : kind === 'auto' ? .75 : .95, lat: 0, latV: 0, reckless: 0, passT: 0 };
    L.cars.push(v); place(L, v);
  }
  traffic.lanes.push(L);
  return L;
}
// v.lat: the sideways offset left over from a lane change, easing back to 0 (the car swings into its new lane rather than jumping)
function place(L, v) {
  const f = L.fixed + v.lat; L.axis === 'z' ? v.g.position.set(f, 0, v.s) : v.g.position.set(v.s, 0, f);
  v.g.rotation.y = (L.axis === 'z' ? (L.d > 0 ? 0 : Math.PI) : (L.d > 0 ? Math.PI / 2 : -Math.PI / 2)) + v.latV * .08 * (L.axis === 'z' ? 1 : -1) * L.d;
}
// a rash car hits the hero: a hop and a short throw along the way it was going and away from its lane, never into a wall or another car
const knock = { t: 0, vx: 0, vz: 0, cool: 0 };
function hitHero(L, v) {
  if (knock.cool > 0) return;
  const side = Math.sign((L.axis === 'z' ? hero.x : hero.y) - (L.fixed + v.lat)) || 1, push = 5 + v.v * .5;
  knock.vx = L.axis === 'z' ? side * 4 : L.d * push; knock.vz = L.axis === 'z' ? L.d * push : side * 4; knock.t = .45; knock.cool = 2.5;
  hero.trigger('jump');
  if (typeof showBanner === 'function') showBanner('Rash driver!', ['That Creta did not even slow down.', 'Watch out for the Cretas.', 'Pune traffic, eh?'][rnd() * 3 | 0]);
}

function trafficLights(jx, jz, ox = 3.7, oz = 3.7) {
  const mk = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .05, roughness: .4 });
  const heads = { ns: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)], ew: [mk(0xff3020), mk(0xffb020), mk(0x30ff70)] };
  // each pole is the modelled signal twice (one head facing each road; the poles coincide), with the game's own red / amber / green lenses set in the
  // model's housing (x -.41 to -.13, y 2.45 to 3.29, face at z .13) so stepTraffic can still switch them
  for (const [px, pz] of [[jx - ox, jz - oz], [jx + ox, jz + oz]]) {
    colCirc(px, pz, .2);
    for (const [key, ry] of [['ns', 0], ['ew', Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(px, 0, pz); g.rotation.y = ry; scene.add(g);
      streetProp('signal', 0, 0, 0, 0, { p: g });
      heads[key].forEach((m, i) => { const l = add(new THREE.Mesh(new THREE.CircleGeometry(.085, 16), m), g, false); l.position.set(-.27, 3.13 - i * .27, .16); });
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
  const obstacles = traffic.blockers.map((b) => b()).filter(Boolean), here = hero && hero.zone === 'pune';
  if (here) obstacles.push({ x: hero.x, z: hero.y, hero: true });
  const moves = [];
  for (const L of traffic.lanes) {
    L.sib = L.sib || traffic.lanes.filter((o) => o !== L && o.axis === L.axis && o.d === L.d && Math.abs(o.fixed - L.fixed) < 3);   // the other lane the same way
    const order = L.cars.slice().sort((a, b) => (b.s - a.s) * L.d);
    order.forEach((v, i) => {
      let target = v.cruise;
      const toStop = Math.min(...[].concat(L.stopAt).map((at) => (at - v.s) * L.d).filter((d) => d > 0), Infinity), st = lightState(L.light, t);
      if (st !== 'green' && toStop < (v.rash ? 9 : 14) && !(st === 'amber' && toStop < (v.rash ? 8 : 3))) target = Math.min(target, Math.max(0, toStop - .3) * (v.rash ? 2 : 1.1));   // a rash car runs late ambers and brakes at the line
      const ahead = order[i - 1], gap = ahead ? (ahead.s - v.s) * L.d - (ahead.len + v.len) / 2 : Infinity;
      if (ahead) target = Math.min(target, Math.max(0, gap - (v.rash ? .6 : 1.2)) * (v.rash ? 2 : 1.2));
      // a rash car stuck behind a slower one pulls out into the other lane when there is room
      v.passT -= dt;
      if ((v.rash || v.kind === 'evel') && ahead && gap < 9 && ahead.v < v.cruise * .8 && v.passT <= 0 && Math.abs(v.lat) < .2) {   // Evel weaves past too
        const to = L.sib.find((o) => o.cars.every((c) => { const d = (c.s - v.s) * L.d; return d < -7 || d > 9; }));
        if (to) { moves.push([L, to, v]); v.passT = 3; }
      }
      v.reckless -= dt; if (v.rash && v.reckless < -6) v.reckless = rnd() < .5 ? 4 : 0;   // every few seconds: decide whether to just not stop for people
      for (const o of obstacles) {
        const lat = Math.abs((L.axis === 'z' ? o.x : o.z) - L.fixed - v.lat), fwd = ((L.axis === 'z' ? o.z : o.x) - v.s) * L.d;
        if (lat < 1.6 && fwd > 0 && fwd < 7 && !(o.hero && v.rash && v.reckless > 0)) target = 0;
      }
      v.v += Math.max((v.rash ? -14 : -8) * dt, Math.min((v.rash ? 6 : 3) * dt, target - v.v));
      v.s += v.v * dt * L.d;
      if ((v.s - L.to) * L.d > 0) v.s = L.from;
      v.latV = -v.lat * 2.2; v.lat += v.latV * dt; if (Math.abs(v.lat) < .01) { v.lat = 0; v.latV = 0; }
      place(L, v);
      if (here && v.rash && v.v > 2) {   // the bumper reaches the hero: knocked aside
        const lat = Math.abs((L.axis === 'z' ? hero.x : hero.y) - L.fixed - v.lat), fwd = ((L.axis === 'z' ? hero.y : hero.x) - v.s) * L.d;
        if (lat < v.wide + .35 && fwd > -v.len / 2 && fwd < v.len / 2 + .4) hitHero(L, v);
      }
    });
  }
  for (const [from, to, v] of moves) { from.cars.splice(from.cars.indexOf(v), 1); to.cars.push(v); v.lat = from.fixed + v.lat - to.fixed; }
  // the footprints the hero cannot walk into (not while being thrown: that throw is what gets them out of the way)
  VEH.length = 0;
  if (here) for (const L of traffic.lanes) for (const v of L.cars) {
    const f = L.fixed + v.lat, hl = v.len / 2, hw = v.wide;
    VEH.push(L.axis === 'z' ? { x0: f - hw, z0: v.s - hl, x1: f + hw, z1: v.s + hl } : { x0: v.s - hl, z0: f - hw, x1: v.s + hl, z1: f + hw });
  }
  // never trapped: if a car ends up over the hero (it crept into them, or they stood at its nose), step them out to the nearest free side
  if (here && knock.t <= 0) for (const c of VEH) {
    const p = .34, x = hero.x, z = hero.y;
    if (!(x > c.x0 - p && x < c.x1 + p && z > c.z0 - p && z < c.z1 + p)) continue;
    const outs = [[c.x0 - p - .02, z], [c.x1 + p + .02, z], [x, c.z0 - p - .02], [x, c.z1 + p + .02]].sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z));
    const to = outs.find(([ox, oz]) => !blocked(ox, oz)); if (to) { hero.x = to[0]; hero.y = to[1]; } break;
  }
  knock.cool -= dt;
  if (knock.t > 0 && here) {
    knock.t -= dt; const k = Math.max(0, knock.t / .45), nx = hero.x + knock.vx * k * dt * 2, nz = hero.y + knock.vz * k * dt * 2;
    if (!blocked(nx, nz, .32, false)) { hero.x = nx; hero.y = nz; }
  }
}
