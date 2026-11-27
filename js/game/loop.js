// TokenFall: zones and travel, the follow camera, and the main frame loop.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= zones & travel =================
let zone = 'lobby', traveling = false, armed = true;
const locName = document.getElementById('locName'), locSub = document.getElementById('locSub');
function setZone(z) {
  const prevZone = zone; zone = z;
  ModelFiles.enter(z);   // the cars, bikes and robot dog standing in this zone start loading (js/model-files.js)
  for (const k in ZONE_LIGHTS) for (const l of ZONE_LIGHTS[k]) { l.intensity = k === z ? l.userData.base : 0; l.visible = k === z; }
  capLamps();   // low tier: trims to the nearest lamps straight away
  const indoor = z === 'lab' || z === 'lab4' || z === 'abz' || z === 'us' || z === 'airport' || z === 'blr' || z === 'cb3' || z === 'stairs';
  scene.fog.near = z === 'abz' ? 50 : 34; scene.fog.far = z === 'abz' ? 190 : 95;   // up on the 15th floor you can see the city below
  sun.intensity = indoor ? .42 : 1.1; hemi.intensity = indoor ? .6 : .6;
  hemi.color.set(indoor ? 0xf0dcc4 : 0xf2dfc6);
  if (z === 'lab4') { sun.intensity = .3; hemi.intensity = .44; hemi.color.set(0xd9d6d0); }   // the HQ's fourth floor: open grey ceiling, a dimmer, cooler room than downstairs
  const dof = (z === 'lobby' && LOBBY.dof) || (z === 'pune' && PUNE_DOF) || DOF_DEFAULT;
  final.u.farStart.value = dof.farStart; final.u.farRange.value = dof.farRange; final.u.edgeBlur.value = dof.edgeBlur;
  TF.enter(prevZone, z);
  const a = AREAS[z];
  locName.textContent = a ? a.name : 'TokenFall Lobby'; locSub.textContent = a ? a.sub : 'Main Plaza';
  const here = [hero.name, ...npcs.filter(c => c.zone === z).map(c => c.name)];
  document.querySelector('#party h4 span').textContent = a ? a.name.toUpperCase() : 'LOBBY';
  document.getElementById('count').textContent = `${here.length} / 20`;
  document.getElementById('plist').innerHTML = here.map((n, i) => `<div class="${i ? 'pl-go' : 'me'}"${i ? ` data-who="${esc(n)}" tabindex="0" role="button"` : ''}><i></i>${esc(n)}${i ? '' : ' (you)'}</div>`).join('');
}
// The screen fades to black while the destination is made ready behind it: its people's sprite sheets go up one per frame (and the fade waits for them),
// then, with the screen black, the zone is switched and the loop runs a few frames before the fade lifts: each zone lights a different number of lamps,
// so a zone not seen yet compiles its shader programs on its first frames, and the player should not be looking at them.
function travel(p) {
  traveling = true; fadeEl.style.opacity = 1;
  ModelFiles.enter(p.to);   // start fetching the destination's models during the fade, not after it
  if (p.to === 'airport') apLoadAssets();   // the airport's 21 MB of real models: loaded and swapped in under the black, not a second after the reveal
  // the heavy part (the destination's character atlases going to the GPU, 100-350 ms each the first time, and its model files arriving) waits until the screen is black: run alongside the fade it froze the picture mid-fade
  new Promise((r) => setTimeout(r, 480)).then(() => uploadSheets(p.to)).catch(() => {}).then(() => ModelFiles.settled(4000)).then(() => p.to === 'airport' && Promise.race([new Promise((r) => apWhenAssets(r)), new Promise((r) => setTimeout(r, 8000))])).then(async () => {
    const to = p.to;
    if (p.at) { hero.x = p.at[0]; hero.y = p.at[1]; hero.dir = p.dir || 'down'; }
    else if (to === 'lobby') { const r = AREAS[p.zone].ret; hero.x = r[0]; hero.y = r[1]; hero.dir = AREAS[p.zone].retDir || (p.zone === 'lab' ? 'down' : p.zone === 'airport' ? 'right' : 'left'); }
    else { const a = AREAS[to], sp = a.spawn || [0, 4.6]; hero.x = a.cx + sp[0]; hero.y = a.cz + sp[1]; hero.dir = 'up'; }
    setZone(to); hero.zone = to; armed = false;
    snapCamera();
    // let the real loop draw a few frames of the new zone while the screen is still black: anything that compiles or uploads on the first frame
    // (including what the zone's own animation callbacks switch on) stalls one the player does not see. The cap keeps a dead loop from holding the fade.
    for (let n = frames, i = 0; frames < n + 3 && i < 40; i++) await yieldFrame();
    const a = AREAS[to];
    showBanner(a ? a.name : 'TokenFall Lobby', a ? a.sub : 'Main Plaza');
    log('', `You travelled to ${a ? a.name : 'the Lobby'}.`, true);
    fadeEl.style.opacity = 0; traveling = false;
  });
}

// ================= camera =================
const camTarget = new THREE.Vector3(), tmp = new THREE.Vector3();
function snapCamera() { camTarget.set(hero.x, CAM_VIEWS[camView].y + (TF.heroFloor[zone] ? hero.fy || 0 : 0), hero.y); camera.position.copy(camTarget).add(CAM_OFF); camera.lookAt(camTarget); }

// V: ease between the two views (offset and field of view) instead of cutting; held cameras (a minigame's) and reduced motion cut at once
function setCamView(i) {
  camView = i; const v = CAM_VIEWS[i], ms = camFx.on ? 0 : 520;
  tween(CAM_OFF, { x: v.off.x, y: v.off.y, z: v.off.z }, ms);
  tween(camera, { fov: v.fov }, ms, { onUpdate: () => camera.updateProjectionMatrix() });
}

// ================= quality: lamp cap, tier step-down, F3 overlay =================
// low tier keeps only the zone's Q.lamps nearest lamps lit; the count stays fixed, so swapping which ones are lit never recompiles a shader
function capLamps() {
  const ls = ZONE_LIGHTS[zone]; if (!ls || ls.length <= Q.lamps) return;
  const d = l => (l.position.x - camTarget.x) ** 2 + (l.position.z - camTarget.z) ** 2;
  const keep = new Set(ls.slice().sort((a, b) => d(a) - d(b)).slice(0, Q.lamps));
  for (const l of ls) l.visible = keep.has(l);
}
// frames still slow at the lowest resolution: one tier down (shadow map, blur taps, halo, lamps)
function stepTierDown() {
  Q = QUALITY[--tier]; RES_MAX = 1;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.radius = 3.2 * Q.shadow / 3072;
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  applyPostQuality(); capLamps();
}
const perfEl = Object.assign(document.createElement('pre'), { id: 'perf' });
perfEl.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;margin:0;padding:6px 9px;background:rgba(0,0,0,.65);color:#9f9;font:12px/1.35 monospace;pointer-events:none;display:none';
document.body.appendChild(perfEl);
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); perfEl.style.display = perfEl.style.display === 'none' ? 'block' : 'none'; } });
let perfT = 0, perfN = 0, perfMax = 0;
function perfFrame(raw) {
  perfT += raw; perfN++; if (raw > perfMax) perfMax = raw;
  if (perfT < 500) return;
  if (perfEl.style.display !== 'none') {
    const i = renderer.info.render, m = renderer.info.memory;
    perfEl.textContent = `${(perfN * 1000 / perfT).toFixed(0)} fps  ${(perfT / perfN).toFixed(1)} ms  worst ${perfMax.toFixed(0)} ms\ncalls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k\ntextures ${m.textures}  geometries ${m.geometries}  programs ${renderer.info.programs.length}\ntier ${Q.name}  res ${(PR * resScale).toFixed(2)}${MOBILE ? '  mobile' : ''}`;
  }
  perfT = perfN = perfMax = 0;
}

// ================= main loop =================
let hero, nearest = null, nearP = null, last = performance.now(), T = 0, chatterT = 4000;
const chatter = window.Chatter.create();   // each bot's own lines, never repeated within the last 10 messages (chatter.js)
const camDir = new THREE.Vector3();
let lampT = 0;
let frames = 0;   // frames drawn so far: travel() waits on it
function frame(now) {
  frames++;
  const raw = now - last, dt = Math.min(50, raw); last = now;
  perfFrame(raw); renderer.info.reset();   // the overlay reads the last frame's counts before they are cleared for this one
  if ((lampT -= dt) < 0) { lampT = 500; capLamps(); }
  if (!document.hidden) { ftAcc += raw; ftN++; }
  if (ftAcc > 2500) {
    const avg = ftAcc / ftN; ftAcc = ftN = 0;
    if (avg > 24 && resScale < .56 && tier > 0) stepTierDown();
    else if (avg > 24 && resScale > .55) { resScale -= .15; resize(); } else if (avg < 12 && resScale < RES_MAX) { resScale = Math.min(RES_MAX, resScale + .15); resize(); }
  } T += dt / 1000; timeU.value = T; final.u.time.value = T % 100;
  anime.engine.update();   // every tween (daylight, camera view, the leaderboard card) steps here, on the frame it is drawn
  // hero
  const keyIn = {
    up: keys.KeyW || keys.ArrowUp, down: keys.KeyS || keys.ArrowDown, left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight, run: keys.ShiftLeft || keys.ShiftRight,
  };
  hero.setInput(dialog || traveling || playerLocked ? { up: false, down: false, left: false, right: false, run: false } : walkToStep(keyIn, dt));   // walkToStep: a click on a name in the lobby list walks the hero there (walk-to.js)
  stepChar(hero, dt);
  if (TF.zoneTick[zone]) TF.zoneTick[zone](dt);
  // NPCs
  for (const c of npcs) {
    // characters are never frustum-culled (their shader places the card), so one in another zone, 300 m off and past the far plane, still cost a
    // draw, a shadow-map draw and, the first time, the upload of its 4096-wide sprite sheet: draw only the ones in this zone (travel() uploads
    // the destination's sheets under its fade before switching zones)
    const here = c.zone === zone; if (c.g.visible !== here) c.g.visible = here;
    npcThink(c, dt);
    const ox = c.x, oz = c.y; stepChar(c, dt);
    if (c.moving && Math.hypot(c.x - ox, c.y - oz) < c.speed * dt / 1000 * .4) c.stuck += dt; else c.stuck = 0;
  }
  chatterT -= dt;
  if (chatterT < 0) { chatterT = 6000 + Math.random() * 7000; const here = npcs.filter(c => c.zone === zone && !c.mute); if (here.length) { const bot = chatter.speaker(here), text = chatter.line(bot.name, zone === 'lab' || zone === 'lab4' || zone === 'cb3' || zone === 'abz' ? CHATTER_OFFICE : CHATTER); if (text) say(bot, text); } }
  charLightsFrame();
  for (const c of chars) syncChar(c);
  // portals
  let nearPortal = false, bestP = 3.4; nearP = null;
  for (const p of PORTALS) {
    const d = Math.hypot(hero.x - p.x, hero.y - p.z);
    if (d < 2.4) nearPortal = true;
    if (p.zone === zone && d < bestP) { bestP = d; nearP = p; }
    if (armed && !traveling && d < 1.1) travel(p);
  }
  if (!nearPortal) armed = true;
  // nearest interactable (NPCs too)
  nearest = null; let best = 99;
  for (const it of INTER) { const d = Math.hypot(hero.x - it.x, hero.y - it.z); if (d < it.r && d < best) { best = d; nearest = it; } }
  for (const c of npcs) {
    if (c.zone !== zone) continue;
    const d = Math.hypot(hero.x - c.x, hero.y - c.y);
    if (d < 1.5 && d < best) { best = d; nearest = { x: c.x, y: charHead(c).y + .75, z: c.y, label: c.name, verb: 'Talk', act: () => { c.wait = 4000; c.setInput({}); c.dir = Math.abs(hero.x - c.x) > Math.abs(hero.y - c.y) ? (hero.x > c.x ? 'right' : 'left') : (hero.y > c.y ? 'down' : 'up'); talk(c.name, NPC_TALK[c.name] || NPC_TALK[c.name.toLowerCase()] || [`Hi! I'm ${c.name}.`]); } }; }
  }
  if (playerLocked) { nearest = null; nearP = null; }
  // camera follows with a little lag
  // the camera rides up with a jump (60% of the hop, eased by the same follow lag), so the leap reads as a leap and the landing settles
  const jumpY = Math.max(0, hero.prevAir || 0) * .6;
  camTarget.lerp(tmp.set(hero.x, CAM_VIEWS[camView].y + jumpY + (TF.heroFloor[zone] ? hero.fy || 0 : 0), hero.y), 1 - Math.pow(.004, dt / 1000));
  camera.position.copy(camTarget).add(CAM_OFF); camera.lookAt(camTarget);
  sun.position.copy(camTarget).add(SUN_DIR); sun.target.position.copy(camTarget);
  final.u.focus.value = tmp.copy(camTarget).sub(camera.position).dot(camera.getWorldDirection(camDir));
  // dust drifts around the camera
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    let x = dp.getX(i) + Math.sin(T * .5 + i) * .004, y = dp.getY(i) + .003, z = dp.getZ(i);
    if (y > 6) y = .3;
    x = camTarget.x + ((x - camTarget.x + 20) % 40 + 40) % 40 - 20; z = camTarget.z + ((z - camTarget.z + 16) % 32 + 32) % 32 - 16;
    dp.setXYZ(i, x, y, z);
  }
  dp.needsUpdate = true;
  for (const f of anim) f(T);
  for (const f of life) f(T, dt / 1000);
  for (const f of FADERS) {
    const hide = f.test();
    if (hide !== f.faded) { f.faded = hide; for (const m of f.meshes) m.material = hide ? m.userData.fade : m.userData.mat; }
  }
  render();
  drawUI(dt);
  requestAnimationFrame(frame);
}

const proj = new THREE.Vector3(), scr = [0, 0, false];   // scr: toScreen's reused result (x, y, in front of the camera), so no array is made per label per frame
let VW = innerWidth, VH = innerHeight;   // read once and on resize: reading them per label, between style writes, can force a layout
addEventListener('resize', () => { VW = innerWidth; VH = innerHeight; });
function toScreen(x, y, z) { proj.set(x, y, z).project(camera); scr[0] = (proj.x + 1) / 2 * VW; scr[1] = (1 - proj.y) / 2 * VH; scr[2] = proj.z < 1; return scr; }
// The name tags, bubbles and prompt are anchored at left/top 0 and moved with the `translate` property: a compositor move, no layout. Every write is
// skipped when the element already holds that value (read back from its own inline style, so another writer such as characters.js can never leave it stale).
const HAS_TRANSLATE = 'translate' in document.documentElement.style;
function put(el, sx, sy, on) {
  const d = on ? 'block' : 'none';
  if (el.style.display !== d) el.style.display = d;
  if (!on) return;
  const x = Math.round(sx), y = Math.round(sy);
  if (HAS_TRANSLATE) {
    if (el.style.left !== '0px') { el.style.left = '0'; el.style.top = '0'; }
    const t = x + 'px ' + y + 'px'; if (el.style.translate !== t) el.style.translate = t;
  } else { el.style.left = x + 'px'; el.style.top = y + 'px'; }   // browsers without the individual property
}
let promptHtml = '';
function drawUI(dt) {
  for (const c of chars) {
    const show = c.zone === zone;
    const hd = charHead(c), [sx, sy, vis] = toScreen(c.x, hd.y + .17, hd.z);
    put(c.tag, sx, sy, show && vis && !dialog);
    if (c.bubble) {
      c.bubbleT -= dt;
      put(c.bubble, sx, sy - 22, show && vis && c.bubbleT > 0 && !dialog);
    }
  }
  if (nearest && !dialog && !traveling) {
    const [sx, sy] = toScreen(nearest.x, nearest.y ?? PROMPT_Y, nearest.z);
    const h = `<kbd>E</kbd>${esc(nearest.verb)} · ${esc(nearest.label)}`; if (h !== promptHtml) promptEl.innerHTML = promptHtml = h;
    put(promptEl, sx, sy, true);
  } else if (nearP && !dialog && !traveling) {   // portals say where they go when you walk up to them
    const [sx, sy] = toScreen(nearP.x, PORTAL_Y, nearP.z);
    const h = `Step in · ${esc(nearP.label)}`; if (h !== promptHtml) promptEl.innerHTML = promptHtml = h;
    put(promptEl, sx, sy, true);
  } else put(promptEl, 0, 0, false);
  if (dialog) {
    const l = dialog.lines[dialog.i];
    if (dialog.ch < l.length) dialog.ch = Math.min(l.length, dialog.ch + dt * .05);
    dlgText.textContent = l.slice(0, dialog.ch | 0);
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.style.opacity = 0; }
}
