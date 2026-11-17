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
  MAT.grass = groundVariation(std(TX.grass, 2), true); MAT.darkGrass = std(TX.darkGrass, 2); MAT.dirt = std(TX.dirt, 1);
  MAT.plaster = std(TX.plaster, 1); MAT.wood = std(TX.wood, 1); MAT.darkWood = std(TX.darkWood, .5);
  MAT.floor = std(TX.floor, 1); MAT.roof = std(TX.roof, 1); MAT.lattice = std(TX.lattice, 1);
  MAT.cloth = std(TX.cloth, .5); MAT.bark = std(TX.bark, .5); MAT.books = std(TX.books, 1); MAT.rack = std(TX.rack, 0);
  MAT.door = std(TX.door, 0);
  MAT.leafA = std(TX.leafA, 0); MAT.leafB = std(TX.leafB, 0); MAT.leafC = std(TX.leafC, 0); MAT.blossom = std(TX.blossom, 0);
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
    sh.fragmentShader = 'varying vec3 vGW;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float gn = sin(vGW.x * .13 + sin(vGW.z * .09) * 2.) * sin(vGW.z * .11 + vGW.x * .05);
      float gn2 = sin(vGW.x * .31 + 1.7) * sin(vGW.z * .27 + sin(vGW.x * .1) * 3.);
      diffuseColor.rgb *= 1. + gn * .1;
      ${dry ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.06, .78), smoothstep(.35, .9, gn2) * .7);' : ''}`);
  };
  return m;
}
function boxGeo(w, h, d, s) {
  const g = new THREE.BoxGeometry(w, h, d);
  const ss = Array.isArray(s) ? s : [s, s, s, s, s, s];
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
const ZONE_LIGHTS = { lobby: [], lab: [], airport: [], us: [], pune: [], abz: [], bridge: [] };
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
