// TokenFall: builds every area: the offices, the Data Archive, and Pune (built in pune.js).
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

function buildAreas() {
  for (const k in AREAS) AREAS[k].key = k;
  officeMaterials();
  buildABZ(AREAS.abz);   // before the office: the office builds every garland bead in one go at its end
  buildOffice(AREAS.lab);
  let a;
  // Data Archive: bookshelves, server racks and an orb
  a = AREAS.archive; areaShell(a, MAT.flag, MAT.darkGrass);
  for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
    const x = a.cx + s * 7, z = a.cz - 6 + r * 4;
    box(4.6, 2.6, .7, MAT.books, x, 0, z); colBox(x - 2.4, z - .45, x + 2.4, z + .45);
  }
  for (let i = -1; i <= 1; i++) { box(1, 2.4, .8, MAT.rackLit, a.cx + i * 1.6, 0, a.cz - 7.3); }
  colBox(a.cx - 2.2, a.cz - 7.8, a.cx + 2.2, a.cz - 6.8);
  const pedestal = add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, 1, 8), MAT.stone)); pedestal.position.set(a.cx, .5, a.cz - 1.5);
  const orb = add(new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 2), new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa040, emissiveIntensity: 2.4 })), null, false); orb.userData.dyn = true;
  anim.push(t => { orb.position.set(a.cx, 1.6 + Math.sin(t * 1.5) * .12, a.cz - 1.5); orb.rotation.y = t * .6; });
  colCirc(a.cx, a.cz - 1.5, .7);
  pointLight('archive', 0xffb347, 2, 10, a.cx, 2.4, a.cz - 1);
  buildPune(AREAS.pune);
}
