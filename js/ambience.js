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

    // half a second of white noise, made once: the spray of a splash, a whistle's breath, a chuff
    const noise = () => { if (!S.noise) { const c = S.ctx, n = c.sampleRate * 0.5 | 0, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; S.noise = b; } return S.noise; };
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
    const BIKE_FILE = 'sounds/prakrit-bike.mp3', bike = { state: 'new' };
    function engine(speed, level) {
      if (window.TokenFall) TokenFall.bikeLevel = level * Math.min(1, .4 + speed / 12);   // set first, so the music comes back up when the bike stops
      if (!eng && bike.state !== 'ready' && level <= 0) return;
      // the bike is a game sound, not ambience: it plays even with the gentle ambience switched off, on its own bus straight to the speakers
      // (the ambience master sits at 0.2, which left the engine a whisper), and it wakes the audio context itself
      if (!ensure()) return;
      if (S.ctx.state === 'suspended') { S.ctx.resume(); return; }
      // pushed hard (x4) into a limiter, so it is as loud as the speakers go without crackling; the music ducks under it (music.js reads TF.bikeLevel)
      if (!S.bikeBus) { const lim = S.ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12;
        S.bikeBus = S.ctx.createGain(); S.bikeBus.gain.value = 4; S.bikeBus.connect(lim); lim.connect(S.ctx.destination); }
      const c = S.ctx, t = c.currentTime, f = 55 + speed * 14;
      // Prakrit's real bike: a recording at sounds/prakrit-bike.mp3, looped, pitched up with speed. Fetched on the first ride; the synth below
      // stands in until it decodes, and for good if the file is not there.
      if (bike.state === 'new') { bike.state = 'loading'; fetch(BIKE_FILE).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => c.decodeAudioData(b)).then((buf) => {
        const src = c.createBufferSource(), out = c.createGain(); src.buffer = buf; src.loop = true; out.gain.value = 0; src.connect(out); out.connect(S.bikeBus); src.start();
        bike.src = src; bike.out = out; bike.state = 'ready'; if (eng) eng.out.gain.setTargetAtTime(0, c.currentTime, .05);
      }).catch(() => { bike.state = 'none'; }); }
      if (bike.state === 'ready') {
        bike.src.playbackRate.setTargetAtTime(.75 + Math.min(speed, 26) / 26 * .75, t, .12);
        bike.out.gain.setTargetAtTime(level, t, .15);
        return;
      }
      // the synth: a supercharged inline-four screaming up the revs, like a Kawasaki H2R on the dyno. Two saws a hair apart for the howl (firing
      // at two pulses a crank turn, idling ~1,800 rpm and wound out past 14,000), an octave-up square for the rasp through a resonant band-pass,
      // a sine whine riding high above it for the supercharger, and a fast tremolo for the firing pulses that smooths out as the revs climb
      if (!eng) {
        const mk = (type) => { const o = c.createOscillator(); o.type = type; o.start(); return o; };
        const o1 = mk('sawtooth'), o2 = mk('sawtooth'), rasp = mk('square'), whine = mk('sine'), lfo = mk('square');
        const lp = c.createBiquadFilter(), bp = c.createBiquadFilter(), body = c.createGain(), raspG = c.createGain(), whineG = c.createGain(), pulse = c.createGain(), lfoAmt = c.createGain(), out = c.createGain();
        lp.type = 'lowpass'; lp.Q.value = 6; bp.type = 'bandpass'; bp.Q.value = 4; body.gain.value = .55; raspG.gain.value = .22; whineG.gain.value = .04; pulse.gain.value = .75; lfoAmt.gain.value = .25; out.gain.value = 0;
        o1.connect(lp); o2.connect(lp); lp.connect(body); body.connect(pulse);
        rasp.connect(bp); bp.connect(raspG); raspG.connect(pulse);
        lfo.connect(lfoAmt); lfoAmt.connect(pulse.gain); pulse.connect(out);
        whine.connect(whineG); whineG.connect(out); out.connect(S.bikeBus);
        eng = { o1, o2, rasp, whine, lfo, lp, bp, whineG, lfoAmt, out };
      }
      const k = Math.min(speed, 26) / 26, fire = 60 + k * k * 420 + k * 60;   // firing frequency, climbing faster near the top like a screaming redline
      eng.o1.frequency.setTargetAtTime(fire, t, .06); eng.o2.frequency.setTargetAtTime(fire * 1.008, t, .06); eng.rasp.frequency.setTargetAtTime(fire * 2, t, .06);
      eng.whine.frequency.setTargetAtTime(900 + k * 5200, t, .1); eng.whineG.gain.setTargetAtTime(.015 + k * .07, t, .1);
      eng.lfo.frequency.setTargetAtTime(fire / 4, t, .06); eng.lfoAmt.gain.setTargetAtTime(.3 - k * .22, t, .1);
      eng.lp.frequency.setTargetAtTime(700 + k * 4200, t, .08); eng.bp.frequency.setTargetAtTime(fire * 3, t, .08);
      eng.out.gain.setTargetAtTime(0.35 * level, t, 0.15);
    }
    const world = {
      state: S,
      horn() { if (!S.on || !ensure() || S.ctx.state !== 'running') return; [0, 0.2].forEach((d) => setTimeout(() => S.on && tone(698, 0.07, 0.13, 'square', false), d * 1000)); },
      engine,
      chime() { if (!S.on || !ensure() || S.ctx.state !== 'running') return; [1046.5, 1318.5, 1568, 2093].forEach((f, i) => setTimeout(() => S.on && tone(f, 0.05, 1.2, 'sine'), i * 75)); },
      // the train pulling out of the lobby's station (station.js): a steam whistle (two notes a third apart over a breath of noise), then chuffs that quicken
      train() {
        if (!S.on || !ensure() || S.ctx.state !== 'running') return;
        const c = S.ctx, t = c.currentTime;
        for (const [f, v] of [[587, 0.05], [740, 0.04]]) {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.12);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.08); g.gain.setValueAtTime(v, t + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
          o.connect(g); g.connect(S.master); o.start(t); o.stop(t + 1.2);
        }
        const air = c.createBufferSource(), bp = c.createBiquadFilter(), ag = c.createGain(); air.buffer = noise(); air.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.5;
        ag.gain.setValueAtTime(0.0001, t); ag.gain.exponentialRampToValueAtTime(0.05, t + 0.1); ag.gain.exponentialRampToValueAtTime(0.0001, t + 1.15); air.connect(bp); bp.connect(ag); ag.connect(S.master); air.start(t); air.stop(t + 1.2);
        let at = t + 1, gap = 0.42;
        for (let i = 0; i < 9; i++) {
          const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain(); src.buffer = noise(); lp.type = 'lowpass'; lp.frequency.value = 900;
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16 * (1 - i * 0.06), at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
          src.connect(lp); lp.connect(g); g.connect(S.master); src.start(at); src.stop(at + 0.25); at += gap; gap *= 0.85;
        }
      },
      // a fish in the river (river.js): a quick rising bloop, the bubble ringing, over a puff of filtered noise for the spray. vol 0-1, already faded with distance
      splash(vol = 1) {
        if (!S.on || !S.ctx || S.ctx.state !== 'running' || vol < 0.02) return;
        const c = S.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = rnd(420, 640);
        o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.6, t + 0.07);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        o.connect(g); g.connect(S.master); o.start(t); o.stop(t + 0.15);
        const src = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
        src.buffer = noise(); bp.type = 'bandpass'; bp.frequency.value = rnd(1500, 2400); bp.Q.value = 0.8;
        ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.3 * vol, t + 0.01); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        src.connect(bp); bp.connect(ng); ng.connect(S.master); src.start(t); src.stop(t + 0.4);
      },
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
