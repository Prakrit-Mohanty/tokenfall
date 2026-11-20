// Pixel sprites for the glitch encounters: TOKEN-1 (matching his HUD face in token1-ui.js) and the five glitches.
// Each glitch is a shape mask plus a face; the outline is traced automatically. Browser only: window.EncounterSprites.
(function () {
  const INK = '#1a1420';
  const T1 = { antenna: '#888', tip: '#ffb347', head: '#e8e4dc', neck: '#9a948a', arm: '#c9c2b4', body: '#d8d2c6', foot: '#6a6470', screen: '#122', eye: '#ffd27a', fixed: '#7ff0c0', lampOff: '#4a4452', shine: 'rgba(255,255,255,.35)' };

  const canvas = (w, h, scale) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.style.width = w * scale + 'px'; c.style.height = h * scale + 'px';
    return [c, c.getContext('2d')];
  };

  const token1 = (scale, lit) => {
    const [c, g] = canvas(24, 27, scale);
    const R = [[11, 2, 2, 3, T1.antenna], [10, 0, 4, 2, T1.tip], [4, 5, 16, 11, T1.head], [10, 16, 4, 1, T1.neck], [3, 18, 3, 5, T1.arm], [18, 18, 3, 5, T1.arm], [6, 17, 12, 7, T1.body], [7, 24, 4, 2, T1.foot], [13, 24, 4, 2, T1.foot]];
    R.forEach(([x, y, w, h]) => { g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2); });
    R.forEach(([x, y, w, h, col]) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    g.fillStyle = T1.screen; g.fillRect(6, 7, 12, 7);
    g.fillStyle = lit ? T1.fixed : T1.eye; g.fillRect(8, 9, 2, 2); g.fillRect(14, 9, 2, 2); g.fillRect(10, 12, 4, 1);
    g.fillStyle = lit ? T1.fixed : T1.lampOff; g.fillRect(10, 19, 4, 3);
    g.fillStyle = T1.shine; g.fillRect(5, 6, 3, 1);
    return c;
  };

  const circles = (list) => (x, y) => list.some(([cx, cy, r]) => (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 < r * r);
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const eyes = (g, [lx, rx, y], { pupil, glint, cheek }) => {
    g.fillStyle = pupil; g.fillRect(lx, y, 2, 3); g.fillRect(rx, y, 2, 3);
    g.fillStyle = glint; g.fillRect(lx, y, 1, 1); g.fillRect(rx, y, 1, 1);
    if (cheek) { g.fillStyle = cheek; g.fillRect(lx - 2, y + 3, 2, 1); g.fillRect(rx + 2, y + 3, 2, 1); }
  };

  const GLITCH = {
    fog: { inside: circles([[9, 13, 7], [16, 9, 8], [22, 13, 6.5], [15, 15, 7]]), paint: (x, y) => (y > 15 ? '#b9a8e6' : y < 6 ? '#ffffff' : '#e9e2fb'), line: '#4a3a6e', face: (g) => { eyes(g, [11, 18, 10], { pupil: '#2a2040', glint: '#fff', cheek: '#f4a3b8' }); g.fillStyle = '#2a2040'; g.fillRect(14, 14, 3, 1); g.fillRect(17, 13, 1, 1); } },
    slate: { inside: (x, y) => rect(6, 3, 24, 20)(x, y) && !(x > 19 && y < 3 + (x - 19)), paint: (x, y) => (x > 19 && y < 8 ? '#d8d0bc' : y > 16 ? '#e6dfcc' : '#fbf6e6'), line: '#6b5a48', face: (g) => { g.fillStyle = '#3a3040'; g.fillRect(10, 10, 3, 1); g.fillRect(17, 10, 3, 1); g.fillStyle = '#f4a3b8'; g.fillRect(9, 13, 2, 1); g.fillRect(19, 13, 2, 1); g.fillStyle = '#3a3040'; g.fillRect(13, 14, 4, 1); g.fillStyle = '#c9c0e6'; g.fillRect(8, 5, 6, 1); g.fillRect(16, 17, 5, 1); } },
    loop: { inside: (x, y) => { const d = Math.hypot(x + .5 - 15, y + .5 - 11); return d < 9.5 && d > 4.5; }, paint: (x, y) => (y < 8 ? '#ffd9a0' : y > 14 ? '#e08a3a' : '#ffb347'), line: '#6a3a1a', face: (g) => { eyes(g, [11, 17, 9], { pupil: '#3a2010', glint: '#fff' }); g.fillStyle = '#3a2010'; g.fillRect(14, 13, 2, 1); } },
    pilot: { inside: (x, y) => circles([[15, 13, 7]])(x, y) || rect(4, 4, 26, 6)(x, y) || rect(14, 5, 16, 8)(x, y), paint: (x, y) => (y < 6 ? '#9aa6b8' : y > 16 ? '#3a9a8e' : '#5fe0d0'), line: '#1f3a40', face: (g) => { g.fillStyle = '#10262a'; g.fillRect(10, 10, 10, 5); g.fillStyle = '#ff6a5a'; g.fillRect(12, 12, 2, 1); g.fillRect(16, 12, 2, 1); } },
    tag: { inside: (x, y) => rect(7, 6, 25, 20)(x, y) && !(x < 11 && Math.abs(y + .5 - 13) > x - 6), paint: (x, y) => (y > 16 ? '#e8b84a' : '#ffd27a'), line: '#6a4a1a', face: (g) => { g.fillStyle = '#6a4a1a'; g.fillRect(9, 12, 2, 2); eyes(g, [15, 20, 10], { pupil: '#3a2a10', glint: '#fff', cheek: '#f4a3b8' }); g.fillStyle = '#3a2a10'; g.fillRect(17, 15, 3, 1); g.fillStyle = '#c96a3a'; g.fillRect(2, 13, 6, 1); } },
  };

  const glitch = (kind, scale) => {
    const k = GLITCH[kind] || GLITCH.fog, W = 30, H = 22, [c, g] = canvas(W, H, scale);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (k.inside(x, y)) { g.fillStyle = k.paint(x, y); g.fillRect(x, y, 1, 1); continue; }
      if (near.some(([dx, dy]) => k.inside(x + dx, y + dy))) { g.fillStyle = k.line; g.fillRect(x, y, 1, 1); }
    }
    k.face(g);
    return c;
  };

  window.EncounterSprites = { token1, glitch };
})();
