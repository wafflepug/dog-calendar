/* ============================================================
   WAFFLE HOUSE — SITTER TOOLS SETTINGS + DESKTOP SIDEBAR
   ------------------------------------------------------------
   - Direct Sitter Tools launchers are removed from primary UI on desktop/mobile.
   - Sitter Tools remains available from the canonical Settings surface.
   - Desktop receives a persistent left navigation sidebar.
   - Mobile keeps the canonical drawer/footer navigation unchanged.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_SITTER_NAVIGATION) return;

  const VERSION = '1.0.0';
  const DESKTOP_QUERY = '(min-width: 821px)';
  const DEFAULT_SITTER_TOOLS_HREF = 'reminders.html';
  let sitterToolsLauncher = null;
  let sitterToolsHref = '';
  let observer = null;
  let scheduled = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isDesktop() {
    return !!window.matchMedia && window.matchMedia(DESKTOP_QUERY).matches;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function routeKey() {
    const page = pageName();
    if (page === 'calendar') {
      try {
        return new URLSearchParams(window.location.search).get('view') === 'today'
          ? 'today'
          : 'calendar';
      } catch (_) {
        return 'calendar';
      }
    }
    if (page === 'directory') return 'directory';
    if (page === 'reminders') return 'reminders';
    if (page === 'audit') return 'audit';
    return '';
  }

  function ensureStyles() {
    if (document.getElementById('whSitterNavigationStyle')) return;
    const style = document.createElement('style');
    style.id = 'whSitterNavigationStyle';
    style.textContent = `
      .wh-sitter-tools-relocated {
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      #whSitterDesktopSidebar { display:none; }

      .wh-sitter-settings-action {
        width:100%;min-height:54px;box-sizing:border-box;display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;
        border:1px solid var(--wh75-line,#dbe3ef);border-radius:14px;padding:9px 11px;
        background:var(--wh75-shell-2,#f8fafc);color:var(--wh75-text,#172033);
        font:inherit;text-align:left;cursor:pointer;
      }
      .wh-sitter-settings-action:hover {
        border-color:var(--wh75-accent,#7c3aed);
        box-shadow:0 0 0 3px var(--wh75-ring,rgba(124,58,237,.15));
      }
      .wh-sitter-settings-action:focus-visible {
        outline:3px solid var(--wh75-ring,rgba(124,58,237,.22));outline-offset:2px;
      }
      .wh-sitter-settings-action-icon {
        width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
        background:var(--wh75-accent-soft,#f3e8ff);color:var(--wh75-accent-ink,#4c1d95);font-size:18px;
      }
      .wh-sitter-settings-action strong { display:block;font-size:12px;font-weight:900; }
      .wh-sitter-settings-action small { display:block;margin-top:2px;color:var(--wh75-muted,#64748b);font-size:9px;font-weight:700;line-height:1.35; }
      .wh-sitter-settings-chevron { color:var(--wh75-muted,#64748b);font-size:18px;font-weight:900; }

      @media (min-width:821px) {
        body.wh-sitter-desktop-sidebar-ready {
          box-sizing:border-box;
          padding-left:244px!important;
        }
        body.wh-sitter-desktop-sidebar-ready > .container {
          max-width:min(1180px,calc(100vw - 285px));
        }
        body.wh-sitter-desktop-sidebar-ready .app-tabs {
          display:none!important;
        }

        #whSitterDesktopSidebar {
          position:fixed;display:flex;left:0;top:0;bottom:0;z-index:2147481500;
          width:224px;box-sizing:border-box;flex-direction:column;gap:16px;
          padding:20px 14px;background:var(--wh75-shell,#fff);color:var(--wh75-text,#172033);
          border-right:1px solid var(--wh75-line,#e2e8f0);box-shadow:8px 0 28px rgba(15,23,42,.07);
          overflow-y:auto;
        }
        .wh-sitter-sidebar-brand {
          display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;
          padding:2px 6px 15px;border-bottom:1px solid var(--wh75-line,#e2e8f0);
        }
        .wh-sitter-sidebar-brand img { width:44px;height:44px;border-radius:13px;object-fit:cover; }
        .wh-sitter-sidebar-brand strong { display:block;font-size:15px;font-weight:950;letter-spacing:-.02em; }
        .wh-sitter-sidebar-brand small { display:block;margin-top:2px;color:var(--wh75-muted,#64748b);font-size:9px;font-weight:700; }
        .wh-sitter-sidebar-heading {
          padding:0 9px 5px;color:var(--wh75-muted,#64748b);font-size:9px;font-weight:950;
          letter-spacing:.11em;text-transform:uppercase;
        }
        .wh-sitter-sidebar-nav { display:grid;gap:4px; }
        .wh-sitter-sidebar-item {
          min-height:46px;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:center;
          padding:7px 9px;border:0;border-radius:12px;background:transparent;color:var(--wh75-text,#172033);
          text-decoration:none;text-align:left;font:inherit;font-size:12px;font-weight:850;cursor:pointer;
        }
        .wh-sitter-sidebar-item:hover { background:var(--wh75-shell-2,#f8fafc); }
        .wh-sitter-sidebar-item.is-active {
          background:var(--wh75-accent-soft,#f3e8ff);color:var(--wh75-accent-ink,#4c1d95);
          box-shadow:inset 3px 0 0 var(--wh75-accent,#7c3aed);
        }
        .wh-sitter-sidebar-item:focus-visible {
          outline:3px solid var(--wh75-ring,rgba(124,58,237,.22));outline-offset:2px;
        }
        .wh-sitter-sidebar-icon {
          width:32px;height:32px;display:grid;place-items:center;border-radius:10px;
          background:var(--wh75-shell-2,#f8fafc);font-size:16px;
        }
        .wh-sitter-sidebar-item.is-active .wh-sitter-sidebar-icon {
          background:color-mix(in srgb,var(--wh75-accent,#7c3aed) 16%,var(--wh75-shell,#fff));
        }
        .wh-sitter-sidebar-account { margin-top:auto;padding-top:14px;border-top:1px solid var(--wh75-line,#e2e8f0); }

        #wh75SettingsBackdrop {
          position:fixed!important;inset:0!important;z-index:2147481825!important;
          background:var(--wh75-page-overlay,rgba(15,23,42,.42))!important;backdrop-filter:blur(3px);
          display:none!important;
        }
        #wh75SettingsBackdrop.is-open { display:block!important; }
        #wh75SettingsPanel {
          display:block!important;position:fixed!important;left:50%!important;top:50%!important;bottom:auto!important;
          z-index:2147481830!important;width:min(560px,calc(100vw - 80px))!important;max-height:min(82vh,760px)!important;
          overflow:auto!important;box-sizing:border-box!important;padding:20px!important;
          border:1px solid var(--wh75-line,#e2e8f0)!important;border-radius:22px!important;
          background:var(--wh75-shell,#fff)!important;color:var(--wh75-text,#172033)!important;
          box-shadow:0 28px 80px rgba(15,23,42,.32)!important;
          opacity:0!important;pointer-events:none!important;
          transform:translate(-50%,calc(-50% + 18px))!important;transition:opacity .18s ease,transform .18s ease!important;
        }
        #wh75SettingsPanel.is-open {
          opacity:1!important;pointer-events:auto!important;transform:translate(-50%,-50%)!important;
        }
        #wh75SettingsPanel .wh75-settings-head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px; }
        #wh75SettingsPanel .wh75-settings-head h2 { margin:0;font-size:22px;line-height:1.15;font-weight:950;color:var(--wh75-text,#172033); }
        #wh75SettingsPanel .wh75-settings-head p { margin:5px 0 0;color:var(--wh75-muted,#64748b);font-size:12px;line-height:1.45;font-weight:650; }
        #wh75SettingsPanel .wh75-settings-close { flex:0 0 38px;width:38px;height:38px;border:0;border-radius:11px;background:var(--wh75-shell-2,#f8fafc);color:var(--wh75-text,#172033);font-size:20px;cursor:pointer; }
        #wh75SettingsPanel .wh75-settings-section { padding:15px 0;border-top:1px solid var(--wh75-line,#e2e8f0); }
        #wh75SettingsPanel .wh75-settings-section:first-of-type { border-top:0;padding-top:0; }
        #wh75SettingsPanel .wh75-settings-title { margin:0 0 5px;font-size:13px;font-weight:950;color:var(--wh75-text,#172033); }
        #wh75SettingsPanel .wh75-settings-help { margin:0 0 12px;color:var(--wh75-muted,#64748b);font-size:11px;line-height:1.4; }
        #wh75SettingsPanel .wh75-mode-grid { display:grid;grid-template-columns:1fr 1fr;gap:9px; }
        #wh75SettingsPanel .wh75-mode-btn { display:flex;align-items:center;gap:10px;min-height:54px;padding:8px 11px;border:1px solid var(--wh75-line,#e2e8f0);border-radius:14px;background:var(--wh75-shell-2,#f8fafc);color:var(--wh75-text,#172033);font:inherit;font-weight:850;cursor:pointer; }
        #wh75SettingsPanel .wh75-mode-btn[aria-pressed="true"] { border-color:var(--wh75-accent,#7c3aed);box-shadow:0 0 0 3px var(--wh75-ring,rgba(124,58,237,.2));background:var(--wh75-accent-soft,#f3e8ff);color:var(--wh75-accent-ink,#4c1d95); }
        #wh75SettingsPanel .wh75-mode-btn img { width:38px;height:38px;border-radius:50%;object-fit:cover; }
        #wh75SettingsPanel .wh75-colour-grid { display:grid;gap:8px; }
        #wh75SettingsPanel .wh75-colour-option { display:grid;grid-template-columns:58px minmax(0,1fr) 24px;gap:10px;align-items:center;min-height:56px;padding:8px 10px;border:1px solid var(--wh75-line,#e2e8f0);border-radius:14px;background:var(--wh75-shell-2,#f8fafc);color:var(--wh75-text,#172033);font:inherit;text-align:left;cursor:pointer; }
        #wh75SettingsPanel .wh75-colour-option[aria-pressed="true"] { border-color:var(--wh75-accent,#7c3aed);box-shadow:0 0 0 3px var(--wh75-ring,rgba(124,58,237,.2)); }
        #wh75SettingsPanel .wh75-swatch { display:flex;align-items:center; }
        #wh75SettingsPanel .wh75-swatch i { width:26px;height:26px;border:2px solid var(--wh75-shell,#fff);border-radius:50%;display:block; }
        #wh75SettingsPanel .wh75-swatch i + i { margin-left:-8px; }
        #wh75SettingsPanel .wh75-colour-name { display:block;font-size:12px;font-weight:900; }
        #wh75SettingsPanel .wh75-colour-note { display:block;margin-top:2px;color:var(--wh75-muted,#64748b);font-size:9px;font-weight:700; }
        #wh75SettingsPanel .wh75-check { color:var(--wh75-accent,#7c3aed);font-size:17px;font-weight:950;text-align:center;opacity:0; }
        #wh75SettingsPanel .wh75-colour-option[aria-pressed="true"] .wh75-check { opacity:1; }
      }
    `;
    document.head.appendChild(style);
  }

  function sidebarItem(href, icon, label, key) {
    return `<a class="wh-sitter-sidebar-item" href="${escapeHtml(href)}" data-wh-sitter-route="${escapeHtml(key)}"><span class="wh-sitter-sidebar-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span></a>`;
  }

  function ensureDesktopSidebar() {
    if (!document.body) return null;
    let sidebar = document.getElementById('whSitterDesktopSidebar');
    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.id = 'whSitterDesktopSidebar';
      sidebar.setAttribute('aria-label', 'Waffle House navigation');
      sidebar.innerHTML = `
        <div class="wh-sitter-sidebar-brand">
          <img src="waffle-logo.png" alt="">
          <span><strong>Waffle House</strong><small>Dog sitting, organised.</small></span>
        </div>
        <div>
          <div class="wh-sitter-sidebar-heading">Workspace</div>
          <nav class="wh-sitter-sidebar-nav" aria-label="Primary">
            ${sidebarItem('index.html?view=today','⌂','Today','today')}
            ${sidebarItem('index.html?view=calendar','▦','Calendar','calendar')}
            ${sidebarItem('directory.html','🐾','Care','directory')}
            ${sidebarItem('reminders.html','✓','Organiser','reminders')}
            ${sidebarItem('audit.html','≡','Logs','audit')}
          </nav>
        </div>
        <div class="wh-sitter-sidebar-account">
          <div class="wh-sitter-sidebar-heading">Account</div>
          <button type="button" class="wh-sitter-sidebar-item" data-wh-sitter-settings>
            <span class="wh-sitter-sidebar-icon" aria-hidden="true">⚙</span><span>Settings</span>
          </button>
        </div>`;
      document.body.appendChild(sidebar);
      sidebar.querySelector('[data-wh-sitter-settings]')?.addEventListener('click', openSettings);
    }

    document.body.classList.toggle('wh-sitter-desktop-sidebar-ready', isDesktop());
    syncSidebarActive();
    return sidebar;
  }

  function syncSidebarActive() {
    const route = routeKey();
    document.querySelectorAll('[data-wh-sitter-route]').forEach(item => {
      const active = item.dataset.whSitterRoute === route;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function openSettings() {
    try {
      if (window.WAFFLE_APPEARANCE?.openSettings) {
        window.WAFFLE_APPEARANCE.openSettings();
        return;
      }
    } catch (_) {}
    document.getElementById('wh75SettingsBackdrop')?.classList.add('is-open');
    document.getElementById('wh75SettingsPanel')?.classList.add('is-open');
  }

  function closeSettings() {
    const close = document.querySelector('#wh75SettingsPanel [data-wh75-close-settings]');
    if (close instanceof HTMLElement) {
      close.click();
      return;
    }
    document.getElementById('wh75SettingsBackdrop')?.classList.remove('is-open');
    document.getElementById('wh75SettingsPanel')?.classList.remove('is-open');
  }

  function nodeSignature(node) {
    return [
      node.textContent,
      node.getAttribute?.('aria-label'),
      node.getAttribute?.('title'),
      node.dataset?.label
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function isOurSurface(node) {
    return !!node.closest?.('#wh75SettingsPanel,#whSitterDesktopSidebar');
  }

  function captureLauncher(node) {
    if (!(node instanceof HTMLElement) || isOurSurface(node)) return false;
    if (!/\bsitter\s+tools\b/i.test(nodeSignature(node))) return false;

    if (!sitterToolsLauncher || !sitterToolsLauncher.isConnected) sitterToolsLauncher = node;
    if (!sitterToolsHref && node instanceof HTMLAnchorElement && node.href) sitterToolsHref = node.href;
    if (!sitterToolsHref) {
      const href = String(node.getAttribute?.('data-href') || node.dataset?.href || '').trim();
      if (href) sitterToolsHref = href;
    }

    node.classList.add('wh-sitter-tools-relocated');
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('tabindex', '-1');
    return true;
  }

  function suppressDirectSitterTools() {
    document.querySelectorAll('button,a,[role="button"]').forEach(captureLauncher);
  }

  function openSitterTools() {
    closeSettings();

    const launcher = sitterToolsLauncher;
    if (launcher?.isConnected && !launcher.closest?.('#wh75SettingsPanel,#whSitterDesktopSidebar')) {
      try {
        launcher.click();
        return;
      } catch (_) {}
    }

    const href = sitterToolsHref || DEFAULT_SITTER_TOOLS_HREF;
    if (href) window.location.href = href;
  }

  function ensureSitterToolsSettings() {
    const panel = document.getElementById('wh75SettingsPanel');
    if (!panel) return null;

    const title = panel.querySelector('#wh75SettingsTitle');
    const intro = title?.parentElement?.querySelector('p');
    if (title) title.textContent = 'Settings';
    if (intro) intro.textContent = 'Manage appearance, colour and sitter tools.';

    let section = document.getElementById('whSitterToolsSettingsSection');
    if (!section) {
      section = document.createElement('div');
      section.id = 'whSitterToolsSettingsSection';
      section.className = 'wh75-settings-section';
      section.innerHTML = `
        <h3 class="wh75-settings-title">Sitter Tools</h3>
        <p class="wh75-settings-help">Operational tools stay out of primary navigation and are available here when you need them.</p>
        <button type="button" class="wh-sitter-settings-action" data-wh-sitter-tools-settings>
          <span class="wh-sitter-settings-action-icon" aria-hidden="true">🧰</span>
          <span><strong>Open Sitter Tools</strong><small>Open the sitter operations workspace</small></span>
          <span class="wh-sitter-settings-chevron" aria-hidden="true">›</span>
        </button>`;
      panel.appendChild(section);
      section.querySelector('[data-wh-sitter-tools-settings]')?.addEventListener('click', openSitterTools);
    }
    return section;
  }

  function maintain() {
    scheduled = false;
    if (!document.body) return;
    ensureStyles();
    ensureDesktopSidebar();
    ensureSitterToolsSettings();
    suppressDirectSitterTools();
    syncSidebarActive();
  }

  function scheduleMaintain() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(maintain);
  }

  function startObserver() {
    if (observer || !document.documentElement || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(scheduleMaintain);
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  function start() {
    maintain();
    startObserver();

    const media = window.matchMedia?.(DESKTOP_QUERY);
    media?.addEventListener?.('change', scheduleMaintain);
    window.addEventListener('pageshow', scheduleMaintain);
    window.addEventListener('popstate', scheduleMaintain);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleMaintain();
    });

    [80, 250, 700, 1600, 3200].forEach(delay => window.setTimeout(scheduleMaintain, delay));
  }

  window.WAFFLE_SITTER_NAVIGATION = Object.freeze({
    version: VERSION,
    maintain,
    openSettings,
    openSitterTools
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
