/* ============================================================
   WAFFLE HOUSE — CANONICAL LOGS PAGE ADAPTER
   Build 2026.08.27.04 · Phase 3A
   ------------------------------------------------------------
   Canonicalised from: waffle-app.js audit data/render core
   Historical source files remain rollback/reference only.
   ============================================================ */

(function () {
  'use strict';
  const BUILD = '2026.08.27.04';

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function canonicaliseNavigation() {
    document.querySelectorAll('a[href$="audit.html"] .nav-label, [data-page-link="audit"] .nav-label')
      .forEach(label => { label.textContent = 'Logs'; });
    document.querySelectorAll('a[href$="audit.html"], [data-page-link="audit"]')
      .forEach(link => {
        const aria = String(link.getAttribute('aria-label') || '');
        const title = String(link.getAttribute('title') || '');
        if (/audit/i.test(aria)) link.setAttribute('aria-label', aria.replace(/audit(?: log)?/ig, 'Logs'));
        if (/audit/i.test(title)) link.setAttribute('title', title.replace(/audit(?: log)?/ig, 'Logs'));
      });
  }

  function apply() {
    canonicaliseNavigation();
    if (pageName() !== 'audit') return;
    document.title = 'Waffle House — Logs';
    document.body.dataset.waffleCanonicalLogs = BUILD;
    const heading = document.querySelector('#auditTabPanel h1, #auditTabPanel h2, .audit-header h1, .audit-header h2');
    if (heading && /audit/i.test(String(heading.textContent || ''))) heading.textContent = 'Logs';
  }

  async function refresh() {
    if (typeof window.loadAuditLog === 'function') return window.loadAuditLog({ force:true });
    throw new Error('Waffle Logs data renderer is not ready yet.');
  }

  window.WAFFLE_LOGS_CANONICAL = Object.freeze({
    build: BUILD,
    module: 'logs.js',
    dataOwner: 'waffle-app.js',
    refresh
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
  window.addEventListener('pageshow', apply);
})();
