// TokenFall: small outdoor props: trees, bushes, lamps, benches, signs.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= props =================
function streetLamp(x, z, zone, light = true) {
  box(.34, .2, .34, MAT.metal, x, 0, z); box(.12, 3.5, .12, MAT.metal, x, .2, z); box(.95, .08, .12, MAT.metal, x + .42, 3.62, z);
  box(.56, .08, .3, MAT.warmGlow, x + .74, 3.52, z, { cast: false }); box(.62, .1, .36, MAT.metal, x + .74, 3.6, z);
  colCirc(x, z, .22);
  if (light) pointLight(zone, 0xffc27a, 1.6, 9, x + .74, 3.2, z + .2);
}
function bollard(x, z) { box(.18, .7, .18, MAT.metal, x, 0, z); box(.2, .1, .2, MAT.warmGlow, x, .52, z, { cast: false }); colCirc(x, z, .14); }
function bench(x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  for (const dx of [-.75, .75]) box(.16, .42, .5, MAT.concrete, dx, 0, 0, { p: g });
  for (let i = 0; i < 4; i++) box(1.9, .06, .1, MAT.wood, 0, .42, -.18 + i * .12, { p: g });
  const c = Math.abs(Math.sin(ry)) > .5; colBox(x - (c ? .3 : .95), z - (c ? .95 : .3), x + (c ? .3 : .95), z + (c ? .95 : .3));
}
function jitterSphere(r, detail) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const nn = v.clone().normalize();
    const k = 1 + .08 * Math.sin(v.x * 5.1 / r + v.y * 3.3 / r) * Math.cos(v.z * 4.7 / r - v.y * 2.1 / r);
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * .85, v.z); n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}
// a sprinkling of little pastel flowers over a canopy: one Points object per tree (a single draw call), soft round dots
let blossomMat;
function treeBlossoms(g, blobs, s) {
  if (s < .8 || decorRandom() > .65) return;
  blossomMat = blossomMat || new THREE.PointsMaterial({ size: .24, map: TX.glow, vertexColors: true, transparent: true, depthWrite: false });
  const n = 12, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = [[1, .96, .9], [1, .8, .86], [1, .92, .7], [.86, .8, 1]];
  for (let i = 0; i < n; i++) {
    const [p, r] = blobs[decorRandom() * blobs.length | 0], th = decorRandom() * 6.283, ph = decorRandom() * 1.3, c = pal[decorRandom() * 4 | 0];
    pos.set([p.x + Math.cos(th) * Math.cos(ph) * r * .95, p.y + Math.sin(ph) * r * .8, p.z + Math.sin(th) * Math.cos(ph) * r * .95], i * 3); col.set(c, i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, blossomMat); pts.userData.dyn = true; g.add(pts);
}
function tree(x, z, s = 1, leaf = MAT.leafA, collide = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const tr = add(new THREE.Mesh(new THREE.CylinderGeometry(.15 * s, .26 * s, 2.6 * s, 7), MAT.bark), g); tr.position.y = 1.3 * s;
  const n = 5 + (rnd() * 3 | 0), blobs = [];
  // some green canopies come out lavender or rose (chosen from the separate decor sequence, so the layout's own random numbers never shift)
  const canopy = leaf === MAT.leafA || leaf === MAT.leafB || leaf === MAT.leafC ? ((u) => u < .2 ? MAT.leafLav : u < .38 ? MAT.blossom : leaf)(decorRandom()) : leaf;
  for (let i = 0; i < n; i++) {
    const r = (i ? rr(.75, 1.15) : 1.35) * s * 1.18, a = rnd() * 6.283, d = i ? rr(.7, 1.2) * s : 0;   // puffier, rounder clouds of leaves
    const m = add(new THREE.Mesh(jitterSphere(r, 2), canopy), g);
    m.position.set(Math.cos(a) * d, (i ? rr(2.3, 3.5) : 3.2) * s, Math.sin(a) * d * .8); blobs.push([m.position, r]);
  }
  treeBlossoms(g, blobs, s);
  if (collide) { g.userData.dyn = true; const ph = rnd() * 6; anim.push(t => { g.rotation.z = Math.sin(t * .7 + ph) * .012; }); }
  if (collide) colCirc(x, z, .4 * s);
  if (collide) makeFader(g.children.slice(), () => { const dz = z - hero.y; return dz > .4 && dz < 15 && Math.abs(x - hero.x) < 2.7 * s + dz * .08; });
  return g;
}
function bush(x, z, s = 1, leaf = MAT.leafB) {
  for (let i = 0; i < 3; i++) { const m = add(new THREE.Mesh(jitterSphere(rr(.45, .6) * s, 1), leaf)); m.position.set(x + (i - 1) * .45 * s, .35 * s, z + rr(-.15, .15)); }
  colCirc(x, z, .6 * s);
}
function planterTree(x, z, leaf, s = 1) {
  box(2.2, .5, 2.2, MAT.concrete, x, 0, z); plane(1.9, 1.9, MAT.dirt, x, .51, z, 1);
  tree(x, z, s, leaf); COL[COL.length - 1].r = 1.2;
}
function pot(x, z, s = 1) {
  const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.32 * s, .26 * s, .6 * s, 12), MAT.concrete)); p.position.set(x, .3 * s, z);
  const b = add(new THREE.Mesh(jitterSphere(.42 * s, 1), MAT.leafA)); b.position.set(x, .85 * s, z);
  colCirc(x, z, .35 * s);
}
// long concrete planter with a clipped hedge, used as the campus boundary
function hedgeRow(x0, z0, x1, z1) {
  const w = Math.abs(x1 - x0) || 1, d = Math.abs(z1 - z0) || 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(w, .5, d, MAT.concrete, cx, 0, cz); box(w - .12, .8, d - .12, MAT.hedge, cx, .5, cz);
  colBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
}
function signBoard(text, x, y, z, w = 2.4, h = .45, ry = 0, opts) {
  const m = std(textTex(text, opts), 0); m.emissiveMap = m.map; m.emissive.setScalar(.3);   // a sign lights its own words a little, so they read at night too
  const side = MAT.darkWood;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .08), [side, side, side, side, m, m]);
  b.position.set(x, y, z); b.rotation.y = ry; return add(b);
}
// font: CSS family; the pixel font's capital C reads like an O on small signs, so those use a plain one
function ledTex(lines, color, w = 256, h = 64, font = '"Pixelify Sans", monospace') {
  return canvasTex(w, h, g => {
    g.fillStyle = '#15171d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2c303a'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    const fs = Math.min(28, (h - 10) / lines.length * .78);
    g.font = `600 ${fs}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.2 + 1));
  });
}
function ledSign(lines, color, x, y, z, w, h, ry = 0, res = [256, 64], font) {
  const t = ledTex(lines, color, res[0], res[1], font);
  const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.6, roughness: .5 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .1), [MAT.metal, MAT.metal, MAT.metal, MAT.metal, m, MAT.metal]);
  b.position.set(x, y, z); b.rotation.y = ry; return add(b);
}
const PLAIN = '"Trebuchet MS", Arial, sans-serif';
function umbrellaTable(x, z, cloth) {
  const top = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .06, 14), MAT.wood)); top.position.set(x, .74, z);
  box(.08, 2.3, .08, MAT.metal, x, 0, z);
  const u = add(new THREE.Mesh(new THREE.ConeGeometry(1.35, .45, 8), cloth)); u.position.set(x, 2.45, z);
  for (const [dx, dz] of [[-.85, 0], [.85, 0]]) { box(.42, .45, .42, MAT.metal, x + dx, 0, z + dz); box(.42, .5, .06, MAT.metal, x + dx * 1.2, .45, z + dz); }
  colCirc(x, z, 1.1);
}
function glowStrip(color) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }); }
