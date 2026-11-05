// House Rules Carrom — the board in the world. Browser: window.CarromWorld. Node: require('./carrom-world.js') (the pure part: STYLE, makeMapper).
//
// The game is played on the real carrom table in the HQ office: the lobby's own table (a 1 x 1 m top with its printed frame) gets a calm board drawn
// over it, dark rails, a striker and one coin, and four pockets that carry the answers as a colour and a shape (no text on the board). A pendant lamp lights it, the
// room dims a little while it is up, and a close overhead-tilted camera eases in on entry and back out on leaving.
//
//   install(TF)              registers at the lobby's boot (after mergeStatic, so everything here stays a live object); sets TF.carrom = world
//   world.table(info)        called by the lobby while it builds the office: { x, z, top, size }
//   world.mapper             board (0..100) <-> world: toWorld(bx, by), toBoard(wx, wz), u (metres per board unit); screenToBoard(cx, cy), toScreen(bx, by)
//   world.enter(cb) / world.leave(cb)   fade, lock the hero, ease the camera in / restore it and the hero exactly where they were
//   world.setPockets(options)  mark the four pockets: each option's slot picks the colour and shape, its corner picks the pocket
//   world.setCoin(x, y, visible)  puts the coin on the board; world.coin is the mesh (the game animates it sinking)
//   world.setStriker(x, y, visible)  puts the striker on a baseline; world.striker is the mesh
//   world.pulse(corner, on)  a gentle ring round a pocket (the right answer, when it is shown)
//   world.light(on)          pendant light up for play, the room softened; back to normal when off
// The board uses the physics' own units (100 x 100, y south), so what is drawn is exactly what the physics simulates.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./carrom-physics.js') : root.CarromPhysics);
  if (isNode) module.exports = api;
  else root.CarromWorld = api;
})(this, function (P) {
  const CFG = P.CFG;
  // one colour and one shape per answer slot, so colour is never the only cue: amber triangle, green circle, cyan diamond, rose square
  const STYLE = [
    { name: 'amber', hex: 0xffb347, css: '#ffb347', glyph: 'triangle', mark: '▲' },
    { name: 'green', hex: 0x7dff8a, css: '#7dff8a', glyph: 'circle', mark: '●' },
    { name: 'cyan', hex: 0x5cd6ff, css: '#5cd6ff', glyph: 'diamond', mark: '◆' },
    { name: 'rose', hex: 0xff9db8, css: '#ff9db8', glyph: 'square', mark: '■' },
  ];
  const FRAME = 3 / 32;   // the printed frame of the lobby's carrom texture: 3 of 32 pixels on each side; the playing area is the rest
  const COIN_SCALE = 1.25;   // the coin is drawn a little larger than its physics circle, so it reads on the table (nothing else is on the board to collide with)

  // ---------------------------------------------------------------- pure
  function makeMapper(t) {
    const size = t.size || 1, play = size * (1 - 2 * FRAME), u = play / CFG.SIZE, x0 = t.x - play / 2, z0 = t.z - play / 2;
    return {
      u, play, x0, z0, top: t.top, x: t.x, z: t.z,
      toWorld: (bx, by) => ({ x: x0 + bx * u, y: t.top, z: z0 + by * u }),
      toBoard: (wx, wz) => ({ x: (wx - x0) / u, y: (wz - z0) / u }),
    };
  }

  // ---------------------------------------------------------------- the scene (browser only)
  function create(TF) {
    const { THREE, scene, MAT } = TF;
    const R = CFG.R_COIN, listeners = [], DIM_SUN = 0.34, DIM_HEMI = 0.46;
    const S = { table: null, m: null, built: false, active: false, leaving: false, idle: [], light: null, base: 0, coin: null, markers: [], rings: [], sparkles: null, env: null };
    const world = { state: S, STYLE };

    function glyphPath(g, kind, cx, cy, r) {
      g.beginPath();
      if (kind === 'triangle') { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.95, cy + r * 0.75); g.lineTo(cx - r * 0.95, cy + r * 0.75); g.closePath(); }
      else if (kind === 'circle') g.arc(cx, cy, r * 0.85, 0, 6.2832);
      else if (kind === 'diamond') { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.85, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.85, cy); g.closePath(); }
      else g.rect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5);
    }
    // the grooved face of a carrom man: a rim and two cut rings
    function rings(g, base, rim) {
      g.fillStyle = base; g.fillRect(0, 0, 64, 64); g.lineWidth = 2;
      g.strokeStyle = rim; g.beginPath(); g.arc(32, 32, 30, 0, 6.2832); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.34)'; g.beginPath(); g.arc(32, 32, 25.5, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(32, 32, 19, 0, 6.2832); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(32, 32, 27.5, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(32, 32, 21, 0, 6.2832); g.stroke();
    }

    // ---- the board: a full carrom board drawn over the lobby's table top (black frame, grey corner brackets, wood surface, baselines, arrows, compass star) ----
    // No lettering anywhere. Only the corner pockets are quiet: a dark hole with a thin brass lip (the answers' colours and shapes are laid inside them separately).
    function drawBoard(g, N) {
      const F = N * FRAME, U = (N - 2 * F) / 100, X = (v) => F + v * U;
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // a fixed grain, the same every time
      const arrow = (x, y, dx, dy, s) => { const a = Math.atan2(dy, dx), p = (k, d) => [x + Math.cos(a + k) * d * s, y + Math.sin(a + k) * d * s]; g.beginPath(); g.moveTo(x, y); g.lineTo(...p(2.7, 1.5)); g.lineTo(...p(-2.7, 1.5)); g.closePath(); g.fill(); };
      g.fillStyle = '#17120f'; g.fillRect(0, 0, N, N);   // frame: black wood with a faint grain
      g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
      for (let k = 0; k < 260; k++) { const v = rnd() * N, w = rnd() * F; g.beginPath(); g.moveTo(v, w); g.lineTo(v + (rnd() - 0.5) * 40, w + 3); g.stroke(); g.beginPath(); g.moveTo(w, v); g.lineTo(w + 3, v + (rnd() - 0.5) * 40); g.stroke(); g.beginPath(); g.moveTo(v, N - w); g.lineTo(v + (rnd() - 0.5) * 40, N - w - 3); g.stroke(); g.beginPath(); g.moveTo(N - w, v); g.lineTo(N - w - 3, v + (rnd() - 0.5) * 40); g.stroke(); }
      g.strokeStyle = '#cdb98c'; g.lineWidth = N * 0.0025; g.strokeRect(F * 0.55, F * 0.55, N - F * 1.1, N - F * 1.1);   // a thin inlay round the frame
      const surf = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N * 0.55); surf.addColorStop(0, '#d8bc8e'); surf.addColorStop(1, '#c4a174');   // playing surface: pale varnished wood
      g.fillStyle = surf; g.fillRect(F, F, N - 2 * F, N - 2 * F);
      for (let k = 0; k < 520; k++) { const x = F + rnd() * (N - 2 * F), y = F + rnd() * (N - 2 * F); g.strokeStyle = `rgba(120,80,40,${0.04 + rnd() * 0.06})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + 30 + rnd() * 90); g.stroke(); }
      g.strokeStyle = '#2a1d12'; g.lineWidth = N * 0.003; g.strokeRect(F + 1, F + 1, N - 2 * F - 2, N - 2 * F - 2);
      // the baselines: the south one is where the striker starts (y = BASE_Y); the same drawing turned for the other three sides
      for (let side = 0; side < 4; side++) {
        g.save(); g.translate(N / 2, N / 2); g.rotate((side * Math.PI) / 2); g.translate(-N / 2, -N / 2);
        const y0 = CFG.BASE_Y - 3.6, y1 = CFG.BASE_Y + 3.6;
        g.strokeStyle = '#17120f'; g.lineWidth = U * 0.55; g.beginPath(); g.moveTo(X(CFG.X_MIN), X(y1)); g.lineTo(X(CFG.X_MAX), X(y1)); g.stroke();
        g.lineWidth = U * 0.28; g.beginPath(); g.moveTo(X(CFG.X_MIN), X(y0)); g.lineTo(X(CFG.X_MAX), X(y0)); g.stroke();
        for (const bx of [CFG.X_MIN, CFG.X_MAX]) {   // the end discs: red, outlined
          g.beginPath(); g.arc(X(bx), X(CFG.BASE_Y), U * 3.5, 0, 6.2832); g.fillStyle = '#d42f2b'; g.fill(); g.lineWidth = U * 0.3; g.strokeStyle = '#17120f'; g.stroke();
        }
        g.restore();
      }
      // the diagonals: a line out to each pocket with an arrowhead, and a curved double arrow round its inner end
      for (let c = 0; c < 4; c++) {
        g.save(); g.translate(N / 2, N / 2); g.rotate((c * Math.PI) / 2); g.translate(-N / 2, -N / 2);
        g.strokeStyle = '#2a1d12'; g.fillStyle = '#2a1d12'; g.lineWidth = U * 0.22;
        g.beginPath(); g.moveTo(X(9), X(9)); g.lineTo(X(35), X(35)); g.stroke(); arrow(X(9), X(9), -1, -1, U * 1.1);
        g.beginPath(); g.arc(X(33.5), X(36.5), U * 4.4, 0.35, 5.55); g.stroke();
        arrow(X(33.5) + Math.cos(0.35) * U * 4.4, X(36.5) + Math.sin(0.35) * U * 4.4, 0.9, 0.3, U * 0.9); arrow(X(33.5) + Math.cos(5.55) * U * 4.4, X(36.5) + Math.sin(5.55) * U * 4.4, 0.3, -0.9, U * 0.9);
        g.restore();
      }
      // the centre: a circle, an eight-point star (long dark diagonals, short red axes) and a red heart
      g.strokeStyle = '#2a1d12'; g.lineWidth = U * 0.25; g.beginPath(); g.arc(X(50), X(50), U * 11.4, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(X(50), X(50), U * 10.4, 0, 6.2832); g.stroke();
      const kite = (ang, len, half, col) => { g.save(); g.translate(X(50), X(50)); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * U * 0.28, half * U); g.lineTo(len * U, 0); g.lineTo(len * U * 0.28, -half * U); g.closePath(); g.fill(); g.restore(); };
      for (let k = 0; k < 4; k++) kite(k * Math.PI / 2, 9.4, 1.1, '#c8302c');
      for (let k = 0; k < 4; k++) kite(Math.PI / 4 + k * Math.PI / 2, 10.2, 1.6, '#17120f');
      g.beginPath(); g.arc(X(50), X(50), U * 2.6, 0, 6.2832); g.fillStyle = '#d42f2b'; g.fill(); g.lineWidth = U * 0.3; g.strokeStyle = '#17120f'; g.stroke();
      // pockets: a plain dark hole with a thin brass lip, tucked into the corners exactly where the physics puts them
      for (const [cx, cy] of P.POCKETS) {
        g.beginPath(); g.arc(X(cx), X(cy), U * (CFG.R_POCKET + 0.6), 0, 6.2832); g.fillStyle = '#3b2c1c'; g.fill();
        g.beginPath(); g.arc(X(cx), X(cy), U * (CFG.R_POCKET + 0.15), 0, 6.2832); g.fillStyle = '#a98f58'; g.fill();
        const hole = g.createRadialGradient(X(cx), X(cy), U, X(cx), X(cy), U * CFG.R_POCKET); hole.addColorStop(0, '#0d0a07'); hole.addColorStop(1, '#241a11');
        g.beginPath(); g.arc(X(cx), X(cy), U * (CFG.R_POCKET - 0.5), 0, 6.2832); g.fillStyle = hole; g.fill();
      }
      for (const [x, y] of [[0, 0], [N - F, 0], [0, N - F], [N - F, N - F]]) {   // grey corner brackets over the frame corners
        g.fillStyle = '#8c9094'; g.fillRect(x, y, F, F); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5; for (let k = 6; k < F; k += 8) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + F); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, F - 3, F - 3);
      }
    }
    function board() {
      const tex = TF.canvasTex(1024, 1024, (g) => drawBoard(g, 1024), { nearest: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(S.m.size, S.m.size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.rotation.x = -Math.PI / 2; m.position.set(S.m.x, S.m.top + 0.0007, S.m.z); m.receiveShadow = true; m.userData.dyn = true; scene.add(m);
    }
    function rails() {   // thin raised cushions in dark wood along the playing edge
      const { x, z, top, play } = S.m, t = 0.018, h = 0.014;
      for (const [w, d, px, pz] of [[play + 2 * t, t, x, z - play / 2 - t / 2], [play + 2 * t, t, x, z + play / 2 + t / 2], [t, play, x - play / 2 - t / 2, z], [t, play, x + play / 2 + t / 2, z]]) {
        const b = TF.box(w, h, d, MAT.charcoal, px, top, pz, { s: 0 }); b.userData.dyn = true;
      }
    }
    function pendant() {
      const { x, z, top } = S.m, g = new THREE.Group(); g.position.set(x, top + 1.28, z); g.userData.dyn = true; scene.add(g);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1.3, 6), MAT.chrome); cord.position.y = 0.65; g.add(cord);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.19, 0.13, 18, 1, true), MAT.shade); shade.position.y = 0.02; g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffd58a, emissiveIntensity: 2.2 })); bulb.position.y = -0.03; g.add(bulb);
      S.base = 0.06; S.play = 0.08;   // the chandelier already lights this table: the pendant is a warm accent, not a second sun
      S.light = TF.pointLight('lab', 0xffdca8, S.base, 3.2, x, top + 1.25, z + 0.1);   // always a little on, so the number of lights never changes at run time
    }

    // ---- the pocket markers: a thin coloured ring and a shape inside each pocket, one set per answer slot, reused for every question ----
    const mats = [];
    function markers() {
      const u = S.m.u, geo = new THREE.CircleGeometry(CFG.R_POCKET * u * 0.92, 36);
      STYLE.forEach((st) => {
        const tex = TF.canvasTex(128, 128, (g) => {
          g.clearRect(0, 0, 128, 128);
          g.beginPath(); g.arc(64, 64, 60, 0, 6.2832); g.fillStyle = 'rgba(14,10,7,.72)'; g.fill();
          g.lineWidth = 5; g.strokeStyle = st.css; g.beginPath(); g.arc(64, 64, 56, 0, 6.2832); g.stroke();
          g.fillStyle = 'rgba(0,0,0,.45)'; glyphPath(g, st.glyph, 64, 67, 30); g.fill(); g.fillStyle = st.css; glyphPath(g, st.glyph, 64, 64, 28); g.fill();
        }, { nearest: false });
        mats.push(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
      });
      P.POCKETS.forEach(([bx, by]) => {
        const m = new THREE.Mesh(geo, mats[0]); m.rotation.x = -Math.PI / 2; const w = S.m.toWorld(bx, by); m.position.set(w.x, S.m.top + 0.0022, w.z); m.visible = false; m.userData.dyn = true; scene.add(m); S.markers.push(m);
        const ring = new THREE.Mesh(new THREE.RingGeometry(CFG.R_POCKET * u * 1.0, CFG.R_POCKET * u * 1.22, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(w.x, S.m.top + 0.003, w.z); ring.visible = false; ring.userData.dyn = true; scene.add(ring); S.rings.push(ring);
      });
    }
    world.setPockets = (options) => {
      S.markers.forEach((m) => { m.visible = false; });
      (options || []).forEach((o, slot) => { const m = S.markers[o.corner]; m.material = mats[slot]; m.visible = true; });
    };
    world.pulse = (corner, on) => { S.rings.forEach((r, i) => { r.visible = on && i === corner; }); S.pulseOn = on ? corner : null; };

    // ---- the coin, and the resting game that stays on the table when nobody is playing ----
    const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.dyn = true; scene.add(m); return m; };
    const place = (m, bx, by, lift) => { const w = S.m.toWorld(bx, by); m.position.set(w.x, w.y + lift, w.z); };
    function pieces() {
      const u = S.m.u, geo = new THREE.CylinderGeometry(R * u, R * u, 0.0062, 24), edge = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5 });
      const face = (base, rim) => new THREE.MeshStandardMaterial({ map: TF.canvasTex(64, 64, (g) => rings(g, base, rim), { nearest: false }), roughness: 0.45 });
      const rest = { black: [edge(0x1d1b18), face('#26231f', '#4a453d')], cream: [edge(0xe2cc9c), face('#ecd9b0', '#fff4d6')], queen: [edge(0xb02824), face('#c8302c', '#e86a60')] };
      // the striker: ivory, with a star on its face
      S.striker = mesh(new THREE.CylinderGeometry(CFG.R_STRIKER * u, CFG.R_STRIKER * u, 0.0085, 28), [edge(0xf1ead8), new THREE.MeshStandardMaterial({
        map: TF.canvasTex(64, 64, (g) => {
          g.fillStyle = '#f1e7cc'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#c8b98f'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 29, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(32, 32, 22, 0, 6.2832); g.stroke();
          g.fillStyle = '#b8742a'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? 7 : 15; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
          g.fillStyle = '#7a4416'; g.beginPath(); g.arc(32, 32, 3.2, 0, 6.2832); g.fill();
        }, { nearest: false }), roughness: 0.4 }), edge(0xf1ead8)]); S.striker.visible = false;
      // the coin you play: a cream man with a golden rim, a little larger than its physics circle
      const cgeo = new THREE.CylinderGeometry(R * u * COIN_SCALE, R * u * COIN_SCALE, 0.0068, 28);
      S.coin = mesh(cgeo, [edge(0xe2cc9c), face('#f1e1b8', '#d9b46a'), edge(0xe2cc9c)]); S.coin.visible = false;
      // the resting game: the opening formation, a queen with six men round her and twelve round those, black and cream in turn
      const spots = [[50, 50, 'queen']], ring = [];
      for (let k = 0; k < 6; k++) { const a = (k * 60 + 30) * Math.PI / 180; ring.push([a, 4.5], [a + Math.PI / 6, 7.8], [a, 9]); }
      const inner = ring.filter((r) => r[1] === 4.5), outer = ring.filter((r) => r[1] !== 4.5).sort((a, b) => a[0] - b[0]);
      inner.forEach(([a, d], k) => spots.push([50 + Math.cos(a) * d, 50 + Math.sin(a) * d, k % 2 ? 'cream' : 'black']));
      outer.forEach(([a, d], k) => spots.push([50 + Math.cos(a) * d, 50 + Math.sin(a) * d, k % 2 ? 'cream' : 'black']));
      for (const [bx, by, kind] of spots) { const m = mesh(geo, [rest[kind][0], rest[kind][1], rest[kind][0]]); place(m, bx, by, 0.0031); S.idle.push(m); }
    }
    const setIdle = (on) => S.idle.forEach((m) => { m.visible = on; });
    world.setCoin = (x, y, visible = true) => { place(S.coin, x, y, 0.0034); S.coin.visible = visible && S.active; world.coinAt = { x, y }; };
    world.setStriker = (x, y, visible = true) => { place(S.striker, x, y, 0.00425); S.striker.visible = visible && S.active; };
    Object.defineProperty(world, 'coin', { get: () => S.coin });
    Object.defineProperty(world, 'striker', { get: () => S.striker });

    // the room softens while the table is up and the lamp pools its light on the board (restored exactly on leaving)
    world.light = (on) => {
      if (S.light) S.light.intensity = on ? S.play : S.base;
      if (on && !S.env) { S.env = { sun: TF.sun.intensity, hemi: TF.hemi.intensity }; TF.sun.intensity = S.env.sun * DIM_SUN; TF.hemi.intensity = S.env.hemi * DIM_HEMI; }
      else if (!on && S.env) { TF.sun.intensity = S.env.sun; TF.hemi.intensity = S.env.hemi; S.env = null; }
    };

    // ---- camera: close, overhead, tilted; the follow camera and the hero come back exactly as they were ----
    const vec = (x, y, z) => new THREE.Vector3(x, y, z);
    world.view = () => ({ pos: vec(S.m.x, S.m.top + 1.06, S.m.z + 0.66), look: vec(S.m.x, S.m.top, S.m.z - 0.012) });   // looking a little past the middle puts the board lower, clear of the question card
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), proj = new THREE.Vector3();
    world.screenToBoard = (cx, cy) => {
      const r = TF.renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, TF.camera);
      const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.y) < 1e-6) return null;
      const t = (S.m.top - o.y) / d.y; return t < 0 ? null : S.m.toBoard(o.x + d.x * t, o.z + d.z * t);
    };
    world.toScreen = (bx, by, lift = 0) => {
      const w = S.m.toWorld(bx, by); proj.set(w.x, w.y + lift, w.z).project(TF.camera);
      const r = TF.renderer.domElement.getBoundingClientRect(); return { x: r.left + ((proj.x + 1) / 2) * r.width, y: r.top + ((1 - proj.y) / 2) * r.height, visible: proj.z < 1 };
    };
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    const emit = (evt) => listeners.forEach(([e, f]) => e === evt && f());

    world.enter = (cb) => {
      if (!S.built || S.active || S.leaving || TF.traveling || TF.talking || TF.zone !== 'lab') return false;
      S.active = true;
      TF.fade(() => {
        TF.lockPlayer(true); TF.hero.g.visible = false; setIdle(false); world.light(true); if (S.sparkles) S.sparkles.visible = false;
        const v = world.view(); TF.cameraTo(v.pos, v.look, 800);
        if (cb) cb();
        emit('enter');
      });
      return true;
    };
    world.leave = (cb) => {
      if (!S.active || S.leaving) return false;
      S.leaving = true;
      TF.fade(() => {
        TF.cameraRestore(0); TF.lockPlayer(false); TF.hero.g.visible = true;
        S.coin.visible = false; S.striker.visible = false; world.setPockets([]); world.pulse(0, false); setIdle(true); world.light(false); if (S.sparkles) S.sparkles.visible = true; S.active = false; S.leaving = false;
        if (cb) cb();
        emit('leave');
      });
      return true;
    };
    world.tick = (t) => { if (S.active && S.pulseOn != null) { const k = 1 + 0.08 * Math.sin(t * 6); S.rings[S.pulseOn].scale.set(k, k, k); } };
    world.open = () => false;   // carrom-play.js replaces this

    // ---- building, at boot ----
    world.table = (info) => { S.table = info; S.m = makeMapper(info); };
    world.build = () => {
      if (S.built || !S.table) return;
      board(); rails(); pendant(); markers(); pieces();
      if (TF.sparkles) S.sparkles = TF.sparkles(S.m.x, S.m.z, 0xffd27a, 18, 0.42, 1.5);   // the twinkle that says "you can play this"
      S.built = true; world.mapper = S.m;
    };
    world.mapperFor = makeMapper;
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.carrom = world;
    TF.life.push((t, dt) => world.tick(t, dt));
    TF.on('boot', () => world.build());
    if (typeof window !== 'undefined') window.carromWorld = world;
    return world;
  }
  return { STYLE, FRAME, COIN_SCALE, makeMapper, create, install };
});
