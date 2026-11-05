// TokenFall: area registry (AREAS) and the placeholder shell for areas without a real map.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= the three areas (placeholders until the real maps arrive) =================
const AREAS = {
  lab: { cx: 0, cz: -300, name: 'Calfus HQ', sub: 'Calfus · Floor 2', color: 0x5cd6ff, spawn: [-1.54, 10.7] },
  archive: { cx: -300, cz: 0, name: 'Data Archive', sub: 'Where models learn from', color: 0xffb347, ret: [-15, 0] },
  pune: { cx: 300, cz: 0, name: 'Pune', sub: 'Crescent Bay · ABZ', color: 0x7dff8a, ret: [15, 0], spawn: [7, 5.7] },
  abz: { cx: 0, cz: 300, name: 'ABZ', sub: 'Calfus · ABZ Office', color: 0x9fd8ff, spawn: [7.4, 16.8] },
};
function areaShell(a, floorMat, groundMat, walls = true, wip = true, home = [0, 7.2]) {
  const { cx, cz } = a;
  plane(90, 70, groundMat, cx, 0, cz, 2);
  plane(24, 17, floorMat, cx, .012, cz, floorMat.userData.s);
  WALK.push([cx - 11.5, cz - 8, cx + 11.5, cz + 8.4]);
  if (walls) {
    box(24.8, 3.2, .4, MAT.plaster, cx, 0, cz - 8.7); box(25.2, .2, .7, MAT.concrete, cx, 3.2, cz - 8.7);
    for (const s of [-1, 1]) { box(.4, 3.2, 17.8, MAT.plaster, cx + s * 12.2, 0, cz); box(.7, .2, 18.2, MAT.concrete, cx + s * 12.2, 3.2, cz); }
    for (let i = -2; i <= 2; i++) box(2.6, 1.6, .1, MAT.glass, cx + i * 4.4, 1, cz - 8.48, { s: 0 });
  }
  portal(cx + home[0], cz + home[1], a.color, a.key, 'lobby', 'TokenFall Lobby');
  if (!wip) return;
  box(.14, 1.4, .14, MAT.darkWood, cx + 3.4, 0, cz + 5.5); box(.14, 1.4, .14, MAT.darkWood, cx + 5.4, 0, cz + 5.5);
  signBoard('Under construction', cx + 4.4, 1.55, cz + 5.56, 2.4, .5, 0, { color: '#ffe39a', bg: '#7a5a30' });
  colBox(cx + 3.2, cz + 5.3, cx + 5.6, cz + 5.7);
  INTER.push({ x: cx + 4.4, z: cz + 6.5, r: 1.5, label: a.name, verb: 'Read', act: () => talk(a.name, [`Welcome to the ${a.name}.`, 'This area is still being built. The real map is on its way!']) });
}
