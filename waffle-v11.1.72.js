/* ============================================================
   WAFFLE HOUSE V11.1.72 — MEET & GREET OUTLOOK ALIGNMENT
   ============================================================
   Aligns the Meet & Greet 7-day outlook with Capacity Outlook:
   weekday at the top, activity centred, date anchored at the bottom.
   The data and existing render pipeline remain unchanged.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.72';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11172MeetOutlookStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11172MeetOutlookStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] .v108-outlook-wrap {
        align-items:stretch !important;
      }
      body[data-waffle-page="calendar"] .v108-outlook-wrap > .v10-ops-card {
        height:100%;
      }
      body[data-waffle-page="calendar"] .v108-meet-card .v10-card-heading {
        min-height:42px;
        align-items:flex-start !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-strip {
        align-items:stretch !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day {
        display:grid !important;
        grid-template-rows:16px minmax(42px,1fr) 14px !important;
        align-content:stretch !important;
        align-items:center !important;
        justify-items:center !important;
        min-height:82px !important;
        box-sizing:border-box;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > small {
        grid-row:1;
        align-self:start;
        margin:0 !important;
        line-height:1.1;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main {
        grid-row:2;
        width:100%;
        min-width:0;
        min-height:0;
        display:flex !important;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:3px;
        margin:0 !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > strong {
        margin:0 !important;
        line-height:1;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > .wh72-meet-events {
        width:100%;
        min-width:0;
        display:grid !important;
        gap:2px;
        margin:0 !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > .wh72-meet-events span {
        display:block;
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        line-height:1.15;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > i {
        grid-row:3;
        align-self:end;
        margin:0 !important;
        line-height:1.1;
      }
      @media (max-width:768px) {
        body[data-waffle-page="calendar"] .v108-meet-day {
          grid-template-rows:14px minmax(40px,1fr) 13px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function alignDay(day) {
    if (!(day instanceof Element)) return;

    const weekday = Array.from(day.children).find(node => node.tagName === 'SMALL');
    const date = Array.from(day.children).find(node => node.tagName === 'I');
    let main = Array.from(day.children).find(node => node.classList?.contains('wh72-meet-main'));

    if (!main) {
      const count = Array.from(day.children).find(node => node.tagName === 'STRONG');
      const events = Array.from(day.children).find(node =>
        node.tagName === 'DIV' && !node.classList.contains('wh72-meet-main')
      );

      main = document.createElement('div');
      main.className = 'wh72-meet-main';
      if (date) day.insertBefore(main, date);
      else day.appendChild(main);

      if (count) main.appendChild(count);
      if (events) {
        events.classList.add('wh72-meet-events');
        main.appendChild(events);
      }
    } else {
      const events = Array.from(main.children).find(node => node.tagName === 'DIV');
      if (events) events.classList.add('wh72-meet-events');
    }

    if (weekday) weekday.classList.add('wh72-meet-weekday');
    if (date) date.classList.add('wh72-meet-date');
    day.dataset.wh72Aligned = VERSION;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('.v108-meet-day').forEach(alignDay);
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
          return node.classList?.contains('v108-meet-day') ||
            node.id === 'v108MeetOutlook' ||
            !!node.querySelector?.('.v108-meet-day');
        })
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    apply();
    observe();
    [80, 220, 520, 1000, 1800, 3200, 5200].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('focus', scheduleApply);
    window.v11172MeetOutlookAlignmentVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
