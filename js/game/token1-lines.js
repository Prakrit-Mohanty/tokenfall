// TOKEN-1's script: the first-meeting dialogue, the mission card, and per minigame a three-step how-to (the game's real
// rules, so always right) plus TOKEN-1's own prediction (its joke: confidently wrong). Browser: window.Token1Lines.
(function () {
  const GAMES = {
    gallery: {
      name: 'Spot Shot', where: 'the lobby lawn',
      howto: ['Shoot the fakes, scams and poisoned inputs: click or Space.', 'Spare the real cards: let them pass to the window.', 'Not sure? Hold F to inspect a card. Five charges per run.'],
      predict: 'Easy! If it has a logo and says URGENT, it is real. Shoot nothing.',
    },
    jenga: {
      name: 'Token Tower', where: 'the lobby lawn',
      howto: ['Pick the block that carries the right answer.', 'Hold Space to pull it, then set it on top, steady.', 'Three wrong tries and the tower falls.'],
      predict: 'Blocks never fall if you are polite to them.',
    },
    carrom: {
      name: 'House Rules Carrom', where: 'Calfus HQ, through the Pune gate',
      howto: ['The four pockets are the answers.', 'Pull back from the striker and let go: sink the coin in the right pocket.', 'Wrong pocket is a strike. Tab moves you to another side.'],
      predict: 'Every pocket is the right pocket if you believe in it.',
    },
    bridge: {
      name: 'The Glass Bridge', where: 'the south gate',
      howto: ['Each row asks a question. The glass tiles carry the answers.', 'Space jumps onto a tile. Wrong glass shatters under you.', 'Not sure? F scans a row and cracks one wrong tile. Twice per run.'],
      predict: 'All glass is the same glass. Just run.',
    },
  };

  const INTRO = [
    'Oh! A human! Hello! I am TOKEN-1, the AI helper for every Calfus office.',
    'People ask me things all day, and I help: answers, notes, emails. Usually correctly.',
    'Welcome! The canteen is on the roof, and today is Sunday. …Wait. Neither of those is true.',
    'Running a self-check… Five parts missing. Accuracy: 10%. Oh no. That explains a lot.',
    'Last night an update was told to "make TOKEN-1 faster", so it pulled out everything slowing me down.',
    'Those were the parts that make me RIGHT. And each one got locked inside a game somewhere in our offices.',
    'So we go office to office: Crescent Bay and ABZ in Pune, the airport, Pleasanton in the US. Win a game, get a part.',
    'Colleagues on the way will stop us to show off their own glitchy AI. Beat a glitch and it goes in our Glitch Log.',
    'Every right answer also lifts my accuracy. Will you take me office to office and help me?',
  ];

  const MISSION = {
    title: 'Mission: Missing Pieces',
    accept: 'Accept mission',
    later: 'Not now',
    rules: (m) => [
      ['🎮', 'Go office to office', 'win a game, get a part back'],
      ['⚖', 'Right answer / wrong answer', `+${m.up}% / −${m.down}%`],
      ['★', 'TOKEN-1\'s accuracy', 'is your final score'],
    ],
  };

  const missionParts = (parts) => Object.values(parts).map((p) => `<b>${p.name}</b> <span>· ${p.game}, ${p.where}</span>`);

  const api = { GAMES, INTRO, MISSION, missionParts };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.Token1Lines = api;
})();
