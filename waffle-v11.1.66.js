/* ============================================================
   WAFFLE HOUSE V11.1.66 — MOBILE MEET & GREET COMPACTION
   ============================================================
   The single V11.1.65 Calendar remains authoritative.

   Desktop keeps the descriptive Meet & Greet syntax:
     Time - Dog Name

   Mobile keeps each Meet & Greet inside exactly one day column and shows only
   the time as its visible title. The full label remains on title/aria-label and
   the existing tap action still opens the underlying Meet & Greet record.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.66';
  const MOBILE_QUERY = '(max-width: 700px)';
  let observer = null;
  let scheduled = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendarPage() {
    return pageName() === 'calendar';
  }

  function isMobile() {
    return window.matchMedia?.(MOBILE_QUERY)?.matches ?? window.innerWidth <= 700;
  }

  function ensureStyle() {
    if (document.getElementById('v11166MobileMeetStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11166MobileMeetStyle';
    style.textContent = `
      @media (max-width:700px) {
        /* The Meet & Greet section keeps the exact same seven-column geometry
           as the date row. No badge may extend beyond its own day. */
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meets {
          grid-template-columns:repeat(7,minmax(0,1fr)) !important;
          width:100% !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-day {
          min-width:0 !important;
          width:auto !important;
          padding:3px 0 !important;
          gap:3px !important;
          overflow:hidden !important;
          box-sizing:border-box !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet {
          width:100% !important;
          min-width:0 !important;
          max-width:100% !important;
          height:22px !important;
          min-height:22px !important;
          margin:0 !important;
          padding:0 2px !important;
          display:flex !important;
          align-items:center !important;
          justify-content:center !important;
          gap:0 !important;
          border-radius:4px !important;
          box-sizing:border-box !important;
          overflow:hidden !important;
          white-space:nowrap !important;
          text-align:center !important;
          box-shadow:none !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-icon {
          display:none !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-copy {
          display:block !important;
          width:100% !important;
          min-width:0 !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
          white-space:nowrap !important;
          text-align:center !important;
          font-size:7px !important;
          font-weight:950 !important;
          line-height:1 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function splitLabel(label) {
    const full = String(label || '').replace(/\s+/g, ' ').trim();
    const separator = full.indexOf(' - ');
    return {
      full,
      time: separator >= 0 ? full.slice(0, separator).trim() : full
    };
  }

  function normaliseButton(button, mobile) {
    if (!(button instanceof Element)) return;
    const copy = button.querySelector('.wh65-meet-copy');
    if (!copy) return;

    const currentText = String(copy.textContent || '').replace(/\s+/g, ' ').trim();
    if (!button.dataset.wh66FullLabel) {
      button.dataset.wh66FullLabel = currentText;
    }

    const labels = splitLabel(button.dataset.wh66FullLabel || currentText);
    if (!labels.full) return;

    button.title = `Meet & Greet · ${labels.full}`;
    button.setAttribute('aria-label', `Meet & Greet · ${labels.full}`);
    button.classList.toggle('wh66-mobile-meet', mobile);
    copy.textContent = mobile ? labels.time : labels.full;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;

    ensureStyle();
    const mobile = isMobile();
    document.querySelectorAll('#wh65Calendar .wh65-meet').forEach(button =>
      normaliseButton(button, mobile)
    );
  }

  function scheduleApply() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(apply);
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.id === 'wh65Calendar' ||
            node.matches?.('.wh65-meet,.wh65-meets,.wh65-week') ||
            !!node.querySelector?.('.wh65-meet');
        })
      );
      if (relevant) scheduleApply();
    });

    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    observe();
    apply();

    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('resize', scheduleApply, { passive:true });
    window.addEventListener('orientationchange', scheduleApply);
    window.addEventListener('pageshow', scheduleApply);
    window.v11166MobileMeetVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
