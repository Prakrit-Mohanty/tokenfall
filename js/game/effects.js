// TokenFall: static batching (merges meshes into few draw calls), ambient life, sky dust, sun and sky light.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= static batching =================
// Thousands of boxes become a few dozen draw calls: bake every static, single-material mesh into one geometry
// per (material, shadow-casting, zone). Zones are kept apart so the far-away areas still get frustum-culled.
function mergeStatic(root = scene) {   // the root is optional: a module that builds its own static room (the kitchen) merges just that
  scene.updateMatrixWorld(true);
  const buckets = new Map(), dead = [], wp = new THREE.Vector3();
  const dyn = o => { for (let p = o; p; p = p.parent) if (p.userData.dyn) return true; return false; };
  const ok = m => m.isMeshStandardMaterial && !m.transparent;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || dyn(o)) return;
    const multi = Array.isArray(o.material);
    if (multi ? !o.material.every(ok) : !ok(o.material)) return;
    const g = o.geometry; if (!g.attributes.uv || !g.attributes.normal) return;
    o.getWorldPosition(wp);
    const zone = wp.x < -150 ? 'w' : wp.x > 150 ? 'e' : wp.z < -150 ? 'n' : wp.z > 150 ? 's' : 'l';
    const flat = g.index ? g.toNonIndexed() : g.clone(); flat.applyMatrix4(o.matrixWorld);
    // a multi-material mesh is split into one piece per material group (groups index the flattened vertices 1:1)
    const parts = multi ? g.groups.map(gr => [o.material[gr.materialIndex], gr.start, gr.count]) : [[o.material, 0, flat.attributes.position.count]];
    for (const [mat, start, count] of parts) {
      const key = mat.uuid + (o.castShadow ? 1 : 0) + zone;
      if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, list: [] });
      buckets.get(key).list.push({ g: flat, start, count });
    }
    dead.push(o);
  });
  for (const o of dead) o.parent.remove(o);
  for (const { mat, cast, list } of buckets.values()) {
    let n = 0; for (const p of list) n += p.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (const { g, start, count } of list) {
      const A = g.attributes;
      pos.set(A.position.array.subarray(start * 3, (start + count) * 3), k * 3); nor.set(A.normal.array.subarray(start * 3, (start + count) * 3), k * 3);
      uv.set(A.uv.array.subarray(start * 2, (start + count) * 2), k * 2); k += count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m);
  }
}

// low tier: tiny things (cups, pens, bolts) stop casting shadows; each one is a draw in the shadow pass. Run before mergeStatic so it sees single meshes.
function trimCasters(root = scene) {
  if (!Q.smallCast) return;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.castShadow || o.material === proxyMat) return;   // the characters' shadow stand-ins always cast
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < Q.smallCast) o.castShadow = false;
  });
}

// ================= life: butterflies, drifting petals, cafe string lights =================
const life = [];
function buildLife() {
  const wingTex = canvasTex(8, 8, g => { g.fillStyle = '#fff'; g.fillRect(1, 1, 6, 5); g.fillRect(2, 6, 4, 1); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(1, 1, 6, 1); }, { nearest: true });
  for (let i = 0; i < 7; i++) {
    const col = [0xfff2b0, 0xffffff, 0xffb070, 0xbfe3ff][i % 4];
    const m = new THREE.MeshStandardMaterial({ map: wingTex, color: col, emissive: col, emissiveIntensity: .3, alphaTest: .5, side: THREE.DoubleSide });
    const b = new THREE.Group(), wings = [];
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.16, .16).translate(s * .08, 0, 0), m); wings.push(w); b.add(w); }
    scene.add(b);
    const cx = rr(-14, 14), cz = rr(6, 17), ph = rnd() * 9, sp = rr(.25, .45);
    life.push(t => {
      const a = t * sp + ph;
      b.position.set(cx + Math.sin(a) * 3 + Math.sin(a * 2.3) * .8, .7 + Math.sin(a * 3.1) * .35 + .3, cz + Math.cos(a * .8) * 2.2);
      b.rotation.y = -a; const f = Math.sin(t * 22 + ph) * 1.1; wings[0].rotation.y = f; wings[1].rotation.y = -f;
    });
  }
  // petals drifting off the blossom trees
  const n = 90, pos = new Float32Array(n * 3), seedA = [];
  const src = LOBBY.petals;
  const reset = (i, y) => { const s = src[i % 2]; pos[i * 3] = s[0] + rr(-1.4, 1.4); pos[i * 3 + 1] = y ?? rr(2.4, 3.6); pos[i * 3 + 2] = s[1] + rr(-1.2, 1.2); };
  for (let i = 0; i < n; i++) { reset(i, rr(0, 3.6)); seedA.push(rnd() * 9); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const petals = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf2b6c6, size: .09 })); scene.add(petals);
  life.push((t, dt) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3] += (Math.sin(t * 1.3 + seedA[i]) * .25 + .35) * dt; pos[i * 3 + 1] -= .32 * dt; pos[i * 3 + 2] += Math.cos(t + seedA[i]) * .12 * dt;
      if (pos[i * 3 + 1] < .02) reset(i);
    }
    pg.attributes.position.needsUpdate = true;
  });
  // string lights over the cafe tables
  // string lights over the active lobby's cafe tables (four poles, strung round and across)
  const poles = LOBBY.lightPoles;
  if (poles.length !== 4) return;
  for (const [x, z] of poles) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, 3.7, .1), MAT.metal); p.position.set(x, 1.85, z); p.castShadow = true; scene.add(p); colCirc(x, z, .15); }
  const bulbs = [], segs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
  for (const [a, b] of segs) {
    const A = poles[a], B = poles[b], len = Math.hypot(B[0] - A[0], B[1] - A[1]), cnt = Math.round(len / .6);
    for (let i = 1; i < cnt; i++) { const t = i / cnt; bulbs.push([A[0] + (B[0] - A[0]) * t, 3.6 - .55 * 4 * t * (1 - t), A[1] + (B[1] - A[1]) * t]); }
  }
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc070, emissiveIntensity: 2.6 }), bulbs.length);
  const d = new THREE.Object3D(); bulbs.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); }); scene.add(bm);
}

// ================= sky dust =================
let dust;
function buildDust() {
  const n = 220, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rr(-20, 20); pos[i * 3 + 1] = rr(.3, 6); pos[i * 3 + 2] = rr(-16, 16); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe2a0, size: .09, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);
}

// ================= lights =================
const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x8a8b7c, .6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6ec, 1.1);
sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);   // the quality tier's size (setup.js): 2048 desktop, 1024 low
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });   // a 40 m square round the player at 3072 px: ~77 px per metre (it was 43); groundlife.js snaps it to the texel grid
sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; sun.shadow.radius = 3.2 * Q.shadow / 3072;   // a wider blur kernel: soft shadow edges instead of hard ones (in texels, scaled so the softness in metres matches the old 3072 map)
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-26, 19, 14);   // low, late-afternoon sun: long warm shadows
// gradient sky dome around the camera: horizon matches the fog, blue overhead, a soft glow around the sun
const skyU = { horizon: { value: new THREE.Color(FOG) }, sunDir: { value: new THREE.Vector3() }, time: timeU, zenith: { value: new THREE.Color(.5, .6, .78) }, sunCol: { value: new THREE.Color(1, .78, .5) }, cloudCol: { value: new THREE.Color(1, .96, .92) }, cloudShade: { value: new THREE.Vector3(.95, .92, 1.03) }, stars: { value: 0 } };   // zenith, sunCol and stars: the time of day (daylight.js)
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform vec3 horizon, sunDir, zenith, sunCol, cloudCol, cloudShade; uniform float time, stars; varying vec3 vD;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ return noise(p)*.55+noise(p*2.1+7.3)*.3+noise(p*4.3+1.7)*.15; }
    void main(){ float h=max(vD.y,0.), l=dot(horizon,vec3(.3,.59,.11)), day=smoothstep(.2,.55,l);
      // a lavender band between the horizon haze and the zenith, like the watercolour skies of a picture book
      vec3 top=mix(horizon*.55, zenith, day), mid=mix(horizon, top, .5)+vec3(.05,0.,.07)*day;
      vec3 c=mix(mix(horizon, mid, smoothstep(0.,.4,h)), top, smoothstep(.3,.95,h));
      float s=max(dot(vD,sunDir),0.); c+=sunCol*(pow(s,8.)*.3+pow(s,300.)*1.2)*day;
      // night: a moon where the sun was, and a few posterised stars
      vec2 sq=floor(vD.xz/(h+.12)*90.); float sh=hash(sq);
      c+=sunCol*pow(s,900.)*3.*stars + vec3(.9,.93,1.)*step(.993,sh)*stars*smoothstep(.06,.35,h)*(.6+.4*sin(time*2.+sh*60.));
      // painted clouds: soft, layered and drifting, lit on the sun side and shaded underneath in the mood's cloudShade tint (lavender; faintly warm at morning)
      vec2 q=vD.xz/(h+.2)*1.5+vec2(time*.005,time*.0015);
      float n=fbm(q), cover=smoothstep(.46,.78,n), under=smoothstep(.52,.92,fbm(q*1.6+vec2(3.1,time*.002)));
      vec3 lit=mix(vec3(1.,.96,.92),sunCol,.3)*mix(vec3(1.),cloudCol,.6), shade=mix(lit*.8,horizon,.4)*cloudShade;
      float fade=smoothstep(.01,.26,h)*day;
      c=mix(c,mix(lit,shade,under*.75),cover*fade*.92);
      gl_FragColor=vec4(c,1.); }`,
}));
sky.renderOrder = -1; sky.frustumCulled = false; sky.userData.dyn = true; scene.add(sky);

const shaftMat = new THREE.ShaderMaterial({
  uniforms: { time: timeU, amt: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform float time, amt; varying vec2 vUv;
    void main(){ float edge=smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x), along=pow(1.-vUv.y,1.4);
      float dust=.85+.15*sin(time*.6+vUv.x*11.+vUv.y*5.);
      gl_FragColor=vec4(vec3(1.,.84,.58)*edge*along*dust*.16*amt,1.); }`,
});
// soft beams of sunlight from a window wall at x = wx into the room, one per pane between mullions (step apart)
function sunShafts(zoneKey, wx, z0, z1, step, yLow, yHigh) {
  const L = SUN_DIR.clone().normalize().negate(), pos = [], uv = [], idx = [];
  const hit = (z, y) => [wx + L.x * (y / -L.y), 0, z + L.z * (y / -L.y)];
  for (let a = z0; a < z1 - .5; a += step) {
    const za = a + .2, zb = Math.min(a + step, z1) - .2;
    for (const y of [yHigh, yLow]) {
      const n = pos.length / 3;
      pos.push(wx, y, za, wx, y, zb, ...hit(zb, y), ...hit(za, y)); uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, shaftMat); m.userData.dyn = true; m.renderOrder = 2; scene.add(m);
  ZONE_LIGHTS[zoneKey].push(Object.assign(m, { intensity: 1, userData: Object.assign(m.userData, { base: 1 }) }));
  return m;
}
