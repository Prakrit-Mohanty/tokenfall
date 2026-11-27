// TokenFall model files: the cars, motorbikes and robot dog as binary .glb files in assets/models (meshopt-compressed by tools/models-pack.mjs),
// fetched only when the zone they stand in is entered (or is being travelled to), instead of ~26 MB of base64 parsed before the first frame.
// Opened from file:// the browser will not fetch files for WebGL, so there the embedded packs (js/models/cars.js and friends) are loaded as before.
//   ModelFiles.parse(name, embedded)  -> Promise of the parsed glTF: from the embedded base64 when given, else assets/models/<name>.glb
//   ModelFiles.when(object3d)         -> Promise that resolves once the zone the object stands in is entered (setZone) or travelled to
//   ModelFiles.enter(zone)            -> called by setZone and travel: releases every model waiting in that zone
//   ModelFiles.settled(maxMs)         -> Promise that resolves once no model is being fetched or parsed (or after maxMs): travel waits on it so the models are in before the screen is shown
(function () {
  const EMBEDDED = location.protocol === 'file:';
  if (EMBEDDED) for (const f of ['js/models/cars.js?v=13', 'js/models/supercars.js?v=4', 'js/models/bikes.js?v=1', 'js/models/robodog.js?v=1', 'js/models/train.js?v=1']) document.write(`<script src="${f}"><\/script>`);

  let loader = null;
  const gltf = () => {
    if (!loader) { loader = new THREE.GLTFLoader(); if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); }
    return loader;
  };
  const fromBase64 = (s) => { const bin = atob(s), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; };
  function parse(name, embedded) {
    const bytes = embedded ? Promise.resolve().then(() => fromBase64(embedded))
      : fetch(`assets/models/${name}.glb`).then((r) => { if (!r.ok) throw new Error(`assets/models/${name}.glb: HTTP ${r.status}`); return r.arrayBuffer(); });
    busy++;
    return bytes.then((buf) => new Promise((res, rej) => gltf().parse(buf, '', res, rej))).finally(() => busy--);
  }
  let busy = 0;
  const settled = (maxMs) => new Promise((r) => { const t0 = performance.now(), poll = () => (busy === 0 || performance.now() - t0 > maxMs ? r() : setTimeout(poll, 50)); poll(); });

  // zones: the nearest zone centre to where the object stands (zones sit 300+ apart: the lobby at the origin, the rest in AREAS)
  const waiting = [], at = new THREE.Vector3();
  let current = null;
  function zoneOf(o) {
    o.updateWorldMatrix(true, false); o.getWorldPosition(at);
    let best = 'lobby', bd = at.x * at.x + at.z * at.z;
    const areas = typeof AREAS !== 'undefined' ? AREAS : {};
    for (const k in areas) { const a = areas[k], d = (at.x - a.cx) ** 2 + (at.z - a.cz) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function release(z) {
    for (let i = waiting.length - 1; i >= 0; i--) if (zoneOf(waiting[i][0]) === z) { const r = waiting[i][1]; waiting.splice(i, 1); r(); }
  }
  // the zone is judged when it is entered, not when the object is made: builders place their groups after creating them (traffic, stack parkers)
  function when(o) {
    return new Promise((r) => { waiting.push([o, r]); if (current) setTimeout(() => release(current), 0); });
  }
  function enter(z) { current = z; release(z); }

  window.ModelFiles = { embedded: EMBEDDED, parse, when, enter, settled, zoneOf, get waiting() { return waiting.length; } };
})();
