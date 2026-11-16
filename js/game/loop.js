// TokenFall: zones and travel, the follow camera, and the main frame loop.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= zones & travel =================
let zone = 'lobby', traveling = false, armed = true;
const locName = document.getElementById('locName'), locSub = document.getElementById('locSub');
function setZone(z) {
  const prevZone = zone; zone = z;
  for (const k in ZONE_LIGHTS) for (const l of ZONE_LIGHTS[k]) { l.intensity = k === z ? l.userData.base : 0; l.visible = k === z; }
  const indoor = z === 'lab' || z === 'abz';
  scene.fog.near = z === 'abz' ? 50 : 34; scene.fog.far = z === 'abz' ? 190 : 95;   // up on the 15th floor you can see the city below
  sun.intensity = indoor ? .42 : 1.1; hemi.intensity = indoor ? .6 : .6;
  hemi.color.set(indoor ? 0xf0dcc4 : 0xf2dfc6);
  const dof = (z === 'lobby' && LOBBY.dof) || (z === 'pune' && PUNE_DOF) || DOF_DEFAULT;
  final.u.farStart.value = dof.farStart; final.u.farRange.value = dof.farRange; final.u.edgeBlur.value = dof.edgeBlur;
  TF.enter(prevZone, z);
  const a = AREAS[z];
  locName.textContent = a ? a.name : 'TokenFall Lobby'; locSub.textContent = a ? a.sub : 'Main Plaza';
  const here = ['aditya', ...npcs.filter(c => c.zone === z).map(c => c.name)];
  document.querySelector('#party h4 span').textContent = a ? a.name.toUpperCase() : 'LOBBY';
  document.getElementById('count').textContent = `${here.length} / 20`;
  document.getElementById('plist').innerHTML = here.map((n, i) => `<div class="${i ? '' : 'me'}"><i></i>${esc(n)}${i ? '' : ' (you)'}</div>`).join('');
}
function travel(p) {
  traveling = true; fadeEl.style.opacity = 1;
  setTimeout(() => {
    const to = p.to;
    if (p.at) { hero.x = p.at[0]; hero.y = p.at[1]; hero.dir = 'down'; }
    else if (to === 'lobby') { const r = AREAS[p.zone].ret; hero.x = r[0]; hero.y = r[1]; hero.dir = AREAS[p.zone].retDir || (p.zone === 'lab' ? 'down' : p.zone === 'archive' ? 'right' : 'left'); }
    else { const a = AREAS[to], sp = a.spawn || [0, 4.6]; hero.x = a.cx + sp[0]; hero.y = a.cz + sp[1]; hero.dir = 'up'; }
    setZone(to); hero.zone = to; armed = false;
    snapCamera();
    const a = AREAS[to];
    showBanner(a ? a.name : 'TokenFall Lobby', a ? a.sub : 'Main Plaza');
    log('', `You travelled to ${a ? a.name : 'the Lobby'}.`, true);
    fadeEl.style.opacity = 0; traveling = false;
  }, 480);
}

// ================= camera =================
const camTarget = new THREE.Vector3(), tmp = new THREE.Vector3();
function snapCamera() { camTarget.set(hero.x, CAM_VIEWS[camView].y, hero.y); camera.position.copy(camTarget).add(CAM_OFF); camera.lookAt(camTarget); }

// ================= main loop =================
let hero, nearest = null, nearP = null, last = performance.now(), T = 0, chatterT = 4000;
function frame(now) {
  const raw = now - last, dt = Math.min(50, raw); last = now;
  if (!document.hidden) { ftAcc += raw; ftN++; }
  if (ftAcc > 2500) {
    const avg = ftAcc / ftN; ftAcc = ftN = 0;
    if (avg > 24 && resScale > .55) { resScale -= .15; resize(); } else if (avg < 12 && resScale < 1) { resScale = Math.min(1, resScale + .15); resize(); }
  } T += dt / 1000; timeU.value = T; final.u.time.value = T % 100;
  // hero
  const typing = document.activeElement === chatIn;
  hero.setInput(dialog || traveling || typing || playerLocked ? { up: false, down: false, left: false, right: false, run: false } : {
    up: keys.KeyW || keys.ArrowUp, down: keys.KeyS || keys.ArrowDown, left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight, run: keys.ShiftLeft || keys.ShiftRight,
  });
  stepChar(hero, dt);
  if (TF.zoneTick[zone]) TF.zoneTick[zone](dt);
  // NPCs
  for (const c of npcs) {
    npcThink(c, dt);
    const ox = c.x, oz = c.y; stepChar(c, dt);
    if (c.moving && Math.hypot(c.x - ox, c.y - oz) < c.speed * dt / 1000 * .4) c.stuck += dt; else c.stuck = 0;
  }
  chatterT -= dt;
  if (chatterT < 0) { chatterT = 6000 + Math.random() * 7000; const here = npcs.filter(c => c.zone === zone && !c.mute); if (here.length) { const pool = zone === 'lab' || zone === 'abz' ? CHATTER_OFFICE : CHATTER; say(here[Math.random() * here.length | 0], pool[Math.random() * pool.length | 0]); } }
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
    if (d < 1.5 && d < best) { best = d; nearest = { x: c.x, z: c.y, label: c.name, verb: 'Talk', act: () => { c.wait = 4000; c.setInput({}); c.dir = Math.abs(hero.x - c.x) > Math.abs(hero.y - c.y) ? (hero.x > c.x ? 'right' : 'left') : (hero.y > c.y ? 'down' : 'up'); talk(c.name, NPC_TALK[c.name]); } }; }
  }
  if (playerLocked) { nearest = null; nearP = null; }
  // camera follows with a little lag
  camTarget.lerp(tmp.set(hero.x, CAM_VIEWS[camView].y, hero.y), 1 - Math.pow(.004, dt / 1000));
  camera.position.copy(camTarget).add(CAM_OFF); camera.lookAt(camTarget);
  sun.position.copy(camTarget).add(SUN_DIR); sun.target.position.copy(camTarget);
  final.u.focus.value = tmp.copy(camTarget).sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
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

const proj = new THREE.Vector3();
function toScreen(x, y, z) { proj.set(x, y, z).project(camera); return [(proj.x + 1) / 2 * innerWidth, (1 - proj.y) / 2 * innerHeight, proj.z < 1]; }
function drawUI(dt) {
  for (const c of chars) {
    const show = c.zone === zone;
    const [sx, sy, vis] = toScreen(c.x, 1.78 * CHAR_SCALE + .06 + c.mesh.position.y, c.y);
    c.tag.style.display = show && vis && !dialog ? 'block' : 'none';
    c.tag.style.left = sx + 'px'; c.tag.style.top = sy + 'px';
    if (c.bubble) {
      c.bubbleT -= dt;
      c.bubble.style.display = show && vis && c.bubbleT > 0 && !dialog ? 'block' : 'none';
      c.bubble.style.left = sx + 'px'; c.bubble.style.top = (sy - 22) + 'px';
    }
  }
  if (nearest && !dialog && !traveling) {
    const [sx, sy] = toScreen(nearest.x, 2.4, nearest.z);
    promptEl.innerHTML = `<kbd>E</kbd>${esc(nearest.verb)} · ${esc(nearest.label)}`;
    promptEl.style.display = 'block'; promptEl.style.left = sx + 'px'; promptEl.style.top = sy + 'px';
  } else if (nearP && !dialog && !traveling) {   // portals say where they go when you walk up to them
    const [sx, sy] = toScreen(nearP.x, 2.1, nearP.z);
    promptEl.innerHTML = `Step in · ${esc(nearP.label)}`;
    promptEl.style.display = 'block'; promptEl.style.left = sx + 'px'; promptEl.style.top = sy + 'px';
  } else promptEl.style.display = 'none';
  if (dialog) {
    const l = dialog.lines[dialog.i];
    if (dialog.ch < l.length) dialog.ch = Math.min(l.length, dialog.ch + dt * .05);
    dlgText.textContent = l.slice(0, dialog.ch | 0);
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.style.opacity = 0; }
}
