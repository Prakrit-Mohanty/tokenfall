// Glitch encounters out in the world, TOKEN-1's parts and the Glitch Log. A colleague stands at each spot (an office door, a travel point, a
// path). Walk close and you stop, a "!" pops over them, they walk up, say what is wrong in their office and where TOKEN-1's part is, then
// battle in the Arena (their glitchy AI tool against TOKEN-1) and walk back. A beaten glitch goes in the Glitch Log (G). Finishing a
// minigame wins back its part. A spot stays until won.
// Uses makeChar / stepChar (characters.js), TF.talk and the meter (answers are fired as 'game' events). Browser: window.Encounter.
(function () {
  const STORE = { cleared: 'tf.encounter.cleared', modules: 'tf.token1.modules' };
  const RING = 2.8;
  const POST_R = [4.5, 5.5, 3.6];
  const STAND = 1.3;
  const NOTICE_MS = 900;
  const WALK_MAX_MS = 5000;
  const ARRIVE_MS = 1500;
  const HEAD = 2.2;
  const SPEED = 2.6;
  const FREE_MS = 600;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (err) { console.warn('Encounter could not save', k, err); } };
  const dirTo = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up'));
  const still = { up: false, down: false, left: false, right: false };

  const install = (TF) => {
    const E = window.EncounterScript, M = window.Token1Meter, ui = window.EncounterUI.create(), v3 = new TF.THREE.Vector3();
    const bank = E.questionBank(window.CARROM_CONTENT, window.BRIDGE_CONTENT);
    let cleared = E.loadCleared(read(STORE.cleared)), modules = E.loadModules(read(STORE.modules)), used = [];
    let posts = [], busy = null, arriveAt = null;

    const joined = () => !!(TF.token1 && TF.token1.joined());
    const accuracy = () => (TF.token1 ? TF.token1.accuracy() : M.METER.start);
    const gameOpen = () => /-on\b/.test((document.getElementById('ui') || {}).className || '');
    const free = () => !TF.locked && !TF.talking && !TF.traveling && !TF.cameraHeld && !ui.active() && !gameOpen();
    const screenAt = (x, y, z) => {
      const p = v3.set(x, y, z).project(TF.camera), r = TF.renderer.domElement.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, ok: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
    };

    // once the colleague is walking back, the player is free again
    const encounterHolds = () => !!busy && busy.phase !== 'back';
    const clear = (id) => { if (!cleared.includes(id)) { cleared = [...cleared, id]; write(STORE.cleared, JSON.stringify(cleared)); } };

    // ---- TOKEN-1's parts: finishing a minigame wins one back; the card waits until the game has closed ----
    let partDue = null, freeSince = 0;
    TF.on('game', (e) => {
      const part = e.phase === 'end' && e.completed && joined() ? E.partFor(e.game) : null;
      if (!part || modules.includes(part.id)) return;
      modules = E.recover(modules, part.id); write(STORE.modules, JSON.stringify(modules)); partDue = part; freeSince = 0;
    });
    const showPart = () => {
      if (!partDue || !free()) { freeSince = 0; return; }
      const now = performance.now();
      if (!freeSince) { freeSince = now; return; }
      if (now - freeSince < FREE_MS) return;
      const part = partDue; partDue = null; TF.lockPlayer(true);
      ui.cardAlone({ kicker: `PART RECOVERED · ${modules.length} / ${E.MODULE_ORDER.length}`, icon: part.icon, title: part.name, lines: [part.gain, part.lesson], slots: E.MODULE_ORDER.map((id) => modules.includes(id)) }, () => TF.lockPlayer(false));
    };

    // ---- the Glitch Log on G ----
    const openLog = () => { TF.lockPlayer(true); ui.book(E.logEntries(cleared), () => TF.lockPlayer(false)); };

    // ---- placing the colleagues ----
    const clearLine = (x0, z0, x1, z1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .3);
      for (let i = 1; i < n; i++) if (TF.blocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, .4)) return false;
      return true;
    };
    const findPost = (cx, cz) => {
      for (const r of POST_R) for (let a = 0; a < 16; a++) {
        const x = cx + Math.cos(a * Math.PI / 8) * r, z = cz + Math.sin(a * Math.PI / 8) * r;
        if (!TF.blocked(x, z, .6) && clearLine(x, z, cx, cz)) return { x, z };
      }
      return null;
    };
    const centreOf = (spot) => {
      const at = spot.at;
      if (at.portal) { const p = TF.PORTALS.find((q) => q.zone === at.portal.zone && q.to === at.portal.to); return p && { zone: p.zone, x: p.x, z: p.z, r: RING }; }
      if (at.arrive) { const a = TF.AREAS[at.arrive.to], sp = a && (a.spawn || [0, 4.6]); return a && { zone: at.arrive.to, x: a.cx + sp[0], z: a.cz + sp[1], r: 0 }; }
      return { zone: at.zone, x: at.x, z: at.z, r: at.r };
    };
    const place = (spot) => {
      const c = centreOf(spot);
      if (!c) { console.warn(`Encounter: no place for ${spot.id}`); return null; }

      const post = spot.kind === 'wander' ? (TF.blocked(c.x, c.z, .6) ? findPost(c.x, c.z) : { x: c.x, z: c.z }) : findPost(c.x, c.z);
      if (!post) { console.warn(`Encounter: no free ground near ${spot.id}`); return null; }

      const ch = makeChar(spot.who, post.x, post.z, { speed: SPEED, zone: c.zone });
      ch.dir = dirTo(c.x - post.x, c.z - post.z);
      // a wandering colleague spots you around themselves; the others watch the door or arrival point
      const centre = spot.kind === 'wander' ? { zone: c.zone, x: post.x, z: post.z, r: c.r } : c;
      return { spot, ch, post, centre, armed: false };
    };

    // ---- moving them ----
    const walkTo = (ch, x, z, dtMs) => {
      const dx = x - ch.x, dz = z - ch.y;
      if (Math.hypot(dx, dz) < .3) { ch.setInput(still); return true; }
      ch.setInput({ left: dx < -.15, right: dx > .15, up: dz < -.15, down: dz > .15 });
      stepChar(ch, dtMs);
      return false;
    };
    const faceEachOther = (ch) => { const dx = TF.hero.x - ch.x, dz = TF.hero.y - ch.y; ch.dir = dirTo(dx, dz); TF.hero.dir = dirTo(-dx, -dz); };

    // ---- the battle ----
    const battle = (p, done) => {
      const g = E.GLITCHES[p.spot.glitch], turns = p.spot.kind === 'wander' ? E.BATTLE.wanderTurns : E.BATTLE.turns;
      const qs = E.pickQuestions({ bank, n: turns, used, rng: Math.random });
      used = [...used, ...qs.map((q) => q.id)];
      let b = E.newBattle(turns);

      const end = () => {
        if (!b.won) { ui.say('nar', `The <b>${g.name}</b> is still muddled. Come back and try again!`, () => ui.close(() => done(false))); return; }
        ui.calm(); clear(p.spot.id);
        const log = E.logEntries(cleared), logged = { kicker: `GLITCH LOGGED · ${log.filter((e) => e.caught).length} / ${log.length}`, icon: ui.sprite(g.sprite, 2.4), title: g.name, lines: [g.mistake, g.lesson], slots: log.map((e) => e.caught) };
        ui.say('foe', g.calm, () => ui.card(logged, () => ui.close(() => done(true))));
      };
      const turn = () => {
        const q = qs[b.turn];
        if (b.done || !q) { end(); return; }
        ui.ask(q.stem, E.options(q, Math.random), (o) => {
          const prevAcc = accuracy();
          TF.fire('game', { game: 'encounter', phase: 'answer', correct: o.correct });
          b = E.answer(b, o.correct);
          ui.hit({ correct: o.correct, acc: accuracy(), prevAcc, muddle: b.muddle });
          ui.say('nar', o.correct ? `Spot on! The <b>${g.name}</b> thins.` : `TOKEN-1 believed it… ${o.breaks}`, turn);
        });
      };
      ui.open({ glitch: g, acc: accuracy(), place: TF.AREAS[TF.zone] ? TF.AREAS[TF.zone].name : 'TokenFall' }, () => ui.say('foe', g.taunt, turn));
    };

    // ---- one encounter, start to finish: notice, walk up, talk, battle (or not), talk, walk back ----
    const start = (p) => {
      p.armed = false; TF.lockPlayer(true);
      TF.hero.dir = dirTo(p.ch.x - TF.hero.x, p.ch.y - TF.hero.y);
      busy = { p, phase: 'notice', t: 0 };
    };
    const advance = (dtMs) => {
      const s = busy, { p } = s, ch = p.ch; s.t += dtMs;
      if (s.phase === 'notice') { ui.showMark(screenAt(ch.x, HEAD, ch.y)); if (s.t < NOTICE_MS) return; ui.showMark(null); Object.assign(s, { phase: 'walk', t: 0 }); return; }
      if (s.phase === 'walk') {
        const d = Math.hypot(ch.x - TF.hero.x, ch.y - TF.hero.y) || 1, tx = TF.hero.x + (ch.x - TF.hero.x) / d * STAND, tz = TF.hero.y + (ch.y - TF.hero.y) / d * STAND;
        if (!walkTo(ch, tx, tz, dtMs) && s.t < WALK_MAX_MS) return;
        ch.setInput(still); faceEachOther(ch); TF.talk(ch.name, p.spot.hello); Object.assign(s, { phase: 'hello', t: 0 }); return;
      }
      if (s.phase === 'hello') {
        if (TF.talking) return;
        if (p.spot.kind === 'scene') { clear(p.spot.id); Object.assign(s, { phase: 'back', t: 0 }); TF.lockPlayer(false); return; }
        Object.assign(s, { phase: 'battle' });
        battle(p, (won) => { TF.talk(ch.name, won ? p.spot.win : p.spot.lose); Object.assign(s, { phase: 'bye', t: 0 }); });
        return;
      }
      if (s.phase === 'bye') { if (TF.talking) return; TF.lockPlayer(false); Object.assign(s, { phase: 'back', t: 0 }); return; }
      if (s.phase === 'back' && (walkTo(ch, p.post.x, p.post.z, dtMs) || s.t > WALK_MAX_MS)) {
        ch.x = p.post.x; ch.y = p.post.z; ch.setInput(still); ch.dir = dirTo(p.centre.x - ch.x, p.centre.z - ch.y); busy = null;
      }
    };

    const watch = () => {
      if (!joined() || !free()) return;
      const hero = TF.hero;
      for (const p of posts) {
        if (p.centre.zone !== TF.zone || cleared.includes(p.spot.id) || !p.centre.r) continue;
        const seen = E.sight({ armed: p.armed, d: Math.hypot(hero.x - p.centre.x, hero.y - p.centre.z), r: p.centre.r });
        p.armed = seen.armed;
        if (seen.trigger && E.shouldTrigger({ spot: p.spot, joined: true, cleared })) { start(p); return; }
      }
      if (arriveAt !== null && performance.now() >= arriveAt) {
        arriveAt = null;
        const p = posts.find((q) => q.spot.at.arrive && q.centre.zone === TF.zone && E.shouldTrigger({ spot: q.spot, joined: true, cleared }));
        if (p) start(p);
      }
    };

    TF.on('boot', () => { posts = E.SPOTS.map(place).filter(Boolean); });
    TF.on('enter', (prev, z) => { if (posts.some((p) => p.spot.at.arrive && p.spot.at.arrive.from === prev && p.spot.at.arrive.to === z)) arriveAt = performance.now() + ARRIVE_MS; });
    TF.life.push((t, dt) => {
      const dtMs = Math.min(100, dt * 1000);
      for (const p of posts) if (!busy || busy.p !== p) { p.ch.setInput(still); stepChar(p.ch, dtMs); }
      if (busy) advance(dtMs);
      if (!encounterHolds()) showPart();
      if (!busy) watch();
    });
    TF.on('boot', () => {
      const prev = TF.onKey;
      TF.onKey = (e) => {
        if (e.code === 'KeyG' && !e.repeat && !encounterHolds() && free()) { openLog(); return true; }
        return prev ? prev(e) : false;
      };
    });
  };

  window.Encounter = { install };
})();
