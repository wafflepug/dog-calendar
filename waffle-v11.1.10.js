/* ============================================================
   WAFFLE HOUSE V11.1.10 — MEET & GREET PRIORITY IS INFORMATIONAL
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.10';

  function isMeetPriorityItem(item) {
    const meta = item?.querySelector('small');
    return /^Meet & Greet today\b/i.test(String(meta?.textContent || '').trim());
  }

  function makeMeetPriorityInformational() {
    if (String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '') !== 'calendar') return;

    document.querySelectorAll('#v1118AttentionPanel .v1118-attention-item').forEach(item => {
      if (!isMeetPriorityItem(item) || item.classList.contains('v11110-informational')) return;

      const replacement = document.createElement('div');
      replacement.className = item.className + ' v11110-informational';
      replacement.setAttribute('role', 'note');
      replacement.innerHTML = item.innerHTML;

      const arrow = replacement.lastElementChild;
      if (arrow && String(arrow.textContent || '').trim() === '›') arrow.remove();

      item.replaceWith(replacement);
    });
  }

  function scheduleRefresh() {
    setTimeout(makeMeetPriorityInformational, 30);
    setTimeout(makeMeetPriorityInformational, 140);
  }

  function wrapOperationsRender() {
    const base = window.renderV10OperationsHome;
    if (typeof base !== 'function' || base.v11110MeetPriorityWrapped) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      scheduleRefresh();
      return result;
    };

    wrapped.v11110MeetPriorityWrapped = true;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.renderV10OperationsHome = wrapped;
  }

  function wrapAttentionRender() {
    const api = window.WAFFLE_V1118;
    const base = api?.renderAttention;
    if (!api || typeof base !== 'function' || base.v11110MeetPriorityWrapped) return;

    const wrapped = async function () {
      const result = await base.apply(this, arguments);
      makeMeetPriorityInformational();
      return result;
    };

    wrapped.v11110MeetPriorityWrapped = true;
    api.renderAttention = wrapped;
  }

  function init() {
    wrapOperationsRender();
    wrapAttentionRender();
    makeMeetPriorityInformational();
    scheduleRefresh();
    setTimeout(() => {
      wrapOperationsRender();
      wrapAttentionRender();
      makeMeetPriorityInformational();
    }, 700);
    window.v11110MeetPriorityVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
