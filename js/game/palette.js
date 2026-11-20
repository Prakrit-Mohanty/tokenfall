// TokenFall: the shared palette. Every world asset takes its colours from here, so the whole place reads as one soft, toy-like painted world that matches the characters.
// Classic script: shares one global scope with the other js/game files; loaded before geometry.js / textures.js, which build materials from it at boot.
//
// Rules: soft pastel hues; warm cream and wood for neutrals; NOTHING darker than the two deep tones (a warm deep brown, a deep plum). No black, no cold grey.

const PAL = {
  // pastels
  cream: '#f6ecd9', butter: '#f4dc92', sand: '#ecd2a0', peach: '#f3bd9f', blush: '#f0b4b8', coral: '#eb8a74', rose: '#e59aa9',
  mint: '#bfe0c6', sage: '#a9c99d', leaf: '#8fc47f', teal: '#86cbc4', sky: '#b0d8ea', periwinkle: '#b6c2ea', lilac: '#cdbbe8', gold: '#efc062',
  // stone and wood
  stone: '#e6d8bf', stoneDeep: '#cdbd9f', woodLight: '#e0b074', wood: '#c58a56', woodDeep: '#a06a42',
  // paving: a mid-value, low-saturation warm-cream stone (not near-white, which blows out in the day; not dark, which goes muddy at night), a lighter and a deeper cousin for per-stone value,
  // three accent stones (dusty sage, soft blue-grey, blush) and a warm taupe for grout and worn edges. The paver texture is near-neutral; these are the colours the paver shader puts on it.
  paveBase: '#dccfb3', paveLight: '#e9dfca', paveDeep: '#c9bb9b', paveSage: '#b5c1a1', paveBlue: '#b0bcc6', paveBlush: '#e6c3b8', paveTaupe: '#917d69',
  // painted metal: the poles, legs and frames of everything. A dusty mauve instead of near-black
  paint: '#8e7586', paintLight: '#b9a3b0',
  // the darkest tones allowed anywhere (a colour below these is lifted to them): a warm deep brown and a deep plum
  brown: '#614230', plum: '#5a4256',
};
const PAL_FLOOR = .28;   // the least luminance (0-1) a solid colour may have

// a palette colour as an [r, g, b] byte array (for the canvas texture painters), optionally scaled
const palRGB = (hex, f = 1) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, v * f)); };
// a hex colour ('#rrggbb' or 0xrrggbb) lifted to the palette floor if it is any darker, by mixing it toward the deep plum just far enough: for the odd hard-coded colour that
// is not worth a palette name. Black becomes plum; a dark teal stays teal-ish; anything at or above the floor comes back unchanged.
const palLift = (hex) => {
  const hx = palHex(hex); if (!hx) return hex;   // not a colour we can read (a name, a Color): leave it
  const c = palRGB(hx), p = palRGB(PAL.plum), lum = (v) => (v[0] * .299 + v[1] * .587 + v[2] * .114) / 255;
  const L = lum(c); if (L >= PAL_FLOOR) return hex;
  const t = (PAL_FLOOR - L) / (lum(p) - L);
  return '#' + c.map((v, i) => Math.round(v + (p[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// ---- signs: one style everywhere (painted wood panel, rounded lettering). Callers still pass a colour hint (an old LED colour, a board colour); it only picks WHICH pastel the panel is painted.
const SIGN_FONT = '"Baloo 2", "Poppins", system-ui, sans-serif';   // rounded; same two families as the HTML UI (css/typography.css)
const SIGN_HUES = ['peach', 'blush', 'coral', 'butter', 'mint', 'sage', 'teal', 'sky', 'periwinkle', 'lilac'];
// '#rgb' / '#rrggbb' / 0xrrggbb to '#rrggbb' (or null)
const palHex = (c) => {
  if (typeof c === 'number') return '#' + c.toString(16).padStart(6, '0');
  if (typeof c !== 'string') return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim()); if (!m) return null;
  return '#' + (m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]).toLowerCase();
};
const palHS = (hex) => {   // [hue 0-1, saturation 0-1]
  const [r, g, b] = palRGB(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (!d) return [0, 0];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, d / (1 - Math.abs(2 * l - 1))];
};
function signPaint(hint) {
  const hex = palHex(hint), frame = { frame: PAL.wood, rim: PAL.woodLight, ink: PAL.brown };
  if (!hex) return Object.assign({ board: PAL.butter }, frame);
  const [h, s] = palHS(hex); if (s < .22) return Object.assign({ board: PAL.cream }, frame);   // greys and creams: a cream panel
  let best = SIGN_HUES[0], bd = 9;
  for (const n of SIGN_HUES) { const dh = Math.abs(palHS(PAL[n])[0] - h), d = Math.min(dh, 1 - dh); if (d < bd) { bd = d; best = n; } }
  return Object.assign({ board: PAL[best] }, frame);
}
// The floor, enforced where materials are made: a solid colour handed to a MeshStandardMaterial that is darker than the floor is lifted to it (hue kept), so no asset in any file can come out black.
if (typeof THREE !== 'undefined') {
  const MSM = THREE.MeshStandardMaterial;
  THREE.MeshStandardMaterial = class extends MSM { constructor(p) { super(p && (typeof p.color === 'number' || typeof p.color === 'string') ? Object.assign({}, p, { color: palLift(p.color) }) : p); } };
}
if (typeof module === 'object' && module.exports) module.exports = { PAL, PAL_FLOOR, palRGB, palLift, palHex, signPaint, SIGN_HUES, SIGN_FONT, palHS };
