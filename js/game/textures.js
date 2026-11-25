// TokenFall: pixel-art canvas textures (grass, stone, glass, signs, the Calfus coin).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= pixel textures =================
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  // smooth up close (it used to be blocky); { nearest: true } keeps a texture crisp, and so do the tiny 8-16 px sprites (wings, puffs, ferns), which are pixel art
  t.magFilter = opts.nearest || (w <= 16 && h <= 16 && !opts.smooth) ? THREE.NearestFilter : THREE.LinearFilter;   // { smooth: true } softens even a tiny sprite (the grass tufts)
  t.minFilter = opts.nearest ? THREE.NearestFilter : opts.smooth ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter; if (opts.smooth) t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (Math.max(w, h) <= 64 && w * h > 256 && !opts.nearest && !opts.keep) { SOFTEN.push(t); if (softened) softenTextures(); }   // after boot (a minigame room): at once
  return t;
}
const rgb = (c, f = 1) => `rgb(${Math.max(0, Math.min(255, c[0] * f)) | 0},${Math.max(0, Math.min(255, c[1] * f)) | 0},${Math.max(0, Math.min(255, c[2] * f)) | 0})`;
const P = (g, x, y, c, f) => { g.fillStyle = rgb(c, f); g.fillRect(x, y, 1, 1); };
function noiseFill(g, w, h, base, amt, chance = 1, rng = rnd) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rng() < chance) P(g, x, y, base, 1 + (rng() - .5) * amt);
}
// a second seeded sequence for detail drawn after the world is built, so the layout's rnd() sequence never shifts
let decorSeed = 424242;
const decorRandom = () => (decorSeed = (decorSeed * 16807) % 2147483647) / 2147483647;
const TEXTURE_REFINES = [];
// the small surface textures are pixel art (all but the crisp, nearest-filtered details: signs, books, racks, doors); softenTextures() (once the world is built) repaints each one larger and smoothed, so the world has the soft,
// painted look of the 3D characters instead of grainy pixels. Done after the build because some textures are drawn into others while it runs.
const SOFTEN = [];
let softened = false;
function softenTextures() {
  softened = true;
  for (const t of SOFTEN) {
    const c = t.image, W = c.width, H = c.height, k = Math.max(2, Math.min(4, Math.round(192 / Math.max(W, H))));
    const o = document.createElement('canvas'); o.width = W * k; o.height = H * k;
    const g = o.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.filter = `blur(${(k * .45).toFixed(2)}px)`;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.drawImage(c, dx * o.width, dy * o.height, o.width, o.height);   // tiled, so the blur wraps and the repeat stays seamless
    t.image = o; t.magFilter = THREE.LinearFilter; if (t.minFilter === THREE.NearestFilter) t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  }
  SOFTEN.length = 0;
}
// queues a sharper redraw (w x h) of a texture; applyTextureRefines() swaps it in once the world exists
function refineTexture(tex, w, h, draw) { TEXTURE_REFINES.push({ tex, w, h, draw }); return tex; }
function applyTextureRefines() {
  for (const r of TEXTURE_REFINES) {
    const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
    r.draw(c.getContext('2d'), r.w, r.h);
    r.tex.image = c; r.tex.needsUpdate = true;
  }
}

// stones laid in rows; tiles seamlessly
function stoneTex(base, mortar, rowH = [5, 8], wid = [6, 12], size = 64, rng = rnd) {
  return canvasTex(size, size, (g, W, H) => {
    g.fillStyle = rgb(mortar); g.fillRect(0, 0, W, H);
    let y = 0;
    while (y < H) {
      let rh = rowH[0] + (rng() * (rowH[1] - rowH[0]) | 0); if (H - y < rh + rowH[0]) rh = H - y;
      const off = rng() * W | 0; let x = 0;
      while (x < W) {
        let sw = wid[0] + (rng() * (wid[1] - wid[0]) | 0); if (W - x < sw + wid[0]) sw = W - x;
        const v = (rng() - .5) * 18, c = [base[0] + v + (rng() - .5) * 6, base[1] + v, base[2] + v - rng() * 5];   // soft painted stones, not pixel noise
        for (let i = 1; i < sw; i++) for (let j = 1; j < rh; j++) {
          if ((i === 1 || i === sw - 1) && (j === 1 || j === rh - 1)) continue;
          let f = 1;
          if (j === 1 || i === 1) f = 1.08; else if (j === rh - 1 || i === sw - 1) f = .86;
          if (rng() < .1) f *= .96;
          P(g, (x + i + off) % W, (y + j) % H, c, f);
        }
        x += sw;
      }
      y += rh;
    }
  });
}
const TX = {};
function buildTextures() {
  TX.cobble = stoneTex([210, 178, 138], palRGB(PAL.woodDeep, .86));
  TX.flag = refineTexture(stoneTex([214, 190, 160], palRGB(PAL.woodDeep, .88), [10, 14], [10, 18]), 80, 80, (g, W, H) => g.drawImage(stoneTex([214, 190, 160], palRGB(PAL.woodDeep, .88), [12, 18], [12, 22], 80, decorRandom).image, 0, 0));
  TX.stoneWall = stoneTex(palRGB(PAL.stone), palRGB(PAL.woodDeep, .9), [6, 9], [9, 16], 32);
  // The lawn's colour comes from the groundVariation shader's two-tone patches (geometry.js, set per mood by daylight.js); the texture is only a very faint, neutral blade grain, so it carries no hue of its own.
  // It still draws the same number of rnd() values as the old green texture did, so the lobby layout that follows is unchanged.
  const blades = (amp, marks) => (g, W, H) => {
    noiseFill(g, W, H, [244, 244, 244], amp);
    for (let i = 0; i < 40; i++) { const x = rnd() * W | 0, y = rnd() * H | 0, f = rnd() < .5 ? marks : 1.03; for (let k = 0; k < 3; k++) P(g, x, (y + k) % H, [244, 244, 244], f - k * .005); }
  };
  TX.grass = canvasTex(64, 64, blades(.05, .92));
  TX.darkGrass = canvasTex(64, 64, (g, W, H) => { noiseFill(g, W, H, [236, 236, 236], .06); });
  TX.dirt = canvasTex(32, 32, (g, W, H) => { noiseFill(g, W, H, [120, 92, 64], .25); });
  TX.plaster = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, palRGB(PAL.cream, .97), .035);
    for (let i = 0; i < 6; i++) { let x = rnd() * W | 0, y = rnd() * H | 0; for (let k = 0; k < 4; k++) { P(g, x % W, y % H, palRGB(PAL.cream, .9)); x += rnd() < .5 ? 1 : 0; y++; } }
  });
  TX.wood = canvasTex(32, 32, (g, W, H) => {
    for (let x = 0; x < W; x++) { const plank = (x / 8 | 0), b = [178 + plank % 2 * 10, 124 + plank % 2 * 6, 80]; for (let y = 0; y < H; y++) P(g, x, y, b, x % 8 === 0 ? .82 : 1 + (rnd() - .5) * .05); }
    for (let i = 0; i < 10; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; for (let k = 0; k < 5; k++) P(g, x, (y + k) % H, [156, 104, 66]); }
  });
  TX.darkWood = canvasTex(16, 16, (g, W, H) => { noiseFill(g, W, H, palRGB(PAL.woodDeep), .1); for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x++) if (rnd() < .5) P(g, x, y, palRGB(PAL.woodDeep, .86)); });
  TX.floor = canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) { const row = y / 8 | 0, b = [150 - row % 2 * 14, 108 - row % 2 * 10, 70]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 8 === 0 || (x + row * 11) % 32 === 0 ? .7 : 1 + (rnd() - .5) * .08); }
  });
  TX.roof = canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const col = x % 6, row = y % 8;
      let f = [1.25, 1.1, 1, .9, .7, .5][col];
      if (row === 0) f *= .55; else if (row === 1) f *= 1.15;
      P(g, x, y, palRGB(PAL.coral, .9), f * (1 + (rnd() - .5) * .08));   // terracotta tiles: the roofs were slate grey
    }
  });
  TX.lattice = canvasTex(32, 32, (g, W, H) => {
    g.fillStyle = PAL.woodDeep; g.fillRect(0, 0, W, H);
    g.fillStyle = PAL.wood;
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 1);
    g.fillStyle = PAL.woodLight; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2); g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H);
  }, { nearest: true });
  TX.door = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, palRGB(PAL.wood), .1);
    g.fillStyle = PAL.brown; g.fillRect(15, 0, 2, H);
    for (const x of [3, 19]) { g.fillStyle = PAL.woodDeep; g.fillRect(x, 3, 10, 26); g.fillStyle = PAL.woodLight; for (let yy = 5; yy < 28; yy += 3) g.fillRect(x + 1, yy, 8, 1); }
    g.fillStyle = '#d9b46a'; g.fillRect(13, 16, 2, 2); g.fillRect(17, 16, 2, 2);
  }, { nearest: true });
  TX.cloth = canvasTex(16, 16, (g, W, H) => { for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) P(g, x, y, palRGB(PAL.coral), x % 4 < 2 ? 1 : .9); });
  TX.bark = canvasTex(16, 16, (g, W, H) => { noiseFill(g, W, H, palRGB(PAL.wood, .86), .2); for (let x = 0; x < W; x += 3) for (let y = 0; y < H; y++) if (rnd() < .6) P(g, x, y, palRGB(PAL.woodDeep, .88)); });
  const leaf = (base) => canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, base, .08);
    for (let i = 0; i < 36; i++) {
      const x = rnd() * W | 0, y = rnd() * H | 0, f = rnd() < .5 ? 1.12 : .86;
      for (let k = 0; k < 5; k++) P(g, (x + [0, 1, -1, 0, 0][k] + W) % W, (y + [0, 0, 0, 1, -1][k] + H) % H, base, f * (k ? .92 : 1));
    }
  });
  TX.leafA = leaf([126, 168, 136]); TX.leafB = leaf([108, 148, 118]); TX.leafC = leaf([166, 190, 128]); TX.blossom = leaf([236, 176, 196]); TX.leafLav = leaf([178, 162, 214]);   // pastel canopies: mint, sage, butter-green, rose, lavender
  TX.patch = canvasTex(64, 64, (g, W, H) => {   // a patchwork quilt of soft squares with running stitches, for the paths
    const cols = ['#e9c9c4', '#d7d9ec', '#f1e2bd', '#cfe3d4', '#e6d3ea', '#f3d6c2'];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = cols[(i * 3 + j * 5 + (i ^ j)) % cols.length]; g.fillRect(i * 16, j * 16, 16, 16); }
    g.strokeStyle = 'rgba(120,90,110,.5)'; g.lineWidth = 1; g.setLineDash([2, 2]); for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 16 + .5, 0); g.lineTo(k * 16 + .5, H); g.stroke(); g.beginPath(); g.moveTo(0, k * 16 + .5); g.lineTo(W, k * 16 + .5); g.stroke(); }
  });
  TX.books = canvasTex(32, 32, (g, W, H) => {
    g.fillStyle = PAL.woodDeep; g.fillRect(0, 0, W, H);
    for (let shelf = 0; shelf < 4; shelf++) {
      let x = 1; const y0 = shelf * 8;
      g.fillStyle = PAL.woodLight; g.fillRect(0, y0 + 7, W, 1);
      while (x < W - 1) { const w = 1 + (rnd() * 2 | 0), h = 4 + (rnd() * 3 | 0), c = [palRGB(PAL.coral), palRGB(PAL.sky), palRGB(PAL.butter), palRGB(PAL.sage), palRGB(PAL.lilac)][rnd() * 5 | 0]; g.fillStyle = rgb(c); g.fillRect(x, y0 + 7 - h, w, h); g.fillStyle = rgb(c, 1.3); g.fillRect(x, y0 + 7 - h, w, 1); x += w + (rnd() < .15 ? 1 : 0); }
    }
  }, { nearest: true });
  TX.rack = canvasTex(16, 32, (g, W, H) => {
    g.fillStyle = PAL.plum; g.fillRect(0, 0, W, H);
    for (let y = 2; y < H; y += 4) { g.fillStyle = PAL.paint; g.fillRect(1, y, W - 2, 3); g.fillStyle = rnd() < .5 ? '#ffb347' : '#6ee07a'; g.fillRect(2, y + 1, 1, 1); g.fillStyle = '#ffb347'; if (rnd() < .5) g.fillRect(4, y + 1, 1, 1); }
  }, { nearest: true });
  TX.screen = canvasTex(32, 20, (g, W, H) => {
    g.fillStyle = PAL.plum; g.fillRect(0, 0, W, H);
    for (let y = 2; y < H - 1; y += 2) { const x0 = 2 + (rnd() * 4 | 0); g.fillStyle = rnd() < .3 ? '#ffd27a' : '#7fe6ff'; g.fillRect(x0, y, 4 + (rnd() * 20 | 0), 1); }
  }, { nearest: true });
  // the one path style: soft pastel stone tiles (cream with a hint of peach, butter, mint, lilac or blush) laid in rows, in warm stone grout
  const paverDraw = (bw, bh, rng) => (g, W, H) => {
    g.fillStyle = rgb(palRGB(PAL.stoneDeep, .96)); g.fillRect(0, 0, W, H);
    const tints = [PAL.cream, PAL.peach, PAL.butter, PAL.mint, PAL.lilac, PAL.blush].map((h) => palRGB(h)), cream = palRGB(PAL.cream);
    for (let r = 0; r < H / bh; r++) for (let c = -1; c < W / bw; c++) {
      const x0 = c * bw + (r % 2) * bw / 2, y0 = r * bh, t = tints[rng() * tints.length | 0], k = .3 + rng() * .2, v = 1 + (rng() - .5) * .05, b = cream.map((v0, i) => v0 + (t[i] - v0) * k);
      for (let i = 1; i < bw; i++) for (let j = 1; j < bh; j++) { const x = x0 + i; if (x < 0 || x >= W) continue; P(g, x, y0 + j, b, (j === 1 ? 1.04 : j === bh - 1 ? .94 : 1) * v); }
    }
  };
  TX.paver = refineTexture(canvasTex(64, 64, paverDraw(16, 8, rnd)), 96, 96, paverDraw(24, 12, decorRandom));
  // The paving's detail source: 512 px of seamless, neutral stone grain (soft blotches, pores, fine speckle), mipmapped and read at 16x anisotropy so it holds up at a low angle and calms with
  // distance instead of shimmering. paving.js lays the stones out in world space and reads this twice, at two scales and angles, so it never visibly repeats. It has its own random stream.
  TX.paveGrain = canvasTex(512, 512, (g, W, H) => {
    let seed = 90210; const rs = () => (seed = (seed * 16807) % 2147483647) / 2147483647, smooth = (t) => t * t * (3 - 2 * t);
    const oct = [[8, .5], [16, .25], [32, .16], [64, .1], [128, .06]].map(([n, a]) => ({ n, a, v: Float32Array.from({ length: n * n }, rs) }));   // periodic value-noise lattices
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0;
      for (const { n, a, v: l } of oct) {
        const fx = x / W * n, fy = y / H * n, ix = fx | 0, iy = fy | 0, tx = smooth(fx - ix), ty = smooth(fy - iy), x1 = (ix + 1) % n, y1 = (iy + 1) % n;
        v += a * ((l[iy * n + ix] * (1 - tx) + l[iy * n + x1] * tx) * (1 - ty) + (l[y1 * n + ix] * (1 - tx) + l[y1 * n + x1] * tx) * ty);
      }
      const k = Math.max(0, Math.min(255, (v / 1.07 + (rs() < .015 ? -.25 : 0) + (rs() - .5) * .08) * 255)) | 0, i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  TX.paveGrain.anisotropy = 16;
  TX.concrete = refineTexture(canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, palRGB(PAL.stone, .97), .03);
    g.fillStyle = rgb(palRGB(PAL.stoneDeep, .96)); g.fillRect(0, 15, W, 1); g.fillRect(15, 0, 1, H);
    for (const [x, y] of [[7, 7], [23, 7], [7, 23], [23, 23]]) P(g, x, y, palRGB(PAL.stoneDeep, .78));
  }), 48, 48, (g, W, H) => {
    noiseFill(g, W, H, palRGB(PAL.stone, .97), .03, 1, decorRandom);
    for (let i = 0; i < 40; i++) P(g, decorRandom() * W | 0, decorRandom() * H | 0, palRGB(PAL.stone, .9));
    g.fillStyle = rgb(palRGB(PAL.stoneDeep, .96)); g.fillRect(0, 23, W, 1); g.fillRect(23, 0, 1, H);
    for (const [x, y] of [[11, 11], [35, 11], [11, 35], [35, 35]]) P(g, x, y, palRGB(PAL.stoneDeep, .78));
  });
  TX.cladding = refineTexture(canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) { const sl = y / 4 | 0, b = [[168, 116, 72], [150, 102, 62], [176, 124, 78]][sl % 3]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 4 === 3 ? .55 : 1 + (rnd() - .5) * .08); }
  }), 48, 48, (g, W, H) => {
    for (let y = 0; y < H; y++) { const sl = y / 6 | 0, b = [[168, 116, 72], [150, 102, 62], [176, 124, 78]][sl % 3]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 6 === 5 ? .55 : y % 6 === 0 ? 1.08 : 1 + (decorRandom() - .5) * .08); }
    for (let i = 0; i < 30; i++) { const x = decorRandom() * W | 0, y = decorRandom() * H | 0; P(g, x, y, [120, 80, 50]); P(g, (x + 1) % W, y, [120, 80, 50]); }
  });
  TX.roofFlat = refineTexture(canvasTex(32, 32, (g, W, H) => { noiseFill(g, W, H, palRGB(PAL.stoneDeep, .92), .1); g.fillStyle = rgb(palRGB(PAL.stoneDeep, .74)); g.fillRect(0, 0, W, 1); g.fillRect(0, 16, W, 1); }),
    64, 64, (g, W, H) => { noiseFill(g, W, H, palRGB(PAL.stoneDeep, .92), .1, 1, decorRandom); g.fillStyle = rgb(palRGB(PAL.stoneDeep, .74)); g.fillRect(0, 0, W, 1); g.fillRect(0, 32, W, 1); g.fillStyle = rgb(palRGB(PAL.stoneDeep, .98)); g.fillRect(0, 1, W, 1); g.fillRect(0, 33, W, 1); });
  // curtain-wall glass: some panes reflect the sky, some show warm lit offices
  const lit = Array.from({ length: 4 }, () => Array.from({ length: 2 }, () => rnd() < .45));
  const glass = (emissive) => canvasTex(32, 32, (g, W, H) => {
    g.fillStyle = emissive ? '#000' : PAL.cream; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x0 = c * 8 + 1, y0 = r * 16 + 1, on = lit[c][r];
      for (let j = 0; j < 14; j++) for (let i = 0; i < 7; i++) {
        let col;
        if (on) col = j > 9 ? [120, 92, 66] : [255, 214, 150];
        else { const t = j / 14; col = [150 - t * 60, 176 - t * 66, 196 - t * 66]; if ((i + j) % 9 === 0 || (i + j) % 9 === 1) col = col.map(v => v + 30); }
        if (emissive) col = on && j <= 9 ? [255, 190, 120] : [0, 0, 0];
        P(g, x0 + i, y0 + j, col);
      }
      if (!emissive) { g.fillStyle = PAL.stoneDeep; g.fillRect(x0, y0 + 10, 7, 1); }
    }
  }, { nearest: true });
  TX.glass = glass(false); TX.glassE = glass(true);
  const glassHi = (emissive) => (g, W, H) => {
    g.fillStyle = emissive ? '#000' : PAL.cream; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x0 = c * 24 + 2, y0 = r * 48 + 2, on = lit[c][r];
      for (let j = 0; j < 45; j++) for (let i = 0; i < 21; i++) {
        let col;
        if (on) col = j < 3 ? [255, 238, 196] : j > 34 ? [96, 74, 56] : j > 29 ? [120, 92, 66] : [255, 214, 150];
        else { const t = j / 45; col = [150 - t * 60, 176 - t * 66, 196 - t * 66]; if ((i + j) % 27 < 3) col = col.map(v => v + 30); }
        if (on && j > 29 && j < 35 && (i % 7 === 2 || i % 7 === 3)) col = [70, 56, 44];
        if (emissive) col = on && j <= 29 ? (j < 3 ? [255, 228, 170] : [255, 190, 120]) : [0, 0, 0];
        P(g, x0 + i, y0 + j, col);
      }
      if (!emissive) { g.fillStyle = PAL.stoneDeep; g.fillRect(x0, y0 + 30, 21, 2); }
    }
  };
  refineTexture(TX.glass, 96, 96, glassHi(false)); refineTexture(TX.glassE, 96, 96, glassHi(true));
  TX.awning = canvasTex(16, 16, (g, W, H) => { for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) P(g, x, y, x % 8 < 4 ? palRGB(PAL.teal) : palRGB(PAL.cream)); }, { nearest: true });
  TX.coin = canvasTex(64, 64, (g, W, H) => {
    g.fillStyle = '#b8862c'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - 31.5, y - 31.5); if (d > 26 && d < 29) P(g, x, y, [140, 96, 30]); else if (d <= 26) P(g, x, y, [232, 186, 84], 1 - (x + y) / 400); }
    // the Calfus "C": a heavy black C whose top end finishes in a teal dot
    const dotX = 31.5 + 12.75 * Math.cos(-.6), dotY = 31.5 + 12.75 * Math.sin(-.6);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - 31.5, dy = y - 31.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d > 8 && d < 17.5 && (a < -1.02 || a > .55)) P(g, x, y, [22, 20, 18]);
      if (Math.hypot(x - dotX, y - dotY) < 5.1) P(g, x, y, [95, 192, 176]);
    }
  });
  // the same coin redrawn smooth at 512 px (the 64 px pixel version above is only the placeholder until applyTextureRefines runs)
  refineTexture(TX.coin, 512, 512, (g, W) => {
    const k = W / 64, c = W / 2, ring = (r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(c, c, r * k, 0, Math.PI * 2); g.fill(); };
    g.fillStyle = '#b8862c'; g.fillRect(0, 0, W, W);
    ring(29, '#8c601e');
    const gold = g.createLinearGradient(0, 0, W, W); gold.addColorStop(0, '#f6cf72'); gold.addColorStop(1, '#d9a23e'); ring(26, gold);
    g.strokeStyle = 'rgba(255,240,190,.55)'; g.lineWidth = 1.2 * k; g.beginPath(); g.arc(c, c, 23.5 * k, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#161412'; g.lineWidth = 9.5 * k; g.beginPath(); g.arc(c, c, 12.75 * k, .55, Math.PI * 2 - 1.02); g.stroke();   // the Calfus "C"
    g.fillStyle = '#5fc0b0'; g.beginPath(); g.arc(c + 12.75 * k * Math.cos(-.6), c + 12.75 * k * Math.sin(-.6), 5.1 * k, 0, Math.PI * 2); g.fill();
    logoOnCoin(g.canvas);
  });
  // the real Calfus "C" (js/models/calfus-c.js, cropped from the wordmark), laid over the drawn one on the smooth coin: its white taken out
  // (each pixel un-blended from white, so the black C and the teal dot keep their colour and soft edges), on a fresh gold face
  let calfusC = null;
  // anyone else who wants the cut-out C (the US office's logo wall): calfusLogo(fn) calls fn with the canvas, now or once it is ready
  const CALFUS_WAIT = []; window.calfusLogo = (fn) => (calfusC ? fn(calfusC) : CALFUS_WAIT.push(fn));
  const logoOnCoin = (cv) => {
    if (!calfusC || !cv || !cv.getContext || cv.width < 256) return false;
    const g = cv.getContext('2d'), W = cv.width, k = W / 64, c = W / 2;
    const gold = g.createLinearGradient(0, 0, W, W); gold.addColorStop(0, '#f6cf72'); gold.addColorStop(1, '#d9a23e');
    g.fillStyle = gold; g.beginPath(); g.arc(c, c, 23 * k, 0, Math.PI * 2); g.fill();
    const h = 30 * k, w = h * calfusC.width / calfusC.height; g.drawImage(calfusC, c - w / 2 - 1.2 * k, c - h / 2, w, h);
    TX.coin.needsUpdate = true; return true;
  };
  if (window.CALFUS_C) { const im = new Image(); im.onload = () => {
    const o = document.createElement('canvas'); o.width = im.width; o.height = im.height; const og = o.getContext('2d'); og.drawImage(im, 0, 0);
    const d = og.getImageData(0, 0, o.width, o.height), p = d.data;
    for (let q = 0; q < p.length; q += 4) { if (p[q + 3] < 255) continue; const a = 255 - Math.min(p[q], p[q + 1], p[q + 2]); for (let r = 0; r < 3; r++) p[q + r] = a ? Math.max(0, Math.min(255, (p[q + r] - (255 - a)) * 255 / a)) : 0; p[q + 3] = a; }   // a see-through pixel is already clear; an opaque one is un-blended from white
    og.putImageData(d, 0, 0); calfusC = o; logoOnCoin(TX.coin.image); CALFUS_WAIT.forEach((f) => f(o)); CALFUS_WAIT.length = 0;
  }; im.src = window.CALFUS_C; }
  TX.coin.center.set(.5, .5); TX.coin.rotation = Math.PI / 2;
  // soft, rounded greenery, drawn smooth. Blade clumps and ferns are NEUTRAL light shapes, tinted per mood by daylight.js (a lighter cousin of the lawn colour, so they read against it); clover and the flower
  // specks carry their own palette colours. Their own little generator, so they draw nothing from decorRandom; the 77 values the old ones took are burnt, so the decor that follows is unchanged.
  for (let i = 0; i < 77; i++) decorRandom();
  let ds = 7919; const dr = (a, b) => a + (ds = (ds * 16807) % 2147483647) / 2147483647 * (b - a);
  // drawn on a 32-unit grid at 64 px; { keep: true } skips softenTextures, whose blur pulls transparent black into a cut-out's edges (grey fringes, thin blades)
  const card = (draw) => canvasTex(64, 64, (g) => { g.scale(2, 2); draw(g, 32, 32); }, { smooth: true, keep: true });
  const disc = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  // a clump of 3-5 broad rounded blades fanning out from one point: pale at the base, bright at the tip
  const clump = (g, W, H, blades, hMin, hMax, spread) => {
    g.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const t = blades > 1 ? i / (blades - 1) - .5 : 0, h = dr(hMin, hMax) * (1 - Math.abs(t) * .35), x0 = W / 2 + t * 4.5, lean = t * spread + dr(-1.5, 1.5);
      const gr = g.createLinearGradient(0, H, 0, H - h); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#ffffff');
      g.strokeStyle = gr; g.lineWidth = dr(7.5, 9.5); g.beginPath(); g.moveTo(x0, H - 4); g.quadraticCurveTo(x0 + lean * .3, H - h * .55, x0 + lean, H - h); g.stroke();
    }
  };
  TX.grassTuft = card((g, W, H) => clump(g, W, H, 3 + (dr(0, 3) | 0), 14, 23, 11));
  TX.fern = card((g, W, H) => {   // three arching fronds with rounded leaflets
    g.fillStyle = '#f4f4f4';
    for (const [lean, s] of [[-9, .9], [0, 1.1], [9, .9]]) for (let k = 1; k <= 6; k++) {
      const t = k / 7, x = 16 + lean * t * t * 1.4, y = H - 2 - 24 * s * t, a = lean * .04 * k;
      for (const side of [-1, 1]) { g.beginPath(); g.ellipse(x + side * 3, y, 3.6 * (1 - t * .5), 1.8, side * .5 + a, 0, 7); g.fill(); }
    }
  });
  // clover: a few three-lobed round leaves in the lighter palette greens, one with a cream bloom
  TX.clover = card((g, W, H) => {
    for (let i = 0; i < 4; i++) {
      const x = 7 + (i % 2) * 14 + dr(-2, 2), y = H - 8 - (i > 1 ? 11 : 0) - dr(0, 3), c = [PAL.leaf, PAL.sage, PAL.mint, PAL.leaf][i];
      for (let k = 0; k < 3; k++) disc(g, x + Math.cos(k * 2.1) * 2.8, y + Math.sin(k * 2.1) * 2.8 - 2, 3.4, c);
      if (i === 1) { g.strokeStyle = PAL.sage; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + 5, H); g.lineTo(x + 5, H - 20); g.stroke(); disc(g, x + 5, H - 20, 3.2, PAL.cream); }
    }
  });
  // tiny round-petalled flowers: cream, blush, butter and lilac, two to a card on pale stems
  TX.flowers = [PAL.cream, PAL.blush, PAL.butter, PAL.lilac].map((pc) => card((g, W, H) => {
    for (let i = 0; i < 2; i++) {
      const x = 10 + i * 12 + dr(-2, 2), top = dr(11, 19);
      g.strokeStyle = PAL.sage; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + dr(-3, 3), (H + top) / 2, x, top); g.stroke();
      disc(g, x + 3, top + 9, 2.4, PAL.leaf);
      for (let k = 0; k < 5; k++) disc(g, x + Math.cos(k * 1.257) * 3, top + Math.sin(k * 1.257) * 3, 2.7, pc);
      disc(g, x, top, 1.9, i ? PAL.cream : PAL.butter);
    }
  }));
  // soft round falloffs for the ground: contact shading (props.js contact(), tinted deep plum by its material) and the warm pools under lamps
  const radial = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };
  TX.contact = radial([[0, .95], [.4, .6], [.75, .18], [1, 0]]); TX.pool = radial([[0, .9], [.35, .55], [.7, .16], [1, 0]]);
  // bushes: a vertical gradient on the sphere's UVs (v is 1 at the top), a lighter palette green on top and a slightly darker underside, so a bush reads as a bush by day and by moonlight
  const mixc = (a, b, t) => palRGB(a).map((v, i) => v + (palRGB(b)[i] - v) * t), rgbArr = (a) => `rgb(${a.map((v) => Math.round(v)).join(',')})`;
  TX.bush = [[mixc(PAL.mint, PAL.cream, .2), PAL.sage, mixc(PAL.leaf, PAL.plum, .34)], [mixc(PAL.sage, PAL.cream, .18), PAL.leaf, mixc(PAL.teal, PAL.plum, .4)], [mixc(PAL.sage, PAL.butter, .42), PAL.leaf, mixc(PAL.leaf, PAL.brown, .32)]].map(([top, mid, under]) => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, rgbArr(top)); gr.addColorStop(.35, rgbArr(top)); gr.addColorStop(.62, typeof mid === 'string' ? rgbArr(palRGB(mid)) : rgbArr(mid)); gr.addColorStop(1, rgbArr(under)); g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
  const blob = document.createElement('canvas'); blob.width = blob.height = 64;
  const bg = blob.getContext('2d'), grd = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); bg.fillStyle = grd; bg.fillRect(0, 0, 64, 64);
  TX.blob = new THREE.CanvasTexture(blob);
  const glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const gg = glow.getContext('2d'), gl = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gl.addColorStop(0, 'rgba(255,214,150,1)'); gl.addColorStop(.55, 'rgba(255,190,120,.35)'); gl.addColorStop(1, 'rgba(255,180,110,0)'); gg.fillStyle = gl; gg.fillRect(0, 0, 64, 64);
  TX.glow = new THREE.CanvasTexture(glow);
}

// the one sign style: a painted pastel panel (the hue from signPaint, see palette.js) in a warm wood frame, with soft rounded lettering in deep brown and a cream highlight under it.
// lines: one string per line. opts.size is the font size to aim for; opts.bg is only a colour hint for which pastel; the old dark edge/ink colours are ignored.
function signTex(lines, hint, w, h, opts = {}) {
  const c = signPaint(hint);
  return canvasTex(w, h, (g) => {
    g.fillStyle = c.frame; g.fillRect(0, 0, w, h);
    if (w < 40 || h < 24) { g.fillStyle = c.board; g.fillRect(1, 1, w - 2, h - 2); return; }   // a blank plate a game paints over itself
    for (let y = 3; y < h - 3; y += 5) { g.fillStyle = 'rgba(255,240,215,.16)'; g.fillRect(0, y, w, 1); }   // soft grain in the frame
    const m = Math.max(3, Math.round(Math.min(w, h) * .09)), r = Math.min((h - 2 * m) * .38, 16), rr = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
    rr(m, m, w - 2 * m, h - 2 * m, r); g.fillStyle = c.board; g.fill();
    g.lineWidth = Math.max(1.5, m * .35); g.strokeStyle = c.rim; g.globalAlpha = .55; rr(m + g.lineWidth / 2, m + g.lineWidth / 2, w - 2 * m - g.lineWidth, h - 2 * m - g.lineWidth, r - 1); g.stroke(); g.globalAlpha = 1;
    const font = opts.font || SIGN_FONT, room = h - 2 * m - 6;
    let fs = Math.min(opts.size ? opts.size * 1.05 : 30, room / lines.length * .8);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = () => { g.font = `600 ${fs}px ${font}`; return Math.max(...lines.map((l) => g.measureText(l).width)); };
    while (fs > 8 && fit() > w - 2 * m - 12) fs -= 1;   // never wider than the panel
    fit();
    lines.forEach((l, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * fs * 1.15 + 1;
      g.fillStyle = 'rgba(255,248,232,.85)'; g.fillText(l, w / 2 + 1, y + 2);   // a cream highlight under the letters: they look puffy, painted
      g.fillStyle = c.ink; g.fillText(l, w / 2, y);
    });
  }, { nearest: false });
}
function textTex(text, opts = {}) { return signTex([text], opts.bg, opts.w || 256, opts.h || 48, opts); }
