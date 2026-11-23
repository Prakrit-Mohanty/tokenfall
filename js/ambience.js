// TokenFall — gentle sound. Browser only: window.Ambience. Everything is synthesised with the Web Audio API (no audio files):
// a slow music box wandering over a pentatonic scale, a few bird chirps by day, crickets at night, and a soft three-note chime when something changes (a zone, the time of day).
// Quiet by design, softer still under a minigame's own sounds; it starts at the first key press or click (browsers insist), and the Daylight Console has the switch.
//   Ambience.install(TF)   TF.ambience = { apply(p, inside, zone), chime(), horn(), engine(speed, level), set(on), state }
(function (root) {
  const PENT = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];   // C major pentatonic, C4 to A5

  function install(TF) {
    const S = { on: true, ctx: null, master: null, send: null, p: null, inside: false, zone: 'lobby', t: { note: 1.5, bird: 5, cricket: 3 }, idx: 4 };
    try { if (localStorage.getItem('tokenfall.sound') === '0') S.on = false; } catch (e) { /* the default: on */ }
    const rnd = (a, b) => a + Math.random() * (b - a);

    function ensure() {
      if (S.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      const c = S.ctx = new AC(); S.master = c.createGain(); S.master.gain.value = 0; S.master.connect(c.destination);
      S.send = c.createGain(); S.send.gain.value = 0.5;   // a shimmering echo for the music box
      const d = c.createDelay(1); d.delayTime.value = 0.37; const fb = c.createGain(), lp = c.createBiquadFilter(); fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2400;
      S.send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(S.master); return true;
    }
    const resume = () => { if (S.ctx && S.ctx.state === 'suspended') S.ctx.resume(); else if (!S.ctx && S.on) ensure(); };
    for (const e of ['keydown', 'pointerdown']) addEventListener(e, resume, { passive: true });

    function tone(freq, vol, dur, type = 'triangle', echo = true) {
      const c = S.ctx, t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const g2 = c.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(S.master); if (echo) g.connect(S.send);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function chirp() {
      const c = S.ctx, t0 = c.currentTime; for (let k = 0; k < 2 + (Math.random() < 0.5); k++) {
        const t = t0 + k * 0.13, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; const f = rnd(2300, 3200); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.07);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(S.master); o.start(t); o.stop(t + 0.1);
      }
    }
    function cricket() {
      const c = S.ctx, t0 = c.currentTime, f = rnd(4300, 4800); for (let k = 0; k < 5; k++) {
        const t = t0 + k * 0.07, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); g.connect(S.master); o.start(t); o.stop(t + 0.06);
      }
    }
    // the bike's engine: a square and a saw a hair apart through a low-pass that opens with speed, chugging through a square tremolo that quickens too. Built on the first ride and
    // then left running at zero gain (ponytail: two idle oscillators; stop them if more voices ever share the context).
    let eng = null;
    function engine(speed, level) {
      if (!eng && level <= 0) return;
      if (!S.on || !ensure() || S.ctx.state !== 'running') return;
      const c = S.ctx, t = c.currentTime, f = 55 + speed * 14;
      if (!eng) {
        const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lp = c.createBiquadFilter(), chug = c.createGain(), lfoAmt = c.createGain(), out = c.createGain();
        o1.type = 'square'; o2.type = 'sawtooth'; lfo.type = 'square'; lp.type = 'lowpass'; lp.Q.value = 3; chug.gain.value = 0.65; lfoAmt.gain.value = 0.35; out.gain.value = 0;
        o1.connect(lp); o2.connect(lp); lp.connect(chug); chug.connect(out); lfo.connect(lfoAmt); lfoAmt.connect(chug.gain); out.connect(S.master);
        for (const o of [o1, o2, lfo]) o.start();
        eng = { o1, o2, lfo, lp, out };
      }
      eng.o1.frequency.setTargetAtTime(f, t, 0.08); eng.o2.frequency.setTargetAtTime(f * 1.012, t, 0.08);
      eng.lfo.frequency.setTargetAtTime(7 + speed * 2.2, t, 0.1); eng.lp.frequency.setTargetAtTime(420 + speed * 110, t, 0.1);
      eng.out.gain.setTargetAtTime(0.2 * level, t, 0.15);
    }
    const world = {
      state: S,
      horn() { if (!S.on || !ensure() || S.ctx.state !== 'running') return; [0, 0.2].forEach((d) => setTimeout(() => S.on && tone(698, 0.07, 0.13, 'square', false), d * 1000)); },
      engine,
      chime() { if (!S.on || !ensure() || S.ctx.state !== 'running') return; [1046.5, 1318.5, 1568, 2093].forEach((f, i) => setTimeout(() => S.on && tone(f, 0.05, 1.2, 'sine'), i * 75)); },
      set(on) { S.on = !!on; try { localStorage.setItem('tokenfall.sound', on ? '1' : '0'); } catch (e) { /* not saved */ } if (on) { ensure(); resume(); } },
      apply(p, inside, zone) { S.p = p; S.inside = inside; S.zone = zone; },
    };
    TF.life.push((t, dt) => {
      const c = S.ctx; if (!c || !S.p) return;
      const level = S.on && c.state === 'running' ? 0.2 * (TF.cameraHeld ? 0.35 : 1) : 0; S.master.gain.setTargetAtTime(level, c.currentTime, 0.4);
      if (!level) return;
      const night = S.p.stars > 0.5, out = !S.inside;
      if (!window.Music && (S.t.note -= dt) <= 0) {   // the music box (off when the game's music track is loaded): a slow random walk over the scale, lower and slower at night
        S.idx = Math.max(0, Math.min(PENT.length - 1, S.idx + [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0]));
        const f = PENT[night ? Math.max(0, S.idx - 3) : S.idx]; tone(f, night ? 0.05 : 0.065, night ? 3 : 2.2); if (Math.random() < 0.22) tone(PENT[Math.max(0, S.idx - 2)] / 2, 0.04, 3);
        S.t.note = night ? rnd(2.4, 4.4) : rnd(1.1, 2.4);
      }
      if (out && !night && S.p.stars < 0.2 && (S.t.bird -= dt) <= 0) { chirp(); S.t.bird = rnd(4, 9); }
      if (out && night && (S.t.cricket -= dt) <= 0) { cricket(); S.t.cricket = rnd(1.6, 3.6); }
    });
    TF.on('enter', () => world.chime());
    TF.ambience = world;
    return world;
  }
  root.Ambience = { install };
})(this);
