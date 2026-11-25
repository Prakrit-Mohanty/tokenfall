// TokenFall: the city outside the ABZ office window, built in 3D after photos taken from that window (kept in abz-view/): Baner from the 15th floor.
// Low cream and white housing blocks in a sea of trees, the brick-red terraced Kenzo tower in front, a dark glass tower, the tall white high-rises and
// two cranes on the skyline, the hill to the right. Everything sits 45 m below the office floor and
// fades into the haze with distance (the game's fog stops at 95 m, so the city keeps its own haze and ignores the fog).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// abzCity(): one group, in the window's own frame: origin on the glass, +x straight out, z along the window. office-abz.js places and turns it.
function abzCity() {
  const city = new THREE.Group(), FLOOR = -45, SKY = new THREE.Color(0xc9d3dc);
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), rr = (a, b) => a + rng() * (b - a);
  // a colour hazed towards the sky by distance (the fake atmosphere that makes the far towers pale, like in the photos)
  const haze = (hex, d) => new THREE.Color(hex).lerp(SKY, Math.min(.55, Math.max(0, (d - 30) / 420)));
  const mats = new Map();
  const mat = (key, make) => mats.get(key) || (mats.set(key, make()), mats.get(key));

  // facade textures: rows of windows (or balconies) on a wall colour; one canvas each, repeated per building by its UVs
  const facade = (wall, win, kind) => {
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = wall; g.fillRect(0, 0, 64, 64);
      if (kind === 'balcony') { for (let y = 0; y < 64; y += 16) { g.fillStyle = win; g.fillRect(4, y + 5, 56, 7); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + 13, 64, 2); } }
      else if (kind === 'terrace') { for (let y = 0; y < 64; y += 16) { g.fillStyle = win; g.fillRect(0, y + 3, 64, 9); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y + 13, 64, 1); } }
      else if (kind === 'glass') { g.fillStyle = win; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 64); for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1); }
      else for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) { g.fillStyle = win; g.fillRect(x + 4, y + 4, 8, 8); }
    }, { smooth: true });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const TEX = {
    cream: facade('#e9e1d2', '#8d8a86', 'window'), white: facade('#eeeeea', '#9a9da2', 'balcony'), pink: facade('#e7c9c2', '#9a8580', 'balcony'),
    yellow: facade('#e3c46a', '#8f8064', 'window'), brick: facade('#8a4a36', '#3b2a26', 'terrace'), glass: facade('#3e4e5c', '#45586a', 'glass'),
    tower: facade('#dcdcd6', '#8e949a', 'balcony'), concrete: facade('#b9b5ae', '#7b7a78', 'window'),
    wWin: facade('#ffffff', '#8a8c90', 'window'), wBal: facade('#ffffff', '#8f8f94', 'balcony'),   // white walls, tinted per building
  };
  // the city's paint: the creams, ochres, salmons, sky-blues, mint and greys of Pune housing blocks, each building its own
  const PAINT = [0xeee4d0, 0xe8d3a8, 0xe3bf86, 0xd9a07a, 0xe8b9a8, 0xf0d0c8, 0xc9d8e2, 0xb8cfd8, 0xd2e2cc, 0xbcd4b4, 0xe6e6e0, 0xcfcac2, 0xf3e7b8, 0xd8c4dc, 0xc4b5a0, 0xa9b4bc];
  // a block: footprint w x d (x, z), h tall, its foot on the ground; side faces carry the facade at ~4 m by 3 m a repeat, the roof is plain
  const block = (x, z, w, d, h, tex, roof = 0xd0ccc4, tint = 0xffffff) => {
    const dist = Math.hypot(x, z), side = mat(tex + tint + '|' + Math.round(dist / 20), () => new THREE.MeshBasicMaterial({ map: TEX[tex], color: haze(tint, dist), fog: false }));
    const top = mat('roof' + roof + '|' + Math.round(dist / 15), () => new THREE.MeshBasicMaterial({ color: haze(roof, dist), fog: false }));
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, span = [d, d, w, w, w, w];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * span[f] / 4, uv.getY(i) * (f === 2 || f === 3 ? d / 4 : h / 3)); }
    const m = new THREE.Mesh(geo, [side, side, top, top, side, side]); m.position.set(x, FLOOR + h / 2, z); city.add(m);
    if (h < 40 && rng() < .5) { const tank = new THREE.Mesh(new THREE.BoxGeometry(rr(1.5, 3), 1.6, rr(1.5, 3)), top); tank.position.set(x + rr(-w, w) / 4, FLOOR + h + .8, z + rr(-d, d) / 4); city.add(tank); }   // the rooftop water tanks
    return m;
  };
  const free = [];   // footprints taken, so the filler blocks do not overlap the landmarks
  const clear = (x, z, r) => free.every(([a, b, c]) => Math.hypot(x - a, z - b) > r + c);
  const landmark = (x, z, w, d, h, tex, roof) => { free.push([x, z, Math.max(w, d) * .6]); return block(x, z, w, d, h, tex, roof); };

  // the ground: a hazy green-grey city floor, and the trees as one instanced mesh (dark crowns, like the canopy in the photos)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ color: 0x6f7563, fog: false })); ground.rotation.x = -Math.PI / 2; ground.position.set(200, FLOOR, 0); city.add(ground);

  // landmarks, left to right as you look out (z: left is -z)
  // the Kenzo tower: brick red, stepped back in terraces near the top, a green sign, a pale roof sign
  const kx = 120, kz = -42;
  landmark(kx, kz, 22, 26, 52, 'brick', 0x7a4434);
  block(kx - 2, kz, 18, 22, 58, 'brick', 0x7a4434); block(kx - 3, kz + 1, 14, 18, 63, 'brick', 0x7a4434);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshBasicMaterial({ color: 0x8fdc6a, fog: false })); sign.position.set(kx - 11.1, FLOOR + 34, kz); sign.rotation.y = -Math.PI / 2; city.add(sign);
  const roofSign = new THREE.Mesh(new THREE.BoxGeometry(.4, 3, 5), new THREE.MeshBasicMaterial({ color: 0xf2f0ea, fog: false })); roofSign.position.set(kx - 3, FLOOR + 65, kz); city.add(roofSign);
  landmark(130, -2, 14, 14, 75, 'glass', 0x3e4a56);                              // the dark glass tower behind
  for (const [x, z, h, crane] of [[175, 14, 95, false], [190, 30, 110, true], [205, 48, 118, true], [160, 62, 88, false], [215, -40, 70, false], [185, -70, 60, false]]) {   // the far high-rises
    landmark(x, z, 16, 16, h, 'tower', 0xcfcfca);
    if (crane) { const c = mat('crane', () => new THREE.MeshBasicMaterial({ color: haze(0xd9b44a, x), fog: false })); const mast = new THREE.Mesh(new THREE.BoxGeometry(.8, 22, .8), c); mast.position.set(x, FLOOR + h + 11, z); const jib = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, 26), c); jib.position.set(x, FLOOR + h + 21, z + 6); city.add(mast, jib); }
  }
  // the hill on the right, low and hazy
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: haze(0x5d6b52, 230), fog: false })); hill.scale.set(70, 38, 120); hill.position.set(250, FLOOR - 4, 95); city.add(hill);
  // the rest of the city: cream, white, pink and yellow housing blocks, low near the window and taller further out, thinning into the haze
  // packed tight right back to the skyline, so no sky shows between them: low near the window, taller further out
  for (let i = 0; i < 1400; i++) {
    const x = rr(12, 300), z = rr(-150, 160), far = (x - 12) / 288, w = rr(8, 17), d = rr(8, 17);
    if (!clear(x, z, Math.max(w, d) * .5)) continue;
    const h = rr(7, 20) + far * rr(5, 55) + (rng() < .08 ? rr(20, 45) : 0), paint = PAINT[(rng() * PAINT.length) | 0];
    free.push([x, z, Math.max(w, d) * .48]); block(x, z, w, d, h, rng() < .55 ? 'wBal' : 'wWin', [0xd0ccc4, 0xbdb8ae, 0xc9b9a6, 0xa8b0b6][(rng() * 4) | 0], paint);
  }
  // trees in the gaps: one instanced mesh of lumpy crowns
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 900), dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < 4000 && n < 900; i++) {
    const x = rr(8, 200), z = rr(-110, 120);
    if (!clear(x, z, 2.5)) continue;
    const r = rr(3, 6.5); dummy.position.set(x, FLOOR + r * .7, z); dummy.scale.set(r, r * .8, r); dummy.rotation.y = rng() * 6; dummy.updateMatrix();
    crowns.setMatrixAt(n, dummy.matrix); crowns.setColorAt(n, haze([0x3f5a35, 0x4d6a3e, 0x5a7444, 0x6b6a3e][n % 4], x)); n++;
  }
  crowns.count = n; city.add(crowns);
  // the sky behind it all: a soft vertical gradient, hazy at the horizon
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1000, 260), new THREE.MeshBasicMaterial({ map: canvasTex(2, 64, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#9fb4c8'); gr.addColorStop(.7, '#cdd6de'); gr.addColorStop(1, '#d9dcdc'); g.fillStyle = gr; g.fillRect(0, 0, 2, 64); }, { smooth: true }), fog: false }));
  sky.position.set(420, FLOOR + 100, 0); sky.rotation.y = -Math.PI / 2; city.add(sky);
  abzCityMerge(city);
  city.traverse((o) => { o.frustumCulled = false; o.matrixAutoUpdate = true; });
  return city;
}
// the ~700 blocks, tanks and cranes are static and each box drew once per face material (6 draws a block, ~1500 a frame from ABZ): fold every
// opaque plain mesh into one mesh per material, in the city's own frame (office-abz.js still places and turns the group). Same triangles, same materials.
function abzCityMerge(city) {
  const buckets = new Map(), dead = [];
  for (const o of city.children) {
    if (!o.isMesh || o.isInstancedMesh) continue;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m.transparent || !m.isMeshBasicMaterial)) continue;
    o.updateMatrix();
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
    const parts = Array.isArray(o.material) && g.groups.length ? g.groups.map((gr) => [o.material[gr.materialIndex], gr.start, gr.count]) : [[mats[0], 0, g.attributes.position.count]];
    for (const [m, start, count] of parts) { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push([g, start, count]); }
    dead.push(o);
  }
  for (const o of dead) city.remove(o);
  for (const [m, list] of buckets) {
    let n = 0; for (const [, , c] of list) n += c;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let k = 0;
    for (const [g, start, count] of list) {
      const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv && g.attributes.uv.array;
      pos.set(P.subarray(start * 3, (start + count) * 3), k * 3); nor.set(N.subarray(start * 3, (start + count) * 3), k * 3);
      if (U) uv.set(U.subarray(start * 2, (start + count) * 2), k * 2);
      k += count;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    city.add(new THREE.Mesh(geo, m));
  }
}
