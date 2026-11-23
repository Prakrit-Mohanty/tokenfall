// TokenFall: renderer, scene, fog, camera views and the seeded random numbers everything else uses.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= setup =================
// round things look round, to match the smooth 3D characters: anything built with 6+ sides gets at least `min` (fewer is a deliberate shape: a pyramid roof, a prism)
const smoother = (C, at) => class extends C { constructor(...a) { for (const [i, m] of at) if (a[i] === undefined || (a[i] >= 6 && a[i] < m)) a[i] = m; super(...a); } };
THREE.CylinderGeometry = smoother(THREE.CylinderGeometry, [[3, 28]]);
THREE.ConeGeometry = smoother(THREE.ConeGeometry, [[2, 28]]);
THREE.SphereGeometry = smoother(THREE.SphereGeometry, [[1, 28], [2, 18]]);
THREE.TorusGeometry = smoother(THREE.TorusGeometry, [[2, 14], [3, 40]]);
const canvas = document.getElementById('c');
// ================= quality tier =================
// 2 high (desktop, today's look), 1 mid (fewer blur taps), 0 low (phones and weak machines: 1024 shadows, light bloom, fewer lamps, no tiny shadow casters).
// Picked once here from the device, the GPU's texture limit, the core count and a ~5 ms CPU benchmark; loop.js steps it down if frames stay slow. ?q=0|1|2 forces it.
const MOBILE = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));   // iPadOS reports a Mac
const glAttrs = { alpha: false, depth: true, stencil: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };   // three's defaults
const gl = canvas.getContext('webgl2', glAttrs) || canvas.getContext('webgl', glAttrs);
const GPU_MAX_TEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
if (MOBILE) { const gp = gl.getParameter.bind(gl); gl.getParameter = p => p === gl.MAX_TEXTURE_SIZE ? Math.min(2048, GPU_MAX_TEX) : gp(p); }   // three then halves the 4096 atlases on upload: ~4x less texture memory on phones
const BENCH_MS = (() => { const t = performance.now(); let s = 0; for (let i = 0; i < 2e6; i++) s += Math.sqrt(i) * Math.sin(i); return performance.now() - t + s * 0; })();   // s * 0 keeps the loop from being optimised away
const QUALITY = [
  { name: 'low', shadow: 1024, dofTaps: 12, aoTaps: 5, bloomWide: false, lamps: 4, smallCast: .35 },
  { name: 'mid', shadow: 2048, dofTaps: 24, aoTaps: 8, bloomWide: true, lamps: 99, smallCast: 0 },
  { name: 'high', shadow: 2048, dofTaps: 36, aoTaps: 10, bloomWide: true, lamps: 99, smallCast: 0 },
];
const cores = navigator.hardwareConcurrency || 4;
let tier = MOBILE ? (cores >= 8 && GPU_MAX_TEX >= 8192 && BENCH_MS < 25 ? 1 : 0) : (cores >= 4 && GPU_MAX_TEX >= 8192 && BENCH_MS < 30 ? 2 : 1);
{ const f = new URLSearchParams(location.search).get('q'); if (f !== null && QUALITY[+f]) tier = +f; }
let Q = QUALITY[tier];
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, powerPreference: 'high-performance' });
renderer.info.autoReset = false;   // the post passes render many times a frame: loop.js resets once per frame so the counts cover the whole frame
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCF honours shadow.radius (PCFSoft ignores it): soft-edged shadows like the characters' render
const PR = Math.min(window.devicePixelRatio || 1, 1.5);
// drops render resolution if the machine can't keep up, and on a high-dpi desktop at the high tier raises it toward a pixel ratio of 2 (RES_MAX) while frames stay fast
let RES_MAX = tier === 2 ? Math.min(window.devicePixelRatio || 1, 2) / PR : 1;
let resScale = 1, ftAcc = 0, ftN = 0;

const scene = new THREE.Scene();
const FOG = 0xdde5ea;   // neutral cool haze until Daylight applies the mood
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 34, 95);
// two camera views, V switches: a low over-the-shoulder third person (default) and the original high overview
const CAM_VIEWS = [{ off: new THREE.Vector3(0, 3.6, 7), fov: 48, y: 1.35 }, { off: new THREE.Vector3(0, 10.5, 24.5), fov: 26, y: .87 }];   // y: the look-at height, about four fifths up the hero (head at CHAR_TOP in characters.js ~1.65 m; it was 1.4 / .9 for a 1.7 m one)
let camView = 0;
const camera = new THREE.PerspectiveCamera(CAM_VIEWS[0].fov, 16 / 9, .5, 220);
const CAM_OFF = CAM_VIEWS[0].off.clone();

// ================= motion (anime.js v4) =================
// anime's own requestAnimationFrame loop is off: frame() in loop.js calls anime.engine.update(), so every tween advances on the same frame as the render.
anime.engine.useDefaultMainLoop = false;
const REDUCED_MOTION = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // near-zero durations for people who ask for less motion
const liveTweens = new WeakMap();
// tween(target, { prop: end }, ms, { ease, onUpdate, onComplete }): one tween per target, so starting a new one cancels the one in flight (rapid input never stacks)
function tween(target, props, ms, o = {}) {
  const prev = liveTweens.get(target); if (prev) prev.cancel();
  const a = anime.animate(target, Object.assign({ ease: 'inOut(2)' }, props, o, { duration: REDUCED_MOTION ? 1 : Math.max(1, ms) }));
  liveTweens.set(target, a); return a;
}

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);
