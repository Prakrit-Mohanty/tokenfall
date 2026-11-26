// TokenFall: the lobby's footbridge. A stone arch over the river, paved with the road's own stones: the paving's shader draws its deck, so the
// stones, joints, wear and colour run straight on from the road, up over the water and down onto the path on the far bank, with no step and no
// seam (the road's edge bands carry on along the bridge's edges). Curbs and walls of the kerbs' carved stone, a soft glowing line along the curbs,
// painted rails and glass panes that follow the curve, and a stone post with a lantern at each corner. The river runs clear underneath.
//   ARCH          where it stands and how it rises; lobby-village.js stops the road and the path where the bridge takes over
//   archLift(z)   the deck's height above the paving at z (0 off the bridge); characters climb it through FLOORS slices (floorAt)
//   archBridge()  builds it, from vRiverAndBridge (lobby-village.js)
// Classic script: shares one global scope with the other js/game files; uses paving.js (MAT.paverLobby), stone-round.js and lobby-village.js at call time.

const ARCH = { x0: -2.5, x1: 2.5, zS: -29.5, zN: -38.5, banks: [-30.45, -37.55], rise: .85, under: .58, curb: .32, curbH: .14, y: .014, band: 1.6 };
const archT = (z) => (ARCH.zS - z) / (ARCH.zS - ARCH.zN);
const archLift = (z) => { const t = archT(z); return t <= 0 || t >= 1 ? 0 : ARCH.rise * Math.sin(Math.PI * t) ** 2; };
const archDeck = (z) => ARCH.y + archLift(z);
// the underside: a shallow arch from bank to bank; beyond the banks the bridge sits on the ground
const archUnder = (z) => { const [bS, bN] = ARCH.banks, s = (bS - z) / (bS - bN); return s <= 0 || s >= 1 ? 0 : .02 + ARCH.under * Math.sin(Math.PI * s); };

function archBridge() {
  const { x0, x1, zS, zN, curb, curbH } = ARCH, L = zS - zN, out = x1 + curb;
  const slopeN = (z) => { const t = archT(z); return t <= 0 || t >= 1 ? 0 : ARCH.rise * Math.PI * Math.sin(2 * Math.PI * t) / L; };   // the deck's normal leans this much toward +z
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);

  // ---- the deck: whole stones in rows, laid like the road's (edge bands, two field stones a row), each stone a flat facet of the curve ----
  {
    const pos = [], nor = [], A = [], B = [], C = [], D = [], E = [], idx = [], none = [0, 0, 0];
    const vert = (x, z, dy, a, b) => { const n = slopeN(z), k = 1 / Math.hypot(1, n); pos.push(x, archDeck(z) + dy, z); nor.push(0, k, n * k); A.push(...a); B.push(...b); C.push(0, 0); D.push(...none); E.push(...none); return pos.length / 3 - 1; };
    const quad = (qx0, qz0, qx1, qz1, dy, a, b) => { const v = [[qx0, qz0], [qx1, qz0], [qx1, qz1], [qx0, qz1]].map(([x, z]) => vert(x, z, dy, a, b)); idx.push(v[0], v[2], v[1], v[0], v[3], v[2]); };
    const cell = (cx0, cz0, cx1, cz1, role, i, j) => quad(cx0, cz0, cx1, cz1, 0, [(cx0 + cx1) / 2, (cz0 + cz1) / 2, (cx1 - cx0) / 2, (cz1 - cz0) / 2], [0, role, i, j]);
    const rows = 18, dz = L / rows, f0 = -ARCH.band, f1 = ARCH.band;   // the field runs between the road's band lines (x +-1.6)
    for (let r = 0; r < rows; r++) {
      const za = zS - r * dz, zb = za - dz, z0 = Math.min(za, zb), z1 = Math.max(za, zb);
      quad(x0, z0, x1, z1, -.002, [0, 0, 1, 1], [4, 0, 0, 0]);   // the grout the stones sit on
      cell(x0, z0, f0, z1, 1, r, 951); cell(f1, z0, x1, z1, 1, r, 952);   // the edge bands
      if (r === 0 || r === rows - 1) { cell(f0, z0, f1, z1, 1, r, 953); continue; }   // a band across each end: the bridge's threshold
      const j = (r % 2 ? .45 : -.45) + Math.sin(r * 2.3) * .12;   // two stones a row, joints staggered like the road's
      cell(f0, z0, j, z1, 0, r, 960); cell(j, z0, f1, z1, 0, r, 961);
    }
    const geo = new THREE.BufferGeometry(), f32 = (arr, n) => new THREE.BufferAttribute(new Float32Array(arr), n);
    geo.setAttribute('position', f32(pos, 3)); geo.setAttribute('normal', f32(nor, 3)); geo.setAttribute('aA', f32(A, 4)); geo.setAttribute('aB', f32(B, 4)); geo.setAttribute('aC', f32(C, 2)); geo.setAttribute('aD', f32(D, 3)); geo.setAttribute('aE', f32(E, 3));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const deck = new THREE.Mesh(geo, MAT.paverLobby); deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
  }

  // ---- the stonework: curbs along both edges, the outer walls down to the water's arch, and the arch's underside ----
  {
    const N = 64, pos = [], idx = [];
    const zAt = (i) => zS - L * i / N;
    const strip = (fa, fb) => {   // a ribbon along the bridge between two edge lines fa(z), fb(z) -> [x, y]
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) { const z = zAt(i), a = fa(z), b = fb(z); pos.push(a[0], a[1], z, b[0], b[1], z); }
      for (let i = 0; i < N; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    };
    for (const s of [-1, 1]) {
      const xi = s * x1, xo = s * out, top = (z) => archDeck(z) + curbH;
      strip((z) => [xi, archDeck(z) - .01], (z) => [xi, top(z)]);   // the curb's inner face
      strip((z) => [xi, top(z)], (z) => [xo, top(z)]);               // its top
      strip((z) => [xo, top(z)], (z) => [xo, archUnder(z) - .02]);   // the wall: curb top down to the arch (or the bank)
      for (const z of [zS, zN]) { const b = pos.length / 3; pos.push(xi, 0, z, xo, 0, z, xo, top(z), z, xi, top(z), z); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }   // the ends
    }
    strip((z) => [-out, archUnder(z) - .02], (z) => [out, archUnder(z) - .02]);   // the arch's underside
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const stone = stoneRoundMaterial({ c: [0, 0], n: 0 }); stone.side = THREE.DoubleSide;
    const walls = new THREE.Mesh(geo, stone); walls.castShadow = true; walls.receiveShadow = true; g.add(walls);
  }

  // ---- rails: painted posts on the curbs, a handrail and glass panes that follow the arch, a glowing line along each curb ----
  {
    const railY = (z) => archDeck(z) + curbH + 1.02, xr = x1 + curb / 2;
    for (const s of [-1, 1]) {
      const xs = s * xr, n = 8;
      for (let i = 1; i < n; i++) {   // the corner posts are stone (below); the painted ones stand between
        const z = zS - L * i / n, h = railY(z) - archDeck(z) - curbH;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, h, 12), MAT.metal); p.position.set(xs, archDeck(z) + curbH + h / 2, z); p.castShadow = true; g.add(p);
      }
      const pts = []; for (let i = 0; i <= 24; i++) { const z = zS - .25 - (L - .5) * i / 24; pts.push(new THREE.Vector3(xs, railY(z), z)); }
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .05, 10), MAT.metal); rail.castShadow = true; g.add(rail);
      const glass = [], gi = [], led = [], li = [];
      for (let i = 0; i <= 48; i++) {
        const z = zS - .3 - (L - .6) * i / 48, y0 = archDeck(z) + curbH + .05, y1 = railY(z) - .07;
        glass.push(xs, y0, z, xs, y1, z); led.push(s * (x1 + .02), archDeck(z) + curbH + .006, z, s * (x1 + .09), archDeck(z) + curbH + .006, z);
        if (i < 48) { const k = i * 2; gi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); li.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const ribbon = (p, ix, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(ix); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, m); g.add(me); return me; };
      ribbon(glass, gi, vOnce('glass2', () => Object.assign(vGlass().clone(), { side: THREE.DoubleSide }))).renderOrder = 2;
      ribbon(led, li, vOnce('ledLine2', () => Object.assign(vGlow(V_LED_COOL).clone(), { side: THREE.DoubleSide })));
    }
  }

  // ---- a stone post at each corner, capped, with a lantern ----
  const postStone = stoneRoundMaterial({ c: [0, 0], n: 0 });
  for (const s of [-1, 1]) for (const z of [zS - .05, zN + .05]) {
    const x = s * (x1 + curb / 2), h = .95;
    box(.5, h, .5, postStone, x, 0, z, { p: g }); box(.62, .1, .62, postStone, x, h, z, { p: g });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 18, 12), vGlow(V_LED_WARM)); lamp.position.set(x, h + .26, z); g.add(lamp);
    box(.16, .08, .16, MAT.metal, x, h + .1, z, { p: g });
    colCirc(x, z, .38); contact(x, z, .5);
  }

  // ---- walking: the deck in thin slices of height for floorAt; curbs and rails are walls ----
  for (let z = zN; z < zS - 1e-6; z += .25) FLOORS.push([x0, z, x1, Math.min(zS, z + .25), archDeck(z + .125)]);
  for (const s of [-1, 1]) colBox(s > 0 ? x1 - .02 : -out - .05, zN, s > 0 ? out + .05 : x0 + .02, zS);
  return g;
}

if (typeof module === 'object' && module.exports) module.exports = { ARCH, archLift, archUnder };
