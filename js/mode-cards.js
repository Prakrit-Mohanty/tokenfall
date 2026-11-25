// TokenFall: the picture cards a minigame shows before a run: Easy or Normal, then Quick or Full. Two big cards side by side, each with a drawing of how
// that mode plays, a difficulty meter and its key, so the choice reads at a glance without the words. A click on a card presses its key (1 or 2), so
// each game keeps its own key handling. Styles: css/mode-cards.css.
// Classic script: loaded before the minigames by index.html.
(function () {
  // the drawings, 96 x 72, in the cards' ink colour; 'tap' a finger on a pocket, 'aim' a striker pulled back along an aim line, 'walk' footsteps onto a
  // tile, 'jump' a figure arcing from tile to tile, 'quick' a stopwatch, 'full' a trophy
  const ICONS = {
    tap: '<rect x="14" y="10" width="68" height="52" rx="8" fill="#fff6e6" stroke="currentColor" stroke-width="3"/><circle cx="26" cy="22" r="7" fill="currentColor"/><circle cx="70" cy="22" r="7" fill="currentColor" opacity=".25"/><circle cx="26" cy="50" r="7" fill="currentColor" opacity=".25"/><circle cx="70" cy="50" r="7" fill="currentColor" opacity=".25"/><circle cx="26" cy="22" r="12" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/><path d="M44 66V40a4 4 0 0 1 8 0v12l10 2a5 5 0 0 1 4 6l-2 6z" fill="#fff6e6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
    aim: '<rect x="14" y="10" width="68" height="52" rx="8" fill="#fff6e6" stroke="currentColor" stroke-width="3"/><circle cx="70" cy="22" r="7" fill="currentColor"/><path d="M36 52 66 26" stroke="currentColor" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/><circle cx="36" cy="52" r="8" fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="3"/><path d="M28 60 18 68" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M54 30a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="2"/>',
    walk: '<path d="M8 58h80" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="56" y="44" width="30" height="14" rx="3" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="2.5"/><ellipse cx="18" cy="48" rx="4" ry="6" fill="currentColor"/><ellipse cx="30" cy="40" rx="4" ry="6" fill="currentColor"/><ellipse cx="42" cy="48" rx="4" ry="6" fill="currentColor"/><path d="M48 28h18m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    jump: '<rect x="6" y="54" width="22" height="10" rx="3" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="2.5"/><rect x="68" y="54" width="22" height="10" rx="3" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="2.5"/><path d="M17 50Q48 -2 79 50" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/><circle cx="48" cy="12" r="6" fill="currentColor"/><path d="M48 18v12m0 0-8 8m8-8 8 8M40 22l8 2 8-6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
    quick: '<circle cx="48" cy="40" r="24" fill="#fff6e6" stroke="currentColor" stroke-width="3.5"/><path d="M42 10h12M48 10v6M68 18l4-4" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M48 40V26" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M48 40 48 16A24 24 0 0 1 69 52z" fill="currentColor" opacity=".3"/><circle cx="48" cy="40" r="3.5" fill="currentColor"/>',
    full: '<path d="M30 12h36v16a18 18 0 0 1-36 0z" fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M30 18H20a10 10 0 0 0 12 14M66 18h10a10 10 0 0 1-12 14" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M48 46v8M36 64h24l-3-10H39z" fill="#fff6e6" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="m48 20 2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="currentColor"/>'
  };
  const svg = (k) => `<svg viewBox="0 0 96 72" aria-hidden="true">${ICONS[k]}</svg>`;
  // one card: key 1 or 2, tone 'easy' (green) or 'hard' (orange), a big name, a short line, a meter of n filled pips out of of, and optionally the Enter mark
  const card = (c) => `<button type="button" class="mc-card ${c.tone}${c.def ? ' def' : ''}" data-key="${c.key}" aria-label="${c.key}: ${c.name}, ${c.line}">` +
    `<span class="mc-key">${c.key}</span>${c.def ? '<span class="mc-enter">Enter</span>' : ''}<span class="mc-art">${svg(c.icon)}</span>` +
    `<span class="mc-name">${c.name}</span><span class="mc-meter">${Array.from({ length: c.of }, (_, i) => `<i class="${i < c.n ? 'on' : ''}"></i>`).join('')}</span>` +
    `<span class="mc-line">${c.line}</span></button>`;
  // modeCards({ easyIcon, normalIcon, easyLine, normalLine, lastEasy }) and runCards({ quickLine, fullLine }): the HTML for a game's panel
  window.modeCards = (o) => `<div class="mc-wrap"><h3 class="mc-title">Choose your mode</h3><div class="mc-row">` +
    card({ key: 1, tone: 'easy', icon: o.easyIcon, name: 'Easy', line: o.easyLine, n: 1, of: 3, def: o.lastEasy }) +
    card({ key: 2, tone: 'hard', icon: o.normalIcon, name: 'Normal', line: o.normalLine, n: 3, of: 3, def: !o.lastEasy }) +
    `</div><p class="mc-foot">Same questions, same score</p></div>`;
  window.runCards = (o) => `<div class="mc-wrap"><h3 class="mc-title">Choose your run</h3><div class="mc-row">` +
    card({ key: 1, tone: 'easy', icon: 'quick', name: 'Quick', line: o.quickLine || '3 rounds · ~3 min', n: 3, of: 5 }) +
    card({ key: 2, tone: 'hard', icon: 'full', name: 'Full', line: o.fullLine || '5 rounds', n: 5, of: 5, def: true }) +
    `</div></div>`;
  // a click on a card presses its key, so the game's own key handler makes the choice
  addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.mc-card'); if (!b) return;
    const k = b.dataset.key; dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + k, key: k, bubbles: true }));
    setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit' + k, key: k, bubbles: true })), 30);
  });
})();
