// TokenFall: the paving layout. Every paved area lays out its OWN stones, starting from its own edges, so no stone is ever sliced by a kerb, a building or a neighbour:
//   - a border band of whole stones runs along every closed edge (an edge that meets another paved area stays open, so the paving flows through it);
//   - stone counts are fitted to each area's size (widths flex a little) so every row ends on a whole stone;
//   - the roads use the plaza's own row lines where they meet it, so grout lines run straight across the junction;
//   - round obstacles (the fountain, a planter) get a course of curved wedge stones, and the field stones that meet the curve are cut by it on purpose (the shader rounds those corners);
//   - a row that reaches a curve moves its joints until no cut leaves a sliver.
// Pure data in, cells out: node-testable (js/paving-tests.js). paving.js turns the cells into geometry and the shader draws each one (bevel, grout, colour), so this file knows nothing about drawing.
// Classic script (also require()-able): shares one global scope with the other js/game files.
//
// A cell is a rectangle { k: 'r', x0, z0, x1, z1 } or a ring sector { k: 's', cx, cz, r0, r1, t0, t1 }, with role 0 field, 1 band/border/collar, and id [a, b] (hash seed for its colour).

const PL = { NOM_FIELD: 1.6, NOM_BAND: 1.9, NOM_ROW: 1.06, NOM_SECT: 1.45, MOUTH: 2.6, BAND_ROAD: 1.0, MIN_SLIVER: .45 };

const plHash = (a, b) => {   // a stable [0, 1) from two integers: the layout is the same every load
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// boundaries from lo to hi that cut [lo, hi] into whole stones about `nominal` long: the count is rounded, so each stone flexes a little; `forced` points are always boundaries
// (a neighbouring path's edge, say), and each stretch between them is fitted on its own. The inner joints wander a little (+-15% of a stone by default) so a row is not a ruler.
function plBounds(lo, hi, nominal, seed, forced = [], amp = .3) {
  const pts = [lo, ...forced.filter((f) => f > lo + .3 && f < hi - .3).sort((a, b) => a - b), hi], out = [lo];
  for (let s = 0; s + 1 < pts.length; s++) {
    const a = pts[s], b = pts[s + 1], n = Math.max(1, Math.round((b - a) / nominal));
    for (let i = 1; i <= n; i++) out.push(i === n ? b : a + (b - a) * (i + (plHash(i, seed * 31 + s) - .5) * amp) / n);
  }
  return out;
}
// the stretch where two rectangles share an edge (they touch, they do not overlap): returns [side of A, from, to] or null
function plTouch(A, B) {
  const e = 1e-6, ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
  let [lo, hi] = ov(A[1], A[3], B[1], B[3]);
  if (hi - lo > e) { if (Math.abs(A[0] - B[2]) < e) return ['x0', lo, hi]; if (Math.abs(A[2] - B[0]) < e) return ['x1', lo, hi]; }
  [lo, hi] = ov(A[0], A[2], B[0], B[2]);
  if (hi - lo > e) { if (Math.abs(A[1] - B[3]) < e) return ['z0', lo, hi]; if (Math.abs(A[3] - B[1]) < e) return ['z1', lo, hi]; }
  return null;
}
// where other areas meet this one's side: their edges become joints of the band along it
const plForced = (A, side, others) => others.flatMap((B) => { const t = B !== A && plTouch(A, B); return t && t[0] === side ? [t[1], t[2]] : []; });

// ---------------------------------------------------------------- the plaza and the roads
// The plaza's mouth rows (where a road leaves it) use the road's own row lines, so a road's rows continue the plaza's rows exactly: a band row at each side, three field rows between.
function plMouthRows(z0, z1, band) { const f0 = z0 + band, f1 = z1 - band, h = (f1 - f0) / 3; return [z0, f0, f0 + h, f0 + 2 * h, f1, z1]; }

function plazaCells(P, others, cells, discs = []) {
  const M = PL.MOUTH, B = PL.BAND_ROAD, mr = plMouthRows(-M, M, B), n = (z0, z1) => Math.max(1, Math.round((z1 - z0) / PL.NOM_ROW));
  const push = (x0, z0, x1, z1, role, a, b) => cells.push({ k: 'r', x0, z0, x1, z1, role, id: [a, b] });
  // a row that reaches a curve tries joint patterns until every stone the curve cuts keeps a piece worth standing (a joint moves, so no sliver); a row that does not reach one is laid as usual
  const fit = (lo, hi, nom, seed, forced, z0, z1) => {
    if (!discs.some((d) => Math.max(z0 - d.z, d.z - z1, 0) < d.R + .05)) return plBounds(lo, hi, nom, seed, forced);
    let best = null, bestW = -1;
    for (let a = 0; a < 120; a++) {
      const b = plBounds(lo, hi, nom, seed + a * 977, forced, a < 40 ? .3 : .7); let w = 9;
      for (let i = 0; i + 1 < b.length; i++) for (const d of discs) { const h = plDiscHits([{ k: 'r', x0: b[i], z0, x1: b[i + 1], z1 }], d, d.R)[0]; if (h && h.out > 0) w = Math.min(w, h.out); }
      if (w > bestW) { bestW = w; best = b; } if (w >= PL.MIN_SLIVER) break;
    }
    return best;
  };
  const row = (bounds, z0, z1, role, seed) => { for (let i = 0; i + 1 < bounds.length; i++) push(bounds[i], z0, bounds[i + 1], z1, role, i, seed); };
  const col = (x0, x1, bounds, role, seed) => { for (let i = 0; i + 1 < bounds.length; i++) push(x0, bounds[i], x1, bounds[i + 1], role, i, seed); };
  // north and south of the mouths: whole rows (the outermost row is the border band) fitted to the stretch between the plaza edge and the mouth
  for (const [g, za, zb] of [['N', P[1], -M], ['S', M, P[3]]]) {
    const cnt = n(za, zb), h = (zb - za) / cnt, bw = h;
    for (let i = 0; i < cnt; i++) {
      const z0 = za + i * h, z1 = z0 + h, edgeRow = g === 'N' ? i === 0 : i === cnt - 1, seed = (g === 'N' ? 100 : 200) + i;
      if (edgeRow) {   // corner stones, band stones, and the road's own first stones across the mouth (the road's band either side of its field)
        push(P[0], z0, P[0] + bw, z1, 1, 0, seed); push(P[2] - bw, z0, P[2], z1, 1, 1, seed);
        const side = g === 'N' ? 'z0' : 'z1';
        row(plBounds(P[0] + bw, -M, PL.NOM_BAND, seed, plForced(P, side, others)), z0, z1, 1, seed + 1000);
        row(plBounds(M, P[2] - bw, PL.NOM_BAND, seed, plForced(P, side, others)), z0, z1, 1, seed + 2000);
        const mid = [-M, -M + B, 0, M - B, M];
        for (let k = 0; k < 4; k++) push(mid[k], z0, mid[k + 1], z1, k === 0 || k === 3 ? 1 : 0, k, seed + 3000);
      } else row(fit(P[0] + bw, P[2] - bw, PL.NOM_FIELD, seed, [], z0, z1), z0, z1, 0, seed);
    }
    // the border band down the east and west edges, between the corner stones and the mouth
    const c0 = g === 'N' ? za + h : za, c1 = g === 'N' ? zb : zb - h;
    for (const [x0, x1, side, sd] of [[P[0], P[0] + bw, 'x0', 300], [P[2] - bw, P[2], 'x1', 400]]) col(x0, x1, plBounds(c0, c1, PL.NOM_BAND, sd + (g === 'N' ? 0 : 50), plForced(P, side, others)), 1, sd + (g === 'N' ? 10 : 60));
  }
  // the mouth rows run the plaza's full width (the roads leave through them): an outer band row each side, three field rows between
  for (let r = 0; r < 5; r++) row(fit(P[0], P[2], r === 0 || r === 4 ? PL.NOM_BAND : PL.NOM_FIELD, 500 + r, [], mr[r], mr[r + 1]), mr[r], mr[r + 1], r === 0 || r === 4 ? 1 : 0, 600 + r);
}

// a road: band stones along both long edges (joints opposite every path that meets them), field rows between, a band across the far end; the end at the plaza stays open
function roadCells(R, others, cells) {
  const B = PL.BAND_ROAD, push = (x0, z0, x1, z1, role, a, b) => cells.push({ k: 'r', x0, z0, x1, z1, role, id: [a, b] });
  const alongZ = R[3] - R[1] > R[2] - R[0], seed = Math.round(R[0] * 7 + R[1] * 13) & 1023;
  if (alongZ) {
    const openLow = others.some((A) => A !== R && (plTouch(R, A) || [])[0] === 'z0' && A[2] - A[0] > 20), zo = openLow ? R[1] : R[3], zf = openLow ? R[3] : R[1], dir = openLow ? 1 : -1;
    const run = Math.abs(zf - zo) - B, n = Math.max(1, Math.round(run / PL.NOM_ROW)), h = run / n;
    for (let j = 0; j < n; j++) {   // field rows across the road: two stones each
      const za = zo + dir * j * h, zb = za + dir * h, z0 = Math.min(za, zb), z1 = Math.max(za, zb), b = plBounds(R[0] + B, R[2] - B, PL.NOM_FIELD, seed + j);
      for (let i = 0; i + 1 < b.length; i++) push(b[i], z0, b[i + 1], z1, 0, i, seed + j);
    }
    const ends = [zo, zf - dir * B], lo = Math.min(...ends), hi = Math.max(...ends);
    for (const [x0, x1, side, sd] of [[R[0], R[0] + B, 'x0', 1], [R[2] - B, R[2], 'x1', 2]]) {
      const b = plBounds(lo, hi, PL.NOM_BAND, seed + sd, plForced(R, side, others)); for (let i = 0; i + 1 < b.length; i++) push(x0, b[i], x1, b[i + 1], 1, i, seed + sd * 50);
    }
    const f0 = Math.min(zf, zf - dir * B), f1 = Math.max(zf, zf - dir * B), fb = [R[0], R[0] + B, ...plBounds(R[0] + B, R[2] - B, PL.NOM_FIELD, seed + 9).slice(1, -1), R[2] - B, R[2]];
    for (let i = 0; i + 1 < fb.length; i++) push(fb[i], f0, fb[i + 1], f1, 1, i, seed + 99);
  } else {
    const openLow = others.some((A) => A !== R && (plTouch(R, A) || [])[0] === 'x0' && A[3] - A[1] > 15), xo = openLow ? R[0] : R[2], xf = openLow ? R[2] : R[0], dir = openLow ? 1 : -1;
    const mr = plMouthRows(R[1], R[3], B), lo = Math.min(xo, xf - dir * B), hi = Math.max(xo, xf - dir * B);
    for (let r = 0; r < 5; r++) {   // rows along the road: the same row lines as the plaza's mouth rows
      const band = r === 0 || r === 4, b = plBounds(lo, hi, band ? PL.NOM_BAND : PL.NOM_FIELD, seed + r, band ? plForced(R, r === 0 ? 'z0' : 'z1', others) : []);
      for (let i = 0; i + 1 < b.length; i++) push(b[i], mr[r], b[i + 1], mr[r + 1], band ? 1 : 0, i, seed + r * 50);
    }
    const f0 = Math.min(xf, xf - dir * B), f1 = Math.max(xf, xf - dir * B), fb = [R[1], R[1] + B, ...plBounds(R[1] + B, R[3] - B, PL.NOM_FIELD, seed + 9).slice(1, -1), R[3] - B, R[3]];
    for (let i = 0; i + 1 < fb.length; i++) push(f0, fb[i], f1, fb[i + 1], 1, i, seed + 99);
  }
}

// ---------------------------------------------------------------- the door paths: basketweave, whole blocks
// A path starts at a door and was walked out "until a road", so its end can overlap the road by a stride (and a patio can overlap a door path). Trim it back to the other area's edge so it meets it exactly.
function plTrimPath(p, areas) {
  const r = [p[0] - p[2] / 2, p[1] - p[3] / 2, p[0] + p[2] / 2, p[1] + p[3] / 2], tall = p[3] >= p[2];
  for (const A of areas) {
    const ix = Math.min(r[2], A[2]) - Math.max(r[0], A[0]), iz = Math.min(r[3], A[3]) - Math.max(r[1], A[1]);
    if (ix <= 1e-6 || iz <= 1e-6 || Math.min(ix, iz) > .6) continue;
    if (tall) { if ((A[1] + A[3]) / 2 < (r[1] + r[3]) / 2) r[1] = Math.max(r[1], A[3]); else r[3] = Math.min(r[3], A[1]); }
    else if ((A[0] + A[2]) / 2 < (r[0] + r[2]) / 2) r[0] = Math.max(r[0], A[2]); else r[2] = Math.min(r[2], A[0]);
  }
  return r;
}
function pathCells(R, cells, seed) {   // blocks fitted to the path, each block two bricks, alternately side by side and end to end
  const w = R[2] - R[0], d = R[3] - R[1], nw = Math.max(1, Math.round(w / 1.3)), nd = Math.max(1, Math.round(d / 1.3)), sw = w / nw, sd = d / nd;
  for (let i = 0; i < nw; i++) for (let j = 0; j < nd; j++) {
    const x0 = R[0] + i * sw, z0 = R[1] + j * sd, par = (i + j) % 2;
    for (let k = 0; k < 2; k++) {
      if (par === 0) cells.push({ k: 'r', x0: x0 + k * sw / 2, z0, x1: x0 + (k + 1) * sw / 2, z1: z0 + sd, role: 0, id: [i * 7 + j, seed + k] });
      else cells.push({ k: 'r', x0, z0: z0 + k * sd / 2, x1: x0 + sw, z1: z0 + (k + 1) * sd / 2, role: 0, id: [i * 7 + j, seed + 17 + k] });
    }
  }
}

// ---------------------------------------------------------------- round obstacles
// field cells that a disc of radius R meets: dropped when wholly inside, cut when it bites (the cut leaves `out` of the cell standing outside the disc, measured at its farthest corner)
function plDiscHits(cells, d, R) {   // d: { x, z }
  const hits = [];
  for (const c of cells) {
    if (c.k !== 'r') continue;
    const nx = Math.max(c.x0, Math.min(d.x, c.x1)), nz = Math.max(c.z0, Math.min(d.z, c.z1)), near = Math.hypot(nx - d.x, nz - d.z);
    const far = Math.max(...[[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]].map(([x, z]) => Math.hypot(x - d.x, z - d.z)));
    if (near < R + .02) hits.push({ c, near, far, out: far - R });
  }
  return hits;
}
function plRings(d, cells) {   // d: { x, z, R, r0, outerW }; as many inner rings as fit (each at least half a metre wide), then the outer ring, which is the band
  const R = d.R, inner = Math.max(0, Math.floor((R - d.outerW - d.r0) / .55)), edges = [d.r0];
  for (let i = 1; i <= inner; i++) edges.push(d.r0 + (R - d.outerW - d.r0) * i / inner);
  edges.push(R);
  for (let ring = 0; ring + 1 < edges.length; ring++) {
    const r0 = edges[ring], r1 = edges[ring + 1], n = Math.max(6, Math.round(2 * Math.PI * (r0 + r1) / 2 / PL.NOM_SECT)), last = ring === edges.length - 2;
    for (let i = 0; i < n; i++) {
      const t0 = (i + (ring % 2) * .5) / n * 2 * Math.PI, t1 = t0 + 2 * Math.PI / n;
      cells.push({ k: 's', cx: d.x, cz: d.z, r0, r1, t0, t1, role: last ? 1 : 0, id: [i, 700 + ring + (d.x | 0)] });
    }
  }
}

/** plan: { plaza: [x0, z0, x1, z1], roads: [[...]], paths: [[cx, cz, w, d]], discs: [{ x, z, Rs: [candidate radii], r0, outerW, ringless }] }   (R, one of Rs: where the field stones are cut; r0: where the rings start)
 *  returns { cells, areas: [rect...], discs: [{ x, z, R }] } */
function pavingLayout(plan) {
  const cells = [], discs = [], trimmed = [];
  for (const p of plan.paths) trimmed.push(plTrimPath(p, [plan.plaza, ...plan.roads, ...trimmed]));   // a path meets a road, the plaza or an earlier path exactly: never over it
  const areas = [plan.plaza, ...plan.roads, ...trimmed];
  // each curve's radius: the first candidate whose cuts all leave a piece worth standing (with the rows' joints already adapted to it); failing that, the best of them
  const chosen = plan.discs.map((d) => ({ ...d, R: d.Rs[0] }));
  const outOf = (plazaCells_, d) => plazaCells_.reduce((m, c) => { const h = plDiscHits([c], d, d.R)[0]; return h && h.out > 0 ? Math.min(m, h.out) : m; }, 9);
  chosen.forEach((d) => {
    let best = d.Rs[0], bestW = -1;
    for (const R of d.Rs) { d.R = R; const trial = []; plazaCells(plan.plaza, areas, trial, chosen); const w = outOf(trial, d); if (w > bestW) { bestW = w; best = R; } if (w >= PL.MIN_SLIVER) break; }
    d.R = best;
  });
  const plaza = []; plazaCells(plan.plaza, areas, plaza, chosen);
  for (const d of chosen) {
    discs.push({ x: d.x, z: d.z, R: d.R });
    for (let i = plaza.length - 1; i >= 0; i--) { const c = plaza[i], h = plDiscHits([c], d, d.R)[0]; if (h && h.far <= d.R + 1e-6) plaza.splice(i, 1); else if (h) c[c.cut ? 'cut2' : 'cut'] = { x: d.x, z: d.z, R: d.R }; }   // wholly inside: dropped; bitten: cut by the curve
    if (!d.ringless) plRings(d, cells);   // a ringless curve (the fountain) has its own paving: the field is only cut round it
  }
  cells.push(...plaza);
  for (const R of plan.roads) roadCells(R, areas, cells);
  trimmed.forEach((R, i) => pathCells(R, cells, 800 + i * 3));
  return { cells, areas, discs: discs.map(({ x, z, R }) => ({ x, z, R })) };
}
if (typeof module === 'object' && module.exports) module.exports = { PL, plHash, plBounds, plTouch, plTrimPath, plMouthRows, pavingLayout };
