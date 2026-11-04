// The Glass Bridge — the 3D world. Browser: window.BridgeWorld. Node: require('./bridge-world.js') (layout maths only).
//
//   computeLayout(runSpec, {cx, cz}) -> layout   pure geometry: where every platform, row, tile and interlude piece sits
//   surfaceAt(layout, x, z, t, pad)  -> surface | null   what the hero would stand on (null = the void); t = world seconds
//   create(TokenFall, opts)          -> world    builds the course in the 3D scene with the lobby's own helpers
//
// world: { register(runSpec, o), build(runSpec), dispose(), rerollRow(runSpec, i), layout, tiles, surfaceAt(x, z, t, pad), colorAt(z) }
// The course runs north (-z) from the start platform; every surface's top is y = 0 (the hero's feet height).
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./bridge-generator.js') : root.BridgeGenerator);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BridgeWorld = api;
})(this, function (G) {
  // ---- measurements (world units) ----
  // Big, close and forgiving: a plain walking jump clears every normal gap, so nobody needs Shift or fast reflexes.
  const DIM = {
    TILE_W: 3.6, TILE_D: 2.6, TILE_H: 0.16, LANE_GAP: 1.0, ROW_GAP: 2.0,
    PLAT_W: 18, START_D: 8, PLAT_D: 7, END_D: 10, GANTRY_H: 4.2, HALF_W: 9.5,
    STONE: 2.6, STONE_GAP: 1.4, PAD_D: 2.4, MOVE_VOID: 9.0, MOVE_GAP: 0.4, MOVE_W: 5.2, MOVE_D: 3.0, BEAM_W: 1.6, BEAM_LEN: 10, VANISH_GAP: 1.0,
  };
  // The jump the bridge is calibrated to (bridge-play.js uses exactly these). Walk 3.3 u/s, run x1.8, like the lobby.
  // Generous on purpose: 0.15 s of coyote time and jump buffer, and a wide landing zone that snaps you onto the glass.
  const PHYS = { WALK: 3.3, RUN: 3.3 * 1.8, GRAVITY: 30.4, JUMP_V: 8.36, COYOTE: 0.15, BUFFER: 0.15, LAND_PAD: 0.4, EDGE: 0.1 };
  PHYS.AIR = (2 * PHYS.JUMP_V) / PHYS.GRAVITY;                    // 0.55 s in the air
  PHYS.APEX = (PHYS.JUMP_V * PHYS.JUMP_V) / (2 * PHYS.GRAVITY);   // 1.15 high
  // widest gap crossable at a given speed: take off at the edge (+ coyote time, + the tiny edge tolerance), land on the far edge (+ the generous landing hitbox)
  PHYS.reach = (speed, coyote = true) => speed * (PHYS.AIR + (coyote ? PHYS.COYOTE : 0)) + PHYS.LAND_PAD + PHYS.EDGE;

  const ZONE_HEX = { amber: 0xffb347, green: 0x7dff8a, cyan: 0x5cd6ff, gold: 0xffd27a };
  const CP_COLOR = ['green', 'cyan', 'gold']; // a checkpoint wears the colour of the stage it leads into

  // ---- pure layout ----
  function movingU(s, t) { // 0..1 along the gap, dwelling at both ends so a player can step on and off
    const f = (((t + s.phase) % s.period) + s.period) % s.period / s.period, ease = (u) => u * u * (3 - 2 * u);
    if (f < 0.16) return 0;                        // waits at each end long enough to step on and off calmly
    if (f < 0.5) return ease((f - 0.16) / 0.34);
    if (f < 0.66) return 1;
    return ease(1 - (f - 0.66) / 0.34);
  }
  function vanishState(s, t) {
    const p = (((t + s.phase) % s.period) + s.period) % s.period;
    return { visible: p < s.on, warn: p < s.on && p > s.on - 0.8 };
  }
  function movingRect(s, t) {
    const south = s.zA + (s.zB - s.zA) * movingU(s, t);
    return { x0: s.x0, x1: s.x1, z0: south - s.d, z1: south };
  }

  function computeLayout(spec, cfg = {}) {
    const cx = cfg.cx != null ? cfg.cx : 0, cz = cfg.cz != null ? cfg.cz : 700;
    const L = { cx, cz, platforms: [], rows: [], interludes: [], surfaces: [], bands: [], gapRows: [] };
    const byId = {};
    spec.rows.forEach((r, i) => { byId[r.id] = { row: r, i }; });
    const rowStage = {};
    spec.stages.forEach((st, si) => st.rowIds.forEach((id) => { rowStage[id] = si; }));
    let z = cz + DIM.START_D / 2, cp = 0, rowNo = 0, bossNo = 0;
    const place = (depth, gap) => { const zs = z - gap, zn = zs - depth; z = zn; return { zs, zn, zc: (zs + zn) / 2 }; };
    const rect = (kind, id, x0, x1, zn, zs, extra) => { const s = Object.assign({ kind, id, x0, x1, z0: zn, z1: zs, y: 0 }, extra); L.surfaces.push(s); return s; };
    const band = (zone, zs) => { let b = L.bands.find((x) => x.zone === zone); if (!b) L.bands.push((b = { zone, zs, zn: zs })); return b; };

    for (const it of spec.sequence) {
      if (it.type === 'start' || it.type === 'checkpoint' || it.type === 'end') {
        const depth = it.type === 'start' ? DIM.START_D : it.type === 'end' ? DIM.END_D : DIM.PLAT_D;
        const p = place(depth, it.type === 'start' ? 0 : DIM.ROW_GAP);
        const zone = it.type === 'start' ? 'amber' : it.type === 'end' ? 'gold' : CP_COLOR[cp++];
        const plat = Object.assign({ kind: it.type, index: L.platforms.length, zone, x: cx, w: DIM.PLAT_W }, p);
        L.platforms.push(plat);
        rect('platform', it.type + plat.index, cx - DIM.PLAT_W / 2, cx + DIM.PLAT_W / 2, p.zn, p.zs, { platform: plat.index });
      } else if (it.type === 'row') {
        const { row, i } = byId[it.row], n = row.tiles.length, width = n * DIM.TILE_W + (n - 1) * DIM.LANE_GAP;
        const p = place(DIM.TILE_D, DIM.ROW_GAP);
        const label = row.bonus ? 'BONUS' : row.boss ? 'BOSS ' + ++bossNo + '/3' : 'ROW ' + ++rowNo;
        const zone = row.boss ? 'gold' : row.zone;
        const tiles = row.tiles.map((_, lane) => {
          const x = cx + (lane - (n - 1) / 2) * (DIM.TILE_W + DIM.LANE_GAP);
          rect('tile', row.id + ':' + lane, x - DIM.TILE_W / 2, x + DIM.TILE_W / 2, p.zn, p.zs, { rowId: row.id, rowIndex: i, lane });
          return { lane, x, x0: x - DIM.TILE_W / 2, x1: x + DIM.TILE_W / 2 };
        });
        // once the row is answered its lanes link up, so you can walk to any lane before the next run-jump
        for (let k = 1; k < n; k++) rect('link', row.id + ':link' + k, tiles[k - 1].x1, tiles[k].x0, p.zn, p.zs, { rowId: row.id, lane: k });
        L.rows.push(Object.assign({ id: row.id, index: i, label, zone, glass: row.zone, n, width, tiles, boss: row.boss, bonus: row.bonus }, p));
        const b = band(row.boss ? 'gold' : spec.stages[rowStage[row.id]].zone, p.zs); b.zn = p.zn;
      } else if (it.type === 'interlude') {
        const rng = G.mulberry32(it.seed), zs = z - DIM.ROW_GAP;
        const piece = (kind, id, a, b, x, w, extra) => rect(kind, id, x - w / 2, x + w / 2, zs - b, zs - a, extra);
        const pieces = [];
        let len;
        if (it.kind === 'stones') {
          let off = 0;
          for (let k = 0; k < 5; k++) {
            off = Math.max(-1.5, Math.min(1.5, off + (rng() * 2 - 1) * 1.6));
            const a = k * (DIM.STONE + DIM.STONE_GAP);
            pieces.push(piece('stone', 'st' + k, a, a + DIM.STONE, cx + off, DIM.STONE));
          }
          // like the other interludes it ends on a wide pad, so any lane of the next row is one jump away
          const a = 5 * (DIM.STONE + DIM.STONE_GAP);
          pieces.push(piece('pad', 'padN', a, a + DIM.PAD_D, cx, 8));
          len = a + DIM.PAD_D;
        } else if (it.kind === 'moving') {
          len = DIM.PAD_D + DIM.MOVE_VOID + DIM.PAD_D;
          pieces.push(piece('pad', 'padS', 0, DIM.PAD_D, cx, 8), piece('pad', 'padN', len - DIM.PAD_D, len, cx, 8));
          const d = DIM.MOVE_D, s = rect('moving', 'mv', cx - DIM.MOVE_W / 2, cx + DIM.MOVE_W / 2, 0, 0, { d, zA: zs - DIM.PAD_D - DIM.MOVE_GAP, zB: zs - (len - DIM.PAD_D - DIM.MOVE_GAP - d), period: 12, phase: rng() * 12 });
          pieces.push(s);
        } else if (it.kind === 'beam') {
          len = DIM.PAD_D + DIM.BEAM_LEN + DIM.PAD_D;
          pieces.push(piece('pad', 'padS', 0, DIM.PAD_D, cx, 8), piece('beam', 'beam', DIM.PAD_D, DIM.PAD_D + DIM.BEAM_LEN, cx, DIM.BEAM_W), piece('pad', 'padN', len - DIM.PAD_D, len, cx, 8));
        } else {
          // vanishing tiles, with solid ground at the start, in the middle and at the end: a mistimed step only costs one short stretch
          let a = 0;
          const g = DIM.VANISH_GAP, solid = (id) => { pieces.push(piece('pad', id, a, a + DIM.PAD_D, cx, 8)); a += DIM.PAD_D + g; };
          const vrow = (r) => { for (let c = 0; c < 3; c++) pieces.push(piece('vanish', `v${r}${c}`, a, a + 2, cx + (c - 1) * 3.6, 3.2, { period: 4, on: 3.4, phase: (r * 1.1 + c * 1.3 + rng() * 0.8) % 4 })); a += 2 + g; };
          solid('padS'); vrow(0); vrow(1); solid('isl'); vrow(2); vrow(3);
          pieces.push(piece('pad', 'padN', a, a + DIM.PAD_D, cx, 8)); len = a + DIM.PAD_D;
        }
        z = zs - len;
        L.interludes.push({ kind: it.kind, seed: it.seed, zs, zn: z, pieces });
      }
    }
    L.south = cz + DIM.START_D / 2; L.north = z; L.length = L.south - L.north;
    L.walk = [cx - DIM.HALF_W, L.north - 1, cx + DIM.HALF_W, L.south + 0.8];
    L.checkpoints = L.platforms.map((p) => ({ x: cx, z: p.zc, kind: p.kind, index: p.index }));
    return L;
  }

  // skip: ids of shattered tiles. linked: ids of answered rows, whose lane links are solid (otherwise they are not there).
  function surfaceAt(layout, x, z, t, pad = 0, skip, linked) {
    for (const s of layout.surfaces) {
      if (skip && skip.has(s.id)) continue;   // a shattered tile
      if (s.kind === 'link' && !(linked && linked.has(s.rowId))) continue;
      let r = s;
      if (s.kind === 'moving') r = movingRect(s, t);
      else if (s.kind === 'vanish' && !vanishState(s, t).visible) continue;
      if (x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad) return s;
    }
    return null;
  }
  // colour of the stage the hero is in (or about to enter) at world z
  function colorAt(layout, z) {
    const b = layout.bands;
    if (!b.length || z > b[0].zs) return 'amber';
    for (const x of b) if (z >= x.zn) return x.zone;
    return b[b.length - 1].zone;
  }

  // ---------------------------------------------------------------- 3D
  const rgbOf = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const cssOf = (hex) => '#' + hex.toString(16).padStart(6, '0');
  const ICON = { // 8x8 pixel icons for the row signs
    tokens: ['..####..', '.#....#.', '#.####.#', '#...#..#', '#...#..#', '#...#..#', '.#....#.', '..####..'],
    safety: ['.######.', '.#....#.', '.#....#.', '.#....#.', '..#..#..', '..#..#..', '...##...', '........'],
    models: ['.#.#.#..', '########', '#......#', '#..##..#', '#..##..#', '#......#', '########', '.#.#.#..'],
    prompts: ['.######.', '#......#', '#.#.#..#', '#......#', '.######.', '...#....', '..#.....', '........'],
    verify: ['..###...', '.#...#..', '#.....#.', '#.....#.', '.#...#..', '..###.#.', '.....###', '......#.'],
    guardrails: ['#..#..#.', '#..#..#.', '########', '#..#..#.', '#..#..#.', '########', '#..#..#.', '#..#..#.'],
    approvals: ['########', '#......#', '#.....##', '##...#.#', '#.#.#..#', '#..#...#', '#......#', '########'],
  };
  const SHAPES = (n) => (n === 2 ? ['triangle', 'diamond'] : ['triangle', 'circle', 'diamond']);

  function create(TF, opts = {}) {
    const { THREE, MAT, scene } = TF;
    const CX = 0, CZ = 700;   // a free spot: the lobby, Archive, Pune, the Calfus office and ABZ already take (0,0), (-300,0), (300,0), (0,-300) and (0,300)
    const ENV = { fog: 0x2d2a3a, near: 26, far: 88, sun: 0.62, hemi: 0.66, hemiColor: 0xcfdcff };   // more even: less sun, more sky
    const state = { anims: [], origin: 'lobby', kiosk: null, spec: null, specFor: null, broken: new Set(), linked: new Set(), links: {}, listeners: { build: [], dispose: [] }, layout: null, root: null, reg: null, tiles: {}, textures: [], mats: [], light: null, mist: [], tokens: null, color: new THREE.Color(ZONE_HEX.amber), debug: !!opts.debug };
    const txSet = new Set(Object.values(TF.TX).flat());
    const texCache = new Map();   // tile textures survive a rebuild (a bonus row rebuilds the course), and identical answers share one
    const ZCOL = Object.fromEntries(Object.entries(ZONE_HEX).map(([k, v]) => [k, new THREE.Color(v)])), WARM = new THREE.Color(0xffe8c0);   // reused every frame: no allocation
    const addAnim = (fn) => { TF.anim.push(fn); state.anims.push(fn); return fn; };   // removed again on dispose
    const sharedMats = new Set(Object.values(MAT));
    const own = (o) => { state.mats.push(o); return o; };

    // ---- glass tile texture: tinted pixel-glass pane + shape glyph + answer text ----
    function tileTexture(text, hex, shape, crack = 0) {
      const key = text + '|' + hex + '|' + shape + '|' + crack;
      if (texCache.has(key)) return texCache.get(key);
      const K = 1.5, W = 256, H = Math.round((256 * DIM.TILE_D) / DIM.TILE_W), S = 2.54, tint = rgbOf(hex);   // S: the top face is seen ~23 degrees from above, so upright things are drawn 2.5x taller. K: twice the pixels, so close-up text stays sharp
      const cw = Math.round(W * K), ch = Math.round(H * K);
      const tex = TF.canvasTex(cw, ch, (g) => {
        g.scale(cw / W, ch / H);
        for (let y = 0; y < H; y += 4) {
          const f = y / H, base = [92 - f * 34, 116 - f * 40, 138 - f * 40], k = 0.34;
          g.fillStyle = `rgb(${base.map((v, i) => (v * (1 - k) + tint[i] * k) | 0).join(',')})`;
          g.fillRect(0, y, W, 4);
        }
        for (let i = 0; i < 520; i++) { const x = (TF.rnd() * W) | 0, y = (TF.rnd() * H) | 0, l = TF.rnd() < 0.5; g.fillStyle = l ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.16)'; g.fillRect(x, y, 2, 2); }
        g.fillStyle = 'rgba(255,255,255,.09)';
        for (let x = -H; x < W; x += 64) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 18, H); g.lineTo(x + 18 + H * 0.5, 0); g.lineTo(x + H * 0.5, 0); g.fill(); }
        g.fillStyle = 'rgba(20,24,32,.55)'; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
        g.save(); g.scale(1, S);
        const h = H / S, cy = h / 2;
        g.fillStyle = 'rgba(8,12,20,.7)'; g.fillRect(8, cy - 15, 34, 30);
        g.fillStyle = cssOf(hex); g.strokeStyle = cssOf(hex);
        if (shape === 'circle') { g.beginPath(); g.arc(25, cy, 10, 0, 6.283); g.fill(); }
        else if (shape === 'diamond') { g.beginPath(); g.moveTo(25, cy - 12); g.lineTo(37, cy); g.lineTo(25, cy + 12); g.lineTo(13, cy); g.fill(); }
        else { g.beginPath(); g.moveTo(25, cy - 11); g.lineTo(37, cy + 9); g.lineTo(13, cy + 9); g.fill(); }
        g.textAlign = 'left'; g.textBaseline = 'middle';
        let size = 32, lines;
        for (; size >= 12; size--) {
          g.font = `600 ${size}px "Pixelify Sans", monospace`;
          lines = []; let line = '';
          for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > 200) { lines.push(line); line = w; } else line = t; }
          lines.push(line);
          if (lines.length <= 2 && lines.length * size * 1.12 <= h - 6) break;
        }
        const lh = size * 1.12;
        g.fillStyle = 'rgba(6,9,16,.82)'; g.fillRect(46, cy - (lines.length * lh) / 2 - 3, W - 52, lines.length * lh + 6);
        g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.9)';   // a dark outline keeps the letters crisp over any glass
        lines.forEach((l, i) => {
          const y = cy + (i - (lines.length - 1) / 2) * lh;
          g.strokeText(l, 52, y); g.fillStyle = '#ffffff'; g.fillText(l, 52, y);
        });
        g.restore();
        if (crack) { // 1: a Scan has cracked this tile in shimmering light, 2: it is breaking now
          g.fillStyle = crack === 1 ? 'rgba(255,226,154,.2)' : 'rgba(255,255,255,.1)'; g.fillRect(0, 0, W, H);
          const cx = W * (0.35 + 0.3 * TF.rnd()), cy = H * (0.35 + 0.3 * TF.rnd());
          for (let i = 0, n = crack === 1 ? 4 : 9; i < n; i++) {
            let x = cx, y = cy, a = TF.rnd() * 6.283;
            for (let s = 0; s < 6; s++) {
              const nx = x + Math.cos(a) * (14 + TF.rnd() * 18), ny = y + Math.sin(a) * (10 + TF.rnd() * 12);
              g.lineCap = 'square'; g.strokeStyle = 'rgba(8,10,16,.92)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
              g.strokeStyle = crack === 1 ? '#ffe39a' : '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
              x = nx; y = ny; a += TF.rnd() * 0.9 - 0.45;
            }
          }
        }
      });
      texCache.set(key, tex);
      return tex;
    }

    function rowSignTexture(label, hex, icon, topic) {
      const t = TF.canvasTex(256, 64, (g) => {
        g.fillStyle = '#15171d'; g.fillRect(0, 0, 256, 64);
        g.fillStyle = '#2c303a'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 61, 256, 3);
        g.font = '600 30px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = cssOf(hex);
        g.fillText(label, 14, 33);
        if (icon) { g.fillStyle = cssOf(hex); icon.forEach((row, y) => [...row].forEach((c, x) => c === '#' && g.fillRect(196 + x * 5, 12 + y * 5, 5, 5))); }
      });
      state.textures.push(t);
      return t;
    }

    // ---- shared materials, per colour ----
    const glow = {}, glass = {};
    const glowOf = (hex) => glow[hex] || (glow[hex] = own(TF.glowStrip(hex)));
    const thin = {}, thinGlow = (hex) => thin[hex] || (thin[hex] = own(new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.85 })));   // gantry lines: less bloom than the tile frames
    const sideOf = (hex) => glass[hex] || (glass[hex] = own(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color(0xbfd8e0), 0.6), transparent: true, opacity: 0.7, roughness: 0.3, emissive: hex, emissiveIntensity: 0.16 })));

    // ---- parts ----
    function platform(p, L) {
      const hex = ZONE_HEX[p.zone], d = p.zs - p.zn, w = DIM.PLAT_W, cx = L.cx;
      const c = MAT.concrete;
      TF.faceBox(w, 1.2, d, [c, c, MAT.paver, c, c, c], cx, -1.2, p.zc);
      const e = glowOf(hex);
      TF.box(w, 0.04, 0.08, e, cx, 0, p.zs - 0.06, { cast: false }); TF.box(w, 0.04, 0.08, e, cx, 0, p.zn + 0.06, { cast: false });
      TF.box(0.08, 0.04, d - 0.2, e, cx - w / 2 + 0.06, 0, p.zc, { cast: false }); TF.box(0.08, 0.04, d - 0.2, e, cx + w / 2 - 0.06, 0, p.zc, { cast: false });
      for (const s of [-1, 1]) TF.streetLamp(cx + s * (w / 2 - 1.2), p.zs - 0.9, 'bridge', false);   // at the near corners: lamps at the far end stand in front of the next row's answers
      if (p.kind === 'checkpoint') {
        const disc = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), TF.glowDisc(hex)); disc.rotation.x = -Math.PI / 2; disc.position.set(cx, 0.04, p.zc); scene.add(disc);
        const ring = TF.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 6, 28), MAT.stone), null, false); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.05, p.zc);
        // to the side and mid-platform: a sign at the far edge would cover the answers on the next row
        const sx = cx - 6.4, sz = p.zc + 1.2;
        for (const s of [-1, 1]) TF.box(0.1, 1.4, 0.1, MAT.metal, sx + s * 1.4, 0, sz);
        TF.ledSign(['CHECKPOINT'], cssOf(hex), sx, 1.55, sz, 2.6, 0.45);
      } else if (p.kind === 'start') {
        // to the side too: a portal on the course axis would glare through the camera's line of sight to the rows ahead
        TF.portal(cx + 4.8, p.zc + 2.0, ZONE_HEX.gold, 'bridge', 'lobby', 'TokenFall Lobby');
        TF.ledSign([state.origin === 'lab' ? 'Back to the office' : 'Back to Lobby'], '#f6e3b4', cx + 4.8, 3.9, p.zc + 2.0, 2.4, 0.45);
        // off to the side: the camera looks north past it, so it must not stand in front of row 1
        const sx = cx - 6.6, sz = p.zc + 1.2;
        for (const s of [-1, 1]) TF.box(0.14, 2.6, 0.14, MAT.metal, sx + s * 1.95, 0, sz);
        TF.ledSign(['THE GLASS BRIDGE'], '#ffe39a', sx, 2.2, sz, 4.1, 0.8, 0, [256, 56]);
        TF.ledSign(['pick the right tile'], '#bfe8ff', sx, 1.55, sz, 2.9, 0.36);
      } else if (p.kind === 'end') {
        TF.portal(cx, p.zc, ZONE_HEX.gold, 'bridge', 'lobby', 'TokenFall Lobby');
        TF.ledSign([state.origin === 'lab' ? 'Back to the office' : 'Back to Lobby'], '#f6e3b4', cx, 3.9, p.zc, 2.4, 0.45);
        TF.ledSign(['YOU MADE IT'], '#ffe39a', cx - 6.6, 2.2, p.zc + 1.2, 3.6, 0.8, 0, [256, 56]);
        for (const s of [-1, 1]) TF.box(0.14, 2.6, 0.14, MAT.metal, cx - 6.6 + s * 1.75, 0, p.zc + 1.2);
      }
    }

    function row(rl, spec, L) {
      const hex = ZONE_HEX[rl.glass], accent = ZONE_HEX[rl.zone], cx = L.cx, r = spec.rows[rl.index];
      const shapes = SHAPES(rl.n), list = [];
      rl.tiles.forEach((t, lane) => {
        const top = own(new THREE.MeshStandardMaterial({ map: tileTexture(r.tiles[lane].text, hex, shapes[lane]), transparent: true, opacity: 0.92, roughness: 0.35, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.32 }));
        top.emissiveMap = top.map;
        const side = sideOf(hex);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(DIM.TILE_W, DIM.TILE_H, DIM.TILE_D), [side, side, top, side, side, side]);
        mesh.position.set(t.x, -DIM.TILE_H / 2, rl.zc); mesh.receiveShadow = true; scene.add(mesh);
        const fm = state.debug && r.tiles[lane].correct ? glowOf(0x9dffc0) : glowOf(accent);
        const frame = TF.box(DIM.TILE_W + 0.24, 0.14, DIM.TILE_D + 0.24, fm, t.x, -0.2, rl.zc, { cast: false });
        frame.userData.dyn = true;   // its material changes on a reroll / debug
        list.push({ lane, mesh, frame, top, x: t.x, z: rl.zc, text: r.tiles[lane].text, hex, shape: shapes[lane], base: top.map, cracks: {}, shimmer: false });
      });
      state.tiles[rl.id] = list;
      state.links[rl.id] = [];
      for (let k = 1; k < rl.n; k++) {   // the lane links: hidden until the row is answered
        const a = rl.tiles[k - 1], b = rl.tiles[k], lm = own(new THREE.MeshStandardMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.55, roughness: 0.3, emissive: ZONE_HEX.gold, emissiveIntensity: 0.55 }));
        const m = new THREE.Mesh(new THREE.BoxGeometry(b.x0 - a.x1 + 0.1, DIM.TILE_H * 0.7, DIM.TILE_D), lm);
        m.position.set((a.x1 + b.x0) / 2, -DIM.TILE_H * 0.35, rl.zc); m.visible = false; scene.add(m); state.links[rl.id].push(m);
      }
      // gantry: two slim pillars rising out of the abyss and a thin glow line across. Nothing solid up high: from the
      // camera's angle a solid lintel hides the rows ten units behind it, and they stack row after row.
      const zp = rl.zn - 0.35, half = rl.width / 2 + 1.0, strip = thinGlow(accent);
      for (const s of [-1, 1]) {
        TF.box(0.14, DIM.GANTRY_H + 40, 0.14, MAT.metal, cx + s * half, -40, zp, { cast: false });
        TF.box(0.04, DIM.GANTRY_H - 0.5, 0.04, strip, cx + s * (half - 0.09), 0.3, zp + 0.08, { cast: false });
      }
      TF.box(half * 2, 0.04, 0.04, strip, cx, DIM.GANTRY_H + 0.1, zp, { cast: false });
      const st = own(new THREE.MeshStandardMaterial({ map: rowSignTexture(rl.label, accent, ICON[r.topic], r.topic), emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.5 }));
      st.emissiveMap = st.map;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.52, 0.08), [MAT.metal, MAT.metal, MAT.metal, MAT.metal, st, MAT.metal]);
      sign.position.set(cx - half - 1.15, 2.5, zp + 0.1); scene.add(sign);   // beside the left post, out of the way of the tiles
    }

    function interlude(il, L) {
      const gold = ZONE_HEX.gold, cx = L.cx, len = il.zs - il.zn;
      for (const s of [-1, 1]) TF.box(0.1, 1.9, 0.1, MAT.metal, cx + 6 + s * 1.2, 0, il.zs - 0.3);
      TF.ledSign(['PARKOUR', 'safe to fall'], '#ffe39a', cx + 6, 1.95, il.zs - 0.3, 2.2, 0.9, 0, [200, 100]);
      const e = glowOf(gold);
      for (const s of il.pieces) {
        const w = s.x1 - s.x0, d = s.z1 - s.z0, x = (s.x0 + s.x1) / 2, zc = (s.z0 + s.z1) / 2;
        if (s.kind === 'stone' || s.kind === 'pad') {
          TF.box(w, 0.6, d, s.kind === 'stone' ? MAT.flag : MAT.concrete, x, -0.6, zc);
          TF.box(w + 0.04, 0.04, 0.1, e, x, 0, s.z1 - 0.06, { cast: false }); TF.box(w + 0.04, 0.04, 0.1, e, x, 0, s.z0 + 0.06, { cast: false });
        } else if (s.kind === 'beam') {
          TF.box(w, 0.3, d, MAT.concrete, x, -0.3, zc);
          for (const k of [-1, 1]) TF.box(0.08, 0.04, d, e, x + k * (w / 2 - 0.05), 0, zc, { cast: false });
        } else if (s.kind === 'moving') {
          const g = new THREE.Group(); g.add(TF.box(w, 0.4, s.d, MAT.concrete, 0, -0.4, 0, { p: g }));   // 5.2 x 3.0: a big, slow ferry
          for (const k of [-1, 1]) TF.box(0.14, 0.05, s.d, e, k * (w / 2 - 0.1), 0, 0, { p: g, cast: false });
          for (const k of [-1, 1]) TF.box(w, 0.05, 0.14, e, 0, 0, k * (s.d / 2 - 0.1), { p: g, cast: false });
          g.userData.dyn = true; scene.add(g);
          addAnim((t) => { if (state.spec && g.parent) { const r = movingRect(s, t); g.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2); } });
          g.position.set(x, 0, s.zA - s.d / 2);
          g.userData.piece = s;
        } else if (s.kind === 'vanish') {
          const m = own(new THREE.MeshStandardMaterial({ map: tileTexture('', gold, null), transparent: true, opacity: 0.88, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.4 }));
          m.emissiveMap = m.map;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, DIM.TILE_H, d), [sideOf(gold), sideOf(gold), m, sideOf(gold), sideOf(gold), sideOf(gold)]);
          mesh.position.set(x, -DIM.TILE_H / 2, zc); scene.add(mesh);
          const fr = TF.box(w + 0.2, 0.12, d + 0.2, e, x, -0.2, zc, { cast: false });
          fr.userData.dyn = true;   // blinks with its tile
          // a soft pulse as it is about to go, not a strobe
          addAnim((t) => { if (!mesh.parent) return; const v = vanishState(s, t); mesh.visible = fr.visible = v.visible; m.opacity = v.warn ? 0.5 + 0.3 * Math.sin(t * 6) : 0.88; });
        }
      }
    }

    // ---- the void: pillars' abyss, rising mist, drifting tokens, skyline ----
    function mistPlane(i) {
      const mat = own(new THREE.ShaderMaterial({
        uniforms: { t: TF.timeU, col: { value: new THREE.Color(ZONE_HEX.amber) }, fade: { value: 1 }, hero: { value: new THREE.Vector2() } },
        transparent: true, depthWrite: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
        fragmentShader: `uniform float t,fade; uniform vec3 col; uniform vec2 hero; varying vec3 vW;
          void main(){ vec2 p=floor(vW.xz/1.5)*1.5;
            float n=sin(p.x*.11+t*.06)*sin(p.y*.09-t*.04)+.6*sin((p.x-p.y)*.07+t*.05)+.4*sin(p.x*.23+p.y*.19+t*.08);
            float a=smoothstep(-.4,1.2,n)*.34*fade; a*=smoothstep(90.,30.,length(vW.xz-hero));
            gl_FragColor=vec4(col*(.6+.4*a),a); }`,
      }));
      const g = new THREE.PlaneGeometry(240, 240); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
      state.mist.push({ m, mat, i });
    }
    function tokens(n, rng) {
      const tex = TF.canvasTex(8, 8, (g) => {
        g.fillStyle = '#b8862c'; for (const [x, y, w, h] of [[2, 0, 4, 1], [1, 1, 6, 1], [0, 2, 8, 4], [1, 6, 6, 1], [2, 7, 4, 1]]) g.fillRect(x, y, w, h);
        g.fillStyle = '#f1c657'; for (const [x, y, w, h] of [[2, 1, 4, 1], [1, 2, 6, 4], [2, 6, 4, 1]]) g.fillRect(x, y, w, h);
        g.fillStyle = '#fff1b0'; g.fillRect(2, 2, 2, 1); g.fillRect(2, 3, 1, 1);
        g.fillStyle = '#9a6b1e'; g.fillRect(3, 3, 2, 3);
      }, { nearest: true });
      state.textures.push(tex);
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.6, 0.6), own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })), n);
      im.frustumCulled = false;
      const seeds = Array.from({ length: n }, () => ({ x: -55 + rng() * 110, y: -30 + rng() * 33, z: -60 + rng() * 120, p: rng() * 9, s: 0.1 + rng() * 0.25 }));
      scene.add(im);
      state.tokens = { im, seeds, d: new THREE.Object3D() };
    }
    function skyline(L, rng) {
      const rr = (a, b) => a + rng() * (b - a);
      for (const side of [-1, 1]) for (let z = L.south + 6; z > L.north - 40; z -= 18) {
        const W = rr(7, 12), H = 40 + rr(0, 16), x = L.cx + side * (17 + rr(0, 26)), zz = z + rr(-4, 4);
        const before = new Set(scene.children);
        TF.officeBlock(x, zz, W, 8, H, { units: 0, collide: false, floors: 1 });
        const g = new THREE.Group(); g.position.y = -38;
        scene.children.filter((o) => !before.has(o)).forEach((o) => { g.add(o); o.traverse((c) => { c.castShadow = false; }); });
        scene.add(g);
      }
    }

    // The lobby merges its static boxes once at boot; the bridge is built later, so it does the same for itself:
    // opaque, non-moving meshes are baked into one geometry per (material, shadow, 28-unit chunk of the course).
    function mergeStatic(rootG, chunk = 28) {
      rootG.updateMatrixWorld(true);
      const buckets = new Map(), dead = [], wp = new THREE.Vector3();
      const dyn = (o) => { for (let q = o; q; q = q.parent) if (q.userData.dyn) return true; return false; };
      const ok = (m) => m.isMeshStandardMaterial && !m.transparent;
      rootG.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || dyn(o)) return;
        const multi = Array.isArray(o.material);
        if (multi ? !o.material.every(ok) : !ok(o.material)) return;
        const g = o.geometry;
        if (!g.attributes.uv || !g.attributes.normal) return;
        o.getWorldPosition(wp);
        const flat = g.index ? g.toNonIndexed() : g.clone(); flat.applyMatrix4(o.matrixWorld);
        const parts = multi ? g.groups.map((gr) => [o.material[gr.materialIndex], gr.start, gr.count]) : [[o.material, 0, flat.attributes.position.count]];
        for (const [mat, start, count] of parts) {
          const key = mat.uuid + (o.castShadow ? 1 : 0) + ':' + Math.floor(wp.z / chunk);
          if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, list: [] });
          buckets.get(key).list.push({ g: flat, start, count });
        }
        dead.push(o);
      });
      for (const o of dead) { o.geometry.dispose(); o.parent.remove(o); }
      for (const { mat, cast, list } of buckets.values()) {
        let n = 0; for (const q of list) n += q.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let k = 0;
        for (const { g, start, count } of list) {
          const A = g.attributes;
          pos.set(A.position.array.subarray(start * 3, (start + count) * 3), k * 3); nor.set(A.normal.array.subarray(start * 3, (start + count) * 3), k * 3);
          uv.set(A.uv.array.subarray(start * 2, (start + count) * 2), k * 2); k += count;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; rootG.add(m);
      }
    }

    function build(spec) {
      dispose(true);
      const L = state.layout = computeLayout(spec, { cx: CX, cz: CZ });
      state.spec = spec; state.tiles = {};
      const animStart = TF.anim.length;   // lobby helpers (portal gems...) register their own per-frame callbacks while we build
      const snap = { kids: new Set(scene.children), inter: TF.INTER.length, ports: TF.PORTALS.length, cols: TF.COL.length, lights: TF.ZONE_LIGHTS.bridge.length };
      const rootG = state.root = new THREE.Group(); rootG.name = 'glassBridge'; scene.add(rootG);
      snap.kids.add(rootG);
      L.platforms.forEach((p) => platform(p, L));
      L.rows.forEach((rl) => row(rl, spec, L));
      L.interludes.forEach((il) => interlude(il, L));
      const rng = G.mulberry32((spec.seed ^ 0x5bd1e995) >>> 0);   // seeded: rebuilding the course keeps the same towers
      skyline(L, rng);
      for (let i = 0; i < 2; i++) mistPlane(i);
      tokens(60, rng);
      state.light = TF.pointLight('bridge', 0xffd9a6, 0.28, 22, L.cx, 6, L.cz);   // soft and wide: a small bright spot following you across the platform is what made the lighting swim
      TF.WALK.push(L.walk);
      const ports = TF.PORTALS.slice(snap.ports);
      if (state.origin === 'lab' && state.kiosk) for (const q of ports) { q.to = 'lab'; q.at = state.kiosk.near; q.label = 'Calfus HQ · Conference Room'; }   // back to the terminal you came from
      state.reg = { walk: [L.walk], inter: TF.INTER.slice(snap.inter), ports, cols: TF.COL.slice(snap.cols), lights: TF.ZONE_LIGHTS.bridge.slice(snap.lights) };
      scene.children.filter((o) => !snap.kids.has(o)).forEach((o) => rootG.add(o));
      state.mist.forEach(({ m }) => rootG.add(m));
      rootG.add(state.tokens.im);
      for (let i = animStart; i < TF.anim.length; i++) if (!state.anims.includes(TF.anim[i])) state.anims.push(TF.anim[i]);   // so dispose takes them out again
      rootG.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      mergeStatic(rootG);
      state.broken.clear(); state.linked.clear();
      state.listeners.build.forEach((f) => f(L));
      return L;
    }

    function dispose(keepCache) {
      if (!state.root) return;
      for (const f of state.anims) { const i = TF.anim.indexOf(f); if (i >= 0) TF.anim.splice(i, 1); }
      state.anims = [];
      const cached = new Set(texCache.values());
      if (TF.post) TF.post.maxR.value = dofBase();
      state.listeners.dispose.forEach((f) => f());
      const drop = (arr, items) => items.forEach((x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); });
      drop(TF.WALK, state.reg.walk); drop(TF.INTER, state.reg.inter); drop(TF.PORTALS, state.reg.ports); drop(TF.COL, state.reg.cols); drop(TF.ZONE_LIGHTS.bridge, state.reg.lights);
      state.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) if (!sharedMats.has(m)) { for (const k of ['map', 'emissiveMap']) if (m[k] && !txSet.has(m[k]) && !cached.has(m[k])) m[k].dispose(); m.dispose(); }
        if (o.isLight && o.dispose) o.dispose();
      });
      scene.remove(state.root);
      state.textures.forEach((t) => t.dispose()); state.mats.forEach((m) => m.dispose());
      if (!keepCache) { texCache.forEach((t) => t.dispose()); texCache.clear(); }
      Object.assign(state, { root: null, reg: null, tiles: {}, textures: [], mats: [], light: null, mist: [], tokens: null, layout: null });
      for (const k in glow) delete glow[k]; for (const k in glass) delete glass[k]; for (const k in thin) delete thin[k];
    }

    // after a fall: new texts on the same row (same concept, same number of tiles)
    function rerollRow(spec, rowIndex) {
      state.spec = spec;
      if (!state.root) return;
      const r = spec.rows[rowIndex], list = state.tiles[r.id], rl = state.layout.rows.find((x) => x.id === r.id), shapes = SHAPES(rl.n);
      list.forEach((t) => {
        const tex = tileTexture(r.tiles[t.lane].text, ZONE_HEX[rl.glass], shapes[t.lane]);
        Object.assign(t, { base: tex, cracks: {}, text: r.tiles[t.lane].text, shimmer: false });
        t.top.map = t.top.emissiveMap = tex; t.top.emissiveIntensity = 0.32; t.top.needsUpdate = true;
        t.mesh.visible = t.frame.visible = true; state.broken.delete(rl.id + ':' + t.lane);
        t.frame.material = state.debug && r.tiles[t.lane].correct ? glowOf(0x9dffc0) : glowOf(ZONE_HEX[rl.zone]);
      });
    }

    // ---- tile states for gameplay ----
    const tileOf = (rowId, lane) => (state.tiles[rowId] || [])[lane];
    function crackTile(rowId, lane, level) { // 0 clean, 1 scanned (shimmering), 2 breaking
      const t = tileOf(rowId, lane); if (!t) return;
      const tex = level ? (t.cracks[level] = t.cracks[level] || tileTexture(t.text, t.hex, t.shape, level)) : t.base;
      t.top.map = t.top.emissiveMap = tex; t.top.needsUpdate = true; t.shimmer = level === 1;
      if (!level) t.top.emissiveIntensity = 0.32;
    }
    function breakTile(rowId, lane) {
      const t = tileOf(rowId, lane); if (!t) return null;
      state.broken.add(rowId + ':' + lane); t.mesh.visible = t.frame.visible = false; t.shimmer = false;
      return { x: t.x, z: t.z, hex: t.hex };
    }
    // the row is answered: the right tile glows gold, the others go quiet (and stay solid: the answer is committed)
    function settleRow(rowId, correctLane) {
      (state.tiles[rowId] || []).forEach((t) => { t.shimmer = false; t.frame.material = t.lane === correctLane ? glowOf(ZONE_HEX.gold) : glowOf(0x4a505c); });
      state.linked.add(rowId);
      for (const m of state.links[rowId] || []) { m.visible = true; m.userData.t0 = TF.timeU.value; m.scale.x = 0.05; }
    }

    // ---- per frame, only while in the zone ----
    const here = () => TF.zone === 'bridge' && state.root;
    const dofBase = () => Math.max(4, TF.renderer.domElement.height / 105);   // the lobby's own value
    TF.anim.push((t) => {
      if (!here()) return;
      if (TF.post) TF.post.maxR.value = dofBase() * 0.4;   // the tilt-shift blur turns far rows into mush; the answers must stay readable
      for (const id in state.tiles) for (const tl of state.tiles[id]) if (tl.shimmer) tl.top.emissiveIntensity = 0.5 + 0.22 * Math.sin(t * 3.5 + tl.lane);
      for (const id of state.linked) for (const m of state.links[id] || []) if (m.scale.x < 1) m.scale.x = Math.min(1, 0.05 + (t - m.userData.t0) / 0.3);   // the links grow in
      const h = TF.hero, L = state.layout;
      state.color.lerp(ZCOL[colorAt(L, h.y)], 0.012);
      state.light.position.set(h.x, 6, h.y); state.light.color.copy(state.color).lerp(WARM, 0.55);
      for (const { m, mat, i } of state.mist) {
        const f = ((t * 0.018 + i / 2) % 1);
        m.position.set(h.x, -2.5 - i * 8 - (1 - f) * 6, h.y);
        mat.uniforms.col.value.copy(state.color); mat.uniforms.fade.value = Math.sin(f * Math.PI); mat.uniforms.hero.value.set(h.x, h.y);
      }
      const { im, seeds, d } = state.tokens, q = TF.camera.quaternion;
      seeds.forEach((s, k) => {
        const wrap = (v, c, r) => ((((v - c + r / 2) % r) + r) % r) - r / 2 + c;
        d.position.set(wrap(s.x + Math.sin(t * s.s + s.p) * 1.2, h.x, 110), s.y + Math.sin(t * 0.5 + s.p) * 0.7, wrap(s.z, h.y, 130));
        d.quaternion.copy(q); d.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2 + s.p)); d.updateMatrix(); im.setMatrixAt(k, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    });

    // ---- the terminal in the Calfus office's Conference Room (the lobby calls this while it builds the office) ----
    // pos: { x, z } of the terminal against the north wall, near: where you stand when you come back from the bridge
    TF.officeEntrance = (pos) => {
      state.kiosk = pos;
      const gold = ZONE_HEX.gold, { x, z } = pos;
      TF.box(0.6, 1.5, 0.5, MAT.charcoal, x, 0, z);   // a totem: tall enough to read above the room's low glass wall
      const t = TF.ledTex(['THE GLASS', 'BRIDGE', 'press E'], '#ffe39a', 256, 200);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.9, roughness: 0.5 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.07), [MAT.charcoal, MAT.charcoal, MAT.charcoal, MAT.charcoal, m, MAT.charcoal]);
      screen.position.set(x, 1.92, z + 0.12); screen.rotation.x = -0.16; screen.castShadow = true; scene.add(screen);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), TF.glowDisc(gold)); pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.03, z + 0.95); scene.add(pad);
      TF.colBox(x - 0.38, z - 0.3, x + 0.38, z + 0.3);
      TF.INTER.push({ x, z: z + 0.95, r: 1.3, label: 'The Glass Bridge', verb: 'Play', act: () => { if (!TF.traveling) TF.travel({ to: 'bridge', zone: 'lab' }); } });
    };

    // ---- hooking into the lobby ----
    function register(spec, o = {}) {
      state.spec = spec; state.specFor = o.specFor || null;
      TF.registerZone('bridge', { cx: CX, cz: CZ, name: 'The Glass Bridge', sub: 'Pick the right tile', color: ZONE_HEX.gold, ret: [0, 14.6], retDir: 'up', spawn: [0, -0.4], env: ENV });
      TF.on('enter', (prev, z) => { if (z === 'bridge') { state.origin = prev === 'lab' ? 'lab' : 'lobby'; if (state.specFor) state.spec = state.specFor(); build(state.spec); } else if (prev === 'bridge') dispose(); });
      if (o.referee) TF.addNPC('referee', CX - 3.0, CZ - 0.2, 'bridge', o.referee);
    }

    return {
      register, build, dispose, rerollRow, DIM, PHYS,
      setSpec(s) { state.spec = s; },
      get layout() { return state.layout; }, get tiles() { return state.tiles; }, get spec() { return state.spec; },
      surfaceAt: (x, z, t, pad) => (state.layout ? surfaceAt(state.layout, x, z, t, pad, state.broken, state.linked) : null),
      rectOf: (s, t) => (s.kind === 'moving' ? movingRect(s, t) : s),
      crackTile, breakTile, settleRow, isBroken: (rowId, lane) => state.broken.has(rowId + ':' + lane),
      on(evt, fn) { state.listeners[evt].push(fn); },
      colorAt: (z) => (state.layout ? colorAt(state.layout, z) : 'amber'),
    };
  }

  return { DIM, PHYS, ZONE_HEX, computeLayout, surfaceAt, colorAt, movingU, vanishState, movingRect, create };
});
