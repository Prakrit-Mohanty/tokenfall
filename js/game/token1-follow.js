// TOKEN-1's follow steering: walk to a slot behind the hero, slide along walls, snap over when far away or stuck.
// Pure: step() returns a new bot and asks isBlocked(x, z) about the world. Browser: window.Token1Follow. Node: require().
(function () {
  const FOLLOW = { gap: 1.4, side: .9, speed: 4.2, catchUp: 7.5, catchUpDist: 3, gain: 3, arrive: .15, startWalk: .9, stopWalk: .35, heroWalk: .5, teleport: 10, stuckSnap: 1.2, turn: 8, small: .55, growAfter: .6 };

  const FACING = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] };

  const slotFor = (hero, angle) => {
    const [fx, fz] = typeof angle === 'number' ? [Math.sin(angle), Math.cos(angle)] : FACING[hero.dir] || FACING.down;
    return { x: hero.x - fx * FOLLOW.gap - fz * FOLLOW.side, z: hero.y - fz * FOLLOW.gap + fx * FOLLOW.side };
  };

  const turnToward = (heading, want, dt) => heading + Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * FOLLOW.turn);

  const facingToward = (angle, { vx, vz }, dt) => (Math.hypot(vx, vz) < FOLLOW.heroWalk ? angle : turnToward(angle, Math.atan2(vx, vz), dt));

  const snap = (b, target, home, isBlocked) => {
    const to = isBlocked(target.x, target.z) ? { x: home.x, z: home.z } : target;
    return Object.assign({}, b, { x: to.x, z: to.z, stuck: 0, moving: false });
  };

  const step = ({ bot, target, home, dt, isBlocked }) => {
    const dx = target.x - bot.x, dz = target.z - bot.z, d = Math.hypot(dx, dz);

    if (d > FOLLOW.teleport) return snap(bot, target, home, isBlocked);
    if (d < FOLLOW.arrive) return bot.moving || bot.stuck ? Object.assign({}, bot, { moving: false, stuck: 0 }) : bot;

    // eases in (speed proportional to distance) so a walking hero is trailed at a steady gap, not chased stop-go
    const len = Math.min(d, Math.min(d * FOLLOW.gain, d > FOLLOW.catchUpDist ? FOLLOW.catchUp : FOLLOW.speed) * dt);
    const mx = dx / d * len, mz = dz / d * len;
    const tries = [[mx, mz], [mx, 0], [0, mz]];
    const ok = tries.find(([ax, az]) => (ax || az) && !isBlocked(bot.x + ax, bot.z + az));

    if (!ok) {
      const stuck = bot.stuck + dt;
      return stuck >= FOLLOW.stuckSnap ? snap(bot, target, home, isBlocked) : Object.assign({}, bot, { stuck, moving: false });
    }

    const [ax, az] = ok, pace = Math.hypot(ax, az) / dt;
    const moving = bot.moving ? pace > FOLLOW.stopWalk : pace > FOLLOW.startWalk;
    return { x: bot.x + ax, z: bot.z + az, heading: moving ? turnToward(bot.heading, Math.atan2(ax, az), dt) : bot.heading, stuck: 0, moving };
  };

  const sizeFor = (stillSeconds) => (stillSeconds >= FOLLOW.growAfter ? 1 : FOLLOW.small);

  // the "E Talk · TOKEN-1" prompt: a companion that follows is always in reach, so once it has joined you the prompt shows only when you have stood still next to it
  // (the same stillness that makes it full size) and nothing else is in reach to take the prompt (a station, a sign, a totem). Before it joins, it waits at its spot and always shows.
  const promptOn = ({ joined, still, crowded }) => !joined || (still >= FOLLOW.growAfter && !crowded);

  const api = { FOLLOW, slotFor, facingToward, step, sizeFor, promptOn };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.Token1Follow = api;
})();
