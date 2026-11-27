// TokenFall: the Crescent Bay lift car, from the team's photos. Step up to a lift door on the ground floor, the second or the third and press E:
// the inside of the car opens over the game (a CSS 3D box, seen from the back of the car looking at the doors, as in the photos). Brushed steel doors and front wall, the control strip left of the doors (floor display, alarm,
// the 5 6 / 3 4 / 1 2 / B G / open close buttons), the eSSL face reader, the Sahara safety notice; the two Calfus values panels down the side
// walls ("We build our own universe" on the left, "Run together, and far" on the right), the black ceiling with its crossed LED bars, the steel
// handrail and the camera dome. Press a floor (click, or the key 1-6, G, B): the doors close, the display counts floors, a ding, they open, and
// you step out there. Calfus has G (Crescent Bay lobby), 2 (HQ), 3 (office-cb3.js) and 4 (office-hq4.js); the face reader turns the others away.
// Esc or the door-open button steps back out where you came in.
// Classic script: shares one global scope with the other js/game files; loaded after loop.js (travel) and crescent-bay.js (CB_ARRIVE).

const LiftCar = (() => {
  const FLOORS = {   // floor label → where it lets you out
    G: { zone: 'pune', name: 'Ground Floor', at: () => [AREAS.pune.cx + CB_ARRIVE[0], AREAS.pune.cz + CB_ARRIVE[1]] },
    // you step out right in front of the doors: each floor's lift (office-hq.js, office-cb3.js, office-hq4.js) less 1.3 m, on the landing
    2: { zone: 'lab', name: 'Calfus HQ · 2nd Floor', at: () => [AREAS.lab.cx - 1.54, AREAS.lab.cz + 13.58 - 1.3] },
    3: { zone: 'cb3', name: 'Calfus HQ · 3rd Floor', at: () => [AREAS.cb3.cx - 1.47, AREAS.cb3.cz + 13.58 - 1.3] },
    4: { zone: 'lab4', name: 'Calfus HQ · 4th Floor', at: () => [AREAS.lab4.cx - 1.47, AREAS.lab4.cz + 13.3 - 1.3] },
  };
  const ORDER = ['B', 'G', '1', '2', '3', '4', '5', '6'];
  const W = 900, H = 1000, D = 1000, P = 700;   // the car in CSS px: width, height, depth; the perspective
  let el, disp, arrow, reader, leaves, cur = 'G', from = null, busy = false, open = false, timers = [];

  const css = `
#liftcar{position:fixed;inset:0;z-index:60;background:#2a1c29;display:none;opacity:0;transition:opacity .35s;overflow:hidden;font-family:var(--sb-font,Poppins),"Trebuchet MS",Arial,sans-serif}
#liftcar.on{opacity:1}
#liftcar .fit{position:absolute;left:50%;top:50%;width:1000px;height:1000px;margin:-500px 0 0 -500px}
#liftcar .view{position:absolute;inset:0;perspective:${P}px;perspective-origin:50% 46%}
#liftcar .stage{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d;transform:translateZ(${P - D / 2 - 140}px)}
#liftcar .f{position:absolute;backface-visibility:hidden;overflow:hidden;box-sizing:border-box}
#liftcar .steel{background:linear-gradient(90deg,#b9aca8 0%,#d8cdc5 22%,#c4b7b1 48%,#e2d7cd 70%,#bfb2ac 100%);box-shadow:inset 0 0 0 3px #6b4a58}
#liftcar .steel::after{content:"";position:absolute;inset:0;background:var(--grain,none),repeating-linear-gradient(90deg,rgba(255,240,225,.10) 0 2px,rgba(74,48,64,.05) 2px 9px);opacity:.9;pointer-events:none}
#liftcar .back{width:${W}px;height:${H}px;left:${-W / 2}px;top:${-H / 2}px;transform:translateZ(${-D / 2}px)}
#liftcar .left{width:${D}px;height:${H}px;left:${-D / 2}px;top:${-H / 2}px;transform:translateX(${-W / 2}px) rotateY(90deg)}
#liftcar .right{width:${D}px;height:${H}px;left:${-D / 2}px;top:${-H / 2}px;transform:translateX(${W / 2}px) rotateY(-90deg)}
#liftcar .ceil{width:${W}px;height:${D}px;left:${-W / 2}px;top:${-D / 2}px;transform:translateY(${-H / 2}px) rotateX(-90deg);background:#3a2838}
#liftcar .floor{width:${W}px;height:${D}px;left:${-W / 2}px;top:${-D / 2}px;transform:translateY(${H / 2}px) rotateX(90deg);background:radial-gradient(ellipse at 50% 20%,#6b5060,#3a2838 75%)}
#liftcar .floor::before{content:"";position:absolute;left:0;right:0;top:0;height:26px;background:linear-gradient(#cfd2d5,#7d8186)}
/* the side walls: steel, a blue Calfus panel, the handrail */
#liftcar .panel{position:absolute;top:70px;bottom:40px;background:linear-gradient(180deg,#3b4f8f 0%,#33447d 55%,#2a3767 100%);color:#fbf0dc;border-radius:26px;border:4px solid #e6c8a2;padding:70px 60px 0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.05)}
#liftcar .panel .net{position:absolute;left:0;right:0;bottom:0;height:300px;opacity:.9}
#liftcar .brand{font-family:var(--sb-title,inherit);font-weight:600;font-size:30px;letter-spacing:-.2px;margin-bottom:60px}
#liftcar .big{font-family:var(--sb-title,inherit);font-weight:800;font-size:58px;line-height:1.02;letter-spacing:-.5px;margin-bottom:70px}
#liftcar .sub{font-size:44px;font-weight:500;letter-spacing:-1px;margin-bottom:14px}
#liftcar ul{margin:0;padding-left:46px;font-size:44px;line-height:1.08;letter-spacing:-1px}
#liftcar li{margin-bottom:34px}
#liftcar h3{font-family:var(--sb-title,inherit);margin:0 0 10px;font-size:38px;font-weight:700;letter-spacing:-1px;line-height:1.04}
#liftcar .vp{font-size:21px;line-height:1.18;margin:0 0 46px;letter-spacing:-.4px}
#liftcar .rail{position:absolute;left:60px;right:120px;top:600px;height:14px;border-radius:7px;background:linear-gradient(#fbf0dc,#c9a98a);box-shadow:0 5px 0 rgba(60,30,50,.35)}
/* the ceiling: black, crossed LED bars */
#liftcar .leds{position:absolute;inset:40px;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(6,1fr)}
#liftcar .leds i{position:relative}
#liftcar .leds i::before,#liftcar .leds i::after{content:"";position:absolute;left:50%;top:50%;width:120px;height:30px;margin:-15px 0 0 -60px;background:#fff4dc;border-radius:15px;box-shadow:0 0 18px 6px rgba(255,214,160,.55)}
#liftcar .leds i::before{transform:rotate(38deg) translateX(-52px)}
#liftcar .leds i::after{transform:rotate(-38deg) translateX(52px)}
#liftcar .cam{position:absolute;width:70px;height:46px;border-radius:0 0 40px 40px;background:radial-gradient(circle at 50% 40%,#1a1a1a 0 12px,#e9eaec 13px)}
/* the front wall: steel, the doors in their frame */
#liftcar .doorway{position:absolute;left:250px;right:40px;top:110px;bottom:0;background:linear-gradient(#f3d79a,#e4b971 60%,#a88752);overflow:hidden;box-shadow:inset 0 0 0 10px #6b4a58;border-radius:14px 14px 0 0}
#liftcar .doorway .out{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(255,250,230,.9),rgba(255,230,170,0) 60%),linear-gradient(90deg,#d8ba86,#f0d6a2 50%,#cfae78)}
#liftcar .doorway .out .pl{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(#5f9a4a 0 38%,#d6b27a 38% 42%,#c39a5e 42%);box-shadow:0 -6px 18px rgba(255,220,150,.6)}
#liftcar .doorway .out b{position:absolute;bottom:60px;width:70px;height:110px;border-radius:12px 12px 30px 30px;background:#2c2d31}
#liftcar .doorway .out b::after{content:"";position:absolute;left:-20px;right:-20px;bottom:90px;height:90px;border-radius:50%;background:#4f8a3c}
#liftcar .leaf{position:absolute;top:0;bottom:0;width:50%;transition:transform 1.1s cubic-bezier(.55,0,.35,1)}
#liftcar .leaf.l{left:0;border-right:2px solid #6c7075}
#liftcar .leaf.r{right:0;border-left:2px solid #f3f4f5}
#liftcar.opened .leaf.l{transform:translateX(-100%)}
#liftcar.opened .leaf.r{transform:translateX(100%)}
#liftcar .frame{position:absolute;left:240px;right:30px;top:100px;height:12px;border-radius:6px;background:#6b4a58}
/* the control strip */
#liftcar .cop{position:absolute;left:150px;width:82px;top:150px;height:820px;border-left:2px solid #6f7378;border-right:2px solid #f0f1f2}
#liftcar .disp{position:absolute;left:12px;right:12px;top:70px;height:170px;border-radius:14px;background:#2a1c29;box-shadow:inset 0 0 0 3px #e6c8a2}
#liftcar .disp span{position:absolute;left:0;right:0;text-align:center;font:700 52px/1 "Courier New",monospace;color:#ffcf8a;text-shadow:0 0 8px rgba(255,180,90,.7)}
#liftcar .disp .ar{top:22px;font-size:24px;height:26px}
#liftcar .disp .fl{top:62px}
#liftcar .disp small{position:absolute;bottom:12px;left:0;right:0;text-align:center;font:600 7px Arial;color:#ddd;letter-spacing:.5px}
#liftcar .btns{position:absolute;left:8px;right:8px;top:300px;display:grid;grid-template-columns:1fr 1fr;gap:16px 8px;justify-items:center}
#liftcar .btns .alarm{grid-column:1/3;display:flex;gap:10px;margin-bottom:30px}
#liftcar .btns .alarm i{width:22px;height:22px;border-radius:50%;background:radial-gradient(#f1d21c 40%,#bbb 45%);display:block}
#liftcar .btns .alarm i+i{background:radial-gradient(#e23b2e 40%,#bbb 45%)}
#liftcar button.k{width:30px;height:30px;border-radius:9px;border:2px solid #e0c09a;background:#fbf0dc;font:700 13px var(--sb-font,Arial);color:#4a3040;padding:0;cursor:pointer;box-shadow:0 2px 0 rgba(60,30,50,.35)}
#liftcar button.k.lit{background:#f4c7d0;border-color:#fff;box-shadow:0 0 10px 3px rgba(255,214,160,.9);color:#4a3040}
#liftcar button.k:hover{filter:brightness(1.12)}
#liftcar .reader{position:absolute;left:200px;top:420px;width:62px;height:118px;border-radius:12px;background:#3a2838;box-shadow:0 0 0 3px #e6c8a2,0 6px 10px rgba(0,0,0,.4)}
#liftcar .reader::before,#liftcar .reader::after{content:"";position:absolute;top:6px;width:8px;height:8px;border-radius:50%;background:#c77dff;box-shadow:0 0 8px #c77dff}
#liftcar .reader::before{left:7px}#liftcar .reader::after{right:7px}
#liftcar .reader .scr{position:absolute;left:8px;right:8px;top:22px;height:62px;background:linear-gradient(#bfe3ff,#6ea7d6);display:flex;align-items:center;justify-content:center;text-align:center;font:700 7px/1.2 Arial;color:#0d2a44;padding:2px}
#liftcar .reader .scr.ok{background:#1f9d55;color:#fff}#liftcar .reader .scr.no{background:#c0392b;color:#fff}
#liftcar .reader em{position:absolute;bottom:8px;left:0;right:0;text-align:center;font:italic 700 8px Arial;color:#ccc}
#liftcar .shelf{position:absolute;left:0;width:330px;top:560px;height:12px;background:linear-gradient(#f4f5f6,#7f8388)}
#liftcar .notice{position:absolute;left:150px;top:150px;width:110px;height:150px;background:#fbf0dc;border:4px solid #33447d;border-radius:8px;font:700 6px/1.25 Arial;color:#1b2a6b;padding:5px;box-sizing:border-box}
#liftcar .notice .rb{background:#d9261c;color:#fff;margin:4px -1px;padding:2px}
#liftcar .notice2{position:absolute;left:160px;top:40px;width:90px;height:105px;background:#fbf0dc;border:2px solid #e0c09a;border-radius:8px;font:6px/1.3 Arial;color:#555;padding:4px;box-sizing:border-box}
#liftcar .hint{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;padding:6px 16px;border-radius:999px;background:#fbf0dc;color:#4a3040;border:2px solid #e6c8a2;box-shadow:0 3px 0 rgba(60,30,50,.25);font:600 15px var(--sb-font,Arial);white-space:nowrap;pointer-events:none}
`;

  // the constellation of dots and lines low on the blue panels
  const net = () => {
    let s = '<svg class="net" viewBox="0 0 600 300" preserveAspectRatio="none"><defs><radialGradient id="lg"><stop offset="0" stop-color="#9fe0ff"/><stop offset="1" stop-color="#9fe0ff" stop-opacity="0"/></radialGradient></defs>';
    const pts = [[40, 250], [120, 190], [210, 260], [300, 210], [390, 280], [470, 200], [560, 250], [160, 120], [250, 160]];
    for (let i = 0; i < pts.length - 1; i++) s += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[i + 1][0]}" y2="${pts[i + 1][1]}" stroke="#5aa8ff" stroke-opacity=".35" stroke-width="2"/>`;
    for (const [x, y] of pts) s += `<circle cx="${x}" cy="${y}" r="16" fill="url(#lg)"/><circle cx="${x}" cy="${y}" r="4" fill="#cfeeff"/>`;
    return s + '<ellipse cx="120" cy="290" rx="160" ry="40" fill="#3d8bff" fill-opacity=".25"/></svg>';
  };

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'liftcar';
    const keys = [['5', '6'], ['3', '4'], ['1', '2'], ['B', 'G']].map(([a, b]) => `<button class="k" data-f="${a}">${a}</button><button class="k" data-f="${b}">${b}</button>`).join('');
    el.innerHTML = `<div class="fit"><div class="view"><div class="stage">
      <div class="f back steel">
        <div class="cop"><div class="disp"><span class="ar"></span><span class="fl">G</span><small>NO SMOKING</small></div>
          <div class="btns"><div class="alarm"><i></i><i></i></div>${keys}<button class="k" data-f="open">◁▷</button><button class="k" data-f="close">▷◁</button></div></div>
        <div class="frame"></div>
        <div class="doorway"><div class="out"><i class="pl"></i></div><div class="leaf l steel"></div><div class="leaf r steel"></div></div>
      </div>
      <div class="f left steel">
        <div class="panel" style="left:60px;right:400px;padding:60px 40px 0">
          <div class="brand">Calfus</div>
          <div class="big">WE BUILD OUR<br>OWN UNIVERSE</div>
          <div class="sub">What Defines Us</div>
          <ul><li>Impeccable in<br>Words</li><li>Fidelity in Action</li><li>Building the Collective</li><li>Audacity in Leadership</li></ul>
          ${net()}
        </div>
        <div class="notice2" style="left:780px;top:120px">Lift licence · Certificate of inspection · Govt. of Maharashtra<br><br>Capacity: 13 persons / 884 kg</div>
        <div class="notice" style="left:770px;top:250px">⚠ Safety matters<br><span style="font-weight:400">Do not jump or play in the lift. Do not force the doors open. Do not overload.</span><div class="rb">Stuck in the elevator?</div><span style="font-weight:400">Press the alarm bell. Stay calm. You are absolutely safe inside the car. The car is ventilated.</span><div class="rb">POWER FAILURE! LIFT IS ON ARD BACKUP. PLEASE WAIT 3 MINUTES.</div>SAHARA<br>ELEVATOR SOLUTIONS</div>
        <div class="reader" style="left:860px;top:450px"><div class="scr">Look at the<br>camera</div><em>eSSL</em></div>
        <div class="rail" style="left:660px;right:40px;top:640px"></div>
      </div>
      <div class="f right steel">
        <div class="panel" style="left:110px;right:110px">
          <div class="brand" style="margin-bottom:46px">Calfus</div>
          <h3>Run together, and far</h3><p class="vp">Build relationships, celebrate success, and recognize contributions. Go the extra mile. Always worth it.</p>
          <h3>Solve for the customer, always</h3><p class="vp">Earn customer trust through candor. Solve for impact. Admit mistakes, go ego-free.</p>
          <h3>Ownership</h3><p class="vp">Take responsibility. Show initiative for the unstated. Every Calfus employee can lead the change to improve the company.</p>
          <h3>Courage, matters</h3><p class="vp">Make decisions boldly, and fast. Be honest about challenges and have the courage to disagree openly, share knowledge. Build the tribe.</p>
          ${net()}
        </div>
        <div class="rail" style="left:30px;right:820px"></div>
      </div>
      <div class="f ceil"><div class="leds">${'<i></i>'.repeat(30)}</div><div class="cam" style="right:40px;top:30px"></div></div>
      <div class="f floor"></div>
    </div></div></div><div class="hint">Press a floor: G · 2 · 3 · 4 &nbsp;·&nbsp; Esc to step out</div>`;
    document.body.appendChild(el);
    disp = el.querySelector('.disp .fl'); arrow = el.querySelector('.disp .ar'); reader = el.querySelector('.reader .scr');
    el.querySelectorAll('button.k').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); press(b.dataset.f); }));
    addEventListener('resize', fit); fit();
    addEventListener('keydown', (e) => {
      if (!open) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      const k = e.key.toUpperCase();
      if (e.code === 'Escape') press('open');
      else if (ORDER.includes(k)) press(k);
    }, true);
  }
  function fit() { if (el) el.querySelector('.fit').style.transform = `scale(${Math.min(innerWidth * 1.1, innerHeight * 1.25) / 1000})`; }
  const later = (ms, f) => timers.push(setTimeout(f, ms));
  const lit = (f, on) => { const b = el.querySelector(`button.k[data-f="${f}"]`); if (b) b.classList.toggle('lit', on); };
  const show = (txt, cls) => { reader.className = 'scr' + (cls ? ' ' + cls : ''); reader.innerHTML = txt; };
  const ding = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + 1.2); o.start(); o.stop(ac.currentTime + 1.2); } catch (e) {} };

  // the view out of the open doors: a picture of the real floor taken from inside the lift, looking out over the landing in front of it.
  // It is drawn with the game's own renderer and copied before the frame is shown, so the doors open onto the floor you are actually on.
  const LOOK = { G: [-1, 0], 2: [0, -1], 3: [0, -1], 4: [0, -1] };   // which way the doors face on each floor (the ground lobby's lift faces west)
  const spot = (f) => { const d = FLOORS[f]; if (d.at) return d.at(); const a = AREAS[d.zone], sp = a.spawn || [0, 4.6]; return [a.cx + sp[0], a.cz + sp[1]]; };
  let snapCam = null;
  function snapshot(f) {
    try {
      const [x, z] = spot(f), [dx, dz] = LOOK[f] || [0, -1], out = el.querySelector('.doorway .out');
      // the game's own view of the landing in front of the lift (its camera angle, its height), with nobody standing in it
      if (!snapCam) snapCam = new THREE.PerspectiveCamera(camera.fov, 1, .1, 400);
      snapCam.fov = camera.fov; snapCam.aspect = out.clientWidth / Math.max(1, out.clientHeight) || .7; snapCam.updateProjectionMatrix();
      const tx = x + dx * 2.6, tz = z + dz * 2.6;   // a little out from the doors, so the landing fills the view
      snapCam.position.set(x + dx * .4, 2.6, z + dz * .4); snapCam.lookAt(tx + dx * 2, .6, tz + dz * 2);   // just outside the doors, above head height: the landing, not the lift's own wall
      const people = [hero, ...npcs].filter((c) => c && c.g), vis = people.map((c) => c.g.visible);
      people.forEach((c) => { c.g.visible = false; });
      renderer.render(scene, snapCam);
      const url = renderer.domElement.toDataURL('image/jpeg', .85);
      people.forEach((c, k) => { c.g.visible = vis[k]; });
      out.style.background = `center / cover no-repeat url(${url})`; if (/[?&]go=/.test(location.search)) { window.__liftSnap = url; console.log('liftsnap', f, url.length); } out.querySelector('.pl').style.display = 'none';
    } catch (e) { /* keep the painted landing */ }
  }
  function press(f) {
    if (busy) return;
    if (f === 'open') { close(); return; }
    if (f === 'close') { el.classList.remove('opened'); return; }
    lit(f, true);
    if (!FLOORS[f]) { show('Floor ' + f + '<br>not authorised', 'no'); later(900, () => { lit(f, false); show('Look at the<br>camera'); }); return; }
    if (f === cur) { show('You are<br>on ' + f, 'ok'); later(700, () => lit(f, false)); return; }
    busy = true; show('Face<br>verified ✓', 'ok');
    el.classList.remove('opened');
    const steps = ORDER.indexOf(f) - ORDER.indexOf(cur), dir = Math.sign(steps), d = FLOORS[f];
    arrow.textContent = dir > 0 ? '▲' : '▼';
    let at = ORDER.indexOf(cur);
    for (let i = 1; i <= Math.abs(steps); i++) later(1100 + i * 750, () => { at += dir; disp.textContent = ORDER[at]; });
    const t = Math.max(3200, 1100 + Math.abs(steps) * 750 + 350);
    // behind the closed doors the game moves you to the new floor; once it has, the doors' view is taken there
    later(1150, () => { if (!traveling) travel({ to: d.zone, zone: from, label: d.name, ...(d.at ? { at: d.at(), dir: f === 'G' ? 'left' : 'up' } : {}) }); from = d.zone; });
    const ready = () => (traveling ? later(120, ready) : later(250, () => snapshot(f)));
    later(1300, ready);
    later(t, () => { arrow.textContent = ''; ding(); cur = f; lit(f, false); el.classList.add('opened'); });
    later(t + 1500, () => { busy = false; hide(); });
  }
  function hide() {
    open = false; el.classList.remove('on'); TF.lockPlayer(false);
    later(380, () => { if (!open) el.style.display = 'none'; });
  }
  function close() { if (busy) return; hide(); }
  // open the car at a floor ('G', '2' or '3'); `zone` is the zone you are standing in
  function enter(floor, zone) {
    if (open || traveling) return;
    if (!el) build();
    timers.forEach(clearTimeout); timers = [];
    cur = floor; from = zone; disp.textContent = floor; arrow.textContent = ''; show('Look at the<br>camera');
    el.querySelectorAll('button.k.lit').forEach((b) => b.classList.remove('lit'));
    el.classList.remove('opened'); el.style.display = 'block'; void el.offsetWidth; el.classList.add('on');
    snapshot(floor);   // the landing you just stepped off, through the open doors
    later(60, () => el.classList.add('opened'));
    later(1100, () => { if (!busy) el.classList.remove('opened'); });   // and the doors close behind you
    open = true; TF.lockPlayer(true); for (const k in keys) keys[k] = false;
  }
  return { enter, press: (f) => press(f), isOpen: () => open };
})();
// ?lift=G|2|3|4 opens (and ?go=… then presses a floor) the car at that floor once the game is running (for testing the car without walking to a lift)
(() => {
  const f = (new URLSearchParams(location.search).get('lift') || '').toUpperCase(), zone = { G: 'pune', 2: 'lab', 3: 'cb3', 4: 'lab4' }[f]; if (!zone) return;
  const go = () => { if (typeof hero !== 'undefined' && hero) setTimeout(() => { LiftCar.enter(f, zone); const g = (new URLSearchParams(location.search).get('go') || '').toUpperCase(); if (g) setTimeout(() => LiftCar.press(g), 1500); }, 2500); else setTimeout(go, 300); };
  setTimeout(go, 300);
})();
