// TokenFall: builds every area: the HQ and ABZ offices, the airport, the US office, and Pune.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

function buildAreas() {
  for (const k in AREAS) AREAS[k].key = k;
  officeMaterials();
  buildABZ(AREAS.abz);   // before the office: the office builds every garland bead in one go at its end
  buildOffice(AREAS.lab);
  let a;
  buildAirport(AREAS.airport);
  buildUS(AREAS.us);
  // Baggage Sorting (zone 'archive'): shelves and racks at the back, the Token Mill floor in front (mill-world.js); its exit returns to the airport
  a = AREAS.archive; areaShell(a, MAT.flag, MAT.darkGrass, true, false, undefined, AIRPORT_BAGGAGE_EXIT);
  for (let r = 0; r < 1; r++) for (const s of [-1, 1]) {
    const x = a.cx + s * 7, z = a.cz - 6 + r * 4;
    box(4.6, 2.6, .7, MAT.books, x, 0, z); colBox(x - 2.4, z - .45, x + 2.4, z + .45);
  }
  for (let i = -1; i <= 1; i++) { box(1, 2.4, .8, MAT.rackLit, a.cx + i * 1.6, 0, a.cz - 7.3); }
  colBox(a.cx - 2.2, a.cz - 7.8, a.cx + 2.2, a.cz - 6.8);
  pointLight('archive', 0xffb347, 2, 10, a.cx, 2.4, a.cz - 1);
  buildPune(AREAS.pune);
}
