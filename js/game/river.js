// TokenFall: the lobby river. It runs west to east (+x) under the arched bridge, and you can see it go: ripples and current lines carried
// downstream (faster mid-stream than by the banks), foam lapping along the kerbs, light netting the shallow bed, the mood's own sky and clouds
// mirrored in it, and glints where the sun catches the ripples. It is lit like the rest of the world, so it darkens with the evening, takes the
// bridge's shadow and fades into the haze. Leaves ride the current, fish shadows hold against it, and every so often something leaps: one of
// ten kinds of fish, ten ways (a somersault, a skipping run, a shoal, a flying fish's glide). At the island's edge it pours off into the clouds.
//   riverWater(rect)   called by vRiverAndBridge (lobby-village.js) with the river's rectangle [x0, z0, x1, z1]
// The current's speed, the wrapped flow offsets and the jump planning are plain functions, node-testable (js/game/river-tests.js).
// Classic script (also require()-able): loaded after fountain-water.js (its particles) and before lobby-village.js.

const RIVER = {
  MID: 1.15, EDGE: .42,   // the current downstream, m/s: mid-stream and by the banks
  KERB: .2,               // how far the kerbs reach over the water at each bank (lobby-village.js lays .4 m kerbs on the river's edges)
  DECK: [-2.85, 2.85],    // the footbridge's x extent, walls included (arch-bridge.js: 5 m of deck between .32 m curbs, on x = 0): fish never leap under or over it
  WRAP: 578,              // the flow offsets wrap here. Every pattern repeats over it (lattice noise wrapping at 289 cells, x scales in steps of .5), so the wrap never shows
  DROPS: 6,               // splash rings the water can show at once
  SWIM: 5,                // fish shadows gliding under the surface
  Y: .05,                 // the water's surface
};
// four pattern layers slide downstream: two mid-stream and two by the banks, each pair at slightly different speeds so the water changes shape as it goes
const RIVER_SPEEDS = [RIVER.MID, RIVER.MID * 1.32, RIVER.EDGE, RIVER.EDGE * 1.45];
const riverWrap = (v) => ((v % RIVER.WRAP) + RIVER.WRAP) % RIVER.WRAP;
// how much of the fast mid-stream layer shows at a point across the river (across: 0 mid-stream, 1 at the kerb). The shader blends with the same curve.
const riverMidWeight = (across) => { const t = Math.min(1, Math.max(0, (across - .3) / .55)); return 1 - t * t * (3 - 2 * t); };
const riverFlowAt = (across) => RIVER.EDGE + (RIVER.MID - RIVER.EDGE) * riverMidWeight(Math.abs(across));

// How fish leave the water: how far each leap carries (len, metres), how high it goes (h) and how it moves through the air (river.js stepFish draws it)
const RIVER_LEAPS = {
  leap: { len: [1.3, 2.6], h: [.55, 1.2] },                  // an arc: nose up, then down
  twist: { len: [1.4, 2.4], h: [.8, 1.2] },                  // a barrel roll at the top
  flip: { len: [1.2, 2], h: [1, 1.45] },                     // heels over head: a whole somersault
  skip: { len: [1.3, 2.2], h: [.45, .8] },                   // two or three hops in a line, each lower
  glide: { len: [3.6, 5.6], h: [.32, .5], speed: 4.6 },      // a flying fish: low and long, fins spread like wings
  school: { len: [.8, 1.3], h: [.25, .45] },                 // a shoal of little fish breaking the surface one after another
  pop: { len: [.15, .45], h: [.45, .75] },                   // a pufferfish: straight up, puffed round, and down
};
// A fish jump somewhere the player can see it: where it leaves the water (x, z), where it lands (ex, ez), how high (h) and how long it flies (dur).
// rand() gives 0-1. river: { x0, x1, zc, hw } (hw: half the open water's width, kerbs excluded); hero: { x, z }; style: a RIVER_LEAPS key. Null when the
// river is out of view: the camera looks north, so from across the river (or far south of it) there is nothing to watch.
function riverPlanJump(rand, hero, river, style = 'leap') {
  const { x0, x1, zc, hw } = river, lane = hw - .75, L = RIVER_LEAPS[style] || RIVER_LEAPS.leap;   // fish keep clear of the kerbs
  if (hero.z < zc - 2 || hero.z > zc + 26) return null;
  for (let tries = 0; tries < 16; tries++) {
    const x = Math.max(x0 + 4, Math.min(x1 - 4, hero.x + (rand() * 2 - 1) * 9)), z = zc + (rand() * 2 - 1) * lane;
    const a = rand() < .7 ? Math.PI + (rand() * 2 - 1) * .6 : (rand() * 2 - 1) * Math.PI;   // most leap upstream, against the current
    const len = L.len[0] + rand() * (L.len[1] - L.len[0]), ex = x + Math.cos(a) * len, ez = z + Math.sin(a) * len;
    if (Math.abs(ez - zc) > lane || ex < x0 + 3 || ex > x1 - 3) continue;
    if (Math.min(x, ex) < RIVER.DECK[1] + 1.2 && Math.max(x, ex) > RIVER.DECK[0] - 1.2) continue;   // never under the bridge or over it
    const h = L.h[0] + rand() * (L.h[1] - L.h[0]);
    return { x, z, ex, ez, h, style, dur: L.speed ? len / L.speed : 2 * Math.sqrt(2 * h / 9.8) * (1 + .1 * rand()) };
  }
  return null;
}
// a little seeded random of its own: the lobby's rnd() sequence must not move (everything after the river would shift)
const riverRng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---------------------------------------------------------------- the water's shader (added to a MeshStandardMaterial)
const RIVER_HEAD = `#define RIVER_DROPS ${RIVER.DROPS}
#define RIVER_SWIM ${RIVER.SWIM}
uniform float uT, rStars, uLip;
uniform vec4 uOff, uRiv;   // uRiv: the river's middle (z) and half its open width
uniform vec2 uFlow;
uniform vec4 uDrops[RIVER_DROPS], uSwim[RIVER_SWIM];
uniform vec3 rHorizon, rZenith, rSunCol, rCloudCol, rCloudShade, rSunDir, uBank;
varying vec3 vRW;
vec3 rNrm, rEmit, rSunLit; float rRough;
// hashing and noise on a lattice that wraps every 289 cells, so the sliding patterns repeat exactly (RIVER.WRAP)
float rHash(vec2 p) { p = mod(p, 289.); vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float rNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(rHash(i), rHash(i + vec2(1., 0.)), u.x), mix(rHash(i + vec2(0., 1.)), rHash(i + vec2(1., 1.)), u.x), u.y); }
// value noise and its gradient: x the value, yz d/dx and d/dy
vec3 rNoiseD(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f), du = 6. * f * (1. - f);
  float a = rHash(i), b = rHash(i + vec2(1., 0.)), c = rHash(i + vec2(0., 1.)), d = rHash(i + vec2(1., 1.)), k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x)); }
// cells with drifting centres: the nearest and the second nearest distance (their gap is small along the cells' borders)
vec2 rCell(vec2 p, float t) { vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), h = vec2(rHash(i + g), rHash(i + g + 57.)), o = g + .5 + .38 * sin(t + 6.2831 * h) - f;
    float d = dot(o, o); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(vec2(d1, d2)); }
float rFbm(vec2 p) { return rNoise(p) * .55 + rNoise(p * 2.1 + 7.3) * .3 + rNoise(p * 4.3 + 1.7) * .15; }
// flow dashes: in each cell (1 m along the current, .25 m across, rows staggered) a short thin streak that brightens and fades as it slides downstream.
// mpp: metres per pixel, so a dash never gets thinner than about a pixel (it dims instead)
float rDash(vec2 p, float t, float mpp) {
  vec2 c = p * vec2(1., 4.); c.x += rHash(vec2(floor(c.y), 5.)); vec2 i = floor(c), f = fract(c);
  float h1 = rHash(i + 3.1), h2 = rHash(i + 8.7), h3 = rHash(i + 1.9), w = max(.05, mpp * 3.2);
  float on = step(.4, h3) * max(0., sin(t * (.5 + h3 * .8) + h1 * 6.283));
  return on * smoothstep(1., .35, abs(f.x - .5) / (.16 + h1 * .2)) * smoothstep(w, w * .25, abs(f.y - .3 - .4 * h2)) * min(1., .05 / w);
}
// the sky dome's colour toward d (effects.js draws the same sky): what the water mirrors
vec3 rSky(vec3 d) {
  float h = max(d.y, 0.), l = dot(rHorizon, vec3(.3, .59, .11)), day = smoothstep(.2, .55, l);
  vec3 top = mix(rHorizon * .55, rZenith, day), mid = mix(rHorizon, top, .5) + vec3(.05, 0., .07) * day;
  vec3 c = mix(mix(rHorizon, mid, smoothstep(0., .4, h)), top, smoothstep(.3, .95, h));
  float s = max(dot(d, rSunDir), 0.);
  c += rSunCol * (pow(s, 8.) * .3 + pow(s, 300.) * 1.2) * day + rSunCol * pow(s, 900.) * 3. * rStars;
  float sh = rHash(floor(d.xz / (h + .12) * 90.));
  c += vec3(.9, .93, 1.) * step(.993, sh) * rStars * smoothstep(.06, .35, h) * (.6 + .4 * sin(uT * 2. + sh * 60.)) * .7;
#ifndef RIVER_LITE
  vec2 q = d.xz / (h + .2) * 1.5 + vec2(uT * .005, uT * .0015);
  float n = rFbm(q), cover = smoothstep(.46, .78, n), under = smoothstep(.52, .92, rFbm(q * 1.6 + vec2(3.1, uT * .002)));
  vec3 lit = mix(vec3(1., .96, .92), rSunCol, .3) * mix(vec3(1.), rCloudCol, .6), shade = mix(lit * .8, rHorizon, .4) * rCloudShade;
  c = mix(c, mix(lit, shade, under * .75), cover * smoothstep(.01, .26, h) * day * .92);
#endif
  return c;
}
`;
const RIVER_SURFACE = `
  {
    vec2 P = vRW.xz;
    float zc = uRiv.x, hw = uRiv.y;
    float across = clamp(abs(P.y - zc) / hw, 0., 1.), edgeD = max(hw - abs(P.y - zc), 0.);
    float wMid = 1. - smoothstep(.3, .85, across);   // riverMidWeight
    vec2 pM1 = vec2(P.x - uOff.x, P.y), pM2 = vec2(P.x - uOff.y, P.y + 17.), pE1 = vec2(P.x - uOff.z, P.y), pE2 = vec2(P.x - uOff.w, P.y - 9.);
    float mpp = max(length(fwidth(P)), 1e-4), fine = 1. - smoothstep(.015, .06, mpp);   // metres per pixel: fine detail fades out before it can shimmer

    // ---- the surface's slope: ripples drawn out along the current and carried down it ----
    vec3 n1 = rNoiseD(pM1 * vec2(.5, 1.5)), n2 = rNoiseD(pM2 * vec2(1.5, 3.5)), n3 = rNoiseD(pE1 * vec2(1., 2.)), n4 = rNoiseD(pE2 * vec2(2.5, 3.5));
    vec2 slope = mix(n3.yz * vec2(1., 2.) * .035 + n4.yz * vec2(2.5, 3.5) * .015, n1.yz * vec2(.5, 1.5) * .06 + n2.yz * vec2(1.5, 3.5) * .02, wMid) * (.45 + .55 * fine);

    // ---- splash rings (a fish leaving or landing), drifting with the current ----
    float dropFoam = 0.;
    for (int i = 0; i < RIVER_DROPS; i++) {
      vec4 D = uDrops[i]; float age = uT - D.z;
      if (D.w <= 0. || age < 0. || age > 3.5) continue;
      float sp = mix(uFlow.y, uFlow.x, 1. - smoothstep(.3, .85, clamp(abs(D.y - zc) / hw, 0., 1.)));
      vec2 dv = P - vec2(D.x + sp * age, D.y); float r = length(dv) + 1e-3, front = .12 + age * 1.1;
      float env = D.w * exp(-age * 1.3) * smoothstep(front + .04, front - .35, r);
      slope += dv / r * cos((r - front) * 26.) * env * .45 / (1. + r * 1.5);
      dropFoam += D.w * (exp(-abs(r - front) / .03) * exp(-age * 2.4) * .9 + smoothstep(.12 + age * .3, 0., r) * (1. - smoothstep(.15, .8, age)));
    }
    rNrm = normalize(vec3(-slope.x, 1., -slope.y));

    // ---- colour: pale over the shallow bed by the banks, a deeper teal mid-stream ----
    float deep = 1. - smoothstep(.15, .95, across);
    vec3 col = mix(vec3(.55, .79, .74), vec3(.41, .69, .69), smoothstep(0., .55, deep));
    col = mix(col, vec3(.3, .58, .62), smoothstep(.55, 1., deep));
    float bed = rNoise(P * 2.5 + 7.) * .6 + rNoise(P * 6.) * .4;   // stones on the bed, seen through the shallows
    col *= 1. + (1. - deep) * (bed - .5) * .16;
    // fish under the surface: soft dark shapes holding against the current, tails beating (uSwim: x, z, heading, strength)
    float shade = 0.;
    for (int i = 0; i < RIVER_SWIM; i++) {
      vec4 F = uSwim[i]; vec2 d = P - F.xy;
      if (F.w <= 0. || dot(d, d) > .36) continue;
      float ca = cos(F.z), sa = sin(F.z), tail = 0.; vec2 q = vec2(d.x * ca + d.y * sa, d.y * ca - d.x * sa);   // q.x along the fish, nose forward
      tail = smoothstep(.05, -.36, q.x); q.y -= sin(uT * 9. + F.x * 3. - q.x * 8.) * .045 * tail;
      float body = smoothstep(1., .45, length(vec2(q.x / .3, q.y / mix(.075, .03, tail))));
      float fin = smoothstep(.02, -.02, abs(q.y) - (-.26 - q.x) * .7) * step(-.44, q.x) * step(q.x, -.26);
      shade = max(shade, max(body, fin * .8) * F.w);
    }
    col = mix(col, col * vec3(.5, .6, .66), shade * .8);

    // flow dashes: short bright streaks sliding downstream, quick mid-stream and lazy by the banks
    float dash = (rDash(pM1, uT, mpp) * wMid + rDash(pE1 + vec2(0., .13), uT * .8, mpp) * (1. - wMid) * .7) * (.5 + .5 * fine);
    // foam along the kerbs: a ragged band that laps in and out, broken up, with a haze of bubbles beyond it
    float b1 = rNoise(pE1 * vec2(1.5, 4.)), b2 = rNoise(pE2 * vec2(4.5, 7.));
    float band = smoothstep(.42, .04, edgeD + (b1 - .5) * .45 - .07 * sin(uT * 2.3 + P.x * 1.4 + b1 * 4.));
    // soft foam trails mid-stream, snaking downstream
    float ft = rNoise(pM1 * vec2(.5, 2.5) + 40.) * .7 + rNoise(pM2 * vec2(1.5, 5.) + 11.) * .3, trail = smoothstep(.7, .86, ft) * wMid * .32;
    float foam = clamp(band * smoothstep(.38, .62, b2 * .75 + band * .45) + smoothstep(.9, .2, edgeD) * smoothstep(.55, .8, b2) * .3 + dropFoam + trail * (.6 + .4 * b2), 0., 1.);
    // the island's edge: the water quickens and whitens as it reaches the lip and pours over
    float lip = smoothstep(uLip - 3.4, uLip - .05, P.x);
    foam = max(foam, lip * smoothstep(.62, .82, b2 * .55 + rNoise(pM2 * vec2(3., 2.)) * .45 + lip * .3));
    dash *= 1. + lip * 2.;

    // a faint net of light on the shallow bed (caustics), wavering, drifting with the slow water
    float caus = 0.;
#ifndef RIVER_LITE
    float shallow = smoothstep(.55, .95, across) * fine;
    if (shallow > .01) {
      vec2 k = rCell(pE1 * 1.5 + (vec2(n3.x, n4.x) - .5) * .7, uT * .8);
      caus = (1. - smoothstep(0., .1, k.y - k.x)) * shallow;
    }
#endif

    // ---- the sky in it: more of it the flatter you look ----
    vec3 V = normalize(cameraPosition - vRW), R = reflect(-V, rNrm); R.y = abs(R.y) + .02; R = normalize(R);
    float fres = .04 + .96 * pow(1. - clamp(dot(rNrm, V), 0., 1.), 5.), refl = clamp(.1 + fres * 1.2, 0., .9) * (1. - foam * .85);
    vec3 sky = rSky(R); sky = mix(vec3(dot(sky, vec3(.3, .59, .11))), sky, .75);   // a little softened, to sit with the pastels
    // the kerb mirrored at the water's edge: a reflected ray that reaches the kerb's face before it clears its top sees stone, not sky
    float side = R.z < 0. ? -1. : 1., toKerb = (hw - (P.y - zc) * side) / max(abs(R.z), 1e-3);
    sky = mix(sky, uBank, 1. - smoothstep(.24, .34, toKerb * R.y));

    // glints: here and there a ripple catches the sun for a moment
    vec2 g = pM1 * 3.5, gi = floor(g), gf = fract(g);
    float gr = rHash(gi + 31.), gsz = max(.09, mpp * 3.8);
    float tw = pow(max(0., sin(uT * (1.7 + gr * 2.6) + rHash(gi + 71.) * 6.283)), 30.);
    float glint = tw * smoothstep(gsz, gsz * .3, length(gf - vec2(rHash(gi + 13.), rHash(gi + 5.)) * .7 - .15)) * step(.62, gr)
      * (.35 + .65 * smoothstep(.03, .15, length(slope))) * (1. - smoothstep(.03, .09, mpp)) * (1. - foam);
    float sunPath = pow(max(dot(R, rSunDir), 0.), 350.) * 5. + pow(max(dot(R, rSunDir), 0.), 40.) * .25;   // the sun (or the moon) itself, broken up by the ripples

    col = mix(col, vec3(.95, .98, .97), foam) + dash * .28 * (1. - foam);
    diffuseColor.rgb = col * (1. - refl);
    rEmit = sky * refl;
    rSunLit = vec3(glint * 3.2 + sunPath * (1. - foam) + caus * .12 * (1. - foam));
    rRough = mix(.1, .85, foam);
  }
`;
// the sun's share (glints, the sun's path, caustics) is shadowed: none of it under the bridge or a tree
const RIVER_SUNLIT = `
#if NUM_DIR_LIGHTS > 0
  {
    float rShade = 1.;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if (receiveShadow) rShade = getShadow(directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ]);
  #endif
    totalEmissiveRadiance += rSunLit * directionalLights[ 0 ].color * rShade;
  }
#endif
`;
function riverMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .1, metalness: 0 });
  if (Q.name === 'low') m.defines = { RIVER_LITE: '' };   // phones and weak machines: no caustics, no clouds in the reflection
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uT: timeU, rHorizon: skyU.horizon, rZenith: skyU.zenith, rSunCol: skyU.sunCol, rCloudCol: skyU.cloudCol, rCloudShade: skyU.cloudShade, rStars: skyU.stars, rSunDir: skyU.sunDir });
    sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    const f = sh.fragmentShader, swap = (s, a, b) => { if (!s.includes(a)) console.warn('river: shader chunk not found: ' + a); return s.replace(a, a + '\n' + b); };
    let out = swap(f, '#include <color_fragment>', RIVER_SURFACE);
    out = swap(out, '#include <roughnessmap_fragment>', 'roughnessFactor = rRough;');
    out = swap(out, '#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(rNrm, 0.)).xyz);');
    out = swap(out, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += rEmit;');
    out = swap(out, '#include <lights_fragment_end>', RIVER_SUNLIT);
    sh.fragmentShader = RIVER_HEAD + out;
  };
  return m;
}

// ---------------------------------------------------------------- the fish
// Who lives in the river. cols: base, patch, belly, fin (and an accent): palette names or hex. size: nose to tail is about .7 m times this.
// look: how the back is marked. shape: 'slim' (sardines, flying fish), 'round' (the pufferfish). tail: 'fork', 'fan' (a goldfish's veil), 'tiny'. wings: long side fins.
const RIVER_FISH = {
  koi: { cols: ['cream', 'coral', 'cream', 'peach'], size: 1.1, look: 'saddles' },
  tancho: { cols: ['cream', 'coral', 'cream', 'cream'], size: 1, look: 'crown' },
  showa: { cols: ['cream', 'coral', 'cream', 'peach', 'plum'], size: 1.05, look: 'showa' },
  gold: { cols: ['gold', '#e39a4c', 'butter', 'butter'], size: .8, look: 'back', tail: 'fan' },
  blue: { cols: ['periwinkle', '#8a9fd6', 'cream', 'sky'], size: .9, look: 'back' },
  rainbow: { cols: ['sage', '#8fa889', 'cream', 'sage', 'rose'], size: 1, look: 'stripe' },
  ghost: { cols: ['lilac', 'periwinkle', '#f3eefc', 'lilac'], size: 1, look: 'back' },
  sardine: { cols: ['sky', '#93b4cc', '#f2f6f8', 'sky'], size: .42, look: 'back', shape: 'slim' },
  flying: { cols: ['periwinkle', '#7f97d0', 'cream', 'sky'], size: .85, look: 'back', shape: 'slim', wings: true },
  puffer: { cols: ['butter', 'sage', 'cream', 'butter'], size: .7, look: 'spots', shape: 'round', tail: 'tiny' },
};
// one fish as a single mesh, nose along +x, its colours baked into the vertices
function riverFishGeo(spec) {
  const [base, patch, belly, fin, accent] = spec.cols.map((h) => new THREE.Color(h[0] === '#' ? h : PAL[h]));
  const round = spec.shape === 'round', slim = spec.shape === 'slim', L = round ? .2 : .27, H = round ? .16 : slim ? .06 : .078, W = round ? .15 : slim ? .045 : .056;
  const paint = (g, fn) => {
    const p = g.attributes.position, c = new Float32Array(p.count * 3), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(t, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g.index ? g.toNonIndexed() : g;
  };
  const tris = (pts, colour) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return paint(g, (t) => t.copy(colour)); };
  // the body: a sphere drawn out along x, round at the head, tapering to the tail (a pufferfish hardly tapers at all)
  const body = new THREE.SphereGeometry(1, 24, 16), bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), taper = x < 0 ? 1 + x * (round ? .25 : .6) : 1 - x * x * .2;
    bp.setXYZ(i, x * L, (bp.getY(i) * H + .01 * (1 - x * x)) * taper, bp.getZ(i) * W * taper);
  }
  body.computeVertexNormals();
  const parts = [paint(body, (t, x, y, z) => {
    const u = x / L, top = y > -.2 * H;
    if (y < -.28 * H) return t.copy(belly);
    switch (spec.look) {
      case 'saddles': return t.copy(y > .15 * H + .012 * Math.sin(z * 90 + u * 5) && ((u > .3 && u < .78) || (u > -.42 && u < .08)) ? patch : base);
      case 'crown': return t.copy(y > .2 * H && (u - .66) * (u - .66) * 9 + (z / W) * (z / W) * 1.6 < 1 ? patch : base);   // one round red spot on the head
      case 'showa': return t.copy(top && Math.sin(u * 9 + z * 40) > .55 ? accent : y > .15 * H && (u > .25 && u < .7) ? patch : base);
      case 'stripe': return t.copy(Math.abs(y + .05 * H) < .16 * H ? accent : y > .3 * H ? patch : base);   // a blush stripe down the side
      case 'spots': return t.copy(top && Math.sin(u * 23) * Math.sin(z * 70 + u * 4) > .45 ? patch : base);
      default: return t.copy(base).lerp(patch, Math.min(1, Math.max(0, y / H)));   // a darker back
    }
  })];
  const tx = -L * .82;   // where the tail fin starts
  if (spec.tail === 'fan') parts.push(tris([[tx, .03, 0], [tx - .26, .17, 0], [tx - .32, .05, 0], [tx, .03, 0], [tx - .32, .05, 0], [tx - .32, -.06, 0], [tx, .03, 0], [tx - .32, -.06, 0], [tx, -.03, 0], [tx, -.03, 0], [tx - .32, -.06, 0], [tx - .26, -.16, 0]], fin));   // a goldfish's veil
  else if (spec.tail === 'tiny') parts.push(tris([[tx + .02, .03, 0], [tx - .08, .07, 0], [tx - .08, -.06, 0], [tx + .02, .03, 0], [tx - .08, -.06, 0], [tx + .02, -.03, 0]], fin));
  else parts.push(tris([[tx, .028, 0], [tx - .21, .135, 0], [tx - .14, 0, 0], [tx, .028, 0], [tx - .14, 0, 0], [tx, -.028, 0], [tx, -.028, 0], [tx - .14, 0, 0], [tx - .21, -.12, 0]], fin));   // forked
  parts.push(tris([[.06 * L / .27, H + .002, 0], [-.13 * L / .27, H * .72, 0], [-.05 * L / .27, H + .067 * (round ? .5 : 1), 0]], fin));   // the dorsal fin
  for (const s of [-1, 1]) parts.push(spec.wings
    ? tris([[.1, -.01, .03 * s], [-.02, -.01, .04 * s], [-.2, .02, .4 * s], [.1, -.01, .03 * s], [-.2, .02, .4 * s], [.02, .01, .34 * s]], fin)   // flying fish: wings
    : tris([[.1 * L / .27, -.45 * H, (W * .65) * s], [.015, -.64 * H, (W * .8) * s], [-.01, -.9 * H, (W + .07) * s]], fin));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(round ? .024 : .017, 10, 8); e.translate(L * .7, H * .32, W * .76 * s); parts.push(paint(e, (t) => t.set(PAL.plum))); }
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let k = 0;
  for (const p of parts) { const A = p.attributes; pos.set(A.position.array, k * 3); nor.set(A.normal.array, k * 3); col.set(A.color.array, k * 3); k += A.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}

// ---------------------------------------------------------------- the waterfall off the island's east edge
// the falling sheet: streaks pouring down it, glassy up top, whiter and breaking into drops lower down, lit by the mood (lit: the light's colour and
// strength, about 1 by day). fall: how far the streaks have slid, wrapped (riverFall keeps it under 144.5 so the noise repeats exactly)
function riverFallMat() {
  return new THREE.ShaderMaterial({
    uniforms: { fall: { value: 0 }, lit: { value: new THREE.Color(1, 1, 1) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal);
      vF = 1. - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float fall; uniform vec3 lit; varying vec2 vUv; varying float vF;
      float rHash(vec2 p) { p = mod(p, 289.); vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float rNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
        return mix(mix(rHash(i), rHash(i + vec2(1., 0.)), u.x), mix(rHash(i + vec2(0., 1.)), rHash(i + vec2(1., 1.)), u.x), u.y); }
      void main(){
        float u = vUv.x * 46., v = vUv.y, flow = v * 7. - fall;
        float s = rNoise(vec2(u, flow * 2.)) * .6 + rNoise(vec2(u * 2. + 5., flow * 4. + 3.)) * .5, streak = smoothstep(.45, .9, s);
        float sides = smoothstep(0., .05, vUv.x) * smoothstep(1., .95, vUv.x), drops = smoothstep(.25, .65, rNoise(vec2(u * 1.5, flow * 6.)) + (1. - v) * 1.7);
        float al = (.95 - .5 * v) * (.6 + .4 * streak) * sides * drops * (1. - smoothstep(.7, 1., v));
        vec3 c = mix(vec3(.55, .8, .78), vec3(1.), clamp(streak * .7 + v * .55 + vF * .2, 0., 1.));
        gl_FragColor = vec4(c * lit, clamp(al, 0., .95)); }`,
  });
}
// lipX: where the water leaves the island; [za, zb]: the stream's width; waterMat: the river's own material (the lip is the river's surface carried over the hem)
function riverFall(lipX, za, zb, waterMat) {
  const Y = RIVER.Y, HEM = .118, g = new THREE.BufferGeometry(), pos = [], idx = [];
  // the lip: from the river's surface up over the quilted hem (dreamworld.js: 1.8 m wide, its top at y .1) to the edge
  for (const [x, y] of [[lipX - 2.3, Y], [lipX - 1.95, HEM], [lipX, HEM], [lipX + .06, HEM - .02]]) pos.push(x, y, za, x, y, zb);
  for (let i = 0; i < 3; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const lip = new THREE.Mesh(g, waterMat); lip.receiveShadow = true; lip.userData.dyn = true; scene.add(lip);
  // the sheet: thrown out at 1.7 m/s, falling freely, widening a little; finer rows near the top where it bends
  const N = 30, T = Math.sqrt((HEM + 16) / 4.9), sp = [], suv = [], sid = [];
  for (let k = 0; k <= N; k++) {
    const v = Math.pow(k / N, 1.6), t = v * T, x = lipX + .06 + 1.7 * t, y = HEM - .02 - 4.9 * t * t, spread = 1 + .12 * v;
    const zm = (za + zb) / 2, hz = (zb - za) / 2 * spread;
    sp.push(x, y, zm - hz, x, y, zm + hz); suv.push(0, v, 1, v);
    if (k < N) { const a = k * 2; sid.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2)); sg.setIndex(sid); sg.computeVertexNormals();
  const fallMat = riverFallMat(), sheet = new THREE.Mesh(sg, fallMat); sheet.renderOrder = 3; sheet.userData.dyn = true; scene.add(sheet);
  // spray thrown off the lip, and mist rolling off the falling water
  const soft = (n, a0, a1) => canvasTex(n, n, (c) => { const r = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, `rgba(255,255,255,${a0})`); r.addColorStop(.5, `rgba(240,250,255,${a1})`); r.addColorStop(1, 'rgba(240,250,255,0)'); c.fillStyle = r; c.fillRect(0, 0, n, n); }, { smooth: true, keep: true });
  const drops = fwParticles(scene, 140, soft(32, 1, .85), .09, .9), mist = fwParticles(scene, 60, soft(64, .8, .35), 2.6, .45);
  let acc = 0, mAcc = 0;
  const lightRef = .86, light = new THREE.Color(), sunPart = new THREE.Color();
  return (t, dt) => {
    fallMat.uniforms.fall.value = (t * 2.2) % 144.5;
    light.copy(hemi.color).multiplyScalar(hemi.intensity * .7).add(sunPart.copy(sun.color).multiplyScalar(sun.intensity * .5)).multiplyScalar(1 / lightRef);
    fallMat.uniforms.lit.value.copy(light); drops.material.color.copy(light); mist.material.color.copy(light);
    if (Math.abs(hero.x - lipX) < 30 && !REDUCED_MOTION) {   // only worth throwing when someone can see it
      acc += dt; mAcc += dt;
      while (acc > 1 / 40) { acc -= 1 / 40; const z = za + Math.random() * (zb - za); drops.emit(lipX + .05, HEM, z, 1.4 + Math.random() * 1.4, .2 + Math.random() * .9, (Math.random() - .5) * .6, 1.5, .7 + Math.random() * .6, 9.8, -9); }
      // mist boils up off the falling water and over the edge, where it can be seen from the island
      while (mAcc > .1) { mAcc -= .1; const y = -.5 - Math.random() * 4, tt = Math.sqrt((HEM - y) / 4.9); mist.emit(lipX + .06 + 1.7 * tt + Math.random() * .5, y, za + Math.random() * (zb - za), .2 + Math.random() * .35, .45 + Math.random() * .6, (Math.random() - .5) * .5, 3 + Math.random() * 2, .7 + Math.random() * .7, 0); }
    }
    drops.step(dt); mist.step(dt);
  };
}

// ---------------------------------------------------------------- the river
function riverWater(rect) {
  const [x0, z0, x1, z1] = rect, zc = (z0 + z1) / 2, hw = (z1 - z0) / 2 - RIVER.KERB, Y = RIVER.Y;
  const U = {
    uOff: { value: new THREE.Vector4() }, uRiv: { value: new THREE.Vector4(zc, hw, RIVER.DECK[0], RIVER.DECK[1]) }, uFlow: { value: new THREE.Vector2(RIVER.MID, RIVER.EDGE) },
    uDrops: { value: Array.from({ length: RIVER.DROPS }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uSwim: { value: Array.from({ length: RIVER.SWIM }, () => new THREE.Vector4(0, 0, 0, 0)) }, uBank: { value: new THREE.Color() }, uLip: { value: x1 + .06 },
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), riverMaterial(U));
  water.rotation.x = -Math.PI / 2; water.position.set((x0 + x1) / 2, Y, zc); water.receiveShadow = true; water.userData.dyn = true; scene.add(water);
  // the east end is the island's edge: the river pours off it
  const stepFall = riverFall(x1, zc - hw - .05, zc + hw + .05, water.material);
  const off = U.uOff.value, kerb = new THREE.Color(.72, .7, .66), light = new THREE.Color(), sunPart = new THREE.Color();
  anim.push((t) => {
    if (zone !== 'lobby') return;
    off.set(riverWrap(RIVER_SPEEDS[0] * t), riverWrap(RIVER_SPEEDS[1] * t), riverWrap(RIVER_SPEEDS[2] * t), riverWrap(RIVER_SPEEDS[3] * t));
    // the kerb's face as the water mirrors it: lit mostly by the sky, a little by the sun, so it follows the mood
    light.copy(hemi.color).multiplyScalar(hemi.intensity * .8).add(sunPart.copy(sun.color).multiplyScalar(sun.intensity * .25));
    U.uBank.value.copy(kerb).multiply(light);
  });
  let nDrop = 0;
  const addDrop = (x, z, amt, t) => { U.uDrops.value[nDrop].set(x, z, t, amt); nDrop = (nDrop + 1) % RIVER.DROPS; };

  // ---- leaves and petals riding the current, turning slowly, out under the arch and on downstream ----
  const rng = riverRng(9157), LEAVES = 30, ls = new THREE.Shape();
  ls.moveTo(-.5, 0); ls.quadraticCurveTo(0, .34, .5, 0); ls.quadraticCurveTo(0, -.34, -.5, 0);
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(ls, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .75, side: THREE.DoubleSide }), LEAVES);
  leaves.receiveShadow = true; leaves.frustumCulled = false; leaves.userData.dyn = true; scene.add(leaves);
  const LEAF_COLS = [PAL.leaf, PAL.sage, PAL.leaf, PAL.butter, PAL.gold], PETAL_COLS = [PAL.blush, PAL.rose, PAL.peach], tint = new THREE.Color();
  const L = Array.from({ length: LEAVES }, (_, i) => {
    const petal = rng() < .35, f = { x: x0 + (i + rng()) / LEAVES * (x1 - x0), lane: (rng() * 2 - 1) * (hw - .4), ang: rng() * 6.283, spin: (rng() - .5) * .7, ph: rng() * 9, s: .3 + rng() * .14, petal };
    leaves.setColorAt(i, tint.set((petal ? PETAL_COLS : LEAF_COLS)[rng() * (petal ? 3 : 5) | 0])); return f;
  });
  leaves.instanceColor.needsUpdate = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  const placeLeaves = (t, dt) => {
    for (let i = 0; i < LEAVES; i++) {
      const f = L[i];
      f.x += riverFlowAt(f.lane / hw) * dt; if (f.x > x1 - 1.5) f.x -= x1 - x0 - 3;
      f.ang += f.spin * dt;
      ps.set(f.x, Y + .012 + Math.sin(t * 2.1 + f.ph) * .005, zc + f.lane + Math.sin(t * .6 + f.ph) * .12);
      q.setFromEuler(e.set(Math.sin(t * 1.7 + f.ph) * .08, f.ang, Math.cos(t * 1.3 + f.ph) * .08));
      leaves.setMatrixAt(i, m4.compose(ps, q, sc.set(f.s * (f.petal ? .65 : 1), 1, f.s * (f.petal ? 1.25 : 1))));
    }
    leaves.instanceMatrix.needsUpdate = true;
  };
  placeLeaves(0, 0);

  // ---- fish under the surface: they hold against the current near the player, sway, and now and then dart off. One swims up before every leap. ----
  const SW = Array.from({ length: RIVER.SWIM }, (_, i) => ({ bx: 0, bz: zc, x: 0, z: zc, a: Math.PI, ph: i * 2.1, w: 0, want: 0, dart: null, lead: null, back: null, next: 3 + i * 2 }));
  const spot = (near) => { let x = Math.max(x0 + 3, Math.min(x1 - 3, near + (Math.random() * 2 - 1) * 11)); if (Math.abs(x) < RIVER.DECK[1] + .8) x = (x < 0 ? -1 : 1) * (RIVER.DECK[1] + .8 + Math.random() * 2.5); return [x, zc + (Math.random() * 2 - 1) * (hw - .6)]; };
  const ease = (k) => k * k * (3 - 2 * k);
  function stepSwimmers(t, dt) {
    for (let i = 0; i < SW.length; i++) {
      const s = SW[i];
      if (s.lead) {   // swimming up to where it will leap, then gone (it is in the air)
        const k = Math.min(1, (t - s.lead.t0) / (s.lead.t1 - s.lead.t0)), e = ease(k);
        s.x = s.lead.x0 + (s.lead.x - s.lead.x0) * e; s.z = s.lead.z0 + (s.lead.z - s.lead.z0) * e; s.a = Math.atan2(s.lead.z - s.lead.z0, s.lead.x - s.lead.x0);
        if (k >= 1) { s.lead = null; s.w = s.want = 0; }
      } else if (s.back) {   // back in the water where it landed, carrying on the way it leapt
        if (t >= s.back.t) { s.bx = s.back.x; s.bz = s.back.z; s.a = s.back.a; s.w = .8; s.want = .7; s.dart = { t0: t, x0: s.bx, z0: s.bz, x: s.bx + Math.cos(s.a) * 1.6, z: Math.max(zc - hw + .6, Math.min(zc + hw - .6, s.bz + Math.sin(s.a) * 1.6)), a: s.a, dur: .7 }; s.back = null; }
      } else {
        if (Math.abs(s.bx - hero.x) > 14 || s.want === 0) {   // too far from the player: fade out, then turn up near them
          s.want = 0; if (s.w < .02) { [s.bx, s.bz] = spot(hero.x); s.want = .5 + Math.random() * .3; s.a = Math.PI; }
        }
        if (s.dart) {
          const k = Math.min(1, (t - s.dart.t0) / s.dart.dur), e = 1 - (1 - k) * (1 - k);
          s.bx = s.dart.x0 + (s.dart.x - s.dart.x0) * e; s.bz = s.dart.z0 + (s.dart.z - s.dart.z0) * e; s.a = s.dart.a;
          if (k >= 1) s.dart = null;
        } else if (t > s.next) {   // a dart: a quick spurt upstream or across, then hold again
          s.next = t + 5 + Math.random() * 9;
          const a = Math.PI + (Math.random() * 2 - 1) * 1.1, d = 1.2 + Math.random() * 2;
          s.dart = { t0: t, x0: s.bx, z0: s.bz, x: s.bx + Math.cos(a) * d, z: Math.max(zc - hw + .6, Math.min(zc + hw - .6, s.bz + Math.sin(a) * d)), a, dur: .5 + d * .15 };
          if (Math.abs(s.dart.x) < RIVER.DECK[1] + .6) s.dart = null;
        } else s.a += (Math.PI + Math.sin(t * .4 + s.ph) * .3 - s.a) * Math.min(1, dt * 2);   // holding: nose upstream, swaying
        s.x = s.bx + Math.sin(t * .23 + s.ph) * .5; s.z = s.bz + Math.sin(t * .31 + s.ph * 1.3) * .2;
      }
      s.w += (s.want - s.w) * Math.min(1, dt * 1.6);
      U.uSwim.value[i].set(s.x, s.z, s.a, s.w);
    }
  }
  // the one nearest the leap swims up to it
  function leadTo(j, t) {
    let best = null, bd = 1e9;
    for (const s of SW) { if (s.lead || s.back || s.w < .2) continue; const d = Math.hypot(s.x - j.x, s.z - j.z); if (d < bd && d < 6) { bd = d; best = s; } }
    if (best) { best.lead = { t0: t, t1: t + .35, x0: best.x, z0: best.z, x: j.x, z: j.z }; best.dart = null; best.back = { t: t + .35 + j.dur, x: j.ex, z: j.ez, a: Math.atan2(j.ez - j.z, j.ex - j.x) }; }
  }

  // ---- the fish ----
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .1, side: THREE.DoubleSide });
  fishMat.onBeforeCompile = (sh) => {   // the tail beats; the back half of the body follows it a little
    sh.uniforms.uT = timeU;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tw = smoothstep(-.06, -.42, transformed.x);
      transformed.z += sin(uT * 26.) * .085 * tw * tw + sin(uT * 26. - 1.3) * .018 * smoothstep(.12, -.22, transformed.x);`);
  };
  // the river's population: a couple of koi and goldfish, one of each of the rest, and a shoal of sardines
  const FISH = [];
  for (const [kind, n] of [['koi', 2], ['tancho', 1], ['showa', 1], ['gold', 2], ['blue', 1], ['rainbow', 1], ['ghost', 1], ['flying', 1], ['puffer', 1], ['sardine', 6]]) {
    const geo = riverFishGeo(RIVER_FISH[kind]);
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, fishMat); m.rotation.order = 'YZX'; m.castShadow = true; m.receiveShadow = true; m.visible = false; m.userData.dyn = true; scene.add(m); FISH.push({ m, j: null, kind }); }
  }
  const BIG = ['koi', 'koi', 'tancho', 'showa', 'gold', 'gold', 'blue', 'rainbow', 'ghost'];
  const freeFish = (kinds) => { const f = FISH.filter((k) => !k.j && kinds.includes(k.kind)); return f.length ? f[Math.random() * f.length | 0] : null; };
  const dropTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.5, 'rgba(235,250,255,.85)'); r.addColorStop(1, 'rgba(235,250,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }, { smooth: true, keep: true });
  const spray = fwParticles(scene, 240, dropTex, .1, .95);
  const burst = (x, z, n, up, out) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = out * (.3 + Math.random() * .7); spray.emit(x + Math.cos(a) * .07, Y + .01, z + Math.sin(a) * .07, Math.cos(a) * s, up * (.55 + Math.random() * .45), Math.sin(a) * s, 1.1, .6 + Math.random() * .6, 7.5, Y); } };
  const splash = (x, z, vol) => { const a = window.TokenFall && TokenFall.ambience; if (a && a.splash && hero) a.splash(vol * Math.max(0, 1 - Math.hypot(x - hero.x, z - hero.y) / 24) ** 1.5); };
  const R = { x0, x1, zc, hw };
  const clearOfBridge = (a, b) => !(Math.min(a, b) < RIVER.DECK[1] + 1.2 && Math.max(a, b) > RIVER.DECK[0] - 1.2);
  const inLane = (z) => Math.abs(z - zc) < hw - .75;
  // a leap: a swirl where it will break the surface (big fish swim up to it first), out with a splash, through the air its own way, back in with a bigger one.
  // o: { delay, hops (more short leaps after this one), quiet (no sound: one of a shoal), lead (a shadow swims up to it) }
  function launch(f, j, t, o = {}) {
    const size = RIVER_FISH[f.kind].size * (.9 + Math.random() * .2), t0 = t + (o.delay || 0) + .35;
    f.j = Object.assign({ t0, hops: o.hops || 0, stage: 0, size, quiet: !!o.quiet }, j);
    addDrop(j.x, j.z, .3 * (.4 + .6 * size), t + (o.delay || 0)); if (o.lead) leadTo(j, t);
  }
  function stepFish(f, t) {
    const j = f.j, u = (t - j.t0) / j.dur, s = j.size, big = .4 + .6 * s;
    if (u < 0) return;
    if (j.stage === 0) { j.stage = 1; f.m.visible = true; f.m.scale.setScalar(s); addDrop(j.x, j.z, .7 * big, t); burst(j.x, j.z, Math.round(14 * big), 2.4 * big, .5 * big); if (!j.quiet) splash(j.x, j.z, .45 * big); }
    if (u >= 1 && j.stage === 1) {
      j.stage = 2; addDrop(j.ex, j.ez, big, t); burst(j.ex, j.ez, Math.round(26 * big), 3.1 * big, .75 * big); if (!j.quiet) splash(j.ex, j.ez, big);
      if (j.hops > 0) {   // skipping along: a shorter, lower leap straight on from where it landed
        const dx = j.ex - j.x, dz = j.ez - j.z, nx = j.ex + dx * .65, nz = j.ez + dz * .65;
        if (inLane(nz) && nx > x0 + 3 && nx < x1 - 3 && clearOfBridge(j.ex, nx)) {
          const h = j.h * .55; f.j = Object.assign({}, j, { x: j.ex, z: j.ez, ex: nx, ez: nz, h, dur: 2 * Math.sqrt(2 * h / 9.8), t0: t + .06, hops: j.hops - 1, stage: 1 }); return;
        }
      }
    }
    if (u > 1.3) { f.m.visible = false; f.j = null; return; }
    const dx = j.ex - j.x, dz = j.ez - j.z, len = Math.hypot(dx, dz), sink = .09 * s, k = Math.min(1, Math.max(0, (u - .12) / .76)), e = k * k * (3 - 2 * k);
    let y, pitch, roll = Math.sin(u * 6.283) * .22, yaw = Math.atan2(-dz, dx);
    if (j.style === 'glide') {   // up quickly, a long low skim with the wings out, then down
      const lift = u < .14 ? Math.sin(u / .14 * Math.PI / 2) : u > .86 ? Math.max(0, Math.sin((1 - u) / .14 * Math.PI / 2)) : 1;
      y = Y - sink + (j.h + sink) * lift * (1 - .25 * u) + Math.sin(u * 19) * .02; pitch = u < .14 ? .35 : u > .86 ? -.45 : -.05; roll = Math.sin(t * 7) * .12;
    } else {
      const lift = j.h + sink; y = Y - sink + lift * 4 * u * (1 - u); pitch = Math.atan2(lift * 4 * (1 - 2 * u), Math.max(len, .3)) * .9;
      if (j.style === 'twist') roll += e * 6.283;                      // a barrel roll
      if (j.style === 'flip') pitch -= e * 6.283;                      // a somersault
      if (j.style === 'pop') { pitch *= .25; yaw += u * 2.4; f.m.scale.setScalar(s * (1 + .5 * Math.sin(Math.min(1, u) * Math.PI))); }   // up, puffed round, turning
    }
    f.m.position.set(j.x + dx * u, y, j.z + dz * u);
    f.m.rotation.set(roll, yaw, pitch);
  }
  // what the river does next: mostly one fish of the big kinds, now and then a pair, a skipping run, a somersault, a shoal, a flying fish or the pufferfish
  const EVENTS = [['leap', 30], ['twist', 10], ['flip', 8], ['skip', 10], ['pair', 10], ['school', 14], ['glide', 11], ['pop', 7]];
  function fishEvent(t, kind) {
    const style = kind === 'pair' ? 'leap' : kind, plan = riverPlanJump(Math.random, { x: hero.x, z: hero.y }, R, style);
    if (!plan) return false;
    if (kind === 'school') {   // four to six little fish breaking the surface one after another along the same line
      const n = 4 + (Math.random() * 3 | 0), dx = plan.ex - plan.x, dz = plan.ez - plan.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      for (let i = 0; i < n; i++) {
        const f = freeFish(['sardine']); if (!f) break;
        const side = (Math.random() * 2 - 1) * .22, ox = -ux * i * .32 - uz * side, oz = -uz * i * .32 + ux * side, x = plan.x + ox, z = plan.z + oz;
        if (!inLane(z) || !inLane(z + dz) || !clearOfBridge(x, x + dx)) continue;
        const h = plan.h * (.85 + Math.random() * .3);
        launch(f, Object.assign({}, plan, { x, z, ex: x + dx, ez: z + dz, h, dur: 2 * Math.sqrt(2 * h / 9.8) }), t, { delay: i * .11, quiet: i % 2 === 1 });
      }
      return true;
    }
    const kinds = kind === 'glide' ? ['flying'] : kind === 'pop' ? ['puffer'] : BIG, f = freeFish(kinds);
    if (!f) return false;
    launch(f, plan, t, { lead: true, hops: kind === 'skip' ? 1 + (Math.random() < .45) : 0 });
    if (kind === 'pair') {   // a second fish leaps beside the first, a beat later and a little lower
      const mate = freeFish(BIG), side = Math.random() < .5 ? -1 : 1, sz = plan.z + side * .7, sez = plan.ez + side * .7;
      if (mate && inLane(sz) && inLane(sez)) launch(mate, Object.assign({}, plan, { z: sz, ez: sez, h: plan.h * .8, dur: plan.dur * .9 }), t, { delay: .25 });
    }
    return true;
  }
  let nextJump = 3;
  life.push((t, dt) => {
    if (zone !== 'lobby') { for (const f of FISH) if (f.j) { f.j = null; f.m.visible = false; } return; }
    if (!REDUCED_MOTION) { placeLeaves(t, dt); stepSwimmers(t, dt); }
    stepFall(t, dt);
    for (const f of FISH) if (f.j) stepFish(f, t);
    spray.step(dt);
    if (REDUCED_MOTION || traveling || playerLocked || t < nextJump) return;
    nextJump = t + 3.5 + Math.random() * 6.5;
    let r = Math.random() * EVENTS.reduce((a, e) => a + e[1], 0), kind = EVENTS[0][0];
    for (const [k, w] of EVENTS) { if ((r -= w) < 0) { kind = k; break; } }
    fishEvent(t, kind);
  });
  // for poking at it from the console: lobbyRiver.jump() leaps where the player can see it, or jump({ x, z, ex, ez, h })
  window.lobbyRiver = {
    U, water, fish: FISH, swimmers: SW, spray, addDrop,
    settle() { for (const s of SW) { [s.bx, s.bz] = spot(hero.x); s.x = s.bx; s.z = s.bz; s.w = s.want = .65; s.lead = s.back = s.dart = null; } },
    event: (kind) => fishEvent(T, kind),
    jump(o, kind = 'koi') {
      const f = freeFish([kind]); if (!f) return false;
      const j = Object.assign({ h: .9, style: 'leap' }, o); j.dur = j.dur || (j.style === 'glide' ? Math.hypot(j.ex - j.x, j.ez - j.z) / 4.6 : 2 * Math.sqrt(2 * j.h / 9.8)); launch(f, j, T, { lead: true }); return true;
    },
  };
  return water;
}

if (typeof module === 'object' && module.exports) module.exports = { RIVER, RIVER_SPEEDS, RIVER_LEAPS, RIVER_FISH, riverWrap, riverMidWeight, riverFlowAt, riverPlanJump, riverRng, RIVER_HEAD, RIVER_SURFACE };
