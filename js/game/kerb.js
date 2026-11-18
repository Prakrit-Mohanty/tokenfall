// TokenFall: the lobby's kerbs. ONE kerb style along the whole outline of the paving: the same width, height, rounded top edge and stone everywhere, laid flush against the paving's edge on the grass side.
//   - The outline is taken from the paved areas themselves (the union of the plaza, the roads and the paths), so a kerb can only ever follow the paving's exact edge: no gaps, no overlaps, no steps.
//   - Outside corners are round: the kerb's profile is swung round the corner point in short steps. Inside corners (where a path or a road leaves) are mitred, so the two kerbs meet in one clean line.
//   - Where the paving carries on through an opening (a road's far end at a portal or the bridge, a path's door end) the kerb simply stops there, cut square.
// Pure data in, geometry out: node-testable (js/kerb-tests.js). buildKerbs() turns the geometry into a mesh in the lobby. Classic script (also require()-able).

const KB = { W: .3, H: .12, R: .06, ARC: 10, ROUND: 6 };   // width, height, radius of the top edges, steps round an outside corner, steps round a top edge

const kbR6 = (v) => Math.round(v * 1e6) / 1e6;
const kbKey = (p) => kbR6(p[0]) + ',' + kbR6(p[1]);

// the outline of a union of axis-aligned rectangles [x0, z0, x1, z1]: unit edges between a paved cell and an unpaved one, merged into straight segments { a, b, n }
// (a to b runs with the paving on its left, n is the outward normal)
function kbBoundary(rects) {
  const xs = [...new Set(rects.flatMap((r) => [kbR6(r[0]), kbR6(r[2])]))].sort((p, q) => p - q), zs = [...new Set(rects.flatMap((r) => [kbR6(r[1]), kbR6(r[3])]))].sort((p, q) => p - q);
  const nx = xs.length - 1, nz = zs.length - 1, grid = Array.from({ length: nx }, () => new Uint8Array(nz));
  for (const r of rects) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; if (cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]) grid[i][j] = 1; }
  const occ = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && grid[i][j] === 1, raw = [];
  const edge = (p, q, n) => { const t = [-n[1], n[0]], d = [q[0] - p[0], q[1] - p[1]]; raw.push(d[0] * t[0] + d[1] * t[1] >= 0 ? { a: p, b: q, n } : { a: q, b: p, n }); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!occ(i, j)) continue;
    if (!occ(i - 1, j)) edge([xs[i], zs[j]], [xs[i], zs[j + 1]], [-1, 0]);
    if (!occ(i + 1, j)) edge([xs[i + 1], zs[j]], [xs[i + 1], zs[j + 1]], [1, 0]);
    if (!occ(i, j - 1)) edge([xs[i], zs[j]], [xs[i + 1], zs[j]], [0, -1]);
    if (!occ(i, j + 1)) edge([xs[i], zs[j + 1]], [xs[i + 1], zs[j + 1]], [0, 1]);
  }
  const groups = new Map();   // one run per line and side: merge the unit edges that touch end to end
  for (const s of raw) { const alongX = s.a[1] === s.b[1], k = (alongX ? 'x' : 'z') + (alongX ? s.a[1] : s.a[0]) + '|' + s.n; (groups.get(k) || groups.set(k, []).get(k)).push(s); }
  const out = [];
  for (const list of groups.values()) {
    const alongX = list[0].a[1] === list[0].b[1], ax = alongX ? 0 : 1, dir = Math.sign(list[0].b[ax] - list[0].a[ax]);
    list.sort((p, q) => dir * (p.a[ax] - q.a[ax]));
    let cur = { a: list[0].a, b: list[0].b, n: list[0].n };
    for (let i = 1; i < list.length; i++) { if (kbKey(list[i].a) === kbKey(cur.b)) cur.b = list[i].b; else { out.push(cur); cur = { a: list[i].a, b: list[i].b, n: list[i].n }; } }
    out.push(cur);
  }
  return out;
}
// take the stretches an axis-aligned opening [x0, z0, x1, z1] covers out of the segments (where the paving carries on, the kerb stops)
function kbOpen(segs, openings) {
  let list = segs;
  for (const o of openings) {
    const oAlongX = o[1] === o[3], line = oAlongX ? o[1] : o[0], lo = oAlongX ? Math.min(o[0], o[2]) : Math.min(o[1], o[3]), hi = oAlongX ? Math.max(o[0], o[2]) : Math.max(o[1], o[3]), next = [];
    for (const s of list) {
      const sAlongX = s.a[1] === s.b[1];
      if (sAlongX !== oAlongX || Math.abs((sAlongX ? s.a[1] : s.a[0]) - line) > 1e-6) { next.push(s); continue; }
      const ax = sAlongX ? 0 : 1, dir = Math.sign(s.b[ax] - s.a[ax]), s0 = Math.min(s.a[ax], s.b[ax]), s1 = Math.max(s.a[ax], s.b[ax]);
      if (hi <= s0 + 1e-9 || lo >= s1 - 1e-9) { next.push(s); continue; }
      const at = (v) => { const p = [s.a[0], s.a[1]]; p[ax] = v; return p; };
      const parts = [[s0, Math.min(lo, s1)], [Math.max(hi, s0), s1]].filter(([p, q]) => q - p > 1e-6);
      for (const [p, q] of parts) next.push(dir > 0 ? { a: at(p), b: at(q), n: s.n } : { a: at(q), b: at(p), n: s.n });
    }
    list = next;
  }
  return list;
}
// join the segments into chains: an open chain starts where nothing leads into it, a closed one comes back to its start. Returns { pts: [[x, z]...], n: [normal per segment], closed }
function kbChains(segs) {
  const byStart = new Map(segs.map((s) => [kbKey(s.a), s])), hasIn = new Set(segs.map((s) => kbKey(s.b))), used = new Set(), chains = [];
  const walk = (first, closed) => {
    const pts = [first.a], n = []; let s = first;
    while (s && !used.has(s)) { used.add(s); pts.push(s.b); n.push(s.n); s = byStart.get(kbKey(s.b)); }
    chains.push({ pts: closed ? pts.slice(0, -1) : pts, n, closed });
  };
  for (const s of segs) if (!hasIn.has(kbKey(s.a)) && !used.has(s)) walk(s, false);
  for (const s of segs) if (!used.has(s)) walk(s, true);
  return chains;
}
const kbTurn = (nA, nB) => { const tA = [-nA[1], nA[0]], tB = [-nB[1], nB[0]]; return tA[0] * tB[1] - tA[1] * tB[0]; };   // > 0: an outside (convex) corner of the paving, < 0: an inside (reflex) corner

// The kerb from the paved areas. areas: [x0, z0, x1, z1]; open edges are where the paving carries on: each road's far end, and each path's door end (a path that meets a road is open at its other end;
// one that meets nothing is a patio and is kerbed all round unless listed in plan.bothEnds, a path that runs between two thresholds).
function kerbPlan(areas, plan) {   // areas: the paving layout's [plaza, ...roads, ...trimmed paths]
  const open = [], trimmedPaths = areas.slice(1 + plan.roads.length);
  plan.roads.forEach((R) => {
    const alongZ = R[3] - R[1] > R[2] - R[0], toPlaza = kbTouch(R, plan.plaza);
    if (alongZ) { const far = toPlaza && toPlaza.side === 'z0' ? R[3] : R[1]; open.push([R[0], far, R[2], far]); }
    else { const far = toPlaza && toPlaza.side === 'x0' ? R[2] : R[0]; open.push([far, R[1], far, R[3]]); }
  });
  trimmedPaths.forEach((r, i) => {
    const tall = r[3] - r[1] >= r[2] - r[0], others = [plan.plaza, ...plan.roads];
    const ends = tall ? [[r[0], r[1], r[2], r[1]], [r[0], r[3], r[2], r[3]]] : [[r[0], r[1], r[0], r[3]], [r[2], r[1], r[2], r[3]]];
    const meet = ends.map((e) => others.some((A) => kbTouchEdge(e, A)));
    if (meet[0] !== meet[1]) open.push(ends[meet[0] ? 1 : 0]);
    else if (!meet[0] && plan.bothEnds && plan.bothEnds.includes(plan.paths[i])) open.push(...ends);
  });
  return { areas, open };
}
function kbTouch(A, B) {   // do two rectangles share an edge? { side of A, from, to } or null
  const e = 1e-6, ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
  let [lo, hi] = ov(A[1], A[3], B[1], B[3]);
  if (hi - lo > e) { if (Math.abs(A[0] - B[2]) < e) return { side: 'x0', lo, hi }; if (Math.abs(A[2] - B[0]) < e) return { side: 'x1', lo, hi }; }
  [lo, hi] = ov(A[0], A[2], B[0], B[2]);
  if (hi - lo > e) { if (Math.abs(A[1] - B[3]) < e) return { side: 'z0', lo, hi }; if (Math.abs(A[3] - B[1]) < e) return { side: 'z1', lo, hi }; }
  return null;
}
function kbTouchEdge(edge, A) {   // does a rectangle lie against this edge [x0, z0, x1, z1] from the other side?
  const e = 1e-6, alongX = edge[1] === edge[3], lo = alongX ? edge[0] : edge[1], hi = alongX ? edge[2] : edge[3];
  if (alongX) return (Math.abs(A[1] - edge[1]) < e || Math.abs(A[3] - edge[1]) < e) && Math.min(hi, A[2]) - Math.max(lo, A[0]) > e;
  return (Math.abs(A[0] - edge[0]) < e || Math.abs(A[2] - edge[0]) < e) && Math.min(hi, A[3]) - Math.max(lo, A[1]) > e;
}
// the kerb's chains for a plan: the outline of the paved areas, minus the openings
function kerbChains(areas, open) { return kbChains(kbOpen(kbBoundary(areas), open)); }

// ---------------------------------------------------------------- the profile and the sweep
// the cross-section, [d outward from the paving's edge, y, normal d, normal y]: a vertical face against the paving, a rounded top edge each side, a vertical outer face
function kbProfile(W = KB.W, H = KB.H, R = KB.R, n = KB.ROUND) {
  const p = [[0, 0, -1, 0]];
  for (let i = 0; i <= n; i++) { const a = Math.PI - (Math.PI / 2) * i / n; p.push([R + R * Math.cos(a), H - R + R * Math.sin(a), Math.cos(a), Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - (Math.PI / 2) * i / n; p.push([W - R + R * Math.cos(a), H - R + R * Math.sin(a), Math.cos(a), Math.sin(a)]); }
  p.push([W, 0, 1, 0]);
  return p;
}
const kbRot = (u, a) => [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[0] * Math.sin(a) + u[1] * Math.cos(a)];
// the rings the profile is set at along a chain: one per straight vertex, a fan of ARC rings round an outside corner (the same point, the profile turning), one mitred ring at an inside corner
function kbRings(chain) {
  const { pts, n, closed } = chain, rings = [], N = pts.length, segs = n.length;
  const vertex = (i, nA, nB) => {
    const turn = nA && nB ? kbTurn(nA, nB) : 0;
    if (!nA || !nB || Math.abs(turn) < 1e-9) { rings.push({ b: pts[i], u: nB || nA, s: 1 }); return; }
    if (turn > 0) { const ang = Math.atan2(nA[0] * nB[1] - nA[1] * nB[0], nA[0] * nB[0] + nA[1] * nB[1]); for (let k = 0; k <= KB.ARC; k++) rings.push({ b: pts[i], u: kbRot(nA, ang * k / KB.ARC), s: 1 }); }
    else { const m = [nA[0] + nB[0], nA[1] + nB[1]], l = Math.hypot(m[0], m[1]), u = [m[0] / l, m[1] / l]; rings.push({ b: pts[i], u, s: 1 / (u[0] * nA[0] + u[1] * nA[1]) }); }
  };
  for (let i = 0; i < N; i++) vertex(i, i > 0 ? n[i - 1] : closed ? n[segs - 1] : null, i < segs ? n[i] : closed ? n[0] : null);
  return rings;
}
// the geometry of a set of chains: { pos, nor, idx } as flat arrays (a cap closes each open end, square)
function kerbGeometry(chains, profile = kbProfile()) {
  const pos = [], nor = [], idx = [], P = profile.length;
  const add = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };
  const face = (i, j, k, want) => {   // wound so the face points the way the surface does
    const a = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], b = [pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], c = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cr[0] * want[0] + cr[1] * want[1] + cr[2] * want[2] >= 0) idx.push(i, j, k); else idx.push(i, k, j);
  };
  for (const chain of chains) {
    const rings = kbRings(chain), base = [];
    for (const r of rings) {
      const row = [];
      for (const [d, y, nd, ny] of profile) row.push(add(r.b[0] + r.u[0] * d * r.s, y, r.b[1] + r.u[1] * d * r.s, r.u[0] * nd, ny, r.u[1] * nd));
      base.push(row);
    }
    const last = chain.closed ? rings.length : rings.length - 1;
    for (let i = 0; i < last; i++) {
      const A = base[i], B = base[(i + 1) % rings.length];
      for (let j = 0; j + 1 < P; j++) {
        const [, , nd, ny] = profile[j], u = rings[i].u, w = [u[0] * nd, ny, u[1] * nd];
        face(A[j], B[j], B[j + 1], w); face(A[j], B[j + 1], A[j + 1], w);
      }
    }
    if (!chain.closed) for (const [ring, row, sign] of [[rings[0], base[0], -1], [rings[rings.length - 1], base[base.length - 1], 1]]) {   // the square end of the kerb
      const t = [-ring.u[1] * sign, ring.u[0] * sign], c = row.map((i) => add(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], t[0], 0, t[1]));
      for (let j = 1; j + 1 < P; j++) face(c[0], c[j], c[j + 1], [t[0], 0, t[1]]);
    }
  }
  return { pos, nor, idx };
}

// the kerb as a mesh in the scene (browser only)
function buildKerbs(chains, material) {
  const g = kerbGeometry(chains), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.pos), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.nor), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(g.idx), 1));
  const mesh = new THREE.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.dyn = true; mesh.frustumCulled = false; scene.add(mesh);
  return mesh;
}
if (typeof module === 'object' && module.exports) module.exports = { KB, kbBoundary, kbOpen, kbChains, kbTurn, kbTouch, kbTouchEdge, kerbPlan, kerbChains, kbProfile, kbRings, kerbGeometry };
