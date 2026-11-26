// Spot Shot — the stall in the world. Browser: window.GalleryWorld. Node: require('./gallery-world.js') (the pure part: the stall-to-world mapping, the camera fit, the reticle, the inspect hold, text wrapping).
//
// A real carnival stall stands on the south lawn, east of the Glass Bridge path and south of the reflecting pool, built from the lobby's own helpers: a wood counter, posts, the cafe's
// striped awning (MAT.awning), string lanterns (MAT.redLantern), a sign in ledSign style, a bell, a ticket window at the end of each lane, three tiered shelves with rails and barriers.
// Its counter faces south, towards the follow camera. Entering fades, hides the hero and eases the camera to a view from behind the counter; leaving restores the follow camera and the
// hero where they stood. Twelve paper cards are pooled and reused; their textures are drawn when a card appears and disposed between rounds.
//
//   install(TF)                registers at the lobby's boot (after mergeStatic, so everything here stays a live object); sets TF.stall = world
//   world.enter(cb) / world.leave(cb)     fade, lock + hide the hero, ease the camera in / restore camera and hero      world.open() = enter (spot-shot play replaces it)
//   world.loadRound(round)     put a round's cards on the schedule (round = a runSpec round); world.run(on) starts / pauses its clock; world.clearRound() disposes the card textures
//   world.t                    the round clock in seconds (the engine's schedule time): every card sits where E.cardPose(entry, t) says
//   world.resolve(uid, action, { stamp, tone, reason })   action 'shot' | 'leaked' | 'delivered': the card flips, shows its stamp and a one-line reason, and goes; tone 'threat' | 'rueful' | 'ok' | 'leak'
//   world.note(uid, text, tone) a note that follows a card (a spared card does not flip, so its reason rides here)     world.marker('good' | 'bad' | 'miss')   a hit marker on the reticle
//   world.showInspect(uid, text) / world.visibleCards()     the verification tag that follows a card; the cards on screen, for the large-text panel
//   world.shoot(nx, ny)        fire the token popper at the reticle position; returns { uid | null }; the event 'shoot' carries the same
//   world.ring() / world.gate(lane, 'ok' | 'leak') / world.cameraShake(secs, amp) / world.light(on)
//   world.canInspect / world.canShoot    () => bool, set by the rules (magnifier charges left; tokens left and a round in play); a refused shot fires nothing and emits 'dry'
//   world.on(evt, fn)          'enter' 'leave' 'shoot' { uid, t, nx, ny } 'land' { uid } 'inspect' { uid } 'pass' { uid } 'exit' (Esc) 'bell'
// Aiming: the mouse moves the reticle; arrow keys move it too (Shift faster); left click or tap or Space shoots; F, right button or a long press (about 0.6 s on a card) inspects.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./gallery-engine.js') : root.GalleryEngine, isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.GalleryWorld = api;
})(this, function (E, CW) {
  const L = E.LAYOUT, STYLE = CW.STYLE;   // the same four colours as the other games: amber, green, cyan, rose
  const HOLD = 0.6, POOL = 12, TOKEN_SECS = 0.3, FLIP_SECS = 0.36, KEEP_SECS = 0.9, ARRIVE_SECS = 0.55, RET_SPEED = 1.1, BASE_ASPECT = 16 / 9, AIM_SLOW = 0.55;   // AIM_SLOW: the ducks' speed while the reticle rests on a card

  // ---------------------------------------------------------------- pure
  // stall-local (x right, y up, z north from the counter) <-> the lobby: x is the world's x, world z = counter z - local z
  const toWorld = (at, p) => [at[0] + p[0], p[1], at[1] - p[2]];
  const fromWorld = (at, p) => [p[0] - at[0], p[1], at[1] - p[2]];
  // the layout camera in the lobby, pulled back along its line of sight when the window is narrower than 16:9 so the rails and the ticket windows still fit
  function fitCam(aspect) {
    const k = Math.max(1, BASE_ASPECT / Math.max(0.4, aspect)), c = L.camera, p = k === 1 ? c.pos.slice() : c.pos.map((v, i) => c.look[i] + (v - c.look[i]) * k);
    return { pos: p, look: c.look.slice(), fov: c.fov };
  }
  // the reticle (ndc -1..1): arrow keys move it, Shift is faster; it never leaves the screen
  function stepReticle(ret, keys, dt) {
    const sp = RET_SPEED * (keys.shift ? 2.2 : 1) * dt, dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    return { nx: Math.max(-1, Math.min(1, ret.nx + dx * sp)), ny: Math.max(-1, Math.min(1, ret.ny + dy * sp)) };
  }
  // the inspect hold: about 0.6 s with the reticle on one card; moving onto another card (or off every card) starts again. { uid, t } -> { uid, t, progress, done }
  function holdStep(h, uid, dt) {
    if (!uid) return { uid: null, t: 0, progress: 0, done: false };
    const t = Math.min(HOLD, (h && h.uid === uid ? h.t : 0) + dt);
    return { uid, t, progress: t / HOLD, done: t >= HOLD };
  }
  // greedy word wrap to a pixel width with any measure function (ctx.measureText in the browser); a single word wider than the line is cut
  function wrapLines(text, maxW, measure) {
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
  const TYPE_LABEL = { email: 'EMAIL', chat: 'CHAT', voice: 'VOICE NOTE', doc: 'DOCUMENT', claim: 'CLAIM', video: 'VIDEO CALL', page: 'WEB PAGE' };
  const cardText = (c) => [TYPE_LABEL[c.type] || String(c.type).toUpperCase(), c.from].concat(c.subject ? [c.subject] : [], [c.body]);   // what a card shows: never what it is
  const ease = (k) => k * k * (3 - 2 * k);

  // ---------------------------------------------------------------- the scene (browser only)
  function create(TF) {
    const { THREE, scene, MAT } = TF;
    const listeners = [], DIM_SUN = 0.7, DIM_HEMI = 0.78;
    const S = {
      built: false, active: false, leaving: false, at: null, rt: 0, running: false, round: null, cards: new Map(), free: [], pool: [], hover: null, ret: { nx: 0, ny: -0.05 }, keys: {},
      hold: { uid: null, t: 0, progress: 0, done: false }, holding: null, spent: false, touch: null, tokens: [], sparks: [], gates: [], lanterns: [], bell: null, popper: null, recoil: 0, light: null, base: 0, play: 0, env: null,
      pace: 1, sparkles: null, shake: null, tags: new Map(), aspect: 0, ui: null, tok: null,
    };
    const world = { state: S, STYLE };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    world.canInspect = () => true;   // the rules say whether a magnifier charge is left
    world.canShoot = () => true;     // ... and whether a token is
    Object.defineProperty(world, 't', { get: () => S.rt });
    const AIM_UP = Math.tan(0.52), AIM_DOWN = Math.tan(0.44);   // the cork rifle's pitch limits (30 and 25 degrees): further and the butt or muzzle would reach the counter
    const W = (p) => toWorld(S.at, p), V = (p) => { const w = W(p); return new THREE.Vector3(w[0], w[1], w[2]); };

    // ---- the colours and the font come from the lobby's own tokens, never from hex written here ----
    function tokens() {
      const cs = getComputedStyle(document.documentElement), v = (k, d) => cs.getPropertyValue(k).trim() || d, hex = (c) => '#' + c.getHexString();
      return { paper: v('--ink', '#f3ead6'), gold: v('--gold', '#d9b46a'), dark: hex(MAT.lanternCap.color), red: hex(MAT.redLantern.color), green: STYLE[1].css, amber: STYLE[0].css, cyan: STYLE[2].css, font: getComputedStyle(document.body).fontFamily || 'monospace' };
    }

    // ---- the spot: free lawn south of the pool, checked against the lobby's own colliders; the walkable apron south of the counter is added to WALK ----
    const SPOTS = [[10.0, 18.2], [10.6, 18.2], [9.4, 18.2], [10.0, 18.6]];
    function findSpot() {
      const free = (x, z) => { for (let dx = -3.5; dx <= 3.5; dx += 0.5) for (let dz = -3.3; dz <= 0.4; dz += 0.5) if (TF.COL.some((c) => (c.r !== undefined ? (x + dx - c.x) ** 2 + (z + dz - c.z) ** 2 < (c.r + 0.1) ** 2 : c.ex !== undefined ? false : x + dx > c.x0 - 0.1 && x + dx < c.x1 + 0.1 && z + dz > c.z0 - 0.1 && z + dz < c.z1 + 0.1))) return false; return true; };
      const spots = (TF.lobbySpots && TF.lobbySpots.stall) || SPOTS;
      for (const [x, z] of spots) if (free(x, z)) return [x, z];
      return spots[0];
    }

    // ---- the stall, in local metres: the counter at z = 0 facing south, the shelves running north behind it ----
    function stall() {
      const [ox, oz] = S.at, bx = (w, h, d, m, x, y, z, o) => TF.box(w, h, d, m, ox + x, y, oz - z, o), mesh = (g, m, x, y, z, o = {}) => { const me = new THREE.Mesh(g, m); me.position.set(ox + x, y, oz - z); me.castShadow = o.cast !== false; me.receiveShadow = true; scene.add(me); return me; };
      bx(6.7, 0.08, 4.1, MAT.wood, 0, 0, 1.45, { cast: false });                                    // the deck
      bx(6.0, 0.98, 0.6, MAT.darkWood, 0, 0.08, 0); bx(6.5, 0.07, 0.95, MAT.wood, 0, 1.0, 0, { s: 0.8 });   // the counter
      bx(6.0, 0.3, 0.04, MAT.awning, 0, 0.5, -0.32);                                               // a striped band along its front
      for (const sx of [-1, 1]) bx(0.1, 2.2, 3.2, MAT.darkWood, sx * 3.15, 0.08, 1.45);             // low side walls
      bx(6.4, 2.8, 0.12, MAT.darkWood, 0, 0.08, 3.1);                                                // the back wall
      for (const sx of [-1, 1]) { bx(0.16, 3.2, 0.16, MAT.wood, sx * 3.2, 0, -0.45); bx(0.16, 3.2, 0.16, MAT.wood, sx * 3.2, 0, 3.1); }   // four posts
      bx(6.8, 0.26, 0.2, MAT.darkWood, 0, 2.95, -0.45);                                              // the header beam
      const aw = mesh(TF.boxGeo(6.9, 0.07, 3.3, 0), MAT.awning, 0, 3.0, 0.85); aw.rotation.x = 0.16;   // the cafe's awning, its front edge lower
      bx(6.9, 0.3, 0.05, MAT.awning, 0, 2.62, -0.8);                                                  // the valance
      // the sign: SPOT SHOT in ledSign style on a dark board above the header
      bx(4.1, 0.78, 0.12, MAT.darkWood, 0, 3.45, -0.5);
      TF.ledSign(['SPOT SHOT'], '#ffe39a', S.at[0], 3.84, S.at[1] + 0.58, 3.8, 0.62);
      // three tiered shelves: a board, a rail and a barrier the popups rise from
      L.lanes.forEach((ln, i) => {
        bx(5.5, 0.06, 0.5, MAT.darkWood, 0, ln.y - 0.4, ln.z);
        bx(5.3, 0.04, 0.04, MAT.metal, 0, ln.y - 0.33, ln.z - 0.04, { cast: false });
        bx(5.3, 0.58, 0.05, MAT.wood, 0, ln.y - 0.93, ln.z - 0.1);
      });
      // a ticket window at the exit end of each lane (even lanes leave right, odd lanes left)
      L.lanes.forEach((ln, i) => {
        const side = i % 2 === 0 ? 1 : -1, x = side * (L.rail / 2 + 0.38), glow = TF.glowStrip(MAT.warmGlow.emissive.getHex()); glow.emissiveIntensity = 0.35;
        bx(0.78, 0.95, 0.16, MAT.darkWood, x, ln.y - 0.47, ln.z - 0.12); bx(0.9, 0.1, 0.3, MAT.gold, x, ln.y + 0.5, ln.z - 0.12);
        bx(0.52, 0.5, 0.03, MAT.lanternCap, x, ln.y - 0.3, ln.z - 0.21, { cast: false });           // the dark window
        const win = mesh(new THREE.BoxGeometry(0.5, 0.07, 0.04), glow, x, ln.y - 0.34, ln.z - 0.22, { cast: false });   // its sill: the part that flashes
        S.gates.push({ lane: i, mat: glow, win, flash: 0, kind: 'ok', base: glow.emissive.clone() });
      });
      // the bell on the counter, and the token popper: a toy of wood and gold that turns to follow the reticle
      const bell = new THREE.Group(); bell.position.set(ox + 2.55, 1.07, oz - 0.12); scene.add(bell);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.gold); dome.position.y = 0.04; dome.castShadow = true; bell.add(dome);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.04, 14), MAT.darkWood); bell.add(base);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), MAT.gold); knob.position.y = 0.2; bell.add(knob); S.bell = { g: bell, dome, t: 0 };
      // a fairground cork rifle: a deep-plum receiver, barrel and magazine tube, a wooden stock and pump, a cork in the muzzle; it sits on a swivel post and turns to follow the reticle.
      // The pivot is up at the trigger and the aim is limited (see AIM_UP / AIM_DOWN in the tick), so neither the butt nor the muzzle ever dips into the counter (top at 1.07).
      const pop = new THREE.Group(); pop.position.set(ox + 1.1, 1.4, oz + 0.3); scene.add(pop);
      const metal = new THREE.MeshStandardMaterial({ color: PAL.plum, roughness: 0.45, metalness: 0.3 }), wood = new THREE.MeshStandardMaterial({ color: PAL.woodDeep, roughness: 0.55 });
      const woodDeep = new THREE.MeshStandardMaterial({ color: PAL.brown, roughness: 0.6 }), cork = new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 0.95 });
      const part = (g, m, x, y, z, rx = 0) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.x = rx; me.castShadow = true; pop.add(me); return me; }, along = Math.PI / 2;
      part(new THREE.BoxGeometry(0.055, 0.085, 0.24), metal, 0, 0, -0.06);                                  // the receiver
      const sp = new THREE.Shape();                                                                          // the stock's side profile, x = -z (it runs back, +z), y up
      sp.moveTo(-0.05, 0.025); sp.lineTo(-0.1, 0.01); sp.quadraticCurveTo(-0.2, 0.012, -0.31, 0.0); sp.lineTo(-0.315, -0.125); sp.quadraticCurveTo(-0.17, -0.07, -0.1, -0.035); sp.lineTo(-0.05, -0.035); sp.closePath();   // slim wrist, flaring to the butt
      const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }); sg.translate(0, 0, -0.0175); sg.rotateY(Math.PI / 2);
      part(sg, wood, 0, 0, 0);                                                                               // the stock
      part(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 14), metal, 0, 0.015, -0.4, along);                // the barrel (pointing north, -z)
      part(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 10), metal, 0, -0.02, -0.36, along);               // the magazine tube under it
      part(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 14), wood, 0, -0.005, -0.46, along);               // the wooden pump
      for (const z of [-0.43, -0.49]) part(new THREE.CylinderGeometry(0.0275, 0.0275, 0.008, 14), woodDeep, 0, -0.005, z, along);   // its grooves
      part(new THREE.CylinderGeometry(0.017, 0.014, 0.03, 12), cork, 0, 0.015, -0.632, along);              // the cork in the muzzle
      part(new THREE.BoxGeometry(0.008, 0.02, 0.012), metal, 0, 0.035, -0.6);                               // the front sight
      part(new THREE.BoxGeometry(0.02, 0.015, 0.01), metal, 0, 0.05, -0.15);                                 // the rear sight
      const tg = new THREE.TorusGeometry(0.022, 0.005, 6, 12, Math.PI); tg.rotateZ(Math.PI); tg.rotateY(Math.PI / 2);
      part(tg, metal, 0, -0.043, 0.02);                                                                      // the trigger guard
      part(new THREE.BoxGeometry(0.006, 0.025, 0.008), metal, 0, -0.05, 0.02);                              // the trigger
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.015, -0.65); pop.add(muzzle);
      mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.28, 12), MAT.metal, 1.1, 1.21, -0.3);                 // the swivel post, counter to trigger
      mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 16), MAT.metal, 1.1, 1.08, -0.3, { cast: false });  // its foot
      // a dish of spare corks beside it
      mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.025, 18), woodDeep, 1.75, 1.083, -0.2, { cast: false });
      const cg1 = new THREE.CylinderGeometry(0.017, 0.014, 0.03, 10);
      [[0, 0, 0], [0.04, 0.01, 1.2], [-0.04, 0.02, 2.1], [0.02, -0.045, 0.4], [-0.03, -0.035, 2.8], [0.05, -0.03, 1.7], [0.01, 0.045, 0.9], [0, 0.005, 0.3, 1]].forEach(([x, z, ry, up]) => {
        const c = mesh(cg1, cork, 1.75 + x, 1.11 + (up ? 0.025 : 0), -0.2 + z, { cast: false }); c.rotation.set(up ? 0 : Math.PI / 2, ry, 0, 'YXZ');   // lying on their sides, one standing
      });
      S.popper = { g: pop, base: pop.position.clone(), muzzle };
      // string lanterns along the header and across the middle, swaying a little
      const lg = new THREE.SphereGeometry(0.1, 8, 6), cg = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
      for (const [z, y, n] of [[-0.55, 3.02, 11], [1.2, 3.1, 9]]) {
        bx(6.7, 0.012, 0.012, MAT.lanternCap, 0, y + 0.03, z, { cast: false });
        for (let i = 0; i < n; i++) {
          const x = -3.1 + (6.2 * i) / (n - 1), sag = 0.12 * Math.sin((Math.PI * i) / (n - 1)), g = new THREE.Group(); g.position.set(ox + x, y - sag - 0.02, oz - z); scene.add(g);
          const b = new THREE.Mesh(lg, MAT.redLantern); b.position.y = -0.13; g.add(b); const cp = new THREE.Mesh(cg, MAT.lanternCap); cp.position.y = -0.03; g.add(cp);
          S.lanterns.push({ g, ph: i * 0.9 + z });
        }
      }
      TF.colBox(ox - 3.35, oz - 3.3, ox + 3.35, oz + 0.5);                                           // the whole stall body
    }

    // ---- the pooled cards: a paper cutout on a stand, a front (the artefact) and a back (the stamp) ----
    function cardCanvas() { const c = document.createElement('canvas'); c.width = 512; c.height = 256; return c; }
    const SX = 512 / 320, SY = 256 / 220;   // the card is drawn in a 320 x 220 space so the text is not stretched
    // a carnival duck cut out of the card (the canvas stays clear outside it): a yellow body, a head and a beak facing the way it travels. The front then gets a sheet of cream paper (the
    // text) behind and the scoring rings on the chest (clear of the text). 320 x 220 units are 1.1 x 0.76 m, so a ring of E.RINGS radius r is r / 0.00344 units wide.
    const DUCK_YELLOW = '#ffd23f', DUCK_EDGE = '#b8741a', M_PER_UNIT = 1.1 / 320;
    function duck(g, dir) {
      g.save(); if (dir < 0) { g.translate(320, 0); g.scale(-1, 1); }
      const body = () => { g.beginPath(); g.ellipse(148, 124, 130, 68, 0, 0, 7); g.moveTo(262 + 40, 52); g.ellipse(262, 52, 40, 40, 0, 0, 7); g.rect(228, 64, 58, 60); g.moveTo(44, 110); g.lineTo(4, 66); g.lineTo(76, 90); g.closePath(); };
      g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = DUCK_EDGE; body(); g.stroke(); g.fillStyle = DUCK_YELLOW; body(); g.fill();
      g.fillStyle = '#ff8a1f'; g.strokeStyle = DUCK_EDGE; g.lineWidth = 4; g.beginPath(); g.ellipse(304, 60, 17, 10, 0, 0, 7); g.fill(); g.stroke();   // the beak
      g.fillStyle = '#fff'; g.beginPath(); g.arc(268, 44, 8, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(271, 44, 4, 0, 7); g.fill();   // the eye
      g.restore();
    }
    // the scoring rings on the chest, where E.LAYOUT.bull says (the hit test measures from the same spot); opaque, outlined, so they read on the yellow
    function target(g, dir) {
      const cx = 160 + dir * L.bull.x / M_PER_UNIT, cy = 110 - L.bull.y / M_PER_UNIT; g.lineWidth = 3; g.strokeStyle = S.tok.dark;
      E.RINGS.slice().reverse().forEach((ring, i) => { g.fillStyle = i % 2 ? S.tok.paper : S.tok.red; g.beginPath(); g.arc(cx, cy, ring.r / M_PER_UNIT, 0, 7); g.fill(); g.stroke(); });
    }
    function drawFront(slot, card, dir) {
      const g = slot.fc.getContext('2d'), T = S.tok; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 512, 256); g.setTransform(SX, 0, 0, SY, 0, 0); duck(g, dir);
      const px = dir > 0 ? 10 : 118;   // opaque cream paper on the side away from the rings, dark text on it
      g.fillStyle = T.paper; g.strokeStyle = T.dark; g.lineWidth = 3; g.beginPath(); g.roundRect(px, 24, 192, 174, 12); g.fill(); g.stroke(); target(g, dir);
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 14px ${T.font}`; g.fillStyle = T.dark; g.fillText(`${cardText(card)[0]} · ${String(card.from).slice(0, 14)}`, px + 10, 42);   // the full card is in the hover popup and the Tab list
      let y = 66; g.font = `700 17px ${T.font}`;
      const lines = wrapLines((card.subject ? card.subject + ': ' : '') + card.body, 172, (s) => g.measureText(s).width), shown = lines.slice(0, 6);
      if (lines.length > shown.length) shown[shown.length - 1] = shown[shown.length - 1].replace(/\s*\S{0,3}$/, '') + '…';
      for (const ln of shown) { g.fillText(ln, px + 10, y); y += 19; }
      slot.ft.needsUpdate = true;
    }
    function drawBack(slot, text, tone, dir, reason) {
      const g = slot.bc.getContext('2d'), T = S.tok, col = tone === 'ok' ? T.green : tone === 'rueful' ? T.amber : T.red;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 512, 256); g.setTransform(-SX, 0, 0, -SY, 512, 256);   // the back is seen after a flip: drawn turned half a circle, it reads upright
      duck(g, dir); g.fillStyle = T.paper; g.strokeStyle = T.dark; g.lineWidth = 3; g.beginPath(); g.roundRect(30, 36, 242, 156, 12); g.fill(); g.stroke();
      if (reason) { g.save(); g.fillStyle = T.dark; g.font = `700 14px ${T.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; const rl = wrapLines(reason, 222, (s) => g.measureText(s).width).slice(0, 2); rl.forEach((s, i) => g.fillText(s, 151, 160 + 18 * i - (rl.length - 1) * 9)); g.restore(); }   // the one-line reason under the stamp
      g.translate(151, reason ? 90 : 119); g.rotate(-0.12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4;
      let size = reason ? 26 : 30; g.font = `700 ${size}px ${T.font}`; const lines = wrapLines(text, 180, (s) => g.measureText(s).width);
      while ((lines.length > 2 || lines.some((s) => g.measureText(s).width > 180)) && size > 14) { size -= 2; g.font = `700 ${size}px ${T.font}`; lines.splice(0, lines.length, ...wrapLines(text, 180, (s) => g.measureText(s).width)); }
      const lh = size * 1.15, w = Math.max(...lines.map((s) => g.measureText(s).width)) + 26, h = lh * lines.length + 20;
      g.globalAlpha = 0.9; g.strokeRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
      lines.forEach((s, i) => g.fillText(s, 0, (i - (lines.length - 1) / 2) * lh)); g.restore();
      slot.bt.needsUpdate = true;
    }
    function buildPool() {
      const geo = new THREE.BoxGeometry(L.cardW, L.cardH, 0.025), edge = new THREE.MeshBasicMaterial({ visible: false });   // only the two faces draw: the duck is cut out of them by alpha
      for (let i = 0; i < POOL; i++) {
        const fc = cardCanvas(), bc = cardCanvas(), ft = new THREE.CanvasTexture(fc), bt = new THREE.CanvasTexture(bc);
        for (const t of [ft, bt]) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
        const fm = new THREE.MeshBasicMaterial({ map: ft, alphaTest: 0.5 }), bm = new THREE.MeshBasicMaterial({ map: bt, alphaTest: 0.5 });   // unlit: the paper stays bright and the text crisp under the dimmed lamp
        const m = new THREE.Mesh(geo, [edge, edge, edge, edge, fm, bm]); m.visible = false; m.receiveShadow = true; m.userData.dyn = true; scene.add(m);
        S.pool.push({ i, m, fc, bc, ft, bt, fm, bm, uid: null }); S.free.push(i);
      }
    }
    const acquire = (uid, card, dir) => { const i = S.free.shift(); if (i == null) return null; const s = S.pool[i]; s.uid = uid; drawFront(s, card, dir); s.m.visible = true; s.m.rotation.set(0, 0, 0); return s; };
    function release(c) { if (!c.slot) return; c.slot.m.visible = false; c.slot.uid = null; S.free.push(c.slot.i); c.slot = null; }
    world.loadRound = (round) => {
      world.clearRound(); S.round = round; S.rt = 0; S.running = false;
      const byUid = Object.fromEntries(round.items.map((it) => [it.uid, it]));
      for (const e of round.schedule) S.cards.set(e.uid, { e, it: byUid[e.uid], slot: null, fx: null, passed: false, gone: false, tag: null });
    };
    world.run = (on) => { S.running = !!on; };
    world.clearRound = () => {   // card meshes back to the pool, their textures freed until the next round draws them again
      for (const c of S.cards.values()) release(c);
      for (const s of S.pool) { s.ft.dispose(); s.bt.dispose(); s.m.visible = false; }
      for (const [, t] of S.tags) t.el.remove(); S.tags.clear();
      for (const t of S.tokens) { t.live = false; t.m.visible = false; t.trail.forEach((d) => (d.visible = false)); }   // the darts are kept: they are built once
      S.cards.clear(); S.round = null; S.hover = null; S.hold = { uid: null, t: 0, progress: 0, done: false };
    };

    // ---- resolving a card: flip it to its stamp (a shot waits for its token to land) ----
    world.resolve = (uid, action, o = {}) => {
      const c = S.cards.get(uid); if (!c || c.fx || c.gone) return false;
      const stamp = o.stamp || '', tone = o.tone || (action === 'delivered' ? 'ok' : action === 'leaked' ? 'leak' : 'threat');
      if (action === 'shot') { c.fx = { kind: 'shot', t: -(c.wait || 0), stamp, tone }; c.frozen = c.slot ? c.slot.m.position.clone() : null; }
      else { c.fx = { kind: action, t: 0, stamp, tone }; if (c.slot && action === 'leaked') drawBack(c.slot, stamp, tone, c.e.dir, o.reason); }
      if (action === 'shot' && c.slot) drawBack(c.slot, stamp, tone, c.e.dir, o.reason);
      return true;
    };
    world.gate = (lane, kind) => { const g = S.gates[lane]; if (!g) return; g.flash = 1; g.kind = kind; };
    world.ring = () => { if (S.bell) S.bell.t = 1; emit('bell'); };
    const calm = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // a soft gold (good call) or red (mistake) wash over the screen, and a short slow-motion beat for a bullseye; both skipped for reduced motion
    world.flash = (kind) => {
      const f = S.ui && S.ui.flash; if (!f || calm()) return;
      f.style.transition = 'none'; f.style.background = `radial-gradient(ellipse at center, transparent 45%, ${kind === 'good' ? 'rgba(255,200,80,.4)' : 'rgba(255,60,60,.42)'})`; f.style.opacity = 1; void f.offsetWidth; f.style.transition = 'opacity .4s'; f.style.opacity = 0;
    };
    world.slowmo = (secs) => { if (!calm()) S.slow = secs; };
    world.cameraShake = (secs, amp) => { if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; S.shake = { t: secs, d: secs, m: amp }; };

    // ---- shooting: a golden token from the popper to what is under the reticle ----
    // a foam dart (cyan body, rose nose: it has to show against the warm wood) with a short fading trail: 6 of them, built once and only ever hidden, never dropped
    function tokenMesh() {
      const body = new THREE.MeshBasicMaterial({ color: STYLE[2].hex }), nose = new THREE.MeshBasicMaterial({ color: STYLE[3].hex }), bg = new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10), ng = new THREE.SphereGeometry(0.075, 10, 8), tg = new THREE.SphereGeometry(0.05, 8, 6);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Group(), b = new THREE.Mesh(bg, body), n = new THREE.Mesh(ng, nose); b.rotation.x = Math.PI / 2; n.position.z = 0.16; m.add(b, n); m.visible = false; m.userData.dyn = true; scene.add(m);
        const trail = [0, 1, 2, 3].map((k) => { const t = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 - 0.11 * k })); t.scale.setScalar(1 - 0.18 * k); t.visible = false; t.userData.dyn = true; scene.add(t); return t; });
        S.tokens.push({ m, trail, t: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), uid: null, live: false });
      }
      const sg = new THREE.BoxGeometry(0.035, 0.035, 0.035), sm = new THREE.MeshBasicMaterial({ color: MAT.gold.color, transparent: true });
      for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, sm.clone()); m.visible = false; m.userData.dyn = true; scene.add(m); S.sparks.push({ m, life: 0, v: new THREE.Vector3() }); }
    }
    const aimV = new THREE.Vector3(), camNow = () => fitCam(TF.camera.aspect || BASE_ASPECT);
    const rayAt = (nx, ny) => E.rayFromNdc(camNow(), TF.camera.aspect || BASE_ASPECT, nx, ny);
    function entriesNow() { const out = []; for (const c of S.cards.values()) if (!c.fx || c.fx.kind !== 'shot') out.push(c.e); return out; }
    function burst(p) {
      let n = 0;
      for (const s of S.sparks) { if (s.life > 0 || n >= 10) continue; n++; s.life = 1; s.m.position.copy(p); s.v.set((Math.random() - 0.5) * 2.4, Math.random() * 1.8 + 0.6, (Math.random() - 0.5) * 2.4); s.m.visible = true; }
    }
    world.shoot = (nx, ny) => {
      if (!S.active || !S.round) return { uid: null };
      if (!world.canShoot()) { emit('dry'); return { uid: null, dry: true }; }
      const ray = rayAt(nx, ny), hit = E.hitTest(entriesNow(), S.rt, ray), tk = S.tokens.find((t) => !t.live);
      const lead = hit && E.cardPose(S.cards.get(hit.uid).e, S.rt + TOKEN_SECS * S.pace);   // the dart lands where the card will be, on the spot that was aimed at
      const L3 = hit ? [lead.state === 'moving' ? lead.x + hit.dx : hit.x, hit.y, L.lanes[S.cards.get(hit.uid).e.lane].z] : (() => { const k = (3.0 - ray.o[2]) / ray.d[2]; return [ray.o[0] + ray.d[0] * k, ray.o[1] + ray.d[1] * k, 3.0]; })();
      if (tk) { tk.live = true; tk.t = 0; tk.dur = TOKEN_SECS; tk.uid = hit ? hit.uid : null; S.popper.g.updateMatrixWorld(true); S.popper.muzzle.getWorldPosition(tk.from); tk.to.copy(V(L3)); tk.m.visible = true; }
      S.recoil = 1;
      if (hit) { const c = S.cards.get(hit.uid); c.wait = TOKEN_SECS; }
      emit('shoot', { uid: hit ? hit.uid : null, t: S.rt, nx, ny, dx: hit ? hit.ox : 0, dy: hit ? hit.oy : 0 });   // measured from the bullseye
      return { uid: hit ? hit.uid : null };
    };

    // ---- inspecting: the tag that follows a card, and the hold at the reticle ----
    world.showInspect = (uid, text) => {
      const c = S.cards.get(uid); if (!c) return;
      let t = S.tags.get(uid); if (!t) { const el = document.createElement('div'); el.className = 'panel gs-tag'; S.ui.tags.appendChild(el); t = { el, off: 0 }; S.tags.set(uid, t); }
      t.el.textContent = text; t.el.style.opacity = 1; t.off = 0;
    };
    world.note = (uid, text, tone) => { world.showInspect(uid, text); const t = S.tags.get(uid); if (t) t.el.dataset.tone = tone || ''; };
    world.marker = (kind) => {
      const r = S.ui && S.ui.ret; if (!r) return;
      S.ui.hm.style.stroke = kind === 'good' ? S.tok.green : kind === 'bad' ? S.tok.red : S.tok.paper; r.classList.remove('hit', 'miss'); void r.offsetWidth; r.classList.add(kind === 'miss' ? 'miss' : 'hit');
    };
    const cardCenterWorld = (c) => { if (c.slot && c.slot.m.visible) return c.slot.m.position; const p = E.cardPose(c.e, S.rt); return p.state === 'pending' || p.state === 'gone' ? null : V([p.x, p.y, p.z]); };
    const project = (v) => { const r = TF.renderer.domElement.getBoundingClientRect(), p = v.clone().project(TF.camera); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]; };
    world.visibleCards = () => {
      const out = []; TF.camera.updateMatrixWorld();
      for (const [uid, c] of S.cards) {
        if (c.gone || (c.fx && c.fx.kind !== 'shot' && c.fx.t > 0.2) || (c.fx && c.fx.kind === 'shot')) continue;
        const p = E.cardPose(c.e, S.rt); if (p.state !== 'moving') continue;
        out.push({ uid, lane: c.e.lane, x: p.x, text: cardText(c.it.card), card: c.it.card, inspected: S.tags.has(uid) });
      }
      return out.sort((a, b) => a.x - b.x);
    };

    // ---- the lights: a warm lamp pools under the awning; the room softens a little while the stall is up (restored exactly on leaving) ----
    world.light = (on) => {
      if (S.light) S.light.intensity = on ? S.play : S.base;
      if (on && !S.env) { S.env = { sun: TF.sun.intensity, hemi: TF.hemi.intensity }; TF.sun.intensity = S.env.sun * DIM_SUN; TF.hemi.intensity = S.env.hemi * DIM_HEMI; }
      else if (!on && S.env) { TF.sun.intensity = S.env.sun; TF.hemi.intensity = S.env.hemi; S.env = null; }
    };

    // ---- the camera: behind the counter, from the layout's own pose, refitted when the window changes shape ----
    function applyCamera(ms) { const c = camNow(); TF.cameraTo(V(c.pos), V(c.look), ms, c.fov); S.aspect = TF.camera.aspect; }
    world.view = () => camNow();
    world.enter = (cb) => {
      if (!S.built || S.active || S.leaving || TF.traveling || TF.talking || TF.locked || TF.zone !== 'lobby') return false;
      S.active = true;
      TF.fade(() => {
        TF.lockPlayer(true); TF.hero.g.visible = false; world.light(true); if (S.sparkles) S.sparkles.visible = false;
        S.ui.root.style.display = 'block'; TF.renderer.domElement.style.cursor = 'none'; S.ret = { nx: 0, ny: -0.05 }; S.aspect = 0; applyCamera(800);
        if (cb) cb();
        emit('enter');
      });
      return true;
    };
    world.leave = (cb) => {
      if (!S.active || S.leaving) return false;
      S.leaving = true;
      TF.fade(() => {
        TF.cameraRestore(0); TF.lockPlayer(false); TF.hero.g.visible = true; world.clearRound(); world.light(false); if (S.sparkles) S.sparkles.visible = true;
        S.ui.root.style.display = 'none'; TF.renderer.domElement.style.cursor = ''; S.keys = {}; S.holding = null; S.shake = null;
        S.active = false; S.leaving = false;
        if (cb) cb();
        emit('leave');
      });
      return true;
    };
    world.open = () => world.enter();   // gallery-play.js replaces this

    // ---- input ----
    const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    function onKey(e) {
      if (!S.active) return false;
      if (KEYS[e.code]) { S.keys[KEYS[e.code]] = true; return true; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { S.keys.shift = true; return false; }
      if (e.code === 'Space') { if (!e.repeat) world.shoot(S.ret.nx, S.ret.ny); return true; }
      if (e.code === 'KeyF') { if (!e.repeat) S.holding = 'key'; return true; }
      if (e.code === 'Escape' && !e.repeat) { emit('exit'); if (!listeners.some(([ev]) => ev === 'exit')) world.leave(); return true; }
      return false;
    }
    function onKeyUp(e) {
      if (KEYS[e.code]) S.keys[KEYS[e.code]] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') S.keys.shift = false;
      if (e.code === 'KeyF' && S.holding === 'key') S.holding = null;
    }
    const ndcOfEvent = (e) => { const r = TF.renderer.domElement.getBoundingClientRect(); return { nx: ((e.clientX - r.left) / r.width) * 2 - 1, ny: -(((e.clientY - r.top) / r.height) * 2 - 1) }; };
    function onDown(e) {
      if (!S.active) return;
      const p = ndcOfEvent(e); S.ret = p;
      if (e.pointerType === 'touch') { S.holding = 'touch'; S.touch = { t: 0, ...p }; return; }
      if (e.button === 2) { S.holding = 'right'; return; }
      if (e.button === 0) world.shoot(p.nx, p.ny);
    }
    function onMove(e) { if (S.active) { const p = ndcOfEvent(e); S.ret = p; if (S.touch) S.touch.moved = true; } }
    function onUp(e) {
      if (!S.active) return;
      if (e.pointerType === 'touch') { const t = S.touch; S.holding = null; S.touch = null; if (t && t.t < HOLD && !t.inspected) { const p = ndcOfEvent(e); S.ret = p; world.shoot(p.nx, p.ny); } return; }
      if (e.button === 2 && S.holding === 'right') S.holding = null;
    }

    // ---- the tick ----
    function placeUi() {
      const r = TF.renderer.domElement.getBoundingClientRect(), x = r.left + ((S.ret.nx + 1) / 2) * r.width, y = r.top + ((1 - S.ret.ny) / 2) * r.height;
      S.ui.ret.style.transform = `translate(${x}px, ${y}px)`; S.ui.ring.style.strokeDashoffset = String(100 - 100 * S.hold.progress); S.ui.ret.classList.toggle('on', !!S.hover); S.ui.ret.classList.toggle('hold', S.hold.progress > 0);
      const hov = S.hover && S.cards.get(S.hover);
      if (hov && !(hov.fx && hov.fx.kind === 'shot')) {
        const lines = cardText(hov.it.card); S.ui.read.innerHTML = `<b>${esc(lines[0])} · ${esc(lines[1])}</b>` + (hov.it.card.subject ? `<i>${esc(hov.it.card.subject)}</i>` : '') + `<span>${esc(hov.it.card.body)}</span>`;
        S.ui.read.style.display = 'block'; const w = S.ui.read.offsetWidth; S.ui.read.style.left = Math.max(8, Math.min(r.right - w - 8, x + 28)) + 'px'; const above = y - S.ui.read.offsetHeight - 22; S.ui.read.style.top = (above < 112 ? y + 32 : above) + 'px';   // below the reticle when above would run under the round strip
      } else S.ui.read.style.display = 'none';
      for (const [uid, t] of S.tags) {
        const c = S.cards.get(uid), at = c && cardCenterWorld(c);
        if (!at) { t.off += 1 / 60; if (t.off > 1.2) { t.el.remove(); S.tags.delete(uid); } else t.el.style.opacity = Math.max(0, 1 - Math.max(0, t.off - 0.5) / 0.7); continue; }
        const [sx, sy] = project(at.clone().add(new THREE.Vector3(0, 0.46, 0))); t.el.style.left = sx + 'px'; t.el.style.top = sy + 'px';
      }
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    world.tick = (t, dt) => {
      if (!S.active) return;
      if (dt > 0.25) dt = 0.25;
      if (S.slow > 0) { S.slow -= dt; dt *= 0.35; }
      if (TF.camera.aspect !== S.aspect && !S.leaving) { applyCamera(S.aspect ? 0 : 800); }   // a resized window refits the view
      S.ret = stepReticle(S.ret, S.keys, dt);
      TF.camera.updateMatrixWorld();
      S.pace += ((S.hover ? AIM_SLOW : 1) - S.pace) * Math.min(1, dt * 8);   // the ducks ease down while the reticle rests on a card, and back up when it leaves
      if (S.running && S.round) S.rt += dt * S.pace;
      // cards: placed where the engine's schedule says; a card that reaches the gate is reported once, then slides in behind the ticket window
      let hovered = null;
      for (const [uid, c] of S.cards) {
        if (c.gone) continue;
        const p = E.cardPose(c.e, S.rt), fx = c.fx;
        if (p.state === 'pending') continue;
        if (!c.slot) { if (p.state === 'gone' && !fx) { if (!c.passed) { c.passed = true; emit('pass', { uid }); } c.gone = true; continue; } c.slot = acquire(uid, c.it.card, c.e.dir); if (!c.slot) continue; }
        const m = c.slot.m;
        if (fx && fx.kind === 'shot') {
          fx.t += dt; if (!c.frozen) c.frozen = m.position.clone();
          if (fx.t < 0) { if (p.state === 'moving') { m.position.copy(V([p.x, p.y, p.z])); c.frozen = m.position.clone(); } continue; }   // the token is still on its way: the card keeps sliding
          const k = Math.min(1, fx.t / FLIP_SECS); m.position.copy(c.frozen); m.position.y += 0.1 * Math.sin(Math.PI * k); m.rotation.x = Math.PI * ease(k);
          if (fx.t > FLIP_SECS + KEEP_SECS) { const d = Math.min(1, (fx.t - FLIP_SECS - KEEP_SECS) / 0.3); m.position.y = c.frozen.y - 0.7 * d * d; if (d >= 1) { c.gone = true; release(c); } }
          continue;
        }
        if (p.state === 'gone') {   // reached the end of the lane
          if (!c.passed) { c.passed = true; emit('pass', { uid }); }
          const a = S.rt - (c.e.spawnTime + c.e.rise + c.e.dur), ext = c.e.speed * a, x = (c.e.dir > 0 ? 1 : -1) * (L.rail / 2) * (2 * Math.min(1, 1 + ext) - 1);
          m.position.copy(V([x, L.lanes[c.e.lane].y, L.lanes[c.e.lane].z]));
          if (fx && fx.kind === 'leaked') m.rotation.x = Math.PI * ease(Math.min(1, a / 0.25));
          if (a > ARRIVE_SECS) { c.gone = true; release(c); }
          continue;
        }
        m.position.copy(V([p.x, p.y, p.z]));
      }
      // what is under the reticle: the nearest card; the inspect hold fills while it stays on one card
      S.hover = S.round && S.active ? (E.hitTest(entriesNow(), S.rt, rayAt(S.ret.nx, S.ret.ny)) || {}).uid || null : null;
      if (!S.holding) S.spent = false;   // one inspection per press: after it completes the key or button must be let go before the next
      if (S.holding === 'touch' && S.touch) S.touch.t += dt;
      S.hold = holdStep(S.hold, S.holding && !S.spent && S.hover && world.canInspect() ? S.hover : null, dt);
      if (S.hold.done) { const uid = S.hold.uid; S.hold = { uid: null, t: 0, progress: 0, done: false }; S.spent = true; if (S.touch) S.touch.inspected = true; emit('inspect', { uid }); }
      // tokens in flight, sparks, the popper's turn and recoil, the bell, the gates, the lanterns
      for (const k of S.tokens) if (k.live) {
        k.t += dt / k.dur; const q = Math.min(1, k.t), at = (u, out) => out.lerpVectors(k.from, k.to, u).setY(out.y + 0.15 * Math.sin(Math.PI * u));
        at(q, k.m.position); k.m.lookAt(at(Math.min(1, q + 0.05), aimV));   // nose along the flight path
        k.trail.forEach((d, i) => { d.visible = q > 0.04 * (i + 1); at(Math.max(0, q - 0.07 * (i + 1)), d.position); });
        if (q >= 1) { k.live = false; k.m.visible = false; k.trail.forEach((d) => (d.visible = false)); burst(k.to); emit('land', { uid: k.uid }); }
      }
      for (const s of S.sparks) if (s.life > 0) { s.life -= dt / 0.7; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, s.life); if (s.life <= 0) s.m.visible = false; }
      const rr = rayAt(S.ret.nx, S.ret.ny), kk = (2.2 - rr.o[2]) / rr.d[2], aim = V([rr.o[0] + rr.d[0] * kk, rr.o[1] + rr.d[1] * kk, 2.2]), pg = S.popper.g;
      { const b = S.popper.base, h = Math.hypot(aim.x - b.x, aim.z - b.z); aim.y = Math.min(b.y + h * AIM_UP, Math.max(b.y - h * AIM_DOWN, aim.y)); }   // keep the rifle clear of the counter
      pg.lookAt(aim.x, aim.y, aim.z); pg.rotateY(Math.PI);   // the barrel points along local -z once turned; lookAt turns +z to the target
      S.recoil = Math.max(0, S.recoil - dt * 7); pg.position.copy(S.popper.base); pg.translateZ(0.06 * S.recoil);
      if (S.bell && S.bell.t > 0) { S.bell.t = Math.max(0, S.bell.t - dt * 1.6); S.bell.dome.rotation.z = 0.35 * Math.sin(S.bell.t * 26) * S.bell.t; }
      for (const g of S.gates) if (g.flash > 0) { g.flash = Math.max(0, g.flash - dt * 1.4); const col = g.kind === 'leak' ? MAT.redLantern.color : new THREE.Color(STYLE[1].hex); g.mat.emissive.copy(g.base).lerp(col, g.flash); g.mat.emissiveIntensity = 0.35 + 1.6 * g.flash; }
      for (const l of S.lanterns) l.g.rotation.z = 0.05 * Math.sin(t * 1.3 + l.ph);
      placeUi();
      if (S.shake) { const k = S.shake; k.t -= dt; const m = k.m * Math.max(0, k.t / k.d); TF.camera.position.x += (Math.random() - 0.5) * m; TF.camera.position.y += (Math.random() - 0.5) * m; if (k.t <= 0) S.shake = null; }
    };

    // ---- the reticle, the hover caption, the inspect tags: built once, styled with the lobby's own tokens ----
    function makeUi() {
      const style = document.createElement('style');
      style.textContent = `
        .gs-ui { position: absolute; inset: 0; pointer-events: none; display: none; font-variant-ligatures: none; }
        .gs-ret { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; }
        .gs-ret svg { width: 100%; height: 100%; overflow: visible; }
        .gs-ret circle { fill: none; stroke: var(--gold); stroke-width: 2; }
        .gs-ret .dot { fill: var(--gold); stroke: none; }
        .gs-ret .ring { stroke: var(--ink); stroke-width: 4; stroke-dasharray: 100; transform: rotate(-90deg); transform-origin: 50% 50%; opacity: 0; }
        .gs-ret svg { transition: transform .12s; } .gs-ret.on svg { transform: scale(1.25); } .gs-ret.on circle:not(.ring) { stroke: var(--gs-on); stroke-width: 3.5; } .gs-ret.on .dot { fill: var(--gs-on); } .gs-ret.hold .ring { opacity: 1; }   /* over a card: bigger and cyan, not just a shade lighter */
        .gs-ret .hm { fill: none; stroke-width: 3; stroke-linecap: round; opacity: 0; transform-box: fill-box; transform-origin: center; } .gs-ret.hit .hm { animation: gs-hm .4s ease-out; } .gs-ret.miss circle:not(.ring) { animation: gs-miss .3s ease-out; }
        @keyframes gs-hm { 0% { opacity: 1; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.6); } } @keyframes gs-miss { 50% { stroke-opacity: .25; } }
        html body .gs-ui .gs-read { --dk: #2b1d14; z-index: 6; position: absolute; display: none; max-width: 440px; padding: 12px 16px 13px; font-size: 26px; line-height: 1.35; color: var(--dk); background: var(--ink); border: 3px solid var(--dk); border-radius: 10px; outline: none; box-shadow: 0 6px 18px rgba(0,0,0,.45); }   /* the caption is the real reading surface: opaque cream paper, dark type, big (the storybook skin's .panel rule is why this selector is long) */
        .gs-flash { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
        html body .gs-ui .gs-read b { display: block; font-size: 15px; letter-spacing: .1em; color: #8a5a14; margin-bottom: 4px; }
        .gs-read i { display: block; font-style: normal; font-weight: 700; } .gs-read span { display: block; }
        .gs-tag[data-tone="ok"] { border-left-color: var(--gs-on); }
        .gs-tag { position: absolute; transform: translate(-50%, -100%); max-width: 300px; padding: 4px 10px 5px; font-size: 17px; line-height: 1.3; border-left: 4px solid var(--gold); background: rgba(14, 16, 26, .9); }`;
      document.head.appendChild(style);
      const root = document.createElement('div'); root.className = 'gs-ui'; document.getElementById('ui').appendChild(root);
      root.innerHTML = '<div class="gs-ret"><svg viewBox="-22 -22 44 44"><path class="hm" d="M-17 -17L-9 -9M17 -17L9 -9M-17 17L-9 9M17 17L9 9"/><circle r="14"/><circle class="dot" r="2.2"/><circle class="ring" r="18" pathLength="100"/></svg></div><div class="panel gs-read"></div><div class="gs-tags"></div><div class="gs-flash"></div>';
      root.style.setProperty('--gs-on', S.tok.cyan);
      S.ui = { hm: root.querySelector('.hm'), flash: root.querySelector('.gs-flash'), root, ret: root.querySelector('.gs-ret'), ring: root.querySelector('.ring'), read: root.querySelector('.gs-read'), tags: root.querySelector('.gs-tags') };
    }

    // ---- building, at boot ----
    world.build = () => {
      if (S.built) return;
      S.tok = tokens(); S.at = findSpot(); makeUi(); stall(); buildPool(); tokenMesh();
      S.base = 0.05; S.play = 2.2;
      S.light = TF.pointLight('lobby', 0xffd9a0, S.base, 9, S.at[0], 2.6, S.at[1] - 0.4);   // always a little on, so the number of lights never changes at run time
      TF.WALK.push([S.at[0] - 6.6, S.at[1], S.at[0] + 6.8, S.at[1] + 3.6]);                  // the apron south of the counter, joined to the lawn's walkable edge
      if (TF.sparkles) S.sparkles = TF.sparkles(S.at[0], S.at[1] + 1.0, 0xffd27a, 18, 0.5, 2.2);   // the twinkle that says "you can play this"
      TF.INTER.push({ x: S.at[0], z: S.at[1] + 1.15, r: 1.7, label: 'Spot Shot', verb: 'Play', act: () => world.open() });
      // the signpost on the path towards it, east of the Glass Bridge path; a lobby that places the stall itself does without it
      if (!(TF.lobbySpots && TF.lobbySpots.stall)) {
        const sx = 3.95, sz = S.at[1] - 1.0;
        TF.ledSign(['Spot Shot ▶'], '#ffe39a', sx, 1.75, sz, 1.7, 0.45);
        TF.box(0.1, 1.5, 0.1, MAT.metal, sx - 0.7, 0, sz - 0.06); TF.box(0.1, 1.5, 0.1, MAT.metal, sx + 0.7, 0, sz - 0.06); TF.colBox(sx - 0.85, sz - 0.2, sx + 0.85, sz + 0.1);
      }
      S.built = true;
    };
    world.keys = { onKey, onKeyUp, onDown, onMove, onUp };
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.stall = world;
    TF.life.push((t, dt) => world.tick(t, dt));
    TF.on('boot', () => {
      world.build();
      const prev = TF.onKey; TF.onKey = (e) => (world.state.active && world.keys.onKey(e)) || (prev ? prev(e) : false);
      addEventListener('keyup', world.keys.onKeyUp);
      const el = TF.renderer.domElement; el.addEventListener('pointerdown', world.keys.onDown); el.addEventListener('pointermove', world.keys.onMove); el.addEventListener('pointerup', world.keys.onUp); el.addEventListener('contextmenu', (e) => { if (world.state.active) e.preventDefault(); });
    });
    if (typeof window !== 'undefined') window.galleryWorld = world;
    return world;
  }
  return { LAYOUT: L, STYLE, HOLD, POOL, toWorld, fromWorld, fitCam, stepReticle, holdStep, wrapLines, cardText, TYPE_LABEL, create, install };
});
