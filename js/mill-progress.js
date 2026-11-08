// Token Mill — progress, mastery and the debrief at the desk. Browser: window.MillProgress. Node: require('./mill-progress.js').
//
// ONE store and ONE export for all the games: this module keeps its data in a namespaced slot ("mill") of the Glass Bridge's saved data (bridge-progress.js:
// progress.ns / progress.save / progress.addExportSection), so Export JSON gives one file with every game in it under clearly named sections. The saved data stays at
// version 1: a save made before Token Mill existed loads untouched and simply has no "mill" slot yet (tested, with the carrom, tower and spot shot slots beside it).
//
//   create({ shared, fixed })   -> adapter    what mill-play.js uses: newRun() -> { playerId, runIndex, history }, onEvent(e), attach(play, TF)
//   install(TF)                 at the lobby's boot: finds window.bridgePlay.progress, plugs the adapter into window.millPlay, adds the export section
//   pure and tested: emptyData, applyEvent, sideStats, sideWeights, revisitList, historyFor, buildExport, isMastered
//
// Data (the "mill" slot): { v, runCount, concepts: { id: { attempts, correct, laxErrors, strictErrors, dropped, partial, variantsSeen, clean: [{ v, r }], mastered } },
//   runs: [{ runIndex, seed, finished, stars, accuracy, spills, dropped, cost, idealCost, timeMs, relaxed, items }], sideWeights }
// Events: run, shift ({ items }: the crates a shift showed), answer ({ credit, conceptId, variantId, correct, direction }), finish, abandon.
// Mastery: a concept is mastered after CLEAN runs in two different variants on two different runs. A variant is clean in a run when at least 75% of that variant's crates for the concept were
// routed correctly (and at least 3 of them). Only a finished run can master anything: a shift left with Esc keeps its crates as partial attempts and earns no mastery.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./mill-content.js') : root.MILL_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld, isNode ? require('./carrom-progress.js') : root.CarromProgress);
  if (isNode) module.exports = api;
  else root.MillProgress = api;
})(this, function (C, CW, CP) {
  const NS = 'mill', MAX_RUNS = 30, SIDE_IDS = C.SIDE_IDS;
  const SIDE_STYLE = { doors: CW.STYLE[0], tiers: CW.STYLE[1], checks: CW.STYLE[2], incidents: CW.STYLE[3] };   // amber, green, cyan, rose: the same four as everywhere
  const CONCEPT = C.byId;

  // ---------------------------------------------------------------- pure
  const emptyData = () => ({ v: 1, runCount: 0, concepts: {}, runs: [], sideWeights: {} });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, correct: 0, laxErrors: 0, strictErrors: 0, dropped: 0, partial: 0, variantsSeen: [], clean: [], mastered: false });
  function isMastered(c) {   // some two clean variants differ in both variant and run
    const f = c.clean;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (f[i].v !== f[j].v && f[i].r !== f[j].r) return true;
    return false;
  }
  const conceptScore = (c) => (!c ? 0 : c.mastered ? 1 : c.clean.length ? 0.5 : 0);
  function sideStats(d) {
    return SIDE_IDS.map((id) => {
      const cs = C.CONCEPTS.filter((c) => c.side === id), sum = cs.reduce((n, c) => n + conceptScore(d.concepts[c.id]), 0);
      return { id, name: C.SIDES[id].name, zone: C.SIDES[id].zone, mastery: sum / cs.length, mastered: cs.filter((c) => (d.concepts[c.id] || {}).mastered).length, total: cs.length, attempts: cs.reduce((n, c) => n + ((d.concepts[c.id] || {}).attempts || 0), 0) };
    });
  }
  // 0.5 (mastered) .. 2.5 (nothing mastered yet); a side never met gets a neutral 1.5
  const sideWeights = (d) => Object.fromEntries(sideStats(d).map((s) => [s.id, +(s.attempts ? 0.5 + 2 * (1 - s.mastery) : 1.5).toFixed(3)]));
  const misses = (c) => c.laxErrors + c.strictErrors + c.dropped;
  function revisitList(d, n = 4) {   // concepts not yet mastered, the ones missed most first, with which way they went wrong
    return Object.keys(d.concepts).map((id) => Object.assign({ id }, d.concepts[id])).filter((c) => CONCEPT[c.id] && !c.mastered && misses(c) > 0)
      .sort((a, b) => (b.laxErrors * 2 + b.strictErrors + b.dropped) - (a.laxErrors * 2 + a.strictErrors + a.dropped) || a.id.localeCompare(b.id)).slice(0, n)
      .map((c) => ({ id: c.id, title: CONCEPT[c.id].title, side: CONCEPT[c.id].side, sideName: C.SIDES[CONCEPT[c.id].side].name, idea: CONCEPT[c.id].idea, lax: c.laxErrors, strict: c.strictErrors, dropped: c.dropped,
        note: [c.laxErrors ? `${c.laxErrors} too lax` : '', c.strictErrors ? `${c.strictErrors} too strict` : '', c.dropped ? `${c.dropped} dropped` : ''].filter(Boolean).join(', ') }));
  }
  // what the generator reads: the crates shown in the last runs (anti-repeat), and per concept how often it was missed and whether it is mastered
  const historyFor = (d) => ({
    runs: d.runs.map((r) => ({ items: r.items || [] })),
    concepts: Object.fromEntries(Object.entries(d.concepts).map(([id, c]) => [id, { attempts: c.attempts, misses: misses(c), mastered: c.mastered }])),
    sideWeights: d.sideWeights,
  });

  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, accuracy: null, spills: 0, dropped: 0, cost: 0, idealCost: 0, timeMs: 0, relaxed: false, items: [] };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'shift' && cur.run) {
      for (const id of e.items || []) if (!cur.run.items.includes(id)) cur.run.items.push(id);
    } else if (e.type === 'answer' && CONCEPT[e.conceptId]) {
      const c = concept(d, e.conceptId);
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (!e.credit) c.partial++;   // left mid-shift: kept, but it earns no mastery and adds no miss
      else { c.attempts++; if (e.correct) c.correct++; else if (e.direction === 'lax') c.laxErrors++; else if (e.direction === 'dropped') c.dropped++; else c.strictErrors++; }
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, accuracy: e.accuracy, spills: e.severe, dropped: e.dropped, cost: e.cost, idealCost: e.idealCost, timeMs: e.timeMs, relaxed: !!e.relaxed });
      for (const [id, vs] of Object.entries(e.clean || {})) if (CONCEPT[id]) {
        const c = concept(d, id);
        for (const v of vs) if (!c.clean.some((x) => x.v === v && x.r === cur.runIndex)) c.clean.push({ v, r: cur.runIndex });
        if (c.clean.length > 24) c.clean.splice(0, c.clean.length - 24);
        c.mastered = isMastered(c);
      }
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, timeMs: e.timeMs || 0, spills: e.spills || 0, dropped: e.dropped || 0 });
      cur.run = null;
    }
    d.sideWeights = sideWeights(d);
    return d;
  }

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished), cs = Object.values(d.concepts);
    return {
      game: 'Uplink · Token Mill', schema: 1, exportedAt: now.toISOString(),
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), bestAccuracy: done.reduce((m, r) => Math.max(m, r.accuracy || 0), 0),
        spills: d.runs.reduce((n, r) => n + (r.spills || 0), 0), cratesRouted: cs.reduce((n, c) => n + c.attempts, 0), cratesRight: cs.reduce((n, c) => n + c.correct, 0),
        conceptsMastered: cs.filter((c) => c.mastered).length, conceptsTotal: C.CONCEPTS.length },
      sample: C.SAMPLE_NOTICE,
      mastery: 'A concept is mastered after clean runs in two different variants on two different runs: at least 75% of that variant\'s crates for the concept routed to the bin the policy names. Running AI responsibly in practice: data doors, risk tiers, confidence and checks, incident response. The policies are a sample house policy.',
      sides: sideStats(d).map((s) => ({ id: s.id, name: s.name, mastery: +s.mastery.toFixed(3), conceptsMastered: s.mastered, conceptsTotal: s.total })),
      concepts: C.CONCEPTS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, side: c.side, idea: c.idea, attempts: x.attempts || 0, correct: x.correct || 0, laxErrors: x.laxErrors || 0, strictErrors: x.strictErrors || 0,
        dropped: x.dropped || 0, partialAttempts: x.partial || 0, variantsSeen: x.variantsSeen || [], cleanVariants: [...new Set((x.clean || []).map((y) => y.v))], mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, accuracy: r.accuracy, spills: r.spills, dropped: r.dropped, cost: r.cost, idealCost: r.idealCost, timeMs: r.timeMs, relaxed: !!r.relaxed })),
      sideWeights: d.sideWeights,
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
    const pct = (x) => (x == null ? '–' : Math.round(100 * x) + '%');

    // ---- the debrief: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text (the same look as the other games' summaries) ----
    function makePanel() {
      const style = document.createElement('style');
      style.textContent = `
        .mr { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(700px, calc(100vw - 32px)); max-height: calc(100vh - 110px); overflow-y: auto; padding: 16px 22px 14px; display: none; font-size: 17px; line-height: 1.4; background: rgba(14, 16, 26, .96); pointer-events: auto; font-variant-ligatures: none; }
        .mr h3 { margin: 0; font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .mr .sum { margin: 4px 0 4px; font-size: 18px; } .mr .sum b { color: var(--gold); font-weight: 600; } .mr .trade { margin: 0 0 8px; font-size: 15px; opacity: .9; }
        .mr .cost { margin: 2px 0 8px; font-size: 14px; } .mr .cost div { display: grid; grid-template-columns: 130px 1fr 60px; gap: 8px; align-items: center; margin: 2px 0; }
        .mr .row { display: grid; grid-template-columns: 190px 1fr 92px; gap: 10px; align-items: center; margin: 3px 0; font-size: 15px; }
        .mr .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .mr .bar i { display: block; height: 100%; }
        .mr .num { text-align: right; opacity: .85; font-size: 14px; }
        .mr h4 { margin: 12px 0 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .mr ul { margin: 0; padding-left: 18px; } .mr li { margin: 3px 0; } .mr li small { opacity: .8; font-size: 14px; } .mr .none { opacity: .8; }
        .mr .note { margin-top: 8px; font-size: 13px; opacity: .72; }
        .mr .acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 14px; }
        .mr button { font: inherit; color: var(--ink); background: rgba(14,16,26,.9); border: 1px solid var(--gold); padding: 4px 12px; cursor: pointer; } .mr button:hover { background: rgba(217,180,106,.2); }
        .mr kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        @media (max-width: 560px) { .mr .row { grid-template-columns: 110px 1fr 66px; } .mr .cost div { grid-template-columns: 90px 1fr 50px; } }`;
      document.head.appendChild(style);
      const el = document.createElement('div'); el.className = 'panel mr'; document.getElementById('ui').appendChild(el);
      el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.act === 'export') exportAll(); else close(); });
      return el;
    }
    function render(sum) {
      const d = data(), stats = sideStats(d), rev = revisitList(d, 3), br = shared ? CP.bridgeTopicsMastered(shared.data) : { mastered: 0, total: 7 };
      const stars = '★'.repeat(sum.stars) + '☆'.repeat(3 - sum.stars), sec = Math.round(sum.timeMs / 1000), mx = Math.max(sum.cost, sum.idealCost, 1), trade = play && play.tradeoff ? play.tradeoff(sum) : '';
      panel.innerHTML = `<h3>${sum.finished ? 'TOKEN MILL · RESULTS' : 'TOKEN MILL'}</h3><div class="sum"><b>${stars}</b> · accuracy <b>${pct(sum.accuracy)}</b> (${sum.correct} of ${sum.total}) · <b>${sum.severe}</b> spill${sum.severe === 1 ? '' : 's'} · <b>${sum.dropped}</b> dropped · ${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s${sum.relaxed ? ' · relaxed belt' : ''}</div>`
        + `<div class="trade">${esc(trade)}</div>`
        + `<div class="cost"><div><span>Your line</span><span class="bar" role="img" aria-label="your line cost ${sum.cost}"><i style="width:${Math.round(100 * sum.cost / mx)}%;background:${sum.cost > sum.idealCost ? SIDE_STYLE.incidents.css : SIDE_STYLE.tiers.css}"></i></span><span class="num">${sum.cost}</span></div><div><span>Ideal line</span><span class="bar" role="img" aria-label="ideal line cost ${sum.idealCost}"><i style="width:${Math.round(100 * sum.idealCost / mx)}%;background:${SIDE_STYLE.checks.css}"></i></span><span class="num">${sum.idealCost}</span></div></div>`
        + stats.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="bar" role="img" aria-label="${esc(t.name)} ${Math.round(t.mastery * 100)}%"><i style="width:${Math.round(t.mastery * 100)}%;background:${SIDE_STYLE[t.id].css}"></i></span><span class="num">${t.mastered}/${t.total} · ${Math.round(t.mastery * 100)}%</span></div>`).join('')
        + '<h4>REVISIT</h4>' + (rev.length ? `<ul>${rev.map((r) => `<li><b>${esc(r.title)}</b> <small>(${esc(r.sideName)}: ${esc(r.note)})</small><br><small>${esc(r.idea)}</small></li>`).join('')}</ul>` : '<div class="none">Nothing to revisit yet. Keep sorting.</div>')
        + `<div class="note">Bridge mastery: ${br.mastered} of ${br.total} topics. Mastered = clean runs in two different variants on two different runs. The policies are a SAMPLE: Calfus security or legal must replace and approve them before release.</div>`
        + `<div class="acts"><button data-act="export" type="button">Export progress (JSON) <kbd>J</kbd></button><button data-act="close" type="button">Close <kbd>E</kbd></button></div>`;
    }
    function open(sum) { if (!panel) panel = makePanel(); render(sum); panel.style.display = 'block'; panel.scrollTop = 0; panelOpen = true; }
    function hide() { if (panel) panel.style.display = 'none'; panelOpen = false; }
    function close() { hide(); if (play) play.closeDebrief(); }
    function exportAll() {   // the shared export: the bridge's fields plus a section per other game, in one file
      if (shared && shared.download) { shared.download(); if (TF) TF.sys('Progress exported as JSON (all games).'); return; }
      const blob = new Blob([JSON.stringify(buildExport(data()), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tokenfall-token-mill-progress.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
          const st = sideStats(data()).filter((s) => s.attempts), best = st.slice().sort((a, b) => b.mastery - a.mastery)[0], worst = st.slice().sort((a, b) => a.mastery - b.mastery)[0];
          const mood = sum.stars === 3 ? 'Right bin, right time, nothing spilled.' : sum.stars === 2 ? 'A good line. A spill or two is how the lessons stick.' : 'You got to the end of the belt. The pit was hungry.';
          TF.talk('Control Desk', [
            `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${mood}`,
            best && worst && best !== worst ? `Steadiest: ${best.name}. Wobbliest: ${worst.name}. The next belt leans that way.` : 'Run a few more shifts and I will tell you where the line wobbles.',
            'The summary is up. E closes it, J saves everything as JSON. And remember: those policies are a sample.',
          ]);
        };
      },
    };
    return adapter;
  }

  function install(TF) {
    TF.on('boot', () => {
      const bridge = typeof window !== 'undefined' ? window.bridgePlay : null, play = typeof window !== 'undefined' ? window.millPlay : null;
      if (!play) return;
      const adapter = create({ shared: bridge && bridge.progress });
      play.useProgress(adapter); adapter.attach(play, TF);
      if (typeof window !== 'undefined') window.millProgress = adapter;
    });
  }
  return { NS, SIDE_STYLE, emptyData, applyEvent, sideStats, sideWeights, revisitList, historyFor, buildExport, isMastered, create, install };
});
