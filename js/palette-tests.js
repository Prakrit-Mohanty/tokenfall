// TokenFall — palette tests (plain node): the shared palette obeys its own rule (nothing darker than the deep brown and plum), and palLift lifts stray dark colours to the floor.
//   node js/palette-tests.js
const assert = require('assert');
const { test, done } = require('./test-kit.js');
const { PAL, PAL_FLOOR, palRGB, palLift, palHex, signPaint, SIGN_HUES, palHS } = require('./game/palette.js');
const lum = (hex) => { const c = palRGB(hex); return (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255; };

test('every palette colour is at or above the floor: nothing in the shared palette is darker than the deep brown or plum', () => {
  for (const [name, hex] of Object.entries(PAL)) assert(lum(hex) >= PAL_FLOOR, `${name} ${hex} is darker than the floor`);
  assert(lum(PAL.brown) < lum(PAL.paint) && lum(PAL.plum) < lum(PAL.paint), 'the deep tones are the darkest');
});
test('palLift: a colour on the floor or above is untouched; black and near-black come up to the floor; a dark hue keeps its lean', () => {
  assert.strictEqual(palLift(PAL.cream), PAL.cream); assert.strictEqual(palLift(0xd4402a), 0xd4402a);
  for (const dark of ['#000000', '#1b1d24', '#0c0e14', 0x23262c, 0x1c1c20]) assert(lum(palLift(dark)) >= PAL_FLOOR - 0.01, `${dark} not lifted`);
  const teal = palRGB(palLift('#0d2a36')); assert(teal[2] > teal[0], 'a dark teal-blue should still lean blue after the lift');
});
test('signPaint: every hint a caller has ever passed (LED colours, the old dark boards) gives a soft palette panel with deep-brown ink; greys give cream; junk gives butter', () => {
  const hints = ['#ffd27a', '#8fe8ff', '#7dff9a', '#f6e3b4', '#ffe39a', '#2a1a12', '#18191c', '#1d2b4a', '#7a2a24', '#24527a', '#2a6a3a', '#6a4a1a', '#d6ecff', 0x2e7a70, '#abc'];
  for (const h of hints) { const p = signPaint(h); assert(Object.values(PAL).includes(p.board) && lum(p.board) >= PAL_FLOOR && p.ink === PAL.brown, `bad panel for ${h}`); }
  assert.strictEqual(signPaint('#18191c').board, PAL.cream); assert.strictEqual(signPaint(undefined).board, PAL.butter); assert.strictEqual(signPaint('nonsense').board, PAL.butter);
  assert.strictEqual(signPaint('#8fe8ff').board, PAL.sky); assert.strictEqual(signPaint('#7dff9a').board, PAL.mint); assert(SIGN_HUES.every((n) => PAL[n]));
  assert.strictEqual(palHex('#ABC'), '#aabbcc'); assert.strictEqual(palHex(0x2a1a), '#002a1a'); assert.strictEqual(palHex('red'), null);
});
test('paving palette: a mid-value cream base (neither near-white nor dark), accents that differ from it in value or hue, and a grout well below the stones', () => {
  const v = (k) => lum(PAL[k]), base = v('paveBase');
  assert(base > .7 && base < .9, `paveBase ${base.toFixed(2)} should sit mid-value`);
  assert(v('paveLight') > base && v('paveDeep') < base, 'light and deep stones bracket the base');
  assert(base - v('paveTaupe') > .25, 'the grout is clearly darker than the stones');
  for (const k of ['paveSage', 'paveBlue', 'paveBlush']) assert(Math.abs(v(k) - base) > .03 || palHS(PAL[k])[0] !== palHS(PAL.paveBase)[0], `${k} should read apart from the base`);
  const [, sat] = (() => { const [r, g, b] = palRGB(PAL.paveBase).map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return [0, (mx - mn) / mx]; })();
  assert(sat < .3, 'the base is low-saturation');
});
done();
