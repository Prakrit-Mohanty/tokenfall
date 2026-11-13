// Prompt Kitchen — the look. Browser only: window.KitchenDecor. Candy-factory colours (Purble Place) on chunky, colour-coded stations (Overcooked): a checkerboard floor, a pink wallpapered
// back wall, rounded counters, a conveyor of cupcakes along the pass, pendant lamps, bunting, and round-faced customers who look at the player.
// Only looks: every collider, station and number stays in kitchen-world.js / kitchen-engine.js. Coordinates are kitchen-local metres (x right, z towards the camera).
//   KitchenDecor.make(TF, { A, ROOM, L0, BOXES, STYLE }) -> D
//   D.room()          the static room (merged by the caller's mergeStatic); returns the pendant lamps [{ g, ph }] that sway
//   D.customer(i)     a customer figure (a Group) for slot i; the caller owns the speech bubble
//   D.live()          the moving bits: the conveyor belt and its cupcakes, the player's ring
//   D.tick(t, sec, on)  per frame; on = the kitchen is the current zone
(function (root) {
  const PAL = {
    cream: 0xf1e1c6, white: 0xf3e6cf, pink: 0xe9bcb4, hot: 0xd98590, mint: 0xaecab2, teal: 0x4f9d94, sky: 0x8fb4cc, lemon: 0xe6c36e, orange: 0xd98a4e, lav: 0xb7a6cc,
    red: 0xc4544f, navy: 0x4d3b4c, dark: 0x3a2f3c, gold: 0xdca63a, leaf: 0x6ea571,
  };
  const BIN = [PAL.lemon, PAL.orange, PAL.mint, PAL.lav, PAL.hot, PAL.sky];
  const SKIN = [0xffe0c2, 0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];

  function make(TF, ctx) {
    const { THREE, scene } = TF, { A, ROOM: R, L0, BOXES, STYLE } = ctx, PI = Math.PI;
    const midZ = (R.zBack + R.zFront) / 2, depth = R.zFront - R.zBack, W = R.x1 - R.x0;
    const D = { belt: null, cakes: [], ring: null, mats: {} };

    // ---- materials and geometry ----
    const mats = {};
    const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0 }, o))); };
    const steel = () => mat(0xbdb6ab, { roughness: 0.4, metalness: 0.6 });
    const gold = () => mat(PAL.gold, { roughness: 0.38, metalness: 0.6 });
    const tex = (w, h, draw, rep) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(rep[0], rep[1]); return t;
    };
    const css = (n) => '#' + n.toString(16).padStart(6, '0');
    const rrectShape = (w, d, r) => {
      const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false); s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, PI / 2, false);
      s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, PI / 2, PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5, false); return s;
    };
    const geos = {};
    function rbGeo(w, h, d, r) {   // a rounded box standing on y = 0, centred on x and z
      const k = [w, h, d, r].join(','); if (geos[k]) return geos[k];
      const b = Math.min(0.05, h / 4, w / 4, d / 4), g = new THREE.ExtrudeGeometry(rrectShape(w - 2 * b, d - 2 * b, Math.max(0.001, Math.min(r, w / 2, d / 2) - b)), { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 });
      g.rotateX(-PI / 2); g.translate(0, b, 0); return (geos[k] = g);
    }
    const put = (g, m, x, y, z, o = {}) => {
      const me = new THREE.Mesh(g, m); me.position.set(A.cx + x, y, A.cz + z); if (o.ry) me.rotation.y = o.ry; if (o.rx) me.rotation.x = o.rx; if (o.rz) me.rotation.z = o.rz;
      me.castShadow = o.cast !== false; me.receiveShadow = true; if (o.dyn) me.userData.dyn = true; (o.p || scene).add(me); return me;
    };
    const rb = (w, h, d, r, m, x, y, z, o) => put(rbGeo(w, h, d, r), m, x, y, z, o);
    const cyl = (r0, r1, h, m, x, y, z, o = {}) => put(new THREE.CylinderGeometry(r0, r1, h, o.seg || 16), m, x, y + h / 2, z, o);
    const ball = (r, m, x, y, z, o = {}) => { const me = put(new THREE.SphereGeometry(r, 12, 8), m, x, y, z, o); if (o.sy) me.scale.y = o.sy; return me; };
    const wall = (w, h, m, x, y, z, ry) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(A.cx + x, y, A.cz + z); me.rotation.y = ry || 0; me.receiveShadow = true; scene.add(me); return me; };
    const flat = (w, d, m, x, y, z) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-PI / 2); const me = new THREE.Mesh(g, m); me.position.set(A.cx + x, y, A.cz + z); me.receiveShadow = true; scene.add(me); return me; };

    const T = {
      checker: () => tex(128, 128, (g, w, h) => { g.fillStyle = css(PAL.cream); g.fillRect(0, 0, w, h); g.fillStyle = '#b4c4a0'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); g.strokeStyle = 'rgba(120,90,60,.12)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); g.strokeRect(w / 2, 0, 0, h); }),
      stripes: (a, b, n) => tex(16 * n, 16, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = css(i % 2 ? b : a); g.fillRect(i * 16, 0, 16, h); } }),
      dots: () => tex(64, 64, (g, w, h) => { g.fillStyle = css(PAL.pink); g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,240,220,.38)'; for (const [x, y] of [[16, 16], [48, 48]]) { g.beginPath(); g.arc(x, y, 6, 0, 2 * PI); g.fill(); } g.fillStyle = 'rgba(255,240,220,.2)'; for (const [x, y] of [[48, 16], [16, 48]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 2 * PI); g.fill(); } }),
      meadow: () => tex(128, 128, (g, w, h) => { g.fillStyle = '#4a3a44'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,214,170,.07)'; for (const [x, y] of [[32, 32], [96, 96]]) { g.beginPath(); g.arc(x, y, 12, 0, 2 * PI); g.fill(); } g.fillStyle = 'rgba(230,160,140,.09)'; for (const [x, y] of [[96, 32], [32, 96]]) { g.beginPath(); g.arc(x, y, 7, 0, 2 * PI); g.fill(); } }),
      belt: () => tex(64, 64, (g, w, h) => { g.fillStyle = '#3d4256'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7f86a8'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(14, 8); g.lineTo(44, 32); g.lineTo(14, 56); g.stroke(); g.fillStyle = '#ffd84d'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5); }),
      sky: () => tex(128, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e0987a'); gr.addColorStop(1, '#f8d9a6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,232,206,.75)'; for (const [x, y, r] of [[34, 38, 11], [48, 34, 14], [62, 40, 10], [98, 22, 9], [108, 26, 11]]) { g.beginPath(); g.arc(x, y, r, 0, 2 * PI); g.fill(); } }),
      poster: (text, bg) => tex(256, 128, (g, w, h) => { g.fillStyle = css(bg); g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, h - 26, w, 26); g.fillStyle = css(PAL.navy); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 54px "Trebuchet MS", Arial, sans-serif'; g.fillText(text[0], w / 2, 46); g.font = '700 22px "Trebuchet MS", Arial, sans-serif'; g.fillText(text[1], w / 2, h - 13); }),
    };

    // ---- the room (static: merged by the caller) ----
    D.room = () => {
      // a diorama tray on a pastel ground
      { const m = new THREE.MeshStandardMaterial({ map: T.meadow(), roughness: 0.9 }); m.map.repeat.set(24, 18); flat(120, 90, m, 0, -0.56, 0); }
      rb(W + 1.8, 0.56, depth + 1.8, 0.4, mat(PAL.cream), 0, -0.56, midZ);
      { const m = new THREE.MeshStandardMaterial({ map: T.checker(), roughness: 0.55, metalness: 0 }); m.map.repeat.set(W / 3, depth / 3); flat(W, depth, m, 0, 0.012, midZ); }
      rb(W + 1.0, 0.3, 0.42, 0.18, mat(PAL.hot), 0, 0, R.zFront + 0.24);   // the front curb
      // the back wall: wallpaper, striped wainscot, a chair rail and a cap
      rb(W + 0.8, R.wall, 0.4, 0.1, mat(PAL.pink), 0, 0, R.zBack - 0.2);
      wall(W, R.wall - 1.7, new THREE.MeshStandardMaterial({ map: T.dots(), roughness: 0.7 }), 0, 1.7 + (R.wall - 1.7) / 2, R.zBack + 0.012).material.map.repeat.set(W / 1.7, (R.wall - 1.7) / 1.7);
      wall(W, 1.55, new THREE.MeshStandardMaterial({ map: T.stripes(PAL.white, PAL.pink, 72), roughness: 0.5 }), 0, 0.78, R.zBack + 0.02);
      rb(W, 0.14, 0.16, 0.06, mat(PAL.white), 0, 1.55, R.zBack + 0.08); rb(W + 1.0, 0.22, 0.62, 0.1, mat(PAL.white), 0, R.wall, R.zBack - 0.2);
      // the side walls are low, like Overcooked's cut-away rooms: the floor stays in sight
      for (const s of [-1, 1]) {
        rb(0.4, 2.0, depth + 0.4, 0.1, mat(PAL.pink), s * (R.x1 + 0.2), 0, midZ); rb(0.66, 0.18, depth + 0.7, 0.08, mat(PAL.white), s * (R.x1 + 0.2), 2.0, midZ);
        wall(depth, 1.5, new THREE.MeshStandardMaterial({ map: T.stripes(PAL.white, PAL.pink, 40), roughness: 0.5 }), s * (R.x1 - 0.015), 0.78, midZ, s > 0 ? -PI / 2 : PI / 2);
      }
      // two windows with a sky in them
      for (const x of [-7.4, 7.4]) {
        rb(2.7, 1.3, 0.14, 0.12, mat(PAL.white), x, 1.95, R.zBack + 0.07); wall(2.3, 0.95, new THREE.MeshStandardMaterial({ map: T.sky(), roughness: 0.4, emissive: 0xd9a070, emissiveMap: T.sky(), emissiveIntensity: 0.3 }), x, 2.42, R.zBack + 0.16);
        rb(0.07, 0.95, 0.04, 0.02, mat(PAL.white), x, 1.95 + 0.17, R.zBack + 0.18); rb(2.8, 0.1, 0.34, 0.05, mat(PAL.hot), x, 1.88, R.zBack + 0.2);
      }
      // posters between the lamps, a wall clock by the east wall
      for (const [x, text, bg] of [[-3.76, ['TRIM IT', 'keep only what helps'], PAL.lemon], [3.76, ['WIPE IT', 'start the pot fresh'], PAL.mint]]) {
        rb(1.9, 1.05, 0.08, 0.06, mat(PAL.white), x, 2.0, R.zBack + 0.06); wall(1.7, 0.85, new THREE.MeshStandardMaterial({ map: T.poster(text, bg), roughness: 0.6 }), x, 2.42, R.zBack + 0.12);
      }
      cyl(0.4, 0.4, 0.08, mat(PAL.hot), 10.1, 2.55, R.zBack + 0.1, { rx: PI / 2 }).position.y = 2.95; cyl(0.33, 0.33, 0.09, mat(PAL.white), 10.1, 2.55, R.zBack + 0.11, { rx: PI / 2 }).position.y = 2.95;
      rb(0.05, 0.3, 0.03, 0.01, mat(PAL.navy), 10.1, 2.95, R.zBack + 0.17); rb(0.22, 0.05, 0.03, 0.01, mat(PAL.navy), 10.2, 2.95, R.zBack + 0.17);
      // bunting along the top of the wall
      { const tri = new THREE.Shape(); tri.moveTo(-0.22, 0); tri.lineTo(0.22, 0); tri.lineTo(0, -0.46); const g = new THREE.ShapeGeometry(tri), cols = [PAL.hot, PAL.lemon, PAL.mint, PAL.sky, PAL.lav, PAL.orange];
        for (let i = 0; i < 31; i++) { const t = i / 30, x = R.x0 + 0.5 + t * (W - 1.0), y = 3.28 - 0.3 * 4 * t * (1 - t); put(g, mat(cols[i % 6], { side: THREE.DoubleSide }), x, y, R.zBack + 0.14, { cast: false }); }
        rb(W - 0.8, 0.04, 0.04, 0.015, mat(PAL.white), 0, 3.28, R.zBack + 0.14, { cast: false });
        const bulb = new THREE.SphereGeometry(0.065, 8, 6), glow = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc064, emissiveIntensity: 1.5, roughness: 0.4 });
        for (let i = 0; i < 31; i++) { const t = (i + 0.5) / 31, x = R.x0 + 0.5 + t * (W - 1.0); put(bulb, glow, x, 3.28 - 0.3 * 4 * t * (1 - t) - 0.1, R.zBack + 0.2, { cast: false }); } }
      // a rug under the work area, and plants on the ends of the pantry counter
      rb(8.6, 0.02, 3.6, 0.4, mat(PAL.hot), 0, 0.012, -3.9); rb(8.0, 0.025, 3.0, 0.34, mat(PAL.cream), 0, 0.012, -3.9); rb(7.4, 0.03, 2.4, 0.3, mat(PAL.pink), 0, 0.012, -3.9);
      for (const x of [-8.95, 8.95]) { cyl(0.2, 0.15, 0.3, mat(PAL.orange), x, 1.02, -7.1); [[0, 1.5, 0, 0.26], [-0.14, 1.38, 0.05, 0.18], [0.15, 1.4, -0.03, 0.18]].forEach(([dx, y, dz, r]) => ball(r, mat(PAL.leaf), x + dx, y, -7.1 + dz)); }
      // the pantry counter and its six colour-coded bins
      rb(18.8, 0.9, 1.3, 0.14, mat(PAL.sky), 0, 0, -7.25); rb(19.1, 0.12, 1.5, 0.08, mat(PAL.cream), 0, 0.9, -7.25); rb(18.4, 0.07, 0.03, 0.02, mat(PAL.white), 0, 0.5, -6.59);
      L0.crates.forEach((p, i) => {
        const c = BIN[i % BIN.length]; rb(1.5, 0.5, 0.9, 0.12, mat(c), p.x, 1.02, -7.1); rb(1.58, 0.07, 0.98, 0.05, mat(PAL.white), p.x, 1.5, -7.1); rb(0.6, 0.09, 0.03, 0.03, mat(PAL.dark), p.x, 1.2, -6.64);
        for (let k = 0; k < 3; k++) ball(0.16, mat(BIN[(i + k + 2) % BIN.length]), p.x - 0.4 + k * 0.4, 1.7, -7.15 + (k % 2) * 0.1);
      });
      // the chopping board (lemon) and the sieve (lavender)
      for (const [k, box] of [['chop', BOXES.chop], ['sieve', BOXES.sieve]]) {
        const cx = (box[0] + box[2]) / 2, cz = (box[1] + box[3]) / 2; rb(1.6, 0.9, 1.2, 0.12, mat(k === 'chop' ? PAL.lemon : PAL.lav), cx, 0, cz); rb(1.72, 0.1, 1.32, 0.07, mat(PAL.cream), cx, 0.9, cz);
        if (k === 'chop') {
          rb(1.1, 0.09, 0.72, 0.08, mat(PAL.white), cx, 1.0, cz); rb(0.52, 0.03, 0.11, 0.015, steel(), cx - 0.1, 1.09, cz + 0.2, { ry: 0.3 }); rb(0.17, 0.05, 0.1, 0.03, mat(PAL.red), cx + 0.2, 1.09, cz + 0.28, { ry: 0.3 });
          [[-0.35, -0.12, PAL.red], [-0.12, -0.2, PAL.orange], [0.12, -0.12, PAL.leaf], [0.34, -0.2, PAL.hot]].forEach(([dx, dz, c]) => cyl(0.1, 0.1, 0.05, mat(c), cx + dx, 1.09, cz + dz));
        } else {
          cyl(0.58, 0.42, 0.34, mat(PAL.teal), cx, 1.0, cz); put(new THREE.TorusGeometry(0.58, 0.04, 6, 20), mat(PAL.white), cx, 1.34, cz, { rx: PI / 2 });
          const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), mat(0xdfe6ee, { roughness: 0.5, metalness: 0.6 })); mesh.rotation.x = -PI / 2; mesh.position.set(A.cx + cx, 1.31, A.cz + cz); scene.add(mesh);
          for (const q of [-1, 1]) ball(0.07, steel(), cx + q * 0.62, 1.2, cz);
        }
      }
      // the stock shelf over the middle of the pantry counter
      { const sx = L0.stockShelf.x; rb(1.5, 0.1, 0.55, 0.05, mat(PAL.hot), sx, 2.18, R.zBack + 0.32); for (const q of [-1, 1]) rb(0.08, 0.45, 0.4, 0.03, mat(PAL.white), sx + q * 0.62, 1.78, R.zBack + 0.3); }
      // the stoves: red enamel, a white top, front knobs and an oven window; a backsplash behind them
      L0.stoves.forEach((s, i) => {
        rb(1.6, 0.9, 1.6, 0.14, mat(PAL.red, { roughness: 0.25 }), s.x, 0, s.z); rb(1.66, 0.08, 1.66, 0.07, mat(PAL.white), s.x, 0.9, s.z);
        rb(1.0, 0.42, 0.04, 0.06, mat(PAL.dark, { roughness: 0.1, metalness: 0.2 }), s.x, 0.2, s.z + 0.8); rb(0.8, 0.05, 0.05, 0.02, steel(), s.x, 0.7, s.z + 0.83);
        for (const k of [-0.5, 0.5]) cyl(0.1, 0.1, 0.08, mat(PAL.cream), s.x + k, 0.64, s.z + 0.83, { rx: PI / 2 }).position.y = 0.7;
        const ring = put(new THREE.TorusGeometry(0.42, 0.04, 5, 20), TF.glowStrip(STYLE[0].hex), s.x, 0.99, s.z, { rx: PI / 2, dyn: true });
        const pc = i ? PAL.orange : PAL.teal; cyl(0.5, 0.46, 0.62, mat(pc, { roughness: 0.25 }), s.x, 1.0, s.z); put(new THREE.TorusGeometry(0.5, 0.05, 6, 18), mat(PAL.white), s.x, 1.62, s.z, { rx: PI / 2 });
        for (const q of [-1, 1]) rb(0.22, 0.09, 0.12, 0.04, mat(PAL.white), s.x + q * 0.58, 1.42, s.z);
        wall(2.0, 1.2, new THREE.MeshStandardMaterial({ map: T.stripes(PAL.white, PAL.lemon, 16), roughness: 0.4 }), s.x, 2.3, R.zBack + 0.03); rb(2.1, 0.08, 0.1, 0.03, steel(), s.x, 1.7, R.zBack + 0.1);
        void ring;
      });
      // the pass: a pink counter with a striped front, a cream top and a gold bell; a low ticket rail at its west end
      rb(23.2, 1.1, 0.8, 0.14, mat(PAL.hot), 0, 0, -0.6); wall(22.6, 0.8, new THREE.MeshStandardMaterial({ map: T.stripes(PAL.white, PAL.pink, 80), roughness: 0.4 }), 0, 0.5, -0.19); rb(23.5, 0.12, 1.04, 0.07, mat(PAL.cream), 0, 1.1, -0.6);
      rb(5.6, 0.05, 0.08, 0.02, mat(PAL.lemon, { emissive: PAL.lemon, emissiveIntensity: 0.5 }), 0, 1.22, -0.1, { cast: false });
      put(new THREE.SphereGeometry(0.17, 12, 6, 0, 2 * PI, 0, PI / 2), gold(), 1.6, 1.24, -0.6); cyl(0.21, 0.21, 0.04, gold(), 1.6, 1.22, -0.6); ball(0.045, mat(PAL.red), 1.6, 1.43, -0.6);
      for (const x of [-9.7, -4.1]) rb(0.1, 0.55, 0.1, 0.04, mat(PAL.lemon), x, 1.2, -0.86); rb(5.7, 0.07, 0.07, 0.03, steel(), -6.9, 1.68, -0.86);
      // the way out: a teal door in the east wall with a gold knob, and a mat
      rb(0.2, 2.7, 2.5, 0.08, mat(PAL.navy), R.x1 - 0.1, 0, -2.4); rb(0.12, 2.35, 1.95, 0.1, mat(PAL.teal), R.x1 - 0.22, 0, -2.4); ball(0.1, gold(), R.x1 - 0.34, 1.15, -1.7);
      rb(2.4, 0.03, 2.2, 0.12, mat(PAL.hot), 10.4, 0.012, -2.4); rb(1.9, 0.034, 1.7, 0.1, mat(PAL.cream), 10.4, 0.014, -2.4);
      // the customers' side: a rug, plants, and the odd bit of kit against the walls
      rb(R.x1 * 2 - 3, 0.025, 2.5, 0.2, mat(PAL.lav), 0, 0.012, 1.55); rb(R.x1 * 2 - 3.5, 0.03, 2.0, 0.18, mat(PAL.cream), 0, 0.014, 1.55);
      for (const x of [-R.x1 + 0.9, R.x1 - 0.9]) { cyl(0.34, 0.26, 0.5, mat(PAL.orange), x, 0, 2.2); [[0, 0.95, 0, 0.42], [-0.22, 0.75, 0.1, 0.3], [0.22, 0.78, -0.08, 0.3]].forEach(([dx, y, dz, r]) => ball(r, mat(PAL.leaf), x + dx, y, 2.2 + dz)); }
      cyl(0.3, 0.26, 0.7, mat(0xaeb6c4, { roughness: 0.3, metalness: 0.5 }), R.x1 - 0.55, 0, -5.2); cyl(0.32, 0.32, 0.07, mat(PAL.dark), R.x1 - 0.55, 0.7, -5.2);   // a bin
      cyl(0.11, 0.11, 0.55, mat(PAL.red, { roughness: 0.25 }), -R.x1 + 0.5, 0, -5.2); cyl(0.04, 0.04, 0.1, mat(PAL.dark), -R.x1 + 0.5, 0.55, -5.2);       // a fire extinguisher
      return [];
    };

    // pendant lamps: a cord, a candy-coloured globe, the warm light comes from the point lights
    D.lamps = () => {
      const lamps = [], globe = new THREE.SphereGeometry(0.33, 14, 10), cap = new THREE.CylinderGeometry(0.14, 0.2, 0.14, 10), cord = new THREE.BoxGeometry(0.03, 0.5, 0.03), cols = [PAL.hot, PAL.lemon, PAL.mint, PAL.lav, PAL.sky, PAL.orange];
      for (let i = 0; i < 6; i++) {
        const x = -9.4 + i * 3.76, c = cols[i];
        rb(0.08, 0.08, 0.7, 0.03, mat(PAL.white), x, 3.05, R.zBack + 0.38);
        const g = new THREE.Group(); g.userData.dyn = true; g.position.set(A.cx + x, 3.05, A.cz + R.zBack + 0.68);
        const a = new THREE.Mesh(cord, mat(PAL.white)); a.position.y = -0.25; const k = new THREE.Mesh(cap, gold()); k.position.y = -0.55;
        const b = new THREE.Mesh(globe, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.5 })); b.position.y = -0.82; b.scale.y = 1.1;
        g.add(a, k, b); scene.add(g); lamps.push({ g, ph: i * 1.3 });
      }
      return lamps;
    };

    // ---- the customers: round faces turned to the player ----
    D.customer = (i) => {
      const out = new THREE.Group(), g = new THREE.Group(), body = [PAL.hot, PAL.mint, PAL.lemon, PAL.lav, PAL.sky][i % 5], skin = SKIN[(i * 2 + 1) % SKIN.length], bm = mat(body, { roughness: 0.5 }), sm = mat(skin, { roughness: 0.6 });
      const add = (m) => { m.castShadow = true; g.add(m); return m; };
      const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), bm)); b.scale.set(1, 1.15, 0.9); b.position.y = 0.58;
      const h = add(new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 10), sm)); h.position.y = 1.42;
      for (const q of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), mat(PAL.white, { roughness: 0.2 })); e.position.set(q * 0.15, 1.5, 0.3); g.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(PAL.dark)); p.position.set(q * 0.15, 1.5, 0.385); g.add(p);
        const ch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(PAL.hot, { roughness: 0.7 })); ch.scale.z = 0.4; ch.position.set(q * 0.26, 1.37, 0.31); g.add(ch);
        const arm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), sm); arm.position.set(q * 0.5, 0.65, 0.12); g.add(arm);
      }
      const sm2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 5, 10, PI), mat(PAL.dark)); sm2.rotation.z = PI; sm2.position.set(0, 1.4, 0.355); g.add(sm2);
      const hat = i % 3;   // a party cone, a top hat or a bow
      if (hat === 0) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.44, 10), mat(PAL.orange)); c.position.set(0, 1.9, 0); g.add(c); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(PAL.white)); pom.position.set(0, 2.14, 0); g.add(pom); }
      else if (hat === 1) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), mat(PAL.dark)); c.position.set(0, 1.92, 0); g.add(c); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 14), mat(PAL.dark)); br.position.set(0, 1.77, 0); g.add(br); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 12), mat(PAL.hot)); band.position.set(0, 1.82, 0); g.add(band); }
      else { for (const q of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(PAL.red)); w.rotation.z = q * PI / 2; w.position.set(q * 0.12 + 0.12 * 0, 1.78, 0.02); w.position.x = q * 0.13; g.add(w); } const kn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(PAL.red)); kn.position.set(0, 1.78, 0.02); g.add(kn); }
      g.rotation.x = -0.45;   // leaning back a little, so the face tips up to the high camera
      out.add(g); out.scale.setScalar(1.12); return out;
    };

    // ---- the moving bits: a conveyor with cupcakes along the pass, and the player's ring ----
    const BELT = 22.4;   // the belt's length: the pass is 23.2 m wide
    D.live = () => {
      const belt = new THREE.MeshStandardMaterial({ map: T.belt(), roughness: 0.7 }); belt.map.repeat.set(BELT / 0.5, 1);
      const g = new THREE.PlaneGeometry(BELT, 0.5); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, belt); m.position.set(A.cx, 1.225, A.cz - 0.62); m.userData.dyn = true; m.receiveShadow = true; scene.add(m); D.belt = m;
      const base = new THREE.CylinderGeometry(0.17, 0.12, 0.17, 10), top = new THREE.SphereGeometry(0.19, 10, 7), cherry = new THREE.SphereGeometry(0.055, 8, 6), cols = [PAL.hot, PAL.mint, PAL.lemon, PAL.lav, PAL.sky, PAL.orange, PAL.pink];
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Group(); c.userData.dyn = true;
        const a = new THREE.Mesh(base, mat(PAL.cream)); a.position.y = 0.085; const f = new THREE.Mesh(top, mat(cols[i])); f.scale.y = 0.75; f.position.y = 0.24; const ch = new THREE.Mesh(cherry, mat(PAL.red)); ch.position.y = 0.42;
        [a, f, ch].forEach((x) => { x.castShadow = true; c.add(x); }); c.position.set(A.cx - 10.6 + i * 3.2, 1.23, A.cz - 0.62); scene.add(c); D.cakes.push(c);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.62, 28), new THREE.MeshBasicMaterial({ color: PAL.lemon, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -PI / 2; ring.position.y = 0.05; ring.visible = false; ring.renderOrder = 2; TF.hero.g.add(ring); D.ring = ring;
    };
    // the player's character is a small sprite: bigger in here, so it reads from the steep view (its shadow with it)
    D.hero = (on) => {
      const h = TF.hero, k = on ? D.HERO : TF.charScale || 1; if (!h || !h.mesh) return; h.mesh.scale.setScalar(k);
      const sh = h.g.children.find((c) => c.isMesh && c !== h.mesh && c.rotation.x < -1); if (sh) sh.scale.setScalar(k);
    };
    D.HERO = 1.45;
    D.tick = (t, sec, on) => {
      if (D.belt) { D.belt.material.map.offset.x += sec * 0.55; }
      for (const c of D.cakes) { c.position.x -= sec * 0.275; if (c.position.x < A.cx - BELT / 2) c.position.x += BELT; }
      if (D.ring) { D.ring.visible = !!on; D.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06); }
    };
    return D;
  }
  root.KitchenDecor = { make, PAL };
})(this);
