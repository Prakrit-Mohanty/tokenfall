#!/usr/bin/env node
// Audit only (changes nothing in the game):  node tools/audit.mjs [--base http://localhost:8092] [--out perf/audit]
//   walk/<zone>.png + walk.json   reachability from the spawn on a 0.2 m grid using the game's own blocked(x, z) (pad .32, no traffic): free floor
//                                 that cannot be reached, interactables and portals that cannot be reached, and the colliders standing on walkable floor
//   ui/<zone>-<panel>.png + ui.json  text that is clipped (overflow hidden with content larger than its box), cut off by the viewport, or covered by
//                                 another element, with each panel the zone offers opened in turn (HUD, Settings, help, glitch log, dialog)
//   console.json                  console errors and warnings per zone, from load through every panel
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'http://localhost:8092'), OUT = opt('out', 'perf/audit');
const WALK_ZONES = ['abz', 'lab', 'us', 'airport'], UI_ZONES = ['lobby', 'pune', 'abz', 'lab', 'airport', 'us', 'bridge', 'kitchen'];
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const d of ['walk', 'ui']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--window-size=1280,720'] });

async function open(zone) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const msgs = [];
  page.on('console', (m) => { if (['error', 'warn', 'warning'].includes(m.type())) msgs.push(`${m.type()}: ${m.text()}`.slice(0, 400)); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + String(e.message || e).slice(0, 400)));
  page.on('requestfailed', (r) => msgs.push(`requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) msgs.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${BASE}/index.html?zone=${zone}&q=2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('loading') && window.TokenFall && window.TokenFall.hero, { timeout: 180000, polling: 100 });
  await page.waitForNetworkIdle({ idleTime: 1500, timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  return { ctx, page, msgs };
}

// ---------------------------------------------------------------- walkability
const walk = {};
for (const zone of WALK_ZONES) {
  const { ctx, page } = await open(zone);
  const r = await page.evaluate(() => {
    const S = 0.2, hx = hero.x, hz = hero.y, a = AREAS[zone];
    // the zone's walkable rects (those within 150 m of its centre)
    const rects = WALK.filter((w) => Math.hypot((w[0] + w[2]) / 2 - a.cx, (w[1] + w[3]) / 2 - a.cz) < 150);
    const x0 = Math.min(...rects.map((w) => w[0])), z0 = Math.min(...rects.map((w) => w[1])), x1 = Math.max(...rects.map((w) => w[2])), z1 = Math.max(...rects.map((w) => w[3]));
    const W = Math.ceil((x1 - x0) / S), H = Math.ceil((z1 - z0) / S), grid = new Uint8Array(W * H);   // 0 outside, 1 blocked by a collider, 2 free, 3 reached
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + (i + .5) * S, z = z0 + (j + .5) * S; grid[j * W + i] = !walkable(x, z) ? 0 : blocked(x, z, .32, false) ? 1 : 2; }
    const si = Math.floor((hx - x0) / S), sj = Math.floor((hz - z0) / S), q = [[si, sj]];
    if (grid[sj * W + si] === 2) grid[sj * W + si] = 3;
    while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const k = nj * W + ni; if (grid[k] === 2) { grid[k] = 3; q.push([ni, nj]); } } }
    // islands: connected free-but-unreached regions
    const seen = new Uint8Array(W * H), islands = [];
    for (let k = 0; k < W * H; k++) {
      if (grid[k] !== 2 || seen[k]) continue;
      let n = 0, sx = 0, sz = 0; const st = [k]; seen[k] = 1;
      while (st.length) { const c = st.pop(), i = c % W, j = (c / W) | 0; n++; sx += i; sz += j; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const kk = nj * W + ni; if (grid[kk] === 2 && !seen[kk]) { seen[kk] = 1; st.push(kk); } } }
      if (n * S * S >= 0.25) islands.push({ m2: +(n * S * S).toFixed(1), x: +(x0 + (sx / n + .5) * S).toFixed(1), z: +(z0 + (sz / n + .5) * S).toFixed(1) });
    }
    islands.sort((p, q2) => q2.m2 - p.m2);
    const cell = (x, z) => { const i = Math.floor((x - x0) / S), j = Math.floor((z - z0) / S); return i < 0 || j < 0 || i >= W || j >= H ? -1 : grid[j * W + i]; };
    const nearReached = (x, z, r) => { for (let dz = -r; dz <= r; dz += S) for (let dx = -r; dx <= r; dx += S) if (dx * dx + dz * dz <= r * r && cell(x + dx, z + dz) === 3) return true; return false; };
    const inters = INTER.filter((it) => cell(it.x, it.z) !== -1).map((it) => ({ label: it.label, verb: it.verb, x: +it.x.toFixed(1), z: +it.z.toFixed(1), reachable: nearReached(it.x, it.z, it.r || 1.2) }));
    const portals = PORTALS.filter((p) => p.zone === zone).map((p) => ({ label: p.label, x: +p.x.toFixed(1), z: +p.z.toFixed(1), reachable: nearReached(p.x, p.z, 1.1) }));
    // colliders on walkable floor (they block part of a walkway), biggest first
    const cols = COL.map((c) => c.r !== undefined ? { kind: 'circle', x: c.x, z: c.z, w: 2 * c.r, d: 2 * c.r } : c.ex !== undefined ? { kind: 'ellipse', x: c.ex, z: c.ez, w: 2 * c.rx, d: 2 * c.rz } : { kind: 'box', x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, w: c.x1 - c.x0, d: c.z1 - c.z0 })
      .filter((c) => c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1 && walkable(c.x, c.z)).map((c) => ({ ...c, x: +c.x.toFixed(2), z: +c.z.toFixed(2), w: +c.w.toFixed(2), d: +c.d.toFixed(2) }));
    let reached = 0, free = 0; for (const v of grid) { if (v === 3) reached++; if (v >= 2) free++; }
    return { zone, origin: [x0, z0], step: S, W, H, grid: Array.from(grid), spawn: [hx, hz], reachedM2: +(reached * S * S).toFixed(1), freeM2: +(free * S * S).toFixed(1), islands: islands.slice(0, 20), inters, portals, collidersOnFloor: cols.length };
  });
  // the map: dark = outside, grey = blocked by a collider, white = reached, red = free but unreachable; blue / magenta = interactable reachable / not; green = spawn
  const sc = 4, png = new PNG({ width: r.W * sc, height: r.H * sc });
  const col = [[40, 40, 48], [120, 120, 128], [230, 60, 60], [245, 244, 238]];
  for (let j = 0; j < r.H; j++) for (let i = 0; i < r.W; i++) { const c = col[r.grid[j * r.W + i]]; for (let y = 0; y < sc; y++) for (let x = 0; x < sc; x++) { const k = ((j * sc + y) * png.width + i * sc + x) * 4; png.data[k] = c[0]; png.data[k + 1] = c[1]; png.data[k + 2] = c[2]; png.data[k + 3] = 255; } }
  const dot = (x, z, c, rad = 3) => { const ci = ((x - r.origin[0]) / r.step) * sc, cj = ((z - r.origin[1]) / r.step) * sc; for (let y = -rad; y <= rad; y++) for (let xx = -rad; xx <= rad; xx++) { const px = Math.round(ci + xx), py = Math.round(cj + y); if (px < 0 || py < 0 || px >= png.width || py >= png.height || xx * xx + y * y > rad * rad) continue; const k = (py * png.width + px) * 4; png.data[k] = c[0]; png.data[k + 1] = c[1]; png.data[k + 2] = c[2]; } };
  for (const it of r.inters) dot(it.x, it.z, it.reachable ? [40, 110, 230] : [220, 0, 220], 4);
  for (const p of r.portals) dot(p.x, p.z, p.reachable ? [240, 180, 0] : [220, 0, 220], 6);
  dot(r.spawn[0], r.spawn[1], [0, 190, 60], 6);
  fs.writeFileSync(path.join(OUT, 'walk', `${zone}.png`), PNG.sync.write(png));
  delete r.grid; walk[zone] = r;
  process.stderr.write(`walk ${zone}: reached ${r.reachedM2} of ${r.freeM2} m2 free, ${r.islands.length} islands, ${r.inters.filter((i) => !i.reachable).length} unreachable interactables\n`);
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(walk, null, 1));

// ---------------------------------------------------------------- UI text and console
const DETECT = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const label = (el) => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') || el.tagName.toLowerCase();
  const pathOf = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(label(e)); return p.join(' > '); };
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'CANVAS', 'svg', 'path'].includes(el.tagName)) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    let hidden = false; for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < .05) { hidden = true; break; } } if (hidden) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const issues = [];
    if ((el.scrollWidth > el.clientWidth + 1 && /hidden|clip|auto|scroll/.test(cs.overflowX)) || (el.scrollHeight > el.clientHeight + 1 && /hidden|clip/.test(cs.overflowY))) issues.push(`clipped (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}${cs.textOverflow === 'ellipsis' ? ', ellipsis' : ''})`);
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) issues.push(`off-screen (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`);
    // covered: the centre of the text box is under another element that is not its own ancestor/descendant
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el) && top.tagName !== 'CANVAS' && getComputedStyle(top).pointerEvents !== 'none') issues.push('covered by ' + pathOf(top));
    if (parseFloat(cs.fontSize) < 10) issues.push(`tiny text ${cs.fontSize}`);
    if (issues.length) out.push({ el: pathOf(el), text: txt.slice(0, 60), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], issues });
  }
  return out;
};
const ui = {}, consoleLog = {};
for (const zone of UI_ZONES) {
  const { ctx, page, msgs } = await open(zone);
  ui[zone] = {};
  const snap = async (name) => { await new Promise((r) => setTimeout(r, 500)); ui[zone][name] = await page.evaluate(DETECT); await page.screenshot({ path: path.join(OUT, 'ui', `${zone}-${name}.png`) }); };
  await snap('hud');
  // Settings panel (top-right button)
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /Settings/.test(b.textContent)); if (b) { b.click(); return true; } return false; });
  if (opened) { await snap('settings'); await page.keyboard.press('Escape'); await page.evaluate(() => { const c = [...document.querySelectorAll('button')].find((b) => /close|done|×/i.test(b.textContent + (b.getAttribute('aria-label') || ''))); if (c) c.click(); }); }
  // glitch log (G) and large text (L): the HUD with the large-text setting on
  await page.keyboard.press('KeyG'); await snap('glitch-log'); await page.keyboard.press('KeyG'); await page.keyboard.press('Escape');
  await page.keyboard.press('KeyL'); await snap('large-text'); await page.keyboard.press('KeyL');
  // a dialog: the nearest interactable's action, as if E was pressed next to it
  const talked = await page.evaluate(() => { const it = INTER.map((i) => ({ i, d: Math.hypot(i.x - hero.x, i.z - hero.y) })).sort((a, b) => a.d - b.d)[0]; if (!it || it.d > 40) return null; try { it.i.act(); return it.i.label; } catch (e) { return 'error: ' + e.message; } });
  if (talked) { await snap('interact'); ui[zone].interactLabel = talked; }
  consoleLog[zone] = [...new Set(msgs)];
  process.stderr.write(`ui ${zone}: ${Object.entries(ui[zone]).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(', ')}; console ${consoleLog[zone].length}\n`);
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'ui.json'), JSON.stringify(ui, null, 1));
fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleLog, null, 1));
await browser.close();
