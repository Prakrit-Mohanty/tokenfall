// Token Brew Kitchen — the kitchen in the world. Browser: window.KitchenWorld. Node: require('./kitchen-world.js') (the pure part: the room, the door, the camera fit).
//
// A zone, "kitchen" (Token Brew Kitchen · Staff only), registered through TF.registerZone at (600, 0): a candy-coloured diorama in the spirit of Purble Place (the look is kitchen-decor.js).
// It is only a backdrop for the game, which is played on the screen (kitchen-play.js): the player does not walk here. Entering the kitchen locks and hides the hero, holds the camera at a
// fixed, centred, steep view that frames the whole room (TF.cameraTo / TF.cameraRestore), and starts the shift by itself. The way in is the Token Brew cafe's own staff door (the lobby
// says where it is: TF.lobbySpots.kitchen; this module adds the board, the twinkle and the prompt); the way out is world.exit(), the "Back to the cafe" button and Esc.
//   install(TF)            registers at the lobby's boot (after mergeStatic, so the live parts stay live objects); sets TF.kitchen = world
//   world.on(evt, fn)      'enter' (the player has come in: the shift starts) and 'leave'
//   world.exit()           travel back to the lobby (false when it cannot right now)
//   world.react(good)      the customers hop (a good serve) or sag (a slip) for a moment
//   world.inside           true while the player is in the kitchen
// Coordinates are kitchen-local metres (x right, z towards the camera).
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./carrom-world.js') : root.CarromWorld);
  if (isNode) module.exports = api;
  else root.KitchenWorld = api;
})(this, function (CW) {
  const STYLE = CW.STYLE, BASE_ASPECT = 16 / 9;
  const ZONE = { cx: 600, cz: 0 };
  // the staff door is the Token Brew cafe's own door. The lobby places it (TF.lobbySpots.kitchen = { door, dir, stand, ret }: the door's face, which way it faces, where to stand, where the hero
  // comes back out); this module adds the board in front of it, the twinkle and the prompt. A lobby without that spot has no entrance, and the kitchen stays unreachable.
  const DOOR = { r: 1.9, board: 0.75, w: 2.1 };
  function doorSpot(spot) {
    if (!spot) return null;
    const [dx, dz] = spot.dir, bx = spot.door[0] + dx * DOOR.board, bz = spot.door[1] + dz * DOOR.board, hw = DOOR.w / 2, side = [-dz, dx];
    return { door: spot.door.slice(), stand: spot.stand.slice(), ret: spot.ret.slice(), ry: Math.atan2(dx, dz), board: [bx, bz], posts: [-0.9, 0.9].map((k) => [bx + side[0] * k, bz + side[1] * k]),
      box: dz ? [bx - hw, bz - 0.2, bx + hw, bz + 0.2] : [bx - 0.2, bz - hw, bx + 0.2, bz + hw], retDir: dz > 0 ? 'down' : dz < 0 ? 'up' : dx > 0 ? 'right' : 'left' };
  }
  const ROOM = { x0: -11.6, x1: 11.6, zBack: -8.7, zFront: 2.8, wall: 3.4 };

  // ---------------------------------------------------------------- pure: the camera
  // a centred, steep view (straight on, about 52 degrees down) from the camera side that frames the whole kitchen; pulled back along the line of sight when the window is narrower than 16:9
  const CAMERA = { pos: [0, 17.6, 10.4], look: [0, 0.2, -3.0], fov: 40 };
  function fitView(aspect) {
    const k = Math.max(1, BASE_ASPECT / Math.max(0.4, aspect)), c = CAMERA;
    return { pos: k === 1 ? c.pos.slice() : c.pos.map((v, i) => c.look[i] + (v - c.look[i]) * k), look: c.look.slice(), fov: c.fov };
  }
  // where a kitchen-local point lands on screen for a view: normalised device coordinates (-1..1) and the depth in front of the camera
  function project(view, aspect, p) {
    const f = [view.look[0] - view.pos[0], view.look[1] - view.pos[1], view.look[2] - view.pos[2]], len = Math.hypot(...f), fz = f.map((v) => v / len);
    const right = [-fz[2], 0, fz[0]], rl = Math.hypot(...right), r = right.map((v) => v / rl), u = [r[1] * fz[2] - r[2] * fz[1], r[2] * fz[0] - r[0] * fz[2], r[0] * fz[1] - r[1] * fz[0]];
    const d = [p[0] - view.pos[0], p[1] - view.pos[1], p[2] - view.pos[2]], z = d[0] * fz[0] + d[1] * fz[1] + d[2] * fz[2], t = Math.tan(view.fov * Math.PI / 360);
    return { x: (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * t * aspect), y: (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * t), z };
  }
  // every point the view must show: the room's floor corners and the back wall's top
  const framePoints = () => [[ROOM.x0, 0, ROOM.zBack], [ROOM.x1, 0, ROOM.zBack], [ROOM.x0, ROOM.wall, ROOM.zBack], [ROOM.x1, ROOM.wall, ROOM.zBack], [ROOM.x0, 0, ROOM.zFront], [ROOM.x1, 0, ROOM.zFront]];

  // ---------------------------------------------------------------- the world
  function create(TF) {
    const { THREE, scene, MAT } = TF, listeners = [];
    const S = { built: false, in: false, A: null, spot: null, root: null, decor: null, lights: [], lanterns: [], customers: [], aspect: 0, camOn: false, door: null, lastMs: 0, react: 0, mood: 0 };
    const world = { state: S, ROOM, CAMERA, DOOR };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    Object.defineProperty(world, 'inside', { get: () => S.in });
    const warm = () => 0xffe3bc;   // the kitchen's lamps are a soft white; the staff door out in the lobby keeps the lobby's warm glow
    const lobbyWarm = () => MAT.warmGlow.emissive.getHex();
    const V = (x, y, z) => new THREE.Vector3(S.A.cx + x, y, S.A.cz + z);

    // ---- the room ----
    function build() {
      const A = S.A, R = ROOM, kids = new Set(scene.children);
      const D = S.decor = window.KitchenDecor.make(TF, { A, ROOM, STYLE });
      D.room();   // the look: kitchen-decor.js
      S.lanterns = D.lamps();   // pendant lamps that sway
      for (const [x, y, z, k, d] of [[-6, 3.4, -4, 0.7, 22], [6, 3.4, -4, 0.7, 22], [0, 3.2, 0.5, 0.4, 16], [0, 3.0, -7.2, 0.4, 14]]) S.lights.push(TF.pointLight('kitchen', warm(), k, d, A.cx + x, y, A.cz + z));
      buildDoor();
      // nobody walks here, but the zone keeps a small floor so the engine's own checks (the hero's standing place) stay sane
      TF.WALK.push([A.cx - 1, A.cz - 4, A.cx + 1, A.cz - 2]);
      const fresh = scene.children.filter((o) => !kids.has(o) && !o.userData.dyn);
      S.root = new THREE.Group(); S.root.name = 'kitchen'; scene.add(S.root); fresh.forEach((o) => S.root.add(o));
      if (TF.mergeStatic) TF.mergeStatic(S.root);
      void R;
    }
    function buildDoor() {
      const sp = S.spot; if (!sp) { S.door = null; return; }   // the lobby did not say where the door is: no entrance
      const posts = (px, pz) => TF.box(0.14, 1.9, 0.14, MAT.darkWood, px, 0, pz);
      sp.posts.forEach(([px, pz]) => posts(px, pz)); TF.signBoard('Kitchen - Staff', sp.board[0], 1.75, sp.board[1], 2.1, 0.46, sp.ry); TF.signBoard('Cook a shift', sp.board[0], 1.25, sp.board[1], 1.5, 0.36, sp.ry);
      TF.colBox(sp.box[0], sp.box[1], sp.box[2], sp.box[3]);
      TF.pointLight('lobby', lobbyWarm(), 0.7, 5, sp.stand[0], 2.7, sp.stand[1]);
      TF.INTER.push({ x: sp.stand[0], z: sp.stand[1], r: DOOR.r, label: 'Token Brew Kitchen', verb: 'Cook', act: () => world.enterKitchen() });
      // the way in is marked like every other game: the amber twinkle
      if (TF.sparkles) S.doorSparkles = TF.sparkles(sp.stand[0], sp.stand[1] - 0.2, STYLE[0].hex, 24, 0.8, 2.6);
      S.door = { x: sp.door[0], z: sp.door[1] };
    }
    // customers waiting on the near side of the pass: round faces turned to the player, they only bob and react
    function buildCustomers() {
      [-6.2, -2.4, 2.2, 6.4, 9.6].forEach((x, i) => {
        const g = S.decor.customer(i); g.userData.dyn = true; g.position.set(S.A.cx + x, 0, S.A.cz + 1.5); scene.add(g); S.customers.push({ g, ph: i * 0.9 });
      });
    }

    // ---- the zone: entering, leaving, the fixed camera ----
    const camNow = () => fitView(TF.camera.aspect || BASE_ASPECT);
    function applyCamera(ms) { const c = camNow(); TF.cameraTo(V(...c.pos), V(...c.look), ms, c.fov); S.aspect = TF.camera.aspect; S.camOn = true; }
    world.view = () => camNow();
    world.enterKitchen = () => {
      if (!S.built || !S.door || TF.traveling || TF.talking || TF.locked || TF.cameraHeld || TF.zone !== 'lobby') return false;
      TF.travel({ zone: 'lobby', to: 'kitchen' }); return true;
    };
    world.exit = () => {
      if (!S.in || TF.traveling) return false;
      TF.travel({ zone: 'kitchen', to: 'lobby' }); return true;
    };
    function onZone(prev, z) {
      if (z === 'kitchen' && !S.in) {
        S.in = true; TF.lockPlayer(true); TF.hero.g.visible = false;   // the player works from the screen, not the floor
        setTimeout(() => { if (S.in) applyCamera(800); }, 0);   // after the lobby has put the follow camera at the hero, so the ease starts from this room
        emit('enter');
      } else if (prev === 'kitchen' && z !== 'kitchen' && S.in) {
        S.in = false; S.camOn = false; TF.cameraRestore(0); TF.hero.g.visible = true; TF.lockPlayer(false); S.react = 0;
        emit('leave');
      }
    }
    world.onZone = onZone;
    world.react = (good) => { S.react = 0.9; S.mood = good ? 1 : -1; };

    // ---- the per-frame tick ----
    world.tick = (t) => {
      if (!S.built || !S.in) return;
      // real seconds, not the lobby's clamped frame time (a hidden tab pauses the frames; the jump after it is capped)
      const nowMs = performance.now(), sec = Math.min(0.5, (nowMs - (S.lastMs || nowMs)) / 1000); S.lastMs = nowMs;
      if (S.camOn && TF.camera.aspect && Math.abs(TF.camera.aspect - S.aspect) > 0.01) applyCamera(0);
      for (const l of S.lanterns) { l.g.rotation.z = Math.sin(t * 1.3 + l.ph) * 0.07; l.g.rotation.x = Math.sin(t * 0.9 + l.ph * 2) * 0.04; }
      if (S.react > 0) S.react = Math.max(0, S.react - sec);
      const k = S.react / 0.9;
      for (const c of S.customers) {
        const b = Math.abs(Math.sin(t * 1.6 + c.ph)), hop = S.mood > 0 ? Math.sin(Math.min(1, 1 - k + 0.001) * Math.PI) * 0.45 * (k > 0 ? 1 : 0) : 0, sag = S.mood < 0 ? k * 0.08 : 0;
        c.g.position.y = b * 0.045 + hop; c.g.scale.set(1 + (1 - b) * 0.02, 1 - (1 - b) * 0.03 - sag, 1 + (1 - b) * 0.02);
      }
    };

    world.build = () => {
      S.spot = doorSpot(TF.lobbySpots && TF.lobbySpots.kitchen);
      const a = TF.registerZone('kitchen', { cx: ZONE.cx, cz: ZONE.cz, name: 'Token Brew Kitchen', sub: 'Staff only', color: STYLE[0].hex, ret: S.spot ? S.spot.ret : [0, 0], retDir: S.spot ? S.spot.retDir : 'down', spawn: [0, -3], env: { sun: 0.55, hemi: 0.78, hemiColor: 0xf6dfc4, fog: parseInt(PAL.plum.slice(1), 16), near: 80, far: 190 } });
      S.A = a; build(); buildCustomers(); S.built = true;
    };
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.kitchen = world;
    TF.life.push((t) => world.tick(t));
    TF.on('boot', () => { world.build(); TF.on('enter', (a, b) => world.onZone(a, b)); });
    if (typeof window !== 'undefined') window.kitchenWorld = world;
    return world;
  }
  return { ZONE, ROOM, CAMERA, DOOR, doorSpot, fitView, project, framePoints, create, install };
});
