// TokenFall: water shader and the teleporter pads.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= water & portals =================
const timeU = { value: 0 };
const waterMat = new THREE.ShaderMaterial({
  uniforms: { t: timeU }, transparent: true, depthWrite: false,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float t; varying vec3 vW;
    void main(){ vec2 p=floor(vW.xz*14.)/14.;
      float w=sin(p.x*2.3+t*1.2)*sin(p.y*2.9-t*.9)+.5*sin((p.x+p.y)*3.7+t*.8);
      vec3 c=mix(vec3(.13,.31,.34),vec3(.27,.5,.5),smoothstep(-.8,1.3,w));
      float s=step(1.32,w+.35*sin(p.x*11.+t*2.6)*sin(p.y*7.-t*1.7)); c+=s*vec3(.55,.52,.4);
      gl_FragColor=vec4(c,.93); }`
});
function portalMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { t: timeU, col: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; uniform vec3 col; varying vec2 vUv;
      void main(){ float f=1.-vUv.y; f*=f;
        float s=.5+.5*sin(vUv.y*26.-t*3.+sin(vUv.x*18.85)*1.6);
        float sp=step(.985,fract(sin(dot(floor(vec2(vUv.x*40.,vUv.y*30.-t*4.)),vec2(12.9,78.2)))*43758.5));
        float a=f*(.35+.5*s)+sp*.9*(1.-vUv.y);
        gl_FragColor=vec4(col*a*.5,1.); }`
  });
}
function glowDisc(color) {
  return new THREE.ShaderMaterial({
    uniforms: { t: timeU, col: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; uniform vec3 col; varying vec2 vUv;
      void main(){ float d=length(vUv-.5)*2.; float a=smoothstep(1.,.0,d)*(.7+.3*sin(t*2.+d*8.)); gl_FragColor=vec4(col*a*.45,1.); }`
  });
}
// o.at: where you land on the far side, instead of the area's usual spawn point
function portal(x, z, color, zone, to, label, o = {}) {
  // a low pad with a glowing rim, a soft short glow, and a crystal floating above so you can spot it from afar
  const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, .12, 32), MAT.concrete), null, false); pad.position.set(x, .06, z);
  const rim = add(new THREE.Mesh(new THREE.TorusGeometry(1.32, .05, 6, 40), glowStrip(color)), null, false); rim.rotation.x = -Math.PI / 2; rim.position.set(x, .13, z);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), glowDisc(color)); disc.rotation.x = -Math.PI / 2; disc.position.set(x, .14, z); scene.add(disc);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, .8, 28, 1, true), portalMat(color));
  cyl.position.set(x, .52, z); scene.add(cyl);
  const gem = add(new THREE.Mesh(new THREE.OctahedronGeometry(.26), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: .3 })), null, false);
  gem.userData.dyn = true; const ph = x * .7 + z;
  anim.push(t => { gem.position.set(x, 2.5 + Math.sin(t * 2 + ph) * .1, z); gem.rotation.y = t * 1.2; });
  pointLight(zone, color, .6, 5, x, 1.6, z);
  PORTALS.push({ x, z, to, label, zone, ...o });
}
// instanced crossed-quad scatter (grass tufts, flowers)
function scatter(texture, count, size, pick) {
  const geo = new THREE.PlaneGeometry(size, size * .8); geo.translate(0, size * .4, 0);
  const g2 = geo.clone(); g2.rotateY(Math.PI / 2);
  const merged = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = geo.attributes[k], b = g2.attributes[k], arr = new Float32Array(a.array.length * 2); arr.set(a.array); arr.set(b.array, a.array.length);
    merged.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  const ia = geo.index.array, idx = [...ia, ...Array.from(ia, i => i + 4)]; merged.setIndex(idx);
  const m = new THREE.MeshStandardMaterial({ map: texture, alphaTest: .5, side: THREE.DoubleSide, roughness: 1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = timeU;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 ip = instanceMatrix[3].xz;
      float sway = (sin(uT * 1.7 + ip.x * .45 + ip.y * .3) + .5 * sin(uT * 3.1 + ip.x)) * .055 * position.y / ${(size * .8).toFixed(2)};
      transformed.x += sway; transformed.z += sway * .5;`);
  };
  const im = new THREE.InstancedMesh(merged, m, count), d = new THREE.Object3D();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 20; tries++) {
    const p = pick(); if (!p) continue;
    d.position.set(p[0], p[2] || 0, p[1]); d.rotation.y = rnd() * 3; d.scale.setScalar(rr(.7, 1.3)); d.updateMatrix(); im.setMatrixAt(n++, d.matrix);
  }
  im.count = n; im.receiveShadow = true; scene.add(im);
}
