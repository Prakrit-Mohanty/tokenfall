// Self-test for the pure part of Token Mill's world: the layout against the engine, the brake meter against the belt clock, selection order, the plate ripple and words, the view fit. Run: node js/mill-world-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const W = require('./mill-world.js');
const E = require('./mill-engine.js');
const C = require('./mill-content.js');
const BG = require('./bridge-generator.js');
const { RUN } = C, L = W.LAYOUT;

test('layout: the four bins sit exactly where the engine says (-4.5, -1.5, 1.5, 4.5), the sorting zone lies on the belt, the pit is just beyond its end, and the hopper is at its start', () => {
  assert.deepStrictEqual(E.binXs, [-4.5, -1.5, 1.5, 4.5]);
  assert(L.belt.x0 < E.ZONE.x0 && L.belt.x1 > E.ZONE.x1 && L.hopper >= L.belt.x0 && L.hopper < E.ZONE.x0, 'the zone is on the belt; the hopper is at its start');
  assert(L.pit.x0 >= L.belt.x1 && L.pit.x1 > L.pit.x0, 'the pit is beyond the belt\'s end');
  for (let k = 0; k < 4; k++) { assert(Math.abs(E.binXs[k] - (E.ZONE.x0 + (k + 0.5) * 3)) < 1e-9); assert(E.binXs[k] - L.bin.w / 2 >= E.ZONE.x0 && E.binXs[k] + L.bin.w / 2 <= E.ZONE.x1); }
  for (let k = 1; k < 4; k++) assert(E.binXs[k] - E.binXs[k - 1] > L.bin.w, 'the bins do not touch');
  assert(L.bin.back > L.belt.z + 0.75 && L.bin.front > L.bin.back, 'the bins stand on the camera side of the belt');
  assert.deepStrictEqual(W.toWorld([-300, 0], [2, 1, 3]), [-298, 1, 3]);
  assert(L.desk.x < E.ZONE.x0 - 0.5 && L.desk.z > L.bin.front + 1, 'the control desk is clear of the bins and the belt');
});
test('brake meter: 3 s a shift at 40% speed, never refilled; stepped frame by frame it gives exactly the belt clock the engine builds from the same brake log', () => {
  const st = { used: 0, on: false, empty: false }; let belt = 0, real = 0; const log = [];
  for (let f = 0; f < 4000; f++) {
    const dt = 1 / 60, want = (f > 120 && f < 200) || (f > 600 && f < 700) || (f > 1500 && f < 1800), r = W.brakeStep(st, dt, want, 1);
    if (r.braked > 0) { const last = log[log.length - 1]; if (last && Math.abs(last.t1 - real) < 1e-9) last.t1 = real + r.braked; else log.push({ t0: real, t1: real + r.braked }); }
    belt += r.belt; real += dt;
    if (f % 337 === 0) assert(Math.abs(E.beltClock(log).s(real) - belt) < 1e-6, 'frame ' + f);
  }
  assert(Math.abs(st.used - 3) < 1e-6 && st.empty, 'the budget is spent: ' + st.used); assert(Math.abs(E.beltClock(log).used - 3) < 1e-6);
  const free = { used: 0, on: false, empty: false }; assert.strictEqual(W.brakeStep(free, 1, false, 1).belt, 1); assert(Math.abs(W.brakeStep(free, 1, true, 1).belt - 0.4) < 1e-9);
  const rest = { used: 2.5, on: false, empty: false }; const r = W.brakeStep(rest, 1, true, 1); assert(Math.abs(r.braked - 0.5) < 1e-9 && Math.abs(r.belt - (0.5 * 0.4 + 0.5)) < 1e-9, 'only what is left of the budget brakes');
  assert(Math.abs(W.brakeStep({ used: 0 }, 1, false, 0.75).belt - 0.75) < 1e-9, 'the relaxed belt runs at 0.75x');
});
test('selection: Tab walks the crates in the order they leave the zone, cyclic; Shift+Tab goes back; an empty belt selects nothing', () => {
  const list = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }];
  assert.strictEqual(W.nextSelection(list, null, 1), 'a'); assert.strictEqual(W.nextSelection(list, 'a', 1), 'b'); assert.strictEqual(W.nextSelection(list, 'c', 1), 'a'); assert.strictEqual(W.nextSelection(list, null, -1), 'c'); assert.strictEqual(W.nextSelection(list, 'a', -1), 'c');
  assert.strictEqual(W.nextSelection(list, 'gone', 1), 'a'); assert.strictEqual(W.nextSelection([], null, 1), null); assert.strictEqual(W.nextSelection([{ uid: 'x' }], 'x', 1), 'x');
});
test('plates: the ripple flips bin 1 first and bin 4 last, inside the shift change; every plate carries its slot number and shape, its label and its legend', () => {
  const r = W.plateRipple(0.6); assert.deepStrictEqual(r.map((x) => x.bin), [0, 1, 2, 3]); assert(r.every((x, i) => i === 0 || x.delay > r[i - 1].delay) && r[3].delay < 0.6 && r[0].delay > 0);
  for (const side of C.SIDE_IDS) C.SIDES[side].bins.forEach((b, k) => { const p = W.plateText(b, k); assert.strictEqual(p.num, String(k + 1)); assert.strictEqual(p.mark, W.STYLE[k].mark); assert.strictEqual(p.label, b.label); assert.strictEqual(p.legend, b.legend); });
  assert.deepStrictEqual(W.STYLE.map((s) => s.name), ['amber', 'green', 'cyan', 'rose']);
});
test('wrapping: tag text and plate legends keep every word, never overflow a line, and every crate of the bank fits a tag (4 lines) at the tag\'s width', () => {
  const measure = (s) => s.length * 11; let n = 0, over = 0;
  for (const c of C.CONCEPTS) for (const v of c.variants) for (const it of v.items) for (const p of [{}].concat(v.params && Object.keys(v.params).length ? [Object.fromEntries(Object.entries(v.params).map(([k, a]) => [k, a[0]]))] : [])) {
    const e = C.expand(it, p), lines = W.wrapLines(e.text, 232, measure); n++;
    assert(lines.every((l) => measure(l) <= 232), it.id); assert.strictEqual(lines.join(' ').replace(/\s+/g, ' '), e.text.replace(/\s+/g, ' ').trim()); if (lines.length > 4) over++;
  }
  console.log(`   ${n} crate texts wrapped at the tag width; ${over} need more than 4 lines at 11 px a character`); assert(over === 0);
  for (const side of C.SIDE_IDS) for (const b of C.SIDES[side].bins) assert(W.wrapLines(b.legend, 380, (s) => s.length * 12).length <= 2, b.legend);
  assert.deepStrictEqual(W.wrapLines('', 100, measure), []); assert(W.wrapLines('averyveryverylongword x', 50, measure).every((l) => measure(l) <= 50));
});
test('view: the whole sorting zone, the hopper, the pit and all four plates are on screen at 16:9, 16:10, 4:3, a square window and a phone; the layout view is used as it is at 16:9', () => {
  const proj = (cam, aspect, p) => {
    const f = norm(sub(cam.look, cam.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, cam.pos), zc = dot(v, f), th = Math.tan(cam.fov * Math.PI / 360);
    return { x: dot(v, r) / (zc * th * aspect), y: dot(v, u) / (zc * th), zc };
  };
  const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const pts = [[E.ZONE.x0, 1, L.belt.z], [E.ZONE.x1, 1, L.belt.z], [L.hopper, 1.6, L.belt.z], [L.pit.x0 + 1, 0.5, L.belt.z], ...E.binXs.map((x) => [x, L.plate.y + 0.4, L.plate.z]), ...E.binXs.map((x) => [x, 0.2, L.bin.front])];
  for (const aspect of [16 / 9, 16 / 10, 4 / 3, 1, 0.56]) {
    const cam = W.fitView(aspect); for (const p of pts) { const n = proj(cam, aspect, p); assert(n.zc > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1, `aspect ${aspect.toFixed(2)} point ${p}: ${n.x.toFixed(2)}, ${n.y.toFixed(2)}`); }
    assert.strictEqual(cam.fov, L.camera.fov);
  }
  assert.deepStrictEqual(W.fitView(16 / 9).pos, L.camera.pos); const a = W.fitView(1).pos, b = L.camera.pos; assert(Math.hypot(...sub(a, L.camera.look)) > Math.hypot(...sub(b, L.camera.look)), 'a narrower window pulls the camera back');
});
done();
