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
//   world.resolve(uid, action, { stamp, tone })   action 'shot' | 'leaked' | 'delivered': the card flips, shows its stamp and goes; tone 'threat' | 'rueful' | 'ok' | 'leak'
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
  const HOLD = 0.6, POOL = 12, TOKEN_SECS = 0.16, FLIP_SECS = 0.36, KEEP_SECS = 0.9, ARRIVE_SECS = 0.55, RET_SPEED = 1.1, BASE_ASPECT = 16 / 9;

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
      sparkles: null, shake: null, tags: new Map(), aspect: 0, ui: null, tok: null,
    };
    const world = { state: S, STYLE };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    world.canInspect = () => true;   // the rules say whether a magnifier charge is left
    world.canShoot = () => true;     // ... and whether a token is
    Object.defineProperty(world, 't', { get: () => S.rt });
    const W = (p) => toWorld(S.at, p), V = (p) => { const w = W(p); return new THREE.Vector3(w[0], w[1], w[2]); };

    // ---- the colours and the font come from the lobby's own tokens, never from hex written here ----
    function tokens() {
      const cs = getComputedStyle(document.documentElement), v = (k, d) => cs.getPropertyValue(k).trim() || d, hex = (c) => '#' + c.getHexString();
      return { paper: v('--ink', '#f3ead6'), gold: v('--gold', '#d9b46a'), dark: hex(MAT.lanternCap.color), red: hex(MAT.redLantern.color), green: STYLE[1].css, amber: STYLE[0].css, font: getComputedStyle(document.body).fontFamily || 'monospace' };
    }

    // ---- the spot: free lawn south of the pool, checked against the lobby's own colliders; the walkable apron south of the counter is added to WALK ----
    const SPOTS = [[10.0, 18.2], [10.6, 18.2], [9.4, 18.2], [10.0, 18.6]];
    function findSpot() {
      const free = (x, z) => { for (let dx = -3.5; dx <= 3.5; dx += 0.5) for (let dz = -3.3; dz <= 0.4; dz += 0.5) if (TF.COL.some((c) => (c.r !== undefined ? (x + dx - c.x) ** 2 + (z + dz - c.z) ** 2 < (c.r + 0.1) ** 2 : c.ex !== undefined ? false : x + dx > c.x0 - 0.1 && x + dx < c.x1 + 0.1 && z + dz > c.z0 - 0.1 && z + dz < c.z1 + 0.1))) return false; return true; };
      for (const [x, z] of SPOTS) if (free(x, z)) return [x, z];
      return SPOTS[0];
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
      const pop = new THREE.Group(); pop.position.set(ox + 1.1, 1.2, oz + 0.3); pop.scale.setScalar(1.0); scene.add(pop);   // on the counter's near edge, below the lanes' cards
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.46, 10), MAT.gold); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.23; barrel.castShadow = true; pop.add(barrel);   // pointing north (-z)
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.06, 10), MAT.gold); muzzle.rotation.x = Math.PI / 2; muzzle.position.z = -0.47; pop.add(muzzle);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.11), MAT.wood); grip.position.set(0, -0.11, 0.04); grip.rotation.x = 0.25; grip.castShadow = true; pop.add(grip);
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.14, 10, 1, true), MAT.gold); hopper.position.set(0, 0.11, -0.06); pop.add(hopper);   // a funnel the tokens drop through
      const loaded = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), MAT.gold); loaded.rotation.x = 1.2; loaded.position.set(0, 0.2, -0.06); pop.add(loaded);
      S.popper = { g: pop, base: pop.position.clone() };
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
    function paper(g, w, h) { g.fillStyle = S.tok.paper; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); }
    function drawFront(slot, card) {
      const g = slot.fc.getContext('2d'), T = S.tok; g.setTransform(SX, 0, 0, SY, 0, 0); paper(g, 320, 220);
      g.fillStyle = T.dark; g.fillRect(6, 6, 308, 30);                                           // the header band: kind of artefact and who it is from
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 16px ${T.font}`; g.fillStyle = T.gold; g.fillText(cardText(card)[0], 14, 21);
      g.textAlign = 'right'; g.font = `600 15px ${T.font}`; g.fillStyle = T.paper; g.fillText(String(card.from).slice(0, 26), 308, 21);
      let y = 56; g.textAlign = 'left'; g.fillStyle = T.dark;
      if (card.subject) { g.font = `700 17px ${T.font}`; for (const ln of wrapLines(card.subject, 296, (s) => g.measureText(s).width).slice(0, 1)) { g.fillText(ln, 14, y); y += 22; } }
      g.font = `600 17px ${T.font}`;
      for (const ln of wrapLines(card.body, 296, (s) => g.measureText(s).width).slice(0, card.subject ? 6 : 7)) { g.fillText(ln, 14, y); y += 22; }
      slot.ft.needsUpdate = true;
    }
    function drawBack(slot, text, tone) {
      const g = slot.bc.getContext('2d'), T = S.tok, col = tone === 'ok' ? T.green : tone === 'rueful' ? T.amber : T.red;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 512, 256); g.setTransform(-SX, 0, 0, -SY, 512, 256);   // the back is seen after a flip: drawn turned half a circle, it reads upright
      paper(g, 320, 220); g.save(); g.translate(160, 110); g.rotate(-0.12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 5;
      let size = 36; g.font = `700 ${size}px ${T.font}`; const lines = wrapLines(text, 250, (s) => g.measureText(s).width);
      while ((lines.length > 2 || lines.some((s) => g.measureText(s).width > 250)) && size > 18) { size -= 3; g.font = `700 ${size}px ${T.font}`; lines.splice(0, lines.length, ...wrapLines(text, 250, (s) => g.measureText(s).width)); }
      const lh = size * 1.15, w = Math.max(...lines.map((s) => g.measureText(s).width)) + 26, h = lh * lines.length + 20;
      g.globalAlpha = 0.9; g.strokeRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
      lines.forEach((s, i) => g.fillText(s, 0, (i - (lines.length - 1) / 2) * lh)); g.restore();
      slot.bt.needsUpdate = true;
    }
    function buildPool() {
      const geo = new THREE.BoxGeometry(L.cardW, L.cardH, 0.025), edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.tok.paper).multiplyScalar(0.8), roughness: 0.95 });
      for (let i = 0; i < POOL; i++) {
        const fc = cardCanvas(), bc = cardCanvas(), ft = new THREE.CanvasTexture(fc), bt = new THREE.CanvasTexture(bc);
        for (const t of [ft, bt]) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
        const fm = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }), bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9 });
        const m = new THREE.Mesh(geo, [edge, edge, edge, edge, fm, bm]); m.visible = false; m.receiveShadow = true; m.userData.dyn = true; scene.add(m);
        S.pool.push({ i, m, fc, bc, ft, bt, fm, bm, uid: null }); S.free.push(i);
      }
    }
    const acquire = (uid, card) => { const i = S.free.shift(); if (i == null) return null; const s = S.pool[i]; s.uid = uid; drawFront(s, card); s.m.visible = true; s.m.rotation.set(0, 0, 0); return s; };
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
      for (const t of S.tokens) t.m.visible = false; S.tokens.length = 0;
      S.cards.clear(); S.round = null; S.hover = null; S.hold = { uid: null, t: 0, progress: 0, done: false };
    };

    // ---- resolving a card: flip it to its stamp (a shot waits for its token to land) ----
    world.resolve = (uid, action, o = {}) => {
      const c = S.cards.get(uid); if (!c || c.fx || c.gone) return false;
      const stamp = o.stamp || '', tone = o.tone || (action === 'delivered' ? 'ok' : action === 'leaked' ? 'leak' : 'threat');
      if (action === 'shot') { c.fx = { kind: 'shot', t: -(c.wait || 0), stamp, tone }; c.frozen = c.slot ? c.slot.m.position.clone() : null; }
      else { c.fx = { kind: action, t: 0, stamp, tone }; if (c.slot && action === 'leaked') drawBack(c.slot, stamp, tone); }
      if (action === 'shot' && c.slot) drawBack(c.slot, stamp, tone);
      return true;
    };
    world.gate = (lane, kind) => { const g = S.gates[lane]; if (!g) return; g.flash = 1; g.kind = kind; };
    world.ring = () => { if (S.bell) S.bell.t = 1; emit('bell'); };
    world.cameraShake = (secs, amp) => { if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; S.shake = { t: secs, d: secs, m: amp }; };

    // ---- shooting: a golden token from the popper to what is under the reticle ----
    function tokenMesh() {
      const face = new THREE.MeshStandardMaterial({ map: TF.TX.coin, emissive: 0xffffff, emissiveMap: TF.TX.coin, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.3 }), geo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo, [MAT.gold, face, face]); m.rotation.x = Math.PI / 2; m.visible = false; m.userData.dyn = true; scene.add(m); S.tokens.push({ m, t: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), uid: null, live: false }); }
      const sg = new THREE.BoxGeometry(0.035, 0.035, 0.035), sm = new THREE.MeshBasicMaterial({ color: MAT.gold.color, transparent: true });
      for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, sm.clone()); m.visible = false; m.userData.dyn = true; scene.add(m); S.sparks.push({ m, life: 0, v: new THREE.Vector3() }); }
    }
    const camNow = () => fitCam(TF.camera.aspect || BASE_ASPECT);
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
      const L3 = hit ? [hit.x, hit.y, L.lanes[S.cards.get(hit.uid).e.lane].z] : (() => { const k = (3.0 - ray.o[2]) / ray.d[2]; return [ray.o[0] + ray.d[0] * k, ray.o[1] + ray.d[1] * k, 3.0]; })();
      if (tk) { tk.live = true; tk.t = 0; tk.dur = TOKEN_SECS; tk.uid = hit ? hit.uid : null; tk.from.copy(S.popper.g.position).add(new THREE.Vector3(0, 0, -0.6)); tk.to.copy(V(L3)); tk.m.visible = true; }
      S.recoil = 1;
      if (hit) { const c = S.cards.get(hit.uid); c.wait = TOKEN_SECS; }
      emit('shoot', { uid: hit ? hit.uid : null, t: S.rt, nx, ny });
      return { uid: hit ? hit.uid : null };
    };

    // ---- inspecting: the tag that follows a card, and the hold at the reticle ----
    world.showInspect = (uid, text) => {
      const c = S.cards.get(uid); if (!c) return;
      let t = S.tags.get(uid); if (!t) { const el = document.createElement('div'); el.className = 'panel gs-tag'; S.ui.tags.appendChild(el); t = { el, off: 0 }; S.tags.set(uid, t); }
      t.el.textContent = text; t.el.style.opacity = 1; t.off = 0;
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
        S.ui.read.style.display = 'block'; const w = S.ui.read.offsetWidth; S.ui.read.style.left = Math.max(8, Math.min(r.right - w - 8, x + 28)) + 'px'; S.ui.read.style.top = Math.max(8, y - S.ui.read.offsetHeight - 22) + 'px';
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
      if (TF.camera.aspect !== S.aspect && !S.leaving) { applyCamera(S.aspect ? 0 : 800); }   // a resized window refits the view
      S.ret = stepReticle(S.ret, S.keys, dt);
      TF.camera.updateMatrixWorld();
      if (S.running && S.round) S.rt += dt;
      // cards: placed where the engine's schedule says; a card that reaches the gate is reported once, then slides in behind the ticket window
      let hovered = null;
      for (const [uid, c] of S.cards) {
        if (c.gone) continue;
        const p = E.cardPose(c.e, S.rt), fx = c.fx;
        if (p.state === 'pending') continue;
        if (!c.slot) { if (p.state === 'gone' && !fx) { if (!c.passed) { c.passed = true; emit('pass', { uid }); } c.gone = true; continue; } c.slot = acquire(uid, c.it.card); if (!c.slot) continue; }
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
        k.t += dt / k.dur; const q = Math.min(1, k.t); k.m.position.lerpVectors(k.from, k.to, q); k.m.position.y += 0.08 * Math.sin(Math.PI * q); k.m.rotation.z += dt * 24;
        if (q >= 1) { k.live = false; k.m.visible = false; burst(k.to); emit('land', { uid: k.uid }); }
      }
      for (const s of S.sparks) if (s.life > 0) { s.life -= dt / 0.7; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, s.life); if (s.life <= 0) s.m.visible = false; }
      const rr = rayAt(S.ret.nx, S.ret.ny), kk = (2.2 - rr.o[2]) / rr.d[2], aim = V([rr.o[0] + rr.d[0] * kk, rr.o[1] + rr.d[1] * kk, 2.2]), pg = S.popper.g;
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
        .gs-ret.on circle:not(.ring) { stroke: var(--ink); } .gs-ret.hold .ring { opacity: 1; }
        .gs-read { position: absolute; display: none; max-width: 330px; padding: 8px 12px 9px; font-size: 16px; line-height: 1.3; }
        .gs-read b { display: block; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .1em; color: var(--gold); margin-bottom: 3px; }
        .gs-read i { display: block; font-style: normal; font-weight: 700; } .gs-read span { display: block; }
        .gs-tag { position: absolute; transform: translate(-50%, -100%); max-width: 300px; padding: 4px 10px 5px; font-size: 15px; line-height: 1.25; border-left: 4px solid var(--gold); background: rgba(14, 16, 26, .9); }`;
      document.head.appendChild(style);
      const root = document.createElement('div'); root.className = 'gs-ui'; document.getElementById('ui').appendChild(root);
      root.innerHTML = '<div class="gs-ret"><svg viewBox="-22 -22 44 44"><circle r="14"/><circle class="dot" r="2.2"/><circle class="ring" r="18" pathLength="100"/></svg></div><div class="panel gs-read"></div><div class="gs-tags"></div>';
      S.ui = { root, ret: root.querySelector('.gs-ret'), ring: root.querySelector('.ring'), read: root.querySelector('.gs-read'), tags: root.querySelector('.gs-tags') };
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
      // the signpost on the path towards it, east of the Glass Bridge path
      const sx = 3.95, sz = S.at[1] - 1.0;
      TF.ledSign(['Spot Shot ▶'], '#ffe39a', sx, 1.75, sz, 1.7, 0.45);
      TF.box(0.1, 1.5, 0.1, MAT.metal, sx - 0.7, 0, sz - 0.06); TF.box(0.1, 1.5, 0.1, MAT.metal, sx + 0.7, 0, sz - 0.06); TF.colBox(sx - 0.85, sz - 0.2, sx + 0.85, sz + 0.1);
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
