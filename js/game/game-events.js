// Minigame start, answers and end, re-fired on TokenFall as TF.on('game', e): e = { game, phase: 'start'|'end', completed, stars }
// or { game, phase: 'answer', correct }. Reads each game's existing play.on events; the games themselves are unchanged.
// Browser: window.GameEvents. Node: require('./game-events.js').
(function () {
  const CORRECT_FROM = { kitchen: (e) => e.ok, default: (e) => e.correct };

  const PHASES = {
    run: () => ({ phase: 'start', completed: false, stars: null }),
    answer: (e, game) => {
      const correct = (CORRECT_FROM[game] || CORRECT_FROM.default)(e);
      return typeof correct === 'boolean' ? { phase: 'answer', correct } : null;
    },
    finish: (e) => ({ phase: 'end', completed: true, stars: typeof e.stars === 'number' ? e.stars : null }),
    abandon: () => ({ phase: 'end', completed: false, stars: null }),
  };

  const forward = (plays, fire) => {
    for (const [game, play] of Object.entries(plays)) {
      if (!play || typeof play.on !== 'function') continue;

      for (const [type, shape] of Object.entries(PHASES)) {
        play.on(type, (e) => {
          // a listener bug (TOKEN-1, a HUD) must never break the game that emitted the event
          const out = shape(e, game);
          if (!out) return;
          try { fire(Object.assign({ game }, out)); } catch (err) { console.error(`game event ${game}:${type} listener failed`, err); }
        });
      }
    }
  };

  const install = (TF) => {
    const w = window;
    forward({ bridge: w.bridgePlay, carrom: w.carromPlay, jenga: w.jengaPlay, gallery: w.galleryPlay, mill: w.millPlay, kitchen: w.kitchenPlay }, (e) => TF.fire('game', e));
  };

  const api = { forward, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.GameEvents = api;
})();
