/* Desktop Home columns. Existing nodes return to their original positions on mobile. */
(function () {
  'use strict';
  if (window.WAFFLE_DESKTOP_HOME_LAYOUT) return;

  const query = window.matchMedia('(min-width: 821px)');
  let shell = null;
  let left = null;
  let right = null;
  let entries = [];
  let pinObserver = null;
  let pinFrame = 0;

  function updateCalendarPin() {
    pinFrame = 0;
    if (!right) return;
    const host = right.querySelector('#wh65Calendar');
    const height = right.getBoundingClientRect().height;
    const available = Math.min(window.innerHeight, window.visualViewport?.height || window.innerHeight) - 32;
    // Pin only when the whole calendar fits; tall months and short windows keep natural page scrolling.
    const fits = !!pinObserver && window.matchMedia('(min-width: 1320px)').matches &&
      !!host && height > 0 && height <= available;
    if (right.classList.contains('is-calendar-pinned') !== fits) right.classList.toggle('is-calendar-pinned', fits);
  }

  function scheduleCalendarPin() {
    if (!right || pinFrame) return;
    pinFrame = requestAnimationFrame(updateCalendarPin);
  }


  function targets(panel) {
    return [
      ['left', panel.querySelector(':scope > .v10-operations-home')],
      ['left', panel.querySelector(':scope > .summary-dashboard')],
      ['left', panel.querySelector(':scope > .meet-greet-dashboard')],
      ['left', panel.querySelector(':scope > .mobile-dashboard-toggle')],
      ['right', panel.querySelector(':scope > .search-container')],
      ['right', panel.querySelector(':scope > #calendarEventLegend')],
      ['right', panel.querySelector(':scope > #wh65Calendar')],
      ['right', panel.querySelector(':scope > #calendar')]
    ].filter(([, node]) => node);
  }

  function activate() {
    if (!query.matches || shell || document.body?.dataset?.wafflePage !== 'calendar') return;
    const panel = document.getElementById('calendarTabPanel');
    const nodes = panel && targets(panel);
    if (!panel || !nodes?.some(([, node]) => node.matches('.v10-operations-home')) || !nodes.some(([, node]) => node.id === 'calendar')) return;

    shell = document.createElement('div');
    shell.className = 'wh-desktop-home-layout';
    shell.setAttribute('aria-label', 'Home and calendar');
    left = document.createElement('div');
    left.className = 'wh-desktop-home-column';
    left.setAttribute('aria-label', 'Home');
    right = document.createElement('div');
    right.className = 'wh-desktop-calendar-column';
    right.setAttribute('aria-label', 'Calendar');

    const first = nodes[0][1];
    panel.insertBefore(shell, first);
    shell.append(left, right);
    entries = nodes.map(([column, node]) => {
      const marker = document.createComment('desktop-home-position');
      node.parentNode.insertBefore(marker, node);
      (column === 'left' ? left : right).appendChild(node);
      return { node, marker };
    });
    document.body.classList.add('wh-desktop-home-layout-ready');
    if (typeof ResizeObserver === 'function') {
      pinObserver = new ResizeObserver(scheduleCalendarPin);
      pinObserver.observe(right);
    }
    scheduleCalendarPin();
  }

  function deactivate() {
    if (!shell) return;
    pinObserver?.disconnect();
    pinObserver = null;
    if (pinFrame) cancelAnimationFrame(pinFrame);
    pinFrame = 0;
    const lateHost = right?.querySelector('#wh65Calendar');
    entries.forEach(({ node, marker }) => {
      // A canonical module may retire a legacy panel or control after activation.
      // Restore only nodes this layout still owns; never resurrect retired UI.
      if (shell.contains(node)) marker.parentNode?.replaceChild(node, marker);
      else marker.remove();
    });
    const calendar = document.getElementById('calendar');
    if (lateHost && shell.contains(lateHost) && calendar?.parentNode) calendar.parentNode.insertBefore(lateHost, calendar);
    shell.remove();
    shell = left = right = null;
    entries = [];
    document.body.classList.remove('wh-desktop-home-layout-ready');
  }

  function sync() { query.matches ? activate() : deactivate(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
  query.addEventListener?.('change', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', scheduleCalendarPin, { passive:true });
  window.visualViewport?.addEventListener('resize', scheduleCalendarPin, { passive:true });
  window.WAFFLE_DESKTOP_HOME_LAYOUT = Object.freeze({ sync });
})();
