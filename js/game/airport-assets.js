// TokenFall: the airport's model files. airport_pack_total.glb (a low-poly airport kit on one palette texture: airliners, a control tower,
// a hangar, a passenger bus, a fire truck, baggage tractors, containers, stairs, desks, bins, plants, signs) and
// a320-200_with_cockpit_ver_viii.glb (a detailed A320 for the plane at our gate). Both are big, so they load the first time you walk into
// the airport, and until then the hand-built stand-ins in airport-apron.js show. Each model is baked to world scale, turned so a plane's
// nose points along +x (a vehicle's front too), centred, and stood on y = 0; apAsset(name, length) hands back a fresh copy at a size.
// Classic script: shares one global scope with the other js/game/files.

const AP_ASSETS = { lib: {}, a320: null, ready: false, waiting: [], started: false };
// ask for the models; fn runs once they are in (at once if they already are)
function apWhenAssets(fn) { if (AP_ASSETS.ready) fn(); else AP_ASSETS.waiting.push(fn); apLoadAssets(); }

// bake a node to a holder: its world transform applied, textures in the game's linear colour, opaque, shadows on
function apBake(node) {
  node.updateMatrixWorld(true);
  const c = node.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); c.applyMatrix4(node.matrixWorld);
  c.traverse((m) => {
    if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
    const ms = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of ms) {
      for (const k of ['map', 'emissiveMap']) if (mt[k]) { mt[k].encoding = THREE.LinearEncoding; mt[k].anisotropy = 8; mt[k].needsUpdate = true; }
      if (mt.transparent && mt.opacity >= .99 && !/glass|window/i.test(mt.name)) { mt.transparent = false; mt.depthWrite = true; if (mt.map) mt.alphaTest = .5; }   // cut-out edges stay cut out, not black
      mt.side = THREE.FrontSide;
      if (mt.normalMap) { mt.normalMap = null; mt.needsUpdate = true; }   // bump maps need real uvs; merged pieces without uvs would shade NaN (black squares)
    }
  });
  const holder = new THREE.Group(); holder.add(c); return holder;
}
// stand a holder on the ground, centred, and for a plane turn its nose to +x: the fin is the highest point, on the centre line, at the tail
function apSettle(holder, plane, frontAxis) {
  holder.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(holder);
  if (plane) {
    let top = null; holder.traverse((m) => { if (!m.isMesh) return; const p = m.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (!top || v.y > top.y) top = v.clone(); } });
    const c = b.getCenter(new THREE.Vector3()), ox = top.x - c.x, oz = top.z - c.z;
    // the tail is along the axis where the fin sits far from the middle; the nose is the other way
    const yaw = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? Math.PI : 0) : (oz > 0 ? -Math.PI / 2 : Math.PI / 2);   // turning by a about y sends -z to (-sin a, -cos a)
    holder.rotation.y = yaw;
  } else if (frontAxis) holder.rotation.y = frontAxis;
  holder.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(holder);
  const c = b.getCenter(new THREE.Vector3());
  const out = new THREE.Group(); holder.position.set(-c.x, -b.min.y, -c.z); out.add(holder);
  out.userData.size = b.getSize(new THREE.Vector3());
  return out;
}
// fold a many-piece model into one mesh per material (the A320 is 540 pieces: 540 draw calls a frame otherwise)
function apMerge(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), buckets = new Map();
  g.traverse((m) => {
    if (!m.isMesh) return;
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const mats = Array.isArray(m.material) ? m.material : [m.material], groups = Array.isArray(m.material) && geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) { const mt = mats[gr.materialIndex]; if (!buckets.has(mt)) buckets.set(mt, []); buckets.get(mt).push([geo, gr.start, gr.count]); }
  });
  const out = new THREE.Group(); out.userData.size = g.userData.size;
  for (const [mt, list] of buckets) {
    let n = 0; for (const [, , c] of list) n += c;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const [geo, st, c] of list) {
      const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
      for (let i = 0; i < c; i++, o++) { const k = st + i; pos[o * 3] = P.getX(k); pos[o * 3 + 1] = P.getY(k); pos[o * 3 + 2] = P.getZ(k); nor[o * 3] = N.getX(k); nor[o * 3 + 1] = N.getY(k); nor[o * 3 + 2] = N.getZ(k); if (U) { uv[o * 2] = U.getX(k); uv[o * 2 + 1] = U.getY(k); } }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, mt); mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh);
  }
  return out;
}
// the long side of a settled model, along x
const apLong = (g) => g.userData.size.x;
function apLoadAssets() {
  if (AP_ASSETS.started) return; AP_ASSETS.started = true;
  const L = new THREE.GLTFLoader(), get = (u) => new Promise((res, rej) => L.load(u, res, undefined, rej));
  get('airport_pack_total.glb').then((g) => {
    g.scene.updateMatrixWorld(true);
    const root = g.scene.getObjectByName('RootNode');
    for (const n of root.children) {
      if (/Collider|^Cube\./.test(n.name)) continue;
      const plane = /Airplane$/.test(n.name);
      AP_ASSETS.lib[n.name] = apSettle(apBake(n), plane);
    }
    return get('a320-200_with_cockpit_ver_viii.glb');
  }).then((a) => {
    a.scene.updateMatrixWorld(true);
    AP_ASSETS.a320 = apMerge(apSettle(apBake(a.scene), true));
    AP_ASSETS.ready = true; for (const f of AP_ASSETS.waiting.splice(0)) f();
  }).catch((e) => console.warn('Airport models did not load; keeping the stand-ins', e));
}
// a fresh copy of a model (shares geometry and materials), scaled so its length along x is `len` (or by `k` when len is not given)
function apAsset(name, len, k) {
  const src = name === 'a320' ? AP_ASSETS.a320 : AP_ASSETS.lib[name]; if (!src) return null;
  const g = src.clone(true), s = len ? len / apLong(src) : (k || 1); g.scale.setScalar(s); g.userData.size = src.userData.size.clone().multiplyScalar(s);
  return g;
}
// put a model straight into the scene at (x, z), turned by ry
function apPlace(name, x, z, ry = 0, len, k) { const g = apAsset(name, len, k); if (!g) return null; g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); return g; }
