// TokenFall — time of day tests (plain node): the four moods are what the table says, the blend between them has no jumps, the night wraps to the morning, and the player's sliders do what they say.
//   node js/daylight-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const D = require('./daylight.js');

test('each mood lands exactly on its keyframe hour; the evening is not the afternoon and the night has stars', () => {
  for (const [name, hour] of D.MOODS) assert.deepStrictEqual(D.at(hour), D.PRESETS[name], name);
  assert(D.at(22.5).stars === 1 && D.at(14).stars === 0 && D.at(8).stars === 0);
  assert(D.at(18.5).sunDir[1] < D.at(14).sunDir[1] && D.at(18.5).lamps > D.at(14).lamps && D.at(22.5).lamps > D.at(18.5).lamps, 'the sun sinks and the lamps come on');
});
test('the clock wraps: hour 24 is midnight, the night holds until 4:30, and nothing jumps between neighbouring quarter hours', () => {
  assert.deepStrictEqual(D.at(0), D.at(24)); assert.deepStrictEqual(D.at(2), D.PRESETS.night); assert.deepStrictEqual(D.at(-1), D.at(23));
  const num = (p) => [].concat(p.sunDir, p.mul, p.shadow, p.hi, [p.sunI, p.hemiI, p.fogNear, p.fogFar, p.stars, p.lamps, p.glow, p.indoor, p.exposure, p.sat, p.vig, p.bloom, p.shafts, p.dust]);
  const days = []; for (let h = 0; h <= 24; h += 0.25) days.push(num(D.at(h)));
  const range = days[0].map((_, i) => Math.max(...days.map((d) => d[i])) - Math.min(...days.map((d) => d[i])) || 1);
  let worst = 0; for (let k = 1; k < days.length; k++) days[k].forEach((v, i) => { worst = Math.max(worst, Math.abs(v - days[k - 1][i]) / range[i]); });
  console.log('   largest change between two quarter hours: ' + (100 * worst).toFixed(1) + '% of that parameter\'s range over the day');
  assert(worst < 0.2, 'the light jumps somewhere');
});
test('colours blend as colours, the sun never goes below the horizon, and every mood has every parameter', () => {
  const keys = Object.keys(D.PRESETS.morning);
  for (const m of Object.values(D.PRESETS)) assert.deepStrictEqual(Object.keys(m), keys);
  assert.strictEqual(D.at(11).sunColor.length, 7);
  for (let h = 0; h < 24; h += 0.25) assert(D.at(h).sunDir[1] > 0, 'sun below the horizon at ' + h);
});
test('the sliders: brightness scales the exposure both ways, warmth leans the grade amber or blue and leaves the rest alone', () => {
  const p = D.at(14), up = D.adjust(p, { bright: 1 }), down = D.adjust(p, { bright: -1 }), warm = D.adjust(p, { warm: 1 }), cool = D.adjust(p, { warm: -1 });
  assert(up.exposure > p.exposure && down.exposure < p.exposure && D.adjust(p).exposure === p.exposure);
  assert(warm.mul[0] > p.mul[0] && warm.mul[2] < p.mul[2] && cool.mul[0] < p.mul[0] && cool.mul[2] > p.mul[2]); assert.strictEqual(warm.sunI, p.sunI);
});
test('names and the clock: the hours say what part of the day they are', () => {
  assert.deepStrictEqual([6, 9, 13, 18, 21, 2].map(D.nameOf), ['Morning', 'Morning', 'Afternoon', 'Evening', 'Night', 'Night']);
  assert.deepStrictEqual([0, 6.5, 12, 14.25, 23.75].map(D.clock), ['12:00 AM', '6:30 AM', '12:00 PM', '2:15 PM', '11:45 PM']);
});
done();
