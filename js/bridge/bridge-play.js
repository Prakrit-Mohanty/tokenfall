// The Glass Bridge — gameplay. Browser: window.BridgePlay. Node: require('./bridge-play.js') (the pure motor and scoring).
//
//   createMotor(), stepMotor(m, dt, jumpPressed, probe)   jump / gravity / coyote / buffer, pure
//   starsFor({ falls, scans })                            1-3 stars for a finished run
//   install(TokenFall, { debug, fixed, progress })        builds the world + play, registers at lobby boot
//
// Shared with the other games: play.audio (the synth and the M mute), play.card (the Concept Card panel), play.progress (the one progress store),
// play.flash(good, text) (a brief gold / red full-screen flash, with an optional big popup word) and play.skipTalk() (S ends the open dialogue).
// Events (play.on): run, answer, fall, checkpoint, scan, finish, abandon. A progress object (bridge-progress.js) supplies
// newRun() -> { playerId, runIndex, history } and receives every event through onEvent(e); attach(play, TF) lets it add the report card
// (play.debrief = fn(summary)) and keys. Without bridge-progress.js a per-page memory is used.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./bridge-world.js') : root.BridgeWorld, isNode ? require('./bridge-generator.js') : root.BridgeGenerator, isNode ? require('./bridge-content.js') : root.BRIDGE_CONTENT);
  if (isNode) module.exports = api;
  else root.BridgePlay = api;
})(this, function (W, G, C) {
  const { PHYS } = W;
  const HINTS = 3;   // F cracks one wrong tile; this many per run

  // ---------------------------------------------------------------- pure: the motor
  // m: { alt, vy, grounded, coyote, buffer, air }. probe(pad) -> the surface under the hero (or null) with that much tolerance.
  const createMotor = () => ({ alt: 0, vy: 0, grounded: true, coyote: 0, buffer: 0, air: null, doomed: false });
  function stepMotor(m, dt, jumpPressed, probe) {
    const out = { jumped: false, left: false, landed: null };
    // doomed: the glass underfoot has shattered. The fall is committed: no coyote jump, no landing, until the motor is reset at the checkpoint.
    if (m.doomed) { jumpPressed = false; m.coyote = 0; probe = () => null; }
    m.buffer = jumpPressed ? PHYS.BUFFER : Math.max(0, m.buffer - dt);
    if (m.grounded) {
      if (!probe(PHYS.EDGE)) { m.grounded = false; m.coyote = PHYS.COYOTE; m.vy = 0; m.air = 'fall'; out.left = true; }
    } else {
      m.coyote = Math.max(0, m.coyote - dt);
      const before = m.alt;
      m.alt += m.vy * dt - 0.5 * PHYS.GRAVITY * dt * dt; m.vy -= PHYS.GRAVITY * dt;   // the exact parabola, whatever the frame rate
      if (m.vy <= 0 && before > 0 && m.alt <= 0) {   // only the moment of crossing the glass counts: once below it, you are falling for good
        const s = probe(m.air === 'jump' ? PHYS.LAND_PAD : PHYS.EDGE);   // a jump lands with a generous hitbox, a walk-off does not
        if (s) { m.alt = 0; m.vy = 0; m.grounded = true; m.air = null; out.landed = s; }
      }
    }
    if (m.buffer > 0 && (m.grounded || m.coyote > 0)) {   // a press up to 0.1 s early still counts; so does one up to 0.1 s late
      m.vy = PHYS.JUMP_V; m.alt = Math.max(m.alt, 0); m.grounded = false; m.coyote = 0; m.buffer = 0; m.air = 'jump'; out.jumped = true;
    }
    return out;
  }
  // 3 stars: at most 2 knowledge falls and no Scan. 2: at most 5 falls. 1: finished. Using Scan caps the run at 2.
  const starsFor = ({ falls, scans }) => Math.min(falls <= 2 ? 3 : falls <= 5 ? 2 : 1, scans > 0 ? 2 : 3);

  // ---------------------------------------------------------------- per-page memory, used until bridge-progress.js exists
  function memoryProgress(fixed) {
    const id = (fixed && fixed.playerId) || 'p' + Math.random().toString(36).slice(2, 10);
    let n = fixed && fixed.runIndex != null ? fixed.runIndex : 0;
    const runs = [], concepts = {};
    return {
      newRun() { return { playerId: id, runIndex: n++, history: { runs: runs.slice(), concepts } }; },
      onEvent(e) {
        if (e.type === 'answer') {
          const c = concepts[e.conceptId] = concepts[e.conceptId] || { attempts: 0, falls: 0, firstTry: [], mastered: false };
          c.attempts++; if (!e.correct) c.falls++;
          if (e.correct && e.firstTry && !c.firstTry.includes(e.variantId)) c.firstTry.push(e.variantId);
          c.mastered = c.firstTry.length >= 2;
        } else if (e.type === 'finish' || e.type === 'abandon') runs.push({ variants: e.seen || [] });
      },
    };
  }

  const TOPIC_NAME = Object.fromEntries(Object.entries(C.TOPICS).map(([k, v]) => [k, v.name]));
  const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FACING = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const STAGE_TEXT = [['Stage 1', 'Tokens, limits & data'], ['Stage 2', 'Models & prompts'], ['Stage 3', 'Verify, guard & approve'], ['The Boss', 'One scenario, three calls']];
  const BRIEFING = [
    'Welcome to the Glass Bridge! Each row asks a question. The tiles are the answers.',
    'Jump onto the tile you think is right. A wrong tile shatters.',
    'Space jumps (tap it alone to hop forward). Shift runs. E closes a card. F gives a hint, three times per run. M mutes. S skips talk.',
    'The parkour bits are just for fun: fall there and you only lose time. Fun fact: this sentence is about 12 tokens long.',
  ], BRIEF_SHORT = 'Back on the bridge. Jump onto the tile you think is right. Space jumps, F hints, M mutes.';
  // easy (chosen on arrival, before the run): the rows touch and there is no parkour, so you just walk onto your answer. Same questions, same scoring.
  const BRIEF_EASY = [
    'Welcome to the Glass Bridge! Each row asks a question. The tiles are the answers.',
    'Walk onto the tile you think is right. A wrong tile shatters. No jumping needed.',
    'F gives a hint, three times per run. E closes a card. M mutes. S skips talk.',
  ];
  const STAGE_RULE = ['Read the question on the board above the row, then hop onto the tile with the right answer.', 'A wrong tile means a fall and a card. Then the row is dealt again.', 'F gives a hint: it cracks one wrong tile, but caps you at 2 stars.', 'The boss is one case with three calls. Same rules.'];

  // ---------------------------------------------------------------- the game
  function create(TF, world, opts = {}) {
    const { THREE } = TF;
    const GLASS_WHITE = new THREE.Color(0xbfe8f0), tmpColor = new THREE.Color();   // reused: nothing is allocated per frame or per shatter
    const progress = opts.progress || (typeof window !== 'undefined' && window.BridgeProgress ? window.BridgeProgress.create({ fixed: opts.fixed }) : memoryProgress(opts.fixed));
    const listeners = {}, referee = BRIEFING.slice();   // the referee's lines: one line from the third run on
    const play = { autotick: true, on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return fn; } };
    const emit = (type, data = {}) => { const e = Object.assign({ type, at: Date.now() }, data); (listeners[type] || []).forEach((f) => f(e)); (listeners['*'] || []).forEach((f) => f(e)); if (progress.onEvent) progress.onEvent(e); };
    let S = null, hud = null, fx = null;
    const camLook = new THREE.Vector3(), CAM_RAISE = 1.7;   // from higher up, the hero's head and TOKEN-1's antenna cover less of the tiles ahead, and the tile text is seen less edge-on
    const now = () => TF.timeU.value;

    // ---- run state ----
    function newRun() {
      const r = progress.newRun();
      const easy = !!TF.easy;
      S = { playerId: r.playerId, runIndex: r.runIndex, spec: G.shorten(G.composeRun(G.seedFor(r.playerId, r.runIndex), r.history)), started: false, finished: false, startedAt: 0,
        falls: 0, scans: 0, tokens: 0, streak: 0, best: 0, cp: 0, rows: {}, taken: new Set(), lock: null, breakT: 0, pending: null, card: null,
        fallHandled: false, motor: createMotor(), jumpQ: false, standId: null, standRect: null, shake: { t: 0, d: 1, m: 0 }, scanned: {}, misled: {}, answers: [], safe: null, choosing: true };
      setReferee(easy);
      S.spec.easy = easy;   // the layout reads it (bridge-world.js); rerolls and bonus rows clone the spec, so it sticks for the run
      return S.spec;
    }
    const setReferee = (easy) => referee.splice(0, referee.length, ...(easy ? BRIEF_EASY : S.runIndex >= 2 ? [BRIEF_SHORT] : BRIEFING));
    // Normal or Easy, asked on arrival with the hero held; the course is rebuilt when the choice differs from the one it was built for
    function showChoice() {
      hud.m.innerHTML = `<h3>CHOOSE YOUR MODE</h3><ul style="list-style:none;padding:0"><li><kbd>1</kbd> Normal: jump from row to row, with parkour in between</li><li><kbd>2</kbd> Easy: just walk onto the tile you think is right</li></ul><p>Same questions and scoring either way.</p><p class="go"><kbd>Enter</kbd> ${S.spec.easy ? 'Easy' : 'Normal'} (last time)</p>`;
      hud.m.style.display = 'block'; TF.lockPlayer(true);
    }
    function choose(easy) {
      S.choosing = false; hud.m.style.display = 'none'; TF.lockPlayer(false); TF.easy = easy;
      if (S.spec.easy !== easy) { S.spec.easy = easy; world.build(S.spec); }
      setReferee(easy);
      TF.sys(`The Glass Bridge: 8 questions, 3 stages and a boss. ${easy ? 'Easy mode: just walk onto your answer' : 'Space jumps'}, F hints, M mutes.`);
      if (coachSeen === 0) showHelp(true);   // the very first visit opens the how-to-play panel
    }
    const rowSt = (id) => S.rows[id] || (S.rows[id] = { seenAt: null, falls: 0, solved: false });
    const rowIndexOf = (id) => S.spec.rows.findIndex((r) => r.id === id);

    // ---- audio: tiny WebAudio synth, M toggles ----
    const audio = {
      ctx: null, master: null, muted: false,
      init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
      },
      tone(f, d, type, v, at = 0, to) {
        if (!this.ctx) return; const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
      },
      noise(d, v, hp, at = 0) {
        if (!this.ctx) return; const c = this.ctx, t = c.currentTime + at, n = Math.max(1, (c.sampleRate * d) | 0), b = c.createBuffer(1, n, c.sampleRate), data = b.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
      },
      play(name) {
        if (!this.ctx || this.muted) return;
        switch (name) {
          case 'chime': this.tone(784, 0.14, 'sine', 0.12); this.tone(1175, 0.4, 'sine', 0.1, 0.09); break;
          case 'crack': this.noise(0.06, 0.2, 2800); this.tone(1900, 0.04, 'square', 0.05); this.noise(0.05, 0.17, 3400, 0.14); this.tone(1500, 0.05, 'square', 0.04, 0.14); this.noise(0.07, 0.22, 2600, 0.3); this.tone(2300, 0.04, 'square', 0.04, 0.3); break;   // three ticks as the crack spreads
          case 'shatter': this.noise(0.55, 0.28, 1100); this.noise(0.25, 0.2, 4000, 0.03); this.tone(240, 0.35, 'sawtooth', 0.05, 0, 70); this.tone(2637, 0.25, 'sine', 0.04, 0.05); this.tone(3136, 0.3, 'sine', 0.03, 0.12); this.tone(3951, 0.35, 'sine', 0.025, 0.2); break;   // and the glass tinkling down
          case 'jump': this.tone(380, 0.09, 'square', 0.035, 0, 640); break;
          case 'coin': this.tone(1320, 0.06, 'square', 0.05); this.tone(1760, 0.12, 'square', 0.05, 0.05); break;
          case 'fall': this.tone(420, 0.8, 'triangle', 0.09, 0, 70); break;
          case 'checkpoint': this.tone(523, 0.18, 'triangle', 0.1); this.tone(659, 0.18, 'triangle', 0.1, 0.1); this.tone(784, 0.3, 'triangle', 0.1, 0.2); break;
          case 'scan': this.tone(880, 0.25, 'sine', 0.08, 0, 1760); this.tone(1760, 0.3, 'sine', 0.05, 0.12); break;
        }
      },
      toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; TF.sys(this.muted ? 'Sound off (M).' : 'Sound on (M).'); },
    };

    // ---- particles: one instanced pool for shards and token sparks ----
    function makeFx() {
      const n = 240, geo = new THREE.BoxGeometry(1, 0.3, 1);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x333333 });
      const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false;
      const col = new THREE.Color(), WHITE = new THREE.Color(0xffffff), d = new THREE.Object3D();
      let active = false;
      const P = Array.from({ length: n }, () => ({ life: 0, max: 1, size: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rv: new THREE.Vector3(), rot: new THREE.Euler() }));
      for (let i = 0; i < n; i++) { im.setColorAt(i, col.set(0xffffff)); d.scale.setScalar(0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
      TF.scene.add(im);
      let cursor = 0;
      return {
        im,
        spawn(count, x, y, z, hex, o = {}) {
          for (let k = 0; k < count; k++) {
            const idx = cursor++ % n, p = P[idx], a = Math.random() * 6.283, sp = (o.speed || 2.5) * (0.4 + Math.random() * 0.8);
            p.pos.set(x + (Math.random() - 0.5) * (o.spread || 0), y, z + (Math.random() - 0.5) * (o.spread || 0));
            p.vel.set(Math.cos(a) * sp, (o.up || 2) * (0.5 + Math.random()), Math.sin(a) * sp); p.rv.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
            p.life = p.max = (o.life || 1.6) * (0.7 + Math.random() * 0.6); p.size = (o.size || 0.4) * (0.6 + Math.random() * 0.8);
            im.setColorAt(idx, col.set(hex).lerp(WHITE, o.white || 0.25));
          }
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          active = true;
        },
        update(dt) {
          if (!active) return;
          let any = false;
          for (let i = 0; i < n; i++) {
            const p = P[i];
            if (p.life <= 0) { if (p.size) { p.size = 0; d.scale.setScalar(0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } continue; }
            any = true; p.life -= dt; p.vel.y -= 16 * dt; p.pos.addScaledVector(p.vel, dt);
            p.rot.x += p.rv.x * dt; p.rot.y += p.rv.y * dt; p.rot.z += p.rv.z * dt;
            d.position.copy(p.pos); d.rotation.copy(p.rot); d.scale.setScalar(p.size * Math.min(1, p.life / 0.4)); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
          }
          im.instanceMatrix.needsUpdate = true; active = any;
        },
        dispose() { TF.scene.remove(im); geo.dispose(); mat.dispose(); im.dispose && im.dispose(); },
      };
    }

    // ---- golden tokens along the interludes (never over the question rows) ----
    let coins = null;
    function clearCoins() { if (coins) { TF.scene.remove(coins.im); coins.im.geometry.dispose(); coins.im.material.dispose(); coins.tex.dispose(); coins = null; } }
    function buildCoins() {
      clearCoins();
      const L = world.layout; if (!L) return;
      const list = [];
      L.interludes.forEach((il, k) => {
        const add = (id, x, z, y = 1.1) => list.push({ id: `${k}:${id}`, x, z, y });
        for (const p of il.pieces) {
          const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
          if (il.kind === 'stones' && p.kind === 'stone') add(p.id, cx, cz);
          else if (il.kind === 'beam' && p.kind === 'beam') for (let i = 1; i <= 4; i++) add('b' + i, cx, p.z1 - ((p.z1 - p.z0) * i) / 5);
          else if (il.kind === 'vanish' && /^v\d1$/.test(p.id)) add(p.id, cx, cz, 1.2);
        }
        if (il.kind === 'moving') { const a = il.pieces.find((q) => q.id === 'padS'), b = il.pieces.find((q) => q.id === 'padN'); for (let i = 1; i <= 3; i++) add('m' + i, L.cx, a.z0 + ((b.z1 - a.z0) * i) / 4, 1.8); }
      });
      const tex = TF.canvasTex(8, 8, (g) => {
        g.fillStyle = '#b8862c'; for (const [x, y, w, h] of [[2, 0, 4, 1], [1, 1, 6, 1], [0, 2, 8, 4], [1, 6, 6, 1], [2, 7, 4, 1]]) g.fillRect(x, y, w, h);
        g.fillStyle = '#f1c657'; for (const [x, y, w, h] of [[2, 1, 4, 1], [1, 2, 6, 4], [2, 6, 4, 1]]) g.fillRect(x, y, w, h);
        g.fillStyle = '#fff1b0'; g.fillRect(2, 2, 2, 1); g.fillStyle = '#9a6b1e'; g.fillRect(3, 3, 2, 3);
      }, { nearest: true });
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), Math.max(1, list.length));
      im.frustumCulled = false; im.count = list.length; TF.scene.add(im);
      coins = { im, tex, list, d: new THREE.Object3D() };
    }
    function tickCoins(t, h) {
      if (!coins) return;
      coins.list.forEach((c, i) => {
        const gone = S.taken.has(c.id);
        if (!gone && Math.hypot(h.x - c.x, h.y - c.z) < 0.95 && Math.abs(S.motor.alt + 0.8 - c.y) < 1.2) {
          S.taken.add(c.id); S.tokens += 10; audio.play('coin'); fx.spawn(8, c.x, c.y, c.z, 0xffd27a, { speed: 2, up: 2, size: 0.18, life: 0.7 });
        }
        const d = coins.d;
        d.position.set(c.x, c.y + Math.sin(t * 2.2 + i) * 0.12, c.z); d.quaternion.copy(TF.camera.quaternion); d.scale.setScalar(S.taken.has(c.id) ? 0 : 1); d.updateMatrix(); coins.im.setMatrixAt(i, d.matrix);
      });
      coins.im.instanceMatrix.needsUpdate = true;
    }

    // ---- HUD: the same .panel look as the rest of the lobby ----
    function makeHud() {
      const style = document.createElement('style');
      style.textContent = `
        .bq { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); padding: 6px 20px; text-align: center; display: none; background: rgba(32, 22, 19, .93); border-color: var(--gold); }
        .bq .k { font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: .14em; color: var(--gold); }
        .bq, .bs, .bc, .bk, .bh { font-variant-ligatures: none; }   /* the pixel font draws some digit and letter pairs as other glyphs */
        .bs { position: absolute; top: 214px; right: 18px; text-align: right; padding: 7px 12px; font-size: 16px; line-height: 1.5; display: none; }
        .bs b { color: #ffe39a; font-weight: 400; } .bs kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        .bc { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -52%); width: min(620px, calc(100vw - 32px)); padding: 18px 26px 16px; display: none; font-size: 22px; line-height: 1.45; background: rgba(40, 28, 24, .95); }
        .bc h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .bc p { margin: 7px 0; } .bc .w { color: #ff9d8a; } .bc .tk { color: #9dffc0; font-size: 24px; line-height: 1.3; margin: 0 0 10px; } .bc .go { text-align: right; font-size: 16px; color: var(--gold); margin: 12px 0 0; animation: bob 1s infinite; }
        .bc kbd { font: inherit; padding: 0 6px; color: #1a140c; background: var(--gold); }
        .bs .pl { font-size: 14px; line-height: 1.2; margin: 0 0 3px; } .bs .pips { display: flex; gap: 3px; justify-content: flex-end; margin: 0 0 5px; }
        .bs .pips i { width: 13px; height: 8px; border: 1px solid rgba(243,234,214,.45); } .bs .pips i.done { border-color: transparent; background: var(--c, #ffd27a); } .bs .pips i.cur { border-color: #ffe39a; box-shadow: 0 0 0 1px #ffe39a; }
        .bk { position: absolute; left: 50%; bottom: 76px;   /* above the lobby's key strip, which the bridge keeps */ transform: translateX(-50%); max-width: min(640px, calc(100vw - 420px)); padding: 9px 18px; text-align: center; display: none; font-size: clamp(17px, 1.6vw, 21px); line-height: 1.3; background: rgba(32, 22, 19, .93); }
        .bh { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); padding: 16px 24px 14px; display: none; font-size: 20px; line-height: 1.4; background: rgba(32, 22, 19, .96); }
        .bh h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .bh ul { margin: 0; padding-left: 20px; } .bh li { margin: 5px 0; } .bh kbd, .bk kbd { font: inherit; padding: 0 6px; color: #1a140c; background: var(--gold); } .bh .go { text-align: right; font-size: 16px; color: var(--gold); margin: 10px 0 0; }
        .bf { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: none; opacity: 0; transition: opacity .3s; } .bf.g { background: radial-gradient(circle, rgba(255, 210, 122, .05) 30%, rgba(255, 210, 122, .38)); } .bf.r { background: radial-gradient(circle, rgba(255, 70, 60, .05) 30%, rgba(255, 70, 60, .4)); }
        .bf b { font-family: 'Cinzel', serif; font-size: clamp(30px, 5vw, 56px); letter-spacing: .08em; color: #fff3c4; text-shadow: 0 2px 0 #000, 0 0 18px #ffb347; }
        @media (max-width: 1100px) { .bq { top: 70px; } .bs { top: auto; bottom: 120px; right: 18px; } }`;
      document.head.appendChild(style);
      const ui = document.getElementById('ui'), mk = (cls) => { const e = document.createElement('div'); e.className = 'panel ' + cls; ui.appendChild(e); return e; };
      return { style, q: mk('bq'), s: mk('bs'), c: mk('bc'), k: mk('bk'), h: mk('bh'), m: mk('bh'), qKey: '', sKey: '', kKey: '' };
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function currentRow(h) { const L = world.layout; return L && L.rows.find((rl) => rl.zc < h.y + 0.2 && !rowSt(rl.id).solved); }
    function drawHud(h) {
      const L = world.layout, rl = L && !S.finished ? currentRow(h) : null, show = rl && h.y - rl.zs < 24 && !S.card && !helpOpen() && !S.choosing;
      hud.q.style.display = show ? 'block' : 'none';
      if (L) for (const r of L.rows) world.veilRow(r.id, !!rl && r.index > rl.index && !rowSt(r.id).solved);   // rows ahead of the current one stay dim and unlabelled until you reach them
      if (show) {
        const row = S.spec.rows[rl.index], st = rowSt(rl.id), nth = S.spec.rows.filter((r) => !r.bonus).indexOf(row) + 1, total = S.spec.rows.filter((r) => !r.bonus).length;
        if (st.seenAt == null) st.seenAt = now();
        const key = row.bonus ? 'bonus' : nth + '/' + total;
        if (key !== hud.qKey) { hud.qKey = key; hud.q.innerHTML = `<div class="k">${row.bonus ? 'BONUS QUESTION' : `QUESTION ${nth} OF ${total}`}</div>`; }
        world.setQuestion(rl.id, { head: TOPIC_NAME[row.topic], stem: row.stem });   // the question lives in the world, above the row; the answers live only on the tiles
      } else world.setQuestion(null);
      const normal = S.spec.rows.filter((r) => !r.bonus), done = normal.filter((r) => rowSt(r.id).solved).length;
      const curId = rl ? rl.id : '', key = [done, S.streak, S.tokens, S.scans, audio.muted, curId, S.spec.rows.length].join();
      const ct = coachText();
      if (ct !== hud.kKey) { hud.kKey = ct; hud.k.innerHTML = ct; hud.k.style.display = ct ? 'block' : 'none'; }
      hud.s.style.display = S.finished ? 'none' : 'block';
      if (key !== hud.sKey) {
        hud.sKey = key;
        const zc = { amber: '#ffb347', green: '#7dff8a', cyan: '#5cd6ff' };
        const pips = S.spec.rows.map((r) => `<i class="${rowSt(r.id).solved ? 'done' : ''}${r.id === curId ? ' cur' : ''}" style="--c:${r.bonus || r.boss ? '#ffd27a' : zc[r.zone]}"></i>`).join('');
        hud.s.innerHTML = `<div class="pl">Answered <b>${done}/${normal.length}</b></div><div class="pips" aria-hidden="true">${pips}</div>Streak <b>${S.streak}</b> · Score <b>${S.tokens}</b><br>Hints <kbd>F</kbd> <b>${HINTS - S.scans}</b> of ${HINTS} left · <kbd>H</kbd> help · <kbd>M</kbd> ${audio.muted ? 'sound off' : 'sound on'}`;   // mistakes are not shown until the run ends
      }
    }
    // ---- gentle coaching for new players: one short rule per stage, for the first three runs ----
    const COACH_KEY = 'tokenfall.bridge.coach', START_KEY = 'tokenfall.bridge.startPrompt';
    let coachSeen = 0, startSeen = false;
    try { coachSeen = +localStorage.getItem(COACH_KEY) || 0; startSeen = !!localStorage.getItem(START_KEY); } catch (e) {}
    const bumpCoach = () => { coachSeen++; try { localStorage.setItem(COACH_KEY, String(coachSeen)); } catch (e) {} };
    const helpOpen = () => !!hud && hud.h.style.display === 'block';
    function coachText() {
      if (S && !S.started && !startSeen && !S.finished && !S.card && !S.choosing && !TF.talking && !helpOpen()) return 'Step onto the tile you think is right.' + (S.spec.easy ? '' : ' Walk to the edge, then tap <kbd>Space</kbd> to hop on.');   // once, at the start line, until you step on
      if (!S || S.finished || S.card || S.choosing || TF.talking || S.runIndex >= 3 || helpOpen()) return '';
      const st = S.stand;
      const easy = S.spec.easy;
      if (!S.started) return easy ? 'Walk forward onto the tile with the right answer.' : 'Walk to the edge, then tap <kbd>Space</kbd> to hop onto the first row. Land on the tile with the right answer.';
      if (st && (st.kind === 'tile' || st.kind === 'link') && rowSt(st.rowId).solved) return easy ? 'Row cleared! Line up with the next answer and walk onto it.' : 'Row cleared! Walk sideways to the next answer, then tap <kbd>Space</kbd>.';
      if (st && st.kind === 'platform') return easy ? 'Read the question on the board above the row, then walk onto the tile with the right answer.' : STAGE_RULE[Math.min(S.cp, 3)];
      if (st && st.kind !== 'tile') return 'Parkour: you lose nothing if you fall here. Hop across.';
      return '';
    }
    function showHelp(on) {
      if (!hud) return;
      if (on) hud.h.innerHTML = `<h3>HOW TO PLAY</h3><ul><li>Every row asks a question. Every tile is an answer.</li><li>Jump onto the tile you think is right. A wrong tile breaks. You fall, read why, and the row is dealt again.</li>${S && S.spec.easy ? '<li>Easy mode: walk onto a tile to choose it. No jumping.</li><li>An answered row links up. Walk to any lane, then walk on.</li>' : '<li><kbd>Space</kbd> jumps (tap it alone to hop forward). <kbd>Shift</kbd> runs.</li><li>An answered row links up. Walk to any lane, then jump on.</li>'}<li><kbd>F</kbd> hint (3 per run) cracks one wrong tile, but caps you at 2 stars.</li><li><kbd>M</kbd> sound. <kbd>R</kbd> report card. <kbd>E</kbd> closes cards. <kbd>S</kbd> skips talk and cards.</li></ul><p class="go"><kbd>H</kbd> or <kbd>E</kbd> to close</p>`;
      hud.h.style.display = on ? 'block' : 'none';
    }
    // The Concept Card panel, shared with the other games (play.card): show({ lead, text, breaks, idea, hint }) / hide() / open.
    // lead defaults to "You chose:"; idea is shown first, as the one-sentence takeaway; skippable adds an "S skip" hint (the caller must handle S); line (a whole sentence, no quoted answer) replaces lead + text; breaks and idea are left out when absent; breaksLabel renames the breaks line ("Why it breaks:"); ideaLabel is accepted but no longer shown. The HUD and its CSS are built on first use, so a game that
    // never visited the bridge still gets the same card.
    const card = {
      show(o) {
        hud = hud || makeHud();
        // the idea is the one-sentence takeaway and comes first; what you chose and why it breaks follow (ideaLabel is no longer shown: the headline is the idea)
        hud.c.innerHTML = `<h3>CONCEPT CARD</h3>` + (o.idea ? `<p class="tk"><b>${esc(o.idea)}</b></p>` : '') + (o.line ? `<p><b>${esc(o.line)}</b></p>` : `<p>${esc(o.lead || 'You chose:')} <b>“${esc(o.text)}”</b></p>`) + (o.breaks ? `<p class="w">${esc(o.breaksLabel || 'Why it breaks:')} ${esc(o.breaks)}</p>` : '')
          + `<p class="go"><kbd>E</kbd> ${esc(o.hint || 'Continue')} ▼${o.skippable ? ' · <kbd>S</kbd> skip' : ''}</p>`;
        hud.c.style.display = 'block';
      },
      hide() { if (hud) hud.c.style.display = 'none'; },
      get open() { return !!hud && hud.c.style.display === 'block'; },
    };
    // a brief gold (good) or red (mistake) flash over the screen, with an optional big word for a standout moment; shared (play.flash). Reduced motion: a still, softer tint, no fade.
    let fl = null, flT = 0;
    function flash(good, text) {
      hud = hud || makeHud(); const ui = document.getElementById('ui'); if (!ui) return;
      if (!fl) { fl = document.createElement('div'); ui.appendChild(fl); }
      clearTimeout(flT); fl.className = 'bf ' + (good ? 'g' : 'r'); fl.innerHTML = `<b>${esc(text || (good ? '' : '✕'))}</b>`;   // a mistake always carries a mark, never only a red tint fl.style.display = 'flex'; fl.style.transition = 'none'; fl.style.opacity = 0; void fl.offsetWidth;
      fl.style.transition = REDUCED_MOTION ? 'none' : 'opacity .3s'; fl.style.opacity = REDUCED_MOTION ? 0.5 : 1;
      flT = setTimeout(() => { fl.style.opacity = 0; flT = setTimeout(() => { fl.style.display = 'none'; }, 320); }, text ? 700 : 250);
    }
    const skipTalk = () => { for (let n = 0; TF.talking && n < 99 && typeof advanceDialog === 'function'; n++) advanceDialog(); };   // advanceDialog: the lobby's global; S ends what is left of a dialogue
    function showCard(p) {
      S.card = p; S.lock = { x: TF.hero.x, z: TF.hero.y };
      card.show({ skippable: true, lead: `You chose ${'ABC'[p.lane]}:`, text: p.tileText, breaks: p.breaks, idea: p.idea, hint: 'Try again' });   // the tile's letter, so the colour is not the only cue
    }

    // ---- what happens to a row ----
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function startRun() {
      if (S.started) return; S.started = true; S.startedAt = Date.now();
      if (!startSeen) { startSeen = true; try { localStorage.setItem(START_KEY, '1'); } catch (e) {} }
      emit('run', { playerId: S.playerId, runIndex: S.runIndex, seed: S.spec.seed, seen: S.spec.seen.slice() });
      TF.banner(STAGE_TEXT[0][0], STAGE_TEXT[0][1]); TF.sys(`The run begins. ${S.spec.easy ? 'Walk' : 'Jump'} onto the tile you think is right.`);
    }
    function onStand(s) {
      if (s.kind === 'tile') return onTile(s);
      if (s.kind === 'platform') {
        const p = world.layout.platforms[s.platform];
        if (p.kind === 'checkpoint' && p.index > S.cp) { S.cp = p.index; audio.play('checkpoint'); TF.sys('Checkpoint reached.'); if (STAGE_TEXT[p.index]) TF.banner(STAGE_TEXT[p.index][0], STAGE_TEXT[p.index][1]); emit('checkpoint', { index: p.index }); }
        if (p.kind === 'end' && !S.finished) finish();
      }
      if (s.kind !== 'platform') startRun();
    }
    function onTile(s) {
      startRun();
      const row = S.spec.rows[s.rowIndex], st = rowSt(row.id);
      if (st.solved || S.lock || S.pending) return;   // an answered row is inert: the answer is committed
      const tile = row.tiles[s.lane], ms = st.seenAt != null ? Math.round((now() - st.seenAt) * 1000) : null;
      const base = { rowId: row.id, conceptId: row.conceptId, variantId: row.variantId, topic: row.topic, stage: row.stage, bonus: row.bonus, tileId: tile.id, ms, falls: st.falls };
      if (tile.correct) {
        st.solved = true; S.streak++; S.best = Math.max(S.best, S.streak); S.tokens += 25;
        world.settleRow(row.id, s.lane); audio.play('chime'); bumpCoach();
        if (S.misled[row.id] && TF.token1) TF.token1.say('TOKEN-1', 'My hint was wrong that time: the cracked tile was the right one. Always check me against the question.', 4500);   // the lesson, once it can no longer cost you
        if (!S.linkHint) { S.linkHint = true; TF.sys(S.spec.easy ? 'The row links up. Walk to any lane, then on to the next row.' : 'The row links up. Walk to any lane, then jump (Space) to the next row.'); }
        const t = world.layout.rows.find((r) => r.id === row.id).tiles[s.lane];
        fx.spawn(18, t.x, 0.6, world.layout.rows.find((r) => r.id === row.id).zc, 0xffd27a, { speed: 3, up: 4, size: 0.2, life: 1.0, white: 0.4 });
        TF.sys(S.streak > 1 ? `Correct! Streak ×${S.streak}.` : 'Correct!'); flash(true, S.streak >= 3 ? `Streak ×${S.streak}!` : '');
        S.answers.push(Object.assign({ correct: true, firstTry: st.falls === 0 }, base));
        emit('answer', { correct: true, firstTry: st.falls === 0, ...base });
      } else {
        S.pending = { row, lane: s.lane, tileText: tile.text, breaks: tile.breaks, idea: row.idea, base: Object.assign({ wrongId: tile.id }, base) };
        S.lock = { x: TF.hero.x, z: TF.hero.y }; S.breakT = 0.55;   // no grace period: the hero is held while the glass trembles and cracks
        world.crackTile(row.id, s.lane, 2); audio.play('crack');
      }
    }
    function shatter() {
      const p = S.pending, r = world.breakTile(p.row.id, p.lane);
      if (r) {
        fx.spawn(34, r.x, 0.1, r.z, tmpColor.set(r.hex).lerp(GLASS_WHITE, 0.5).getHex(), { speed: 2.6, up: 3.5, size: 0.42, life: 1.8, spread: 2.4, white: 0.1 });
      }
      audio.play('shatter'); flash(false); if (!REDUCED_MOTION) S.shake = { t: 0.25, d: 0.25, m: 0.08 };
      S.lock = null; S.standId = null;
      S.motor.doomed = true;   // committed: stepping or jumping back no longer saves you (that used to leave the wrong answer unresolved)
      TF.sys('The tile shatters.');
    }
    function fallDone() {
      if (S.fallHandled) return; S.fallHandled = true;
      const p = S.pending; audio.play('fall');
      if (p) {
        S.falls++; S.streak = 0; rowSt(p.row.id).falls++;
        S.answers.push(Object.assign({ correct: false, firstTry: false }, p.base));
        emit('answer', { correct: false, firstTry: false, ...p.base }); emit('fall', { knowledge: true, rowId: p.row.id });
      } else { TF.sys('You fell. Back to the last checkpoint, no penalty.'); emit('fall', { knowledge: false }); }
      if (p) return showCard(p);   // the why comes first, while you are still falling; closeCard() does the fade and the respawn
      TF.fade(() => { if (!S || !world.layout || TF.zone !== 'bridge') return; respawn(); });   // the player may have left through a portal meanwhile
    }
    function respawn() {
      const cp = world.layout.checkpoints[S.cp], h = TF.hero;
      h.x = cp.x; h.y = cp.z; h.dir = 'up'; Object.assign(S.motor, createMotor()); h.alt = 0; S.standId = null; S.fallHandled = false; S.lock = null;
      TF.snapCamera();
    }
    // E on the card: re-deal the row (a different variant of the same concept) and bring the missed concept back as a bonus row
    function closeCard() {
      const p = S.card; if (!p || p.closing) return;
      p.closing = true; hud.c.style.display = 'none';   // S.card stays set until the screen is black, so a second E does nothing
      TF.fade(() => { if (!S || !world.layout || TF.zone !== 'bridge') return; redeal(p); respawn(); });   // the player may have left through a portal meanwhile
    }
    function redeal(p) {
      const i = rowIndexOf(p.row.id);
      let res = G.rerollRow(S.spec, i), spec = res.spec, bonus = null;
      if (!p.row.boss) { const b = G.insertBonusRow(spec, i); if (b.row) { spec = b.spec; bonus = b.row; } }
      S.spec = spec; S.card = null; S.pending = null; S.lock = null;
      delete S.scanned[p.row.id]; delete S.misled[p.row.id]; rowSt(p.row.id).seenAt = null;   // the re-dealt row is a fresh question
      if (bonus) { world.build(spec); reapply(); } else world.rerollRow(spec, i);
      TF.sys(bonus ? 'The row is re-dealt, and that idea will come back as a bonus row.' : 'The row is re-dealt: same idea, new question.');
    }
    function reapply() { // a rebuild resets every tile: put the committed answers and scans back
      for (const r of S.spec.rows) {
        const st = rowSt(r.id);
        if (st.solved) world.settleRow(r.id, r.tiles.findIndex((t) => t.correct));
        else (S.scanned[r.id] || []).forEach((lane) => world.crackTile(r.id, lane, 1));
      }
    }
    function scan() {
      if (S.finished || S.card || S.lock) return;
      if (S.scans >= HINTS) return TF.sys('No hints left on this run.');
      const h = TF.hero, rl = currentRow(h);
      if (!rl) return TF.sys('Nothing to hint here.');
      const row = S.spec.rows[rl.index], done = S.scanned[rl.id] || [];
      const open = row.tiles.map((t, lane) => lane).filter((lane) => !row.tiles[lane].correct && !done.includes(lane));
      if (!open.length) return TF.sys('That row already has a hint.');
      const rng = G.mulberry32(G.hash32(S.spec.seed + ':scan:' + rl.id + ':' + S.scans)); let lane = open[(rng() * open.length) | 0];
      // with TOKEN-1 along, the hint is TOKEN-1's: when its accuracy is low it is sometimes wrong, and then the cracked tile is the RIGHT one. Checking it against the question is the skill.
      const t1 = TF.token1, mine = !!(t1 && t1.joined), roll = rng(), right = row.tiles.findIndex((t) => t.correct);
      const misled = mine && t1.misleads(roll) && !done.includes(right);
      if (misled) { lane = right; S.misled[rl.id] = true; }
      S.scans++; (S.scanned[rl.id] = done).push(lane); world.crackTile(rl.id, lane, 1); audio.play('scan');
      if (mine) t1.say("TOKEN-1's hint", `I scanned ${esc(rl.label)}: the cracked tile looks wrong to me.${t1.unsure ? ' <span class="t1-tag">TOKEN-1 isn\'t sure</span><br><small>Check me against the question.</small>' : ''}`, 4200);   // short: the toast sits over the question board
      else TF.sys(`Hint: one wrong tile in ${rl.label.toLowerCase()} is cracked. ${HINTS - S.scans} left. The run is capped at 2 stars.`);
      emit('scan', { rowId: rl.id, conceptId: row.conceptId, misled });
    }
    function finish() {
      S.finished = true; const stars = starsFor(S), secs = Math.round((Date.now() - S.startedAt) / 1000);
      audio.play('chime'); TF.banner('You made it', `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`);
      const summary = { stars, falls: S.falls, scans: S.scans, tokens: S.tokens, bestStreak: S.best, seconds: secs, answers: S.answers, seen: S.spec.seen, seed: S.spec.seed, runIndex: S.runIndex, playerId: S.playerId, spec: S.spec };
      TF.sys(`Finished: ${stars} star${stars > 1 ? 's' : ''}, ${S.falls} mistake${S.falls === 1 ? '' : 's'}, ${S.tokens} points.`);
      emit('finish', summary);
      if (play.debrief) play.debrief(summary);   // bridge-progress.js shows the report card
      else TF.talk('Referee', [`You crossed! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, `${S.falls} mistake${S.falls === 1 ? '' : 's'}, ${S.scans} hint${S.scans === 1 ? '' : 's'}, ${S.tokens} points banked.`, 'Walk into the portal to head home. The bridge will be different next time.']);
    }

    // ---- the per-frame tick (right after the lobby moves the hero) ----
    function tick(dtMs) {
      const h = TF.hero, L = world.layout; if (!L || !S) return;
      const dt = Math.min(0.05, dtMs / 1000), T = now();
      // ride the moving platform
      if (S.standRect && S.motor.grounded) {
        const st = world.layout.surfaces.find((q) => q.id === S.standId);
        if (st && st.kind === 'moving') { const r = world.rectOf(st, T), c = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; h.x += c.x - S.standRect.x; h.y += c.z - S.standRect.z; }
      }
      if (S.lock) { h.x = S.lock.x; h.y = S.lock.z; }
      if (S.breakT > 0 && (S.breakT -= dt) <= 0) shatter();
      const jump = S.jumpQ && !S.lock; S.jumpQ = false;
      const probe = (pad) => world.surfaceAt(h.x, h.y, T, pad);
      // easy: the glass edge is a wall (slide along it); only a shattered tile drops you
      if (S.spec.easy && S.motor.grounded && !S.motor.doomed) {
        const on = (x, z) => world.surfaceAt(x, z, T, PHYS.EDGE);
        if (on(h.x, h.y)) S.safe = { x: h.x, z: h.y };
        else if (S.safe) { if (on(h.x, S.safe.z)) h.y = S.safe.z; else if (on(S.safe.x, h.y)) h.x = S.safe.x; else { h.x = S.safe.x; h.y = S.safe.z; } }
      }
      const ev = stepMotor(S.motor, dt, jump, probe);
      if (ev.landed) { // a generous landing is snapped onto the glass so it cannot slide off
        const r = world.rectOf(ev.landed, T), e = PHYS.EDGE; h.x = clamp(h.x, r.x0 + e, r.x1 - e); h.y = clamp(h.y, r.z0 + e, r.z1 - e);
      }
      if (ev.jumped) { audio.play('jump'); h.trigger('jump'); S.assist = h.moving ? null : FACING[h.dir] || null; }
      // jump assist: Space on its own hops forward, at walking speed, the way you are facing (any direction key takes over)
      if (S.assist && !S.motor.grounded && S.motor.air === 'jump' && !h.moving) {
        const nx = h.x + S.assist[0] * PHYS.WALK * dt, nz = h.y + S.assist[1] * PHYS.WALK * dt;
        if (!TF.blocked(nx, nz)) { h.x = nx; h.y = nz; }
      } else if (S.motor.grounded || h.moving) S.assist = null;
      h.alt = S.motor.alt;
      const stand = S.motor.grounded ? probe(PHYS.EDGE) : null;
      S.stand = stand;
      if (stand && stand.id !== S.standId) { S.standId = stand.id; onStand(stand); }
      if (!stand) S.standId = null;
      S.standRect = stand && stand.kind === 'moving' ? (() => { const r = world.rectOf(stand, T); return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; })() : null;
      if (S.motor.alt < -9) fallDone();
      h.g.children[1].visible = !!(stand || (!S.motor.grounded && S.motor.alt > -0.2 && probe(PHYS.LAND_PAD)));   // the blob shadow only over glass
    }

    // ---- keys ----
    function onKey(e) {
      if (TF.zone !== 'bridge' || !S) return false;
      audio.init();
      if (S.choosing) {
        if (e.repeat) return true;
        if (['Digit1', 'Numpad1'].includes(e.code)) choose(false); else if (['Digit2', 'Numpad2'].includes(e.code)) choose(true); else if (['Enter', 'KeyE'].includes(e.code)) choose(S.spec.easy);
        else if (e.code === 'KeyM') audio.toggle();
        return true;
      }
      if (e.code === 'Space') { if (!e.repeat && !S.spec.easy) S.jumpQ = true; return true; }
      if ((e.code === 'KeyE' || e.code === 'KeyS') && S.card) { if (!e.repeat) closeCard(); return true; }   // S on a card: the same as E (the row is re-dealt at once)
      if (e.code === 'KeyM' && !e.repeat) { audio.toggle(); return true; }
      if (e.code === 'KeyF' && !e.repeat) { scan(); return true; }
      if (e.code === 'KeyH' && !e.repeat) { showHelp(!helpOpen()); return true; }
      if (helpOpen() && (e.code === 'KeyE' || e.code === 'Escape') && !e.repeat) { showHelp(false); return true; }
      return false;
    }

    function frame(t, dt) {
      if (TF.zone !== 'bridge' || !S || !hud) return;
      if (!TF.cameraHeld) { camLook.copy(TF.camera.position).sub(TF.CAM_OFF); TF.camera.position.y += CAM_RAISE; TF.camera.position.z -= 0.4; TF.camera.lookAt(camLook); }   // the lobby has already placed the camera this frame; look from a little higher, at the same spot
      fx.update(dt); tickCoins(t, TF.hero); drawHud(TF.hero);
      if (S.shake.t > 0) { S.shake.t -= dt; const m = S.shake.m * Math.max(0, S.shake.t / S.shake.d); TF.camera.position.x += (Math.random() - 0.5) * m; TF.camera.position.y += (Math.random() - 0.5) * m; }
    }

    function enterZone() {
      hud = hud || makeHud(); fx = makeFx();   // the coins were built by the world's build event, which fires first
      const h = TF.hero; h.noLift = true; h.alt = 0; hud.qKey = hud.sKey = hud.kKey = ''; hud.c.style.display = 'none'; hud.h.style.display = 'none';
      if (S) showChoice();
    }
    function leaveZone() {
      const h = TF.hero; h.noLift = false; h.alt = 0; h.g.children[1].visible = true;
      if (S && S.started && !S.finished) emit('abandon', { seen: S.spec.seen, falls: S.falls });
      if (fx) { fx.dispose(); fx = null; }
      clearCoins();
      if (S && S.choosing) TF.lockPlayer(false);
      if (hud) { hud.q.style.display = hud.s.style.display = hud.c.style.display = hud.k.style.display = hud.h.style.display = hud.m.style.display = 'none'; }
      S = null;
    }

    play.register = function () {
      world.register(null, { specFor: newRun, referee });
      world.on('build', buildCoins);
      TF.on('enter', (prev, z) => { if (z === 'bridge') enterZone(); else if (prev === 'bridge') leaveZone(); });
      addEventListener('keydown', (e) => { if (e.code === 'KeyS' && !e.repeat && TF.zone === 'bridge' && S && TF.talking) skipTalk(); });   // the lobby's dialogue takes the keys first, so S is read here
      TF.zoneTick.bridge = (dt) => { if (play.autotick) tick(dt); };
      TF.onKey = onKey;
      if (progress.attach) progress.attach(play, TF);   // after our key handler is in place, so it can sit in front of it
      TF.setGroundProvider('bridge', (x, z) => (world.surfaceAt(x, z, now(), PHYS.EDGE) ? 0 : null));
      TF.life.push((t, dt) => frame(t, dt));
    };
    Object.assign(play, { tick, scan, closeCard, finish, audio, world, onKey, card, progress, flash, skipTalk });   // card and progress are shared with carrom-play.js
    Object.defineProperties(play, { state: { get: () => S }, fx: { get: () => fx }, coins: { get: () => coins } });   // live views (Object.assign would copy the getters' current values)
    return play;
  }

  function install(TF, opts = {}) {
    const world = W.create(TF, { debug: opts.debug });
    const play = create(TF, world, opts);
    TF.on('boot', () => play.register());
    if (typeof window !== 'undefined') { window.bridgeWorld = world; window.bridgePlay = play; }
    return play;
  }

  return { createMotor, stepMotor, starsFor, memoryProgress, create, install, BRIEFING };
});
