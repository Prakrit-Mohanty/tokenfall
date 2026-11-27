// TokenFall: Calfus at 35 Crescent Bay, Balewadi, Pune — the building, its ground floor, the parking and the entrance, rebuilt from the
// team's own photos of the place (the 65 in "Cb office/") and measured off them. The curtain wall runs on one 1.24 m module: its mullions,
// the grey band's panel joints and the louvre brackets all line up on it, 21 modules and a narrow end strip across the front. Each floor is a
// tall row of glass over a short one, 3.6 m. The gate line, pillars, canopy and lobby were placed from the straight-on photo of the front
// (an ultrawide frame: camera about 2 m up, tipped up 4 degrees, turned 2; its paving joints and leaning verticals gave the horizon and lens).
//
// From the lane, west to east: a long grey sliding bar gate across the stilt car park, a stone gate pillar, the open drive with its rail set in
// the paving, the big stone pillar with the brushed-steel name plate and a little lantern, the walk-in gate, then a tall grey wall screening
// the generator. Behind them a 2.5 m paved aisle, and the glass building standing over it on stilts: four bays of Wöhr puzzle stack parkers
// behind a band of louvres, the dark grey band with the Calfus wordmark, three floors of blue glass with a few top-hung windows propped open.
// The drive runs into the EV bay (a black wall, the charger, the electrical panels, the grey Hyryder on charge); the lobby sits back under a
// deep dark canopy: a glass front with a sliding door, cream marble with brown veins, oak walls, the big C, the lift (ride it up to the HQ
// floor). Down the west side the two-wheelers park against the wall; down the east side runs the service alley: the Kirloskar generator, the
// convex mirror, the hose box, the OWC, the five waste bins, the lift's back door with its fire risers.
//   crescentBay(cx, cz)    from buildPune (pune.js): builds it all, on the Pune zone's north side, its gate on the strip before the footpath
//   CB_DOOR_X, CB_ARRIVE    where the lobby door is, and where the lift lets you out (office-hq.js sends you back down here)
// Classic script: shares one global scope with the other js/game files (geometry, props, buildings, city, office-kit), loaded before pune.js.

// Plan, in metres. x runs east from the upper floors' west edge, z runs south (toward the lane) from the facade line, y up from the paving.
const CB = {
  X0: -23.9, Z0: -.76,               // where that corner stands, from the Pune zone's centre (set 2.5 m back from the street; STRIP grows to match)
  M: 1.24, N: 21.6, D: 13,           // the module, the front in modules (21 and a 0.6 end strip), the depth
  SOFFIT: 4.3, LOUV: [2.95, 4.2], BAND: [4.3, 4.86, 5.25], FLOOR: 3.6, FLOORS: 3,   // the stilt's ceiling, the louvre band, the grey band's two rows, the glass floors
  GATE: 2.5, STRIP: 7.6,             // the gate line (the sliding gates' rail) and where the paved strip outside meets the zone's footpath
  WEST: -0.8, EAST: 31.4, BACK: -17, // the plot's boundary walls: the west one just past the floors' edge, so the two-wheelers park under the overhang
  COLX: [2.5, 3.2],                  // the stilt's west column line: the floors above overhang the two-wheeler strip to x = 0
  POSTS: [3.44, 5.74, 8.04, 10.34, 12.64], PARK: [-0.55, -6.15],   // the stack parkers' front posts, and their front and back post lines
  EV: [12.8, 19.95], EVBACK: -7.1,  // the drive into the EV bay and its black back wall
  LOB: [19.95, 27.6, -2.3, -9.8],    // the lobby block: its west wall, east wall, glass front and back wall
  CORE: [23.8, 27.6, -4.0, -7.4],    // the marble-clad lift core in the lobby's east side; south of it, by the glass, the alcove with the big C (its oak wall at CW)
  CW: 25.3,
  GLASS: [20.06, 25.44], DOOR: [21.52, 23.97],   // the lobby's glass front, three bays; the sliding door is the middle one
  CAN: [18.4, 27.9, 1.5, 3.95, 4.41], // the canopy: x from, x to, its front edge, its soffit and its top (the louvre band stops where it starts)
};
CB.W = CB.M * CB.N;   // 26.78 m
const CB_DOOR_X = CB.X0 + (CB.DOOR[0] + CB.DOOR[1]) / 2;   // the lobby's sliding door, x from the zone's centre
const CB_ARRIVE = [CB.X0 + 23.0, CB.Z0 - 5.7];        // in front of the lift, inside the lobby

const CBM = {};
const cbOnce = (k, f) => CBM[k] || (CBM[k] = f());
const cbStd = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0 }, o));
// a sharp-edged box (architecture, unlike the game's soft props), its texture laid s metres a repeat (0: once over each face)
function cbGeo(w, h, d, s = 0) {
  const g = new PlainBox(w, h, d); if (!s) return g;
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  return g;
}
const cbRng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// ---------------------------------------------------------------- textures, drawn from the photos' colours
// 200 x 100 mm concrete pavers in a running bond, 1.6 m to a tile, each one a tone picked from the photos (the forecourt's beige, light grey, grey
// and charcoal mix; the strip outside is one light beige)
function cbPaverTex(seed, tones, weights) {
  return canvasTex(512, 512, (g) => {
    const r = cbRng(seed), pick = () => { let u = r(), i = 0; while (i < weights.length - 1 && (u -= weights[i]) > 0) i++; return tones[i]; };
    g.fillStyle = '#d9d1c4'; g.fillRect(0, 0, 512, 512);   // the sand in the joints
    for (let row = 0; row < 16; row++) for (let k = -1; k < 9; k++) {
      const x = k * 64 + (row % 2 ? 32 : 0), y = row * 32;
      g.fillStyle = pick(); g.fillRect(x + 1.5, y + 1.5, 61, 29);
      g.fillStyle = `rgba(255,255,255,${.05 + r() * .06})`; g.fillRect(x + 2, y + 2, 60, 3);   // the chamfer catching the light
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${r() < .5 ? '60,55,50' : '255,250,240'},.08)`; g.fillRect(x + 3 + r() * 56, y + 3 + r() * 24, 2 + r() * 3, 2); }
    }
  }, { keep: true });
}
// the curtain wall: the sky caught in the glass, the neighbours reflected low down (one still under its green safety net), dark grey mullions on
// the module, a transom between each floor's tall and short rows. mods: the mullion positions across the face (m). Returns the colour map and a
// night map (warm offices, some panes dark)
function cbGlassTex(width, mods, floors, seed, o = {}) {
  const PX = 36, W = Math.round(width * PX), FH = CB.FLOOR * PX, H = Math.round(floors * FH), r = cbRng(seed);
  const rows = []; for (let f = 0; f < floors; f++) { const y0 = H - f * FH; rows.push([y0 - FH, y0 - .786 * FH, 'tall', f], [y0 - .786 * FH - FH * .214, y0 - FH, 'short', f]); }
  const lit = mods.slice(0, -1).map(() => Array.from({ length: floors }, () => r() < .62));
  const frame = (g) => {
    g.fillStyle = '#4b4f56';
    for (const x of mods) g.fillRect(Math.round(x * PX) - 2, 0, 4, H);
    for (let f = 0; f <= floors; f++) { const y = H - f * FH; g.fillRect(0, y - 3, W, 5); g.fillRect(0, y - .786 * FH - 2, W, 4); }
  };
  const map = canvasTex(W, H, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, o.top || '#b4d6ee'); sky.addColorStop(.55, o.mid || '#9cc2e2'); sky.addColorStop(1, o.low || '#86abc9');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(255,255,255,${.05 + r() * .07})`; const y = r() * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y - W * .18); g.lineTo(W, y - W * .18 + 10 + r() * 16); g.lineTo(0, y + 10 + r() * 16); g.fill(); }
    // the street's buildings reflected in the lowest floor and a half: grey blocks with dark window dots, a green-netted one under construction
    if (o.reflect !== false) {
      let x = 0;
      while (x < W) {
        const w = (3 + r() * 6) * PX, h = (2 + r() * 3.4) * PX, net = r() < .22;
        g.fillStyle = net ? 'rgba(88,150,120,.55)' : `rgba(${110 + r() * 40 | 0},${118 + r() * 34 | 0},${122 + r() * 30 | 0},.62)`; g.fillRect(x, H - h, w, h);
        if (!net) { g.fillStyle = 'rgba(60,66,72,.5)'; for (let yy = H - h + 10; yy < H - 8; yy += 26) for (let xx = x + 8; xx < x + w - 10; xx += 22) g.fillRect(xx, yy, 9, 11); }
        else { g.strokeStyle = 'rgba(40,90,70,.5)'; g.lineWidth = 1; for (let k = 0; k < w; k += 9) { g.beginPath(); g.moveTo(x + k, H - h); g.lineTo(x + k + 30, H); g.stroke(); } }
        x += w + (1 + r() * 4) * PX;
      }
    }
    frame(g);
  }, { keep: true });
  const em = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    mods.slice(0, -1).forEach((x0, i) => { for (let f = 0; f < floors; f++) if (lit[i][f]) {
      const x1 = mods[i + 1], y0 = H - (f + 1) * FH;
      g.fillStyle = r() < .3 ? '#d6e6ff' : '#ffd9a6'; g.fillRect(x0 * PX + 3, y0 + 4, (x1 - x0) * PX - 6, FH * .786 - 6);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x0 * PX + 3, y0 + FH * .55, (x1 - x0) * PX - 6, FH * .24);   // desks and people against the light
    } });
    frame(g);
  }, { keep: true });
  return { map, em };
}

// a sign plate: a thin box with its face drawn on a canvas (opts: bg, fg, font, lines or draw)
function cbSign(w, h, draw, res = 256) {
  const t = canvasTex(res, Math.max(16, Math.round(res * h / w)), draw, { keep: true }), m = cbStd({ map: t, roughness: .55 });
  m.emissiveMap = t; m.emissive = new THREE.Color(.22, .22, .22);   // readable at night
  return m;
}
const cbText = (lines, bg, fg, font = '700 {s}px Arial, Helvetica, sans-serif', scale = .62) => (g, W, H) => {
  g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const s = Math.min(H / lines.length * scale, 999); g.font = font.replace('{s}', s);
  let fit = s; while (fit > 6 && Math.max(...lines.map((l) => g.measureText(l).width)) > W * .9) g.font = font.replace('{s}', --fit);
  lines.forEach((l, i) => g.fillText(l, W / 2, H * (i + .5) / lines.length + 1));
};

// ---------------------------------------------------------------- the build
function crescentBay(cx, cz) {
  const X = (x) => cx + CB.X0 + x, Z = (z) => cz + CB.Z0 + z;
  const { M, D, W } = CB;
  const sh = (w, h, d, m, x, y, z, o = {}) => { const me = new THREE.Mesh(cbGeo(w, h, d, o.s), m); me.position.set(X(x), y + h / 2, Z(z)); if (o.ry) me.rotation.y = o.ry; return add(me, o.p, o.cast !== false); };
  const slab = (x0, z0, x1, z1, h, m, y = 0, o) => sh(x1 - x0, h, z1 - z0, m, (x0 + x1) / 2, y, (z0 + z1) / 2, o);   // by its corners
  const soft = (w, h, d, m, x, y, z, o) => box(w, h, d, m, X(x), y, Z(z), o);
  const flat = (x0, z0, x1, z1, m, y, s) => plane(x1 - x0, z1 - z0, m, X((x0 + x1) / 2), y, Z((z0 + z1) / 2), s);
  const face = (w, h, m, x, y, z, ry = 0, p) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(X(x), y, Z(z)); me.rotation.y = ry; return add(me, p, false); };
  const look = (x, z, r, label, lines, verb = 'Look') => INTER.push({ x: X(x), z: Z(z), r, label, verb, act: () => talk(label, lines) });
  const block = (x0, z0, x1, z1) => colBox(X(x0), Z(z0), X(x1), Z(z1));   // z0 the north edge (smaller z)
  const P = cbOnce('mats', () => ({
    acp: cbStd({ color: 0x585b5c, roughness: .45 }), acpLight: cbStd({ color: 0x6f7373, roughness: .45 }),
    louvre: cbStd({ color: 0x878b90, roughness: .4 }), mullion: cbStd({ color: 0x51555b, roughness: .5 }),
    stone: std(canvasTex(128, 128, (g) => { const r = cbRng(7); g.fillStyle = '#a2978a'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < .5 ? '80,72,62' : '236,228,214'},${.08 + r() * .12})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); } }), 1, { roughness: .9 }),
    darkStone: std(canvasTex(128, 128, (g) => { const r = cbRng(9); g.fillStyle = '#626466'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < .5 ? '40,40,42' : '170,168,160'},${.1 + r() * .14})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); } }), 1.2, { roughness: .95 }),
    wall: std(canvasTex(64, 128, (g) => { g.fillStyle = '#a49d92'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#8e877d'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 63, 64, 2); }), 1.2, { roughness: .95 }),   // compound walls: grey cement panels with horizontal joints every 0.6 m
    tall: cbStd({ color: 0x8b8c89, roughness: .9 }), black: cbStd({ color: 0x4e4d51, roughness: .85 }), column: cbStd({ color: 0x6c6e72, roughness: .8 }),
    soffit: cbStd({ color: 0xe8e2d8, roughness: .9 }), pipe: cbStd({ color: 0xc23f30, roughness: .55 }),
    concrete: std(TX.concrete, 2, { color: 0xc9c6bf, roughness: .95 }),
    bars: cbStd({ color: 0x8a8682, roughness: .55 }), rust: cbStd({ color: 0x80573c, roughness: .8 }),
    post: cbStd({ color: 0xd9d3c6, roughness: .6 }), steel: cbStd({ color: 0x9a9ea4, roughness: .45 }), yellow: cbStd({ color: 0xf2c230, roughness: .5 }),
    deck: std(canvasTex(64, 64, (g) => { g.fillStyle = '#9a9ea3'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#6e7277'; for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 3); }), .4, { roughness: .6 }),
    pole: std(canvasTex(8, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ec' : '#d23a32'; g.fillRect(0, i * 8, 8, 8); } }, { keep: true }), 0, { roughness: .5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa9cbe0, transparent: true, opacity: .3, roughness: .08, depthWrite: false }),
    frosted: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, transparent: true, opacity: .55, roughness: .6, depthWrite: false }),
    marble: std(canvasTex(512, 512, (g) => {
      const r = cbRng(21); g.fillStyle = '#ece1d1'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < .5 ? '196,178,150' : '255,250,240'},.18)`; g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 4); }
      g.lineCap = 'round';
      for (let k = 0; k < 9; k++) {   // the brown veins, long and wandering, now and then splitting
        let x = r() * 512, y = 0; const dx = (r() - .5) * 1.6; g.strokeStyle = `rgba(${120 + r() * 30 | 0},${70 + r() * 20 | 0},${40 + r() * 15 | 0},${.55 + r() * .35})`; g.lineWidth = .8 + r() * 1.8;
        g.beginPath(); g.moveTo(x, y); while (y < 512) { x += dx * 8 + (r() - .5) * 14; y += 10 + r() * 14; g.lineTo(x, y); } g.stroke();
      }
    }, { keep: true }), 2.6, { roughness: .25 }),
    oak: std(canvasTex(128, 128, (g) => { const r = cbRng(5); g.fillStyle = '#c8a77f'; g.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 4) { g.fillStyle = `rgba(110,78,48,${.12 + r() * .14})`; g.fillRect(x, 0, 1.4, 128); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,215,.12)'; g.fillRect(r() * 128, 0, 1, 128); } }), .5, { roughness: .6 }),
    plaster: cbStd({ color: 0xf1ede6, roughness: .9, emissive: 0xfff4e4, emissiveIntensity: .35 }), liftSteel: cbStd({ color: 0xbfc2c4, roughness: .3 }), pot: cbStd({ color: 0x3f3d42, roughness: .5 }), white: cbStd({ color: 0xf4f2ee, roughness: .6 }),
    leaf: MAT.leafB, green: cbStd({ color: 0x3f8f4c, roughness: .6 }), red: cbStd({ color: 0xd8442e, roughness: .55 }), dg: cbStd({ color: 0xdedbd5, roughness: .6 }),
  }));
  const PAVE = cbOnce('pave', () => std(cbPaverTex(31, ['#cbbfae', '#bcb1a1', '#aca79f', '#98948d', '#827f7a'], [.28, .27, .2, .15, .1]), 1.6, { roughness: .92 }));

  // ---- the ground: pavers over the plot and the strip outside, concrete under the stilts, marble in the lobby ----
  flat(CB.WEST, CB.BACK, CB.EAST, CB.GATE, PAVE, .018, 0);
  flat(CB.WEST, CB.GATE, CB.EAST, CB.STRIP, cbStone(), .02, 2);   // the strip outside the gates in the same sandy stone tiles as the forecourt next door (cbStone, pune.js)
  // the 2 m between the east compound wall and the side street's footpath: stone along the frontage, then a kerbed planting bed running back
  // along the wall (an open stone lane here led nowhere, dead-ending at the neighbour's plinth)
  flat(CB.EAST, CB.GATE - .4, CB.EAST + 2.04, CB.STRIP, cbStone(), .02, 2);
  WALK.push([X(CB.EAST), Z(CB.GATE - .4), X(CB.EAST + 2.04), Z(CB.STRIP)]);
  slab(CB.EAST, CB.BACK, CB.EAST + 2.04, CB.GATE - .4, .18, P.stone, 0, { s: 1 });
  flat(CB.EAST + .1, CB.BACK + .1, CB.EAST + 1.94, CB.GATE - .5, MAT.dirt, .19);
  for (let z = CB.GATE - 1.2; z > CB.BACK + .6; z -= 1.1) bush(X(CB.EAST + 1.02), Z(z), .55 + ((z * 7.3) % 1 + 1) % 1 * .25, [MAT.leafA, MAT.leafC][Math.round(Math.abs(z)) % 2]);
  block(CB.EAST, CB.BACK, CB.EAST + 2.04, CB.GATE - .4);
  flat(CB.COLX[0] - .2, -D, CB.EV[1], -.35, P.concrete, .024, 2);   // the stilt car park's concrete floor, from just inside the facade line
  flat(CB.LOB[0] + .25, CB.LOB[3], CB.LOB[1] - .25, CB.LOB[2], P.marble, .03);
  // the rail the sliding gates run on, across the whole frontage and the drive
  slab(CB.WEST + .3, CB.GATE - .04, 18.0, CB.GATE + .04, .03, P.rust, .01, { cast: false });
  for (const [x, z, s] of [[6.2, 1.25, .7], [15.4, 1.1, .7], [21.5, -.7, .7], [29.4, -3.2, .6], [29.4, -9.5, .6], [-1.2, -6, .7], [9, -14.5, .6]]) {   // manhole covers and gratings (FIBROCAST 600 x 600)
    const m = cbOnce('manhole', () => std(canvasTex(64, 64, (g) => { g.fillStyle = '#8d8a84'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#7a7771'; for (let y = 6; y < 60; y += 7) for (let x = 6; x < 60; x += 7) g.fillRect(x, y, 4, 4); g.strokeStyle = '#6b6862'; g.lineWidth = 3; g.strokeRect(2, 2, 60, 60); }), 0, { roughness: .7 }));
    flat(x - s / 2, z - s / 2, x + s / 2, z + s / 2, m, .03);
  }

  // ---- the building above the stilts: three floors of glass over the grey band, on the module ----
  {
    const mods = (n, end) => { const a = []; for (let k = 0; k <= n; k++) a.push(k * M); if (end) a.push(n * M + end); return a; };
    const south = cbOnce('glassS', () => cbGlassTex(W, mods(21, .6 * M), CB.FLOORS, 3)), west = cbOnce('glassW', () => cbGlassTex(D, mods(10).map((x) => x * D / (10 * M)), CB.FLOORS, 4, { reflect: false }));
    const north = cbOnce('glassN', () => cbGlassTex(W, mods(21, .6 * M), CB.FLOORS, 5, { reflect: false, low: '#9cbad2' }));
    const gm = (t) => { const m = cbStd({ map: t.map, emissiveMap: t.em, emissive: 0xffffff, emissiveIntensity: 0, roughness: .22 }); m.userData.cbWindows = true; return m; };
    const eastM = cbOnce('eastFace', () => cbStd({ map: canvasTex(256, 128, (g) => { g.fillStyle = '#5e6266'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#9aa0a6'; for (let x = 0; x < 256; x += 8) g.fillRect(x, 0, 4, 128); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 256, 3); }, { keep: true }), roughness: .5 }));
    eastM.map.repeat.set(D / 4, CB.FLOORS);   // vertical aluminium slats down the east side (the service alley's view of it)
    const roof = MAT.roofFlat, H = CB.FLOOR * CB.FLOORS, y0 = CB.BAND[2];
    const body = new THREE.Mesh(cbGeo(W, H, D), [eastM, gm(west), roof, P.soffit, gm(south), gm(north)]);
    body.position.set(X(W / 2), y0 + H / 2, Z(-D / 2)); add(body);
    CBM.windows = [body.material[1], body.material[4], body.material[5]];
    // the slab under them all (the stilts' ceiling) and the band's own depth
    slab(0, -D, W, 0, y0 - CB.SOFFIT, P.acp, CB.SOFFIT);
    // the grey band: two rows of panels on the module, just proud of the glass, round the front and both sides
    const band = cbOnce('band', () => cbStd({ map: canvasTex(1024, 40, (g) => {
      g.fillStyle = '#585b5c'; g.fillRect(0, 0, 1024, 40); g.fillStyle = '#7f8383';
      const per = 1024 / CB.N; for (let k = 0; k <= CB.N; k++) g.fillRect(Math.round(k * per) - 1, 0, 2, 40);
      g.fillRect(0, Math.round(40 * (CB.BAND[2] - CB.BAND[1]) / (CB.BAND[2] - CB.BAND[0])), 1024, 2); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, 1024, 3);
    }, { keep: true }), roughness: .45 }));
    const bh = CB.BAND[2] - CB.BAND[0];
    { const m = new THREE.Mesh(cbGeo(W + .2, bh, .12), [P.acp, P.acp, P.acp, P.acp, band, P.acp]); m.position.set(X(W / 2), CB.BAND[0] + bh / 2, Z(.06)); add(m); }
    for (const x of [-.06, W + .06]) slab(x - .06, -D, x + .06, .12, bh, P.acp, CB.BAND[0]);
    // the wordmark on the band: white letters, the teal dot in the mouth of the C; it starts exactly at the tenth panel joint
    const word = cbOnce('word', () => {
      const t = canvasTex(1024, 210, (g, Wc, Hc) => {
        // the letters' tops (l, f) to the baseline fill the plane's height, and the word is drawn out to its width: the sign's lettering is wider set than the font
        const fs = Math.round(Hc * 1.27); g.font = `500 ${fs}px "Poppins", "Montserrat", "Helvetica Neue", Arial, sans-serif`; g.textBaseline = 'alphabetic';
        const tw = g.measureText('Calfus').width, k = (Wc - 6) / tw; g.setTransform(k, 0, 0, 1, 3, 0);
        const base = Hc - 3, cw = g.measureText('C').width; g.fillStyle = '#ffffff'; g.fillText('Calfus', 0, base);
        g.fillStyle = '#2fc1b0'; g.beginPath(); g.ellipse(cw * .8, base - fs * .53, fs * .1 / k, fs * .1, 0, 0, 7); g.fill();
      }, { keep: true });
      return new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .45, roughness: .4, depthWrite: false });
    });
    const wm = face(3.85, .8, word, 10 * M + .04 + 3.85 / 2, CB.BAND[0] + .1 + .4, .135); wm.renderOrder = 2; CBM.word = word;
    // top-hung windows propped open, as in the photos (module, floor, face): each a pane hinged at its top, tipped out
    for (const [k, f, side] of [[1, 1, 's'], [6, 0, 's'], [9, 1, 's'], [12, 0, 's'], [16, 1, 's'], [19, 0, 's'], [3, 0, 'w'], [7, 1, 'w']]) {
      const pane = new THREE.Mesh(new PlainBox(M - .12, 1.05, .04), P.glass); pane.geometry.translate(0, -.52, 0);
      const yTop = y0 + f * CB.FLOOR + 2.7;
      if (side === 's') { pane.position.set(X((k + .5) * M), yTop, Z(.03)); pane.rotation.x = -.42; }
      else { pane.position.set(X(-.03), yTop, Z(-(k + .5) * D / 10)); pane.rotation.set(0, Math.PI / 2, 0); pane.rotateX(-.42); }
      scene.add(pane);
    }
    // the parapet, the lift's machine room over the core, a water tank
    slab(-.05, -D - .05, W + .05, .05, .55, P.acpLight, y0 + H);
    slab(CB.CORE[0], CB.CORE[3] - .5, CB.CORE[1] - .4, CB.CORE[2] + .3, 3, P.acp, y0 + H);
    { const t = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 1.6, 20), P.white); t.position.set(X(20), y0 + H + .8, Z(-9.5)); add(t); }
  }

  // ---- the louvre band over the stilts: seven aluminium slats on a bracket at every module, along the front to the canopy and down the west side ----
  {
    const [l0, l1] = CB.LOUV, n = 7, step = (l1 - l0 - .09) / (n - 1), xEnd = CB.CAN[0];
    for (let i = 0; i < n; i++) {
      const y = l0 + i * step;
      slab(-.14, .02, xEnd, .16, .09, P.louvre, y);                 // the front
      slab(-.16, -D, -.02, .02, .09, P.louvre, y);                  // the west side
    }
    for (let k = 0; k * M <= xEnd + .01; k++) slab(k * M - .025, -.02, k * M + .025, .12, l1 - l0 + .05, P.mullion, l0 - .02, { cast: false });
    for (let z = 0; z >= -D; z -= M) slab(-.12, z - .025, -.02, z + .025, l1 - l0 + .05, P.mullion, l0 - .02, { cast: false });
  }
  // red sprinkler mains under the slab, with drops to their heads
  for (const z of [-1.6, -4.6, -7.6, -10.6]) {
    const len = CB.EV[1] - 1, p = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, len, 8), P.pipe); p.rotation.z = Math.PI / 2; p.position.set(X(.5 + len / 2), CB.SOFFIT - .18, Z(z)); add(p, null, false);
    for (let x = 2; x < len; x += 3) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .2, 6), P.pipe); d.position.set(X(x), CB.SOFFIT - .3, Z(z)); add(d, null, false); }
  }

  // ---- the stilts: the big dark columns down the west side and at the back ----
  for (const z of [-1, -6.5, -12.2]) { slab(CB.COLX[0], z - .55, CB.COLX[1], z + .55, CB.SOFFIT, P.column); block(CB.COLX[0], z - .55, CB.COLX[1], z + .55); }
  for (const x of [12.75, 8]) { slab(x - .35, -12.75, x + .35, -11.65, CB.SOFFIT, P.column); block(x - .35, -12.75, x + .35, -11.65); }
  // the WÖHR plate and its rules sheet on the west column's front, where the two-wheelers come in
  { const wohr = cbOnce('wohrSign', () => cbSign(.42, .6, (g, w, h) => { g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.textAlign = 'center'; g.font = '700 30px Arial'; g.fillText('WÖHR', w / 2, 40);
      g.strokeStyle = '#222'; g.lineWidth = 5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(40, 80 + i * 18); g.lineTo(90, 60 + i * 18); g.lineTo(130, 75 + i * 18); g.lineTo(175, 58 + i * 18); g.lineTo(216, 80 + i * 18); g.stroke(); }
      g.font = '600 15px Arial'; g.fillText('For Customer Service', w / 2, 175); g.font = '700 22px Arial'; g.fillText('1800 267 8848', w / 2, 205); g.font = '13px Arial'; g.fillText('www.wohrparking.in', w / 2, 235);
      g.fillStyle = '#ddd'; g.fillRect(30, 260, w - 60, 90); g.fillStyle = '#888'; for (let y = 270; y < 345; y += 9) g.fillRect(40, y, w - 80, 3); }));
    face(.42, .6, wohr, (CB.COLX[0] + CB.COLX[1]) / 2, 1.85, -.44); }

  // ---- the Wöhr puzzle stack parkers: four bays under the front, two levels; the lower level keeps one bay empty so its platforms can slide ----
  {
    const [f, b] = CB.PARK, xs = CB.POSTS, top = 2.75;
    for (const x of xs) for (const z of [f, b]) { slab(x - .09, z - .06, x + .09, z + .06, top, P.post); colCirc(X(x), Z(z), .14); }
    for (const z of [f, b]) slab(xs[0] - .12, z - .07, xs[4] + .12, z + .07, .3, P.post, 2.42);   // the cross beams the decks hang from
    for (const x of xs) slab(x - .07, b, x + .07, f, .22, P.post, 2.5);
    // hydraulic rams on the front posts, chains down them
    for (const x of xs.slice(1)) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 1.5, 10), P.yellow); c.position.set(X(x + .16), 1.05, Z(f - .02)); add(c); }
    const label = (txt) => cbOnce('num' + txt, () => cbSign(.16, .2, (g, w, h) => { g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `800 ${h * .72}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h * .54); }, 64));
    const wohrPlate = cbOnce('wohrPlate', () => cbSign(.3, .32, (g, w, h) => { g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c230'; g.fillRect(14, 36, w - 28, h - 56); g.fillStyle = '#222'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText('WÖHR', w / 2, 28);
      g.strokeStyle = '#222'; g.lineWidth = 6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(30, 150 - i * 30); g.lineTo(80, 110 - i * 30); g.lineTo(128, 130 - i * 30); g.lineTo(176, 110 - i * 30); g.lineTo(226, 150 - i * 30); g.stroke(); } }));
    const four = cbOnce('fourWheeler', () => cbSign(.42, .2, cbText(['FOUR', 'WHEELER', 'PARKING'], '#1f8a4c', '#ffffff', '800 {s}px Arial', .8), 128));
    const tops = [['8'], ['9', '10'], ['11', '12'], ['13', '14']], lows = [['1'], ['2', '3'], ['4', '5'], ['6', '7']];
    xs.slice(0, 4).forEach((x, i) => {
      tops[i].forEach((t, k) => face(.16, .2, label(t), x + .12, 2.62 - k * .22 + (tops[i].length > 1 ? .1 : 0), f + .08));
      lows[i].forEach((t, k) => face(.12, .16, label(t), x, k ? 1.0 : 2.22, f + .07));
      if (i % 2) face(.3, .32, wohrPlate, x - .26, 2.57, f + .08);
    });
    for (const x of [xs[0] - .5, (xs[1] + xs[2]) / 2 + .3]) face(.42, .2, four, x, 2.57, f + .08);
    // the control box on the second post: a screen and two buttons
    soft(.22, .34, .12, P.white, xs[1] - .2, 1.2, f + .02); face(.12, .1, cbOnce('screen', () => cbStd({ color: 0x5d7f98, emissive: 0x3a5a70, emissiveIntensity: .6, roughness: .3 })), xs[1] - .2, 1.44, f + .085);
    // the decks: an upper slatted deck in every bay; a lower platform with its wheel tracks and red-and-white guide poles in the first three
    for (let i = 0; i < 4; i++) {
      const x0 = xs[i] + .11, x1 = xs[i + 1] - .11, xm = (x0 + x1) / 2;
      slab(x0, b + .15, x1, f - .15, .12, P.deck, 2.0);
      if (i < 3) {
        slab(x0 + .05, b + .25, x1 - .05, f - .25, .1, P.deck, .02);
        for (const s of [-.72, .72]) slab(xm + s - .16, b + .25, xm + s + .16, f - .25, .16, P.steel, .02);
        for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.15, 8), P.pole); p.position.set(X(xm + s * 1.02), .6, Z(f - .3)); add(p, null, false); }
      }
    }
    // the cars, nose in: four on the upper decks, three below (the supercars that used to fill the open lot next door went upstairs)
    const CARS = [
      ['ferrari', 0xf2c40f, 'Ferrari 458 Italia', 'A Ferrari 458 in Giallo yellow, parked on the upper deck. Whoever parks on top leaves last.'],
      ['jesko', null, 'Koenigsegg Jesko', 'A Koenigsegg Jesko on the second deck. The lift took one look at it and went very slowly.'],
      ['m4', null, 'BMW M4', 'A widebody BMW M4 in deep teal, waiting on the third deck.'],
      ['concept', null, 'Concept car', 'A pearl-white concept car on the top deck by the EV bay. No badge. The owner says "it\'s in beta".'],
    ];
    const LOWER = [['creta', 0x26272b, 'Hyundai Creta', 'A black Creta, nose in, slot 1.'], ['creta', 0x3a3c40, 'Skoda Kylaq', 'A charcoal compact SUV in slot 3, MH12 plates.'], ['scorpio', 0x2a2b2f, 'Mahindra Scorpio-N', 'A black Scorpio-N in slot 5.']];
    for (let i = 0; i < 4; i++) {
      const xm = (xs[i] + xs[i + 1]) / 2, zc = (f + b) / 2;
      const [kind, paint, name, line] = CARS[i];
      sportsCar(kind, X(xm), Z(zc), Math.PI, { collide: false, paint: paint ?? undefined }).position.y = 2.12;
      if (i < 3) { const [k2, p2, n2, l2] = LOWER[i]; sportsCar(k2, X(xm), Z(zc), Math.PI, { collide: false, paint: p2 }).position.y = .12; look(xm, f + 1.05, 1.1, n2, [l2, `Above it: ${name}. ${line}`]); }
      else look(xm, f + 1.05, 1.1, name, [line, 'The bay underneath stays empty: the lower platforms slide into it to let the top one down.']);
      block(xs[i] + .05, b, xs[i + 1] - .05, f - .1);
    }
    look(xs[0] + .5, f + 1.2, 1.4, 'Stack parker', ['A Wöhr puzzle stack parker (Vyas Group Venture): fourteen numbered slots, upper 8 to 14, lower 1 to 7.', 'Customer service: 1800 267 8848. Park at your own risk.']);
  }

  // ---- the EV bay: the drive's black back wall with the charger, the electrical panels, the grey Hyryder plugged in, the guard's chair ----
  {
    slab(14.4, CB.EVBACK - .3, CB.EV[1], CB.EVBACK, CB.SOFFIT, P.black); block(14.4, CB.EVBACK - .3, CB.EV[1], CB.EVBACK);
    slab(14.4, -D + .2, CB.EV[1], CB.EVBACK - .3, CB.SOFFIT, P.acp); block(14.4, -D + .2, CB.EV[1], CB.EVBACK - .3);   // the service room behind it
    soft(.5, .62, .2, cbOnce('evBox', () => cbStd({ color: 0xb9bcbe, roughness: .4 })), 16.3, .95, CB.EVBACK + .12);
    face(.24, .24, cbOnce('evWin', () => cbStd({ color: 0x3e4a55, emissive: 0x2a8a5a, emissiveIntensity: .5, roughness: .2 })), 16.3, 1.28, CB.EVBACK + .225);
    face(.42, .16, cbOnce('evSign', () => cbSign(.42, .16, cbText(['EV CHARGING STATION'], '#1f8a4c', '#fff', '800 {s}px Arial', .55), 160)), 17.25, 2.15, CB.EVBACK + .02);
    face(.46, .34, cbOnce('evNotice', () => cbStd({ color: 0xd9d5cc, roughness: .7 })), 17.0, 1.35, CB.EVBACK + .02);
    soft(1.25, 2.2, .5, cbOnce('panel', () => cbStd({ color: 0xb6b9b7, roughness: .55 })), 15.05, 0, CB.EVBACK + .27);   // the LT panels: meters and switches
    for (const [dx, dy] of [[-.3, 1.55], [.2, 1.55], [-.3, 1.0], [.2, 1.0]]) face(.12, .16, cbOnce('meter', () => cbStd({ color: 0x3b4148, roughness: .3 })), 15.05 + dx, dy, CB.EVBACK + .53);
    block(14.4, CB.EVBACK, 15.7, CB.EVBACK + .55);
    sportsCar('creta', X(17.0), Z(-4.95), Math.PI, { paint: 0x6c7176 });
    look(17.0, -1.6, 1.6, 'EV bay', ['A grey Toyota Hyryder on charge against the black wall. The charger blinks a slow green.', 'Behind it, the LT panels hum.']);
    // the guard's black plastic chair
    const ch = cbOnce('chair', () => cbStd({ color: 0x3a3a3f, roughness: .6 }));
    soft(.48, .06, .46, ch, 13.4, .44, -1.2); soft(.46, .48, .05, ch, 13.4, .5, -1.43); for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) slab(13.4 + dx - .02, -1.2 + dz - .02, 13.4 + dx + .02, -1.2 + dz + .02, .44, ch, 0, { cast: false });
    pointLight('pune', 0xf4f0e6, .8, 10, X(14.5), 3.6, Z(-3.5));
  }

  // ---- the lobby block: its black west wall to the EV bay, the glass front, the dark stone wall beside it ----
  const [lx0, lx1, lz0, lz1] = CB.LOB;
  {
    // west wall: black outside, oak inside
    { const m = new THREE.Mesh(cbGeo(.25, CB.SOFFIT, -lz1 + lz0 + (D + lz1), 1), [P.oak, P.black, P.black, P.black, P.black, P.black]); m.position.set(X(lx0 + .125), CB.SOFFIT / 2, Z((lz0 - D) / 2)); add(m); block(lx0, -D, lx0 + .25, lz0); }
    // the dark stone wall east of the glass, and the walls round the lift core and the back rooms
    slab(CB.GLASS[1], lz0 - .25, lx1, lz0, CB.CAN[3], P.darkStone, 0, { s: 1.2 }); block(CB.GLASS[1], lz0 - .25, lx1, lz0);
    slab(CB.GLASS[1], lz0 - .25, lx1, lz0, CB.SOFFIT - CB.CAN[3], P.acp, CB.CAN[3]);
    slab(lx0, lz1 - .25, lx1, lz1, CB.SOFFIT, P.oak, 0, { s: .5 }); block(lx0, lz1 - .25, lx1, lz1);
    slab(lx0, -D + .2, lx1, lz1 - .25, CB.SOFFIT, P.acp); block(lx0, -D + .2, lx1, lz1 - .25);
    // the lobby's ceiling with its tray, and the glass front's transom zone above the door
    slab(lx0 + .25, lz1, lx1, lz0, .25, P.plaster, 3.9);
    slab(lx0 + 1.6, lz1 + 1.4, CB.CORE[0] - 1, lz0 - 1.2, .3, P.plaster, 3.6);
    slab(lx0, lz0 - .1, CB.GLASS[1], lz0, CB.SOFFIT - CB.CAN[3], P.acp, CB.CAN[3]);
    // the glass front: three bays and a transom in dark grey frames; the middle bay is the sliding door
    const [g0, g1] = CB.GLASS, [d0, d1] = CB.DOOR, gt = CB.CAN[3];
    for (const x of [g0, d0, d1, g1]) slab(x - .04, lz0 - .06, x + .04, lz0 + .04, gt, P.mullion);
    slab(g0, lz0 - .06, g1, lz0 + .04, .08, P.mullion, 2.55); slab(g0, lz0 - .06, g1, lz0 + .04, .06, P.mullion, 0);
    for (const [a, c] of [[g0, d0], [d1, g1]]) { face(c - a - .08, 2.5, P.glass, (a + c) / 2, 1.28, lz0); block(a, lz0 - .08, c, lz0 + .06); }
    face(g1 - g0 - .08, gt - 2.63, P.glass, (g0 + g1) / 2, 2.6 + (gt - 2.63) / 2, lz0);
    // the door leaves slide apart when somebody comes near (a frosted band at eye height on each)
    const leaves = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry((d1 - d0) / 2 - .05, 2.48), P.glass); pane.position.y = 1.27; g.add(pane);
      const band = new THREE.Mesh(new THREE.PlaneGeometry((d1 - d0) / 2 - .08, .22), P.frosted); band.position.set(0, 1.12, .01); g.add(band);
      const rim = new THREE.Mesh(new PlainBox((d1 - d0) / 2 - .02, .05, .05), P.mullion); rim.position.y = 2.5; g.add(rim);
      return { g, s };
    });
    for (const [a, c] of [[g0, d0], [d1, g1]]) face(c - a - .1, .22, P.frosted, (a + c) / 2, 1.12, lz0 + .01);
    const mid = (d0 + d1) / 2, half = (d1 - d0) / 4; let open = 0;
    life.push((t, dt) => {
      if (zone !== 'pune') return;
      const near = Math.abs(hero.x - X(mid)) < 2 && Math.abs(hero.y - Z(lz0)) < 2.6;
      open += ((near ? 1 : 0) - open) * Math.min(1, dt * 6);
      for (const { g, s } of leaves) g.position.set(X(mid + s * (half + open * (half * 2 - .05))), 0, Z(lz0 - .03));
    });
    soft(1.4, .02, .9, cbOnce('mat', () => cbStd({ color: 0x55565b, roughness: 1 })), mid, .03, lz0 - .7, { cast: false });   // the doormat
  }

  // ---- the lobby: cream marble, oak walls with the big C, the lift in its marble core, the hackathon banner ----
  {
    const [c0, c1, cz0, cz1] = CB.CORE;
    const CW = CB.CW, az = (lz0 + cz0) / 2;   // the alcove south of the core, by the glass: its oak east wall faces you as you come in
    slab(c0, cz1, c1, cz0, CB.SOFFIT, P.marble, 0, { s: 2.6 }); block(c0, cz1, c1, cz0);
    // the lift doors (brushed steel, a frame proud of the marble), the call buttons glowing beside them
    const lz = (cz0 + cz1) / 2;
    slab(c0 - .06, lz - .68, c0, lz + .68, 2.42, P.liftSteel);
    for (const s of [-1, 1]) face(.6, 2.25, P.liftSteel, c0 - .07, 1.13, lz + s * .3, -Math.PI / 2);
    face(.08, .2, cbOnce('call', () => cbStd({ color: 0x2b2d31, emissive: 0x9fe6ff, emissiveIntensity: .8 })), c0 - .07, 1.15, lz - .95, -Math.PI / 2);
    // the IGBC Gold plaque on the core's front
    face(.3, .3, cbOnce('igbc', () => cbSign(.3, .3, (g, w, h) => { g.fillStyle = '#8a6b2e'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill(); g.fillStyle = '#e8cf8a'; g.beginPath(); g.arc(w / 2, h / 2, w * .4, 0, 7); g.fill(); g.fillStyle = '#2f6a8a'; g.beginPath(); g.arc(w / 2, h / 2, w * .2, 0, 7); g.fill(); g.fillStyle = '#5a4520'; g.font = '700 16px Arial'; g.textAlign = 'center'; g.fillText('IGBC · GOLD', w / 2, h * .86); }, 128)), CW - .35, 1.9, cz0 + .01);
    // the big C: a black ring with the teal dot, on the oak of the alcove by the door, two white fluted planters under it; a second one over the banner at the back
    const cMat = cbOnce('bigC', () => { const t = canvasTex(256, 256, (g) => { g.clearRect(0, 0, 256, 256); g.strokeStyle = '#1e1d22'; g.lineWidth = 34; g.beginPath(); g.arc(122, 134, 92, Math.PI * .27, Math.PI * 1.86, false); g.stroke(); g.fillStyle = '#3cc6ae'; g.beginPath(); g.arc(196, 66, 26, 0, 7); g.fill(); }, { keep: true });
      return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .5, depthWrite: false }); });
    slab(CW, cz0, CW + .25, lz0, CB.SOFFIT, P.oak, 0, { s: .5 }); block(CW, cz0, lx1, lz0);
    face(1.1, 1.1, cMat, CW - .01, 2.15, az, -Math.PI / 2).renderOrder = 2;
    face(1.0, 1.0, cMat, c0 - 1.3, 2.35, lz1 + .01).renderOrder = 2;   // and a second one on the back wall, over the banner
    const planter = cbOnce('planter', () => new THREE.CylinderGeometry(.27, .24, .5, 24));
    for (const dz of [-.5, .5]) { const p = new THREE.Mesh(planter, P.white); p.position.set(X(CW - .42), .25, Z(az + dz)); add(p); const l = add(new THREE.Mesh(jitterSphere(.36, 1), P.leaf)); l.position.set(X(CW - .42), .72, Z(az + dz)); colCirc(X(CW - .42), Z(az + dz), .3); }
    // black pots with aglaonema along the oak west wall and by the lift
    for (const [x, z] of [[lx0 + .55, -4.2], [lx0 + .55, -6.4], [lx0 + .55, -8.6], [c0 - .45, cz1 - .6], [c0 - .35, lz1 + .5]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, Math.PI * .28, Math.PI * .72), P.pot); p.position.set(X(x), .3, Z(z)); add(p);
      const l = add(new THREE.Mesh(jitterSphere(.34, 1), MAT.leafA)); l.position.set(X(x), .78, Z(z)); l.scale.y = 1.25;
      colCirc(X(x), Z(z), .32);
    }
    // the hackathon roll-up banner, a steel bin by the door
    const banner = cbOnce('banner', () => cbSign(.8, 2, (g, w, h) => {
      g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h);
      const sw = g.createLinearGradient(0, h * .3, w, h * .55); sw.addColorStop(0, 'rgba(60,200,170,0)'); sw.addColorStop(.6, 'rgba(60,200,170,.5)'); sw.addColorStop(1, 'rgba(60,200,170,0)'); g.fillStyle = sw; g.fillRect(0, h * .3, w, h * .3);
      g.fillStyle = '#fff'; g.font = '600 15px Arial'; g.fillText('Calfus  ⊗  Aetherion', 14, 30); g.font = '700 13px Arial'; g.fillText('EP- H2 26', w - 80, 30);
      g.fillStyle = '#5fe0c0'; g.font = '600 12px Arial'; g.fillText('● 36:00:00', 14, 64);
      g.fillStyle = '#ffffff'; g.font = '800 30px Arial'; g.fillText('SCHRÖDINGER\'S', 14, 300); g.fillStyle = '#5fe0c0'; g.font = 'italic 800 46px Arial'; g.fillText('SPRINT', 14, 350);
      g.fillStyle = '#fff'; g.font = '600 13px Arial'; g.fillText('Hackathon', 14, 372); g.fillText('From first line to enterprise-ready', 14, 410);
      g.fillStyle = '#5fe0c0'; g.font = '800 34px Arial'; g.fillText('DECEMBER', 14, 520); g.fillText('4–5, 2026', 14, 558);
      g.fillStyle = '#ddd'; g.font = '600 11px Arial'; g.fillText('NORTH AMERICA | INDIA | UK', 14, 600);
    }, 256));
    const bx = c0 - 1.15, bz = lz1 + .45;
    face(.8, 2, banner, bx, 1.08, bz); soft(.86, .07, .22, P.steel, bx, 0, bz);
    look(bx, bz + 1, 1.3, 'Schrödinger\'s Sprint', ['A roll-up banner: Calfus and Aetherion, Schrödinger\'s Sprint. A 36-hour hackathon, December 4 to 5, 2026.', '"Where bold ideas become real solutions. From first line to enterprise-ready." North America, India, UK.'], 'Read');
    { const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .6, 16), P.liftSteel); b2.position.set(X(20.6), .3, Z(lz0 - .55)); add(b2); colCirc(X(20.6), Z(lz0 - .55), .2); }
    look(CW - 1, az, 1.2, 'The big C', ['The Calfus C, black on oak, its teal dot in the mouth of the letter.', 'Beside it on the marble, a brass plaque: IGBC Green New Building, Gold. 35 Crescent Bay.']);
    // the lift: up to the HQ's second floor or its fourth (office-hq.js, office-hq4.js); one call point either side of the doors' middle
    INTER.push({ x: X(c0 - .8), z: Z(lz - .45), r: 1.3, label: 'Lift · Floor 2', verb: 'Ride up', act: () => { if (!traveling) travel({ to: 'lab', zone: 'pune', label: 'Calfus HQ' }); } });
    INTER.push({ x: X(c0 - .8), z: Z(lz + .45), r: 1.3, label: 'Lift · Floor 4', verb: 'Ride up', act: () => { if (!traveling) travel({ to: 'lab4', zone: 'pune', label: 'Calfus HQ' }); } });
    pointLight('pune', 0xffe6c4, 1.8, 10, X((lx0 + c0) / 2), 3.3, Z(-4.4)); pointLight('pune', 0xffe6c4, 1.4, 9, X((lx0 + c0) / 2), 3.3, Z(-8.2));
  }

  // ---- the canopy: a deep dark box over the walk to the lobby door, square downlights in its soffit ----
  {
    const [a, c, zf, ys, yt] = CB.CAN, zb = CB.LOB[2];
    const soffitT = cbOnce('canSoffit', () => { const t = canvasTex(128, 128, (g) => { g.fillStyle = '#4f5254'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#6a6d6f'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128); }, { keep: true }); return t; });
    const sm = cbStd({ map: soffitT, roughness: .5 }); sm.map.repeat.set((c - a) / 1.24, (zf - zb) / 1.24);
    const m = new THREE.Mesh(cbGeo(c - a, yt - ys, zf - zb), [P.acpLight, P.acpLight, P.acp, sm, P.acpLight, P.acp]); m.position.set(X((a + c) / 2), (ys + yt) / 2, Z((zf + zb) / 2)); add(m);
    CBM.canopy = m;
    const dl = cbOnce('downlight', () => new THREE.MeshStandardMaterial({ color: 0xfff6e2, emissive: 0xfff0d0, emissiveIntensity: .3 })); CBM.downlight = dl;
    for (let x = a + 1.1; x < c - .5; x += 2.2) for (const z of [zb + .9, zf - .8]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), dl); q.rotation.x = Math.PI / 2; q.position.set(X(x), ys - .005, Z(z)); scene.add(q); }
    pointLight('pune', 0xffdcb0, 1.2, 9, X((a + c) / 2), 3.4, Z(-.4));
    // pots under it: a grey ribbed one with a frangipani by the gate, black ones with aglaonema by the glass
    const rib = cbOnce('ribPot', () => cbStd({ color: 0x8e8f8d, roughness: .7 }));
    { const p = new THREE.Mesh(new THREE.CylinderGeometry(.34, .26, .55, 18), rib); p.position.set(X(18.9), .275, Z(1.85)); add(p); colCirc(X(18.9), Z(1.85), .3);
      for (const [dx, dy, dz, r] of [[0, 1.2, 0, .45], [.25, 1.55, .1, .3], [-.22, 1.45, -.08, .32]]) { const l = add(new THREE.Mesh(jitterSphere(r, 1), MAT.leafA)); l.position.set(X(18.9 + dx), dy, Z(1.85 + dz)); }
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 1, 6), MAT.bark); tr.position.set(X(18.9), .95, Z(1.85)); add(tr); }
    for (const x of [19.75, 25.15]) { const p = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 10, 0, Math.PI * 2, Math.PI * .28, Math.PI * .72), P.pot); p.position.set(X(x), .28, Z(-1.85)); add(p); const l = add(new THREE.Mesh(jitterSphere(.3, 1), MAT.leafA)); l.position.set(X(x), .72, Z(-1.85)); colCirc(X(x), Z(-1.85), .3); }
    face(.32, .16, cbOnce('twoWheel', () => cbSign(.32, .16, cbText(['TWO WHEELER', 'PARKING  →'], '#1f8a4c', '#fff', '800 {s}px Arial', .8), 128)), CB.GLASS[1] + .5, 1.75, CB.LOB[2] + .01);
  }

  // ---- the frontage on the lane: sliding bar gates on their rail, stone pillars, the name plate, the walk-in gate, the tall wall ----
  {
    const barGate = (x0, x1, z, h = 1.6) => {   // grey flat bars between a top and a bottom rail, little wheels on the rail
      slab(x0, z - .04, x1, z + .04, .08, P.bars, .07); slab(x0, z - .04, x1, z + .04, .07, P.bars, h - .07);
      for (let x = x0 + .05; x < x1 - .02; x += .09) slab(x - .02, z - .006, x + .02, z + .006, h - .14, P.bars, .14, { cast: false });
      for (const x of [x0 + .35, x1 - .35]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .05, 12), P.steel); w.rotation.x = Math.PI / 2; w.position.set(X(x), .08, Z(z)); add(w, null, false); }
      block(x0, z - .12, x1, z + .12);
    };
    const pillar = (x0, x1, z0, z1, h, m = P.stone) => { slab(x0, z0, x1, z1, h, m, 0, { s: 1 }); slab(x0 - .03, z0 - .03, x1 + .03, z1 + .03, .06, m, h, { s: 1 }); block(x0, z0, x1, z1); };
    const G = CB.GATE;
    slab(CB.WEST + .14, G - .05, CB.WEST + .24, G + .05, 1.75, P.mullion); block(CB.WEST, G - .1, CB.WEST + .3, G + .1);   // the gate's guide post at the west end
    barGate(CB.WEST + .3, 4.3, G); barGate(4.3, 9.37, G); pillar(9.37, 10.23, G - .37, G + .38, 2.1);
    barGate(10.23, 12.5, G + .1);   // the drive gate's leaf, slid back to open the drive
    // the name plate pillar: grey stone, two reveals, the brushed-steel plate, a lantern on its corner
    const [p0, p1, pz0, pz1, ph] = [18.06, 20.31, G + .2, G + .65, 2.05];
    pillar(p0, p1, pz0, pz1, ph, cbOnce('plateStone', () => std(canvasTex(128, 128, (g) => { const r = cbRng(11); g.fillStyle = '#a3998c'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${r() < .5 ? '78,70,60' : '236,228,214'},${.07 + r() * .1})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); } }), 1, { roughness: .92 })));
    for (const y of [.37, 1.78]) slab(p0 - .005, pz1 - .002, p1 + .005, pz1 + .01, .025, cbOnce('reveal', () => cbStd({ color: 0x7a7268, roughness: .9 })), y, { cast: false });
    const plate = cbOnce('namePlate', () => cbSign(.95, .62, (g, w, h) => {
      const br = g.createLinearGradient(0, 0, w, h); br.addColorStop(0, '#b9b9b4'); br.addColorStop(.5, '#d6d6d0'); br.addColorStop(1, '#a9a9a3'); g.fillStyle = br; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
      g.fillStyle = '#26262a'; g.textAlign = 'center';
      g.font = '600 64px "Poppins", "Helvetica Neue", Arial, sans-serif'; g.fillText('Calfus', w / 2, 72);
      g.font = '700 20px Arial'; g.fillText('Calfus Technologies India Private Limited', w / 2, 112);
      g.font = '15px Arial'; g.fillText('35 Crescent Bay, SR No 35, Opp GS Moze College,', w / 2, 140); g.fillText('Balewadi, Pune, Maharashtra 411045', w / 2, 160);
      g.font = '600 17px "Kohinoor Devanagari", "Devanagari Sangam MN", "Noto Sans Devanagari", Arial'; g.fillText('कॅल्फस टेक्नॉलॉजीज इंडिया प्रायव्हेट लिमिटेड', w / 2, 192);
      g.font = '13px "Kohinoor Devanagari", "Noto Sans Devanagari", Arial'; g.fillText('३५, क्रेसेंट बे, बालेवाडी, पुणे, महाराष्ट्र - ४११०४५', w / 2, 214);
      g.font = '700 18px Arial'; g.fillText('GSTIN - 27AAKCC1455E1ZT', w / 2, 246);
    }, 512));
    { const pm = new THREE.Mesh(new PlainBox(.95, .62, .02), [P.steel, P.steel, P.steel, P.steel, plate, P.steel]); pm.position.set(X((p0 + p1) / 2), 1.55, Z(pz1 + .012)); add(pm, null, false); }
    { const lt = cbOnce('lantern', () => new THREE.MeshStandardMaterial({ color: 0xf6f1e4, emissive: 0xfff2d6, emissiveIntensity: .5, roughness: .4 })); CBM.lantern = lt;
      soft(.2, .26, .2, lt, p0 + .25, ph, pz0 + .22, { cast: false }); soft(.24, .04, .24, P.steel, p0 + .25, ph + .26, pz0 + .22, { cast: false }); }
    look((p0 + p1) / 2, pz1 + .9, 1.4, 'Name plate', ['Calfus Technologies India Private Limited. 35 Crescent Bay, SR No 35, Opp GS Moze College, Balewadi, Pune, Maharashtra 411045.', 'The same again in Marathi underneath, and the GSTIN. The walk-in gate is just to the right.'], 'Read');
    // the walk-in gate, a sliding leaf like the rest, run back behind the tall wall to leave the gap open; the tall pillar and the tall grey wall that hides the generator
    barGate(23.6, 24.95, G - .32);
    pillar(22.9, 23.5, G - .3, G + .25, 2.5, P.tall);
    slab(23.5, G - .2, CB.EAST, G + .2, 2.4, P.tall); block(23.5, G - .2, CB.EAST, G + .2);
    // its planter strip outside: a kerb, pygmy date palms and two young trees
    slab(23.7, G + .2, 28.6, G + 1.0, .14, P.stone, 0, { s: 1 }); flat(23.8, G + .25, 28.5, G + .95, MAT.dirt, .15); block(23.7, G + .2, 28.6, G + 1.0);
    const frond = cbOnce('frond', () => cbStd({ color: 0x4f8f45, roughness: .7, side: THREE.DoubleSide }));
    for (const [x, sc] of [[24.3, 1], [25.6, 1.15], [26.9, .95], [28.0, 1.05]]) {
      for (let k = 0; k < 9; k++) {   // a clump of arching fronds
        const a = k / 9 * Math.PI * 2 + x, f = new THREE.Mesh(new THREE.PlaneGeometry(.16, .9 * sc), frond); f.geometry.translate(0, .45 * sc, 0);
        f.position.set(X(x), .3, Z(G + .6)); f.rotation.set(0, a, .9 + (k % 3) * .15); scene.add(f);
      }
    }
    for (const x of [24.9, 27.4]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 3.2, 6), MAT.bark); t.position.set(X(x), 1.75, Z(G + .6)); add(t);
      for (const [dy, r, dx] of [[3.3, .55, 0], [2.9, .45, .3], [3.6, .38, -.25]]) { const l = add(new THREE.Mesh(jitterSphere(r, 1), MAT.leafA)); l.position.set(X(x + dx), dy, Z(G + .6)); } }
    // the boundary walls: low cement-panel walls down the west and east sides and across the back
    slab(CB.WEST, CB.BACK, CB.WEST + .25, G - .3, 1.6, P.wall, 0, { s: 1.2 }); block(CB.WEST, CB.BACK, CB.WEST + .25, G - .3);
    slab(CB.EAST - .25, CB.BACK, CB.EAST, G - .2, 1.8, P.wall, 0, { s: 1.2 }); block(CB.EAST - .25, CB.BACK, CB.EAST, G - .2);
    slab(CB.WEST, CB.BACK, CB.EAST, CB.BACK + .25, 1.8, P.wall, 0, { s: 1.2 }); block(CB.WEST, CB.BACK, CB.EAST, CB.BACK + .25);
  }

  // ---- the west side: the two-wheelers parked nose-in against the wall, under the floors' overhang; the hose box and the signs ----
  {
    const named = [['r15', 'Yamaha R15M', 'A Yamaha R15M in metallic grey, with blue wheels and gold forks.'], ['vstrom', 'Suzuki V-Strom', 'A yellow Suzuki V-Strom SX, ready for a long ride.'],
      ['avenger', 'Bajaj Avenger', 'A Bajaj Avenger 180 cruiser, all chrome and low seat.'], ['thruxton', 'Royal Enfield Thruxton', 'A red and black café racer with wire wheels and clip-on bars.'],
      ['gsxr', 'Suzuki GSX-R 750', 'A 2010 Suzuki GSX-R 750. Somebody here likes their mornings fast.']];
    const colours = [0x1c1c20, 0xc8352b, 0x8a8a90, 0xe8e6e0, 0x2b4a8a, 0x1c1c20, 0x3a3a3f];
    let k = 0;
    for (let z = 1.1; z > -12.5; z -= .95, k++) {
      const x = CB.WEST + 1.2;
      if (k % 3 === 1 && named[(k / 3) | 0]) {
        const [kind, name, line] = named[(k / 3) | 0];
        if (kind === 'avenger' || kind === 'gsxr') bikeModel(kind, X(x), Z(z), -Math.PI / 2, { lean: .08 }); else bike(X(x), Z(z), -Math.PI / 2, kind);
        INTER.push({ x: X(x + 1.5), z: Z(z), r: .9, label: name, verb: 'Look', act: () => talk(name, [line]) });
      } else { const s = scooter(colours[k % colours.length]); s.position.set(X(x - .1), 0, Z(z)); s.rotation.y = -Math.PI / 2; }
    }
    block(CB.WEST + .25, -12.9, CB.WEST + 1.85, 1.5);
    const hose = cbOnce('hoseBox', () => cbSign(.62, .78, (g, w, h) => { g.fillStyle = '#e8582e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 34px Arial'; g.textAlign = 'center'; g.fillText('HOSE BOX', w / 2, 46); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(30, 70, w / 2 - 40, h - 100); g.fillRect(w / 2 + 10, 70, w / 2 - 40, h - 100); }));
    const hoseBox = (x, z, ry) => { const b = new THREE.Mesh(new PlainBox(.62, .78, .3), [P.red, P.red, P.red, P.red, hose, P.red]); b.position.set(X(x), 1.25, Z(z)); b.rotation.y = ry; add(b); };
    hoseBox(CB.WEST + .41, 1.95, Math.PI / 2);
    for (const dz of [0, .45]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .9, 10), P.red); h.position.set(X(CB.WEST + .5), .45, Z(1.6 + dz)); add(h); }
    face(.45, .18, cbOnce('ownRisk', () => cbSign(.45, .18, cbText(['PARK AT', 'YOUR OWN RISK'], '#1f8a4c', '#fff', '800 {s}px Arial', .8), 128)), CB.WEST + .26, 1.3, -2.4, Math.PI / 2);
    face(.2, .26, cbOnce('noSmoke', () => cbSign(.2, .26, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d23a32'; g.lineWidth = 12; g.beginPath(); g.arc(w / 2, h * .42, w * .32, 0, 7); g.moveTo(w * .28, h * .2); g.lineTo(w * .72, h * .64); g.stroke(); g.fillStyle = '#222'; g.font = '700 20px Arial'; g.textAlign = 'center'; g.fillText('NO SMOKING', w / 2, h * .92); }, 128)), CB.WEST + .26, 1.35, -3.4, Math.PI / 2);
    look(CB.WEST + 2.5, -4, 1.4, 'Two-wheeler parking', ['A row of bikes and scooters, nose to the wall, helmets hung on the mirrors.', 'A green sign: Park at your own risk.']);
    CBM.hoseBox = hoseBox;
  }

  // ---- the east side: the service alley. The generator behind the tall wall, the mirror and the hose box, the OWC, the bins, the lift's back door ----
  {
    const ex = CB.LOB[1];
    // the Kirloskar Green DG set: a white acoustic enclosure with hinged doors, its silencer drum on top
    const dgFace = cbOnce('dgFace', () => cbSign(3.4, 1.9, (g, w, h) => {
      g.fillStyle = '#e3e0da'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8b4ad'; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const x = 24 + i * (w - 48) / 4; g.strokeRect(x + 6, 40, (w - 48) / 4 - 12, h - 80); g.fillStyle = '#8d8a84'; g.fillRect(x + (w - 48) / 4 - 34, h / 2 - 10, 14, 22); }
      g.fillStyle = '#2b8a4a'; g.font = '700 30px Arial'; g.fillText('kirloskar', 40, 36); g.font = '700 18px Arial'; g.fillText('kirloskar GREEN', w * .52, h * .62);
      g.fillStyle = '#444'; g.fillRect(w - 70, 60, 50, 40); g.fillStyle = '#fff'; g.font = '700 26px Arial'; g.fillText('DG', w - 62, 90);
      g.fillStyle = '#2a2a2e'; g.fillRect(0, h - 22, w, 22);
    }, 512));
    const dg = new THREE.Mesh(new PlainBox(3.4, 1.9, 1.3), [P.dg, P.dg, P.dg, P.dg, P.dg, dgFace]); dg.position.set(X(ex + 1.9), .95, Z(1.55)); add(dg); block(ex + .2, .85, ex + 3.6, 2.25);
    { const s = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 2.1, 16), P.mullion); s.rotation.z = Math.PI / 2; s.position.set(X(ex + 2.1), 2.25, Z(1.55)); add(s);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .9, 10), P.mullion); p.position.set(X(ex + .9), 2.55, Z(1.55)); add(p); }
    look(ex + 1.9, .2, 1.6, 'DG set', ['A Kirloskar Green diesel generator in its white acoustic box, the silencer drum on top.', 'The tall grey wall at the front is there so nobody on the lane has to look at it.']);
    // on the east wall: the assembly point sign, the convex mirror, a hose box and the hydrant, the OWC sign
    face(.3, .34, cbOnce('assembly', () => cbSign(.3, .34, (g, w, h) => { g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h * .66); g.fillStyle = '#fff'; for (const [x, y] of [[w / 2, 60], [w * .3, 110], [w * .7, 110], [w / 2, 150]]) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } g.font = '800 22px Arial'; g.textAlign = 'center'; g.fillText('ASSEMBLY', w / 2, h * .84); g.fillText('POINT', w / 2, h * .95); }, 128)), CB.EAST - .26, 1.5, .2, -Math.PI / 2);
    { const g = new THREE.Group(); g.position.set(X(CB.EAST - .3), 1.75, Z(-.8)); g.rotation.y = -Math.PI / 2; scene.add(g);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.3, .045, 8, 28), P.red); g.add(rim);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .16, 24, 1, true, -Math.PI * .5, Math.PI), P.red); hood.rotation.x = Math.PI / 2; hood.position.set(0, .04, .08); hood.material = P.red; g.add(hood);
      const mirror = new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * .3), cbOnce('mirror', () => cbStd({ color: 0xd6dde3, roughness: .1 }))); mirror.rotation.x = Math.PI / 2; mirror.position.z = -.2; g.add(mirror); }
    CBM.hoseBox(CB.EAST - .41, -1.9, -Math.PI / 2);
    { const h = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.1, 10), P.red); h.position.set(X(CB.EAST - .45), .55, Z(-2.7)); add(h); }
    // the OWC (organic waste converter) and its sign
    { const owc = cbOnce('owcFace', () => cbSign(1.6, .85, (g, w, h) => { g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#2d4fa0'; g.fillRect(0, 0, 40, h); g.fillRect(w - 40, 0, 40, h); g.fillStyle = '#3c5fb0'; g.fillRect(w * .45, 30, 80, 30); g.fillStyle = '#c33'; g.beginPath(); g.arc(w * .62, 45, 9, 0, 7); g.fill(); }, 256));
      const b = new THREE.Mesh(new PlainBox(1.6, .85, .85), [P.dg, P.dg, P.dg, P.dg, owc, P.dg]); b.position.set(X(CB.EAST - .7), .43, Z(-4.8)); b.rotation.y = Math.PI / 2; add(b); block(CB.EAST - 1.15, -5.65, CB.EAST - .25, -3.95);
      face(.42, .24, cbOnce('owcSign', () => cbSign(.42, .24, cbText(['OWC'], '#2e2f33', '#fff', '800 {s}px Arial', .75), 128)), CB.EAST - .26, 1.3, -4.6, -Math.PI / 2);
      look(CB.EAST - 1.6, -4.8, 1.2, 'OWC', ['The organic waste converter. The canteen\'s wet waste goes in; compost for the planters comes out.']); }
    // scooters along the east wall
    const sc = [0xd8d6d0, 0x8a8a90, 0x1c1c20, 0xd8d6d0, 0x1c1c20, 0xc8352b, 0x2b4a8a];
    [[-.2, 2], [-1.1, 0], [-6.4, 4], [-7.3, 1], [-8.2, 5], [-13.5, 2], [-14.4, 6]].forEach(([z, c]) => { const s = scooter(sc[c]); s.position.set(X(CB.EAST - 1.05), 0, Z(z)); s.rotation.y = Math.PI / 2; });
    block(CB.EAST - 2, -1.6, CB.EAST - .25, .25); block(CB.EAST - 2, -8.7, CB.EAST - .25, -5.95); block(CB.EAST - 2, -14.9, CB.EAST - .25, -13);
    // the lobby block's east face: a louvred service door, the lift's back door between white fire-hose cabinets and the red risers, the glass bay, the slats, the bins' recess
    const [c0, c1, cz0, cz1] = CB.CORE, lz = (cz0 + cz1) / 2;
    const louv = cbOnce('louvDoor', () => cbStd({ map: canvasTex(32, 64, (g) => { g.fillStyle = '#4d5156'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#6b7075'; for (let y = 2; y < 64; y += 5) g.fillRect(2, y, 28, 2); }, { keep: true }), roughness: .55 }));
    face(1.0, 2.2, louv, ex + .01, 1.1, -3.3, Math.PI / 2);
    slab(ex, lz - .75, ex + .06, lz + .75, 2.42, P.liftSteel); for (const s of [-1, 1]) face(.6, 2.25, P.liftSteel, ex + .065, 1.13, lz + s * .3, Math.PI / 2);
    const fireCab = cbOnce('fireCab', () => cbSign(.4, 1.6, (g, w, h) => { g.fillStyle = '#f2f1ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ccc'; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#d23a32'; g.beginPath(); g.arc(w / 2, 90, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(w / 2 - 14, 86, 28, 8); }, 128));
    for (const s of [-1, 1]) face(.4, 1.6, fireCab, ex + .02, 1.05, lz + s * 1.15, Math.PI / 2);
    for (const [dz, r, m] of [[-1.55, .07, P.red], [-1.72, .06, P.red], [-1.86, .04, P.white], [-1.95, .04, P.white], [-2.04, .035, P.white]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, CB.SOFFIT, 10), m); p.position.set(X(ex + .12), CB.SOFFIT / 2, Z(lz + dz)); add(p); }
    look(ex + 1, lz, 1.2, 'Service lift', ['The lift\'s back door, onto the alley: for deliveries and the canteen.', 'Beside it the fire risers: sprinkler riser, wet riser main header, drain line.']);
    face(1.5, 3.4, P.glass, ex + .01, 1.75, -8.8, Math.PI / 2); slab(ex, -9.6, ex + .05, -8.0, .06, P.mullion, 3.45);
    for (const z of [-8.0, -9.6]) slab(ex, z - .03, ex + .05, z + .03, 3.5, P.mullion);
    // the recess for the bins: the wall steps back under the floors, a downlight and two cameras in its soffit
    const r0 = -10.1, r1 = -12.8, rx = W - .4;
    slab(rx - .2, r1, rx, r0, CB.SOFFIT, P.acp); slab(rx, r1 - .1, ex, r1, CB.SOFFIT, P.acp); slab(ex - .05, r0, ex, CB.LOB[3] + .1, CB.SOFFIT, P.acp);
    slab(rx, r1, ex, r0, .25, P.acp, CB.SOFFIT - .25);
    for (const z of [r0 - .3, r0 - .55]) soft(.14, .1, .2, P.white, ex - .15, CB.SOFFIT - .42, z, { cast: false });
    const bin = cbOnce('bin', () => cbStd({ color: 0x4f9a3c, roughness: .55 }));
    ['E-WASTE', 'WET WASTE', 'DRY WASTE', 'LAMPS', 'BATTERIES'].forEach((t, i) => {
      const z = r0 - .45 - i * .55; soft(.55, .92, .5, bin, rx + .45, 0, z); soft(.6, .06, .55, bin, rx + .45, .92, z);
      face(.3, .1, cbOnce('binL' + t, () => cbSign(.3, .1, cbText([t], '#1e1e22', '#fff', '800 {s}px Arial', .7), 96)), rx + .72, .82, z, Math.PI / 2);
    });
    block(rx, r1, ex, r0);
    look(ex + .6, (r0 + r1) / 2, 1.3, 'Waste bins', ['Five green Nilkamal bins: E-waste, wet waste, dry waste, lamps, batteries.', 'Segregated, labelled, watched by two cameras. Somebody here takes the audit seriously.']);
    // vertical aluminium slats screening the rest of the lobby block's east wall
    for (let z = CB.LOB[2] - .1; z > -D + .2; z -= .16) if (!(z < -2.6 && z > -4.0) && !(z < cz0 + .2 && z > cz1 - .4) && !(z < -7.9 && z > -9.7) && !(z < r0 + .1 && z > r1 - .1)) slab(ex + .02, z - .025, ex + .14, z + .025, CB.SOFFIT - .1, P.louvre, 0, { cast: false });
    slab(ex, -D + .2, ex + .02, CB.LOB[2], CB.SOFFIT, P.acp); block(CB.LOB[0], -D + .2, ex, CB.LOB[3]);
    block(c0, cz1, ex, cz0);
  }

  // ---- the back: a neem in a raised bed, a few more bikes by the back wall ----
  { const bx2 = 7, bz2 = -14.8; slab(bx2 - 1.1, bz2 - 1.1, bx2 + 1.1, bz2 + 1.1, .6, P.wall, 0, { s: 1.2 }); flat(bx2 - 1, bz2 - 1, bx2 + 1, bz2 + 1, MAT.dirt, .61);
    tree(X(bx2), Z(bz2), 1.25, MAT.leafA); block(bx2 - 1.1, bz2 - 1.1, bx2 + 1.1, bz2 + 1.1);
    for (let x = 12; x < 22; x += 1) { const s = scooter([0x1c1c20, 0x8a8a90, 0xd8d6d0][x % 3]); s.position.set(X(x), 0, Z(CB.BACK + 1.2)); s.rotation.y = Math.PI; }
    block(11.5, CB.BACK + .25, 22.5, CB.BACK + 2.2); }

  // ---- where you can walk, and the faders: what stands between the camera and you when you are under the building or in the lobby ----
  WALK.push([X(CB.WEST), Z(CB.BACK), X(CB.EAST), Z(CB.STRIP)]);
  { const fronts = []; scene.updateMatrixWorld(true);
    // the louvres, the band and the canopy: lifted out of the static batch into one group that fades
    const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
    const lx = (o) => o.isMesh && !o.userData.dyn && o.parent === scene && o.position.y > 2.9 && o.position.y < 4.75 && Math.abs(o.position.z - Z(.07)) < .12 && o.position.x > X(-.2) && o.position.x < X(CB.CAN[0] + .05);
    scene.children.filter(lx).forEach((o) => { g.attach(o); fronts.push(o); });
    fronts.push(CBM.canopy); CBM.canopy.parent.remove(CBM.canopy); g.add(CBM.canopy);
    const under = () => { if (zone !== 'pune') return false; const lxh = hero.x - X(0), lzh = hero.y - Z(0); return lxh > -.5 && lxh < CB.CAN[1] && lzh < -3.2 && lzh > -D; };
    makeFader(compact(g), under);   // one mesh per material (office-kit.js): the louvres, band and canopy fade as a handful of draws, not fifty
  }
  // the windows light up at dusk, the wordmark and the canopy's downlights with them
  life.push(() => {
    if (zone !== 'pune') return;
    const p = window.daylight && window.daylight.state.p, lamps = p ? p.lamps : .3, k = Math.max(0, Math.min(1, (lamps - .45) / .7));
    for (const m of CBM.windows) m.emissiveIntensity = .55 * k;
    CBM.word.emissiveIntensity = .45 + .6 * k; CBM.downlight.emissiveIntensity = .3 + 1.6 * k; CBM.lantern.emissiveIntensity = .4 + 1.4 * k;
  });
  return { door: [X(22.2), Z(CB.LOB[2])], gate: [X(21.1), Z(CB.GATE)] };
}
