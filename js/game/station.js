// TokenFall: the lobby's railway station, where HQ's locked doors used to be, after a country station on the Yorkshire moors: over the arched
// bridge the path climbs two steps onto a stone-flagged platform with flower beds, red lamps and benches, a stone station house with a slate roof
// and a clock that keeps the day's own time, and a red lattice footbridge arching over the line,
// and the Bengaluru Express waits there, steam drifting from its chimney: a steam locomotive and four coaches. Board it (E at the open door) and
// it whistles, shuts its door and pulls away east in great white chuffs, off the island's edge onto a stone viaduct into the clouds, and you step off in the Calfus Bengaluru office (office-blr.js);
// the train back brings you to this platform. The track runs the island's whole width along its north edge and out over the void at both ends.
//   vStation()   from buildVillageLobby (lobby-village.js), in HQ's old place in the build order. It uses up exactly the random draws HQ did,
//                so everything built after it in the lobby is laid out as before.
// The locomotive is assets/models/train-loco.glb (tools/train-pack.mjs, from a CC BY 4.0 model by Nathaniel Onandia: README credits); its
// painted lettering and crests are redrawn with the game's own (stationLettering). Classic script: shares one global scope with the other
// js/game files, loaded after lobby-village.js.

const STATION = {
  z: -50.4,                              // the track's centre line
  rail: .4,                              // the rails' top
  plat: [-31, -48.85, 19, -45.4],        // the platform (x0, z0, x1, z1) and its height: the whole train's length, the station house toward its west end, the footbridge near its east
  top: .5,
  door: 0,                               // x of the coach door you board by (stationBuild sets it: the first coach's open door, by the path from the bridge)
  board: -48.55,                         // where you stand to step in
  k: .0037,                              // the locomotive model's scale (it is drawn in about quarter-centimetres)
};

// the painted metal and stone the station is made of (cached on first use)
const stMat = {};
const stOnce = (k, make) => stMat[k] || (stMat[k] = make());

// The locomotive's lettering texture, redrawn: the model came painted for a school railway in a story. Its layout is kept (every piece where the
// model's UVs expect it, upside down like the original) and each piece is repainted: TOKENFALL on the tender's plates, the train's own name on the
// smokebox headboard and the splasher nameplate, a coin roundel for the crests. Lining stripes, the shed plate and the number are kept as drawn.
function stationLettering(img) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.drawImage(img, 0, 0, 1024, 1024);
  const GOLD = '#c99a52', INK = '#2f2430', serif = 'bold 60px Georgia, "Times New Roman", serif';
  const flip = (cx, cy, fn) => { g.save(); g.translate(cx, cy); g.scale(1, -1); fn(); g.restore(); };   // the texture is stored upside down
  const clear = (x0, y0, x1, y1) => g.clearRect(x0, y0, x1 - x0, y1 - y0);
  const fit = (text, w, px) => { let s = px; g.font = serif.replace('60', s); while (s > 10 && g.measureText(text).width > w) g.font = serif.replace('60', --s); };
  const plate = (x0, y0, x1, y1, text) => {   // a gold-framed plate with raised letters
    clear(x0, y0, x1, y1); g.lineWidth = 7; g.strokeStyle = GOLD; g.strokeRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
    flip((x0 + x1) / 2, (y0 + y1) / 2, () => { fit(text, x1 - x0 - 50, 52); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = GOLD; g.fillText(text, 0, 2); });
  };
  const arc = (cx, cy, R, text, px, spread) => {   // letters along an arc whose middle is highest, each one flipped like the original's
    g.font = serif.replace('60', px); const n = text.length;
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * spread; g.save(); g.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); g.rotate(a); g.scale(1, -1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = GOLD; g.fillText(text[i], 0, 0); g.restore(); }
  };
  const coin = (cx, cy, r) => {   // the TokenFall coin: gold, a ring, a T
    const rg = g.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); rg.addColorStop(0, '#f6dc8a'); rg.addColorStop(1, '#c58f3e');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.lineWidth = r * .08; g.strokeStyle = '#9a6a2c'; g.beginPath(); g.arc(cx, cy, r * .8, 0, 7); g.stroke();
    flip(cx, cy, () => { g.font = `bold ${Math.round(r * 1.05)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a4f22'; g.fillText('T', 0, r * .06); });
  };
  // the roundel on the smokebox door: a black rim, a gold ring, cream, the coin
  clear(44, 44, 452, 452); g.fillStyle = INK; g.beginPath(); g.arc(248, 248, 196, 0, 7); g.fill(); g.fillStyle = GOLD; g.beginPath(); g.arc(248, 248, 186, 0, 7); g.fill();
  g.fillStyle = '#f6ecd9'; g.beginPath(); g.arc(248, 248, 170, 0, 7); g.fill(); coin(248, 248, 112);
  arc(248, 248 + 236 - 170, 236 - 60, 'TOKENFALL', 34, .19);
  plate(552, 152, 992, 224, 'TOKENFALL');          // the tender's upper plate (the lower one already says RAILWAYS)
  clear(308, 564, 460, 740); coin(384, 652, 62);    // the small crest
  clear(36, 796, 444, 924); arc(240, 1010, 175, 'BENGALURU', 40, .155); arc(240, 1010, 125, 'EXPRESS', 30, .16);   // the headboard
  clear(508, 796, 996, 924); arc(752, 1060, 235, 'TOKENFALL HALL', 38, .1);   // the nameplate on the splasher
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.anisotropy = 8; return t;
}

// The sky in the paint. Nothing in the lobby has an environment map, so polished metal mirrors nothing and comes out black, and gloss paint shows
// no sheen. stGloss gives a material a cheap one: its reflection is the hemisphere light's two colours, the sky's above the horizon and the
// ground's below, blurred by the surface's roughness. daylight.js sets those colours every hour, so a boiler shines pale blue at noon, peach at
// sunrise, amber at sunset and moonlit at night. lift: a colour added to the material's own, to bring a texture's blacks off black; rough: the least
// roughness it may have (a texture's mirror-smooth patches would flare white in a low sun or under the moon).
// After dark the platform lamps light the train too: a warm wash on its paint wherever one stands near (ST_LAMPS: where the lanterns hang, their
// colour, and how strongly they shine, which follows the hour's lamps). The lobby keeps its count of real lights, so this is done in the paint.
// Every material shares the one compile function, so they share one shader program, each with its own uniforms (the lamps' shared by all).
const ST_LAMPS = { pos: { value: [] }, k: { value: 0 }, col: { value: new THREE.Color(0xffc68c) }, N: 8 };
function stGlossCompile(sh) {
  const o = this.userData.gloss;
  sh.uniforms.uLift = { value: o.lift }; sh.uniforms.uGloss = { value: o.gloss }; sh.uniforms.uRough = { value: o.rough };
  sh.uniforms.uLamp = ST_LAMPS.pos; sh.uniforms.uLampK = ST_LAMPS.k; sh.uniforms.uLampCol = ST_LAMPS.col;   // shared: one update lights every material
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec3 uLift, uLampCol, uLamp[ ${ST_LAMPS.N} ]; uniform float uGloss, uLampK, uRough;\nvoid main() {`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = max( roughnessFactor, uRough );')
    .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb += uLift;')
    .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
  #if defined( RE_IndirectSpecular ) && NUM_HEMI_LIGHTS > 0
  { vec3 rv = reflect( -geometry.viewDir, geometry.normal );
    float up = dot( rv, hemisphereLights[ 0 ].direction ), w = .1 + .8 * material.specularRoughness;
    radiance += uGloss * mix( hemisphereLights[ 0 ].groundColor, hemisphereLights[ 0 ].skyColor, smoothstep( -w, w, up ) ); }
  #endif
  if ( uLampK > 0. ) {
    vec3 lamps = vec3( 0. );
    for ( int i = 0; i < ${ST_LAMPS.N}; i ++ ) {
      vec3 d = ( viewMatrix * vec4( uLamp[ i ], 1. ) ).xyz - geometry.position; float r = length( d ), a = max( 1. - r / 7.5, 0. );
      lamps += a * a * ( .25 + .75 * max( dot( geometry.normal, d / r ), 0. ) );
    }
    reflectedLight.directDiffuse += material.diffuseColor * uLampCol * lamps * uLampK;
  }`);
}
function stGloss(mat, gloss = 1, lift = 0x000000, rough = 0) {
  mat.userData.gloss = { gloss, lift: new THREE.Color(lift), rough }; mat.onBeforeCompile = stGlossCompile; mat.needsUpdate = true;
  return mat;
}

// The locomotive's materials, made at home here. Its textures are painted colours, used as painted like every model in this world (buildings.js,
// airport-assets.js: the scene is drawn without sRGB decoding, so a texture marked sRGB comes out several times darker), and its glTF colour factors,
// which are linear, come back to the same space. Then its paint, to the palette (palette.js: nothing darker than plum): the deep maroon of its
// body brought up to the coaches' crimson, its black paint lifted to a soft plum charcoal and made gloss paint rather than metal (its texture
// marks most of it metallic), the insides of the cab and chimney deep but not a hole into nothing. Brass, steel and glass keep their polish,
// and everything mirrors the sky (stGloss).
//   gain: multiplies the texture (per channel, or one for all); lift: added to it, rough: least roughness (stGloss); metal: metalness; color: replaces the colour
const LOCO_PAINT = {
  material: { gain: [1.96, 1.88, 1.76] },          // the boiler, cab and tender: the texture's maroon (about #491919) to the coaches' #8f2f2c
  Black: { gain: 1.2, lift: 0x2a2530, metal: .2, rough: .38 },   // the smokebox, chimney, frames and cab roof (about #1b1a19): a plum charcoal, satin
  Coal: { gain: 1.1, lift: 0x221e25 },
  Blackout: { color: 0x2c2230 },
  Grey: { gain: 1.3, rough: .3 },                  // the rods and motion: polished steel
};
function stationLocoLook(mat) {
  for (const k of ['map', 'emissiveMap']) if (mat[k]) { mat[k].encoding = THREE.LinearEncoding; mat[k].needsUpdate = true; }
  mat.color.convertLinearToSRGB(); if (mat.emissive) mat.emissive.convertLinearToSRGB();
  const p = LOCO_PAINT[mat.name] || {}, g = [].concat(p.gain || 1);
  if (p.color != null) mat.color.set(p.color);
  mat.color.r *= g[0]; mat.color.g *= g[1] ?? g[0]; mat.color.b *= g[2] ?? g[0];
  if (p.metal != null) mat.metalness = p.metal;
  return stGloss(mat, 1, p.lift || 0, p.rough || 0);
}

// a coach side: maroon panels in gold lining, a row of compartment doors and windows (warm inside at night), TOKENFALL RAILWAYS along the foot.
// door: which of the six doors stands open, or -1 for none
function stationCoachSide(door) {
  const W = 1024, H = 288, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H; const eg = e.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  g.fillStyle = '#8f2f2c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#7a2624'; for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);   // faint panel grain
  g.strokeStyle = '#d4a85a'; g.lineWidth = 3; for (const y of [26, 196]) { g.beginPath(); g.moveTo(8, y); g.lineTo(W - 8, y); g.stroke(); }
  const n = 6, step = W / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * step, dx = x0 + step * .08, wx = x0 + step * .4, open = i === door;
    // the door: a framed panel with a drop light and a brass handle (an open one shows the warm inside)
    g.strokeStyle = '#d4a85a'; g.lineWidth = 3; g.strokeRect(dx, 34, step * .26, 236);
    g.fillStyle = open ? '#3a2a24' : '#5d6f78'; g.fillRect(dx + 8, 46, step * .26 - 16, 78); eg.fillStyle = open ? '#ffcf8a' : '#ffd9a0'; eg.fillRect(dx + 8, 46, step * .26 - 16, 78);
    if (open) { g.fillStyle = '#4a3326'; g.fillRect(dx + 4, 128, step * .26 - 8, 138); eg.fillStyle = '#b08050'; eg.fillRect(dx + 4, 128, step * .26 - 8, 138); }
    g.fillStyle = '#e3c070'; g.fillRect(dx + step * .26 - 18, 150, 8, 22);
    // the compartment window: a big pane with rounded top corners
    g.fillStyle = '#e8dcc4'; g.fillRect(wx - 6, 40, step * .5 + 12, 96);
    g.fillStyle = '#566a75'; g.fillRect(wx, 46, step * .5, 84); eg.fillStyle = '#ffd9a0'; eg.fillRect(wx, 46, step * .5, 84);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(wx + 6, 50, step * .12, 76);
  }
  g.font = 'bold 22px Georgia, serif'; g.fillStyle = '#d4a85a'; g.textAlign = 'center'; g.fillText('T O K E N F A L L   R A I L W A Y S', W / 2, 232);
  const t = new THREE.CanvasTexture(c), et = new THREE.CanvasTexture(e); t.anisotropy = et.anisotropy = 8;
  return { map: t, emissiveMap: et };
}

function stationBuild() {
  const { z: Z, rail: RAIL, plat: [px0, pz0, px1, pz1], top: TOP } = STATION, zc = (pz0 + pz1) / 2;
  const stone = stOnce('stone', () => stoneRoundMaterial({ c: [0, 0], n: 0 }));
  const steel = stOnce('steel', () => new THREE.MeshStandardMaterial({ color: 0xa3a8b0, roughness: .35, metalness: .5 }));
  let r = 901; const rng = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const ballast = stOnce('ballast', () => std(canvasTex(96, 96, (g) => { g.fillStyle = '#9c9488'; g.fillRect(0, 0, 96, 96); for (let i = 0; i < 1400; i++) { g.fillStyle = ['#8a8277', '#b1a99c', '#776f66', '#a59c8e'][i % 4]; g.fillRect(rng() * 96 | 0, rng() * 96 | 0, 2 + (rng() * 2 | 0), 2); } }, { keep: true }), 1.2, { roughness: 1 }));

  // ---- the track: ballast, sleepers and rails across the island and out over the void at both ends ----
  const TX0 = -96, TX1 = 96;
  box(TX1 - TX0, .14, 3, ballast, 0, 0, Z, { cast: false });
  { const n = Math.round((TX1 - TX0) / .66), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .12, 2.5), MAT.darkWood, n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(TX0 + (i + .5) * .66, .2, Z); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); }
    sl.castShadow = sl.receiveShadow = true; scene.add(sl); }
  for (const s of [-1, 1]) box(TX1 - TX0, .14, .08, steel, 0, .26, Z + s * .72, { cast: false });
  // the viaducts: a stone deck on arches and piers dropping into the cloud sea, a low parapet each side (the Glenfinnan sort, through a picture book)
  for (const side of [-1, 1]) {
    const a = 53.1, b = 96, len = b - a, cx = side * (a + b) / 2;
    box(len, .7, 3.6, stone, cx, -.7, Z);
    for (const s of [-1, 1]) box(len, .45, .28, stone, cx, 0, Z + s * 1.66);
    for (let x = a + 2.6; x < b; x += 6) {
      box(1.1, 26, 3.2, stone, side * x, -26.7, Z);
      if (x + 6 < b) { const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 3.2, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), stone); arch.position.set(side * (x + 3), -3.15, Z); arch.material.side = THREE.DoubleSide; add(arch); }
    }
  }

  // ---- the platform: big stone flags with a coping edge and a white line, two steps up from the path ----
  const pcx = (px0 + px1) / 2;
  const flags = stOnce('flags', () => std(canvasTex(128, 128, (g) => {
    g.fillStyle = '#a49c8e'; g.fillRect(0, 0, 128, 128);
    for (const [x, y, w, h] of [[0, 0, 70, 42], [70, 0, 58, 42], [0, 42, 44, 44], [44, 42, 84, 44], [0, 86, 86, 42], [86, 86, 42, 42]]) {
      const v = 176 + (rng() * 22 | 0); g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rng() < .5 ? '90,80,70' : '250,245,235'},.12)`; g.fillRect(x + 2 + rng() * (w - 6), y + 2 + rng() * (h - 6), 2, 2); }
    }
  }, { keep: true }), 2.6, { roughness: .95 }));
  box(px1 - px0, TOP, pz1 - pz0, flags, pcx, 0, zc);   // box() records it as a floor people stand on
  box(px1 - px0, .07, .36, stone, pcx, TOP - .02, pz0 + .18);
  box(px1 - px0 - .2, .012, .1, stOnce('whiteLine', () => new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: .7 })), pcx, TOP + .052, pz0 + .52, { cast: false });
  for (const [h, z] of [[.34, pz1 + .17], [.17, pz1 + .52]]) { box(5, h, .35, stone, 0, 0, z); FLOORS.push([-2.5, z - .175, 2.5, z + .175, h]); }
  WALK.push([px0 + .1, pz0 + .15, px1 - .1, -47.4]);
  contact(pcx, zc, (px1 - px0) / 2 + .2, (pz1 - pz0) / 2 + .2);

  // the painted iron of the footbridge, lamps and benches: a deep railway red (Goathland's), and a lattice of it cut through
  const red = stOnce('red', () => new THREE.MeshStandardMaterial({ color: 0xb8473f, roughness: .5 }));
  const lattice = stOnce('lattice', () => { const t = canvasTex(128, 64, (g) => {
    g.clearRect(0, 0, 128, 64); g.strokeStyle = '#b8473f'; g.lineWidth = 5; g.strokeRect(2, 2, 124, 60);
    g.lineWidth = 3.5; for (let x = 0; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 32, 60); g.moveTo(x + 32, 4); g.lineTo(x, 60); g.stroke(); }
    g.lineWidth = 4; for (let x = 32; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x, 62); g.stroke(); }
  }, { keep: true, smooth: true }); return new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .5 }); });
  // a lattice panel between four corners (a parallelogram for a stair's side), tiled a pattern per metre or so
  const panel = (a, b, c, d) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), hgt = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len / 1.4, 0, len / 1.4, hgt / .9, 0, hgt / .9], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const m = new THREE.Mesh(g, lattice); m.castShadow = true; add(m); return m;
  };

  // ---- the station house at the platform's west end: Yorkshire stone, a slate roof, two chimneys, white windows, a clock over the door ----
  { const x0 = -20.6, x1 = -13.6, z0 = pz1, z1 = pz1 + 4.4, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 3.7, ridgeY = H + 1.5;
    const wall = stOnce('houseStone', () => std(canvasTex(128, 128, (g) => {
      g.fillStyle = '#9a8d78'; g.fillRect(0, 0, 128, 128);
      for (let y = 0, row = 0; y < 128; y += 16, row++) for (let x = -(row % 2) * 13; x < 128; x += 26) { const v = 190 + (rng() * 30 | 0); g.fillStyle = `rgb(${v},${v - 12},${v - 30})`; g.fillRect(x + 1, y + 1, 24 - (rng() * 4 | 0), 14); }
    }, { keep: true }), 1.5, { roughness: 1 }));
    const slate = stOnce('slate', () => std(canvasTex(64, 64, (g) => { g.fillStyle = '#5f5a6c'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) for (let x = -(y / 8 % 2) * 6; x < 64; x += 12) { g.fillStyle = ['#6b6578', '#585365', '#726c80'][(x + y) % 3 | 0]; g.fillRect(x + 1, y + 1, 10, 6); } }, { keep: true }), .9, { roughness: .8 }));
    const white = stOnce('frame', () => new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: .6 }));
    box(x1 - x0, H, z1 - z0, wall, cx, 0, cz);
    for (const s of [-1, 1]) {   // the roof: two slate slopes meeting at a ridge along the house, overhanging all round
      const run = (z1 - z0) / 2 + .35, slope = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + .7, .12, Math.hypot(run, ridgeY - H) + .05), slate);
      slope.position.set(cx, (H + ridgeY) / 2 + .04, cz + s * run / 2); slope.rotation.x = s * Math.atan2(ridgeY - H, run); add(slope);
    }
    for (const s of [-1, 1]) { const gable = new THREE.Mesh(new THREE.BufferGeometry(), wall); gable.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, H, z0 - cz, 0, H, z1 - cz, 0, ridgeY, 0], 3)); gable.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 3, 0, 1.5, 1.2], 2)); gable.geometry.computeVertexNormals(); gable.material.side = THREE.DoubleSide; gable.position.set(s > 0 ? x1 : x0, 0, cz); add(gable); }
    box(x1 - x0 + .76, .14, .14, stone, cx, ridgeY + .02, cz);
    for (const x of [x0 + .9, x1 - .9]) { box(.7, 1.7, .9, wall, x, ridgeY - .9, cz); box(.8, .12, 1, stone, x, ridgeY + .8, cz); for (const dz of [-.18, .18]) { const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .35, 12), stOnce('pot', () => new THREE.MeshStandardMaterial({ color: 0xc47a55, roughness: .8 })))); pot.position.set(x, ridgeY + 1.1, cz + dz); } }
    const win = (wx, wz, face, y0 = 0) => {   // a white-framed sash window on a stone sill, warm inside after dark
      const g = new THREE.Group(); g.position.set(wx, y0, wz); g.rotation.y = face; scene.add(g);
      box(1.1, 1.4, .08, white, 0, .95, .02, { p: g }); box(.9, 1.2, .06, MAT.glassLit, 0, 1.05, .05, { p: g, cast: false }); box(.94, .06, .08, white, 0, 1.62, .08, { p: g }); box(.06, 1.2, .08, white, 0, 1.05, .08, { p: g }); box(1.25, .1, .2, stone, 0, .88, .08, { p: g });
    };
    // the front, on the platform: a red door under a little canopy, a window each side, the clock above
    win(cx - 2.1, z0 - .04, Math.PI, TOP); win(cx + 2.1, z0 - .04, Math.PI, TOP);
    box(1.1, 2.15, .1, red, cx, TOP, z0 - .04); box(1.3, .12, .14, white, cx, TOP + 2.15, z0 - .05); box(.07, .07, .09, stOnce('brass', () => new THREE.MeshStandardMaterial({ color: 0xd9b56a, roughness: .35, metalness: .4 })), cx + .38, TOP + 1.05, z0 - .1);
    box(2.6, .1, 1.2, slate, cx, TOP + 2.4, z0 - .6); for (const s of [-1, 1]) box(.07, .07, 1.1, red, cx + s * 1.2, TOP + 2.3, z0 - .58);
    // the back and the ends, so it looks lived in from the bridge too
    for (const dx of [-2.3, 0, 2.3]) win(cx + dx, z1 + .04, 0);
    for (const s of [-1, 1]) win(s > 0 ? x1 + .04 : x0 - .04, cz, s * Math.PI / 2);
    colBox(x0 - .1, z0 - .1, x1 + .1, z1 + .1); contact(cx, cz, (x1 - x0) / 2 + .5, (z1 - z0) / 2 + .5);
    INTER.push({ x: cx - 2.1, z: z0 - 1.1, r: 1.4, label: 'Booking office', verb: 'Ask', act: () => talk('Booking office', ['One to Bengaluru? No ticket needed for Calfus folk: just hop on at the open door.', 'The stationmaster taps the timetable: "On time. As always. We are a very well-trained railway."']) });
    // the clock over the door, its hands on the day's own hour (daylight.js)
    const face = stOnce('clockFace', () => std(canvasTex(128, 128, (g) => {
      g.fillStyle = PAL.cream; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = PAL.plum; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 59, 0, 7); g.stroke();
      g.fillStyle = PAL.plum; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.translate(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.rotate(a); g.fillRect(-2, -5, 4, i % 3 ? 7 : 12); g.restore(); }
    }, { keep: true, smooth: true }), 0, { roughness: .6 }));
    const cg = new THREE.Group(); cg.position.set(cx, TOP + 2.85, z0 - .12); cg.rotation.y = Math.PI; cg.userData.dyn = true; scene.add(cg);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .1, 32).rotateX(Math.PI / 2), red); rim.castShadow = true; cg.add(rim);
    const f = new THREE.Mesh(new THREE.CircleGeometry(.32, 32), face); f.position.z = .052; cg.add(f);
    const hands = [];
    for (const [len, w] of [[.18, .032], [.27, .02]]) { const h = new THREE.Group(); h.position.z = .06; const bar = new THREE.Mesh(new THREE.BoxGeometry(w, len, .01), MAT.metal); bar.position.y = len / 2 - .03; h.add(bar); cg.add(h); hands.push([h, len > .2]); }
    anim.push(() => { const d = window.TokenFall && TokenFall.daylight, hr = d ? d.state.hour : 14; for (const [h, minute] of hands) h.rotation.z = -(minute ? (hr % 1) : (hr % 12) / 12) * Math.PI * 2; });
    // greenery round the house
    for (const [tx, tz, ts] of [[x0 - 2.2, z1 - 1, 1.1], [x1 + 1.6, z1 + 1.4, .9]]) tree(tx, tz, ts, MAT.leafB);
    for (const [bx, bz] of [[x0 + 1, z1 + .9], [cx, z1 + 1], [x1 - .6, z1 + .9]]) bush(bx, bz, .9, MAT.leafA);
  }

  // ---- the footbridge: a red lattice span arching over the line on iron columns, a stair down to the platform and one down the far side ----
  const FX0 = 8.9, FX1 = 10.3, FY = 5.3, fs = pz1 - 1.15, fn = -52.95, fbx = (FX0 + FX1) / 2, dz0 = pz1 - .05, dz1 = fn - .1;   // deck x, height; the stairs' top ends; the deck's ends
  { box(FX1 - FX0, .14, dz0 - dz1, red, fbx, FY - .14, (dz0 + dz1) / 2);   // the deck, from landing to landing
    // lattice sides, open where each stair comes up (the platform's on the east side at the south end, the far side's on the west at the north end); the ends closed
    panel([FX1, FY, fs - .05], [FX1, FY, dz1], [FX1, FY + 1.1, dz1], [FX1, FY + 1.1, fs - .05]);
    panel([FX0, FY, dz0], [FX0, FY, fn + 1.1], [FX0, FY + 1.1, fn + 1.1], [FX0, FY + 1.1, dz0]);
    for (const z of [dz0, dz1]) panel([FX0, FY, z], [FX1, FY, z], [FX1, FY + 1.1, z], [FX0, FY + 1.1, z]);
    for (const [x, za, zb] of [[FX1, fs - .05, dz1], [FX0, dz0, fn + 1.1]]) box(.09, .08, za - zb, red, x, FY + 1.08, (za + zb) / 2);   // handrails
    for (const x of [FX0, FX1]) {
      // the arch under the span: a red band over the line, centred on the track, springing from iron columns on the platform's edge and the far side
      const za = STATION.z + 1.7, zb = STATION.z - 1.7, R = (za - zb) / 2, czA = STATION.z, yC = FY - .25 - R, sh = new THREE.Shape();
      sh.absarc(0, 0, R, 0, Math.PI, false); sh.absarc(0, 0, R - .22, Math.PI, 0, true);
      const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: false, curveSegments: 24 }), red); arch.rotation.y = Math.PI / 2; arch.position.set(x - .05, yC, czA); arch.castShadow = true; add(arch);
      for (const z of [za, zb]) { post(.09, yC + .02 - (z === za ? TOP : 0), red, x, z === za ? TOP : 0, z, .08); colCirc(x, z, .15); }
    }
    // the stairs: treads between red stringers, lattice sides, a handrail each side
    const stair = (xTop, xBot, z0s, z1s, yTop, yBot) => {
      const n = Math.round((yTop - yBot) / .17), dir = Math.sign(xBot - xTop), run = Math.abs(xBot - xTop) / n, w = z1s - z0s;
      for (let i = 0; i < n; i++) box(run + .04, .06, w - .12, MAT.wood, xTop + dir * (i + .5) * run, yTop - (i + 1) * (yTop - yBot) / n - .06, (z0s + z1s) / 2);
      for (const z of [z0s, z1s]) {
        panel([xTop, yTop, z], [xBot, yBot, z], [xBot, yBot + 1, z], [xTop, yTop + 1, z]);
        const len = Math.hypot(xBot - xTop, yTop - yBot), sg = new THREE.Mesh(new THREE.BoxGeometry(len, .22, .08), red); sg.position.set((xTop + xBot) / 2, (yTop + yBot) / 2 - .08, z); sg.rotation.z = Math.atan2(yBot - yTop, xBot - xTop); add(sg);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(len, .07, .09), red); hr.position.set((xTop + xBot) / 2, (yTop + yBot) / 2 + 1, z); hr.rotation.z = sg.rotation.z; add(hr);
      }
    };
    stair(FX1, FX1 + 6.4, pz1 - 1.15, pz1 - .05, FY, TOP);   // down to the platform, eastward along its back
    stair(FX0, FX0 - 6.4, fn - .05, fn + 1.05, FY, .1);       // and down the far side, westward
    colBox(FX1 - .05, pz1 - 1.25, FX1 + 6.5, pz1 + .05); contact(FX1 + 3.2, pz1 - .6, 3.4, .7, 0, TOP);
    INTER.push({ x: FX1 + 6.9, z: pz1 - 1.6, r: 1.4, label: 'Footbridge', verb: 'Look', act: () => talk('Footbridge', ['The footbridge over the line, freshly painted. A sign says the far side is for railway staff and seagulls only.', 'From the top you can see the clouds, all the way down.']) });
  }

  // ---- along the back of the platform: flower beds, Victorian lamps, red benches, the departures board, the chai stall, the name boards ----
  const bed = (xa, xb) => {   // a stone-edged bed of greenery and summer flowers
    const w = xb - xa, x = (xa + xb) / 2, z = pz1 - .45;
    box(w, .32, .8, stone, x, TOP, z); box(w - .12, .04, .68, MAT.dirt, x, TOP + .3, z, { cast: false });
    for (let i = 0; i < Math.round(w / .45); i++) { const bx = xa + .25 + i * .45 + (rng() - .5) * .12, m = add(new THREE.Mesh(jitterSphere(.26 + rng() * .1, 1), i % 3 ? MAT.leafA : MAT.leafB)); m.position.set(bx, TOP + .5, z + (rng() - .5) * .25); }
    const fl = [PAL.gold, PAL.butter, PAL.coral, PAL.lilac];
    for (let i = 0; i < Math.round(w / .22); i++) { const b = add(new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), stOnce('fl' + (i % 4), () => new THREE.MeshStandardMaterial({ color: fl[i % 4], roughness: .7 }))), null, false); b.position.set(xa + .12 + i * .22 + (rng() - .5) * .1, TOP + .68 + rng() * .14, z + (rng() - .5) * .5); }
    colBox(xa, z - .42, xb, z + .42);
  };
  bed(-13.3, -5.7); bed(3.1, 4.9); bed(-27.2, -23.2);
  const lamp = (x, z) => {   // a red post, a lantern on top glowing warm
    box(.3, .14, .3, stone, x, TOP, z); post(.07, 2.9, red, x, TOP + .14, z, .055); box(.22, .08, .22, red, x, TOP + 3, z);
    box(.3, .42, .3, stOnce('lanternFrame', () => new THREE.MeshStandardMaterial({ color: PAL.plum, roughness: .6 })), x, TOP + 3.08, z);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(.24, .34, .24), vGlow(V_LED_WARM)); glow.position.set(x, TOP + 3.29, z); glow.userData.dyn = true; scene.add(glow);
    const cap = add(new THREE.Mesh(new THREE.ConeGeometry(.24, .2, 4), red)); cap.position.set(x, TOP + 3.6, z); cap.rotation.y = Math.PI / 4;
    colCirc(x, z, .18); contact(x, z, .35, .35, 0, TOP);
    lampPool(x, pz0 + (z - pz0) * .5, 2.3, .85, TOP, (z - pz0) * .5 + .15);   // its light on the flags after dark, spread forward over the platform (behind the lamp is the lawn, a step down)
    ST_LAMPS.pos.value.push(new THREE.Vector3(x, TOP + 3.29, z));
  };
  for (const x of [-30.2, -21.8, -15, -9.5, -4.6, 4.2, 7.6, 18.3]) lamp(x, pz1 - .25);
  { const L = ST_LAMPS.pos.value; L.length = Math.min(L.length, ST_LAMPS.N); while (L.length < ST_LAMPS.N) L.push(new THREE.Vector3(0, -999, 0)); }   // the shader's lamp list is a fixed size
  pointLight('lobby', 0xffd6a0, 1.5, 12, 0, 3.6, zc);   // in HQ's place: the lobby keeps the same number of lights
  const benchR = (x, z) => {   // red slats on curled red iron ends, facing the line
    for (const dx of [-.78, .78]) { box(.08, .44, .5, red, x + dx, TOP, z); box(.08, .5, .06, red, x + dx, TOP + .44, z + .22); }
    for (let i = 0; i < 4; i++) box(1.7, .05, .1, red, x, TOP + .44, z - .19 + i * .12);
    for (let i = 0; i < 2; i++) box(1.7, .09, .05, red, x, TOP + .62 + i * .16, z + .25);
    colBox(x - .9, z - .32, x + .9, z + .32); contact(x, z, 1, .45, 0, TOP);
  };
  benchR(-29, pz1 - 1.25); benchR(-17.4, pz1 - .95); benchR(-8.2, pz1 - 1.25); benchR(1.6 + 4.4, pz1 - 1.4);
  for (const x of [-25.2, -11.8, 17.6]) {   // TOKENFALL in big letters along it
    for (const s of [-1, 1]) box(.09, 2.3, .09, red, x + s * .95, TOP, pz1 - .2);
    signBoard('TOKENFALL', x, TOP + 2.1, pz1 - .2, 2.3, .6, 0, { size: 28, bg: PAL.cream });
    colBox(x - 1.05, pz1 - .3, x + 1.05, pz1 - .1);
  }
  ledSign(['BENGALURU EXPRESS', 'Platform 1  ·  on time'], '#ffd27a', -4.6, TOP + 1.75, pz1 - .95, 2.4, .62, 0, [384, 96]);
  for (const s of [-1, 1]) box(.07, 1.75, .07, red, -4.6 + s * 1.1, TOP, pz1 - .95);
  colBox(-5.8, pz1 - 1.05, -3.4, pz1 - .85);
  { // the chai stall: a kettle steaming on a counter, glasses lined up
    const x = 6.1, z = pz1 - .55;
    box(1.6, .95, .7, MAT.wood, x, TOP, z); box(1.7, .06, .8, stOnce('cream', () => new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: .8 })), x, TOP + .95, z);
    const k = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, .26, 16), steel)); k.position.set(x - .45, TOP + 1.14, z);
    for (let i = 0; i < 5; i++) { const g2 = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .1, 10), stOnce('chaiGlass', () => new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: .3 }))), null, false); g2.position.set(x - .05 + i * .12, TOP + 1.03, z - .15); }
    signBoard('CHAI', x, TOP + 1.7, z + .28, .9, .3, Math.PI, { size: 18, bg: PAL.peach }); box(.06, .75, .06, red, x, TOP + .98, z + .3);
    colBox(x - .9, z - .45, x + .9, z + .45); contact(x, z, 1, .55, 0, TOP);
    INTER.push({ x, z: z - 1.2, r: 1.4, label: 'Chai stall', verb: 'Order', act: () => talk('Chai stall', ['"Chai! Garam chai!" One cutting, in a little glass, ₹10.', 'For the journey: the chaiwala says Bengaluru will try to sell you filter coffee. Stay strong.']) });
  }
  // the lawn round the platform: a few trees and bushes, as green as the reference's hills
  for (const [tx, tz, ts, leaf] of [[21.5, -46.5, 1.2, MAT.leafC]]) tree(tx, tz, ts, leaf);   // (none just behind the platform: from there a tree stands between the camera and you)
  for (const [bx, bz] of [[-11, -44.4], [-7.2, -44.2], [5.2, -44.2], [9.5, -44.4], [16.2, -44.3]]) bush(bx, bz, .85, MAT.leafB);

  // ---- the train: four coaches and the locomotive, coupled up at the platform ----
  const train = new THREE.Group(); train.userData.dyn = true; scene.add(train); train.position.set(0, 0, Z);
  const bodyM = stOnce('coachBody', () => stGloss(new THREE.MeshStandardMaterial({ color: 0x8f2f2c, roughness: .5 }))), roofM = stOnce('coachRoof', () => stGloss(new THREE.MeshStandardMaterial({ color: 0x5d5560, roughness: .6 }), .8));
  const darkM = stOnce('underframe', () => new THREE.MeshStandardMaterial({ color: 0x4a4048, roughness: .8 }));
  // a coach side's paint, gloss and lit windows: one for the side with the open door, one shared by every other side (2 canvases, not 16)
  const sideM = (door) => stOnce('coachSide' + door, () => { const tex = stationCoachSide(door); return stGloss(new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissiveMap, emissive: 0xffffff, emissiveIntensity: .25, roughness: .5 })); });
  const CL = 8.2, coaches = [0, 1, 2, 3].map((i) => ({ x: -i * (CL + .32), door: i ? -1 : 3 })), doorLocal = (3 + .21) / 6 * CL - CL / 2;   // the first coach's fourth door is the one that stands open
  const rake = new THREE.Group(); train.add(rake);
  for (const co of coaches) {
    const g = new THREE.Group(); g.position.x = co.x; rake.add(g);
    box(CL, 2.3, 2.6, bodyM, 0, 1.12, 0, { p: g });   // the body
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, CL + .04, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), roofM);   // a half drum along the coach, curved side up
    rf.scale.set(1, .3, 1); rf.position.set(0, 3.42, 0); rf.castShadow = true; g.add(rf);
    box(CL - .8, .28, 2.1, darkM, 0, .84, 0, { p: g });   // underframe
    for (const bx of [-CL / 2 + 1.5, CL / 2 - 1.5]) {   // bogies: a frame and four wheels each
      box(2.3, .24, 1.9, darkM, bx, .6, 0, { p: g });
      for (const wx of [-.75, .75]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .1, 20).rotateX(Math.PI / 2), darkM); w.position.set(bx + wx, .78, s * .72); w.castShadow = true; g.add(w); }
    }
    for (const s of [-1, 1]) box(.32, 2, 1.7, darkM, s * (CL / 2 + .08), 1.2, 0, { p: g });   // the gangway bellows
    // the sides: the painted panels, doors and windows (one with its door open, on the platform side of the first coach)
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(CL - .1, 2.28), sideM(s > 0 ? co.door : -1)); side.position.set(0, 2.27, s * 1.305); if (s < 0) side.rotation.y = Math.PI; g.add(side);
    }
  }
  compact(rake);   // one mesh per material for all four: the coaches are five draws, not a hundred and sixty
  // the open door on the first coach, folded back along its side; it swings shut once you are aboard (the first coach stands at the train's origin)
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(.36, 1.86, .05), bodyM); doorPanel.position.set(doorLocal + .5, 2.08, 1.34); doorPanel.castShadow = true; train.add(doorPanel);
  { const x0 = coaches[coaches.length - 1].x - CL / 2 - .3, x1 = 20; contact((x0 + x1) / 2, Z, (x1 - x0) / 2, 1.7, 0, .145); }   // the shade under the whole train, last coach to buffer beam, on the ballast
  // the locomotive: the packed model, turned to face east, wheels on the rails, its lettering redrawn
  const locoAt = CL / 2 + .32, locoK = STATION.k;
  ModelFiles.when(train).then(() => ModelFiles.parse('train-loco', window.TRAIN_MODEL)).then((gl) => {
    const m = gl.scene;
    const done = new Set();
    m.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
      const mat = o.material; if (!mat || done.has(mat)) return; done.add(mat);
      if (mat.name === 'Lettering' && mat.map && mat.map.image) mat.map = stationLettering(mat.map.image);
      stationLocoLook(mat);   // its paint as this world shows colour, and the sky in its gloss
    });
    m.scale.setScalar(locoK); m.rotation.y = Math.PI / 2; m.position.set(locoAt + 1785 * locoK, RAIL + 9 * locoK, 0);
    train.add(m);
  }).catch((e) => console.warn('station: the locomotive did not load', e));

  // ---- boarding: E at the open door; you step in, the door shuts, a whistle, and the train pulls out east and off the island ----
  const doorX = STATION.door = doorLocal, S = { phase: 0, t0: 0 };
  INTER.push({ x: doorX, z: STATION.board + .25, r: 1.5, label: 'Bengaluru Express', verb: 'Board', act: () => {
    if (S.phase || traveling || playerLocked) return;
    if (typeof walkStop === 'function') walkStop(false);
    S.phase = 1; S.t0 = T; S.from = [hero.x, hero.y]; TF.lockPlayer(true);
  } });
  life.push((t) => {
    if (!S.phase) return;
    const e = t - S.t0;
    if (S.phase === 1) {   // step up to the door and in
      const k = Math.min(1, e / .5); hero.x = S.from[0] + (doorX - S.from[0]) * k; hero.y = S.from[1] + (STATION.board - S.from[1]) * k; hero.dir = 'up';
      if (k >= 1) {   // aboard: the camera steps back along the platform to watch the train go
        S.phase = 2; S.t0 = t; hero.g.visible = false; const a = TokenFall.ambience; if (a && a.train) a.train();
        TF.cameraTo(new THREE.Vector3(doorX - 7, 3.2, STATION.plat[3] + 1.2), new THREE.Vector3(doorX + 9, 2, STATION.z), 900, 46);
      }
      return;
    }
    if (doorPanel) doorPanel.position.x = doorLocal + .5 * (1 - Math.min(1, e / .45));   // the door slides shut
    const run = Math.max(0, e - .9); train.position.x = .5 * 3.6 * run * run;   // and away, faster and faster
    if (e > 3.3 && S.phase === 2) { S.phase = 3; travel({ to: 'blr', zone: 'lobby', label: 'Calfus Bengaluru' }); }
    // arrived: travel() switches the zone under its fade once the office is ready (its people's sprites uploaded, a few frames drawn), so this waits
    // for the switch rather than a fixed time (with a fallback); then the train goes back to the platform for next time
    if (S.phase === 3 && (zone !== 'lobby' || e > 9)) {
      train.position.x = 0; if (doorPanel) doorPanel.position.x = doorLocal + .5; hero.g.visible = true; TF.cameraRestore(0); TF.lockPlayer(false); S.phase = 0;
    }
  });
  // ---- steam: a lazy trickle from the chimney while it waits, a hiss from the cylinders now and then, great white chuffs as it pulls away ----
  const puff = stOnce('puffTex', () => canvasTex(64, 64, (g) => {
    // soft cloud lumps, white at the heart and a little grey at the rim, so a plume reads against a pale sky
    for (const [x, y, r, a] of [[32, 34, 28, .85], [22, 27, 17, .7], [43, 26, 16, .7], [31, 45, 15, .6]]) { const gr = g.createRadialGradient(x - r * .2, y - r * .25, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.6, `rgba(232,234,240,${a * .8})`); gr.addColorStop(1, 'rgba(200,204,214,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  }, { keep: true, smooth: true }));
  const steam = fwParticles(scene, 220, puff, 2.6, 1);
  const CH = { x: locoAt + (1785 + 1990) * locoK, y: RAIL + 885 * locoK - .2 }, CY = { x: CH.x - 1.5, y: .8 };   // the chimney's top and the cylinders, in the train's frame (the model's own units: tools/train-pack.mjs)
  const light = new THREE.Color(), sunPart = new THREE.Color();
  let idle = 0, hiss = 3, beat = 0, gap = .42;
  life.push((t, dt) => {
    if (zone !== 'lobby' && !S.phase) return;
    { const dl = window.daylight && window.daylight.state.p, u = Math.min(1, Math.max(0, ((dl ? dl.eLamp : 0) - .45) / .85)); ST_LAMPS.k.value = 1.1 * u * u * (3 - 2 * u); }   // the lamps' light on the train: none by day, full by night
    light.copy(hemi.color).multiplyScalar(hemi.intensity * .75).add(sunPart.copy(sun.color).multiplyScalar(sun.intensity * .55)).multiplyScalar(1 / .9);
    steam.material.color.copy(light);   // white by day, a moonlit grey-blue at night
    const tx = train.position.x, e = t - S.t0, rnd2 = Math.random;
    if (!REDUCED_MOTION) {
      if (S.phase < 2) {   // waiting at the platform: a soft plume, and every so often the cylinders hiss
        if ((idle -= dt) <= 0) { idle = .18 + rnd2() * .16; steam.emit(tx + CH.x + (rnd2() - .5) * .1, CH.y, STATION.z + (rnd2() - .5) * .1, .12 + rnd2() * .14, .55 + rnd2() * .3, (rnd2() - .5) * .15, 3.6 + rnd2(), .75 + rnd2() * .5, 0); }
        if ((hiss -= dt) <= 0) { hiss = 5 + rnd2() * 6; for (let i = 0; i < 6; i++) for (const s of [-1, 1]) steam.emit(tx + CY.x + (rnd2() - .5) * .6, CY.y, STATION.z + s * 1.35, (rnd2() - .3) * .4, .15 + rnd2() * .25, s * (.6 + rnd2() * .8), 1.6 + rnd2() * .8, .7 + rnd2() * .5, 0); }
        gap = .42; beat = 0;
      } else if (e > .85) {   // pulling away: a chuff with every beat, quicker and quicker (the sound's own rhythm, ambience.js), the drain cocks open at first
        if ((beat -= dt) <= 0) { beat = gap; gap = Math.max(.12, gap * .86); for (let i = 0; i < 4; i++) steam.emit(tx + CH.x, CH.y + .1, STATION.z, -1 - rnd2() * .8, 2.3 + rnd2() * 1.2, (rnd2() - .5) * .6, 2.4 + rnd2() * .8, 1.3 + rnd2() * .8, 0); }
        if (e < 2.4) for (const s of [-1, 1]) if (rnd2() < .6) steam.emit(tx + CY.x, CY.y, STATION.z + s * 1.35, -.5 + rnd2() * .4, .2 + rnd2() * .3, s * (1.2 + rnd2()), 1.5, 1 + rnd2() * .6, 0);
      }
    }
    steam.step(dt);
  });
  window.lobbyStation = { train, state: S, steam, chimney: CH };
}
function vStation() {
  const s0 = seed, d0 = decorSeed;
  stationBuild();
  seed = s0; decorSeed = d0;
  for (let i = 0; i < 15; i++) rnd();             // HQ used fifteen of the layout's random draws and thirty-six of the decor's: use up the same,
  for (let i = 0; i < 36; i++) decorRandom();     // so everything after it in the lobby is built exactly as it was
}

if (typeof module === 'object' && module.exports) module.exports = { STATION };
