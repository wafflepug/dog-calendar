/* ============================================================
   WAFFLE HOUSE V11.1.39 — ASK WAFFLE LAUNCHER PARITY
   Calendar + Care use the same floating circular Waffle launcher
   on mobile and desktop.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.39';
  const TARGET_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function ensureStyle() {
    if (document.getElementById('aw39-launcher-style')) return;

    const style = document.createElement('style');
    style.id = 'aw39-launcher-style';
    style.textContent = `
      body[data-waffle-page="calendar"] #aw37launch.aw39-round-launch,
      body[data-waffle-page="directory"] #aw37launch.aw39-round-launch {
        position: fixed !important;
        right: 18px !important;
        bottom: 22px !important;
        width: 52px !important;
        height: 52px !important;
        min-width: 52px !important;
        min-height: 52px !important;
        padding: 0 !important;
        gap: 0 !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        z-index: 2147481000 !important;
      }

      body[data-waffle-page="calendar"] #aw37launch.aw39-round-launch > span,
      body[data-waffle-page="directory"] #aw37launch.aw39-round-launch > span {
        display: none !important;
      }

      body[data-waffle-page="calendar"] #aw37launch.aw39-round-launch > img,
      body[data-waffle-page="directory"] #aw37launch.aw39-round-launch > img {
        width: 40px !important;
        height: 40px !important;
        object-fit: contain !important;
      }

      @media (max-width: 768px) {
        body[data-waffle-page="calendar"] #aw37launch.aw39-round-launch,
        body[data-waffle-page="directory"] #aw37launch.aw39-round-launch {
          right: 12px !important;
          bottom: calc(88px + env(safe-area-inset-bottom)) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normaliseLauncher() {
    if (!TARGET_PAGES.has(pageName())) return false;

    const button = document.getElementById('aw37launch');
    if (!button) return false;

    button.classList.add('float', 'aw39-round-launch');
    button.setAttribute('aria-label', 'Ask Waffle');
    button.setAttribute('title', 'Ask Waffle');

    // Calendar previously inserted Ask Waffle into the header. Move it to the
    // document body so Calendar and Care share the same fixed launcher model.
    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }

    return true;
  }

  function apply() {
    if (!TARGET_PAGES.has(pageName())) return;
    ensureStyle();
    normaliseLauncher();
  }

  function start() {
    apply();

    // The Ask Waffle stack self-heals on a few delayed passes. Mirror those
    // passes so the launcher stays floating even on slower PWA/device starts.
    [80, 220, 500, 1000, 2200, 5000].forEach(delay => {
      setTimeout(apply, delay);
    });

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);

    const observer = new MutationObserver(() => {
      if (document.getElementById('aw37launch')) apply();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false });
    }

    window.v11139AskWaffleLayoutVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
