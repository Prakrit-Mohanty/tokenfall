// Token Tower — progress, mastery and the debrief panel. Browser: window.JengaProgress. Node: require('./jenga-progress.js').
//
// ONE store and ONE export for all the games: this module keeps its data in a namespaced slot ("jenga") of the Glass Bridge's saved data (bridge-progress.js:
// progress.ns / progress.save / progress.addExportSection), so Export JSON gives one file with every game in it under clearly named sections. The saved data stays at
// version 1: a save made before Token Tower existed loads untouched and simply has no "jenga" slot yet (tested, with the carrom slot beside it).
//
//   create({ shared, fixed })   -> adapter    what jenga-play.js uses: newRun() -> { playerId, runIndex, history }, onEvent(e), attach(play, TF)
//   install(TF)                 at the lobby's boot: finds window.bridgePlay.progress, plugs the adapter into window.jengaPlay, adds the export section
//   pure and tested: emptyData, applyEvent, sideStats, sideWeights, revisitList, historyFor, buildExport, isMastered
//
// Data (the "jenga" slot): { v, runCount, concepts: { id: { attempts, firstTryCorrect, wrongTries, timedOut, partial, toppled, variantsSeen, firstTry: [{ v, r }], wrong, mastered } },
//   runs: [{ runIndex, seed, finished, stars, placed, wrongTries, tipped, why, height, points, tokens, timeMs, variants }], sideWeights }
// Events: run, answer ({ credit, correct, firstTry, wrongId?, timedOut?, toppled? }), finish, abandon.
//   attempts = questions answered (right, or timed out); wrongTries = wrong pulls. A wrong pull is not an attempt: the same question carries on.
// Mastery: a first-try correct pull in two DIFFERENT variants on two DIFFERENT runs (the same rule as the other games). An answer from a run left with Esc is kept as a partial
// attempt and never counts towards mastery.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./jenga-content.js') : root.JENGA_CONTENT, isNode ? require('./carrom-world.js') : root.CarromWorld, isNode ? require('./carrom-progress.js') : root.CarromProgress);
  if (isNode) module.exports = api;
  else root.JengaProgress = api;
})(this, function (C, CW, CP) {
  const NS = 'jenga', MAX_RUNS = 30, SIDE_IDS = ['approach', 'agents', 'proof', 'pilot'];
  const STYLE = CW.STYLE, SIDE_STYLE = { approach: STYLE[0], agents: STYLE[1], proof: STYLE[2], pilot: STYLE[3] };   // amber, green, cyan, rose: the same four as the answer slots
  const CARD = Object.fromEntries(C.CARDS.map((c) => [c.id, c]));
  const sideOfCard = (c) => (c.side === 'case' ? c.counts : c.side);   // the finale cards feed the approach, proof and pilot bars

  // ---------------------------------------------------------------- pure
  const emptyData = () => ({ v: 1, runCount: 0, concepts: {}, runs: [], sideWeights: {} });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, firstTryCorrect: 0, wrongTries: 0, timedOut: 0, partial: 0, toppled: 0, variantsSeen: [], firstTry: [], wrong: {}, mastered: false });
  function isMastered(c) {   // some two first-try successes differ in both variant and run
    const f = c.firstTry;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (f[i].v !== f[j].v && f[i].r !== f[j].r) return true;
    return false;
  }
  const conceptScore = (c) => (!c ? 0 : c.mastered ? 1 : c.firstTry.length ? 0.5 : 0);
  function sideStats(d) {
    return SIDE_IDS.map((id) => {
      const cards = C.CARDS.filter((c) => sideOfCard(c) === id), sum = cards.reduce((n, c) => n + conceptScore(d.concepts[c.id]), 0);
      return { id, name: C.SIDES[id].name, zone: C.SIDES[id].zone, mastery: sum / cards.length, mastered: cards.filter((c) => (d.concepts[c.id] || {}).mastered).length, total: cards.length,
        attempts: cards.reduce((n, c) => n + ((d.concepts[c.id] || {}).attempts || 0), 0) };
    });
  }
  // 0.5 (mastered) .. 2.5 (nothing mastered yet); a side never met gets a neutral 1.5
  const sideWeights = (d) => Object.fromEntries(sideStats(d).map((s) => [s.id, +(s.attempts ? 0.5 + 2 * (1 - s.mastery) : 1.5).toFixed(3)]));
  function revisitList(d, n = 4) {
    return Object.keys(d.concepts).map((id) => Object.assign({ id }, d.concepts[id])).filter((c) => CARD[c.id] && !c.mastered && (c.attempts || c.partial || c.wrongTries))
      .sort((a, b) => (b.wrongTries + b.timedOut) - (a.wrongTries + a.timedOut) || b.attempts - a.attempts || a.id.localeCompare(b.id)).slice(0, n)
      .map((c) => { const miss = c.wrongTries + c.timedOut;
        return { id: c.id, title: CARD[c.id].title, side: sideOfCard(CARD[c.id]), sideName: C.SIDES[sideOfCard(CARD[c.id])].name, idea: CARD[c.id].idea, wrongTries: c.wrongTries, attempts: c.attempts,
          note: miss ? `${miss} miss${miss === 1 ? '' : 'es'}` : 'right first time, not proven yet' }; });
  }
  // what the generator reads: variants of the last runs (anti-repeat), and per concept how often it was missed (a timed-out question counts as a miss) and whether it is mastered
  const historyFor = (d) => ({
    runs: d.runs.map((r) => ({ variants: r.variants || [] })),
    concepts: Object.fromEntries(Object.entries(d.concepts).map(([id, c]) => [id, { attempts: c.attempts, wrongTries: c.wrongTries + c.timedOut, mastered: c.mastered }])),
    sideWeights: d.sideWeights,
  });

  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, placed: 0, wrongTries: 0, tipped: false, why: null, height: 0, points: 0, tokens: 0, timeMs: 0, variants: (e.seen || []).slice() };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'answer' && CARD[e.conceptId]) {
      const c = concept(d, e.conceptId);
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (!e.credit) c.partial++;   // left mid-run: kept, but it earns no mastery and adds no miss
      else if (e.timedOut) { c.attempts++; c.timedOut++; }
      else if (e.correct) {
        c.attempts++;
        if (e.toppled) c.toppled++;
        if (e.firstTry) { c.firstTryCorrect++; if (!c.firstTry.some((x) => x.v === e.variantId && x.r === cur.runIndex)) c.firstTry.push({ v: e.variantId, r: cur.runIndex }); if (c.firstTry.length > 24) c.firstTry.shift(); }
      } else { c.wrongTries++; if (e.wrongId) c.wrong[e.wrongId] = (c.wrong[e.wrongId] || 0) + 1; }
      c.mastered = isMastered(c);
      if (cur.run && !cur.run.variants.includes(e.variantId)) cur.run.variants.push(e.variantId);
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, placed: e.placed, wrongTries: e.wrongTries, tipped: !!e.tipped, why: e.why || null, height: e.height, points: e.points, tokens: e.tokens, timeMs: e.timeMs, variants: e.seen || cur.run.variants });
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, placed: e.placed || 0, wrongTries: e.wrongTries || 0, points: +(e.points || 0).toFixed(2), timeMs: e.timeMs || 0, variants: e.seen || cur.run.variants });
      cur.run = null;
    }
    d.sideWeights = sideWeights(d);
    return d;
  }

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished);
    return {
      game: 'Uplink · Token Tower', schema: 1, exportedAt: now.toISOString(),
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), tokensBanked: done.reduce((n, r) => n + r.tokens, 0),
        tallestTower: done.reduce((m, r) => Math.max(m, r.height), 0), towersFallen: done.filter((r) => r.why === 'tipped' || r.why === 'wrongs').length,
        conceptsMastered: Object.values(d.concepts).filter((c) => c.mastered).length, conceptsTotal: C.CARDS.length },
      mastery: 'A concept is mastered after a first-try correct pull in two different variants on two different runs. Building and landing AI at work: choosing an approach, agents and automation, proving it keeps working, picking and landing use cases.',
      sides: sideStats(d).map((s) => ({ id: s.id, name: s.name, mastery: +s.mastery.toFixed(3), conceptsMastered: s.mastered, conceptsTotal: s.total })),
      concepts: C.CARDS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, side: sideOfCard(c), idea: c.idea, attempts: x.attempts || 0, firstTryCorrect: x.firstTryCorrect || 0, wrongTries: x.wrongTries || 0,
        timedOut: x.timedOut || 0, toppled: x.toppled || 0, partialAttempts: x.partial || 0, variantsSeen: x.variantsSeen || [], mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, placed: r.placed, wrongTries: r.wrongTries, tipped: r.tipped, why: r.why, height: r.height, points: r.points, tokens: r.tokens, timeMs: r.timeMs })),
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

    // ---- the debrief: the lobby's .panel look, Cinzel for titles, Pixelify Sans for text ----
    function makePanel() {
      const style = document.createElement('style');
      style.textContent = `
        .tr { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(660px, calc(100vw - 32px)); max-height: calc(100vh - 110px); overflow-y: auto; padding: 16px 22px 14px; display: none; font-size: 17px; line-height: 1.4; background: rgba(14, 16, 26, .96); pointer-events: auto; font-variant-ligatures: none; }
        .tr h3 { margin: 0; font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .tr .sum { margin: 4px 0 10px; font-size: 18px; } .tr .sum b { color: #ffe39a; font-weight: 600; }
        .tr .row { display: grid; grid-template-columns: 210px 1fr 92px; gap: 10px; align-items: center; margin: 3px 0; font-size: 15px; }
        .tr .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .tr .bar i { display: block; height: 100%; }
        .tr .num { text-align: right; opacity: .85; font-size: 14px; }
        .tr h4 { margin: 12px 0 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .tr ul { margin: 0; padding-left: 18px; } .tr li { margin: 3px 0; } .tr li small { opacity: .8; font-size: 14px; } .tr .none { opacity: .8; }
        .tr .stat { margin-top: 8px; font-size: 15px; } .tr .note { margin-top: 8px; font-size: 13px; opacity: .72; }
        .tr .acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 14px; }
        .tr button { font: inherit; color: var(--ink); background: rgba(14,16,26,.9); border: 1px solid var(--gold); padding: 4px 12px; cursor: pointer; } .tr button:hover { background: rgba(217,180,106,.2); }
        .tr kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        @media (max-width: 560px) { .tr .row { grid-template-columns: 110px 1fr 66px; } }`;
      document.head.appendChild(style);
      const el = document.createElement('div'); el.className = 'panel tr'; document.getElementById('ui').appendChild(el);
      el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.act === 'export') exportAll(); else close(); });
      return el;
    }
    function render(sum) {
      const d = data(), stats = sideStats(d), rev = revisitList(d, 3), br = shared ? CP.bridgeTopicsMastered(shared.data) : { mastered: 0, total: 7 };
      const stars = '★'.repeat(sum.stars) + '☆'.repeat(3 - sum.stars), min = Math.floor(sum.seconds / 60), sec = String(sum.seconds % 60).padStart(2, '0');
      const knew = sum.answers.filter((a) => a.correct && a.firstTry).length, toppled = sum.answers.filter((a) => a.correct && a.toppled).length, right = sum.answers.filter((a) => a.correct).length;
      const head = sum.why === 'tipped' ? 'The stack tipped' : sum.why === 'wrongs' ? 'The tower fell' : sum.why === 'timeout' ? 'Time is up, the tower stands' : 'The tower stands';
      panel.innerHTML = `<h3>${esc(head.toUpperCase())}</h3><div class="sum"><b>${stars}</b> · tower <b>${sum.height}</b> layers · <b>${sum.placed}</b> of ${sum.total} placed · <b>${sum.wrongTries}</b> wrong ${sum.wrongTries === 1 ? 'try' : 'tries'} · <b>${sum.tokens}</b> tokens · ${min}m ${sec}s</div>`
        + stats.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="bar" role="img" aria-label="${esc(t.name)} ${Math.round(t.mastery * 100)}%"><i style="width:${Math.round(t.mastery * 100)}%;background:${SIDE_STYLE[t.id].css}"></i></span><span class="num">${t.mastered}/${t.total} · ${Math.round(t.mastery * 100)}%</span></div>`).join('')
        + `<div class="stat">Knew it / toppled it: <b>${knew}</b> of ${right} pulled right first time · <b>${toppled}</b> toppled the tower with a correct pull</div>`
        + '<h4>REVISIT</h4>' + (rev.length ? `<ul>${rev.map((r) => `<li><b>${esc(r.title)}</b> <small>(${esc(r.sideName)}: ${esc(r.note)})</small><br><small>${esc(r.idea)}</small></li>`).join('')}</ul>` : '<div class="none">Nothing to revisit yet. Keep building.</div>')
        + `<div class="note">Bridge mastery: ${br.mastered} of ${br.total} topics. Mastered = a first-try correct pull in two different variants on two different runs.</div>`
        + `<div class="acts"><button data-act="export" type="button">Export progress (JSON) <kbd>J</kbd></button><button data-act="close" type="button">${sum.collapsed ? 'Rebuild' : 'Close'} <kbd>E</kbd></button></div>`;
    }
    function open(sum) { if (!panel) panel = makePanel(); render(sum); panel.style.display = 'block'; panel.scrollTop = 0; panelOpen = true; }
    function hide() { if (panel) panel.style.display = 'none'; panelOpen = false; }
    function close() { hide(); if (play) play.closeDebrief(); }
    function exportAll() {   // the shared export: the bridge's fields plus a section per other game, in one file
      if (shared && shared.download) { shared.download(); if (TF) TF.sys('Progress exported as JSON (all games).'); return; }
      const blob = new Blob([JSON.stringify(buildExport(data()), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tokenfall-token-tower-progress.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
          const mood = sum.why === 'tipped' ? 'The weight sat outside what holds it up. It happens to the best of us.' : sum.why === 'wrongs' ? 'Three wrong pulls and the whole thing comes down. Rude, but fair.' : sum.why === 'timeout' ? 'The clock ran out, but the tower stands. That counts.' : 'Seven blocks placed and the tower still standing.';
          TF.talk('Token Tower', [
            `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${mood}`,
            best && worst && best !== worst ? `Steadiest: ${best.name}. Wobbliest: ${worst.name}. The next tower leans that way.` : 'Build a few more and I will tell you where you wobble.',
            sum.collapsed ? 'The summary is up. E rebuilds with new questions, J saves everything as JSON.' : 'The summary is up. E closes it, J saves everything as JSON.',
          ]);
        };
      },
    };
    return adapter;
  }

  function install(TF) {
    TF.on('boot', () => {
      const bridge = typeof window !== 'undefined' ? window.bridgePlay : null, play = typeof window !== 'undefined' ? window.jengaPlay : null;
      if (!play) return;
      const adapter = create({ shared: bridge && bridge.progress });
      play.useProgress(adapter); adapter.attach(play, TF);
      if (typeof window !== 'undefined') window.jengaProgress = adapter;
    });
  }
  return { NS, emptyData, applyEvent, sideStats, sideWeights, revisitList, historyFor, buildExport, isMastered, create, install };
});
