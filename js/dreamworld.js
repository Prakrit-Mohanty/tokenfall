// TokenFall — the picture-book world around the game. Browser only: window.Dreamworld.
//
//   * the lobby is a floating island: its lawn ends in a quilted border, a draped plaid skirt tapers away underneath with a fringe of tassels, and a sea of soft pastel clouds drifts below
//   * every outdoor place has little treasures drifting through the air: stars, keys, envelopes, ringed planets and crescent moons, drawn like coloured-pencil stickers
// Colours follow the time of day: daylight.js hands every mood's cloud colour to apply(). Nothing here collides with anything or touches the rules.
//   Dreamworld.install(TF)    TF.dream = { apply(p, inside, zone) }
(function (root) {
  const ISLAND = typeof V_ISLAND !== 'undefined' ? V_ISLAND : 53;   // the lobby's half-size, set by lobby-village.js (its lawn, its river and its tufts end here)
  const OUTDOOR_HIDDEN = { lab: 1, abz: 1, kitchen: 1 };            // roofed places have no sky to float in
  const PI = Math.PI;

  function install(TF) {
    const { THREE, scene } = TF;
    const S = { built: false, zone: 'lobby', last: null, group: null, sea: null, haze: null, puffs: [], treasures: [], seed: [] };

    // ---- little hand-painted textures ----
    const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (rep) t.repeat.set(rep[0], rep[1]); return t; };
    const blob = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 2 * PI); g.fill(); };
    const wrapped = (w, h, fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy); };
    const T = {
      // a plaid blanket: blue with rose, cream and butter stripes crossing, and a woven grain
      plaid: () => tex(128, 128, (g, w, h) => {
        g.fillStyle = '#4a5aa8'; g.fillRect(0, 0, w, h);
        for (const [pos, wd, col] of [[20, 14, 'rgba(236,150,170,.55)'], [64, 8, 'rgba(255,238,210,.6)'], [100, 12, 'rgba(240,206,120,.5)'], [44, 4, 'rgba(120,200,190,.5)']]) { g.fillStyle = col; g.fillRect(pos, 0, wd, h); g.fillRect(0, pos, w, wd); }
        for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(20,20,60,.09)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); g.fillRect(Math.random() * w, Math.random() * h, 3, 1); }
      }),
      // soft painted clouds on a lavender-cream sky colour, tiling
      clouds: () => tex(512, 512, (g, w, h) => {
        g.fillStyle = '#e6dcee'; g.fillRect(0, 0, w, h);
        const cols = ['rgba(255,255,255,A)', 'rgba(255,224,232,A)', 'rgba(226,214,255,A)', 'rgba(255,244,230,A)'];
        for (let i = 0; i < 110; i++) { const x = Math.random() * w, y = Math.random() * h, r = 28 + Math.random() * 70, c = cols[i % 4]; wrapped(w, h, (ox, oy) => blob(g, x + ox, y + oy, r, c, .55)); }
      }),
      // a puffy cloud: a cluster of soft circles, flat underneath
      puff: () => tex(256, 128, (g) => { for (const [x, y, r] of [[60, 80, 40], [100, 62, 50], [150, 68, 46], [195, 84, 36], [128, 90, 52]]) blob(g, x, y, r, 'rgba(255,255,255,A)', .95); blob(g, 128, 100, 90, 'rgba(255,230,240,A)', .35); }),
    };
    // the treasures: pencil-sticker shapes, a soft fill under a slightly wobbly dark-violet line
    const sticker = (draw) => tex(128, 128, (g) => { g.lineJoin = g.lineCap = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(86,66,104,.75)'; draw(g); });
    const star = (g, cx, cy, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, d = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } g.closePath(); };
    const KINDS = [
      { n: 14, size: 0.9, tex: sticker((g) => { star(g, 64, 66, 48, 22); g.fillStyle = '#ffe28a'; g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(52, 52, 7, 0, 7); g.fill(); }) },
      { n: 7, size: 1.0, tex: sticker((g) => { g.fillStyle = '#f7ecdc'; g.beginPath(); g.rect(16, 36, 96, 62); g.fill(); g.stroke(); g.beginPath(); g.moveTo(16, 38); g.lineTo(64, 74); g.lineTo(112, 38); g.stroke(); g.fillStyle = '#f08aa6'; g.beginPath(); g.arc(64, 74, 11, 0, 7); g.fill(); g.stroke(); }) },
      { n: 6, size: 0.95, tex: sticker((g) => { g.fillStyle = '#f3c25a'; g.beginPath(); g.arc(40, 40, 22, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#e8ddf5'; g.beginPath(); g.arc(40, 40, 8, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#f3c25a'; g.beginPath(); g.rect(54, 54, 14, 56); g.fill(); g.stroke(); g.beginPath(); g.rect(68, 80, 18, 10); g.fill(); g.stroke(); g.beginPath(); g.rect(68, 98, 12, 10); g.fill(); g.stroke(); }) },
      { n: 4, size: 1.9, tex: sticker((g) => { const gr = g.createRadialGradient(54, 50, 6, 64, 64, 40); gr.addColorStop(0, '#f2e4ff'); gr.addColorStop(1, '#b6a0e0'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill(); g.stroke(); g.strokeStyle = 'rgba(86,66,104,.75)'; g.lineWidth = 6; g.beginPath(); g.ellipse(64, 66, 58, 16, -0.35, 0, 2 * PI); g.stroke(); g.strokeStyle = '#f5d6e2'; g.lineWidth = 3; g.stroke(); }) },
      { n: 2, size: 2.5, tex: sticker((g) => { g.fillStyle = '#fff1c8'; g.beginPath(); g.arc(64, 64, 42, 0, 7); g.fill(); g.stroke(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(84, 54, 38, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; g.beginPath(); g.arc(64, 64, 42, PI * .55, PI * 1.45); g.stroke(); }) },
    ];

    function build() {
      const H = ISLAND, g = (S.group = new THREE.Group()); g.userData.dyn = true; scene.add(g);
      const plaid = new THREE.MeshStandardMaterial({ map: T.plaid(), roughness: 1, side: THREE.DoubleSide }); plaid.map.repeat.set(1, 1);
      // the draped skirt: rings of a square, shrinking and sinking, lumpy like a blanket hanging off a table
      { const N = 240, R = 10, DROP = 17, a0 = H, a1 = 14, pos = [], uv = [], idx = [], per = 8 * H;
        for (let k = 0; k <= R; k++) {
          const f = k / R, a = a0 + (a1 - a0) * Math.pow(f, 0.85), y = -0.6 - DROP * f;
          for (let i = 0; i <= N; i++) {
            const t = (i % N) / N, side = Math.floor(t * 4), u = t * 4 - side, lump = 1 + 0.045 * Math.sin(t * 91 + k * 1.3) * f + 0.03 * Math.sin(t * 37 - k);
            const q = [[-a + 2 * a * u, -a], [a, -a + 2 * a * u], [a - 2 * a * u, a], [-a, a - 2 * a * u]][side];
            pos.push(q[0] * lump, y - 0.6 * f * Math.sin(t * 53 + k), q[1] * lump); uv.push(t * per / 7, f * 3);
          }
        }
        for (let k = 0; k < R; k++) for (let i = 0; i < N; i++) { const a = k * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, plaid); m.receiveShadow = true; g.add(m);
      }
      // the quilted binding round the lawn's edge
      { const bind = new THREE.MeshStandardMaterial({ map: T.plaid(), roughness: 1 }); bind.map.repeat.set(30, 1);
        for (const [w, d, x, z] of [[2 * H, 1.8, 0, -H + 0.9], [2 * H, 1.8, 0, H - 0.9], [1.8, 2 * H, -H + 0.9, 0], [1.8, 2 * H, H - 0.9, 0]]) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), bind); me.position.set(x, -0.25, z); me.receiveShadow = true; g.add(me); } }
      // the fringe: tassels hanging from the skirt's top edge, in the blanket's colours, swaying a little
      { const N = 700, cols = ['#ec96aa', '#f4dcb8', '#f0ce78', '#8ccbc2', '#b7a6e0', '#e8e0f0'], geo = new THREE.PlaneGeometry(0.2, 1.7); geo.translate(0, -0.85, 0);
        const m = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
        m.onBeforeCompile = (sh) => { sh.uniforms.uT = TF.timeU; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec2 ip = instanceMatrix[3].xz; transformed.x += sin(uT * 1.4 + ip.x * .5 + ip.y * .35) * .1 * (-position.y) / 1.7;'); };
        const im = new THREE.InstancedMesh(geo, m, N), d = new THREE.Object3D(), col = new THREE.Color();
        for (let i = 0; i < N; i++) {
          const t = i / N, side = Math.floor(t * 4), u = t * 4 - side, e = H + 0.5, q = [[-e + 2 * e * u, -e, 0], [e, -e + 2 * e * u, PI / 2], [e - 2 * e * u, e, PI], [-e, e - 2 * e * u, -PI / 2]][side];
          d.position.set(q[0], -0.55 - Math.random() * 0.25, q[1]); d.rotation.set(0, q[2], 0); d.scale.set(0.8 + Math.random() * 0.7, 0.7 + Math.random() * 0.7, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.set(cols[i % cols.length]));
        }
        im.castShadow = false; g.add(im); }
      // the cloud sea below, a slow haze layer over it, and cloud puffs drifting round the island
      S.sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: T.clouds() })); S.sea.material.map.repeat.set(7, 7); S.sea.position.y = -26; g.add(S.sea);
      S.haze = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: T.clouds(), transparent: true, opacity: 0.6, depthWrite: false })); S.haze.material.map.repeat.set(5, 5); S.haze.position.y = -13; g.add(S.haze);
      const puffTex = T.puff();
      for (const [n, size, lo, hi] of [[34, 34, -16, -3], [26, 52, -22, -8]]) {
        const geo = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const ang = Math.random() * 2 * PI, r = H + 6 + Math.random() * 80; a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = lo + Math.random() * (hi - lo); a[i * 3 + 2] = Math.sin(ang) * r; }
        geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
        const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: puffTex, size, transparent: true, opacity: 0.85, depthWrite: false })); p.frustumCulled = false; g.add(p); S.puffs.push(p);
      }
      // the treasures
      for (const k of KINDS) {
        const a = new Float32Array(k.n * 3); for (let i = 0; i < k.n; i++) { a[i * 3] = (Math.random() - 0.5) * 48; a[i * 3 + 1] = 2.2 + Math.random() * 6.5; a[i * 3 + 2] = -20 + Math.random() * 22; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
        const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: k.tex, size: k.size, transparent: true, alphaTest: 0.05, depthWrite: false })); p.frustumCulled = false; p.userData.dyn = true; p.visible = false; scene.add(p);
        S.treasures.push(p); for (let i = 0; i < k.n; i++) S.seed.push(Math.random() * 100);
      }
      S.built = true; if (S.last) world.apply(...S.last);
    }

    // ---- the day tints the clouds; the island shows in the lobby, the treasures wherever there is a sky ----
    const world = {
      apply(p, inside, zone) {
        S.last = [p, inside, zone]; if (!S.built) return; S.zone = zone;
        S.group.visible = zone === 'lobby';
        const tint = new THREE.Color(p.cloud); S.sea.material.color.copy(tint); S.haze.material.color.copy(tint); for (const q of S.puffs) q.material.color.copy(tint);
        const lit = new THREE.Color(1, 1, 1).lerp(tint, 0.35); for (const q of S.treasures) { q.material.color.copy(lit); q.visible = !inside && !OUTDOOR_HIDDEN[zone]; }
      },
    };
    TF.life.push((t, dt) => {
      if (!S.built) return;
      if (S.group.visible) { S.haze.material.map.offset.x += dt * 0.0012; S.haze.material.map.offset.y += dt * 0.0006; S.sea.material.map.offset.x -= dt * 0.0004; for (const q of S.puffs) q.rotation.y += dt * 0.0025; }
      const hx = TF.hero.x, hz = TF.hero.y; let s = 0;
      for (const q of S.treasures) {
        const a = q.geometry.attributes.position;
        if (q.visible) for (let i = 0; i < a.count; i++, s++) {
          const sd = S.seed[s]; let x = a.getX(i) + (Math.sin(t * 0.3 + sd) * 0.25 + 0.12) * dt, y = a.getY(i) + Math.sin(t * 0.6 + sd * 2) * 0.12 * dt, z = a.getZ(i) + Math.cos(t * 0.25 + sd) * 0.2 * dt;
          x = hx + ((x - hx + 24) % 48 + 48) % 48 - 24; z = hz - 20 + (((z - hz + 20) % 22) + 22) % 22; a.setXYZ(i, x, y, z);
        } else s += a.count;
        a.needsUpdate = true;
      }
    });
    TF.on('boot', build);
    TF.dream = world;
    if (typeof window !== 'undefined') window.dreamworld = { state: S, world };
    return world;
  }
  root.Dreamworld = { install, ISLAND };
})(this);
