// Token Tower — the tower in the world. Browser: window.JengaWorld. Node: require('./jenga-world.js') (the pure part: poses, orbit maths, tag layout).
//
// A real table stands in the plaza beside the Token Brew terrace, built from the lobby's own helpers (TF.box, MAT.wood / MAT.darkWood, colliders, an interactable).
// The tower is one InstancedMesh of wood blocks; a candidate is marked by a colour-and-shape shell, a glyph and number on its pulled end, and a billboard tag above it.
// Entering fades, hides the hero and eases the camera into an orbit around the tower; leaving restores the follow camera and the hero exactly where they stood.
//
//   install(TF)                registers at the lobby's boot (after mergeStatic, so everything here stays a live object); sets TF.tower = world
//   world.enter(cb) / world.leave(cb)     fade, lock + hide the hero, ease the camera in / restore camera and hero
//   world.setTower(tower)      draw a tower (engine JSON); blocks with answerText get it engraved on their top face
//   world.setQuestion(q, tower)  mark the four candidates (q.options, q.view); the camera turns to q.view.corner. world.clearQuestion()
//   world.select(n) / world.selected   the highlighted candidate (1-4, or 0); a pulsing frame on it
//   world.resolvePull(correct, done)   after the 'pull' event: correct = slide out, lift and hover (done('held')); wrong = jam, slide back, clunk (done('back'))
//   world.shake(level)         1 = a jolt, 2 = a heavy sway with a few blocks nudging out and back (visual only)
//   world.hold(blockId) / world.setHeld(u, layer, text)   the hovering block; world.heldMesh
//   world.mark(n)              strike a candidate out after a wrong pull (it cannot be chosen again)
//   world.setGhost(u, layer, band) / hideGhost()   where the held block will land, tinted by the stability band
//   world.lateralAt(x, y, layer) / screenSign(layer)   pointer -> lateral position u on a layer; which way 'right' is on screen
//   world.drop(u, layer, done)  the held block falls onto the tower ('land'); world.sway(amp) settles it; world.puff(layer, u) a little dust
//   world.collapse(tower, seed, done)   the visual-only fall (engine integrator), camera shake and 'rumble'; world.cameraShake(secs, amp)
//   world.on(evt, fn)          'enter' 'leave' 'select'(n) 'pull'(n) 'click' 'friction' 'clunk' 'lift' 'land' 'rumble' 'exit' (Esc)
//   world.open()               E at the table: enters; jenga-play.js replaces this with the game
// Units: 1 block width = UNIT metres; tower-local coordinates, y = 0 on the table top.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./jenga-engine.js') : root.JengaEngine, isNode ? require('./carrom-world.js') : root.CarromWorld, isNode ? require('./bridge-generator.js') : root.BridgeGenerator);
  if (isNode) module.exports = api;
  else root.JengaWorld = api;
})(this, function (E, CW, BG) {
  const UNIT = 0.26, TOP = 0.78, B = E.BLOCK;   // metres per block width; table-top height
  const STYLE = CW.STYLE;                        // the same colour and shape per answer slot as House Rules Carrom: amber triangle, green circle, cyan diamond, rose square
  const PULL_SECS = 0.5, JAM = 0.33;             // hold Space about 0.5 s; a wrong block slides out about a third of its length and jams

  // ---------------------------------------------------------------- pure
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const unit = (s) => (hash(s) % 10007) / 10007;
  function blockPose(b) {   // tower-local metres; odd layers run along Z, so their long axis is turned a quarter
    const c = E.centreOf(b);
    return { x: c[0] * UNIT, y: (b.layer + 0.5) * B.hgt * UNIT, z: c[1] * UNIT, ry: b.layer % 2 ? Math.PI / 2 : 0 };
  }
  const blockSize = () => ({ len: B.len * UNIT, hgt: B.hgt * UNIT, wid: B.wid * UNIT });
  // the way a block leaves: even layers along X towards the camera's side, odd layers along Z (the same faces the generator labels E/W/N/S)
  const pullVec = (b, view) => (b.layer % 2 === 0 ? [view.sx, 0] : [0, view.sz]);
  const FACE = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
  const azFor = (view) => Math.atan2(view.sx, view.sz);   // az 0 = the camera on the +z side, like the follow camera; it sits over the corner whose two faces the candidates leave by
  function orbitPose(o, c) {
    const ce = Math.cos(o.el);
    return { pos: [c[0] + o.dist * Math.sin(o.az) * ce, c[1] + o.dist * Math.sin(o.el), c[2] + o.dist * Math.cos(o.az) * ce], look: [c[0], c[1] + (o.lift || 0), c[2]] };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const easeAngle = (cur, target, maxStep) => { const d = wrap(target - cur); return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep; };
  // how far back and how high to look so the whole tower, and the block hovering over it, fills the close view whatever the camera's field of view (degrees)
  function frame(layers, fov = 48) {
    const h = Math.max(16, layers) * B.hgt * UNIT, view = h * 1.7 + 0.5 * UNIT * 3;
    return { dist: view / (2 * Math.tan((fov * Math.PI) / 360)), lookY: TOP + 0.5 * h, lift: 0.1 * h };
  }
  // the camera must not sit behind a lamp pole or a trunk: pull it in (never below `min` of the way) when a thin collider ({ x, z, r }, r <= 0.45) lies on the sightline
  // from the tower (at = [x, z]) out to the camera's horizontal reach in direction az. Wide things (umbrellas, benches) are ignored: the camera is above them.
  function clearReach(at, az, reach, cols, o = {}) {
    const pad = o.pad || 0.5, min = reach * (o.min || 0.78), dx = Math.sin(az), dz = Math.cos(az);
    let best = reach;
    for (const c of cols) {
      if (c.r === undefined || c.r > 0.45) continue;
      const px = c.x - at[0], pz = c.z - at[1], t = px * dx + pz * dz;
      if (t < 1.2 || t > reach + pad) continue;
      if (Math.abs(px * dz - pz * dx) < pad + c.r) best = Math.min(best, t - pad - c.r);
    }
    return Math.max(min, best);
  }
  // keep tag boxes apart: rects { x, y, w, h } (centre x, top y); pushes overlapping pairs apart vertically, the lower one down, until none touch
  function deconflict(rects, gap = 4) {
    for (let pass = 0; pass < 24; pass++) {
      let moved = false;
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + gap) continue;
        const up = a.y <= b.y ? a : b, lo = up === a ? b : a, over = up.y + up.h + gap - lo.y;
        if (over > 0) { up.y -= over / 2; lo.y += over / 2; moved = true; }
      }
      if (!moved) break;
    }
    return rects;
  }
  const tint = (id) => 0.9 + 0.2 * unit('tint:' + id);   // each block a little lighter or darker than its neighbours

  // ---------------------------------------------------------------- the scene (browser only)
  function create(TF) {
    const { THREE, scene, MAT } = TF;
    const ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001), listeners = [], DIM_SUN = 0.62, DIM_HEMI = 0.72, MAX = 64, tmp = new THREE.Object3D(), size = blockSize();
    const S = {
      built: false, active: false, leaving: false, at: null, tower: null, q: null, sel: 0, slots: new Map(), free: [], held: null, layers: 16,
      orbit: { az: 0, el: 0.34, dist: 7, lookY: 1.8, lift: 0, user: 0 }, azTarget: 0, easeT: 0, camDirty: false, keysDown: {}, drag: null, hold: false, p: 0,
      pull: null, sway: null, nudge: null, light: null, base: 0, play: 0, env: null, sparkles: null, t: 0, engr: new Map(), engrPool: [], tagsEl: null, tags: [], pulse: 0, out: new Set(), drop: null, col: null, collapsed: false, shake: null, puffs: [], ghost: null,
    };
    const world = { state: S, STYLE, UNIT, TOP };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

    // ---- the spot: free ground near the Token Brew terrace, checked against the lobby's own colliders ----
    const SPOTS = [[6.4, -6.4], [6.4, -5.0], [7.6, -5.4], [5.6, -7.6], [8.4, -3.4]];
    function findSpot() {
      const ring = []; for (let a = 0; a < 12; a++) ring.push([Math.cos(a * Math.PI / 6) * 1.5, Math.sin(a * Math.PI / 6) * 1.5]);
      ring.push([0, 0], [0, 2.1]);
      for (const [x, z] of SPOTS) if (ring.every(([dx, dz]) => !TF.blocked(x + dx, z + dz, 0.05))) return [x, z];
      return SPOTS[0];
    }

    // ---- the table and its dressing: wood top on dark legs, a plaque, two stools, a few spare blocks, all lobby helpers ----
    const geo = TF.boxGeo(size.len, size.hgt, size.wid, 0.5);
    let woodMat = null;   // made at build: the lobby's textures do not exist yet when this module installs
    function table(x, z) {
      const T = 2.1, TH = 0.09, LEG = 0.1, H = TOP - TH;
      TF.box(T, TH, T, MAT.wood, x, H, z, { s: 0.8 });
      TF.box(T - 0.2, 0.12, T - 0.2, MAT.darkWood, x, H - 0.12, z, { cast: false });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) TF.box(LEG, H - 0.12, LEG, MAT.darkWood, x + sx * (T / 2 - 0.16), 0, z + sz * (T / 2 - 0.16));
      TF.signBoard('TOKEN TOWER', x, 0.52, z + T / 2 + 0.05, 1.1, 0.26, 0, { w: 256, h: 56, size: 22 });
      for (const [dx, dz] of [[-1.55, 0.7], [1.5, -0.4]]) { const st = TF.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.46, 12), MAT.wood)); st.position.set(x + dx, 0.23, z + dz); }
      for (const [dx, dz, ry, k] of [[-0.62, 0.5, 0.4, 0], [-0.48, 0.36, -0.2, 1], [0.7, 0.62, 1.3, 0]]) {   // a few spare blocks on the table, one leaning on another
        const m = new THREE.Mesh(geo, woodMat); m.position.set(x + dx, TOP + size.hgt * (k + 0.5), z + dz); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; scene.add(m);
      }
      TF.colBox(x - T / 2 - 0.25, z - T / 2 - 0.25, x + T / 2 + 0.25, z + T / 2 + 0.25);
    }

    // ---- the tower: one instanced mesh, a held block, and pooled overlays for the four candidates ----
    function blocks() {
      S.inst = new THREE.InstancedMesh(geo, woodMat, MAX); S.inst.castShadow = true; S.inst.receiveShadow = true; S.inst.frustumCulled = false; S.inst.userData.dyn = true;
      S.inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);   // per-block shade; allocated here, before any count change
      S.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(S.inst);
      for (let i = MAX - 1; i >= 0; i--) { S.free.push(i); S.inst.setMatrixAt(i, ZERO); }
      const hm = new THREE.MeshStandardMaterial({ map: TF.TX.wood, roughness: 0.92 });
      S.heldMesh = new THREE.Mesh(geo, hm); S.heldMesh.castShadow = true; S.heldMesh.receiveShadow = true; S.heldMesh.visible = false; S.heldMesh.userData.dyn = true; scene.add(S.heldMesh);
      S.shells = STYLE.map((st) => {
        const mat = new THREE.MeshBasicMaterial({ color: st.hex, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
        const shell = new THREE.Mesh(new THREE.BoxGeometry(size.len * 1.04, size.hgt * 1.12, size.wid * 1.08), mat);
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.len * 1.05, size.hgt * 1.14, size.wid * 1.1)), new THREE.LineBasicMaterial({ color: st.hex, transparent: true, opacity: 0.95 }));
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(size.wid * 0.95, size.hgt * 0.95), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        for (const o of [shell, frame, decal]) { o.visible = false; o.userData.dyn = true; scene.add(o); }
        shell.userData.slot = STYLE.indexOf(st) + 1;
        return { shell, frame, decal, mat, block: null, dir: [0, 0] };
      });
    }
    function glyph(g, st, n) {   // the colour, the shape and the number: three cues, so colour is never the only one
      g.clearRect(0, 0, 128, 128); g.fillStyle = 'rgba(20,14,8,.78)'; g.fillRect(4, 4, 120, 120); g.lineWidth = 6; g.strokeStyle = st.css; g.strokeRect(5, 5, 118, 118);
      g.fillStyle = st.css; g.beginPath(); const cx = 64, cy = 48, r = 28;
      if (st.glyph === 'triangle') { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.95, cy + r * 0.75); g.lineTo(cx - r * 0.95, cy + r * 0.75); g.closePath(); }
      else if (st.glyph === 'circle') g.arc(cx, cy, r * 0.85, 0, 6.2832);
      else if (st.glyph === 'diamond') { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.85, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.85, cy); g.closePath(); }
      else g.rect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5);
      g.fill(); g.font = '700 40px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f3ead6'; g.fillText(String(n), 64, 100);
    }
    function glyphs(on) {   // the four glyph-and-number decals exist only while the tower is up
      S.shells.forEach((s, k) => {
        const m = s.decal.material;
        if (on && !m.map) { m.map = TF.canvasTex(128, 128, (g) => glyph(g, STYLE[k], k + 1), { nearest: false }); m.needsUpdate = true; }
        else if (!on && m.map) { m.map.dispose(); m.map = null; m.needsUpdate = true; }
      });
    }
    const slotFor = (id) => { if (!S.slots.has(id)) S.slots.set(id, S.free.pop()); return S.slots.get(id); };
    world.setTower = (tower) => {
      S.tower = tower; S.layers = Math.max(16, tower.layers.length); S.collapsed = false; S.col = null;
      const live = new Set(E.blocks(tower).map((b) => b.id));
      for (const [id, i] of S.slots) if (!live.has(id)) { S.slots.delete(id); S.free.push(i); S.inst.setMatrixAt(i, ZERO); }
      for (const b of E.blocks(tower)) S.inst.setColorAt(slotFor(b.id), new THREE.Color().setScalar(tint(b.id)));
      S.inst.count = MAX; S.inst.instanceColor.needsUpdate = true;
      engrave(tower); for (const [, e] of S.engr) e.visible = true; refresh();
    };

    // ---- engraved answers on the top faces of placed blocks (canvas textures, disposed on leaving) ----
    function engrave(tower) {
      const want = E.blocks(tower).filter((b) => b.answerText);
      for (const [id, e] of S.engr) if (!want.some((b) => b.id === id)) { e.visible = false; e.material.map.dispose(); e.material.dispose(); scene.remove(e); S.engr.delete(id); }
      for (const b of want) {
        if (S.engr.has(b.id)) continue;
        const tex = TF.canvasTex(256, 64, (g) => {
          g.clearRect(0, 0, 256, 64); g.font = '600 26px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
          let s = 26; while (g.measureText(b.answerText).width > 236 && s > 12) { s -= 2; g.font = `600 ${s}px "Pixelify Sans", monospace`; }
          g.fillStyle = 'rgba(255,235,190,.35)'; g.fillText(b.answerText, 128, 34); g.fillStyle = 'rgba(52,30,14,.92)'; g.fillText(b.answerText, 128, 32);
        }, { nearest: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size.len * 0.92, size.len * 0.92 * 0.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        m.rotation.x = -Math.PI / 2; m.userData.dyn = true; scene.add(m); S.engr.set(b.id, m);
      }
    }

    // ---- per-frame transforms: base pose + sway + nudges + pull offsets ----
    function swayAt(b) {
      const sw = S.sway; if (!sw) return [0, 0];
      const k = Math.pow(b.layer / 16, 1.4), env = sw.amp * Math.exp(-sw.age / sw.decay) * k, ph = unit(b.id) * 6.283;
      return [env * Math.sin(sw.age * sw.freq * 6.283 + ph) * UNIT, env * Math.cos(sw.age * sw.freq * 5.1 + ph * 1.3) * UNIT];
    }
    function nudgeOf(b) {   // a few blocks inch out along their own axis and back
      const n = S.nudge; if (!n || !n.ids.includes(b.id)) return 0;
      return n.amp * Math.sin(Math.PI * Math.min(1, n.age / n.dur)) * size.len;
    }
    function transformOf(b, view) {
      const p = blockPose(b), [sx, sz] = swayAt(b), dir = pullVec(b, view || (S.q ? S.q.view : { sx: 1, sz: 1 })), nd = nudgeOf(b);
      return { x: p.x + sx + dir[0] * nd, y: p.y, z: p.z + sz + dir[1] * nd, ry: p.ry };
    }
    function refresh() {
      if (!S.tower || !S.inst || S.collapsed) return;
      for (const b of E.blocks(S.tower)) {
        const i = S.slots.get(b.id); if (i == null) continue;
        const hidden = S.held && S.held.id === b.id, tr = transformOf(b);
        tmp.position.set(S.at[0] + tr.x, tr.y + TOP, S.at[1] + tr.z); tmp.rotation.order = 'XYZ'; tmp.rotation.set(0, tr.ry, 0); tmp.scale.setScalar(hidden ? 0.0001 : 1); tmp.updateMatrix(); S.inst.setMatrixAt(i, tmp.matrix);
        const e = S.engr.get(b.id); if (e) { e.position.set(S.at[0] + tr.x, TOP + tr.y + size.hgt / 2 + 0.002, S.at[1] + tr.z); e.rotation.order = 'YXZ'; e.rotation.set(-Math.PI / 2, tr.ry, 0); }
      }
      S.inst.instanceMatrix.needsUpdate = true;
      overlays();
    }
    function overlays() {
      S.q && S.q.options.forEach((o, k) => {
        const s = S.shells[k], b = S.tower && E.find(S.tower, o.blockId); if (!b) return;
        const tr = transformOf(b), held = S.held && S.held.free && S.held.id === b.id, sel = S.sel === o.n;
        const pulse = sel ? 1 + 0.045 * Math.sin(S.t * 7) : 1, dir = s.dir, off = S.pull && S.pull.id === b.id ? S.pull.slide * size.len : 0;
        for (const m of [s.shell, s.frame]) { m.position.set(S.at[0] + tr.x + dir[0] * off, TOP + tr.y, S.at[1] + tr.z + dir[1] * off); m.rotation.y = tr.ry; m.scale.set(pulse, pulse, pulse); }
        s.shell.visible = s.frame.visible = s.decal.visible = !held;
        const dead = S.out.has(o.n); s.mat.opacity = dead ? 0.05 : sel ? 0.5 + 0.18 * Math.sin(S.t * 7) : 0.26; s.frame.material.opacity = dead ? 0.2 : sel ? 1 : 0.7;
        s.decal.position.set(S.at[0] + tr.x + dir[0] * (off + size.len / 2 + 0.003), TOP + tr.y, S.at[1] + tr.z + dir[1] * (off + size.len / 2 + 0.003)); s.decal.rotation.y = Math.atan2(dir[0], dir[1]);
      });
    }

    // ---- questions: the four candidates, their shells and billboard tags ----
    function makeTags() {
      if (S.tagsEl) return;
      const style = document.createElement('style');
      style.textContent = `
        .tt-tags { position: absolute; inset: 0; pointer-events: none; display: none; font-variant-ligatures: none; }
        .tt-tag { position: absolute; transform: translate(-50%, 0); padding: 3px 10px 4px; font-size: 16px; line-height: 1.2; white-space: nowrap; background: rgba(14, 16, 26, .86); border-left-width: 5px; pointer-events: auto; cursor: pointer; }
        .tt-tag b { font-weight: 700; margin-right: 6px; } .tt-tag i { font-style: normal; margin-right: 4px; }
        .tt-lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .tt-tag.out { opacity: .5; text-decoration: line-through; cursor: default; }
        .tt-tag.sel { background: rgba(40, 34, 18, .94); outline: 1px solid var(--gold); }`;
      document.head.appendChild(style);
      S.tagsEl = document.createElement('div'); S.tagsEl.className = 'tt-tags'; document.getElementById('ui').appendChild(S.tagsEl);
      S.tagsEl.addEventListener('click', (e) => { const t = e.target.closest('.tt-tag'); if (t) world.select(+t.dataset.n); });
    }
    world.setQuestion = (q, tower) => {
      makeTags(); S.q = q; S.sel = 0; S.out = new Set(); if (tower) world.setTower(tower);
      S.tagsEl.innerHTML = ''; S.tagsEl.style.display = 'block';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'tt-lines'); S.tagsEl.appendChild(svg);
      S.lines = q.options.map((o) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('stroke', STYLE[o.n - 1].css); l.setAttribute('stroke-width', 2); svg.appendChild(l); return l; });
      S.tags = q.options.map((o) => {
        const st = STYLE[o.n - 1], el = document.createElement('div');
        el.className = 'panel tt-tag'; el.dataset.n = o.n; el.style.borderLeftColor = st.css; el.innerHTML = `<i style="color:${st.css}">${st.mark}</i><b>${o.n}</b>`;
        el.appendChild(document.createTextNode(o.text)); S.tagsEl.appendChild(el); return { el, w: 0, h: 0 };
      });
      q.options.forEach((o, k) => {
        const s = S.shells[k], b = E.find(S.tower, o.blockId), face = FACE[o.face] || pullVec(b, q.view);
        s.dir = face; for (const m of [s.shell, s.frame, s.decal]) m.visible = true;
      });
      S.shells.slice(q.options.length).forEach((s) => { for (const m of [s.shell, s.frame, s.decal]) m.visible = false; });
      S.azTarget = azFor(q.view); S.orbit.user = 0; S.camDirty = true;
      refresh();
    };
    world.clearQuestion = () => { S.q = null; S.sel = 0; if (S.tagsEl) { S.tagsEl.innerHTML = ''; S.tagsEl.style.display = 'none'; } S.tags = []; (S.shells || []).forEach((s) => { for (const m of [s.shell, s.frame, s.decal]) m.visible = false; }); };
    world.select = (n) => {
      if (!S.q || (S.pull && S.pull.mode !== 'idle') || S.held) return false;
      if (n < 1 || n > S.q.options.length || S.out.has(n)) return false;
      S.sel = n; S.p = 0; S.tags.forEach((t, k) => t.el.classList.toggle('sel', k + 1 === n)); emit('select', n); return true;
    };
    Object.defineProperty(world, 'selected', { get: () => S.sel });
    function placeTags() {
      if (!S.tagsEl || !S.q) return;
      TF.camera.updateMatrixWorld();   // inside the life phase the camera's inverse matrix is last frame's: refresh it before projecting
      const r = TF.renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3(), px = (x, y, z) => { v.set(x, y, z).project(TF.camera); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; };
      const c0 = px(S.at[0], TOP + 1.2, S.at[1]), right = new THREE.Vector3().setFromMatrixColumn(TF.camera.matrixWorld, 0), c1 = px(S.at[0] + right.x, TOP + 1.2 + right.y, S.at[1] + right.z);
      const half = 0.62 * Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);   // half the tower's width on screen: tags stand clear of it, left and right in turn, top to bottom
      const pts = S.q.options.map((o, k) => {
        const b = E.find(S.tower, o.blockId), tr = transformOf(b), off = S.pull && S.pull.id === b.id ? S.pull.slide * size.len : 0, d = S.shells[k].dir;
        return px(S.at[0] + tr.x + d[0] * off, TOP + tr.y, S.at[1] + tr.z + d[1] * off);
      });
      const order = pts.map((p, k) => k).sort((a, b) => pts[a][1] - pts[b][1]), rects = [];
      order.forEach((k, rank) => {
        const t = S.tags[k]; if (!t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; }
        const w = t.w || 120, h = t.h || 26, side = rank % 2 ? 1 : -1;
        rects[k] = { x: Math.max(w / 2 + 8, Math.min(r.right - w / 2 - 8, c0[0] + side * (half + w / 2 + 22))), y: pts[k][1] - h / 2, w, h, side };
      });
      S.raw = rects.map((x) => Object.assign({}, x)); deconflict(rects, 6);
      const gone = S.held && S.held.free;
      rects.forEach((rc, k) => {
        const el = S.tags[k].el, ln = S.lines[k], tx = rc.x - rc.side * rc.w / 2, ty = rc.y + rc.h / 2;
        el.style.left = rc.x + 'px'; el.style.top = rc.y + 'px'; el.style.opacity = gone ? 0 : 1; el.style.pointerEvents = gone ? 'none' : 'auto';
        ln.setAttribute('x1', tx); ln.setAttribute('y1', ty); ln.setAttribute('x2', pts[k][0]); ln.setAttribute('y2', pts[k][1]); ln.style.opacity = gone ? 0 : S.sel === k + 1 ? 0.95 : 0.5;
      });
    }

    // ---- pulling: hold Space ~0.5 s (the block slides out as you hold), then the question decides ----
    function pullFrame(dt) {
      const P = S.pull; if (!P) return;
      const hm = S.heldMesh, b = E.find(S.tower, P.id) || P.block, tr = blockPose(b);
      if (P.mode === 'hold') { P.slide = JAM * S.p; }
      else if (P.mode === 'out') { P.t += dt / 0.45; P.slide = JAM + (1.2 - JAM) * Math.min(1, P.t); if (P.t >= 1) { P.mode = 'lift'; P.t = 0; P.from = [P.slide]; emit('lift'); } }
      else if (P.mode === 'jam') { P.t += dt / 0.16; P.slide = JAM + 0.012 * Math.sin(P.t * 30) * (1 - Math.min(1, P.t)); if (P.t >= 1) { P.mode = 'back'; P.t = 0; } }
      else if (P.mode === 'back') { P.t += dt / 0.34; P.slide = JAM * (1 - Math.min(1, P.t) ** 2); if (P.t >= 1) { P.slide = 0; emit('clunk'); finishPull('back'); return; } }
      if (P.mode === 'lift') {
        P.t += dt / 0.7; const k = Math.min(1, P.t), e = k * k * (3 - 2 * k), hv = hoverPose();
        hm.position.set(S.at[0] + tr.x + P.dir[0] * 1.2 * size.len + (hv.x - tr.x - P.dir[0] * 1.2 * size.len) * Math.max(0, (e - 0.35) / 0.65), TOP + tr.y + (hv.y - tr.y) * Math.min(1, e * 1.6), S.at[1] + tr.z + P.dir[1] * 1.2 * size.len + (hv.z - tr.z - P.dir[1] * 1.2 * size.len) * Math.max(0, (e - 0.35) / 0.65));
        hm.rotation.y = tr.ry + (hv.ry - tr.ry) * e;
        if (P.t >= 1) { finishPull('held'); return; }
      } else {
        hm.position.set(S.at[0] + tr.x + P.dir[0] * P.slide * size.len, TOP + tr.y, S.at[1] + tr.z + P.dir[1] * P.slide * size.len); hm.rotation.y = tr.ry;
      }
    }
    function hoverPose() {
      const sl = S.tower ? E.slots(S.tower) : { layer: 16 }, layer = S.held ? S.held.layer : sl.layer, u = S.held ? S.held.u : 0;
      const c = E.centreOf({ layer, uCoord: u }), top = Math.max(S.tower ? E.topLayer(S.tower) : 15, layer);
      return { x: c[0] * UNIT, z: c[1] * UNIT, y: (top + 1.5) * B.hgt * UNIT + 0.35 + (S.held && S.held.bob ? 0.03 * Math.sin(S.t * 2.4) : 0), ry: layer % 2 ? Math.PI / 2 : 0 };
    }
    function beginPull(n) {
      const o = S.q.options[n - 1], b = E.find(S.tower, o.blockId); if (!b) return;
      S.pull = { id: b.id, block: b, n, mode: 'hold', slide: 0, t: 0, dir: S.shells[n - 1].dir };
      S.held = { id: b.id, layer: E.slots(E.applyPull(S.tower, b.id)).layer, u: 0, bob: false, text: o.text }; S.heldMesh.visible = true; setHeldColour(b.id); emit('friction'); refresh();
    }
    function setHeldColour(id) { S.heldMesh.material.color.setScalar(tint(id)); }
    function finishPull(how) {
      const P = S.pull, cb = P.cb; S.pull = null;
      if (how === 'back') { S.held = null; S.heldMesh.visible = false; S.p = 0; refresh(); }
      else { S.held.bob = true; S.held.free = true; }
      if (cb) cb(how);
    }
    world.resolvePull = (correct, done) => {
      const P = S.pull; if (!P || P.mode !== 'resolve') return false;
      P.cb = done; P.mode = correct ? 'out' : 'jam'; P.t = 0; return true;
    };
    // the held block hovering over the top (placing, in jenga-play.js)
    world.hold = (blockId) => { S.held = { id: blockId, layer: E.slots(S.tower).layer, u: 0, bob: true, free: true }; S.heldMesh.visible = true; setHeldColour(blockId); };
    world.setHeld = (u, layer, text) => { if (!S.held) return; S.held.u = u; S.held.layer = layer; if (text != null) S.held.text = text; };
    world.dropHeld = () => { S.held = null; S.heldMesh.visible = false; S.pull = null; };
    Object.defineProperty(world, 'heldMesh', { get: () => S.heldMesh });

    // ---- shaking (visual only) ----
    world.shake = (level) => {
      if (level === 1) S.sway = { amp: 0.06, decay: 0.7, freq: 3.2, age: 0 };
      else if (level >= 2) {
        S.sway = { amp: 0.16, decay: 2.2, freq: 1.4, age: 0 };
        const ids = E.blocks(S.tower).filter((b) => b.layer >= 3 && b.layer < E.topLayer(S.tower)).map((b) => b.id).sort((a, b) => unit('n' + a + S.t) - unit('n' + b + S.t));
        S.nudge = { ids: ids.slice(0, 3), amp: 0.22, dur: 1.4, age: 0 };
      }
    };

    // ---- the room softens while the tower is up, a warm lamp pools over the table (restored exactly on leaving) ----
    world.light = (on) => {
      if (S.light) S.light.intensity = on ? S.play : S.base;
      if (on && !S.env) { S.env = { sun: TF.sun.intensity, hemi: TF.hemi.intensity }; TF.sun.intensity = S.env.sun * DIM_SUN; TF.hemi.intensity = S.env.hemi * DIM_HEMI; }
      else if (!on && S.env) { TF.sun.intensity = S.env.sun; TF.hemi.intensity = S.env.hemi; S.env = null; }
    };

    // ---- camera: an orbit round the tower; A/D or a drag turns it, and each question turns it to a corner whose two faces the candidates leave by ----
    const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    function cameraPose() {
      const f = frame(S.layers + (S.held ? 1 : 0), TF.camera.fov), o = S.orbit, ce = Math.cos(o.el);
      const want = clearReach(S.at, o.az, f.dist * ce, TF.COL) / ce;   // the camera's distance if nothing stands in the way, or the nearest clear one
      o.dist = S.distNow == null ? want : S.distNow; o.lookY = f.lookY; o.lift = f.lift; S.distWant = want;
      return orbitPose(o, [S.at[0], f.lookY, S.at[1]]);
    }
    function applyCamera(ms) { const p = cameraPose(); TF.cameraTo(vec(p.pos), vec(p.look), ms); S.camDirty = false; }
    world.orbitBy = (d) => { S.orbit.az = wrap(S.orbit.az + d); S.orbit.user += d; S.camDirty = true; };
    world.view = () => cameraPose();

    // ---- enter and leave: fade, lock and hide the hero, ease the camera; the follow camera and the hero come back exactly as they were ----
    world.enter = (cb) => {
      if (!S.built || S.active || S.leaving || TF.traveling || TF.talking || TF.locked || TF.zone !== 'lobby') return false;
      S.active = true;
      TF.fade(() => {
        TF.lockPlayer(true); TF.hero.g.visible = false; world.light(true); if (S.sparkles) S.sparkles.visible = false;
        glyphs(true); puffs(true); S.orbit.az = S.azTarget; S.easeT = 0.85; applyCamera(800);
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
        world.clearQuestion(); world.dropHeld(); world.hideGhost(); glyphs(false); puffs(false); S.drop = null; S.shake = null; world.setTower(S.rest); S.sway = null; S.nudge = null; S.out = new Set(); world.light(false); if (S.sparkles) S.sparkles.visible = true;
        for (const [, e] of S.engr) { e.material.map.dispose(); e.material.dispose(); scene.remove(e); } S.engr.clear();
        S.active = false; S.leaving = false; S.hold = false; S.p = 0; S.keysDown = {}; S.distNow = null; S.distWant = null;
        if (cb) cb();
        emit('leave');
      });
      return true;
    };
    world.open = () => world.enter();   // jenga-play.js replaces this

    // ---- input: A/D and drag orbit, 1-4 or a click select, hold Space pulls, Esc leaves ----
    function onKey(e) {
      if (!S.active) return false;
      if (e.code === 'KeyA' || e.code === 'KeyD') { S.keysDown[e.code] = true; return true; }
      if (e.code === 'Escape' && !e.repeat) { emit('exit'); if (!listeners.some(([ev]) => ev === 'exit')) world.leave(); return true; }
      if (/^Digit[1-4]$/.test(e.code) && !e.repeat) { world.select(+e.code.slice(5)); return true; }
      if (e.code === 'Space') { if (!e.repeat && S.q && S.sel && !S.held && !S.pull) S.hold = true; return true; }
      return false;
    }
    function onKeyUp(e) { if (e.code === 'KeyA' || e.code === 'KeyD') S.keysDown[e.code] = false; if (e.code === 'Space') S.hold = false; }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function onDown(e) { if (S.active) S.drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; }
    function onMove(e) {
      const d = S.drag; if (!d || !S.active) return;
      const dx = e.clientX - d.x; if (Math.abs(dx) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
      if (d.moved) { world.orbitBy(-dx * 0.006); d.x = e.clientX; d.y = e.clientY; }
    }
    function onUp(e) {
      const d = S.drag; S.drag = null; if (!d || !S.active || d.moved) return;
      if (S.held && S.held.free) { emit('click', { x: e.clientX, y: e.clientY }); return; }
      if (!S.q || S.held) return;
      const r = TF.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, TF.camera);
      const hit = ray.intersectObjects(S.shells.map((s) => s.shell).filter((m) => m.visible), false)[0];
      if (hit) world.select(hit.object.userData.slot);
    }

    // ---- placing: the ghost, the drop, the settle, a little dust ----
    const BAND_STYLE = { green: 1, amber: 0, red: 3, tip: 3 };   // the stability band as an answer-slot colour: green, amber, rose
    function ghost() {
      const g = new THREE.Mesh(new THREE.BoxGeometry(size.len * 1.02, size.hgt * 1.04, size.wid * 1.04), new THREE.MeshBasicMaterial({ color: STYLE[1].hex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
      const f = new THREE.LineSegments(new THREE.EdgesGeometry(g.geometry), new THREE.LineBasicMaterial({ color: STYLE[1].hex }));
      for (const o of [g, f]) { o.visible = false; o.userData.dyn = true; scene.add(o); }
      S.ghost = { g, f };
    }
    world.setGhost = (u, layer, band) => {
      if (!S.ghost) ghost();
      const p = blockPose({ layer, uCoord: u }), hex = STYLE[BAND_STYLE[band] != null ? BAND_STYLE[band] : 1].hex;
      for (const o of [S.ghost.g, S.ghost.f]) { o.position.set(S.at[0] + p.x, TOP + p.y, S.at[1] + p.z); o.rotation.y = p.ry; o.visible = true; o.material.color.setHex(hex); }
    };
    world.hideGhost = () => { if (S.ghost) { S.ghost.g.visible = false; S.ghost.f.visible = false; } };
    world.drop = (u, layer, done) => {
      const to = blockPose({ layer, uCoord: u }), hv = hoverPose();
      S.drop = { t: 0, fromY: hv.y, toY: to.y, x: to.x, z: to.z, ry: to.ry, done }; world.hideGhost();
    };
    world.sway = (amp) => { S.sway = { amp, decay: 0.9, freq: 2.6, age: 0 }; };
    function puffs(on) {
      if (on && !S.puffGeo) {
        S.puffGeo = new THREE.SphereGeometry(0.05, 8, 6);
        for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(S.puffGeo, new THREE.MeshBasicMaterial({ color: MAT.paver ? MAT.paver.color : 0xe8dcc0, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.dyn = true; scene.add(m); S.puffs.push({ m, life: 0, v: [0, 0, 0] }); }
      } else if (!on && S.puffGeo) { for (const p of S.puffs) { scene.remove(p.m); p.m.material.dispose(); } S.puffs = []; S.puffGeo.dispose(); S.puffGeo = null; }
    }
    world.puff = (layer, u) => {
      const p = blockPose({ layer, uCoord: u }), c = size.len / 2; let k = 0;
      for (const q of S.puffs) {
        if (q.life > 0 || k >= 6) continue;
        const a = k * 1.0472 + 0.4, dx = Math.cos(a), dz = Math.sin(a); k++;
        q.life = 1; q.m.position.set(S.at[0] + p.x + dx * c * 0.7, TOP + p.y + size.hgt * 0.5, S.at[1] + p.z + dz * c * 0.7); q.v = [dx * 0.35, 0.28, dz * 0.35]; q.m.visible = true;
      }
    };
    world.collapse = (tower, seed, done) => {
      world.dropHeld(); world.hideGhost(); world.clearQuestion();
      for (const [, e] of S.engr) e.visible = false;
      const col = E.collapseInit(tower, BG.mulberry32(seed), { floorY: -TOP / UNIT, tableHalf: 4.0, g: 9.8 / UNIT });   // real-world gravity, in block widths
      for (const b of col.bodies) { b.vel[0] *= 3.2; b.vel[2] *= 3.2; b.wx *= 1.5; b.wy *= 1.5; b.wz *= 1.5; }
      S.col = col; S.colDone = done; S.collapsed = true; S.colFrames = 0;
      emit('rumble'); world.cameraShake(1.8, 0.06);
    };
    world.cameraShake = (secs, amp) => { if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; S.shake = { t: secs, d: secs, m: amp }; };
    // the pointer, as a lateral position along the width axis of `layer` (even layers: z, odd layers: x), in block widths. The axis is projected into screen space and the pointer
    // is read along it, so it works from any camera angle (a ray onto the layer's own plane is hopelessly steep when the camera is level with the top). null when the axis
    // points straight at the camera.
    world.lateralAt = (cx, cy, layer) => {
      TF.camera.updateMatrixWorld();
      const r = TF.renderer.domElement.getBoundingClientRect(), y = TOP + (layer + 0.5) * B.hgt * UNIT, p = new THREE.Vector3(), at = (u) => {
        const c = E.centreOf({ layer, uCoord: u }); p.set(S.at[0] + c[0] * UNIT, y, S.at[1] + c[1] * UNIT).project(TF.camera); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
      };
      const a = at(-E.U_MAX), b = at(E.U_MAX), dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
      if (len2 < 400) return null;
      return -E.U_MAX + 2 * E.U_MAX * (((cx - a[0]) * dx + (cy - a[1]) * dy) / len2);
    };
    world.screenSign = (layer) => { const az = S.orbit.az, axis = layer % 2 === 0 ? [0, 1] : [1, 0]; return axis[0] * Math.cos(az) - axis[1] * Math.sin(az) >= 0 ? 1 : -1; };
    world.mark = (n) => { S.out.add(n); if (S.tags[n - 1]) S.tags[n - 1].el.classList.add('out'); if (S.sel === n) S.sel = 0; };

    // ---- the tick ----
    world.tick = (t, dt) => {
      if (!S.active) return;
      S.t += dt;
      if (S.sway) { S.sway.age += dt; if (S.sway.age > S.sway.decay * 5) S.sway = null; }
      if (S.nudge) { S.nudge.age += dt; if (S.nudge.age > S.nudge.dur) S.nudge = null; }
      const turn = (S.keysDown.KeyD ? 1 : 0) - (S.keysDown.KeyA ? 1 : 0);
      if (turn) world.orbitBy(turn * 1.3 * dt);
      if (S.q && !turn && !(S.drag && S.drag.moved)) {   // a question turns the camera to its corner (the player's own orbit is theirs until the next question)
        const az = easeAngle(S.orbit.az, S.azTarget + S.orbit.user, 2.4 * dt); if (az !== S.orbit.az) { S.orbit.az = az; S.camDirty = true; }
      }
      if (S.easeT > 0) S.easeT -= dt;
      if (S.distWant != null) { const d = S.distWant - (S.distNow == null ? S.distWant : S.distNow); if (Math.abs(d) > 1e-3) { S.distNow = (S.distNow == null ? S.distWant : S.distNow) + Math.sign(d) * Math.min(Math.abs(d), 4 * dt); S.camDirty = true; } else S.distNow = S.distWant; }
      // holding Space slides the block out; letting go too soon slides it back
      if (S.q && S.sel && !S.held && !S.pull && S.hold) beginPull(S.sel);
      if (S.pull && S.pull.mode === 'hold') {
        S.p = S.hold ? Math.min(1, S.p + dt / PULL_SECS) : Math.max(0, S.p - dt / 0.25);
        if (S.p >= 1) { S.pull.mode = 'resolve'; S.hold = false; emit('pull', S.pull.n); }
        else if (S.p <= 0 && !S.hold) { S.held = null; S.heldMesh.visible = false; S.pull = null; refresh(); }
      }
      pullFrame(dt);
      if (S.drop) {
        const D = S.drop; D.t += dt / 0.3; const k = Math.min(1, D.t);
        S.heldMesh.position.set(S.at[0] + D.x, TOP + D.fromY + (D.toY - D.fromY) * k * k, S.at[1] + D.z); S.heldMesh.rotation.y = D.ry;
        if (k >= 1) { S.drop = null; emit('land'); if (D.done) D.done(); }
      }
      for (const q of S.puffs) if (q.life > 0) { q.life -= dt / 0.65; const k = Math.max(0, q.life); q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt; q.m.scale.setScalar(2.2 - 1.4 * k); q.m.material.opacity = 0.5 * k; if (q.life <= 0) q.m.visible = false; }
      if (S.col) {
        const C = S.col, running = !(S.colFrames > 0 && (E.collapseDone(C) || C.t > 7));
        if (running) { E.collapseStep(C, dt); S.colFrames++; if (E.collapseDone(C) || C.t > 7) { const f = S.colDone; S.colDone = null; if (f) f(); } }
        for (const b of C.bodies) {
          const i = S.slots.get(b.id); if (i == null) continue;
          tmp.position.set(S.at[0] + b.pos[0] * UNIT, TOP + b.pos[1] * UNIT, S.at[1] + b.pos[2] * UNIT); tmp.rotation.order = 'ZXY'; tmp.rotation.set(b.tx, b.yaw, b.tz); tmp.scale.setScalar(1); tmp.updateMatrix(); S.inst.setMatrixAt(i, tmp.matrix);
        }
        S.inst.instanceMatrix.needsUpdate = true;
      }
      if (S.held && !S.pull && !S.drop) { const hv = hoverPose(); S.heldMesh.position.set(S.at[0] + hv.x, TOP + hv.y, S.at[1] + hv.z); S.heldMesh.rotation.y = hv.ry; }
      if (S.pull && S.pull.mode === 'hold') { /* the mesh follows the hold offset in pullFrame */ }
      refresh(); placeTags();
      if (S.camDirty && S.easeT <= 0) applyCamera(0);
      if (S.shake) { const k = S.shake; k.t -= dt; const m = k.m * Math.max(0, k.t / k.d); TF.camera.position.x += (Math.random() - 0.5) * m; TF.camera.position.y += (Math.random() - 0.5) * m; TF.camera.position.z += (Math.random() - 0.5) * m; if (k.t <= 0) S.shake = null; }
    };

    // ---- building, at boot ----
    world.build = () => {
      if (S.built) return;
      woodMat = new THREE.MeshStandardMaterial({ map: TF.TX.wood, roughness: 0.92, metalness: 0 });
      S.at = findSpot(); table(S.at[0], S.at[1]); blocks(); ghost();
      S.base = 0.05; S.play = 0.9;
      S.light = TF.pointLight('lobby', 0xffd9a0, S.base, 7, S.at[0] - 0.4, TOP + 3.6, S.at[1] + 1.2);   // always a little on, so the number of lights never changes at run time
      S.rest = E.makeTower(BG.mulberry32(7)).tower;   // the half-played tower that stands on the table when nobody is playing
      world.setTower(S.rest);
      if (TF.sparkles) S.sparkles = TF.sparkles(S.at[0], S.at[1], 0xffd27a, 18, 0.5, 2.2);   // the twinkle that says "you can play this"
      TF.INTER.push({ x: S.at[0], z: S.at[1] + 2.1, r: 1.5, label: 'Token Tower', verb: 'Play', act: () => world.open() });
      S.built = true;
    };
    world.keys = { onKey, onKeyUp, onDown, onMove, onUp };
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.tower = world;
    TF.life.push((t, dt) => world.tick(t, dt));
    TF.on('boot', () => {
      world.build();
      const prev = TF.onKey; TF.onKey = (e) => (world.state.active && world.keys.onKey(e)) || (prev ? prev(e) : false);
      addEventListener('keyup', world.keys.onKeyUp);
      const el = TF.renderer.domElement; el.addEventListener('pointerdown', world.keys.onDown); el.addEventListener('pointermove', world.keys.onMove); el.addEventListener('pointerup', world.keys.onUp);
    });
    if (typeof window !== 'undefined') window.jengaWorld = world;
    return world;
  }
  return { UNIT, TOP, STYLE, PULL_SECS, JAM, hash, blockPose, blockSize, pullVec, FACE, azFor, orbitPose, wrap, easeAngle, frame, clearReach, deconflict, tint, create, install };
});
