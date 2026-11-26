// TokenFall: the TokenFall API that modules (the Glass Bridge) plug into, then boot.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= TokenFall API (Glass Bridge integration) =================
// Modules register with (window.TokenFallReady = window.TokenFallReady || []).push(TF => ...).
const LOBBY = VILLAGE;
if (LOBBY.npcBounds) NPC_BOUNDS.lobby = LOBBY.npcBounds;

const TF = window.TokenFall = {
  THREE, scene, camera, renderer, hemi, sun, FOG, CAM_OFF, MAT, TX, GREEN_MATS, GRASS_U, PAVE_U, POOL_MAT, rnd, rr, timeU, keys, post: final.u, charScale: CHAR_SCALE, charLight, tween, skyU, SUN_DIR, shaftMat, get dust() { return dust; },
  INTER, PORTALS, WALK, COL, ZONE_LIGHTS, FADERS, AREAS, anim, life, mergeStatic, leaderboard: LEADERBOARD_API, get lobbySpots() { return LOBBY.minigameSpots || {}; },
  canvasTex, std, box, boxGeo, faceBox, plane, add, pointLight, ledSign, ledTex, signBoard, textTex, glowStrip, glowDisc,
  gate, portal, scatter, streetLamp, officeBlock, tree, colBox, colCirc, makeFader, talk, snapCamera, travel, blocked,
  get hero() { return hero; }, get zone() { return zone; }, get talking() { return !!dialog; }, get traveling() { return traveling; },
  // the last Normal / Easy choice on the Glass Bridge or the carrom table: the default (Enter) the next time either asks
  get easy() { try { return localStorage.getItem('tokenfall.easy') === '1'; } catch (e) { return false; } },
  set easy(on) { try { localStorage.setItem('tokenfall.easy', on ? '1' : '0'); } catch (e) {} },
  zoneTick: {}, zoneEnv: {}, ground: {}, onKey: null, _on: { boot: [], enter: [], game: [] },
  on(evt, fn) { this._on[evt].push(fn); return fn; },
  fire(evt, e) { this._on[evt].forEach(f => f(e)); },
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
  // fade to black, run cb while black, fade back; input and portals are locked meanwhile. After cb the real loop draws three frames before the fade
  // lifts (as travel() does): whatever cb switched on compiles or uploads on those, not on a frame the player sees. try/finally: the fade always lifts.
  fade(cb, ms = 480) {
    traveling = true; fadeEl.style.opacity = 1;
    setTimeout(async () => {
      try { cb(); for (let n = frames, i = 0; frames < n + 3 && i < 40; i++) await yieldFrame(); }
      finally { fadeEl.style.opacity = 0; traveling = false; }
    }, ms);
  },
  registerZone(key, o) {
    AREAS[key] = Object.assign({ key, cx: 0, cz: 0, name: key, sub: '', color: 0xffffff, ret: [0, 0], spawn: [0, 0] }, o);
    ZONE_LIGHTS[key] = ZONE_LIGHTS[key] || [];
    if (o.env) this.zoneEnv[key] = o.env;
    return AREAS[key];
  },
  // fn(x, z, y) -> ground height or null (a void); stored for the zone's tick to consult
  setGroundProvider(zoneKey, fn) { this.ground[zoneKey] = fn; },
  // a still, silent NPC (talk() on E, never wanders, never chats)
  addNPC(name, x, z, zoneKey, lines, look) {   // look: a model from CHARS (the default takes turns between the lobby's two)
    NPC_TALK[name] = lines; NPC_BOUNDS[zoneKey] = [x, z, x, z];
    const c = makeChar(name, x, z, { speed: 1, zone: zoneKey, look });
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
// Everything the first visible frame used to do, done behind the loading screen: the start zone's sprite sheets go up to the GPU one per frame
// (the loading screen keeps moving between them), then one hidden render links its shader programs and fills the shadow map. Only the people in the
// start zone are shown, the rule frame() applies, so the other zones' sheets stay un-uploaded (they go up under the travel fade, see loop.js).
const yieldFrame = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 100); });   // the timeout keeps a hidden tab from stalling the load
// puts the sprite sheets of the people in zone z that are not on the GPU yet there, one per frame (travel() uses it under its fade too)
async function uploadSheets(z) {
  const here = [hero, ...npcs.filter((c) => c.zone === z)];
  for (const id in sheetTex) {
    if (!here.some((c) => c.mesh.material.map === sheetTex[id]) || renderer.properties.get(sheetTex[id]).__webglTexture) continue;
    renderer.initTexture(sheetTex[id]); renderer.initTexture(auxTex[id]);
    await yieldFrame();
  }
}
async function warmUp() {
  for (const c of npcs) c.g.visible = c.zone === zone;
  await uploadSheets(zone);
  render(); gl.finish();
  await yieldFrame();
}
// The loading screen leaves as a 320 ms fade and slight zoom: opacity and transform only, run by the browser's compositor (anime.js's WAAPI animator),
// so a busy main thread cannot stall it. The `out` class lets the HUD show through it and ignores clicks (mode-cards.css). Removed when done, or after
// 700 ms whatever happens, so it can never be left covering the game.
function hideLoading() {
  const el = document.getElementById('loading');
  return new Promise((done) => {
    el.classList.add('out');
    setTimeout(done, 700);
    anime.waapi.animate(el, { opacity: 0, scale: 1.04, duration: REDUCED_MOTION ? 1 : 320, ease: 'out(3)', onComplete: done });
  }).then(() => el.remove());
}
const fontsReady = document.fonts ? Promise.race([Promise.all([document.fonts.load('600 24px "Baloo 2"'), document.fonts.load('400 18px Poppins'), document.fonts.load('700 18px Poppins')]), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
const sheetImgs = {}, auxImgs = {}, sheetReady = Promise.all([[window.CHAR_SHEETS, sheetImgs], [window.CHAR_AUX, auxImgs]].flatMap(([srcs, into]) => Object.entries(srcs).map(([id, src]) => new Promise(r => { const im = into[id] = new Image(); im.onload = r; im.src = src; }))));
Promise.all([fontsReady, sheetReady]).then(() => {
  buildTextures(); buildMaterials();
  // premultiplied alpha + mipmaps + anisotropy: no dark or light fringe at the edge, no shimmer when a figure is far or turns
  for (const [id, im] of Object.entries(sheetImgs)) {
    const t = sheetTex[id] = new THREE.Texture(im); t.premultiplyAlpha = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
    const a = auxTex[id] = new THREE.Texture(auxImgs[id]); a.magFilter = a.minFilter = THREE.LinearFilter; a.generateMipmaps = false; a.needsUpdate = true;   // data, not colour: never premultiplied, never mipmapped
  }
  LOBBY.build(); buildAreas();
  groundContacts(scene, (x, z) => Math.abs(x) < 70 && Math.abs(z) < 70);   // contact shadows under everything that stands on a floor (grounding.js); the lobby has its own
  trimCasters(); mergeStatic(); buildDust(); buildLife();
  applyTextureRefines(); softenTextures();
  // the world is built behind the launcher; the hero and the NPCs wait for the player's pick (the picker saves it, see launcher/char-select-screen.js)
  return window.TokenFallStart || Promise.resolve();
}).then(() => {
  const look = CharSelect.getChoice();
  hero = makeChar(look, LOBBY.spawn[0], LOBBY.spawn[1], { me: true, look });
  hero.dir = LOBBY.spawnDir; hero.zone = 'lobby';
  npcs = CharSelect.npcNames(NPC_NAMES.filter((n) => n !== 'gaurav'), look)   // Gaurav works in the US office now (below)
    .map(n => { const s = randomSpot(), c = makeChar(n, s.x, s.z, { speed: 2.2, look: CHARS[n] ? n : undefined }); c.wait = Math.random() * 3000; return c; });
  for (const [n, x, z] of [['rahul.k', -4, -8.4], ['meera_s', 3.4, -9], ['devansh', -4, 5.6]]) { const c = makeChar(n, x, -300 + z, { speed: 2.1, zone: 'lab' }); c.wait = Math.random() * 3000; npcs.push(c); }
  for (const [n, x, z] of [['ananya.r', 288, 9.2], ['kabir_m', 296, 6.4], ['sneha.d', 318, 2]]) { const c = makeChar(n, x, z, { speed: 1.9, zone: 'pune' }); c.wait = Math.random() * 3000; npcs.push(c); }
  // the senior folk (Bigshot-npcs): three in the HQ, three at ABZ, and Baljeet, Salim, Brian, Rohit and Gaurav in the US office, each in their own sprite; they wander the floor like the others
  for (const [id, zone, x, z] of [['murali', 'lab', -2, -306], ['salim', 'us', -305, -296], ['amit', 'abz', 6, 293], ['jacintha', 'lab', 3, -312], ['kartik', 'lab', 1, -288.3],
    ['arvind', 'abz', 3, 296], ['rajiv', 'abz', -4, 302], ['brian', 'us', -295, -300], ['baljeet', 'us', -300, -298], ['rohit', 'us', -302, -303], ['gaurav', 'us', -297, -295]]) {
    const name = CHARS[id].name, c = makeChar(name, x, z, { speed: 1.8, zone, look: id }); c.wait = Math.random() * 3000; npcs.push(c);
  }
  for (const [n, x, z] of [['sana.k', 7.4, 298.6], ['arjun_p', -.3, 291.6]]) { const c = makeChar(n, x, z, { speed: 2.1, zone: 'abz' }); c.wait = Math.random() * 3000; npcs.push(c); }
  for (const [n, x, z] of BLR_TEAM) { const c = makeChar(n, AREAS.blr.cx + x, AREAS.blr.cz + z, { speed: 2, zone: 'blr' }); c.wait = Math.random() * 3000; npcs.push(c); }   // the Bengaluru team (office-blr.js)
  TF.boot(); trimCasters();   // again for what the minigames add at boot
  for (const [k, r] of Object.entries(LOBBY.returns)) AREAS[k].ret = r;
  const q = new URLSearchParams(location.search);
  if (q.get('zone') && AREAS[q.get('zone')]) { const a = AREAS[q.get('zone')], sp = a.spawn || [0, 4.6]; hero.x = a.cx + sp[0]; hero.y = a.cz + sp[1]; hero.zone = q.get('zone'); }
  if (q.get('at')) { const [ax, az] = q.get('at').split(',').map(Number); hero.x = ax; hero.y = az; }
  setZone(hero.zone); resize(); snapCamera();
  return warmUp();
}).then(() => {
  // the world is ready: lift the black fade UNDER the loading screen (no transition, so no flash of black), start the loop, then let the loading screen go
  fadeEl.style.transition = 'none'; fadeEl.style.opacity = 0; void fadeEl.offsetWidth; fadeEl.style.transition = '';
  requestAnimationFrame(t => { last = t; frame(t); });
  return hideLoading();
}).then(() => {
  showBanner('TokenFall', 'Main Plaza');
  log('', 'Welcome to TokenFall! Walk through a glowing gate to visit an area.', true);
  setTimeout(() => say(npcs[0], `hi ${CHARS[hero.name].name}! 👋`), 1800);
});
