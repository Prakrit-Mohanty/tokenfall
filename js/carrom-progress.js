// House Rules Carrom — progress, mastery and the table report. Browser: window.CarromProgress. Node: require('./carrom-progress.js').
//
// There is ONE store and ONE export for both games: this module keeps carrom's data in a namespaced slot ("carrom") of the Glass Bridge's saved data
// (bridge-progress.js: progress.ns / progress.save / progress.addExportSection), so Export JSON gives the HR rubric one file with both games in it,
// under clearly named sections. The saved data stays at version 1: a save made before carrom existed loads untouched and simply has no carrom slot yet.
//
//   create({ shared, fixed })   -> adapter   what carrom-play.js uses: newRun() -> { playerId, runIndex, history }, onEvent(e), attach(play, TF)
//   install(TF)                 at the lobby's boot: finds window.bridgePlay.progress, plugs the adapter into window.carromPlay, adds the export section
//   pure and tested: emptyData, applyEvent, sideStats, revisitList, historyFor, buildExport, bridgeTopicsMastered, isMastered
//
// Data (the "carrom" slot): { v, runCount, concepts: { id: { attempts, firstTryCorrect, strikes, partial, variantsSeen, firstTry: [{ v, r }], shots: [..], mastered, wrong } },
//   runs: [{ runIndex, seed, finished, stars, points, strikes, tokens, seconds, variants }], sideWeights }
// Mastery: a first-try right answer in two DIFFERENT variants on two DIFFERENT runs (the same rule as the bridge). A first try means a right pocket with
// no strike on that answer before it; extra shots are skill, not knowledge. An answer given in a round that was left unfinished is kept as a partial
// attempt and never counts towards mastery.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./carrom-content.js') : root.CARROM_CONTENT, isNode ? require('./bridge-content.js') : root.BRIDGE_CONTENT);
  if (isNode) module.exports = api;
  else root.CarromProgress = api;
})(this, function (C, BC) {
  const NS = 'carrom', MAX_RUNS = 30, SIDE_IDS = ['works', 'limits', 'bias', 'owns'];
  const ZONE_CSS = { amber: '#ffb347', green: '#7dff8a', cyan: '#5cd6ff', rose: '#ff9db8', gold: '#ffd27a' };
  const CARD = Object.fromEntries(C.CARDS.map((c) => [c.id, c]));
  const sideOfCard = (c) => (c.side === 'case' ? c.counts : c.side);   // the finale cards feed the bias and accountability bars

  // ---------------------------------------------------------------- pure
  const emptyData = () => ({ v: 1, runCount: 0, concepts: {}, runs: [], sideWeights: {} });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, firstTryCorrect: 0, strikes: 0, partial: 0, variantsSeen: [], firstTry: [], shots: [], mastered: false, wrong: {} });
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
    return Object.keys(d.concepts).map((id) => Object.assign({ id }, d.concepts[id])).filter((c) => CARD[c.id] && !c.mastered && (c.attempts || c.partial))
      .sort((a, b) => b.strikes - a.strikes || b.attempts - a.attempts || a.id.localeCompare(b.id)).slice(0, n)
      .map((c) => ({ id: c.id, title: CARD[c.id].title, side: sideOfCard(CARD[c.id]), sideName: C.SIDES[sideOfCard(CARD[c.id])].name, idea: CARD[c.id].idea, strikes: c.strikes, attempts: c.attempts,
        note: c.strikes ? `${c.strikes} strike${c.strikes === 1 ? '' : 's'}` : 'right first time, not proven yet' }));
  }
  // what the generator reads: the same shape as the bridge's history (falls = strikes), so weights and anti-repeat work the same way in both games
  const historyFor = (d) => ({
    runs: d.runs.map((r) => ({ variants: r.variants || [] })),
    concepts: Object.fromEntries(Object.entries(d.concepts).map(([id, c]) => [id, { attempts: c.attempts, falls: c.strikes, mastered: c.mastered }])),
    sideWeights: d.sideWeights,
  });

  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, points: 0, strikes: 0, tokens: 0, seconds: 0, variants: (e.seen || []).slice() };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'answer' && CARD[e.conceptId]) {
      const c = concept(d, e.conceptId);
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (!e.credit) c.partial++;   // left mid-round: kept, but it earns no mastery and adds no strike
      else {
        c.attempts++;
        if (e.correct) {
          if (typeof e.shots === 'number') { c.shots.push(e.shots); if (c.shots.length > 24) c.shots.shift(); }
          if (e.firstTry) { c.firstTryCorrect++; if (!c.firstTry.some((x) => x.v === e.variantId && x.r === cur.runIndex)) c.firstTry.push({ v: e.variantId, r: cur.runIndex }); if (c.firstTry.length > 24) c.firstTry.shift(); }
        } else { c.strikes++; if (e.wrongId) c.wrong[e.wrongId] = (c.wrong[e.wrongId] || 0) + 1; }
        c.mastered = isMastered(c);
      }
      if (cur.run && !cur.run.variants.includes(e.variantId)) cur.run.variants.push(e.variantId);
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, points: e.points, strikes: e.strikes, tokens: e.tokens, seconds: e.seconds, variants: e.seen || cur.run.variants });
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, points: +(e.points || 0).toFixed(2), variants: e.seen || cur.run.variants });
      cur.run = null;
    }
    d.sideWeights = sideWeights(d);
    return d;
  }

  // how many of the bridge's topics are fully mastered (every concept of the topic), for the "Bridge mastery: x of 7 topics" line
  function bridgeTopicsMastered(bridgeData) {
    const topics = Object.keys(BC.TOPICS), cards = BC.CARDS, mastered = topics.filter((t) => cards.filter((c) => c.topic === t).every((c) => ((bridgeData && bridgeData.concepts || {})[c.id] || {}).mastered));
    return { mastered: mastered.length, total: topics.length };
  }

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished);
    return {
      game: 'Uplink · House Rules Carrom', schema: 1, exportedAt: now.toISOString(),
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), tokensBanked: done.reduce((n, r) => n + r.tokens, 0),
        conceptsMastered: Object.values(d.concepts).filter((c) => c.mastered).length, conceptsTotal: C.CARDS.length },
      mastery: 'A concept is mastered after a first-try right answer in two different variants on two different runs. Understanding AI: how it works, strengths and limits, where bias comes from, accountability.',
      sides: sideStats(d).map((s) => ({ id: s.id, name: s.name, mastery: +s.mastery.toFixed(3), conceptsMastered: s.mastered, conceptsTotal: s.total })),
      concepts: C.CARDS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, side: sideOfCard(c), idea: c.idea, attempts: x.attempts || 0, firstTryCorrect: x.firstTryCorrect || 0, strikes: x.strikes || 0, partialAttempts: x.partial || 0,
        variantsSeen: x.variantsSeen || [], avgShotsToSink: x.shots && x.shots.length ? +(x.shots.reduce((a, b) => a + b, 0) / x.shots.length).toFixed(2) : null, mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, points: r.points, strikes: r.strikes, tokens: r.tokens, seconds: r.seconds })),
      sideWeights: d.sideWeights,
    };
  }

  // ---------------------------------------------------------------- the module the game uses
  function create(opts = {}) {
    const shared = opts.shared || null, fixed = opts.fixed || null;
    let local = emptyData(); const cur = { runIndex: 0, run: null };
    const data = () => (shared ? shared.ns(NS, emptyData) : local);
    const save = () => { if (shared) shared.save(); };
    let TF = null, play = null, panel = null, panelOpen = false, last = null;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ---- the table report: the lobby's .panel look ----
    function makePanel() {
      const style = document.createElement('style');
      style.textContent = `
        .cr { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(660px, calc(100vw - 32px)); max-height: calc(100vh - 110px); overflow-y: auto; padding: 16px 22px 14px; display: none; font-size: 17px; line-height: 1.4; background: rgba(14, 16, 26, .96); pointer-events: auto; font-variant-ligatures: none; }
        .cr h3 { margin: 0; font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .cr .sum { margin: 4px 0 10px; font-size: 18px; } .cr .sum b { color: #ffe39a; font-weight: 600; }
        .cr .row { display: grid; grid-template-columns: 190px 1fr 92px; gap: 10px; align-items: center; margin: 3px 0; font-size: 15px; }
        .cr .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .cr .bar i { display: block; height: 100%; }
        .cr .num { text-align: right; opacity: .85; font-size: 14px; }
        .cr h4 { margin: 12px 0 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .cr ul { margin: 0; padding-left: 18px; } .cr li { margin: 3px 0; } .cr li small { opacity: .8; font-size: 14px; } .cr .none { opacity: .8; }
        .cr .stat { margin-top: 8px; font-size: 15px; } .cr .note { margin-top: 8px; font-size: 13px; opacity: .72; }
        .cr .acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 14px; }
        .cr button { font: inherit; color: var(--ink); background: rgba(14,16,26,.9); border: 1px solid var(--gold); padding: 4px 12px; cursor: pointer; } .cr button:hover { background: rgba(217,180,106,.2); }
        .cr kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        @media (max-width: 560px) { .cr .row { grid-template-columns: 110px 1fr 66px; } }`;
      document.head.appendChild(style);
      const el = document.createElement('div'); el.className = 'panel cr'; document.getElementById('ui').appendChild(el);
      el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.act === 'export') exportAll(); else close(); });
      return el;
    }
    function render(sum) {
      const d = data(), stats = sideStats(d), rev = revisitList(d, 3), br = shared ? bridgeTopicsMastered(shared.data) : { mastered: 0, total: Object.keys(BC.TOPICS).length };
      const stars = '★'.repeat(sum.stars) + '☆'.repeat(3 - sum.stars), min = Math.floor(sum.seconds / 60), sec = String(sum.seconds % 60).padStart(2, '0');
      const knew = sum.answers.filter((a) => a.correct && a.firstTry).length, slow = sum.answers.filter((a) => a.correct && a.shots >= 3).length, total = sum.answers.filter((a) => a.correct).length;
      panel.innerHTML = `<h3>TABLE REPORT</h3><div class="sum"><b>${stars}</b> · <b>${sum.points.toFixed(1)}</b> of 15 points · <b>${sum.tokens}</b> tokens banked · <b>${sum.strikes}</b> strike${sum.strikes === 1 ? '' : 's'} · ${min}m ${sec}s</div>`
        + stats.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="bar" role="img" aria-label="${esc(t.name)} ${Math.round(t.mastery * 100)}%"><i style="width:${Math.round(t.mastery * 100)}%;background:${ZONE_CSS[t.zone]}"></i></span><span class="num">${t.mastered}/${t.total} · ${Math.round(t.mastery * 100)}%</span></div>`).join('')
        + `<div class="stat">Knew it first time: <b>${knew}</b> of ${total} · Knew it, missed the shot (3+ shots): <b>${slow}</b></div>`
        + '<h4>REVISIT</h4>' + (rev.length ? `<ul>${rev.map((r) => `<li><b>${esc(r.title)}</b> <small>(${esc(r.sideName)}: ${esc(r.note)})</small><br><small>${esc(r.idea)}</small></li>`).join('')}</ul>` : '<div class="none">Nothing to revisit yet. Keep playing.</div>')
        + `<div class="note">Bridge mastery: ${br.mastered} of ${br.total} topics. Mastered = a first-try right answer in two different variants on two different runs.</div>`
        + '<div class="acts"><button data-act="export" type="button">Export progress (JSON) <kbd>J</kbd></button><button data-act="close" type="button">Close <kbd>E</kbd></button></div>';
    }
    function open(sum) { if (!panel) panel = makePanel(); render(sum); panel.style.display = 'block'; panel.scrollTop = 0; panelOpen = true; }
    function close() { if (panel) panel.style.display = 'none'; panelOpen = false; if (play) play.leave(); }
    function exportAll() {   // the shared export: the bridge's fields plus a section per other game, in one file
      if (shared && shared.download) { shared.download(); if (TF) TF.sys('Progress exported as JSON (both games).'); return; }
      const blob = new Blob([JSON.stringify(buildExport(data()), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tokenfall-carrom-progress.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    const adapter = {
      get data() { return data(); }, get panelOpen() { return panelOpen; },
      newRun() { const d = data(), r = { playerId: shared ? shared.data.playerId : (fixed && fixed.playerId) || 'p-local', runIndex: d.runCount++, history: historyFor(d) }; save(); return r; },
      onEvent(e) { applyEvent(data(), e, cur); save(); },
      exportJSON: () => (shared ? shared.exportJSON() : buildExport(data())), exportSection: () => buildExport(data()),
      show: open, hide: () => { if (panel) panel.style.display = 'none'; panelOpen = false; },
      attach(p, tf) {
        play = p; TF = tf;
        if (shared && shared.addExportSection) shared.addExportSection(NS, (all) => buildExport(all[NS] || emptyData()));
        play.modal = { open: () => panelOpen, close, key: (e) => { if (e.code === 'KeyJ' && !e.repeat) { exportAll(); return true; } return false; } };
        play.debrief = (sum) => {
          last = sum; open(sum);
          const st = sideStats(data()).filter((s) => s.attempts), best = st.slice().sort((a, b) => b.mastery - a.mastery)[0], worst = st.slice().sort((a, b) => a.mastery - b.mastery)[0];
          TF.talk('devansh', [
            `${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)} ${sum.points.toFixed(1)} of 15, and ${sum.tokens} tokens in the bank.`,
            best && worst && best !== worst ? `Steadiest: ${best.name}. Wobbliest: ${worst.name}. The next game leans that way.` : 'Play a few more and I will tell you where you wobble.',
            'The report is on the table. E closes it, J saves everything as JSON.',
          ]);
        };
      },
    };
    return adapter;
  }

  function install(TF) {
    TF.on('boot', () => {
      const bridge = typeof window !== 'undefined' ? window.bridgePlay : null, play = typeof window !== 'undefined' ? window.carromPlay : null;
      if (!play) return;
      const adapter = create({ shared: bridge && bridge.progress });
      play.useProgress(adapter); adapter.attach(play, TF);
      if (typeof window !== 'undefined') window.carromProgress = adapter;
    });
  }
  return { NS, emptyData, applyEvent, sideStats, sideWeights, revisitList, historyFor, buildExport, bridgeTopicsMastered, isMastered, create, install };
});
