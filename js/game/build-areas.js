// TokenFall: builds every area: the offices, the Data Archive, and Pune (Crescent Bay, ABZ tower, parking).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

function buildAreas() {
  for (const k in AREAS) AREAS[k].key = k;
  officeMaterials();
  buildABZ(AREAS.abz);   // before the office: the office builds every garland bead in one go at its end
  buildOffice(AREAS.lab);
  let a;
  // Data Archive: the back row of bookshelves and server racks; the floor in front of them is the Token Mill (mill-world.js builds it)
  a = AREAS.archive; areaShell(a, MAT.flag, MAT.darkGrass, true, false);
  for (let r = 0; r < 1; r++) for (const s of [-1, 1]) {
    const x = a.cx + s * 7, z = a.cz - 6 + r * 4;
    box(4.6, 2.6, .7, MAT.books, x, 0, z); colBox(x - 2.4, z - .45, x + 2.4, z + .45);
  }
  for (let i = -1; i <= 1; i++) { box(1, 2.4, .8, MAT.rackLit, a.cx + i * 1.6, 0, a.cz - 7.3); }
  colBox(a.cx - 2.2, a.cz - 7.8, a.cx + 2.2, a.cz - 6.8);
  pointLight('archive', 0xffb347, 2, 10, a.cx, 2.4, a.cz - 1);
  // Pune: a city block. Crescent Bay (the Calfus building) with its parking lot, the street on its east side,
  // ABZ across that street, a main road along the south, and more office blocks behind
  a = AREAS.pune; areaShell(a, MAT.paver, MAT.concrete, false, false, [7, 3.5]);
  const { cx, cz } = a;
  plane(33, 18.5, MAT.paver, cx - 5.5, .011, cz + .25, 3);
  WALK.push([cx - 22, cz - 9.5, cx + 11, cz + 9.4], [cx + 11, cz - 8, cx + 37, cz + 9.4]);
  const cf = calfusHQ(cx, cz - 5.6);
  portal(cx - 2.5, cf + 1.7, 0x5cd6ff, 'pune', 'lab', 'Crescent Bay');
  pointLight('pune', 0xffe0b0, 1.6, 12, cx + 4, 3, cz + 2);
  tree(cx + 9.4, cz - 3.5, 1.2, MAT.leafC);
  // one fingerpost beside where you arrive, out of the way: Crescent Bay to the left, ABZ to the right
  const FX = cx + 3.6, FZ = cz + 5.2;
  box(.14, 2.7, .14, MAT.metal, FX, 0, FZ); colCirc(FX, FZ, .2);
  ledSign(['◀ Crescent Bay'], '#8ff0e4', FX - 1.2, 2.25, FZ, 2.3, .42, 0, undefined, PLAIN);
  ledSign(['ABZ ▶'], '#9fd8ff', FX + .95, 1.7, FZ, 1.8, .42);
  // roads: the street on the east side and the main road along the south, crossing at a junction
  const RX = cx + 14.5, MZ = cz + 12.5;
  const asphalt = std(TX.concrete, 1.5, { roughness: .8 }); asphalt.color.setRGB(.36, .37, .41);
  plane(6, 70, asphalt, RX, .02, cz, 1.5); plane(84, 6, asphalt, cx + 5, .021, MZ, 1.5);
  for (let z = -32; z < 34; z += 4) if (Math.abs(cz + z - MZ) > 7) box(.18, .02, 2, MAT.white, RX, .02, cz + z, { cast: false });   // lane dashes stop short of the zebra crossings
  for (let x = -36; x < 46; x += 4) if (Math.abs(cx + x - RX) > 7) box(2, .02, .18, MAT.white, cx + x, .02, MZ, { cast: false });
  for (const s2 of [-3.9, 3.9]) {
    plane(1.8, 70, MAT.paver, RX + s2, .025, cz, 3); box(.2, .14, 70, MAT.concrete, RX + s2 * .77, 0, cz, { cast: false });
    plane(84, 1.8, MAT.paver, cx + 5, .026, MZ + s2, 3); box(84, .14, .2, MAT.concrete, cx + 5, 0, MZ + s2 * .77, { cast: false });
  }
  for (const z of [-14, -4, 6]) streetLight(RX - 3.4, cz + z, 1, 0);
  for (const z of [-11, 1]) streetLight(RX + 3.4, cz + z, -1, 0);
  for (const x of [-18, -6, 24, 34]) streetLight(cx + x, MZ - 3.4, 0, 1);
  // the cars on these roads now drive (city.js): same four cars, plus autos and a few more
  // ABZ, across the street
  const tf = finTower(cx + 28.3, cz - 4.5);
  plane(16.6, 4, MAT.paver, cx + 28.3, .013, tf + 2, 3);
  for (const x of [19.4, 24.8, 30.2, 35.6]) palm(cx + x, tf + 2.4, rr(3.2, 3.8));
  ledSign(['ABZ'], '#9fd8ff', cx + 28.3, 2.15, tf + .45, 2.4, .5);
  portal(cx + 28.3, tf + 1.6, 0x9fd8ff, 'pune', 'abz', 'ABZ Office');
  // Crescent Bay parking, west of the building: cars along the far side, a row of bikes at the front
  const lot = cx - 14.6;
  plane(12.8, 15, asphalt, lot, .02, cz - 1.5, 1.5);
  for (const z of [-8, -5.2, -2.4, .4, 3.2]) box(4.8, .015, .1, MAT.white, cx - 18.3, .02, cz + z, { cast: false });
  // bike bays painted at 45 degrees so the bikes show their side as well as their back
  const BA = Math.PI * .75;
  for (const x of [-17.2, -15.2, -13.2, -11.2, -9.2]) box(.08, .015, 2.6, MAT.white, cx + x, .02, cz + 3.2, { ry: BA, cast: false });
  car(cx - 18.3, cz - 6.6, -Math.PI / 2, 0xe8e8ec); car(cx - 18.3, cz - 3.8, -Math.PI / 2, 0xb02a2a); car(cx - 18.3, cz - 1, -Math.PI / 2, 0x55595f);
  const BIKES = [['r15', -16.2, 'Yamaha R15M', 'A Yamaha R15M in metallic grey, with blue wheels and gold forks.'],
    ['vstrom', -14.2, 'Suzuki V-Strom', 'A yellow Suzuki V-Strom SX, ready for a long ride.'],
    ['avenger', -12.2, 'Bajaj Avenger', 'A black Bajaj Avenger cruiser, all chrome and low seat.'],
    ['thruxton', -10.2, 'Royal Enfield Thruxton', 'A red and black café racer with wire wheels and clip-on bars.']];
  for (const [kind, x, name, line] of BIKES) {
    bike(cx + x, cz + 3.2, BA, kind);
    INTER.push({ x: cx + x, z: cz + 4.7, r: 1, label: name, verb: 'Look', act: () => talk(name, [line]) });
  }
  ledSign(['Crescent Bay Parking'], '#9fd0ff', lot, 2.4, cz - 8.9, 4.6, .5, 0, [480, 52], PLAIN);
  for (const s2 of [-2, 2]) box(.1, 2.2, .1, MAT.metal, lot + s2, 0, cz - 8.96);
  colBox(lot - 2.2, cz - 9.1, lot + 2.2, cz - 8.8);
  // more office blocks around the edges
  officeBlock(cx - 16, cz - 17, 12, 8, 8, { floors: 3, fins: 2.5 });
  officeBlock(cx + 5, cz - 19, 12, 6, 10, { floors: 4 });
  officeBlock(cx + 28, cz - 20, 14, 7, 11, { floors: 4, side: MAT.cladding });
  officeBlock(cx + 44, cz - 6, 8, 14, 9, { floors: 3 });
  officeBlock(cx - 30, cz - 2, 8, 12, 9, { floors: 3, side: MAT.cladding });
  buildCity(a, RX, MZ, asphalt);
}
