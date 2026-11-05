// TokenFall: the TokenFall API that modules (the Glass Bridge) plug into, then boot.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= TokenFall API (Glass Bridge integration) =================
// Modules register with (window.TokenFallReady = window.TokenFallReady || []).push(TF => ...).
const TF = window.TokenFall = {
  THREE, scene, camera, renderer, hemi, sun, FOG, CAM_OFF, MAT, TX, rnd, rr, timeU, keys, post: final.u,
  INTER, PORTALS, WALK, COL, ZONE_LIGHTS, FADERS, AREAS, anim, life,
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
const _ready = window.TokenFallReady || [];
window.TokenFallReady = { push(f) { f(TF); } };
_ready.forEach(f => f(TF));

// ================= boot =================
const fontsReady = document.fonts ? Promise.race([Promise.all([document.fonts.load('600 24px "Pixelify Sans"'), document.fonts.load('700 20px Cinzel')]), new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();
const sheetImg = new Image();
const sheetReady = new Promise(r => { sheetImg.onload = r; sheetImg.src = window.ADITYA_SHEET; });
Promise.all([fontsReady, sheetReady]).then(() => {
  buildTextures(); buildMaterials();
  sheetTex = new THREE.Texture(sheetImg); sheetTex.magFilter = sheetTex.minFilter = THREE.NearestFilter; sheetTex.generateMipmaps = false; sheetTex.needsUpdate = true;
  buildLobby(); buildAreas(); mergeStatic(); buildDust(); buildLife();
  hero = makeChar('aditya', 0, 2.6, { me: true });
  hero.dir = 'down'; hero.zone = 'lobby';
  npcs = NPC_NAMES.map(n => { const s = randomSpot(), c = makeChar(n, s.x, s.z, { speed: 2.2 }); c.wait = Math.random() * 3000; return c; });
  for (const [n, x, z] of [['rahul.k', -4, -8.4], ['meera_s', 3.4, -9], ['devansh', -4, 5.6]]) { const c = makeChar(n, x, -300 + z, { speed: 2.1, zone: 'lab' }); c.wait = Math.random() * 3000; npcs.push(c); }
  for (const [n, x, z] of [['sana.k', 7.4, 298.6], ['arjun_p', -.3, 291.6]]) { const c = makeChar(n, x, z, { speed: 2.1, zone: 'abz' }); c.wait = Math.random() * 3000; npcs.push(c); }
  TF.boot();
  const q = new URLSearchParams(location.search);
  if (q.get('zone') && AREAS[q.get('zone')]) { const a = AREAS[q.get('zone')], sp = a.spawn || [0, 4.6]; hero.x = a.cx + sp[0]; hero.y = a.cz + sp[1]; hero.zone = q.get('zone'); }
  if (q.get('at')) { const [ax, az] = q.get('at').split(',').map(Number); hero.x = ax; hero.y = az; }
  setZone(hero.zone); resize(); snapCamera();
  document.getElementById('loading').remove();
  fadeEl.style.opacity = 0;
  showBanner('TokenFall', 'Main Plaza');
  log('', 'Welcome to TokenFall! Walk through a glowing gate to visit an area.', true);
  setTimeout(() => say(npcs[0], 'hi aditya! 👋'), 1800);
  requestAnimationFrame(t => { last = t; frame(t); });
});
