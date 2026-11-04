// The Glass Bridge — integration patch for lobby.html: every change the game makes to the lobby, as exact find/replace anchors.
// Build tool, not loaded by the game. To re-apply it to a fresh upstream lobby.html:
//     node tools/bridge-patch.js path/to/upstream-lobby.html lobby.html
// apply() throws if any anchor is missing or not unique, so an upstream lobby.html that moved on fails loudly instead of silently
// (then update the anchor here). The generated lobby.html is what is committed.
//
// Modules load before the lobby script and register with: (window.TokenFallReady = window.TokenFallReady || []).push(TF => ...)
(function (root) {
  const GATE_COLOR = '0xffd27a';

  // exact-text edits: [name, find, replace]
  const PATCHES = [
    ['zone key for lights', `const ZONE_LIGHTS = { lobby: [], lab: [], archive: [], pune: [], abz: [] };`,
      `const ZONE_LIGHTS = { lobby: [], lab: [], archive: [], pune: [], abz: [], bridge: [] };`],
    ['hero altitude + opt-out of the sprite lift', `    c.mesh.position.y = f.lift * .4 * SPU;`,
      `    c.mesh.position.y = (c.noLift ? 0 : f.lift * .4 * SPU) + (c.alt || 0);`],
    ['key hook (a module can consume a key, e.g. Space, M)', `    keys[e.code] = true;\n`,
      `    if (TF.onKey && TF.onKey(e)) { e.preventDefault(); return; }\n    keys[e.code] = true;\n`],
    ['per-zone tick right after the hero moves', `    stepChar(hero, dt);\n    // NPCs`,
      `    stepChar(hero, dt);\n    if (TF.zoneTick[zone]) TF.zoneTick[zone](dt);\n    // NPCs`],
    ['setZone remembers where we came from', `  function setZone(z) {\n    zone = z;`,
      `  function setZone(z) {\n    const prevZone = zone; zone = z;`],
    ['lights of other zones are switched off, not just dimmed (an invisible light costs nothing; an intensity-0 light is still evaluated for every pixel)', `    for (const k in ZONE_LIGHTS) for (const l of ZONE_LIGHTS[k]) l.intensity = k === z ? l.userData.base : 0;`,
      `    for (const k in ZONE_LIGHTS) for (const l of ZONE_LIGHTS[k]) { l.intensity = k === z ? l.userData.base : 0; l.visible = k === z; }`],
    ['setZone applies the zone environment', `    hemi.color.set(indoor ? 0xe8e4dc : 0xcfdcff);`,
      `    hemi.color.set(indoor ? 0xe8e4dc : 0xcfdcff);\n    TF.enter(prevZone, z);`],
    ['facing when returning to the lobby', `hero.dir = p.zone === 'lab' ? 'down' : p.zone === 'archive' ? 'right' : 'left'; }`,
      `hero.dir = AREAS[p.zone].retDir || (p.zone === 'lab' ? 'down' : p.zone === 'archive' ? 'right' : 'left'); }`],
    ['muted NPCs do not chatter', `const here = npcs.filter(c => c.zone === zone); if (here.length)`,
      `const here = npcs.filter(c => c.zone === zone && !c.mute); if (here.length)`],
    ['boot event (zones register here, after hero and NPCs exist)', `    const q = new URLSearchParams(location.search);`,
      `    TF.boot();\n    const q = new URLSearchParams(location.search);`],

    // ---- the fourth gate and its copy ----
    ['gate at the end of the south bollard path', `    gate(17.8, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');`,
      `    gate(17.8, 0, Math.PI / 2, 'Pune', 0x7dff8a, 'lobby', 'pune');\n` +
      `    gate(0, 17.6, 0, 'The Glass Bridge', ${GATE_COLOR}, 'lobby', 'bridge');\n` +
      `    ledSign(['▼ The Glass Bridge'], '#ffe39a', 0, 5.4, 17.6, 3.8, .55);`],
    ['directory sign', `    ledSign(['▲ HQ Office', '◀ Data Archive', 'Pune ▶'], '#d6ecff', -4.6, 1.75, -1.5, 1.6, 1.25, 0, [200, 160]);`,
      `    ledSign(['▲ HQ Office', '◀ Data Archive', 'Pune ▶', 'Glass Bridge ▼'], '#d6ecff', -4.6, 1.75, -1.5, 1.6, 1.5, 0, [200, 192]);`],
    ['directory text', `East: Pune, home of the Calfus office.', 'Walk into a glowing portal to travel.'`,
      `East: Pune, home of the Calfus office. South: the Glass Bridge.', 'Walk into a glowing portal to travel.'`],
    ['notice board', `'📌 Lost: one rubber duck. Answers to “Debug”.']`,
      `'📌 New: the Glass Bridge, south of the plaza. Pick the right tile. Or don\\'t.', '📌 Lost: one rubber duck. Answers to “Debug”.']`],
    ['Glass Bridge terminal in the Conference Room (north-east corner, between the table and the door wall)', `where they go wrong.”'], { table: 'long', seats: 3, along: true });`,
      `where they go wrong.”', 'In the corner there is a terminal for the Glass Bridge: pick the right tile, or fall.'], { table: 'long', seats: 3, along: true });\n` +
      `    if (TF.officeEntrance) TF.officeEntrance({ x: X(-3.1) - .55, z: Z(-10.5) + .6, near: [X(-3.1) - .5, Z(-10.5) + 1.9] });`],
    ['token statue', `'“TokenFall” might be 3 tokens. Or 2. It depends on the model!']`,
      `'“TokenFall” might be 3 tokens. Or 2. It depends on the model!', 'Rumour: the glass bridge south of here only holds up the right answer.']`],
  ];

  // appended inside the lobby IIFE (everything private is in scope)
  const API = `
  // ================= TokenFall API (Glass Bridge integration) =================
  // Modules register with (window.TokenFallReady = window.TokenFallReady || []).push(TF => ...).
  const TF = window.TokenFall = {
    THREE, scene, camera, renderer, hemi, sun, FOG, CAM_OFF, MAT, TX, rnd, rr, timeU, keys, post: final.u,
    INTER, PORTALS, WALK, COL, ZONE_LIGHTS, FADERS, AREAS, anim, life,
    canvasTex, std, box, boxGeo, faceBox, plane, add, pointLight, ledSign, ledTex, signBoard, textTex, glowStrip, glowDisc,
    gate, portal, scatter, streetLamp, officeBlock, tree, colBox, colCirc, makeFader, talk, snapCamera, travel, blocked,
    get hero() { return hero; }, get zone() { return zone; }, get talking() { return !!dialog; }, get traveling() { return traveling; },
    zoneTick: {}, zoneEnv: {}, ground: {}, onKey: null, _on: { boot: [], enter: [] },
    on(evt, fn) { this._on[evt].push(fn); return fn; },
    boot() { this._on.boot.forEach(f => f()); },
    // called from setZone: per-zone fog/background/sun/hemi (defaults restored for zones without an env), then listeners
    enter(prev, z) {
      const e = this.zoneEnv[z] || {};
      const col = e.fog != null ? e.fog : FOG;
      scene.fog.color.set(col); scene.background.set(col);
      scene.fog.near = e.near != null ? e.near : 34; scene.fog.far = e.far != null ? e.far : 95;
      if (e.sun != null) sun.intensity = e.sun;
      if (e.hemi != null) hemi.intensity = e.hemi;
      if (e.hemiColor != null) hemi.color.set(e.hemiColor);
      if (prev !== z) this._on.enter.forEach(f => f(prev, z));
    },
    sys(text) { log('', text, true); },
    banner(title, sub) { showBanner(title, sub); },
    // fade to black, run cb while black, fade back; input and portals are locked meanwhile
    fade(cb, ms = 480) { traveling = true; fadeEl.style.opacity = 1; setTimeout(() => { cb(); fadeEl.style.opacity = 0; traveling = false; }, ms); },
    registerZone(key, o) {
      AREAS[key] = Object.assign({ key, cx: 0, cz: 0, name: key, sub: '', color: 0xffffff, ret: [0, 0], spawn: [0, 0] }, o);
      ZONE_LIGHTS[key] = ZONE_LIGHTS[key] || [];
      if (o.env) this.zoneEnv[key] = o.env;
      return AREAS[key];
    },
    // fn(x, z, y) -> ground height or null (a void); stored for the zone's tick to consult
    setGroundProvider(zoneKey, fn) { this.ground[zoneKey] = fn; },
    // a still, silent NPC (talk() on E, never wanders, never chats)
    addNPC(name, x, z, zoneKey, lines) {
      NPC_TALK[name] = lines; NPC_BOUNDS[zoneKey] = [x, z, x, z];
      const c = makeChar(name, x, z, { speed: 1, zone: zoneKey });
      c.wait = 1e12; c.mute = true; c.dir = 'down'; npcs.push(c); return c;
    },
  };
  const _ready = window.TokenFallReady || [];
  window.TokenFallReady = { push(f) { f(TF); } };
  _ready.forEach(f => f(TF));
`;

  function once(src, find, name) {
    const n = src.split(find).length - 1;
    if (n !== 1) throw new Error(`bridge-patch: "${name}" anchor found ${n} times (expected 1)`);
  }

  // opts.scripts: script src paths inserted after the sprite sheet script (before the lobby script runs)
  // opts.inline:  extra inline <script> source inserted right after them
  function apply(src, opts = {}) {
    let out = src;
    for (const [name, find, replace] of PATCHES) { once(out, find, name); out = out.replace(find, () => replace); }
    const anchor = '<script src="js/aditya-sheet.js"></script>\n';
    once(out, anchor, 'script tags');
    const tags = (opts.scripts || []).map((s) => `<script src="${s}"></script>\n`).join('') + (opts.inline ? `<script>\n${opts.inline}\n</script>\n` : '');
    out = out.replace(anchor, () => anchor + tags);
    const end = out.lastIndexOf('})();');
    if (end < 0) throw new Error('bridge-patch: lobby IIFE end not found');
    return out.slice(0, end) + API.replace(/^\n/, '') + out.slice(end);
  }

  const SCRIPTS = ['js/bridge-content.js', 'js/bridge-generator.js', 'js/bridge-world.js', 'js/bridge-play.js', 'js/bridge-progress.js'];
  const INSTALL = '(window.TokenFallReady = window.TokenFallReady || []).push((TF) => BridgePlay.install(TF));';
  const api = { PATCHES, API, SCRIPTS, INSTALL, apply };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    if (require.main === module) {   // node tools/bridge-patch.js <in.html> <out.html>
      const fs = require('fs'), [input, output] = process.argv.slice(2);
      if (!input || !output) { console.error('usage: node tools/bridge-patch.js <upstream lobby.html> <output lobby.html>'); process.exit(1); }
      fs.writeFileSync(output, apply(fs.readFileSync(input, 'utf8'), { scripts: SCRIPTS, inline: INSTALL }));
      console.log(`wrote ${output} (${PATCHES.length} edits, ${SCRIPTS.length} scripts)`);
    }
  } else root.BridgePatch = api;
})(this);
