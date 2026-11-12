// Prompt Kitchen — order bank. Pure data (browser: window.KITCHEN_CONTENT, Node: require()).
// Teaches TOKEN SAVING AND CONTEXT MANAGEMENT in practice (the Glass Bridge teaches using AI at work, House Rules Carrom understanding it, Token Tower building it, Spot Shot
// spotting fakes, Token Mill governing it).
//
// Order:    { id, concept, skill, title, idea, breaks, rush?, variants: [...] }       concept ids K1..K9 never collide with the bridge's T1..B3, carrom's C*, the tower's J*,
//           spot shot's X* or the mill's M*. Order ids are K<concept>-<n>; variant ids add a letter (K2-1a). Two orders per concept, two variants per order (36 variants).
// Variant:  { id, phase, params, request, reply, slots, chunks, failReplies, best, twin?, chat?, prior?, gap?, after? }
//           phase 1 | 2 | 3 is the phase the variant is written for (phase 3 = the "oldest-first" pot). params = pools the generator draws from; every {name} in any string is filled.
//           request = what the ticket says (16 words or fewer). reply = { need: "line" | "short" | "full", lines: { cut, rambling, good } } (cut / rambling are null where the dial
//           has no step below / above the need). slots = { required, helpful }: a missing required slot fails the dish, a missing helpful slot costs nothing (it only costs tokens
//           to include). chunks = 6 or fewer (the pantry has 6 crates). failReplies = the authored wrong reply per required slot, plus noise and bleed (TASK and bleed have defaults).
//           best = the author's intended ideal line, { pack: { chunkId: "full" | "summary" | "excerpt" }, dial, cont?, stock? } (cont: true = continue in the residue pot, false =
//           wipe first; stock: true = prep the stable chunk). The engine's solver must find the same line (kitchen-tests checks this at every jitter corner).
// Chunk:    { id, label (24), preview (60), tokens: { full, summary?, excerpt? }, role, covers: { full: [], summary?: [], excerpt?: [] }, lost?: { summary, excerpt } }
//           role: essential | helpful | noise | duplicate | history | stable. A version exists only where the data allows it; full > summary > excerpt in tokens, always. The
//           roles are set per variant (the same crate can be noise for one request and essential for its twin).
// Chains:   `prior` is a whole earlier ticket (same fields as a variant, without id / phase / params). K5 (continue vs start fresh): prior and ticket are one conversation, turn 1 then 2;
//           the turn-2 ask line covers TASK2 (turn 1's covers TASK), so the residue of turn 1 can never stand in for the new instruction.
//           K9 (stable prefix): prior and ticket are two customers that share the stable chunk; `gap` = seconds between the two spawns. K6 (stale context bleeds) is written to follow
//           the K5 chain (`after: "K5"`): its pot may hold that customer's residue, and {otherName} / {otherRef} are filled from that earlier ticket.
// Twins:    `twin` names a variant that shares the surface (the same crates and a near-identical request) but whose best line differs: another slot is required, a compressed
//           version keeps something else, the reply needs another length, or the cache has expired.
// The right packing is derivable from the request plus the labels and previews, never from outside knowledge. Invented names and the reserved .example domain only.
// Limits (enforced by validate() and kitchen-tests.js): request <= 16 words, label <= 24, preview <= 60, lost <= 70, failReply <= 100, reply line <= 160, idea <= 140,
// break <= 100.
(function (root) {
  const LIMITS = { words: 16, label: 24, preview: 60, lost: 70, fail: 100, reply: 160, idea: 140, brk: 100, chunks: 6, minChunks: 5, minVariants: 4, minOrders: 16 };
  // the numbers the engine and the world read (section 5 of the spec); the tank is tuned by kitchen-tests.js so the ideal line uses 60-75% of it
  const RUN = {
    brief: 12, shift: 255, debrief: 25, orders: 13, phases: [{ n: 1, name: 'Warm-up', orders: 4, ticket: 60, policy: 'hard' }, { n: 2, name: 'Lunch', orders: 5, ticket: 55, policy: 'hard' }, { n: 3, name: 'Rush', orders: 4, ticket: 50, policy: 'oldest-first' }],
    spawn: 19, maxTickets: 3, stockMargin: 8, capacity: 260, dial: { line: 20, short: 50, full: 120 }, tank: 2500, stock: { rate: 0.1, seconds: 60 },
    time: { chop: 1.2, sieve: 1.2, cook: 2, cooking: 4, burn: 10, wipe: 1.5, stockPrep: 1.5, pickup: 0.3, walk: 4.2 },
    coins: { base: 20, quality: { perfect: 1, rambling: 0.8, overstuffed: 0.6 }, tip: 10, speed: 5, left: -5, bleed: -5, ideal: 35, par: 1.3, parBand: 0.3, clean: 1.15 }, stars: [0.2, 0.5, 0.75], rushNote: 'Rule change: when the pot is full, the oldest items pop out first',
  };
  // the four skills and their mastery-bar colours (the answer-slot colours the other games use)
  const SKILLS = { spend: { name: 'Spend wisely', zone: 'amber' }, signal: { name: 'Keep the signal', zone: 'green' }, chat: { name: 'Mind the chat', zone: 'cyan' }, clean: { name: 'Keep it clean and reuse', zone: 'rose' } };
  const SKILL_OF = { K1: 'spend', K7: 'spend', K2: 'signal', K3: 'signal', K4: 'signal', K5: 'chat', K8: 'chat', K6: 'clean', K9: 'clean' };

  const sl = (s) => (s ? String(s).split(' ') : []);
  // a chunk: tok = full or [full, summary, excerpt]; cov = slots every version covers, or [full, summary, excerpt] (space-separated slot ids); lost = [summary, excerpt]
  function ch(role, id, label, preview, tok, cov, lost) {
    const t = Array.isArray(tok) ? tok : [tok], c = Array.isArray(cov) ? cov : [cov, cov, cov];
    const o = { id, label, preview, tokens: { full: t[0] }, role, covers: { full: sl(c[0]) } };
    if (t[1] != null) { o.tokens.summary = t[1]; o.covers.summary = sl(c[1]); }
    if (t[2] != null) { o.tokens.excerpt = t[2]; o.covers.excerpt = sl(c[2]); }
    if (lost) o.lost = { summary: lost[0], excerpt: lost[1] };
    return o;
  }
  const E = (id, label, preview, tok, cov, lost) => ch('essential', id, label, preview, tok, cov, lost);
  const H = (id, label, preview, tok, cov, lost) => ch('helpful', id, label, preview, tok, cov, lost);
  const N = (id, label, preview, tok) => ch('noise', id, label, preview, tok, '');
  const D = (id, label, preview, tok, cov) => ch('duplicate', id, label, preview, tok, cov);
  const Y = (id, label, preview, tok, cov, lost) => ch('history', id, label, preview, tok, cov, lost);
  const S = (id, label, preview, tok, cov, lost) => ch('stable', id, label, preview, tok, cov, lost);
  const A = (preview) => E('ask', 'Ask line', preview, 14, 'TASK');
  // a crate whose role depends on the request (the same document is noise for one ticket and essential for its twin)
  const as = (role, c) => Object.assign({}, c, { role });

  const DEFAULT_FAIL = { TASK: 'Sorry, what would you like me to do with all this?', TASK2: 'Sorry, what would you like me to do with all this?' };
  // one ticket: o = { rq, need, good, cut, ramble, req, help, fail, best, chat }
  const T = (o, chunks) => ({
    request: o.rq, reply: { need: o.need, lines: { cut: o.cut == null ? null : o.cut, rambling: o.ramble == null ? null : o.ramble, good: o.good } },
    slots: { required: sl(o.req), helpful: sl(o.help) }, chunks, failReplies: Object.assign({}, DEFAULT_FAIL, o.fail), best: o.best, ...(o.chat ? { chat: o.chat } : {}),
  });
  // a variant: extra = { twin, prior, gap, after }
  const V = (id, phase, params, extra, ticket) => Object.assign({ id, phase, params }, ticket, extra);
  const Or = (id, title, idea, breaks, variants, more) => ({ id, concept: id.split('-')[0], skill: SKILL_OF[id.split('-')[0]], title, idea, breaks, variants, ...more });

  const NAMES = ['Priya', 'Dana', 'Omar', 'Sam', 'Maya', 'Tomas', 'Leila', 'Ines', 'Ravi', 'Noor', 'Kofi', 'Wren'];
  const pick = (...i) => i.map((k) => NAMES[k]);

  // ====================================================================== K2 · NOISE VS SIGNAL (phase 1)
  // the invoice crates are shared with K7-1 (same record, another reply length)
  const INV = [
    E('rec', 'Payment record', 'Approved {appr}. Payment run {run}.', [22, 12, 8], 'STATUS', ['the approval date', 'the approval date and the run name']),
    H('rules', 'House rules', 'Support voice: polite, 3 sentences', 25, 'TONE'),
    N('pre', 'Polite preamble', "Hope you're well! Quick favour...", 26),
    N('hist', 'Company history', 'Founded by two friends in a garage, now...', 70),
    D('dup', 'Same record, new format', 'APPR {appr} | RUN {run} | STATUS OK', 24, 'STATUS'),
    A('Reply with the payment status'),
  ];
  const invP = { name: pick(4, 5, 6), inv: ['4471', '4519', '3308'], appr: ['12 Oct', '19 Oct', '26 Oct'], run: ['20 Nov', '27 Nov', '4 Dec'] };
  const SHIP = [
    E('rec', 'Shipping record', 'Left depot {left}. Courier due {due}.', [26, 14, 9], 'ETA', ['the depot date', 'the depot date and the courier']),
    H('rules', 'Delivery voice', 'Friendly, two sentences, no promises past the record', 28, 'TONE'),
    N('pre', 'Customer greeting', 'Hi team! Hope the week is going well. Quick one...', 22),
    N('hist', 'Supplier history', 'Our supplier has served us since 2009 and...', 64),
    D('dup', 'Tracking copy', 'SHIP {left} | DUE {due} | ON TIME', 22, 'ETA'),
    A('Reply with the arrival date'),
  ];
  const shipP = { name: pick(7, 8, 9), po: ['7710', '7788', '6502'], left: ['4 Nov', '11 Nov', '18 Nov'], due: ['9 Nov', '16 Nov', '23 Nov'] };

  const K2_1 = Or('K2-1', 'Signal in the noise', 'Send only what the task needs; filler, history and copies cost tokens and pull the answer off the point.',
    { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The one fact the task needed was left out, so the model gave a generic answer.', overstuffed: 'Filler and copies cost tokens and pulled the reply off the point.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' }, [
      V('K2-1a', 1, invP, { twin: 'K7-1a' }, T({ rq: 'Tell {name} when invoice {inv} will be paid.', need: 'short', good: 'Invoice {inv} was approved {appr}; the payment run is {run}.', cut: 'Invoice {inv} was approved {appr}; the pay', ramble: 'Invoice {inv} was approved {appr}. The payment run is {run}. Payments are usually quick. Tell me if you need the record.', req: 'STATUS TASK', help: 'TONE', fail: { STATUS: 'Payments usually clear within 30 days, so expect it soon.', noise: 'Our company was founded by two friends in a garage, and we love our customers. Anyway...' }, best: { pack: { rec: 'excerpt', ask: 'full' }, dial: 'short' } }, INV)),
      V('K2-1b', 1, shipP, { twin: 'K7-1b' }, T({ rq: 'Tell {name} when order {po} will arrive.', need: 'short', good: 'Order {po} left the depot {left}; the courier is due {due}.', cut: 'Order {po} left the depot {left}; the cou', ramble: 'Order {po} left the depot {left}. The courier is due {due}. Deliveries are rarely late. Tell me if you need the record.', req: 'ETA TASK', help: 'TONE', fail: { ETA: 'Orders usually arrive within a week of shipping.', noise: 'Our supplier has served us since 2009 and has grown a lot. Anyway...' }, best: { pack: { rec: 'excerpt', ask: 'full' }, dial: 'short' } }, SHIP)),
    ]);
  const K7_1 = Or('K7-1', 'Stand-up line', 'Ask for the length you need: a longer reply costs more, and a shorter one gets cut off.',
    { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The one fact the task needed was left out, so the model gave a generic answer.', overstuffed: 'Filler and copies cost tokens and pulled the reply off the point.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'The task asked for one line; the longer reply was paid for and nobody needed it.' }, [
      V('K7-1a', 1, invP, { twin: 'K2-1a' }, T({ rq: 'One line for stand-up: is {inv} paid?', need: 'line', good: 'Approved; pays {run}.', ramble: 'Invoice {inv} is approved. The payment run is {run}. Payments are usually quick. Let me know if you want the record.', req: 'STATUS TASK', help: 'TONE', fail: { STATUS: 'Payments usually clear within 30 days.', noise: 'We were founded by two friends in a garage. Anyway...' }, best: { pack: { rec: 'excerpt', ask: 'full' }, dial: 'line' } }, INV)),
      V('K7-1b', 1, shipP, { twin: 'K2-1b' }, T({ rq: 'One line for stand-up: has {po} shipped?', need: 'line', good: 'Shipped {left}; due {due}.', ramble: 'Order {po} shipped on {left}. The courier is due {due}. Deliveries are rarely late. Tell me if you need more.', req: 'ETA TASK', help: 'TONE', fail: { ETA: 'Orders usually ship within a few days.', noise: 'Our supplier has served us since 2009. Anyway...' }, best: { pack: { rec: 'excerpt', ask: 'full' }, dial: 'line' } }, SHIP)),
    ]);

  const K2_2 = Or('K2-2', 'Copies and clutter', 'Send only what the task needs; filler, history and copies cost tokens and pull the answer off the point.',
    { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The one fact the task needed was left out, so the model gave a generic answer.', overstuffed: 'A copy and some clutter went in with the fact, which cost tokens and blurred the answer.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' }, [
      V('K2-2a', 1, { room: ['Orchard', 'Cedar', 'Harbour'], day: ['Thursday', 'Friday', 'Monday'] }, {}, T({ rq: 'Is the {room} room free on {day} at 3?', need: 'line', good: '{room} is booked on {day} at 3.', ramble: 'The {room} room is booked on {day} at 3. A team sync holds it. It is free after 4. You could also try another room.', req: 'BOOKING TASK', help: 'WHO', fail: { BOOKING: 'Rooms are usually free in the afternoon, so go ahead.', noise: 'The cleaning rota says Tuesdays and Fridays, plus a long list of other rooms...' }, best: { pack: { cal: 'excerpt', ask: 'full' }, dial: 'line' } }, [
        E('cal', 'Room calendar', '{room}: {day} 15:00 booked, team sync', [30, 16, 9], 'BOOKING', ['who booked it', 'who booked it and the end time']),
        N('export', 'Full year export', '2,400 rows of room bookings from January on...', 150),
        D('dup', 'Calendar, synced copy', '{room} {day} 3pm TEAM SYNC (synced copy)', 26, 'BOOKING'),
        H('dir', 'Team directory', 'Team sync is held by Ravi, in operations', 28, 'WHO'),
        N('rota', 'Cleaning rota', '{room} room is cleaned on Tuesdays and Fridays', 16),
        A('Reply: free or booked?'),
      ])),
      V('K2-2b', 1, { name: pick(10, 7, 11) }, {}, T({ rq: 'Which plan is {name} on?', need: 'line', good: '{name} is on the Team plan.', ramble: '{name} is on the Team plan. It renews on 1 March. The Business plan costs more. Tell me if you want a comparison.', req: 'PLAN TASK', help: 'NAMES', fail: { PLAN: 'Most customers are on the Starter plan.', noise: 'The pricing page lists Starter at 9, Team at 29 and Business at 79 per seat...' }, best: { pack: { acct: 'excerpt', ask: 'full' }, dial: 'line' } }, [
        E('acct', 'Account record', '{name}: Team plan, renews 1 Mar', [28, 15, 9], 'PLAN', ['the renewal date', 'the renewal date and the seat count']),
        N('price', 'Pricing page', 'Starter 9, Team 29, Business 79 per seat...', 90),
        D('dup', 'Account, older sync', '{name}: Team plan (billing sync, same data)', 24, 'PLAN'),
        N('chat', 'Last chat transcript', '{name} asked about dark mode on 2 Oct...', 30),
        H('plans', 'Plan list', 'Starter, Team, Business', 18, 'NAMES'),
        A('Reply with the plan name'),
      ])),
    ]);

  // ====================================================================== K7 · OUTPUT LENGTH (phase 1)
  const K7_2 = Or('K7-2', 'Full checklist', 'Ask for the length you need: a longer reply costs more, and a shorter one gets cut off.',
    { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The material the answer is built from never reached the pot.', overstuffed: 'Copies and clutter in the pot cost tokens and thinned the answer.', cutoff: 'The task asked for the full list, but the reply length stopped it part-way.', rambling: 'A longer reply than the task needs is still paid for, word by word.' }, [
      V('K7-2a', 1, { role: ['support', 'finance', 'design'] }, {}, T({ rq: 'Draft the full {role} onboarding checklist, about ten steps.', need: 'full', good: '1 Accounts. 2 Laptop. 3 Badge. 4 Safety talk. 5 Buddy intro... 10 First review.', cut: '1 Accounts. 2 Laptop. 3 Badge. 4 Safe', req: 'STEPS TASK', help: 'FORMAT', fail: { STEPS: 'Welcome aboard! Ask your manager what to do first.', noise: 'Welcome to the team! We are so thrilled that you are here and cannot wait...' }, best: { pack: { steps: 'summary', ask: 'full' }, dial: 'full' } }, [
        E('steps', 'Onboarding steps list', 'Ten steps: accounts, laptop, badge, safety talk...', [70, 35, 20], ['STEPS', 'STEPS', ''], ['the detail inside each step', 'half the steps']),
        H('rules', 'House rules', 'Numbered list, plain words, one line per step', 25, 'FORMAT'),
        N('org', 'Old org chart', 'Org chart from 2021 with fourteen departments...', 60),
        D('dup', 'Steps, older wiki page', 'Same ten steps, copied from the wiki in 2022', 68, 'STEPS'),
        N('speech', 'Welcome speech', 'Welcome to the team! We are so thrilled that...', 24),
        A('Draft the full checklist'),
      ])),
      V('K7-2b', 1, { ver: ['4.2', '5.0', '5.1'] }, {}, T({ rq: 'Write the full release notes for {ver}, about eight points.', need: 'full', good: 'Version {ver}: faster search, CSV export, dark mode, plus five fixes...', cut: 'Version {ver}: faster search, CSV expo', req: 'CHANGES TASK', help: 'FORMAT', fail: { CHANGES: 'This release includes several improvements and fixes.', noise: 'Our dev team met at the offsite in Lisbon, where everyone smiled a lot...' }, best: { pack: { changes: 'summary', ask: 'full' }, dial: 'full' } }, [
        E('changes', 'Change list', 'Eight changes: search, export, dark mode, fixes...', [64, 32, 18], ['CHANGES', 'CHANGES', ''], ['the detail of each change', 'half the changes']),
        H('fmt', 'Notes format', 'Headline, then bullet points', 24, 'FORMAT'),
        N('photo', 'Team photo caption', 'Our dev team at the offsite in Lisbon, smiling...', 18),
        D('dup', 'Changelog, raw export', 'Same eight changes as a raw commit list', 66, 'CHANGES'),
        N('road', 'Roadmap for next year', 'Next year we plan to rebuild the whole editor...', 80),
        A('Write the full release notes'),
      ])),
    ]);

  // ====================================================================== K1 · BUDGET AND HEADROOM (phase 1)
  // each pair shares its crates: the base ticket needs the numbers, the twin also needs the tone rules, which cannot fit in full beside a full-length reply
  const Q3 = (tone) => [
    E('res', '{q} results table', 'Revenue, margin and churn by region', [120, 55, 30], 'RESULTS', ['the region-by-region detail', 'everything but the headline numbers']),
    as(tone, H('rules', 'Board tone rules', 'Formal, no jargon, three bullet points', [60, 30, 16], 'TONE', ['the bullet limit', 'the bullet limit and the jargon rule'])),
    N('last', "Last year's results", '{q} results table from the year before...', 90),
    N('gloss', 'Glossary', 'ARR, churn, margin: what each word means...', 80),
    N('members', 'Board member list', 'Twelve members with start dates and short bios', 52),
    A('Write the summary'),
  ];
  const ACC = (tone) => [
    E('res', 'Annual accounts', 'Revenue, costs, cash and debt for {yr}', [130, 60, 32], 'RESULTS', ['the line-by-line detail', 'everything but the headline numbers']),
    as(tone, H('rules', 'Investor tone rules', 'Plain words, lead with cash, five bullets', [64, 32, 18], 'TONE', ['the five-bullet limit', 'the bullet limit and the plain-words rule'])),
    N('last', "Last year's accounts", 'Annual accounts from the year before...', 96),
    N('press', 'Press clippings', 'Seven news articles about the company...', 84),
    N('audit', 'Auditor letter', 'The auditors confirm they follow standard...', 56),
    A('Write the summary'),
  ];
  const K1_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'A fact the summary is built from never reached the pot, so it guessed.', overstuffed: 'Extra text used up the window, which left little room for the reply.', cutoff: 'The reply length was set below what the summary needs, so it stopped part-way.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K1_IDEA = 'Leave room for the reply: the pot holds the prompt and the answer together, so headroom is part of the packing.';
  const K1_1 = Or('K1-1', 'Headroom: the numbers', K1_IDEA, K1_BR, [
    V('K1-1a', 1, { q: ['Q3', 'Q2', 'Q4'] }, { twin: 'K1-2a' }, T({ rq: 'Summarise {q} for the board.', need: 'full', good: '{q}: revenue up 8%, margin steady at 21%, churn down to 2.4%. Two risks: ...', cut: '{q}: revenue up 8%, margin steady at', ramble: null, req: 'RESULTS TASK', help: 'TONE', fail: { RESULTS: 'The quarter went reasonably well, with some ups and downs.', noise: 'Last year the board saw very different numbers, as the glossary explains...' }, best: { pack: { res: 'excerpt', ask: 'full' }, dial: 'full' } }, Q3('helpful'))),
    V('K1-1b', 1, { yr: ['2025', '2024', '2023'] }, { twin: 'K1-2b' }, T({ rq: 'Summarise the {yr} accounts for investors.', need: 'full', good: 'Revenue grew 11%, cash is up to 4.2m, and debt is down to 0.6m. Three points: ...', cut: 'Revenue grew 11%, cash is up to 4.2m, and', ramble: null, req: 'RESULTS TASK', help: 'TONE', fail: { RESULTS: 'The year was solid and the company is in good shape.', noise: 'Press coverage was warm, and last year the accounts told a different story...' }, best: { pack: { res: 'excerpt', ask: 'full' }, dial: 'full' } }, ACC('helpful'))),
  ]);
  const K1_2 = Or('K1-2', 'Headroom: with the tone rules', K1_IDEA, K1_BR, [
    V('K1-2a', 1, { q: ['Q3', 'Q2', 'Q4'] }, { twin: 'K1-1a' }, T({ rq: "Summarise {q} for the board, in the board's tone.", need: 'full', good: '{q} in brief: revenue up 8%; margin steady at 21%; churn down to 2.4%.', cut: '{q} in brief: revenue up 8%; margin st', ramble: null, req: 'RESULTS TONE TASK', fail: { RESULTS: 'The quarter went reasonably well, with some ups and downs.', TONE: "Hey board, so Q3 was pretty wild, you won't believe the churn!", noise: 'Last year the board saw very different numbers, as the glossary explains...' }, best: { pack: { res: 'excerpt', rules: 'excerpt', ask: 'full' }, dial: 'full' } }, Q3('essential'))),
    V('K1-2b', 1, { yr: ['2025', '2024', '2023'] }, { twin: 'K1-1b' }, T({ rq: 'Summarise the {yr} accounts for investors, in the investor tone.', need: 'full', good: 'Cash first: 4.2m, up. Revenue grew 11%. Debt fell to 0.6m.', cut: 'Cash first: 4.2m, up. Revenue grew 11%. De', ramble: null, req: 'RESULTS TONE TASK', fail: { RESULTS: 'The year was solid and the company is in good shape.', TONE: 'Wow, what a year! Tons of money came in and the debt is basically gone!', noise: 'Press coverage was warm, and last year the accounts told a different story...' }, best: { pack: { res: 'excerpt', rules: 'excerpt', ask: 'full' }, dial: 'full' } }, ACC('essential'))),
  ]);

  // ====================================================================== K3 · COMPRESS, DON'T DELETE (phase 2)
  // one document, two requests: a summary keeps the general rule and loses the clause; an excerpt keeps the quoted clause and loses the rule (or the reverse, per ticket)
  const K3_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The compressed version dropped the part this question turns on, so the reply was generic.', overstuffed: 'Old and unrelated pages went in beside the right one, which cost tokens and blurred the answer.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K3_IDEA = "Compress, don't delete: a summary and an excerpt keep different things, so pick the version that keeps what the task needs.";
  const POLICY = (cov) => [
    E('pol', 'Travel and expenses', 'Flights and hotels are reimbursed. Clause 7: {role}...', [240, 90, 45], cov, ['the clause on {role}', cov[2] === 'RULE EXCEPTION' ? 'the text around the clauses' : 'the general rule']),
    N('form', 'Expense form layout', 'Boxes for date, amount, receipt and approver', 60),
    N('old', 'Old policy 2019', 'Travel rules from 2019, replaced in 2023...', 90),
    N('appr', 'Approver list', 'Who signs claims in each region...', 26),
    N('memo', 'Finance memo', 'Reminder: submit claims by the 5th of the month', 18),
    A('Answer the question'),
  ];
  const REMOTE = (cov) => [
    E('pol', 'Remote work policy', 'Remote days are allowed. Clause 4: {role}...', [220, 84, 40], cov, ['the clause on {role}', cov[2] === 'RULE CLAUSE' ? 'the text around the clauses' : 'the general rule']),
    N('seat', 'Office seating plan', 'Desk map for floors two and three...', 58),
    N('old', 'Old policy 2020', 'Remote rules from 2020, before the new tools...', 84),
    N('equip', 'Equipment list', 'Laptop, monitor and chair models issued...', 28),
    N('help', 'Helpdesk memo', 'Call the helpdesk if your VPN drops...', 20),
    A('Answer the question'),
  ];
  const K3_1 = Or('K3-1', 'Same policy, two needs', K3_IDEA, K3_BR, [
    V('K3-1a', 2, { role: ['contractors', 'interns', 'volunteers'] }, { twin: 'K3-1b' }, T({ rq: 'Can {role} claim travel costs?', need: 'short', good: 'Yes, but only under clause 7: pre-approved trips, economy fares.', cut: 'Yes, but only under clau', ramble: 'Yes, but only under clause 7: pre-approved trips, economy fares. Keep receipts. Claims close on the 5th. Ask finance if unsure.', req: 'EXCEPTION TASK', fail: { EXCEPTION: 'Everyone can claim flights and hotels, so yes.', noise: 'The old 2019 policy and the expense form both say a lot about receipts...' }, best: { pack: { pol: 'excerpt', ask: 'full' }, dial: 'short' } }, POLICY(['RULE EXCEPTION', 'RULE', 'RULE EXCEPTION']))),
    V('K3-1b', 2, { role: ['contractors', 'interns', 'volunteers'], item: ['flights', 'hotels'] }, { twin: 'K3-1a' }, T({ rq: 'Do employees get {item} reimbursed?', need: 'short', good: 'Yes: {item} are reimbursed for employees.', cut: 'Yes: {item} are reimb', ramble: 'Yes: {item} are reimbursed for employees. Keep receipts. Claims close on the 5th. Ask finance if unsure.', req: 'RULE TASK', fail: { RULE: 'Only a special clause covers some people, so it depends.', noise: 'The old 2019 policy and the expense form both say a lot about receipts...' }, best: { pack: { pol: 'summary', ask: 'full' }, dial: 'short' } }, POLICY(['RULE EXCEPTION', 'RULE', 'EXCEPTION']))),
  ]);
  const K3_2 = Or('K3-2', 'Same handbook, two needs', K3_IDEA, K3_BR, [
    V('K3-2a', 2, { role: ['interns', 'contractors', 'new starters'] }, { twin: 'K3-2b' }, T({ rq: 'Can {role} work remotely on Fridays?', need: 'short', good: 'Only under clause 4: on a manager-approved Friday.', cut: 'Only under clause 4: on a manager-app', ramble: 'Only under clause 4: on a manager-approved Friday. Ask early. Equipment stays at the office. Check with your manager.', req: 'CLAUSE TASK', fail: { CLAUSE: 'Remote days are allowed, so Fridays are fine.', noise: 'The old 2020 policy and the seating plan say a lot about desks...' }, best: { pack: { pol: 'excerpt', ask: 'full' }, dial: 'short' } }, REMOTE(['RULE CLAUSE', 'RULE', 'RULE CLAUSE']))),
    V('K3-2b', 2, { role: ['interns', 'contractors', 'new starters'] }, { twin: 'K3-2a' }, T({ rq: 'Roughly how many remote days does the policy allow?', need: 'short', good: 'Up to two remote days a week for most staff.', cut: 'Up to two remote days a w', ramble: 'Up to two remote days a week for most staff. Fridays need approval. Equipment stays at the office. Ask your manager.', req: 'RULE TASK', fail: { RULE: 'A special clause covers some staff, so check with your manager.', noise: 'The old 2020 policy and the seating plan say a lot about desks...' }, best: { pack: { pol: 'summary', ask: 'full' }, dial: 'short' } }, REMOTE(['RULE CLAUSE', 'RULE', 'CLAUSE']))),
  ]);

  // ====================================================================== K4 · RETRIEVE THE RELEVANT BIT (phase 2)
  const K4_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The version taken from the big output lacked the part the question needs, so the reply guessed.', overstuffed: 'An old export and its copies went in with the right one, which cost tokens and blurred the answer.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K4_IDEA = 'Fetch the bit, not the haystack: pull the record or the counts the task needs out of a huge output.';
  const EXPORT = (cov) => [
    E('exp', 'Ticket export', 'Fifty ticket rows: id, owner, status, dates', [380, 110, 30], cov, ['each ticket row', 'the totals and the other rows']),
    N('guide', 'Export column guide', 'Columns: id, owner, status, opened, closed...', 52),
    N('last', "Last month's export", 'The September export, forty-six rows...', 350),
    D('prev', 'Export, text preview', 'The first twelve rows of the same export', 60, 'RECORD'),
    N('rota', 'Support rota', 'Who answers tickets on which day...', 22),
    A('Answer the question'),
  ];
  const LOG = (cov) => [
    E('log', 'Server log', 'Two hours of job lines: time, job, level, text', [300, 95, 28], cov, ['the line for each job', 'the trend and the other lines']),
    N('cfg', 'Job config', 'Retry limits, queue names and timeouts...', 70),
    N('old', "Yesterday's log", 'The log from yesterday, three hours...', 320),
    D('prev', 'Log, tail preview', 'The last twenty lines of the same log', 58, 'ERROR'),
    N('rota', 'On-call rota', 'Who is on call this week and next...', 18),
    A('Answer the question'),
  ];
  const K4_1 = Or('K4-1', 'Same export, two needs', K4_IDEA, K4_BR, [
    V('K4-1a', 2, { tck: ['TCK-88', 'TCK-142', 'TCK-31'] }, { twin: 'K4-1b' }, T({ rq: 'What is the status of ticket {tck}?', need: 'short', good: '{tck} is open, owned by Dana, waiting on the customer.', cut: '{tck} is open, owned by Dana, wait', ramble: '{tck} is open, owned by Dana, waiting on the customer. It was opened on 3 Nov. Last reply was yesterday. Tell me if you need more.', req: 'RECORD TASK', fail: { RECORD: 'Most tickets are open or waiting, so probably still open.', noise: 'The export columns are id, owner, status, opened and closed, and last month had more...' }, best: { pack: { exp: 'excerpt', ask: 'full' }, dial: 'short' } }, EXPORT(['RECORD COUNTS', 'COUNTS', 'RECORD']))),
    V('K4-1b', 2, { what: ['open', 'waiting', 'closed'] }, { twin: 'K4-1a' }, T({ rq: 'How many tickets are {what}?', need: 'short', good: '{what}: 17 of the 50 tickets.', cut: '{what}: 17 of the', ramble: '{what}: 17 of the 50 tickets. The rest are in other states. The export has the full split. Tell me if you need more.', req: 'COUNTS TASK', fail: { COUNTS: 'A fair number of tickets are open, maybe a dozen or so.', noise: 'The export columns are id, owner, status, opened and closed, and last month had more...' }, best: { pack: { exp: 'summary', ask: 'full' }, dial: 'short' } }, EXPORT(['RECORD COUNTS', 'COUNTS', 'RECORD']))),
  ]);
  const K4_2 = Or('K4-2', 'Same log, two needs', K4_IDEA, K4_BR, [
    V('K4-2a', 2, { job: ['5521', '5530', '4890'] }, { twin: 'K4-2b' }, T({ rq: 'What error did job {job} hit?', need: 'short', good: 'Job {job} hit a timeout on the payments queue at 14:07.', cut: 'Job {job} hit a timeout on the', ramble: 'Job {job} hit a timeout on the payments queue at 14:07. It retried twice. The queue was busy. Tell me if you need more.', req: 'ERROR TASK', fail: { ERROR: 'Jobs sometimes fail for ordinary reasons; check the config.', noise: 'The retry limits are in the config, and yesterday had a longer log...' }, best: { pack: { log: 'excerpt', ask: 'full' }, dial: 'short' } }, LOG(['ERROR TREND', 'TREND', 'ERROR']))),
    V('K4-2b', 2, { hour: ['2pm', '1pm', '3pm'] }, { twin: 'K4-2a' }, T({ rq: 'Did errors rise after {hour}?', need: 'short', good: 'Yes: errors went from 3 an hour to 11 after {hour}.', cut: 'Yes: errors went from 3 an h', ramble: 'Yes: errors went from 3 an hour to 11 after {hour}. The jump began on the payments queue. Check the config. Tell me if you need more.', req: 'TREND TASK', fail: { TREND: 'Errors come and go, so hard to say.', noise: 'The retry limits are in the config, and yesterday had a longer log...' }, best: { pack: { log: 'summary', ask: 'full' }, dial: 'short' } }, LOG(['ERROR TREND', 'TREND', 'ERROR']))),
  ]);

  // ====================================================================== K5 · CONTINUE VS START FRESH (phase 2, a chain of two tickets)
  // A: a short chat. The residue (about 116) already holds the order and the greeting rule; the transcript summary would lose the greeting rule, so CONTINUE.
  // B: a long chat. The residue (about 234) cannot fit the new crates; the summary keeps what turn 2 needs, so WIPE and load the summary.
  const K5_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The detail the follow-up needs was lost when the chat was wiped and summarised.', overstuffed: 'The old chat and its transcript went in together, so the history was paid for twice.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K5_IDEA = 'A chat resends its history every turn and you pay again; continue when the details matter, start fresh with a summary when it is long.';
  const THREAD = (slot, tr, ship, wh) => [
    E('ship', ship[0], ship[1], [30, 14, 10], ship[2], ['the courier name', 'the courier name and the time zone']),
    Y('tr', 'Chat so far', tr, [170, 40, 22], [slot + ' NAMEPREF', slot, ''], ['the greeting rule and the tone', 'almost everything']),
    N('t1', wh[0], wh[1], 58),
    N('t2', wh[2], wh[3], 66),
    D('dup', wh[4], wh[5], 28, ship[2]),
    E('ask', 'Ask line', 'Reply with the date', 14, 'TASK2'),
  ];
  const ORDERS_P = { name: pick(0, 4, 6), ref: ['A17', 'B42', 'C09'] };
  const shipA = ['Shipping record', 'Courier pick-up Thursday 14:00', 'SHIP'];
  const whA = ['Courier terms', 'Courier liability is limited to the declared...', 'Returns policy', 'Items can be returned within thirty days of...', 'Shipping label copy', 'Same pick-up slot as printed on the label'];
  const prior1A = T({ rq: '{name} asks where order {ref} is.', need: 'short', good: '{name}, order {ref} is packed and waiting for pick-up.', cut: '{name}, order {ref} is packed and wai', ramble: '{name}, order {ref} is packed and waiting for pick-up. It is in the front bay. Pick-ups are daily. Tell me if you need more.', req: 'ORDER NAMEPREF TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { ORDER: 'We are looking into your order and will be in touch.', NAMEPREF: 'Dear Customer, your order is packed and waiting.', noise: 'Our courier also offers weekend delivery, and the promo runs until...' }, best: { pack: { rec: 'full', note: 'full', ask: 'full' }, dial: 'short' } }, [
    E('rec', 'Order record', '{ref}: packed Tuesday, waiting for pick-up', 30, 'ORDER'),
    E('note', 'Customer note', 'Greet {name} by first name, no titles.', 22, 'NAMEPREF'),
    H('rules', 'House rules', 'Short, warm, no promises about dates', 25, 'TONE'),
    N('promo', 'Carrier promo', 'Our courier also offers weekend delivery for...', 28),
    D('dup', 'Order record, slip copy', 'Same order as a packing slip', 32, 'ORDER'),
    A('Reply with where the order is'),
  ]);
  const prior1B = T({ rq: '{name} asks for a full status of order {ref}.', need: 'full', good: '{name}, order {ref} has three lines: two shipped, one backordered until Friday...', cut: '{name}, order {ref} has three lines: two shi', req: 'ORDER TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { ORDER: 'We are looking into your order and will be in touch.', noise: 'Our courier also offers weekend delivery, and the backorder list is long...' }, best: { pack: { rec: 'full', ask: 'full' }, dial: 'full' } }, [
    E('rec', 'Order record', '{ref}: three lines, two shipped, one backordered', 100, 'ORDER'),
    H('rules', 'House rules', 'Short, warm, no promises about dates', 25, 'TONE'),
    N('promo', 'Carrier promo', 'Our courier also offers weekend delivery for...', 28),
    N('back', 'Backorder list', 'Twenty items waiting on the next delivery...', 70),
    D('dup', 'Order record, slip copy', 'Same order as a packing slip', 36, 'ORDER'),
    A('Reply with the full status'),
  ]);
  const turn2 = (o, chunks) => T(Object.assign({ rq: '{name}: and when will it ship?', need: 'short', good: '{name}, it ships Thursday at 14:00 with the courier.', cut: '{name}, it ships Thursday at 1', ramble: '{name}, it ships Thursday at 14:00 with the courier. The courier is reliable. You will get a tracking link. Tell me if you need more.', chat: { id: '{name}', turn: 2 } }, o), chunks);
  const K5_1 = Or('K5-1', 'Follow-up: the parcel', K5_IDEA, K5_BR, [
    V('K5-1a', 2, ORDERS_P, { twin: 'K5-1b', prior: prior1A, gap: 19 }, turn2({ req: 'SHIP ORDER NAMEPREF TASK2', fail: { SHIP: 'It will ship soon; we do not have the slot yet.', ORDER: 'We could not tell which order you mean.', NAMEPREF: 'Dear Customer, your order ships Thursday.', noise: 'Courier liability is limited to the declared value, and returns take thirty days...' }, best: { cont: true, pack: { ship: 'excerpt', ask: 'full' }, dial: 'short' } }, THREAD('ORDER', 'Customer asked where {ref} is; we said it is...', shipA, whA))),
    V('K5-1b', 2, ORDERS_P, { twin: 'K5-1a', prior: prior1B, gap: 19 }, turn2({ req: 'SHIP ORDER TASK2', fail: { SHIP: 'It will ship soon; we do not have the slot yet.', ORDER: 'We could not tell which order you mean.', noise: 'Courier liability is limited to the declared value, and returns take thirty days...' }, best: { cont: false, pack: { tr: 'summary', ship: 'excerpt', ask: 'full' }, dial: 'short' } }, THREAD('ORDER', 'Customer asked where {ref} is; we said it is...', shipA, whA))),
  ]);
  const shipB = ['Room calendar', '{ref}: Tue 10:00 free, Tue 14:00 booked', 'SLOT'];
  const whB = ['Room cleaning rota', 'Cleaning happens on Mondays and Thursdays...', 'Catering menu', 'Sandwich platters, fruit bowls and hot drinks...', 'Calendar, wall display', 'Same free slots as on the wall display'];
  const ROOMS_P = { name: pick(5, 7, 8), ref: ['Orchard', 'Cedar', 'Harbour'] };
  const prior2A = T({ rq: '{name} asks which room fits twelve people.', need: 'short', good: '{name}, the {ref} room seats twelve, on floor two.', cut: '{name}, the {ref} room seats tw', ramble: '{name}, the {ref} room seats twelve, on floor two. It has a screen. It is quiet. Tell me if you need a bigger one.', req: 'ROOM NAMEPREF TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { ROOM: 'Most of our rooms fit around eight people.', NAMEPREF: 'Dear Sir or Madam, the room seats twelve.', noise: 'The catering menu has sandwich platters, fruit bowls and hot drinks...' }, best: { pack: { rec: 'full', note: 'full', ask: 'full' }, dial: 'short' } }, [
    E('rec', 'Room list', '{ref}: 12 seats. Other rooms: 8 and 20 seats', 30, 'ROOM'),
    E('note', 'Customer note', 'Greet {name} by first name, no titles.', 22, 'NAMEPREF'),
    H('rules', 'Booking rules', 'Mention the floor and the seat count', 25, 'TONE'),
    N('menu', 'Catering menu', 'Sandwich platters, fruit bowls and hot drinks...', 30),
    D('dup', 'Room list, floor plan', 'Same rooms as a short floor plan', 30, 'ROOM'),
    A('Reply with the room name'),
  ]);
  const prior2B = T({ rq: '{name} asks for every room and what each one has.', need: 'full', good: '{name}: {ref} seats twelve with a screen; two other rooms seat eight and twenty...', cut: '{name}: {ref} seats twelve with a screen; two ot', req: 'ROOM TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { ROOM: 'Most of our rooms fit around eight people.', noise: 'The catering menu has sandwich platters, fruit bowls and hot drinks...' }, best: { pack: { rec: 'full', ask: 'full' }, dial: 'full' } }, [
    E('rec', 'Room list', '{ref}: 12 seats, screen. Others: 8 and 20 seats', 100, 'ROOM'),
    H('rules', 'Booking rules', 'Mention the floor and the seat count', 25, 'TONE'),
    N('menu', 'Catering menu', 'Sandwich platters, fruit bowls and hot drinks...', 30),
    N('av', 'AV hire prices', 'Projector 40, speakers 25, microphone 15...', 70),
    D('dup', 'Room list, floor plan', 'Same rooms as a short floor plan', 36, 'ROOM'),
    A('Reply with every room'),
  ]);
  const K5_2 = Or('K5-2', 'Follow-up: the room', K5_IDEA, K5_BR, [
    V('K5-2a', 2, ROOMS_P, { twin: 'K5-2b', prior: prior2A, gap: 19 }, turn2({ rq: '{name}: can we book it for Tuesday?', good: '{name}, yes: the {ref} room is free on Tuesday at 10:00.', cut: '{name}, yes: the {ref} room is fr', ramble: '{name}, yes: the {ref} room is free on Tuesday at 10:00. The afternoon is booked. Book early. Tell me if you need a second room.', req: 'SLOT ROOM NAMEPREF TASK2', fail: { SLOT: 'We cannot tell when the room is free yet.', ROOM: 'We could not tell which room you mean.', NAMEPREF: 'Dear Sir or Madam, it is free on Tuesday.', noise: 'Cleaning happens on Mondays and Thursdays, and the catering menu is long...' }, best: { cont: true, pack: { ship: 'excerpt', ask: 'full' }, dial: 'short' } }, THREAD('ROOM', 'Customer asked for a room for twelve; we said...', shipB, whB))),
    V('K5-2b', 2, ROOMS_P, { twin: 'K5-2a', prior: prior2B, gap: 19 }, turn2({ rq: '{name}: can we book it for Tuesday?', good: '{name}, yes: the {ref} room is free on Tuesday at 10:00.', cut: '{name}, yes: the {ref} room is fr', ramble: '{name}, yes: the {ref} room is free on Tuesday at 10:00. The afternoon is booked. Book early. Tell me if you need a second room.', req: 'SLOT ROOM TASK2', fail: { SLOT: 'We cannot tell when the room is free yet.', ROOM: 'We could not tell which room you mean.', noise: 'Cleaning happens on Mondays and Thursdays, and the catering menu is long...' }, best: { cont: false, pack: { tr: 'summary', ship: 'excerpt', ask: 'full' }, dial: 'short' } }, THREAD('ROOM', 'Customer asked for every room; we listed them...', shipB, whB))),
  ]);

  // ====================================================================== K6 · STALE CONTEXT BLEEDS (phase 2, follows the K5 chain)
  // the pot left behind by the K5 customer holds that customer's order; a ticket from someone else must not use it
  const K6_BR = { bleed: "The pot still held another customer's order, so its details leaked into this reply.", missing: 'A fact this customer needs never reached the pot, so the reply was generic.', overstuffed: 'Extra pages went in with the right one, which cost tokens and blurred the answer.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K6_IDEA = "Leftovers from another customer's chat can bleed into the next answer and leak private details; wipe or use a clean pot.";
  const BLEED = '{name}, here is your answer. Also, {otherName}\'s order {otherRef} ships Thursday.';
  const REFUND = (pol) => [
    E('rec', 'Refund record', '{ref}: approved 3 Nov, paid to card, 5 days', [28, 14, 9], 'REFUND', ['the approval date', 'the approval date and the card']),
    H('greet', 'Greeting rule', 'Greet by first name, one warm sentence', 24, 'TONE'),
    as(pol, ch(pol, 'pol', 'Refund policy', 'Refunds reach cards in up to five working days', [70, 32, 18], 'POLICY', ['the exceptions', 'the exceptions and the wording'])),
    D('dup', 'Refund record, card copy', 'Same refund as shown on the card statement', 26, 'REFUND'),
    N('net', 'Card network notice', 'Network rules for chargebacks and disputes...', 54),
    A('Reply with the refund status'),
  ];
  const ADDR = (pol) => [
    E('rec', 'Order record', '{ref}: leaves the depot Friday, address editable until then', [30, 16, 9], 'CHANGE', ['the cut-off time', 'the cut-off time and the depot']),
    H('greet', 'Greeting rule', 'Greet by first name, one warm sentence', 24, 'TONE'),
    as(pol, ch(pol, 'priv', 'Privacy rule', 'Confirm only the last three digits of any address', [60, 28, 16], 'PRIVACY', ['the examples', 'the examples and the reason'])),
    D('dup', 'Order record, label copy', 'Same order as printed on the shipping label', 26, 'CHANGE'),
    N('map', 'Depot map', 'Loading bays, gates and parking for the depot...', 64),
    A('Reply about the address change'),
  ];
  const K6_1 = Or('K6-1', 'Another customer: refunds', K6_IDEA, K6_BR, [
    V('K6-1a', 2, { name: pick(1, 2, 9), ref: ['R-552', 'R-610', 'R-473'] }, { twin: 'K6-1b', after: 'K5' }, T({ rq: '{name} asks about refund {ref}.', need: 'short', good: '{name}, refund {ref} is approved and paid to your card.', cut: '{name}, refund {ref} is approved and p', ramble: '{name}, refund {ref} is approved and paid to your card. It takes five days. Check your statement. Tell me if you need more.', req: 'REFUND TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { REFUND: 'Your refund is being processed and you will hear from us.', noise: 'The card network has rules on chargebacks and disputes, which we follow...', bleed: BLEED }, best: { fresh: true, pack: { rec: 'excerpt', ask: 'full' }, dial: 'short' } }, REFUND('noise'))),
    V('K6-1b', 2, { name: pick(1, 2, 9), ref: ['R-552', 'R-610', 'R-473'] }, { twin: 'K6-1a', after: 'K5' }, T({ rq: '{name} asks why refund {ref} took five days.', need: 'short', good: '{name}, refunds reach cards in up to five working days; {ref} was paid.', cut: '{name}, refunds reach cards in up to five wor', ramble: '{name}, refunds reach cards in up to five working days, and {ref} was paid. Banks vary. Check your statement. Ask if unsure.', req: 'REFUND POLICY TASK', chat: { id: '{name}', turn: 1 }, fail: { REFUND: 'Your refund is being processed and you will hear from us.', POLICY: 'Banks are just slow sometimes; we are not sure why.', noise: 'The card network has rules on chargebacks and disputes, which we follow...', bleed: BLEED }, best: { fresh: true, pack: { rec: 'excerpt', pol: 'excerpt', ask: 'full' }, dial: 'short' } }, REFUND('essential'))),
  ]);
  const K6_2 = Or('K6-2', 'Another customer: addresses', K6_IDEA, K6_BR, [
    V('K6-2a', 2, { name: pick(1, 2, 9), ref: ['O-31', 'O-58', 'O-77'] }, { twin: 'K6-2b', after: 'K5' }, T({ rq: '{name} wants to change the delivery address on {ref}.', need: 'short', good: '{name}, yes: the address on {ref} can change until Friday.', cut: '{name}, yes: the address on {ref} can cha', ramble: '{name}, yes: the address on {ref} can change until Friday. Send it by reply. We will confirm. Tell me if you need more.', req: 'CHANGE TASK', help: 'TONE', chat: { id: '{name}', turn: 1 }, fail: { CHANGE: 'We will look into whether the address can be changed.', noise: 'The depot has loading bays, gates and parking in three zones...', bleed: BLEED }, best: { fresh: true, pack: { rec: 'excerpt', ask: 'full' }, dial: 'short' } }, ADDR('noise'))),
    V('K6-2b', 2, { name: pick(1, 2, 9), ref: ['O-31', 'O-58', 'O-77'] }, { twin: 'K6-2a', after: 'K5' }, T({ rq: '{name} wants to change the delivery address on {ref}, and confirm it.', need: 'short', good: '{name}, done: {ref} now ends in 214. It leaves Friday.', cut: '{name}, done: {ref} now ends in 2', ramble: '{name}, done: {ref} now ends in 214. It leaves Friday. We never show a full address. Tell me if you need more.', req: 'CHANGE PRIVACY TASK', chat: { id: '{name}', turn: 1 }, fail: { CHANGE: 'We will look into whether the address can be changed.', PRIVACY: '{name}, done: {ref} now goes to 14 Marlow Lane, Westbury.', noise: 'The depot has loading bays, gates and parking in three zones...', bleed: BLEED }, best: { fresh: true, pack: { rec: 'excerpt', priv: 'excerpt', ask: 'full' }, dial: 'short' } }, ADDR('essential'))),
  ]);

  // ====================================================================== K8 · OVERFLOW LOSES SOMETHING (phase 3, the oldest-first pot)
  // the oldest items pop out when the pot is over capacity: the rules, dropped first, are the first to go. The twin needs the policy quoted, which only the full text keeps.
  const K8_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The pot overflowed, the oldest chunk popped out, and the reply lost the rule it depended on.', overstuffed: 'Old promos and clutter went in beside the facts, which cost tokens and crowded the pot.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'A longer reply than the task needs is still paid for, word by word.' };
  const K8_IDEA = 'When the pot is full the oldest content drops first, so never overflow and keep the rules recent.';
  const DELIV = (cov) => [
    E('rules', 'House rules', 'Never promise a date. Say what we know.', [60, 30, 16], 'RULE', ['the say-what-we-know line', 'the second sentence']),
    E('pol', 'Delivery policy', 'Standard post takes 3 to 5 working days...', [80, 40, 20], cov, ['the exact wording', 'the exact wording and the exceptions']),
    E('msg', "{name}'s message", 'Hi, where is my parcel? It is already late!', [50, 26, 14], 'MSG', ['the tone of the message', 'the tone and the details']),
    N('promo', 'Old promo email', 'Spring sale: 20% off all notebooks until...', 70),
    N('depot', 'Courier address list', 'Depot addresses in the north and south...', 22),
    A('Reply to the customer'),
  ];
  const REFD = (cov) => [
    E('rules', 'House rules', 'Never promise a refund before approval.', [60, 30, 16], 'RULE', ['the approval step', 'the approval step and the reason']),
    E('pol', 'Refund policy', 'Refunds need approval, then take 5 working days', [80, 40, 20], cov, ['the exact wording', 'the exact wording and the exceptions']),
    E('msg', "{name}'s message", 'Hi, where is my refund? It has been a week!', [50, 26, 14], 'MSG', ['the tone of the message', 'the tone and the details']),
    N('promo', 'Old promo email', 'Autumn sale: free shipping on orders over...', 70),
    N('net', 'Card network notice', 'Network rules for chargebacks and disputes...', 24),
    A('Reply to the customer'),
  ];
  const NM = pick(3, 10, 11);
  const K8_1 = Or('K8-1', 'Rules fall out: delivery', K8_IDEA, K8_BR, [
    V('K8-1a', 3, { name: NM }, { twin: 'K8-1b' }, T({ rq: 'Reply to {name} about delivery.', need: 'short', good: '{name}, it is on its way; the usual post takes 3 to 5 days.', cut: '{name}, it is on its way; the usual p', ramble: '{name}, it is on its way; the usual post takes 3 to 5 days. We are sorry for the wait. We keep you posted. Tell me if you need more.', req: 'RULE POLICY MSG TASK', fail: { RULE: 'Your parcel will arrive on Thursday, guaranteed.', POLICY: 'Delivery takes however long it takes.', MSG: 'Thanks for your message about something.', noise: 'Our spring sale is on, with 20% off all notebooks, and the depot addresses are...' }, best: { pack: { rules: 'excerpt', pol: 'excerpt', msg: 'excerpt', ask: 'full' }, dial: 'short' } }, DELIV('POLICY'))),
    V('K8-1b', 3, { name: NM }, { twin: 'K8-1a' }, T({ rq: 'Reply to {name} about delivery, and quote the policy.', need: 'short', good: '{name}: "Standard post takes 3 to 5 working days." No date promised.', cut: '{name}: "Standard post takes 3 to 5 work', ramble: '{name}: "Standard post takes 3 to 5 working days." No date is promised. We are sorry. We keep you posted. Tell me if you need more.', req: 'RULE POLICY QUOTE MSG TASK', fail: { RULE: 'Your parcel will arrive on Thursday, guaranteed.', POLICY: 'Delivery takes however long it takes.', QUOTE: '{name}, our policy says it takes a few days, more or less.', MSG: 'Thanks for your message about something.', noise: 'Our spring sale is on, with 20% off all notebooks, and the depot addresses are...' }, best: { pack: { rules: 'excerpt', pol: 'full', msg: 'excerpt', ask: 'full' }, dial: 'short' } }, DELIV('POLICY QUOTE').map((c) => (c.id === 'pol' ? Object.assign({}, c, { covers: { full: ['POLICY', 'QUOTE'], summary: ['POLICY'], excerpt: ['POLICY'] } }) : c)))),
  ]);
  const K8_2 = Or('K8-2', 'Rules fall out: refunds', K8_IDEA, K8_BR, [
    V('K8-2a', 3, { name: pick(3, 10, 11) }, { twin: 'K8-2b' }, T({ rq: 'Reply to {name} about the refund.', need: 'short', good: "{name}, it is with approval; once approved it takes 5 working days.", cut: '{name}, it is with approval; once appr', ramble: '{name}, it is with approval; once approved it takes 5 working days. We are sorry for the wait. We keep you posted. Tell me if you need more.', req: 'RULE POLICY MSG TASK', fail: { RULE: 'Your refund will land in your account by Friday, guaranteed.', POLICY: 'Refunds take however long they take.', MSG: 'Thanks for your message about something.', noise: 'Our autumn sale gives free shipping, and card networks have rules on disputes...' }, best: { pack: { rules: 'excerpt', pol: 'excerpt', msg: 'excerpt', ask: 'full' }, dial: 'short' } }, REFD('POLICY'))),
    V('K8-2b', 3, { name: pick(3, 10, 11) }, { twin: 'K8-2a' }, T({ rq: 'Reply to {name} about the refund, and quote the policy.', need: 'short', good: '{name}: "Refunds need approval, then take 5 working days." No date promised.', cut: '{name}: "Refunds need approval, then take 5 wor', ramble: '{name}: "Refunds need approval, then take 5 working days." No date is promised. We are sorry. We keep you posted. Tell me if you need more.', req: 'RULE POLICY QUOTE MSG TASK', fail: { RULE: 'Your refund will land in your account by Friday, guaranteed.', POLICY: 'Refunds take however long they take.', QUOTE: '{name}, our policy says it takes a few days, more or less.', MSG: 'Thanks for your message about something.', noise: 'Our autumn sale gives free shipping, and card networks have rules on disputes...' }, best: { pack: { rules: 'excerpt', pol: 'full', msg: 'excerpt', ask: 'full' }, dial: 'short' } }, REFD('POLICY QUOTE').map((c) => (c.id === 'pol' ? Object.assign({}, c, { covers: { full: ['POLICY', 'QUOTE'], summary: ['POLICY'], excerpt: ['POLICY'] } }) : c)))),
  ]);

  // ====================================================================== K9 · REUSE A STABLE PREFIX (phase 3, a pair of tickets that share one stable chunk)
  // gap 40 s: the prepped stock is still good for the second ticket (stock lasts 60 s); gap 64 s: it has expired, so prepping it saves nothing (90 s, the first draft, cannot
  // happen inside a 255 s shift whose phase 3 is the last 76 s). The stable chunk has no
  // compressed version that keeps the rules, so shrinking it is a trap.
  const K9_BR = { bleed: "A chunk from another customer's order was in the pot, so their details leaked.", missing: 'The rules were shrunk or left out, so the reply broke a house rule.', overstuffed: 'A copy of the rules and old clutter went in beside the real ones, which cost tokens.', cutoff: 'The reply length was set below what the answer needs, so it stopped early.', rambling: 'The task asked for one line; the longer reply was paid for and nobody needed it.' };
  const K9_IDEA = 'A stable, identical start can be reused cheaply for a short while; change it, or wait too long, and the saving is gone.';
  const STABLE1 = (msg, who) => [
    S('rules', 'House rules + policy', 'Never promise dates. Refunds need approval. Be warm.', [180, 90, 50], ['RULES', '', ''], ['half the rules', 'the refund rule']),
    E('msg', 'Customer message', msg, [40, 20, 10], 'MSG', ['the tone of the message', 'the tone and the details']),
    N('promo', 'Old promo email', 'Winter sale: 15% off all notebooks until...', 64),
    N('rota', 'Staff rota', 'Who is on the phones this week...', 20),
    D('dup', 'Rules, wiki copy', 'The same rules, copied from the wiki', 176, 'RULES'),
    A('Reply in one line'),
  ];
  const STABLE2 = (msg) => [
    S('rules', 'Tone sheet + footer', 'Warm tone. Never name staff. Add the legal footer.', [170, 85, 48], ['RULES', '', ''], ['the legal footer', 'the footer and the tone']),
    E('msg', 'Candidate message', msg, [40, 20, 10], 'MSG', ['the tone of the message', 'the tone and the details']),
    N('promo', 'Careers fair flyer', 'Meet us at the spring careers fair, stand 12...', 62),
    N('rota', 'Interview rota', 'Which panel sits on which day this month...', 20),
    D('dup', 'Tone sheet, wiki copy', 'The same tone rules, copied from the wiki', 166, 'RULES'),
    A('Reply in one line'),
  ];
  const k9t = (o, chunks) => T(Object.assign({ need: 'line', req: 'RULES MSG TASK' }, o), chunks);
  const P9 = () => ({ name: pick(4, 6, 8), name2: pick(5, 7, 11) });
  const K9_1 = Or('K9-1', 'Reuse the rules: delivery', K9_IDEA, K9_BR, [
    V('K9-1a', 3, P9(), { twin: 'K9-1b', gap: 40, prior: k9t({ rq: 'Reply to {name} about delivery, in one line.', good: 'On its way; no date promised, usual post is 3 to 5 days.', ramble: 'It is on its way. We cannot promise a date. The usual post is 3 to 5 days. Tell me if you need more.', fail: { RULES: 'It will arrive on Thursday, guaranteed.', MSG: 'Thanks for your message.', noise: 'Our winter sale gives 15% off notebooks, and the rota is...' }, best: { stock: true, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE1('{name}: where is my parcel? It is late.')) }, k9t({ rq: 'Reply to {name2} about a late refund, in one line.', good: 'With approval; no date promised, then 5 working days.', ramble: 'It is with approval. We cannot promise a date. Once approved it takes 5 working days. Tell me if you need more.', fail: { RULES: 'It will be in your account by Friday, guaranteed.', MSG: 'Thanks for your message.', noise: 'Our winter sale gives 15% off notebooks, and the rota is...' }, best: { stock: true, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE1('{name2}: when do I get my refund?'))),
    V('K9-1b', 3, P9(), { twin: 'K9-1a', gap: 64, prior: k9t({ rq: 'Reply to {name} about delivery, in one line.', good: 'On its way; no date promised, usual post is 3 to 5 days.', ramble: 'It is on its way. We cannot promise a date. The usual post is 3 to 5 days. Tell me if you need more.', fail: { RULES: 'It will arrive on Thursday, guaranteed.', MSG: 'Thanks for your message.', noise: 'Our winter sale gives 15% off notebooks, and the rota is...' }, best: { stock: false, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE1('{name}: where is my parcel? It is late.')) }, k9t({ rq: 'Reply to {name2} about a late refund, in one line.', good: 'With approval; no date promised, then 5 working days.', ramble: 'It is with approval. We cannot promise a date. Once approved it takes 5 working days. Tell me if you need more.', fail: { RULES: 'It will be in your account by Friday, guaranteed.', MSG: 'Thanks for your message.', noise: 'Our winter sale gives 15% off notebooks, and the rota is...' }, best: { stock: false, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE1('{name2}: when do I get my refund?'))),
  ]);
  const K9_2 = Or('K9-2', 'Reuse the rules: tone sheet', K9_IDEA, K9_BR, [
    V('K9-2a', 3, P9(), { twin: 'K9-2b', gap: 40, prior: k9t({ rq: 'Reply to {name} about the interview, in one line.', good: 'Warm thanks; your interview is booked, the footer is attached.', ramble: 'Thank you for applying. Your interview is booked. The legal footer is attached. Tell me if you need more.', fail: { RULES: 'Hi {name}, Sam from HR will call you about the interview.', MSG: 'Thanks for getting in touch.', noise: 'Meet us at the careers fair, and the interview rota shows which panel sits when...' }, best: { stock: true, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE2('{name}: can I move my interview to Friday?')) }, k9t({ rq: 'Reply to {name2} about the offer, in one line.', good: 'Warm thanks; the offer letter is on its way, the footer is attached.', ramble: 'Thank you for your patience. The offer letter is on its way. The legal footer is attached. Tell me if you need more.', fail: { RULES: 'Hi {name2}, Sam from HR sent your offer letter today.', MSG: 'Thanks for getting in touch.', noise: 'Meet us at the careers fair, and the interview rota shows which panel sits when...' }, best: { stock: true, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE2('{name2}: when will I get my offer letter?'))),
    V('K9-2b', 3, P9(), { twin: 'K9-2a', gap: 64, prior: k9t({ rq: 'Reply to {name} about the interview, in one line.', good: 'Warm thanks; your interview is booked, the footer is attached.', ramble: 'Thank you for applying. Your interview is booked. The legal footer is attached. Tell me if you need more.', fail: { RULES: 'Hi {name}, Sam from HR will call you about the interview.', MSG: 'Thanks for getting in touch.', noise: 'Meet us at the careers fair, and the interview rota shows which panel sits when...' }, best: { stock: false, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE2('{name}: can I move my interview to Friday?')) }, k9t({ rq: 'Reply to {name2} about the offer, in one line.', good: 'Warm thanks; the offer letter is on its way, the footer is attached.', ramble: 'Thank you for your patience. The offer letter is on its way. The legal footer is attached. Tell me if you need more.', fail: { RULES: 'Hi {name2}, Sam from HR sent your offer letter today.', MSG: 'Thanks for getting in touch.', noise: 'Meet us at the careers fair, and the interview rota shows which panel sits when...' }, best: { stock: false, pack: { rules: 'full', msg: 'excerpt', ask: 'full' }, dial: 'line' } }, STABLE2('{name2}: when will I get my offer letter?'))),
  ]);

  const ORDERS = [K1_1, K1_2, K2_1, K2_2, K3_1, K3_2, K4_1, K4_2, K5_1, K5_2, K6_1, K6_2, K7_1, K7_2, K8_1, K8_2, K9_1, K9_2];
  // single-ticket variants may also be drawn as the "rush mix" order of phase 3; chained ones (K5, K6, K9) are not
  for (const o of ORDERS) o.rush = !['K5', 'K6', 'K9'].includes(o.concept);

  // the nine concepts, in the spec's order: id, title, skill and the one-line idea of their orders
  const TITLES = { K1: 'Budget and headroom', K2: 'Noise vs signal', K3: "Compress, don't delete", K4: 'Retrieve the relevant bit', K5: 'Continue vs start fresh', K6: 'Stale context bleeds', K7: 'Output length', K8: 'Overflow loses something', K9: 'Reuse a stable prefix' };
  const CONCEPTS = Object.keys(TITLES).map((id) => ({ id, title: TITLES[id], skill: SKILL_OF[id], idea: ORDERS.find((o) => o.concept === id).idea }));

  // ---- helpers ----
  const byId = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
  const VARIANTS = [];
  for (const o of ORDERS) for (const v of o.variants) {
    v.concept = o.concept; v.order = o.id; v.skill = o.skill; v.idea = o.idea; v.breaks = o.breaks; v.rush = !!o.rush;
    if (!v.failReplies.bleed) v.failReplies.bleed = 'Here is your answer. It also quotes another customer\'s private order details.';
    if (v.prior && !v.prior.failReplies.bleed) v.prior.failReplies.bleed = v.failReplies.bleed;
    VARIANTS.push(v);
  }
  const variantById = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));
  const fill = (s, p) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  // every string inside a value, filled from params (an object of name -> value); arrays and plain objects are copied, never shared
  const fillDeep = (x, p) => (typeof x === 'string' ? fill(x, p) : Array.isArray(x) ? x.map((y) => fillDeep(y, p)) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, fillDeep(y, p)])) : x);
  const expand = (variant, params) => fillDeep(Object.assign({}, variant, { params: undefined }), params);

  // the same fields as chunks carry, flattened: every slot id a variant mentions
  const slotIds = (t) => new Set([...t.slots.required, ...t.slots.helpful]);
  const TOKS = (c) => [c.tokens.full, c.tokens.summary, c.tokens.excerpt];
  const wordsOf = (s) => s.trim().split(/\s+/).length;
  // a list of every problem found in the bank (empty = fine); kitchen-tests.js asserts it is empty and layers the statistical and solver checks on top
  function validate() {
    const bad = [], add = (id, m) => bad.push(id + ': ' + m);
    if (ORDERS.length < LIMITS.minOrders) add('bank', 'fewer than ' + LIMITS.minOrders + ' orders');
    const perConcept = {};
    for (const v of VARIANTS) perConcept[v.concept] = (perConcept[v.concept] || 0) + 1;
    for (let k = 1; k <= 9; k++) if ((perConcept['K' + k] || 0) < LIMITS.minVariants) add('K' + k, 'fewer than ' + LIMITS.minVariants + ' variants');
    for (const o of ORDERS) {
      if (o.idea.length > LIMITS.idea) add(o.id, 'idea too long');
      for (const [k, s] of Object.entries(o.breaks)) if (s.length > LIMITS.brk) add(o.id, 'break ' + k + ' too long');
      if (!o.variants.length) add(o.id, 'no variants');
    }
    for (const v of VARIANTS) {
      const tickets = [[v.id, v]].concat(v.prior ? [[v.id + ' (prior)', v.prior]] : []);
      for (const [id, t] of tickets) {
        if (wordsOf(t.request) > LIMITS.words) add(id, 'request over ' + LIMITS.words + ' words');
        if (t.chunks.length > LIMITS.chunks || t.chunks.length < LIMITS.minChunks) add(id, t.chunks.length + ' chunks');
        const ids = new Set(), have = new Set();
        let asks = 0;
        for (const c of t.chunks) {
          if (ids.has(c.id)) add(id, 'duplicate chunk id ' + c.id); ids.add(c.id);
          if (c.label.length > LIMITS.label) add(id, 'label too long: ' + c.label);
          if (c.preview.length > LIMITS.preview) add(id, 'preview too long: ' + c.preview);
          if (!['essential', 'helpful', 'noise', 'duplicate', 'history', 'stable'].includes(c.role)) add(id, 'bad role ' + c.id);
          const [f, s, x] = TOKS(c);
          if (s != null && !(f > s)) add(id, c.id + ' summary not smaller than full');
          if (x != null && !(s != null ? s > x : f > x)) add(id, c.id + ' excerpt not smaller');
          if (s != null && !(c.lost && c.lost.summary)) add(id, c.id + ' summary has no "lost" text');
          if (x != null && !(c.lost && c.lost.excerpt)) add(id, c.id + ' excerpt has no "lost" text');
          for (const k of ['summary', 'excerpt']) if (c.lost && c.lost[k] && c.lost[k].length > LIMITS.lost) add(id, c.id + ' lost.' + k + ' too long');
          for (const arr of Object.values(c.covers)) for (const sl2 of arr) have.add(sl2);
          if (c.id === 'ask') asks++;
        }
        if (asks !== 1) add(id, 'needs exactly one ask line');
        for (const sid of slotIds(t)) if (!have.has(sid)) add(id, 'slot ' + sid + ' is covered by no chunk');
        for (const sid of t.slots.required) if (sid !== 'TASK' && !t.failReplies[sid]) add(id, 'no failReply for ' + sid);
        for (const k of Object.keys(t.failReplies)) if (t.failReplies[k].length > LIMITS.fail) add(id, 'failReply ' + k + ' too long');
        if (!t.failReplies.noise) add(id, 'no noise failReply');
        const L = t.reply.lines;
        for (const k of ['cut', 'rambling', 'good']) if (L[k] != null && L[k].length > LIMITS.reply) add(id, 'reply ' + k + ' too long');
        if (!L.good) add(id, 'no good reply');
        if (t.reply.need !== 'line' && !L.cut) add(id, 'no cut reply');
        if (t.reply.need !== 'full' && !L.rambling) add(id, 'no rambling reply');
        if (t.reply.need === 'line' && L.cut) add(id, 'cut reply on a line-length order');
        if (t.reply.need === 'full' && L.rambling) add(id, 'rambling reply on a full-length order');
        for (const cid of Object.keys(t.best.pack)) if (!ids.has(cid)) add(id, 'best names unknown chunk ' + cid);
      }
      const pool = v.params;
      for (const [k, arr] of Object.entries(pool)) if (!Array.isArray(arr) || arr.length < 2) add(v.id, 'param ' + k + ' needs 2+ values');
      // every placeholder is a param (or one the generator fills from the earlier ticket)
      const reserved = new Set(['otherName', 'otherRef']), unknown = new Set();
      JSON.stringify(v, (k, x) => { if (typeof x === 'string') for (const m of x.matchAll(/\{(\w+)\}/g)) if (!(m[1] in pool) && !reserved.has(m[1])) unknown.add(m[1]); return x; });
      if (unknown.size) add(v.id, 'placeholders without params: ' + [...unknown].join(', '));
      if (v.twin) {
        const w = variantById[v.twin];
        if (!w || w.twin !== v.id) add(v.id, 'twin ' + v.twin + ' is missing or not mutual');
        else if (JSON.stringify(v.chunks.map((c) => c.label).sort()) !== JSON.stringify(w.chunks.map((c) => c.label).sort())) add(v.id, 'twin ' + v.twin + ' does not share its crates');
        else if (JSON.stringify(v.best) === JSON.stringify(w.best) && JSON.stringify(v.slots) === JSON.stringify(w.slots)) add(v.id, 'twin has the same best line');
      }
      if (v.concept === 'K8' && v.phase !== 3 || ['K9'].includes(v.concept) && v.phase !== 3) add(v.id, 'K8 and K9 belong in phase 3');
      if (['K5', 'K6'].includes(v.concept) && v.phase === 1) add(v.id, 'K5 and K6 belong in phases 2-3');
      if (v.concept === 'K5' && !v.prior) add(v.id, 'K5 needs its turn-1 ticket');
      if (v.concept === 'K9' && !(v.prior && v.gap)) add(v.id, 'K9 needs its first ticket and a gap');
    }
    return bad;
  }

  const api = { LIMITS, RUN, SKILLS, SKILL_OF, CONCEPTS, ORDERS, VARIANTS, byId, variantById, fill, fillDeep, expand, validate };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.KITCHEN_CONTENT = api;
})(this);
