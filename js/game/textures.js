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
        const v = (rng() - .5) * 34, c = [base[0] + v + (rng() - .5) * 12, base[1] + v, base[2] + v - rng() * 10];
        for (let i = 1; i < sw; i++) for (let j = 1; j < rh; j++) {
          if ((i === 1 || i === sw - 1) && (j === 1 || j === rh - 1)) continue;
          let f = 1;
          if (j === 1 || i === 1) f = 1.16; else if (j === rh - 1 || i === sw - 1) f = .76;
          if (rng() < .1) f *= .9;
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
  TX.cobble = stoneTex([168, 156, 132], [78, 70, 60]);
  TX.flag = refineTexture(stoneTex([150, 146, 140], [70, 66, 62], [10, 14], [10, 18]), 80, 80, (g, W, H) => g.drawImage(stoneTex([150, 146, 140], [70, 66, 62], [12, 18], [12, 22], 80, decorRandom).image, 0, 0));
  TX.stoneWall = stoneTex([138, 132, 122], [60, 56, 52], [6, 9], [9, 16], 32);
  TX.grass = canvasTex(64, 64, (g, W, H) => {
    noiseFill(g, W, H, [104, 122, 84], .08);
    for (let i = 0; i < 40; i++) { const x = rnd() * W | 0, y = rnd() * H | 0, c = rnd() < .5 ? [110, 130, 90] : [94, 112, 74]; P(g, x, y, c); P(g, x, (y + 1) % H, c, .94); }
  });
  TX.darkGrass = canvasTex(64, 64, (g, W, H) => { noiseFill(g, W, H, [86, 108, 66], .09); });
  TX.dirt = canvasTex(32, 32, (g, W, H) => { noiseFill(g, W, H, [120, 92, 64], .25); });
  TX.plaster = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, [222, 214, 196], .07);
    for (let i = 0; i < 6; i++) { let x = rnd() * W | 0, y = rnd() * H | 0; for (let k = 0; k < 4; k++) { P(g, x % W, y % H, [180, 170, 152]); x += rnd() < .5 ? 1 : 0; y++; } }
  });
  TX.wood = canvasTex(32, 32, (g, W, H) => {
    for (let x = 0; x < W; x++) { const plank = (x / 8 | 0), b = [112 + plank % 2 * 10, 74 + plank % 2 * 6, 46]; for (let y = 0; y < H; y++) P(g, x, y, b, x % 8 === 0 ? .62 : 1 + (rnd() - .5) * .1); }
    for (let i = 0; i < 10; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; for (let k = 0; k < 5; k++) P(g, x, (y + k) % H, [80, 52, 32]); }
  });
  TX.darkWood = canvasTex(16, 16, (g, W, H) => { noiseFill(g, W, H, [74, 48, 32], .14); for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x++) if (rnd() < .5) P(g, x, y, [58, 38, 26]); });
  TX.floor = canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) { const row = y / 8 | 0, b = [150 - row % 2 * 14, 108 - row % 2 * 10, 70]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 8 === 0 || (x + row * 11) % 32 === 0 ? .7 : 1 + (rnd() - .5) * .08); }
  });
  TX.roof = canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const col = x % 6, row = y % 8;
      let f = [1.25, 1.1, 1, .9, .7, .5][col];
      if (row === 0) f *= .55; else if (row === 1) f *= 1.15;
      P(g, x, y, [74, 78, 84], f * (1 + (rnd() - .5) * .08));
    }
  });
  TX.lattice = canvasTex(32, 32, (g, W, H) => {
    g.fillStyle = '#2a1d14'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5a3a24';
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 1);
    g.fillStyle = '#7a5032'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2); g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H);
  }, { nearest: true });
  TX.door = canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, [98, 64, 40], .1);
    g.fillStyle = '#3a2416'; g.fillRect(15, 0, 2, H);
    for (const x of [3, 19]) { g.fillStyle = '#4a2e1c'; g.fillRect(x, 3, 10, 26); g.fillStyle = '#6a4630'; for (let yy = 5; yy < 28; yy += 3) g.fillRect(x + 1, yy, 8, 1); }
    g.fillStyle = '#d9b46a'; g.fillRect(13, 16, 2, 2); g.fillRect(17, 16, 2, 2);
  }, { nearest: true });
  TX.cloth = canvasTex(16, 16, (g, W, H) => { for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) P(g, x, y, [150, 52, 40], x % 4 < 2 ? 1 : .86); });
  TX.bark = canvasTex(16, 16, (g, W, H) => { noiseFill(g, W, H, [86, 62, 44], .25); for (let x = 0; x < W; x += 3) for (let y = 0; y < H; y++) if (rnd() < .6) P(g, x, y, [60, 42, 30]); });
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
    g.fillStyle = '#3b2618'; g.fillRect(0, 0, W, H);
    for (let shelf = 0; shelf < 4; shelf++) {
      let x = 1; const y0 = shelf * 8;
      g.fillStyle = '#6a4630'; g.fillRect(0, y0 + 7, W, 1);
      while (x < W - 1) { const w = 1 + (rnd() * 2 | 0), h = 4 + (rnd() * 3 | 0), c = [[140, 50, 40], [50, 80, 120], [180, 150, 80], [60, 110, 70], [120, 80, 140]][rnd() * 5 | 0]; g.fillStyle = rgb(c); g.fillRect(x, y0 + 7 - h, w, h); g.fillStyle = rgb(c, 1.3); g.fillRect(x, y0 + 7 - h, w, 1); x += w + (rnd() < .15 ? 1 : 0); }
    }
  }, { nearest: true });
  TX.rack = canvasTex(16, 32, (g, W, H) => {
    g.fillStyle = '#1b1d24'; g.fillRect(0, 0, W, H);
    for (let y = 2; y < H; y += 4) { g.fillStyle = '#2c303a'; g.fillRect(1, y, W - 2, 3); g.fillStyle = rnd() < .5 ? '#ffb347' : '#6ee07a'; g.fillRect(2, y + 1, 1, 1); g.fillStyle = '#ffb347'; if (rnd() < .5) g.fillRect(4, y + 1, 1, 1); }
  }, { nearest: true });
  TX.screen = canvasTex(32, 20, (g, W, H) => {
    g.fillStyle = '#0d2a36'; g.fillRect(0, 0, W, H);
    for (let y = 2; y < H - 1; y += 2) { const x0 = 2 + (rnd() * 4 | 0); g.fillStyle = rnd() < .3 ? '#ffd27a' : '#7fe6ff'; g.fillRect(x0, y, 4 + (rnd() * 20 | 0), 1); }
  }, { nearest: true });
  TX.paver = refineTexture(canvasTex(64, 64, (g, W, H) => {
    g.fillStyle = rgb([128, 122, 112]); g.fillRect(0, 0, W, H);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const x0 = c * 16 + (r % 2) * 8, y0 = r * 8, v = (rnd() - .5) * 16, b = [182 + v, 174 + v, 160 + v - rnd() * 8];
      for (let i = 1; i < 16; i++) for (let j = 1; j < 8; j++) { const x = x0 + i; if (x < 0 || x >= W) continue; P(g, x, y0 + j, b, (j === 1 ? 1.05 : j === 7 ? .9 : 1) * (1 + (rnd() - .5) * .05)); }
    }
  }), 96, 96, (g, W, H) => {
    g.fillStyle = rgb([128, 122, 112]); g.fillRect(0, 0, W, H);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const x0 = c * 24 + (r % 2) * 12, y0 = r * 12, v = (decorRandom() - .5) * 16, b = [182 + v, 174 + v, 160 + v - decorRandom() * 8];
      for (let i = 1; i < 24; i++) for (let j = 1; j < 12; j++) { const x = x0 + i; if (x < 0 || x >= W) continue; P(g, x, y0 + j, b, (j === 1 ? 1.06 : j === 11 ? .88 : i === 1 ? 1.03 : i === 23 ? .94 : 1) * (1 + (decorRandom() - .5) * .05)); }
    }
  });
  TX.concrete = refineTexture(canvasTex(32, 32, (g, W, H) => {
    noiseFill(g, W, H, [196, 192, 184], .06);
    g.fillStyle = rgb([172, 168, 160]); g.fillRect(0, 15, W, 1); g.fillRect(15, 0, 1, H);
    for (const [x, y] of [[7, 7], [23, 7], [7, 23], [23, 23]]) P(g, x, y, [140, 136, 130]);
  }), 48, 48, (g, W, H) => {
    noiseFill(g, W, H, [196, 192, 184], .06, 1, decorRandom);
    for (let i = 0; i < 40; i++) P(g, decorRandom() * W | 0, decorRandom() * H | 0, [176, 172, 164]);
    g.fillStyle = rgb([172, 168, 160]); g.fillRect(0, 23, W, 1); g.fillRect(23, 0, 1, H);
    for (const [x, y] of [[11, 11], [35, 11], [11, 35], [35, 35]]) P(g, x, y, [140, 136, 130]);
  });
  TX.cladding = refineTexture(canvasTex(32, 32, (g, W, H) => {
    for (let y = 0; y < H; y++) { const sl = y / 4 | 0, b = [[168, 116, 72], [150, 102, 62], [176, 124, 78]][sl % 3]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 4 === 3 ? .55 : 1 + (rnd() - .5) * .08); }
  }), 48, 48, (g, W, H) => {
    for (let y = 0; y < H; y++) { const sl = y / 6 | 0, b = [[168, 116, 72], [150, 102, 62], [176, 124, 78]][sl % 3]; for (let x = 0; x < W; x++) P(g, x, y, b, y % 6 === 5 ? .55 : y % 6 === 0 ? 1.08 : 1 + (decorRandom() - .5) * .08); }
    for (let i = 0; i < 30; i++) { const x = decorRandom() * W | 0, y = decorRandom() * H | 0; P(g, x, y, [120, 80, 50]); P(g, (x + 1) % W, y, [120, 80, 50]); }
  });
  TX.roofFlat = refineTexture(canvasTex(32, 32, (g, W, H) => { noiseFill(g, W, H, [124, 122, 118], .1); g.fillStyle = rgb([104, 102, 98]); g.fillRect(0, 0, W, 1); g.fillRect(0, 16, W, 1); }),
    64, 64, (g, W, H) => { noiseFill(g, W, H, [124, 122, 118], .1, 1, decorRandom); g.fillStyle = rgb([104, 102, 98]); g.fillRect(0, 0, W, 1); g.fillRect(0, 32, W, 1); g.fillStyle = rgb([138, 136, 130]); g.fillRect(0, 1, W, 1); g.fillRect(0, 33, W, 1); });
  // curtain-wall glass: some panes reflect the sky, some show warm lit offices
  const lit = Array.from({ length: 4 }, () => Array.from({ length: 2 }, () => rnd() < .45));
  const glass = (emissive) => canvasTex(32, 32, (g, W, H) => {
    g.fillStyle = emissive ? '#000' : '#363a42'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x0 = c * 8 + 1, y0 = r * 16 + 1, on = lit[c][r];
      for (let j = 0; j < 14; j++) for (let i = 0; i < 7; i++) {
        let col;
        if (on) col = j > 9 ? [120, 92, 66] : [255, 214, 150];
        else { const t = j / 14; col = [150 - t * 60, 176 - t * 66, 196 - t * 66]; if ((i + j) % 9 === 0 || (i + j) % 9 === 1) col = col.map(v => v + 30); }
        if (emissive) col = on && j <= 9 ? [255, 190, 120] : [0, 0, 0];
        P(g, x0 + i, y0 + j, col);
      }
      if (!emissive) { g.fillStyle = '#4a4f58'; g.fillRect(x0, y0 + 10, 7, 1); }
    }
  }, { nearest: true });
  TX.glass = glass(false); TX.glassE = glass(true);
  const glassHi = (emissive) => (g, W, H) => {
    g.fillStyle = emissive ? '#000' : '#363a42'; g.fillRect(0, 0, W, H);
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
      if (!emissive) { g.fillStyle = '#4a4f58'; g.fillRect(x0, y0 + 30, 21, 2); }
    }
  };
  refineTexture(TX.glass, 96, 96, glassHi(false)); refineTexture(TX.glassE, 96, 96, glassHi(true));
  TX.awning = canvasTex(16, 16, (g, W, H) => { for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) P(g, x, y, x % 8 < 4 ? [46, 120, 112] : [236, 226, 204]); }, { nearest: true });
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
  }, { nearest: true });
  TX.coin.center.set(.5, .5); TX.coin.rotation = Math.PI / 2;
  // soft, rounded greenery: curved blades, clover and round-petalled flowers, drawn smooth (decorRandom keeps the layout's rnd() sequence still)
  const dr = (a, b) => a + decorRandom() * (b - a);
  TX.grassTuft = canvasTex(32, 32, (g, W, H) => {
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 3 + dr(-1, 1), h = dr(10, 26), lean = dr(-5, 5);
      g.strokeStyle = ['#7fa05a', '#8fb066', '#6e9150', '#9bba72'][i % 4]; g.lineWidth = dr(1.8, 2.6);
      g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * .2, H - h * .6, x + lean, H - h); g.stroke();
    }
  }, { smooth: true });
  TX.clover = canvasTex(32, 32, (g, W, H) => {
    const disc = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    for (let i = 0; i < 7; i++) {
      const x = 5 + (i % 4) * 7 + dr(-2, 2), y = H - 5 - (i > 3 ? 8 : 0) - dr(0, 4), c = ['#86a864', '#6f9a58', '#98b672'][i % 3];
      for (let k = 0; k < 3; k++) disc(x + Math.cos(k * 2.1) * 2.6, y + Math.sin(k * 2.1) * 2.6 - 2, 3, c);
      if (i % 3 === 0) disc(x + 1, y - 7, 2.4, '#f4ecd8');
    }
  }, { smooth: true });
  TX.flowers = [[214, 116, 104], [240, 232, 214], [238, 206, 126], [172, 146, 208]].map(pc => canvasTex(32, 32, (g, W, H) => {
    const disc = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    for (let i = 0; i < 3; i++) {
      const x = 7 + i * 9 + dr(-2, 2), top = dr(7, 16);
      g.strokeStyle = '#7fa05a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + dr(-3, 3), (H + top) / 2, x, top); g.stroke();
      disc(x + 3, top + 10, 2.2, '#86a864');
      for (let k = 0; k < 5; k++) disc(x + Math.cos(k * 1.257) * 3, top + Math.sin(k * 1.257) * 3, 2.5, rgb(pc, k % 2 ? .95 : 1.05));
      disc(x, top, 1.8, '#f6d672');
    }
  }, { smooth: true }));
  const blob = document.createElement('canvas'); blob.width = blob.height = 64;
  const bg = blob.getContext('2d'), grd = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); bg.fillStyle = grd; bg.fillRect(0, 0, 64, 64);
  TX.blob = new THREE.CanvasTexture(blob);
  const glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const gg = glow.getContext('2d'), gl = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gl.addColorStop(0, 'rgba(255,214,150,1)'); gl.addColorStop(.55, 'rgba(255,190,120,.35)'); gl.addColorStop(1, 'rgba(255,180,110,0)'); gg.fillStyle = gl; gg.fillRect(0, 0, 64, 64);
  TX.glow = new THREE.CanvasTexture(glow);
}

function textTex(text, opts = {}) {
  const w = opts.w || 256, h = opts.h || 48;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opts.bg || '#6b4528'; g.fillRect(0, 0, w, h);
    g.fillStyle = opts.edge || '#3c2414'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 6; y < h - 4; y += 6) g.fillRect(4, y, w - 8, 1);
    g.font = `600 ${opts.size ? opts.size * 1.05 : 25}px "DM Sans", "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(text, w / 2 + 2, h / 2 + 3);
    g.fillStyle = opts.color || '#f6e3b4'; g.fillText(text, w / 2, h / 2 + 1);
  }, { nearest: false });
}
