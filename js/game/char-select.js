// The player's character: the one of the four lobby roster characters the player walks as, saved between visits.
// Pure: the picker (launcher/char-select-screen.js) and the game (main.js) read and write the choice through here.
// Browser: window.CharSelect. Node: require('./char-select.js').
(function () {
  const KEY = 'tokenfall.char';
  const ROSTER = [
    { id: 'saanvi', name: 'Saanvi', blurb: 'Checks every answer twice, models included.' },
    { id: 'riya', name: 'Riya', blurb: 'Trying every minigame today.' },
    { id: 'mehta', name: 'Mr. Mehta', blurb: 'Verify, then trust. In that order.' },
    { id: 'aarav', name: 'Aarav', blurb: 'Reads the question before the next step.' },
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

  // ---- the look: hair colour and accessories, the hero's only. Saved as one value next to the pick.
  // the hair of each roster sprite. ref: the median hue, saturation and value of its hair pixels (0-1), from the idle frame facing down.
  // from: the height above the feet (in standing heights) the hair key starts at: where the head, or for long hair the hair's end, begins. vMax: the brightest hair pixel the key takes
  // hMax: the highest hue it takes (hair is redder than skin: Riya's lighter bun highlights are as bright as her skin, so her key tells them apart by hue).
  const HAIR_REF = {
    saanvi: { ref: [.041, .5, .455], from: .5, vMax: .6, hMax: .14 },
    riya: { ref: [.03, .587, .416], from: .62, vMax: .82, hMax: .05 },
    mehta: { ref: [.041, .398, .349], from: .62, vMax: .6, hMax: .14 },
    aarav: { ref: [.032, .406, .384], from: .62, vMax: .6, hMax: .14 },
  };
  const HAIR = [
    { id: 'original', name: 'Original' },
    { id: 'black', name: 'Black', hsv: [.66, .12, .16] },
    { id: 'auburn', name: 'Auburn', hsv: [.98, .75, .5] },
    { id: 'blonde', name: 'Blonde', hsv: [.11, .55, .75] },
    { id: 'silver', name: 'Silver', hsv: [.6, .08, .78] },
  ];
  const ACCESSORIES = [{ id: 'clip', name: 'Hair clip' }, { id: 'scarf', name: 'Scarf' }, { id: 'charm', name: 'Bag charm' }];
  const LOOK_KEY = 'tokenfall.look';
  const cleanLook = (v = {}) => ({
    hair: HAIR.some((h) => h.id === v.hair) ? v.hair : 'original',
    acc: Object.fromEntries(ACCESSORIES.map((a) => [a.id, !!(v.acc && v.acc[a.id] === true)])),
  });
  // a stale or hand-edited value falls back to the default look, so it never breaks the hero
  function getLook(storage = store()) {
    try { const raw = storage && storage.getItem(LOOK_KEY); return cleanLook(raw ? JSON.parse(raw) : {}); } catch (e) { return cleanLook(); }
  }
  function setLook(look, storage = store()) {
    try { if (storage) storage.setItem(LOOK_KEY, JSON.stringify(cleanLook(look))); } catch (e) {}
  }
  // what the shader turns this character's hair by: a hue turn, the saturation and value ratios from its own hair to the chosen colour, and the character's key (from, vMax, hMax).
  // null for the original colour, or a character with no measured hair.
  function hairShift(id, hair) {
    const pick = HAIR.find((h) => h.id === hair), r = HAIR_REF[id];
    if (!pick || !pick.hsv || !r) return null;
    const [h, s, v] = pick.hsv;
    return { dh: ((h - r.ref[0]) % 1 + 1) % 1, ks: s / r.ref[1], kv: v / r.ref[2], from: r.from, vMax: r.vMax, hMax: r.hMax };
  }

  const api = { KEY, ROSTER, DEFAULT, getChoice, setChoice, npcNames, LOOK_KEY, HAIR, ACCESSORIES, getLook, setLook, hairShift };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.CharSelect = api;
})();
