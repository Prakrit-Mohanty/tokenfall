// Token Mill — the mill in the world. Browser: window.MillWorld. Node: require('./mill-world.js') (the pure part: the layout, the brake meter, selection order, plate text, view fit).
//
// The mill is built INSIDE the Data Archive zone with the lobby's own helpers, on top of the zone's shell, its walls, its "Back to Lobby" portal and its amber light: a straight conveyor
// belt across the room (rollers, side rails with an amber glowStrip, a scrolling pixel texture), wooden crates with paper tag cards, four bin chutes on the camera side with signBoard plates
// (their text re-rendered when the plates flip), an overflow pit at the belt's end, a crane gantry with a trolley, a string of lamps, steam puffs and a control desk. Idle, the belt carries
// sample crates. Starting a shift fades, hides the hero at the desk and eases the camera to an elevated three-quarter view along the belt; leaving restores the follow camera and the hero.
//
//   install(TF)                registers at the lobby's boot (after mergeStatic, so everything here stays a live object); sets TF.mill = world
//   world.enter(cb) / world.leave(cb)     fade, lock + hide the hero, ease the camera in / restore camera and hero      world.open() = enter (mill-play.js replaces it)
//   world.loadShift(shift)     put a shift's crates on the belt schedule and its plates on the bins (shift = a runSpec shift)       world.clearShift() frees the tag textures
//   world.run(on)              the belt runs (belt time advances) or stands still; world.bt = belt time, world.rt = real time of the shift, world.brakes = the brake log [{ t0, t1 }]
//   world.setBrake(on)         hold the brake: the belt runs at 40% for up to 3 s a shift (never refilled); world.brakeLeft, world.brakeOn
//   world.setPlates(bins) / world.flipPlates(bins, atBelt)    the four plates show a policy's bins; a flip ripples along the belt (each plate when the old wave has passed it)
//   world.stamp(uid, { text, tone, bin })   a stamp pops at the bin a crate landed in (bin -1: the pit); tone 'ok' | 'lax' | 'strict' | 'spill' | 'drop'; world.flipPlate(bin, bins) / world.burst(bin); world.steam(bin) / world.siren(secs) / world.bell() / world.cameraShake()
//   world.select(uid) / world.selected / world.visibleCrates() / world.canGrab, world.canRoute      selection, the crates in the zone for the reading panel, and the rules' say-so
//   world.on(evt, fn)          'enter' 'leave' 'grab' 'release' 'select' 'route' { uid, bin, via } 'land' { uid, bin } 'pit' { uid, held } 'brake' { on } 'brakeEmpty' 'bell' 'exit' (Esc)
// Routing: drag a crate off the belt and drop it on a bin (mouse or touch); or click it, then click a bin; or Tab / Shift+Tab to select and 1-4 to route. A held crate leaves the belt; released
// away from a bin it goes back on the belt; one that reaches the pit while held is dropped. Space held brakes.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./mill-engine.js') : root.MillEngine, isNode ? require('./mill-content.js') : root.MILL_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.MillWorld = api;
})(this, function (E, C, CW) {
  const { RUN } = C, STYLE = CW.STYLE;   // the same four colours and shapes as the answer slots everywhere: amber triangle, green circle, cyan diamond, rose square
  const BASE_ASPECT = 16 / 9, CRATE = { l: 1.4, h: 0.6, w: 1.12 }, SLIDE = 0.7, EMERGE = 0.6, POOL = 8;
  // the room, in archive-local metres (x right, z towards the camera): the belt, its bins, the pit, the desk
  const LAYOUT = {
    belt: { z: -3.2, top: 0.9, w: 1.5, x0: -11.2, x1: 6.4 }, hopper: -6.4, pit: { x0: 6.4, x1: 8.6 },
    bin: { w: 1.9, front: 1.3, back: -0.7, h: 0.95, rampFrom: -2.45 },   // the chute runs from the belt's edge (z -2.45) to the bin body, which stands between z -0.7 and z +1.3
    plate: { y: 2.1, z: 1.55 }, desk: { x: -8.3, z: 3.4 }, gantry: { x: 8.2, y: 3.1 },
    camera: { pos: [-7.8, 6.6, 8.6], look: [-0.2, 0.3, -1.5], fov: 40 },
  };

  // ---------------------------------------------------------------- pure
  const toWorld = (A, p) => [A[0] + p[0], p[1], A[1] + p[2]];
  // the view, pulled back along the line of sight when the window is narrower than 16:9 so the whole zone and its four plates stay in frame
  function fitView(aspect) {
    const k = Math.max(1, BASE_ASPECT / Math.max(0.4, aspect)), c = LAYOUT.camera;
    return { pos: k === 1 ? c.pos.slice() : c.pos.map((v, i) => c.look[i] + (v - c.look[i]) * k), look: c.look.slice(), fov: c.fov };
  }
  // the brake meter: 3 s of brake a shift, never refilled. step(state, dt, want, rate) -> belt seconds this frame; the state counts the real seconds braked, so the belt clock this builds is exactly
  // the one E.beltClock makes from the same brake log.
  function brakeStep(st, dt, want, rate) {
    const r = rate || 1, left = Math.max(0, RUN.brake - st.used), braked = want ? Math.min(dt, left) : 0;
    st.used += braked; st.on = braked > 0; st.empty = st.used >= RUN.brake - 1e-9;
    return { belt: (braked * RUN.brakeSpeed + (dt - braked)) * r, braked };
  }
  // Tab / Shift+Tab: the crates in the zone in the order they will leave it (the one nearest the pit first), cyclic; nothing selected starts at the first (or the last going back)
  function nextSelection(list, current, dir) {
    if (!list.length) return null;
    const i = list.findIndex((c) => c.uid === current);
    return list[i < 0 ? (dir < 0 ? list.length - 1 : 0) : (i + (dir < 0 ? -1 : 1) + list.length) % list.length].uid;
  }
  // the order the plates flip in along the belt: bin k flips (k + 0.5) / 4 of the way through the shift change; [{ bin, delay }] in seconds, left to right
  const plateRipple = (total) => [0, 1, 2, 3].map((bin) => ({ bin, delay: +(((bin + 0.5) / 4) * (total || 0.6)).toFixed(3) }));
  function wrapLines(text, maxW, measure) {   // greedy word wrap to a pixel width with any measure function; a word wider than the line is cut
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/).filter(Boolean)) {
      let word = w;
      while (measure(word) > maxW && word.length > 1) { let k = word.length - 1; while (k > 1 && measure(word.slice(0, k)) > maxW) k--; if (line) { out.push(line); line = ''; } out.push(word.slice(0, k)); word = word.slice(k); }
      const next = line ? line + ' ' + word : word;
      if (measure(next) <= maxW || !line) line = next; else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out;
  }
  // a plate's words: the slot's number and shape, the label, and the legend in at most two lines
  const plateText = (bin, k) => ({ num: String(k + 1), mark: STYLE[k].mark, label: bin.label, legend: bin.legend });
  const ease = (k) => k * k * (3 - 2 * k);

  // ---------------------------------------------------------------- the scene (browser only)
  function create(TF) {
    const { THREE, scene, MAT } = TF;
    const listeners = [], DIM_SUN = 0.72, DIM_HEMI = 0.8;
    const S = {
      built: false, active: false, leaving: false, A: null, shift: null, bt: 0, rt: 0, running: false, rate: 1, crates: new Map(), free: [], pool: [], ambient: [], held: null, sel: null, hover: null, ptr: { x: 0, y: 0, in: false },
      brake: { used: 0, on: false, empty: false }, want: false, brakes: [], plates: [], plateState: [], steam: [], sparks: [], tok: null, light: null, base: 0, play: 0, env: null, sparkles: null, shake: null, siren: 0,
      beltTex: null, trolley: null, lamps: [], stamps: [], flips: [], aspect: 0, ui: null, idleT: 0, rollers: [],
    };
    const SIDES_PREVIEW = C.SIDES.doors.bins;   // before any shift, the plates show the first policy
    const world = { state: S, STYLE, LAYOUT };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    world.canGrab = () => true;    // the rules say whether a crate may be picked up (a shift is running and nothing blocks it)
    world.canRoute = () => true;
    Object.defineProperties(world, { bt: { get: () => S.bt }, rt: { get: () => S.rt }, brakes: { get: () => S.brakes }, brakeLeft: { get: () => Math.max(0, RUN.brake - S.brake.used) }, brakeOn: { get: () => S.brake.on }, selected: { get: () => S.sel } });
    const V = (x, y, z) => new THREE.Vector3(S.A[0] + x, y, S.A[1] + z);

    // ---- the colours and the font come from the lobby's own tokens, never from hex written here ----
    function tokens() {
      const cs = getComputedStyle(document.documentElement), v = (k, d) => cs.getPropertyValue(k).trim() || d, hex = (c) => '#' + c.getHexString();
      return { paper: v('--ink', '#f3ead6'), gold: v('--gold', '#d9b46a'), dark: hex(MAT.lanternCap.color), wood: hex(MAT.lanternCap.color.clone().multiplyScalar(1.7)), red: hex(MAT.redLantern.color), font: getComputedStyle(document.body).fontFamily || 'monospace' };
    }
    const amber = () => STYLE[0].hex;

    // ---- the mill, in archive-local metres. B(): a lobby box at a local position (y is the bottom) ----
    function build() {
      const A = S.A, L = LAYOUT, bz = L.belt.z, len = L.belt.x1 - L.belt.x0, cxm = (L.belt.x0 + L.belt.x1) / 2;
      const bx = (w, h, d, m, x, y, z, o) => TF.box(w, h, d, m, A[0] + x, y, A[1] + z, o);
      const mesh = (g, m, x, y, z, o = {}) => { const me = new THREE.Mesh(g, m); me.position.set(A[0] + x, y, A[1] + z); me.castShadow = o.cast !== false; me.receiveShadow = true; scene.add(me); return me; };
      // the belt: a dark bed, a rubber surface with a scrolling pixel texture, side rails with an amber strip, legs, end rollers
      bx(len, 0.22, 1.6, MAT.metal, cxm, 0.5, bz);
      S.beltTex = TF.canvasTex(32, 16, (g, w, h) => { g.fillStyle = '#20232b'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c303a'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 4, h); g.fillStyle = '#4a3a22'; for (let x = 0; x < w; x += 8) { g.fillRect(x + 1, 2, 2, 2); g.fillRect(x + 3, h - 4, 2, 2); } }, { nearest: true });
      S.beltTex.repeat.set(len / 1.0, 1);
      const surface = new THREE.Mesh(new THREE.PlaneGeometry(len, L.belt.w), new THREE.MeshStandardMaterial({ map: S.beltTex, roughness: 0.9 })); surface.rotation.x = -Math.PI / 2; surface.position.set(A[0] + cxm, L.belt.top, A[1] + bz); surface.receiveShadow = true; scene.add(surface);
      const strip = TF.glowStrip(amber());
      for (const s of [-1, 1]) { bx(len, 0.28, 0.12, MAT.metal, cxm, 0.74, bz + s * 0.74); mesh(new THREE.BoxGeometry(len, 0.045, 0.06), strip, cxm, 1.05, bz + s * 0.74, { cast: false }); }
      for (let x = L.belt.x0 + 0.6; x < L.belt.x1; x += 3) for (const s of [-1, 1]) bx(0.16, 0.5, 0.16, MAT.metal, x, 0, bz + s * 0.66);
      for (const x of [L.belt.x0, L.belt.x1]) { const r = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.45, 14), MAT.metal, x, 0.62, bz); r.rotation.x = Math.PI / 2; S.rollers.push(r); }
      for (let x = L.belt.x0 + 1.2; x < L.belt.x1 - 0.8; x += 1.2) { const r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), MAT.darkWood, x, 0.7, bz, { cast: false }); r.rotation.x = Math.PI / 2; S.rollers.push(r); }
      // the hopper where every crate enters the zone, and the overflow pit where a crate that was never routed falls
      for (const s of [-1, 1]) bx(0.18, 1.7, 0.18, MAT.wood, L.hopper - 0.3, 0.3, bz + s * 0.95);
      bx(0.3, 0.22, 2.2, MAT.darkWood, L.hopper - 0.3, 2.0, bz); bx(0.06, 0.5, 1.5, MAT.cladding || MAT.concrete, L.hopper - 0.3, 1.45, bz, { cast: false });
      bx(L.pit.x1 - L.pit.x0, 0.06, 2.0, MAT.lanternCap, (L.pit.x0 + L.pit.x1) / 2, 0.02, bz, { cast: false });
      for (const [dx, dz, w, d] of [[(L.pit.x0 + L.pit.x1) / 2, -1.05, L.pit.x1 - L.pit.x0 + 0.2, 0.2], [(L.pit.x0 + L.pit.x1) / 2, 1.05, L.pit.x1 - L.pit.x0 + 0.2, 0.2], [L.pit.x1 + 0.1, 0, 0.2, 2.1]]) bx(w, 0.6, d, MAT.concrete, dx, 0, bz + dz);
      mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: TF.textTex('OVERFLOW', { w: 256, h: 64, size: 28 }), roughness: 0.9 }), (L.pit.x0 + L.pit.x1) / 2, 1.2, bz - 1.1, { cast: false });
      // four bin chutes on the camera side: a ramp from the belt's edge, a bin body, a plate on two posts; each bin has a slot colour and a shape, the same as the answer slots elsewhere
      E.binXs.forEach((x, k) => {
        const st = STYLE[k], ramp = mesh(new THREE.BoxGeometry(L.bin.w - 0.3, 0.08, 1.75), MAT.metal, x, 0.62, bz + 1.55); ramp.rotation.x = 0.34; ramp.userData.bin = k;
        const body = (w, h, d, dx, y, dz, m) => bx(w, h, d, m, x + dx, y, dz);
        body(L.bin.w, 0.08, 2.0, 0, 0, (L.bin.back + L.bin.front) / 2, MAT.darkWood); body(0.1, L.bin.h, 2.0, -L.bin.w / 2, 0, (L.bin.back + L.bin.front) / 2, MAT.wood); body(0.1, L.bin.h, 2.0, L.bin.w / 2, 0, (L.bin.back + L.bin.front) / 2, MAT.wood);
        const front = body(L.bin.w, L.bin.h, 0.1, 0, 0, L.bin.front, MAT.wood); front.userData.bin = k; body(L.bin.w, L.bin.h - 0.3, 0.1, 0, 0, L.bin.back, MAT.wood);
        const trim = mesh(new THREE.BoxGeometry(L.bin.w, 0.07, 0.12), TF.glowStrip(st.hex), x, L.bin.h + 0.02, L.bin.front + 0.04, { cast: false });
        S.plateState.push({ k, trim, glow: trim.material, pulse: 0 });
        for (const s of [-1, 1]) bx(0.09, 1.2, 0.09, MAT.metal, x + s * (L.bin.w / 2 - 0.05), L.bin.h, L.bin.front + 0.08);
        const plate = TF.signBoard('', A[0] + x, L.plate.y, A[1] + L.plate.z, L.bin.w + 0.25, 0.8, -0.42, { w: 8, h: 8 }); plate.userData.bin = k; plate.rotation.x = -0.12; S.plates.push(plate);
      });
      // the crane gantry: two beams over the belt on legs, a trolley that creeps along it with a cable and a claw
      for (const x of [-L.gantry.x, L.gantry.x]) for (const z of [bz - 1.5, bz + 1.5]) bx(0.2, L.gantry.y, 0.2, MAT.metal, x, 0, z);
      for (const z of [bz - 1.5, bz + 1.5]) bx(2 * L.gantry.x + 0.4, 0.22, 0.2, MAT.metal, 0, L.gantry.y, z);
      bx(0.2, 0.2, 3.2, MAT.metal, -L.gantry.x, L.gantry.y + 0.22, bz); bx(0.2, 0.2, 3.2, MAT.metal, L.gantry.x, L.gantry.y + 0.22, bz);
      const trolley = new THREE.Group(); scene.add(trolley); trolley.userData.dyn = true;
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 3.1), MAT.darkWood); car.position.y = L.gantry.y + 0.2; car.castShadow = true; trolley.add(car);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), MAT.metal); cable.position.y = L.gantry.y - 0.6; trolley.add(cable);
      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), MAT.gold); claw.position.y = L.gantry.y - 1.4; claw.castShadow = true; trolley.add(claw);
      S.trolley = trolley; trolley.position.set(A[0], 0, A[1] + bz);
      // a string of lamps along the front beam, swaying a little; a siren on the end post (cosmetic: it flashes on a spill)
      const lg = new THREE.SphereGeometry(0.1, 8, 6), cg = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8);
      for (let i = 0; i < 17; i++) {
        const x = -L.gantry.x + (2 * L.gantry.x * i) / 16, g = new THREE.Group(); g.position.set(A[0] + x, L.gantry.y - 0.08 - 0.14 * Math.sin((Math.PI * i) / 16), A[1] + bz + 1.5); scene.add(g); g.userData.dyn = true;
        const b = new THREE.Mesh(lg, MAT.warmGlow); b.position.y = -0.12; g.add(b); const cp = new THREE.Mesh(cg, MAT.lanternCap); cp.position.y = -0.02; g.add(cp); S.lamps.push({ g, ph: i * 0.7 });
      }
      bx(0.6, 0.12, 0.6, MAT.metal, L.gantry.x + 0.9, 0, bz + 2.2); bx(0.12, 1.8, 0.12, MAT.metal, L.gantry.x + 0.9, 0.12, bz + 2.2);
      S.sirenMat = new THREE.MeshStandardMaterial({ color: MAT.redLantern.color, emissive: MAT.redLantern.emissive, emissiveIntensity: 0.2, roughness: 0.6 });
      S.sirenLamp = mesh(new THREE.SphereGeometry(0.24, 10, 8), S.sirenMat, L.gantry.x + 0.9, 2.1, bz + 2.2, { cast: false });
      // the control desk: where the shift starts, with a screen and a lamp; the hero stands in front of it
      const d = L.desk; bx(2.0, 0.08, 0.9, MAT.wood, d.x, 0.82, d.z); bx(1.9, 0.82, 0.8, MAT.darkWood, d.x, 0, d.z);
      mesh(new THREE.BoxGeometry(0.9, 0.55, 0.06), MAT.screen, d.x - 0.35, 1.32, d.z - 0.2).rotation.x = -0.18; bx(0.12, 0.3, 0.12, MAT.metal, d.x - 0.35, 0.9, d.z - 0.2);
      const lamp = mesh(new THREE.SphereGeometry(0.12, 8, 6), MAT.warmGlow, d.x + 0.7, 1.2, d.z - 0.1, { cast: false }); bx(0.05, 0.28, 0.05, MAT.metal, d.x + 0.7, 0.9, d.z - 0.1); lamp.userData.dyn = true;
      TF.signBoard('CONTROL DESK', A[0] + d.x, 1.75, A[1] + d.z - 0.45, 1.5, 0.3, 0, { w: 256, h: 56, size: 22 });
      for (const [x, z, w, dd] of [[cxm, bz, len + 0.6, 1.8], [(L.pit.x0 + L.pit.x1) / 2 + 0.2, bz, 2.8, 2.4], [d.x, d.z, 2.2, 1.1], [0, (L.bin.back + L.bin.front) / 2 - 0.4, 10.2, 4.6]]) TF.colBox(A[0] + x - w / 2, A[1] + z - dd / 2, A[0] + x + w / 2, A[1] + z + dd / 2);
      for (const x of [-L.gantry.x, L.gantry.x]) for (const z of [bz - 1.5, bz + 1.5]) TF.colCirc(A[0] + x, A[1] + z, 0.25);
    }

    // ---- the plates: signBoard frames whose text is re-rendered (a canvas texture swapped in) when the policy changes ----
    function drawPlate(k, bin) {
      const t = S.tok, st = STYLE[k], c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'), pt = plateText(bin, k);
      g.fillStyle = t.wood; g.fillRect(0, 0, 512, 160); g.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 8; y < 152; y += 8) g.fillRect(6, y, 500, 1);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 154, 512, 6);
      g.fillStyle = st.css; g.fillRect(14, 22, 84, 116); g.fillStyle = t.dark; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 42px ${t.font}`; g.fillText(pt.num, 56, 54); g.font = `700 46px ${t.font}`; g.fillText(pt.mark, 56, 108);
      g.textAlign = 'left'; g.fillStyle = t.paper; let size = 44; g.font = `700 ${size}px ${t.font}`; while (g.measureText(pt.label).width > 380 && size > 24) { size -= 2; g.font = `700 ${size}px ${t.font}`; }
      g.fillText(pt.label, 116, 52); g.font = `600 22px ${t.font}`; g.fillStyle = st.css;
      wrapLines(pt.legend, 380, (s) => g.measureText(s).width).slice(0, 2).forEach((l, i) => g.fillText(l, 116, 100 + i * 26));
      const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; return tex;
    }
    function applyPlate(k, bin) { const m = S.plates[k].material[4], old = m.map; m.map = m.emissiveMap = drawPlate(k, bin); m.needsUpdate = true; if (old) old.dispose(); S.plateState[k].bin = bin; }
    world.setPlates = (bins) => { if (!bins) return; bins.forEach((b, k) => applyPlate(k, b)); };
    // a flip: each plate turns over (to edge-on, new words, back) in a ripple along the belt; `at` is unused here (the rules time it); delay per plate from plateRipple
    world.flipPlate = (k, bin) => { S.flips.push({ k, bin, t: 0, swapped: false }); };   // one plate turns over now (the rules flip each as the old wave has passed it)
    world.flipPlates = (bins, total) => { plateRipple(total || 0.6).forEach((r) => S.flips.push({ k: r.bin, bin: bins[r.bin], t: -r.delay, swapped: false })); };

    // ---- the crates: a wooden box with a paper tag on top, eight pooled, textures drawn when a crate appears and freed between shifts ----
    function drawTag(slot, crate) {
      const t = S.tok, g = slot.cv.getContext('2d'), W = 256, H = 176;
      g.fillStyle = t.paper; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H);
      g.fillStyle = t.dark; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 19px ${t.font}`;
      const lines = wrapLines(crate.text, 232, (s) => g.measureText(s).width).slice(0, 4); lines.forEach((l, i) => g.fillText(l, 12, 24 + i * 24));
      let x = 12; g.font = `700 14px ${t.font}`;   // the chips: short labels at the foot of the tag
      for (const ch of crate.chips) { const w = g.measureText(ch).width + 14; g.fillStyle = t.dark; g.fillRect(x, H - 40, w, 26); g.fillStyle = t.paper; g.fillText(ch, x + 7, H - 26); x += w + 8; }
      slot.tex.needsUpdate = true;
    }
    function crateMesh(withTag) {
      const g = new THREE.Group(); g.userData.dyn = true;
      const body = new THREE.Mesh(new THREE.BoxGeometry(CRATE.l, CRATE.h, CRATE.w), MAT.wood); body.position.y = CRATE.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      for (const dx of [-0.42, 0, 0.42]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, CRATE.h + 0.03, CRATE.w + 0.03), MAT.darkWood); sl.position.set(dx, CRATE.h / 2, 0); g.add(sl); }
      if (withTag) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 176; const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.86), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); tag.rotation.x = -Math.PI / 2; tag.position.y = CRATE.h + 0.012; tag.receiveShadow = true; g.add(tag);
        g.userData.tag = { cv, tex, tag };
      }
      g.visible = false; scene.add(g); return g;
    }
    function buildPool() {
      for (let i = 0; i < POOL; i++) { const g = crateMesh(true), tg = g.userData.tag; g.traverse((o) => { if (o.isMesh) o.userData.slot = i; }); S.pool.push({ i, g, cv: tg.cv, tex: tg.tex, uid: null }); S.free.push(i); }
      for (let i = 0; i < 3; i++) { const g = crateMesh(false); g.visible = true; S.ambient.push({ g, x: LAYOUT.belt.x0 + 1 + i * 5.6 }); }   // idle: sample crates ride the belt
    }
    const acquire = (c) => { const i = S.free.shift(); if (i == null) return null; const s = S.pool[i]; s.uid = c.c.uid; drawTag(s, c.c); s.g.visible = true; s.g.rotation.set(0, 0, 0); s.g.scale.setScalar(1); return s; };
    function release(c) { if (!c.slot) return; c.slot.g.visible = false; c.slot.uid = null; S.free.push(c.slot.i); c.slot = null; }
    world.loadShift = (shift) => {
      world.clearShift(); S.shift = shift; S.bt = 0; S.rt = 0; S.running = false; S.brake = { used: 0, on: false, empty: false }; S.brakes = []; S.want = false;
      const by = Object.fromEntries(shift.crates.map((c) => [c.uid, c]));
      for (const e of shift.schedule) S.crates.set(e.uid, { e, c: by[e.uid], slot: null, state: 'pending', fx: null, pitted: false });
      S.ambient.forEach((a) => (a.g.visible = false)); world.setPlates(shift.kind === 'finale' ? shift.waves[0].bins : shift.bins);
    };
    world.run = (on) => { S.running = !!on; };
    world.clearShift = () => {   // crates back to the pool, their textures freed until the next shift draws them again
      for (const c of S.crates.values()) release(c);
      for (const s of S.pool) { s.tex.dispose(); s.g.visible = false; }
      for (const st of S.stamps) st.mesh.visible = false; S.stamps.length = 0; S.crates.clear(); S.shift = null; S.held = null; S.sel = null; S.hover = null; S.flips.length = 0; S.running = false;
      S.ambient.forEach((a) => (a.g.visible = S.active ? false : true)); if (S.ui) { S.ui.read.style.display = 'none'; S.ui.ring.visible = false; }
    };

    // ---- selecting, grabbing, routing ----
    const inZone = (c) => c.state === 'belt';
    const zoneCrates = () => [...S.crates.values()].filter(inZone).sort((a, b) => a.e.t0 - b.e.t0).map((c) => ({ uid: c.c.uid, x: E.cratePos(c.e.t0, S.bt), c }));   // oldest (nearest the pit) first
    world.select = (uid) => { const c = S.crates.get(uid); if (uid && (!c || !inZone(c))) return false; S.sel = uid || null; emit('select', { uid: S.sel }); return true; };
    world.visibleCrates = () => zoneCrates().map((z) => ({ uid: z.uid, x: z.x, text: z.c.c.text, chips: z.c.c.chips, full: z.c.c.full, wave: z.c.c.wave, selected: z.uid === S.sel }));
    function route(uid, bin, via) {
      const c = S.crates.get(uid); if (!c || !inZone(c) || bin < 0 || bin > 3 || !world.canRoute(uid, bin)) return false;
      c.state = 'sliding'; c.fx = { t: 0, bin, from: c.slot ? c.slot.g.position.clone() : null }; if (S.held && S.held.uid === uid) S.held = null; if (S.sel === uid) S.sel = null;
      emit('route', { uid, bin, via, t: S.rt, bt: S.bt }); return true;
    }
    world.route = (uid, bin, via) => route(uid, bin, via || 'key');
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(clientX, clientY) {
      const r = TF.renderer.domElement.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); TF.camera.updateMatrixWorld(); raycaster.setFromCamera(ndc, TF.camera);
      return raycaster;
    }
    function crateAt(x, y) {
      const rc = pick(x, y), meshes = []; for (const c of S.crates.values()) if (inZone(c) && c.slot) c.slot.g.traverse((o) => { if (o.isMesh) meshes.push(o); });
      const hit = rc.intersectObjects(meshes, false)[0]; if (!hit) return null;
      const i = hit.object.userData.slot; const s = S.pool[i]; return s && s.uid ? s.uid : null;
    }
    function binAt(x, y) {
      const rc = pick(x, y), hit = rc.intersectObjects(scene.children.filter((o) => o.userData && o.userData.bin != null), false)[0]; if (hit) return hit.object.userData.bin;
      const o = rc.ray.origin, d = rc.ray.direction; if (Math.abs(d.y) < 1e-6) return -1;   // else: the point on the plane just above the bins, inside a bin's footprint
      const k = (1.1 - o.y) / d.y; if (k <= 0) return -1; const px = o.x + d.x * k - S.A[0], pz = o.z + d.z * k - S.A[1];
      return E.binXs.findIndex((bxx) => Math.abs(px - bxx) <= LAYOUT.bin.w / 2 && pz >= LAYOUT.belt.z + 0.7 && pz <= LAYOUT.bin.front + 0.2);
    }
    function onDown(e) {
      if (!S.active || !S.shift) return; S.ptr = { x: e.clientX, y: e.clientY, in: true };
      const uid = crateAt(e.clientX, e.clientY);
      if (uid && world.canGrab(uid)) { S.held = { uid, id: e.pointerId, moved: false, sx: e.clientX, sy: e.clientY, from: S.sel }; world.select(uid); return; }
      const bin = binAt(e.clientX, e.clientY);
      if (bin >= 0 && S.sel) { route(S.sel, bin, 'click'); return; }
      if (!uid) world.select(null);
    }
    function onMove(e) {
      if (!S.active) return; S.ptr = { x: e.clientX, y: e.clientY, in: true };
      if (S.held && !S.held.moved && Math.hypot(e.clientX - S.held.sx, e.clientY - S.held.sy) > 6) { S.held.moved = true; emit('grab', { uid: S.held.uid }); }   // a drag has begun: the crate leaves the belt
    }
    function onUp(e) {
      if (!S.active || !S.held) return;
      const h = S.held; S.held = null; TF.renderer.domElement.style.cursor = 'none'; const c = S.crates.get(h.uid);
      if (!c || !inZone(c)) return;
      if (h.moved) { const bin = binAt(e.clientX, e.clientY); if (bin >= 0 && route(h.uid, bin, 'drag')) { emit('release', { uid: h.uid, bin }); return; } emit('release', { uid: h.uid, bin: -1 }); }   // away from a bin: back on the belt
      // a click without a drag leaves the crate selected (the next click on a bin routes it)
    }

    // ---- stamps, steam, siren, bell ----
    function textSprite(text, color) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'), t = S.tok;
      g.font = `700 54px ${t.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = t.dark; g.lineWidth = 8; g.strokeText(text, 256, 64); g.fillStyle = color; g.fillText(text, 256, 64);
      const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); m.userData.dyn = true; scene.add(m); return m;
    }
    world.stamp = (uid, o = {}) => {
      const c = S.crates.get(uid), bin = o.bin != null ? o.bin : c && c.fx ? c.fx.bin : 0, tone = o.tone || 'ok', col = tone === 'ok' ? STYLE[1].css : tone === 'lax' || tone === 'spill' ? STYLE[3].css : tone === 'strict' ? STYLE[0].css : S.tok.paper;
      if (!o.text) return; const m = textSprite(o.text, col); m.position.copy(bin < 0 ? V((LAYOUT.pit.x0 + LAYOUT.pit.x1) / 2, 1.9, LAYOUT.belt.z + 0.6) : V(E.binXs[bin], 2.9, LAYOUT.bin.front + 0.3)); m.quaternion.copy(TF.camera.quaternion); S.stamps.push({ mesh: m, t: 0, y: m.position.y });
    };
    function puff(p) {
      let n = 0; for (const s of S.steam) { if (s.life > 0 || n >= 4) continue; n++; s.life = 1; s.m.position.set(p.x + (Math.random() - 0.5) * 0.4, p.y, p.z + (Math.random() - 0.5) * 0.4); s.v.set((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3); s.m.visible = true; }
    }
    world.steam = (bin) => { if (bin == null || bin < 0) puff(V((LAYOUT.pit.x0 + LAYOUT.pit.x1) / 2, 0.5, LAYOUT.belt.z)); else puff(V(E.binXs[bin], 1.1, LAYOUT.bin.front)); };
    world.burst = (bin) => {   // a few gold tokens jump out of a bin on a correct route
      const p = V(E.binXs[bin], 1.2, LAYOUT.bin.front - 0.2); let n = 0;
      for (const s of S.sparks) { if (s.life > 0 || n >= 9) continue; n++; s.life = 1; s.m.position.copy(p); s.v.set((Math.random() - 0.5) * 2.2, 1.6 + Math.random() * 1.6, (Math.random() - 0.2) * 1.8); s.m.visible = true; }
    };
    world.siren = (secs) => { S.siren = secs || 1.4; };
    world.bell = () => emit('bell');
    world.cameraShake = (secs, amp) => { if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; S.shake = { t: secs, d: secs, m: amp }; };

    // ---- the room softens while the mill runs, a warm lamp pools over the belt (restored exactly on leaving) ----
    world.light = (on) => {
      if (S.light) S.light.intensity = on ? S.play : S.base;
      if (on && !S.env) { S.env = { sun: TF.sun.intensity, hemi: TF.hemi.intensity }; TF.sun.intensity = S.env.sun * DIM_SUN; TF.hemi.intensity = S.env.hemi * DIM_HEMI; }
      else if (!on && S.env) { TF.sun.intensity = S.env.sun; TF.hemi.intensity = S.env.hemi; S.env = null; }
    };

    // ---- the camera: an elevated three-quarter view along the belt, refitted when the window changes shape ----
    const camNow = () => fitView(TF.camera.aspect || BASE_ASPECT);
    function applyCamera(ms) { const c = camNow(); TF.cameraTo(V(...c.pos), V(...c.look), ms, c.fov); S.aspect = TF.camera.aspect; }
    world.view = () => camNow();
    world.enter = (cb) => {
      if (!S.built || S.active || S.leaving || TF.traveling || TF.talking || TF.locked || TF.zone !== 'archive') return false;
      S.active = true;
      TF.fade(() => {
        TF.lockPlayer(true); TF.hero.g.visible = false; world.light(true); if (S.sparkles) S.sparkles.visible = false; S.ambient.forEach((a) => (a.g.visible = false));
        S.ui.root.style.display = 'block'; TF.renderer.domElement.style.cursor = 'none'; S.aspect = 0; applyCamera(800);
        if (cb) cb();
        emit('enter');
      });
      return true;
    };
    world.leave = (cb) => {
      if (!S.active || S.leaving) return false;
      S.leaving = true;
      TF.fade(() => {
        TF.cameraRestore(0); TF.lockPlayer(false); TF.hero.g.visible = true; world.clearShift(); world.light(false); if (S.sparkles) S.sparkles.visible = true; S.ambient.forEach((a) => (a.g.visible = true));
        S.ui.root.style.display = 'none'; TF.renderer.domElement.style.cursor = ''; S.want = false; S.brake = { used: 0, on: false, empty: false }; S.shake = null;
        S.active = false; S.leaving = false;
        if (cb) cb();
        emit('leave');
      });
      return true;
    };
    world.open = () => world.enter();   // mill-play.js replaces this

    // ---- input ----
    function onKey(e) {
      if (!S.active) return false;
      if (e.code === 'Space') { world.setBrake(true); return true; }
      if (e.code === 'Tab') { if (!e.repeat) { const id = nextSelection(zoneCrates(), S.sel, e.shiftKey ? -1 : 1); if (id) world.select(id); } return true; }
      if (/^Digit[1-4]$/.test(e.code) && !e.repeat) { if (S.sel) route(S.sel, +e.code.slice(5) - 1, 'key'); return true; }
      if (e.code === 'Escape' && !e.repeat) { emit('exit'); if (!listeners.some(([ev]) => ev === 'exit')) world.leave(); return true; }
      return false;
    }
    function onKeyUp(e) { if (e.code === 'Space') world.setBrake(false); }
    world.setBrake = (on) => { S.want = !!on && !!S.shift; };

    // ---- the tick ----
    const tmp = new THREE.Vector3();
    function placeUi() {
      const c = S.hover && S.crates.get(S.hover) || S.sel && S.crates.get(S.sel);
      if (c && c.slot && c.state === 'belt' && !S.held) {
        const k = c.c; S.ui.read.innerHTML = `<span>${esc(k.text)}</span>` + (k.chips.length ? `<div>${k.chips.map((x) => `<i>${esc(x)}</i>`).join('')}</div>` : '');
        tmp.copy(c.slot.g.position); tmp.y += 1.0; tmp.project(TF.camera); const r = TF.renderer.domElement.getBoundingClientRect(), sx = r.left + ((tmp.x + 1) / 2) * r.width, sy = r.top + ((1 - tmp.y) / 2) * r.height;
        S.ui.read.style.display = 'block'; const w = S.ui.read.offsetWidth, h = S.ui.read.offsetHeight; S.ui.read.style.left = Math.max(8, Math.min(r.right - w - 8, sx - w / 2)) + 'px'; S.ui.read.style.top = Math.max(8, sy - h - 6) + 'px';
      } else S.ui.read.style.display = 'none';
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function tickCrates(dt) {
      const L = LAYOUT, y0 = L.belt.top, beltZ = L.belt.z;
      for (const [uid, c] of S.crates) {
        const t0 = c.e.t0, s = S.bt, state = c.state;
        if (state === 'done') continue;
        if (state === 'pending') { if (s >= t0 - EMERGE) { c.slot = acquire(c); if (!c.slot) continue; c.state = 'emerging'; } else continue; }
        const g = c.slot && c.slot.g;
        if (c.state === 'emerging') { const k = Math.min(1, (s - (t0 - EMERGE)) / EMERGE); g.position.copy(V(L.hopper - 0.8 + 0.8 * ease(k), y0, beltZ)); if (s >= t0) c.state = 'belt'; continue; }
        if (c.state === 'belt') {
          if (s >= t0 + RUN.traverse) {   // it reached the end of the zone: into the pit (dropped); a held crate goes too
            c.state = 'pit'; c.fx = { t: 0 }; c.pitted = true; const held = !!(S.held && S.held.uid === uid && S.held.moved); if (S.held && S.held.uid === uid) S.held = null; if (S.sel === uid) S.sel = null; emit('pit', { uid, held, t: S.rt, bt: S.bt }); world.steam(-1); continue;
          }
          const x = E.cratePos(t0, s), held = S.held && S.held.uid === uid;
          if (held && S.held.moved) { const rc = pick(S.ptr.x, S.ptr.y), o = rc.ray.origin, d = rc.ray.direction; if (Math.abs(d.y) > 1e-6) { const k = (1.5 - o.y) / d.y; if (k > 0) g.position.set(o.x + d.x * k, 1.5, o.z + d.z * k); } g.rotation.y += (0.15 - g.rotation.y) * Math.min(1, dt * 8); }
          else { g.position.copy(V(x, y0 + (S.sel === uid ? 0.12 : 0), beltZ)); g.rotation.y *= 0.8; }   // a crate only leaves the belt once a drag begins
          continue;
        }
        if (c.state === 'sliding') {   // a routed crate slides down its chute into the bin
          const f = c.fx; f.t += dt / SLIDE; const k = Math.min(1, f.t), bx = E.binXs[f.bin], a = f.from || V(E.cratePos(t0, s), y0, beltZ);
          if (k < 0.45) { const q = ease(k / 0.45); g.position.lerpVectors(a, V(bx, y0, beltZ + 0.6), q); } else { const q = ease((k - 0.45) / 0.55); g.position.lerpVectors(V(bx, y0, beltZ + 0.6), V(bx, 0.45, 0.35), q); g.scale.setScalar(1 - 0.35 * q); }
          if (k >= 1) { c.state = 'done'; release(c); emit('land', { uid, bin: f.bin }); S.plateState[f.bin].pulse = 1; }
          continue;
        }
        if (c.state === 'pit') { const f = c.fx; f.t += dt / 0.8; const k = Math.min(1, f.t), p = V(L.pit.x0 + 0.3 + 0.9 * k, y0 - 1.1 * k * k, beltZ); g.position.copy(p); g.rotation.z = 0.9 * k; g.scale.setScalar(1 - 0.4 * k); if (k >= 1) { c.state = 'done'; release(c); } }
      }
    }
    world.tick = (t, dt) => {
      if (TF.zone !== 'archive' || !S.built) return;
      if (dt > 0.25) dt = 0.25; const L = LAYOUT;
      if (S.active && TF.camera.aspect !== S.aspect && !S.leaving) applyCamera(S.aspect ? 0 : 800);
      // the belt's own clock: real time `rt` runs while the shift is on; belt time `bt` runs at 1, 0.4 while braked, 0 while stopped
      let belt = 0;
      if (S.active && S.running && S.shift) {
        const r = brakeStep(S.brake, dt, S.want, S.rate); belt = r.belt; S.bt += belt; const t0 = S.rt; S.rt += dt;
        if (r.braked > 0) { const last = S.brakes[S.brakes.length - 1]; if (last && Math.abs(last.t1 - t0) < 1e-9) last.t1 = t0 + r.braked; else S.brakes.push({ t0, t1: t0 + r.braked }); }
        if (r.braked > 0 && !S.brakeWas) emit('brake', { on: true }); if (r.braked === 0 && S.brakeWas) emit('brake', { on: false }); S.brakeWas = r.braked > 0;
        if (S.want && S.brake.empty && !S.emptySaid) { S.emptySaid = true; emit('brakeEmpty'); }
      } else if (!S.active) belt = dt * (S.rate || 1);
      if (S.beltTex) S.beltTex.offset.x -= belt * E.SPEED;   // the pixel texture (one tile a metre) scrolls with the belt
      // ambient crates ride the idle belt and loop
      if (!S.active) for (const a of S.ambient) { a.x += belt * E.SPEED; if (a.x > L.belt.x1 - 0.4) a.x = L.belt.x0 + 0.4; a.g.position.copy(V(a.x, L.belt.top, L.belt.z)); a.g.visible = true; }
      if (S.active && S.shift) {
        tickCrates(dt);
        // what is under the pointer: the nearest crate in the zone
        S.hover = S.ptr.in && !S.held ? crateAt(S.ptr.x, S.ptr.y) : null;
        TF.renderer.domElement.style.cursor = S.held && S.held.moved ? 'grabbing' : S.hover ? 'grab' : 'none';
        S.hotBin = S.held && S.held.moved ? binAt(S.ptr.x, S.ptr.y) : -1;   // the bin a dragged crate would land in lights up
        // the selection ring under the selected crate
        const sc = S.sel && S.crates.get(S.sel); if (sc && sc.slot && sc.state === 'belt') { S.ui.ring.visible = true; S.ui.ring.position.set(sc.slot.g.position.x, L.belt.top + 0.03, sc.slot.g.position.z); S.ui.ring.rotation.z = t * 1.2; } else S.ui.ring.visible = false;
        for (const f of S.flips) { f.t += dt; if (f.t < 0) continue; const p = S.plates[f.k], k = Math.min(1, f.t / 0.4); p.rotation.x = -0.12 + 2 * Math.PI * ease(k); /* a full turn about its length; the words change half way round */ if (k >= 0.5 && !f.swapped) { f.swapped = true; applyPlate(f.k, f.bin); } if (k >= 1) { p.rotation.x = -0.12; f.done = true; } }
        S.flips = S.flips.filter((f) => !f.done);
      }
      for (const ps of S.plateState) { if (ps.pulse > 0) ps.pulse = Math.max(0, ps.pulse - dt * 2); ps.glow.emissiveIntensity = 1.4 + 2.2 * ps.pulse + (S.hotBin === ps.k ? 2.4 : 0); }
      // the gantry trolley creeps, the lamps sway, the siren flashes, steam rises, stamps float up and fade
      if (S.trolley) S.trolley.position.x = S.A[0] + Math.sin(t * 0.22) * 5.4;
      for (const l of S.lamps) l.g.rotation.z = 0.06 * Math.sin(t * 1.3 + l.ph);
      if (S.siren > 0) { S.siren -= dt; S.sirenMat.emissiveIntensity = 0.2 + 3 * (0.5 + 0.5 * Math.sin(t * 18)) * Math.min(1, S.siren); } else S.sirenMat.emissiveIntensity = 0.2;
      S.idleT += dt; if (S.idleT > 2.4) { S.idleT = 0; if (!S.active || Math.random() < 0.5) world.steam(-1); }
      for (const s of S.sparks) if (s.life > 0) { s.life -= dt / 0.8; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, s.life); s.m.rotation.y += dt * 8; if (s.life <= 0) s.m.visible = false; }
      for (const s of S.steam) if (s.life > 0) { s.life -= dt / 1.6; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(0.5 + (1 - s.life) * 1.6); s.m.material.opacity = Math.max(0, 0.45 * s.life); if (s.life <= 0) s.m.visible = false; }
      for (const st of S.stamps) { st.t += dt; st.mesh.position.y = st.y + st.t * 0.5; st.mesh.material.opacity = Math.max(0, 1 - Math.max(0, st.t - 1.2) / 0.8); st.mesh.quaternion.copy(TF.camera.quaternion); if (st.t > 2) { st.mesh.visible = false; st.mesh.material.map.dispose(); st.mesh.material.dispose(); st.mesh.geometry.dispose(); scene.remove(st.mesh); st.gone = true; } }
      S.stamps = S.stamps.filter((st) => !st.gone);
      if (S.active) placeUi();
      if (S.shake) { const k = S.shake; k.t -= dt; const m = k.m * Math.max(0, k.t / k.d); TF.camera.position.x += (Math.random() - 0.5) * m; TF.camera.position.y += (Math.random() - 0.5) * m; if (k.t <= 0) S.shake = null; }
    };

    // ---- the hover caption, the selection ring: built once, styled with the lobby's own tokens ----
    function makeUi() {
      const style = document.createElement('style');
      style.textContent = `
        .mw-ui { position: absolute; inset: 0; pointer-events: none; display: none; font-variant-ligatures: none; }
        .mw-read { position: absolute; display: none; max-width: 360px; padding: 8px 12px 9px; font-size: 19px; line-height: 1.3; transform: none; }
        .mw-read div { margin-top: 5px; display: flex; gap: 6px; flex-wrap: wrap; } .mw-read i { font-style: normal; font-size: 13px; letter-spacing: .06em; padding: 1px 7px; border: 1px solid var(--gold); color: var(--gold); }`;
      document.head.appendChild(style);
      const root = document.createElement('div'); root.className = 'mw-ui'; document.getElementById('ui').appendChild(root); root.innerHTML = '<div class="panel mw-read"></div>';
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: S.tok.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.userData.dyn = true; ring.scale.set(1.0, 1.0, 1.0); scene.add(ring);
      S.ui = { root, read: root.querySelector('.mw-read'), ring };
    }

    // ---- building, at boot ----
    world.build = () => {
      if (S.built) return;
      const a = TF.AREAS.archive; S.A = [a.cx, a.cz]; S.tok = tokens(); makeUi();
      // the placeholder's "Under construction" reader is replaced by the mill (a lobby that no longer builds it has nothing to remove)
      for (let i = TF.INTER.length - 1; i >= 0; i--) if (TF.INTER[i].label === a.name && Math.abs(TF.INTER[i].x - (a.cx + 4.4)) < 0.5 && Math.abs(TF.INTER[i].z - (a.cz + 6.5)) < 0.5) TF.INTER.splice(i, 1);
      build(); buildPool();
      const sg = new THREE.SphereGeometry(0.22, 8, 6); for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: new THREE.Color(S.tok.paper), transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.dyn = true; scene.add(m); S.steam.push({ m, life: 0, v: new THREE.Vector3() }); }
      const gg = new THREE.BoxGeometry(0.09, 0.09, 0.09); for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: MAT.gold.color, transparent: true })); m.visible = false; m.userData.dyn = true; scene.add(m); S.sparks.push({ m, life: 0, v: new THREE.Vector3() }); }
      S.base = 0.9; S.play = 2.1;
      S.light = TF.pointLight('archive', 0xffb347, S.base, 15, a.cx, 3.9, a.cz - 1.2);   // the archive's own amber light stays; this one pools over the belt
      for (let k = 0; k < 4; k++) applyPlate(k, SIDES_PREVIEW[k]);
      if (TF.sparkles) S.sparkles = TF.sparkles(a.cx + LAYOUT.desk.x, a.cz + LAYOUT.desk.z + 1.3, amber(), 18, 0.5, 2.2);   // the twinkle that says "you can play this"
      TF.INTER.push({ x: a.cx + LAYOUT.desk.x, z: a.cz + LAYOUT.desk.z + 1.3, r: 1.6, label: 'Control Desk', verb: 'Start shift', act: () => world.open() });
      S.built = true;
    };
    world.keys = { onKey, onKeyUp, onDown, onMove, onUp };
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.mill = world;
    TF.life.push((t, dt) => world.tick(t, dt));
    TF.on('boot', () => {
      world.build();
      const prev = TF.onKey; TF.onKey = (e) => (world.state.active && world.keys.onKey(e)) || (prev ? prev(e) : false);
      addEventListener('keyup', world.keys.onKeyUp);
      const el = TF.renderer.domElement; el.addEventListener('pointerdown', world.keys.onDown); addEventListener('pointermove', world.keys.onMove); addEventListener('pointerup', world.keys.onUp);
    });
    if (typeof window !== 'undefined') window.millWorld = world;
    return world;
  }
  return { LAYOUT, STYLE, CRATE, POOL, toWorld, fitView, brakeStep, nextSelection, plateRipple, plateText, wrapLines, create, install };
});
