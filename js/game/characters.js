// TokenFall: sprite characters (hero and NPCs) and NPC wandering.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= characters =================
// every character in js/sprites/chars-data.js shares one cell layout and standing height, so one size rule fits them all: FIG_H is how tall they stand (before CHAR_SCALE)
const [SHEET_W, SHEET_H] = CHAR_SHEET_SIZE, CW = CHARS.aditya.cell.w, CH = CHARS.aditya.cell.h, FIG_H = 1.6, SPU = FIG_H / CHARS.aditya.standHeight;   // SPU: world units per sprite px
const spriteGeo = new THREE.PlaneGeometry(CW * SPU, CH * SPU); spriteGeo.translate(0, (CHARS.aditya.anchor.y - CH / 2) * SPU, 0);   // feet on the origin
const blobGeo = new THREE.PlaneGeometry(1.1, .55);
const CHAR_SCALE = 1.1;   // the sprites were a touch small beside the 3D world
let sheetTex;
const chars = [];
// the light a sprite stands in (set by Daylight.apply from the scene's ambient + sun; neutral until it runs). The characters are camera-facing cards, so a directional N.L would dim
// them whenever the sun is low or behind them: they are unlit instead, tinted each frame by this plus the nearest lamp.
const charLight = { color: new THREE.Color(.62, .62, .62), lamp: .3, min: .55, max: 1.1 };
function lightChar(c) {
  const col = c.mesh.material.color, cl = charLight; col.copy(cl.color);
  let best = 0, lamp = null;
  for (const l of ZONE_LIGHTS[c.zone] || []) {
    const f = 1 - Math.hypot(l.position.x - c.x, l.position.z - c.y) / (l.distance || 9), k = f > 0 ? f * f * l.intensity : 0;
    if (k > best) { best = k; lamp = l; }
  }
  if (lamp) col.r += lamp.color.r * best * cl.lamp, col.g += lamp.color.g * best * cl.lamp, col.b += lamp.color.b * best * cl.lamp;
  const L = col.r * .2126 + col.g * .7152 + col.b * .0722;   // luminance clamp, hue kept: never black, never blown out
  if (L < 1e-3) col.setScalar(cl.min); else col.multiplyScalar(Math.min(cl.max, Math.max(cl.min, L)) / L);
}
const tagsEl = document.getElementById('tags');
let npcLooks = 0;   // NPCs without a model of their own take turns: Aditya, Sudhanshu, Aditya...
function makeChar(name, x, z, opt = {}) {
  const look = opt.look || (opt.me ? 'aditya' : ['aditya', 'sudhanshu'][npcLooks++ % 2]);
  const c = new SpriteCharacter(CHARS[look], null, { x, y: z, speed: opt.speed || 3.3, scale: 1, animRef: 3.3 });   // animRef: the hero's walk, which the cycles match; slower NPCs step slower
  // one GPU copy of the sheet for everyone: each character only tells the shader which cell of it to show (uCell = u, v, width, height)
  const t = sheetTex, cell = { value: new THREE.Vector4() };
  const useCell = (sh) => { sh.uniforms.uCell = cell; return 'uniform vec4 uCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uCell.xy + uv * uCell.zw;'); };
  const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: .5, fog: true });   // unlit: syncChar sets its colour each frame from charLight
  // a thin dark outline drawn into the transparent texel next to an opaque one, so the render holds its own against the 3D scene
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTexel = { value: new THREE.Vector2(1.67 / SHEET_W, 1.67 / SHEET_H) };   // ~1 screen px of outline at the size they're drawn
    sh.vertexShader = 'varying vec2 vLocal;\n' + useCell(sh).replace('#include <uv_vertex>', '#include <uv_vertex>\nvLocal = uv;');
    sh.fragmentShader = 'uniform vec2 uTexel;\nvarying vec2 vLocal;\n' + sh.fragmentShader.replace('#include <map_fragment>', `vec4 sc = texture2D(map, vUv);
      float nb = max(max(texture2D(map, vUv + vec2(uTexel.x, 0.)).a, texture2D(map, vUv - vec2(uTexel.x, 0.)).a), max(texture2D(map, vUv + vec2(0., uTexel.y)).a, texture2D(map, vUv - vec2(0., uTexel.y)).a));
      if (sc.a < .5 && nb >= .5) sc = vec4(.2, .13, .1, 1.);
      sc.rgb *= mix(.88, 1., smoothstep(0., .3, vLocal.y));   // contact occlusion: a little darker toward the ground
      diffuseColor *= sc;`);
  };
  const mesh = new THREE.Mesh(spriteGeo, mat); mesh.castShadow = true; mesh.scale.setScalar(CHAR_SCALE);
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5 });
  mesh.customDepthMaterial.onBeforeCompile = (sh) => { sh.vertexShader = useCell(sh); };
  const g = new THREE.Group(), tilt = new THREE.Group(); g.userData.dyn = true; tilt.rotation.x = .28; tilt.add(mesh); g.add(tilt);
  const sh = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: TX.blob, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .025; sh.scale.setScalar(CHAR_SCALE * 1.5); sh.material.opacity = .9; g.add(sh);
  scene.add(g);
  Object.assign(c, { name, g, mesh, cell, zone: opt.zone || 'lobby', wait: 0, target: null, stuck: 0, fx: { sx: 1, sy: 1, by: 0 } });
  c.tag = document.createElement('div'); c.tag.className = 'tag' + (opt.me ? ' me' : ''); c.tag.textContent = name; tagsEl.appendChild(c.tag);
  c.bubble = null;
  chars.push(c); return c;
}
function stepChar(c, dt) {
  const px = c.x, pz = c.y; c.update(dt);
  if (blocked(c.x, c.y)) {
    const nx = c.x, nz = c.y;
    c.x = nx; c.y = pz;
    if (blocked(c.x, c.y)) { c.x = px; c.y = nz; if (blocked(c.x, c.y)) { c.x = px; c.y = pz; return false; } }
  }
  return true;
}
// squash and stretch: jump the mesh's scale (and a small lift) to a pose, then ease it home with an overshoot. Feet stay planted: the mesh's origin is at the feet.
// One tween per character (tween() replaces the one in flight), so rapid starts and stops never stack.
function charPulse(c, sx, sy, by, ms) {
  if (REDUCED_MOTION) return;
  Object.assign(c.fx, { sx, sy, by });
  tween(c.fx, { sx: 1, sy: 1, by: 0 }, ms, { ease: 'outBack(2.4)' });
}
function syncChar(c) {
  const f = c.frame();
  lightChar(c);
  c.cell.value.set(f.col * CW / SHEET_W, 1 - (f.row + 1) * CH / SHEET_H, CW / SHEET_W, CH / SHEET_H);
  c.g.position.set(c.x, 0, c.y);
  // a little life: lean into the direction of travel, breathe when still, squash on the beat of each step
  const vx = c.x - (c.px ?? c.x), vz = c.y - (c.py ?? c.y); c.px = c.x; c.py = c.y;
  const lean = c.leanX = (c.leanX || 0) + (Math.max(-1, Math.min(1, vx * 40)) - (c.leanX || 0)) * .2, fwd = c.leanZ = (c.leanZ || 0) + (Math.max(-1, Math.min(1, vz * 40)) - (c.leanZ || 0)) * .2;
  const beat = c.moving ? Math.abs(Math.sin(f.col / 11 * Math.PI * 2)) : Math.sin(performance.now() / 700) * .5;
  c.mesh.rotation.z = -lean * .07; c.mesh.rotation.x = fwd * .06;
  // start: a squat and a small push up; stop: a stretch settling down; landing (the sprite's hop or the bridge's own jump coming back to ground): a wide squash
  const air = (c.noLift ? 0 : f.lift * .6 * SPU) + (c.alt || 0);
  if (c.wasMoving !== undefined && c.moving !== c.wasMoving) c.moving ? charPulse(c, 1.06, .9, .045, 260) : charPulse(c, .95, 1.06, 0, 320);
  if (c.prevAir > .01 && Math.abs(air) < .001) charPulse(c, 1.12, .85, 0, 300);
  c.wasMoving = c.moving; c.prevAir = air;
  c.mesh.scale.set(CHAR_SCALE * (1 - beat * .008) * c.fx.sx, CHAR_SCALE * (1 + beat * .018) * c.fx.sy, CHAR_SCALE);
  c.mesh.position.y = air + c.fx.by;
}

// ================= NPCs =================
const NPC_NAMES = ['rosa_j', 'chaiwala', 'pixelpriya', 'bobby5', 'sudhanshu', 'gaurav'];   // a name with its own model in CHARS wears it; the rest take turns
const CHATTER = ['anyone tried the Prompt Lab yet?', 'the pond is so calm today', 'brb grabbing chai', 'what\'s a token again? 😅', 'who\'s flying to Pleasanton?', 'meet at the signpost!', 'gg everyone', 'who\'s doing the quiz later?', 'I named my koi Claude'];
const NPC_TALK = {
  rosa_j: ['Hey! First day in TokenFall?', 'Tip: a model reads text in little pieces called tokens. That\'s where the name comes from!'],
  chaiwala: ['Chai? No? More for me.', 'I heard the Prompt Lab teaches you to ask models better questions.'],
  pixelpriya: ['I\'m trying to visit all three areas today.', 'Pune is my favourite. The Calfus office is there.'],
  bobby5: ['brb, afk', '...oh, you\'re still here. Did you read the notice board?'],
  gaurav: ['जहाँ चाह, वहाँ राह। Where there\'s a will, there\'s a way.', 'बूँद-बूँद से घड़ा भरता है. Drop by drop the pot fills, and so does a model, one token at a time.', 'Tip: if a model\'s answer is off, don\'t start over. Tell it what was wrong and ask again.'],
  sudhanshu: ['Aditya! Good to see you in TokenFall.', 'Tip: give a model the context you\'d give a new teammate. It can\'t read your mind, only your prompt.'],
};
let npcs = [];
const CHATTER_OFFICE = ['who booked the Prompt Lab again?', 'chai break in 5?', 'the carrom queen is MINE', 'standup in the Token Room', 'love the marigolds', 'anyone seen my charger?'];
const NPC_BOUNDS = { lobby: [-16, -10.5, 16, 17.5], lab: [-9.6, -317.5, 9.6, -282.3], abz: [-12.2, 286.7, 12, 313.3], pune: [279, -8.5, 336, 9] };
const OFFICE_NPCS = ['rahul.k', 'meera_s', 'devansh'];
Object.assign(NPC_TALK, {
  'rahul.k': ['Welcome to the office!', 'Fair warning: the Prompt Lab meeting room is always booked.'],
  'meera_s': ['The chai machine is by the lounge. Probably.', 'Ask me about tokens. Actually, ask the Token Room.'],
  'devansh': ['I\'m on carrom duty today.', 'Did you see the chandeliers? Nobody knows who picked them, but we love them.'],
  'ananya.r': ['Waiting for the bus. It\'s always "five minutes away".', 'Fun fact: a model has no idea what time it is unless you tell it.'],
  'kabir_m': ['Grabbing misal before standup.', 'I asked an AI for directions once. Confidently wrong. Check its answers!'],
  'sneha.d': ['ABZ is on the 15th floor, the lift is in the lobby.', 'Crescent Bay is the Calfus office, right over there.'],
});
function randomSpot() {
  for (let i = 0; i < 200; i++) { const x = rr(-15, 15), z = rr(-9, 16); if (!blocked(x, z, .6)) return { x, z }; }
  return { x: 0, z: 2 };
}
// NPCs move diagonally first, then straight; check that whole route for obstacles
function routeClear(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.min(Math.abs(dx), Math.abs(dz));
  const mx = x0 + Math.sign(dx) * d, mz = z0 + Math.sign(dz) * d;
  for (const [ax, az, bx, bz] of [[x0, z0, mx, mz], [mx, mz, x1, z1]]) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .25);
    for (let i = 1; i <= n; i++) if (blocked(ax + (bx - ax) * i / n, az + (bz - az) * i / n, .5)) return false;
  }
  return true;
}
function pickTarget(c) {
  for (let i = 0; i < 60; i++) {
    const far = i < 40, a = Math.random() * 6.283, r = far ? 3 + Math.random() * 10 : .8 + Math.random() * 2;
    const x = c.x + Math.cos(a) * r, z = c.y + Math.sin(a) * r;
    const b = NPC_BOUNDS[c.zone];
    if (x > b[0] && x < b[2] && z > b[1] && z < b[3] && routeClear(c.x, c.y, x, z)) return { x, z };
  }
  return null;
}
function npcThink(c, dt) {
  if (c.wait > 0) { c.wait -= dt; c.setInput({ up: false, down: false, left: false, right: false }); return; }
  if (!c.target) { c.target = pickTarget(c); if (!c.target) { c.wait = 500; return; } }
  const dx = c.target.x - c.x, dz = c.target.z - c.y;
  if (Math.hypot(dx, dz) < .35 || c.stuck > 350) { const stuck = c.stuck > 350; c.target = null; c.stuck = 0; c.wait = stuck ? 200 : 1500 + Math.random() * 5000; return; }
  c.setInput({ left: dx < -.2, right: dx > .2, up: dz < -.2, down: dz > .2 });
}
function say(c, text, ms = 4200) {
  if (!c.bubble) { c.bubble = document.createElement('div'); c.bubble.className = 'bubble'; tagsEl.appendChild(c.bubble); }
  c.bubble.textContent = text; c.bubble.style.display = 'block'; c.bubbleT = ms;
  log(c.name, text);
}
