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
}
