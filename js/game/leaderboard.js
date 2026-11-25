// TokenFall: the lobby leaderboard. Ranks players by correct answers, draws the board's pixel screen and opens the full list.
// Games report scores through TokenFall.leaderboard.set([{ name, correct }]). Ties share a rank (1, 2, 2, 4).
// Classic script: shares one global scope with the other js/game/ files, loaded in order by index.html.

const BOARD_TOP = 5;
// until real scores come in, the board shows the lobby regulars, so it never stands blank
const BOARD_SAMPLE = [
  { name: 'pixelpriya', correct: 42 }, { name: 'rosa_j', correct: 37 }, { name: 'chaiwala', correct: 35 }, { name: 'sudhanshu', correct: 31 },
  { name: 'riya', correct: 27 }, { name: 'gaurav', correct: 24 }, { name: 'aarav', correct: 19 }, { name: 'bobby5', correct: 12 }, { name: 'mehta', correct: 9 },
];
const board = { rows: BOARD_SAMPLE, sample: true, tex: null, mat: null, el: null, open: false };

function validateRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('leaderboard.set expects an array of { name, correct }');
  rows.forEach((r, i) => {
    if (!r || typeof r.name !== 'string' || !r.name.trim()) throw new TypeError(`leaderboard row ${i}: name must be a non-empty string`);
    if (!Number.isInteger(r.correct) || r.correct < 0) throw new TypeError(`leaderboard row ${i}: correct must be a whole number of 0 or more`);
  });
}

function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
  return sorted.map((r) => ({ ...r, rank: sorted.findIndex((s) => s.correct === r.correct) + 1 }));
}

function fitText(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

// the board's screen, in the style of a mobile game's leaderboard: a peach card in an orange frame, a red ribbon title, then one rounded row per
// player: gold, sky and rose for the top three with a medal, peach below; the name on the left and a coin with the points on the right
const BOARD_ROWS = 6;
function drawBoardScreen() {
  const c = board.tex.image, g = c.getContext('2d'), W = c.width, H = c.height, F = (w, px) => `${w} ${px}px "Fredoka", ${SIGN_FONT}`;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#f2a65a'; g.fillRect(0, 0, W, H);                                         // the orange frame
  rr(18, 64, W - 36, H - 82, 26); g.fillStyle = '#c9773a'; g.fill();                         // the well
  rr(30, 76, W - 60, H - 106, 20); g.fillStyle = '#ffe2c2'; g.fill();
  // the ribbon
  g.fillStyle = '#c23a4a'; for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s2 * 150, 22); g.lineTo(W / 2 + s2 * 205, 22); g.lineTo(W / 2 + s2 * 185, 44); g.lineTo(W / 2 + s2 * 205, 66); g.lineTo(W / 2 + s2 * 150, 66); g.fill(); }
  rr(W / 2 - 170, 10, 340, 58, 16); g.fillStyle = '#e8566a'; g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; rr(W / 2 - 160, 16, 320, 12, 6); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = F(700, 34); g.lineWidth = 7; g.strokeStyle = '#8a1f30'; g.strokeText('LEADERBOARD', W / 2, 41); g.fillStyle = '#ffffff'; g.fillText('LEADERBOARD', W / 2, 41);
  const ranked = rankRows(board.rows).slice(0, BOARD_ROWS), x0 = 44, rw = W - 88, rh = 54, gap = 8, y0 = 88;
  const TONE = [['#ffd86a', '#f2b53a', '#8a5a10'], ['#8fe0f6', '#4fb8e0', '#1f5f80'], ['#ff9aa8', '#e8566a', '#8a1f30']];
  ranked.forEach(({ rank, name, correct }, i) => {
    const y = y0 + i * (rh + gap), t = TONE[rank - 1];
    rr(x0, y + 4, rw, rh, 16); g.fillStyle = t ? t[1] : '#e8a878'; g.fill();               // the row's lip
    rr(x0, y, rw, rh, 16); g.fillStyle = t ? t[0] : '#ffc89a'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; rr(x0 + 12, y + 5, rw - 24, 9, 5); g.fill();
    const ink = t ? t[2] : '#8a4a2a';
    // the rank: a medal for the top three, a plain number after
    if (t) { g.beginPath(); g.arc(x0 + 36, y + rh / 2, 20, 0, Math.PI * 2); g.fillStyle = ['#f6c33a', '#9fb4c8', '#e08a5a'][rank - 1]; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = F(700, 22); g.fillText(rank, x0 + 36, y + rh / 2 + 1); }
    else { g.fillStyle = ink; g.font = F(700, 28); g.fillText(rank, x0 + 36, y + rh / 2 + 1); }
    // the avatar disc
    g.beginPath(); g.arc(x0 + 92, y + rh / 2, 20, 0, Math.PI * 2); g.fillStyle = '#fff6ea'; g.fill(); g.lineWidth = 3; g.strokeStyle = t ? t[1] : '#e8a878'; g.stroke();
    g.fillStyle = ink; g.font = F(700, 20); g.fillText(name.charAt(0).toUpperCase(), x0 + 92, y + rh / 2 + 1);
    // the name
    g.textAlign = 'left'; g.font = F(700, 26); g.fillStyle = ink; g.fillText(fitText(g, name, rw - 340), x0 + 126, y + rh / 2 + 1);
    // the points: a coin and a pill
    const px = x0 + rw - 190; rr(px + 18, y + 11, 160, 32, 16); g.fillStyle = 'rgba(0,0,0,.14)'; g.fill();
    g.beginPath(); g.arc(px + 18, y + rh / 2, 20, 0, Math.PI * 2); g.fillStyle = '#f6c33a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c8901a'; g.stroke();
    g.beginPath(); g.arc(px + 18, y + rh / 2, 11, 0, Math.PI * 2); g.strokeStyle = '#fff2b0'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'right'; g.font = F(700, 24); g.fillStyle = '#ffffff'; g.lineWidth = 5; g.strokeStyle = ink; g.strokeText(`${correct * 100}`, px + 168, y + rh / 2 + 1); g.fillText(`${correct * 100}`, px + 168, y + rh / 2 + 1);
    g.textAlign = 'center';
  });
  if (!ranked.length) { g.fillStyle = '#8a4a2a'; g.font = F(700, 26); g.fillText('No answers yet. Play a game to get on the board!', W / 2, H / 2 + 30); }
  board.tex.needsUpdate = true;
}

function boardScreenMaterial() {
  board.tex = canvasTex(912, 500, () => {}, { smooth: true, keep: true }); board.tex.anisotropy = 8;
  board.mat = new THREE.MeshStandardMaterial({ map: board.tex, emissive: 0xffffff, emissiveMap: board.tex, emissiveIntensity: .55, roughness: .5 });
  drawBoardScreen();
  if (document.fonts && document.fonts.load) document.fonts.load('700 30px "Fredoka"').then(drawBoardScreen).catch(() => {});
  return board.mat;
}

function buildBoardPanel() {
  const el = document.createElement('div'); el.id = 'board';
  el.innerHTML = '<div class="card lb-card"><div class="title">Leaderboard</div><div class="sub">100 points for every correct answer, all games</div><ol class="rows"></ol><div class="hint"><kbd>E</kbd> or <kbd>Esc</kbd> to close</div></div>';
  el.addEventListener('click', (e) => { if (e.target === el) closeBoard(); });
  document.getElementById('ui').appendChild(el);
  board.el = el;
}

function fillBoardPanel() {
  const list = board.el.querySelector('.rows'), ranked = rankRows(board.rows);
  board.el.querySelector('.title').textContent = 'Leaderboard';
  list.innerHTML = ranked.length
    ? ranked.map(({ rank, name, correct }) => `<li class="r${Math.min(rank, 4)}"><span class="rank">${rank}</span><span class="name" title="${esc(name)}">${esc(name)}</span><span class="score"><i></i>${correct * 100}</span></li>`).join('')
    : '<li class="empty">No answers yet. Play a game to get on the board!</li>';
}

// the panel is decoration on top of the board, so a missing animation library only skips the motion
function animateIn() {
  if (!window.anime) return;
  const { animate, stagger } = window.anime;
  animate(board.el.querySelector('.card'), { opacity: [0, 1], translateY: [18, 0], duration: 320, ease: 'outQuad' });
  animate(board.el.querySelectorAll('.rows li'), { opacity: [0, 1], translateX: [-14, 0], delay: stagger(40, { start: 90 }), duration: 260, ease: 'outQuad' });
}

function openBoard() {
  if (!board.el) buildBoardPanel();
  fillBoardPanel();
  for (const k in keys) keys[k] = false;
  board.open = true; board.el.style.display = 'grid';
  animateIn();
}

function closeBoard() {
  if (!board.open) return;
  board.open = false;
  const card = board.el.querySelector('.card');
  if (!window.anime) { board.el.style.display = 'none'; return; }
  window.anime.animate(card, { opacity: 0, translateY: 10, duration: 160, ease: 'inQuad', onComplete: () => { board.el.style.display = 'none'; } });
}

// runs before the game's own key handler, so E and Esc close the panel instead of reaching the world
addEventListener('keydown', (e) => {
  if (!board.open) return;
  if (e.code === 'KeyE' || e.code === 'Escape') closeBoard();
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

const LEADERBOARD_API = {
  set(rows) {
    validateRows(rows);
    board.rows = rows.map((r) => ({ name: r.name.trim(), correct: r.correct })); board.sample = false;
    if (board.tex) drawBoardScreen();
    if (board.open) fillBoardPanel();
  },
  get rows() { return rankRows(board.rows); },
};

function useSampleBoard() { board.rows = BOARD_SAMPLE; board.sample = true; if (board.tex) drawBoardScreen(); }
