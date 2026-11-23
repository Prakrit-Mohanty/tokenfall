// Token Brew Kitchen — progress and mastery. Browser: window.KitchenProgress. Node: require('./kitchen-progress.js').
//
// ONE store and ONE export for all the games: this module keeps its data in a namespaced slot ("kitchen") of the Glass Bridge's saved data (bridge-progress.js:
// progress.ns / progress.save / progress.addExportSection), so Export JSON gives one file with every game in it under clearly named sections. The saved data stays at
// version 1: a save made before the kitchen existed loads untouched and simply has no "kitchen" slot yet (tested, with the other games' slots beside it).
//
//   create({ shared, fixed })   -> adapter    what kitchen-play.js uses: newRun() -> { playerId, runIndex, history }, onEvent(e), download(), attach(play, TF)
//   install(TF)                 at the lobby's boot: finds window.bridgePlay.progress, plugs the adapter into window.kitchenPlay, adds the export section
//   pure and tested: emptyData, applyEvent, conceptStats, buildExport, isMastered
//
// Data (the "kitchen" slot): { v, runCount, concepts: { id: { attempts, clean, variantsSeen, wrongPot, junk, overflow, missing, late, cleanRuns: [{ v, r }], mastered } },
//   runs: [{ runIndex, seed, finished, stars, points, maxPoints, timeMs, variants }] }
// The concepts are the three lessons of kitchen-orders.js: size (right-size the model), trim (trim the context), check (check before serving).
// Events: run, shift ({ variants }), answer ({ conceptId, variantId, kind, clean }), finish ({ stars, points, maxPoints, timeMs, clean: { conceptId: [variantIds of perfect orders] } }), abandon.
// An answer is one served order: `kind` says how it went (ok, wrongpot, junk, overflow, missing, late), `clean` means all three stars.
// Mastery: a concept is mastered after a PERFECT order in two different variants (tasks) on two different runs. Only a finished run can master anything: a shift left with Esc keeps what
// was served as attempts and earns no mastery.
// Saves from the earlier kitchen (nine token-economy concepts) are not read any more and not touched either: they stay in the file under their own ids.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./kitchen-orders.js') : root.KITCHEN_ORDERS);
  if (isNode) module.exports = api;
  else root.KitchenProgress = api;
})(this, function (O) {
  const NS = 'kitchen', MAX_RUNS = 30;
  const CONCEPT = Object.fromEntries(O.CONCEPTS.map((c) => [c.id, c]));
  const FALL = { wrongpot: 'wrongPot', junk: 'junk', overflow: 'overflow', missing: 'missing', late: 'late' };   // answer kind -> the counter it adds to

  // ---------------------------------------------------------------- pure
  const emptyData = () => ({ v: 1, runCount: 0, concepts: {}, runs: [] });
  const concept = (d, id) => d.concepts[id] || (d.concepts[id] = { attempts: 0, clean: 0, variantsSeen: [], wrongPot: 0, junk: 0, overflow: 0, missing: 0, late: 0, cleanRuns: [], mastered: false });
  function isMastered(c) {   // some two perfect orders differ in both variant and run
    const f = c.cleanRuns;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (f[i].v !== f[j].v && f[i].r !== f[j].r) return true;
    return false;
  }
  // cur = { runIndex, run } is the run in progress (kept by the caller, not saved)
  function applyEvent(d, e, cur) {
    if (e.type === 'run') {
      cur.runIndex = e.runIndex;
      cur.run = { runIndex: e.runIndex, seed: e.seed, finished: false, stars: 0, points: 0, maxPoints: 0, timeMs: 0, variants: [] };
      d.runs.push(cur.run); if (d.runs.length > MAX_RUNS) d.runs.splice(0, d.runs.length - MAX_RUNS);
    } else if (e.type === 'shift' && cur.run) {
      for (const id of e.variants || []) if (!cur.run.variants.includes(id)) cur.run.variants.push(id);
    } else if (e.type === 'answer' && CONCEPT[e.conceptId]) {
      const c = concept(d, e.conceptId);
      if (!c.variantsSeen.includes(e.variantId)) c.variantsSeen.push(e.variantId);
      c.attempts++; if (e.clean) c.clean++;
      if (FALL[e.kind]) c[FALL[e.kind]]++;
    } else if (e.type === 'finish' && cur.run) {
      Object.assign(cur.run, { finished: true, stars: e.stars, points: e.points, maxPoints: e.maxPoints, timeMs: e.timeMs });
      for (const [id, vs] of Object.entries(e.clean || {})) if (CONCEPT[id]) {
        const c = concept(d, id);
        for (const v of vs) if (!c.cleanRuns.some((x) => x.v === v && x.r === cur.runIndex)) c.cleanRuns.push({ v, r: cur.runIndex });
        if (c.cleanRuns.length > 24) c.cleanRuns.splice(0, c.cleanRuns.length - 24);
        c.mastered = isMastered(c);
      }
      cur.run = null;
    } else if (e.type === 'abandon' && cur.run) {
      Object.assign(cur.run, { finished: false, timeMs: e.timeMs || 0 });
      cur.run = null;
    }
    return d;
  }
  const conceptStats = (d) => O.CONCEPTS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, skill: c.skill, idea: c.idea, attempts: x.attempts || 0, clean: x.clean || 0, mastered: !!x.mastered }; });

  function buildExport(d, now = new Date()) {
    const done = d.runs.filter((r) => r.finished), cs = Object.entries(d.concepts).filter(([id]) => CONCEPT[id]).map(([, c]) => c);
    return {
      game: 'Uplink · Token Brew Kitchen', schema: 2, exportedAt: now.toISOString(),
      summary: { runsStarted: d.runs.length, runsFinished: done.length, bestStars: done.reduce((m, r) => Math.max(m, r.stars), 0), bestPoints: done.reduce((m, r) => Math.max(m, r.points || 0), 0),
        ordersServed: cs.reduce((n, c) => n + c.attempts, 0), ordersPerfect: cs.reduce((n, c) => n + c.clean, 0), conceptsMastered: cs.filter((c) => c.mastered).length, conceptsTotal: O.CONCEPTS.length },
      mastery: 'A concept is mastered after a perfect order (the right pot, the right cards and nothing else, under the fill line) in two different tasks on two different runs. Right-size the model, trim the context, check before serving.',
      concepts: O.CONCEPTS.map((c) => { const x = d.concepts[c.id] || {}; return { id: c.id, title: c.title, skill: c.skill, idea: c.idea, attempts: x.attempts || 0, perfect: x.clean || 0, variantsSeen: x.variantsSeen || [], wrongPot: x.wrongPot || 0, junkInPot: x.junk || 0,
        overflowed: x.overflow || 0, leftOut: x.missing || 0, tooLate: x.late || 0, perfectVariants: [...new Set((x.cleanRuns || []).map((y) => y.v))], mastered: !!x.mastered }; }),
      runs: d.runs.map((r) => ({ runIndex: r.runIndex, seed: r.seed, finished: r.finished, stars: r.stars, points: r.points, maxPoints: r.maxPoints, timeMs: r.timeMs })),
    };
  }

  // ---------------------------------------------------------------- the module the game uses
  function create(opts = {}) {
    const shared = opts.shared || null, fixed = opts.fixed || null;
    let local = emptyData(), TF = null; const cur = { runIndex: 0, run: null };
    const data = () => (shared ? shared.ns(NS, emptyData) : local);
    const save = () => { if (shared) shared.save(); };
    function exportAll() {   // the shared export: the bridge's fields plus a section per other game, in one file
      if (shared && shared.download) { shared.download(); return; }
      const blob = new Blob([JSON.stringify(buildExport(data()), null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tokenfall-token-brew-kitchen-progress.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    return {
      get data() { return data(); },
      newRun() { const d = data(), r = { playerId: shared ? shared.data.playerId : (fixed && fixed.playerId) || 'p-local', runIndex: d.runCount++, history: { runs: d.runs.map((x) => ({ variants: x.variants || [] })) } }; save(); return r; },
      onEvent(e) { applyEvent(data(), e, cur); save(); },
      exportJSON: () => (shared ? shared.exportJSON() : buildExport(data())), exportSection: () => buildExport(data()), download: exportAll,
      attach(p, tf) {
        TF = tf; void TF;
        if (shared && shared.addExportSection) shared.addExportSection(NS, (all) => buildExport(all[NS] || emptyData()));
      },
    };
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
  return { NS, emptyData, applyEvent, conceptStats, buildExport, isMastered, create, install };
});
