// TokenFall: ambient motion. The lobby's signs stir in the breeze: a slow sway of a fraction of a degree, each on its own phase, so the world never sits dead still.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html (after effects.js and setup.js, before main.js).
//
// mergeStatic() folds every static mesh into shared buckets at boot, so a sign that moves has to be kept out of it: this wraps mergeStatic to mark the signs
// (signBoard / ledSign in props.js: a box whose face is a lit, textured panel) as moving first. The sway runs on the shared anime engine (stepped in loop.js).
// Only the lobby-wide merge is touched: a minigame room merges and disposes its own pieces, and a loop left on a disposed sign would never end.
const AMBIENT = { swayDeg: .45, period: [3200, 4600] };   // how far a sign tilts each way, and its range of swing times (ms)
const ambientSigns = new Set();
const isSign = (o) => o.isMesh && Array.isArray(o.material) && o.material.length === 6 && o.material.some((m) => m.map && m.map === m.emissiveMap);
function swaySign(o) {
  const a = AMBIENT.swayDeg * Math.PI / 180, z0 = o.rotation.z, [lo, hi] = AMBIENT.period;
  o.rotation.z = z0 - a;
  anime.animate(o.rotation, { z: z0 + a, duration: lo + Math.random() * (hi - lo), delay: Math.random() * 2000, ease: 'inOut(2)', alternate: true, loop: true });
}
const mergeStaticBase = mergeStatic;
mergeStatic = function (root = scene) {
  if (root === scene && !REDUCED_MOTION) root.traverse((o) => { if (isSign(o) && !ambientSigns.has(o)) { o.userData.dyn = true; ambientSigns.add(o); swaySign(o); } });
  return mergeStaticBase(root);
};

// the cloud shadows drift (post.js draws them, Daylight sets how strong): a very slow, steady slide, about a metre a second, on the anime engine that the
// game loop steps. It runs back and forth an hour each way rather than looping, so the clouds never jump. Held still for reduced motion.
if (!REDUCED_MOTION) anime.animate(final.u.cloudOff.value, { x: 150, y: 50, duration: 3600000, ease: 'linear', alternate: true, loop: true });
