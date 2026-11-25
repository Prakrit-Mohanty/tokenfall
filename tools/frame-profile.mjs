#!/usr/bin/env node
// Where a frame's CPU time and garbage go, per zone:  node tools/frame-profile.mjs [--zones lobby,pune] [--base http://localhost:8092] [--out perf/frame-profile.json]
//   callbacks  every anim / life callback (and zoneTick), wrapped and timed over 4 s: total ms, ms per frame, and where it was defined
//   alloc      a sampling heap profile over the same 4 s: bytes allocated per function (self), so per-frame garbage shows up
//   draws      the draw calls of one frame grouped by what is drawn (material type + mesh name / parent name), to find unmerged meshes
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'http://localhost:8092');
const ZONES = opt('zones', 'lobby,pune,abz,lab,airport,us,bridge,kitchen').split(',');
const OUT = opt('out', null);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const result = {};
for (const zone of ZONES) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/index.html?zone=${zone}&q=2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('loading') && window.TokenFall && window.TokenFall.hero, { timeout: 180000, polling: 100 });
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { ftAcc = -1e12; });
  await new Promise((r) => setTimeout(r, 1500));
  const cdp = await page.createCDPSession();
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024 });
  const cb = await page.evaluate(async () => {
    const where = (f) => { const s = f.toString().replace(/\s+/g, ' '); return s.slice(0, 110); };
    const stats = new Map();
    const wrap = (list, kind) => list.forEach((f, i) => { const st = { kind, i, src: where(f), ms: 0, n: 0 }; stats.set(f, st); list[i] = function (...a) { const t = performance.now(); const r = f.apply(this, a); st.ms += performance.now() - t; st.n++; return r; }; });
    wrap(anim, 'anim'); wrap(life, 'life');
    const zt = TokenFall.zoneTick; for (const k in zt) { const f = zt[k], st = { kind: 'zoneTick', i: k, src: where(f), ms: 0, n: 0 }; stats.set(f, st); zt[k] = (...a) => { const t = performance.now(); const r = f(...a); st.ms += performance.now() - t; st.n++; return r; }; }
    let frames = 0, ms = 0; const orig = window.frame; window.frame = function (t) { const s = performance.now(); orig(t); ms += performance.now() - s; frames++; };
    await new Promise((r) => setTimeout(r, 4000));
    window.frame = orig;
    return { frames, frameMs: ms / frames, list: [...stats.values()].filter((s) => s.n).sort((a, b) => b.ms - a.ms).map((s) => ({ ...s, perFrame: +(s.ms / frames).toFixed(3), ms: +s.ms.toFixed(1) })) };
  });
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  // self bytes per function
  const self = new Map();
  const walk = (n) => { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + n.selfSize); (n.children || []).forEach(walk); };
  walk(profile.head);
  const alloc = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ fn: k, kbPerFrame: +(v / 1024 / cb.frames).toFixed(1) }));
  // draw calls of one frame by what is drawn
  const draws = await page.evaluate(async () => {
    const gl = renderer.getContext(), by = new Map(); let cur = null, on = false;
    const name = (o) => { let p = o, path = []; for (let i = 0; p && i < 3; i++, p = p.parent) if (p.name) path.push(p.name); return `${o.material && (o.material.type || '')}${o.material && o.material.transparent ? '(t)' : ''} ${path.join('<') || '(unnamed)'}`; };
    const ob = THREE.Mesh.prototype.onBeforeRender; const hooked = [];
    scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { const f = o.onBeforeRender; hooked.push([o, f]); o.onBeforeRender = function (...a) { if (on) cur = name(o); return f.apply(this, a); }; } });
    const wrapDraw = (k) => { const f = gl[k]; gl[k] = function (...a) { if (on) { const k2 = cur || '(post-processing, shadow or unhooked)'; by.set(k2, (by.get(k2) || 0) + 1); cur = null; } return f.apply(this, a); }; return () => { gl[k] = f; }; };
    const undo = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'].map(wrapDraw);
    await new Promise((r) => requestAnimationFrame(() => { on = true; requestAnimationFrame(() => { on = false; r(); }); }));
    undo.forEach((u) => u()); hooked.forEach(([o, f]) => { o.onBeforeRender = f; });
    return [...by].sort((a, b) => b[1] - a[1]).slice(0, 25);
  });
  result[zone] = { frames: cb.frames, frameMs: +cb.frameMs.toFixed(2), callbacks: cb.list.slice(0, 20), alloc, draws };
  process.stderr.write(`${zone}: ${cb.frames} frames, frame() ${cb.frameMs.toFixed(2)} ms\n`);
  await ctx.close();
}
await browser.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
for (const [z, r] of Object.entries(result)) {
  console.log(`\n=== ${z}: frame() ${r.frameMs} ms`);
  console.log('callbacks (ms per frame):'); r.callbacks.slice(0, 10).forEach((c) => console.log(`  ${String(c.perFrame).padStart(6)}  ${c.kind}[${c.i}] ${c.src}`));
  console.log('alloc (KB per frame, self):'); r.alloc.slice(0, 10).forEach((a) => console.log(`  ${String(a.kbPerFrame).padStart(6)}  ${a.fn}`));
  console.log('draws:'); r.draws.slice(0, 10).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
}
