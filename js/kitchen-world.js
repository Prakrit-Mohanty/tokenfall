// Prompt Kitchen — the kitchen in the world. Browser: window.KitchenWorld. Node: require('./kitchen-world.js') (the pure part: layout, colliders, stations, the camera fit, the E rules, the pathing).
//
// A new zone, "kitchen" (Token Brew Kitchen · Staff only), registered through TF.registerZone at (600, 0): a plank floor, plaster walls with a striped tile backsplash (MAT.awning), wooden
// counters, steel stoves with pots, hanging red lanterns that sway, steam, a pass counter with a window and customer silhouettes behind it, a ticket rail and a stock shelf. The way in is a
// staff door on the front face of the Token Brew cafe (built here; no change to the lobby's walkable floor); the way out is the "Back to Lobby" portal. The hero is never locked: WASD and Shift
// work the whole time, the camera is held at a fixed three-quarter view that frames the whole kitchen (TF.cameraTo / TF.cameraRestore), and E works the stations.
//
//   install(TF)                 registers at the lobby's boot (after mergeStatic, so everything here stays a live object); sets TF.kitchen = world
//   world.attach(rules)         the game's rules (kitchen-play.js): rules.facts() -> what the E logic needs to know; rules.do(action) -> { ok, reason?, ... }
//   world.setPlaying(on)        while on, E / 1 / 2 / 3 / Tab work the stations; off = the kitchen is just a room
//   world.setCrates(list|null, flip)   the six pantry crates show the selected ticket's chunks: [{ label, tokens }]; a flip animation when the selection changes
//   world.setPots(list)         the capacity gauges: [{ fill: [{ tokens, conv, kind }], capacity, dialTokens, dial, status, timer }]       world.setStoveDish(i, status|null)
//   world.setTickets(list, sel) the ticket cards on the rail (3 pooled): [{ request, skill, timer, uid }]        world.bubble(i, text|null, tone)   world.stamp(i, text, tone)
//   world.carry(item|null) / world.carrying   the floating chunk (or dish) attached to the hero      world.floor.add(item, x, z) / remove(uid) / list    items lying where they were dropped
//   world.steam(i, on) / world.burst(x, z) / world.siren(secs) / world.prompt(text|null) / world.ring(progress|null)
//   world.on(evt, fn)           'enter' 'leave' 'open' (E at the ticket rail) 'tap' 'work' 'carry' 'drop' 'cycle' 'dial' 'exit' (Esc)
// Coordinates are kitchen-local metres (x right, z towards the camera); the stations come from KitchenEngine.LAYOUT, the same numbers the bots walk in kitchen-tests.js.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-engine.js') : root.KitchenEngine, isNode ? require('./kitchen-content.js') : root.KITCHEN_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld, isNode ? require('./mill-world.js') : root.MillWorld);
  if (isNode) module.exports = api;
  else root.KitchenWorld = api;
})(this, function (E, C, CW, MW) {
  const { RUN } = C, STYLE = CW.STYLE, L0 = E.LAYOUT, BASE_ASPECT = 16 / 9, TAP = 0.2;
  const POOL = { chunks: 10, cards: 3, crates: 6, gauges: 2 };   // pooled chunk meshes (carry 1, floor 6, stock shelf 3), ticket cards, pantry labels, pot gauges
  const ZONE = { cx: 600, cz: 0 };
  const CAFE = { cx: 13.4, cz: -14.6, w: 5.4, d: 4 };           // the Token Brew building in the lobby (verified against its INTER before anything is built)
  // the staff door: on the cafe's FRONT face at its east end. A door on the east face was ruled out: a hedge row (x 16.2-17.9) and the plaza's boundary hedge (x 17.4-18.2) leave a 0.46 m alley, narrower than the hero.
  const DOOR = { x: 15.3, z: CAFE.cz + CAFE.d / 2, w: 1.1, stand: [15.3, -11.3], r: 1.9, ret: [15.3, -10.4] };
  const ROOM = { x0: -12.2, x1: 12.2, zBack: -8.7, zFront: 3.4, wall: 3.4 };
  const WALK = [-11, -6.2, 11, -1.1];                            // where the hero may stand, kitchen-local: x0, z0, x1, z1
  // counters and appliances the hero cannot walk through (kitchen-local boxes x0, z0, x1, z1) and the stations the hero works from
  const BOXES = {
    pantry: [-9.4, -7.9, 9.4, -6.6], chop: [L0.chop.x - 0.8, L0.chop.z - 0.6, L0.chop.x + 0.8, L0.chop.z + 0.6], sieve: [L0.sieve.x - 0.8, L0.sieve.z - 0.6, L0.sieve.x + 0.8, L0.sieve.z + 0.6],
    stove0: [L0.stoves[0].x - 0.8, L0.stoves[0].z - 0.8, L0.stoves[0].x + 0.8, L0.stoves[0].z + 0.8], stove1: [L0.stoves[1].x - 0.8, L0.stoves[1].z - 0.8, L0.stoves[1].x + 0.8, L0.stoves[1].z + 0.8],
    pass: [-12, -1.0, 12, -0.2],
  };
  const STATIONS = [].concat(
    L0.crates.map((p, i) => ({ id: 'crate' + i, type: 'crate', index: i, x: p.x, z: p.z, r: 1.45 })),
    [{ id: 'chop', type: 'chop', x: L0.chop.x, z: L0.chop.z, r: 1.6 }, { id: 'sieve', type: 'sieve', x: L0.sieve.x, z: L0.sieve.z, r: 1.6 }, { id: 'stock', type: 'stock', x: L0.stockShelf.x, z: L0.stockShelf.z, r: 1.0 }],
    L0.pots.map((s, i) => ({ id: 'pot' + i, type: 'pot', index: i, x: s.x, z: s.z, r: 0.95 })),
    L0.knobs.map((s, i) => ({ id: 'stove' + i, type: 'stove', index: i, x: s.x, z: s.z, r: 0.95 })),
    [{ id: 'window', type: 'window', x: L0.window.x, z: L0.window.z, r: 2.1 }, { id: 'rail', type: 'rail', x: L0.rail.x, z: L0.rail.z, r: 1.6 }]);
  // the tall things between the camera and the work area: [x0, z0, x1, z1, height]. Kept short on purpose; kitchen-world-tests.js ray-casts the hero's head and chest past them
  const OCCLUDERS = [BOXES.pantry.concat(1.6), BOXES.chop.concat(1.45), BOXES.sieve.concat(1.5), BOXES.stove0.concat(1.7), BOXES.stove1.concat(1.7), BOXES.pass.concat(1.3)];
  const LABEL = { crate: 'Crate', chop: 'Chopping board', sieve: 'Sieve', stock: 'Stock shelf', pot: 'Pot', stove: 'Stove', window: 'Pass window', rail: 'Ticket rail' };

  // ---------------------------------------------------------------- pure: the camera
  // a three-quarter view from the camera side that frames the whole kitchen; pulled back along the line of sight when the window is narrower than 16:9
  const CAMERA = { pos: [-3.8, 16.2, 16.4], look: [0, 0.4, -3.2], fov: 40 };
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
  // every point the view must show: the room's floor corners, the back wall's top, and each station
  const framePoints = () => [[ROOM.x0, 0, ROOM.zBack], [ROOM.x1, 0, ROOM.zBack], [ROOM.x0, ROOM.wall, ROOM.zBack], [ROOM.x1, ROOM.wall, ROOM.zBack], [ROOM.x0, 0, ROOM.zFront], [ROOM.x1, 0, ROOM.zFront]].concat(STATIONS.map((s) => [s.x, 1.9, s.z]));

  // is a point (kitchen-local x, y, z) in sight of the camera, or does one of the OCCLUDERS stand in the way? (slab test of the ray camera -> point against each box)
  function visible(view, p) {
    const o = view.pos, d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    for (const b of OCCLUDERS) {
      let t0 = 0, t1 = 1;
      for (const [k, lo, hi] of [[0, b[0], b[2]], [1, 0, b[4]], [2, b[1], b[3]]]) {
        if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) { t0 = 2; break; } continue; }
        let a = (lo - o[k]) / d[k], c = (hi - o[k]) / d[k]; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < 0.999 && t0 > 0) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- pure: walking
  const inBox = (b, x, z, pad) => x > b[0] - pad && x < b[2] + pad && z > b[1] - pad && z < b[3] + pad;
  const walkable = (x, z, pad) => x > WALK[0] + 0 && x < WALK[2] && z > WALK[1] && z < WALK[3] && !Object.values(BOXES).some((b) => inBox(b, x, z, pad == null ? 0.32 : pad));
  // shortest walking distances between the stations on a 0.2 m grid (8 neighbours), with the hero's own 0.32 m of width: a station inside a counter is reached from the nearest free cell,
  // which must lie inside the station's radius. Returns dist(a, b) for any two station points ({ x, z } objects from KitchenEngine.LAYOUT or STATIONS).
  function makePather() {
    const G = 0.2, nx = Math.round((WALK[2] - WALK[0]) / G), nz = Math.round((WALK[3] - WALK[1]) / G), free = new Uint8Array(nx * nz);
    const cx = (i) => WALK[0] + (i + 0.5) * G, cz = (j) => WALK[1] + (j + 0.5) * G;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = walkable(cx(i), cz(j)) ? 1 : 0;
    const nearestCell = (p, rmax) => {
      let best = -1, bd = Infinity;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (free[j * nx + i]) { const d = Math.hypot(cx(i) - p.x, cz(j) - p.z); if (d < bd) { bd = d; best = j * nx + i; } }
      return { cell: best, gap: bd };
    };
    const bfs = (src) => {
      const d = new Float32Array(nx * nz).fill(Infinity), q = [src]; d[src] = 0;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], i = c % nx, j = (c / nx) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz || !free[b * nx + a]) continue;
          if (di && dj && !(free[j * nx + a] && free[b * nx + i])) continue;
          const nd = d[c] + (di && dj ? 1.4142 : 1) * G; if (nd < d[b * nx + a]) { d[b * nx + a] = nd; q.push(b * nx + a); }
        }
      }
      return d;
    };
    const cache = new Map(), pts = new Map(), reach = new Map();
    const cellOf = (p) => { const k = p.x + ',' + p.z; if (!pts.has(k)) pts.set(k, nearestCell(p)); return pts.get(k); };
    // how far from a station's centre the hero may stand and still work it: 80% of its radius (a stove's centre is a pot and a knob away, so it is given the pair's reach)
    const radiusAt = (p) => { const near = STATIONS.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) < 0.05); return near.length ? Math.max(...near.map((s) => s.r)) * 0.8 : 0.4; };
    // the walk from where the hero stands (a free cell by `a`) to the nearest free cell from which `b` can be worked
    const dist = (a, b) => {
      const ca = cellOf(a); if (!cache.has(ca.cell)) cache.set(ca.cell, bfs(ca.cell));
      const kb = b.x + ',' + b.z; if (!reach.has(kb)) { const r = radiusAt(b), cells = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (free[j * nx + i] && Math.hypot(cx(i) - b.x, cz(j) - b.z) <= r) cells.push(j * nx + i); reach.set(kb, cells.length ? cells : [cellOf(b).cell]); }
      const d = cache.get(ca.cell); let m = Infinity; for (const c of reach.get(kb)) if (d[c] < m) m = d[c];
      return m;
    };
    return { dist, cellOf, free, size: [nx, nz] };
  }

  // ---------------------------------------------------------------- pure: the E rules (the interaction radius decides, never the exact tile)
  // the nearest thing the hero can work: a station within its radius, or a dropped item within 1.0; stations win ties. p and every position are kitchen-local.
  function nearest(p, floor) {
    let best = null;
    for (const s of STATIONS) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d <= s.r && (!best || d - 0.3 < best.d)) best = { kind: 'station', ref: s, d }; }
    for (const f of floor || []) { const d = Math.hypot(p.x - f.x, p.z - f.z); if (d <= 1.0 && (!best || d + 0.3 < best.d)) best = { kind: 'floor', ref: f, d }; }
    return best;
  }
  // what holding E does here, or null. facts = { carry: { dish, role, version, canChop, canSieve, stable, stock } | null, pots: [{ items, residue, busy }], stoves: [{ dish }], stockHas }
  function holdWork(near, facts) {
    if (!near || near.kind !== 'station' || !facts) return null;
    const s = near.ref, c = facts.carry, T = RUN.time, i = s.index;
    switch (s.type) {
      case 'chop': return c && !c.dish && c.canChop ? { kind: 'chop', dur: T.chop } : null;
      case 'sieve': return c && !c.dish && c.canSieve ? { kind: 'sieve', dur: T.sieve } : null;
      case 'stock': return c && !c.dish && c.stable && c.version === 'full' && !c.stock ? { kind: 'prep', dur: T.stockPrep } : null;
      case 'pot': { const p = facts.pots[i]; return !c && p && !p.busy && (p.items > 0 || p.residue) ? { kind: 'wipe', dur: T.wipe, pot: i } : null; }
      case 'stove': { const p = facts.pots[i], st = facts.stoves[i]; return !c && p && !p.busy && p.items > 0 && !st.dish ? { kind: 'cook', dur: T.cook, stove: i } : null; }
    }
    return null;
  }
  // what tapping E does here. { do, ... } for the rules, or { hint } for a one-line nudge, or null
  function tapAction(near, facts) {
    const c = facts && facts.carry;
    if (!near) return c ? { do: 'drop', where: 'floor' } : null;
    if (near.kind === 'floor') return c ? { hint: 'Your hands are full.' } : { do: 'pickup', uid: near.ref.item.uid };
    const s = near.ref, i = s.index;
    switch (s.type) {
      case 'crate': return c ? { hint: 'Your hands are full: drop it or use it first.' } : { do: 'grab', crate: i };
      case 'chop': return c ? { hint: c.canChop ? 'Hold E to chop it into a summary.' : 'Nothing to chop in this one.' } : null;
      case 'sieve': return c ? { hint: c.canSieve ? 'Hold E to sieve out an excerpt.' : 'Nothing to sieve from this one.' } : null;
      case 'stock': return c ? { hint: c.stable && c.version === 'full' ? 'Hold E to prep it as stock.' : 'Only a whole, stable chunk can be stock.' } : (facts.stockHas ? { do: 'stock' } : null);
      case 'pot': return c && !c.dish ? { do: 'load', pot: i } : c ? { hint: 'Serve it at the window.' } : null;
      case 'stove': { const st = facts.stoves[i]; return !c && st && st.dish ? { do: 'take', stove: i } : c ? { hint: 'Put chunks in the pot, then hold E at the stove to cook.' } : null; }
      case 'window': return c && c.dish ? { do: 'serve' } : c ? { hint: 'Only a finished dish goes through the window.' } : null;
      case 'rail': return { do: 'cycle' };
    }
    return null;
  }
  // the progress ring of a hold: it shows after TAP seconds, completes at dur, and cancels if the key is released, the hero walks out of range or the work stops being valid
  function holdStep(h, dt, valid) {
    if (!valid) return { cancelled: true, progress: 0, done: false };
    const t = h.t + dt, p = Math.min(1, t / h.dur);
    return { t, progress: t >= TAP ? p : 0, done: p >= 1, cancelled: false };
  }
  // the capacity gauge: one segment per chunk (width by tokens), the residue first, then the headspace the dial asks for, as pixel spans of a bar `width` wide
  function gaugeSegments(fill, capacity, dialTokens, width) {
    const u = width / capacity, out = []; let x = 0;
    for (const f of fill) { const w = Math.max(1, Math.round(f.tokens * u)); out.push({ x, w: Math.min(w, width - x), tokens: f.tokens, conv: f.conv, kind: f.kind || 'chunk' }); x += w; }
    const used = fill.reduce((n, f) => n + f.tokens, 0), headX = Math.round((capacity - dialTokens) * u);
    return { segments: out, headX, usedX: Math.round(used * u), over: used + dialTokens > capacity, used, free: capacity - used - dialTokens };
  }

  // ---------------------------------------------------------------- the scene (browser only)
  function create(TF) {
    const { THREE, scene, MAT } = TF, listeners = [];
    const S = {
      built: false, in: false, playing: false, rules: null, A: null, tok: null, root: null, dyn: null, carry: null, floorItems: [], hold: null, near: null, aspect: 0, camOn: false, crates: [], flips: [], gauges: [], cards: [],
      customers: [], steam: [], puffs: [], lanterns: [], sparks: [], hint: null, hintT: 0, siren: 0, heroMesh: null, ringMesh: null, ui: null, lights: [], stoveDishes: [], door: null, tickets: [], sel: 0, eDown: false,
    };
    const world = { state: S, LAYOUT: { ZONE, ROOM, WALK, BOXES, STATIONS, CAMERA, DOOR, POOL }, STATIONS };
    const emit = (evt, a) => listeners.forEach(([e, f]) => (e === evt || e === '*') && f(a, evt));
    world.on = (evt, fn) => { listeners.push([evt, fn]); return fn; };
    Object.defineProperty(world, 'carrying', { get: () => S.carry });
    const warm = () => MAT.warmGlow.emissive.getHex();   // the lamps share the lobby's warm glow
    const V = (x, y, z) => new THREE.Vector3(S.A.cx + x, y, S.A.cz + z);
    const local = () => ({ x: TF.hero.x - S.A.cx, z: TF.hero.y - S.A.cz });

    // ---- the colours and the font come from the lobby's own tokens, never from hex written here ----
    function tokens() {
      const cs = getComputedStyle(document.documentElement), v = (k, d) => cs.getPropertyValue(k).trim() || d, hex = (c) => '#' + c.getHexString();
      return { paper: v('--ink', '#f3ead6'), gold: v('--gold', '#d9b46a'), dark: hex(MAT.lanternCap.color), wood: hex(MAT.lanternCap.color.clone().multiplyScalar(1.7)), red: hex(MAT.redLantern.color), font: getComputedStyle(document.body).fontFamily || 'sans-serif' };
    }

    // ---- dynamic textures: drawn when the kitchen is entered, freed when it is left ----
    function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; return { c, g: c.getContext('2d'), tex, w, h }; }
    function acquire() {
      if (S.dyn) return;
      const D = S.dyn = { crates: [], gauges: [], cards: [], carry: canvas(256, 80), ring: canvas(128, 128), bubbles: [] };
      for (let i = 0; i < POOL.crates; i++) D.crates.push(canvas(256, 112));
      for (let i = 0; i < POOL.gauges; i++) D.gauges.push(canvas(256, 96));
      for (let i = 0; i < POOL.cards; i++) D.cards.push(canvas(256, 192));
      for (let i = 0; i < 3; i++) D.bubbles.push(canvas(256, 112));
      S.crates.forEach((m, i) => { m.label.material.map = D.crates[i].tex; m.label.material.needsUpdate = true; });
      S.gauges.forEach((m, i) => { m.material.map = D.gauges[i].tex; m.material.needsUpdate = true; });
      S.cards.forEach((m, i) => { m.material.map = D.cards[i].tex; m.material.needsUpdate = true; });
      S.heroMesh.label.material.map = D.carry.tex; S.heroMesh.label.material.needsUpdate = true;
      S.ringMesh.material.map = D.ring.tex; S.ringMesh.material.needsUpdate = true;
      S.customers.forEach((m, i) => { m.bubble.material.map = D.bubbles[i % 3].tex; m.bubble.material.needsUpdate = true; });
      world.setCrates(null); world.setPots([{ fill: [], capacity: RUN.capacity, dialTokens: RUN.dial.short, dial: 'short', status: 'idle' }, { fill: [], capacity: RUN.capacity, dialTokens: RUN.dial.short, dial: 'short', status: 'idle' }]); world.setTickets([], 0);
    }
    function release() {
      if (!S.dyn) return;
      const all = [].concat(S.dyn.crates, S.dyn.gauges, S.dyn.cards, S.dyn.bubbles, [S.dyn.carry, S.dyn.ring]);
      all.forEach((x) => x.tex.dispose());
      [].concat(S.crates.map((m) => m.label), S.gauges, S.cards, [S.heroMesh.label, S.ringMesh], S.customers.map((m) => m.bubble)).forEach((m) => { m.material.map = null; m.material.needsUpdate = true; m.visible = false; });
      S.dyn = null;
    }
    const wrap = (g, text, maxW) => MW.wrapLines(text, maxW, (s) => g.measureText(s).width);
    function badge(g, x, y, r, text) {
      const t = S.tok; g.fillStyle = t.dark; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); g.lineWidth = 3; g.strokeStyle = t.gold; g.stroke();
      g.fillStyle = t.paper; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${r > 22 ? 22 : 16}px ${t.font}`; g.fillText(String(text), x, y + 1);
    }
    function drawCrate(i, chunk) {
      const d = S.dyn.crates[i], g = d.g, t = S.tok;
      g.fillStyle = t.paper; g.fillRect(0, 0, d.w, d.h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, d.w, 5); g.fillRect(0, d.h - 5, d.w, 5);
      if (!chunk) { g.fillStyle = t.dark; g.globalAlpha = 0.35; g.font = `600 22px ${t.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('empty', d.w / 2, d.h / 2); g.globalAlpha = 1; d.tex.needsUpdate = true; return; }
      g.fillStyle = t.dark; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 24px ${t.font}`;
      wrap(g, chunk.label, 150).slice(0, 3).forEach((l, k) => g.fillText(l, 12, 30 + k * 28));
      badge(g, 206, 54, 30, chunk.tokens); g.fillStyle = t.dark; g.font = `600 13px ${t.font}`; g.textAlign = 'center'; g.fillText('tokens', 206, 94);
      d.tex.needsUpdate = true;
    }
    function drawCarry(item) {
      const d = S.dyn.carry, g = d.g, t = S.tok; g.clearRect(0, 0, d.w, d.h);
      if (!item) { d.tex.needsUpdate = true; return; }
      g.fillStyle = t.paper; g.fillRect(0, 0, d.w, d.h); g.strokeStyle = t.gold; g.lineWidth = 4; g.strokeRect(2, 2, d.w - 4, d.h - 4);
      g.fillStyle = t.dark; g.textAlign = 'left'; g.textBaseline = 'middle'; let size = 24; g.font = `700 ${size}px ${t.font}`;
      const text = item.dish ? 'Dish' : item.label + (item.version && item.version !== 'full' ? ' · ' + item.version : ''); while (g.measureText(text).width > 170 && size > 14) { size -= 2; g.font = `700 ${size}px ${t.font}`; }
      g.fillText(text, 12, d.h / 2 + 1); if (!item.dish) badge(g, 218, d.h / 2, 22, item.tokens != null ? item.tokens : '');
      d.tex.needsUpdate = true;
    }
    function drawRing(p) {
      const d = S.dyn.ring, g = d.g, t = S.tok; g.clearRect(0, 0, d.w, d.h); if (p == null) { d.tex.needsUpdate = true; return; }
      g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(64, 64, 48, 0, 6.283); g.stroke();
      g.strokeStyle = t.gold; g.beginPath(); g.arc(64, 64, 48, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); g.stroke(); d.tex.needsUpdate = true;
    }
    function drawGauge(i, o) {
      const d = S.dyn.gauges[i], g = d.g, t = S.tok, W = 232, X = 12, Y = 28, H = 34; g.clearRect(0, 0, d.w, d.h);
      g.fillStyle = t.dark; g.globalAlpha = 0.86; g.fillRect(0, 0, d.w, d.h); g.globalAlpha = 1; g.strokeStyle = t.gold; g.lineWidth = 3; g.strokeRect(1.5, 1.5, d.w - 3, d.h - 3);
      const gs = gaugeSegments(o.fill || [], o.capacity, o.dialTokens, W), conv = {};
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(X, Y, W, H);
      gs.segments.forEach((s) => { const k = conv[s.conv] != null ? conv[s.conv] : (conv[s.conv] = Object.keys(conv).length % 4); g.fillStyle = STYLE[k].css; g.globalAlpha = s.kind === 'residue' ? 0.55 : 1; g.fillRect(X + s.x, Y, Math.max(1, s.w - 2), H); g.globalAlpha = 1; });
      g.fillStyle = gs.over ? t.red : t.paper; g.globalAlpha = 0.35; g.fillRect(X + gs.headX, Y, W - gs.headX, H); g.globalAlpha = 1;
      g.fillStyle = gs.over ? t.red : t.paper; g.fillRect(X + gs.headX - 1, Y - 6, 3, H + 12);
      g.fillStyle = t.paper; g.font = `700 20px ${t.font}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(`${gs.used} + ${o.dialTokens} / ${o.capacity}`, X, 14); g.textAlign = 'right'; g.fillText((o.dial || '').toUpperCase(), X + W, 14);
      if (o.timer != null) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(X, 76, W, 8); g.fillStyle = o.status === 'ready' ? STYLE[1].css : o.status === 'burnt' ? t.red : t.gold; g.fillRect(X, 76, W * Math.max(0, Math.min(1, o.timer)), 8); }
      d.tex.needsUpdate = true;
    }
    function drawCard(i, tk, sel) {
      const d = S.dyn.cards[i], g = d.g, t = S.tok; g.clearRect(0, 0, d.w, d.h);
      if (!tk) { d.tex.needsUpdate = true; return; }
      g.fillStyle = t.paper; g.fillRect(0, 0, d.w, d.h); g.strokeStyle = sel ? t.gold : t.dark; g.lineWidth = sel ? 9 : 3; g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, d.w - g.lineWidth, d.h - g.lineWidth);
      const sk = STYLE[tk.skill || 0]; g.fillStyle = sk.css; g.beginPath(); g.arc(34, 38, 24, 0, 6.283); g.fill(); g.fillStyle = t.dark; g.font = `700 26px ${t.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sk.mark, 34, 39);
      g.textAlign = 'left'; g.font = `700 21px ${t.font}`; wrap(g, tk.request, 190).slice(0, 5).forEach((l, k) => g.fillText(l, 70, 30 + k * 26));
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(14, 168, 228, 12); g.fillStyle = tk.timer < 0.25 ? t.red : t.dark; g.fillRect(14, 168, 228 * Math.max(0, Math.min(1, tk.timer)), 12); d.tex.needsUpdate = true;
    }
    function drawBubble(i, text, tone) {
      const d = S.dyn.bubbles[i % 3], g = d.g, t = S.tok; g.clearRect(0, 0, d.w, d.h); if (!text) { d.tex.needsUpdate = true; return; }
      g.fillStyle = t.paper; g.fillRect(0, 0, d.w, 82); g.strokeStyle = tone === 'bad' ? t.red : tone === 'ok' ? STYLE[1].css : t.gold; g.lineWidth = 5; g.strokeRect(2.5, 2.5, d.w - 5, 77);
      g.fillStyle = t.paper; g.beginPath(); g.moveTo(112, 80); g.lineTo(128, 108); g.lineTo(144, 80); g.fill();
      g.fillStyle = t.dark; g.font = `600 17px ${t.font}`; g.textAlign = 'left'; g.textBaseline = 'middle'; wrap(g, text, 232).slice(0, 3).forEach((l, k) => g.fillText(l, 12, 22 + k * 22)); d.tex.needsUpdate = true;
    }

    // ---- public drawing API ----
    world.setCrates = (list, flip) => {
      if (!S.dyn) return;
      S.crates.forEach((m, i) => {
        const chunk = list && list[i] ? list[i] : null;
        if (flip && S.in) S.flips.push({ i, t: -0.06 * i, chunk, swapped: false }); else { drawCrate(i, chunk); m.label.visible = true; m.label.rotation.x = -0.35; }
      });
    };
    world.setPots = (list) => { if (!S.dyn) return; list.forEach((o, i) => { S.gauges[i].visible = true; drawGauge(i, o); }); };
    world.setTickets = (list, sel) => { if (!S.dyn) return; S.tickets = list; S.sel = sel; S.cards.forEach((m, i) => { m.visible = !!list[i]; drawCard(i, list[i], i === sel); }); };
    world.bubble = (i, text, tone) => { if (!S.dyn || !S.customers[i]) return; drawBubble(i, text, tone); S.customers[i].bubble.visible = !!text; };
    world.stamp = (i, text, tone) => world.bubble(i, text, tone);
    world.carry = (item) => {
      S.carry = item || null; if (!S.dyn) return;
      drawCarry(S.carry); S.heroMesh.group.visible = !!S.carry; S.heroMesh.block.visible = !!S.carry && !S.carry.dish; S.heroMesh.dish.visible = !!S.carry && !!S.carry.dish;
      emit('carry', S.carry);
    };
    world.ring = (p) => { if (!S.dyn) return; drawRing(p); S.ringMesh.visible = p != null; };
    world.prompt = (text) => { if (!S.ui) return; S.ui.prompt.style.display = text ? 'block' : 'none'; if (text) S.ui.prompt.innerHTML = text; };
    world.steam = (i, on) => { if (S.steam[i]) S.steam[i].on = !!on; };
    world.setStoveDish = (i, status) => { const m = S.stoveDishes[i]; if (m) { m.visible = !!status; m.userData.status = status; } };
    world.siren = (secs) => { S.siren = secs || 0; };
    world.burst = (x, z) => { for (const p of S.sparks) if (!p.on) { p.on = true; p.t = 0; p.m.visible = true; p.m.position.set(S.A.cx + x, 1.5, S.A.cz + z); p.v.set((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2); } };
    world.floor = {
      add(item, x, z) { const m = S.floorMeshes.find((q) => !q.item); if (!m) return null; m.item = item; m.x = x; m.z = z; m.group.visible = true; m.group.position.set(S.A.cx + x, 0.05, S.A.cz + z); const e = { item, x, z, mesh: m }; S.floorItems.push(e); return e; },
      remove(uid) { const k = S.floorItems.findIndex((e) => e.item.uid === uid); if (k < 0) return null; const e = S.floorItems.splice(k, 1)[0]; e.mesh.item = null; e.mesh.group.visible = false; return e.item; },
      list: () => S.floorItems.map((e) => ({ item: e.item, x: e.x, z: e.z })), clear() { while (S.floorItems.length) world.floor.remove(S.floorItems[0].item.uid); },
    };

    // ---- the room ----
    function build() {
      const A = S.A, bx = (w, h, d, m, x, y, z, o) => TF.box(w, h, d, m, A.cx + x, y, A.cz + z, o), R = ROOM;
      const kids = new Set(scene.children), snap = { inter: TF.INTER.length, cols: TF.COL.length, ports: TF.PORTALS.length, anim: TF.anim.length, walk: TF.WALK.length };
      const mesh = (g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(A.cx + x, y, A.cz + z); me.castShadow = true; me.receiveShadow = true; scene.add(me); return me; };
      const midZ = (R.zBack + R.zFront) / 2, depth = R.zFront - R.zBack;
      TF.plane(90, 70, MAT.concrete, A.cx, 0, A.cz, 2);
      TF.plane(R.x1 - R.x0, depth, MAT.floor, A.cx, 0.012, A.cz + midZ, MAT.floor.userData.s);
      // walls: plaster, a concrete cap, the striped tile backsplash on the back wall (the cafe's own awning pattern), two windows
      bx(R.x1 - R.x0 + 0.6, R.wall, 0.4, MAT.plaster, 0, 0, R.zBack - 0.2); bx(R.x1 - R.x0 + 1, 0.2, 0.7, MAT.concrete, 0, R.wall, R.zBack - 0.2);
      for (const s of [-1, 1]) { bx(0.4, R.wall, depth + 0.4, MAT.plaster, s * (R.x1 + 0.2), 0, midZ); bx(0.7, 0.2, depth + 0.8, MAT.concrete, s * (R.x1 + 0.2), R.wall, midZ); }
      bx(R.x1 - R.x0, 1.15, 0.1, MAT.awning, 0, 0.95, R.zBack + 0.05, { s: 1.15 }); bx(R.x1 - R.x0, 0.08, 0.14, MAT.chrome, 0, 2.1, R.zBack + 0.07);
      for (const x of [-7.4, 7.4]) bx(2.4, 1.0, 0.08, MAT.glass, x, 2.15, R.zBack + 0.06, { s: 0 });
      // the pantry counter along the back wall, six crates on it
      bx(18.8, 0.9, 1.3, MAT.wood, 0, 0, -7.25); bx(19, 0.1, 1.5, MAT.darkWood, 0, 0.9, -7.25);
      for (const p of L0.crates) { bx(1.5, 0.5, 0.9, MAT.wood, p.x, 1.0, -7.1); bx(1.56, 0.08, 0.96, MAT.darkWood, p.x, 1.5, -7.1); }
      // the chopping board and the sieve: counters with their tools
      for (const [k, p, box] of [['chop', L0.chop, BOXES.chop], ['sieve', L0.sieve, BOXES.sieve]]) {
        const cx = (box[0] + box[2]) / 2, cz = (box[1] + box[3]) / 2; bx(1.6, 0.9, 1.2, MAT.wood, cx, 0, cz); bx(1.7, 0.1, 1.3, MAT.darkWood, cx, 0.9, cz);
        if (k === 'chop') { bx(1.1, 0.08, 0.7, MAT.walnut, cx, 1.0, cz); bx(0.5, 0.04, 0.06, MAT.chrome, cx - 0.1, 1.08, cz + 0.2, { ry: 0.3 }); bx(0.14, 0.05, 0.14, MAT.wood, cx + 0.4, 1.08, cz - 0.1); }
        else { const bowl = mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.3, 14), MAT.steel, cx, 1.15, cz); bowl.castShadow = true; mesh(new THREE.TorusGeometry(0.55, 0.035, 5, 18), MAT.chrome, cx, 1.31, cz).rotation.x = Math.PI / 2; mesh(new THREE.CircleGeometry(0.5, 14), MAT.lattice, cx, 1.29, cz).rotation.x = -Math.PI / 2; }
        TF.COL.push({ x0: A.cx + box[0], z0: A.cz + box[1], x1: A.cx + box[2], z1: A.cz + box[3] });
      }
      // the stock shelf: a wall unit over the middle of the pantry counter, three jars on it
      { const sx = L0.stockShelf.x; bx(1.3, 0.08, 0.5, MAT.wood, sx, 2.2, R.zBack + 0.3); bx(0.08, 0.5, 0.4, MAT.darkWood, sx - 0.6, 2.2, R.zBack + 0.3); bx(0.08, 0.5, 0.4, MAT.darkWood, sx + 0.6, 2.2, R.zBack + 0.3); }
      // the stoves: steel bodies, burners, a pot each
      L0.stoves.forEach((s, i) => {
        bx(1.6, 0.9, 1.6, MAT.steel, s.x, 0, s.z); bx(1.64, 0.06, 1.64, MAT.chrome, s.x, 0.9, s.z);
        for (const k of [-0.4, 0, 0.4]) bx(0.08, 0.12, 0.12, MAT.chrome, s.x + (i ? -0.82 : 0.82), 0.5, s.z + k);
        const ring = mesh(new THREE.TorusGeometry(0.42, 0.04, 5, 20), TF.glowStrip(STYLE[0].hex), s.x, 0.98, s.z); ring.rotation.x = Math.PI / 2; ring.userData.dyn = true;
        const pot = mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.62, 16), MAT.pot, s.x, 1.3, s.z); pot.userData.dyn = false; mesh(new THREE.TorusGeometry(0.5, 0.045, 5, 18), MAT.chrome, s.x, 1.61, s.z).rotation.x = Math.PI / 2;
        for (const q of [-1, 1]) bx(0.1, 0.08, 0.22, MAT.chrome, s.x + q * 0.58, 1.42, s.z);
        TF.COL.push({ x0: A.cx + BOXES['stove' + i][0], z0: A.cz + BOXES['stove' + i][1], x1: A.cx + BOXES['stove' + i][2], z1: A.cz + BOXES['stove' + i][3] });
      });
      TF.COL.push({ x0: A.cx + BOXES.pantry[0], z0: A.cz + BOXES.pantry[1], x1: A.cx + BOXES.pantry[2], z1: A.cz + BOXES.pantry[3] });
      // the pass: a counter across the room with a bell, and a low rack for the ticket cards on its west end. Nothing here is taller than the counter plus the cards: from the fixed
      // camera a tall frame or sign in front of the work area would hide the hero behind it (kitchen-world-tests.js checks the hero stays in sight)
      bx(24, 1.1, 0.8, MAT.wood, 0, 0, -0.6); bx(24.2, 0.1, 1.0, MAT.walnut, 0, 1.1, -0.6); bx(5.6, 0.07, 0.07, MAT.warmGlow, 0, 1.22, -0.12, { cast: false });
      mesh(new THREE.SphereGeometry(0.16, 10, 6), MAT.chrome, 1.6, 1.28, -0.6); bx(0.34, 0.05, 0.34, MAT.chrome, 1.6, 1.2, -0.6);
      for (const x of [-9.7, -4.1]) bx(0.1, 0.55, 0.1, MAT.metal, x, 1.2, -0.85); bx(5.7, 0.07, 0.07, MAT.steel, -6.9, 1.7, -0.85);
      // the way out: a doorway glow in the east wall and the portal in front of it
      bx(0.3, 2.6, 2.4, MAT.darkWood, R.x1 - 0.05, 0, -2.4); bx(0.1, 2.3, 1.9, MAT.door, R.x1 - 0.12, 0, -2.4);
      TF.signBoard('Back to the cafe', A.cx + R.x1 - 0.2, 2.75, A.cz - 2.4, 2.0, 0.4, -Math.PI / 2);
      TF.portal(A.cx + 9.8, A.cz - 2.4, STYLE[0].hex, 'kitchen', 'lobby', 'TokenFall Lobby');
      if (TF.sparkles) S.railSparkles = TF.sparkles(A.cx + L0.rail.x, A.cz + L0.rail.z, STYLE[0].hex, 20, 0.7, 2.3);   // where a shift starts: E at the Ticket Rail
      // lanterns hang from short brackets on the back wall (a beam across the room would stand between the camera and the hero)
      const lg = new THREE.SphereGeometry(0.34, 10, 8), cg = new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8);
      for (let i = 0; i < 6; i++) {
        const x = -9.4 + i * 3.76; bx(0.08, 0.08, 0.7, MAT.darkWood, x, 3.05, R.zBack + 0.35);
        const grp = new THREE.Group(); grp.userData.dyn = true; grp.position.set(A.cx + x, 3.05, A.cz + R.zBack + 0.65);
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), MAT.lanternCap); cord.position.y = -0.2; grp.add(cord);
        const body = new THREE.Mesh(lg, MAT.redLantern); body.scale.y = 1.2; body.position.y = -0.7; grp.add(body); const cap = new THREE.Mesh(cg, MAT.lanternCap); cap.position.y = -0.42; grp.add(cap);
        scene.add(grp); S.lanterns.push({ g: grp, ph: i * 1.3 });
      }
      for (const [x, y, z, k, d] of [[-6, 3.0, -4, 0.85, 15], [6, 3.0, -4, 0.85, 15], [0, 2.8, 0.5, 0.55, 12], [0, 2.9, -7.2, 0.5, 11]]) S.lights.push(TF.pointLight('kitchen', warm(), k, d, A.cx + x, y, A.cz + z));
      // the staff door and its way in, in the lobby
      buildDoor();
      // everything static is grouped (for the zone's own bookkeeping), the live parts stay free
      S.reg = { inter: TF.INTER.slice(snap.inter), cols: TF.COL.slice(snap.cols), ports: TF.PORTALS.slice(snap.ports), walk: TF.WALK.slice(snap.walk) };
      TF.WALK.push([A.cx + WALK[0], A.cz + WALK[1], A.cx + WALK[2], A.cz + WALK[3]]);
      const fresh = scene.children.filter((o) => !kids.has(o) && !o.userData.dyn);
      S.root = new THREE.Group(); S.root.name = 'kitchen'; scene.add(S.root); fresh.forEach((o) => S.root.add(o));
      S.statics = fresh.length;
      if (TF.mergeStatic) TF.mergeStatic(S.root);
    }
    function buildDoor() {
      const cafe = TF.INTER.find((q) => q.label === 'Token Brew');
      if (!cafe || Math.abs(cafe.x - CAFE.cx) > 0.01 || Math.abs(cafe.z - (CAFE.cz + CAFE.d / 2 + 1.2)) > 0.05) { S.door = null; return; }   // the cafe moved: no door, no entrance
      const x = DOOR.x, z = DOOR.z, mk = (w, h, d, m, ox, y, oz, o) => TF.box(w, h, d, m, x + ox, y, z + oz, o);
      mk(DOOR.w + 0.3, 2.5, 0.12, MAT.darkWood, 0, 0.3, 0.1); mk(DOOR.w, 2.3, 0.1, MAT.door, 0, 0.3, 0.17); mk(0.06, 0.14, 0.08, MAT.chrome, DOOR.w / 2 - 0.15, 1.3, 0.25);
      mk(DOOR.w + 0.9, 0.06, 0.9, MAT.concrete, 0, 0.3, 0.55);
      TF.signBoard('Kitchen - Staff', x, 2.95, z + 0.2, 1.7, 0.4, 0);
      TF.pointLight('lobby', warm(), 0.7, 5, x, 2.7, z + 1.4);
      TF.INTER.push({ x: DOOR.stand[0], z: DOOR.stand[1], r: DOOR.r, label: 'Token Brew Kitchen', verb: 'Cook', act: () => world.enterKitchen() });
      // the way in is marked like every other game: the amber twinkle, and a low board in front of the door that the umbrellas do not hide
      if (TF.sparkles) S.doorSparkles = TF.sparkles(DOOR.stand[0], DOOR.stand[1] - 0.2, STYLE[0].hex, 24, 0.8, 2.6);
      mk(0.14, 0.7, 0.14, MAT.darkWood, -0.9, 0.3, 1.1); mk(0.14, 0.7, 0.14, MAT.darkWood, 0.9, 0.3, 1.1); TF.signBoard('Kitchen: cook a shift', x, 1.35, z + 1.1, 2.1, 0.46, 0);
      S.door = { x, z };
    }
    // the dynamic pieces: pantry labels, gauges, ticket cards, the carried chunk, the ring, customers, steam, sparks, floor items
    function buildLive() {
      const A = S.A, plane = (w, h, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.userData.dyn = true; scene.add(m); return m; };
      const basic = () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
      for (const p of L0.crates) { const lab = plane(1.7, 0.74, new THREE.MeshBasicMaterial({ transparent: true })); lab.position.set(A.cx + p.x, 1.68, A.cz - 6.62); lab.rotation.x = -0.35; lab.visible = false; S.crates.push({ label: lab }); }
      L0.stoves.forEach((s, i) => { const g = plane(3.3, 1.24, basic()); g.position.set(A.cx + s.x, 3.2, A.cz + s.z + 0.2); g.visible = false; S.gauges.push(g); const st = new THREE.Group(); st.userData.dyn = true; const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.05, 14), MAT.chrome), dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 6, 0, 6.283, 0, 1.5), MAT.chrome); dome.position.y = 0.03; st.add(plate, dome); st.position.set(A.cx + s.x + 0.0, 1.0, A.cz + s.z + 0.62); st.visible = false; scene.add(st); S.stoveDishes.push(st); });
      for (let i = 0; i < POOL.cards; i++) { const c = plane(1.78, 1.34, new THREE.MeshBasicMaterial({ transparent: true })); c.position.set(A.cx - 8.65 + i * 1.88, 1.78, A.cz - 0.72); c.visible = false; c.rotation.x = -0.8; S.cards.push(c); }
      // the carried chunk: a small crate and its label, or a covered dish, on a group that rides on the hero
      const grp = new THREE.Group(); grp.visible = false; grp.position.y = 2.15; TF.hero.g.add(grp);
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.4), MAT.wood); block.castShadow = true; grp.add(block);
      const dish = new THREE.Group(); dish.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.05, 12), MAT.chrome)); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6, 0, 6.283, 0, 1.5), MAT.chrome); dome.position.y = 0.03; dish.add(dome); dish.visible = false; grp.add(dish);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); label.position.set(0, 0.55, 0.05); label.rotation.x = -0.45; grp.add(label);
      S.heroMesh = { group: grp, block, dish, label };
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), basic()); ring.position.y = 1.05; ring.position.z = 0.4; ring.rotation.x = -0.45; ring.visible = false; TF.hero.g.add(ring); S.ringMesh = ring;
      // pooled chunk meshes lying on the floor (6) and on the stock shelf (3)
      S.floorMeshes = [];
      for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.userData.dyn = true; const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.4), MAT.wood); b.position.y = 0.13; b.castShadow = true; g.add(b); g.visible = false; scene.add(g); S.floorMeshes.push({ group: g, item: null, x: 0, z: 0 }); }
      S.shelfJars = []; for (let i = 0; i < 3; i++) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.3), MAT.pot); j.userData.dyn = true; j.position.set(A.cx + L0.stockShelf.x - 0.35 + i * 0.35, 2.4, A.cz + ROOM.zBack + 0.3); j.visible = false; scene.add(j); S.shelfJars.push(j); }
      // customers behind the pass: dark silhouettes, a reply bubble above each
      const body = new THREE.BoxGeometry(0.7, 1.25, 0.36), head = new THREE.SphereGeometry(0.24, 10, 8);
      [-6.2, -2.4, 2.2, 6.4, 9.6].forEach((x, i) => {
        const g = new THREE.Group(); g.userData.dyn = true; g.position.set(A.cx + x, 0, A.cz + 1.5);
        const b = new THREE.Mesh(body, MAT.cabinet); b.position.y = 0.62; b.castShadow = true; g.add(b); const h = new THREE.Mesh(head, MAT.cabinet); h.position.y = 1.5; g.add(h);
        const bub = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.14), basic()); bub.position.set(0, 2.7, 0); bub.visible = false; bub.rotation.x = -0.5; g.add(bub);
        scene.add(g); S.customers.push({ g, ph: i * 0.9, bubble: bub });
      });
      // steam puffs over the pots, gold sparks for a perfect serve
      const puffTex = TF.canvasTex(16, 16, (g, w, h) => { const gr = g.createRadialGradient(8, 8, 1, 8, 8, 8); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { nearest: false });
      L0.stoves.forEach((s) => { const set = { on: false, x: s.x, z: s.z, puffs: [] }; for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); m.userData.dyn = true; m.visible = false; scene.add(m); set.puffs.push({ m, t: k * 0.4 }); } S.steam.push(set); });
      const gg = new THREE.BoxGeometry(0.09, 0.09, 0.09);
      for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: MAT.gold.color, transparent: true })); m.visible = false; m.userData.dyn = true; scene.add(m); S.sparks.push({ m, on: false, t: 0, v: new THREE.Vector3() }); }
    }

    // ---- the zone: entering, leaving, the fixed camera ----
    const camNow = () => fitView(TF.camera.aspect || BASE_ASPECT);
    function applyCamera(ms) { const c = camNow(); TF.cameraTo(V(...c.pos), V(...c.look), ms, c.fov); S.aspect = TF.camera.aspect; S.camOn = true; }
    world.view = () => camNow();
    world.enterKitchen = () => {
      if (!S.built || !S.door || TF.traveling || TF.talking || TF.locked || TF.cameraHeld || TF.zone !== 'lobby') return false;
      TF.travel({ zone: 'lobby', to: 'kitchen' }); return true;
    };
    function onZone(prev, z) {
      if (z === 'kitchen' && !S.in) {
        S.in = true; acquire(); S.ui.root.style.display = 'block';
        setTimeout(() => { if (S.in) applyCamera(800); }, 0);   // after the lobby has put the follow camera at the hero, so the ease starts from this room
        TF.sys('Token Brew Kitchen: walk west along the pass to the Ticket Rail (the glowing spot) and press E to start a shift.');
        emit('enter');
      } else if (prev === 'kitchen' && z !== 'kitchen') {
        S.in = false; S.camOn = false; S.hold = null; S.eDown = false; world.setPlaying(false); world.carry(null); world.floor.clear(); TF.cameraRestore(0); release(); S.ui.root.style.display = 'none';
        emit('leave');
      }
    }
    world.onZone = onZone;
    world.busy = (on) => { S.busy = !!on; };   // a shift is on (or its debrief): the twinkle at the rail rests
    world.setPlaying = (on) => { S.playing = !!on; if (!on) { S.hold = null; world.ring(null); world.prompt(null); } };
    world.attach = (rules) => { S.rules = rules; };
    world.open = () => { emit('open'); if (!S.rules) TF.banner('Token Brew Kitchen', 'The shift starts in the next build'); };

    // ---- input: E (tap or hold), 1 2 3 (the dial), Tab (select a ticket), Esc ----
    const facts = () => (S.rules ? S.rules.facts() : { carry: null, pots: [{ items: 0, residue: false, busy: false }, { items: 0, residue: false, busy: false }], stoves: [{}, {}], stockHas: false });
    const nearNow = () => nearest(local(), S.floorItems);
    function hint(text) { S.hint = text; S.hintT = 2.2; }
    function exec(a) {
      if (a.hint) { hint(a.hint); return; }
      const r = S.rules ? S.rules.do(Object.assign({ item: S.carry }, a)) : { ok: false, reason: 'no rules' };
      if (a.do === 'grab' && r && r.ok) world.carry(r.item);
      else if (a.do === 'pickup' && r && r.ok) { world.floor.remove(a.uid); world.carry(r.item); }
      else if (a.do === 'stock' && r && r.ok) world.carry(r.item);
      else if (a.do === 'take' && r && r.ok) world.carry(r.item);
      else if (a.do === 'load' && r && r.ok) { world.carry(null); (r.ejected || []).forEach((x) => { const p = local(); if (x.item) world.floor.add(x.item, p.x + (Math.random() - 0.5) * 1.6, p.z + 0.9); }); }
      else if (a.do === 'serve' && r && r.ok) world.carry(null);
      else if (a.do === 'drop') { const p = local(), it = S.carry; if (it && !it.dish) { world.carry(null); world.floor.add(it, p.x, p.z + 0.5); if (S.rules && S.rules.dropped) S.rules.dropped(it); emit('drop', it); } else if (it) hint('A dish is best served; you cannot drop it.'); }
      else if (r && r.ok === false && r.reason) hint(r.hint || r.reason);
      emit('tap', { a, r });
    }
    function workDone(h) {
      const r = S.rules ? S.rules.do({ do: h.kind, item: S.carry, pot: h.pot, stove: h.stove, station: h.station }) : { ok: false };
      if (r && r.ok) {
        if (h.kind === 'chop' || h.kind === 'sieve') world.carry(Object.assign({}, S.carry, r.item || {}));
        else if (h.kind === 'prep') world.carry(null);
      } else if (r && r.reason) hint(r.hint || r.reason);
      emit('work', { h, r });
    }
    function onKey(e) {
      if (!S.in) return false;
      if (e.code === 'Escape' && S.playing) { emit('exit'); return true; }
      if (!S.playing || TF.talking || TF.traveling) return false;
      if (e.code === 'KeyE') {
        if (e.repeat) return true;
        const near = nearNow(), f = facts(), hw = holdWork(near, f);
        if (hw) { S.hold = Object.assign({ t: 0, station: near.ref.id, done: false }, hw); S.eDown = true; return true; }
        const a = tapAction(near, f);
        if (!near && !a) return false;   // nothing here: the lobby's own E (the ticket rail's prompt) may still want it
        if (a && a.do === 'cycle') { emit('cycle', 1); return true; }
        if (a) { exec(a); return true; }
        return !!near;
      }
      if (e.code === 'Tab') { emit('cycle', e.shiftKey ? -1 : 1); return true; }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        const dial = ['line', 'short', 'full'][+e.code.slice(-1) - 1], p = local(); let best = null;
        for (const s of STATIONS) if (s.type === 'stove' || s.type === 'pot') { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d <= 2.6 && (!best || d < best.d)) best = { s, d }; }
        if (best) { if (S.rules) S.rules.do({ do: 'dial', stove: best.s.index, dial }); emit('dial', { stove: best.s.index, dial }); return true; }
      }
      return false;
    }
    function onKeyUp(e) { if (e.code === 'KeyE') { S.eDown = false; if (S.hold && !S.hold.done) { S.hold = null; world.ring(null); } else S.hold = null; } }
    world.keys = { onKey, onKeyUp };
    world.input = { nearNow, facts, exec };

    // ---- the per-frame tick ----
    world.tick = (t, dt) => {
      if (!S.built) return;
      if (S.railSparkles) S.railSparkles.visible = S.in && !S.busy;
      if (!S.in) return;
      // real seconds, not the lobby's clamped frame time: a 1.2 s hold takes 1.2 s whatever the frame rate (a hidden tab pauses the frames; the jump after it is capped)
      const nowMs = performance.now(), sec = Math.min(0.5, (nowMs - (S.lastMs || nowMs)) / 1000); S.lastMs = nowMs;
      if (S.camOn && TF.camera.aspect && Math.abs(TF.camera.aspect - S.aspect) > 0.01) applyCamera(0);
      // lanterns sway, customers shift their weight, steam rises, sparks fall
      for (const l of S.lanterns) { l.g.rotation.z = Math.sin(t * 1.3 + l.ph) * 0.07; l.g.rotation.x = Math.sin(t * 0.9 + l.ph * 2) * 0.04; }
      for (const c of S.customers) c.g.position.y = Math.abs(Math.sin(t * 0.7 + c.ph)) * 0.025;
      for (const set of S.steam) for (const p of set.puffs) {
        if (set.on || p.m.visible) { p.t += sec * 0.7; if (p.t > 1) { p.t = 0; p.m.visible = set.on; } }
        if (p.m.visible) { p.m.position.set(S.A.cx + set.x + Math.sin(p.t * 5 + set.x) * 0.15, 1.8 + p.t * 1.1, S.A.cz + set.z + 0.1); p.m.material.opacity = 0.7 * Math.sin(p.t * Math.PI); p.m.quaternion.copy(TF.camera.quaternion); p.m.scale.setScalar(0.6 + p.t * 0.9); }
        else if (set.on) p.m.visible = true;
      }
      for (const p of S.sparks) if (p.on) { p.t += sec; p.v.y -= 6 * sec; p.m.position.addScaledVector(p.v, sec); p.m.material.opacity = Math.max(0, 1 - p.t / 0.9); if (p.t > 0.9) { p.on = false; p.m.visible = false; } }
      if (S.siren > 0) { S.siren -= sec; const k = 0.5 + 0.5 * Math.sin(t * 14); S.lights.forEach((l, i) => { l.color.setRGB(1, 0.55 - 0.35 * k * (i % 2), 0.5 - 0.3 * k); }); if (S.siren <= 0) S.lights.forEach((l) => l.color.setHex(warm())); }
      for (const f of S.flips) {   // a pantry label tips away, takes its new words at the half, and tips back
        f.t += sec; const k = Math.max(0, f.t) / 0.4, m = S.crates[f.i].label;
        if (k <= 0) continue;
        if (k >= 0.5 && !f.swapped) { f.swapped = true; drawCrate(f.i, f.chunk); m.visible = true; }
        m.rotation.x = -0.35 - Math.sin(Math.min(1, k) * Math.PI) * 1.2; if (k >= 1) { f.done = true; m.rotation.x = -0.35; }
      }
      S.flips = S.flips.filter((f) => !f.done);
      // the hero's carried chunk bobs a little; the stock jars show what is prepped
      if (S.carry) S.heroMesh.group.position.y = 2.15 + Math.sin(t * 4) * 0.04;
      S.shelfJars.forEach((j, i) => { j.visible = !!(S.rules && S.rules.stockCount && S.rules.stockCount() > i); });
      for (const f of S.floorItems) f.mesh.group.rotation.y = 0.3;
      // the hold ring and the prompt
      const near = nearNow(), f = S.playing ? facts() : null, nid = near ? (near.kind === 'station' ? near.ref.id : 'floor') : null;
      if (nid !== S.lastNear) { S.lastNear = nid; S.hintT = 0; }   // a nudge belongs to the place it was given
      if (S.hold && !S.hold.done) {
        const stillNear = near && near.kind === 'station' && near.ref.id === S.hold.station, valid = stillNear && holdWork(near, f) && holdWork(near, f).kind === S.hold.kind;
        const st = holdStep(S.hold, sec, valid);
        if (st.cancelled) { S.hold = null; world.ring(null); } else { S.hold.t = st.t; world.ring(st.progress > 0 ? st.progress : null); if (st.done) { S.hold.done = true; world.ring(null); workDone(S.hold); } }
      }
      if (S.playing && !(S.hold && !S.hold.done)) {
        let text = null;
        if (S.hintT > 0) { S.hintT -= sec; text = S.hint; }
        else if (near) { const hw = holdWork(near, f), a = tapAction(near, f); text = hw ? `<kbd>hold E</kbd>${hw.kind[0].toUpperCase() + hw.kind.slice(1)} · ${LABEL[near.ref.type] || 'Dropped chunk'}` : a && a.do ? `<kbd>E</kbd>${a.do === 'grab' ? 'Grab' : a.do === 'load' ? 'Put in the pot' : a.do === 'take' ? 'Take the dish' : a.do === 'serve' ? 'Serve' : a.do === 'stock' ? 'Take the stock' : a.do === 'cycle' ? 'Next ticket' : a.do === 'pickup' ? 'Pick up' : 'Drop'} · ${LABEL[near.ref.type] || 'Dropped chunk'}` : a && a.hint ? a.hint : null; }
        else if (S.carry && !S.carry.dish) text = '<kbd>E</kbd>Drop it here';
        world.prompt(text);
      } else if (S.hold) world.prompt(null);
    };

    // ---- the DOM bits: the prompt, in the lobby's panel look ----
    function makeUi() {
      const root = document.createElement('div'); root.style.cssText = 'position:fixed;left:0;right:0;bottom:0;pointer-events:none;display:none;z-index:6;';
      const prompt = document.createElement('div'); prompt.className = 'panel kt-prompt'; prompt.style.cssText = 'position:absolute;left:50%;bottom:92px;transform:translateX(-50%);font-size:14px;padding:4px 10px;white-space:nowrap;display:none;';
      const style = document.createElement('style'); style.textContent = '.kt-prompt kbd{font:inherit;color:#1a140c;background:var(--gold);padding:0 6px;margin-right:6px;}';
      root.appendChild(style); root.appendChild(prompt); document.body.appendChild(root); S.ui = { root, prompt };
    }
    world.build = () => {
      const a = TF.registerZone('kitchen', { cx: ZONE.cx, cz: ZONE.cz, name: 'Token Brew Kitchen', sub: 'Staff only', color: STYLE[0].hex, ret: DOOR.ret.slice(), retDir: 'down', spawn: [L0.start.x, L0.start.z], env: { sun: 0.5, hemi: 0.6, near: 40, far: 130 } });
      S.A = a; S.tok = tokens(); makeUi(); build(); buildLive(); S.built = true;
    };
    return world;
  }

  function install(TF) {
    const world = create(TF); TF.kitchen = world;
    TF.life.push((t, dt) => world.tick(t, dt));
    TF.on('boot', () => {
      world.build();
      const prev = TF.onKey; TF.onKey = (e) => (world.keys.onKey(e)) || (prev ? prev(e) : false);
      addEventListener('keyup', world.keys.onKeyUp);
      TF.on('enter', (a, b) => world.onZone(a, b));
      const rail = TF.AREAS.kitchen;
      TF.INTER.push({ x: rail.cx + L0.rail.x, z: rail.cz + L0.rail.z, r: 1.6, label: 'Ticket Rail', verb: 'Start shift', act: () => world.open() });
    });
    if (typeof window !== 'undefined') window.kitchenWorld = world;
    return world;
  }
  return { ZONE, ROOM, WALK, BOXES, OCCLUDERS, STATIONS, CAMERA, DOOR, CAFE, POOL, TAP, LABEL, fitView, project, visible, framePoints, walkable, makePather, nearest, holdWork, tapAction, holdStep, gaugeSegments, create, install };
});
