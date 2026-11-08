// Token Tower — the tower engine. Pure and deterministic: no Math.random, no DOM, no clock. Browser: window.JengaEngine. Node: require('./jenga-engine.js').
// Statics, not a rigid-body sim: a tower is stable when the weight above every interface sits over what holds it up.
//
// Units are block widths: a block is 3 long, 1 wide, 0.6 high (the brief's 5 : 1.67 : 1). Layer k is centred on (x 0, z 0); even layers run along X,
// odd layers along Z. A block's only free coordinate is uCoord, its lateral position along the layer's width axis (layers start at -1, 0, 1).
//
//   tower   { layers: [ [ { id, layer, uCoord, answerText? }, ... ], ... ] }   plain JSON; every function below returns new towers, never mutates
//   stability(tower)       -> { minMargin, weakest, weakestInterface, hullPoints, comPoint, byInterface }
//       margin_k = signed distance (block widths) from the centre of mass of everything above interface k to the hull of the contact patches between
//       layers k and k+1; the per-block test does the same for each block's own centre against its patches with the layer below. Negative = tips.
//   band(margin)           -> 'green' (>= 0.25) | 'amber' (>= 0.08) | 'red' (>= 0) | 'tip'
//   canPull / pullMargin   a block can leave when the rest keeps margin >= 0.12 and every block is still supported
//   placementRange         the lateral ranges where the held block lands with margin >= 0.15, on the top layer (or a fresh perpendicular one when it is full)
//   makeTower(rng)         the seeded "mid-game" start: 16 layers with 4-6 blocks already pulled, stability >= 0.2
//   collapseInit / collapseStep / collapseDone   the visual-only fall; orientation of a body = Rz(tz) Rx(tx) Ry(yaw), i.e. THREE Euler order 'ZXY' (tx, yaw, tz)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JengaEngine = api;
})(this, function () {
  const BLOCK = { len: 3, wid: 1, hgt: 0.6 };
  const HALF = BLOCK.len / 2, STEP = 0.05, LAYERS = 16, U_MAX = 2;   // a held block may hang up to half its width past the tower's edge: u runs over [-2, 2]
  const BANDS = { green: 0.25, amber: 0.08 };
  const LIM = { pull: 0.12, place: 0.15, start: 0.2, free: 0.2 };   // pull / place margins, the start tower's margin, the share of the lateral span left free
  const UNSUPPORTED = -9;

  // ---------------------------------------------------------------- geometry
  const rectOf = (b) => (b.layer % 2 === 0 ? [-HALF, HALF, b.uCoord - 0.5, b.uCoord + 0.5] : [b.uCoord - 0.5, b.uCoord + 0.5, -HALF, HALF]);   // [x0, x1, z0, z1]
  const centreOf = (b) => (b.layer % 2 === 0 ? [0, b.uCoord] : [b.uCoord, 0]);
  function overlap(a, b) {
    const x0 = Math.max(a[0], b[0]), x1 = Math.min(a[1], b[1]), z0 = Math.max(a[2], b[2]), z1 = Math.min(a[3], b[3]);
    return x1 - x0 > 1e-9 && z1 - z0 > 1e-9 ? [x0, x1, z0, z1] : null;
  }
  const corners = (r) => [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]];
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  function hull(pts) {   // convex hull, counter-clockwise, collinear points dropped
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]).filter((q, i, a) => !i || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    if (p.length < 3) return p;
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-12) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 1e-12) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  }
  // + inside, - outside, in block widths; a hull with no area holds nothing up (always negative)
  function signedDist(p, h) {
    if (!h.length) return UNSUPPORTED;
    if (h.length < 3) return -(h.length === 1 ? Math.hypot(p[0] - h[0][0], p[1] - h[0][1]) : segDist(p, h[0], h[1])) - 1e-6;
    let inside = Infinity, outside = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length], e = Math.hypot(b[0] - a[0], b[1] - a[1]);
      inside = Math.min(inside, cross(a, b, p) / e); outside = Math.min(outside, segDist(p, a, b));
    }
    return inside >= 0 ? inside : -outside;
  }
  const snap = (u) => +(Math.round(u / STEP) * STEP).toFixed(2);

  // ---------------------------------------------------------------- tower helpers
  const clone = (t) => ({ layers: t.layers.map((l) => l.map((b) => Object.assign({}, b))) });
  const blocks = (t) => t.layers.flat();
  const height = (t) => t.layers.length;
  function topLayer(t) { for (let k = t.layers.length - 1; k >= 0; k--) if (t.layers[k].length) return k; return -1; }
  const find = (t, id) => { for (const l of t.layers) for (const b of l) if (b.id === id) return b; return null; };
  const slotOf = (b) => Math.max(0, Math.min(2, Math.round(b.uCoord) + 1));   // 0, 1, 2: left, middle, right of the layer
  function fullTower(n = LAYERS) {
    return { layers: Array.from({ length: n }, (_, k) => [-1, 0, 1].map((u, j) => ({ id: 'b' + k + '.' + j, layer: k, uCoord: u }))) };
  }

  // ---------------------------------------------------------------- statics
  function stability(t) {
    const L = t.layers, n = L.length, sx = new Array(n + 1).fill(0), sz = new Array(n + 1).fill(0), sc = new Array(n + 1).fill(0);
    for (let k = n - 1; k >= 0; k--) {
      sx[k] = sx[k + 1]; sz[k] = sz[k + 1]; sc[k] = sc[k + 1];
      for (const b of L[k]) { const c = centreOf(b); sx[k] += c[0]; sz[k] += c[1]; sc[k]++; }
    }
    const byInterface = new Array(Math.max(0, n - 1)).fill(Infinity);
    let best = { minMargin: Infinity, weakest: null, weakestInterface: -1, hullPoints: [], comPoint: null };
    const consider = (m, k, weakest, h, com) => {
      if (m < byInterface[k]) byInterface[k] = m;
      if (m < best.minMargin) best = { minMargin: m, weakest, weakestInterface: k, hullPoints: h, comPoint: com };
    };
    const patches = (below, b) => { const out = [], r = b ? rectOf(b) : null; for (const a of below) { const o = overlap(rectOf(a), r); if (o) out.push(...corners(o)); } return out; };
    for (let k = 0; k < n - 1; k++) {   // the weight above interface k against what layer k offers layer k+1
      if (!sc[k + 1]) continue;
      const pts = [];
      for (const a of L[k]) for (const b of L[k + 1]) { const o = overlap(rectOf(a), rectOf(b)); if (o) pts.push(...corners(o)); }
      const h = hull(pts), com = [sx[k + 1] / sc[k + 1], sz[k + 1] / sc[k + 1]];
      consider(pts.length ? signedDist(com, h) : UNSUPPORTED, k, { kind: 'interface', k }, h, com);
    }
    for (let k = 1; k < n; k++) {   // each block's own centre against its footprint on the layer below
      for (const b of L[k]) {
        const h = hull(patches(L[k - 1], b)), com = centreOf(b);
        consider(signedDist(com, h), k - 1, { kind: 'block', layer: k, id: b.id }, h, com);
      }
    }
    if (best.minMargin === Infinity) best.minMargin = 9;
    best.byInterface = byInterface;
    return best;
  }
  const band = (m) => (m < 0 ? 'tip' : m < BANDS.amber ? 'red' : m < BANDS.green ? 'amber' : 'green');
  // visual-only: a wrong try lowers the DISPLAYED margin for about 10 s (the third wrong try collapses the tower by rule, not by this number)
  const shakePenalty = (tries, ageSec) => 0.06 * tries * Math.max(0, 1 - ageSec / 10);

  // ---------------------------------------------------------------- pulling
  function removeBlock(t, id) {
    const out = clone(t);
    for (const l of out.layers) { const i = l.findIndex((b) => b.id === id); if (i >= 0) { l.splice(i, 1); return out; } }
    throw new Error('no block ' + id);
  }
  // the margin the tower would have without the block (-Infinity when the block cannot be pulled at all: not there, on the table, or in the top layer)
  function pullMargin(t, id) {
    const b = find(t, id);
    if (!b || b.layer < 1 || b.layer >= topLayer(t)) return -Infinity;
    return stability(removeBlock(t, id)).minMargin;
  }
  const canPull = (t, id, min = LIM.pull) => pullMargin(t, id) >= min;
  const applyPull = (t, id) => removeBlock(t, id);

  // ---------------------------------------------------------------- placing
  // where the next block goes: the top layer while it holds fewer than 3 blocks, else a fresh perpendicular layer; u runs over [-2, 2] in steps of 0.05,
  // minus the positions that would overlap a block already in that layer
  function slotsAt(t, layer) {
    const others = t.layers[layer] || [], legal = [];
    for (let i = -U_MAX / STEP; i <= U_MAX / STEP; i++) { const u = snap(i * STEP); if (others.every((o) => Math.abs(u - o.uCoord) >= 1 - 1e-9)) legal.push(u); }
    return { layer, legal };
  }
  function slots(t) { const top = topLayer(t); return slotsAt(t, top < 0 || t.layers[top].length >= 3 ? top + 1 : top); }
  // layer: where placementRange said the block goes (default: the layer slots() names)
  function applyPlace(t, block, u, layer) {
    const s = layer == null ? slots(t) : slotsAt(t, layer), uu = snap(u);
    if (!s.legal.includes(uu)) throw new Error('cannot place at ' + uu);
    const out = clone(t);
    while (out.layers.length <= s.layer) out.layers.push([]);
    out.layers[s.layer].push({ id: block.id, layer: s.layer, uCoord: uu, answerText: block.answerText });
    return { tower: out, layer: s.layer };
  }
  function runs(us) {   // consecutive grid positions -> [[lo, hi], ...]
    const out = [];
    for (const u of us) { const last = out[out.length - 1]; if (last && u - last[1] <= STEP + 1e-9) last[1] = u; else out.push([u, u]); }
    return out;
  }
  // the same margins as stability(applyPlace(t, block, u)) for every legal u, from one scan of the tower: placing a block leaves every hull below it as it was,
  // changes only the weight above each interface, and adds the new block's own patch (checked against the full stability() in jenga-tests.js)
  function rangeFor(t, s) {
    const L = t.layers, n = L.length, Ln = s.layer, sx = new Array(n + 2).fill(0), sz = new Array(n + 2).fill(0), sc = new Array(n + 2).fill(0), hulls = [], patchesAt = [];
    for (let k = n - 1; k >= 0; k--) {
      sx[k] = sx[k + 1]; sz[k] = sz[k + 1]; sc[k] = sc[k + 1];
      for (const b of L[k]) { const c = centreOf(b); sx[k] += c[0]; sz[k] += c[1]; sc[k]++; }
    }
    let blockMin = Infinity;
    for (let k = 0; k < n - 1; k++) {
      const pts = []; for (const a of L[k]) for (const b of L[k + 1]) { const o = overlap(rectOf(a), rectOf(b)); if (o) pts.push(...corners(o)); }
      patchesAt[k] = pts; hulls[k] = hull(pts);
    }
    for (let k = 1; k < n; k++) for (const b of L[k]) { const r = rectOf(b), pts = []; for (const a of L[k - 1]) { const o = overlap(rectOf(a), r); if (o) pts.push(...corners(o)); } blockMin = Math.min(blockMin, signedDist(centreOf(b), hull(pts))); }
    const below = L[Ln - 1] || [], ok = [];
    for (const u of s.legal) {
      const nb = { layer: Ln, uCoord: u }, c = centreOf(nb), r = rectOf(nb), mine = [];
      for (const a of below) { const o = overlap(rectOf(a), r); if (o) mine.push(...corners(o)); }
      let m = Math.min(blockMin, mine.length ? signedDist(c, hull(mine)) : UNSUPPORTED);
      for (let k = 0; k < Ln && m >= LIM.place; k++) {
        const h = k === Ln - 1 ? hull((patchesAt[k] || []).concat(mine)) : hulls[k], cnt = sc[k + 1] + 1;
        m = Math.min(m, mine.length || k < Ln - 1 ? signedDist([(sx[k + 1] + c[0]) / cnt, (sz[k + 1] + c[1]) / cnt], h) : UNSUPPORTED);
      }
      if (m >= LIM.place) ok.push(u);
    }
    return { layer: Ln, step: STEP, legal: runs(s.legal), ranges: runs(ok), free: s.legal.length ? ok.length / s.legal.length : 0 };
  }
  // a partly built top layer takes the block while a fifth or more of its legal positions still hold it up; if the player has left it too little room
  // (two blocks wide apart, say), the block starts the next layer instead, so a correct pull is never left with nowhere to go
  function placementRange(t, block) {
    const s = slots(t), r = rangeFor(t, s);
    if (!(t.layers[s.layer] || []).length || (r.ranges.length && r.free >= LIM.free)) return r;
    const r2 = rangeFor(t, slotsAt(t, s.layer + 1)); r2.fresh = true;
    return r2;
  }
  // the lateral position a simulated player picks: the middle of the widest stable range, or its low or high end
  function choosePlacement(range, policy) {
    if (!range.ranges.length) return null;
    const widest = range.ranges.reduce((a, r) => (r[1] - r[0] > a[1] - a[0] ? r : a));
    return policy === 'lo' ? range.ranges[0][0] : policy === 'hi' ? range.ranges[range.ranges.length - 1][1] : snap((widest[0] + widest[1]) / 2);
  }

  // ---------------------------------------------------------------- the seeded start
  function makeTower(rng, o = {}) {
    const n0 = o.layers || LAYERS;
    for (let attempt = 0; attempt < 80; attempt++) {
      let t = fullTower(n0); const want = 4 + ((rng() * 3) | 0), pulled = [], used = new Set();   // 4-6 pulls, at most one per layer, never the top two layers or the bottom two
      for (let i = 0; i < want; i++) {
        const c = blocks(t).filter((b) => b.layer >= 2 && b.layer <= n0 - 3 && !used.has(b.layer) && canPull(t, b.id));
        if (!c.length) break;
        const b = c[(rng() * c.length) | 0];
        t = removeBlock(t, b.id); used.add(b.layer); pulled.push({ id: b.id, layer: b.layer, uCoord: b.uCoord });
      }
      if (pulled.length === want && stability(t).minMargin >= LIM.start) return { tower: t, pulled };
    }
    throw new Error('could not build a start tower');
  }

  // ---------------------------------------------------------------- the fall (visual only)
  // rng: a seeded () => [0, 1). Blocks above the weakest interface go first, outward along the way the weight is leaning; the ones below follow in turn.
  function collapseInit(t, rng, o = {}) {
    const opt = Object.assign({ floorY: -4, tableHalf: 3.2, g: 14 }, o), st = stability(t), k0 = Math.max(0, st.weakestInterface);
    let dx = 0, dz = 0;
    const h = st.hullPoints;
    if (st.comPoint && h.length) {
      const cx = h.reduce((a, p) => a + p[0], 0) / h.length, cz = h.reduce((a, p) => a + p[1], 0) / h.length;
      dx = st.comPoint[0] - cx; dz = st.comPoint[1] - cz;
    }
    let len = Math.hypot(dx, dz);
    if (len < 1e-6) { const a = rng() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); len = 1; }
    dx /= len; dz /= len;
    const bodies = blocks(t).map((b) => {
      const c = centreOf(b), above = b.layer > k0, rise = Math.abs(b.layer - k0);
      const push = above ? (1.1 + 0.9 * rng()) * (1 + 0.12 * rise) : 0.15 + 0.35 * rng();
      return {
        id: b.id, layer: b.layer, text: b.answerText, released: above ? 0 : 0.1 + 0.07 * rise + 0.15 * rng(), settled: false,
        pos: [c[0], (b.layer + 0.5) * BLOCK.hgt, c[1]], vel: [dx * push + (rng() - 0.5) * 0.6, above ? rng() * 0.5 : 0, dz * push + (rng() - 0.5) * 0.6],
        tx: 0, tz: 0, yaw: b.layer % 2 ? Math.PI / 2 : 0, wx: dz * push * (above ? 1.4 : 0.4) + (rng() - 0.5), wz: -dx * push * (above ? 1.4 : 0.4) + (rng() - 0.5), wy: (rng() - 0.5) * (above ? 2.5 : 0.8),
      };
    });
    return { opt, t: 0, bodies, k0, dir: [dx, dz] };
  }
  const HX = BLOCK.len / 2, HY = BLOCK.hgt / 2, HZ = BLOCK.wid / 2;
  function lowest(b) {   // how far the body's lowest corner sits below its centre
    const sx = Math.sin(b.tx), cx = Math.cos(b.tx), sz = Math.sin(b.tz), cz = Math.cos(b.tz), cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const a = sz, bb = cx * cz, d = -sx * cz;
    return HX * Math.abs(cy * a - sy * d) + HY * Math.abs(bb) + HZ * Math.abs(sy * a + cy * d);
  }
  const flat = (a) => { const q = Math.PI / 2; return Math.round(a / q) * q; };
  function collapseStep(S, dt) {
    const sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub, { g, floorY, tableHalf } = S.opt;
    for (let s = 0; s < sub; s++) {
      S.t += h;
      for (const b of S.bodies) {
        if (S.t < b.released) continue;
        b.vel[1] -= g * h;
        for (let i = 0; i < 3; i++) b.pos[i] += b.vel[i] * h;
        b.tx += b.wx * h; b.tz += b.wz * h; b.yaw += b.wy * h;
        const onTable = Math.abs(b.pos[0]) <= tableHalf && Math.abs(b.pos[2]) <= tableHalf, surface = onTable ? 0 : floorY, gap = b.pos[1] - lowest(b) - surface;
        if (gap < 0) {
          b.pos[1] -= gap;
          if (b.vel[1] < 0) b.vel[1] = -b.vel[1] * 0.22;
          if (Math.abs(b.vel[1]) < 0.6) b.vel[1] = 0;
          b.vel[0] *= 0.82; b.vel[2] *= 0.82; b.wx *= 0.7; b.wz *= 0.7; b.wy *= 0.7;
          b.tx += (flat(b.tx) - b.tx) * 0.2; b.tz += (flat(b.tz) - b.tz) * 0.2;   // lie down flat
        }
        b.settled = b.vel[1] === 0 && Math.hypot(b.vel[0], b.vel[2]) < 0.05 && Math.abs(b.wx) + Math.abs(b.wz) + Math.abs(b.wy) < 0.1 && gap < 0.02;
      }
    }
    return S;
  }
  const collapseDone = (S) => S.bodies.every((b) => S.t >= b.released && b.settled);

  return {
    BLOCK, HALF, STEP, LAYERS, U_MAX, BANDS, LIM, UNSUPPORTED,
    rectOf, centreOf, overlap, hull, signedDist, snap, clone, blocks, height, topLayer, find, slotOf, fullTower,
    stability, band, shakePenalty, pullMargin, canPull, applyPull, removeBlock, slots, slotsAt, applyPlace, placementRange, choosePlacement, makeTower,
    collapseInit, collapseStep, collapseDone,
  };
});
