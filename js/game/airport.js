// TokenFall: Pune Airport (zone "airport"), through the lobby's west gate. A departures hall: a glass wall onto the tarmac
// with a parked plane, check-in counters with queue posts, a departures board, seating, a chai kiosk, and Gate 7, where you
// board the flight to the Calfus US office in Pleasanton. The way back to the lobby is at the entrance.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const AIRPORT_HALF = [16, 10];
const AIRPORT_GATE = [12, -6.6];

// the departures board: the real thing's layout (yellow header, time / destination / flight / gate / status rows) in the game's
// soft, rounded storybook look; a live clock, a blinking BOARDING, and a "next arrival" line along the bottom
const DEP_ROWS = [
  ['SFO', 'San Francisco', 'TF 007', '7', 'BOARDING'], ['DEL', 'Delhi', 'TF 214', '3', 'ON TIME'], ['BLR', 'Bengaluru', 'TF 118', '5', 'DELAYED'],
  ['DXB', 'Dubai', 'TF 562', '2', 'ON TIME'], ['SIN', 'Singapore', 'TF 330', '4', 'GATE OPEN'], ['LHR', 'London', 'TF 901', '6', 'CANCELLED'],
];
const DEP_STATUS = { 'BOARDING': ['#5ccf7a', '#2f8a48'], 'ON TIME': ['#7fc8f0', '#3a86b4'], 'DELAYED': ['#ffb04a', '#c0741a'], 'GATE OPEN': ['#c9a6ff', '#7a52c4'], 'CANCELLED': ['#ff7a8a', '#b83a4c'] };
function departuresBoard(x, y, z) {
  const W = 1024, H = 560, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const F = (wt, px) => `${wt} ${px}px "Fredoka", "Baloo 2", "Trebuchet MS", sans-serif`;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const plane = (cx, cy, s) => { g.save(); g.translate(cx, cy); g.rotate(-.35); g.scale(s, s); g.fillStyle = '#5a3a12'; g.beginPath();
    g.ellipse(0, 0, 26, 6, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-4, -4); g.lineTo(-14, -26); g.lineTo(-6, -26); g.lineTo(10, -3); g.fill();
    g.beginPath(); g.moveTo(-4, 4); g.lineTo(-14, 26); g.lineTo(-6, 26); g.lineTo(10, 3); g.fill(); g.beginPath(); g.moveTo(-20, -3); g.lineTo(-27, -14); g.lineTo(-22, -14); g.lineTo(-14, -3); g.fill(); g.restore(); };
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  const draw = (t) => {
    g.clearRect(0, 0, W, H);
    rr(6, 10, W - 12, H - 16, 46); g.fillStyle = '#c9a274'; g.fill();               // wooden rim with a shadow lip
    rr(6, 6, W - 12, H - 20, 46); g.fillStyle = '#f6e7c8'; g.fill();
    rr(22, 22, W - 44, H - 52, 34); g.fillStyle = '#2f4a5a'; g.fill();              // the deep teal screen
    rr(22, 22, W - 44, 92, 34); g.fillStyle = '#ffd04a'; g.fill(); g.fillRect(22, 80, W - 44, 34);
    g.fillStyle = '#f0b42a'; g.fillRect(22, 110, W - 44, 6);
    g.fillStyle = '#5a3a12'; g.font = F(700, 58); g.textBaseline = 'middle'; g.fillText('DEPARTURES', 56, 70); plane(W - 230, 68, 1.25);
    const d = new Date(), clock = `${String(d.getHours()).padStart(2, '0')}${t % 2 < 1 ? ':' : ' '}${String(d.getMinutes()).padStart(2, '0')}`;
    rr(W - 170, 40, 124, 58, 29); g.fillStyle = '#fff6dc'; g.fill(); g.fillStyle = '#5a3a12'; g.font = F(700, 36); g.textAlign = 'center'; g.fillText(clock, W - 108, 70); g.textAlign = 'left';
    const cols = [52, 150, 560, 700, 790]; g.font = F(600, 24); g.fillStyle = '#9fc4d4';
    ['Code', 'Destination', 'Flight', 'Gate', 'Status'].forEach((h, i) => g.fillText(h, cols[i] + 8, 142));
    DEP_ROWS.forEach((r, i) => {
      const ry = 162 + i * 56; rr(40, ry, W - 80, 48, 24); g.fillStyle = i % 2 ? '#3a5a6c' : '#36546a'; g.fill();
      g.font = F(700, 28); g.fillStyle = '#ffd04a'; g.fillText(r[0], cols[0] + 8, ry + 25);
      g.fillStyle = '#fffaf0'; g.fillText(r[1], cols[1] + 8, ry + 25);
      g.font = F(600, 26); g.fillStyle = '#9fc4d4'; g.fillText(r[2], cols[2] + 8, ry + 25);
      rr(cols[3] + 6, ry + 7, 44, 34, 17); g.fillStyle = '#ffd04a'; g.fill(); g.fillStyle = '#5a3a12'; g.font = F(700, 24); g.textAlign = 'center'; g.fillText(r[3], cols[3] + 28, ry + 25);
      const [bg, sh] = DEP_STATUS[r[4]], blink = r[4] === 'BOARDING' && t % 1 < .5;
      rr(cols[4] + 6, ry + 6, 176, 36, 18); g.fillStyle = sh; g.fill(); rr(cols[4] + 6, ry + 4, 176, 34, 17); g.fillStyle = blink ? '#fffaf0' : bg; g.fill();
      g.fillStyle = blink ? sh : '#fff'; g.font = F(700, 20); g.fillText(r[4], cols[4] + 94, ry + 22); g.textAlign = 'left';
    });
    g.font = F(600, 22); g.fillStyle = '#ffd04a'; g.fillText('✈  Next arrival: TF 008 from San Francisco · on time   ·   Have a cosy flight!', 52, H - 52);
    tex.needsUpdate = true;
  };
  draw(0);
  // the board, its backing and its legs in one group with their own materials, so it can fade when it stands between the camera and you
  const bg = new THREE.Group(); bg.userData.dyn = true; scene.add(bg);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .02, toneMapped: false });
  const backM = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: .7, transparent: true }), legM = new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: .6, transparent: true });
  const footM = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: .5, metalness: .4, transparent: true });
  const w = 5.8, h = w * H / W, scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); scr.position.set(x, y, z + .08); bg.add(scr);
  const back = new THREE.Mesh(boxGeo(w - .2, h - .25, .14, 0), backM); back.position.set(x, y, z - .02); back.castShadow = true; bg.add(back);   // backing so it is not paper-thin from behind
  // two chunky wooden legs set behind the backing (never through the screen), up to the board's middle, on round steel feet
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, y + .4, 16), legM); leg.position.set(x + s * 2.1, (y + .4) / 2, z - .2); leg.castShadow = true; bg.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .12, 20), footM); foot.position.set(x + s * 2.1, .06, z - .2); bg.add(foot);
  }
  const mats = [m, backM, legM, footM]; let fade = 1;
  anim.push(() => {
    // fade to a ghost while you are on the glass side of it and the follow camera looks through it
    const behind = typeof hero !== 'undefined' && hero && zone === 'airport' && hero.y < z - .4 && Math.abs(hero.x - x) < w / 2 + 2.5 && !TF.cameraHeld;
    const want = behind ? .14 : 1; if (Math.abs(want - fade) < .002) return;
    fade += (want - fade) * .12; for (const k of mats) { k.opacity = fade; k.depthWrite = fade > .95; }
  });
  let last = -1; anim.push((t) => { const k = Math.floor(t * 2); if (k !== last) { last = k; draw(t); } });
}

// gate seating like the real terminals: double-sided rows of blue upholstered seats, back to back on one steel spine, tall backs
// leaning apart in an A, grey armrests at the ends, splayed cast feet and a little side table at each end; chunkier and softer for the game
const GATE_MAT = {};
function gateBench(x0, x1, zc, sides = [-1, 1]) {
  const M = GATE_MAT.blue ? GATE_MAT : Object.assign(GATE_MAT, {
    blue: new THREE.MeshStandardMaterial({ color: 0x3f6fd8, roughness: .55 }), blueDk: new THREE.MeshStandardMaterial({ color: 0x2f55b0, roughness: .6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: .35, metalness: .5 }), top: new THREE.MeshStandardMaterial({ color: 0x4a5566, roughness: .5 }) });
  const n = Math.max(2, Math.round((x1 - x0) / .62)), step = (x1 - x0) / n, y = .44;
  box(x1 - x0 + .1, .12, .22, M.steel, (x0 + x1) / 2, .3, zc);                                   // the spine beam
  for (let i = 0; i < n; i++) {
    const x = x0 + step * (i + .5);
    for (const s of sides) {
      box(step - .06, .12, .5, M.blue, x, y - .06, zc + s * .34);                                 // seat cushion
      box(step - .06, .04, .46, M.blueDk, x, y - .1, zc + s * .34, { cast: false });              // its darker underside
      const b = box(step - .06, .72, .1, M.blue, x, y + .02, zc + s * .1); b.rotation.x = -s * .2;   // tall back, leaning back away from whoever sits (a +x turn tips the top towards +z)
      b.position.set(x, y + .38, zc + s * .14);
    }
  }
  for (const xe of [x0, x1]) for (const s of sides) {                                          // end armrests
    const sx = xe === x0 ? -1 : 1;
    box(.07, .26, .07, M.steel, xe + sx * .02, y, zc + s * .5); box(.08, .06, .44, M.steel, xe + sx * .02, y + .24, zc + s * .32);
  }
  for (const xl of [x0 + .1, (x0 + x1) / 2, x1 - .1]) for (const s of [-1, 1]) {                 // splayed feet
    const l = box(.09, .42, .09, M.steel, xl, 0, zc + s * .22); l.rotation.x = -s * .45; l.position.set(xl, .19, zc + s * .3);
  }
  for (const [xe, sx] of [[x0, -1], [x1, 1]]) {                                                  // side tables
    box(.5, .05, .62, M.top, xe + sx * .32, .56, zc); box(.1, .5, .1, M.steel, xe + sx * .32, .06, zc);
    box(.4, .05, .1, M.steel, xe + sx * .32, .02, zc);
  }
}

// Gate 7 dressed like a real boarding gate: a patch of flecked gate carpet, the navy podium with its raised counter, screens and
// boarding-pass scanner, the tall navy gate pillar with the big "7" and a flight screen, a freestanding flight-info monitor by the glass,
// chrome stanchions with blue belts marking the boarding lane to the jet-bridge door, and two task chairs behind the desk
function gateSeven(X, Z, gx, gz, hz) {
  const navy = new THREE.MeshStandardMaterial({ color: 0x2b48b4, roughness: .45 }), top = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: .4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: .22, metalness: .55 }), black = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .5 });
  const canvasMat = (w, h, draw, glow = .9) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: .4 }); };
  const F = (wt, px) => `${wt} ${px}px "Fredoka", "Baloo 2", sans-serif`;
  const flight = (g, W, H) => { g.fillStyle = '#16245a'; g.fillRect(0, 0, W, H); g.fillStyle = '#2aa59a'; g.fillRect(0, 0, W, H * .26);
    g.fillStyle = '#fff'; g.font = F(700, H * .17); g.textBaseline = 'middle'; g.fillText('TokenAir  TF 007', W * .05, H * .13);
    g.font = F(700, H * .2); g.fillText('San Francisco', W * .05, H * .45); g.font = F(500, H * .13); g.fillStyle = '#b8c8f0'; g.fillText('SFO  ·  on to Pleasanton', W * .05, H * .65);
    g.fillStyle = '#5ccf7a'; g.beginPath(); g.roundRect ? g.roundRect(W * .05, H * .76, W * .42, H * .17, H * .08) : g.rect(W * .05, H * .76, W * .42, H * .17); g.fill(); g.fillStyle = '#fff'; g.font = F(700, H * .12); g.fillText('BOARDING', W * .09, H * .85); };
  // carpet
  const carpet = canvasMat(256, 256, (g, W) => { g.fillStyle = '#c4935e'; g.fillRect(0, 0, W, W); for (let i = 0; i < 9000; i++) { const c = ['#b8844e', '#d0a06a', '#a87444', '#c88a58', '#dcb07c'][i % 5]; g.fillStyle = c; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); } }, 0);
  carpet.map.wrapS = carpet.map.wrapT = THREE.RepeatWrapping; carpet.map.repeat.set(10, 4); carpet.emissiveIntensity = 0; carpet.roughness = 1;
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(20.4, 7.8), carpet); cp.rotation.x = -Math.PI / 2; cp.position.set(X(5.8), .016, Z(-5.85)); cp.receiveShadow = true; scene.add(cp);   // one warm carpet under the whole window lounge and the gate
  // the podium: long side along the lane, agent on the west side, passengers on the east
  const dx = gx - 2.4, dz = gz + 1.4;
  box(.9, 1.0, 2.8, navy, X(dx), 0, Z(dz)); box(1.0, .06, 2.9, top, X(dx), 1.0, Z(dz));
  box(.3, .25, 2.9, navy, X(dx + .4), 1.0, Z(dz)); box(.36, .05, 2.96, top, X(dx + .4), 1.25, Z(dz));   // the raised transaction ledge
  box(.92, .08, 2.82, top, X(dx), 0, Z(dz), { cast: false });   // kick plate
  for (const oz of [-.6, .6]) { box(.06, .32, .5, black, X(dx - .1), 1.06, Z(dz + oz)); const scr = canvasMat(128, 96, flight, .7); const sm = new THREE.Mesh(new THREE.PlaneGeometry(.44, .28), scr); sm.position.set(X(dx - .135), 1.24, Z(dz + oz)); sm.rotation.y = -Math.PI / 2; scene.add(sm); }
  box(.22, .1, .3, black, X(dx + .4), 1.3, Z(dz + 1.1)); box(.18, .02, .2, new THREE.MeshStandardMaterial({ color: 0x40ff80, emissive: 0x30ff70, emissiveIntensity: 1 }), X(dx + .4), 1.4, Z(dz + 1.1), { cast: false });   // pass scanner
  colBox(X(dx - .5), Z(dz - 1.5), X(dx + .6), Z(dz + 1.5));
  // two task chairs behind the desk
  for (const oz of [-.7, .7]) { const cx = X(dx - 1.1), cz = Z(dz + oz);
    box(.5, .1, .5, black, cx, .48, cz); box(.08, .55, .45, black, cx - .26, .55, cz); box(.06, .4, .06, chrome, cx, .08, cz); box(.5, .04, .06, chrome, cx, .04, cz); box(.06, .04, .5, chrome, cx, .04, cz); }
  // the gate pillar: navy, a big white 7 at the top on both faces, a flight screen below
  const px = dx, pz = dz + 2.2;
  box(.8, 4.4, .8, navy, X(px), 0, Z(pz)); colBox(X(px - .5), Z(pz - .5), X(px + .5), Z(pz + .5));
  const num = canvasMat(128, 160, (g, W, H) => { g.fillStyle = '#2b48b4'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = F(700, 130); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', W / 2, H / 2 + 6); }, .5);
  const tv = canvasMat(256, 160, flight, .8);
  for (const [ry, ox, oz] of [[0, 0, .41], [Math.PI, 0, -.41]]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(.76, .95), num); n.position.set(X(px + ox), 3.85, Z(pz + oz)); n.rotation.y = ry; scene.add(n);
    box(.74, .5, .05, black, X(px + ox * 1.06), 2.55, Z(pz + oz * 1.06), { cast: false });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.68, .42), tv); s.position.set(X(px + ox * 1.15), 2.8, Z(pz + oz * 1.15)); s.rotation.y = ry; scene.add(s);
  }
  // freestanding flight-info monitor by the glass, facing the hall
  const mx = gx + 2.6, mz = -hz + 1.6;
  box(.5, .06, .5, black, X(mx), 0, Z(mz)); box(.14, 2.2, .14, black, X(mx), 0, Z(mz)); box(1.5, .95, .12, black, X(mx), 2.1, Z(mz));
  const big = new THREE.Mesh(new THREE.PlaneGeometry(1.36, .82), canvasMat(320, 192, flight, .85)); big.position.set(X(mx), 2.575, Z(mz) + .07); scene.add(big);
  colBox(X(mx - .3), Z(mz - .3), X(mx + .3), Z(mz + .3));
  // stanchions with blue belts: the boarding lane from the hall to the door
  const belt = new THREE.MeshStandardMaterial({ color: 0x2f4fb0, roughness: .6 });
  for (const lx of [gx - 1.4, gx + 1.4]) {
    const zs = [gz + 4.2, gz + 2.9, gz + 1.6];
    for (const z of zs) { box(.07, .95, .07, chrome, X(lx), 0, Z(z), { cast: false }); const base = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, .05, 16), chrome); base.position.set(X(lx), .025, Z(z)); scene.add(base); const cap = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), chrome); cap.position.set(X(lx), .97, Z(z)); scene.add(cap); }
    for (let i = 0; i < zs.length - 1; i++) box(.025, .07, 1.3, belt, X(lx), .86, Z((zs[i] + zs[i + 1]) / 2), { cast: false });
  }
  // the sign over the jet-bridge door
  const head = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05), canvasMat(400, 124, (g, W, H) => { g.fillStyle = '#2b48b4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.font = F(700, 96); g.textBaseline = 'middle'; g.fillText('7', 22, H / 2 + 4); g.font = F(600, 30); g.fillText('San Francisco  SFO', 100, H * .33); g.fillStyle = '#5ccf7a'; g.font = F(700, 26); g.fillText('TF 007  ·  BOARDING', 100, H * .72); }, .7));
  head.position.set(X(gx), 3.55, Z(-hz) + .36); scene.add(head);
}

// a wayfinding sign on a timber post: dark board, white text and arrows, the little icon row underneath
function airportWaySign(x, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: .6 });
  box(.22, 3.2, .22, wood, x - 1.05, 0, z); box(.3, .06, .3, MAT.chrome, x - 1.05, 0, z);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#20252c'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#fff'; g.font = '600 50px "Fredoka", sans-serif'; g.textBaseline = 'middle';
  g.fillText('←  Check-in · Exit', 26, 58); g.textAlign = 'right'; g.fillText('Gate 7  →', 486, 130);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(26, 172, 460, 3);
  ['#f2c418', '#2f6ad0', '#2f6ad0', '#f2c418'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(300 + i * 46, 214, 18, 0, 7); g.fill(); });
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 22px sans-serif'; ['☕', '♿', '🚻', '✈'].forEach((t, i) => g.fillText(t, 300 + i * 46, 216)); g.textAlign = 'right'; g.font = '600 40px "Fredoka", sans-serif'; g.fillText('→', 486, 214);
  const t = new THREE.CanvasTexture(cv), m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, roughness: .5 }), side = new THREE.MeshStandardMaterial({ color: 0x20252c });
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, .1), [side, side, side, side, m, m]); b.position.set(x, 2.6, z); b.castShadow = true; scene.add(b);
  colBox(x - 1.25, z - .2, x - .85, z + .2);
}

// the check-in island, like a real terminal's: a timber-slatted backdrop wall with a lit navy TokenAir band and a screen over each desk,
// three desks (check-in, bag drop, priority) each with a bag scale and a belt that carries suitcases off through a rubber-curtained slot,
// and a serpentine queue of chrome posts and blue belts in front that you weave through to the desks
function airportCheckIn(X, Z) {
  const F = (wt, px) => `${wt} ${px}px "Fredoka", "Baloo 2", sans-serif`;
  const lit = (w, h, draw, glow = .6) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: .5 }); };
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f2f66, roughness: .5 }), walnut = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: .55 });
  const deskW = new THREE.MeshStandardMaterial({ color: 0xf2ece2, roughness: .45 }), steel = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: .3, metalness: .55 }), rubber = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: .9 });
  // the backdrop: warm vertical slats, the lit band on top
  const bx0 = -15.8, bx1 = -5.8, bz = -7.65, bw = bx1 - bx0, bcx = (bx0 + bx1) / 2;
  const slats = lit(512, 160, (g, W, H) => { g.fillStyle = '#9a6a3e'; g.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 12) { g.fillStyle = x % 24 ? '#c8925a' : '#bf8650'; g.fillRect(x + 2, 0, 8, H); } }, 0);
  slats.map.wrapS = THREE.RepeatWrapping; slats.map.repeat.set(2, 1);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.0, .3), [navy, navy, navy, navy, slats, navy]); wall.position.set(X(bcx), 1.5, Z(bz)); wall.castShadow = wall.receiveShadow = true; scene.add(wall);
  const band = lit(1024, 96, (g, W, H) => { g.fillStyle = '#1f2f66'; g.fillRect(0, 0, W, H); g.fillStyle = '#2aa59a'; g.fillRect(0, H - 8, W, 8);
    g.fillStyle = '#fff'; g.font = F(700, 52); g.textBaseline = 'middle'; g.fillText('✈  TokenAir', 30, H / 2); g.font = F(500, 38); g.textAlign = 'right'; g.fillText('Check-in  ·  Bag drop  ·  San Francisco', W - 30, H / 2); }, .7);
  const bnd = new THREE.Mesh(new THREE.BoxGeometry(bw + .2, .75, .36), [navy, navy, navy, navy, band, navy]); bnd.position.set(X(bcx), 3.35, Z(bz)); bnd.castShadow = true; scene.add(bnd);
  colBox(X(bx0), Z(bz - .2), X(bx1), Z(bz + .2));
  // the desks
  const desks = [[-13.3, '1', 'Check-in', 'TokenAir · SFO'], [-10.8, '2', 'Bag drop', 'Labels ready'], [-8.3, '3', 'Priority', 'Business · Gold']];
  const bags = [];
  desks.forEach(([dx, num, title, sub], i) => {
    const x = X(dx), dz = Z(-6.75);
    box(1.5, 1.0, .7, deskW, x, 0, dz); box(1.5, .14, .72, navy, x, .86, dz); box(1.62, .05, .82, walnut, x, 1.0, dz); box(1.44, .06, .64, rubber, x, 0, dz, { cast: false });
    box(.05, .34, .5, new THREE.MeshStandardMaterial({ color: 0x1a1c20 }), x - .35, 1.05, dz - .05);   // the agent's screen, back to you
    // overhead screen on the backdrop
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .62), lit(220, 124, (g, W, H) => { g.fillStyle = '#16245a'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd04a'; g.font = F(700, 64); g.textBaseline = 'middle'; g.fillText(num, 14, H / 2);
      g.fillStyle = '#fff'; g.font = F(700, 26); g.fillText(title, 64, H * .36); g.fillStyle = '#9fc4e8'; g.font = F(500, 18); g.fillText(sub, 64, H * .66); }, .85));
    scr.position.set(x, 2.25, Z(bz) + .17); scene.add(scr); box(1.2, .72, .04, new THREE.MeshStandardMaterial({ color: 0x1a1c20 }), x, 1.89, Z(bz) + .14, { cast: false });
    // bag scale with its little display, the belt into the wall, the rubber-flap slot
    const sx = x + 1.15;
    box(.8, .22, .78, steel, sx, 0, dz); box(.72, .03, .7, rubber, sx, .22, dz, { cast: false });
    box(.06, .55, .06, steel, sx + .45, 0, dz + .3); box(.22, .14, .05, lit(64, 32, (g) => { g.fillStyle = '#0a1a10'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#5cff8a'; g.font = '700 20px monospace'; g.fillText('18.4', 6, 23); }, 1), sx + .45, .55, dz + .3, { cast: false });
    box(.8, .22, .55, steel, sx, 0, Z(-7.25)); box(.72, .03, .5, rubber, sx, .22, Z(-7.25), { cast: false });
    for (let k = 0; k < 6; k++) box(.12, .5, .02, rubber, sx - .3 + k * .12, .25, Z(bz) + .16, { cast: false });   // curtain strips
    colBox(x - .8, Z(-7.5), sx + .45, Z(-6.35));
    // a suitcase that comes up on the scale now and then and rides off into the wall
    const bag = new THREE.Group(); bag.userData.dyn = true; scene.add(bag);
    const col = [0xc8402a, 0x2f6ad0, 0x3a8a5a][i];
    const b = new THREE.Mesh(boxGeo(.5, .34, .26, 0), new THREE.MeshStandardMaterial({ color: col, roughness: .5 })); b.position.y = .17; b.castShadow = true; bag.add(b);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .04), rubber); hd.position.set(0, .36, 0); bag.add(hd);
    bags.push({ g: bag, sx, i });
  });
  anim.push((t) => {
    if (zone !== 'airport') return;
    for (const b of bags) {
      const k = ((t + b.i * 3.1) % 9) / 9;   // 0-.45 waiting on the scale, .45-.85 riding the belt, then gone
      b.g.visible = k < .85;
      const ride = Math.max(0, (k - .45) / .4);
      b.g.position.set(b.sx, .25, Z(-6.75) - ride * 0.95); b.g.scale.setScalar(k < .05 ? k / .05 : 1);
    }
  });
  // the serpentine queue: rows of posts, belts that leave a gap at alternate ends, the way in from the hall on the right
  const beltM = new THREE.MeshStandardMaterial({ color: 0x2f4fb0, roughness: .6 }), chrome = new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: .22, metalness: .55 });
  const px = [-14.8, -12.9, -11.0, -9.1, -7.2], rows = [[-4.9, 0, 3], [-3.7, 1, 4], [-2.5, 0, 4]];   // [z, first post, last post] each belt row spans
  const post = (x, z) => { box(.07, .95, .07, chrome, X(x), 0, Z(z), { cast: false }); const base = new THREE.Mesh(new THREE.CylinderGeometry(.17, .19, .05, 16), chrome); base.position.set(X(x), .025, Z(z)); scene.add(base);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), chrome); cap.position.set(X(x), .97, Z(z)); scene.add(cap); };
  for (const [z, a, b] of rows) {
    for (let i = a; i <= b; i++) post(px[i], z);
    for (let i = a; i < b; i++) box(px[i + 1] - px[i] - .08, .07, .025, beltM, X((px[i] + px[i + 1]) / 2), .86, Z(z), { cast: false });
    colBox(X(px[a]) - .05, Z(z) - .06, X(px[b]) + .05, Z(z) + .06);
  }
  post(px[0], -3.7); box(.025, .07, 1.12, beltM, X(px[0]), .86, Z(-3.1), { cast: false }); colBox(X(px[0]) - .06, Z(-3.7), X(px[0]) + .06, Z(-2.5));   // closes the far left end of the outer lane
  // a sign at the queue's mouth
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(.7, .45), lit(140, 90, (g, W, H) => { g.fillStyle = '#1f2f66'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = F(700, 22); g.textAlign = 'center'; g.fillText('Check-in', W / 2, 38); g.fillStyle = '#ffd04a'; g.font = F(600, 18); g.fillText('queue here ↰', W / 2, 66); }, .7));
  box(.06, 1.2, .06, chrome, X(-6.4), 0, Z(-2.0), { cast: false }); mouth.position.set(X(-6.4), 1.45, Z(-2.0) + .04); scene.add(mouth);
  // talking to each desk
  INTER.push({ x: X(-13.3), z: Z(-5.6), r: 1.3, label: 'Check-in', verb: 'Ask', act: () => talk('Check-in', ['"Flying to Pleasanton? San Francisco via Gate 7. Boarding now."', '"Window or aisle? Window, of course. The planes are the best part."']) });
  INTER.push({ x: X(-10.8), z: Z(-5.6), r: 1.3, label: 'Bag drop', verb: 'Drop bag', act: () => talk('Bag drop', ['"18.4 kg, just under. Tag on, and off it goes."', 'Your suitcase rides the belt into the wall. See you in San Francisco, little suitcase.']) });
  INTER.push({ x: X(-8.3), z: Z(-5.6), r: 1.3, label: 'Priority', verb: 'Ask', act: () => talk('Priority', ['"Priority desk! Gold members, business class, and anyone who brought us chai."', '"Liquids under 100 ml, please. And no, the chatbot cannot carry your bag."']) });
}

function airportPlane(x, z) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .4 }), teal = new THREE.MeshStandardMaterial({ color: 0x2aa59a, roughness: .5 });
  const body = add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 18), white)); body.rotation.z = Math.PI / 2; body.position.set(x, 3.2, z);
  const nose = add(new THREE.Mesh(new THREE.SphereGeometry(2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), white)); nose.rotation.z = -Math.PI / 2; nose.position.set(x + 15, 3.2, z);
  const tail = add(new THREE.Mesh(new THREE.ConeGeometry(2, 5, 18), white)); tail.rotation.z = Math.PI / 2; tail.position.set(x - 17.5, 3.6, z);
  box(5, .3, 30, white, x - 1, 2.4, z); box(2.2, 5, .3, teal, x - 17, 4.4, z); box(4, .2, 8, white, x - 16, 4, z);
  box(30, .5, .1, teal, x, 3.4, z + 2.02, { cast: false });
  for (let i = 0; i < 14; i++) box(.45, .35, .05, MAT.charcoal, x - 11 + i * 1.6, 3.9, z + 2.02, { cast: false });
  for (const dz of [-6, 6]) { const e = add(new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 3, 14), MAT.metal)); e.rotation.z = Math.PI / 2; e.position.set(x + 1.5, 1.6, z + dz); }
  for (const [dx, dz] of [[11, 0], [-2, -2.2], [-2, 2.2]]) box(.3, 1.4, .3, MAT.charcoal, x + dx, 0, z + dz);
}

function buildAirport(a) {
  const { cx, cz } = a, [hx, hz] = AIRPORT_HALF, X = (v) => cx + v, Z = (v) => cz + v;
  withSideRandom(() => {
    const floor = pOnce('airportFloor', () => {   // polished terrazzo: a warm pale ground with chips of grey, black, terracotta and white, in big panels
      const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
      g.fillStyle = '#e6dfd3'; g.fillRect(0, 0, 512, 512);
      const chips = ['#9a948c', '#5a5650', '#c27a52', '#f6f2ea', '#b8b0a4', '#2e2c2a'];
      for (let i = 0; i < 9000; i++) { g.fillStyle = chips[i % chips.length]; g.globalAlpha = .35 + Math.random() * .5; const r = .6 + Math.random() * 1.8; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, r, r * (.6 + Math.random() * .4), Math.random() * 3, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = 'rgba(150,140,128,.5)'; g.fillRect(0, 0, 512, 2); g.fillRect(0, 0, 2, 512);
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      return new THREE.MeshStandardMaterial({ map: t, roughness: .28, metalness: .05 });
    });
    plane(200, 160, MAT.concrete, cx, -.02, cz - 30, 2);
    plane(2 * hx, 2 * hz, floor, cx, .012, cz, 4);   // one terrazzo panel every 4 m
    WALK.push([X(-hx + .4), Z(-hz + .4), X(hx - .4), Z(hz - .4)]);
    // the glass wall onto the tarmac, the other walls in white
    box(2 * hx, .5, .3, MAT.plaster, cx, 0, Z(-hz)); box(2 * hx, 3.8, .06, pOnce('apGlass', () => new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: .14, roughness: .05, metalness: .2, depthWrite: false })), cx, .5, Z(-hz), { cast: false }); box(2 * hx, .08, .14, MAT.charcoal, cx, 2.4, Z(-hz), { cast: false });   // clear floor-to-ceiling glass with one transom: the tarmac and the planes show through box(2 * hx, .4, .4, MAT.white, cx, 4.3, Z(-hz));
    const bronze = pOnce('apBronze', () => new THREE.MeshStandardMaterial({ color: 0x3e342c, roughness: .4, metalness: .4 }));
    for (let x = -hx; x <= hx; x += 4) box(.2, 4.7, .3, bronze, X(x), 0, Z(-hz));
    // a band of warm timber slats along the top of the glass, and a timber soffit over it (the warm-modern gate lounge look)
    const slat = pOnce('apSlat', () => new THREE.MeshStandardMaterial({ color: 0xc8925a, roughness: .6 }));
    for (let x = -hx + .1; x < hx; x += .22) box(.07, .7, .1, slat, X(x), 3.75, Z(-hz) + .25, { cast: false });
    box(2 * hx, .12, 1.2, slat, cx, 4.45, Z(-hz) + .6, { cast: false });
    // two round board-marked concrete columns with steel feet beside the lounge
    const conc = pOnce('apConc', () => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#c9c4bb'; g.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '90,86,80'},${Math.random() * .12})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); } for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(120,115,108,.25)'; g.fillRect(0, y, 128, 1); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return new THREE.MeshStandardMaterial({ map: t, roughness: .8 }); });
    for (const x of [-4.9, 9.2]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 4.6, 28), conc); c.position.set(X(x), 2.3, Z(-8.9)); c.castShadow = true; c.receiveShadow = true; scene.add(c);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(.53, .53, .3, 28), MAT.chrome); f.position.set(X(x), .15, Z(-8.9)); scene.add(f); colCirc(X(x), Z(-8.9), .6);
    }
    airportWaySign(X(-4.6), Z(-3.4));
    for (const s of [-1, 1]) { box(.3, 4.7, 2 * hz, MAT.white, X(s * hx), 0, cz); colBox(X(s * hx) - .2, Z(-hz), X(s * hx) + .2, Z(hz)); }
    box(2 * hx, 1.1, .3, MAT.white, cx, 0, Z(hz)); colBox(X(-hx), Z(-hz) - .2, X(hx), Z(-hz) + .2); colBox(X(-hx), Z(hz) - .2, X(hx), Z(hz) + .2);
    buildApron(cx, cz);   // the planes, the apron, the concourse and the clouds through the glass (airport-apron.js)
    airportCheckIn(X, Z);   // the check-in island: backdrop, desks, bag drops, serpentine queue
    // the departures board, seating, the chai kiosk
    departuresBoard(X(1), 3.75, Z(-1.5));
    for (const lx of [-1.1, 3.1]) colCirc(X(lx), Z(-1.7), .5);   // only the two legs block: you can walk under the board
    // the blue gate benches sit on the left of the hall towards the entrance, well clear of the check-in queue, leaving the middle open
    for (const zc of [4.7, 6.95]) { gateBench(X(-12.2), X(-5.6), Z(zc)); colBox(X(-13.1), Z(zc) - .85, X(-4.7), Z(zc) + .85); }
    apLoungeRow(X, Z);   // lounge chairs facing the glass, to sit in and watch the planes (airport-apron.js)
    box(3, 1.1, 1.4, MAT.wood, X(11), 0, Z(6)); box(3.2, .1, 1.6, MAT.concrete, X(11), 1.1, Z(6)); ledSign(['CHAI CORNER'], '#ffd27a', X(11), 2.6, Z(6) - .5, 2.6, .5); colBox(X(9.5), Z(5.3), X(12.5), Z(6.7));
    INTER.push({ x: X(11), z: Z(4.6), r: 1.5, label: 'Chai Corner', verb: 'Order', act: () => talk('Chai Corner', ['Airport chai, ₹180. Same chai, airport price.', 'The last cutting chai before Pleasanton. Savour it.']) });
    for (const [x, z] of [[-14.6, 8.4], [14.6, 8.4], [6, 8.4]]) bigPlant(X(x), Z(z));
    // Gate 7: the desk, the jet-bridge door in the glass wall, the boarding portal
    const [gx, gz] = AIRPORT_GATE;
    box(2.4, 3, .2, MAT.charcoal, X(gx), 0, Z(-hz) + .2);
    { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; const g = cv.getContext('2d');   // the jet-bridge doors: two glass leaves, a lit corridor beyond
      const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#dfe9f2'); gr.addColorStop(1, '#a9bccb'); g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
      g.fillStyle = 'rgba(255,248,226,.8)'; g.fillRect(70, 40, 116, 250); g.fillStyle = 'rgba(120,140,160,.5)'; for (let y = 60; y < 290; y += 34) g.fillRect(70, y, 116, 3);
      g.fillStyle = '#3a4250'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 0, 10, 320); g.fillRect(246, 0, 10, 320); g.fillRect(124, 0, 8, 320);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(20, 300); g.lineTo(60, 20); g.lineTo(80, 20); g.lineTo(40, 300); g.fill();
      g.fillStyle = '#2b48b4'; g.fillRect(30, 150, 80, 26); g.fillRect(146, 150, 80, 26); g.fillStyle = '#fff'; g.font = '700 18px "Fredoka", sans-serif'; g.fillText('GATE 7', 38, 169); g.fillText('GATE 7', 154, 169);
      const t = new THREE.CanvasTexture(cv), dm = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, roughness: .2 }));
      dm.position.set(X(gx), 1.4, Z(-hz) + .31); scene.add(dm); }
    portal(X(gx), Z(gz), 0x2aa59a, 'airport', 'us', 'Board · Pleasanton');
    gateSeven(X, Z, gx, gz, hz);
    // back to the lobby at the entrance
    box(5, 3, .2, MAT.glassLit, cx, 0, Z(hz) - .1, { cast: false }); ledSign(['EXIT · TokenFall'], '#d6ecff', cx, 3.4, Z(hz) - .2, 3.4, .5);
    portal(cx, Z(hz - 2.4), a.color, 'airport', 'lobby', 'TokenFall Lobby');
    for (const [x, z] of [[-9, 0], [9, 0], [0, 6]]) pointLight('airport', 0xfff2dc, 1.3, 14, X(x), 3.6, Z(z));
  });
  TF.on('enter', (prev, z) => { if (prev === 'airport' && z === 'us') log('', '✈ Flight PNQ → SFO landed. A short drive later: Pleasanton, California.', true); if (prev === 'us' && z === 'airport') log('', '✈ Welcome back to Pune.', true); });
}
