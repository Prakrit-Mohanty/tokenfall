// TokenFall: post-processing: tilt-shift depth of field, bloom, colour grade.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= post-processing: tilt-shift depth of field + bloom =================
const DOF_DEFAULT = { farStart: 8, farRange: 24, edgeBlur: .35 };   // lobby and Pune set their own (lobby-village.js, pune.js)
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
function fsPass(fragmentShader, uniforms) {
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat));
  return { u: uniforms, mat, run(target) { renderer.setRenderTarget(target); renderer.render(s, fsCam); } };
}
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtScene = new THREE.WebGLRenderTarget(4, 4, rtOpts);
rtScene.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);   // 16-bit depth z-fights the floor at a distance
const rtA = new THREE.WebGLRenderTarget(4, 4, rtOpts), rtB = new THREE.WebGLRenderTarget(4, 4, rtOpts);   // bloom at 1/4 resolution: the tight core
const rtC = new THREE.WebGLRenderTarget(4, 4, rtOpts), rtD = new THREE.WebGLRenderTarget(4, 4, rtOpts);   // and at 1/8: the soft, wide halo
// only what is truly bright glows (lamps, lit windows, emissive signs): knee is the luminance range the glow fades in over, in scene values;
// Daylight sets it from the mood's exposure, so a sunlit wall never blooms by day and the brightness slider never changes what glows
const bright = fsPass(`uniform sampler2D t; uniform vec2 px, knee; varying vec2 vUv;
  void main(){ vec3 c=vec3(0.); for(int i=0;i<4;i++){ vec2 o=vec2(float(i-(i/2)*2)-.5,float(i/2)-.5)*px*1.5; c+=texture2D(t,vUv+o).rgb; } c*=.25;
    float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(knee.x,knee.y,l),1.); }`, { t: { value: rtScene.texture }, px: { value: new THREE.Vector2() }, knee: { value: new THREE.Vector2(1.35, 2.7) } });
const blur = fsPass(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec3 c=texture2D(t,vUv).rgb*.227; c+=(texture2D(t,vUv+dir*1.38).rgb+texture2D(t,vUv-dir*1.38).rgb)*.316; c+=(texture2D(t,vUv+dir*3.23).rgb+texture2D(t,vUv-dir*3.23).rgb)*.07; gl_FragColor=vec4(c,1.); }`,
  { t: { value: null }, dir: { value: new THREE.Vector2() } });
const rtFinal = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
// FXAA (the compact Lottes form) as the last pass: smooths jagged edges along the luma gradient, and leaves flat, low-contrast areas untouched so nothing goes soft
const fxaa = fsPass(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
  float lum(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
  void main(){
    vec3 m=texture2D(t,vUv).rgb, nw=texture2D(t,vUv+vec2(-1.,-1.)*px).rgb, ne=texture2D(t,vUv+vec2(1.,-1.)*px).rgb, sw=texture2D(t,vUv+vec2(-1.,1.)*px).rgb, se=texture2D(t,vUv+vec2(1.,1.)*px).rgb;
    float lm=lum(m), lnw=lum(nw), lne=lum(ne), lsw=lum(sw), lse=lum(se);
    float lo=min(lm,min(min(lnw,lne),min(lsw,lse))), hi=max(lm,max(max(lnw,lne),max(lsw,lse)));
    if(hi-lo<max(.03,hi*.12)){ gl_FragColor=vec4(m,1.); return; }
    vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
    float red=max((lnw+lne+lsw+lse)*.03125,.0078125), rcp=1./(min(abs(dir.x),abs(dir.y))+red);
    dir=clamp(dir*rcp,vec2(-8.),vec2(8.))*px;
    vec3 a=.5*(texture2D(t,vUv+dir*(1./3.-.5)).rgb+texture2D(t,vUv+dir*(2./3.-.5)).rgb);
    vec3 b=a*.5+.25*(texture2D(t,vUv-dir*.5).rgb+texture2D(t,vUv+dir*.5).rgb);
    float lb=lum(b); gl_FragColor=vec4((lb<lo||lb>hi)?a:b,1.);
  }`, { t: { value: rtFinal.texture }, px: { value: new THREE.Vector2() } });
const final = fsPass(`uniform sampler2D tColor, tDepth, tBloom, tBloomW; uniform vec2 res; uniform float focus, nearP, farP, maxR, time, exposure, aoAmt, farStart, farRange, edgeBlur, sat, vig, bloomAmt, sketch, lineAmt, curveAmt, cloudAmt; uniform vec3 gradeMul, shadowTint, hiTint, lift, inkCol, aoTint; uniform vec2 cloudOff; uniform mat4 invProj, camWorld;
  varying vec2 vUv;
  float lin(float d){ float z=d*2.-1.; return 2.*nearP*farP/(farP+nearP-z*(farP-nearP)); }
  float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y); }
  float coc(float z, vec2 uv){ float d=z-focus; float c=clamp((abs(d)-(d<0.?3.:farStart))/(d<0.?6.:farRange),0.,1.); c=max(c,(smoothstep(.2,0.,uv.y)*.8+smoothstep(.82,1.,uv.y)*.6)*edgeBlur); return min(c,1.)*maxR; }
  void main(){
    float kk=max(res.y/720.,1.);
    vec2 uvW=vUv;   // the picture itself holds perfectly still: no wobble, no boil
    float zc=lin(texture2D(tDepth,uvW).x), cc=coc(zc,uvW);
    // thin ink outlines where the depth jumps (silhouettes): a touch heavier up close, fading with distance and out-of-focus blur
    vec2 lpx=vec2((.7+.4*clamp(14./zc,0.,1.))*kk)/res; vec2 ue=uvW;
    float zl=lin(texture2D(tDepth,ue-vec2(lpx.x,0.)).x), zr=lin(texture2D(tDepth,ue+vec2(lpx.x,0.)).x), zu=lin(texture2D(tDepth,ue+vec2(0.,lpx.y)).x), zd=lin(texture2D(tDepth,ue-vec2(0.,lpx.y)).x);
    float edge=smoothstep(.035,.1,(abs(zl+zr-2.*zc)+abs(zu+zd-2.*zc))/max(zc,1.))*(1.-smoothstep(16.,48.,zc))*(1.-clamp(cc/maxR,0.,1.)*.85);   // the ink fades out with distance: far, sub-pixel lines only shimmer
    vec3 acc=texture2D(tColor,uvW).rgb; float ws=1.;
    for(int i=1;i<DOF_TAPS;i++){
      float r=sqrt(float(i)/float(DOF_TAPS)), a=float(i)*2.39996;
      vec2 uv=uvW+vec2(cos(a),sin(a))*r*maxR/res;
      float zs=lin(texture2D(tDepth,uv).x), cs=coc(zs,uv);
      float ce=zs<zc?cs:min(cs,cc);
      float w=clamp(ce-r*maxR+1.,0.,1.);
      acc+=texture2D(tColor,uv).rgb*w; ws+=w;
    }
    // ambient occlusion from depth: darken creases and the ground right next to things standing on it
    float ao=0., rad=clamp(30./zc,1.5,9.);
    for(int i=0;i<AO_TAPS;i++){
      float a=float(i)*2.39996+fract(sin(dot(gl_FragCoord.xy,vec2(12.9,78.2)))*43758.5)*6.28, r=rad*(.35+.65*float(i)/float(AO_TAPS));
      float d=zc-lin(texture2D(tDepth,uvW+vec2(cos(a),sin(a))*r*res.y/720./res).x);
      ao+=smoothstep(.04,.5,d)*(1.-smoothstep(.9,2.4,d));
    }
    ao=ao/float(AO_TAPS)*(1.-smoothstep(60.,120.,zc));
    // contact shadows darken toward the palette's deep plum, not black (palette.js: nothing in the world is darker than its deep tones)
    vec3 c=acc/ws*mix(vec3(1.),aoTint,clamp(ao*aoAmt,0.,1.)) + (texture2D(tBloom,uvW).rgb*.35+texture2D(tBloomW,uvW).rgb*.65)*bloomAmt;   // mostly the wide halo: a soft glow, not a hot tight one
    // drifting cloud shadows (cloudAmt, from the mood): the world position under the pixel (from its depth) samples a slow, soft noise; under a cloud the light dims a
    // little, least in the blue so the shade reads cool. Not on the sky; fading out with distance. cloudOff is slid along by ambient.js.
    float dRaw=texture2D(tDepth,uvW).x;
    if(cloudAmt>0. && dRaw<.9999){
      vec4 vp=invProj*vec4(uvW*2.-1.,1.,1.); vec3 rd=vp.xyz/vp.w; vec3 wp=(camWorld*vec4(rd*(zc/-rd.z),1.)).xyz;
      vec2 q=wp.xz*.035+cloudOff; float n=vn(q)*.6+vn(q*2.3+5.2)*.4;
      c*=1.-cloudAmt*smoothstep(.48,.72,n)*(1.-smoothstep(70.,140.,zc))*vec3(1.,.97,.86);
    }
    // filmic tone mapping: exposure, then the ACES fit (Narkowicz), which rolls highlights smoothly into white so no brightness setting clips
    // abruptly; the .7 pre-scale keeps mid-greys where the old curve had them. Then a mild contrast curve.
    c*=exposure*.7; c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
    c=mix(c,c*c*(3.-2.*c),curveAmt);   // the contrast curve, its strength from the mood
    c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,sat)*gradeMul;
    float L=dot(c,vec3(.299,.587,.114));
    c=mix(c,c*shadowTint,(1.-smoothstep(0.,.45,L))*.5);   // shadow tint: any warmth or coolness comes from the mood's preset
    c=mix(c,c*hiTint,smoothstep(.45,1.,L)*.45);          // highlight tint, from the mood's preset
    // no cel banding: the characters are smooth-shaded, so the world is too. Then the thin ink line, in the palette's deep plum
    c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.+.03*sketch);
    c=mix(c,inkCol,clamp(edge*lineAmt*sketch,0.,.8));
    vec2 v=vUv-.5; c*=1.-dot(v,v)*vig;
    c=lift+c*(1.-dot(lift,vec3(.3333)));
    c+= (fract(sin(dot(gl_FragCoord.xy,vec2(12.98,78.23)))*43758.5)-.5)*.004;   // a trace of fixed dither against banding
    gl_FragColor=vec4(c,1.);
  }`, {
  tColor: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture }, tBloom: { value: rtA.texture }, tBloomW: { value: rtD.texture }, bloomKnee: bright.u.knee,
  // ink and contact shadows take the palette's deep plum: the ink a shade deeper so outlines still read against the plum signs; aoTint is what a fully occluded crease is multiplied by
  curveAmt: { value: .15 }, cloudAmt: { value: 0 }, cloudOff: { value: new THREE.Vector2() }, invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
  inkCol: { value: new THREE.Color(PAL.plum).multiplyScalar(.85) }, aoTint: { value: new THREE.Color(PAL.plum).multiplyScalar(1.6) }, sketch: { value: .7 }, lineAmt: { value: .75 }, lift: { value: new THREE.Vector3(.01, .01, .01) },
  res: { value: new THREE.Vector2() }, focus: { value: 19 }, nearP: { value: camera.near }, farP: { value: camera.far }, maxR: { value: 8 }, time: { value: 0 }, exposure: { value: .86 }, aoAmt: { value: .6 }, sat: { value: 1.04 }, vig: { value: 1.05 }, bloomAmt: { value: .5 }, gradeMul: { value: new THREE.Vector3(1, 1, 1) }, shadowTint: { value: new THREE.Vector3(1, 1, 1) }, hiTint: { value: new THREE.Vector3(1, 1, 1) }, farStart: { value: 3 }, farRange: { value: 14 }, edgeBlur: { value: 1 },
});
// the depth-of-field and contact-shadow sample counts follow the quality tier (setup.js); loop.js calls this again when the tier steps down
function applyPostQuality() {
  final.mat.defines = { DOF_TAPS: Q.dofTaps, AO_TAPS: Q.aoTaps }; final.mat.needsUpdate = true;
  final.u.tBloomW.value = Q.bloomWide ? rtD.texture : rtA.texture;   // low tier: no 1/8 halo level, the 1/4 glow stands in for it
}
applyPostQuality();
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(PR * resScale); renderer.setSize(w, h, false);
  const W = Math.round(w * PR * resScale), H = Math.round(h * PR * resScale);
  rtScene.setSize(W, H); rtFinal.setSize(W, H); fxaa.u.px.value.set(1 / W, 1 / H); rtA.setSize(W >> 2, H >> 2); rtB.setSize(W >> 2, H >> 2); rtC.setSize(W >> 3, H >> 3); rtD.setSize(W >> 3, H >> 3);
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
  // the wide level: the blurred 1/4 bloom, downsampled to 1/8 and blurred twice more there
  if (Q.bloomWide) for (let i = 0, src = rtA; i < 2; i++, src = rtD) {
    blur.u.t.value = src.texture; blur.u.dir.value.set(1 / rtC.width, 0); blur.run(rtC);
    blur.u.t.value = rtC.texture; blur.u.dir.value.set(0, 1 / rtC.height); blur.run(rtD);
  }
  final.u.invProj.value.copy(camera.projectionMatrixInverse); final.u.camWorld.value.copy(camera.matrixWorld);   // for the cloud shadows' world position
  final.run(rtFinal); fxaa.run(null);
}
