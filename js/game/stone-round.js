// TokenFall: standing stonework cut from the paving's stone. The lobby's round pieces (the fountain basin, its two bowls, the planter bed) wear this instead of the grey concrete texture: the same palette
// stones, grout width, rounded corners, bevel, chips, grain, per-stone variation, night sheen and distance fade as paving.js, and the same paveTint response, so the pieces read as one stone with the pavement.
// stoneRoundMaterial({ c: [x, z] centre, n: stones round (0 = one smooth carved block), h: course height, y0: where the first course starts, rows: [a, b, c] radii of the top's wedge rows }):
// the wall is courses of n stones (each course shifted half a stone), the top is wedge rows between the radii (then rows 1 m deep inward), so every stone is whole and none is sliced by a rim.
// Classic script: shares one global scope with the other js/game files; needs geometry.js (std, PAVE_U) and textures.js (TX.paveGrain). Used by lobby-village.js.

const STONE_ROUND_GLSL = `
uniform vec3 uPaveTint, uPaveWarm, uPvBase, uPvLight, uPvDeep, uPvTaupe, uRim;
uniform vec4 uSr, uSq;      // uSr: centre x, z, stones round, course height; uSq: first course's base y, then the top rows' radii (3)
uniform vec2 uSunH;
uniform float uNight;
uniform sampler2D uPaveGrain;
varying vec3 vGW;
float srH(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float srN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(srH(i), srH(i + vec2(1., 0.)), f.x), mix(srH(i + vec2(0., 1.)), srH(i + vec2(1., 1.)), f.x), f.y); }
float srBox(vec2 q, vec2 b, float r){ vec2 d = abs(q) - (b - r); return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
vec2 srOut(vec2 q, vec2 b, float r){ vec2 d = abs(q) - (b - r), m = max(d, 0.); return m.x + m.y > 1e-4 ? sign(q) * normalize(m) : (d.x > d.y ? vec2(sign(q.x), 0.) : vec2(0., sign(q.y))); }`;

const STONE_ROUND_MAP = `#include <map_fragment>
  const float GAP = .09, RAD = .15; const vec2 SL = vec2(-.7071, -.7071);       // the paving's joint, corner and light
  float srFw = max(length(fwidth(vGW)), 1e-4), srDk = 1. - smoothstep(.02, .09, srFw);
  vec2 srD = vGW.xz - uSr.xy; float srR = length(srD), srAn = atan(srD.y, srD.x + 1e-5) / 6.28318530718 + .5, srNn = uSr.z;
  vec2 srRh = srD / max(srR, 1e-4), srTg = vec2(-srRh.y, srRh.x);
  bool srUp = abs(normalize(cross(dFdx(vGW), dFdy(vGW))).y) > .5;                // a top, or a standing face
  vec2 srW = srUp ? vGW.xz : vec2(srAn * 6.28318530718 * srR, vGW.y);           // where grain and chips are looked up: the standing faces unrolled
  vec2 srQ = vec2(0.), srB = vec2(1e3), srId = vec2(3., 7.); float srSmooth = 1.;
  if (srNn > .5) {
    srSmooth = 0.;
    if (srUp) {
      float r0, r1;
      if (srR >= uSq.z) { r0 = uSq.z; r1 = uSq.w; } else if (srR >= uSq.y) { r0 = uSq.y; r1 = uSq.z; } else { r1 = uSq.y - floor(uSq.y - srR); r0 = max(r1 - 1., 0.); }
      float u = srAn * srNn, k = floor(u), L = 6.28318530718 * srR / srNn;
      srQ = vec2((u - k - .5) * L, srR - (r0 + r1) * .5); srB = vec2(L * .5, (r1 - r0) * .5); srId = vec2(mod(k, srNn), 100. + r0);
    } else {
      float c = floor((vGW.y - uSq.x) / uSr.w), u = srAn * srNn + .5 * mod(c, 2.), k = floor(u), L = 6.28318530718 * srR / srNn;
      srQ = vec2((u - k - .5) * L, vGW.y - uSq.x - (c + .5) * uSr.w); srB = vec2(L * .5, uSr.w * .5); srId = vec2(mod(k, srNn), 200. + c);
    }
  }
  vec2 srHalf = srB - GAP * .5;
  float srDist = srBox(srQ, srHalf, RAD);                                        // < 0 on the stone, > 0 in the joint
  vec2 srNo = srOut(srQ, srHalf, RAD); vec3 srN3 = vec3(0.);
  if (srUp) { srNo = srNo.x * srTg + srNo.y * srRh; srN3 = vec3(srNo.x, 0., srNo.y); }
  else { srN3 = vec3(srNo.x * srTg.x, srNo.y, srNo.x * srTg.y); srNo = srNo.x * srTg + vec2(srNo.y) * SL; }   // a standing face: its top edge catches the light like a top-left edge
  float srGm = smoothstep(-srFw * .75, srFw * .75, srDist) * clamp(GAP / (1.5 * srFw), .15, 1.);
  float srBev = (1. - smoothstep(0., .11, -srDist)) * (1. - srGm) * srDk;
  float srU = srH(srId + .31);
  vec3 srSt = srU < .5 ? uPvBase : srU < .85 ? uPvLight : uPvDeep;               // the field's cream stones
  srSt *= 1. + (srH(srId + 7.7) - .5) * .24;
  srSt *= vec3(1. + (srH(srId + 13.1) - .5) * .06, 1., 1. - (srH(srId + 13.1) - .5) * .06);
  srSt *= 1. + dot(srUp ? srQ.x * srTg + srQ.y * srRh : srQ.x * srTg + vec2(srQ.y) * SL, SL) * .02 * (1. - srSmooth);
  srSt *= 1. + (texture2D(uPaveGrain, srW * .37).r + texture2D(uPaveGrain, mat2(.8, .6, -.6, .8) * srW * .91 + 3.7).r - 1.) * srDk * .22;
  srSt *= 1. + srBev * (max(dot(srNo, SL), 0.) * .2 - max(-dot(srNo, SL), 0.) * .2);
  float srChip = smoothstep(.8, .88, srN(srW * 30. + srId * 5.3)) * (.35 + .65 * srBev) * step(.55, srH(srId + 3.)) * srDk;
  srSt *= 1. - .22 * srChip;
  vec3 srGt = uPvTaupe * (.9 + .2 * srN(srW * 5.)) * mix(.68, 1., smoothstep(0., GAP * .5, srDist));
  srGt *= mix(vec3(1.), vec3(.8, .86, 1.06), uNight);
  vec3 srCol = mix(srSt, srGt, srGm);
  srCol = mix(srCol, mix(uPvBase, uPvTaupe, .1) * .98, smoothstep(.12, .45, srFw) * .7);
  diffuseColor.rgb = srCol * uPaveTint * uPaveWarm * 1.3;
  vec3 srBn = srN3 * srBev * .9;`;
const STONE_ROUND_ROUGH = `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, mix(.34, .66, srGm), uNight * (.6 + .4 * srN(vGW.xz * .45)));`;
const STONE_ROUND_EMIT = `#include <emissivemap_fragment>
  totalEmissiveRadiance += uRim * max(dot(srNo, uSunH), 0.) * srBev;`;

function stoneRoundMaterial({ c, n, h = 1, y0 = 0, rows = [0, 0, 0] }) {
  const m = std(null, 3, { color: 0xffffff });
  m.customProgramCacheKey = () => 'stoneRound';
  m.onBeforeCompile = (sh) => {
    const U = PAVE_U;
    Object.assign(sh.uniforms, {
      uPaveTint: U.uTint, uPaveWarm: U.uWarm, uPaveGrain: { value: TX.paveGrain }, uNight: U.uNight, uRim: U.uRim, uSunH: U.uSunH,
      uPvBase: U.col.base, uPvLight: U.col.light, uPvDeep: U.col.deep, uPvTaupe: U.col.taupe,
      uSr: { value: new THREE.Vector4(c[0], c[1], n, h) }, uSq: { value: new THREE.Vector4(y0, ...rows) },
    });
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = STONE_ROUND_GLSL + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', STONE_ROUND_MAP)
      .replace('#include <roughnessmap_fragment>', STONE_ROUND_ROUGH).replace('#include <emissivemap_fragment>', STONE_ROUND_EMIT)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + (viewMatrix * vec4(srBn, 0.)).xyz);');   // the bevel tilts the surface, so the sun and lamps catch each stone's edge
  };
  return m;
}
