/* ============================================================
   WAFFLE HOUSE V11.1.73 — OPERATIONS PUG AVATARS
   ============================================================
   Replaces the four Operations emoji icons with the matching pug avatar
   artwork supplied for At Home, Arriving, Departing and Meet & Greet.
   Counts, labels, card actions and layout remain unchanged.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.73';
  const ICONS = {
    home: { src: 'ops-at-home.webp?v=11.1.73', alt: 'At Home pug avatar' },
    arriving: { src: 'ops-arriving.webp?v=11.1.73', alt: 'Arriving pug avatar' },
    departing: { src: 'ops-departing.webp?v=11.1.73', alt: 'Departing pug avatar' },
    meet: { src: 'ops-meet-greet.webp?v=11.1.73', alt: 'Meet and Greet pug avatar' }
  };

  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11173OperationsAvatarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11173OperationsAvatarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] .v10-stat-icon.wh73-operations-avatar {
        padding:0 !important;
        overflow:hidden !important;
        background:transparent !important;
        box-shadow:none !important;
      }
      body[data-waffle-page="calendar"] .v10-stat-icon.wh73-operations-avatar > img {
        display:block !important;
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
        object-position:center !important;
        border-radius:inherit !important;
      }
    `;
    document.head.appendChild(style);
  }

  function cardIconKey(card) {
    const text = String(card?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text.includes('at home')) return 'home';
    if (text.includes('arriving')) return 'arriving';
    if (text.includes('leaving') || text.includes('departing')) return 'departing';
    if (text.includes('meet & greet') || text.includes('meet and greet')) return 'meet';
    return '';
  }

  function applyCard(card) {
    if (!(card instanceof Element)) return;
    const key = cardIconKey(card);
    const asset = ICONS[key];
    if (!asset) return;

    const icon = card.querySelector('.v10-stat-icon');
    if (!icon) return;

    const existing = icon.querySelector('img[data-wh73-operations-avatar]');
    if (existing && existing.dataset.wh73OperationsAvatar === key) return;

    icon.classList.add('wh73-operations-avatar');
    icon.textContent = '';

    const image = document.createElement('img');
    image.src = asset.src;
    image.alt = asset.alt;
    image.decoding = 'async';
    image.loading = 'eager';
    image.draggable = false;
    image.dataset.wh73OperationsAvatar = key;
    icon.appendChild(image);
    card.dataset.wh73OperationsAvatar = key;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('.v10-stat-card').forEach(applyCard);
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
          return node.classList?.contains('v10-stat-card') || !!node.querySelector?.('.v10-stat-card');
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
    window.v11173OperationsAvatarVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
