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
    walkTo.tries = (walkTo.tries || 0) + 1; walkTo.mark = [hero.x, hero.y, now]; walkTo.runs = null;
    if (walkTo.tries > 12) { walkStop(false); log('', `Couldn't find a way to ${c.name}.`, true); return keyIn; }
    const base = Math.atan2(dz, dx), side = walkTo.tries % 2 ? 1 : -1;
    for (const k of [1.57, 2.2, .9, 3.14]) { const a2 = base + k * side, sx = hero.x + Math.cos(a2) * .8, sz = hero.y + Math.sin(a2) * .8; if (!blocked(sx, sz, .4)) { walkTo.side = [sx, sz, now + 450]; break; } }
  }
  if (walkTo.side && now < walkTo.side[2]) { walkTo.runs = null; walkTo.oct = walkHold(walkTo.oct, Math.atan2(walkTo.side[1] - hero.y, walkTo.side[0] - hero.x)); return walkOctKeys(walkTo.oct, d, keyIn); }
  const run = c.spot ? 99 : d;   // to a map spot: always at a run
  // the last stretch to someone (who may be wandering): straight at them, holding one heading until it is clearly wrong
  if (!c.spot && d < 2.4) { walkTo.oct = walkHold(walkTo.oct, Math.atan2(dz, dx)); walkTo.runs = null; return walkOctKeys(walkTo.oct, run, keyIn); }
  // otherwise along a planned route, walked as straight runs: one of the eight headings held for a whole stretch, never flicked between frames.
  // Plans again only at the end of a run (or when pushed off it, or the person has wandered far from where it leads)
  const R = walkTo.runs, r = R && R[walkTo.ri];
  if (r) {
    const [ux, uz] = WALK_DIRS[r.dir], ex = hero.x - r.x, ez = hero.y - r.z, along = ex * ux + ez * uz, off = Math.abs(ez * ux - ex * uz);
    if (along > -.08) walkTo.ri++;                       // past this run's end: the next
    else if (off > .7) walkTo.runs = null;               // knocked off the line: plan again
  }
  const moved = !walkTo.goal || Math.hypot(walkTo.goal[0] - c.x, walkTo.goal[1] - c.y) > 1.6;
  if (!walkTo.runs || walkTo.ri >= walkTo.runs.length || (moved && r && walkTo.ri > 0 && walkTo.ri !== walkTo.riPlanned)) {
    const P = walkPath(hero.x, hero.y, c.x, c.y, .5) || walkPath(hero.x, hero.y, c.x, c.y, .34);
    if (!P) { walkStop(false); log('', `Couldn't find a way to ${c.name}.`, true); return keyIn; }
    walkTo.runs = walkRuns(hero.x, hero.y, P); walkTo.ri = 0; walkTo.riPlanned = 0; walkTo.goal = [c.x, c.y];
    if (!walkTo.runs.length) { walkTo.oct = walkHold(walkTo.oct, Math.atan2(dz, dx)); return walkOctKeys(walkTo.oct, run, keyIn); }
  }
  walkTo.oct = walkTo.runs[walkTo.ri].dir;
  return walkOctKeys(walkTo.oct, run, keyIn);
}
// the eight headings the keys can walk, as unit vectors (0 = east, counting round towards +z)
const WALK_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map(([x, z]) => [x / Math.hypot(x, z), z / Math.hypot(x, z)]);
const walkOct = (a) => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
// keep the heading we have unless the way to go is now more than ~35 degrees off it (no flicking across a boundary)
function walkHold(oct, a) {
  if (oct === undefined || oct === null) return walkOct(a);
  const d = Math.abs(((a - oct * Math.PI / 4 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return d > .61 ? walkOct(a) : oct;
}
function walkOctKeys(oct, d, keyIn) { const [ux, uz] = WALK_DIRS[oct]; return { up: uz < -.38, down: uz > .38, left: ux < -.38, right: ux > .38, run: d > 6 || keyIn.run }; }
// The route as straight runs. The grid path is first straightened (points within a hand's breadth of a clear line are dropped, so the
// middle of a path stays the middle), then each straight leg becomes at most two runs the keys can walk: a diagonal and a straight,
// in whichever order stays clear of things. Runs shorter than a stride are folded into the next, so there are no one-step jogs.
function walkRuns(x0, z0, P) {
  const pts = [[x0, z0], ...P.filter((p, i) => i > 0 || Math.hypot(p[0] - x0, p[1] - z0) > .4)], keep = walkSimplify(pts, .45), runs = [];
  let ax = x0, az = z0;
  for (let i = 1; i < keep.length; i++) {
    const [bx, bz] = keep[i], dx = bx - ax, dz = bz - az, adx = Math.abs(dx), adz = Math.abs(dz), sx = Math.sign(dx), sz = Math.sign(dz);
    const diag = Math.min(adx, adz), straight = Math.max(adx, adz) - diag, dOct = walkOct(Math.atan2(sz, sx)), sOct = adx > adz ? walkOct(Math.atan2(0, sx)) : walkOct(Math.atan2(sz, 0));
    const legs = [];
    if (diag < .35 || straight < .35) legs.push([walkOct(Math.atan2(dz, dx)), bx, bz]);   // close enough to one heading: a single run
    else {
      const mid1 = [ax + sx * diag, az + sz * diag], mid2 = adx > adz ? [ax + sx * straight, az] : [ax, az + sz * straight];
      if (walkClear(ax, az, ...mid1) && walkClear(...mid1, bx, bz)) legs.push([dOct, ...mid1], [sOct, bx, bz]);
      else legs.push([sOct, ...mid2], [dOct, bx, bz]);
    }
    for (const [dir, x, z] of legs) {
      const last = runs[runs.length - 1];
      if (last && last.dir === dir) { last.x = x; last.z = z; } else runs.push({ dir, x, z });
    }
    ax = bx; az = bz;
  }
  return runs;
}
// Douglas-Peucker: the fewest points that keep the line within tol of every point it replaces, and every kept stretch clear of things
function walkSimplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], L = Math.hypot(bx - ax, bz - az) || 1e-6;
  let worst = -1, wd = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - ax) * (bz - az) - (pts[i][1] - az) * (bx - ax)) / L; if (d > wd) { wd = d; worst = i; } }
  if (wd <= tol && walkClear(ax, az, bx, bz)) return [pts[0], pts[pts.length - 1]];   // only a straight line that is really clear
  if (worst < 0) worst = pts.length >> 1;
  return [...walkSimplify(pts.slice(0, worst + 1), tol).slice(0, -1), ...walkSimplify(pts.slice(worst), tol)];
}
const walkClear = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .25); for (let i = 1; i <= n; i++) if (blocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, .42)) return false; return true; };
// how much a step costs: in the lobby the footpaths, roads, bridge and plaza are cheap (cheapest down their middle) and the lawn is dear, so a long
// walk follows the paving the way a person would, down the middle of it, and only steps onto the grass for the last bit
const walkPavedHere = () => zone === 'lobby' && typeof vPaved === 'function';
const walkOnArch = (x, z) => typeof ARCH !== 'undefined' && x > ARCH.x0 && x < ARCH.x1 && z > ARCH.zN && z < ARCH.zS;
const walkOnPath = (x, z) => vPaved(x, z, -.35) || walkOnArch(x, z);
// how far from the middle of the road or path this is: 0 on its centre line, 1 at its edge (open paving like the plaza: 0). The route
// pays more the further out it walks, so you keep to the middle the way the main character should
function walkLane(x, z) {
  for (const r of V_ROADS) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return r[3] - r[1] > r[2] - r[0] ? Math.abs(x - (r[0] + r[2]) / 2) / ((r[2] - r[0]) / 2) : Math.abs(z - (r[1] + r[3]) / 2) / ((r[3] - r[1]) / 2);
  for (const [px, pz, w, dd] of V_PATHS) if (Math.abs(x - px) < w / 2 && Math.abs(z - pz) < dd / 2) return w < dd ? Math.abs(x - px) / (w / 2) : Math.abs(z - pz) / (dd / 2);
  if (walkOnArch(x, z)) return Math.abs(x - (ARCH.x0 + ARCH.x1) / 2) / ((ARCH.x1 - ARCH.x0) / 2);
  return 0;
}
// cheapest path over a grid round the two points (8 neighbours, no corner cutting; Dijkstra with a binary heap); returns waypoints in world x/z, or null
function walkPath(x0, z0, x1, z1, pad = .4) {
  const S = .5, M = 10, gx0 = Math.floor((Math.min(x0, x1) - M) / S) * S, gz0 = Math.floor((Math.min(z0, z1) - M) / S) * S, W = Math.ceil((Math.abs(x1 - x0) + 2 * M) / S), H = Math.ceil((Math.abs(z1 - z0) + 2 * M) / S);   // the grid on whole half-metres, so a path's centre line is a grid line
  if (W * H > 60000) return [[x1, z1]];
  const cell = (x, z) => [Math.round((x - gx0) / S), Math.round((z - gz0) / S)], [si, sj] = cell(x0, z0), X = (i) => gx0 + i * S, Z = (j) => gz0 + j * S;
  const paved = walkPavedHere(), GRASS = 6;
  const ok = new Int8Array(W * H).fill(-1), free = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return false; const k = j * W + i; if (ok[k] < 0) ok[k] = blocked(X(i), Z(j), pad, false) ? 0 : 1; return ok[k] === 1; };
  const wcost = new Float32Array(W * H).fill(-1), costAt = (k) => { if (wcost[k] < 0) { const x = X(k % W), z = Z((k - k % W) / W), l = paved ? walkLane(x, z) : 0; wcost[k] = paved && !walkOnPath(x, z) ? GRASS : 1 + 1.4 * l * l; } return wcost[k]; };
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
