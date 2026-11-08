// TokenFall: the village lobby's robots: a two-link robot arm that reaches for a point, the robot barista at Token Brew, the
// robot chess table, the path-sweeper robot and the smart parcel lockers the delivery robot docks at.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

const ARM_UPPER = .42;
const ARM_FORE = .46;
const ARM_SHOULDER_Y = .22;

// base + yaw + shoulder + elbow; arm.tip marks the gripper, everything reaches along local +z when pitched
function robotArm(parent, x, y, z, color = 0xeeeae2, scale = 1) {
  const shell = vOnce('arm' + color, () => new THREE.MeshStandardMaterial({ color, roughness: .45 }));
  const base = new THREE.Group(); base.position.set(x, y, z); base.scale.setScalar(scale); parent.add(base);
  const foot = add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, .1, 12), MAT.metal), base); foot.position.y = .05;
  const yaw = new THREE.Group(); yaw.position.y = .1; base.add(yaw);
  box(.16, .14, .16, shell, 0, 0, 0, { p: yaw });
  const sh = new THREE.Group(); sh.position.y = ARM_SHOULDER_Y - .1; yaw.add(sh);
  box(.08, ARM_UPPER, .08, shell, 0, 0, 0, { p: sh });
  const el = new THREE.Group(); el.position.y = ARM_UPPER; sh.add(el);
  box(.1, .1, .1, MAT.metal, 0, -.05, 0, { p: el }); box(.065, ARM_FORE - .1, .065, shell, 0, 0, 0, { p: el });
  box(.12, .05, .06, MAT.metal, 0, ARM_FORE - .1, 0, { p: el }); for (const s of [-1, 1]) box(.02, .08, .04, MAT.metal, s * .045, ARM_FORE - .08, 0, { p: el });
  box(.03, .03, .03, vGlow(V_LED), 0, ARM_FORE - .14, .04, { p: el, cast: false });
  const tip = new THREE.Object3D(); tip.position.y = ARM_FORE; el.add(tip);
  return { base, yaw, sh, el, tip, scale, target: new THREE.Vector3(0, .6, .3), aim: new THREE.Vector3(0, .6, .3) };
}

// two-link inverse kinematics; targets are relative to the arm's base, and the aim eases toward them so moves look smooth
function armReach(arm, dt) {
  arm.aim.lerp(arm.target, Math.min(1, dt * 5));
  const x = arm.aim.x / arm.scale, y = arm.aim.y / arm.scale, z = arm.aim.z / arm.scale, r = Math.hypot(x, z), h = y - ARM_SHOULDER_Y;
  const D = Math.min(ARM_UPPER + ARM_FORE - .001, Math.max(.12, Math.hypot(r, h)));
  const a1 = Math.acos((ARM_UPPER ** 2 + D * D - ARM_FORE ** 2) / (2 * ARM_UPPER * D));
  const bend = Math.PI - Math.acos((ARM_UPPER ** 2 + ARM_FORE ** 2 - D * D) / (2 * ARM_UPPER * ARM_FORE));
  arm.yaw.rotation.y = Math.atan2(x, z); arm.sh.rotation.x = Math.atan2(r, h) - a1; arm.el.rotation.x = bend;
}

// carried things follow the gripper; in the parent's frame so tables and counters can be turned
const armTipIn = (arm, parent, out) => { arm.tip.getWorldPosition(out); return parent.worldToLocal(out); };

// an outdoor coffee bar under Token Brew's awning: the arm fetches the kettle, pours, then slides the cup over to serve
function robotBarista(x, z) {
  const g = vGroup(x, z), top = 1.05; g.name = 'robotBarista';
  gbox(g, 2.4, top, .62, MAT.wood, 0, 0, 0); gbox(g, 2.5, .06, .7, MAT.concrete, 0, top, 0);
  gbox(g, 2.4, .05, .05, vGlow(V_LED_WARM), 0, top - .1, .33, { cast: false });
  const menu = ledSign(['ROBO BARISTA', 'chai · coffee'], '#ffd27a', 0, 0, 0, 1.4, .5, 0, [256, 80]); g.add(menu); menu.position.set(0, top + 1.3, -.32);
  for (const s of [-1, 1]) gbox(g, .06, 1.4, .06, MAT.metal, s * .66, top, -.32);
  const arm = robotArm(g, 0, top + .06, -.12, 0x3a4150, 1.45);
  const kettleHome = new THREE.Vector3(-.75, top + .06, .02), pourAt = new THREE.Vector3(.02, top + .06, .18), serveAt = new THREE.Vector3(.95, top + .06, .2);
  const kettle = new THREE.Group(); g.add(kettle); kettle.position.copy(kettleHome);
  box(.26, .28, .22, MAT.metal, 0, 0, 0, { p: kettle }); box(.08, .07, .16, MAT.metal, .15, .2, 0, { p: kettle }); box(.27, .04, .23, vGlow(V_LED), 0, .28, 0, { p: kettle, cast: false });
  const cupMat = vOnce('cup', () => new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: .5 }));
  const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .075, .18, 12), cupMat), g); cup.position.copy(pourAt).add(new THREE.Vector3(0, .09, 0));
  const stream = gbox(g, .02, .18, .02, vOnce('tea', () => new THREE.MeshStandardMaterial({ color: 0xb87a3c, emissive: 0x3a1a08 })), 0, 0, 0, { cast: false });
  const steam = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: .08, transparent: true, opacity: .6, depthWrite: false }));
  g.add(steam);
  for (const o of [g, kettle, cup, stream, steam]) o.userData.dyn = true;
  const above = (v, h = .3) => new THREE.Vector3(v.x, v.y + h, v.z).sub(arm.base.position);
  const at = (v, h = .12) => above(v, h);
  const KEYS = [[0, at(kettleHome, .5)], [1.2, at(kettleHome)], [2, above(pourAt, .45)], [3.4, above(pourAt, .4)], [4.8, at(kettleHome, .4)], [5.6, at(kettleHome)], [6.6, at(pourAt, .2)], [7.8, at(serveAt, .2)], [8.8, above(serveAt, .5)], [10, at(kettleHome, .5)]];
  const tmpV = new THREE.Vector3();
  let last = 0;
  anim.push((t) => {
    const u = t % 10, dt = Math.min(.05, Math.abs(t - last)); last = t;
    let k = 0; while (k < KEYS.length - 1 && KEYS[k + 1][0] <= u) k++;
    arm.target.copy(KEYS[k][1]); armReach(arm, dt);
    const tipL = armTipIn(arm, g, tmpV);
    const holdingKettle = u >= 1.2 && u < 5.6, pouring = u >= 2.4 && u < 4.4, carryingCup = u >= 6.8 && u < 7.9;
    kettle.position.copy(holdingKettle ? tipL.clone().add(new THREE.Vector3(0, -.3, 0)) : kettleHome);
    kettle.rotation.z = pouring ? -.6 : 0;
    stream.visible = pouring; stream.position.set(pourAt.x + .04, pourAt.y + .2, pourAt.z);
    if (u < 6.8) cup.position.set(pourAt.x, pourAt.y + .09, pourAt.z);
    else if (carryingCup) cup.position.copy(tipL).add(new THREE.Vector3(0, -.12, 0));
    else cup.position.set(serveAt.x, serveAt.y + .09, serveAt.z);
    const sp = steam.geometry.attributes.position;
    for (let i = 0; i < 5; i++) { const f = (t * .6 + i / 5) % 1; sp.setXYZ(i, cup.position.x + Math.sin(t * 2 + i) * .03, cup.position.y + .08 + f * .35, cup.position.z); }
    sp.needsUpdate = true; steam.visible = u >= 4.4;
  });
  colBox(x - 1.25, z - .35, x + 1.25, z + .35);
}

// two arms play chess on a plaza table: each turn one arm picks up a piece and sets it on a free square
function robotChess(x, z) {
  const g = vGroup(x, z), top = .78, sq = .1;
  gbox(g, 1.6, .06, 1, MAT.wood, 0, top - .06, 0); gbox(g, .12, top - .06, .12, MAT.metal, 0, 0, 0); gbox(g, .7, .04, .7, MAT.metal, 0, 0, 0);
  const boardTex = canvasTex(8, 8, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#3a2e24' : '#e8dcc4'; c.fillRect(i, j, 1, 1); } }, { nearest: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(sq * 8, sq * 8), std(boardTex, 0)); board.rotation.x = -Math.PI / 2; board.position.y = top + .002; g.add(board);
  const sqPos = (i, j) => new THREE.Vector3((i - 3.5) * sq, top, (j - 3.5) * sq);
  const light = vOnce('chessW', () => new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: .4 })), dark = vOnce('chessB', () => new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: .4 }));
  const taken = new Set(), pieces = [];
  for (const [side, m, rows] of [[0, light, [0, 1]], [1, dark, [6, 7]]]) for (const row of rows) for (let i = 0; i < 8; i += 2) {
    const j = row, p = add(new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, row % 7 === 0 ? .11 : .07, 8), m), g);
    p.position.copy(sqPos(i + (row % 2), j)).add(new THREE.Vector3(0, .04, 0)); taken.add((i + (row % 2)) + ',' + j); pieces.push({ mesh: p, side, sq: [i + (row % 2), j] });
  }
  const arms = [robotArm(g, -.62, top - .06, 0, 0xeeeae2, 1.25), robotArm(g, .62, top - .06, 0, 0x6a707c, 1.25)];
  const screens = ['WHITE TO MOVE', 'BLACK TO MOVE'].map((l) => { const t = ledTex([l], '#8fe8ff', 96, 16); return std(t, 0, { emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.2 }); });
  const scr = gbox(g, .5, .1, .02, screens[0], 0, top + .02, -.52, { cast: false });
  for (const o of [g, ...pieces.map((p) => p.mesh), scr]) o.userData.dyn = true;
  const TURN = 3.2, tmpV = new THREE.Vector3();
  let move = null, turn = -1, last = 0;
  anim.push((t) => {
    const dt = Math.min(.05, Math.abs(t - last)); last = t;
    const n = Math.floor(t / TURN), f = (t % TURN) / TURN, side = n % 2, arm = arms[side], rest = arms[1 - side];
    if (n !== turn) {
      turn = n; scr.material = screens[side];
      const mine = pieces.filter((p) => p.side === side), piece = mine[Math.floor(Math.random() * mine.length)];
      let to = null;
      for (let k = 0; k < 40 && !to; k++) { const i = Math.floor(Math.random() * 8), j = Math.floor(Math.random() * 8); if (!taken.has(i + ',' + j)) to = [i, j]; }
      if (to) { taken.delete(piece.sq.join(',')); taken.add(to.join(',')); move = { piece, from: sqPos(...piece.sq), to: sqPos(...to) }; piece.sq = to; } else move = null;
    }
    rest.target.set(rest.base.position.x > 0 ? -.05 : .05, .7, 0); armReach(rest, dt);
    if (!move) { arm.target.set(arm.base.position.x > 0 ? -.05 : .05, .7, 0); armReach(arm, dt); return; }
    const rel = (v, h) => new THREE.Vector3(v.x, v.y + h, v.z).sub(arm.base.position);
    arm.target.copy(f < .25 ? rel(move.from, .2) : f < .35 ? rel(move.from, .1) : f < .65 ? rel(move.to, .22) : f < .75 ? rel(move.to, .1) : rel(move.to, .35));
    armReach(arm, dt);
    const p = move.piece.mesh;
    if (f >= .35 && f < .75) p.position.copy(armTipIn(arm, g, tmpV)).add(new THREE.Vector3(0, -.06, 0));
    else if (f >= .75) p.position.copy(move.to).add(new THREE.Vector3(0, .04, 0));
  });
  for (const s of [-1, 1]) { const st = add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .06, 10), MAT.metal), g); st.position.set(s * .62, top - .09, 0); }
  colCirc(x, z, .95);
}

// a round sweeper robot with spinning brushes, working up and down the south road
function robotSweeper(x, z0, z1) {
  const g = new THREE.Group(); g.userData.dyn = true; scene.add(g);
  const body = add(new THREE.Mesh(new THREE.CylinderGeometry(.36, .38, .3, 16), vaiShell()), g); body.position.y = .2;
  const lid = add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, .06, 16), MAT.metal), g); lid.position.y = .38;
  const beacon = box(.1, .1, .1, glowStrip(0xffb347), 0, .41, 0, { p: g, cast: false });
  const brushes = [-1, 1].map((s) => { const b = add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .03, 8), vOnce('brush', () => new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 1 }))), g, false); b.position.set(s * .24, .03, .3); return b; });
  anim.push((t) => {
    const k = (t * .025) % 2, f = k < 1 ? k : 2 - k, e = f * f * (3 - 2 * f);
    g.position.set(x, 0, z0 + e * (z1 - z0)); g.rotation.y = k < 1 ? 0 : Math.PI;
    brushes.forEach((b, i) => { b.rotation.y = t * 14 * (i ? 1 : -1); }); beacon.visible = Math.sin(t * 6) > 0;
  });
}

// a bank of smart parcel lockers by the Pune gate; one door swings open while the delivery robot is docked
function smartLockers(x, z) {
  const g = vGroup(x, z), w = 3, h = 2.1;
  gbox(g, w + .2, .15, .8, MAT.concrete, 0, 0, 0); gbox(g, w, h, .6, MAT.metal, 0, .15, 0);
  const doorMat = vOnce('lockerDoor', () => new THREE.MeshStandardMaterial({ color: 0x5a616c, roughness: .4, metalness: .3 }));
  let open = null;
  for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) {
    const dx = -w / 2 + .38 + c * .75, dy = .3 + r * .62;
    if (c === 1 && r === 0) {
      const hinge = new THREE.Group(); hinge.position.set(dx - .34, dy, .31); hinge.userData.dyn = true; g.add(hinge);
      box(.68, .56, .04, doorMat, .34, 0, 0, { p: hinge }); box(.04, .04, .02, vGlow(0x7dff8a), .58, .26, .03, { p: hinge, cast: false });
      open = hinge; continue;
    }
    gbox(g, .68, .56, .04, doorMat, dx, dy, .31); gbox(g, .04, .04, .02, vGlow(V_LED), dx + .24, dy + .26, .34, { cast: false });
  }
  const sign = ledSign(['SMART LOCKERS'], '#8fe8ff', 0, 0, 0, 2.2, .36); g.add(sign); sign.position.set(0, h + .4, .2);
  gbox(g, w, .05, .05, vGlow(V_LED), 0, h + .13, .31, { cast: false });
  anim.push((t) => { const u = t % V_BOT_CYCLE, f = u < 21 ? 0 : u < 22 ? u - 21 : u < 26 ? 1 : u < 27 ? 27 - u : 0; open.rotation.y = -f * 1.6; });
  colBox(x - w / 2 - .1, z - .4, x + w / 2 + .1, z + .4);
}
