/* ============================================================
   WAFFLE HOUSE V11.1.39 — COMPATIBILITY LOADER
   Keeps V11.0.5 synchronous and ensures the current Ask Waffle stack
   is present on Calendar and Care without duplicating newer HTML loads.
   ============================================================ */
(function () {
  'use strict';

  // Preserve the original V11.0.5 execution order. This loader itself is
  // parser-inserted at the old V11.0.5 script position.
  if (document.readyState === 'loading') {
    document.write('<script src="waffle-v11.0.5-core.js?v=11.1.39"></script>');
  } else {
    const core = document.createElement('script');
    core.src = 'waffle-v11.0.5-core.js?v=11.1.39';
    core.async = false;
    document.head.appendChild(core);
  }

  const TARGET_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script =>
        String(script.src || '').includes('/' + src)
      );

      if (existing) {
        if (ready()) {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src + '?v=11.1.39';
      script.async = false;
      script.dataset.waffleV11139 = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load ' + src)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureAskWaffle() {
    if (!TARGET_PAGES.has(pageName())) return;

    try {
      await loadScript(
        'waffle-v11.1.37-assets.js',
        () => !!(window.WAFFLE_AI_ASSETS && window.WAFFLE_AI_ASSETS.icon)
      );

      await loadScript(
        'waffle-v11.1.37.js',
        () => !!window.v11137AskWaffleVersion
      );

      await loadScript(
        'waffle-v11.1.38.js',
        () => !!window.v11138WaffleAiVersion
      );

      await loadScript(
        'waffle-v11.1.39.js',
        () => !!window.v11139AskWaffleLayoutVersion
      );
    } catch (error) {
      console.warn('Ask Waffle launcher setup failed:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAskWaffle, { once: true });
  } else {
    ensureAskWaffle();
  }
})();
