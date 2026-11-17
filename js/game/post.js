// TokenFall: post-processing: tilt-shift depth of field, bloom, colour grade.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= post-processing: tilt-shift depth of field + bloom =================
const DOF_DEFAULT = { farStart: 3, farRange: 14, edgeBlur: .45 };
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
function fsPass(fragmentShader, uniforms) {
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat));
  return { u: uniforms, run(target) { renderer.setRenderTarget(target); renderer.render(s, fsCam); } };
}
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtScene = new THREE.WebGLRenderTarget(4, 4, rtOpts);
rtScene.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);   // 16-bit depth z-fights the floor at a distance
const rtA = new THREE.WebGLRenderTarget(4, 4, rtOpts), rtB = new THREE.WebGLRenderTarget(4, 4, rtOpts);
const bright = fsPass(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
  void main(){ vec3 c=vec3(0.); for(int i=0;i<4;i++){ vec2 o=vec2(float(i-(i/2)*2)-.5,float(i/2)-.5)*px*1.5; c+=texture2D(t,vUv+o).rgb; } c*=.25;
    float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(1.35,2.7,l),1.); }`, { t: { value: rtScene.texture }, px: { value: new THREE.Vector2() } });
const blur = fsPass(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec3 c=texture2D(t,vUv).rgb*.227; c+=(texture2D(t,vUv+dir*1.38).rgb+texture2D(t,vUv-dir*1.38).rgb)*.316; c+=(texture2D(t,vUv+dir*3.23).rgb+texture2D(t,vUv-dir*3.23).rgb)*.07; gl_FragColor=vec4(c,1.); }`,
  { t: { value: null }, dir: { value: new THREE.Vector2() } });
const final = fsPass(`uniform sampler2D tColor, tDepth, tBloom; uniform vec2 res; uniform float focus, nearP, farP, maxR, time, exposure, aoAmt, farStart, farRange, edgeBlur, sat, vig, bloomAmt, sketch, lineAmt; uniform vec3 gradeMul, shadowTint, hiTint, lift;
  varying vec2 vUv;
  float lin(float d){ float z=d*2.-1.; return 2.*nearP*farP/(farP+nearP-z*(farP-nearP)); }
  float coc(float z, vec2 uv){ float d=z-focus; float c=clamp((abs(d)-(d<0.?1.5:farStart))/(d<0.?5.:farRange),0.,1.); c=max(c,(smoothstep(.2,0.,uv.y)*.8+smoothstep(.82,1.,uv.y)*.6)*edgeBlur); return min(c,1.)*maxR; }
  void main(){
    float kk=max(res.y/720.,1.);
    vec2 uvW=vUv;   // the picture itself holds perfectly still: no wobble, no boil
    float zc=lin(texture2D(tDepth,uvW).x), cc=coc(zc,uvW);
    // thin ink outlines where the depth jumps (silhouettes): a touch heavier up close, fading with distance and out-of-focus blur
    vec2 lpx=vec2((.7+.4*clamp(14./zc,0.,1.))*kk)/res; vec2 ue=uvW;
    float zl=lin(texture2D(tDepth,ue-vec2(lpx.x,0.)).x), zr=lin(texture2D(tDepth,ue+vec2(lpx.x,0.)).x), zu=lin(texture2D(tDepth,ue+vec2(0.,lpx.y)).x), zd=lin(texture2D(tDepth,ue-vec2(0.,lpx.y)).x);
    float edge=smoothstep(.035,.1,(abs(zl+zr-2.*zc)+abs(zu+zd-2.*zc))/max(zc,1.))*(1.-smoothstep(45.,115.,zc))*(1.-clamp(cc/maxR,0.,1.)*.85);
    vec3 acc=texture2D(tColor,uvW).rgb; float ws=1.;
    for(int i=1;i<36;i++){
      float r=sqrt(float(i)/36.), a=float(i)*2.39996;
      vec2 uv=uvW+vec2(cos(a),sin(a))*r*maxR/res;
      float zs=lin(texture2D(tDepth,uv).x), cs=coc(zs,uv);
      float ce=zs<zc?cs:min(cs,cc);
      float w=clamp(ce-r*maxR+1.,0.,1.);
      acc+=texture2D(tColor,uv).rgb*w; ws+=w;
    }
    // ambient occlusion from depth: darken creases and the ground right next to things standing on it
    float ao=0., rad=clamp(30./zc,1.5,9.);
    for(int i=0;i<10;i++){
      float a=float(i)*2.39996+fract(sin(dot(gl_FragCoord.xy,vec2(12.9,78.2)))*43758.5)*6.28, r=rad*(.35+.65*float(i)/10.);
      float d=zc-lin(texture2D(tDepth,uvW+vec2(cos(a),sin(a))*r*res.y/720./res).x);
      ao+=smoothstep(.04,.5,d)*(1.-smoothstep(.9,2.4,d));
    }
    ao=ao/10.*(1.-smoothstep(60.,120.,zc));
    vec3 c=acc/ws*(1.-ao*aoAmt) + texture2D(tBloom,uvW).rgb*bloomAmt*vec3(1.,.9,.74);
    // exposure, soft highlight roll-off, then a gentle S-curve for contrast and a little extra colour
    c*=exposure; c=c/(1.+max(c-.68,0.)*1.1); c=clamp(c,0.,1.);
    c=mix(c,c*c*(3.-2.*c),.3);
    c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,sat)*gradeMul;
    float L=dot(c,vec3(.299,.587,.114));
    c=mix(c,c*shadowTint+vec3(.012,.006,.004),(1.-smoothstep(0.,.45,L))*.5);   // warm, plummy shadows instead of cold blue ones
    c=mix(c,c*hiTint,smoothstep(.45,1.,L)*.45);          // warm highlights
    // a light cel shading, kept gentle so the lighting still reads as natural, then the thin ink line
    float Lc=dot(c,vec3(.299,.587,.114)), Lq=(floor(Lc*4.)+smoothstep(.3,.7,fract(Lc*4.)))/4.;
    c*=mix(1.,clamp(Lq/max(Lc,.03),.7,1.3),.07*sketch);   // only a whisper of banding: the characters are smooth-shaded, so the world is too
    c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.+.03*sketch);
    c=mix(c,vec3(.2,.13,.17),clamp(edge*lineAmt*sketch,0.,.8));
    vec2 v=vUv-.5; c*=1.-dot(v,v)*vig;
    c=lift+c*(1.-dot(lift,vec3(.3333)));
    c+= (fract(sin(dot(gl_FragCoord.xy,vec2(12.98,78.23)))*43758.5)-.5)*.004;   // a trace of fixed dither against banding
    gl_FragColor=vec4(c,1.);
  }`, {
  tColor: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture }, tBloom: { value: rtA.texture }, sketch: { value: .7 }, lineAmt: { value: .75 }, lift: { value: new THREE.Vector3(.04, .036, .05) },
  res: { value: new THREE.Vector2() }, focus: { value: 19 }, nearP: { value: camera.near }, farP: { value: camera.far }, maxR: { value: 8 }, time: { value: 0 }, exposure: { value: .86 }, aoAmt: { value: .8 }, sat: { value: 1.04 }, vig: { value: 1.05 }, bloomAmt: { value: .5 }, gradeMul: { value: new THREE.Vector3(1.04, 1, .93) }, shadowTint: { value: new THREE.Vector3(1.02, .88, .82) }, hiTint: { value: new THREE.Vector3(1.06, 1, .88) }, farStart: { value: 3 }, farRange: { value: 14 }, edgeBlur: { value: 1 },
});
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(PR * resScale); renderer.setSize(w, h, false);
  const W = Math.round(w * PR * resScale), H = Math.round(h * PR * resScale);
  rtScene.setSize(W, H); rtA.setSize(W >> 2, H >> 2); rtB.setSize(W >> 2, H >> 2);
  final.u.res.value.set(W, H); final.u.maxR.value = Math.max(4, H / 135);
  bright.u.px.value.set(1 / W, 1 / H);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
function render() {
  sky.position.copy(camera.position);
  skyU.horizon.value.copy(scene.fog.color); skyU.sunDir.value.copy(SUN_DIR).normalize();
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  bright.run(rtA);
  for (let i = 0; i < 2; i++) {
    blur.u.t.value = rtA.texture; blur.u.dir.value.set(1 / rtA.width, 0); blur.run(rtB);
    blur.u.t.value = rtB.texture; blur.u.dir.value.set(0, 1 / rtA.height); blur.run(rtA);
  }
  final.run(null);
}
