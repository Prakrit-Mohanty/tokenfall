// TokenFall: materials and mesh helpers (box, plane, faceBox), plus the world registries: colliders, walkable areas, interactables, portals, lights.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= geometry helpers =================
const MAT = {};
function std(map, s, extra = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ map, roughness: .95, metalness: 0 }, extra));
  m.userData.s = s || 0; return m;
}
function buildMaterials() {
  MAT.cobble = std(TX.cobble, 2); MAT.flag = std(TX.flag, 2.5); MAT.stone = std(TX.stoneWall, 1);
  MAT.grass = grassSurface(std(TX.grass, 2), true); MAT.darkGrass = grassSurface(std(TX.darkGrass, 2), false); MAT.dirt = std(TX.dirt, 1);
  MAT.plaster = std(TX.plaster, 1); MAT.wood = std(TX.wood, 1); MAT.darkWood = std(TX.darkWood, .5);
  MAT.floor = std(TX.floor, 1); MAT.roof = std(TX.roof, 1); MAT.lattice = std(TX.lattice, 1);
  MAT.cloth = std(TX.cloth, .5); MAT.bark = std(TX.bark, .5); MAT.books = std(TX.books, 1); MAT.rack = std(TX.rack, 0);
  MAT.door = std(TX.door, 0);
  MAT.leafA = std(TX.leafA, 0); MAT.leafB = std(TX.leafB, 0); MAT.leafC = std(TX.leafC, 0); MAT.blossom = std(TX.blossom, 0); MAT.leafLav = std(TX.leafLav, 0); MAT.patch = std(TX.patch, 2);
  MAT.redLantern = new THREE.MeshStandardMaterial({ color: PAL.coral, emissive: 0xff9a78, emissiveIntensity: 1.9, roughness: .8 });
  MAT.lanternCap = new THREE.MeshStandardMaterial({ color: PAL.brown, roughness: .9 });
  MAT.gold = new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: .55, metalness: 0 });
  MAT.warmGlow = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb860, emissiveIntensity: 2.2 });
  MAT.screen = new THREE.MeshStandardMaterial({ map: TX.screen, emissive: 0xffffff, emissiveMap: TX.screen, emissiveIntensity: 1.6 });
  MAT.rackLit = new THREE.MeshStandardMaterial({ map: TX.rack, emissive: 0xffffff, emissiveMap: TX.rack, emissiveIntensity: .9 });
  MAT.pot = new THREE.MeshStandardMaterial({ color: PAL.coral, roughness: .6 });
  MAT.potDark = new THREE.MeshStandardMaterial({ color: PAL.woodDeep, roughness: .7 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: .25, roughness: .1, depthWrite: false });
  MAT.metal = new THREE.MeshStandardMaterial({ color: PAL.paint, roughness: .75, metalness: 0 });   // painted dusty mauve, not shiny near-black: with no environment map any metalness only darkens it
  // one path style everywhere: the quilt (MAT.patch) is the same pastel tile as the pavers
  MAT.paver = groundVariation(std(TX.paver, 3), false); MAT.patch = MAT.paver; MAT.concrete = std(TX.concrete, 1.5); MAT.cladding = std(TX.cladding, 1.5); MAT.roofFlat = std(TX.roofFlat, 2);
  // the lobby's own paving (paving.js): every stone laid out by paving-layout.js. Only vGround() in lobby-village.js uses it; every other zone keeps MAT.paver above
  MAT.paverLobby = pavingMaterial();
  MAT.glass = std(TX.glass, 3, { emissive: 0xffffff, emissiveMap: TX.glassE, emissiveIntensity: .75, roughness: .35, metalness: .1 });
  MAT.glassLit = std(TX.glassE, 0, { color: 0xffe2b0, emissive: 0xffc888, emissiveIntensity: .7, roughness: .3 });
  MAT.glassLit.map = null; MAT.glassLit.emissiveMap = null;
  MAT.bush = TX.bush.map((t) => std(t, 0)); MAT.awning = std(TX.awning, .5); MAT.hedge = std(TX.leafB, 1);
  MAT.umbrellaA = new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: .9 }); MAT.umbrellaB = new THREE.MeshStandardMaterial({ color: PAL.teal, roughness: .9 });
  MAT.solar = new THREE.MeshStandardMaterial({ color: PAL.periwinkle, roughness: .6, metalness: 0 });
  MAT.trim = std(null, 0, { color: PAL.cream, roughness: .8 });   // cream painted trim: window frames, sills, corner pilasters, door surrounds
}

// The lawn: lit by hemi + sun only (no emissive). Its colour is a blend between a lighter yellow-green (A) and a deeper blue-green (B) in big soft patches several metres wide, about 24% light-and-dark
// variation, a very faint blade grain from the texture, and a barely-there mown stripe. Shade collects at the edges: GRASS_U.uEdge is a map baked after the lobby is dressed (lobby-village.js vGrassShade)
// that is 1 beside paths, walls, trunks and water, so those spots take the darker edge colour and a little more grain while the open middle stays calm. daylight.js sets A, B and the edge colour per mood.
const GRASS_U = {
  uA: { value: new THREE.Color(PAL.sage) }, uB: { value: new THREE.Color(PAL.leaf) }, uShade: { value: new THREE.Color(PAL.plum) },
  uEdge: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uBox: { value: new THREE.Vector3(0, 0, 1) },   // uBox: the edge map's west, north and width in metres
};
GRASS_U.uEdge.value.needsUpdate = true;
function grassSurface(m, edge) {
  m.customProgramCacheKey = () => 'grass' + edge;   // the two lawns differ only in the closure's `edge`, not in its source text, which is what three keys the program on
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, GRASS_U);
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = `varying vec3 vGW; uniform vec3 uA, uB, uShade, uBox; uniform sampler2D uEdge;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gv(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1., 0.)), f.x), mix(gh(i + vec2(0., 1.)), gh(i + vec2(1., 1.)), f.x), f.y); }
    ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 gp = vGW.xz;
      float e = ${edge ? 'texture2D(uEdge, (gp - uBox.xy) / uBox.z).r' : '0.'};
      float tone = smoothstep(.3, .7, gv(gp * .11 + 3.) * .7 + gv(gp * .23 + 9.) * .3);   // 0 yellow-green .. 1 blue-green, patches ~8 m across
      float val = 1. + (gv(gp * .085 + 21.) * .6 + gv(gp * .19 + 5.) * .4 - .5) * .24;     // +-12% light and dark, broad
      val *= 1. + .022 * sin(gp.x * 1.1 + gv(gp * .05) * 3.);                               // a barely visible mown stripe
      vec3 gc = mix(mix(uA, uB, tone), uShade, e * .62) * val;
      float grain = diffuseColor.g / .95;   // the neutral blade texture, mean about .95
      diffuseColor.rgb = gc * (1. + (grain - 1.) * mix(.7, 2., e));`);
  };
  return m;
}

// The paving's shared inputs (paving.js reads them). daylight.js sets uTint from each preset's paveTint, a near-white hue steer over the palette stones
// uWarm counters most of the player's warmth slider (daylight.js adjust(): a whole-screen grade of [1 + .07w, 1, 1 - .12w]), so cool never turns the stone grey and warm never turns it yellow;
// the lighting and every other surface still follow the slider fully. Read each frame from the console's state.
const PAVE_U = {
  uTint: { value: new THREE.Color('#ffffff') }, uWarm: { value: new THREE.Vector3(1, 1, 1) },
  // the palette's stones as linear colours for the shader, the lobby's plaza rectangle (it gets a border band; far away = none), two walking lines the stone is worn along, and bench spots (moss under them)
  col: Object.fromEntries(Object.entries({ base: PAL.paveBase, light: PAL.paveLight, deep: PAL.paveDeep, sage: PAL.paveSage, blue: PAL.paveBlue, blush: PAL.paveBlush, taupe: PAL.paveTaupe }).map(([k, h]) => [k, { value: new THREE.Color(h) }])),
  uPlaza: { value: new THREE.Vector4(1e5, 1e5, 1e5, 1e5) }, uWalk: { value: [new THREE.Vector4(1e5, 1e5, 1e5, 1e5), new THREE.Vector4(1e5, 1e5, 1e5, 1e5)] },
  uFount: { value: new THREE.Vector2(1e5, 1e5) },   // the lobby fountain's centre: the stones round it are laid in rings (paving.js)
  uBench: { value: Array.from({ length: 12 }, () => new THREE.Vector3(0, 0, 0)) }, benches: 0,
  // mood effects, set each frame by groundlife.js from the current look: dappled light (x, z drift and strength; trees: x, z, 1), the warm sun-facing rim, and the night sheen
  uDapple: { value: new THREE.Vector3(0, 0, 0) }, uTree: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, 0)) },
  uRim: { value: new THREE.Vector3(0, 0, 0) }, uSunH: { value: new THREE.Vector2(1, 0) }, uNight: { value: 0 },
  plants: [], trees: 0,
};
PAVE_U.col.moss = { value: new THREE.Color(PAL.leaf).multiplyScalar(.8) };
PAVE_U.addPlant = (x, z, sc = 1, tree = false) => { PAVE_U.plants.push([x, z, sc]); if (tree && PAVE_U.trees < 8) PAVE_U.uTree.value[PAVE_U.trees++].set(x, z, 1); };
PAVE_U.addBench = (x, z) => { if (PAVE_U.benches < 12) PAVE_U.uBench.value[PAVE_U.benches++].set(x, z, 1); };
// breaks up texture tiling with slow patches of lighter/darker and drier ground
function groundVariation(m, dry) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    // value noise at three scales (broad drifts, patches, fine blotches), so a repeating tile never shows its repeat
    sh.fragmentShader = `varying vec3 vGW;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gv(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1., 0.)), f.x), mix(gh(i + vec2(0., 1.)), gh(i + vec2(1., 1.)), f.x), f.y); }
    ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float gn = (gv(vGW.xz * .07) + .5 * gv(vGW.xz * .17 + 7.)) / 1.5 * 2. - 1.;
      float gn2 = gv(vGW.xz * .45 + 3.) * 2. - 1.;
      float gn3 = gv(vGW.xz * 2.3 + 11.) * 2. - 1.;
      diffuseColor.rgb *= 1. + gn * .2 + gn2 * .08 + gn3 * .045;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 1.02, .93), smoothstep(-.25, .6, gn) * .3);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.94, 1., 1.05), smoothstep(.1, .8, -gn2) * .25);
      ${dry ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.03, .88), smoothstep(.35, .9, gn2) * .4);' : ''}`);
  };
  return m;
}
// Boxes have soft, rounded edges (smooth normals) to sit with the 3D chibi characters instead of reading as hard low-poly blocks. A 3x3x3-segment
// BoxGeometry has its grid lines pulled to r from each edge, then every vertex is pushed onto a box of radius r around the inner box: same per-face
// material groups as THREE.BoxGeometry, UVs re-laid per face. Only paper-thin boxes (decals, signs' faces) stay sharp.
//             normal axis, sign, u axis, v axis, u direction, v direction: the faces in BoxGeometry's order (+x -x +y -y +z -z) and the way it lays its UVs out
const BOX_FACE = [[0, 1, 2, 1, -1, -1], [0, -1, 2, 1, 1, -1], [1, 1, 0, 2, 1, 1], [1, -1, 0, 2, 1, -1], [2, 1, 0, 1, 1, -1], [2, -1, 0, 1, -1, -1]];
const PlainBox = THREE.BoxGeometry;
function roundBox(w, h, d, ss, r) {
  const H = [w / 2, h / 2, d / 2], S = [w, h, d], g = new PlainBox(w, h, d, 3, 3, 3);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, p = [0, 0, 0], n = [0, 0, 0];
  for (let k = 0; k < pos.count; k++) {
    const f = k >> 4;   // 4x4 vertices per face, faces in order
    for (let a = 0; a < 3; a++) { const t = Math.round((pos.array[k * 3 + a] / H[a] + 1) * 1.5); p[a] = t === 0 ? -H[a] : t === 3 ? H[a] : (t === 1 ? -1 : 1) * (H[a] - r); }
    for (let a = 0; a < 3; a++) { const c = Math.max(-(H[a] - r), Math.min(H[a] - r, p[a])); n[a] = p[a] - c; p[a] = c; }
    const l = Math.hypot(...n) || 1; for (let a = 0; a < 3; a++) { n[a] /= l; p[a] += n[a] * r; }
    const [, , ua, va, ud, vd] = BOX_FACE[f], q = ss[f], u = p[ua] * ud + H[ua], v = p[va] * vd + H[va];
    pos.setXYZ(k, ...p); nor.setXYZ(k, ...n); uv.setXY(k, ...(q ? [u / q, (S[va] - v) / q] : [u / S[ua], 1 - v / S[va]]));
  }
  return g;
}
// how round a box's edges are, from its thinnest side: at least .08 on props (capped at 30% of that side, so a plank stays a plank), up to .14 on big boxes
const boxRadius = (lo) => Math.min(0.2, lo * 0.3, Math.max(0.08, lo * 0.28));
function boxGeo(w, h, d, s) {
  const ss = Array.isArray(s) ? s : [s, s, s, s, s, s], lo = Math.min(w, h, d);
  if (lo >= 0.06) return roundBox(w, h, d, ss, boxRadius(lo));
  const g = new PlainBox(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) if (ss[f]) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / ss[f], uv.getY(k) * dims[f][1] / ss[f]); }
  return g;
}
// the minigame rooms build with THREE.BoxGeometry directly: give their boxes the same rounded edges (a call with segment counts is asking for a plain grid, so it keeps one)
THREE.BoxGeometry = class extends PlainBox { constructor(w = 1, h = 1, d = 1, ...seg) { super(w, h, d, ...seg); if (!seg.length && Math.min(w, h, d) >= 0.06) return roundBox(w, h, d, [0, 0, 0, 0, 0, 0], boxRadius(Math.min(w, h, d))); } };
function add(mesh, parent, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; (parent || scene).add(mesh); return mesh; }
// box resting on y (bottom), centred on x/z
function box(w, h, d, m, x, y, z, o = {}) {
  // thin vertical sticks (posts, legs, poles) read like wires beside the chunky characters: a box under .14 across and 4x taller (not glowing, not a decal) is built as a round post at least .15 across
  const stick = o.cast !== false && w < .14 && d < .14 && h >= 4 * Math.max(w, d) && !(m.emissiveIntensity > .3), r = Math.max(.075, Math.max(w, d) * .65);
  const me = new THREE.Mesh(stick ? new THREE.CylinderGeometry(r, r, h, 20) : boxGeo(w, h, d, o.s ?? m.userData.s), m);
  me.position.set(x, y + h / 2, z);
  if (o.ry) me.rotation.y = o.ry;
  return add(me, o.p, o.cast !== false);
}
function plane(w, d, m, x, y, z, s) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  if (s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * d / s); }
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.receiveShadow = true; scene.add(me); return me;
}

// ================= world bookkeeping =================
const COL = [];        // colliders: {x,z,r} circle | {x0,z0,x1,z1} box | {ex,ez,rx,rz} ellipse
const WALK = [];       // walkable rects [x0,z0,x1,z1]
const INTER = [];      // interactables {x,z,r,label,verb,act}
const PORTALS = [];
const ZONE_LIGHTS = { lobby: [], lab: [], airport: [], us: [], archive: [], pune: [], abz: [], bridge: [] };
const anim = [];       // per-frame callbacks
anim.push(() => { const d = window.TokenFall && TokenFall.daylight, w = d ? d.state.warm : 0; PAVE_U.uWarm.value.set(Math.pow(1 + .07 * w, -.7), 1, Math.pow(1 - .12 * w, -.7)); });
const FADERS = [];     // things that turn see-through when they would hide the player
const colBox = (x0, z0, x1, z1) => COL.push({ x0, z0, x1, z1 });
const colCirc = (x, z, r) => COL.push({ x, z, r });
function walkable(x, z) { for (const r of WALK) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true; return false; }
function blocked(x, z, pad = .32) {
  if (!walkable(x, z)) return true;
  for (const c of COL) {
    if (c.r !== undefined) { if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return true; }
    else if (c.ex !== undefined) { if (((x - c.ex) / (c.rx + pad)) ** 2 + ((z - c.ez) / (c.rz + pad)) ** 2 < 1) return true; }
    else if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}
function pointLight(zone, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); l.userData.base = intensity;
  scene.add(l); ZONE_LIGHTS[zone].push(l); return l;
}
