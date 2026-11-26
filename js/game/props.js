// TokenFall: small outdoor props: trees, bushes, lamps, benches, signs.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= props =================
// the chunky, rounded way to build a stick: a round post (radius at the foot, height, top radius), instead of a thin box
function post(r, h, m, x, y, z, rTop = r, cast = true) { const me = add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 20), m), undefined, cast); me.position.set(x, y + h / 2, z); return me; }
// ---- grounding: contact shading and lamp pools ----
// contact(x, z, rx, rz, ry, y): a soft, low-opacity warm plum blob on the ground where something stands (rx / rz: half sizes along the prop's own axes, a little bigger than its footprint, ry its turn,
// y the height of what it stands on: a platform, a step).
// lampPool(x, z, r, k, y, rz): a soft warm pool of light on the ground (or on a floor y up) under a lamp (rz: its depth, if not round); daylight.js fades them in with the lamps at evening and night. Both are only recorded while the lobby builds (contactOn:
// the other zones stand at their own ground heights), and flushContacts() turns each list into ONE mesh, so a hundred props cost two draw calls.
let contactOn = false; const CONTACTS = [], POOLS = [];
const POOL_MAT = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
function contact(x, z, rx, rz = rx, ry = 0, y = 0) { if (contactOn) CONTACTS.push([x, z, rx, rz, ry, 1, y]); }
function lampPool(x, z, r = 3.4, k = 1, y = 0, rz = r) { if (contactOn) POOLS.push([x, z, r, rz, 0, k, y]); }
function flushContacts() {
  const quads = (list, y, rgb) => {
    const pos = new Float32Array(list.length * 12), nor = new Float32Array(list.length * 12), uv = new Float32Array(list.length * 8), col = new Float32Array(list.length * 12), idx = [];
    list.forEach(([x, z, rx, rz, ry, k = 1, dy = 0], q) => {
      const c = Math.cos(ry), sn = Math.sin(ry);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], j) => {
        const a = u * rx, b = v * rz, i = q * 4 + j;
        pos.set([x + a * c + b * sn, y + dy, z - a * sn + b * c], i * 3); nor.set([0, 1, 0], i * 3); uv.set([(u + 1) / 2, (v + 1) / 2], i * 2); col.set([k, k, k], i * 3);
      });
      idx.push(q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    return g;
  };
  if (CONTACTS.length) {
    const m = new THREE.Mesh(quads(CONTACTS, .03), new THREE.MeshLambertMaterial({ color: PAL.plum, map: TX.contact, transparent: true, opacity: .46, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 1; m.frustumCulled = false; scene.add(m);
  }
  if (POOLS.length) { POOL_MAT.map = TX.pool; const m = new THREE.Mesh(quads(POOLS, .035), POOL_MAT); m.renderOrder = 2; m.frustumCulled = false; scene.add(m); }
  CONTACTS.length = POOLS.length = 0; contactOn = false;
}

// a street prop from the modelled pack (js/models/street-props.js, from tools/props-pack.py): lamp, signal, trashCan, litterBin, hydrant.
// The geometry is shared by every copy; ry turns the model (the lamp's arm and the signal's lights face +z); o.p: a parent group
const SPROPS = { geo: {}, mat: null };
function streetProp(name, x, y, z, ry = 0, o = {}) {
  if (!SPROPS.mat) { const t = new THREE.TextureLoader().load(window.STREET_PROPS_TEX); t.flipY = false; SPROPS.mat = new THREE.MeshStandardMaterial({ map: t, roughness: .55, metalness: .15 }); }   // glTF UVs: no flip
  let geo = SPROPS.geo[name];
  if (!geo) {
    const d = window.STREET_PROPS[name]; geo = SPROPS.geo[name] = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3)); geo.setIndex(d.i);
  }
  const m = add(new THREE.Mesh(geo, SPROPS.mat), o.p); m.position.set(x, y, z); m.rotation.y = ry; return m;
}

// the curved street lamp; its glowing bulb sits under the shade at the end of the arm, which points along +x (as the old lamp's did)
function streetLamp(x, z, zone, light = true) {
  streetProp('lamp', x, 0, z, Math.PI / 2);
  const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 10), MAT.warmGlow), undefined, false); bulb.position.set(x + .89, 3.3, z);
  colCirc(x, z, .22); contact(x, z, .8); if (light) lampPool(x + .89, z);
  if (light) pointLight(zone, 0xffc27a, 1.6, 9, x + .89, 3.1, z);
}
function bollard(x, z) {
  post(.15, .55, MAT.metal, x, 0, z, .12); const g = add(new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), MAT.warmGlow), undefined, false); g.position.set(x, .66, z);
  colCirc(x, z, .14);
}
function bench(x, z, ry = 0) {
  PAVE_U.addBench(x, z);   // the paving grows moss in the joints under benches
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  for (const dx of [-.75, .75]) box(.22, .46, .54, MAT.concrete, dx, 0, 0, { p: g });
  for (let i = 0; i < 4; i++) box(1.9, .08, .115, MAT.wood, 0, .44, -.18 + i * .12, { p: g });
  contact(x, z, 1.4, .75, ry);
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
// a tree surround for a tree in paving: a ring of grey granite setts round a dark cast-iron grate of concentric slotted rings, split into
// quarters, with a bed of soil, grass tufts and little white flowers round the trunk. One flat decal (drawn once, shared), d metres across.
let TREE_GRATE = null;
function treeGrate(x, z, d = 1.7) {
  if (!TREE_GRATE) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), C = 256;
    let sd = 4242; const r01 = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // the granite setts: two rings of little rounded squares
    for (const [r0, n, sz] of [[236, 58, 24], [212, 52, 22]]) for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + (r0 === 212 ? .03 : 0), v = 150 + r01() * 50 | 0;
      g.save(); g.translate(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.rotate(a);
      g.fillStyle = `rgb(${v},${v},${v + 4})`; g.beginPath(); g.roundRect ? g.roundRect(-sz / 2, -sz / 2, sz, sz, 4) : g.rect(-sz / 2, -sz / 2, sz, sz); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.stroke(); g.restore();
    }
    // the iron grate
    g.fillStyle = '#2c2e33'; g.beginPath(); g.arc(C, C, 198, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#17181b'; g.lineWidth = 7; for (const r of [96, 120, 144, 168, 190]) { g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; for (const r of [100, 124, 148, 172]) { g.beginPath(); g.arc(C, C, r, Math.PI * 1.05, Math.PI * 1.7); g.stroke(); }
    g.strokeStyle = '#3a3c42'; g.lineWidth = 8; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.moveTo(C + Math.cos(a) * 86, C + Math.sin(a) * 86); g.lineTo(C + Math.cos(a) * 198, C + Math.sin(a) * 198); g.stroke(); }
    g.strokeStyle = '#3a3c42'; g.lineWidth = 6; g.beginPath(); g.arc(C, C, 86, 0, Math.PI * 2); g.stroke();
    // the soil bed with grass tufts and flowers
    const soil = g.createRadialGradient(C, C, 10, C, C, 84); soil.addColorStop(0, '#4a3424'); soil.addColorStop(1, '#3a281a'); g.fillStyle = soil; g.beginPath(); g.arc(C, C, 83, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + r01() * .4, r = 46 + r01() * 22, px = C + Math.cos(a) * r, py = C + Math.sin(a) * r;
      g.strokeStyle = ['#4f8f3a', '#5fa84a', '#3f7a30'][k % 3]; g.lineWidth = 3; g.lineCap = 'round';
      for (let b = 0; b < 7; b++) { const ba = r01() * Math.PI * 2, bl = 8 + r01() * 9; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ba) * bl, py + Math.sin(ba) * bl); g.stroke(); }
      if (k % 2) { for (let f = 0; f < 4; f++) { g.fillStyle = '#fbfbf2'; g.beginPath(); g.arc(px + (r01() - .5) * 14, py + (r01() - .5) * 14, 3.2, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#f2c84a'; g.beginPath(); g.arc(px, py, 2, 0, Math.PI * 2); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
    TREE_GRATE = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .8, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d, d), TREE_GRATE); m.rotation.x = -Math.PI / 2; m.position.set(x, .034, z); m.receiveShadow = true; scene.add(m);
  return m;
}
function tree(x, z, s = 1, leaf = MAT.leafA, collide = true) {
  PAVE_U.addPlant(x, z, s, true);   // petals settle near plants, and the paving gets dappled light under trees (groundlife.js)
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
  PAVE_U.addPlant(x, z, s);
  const mat = [MAT.leafA, MAT.leafB, MAT.leafC].indexOf(leaf), foliage = mat < 0 ? leaf : MAT.bush[mat];   // palette greens, lighter on top and darker underneath
  for (let i = 0; i < 3; i++) { const m = add(new THREE.Mesh(jitterSphere(rr(.45, .6) * s, 1), foliage)); m.position.set(x + (i - 1) * .45 * s, .35 * s, z + rr(-.15, .15)); }
  contact(x, z, 1.5 * s, 1.0 * s); colCirc(x, z, .6 * s);
}
function planterTree(x, z, leaf, s = 1) {
  box(2.2, .5, 2.2, MAT.concrete, x, 0, z); plane(1.9, 1.9, MAT.dirt, x, .51, z, 1);
  tree(x, z, s, leaf); COL[COL.length - 1].r = 1.2;
}
function pot(x, z, s = 1) {
  PAVE_U.addPlant(x, z, s);
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
// every sign is one style: a painted pastel panel in a warm wood frame with rounded lettering (signTex, textures.js). opts.bg / the LED colour only choose which pastel.
// Both builders keep the mesh layout [frame x4, panel, panel / frame] that the minigames rely on (the Mill swaps material[4]'s texture to re-letter a plate).
function signBoard(text, x, y, z, w = 2.4, h = .45, ry = 0, opts) {
  const m = std(textTex(text, opts), 0); m.emissiveMap = m.map; m.emissive.setScalar(.3);   // a sign lights its own words a little, so they read at night too
  const side = MAT.darkWood;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .12), [side, side, side, side, m, m]);
  b.position.set(x, y, z); b.rotation.y = ry; return add(b);
}
// ledTex is what the glowing screens use (a projector slide, a robot's face, a chess clock): a soft plum panel with rounded lettering in the colour asked for
function ledTex(lines, color, w = 256, h = 64, font = SIGN_FONT) {
  return canvasTex(w, h, g => {
    g.fillStyle = PAL.plum; g.fillRect(0, 0, w, h);
    g.fillStyle = PAL.paint; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    const fs = Math.min(28, (h - 10) / lines.length * .78);
    g.font = `600 ${fs}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.2 + 1));
  });
}
function ledSign(lines, color, x, y, z, w, h, ry = 0, res = [256, 64]) {
  const t = signTex(lines, color, res[0], res[1]), m = std(t, 0); m.emissiveMap = t; m.emissive.setScalar(.4);
  const side = MAT.darkWood, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .12), [side, side, side, side, m, side]);
  b.position.set(x, y, z); b.rotation.y = ry; return add(b);
}
const PLAIN = '"Trebuchet MS", Arial, sans-serif';
function umbrellaTable(x, z, cloth) {
  const top = add(new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .1, 24), MAT.wood)); top.position.set(x, .74, z);
  post(.34, .08, MAT.metal, x, 0, z); post(.1, 2.3, MAT.metal, x, .08, z, .08);
  const u = add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloth)); u.position.set(x, 2.15, z); u.scale.y = .38;   // a puffy parasol, not a flat 8-sided cone
  const k = add(new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), MAT.gold)); k.position.set(x, 2.78, z);
  for (const [dx, dz] of [[-.85, 0], [.85, 0]]) { post(.26, .34, MAT.metal, x + dx, 0, z + dz, .22); post(.32, .12, cloth, x + dx, .34, z + dz); box(.1, .5, .5, MAT.metal, x + dx * 1.35, .36, z + dz); }
  contact(x, z, 1.55); colCirc(x, z, 1.1);
}
function glowStrip(color) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }); }
