// House Rules Carrom — integration patch for lobby.html: every change the game makes to the lobby, as exact find/replace anchors.
// Build tool, not loaded by the game. It applies to a lobby.html that already has the Glass Bridge patch (as on main):
//     node tools/carrom-patch.js path/to/lobby.html path/to/output.html
// apply() throws if any anchor is missing or not unique, so an upstream lobby.html that moved on fails loudly instead of silently.
// Everything the carrom game does lives in js/carrom-*.js; the lobby only gets the hooks below.
(function (root) {
  // exact-text edits: [name, find, replace]
  const PATCHES = [
    // ---- the HQ carrom table: the half-finished game's pucks go (the game draws its own coins), the table tells the game where it is ----
    ['HQ table: the pucks go, the game learns where the table is',
      `    for (let i = 0; i < 9; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .015, 8), i % 3 ? (i % 2 ? MAT.charcoal : MAT.white) : MAT.pink)); c.position.set(tx + rr(-.3, .3), .68, tz + rr(-.3, .3)); }`,
      `    for (let i = 0; i < 9; i++) { rr(-.3, .3); rr(-.3, .3); }   // the seeded random stream stays exactly where it was, so nothing built after this moves\n` +
      `    if (TF.carrom) TF.carrom.table({ x: tx, z: tz, top: .67, size: 1 });`],
    ['HQ table: E starts the game (the old line stays as the fallback)',
      `act: () => talk('Carrom Board', ['Someone left a game half finished. The queen is still on the board.', 'Carrom tournaments: coming soon to TokenFall!']) });`,
      `act: () => (TF.carrom ? TF.carrom.open() : talk('Carrom Board', ['Someone left a game half finished. The queen is still on the board.', 'Carrom tournaments: coming soon to TokenFall!'])) });`],
    ['notice board: the house rules',
      `'📌 Lost: one rubber duck. Answers to “Debug”.']`,
      `'📌 House rules at the HQ carrom table: sink the coin that carries the right answer.', '📌 Lost: one rubber duck. Answers to “Debug”.']`],

    // ---- lockPlayer: the hero stands still, no prompts, no name tags ----
    ['lockPlayer: no hero input while locked',
      `hero.setInput(dialog || traveling || typing ? { up: false`,
      `hero.setInput(dialog || traveling || typing || playerLocked ? { up: false`],
    ['lockPlayer: no interaction prompt while locked',
      `    // camera follows with a little lag`,
      `    if (playerLocked) { nearest = null; nearP = null; }\n    // camera follows with a little lag`],
  ];

  // appended inside the lobby IIFE, right before the API block hands TF to the modules (everything private is in scope)
  const ANCHOR_API = `  const _ready = window.TokenFallReady || [];`;
  const API = `  // ---- carrom additions: lockPlayer, cameraTo / cameraRestore, sparkles ----
  // lockPlayer(on): the hero stands where it is; no walking, no E prompt, no name tags or speech bubbles (the carrom table, any future table game)
  let playerLocked = false;
  TF.lockPlayer = (on) => { playerLocked = !!on; tagsEl.style.display = playerLocked ? 'none' : ''; return playerLocked; };
  Object.defineProperty(TF, 'locked', { get: () => playerLocked });
  // cameraTo(pos, look, ms, fov): eases the camera from where it is to a fixed view (fov kept unless given) and holds it, with the depth of field
  // re-focused and softened for the close view; cameraRestore(ms): eases back to the follow camera (0 = at once). Runs in 'life', after the follow
  // camera has been placed and before the frame is drawn, so it composes with anything else that nudges the camera (the bridge's shake).
  const camFx = { on: false, mode: '', t: 0, dur: 1, from: null, to: null, cur: null };
  const camEase = (k) => k * k * (3 - 2 * k), camRes = () => Math.max(4, rtScene.height / 105);
  function camApply(p, l, fov, soften) {
    camera.position.copy(p); camera.lookAt(l);
    if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
    final.u.focus.value = p.distanceTo(l); final.u.maxR.value = camRes() * soften;
    camFx.cur = { p: p.clone(), l: l.clone(), fov };
  }
  TF.cameraTo = (pos, look, ms = 800, fov) => {
    const from = camFx.on && camFx.cur ? { p: camera.position.clone(), l: camFx.cur.l.clone(), fov: camera.fov } : { p: camera.position.clone(), l: camTarget.clone(), fov: camera.fov };
    Object.assign(camFx, { on: true, mode: 'to', t: 0, dur: Math.max(0.001, ms / 1000), from, to: { p: pos.clone(), l: look.clone(), fov: fov || camera.fov } });
  };
  TF.cameraRestore = (ms = 700) => {
    if (!camFx.on) return;
    if (ms <= 0) { camFx.on = false; camera.fov = CAM_VIEWS[camView].fov; camera.updateProjectionMatrix(); final.u.maxR.value = camRes(); snapCamera(); return; }
    Object.assign(camFx, { mode: 'back', t: 0, dur: ms / 1000, from: { p: camera.position.clone(), l: camFx.cur.l.clone(), fov: camera.fov } });
  };
  Object.defineProperty(TF, 'cameraHeld', { get: () => camFx.on });
  life.push((T, dt) => {
    if (!camFx.on) return;
    camFx.t = Math.min(1, camFx.t + dt / camFx.dur);
    const k = camEase(camFx.t), f = camFx.from;
    if (camFx.mode === 'to') {
      const t = camFx.to;
      camApply(f.p.clone().lerp(t.p, k), f.l.clone().lerp(t.l, k), f.fov + (t.fov - f.fov) * k, 1 - 0.65 * k);
      if (camFx.t >= 1) camFx.mode = 'hold';
    } else if (camFx.mode === 'hold') camApply(camFx.to.p, camFx.to.l, camFx.to.fov, 0.35);
    else {   // 'back': towards the follow camera the main loop has just placed
      const liveP = camera.position.clone(), liveL = camTarget.clone(), liveFov = CAM_VIEWS[camView].fov;
      camApply(f.p.clone().lerp(liveP, k), f.l.clone().lerp(liveL, k), f.fov + (liveFov - f.fov) * k, 0.35 + 0.65 * k);
      if (camFx.t >= 1) { camFx.on = false; camera.fov = liveFov; camera.updateProjectionMatrix(); final.u.maxR.value = camRes(); }
    }
  });
  TF.sparkles = (...a) => { sparkles(...a); return scene.children[scene.children.length - 1]; };   // the twinkle that marks something playable; returns it, so a game can hide it while it plays
`;

  const SCRIPTS = ['js/carrom-content.js', 'js/carrom-physics.js', 'js/carrom-generator.js', 'js/carrom-world.js', 'js/carrom-play.js', 'js/carrom-progress.js'];
  const INSTALL = '(window.TokenFallReady = window.TokenFallReady || []).push((TF) => { CarromWorld.install(TF); CarromPlay.install(TF); CarromProgress.install(TF); });';
  const ANCHOR_SCRIPTS = '<script src="js/bridge-progress.js"></script>\n';
  const ANCHOR_INSTALL = '(window.TokenFallReady = window.TokenFallReady || []).push((TF) => BridgePlay.install(TF));\n';

  function once(src, find, name) {
    const n = src.split(find).length - 1;
    if (n !== 1) throw new Error(`carrom-patch: "${name}" anchor found ${n} times (expected 1)`);
  }
  function apply(src, opts = {}) {
    const scripts = opts.scripts || SCRIPTS, install = opts.install || INSTALL;
    let out = src;
    for (const [name, find, replace] of PATCHES) { once(out, find, name); out = out.replace(find, () => replace); }
    once(out, ANCHOR_API, 'API block'); out = out.replace(ANCHOR_API, () => API + ANCHOR_API);
    once(out, ANCHOR_SCRIPTS, 'script tags'); out = out.replace(ANCHOR_SCRIPTS, () => ANCHOR_SCRIPTS + scripts.map((s) => `<script src="${s}"></script>\n`).join(''));
    once(out, ANCHOR_INSTALL, 'install line'); out = out.replace(ANCHOR_INSTALL, () => ANCHOR_INSTALL + install + '\n');
    return out;
  }

  const api = { PATCHES, API, SCRIPTS, INSTALL, apply };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    if (require.main === module) {   // node tools/carrom-patch.js <lobby.html> <out.html>
      const fs = require('fs'), [input, output] = process.argv.slice(2);
      if (!input || !output) { console.error('usage: node tools/carrom-patch.js <lobby.html with the bridge patch> <output lobby.html>'); process.exit(1); }
      fs.writeFileSync(output, apply(fs.readFileSync(input, 'utf8')));
      console.log(`wrote ${output} (${PATCHES.length + 3} edits, ${SCRIPTS.length} scripts)`);
    }
  } else root.CarromPatch = api;
})(this);
