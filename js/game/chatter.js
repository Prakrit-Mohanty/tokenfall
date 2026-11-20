// Bot chatter: every bot has a voice (a phrase pool of its own, a few lines about the minigames among them), and a conversation never repeats itself:
// a line that was said in the last MEMORY messages is not said again, and the same bot never speaks twice in a row.
// Pure: create(rng) returns { speaker(bots), line(name, fallback) }; rng is Math.random in the game and a seeded function in the tests.
// Browser: window.Chatter. Node: require('./chatter.js').
(function () {
  const MEMORY = 10;

  const POOLS = {
    // ---- the lobby
    rosa_j: ['what\'s a token again? 😅', 'anyone tried the Prompt Lab yet?', 'meet at the signpost!', 'first day and I already lost the signpost',
      'okay but how do I get better at prompts?', 'I fell off the Glass Bridge twice. The tiles look so sure of themselves', 'Spot Shot is harder than it looks!', 'Token Tower: three wrong pulls and down it goes. I watched it happen'],
    chaiwala: ['brb grabbing chai', 'chai first, questions later', 'masala or ginger? this matters', 'the Token Brew queue is getting long',
      'tea tip: let it boil twice. unrelated, but true', 'four carrom pockets, four answers. I read them like a menu', 'the Token Brew kitchen is short-staffed, I can tell by the chai', 'somebody sort my crates at the Token Mill, I only came for chai'],
    pixelpriya: ['the pond is so calm today', 'I named my koi Claude', 'collecting screenshots of every zone today', 'who painted these paving stones? respect',
      'Pune at sunset looks unreal', 'Glass Bridge at golden hour is the best view in TokenFall', 'Spot Shot high score soon, watch me', 'the carrom table in HQ is gorgeous'],
    bobby5: ['gg everyone', 'who\'s doing the quiz later?', 'brb', 'afk, don\'t wait for me',
      'back. what did I miss?', 'mind the pit at the Token Mill. I did not', 'tried the Glass Bridge, my ping and my courage both dropped', 'Token Tower is basically Jenga with opinions'],
    sudhanshu: ['who\'s flying to Pleasanton?', 'tip: give the model the context a new teammate would need', 'shipping a small fix, back soon', 'if an answer looks off, say what was wrong and ask again',
      'rule of thumb: verify before you trust', 'Glass Bridge: read the question before you pick a tile', 'TOKEN-1 gets a bit more accurate with every right answer', 'Token Tower is a lesson in picking the answer you can defend'],
    gaurav: ['जहाँ चाह, वहाँ राह', 'अभ्यास से सब कुछ आता है. Practice makes it so', 'a model guesses the next word, you decide what to trust', 'chai pe charcha at the Token Brew?',
      'Glass Bridge: सोच-समझकर कदम रखो. Think before you step', 'Token Tower: एक-एक ब्लॉक सोचकर. One block at a time', 'Spot Shot: check the card before you shoot', 'बूँद-बूँद से घड़ा भरता है. Drop by drop, same for models'],
    saanvi: ['good prompts are specific prompts', 'Token Tower: pull the block you can defend', 'I check every answer twice, models included', 'Spot Shot is all about reading the card',
      'if the answer sounds too sure, ask for its sources', 'the Token Brew queue is a good place to think'],
    mehta: ['in my day we typed every word ourselves', 'verify, then trust. In that order', 'the pond is the calmest spot in TokenFall', 'Glass Bridge: slow feet, steady mind',
      'Token Mill is a lesson in patience', 'a good question is half the answer'],
    aarav: ['Glass Bridge speedrun attempt number four', 'tell the model the format you want back', 'Spot Shot champion of the lobby, I wish', 'who wants a Token Tower rematch?',
      'run first, read later? never the Glass Bridge way', 'Token Mill crates sort faster if you stop and read'],
    riya: ['one clear job at a time, that\'s my prompt rule', 'Glass Bridge at sunset, so pretty', 'Token Brew order is ready, somewhere', 'collecting every minigame star today',
      'Spot Shot reflexes are coming along', 'Token Tower is calmer than it looks'],
    // ---- the offices (the Calfus office, ABZ)
    'rahul.k': ['who booked the Prompt Lab again?', 'standup in the Token Room in five', 'my calendar has calendars', 'the Prompt Lab is booked. Again.',
      'carrom after lunch? I will not lose', 'need coffee before the Token Mill demo'],
    meera_s: ['the chai machine is by the lounge. probably', 'love the marigolds', 'anyone seen my charger?', 'ask the Token Room, they know everything',
      'the carrom board in HQ is calling me', 'Glass Bridge is easier if you read the question first'],
    devansh: ['the carrom queen is MINE', 'the chandeliers though', 'on carrom duty today', 'the break room tiles are lovely',
      'somebody is going to topple the Token Tower on the lobby lawn', 'Spot Shot champion of floor two, that\'s me'],
    'sana.k': ['this floor has the best view', 'ABZ coffee beats lobby coffee', 'who moved my monitor?', 'quiet hours until three',
      'a Glass Bridge run clears my head', 'Token Mill is calming once you get the rhythm'],
    arjun_p: ['do not touch the whiteboard', 'sprint review is at four', 'my keyboard is louder than the standup', 'the lift is slow again',
      'I scored three stars on the Glass Bridge. Ask me how', 'Token Tower on a Friday is a team sport'],
    // ---- Pune
    'ananya.r': ['the bus is "five minutes away"', 'Pune evenings are the best', 'fun fact: a model does not know the time unless you tell it', 'the chai here is serious',
      'did anyone finish the Glass Bridge?', 'House Rules Carrom is addictive'],
    kabir_m: ['the signal is green. finally', 'rickshaw or walk? walk', 'the HQ lobby is so tidy', 'lunch is a team decision',
      'I keep falling for the same Glass Bridge tile', 'Spot Shot reflexes, I have none'],
    'sneha.d': ['the new marigolds are lovely', 'meeting about meetings at three', 'iced chai is underrated', 'the Pune office has the best light',
      'Token Mill, crate by crate', 'Token Brew shift at four, wish me luck'],
  };

  const create = (rng = Math.random) => {
    const recent = []; let last = null;
    const pickFrom = (list) => list[Math.floor(rng() * list.length)];
    return {
      recent,
      // who talks next: anyone but the bot that talked last (when there is a choice)
      speaker(bots) { const others = bots.length > 1 ? bots.filter((b) => b.name !== last) : bots; return others.length ? pickFrom(others) : null; },
      // the bot's own line that has not been said lately; a bot with no pool of its own takes the fallback list. Never '' unless both are empty.
      line(name, fallback = []) {
        const own = POOLS[name] && POOLS[name].length ? POOLS[name] : fallback, fresh = own.filter((l) => !recent.includes(l));
        const from = fresh.length ? fresh : own.filter((l) => l !== recent[recent.length - 1]);   // the whole pool was used lately: anything but the line just said
        const text = from.length ? pickFrom(from) : own.length ? own[0] : '';
        if (text) { recent.push(text); if (recent.length > MEMORY) recent.shift(); last = name; }
        return text;
      },
    };
  };

  const api = { MEMORY, POOLS, create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.Chatter = api;
})();
