// The Glass Bridge — progress, mastery and the report card. Browser: window.BridgeProgress. Node: require('./bridge-progress.js').
// Everything is stored in localStorage under "tokenfall.bridge.v1" (a per-player key when ?player= is used). No network.
//
//   create({ storage, fixed }) -> progress   what BridgePlay.install picks up on its own when this file is loaded
//     progress.newRun()        -> { playerId, runIndex, history }  (history feeds BridgeGenerator.composeRun)
//     progress.onEvent(e)         every play event; the data is saved after each one, so a closed tab loses nothing
//     progress.attach(play, TF)   report card at the end of a run (R shows it again, J exports it, E closes it)
//   pure and tested: emptyData, applyEvent, topicStats, topicWeights, revisitList, historyFor, buildExport, createStore
//
// Data (v1): { v, playerId, runCount, concepts: { id: { attempts, firstTryCorrect, falls, variantsSeen, firstTry: [{v, r}], avgAnswerMs,
//   mastered, wrong } }, runs: [{ runIndex, seed, finished, stars, falls, scansUsed, tokens, bestStreak, seconds, variants }], topicWeights }
// Mastery: a first-try correct answer in two DIFFERENT variants on two DIFFERENT runs, so a lucky guess never earns it.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./bridge-content.js') : root.BRIDGE_CONTENT);
  if (isNode) module.exports = api;
  else root.BridgeProgress = api;
})(this, function (C) {
  const KEY = 'tokenfall.bridge.v1', MAX_RUNS = 30;
  const ZONE_CSS = { amber: '#ffb347', green: '#7dff8a', cyan: '#5cd6ff', gold: '#ffd27a' };
  const CARD = Object.fromEntries(C.CARDS.map((c) => [c.id, c]));
  const TOPIC_IDS = Object.keys(C.TOPICS);

  // ---------------------------------------------------------------- pure
  const emptyData = (playerId) => ({ v: 1, playerId, runCount: 0, concepts: {}, runs: [], topicWeights: {} });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, firstTryCorrect: 0, falls: 0, variantsSeen: [], firstTry: [], ms: 0, msN: 0, avgAnswerMs: null, mastered: false, wrong: {} });

  function isMastered(c) {   // some two first-try successes differ in both variant and run
    const f = c.firstTry;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (f[i].v !== f[j].v && f[i].r !== f[j].r) return true;
    return false;
  }
  const conceptScore = (c) => (!c ? 0 : c.mastered ? 1 : c.firstTry.length ? 0.5 : 0);

  function topicStats(d) {
    return TOPIC_IDS.map((id) => {
      const cards = C.CARDS.filter((c) => c.topic === id);   // the boss concepts count towards their topic
      const sum = cards.reduce((n, c) => n + conceptScore(d.concepts[c.id]), 0);
      return { id, name: C.TOPICS[id].name, zone: C.TOPICS[id].zone, mastery: sum / cards.length,
        mastered: cards.filter((c) => (d.concepts[c.id] || {}).mastered).length, total: cards.length, attempts: cards.reduce((n, c) => n + ((d.concepts[c.id] || {}).attempts || 0), 0) };
    });
  }
  // 0.5 (mastered) .. 2.5 (nothing mastered yet); a topic never met gets a neutral 1.5
  function topicWeights(d) {
    const w = {};
    for (const t of topicStats(d)) w[t.id] = +(t.attempts ? 0.5 + 2 * (1 - t.mastery) : 1.5).toFixed(3);
    return w;
  }
  function revisitList(d, n = 4) {
    return Object.keys(d.concepts).map((id) => Object.assign({ id }, d.concepts[id])).filter((c) => CARD[c.id] && !c.mastered && c.attempts)
      .sort((a, b) => b.falls - a.falls || b.attempts - a.attempts || a.id.localeCompare(b.id)).slice(0, n)
      .map((c) => ({ id: c.id, title: CARD[c.id].title, topic: CARD[c.id].topic, topicName: C.TOPICS[CARD[c.id].topic].name, idea: CARD[c.id].idea, falls: c.falls, attempts: c.attempts,
        note: c.falls ? `${c.falls} fall${c.falls === 1 ? '' : 's'}` : 'right first time, not proven yet' }));
  }
  const historyFor = (d) => ({
    runs: d.runs.map((r) => ({ variants: r.variants || [] })),
    concepts: Object.fromEntries(Object.entries(d.concepts).map(([id, c]) => [id, { attempts: c.attempts, falls: c.falls, mastered: c.mastered }])),
    topicWeights: d.topicWeights,
  });

  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, falls: 0, scansUsed: 0, tokens: 0, bestStreak: 0, seconds: 0, variants: (e.seen || []).slice() };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'answer' && CARD[e.conceptId]) {
      const c = concept(d, e.conceptId);
      c.attempts++;
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      if (typeof e.ms === 'number') { c.ms += e.ms; c.msN++; c.avgAnswerMs = Math.round(c.ms / c.msN); }
      if (e.correct) {
        if (e.firstTry) { c.firstTryCorrect++; if (!c.firstTry.some((x) => x.v === e.variantId && x.r === cur.runIndex)) c.firstTry.push({ v: e.variantId, r: cur.runIndex }); if (c.firstTry.length > 24) c.firstTry.shift(); }
      } else { c.falls++; if (e.wrongId) c.wrong[e.wrongId] = (c.wrong[e.wrongId] || 0) + 1; }
      c.mastered = isMastered(c);
      if (cur.run && !cur.run.variants.includes(e.variantId)) cur.run.variants.push(e.variantId);
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, falls: e.falls, scansUsed: e.scans, tokens: e.tokens, bestStreak: e.bestStreak, seconds: e.seconds, variants: e.seen || cur.run.variants });
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, falls: e.falls || cur.run.falls, variants: e.seen || cur.run.variants });
      cur.run = null;
    }
    d.topicWeights = topicWeights(d);
    return d;
  }

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished);
    return {
      game: 'Uplink · The Glass Bridge', schema: 1, exportedAt: now.toISOString(), playerId: d.playerId,
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), tokensBanked: done.reduce((n, r) => n + r.tokens, 0),
        conceptsMastered: Object.values(d.concepts).filter((c) => c.mastered).length, conceptsTotal: C.CARDS.length },
      mastery: 'A concept is mastered after a first-try correct answer in two different variants on two different runs.',
      topics: topicStats(d).map((t) => ({ id: t.id, name: t.name, zone: t.zone, mastery: +t.mastery.toFixed(3), conceptsMastered: t.mastered, conceptsTotal: t.total })),
      concepts: C.CARDS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, topic: c.topic, idea: c.idea, attempts: x.attempts || 0, firstTryCorrect: x.firstTryCorrect || 0, falls: x.falls || 0, variantsSeen: x.variantsSeen || [], avgAnswerMs: x.avgAnswerMs == null ? null : x.avgAnswerMs, mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, falls: r.falls, scansUsed: r.scansUsed, tokens: r.tokens, bestStreak: r.bestStreak, seconds: r.seconds })),
      topicWeights: d.topicWeights,
    };
  }

  // storage is anything with getItem / setItem; load() never throws, save() says whether it worked
  function createStore(storage, key) {
    return {
      load() {
        try { const d = JSON.parse(storage.getItem(key)); return d && d.v === 1 && d.concepts && Array.isArray(d.runs) ? d : null; } catch (e) { return null; }
      },
      save(d) { try { storage.setItem(key, JSON.stringify(d)); return true; } catch (e) { return false; } },
    };
  }
  const memoryStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
  const randomId = () => {
    const c = typeof crypto !== 'undefined' && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('') : Math.random().toString(16).slice(2, 14);
    return 'p-' + c;
  };

  // ---------------------------------------------------------------- the module the game uses
  function create(opts = {}) {
    const fixed = opts.fixed || null;
    let storage = opts.storage;
    if (!storage) { try { storage = window.localStorage; storage.getItem(KEY); } catch (e) { storage = null; } }
    let saved = !!storage;
    const store = createStore(storage || memoryStorage(), KEY + (fixed && fixed.playerId ? ':' + fixed.playerId : ''));
    const data = store.load() || emptyData((fixed && fixed.playerId) || randomId());
    if (fixed && fixed.playerId) data.playerId = fixed.playerId;
    if (fixed && fixed.runIndex != null) data.runCount = fixed.runIndex;
    const cur = { runIndex: 0, run: null };
    let TF = null, play = null, warned = false, panel = null, last = null;

    const persist = () => {
      if (!store.save(data) && saved) { saved = false; }
      if (!saved && !warned && TF) { warned = true; TF.sys('Progress cannot be saved in this browser (private mode?). It lasts until you close the tab; use Export (J) to keep it.'); }
    };

    // ---- report card ----
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function makePanel() {
      const style = document.createElement('style');
      style.textContent = `
        .br { position: absolute; top: 43%; left: 50%; transform: translate(-50%, -50%); width: min(660px, calc(100vw - 32px)); max-height: calc(100vh - 190px); overflow-y: auto; padding: 16px 22px 14px; display: none; font-size: 17px; line-height: 1.4; background: rgba(14, 16, 26, .95); pointer-events: auto; }
        .br h3 { margin: 0; font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: .16em; color: var(--gold); font-weight: 700; }
        .br .sum { margin: 4px 0 10px; font-size: 18px; } .br .sum b { color: #ffe39a; font-weight: 600; }
        .br .row { display: grid; grid-template-columns: 170px 1fr 92px; gap: 10px; align-items: center; margin: 3px 0; font-size: 15px; }
        .br .bar { height: 11px; background: rgba(255,255,255,.1); border: 1px solid rgba(217,180,106,.35); } .br .bar i { display: block; height: 100%; }
        .br .num { text-align: right; opacity: .85; font-size: 14px; }
        .br h4 { margin: 12px 0 4px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .14em; color: var(--gold); }
        .br ul { margin: 0; padding-left: 18px; } .br li { margin: 3px 0; } .br li small { opacity: .8; font-size: 14px; } .br .none { opacity: .8; }
        .br .note { margin-top: 8px; font-size: 13px; opacity: .7; }
        .br .acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 14px; }
        .br button { font: inherit; color: var(--ink); background: rgba(14,16,26,.9); border: 1px solid var(--gold); padding: 4px 12px; cursor: pointer; }
        .br button:hover { background: rgba(217,180,106,.2); } .br kbd { font: inherit; padding: 0 5px; border: 1px solid rgba(243,234,214,.5); margin: 0 2px; }
        @media (max-width: 560px) { .br .row { grid-template-columns: 110px 1fr 66px; } }`;
      document.head.appendChild(style);
      const el = document.createElement('div'); el.className = 'panel br'; document.getElementById('ui').appendChild(el);
      el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.act === 'export') download(); else hide(); });
      return el;
    }
    function render(summary) {
      const stats = topicStats(data), seen = stats.filter((t) => t.attempts), best = seen.slice().sort((a, b) => b.mastery - a.mastery)[0], worst = seen.slice().sort((a, b) => a.mastery - b.mastery)[0];
      const rev = revisitList(data), w = data.topicWeights, next = stats.slice().sort((a, b) => w[b.id] - w[a.id]).slice(0, 2).map((t) => t.name);
      const stars = summary ? '★'.repeat(summary.stars) + '☆'.repeat(3 - summary.stars) : '';
      const sum = summary
        ? `<b>${stars}</b> · <b>${summary.tokens}</b> tokens · <b>${summary.falls}</b> knowledge fall${summary.falls === 1 ? '' : 's'}${summary.scans ? ` · <b>${summary.scans}</b> scan${summary.scans === 1 ? '' : 's'}` : ''} · ${Math.floor(summary.seconds / 60)}m ${String(summary.seconds % 60).padStart(2, '0')}s`
        : `<b>${data.runs.filter((r) => r.finished).length}</b> run${data.runs.filter((r) => r.finished).length === 1 ? '' : 's'} finished · <b>${Object.values(data.concepts).filter((c) => c.mastered).length}/${C.CARDS.length}</b> concepts mastered`;
      panel.innerHTML = `<h3>REPORT CARD</h3><div class="sum">${sum}</div>`
        + stats.map((t) => `<div class="row"><span>${esc(t.name)}</span><span class="bar" role="img" aria-label="${esc(t.name)} ${Math.round(t.mastery * 100)}%"><i style="width:${Math.round(t.mastery * 100)}%;background:${ZONE_CSS[t.zone]}"></i></span><span class="num">${t.mastered}/${t.total} · ${Math.round(t.mastery * 100)}%</span></div>`).join('')
        + '<h4>REVISIT</h4>' + (rev.length ? `<ul>${rev.map((r) => `<li><b>${esc(r.title)}</b> <small>(${esc(r.topicName)}: ${esc(r.note)})</small><br><small>${esc(r.idea)}</small></li>`).join('')}</ul>` : '<div class="none">Nothing to revisit yet. Keep crossing.</div>')
        + (seen.length ? `<div class="note">Next run leans towards: ${esc(next.join(' and '))}.${best && worst && best !== worst ? ` Steadiest: ${esc(best.name)}. Wobbliest: ${esc(worst.name)}.` : ''}</div>` : '')
        + '<div class="note">Mastered = a first-try correct answer in two different variants on two different runs.</div>'
        + '<div class="acts"><button data-act="export" type="button">Export progress (JSON) <kbd>J</kbd></button><button data-act="close" type="button">Close <kbd>E</kbd></button></div>';
    }
    function show(summary) { if (!panel) panel = makePanel(); render(summary); panel.style.display = 'block'; panel.scrollTop = 0; }
    function hide() { if (panel) panel.style.display = 'none'; }
    const open = () => !!panel && panel.style.display === 'block';
    function download() {
      const blob = new Blob([JSON.stringify(buildExport(data), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tokenfall-glass-bridge-progress.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (TF) TF.sys('Progress exported as JSON.');
    }

    const progress = {
      get data() { return data; }, get panelOpen() { return open(); }, storageOk: () => saved,
      newRun() { const r = { playerId: data.playerId, runIndex: data.runCount++, history: historyFor(data) }; persist(); return r; },
      onEvent(e) { applyEvent(data, e, cur); persist(); },
      exportJSON: () => buildExport(data), download, show, hide,
      attach(p, tf) {
        play = p; TF = tf;
        if (!saved) { warned = false; }
        play.debrief = (summary) => {
          last = summary;
          const stats = topicStats(data).filter((t) => t.attempts), best = stats.slice().sort((a, b) => b.mastery - a.mastery)[0], worst = stats.slice().sort((a, b) => a.mastery - b.mastery)[0];
          show(summary);
          TF.talk('Referee', [
            `Across the glass! ${'★'.repeat(summary.stars)}${'☆'.repeat(3 - summary.stars)} Fun fact: this report card is about 90 tokens long.`,
            best && worst && best !== worst ? `Steadiest ground: ${best.name}. Wobbliest: ${worst.name}. The next bridge will lean that way.` : 'Cross a few more bridges and I will tell you where you wobble.',
            'Your report card is up. E closes it, J saves it as JSON, R brings it back.',
          ]);
        };
        const prev = TF.onKey;
        TF.onKey = (e) => {
          if (TF.zone === 'bridge' && !e.repeat) {
            if (e.code === 'KeyJ') { download(); return true; }
            if (e.code === 'KeyR') { open() ? hide() : show(null); return true; }
            if (open() && (e.code === 'KeyE' || e.code === 'Escape')) { hide(); return true; }
          }
          return prev ? prev(e) : false;
        };
        TF.on('enter', (from, z) => { if (from === 'bridge' && z !== 'bridge') hide(); });
      },
    };
    return progress;
  }

  return { KEY, emptyData, applyEvent, topicStats, topicWeights, revisitList, historyFor, buildExport, createStore, isMastered, create };
});
