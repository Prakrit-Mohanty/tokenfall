// TokenFall: renderer, scene, fog, camera views and the seeded random numbers everything else uses.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= setup =================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const PR = Math.min(window.devicePixelRatio || 1, 1.5);
let resScale = 1, ftAcc = 0, ftN = 0;   // drops render resolution if the machine can't keep up

const scene = new THREE.Scene();
const FOG = 0xcdbf9f;
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 34, 95);
// two camera views, V switches: a low over-the-shoulder third person (default) and the original high overview
const CAM_VIEWS = [{ off: new THREE.Vector3(0, 3.6, 7), fov: 48, y: 1.4 }, { off: new THREE.Vector3(0, 10.5, 24.5), fov: 26, y: .9 }];
let camView = 0;
const camera = new THREE.PerspectiveCamera(CAM_VIEWS[0].fov, 16 / 9, .5, 220);
const CAM_OFF = CAM_VIEWS[0].off.clone();

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);
