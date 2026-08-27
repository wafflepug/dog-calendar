/* ============================================================
   WAFFLE HOUSE — CLIENT DIAGNOSTICS
   Phase 3D · local-only, privacy-preserving observability
   ------------------------------------------------------------
   Captures technical failure metadata only. It does not persist error
   messages, form values, dog names, owner details, URLs with query strings,
   or operational data. The most recent 25 entries stay in localStorage on
   this browser and can be cleared from System Status.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_DIAGNOSTICS) return;

  const VERSION = 'phase3d-1';
  const STORAGE_KEY = 'waffleDiagnosticsV1';
  const LIMIT = 25;

  function safePath(value) {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return url.origin === window.location.origin ? url.pathname.split('/').pop() || '/' : url.hostname;
    } catch (_) {
      return '';
    }
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-LIMIT) : [];
    } catch (_) {
      return [];
    }
  }

  function write(entries) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-LIMIT))); } catch (_) {}
  }

  function record(kind, details) {
    const entry = {
      at: new Date().toISOString(),
      kind: String(kind || 'error').slice(0, 40),
      page: String(document.body?.dataset?.wafflePage || window.WAFFLE_PAGE || '').slice(0, 40),
      file: safePath(details && details.file),
      line: Number(details && details.line) || 0,
      column: Number(details && details.column) || 0,
      name: String(details && details.name || '').slice(0, 80),
      module: String(details && details.module || '').slice(0, 80)
    };
    const entries = read();
    entries.push(entry);
    write(entries);
    window.dispatchEvent(new CustomEvent('waffle:diagnostic', { detail: entry }));
    return entry;
  }

  window.addEventListener('error', event => {
    const target = event && event.target;
    if (target && target !== window && (target.src || target.href)) {
      record('asset-error', { file: target.src || target.href, name: target.tagName || 'asset' });
      return;
    }
    record('javascript-error', {
      file: event && event.filename,
      line: event && event.lineno,
      column: event && event.colno,
      name: event && event.error && event.error.name
    });
  }, true);

  window.addEventListener('unhandledrejection', event => {
    const reason = event && event.reason;
    record('unhandled-rejection', {
      name: reason && reason.name ? reason.name : typeof reason
    });
  });

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.dispatchEvent(new CustomEvent('waffle:diagnostics-cleared'));
  }

  function summary() {
    const entries = read();
    return Object.freeze({
      version: VERSION,
      count: entries.length,
      lastAt: entries.length ? entries[entries.length - 1].at : '',
      storage: 'local-browser-only'
    });
  }

  function injectSystemStatusLink() {
    const panel = document.getElementById('wh75SettingsPanel');
    if (!panel || panel.querySelector('[data-waffle-system-status-link]')) return false;
    const section = document.createElement('div');
    section.className = 'wh75-settings-section';
    section.setAttribute('data-waffle-system-status-link', 'true');
    section.innerHTML = '<a href="system-status.html" style="display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;color:inherit;font-weight:850;padding:4px 0"><span>🩺 System Status</span><span aria-hidden="true">›</span></a><p style="margin:6px 0 0;opacity:.72;font-size:11px;line-height:1.4">Build, backend, Ask Waffle and local diagnostics.</p>';
    panel.appendChild(section);
    return true;
  }

  function watchSettings() {
    if (injectSystemStatusLink()) return;
    const observer = new MutationObserver(() => {
      if (injectSystemStatusLink()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  window.WAFFLE_DIAGNOSTICS = Object.freeze({
    version: VERSION,
    record,
    recent: read,
    clear,
    summary
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchSettings, { once: true });
  } else {
    watchSettings();
  }
})();
