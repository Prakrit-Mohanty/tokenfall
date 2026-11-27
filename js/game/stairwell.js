// TokenFall: the Crescent Bay fire stairs (zone "stairs"), seen side-on as a cut-away: the front wall is gone, so the whole stair tower
// stands in front of you like an elevation drawing. Grey steel flights zigzag up between floor landings (G, 2, 3, 4) and half landings,
// orange handrails, cream back wall with each floor's grey fire door, its "FLOOR n" plate and the green LEVEL sign.
// Walk right up the front flight to the half landing, step back and walk left up the rear flight to the next floor's landing (and the
// reverse to go down). E at a landing's door steps out onto that floor. The climb is a path, not a heightmap: the landings of every floor
// share the same x and z, so the storey you are on is tracked as you pass from a flight to a landing. Classic script; after crescent-bay.js.

const STAIRS = (() => {
  const ORDER = ['G', '2', '3', '4'];
  const EXITS = {
    G: { zone: 'pune', at: () => [AREAS.pune.cx + CB.X0 + CB.LOB[0] + .82, AREAS.pune.cz + CB.Z0 + CB.LOB[3] + 1.0], name: 'Ground Floor' },
    2: { zone: 'lab', at: () => [AREAS.lab.cx + 1.44 * 1.4 - .9, AREAS.lab.cz + 7.05 * 1.4], name: 'Calfus HQ · 2nd Floor' },
    3: { zone: 'cb3', at: () => [AREAS.cb3.cx + 1.4 * 1.4 - .9, AREAS.cb3.cz + 7.4 * 1.4], name: 'Calfus HQ · 3rd Floor' },
    4: { zone: 'lab4', at: () => [AREAS.lab4.cx + 1.44 * 1.4 - .9, AREAS.lab4.cz + 7.3 * 1.4], name: 'Calfus HQ · 4th Floor' },
  };
  // the tower, in local metres: floor landings on the left, half landings on the right, flights between; two lanes deep (front, rear)
  const H = 3.6, HALF = H / 2, N = 11, L0 = -4.6, L1 = -1.6, R0 = 1.6, R1 = 3.6, RUN = (R0 - L1) / N, DX = -3.1;
  let s = 0, prevReg = 'L', rear = false, cx = 0, cz = 0;
  const S = { floor: () => ORDER[s] };

  const region = () => { const x = hero.x - cx; return x < L1 ? 'L' : x > R0 ? 'R' : 'F'; };
  function heightAt() {
    const x = hero.x - cx, yb = s * H, reg = region();
    if (reg === 'L') return yb;
    if (reg === 'R') return yb + HALF;
    if (!rear) return yb + Math.min(N, Math.floor((x - L1) / RUN) + 1) * HALF / N;
    return yb + HALF + Math.min(N, Math.floor((R0 - x) / RUN) + 1) * HALF / N;
  }
  function tick() {
    const reg = region();
    if (reg !== 'F') rear = hero.y < cz;
    if (prevReg === 'L' && reg === 'F') {
      if (rear) { if (s === 0) hero.x = cx + L1 - .01; else s--; }      // down from this floor (none below the ground floor)
      else if (s === ORDER.length - 1) hero.x = cx + L1 - .01;          // up from here (the 4th is the top)
    } else if (prevReg === 'F' && reg === 'L' && rear) s++;             // off the rear flight onto the next floor's landing
    if (region() === 'F') hero.y = rear ? Math.min(hero.y, cz - .42) : Math.max(hero.y, cz + .42);   // stay in your flight's lane
    prevReg = region();
    const h = heightAt(); if (Math.abs((hero.fy || 0) - h) > 1) { hero.fy = h; snapCamera(); }
  }

  function plateTex(n) { return canvasTex(128, 192, (g) => { g.fillStyle = '#9a9a98'; g.fillRect(0, 0, 128, 192); g.fillStyle = '#2a2a2a'; g.font = '700 22px Arial'; g.textAlign = 'center'; g.fillText('FLOOR', 64, 40); g.font = '800 110px Arial'; g.fillText(n, 64, 160); }, { keep: true }); }
  function levelTex(n) { return canvasTex(256, 64, (g) => { g.fillStyle = '#138a4a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fff'; g.font = '700 38px Arial'; g.textAlign = 'center'; g.fillText(n === 'G' ? 'GROUND' : 'LEVEL ' + n, 128, 46); }, { keep: true }); }

  function build(a) {
    cx = a.cx; cz = a.cz;
    const X = (v) => cx + v, Z = (v) => cz + v, ZN = 'stairs';
    const cream = new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: .95 }), steel = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: .35, roughness: .5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x6d747b, metalness: .4, roughness: .5 }), rail = new THREE.MeshStandardMaterial({ color: 0xe0531f, roughness: .45 });
    const doorM = new THREE.MeshStandardMaterial({ color: 0x7d8186, roughness: .5 }), red = new THREE.MeshStandardMaterial({ color: 0xd22a22, roughness: .45 });
    const TOP = ORDER.length * H;
    // a bar from (x0,y0) to (x1,y1) at depth z: stringers, rails, braces
    const bar = (x0, y0, x1, y1, z, t, h, m) => { const L = Math.hypot(x1 - x0, y1 - y0), b = new THREE.Mesh(new THREE.BoxGeometry(L, h, t), m); b.position.set(X((x0 + x1) / 2), (y0 + y1) / 2, Z(z)); b.rotation.z = Math.atan2(y1 - y0, x1 - x0); b.castShadow = true; b.receiveShadow = true; scene.add(b); return b; };
    // the shaft: cream back wall and ends, a dark floor far below; no front wall, so you see in
    box(R1 - L0 + .6, TOP + 1, .2, cream, X((L0 + R1) / 2), -.5, Z(-1.7), { p: scene });
    for (const x of [L0 - .2, R1 + .2]) box(.2, TOP + 1, 3.4, cream, X(x), -.5, Z(-.1), { p: scene });
    plane(60, 60, MAT.charcoal, X(0), -.5, Z(0), 4);
    WALK.push([X(L0) + .3, Z(-1.3), X(R1) - .3, Z(1.3)]);
    // the steel frame: corner posts at the front, X braces on the back wall between each pair of floors
    for (const x of [L0 + .05, L1, R0, R1 - .05]) box(.12, TOP + .5, .12, dark, X(x), -.5, Z(1.42), { p: scene });
    for (let k = 0; k < ORDER.length; k++) { const y = k * H; bar(L1 + .3, y + .2, R0 - .3, y + H - .2, -1.58, .05, .08, dark); bar(L1 + .3, y + H - .2, R0 - .3, y + .2, -1.58, .05, .08, dark); }
    for (let k = 0; k < ORDER.length; k++) {
      const yb = k * H, n = ORDER[k];
      // the floor landing, its orange guard rail along the front and the open end
      box(L1 - L0, .18, 2.9, steel, X((L0 + L1) / 2), yb - .18, Z(0), { p: scene });
      box(L1 - L0, .05, .05, rail, X((L0 + L1) / 2), yb + 1, Z(1.38), { p: scene, cast: false });
      for (const y of [.35, .68]) box(L1 - L0, .025, .025, rail, X((L0 + L1) / 2), yb + y, Z(1.38), { p: scene, cast: false });
      // the grey fire door, its window, handle; the FLOOR plate beside it, the green LEVEL sign, the red call point
      box(1.05, 2.2, .06, doorM, X(DX), yb, Z(-1.57), { p: scene }); box(.22, .3, .07, MAT.paneGlass, X(DX), yb + 1.45, Z(-1.56), { p: scene, cast: false });
      box(.14, .04, .08, steel, X(DX + .38), yb + 1.05, Z(-1.53), { p: scene, cast: false });
      box(.24, .34, .02, std(plateTex(n), 0), X(DX - .85), yb + 1.55, Z(-1.59), { s: 0, p: scene, cast: false });
      box(.46, .12, .02, std(levelTex(n), 0), X(DX), yb + 2.38, Z(-1.59), { s: 0, p: scene, cast: false });
      box(.12, .16, .04, red, X(DX + .8), yb + 1.3, Z(-1.58), { p: scene });
      // the red sprinkler pipe under each ceiling
      { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, R1 - L0, 8), red); p.rotation.z = Math.PI / 2; p.position.set(X((L0 + R1) / 2), yb + H - .35, Z(-1.3)); scene.add(p); }
      pointLight(ZN, 0xfff2dc, 1.3, 9, X(-3), yb + 2.8, Z(.3));
      if (k === ORDER.length - 1) { box(R1 - L0, .2, 3.2, cream, X((L0 + R1) / 2), yb + H - .1, Z(-.1), { p: scene }); break; }
      // the half landing, its window on the back wall
      box(R1 - R0, .18, 2.9, steel, X((R0 + R1) / 2), yb + HALF - .18, Z(0), { p: scene });
      box(R1 - R0, .05, .05, rail, X((R0 + R1) / 2), yb + HALF + 1, Z(1.38), { p: scene, cast: false });
      box(.05, .05, 2.9, rail, X(R1 - .05), yb + HALF + 1, Z(0), { p: scene, cast: false });
      box(1.1, 1.6, .05, MAT.paneGlass, X((R0 + R1) / 2), yb + HALF + .7, Z(-1.58), { p: scene, cast: false });
      pointLight(ZN, 0xdfeaff, .9, 7, X(2.6), yb + HALF + 2.4, Z(.3));
      // the two flights: open steel treads on a pair of stringers; the front one climbs right, the rear one climbs left
      for (const [zc, up] of [[.7, true], [-.7, false]]) {
        const y0 = up ? yb : yb + HALF;
        for (let i = 0; i < N; i++) {
          const x = up ? L1 + (i + .5) * RUN : R0 - (i + .5) * RUN, top = y0 + (i + 1) * HALF / N;
          box(RUN + .02, .05, 1.2, steel, X(x), top - .05, Z(zc), { p: scene });
          box(.02, .02, 1.2, MAT.charcoal, X(x + (up ? -RUN / 2 + .03 : RUN / 2 - .03)), top - .02, Z(zc), { p: scene, cast: false });
        }
        const xa = up ? L1 : R0, xb = up ? R0 : L1;
        for (const ze of [zc + .62, zc - .62]) bar(xa, y0 - .1, xb, y0 + HALF - .1, ze, .05, .22, dark);
        // the orange handrail: on the open front side of the front flight, on the middle of the rear one, three bars below
        const zr = up ? zc + .66 : zc + .66;
        bar(xa, y0 + 1, xb, y0 + HALF + 1, zr, .05, .05, rail);
        for (const dy of [.35, .68]) bar(xa, y0 + dy, xb, y0 + HALF + dy, zr, .025, .025, rail);
        for (const t of [0, .5, 1]) box(.04, 1, .04, rail, X(xa + (xb - xa) * t), y0 + HALF * t, Z(zr), { p: scene, cast: false });
      }
    }
    TF.heroFloor[ZN] = heightAt; TF.zoneTick[ZN] = tick;
    INTER.push({ x: X(DX), z: Z(-.9), r: 1.1, get y() { return s * H + 2.3; }, label: 'Fire Door', verb: 'Go out', act: () => { if (traveling) return; const e = EXITS[ORDER[s]]; travel({ to: e.zone, zone: 'stairs', label: e.name, at: e.at() }); } });
    NPC_BOUNDS.stairs = [X(0), Z(3), X(0), Z(3)];
  }
  // from a floor's fire-exit door onto that floor's landing in the stairwell
  function enter(f, fromZone) { if (traveling) return; s = ORDER.indexOf(f); prevReg = 'L'; rear = true; travel({ to: 'stairs', zone: fromZone, label: EXITS[f].name + ' · Stairs', at: [cx + DX, cz - .6], dir: 'down' }); }
  return Object.assign(S, { build, enter });
})();
