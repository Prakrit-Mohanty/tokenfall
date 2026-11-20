// Prompt Kitchen — progress, mastery and the results panel. Browser: window.KitchenProgress. Node: require('./kitchen-progress.js').
//
// ONE store and ONE export for all the games: this module keeps its data in a namespaced slot ("kitchen") of the Glass Bridge's saved data (bridge-progress.js:
// progress.ns / progress.save / progress.addExportSection), so Export JSON gives one file with every game in it under clearly named sections. The saved data stays at
// version 1: a save made before Prompt Kitchen existed loads untouched and simply has no "kitchen" slot yet (tested, with the other games' slots beside it).
//
//   create({ shared, fixed })   -> adapter    what kitchen-play.js uses: newRun() -> { playerId, runIndex, history }, onEvent(e), attach(play, TF)
//   install(TF)                 at the lobby's boot: finds window.bridgePlay.progress, plugs the adapter into window.kitchenPlay, adds the export section
//   pure and tested: emptyData, applyEvent, skillStats, conceptWeights, revisitList, historyFor, buildExport, isMastered
//
// Data (the "kitchen" slot): { v, runCount, concepts: { id: { attempts, clean, variantsSeen, bleeds, cutoffs, overstuffed, rambling, missed, left, partial, cleanRuns: [{ v, r }], mastered } },
//   runs: [{ runIndex, seed, finished, stars, coins, spills, tokensSpent, idealTokens, timeMs, variants }], weights }
// Events: run, shift ({ variants }), answer ({ credit, conceptId, variantId, kind, clean }), finish, abandon.
// Mastery: a concept is mastered after a CLEAN order in two different variants on two different runs. An order is clean when its quality is perfect or 80% and up, there was no leak and the tokens spent
// were at most 1.15 x par. Only a finished run can master anything: a shift left with Esc keeps what was served as partial attempts and earns no mastery.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-content.js') : root.KITCHEN_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld, isNode ? require('./carrom-progress.js') : root.CarromProgress);
  if (isNode) module.exports = api;
  else root.KitchenProgress = api;
})(this, function (C, CW, CP) {
  const NS = 'kitchen', MAX_RUNS = 30, SKILL_IDS = Object.keys(C.SKILLS);
  const SKILL_STYLE = { spend: CW.STYLE[0], signal: CW.STYLE[1], chat: CW.STYLE[2], clean: CW.STYLE[3] };   // amber, green, cyan, rose: the same four as everywhere
  const CONCEPT = Object.fromEntries(C.CONCEPTS.map((c) => [c.id, c]));

  // ---------------------------------------------------------------- pure
  const emptyData = () => ({ v: 1, runCount: 0, concepts: {}, runs: [], weights: {} });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, clean: 0, variantsSeen: [], bleeds: 0, cutoffs: 0, overstuffed: 0, rambling: 0, missed: 0, left: 0, partial: 0, cleanRuns: [], mastered: false });
  function isMastered(c) {   // some two clean orders differ in both variant and run
    const f = c.cleanRuns;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (f[i].v !== f[j].v && f[i].r !== f[j].r) return true;
    return false;
  }
  const conceptScore = (c) => (!c ? 0 : c.mastered ? 1 : c.cleanRuns.length ? 0.5 : 0);
  const falls = (c) => c.bleeds + c.cutoffs + c.overstuffed + c.rambling + c.missed + c.left;
  function skillStats(d) {
    return SKILL_IDS.map((id) => {
      const cs = C.CONCEPTS.filter((c) => c.skill === id), sum = cs.reduce((n, c) => n + conceptScore(d.concepts[c.id]), 0);
      return { id, name: C.SKILLS[id].name, zone: C.SKILLS[id].zone, mastery: sum / cs.length, mastered: cs.filter((c) => (d.concepts[c.id] || {}).mastered).length, total: cs.length, attempts: cs.reduce((n, c) => n + ((d.concepts[c.id] || {}).attempts || 0), 0) };
    });
  }
  // the weak-concept weights the generator's repeats read (the shared formula): 0.35 once mastered, 1.4 until then, plus 0.6 for each of the (up to 4) falls
  const conceptWeights = (d) => Object.fromEntries(C.CONCEPTS.map((c) => { const x = d.concepts[c.id] || {}; return [c.id, +((x.mastered ? 0.35 : 1.4) + 0.6 * Math.min(x.attempts ? falls(x) : 0, 4)).toFixed(3)]; }));
  function revisitList(d, n = 4) {   // concepts not yet mastered, the ones fallen on most first, with how they went wrong
    const note = (c) => [c.bleeds ? `${c.bleeds} leak${c.bleeds === 1 ? '' : 's'}` : '', c.missed ? `${c.missed} missed the point` : '', c.cutoffs ? `${c.cutoffs} cut off` : '', c.overstuffed ? `${c.overstuffed} over-stuffed` : '', c.rambling ? `${c.rambling} rambling` : '', c.left ? `${c.left} left` : ''].filter(Boolean).join(', ');
    return Object.keys(d.concepts).map((id) => Object.assign({ id }, d.concepts[id])).filter((c) => CONCEPT[c.id] && !c.mastered && falls(c) > 0)
      .sort((a, b) => (b.bleeds * 3 + b.missed * 2 + b.cutoffs * 2 + b.overstuffed + b.rambling + b.left) - (a.bleeds * 3 + a.missed * 2 + a.cutoffs * 2 + a.overstuffed + a.rambling + a.left) || a.id.localeCompare(b.id)).slice(0, n)
      .map((c) => ({ id: c.id, title: CONCEPT[c.id].title, skill: CONCEPT[c.id].skill, skillName: C.SKILLS[CONCEPT[c.id].skill].name, idea: CONCEPT[c.id].idea, note: note(c) }));
  }
  // what the generator reads: the variants shown in the last runs (anti-repeat), and per concept how often it fell and whether it is mastered
  const historyFor = (d) => ({
    runs: d.runs.map((r) => ({ variants: r.variants || [] })),
    concepts: Object.fromEntries(Object.entries(d.concepts).map(([id, c]) => [id, { attempts: c.attempts, falls: falls(c), mastered: c.mastered }])),
    weights: d.weights,
  });

  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, coins: 0, spills: 0, tokensSpent: 0, idealTokens: 0, timeMs: 0, variants: [] };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'shift' && cur.run) {
      for (const id of e.variants || []) if (!cur.run.variants.includes(id)) cur.run.variants.push(id);
    } else if (e.type === 'answer' && CONCEPT[e.conceptId]) {
      const c = concept(d, e.conceptId);
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (!e.credit) c.partial++;   // left mid-shift: kept, but it earns no mastery and adds no fall
      else {
        c.attempts++; if (e.clean) c.clean++;
        if (e.kind === 'bleed') c.bleeds++; else if (e.kind === 'cutoff') c.cutoffs++; else if (e.kind === 'overstuffed') c.overstuffed++; else if (e.kind === 'rambling') c.rambling++; else if (e.kind === 'missing') c.missed++; else if (e.kind === 'left') c.left++;
      }
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, coins: e.coins, spills: e.spills, tokensSpent: e.spent, idealTokens: e.idealTokens, timeMs: e.timeMs });
      for (const [id, vs] of Object.entries(e.clean || {})) if (CONCEPT[id]) {
        const c = concept(d, id);
        for (const v of vs) if (!c.cleanRuns.some((x) => x.v === v && x.r === cur.runIndex)) c.cleanRuns.push({ v, r: cur.runIndex });
        if (c.cleanRuns.length > 24) c.cleanRuns.splice(0, c.cleanRuns.length - 24);
        c.mastered = isMastered(c);
      }
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, timeMs: e.timeMs || 0, spills: e.spills || 0 });
      cur.run = null;
    }
    d.weights = conceptWeights(d);
    return d;
  }

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished), cs = Object.values(d.concepts);
    return {
      game: 'Uplink · Prompt Kitchen', schema: 1, exportedAt: now.toISOString(),
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), bestCoins: done.reduce((m, r) => Math.max(m, r.coins || 0), 0), leaks: d.runs.reduce((n, r) => n + (r.spills || 0), 0),
        ordersServed: cs.reduce((n, c) => n + c.attempts, 0), ordersClean: cs.reduce((n, c) => n + c.clean, 0), conceptsMastered: cs.filter((c) => c.mastered).length, conceptsTotal: C.CONCEPTS.length },
      mastery: 'A concept is mastered after a clean order in two different variants on two different runs: perfect or 80% quality, no leak, and tokens spent at most 1.15 x par. Token saving and context management in practice: spend wisely, keep the signal, mind the chat, keep it clean and reuse.',
      skills: skillStats(d).map((s) => ({ id: s.id, name: s.name, mastery: +s.mastery.toFixed(3), conceptsMastered: s.mastered, conceptsTotal: s.total })),
      concepts: C.CONCEPTS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, skill: c.skill, idea: c.idea, attempts: x.attempts || 0, clean: x.clean || 0, variantsSeen: x.variantsSeen || [], bleeds: x.bleeds || 0, cutoffs: x.cutoffs || 0,
        overstuffed: x.overstuffed || 0, rambling: x.rambling || 0, missedThePoint: x.missed || 0, left: x.left || 0, partialAttempts: x.partial || 0, cleanVariants: [...new Set((x.cleanRuns || []).map((y) => y.v))], mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, coins: r.coins, spills: r.spills, tokensSpent: r.tokensSpent, idealTokens: r.idealTokens, timeMs: r.timeMs })),
      weights: d.weights,
    };
  }

  // ---------------------------------------------------------------- the module the game uses
  function create(opts = {}) {
    const shared = opts.shared || null, fixed = opts.fixed || null;
    let local = emptyData(); const cur = { runIndex: 0, run: null };
    const data = () => (shared ? shared.ns(NS, emptyData) : local);
    const save = () => { if (shared) shared.save(); };
    let TF = null, play = null, panel = null, panelOpen = false;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ---- the results: the lobby's .panel look, Baloo 2 for titles, Nunito for text (the same look as the other games' summaries) ----
    function makePanel() {
      const style = document.createElement('style');
      style.textContent = `
        .kr { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(700px, calc(100vw - 32px)); max-height: calc(100vh - 110px); overflow-y: auto; padding: 16px 22px 14px; display: none; font-size: 17px; line-height: 1.4; background: rgba(40, 28, 24, .96); pointer-events: auto; border-color: var(--gold); z-index: 8; }
        .kr h3 { margin: 0; font-family: var(--font-secondary); font-size: 16px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .kr .sum { margin: 4px 0 4px; font-size: 18px; } .kr .sum b { color: var(--gold); font-weight: 600; } .kr .waste { margin: 0 0 8px; font-size: 16px; opacity: .92; }
        .kr .cost { margin: 2px 0 8px; font-size: 16px; } .kr .cost div { display: grid; grid-template-columns: 130px 1fr 60px; gap: 8px; align-items: center; margin: 2px 0; }
        .kr .row { display: grid; grid-template-columns: 190px 1fr 92px; gap: 10px; align-items: center; margin: 3px 0; font-size: 16px; }
        .kr .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .kr .bar i { display: block; height: 100%; }
        .kr .num { text-align: right; opacity: .85; font-size: 16px; }
        .kr h4 { margin: 12px 0 4px; font-family: var(--font-secondary); font-size: 16px; letter-spacing: .14em; color: var(--gold); }
        .kr ul { margin: 0; padding-left: 18px; } .kr li { margin: 3px 0; } .kr li small { opacity: .8; font-size: 16px; } .kr .none { opacity: .8; }
        .kr .note { margin-top: 8px; font-size: 16px; opacity: .72; }
        .kr .acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 16px; }
        .kr button { font: inherit; color: var(--ink); background: rgba(40, 28, 24,.9); border: 1px solid var(--gold); padding: 4px 12px; cursor: pointer; } .kr button:hover { background: rgba(217,180,106,.2); }
        .kr kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        @media (max-width: 560px) { .kr .row { grid-template-columns: 110px 1fr 66px; } .kr .cost div { grid-template-columns: 90px 1fr 50px; } }`;
      document.head.appendChild(style);
      const el = document.createElement('div'); el.className = 'panel kr'; document.getElementById('ui').appendChild(el);
      el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.act === 'export') exportAll(); else close(); });
      return el;
    }
    function render(sum) {
      const d = data(), stats = skillStats(d), rev = revisitList(d, 3), br = shared ? CP.bridgeTopicsMastered(shared.data) : { mastered: 0, total: 7 };
      const stars = '★'.repeat(sum.stars) + '☆'.repeat(3 - sum.stars), sec = Math.round(sum.timeMs / 1000), mx = Math.max(sum.spent, sum.idealTokens, sum.tank, 1), w = sum.waste || { noise: 0, oversize: 0, history: 0, stock: 0 };
      const bar = (n, color, label) => `<span class="bar" role="img" aria-label="${label} ${n}"><i style="width:${Math.round(100 * n / mx)}%;background:${color}"></i></span>`;
      panel.innerHTML = `<h3>PROMPT KITCHEN · RESULTS</h3><div class="sum"><b>${stars}</b> · <b>${sum.coins}</b> of ${sum.ideal} coins · <b>${sum.spills}</b> leak${sum.spills === 1 ? '' : 's'} · ${Math.floor(sec / 60)}m ${sec % 60}s</div>`
        + `<div class="cost"><div><span>Tokens spent</span>${bar(sum.spent, sum.spent > sum.idealTokens ? SKILL_STYLE.clean.css : SKILL_STYLE.signal.css, 'spent')}<span class="num">${sum.spent}</span></div><div><span>Ideal line</span>${bar(sum.idealTokens, SKILL_STYLE.signal.css, 'ideal')}<span class="num">${sum.idealTokens}</span></div><div><span>Gas tank</span>${bar(sum.tank, SKILL_STYLE.spend.css, 'tank')}<span class="num">${sum.tank}</span></div></div>`
        + `<div class="waste">Where the extra went: ${w.noise} in noise and copies · ${w.oversize} in longer replies than needed · ${w.history} in history carried · ${w.stock} in stock never used.</div>`
        + '<h4>THE FOUR SKILLS</h4>' + stats.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="bar" role="img" aria-label="${esc(t.name)} ${Math.round(t.mastery * 100)}%"><i style="width:${Math.round(t.mastery * 100)}%;background:${SKILL_STYLE[t.id].css}"></i></span><span class="num">${t.mastered}/${t.total} mastered</span></div>`).join('')
        + '<h4>REVISIT</h4>' + (rev.length ? `<ul>${rev.map((r) => `<li><b>${esc(r.title)}</b> <small>(${esc(r.skillName)}: ${esc(r.note)})</small><br><small>${esc(r.idea)}</small></li>`).join('')}</ul>` : '<div class="none">Nothing to revisit yet. Keep cooking.</div>')
        + `<div class="note">Bridge mastery: ${br.mastered} of ${br.total} topics. Mastered = a clean order in two different variants on two different runs.</div>`
        + `<div class="acts"><button data-act="export" type="button">Export progress (JSON) <kbd>J</kbd></button><button data-act="close" type="button">Close <kbd>E</kbd></button></div>`;
    }
    function open(sum) { if (!panel) panel = makePanel(); render(sum); panel.style.display = 'block'; panel.scrollTop = 0; panelOpen = true; }
    function hide() { if (panel) panel.style.display = 'none'; panelOpen = false; }
    function close() { hide(); if (play) play.closeDebrief(); }
    function exportAll() {   // the shared export: the bridge's fields plus a section per other game, in one file
      if (shared && shared.download) { shared.download(); if (TF) TF.sys('Progress exported as JSON (all games).'); return; }
      const blob = new Blob([JSON.stringify(buildExport(data()), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tokenfall-prompt-kitchen-progress.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    const adapter = {
      get data() { return data(); }, get panelOpen() { return panelOpen; },
      newRun() { const d = data(), r = { playerId: shared ? shared.data.playerId : (fixed && fixed.playerId) || 'p-local', runIndex: d.runCount++, history: historyFor(d) }; save(); return r; },
      onEvent(e) { applyEvent(data(), e, cur); save(); },
      exportJSON: () => (shared ? shared.exportJSON() : buildExport(data())), exportSection: () => buildExport(data()),
      show: open, hide,
      attach(p, tf) {
        play = p; TF = tf;
        if (shared && shared.addExportSection) shared.addExportSection(NS, (all) => buildExport(all[NS] || emptyData()));
        play.modal = { open: () => panelOpen, close, hide, key: (e) => { if (e.code === 'KeyJ' && !e.repeat) { exportAll(); return true; } return false; } };
        play.debrief = (sum) => {
          open(sum);
          const st = skillStats(data()).filter((s) => s.attempts), best = st.slice().sort((a, b) => b.mastery - a.mastery)[0], worst = st.slice().sort((a, b) => a.mastery - b.mastery)[0], br = shared ? CP.bridgeTopicsMastered(shared.data) : { mastered: 0, total: 7 };
          TF.talk('Ticket Rail', [
            best && worst && best !== worst ? `Steadiest skill: ${best.name}. Wobbliest: ${worst.name}. The next shift leans that way.` : 'Run a few more shifts and I will tell you where the line wobbles.',
            `Bridge mastery ${br.mastered} of ${br.total} topics. The summary is up: E closes it, J saves everything as JSON.`,
          ]);
        };
      },
    };
    return adapter;
  }

  function install(TF) {
    TF.on('boot', () => {
      const bridge = typeof window !== 'undefined' ? window.bridgePlay : null, play = typeof window !== 'undefined' ? window.kitchenPlay : null;
      if (!play) return;
      const adapter = create({ shared: bridge && bridge.progress });
      play.useProgress(adapter); adapter.attach(play, TF);
      if (typeof window !== 'undefined') window.kitchenProgress = adapter;
    });
  }
  return { NS, SKILL_STYLE, emptyData, applyEvent, skillStats, conceptWeights, revisitList, historyFor, buildExport, isMastered, create, install };
});
