// TokenFall: contact shadows, so nothing floats. Where a thing stands on the floor (a table's foot, a stool's legs, a planter, a cabinet, a pillar)
// the floor darkens softly right round it, and under anything low that it holds up (a table top, a seat, a bench, a shelf) a wider, fainter shade
// falls: the light the floor can't get. The sun's shadows swing with the hour and fall long and thin when it is low, which can leave a stool's
// legs standing in plain light under a seat whose shadow lies a metre away; these keep everything sat on the ground whatever the time of day.
//   groundContacts(root, skip)   once the areas are built (main.js): reads every static mesh's bounds, bakes the blobs into one mesh per region
// The lobby keeps its own hand-placed contact() blobs (props.js), so main.js skips it here. The blobs multiply the floor toward the palette's
// deep plum (palette.js: shade is plum, never black), fade into the fog with everything else, and cost one draw per region.
// Classic script: shares one global scope with the other js/game files, loaded after props.js and before main.js.

function contactMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTint: { value: new THREE.Color(PAL.plum).multiplyScalar(1.6).lerp(new THREE.Color(.5, .5, .5), .45) } }]),   // the depth pass's crease tint (post.js aoTint), a little greyer: shade, not a purple mat
    vertexShader: `attribute vec3 aBlob; varying vec3 vBlob; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vBlob = aBlob; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uTint; varying vec3 vBlob; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        vec2 q = abs(vUv * 2. - 1.), core = vBlob.xy * .7;   // core: most of the thing's own footprint, as a share of the blob; full shade there, easing out past it
        vec2 e = max(q - core, 0.) / max(1. - core, vec2(.001));
        float f = 1. - min(length(e), 1.), a = vBlob.z * f * f * (3. - 2. * f) * (.55 + .45 * f);   // soft all the way out, densest at the foot
      #ifdef USE_FOG
        a *= 1. - smoothstep(fogNear, fogFar, fogDepth);
      #endif
        gl_FragColor = vec4(mix(vec3(1.), uTint, a), 1.); }`,
    fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,   // the floor times the shade
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// what a mesh asks of the floor: null, or a blob { x, z, y, hx, hz, pad, k } (centre, height, the footprint's half size, how far the shade spreads past it, how dark)
function contactFor(o, bb) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.transparent || m.blending !== THREE.NormalBlending || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return null;
  if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) > .6) return null;   // glowing strips and screens light the floor, they don't shade it
  bb.setFromObject(o);
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  if (!(sx >= 0) || sy < .04 || sx > 7 || sz > 7 || sx * sz > 12) return null;   // flat things (floors, rugs, decals), and anything the size of a building
  if (sy > 2.4 && Math.min(sx, sz) < .5) return null;                         // walls: the depth pass already shades where they meet the floor
  const x = (bb.min.x + bb.max.x) / 2, z = (bb.min.z + bb.max.z) / 2, floor = floorAt(x, z), lift = bb.min.y - floor;
  if (lift < -.05) return null;                                               // sunk below the floor (a pit, a pool)
  if (lift < .06) return { x, z, y: bb.min.y, hx: sx / 2, hz: sz / 2, pad: .07 + Math.min(.22, Math.max(sx, sz) * .2), k: .4 };   // standing on it: tight and dark
  if (lift < 1.25 && sy < .5 && sx * sz > .08) return { x, z, y: floor, hx: sx / 2, hz: sz / 2, pad: .12 + lift * .4, k: .26 * (1 - lift / 1.4) };   // held up low over it: wide and faint
  return null;
}

function groundContacts(root = scene, skip = () => false) {
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3(), regions = new Map();
  const moving = (o) => { for (let p = o; p; p = p.parent) if (p.userData.dyn) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.contacted || o.userData.noContact) return;
    o.userData.contacted = true;
    if (moving(o)) return;   // anything that moves (or draws itself in a shader) gets no baked shade
    const c = contactFor(o, bb);
    if (!c || skip(c.x, c.z)) return;
    const key = c.x < -150 ? 'w' : c.x > 150 ? 'e' : c.z < -150 ? 'n' : c.z > 150 ? 's' : 'l';   // regions like mergeStatic's, so each area culls on its own
    (regions.get(key) || regions.set(key, []).get(key)).push(c);
  });
  let n = 0;
  for (const list of regions.values()) {
    const pos = new Float32Array(list.length * 12), uv = new Float32Array(list.length * 8), blob = new Float32Array(list.length * 12), idx = [];
    list.forEach((c, q) => {
      const rx = c.hx + c.pad, rz = c.hz + c.pad, y = c.y + .02;   // just above the floor plane (office floors sit at 1-2 cm)
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], j) => {
        const i = q * 4 + j; pos.set([c.x + u * rx, y, c.z + v * rz], i * 3); uv.set([(u + 1) / 2, (v + 1) / 2], i * 2); blob.set([c.hx / rx, c.hz / rz, c.k], i * 3);
      });
      idx.push(q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aBlob', new THREE.BufferAttribute(blob, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, contactMaterial()); mesh.renderOrder = 1; mesh.userData.dyn = true; mesh.userData.noContact = true; scene.add(mesh);
    n += list.length;
  }
  return n;
}
