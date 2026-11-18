// TokenFall: life on the ground. Petals, leaves and confetti settle near the plants and float on the water; the paving gets slow dappled light by day, a warm rim in the evening and a faint
// sheen at night (paving.js draws them; this feeds it from the current look); and the sun's shadows get a smoother filter that holds still as the player walks.
// Classic script: shares one global scope with the other js/game files, loaded after ambient.js and before main.js.
// Nothing here adds a Daylight preset key: the strengths come from values the moods already have (lamps, stars, sun height and colour).

// ---------------------------------------------------------------- shadows
// three r128's PCF takes 17 binary compares, so a soft edge is 18 levels that step with the texels (and crawl as the map moves): the dithered, pixelated look. This takes 3 x 3 taps, each one
// bilinear (the four texels around it weighted by where the sample falls), so the edge is a smooth ramp. Taps sit shadowRadius * .7 texels apart (kept whole, so they stay on the texel grid).
{
  const c = THREE.ShaderChunk.shadowmap_pars_fragment, re = /#if defined\( SHADOWMAP_TYPE_PCF \)\s*\n[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))/;
  const smooth = `#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize, f = fract( shadowCoord.xy * shadowMapSize + 0.5 );
			vec2 base = shadowCoord.xy - f * texelSize;
			float stepT = max( 1.0, floor( shadowRadius * 0.7 + 0.5 ) );
			shadow = 0.0;
			for ( int i = -1; i <= 1; i ++ ) for ( int j = -1; j <= 1; j ++ ) {
				vec2 uv = base + vec2( float( i ), float( j ) ) * stepT * texelSize;
				shadow += mix( mix( texture2DCompare( shadowMap, uv, shadowCoord.z ), texture2DCompare( shadowMap, uv + vec2( texelSize.x, 0.0 ), shadowCoord.z ), f.x ),
				               mix( texture2DCompare( shadowMap, uv + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ), f.x ), f.y );
			}
			shadow *= 1.0 / 9.0;
		`;
  if (re.test(c)) THREE.ShaderChunk.shadowmap_pars_fragment = c.replace(re, smooth);
  else console.warn('groundlife: the PCF shadow block was not found, so shadows keep three\'s own filter');
}
// The sun's shadow camera follows the player: snap it to the shadow map's texel grid (along the light's own right and up axes) so an edge stays put while the player walks instead of crawling.
const SHADOW_SPAN = 2 * 20;   // metres across the sun's shadow frustum (effects.js sets +-20 and the 3072 px map)
const snapV = { r: new THREE.Vector3(), u: new THREE.Vector3(), f: new THREE.Vector3(), p: new THREE.Vector3() };
life.push(() => {
  const { r, u, f, p } = snapV, texel = SHADOW_SPAN / sun.shadow.mapSize.x;
  f.copy(SUN_DIR).normalize().negate(); r.crossVectors(f, THREE.Object3D.DefaultUp).normalize(); u.crossVectors(r, f);   // the shadow camera's right and up
  p.copy(camTarget); const a = p.dot(r), b = p.dot(u);
  p.addScaledVector(r, Math.round(a / texel) * texel - a).addScaledVector(u, Math.round(b / texel) * texel - b);
  sun.position.copy(p).add(SUN_DIR); sun.target.position.copy(p);
});

// ---------------------------------------------------------------- the paving's mood
// Dappled light drifts on an anime.js tween (the engine the game loop steps): a slow slide back and forth, never a jump. Held still for reduced motion.
if (!REDUCED_MOTION) anime.animate(PAVE_U.uDapple.value, { x: 40, y: 14, duration: 240000, ease: 'linear', alternate: true, loop: true });
const rimCol = new THREE.Color();
life.push(() => {
  const d = window.TokenFall && TokenFall.daylight, L = d && d.state.p; if (!L) return;
  const night = Math.min(1, Math.max(0, L.stars)), day = 1 - Math.min(1, Math.max(0, L.lamps));
  const tanE = SUN_DIR.y / Math.max(1e-3, Math.hypot(SUN_DIR.x, SUN_DIR.z)), low = Math.min(1, Math.max(0, (.5 - tanE) / .35));   // 1 when the sun is low, 0 when it is high
  PAVE_U.uNight.value = night;
  PAVE_U.uDapple.value.z = day;
  rimCol.set(L.sunColor); PAVE_U.uRim.value.set(rimCol.r, rimCol.g, rimCol.b).multiplyScalar(.35 * low * low * (1 - night));
  PAVE_U.uSunH.value.set(SUN_DIR.x, SUN_DIR.z).normalize();
});

// ---------------------------------------------------------------- petals, leaves and confetti
// Settled ones lie flat on the paving near the plants and round the fountain; a few petals float on the fountain and the pond, drifting slowly. Built once the lobby is dressed.
function buildGroundLife() {
  const onPaving = (x, z) => {
    const [x0, z0, x1, z1] = V_PLAZA, inside = (a, b, c, d) => x > a && x < c && z > b && z < d;
    return inside(x0, z0, x1, z1) || V_ROADS.some(([a, b, c, d]) => inside(a, b, c, d)) || V_PATHS.some(([px, pz, w, dd]) => inside(px - w / 2, pz - dd / 2, px + w / 2, pz + dd / 2));
  };
  const KINDS = [   // chance, size (length, width), palette colours
    [.5, .16, .1, ['blush', 'rose', 'peach', 'butter', 'lilac']],   // petals
    [.3, .22, .1, ['leaf', 'sage']],                                  // leaves
    [.2, .08, .045, ['sky', 'mint', 'coral', 'gold']],                 // confetti
  ];
  const spots = [];
  for (const [x, z, s] of PAVE_U.plants) {
    if (Math.abs(x) > V_HALF || Math.abs(z) > V_HALF) continue;   // the lobby only
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.283, r = rr(.7, 2.4) * Math.max(1, s * .8), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (onPaving(px, pz)) spots.push([px, pz]); }
  }
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, r = rr(3.9, 5.4); spots.push([Math.cos(a) * r, Math.sin(a) * r]); }   // round the fountain
  const pick = () => { let t = rnd(), k = 0; for (const kd of KINDS) { k += kd[0]; if (t < k) return kd; } return KINDS[0]; };
  const make = (n, y) => {
    const geo = new THREE.CircleGeometry(.5, 7).rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, side: THREE.DoubleSide }), n);
    m.receiveShadow = true; m.userData.y = y; scene.add(m); return m;
  };
  const place = (mesh, i, x, y, z, ang, kd) => {
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-.12, .12), ang, rr(-.12, .12))), new THREE.Vector3(kd[1] * rr(.8, 1.2), 1, kd[2] * rr(.8, 1.2)));
    mesh.setMatrixAt(i, mat); mesh.setColorAt(i, new THREE.Color(PAL[kd[3][rnd() * kd[3].length | 0]]));
  };
  const lying = make(spots.length, .04);
  spots.forEach(([x, z], i) => place(lying, i, x, .04 + rnd() * .004, z, rnd() * 6.283, pick()));
  lying.instanceMatrix.needsUpdate = true; lying.instanceColor.needsUpdate = true;
  // afloat: petals only, round the fountain pedestal (water at y .47) and on the pond
  const [pdx, pdz, pdr] = V_POND, FLOAT = [...Array.from({ length: 14 }, () => ({ cx: 0, cz: 0, r: rr(1.7, 2.9), y: .478 })), ...Array.from({ length: 10 }, () => ({ cx: pdx, cz: pdz, r: rr(.6, pdr - .8), y: .062 }))];
  const afloat = make(FLOAT.length, 0);
  FLOAT.forEach((f, i) => { f.a = rnd() * 6.283; f.sp = rr(.02, .05) * (rnd() < .5 ? -1 : 1); f.ph = rnd() * 9; f.spin = rr(-.3, .3); place(afloat, i, f.cx + Math.cos(f.a) * f.r, f.y, f.cz + Math.sin(f.a) * f.r, rnd() * 6.283, KINDS[0]); });
  afloat.instanceColor.needsUpdate = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(.12, 1, .075), ps = new THREE.Vector3(), one = new THREE.Vector3();
  if (!REDUCED_MOTION) life.push((t, dt) => {
    FLOAT.forEach((f, i) => {
      f.a += f.sp * dt;
      ps.set(f.cx + Math.cos(f.a) * f.r, f.y + Math.sin(t * 1.3 + f.ph) * .003, f.cz + Math.sin(f.a) * f.r);
      q.setFromEuler(e.set(Math.sin(t + f.ph) * .05, f.a * 1.5 + t * f.spin, Math.cos(t * .8 + f.ph) * .05));
      afloat.setMatrixAt(i, m4.compose(ps, q, sc.set(.12 * (1 + (i % 3) * .1), 1, .075)));
    });
    afloat.instanceMatrix.needsUpdate = true;
  });
}
// main.js builds the lobby, merges it, then calls buildLife(): the ground's little life is added right after it
const buildLifeBase = buildLife;
buildLife = function () { buildLifeBase(); buildGroundLife(); };
