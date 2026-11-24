// TokenFall: sprite characters (hero and NPCs) and NPC wandering.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= characters =================
// every character in js/sprites/chars-data.js shares one cell layout and standing height, so one size rule fits them all: FIG_H is how tall they stand (before CHAR_SCALE).
// Each character has its own atlas (chars-sheet.js) of trimmed, 2.5x upscaled frames: a frame's rect says where it sits in the atlas, its box where its figure sat in the 250x230 cell.
const CW = CHARS.aditya.cell.w, CH = CHARS.aditya.cell.h, FIG_H = 1.6, SPU = FIG_H / CHARS.aditya.standHeight, AX = CHARS.aditya.anchor.x, AY = CHARS.aditya.anchor.y;   // SPU: world units per sprite px
const spriteGeo = new THREE.PlaneGeometry(1, 1);   // a unit quad: the vertex shader stretches it onto the frame's own box in the cell, feet on the origin
const blobGeo = new THREE.PlaneGeometry(1.1, .55);
const CHAR_SCALE = 1.0;   // was 1.1. The card also stands up now (see CHAR_LEAN), so the figure is still ~1.2x taller on screen than it was (1.3 read too big, 1.15 still a touch big)
const CHAR_LEAN = -.25;   // the card leans its top AWAY from the camera, facing its downward look. It was +.28 (toward the camera: facing the ground, ~16% foreshortened, which read as short)
const CHAR_STRETCH = 1.05;   // a touch of extra height, within what the painted face tolerates
const CHAR_TOP = FIG_H * CHAR_SCALE * CHAR_STRETCH * Math.cos(CHAR_LEAN);   // standing head height in metres: the camera look-at and the prompts are measured from it
const PROMPT_Y = CHAR_TOP + .7, PORTAL_Y = CHAR_TOP + .4;   // where the E prompt floats over an interactable / a portal
// the top of a character's head in the world: y, and z (the backward lean pulls it away from the camera). Name tags and bubbles hang from it.
function charHead(c) { const h = FIG_H * (c.shape.head || 1) * c.mesh.scale.y + c.mesh.position.y; return { y: h * Math.cos(CHAR_LEAN) + (c.fy || 0), z: c.y + h * Math.sin(CHAR_LEAN) }; }
// a look that is not a standing figure (Prakrit on his bike, in a 418x385 cell; with a passenger 418x390): its own bend width (half the figure's width, px), head height (in standing heights), the hidden shadow stand-in
// ([sx, sy, sz, x, y, z] ellipsoids, card metres before the scale) and the soft shadow's size. The default is the 250x230 figure.
const BIKE_SHAPE = { bend: 200, head: 1.9, blob: [3.4, 1.5], proxy: [[1.5, .55, .35, 0, .8, .08], [.45, .7, .3, 0, 1.9, .1], [.37, .36, .33, 0, 2.65, .1]] };
const SHAPE = { prakrit: BIKE_SHAPE, ...Object.fromEntries(Object.keys(CHARS).filter((k) => k.startsWith('prakrit_ride_')).map((k) => [k, BIKE_SHAPE])) };   // prakrit_ride_<pick>: the bike with the player riding pillion
const sheetTex = {}, auxTex = {};   // look -> its atlas texture, and its volume map (normal, height, cavity: tools/chars-pack.py); main.js fills both
const chars = [];
const spriteGeoBent = new THREE.PlaneGeometry(1, 1, 8, 1);   // width segments for the cylindrical bend (see the vertex shader)
// the light a sprite stands in (set by Daylight.apply from the scene's ambient + sun; neutral until it runs). charLight is the overall tint and its clamp: never black, never blown out.
// The shading that gives the figure volume is relative to it (see the fragment shader), so a flat-lit pixel looks exactly as it did and the moods stay balanced.
const charLight = { color: new THREE.Color(.62, .62, .62), lamp: .3, min: .55, max: 1.1 };
const cardY = [Math.cos(CHAR_LEAN), -Math.sin(CHAR_LEAN)];   // world-up component of the card's own up and facing directions
// card space: x right, y up the card, z out of it (towards the viewer). A world direction goes in by its dot with the card's three axes.
const toCard = (x, y, z, out) => out.set(x, y * Math.cos(CHAR_LEAN) + z * Math.sin(CHAR_LEAN), -y * Math.sin(CHAR_LEAN) + z * Math.cos(CHAR_LEAN)).normalize();
const TOP_LEFT = new THREE.Vector3(-.5, .62, .6).normalize();   // a fixed key from the top left, blended with the real sun so a figure always has a lit top left and a shaded lower right
const charU = {   // shared by every character's material; charLightsFrame() refreshes them from the scene's live lights
  uSunC: { value: new THREE.Vector3() }, uKey: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() }, uRimCol: { value: new THREE.Color() },
  uCardY: { value: new THREE.Vector2(cardY[0], cardY[1]) }, uP: { value: new THREE.Vector2() }, uBulge: { value: .18 * CHAR_SCALE }, uBend: { value: .09 }, uShadeAmt: { value: .85 },
};
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), lumOf = (c) => c.r * .2126 + c.g * .7152 + c.b * .0722;
function charLightsFrame() {
  toCard(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, _t1); charU.uSunC.value.copy(_t1);
  charU.uKey.value.copy(_t1).multiplyScalar(.5).addScaledVector(TOP_LEFT, .5).normalize();
  // the scene's own lights, scaled the way charLight scales them, so the lamp's share (added per character) stays in proportion
  const gain = lumOf(charLight.color) / Math.max(1e-3, lumOf(hemi.color) * hemi.intensity + lumOf(sun.color) * sun.intensity);
  charU.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity * gain);
  charU.uSky.value.copy(hemi.color).multiplyScalar(hemi.intensity * gain); charU.uGnd.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * gain);
  charU.uRimCol.value.copy(sun.color).multiplyScalar(Math.min(1, sun.intensity) * .3);
  charU.uP.value.set(camera.projectionMatrix.elements[10], camera.projectionMatrix.elements[14]);
}
function lightChar(c) {
  const col = c.mesh.material.color, cl = charLight; col.copy(cl.color);
  let best = 0, lamp = null;
  for (const l of ZONE_LIGHTS[c.zone] || []) {
    const f = 1 - Math.hypot(l.position.x - c.x, l.position.z - c.y) / (l.distance || 9), k = f > 0 ? f * f * l.intensity : 0;
    if (k > best) { best = k; lamp = l; }
  }
  if (lamp) {
    col.r += lamp.color.r * best * cl.lamp, col.g += lamp.color.g * best * cl.lamp, col.b += lamp.color.b * best * cl.lamp;
    toCard(lamp.position.x - c.x, lamp.position.y - 1, lamp.position.z - c.y, c.lampC.value); c.lampCol.value.copy(lamp.color).multiplyScalar(best * cl.lamp);
  } else c.lampCol.value.setScalar(0);
  const L = col.r * .2126 + col.g * .7152 + col.b * .0722;   // luminance clamp, hue kept: never black, never blown out
  if (L < 1e-3) col.setScalar(cl.min); else col.multiplyScalar(Math.min(cl.max, Math.max(cl.min, L)) / L);
}
// the shadow is cast by a hidden stand-in: two ellipsoids (head, body), drawn with no colour and no depth (so invisible) but still rendered into the sun's shadow map. The flat card
// no longer casts: its edge-on silhouette made a thin sliver when the sun was sideways. The stand-in leans and squashes with the card (it is the card's child).
const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }), proxyGeo = new THREE.IcosahedronGeometry(1, 2);
// the soft contact shadow under the feet: the palette's deep plum, not black
const blobTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), p = new THREE.Color(PAL.plum), rgb = [p.r, p.g, p.b].map((v) => Math.round(v * 255)).join(',');
  gr.addColorStop(0, `rgba(${rgb},.9)`); gr.addColorStop(.5, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const tagsEl = document.getElementById('tags');
let npcLooks = 0;   // NPCs without a model of their own take turns: Aditya, Sudhanshu, Aditya...
function makeChar(name, x, z, opt = {}) {
  const look = opt.look || (opt.me ? 'aditya' : ['aditya', 'sudhanshu'][npcLooks++ % 2]);
  const CH = CHARS[look].cell.h, AX = CHARS[look].anchor.x, AY = CHARS[look].anchor.y, shape = SHAPE[look] || {}, BW = shape.bend || 46;   // this look's cell and anchor (they shadow Aditya's, which the shader below would otherwise bake in)
  const c = new SpriteCharacter(CHARS[look], null, { x, y: z, speed: opt.speed || 3.3, scale: 1, animRef: 3.3 });   // animRef: the hero's walk, which the cycles match; slower NPCs step slower
  // one GPU copy of each atlas for everyone: each character only tells the shader which frame to show (uCell: its rect in the atlas as u, v, width, height; uBox: where its figure sat in the cell)
  const t = sheetTex[look], aux = auxTex[look], atlas = CHARS[look].atlas, cell = { value: new THREE.Vector4() }, box = { value: new THREE.Vector4() }, lampC = { value: new THREE.Vector3(0, 1, 0) }, lampCol = { value: new THREE.Color(0, 0, 0) };
  const useCell = (sh) => {
    sh.uniforms.uCell = cell; sh.uniforms.uBox = box; sh.uniforms.uBend = charU.uBend;
    return 'uniform vec4 uCell, uBox;\nuniform float uBend;\nvarying float vCellY, vBendX, vViewZ;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uCell.xy + uv * uCell.zw;').replace('#include <project_vertex>', '#include <project_vertex>\nvViewZ = -mvPosition.z;').replace('#include <begin_vertex>', `
      vec2 cp = vec2(uBox.x + (position.x + .5) * uBox.z, uBox.y + (.5 - position.y) * uBox.w);   // this vertex in cell px, from the cell's top left
      vCellY = 1. - cp.y / ${CH.toFixed(1)};
      float xn = (cp.x - ${AX.toFixed(1)}) / ${BW.toFixed(1)};   // across the figure: -1 at its left edge, 1 at its right
      vBendX = 2. * uBend * xn / (${BW.toFixed(1)} * ${SPU.toFixed(6)});   // the slope of the bend, for the normal
      vec3 transformed = vec3((cp.x - ${AX.toFixed(1)}) * ${SPU.toFixed(6)}, (${AY.toFixed(1)} - cp.y) * ${SPU.toFixed(6)}, -uBend * xn * xn);   // the card curves away from the viewer toward its edges`);
  };
  const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: .5, fog: true });   // its colour (the charLight tint) is set each frame by lightChar
  // The outline is drawn into the empty texels next to the figure, one SCREEN pixel wide whatever the texture size (the uv step of a pixel, from fwidth), in a darkened copy of the colour it
  // borders mixed with a little of the world's ink, so it reads as the figure's own edge and not a sticker border. The atlas is premultiplied (no fringe when it is filtered): un-premultiplied here.
  // Volume: the volume map's normal (plus the bend's) is lit by the sun, the sky/ground hemisphere and the nearest lamp, then divided by the light on a flat, forward-facing card, so a
  // flat pixel is exactly the old tint and the shading is only the difference: lit on the key side (top left), shaded opposite, hue shifting warm to cool. A rim of sun colour on the sun's
  // edge, and a cavity (under the chin and hair, between arm and body) plus the feet go a little darker. The height pushes each pixel's depth toward the camera, so the ground, the props
  // and the post-process (AO, ink, depth of field) see a body with thickness, not a card.
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMargin = { value: new THREE.Vector2(3 / atlas.w, 3 / atlas.h) };   // never reach further than the empty margin round the figure
    sh.uniforms.uInk = { value: new THREE.Color(PAL.plum) }; sh.uniforms.uAux = { value: aux }; sh.uniforms.uLampC = lampC; sh.uniforms.uLampCol = lampCol;
    for (const k in charU) sh.uniforms[k] = charU[k];
    sh.vertexShader = useCell(sh);
    sh.fragmentShader = `uniform vec2 uMargin, uCardY, uP;
      uniform vec3 uInk, uSunC, uKey, uSunCol, uSky, uGnd, uRimCol, uLampC, uLampCol;
      uniform float uBulge, uShadeAmt;
      uniform sampler2D uAux;
      varying float vCellY, vBendX, vViewZ;
      vec3 cLight(vec3 n) {
        float up = n.y * uCardY.x + n.z * uCardY.y;
        float ws = clamp((dot(n, uKey) + .4) / 1.4, 0., 1.), wl = clamp((dot(n, uLampC) + .4) / 1.4, 0., 1.);
        return mix(uGnd, uSky, up * .5 + .5) + uSunCol * ws + uLampCol * wl + .03;
      }
    ` + sh.fragmentShader.replace('#include <map_fragment>', `vec4 sc = texture2D(map, vUv);
      sc.rgb /= max(sc.a, .004);
      vec2 ow = min(fwidth(vUv) * .9, uMargin);
      vec3 nc = vec3(0.); float nw = 0.;
      for (int i = 0; i < 8; i++) { float an = float(i) * .785398; vec4 s = texture2D(map, vUv + vec2(cos(an), sin(an)) * ow); float k = step(.5, s.a); nc += s.rgb / max(s.a, .004) * k; nw += k; }
      if (sc.a < .5 && nw > 0.) sc = vec4(mix(nc / nw * .45, uInk * .6, .3), 1.);
      vec4 ax = texture2D(uAux, vUv);
      float cHt = ax.b;
      vec3 nl = normalize(vec3((ax.rg - .5) * 2. + vec2(vBendX, 0.), 1.));
      vec3 sh = cLight(nl) / dot(cLight(vec3(0., 0., 1.)), vec3(.2126, .7152, .0722));
      sh = mix(vec3(1.), sh, uShadeAmt);
      float sl = dot(sh, vec3(.2126, .7152, .0722)); sh = mix(vec3(sl), sh, .5); sh *= clamp(sl, .62, 1.3) / max(sl, .001);   // half the warm/cool shift, and never darker or brighter than this, whatever the mood
      float hf = (vCellY - .035) * ${CH.toFixed(1)} / 172.;   // height above the feet, in standing heights
      float ao = mix(.8, 1., smoothstep(0., .1, hf)) * mix(1., ax.a, .45);
      float fr = pow(clamp(1. - nl.z, 0., 1.), 2.2);
      float side = smoothstep(-.3, .7, dot(normalize(nl.xy + 1e-4), normalize(uSunC.xy + 1e-4)));
      float back = .5 + .5 * clamp(.5 - uSunC.z, 0., 1.);   // stronger when the sun is behind the figure
      diffuseColor.rgb = diffuseColor.rgb * sc.rgb * sh * ao + uRimCol * fr * side * back;
      diffuseColor.a *= sc.a;`).replace('#include <fog_fragment>', `#include <fog_fragment>
      float zv = vViewZ - cHt * uBulge;   // view depth, nudged toward the camera by the height
      gl_FragDepth = ((uP.x * -zv + uP.y) / zv) * .5 + .5;`);
  };
  mat.customProgramCacheKey = () => look;   // the cell size and anchor are baked into the shader text, so each look needs its own program (three shares one per onBeforeCompile source otherwise)
  const mesh = new THREE.Mesh(spriteGeoBent, mat); mesh.frustumCulled = false; mesh.scale.setScalar(CHAR_SCALE);   // the unit quad's own bounds mean nothing: the shader places the vertices
  // in card metres (before CHAR_SCALE): a 1.6 m figure, big round head
  for (const [sx, sy, sz, x, y, z] of shape.proxy || [[.26, .58, .2, 0, .56, .08], [.37, .36, .33, 0, 1.24, .1]]) { const m = new THREE.Mesh(proxyGeo, proxyMat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; mesh.add(m); }
  const g = new THREE.Group(), tilt = new THREE.Group(); g.userData.dyn = true; tilt.rotation.x = CHAR_LEAN; tilt.add(mesh); g.add(tilt);
  const sh = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .025, .1); sh.material.opacity = .85; g.add(sh);   // g.children[1]: the bridge toggles it
  scene.add(g);
  Object.assign(c, { name, g, mesh, blob: sh, sizeK: CHARS[look].fit || 1, shape, cell, box, lampC, lampCol, atlas, rects: CHARS[look].rects, zone: opt.zone || 'lobby', wait: 0, target: null, stuck: 0, fx: { sx: 1, sy: 1, by: 0 }, sw: { v: 0 } });
  // a slow sway, an anime.js loop on its own object (so squash and stretch's tween never cancels it); the engine is stepped by the frame loop
  if (!REDUCED_MOTION) anime.animate(c.sw, { v: [-1, 1], duration: 2300 + Math.random() * 1200, ease: 'inOutSine', loop: true, alternate: true });
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
  const rc = c.rects[f.start + f.col];
  c.cell.value.set(rc[0] / c.atlas.w, 1 - (rc[1] + rc[3]) / c.atlas.h, rc[2] / c.atlas.w, rc[3] / c.atlas.h); c.box.value.set(rc[4], rc[5], rc[6], rc[7]);
  c.fy = (c.fy || 0) + (floorAt(c.x, c.y) - (c.fy || 0)) * .4;   // stand on a deck or a step, easing up and down (the shoes were sunk into it)
  c.g.position.set(c.x, c.fy, c.y);
  // a little life: lean into the direction of travel, breathe when still, squash on the beat of each step
  const vx = c.x - (c.px ?? c.x), vz = c.y - (c.py ?? c.y); c.px = c.x; c.py = c.y;
  const lean = c.leanX = (c.leanX || 0) + (Math.max(-1, Math.min(1, vx * 40)) - (c.leanX || 0)) * .2, fwd = c.leanZ = (c.leanZ || 0) + (Math.max(-1, Math.min(1, vz * 40)) - (c.leanZ || 0)) * .2;
  const beat = c.moving ? Math.abs(Math.sin(f.col / 11 * Math.PI * 2)) : Math.sin(performance.now() / 700) * .5;
  c.mesh.rotation.z = -lean * .07 + c.sw.v * (c.moving ? .008 : .02); c.mesh.rotation.x = fwd * .06;
  // start: a squat and a small push up; stop: a stretch settling down; landing (the sprite's hop or the bridge's own jump coming back to ground): a wide squash
  const air = (c.noLift ? 0 : f.lift * .55 * SPU * CHAR_SCALE) + (c.alt || 0);   // the sprite's own hop grows with the figure; the bridge's alt is real metres
  if (c.wasMoving !== undefined && c.moving !== c.wasMoving) c.moving ? charPulse(c, 1.04, .93, .035, 260) : charPulse(c, .97, 1.04, 0, 320);
  if (c.prevAir > .01 && Math.abs(air) < .001) charPulse(c, 1.09, .9, 0, 300);
  c.wasMoving = c.moving; c.prevAir = air;
  const K = CHAR_SCALE * c.sizeK;   // sizeK: a place can scale one character (the Token Brew Kitchen's steep camera once made the hero small); the squash and the blob follow
  c.mesh.scale.set(K * (1 - beat * .008) * c.fx.sx, K * CHAR_STRETCH * (1 + beat * .018) * c.fx.sy, K);
  c.blob.scale.set(K * .95 * (c.shape.blob ? c.shape.blob[0] : 1), K * 1.7 * (c.shape.blob ? c.shape.blob[1] : 1), 1);
  c.mesh.position.y = air + c.fx.by;
}

// ================= NPCs =================
const NPC_NAMES = ['rosa_j', 'chaiwala', 'pixelpriya', 'bobby5', 'sudhanshu', 'gaurav', 'saanvi', 'mehta', 'aarav', 'riya'];   // a name with its own model in CHARS wears it; the rest take turns
const CHATTER = ['anyone tried the Prompt Lab yet?', 'the pond is so calm today', 'brb grabbing chai', 'what\'s a token again? 😅', 'who\'s flying to Pleasanton?', 'meet at the signpost!', 'gg everyone', 'who\'s doing the quiz later?', 'I named my koi Claude'];
const NPC_TALK = {
  rosa_j: ['Hey! First day in TokenFall?', 'Tip: a model reads text in little pieces called tokens. That\'s where the name comes from!'],
  chaiwala: ['Chai? No? More for me.', 'I heard the Prompt Lab teaches you to ask models better questions.'],
  pixelpriya: ['I\'m trying to visit all three areas today.', 'Pune is my favourite. The Calfus office is there.'],
  bobby5: ['brb, afk', '...oh, you\'re still here. Did you read the notice board?'],
  gaurav: ['जहाँ चाह, वहाँ राह। Where there\'s a will, there\'s a way.', 'बूँद-बूँद से घड़ा भरता है. Drop by drop the pot fills, and so does a model, one token at a time.', 'Tip: if a model\'s answer is off, don\'t start over. Tell it what was wrong and ask again.'],
  saanvi: ['Hi! I\'m Saanvi. Ask me anything, then check what I tell you.', 'Tip: tell a model who the answer is for. A tip for a beginner reads very differently from one for an expert.'],
  mehta: ['Good to see a new face. Mind the pond, it\'s deeper than it looks.', 'I\'ve seen many tools come and go. Verify what the model says. That habit never goes out of date.'],
  aarav: ['Hey! Have you tried the Glass Bridge yet? Read the question before you step.', 'Tip: ask for the answer in a format you can use, a list, a table, three lines. Models follow instructions well.'],
  riya: ['Hi there! I\'m trying every minigame today.', 'Tip: break a big ask into small steps. A model does better with one clear job at a time.'],
  sudhanshu: ['Good to see you in TokenFall!','Tip: give a model the context you\'d give a new teammate. It can\'t read your mind, only your prompt.'],
};
let npcs = [];
const CHATTER_OFFICE = ['who booked the Prompt Lab again?', 'chai break in 5?', 'the carrom queen is MINE', 'standup in the Token Room', 'love the marigolds', 'anyone seen my charger?'];
const NPC_BOUNDS = { lobby: [-16, -10.5, 16, 17.5], lab: [-9.6, -317.5, 9.6, -282.3], abz: [-12.2, 286.7, 12, 313.3], pune: [279, -8.5, 336, 9] };
const OFFICE_NPCS = ['rahul.k', 'meera_s', 'devansh'];
Object.assign(NPC_TALK, {
  Murali: ['Good to see you on the floor.', 'Ship small, check often. That is most of the job.'],
  Salim: ['Hello! Settling in?', 'If an answer sounds too sure of itself, ask where it came from.'],
  Amit: ['Ah, the new face. Welcome.', 'My door is always open. Well, the glass one.'],
  Jacintha: ['Hi there! Have you met the team yet?', 'Good questions beat clever prompts every time.'],
  Kartik: ['Morning! Grab a chai, then come find me.', 'Tokens cost money. Short and clear wins.'],
  Arvind: ['Welcome to ABZ. Great view, right?', 'Fifteen floors up, and still the metro is louder than standup.'],
  Rajiv: ['Hey! How is the first week going?', 'Always tell the model what you actually want. It cannot read minds.'],
  Brian: ['Hi! Brian. Good to meet you.', 'Check the facts, then check them again.'],
  Baljeet: ['Oye, welcome! You will like it here.', 'The best demos are the ones that fail in rehearsal.'],
  Rohit: ['Hey, welcome aboard.', 'When in doubt, write it down and ask.'],
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
