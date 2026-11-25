// TokenFall: the full-screen map of the lobby, opened with E at the map board (lobby-village.js vLobbyMap). A hand-illustrated isometric park map:
// a grassy island with layered cliffs floating in a soft sea, winding sandy paths, a tiled plaza with a tiered fountain, the river and its bridge,
// HQ, Token Brew, the homes, the pond, the games lawn, and the three gates: stone archways holding swirling portals. Beyond each portal a card
// with a little preview says where it leads. White badges with drawn pictograms mark what is where, the legend explains them, a pin shows you.
// Drawn once as one inline SVG; E, Esc or a click closes it. Classic script: shares one global scope with the other js/game files.
(() => {
  const S = 6, OX = 660, OY = 335;                               // map units (world metres) to SVG px, and where the plaza's centre lands
  const iso = (x, z, y = 0) => [OX + (x - z) * .866 * S, OY + (x + z) * .5 * S - y * S];
  const f1 = (v) => +v.toFixed(1);
  const pt = (p) => f1(p[0]) + ',' + f1(p[1]);
  const poly = (ps, fill, extra = '') => `<polygon points="${ps.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c})`; };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // a smooth (Catmull-Rom) curve through screen points
  const smooth = (P, closed) => {
    const n = P.length, g = (i) => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
    let d = 'M' + pt(P[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
    }
    return d + (closed ? 'Z' : '');
  };
  const wpath = (W, y = 0) => smooth(W.map((p) => iso(p[0], p[1], y)), false);
  // boxes: the top and the two faces that look at the viewer (east = +x, south = +z)
  const fS = (z, xa, xb, ya, yb) => [iso(xa, z, ya), iso(xb, z, ya), iso(xb, z, yb), iso(xa, z, yb)];
  const fE = (x, za, zb, ya, yb) => [iso(x, za, ya), iso(x, zb, ya), iso(x, zb, yb), iso(x, za, yb)];
  const box = (x0, z0, x1, z1, h, col, top, y0 = 0, line = true) => {
    const st = line ? 'stroke="rgba(40,30,20,.35)" stroke-width="1" stroke-linejoin="round"' : '';
    return poly(fE(x1, z0, z1, y0, h), shade(col, .8), st) + poly(fS(z1, x0, x1, y0, h), shade(col, .62), st) +
      poly([iso(x0, z0, h), iso(x1, z0, h), iso(x1, z1, h), iso(x0, z1, h)], top || shade(col, 1.1), st);
  };
  const ell = (x, z, rx, rz, fill, extra = '', y = 0) => { const [cx, cy] = iso(x, z, y); return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx * S * 1.22)}" ry="${f1(rz * S * .7)}" fill="${fill}" ${extra}/>`; };
  const shadowAt = (x, z, r) => ell(x + .6, z + .6, r, r, 'rgba(30,60,10,.22)');

  // ---------- sprites: everything that stands up, painted back to front ----------
  const SP = []; const add = (d, s) => SP.push({ d, s });
  const roundTree = (x, z, k = 1) => { const [cx, cy] = iso(x, z), c = ['#2f7d32', '#3f9a3a', '#5cb848', '#8bd35e'];
    return shadowAt(x, z, 1.8 * k) + `<path d="M${f1(cx - 1.6)} ${f1(cy)}l.6 ${f1(-12 * k)}h2l.6 ${f1(12 * k)}z" fill="#7a4e2a"/>` +
      `<circle cx="${f1(cx)}" cy="${f1(cy - 19 * k)}" r="${f1(11 * k)}" fill="${c[0]}"/><circle cx="${f1(cx - 4 * k)}" cy="${f1(cy - 22 * k)}" r="${f1(8 * k)}" fill="${c[1]}"/>` +
      `<circle cx="${f1(cx + 4 * k)}" cy="${f1(cy - 24 * k)}" r="${f1(6.5 * k)}" fill="${c[2]}"/><circle cx="${f1(cx - 3 * k)}" cy="${f1(cy - 27 * k)}" r="${f1(3.5 * k)}" fill="${c[3]}"/>`; };
  const conifer = (x, z, k = 1) => { const [cx, cy] = iso(x, z);
    let s = shadowAt(x, z, 1.4 * k) + `<rect x="${f1(cx - 1.5)}" y="${f1(cy - 8 * k)}" width="3" height="${f1(8 * k)}" fill="#6b4426"/>`;
    for (let i = 0; i < 3; i++) { const b = cy - 6 * k - i * 8 * k, w = (11 - i * 2.6) * k;
      s += `<path d="M${f1(cx - w)} ${f1(b)}L${f1(cx)} ${f1(b - 15 * k)}L${f1(cx + w)} ${f1(b)}z" fill="#2e7a45"/><path d="M${f1(cx)} ${f1(b - 15 * k)}L${f1(cx + w)} ${f1(b)}H${f1(cx)}z" fill="#25653a"/>`; }
    return s; };
  const palm = (x, z, k = 1) => { const [cx, cy] = iso(x, z), tx = cx + 5 * k, ty = cy - 30 * k;
    let s = shadowAt(x, z, 1.8 * k) + `<path d="M${f1(cx)} ${f1(cy)}Q${f1(cx - 2 * k)} ${f1(cy - 16 * k)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="#8b5e34" stroke-width="${f1(3.4 * k)}" stroke-linecap="round" stroke-dasharray="3 1.2"/>`;
    for (const [a, l, c] of [[-160, 15, '#2f8a3a'], [-20, 15, '#2f8a3a'], [-120, 13, '#4daa45'], [-60, 13, '#4daa45'], [-90, 9, '#6cc24f'], [150, 11, '#3d9a3d'], [30, 11, '#3d9a3d']]) {
      const r = a * Math.PI / 180, ex = tx + Math.cos(r) * l * k, ey = ty + Math.sin(r) * l * k + 6 * k;
      s += `<path d="M${f1(tx)} ${f1(ty)}Q${f1((tx + ex) / 2 - Math.sin(r) * 4 * k)} ${f1((ty + ey) / 2 - 6 * k)} ${f1(ex)} ${f1(ey)}Q${f1((tx + ex) / 2)} ${f1((ty + ey) / 2 - 1)} ${f1(tx)} ${f1(ty)}z" fill="${c}"/>`; }
    return s + `<circle cx="${f1(tx)}" cy="${f1(ty + 1)}" r="${f1(2 * k)}" fill="#6b4426"/>`; };
  const bush = (x, z, k = 1, flower) => { const [cx, cy] = iso(x, z);
    let s = `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(9 * k)}" ry="${f1(3.5 * k)}" fill="rgba(30,60,10,.2)"/><circle cx="${f1(cx - 4 * k)}" cy="${f1(cy - 4 * k)}" r="${f1(5 * k)}" fill="#3d9a3a"/><circle cx="${f1(cx + 4 * k)}" cy="${f1(cy - 4 * k)}" r="${f1(5 * k)}" fill="#3d9a3a"/><circle cx="${f1(cx)}" cy="${f1(cy - 7 * k)}" r="${f1(5.5 * k)}" fill="#5cb848"/>`;
    if (flower) for (const [dx, dy] of [[-4, -6], [2, -10], [5, -5], [-1, -3]]) s += `<circle cx="${f1(cx + dx * k)}" cy="${f1(cy + dy * k)}" r="${f1(1.5 * k)}" fill="${flower}"/>`;
    return s; };
  const lamp = (x, z) => { const [cx, cy] = iso(x, z); return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="4" ry="2" fill="rgba(0,0,0,.2)"/><rect x="${f1(cx - 1)}" y="${f1(cy - 24)}" width="2" height="24" fill="#3b3f4a"/><circle cx="${f1(cx)}" cy="${f1(cy - 26)}" r="3.6" fill="#fff4b8" stroke="#3b3f4a" stroke-width="1.2"/><circle cx="${f1(cx)}" cy="${f1(cy - 26)}" r="7" fill="#fff4b8" opacity=".35"/>`; };
  const bench = (x, z, alongX = true) => alongX ? box(x - 1.2, z - .3, x + 1.2, z + .3, .7, '#a5693a') + box(x - 1.2, z - .45, x + 1.2, z - .3, 1.4, '#8a5530') : box(x - .3, z - 1.2, x + .3, z + 1.2, .7, '#a5693a') + box(x - .45, z - 1.2, x - .3, z + 1.2, 1.4, '#8a5530');
  const person = (x, z, col, skin = '#f2c9a0') => { const [cx, cy] = iso(x, z); return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="3.5" ry="1.6" fill="rgba(0,0,0,.25)"/><rect x="${f1(cx - 2.6)}" y="${f1(cy - 9)}" width="5.2" height="8" rx="2.4" fill="${col}"/><circle cx="${f1(cx)}" cy="${f1(cy - 11.5)}" r="2.6" fill="${skin}"/>`; };
  const umbrella = (x, z, col) => { const [cx, cy] = iso(x, z);
    return ell(x, z, 1.4, 1.4, '#b07a4a', '', .8) + `<rect x="${f1(cx - .8)}" y="${f1(cy - 20)}" width="1.6" height="20" fill="#5a4636"/>` +
      `<path d="M${f1(cx - 12)} ${f1(cy - 14)}Q${f1(cx)} ${f1(cy - 30)} ${f1(cx + 12)} ${f1(cy - 14)}Z" fill="${col}"/><path d="M${f1(cx - 4)} ${f1(cy - 15.5)}Q${f1(cx)} ${f1(cy - 30)} ${f1(cx + 4)} ${f1(cy - 15.5)}Z" fill="#fff"/>`; };
  // a cottage: walls, a pitched roof (ridge along x), door, windows, chimney
  const cottage = (x0, z0, x1, z1, wall, roof) => {
    const h = 3.2, rh = 2.6, zm = (z0 + z1) / 2, o = .5;
    let s = shadowAt((x0 + x1) / 2 + 1, (z0 + z1) / 2 + 1, 4) + box(x0, z0, x1, z1, h, wall);
    s += poly(fS(z1, x0 + .7, x0 + 1.9, 0, 2.2), '#7a4a2a') + poly(fS(z1, x0 + 2.6, x0 + 4, 1, 2.3), '#bfe4f5', 'stroke="#fff" stroke-width="1.2"');
    if (x1 - x0 > 5.5) s += poly(fS(z1, x1 - 1.9, x1 - .6, 1, 2.3), '#bfe4f5', 'stroke="#fff" stroke-width="1.2"');
    s += poly(fE(x1, zm - .7, zm + .7, 1, 2.2), '#bfe4f5', 'stroke="#fff" stroke-width="1.2"');
    s += box(x0 + 1, z0 + .6, x0 + 1.9, z0 + 1.5, h + rh + 1.2, '#a8553a', '#5a2f22');
    s += poly([iso(x1 + o, z0 - o, h), iso(x1 + o, z1 + o, h), iso(x1 + o, zm, h + rh)], shade(wall, .9), 'stroke="rgba(40,30,20,.35)" stroke-width="1"');
    s += poly([iso(x0 - o, z1 + o, h - .2), iso(x1 + o, z1 + o, h - .2), iso(x1 + o, zm, h + rh), iso(x0 - o, zm, h + rh)], roof, 'stroke="rgba(40,30,20,.4)" stroke-width="1"');
    for (let i = 1; i < 4; i++) { const t = i / 4; s += `<path d="M${pt(iso(x0 - o, z1 + o - t * (z1 + o - zm), h - .2 + t * (rh + .2)))}L${pt(iso(x1 + o, z1 + o - t * (z1 + o - zm), h - .2 + t * (rh + .2)))}" stroke="${shade(roof.startsWith('#') ? roof : '#c0503a', .8)}" stroke-width="1.2"/>`; }
    s += `<path d="M${pt(iso(x0 - o, zm, h + rh))}L${pt(iso(x1 + o, zm, h + rh))}" stroke="${shade(roof, .7)}" stroke-width="2.4" stroke-linecap="round"/>`;
    return s;
  };
  // a ring of points standing upright: in the plane x = const ('x') or z = const ('z')
  const upright = (x, z, cy, r, axis, n = 28) => { const P = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, u = Math.cos(t) * r, v = cy + Math.sin(t) * r * 1.05; P.push(axis === 'x' ? iso(x, z + u, v) : iso(x + u, z, v)); } return P; };
  // a gate: two stone pillars and an arch across the road, holding a swirling portal; axis 'x' when the road runs along x
  const gate = (x, z, axis, col, id) => {
    const at = (u, y) => axis === 'x' ? iso(x, z + u, y) : iso(x + u, z, y);
    const pil = (u) => axis === 'x' ? box(x - .9, z + u - .9, x + .9, z + u + .9, 8, '#c9c3b6', '#e6e1d6') + box(x - 1.2, z + u - 1.2, x + 1.2, z + u + 1.2, .8, '#a59f92') + box(x - 1.1, z + u - 1.1, x + 1.1, z + u + 1.1, 8.6, '#b5ae9f', '#ece7dc', 8)
      : box(x + u - .9, z - .9, x + u + .9, z + .9, 8, '#c9c3b6', '#e6e1d6') + box(x + u - 1.2, z - 1.2, x + u + 1.2, z + 1.2, .8, '#a59f92') + box(x + u - 1.1, z - 1.1, x + u + 1.1, z + 1.1, 8.6, '#b5ae9f', '#ece7dc', 8);
    const arch = []; for (let i = 0; i <= 16; i++) { const u = -4.6 + i / 16 * 9.2; arch.push(at(u, 8.4 + 1.8 * (1 - (u / 4.6) ** 2))); }
    const ad = smooth(arch, false), ring = upright(x, z, 4.4, 3.5, axis), mid = upright(x, z, 4.4, 2.5, axis), inner = upright(x, z, 4.4, 1.4, axis), c = at(0, 4.4);
    let s = ell(x, z, 6.5, 6.5, col, 'class="wm-glow" opacity=".35"') + ell(x, z, 4, 4, '#fff', 'opacity=".45"');
    const back = axis === 'x' ? -4.6 : -4.6;
    s += pil(back);
    s += `<path d="${smooth(ring, true)}" fill="url(#pg-${id})" class="wm-glow"/>`;
    s += `<path d="${smooth(mid, true)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="10 7" stroke-linecap="round" class="wm-swirl" opacity=".9"/>`;
    s += `<path d="${smooth(inner, true)}" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="6 5" stroke-linecap="round" class="wm-swirl r" opacity=".85"/>`;
    s += `<path d="${smooth(ring, true)}" fill="none" stroke="${col}" stroke-width="5"/><path d="${smooth(ring, true)}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>`;
    s += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="3" fill="#fff" class="wm-spark"/>`;
    for (let i = 0; i < 5; i++) { const a = i * 1.3, p = at(Math.cos(a) * 4.4, 4.4 + Math.sin(a) * 4.6); s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${1.4 + (i % 2)}" fill="${col}" class="wm-spark" style="animation-delay:${(i * .37).toFixed(2)}s"/>`; }
    s += pil(-back);
    s += `<path d="${ad}" fill="none" stroke="#8d8676" stroke-width="13" stroke-linecap="round"/><path d="${ad}" fill="none" stroke="#d8d2c4" stroke-width="9" stroke-linecap="round"/><path d="${ad}" fill="none" stroke="#efeadf" stroke-width="3" stroke-linecap="round" transform="translate(0,-2.5)"/>`;
    const k = at(0, 10.2); s += `<rect x="${f1(k[0] - 7)}" y="${f1(k[1] - 7)}" width="14" height="13" rx="3" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    return s;
  };
  // glyphs: black pictograms on the white badges (and the legend)
  const G = {
    hq: '<path d="M4 21V5l8-3v19zM13 21V8h7v13z"/><path fill="#fff" d="M6 6.5h1.7v1.7H6zM9 6.5h1.7v1.7H9zM6 10.5h1.7v1.7H6zM9 10.5h1.7v1.7H9zM6 14.5h1.7v1.7H6zM9 14.5h1.7v1.7H9zM15 10.5h1.7v1.7H15zM15 14.5h1.7v1.7H15zM17.6 10.5h1v1.7h-1zM17.6 14.5h1v1.7h-1z"/>',
    fountain: '<path d="M2.5 15h19l-2 5.5h-15z"/><path d="M11 15V9.5h2V15z"/><path d="M6.5 9h11l-1.8 2.2H8.3z"/><path d="M12 2.5C9 4 8 5.5 7.6 7.5M12 2.5c3 1.5 4 3 4.4 5" fill="none" stroke="#222" stroke-width="1.7" stroke-linecap="round"/>',
    cup: '<path d="M4 9h13v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10.5h1.2a2.6 2.6 0 0 1 0 5.2H16.4" fill="none" stroke="#222" stroke-width="2"/><path d="M8.5 2.5c-1.2 1.5 1.2 2.2 0 4M12.5 2.5c-1.2 1.5 1.2 2.2 0 4" fill="none" stroke="#222" stroke-width="1.6" stroke-linecap="round"/><rect x="3" y="20.3" width="15" height="1.8" rx=".9"/>',
    tower: '<path d="M4 18.5h16v3H4zM4 14.5h4.6v3H4zM9.7 14.5h4.6v3H9.7zM15.4 14.5H20v3h-4.6zM5.5 10.5h13v3h-13zM6.5 6.5h5v3h-5zM12.5 6.5h5v3h-5zM8.5 2.5h7v3h-7z"/>',
    target: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="#222" stroke-width="2.2"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#222" stroke-width="2.2"/><circle cx="12" cy="12" r="2"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3.2 3.2 0 0 0 3.2 3.2M17 5h3v2a3.2 3.2 0 0 1-3.2 3.2" fill="none" stroke="#222" stroke-width="1.8"/><path d="M11 13.5h2v4h-2zM7.5 18h9v3.2h-9z"/>',
    home: '<path d="M12 2.8l9.5 8.4h-2.8v10H5.3v-10H2.5z"/><path fill="#fff" d="M10 14.5h4v6.7h-4z"/>',
    duck: '<circle cx="8" cy="7" r="3.6"/><path d="M1.6 7.6l3.2-1.4v2.8z"/><path d="M4.5 13.5c0-2 2-3.3 4-3.3h3c3 0 5.5-1 8.5-3.3 1.2 6.5-3 13-9.5 13-4 0-6-3-6-6.4z"/><circle cx="7" cy="6.2" r="1" fill="#fff"/>',
    portal: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="#222" stroke-width="2.2"/><path d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2 4 4 0 0 1-4 4 2.6 2.6 0 0 1-2.6-2.6 1.3 1.3 0 0 1 1.3-1.3" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>',
    board: '<path d="M2.5 3.5h19v12h-19z"/><path d="M6 17h2v5H6zM16 17h2v5h-2z"/><path fill="#fff" d="M5 12h3v1.8H5zM9.5 9h3v4.8h-3zM14 6h3v7.8h-3z"/>',
    pin: '<path d="M12 22s-7-7.4-7-12.4a7 7 0 0 1 14 0C19 14.6 12 22 12 22z" fill="#e8322a"/><circle cx="12" cy="9.5" r="2.8" fill="#fff"/>',
  };
  const badge = (x, z, y, g) => { const [cx, cy] = iso(x, z, y);
    return `<g transform="translate(${f1(cx)},${f1(cy)})"><ellipse cx="0" cy="1" rx="6" ry="2.4" fill="rgba(0,0,0,.25)"/><path d="M-6 -16L0 0L6 -16z" fill="#fff" stroke="#2b2b33" stroke-width="2" stroke-linejoin="round"/>` +
      `<circle cy="-32" r="17.5" fill="#fff" stroke="#2b2b33" stroke-width="2.2"/><path d="M-5.5 -16.5h11" stroke="#fff" stroke-width="3"/><use xlink:href="#g-${g}" x="-11.5" y="-43.5" width="23" height="23"/></g>`; };
  const pill = (x, z, y, text, col) => { const [cx, cy] = iso(x, z, y); const w = text.length * 9 + 30;
    return `<g><rect x="${f1(cx - w / 2)}" y="${f1(cy - 14)}" width="${f1(w)}" height="28" rx="14" fill="${col}" stroke="#fff" stroke-width="3"/><path d="M${f1(cx - 6)} ${f1(cy + 15)}L${f1(cx)} ${f1(cy + 22)}L${f1(cx + 6)} ${f1(cy + 15)}z" fill="#fff"/>` +
      `<text x="${f1(cx)}" y="${f1(cy + 6)}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" letter-spacing=".3">${text}</text></g>`; };
  const name = (x, z, y, text, size = 13) => { const [cx, cy] = iso(x, z, y); return `<text x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" font-size="${size}" font-weight="700" fill="#2f3b22" stroke="#fff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${text}</text>`; };

  // ---------- the cards beyond the portals, each with a little illustrated preview ----------
  const pvPlane = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="70" fill="#9fd8f5"/><circle cx="${x + w - 30}" cy="${y + 20}" r="11" fill="#ffe27a"/>` +
    `<g fill="#fff"><ellipse cx="${x + 40}" cy="${y + 52}" rx="26" ry="9"/><ellipse cx="${x + 58}" cy="${y + 46}" rx="16" ry="10"/><ellipse cx="${x + w - 60}" cy="${y + 58}" rx="30" ry="8"/></g>` +
    `<path d="M${x + 10} ${y + 62}Q${x + 80} ${y + 30} ${x + 130} ${y + 30}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>` +
    `<g transform="translate(${x + 140},${y + 28}) rotate(-12)"><path d="M-20 0h34a6 4 0 0 1 0 8h-34z" fill="#fff" stroke="#3b4a5a" stroke-width="1.4"/><path d="M-4 1l-8-14h6l12 14z" fill="#f0a030"/><path d="M-4 7l-8 12h6l12-12z" fill="#e08a20"/><path d="M-20 0l-5-9h5l6 9z" fill="#f0a030"/><circle cx="2" cy="4" r="1.2" fill="#3b4a5a"/><circle cx="7" cy="4" r="1.2" fill="#3b4a5a"/><circle cx="-3" cy="4" r="1.2" fill="#3b4a5a"/></g>` +
    `<path d="M${x} ${y + 70}h${w}v-6l-30 -6l-30 6l-40-4l-40 4l-50-6l-40 6z" fill="#7cc04a"/>`;
  const pvCity = (x, y, w) => { let s = `<rect x="${x}" y="${y}" width="${w}" height="70" fill="#ffd9a8"/><circle cx="${x + 40}" cy="${y + 50}" r="20" fill="#ffb36b"/>`;
    const B = [[8, 34, '#6b7fa8'], [30, 50, '#4f6390'], [56, 30, '#7d90b8'], [76, 58, '#3d5080'], [102, 40, '#5f74a0'], [124, 26, '#7d90b8'], [146, 52, '#4f6390'], [172, 36, '#6b7fa8'], [196, 46, '#3d5080']];
    for (const [bx, bh, c] of B) { if (bx + 22 > w) break; s += `<rect x="${x + bx}" y="${y + 70 - bh}" width="20" height="${bh}" fill="${c}"/>`; for (let r = y + 74 - bh; r < y + 64; r += 7) s += `<rect x="${x + bx + 4}" y="${r}" width="3" height="3" fill="#ffe9a0"/><rect x="${x + bx + 12}" y="${r}" width="3" height="3" fill="#ffe9a0" opacity=".6"/>`; }
    return s + `<path d="M${x + 87} ${y + 12}v-8" stroke="#3d5080" stroke-width="2"/><circle cx="${x + 87}" cy="${y + 4}" r="2" fill="#e8322a"/>`; };
  const pvGlass = (x, y, w) => { let s = `<rect x="${x}" y="${y}" width="${w}" height="70" fill="#2b2f4a"/><path d="M${x} ${y + 70}L${x + 30} ${y + 30}L${x + 10} ${y}H${x}z" fill="#4a4f6e"/><path d="M${x + w} ${y + 70}L${x + w - 30} ${y + 30}L${x + w - 10} ${y}H${x + w}z" fill="#4a4f6e"/>`;
    for (let i = 0; i < 5; i++) for (const r of [0, 1]) { const tx = x + 34 + i * 34, ty = y + 18 + r * 24, bad = (i + r) % 3 === 1;
      s += `<path d="M${tx} ${ty}l14 -7l14 7l-14 7z" fill="${bad ? 'rgba(160,220,255,.35)' : 'rgba(190,235,255,.9)'}" stroke="#fff" stroke-width="1.2"/>`; }
    return s + `<g transform="translate(${x + 82},${y + 34})"><rect x="-3" y="-12" width="6" height="9" rx="3" fill="#e8322a"/><circle cx="0" cy="-15" r="3" fill="#f2c9a0"/></g>`; };
  const card = (x, y, w, port, col, title, pv, rows) => {
    const h = 44 + 82 + rows.length * 26 + 10, [ax, ay] = port, cxm = x + w / 2;
    const tx = ax < x ? x : ax > x + w ? x + w : cxm, ty = ax < x || ax > x + w ? y + h / 2 : (ay < y ? y : y + h);
    let s = `<path d="M${f1(ax)} ${f1(ay)}Q${f1((ax + tx) / 2)} ${f1(Math.min(ay, ty) - 40)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M${f1(ax)} ${f1(ay)}Q${f1((ax + tx) / 2)} ${f1(Math.min(ay, ty) - 40)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="${col}" stroke-width="3.5" stroke-dasharray="1 9" stroke-linecap="round" class="wm-flow"/>`;
    s += `<g><rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="18" fill="rgba(20,50,70,.25)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fffaf0" stroke="${col}" stroke-width="3.5"/>` +
      `<path d="M${x + 18} ${y}h${w - 36}a18 18 0 0 1 18 18v22h-${w}v-22a18 18 0 0 1 18 -18z" fill="${col}"/>` +
      `<g transform="translate(${x + 12},${y + 8})"><circle cx="12" cy="12" r="12" fill="#fff"/><use xlink:href="#g-portal" x="2" y="2" width="20" height="20"/></g>` +
      `<text x="${x + 44}" y="${y + 27}" font-size="17" font-weight="700" fill="#fff">${title}</text>` +
      `<clipPath id="cc-${x}-${y}"><rect x="${x + 10}" y="${y + 48}" width="${w - 20}" height="70" rx="10"/></clipPath><g clip-path="url(#cc-${x}-${y})">${pv(x + 10, y + 48, w - 20)}</g>` +
      `<rect x="${x + 10}" y="${y + 48}" width="${w - 20}" height="70" rx="10" fill="none" stroke="rgba(0,0,0,.12)"/>` +
      rows.map((r, i) => `<circle cx="${x + 20}" cy="${y + 141 + i * 26}" r="4.5" fill="${col}"/><text x="${x + 32}" y="${y + 146 + i * 26}" font-size="14.5" font-weight="600" fill="#43362a">${r}</text>`).join('') + '</g>';
    return s;
  };

  function svg() {
    let s = '', defs = '';
    SP.length = 0; seed = 11;
    // ---- defs: patterns, gradients, glyph symbols ----
    defs += `<linearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe8f7"/><stop offset="1" stop-color="#7cc8ea"/></linearGradient>`;
    defs += `<pattern id="wm-waves" width="60" height="34" patternUnits="userSpaceOnUse"><path d="M6 10q5 -4 10 0t10 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".5"/><path d="M36 27q5 -4 10 0t10 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/></pattern>`;
    defs += `<pattern id="wm-grass" width="46" height="30" patternUnits="userSpaceOnUse"><g stroke-linecap="round" stroke-width="1.4"><path d="M5 8l1 -4M8 8l-1 -3" stroke="#6faf33"/><path d="M28 22l1 -4M31 22l-1 -3" stroke="#6faf33"/><path d="M38 9l1 -3" stroke="#b5e07a"/><path d="M16 26l1 -3" stroke="#b5e07a"/></g><circle cx="22" cy="12" r="1.1" fill="#a8d968"/><circle cx="42" cy="24" r="1" fill="#79b83c"/></pattern>`;
    defs += `<pattern id="wm-tiles" width="20.8" height="12" patternUnits="userSpaceOnUse"><rect width="20.8" height="12" fill="#ecd6ac"/><path d="M0 6L10.4 0L20.8 6L10.4 12z" fill="#f4e3c0" stroke="#d9bf8c" stroke-width="1"/></pattern>`;
    defs += `<filter id="wm-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>`;
    for (const [id, c] of [['air', '#ffb347'], ['pune', '#5ccf6a'], ['glass', '#b28cf0']]) defs += `<radialGradient id="pg-${id}"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${c}" stop-opacity=".95"/><stop offset=".8" stop-color="${shade(c, .7)}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity=".6"/></radialGradient>`;
    defs += `<radialGradient id="wm-water"><stop offset="0" stop-color="#5fc0f0"/><stop offset="1" stop-color="#2f8fd0"/></radialGradient>`;
    for (const k in G) defs += `<symbol id="g-${k}" viewBox="0 0 24 24"><g fill="#222">${G[k]}</g></symbol>`;

    // ---- the sea, clouds, birds ----
    s += `<rect width="1280" height="800" fill="url(#wm-sea)"/><rect width="1280" height="800" fill="url(#wm-waves)"/>`;
    // ---- the island: soft shadow, layered cliff, grass top ----
    const ISL = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), r = 1 + .02 * Math.sin(t * 5 + 1) + .012 * Math.sin(t * 11);
      ISL.push(iso(Math.sign(c) * Math.abs(c) ** .45 * 58 * r, 3 + Math.sign(sn) * Math.abs(sn) ** .45 * 56 * r)); }
    const id = smooth(ISL, true);
    defs += `<clipPath id="wm-isl"><path d="${id}"/></clipPath>`;
    s += `<path d="${id}" transform="translate(14,56)" fill="#1d5a7a" opacity=".35" filter="url(#wm-blur)"/>`;
    s += `<path d="${id}" transform="translate(0,46)" fill="#9fdcf3" opacity=".7"/>`;  // shallow-water rim
    s += `<path d="${id}" transform="translate(0,34)" fill="#5a3b22"/><path d="${id}" transform="translate(0,26)" fill="#7a5130"/><path d="${id}" transform="translate(0,18)" fill="#9a6a3c"/><path d="${id}" transform="translate(0,12)" fill="#b8854c"/>`;
    s += `<path d="${id}" transform="translate(0,6)" fill="#5d9a2a"/><path d="${id}" fill="#8cc63f"/><path d="${id}" fill="url(#wm-grass)"/>`;
    s += `<g clip-path="url(#wm-isl)">`;
    // lighter meadows
    for (const [x, z, a, b] of [[-28, -8, 11, 8], [24, 22, 12, 9], [-38, 26, 9, 8], [32, -30, 10, 7], [-12, -22, 8, 6]]) s += ell(x, z, a, b, '#9fd352', 'opacity=".75"');
    // the river across the north, with sandy banks and ripples
    const RV = []; for (let x = -70; x <= 70; x += 7) RV.push([x, -33 + 2.2 * Math.sin(x / 9)]);
    const rd = wpath(RV);
    s += `<path d="${rd}" fill="none" stroke="#e8cf92" stroke-width="44" stroke-linecap="round"/><path d="${rd}" fill="none" stroke="#a6e1f7" stroke-width="36"/><path d="${rd}" fill="none" stroke="#3ea4e2" stroke-width="28"/>`;
    s += `<path d="${rd}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="8 26" opacity=".7" class="wm-flow" transform="translate(0,-5)"/><path d="${rd}" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="5 30" opacity=".5" class="wm-flow" transform="translate(0,6)"/>`;
    s += `</g>`;
    // ---- paths: organic sandy curves with a darker edge and stepping stones ----
    const PATHS = [
      [[[0, -42], [0, -36], [.5, -24], [-1, -14], [0, -8]], 24], [[[0, 8], [2.5, 20], [-1.5, 32], [0, 46]], 24],
      [[[-8, 0], [-20, 2.5], [-32, -2], [-46, 0]], 24], [[[8, 0], [20, -2.5], [32, 2], [46, 0]], 24],
      [[[-22, 1], [-27, 10], [-24, 19], [-13, 20], [-5, 12]], 11], [[[-17, 21], [-20, 27.5]], 9],
      [[[-8, -6], [-15, -14], [-26, -14], [-31, -4], [-33, 0]], 11], [[[7, -6], [12, -7.5], [17, -7]], 10],
      [[[2, -30], [10, -28], [24, -27], [38, -24]], 0],
    ].filter((p) => p[1]);
    for (const [W, w] of PATHS) s += `<path d="${wpath(W)}" fill="none" stroke="#d29a55" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const [W, w] of PATHS) s += `<path d="${wpath(W)}" fill="none" stroke="#f6d29a" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const [W, w] of PATHS) if (w > 12) s += `<path d="${wpath(W)}" fill="none" stroke="#fbe6be" stroke-width="5" stroke-dasharray="6 13" stroke-linecap="round"/>`;
    // the plaza: a tiled circle with a stone rim, flower beds round it
    s += ell(0, 0, 14.5, 14.5, '#d29a55') + ell(0, 0, 13.6, 13.6, '#cdb58a') + ell(0, 0, 12.6, 12.6, 'url(#wm-tiles)') + ell(0, 0, 8, 8, 'none', 'stroke="#d9bf8c" stroke-width="2"');
    for (const [x, z] of [[9, -9], [-9, -9], [9, 9]]) s += ell(x * 1.08, z * 1.08, 2, 2, '#5a9a30') + ell(x * 1.08, z * 1.08, 1.6, 1.6, '#e85a7a', 'opacity=".9"') + ell(x * 1.08 - .3, z * 1.08 - .3, .9, .9, '#ffd84a');
    // the pond: a lighter rim, water, lily pads
    { const PD = []; for (let i = 0; i < 14; i++) { const t = i / 14 * Math.PI * 2, r = 1 + .14 * Math.sin(t * 3 + .5); PD.push([-24 + Math.cos(t) * 8.5 * r, 35 + Math.sin(t) * 6.5 * r]); }
      const pd = smooth(PD.map((p) => iso(p[0], p[1])), true);
      s += `<path d="${pd}" fill="#e8d6a0" stroke="#e8d6a0" stroke-width="12" stroke-linejoin="round"/><path d="${pd}" fill="#a6e1f7" stroke="#a6e1f7" stroke-width="5"/><path d="${pd}" fill="url(#wm-water)" transform="translate(0,2)"/>`;
      for (const [x, z] of [[-28, 33], [-26, 38], [-19, 36]]) s += ell(x, z, 1.1, 1.1, '#4fae4a') + ell(x + .3, z - .2, .35, .35, '#ff8fb0');
      s += ell(-23, 34, 3, 1.6, 'none', 'stroke="#fff" stroke-width="1.2" opacity=".6"'); }
    // the glass bridge beyond the south gate: glass tiles over a dark chasm
    s += poly([iso(-5, 49), iso(5, 49), iso(5, 58), iso(-5, 58)], '#2b2f4a') + poly([iso(-5, 58), iso(5, 58), iso(5, 58, -3), iso(-5, 58, -3)], '#1d2036');
    for (let i = 0; i < 4; i++) for (const dx of [-2.1, 2.1]) s += flat(dx - 1.6, 49.6 + i * 2.1, dx + 1.6, 51.2 + i * 2.1, (i + (dx > 0)) % 3 === 1 ? 'rgba(170,220,255,.45)' : 'rgba(205,240,255,.95)', 'stroke="#fff" stroke-width="1.3"');
    // the map board's spot
    s += ell(-3.9, 10.9, 2.4, 2.4, '#e8322a', 'class="wm-ring" opacity=".6"');

    // ---- buildings and things that stand up ----
    // HQ: an office tower with a lower wing, a glass entrance, rooftop kit, and a tiny garden
    { let h = shadowAt(0, -45, 9) + box(-9, -49, 9, -42, 5, '#d9d6cf', '#bdb8ae');
      for (let x = -8; x < 8.5; x += 2.2) for (const y of [1, 3]) h += poly(fS(-42, x, x + 1.4, y, y + 1.3), '#7ec3e6');
      h += box(-5, -52, 5, -44, 16, '#ecebe6', '#cfccc4');
      for (let x = -4.4; x < 4.5; x += 1.6) for (let y = 6; y < 15.5; y += 1.8) h += poly(fS(-44, x, x + 1, y, y + 1.1), (x * 7 + y) % 5 < 1 ? '#ffe9a0' : '#5aa8d8');
      for (let z = -51.4; z < -44.5; z += 1.6) for (let y = 6; y < 15.5; y += 1.8) h += poly(fE(5, z, z + 1, y, y + 1.1), '#4b94c4');
      h += box(-2, -43, 2, -41.5, 3, '#4b94c4', '#e04a5a') + poly(fS(-41.5, -1.2, 1.2, 0, 2.2), '#bfe8fa', 'stroke="#fff" stroke-width="1.5"');
      h += box(-3, -50, 0, -47, 18, '#9a978f') + box(1.5, -50, 3.5, -48, 17.2, '#b5b1a8');
      h += poly(fS(-44, -4.6, 4.6, 16, 17.4), '#e04a5a');
      { const a = iso(-4, -44, 16.2), b = iso(4, -44, 16.2); h += `<text transform="translate(${f1((a[0] + b[0]) / 2)},${f1((a[1] + b[1]) / 2 - 1)}) skewY(30)" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">TOKENFALL</text>`; }
      add(-46, h); }
    for (const x of [-7, 7]) add(-42 + x * 0 - 1, conifer(x, -40.5, .8));
    // the bridge over the river: planks and rails
    { const B = (x0, z0, x1, z1, y) => poly([iso(x0, z0, y), iso(x1, z0, y), iso(x1, z1, y), iso(x0, z1, y)], '#b98250', 'stroke="#8a5a32" stroke-width="1"');
      let b = B(-3.4, -38, 3.4, -28, .6) + poly(fS(-28, -3.4, 3.4, 0, .6), '#8a5a32');
      for (let z = -37; z < -28; z += 1.2) b += `<path d="M${pt(iso(-3.4, z, .6))}L${pt(iso(3.4, z, .6))}" stroke="#946339" stroke-width="1.2"/>`;
      for (const x of [-3.2, 3.2]) { b += `<path d="M${pt(iso(x, -38, 2))}Q${pt(iso(x, -33, 3.4))} ${pt(iso(x, -28, 2))}" fill="none" stroke="#7a4a28" stroke-width="2.5"/>`; for (let z = -38; z <= -28; z += 2.5) b += `<path d="M${pt(iso(x, z, .6))}L${pt(iso(x, z, 2.2 + (1 - ((z + 33) / 5) ** 2) * .6))}" stroke="#7a4a28" stroke-width="2"/>`; }
      add(-33, b); }
    // Token Brew: a cafe with a striped awning, sign and umbrella tables
    { let c = shadowAt(18, -13, 6) + box(13, -17, 23, -10, 4.4, '#f3c98d', '#c45a3a');
      c += poly(fS(-10, 14, 16, 0, 2.6), '#7a4a2a') + poly(fS(-10, 17, 22, 1, 3), '#bfe8fa', 'stroke="#fff" stroke-width="1.5"') + poly(fE(23, -16, -11, 1, 3), '#bfe8fa', 'stroke="#fff" stroke-width="1.5"');
      for (let i = 0; i < 8; i++) { const xa = 13 + i * 1.25; c += poly([iso(xa, -10, 3.6), iso(xa + 1.25, -10, 3.6), iso(xa + 1.25, -8.4, 2.7), iso(xa, -8.4, 2.7)], i % 2 ? '#fff' : '#e04a5a'); }
      for (let i = 0; i < 6; i++) { const za = -17 + i * 1.17; c += poly([iso(23, za, 3.6), iso(23, za + 1.17, 3.6), iso(24.6, za + 1.17, 2.7), iso(24.6, za, 2.7)], i % 2 ? '#fff' : '#e04a5a'); }
      c += box(14, -16, 22, -15.4, 6.2, '#6b3a22', '#7a4628', 4.4);
      { const a = iso(14.5, -15.4, 5.3), b = iso(21.5, -15.4, 5.3); c += `<text transform="translate(${f1((a[0] + b[0]) / 2)},${f1((a[1] + b[1]) / 2 + 2)}) skewY(30)" text-anchor="middle" font-size="7.5" font-weight="700" fill="#ffe2a8">TOKEN BREW</text>`; }
      add(-13 + 18, c); }
    add(19 + -5.4, umbrella(19, -5.4, '#e04a5a')); add(14.5 - 5.6, umbrella(14.5, -5.6, '#3fae55')); add(23.5 - 6, umbrella(23.5, -6, '#f0a030'));
    // the leaderboard billboard, facing the plaza
    { let l = ''; for (const x of [7, 11]) l += box(x - .2, -14.2, x + .2, -13.8, 3, '#4a4a55');
      l += poly(fS(-13.6, 5.6, 12.4, 3, 7.4), '#2f2a45', 'stroke="#fff" stroke-width="2"') + poly(fE(12.4, -14.2, -13.6, 3, 7.4), '#221e33');
      const bars = [[6.6, 2.8, '#c0c4cc'], [8.2, 4, '#ffcf40'], [9.8, 2, '#d08a4a']];
      for (const [x, hh, c] of bars) l += poly(fS(-13.6, x, x + 1.1, 3.6, 3.6 + hh), c);
      l += poly(fS(-13.6, 11.2, 11.8, 6.2, 6.8), '#ffcf40');
      add(-1, l); }
    // the games lawn: the Token Tower (stacked blocks) and the Spot Shot target
    { let t = shadowAt(-22, -8, 3) + box(-24, -10, -20, -6, .4, '#c7a46a');
      for (let i = 0; i < 12; i++) { const y = .4 + i * .7, c = i % 2 ? '#e8b04a' : '#f2c46a';
        if (i % 2) for (const z of [-9.4, -8.2, -7]) { if (i === 9 && z === -8.2) continue; t += box(-23.2, z, -20.8, z + 1.1, y + .7, c, null, y); }
        else for (const x of [-23.2, -22, -20.8]) { if (i === 10 && x === -22) continue; t += box(x, -9.4, x + 1.1, -6.9, y + .7, c, null, y); } }
      add(-30, t); }
    { const P = upright(-31, -10, 3.6, 2.4, 'z'), P2 = upright(-31, -10, 3.6, 1.6, 'z'), P3 = upright(-31, -10, 3.6, .7, 'z');
      let g = shadowAt(-31, -10, 2) + `<path d="M${pt(iso(-31.8, -10, 0))}L${pt(iso(-31.2, -10, 3))}M${pt(iso(-30.2, -10, 0))}L${pt(iso(-30.8, -10, 3))}" stroke="#6b4426" stroke-width="2.4"/>`;
      g += `<path d="${smooth(P, true)}" fill="#fff" stroke="#2b2b33" stroke-width="1.4"/><path d="${smooth(P2, true)}" fill="#e8322a"/><path d="${smooth(upright(-31, -10, 3.6, 1.15, 'z'), true)}" fill="#fff"/><path d="${smooth(P3, true)}" fill="#e8322a"/>`;
      add(-41, g); }
    // homes in the south-west
    add(-22 + 13.5, cottage(-22, 7.5, -15, 12.5, '#f6e2c0', '#d0563a'));
    add(-34 + 12, cottage(-34, 8, -28.5, 12.5, '#f3ecd8', '#5f7bc0'));
    add(-31 + 21, cottage(-31.5, 16, -26, 20, '#ffe7c4', '#3f9a5a'));
    for (let x = -35; x <= -14; x += 1.5) add(x + 14.7, box(x, 14.4, x + .3, 14.7, 1, '#fff'));
    // the fountain: a tiered basin with spray
    { let f = ell(0, 0, 4.8, 4.8, '#9a968a', '', 0) + ell(0, 0, 4.8, 4.8, '#d8d3c6', '', .9) + ell(0, 0, 4.1, 4.1, '#4fb0e6', '', .9) + ell(0, 0, 3, 3, '#7fd0f5', 'opacity=".6"', .9);
      f += box(-.5, -.5, .5, .5, 3.2, '#cfcabd', null, .9) + ell(0, 0, 2.2, 2.2, '#bdb8aa', '', 3.2) + ell(0, 0, 2.2, 2.2, '#d8d3c6', '', 3.6) + ell(0, 0, 1.7, 1.7, '#4fb0e6', '', 3.6);
      f += box(-.25, -.25, .25, .25, 5, '#cfcabd', null, 3.6) + ell(0, 0, 1, 1, '#d8d3c6', '', 5);
      const [cx, cy] = iso(0, 0, 5.4);
      f += `<g class="wm-spray" fill="none" stroke="#e8f8ff" stroke-width="2" stroke-linecap="round"><path d="M${f1(cx)} ${f1(cy)}q-6 -10 -11 4"/><path d="M${f1(cx)} ${f1(cy)}q6 -10 11 4"/><path d="M${f1(cx)} ${f1(cy)}v-9"/></g>`;
      for (const [dx, dy, d] of [[-8, -8, 0], [9, -4, .6], [2, -14, 1.1], [-4, 6, 1.6]]) f += `<circle cx="${f1(cx + dx)}" cy="${f1(cy + dy)}" r="1.6" fill="#fff" class="wm-spark" style="animation-delay:${d}s"/>`;
      add(0, f); }
    // the map board ("you are here" sits on it)
    add(-3.9 + 10.9 - .1, box(-4.8, 10.7, -3, 10.9, 3.2, '#8a5530', '#a5693a', 1.2) + box(-4.7, 10.75, -4.5, 10.85, 1.2, '#5a3a22') + box(-3.3, 10.75, -3.1, 10.85, 1.2, '#5a3a22'));
    // the picnic lawn south-east: tables, a snack kiosk
    for (const [x, z] of [[20, 17], [25, 17], [20, 22], [25, 22], [30, 20]]) add(x + z, box(x - 1.4, z - .8, x + 1.4, z + .8, 1.1, '#b07a4a', '#c98f58', .8) + box(x - 1.4, z - 1.5, x + 1.4, z - 1.1, .6, '#8a5a32') + box(x - 1.4, z + 1.1, x + 1.4, z + 1.5, .6, '#8a5a32'));
    add(18 + 28, box(16.5, 26.5, 20.5, 29.5, 3, '#ffffff', '#4aa0d8') + poly(fS(29.5, 17, 20, 1.2, 2.6), '#ffe0a0', 'stroke="#fff" stroke-width="1.2"') + umbrella(23, 28, '#4aa0d8'));
    add(22 + 20, person(22.5, 19.5, '#e85aa0') + person(27.5, 21, '#4a7ce0'));
    // the gates
    add(-44, gate(-44, 0, 'x', '#ffa53a', 'air')); add(44, gate(44, 0, 'x', '#45c45a', 'pune')); add(44.2, gate(0, 44, 'z', '#a27be8', 'glass'));
    // lamps, benches, people, a cart, a duck
    for (const [x, z] of [[-9, 4.5], [9, -4.5], [4.5, 9], [-4.5, -9], [-24, 4], [24, -4], [4, 24], [-4, -22], [32, 4], [-32, -4], [4, 36], [3, -40]]) add(x + z, lamp(x, z));
    add(-11.3 + 3, bench(-11.3, 3, false)); add(11.3 - 3, bench(11.3, -3, false)); add(-3 + 11.3, bench(3, 11.3)); add(-3 - 11.3, bench(-3, -11.3));
    for (const [x, z, c] of [[-6, 3, '#e04a5a'], [5, 6, '#4a7ce0'], [-2, -7, '#f0a030'], [7, -2, '#8a5ad8'], [-18, 1.5, '#3fae55'], [26, -1, '#e04a5a'], [1, 18, '#4a7ce0'], [-0.5, 30, '#f0a030'], [17, -6.5, '#2b2b33'], [-20, -12, '#e85aa0'], [-26, -6, '#4a7ce0'], [-22, 30, '#3fae55'], [1, -26, '#e04a5a'], [35, 1, '#8a5ad8'], [-36, -1, '#e8b04a'], [-14, 18.5, '#4a7ce0']]) add(x + z, person(x, z, c));
    { const [cx, cy] = iso(28, 1.4); add(29.4, box(26.6, .6, 29.6, 2.2, 1, '#e04a5a', '#f06a7a', .3) + box(27.4, .7, 28.9, 2.1, 1.8, '#e04a5a', '#bfe8fa', 1) + `<circle cx="${f1(cx - 9)}" cy="${f1(cy + 2)}" r="2" fill="#222"/><circle cx="${f1(cx + 3)}" cy="${f1(cy + 6)}" r="2" fill="#222"/>`); }
    { const [cx, cy] = iso(-25, 36); add(11, `<g transform="translate(${f1(cx)},${f1(cy)})"><ellipse cx="0" cy="1" rx="7" ry="2" fill="#2f8fd0"/><path d="M-6 -2q0 4 6 4q6 0 6 -4q-2 1 -4 -1z" fill="#fff"/><circle cx="4" cy="-4.5" r="2.6" fill="#3a8a3a"/><path d="M6.4 -4.5l2.6 .8l-2.6 .8z" fill="#f0a030"/><circle cx="4.6" cy="-5" r=".6" fill="#000"/></g>` +
      `<g transform="translate(${f1(cx + 16)},${f1(cy - 8)}) scale(.7)"><path d="M-6 -2q0 4 6 4q6 0 6 -4q-2 1 -4 -1z" fill="#ffe27a"/><circle cx="4" cy="-4.5" r="2.4" fill="#ffe27a"/><path d="M6.2 -4.5l2.4 .8l-2.4 .8z" fill="#f0a030"/></g>`); }
    // vegetation: scatter trees and bushes where nothing else is
    const SEG = []; for (const [W, w] of PATHS) for (let i = 0; i < W.length - 1; i++) SEG.push([W[i], W[i + 1], w / 9 + 1.6]);
    const RECTS = [[-12, -56, 12, -38], [11, -19, 26, -3], [4, -16, 14, -11], [-26, -12, -18, -4], [-34, -13, -28, -7], [-37, 5, -12, 22], [-35, 26, -13, 44], [-7, 46, 7, 60], [-50, -7, -38, 7], [38, -7, 50, 7], [-6, 38, 6, 50], [-6, -44, 6, -26], [24, -1, 31, 4], [16, 13, 33, 31]];
    const dseg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
    const free = (x, z, m) => (Math.abs(x / 55) ** 2.2 + Math.abs((z - 3) / 53) ** 2.2) ** (1 / 2.2) < .93 && Math.hypot(x, z) > 17 + m && Math.abs(z + 33 - 2.2 * Math.sin(x / 9)) > 6 + m &&
      SEG.every(([a, b, r]) => dseg(x, z, a, b) > r + m) && RECTS.every(([a, b, c, d]) => x < a - m || x > c + m || z < b - m || z > d + m);
    const placed = [];
    for (let n = 0, tries = 0; n < 62 && tries < 3000; tries++) {
      const x = -60 + rnd() * 120, z = -54 + rnd() * 114; if (!free(x, z, 1.2) || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 5.2)) continue;
      placed.push([x, z]); n++; const edge = (Math.abs(x / 55) ** 2.2 + Math.abs((z - 3) / 53) ** 2.2) ** (1 / 2.2), r = rnd(), k = .85 + rnd() * .35;
      add(x + z, edge > .78 && z > -10 ? palm(x, z, k) : z < -20 && r < .6 ? conifer(x, z, k) : r < .22 ? palm(x, z, k) : roundTree(x, z, k)); }
    for (let n = 0, tries = 0; n < 55 && tries < 2000; tries++) {
      const x = -60 + rnd() * 120, z = -54 + rnd() * 114; if (!free(x, z, .2) || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 2.6)) continue;
      placed.push([x, z]); n++; add(x + z, bush(x, z, .7 + rnd() * .4, rnd() < .4 ? ['#ff7aa2', '#ffd84a', '#fff', '#b98cf0'][Math.floor(rnd() * 4)] : 0)); }
    for (const [x, z, c] of [[-10, 8, '#ff7aa2'], [10, -8, '#ffd84a'], [-8, -10.5, '#fff'], [12, 5, '#b98cf0'], [-12, -5, '#ff7aa2'], [5, 13, '#ffd84a']]) add(x + z, bush(x, z, .65, c));
    SP.sort((a, b) => a.d - b.d); s += SP.map((p) => p.s).join('');

    // ---- clouds and birds over everything ----
    s += `<g class="wm-cloud" fill="#fff" opacity=".85">` + [[120, 300, 1], [1150, 420, .8], [560, 760, .9], [880, 60, .7]].map(([x, y, k]) => `<g transform="translate(${x},${y}) scale(${k})"><ellipse cx="0" cy="0" rx="40" ry="14"/><ellipse cx="-14" cy="-10" rx="18" ry="14"/><ellipse cx="12" cy="-14" rx="22" ry="16"/></g>`).join('') + `</g>`;
    s += `<g class="wm-birds" fill="none" stroke="#3b4a5a" stroke-width="1.8" stroke-linecap="round">` + [[760, 60], [782, 70], [770, 84], [300, 640]].map(([x, y]) => `<path d="M${x - 6} ${y}q3 -4 6 0q3 -4 6 0"/>`).join('') + `</g>`;
    // ---- badges, names, gate pills ----
    s += badge(5, -47, 18.5, 'hq') + badge(0, 0, 9, 'fountain') + badge(18, -13.5, 7, 'cup') + badge(-22, -8, 9.2, 'tower') + badge(-31, -10, 6.2, 'target') + badge(9, -13.8, 7.8, 'board') + badge(-18.5, 10, 7, 'home') + badge(-24, 34, 1, 'duck') + badge(18.5, 28, 5, 'cup');
    s += name(18, -13.5, -1.2, 'Token Brew') + name(-22, -6, -1.6, 'Token Tower') + name(-31, -8, -1.6, 'Spot Shot') + name(9, -12, -.6, 'Leaderboard') + name(-25, 16, -2.2, 'Homes') + name(-24, 42, -1, 'Pond') + name(0, 13.5, -1.2, 'Plaza', 12) + name(36, -36, 0, 'River', 12);
    s += pill(-44, 0, 15, 'Airport', '#f0a030') + pill(44, 0, 15, 'Pune', '#3fae55') + pill(0, 44, 15, 'Glass Bridge', '#8f6ad8') + pill(0, -47, 25.5, 'HQ', '#e04a5a');
    // ---- you are here: drawn live on top when the map opens (see aim layer below) ----
    // ---- cards beyond the portals ----
    s += card(16, 16, 254, iso(-44, 0, 11), '#f0a030', 'Airport portal', pvPlane, ['Fly to Pleasanton (US office)', 'The Calfus office in California']);
    s += card(1010, 512, 256, iso(44, 0, 11), '#3fae55', 'Pune portal', pvCity, ['Crescent Bay → HQ floor', 'Carrom table on the HQ floor', 'ABZ office, 15th floor']);
    s += card(16, 560, 254, iso(0, 44, 2), '#8f6ad8', 'Glass Bridge', pvGlass, ['Step on the right tile', 'Questions on understanding']);
    // ---- legend ----
    { const L = [['hq', 'HQ'], ['fountain', 'Plaza &amp; fountain'], ['cup', 'Token Brew'], ['board', 'Leaderboard'], ['tower', 'Token Tower'], ['target', 'Spot Shot'], ['home', 'Homes'], ['duck', 'Pond'], ['portal', 'Portal: travel'], ['pin', 'You are here']];
      const x = 1016, y = 14, w = 250, h = 30 + Math.ceil(L.length / 2) * 28 + 8;
      s += `<g><rect x="${x}" y="${y + 5}" width="${w}" height="${h}" rx="16" fill="rgba(20,50,70,.22)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff"/><text x="${x + 16}" y="${y + 24}" font-size="14" font-weight="700" fill="#3f6a1a" letter-spacing="1">MAP KEY</text>` +
        L.map((l, i) => { const lx = x + 12 + (i % 2) * 120, ly = y + 34 + Math.floor(i / 2) * 28; return `<use xlink:href="#g-${l[0]}" x="${lx}" y="${ly}" width="20" height="20"/><text x="${lx + 27}" y="${ly + 15}" font-size="13" font-weight="600" fill="#333">${l[1]}</text>`; }).join('') + '</g>'; }
    // ---- compass rose ----
    { const cx = 330, cy = 730; s += `<g transform="translate(${cx},${cy})"><circle r="30" fill="#fffaf0" stroke="#3b4a5a" stroke-width="2"/><circle r="24" fill="none" stroke="#d9c6a0" stroke-width="1" stroke-dasharray="2 3"/>` +
      `<g transform="scale(1,.58) rotate(-30)">` + '' + `</g>` +
      `<path d="M0 -24L5 0L0 24L-5 0z" fill="#3b4a5a" transform="rotate(-60)"/><path d="M0 -24L5 0L-5 0z" fill="#e8322a" transform="rotate(-60)"/><path d="M-24 0L0 4L24 0L0 -4z" fill="#9aa5b1" transform="rotate(-60)"/><circle r="3" fill="#fff" stroke="#3b4a5a"/>` +
      `<text x="${f1(Math.sin(-60 * Math.PI / 180) * -0 + 0)}" y="0" font-size="0"></text><text transform="translate(${f1(-Math.cos(Math.PI / 6) * 38)},${f1(-Math.sin(Math.PI / 6) * 38 + 5)})" text-anchor="middle" font-size="14" font-weight="700" fill="#e8322a">N</text></g>`; }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="800" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid meet" font-family="Fredoka, 'Baloo 2', sans-serif"><style>text{font-family:Fredoka,'Baloo 2',sans-serif}.wm-glow{animation:wmpulse 2.2s ease-in-out infinite}.wm-swirl{animation:wmspin 2.4s linear infinite}.wm-swirl.r{animation-direction:reverse;animation-duration:1.6s}.wm-spark{animation:wmtw 1.8s ease-in-out infinite}.wm-flow{animation:wmflow 3s linear infinite}.wm-ring{transform-box:fill-box;transform-origin:center;animation:wmring 1.6s ease-out infinite}.wm-cloud{animation:wmdrift 30s ease-in-out infinite alternate}.wm-birds{animation:wmdrift 18s ease-in-out infinite alternate-reverse}.wm-spray{animation:wmtw 1.2s ease-in-out infinite}@keyframes wmpulse{50%{opacity:.6}}@keyframes wmspin{to{stroke-dashoffset:-68}}@keyframes wmtw{50%{opacity:.25}}@keyframes wmflow{to{stroke-dashoffset:-40}}@keyframes wmring{from{transform:scale(.6);opacity:.9}to{transform:scale(1.8);opacity:0}}@keyframes wmdrift{to{transform:translateX(40px)}}</style><defs>${defs}</defs>${s}</svg>`;
  }
  const flat = (x0, z0, x1, z1, fill, extra = '') => poly([iso(x0, z0), iso(x1, z0), iso(x1, z1), iso(x0, z1)], fill, extra);

  const el = document.createElement('div'); el.className = 'wm-back'; el.hidden = true;
  el.innerHTML = `<div class="wm-card" role="dialog" aria-label="Lobby map"><div class="wm-head"><h2>TokenFall Lobby</h2><span>Click a place (or anywhere on the grass) to run there</span><button type="button" class="wm-x">Close <kbd>E</kbd></button></div><div class="wm-map"></div></div>`;
  document.getElementById('ui').appendChild(el);
  let drawn = false, cache = '';
  const markup = () => cache || (cache = svg());
  // ---- click to go: places on the map (their badge or pill, and where in the world you end up), else any open ground ----
  const HOT = [
    ['HQ Office', 5, -47, 18.5, -32, 0, -44.8], ['the fountain', 0, 0, 9, -32, 0, 5], ['Token Brew', 18, -13.5, 7, -32, 18.1, -7], ['the Leaderboard', 9, -13.8, 7.8, -32, 8.6, -9.2],
    ['Token Tower', -22, -8, 9.2, -32, -26, -3.2], ['Spot Shot', -31, -10, 6.2, -32, -20.5, -2.2], ['the homes', -18.5, 10, 7, -32, -16.2, -7], ['the pond', -24, 34, 1, -32, 16.4, 23.8],
    ['the Prompt Lab', 18.5, 28, 5, -32, 6.3, 24.8], ['the Airport portal', -44, 0, 15, 0, -40, 0], ['the Pune portal', 44, 0, 15, 0, 40, 0], ['the Glass Bridge', 0, 44, 15, 0, 0, 40], ['HQ', 0, -47, 25.5, 0, 0, -44.8],
  ];
  const SVGNS = 'http://www.w3.org/2000/svg';
  let svgEl = null, aim = null, me = null, target = null;
  const toSvg = (e) => { const p = svgEl.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svgEl.getScreenCTM().inverse()); };
  const ground = (px, py) => { const u = (px - OX) / (.866 * S), v = (py - OY) / (.5 * S); return [(u + v) / 2, (v - u) / 2]; };
  const pick = (e) => {
    const p = toSvg(e);
    for (const [label, ax, az, ay, dy, wx, wz] of HOT) { const [cx, cy] = iso(ax, az, ay); if (Math.abs(p.x - cx) < (dy ? 22 : 60) && Math.abs(p.y - (cy + dy)) < (dy ? 26 : 18)) return { label, x: wx, z: wz, hot: true }; }
    const [x, z] = ground(p.x, p.y);
    if (Math.abs(x) > 47 || Math.abs(z) > 47) return null;
    return { label: 'there', x, z, hot: false };
  };
  const drawAim = (t) => {
    if (!t) { aim.style.display = 'none'; return; }
    const [cx, cy] = iso(t.x, t.z), text = t.hot ? `Go to ${t.label}` : 'Run here', w = text.length * 7.4 + 26;
    aim.style.display = '';
    aim.innerHTML = `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="14" ry="7" fill="rgba(255,210,122,.35)" stroke="#ffb02e" stroke-width="3"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="2.5" fill="#ffb02e"/>` +
      `<g transform="translate(${f1(cx)},${f1(cy - 30)})"><rect x="${f1(-w / 2)}" y="-13" width="${f1(w)}" height="26" rx="13" fill="#2b2b33"/><text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${text}</text></g>`;
  };
  const drawMe = () => {
    const h = typeof hero !== 'undefined' && hero ? [hero.x, hero.y] : [-3.9, 10.9], [cx, cy] = iso(h[0], h[1], 3.2);
    me.innerHTML = `<g transform="translate(${f1(cx)},${f1(cy)})"><path d="M0 0c-3-6-14-14-14-25a14 14 0 0 1 28 0c0 11-11 19-14 25z" fill="#e8322a" stroke="#fff" stroke-width="3"/><circle cy="-25" r="5.5" fill="#fff"/>` +
      `<g transform="translate(-114,-40)"><rect x="0" y="-12" width="96" height="24" rx="12" fill="#2b2b33"/><text x="48" y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">You are here</text></g></g>`;
  };
  const wire = () => {
    svgEl = el.querySelector('.wm-map svg'); svgEl.style.cursor = 'pointer';
    me = document.createElementNS(SVGNS, 'g'); aim = document.createElementNS(SVGNS, 'g'); aim.style.pointerEvents = 'none'; me.style.pointerEvents = 'none'; svgEl.append(me, aim);
    svgEl.addEventListener('mousemove', (e) => { target = pick(e); drawAim(target); svgEl.style.cursor = target ? 'pointer' : 'not-allowed'; });
    svgEl.addEventListener('mouseleave', () => { target = null; drawAim(null); });
    svgEl.addEventListener('click', (e) => {
      const t = pick(e); if (!t) return;
      e.stopPropagation(); close();
      if (!walkStartAt(t.x, t.z, t.hot ? t.label : 'that spot')) log('', "Can't get there from here.", true);
    });
  };
  const open = () => { if (!drawn) { el.querySelector('.wm-map').innerHTML = markup(); drawn = true; wire(); } drawMe(); drawAim(null); el.hidden = false; window.TokenFall.lockPlayer(true); };
  const close = () => { if (el.hidden) return; el.hidden = true; window.TokenFall.lockPlayer(false); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.wm-x')) close(); });
  addEventListener('keydown', (e) => { if (el.hidden) return; if (!e.repeat && ['KeyE', 'Escape', 'Enter', 'Space'].includes(e.code)) close(); e.stopImmediatePropagation(); e.preventDefault(); }, true);
  window.WorldMap = { open, close, svg: markup };   // main.js makes TF later than this file loads
})();
