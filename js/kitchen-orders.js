// Token Brew Kitchen — the orders. Pure data and the pure rules over it (browser: window.KITCHEN_ORDERS, Node: require('./kitchen-orders.js')).
//
// One shift is 5 orders, each in 3 taps: read the ticket, pick the pot (small, medium or large model), add only what is needed (then Serve). To add or change a question, edit TASKS below:
//   { id, need: 'small' | 'medium' | 'large', icon, ask (6 words or fewer), detail (60 characters or fewer), items: [4 N(...) cards the job needs, 3 or more J(...) junk cards] }
//   N(label, size 1-2, icon)             a card the job needs (a piece of context)
//   J(label, size 2-3, icon, reason)     a junk card: it does not help this job, `reason` (70 characters or fewer) is what the customer says when it ends up in the pot
// `need` is the pot that fits the job: a small job wants the small (cheap, fast) model, a big job the large (powerful) one, and the medium sits between. The size of a card is how much of the
// pot it fills (the pot's gauge is GAUGE blocks tall). The FILL LINE sits just above what the needed cards fill: a little slack, or a tight one at order 4 and 5.
//
//   buildShift(playerId, runIndex) -> { seed, orders }    5 orders drawn from the bank, shuffled per player and per run (the same player and run always get the same shift)
//   judgePot(order, potId)         -> { potId, verdict: 'right' | 'tooBig' | 'tooSmall', right, why, stars }
//   judgeServe(order, potId, inPot, late) -> { stars: { pot, clean, line }, total, kind, why, happy, level, junkIn, missing }   inPot = the ids of the cards in the pot; late = the timer ran out
//                                  (potId may be null: no pot was picked)
//   validate()                     -> a list of problems with the bank (empty when it is sound); kitchen-play-tests.js runs it, and so does `node js/kitchen-orders.js` (exit code 1 on a problem)
(function (root) {
  const LIMITS = { ask: 6, detail: 60, label: 24, reason: 70, perNeed: 2, needs: 4, junk: 3, needSum: 7, junkMin: 2 };
  const NEEDS = ['small', 'medium', 'large'];
  const GAUGE = 12;                            // blocks the pot's gauge is tall
  const SLACK = { loose: 3, tight: 1 };        // how many blocks of room the fill line leaves above what the job needs
  const JUNK_SHOWN = 2;                        // junk cards on an order that has junk
  const TIMER = { seconds: 75 };               // order 5's gentle timer, from Got it: a tap takes a second or two, so a shift of normal pace finishes with most of it left
  const POTS = [
    { id: 'small', name: 'Small pot', model: 'Small model', blurb: 'Quick and cheap', rank: 1 },
    { id: 'medium', name: 'Medium pot', model: 'Medium model', blurb: 'Balanced', rank: 2 },
    { id: 'large', name: 'Large pot', model: 'Large model', blurb: 'Powerful, but pricey', rank: 3 },
  ];
  // what each order teaches; the ids are what progress records (the three ideas of the recap at the end)
  const CONCEPTS = [
    { id: 'size', title: 'Right-size the model', skill: 'spend', idea: 'A small job needs a small model and a big job a big one: the biggest is not always the best.', recap: 'A small job needs a small pot, and a big job a big one.' },
    { id: 'trim', title: 'Trim the context', skill: 'signal', idea: 'Put in only what the job needs. Extra text costs tokens and can push out the part that matters.', recap: 'Add only what the job needs, and stay under the line.' },
    { id: 'check', title: 'Check before serving', skill: 'clean', idea: 'Look at what is in the pot before you serve it: a quick check catches waste and overflow.', recap: 'Look in the pot first, so nothing overflows or goes missing.' },
  ];
  // the ramp: ONE new thing per order. onlyRightPot = the tutorial (only the right pot can be tapped, nothing can go wrong); junk = junk cards appear; tight = a tighter fill line; timer = a
  // generous timer (stage 3)
  const RAMP = [{ onlyRightPot: true }, {}, { junk: true }, { junk: true, tight: true }, { junk: true, tight: true, timer: true }];
  const SHAPE = ['small', 'large', 'medium', 'small', 'large'];   // the pot each order needs: the tutorial is a small job, and every kind is seen
  const CUSTOMERS = ['Maya', 'Dev', 'Priya', 'Sam', 'Ila', 'Ravi', 'Zoya', 'Kabir'];

  const N = (label, w, icon) => ({ kind: 'need', label, w, icon });
  const J = (label, w, icon, why) => ({ kind: 'junk', label, w, icon, why });
  const TASKS = [
    { id: 'tag-tickets', need: 'small', icon: '🎫', ask: 'Tag 50 support tickets by topic', detail: 'Billing, login, bug or other: one tag each.',
      items: [N('the 50 tickets', 2, '🎫'), N('the tag list', 1, '🏷️'), N('two tagged examples', 1, '📌'), N('the goal: one tag each', 1, '🎯'),
        J("last year's tickets", 3, '🗄️', "Last year's tickets are not the 50 I asked you to tag."), J('the whole CRM', 3, '🗃️', 'The whole CRM is far more than fifty tickets need.'), J('every Slack channel', 3, '💬', 'Slack chatter does not help pick a ticket tag.')] },
    { id: 'route-email', need: 'small', icon: '📧', ask: 'Route an inbound email', detail: 'One customer email: sales, support or billing?',
      items: [N('the email', 2, '📧'), N('the team list', 1, '👥'), N('what each team owns', 1, '📋'), N('the goal: one team', 1, '🎯'),
        J('the entire inbox', 3, '📥', 'I asked about one email, not the entire inbox.'), J('old dashboards', 2, '📊', 'Old dashboards say nothing about where this email goes.'), J('the org chart history', 3, '🏢', 'The org chart history does not route an email.')] },
    { id: 'translate', need: 'small', icon: '🧾', ask: 'Pull the dates from an invoice', detail: 'Issue date and due date, as YYYY-MM-DD.',
      items: [N('the invoice', 2, '🧾'), N('the fields: issue, due', 1, '📅'), N('the date format', 1, '🔢'), N('one worked example', 1, '📌'),
        J('every past invoice', 3, '🗄️', 'Every past invoice is noise: I need the dates on this one.'), J('the whole ERP export', 3, '🗃️', 'The ERP export is huge and has nothing on this invoice.'), J("the vendor's website", 2, '🌐', "The vendor's website does not have this invoice's dates.")] },
    { id: 'bug-class', need: 'small', icon: '🐞', ask: 'Classify a bug report', detail: 'One report: crash, UI glitch or slow page?',
      items: [N('the bug report', 2, '🐞'), N('the category list', 1, '🏷️'), N('the severity scale', 1, '🌡️'), N('a sample label', 1, '📌'),
        J('the entire code repo', 3, '💾', 'The entire repo is overkill for labelling one report.'), J('all closed issues', 3, '🗄️', 'Closed issues are old news: this report is new.'), J('the release calendar', 2, '📆', 'The release calendar does not say what kind of bug it is.')] },
    { id: 'comp-scan', need: 'medium', icon: '🔭', ask: 'Plan a competitor scan', detail: 'Three rivals: pricing, features and recent launches.',
      items: [N('the goal of the scan', 1, '🎯'), N('the three rivals', 1, '🏁'), N('the sources to check', 2, '🔗'), N('the compare grid', 2, '📋'),
        J('the whole CRM', 3, '🗃️', 'Our CRM is about our customers, not the rivals.'), J('every Slack channel', 3, '💬', 'Every Slack channel just buries the plan in chatter.'), J('old dashboards', 2, '📊', 'Old dashboards are our numbers, not the rivals.')] },
    { id: 'agent-brief', need: 'medium', icon: '🤖', ask: "Write an agent's brief", detail: 'Goal, tools, limits and when the job counts as done.',
      items: [N('the goal', 1, '🎯'), N('the tools it may use', 2, '🧰'), N('the done criteria', 2, '✅'), N('the deadline', 1, '⏰'),
        J('the entire code repo', 3, '💾', 'The agent needs a brief, not the entire repo.'), J("last year's tickets", 3, '🗄️', "Last year's tickets do not say what done looks like."), J('every Slack channel', 2, '💬', 'Slack threads only blur the brief.')] },
    { id: 'pilot-sum', need: 'medium', icon: '🧪', ask: "Summarise a pilot's results", detail: 'Six weeks of an AI pilot: did it hit the target?',
      items: [N('the pilot goal', 1, '🎯'), N('the success metric', 1, '📏'), N('the results data', 2, '📈'), N('user feedback notes', 2, '🗣️'),
        J('old dashboards', 3, '📊', 'Old dashboards predate the pilot: they cannot judge it.'), J('the whole CRM', 3, '🗃️', 'The CRM is not the pilot results.'), J('the vendor sales deck', 2, '📣', 'A sales deck is a pitch, not a result.')] },
    { id: 'vendor-cmp', need: 'medium', icon: '⚖️', ask: 'Compare two agent vendors', detail: 'Price, security, integrations and support.',
      items: [N('vendor A specs', 2, '📄'), N('vendor B specs', 2, '📄'), N('our must-haves', 1, '✅'), N('our budget', 1, '💰'),
        J('every vendor email', 3, '📥', 'Every vendor email is chatter: the specs say it all.'), J('the entire code repo', 3, '💾', 'Our repo does not compare two vendors.'), J('old dashboards', 2, '📊', 'Old dashboards say nothing about these vendors.')] },
    { id: 'drug-papers', need: 'large', icon: '🔬', ask: 'Screen five drug-target papers', detail: 'Methods, evidence strength and where they disagree.',
      items: [N('the five papers', 2, '📄'), N('the target question', 1, '❓'), N('the screening rubric', 2, '📋'), N('their results data', 2, '📊'),
        J('every paper ever cited', 3, '📚', 'Every cited paper is a library: I asked for five.'), J("the lab's Slack", 3, '💬', "The lab's Slack is gossip, not evidence."), J('old grant dashboards', 2, '📊', 'Grant dashboards do not screen papers.')] },
    { id: 'procure-agent', need: 'large', icon: '🛒', ask: 'Plan a multi-step procurement agent', detail: 'Request, quote, approve, order: with checks at each step.',
      items: [N('the goal and steps', 2, '🎯'), N('the approval rules', 2, '✅'), N('the tools and APIs', 2, '🧰'), N('the success metric', 1, '📏'),
        J('the whole ERP export', 3, '🗃️', 'The plan needs the steps, not every row of the ERP.'), J('every Slack channel', 3, '💬', 'Every Slack channel only drowns the plan.'), J("last year's orders", 2, '🗄️', "Last year's orders do not design the agent.")] },
    { id: 'contract', need: 'large', icon: '📑', ask: 'Find risks in a vendor contract', detail: 'Forty pages of clauses to read closely.',
      items: [N('the full contract', 2, '📑'), N('our risk checklist', 2, '⚠️'), N('the deal terms', 2, '🤝'), N('the signing deadline', 1, '⏰'),
        J('every old contract', 3, '🗄️', 'Old contracts are other deals: this one matters.'), J('the whole CRM', 3, '🗃️', 'The CRM does not flag contract risks.'), J('the vendor sales deck', 2, '📣', 'A sales deck hides the risks I asked you to find.')] },
  ];

  // ---- seeded shuffling: a hash of the player and run, then mulberry32 ----
  function seedFor(playerId, runIndex) {
    let h = 2166136261; const s = String(playerId) + ':' + runIndex;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffle = (list, rand) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function buildShift(playerId, runIndex) {
    const seed = seedFor(playerId, runIndex), rand = rng(seed), pool = {};
    for (const n of NEEDS) pool[n] = shuffle(TASKS.filter((t) => t.need === n), rand);
    const names = shuffle(CUSTOMERS, rand);
    const orders = SHAPE.map((need, i) => {
      const task = pool[need].shift(), ramp = Object.assign({}, RAMP[i]);
      const needs = task.items.filter((x) => x.kind === 'need'), junk = ramp.junk ? shuffle(task.items.filter((x) => x.kind === 'junk'), rand).slice(0, JUNK_SHOWN) : [];
      const cards = shuffle(needs.concat(junk), rand).map((x) => Object.assign({ id: task.id + ':' + task.items.indexOf(x) }, x));
      const line = needs.reduce((n, x) => n + x.w, 0) + (ramp.tight ? SLACK.tight : SLACK.loose);   // the fill line, in blocks
      return { id: 'o' + (i + 1), no: i + 1, concept: i < 2 ? 'size' : i < 4 ? 'trim' : 'check', task: task.id, need, icon: task.icon, ask: task.ask, detail: task.detail,
        customer: { name: names[i % names.length], face: Math.floor(rand() * 5) }, ramp, cards, line };
    });
    return { seed, orders };
  }

  // ---- the pot: right-sized, too big (it cost extra) or too small (it ran out of steam) ----
  const rank = (id) => POTS.find((p) => p.id === id).rank;
  // one plain sentence for every need x pot, so a customer always says exactly what happened
  const WHY = {
    small: { small: 'Just right: a small job only needs the small pot.', medium: 'The medium pot was more than a tiny job needed, so it cost extra.', large: 'The big pot for a tiny job cost extra.' },
    medium: { small: 'The small pot was too small for this job.', medium: 'Just right: the medium pot suits a job like this.', large: 'The big pot for this job cost extra.' },
    large: { small: 'The small pot ran out of steam on a big job.', medium: 'The medium pot struggled with such a big job.', large: 'Just right: a big job needs the big pot.' },
  };
  function judgePot(order, potId) {
    const d = rank(potId) - rank(order.need), verdict = d === 0 ? 'right' : d > 0 ? 'tooBig' : 'tooSmall';
    return { potId, verdict, right: verdict === 'right', why: WHY[order.need][potId], stars: verdict === 'right' ? 1 : 0 };   // the pot is one of an order's three stars
  }

  // ---- serving: three stars (the right pot, the right cards and nothing else, under the fill line) and the one thing the customer says ----
  const SAY = { ok: 'Perfect: the right pot, and only what the job needed.', overflow: 'Too much stuff in the pot, so it overflowed.', late: 'Time ran out, so the customer got what was in the pot.' };
  function judgeServe(order, potId, inPot, late) {
    const pot = potId ? judgePot(order, potId) : { potId: null, verdict: 'none', right: false, why: 'No pot was picked.', stars: 0 }, ids = new Set(inPot), inside = order.cards.filter((c) => ids.has(c.id));
    const level = inside.reduce((n, c) => n + c.w, 0), junkIn = inside.filter((c) => c.kind === 'junk'), missing = order.cards.filter((c) => c.kind === 'need' && !ids.has(c.id));
    const stars = { pot: pot.right, clean: !junkIn.length && !missing.length, line: level <= order.line };
    const total = (stars.pot ? 1 : 0) + (stars.clean ? 1 : 0) + (stars.line ? 1 : 0);
    // what the customer says: the biggest slip first (an overflow, then the wrong pot, then junk, then something left out)
    let kind = !stars.line ? 'overflow' : !stars.pot ? 'wrongpot' : junkIn.length ? 'junk' : missing.length ? 'missing' : 'ok';
    if (late && kind !== 'ok') kind = 'late';   // the timer ran out: a perfect pot still counts as perfect, anything else is just too late
    const why = { overflow: SAY.overflow, wrongpot: pot.why, junk: junkIn.length ? junkIn[0].why : '', missing: missing.length ? `You left out ${missing[0].label}, so the answer was missing something.` : '', late: SAY.late, ok: SAY.ok }[kind];
    return { stars, total, kind, why, happy: total >= 2, level, junkIn: junkIn.map((c) => c.label), missing: missing.map((c) => c.label), pot };
  }

  function validate() {
    const bad = [], words = (s) => s.trim().split(/\s+/).length, ids = new Set();
    for (const t of TASKS) {
      if (ids.has(t.id)) bad.push('duplicate task id ' + t.id); ids.add(t.id);
      if (!NEEDS.includes(t.need)) bad.push(t.id + ': need must be small, medium or large');
      if (words(t.ask) > LIMITS.ask) bad.push(t.id + ': ask is over ' + LIMITS.ask + ' words');
      if (t.detail.length > LIMITS.detail) bad.push(t.id + ': detail is over ' + LIMITS.detail + ' characters');
      if (!t.icon) bad.push(t.id + ': no icon');
      const needs = (t.items || []).filter((x) => x.kind === 'need'), junk = (t.items || []).filter((x) => x.kind === 'junk');
      if (needs.length !== LIMITS.needs) bad.push(t.id + ': needs exactly ' + LIMITS.needs + ' needed cards, has ' + needs.length);
      if (junk.length < LIMITS.junk) bad.push(t.id + ': needs at least ' + LIMITS.junk + ' junk cards, has ' + junk.length);
      if (needs.reduce((n, x) => n + x.w, 0) > LIMITS.needSum) bad.push(t.id + ': the needed cards fill more than ' + LIMITS.needSum + ' blocks, so the fill line would not fit the gauge');
      const labels = new Set();
      for (const x of t.items || []) {
        if (!x.label || x.label.length > LIMITS.label) bad.push(t.id + ': "' + x.label + '" needs a label of ' + LIMITS.label + ' characters or fewer');
        if (labels.has(x.label)) bad.push(t.id + ': two cards called "' + x.label + '"'); labels.add(x.label);
        if (!x.icon) bad.push(t.id + ': "' + x.label + '" has no icon');
        if (x.kind === 'need' && !(x.w >= 1 && x.w <= 2)) bad.push(t.id + ': "' + x.label + '" is a needed card, so its size must be 1 or 2');
        if (x.kind === 'junk') {
          if (!(x.w >= LIMITS.junkMin && x.w <= 3)) bad.push(t.id + ': "' + x.label + '" is junk, so its size must be 2 or 3 (it has to cost something)');
          if (!x.why || x.why.length > LIMITS.reason) bad.push(t.id + ': "' + x.label + '" needs a reason of ' + LIMITS.reason + ' characters or fewer');
        }
      }
    }
    for (const c of CONCEPTS) if (!c.recap || c.recap.length > 80 || !c.title || !c.idea) bad.push('concept ' + c.id + ' needs a title, an idea and a recap of 80 characters or fewer');
    if (!(TIMER.seconds >= 45)) bad.push('the timer must be generous: at least 45 seconds');
    for (const n of NEEDS) {
      const have = TASKS.filter((t) => t.need === n).length, want = SHAPE.filter((x) => x === n).length + LIMITS.perNeed - 1;
      if (have < want) bad.push('too few ' + n + ' tasks: ' + have + ', need at least ' + want + ' so two players do not see the same thing every time');
    }
    return bad;
  }

  // the shared intro card (js/game/intro-screen.js), also the H help
  const INTRO = {
    id: 'kitchen', title: 'Token Brew Kitchen', goal: 'Cook each order with the right pot and only the cards it needs.',
    steps: ['Read the order, then tap Got it.', 'Pick the small, medium or large pot.', 'Add only needed cards. Stay under the line.'],
    controls: [['Click / tap', 'everything'], ['1 2 3', 'pick a pot'], ['Space', 'go on'], ['Esc', 'leave']],
    duration: '~4 min', roundCount: 5, roundWord: 'orders',
  };
  const api = { INTRO, LIMITS, NEEDS, GAUGE, SLACK, JUNK_SHOWN, TIMER, POTS, CONCEPTS, RAMP, SHAPE, TASKS, WHY, SAY, seedFor, rng, shuffle, buildShift, judgePot, judgeServe, validate };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    if (require.main === module) {   // node js/kitchen-orders.js: check the bank after editing it
      const bad = validate();
      console.log(bad.length ? bad.map((x) => 'PROBLEM: ' + x).join('\n') : `The bank is sound: ${TASKS.length} tasks (${NEEDS.map((n) => TASKS.filter((t) => t.need === n).length + ' ' + n).join(', ')}).`);
      process.exitCode = bad.length ? 1 : 0;
    }
  } else root.KITCHEN_ORDERS = api;
})(this);
