// TOKEN-1, the broken lobby robot. It waits at its spot by the spawn under a beam until the player accepts the mission
// (on first load the camera turns to it and it asks); then it follows, small while you walk and full size when you stop.
// Every minigame answer moves its accuracy (right +, wrong -), the player's final score, saved in the browser.
// Uses Token1Meter, Token1Follow, Token1Lines, Token1UI, the 'game' events (game-events.js) and its body (village-ai.js).
(function () {
  const STORE = { meter: 'tf.token1.meter', joined: 'tf.token1.joined', away: 'tf.token1.away' };
  const HEAD = 2.25;
  const INTRO_DELAY = 1600;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (err) { console.warn('TOKEN-1 could not save', k, err); } };
  const tag = (stage) => (stage < 4 ? '<span class="t1-tag">unverified</span>' : '');

  const makeBeam = (TF, x, z) => {
    const { THREE } = TF, g = new THREE.Group(); g.userData.dyn = true; g.position.set(x, 0, z);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1, 5, 24, 1, true), mat); beam.position.y = 2.5; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.85, 1.1, 32), mat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = .04; ring.material.opacity = .5; g.add(ring);
    TF.scene.add(g);
    return { g, pulse: (t) => { ring.scale.setScalar(1 + Math.sin(t * 3) * .08); beam.material.opacity = .12 + Math.sin(t * 2) * .05; } };
  };

  const install = (TF) => {
    const M = window.Token1Meter, F = window.Token1Follow, L = window.Token1Lines, ui = window.Token1UI.create(), v3 = new TF.THREE.Vector3();
    const forceIntro = new URLSearchParams(location.search).has('intro');
    let meter = M.load(read(STORE.meter)), joined = read(STORE.joined) === '1' && !forceIntro, away = read(STORE.away) === '1';
    let introAt = null;
    let inGame = false, run = null, parts = null, bot = null, home = null, beam = null, ready = false;
    let shown = 1, size = 1, still = 0, lastHero = null, heroFacing = null, intro = null, introDone = false;
    const slot = () => F.slotFor(TF.hero, heroFacing);
    const inter = { x: 0, z: 0, r: 0, label: 'TOKEN-1', verb: 'Talk', act: () => (joined ? guide() : startIntro()) };
    const stage = () => M.stage(meter);
    const stageLine = () => `${M.STAGES[stage()].line} ${tag(stage())}`;

    const screenAt = (x, y, z) => {
      const p = v3.set(x, y, z).project(TF.camera), r = TF.renderer.domElement.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, ok: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
    };
    const headPoint = () => (bot ? screenAt(bot.x, HEAD * size * shown, bot.z) : ui.iconPoint());
    const present = () => !(joined && away) && !inGame && !(joined && TF.locked) && !TF.traveling;
    const refreshHud = () => { ui.showHud(joined); ui.setHud({ accuracy: meter.accuracy, stage: stage(), stageName: M.STAGES[stage()].name, away }); };
    const speak = (html, ms) => { if (present()) ui.say(html, ms); };

    // ---- first meeting: camera on TOKEN-1, its lines, then the mission card ----
    const canIntro = () => !joined && !intro && !TF.talking && !TF.traveling && !TF.locked && !ui.cardOpen() && TF.zone === 'lobby';
    const startIntro = () => {
      if (!canIntro()) return;
      intro = 'pan'; introDone = true; ui.hideSay(); TF.lockPlayer(true);
      const { THREE } = TF;
      TF.cameraTo(new THREE.Vector3(home.x + 1.4, 2.5, home.z + 5), new THREE.Vector3(home.x, 1.25, home.z), 900);
      setTimeout(() => { intro = 'talk'; TF.talk('TOKEN-1', L.INTRO); }, 950);
    };
    const endIntro = () => { intro = null; TF.cameraRestore(700); TF.lockPlayer(false); };
    const missionCard = () => {
      intro = 'card';
      const m = L.MISSION, games = L.missionParts(window.EncounterScript.PARTS).map((x) => `<div>${x}</div>`).join('');
      ui.showCard(m.title, `<div class="t1-meet"><div class="t1-ring s${stage()}" style="--t1-p:${meter.accuracy}"><div id="t1-meet-face"></div></div>
          <p>TOKEN-1 is the AI helper for every Calfus office. An update told to <i>make him faster</i> pulled out his five parts, and now he is at <b class="t1-bad">${meter.accuracy}% accuracy</b>: sure of everything, right about almost nothing. Take him office to office and win each part back from a game.</p></div>
        <div class="t1-steps">${m.rules(M.METER).map(([ic, a, b], i) => `<div class="t1-step"><span class="t1-ic">${ic}</span>${a}<br><b class="${['t1-gold', 't1-good', 't1-gold'][i]}">${b}</b></div>`).join('')}</div>
        <div class="t1-games">${games}</div>`, null,
      [{ label: m.later, key: 'Escape', act: decline }, { label: m.accept, key: 'Enter', primary: true, act: accept }], 'NEW MISSION');
      const slot = document.getElementById('t1-meet-face'); if (slot) slot.appendChild(ui.face(56, stage()));
    };
    const accept = () => {
      joined = true; away = false; write(STORE.joined, '1'); write(STORE.away, '0');
      endIntro(); ui.mark(false); beam.g.visible = false; refreshHud(); ui.bump();
      TF.banner('Mission accepted', 'Fix TOKEN-1');
      setTimeout(() => speak('Yay! First stop: the Crescent Bay door, through the Pune gate. I will follow you. <span class="t1-tag">probably</span>', 5000), 900);
    };
    const decline = () => { endIntro(); setTimeout(() => speak('Okay! I will wait right here. Press <b>E</b> when you are ready.', 4500), 700); };

    // ---- after joining: help, sending away, the minigames ----
    const guide = () => {
      if (ui.cardOpen()) return;
      const f = M.finalScore(meter), sg = stage(), where = Object.values(L.GAMES).map((g) => `<div><b>${g.name}</b> <span>· ${g.where}</span></div>`).join('');
      ui.showCard('Ask TOKEN-1', `<div class="t1-games">${where}</div>
        <div class="t1-steps"><div class="t1-step">Accuracy<br><b class="t1-gold">${f.accuracy}%</b></div><div class="t1-step">Right / wrong<br><b><span class="t1-good">${f.correct}</span> / <span class="t1-bad">${f.wrong}</span></b></div><div class="t1-step">Repair level<br><b>${M.STAGES[sg].name}</b></div></div>
        <p><i>TOKEN-1 adds:</i> "${M.STAGES[sg].line}" ${tag(sg)}</p>`);
    };

    const toggleAway = () => {
      if (ui.cardOpen() || !joined) return;
      const head = headPoint(), icon = ui.iconPoint();
      ui.hideSay();
      if (!away) {
        away = true; write(STORE.away, '1'); refreshHud();
        ui.fly(head, { x: head.x + 80, y: -60 }, stage(), () => ui.bump());
        return;
      }
      const s = slot(); bot = Object.assign({}, bot, { x: s.x, z: s.z });
      ui.fly(icon, headPoint(), stage(), () => { away = false; write(STORE.away, '0'); refreshHud(); speak(stageLine()); });
    };

    const onAnswer = (correct) => {
      const before = stage();
      meter = M.applyAnswer(meter, correct); write(STORE.meter, M.save(meter)); refreshHud();
      ui.float(correct ? `+${M.METER.up}%` : `−${M.METER.down}%`, correct, ui.iconPoint());
      if (!run) return;

      const k = correct ? 'right' : 'wrong';
      run = Object.assign({}, run, { [k]: run[k] + 1 }, stage() > before ? { stageUp: stage() } : {});
    };

    const onStart = (game) => {
      inGame = true; ui.hideSay();
      if (!joined) return;

      run = { game, before: meter.accuracy, right: 0, wrong: 0, stageUp: null };
      const g = L.GAMES[game];
      if (!g) return;
      ui.toast(`TOKEN-1 explains: ${g.name}`, `<ol class="t1-howto">${g.howto.map((s) => `<li>${s}</li>`).join('')}</ol>
        <p><i>My tip:</i> "${g.predict}" ${tag(stage())}</p>
        <div class="t1-steps"><div class="t1-step">Right<br><b class="t1-good">+${M.METER.up}%</b></div><div class="t1-step">Wrong<br><b class="t1-bad">−${M.METER.down}%</b></div><div class="t1-step">TOKEN-1 now<br><b class="t1-gold">${meter.accuracy}%</b></div></div>`, 9500);
    };

    const onEnd = () => {
      inGame = false;
      const r = run; run = null;
      if (!r || r.right + r.wrong === 0) return;

      const d = meter.accuracy - r.before;
      ui.toast('Run complete', `<div class="t1-steps"><div class="t1-step">This run<br><b><span class="t1-good">${r.right} ✔</span> · <span class="t1-bad">${r.wrong} ✘</span></b></div><div class="t1-step">Accuracy<br><b class="${d >= 0 ? 't1-good' : 't1-bad'}">${r.before}% → ${meter.accuracy}%</b></div><div class="t1-step">Final score<br><b class="t1-gold">${meter.accuracy}</b></div></div>`);
      if (r.stageUp !== null) { TF.banner('TOKEN-1 repaired', M.STAGES[r.stageUp].name); setTimeout(() => speak(`${M.STAGES[r.stageUp].line} ${tag(r.stageUp)}`, 5600), 1400); }
    };

    TF.token1 = { joined: () => joined, accuracy: () => meter.accuracy };

    TF.on('game', (e) => {
      if (e.phase === 'start') onStart(e.game);
      else if (e.phase === 'answer' && joined) onAnswer(e.correct);
      else if (e.phase === 'end') onEnd();
    });

    TF.on('boot', () => {
      parts = VAI_TOKEN1.parts;
      if (!parts) { console.error('TOKEN-1: no body was built, the companion is off'); return; }

      home = { x: parts.g.position.x, z: parts.g.position.z };
      bot = { x: home.x, z: home.z, heading: 0, stuck: 0, moving: false };
      beam = makeBeam(TF, home.x, home.z); beam.g.visible = !joined; ui.mark(!joined);
      INTER.push(inter); ui.onIconClick(toggleAway); refreshHud(); ready = true;
      (window.TokenFallStart || Promise.resolve()).then(() => { introAt = performance.now() + INTRO_DELAY; });
    });
    TF.on('enter', (prev, z) => { if (z === 'lobby' && !joined && !introDone) introAt = performance.now() + INTRO_DELAY; });

    const waitAtHome = (t, dt) => {
      const look = Math.atan2(TF.hero.x - bot.x, TF.hero.y - bot.z);
      bot = Object.assign({}, bot, { x: home.x, z: home.z, moving: false, heading: bot.heading + Math.atan2(Math.sin(look - bot.heading), Math.cos(look - bot.heading)) * Math.min(1, dt * 4) });
      beam.pulse(t);
      if (intro === 'talk' && !TF.talking) missionCard();
    };

    const follow = (dt) => {
      const hero = TF.hero;
      if (shown < .02 && !present()) { const s = slot(); bot = Object.assign({}, bot, { x: s.x, z: s.z }); return; }
      bot = F.step({ bot, target: slot(), home: { x: hero.x, z: hero.y }, dt, isBlocked: (x, z) => TF.blocked(x, z, .4) });
      if (bot.moving) return;
      const look = Math.atan2(hero.x - bot.x, hero.y - bot.z);
      bot = Object.assign({}, bot, { heading: bot.heading + Math.atan2(Math.sin(look - bot.heading), Math.cos(look - bot.heading)) * Math.min(1, dt * 4) });
    };

    TF.life.push((t, dtRaw) => {
      if (!ready) return;
      const hero = TF.hero, dt = Math.min(.1, dtRaw);
      const moved = lastHero ? Math.hypot(hero.x - lastHero.x, hero.y - lastHero.z) : 0;
      if (heroFacing === null) heroFacing = Math.atan2(...({ up: [0, -1], right: [1, 0], left: [-1, 0] }[hero.dir] || [0, 1]));
      if (lastHero && moved / dtRaw < F.FOLLOW.teleport) heroFacing = F.facingToward(heroFacing, { vx: (hero.x - lastHero.x) / dtRaw, vz: (hero.y - lastHero.z) / dtRaw }, dt);
      still = moved < 1e-3 ? still + dt : 0; lastHero = { x: hero.x, z: hero.y };

      // the intro waits for a free moment (no dialog, fade, card or locked player) instead of giving up when one is busy
      if (introAt !== null && !introDone && performance.now() >= introAt && canIntro()) { introAt = null; startIntro(); }
      if (joined) follow(dt); else waitAtHome(t, dt);

      const want = present() ? 1 : 0, wantSize = joined ? F.sizeFor(still) : 1;
      shown += (want - shown) * Math.min(1, dt * 8); size += (wantSize - size) * Math.min(1, dt * 6);
      const { g, body, arms, tip } = parts;
      g.visible = shown > .02; g.position.set(bot.x, (1 - shown) * 3, bot.z); g.scale.setScalar(Math.max(.02, shown * size)); g.rotation.y = bot.heading;
      body.position.y = .12 + Math.sin(t * 2.2) * .06;
      const waving = !bot.moving && (!joined || still >= F.FOLLOW.growAfter);
      arms[1].rotation.z = waving ? .6 + Math.sin(t * 8) * .5 : -.12; arms[0].rotation.z = waving ? -.1 : .12;
      tip.visible = Math.sin(t * 5) > -.3;
      inter.x = bot.x; inter.z = bot.z; inter.r = want && !intro ? 1.7 : 0;
      const head = headPoint(); ui.mark(!joined && !intro && want); ui.placeSay(head); ui.placeMark(head);
    });
  };

  window.Token1 = { install };
})();
