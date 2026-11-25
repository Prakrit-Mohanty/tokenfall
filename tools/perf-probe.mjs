#!/usr/bin/env node
// TokenFall performance probe: loads every zone in a fresh headless Chrome and records what it costs.
//
//   node tools/perf-probe.mjs [--base http://localhost:8092] [--out perf/baseline.json] [--zones lobby,pune] [--runs 2] [--shots dir]
//
// Per zone (?zone=<key>&q=2, so the quality tier is fixed at "high" and the launcher is skipped):
//   playableMs     navigation start -> the loading card is gone and the first game frame has been drawn
//   settledMs      navigation start -> the last non-media file has arrived (async models such as the cars), never less than playableMs
//   bytes          bytes on the wire per file (encodedDataLength from the DevTools protocol), plus the total
//   script         V8 compile + evaluate time per script file (trace events), plus Chrome's total ScriptDuration
//   render         renderer.info for one whole frame (the post passes included): draw calls, triangles, geometries, textures, programs
//   lights         every light in the scene, the ones lit in this zone, point / spot lights lit, shadow-casting lights lit
//   heapMB         JS heap used after a forced GC
//   frame          CPU ms inside frame() (median, p95) over ~3 s, and the anim / life callback counts
// The adaptive resolution / tier step-down is frozen during the probe so every run renders the same thing.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]]) : a), []));
const BASE = args.base || 'http://localhost:8092';
const OUT = args.out || 'perf/baseline.json';
const RUNS = +(args.runs || 2);
const ZONES = (args.zones || 'lobby,pune,abz,lab,airport,us,bridge,kitchen').split(',');
const SHOTS = args.shots || null;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1280, H = 720;

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const shortUrl = (u) => { try { const x = new URL(u); return x.origin === new URL(BASE).origin ? decodeURIComponent(x.pathname.slice(1)) : x.host + x.pathname; } catch { return u; } };

async function probeZone(browser, zone, run) {
  const ctx = await browser.createBrowserContext();   // fresh profile: empty cache, empty localStorage
  const page = await ctx.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Performance.enable');
  const reqs = new Map(); let inflight = 0, lastNet = Date.now();
  // media (the music) streams in ranges for as long as it plays, so it never counts towards "settled"
  const counts = (r) => r.type !== 'Media';
  cdp.on('Network.requestWillBeSent', (e) => { if (/^(data|blob):/.test(e.request.url) || reqs.has(e.requestId)) return; const r = { url: e.request.url, bytes: 0, type: e.type, start: Date.now() }; reqs.set(e.requestId, r); if (counts(r)) { inflight++; lastNet = Date.now(); } });
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; if (e.response.status >= 400) r.failed = 'HTTP ' + e.response.status; } });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r && r.end == null) { r.bytes = e.encodedDataLength; r.end = Date.now(); if (counts(r)) { inflight--; lastNet = Date.now(); } } });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r && r.end == null) { r.failed = e.errorText; r.end = Date.now(); if (counts(r)) { inflight--; lastNet = Date.now(); } } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message || e).slice(0, 300)));
  // deterministic NPC wandering and screenshots: a seeded Math.random
  await page.evaluateOnNewDocument(() => { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; });

  await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-v8.compile'] });
  const t0 = Date.now();
  for (const r of reqs.values()) r.start = r.start || t0;
  await page.goto(`${BASE}/index.html?zone=${zone}&q=2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('loading') && window.TokenFall && window.TokenFall.hero, { timeout: 180000, polling: 50 });
  // the first frame after boot: frame() runs from requestAnimationFrame; two rAFs later one has certainly been drawn
  const playableMs = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));
  // settled: no request in flight for 1.5 s
  while (inflight > 0 || Date.now() - lastNet < 1500) { if (Date.now() - t0 > 240000) break; await new Promise((r) => setTimeout(r, 100)); }
  const traceBuf = await page.tracing.stop();

  // freeze the adaptive resolution and tier so the counts below are for the forced high tier at full resolution
  await page.evaluate(() => { ftAcc = -1e12; });
  await new Promise((r) => setTimeout(r, 1500));   // let models that arrived become visible and the shaders compile

  const stats = await page.evaluate(async () => {
    const between = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    await between(); await between();
    const ri = renderer.info, render = { calls: ri.render.calls, triangles: ri.render.triangles, points: ri.render.points, lines: ri.render.lines, geometries: ri.memory.geometries, textures: ri.memory.textures, programs: (ri.programs || []).length };
    // lights: whole scene, and the ones that really light this frame (visible, intensity > 0, on a visible branch)
    const L = { total: 0, byType: {}, lit: 0, litPoint: 0, litSpot: 0, litShadow: 0, shadowTotal: 0 };
    const visibleChain = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    let meshes = 0, meshesVisible = 0, casters = 0, castersVisible = 0, instanced = 0;
    scene.traverse((o) => {
      if (o.isLight) {
        L.total++; L.byType[o.type] = (L.byType[o.type] || 0) + 1; if (o.castShadow) L.shadowTotal++;
        if (visibleChain(o) && o.intensity > 0) { L.lit++; if (o.isPointLight) L.litPoint++; if (o.isSpotLight) L.litSpot++; if (o.castShadow) L.litShadow++; }
      }
      if (o.isMesh) { meshes++; if (o.isInstancedMesh) instanced++; const v = visibleChain(o); if (v) meshesVisible++; if (o.castShadow) { casters++; if (v) castersVisible++; } }
    });
    // frame cost: wrap frame() (a global function; the loop looks it up by name each time)
    const ft = []; const orig = window.frame;
    window.frame = function (t) { const s = performance.now(); orig(t); ft.push(performance.now() - s); };
    const raf = []; let prev = performance.now();
    await new Promise((r) => { const end = performance.now() + 3000; const tick = (t) => { raf.push(t - prev); prev = t; if (t < end) requestAnimationFrame(tick); else r(); }; requestAnimationFrame(tick); });
    window.frame = orig;
    return {
      render, lights: L, meshes: { total: meshes, visible: meshesVisible, instanced, castShadow: casters, castShadowVisible: castersVisible },
      sceneChildren: scene.children.length, anim: anim.length, life: life.length, faders: FADERS.length, npcs: npcs.length,
      frameCpu: ft, rafInterval: raf.slice(2), tier: Q.name, resScale, pixelRatio: renderer.getPixelRatio(), zone,
    };
  });
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  const perfMetrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${zone}.png`) }); }

  // V8 compile + evaluate per script from the trace
  const trace = JSON.parse(Buffer.from(traceBuf).toString("utf8")); const perScript = {};
  for (const e of trace.traceEvents || []) {
    if (e.ph !== 'X' || !e.dur) continue;
    let url = null, kind = null;
    if (e.name === 'EvaluateScript' && e.args?.data?.url) { url = e.args.data.url; kind = 'evaluate'; }
    else if ((e.name === 'v8.compile' || e.name === 'V8.CompileCode') && (e.args?.data?.url || e.args?.fileName)) { url = e.args.data?.url || e.args.fileName; kind = 'compile'; }
    else if (e.name === 'v8.parseOnBackground' && e.args?.data?.url) { url = e.args.data.url; kind = 'parseBg'; }
    if (!url) continue;
    const k = shortUrl(url); perScript[k] = perScript[k] || { evaluate: 0, compile: 0, parseBg: 0 }; perScript[k][kind] += e.dur / 1000;
  }
  const bytes = {}; let totalBytes = 0, failed = [];
  for (const r of reqs.values()) { const k = shortUrl(r.url); bytes[k] = (bytes[k] || 0) + r.bytes; totalBytes += r.bytes; if (r.failed) failed.push(`${k}: ${r.failed}`); }
  // settled: the last non-media file arrived (never before playable: the first frame may wait on nothing from the network)
  const lastEnd = Math.max(0, ...[...reqs.values()].filter((r) => r.end && r.type !== 'Media' && !/favicon/.test(r.url)).map((r) => r.end - t0));
  const lastFiles = [...reqs.values()].filter((r) => r.end && r.type !== 'Media').sort((a, b) => b.end - a.end).slice(0, 5).map((r) => `${shortUrl(r.url)} @ ${((r.end - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
  const ft = stats.frameCpu, ri = stats.rafInterval; delete stats.frameCpu; delete stats.rafInterval;
  return {
    zone, run, playableMs: Math.round(playableMs), settledMs: Math.round(Math.max(playableMs, lastEnd)), totalBytes, requests: reqs.size, failed, lastFiles, bytes,
    scriptMs: { total: Math.round((perfMetrics.ScriptDuration || 0) * 1000), perScript }, taskMs: Math.round((perfMetrics.TaskDuration || 0) * 1000),
    heapMB: +(heap.usedSize / 1048576).toFixed(1),
    frame: { cpuMedianMs: +median(ft).toFixed(2), cpuP95Ms: +pct(ft, .95).toFixed(2), rafMedianMs: +median(ri).toFixed(2), frames: ft.length },
    ...stats, consoleErrors,
  };
}

function summarise(runs) {
  // the median run per zone for the numbers that vary; counts come from the last run (they do not vary)
  const by = {}; for (const r of runs) (by[r.zone] = by[r.zone] || []).push(r);
  const zones = {};
  for (const [z, rs] of Object.entries(by)) {
    const last = rs[rs.length - 1];
    zones[z] = { ...last, playableMs: median(rs.map((r) => r.playableMs)), settledMs: median(rs.map((r) => r.settledMs)), heapMB: median(rs.map((r) => r.heapMB)),
      scriptTotalMs: median(rs.map((r) => r.scriptMs.total)), frameCpuMedianMs: median(rs.map((r) => r.frame.cpuMedianMs)), frameCpuP95Ms: median(rs.map((r) => r.frame.cpuP95Ms)),
      runs: rs.map((r) => ({ playableMs: r.playableMs, settledMs: r.settledMs, heapMB: r.heapMB, scriptMs: r.scriptMs.total, frameCpu: r.frame.cpuMedianMs })) };
  }
  return zones;
}

function table(zones) {
  const kb = (b) => (b / 1048576).toFixed(1) + ' MB';
  const head = '| zone | playable | settled | bytes | reqs | script | heap | calls | tris | geos | texs | progs | lights lit (point/shadow) | meshes vis | casters vis | frame cpu med/p95 | anim/life |';
  const rows = Object.values(zones).map((z) => `| ${z.zone} | ${(z.playableMs / 1000).toFixed(2)} s | ${(z.settledMs / 1000).toFixed(2)} s | ${kb(z.totalBytes)} | ${z.requests} | ${z.scriptTotalMs} ms | ${z.heapMB} MB | ${z.render.calls} | ${(z.render.triangles / 1000).toFixed(0)}k | ${z.render.geometries} | ${z.render.textures} | ${z.render.programs} | ${z.lights.lit} (${z.lights.litPoint}/${z.lights.litShadow}) of ${z.lights.total} | ${z.meshes.visible} | ${z.meshes.castShadowVisible} | ${z.frameCpuMedianMs}/${z.frameCpuP95Ms} ms | ${z.anim}/${z.life} |`);
  const any = Object.values(zones)[0];
  const files = Object.entries(any.bytes).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, b]) => `| ${f} | ${(b / 1024).toFixed(0)} KB | ${(any.scriptMs.perScript[f] ? (any.scriptMs.perScript[f].compile + any.scriptMs.perScript[f].evaluate + any.scriptMs.perScript[f].parseBg).toFixed(0) + ' ms' : '')} |`);
  return [`Probe: ${new Date().toISOString()}, ${BASE}, ${W}x${H}, tier forced high (?q=2), median of ${RUNS} cold loads per zone.`, '', head, '|' + '---|'.repeat(17), ...rows, '',
    `Largest files (zone "${any.zone}", bytes on the wire; script = V8 compile + evaluate on the main thread, plus background parse):`, '', '| file | bytes | script |', '|---|---|---|', ...files, ''].join('\n');
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
const all = [];
for (let run = 0; run < RUNS; run++) for (const z of ZONES) {
  process.stderr.write(`run ${run + 1}/${RUNS} ${z} ... `);
  try { const r = await probeZone(browser, z, run); all.push(r); process.stderr.write(`playable ${r.playableMs} ms, ${(r.totalBytes / 1048576).toFixed(1)} MB, ${r.render.calls} calls\n`); }
  catch (e) { process.stderr.write(`FAILED ${e.message}\n`); }
}
await browser.close();
const zones = summarise(all);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ base: BASE, when: new Date().toISOString(), viewport: [W, H], runs: RUNS, zones, raw: all }, null, 1));
fs.writeFileSync(OUT.replace(/\.json$/, '.md'), table(zones));
console.log(table(zones));
