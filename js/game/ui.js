// TokenFall: HUD, notices, dialogue, banners and keyboard input.
// Classic script: shares one global scope with the other js/game files, loaded in order by index.html.

// ================= UI =================
const logEl = document.getElementById('log');
const NOTICE_MS = 4500;
let noticeT = 0;
// system notices (travel, game hints) show briefly in the corner; people's lines stay in their speech bubbles
function log(name, text, sys) {
  if (!sys) return;
  logEl.innerHTML = `<p class="sys">${esc(text)}</p>`; logEl.classList.add('on');
  clearTimeout(noticeT); noticeT = setTimeout(() => logEl.classList.remove('on'), NOTICE_MS);
}
const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const dlg = document.getElementById('dialog'), dlgName = dlg.querySelector('.name'), dlgText = dlg.querySelector('.text');
let dialog = null;
function talk(name, lines) { dialog = { name, lines, i: 0, ch: 0 }; dlgName.textContent = name; dlg.style.display = 'block'; }
function advanceDialog() {
  const l = dialog.lines[dialog.i];
  if (dialog.ch < l.length) { dialog.ch = l.length; return; }
  dialog.i++; dialog.ch = 0;
  if (dialog.i >= dialog.lines.length) { dialog = null; dlg.style.display = 'none'; }
}
const banner = document.getElementById('banner');
let bannerT = 0;
function showBanner(t, s) { banner.querySelector('.t').textContent = t; banner.querySelector('.s').textContent = s; banner.style.opacity = 1; bannerT = 2600; }
const promptEl = document.getElementById('prompt');
const fadeEl = document.getElementById('fade');

// ================= input =================
const keys = {};
addEventListener('keydown', e => {
  if (dialog) { if (['Space', 'KeyE', 'Enter', 'Escape'].includes(e.code) && !e.repeat) advanceDialog(); e.preventDefault(); return; }
  if (TF.onKey && TF.onKey(e)) { e.preventDefault(); return; }
  keys[e.code] = true;
  if (e.code === 'Space' && !e.repeat) { hero.trigger('jump'); e.preventDefault(); }
  if (e.code === 'KeyE' && !e.repeat && nearest) nearest.act();
  if (e.code === 'KeyV' && !e.repeat) setCamView(camView ^ 1);
});
addEventListener('keyup', e => { keys[e.code] = false; });
// a left click anywhere also moves a dialogue on (like E, Space, Enter or Escape), and the click goes no further
addEventListener('mousedown', e => { if (dialog && e.button === 0) { advanceDialog(); e.preventDefault(); e.stopPropagation(); } }, true);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ================= large text =================
// L scales every HUD panel up by a fifth (css/game.css: #ui.big > .panel); the choice is remembered. A capture listener, so it works inside every minigame, which swallows its own keys.
(() => {
  const ui = document.getElementById('ui'), KEY = 'tokenfall.bigtext';
  const set = (on) => { ui.classList.toggle('big', on); try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} };
  try { if (localStorage.getItem(KEY) === '1') ui.classList.add('big'); } catch (e) {}
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyL' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName)) return;
    set(!ui.classList.contains('big')); showBanner('Large text', ui.classList.contains('big') ? 'On (L to switch off)' : 'Off');
  }, true);
})();
