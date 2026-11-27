// TokenFall: builds every area: the HQ and ABZ offices, the airport, the US office, Pune and the Bengaluru office.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

function buildAreas() {
  for (const k in AREAS) AREAS[k].key = k;
  officeMaterials();
  buildABZ(AREAS.abz);   // before the office: the office builds every garland bead in one go at its end
  buildOffice(AREAS.lab);
  let a;
  buildAirport(AREAS.airport);
  buildUS(AREAS.us);
  buildPune(AREAS.pune);
  buildBLR(AREAS.blr);   // the Bengaluru office, by train from the lobby (office-blr.js)
  // the HQ's fourth floor (office-hq4.js), last and on side streams, so nothing built before or after it moves
  const d0 = decorSeed, s0 = screenTurn; withSideRandom(() => buildOffice4(AREAS.lab4)); decorSeed = d0; screenTurn = s0;
  buildCB3(AREAS.cb3);
  withSideRandom(() => STAIRS.build(AREAS.stairs));   // the fire stairs (stairwell.js), on its own random stream   // Crescent Bay's third floor, up the lift (office-cb3.js); last of all, so nothing above it moves
}
