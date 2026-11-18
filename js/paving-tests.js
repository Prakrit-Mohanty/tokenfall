// TokenFall: paving layout tests (plain node): the lobby's stones are whole, tile their areas exactly, line up across junctions, and are only ever cut on purpose (and never to a sliver).
//   node js/paving-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const { PL, plBounds, plTrimPath, plMouthRows, pavingLayout } = require('./game/paving-layout.js');

// the lobby as lobby-village.js builds it: the plaza, the four roads, the 14 door paths as vDoorPath computes them, the fountain and the round planter
const PLAN = {
  plaza: [-12, -10, 12, 10],
  roads: [[-2.6, -30.5, 2.6, -10], [-2.6, 10, 2.6, 46], [-46, -2.6, -12, 2.6], [12, -2.6, 46, 2.6]],
  paths: [[-16.21, -6.1, 1.6, 7], [-29.52, -6.3, 1.6, 7.6], [23.1, -6.3, 1.6, 7.6], [35.48, -6.3, 1.6, 7.6], [6.1, -21.52, 7, 1.6], [-5.1, 18.52, 5, 1.6], [-5.1, 30.52, 5, 1.6],
    [5.1, 17.48, 5, 1.6], [24.21, 4.6, 1.6, 4], [35.52, 5.8, 1.6, 6.6], [5.1, 40.48, 5, 1.6], [0, -42.2, 5, 9.4], [5.15, 26, 5.1, 1.8], [32.4, -6, 5.6, 3]],
  discs: [{ x: 0, z: 0, Rs: [6.95], r0: 3.6, outerW: .6, ringless: true }, { x: 8.4, z: 6.4, Rs: [2.55, 2.6, 2.65, 2.7, 2.75, 2.8, 2.85, 2.9, 2.95, 3, 3.05, 3.1], r0: 1.75, outerW: .6 }],
};
const L = pavingLayout(PLAN), rects = L.cells.filter((c) => c.k === 'r'), E = 1e-6;
const area = (c) => (c.x1 - c.x0) * (c.z1 - c.z0);
const inside = (c, R) => c.x0 >= R[0] - E && c.x1 <= R[2] + E && c.z0 >= R[1] - E && c.z1 <= R[3] + E;
const ownerOf = (c) => L.areas.find((R) => inside(c, R));

test('every stone lies inside exactly one paved area: nothing is sliced by an area edge or spills past it', () => {
  for (const c of rects) assert(ownerOf(c), `a stone [${c.x0.toFixed(2)}, ${c.z0.toFixed(2)}, ${c.x1.toFixed(2)}, ${c.z1.toFixed(2)}] crosses an area edge`);
});
test('paved areas never overlap each other: where two meet, they meet along an edge', () => {
  for (let i = 0; i < L.areas.length; i++) for (let j = i + 1; j < L.areas.length; j++) {
    const a = L.areas[i], b = L.areas[j], ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oz = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    assert(!(ox > 1e-6 && oz > 1e-6), `areas [${a.map((v) => v.toFixed(2))}] and [${b.map((v) => v.toFixed(2))}] overlap by ${ox.toFixed(2)} x ${oz.toFixed(2)}`);
  }
});
test('stones never overlap each other', () => {
  for (const R of L.areas) {
    const cs = rects.filter((c) => ownerOf(c) === R);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j], ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      assert(!(ox > 1e-4 && oz > 1e-4), `two stones overlap by ${ox.toFixed(3)} x ${oz.toFixed(3)} in area [${R.join(', ')}]`);
    }
  }
});
test('the stones tile each area completely (roads and paths exactly; the plaza apart from the round obstacles it makes room for)', () => {
  for (const R of L.areas) {
    const full = (R[2] - R[0]) * (R[3] - R[1]), got = rects.filter((c) => ownerOf(c) === R).reduce((s, c) => s + area(c), 0);
    if (R === PLAN.plaza) assert(got < full && got > full - 140, 'the plaza loses only the fountain and the planter');
    else assert(Math.abs(got - full) < 1e-3, `area [${R.join(', ')}] is covered ${got.toFixed(3)} of ${full.toFixed(3)}`);
  }
});
test('a row ends on a whole stone: plBounds fits the count, keeps the ends, honours forced joints and never makes a sliver', () => {
  for (const [lo, hi, nom] of [[0, 7.4, 1.9], [-11, 11, 1.6], [3, 4.9, 1.6], [0, 33.4, 1.9]]) {
    const b = plBounds(lo, hi, nom, 5);
    assert.strictEqual(b[0], lo); assert.strictEqual(b[b.length - 1], hi);
    for (let i = 0; i + 1 < b.length; i++) assert(b[i + 1] - b[i] > nom * .55 && b[i + 1] - b[i] < nom * 1.5, `a stone of ${(b[i + 1] - b[i]).toFixed(2)} in a ${nom} row`);
  }
  assert(plBounds(0, 10, 1.9, 1, [4.2, 5.8]).some((v) => Math.abs(v - 4.2) < E) && plBounds(0, 10, 1.9, 1, [4.2, 5.8]).some((v) => Math.abs(v - 5.8) < E), 'forced joints are boundaries');
});
test('no tiny stones: every stone is at least half a metre each way', () => {
  for (const c of rects) assert(c.x1 - c.x0 >= .5 && c.z1 - c.z0 >= .5, `a stone ${(c.x1 - c.x0).toFixed(2)} x ${(c.z1 - c.z0).toFixed(2)} at [${c.x0.toFixed(1)}, ${c.z0.toFixed(1)}]`);
  for (const c of L.cells.filter((c) => c.k === 's')) assert(c.r1 - c.r0 >= .5 && (c.t1 - c.t0) * (c.r0 + c.r1) / 2 >= .9, 'a wedge stone is a sensible size');
});
test('the road rows are the plaza rows: east and west roads share every row line with the plaza mouth, north and south share the plaza edge line', () => {
  const lines = (list) => [...new Set(list.flatMap((c) => [c.z0, c.z1]).map((v) => +v.toFixed(5)))];
  const mouth = lines(rects.filter((c) => ownerOf(c) === PLAN.plaza && c.z0 >= -2.6 - E && c.z1 <= 2.6 + E));
  const rowsOf = (road) => rects.filter((c) => ownerOf(c) === road && c.x0 >= road[0] + (road === PLAN.roads[2] ? 1 : 0) - E && c.x1 <= road[2] - (road === PLAN.roads[3] ? 1 : 0) + E);   // the rows, not the end cap
  for (const road of [PLAN.roads[2], PLAN.roads[3]]) for (const z of lines(rowsOf(road))) assert(mouth.includes(+z.toFixed(5)), `a road row line z=${z} is missing from the plaza mouth`);
  for (const [x0, x1] of [[-2.6, 2.6]]) for (const r of [PLAN.roads[0], PLAN.roads[1]]) {
    const edge = r === PLAN.roads[0] ? -10 : 10, ends = rects.filter((c) => ownerOf(c) === r && (Math.abs(c.z0 - edge) < E || Math.abs(c.z1 - edge) < E));
    assert(ends.length >= 4 && ends.every((c) => c.x0 >= x0 - E && c.x1 <= x1 + E), 'the road starts on the plaza edge line, with whole stones');
  }
});
test('the plaza mouth stones line up with the road: its band stones and field stones end where the road\'s do', () => {
  const xs = (r, edge) => new Set(rects.filter((c) => ownerOf(c) === r && (Math.abs(c.z0 - edge) < E || Math.abs(c.z1 - edge) < E)).flatMap((c) => [c.x0, c.x1]).map((v) => +v.toFixed(4)));
  const plazaN = new Set(rects.filter((c) => ownerOf(c) === PLAN.plaza && c.z0 < -9.5 && c.x0 >= -2.6 - E && c.x1 <= 2.6 + E).flatMap((c) => [c.x0, c.x1]).map((v) => +v.toFixed(4)));
  for (const v of [-2.6, -1.6, 1.6, 2.6]) assert(plazaN.has(v) && xs(PLAN.roads[0], -10).has(v), `the joint at x=${v} runs straight from the plaza into the north road`);
});
test('paths meet their roads exactly: trimmed so none overlaps a road or the plaza', () => {
  for (const p of PLAN.paths) {
    const r = plTrimPath(p, [PLAN.plaza, ...PLAN.roads]);
    for (const A of [PLAN.plaza, ...PLAN.roads]) assert(Math.min(r[2], A[2]) - Math.max(r[0], A[0]) <= E || Math.min(r[3], A[3]) - Math.max(r[1], A[1]) <= E, `a path [${p.join(', ')}] still overlaps [${A.join(', ')}]`);
  }
});
test('curves are cut on purpose: a cut stone always leaves a piece worth standing, and the stones inside a curve are gone', () => {
  assert.strictEqual(L.discs.length, 2);
  for (const d of L.discs) {
    for (const c of rects.filter((c) => c.cut && Math.abs(c.cut.x - d.x) < E && Math.abs(c.cut.z - d.z) < E)) {
      const far = Math.max(...[[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]].map(([x, z]) => Math.hypot(x - d.x, z - d.z)));
      assert(far - d.R >= PL.MIN_SLIVER - .02, `a cut stone leaves only ${(far - d.R).toFixed(2)} m standing`);
    }
    for (const c of rects.filter((c) => ownerOf(c) === PLAN.plaza)) assert(Math.max(...[[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]].map(([x, z]) => Math.hypot(x - d.x, z - d.z))) > d.R + 1e-6, 'no stone is left wholly inside a curve');
  }
});
test('the layout is the same every time', () => {
  assert.deepStrictEqual(JSON.stringify(pavingLayout(PLAN)), JSON.stringify(L));
});
console.log(`   ${L.cells.length} stones (${rects.length} straight, ${L.cells.length - rects.length} curved); cut radii ${L.discs.map((d) => d.R.toFixed(2)).join(', ')}`);
done();
