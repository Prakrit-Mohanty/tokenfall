// TokenFall — time of day. Browser: window.Daylight. Node: require('./daylight.js') (the pure part: the four moods and the blend between them).
//
// Four moods — Morning, Afternoon, Evening, Night — are keyframes on a 24 h clock; any hour in between is a smooth blend, so the Daylight Console beside the Token Brew robot can snap to a mood or
// slide through the day (and let it pass by itself). A mood sets the sun (colour, strength, where it stands, so the shadows swing), the sky and fog, the fill light, how bright the street lamps
// and lit windows are, and the colour grade of the whole picture. Everything is read from one parameter object, so the look of a mood lives in PRESETS and nowhere else.
//   Daylight.at(hour)                 -> the blended parameters for an hour (0-24, any real)
//   Daylight.adjust(params, { bright, warm })   the player's brightness / warmth sliders (-1..1)
//   Daylight.nameOf(hour) / clock(hour) / MOODS
//   Daylight.install(TF)              the world part: the console, the panel, applying the parameters to the lights, sky, fog and post
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Daylight = api;
})(this, function () {
  // ---------------------------------------------------------------- pure: the moods
  // sunDir: where the sun (or the moon) stands relative to what the camera looks at: +x east-ish, +y up, +z towards the player. mul / shadow / hi: the grade's overall tint, its shadow tint and its highlight tint.
  const PRESETS = {
    morning: {   // fresh and cozy: a pale peach-pink haze that softens the distance, a low soft-peach sun from the east-north-east (~22°), so long shadows fall across the plaza toward the viewer, a cool blue-lavender fill, lavender in the darks, lamps going out
      sunDir: [30, 12.5, -6], sunColor: '#ffe8d6', sunI: 0.95, hemiSky: '#c9cfee', hemiGround: '#a6a2b8', hemiI: 0.72, fog: '#f3dcd8', fogNear: 20, fogFar: 82, zenith: '#7aa6e4', stars: 0, cloud: '#fff4f0', cloudShade: [1.03, 0.95, 0.95], paveTint: '#fff1e6',
      lamps: 0.35, glow: 0.5, lampPool: 0.45, curve: 0.24, cloudShadow: 0.12, indoor: 1.05, exposure: 1, mul: [1, 1, 1], shadow: [0.94, 0.95, 1.07], hi: [1.03, 1, 0.97], sat: 1.16, vig: 0.7, bloom: 0.22, bloomKnee: [1.2, 2.4], shafts: 1.4, dust: 0.6,
      charGain: 0.6, charLamp: 0.3, charMin: 0.55, charMax: 1.1,   // the sprites' light: scene ambient + sun scaled by charGain, plus the nearest lamp, kept between charMin and charMax
      lift: [0.012, 0.012, 0.014],
      grassA: '#c0d09f', grassB: '#83bb95', grassEdge: '#5f7b69',   // the lawn: a lighter yellow-green, a deeper blue-green, the shade at its edges (sage, leaf, teal, periwinkle mixes)
    },
    afternoon: {   // clear, bright and shapely: a light-blue haze layering the distance under a deep blue zenith, a soft-cream sun from the west-north-west (~47°: shadows fall sideways and toward the viewer, where the camera sees them, and give shape), a cool blue-lavender fill and sage bounce, lavender in the darks
      sunDir: [-24, 26, -6], sunColor: '#fff4ea', sunI: 0.95, hemiSky: '#c4d0f0', hemiGround: '#9cad9a', hemiI: 0.68, fog: '#cfe2f2', fogNear: 28, fogFar: 92, zenith: '#5a9de8', stars: 0, cloud: '#ffffff', cloudShade: [0.94, 0.95, 1.05], paveTint: '#fff6ea',
      lamps: 0.3, glow: 0.45, lampPool: 0.4, curve: 0.26, cloudShadow: 0.16, indoor: 1, exposure: 0.76, mul: [1, 1, 1], shadow: [0.95, 0.96, 1.06], hi: [1.01, 1, 0.99], sat: 1.13, vig: 0.7, bloom: 0.2, bloomKnee: [1.2, 2.4], shafts: 1.1, dust: 0.5,
      charGain: 0.6, charLamp: 0.3, charMin: 0.55, charMax: 1.1,   // the sprites' light: scene ambient + sun scaled by charGain, plus the nearest lamp, kept between charMin and charMax
      lift: [0.01, 0.01, 0.012],
      grassA: '#b8cd9b', grassB: '#7fb895', grassEdge: '#5d7869',   // the lawn: a lighter yellow-green, a deeper blue-green, the shade at its edges (sage, leaf, teal, periwinkle mixes)
    },
    evening: {   // golden hour into dusk: a low orange sun from the west, long warm shadows, the lamps come on
      sunDir: [-34, 7, 4], sunColor: '#ff9a58', sunI: 0.85, hemiSky: '#c8a4b0', hemiGround: '#6a5858', hemiI: 0.88, fog: '#d09a86', fogNear: 26, fogFar: 80, zenith: '#6a6aa0', stars: 0, cloud: '#ffd2c0', cloudShade: [0.95, 0.92, 1.03], paveTint: '#e9ffee',
      lamps: 1, glow: 0.8, lampPool: 0, curve: 0.15, cloudShadow: 0, indoor: 0.88, exposure: 0.96, mul: [1.06, 0.98, 0.9], shadow: [0.95, 0.9, 1], hi: [1.08, 0.99, 0.88], sat: 1.15, vig: 0.8, bloom: 0.25, bloomKnee: [1.2, 2.4], shafts: 1.5,dust: 0.6,
      charGain: 0.66, charLamp: 0.3, charMin: 0.55, charMax: 1.1,   // the sprites' light: scene ambient + sun scaled by charGain, plus the nearest lamp, kept between charMin and charMax
      lift: [0.014, 0.012, 0.016],
      grassA: '#b4cb92', grassB: '#7db393', grassEdge: '#5f7669',   // the lawn: a lighter yellow-green, a deeper blue-green, the shade at its edges (sage, leaf, teal, periwinkle mixes)
    },
    night: {   // moonlit: a blue moon, stars, warm pools of lamplight and lit windows
      sunDir: [12, 22, -12], sunColor: '#a8bcf0', sunI: 0.5, hemiSky: '#4c5c98', hemiGround: '#323650', hemiI: 0.8, fog: '#1c2244', fogNear: 22, fogFar: 82, zenith: '#0a1030', stars: 1, cloud: '#7a76b8', cloudShade: [0.95, 0.92, 1.03], paveTint: '#f0eeff',
      lamps: 1.4, glow: 1, lampPool: 0, curve: 0.15, cloudShadow: 0, indoor: 0.6, exposure: 1.06, mul: [0.97, 0.98, 1.05], shadow: [0.82, 0.88, 1.15], hi: [1.03, 1, 0.95], sat: 1, vig: 1, bloom: 0.4, bloomKnee: [1.2, 2.4], shafts: 0,dust: 1,
      charGain: 0.62, charLamp: 0.3, charMin: 0.55, charMax: 1.1,   // the sprites' light: scene ambient + sun scaled by charGain, plus the nearest lamp, kept between charMin and charMax
      lift: [0.01, 0.012, 0.03],
      grassA: '#b8cdb4', grassB: '#98b0a2', grassEdge: '#6a6b80',   // the lawn: a lighter yellow-green, a deeper blue-green, the shade at its edges (sage, leaf, teal, periwinkle mixes)
    },
  };
  const MOODS = [['morning', 8, 'Morning', '🌅'], ['afternoon', 14, 'Afternoon', '☀️'], ['evening', 18.5, 'Evening', '🌇'], ['night', 22.5, 'Night', '🌙']];
  // the night holds until half past four, then the morning comes up: a keyframe each, hours past 24 meaning the next day
  const KEYS = [[8, 'morning'], [14, 'afternoon'], [18.5, 'evening'], [22.5, 'night'], [28.5, 'night'], [32, 'morning']];

  const hex3 = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a + (b - a) * t;
  // Colours keep their colourfulness through a blend: mixed channel by channel, two different hues (peach haze into blue, amber dusk into navy) pass through grey
  // or brown halfway. So the mix keeps its own hue and lightness but gets back most of the saturation the two ends had (never more than the richer end).
  const hsvOf = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h, mx ? d / mx : 0, mx]; };
  const fromHsv = ([h, s, v]) => { const f = (n) => { const k = (n + h) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
  function colourMix(x, y, t) {
    const a = hex3(x), b = hex3(y), m = a.map((v, i) => mix(v, b[i], t)), hm = hsvOf(m);
    if (hm[1] < 1e-3) return toHex(m);   // a grey mix of two greys: nothing to restore
    return toHex(fromHsv([hm[0], mix(hm[1], mix(hsvOf(a)[1], hsvOf(b)[1], t), 0.6), hm[2]]));   // 60% of the lost saturation back: dusk turns plum, not raspberry
  }
  // The sun travels across the sky between two moods (its compass bearing the short way round, its height in between) instead of cutting straight
  // between the two directions, which would swing it nearly overhead at late morning and flatten every shadow.
  function sunMix(x, y, t) {
    const pol = ([a, b, c]) => { const r = Math.hypot(a, b, c); return [Math.atan2(a, -c), Math.asin(b / r), r]; };
    const [az0, el0, r0] = pol(x), [az1, el1, r1] = pol(y); let d = az1 - az0; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    const az = az0 + d * t, el = mix(el0, el1, t), r = mix(r0, r1, t);
    return [Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r];
  }
  function blend(a, b, t) {
    if (t <= 0) return Object.assign({}, a);
    if (t >= 1) return Object.assign({}, b);   // the keyframes come back exactly
    const out = {};
    for (const k in a) {
      const x = a[k], y = b[k];
      const same = x === y || (Array.isArray(x) && x.every((v, i) => v === y[i]));   // a value both ends share (the night holding till dawn) stays exactly itself
      out[k] = same ? (Array.isArray(x) ? x.slice() : x) : typeof x === 'number' ? mix(x, y, t) : k === 'sunDir' ? sunMix(x, y, t) : Array.isArray(x) ? x.map((v, i) => mix(v, y[i], t)) : colourMix(x, y, t);
    }
    return out;
  }
  const wrap = (h) => { h = ((h % 24) + 24) % 24; return h < 8 ? h + 24 : h; };   // 8 <= h < 32
  function at(hour) {
    const h = wrap(hour); let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const [h0, n0] = KEYS[i], [h1, n1] = KEYS[i + 1], u = (h - h0) / (h1 - h0), t = u * u * (3 - 2 * u);
    return blend(PRESETS[n0], PRESETS[n1], t);
  }
  // the player's sliders: brightness scales the exposure, warmth leans the whole grade towards amber (or, below zero, towards blue)
  function adjust(p, o = {}) {
    const b = o.bright || 0, w = o.warm || 0, q = Object.assign({}, p);
    // brighter washes colour toward white: a little more saturation holds it
    q.exposure = p.exposure * (1 + 0.3 * b); q.sat = p.sat * (1 + 0.08 * Math.max(0, b)); q.mul = [p.mul[0] * (1 + 0.07 * w), p.mul[1], p.mul[2] * (1 - 0.12 * w)]; return q;
  }
  const nameOf = (hour) => { const h = ((hour % 24) + 24) % 24; return h >= 5 && h < 11.5 ? 'Morning' : h >= 11.5 && h < 16.5 ? 'Afternoon' : h >= 16.5 && h < 20.5 ? 'Evening' : 'Night'; };
  const clock = (hour) => { const m = Math.round((((hour % 24) + 24) % 24) * 60) % 1440, h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };

  // ---------------------------------------------------------------- the world (browser only)
  const INDOOR = { lab: 1, abz: 1, kitchen: 1 };   // roofed places: their light comes from lamps; the sky only tints it
  const SPOT = { x: 20.9, z: -8.65 };              // the console, in front of the Token Brew wall just east of the robot barista's counter

  function install(TF) {
    const { THREE, scene, sun, hemi, MAT, post, skyU, SUN_DIR } = TF;
    const S = { hour: 15, bright: 0, warm: 0, sketch: 0.7, auto: false, open: false, zone: 'lobby', base: null, orb: null, face: null, drawn: '', acc: 0 };
    try { Object.assign(S, JSON.parse(localStorage.getItem('tokenfall.daylight') || '{}')); } catch (e) { /* private window: the default day */ }
    { const h = parseFloat(new URLSearchParams(location.search).get('hour')); if (h >= 0 && h < 24) { S.hour = h; S.auto = false; } }   // ?hour=21 starts at that hour, held
    S.open = false;
    const save = () => { try { localStorage.setItem('tokenfall.daylight', JSON.stringify({ hour: S.hour, bright: S.bright, warm: S.warm, sketch: S.sketch, auto: S.auto })); } catch (e) { /* not saved */ } };
    // glare: strong emitters were set far too hot, so they are eased (SOFT), and the solid-colour ones (strips, lamps, lanterns) follow the day: dim by day, bright at night. The named
    // lamp and window materials move the whole way; every other emitter found at boot keeps at least half its light, so a portal or a game marker never goes dark.
    const SOFT = 0.6, glowMats = [[MAT.warmGlow], [MAT.redLantern], [MAT.glass], [MAT.glassLit], [MAT.shade]].filter((m) => m[0]).map(([m]) => [m, m.emissiveIntensity * (m.emissiveIntensity > 1.4 ? SOFT : 1)]);
    const emitters = [];
    function collectEmitters() {
      const known = new Set(glowMats.map((m) => m[0])), seen = new Set();
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (!m || !m.isMeshStandardMaterial || known.has(m) || seen.has(m) || m.emissiveIntensity < 1.1) continue;
          seen.add(m); const base = m.emissiveIntensity * SOFT;
          if (m.emissiveMap) m.emissiveIntensity = base;   // a lit sign or screen: eased, always readable
          else emitters.push([m, base]);
        }
      });
    }
    const col = (c, s) => c.set(s), tint = new THREE.Color(), tint2 = new THREE.Color();

    // what the zone itself asked for (setZone / the zone's env), recorded when it is entered, so a slider never compounds on its own output
    const record = () => { S.base = { sun: sun.intensity, hemi: hemi.intensity, hemiColor: hemi.color.clone(), fog: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far }; };
    // a game is open when it has put its '<name>-on' class on #ui, or in the bridge (a game you walk through); the interface hides its lobby furniture then (storybook.css, #ui[data-play])
    const uiEl = () => document.getElementById('ui');
    const inPlay = (z) => { const u = uiEl(); const on = z === 'bridge' || (!!u && /-on\b/.test(u.className)); if (u) { u.dataset.play = on ? '1' : ''; u.dataset.walk = z === 'bridge' ? '1' : ''; } return on; };   // walk: a game you walk through keeps the key strip (storybook.css)
    // A look is everything the scene is shown with: the mood's parameters plus the "e..." values that depend on where the player is (roofed or open). It holds only numbers,
    // [numbers] and '#hex' strings, so blend() can ease between any two looks: moods, zones, a game opening.
    const hexOf = (c) => '#' + c.getHexString();
    function target() {
      if (!S.base) record();
      const z = S.zone, inside = !!INDOOR[z], b = S.base, play = inPlay(z);
      // while a game is open its words and pieces must read: the mood eases a third of the way to plain afternoon (brighter night, lighter vignette and bloom), and the ink thins out
      const p = adjust(play ? blend(at(S.hour), at(14), 0.35) : at(S.hour), S);
      // roofed places do not brighten their picture at night, they dim with the day outside: their light is the lamps
      const eExp = inside ? 0.88 * (1 + 0.3 * S.bright) * (0.65 + 0.35 * p.indoor) : p.exposure;
      const L = Object.assign({}, p, {
        eSun: inside ? b.sun * p.indoor : p.sunI, eHemi: inside ? b.hemi * p.indoor : p.hemiI,
        eHemiCol: inside ? hexOf(tint.copy(b.hemiColor).lerp(tint2.set(p.hemiSky), 0.3)) : p.hemiSky,
        eFog: z === 'kitchen' ? hexOf(tint.copy(b.fog).multiplyScalar(Math.min(1, p.indoor))) : p.fog,
        eNear: inside ? b.near : p.fogNear, eFar: inside ? b.far : p.fogFar,
        eExp,
        // bloomKnee is in on-screen brightness: divided by the exposure (without the player's brightness slider) it becomes the scene-value knee the bright pass uses
        eKnee: p.bloomKnee.map((v) => v * (1 + 0.3 * S.bright) / eExp),
        eSketch: S.sketch * (play ? 0.5 : z === 'kitchen' ? 0.6 : 1),   // the kitchen's small labels and gauges carry gameplay information
        eLamp: inside ? 0.85 + 0.15 * p.lamps : p.lamps,
        eGlow: inside ? 0.6 + 0.4 * p.glow : p.glow,   // roofed places keep their lamps on all day
      });
      return { L, inside, z };
    }
    // put a look on the scene: the lights, sky, fog, post grade, lamps, greenery and the sprites' light
    function show(L, inside, z) {
      SUN_DIR.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]).setLength(32);
      col(sun.color, L.sunColor); sun.intensity = L.eSun;
      hemi.groundColor.set(L.hemiGround); hemi.color.set(L.eHemiCol); hemi.intensity = L.eHemi;
      scene.fog.color.set(L.eFog); scene.fog.near = L.eNear; scene.fog.far = L.eFar; scene.background.copy(scene.fog.color);
      skyU.zenith.value.set(L.zenith); skyU.sunCol.value.set(L.sunColor); skyU.cloudCol.value.set(L.cloud); skyU.cloudShade.value.set(...L.cloudShade); skyU.stars.value = L.stars;
      TF.shaftMat.uniforms.amt.value = L.shafts; if (TF.dust) TF.dust.material.opacity = 0.8 * L.dust;
      const u = post; u.exposure.value = L.eExp; u.gradeMul.value.set(...L.mul); u.shadowTint.value.set(...L.shadow); u.hiTint.value.set(...L.hi); u.sat.value = L.sat; u.vig.value = L.vig; u.bloomAmt.value = L.bloom; u.bloomKnee.value.set(L.eKnee[0], L.eKnee[1]);
      u.sketch.value = L.eSketch; u.curveAmt.value = L.curve; u.cloudAmt.value = L.cloudShadow; u.lift.value.set(...L.lift);
      for (const l of TF.ZONE_LIGHTS[z] || []) if (l.isLight && l.userData.base != null) l.intensity = l.userData.base * L.eLamp;
      for (const [m, base] of glowMats) m.emissiveIntensity = base * L.eGlow;
      for (const [m, base] of emitters) m.emissiveIntensity = base * Math.max(0.55, L.eGlow);
      for (const m of POOLS) { m.material.opacity = L.lampPool; m.visible = L.lampPool > 0.01; }
      TF.POOL_MAT.opacity = 0.95 * Math.min(1, L.lamps);   // the soft pools of light under the lamps come up with them
      // the grass clumps and ferns follow the hour as a lighter cousin of the lawn (the lawn colour 60% of the way to white), so they read against it; clover and flowers keep their own colours. Nothing is emissive.
      for (const m of TF.GREEN_MATS) if (m.userData.lawn) m.color.set(L.grassA).lerp(tint2.set('#ffffff'), 0.6);
      // the lawn is lit by hemi + sun only: its mood colours (a lighter yellow-green, a deeper blue-green, the shade at its edges) go to the grass shader
      TF.PAVE_U.uTint.value.set(L.paveTint);   // the paving's mood colour: a near-white tint over the near-neutral paver texture (geometry.js)
      const gu = TF.GRASS_U; gu.uA.value.set(L.grassA); gu.uB.value.set(L.grassB); gu.uShade.value.set(L.grassEdge);
      // what lights a sprite: the ambient and the sun the scene is actually using right now (so zones, moods and the sliders all carry through), scaled; characters.js adds the nearest lamp and clamps it
      const cl = TF.charLight; cl.color.copy(tint.copy(hemi.color).multiplyScalar(hemi.intensity).add(tint2.copy(sun.color).multiplyScalar(sun.intensity))).multiplyScalar(L.charGain);
      cl.lamp = L.charLamp; cl.min = L.charMin; cl.max = L.charMax;
      S.p = L; S.inside = inside; if (TF.dream) TF.dream.apply(L, inside, z); if (TF.ambience) TF.ambience.apply(L, inside, z); draw(L);
    }
    // apply(ms): ms = 0 puts the look on at once (sliders, the passing day: they change a little every frame already); ms > 0 eases from the look on screen to the new one,
    // for jumps: a mood button, a zone change, a game opening. A new ease replaces the one in flight; a change that lands mid-ease (the day passing, a slider) just moves its destination.
    let ease = null, dest = null;
    function apply(ms = 0) {
      const { L, inside, z } = target();
      if (!ms && ease) { dest = { L, inside, z }; return; }
      const was = S.cur;
      if (!ms || !was) { S.cur = L; show(L, inside, z); return; }
      dest = { L, inside, z };
      show(was, inside, z);   // hold the old look through the frame a zone change has just reset the lights on
      const prog = { t: 0 };
      ease = TF.tween(prog, { t: 1 }, ms, {
        onUpdate: () => { S.cur = blend(was, dest.L, prog.t); show(S.cur, dest.inside, dest.z); },
        onComplete: () => { S.cur = dest.L; S.drawn = ''; show(dest.L, dest.inside, dest.z); ease = null; },   // S.drawn: the dial redraws once with the settled colours
      });
    }

    // the old sky dust was a cloud of hard squares (huge when one drifts past the camera): soft round glows instead
    function softDust() { const m = TF.dust && TF.dust.material; if (!m) return; m.map = TF.TX.glow; m.size = 0.18; m.alphaTest = 0; m.needsUpdate = true; }
    // ---- atmosphere: fireflies at night, leaves drifting by day (light shafts only where light really comes through: the HQ's windows) ----
    const AIR = { flies: null, leaves: null };
    // ---- daytime light pools: a soft disc of each outdoor lamp's own colour on the ground beneath it, so lamps and the café read as lit even in sunshine.
    // Their strength is the mood's lampPool (0 at evening and night, where the lamps' real light does this).
    const POOLS = [];
    function buildPools() {
      const geo = new THREE.CircleGeometry(1, 32); geo.rotateX(-Math.PI / 2);
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), solid = scene.children.filter((o) => o.isMesh && !o.userData.dyn);
      // the ground under a lamp (plaza slabs, steps and lawns all sit at different heights): the first solid surface below the light
      const groundAt = (x, z, y) => { ray.set(new THREE.Vector3(x, y - 0.3, z), down); const hit = ray.intersectObjects(solid, false)[0]; return hit ? hit.point.y : 0; };
      for (const z of ['lobby', 'pune']) for (const l of TF.ZONE_LIGHTS[z] || []) {
        if (!l.isPointLight || l.position.y < 2.3 || l.position.y > 4.5) continue;   // hung lamps and the café; not the portals' low coloured lights, which glow on their own
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: TF.TX.glow, color: l.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.scale.setScalar(Math.min(2.6, (l.distance || 7) * 0.3)); m.position.set(l.position.x, groundAt(l.position.x, l.position.z, l.position.y) + 0.03, l.position.z); m.visible = false; m.userData.dyn = true; scene.add(m); POOLS.push(m);
      }
    }
    function buildAir() {
      const pts = (n, size, color, additive) => {
        const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 36; a[i * 3 + 1] = 0.3 + Math.random() * 2.4; a[i * 3 + 2] = -14 + Math.random() * 17; }
        g.setAttribute('position', new THREE.BufferAttribute(a, 3));
        const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: TF.TX.glow, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));   // TX.glow: a soft round dot, never a square
        p.frustumCulled = false; p.userData.dyn = true; p.visible = false; scene.add(p); return p;
      };
      AIR.flies = pts(70, 0.3, 0xdfff8a, true); AIR.leaves = pts(34, 0.2, 0xd9a85a, false);
      AIR.seed = Array.from({ length: 104 }, () => Math.random() * 100);
    }
    function driftAir(t, dt, p, inside) {
      const hx = TF.hero.x, hz = TF.hero.y, show = (obj, on, op) => { obj.visible = on; if (on) obj.material.opacity = op; };
      const night = p.stars > 0.3, day = p.stars < 0.5;
      show(AIR.flies, !inside && night, 0.85 * p.stars * (0.75 + 0.25 * Math.sin(t * 3)));
      show(AIR.leaves, !inside && day, 0.9);
      for (const [obj, spd, rise] of [[AIR.flies, 0.5, 0], [AIR.leaves, 1.1, -0.35]]) {
        if (!obj.visible) continue;
        const a = obj.geometry.attributes.position, off = obj === AIR.flies ? 0 : 70;
        for (let i = 0; i < a.count; i++) {
          const sd = AIR.seed[off + i];
          let x = a.getX(i) + Math.sin(t * 0.7 * spd + sd) * 0.6 * dt * spd + 0.25 * dt, y = a.getY(i) + (rise + Math.sin(t * 1.3 + sd) * 0.18) * dt, z = a.getZ(i) + Math.cos(t * 0.6 * spd + sd * 2) * 0.5 * dt * spd;
          if (y < 0.1) y = 2.6; if (y > 2.8) y = 0.3;
          x = hx + ((x - hx + 18) % 36 + 36) % 36 - 18; z = hz - 14 + (((z - hz + 14) % 17) + 17) % 17; a.setXYZ(i, x, y, z);   // ahead of the hero, never between them and the camera
        }
        a.needsUpdate = true;
      }
    }

    // ---- the console: a brass post with a round sky dial that shows where the sun (or the moon) is ----
    function build() {
      const g = new THREE.Group(); g.position.set(SPOT.x, 0, SPOT.z); scene.add(g);
      const brass = new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.45, metalness: 0.5 }), wood = new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 0.8 });
      const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
      add(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 16), wood, 0, 0.07, 0); add(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 10), brass, 0, 0.65, 0);
      const dial = new THREE.Group(); dial.position.set(0, 1.5, 0.06); dial.rotation.x = -0.28; g.add(dial);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 28), brass); rim.castShadow = true; dial.add(rim);
      const c = document.createElement('canvas'); c.width = c.height = 256; S.canvas = c; S.tex = new THREE.CanvasTexture(c);
      S.face = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), new THREE.MeshBasicMaterial({ map: S.tex, toneMapped: false })); S.face.position.z = 0.005; dial.add(S.face);
      const back = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), wood); back.rotation.y = Math.PI; back.position.z = -0.01; dial.add(back);
      S.orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); S.orb.position.set(0, 2.18, 0.0); g.add(S.orb);
      for (const o of [g, S.face, S.orb]) o.userData.dyn = true;
      TF.colCirc(SPOT.x, SPOT.z, 0.34);
      if (TF.sparkles) TF.sparkles(SPOT.x, SPOT.z + 0.45, 0xffd27a, 16, 0.55, 2.1);
      TF.INTER.push({ x: SPOT.x, z: SPOT.z + 0.65, r: 1.25, label: 'Daylight Console', verb: 'Adjust', act: () => open() });
    }
    // the dial: a sky in the colours of the hour, hills, the sun climbing from 6 am to 6 pm and the moon from 6 pm to 6 am, and the clock
    function draw(p) {
      if (!S.canvas) return;
      const key = S.hour.toFixed(2) + S.bright + S.warm + S.sketch; if (key === S.drawn) return; S.drawn = key;
      const g = S.canvas.getContext('2d'), W = 256, t = (((S.hour - 6) % 24) + 24) % 24 / 12, night = t >= 1, a = Math.PI * (night ? t - 1 : t), cx = 128 - Math.cos(a) * 92, cy = 168 - Math.sin(a) * 118;
      const sky = g.createLinearGradient(0, 0, 0, W); sky.addColorStop(0, p.zenith); sky.addColorStop(1, p.fog); g.fillStyle = sky; g.fillRect(0, 0, W, W);
      if (p.stars > 0.05) { g.fillStyle = `rgba(255,255,240,${0.8 * p.stars})`; for (let i = 0; i < 26; i++) g.fillRect((i * 97) % 250, (i * 53) % 120, 2, 2); }
      if (night) { g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(cx, cy, 17, 0, 7); g.fill(); g.fillStyle = p.zenith; g.beginPath(); g.arc(cx + 7, cy - 4, 15, 0, 7); g.fill(); } else { g.fillStyle = p.sunColor; g.shadowColor = p.sunColor; g.shadowBlur = 24; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); g.shadowBlur = 0; }
      g.fillStyle = '#2e2433'; g.beginPath(); g.moveTo(0, 190); g.quadraticCurveTo(60, 160, 120, 184); g.quadraticCurveTo(190, 158, 256, 186); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
      g.fillStyle = '#fff3dc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 34px "Trebuchet MS", Arial, sans-serif'; g.fillText(clock(S.hour), 128, 218);
      S.tex.needsUpdate = true; S.orb.material.color.set(night ? '#cfd8ff' : p.sunColor);
    }

    // ---- the panel ----
    const ui = document.createElement('div'); ui.style.cssText = 'position:fixed;inset:0;z-index:7;display:none;pointer-events:none;';
    ui.innerHTML = `<style>
      .dl-box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:14px 18px 12px;pointer-events:auto;font-size: 16px;color:var(--ink)}
      .dl-box h3{margin:0;font-weight:600;font-size:17px;color:var(--gold);letter-spacing:.04em;display:flex;justify-content:space-between;align-items:center}
      .dl-box button{font:inherit;color:var(--ink);background:rgba(60,42,34,.9);border:1px solid var(--gold);padding:5px 8px;cursor:pointer}
      .dl-box button:hover,.dl-box button.on{background:var(--gold);color:#2a1c14}
      .dl-clock{margin:8px 0 10px;display:flex;align-items:baseline;gap:12px}.dl-clock b{font-size:34px;font-weight:600}.dl-clock i{font-style:normal;opacity:.8}
      .dl-pre{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}.dl-pre button{padding:7px 2px;line-height:1.25}.dl-pre span{display:block;font-size:20px}
      .dl-box label{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;margin:6px 0}.dl-box input[type=range]{width:100%;accent-color:var(--gold)}
      .dl-box .chk{display:flex;gap:8px;align-items:center;margin-top:8px}.dl-box small{display:block;margin-top:8px;opacity:.65;font-size: 16px}
    </style>
    <div class="panel dl-box"><h3>Daylight Console <button data-x>✕</button></h3>
      <div class="dl-clock"><b data-t></b><i data-n></i></div>
      <div class="dl-pre">${MOODS.map((m, i) => `<button data-m="${m[0]}" title="${i + 1}"><span>${m[3]}</span>${m[2]}</button>`).join('')}</div>
      <label>Time<input type="range" min="0" max="24" step="0.25" data-h></label>
      <label>Brightness<input type="range" min="-1" max="1" step="0.05" data-b></label>
      <label>Warmth<input type="range" min="-1" max="1" step="0.05" data-w></label>
      <label>Ink &amp; sketch<input type="range" min="0" max="1" step="0.05" data-k></label>
      <label class="chk"><input type="checkbox" data-a> Let the day pass (a day takes 4 minutes)</label>
      <label class="chk"><input type="checkbox" data-s> Gentle sound (music box, birds, crickets)</label>
      <small>1-4 pick a mood · ← → move the time · E or Esc to close</small></div>`;
    document.body.appendChild(ui);
    const q = (s) => ui.querySelector(s), R = { h: q('[data-h]'), b: q('[data-b]'), w: q('[data-w]'), k: q('[data-k]'), a: q('[data-a]'), s: q('[data-s]') };
    function sync() {
      q('[data-t]').textContent = clock(S.hour); q('[data-n]').textContent = nameOf(S.hour); R.h.value = S.hour; R.b.value = S.bright; R.w.value = S.warm; R.k.value = S.sketch; R.a.checked = S.auto; R.s.checked = !TF.ambience || TF.ambience.state.on;
      ui.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', nameOf(S.hour).toLowerCase() === b.dataset.m));
    }
    function set(o, ms = 0) { const was = nameOf(S.hour); Object.assign(S, o); apply(ms); sync(); save(); if (o.hour != null && nameOf(S.hour) !== was && TF.ambience) TF.ambience.chime(); }
    function open() {
      if (S.open || TF.talking || TF.traveling || TF.locked || TF.cameraHeld) return false;   // from the console in the lobby, or the sun button anywhere
      S.open = true; TF.lockPlayer(true); ui.style.display = 'block'; sync();
      TF.tween(ui, { opacity: [0, 1], translateY: [10, 0] }, 200, { ease: 'out(3)' });   // the console rises in, eased (and replaces a close still fading out)
      return true;
    }
    function close() {
      if (!S.open) return; S.open = false; TF.lockPlayer(false);
      TF.tween(ui, { opacity: 0, translateY: 10 }, 160, { ease: 'in(2)', onComplete: () => { if (!S.open) ui.style.display = 'none'; } });   // fades out, then leaves the page
    }
    ui.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (m) set({ hour: MOODS.find((x) => x[0] === m.dataset.m)[1] }, 1100); if (e.target.closest('[data-x]')) close(); });
    R.h.addEventListener('input', () => set({ hour: +R.h.value })); R.b.addEventListener('input', () => set({ bright: +R.b.value })); R.w.addEventListener('input', () => set({ warm: +R.w.value })); R.k.addEventListener('input', () => set({ sketch: +R.k.value })); R.a.addEventListener('change', () => set({ auto: R.a.checked })); R.s.addEventListener('change', () => { if (TF.ambience) { TF.ambience.set(R.s.checked); TF.ambience.chime(); } });
    // hooked at boot, like the other games: the Bridge reassigns TF.onKey at its own boot, which would drop anything hooked earlier
    const hookKeys = () => { const prev = TF.onKey; TF.onKey = (e) => {
      if (!S.open) return prev ? prev(e) : false;
      if (!e.repeat || e.code.startsWith('Arrow')) {
        if (e.code === 'Escape' || e.code === 'KeyE') close();
        else if (/^Digit[1-4]$/.test(e.code)) set({ hour: MOODS[+e.code.slice(-1) - 1][1] }, 1100);
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') set({ hour: ((S.hour + (e.code === 'ArrowLeft' ? -0.5 : 0.5)) % 24 + 24) % 24 });
      }
      return true;
    }; };

    TF.life.push((t, dt) => { S.live = true; if (AIR.flies && S.p) driftAir(t, dt, S.p, S.inside); });
    TF.life.push((t, dt) => {   // the day passes by itself when asked, but never under a minigame's own lighting or while the panel is open
      if (!S.auto || S.open || TF.cameraHeld || TF.locked) return;
      S.hour = (S.hour + dt * 0.1) % 24; S.acc += dt; if (S.acc < 0.25) return; S.acc = 0; apply(); save();
    });
    TF.on('boot', () => { hookKeys(); softDust(); build(); buildAir(); buildPools(); collectEmitters(); record(); apply(); });
    TF.on('enter', (prevZone, z) => { S.zone = z; record(); apply(S.live ? 900 : 0); });   // the first zone set while the world is still loading just lands
    TF.on('boot', () => { const u = uiEl(); if (u && window.MutationObserver) new MutationObserver(() => { if (S.open && inPlay(S.zone)) close(); apply(600); }).observe(u, { attributes: true, attributeFilter: ['class'] }); });
    // a sun button at the top right, always there: opens the console from any zone
    // (left of the party panel, which takes the top-right corner)
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'panel dl-btn'; btn.setAttribute('aria-label', 'Time of day');
    btn.style.cssText = 'position:absolute;top:18px;right:222px;z-index:5;pointer-events:auto;cursor:pointer;font:600 15px var(--font-secondary,inherit);color:var(--ink,#f3ead6);padding:8px 14px;display:flex;gap:8px;align-items:center';
    const label = () => { btn.innerHTML = `<span style="font-size:20px">${(MOODS.find((m) => m[0] === nameOf(S.hour).toLowerCase()) || MOODS[1])[3]}</span>${clock(S.hour)}`; };
    label(); setInterval(label, 1000);
    btn.addEventListener('click', () => { S.open ? close() : open(); btn.blur(); });
    document.getElementById('ui').appendChild(btn);
    TF.daylight = { state: S, apply, set, open, close };
    if (typeof window !== 'undefined') window.daylight = TF.daylight;
    return TF.daylight;
  }
  return { PRESETS, MOODS, KEYS, at, adjust, nameOf, clock, install, SPOT };
});
