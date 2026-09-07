/* ============================================================
   WAFFLE HOUSE — DESKTOP HOME SIDEBAR
   ------------------------------------------------------------
   Desktop/web only:
   - Renames Today to Home.
   - Removes the duplicate Calendar item from the desktop sidebar.
   - Keeps the canonical calendar/today workspace highlighted as Home.
   Mobile navigation is intentionally unchanged.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_DESKTOP_HOME_SIDEBAR) return;

  const VERSION = '1.0.0';
  const DESKTOP_QUERY = '(min-width: 821px)';
  const media = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;
  let observer = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function currentCalendarRouteKey() {
    if (pageName() !== 'calendar') return 'today';
    try {
      return new URLSearchParams(location.search).get('view') === 'today' ? 'today' : 'calendar';
    } catch (_) {
      return 'calendar';
    }
  }

  function applyDesktopHomeSidebar() {
    if (!media?.matches) return false;

    const sidebar = document.getElementById('whSitterDesktopSidebar');
    const nav = sidebar?.querySelector('.wh-sitter-sidebar-nav');
    if (!nav) return false;

    const home = nav.querySelector('[data-wh-sitter-home], [data-wh-sitter-route="today"]');
    const calendar = nav.querySelector('[data-wh-sitter-route="calendar"]');
    if (!home) return false;

    home.dataset.whSitterHome = 'true';
    home.dataset.whSitterRoute = currentCalendarRouteKey();
    home.setAttribute('href', 'index.html?view=today');
    home.setAttribute('aria-label', 'Home');

    const label = home.querySelector('span:last-child');
    if (label) label.textContent = 'Home';

    if (calendar && calendar !== home) calendar.remove();

    const active = pageName() === 'calendar';
    home.classList.toggle('is-active', active);
    if (active) home.setAttribute('aria-current', 'page');
    else home.removeAttribute('aria-current');

    return true;
  }

  function ensureApplied() {
    if (!media?.matches) return;
    if (applyDesktopHomeSidebar()) {
      observer?.disconnect();
      observer = null;
      return;
    }

    if (!document.body || observer) return;
    observer = new MutationObserver(() => {
      if (applyDesktopHomeSidebar()) {
        observer.disconnect();
        observer = null;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function onViewportChange() {
    if (media?.matches) ensureApplied();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureApplied, { once: true });
  } else {
    ensureApplied();
  }

  if (media?.addEventListener) media.addEventListener('change', onViewportChange);
  else if (media?.addListener) media.addListener(onViewportChange);

  window.addEventListener('pageshow', ensureApplied);
  window.WAFFLE_DESKTOP_HOME_SIDEBAR = Object.freeze({
    version: VERSION,
    apply: ensureApplied
  });
})();
