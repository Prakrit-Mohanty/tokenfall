// TOKEN-1's accuracy meter: right answers in any minigame raise it, wrong ones lower it, and it is the player's final score.
// Pure state, no DOM: applyAnswer returns a new state; load/save turn it into a string for localStorage and back.
// Browser: window.Token1Meter. Node: require('./token1-meter.js').
(function () {
  const METER = { start: 10, up: 3, down: 2, min: 0, max: 100 };

  const STAGES = [
    { name: 'Glitched', line: 'Pune is in Brazil. The pond is lava. I am 100% sure of all of this!' },
    { name: 'Garbled', line: 'To… ken… Fall. I read words in chunks. Some of my chunks are still wrong.' },
    { name: 'Learning', line: 'Pune is near Mumbai, about 30 km. Definitely. Probably. Mostly.' },
    { name: 'Careful', line: 'Pune is about 150 km from Mumbai, I think. Worth checking a map.' },
    { name: 'Calibrated', line: 'I still only guess the next word. Now I tell you when I am guessing. Please check.' },
  ];

  // TOKEN-1's hints: from 50% accuracy up every hint is right; below that it is unsure, and about one hint in four points the wrong way
  // (hintMisleads takes a roll in [0, 1), so the caller decides where randomness comes from)
  const HINT = { unsureBelow: 50, wrongChance: 0.25 };
  const isUnsure = (accuracy) => accuracy < HINT.unsureBelow;
  const hintMisleads = (accuracy, roll) => isUnsure(accuracy) && roll < HINT.wrongChance;

  const clamp = (v) => Math.max(METER.min, Math.min(METER.max, v));
  const isCount = (n) => Number.isInteger(n) && n >= 0;

  const createMeter = () => ({ accuracy: METER.start, correct: 0, wrong: 0 });

  const applyAnswer = (s, correct) => {
    if (typeof correct !== 'boolean') return s;

    return correct
      ? { accuracy: clamp(s.accuracy + METER.up), correct: s.correct + 1, wrong: s.wrong }
      : { accuracy: clamp(s.accuracy - METER.down), correct: s.correct, wrong: s.wrong + 1 };
  };

  const stage = (s) => Math.min(STAGES.length - 1, Math.floor(s.accuracy / (METER.max / STAGES.length)));

  const finalScore = (s) => {
    const answered = s.correct + s.wrong;
    return { accuracy: s.accuracy, correct: s.correct, wrong: s.wrong, answered, rate: answered ? Math.round(100 * s.correct / answered) : null };
  };

  const save = (s) => JSON.stringify(s);

  const load = (raw) => {
    let v;
    try { v = JSON.parse(raw); } catch { return createMeter(); }

    const valid = v && typeof v === 'object' && !Array.isArray(v) && Number.isFinite(v.accuracy) && v.accuracy >= METER.min && v.accuracy <= METER.max && isCount(v.correct) && isCount(v.wrong);
    return valid ? { accuracy: v.accuracy, correct: v.correct, wrong: v.wrong } : createMeter();
  };

  const api = { METER, STAGES, HINT, isUnsure, hintMisleads, createMeter, applyAnswer, stage, finalScore, save, load };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.Token1Meter = api;
})();
