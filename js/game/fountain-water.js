// TokenFall: the lobby fountain's moving water. Sheets of water pour over each bowl's lip (a soft bell dome on top, a curtain off the upper bowl,
// a curtain off the lower bowl) and eight jets arc in from spouts on the basin's rim. Where any of it lands the water answers: churned white
// foam, rings running outward, droplets kicked up and a little mist. tokenFountain() (lobby-village.js) calls fountainWater with its root group.
// Classic script: shares one global scope with the other js/game files, loaded before main.js builds the world.

const FW_NOISE = `float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(fh(i), fh(i + vec2(1., 0.)), f.x), mix(fh(i + vec2(0., 1.)), fh(i + vec2(1., 1.)), f.x), f.y); }`;

// falling water: streaks sliding down the sheet, glassy at grazing angles, breaking up into drops near the bottom.
// along: which uv axis runs down the water (lathe: v, tube: u); cols: streaks across it
function fwSheetMat(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { t: timeU, sp: { value: o.speed || 1.4 }, rep: { value: o.rep || 2.5 }, cols: { value: o.cols || 60 }, a: { value: o.alpha || .62 }, along: { value: o.tube ? 1 : 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal);
      vF = 1. - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float t, sp, rep, cols, a, along; varying vec2 vUv; varying float vF; ${FW_NOISE}
      void main(){
        vec2 q = along > .5 ? vUv.yx : vUv; float u = q.x * cols, v = q.y, flow = v * rep - t * sp;
        float s = fn(vec2(u, flow * 2.)) * .6 + fn(vec2(u * 2.3 + 5., flow * 4. + 3.)) * .5;
        float streak = smoothstep(.45, .9, s);
        float lip = smoothstep(0., .06, v), drops = smoothstep(.3, .6, fn(vec2(u * 1.3, flow * 5.)) + (1. - v) * 2.2);
        float al = a * (.4 + .6 * streak) * lip * (.6 + .5 * vF) * mix(1., drops, smoothstep(.55, 1., v)) * (1. - smoothstep(.92, 1., v) * .6);
        vec3 c = mix(vec3(.6, .85, .9), vec3(1.), clamp(streak * .85 + vF * .35, 0., 1.));
        gl_FragColor = vec4(c, clamp(al, 0., .95)); }`,
  });
}
// where water lands: churned foam round r0 (0 = a point) and rings running out from it, fading towards rOut. Drawn in the mesh's own x/y
function fwImpactMat(r0, rOut, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { t: timeU, r0: { value: r0 }, rOut: { value: rOut }, w: { value: o.width || .16 }, amt: { value: o.amt || 1 } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float t, r0, rOut, w, amt; varying vec2 vP; ${FW_NOISE}
      void main(){
        float r = length(vP), d = abs(r - r0), ang = atan(vP.y, vP.x);
        float bub = fn(vP * 13. + vec2(t * .9, -t * .7)) * .55 + fn(vec2(ang * 22., r * 16. - t * 3.2)) * .6;
        float foam = exp(-d / w) * smoothstep(.35, .75, bub + exp(-d / w) * .45);
        float ring = pow(.5 + .5 * sin(d * 26. - t * 6.5 + fn(vec2(ang * 5., t * .3)) * 2.), 8.) * exp(-d * 2.4) * smoothstep(.02, .12, d);
        float edge = 1. - smoothstep(rOut - .1, rOut, r);
        gl_FragColor = vec4(vec3(1.), clamp((foam * .9 + ring * .4) * amt * edge, 0., .92)); }`,
  });
}
// a pool of soft particles with their own size and fade (PointsMaterial patched for per-point alpha and size)
function fwParticles(root, n, tex, size, opacity) {
  const pos = new Float32Array(n * 3).fill(-50), al = new Float32Array(n), sz = new Float32Array(n).fill(1), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aA', new THREE.BufferAttribute(al, 1)); geo.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.PointsMaterial({ map: tex, size, transparent: true, opacity, depthWrite: false, fog: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aA, aS; varying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aA;').replace('gl_PointSize = size;', 'gl_PointSize = size * aS;');
    sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vA;');
  };
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 4; pts.userData.dyn = true; root.add(pts);
  const P = Array.from({ length: n }, () => ({ life: 0, age: 0, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, floor: 0, s: 1, g: 0, fade: 0 }));
  let next = 0;
  return {
    pts, material: m,
    emit(x, y, z, vx, vy, vz, life, s = 1, g = 5.5, floor = y - .01) { const p = P[next]; next = (next + 1) % n; Object.assign(p, { life, age: 0, x, y, z, vx, vy, vz, s, g, floor }); },
    step(dt) {
      for (let i = 0; i < n; i++) {
        const p = P[i];
        if (p.age >= p.life) { al[i] = 0; continue; }
        p.age += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < p.floor && p.vy < 0) p.age = p.life;
        const k = p.age / p.life; al[i] = p.age >= p.life ? 0 : Math.min(1, k * 8) * (1 - k * k); sz[i] = p.s * (p.g ? 1 : .6 + k * .8);
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = geo.attributes.aS.needsUpdate = true;
    },
  };
}

// w: water levels and radii { basin: [y, r], low: [y, r], up: [y, r] }
function fountainWater(root, w) {
  const lathe = (pts, m, seg = 96) => { const me = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m); me.renderOrder = 3; me.userData.dyn = true; root.add(me); return me; };
  const ring = (r0, rIn, rOut, y, o) => {
    const me = new THREE.Mesh(rIn > 0 ? new THREE.RingGeometry(rIn, rOut, 96, 4) : new THREE.CircleGeometry(rOut, 48), fwImpactMat(r0, rOut, o));
    me.rotation.x = -Math.PI / 2; me.position.y = y + .006; me.renderOrder = 2; me.userData.dyn = true; root.add(me); return me;
  };
  const [bY] = w.basin, [lY, lR] = w.low, [uY, uR] = w.up;

  // ---- the sheets ----
  // a bell dome on the top bowl: a short column up from the nozzle, then a dome falling back into the bowl
  lathe([[.035, uY], [.04, 1.84], [.08, 1.88], [.2, 1.86], [.32, 1.8], [.42, 1.71], [.48, uY]], fwSheetMat({ speed: 1.1, rep: 1.6, cols: 40, alpha: .5 }));
  // over the upper bowl's lip into the lower bowl
  const upCurtain = 1.04; lathe([[.93, 1.81], [.99, 1.78], [1.02, 1.66], [1.035, 1.45], [upCurtain, lY]], fwSheetMat({ speed: 1.6, rep: 2.2, cols: 70 }));
  // over the lower bowl's lip into the basin
  const lowCurtain = 1.66; lathe([[1.47, 1.4], [1.54, 1.37], [1.6, 1.25], [1.64, .95], [lowCurtain, bY]], fwSheetMat({ speed: 1.9, rep: 3, cols: 96, alpha: .75 }));
  // eight jets arcing in from spouts on the rim
  const JETS = 8, jetFrom = 3.2, jetTo = 2.3, jetLift = .62, spoutY = .78, jetLand = [];
  const spoutM = MAT.gold, jetMat = fwSheetMat({ tube: true, speed: 2.4, rep: 3, cols: 6, alpha: .7 });
  for (let j = 0; j < JETS; j++) {
    const a = (j + .5) / JETS * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    const pts = Array.from({ length: 16 }, (_, i) => { const u = i / 15, r = jetFrom + (jetTo - jetFrom) * u; return new THREE.Vector3(cx * r, spoutY + (bY - spoutY) * u + jetLift * 4 * u * (1 - u), cz * r); });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .035, 8), jetMat); tube.renderOrder = 3; tube.userData.dyn = true; root.add(tube);
    const sp = add(new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), spoutM), root); sp.position.set(cx * 3.24, .74, cz * 3.24); sp.scale.set(1, .8, 1);
    const nz = add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, .12, 10), spoutM), root, false); nz.position.set(cx * 3.17, .78, cz * 3.17); nz.lookAt(cx * 2, 1.2, cz * 2); nz.rotateX(Math.PI / 2);
    jetLand.push([cx * jetTo, cz * jetTo]);
  }

  // ---- where it lands ----
  ring(lowCurtain, lowCurtain - .45, Math.min(w.basin[1] - .05, lowCurtain + 1.25), bY, { width: .18 });
  ring(upCurtain, .3, lR - .02, lY, { width: .12 });
  ring(.48, .27, uR - .02, uY, { width: .08, amt: .8 });
  for (const [x, z] of jetLand) ring(0, 0, .6, bY, { width: .09 }).position.set(x, bY + .007, z);

  // ---- droplets and mist ----
  const dropTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.5, 'rgba(235,250,255,.85)'); r.addColorStop(1, 'rgba(235,250,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }, { smooth: true, keep: true });
  const mistTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, { smooth: true, keep: true });
  const drops = fwParticles(root, 420, dropTex, .1, .95), mist = fwParticles(root, 90, mistTex, .9, .22);
  const rnd2 = (a, b) => a + Math.random() * (b - a);
  // a curtain landing all the way round: splash at a random point on its circle
  const curtainSplash = (r, y, n, up) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, c = Math.cos(a), s = Math.sin(a), out = rnd2(-.15, .45); drops.emit(c * r, y + .01, s * r, c * out - s * rnd2(-.1, .1), rnd2(up * .5, up), s * out + c * rnd2(-.1, .1), 1.2, rnd2(.6, 1.15), 5.5, y); } };
  let last = null, acc = 0, mAcc = 0;
  anim.push((t) => {
    const dt = last === null ? 0 : Math.min(.05, Math.max(0, t - last)); last = t; if (!dt) return;
    acc += dt; mAcc += dt;
    while (acc > 1 / 60) {   // a steady emission rate whatever the frame rate
      acc -= 1 / 60;
      curtainSplash(lowCurtain, bY, 2, 1.25); curtainSplash(upCurtain, lY, 1, .9); if (Math.random() < .6) curtainSplash(.48, uY, 1, .6);
      for (const [x, z] of jetLand) if (Math.random() < .55) { const a = Math.random() * 6.283, sp = rnd2(.15, .55); drops.emit(x, bY + .01, z, Math.cos(a) * sp, rnd2(.7, 1.5), Math.sin(a) * sp, 1.2, rnd2(.6, 1.1), 5.5, bY); }
    }
    while (mAcc > .09) {
      mAcc -= .09;
      const a = Math.random() * 6.283, onJet = Math.random() < .4, [jx, jz] = jetLand[(Math.random() * JETS) | 0];
      const x = onJet ? jx : Math.cos(a) * lowCurtain, z = onJet ? jz : Math.sin(a) * lowCurtain;
      mist.emit(x, bY + .08, z, rnd2(-.08, .08), rnd2(.12, .28), rnd2(-.08, .08), rnd2(1.2, 2), rnd2(.7, 1.2), 0);
    }
    drops.step(dt); mist.step(dt);
  });
}
