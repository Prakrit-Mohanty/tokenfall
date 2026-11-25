// TokenFall: click a player's name in the lobby list (top right) and your character walks over to them, the way you would in a real lobby.
// Hovering a name shows a little card (where they are, how far, "click to walk over"); while walking a gold ring marks who you are heading to.
// Any movement key takes back control. Classic script: shares one global scope with the other js/game files; loop.js calls walkToStep each frame.
let walkTo = null;   // { c: the character, stuck: ms without progress, last: distance a moment ago }
const WALK_NEAR = 1.3;
const walkTip = document.createElement('div'); walkTip.className = 'pl-tip'; walkTip.hidden = true; document.getElementById('ui').append(walkTip);
const walkRing = new THREE.Mesh(new THREE.RingGeometry(.42, .55, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .85, depthWrite: false }));
walkRing.rotation.x = -Math.PI / 2; walkRing.visible = false; walkRing.renderOrder = 5; scene.add(walkRing);

const walkWho = (n) => npcs.find((c) => c.name === n && c.zone === zone);
function walkStart(name) {
  const c = walkWho(name); if (!c) return;
  if (dialog || traveling || playerLocked) return;
  walkTo = { c };
  log('', `Walking over to ${name}…`, true);
}
// walk (running) to a spot rather than a person: the lobby map sends you here (world-map.js). The spot is moved to the nearest free ground first
function walkStartAt(x, z, label) {
  if (dialog || traveling || playerLocked) return false;
  let fx = x, fz = z;
  if (blocked(fx, fz, .45)) {
    let found = false;
    for (let r = .5; r <= 5 && !found; r += .5) for (let a = 0; a < 16 && !found; a++) { const ax = x + Math.cos(a / 16 * Math.PI * 2) * r, az = z + Math.sin(a / 16 * Math.PI * 2) * r; if (!blocked(ax, az, .45)) { fx = ax; fz = az; found = true; } }
    if (!found) return false;
  }
  walkTo = { c: { x: fx, y: fz, zone, name: label, spot: true } };
  log('', `🗺️ Heading to ${label}…`, true);
  return true;
}
function walkStop(arrived) {
  if (!walkTo) return;
  const c = walkTo.c; walkTo = null; walkRing.visible = false;
  if (arrived && c.spot) { log('', `📍 You're at ${c.name}.`, true); return; }
  if (arrived) { hero.dir = Math.abs(c.x - hero.x) > Math.abs(c.y - hero.y) ? (c.x > hero.x ? 'right' : 'left') : (c.y > hero.y ? 'down' : 'up'); c.wait = Math.max(c.wait || 0, 2500); say(c, 'oh hey! 👋'); }
}
// the input the hero walks with this frame: keys win; otherwise head for the target (diagonals allowed), stop within reach, give up when stuck
function walkToStep(keyIn, dt) {
  if (!walkTo) return keyIn;
  if (keyIn.up || keyIn.down || keyIn.left || keyIn.right || walkTo.c.zone !== zone) { walkStop(false); return keyIn; }
  const c = walkTo.c, dx = c.x - hero.x, dz = c.y - hero.y, d = Math.hypot(dx, dz);
  walkRing.visible = true; walkRing.position.set(c.x, .06, c.y); walkRing.scale.setScalar(1 + Math.sin(performance.now() / 160) * .08);
  if (d < (c.spot ? .6 : WALK_NEAR)) { walkStop(true); return keyIn; }
  const now = performance.now();
  // stuck: no real movement for a third of a second. Re-plan from here with more clearance, and step sideways to a free spot first
  if (!walkTo.mark || Math.hypot(hero.x - walkTo.mark[0], hero.y - walkTo.mark[1]) > .12) { walkTo.mark = [hero.x, hero.y, now]; walkTo.tries = Math.max(0, (walkTo.tries || 0) - .02); }
  else if (now - walkTo.mark[2] > 330) {
    walkTo.tries = (walkTo.tries || 0) + 1; walkTo.mark = [hero.x, hero.y, now]; walkTo.path = null;
    if (walkTo.tries > 12) { walkStop(false); log('', `Couldn't find a way to ${c.name}.`, true); return keyIn; }
    const base = Math.atan2(dz, dx), side = walkTo.tries % 2 ? 1 : -1;
    for (const k of [1.57, 2.2, .9, 3.14]) { const a2 = base + k * side, sx = hero.x + Math.cos(a2) * .8, sz = hero.y + Math.sin(a2) * .8; if (!blocked(sx, sz, .4)) { walkTo.side = [sx, sz, now + 450]; break; } }
  }
  if (walkTo.side && now < walkTo.side[2]) { const a2 = Math.atan2(walkTo.side[1] - hero.y, walkTo.side[0] - hero.x); return walkDirs(a2, d, keyIn); }
  // a path round everything on a half-metre grid, found again every second because the person you are walking to moves too; roomy clearance first so corners are not clipped
  if (!walkTo.path || now > walkTo.replan) { walkTo.path = walkPath(hero.x, hero.y, c.x, c.y, .5) || walkPath(hero.x, hero.y, c.x, c.y, .34); walkTo.replan = now + 1000; }
  if (!walkTo.path) { walkStop(false); log('', `Couldn't find a way to ${c.name}.`, true); return keyIn; }
  const P = walkTo.path; while (P.length > 1 && Math.hypot(P[0][0] - hero.x, P[0][1] - hero.y) < .45) P.shift();
  // aim at the furthest waypoint in clear sight (smooth, no zig-zag), checked along the way at the hero's own clearance
  let aim = P[0] || [c.x, c.y];
  for (let i = Math.min(P.length - 1, 8); i > 0; i--) if (walkClear(hero.x, hero.y, P[i][0], P[i][1]) && walkKeepsPath(P, i)) { aim = P[i]; break; }
  return walkDirs(Math.atan2(aim[1] - hero.y, aim[0] - hero.x), c.spot ? 99 : d, keyIn);   // to a map spot: always at a run
}
const walkClear = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .25); for (let i = 1; i <= n; i++) if (blocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, .42)) return false; return true; };
// in the lobby, a shortcut to waypoint i may only cross grass if the route there crosses grass too (so corners of the paths are not cut over the lawn)
function walkKeepsPath(P, i) {
  if (!walkPavedHere()) return true;
  for (let k = 0; k <= i; k++) if (!walkOnPath(P[k][0], P[k][1])) return true;
  const x0 = hero.x, z0 = hero.y, x1 = P[i][0], z1 = P[i][1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .3);
  for (let k = 1; k < n; k++) if (!vPaved(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, -.1)) return false;
  return true;
}
// the keys a direction comes to: eight ways, the way the keyboard walks
function walkDirs(ang, d, keyIn) { const ux = Math.cos(ang), uz = Math.sin(ang); return { up: uz < -.38, down: uz > .38, left: ux < -.38, right: ux > .38, run: d > 6 || keyIn.run };
}
// how much a step costs: in the lobby the footpaths, roads and plaza are cheap and the lawn is dear, so a long walk follows the paving
// the way a person would and only steps onto the grass for the last bit (or where there is no paving, like the bridge)
const walkPavedHere = () => zone === 'lobby' && typeof vPaved === 'function';
const walkOnPath = (x, z) => vPaved(x, z, -.35);
// cheapest path over a grid round the two points (8 neighbours, no corner cutting; Dijkstra with a binary heap); returns waypoints in world x/z, or null
function walkPath(x0, z0, x1, z1, pad = .4) {
  const S = .5, M = 10, gx0 = Math.min(x0, x1) - M, gz0 = Math.min(z0, z1) - M, W = Math.ceil((Math.abs(x1 - x0) + 2 * M) / S), H = Math.ceil((Math.abs(z1 - z0) + 2 * M) / S);
  if (W * H > 60000) return [[x1, z1]];
  const cell = (x, z) => [Math.round((x - gx0) / S), Math.round((z - gz0) / S)], [si, sj] = cell(x0, z0), X = (i) => gx0 + i * S, Z = (j) => gz0 + j * S;
  const paved = walkPavedHere(), GRASS = 6;
  const ok = new Int8Array(W * H).fill(-1), free = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return false; const k = j * W + i; if (ok[k] < 0) ok[k] = blocked(X(i), Z(j), pad, false) ? 0 : 1; return ok[k] === 1; };
  const wcost = new Float32Array(W * H).fill(-1), costAt = (k) => { if (wcost[k] < 0) wcost[k] = paved && !walkOnPath(X(k % W), Z((k - k % W) / W)) ? GRASS : 1; return wcost[k]; };
  const [ei, ej] = cell(x1, z1), from = new Int32Array(W * H).fill(-1), dist = new Float32Array(W * H).fill(Infinity), done = new Uint8Array(W * H);
  // a small binary heap of [cost, cell]
  const hk = [], hv = []; const push = (c, k) => { let i = hk.length; hk.push(c); hv.push(k); while (i) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
  const pop = () => { const k = hv[0], lc = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lc; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hk[l] < hk[m]) m = l; if (r < hk.length && hk[r] < hk[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return k; };
  const s0 = sj * W + si; from[s0] = s0; dist[s0] = 0; push(0, s0);
  let best = s0, bestD = 1e9;
  while (hk.length) {
    const k = pop(); if (done[k]) continue; done[k] = 1;
    const i = k % W, j = (k - i) / W, dd = Math.hypot(i - ei, j - ej);
    if (dd < bestD) { bestD = dd; best = k; } if (dd < 2) break;   // within a metre of the target is close enough
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj, nk = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || done[nk] || !free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
      const nd = dist[k] + (di && dj ? 1.414 : 1) * costAt(nk);
      if (nd < dist[nk]) { dist[nk] = nd; from[nk] = k; push(nd, nk); }
    }
  }
  if (bestD > 4) return null;
  const out = []; for (let k = best; k !== from[k]; k = from[k]) out.push([X(k % W), Z((k - k % W) / W)]);
  return out.reverse();
}
// the list: click (or Enter) to walk, hover for the card
const plist = document.getElementById('plist');
plist.addEventListener('click', (e) => { const el = e.target.closest('.pl-go'); if (el) { walkStart(el.dataset.who); el.blur(); } });
plist.addEventListener('keydown', (e) => { const el = e.target.closest('.pl-go'); if (el && e.code === 'Enter') { e.stopPropagation(); walkStart(el.dataset.who); el.blur(); } });
plist.addEventListener('mouseover', (e) => {
  const el = e.target.closest('.pl-go'); if (!el) return;
  const c = walkWho(el.dataset.who), r = el.getBoundingClientRect(), a = AREAS[zone];
  walkTipWho = el.dataset.who;
  walkTip.innerHTML = `<b>${esc(el.dataset.who)}</b><span>● online · ${esc(a ? a.name : 'Lobby')}</span><span class="pl-d">${walkTipDist(c)}</span><em>Click to walk over</em>`;
  walkTip.style.top = `${r.top}px`; walkTip.style.left = `${r.left - 12}px`; walkTip.hidden = false;
});
plist.addEventListener('mouseleave', () => { walkTip.hidden = true; walkTipWho = null; });
// the distance line counts down live while the card is open (as you walk over, or they wander off)
let walkTipWho = null;
function walkTipDist(c) { if (!c) return 'not nearby'; const d = Math.round(Math.hypot(c.x - hero.x, c.y - hero.y)); return `${d} m away${c.moving ? ' · walking' : ''}`; }
setInterval(() => {
  if (walkTip.hidden || !walkTipWho) return;
  const sp = walkTip.querySelector('.pl-d'), t = walkTipDist(walkWho(walkTipWho));
  if (sp && sp.textContent !== t) sp.textContent = t;
}, 150);
// the place name (top left) opens the lobby map from anywhere in the lobby, so you can click to go without walking to the map board
const locPanel = document.getElementById('loc');
locPanel.title = 'Open the lobby map';
locPanel.addEventListener('click', () => { if (zone === 'lobby' && !dialog && !traveling && !playerLocked) WorldMap.open(); });
