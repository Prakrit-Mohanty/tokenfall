// TOKEN-1's parts and the glitch encounters. Each of his five missing parts is won back by finishing one minigame. Along the way,
// colleagues stop you (at office doors, on paths) with their own glitchy AI tool: they say what is wrong in their office and where your
// part is, then battle (in the Arena); every glitch you beat goes into the Glitch Log. Pure data and rules, no DOM.
// Browser: window.EncounterScript. Node: require('./encounter-script.js').
(function () {
  const MODULE_ORDER = ['factcheck', 'memory', 'understanding', 'askfirst', 'examples'];
  const BATTLE = { turns: 5, wanderTurns: 4, toClear: 3 };

  const PARTS = {
    carrom: { id: 'factcheck', name: 'Fact-check', icon: '✓', game: 'House Rules Carrom', where: 'Crescent Bay, Pune', gain: 'TOKEN-1 stops making things up. When he is not sure, he says so.', lesson: 'AI can say false things confidently. Check what it tells you.' },
    kitchen: { id: 'memory', name: 'Memory', icon: '◎', game: 'Token Brew Kitchen', where: 'off the lobby', gain: 'TOKEN-1 remembers you, where you have been and what you told him.', lesson: 'AI only knows what is in the conversation. Give it the context it needs.' },
    bridge: { id: 'understanding', name: 'Understanding', icon: '?', game: 'The Glass Bridge', where: 'the south gate of the lobby', gain: 'TOKEN-1 reads what you mean, not just your words, and asks when unsure.', lesson: 'Vague instructions get literal results. Be specific with AI.' },
    mill: { id: 'askfirst', name: 'Ask-first', icon: '✋', game: 'Token Mill', where: 'Baggage Sorting, Pune Airport', gain: 'Before anything big, TOKEN-1 checks with you first.', lesson: 'Give AI limits. People make the final call on things that matter.' },
    gallery: { id: 'examples', name: 'Good examples', icon: '▦', game: 'Spot Shot', where: 'the lobby lawn', gain: 'TOKEN-1 recognises things correctly, and knows he is only as good as what he learned from.', lesson: 'AI learns from examples. Bad examples make bad answers.' },
  };

  const GLITCHES = {
    slate: { name: 'Blank Slate', sprite: 'slate', mistake: 'Forgets everything you told it', lesson: 'AI only knows what is in the conversation. Give it the context it needs.', taunt: '"Hello! Who are you? Hello! Who are you? Hello!"', calm: '"Oh! You wrote it all down for me. That helps."' },
    loop: { name: 'Literal Loop', sprite: 'loop', mistake: 'Takes every word literally', lesson: 'Vague instructions get literal results. Be specific with AI.', taunt: '"You said break a leg. I am looking for a leg to break."', calm: '"Oh, it was a figure of speech!"' },
    pilot: { name: 'Autopilot', sprite: 'pilot', mistake: 'Acts without asking', lesson: 'Give AI limits. People make the final call on things that matter.', taunt: '"I already emailed everyone. Twice. And sorted the desks by colour."', calm: '"Hold on, let me check with you before I… oh. That is nicer."' },
    echo: { name: 'Echo', sprite: 'fog', mistake: 'Agrees with everything', lesson: 'An AI that agrees with everything is not checking anything.', taunt: '"Great idea! Great idea! Whatever you said: great idea!"', calm: '"Hm. Maybe not every idea is great. Noted."' },
  };

  const SPOTS = [
    {
      id: 'lobby', kind: 'wander', glitch: 'echo', who: 'neel.a', at: { zone: 'lobby', x: 4, z: 9, r: 4.5 },
      hello: ['Oh hey! You\'re new? And that\'s TOKEN-1! Everyone around here has a glitchy AI tool.', 'Mine agrees with literally everything I say. Here, I\'ll show you how a glitch battle works. Pick the right answers!'],
      win: ['See? You beat it! Every glitch you beat goes in your Glitch Log. Press G any time to look.'],
      lose: ['It agreed that you lost. Of course it did. Come back and try again; it goes in your Glitch Log once you win.'],
    },
    {
      id: 'abz', kind: 'door', glitch: 'slate', points: 'kitchen', who: 'rohan_t', at: { portal: { zone: 'pune', to: 'abz' } },
      hello: ['Hey! Heading up to ABZ?', 'Our chatbot forgets everything we tell it. TOKEN-1\'s Memory part ended up in the Token Brew Kitchen, back in the lobby.', 'Let\'s see if your robot can keep up with my Blank Slate!'],
      win: ['It remembered! Go finish a shift in the Token Brew Kitchen for TOKEN-1\'s Memory.'],
      lose: ['Forgot again! The Memory part is in the Token Brew Kitchen. Try me again any time.'],
    },
    {
      id: 'airport-road', kind: 'door', glitch: 'pilot', points: 'mill', who: 'jess.m', at: { portal: { zone: 'lobby', to: 'airport' } },
      hello: ['Off to the airport? Me too, for the Pleasanton flight.', 'My travel bot books things without asking. And TOKEN-1\'s Ask-first part? Stuck in the Token Mill, in the airport\'s baggage sorting.', 'Can TOKEN-1 talk my Autopilot down first?'],
      win: ['It asked me first! Head through to the airport and find the Token Mill for the Ask-first part.'],
      lose: ['It just booked you three more flights. The Ask-first part is in the Token Mill at the airport. Try me again!'],
    },
    {
      id: 'bangalore-road', kind: 'wander', glitch: 'loop', points: 'bridge', who: 'ishaan.b', at: { zone: 'lobby', x: 0, z: -26, r: 4.5 },
      hello: ['Heading to Bangalore? The road straight ahead is still being built, sorry!', 'While you wait: our helper takes every word literally. TOKEN-1\'s Understanding part is out on The Glass Bridge, behind you.', 'Think he can untangle my Literal Loop?'],
      win: ['Ha! Now cross The Glass Bridge (the gate behind you) and bring back his Understanding.'],
      lose: ['Still looping! The Understanding part waits on The Glass Bridge. Try me again.'],
    },
  ];

  const partIds = new Set(Object.values(PARTS).map((p) => p.id));
  const spotIds = new Set(SPOTS.map((s) => s.id));
  const ordered = (ids) => MODULE_ORDER.filter((id) => ids.includes(id));

  const partFor = (game) => PARTS[game] || null;

  const shouldTrigger = ({ spot, joined, cleared }) => !!spot && joined && !cleared.includes(spot.id);

  // armed once the player is outside the radius; walking in from outside triggers. Standing inside never does, so nobody is ambushed twice
  const sight = ({ armed, d, r }) => (d >= r ? { armed: true, trigger: false } : { armed: false, trigger: armed });

  const recover = (modules, id) => (partIds.has(id) && !modules.includes(id) ? ordered([...modules, id]) : modules);

  const parseList = (raw) => {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const loadModules = (raw) => ordered(parseList(raw).filter((id) => typeof id === 'string' && partIds.has(id)));
  const loadCleared = (raw) => [...new Set(parseList(raw).filter((id) => typeof id === 'string' && spotIds.has(id)))];

  const logEntries = (cleared) => {
    const caught = new Set(SPOTS.filter((s) => s.glitch && cleared.includes(s.id)).map((s) => s.glitch));
    return Object.entries(GLITCHES).map(([id, g]) => ({ id, name: g.name, sprite: g.sprite, mistake: g.mistake, lesson: g.lesson, caught: caught.has(id) }));
  };

  const plain = (...texts) => texts.every((t) => typeof t === 'string' && t && !t.includes('{'));
  const fromVariant = (v, pick) => {
    const src = v && (pick ? v.pick : v);
    if (!src || !Array.isArray(src.wrong) || src.wrong.length < 3) return null;
    if (!plain(v.stem, src.correct, ...src.wrong.map((w) => w && w.text))) return null;
    return { id: v.id, stem: v.stem, correct: src.correct, wrong: src.wrong.map((w) => ({ text: w.text, breaks: w.breaks || '' })) };
  };
  const cardsOf = (content) => (content && Array.isArray(content.CARDS) ? content.CARDS : []);

  const questionBank = (carrom, bridge) => [
    ...cardsOf(carrom).flatMap((c) => (c.variants || []).map((v) => fromVariant(v, true))),
    ...cardsOf(bridge).flatMap((c) => (c.variants || []).map((v) => fromVariant(v, false))),
  ].filter((q) => q && q.id);

  const pickQuestions = ({ bank, n, used, rng }) => {
    const fresh = bank.filter((q) => !used.includes(q.id)), pool = [...(fresh.length >= n ? fresh : bank)], out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };

  const options = (q, rng) => {
    const all = [{ text: q.correct, correct: true, breaks: '' }, ...q.wrong.slice(0, 3).map((w) => ({ text: w.text, correct: false, breaks: w.breaks }))];
    return all.map((o) => ({ o, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.o);
  };

  const newBattle = (turns) => ({ turns, turn: 0, rights: 0, muddle: 100, done: false, won: false });

  const answer = (b, correct) => {
    if (b.done) return b;

    const rights = b.rights + (correct ? 1 : 0), turn = b.turn + 1, won = rights >= BATTLE.toClear;
    return { turns: b.turns, turn, rights, muddle: Math.max(0, Math.round(100 - rights * 100 / BATTLE.toClear)), won, done: won || turn >= b.turns };
  };

  const api = { PARTS, GLITCHES, SPOTS, MODULE_ORDER, BATTLE, partFor, shouldTrigger, sight, recover, loadModules, loadCleared, logEntries, questionBank, pickQuestions, options, newBattle, answer };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.EncounterScript = api;
})();
