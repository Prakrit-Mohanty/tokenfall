// TokenFall: the lobby leaderboard. Ranks players by correct answers, draws the board's pixel screen and opens the full list.
// Games report scores through TokenFall.leaderboard.set([{ name, correct }]). Ties share a rank (1, 2, 2, 4).
// Classic script: shares one global scope with the other js/game/ files, loaded in order by index.html.

const BOARD_TOP = 5;
const BOARD_SAMPLE = [
  { name: 'pixelpriya', correct: 42 }, { name: 'rosa_j', correct: 37 }, { name: 'kabir_m', correct: 37 },
  { name: 'a.very.long.username.from.marketing', correct: 31 }, { name: 'chaiwala', correct: 24 }, { name: 'ananya.r', correct: 19 },
  { name: 'bobby5', correct: 12 }, { name: 'sneha.d', correct: 6 },
];
const board = { rows: [], sample: false, tex: null, mat: null, el: null, open: false };

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

function drawBoardScreen() {
  const c = board.tex.image, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#15171d'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#b8452e'; g.fillRect(0, 0, W, 22);
  g.font = '600 13px "Pixelify Sans", monospace'; g.textBaseline = 'middle';
  g.fillStyle = '#fff3dc'; g.textAlign = 'left'; g.fillText('MOST CORRECT ANSWERS', 8, 12);
  if (board.sample) { g.textAlign = 'right'; g.fillStyle = '#ffd27a'; g.fillText('SAMPLE', W - 8, 12); }

  if (!board.rows.length) {
    g.textAlign = 'center'; g.fillStyle = '#d6ecff';
    g.fillText('No answers yet.', W / 2, H / 2 + 2); g.fillText('Play a game to get on the board!', W / 2, H / 2 + 20);
    board.tex.needsUpdate = true;
    return;
  }

  rankRows(board.rows).slice(0, BOARD_TOP).forEach(({ rank, name, correct }, i) => {
    const y = 36 + i * 19;
    g.fillStyle = ['#f2b53a', '#cfd5dc', '#e0a878'][rank - 1] || '#3a4a6b';
    g.fillRect(8, y - 7, 16, 14);
    g.fillStyle = rank <= 3 ? '#15171d' : '#fff3dc'; g.textAlign = 'center'; g.fillText(rank, 16, y + 1);
    g.fillStyle = '#fff3dc'; g.textAlign = 'left'; g.fillText(fitText(g, name, W - 80), 32, y + 1);
    g.fillStyle = '#8fe8ff'; g.textAlign = 'right'; g.fillText(correct, W - 8, y + 1);
  });
  board.tex.needsUpdate = true;
}

function boardScreenMaterial() {
  board.tex = canvasTex(240, 132, () => {}, { nearest: true });
  board.mat = new THREE.MeshStandardMaterial({ map: board.tex, emissive: 0xffffff, emissiveMap: board.tex, emissiveIntensity: 1.3, roughness: .5 });
  drawBoardScreen();
  return board.mat;
}

function buildBoardPanel() {
  const el = document.createElement('div'); el.id = 'board';
  el.innerHTML = '<div class="card panel"><div class="title">Leaderboard</div><div class="sub">Most correct answers, all games</div><ol class="rows"></ol><div class="hint"><kbd>E</kbd> or <kbd>Esc</kbd> to close</div></div>';
  el.addEventListener('click', (e) => { if (e.target === el) closeBoard(); });
  document.getElementById('ui').appendChild(el);
  board.el = el;
}

function fillBoardPanel() {
  const list = board.el.querySelector('.rows'), ranked = rankRows(board.rows);
  board.el.querySelector('.title').textContent = board.sample ? 'Leaderboard · sample' : 'Leaderboard';
  list.innerHTML = ranked.length
    ? ranked.map(({ rank, name, correct }) => `<li class="r${Math.min(rank, 4)}"><span class="rank">${rank}</span><span class="name" title="${esc(name)}">${esc(name)}</span><span class="score">${correct}</span></li>`).join('')
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
