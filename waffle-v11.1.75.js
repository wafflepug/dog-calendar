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
