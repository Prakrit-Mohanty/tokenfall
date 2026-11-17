// TokenFall: AI set pieces for the village lobby: a neural-network sculpture, the TOKEN-1 greeter, tokens rising from the
// fountain, a news ticker, the model-server pod and its training-data conveyor, a robot barista, a robot chess table, a
// generative art wall, a sweeper robot, smart parcel lockers, a robot dog and a chat-prompt hologram.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const VAI_TOKENS = ['to', 'ken', 'Fall', 'AI', 'pro', 'mpt', 'da', 'ta', '##', 'ing'];
const VAI_TICKER = '   TOKENFALL NEWS  ·  Tokens are chunks of text, not whole words  ·  An AI can sound sure and still be wrong  ·  Never paste passwords into a chatbot  ·  Leaderboard: most correct answers wins  ·  Prompt Lab opening soon  ·';
const VAI_TOKEN1 = { parts: null };

const vaiShell = () => vOnce('vaiShell', () => new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: .45 }));
function vaiFace(eyes) { const t = ledTex([eyes], '#8fe8ff', 32, 16); return std(t, 0, { emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.3 }); }

// three layers of glowing nodes on rods, every node wired to the next layer, light pulses running forward through it
function vaiNeuralNet(x, z) {
  box(4.8, .4, 1.4, MAT.concrete, x, 0, z); box(4.8, .04, .06, vGlow(V_LED), x, .4, z + .7, { cast: false });
  const layers = [[-1.8, [1.4, 2.3, 3.2]], [0, [1.1, 1.9, 2.7, 3.5]], [1.8, [1.8, 2.8]]];
  const nodes = layers.map(([lx, ys]) => ys.map((y) => new THREE.Vector3(x + lx, y + .4, z)));
  layers.forEach(([lx, ys]) => box(.07, Math.max(...ys) + .4, .07, MAT.metal, x + lx, 0, z));
  const nodeMats = [];
  nodes.flat().forEach((p, i) => {
    const m = new THREE.MeshStandardMaterial({ color: V_LED, emissive: V_LED, emissiveIntensity: 1 }); nodeMats.push(m);
    const s = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), m); s.position.copy(p); s.userData.dyn = true; scene.add(s);
  });
  const edges = [], pts = [];
  for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) { edges.push([a, b, l]); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const wires = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5fb8d8, transparent: true, opacity: .55 })); wires.userData.dyn = true; scene.add(wires);
  const n = 14, ppos = new Float32Array(n * 3), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pulses = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xe8fbff, size: .22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pulses.userData.dyn = true; pulses.frustumCulled = false; scene.add(pulses);
  const seeds = Array.from({ length: n }, () => [rnd(), rnd() * 9]);
  anim.push((t) => {
    seeds.forEach(([a, b], i) => {
      const u = (t * .5 + a) % 2, layer = u < 1 ? 0 : 1, f = u % 1;
      const pool = edges.filter((e) => e[2] === layer), [p, q] = pool[Math.floor(b * 31 + Math.floor(t * .5 + a) * 7) % pool.length];
      ppos[i * 3] = p.x + (q.x - p.x) * f; ppos[i * 3 + 1] = p.y + (q.y - p.y) * f; ppos[i * 3 + 2] = p.z + (q.z - p.z) * f;
    });
    pg.attributes.position.needsUpdate = true;
    nodeMats.forEach((m, i) => { m.emissiveIntensity = .7 + (Math.sin(t * 3 + i * 1.3) * .5 + .5) * 1.1; });
  });
  colBox(x - 2.4, z - .75, x + 2.4, z + .75);
  INTER.push({ x, z: z + 1.7, r: 1.7, label: 'Neural Net', verb: 'Look', act: () => talk('Neural Net', ['A tiny neural network made of light: inputs on the left, a hidden layer, answers on the right.', 'Each glowing wire is a weight. Training nudges millions, even billions, of them until the answers come out right.', 'This one has 9 nodes. The models behind chatbots have billions of weights.']) });
}

// TOKEN-1's body, built by the spawn point; token1.js takes the parts and drives it (follows you, reacts to the minigames)
function vaiGreeter(x, z) {
  const g = new THREE.Group(); g.userData.dyn = true; g.position.set(x, 0, z); scene.add(g);
  const body = new THREE.Group(); g.add(body);
  box(.7, .75, .5, vaiShell(), 0, .45, 0, { p: body }); box(.42, .26, .03, MAT.screen, 0, .72, .26, { p: body, cast: false });
  const head = new THREE.Group(); head.position.set(0, 1.45, 0); body.add(head);
  box(.72, .5, .52, vaiShell(), 0, -.25, 0, { p: head }); box(.56, .28, .03, vaiFace('o   o'), 0, -.2, .27, { p: head, cast: false });
  box(.04, .3, .04, MAT.metal, 0, .25, 0, { p: head }); const tip = box(.12, .12, .12, glowStrip(0xffb347), 0, .55, 0, { p: head, cast: false });
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * .43, 1.05, 0); body.add(a); box(.14, .5, .14, vaiShell(), 0, -.5, 0, { p: a }); return a; });
  const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .06, 20), vGlow(V_LED)), g, false); disc.position.y = .03;
  VAI_TOKEN1.parts = { g, body, head, arms, tip };
}

// word pieces drifting up from the coin, the way a model reads text: in tokens
function vaiTokenStream(x, z) {
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
  const sprites = VAI_TOKENS.map((w) => {
    const t = canvasTex(48, 16, (c) => { c.fillStyle = 'rgba(143,232,255,.18)'; c.fillRect(0, 1, 48, 14); c.fillStyle = '#c8f6ff'; c.font = '600 12px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(w, 24, 9); }, { nearest: true });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(1.1, .37, 1); g.add(s); return s;
  });
  anim.push((t) => sprites.forEach((s, i) => {
    const k = (t * .11 + i / sprites.length) % 1, a = i * 2.4 + t * .3, r = 1 + k * 1.6;
    s.position.set(x + Math.cos(a) * r, 3.3 + k * 1.3, z + Math.sin(a) * r); s.material.opacity = Math.sin(k * Math.PI) * .95;
  }));
}

// an arch over the north road with a scrolling LED news ticker, readable from both sides
function vaiTicker(z) {
  for (const s of [-1, 1]) { box(.3, 5.4, .3, MAT.metal, s * 3.3, 0, z); colCirc(s * 3.3, z, .22); }
  box(7, .3, .4, MAT.metal, 0, 5.4, z); box(7, .05, .05, vGlow(V_LED), 0, 5.36, z + .21, { cast: false });
  const tex = canvasTex(1024, 32, (g) => { g.fillStyle = '#15171d'; g.fillRect(0, 0, 1024, 32); g.fillStyle = '#ffd27a'; g.font = '600 18px "Pixelify Sans", monospace'; g.textBaseline = 'middle'; g.fillText(VAI_TICKER, 0, 17); }, { nearest: true });
  tex.repeat.set(.32, 1);
  const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.4, roughness: .5 });
  for (const ry of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(6.4, .6), m); p.position.set(0, 4.95, z + (ry ? -.21 : .21)); p.rotation.y = ry; p.userData.dyn = true; scene.add(p); }
  box(6.6, .7, .38, MAT.metal, 0, 4.6, z);
  anim.push((t) => { tex.offset.x = (t * .035) % 1; });
}

// a glass-fronted pod of blinking server racks: where models actually run
function vaiServerPod(x, z) {
  const g = vGroup(x, z), racks = MAT.rackLit.clone();
  gbox(g, 3.4, .25, 2.2, MAT.concrete, 0, 0, 0); gbox(g, 3.2, 2.7, 2, MAT.metal, 0, .25, -.15);
  gbox(g, 3, 2.3, .06, vGlass(), 0, .4, .9, { cast: false });
  for (const dx of [-1, 0, 1]) gbox(g, .8, 2.1, .5, racks, dx, .35, .5);
  for (const dx of [-.8, .8]) { const f = add(new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .2, 12), MAT.metal), g); f.position.set(dx, 3.05, -.2); }
  gbox(g, 3.3, .05, .05, vGlow(V_LED), 0, 2.9, .92, { cast: false });
  const sign = ledSign(['MODEL SERVERS'], '#8fe8ff', 0, 0, 0, 2.6, .4); g.add(sign); sign.position.set(0, 3.25, .9);
  anim.push((t) => { racks.emissiveIntensity = .6 + (Math.sin(t * 13) > .2 ? .7 : 0) + Math.sin(t * 2.1) * .2; });
  colBox(x - 1.75, z - 1.3, x + 1.75, z + 1.15);
  INTER.push({ x, z: z + 2.2, r: 1.7, label: 'Model Servers', verb: 'Look', act: () => talk('Model Servers', ['Racks of computers hum behind the glass.', 'This is where AI models actually run: big computers in data centres, not magic.', 'Every answer a chatbot gives uses real electricity and real hardware.']) });
}

// a robot dog that roams the plaza: trots to a spot it can reach, sits a while, and now and then comes over to sit by you
const DOG_AREA = [-11, -9, 11, 9];
const DOG_PAD = .45;
function dogPathClear(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .3);
  for (let i = 1; i <= n; i++) if (blocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, DOG_PAD)) return false;
  return true;
}
function dogPickTarget(dog) {
  if (hero.zone === 'lobby' && Math.hypot(hero.x - dog.x, hero.y - dog.z) < 9 && Math.random() < .35) {
    const a = Math.random() * 6.283, x = hero.x + Math.cos(a) * 1.3, z = hero.y + Math.sin(a) * 1.3;
    if (dogPathClear(dog.x, dog.z, x, z)) return { x, z };
  }
  for (let i = 0; i < 30; i++) {
    const x = DOG_AREA[0] + Math.random() * (DOG_AREA[2] - DOG_AREA[0]), z = DOG_AREA[1] + Math.random() * (DOG_AREA[3] - DOG_AREA[1]);
    if (Math.hypot(x - dog.x, z - dog.z) > 2.5 && dogPathClear(dog.x, dog.z, x, z)) return { x, z };
  }
  return null;
}
function vaiRobotDog(x, z) {
  const g = new THREE.Group(); g.name = 'robotDog'; g.userData.dyn = true; scene.add(g);
  const body = new THREE.Group(); g.add(body);
  box(.9, .32, .4, vaiShell(), 0, .42, 0, { p: body }); box(.36, .3, .32, vaiShell(), .55, .66, 0, { p: body });
  box(.03, .1, .24, vaiFace('o o'), .74, .66, 0, { p: body, cast: false });
  const tail = new THREE.Group(); tail.position.set(-.45, .6, 0); body.add(tail);
  box(.05, .3, .05, MAT.metal, 0, 0, 0, { p: tail }); box(.08, .08, .08, vGlow(V_LED), 0, .3, 0, { p: tail, cast: false });
  const legs = [[.32, .15], [.32, -.15], [-.32, .15], [-.32, -.15]].map(([lx, lz]) => { const p = new THREE.Group(); p.position.set(lx, .42, lz); body.add(p); box(.09, .42, .09, MAT.metal, 0, -.42, 0, { p }); return p; });
  const dog = { x, z, target: null, wait: 1, heading: 0, sit: 0 };
  let last = 0;
  anim.push((t) => {
    const dt = Math.min(.05, Math.abs(t - last)); last = t;
    let moving = false;
    if (dog.wait > 0) dog.wait -= dt;
    else if (!dog.target) { dog.target = dogPickTarget(dog); if (!dog.target) dog.wait = .5; }
    else {
      const dx = dog.target.x - dog.x, dz = dog.target.z - dog.z, d = Math.hypot(dx, dz), sp = (d > 5 ? 2.6 : 1.5) * dt;
      if (d < .3) { dog.target = null; dog.wait = 2 + Math.random() * 4; }
      else if (blocked(dog.x + dx / d * sp, dog.z + dz / d * sp, DOG_PAD)) { dog.target = null; dog.wait = .4; }
      else { dog.x += dx / d * sp; dog.z += dz / d * sp; moving = true; dog.heading += Math.atan2(Math.sin(Math.atan2(-dz, dx) - dog.heading), Math.cos(Math.atan2(-dz, dx) - dog.heading)) * Math.min(1, dt * 8); }
    }
    dog.sit += ((moving ? 0 : 1) - dog.sit) * Math.min(1, dt * 4);
    g.position.set(dog.x, 0, dog.z); g.rotation.y = dog.heading;
    body.rotation.z = dog.sit * .32; body.position.y = -dog.sit * .08;
    legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(t * 12 + (i % 3 ? Math.PI : 0)) * .5 : (i > 1 ? -dog.sit * .9 : 0); });
    const happy = hero.zone === 'lobby' && Math.hypot(hero.x - dog.x, hero.y - dog.z) < 2.5;
    tail.rotation.x = happy ? Math.sin(t * 16) * .5 : Math.sin(t * 2) * .1;
  });
}

// a floating chat window over the Prompt Lab, its cursor blinking
function vaiChatHolo(x, y, z, ry) {
  const frame = (cursor) => canvasTex(128, 48, (g) => {
    g.fillStyle = 'rgba(143,232,255,.16)'; g.fillRect(2, 2, 124, 44); g.fillStyle = '#8fe8ff'; g.fillRect(2, 2, 124, 2); g.fillRect(2, 44, 124, 2); g.fillRect(2, 2, 2, 44); g.fillRect(124, 2, 2, 44);
    g.font = '600 12px "Pixelify Sans", monospace'; g.textBaseline = 'middle'; g.fillStyle = '#d6f7ff';
    g.fillText('> write a haiku', 10, 16); g.fillText('  about tokens' + (cursor ? '_' : ''), 10, 32);
  }, { nearest: true });
  const frames = [frame(true), frame(false)], m = new THREE.MeshBasicMaterial({ map: frames[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
  for (const s of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), m); p.rotation.y = s; g.add(p); }
  anim.push((t) => { g.position.set(x, y + Math.sin(t * 1.3) * .1, z); g.rotation.y = ry; m.map = frames[Math.floor(t * 2) % 2]; });
}

// a street-level LED wall that paints pixel scenes stroke by stroke, holds them, fades, and starts the next
const ART_W = 96, ART_H = 48;
function artScene() {
  const hue = Math.random() * 360, c = (h, s, l) => `hsl(${(hue + h) % 360},${s}%,${l}%)`, out = [], kind = Math.floor(Math.random() * 3);
  for (let y = 0; y < ART_H; y += 3) out.push([0, y, ART_W, 3, c(kind === 1 ? 200 : 20, 55, 78 - y * .8)]);
  if (kind === 0) {
    const sx = 20 + Math.random() * 56; for (let a = 0; a < 6.28; a += .5) out.push([sx + Math.cos(a) * 4 - 1, 12 + Math.sin(a) * 4 - 1, 3, 3, c(40, 90, 70)]);
    for (const [base, amp, l] of [[30, 6, 45], [36, 4, 35], [42, 3, 25]]) for (let x = 0; x < ART_W; x += 3) { const top = base + Math.sin(x * .07 + base) * amp; out.push([x, top, 3, ART_H - top, c(120, 45, l)]); }
  } else if (kind === 1) {
    for (let x = 0; x < ART_W; x += 6 + Math.floor(Math.random() * 4)) { const top = 14 + Math.random() * 22, w = 5 + Math.random() * 3; out.push([x, top, w, ART_H - top, c(230, 25, 18)]); for (let y = top + 2; y < ART_H - 2; y += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (Math.random() < .5) out.push([wx, y, 1, 1, c(50, 95, 70)]); }
  } else {
    for (let r = 22; r > 0; r -= 3) out.push([ART_W / 2 - r * 2, ART_H / 2 - r, r * 4, r * 2, c(r * 9, 70, 30 + (r % 6) * 6)]);
  }
  return out;
}
function vaiArtWall(x, z, ry) {
  const g = vGroup(x, z, ry), w = 5, h = 2.5;
  for (const s of [-1, 1]) gbox(g, .16, h + .5, .16, MAT.metal, s * (w / 2 + .1), 0, 0);
  gbox(g, w + .36, h + .2, .14, MAT.metal, 0, .4, -.06); gbox(g, w + .36, .05, .05, vGlow(V_LED), 0, h + .62, .03, { cast: false });
  const tex = canvasTex(ART_W, ART_H, (c) => { c.fillStyle = '#0c0e14'; c.fillRect(0, 0, ART_W, ART_H); }, { nearest: true }), ctx = tex.image.getContext('2d');
  const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1, roughness: .6 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); scr.position.set(0, .5 + h / 2, .02); scr.userData.dyn = true; g.add(scr);
  let strokes = artScene(), i = 0, hold = 0, fade = 0, acc = 0, last = 0;
  anim.push((t) => {
    acc += Math.min(.1, Math.abs(t - last)); last = t;
    if (acc < .06) return;
    acc = 0;
    if (i < strokes.length) { for (let k = 0; k < 7 && i < strokes.length; k++, i++) { const [sx, sy, sw, sh, col] = strokes[i]; ctx.fillStyle = col; ctx.fillRect(sx | 0, sy | 0, Math.ceil(sw), Math.ceil(sh)); } }
    else if (hold < 40) hold++;
    else if (fade < 14) { ctx.fillStyle = 'rgba(12,14,20,.25)'; ctx.fillRect(0, 0, ART_W, ART_H); fade++; }
    else { strokes = artScene(); i = 0; hold = 0; fade = 0; }
    tex.needsUpdate = true;
  });
  colBox(...vFootprint(x, z, w + .5, .5, ry));
}

// data cubes ride a belt into the model-server pod; glowing 'model' crystals slide out of the other side into a bin
function vaiConveyor(x0, x1, z, outX0, outX1) {
  const y = .8, len = x1 - x0, mid = (x0 + x1) / 2;
  box(len, .12, .7, MAT.metal, mid, y - .12, z); for (const lx of [x0 + .3, mid, x1 - .3]) for (const s of [-1, 1]) box(.08, y - .12, .08, MAT.metal, lx, 0, z + s * .3);
  const beltTex = canvasTex(16, 4, (c) => { c.fillStyle = '#23262c'; c.fillRect(0, 0, 16, 4); c.fillStyle = '#3a3e48'; for (let i = 0; i < 16; i += 4) c.fillRect(i, 0, 1, 4); }, { nearest: true });
  beltTex.repeat.set(len * 2, 1);
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(len, .6), new THREE.MeshStandardMaterial({ map: beltTex, roughness: .8 })); belt.rotation.x = -Math.PI / 2; belt.position.set(mid, y + .01, z); belt.userData.dyn = true; scene.add(belt);
  box(len, .04, .04, vGlow(V_LED), mid, y - .04, z + .36, { cast: false });
  box(1, .9, .9, MAT.metal, x1 + .4, 0, z); box(1.1, .5, 1, MAT.metal, x1 + .4, .9, z);
  ledSign(['TRAINING DATA'], '#ffd27a', x1 + .4, 1.75, z + .2, 1.6, .34);
  box(.06, .7, .6, vOnce('slot', () => new THREE.MeshStandardMaterial({ color: 0x0c0e14 })), x0 - .02, y - .05, z, { cast: false });
  const icons = ['Aa', '01', '{}', '♪', '[]', '?!'].map((txt, k) => { const t = canvasTex(16, 16, (c) => { c.fillStyle = ['#ffd27a', '#8fe8ff', '#9dff9f', '#ff9db5', '#c8a6ff', '#ffffff'][k]; c.fillRect(0, 0, 16, 16); c.fillStyle = '#15171d'; c.font = '600 9px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 8, 9); }, { nearest: true }); return std(t, 0, { emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35 }); });
  const cubes = Array.from({ length: 8 }, (_, k) => { const c = new THREE.Mesh(new THREE.BoxGeometry(.28, .28, .28), icons[k % icons.length]); c.castShadow = true; c.userData.dyn = true; scene.add(c); return c; });
  const crystalMat = new THREE.MeshStandardMaterial({ color: V_LED, emissive: V_LED, emissiveIntensity: 1.3, roughness: .2 });
  const crystals = Array.from({ length: 3 }, () => { const c = new THREE.Mesh(new THREE.OctahedronGeometry(.17), crystalMat); c.userData.dyn = true; scene.add(c); return c; });
  const outLen = outX0 - outX1;
  box(outLen, .1, .5, MAT.metal, (outX0 + outX1) / 2, .55, z); box(.9, .5, .9, MAT.metal, outX1 - .3, 0, z);
  for (const s of [-1, 1]) box(.08, .55, .08, MAT.metal, (outX0 + outX1) / 2, 0, z + s * .2);
  anim.push((t) => {
    beltTex.offset.x = -(t * .6) % 1;
    cubes.forEach((c, k) => { const f = (t * .06 + k / cubes.length) % 1; c.position.set(x1 - f * len, y + .15, z); c.rotation.y = f * .4; c.visible = f < .97; });
    crystals.forEach((c, k) => { const f = (t * .12 + k / crystals.length) % 1; c.position.set(outX0 - f * outLen, .78 - (f > .85 ? (f - .85) * 2 : 0), z); c.rotation.y = t * 2 + k; });
  });
  colBox(x0, z - .45, x1 + .95, z + .5); colBox(outX1 - .8, z - .5, outX0, z + .5);
}

function buildVillageAI() {
  vaiNeuralNet(-7.4, -13.2);
  vaiGreeter(2, 11.8);
  vaiTokenStream(0, 0);
  vaiTicker(-11.2);
  vaiServerPod(-41, -7.2);
  vaiRobotDog(4, 5.5);
  vaiChatHolo(10, 5.4, 26, -Math.PI / 2);
  vaiConveyor(-39.2, -34.4, -7.4, -42.8, -45);
  vaiArtWall(19, 5.9, Math.PI);
  robotBarista(18.2, -8.6);
  robotChess(-8.4, -6.4);
  robotSweeper(-1.3, 15, 38);
  smartLockers(V_BOT_DOCK[0], -4.6);
}
