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
  MAT.grass = groundVariation(std(TX.grass, 2), true); MAT.grass.color.setRGB(.94, .94, .9); MAT.darkGrass = std(TX.darkGrass, 2); MAT.dirt = std(TX.dirt, 1);
  MAT.plaster = std(TX.plaster, 1); MAT.wood = std(TX.wood, 1); MAT.darkWood = std(TX.darkWood, .5);
  MAT.floor = std(TX.floor, 1); MAT.roof = std(TX.roof, 1); MAT.lattice = std(TX.lattice, 1);
  MAT.cloth = std(TX.cloth, .5); MAT.bark = std(TX.bark, .5); MAT.books = std(TX.books, 1); MAT.rack = std(TX.rack, 0);
  MAT.door = std(TX.door, 0);
  MAT.leafA = std(TX.leafA, 0); MAT.leafB = std(TX.leafB, 0); MAT.leafC = std(TX.leafC, 0); MAT.blossom = std(TX.blossom, 0); MAT.leafLav = std(TX.leafLav, 0); MAT.patch = std(TX.patch, 2);
  MAT.redLantern = new THREE.MeshStandardMaterial({ color: 0xd4402a, emissive: 0xff5a2c, emissiveIntensity: 1.9, roughness: .8 });
  MAT.lanternCap = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: .9 });
  MAT.gold = new THREE.MeshStandardMaterial({ color: 0xc89a48, roughness: .6, metalness: .2 });
  MAT.warmGlow = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb860, emissiveIntensity: 2.2 });
  MAT.screen = new THREE.MeshStandardMaterial({ map: TX.screen, emissive: 0xffffff, emissiveMap: TX.screen, emissiveIntensity: 1.6 });
  MAT.rackLit = new THREE.MeshStandardMaterial({ map: TX.rack, emissive: 0xffffff, emissiveMap: TX.rack, emissiveIntensity: .9 });
  MAT.pot = new THREE.MeshStandardMaterial({ color: 0x7a3a26, roughness: .5 });
  MAT.potDark = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: .6 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: .25, roughness: .1, depthWrite: false });
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: .5, metalness: .4 });
  MAT.paver = groundVariation(std(TX.paver, 3), false); MAT.concrete = std(TX.concrete, 1.5); MAT.cladding = std(TX.cladding, 1.5); MAT.roofFlat = std(TX.roofFlat, 2);
  MAT.glass = std(TX.glass, 3, { emissive: 0xffffff, emissiveMap: TX.glassE, emissiveIntensity: .75, roughness: .35, metalness: .1 });
  MAT.glassLit = std(TX.glassE, 0, { color: 0xffe2b0, emissive: 0xffc888, emissiveIntensity: .7, roughness: .3 });
  MAT.glassLit.map = null; MAT.glassLit.emissiveMap = null;
  MAT.awning = std(TX.awning, .5); MAT.hedge = std(TX.leafB, 1);
  MAT.umbrellaA = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: .9 }); MAT.umbrellaB = new THREE.MeshStandardMaterial({ color: 0x2e7a70, roughness: .9 });
  MAT.solar = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: .3, metalness: .5 });
}

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
// A box whose edges are chamfered, so they catch the light instead of reading as razor-sharp: same UV layout and per-face material groups as THREE.BoxGeometry. Only props get it:
// thinner than 10 cm (decals, planks) or longer than BEVEL_MAX (buildings, slabs, walls) stay plain boxes, which also keeps the vertex count down.
const BEVEL_MAX = 3.2;
//             normal axis, sign, u axis, v axis, u direction, v direction: the faces in BoxGeometry's order (+x -x +y -y +z -z) and the way it lays its UVs out
const BOX_FACE = [[0, 1, 2, 1, -1, -1], [0, -1, 2, 1, 1, -1], [1, 1, 0, 2, 1, 1], [1, -1, 0, 2, 1, -1], [2, 1, 0, 1, 1, -1], [2, -1, 0, 1, -1, -1]];
function chamferBox(w, h, d, ss, b) {
  const H = [w / 2, h / 2, d / 2], S = [w, h, d], buf = [[], [], [], [], [], []], fidx = (a, sg) => a * 2 + (sg > 0 ? 0 : 1);
  const uvOf = (f, p) => { const [, , ua, va, ud, vd] = BOX_FACE[f], k = ss[f], u = p[ua] * ud + H[ua], v = p[va] * vd + H[va]; return k ? [u / k, (S[va] - v) / k] : [u / S[ua], 1 - v / S[va]]; };
  const tri = (f, n, p0, p1, p2) => {
    const e = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], g = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    if ((e[1] * g[2] - e[2] * g[1]) * n[0] + (e[2] * g[0] - e[0] * g[2]) * n[1] + (e[0] * g[1] - e[1] * g[0]) * n[2] < 0) [p1, p2] = [p2, p1];   // wind it to face outwards
    for (const p of [p0, p1, p2]) buf[f].push(p[0], p[1], p[2], n[0], n[1], n[2], ...uvOf(f, p));
  };
  const quad = (f, n, p0, p1, p2, p3) => { tri(f, n, p0, p1, p2); tri(f, n, p0, p2, p3); };
  const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const at = (o) => { const p = [0, 0, 0]; for (const k in o) p[k] = o[k]; return p; };
  for (let f = 0; f < 6; f++) {   // the six faces, inset by the bevel
    const [a, sg] = BOX_FACE[f], [a1, a2] = [0, 1, 2].filter((x) => x !== a), n = [0, 0, 0]; n[a] = sg;
    quad(f, n, ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => at({ [a]: sg * H[a], [a1]: i * (H[a1] - b), [a2]: j * (H[a2] - b) })));
  }
  for (const [a1, a2, a3] of [[0, 1, 2], [0, 2, 1], [1, 2, 0]]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {   // the twelve edges, 45 degrees between their two faces
    const f = Math.min(fidx(a1, s1), fidx(a2, s2)), n = [0, 0, 0]; n[a1] = s1; n[a2] = s2;
    const P = (t, side) => at(side ? { [a1]: s1 * H[a1], [a2]: s2 * (H[a2] - b), [a3]: t * (H[a3] - b) } : { [a1]: s1 * (H[a1] - b), [a2]: s2 * H[a2], [a3]: t * (H[a3] - b) });
    quad(f, unit(n), P(-1, 1), P(1, 1), P(1, 0), P(-1, 0));
  }
  for (const s0 of [-1, 1]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {   // the eight corners
    const f = Math.min(fidx(0, s0), fidx(1, s1), fidx(2, s2)), sg = [s0, s1, s2], P = (k) => at({ 0: sg[0] * (H[0] - (k === 0 ? 0 : b)), 1: sg[1] * (H[1] - (k === 1 ? 0 : b)), 2: sg[2] * (H[2] - (k === 2 ? 0 : b)) });
    tri(f, unit(sg), P(0), P(1), P(2));
  }
  const g = new THREE.BufferGeometry(), all = [].concat(...buf), pos = [], nor = [], uv = []; let start = 0;
  for (let i = 0; i < all.length; i += 8) { pos.push(all[i], all[i + 1], all[i + 2]); nor.push(all[i + 3], all[i + 4], all[i + 5]); uv.push(all[i + 6], all[i + 7]); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (let f = 0; f < 6; f++) { const n = buf[f].length / 8; g.addGroup(start, n, f); start += n; }
  return g;
}
function boxGeo(w, h, d, s) {
  const ss = Array.isArray(s) ? s : [s, s, s, s, s, s], lo = Math.min(w, h, d);
  if (lo >= 0.1 && Math.max(w, h, d) <= BEVEL_MAX) return chamferBox(w, h, d, ss, Math.min(0.035, lo * 0.18));
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) if (ss[f]) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / ss[f], uv.getY(k) * dims[f][1] / ss[f]); }
  return g;
}
function add(mesh, parent, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; (parent || scene).add(mesh); return mesh; }
// box resting on y (bottom), centred on x/z
function box(w, h, d, m, x, y, z, o = {}) {
  const me = new THREE.Mesh(boxGeo(w, h, d, o.s ?? m.userData.s), m);
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
const ZONE_LIGHTS = { lobby: [], lab: [], archive: [], pune: [], abz: [], bridge: [] };
const anim = [];       // per-frame callbacks
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
