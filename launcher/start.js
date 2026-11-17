// Shows the launcher over the game; window.TokenFallStart resolves when the player presses Enter, and main.js waits on it.
// Deep links (?zone= / ?at=) skip straight into the game, and so does a reload of a tab that already got past the menu.
window.TokenFallStart = new Promise((start) => {
  const el = document.getElementById('launcher');
  const q = new URLSearchParams(location.search);

  let seen = false; try { seen = sessionStorage.getItem('tf.started') === '1'; } catch (e) {}
  if (q.has('zone') || q.has('at') || seen) { el.remove(); start(); return; }

  // the game listens on window; keep launcher keys from moving the hero or opening chat
  const swallow = (e) => e.stopPropagation();
  el.addEventListener('keydown', swallow);
  el.addEventListener('keyup', swallow);

  const launcher = TokenfallLauncher.mount(el, {
    onStart: () => { try { sessionStorage.setItem('tf.started', '1'); } catch (e) {} launcher.destroy(); el.remove(); start(); },
  });
});
