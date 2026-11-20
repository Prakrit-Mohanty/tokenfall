// A fresh game on every dev-server start: npm run dev stamps index.html with a server start id; when it differs from the one this browser
// last saw, all saved progress (TOKEN-1, parts, Glitch Log, minigame progress and tips) is cleared once and the title screen shows again.
// Settings stay. Pages served any other way carry no id and are never touched. Runs before every other script.
// Browser: reads the meta tag and applies itself. Node: require('./fresh-start.js').
(function () {
  const BOOT_KEY = 'tf.server.boot';
  const LAUNCHER_SEEN = 'tf.started';
  const SETTINGS = ['tokenfall.sound', 'tokenfall.settings', 'tokenfall.daylight', 'tokenfall.bigtext', 'tf.music.muted', 'tokenfall.mill.relaxed'];

  const isProgress = (k) => (k.startsWith('tf.') || k.startsWith('tokenfall.')) && k !== BOOT_KEY && !SETTINGS.includes(k);

  const plan = ({ boot, seen, keys }) => (!boot || boot === seen ? [] : keys.filter(isProgress));

  const keysOf = (storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k) => typeof k === 'string');

  const apply = ({ boot, local, session }) => {
    try {
      const gone = plan({ boot, seen: local.getItem(BOOT_KEY), keys: keysOf(local) });
      if (!boot || local.getItem(BOOT_KEY) === boot) return gone;

      gone.forEach((k) => local.removeItem(k));
      local.setItem(BOOT_KEY, boot);
      session.removeItem(LAUNCHER_SEEN);
      return gone;
    } catch (err) {
      console.warn('Fresh start skipped: storage is not available', err);
      return [];
    }
  };

  const api = { BOOT_KEY, plan, apply };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  const meta = document.querySelector('meta[name="tokenfall-server-boot"]');
  try {
    const gone = apply({ boot: meta && meta.content, local: window.localStorage, session: window.sessionStorage });
    if (gone.length) console.info(`Fresh start: new server run, cleared ${gone.length} saved progress keys`);
  } catch (err) {
    console.warn('Fresh start skipped: storage is not available', err);
  }
})();
