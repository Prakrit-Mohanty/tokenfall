// TokenFall: Pune Airport (zone "airport"), through the lobby's west gate. A departures hall: a glass wall onto the tarmac
// with a parked plane, check-in counters with queue posts, a departures board, seating, a chai kiosk, and Gate 7, where you
// board the flight to the Calfus US office in Pleasanton. The way back to the lobby is at the entrance.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const AIRPORT_HALF = [16, 10];
const AIRPORT_GATE = [12, -6.6];

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
    const floor = pOnce('airportFloor', () => std(canvasTex(32, 32, (g) => { g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#c6c0b6'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); g.fillStyle = '#e6e2da'; g.fillRect(4, 4, 10, 10); }, { nearest: true }), 2, { roughness: .35, metalness: .05 }));
    plane(200, 160, MAT.concrete, cx, -.02, cz - 30, 2);
    plane(2 * hx, 2 * hz, floor, cx, .012, cz, 2);
    WALK.push([X(-hx + .4), Z(-hz + .4), X(hx - .4), Z(hz - .4)]);
    // the glass wall onto the tarmac, the other walls in white
    box(2 * hx, .5, .3, MAT.plaster, cx, 0, Z(-hz)); box(2 * hx, 3.8, .12, MAT.window, cx, .5, Z(-hz), { cast: false }); box(2 * hx, .4, .4, MAT.white, cx, 4.3, Z(-hz));
    for (let x = -hx; x <= hx; x += 4) box(.2, 4.7, .3, MAT.charcoal, X(x), 0, Z(-hz));
    for (const s of [-1, 1]) { box(.3, 4.7, 2 * hz, MAT.white, X(s * hx), 0, cz); colBox(X(s * hx) - .2, Z(-hz), X(s * hx) + .2, Z(hz)); }
    box(2 * hx, 1.1, .3, MAT.white, cx, 0, Z(hz)); colBox(X(-hx), Z(-hz) - .2, X(hx), Z(-hz) + .2); colBox(X(-hx), Z(hz) - .2, X(hx), Z(hz) + .2);
    for (let x = -60; x <= 60; x += 6) box(3, .02, .2, pOnce('tarmacLine', () => new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: .8 })), cx + x, -.01, Z(-hz - 14), { cast: false });
    airportPlane(cx + 4, Z(-hz - 22));
    // check-in: three counters with screens and luggage belts, queue posts in front
    ledSign(['CHECK-IN'], '#ffd27a', X(-10), 3.4, Z(-hz) + .3, 4, .6);
    for (let i = 0; i < 3; i++) {
      const x = X(-14 + i * 4);
      box(2.6, 1.1, .8, MAT.white, x, 0, Z(-6)); box(2.7, .06, .9, MAT.charcoal, x, 1.1, Z(-6));
      box(.5, .35, .05, MAT.screen, x - .6, 1.15, Z(-6.25), { cast: false }); box(1, .3, .7, MAT.metal, x + 1.7, 0, Z(-6));
      ledSign([`${i + 1}`], '#d6ecff', x, 2.4, Z(-6.4), .6, .4);
      colBox(x - 1.3, Z(-6.45), x + 2.25, Z(-5.55));
    }
    for (let i = 0; i < 6; i++) for (const zz of [-3.2, -1.4]) { const x = X(-14.5 + i * 2.2); box(.1, 1, .1, MAT.chrome, x, 0, Z(zz)); if (i < 5) box(2.1, .06, .03, pOnce('queueBelt', () => new THREE.MeshStandardMaterial({ color: 0x2a4f9e })), x + 1.1, .9, Z(zz), { cast: false }); }
    colBox(X(-14.6), Z(-3.3), X(-3.4), Z(-3.1));
    INTER.push({ x: X(-10), z: Z(-4.6), r: 1.6, label: 'Check-in', verb: 'Ask', act: () => talk('Check-in', ['"Flying to Pleasanton? San Francisco via Gate 7. Boarding now."', '"Liquids under 100 ml, please. And no, the chatbot cannot carry your bag."']) });
    // the departures board, seating, the chai kiosk
    for (const s of [-1, 1]) box(.2, 2.6, .2, MAT.metal, X(1 + s * 2.6), 0, Z(-1.5));
    ledSign(['DEPARTURES', 'SFO  San Francisco  BOARDING', 'DEL  Delhi       ON TIME', 'BLR  Bengaluru   DELAYED', 'DXB  Dubai       ON TIME'], '#ffd27a', X(1), 3.6, Z(-1.5), 5.6, 2.4, 0, [320, 160]);
    colBox(X(-1.8), Z(-1.7), X(3.8), Z(-1.3));
    for (const zz of [.8, 3]) for (let i = 0; i < 6; i++) { const x = X(-3 + i * 1.2); chair(x, Z(zz), 1); chair(x, Z(zz + .9), -1); }
    for (const zz of [.8, 3]) colBox(X(-3.6), Z(zz) - .4, X(3.6), Z(zz + .9) + .4);
    box(3, 1.1, 1.4, MAT.wood, X(11), 0, Z(6)); box(3.2, .1, 1.6, MAT.concrete, X(11), 1.1, Z(6)); ledSign(['CHAI CORNER'], '#ffd27a', X(11), 2.6, Z(6) - .5, 2.6, .5); colBox(X(9.5), Z(5.3), X(12.5), Z(6.7));
    INTER.push({ x: X(11), z: Z(4.6), r: 1.5, label: 'Chai Corner', verb: 'Order', act: () => talk('Chai Corner', ['Airport chai, ₹180. Same chai, airport price.', 'The last cutting chai before Pleasanton. Savour it.']) });
    for (const [x, z] of [[-14.6, 8.4], [14.6, 8.4], [-14.6, -8.4], [6, 8.4]]) bigPlant(X(x), Z(z));
    // Gate 7: the desk, the jet-bridge door in the glass wall, the boarding portal
    const [gx, gz] = AIRPORT_GATE;
    box(2.2, 1.1, .8, MAT.white, X(gx - 3), 0, Z(gz + 3)); box(2.3, .06, .9, MAT.charcoal, X(gx - 3), 1.1, Z(gz + 3)); colBox(X(gx - 4.1), Z(gz + 2.6), X(gx - 1.9), Z(gz + 3.4));
    box(2.4, 3, .2, MAT.charcoal, X(gx), 0, Z(-hz) + .2); box(2, 2.6, .1, MAT.glassLit, X(gx), .1, Z(-hz) + .3, { cast: false });
    ledSign(['GATE 7', 'SFO  ->  Pleasanton, CA'], '#9dff9f', X(gx), 3.6, Z(-hz) + .35, 3.4, .9, 0, [256, 72]);
    portal(X(gx), Z(gz), 0x2aa59a, 'airport', 'us', 'Board · Pleasanton');
    INTER.push({ x: X(gx - 3), z: Z(gz + 4.4), r: 1.5, label: 'Gate 7', verb: 'Ask', act: () => talk('Gate 7', ['"Boarding for San Francisco, onward to Pleasanton."', 'Walk through the glowing door to board.']) });
    // back to the lobby at the entrance
    box(5, 3, .2, MAT.glassLit, cx, 0, Z(hz) - .1, { cast: false }); ledSign(['EXIT · TokenFall'], '#d6ecff', cx, 3.4, Z(hz) - .2, 3.4, .5);
    portal(cx, Z(hz - 2.4), a.color, 'airport', 'lobby', 'TokenFall Lobby');
    for (const [x, z] of [[-9, 0], [9, 0], [0, 6]]) pointLight('airport', 0xfff2dc, 1.3, 14, X(x), 3.6, Z(z));
  });
  TF.on('enter', (prev, z) => { if (prev === 'airport' && z === 'us') log('', '✈ Flight PNQ → SFO landed. A short drive later: Pleasanton, California.', true); if (prev === 'us' && z === 'airport') log('', '✈ Welcome back to Pune.', true); });
}
