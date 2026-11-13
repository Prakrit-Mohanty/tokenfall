// TokenFall — the Story Corner. Browser only: window.StoryCorner.
//
// A patch of the lobby's lawn (the biggest free circle on the island, east of the pond) dressed like a page from a picture book: a big sleepy pup curled up on a plaid blanket with little Zs
// floating up, a wooden toy train rolling round it on its track, miniature houses with glowing windows, a ladder, a mailbox, a tea party on a tree stump and flower clusters.
// Everything is built from simple shapes. The window light is an ordinary emissive material, so daylight.js dims it by day and lights it up at night. Walk up to the pup and press E.
//   StoryCorner.install(TF)    TF.storycorner = { group, pup }
(function (root) {
  const O = { x: 37, z: 22 }, PI = Math.PI;

  function install(TF) {
    const { THREE, scene } = TF;
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o));
    const M = {
      fur: std(0xf6eee2, { roughness: 1 }), patch: std(0x6a5870, { roughness: 1 }), grey: std(0xd9d2ea, { roughness: 1 }), cheek: std(0xf0a8b6), nose: std(0x4a3a50), line: std(0x4a3a50),
      wood: std(0xc9a06c), darkWood: std(0x8a6444), wheel: std(0x7a5a46), rose: std(0xe9a4b4), butter: std(0xf0d078), mint: std(0xa8d4bc), sky: std(0x9cc4e4), lav: std(0xc4b0e0), cream: std(0xf4e8d2), red: std(0xd8606a),
      leaf: std(0x7fb08a), window: std(0xffd890, { emissive: 0xffbe60, emissiveIntensity: 1.5 }),   // a lamp-like emitter: daylight.js dims it by day and lights it at night
    };
    const plaid = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#d7788c'; g.fillRect(0, 0, 128, 128);
      for (const [p, w, col] of [[14, 18, 'rgba(255,240,214,.7)'], [60, 8, 'rgba(250,214,120,.65)'], [90, 16, 'rgba(120,160,220,.6)']]) { g.fillStyle = col; g.fillRect(p, 0, w, 128); g.fillRect(0, p, 128, w); }
      for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(60,20,40,.09)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 3); g.fillRect(Math.random() * 128, Math.random() * 128, 3, 1); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 4; return t; })();
    const S = { pup: null, zs: [], train: [], t0: 0 };

    const mesh = (geo, m, p, x, y, z, o = {}) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); if (o.s) me.scale.set(...o.s); if (o.r) me.rotation.set(...o.r); me.castShadow = o.cast !== false; me.receiveShadow = true; p.add(me); return me; };
    const sph = (r) => new THREE.SphereGeometry(r, 14, 10), box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 12) => new THREE.CylinderGeometry(a, b, h, n);

    function build() {
      const g = new THREE.Group(); g.position.set(O.x, 0, O.z); scene.add(g);

      // ---- the blanket and the sleeping pup ----
      const blanket = mesh(box(4.6, 0.06, 3.2), std(0xffffff, { map: plaid, roughness: 1 }), g, 0, 0.03, 0, { r: [0, 0.35, 0] });
      for (const e of [-1, 1]) for (let i = 0; i < 12; i++) mesh(box(0.05, 0.04, 0.22), [M.rose, M.cream, M.butter][i % 3], blanket, e * 2.34, 0.0, -1.4 + i * 0.255, { cast: false });   // fringe at both ends
      const pup = new THREE.Group(); pup.position.y = 0.06; pup.rotation.y = 0.35; g.add(pup); S.pup = pup;
      mesh(sph(0.95), M.fur, pup, 0, 0.7, 0, { s: [1.4, 0.76, 0.98] });                                   // body
      mesh(sph(0.5), M.patch, pup, -0.35, 1.02, -0.25, { s: [1.2, 0.45, 1], cast: false });               // a dark patch on the back
      mesh(sph(0.34), M.grey, pup, -0.95, 0.72, 0.4, { s: [1, 0.5, 1], cast: false });                    // a grey one on the hip
      mesh(sph(0.62), M.fur, pup, 1.35, 0.6, 0.15);                                                         // head
      mesh(sph(0.3), M.fur, pup, 1.82, 0.48, 0.15, { s: [1, 0.8, 1.1] });                                  // muzzle
      mesh(sph(0.08), M.nose, pup, 2.1, 0.55, 0.15);                                                        // nose
      for (const sd of [-1, 1]) {
        const eye = mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12, PI), M.line, pup, 1.78, 0.78, 0.15 + sd * 0.27, { r: [0, PI / 2, PI], cast: false });   // closed, sleeping eyes
        void eye;
        mesh(sph(0.1), M.cheek, pup, 1.6, 0.42, 0.15 + sd * 0.46, { s: [0.5, 1, 1], cast: false });         // rosy cheeks
        mesh(sph(0.36), M.patch, pup, 1.22, 0.4, 0.15 + sd * 0.66, { s: [0.55, 1.1, 0.8], r: [sd * 0.5, 0, 0] });   // floppy ears
        mesh(sph(0.26), M.fur, pup, 1.9, 0.14, 0.15 + sd * 0.34, { s: [1.3, 0.6, 0.8] });                    // front paws
      }
      mesh(sph(0.34), M.fur, pup, -1.0, 0.3, 0.72, { s: [1.2, 0.8, 0.9] }); mesh(sph(0.22), M.fur, pup, -1.45, 0.5, -0.2);   // a hind paw and the tail
      [M.rose, M.butter, M.mint, M.sky].forEach((m, i) => mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), m, pup, 0.88 - i * 0.07, 0.62, 0.15, { r: [0, PI / 2, 0], s: [1, 1, 1], cast: false }));   // a rainbow collar
      // the little Zs
      const zTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = '700 52px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = '#7a5a86'; x.strokeText('Z', 32, 34); x.fillStyle = '#ffe28a'; x.fillText('Z', 32, 34); return new THREE.CanvasTexture(c); })();
      for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); sp.userData.i = i; g.add(sp); S.zs.push(sp); }
      TF.colCirc(O.x - 0.2, O.z, 1.25); TF.colCirc(O.x + 1.3, O.z + 0.55, 0.6);

      // ---- the toy train: ties, two rails, and a locomotive with three wagons ----
      const R = 3.4, track = new THREE.Group(); g.add(track);
      for (let i = 0; i < 44; i++) { const a = i / 44 * 2 * PI; mesh(box(0.1, 0.04, 0.5), M.darkWood, track, Math.cos(a) * R, 0.02, Math.sin(a) * R, { r: [0, -a, 0], cast: false }); }
      for (const dr of [-0.17, 0.17]) mesh(new THREE.TorusGeometry(R + dr, 0.018, 6, 72), M.cream, track, 0, 0.06, 0, { r: [PI / 2, 0, 0], cast: false });
      const car = (m, loco) => {
        const c = new THREE.Group();
        mesh(box(0.5, 0.2, 0.3), m, c, 0, 0.2, 0); for (const sx of [-0.15, 0.15]) for (const sz of [-0.16, 0.16]) mesh(cyl(0.07, 0.07, 0.04, 10), M.wheel, c, sx, 0.09, sz, { r: [PI / 2, 0, 0] });
        if (loco) { mesh(cyl(0.12, 0.12, 0.34, 12), M.butter, c, 0.08, 0.42, 0, { r: [0, 0, PI / 2] }); mesh(cyl(0.05, 0.07, 0.16, 8), M.red, c, 0.22, 0.58, 0); mesh(box(0.18, 0.26, 0.28), M.rose, c, -0.16, 0.44, 0); mesh(box(0.2, 0.04, 0.34), M.darkWood, c, -0.16, 0.58, 0); }
        else mesh(box(0.42, 0.12, 0.26), M.cream, c, 0, 0.36, 0, { cast: false });
        g.add(c); return c;
      };
      [car(M.butter, true), car(M.mint), car(M.rose), car(M.sky)].forEach((c, i) => S.train.push({ c, off: -i * 0.66 / R, R }));

      // ---- miniature houses with glowing windows (on little stumps), a ladder, a mailbox, a tea party, flowers ----
      const house = (ang, r, wall, roof) => {
        const h = new THREE.Group(); h.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); h.rotation.y = -ang + PI / 2; g.add(h);
        mesh(cyl(0.34, 0.4, 0.16, 10), M.darkWood, h, 0, 0.08, 0);
        mesh(box(0.62, 0.5, 0.5), wall, h, 0, 0.41, 0); mesh(new THREE.ConeGeometry(0.5, 0.36, 4), roof, h, 0, 0.84, 0, { r: [0, PI / 4, 0] });
        mesh(box(0.1, 0.2, 0.1), M.cream, h, 0.18, 1.0, -0.08);
        mesh(box(0.14, 0.26, 0.04), M.darkWood, h, -0.1, 0.34, 0.26); for (const sx of [0.14, 0.24]) mesh(box(0.09, 0.1, 0.04), M.window, h, sx, 0.46, 0.26, { cast: false }); mesh(box(0.1, 0.1, 0.03), M.window, h, 0.32 * 0 + 0.0, 0.58, 0.26, { cast: false });
        TF.colCirc(O.x + Math.cos(ang) * r, O.z + Math.sin(ang) * r, 0.36); return h;
      };
      house(-1.25, 4.0, M.cream, M.rose); const h2 = house(0.35, 4.05, M.mint, M.butter); house(2.25, 4.0, M.lav, M.sky);
      { const lad = new THREE.Group(); lad.position.set(Math.cos(0.35) * 3.6 + 0.35, 0, Math.sin(0.35) * 3.6 + 0.2); lad.rotation.set(-0.28, 0.6, 0.12); g.add(lad); void h2;
        for (const sx of [-0.09, 0.09]) mesh(box(0.025, 0.85, 0.025), M.wood, lad, sx, 0.42, 0, { cast: false }); for (let i = 0; i < 6; i++) mesh(box(0.2, 0.02, 0.02), M.wood, lad, 0, 0.1 + i * 0.14, 0, { cast: false }); }
      { const m = new THREE.Group(); m.position.set(Math.cos(3.6) * 4.1, 0, Math.sin(3.6) * 4.1); g.add(m);   // a mailbox
        mesh(box(0.05, 0.6, 0.05), M.wood, m, 0, 0.3, 0); mesh(box(0.26, 0.2, 0.3), M.red, m, 0, 0.7, 0); mesh(cyl(0.13, 0.13, 0.3, 10), M.red, m, 0, 0.8, 0, { r: [PI / 2, 0, 0] }); mesh(box(0.02, 0.14, 0.08), M.butter, m, 0.14, 0.82, 0); TF.colCirc(O.x + Math.cos(3.6) * 4.1, O.z + Math.sin(3.6) * 4.1, 0.2); }
      { const t = new THREE.Group(); t.position.set(Math.cos(5.3) * 4.0, 0, Math.sin(5.3) * 4.0); g.add(t);   // a tea party on a stump
        mesh(cyl(0.34, 0.4, 0.34, 12), M.wood, t, 0, 0.17, 0); mesh(cyl(0.3, 0.3, 0.02, 12), M.darkWood, t, 0, 0.35, 0, { cast: false });
        mesh(sph(0.1), M.sky, t, 0, 0.47, 0); mesh(cyl(0.02, 0.03, 0.12, 6), M.sky, t, 0.1, 0.5, 0, { r: [0, 0, -0.9] }); mesh(cyl(0.025, 0.025, 0.05, 6), M.cream, t, 0, 0.59, 0);
        for (const sx of [-0.2, 0.2]) { mesh(cyl(0.045, 0.035, 0.06, 8), M.cream, t, sx, 0.39, 0.14); mesh(cyl(0.07, 0.07, 0.01, 10), M.rose, t, sx, 0.355, 0.14, { cast: false }); }
        TF.colCirc(O.x + Math.cos(5.3) * 4.0, O.z + Math.sin(5.3) * 4.0, 0.38); }
      const bloom = [M.rose, M.butter, M.lav, M.cream, M.sky];
      [-0.45, 1.4, 2.95, 4.45, 5.9].forEach((a, k) => { for (let i = 0; i < 5; i++) { const x = Math.cos(a) * 4.25 + (i - 2) * 0.1, z = Math.sin(a) * 4.25 + ((i * 7) % 3 - 1) * 0.12, h = 0.3 + (i % 3) * 0.1;
        mesh(cyl(0.012, 0.012, h, 5), M.leaf, g, x, h / 2, z, { cast: false }); mesh(sph(0.055), bloom[(i + k) % 5], g, x, h + 0.02, z, { cast: false }); } });
      if (TF.sparkles) TF.sparkles(O.x, O.z, 0xffe6a0, 22, 3.4, 2.4);   // the corner twinkles, so it gets found
      TF.INTER.push({ x: O.x + 2.5, z: O.z + 2.7, r: 2, label: 'Sleepy pup', verb: 'Say hello', act: () => TF.talk('Sleepy pup', ['Zzz... zzz...', 'Mmm. Even asleep, I read every word you gave me. Every single token.', 'Short, clear asks keep the nap cosy. Long rambles make me restless. Zzz...']) });
      S.group = g;
    }

    TF.life.push((t) => {
      if (!S.group) return;
      S.group.visible = TF.zone === 'lobby';
      if (!S.group.visible) return;
      S.pup.scale.y = 1 + Math.sin(t * 1.5) * 0.018;   // breathing
      for (const sp of S.zs) { const k = ((t * 0.28 + sp.userData.i / 3) % 1); sp.position.set(2.1 + k * 0.7, 1.5 + k * 1.3, 0.55 + Math.sin(k * 6) * 0.15); sp.scale.setScalar(0.35 + k * 0.4); sp.material.opacity = Math.sin(k * PI); }
      for (const v of S.train) { const a = t * 0.3 + v.off; v.c.position.set(Math.cos(a) * v.R, 0.06, Math.sin(a) * v.R); v.c.rotation.y = -a - PI / 2; }
    });
    TF.on('boot', build);
    TF.storycorner = S;
    return S;
  }
  root.StoryCorner = { install, ORIGIN: O };
})(this);
