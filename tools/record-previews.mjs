// Records the clips the character picker plays in its preview box (launcher/preview-<id>.mp4): each roster character walking a lap round the real lobby, in the real game.
// How: headless Chrome loads the game as that character, a wide short window and a close camera frame them, the game's own canvas is recorded for exactly one lap
// (the keys are held in a fixed pattern, so the lap repeats and the clip loops), and ffmpeg turns the recording into a small H.264 clip.
// Needs: the dev server running (npm run dev), Google Chrome, ffmpeg. Run: node tools/record-previews.mjs [id ...]   (no ids: all four)
// Env: CHROME (path to Chrome), GAME_URL (default http://127.0.0.1:8765/index.html)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPOT_IDS = createRequire(import.meta.url)('../js/game/encounter-script.js').SPOTS.map((x) => x.id);   // the scripted encounters: walking into one locks the player, so they all count as done
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'launcher');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME = process.env.GAME_URL || 'http://127.0.0.1:8765/index.html';
const PORT = 9337;
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['saanvi', 'riya', 'mehta', 'aarav'];
const VIEW = { w: 1280, h: 350 };   // the box on the picker is about 3.7 times as wide as it is tall
// the lap: left 10 m, up 4 m, right 10 m, down 4 m (3.3 m/s), round a patch of the plaza west of the spawn that is clear of stalls, benches and signs (checked with TokenFall.blocked), so it ends where it began
const START = { x: 2, y: 14 };
const LEGS = [['KeyA', 3000], ['KeyW', 1200], ['KeyD', 3000], ['KeyS', 1200]];
const LAP = LEGS.reduce((t, [, ms]) => t + ms, 0);
const CLIP = { w: 1024, h: 280, fps: 30 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(cdp, id) {
  const { send, evaluate, waitFor } = cdp;
  await send('Emulation.setDeviceMetricsOverride', { width: VIEW.w, height: VIEW.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: GAME });
  await waitFor('typeof TokenFall !== "undefined" && !!document.getElementById("launcher")');
  // skip the title screen, walk as this character, no music, TOKEN-1 already met (its intro would lock the player; it follows along instead) and every encounter done
  await evaluate(`localStorage.setItem("tf.music.muted", "1"); localStorage.setItem("tokenfall.char", ${JSON.stringify(id)}); localStorage.setItem("tf.token1.joined", "1"); localStorage.setItem("tf.encounter.cleared", ${JSON.stringify(JSON.stringify(SPOT_IDS))}); sessionStorage.setItem("tf.started", "1")`);
  await send('Page.navigate', { url: GAME });
  if (!await waitFor(`typeof TokenFall !== "undefined" && !!TokenFall.hero && TokenFall.hero.name === ${JSON.stringify(id)} && !!TokenFall.hero.atlas`)) throw new Error(`the game did not start as ${id}`);
  await sleep(1500);
  if (!await waitFor('!TokenFall.talking && !TokenFall.locked && !TokenFall.traveling', 10000)) throw new Error(`${id}: the player is locked (a dialogue is open), it cannot walk`);
  // at the start of the lap, no HUD, a close follow camera (nearer, lower and narrower than the game's own)
  await evaluate(`(() => { TokenFall.hero.x = ${START.x}; TokenFall.hero.y = ${START.y}; document.getElementById("ui").style.display = "none"; CAM_OFF.set(0, 1.5, 3.4); camera.fov = 40; camera.updateProjectionMatrix(); snapCamera(); })()`);
  await sleep(500);
  // in the page, so the timing is the page's own clock: hold the keys round the lap forever; record exactly the second lap (the first warms the walk and the camera up)
  const b64 = await evaluate(`new Promise((resolve, reject) => {
    const legs = ${JSON.stringify(LEGS)}, lap = ${LAP}, K = TokenFall.keys, t0 = performance.now();
    let start = null, far = 0;   // far: the most the player gets from where the lap began
    const walk = () => { if (start) far = Math.max(far, Math.hypot(TokenFall.hero.x - start.x, TokenFall.hero.y - start.y)); const t = (performance.now() - t0) % lap; let a = 0; for (const [k, ms] of legs) { K[k] = t >= a && t < a + ms; a += ms; } requestAnimationFrame(walk); };
    walk();
    const stream = document.getElementById("c").captureStream(${CLIP.fps});
    const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 6000000 }), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { const fr = new FileReader(); fr.onload = () => resolve({ clip: fr.result.split(",")[1], moved: Math.hypot(TokenFall.hero.x - start.x, TokenFall.hero.y - start.y), far }); fr.readAsDataURL(new Blob(chunks, { type: "video/webm" })); };
    setTimeout(() => { start = { x: TokenFall.hero.x, y: TokenFall.hero.y }; rec.start(); }, lap - ((performance.now() - t0) % lap));
    setTimeout(() => rec.stop(), 2 * lap - ((performance.now() - t0) % lap) + 100);
  })`);
  return b64;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pending = new Map(), errors = [];
    ws.onerror = reject;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : msg.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error(`page error: ${r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text}`);
      return r.result.result.value;
    };
    const waitFor = async (expr, ms = 60000) => { for (let t = 0; t < ms; t += 250) { if (await evaluate(expr) === true) return true; await sleep(250); } return false; };
    ws.onopen = () => resolve({ send, evaluate, waitFor, errors, close: () => ws.close() });
  });
}

const profile = mkdtempSync(join(tmpdir(), 'tf-record-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--mute-audio', `--user-data-dir=${profile}`, `--window-size=${VIEW.w},${VIEW.h}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
try {
  for (let i = 0; ; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { if (i > 50) throw new Error('Chrome did not start (set CHROME to its path)'); await sleep(200); } }
  for (const id of IDS) {
    const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    const { clip, moved, far } = await record(cdp, id);
    if (far < 2) throw new Error(`${id}: the player barely moved (${far.toFixed(1)} m): the keys are not reaching the game`);
    if (cdp.errors.length) console.warn(`${id}: page errors:`, [...new Set(cdp.errors)].slice(0, 3));
    if (moved > 1) console.warn(`${id}: the lap did not close (ended ${moved.toFixed(1)} m from where it began: something is in the way), the clip will jump when it loops`);
    const raw = join(profile, `${id}.webm`);
    writeFileSync(raw, Buffer.from(clip, 'base64'));
    // exactly one lap, 30 fps, no sound, small
    const mp4 = join(OUT, `preview-${id}.mp4`);
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-t', String(LAP / 1000), '-vf', `fps=${CLIP.fps},scale=${CLIP.w}:${CLIP.h}`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8' });
    if (ff.status !== 0) throw new Error(`ffmpeg failed for ${id}: ${ff.stderr}`);
    console.log(`${id}: ${mp4} (walked up to ${far.toFixed(1)} m from the start, lap closed within ${moved.toFixed(2)} m)`);
    cdp.close();
  }
} finally {
  chrome.kill();
  rmSync(profile, { recursive: true, force: true });
}
