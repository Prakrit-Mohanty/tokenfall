// TokenFall: office building blocks shared by the HQ and ABZ: garlands, faders, office materials, desks, meeting rooms, sofas.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// marigold garlands: every bead is collected here and drawn as one instanced mesh at the end of buildOffice
const BEADS = [];
function garlandV(x, z, y0, y1, pink) { for (let y = y0; y < y1; y += .075) BEADS.push([x + Math.sin(y * 9) * .012, y, z, pink]); }
function garlandSwag(x0, x1, z, y, sag, loops) {
  const w = (x1 - x0) / loops;
  for (let l = 0; l < loops; l++) for (let t = 0; t <= 1; t += .028) BEADS.push([x0 + (l + t) * w, y - sag * 4 * t * (1 - t), z]);
}
function grp() { const g = new THREE.Group(); g.userData.dyn = true; scene.add(g); return g; }
function fadeOf(mat) {
  if (!mat.userData.fade) mat.userData.fade = Object.assign(mat.clone(), { transparent: true, opacity: .22, depthWrite: false });
  return mat.userData.fade;
}
// meshes turn see-through while test() is true (used for anything that would hide the player)
function makeFader(meshes, test) {
  for (const m of meshes) { m.userData.mat = m.material; m.userData.fade = Array.isArray(m.material) ? m.material.map(fadeOf) : fadeOf(m.material); }
  FADERS.push({ meshes, test, faded: false });
}
const meshesOf = g => { const out = []; g.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
// bakes a fading group (room, wall, baffles) down to one mesh per material so it costs a handful of draw calls
function compact(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), parts = new Map(), keep = [];
  for (const o of meshesOf(g)) {
    if (o.isInstancedMesh || !o.geometry.attributes.uv) { keep.push(o); continue; }
    const flat = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    flat.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const list = Array.isArray(o.material) ? o.geometry.groups.map(gr => [o.material[gr.materialIndex], gr.start, gr.count]) : [[o.material, 0, flat.attributes.position.count]];
    for (const [mat, start, count] of list) { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push({ g: flat, start, count }); }
    o.parent.remove(o);
  }
  for (const [mat, list] of parts) {
    let n = 0; for (const p of list) n += p.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (const { g: q, start, count } of list) {
      const A = q.attributes;
      pos.set(A.position.array.subarray(start * 3, (start + count) * 3), k * 3); nor.set(A.normal.array.subarray(start * 3, (start + count) * 3), k * 3);
      uv.set(A.uv.array.subarray(start * 2, (start + count) * 2), k * 2); k += count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = !mat.transparent; m.receiveShadow = true; g.add(m); keep.push(m);
  }
  return keep;
}

function officeMaterials() {
  const TAU = Math.PI * 2;
  const T = {};
  T.floor = canvasTex(64, 64, (g, W, H) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = Math.sin(x / W * TAU * 3 + Math.sin(y / H * TAU * 2) * 2) * Math.sin(y / H * TAU * 3 + x / W * TAU);
      P(g, x, y, [98, 110, 124], 1 + n * .08 + (rnd() - .5) * .04);
    }
  });
  // the feature wall's tiles: an eight-point star in rust with navy florals
  T.tile = canvasTex(32, 32, (g) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const u = (x + .5) / 16 - 1, v = (y + .5) / 16 - 1, au = Math.abs(u), av = Math.abs(v);
      const star = Math.min(Math.max(au, av), (au + av) / 1.414);
      let c = [234, 226, 210];
      if (star > .56 && star < .74) c = [198, 108, 44];
      else if (star <= .6) {
        const a = Math.atan2(v, u), r = Math.hypot(u, v), petal = Math.cos(a * 8) * .5 + .5;
        if (r < .18) c = [206, 124, 52];
        else if (r < .48 && petal > .62 - r * .6) c = [50, 68, 108];
        else if (r < .56 && petal > .35) c = [126, 146, 178];
      } else {
        const cu = 1 - au, cv = 1 - av, rc = Math.hypot(cu, cv);
        if (rc < .2) c = [50, 68, 108]; else if (rc < .29) c = [212, 140, 70];
        else if (Math.abs(cu - cv) < .07 && rc < .5) c = [50, 68, 108];
      }
      P(g, x, y, c, 1 + (rnd() - .5) * .06);
    }
  }, { nearest: true });
  T.walnut = canvasTex(32, 32, (g, W, H) => { for (let x = 0; x < W; x++) { const b = 1 + Math.sin(x * .9) * .06 + (rnd() - .5) * .08; for (let y = 0; y < H; y++) P(g, x, y, [122, 76, 42], b * (1 + (rnd() - .5) * .05)); } });
  T.slat = canvasTex(16, 16, (g, W, H) => { for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) P(g, x, y, [72, 45, 30], x % 4 === 0 ? .5 : 1 + (rnd() - .5) * .08); }, { nearest: true });
  T.felt = canvasTex(16, 16, (g, W, H) => noiseFill(g, W, H, [204, 180, 142], .08));
  T.fabric = canvasTex(16, 16, (g, W, H) => noiseFill(g, W, H, [158, 158, 152], .1));
  T.navy = canvasTex(16, 16, (g, W, H) => noiseFill(g, W, H, [50, 66, 98], .12));
  T.window = canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c;
      if (y < 17) c = y % 3 === 2 ? [196, 188, 170] : [218, 210, 192];                    // roller blind
      else c = [176, 204, 200];
      if (x === 0 || y === 17) c = [64, 66, 70];
      P(g, x, y, c, 1 + (rnd() - .5) * .05);
    }
    for (let i = 0; i < 9; i++) {                                                          // trees outside
      const bx = 2 + rnd() * 28 | 0, by = 20 + rnd() * 10 | 0, r = 2 + rnd() * 3, c = rnd() < .5 ? [86, 128, 74] : [112, 152, 90];
      for (let yy = 18; yy < H; yy++) for (let xx = 1; xx < W; xx++) if (Math.hypot(xx - bx, (yy - by) * 1.2) < r) P(g, xx, yy, c, 1 + (rnd() - .5) * .15);
    }
  }, { nearest: true });
  T.exit = canvasTex(32, 64, (g, W, H) => {
    noiseFill(g, W, H, [112, 114, 116], .05);
    g.fillStyle = '#4a4c50'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H);
    g.fillStyle = '#1f9a52'; g.fillRect(5, 6, 22, 9); g.fillStyle = '#eafff0'; g.fillRect(8, 9, 16, 1); g.fillRect(8, 12, 12, 1);
    g.fillStyle = '#9ec4d6'; g.fillRect(6, 19, 6, 8);
    g.fillStyle = '#d8d8d8'; g.fillRect(4, 34, 24, 2); g.fillStyle = '#1f9a52'; g.fillRect(9, 39, 14, 6);
  }, { nearest: true });
  T.carrom = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, [230, 204, 156], .05);
    g.fillStyle = '#5a3418'; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
    g.fillStyle = '#111'; for (const [x, y] of [[3, 3], [26, 3], [3, 26], [26, 26]]) g.fillRect(x, y, 3, 3);
    g.fillStyle = '#b8322a'; g.fillRect(14, 14, 4, 4); g.fillStyle = '#3a2a1a';
    for (const k of [7, 24]) { g.fillRect(7, k, 18, 1); g.fillRect(k, 7, 1, 18); }
  }, { nearest: true });
  T.lotusR = lotusTex('#d8443a', '#f2c14e'); T.lotusB = lotusTex('#2d4f8e', '#9ec4ff');
  function lotusTex(a, b) {
    return canvasTex(24, 24, g => {
      g.fillStyle = a;
      for (let i = -2; i <= 2; i++) { g.save(); g.translate(12, 20); g.rotate(i * .5); g.beginPath(); g.ellipse(0, -8, 3.2, 8, 0, 0, 6.3); g.fill(); g.restore(); }
      g.fillStyle = b; g.beginPath(); g.ellipse(12, 13, 2.5, 5, 0, 0, 6.3); g.fill(); g.fillRect(11, 20, 2, 4);
    }, { nearest: true });
  }
  MAT.oFloor = std(T.floor, 5, { roughness: 1, metalness: 0 });   // matte: no light spots on the floor
  MAT.tile = std(T.tile, .9); MAT.walnut = std(T.walnut, 1.2); MAT.slat = std(T.slat, .5);
  MAT.felt = std(T.felt, 1); MAT.fabric = std(T.fabric, 1); MAT.navy = std(T.navy, 1);
  MAT.navy2 = std(T.navy, 1, { side: THREE.DoubleSide }); MAT.navy2.color.setRGB(1.45, 1.45, 1.5);
  MAT.navy3 = std(T.navy, 1); MAT.navy3.color.setRGB(1.3, 1.3, 1.35);
  MAT.white = new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: .6 });
  MAT.charcoal = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: .7 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: .25, metalness: .8 });
  MAT.window = std(T.window, 2, { emissive: 0xffffff, emissiveMap: T.window, emissiveIntensity: .55 });
  MAT.pane = new THREE.MeshStandardMaterial({ color: 0xd2e8ee, transparent: true, opacity: .16, roughness: .05, depthWrite: false });
  MAT.ledStrip = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2.2 });
  MAT.shade = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, emissive: 0xffc888, emissiveIntensity: .7, side: THREE.DoubleSide });
  MAT.monitor = new THREE.MeshStandardMaterial({ map: TX.screen, emissive: 0xffffff, emissiveMap: TX.screen, emissiveIntensity: .5 });
  MAT.pink = new THREE.MeshStandardMaterial({ color: 0xe8a596, roughness: .7 });
  MAT.exit = std(T.exit, 0, { emissive: 0xffffff, emissiveMap: T.exit, emissiveIntensity: .15 });
  T.marble = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, [30, 30, 33], .12);
    for (let v = 0; v < 3; v++) { let x = rnd() * W, y = 0; while (y < H) { P(g, (x | 0 + W) % W, y | 0, [150, 150, 154], 1 - rnd() * .3); x += (rnd() - .4) * 1.6; y += .7; } }
  });
  MAT.marble = std(T.marble, 1.2, { roughness: .3, metalness: .1 });
  MAT.steel = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: .3, metalness: .7 });
  MAT.elecSign = std(canvasTex(48, 16, g => { g.fillStyle = '#c0281c'; g.fillRect(0, 0, 48, 16); g.fillStyle = '#fff'; g.font = '600 7px "Pixelify Sans", monospace'; g.textBaseline = 'middle'; g.fillText('ELECTRICAL', 3, 5); g.fillText('ROOM', 3, 12); g.fillStyle = '#ffd23a'; g.fillRect(38, 4, 6, 8); }), 0);
  MAT.carrom = std(T.carrom, 0);
  MAT.greenTile = std(canvasTex(16, 16, g => { g.fillStyle = '#efe8d8'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#2e7a5a'; g.beginPath(); g.moveTo(8, 1); g.lineTo(15, 8); g.lineTo(8, 15); g.lineTo(1, 8); g.fill(); g.fillStyle = '#1d1d1d'; for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) g.fillRect(x, y, 1, 1); }, { nearest: true }), 0);
  MAT.greenTile.map.repeat.set(12, 1);
  MAT.cabinet = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: .15, metalness: .3 });
  MAT.yellowBoard = new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: .7 });
  MAT.lotusR = new THREE.MeshStandardMaterial({ map: T.lotusR, alphaTest: .5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: T.lotusR, emissiveIntensity: .3 });
  MAT.lotusB = new THREE.MeshStandardMaterial({ map: T.lotusB, alphaTest: .5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: T.lotusB, emissiveIntensity: .3 });
}

function chandelier(x, z, y = 3.25) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.6, 6), MAT.chrome); rod.position.y = 1.3; g.add(rod);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .05, .55, 8), MAT.chrome); g.add(hub);
  const shade = new THREE.CylinderGeometry(.08, .14, .2, 10, 1, true), cone = new THREE.ConeGeometry(.05, .16, 6);
  for (const [n, r, h] of [[8, .58, 0], [5, .3, .3]]) for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + h, sx = Math.cos(a) * r, sz = Math.sin(a) * r;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(r, .02, .02), MAT.chrome); arm.position.set(sx / 2, h - .12, sz / 2); arm.rotation.y = -a; g.add(arm);
    const s = new THREE.Mesh(shade, MAT.shade); s.position.set(sx, h + .02, sz); g.add(s);
    const c = new THREE.Mesh(cone, MAT.chrome); c.rotation.x = Math.PI; c.position.set(sx, h - .14, sz); g.add(c);
  }
  pointLight('lab', 0xffcf94, 1.9, 10, x, y - .5, z);
}
function chair(x, z, side, p, m = MAT.charcoal) {
  box(.5, .08, .48, m, x, .42, z, { p }); box(.48, .56, .05, m, x, .55, z + side * .24, { p });
  box(.05, .38, .05, MAT.chrome, x, .05, z, { p }); box(.56, .04, .06, MAT.charcoal, x, .02, z, { p }); box(.06, .04, .56, MAT.charcoal, x, .02, z, { p });
}
function deskPlant(x, y, z, p) {
  const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .16, 8), MAT.pink), p); pot.position.set(x, y + .08, z);
  const l = add(new THREE.Mesh(jitterSphere(.13, 1), MAT.leafA), p); l.position.set(x, y + .24, z);
}
// two rows of benching desks facing each other across a fabric screen, centred on (cx, cz);
// ns = true turns the row to run north-south; o.pitch is the width per seat, o.tight uses real 60 cm desks
function deskCluster(cx, cz, cols, ns, o = {}) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); if (ns) g.rotation.y = Math.PI / 2; scene.add(g);
  const P = o.pitch ?? 1.6, len = cols * P, x0 = -len / 2 + P / 2, dd = o.tight ? .32 : .45, cz2 = o.tight ? .9 : 1.15;
  for (const side of [-1, 1]) {
    const dz = side * dd;
    box(len, .05, o.tight ? .62 : .86, MAT.walnut, 0, .72, dz, { p: g });
    for (let i = 0; i <= cols; i++) box(.06, .72, o.tight ? .56 : .8, MAT.white, x0 - P / 2 + i * P, 0, dz, { p: g });
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * P;
      box(.42, .58, .5, MAT.white, x + .5, 0, dz, { p: g });
      box(.64, .4, .04, MAT.charcoal, x - .1, .9, side * .13, { p: g }); box(.6, .34, .02, MAT.monitor, x - .1, .93, side * .155, { p: g });
      box(.06, .14, .06, MAT.charcoal, x - .1, .77, side * .1, { p: g });
      chair(x - .1, side * cz2, side, g);
      if (rnd() < .45) deskPlant(x + .45, .77, dz + side * .1, g);
      if (rnd() < .4) { const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .26, 8), MAT.chrome), g); b.position.set(x + .25, .9, dz - side * .05); }
      if (rnd() < .35) box(.42, .02, .3, MAT.chrome, x - .45, .77, dz + side * .1, { p: g });
    }
  }
  box(len, .46, .05, MAT.fabric, 0, .77, 0, { p: g });
  box(len - .1, .42, .03, MAT.white, 0, .22, 0, { p: g });   // white modesty panel under the screens
  const hx = len / 2 + .1, hz = o.tight ? 1.2 : 1.5;
  if (ns) colBox(cx - hz, cz - hx, cx + hz, cz + hx); else colBox(cx - hx, cz - hz, cx + hx, cz + hz);
}
// walnut meeting room. `front` ('n', 'e' or 'w') gets the glass, door and garlands; the south wall is cut low so you can look in
// o.table 'long' or 'round', o.seats per side, o.doorAt (distance of the door along the front), o.sMat for a full-height south wall
function room(x0, z0, x1, z1, front, name, lines, o = {}) {
  const g = grp(), H = 3, czr = (z0 + z1) / 2;
  const sides = { n: [x0, z0, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1] };
  let door, plate;
  for (const k in sides) {
    const [a, b, c, d] = sides[k], horiz = b === d, len = horiz ? c - a : d - b;
    const put = (t0, t1, y, h, mat, thick, cast = true) => {
      const m = (t0 + t1) / 2, w = t1 - t0;
      if (horiz) box(w, h, thick, mat, a + m, y, b, { p: g, cast }); else box(thick, h, w, mat, a, y, b + m, { p: g, cast });
    };
    const col = (t0, t1) => horiz ? colBox(a + t0, b - .12, a + t1, b + .12) : colBox(a - .12, b + t0, a + .12, b + t1);
    if (k === front) {
      const dm = o.doorAt ?? Math.min(len / 2 + .5, len - Math.min(.8, len * .15) - .65), d0 = dm - .6, d1 = dm + .6, e = Math.min(.8, len * .15, d0 - .05);
      put(0, e, 0, H, MAT.walnut, .2); put(len - e, len, 0, H, MAT.walnut, .2); col(0, e); col(len - e, len);
      for (const [t0, t1] of [[e, d0], [d1, len - e]]) if (t1 - t0 > .05) { put(t0, t1, .1, H - .22, MAT.pane, .05, false); put(t0, t1, 0, .1, MAT.walnut, .14); put(t0, t1, H - .12, .12, MAT.walnut, .14); col(t0, t1); }
      put(d0, d1, H - .5, .5, MAT.walnut, .2);
      const off = k === 'e' ? .14 : -.14;
      for (const t of [e, d0 - .08, d1 + .08, len - e]) horiz ? garlandV(a + t, b + off, .1, H - .15) : garlandV(a + off, b + t, .1, H - .15);
      door = horiz ? [a + dm, b - .9] : [a + (k === 'e' ? .9 : -.9), b + dm];
      plate = horiz ? [a + dm, H - .25, b + off * .8, 0] : [a + off * .8, H - .25, b + dm, Math.PI / 2];
    } else if (k === 's') { put(0, len, 0, o.sMat ? H : 1.1, o.sMat || MAT.walnut, .2); col(0, len); }
    else { put(0, len, 0, H, MAT.walnut, .2); col(0, len); }
  }
  g.add(signBoard(name, plate[0], plate[1], plate[2], 1.15, .36, plate[3], { size: 17, bg: '#4a2c18', edge: '#2a180c', color: '#f6e3b4', w: 160, h: 52 }));
  // inside: round table, four chairs, a TV on the wall facing the door
  const tx = (x0 + x1) / 2, tz = czr;
  const W = x1 - x0, D = z1 - z0;
  if (o.table ? o.table === 'long' : !o.small && Math.max(W, D) > 7 && Math.min(W, D) > 4.4) {
    // conference room: long table down the long side of the room, chairs on both sides
    const along = o.along ?? W >= D, L = (along ? W : D) * (along === (W >= D) ? .58 : .75), n = o.seats ?? Math.floor(L / .9);
    along ? box(L, .06, 1.4, MAT.walnut, tx, .72, tz, { p: g }) : box(1.4, .06, L, MAT.walnut, tx, .72, tz, { p: g });
    for (const t of [-L / 2 + .4, L / 2 - .4]) along ? box(.1, .72, 1.1, MAT.charcoal, tx + t, 0, tz, { p: g }) : box(1.1, .72, .1, MAT.charcoal, tx, 0, tz + t, { p: g });
    for (let i = 0; i < n; i++) for (const sd of [-1, 1]) {
      const t = -L / 2 + (i + .5) * L / n;
      along ? chair(tx + t, tz + sd * 1.05, sd, g) : chair(tx + sd * 1.05, tz + t, sd, g);
    }
    along ? colBox(tx - L / 2 - .2, tz - 1.4, tx + L / 2 + .2, tz + 1.4) : colBox(tx - 1.4, tz - L / 2 - .2, tx + 1.4, tz + L / 2 + .2);
  } else {
    const tr = Math.min(.75, Math.min(W, D) / 2 - .65), cr = tr + .35;
    const top = add(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, .05, 20), MAT.walnut), g); top.position.set(tx, .74, tz);
    box(.12, .72, .12, MAT.charcoal, tx, 0, tz, { p: g });
    for (let i = 0; i < 4; i++) { const an = i * 1.57 + .6; box(.42, .45, .42, MAT.fabric, tx + Math.cos(an) * cr, 0, tz + Math.sin(an) * cr, { p: g }); }
    colCirc(tx, tz, cr + .2);
  }
  const slide = std(ledTex([name, 'AI literacy · 101'], '#e8f0ff', 256, 128), 0);
  const tv = new THREE.Mesh(new THREE.BoxGeometry(2, 1.12, .06), [MAT.charcoal, MAT.charcoal, MAT.charcoal, MAT.charcoal, slide, MAT.charcoal]);
  if (front === 'w') { tv.position.set(x1 - .15, 1.65, czr); tv.rotation.y = -Math.PI / 2; } else { tv.position.set(x0 + .15, 1.65, czr); tv.rotation.y = Math.PI / 2; }
  g.add(tv);
  makeFader(compact(g), () => hero.zone === 'lab' && hero.x > x0 - .6 && hero.x < x1 + .6 && hero.y < z1 && hero.y > z0 - 8);
  INTER.push({ x: door[0], z: door[1], r: 1.4, label: name, verb: 'Read', act: () => talk(name, lines) });
}
function sofa(x, z, ry, s = 1, m = MAT.navy3) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.x = s; scene.add(g);
  box(2.6, .42, .9, m, 0, 0, 0, { p: g }); box(2.6, .55, .26, m, 0, .42, -.32, { p: g });
  for (const s of [-1, 1]) box(.26, .62, .9, m, s * 1.3, 0, 0, { p: g });
  for (const s of [-1, 1]) box(1.15, .12, .66, m, s * .6, .42, .1, { p: g });
  const c = Math.abs(Math.sin(ry)) > .5; const L = 1.5 * s; colBox(x - (c ? .55 : L), z - (c ? L : .55), x + (c ? .55 : L), z + (c ? L : .55));
}
function tubChair(x, z) {
  const o = add(new THREE.Mesh(new THREE.CylinderGeometry(.46, .4, .62, 16, 1, true), MAT.navy2)); o.position.set(x, .31, z);
  const s = add(new THREE.Mesh(new THREE.CylinderGeometry(.39, .39, .4, 16), MAT.navy3)); s.position.set(x, .2, z);
  colCirc(x, z, .45);
}
function bigPlant(x, z) {
  const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .55, 12), MAT.white)); p.position.set(x, .275, z);
  for (let i = 0; i < 4; i++) { const l = add(new THREE.Mesh(jitterSphere(rr(.32, .45), 1), MAT.leafA)); l.position.set(x + rr(-.25, .25), .8 + i * .38, z + rr(-.2, .2)); }
  colCirc(x, z, .35);
}
function stool(x, z) {
  box(.05, .75, .05, MAT.chrome, x, 0, z); box(.4, .02, .4, MAT.charcoal, x, .02, z);
  const s = add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .07, 12), MAT.charcoal)); s.position.set(x, .8, z);
}
