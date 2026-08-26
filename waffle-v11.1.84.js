/* ============================================================
   WAFFLE HOUSE V11.1.84 — READABLE CALENDAR DAY NUMBERS
   ============================================================
   Makes the single Calendar's date numbers easier to scan on desktop and
   mobile without changing stay lanes, Meet & Greets or capacity health.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.84';

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11184ReadableCalendarDayStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11184ReadableCalendarDayStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
        min-height:42px !important;
        gap:7px !important;
        padding:7px 9px !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date-number {
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        min-width:25px !important;
        height:25px !important;
        padding:0 3px !important;
        box-sizing:border-box !important;
        border-radius:8px !important;
        color:var(--wh65-text) !important;
        font-size:15px !important;
        line-height:1 !important;
        font-weight:950 !important;
        letter-spacing:-0.02em !important;
        font-variant-numeric:tabular-nums !important;
        text-align:center !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date.is-today .wh65-date-number {
        background:var(--wh65-accent) !important;
        color:#fff !important;
        box-shadow:0 2px 7px color-mix(in srgb,var(--wh65-accent) 28%,transparent) !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date.is-other .wh65-date-number {
        color:var(--wh65-muted) !important;
        opacity:.72 !important;
        font-weight:850 !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        margin-left:auto !important;
        margin-right:1px !important;
      }

      @media (max-width:700px) {
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
          min-height:38px !important;
          gap:4px !important;
          padding:6px 5px !important;
        }

        body[data-waffle-page="calendar"] #wh65Calendar .wh65-date-number {
          min-width:23px !important;
          height:23px !important;
          padding:0 2px !important;
          border-radius:7px !important;
          font-size:14px !important;
        }

        body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
          width:7px !important;
          height:7px !important;
          flex-basis:7px !important;
          margin-right:0 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    window.v11184ReadableCalendarDayVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
