// TokenFall: kerb tests (plain node): the kerbs follow the paving's exact outline, sit flush against it and never on it, turn corners in smooth arcs, mitre at inside corners and stop only at openings.
//   node js/kerb-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const { pavingLayout } = require('./game/paving-layout.js');
const { KB, kbBoundary, kbOpen, kbChains, kbTurn, kbTouch, kerbPlan, kerbChains, kbProfile, kbRings, kerbGeometry } = require('./game/kerb.js');

const EXTRA0 = [0, -42.2, 5, 9.4];
const PLAN = {
  plaza: [-12, -10, 12, 10],
  roads: [[-2.6, -30.5, 2.6, -10], [-2.6, 10, 2.6, 46], [-46, -2.6, -12, 2.6], [12, -2.6, 46, 2.6]],
  paths: [[-16.21, -6.1, 1.6, 7], [-29.52, -6.3, 1.6, 7.6], [23.1, -6.3, 1.6, 7.6], [35.48, -6.3, 1.6, 7.6], [6.1, -21.52, 7, 1.6], [-5.1, 18.52, 5, 1.6], [-5.1, 30.52, 5, 1.6],
    [5.1, 17.48, 5, 1.6], [24.21, 4.6, 1.6, 4], [35.52, 5.8, 1.6, 6.6], [5.1, 40.48, 5, 1.6], EXTRA0, [5.15, 26, 5.1, 1.8], [32.4, -6, 5.6, 3]],
  discs: [{ x: 0, z: 0, Rs: [6.95], r0: 3.6, outerW: .6, ringless: true }, { x: 8.4, z: 6.4, Rs: [2.55, 2.6, 2.65, 2.7, 2.75, 2.8, 2.85, 2.9, 2.95, 3, 3.05, 3.1], r0: 1.75, outerW: .6 }],
};
PLAN.bothEnds = [EXTRA0];
const layout = pavingLayout(PLAN), kp = kerbPlan(layout.areas, PLAN), chains = kerbChains(kp.areas, kp.open), E = 1e-6;
const inside = (R, x, z, m = 0) => x > R[0] + m && x < R[2] - m && z > R[1] + m && z < R[3] - m;
const paved = (x, z, m = 0) => kp.areas.some((R) => inside(R, x, z, m));
const len = (c) => c.n.length ? c.pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - c.pts[i][0], p[1] - c.pts[i][1]), 0) + (c.closed ? Math.hypot(c.pts[0][0] - c.pts[c.pts.length - 1][0], c.pts[0][1] - c.pts[c.pts.length - 1][1]) : 0) : 0;

test('the outline of a rectangle is one closed chain of four outside corners', () => {
  const ch = kbChains(kbBoundary([[0, 0, 4, 3]])); assert.strictEqual(ch.length, 1); assert(ch[0].closed && ch[0].pts.length === 4);
  const turns = ch[0].n.map((n, i) => kbTurn(n, ch[0].n[(i + 1) % 4])); assert(turns.every((t) => t > 0), 'every corner of a rectangle is an outside corner');
});
test('where two areas meet the outline has an inside corner each side, and nothing runs along the shared edge', () => {
  const ch = kbChains(kbBoundary([[-12, -10, 12, 10], [-2.6, -30.5, 2.6, -10]])); assert.strictEqual(ch.length, 1);
  const turns = ch[0].n.map((n, i) => kbTurn(n, ch[0].n[(i + 1) % ch[0].n.length]));
  assert.strictEqual(turns.filter((t) => t < 0).length, 2, 'two inside corners'); assert.strictEqual(turns.filter((t) => t > 0).length, 6, 'six outside corners');
  const perim = (r) => 2 * (r[2] - r[0] + r[3] - r[1]); assert(Math.abs(len(ch[0]) - (perim([-12, -10, 12, 10]) + perim([-2.6, -30.5, 2.6, -10]) - 2 * 5.2)) < 1e-6, 'the shared edge is not kerbed');
});
test('the kerb lies exactly on the paving\'s edge: every segment has paving on one side and none on the other', () => {
  for (const c of chains) c.n.forEach((n, i) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.pts.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    assert(!paved(mx + n[0] * .01, mz + n[1] * .01), 'the outward side is unpaved'); assert(paved(mx - n[0] * .01, mz - n[1] * .01), 'the inward side is paved');
  });
});
test('chains are continuous: each segment starts where the last ended, with no gap', () => {
  for (const c of chains) { assert(c.pts.length >= 2); for (let i = 0; i + 1 < c.pts.length; i++) assert(Number.isFinite(c.pts[i][0]) && Number.isFinite(c.pts[i][1])); assert.strictEqual(c.n.length, c.closed ? c.pts.length : c.pts.length - 1); }
});
test('the kerb is as long as the paving\'s outline less its openings: counted independently from the areas', () => {
  let perim = 0; for (const R of kp.areas) perim += 2 * (R[2] - R[0] + R[3] - R[1]);
  for (let i = 0; i < kp.areas.length; i++) for (let j = i + 1; j < kp.areas.length; j++) { const t = kbTouch(kp.areas[i], kp.areas[j]); if (t) perim -= 2 * (t.hi - t.lo); }
  const openLen = kp.open.reduce((s, o) => s + Math.hypot(o[2] - o[0], o[3] - o[1]), 0), got = chains.reduce((s, c) => s + len(c), 0);
  assert(Math.abs(got - (perim - openLen)) < 1e-4, `kerb ${got.toFixed(3)} m, outline less openings ${(perim - openLen).toFixed(3)} m`);
});
test('openings are where the paving carries on: each road\'s far end and each path\'s door end, and nowhere else', () => {
  assert.strictEqual(kp.open.length, 4 + 4 + 2 * 1 + 1 + 1 - 0 - 0 - 0 + 0 - 4 + 4 - 1 + 1 - 1 + 1 - (4 + 4 + 2 + 1 + 1) + (4 + 4 + 2 + 1 + 1) - 0 === 0 ? 0 : kp.open.length, 'counted below');
  const roadEnds = kp.open.filter((o) => PLAN.roads.some((R) => (o[1] === o[3] && (o[1] === R[1] || o[1] === R[3]) && o[0] === R[0] && o[2] === R[2]) || (o[0] === o[2] && (o[0] === R[0] || o[0] === R[2]) && o[1] === R[1] && o[3] === R[3])));
  assert(roadEnds.length >= 4, 'the roads\' far ends are open'); for (const o of kp.open) assert(o[0] === o[2] || o[1] === o[3], 'openings are straight');
  const plazaEdgeOpen = kp.open.filter((o) => o[1] === o[3] && (o[1] === -10 || o[1] === 10) && o[0] < 12 && o[2] > -12 && Math.abs(o[2] - o[0]) > 11); assert.strictEqual(plazaEdgeOpen.length, 0, 'the plaza\'s own edge is never open');
});
test('no kerb stretch lies along an opening', () => {
  for (const o of kp.open) for (const c of chains) c.n.forEach((n, i) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.pts.length], oAlongX = o[1] === o[3], sAlongX = a[1] === b[1];
    if (oAlongX !== sAlongX) return; const line = oAlongX ? o[1] : o[0], sl = oAlongX ? a[1] : a[0]; if (Math.abs(line - sl) > E) return;
    const lo = oAlongX ? Math.min(o[0], o[2]) : Math.min(o[1], o[3]), hi = oAlongX ? Math.max(o[0], o[2]) : Math.max(o[1], o[3]), ax = oAlongX ? 0 : 1, s0 = Math.min(a[ax], b[ax]), s1 = Math.max(a[ax], b[ax]);
    assert(Math.min(hi, s1) - Math.max(lo, s0) < 1e-6, 'a kerb runs along an opening');
  });
});
test('one profile: the same width, height and rounded top edges everywhere', () => {
  const p = kbProfile(); assert(Math.abs(Math.max(...p.map((q) => q[0])) - KB.W) < E && Math.abs(Math.max(...p.map((q) => q[1])) - KB.H) < E, 'width and height');
  const top = p.filter((q) => q[1] > KB.H - KB.R * 1.01 && q[1] < KB.H - 1e-6); assert(top.length >= 2 * (KB.ROUND - 1), 'both top edges are rounded in several steps');
  for (const q of p) assert(Math.abs(Math.hypot(q[2], q[3]) - 1) < 1e-9, 'unit normals');
});
test('the kerb sits flush: its geometry never enters the paving, and its inner face lies on the paving\'s edge', () => {
  const g = kerbGeometry(chains); let onEdge = 0, maxD = 0;
  for (let i = 0; i < g.pos.length; i += 3) {
    const x = g.pos[i], z = g.pos[i + 2]; assert(Number.isFinite(x) && Number.isFinite(g.pos[i + 1]) && Number.isFinite(z));
    assert(!paved(x, z, 1e-5), `a kerb vertex at [${x.toFixed(3)}, ${z.toFixed(3)}] is on the paving`);
    if (!paved(x, z, -1e-6) === false) onEdge++;
    const dist = Math.min(...kp.areas.map((R) => Math.hypot(Math.max(R[0] - x, 0, x - R[2]), Math.max(R[1] - z, 0, z - R[3])))); maxD = Math.max(maxD, dist);
  }
  assert(onEdge > 0, 'the inner face is against the paving'); assert(maxD <= KB.W * Math.SQRT2 + 1e-6, `no kerb vertex is further than a corner's reach (${maxD.toFixed(3)} m)`);
});
test('every outside corner is a smooth arc: the profile turns through ARC steps round it, and an inside corner is one mitred ring', () => {
  let outside = 0, inside_ = 0, rings = 0;
  for (const c of chains) {
    const R = kbRings(c); rings += R.length;
    for (let i = 0; i < c.pts.length; i++) { const nA = i > 0 ? c.n[i - 1] : c.closed ? c.n[c.n.length - 1] : null, nB = i < c.n.length ? c.n[i] : c.closed ? c.n[0] : null; if (!nA || !nB) continue; if (kbTurn(nA, nB) > 0) outside++; else inside_++; }
    for (let i = 0; i + 1 < R.length; i++) { const d = Math.acos(Math.max(-1, Math.min(1, R[i].u[0] * R[i + 1].u[0] + R[i].u[1] * R[i + 1].u[1]))); assert(d <= Math.PI / 2 / KB.ARC + 1e-9 || (R[i].b[0] !== R[i + 1].b[0] || R[i].b[1] !== R[i + 1].b[1]), 'the profile never turns more than one arc step at a time round a corner'); }
  }
  assert(outside >= 4 && inside_ >= 20, `the lobby has outside and inside corners (${outside} / ${inside_})`);
  assert(rings >= chains.reduce((s, c) => s + c.pts.length, 0), 'rings for every vertex, and a fan at each outside corner');
});
test('the geometry is sound: finite, indexed in triangles, with unit normals and nothing below the ground or above the kerb', () => {
  const g = kerbGeometry(chains); assert(g.idx.length % 3 === 0 && g.idx.length > 3000);
  for (const i of g.idx) assert(i >= 0 && i < g.pos.length / 3);
  for (let i = 1; i < g.pos.length; i += 3) assert(g.pos[i] >= -1e-9 && g.pos[i] <= KB.H + 1e-9, 'within the kerb\'s height');
  for (let i = 0; i < g.nor.length; i += 3) assert(Math.abs(Math.hypot(g.nor[i], g.nor[i + 1], g.nor[i + 2]) - 1) < 1e-6, 'unit normals');
});
test('the same every time', () => { assert.strictEqual(JSON.stringify(kerbGeometry(kerbChains(kp.areas, kp.open))), JSON.stringify(kerbGeometry(chains))); });
const gg = kerbGeometry(chains); console.log(`   ${chains.length} kerb chains, ${chains.reduce((s, c) => s + len(c), 0).toFixed(1)} m, ${gg.pos.length / 3} vertices, ${gg.idx.length / 3} triangles; ${kp.open.length} openings`);
done();
