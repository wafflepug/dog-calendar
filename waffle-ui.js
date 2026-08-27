/* ============================================================
   WAFFLE HOUSE — CANONICAL SHARED UI
   Build 2026.08.27.04 · Phase 3A
   ------------------------------------------------------------
   Canonicalised from: waffle-v11.1.75.js, waffle-v11.1.76.js, waffle-v11.1.89.js, waffle-ui-contract.js
   Historical source files remain rollback/reference only.
   ============================================================ */


/* ---- source: waffle-v11.1.75.js ---- */
/* ============================================================
   WAFFLE HOUSE V11.1.75 — INDEPENDENT SITTER MOBILE SHELL
   - Mobile drawer: Today, Calendar, Care, Organiser, Logs
   - Bottom nav: Today, Calendar, Care, + Add, Ask Waffle
   - Appearance & Colour settings with five light/dark colour styles
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.75';
  const MOBILE_QUERY = '(max-width: 820px)';
  const COLOUR_KEY = 'waffleColourStyle';
  const ALLOWED_COLOURS = new Set([
    'waffle-purple',
    'coastal-blue',
    'eucalyptus',
    'sunset-coral',
    'warm-honey'
  ]);
  let observer = null;
  let frame = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function savedColourStyle() {
    let value = 'waffle-purple';
    try { value = String(localStorage.getItem(COLOUR_KEY) || value); } catch (_) {}
    return ALLOWED_COLOURS.has(value) ? value : 'waffle-purple';
  }

  function applyColourStyle(value, persist) {
    const selected = ALLOWED_COLOURS.has(String(value || '')) ? String(value) : 'waffle-purple';
    document.documentElement.setAttribute('data-waffle-colour-style', selected);
    if (document.body) document.body.setAttribute('data-waffle-colour-style', selected);
    if (persist) {
      try { localStorage.setItem(COLOUR_KEY, selected); } catch (_) {}
    }
    syncSettingsUi();
    return selected;
  }

  applyColourStyle(savedColourStyle(), false);

  function ensureStyles() {
    if (document.getElementById('wh75MobileShellStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh75MobileShellStyle';
    style.textContent = `
      :root, :root[data-waffle-colour-style="waffle-purple"] {
        --wh75-accent:#7c3aed;--wh75-accent-strong:#6d28d9;--wh75-accent-soft:#f3e8ff;--wh75-accent-ink:#4c1d95;--wh75-ring:rgba(124,58,237,.22);
      }
      :root[data-waffle-colour-style="coastal-blue"] {
        --wh75-accent:#0284c7;--wh75-accent-strong:#0369a1;--wh75-accent-soft:#e0f2fe;--wh75-accent-ink:#075985;--wh75-ring:rgba(2,132,199,.22);
      }
      :root[data-waffle-colour-style="eucalyptus"] {
        --wh75-accent:#15803d;--wh75-accent-strong:#166534;--wh75-accent-soft:#dcfce7;--wh75-accent-ink:#14532d;--wh75-ring:rgba(21,128,61,.22);
      }
      :root[data-waffle-colour-style="sunset-coral"] {
        --wh75-accent:#e11d48;--wh75-accent-strong:#be123c;--wh75-accent-soft:#ffe4e6;--wh75-accent-ink:#9f1239;--wh75-ring:rgba(225,29,72,.22);
      }
      :root[data-waffle-colour-style="warm-honey"] {
        --wh75-accent:#d97706;--wh75-accent-strong:#b45309;--wh75-accent-soft:#fef3c7;--wh75-accent-ink:#92400e;--wh75-ring:rgba(217,119,6,.22);
      }
      body.dark-theme {
        --wh75-shell:#111b2d;--wh75-shell-2:#17243a;--wh75-text:#f8fafc;--wh75-muted:#a9b6c9;--wh75-line:#334155;--wh75-page-overlay:rgba(2,6,23,.62);
      }
      body:not(.dark-theme) {
        --wh75-shell:#ffffff;--wh75-shell-2:#f8fafc;--wh75-text:#172033;--wh75-muted:#64748b;--wh75-line:#e2e8f0;--wh75-page-overlay:rgba(15,23,42,.40);
      }
      :root[data-waffle-colour-style="waffle-purple"] body.dark-theme {
        --wh75-accent:#c084fc;--wh75-accent-strong:#a855f7;--wh75-accent-soft:#2e1065;--wh75-accent-ink:#f3e8ff;--wh75-ring:rgba(192,132,252,.28);
      }
      :root[data-waffle-colour-style="coastal-blue"] body.dark-theme {
        --wh75-accent:#38bdf8;--wh75-accent-strong:#0ea5e9;--wh75-accent-soft:#082f49;--wh75-accent-ink:#e0f2fe;--wh75-ring:rgba(56,189,248,.28);
      }
      :root[data-waffle-colour-style="eucalyptus"] body.dark-theme {
        --wh75-accent:#4ade80;--wh75-accent-strong:#22c55e;--wh75-accent-soft:#052e16;--wh75-accent-ink:#dcfce7;--wh75-ring:rgba(74,222,128,.28);
      }
      :root[data-waffle-colour-style="sunset-coral"] body.dark-theme {
        --wh75-accent:#fb7185;--wh75-accent-strong:#f43f5e;--wh75-accent-soft:#4c0519;--wh75-accent-ink:#ffe4e6;--wh75-ring:rgba(251,113,133,.28);
      }
      :root[data-waffle-colour-style="warm-honey"] body.dark-theme {
        --wh75-accent:#fbbf24;--wh75-accent-strong:#f59e0b;--wh75-accent-soft:#451a03;--wh75-accent-ink:#fef3c7;--wh75-ring:rgba(251,191,36,.28);
      }

      body { accent-color:var(--wh75-accent); }
      body .app-tab-button.active { background:var(--wh75-accent-strong)!important;color:#fff!important; }
      body[data-waffle-page="calendar"] { --wh65-accent:var(--wh75-accent)!important; }
      body .directory-main-profile-tab.is-active { color:var(--wh75-accent)!important;border-color:var(--wh75-accent)!important; }
      body #aw37launch { box-shadow:0 0 0 3px var(--wh75-ring),0 10px 26px rgba(15,23,42,.18)!important; }

      #wh75MenuButton,#wh75MobileBottomNav,#wh75MobileDrawer,#wh75DrawerBackdrop,#wh75SettingsBackdrop,#wh75SettingsPanel { display:none; }

      @media (max-width:820px) {
        body { padding-bottom:calc(82px + env(safe-area-inset-bottom))!important; }
        body .app-tabs { display:none!important; }
        body .theme-toggle-header { display:none!important; }
        body #v10QuickAddButton { display:none!important; }
        body #aw37launch { display:none!important; }

        body[data-waffle-page="calendar"][data-wh75-mobile-view="today"] .wh65-calendar { display:none!important; }
        body[data-waffle-page="calendar"][data-wh75-mobile-view="today"] .v10-operations-home { display:block!important; }
        body[data-waffle-page="calendar"][data-wh75-mobile-view="calendar"] .v10-operations-home { display:none!important; }

        #wh75MenuButton {
          display:inline-flex;position:fixed;top:calc(12px + env(safe-area-inset-top));left:12px;z-index:2147481800;
          width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--wh75-line);border-radius:14px;
          background:var(--wh75-shell);color:var(--wh75-text);box-shadow:0 6px 20px rgba(15,23,42,.14);font-size:21px;cursor:pointer;
        }
        #wh75MenuButton:focus-visible,#wh75MobileDrawer a:focus-visible,#wh75MobileDrawer button:focus-visible,#wh75SettingsPanel button:focus-visible {
          outline:3px solid var(--wh75-ring);outline-offset:2px;
        }
        #wh75DrawerBackdrop,#wh75SettingsBackdrop {
          position:fixed;inset:0;z-index:2147481805;background:var(--wh75-page-overlay);backdrop-filter:blur(2px);
        }
        #wh75DrawerBackdrop.is-open,#wh75SettingsBackdrop.is-open { display:block; }
        #wh75MobileDrawer {
          display:flex;position:fixed;inset:0 auto 0 0;z-index:2147481810;width:min(86vw,360px);box-sizing:border-box;
          flex-direction:column;background:var(--wh75-shell);color:var(--wh75-text);border-right:1px solid var(--wh75-line);
          box-shadow:20px 0 55px rgba(15,23,42,.24);transform:translateX(-104%);transition:transform .22s ease;
          padding:calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;
        }
        #wh75MobileDrawer.is-open { transform:translateX(0); }
        .wh75-drawer-head { display:grid;grid-template-columns:52px minmax(0,1fr) 38px;gap:11px;align-items:center;padding:0 3px 16px;border-bottom:1px solid var(--wh75-line); }
        .wh75-drawer-logo { width:52px;height:52px;border-radius:15px;object-fit:cover;display:block; }
        .wh75-drawer-brand strong { display:block;font-size:18px;line-height:1.1;font-weight:950;letter-spacing:-.02em; }
        .wh75-drawer-brand span { display:block;margin-top:4px;color:var(--wh75-muted);font-size:11px;font-weight:700; }
        .wh75-drawer-close { width:38px;height:38px;border:0;border-radius:11px;background:var(--wh75-shell-2);color:var(--wh75-text);font-size:20px;cursor:pointer; }
        .wh75-nav-section { padding-top:16px; }
        .wh75-nav-heading { padding:0 10px 7px;color:var(--wh75-muted);font-size:9px;line-height:1;font-weight:950;letter-spacing:.12em;text-transform:uppercase; }
        .wh75-nav-list { display:grid;gap:4px; }
        .wh75-nav-item {
          width:100%;min-height:46px;box-sizing:border-box;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;
          border:0;border-radius:13px;padding:7px 10px;background:transparent;color:var(--wh75-text);text-decoration:none;text-align:left;font:inherit;font-weight:850;cursor:pointer;
        }
        .wh75-nav-item:hover { background:var(--wh75-shell-2); }
        .wh75-nav-item.is-active { background:var(--wh75-accent-soft);color:var(--wh75-accent-ink); }
        .wh75-nav-icon { width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;background:var(--wh75-shell-2);font-size:16px; }
        .wh75-nav-item.is-active .wh75-nav-icon { background:color-mix(in srgb,var(--wh75-accent) 18%,var(--wh75-shell)); }
        .wh75-nav-meta { color:var(--wh75-muted);font-size:9px;font-weight:800; }
        .wh75-theme-avatar { width:30px;height:30px;border-radius:50%;object-fit:cover;display:block; }
        .wh75-drawer-footer { margin-top:auto;padding:18px 10px 2px;color:var(--wh75-muted);font-size:10px;font-weight:750; }

        #wh75MobileBottomNav {
          display:grid;position:fixed;left:0;right:0;bottom:0;z-index:2147481795;grid-template-columns:repeat(5,minmax(0,1fr));
          min-height:70px;padding:7px 6px calc(6px + env(safe-area-inset-bottom));box-sizing:border-box;
          border-top:1px solid var(--wh75-line);background:color-mix(in srgb,var(--wh75-shell) 94%,transparent);backdrop-filter:blur(16px);
          box-shadow:0 -7px 24px rgba(15,23,42,.10);
        }
        .wh75-bottom-item {
          min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:transparent;
          color:var(--wh75-muted);text-decoration:none;font:inherit;font-size:9px;font-weight:850;cursor:pointer;border-radius:12px;
        }
        .wh75-bottom-item .wh75-bottom-icon { height:28px;min-width:28px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;border-radius:9px; }
        .wh75-bottom-item.is-active { color:var(--wh75-accent-strong); }
        .wh75-bottom-add .wh75-bottom-icon { width:42px;height:42px;margin-top:-19px;border-radius:50%;background:var(--wh75-accent);color:#fff;font-size:25px;box-shadow:0 7px 18px var(--wh75-ring); }
        .wh75-bottom-add { color:var(--wh75-accent-strong); }

        #wh75SettingsPanel {
          position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147481830;transform:translate(-50%,calc(100% + 40px));
          display:block;width:min(calc(100vw - 24px),520px);max-height:min(82vh,720px);overflow:auto;box-sizing:border-box;
          padding:18px;border:1px solid var(--wh75-line);border-radius:22px;background:var(--wh75-shell);color:var(--wh75-text);
          box-shadow:0 24px 70px rgba(15,23,42,.30);transition:transform .22s ease;
        }
        #wh75SettingsPanel.is-open { transform:translate(-50%,0); }
        .wh75-settings-head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px; }
        .wh75-settings-head h2 { margin:0;font-size:22px;line-height:1.15;font-weight:950;letter-spacing:-.025em;color:var(--wh75-text); }
        .wh75-settings-head p { margin:5px 0 0;color:var(--wh75-muted);font-size:12px;line-height:1.45;font-weight:650; }
        .wh75-settings-close { flex:0 0 38px;width:38px;height:38px;border:0;border-radius:11px;background:var(--wh75-shell-2);color:var(--wh75-text);font-size:20px;cursor:pointer; }
        .wh75-settings-section { padding:15px 0;border-top:1px solid var(--wh75-line); }
        .wh75-settings-section:first-of-type { border-top:0;padding-top:0; }
        .wh75-settings-title { margin:0 0 5px;font-size:13px;font-weight:950;color:var(--wh75-text); }
        .wh75-settings-help { margin:0 0 12px;color:var(--wh75-muted);font-size:11px;line-height:1.4; }
        .wh75-mode-grid { display:grid;grid-template-columns:1fr 1fr;gap:9px; }
        .wh75-mode-btn { display:flex;align-items:center;gap:10px;min-height:54px;padding:8px 11px;border:1px solid var(--wh75-line);border-radius:14px;background:var(--wh75-shell-2);color:var(--wh75-text);font:inherit;font-weight:850;cursor:pointer; }
        .wh75-mode-btn[aria-pressed="true"] { border-color:var(--wh75-accent);box-shadow:0 0 0 3px var(--wh75-ring);background:var(--wh75-accent-soft);color:var(--wh75-accent-ink); }
        .wh75-mode-btn img { width:38px;height:38px;border-radius:50%;object-fit:cover; }
        .wh75-colour-grid { display:grid;gap:8px; }
        .wh75-colour-option { display:grid;grid-template-columns:58px minmax(0,1fr) 24px;gap:10px;align-items:center;min-height:56px;padding:8px 10px;border:1px solid var(--wh75-line);border-radius:14px;background:var(--wh75-shell-2);color:var(--wh75-text);font:inherit;text-align:left;cursor:pointer; }
        .wh75-colour-option[aria-pressed="true"] { border-color:var(--wh75-accent);box-shadow:0 0 0 3px var(--wh75-ring); }
        .wh75-swatch { display:flex;align-items:center;gap:0; }
        .wh75-swatch i { width:26px;height:26px;border:2px solid var(--wh75-shell);border-radius:50%;display:block;box-shadow:0 1px 4px rgba(15,23,42,.10); }
        .wh75-swatch i + i { margin-left:-8px; }
        .wh75-colour-name { display:block;font-size:12px;font-weight:900; }
        .wh75-colour-note { display:block;margin-top:2px;color:var(--wh75-muted);font-size:9px;font-weight:700; }
        .wh75-check { color:var(--wh75-accent);font-size:17px;font-weight:950;text-align:center;opacity:0; }
        .wh75-colour-option[aria-pressed="true"] .wh75-check { opacity:1; }
      }
    `;
    document.head.appendChild(style);
  }

  function currentCalendarView() {
    if (pageName() !== 'calendar') return '';
    const requested = new URLSearchParams(window.location.search).get('view');
    if (requested === 'calendar' || requested === 'today') return requested;
    return isMobile() ? 'today' : '';
  }

  function syncCalendarView() {
    if (!document.body || pageName() !== 'calendar') return;
    const view = currentCalendarView();
    if (view) document.body.setAttribute('data-wh75-mobile-view', view);
    else document.body.removeAttribute('data-wh75-mobile-view');
    syncActiveNavigation();
  }

  function navItem(href, icon, label, key) {
    return `<a class="wh75-nav-item" href="${href}" data-wh75-route="${key}"><span class="wh75-nav-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span></a>`;
  }

  function bottomItem(href, icon, label, key) {
    return `<a class="wh75-bottom-item" href="${href}" data-wh75-route="${key}"><span class="wh75-bottom-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span></a>`;
  }

  function ensureShell() {
    if (!document.body || document.getElementById('wh75MobileDrawer')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'wh75DrawerBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const menuButton = document.createElement('button');
    menuButton.id = 'wh75MenuButton';
    menuButton.type = 'button';
    menuButton.setAttribute('aria-label', 'Open Waffle House menu');
    menuButton.setAttribute('aria-controls', 'wh75MobileDrawer');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰';

    const drawer = document.createElement('aside');
    drawer.id = 'wh75MobileDrawer';
    drawer.setAttribute('aria-label', 'Waffle House menu');
    drawer.innerHTML = `
      <div class="wh75-drawer-head">
        <img class="wh75-drawer-logo" src="waffle-logo.png" alt="Waffle House">
        <div class="wh75-drawer-brand"><strong>Waffle House</strong><span>Dog sitting, organised.</span></div>
        <button class="wh75-drawer-close" type="button" data-wh75-close-drawer aria-label="Close menu">×</button>
      </div>
      <div class="wh75-nav-section">
        <div class="wh75-nav-heading">Today</div>
        <div class="wh75-nav-list">${navItem('index.html?view=today','⌂','Today','today')}</div>
      </div>
      <div class="wh75-nav-section">
        <div class="wh75-nav-heading">Waffle House</div>
        <div class="wh75-nav-list">
          ${navItem('index.html?view=calendar','▦','Calendar','calendar')}
          ${navItem('directory.html','🐾','Care','directory')}
          ${navItem('reminders.html','✓','Organiser','reminders')}
          ${navItem('audit.html','≡','Logs','audit')}
        </div>
      </div>
      <div class="wh75-nav-section">
        <div class="wh75-nav-heading">Quick Actions</div>
        <div class="wh75-nav-list">
          <button class="wh75-nav-item" type="button" data-wh75-quick-add><span class="wh75-nav-icon" aria-hidden="true">＋</span><span>Quick Add</span><span class="wh75-nav-meta">New stay</span></button>
          <button class="wh75-nav-item" type="button" data-wh75-ask><span class="wh75-nav-icon" aria-hidden="true">🐶</span><span>Ask Waffle</span><span class="wh75-nav-meta">AI</span></button>
        </div>
      </div>
      <div class="wh75-nav-section">
        <div class="wh75-nav-heading">Account</div>
        <div class="wh75-nav-list">
          <button class="wh75-nav-item" type="button" data-wh75-settings><span class="wh75-nav-icon" aria-hidden="true">⚙</span><span>Settings</span></button>
          <button class="wh75-nav-item" type="button" data-wh75-theme-quick><span class="wh75-nav-icon"><img class="wh75-theme-avatar" data-wh75-theme-avatar src="theme-dark-avatar-v1174.svg" alt=""></span><span data-wh75-theme-label>Dark Mode</span></button>
        </div>
      </div>
      <div class="wh75-drawer-footer">Waffle House · v${VERSION}</div>
    `;

    const bottom = document.createElement('nav');
    bottom.id = 'wh75MobileBottomNav';
    bottom.setAttribute('aria-label', 'Primary mobile navigation');
    bottom.innerHTML = `
      ${bottomItem('index.html?view=today','⌂','Today','today')}
      ${bottomItem('index.html?view=calendar','▦','Calendar','calendar')}
      ${bottomItem('directory.html','🐾','Care','directory')}
      <button class="wh75-bottom-item wh75-bottom-add" type="button" data-wh75-quick-add><span class="wh75-bottom-icon" aria-hidden="true">＋</span><span>Add</span></button>
      <button class="wh75-bottom-item" type="button" data-wh75-ask><span class="wh75-bottom-icon" aria-hidden="true">🐶</span><span>Ask Waffle</span></button>
    `;

    const settingsBackdrop = document.createElement('div');
    settingsBackdrop.id = 'wh75SettingsBackdrop';
    settingsBackdrop.setAttribute('aria-hidden', 'true');

    const settings = document.createElement('section');
    settings.id = 'wh75SettingsPanel';
    settings.setAttribute('role', 'dialog');
    settings.setAttribute('aria-modal', 'true');
    settings.setAttribute('aria-labelledby', 'wh75SettingsTitle');
    settings.innerHTML = `
      <div class="wh75-settings-head">
        <div><h2 id="wh75SettingsTitle">Appearance &amp; Colour</h2><p>Choose how Waffle House looks. Every colour style is tuned for both Light and Dark mode.</p></div>
        <button class="wh75-settings-close" type="button" data-wh75-close-settings aria-label="Close settings">×</button>
      </div>
      <div class="wh75-settings-section">
        <h3 class="wh75-settings-title">Mode</h3>
        <p class="wh75-settings-help">Choose a comfortable screen mode. Your colour style stays the same when you switch modes.</p>
        <div class="wh75-mode-grid">
          <button class="wh75-mode-btn" type="button" data-wh75-mode="light" aria-pressed="false"><img src="theme-light-avatar-v1174.svg" alt=""><span>Light</span></button>
          <button class="wh75-mode-btn" type="button" data-wh75-mode="dark" aria-pressed="false"><img src="theme-dark-avatar-v1174.svg" alt=""><span>Dark</span></button>
        </div>
      </div>
      <div class="wh75-settings-section">
        <h3 class="wh75-settings-title">Colour Style</h3>
        <p class="wh75-settings-help">Pick one accent family. Waffle automatically uses its matching Light or Dark palette.</p>
        <div class="wh75-colour-grid">
          ${colourOption('waffle-purple','Waffle Purple','Classic Waffle accent','#7c3aed','#c084fc','#4c1d95')}
          ${colourOption('coastal-blue','Coastal Blue','Cool and clear','#0284c7','#38bdf8','#075985')}
          ${colourOption('eucalyptus','Eucalyptus','Calm and natural','#15803d','#4ade80','#14532d')}
          ${colourOption('sunset-coral','Sunset Coral','Warm and lively','#e11d48','#fb7185','#9f1239')}
          ${colourOption('warm-honey','Warm Honey','Soft and welcoming','#d97706','#fbbf24','#92400e')}
        </div>
      </div>
    `;

    document.body.append(backdrop, menuButton, drawer, bottom, settingsBackdrop, settings);
    wireShellEvents();
    syncActiveNavigation();
    syncSettingsUi();
  }

  function colourOption(key, name, note, one, two, three) {
    return `<button class="wh75-colour-option" type="button" data-wh75-colour="${key}" aria-pressed="false"><span class="wh75-swatch" aria-hidden="true"><i style="background:${one}"></i><i style="background:${two}"></i><i style="background:${three}"></i></span><span><span class="wh75-colour-name">${escapeHtml(name)}</span><span class="wh75-colour-note">${escapeHtml(note)}</span></span><span class="wh75-check" aria-hidden="true">✓</span></button>`;
  }

  function openDrawer() {
    if (!isMobile()) return;
    const drawer = document.getElementById('wh75MobileDrawer');
    const backdrop = document.getElementById('wh75DrawerBackdrop');
    drawer?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    document.getElementById('wh75MenuButton')?.setAttribute('aria-expanded', 'true');
    drawer?.querySelector('[data-wh75-close-drawer]')?.focus({ preventScroll:true });
  }

  function closeDrawer(returnFocus) {
    document.getElementById('wh75MobileDrawer')?.classList.remove('is-open');
    document.getElementById('wh75DrawerBackdrop')?.classList.remove('is-open');
    document.getElementById('wh75MenuButton')?.setAttribute('aria-expanded', 'false');
    if (returnFocus) document.getElementById('wh75MenuButton')?.focus({ preventScroll:true });
  }

  function openSettings() {
    closeDrawer(false);
    document.getElementById('wh75SettingsBackdrop')?.classList.add('is-open');
    document.getElementById('wh75SettingsPanel')?.classList.add('is-open');
    syncSettingsUi();
    document.querySelector('#wh75SettingsPanel [data-wh75-close-settings]')?.focus({ preventScroll:true });
  }

  function closeSettings() {
    document.getElementById('wh75SettingsBackdrop')?.classList.remove('is-open');
    document.getElementById('wh75SettingsPanel')?.classList.remove('is-open');
  }

  function triggerAskWaffle() {
    closeDrawer(false);
    const launcher = document.getElementById('aw37launch') || document.getElementById('v11133AskWaffleButton');
    if (launcher) {
      launcher.click();
      return;
    }
    window.dispatchEvent(new CustomEvent('waffle:ask-open-request'));
  }

  function triggerQuickAdd() {
    closeDrawer(false);
    const button = document.getElementById('v10QuickAddButton');
    if (button) {
      button.click();
      return;
    }
    if (pageName() !== 'calendar') {
      window.location.href = 'index.html?view=today&add=1';
      return;
    }
    document.getElementById('openPotentialBtn')?.click();
  }

  function setThemeMode(mode) {
    const wantDark = mode === 'dark';
    const isDark = document.body?.classList.contains('dark-theme');
    if (wantDark === isDark) {
      syncSettingsUi();
      return;
    }
    const existing = document.getElementById('themeToggle');
    if (existing) {
      existing.click();
    } else if (document.body) {
      document.body.classList.toggle('dark-theme', wantDark);
      try { localStorage.setItem('theme', wantDark ? 'dark' : 'light'); } catch (_) {}
    }
    setTimeout(syncSettingsUi, 0);
  }

  function toggleThemeQuick() {
    setThemeMode(document.body?.classList.contains('dark-theme') ? 'light' : 'dark');
  }

  function syncSettingsUi() {
    if (!document.body) return;
    const dark = document.body.classList.contains('dark-theme');
    document.querySelectorAll('[data-wh75-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.wh75Mode === (dark ? 'dark' : 'light')));
    });
    const selected = savedColourStyle();
    document.querySelectorAll('[data-wh75-colour]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.wh75Colour === selected));
    });
    document.querySelectorAll('[data-wh75-theme-label]').forEach(label => {
      label.textContent = dark ? 'Light Mode' : 'Dark Mode';
    });
    document.querySelectorAll('[data-wh75-theme-avatar]').forEach(image => {
      image.src = dark ? 'theme-light-avatar-v1174.svg' : 'theme-dark-avatar-v1174.svg';
      image.alt = dark ? 'Light mode Waffle avatar' : 'Dark mode Waffle avatar';
    });
  }

  function activeRoute() {
    const page = pageName();
    if (page === 'calendar') return currentCalendarView() === 'calendar' ? 'calendar' : 'today';
    if (page === 'directory' || page === 'reminders' || page === 'audit') return page;
    return '';
  }

  function syncActiveNavigation() {
    const route = activeRoute();
    document.querySelectorAll('[data-wh75-route]').forEach(item => {
      const active = item.dataset.wh75Route === route;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function wireShellEvents() {
    document.getElementById('wh75MenuButton')?.addEventListener('click', openDrawer);
    document.getElementById('wh75DrawerBackdrop')?.addEventListener('click', () => closeDrawer(true));
    document.getElementById('wh75SettingsBackdrop')?.addEventListener('click', closeSettings);
    document.querySelectorAll('[data-wh75-close-drawer]').forEach(button => button.addEventListener('click', () => closeDrawer(true)));
    document.querySelectorAll('[data-wh75-close-settings]').forEach(button => button.addEventListener('click', closeSettings));
    document.querySelectorAll('[data-wh75-settings]').forEach(button => button.addEventListener('click', openSettings));
    document.querySelectorAll('[data-wh75-ask]').forEach(button => button.addEventListener('click', triggerAskWaffle));
    document.querySelectorAll('[data-wh75-quick-add]').forEach(button => button.addEventListener('click', triggerQuickAdd));
    document.querySelectorAll('[data-wh75-theme-quick]').forEach(button => button.addEventListener('click', toggleThemeQuick));
    document.querySelectorAll('[data-wh75-mode]').forEach(button => button.addEventListener('click', () => setThemeMode(button.dataset.wh75Mode)));
    document.querySelectorAll('[data-wh75-colour]').forEach(button => button.addEventListener('click', () => applyColourStyle(button.dataset.wh75Colour, true)));
    document.querySelectorAll('#wh75MobileDrawer a').forEach(link => link.addEventListener('click', () => closeDrawer(false)));
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (document.getElementById('wh75SettingsPanel')?.classList.contains('is-open')) closeSettings();
      else closeDrawer(true);
    });
  }

  function processDeferredAdd() {
    if (pageName() !== 'calendar') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') !== '1') return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const button = document.getElementById('v10QuickAddButton');
      if (button) {
        clearInterval(timer);
        button.click();
        const url = new URL(window.location.href);
        url.searchParams.delete('add');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } else if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 120);
  }

  function ensureThemeObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'attributes' && mutation.target === document.body)) {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { frame = 0; syncSettingsUi(); });
      }
    });
    observer.observe(document.body, { attributes:true, attributeFilter:['class'] });
  }

  function apply() {
    if (!document.body) return;
    ensureStyles();
    applyColourStyle(savedColourStyle(), false);
    ensureShell();
    syncCalendarView();
    syncSettingsUi();
    ensureThemeObserver();
  }

  function start() {
    apply();
    processDeferredAdd();
    const media = window.matchMedia?.(MOBILE_QUERY);
    media?.addEventListener?.('change', () => { syncCalendarView(); if (!isMobile()) { closeDrawer(false); closeSettings(); } });
    window.addEventListener('pageshow', apply);
    window.v11175MobileSitterShellVersion = VERSION;
    window.WAFFLE_APPEARANCE = Object.freeze({
      version: VERSION,
      getColourStyle: savedColourStyle,
      setColourStyle: value => applyColourStyle(value, true),
      openSettings
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

/* ---- source: waffle-v11.1.76.js ---- */
/* ============================================================
   WAFFLE HOUSE V11.1.78 — UNIFORM MOBILE FOOTER AVATARS
   ------------------------------------------------------------
   Canonical mobile footer:
   Today · Calendar · Add · Care · Waffle AI

   - all five footer icons use the same circular avatar treatment;
   - Today / Calendar / Care use the sitter-supplied artwork;
   - Add keeps the supplied Waffle Add artwork in a circular shell;
   - Ask Waffle is renamed Waffle AI and reuses the canonical smile avatar;
   - the separate floating Ask Waffle launcher stays retired on mobile;
   - legacy mobile footers stay suppressed and the canonical footer self-heals.

   Compatibility note: this authority remains in waffle-v11.1.76.js because the
   shared loader already treats that file as the final mobile-footer authority.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.78';
  const MOBILE_QUERY = '(max-width: 820px)';
  const LAYOUT = 'today-calendar-add-care-waffle-ai';
  const TODAY_AVATAR = 'waffle-today-avatar-v1178.svg?v=11.1.78';
  const CALENDAR_AVATAR = 'waffle-calendar-avatar-v1178.svg?v=11.1.78';
  const ADD_AVATAR = 'waffle-add-avatar-v1177.svg?v=11.1.78';
  const CARE_AVATAR = 'waffle-care-avatar-v1178.svg?v=11.1.78';
  const LEGACY_SELECTOR = [
    'nav.app-tabs',
    '#v1118MobileNav',
    'nav.v1118-mobile-nav',
    '.v1118-mobile-nav'
  ].join(',');

  let mutationObserver = null;
  let bodyObserver = null;
  let frame = 0;

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function calendarView() {
    if (pageName() !== 'calendar') return '';
    const bodyView = String(document.body?.dataset?.wh75MobileView || '');
    if (bodyView === 'calendar' || bodyView === 'today') return bodyView;
    try {
      return new URLSearchParams(window.location.search).get('view') === 'calendar'
        ? 'calendar'
        : 'today';
    } catch (_) {
      return 'today';
    }
  }

  function activeRoute() {
    const page = pageName();
    if (page === 'calendar') return calendarView() === 'calendar' ? 'calendar' : 'today';
    if (page === 'directory') return 'directory';
    return '';
  }

  function ensureStyle() {
    if (document.getElementById('wh78MobileFooterStyle')) return;
    document.getElementById('wh77MobileFooterStyle')?.remove();
    const style = document.createElement('style');
    style.id = 'wh78MobileFooterStyle';
    style.textContent = `
      @media (max-width:820px) {
        body #aw37launch,
        body #v11133AskWaffleButton {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }
        #wh75MobileBottomNav {
          grid-template-columns:repeat(5,minmax(0,1fr))!important;
        }
        #wh75MobileBottomNav .wh75-bottom-item {
          min-width:0!important;
        }
        #wh75MobileBottomNav .wh75-bottom-icon.wh78-avatar-shell {
          display:grid!important;
          place-items:center!important;
          width:42px!important;
          height:42px!important;
          min-width:42px!important;
          min-height:42px!important;
          padding:0!important;
          margin:0 auto 4px!important;
          border-radius:50%!important;
          overflow:hidden!important;
          background:color-mix(in srgb,var(--wh75-panel,#132139) 88%,#fff 12%)!important;
          box-shadow:0 0 0 2px var(--wh75-ring),0 6px 16px rgba(0,0,0,.18)!important;
        }
        #wh75MobileBottomNav .wh78-nav-avatar {
          display:block!important;
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          object-fit:cover!important;
          border-radius:50%!important;
        }
        #wh75MobileBottomNav .wh78-nav-avatar[hidden] {
          display:none!important;
        }
        #wh75MobileBottomNav .wh75-bottom-add .wh75-bottom-icon.wh78-avatar-shell {
          width:44px!important;
          height:44px!important;
          min-width:44px!important;
          min-height:44px!important;
        }
        #wh75MobileBottomNav .wh75-bottom-item.is-active .wh78-avatar-shell {
          box-shadow:0 0 0 3px var(--wh75-accent,#b86cff),0 7px 18px var(--wh75-ring)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function suppressLegacyFooter(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.id === 'wh75MobileBottomNav' || node.closest?.('#wh75MobileDrawer')) return;

    const generated = node.id === 'v1118MobileNav' || node.classList.contains('v1118-mobile-nav');
    if (generated) {
      node.remove();
      return;
    }

    if (!node.classList.contains('app-tabs')) return;

    if (isMobile()) {
      node.dataset.wh76RetiredMobileFooter = 'true';
      node.setAttribute('aria-hidden', 'true');
      node.inert = true;
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
      return;
    }

    if (node.dataset.wh76RetiredMobileFooter === 'true') {
      delete node.dataset.wh76RetiredMobileFooter;
      node.removeAttribute('aria-hidden');
      node.inert = false;
      node.style.display = '';
      node.style.visibility = '';
      node.style.pointerEvents = '';
    }
  }

  function suppressAllLegacyFooters() {
    document.querySelectorAll(LEGACY_SELECTOR).forEach(suppressLegacyFooter);
  }

  function suppressFloatingAskLauncher() {
    document.querySelectorAll('#aw37launch,#v11133AskWaffleButton').forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (isMobile()) {
        node.dataset.wh78MobileLauncherRetired = 'true';
        node.setAttribute('aria-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      } else if (node.dataset.wh78MobileLauncherRetired === 'true') {
        delete node.dataset.wh78MobileLauncherRetired;
        node.removeAttribute('aria-hidden');
        node.style.display = '';
        node.style.visibility = '';
        node.style.pointerEvents = '';
      }
    });
  }

  function avatarMarkup(src, alt, extra) {
    return `<span class="wh75-bottom-icon wh78-avatar-shell" aria-hidden="true"><img class="wh78-nav-avatar ${extra || ''}" src="${src}" alt="${alt || ''}"></span>`;
  }

  function bottomMarkup() {
    return [
      `<a class="wh75-bottom-item" href="index.html?view=today" data-wh75-route="today">${avatarMarkup(TODAY_AVATAR, '')}<span>Today</span></a>`,
      `<a class="wh75-bottom-item" href="index.html?view=calendar" data-wh75-route="calendar">${avatarMarkup(CALENDAR_AVATAR, '')}<span>Calendar</span></a>`,
      `<button class="wh75-bottom-item wh75-bottom-add" type="button" data-wh78-quick-add aria-label="Add">${avatarMarkup(ADD_AVATAR, '')}<span>Add</span></button>`,
      `<a class="wh75-bottom-item" href="directory.html" data-wh75-route="directory">${avatarMarkup(CARE_AVATAR, '')}<span>Care</span></a>`,
      '<button class="wh75-bottom-item wh78-bottom-ai" type="button" data-wh78-ai aria-label="Waffle AI"><span class="wh75-bottom-icon wh78-avatar-shell" aria-hidden="true"><img class="wh78-nav-avatar" data-wh78-ai-avatar alt="" hidden></span><span>Waffle AI</span></button>'
    ].join('');
  }

  function triggerQuickAdd() {
    const button = document.getElementById('v10QuickAddButton');
    if (button) {
      button.click();
      return;
    }
    if (pageName() !== 'calendar') {
      window.location.href = 'index.html?view=today&add=1';
      return;
    }
    document.getElementById('openPotentialBtn')?.click();
  }

  function triggerWaffleAI() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (modal) {
      modal.hidden = false;
      modal.querySelector('input')?.focus();
      return;
    }
    const launcher = document.getElementById('aw37launch') || document.getElementById('v11133AskWaffleButton');
    if (launcher) {
      launcher.click();
      return;
    }
    window.dispatchEvent(new CustomEvent('waffle:ask-open-request'));
  }

  function wireBottom(nav) {
    if (!nav || nav.dataset.wh78Wired === 'true') return;
    nav.dataset.wh78Wired = 'true';
    nav.querySelector('[data-wh78-quick-add]')?.addEventListener('click', triggerQuickAdd);
    nav.querySelector('[data-wh78-ai]')?.addEventListener('click', triggerWaffleAI);
  }

  function aiAvatarSource() {
    const asset = String(window.WAFFLE_AI_ASSETS?.icon || '').trim();
    if (asset) return asset;
    const launcherImage = document.querySelector('#aw37launch img,#v11133AskWaffleButton img');
    return String(launcherImage?.src || '').trim();
  }

  function syncAIAvatar(nav) {
    const image = (nav || document).querySelector?.('[data-wh78-ai-avatar]');
    if (!image) return;
    const source = aiAvatarSource();
    if (!source) {
      image.hidden = true;
      return;
    }
    if (image.src !== source) image.src = source;
    image.hidden = false;
  }

  function syncActiveNavigation(nav) {
    const route = activeRoute();
    (nav || document).querySelectorAll?.('#wh75MobileBottomNav [data-wh75-route]')?.forEach(item => {
      const active = item.dataset.wh75Route === route;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function ensureCanonicalMarkup(nav) {
    if (!nav) return;
    if (nav.dataset.wh78Layout === LAYOUT && nav.querySelector('[data-wh78-quick-add]') && nav.querySelector('[data-wh78-ai]')) return;
    nav.innerHTML = bottomMarkup();
    nav.dataset.wh78Layout = LAYOUT;
    delete nav.dataset.wh78Wired;
    wireBottom(nav);
  }

  function ensureBottomNav() {
    if (!document.body) return null;

    let nav = document.getElementById('wh75MobileBottomNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'wh75MobileBottomNav';
      nav.setAttribute('aria-label', 'Primary mobile navigation');
      nav.dataset.wh76Restored = 'true';
      document.body.appendChild(nav);
    }

    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    ensureCanonicalMarkup(nav);
    wireBottom(nav);

    if (isMobile()) {
      nav.hidden = false;
      nav.removeAttribute('aria-hidden');
      nav.inert = false;
      nav.dataset.wh78ForcedMobile = 'true';
      nav.style.setProperty('display', 'grid', 'important');
      nav.style.setProperty('visibility', 'visible', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      nav.style.setProperty('position', 'fixed', 'important');
      nav.style.setProperty('left', '0', 'important');
      nav.style.setProperty('right', '0', 'important');
      nav.style.setProperty('bottom', '0', 'important');
      nav.style.setProperty('z-index', '2147481795', 'important');
    } else if (nav.dataset.wh78ForcedMobile === 'true') {
      delete nav.dataset.wh78ForcedMobile;
      nav.style.display = '';
      nav.style.visibility = '';
      nav.style.pointerEvents = '';
      nav.style.position = '';
      nav.style.left = '';
      nav.style.right = '';
      nav.style.bottom = '';
      nav.style.zIndex = '';
    }

    syncActiveNavigation(nav);
    syncAIAvatar(nav);
    return nav;
  }

  function reconcile() {
    if (!document.body) return;
    ensureStyle();
    suppressAllLegacyFooters();
    suppressFloatingAskLauncher();
    ensureBottomNav();
  }

  function queueReconcile() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      reconcile();
    });
  }

  function wireMutationProtection() {
    if (!document.body || typeof MutationObserver !== 'function') return;

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
          Array.from(mutation.addedNodes || []).some(node => {
            if (!(node instanceof Element)) return false;
            return node.matches?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav,#aw37launch,#v11133AskWaffleButton') ||
              !!node.querySelector?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav,#aw37launch,#v11133AskWaffleButton');
          }) ||
          Array.from(mutation.removedNodes || []).some(node =>
            node instanceof Element &&
            (node.id === 'wh75MobileBottomNav' || !!node.querySelector?.('#wh75MobileBottomNav'))
          )
        );
        if (relevant) queueReconcile();
      });
      mutationObserver.observe(document.body, { childList:true, subtree:true });
    }

    if (!bodyObserver) {
      bodyObserver = new MutationObserver(queueReconcile);
      bodyObserver.observe(document.body, {
        attributes:true,
        attributeFilter:['data-wh75-mobile-view', 'data-waffle-page']
      });
    }
  }

  function start() {
    reconcile();
    wireMutationProtection();

    [40, 120, 300, 700, 1400, 2600, 4800, 8000].forEach(delay => setTimeout(reconcile, delay));

    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('resize', queueReconcile);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11176AuthoritativeMobileFooterVersion = VERSION;
    window.v11177MobileFooterAvatarVersion = VERSION;
    window.v11178UniformMobileFooterVersion = VERSION;
    window.WAFFLE_MOBILE_FOOTER = Object.freeze({ version:VERSION, reconcile, layout:LAYOUT });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();

/* V11.1.80 dynamic loader retired: implementation is canonical below. */

/* ---- source: waffle-v11.1.80.js ---- */
/* ============================================================
   WAFFLE HOUSE V11.1.88 — SINGLE INSET MOBILE DATE FRAME
   ------------------------------------------------------------
   Final mobile Calendar / Today header authority:
   - keeps the Waffle House branding logo retired on mobile;
   - keeps Notifications, Search and Live/Updating in the right rail;
   - uses Waffle artwork for Notifications and Search;
   - keeps Install in a safe left-side slot below the date;
   - removes All clear, Operations Home and Today at Waffle House;
   - promotes and centres the live date with symmetric action-safe space;
   - keeps only the inset colour-style brackets around the date;
   - retires the legacy outer-left accent so the left border is not doubled;
   - preserves original action listeners by moving live DOM nodes.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.88';
  const MOBILE_QUERY = '(max-width: 820px)';
  const NOTIFICATION_AVATAR = 'waffle-notification-avatar-v1181.svg?v=11.1.88';
  const SEARCH_AVATAR = 'waffle-search-avatar-v1181.svg?v=11.1.88';
  const TODAY_AVATAR = 'waffle-today-avatar-v1178.svg?v=11.1.88';

  const moved = new Map();
  let frame = 0;
  let observer = null;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureStyle() {
    let style = document.getElementById('wh80MobileHeaderStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wh80MobileHeaderStyle';
      document.head.appendChild(style);
    }

    style.textContent = `
      @media (max-width:820px) {
        body[data-waffle-page="calendar"] .calendar-header-branding .calendar-brand-img,
        body[data-waffle-page="calendar"] .calendar-header-branding .calendar-brand-logo {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }

        body[data-waffle-page="calendar"] .calendar-header-branding {
          min-height:0!important;
        }

        body[data-waffle-page="calendar"] .v10-ops-heading .v10-eyebrow,
        body[data-waffle-page="calendar"] #v10OperationsTitle,
        body[data-waffle-page="calendar"] #v10TodayStatus,
        body[data-waffle-page="calendar"] .v10-today-status {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }

        /* Retire the legacy exposed colour-style edge. Only the inset
           heading brackets below are allowed to render the date frame. */
        body[data-waffle-page="calendar"][data-wh75-mobile-view="today"] .v10-operations-home {
          border-left-color:transparent!important;
          border-right-color:transparent!important;
        }

        body[data-waffle-page="calendar"][data-wh75-mobile-view="today"] .v10-operations-home::before {
          content:none!important;
          display:none!important;
          border:0!important;
          box-shadow:none!important;
          background:none!important;
        }

        body[data-waffle-page="calendar"] #v10TodayDateLabel {
          position:relative!important;
          z-index:2!important;
          width:100%!important;
          max-width:none!important;
          margin:0 auto!important;
          padding:0 72px!important;
          box-sizing:border-box!important;
          text-align:center!important;
          font-family:var(--wh82-title-font-family,inherit)!important;
          font-size:var(--wh82-title-font-size,28px)!important;
          font-weight:var(--wh82-title-font-weight,800)!important;
          font-style:var(--wh82-title-font-style,normal)!important;
          line-height:var(--wh82-title-line-height,1.05)!important;
          letter-spacing:var(--wh82-title-letter-spacing,-0.02em)!important;
          color:var(--wh82-title-color,inherit)!important;
        }

        body[data-waffle-page="calendar"] .v10-ops-heading {
          position:relative!important;
          isolation:isolate!important;
          width:100%!important;
          align-items:center!important;
          min-height:42px!important;
        }

        /* Symmetric colour-style brackets sit just inside both action-safe
           gutters. They are the single visible date frame. */
        body[data-waffle-page="calendar"] .v10-ops-heading::before,
        body[data-waffle-page="calendar"] .v10-ops-heading::after {
          content:"";
          position:absolute;
          top:-7px;
          bottom:-7px;
          width:18px;
          box-sizing:border-box;
          border:3px solid var(--wh75-accent,var(--v10-primary,#2563eb));
          pointer-events:none;
          z-index:1;
          opacity:.92;
        }

        body[data-waffle-page="calendar"] .v10-ops-heading::before {
          left:66px;
          border-right:0;
          border-radius:18px 0 0 18px;
        }

        body[data-waffle-page="calendar"] .v10-ops-heading::after {
          right:66px;
          border-left:0;
          border-radius:0 18px 18px 0;
        }

        #wh80MobileHeaderRail {
          position:fixed;
          top:calc(12px + env(safe-area-inset-top));
          right:12px;
          z-index:2147481801;
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:8px;
          width:max-content;
          pointer-events:none;
        }

        #wh80MobileHeaderRail > * {
          pointer-events:auto;
          margin:0!important;
          flex:none!important;
        }

        #wh80MobileHeaderRail > button,
        #wh80MobileHeaderRail > a,
        #wh80MobileHeaderRail > [role="button"] {
          box-sizing:border-box!important;
          max-width:92px;
        }

        #wh80MobileHeaderRail [data-wh80-role="notification"],
        #wh80MobileHeaderRail [data-wh80-role="search"] {
          position:relative!important;
          width:46px!important;
          height:46px!important;
          min-width:46px!important;
          min-height:46px!important;
          padding:0!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          overflow:hidden!important;
          border-radius:50%!important;
          font-size:0!important;
          line-height:0!important;
          color:transparent!important;
        }

        #wh80MobileHeaderRail [data-wh80-role="notification"] > :not(.wh81-header-avatar),
        #wh80MobileHeaderRail [data-wh80-role="search"] > :not(.wh81-header-avatar) {
          display:none!important;
        }

        #wh80MobileHeaderRail .wh81-header-avatar {
          display:block!important;
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          object-fit:cover!important;
          object-position:center!important;
          border-radius:50%!important;
          pointer-events:none!important;
        }

        #wh80MobileHeaderRail [data-wh80-role="status"] {
          min-height:34px!important;
          max-width:92px!important;
          padding-left:10px!important;
          padding-right:10px!important;
          white-space:nowrap!important;
          justify-content:center!important;
          text-align:center!important;
        }

        #wh81MobileInstallSlot {
          display:flex!important;
          align-items:center!important;
          justify-content:flex-start!important;
          width:min(180px,calc(100% - 112px))!important;
          min-height:0!important;
          margin:12px 0 14px!important;
          padding:0!important;
          box-sizing:border-box!important;
        }

        #wh81MobileInstallSlot > * {
          width:auto!important;
          max-width:180px!important;
          min-height:38px!important;
          margin:0!important;
          flex:none!important;
          white-space:nowrap!important;
        }
      }

      @media (max-width:380px) {
        body[data-waffle-page="calendar"] #v10TodayDateLabel {
          padding-left:64px!important;
          padding-right:64px!important;
        }
        body[data-waffle-page="calendar"] .v10-ops-heading::before { left:58px; }
        body[data-waffle-page="calendar"] .v10-ops-heading::after { right:58px; }
      }

      @media (min-width:821px) {
        #wh80MobileHeaderRail,
        #wh81MobileInstallSlot { display:none!important; }
      }
    `;
  }

  function signature(node) {
    if (!(node instanceof Element)) return '';
    return [
      node.id,
      node.className,
      node.getAttribute('aria-label'),
      node.getAttribute('title'),
      node.getAttribute('data-action'),
      node.getAttribute('data-testid'),
      node.textContent
    ].join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function excluded(node) {
    return !node || node.id === 'wh75MenuButton' ||
      !!node.closest('#wh75MobileDrawer,#wh75MobileBottomNav,#wh75SettingsPanel,#wh80MobileHeaderRail,#wh81MobileInstallSlot');
  }

  function visible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function visibleNearTop(node) {
    return visible(node) && node.getBoundingClientRect().top < 220;
  }

  function promoteTodayDate() {
    const title = document.getElementById('v10OperationsTitle');
    const date = document.getElementById('v10TodayDateLabel');
    if (!(title instanceof HTMLElement) || !(date instanceof HTMLElement)) return;
    const titleStyle = getComputedStyle(title);
    date.style.setProperty('--wh82-title-font-family', titleStyle.fontFamily || 'inherit');
    date.style.setProperty('--wh82-title-font-size', titleStyle.fontSize || '28px');
    date.style.setProperty('--wh82-title-font-weight', titleStyle.fontWeight || '800');
    date.style.setProperty('--wh82-title-font-style', titleStyle.fontStyle || 'normal');
    date.style.setProperty('--wh82-title-line-height', titleStyle.lineHeight || '1.05');
    date.style.setProperty('--wh82-title-letter-spacing', titleStyle.letterSpacing || '-0.02em');
    date.style.setProperty('--wh82-title-color', titleStyle.color || 'inherit');
    date.setAttribute('aria-label', `Today: ${String(date.textContent || '').trim()}`);
  }

  function findAction(kind, rail) {
    const existing = rail?.querySelector(`[data-wh80-role="${kind}"]`);
    if (existing) return existing;
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .filter(node => !excluded(node) && visibleNearTop(node));
    if (kind === 'notification') return candidates.find(node => /notif|notification|bell|🔔|🔕/.test(signature(node))) || null;
    if (kind === 'search') return candidates.find(node => /search|magnif|🔍|🔎/.test(signature(node))) || null;
    return null;
  }

  function findStatus(rail) {
    const existing = rail?.querySelector('[data-wh80-role="status"]');
    if (existing) return existing;
    const direct = document.querySelector('#waffleConnectionStatus,.waffle-connection-status,[data-waffle-connection-status],[data-connection-status]');
    if (direct && !excluded(direct)) return direct;
    return Array.from(document.querySelectorAll('button,span,div'))
      .filter(node => !excluded(node) && visibleNearTop(node))
      .find(node => /^(↻\s*)?(updating|syncing|live|offline|online|synced)(\b|…|\.\.\.)/.test(String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase())) || null;
  }

  function findInstall(slot) {
    const existing = slot?.querySelector('[data-wh81-role="install"]');
    if (existing) return existing;
    const preferred = document.querySelector('#installAppBtn,#pwaInstallButton,#installPwaButton,#installButton,[data-install-app],[data-pwa-install]');
    if (preferred && !excluded(preferred) && visible(preferred)) return preferred;
    return Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .filter(node => !excluded(node) && visible(node))
      .find(node => /(^|\s)install(\s|$)|install app|add to home/.test(signature(node))) || null;
  }

  function ensureRail() {
    let rail = document.getElementById('wh80MobileHeaderRail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'wh80MobileHeaderRail';
      rail.setAttribute('aria-label', 'Mobile header actions');
      document.body.appendChild(rail);
    }
    return rail;
  }

  function ensureInstallSlot() {
    const operations = document.querySelector('.v10-operations-home');
    if (!operations) return null;
    let slot = document.getElementById('wh81MobileInstallSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'wh81MobileInstallSlot';
      slot.setAttribute('aria-label', 'Install Waffle House');
    }
    const heading = operations.querySelector('.v10-ops-heading');
    if (heading?.parentNode === operations) {
      if (heading.nextSibling !== slot) operations.insertBefore(slot, heading.nextSibling);
    } else if (slot.parentNode !== operations) {
      operations.insertBefore(slot, operations.firstChild);
    }
    return slot;
  }

  function remember(node) {
    if (!node || moved.has(node)) return;
    moved.set(node, { parent:node.parentNode, next:node.nextSibling });
  }

  function moveIntoRail(node, role, rail) {
    if (!(node instanceof HTMLElement) || !rail) return;
    remember(node);
    node.dataset.wh80Role = role;
    if (node.parentNode !== rail) rail.appendChild(node);
  }

  function moveInstall(node, slot) {
    if (!(node instanceof HTMLElement) || !slot) return;
    remember(node);
    node.dataset.wh81Role = 'install';
    if (node.parentNode !== slot) slot.appendChild(node);
  }

  function ensureAvatar(node, role, src, label) {
    if (!(node instanceof HTMLElement)) return;
    let image = node.querySelector(`.wh81-header-avatar[data-wh81-avatar="${role}"]`);
    if (!image) {
      image = document.createElement('img');
      image.className = 'wh81-header-avatar';
      image.dataset.wh81Avatar = role;
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      node.appendChild(image);
    }
    const desired = new URL(src, document.baseURI).href;
    if (image.src !== desired) image.src = src;
    node.setAttribute('aria-label', label);
    node.setAttribute('title', label);
  }

  function syncTodayFooterAvatar() {
    const image = document.querySelector('#wh75MobileBottomNav [data-wh75-route="today"] .wh78-nav-avatar,#wh75MobileBottomNav [data-wh75-route="today"] img');
    if (!image) return;
    const desired = new URL(TODAY_AVATAR, document.baseURI).href;
    if (image.src !== desired) image.src = TODAY_AVATAR;
  }

  function restoreAll() {
    document.querySelectorAll('.wh81-header-avatar').forEach(image => image.remove());
    moved.forEach((location, node) => {
      if (!(node instanceof HTMLElement)) return;
      delete node.dataset.wh80Role;
      delete node.dataset.wh81Role;
      const parent = location.parent;
      if (!(parent instanceof Node) || !parent.isConnected) return;
      if (location.next && location.next.parentNode === parent) parent.insertBefore(node, location.next);
      else parent.appendChild(node);
    });
    moved.clear();
    document.getElementById('wh80MobileHeaderRail')?.remove();
    document.getElementById('wh81MobileInstallSlot')?.remove();
  }

  function reconcile() {
    frame = 0;
    if (!document.body || !isCalendarPage()) {
      restoreAll();
      return;
    }
    ensureStyle();
    if (!isMobile()) {
      restoreAll();
      return;
    }

    promoteTodayDate();
    const rail = ensureRail();
    const installSlot = ensureInstallSlot();
    const notification = findAction('notification', rail);
    const search = findAction('search', rail);
    const status = findStatus(rail);
    const install = findInstall(installSlot);

    moveIntoRail(notification, 'notification', rail);
    moveIntoRail(search, 'search', rail);
    moveIntoRail(status, 'status', rail);
    moveInstall(install, installSlot);

    if (notification) ensureAvatar(notification, 'notification', NOTIFICATION_AVATAR, 'Notifications');
    if (search) ensureAvatar(search, 'search', SEARCH_AVATAR, 'Search');

    ['notification', 'search', 'status'].forEach(role => {
      const node = rail.querySelector(`[data-wh80-role="${role}"]`);
      if (node) rail.appendChild(node);
    });
    syncTodayFooterAvatar();
  }

  function queue() {
    if (frame) return;
    frame = requestAnimationFrame(reconcile);
  }

  function start() {
    reconcile();
    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(queue);
      observer.observe(document.body, { childList:true, subtree:true });
    }
    [40,120,260,520,900,1500,2600,4400,7200].forEach(delay => setTimeout(reconcile, delay));
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11180MobileHeaderRailVersion = VERSION;
    window.v11181MobileHeaderAvatarsVersion = VERSION;
    window.v11182CleanMobileTodayHeaderVersion = VERSION;
    window.v11186CenteredMobileDateVersion = VERSION;
    window.v11187InsetMobileDateFrameVersion = VERSION;
    window.v11188SingleInsetMobileDateFrameVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

/* ---- source: waffle-v11.1.89.js ---- */
/* ============================================================
   WAFFLE HOUSE V11.1.89 — MOBILE QUICK ACTION COMPLETION
   ------------------------------------------------------------
   - keeps Quick Action sheets/forms fully reachable on mobile;
   - lifts Quick Action modals above the fixed mobile footer;
   - makes Potential and Meet & Greet forms viewport-scrollable;
   - routes Reminder into Organiser > Sticky Notes instead of the
     retired standalone Reminder destination;
   - ensures Organiser assets exist before opening Reminder;
   - validates/labels the four canonical Quick Actions.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.89';
  const MOBILE_QUERY = '(max-width: 820px)';
  let observer = null;
  let queued = false;
  let organiserOpenAttempted = false;
  let organiserScriptRequested = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureStyle() {
    let style = document.getElementById('wh89QuickActionMobileStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wh89QuickActionMobileStyle';
      document.head.appendChild(style);
    }

    style.textContent = `
      @media (max-width:820px) {
        /* Quick Action chooser must sit above the fixed mobile footer and
           remain fully reachable on short screens / Fold-style viewports. */
        #v10QuickAddSheet {
          z-index:2147483100!important;
          box-sizing:border-box!important;
          max-height:100vh!important;
          max-height:100dvh!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          padding-bottom:calc(20px + env(safe-area-inset-bottom))!important;
        }

        #v10QuickAddSheet > * {
          max-height:calc(100vh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          max-height:calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
        }

        /* These are the two form modals launched directly by Quick Actions. */
        #potentialStayModal,
        #customBookingModal {
          z-index:2147483200!important;
          box-sizing:border-box!important;
          align-items:flex-start!important;
          justify-content:center!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
          padding:
            calc(10px + env(safe-area-inset-top))
            10px
            calc(92px + env(safe-area-inset-bottom))!important;
        }

        #potentialStayModal > .modal-content-panel,
        #customBookingModal > .modal-content-panel {
          width:min(100%,520px)!important;
          max-width:520px!important;
          max-height:calc(100vh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          max-height:calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          margin:auto 0!important;
          padding:18px!important;
          box-sizing:border-box!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
          border-radius:16px!important;
          scroll-padding-bottom:96px;
        }

        #potentialStayModal input,
        #potentialStayModal select,
        #potentialStayModal textarea,
        #customBookingModal input,
        #customBookingModal select,
        #customBookingModal textarea {
          max-width:100%!important;
          box-sizing:border-box!important;
        }

        /* Keep the final form actions comfortably above browser/PWA chrome. */
        #potentialStayModal .modal-content-panel > :last-child,
        #customBookingModal .modal-content-panel > :last-child {
          margin-bottom:calc(8px + env(safe-area-inset-bottom))!important;
        }

        /* Organiser Sticky Note composer is the Reminder sub-function now. */
        body[data-waffle-page="reminders"] #reminderComposer:not([hidden]) {
          scroll-margin-top:16px;
          scroll-margin-bottom:110px;
        }
      }
    `;
  }

  function ensureOrganiserAssets() {
    if (pageName() !== 'reminders') return;

    if (!document.querySelector('link[data-wh89-organiser-css]')) {
      const existingCss = Array.from(document.styleSheets || []).some(sheet =>
        String(sheet.href || '').includes('/organiser.css')
      );
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'organiser.css?build=2026.08.27.04';
        link.dataset.wh89OrganiserCss = 'true';
        document.head.appendChild(link);
      }
    }

    if (document.getElementById('v11115OrganiserRoot') || organiserScriptRequested) return;
    const existingScript = Array.from(document.scripts).find(script =>
      String(script.src || '').includes('/organiser.js')
    );
    if (existingScript) {
      organiserScriptRequested = true;
      return;
    }

    organiserScriptRequested = true;
    const script = document.createElement('script');
    script.src = 'organiser.js?build=2026.08.27.04';
    script.async = false;
    script.dataset.wh89Organiser = 'true';
    script.addEventListener('load', () => {
      organiserOpenAttempted = false;
      setTimeout(reconcile, 0);
    }, { once:true });
    document.head.appendChild(script);
  }

  function closeQuickAddSheet() {
    const sheet = document.getElementById('v10QuickAddSheet');
    if (sheet) sheet.hidden = true;
    document.body?.classList.remove('v10-quick-add-open');
  }

  function organiserReminderUrl() {
    const url = new URL('reminders.html', document.baseURI);
    url.searchParams.set('organiser', 'notes');
    url.searchParams.set('compose', '1');
    return url.href;
  }

  function routeReminderToOrganiser(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v10-quick-action="reminder"]')
      : null;
    if (!trigger) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    closeQuickAddSheet();

    if (pageName() === 'reminders') {
      ensureOrganiserAssets();
      openOrganiserReminderSubflow(true);
      return;
    }

    window.location.href = organiserReminderUrl();
  }

  function labelCanonicalActions() {
    const sheet = document.getElementById('v10QuickAddSheet');
    if (!sheet) return;

    const definitions = {
      boarding: ['Boarding', 'Confirmed booking form'],
      potential: ['Potential', 'Pending stay request'],
      meet: ['Meet & Greet', 'Schedule a visit'],
      reminder: ['Reminder', 'Organiser · Sticky Notes']
    };

    Object.entries(definitions).forEach(([kind, copy]) => {
      const button = sheet.querySelector(`[data-v10-quick-action="${kind}"]`);
      if (!button) return;
      button.dataset.wh89Validated = 'true';
      const strong = button.querySelector('strong');
      const small = button.querySelector('small');
      if (strong) strong.textContent = copy[0];
      if (small) small.textContent = copy[1];
      button.setAttribute('aria-label', `${copy[0]} — ${copy[1]}`);
    });
  }

  function revealNotesTab() {
    const tab = document.querySelector('[data-organiser-tab="notes"]');
    if (!(tab instanceof HTMLElement)) return false;
    if (!tab.classList.contains('is-active')) tab.click();
    return true;
  }

  function openStickyNoteComposer() {
    const composer = document.getElementById('reminderComposer');
    const addButton = document.getElementById('addReminderNoteBtn');

    if (typeof window.openReminderComposer === 'function') {
      try { window.openReminderComposer(); } catch (_) {}
    } else if (addButton instanceof HTMLElement) {
      addButton.click();
    }

    const target = document.getElementById('reminderComposer');
    if (target && !target.hidden) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        const first = target.querySelector('input:not([type="hidden"]),textarea,select');
        if (first instanceof HTMLElement) first.focus({ preventScroll: true });
      });
      return true;
    }

    return !!composer && !composer.hidden;
  }

  function cleanReminderQuery() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('compose');
      url.searchParams.delete('organiser');
      url.searchParams.delete('quickAction');
      history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_) {}
  }

  function openOrganiserReminderSubflow(force) {
    if (pageName() !== 'reminders') return false;

    const params = new URLSearchParams(window.location.search);
    const requested = force ||
      params.get('compose') === '1' ||
      params.get('quickAction') === 'reminder';
    if (!requested || organiserOpenAttempted) return false;

    ensureOrganiserAssets();
    if (!revealNotesTab()) return false;
    if (!openStickyNoteComposer()) return false;

    organiserOpenAttempted = true;
    cleanReminderQuery();
    return true;
  }

  function validateQuickActionFunctions() {
    const sheet = document.getElementById('v10QuickAddSheet');
    const hasAction = kind => !!sheet?.querySelector(`[data-v10-quick-action="${kind}"]`);
    const report = {
      boarding: hasAction('boarding'),
      potential: hasAction('potential') && (
        typeof window.openNewPotentialModal === 'function' ||
        !!document.getElementById('potentialStayModal')
      ),
      meet: hasAction('meet') && (
        typeof window.openV10MeetGreetModal === 'function' ||
        !!document.getElementById('customBookingModal')
      ),
      reminder: hasAction('reminder')
    };
    report.allValid = Object.values(report).every(Boolean);
    window.WAFFLE_QUICK_ACTION_STATUS = report;
    return report;
  }

  function reconcile() {
    queued = false;
    ensureStyle();
    if (pageName() === 'reminders') ensureOrganiserAssets();
    labelCanonicalActions();
    validateQuickActionFunctions();
    if (isMobile()) openOrganiserReminderSubflow(false);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(reconcile);
  }

  function start() {
    ensureStyle();
    ensureOrganiserAssets();
    document.addEventListener('click', routeReminderToOrganiser, true);
    reconcile();

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(queue);
      observer.observe(document.body, { childList:true, subtree:true });
    }

    [80,180,360,700,1200,2200,4200].forEach(delay => setTimeout(reconcile, delay));
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11189MobileQuickActionCompletionVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

/* ---- source: waffle-ui-contract.js ---- */
/* ============================================================
   WAFFLE HOUSE — FINAL UI CONTRACT
   Version 11.1.51

   Purpose
   -------
   Waffle House historically evolved through additive UI patches. Some older
   layers still create DOM that newer layers replace. This contract is the last
   authority for visible application chrome and retired UI.

   Rules
   -----
   1. Retired UI may remain only as hidden compatibility DOM when old code still
      requires an element ID.
   2. A newer visual component must never be preceded by a visible legacy one.
   3. Ask Waffle is floating on Calendar/Care and never participates in header
      layout.
   4. Organiser is the only visible Reminders page shell; Sticky Notes remain a
      feature inside Organiser, not a startup page.
   5. Historical PDF Intake is read-only UI. Legacy upload controls cannot be
      reintroduced by delayed/focus recovery passes.
   6. Waffle AI is free-form conversation; legacy quick-prompt chips are retired.
   7. Ask Waffle composer geometry is canonical after prompt-strip retirement.
   8. This file performs geometry/visibility normalisation only. It does not
      rebuild operational data views.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.51';
  const CONTRACT_ATTR = 'data-waffle-ui-contract';
  const PROTECTED_SELECTOR = [
    '#aw37launch',
    '#v11133AskWaffleButton',
    '#v11133AskWaffleModal .aw37-prompts',
    '#v11133AskWaffleModal .aw37-card',
    '#v11133AskWaffleModal .aw37-form',
    '#openLegacyIntakeUploadBtn',
    '#v11123LegacyIntakeHistoryNote',
    '[data-upload-legacy-intake]',
    '[data-reassign-legacy-intake]',
    '[data-v1115-recovery-panel]',
    '#v1118MobileNav',
    'nav.v1118-mobile-nav',
    '.calendar-brand-copy',
    '.summary-dashboard',
    '.meet-greet-dashboard',
    '.directory-header-actions',
    '.calendar-header-branding',
    '.app-tabs'
  ].join(', ');

  let observer = null;
  let frame = 0;

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function compatibilitySink() {
    let sink = document.getElementById('waffleFinalUiCompatibilitySink');
    if (sink) return sink;

    sink = document.createElement('div');
    sink.id = 'waffleFinalUiCompatibilitySink';
    sink.hidden = true;
    sink.setAttribute('aria-hidden', 'true');
    sink.style.setProperty('display', 'none', 'important');
    sink.style.setProperty('visibility', 'hidden', 'important');
    sink.style.setProperty('pointer-events', 'none', 'important');
    document.body.appendChild(sink);
    return sink;
  }

  function moveToSink(node) {
    if (!node || !document.body) return;
    const sink = compatibilitySink();
    if (node !== sink && !sink.contains(node)) sink.appendChild(node);
  }

  function canonicalNavigation() {
    document.querySelectorAll(
      'a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label'
    ).forEach(label => {
      if (String(label.textContent || '').trim() !== 'Organiser') {
        label.textContent = 'Organiser';
      }
    });

    document.querySelectorAll('a[href$="reminders.html"], [data-page-link="reminders"]')
      .forEach(link => {
        ['aria-label', 'title'].forEach(attribute => {
          const value = String(link.getAttribute(attribute) || '');
          if (/reminder/i.test(value)) {
            link.setAttribute(attribute, value.replace(/reminders?/ig, 'Organiser'));
          }
        });
      });

    document.querySelectorAll('#v1118MobileNav, nav.v1118-mobile-nav')
      .forEach(nav => {
        if (!nav.classList.contains('app-tabs')) nav.remove();
      });
  }

  function canonicalBranding() {
    document.querySelectorAll('.calendar-header-branding .calendar-brand-copy')
      .forEach(node => node.remove());
  }

  function ensureAskWaffleComposerStyle() {
    if (document.getElementById('waffleFinalUiAskComposerStyle')) return;

    const style = document.createElement('style');
    style.id = 'waffleFinalUiAskComposerStyle';
    style.textContent = `
      /* The prompt strip was retired in V11.1.49. The original Ask Waffle card
         still declared five grid rows (header, prompts, thread, form, footer),
         which caused the form to occupy the old flexible thread row once the
         prompts node was removed. Four canonical rows restore the intended
         conversation/composer geometry. */
      #v11133AskWaffleModal .aw37-card {
        grid-template-rows: auto minmax(220px, 1fr) auto auto !important;
      }

      #v11133AskWaffleModal .aw37-form {
        min-height: 0 !important;
        height: auto !important;
        padding: 10px 14px !important;
        gap: 9px !important;
        align-items: center !important;
      }

      #v11133AskWaffleModal .aw37-form input {
        height: 44px !important;
        min-height: 44px !important;
        max-height: 44px !important;
        padding: 0 13px !important;
        line-height: 44px !important;
        align-self: center !important;
      }

      #v11133AskWaffleModal .aw37-form button {
        height: 44px !important;
        min-height: 44px !important;
        max-height: 44px !important;
        padding: 0 16px !important;
        align-self: center !important;
      }

      @media (max-width: 520px) {
        #v11133AskWaffleModal .aw37-card {
          grid-template-rows: auto minmax(180px, 1fr) auto auto !important;
        }

        #v11133AskWaffleModal .aw37-form {
          padding: 8px 10px !important;
          gap: 8px !important;
        }

        #v11133AskWaffleModal .aw37-form input,
        #v11133AskWaffleModal .aw37-form button {
          height: 42px !important;
          min-height: 42px !important;
          max-height: 42px !important;
        }

        #v11133AskWaffleModal .aw37-form input {
          padding: 0 12px !important;
          line-height: 42px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          padding: 0 13px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function canonicalAskWaffle() {
    const page = pageName();
    if (page !== 'calendar' && page !== 'directory') return;

    document.getElementById('v11133AskWaffleButton')?.remove();

    const launcher = document.getElementById('aw37launch');
    if (!launcher) return;

    launcher.classList.add('float', 'aw39-round-launch', 'waffle-final-ui-launcher');
    launcher.setAttribute('aria-label', 'Ask Waffle');
    launcher.setAttribute('title', 'Ask Waffle');

    if (launcher.parentElement !== document.body) {
      document.body.appendChild(launcher);
    }
  }

  function canonicalAskWaffleConversation() {
    /* Free-form Waffle AI no longer needs predefined prompt chips. Remove the
       entire strip rather than merely hiding it, so it cannot reserve height or
       flash during delayed legacy enhancement passes. */
    document.querySelectorAll('#v11133AskWaffleModal .aw37-prompts')
      .forEach(prompts => prompts.remove());

    ensureAskWaffleComposerStyle();
  }

  function canonicalCalendar() {
    if (pageName() !== 'calendar') return;

    const sink = compatibilitySink();
    [
      'at-home-list',
      'leaving-list',
      'upcoming-list',
      'full-dates-list',
      'today-meet-greet-list',
      'meet-greet-today-date'
    ].forEach(id => {
      const node = document.getElementById(id);
      if (node && !sink.contains(node)) sink.appendChild(node);
    });

    document.querySelectorAll(
      '#calendarTabPanel > .summary-dashboard, ' +
      '#calendarTabPanel > .meet-greet-dashboard, ' +
      '[data-mobile-dashboard-section="summary"], ' +
      '[data-mobile-dashboard-section="meet"]'
    ).forEach(panel => {
      if (!sink.contains(panel)) panel.remove();
    });
  }

  function ensureHistoricalIntakeNote() {
    if (pageName() !== 'directory') return;

    const actions = document.querySelector('.directory-header-actions');
    if (!actions) return;

    const canonicalText = 'Historical PDF Intake · view only';
    const canonicalTitle = 'Existing historical PDF Intake records remain view-only. Use Digital Intake for new or updated intake information.';

    let note = document.getElementById('v11123LegacyIntakeHistoryNote');
    if (!note) {
      note = document.createElement('span');
      note.id = 'v11123LegacyIntakeHistoryNote';
      note.className = 'directory-care-summary v11123-legacy-intake-history-note v11144-historical-intake-note';
      note.textContent = canonicalText;
      note.title = canonicalTitle;
      actions.insertBefore(note, actions.firstChild || null);
      return;
    }

    if (String(note.textContent || '').trim() !== canonicalText) {
      note.textContent = canonicalText;
    }
    if (note.title !== canonicalTitle) {
      note.title = canonicalTitle;
    }
  }

  function canonicalCare() {
    if (pageName() !== 'directory') return;

    const legacyGlobal = document.getElementById('openLegacyIntakeUploadBtn');
    if (legacyGlobal) moveToSink(legacyGlobal);

    document.querySelectorAll('[data-upload-legacy-intake], [data-reassign-legacy-intake]')
      .forEach(moveToSink);

    ensureHistoricalIntakeNote();
  }

  function canonicalOrganiser() {
    if (pageName() !== 'reminders') return;

    /* Do not place inline display rules on Sticky Notes. They remain an active
       Organiser feature. The shared first-paint CSS alone suppresses the old
       top-level Reminders DOM until #v11115OrganiserRoot mounts, after which
       Organiser owns visibility of its own tabs and panels. */
    const panel = document.getElementById('remindersTabPanel');
    if (!panel) return;

    if (panel.dataset.waffleFinalUiOwner !== 'organiser') {
      panel.dataset.waffleFinalUiOwner = 'organiser';
    }
  }

  function canonicalAudit() {
    if (pageName() !== 'audit') return;
    document.querySelectorAll('[data-v1115-recovery-panel]')
      .forEach(panel => panel.remove());
  }

  function apply() {
    if (!document.body) return;

    if (document.documentElement.getAttribute(CONTRACT_ATTR) !== VERSION) {
      document.documentElement.setAttribute(CONTRACT_ATTR, VERSION);
    }
    if (document.body.getAttribute(CONTRACT_ATTR) !== VERSION) {
      document.body.setAttribute(CONTRACT_ATTR, VERSION);
    }

    canonicalNavigation();
    canonicalBranding();
    canonicalAskWaffle();
    canonicalAskWaffleConversation();
    canonicalCalendar();
    canonicalCare();
    canonicalOrganiser();
    canonicalAudit();
  }

  function queueApply() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function nodeMayAffectContract(node) {
    if (!(node instanceof Element)) return false;
    return !!(node.matches?.(PROTECTED_SELECTOR) || node.querySelector?.(PROTECTED_SELECTOR));
  }

  function mutationMayAffectContract(mutation) {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;

    if (target && (target.matches?.(PROTECTED_SELECTOR) || target.closest?.(PROTECTED_SELECTOR))) {
      return true;
    }

    if (Array.from(mutation.addedNodes || []).some(nodeMayAffectContract)) return true;
    if (Array.from(mutation.removedNodes || []).some(nodeMayAffectContract)) return true;

    return false;
  }

  function wireObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      if (mutations.some(mutationMayAffectContract)) queueApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
  }

  function start() {
    apply();
    wireObserver();

    /* These bounded passes cover delayed historical enhancement scripts. New
       code should not depend on them; the mutation observer is the backstop. */
    [50, 150, 350, 800, 1600, 3200, 5600].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);

    window.WAFFLE_UI_CONTRACT = Object.freeze({
      version: VERSION,
      apply,
      page: pageName
    });

    window.dispatchEvent(new CustomEvent('waffle:ui-contract-ready', {
      detail: { version: VERSION, page: pageName() }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(function () {
  'use strict';
  window.WAFFLE_UI_CANONICAL = Object.freeze({
    build: '2026.08.27.04',
    module: 'waffle-ui.js',
    rollbackSources: ["waffle-v11.1.75.js", "waffle-v11.1.76.js", "waffle-v11.1.89.js", "waffle-ui-contract.js"]
  });
})();
