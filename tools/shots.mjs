#!/usr/bin/env node
// Frozen-time screenshots for before/after visual checks:  node tools/shots.mjs <outDir> [--base http://localhost:8092] [--zones lobby,pune]
// Every requestAnimationFrame callback gets the same timestamp, so the game's dt is 0 from its first frame: NPCs, traffic, the dog, shaders
// and tweens never advance, and with a seeded Math.random two loads of the same code draw the same picture. Per zone it saves
//   <zone>.png               the spawn view
//   <zone>-model-<n>.png     a close-up of each glTF model standing in the zone (cars, bikes, the robot dog), up to 8, nearest the spawn first
// Compare two runs with tools/shot-diff.mjs.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const OUT = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'http://localhost:8092');
const ZONES = opt('zones', 'lobby,pune,abz,lab,airport,us,bridge,kitchen').split(',');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
for (const zone of ZONES) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf(() => cb(1000));
  });
  await page.goto(`${BASE}/index.html?zone=${zone}&q=2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('loading') && window.TokenFall && window.TokenFall.hero, { timeout: 180000, polling: 100 });
  await page.waitForNetworkIdle({ idleTime: 1500, timeout: 120000 }).catch(() => {});
  await page.evaluate(() => { ftAcc = -1e12; dust.visible = false; });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, `${zone}.png`) });
  // the glTF models in this zone: GLTFLoader roots ("Scene" groups) that are in the scene graph and near the zone's centre
  const views = await page.evaluate((zone) => {
    const a = zone === 'lobby' ? { cx: 0, cz: 0 } : AREAS[zone], out = [], b = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
    scene.traverse((o) => {
      if (!o.isGroup || !(o.name === 'Scene' || o.name === 'AuxScene' || o.type === 'Group' && o.userData && o.userData.gltfExtensions)) return;
      if (!o.children.some((k) => k.isMesh || k.children.length)) return;
      b.setFromObject(o); if (b.isEmpty()) return; b.getCenter(c); b.getSize(sz);
      if (Math.hypot(c.x - a.cx, c.z - a.cz) > 140) return;
      out.push({ c: [c.x, c.y, c.z], r: Math.max(sz.x, sz.y, sz.z), d: Math.hypot(c.x - hero.x, c.z - hero.y) });
    });
    // the airport's models are baked copies (airport-assets.js), not glTF roots: the scene children that hold their geometry
    if (typeof AP_ASSETS !== 'undefined' && AP_ASSETS.ready) {
      const geos = new Set(), mark = (g) => g && g.traverse((m) => { if (m.isMesh) geos.add(m.geometry); });
      Object.values(AP_ASSETS.lib).forEach(mark); mark(AP_ASSETS.a320);
      for (const o of scene.children) {
        let hit = false; o.traverse((m) => { if (m.isMesh && geos.has(m.geometry)) hit = true; }); if (!hit) continue;
        b.setFromObject(o); if (b.isEmpty()) continue; b.getCenter(c); b.getSize(sz);
        if (Math.hypot(c.x - a.cx, c.z - a.cz) > 140) continue;
        out.push({ c: [c.x, c.y, c.z], r: Math.min(40, Math.max(sz.x, sz.y, sz.z)), d: Math.hypot(c.x - hero.x, c.z - hero.y) + (sz.x > 20 ? -1000 : 0) });   // the big ones (planes) first
      }
    }
    out.sort((p, q) => p.d - q.d || p.c[0] - q.c[0] || p.c[2] - q.c[2]);
    return out.slice(0, 8);
  }, zone);
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    await page.evaluate((v) => {
      const [x, y, z] = v.c, k = Math.max(2.2, v.r * 1.15);
      window.__shotCam = () => { camera.position.set(x + k * .8, y + k * .55, z + k * .9); camera.lookAt(x, y, z); final.u.focus.value = camera.position.distanceTo(new THREE.Vector3(x, y, z)); };
      if (!window.__shotHooked) { window.__shotHooked = true; life.push(() => window.__shotCam && window.__shotCam()); }
    }, v);
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, `${zone}-model-${i}.png`) });
  }
  process.stderr.write(`${zone}: spawn view + ${views.length} model close-ups\n`);
  await ctx.close();
}
await browser.close();
