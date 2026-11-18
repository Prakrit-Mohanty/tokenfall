// TokenFall: the paving. Every stone's shape comes from paving-layout.js (each paved area lays its own whole stones from its own edges, so none is sliced by a kerb, a wall or a neighbour);
// buildPaving() turns that layout into one mesh, one cell per stone, and this shader draws each cell (the stone, its bevel, the grout round it, colour, wear, moss) from the cell's own shape,
// handed over per vertex, with the detail fading by distance. The fountain's paving (rings of wedge stones, an inlay band, an accent line) is its own piece of mesh drawn by the polar code below.
// Lobby only: MAT.paverLobby; every other zone keeps the pastel tile, MAT.paver. The colours are the palette's (PAL.pave*), the mood's hue shift is paveTint (daylight.js) through PAVE_U,
// and the only texture is a neutral grain (TX.paveGrain). Classic script: shares one global scope with the other js/game files; geometry.js owns PAVE_U, buildMaterials() calls pavingMaterial().

const PAVING_GLSL = `
uniform vec3 uPaveTint, uPaveWarm, uPvBase, uPvLight, uPvDeep, uPvSage, uPvBlue, uPvBlush, uPvTaupe, uPvMoss;
uniform vec4 uPlaza, uWalk[2];   // the plaza rectangle (x0, z0, x1, z1: it gets a border band) and two walking lines (x0, z0, x1, z1: the stone is worn pale along them)
uniform vec3 uBench[12];         // x, z, 1 = in use
uniform vec3 uDapple, uTree[8], uRim;   // dappled light (x, z drift, strength), trees (x, z, 1), the warm sun-facing rim (colour x strength)
uniform vec2 uSunH;              // the way the sun lies, across the ground
uniform vec2 uFount;            // the lobby fountain's centre: round it the stones are laid in rings (far away = none)
uniform float uNight;            // 0 by day, 1 at night: the sheen and the cooler grout
uniform sampler2D uPaveGrain;
varying vec3 vGW;
varying vec4 vA, vB;   // the cell under this pixel (ids in B are whole numbers: round them after interpolation, or the hash turns rounding dust into noise): A = its shape (a box: centre x, z, half x, z; a ring sector: mid radius, mid angle, half width, half arc), B = kind, role, id
varying vec2 vC;       // a ring sector's centre
varying vec3 vD, vE;   // the curves that cut this stone (a stone can sit on two, the fountain's and the planter's): x, z, radius (0 = none)
float pvH(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }   // a hash that stays clean at big world coordinates
float pvN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(pvH(i), pvH(i + vec2(1., 0.)), f.x), mix(pvH(i + vec2(0., 1.)), pvH(i + vec2(1., 1.)), f.x), f.y); }
float pvBox(vec2 q, vec2 b, float r){ vec2 d = abs(q) - (b - r); return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }   // rounded box: < 0 inside
vec2 pvOut(vec2 q, vec2 b, float r){ vec2 d = abs(q) - (b - r), m = max(d, 0.); return m.x + m.y > 1e-4 ? sign(q) * normalize(m) : (d.x > d.y ? vec2(sign(q.x), 0.) : vec2(0., sign(q.y))); }   // which way the edge faces
float pvSegDist(vec2 p, vec4 s){ vec2 pa = p - s.xy, ba = s.zw - s.xy; return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.)); }
vec2 pvQ, pvB, pvId;   // the stone under this point: its centre-relative position, half size and id
// The fountain's paving: polar rows of wedge stones from the basin's edge out to the inlay band and its thin accent line; the running-bond field then starts at the accent line's outer edge, its stones cut
// by that arc (a cut stone is a field stone with a curved edge, never a random clip). Radii in metres from the centre; the basin is tokenFountain()'s 3.72 (lobby-village.js).
const float FB = 3.72, FR1 = 4.56, FR2 = 5.4, FR3 = 6.5, FO = 6.95;   // basin edge, two field rows, the inlay band, the accent line, the field's start
float pvFr, pvAn;   // distance from the fountain centre, and the way round it (0-1)
vec2 pvRh, pvTg;    // unit vectors: outward and round
bool pvPolar;
int pvIn;           // 1 on the inlay band, 2 on the accent line
// one wedge row between radii r0 and r1, n stones round (a whole number: the row closes), shifted off of a stone's width
void pvPol(float r0, float r1, float n, float off, float row){
  float u = pvAn * n + off, k = floor(u), L = 6.28318530718 * pvFr / n;
  pvQ = vec2((u - k - .5) * L, pvFr - (r0 + r1) * .5); pvB = vec2(L * .5, (r1 - r0) * .5); pvId = vec2(mod(k, n), row); pvPolar = true;
}`;

const PAVING_MAP = `#include <map_fragment>
  vec2 pvP = vGW.xz, pvBn = vec2(0.);
  float pvFw = max(length(fwidth(pvP)), 1e-4);                 // metres per pixel: how much detail this pixel can hold
  float pvDk = 1. - smoothstep(.02, .09, pvFw);                // 1 close up, 0 far away: bevel, chips, cracks and grain fade out together
  vec4 pvR = uPlaza; float pvEx = min(pvP.x - pvR.x, pvR.z - pvP.x), pvEz = min(pvP.y - pvR.y, pvR.w - pvP.y), pvE = min(pvEx, pvEz);   // distance in from the plaza's edge (moss grows near it)
  const float GAP = .09, RAD = .15;
  float pvKind = vB.x;                                         // 0 a box stone, 1 a curved stone, 3 the fountain's rings, 4 the grout under an area
  bool pvBase = pvKind > 3.5, pvBand = pvKind < .5 && vB.y > .5;
  pvPolar = false; pvIn = 0; vec2 pvFd = pvP - uFount; pvFr = length(pvFd); pvRh = pvFd / max(pvFr, 1e-4); pvTg = vec2(-pvRh.y, pvRh.x); pvAn = atan(pvFd.y, pvFd.x + 1e-5) / 6.28318530718 + .5;
  if (pvBase) { pvQ = vec2(1e3); pvB = vec2(1.); pvId = vec2(0.); }
  else if (pvKind > 2.5) {   // the fountain's paving: 18 stones round the first field row, 24 round the second and the inlay band (their joints line up, and run on into the accent line: 72 = 3 x 24)
    if (pvFr < FR1) pvPol(FB, FR1, 18., .5, 100.);
    else if (pvFr < FR2) pvPol(FR1, FR2, 24., 0., 101.);
    else if (pvFr < FR3) { pvPol(FR2, FR3, 24., 0., 102.); pvIn = 1; }
    else { pvPol(FR3, FO, 72., 0., 103.); pvIn = 2; }
  } else if (pvKind > .5) {  // a curved stone: its ring sector unfolded into a straight box, x along the ring and y across it
    vec2 pvCd = pvP - vC; float pvCr = max(length(pvCd), 1e-3); pvRh = pvCd / pvCr; pvTg = vec2(-pvRh.y, pvRh.x);
    float pvT = atan(pvCd.y, pvCd.x + 1e-5) - vA.y; pvT -= 6.28318530718 * floor((pvT + 3.14159265359) / 6.28318530718);
    pvQ = vec2(pvT * vA.x, pvCr - vA.x); pvB = vec2(vA.w * vA.x, vA.z); pvId = floor(vB.zw + .5); pvPolar = true; pvIn = vB.y > .5 ? 1 : 0;
  } else { pvQ = pvP - vA.xy; pvB = vA.zw; pvId = floor(vB.zw + .5); }   // a box stone: its own centre and size
  vec2 pvHalf = pvB - GAP * .5;
  float pvD = pvBase ? 1. : pvBox(pvQ, pvHalf, RAD);           // < 0 on the stone, > 0 in the joint
  vec2 pvNo = pvBase ? vec2(0.) : pvOut(pvQ, pvHalf, RAD);
  if (pvPolar) pvNo = pvNo.x * pvTg + pvNo.y * pvRh;           // a wedge's edges face along the rings, not along the axes
  for (int k = 0; k < 2; k++) {   // a stone a curve cuts (the fountain's accent line, a planter's collar): gone inside the curve, cut along it outside, by a rounded intersection so the cut corners are soft like the rest
    vec3 pvV = k == 0 ? vD : vE;
    if (pvV.z > 0.) {
      vec2 pvCd = pvP - pvV.xy; float pvCr = length(pvCd); if (pvCr < pvV.z) discard;
      float pvA = pvV.z + GAP * .5 - pvCr;
      if (pvA > -.3) { vec2 w = vec2(pvD, pvA) + RAD; if (pvA > pvD) pvNo = -pvCd / max(pvCr, 1e-4); pvD = min(max(w.x, w.y), 0.) + length(max(w, 0.)) - RAD; }
    }
  }
  float pvGm = pvBase ? 1. : smoothstep(-pvFw * .75, pvFw * .75, pvD) * clamp(GAP / (1.5 * pvFw), .15, 1.);   // joint coverage, anti-aliased; a thin joint thins out instead of going grey at a distance
  const vec2 PV_L = vec2(-.7071, -.7071);                    // the light for the bevel: from the top-left of the screen
  float pvBev = (1. - smoothstep(0., .11, -pvD)) * (1. - pvGm) * pvDk;
  float pvU = pvH(pvId + .31);
  vec3 pvSt = pvBand ? (pvU < .55 ? uPvDeep : uPvBlue * .98)
    : pvU < .42 ? uPvBase : pvU < .58 ? uPvLight : pvU < .71 ? uPvDeep : pvU < .8 ? uPvSage : pvU < .9 ? uPvBlue : uPvBlush;
  vec3 pvTp = mix(uPvDeep, uPvTaupe, .5);                     // the inlay's deep warm taupe
  if (pvPolar && pvIn == 0) pvSt = pvU < .5 ? uPvBase : pvU < .85 ? uPvLight : uPvDeep;   // the field rows by the fountain are cream, so the band's taupe and accents are the only colour there
  if (pvIn == 1) { float pvK = pvId.x, pvC = mod(floor(pvK * .5), 3.); pvSt = mod(pvK, 2.) < .5 ? pvTp : pvC < .5 ? uPvSage : pvC < 1.5 ? uPvBlue : uPvBlush; }   // taupe between sage, blue-grey and blush
  else if (pvIn == 2) pvSt = mod(pvId.x, 2.) < .5 ? uPvLight : pvTp;
  // wear: pale along the walking lines
  float pvWd = min(pvSegDist(pvP, uWalk[0]), pvSegDist(pvP, uWalk[1])), pvWorn = exp(-pow(pvWd / 1.4, 2.)) * (.45 + .55 * pvN(pvP * .8));
  pvSt *= 1. + (pvH(pvId + 7.7) - .5) * .24;                                          // each stone a little lighter or darker (+-12%)
  pvSt *= vec3(1. + (pvH(pvId + 13.1) - .5) * .06, 1., 1. - (pvH(pvId + 13.1) - .5) * .06);   // and a few degrees of hue
  pvSt *= 1. + dot(pvPolar ? pvQ.x * pvTg + pvQ.y * pvRh : pvQ, PV_L) * .02;                                                  // a stone is a touch lighter on its top-left half
  pvSt = mix(pvSt, uPvLight * 1.04, pvWorn * .55);
  float pvGr = (texture2D(uPaveGrain, pvP * .37).r + texture2D(uPaveGrain, mat2(.8, .6, -.6, .8) * pvP * .91 + 3.7).r - 1.) * pvDk;
  pvSt *= 1. + pvGr * .22;
  pvSt *= 1. + pvBev * (max(dot(pvNo, PV_L), 0.) * .2 - max(-dot(pvNo, PV_L), 0.) * .2);   // soft highlight top-left, soft shade bottom-right
  float pvChip = smoothstep(.8, .88, pvN(pvP * 30. + pvId * 5.3)) * (.35 + .65 * pvBev) * step(.55, pvH(pvId + 3.)) * pvDk * (1. - pvWorn * .6);
  float pvAng = pvH(pvId + 9.) * 3.14159, pvCd = abs(dot(pvQ, vec2(cos(pvAng), sin(pvAng)))) + (pvN(pvQ * 14. + pvId) - .5) * .03;
  float pvCrack = (1. - smoothstep(.003, .009, pvCd)) * step(.88, pvH(pvId + 5.)) * step(abs(dot(pvQ, vec2(-sin(pvAng), cos(pvAng)))), .38) * pvDk * (1. - pvGm);
  pvSt *= 1. - .22 * pvChip - .35 * pvCrack;
  // the joint: warm taupe, darker where it meets a stone (a soft inner shadow), moss and tiny grass near the plaza edge and under benches, paler where it is worn
  vec3 pvGt = uPvTaupe * (.9 + .2 * pvN(pvP * 5.)) * mix(.68, 1., smoothstep(0., GAP * .5, pvD));
  float pvBench = 0.; for (int i = 0; i < 12; i++) pvBench = max(pvBench, uBench[i].z * (1. - smoothstep(.2, 1.7, distance(pvP, uBench[i].xy))));
  float pvMoss = max((1. - smoothstep(0., 1.7, abs(pvE))) * .85, pvBench) * smoothstep(.42, .72, pvN(pvP * 2.6 + 4.)) * mix(.6, 1., pvDk);
  pvGt = mix(pvGt, uPvMoss * (.8 + .4 * pvN(pvP * 30.)), pvMoss * .8);
  pvGt = mix(pvGt, uPvMoss * 1.25, step(.86, pvH(floor(pvP * 55.))) * pvMoss * pvDk);
  pvGt = mix(pvGt, uPvDeep, pvWorn * .5);
  pvGt *= mix(vec3(1.), vec3(.8, .86, 1.06), uNight);           // at night the joints go a little darker and cooler
  vec3 pvCol = mix(pvSt, pvGt, pvGm);
  pvCol = mix(pvCol, mix(mix(uPvBase, uPvTaupe, .1) * .98, pvTp, float(pvIn > 0) * .5), smoothstep(.12, .45, pvFw) * .7);   // far away: a calm average, never noise
  // dappled light: slow soft patches of leaf-filtered sun, mostly under the trees and faint in the open, by day only (uDapple.z); the drift is an anime.js tween (groundlife.js)
  float pvTr = 0.; for (int i = 0; i < 8; i++) pvTr = max(pvTr, uTree[i].z * (1. - smoothstep(1.4, 4.6, distance(pvP, uTree[i].xy))));
  float pvDap = smoothstep(.42, .7, pvN((pvP + uDapple.xy) * .75) * .6 + pvN(pvP * 1.6 - uDapple.xy * .6 + 9.) * .4);
  pvCol *= 1. + uDapple.z * (.25 + .75 * pvTr) * (pvDap - .4) * .16 * mix(.5, 1., pvDk);
  diffuseColor.rgb = pvCol * uPaveTint * uPaveWarm * 1.3;       // the mood's hue shift, the warmth-slider counter (geometry.js), and a little headroom
  pvBn = pvNo * pvBev * .9;`;

// the sheen and the rim are lighting, so they sit where three.js builds roughness and emissive
const PAVING_ROUGH = `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, mix(.34, .66, pvGm), uNight * (.6 + .4 * pvN(pvP * .45)));   // night: the stones go glossy in patches and catch the lamps; the joints stay matt`;
const PAVING_EMIT = `#include <emissivemap_fragment>
  totalEmissiveRadiance += uRim * max(dot(pvNo, uSunH), 0.) * pvBev;   // the sun-facing edge of each stone catches a warm rim (evening)`;

function pavingMaterial() {
  const m = std(null, 3, { color: 0xffffff });
  m.customProgramCacheKey = () => 'paving';
  m.onBeforeCompile = (sh) => {
    const U = PAVE_U;
    Object.assign(sh.uniforms, {
      uPaveTint: U.uTint, uPaveWarm: U.uWarm, uPaveGrain: { value: TX.paveGrain }, uPlaza: U.uPlaza, uWalk: U.uWalk, uBench: U.uBench,
      uDapple: U.uDapple, uTree: U.uTree, uRim: U.uRim, uSunH: U.uSunH, uNight: U.uNight, uFount: U.uFount,
      uPvBase: U.col.base, uPvLight: U.col.light, uPvDeep: U.col.deep, uPvSage: U.col.sage, uPvBlue: U.col.blue, uPvBlush: U.col.blush, uPvTaupe: U.col.taupe, uPvMoss: U.col.moss,
    });
    sh.vertexShader = 'attribute vec4 aA, aB; attribute vec2 aC; attribute vec3 aD, aE; varying vec4 vA, vB; varying vec2 vC; varying vec3 vD, vE; varying vec3 vGW;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz; vA = aA; vB = aB; vC = aC; vD = aD; vE = aE;');
    sh.fragmentShader = PAVING_GLSL + "\n" + sh.fragmentShader
      .replace('#include <map_fragment>', PAVING_MAP)
      .replace('#include <roughnessmap_fragment>', PAVING_ROUGH).replace('#include <emissivemap_fragment>', PAVING_EMIT)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + (viewMatrix * vec4(pvBn.x, 0., pvBn.y, 0.)).xyz);');   // the bevel tilts the surface, so the sun and lamps catch each stone's edge
  };
  return m;
}

// The lobby's paving as one mesh: a grout base under each area, a cell per stone, and the fountain's rings. Each vertex carries its cell (see the shader), so the cells need no texture and never repeat.
// y: the paving's height (the old planes sat at .012 to .014). The mesh is marked dyn so mergeStatic leaves its extra vertex data alone.
function buildPaving(layout, fountain, y = .014) {
  const pos = [], nor = [], A = [], B = [], C = [], D = [], E = [], idx = [];
  const vert = (x, z, yy, a, b, c, d, e = [0, 0, 0]) => { pos.push(x, yy, z); nor.push(0, 1, 0); A.push(...a); B.push(...b); C.push(...c); D.push(...d); E.push(...e); return pos.length / 3 - 1; };
  const tri = (i, j, k) => {   // wound so the face points up, whatever order the corners came in
    const [ax, az, bx, bz, cx, cz] = [pos[i * 3], pos[i * 3 + 2], pos[j * 3], pos[j * 3 + 2], pos[k * 3], pos[k * 3 + 2]];
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0) idx.push(i, j, k); else idx.push(i, k, j);
  };
  const quad = (x0, z0, x1, z1, yy, a, b, d, e) => { const v = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => vert(x, z, yy, a, b, [0, 0], d, e)); tri(v[0], v[1], v[2]); tri(v[0], v[2], v[3]); };
  const none = [0, 0, 0];
  for (const R of layout.areas) quad(R[0], R[1], R[2], R[3], y - .002, [0, 0, 1, 1], [4, 0, 0, 0], none);   // the grout every stone sits on
  for (const c of layout.cells) {
    if (c.k === 'r') quad(c.x0, c.z0, c.x1, c.z1, y, [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, (c.x1 - c.x0) / 2, (c.z1 - c.z0) / 2], [0, c.role, c.id[0], c.id[1]], c.cut ? [c.cut.x, c.cut.z, c.cut.R] : none, c.cut2 ? [c.cut2.x, c.cut2.z, c.cut2.R] : none);
    else {
      const m = Math.max(2, Math.ceil((c.t1 - c.t0) * c.r1 / .12)), a = [(c.r0 + c.r1) / 2, (c.t0 + c.t1) / 2, (c.r1 - c.r0) / 2, (c.t1 - c.t0) / 2], b = [1, c.role, c.id[0], c.id[1]], ring = [];
      for (let i = 0; i <= m; i++) { const t = c.t0 + (c.t1 - c.t0) * i / m, cs = Math.cos(t), sn = Math.sin(t); ring.push([vert(c.cx + c.r0 * cs, c.cz + c.r0 * sn, y, a, b, [c.cx, c.cz], none), vert(c.cx + c.r1 * cs, c.cz + c.r1 * sn, y, a, b, [c.cx, c.cz], none)]); }
      for (let i = 0; i < m; i++) { tri(ring[i][0], ring[i][1], ring[i + 1][1]); tri(ring[i][0], ring[i + 1][1], ring[i + 1][0]); }
    }
  }
  // the fountain's own paving: a ring of mesh from just inside the basin to the accent line (its stones are laid by the polar code in the shader)
  const [fx, fz, f0, f1] = fountain, seg = 160, fr = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t); fr.push([vert(fx + f0 * cs, fz + f0 * sn, y, [0, 0, 1, 1], [3, 0, 0, 0], [0, 0], none), vert(fx + f1 * cs, fz + f1 * sn, y, [0, 0, 1, 1], [3, 0, 0, 0], [0, 0], none)]); }
  for (let i = 0; i < seg; i++) { tri(fr[i][0], fr[i][1], fr[i + 1][1]); tri(fr[i][0], fr[i + 1][1], fr[i + 1][0]); }
  const g = new THREE.BufferGeometry(), f32 = (arr, n) => new THREE.BufferAttribute(new Float32Array(arr), n);
  g.setAttribute('position', f32(pos, 3)); g.setAttribute('normal', f32(nor, 3)); g.setAttribute('aA', f32(A, 4)); g.setAttribute('aB', f32(B, 4)); g.setAttribute('aC', f32(C, 2)); g.setAttribute('aD', f32(D, 3)); g.setAttribute('aE', f32(E, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  const mesh = new THREE.Mesh(g, MAT.paverLobby); mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.dyn = true; scene.add(mesh);
  return mesh;
}
