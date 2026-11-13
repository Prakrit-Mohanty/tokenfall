// TokenFall: the TokenFall API that modules (the Glass Bridge) plug into, then boot.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= TokenFall API (Glass Bridge integration) =================
// Modules register with (window.TokenFallReady = window.TokenFallReady || []).push(TF => ...).
const LOBBY = VILLAGE;
if (LOBBY.npcBounds) NPC_BOUNDS.lobby = LOBBY.npcBounds;

const TF = window.TokenFall = {
  THREE, scene, camera, renderer, hemi, sun, FOG, CAM_OFF, MAT, TX, GREEN_MATS, rnd, rr, timeU, keys, post: final.u, charScale: CHAR_SCALE, skyU, SUN_DIR, shaftMat, get dust() { return dust; },
  INTER, PORTALS, WALK, COL, ZONE_LIGHTS, FADERS, AREAS, anim, life, mergeStatic, leaderboard: LEADERBOARD_API, get lobbySpots() { return LOBBY.minigameSpots || {}; },
  canvasTex, std, box, boxGeo, faceBox, plane, add, pointLight, ledSign, ledTex, signBoard, textTex, glowStrip, glowDisc,
  gate, portal, scatter, streetLamp, officeBlock, tree, colBox, colCirc, makeFader, talk, snapCamera, travel, blocked,
  get hero() { return hero; }, get zone() { return zone; }, get talking() { return !!dialog; }, get traveling() { return traveling; },
  zoneTick: {}, zoneEnv: {}, ground: {}, onKey: null, _on: { boot: [], enter: [] },
  on(evt, fn) { this._on[evt].push(fn); return fn; },
  boot() { this._on.boot.forEach(f => f()); },
  // called from setZone: per-zone fog/background/sun/hemi (defaults restored for zones without an env), then listeners
  enter(prev, z) {
    const e = this.zoneEnv[z] || {};
    const col = e.fog != null ? e.fog : FOG;
    scene.fog.color.set(col); scene.background.set(col);
    scene.fog.near = e.near != null ? e.near : 34; scene.fog.far = e.far != null ? e.far : 95;
    if (e.sun != null) sun.intensity = e.sun;
    if (e.hemi != null) hemi.intensity = e.hemi;
    if (e.hemiColor != null) hemi.color.set(e.hemiColor);
    if (prev !== z) this._on.enter.forEach(f => f(prev, z));
  },
  sys(text) { log('', text, true); },
  banner(title, sub) { showBanner(title, sub); },
  // fade to black, run cb while black, fade back; input and portals are locked meanwhile
  fade(cb, ms = 480) { traveling = true; fadeEl.style.opacity = 1; setTimeout(() => { cb(); fadeEl.style.opacity = 0; traveling = false; }, ms); },
  registerZone(key, o) {
    AREAS[key] = Object.assign({ key, cx: 0, cz: 0, name: key, sub: '', color: 0xffffff, ret: [0, 0], spawn: [0, 0] }, o);
    ZONE_LIGHTS[key] = ZONE_LIGHTS[key] || [];
    if (o.env) this.zoneEnv[key] = o.env;
    return AREAS[key];
  },
  // fn(x, z, y) -> ground height or null (a void); stored for the zone's tick to consult
  setGroundProvider(zoneKey, fn) { this.ground[zoneKey] = fn; },
  // a still, silent NPC (talk() on E, never wanders, never chats)
  addNPC(name, x, z, zoneKey, lines) {
    NPC_TALK[name] = lines; NPC_BOUNDS[zoneKey] = [x, z, x, z];
    const c = makeChar(name, x, z, { speed: 1, zone: zoneKey });
    c.wait = 1e12; c.mute = true; c.dir = 'down'; npcs.push(c); return c;
  },
};
// ---- carrom additions: lockPlayer, cameraTo / cameraRestore, sparkles ----
// lockPlayer(on): the hero stands where it is; no walking, no E prompt, no name tags or speech bubbles (the carrom table, any future table game)
let playerLocked = false;
TF.lockPlayer = (on) => { playerLocked = !!on; tagsEl.style.display = playerLocked ? 'none' : ''; return playerLocked; };
Object.defineProperty(TF, 'locked', { get: () => playerLocked });
// cameraTo(pos, look, ms, fov): eases the camera from where it is to a fixed view (fov kept unless given) and holds it, with the depth of field
// re-focused and softened for the close view; cameraRestore(ms): eases back to the follow camera (0 = at once). Runs in 'life', after the follow
// camera has been placed and before the frame is drawn, so it composes with anything else that nudges the camera (the bridge's shake).
const camFx = { on: false, mode: '', t: 0, dur: 1, from: null, to: null, cur: null };
const camEase = (k) => k * k * (3 - 2 * k), camRes = () => Math.max(4, rtScene.height / 135);
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
const _ready = window.TokenFallReady || [];
window.TokenFallReady = { push(f) { f(TF); } };
_ready.forEach(f => f(TF));

// ================= boot =================
const fontsReady = document.fonts ? Promise.race([Promise.all([document.fonts.load('600 24px "Pixelify Sans"'), document.fonts.load('700 20px Cinzel'), document.fonts.load('600 24px "DM Sans"')]), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
const sheetImg = new Image();
const sheetReady = new Promise(r => { sheetImg.onload = r; sheetImg.src = window.ADITYA_SHEET; });
Promise.all([fontsReady, sheetReady]).then(() => {
  buildTextures(); buildMaterials();
  const soft = document.createElement('canvas'); soft.width = sheetImg.naturalWidth; soft.height = sheetImg.naturalHeight; { const g = soft.getContext('2d'); g.filter = 'saturate(.88) contrast(.94) brightness(1.07)'; g.drawImage(sheetImg, 0, 0); }
  sheetTex = new THREE.Texture(soft); sheetTex.magFilter = sheetTex.minFilter = THREE.NearestFilter; sheetTex.generateMipmaps = false; sheetTex.needsUpdate = true;
  LOBBY.build(); buildAreas(); mergeStatic(); buildDust(); buildLife();
  applyTextureRefines();
  hero = makeChar('aditya', LOBBY.spawn[0], LOBBY.spawn[1], { me: true });
  hero.dir = LOBBY.spawnDir; hero.zone = 'lobby';
  npcs = NPC_NAMES.map(n => { const s = randomSpot(), c = makeChar(n, s.x, s.z, { speed: 2.2 }); c.wait = Math.random() * 3000; return c; });
  for (const [n, x, z] of [['rahul.k', -4, -8.4], ['meera_s', 3.4, -9], ['devansh', -4, 5.6]]) { const c = makeChar(n, x, -300 + z, { speed: 2.1, zone: 'lab' }); c.wait = Math.random() * 3000; npcs.push(c); }
  for (const [n, x, z] of [['ananya.r', 288, 9.2], ['kabir_m', 296, 6.4], ['sneha.d', 318, 2]]) { const c = makeChar(n, x, z, { speed: 1.9, zone: 'pune' }); c.wait = Math.random() * 3000; npcs.push(c); }
  for (const [n, x, z] of [['sana.k', 7.4, 298.6], ['arjun_p', -.3, 291.6]]) { const c = makeChar(n, x, z, { speed: 2.1, zone: 'abz' }); c.wait = Math.random() * 3000; npcs.push(c); }
  TF.boot();
  for (const [k, r] of Object.entries(LOBBY.returns)) AREAS[k].ret = r;
  const q = new URLSearchParams(location.search);
  if (q.get('zone') && AREAS[q.get('zone')]) { const a = AREAS[q.get('zone')], sp = a.spawn || [0, 4.6]; hero.x = a.cx + sp[0]; hero.y = a.cz + sp[1]; hero.zone = q.get('zone'); }
  if (q.get('at')) { const [ax, az] = q.get('at').split(',').map(Number); hero.x = ax; hero.y = az; }
  setZone(hero.zone); resize(); snapCamera();
  document.getElementById('loading').remove();
  // the world is built behind the launcher; start rendering and greeting once the player presses Enter
  return window.TokenFallStart || Promise.resolve();
}).then(() => {
  fadeEl.style.opacity = 0;
  showBanner('TokenFall', 'Main Plaza');
  log('', 'Welcome to TokenFall! Walk through a glowing gate to visit an area.', true);
  setTimeout(() => say(npcs[0], 'hi aditya! 👋'), 1800);
  requestAnimationFrame(t => { last = t; frame(t); });
});
