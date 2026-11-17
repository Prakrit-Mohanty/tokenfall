// Background music: one looping track per zone (every zone uses the default until it gets its own), faded on zone change,
// ducked while a minigame plays, M toggles it in the open world (saved). Starts on the first click or key press, since
// browsers block sound before that. Browser: window.Music. Node: require('./music.js') (the rules only).
(function () {
  const MUSIC = { volume: .32, duck: .1, fadePerSec: 1.6, store: 'tf.music.muted' };
  const TRACKS = { default: 'music/vadim_makes_sound-fantasy-worlds-enchanted-garden-570007.mp3' };

  const trackFor = (zone, tracks = TRACKS) => tracks[zone] || tracks.default;
  const volumeFor = ({ muted, inGame }) => (muted ? 0 : inGame ? MUSIC.duck : MUSIC.volume);
  const isMuteKey = ({ code, repeat, typing, inGame, locked, zone }) => code === 'KeyM' && !repeat && !typing && !inGame && !locked && zone !== 'bridge';
  const readMuted = (raw) => raw === '1';

  const install = (TF) => {
    const el = new Audio(); el.loop = true; el.preload = 'auto'; el.volume = 0;
    let muted = false, inGame = false, started = false, want = null, warned = false;
    try { muted = readMuted(localStorage.getItem(MUSIC.store)); } catch { muted = false; }

    el.addEventListener('error', () => { if (!warned) console.warn('Music could not load', el.src); warned = true; });

    const start = () => {
      if (started || !el.src) return;
      started = true;
      el.play().catch(() => { started = false; });
    };
    const onGesture = () => { start(); if (started) { removeEventListener('pointerdown', onGesture, true); removeEventListener('keydown', onGesture, true); } };
    addEventListener('pointerdown', onGesture, true); addEventListener('keydown', onGesture, true);

    const pick = (zone) => { want = trackFor(zone); if (!el.src) { el.src = want; } };

    addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
      if (!isMuteKey({ code: e.code, repeat: e.repeat, typing, inGame, locked: TF.locked, zone: TF.zone })) return;
      muted = !muted;
      try { localStorage.setItem(MUSIC.store, muted ? '1' : '0'); } catch (err) { console.warn('Music could not save the mute setting', err); }
      TF.sys(muted ? '♪ Music off (M to turn it back on)' : '♪ Music on');
    });

    TF.on('game', (e) => { if (e.phase === 'start') inGame = true; else if (e.phase === 'end') inGame = false; });
    TF.on('enter', (prev, z) => pick(z));
    TF.on('boot', () => { pick(TF.zone || 'lobby'); (window.TokenFallStart || Promise.resolve()).then(start); });

    TF.life.push((t, dt) => {
      if (!started) return;
      const swapping = want && !el.src.endsWith(encodeURI(want));
      const target = swapping ? 0 : volumeFor({ muted, inGame }), step = MUSIC.fadePerSec * Math.min(.1, dt);
      el.volume = Math.max(0, Math.min(1, el.volume + Math.max(-step, Math.min(step, target - el.volume))));
      if (swapping && el.volume === 0) { el.src = want; el.play().catch(() => { started = false; }); }
    });
  };

  const api = { MUSIC, TRACKS, trackFor, volumeFor, isMuteKey, readMuted, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.Music = api;
})();
