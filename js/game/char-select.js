// The player's character: the one of the four lobby roster characters the player walks as, saved between visits.
// Pure: the picker (launcher/char-select-screen.js) and the game (main.js) read and write the choice through here.
// Browser: window.CharSelect. Node: require('./char-select.js').
(function () {
  const KEY = 'tokenfall.char';
  // blurb is what each one already says in the lobby (NPC_TALK in js/game/characters.js), shortened for the picker; specialty is the AI-literacy topic they stand for
  const ROSTER = [
    { id: 'saanvi', name: 'Saanvi', specialty: 'Validates output', blurb: 'Checks every answer twice, models included.' },
    { id: 'riya', name: 'Riya', specialty: 'Saves tokens', blurb: 'Trying every minigame today.' },
    { id: 'mehta', name: 'Mr. Mehta', specialty: 'Human in the loop', blurb: 'Verify, then trust. In that order.' },
    { id: 'aarav', name: 'Aarav', specialty: 'Reads the question first', blurb: 'Reads the question before the next step.' },
  ];
  // the picker's tips: one or two lines each, handed round the characters (tipFor)
  const TIPS = [
    'Ask for a specific output format: a list, a table, three lines.',
    'Set a token budget: say how long the answer may be.',
    'Verify facts before you trust them, however sure the model sounds.',
    'Pick the model that fits the task: a small one for easy, a big one for hard.',
    'State guardrails in the prompt: what to avoid, and what to stick to.',
    'Check citations: a model can invent sources that look real.',
  ];
  const DEFAULT = 'saanvi';

  const store = () => { try { return window.localStorage; } catch (e) { return null; } };
  const isPick = (id) => ROSTER.some((r) => r.id === id);

  // the saved pick, or the default when nothing valid is saved (or storage is blocked)
  function getChoice(storage = store()) {
    try { const id = storage && storage.getItem(KEY); return isPick(id) ? id : DEFAULT; } catch (e) { return DEFAULT; }
  }
  function setChoice(id, storage = store()) {
    if (!isPick(id)) return;
    try { if (storage) storage.setItem(KEY, id); } catch (e) {}
  }
  // the lobby's NPCs without the one the player is walking as
  const npcNames = (names, choice) => names.filter((n) => n !== choice);
  // tip number n, wrapping round the pool (n may be any integer)
  const tipFor = (n) => TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length];

  const api = { KEY, ROSTER, TIPS, DEFAULT, getChoice, setChoice, npcNames, tipFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.CharSelect = api;
})();
