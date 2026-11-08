// House Rules Carrom — physics. Pure, deterministic, no Math.random, no DOM. Browser: window.CarromPhysics. Node: require('./carrom-physics.js').
//
//   createState({ coins: [{ id, x, y }], strikerX, striker: false })   -> state (plain JSON; bodies[0] is the striker unless striker: false, then the coins in order)
//   flick(state, index, { angle, power })              launches a coin directly (no striker): the single-coin game
//   runFlick(state, index, shot, opts?)                -> { events, finalState, sunk, pocket, steps, reason }   (pocket: the corner the coin fell into, or null)
//   travelDistance(power)                              how far a flicked coin rolls on an empty, wall-less table (the aim line's length)
//   applyShot(state, { side, strikerX, angle, power }) places the striker on a baseline (side S, W, N or E; strikerX = position along it) and launches it (mutates)
//   step(state, events?, hits?)                        one fixed step of 1/120 s, in place; false when everything is already at rest
//   runShot(state, shot, opts?)                        -> { events, finalState, first, sunk, steps, reason }   (never mutates `state`)
//   isFree(state, x, y, r, ignoreId?)                  true when a body of radius r fits there (inside the walls, off the pockets, clear of bodies)
//   freeSpot(state, x, y, r?, ignoreId?)               the nearest free spot to (x, y), searching outwards; deterministic (a coin that goes back "to its spot")
//   cloneState, stateHash, kineticEnergy, isResting, clampStrikerX, CFG, POCKETS
//
// Board: 100 x 100 units, origin top-left, +x east, +y south. The striker starts on the south baseline (y = BASE_Y = 80).
// angle is in DEGREES, 0 = straight up the board (north), positive = clockwise (towards east). power is 0..1 of VMAX.
// Pockets are circles of radius R_POCKET tucked into the four corners, tangent to both cushions (centre POCKET_INSET from each wall),
// numbered clockwise from the top-left: 0 NW, 1 NE, 2 SE, 3 SW. A body is sunk when its centre is inside a pocket circle; a sunk
// body stays in `bodies` with alive = false and pocket = its index.
// Why not a pocket centred on the corner: only a quarter of such a circle is on the board, which leaves a lone, unobstructed coin
// an aiming window about 1 degree wide (measured), too small for any human; the tucked-in pocket gives windows of 4-8 degrees.
//
// One step = a fixed 1/120 s. Friction is one multiplier per step. Movement is cut into substeps so that nothing travels more than
// MAX_STEP units between collision checks (two bodies closing at once still cover less than a coin diameter), so a full-power shot
// cannot tunnel through a coin or a wall. Collisions are impulse-based with restitution <= 1 and the only other velocity changes are
// friction and sleeping, so total kinetic energy never increases.
//
// Events (all carry t, seconds into the shot):
//   { type: 'first', coin }                       the first coin the striker touches (the player's intended answer)
//   { type: 'sink', id, pocket, striker }         a body fell in
//   { type: 'hit', a, b, v }  { type: 'wall', id, v }    only when hits = true (sound cues; v = closing speed)
//   { type: 'end', reason: 'rest' | 'timeout' }   last event of runShot
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CarromPhysics = api;
})(this, function () {
  const CFG = {
    SIZE: 100, R_COIN: 2.2, R_STRIKER: 3.2, R_POCKET: 6, POCKET_INSET: 6,
    M_COIN: 1, M_STRIKER: 3,                 // a real striker is about three coins heavy
    DT: 1 / 120, FRICTION: 0.985, E_WALL: 0.75, E_BODY: 0.9, SLEEP: 0.8,   // SLEEP: units/s below which a body stops
    VMAX: 560,                               // units/s at power 1; with this friction that is about 3 board lengths of travel
    MAX_STEP: 0.8, MAX_SUB: 24,              // largest distance per substep, and a cap on substeps
    BASE_Y: 80, X_MIN: 10, X_MAX: 90,        // the striker's baseline and the range it slides along
    MAX_STEPS: 1200,                         // 10 s: a shot that has not come to rest by then is cut off
  };
  const S = CFG.SIZE;
  const I = CFG.POCKET_INSET, POCKETS = [[I, I], [S - I, I], [S - I, S - I], [I, S - I]];
  const R2P = CFG.R_POCKET * CFG.R_POCKET, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clampStrikerX = (x) => clamp(x, CFG.X_MIN, CFG.X_MAX);

  // the striker may start on any of the four baselines (the board has one on each side): S south (y = BASE_Y), N north, W west, E east.
  // `t` is the position along the lane (X_MIN..X_MAX). Angles stay absolute: 0 = north, clockwise, whichever side it is shot from.
  const SIDES = ['S', 'W', 'N', 'E'];
  function strikerAt(side, t) {
    const l = clamp(t, CFG.X_MIN, CFG.X_MAX), near = CFG.BASE_Y, far = CFG.SIZE - CFG.BASE_Y;
    return side === 'N' ? { x: l, y: far } : side === 'W' ? { x: far, y: l } : side === 'E' ? { x: near, y: l } : { x: l, y: near };
  }
  const body = (id, x, y, r, m, k) => ({ id, k, x, y, vx: 0, vy: 0, r, m, alive: true, pocket: -1 });

  function createState(o = {}) {
    const sp = strikerAt(o.side || 'S', o.strikerX == null ? 50 : o.strikerX);
    const bodies = o.striker === false ? [] : [body('S', sp.x, sp.y, CFG.R_STRIKER, CFG.M_STRIKER, 's')];
    for (const c of o.coins || []) bodies.push(body(c.id, c.x, c.y, CFG.R_COIN, CFG.M_COIN, 'c'));
    return { steps: 0, first: null, bodies };
  }
  const cloneState = (s) => ({ steps: s.steps, first: s.first, bodies: s.bodies.map((b) => Object.assign({}, b)) });

  function applyShot(state, shot) {
    const st = state.bodies[0], a = shot.angle * DEG, v = clamp(shot.power, 0, 1) * CFG.VMAX;
    if (shot.strikerX != null || shot.side) { const sp = strikerAt(shot.side || 'S', shot.strikerX == null ? 50 : shot.strikerX); st.x = sp.x; st.y = sp.y; }
    st.vx = Math.sin(a) * v; st.vy = -Math.cos(a) * v; st.alive = true; st.pocket = -1;
    return state;
  }

  // the single-coin game: the coin itself is launched (angle in degrees, 0 = north, clockwise; power 0..1 of VMAX)
  function flick(state, index, shot) {
    const b = state.bodies[index], a = shot.angle * DEG, v = clamp(shot.power, 0, 1) * CFG.VMAX;
    b.vx = Math.sin(a) * v; b.vy = -Math.cos(a) * v; b.alive = true; b.pocket = -1;
    return state;
  }
  function travelDistance(power) {   // the same friction and sleep rule as step(), on a table without cushions
    let v = clamp(power, 0, 1) * CFG.VMAX, d = 0;
    while (v >= CFG.SLEEP) { d += v * CFG.DT; v *= CFG.FRICTION; if (v < CFG.SLEEP) break; }
    return d;
  }
  const isResting = (state) => state.bodies.every((b) => !b.alive || (b.vx === 0 && b.vy === 0));
  const kineticEnergy = (state) => state.bodies.reduce((e, b) => (b.alive ? e + 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) : e), 0);

  // an exact, order-sensitive hash of positions, velocities and alive flags (FNV-1a over the raw float bits)
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  function stateHash(state) {
    let h = 0x811c9dc5;
    const mix = (x) => { f64[0] = x; for (let i = 0; i < 2; i++) { h ^= u32[i]; h = Math.imul(h, 0x01000193); } };
    for (const b of state.bodies) { mix(b.x); mix(b.y); mix(b.vx); mix(b.vy); mix(b.alive ? 1 : 0); }
    return h >>> 0;
  }

  // one fixed step; returns whether anything was moving at the start (false = the table is at rest and nothing changed)
  function step(state, events, hits) {
    const B = state.bodies, n = B.length, DT = CFG.DT;
    let vmax = 0;
    for (let i = 0; i < n; i++) { const b = B[i]; if (b.alive) { const s = Math.hypot(b.vx, b.vy); if (s > vmax) vmax = s; } }
    if (vmax === 0) return false;
    const sub = Math.min(CFG.MAX_SUB, Math.max(1, Math.ceil((vmax * DT) / CFG.MAX_STEP))), h = DT / sub, t = state.steps * DT;
    for (let k = 0; k < sub; k++) {
      for (let i = 0; i < n; i++) { const b = B[i]; if (b.alive) { b.x += b.vx * h; b.y += b.vy * h; } }
      // the intended coin: if the striker overlaps several coins in this substep, the one it reached FIRST wins. That is the earliest time of impact within the
      // substep (the striker's move backed up and intersected with each coin), not the deepest overlap: a graze sinks in more slowly than a head-on hit
      if (state.first === null && B.length && B[0].k === 's' && B[0].alive) {
        const a = B[0], px = a.x - a.vx * h, py = a.y - a.vy * h, A2 = a.vx * a.vx + a.vy * a.vy; let best = null, bs = Infinity, depth = 0, deep = null;
        for (let j = 1; j < n; j++) {
          const c = B[j]; if (!c.alive) continue;
          const rr = a.r + c.r, d2 = (c.x - a.x) ** 2 + (c.y - a.y) ** 2;
          if (d2 >= rr * rr) continue;
          const dp = rr - Math.sqrt(d2); if (dp > depth) { depth = dp; deep = c; }   // fallback if the move cannot be backed up (a bounce in this substep)
          const f = px - c.x, g = py - c.y, C = f * f + g * g - rr * rr, Bq = 2 * (f * a.vx + g * a.vy), disc = Bq * Bq - 4 * A2 * C;
          if (C <= 0) { if (0 < bs) { bs = 0; best = c; } } else if (A2 > 0 && disc >= 0) { const s = (-Bq - Math.sqrt(disc)) / (2 * A2); if (s >= -1e-9 && s < bs) { bs = s; best = c; } }
        }
        const pick = best || deep;
        if (pick) { state.first = pick.id; if (events) events.push({ type: 'first', coin: pick.id, t }); }
      }
      // body against body
      for (let i = 0; i < n; i++) {
        const a = B[i]; if (!a.alive) continue;
        for (let j = i + 1; j < n; j++) {
          const c = B[j]; if (!c.alive) continue;
          let dx = c.x - a.x, dy = c.y - a.y; const rr = a.r + c.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const vrx = c.vx - a.vx, vry = c.vy - a.vy, vv = vrx * vrx + vry * vry, dot = dx * vrx + dy * vry, ia = 1 / a.m, ic = 1 / c.m;
          if (dot < 0 && vv > 1e-9) {
            // continuous collision: back the pair up to the instant they touched (the earliest time within this substep), take the normal there, apply the
            // impulse there, and move on from that instant with the new velocities. The line of centres is then the true one, however deep the substep went.
            const tau = Math.min(h, Math.max(0, (dot + Math.sqrt(dot * dot - vv * (d2 - rr * rr))) / vv)), ax = a.x - a.vx * tau, ay = a.y - a.vy * tau, cx = c.x - c.vx * tau, cy = c.y - c.vy * tau;
            const nx = (cx - ax) / rr, ny = (cy - ay) / rr, vn = vrx * nx + vry * ny;
            if (vn < 0) {
              const J = (-(1 + CFG.E_BODY) * vn) / (ia + ic);
              a.vx -= J * ia * nx; a.vy -= J * ia * ny; c.vx += J * ic * nx; c.vy += J * ic * ny;
              if (hits && events) events.push({ type: 'hit', a: a.id, b: c.id, v: -vn, t });
            }
            a.x = ax + a.vx * tau; a.y = ay + a.vy * tau; c.x = cx + c.vx * tau; c.y = cy + c.vy * tau;
            continue;
          }
          let d = Math.sqrt(d2); if (d === 0) { dx = 1; dy = 0; d = 1; } else { dx /= d; dy /= d; }   // exactly stacked: push apart along +x
          const over = rr - (d2 === 0 ? 0 : d), sh = over / (ia + ic);
          a.x -= dx * sh * ia; a.y -= dy * sh * ia; c.x += dx * sh * ic; c.y += dy * sh * ic;
          const vn = (c.vx - a.vx) * dx + (c.vy - a.vy) * dy;   // < 0: closing
          if (vn < 0) {
            const J = (-(1 + CFG.E_BODY) * vn) / (ia + ic);
            a.vx -= J * ia * dx; a.vy -= J * ia * dy; c.vx += J * ic * dx; c.vy += J * ic * dy;
            if (hits && events) events.push({ type: 'hit', a: a.id, b: c.id, v: -vn, t });
          }
        }
      }
      // pockets: checked before the walls so a body sliding into a corner falls in instead of bouncing off
      for (let i = 0; i < n; i++) {
        const b = B[i]; if (!b.alive) continue;
        for (let p = 0; p < 4; p++) {
          const px = b.x - POCKETS[p][0], py = b.y - POCKETS[p][1];
          if (px * px + py * py < R2P) { b.alive = false; b.pocket = p; b.vx = b.vy = 0; if (events) events.push({ type: 'sink', id: b.id, pocket: p, striker: b.k === 's', t }); break; }
        }
      }
      // walls: the part of the move that went through the wall is reflected (and shortened by the restitution), so a bounce is exact at any substep size
      for (let i = 0; i < n; i++) {
        const b = B[i]; if (!b.alive) continue;
        const lo = b.r, hi = S - b.r, E = CFG.E_WALL;
        if (b.x < lo) { if (b.vx < 0) { if (hits && events) events.push({ type: 'wall', id: b.id, v: -b.vx, t }); b.x = lo + (lo - b.x) * E; b.vx = -b.vx * E; } else b.x = lo; }
        else if (b.x > hi) { if (b.vx > 0) { if (hits && events) events.push({ type: 'wall', id: b.id, v: b.vx, t }); b.x = hi - (b.x - hi) * E; b.vx = -b.vx * E; } else b.x = hi; }
        if (b.y < lo) { if (b.vy < 0) { if (hits && events) events.push({ type: 'wall', id: b.id, v: -b.vy, t }); b.y = lo + (lo - b.y) * E; b.vy = -b.vy * E; } else b.y = lo; }
        else if (b.y > hi) { if (b.vy > 0) { if (hits && events) events.push({ type: 'wall', id: b.id, v: b.vy, t }); b.y = hi - (b.y - hi) * E; b.vy = -b.vy * E; } else b.y = hi; }
      }
    }
    // friction, then sleep
    const sl2 = CFG.SLEEP * CFG.SLEEP;
    for (let i = 0; i < n; i++) {
      const b = B[i]; if (!b.alive) continue;
      b.vx *= CFG.FRICTION; b.vy *= CFG.FRICTION;
      if (b.vx * b.vx + b.vy * b.vy < sl2) b.vx = b.vy = 0;
    }
    state.steps++;
    return true;
  }

  const GAP = 0.05;   // breathing room so a returned coin is not born touching its neighbour
  function isFree(state, x, y, r, ignoreId) {
    if (x < r || x > S - r || y < r || y > S - r) return false;
    for (const p of POCKETS) if ((x - p[0]) ** 2 + (y - p[1]) ** 2 < (CFG.R_POCKET + r) ** 2) return false;
    for (const b of state.bodies) {
      if (!b.alive || b.id === ignoreId) continue;
      if ((x - b.x) ** 2 + (y - b.y) ** 2 < (r + b.r + GAP) ** 2) return false;
    }
    return true;
  }
  function freeSpot(state, x, y, r = CFG.R_COIN, ignoreId) {
    if (isFree(state, x, y, r, ignoreId)) return { x, y };
    for (let ring = 1; ring <= 120; ring++) {   // rings 0.5 units apart, up to 60 units out; first free spot in angle order
      const rad = ring * 0.5, n = Math.max(8, Math.ceil((2 * Math.PI * rad) / 0.5));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n, cx = x + Math.cos(a) * rad, cy = y + Math.sin(a) * rad;
        if (isFree(state, cx, cy, r, ignoreId)) return { x: cx, y: cy };
      }
    }
    return { x, y };
  }

  // opts: { hits: false (record 'hit'/'wall' events for sound), maxSteps }
  function runShot(state, shot, opts = {}) {
    const s = cloneState(state), events = [], max = opts.maxSteps || CFG.MAX_STEPS;
    s.steps = 0; s.first = null; applyShot(s, shot);
    let reason = 'timeout';
    for (let i = 0; i < max; i++) if (!step(s, events, opts.hits)) { reason = 'rest'; break; }
    events.push({ type: 'end', reason, t: s.steps * CFG.DT });
    return { events, finalState: s, first: s.first, sunk: events.filter((e) => e.type === 'sink'), steps: s.steps, reason };
  }

  function runFlick(state, index, shot, opts = {}) {
    const s = cloneState(state), events = [], max = opts.maxSteps || CFG.MAX_STEPS;
    s.steps = 0; s.first = null; flick(s, index, shot);
    let reason = 'timeout';
    for (let i = 0; i < max; i++) if (!step(s, events, opts.hits)) { reason = 'rest'; break; }
    const sunk = events.filter((e) => e.type === 'sink'), mine = sunk.find((e) => e.id === s.bodies[index].id);
    events.push({ type: 'end', reason, t: s.steps * CFG.DT });
    return { events, finalState: s, sunk, pocket: mine ? mine.pocket : null, steps: s.steps, reason };
  }

  return { CFG, POCKETS, SIDES, strikerAt, createState, cloneState, applyShot, flick, runFlick, travelDistance, step, runShot, stateHash, kineticEnergy, isResting, clampStrikerX, isFree, freeSpot };
});
