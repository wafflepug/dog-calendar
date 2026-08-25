/* ============================================================
   WAFFLE HOUSE V11.1.84 — MOBILE FULL-PAGE COLOUR THEMES
   ------------------------------------------------------------
   Extends Appearance & Colour beyond navigation chrome so each selected
   palette also themes the mobile page canvas, cards, controls and active
   states across Today, Calendar, Care, Organiser and Logs.

   Semantic colours remain authoritative for boarding dogs, capacity health,
   Meet & Greets, Potential Stays, warnings, success and destructive actions.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.84';
  const MOBILE_QUERY = '(max-width: 820px)';
  const META_COLOURS = Object.freeze({
    'waffle-purple': { light:'#6d28d9', dark:'#a855f7' },
    'coastal-blue': { light:'#0369a1', dark:'#0ea5e9' },
    'eucalyptus': { light:'#166534', dark:'#22c55e' },
    'sunset-coral': { light:'#be123c', dark:'#f43f5e' },
    'warm-honey': { light:'#b45309', dark:'#f59e0b' }
  });

  let observer = null;

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function colourStyle() {
    return String(
      document.documentElement.getAttribute('data-waffle-colour-style') ||
      document.body?.getAttribute('data-waffle-colour-style') ||
      'waffle-purple'
    );
  }

  function syncThemeColour() {
    if (!isMobile()) return;
    const palette = META_COLOURS[colourStyle()] || META_COLOURS['waffle-purple'];
    const value = document.body?.classList.contains('dark-theme') ? palette.dark : palette.light;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = value;
  }

  function ensureStyles() {
    if (document.getElementById('wh84FullPageColourThemeStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh84FullPageColourThemeStyle';
    style.textContent = `
      @media (max-width:820px) {
        body[data-waffle-colour-style] {
          --wh84-page:color-mix(in srgb,var(--wh75-accent) 6%,#f8fafc 94%);
          --wh84-surface:color-mix(in srgb,var(--wh75-accent) 3%,#ffffff 97%);
          --wh84-soft:color-mix(in srgb,var(--wh75-accent) 9%,#ffffff 91%);
          --wh84-soft-strong:color-mix(in srgb,var(--wh75-accent) 15%,#ffffff 85%);
          --wh84-border:color-mix(in srgb,var(--wh75-accent) 24%,#dbe3ea 76%);
          --wh84-border-strong:color-mix(in srgb,var(--wh75-accent) 44%,#cbd5e1 56%);
          --wh84-heading:var(--wh75-accent-ink);
          --wh84-shadow:color-mix(in srgb,var(--wh75-accent) 13%,transparent);
          --v10-primary:var(--wh75-accent-strong);
          --v10-primary-soft:var(--wh75-accent-soft);
          --v10-card:var(--wh84-surface);
          --v10-card-soft:var(--wh84-soft);
          --v10-border:var(--wh84-border);
          --v10-text:var(--wh75-text);
          --v10-muted:var(--wh75-muted);
          --wh65-surface:var(--wh84-surface);
          --wh65-soft:var(--wh84-soft);
          --wh65-soft2:var(--wh84-soft-strong);
          --wh65-line:var(--wh84-border);
          --wh65-text:var(--wh75-text);
          --wh65-muted:var(--wh75-muted);
          --wh65-accent:var(--wh75-accent);
          background:
            radial-gradient(circle at 92% 2%,color-mix(in srgb,var(--wh75-accent) 13%,transparent) 0,transparent 34%),
            linear-gradient(180deg,var(--wh84-page),color-mix(in srgb,var(--wh84-page) 72%,#ffffff 28%)) fixed!important;
        }

        body.dark-theme[data-waffle-colour-style] {
          --wh84-page:color-mix(in srgb,var(--wh75-accent) 8%,#0b1220 92%);
          --wh84-surface:color-mix(in srgb,var(--wh75-accent) 5%,#111b2d 95%);
          --wh84-soft:color-mix(in srgb,var(--wh75-accent) 10%,#17243a 90%);
          --wh84-soft-strong:color-mix(in srgb,var(--wh75-accent) 16%,#17243a 84%);
          --wh84-border:color-mix(in srgb,var(--wh75-accent) 24%,#334155 76%);
          --wh84-border-strong:color-mix(in srgb,var(--wh75-accent) 44%,#475569 56%);
          --wh84-heading:var(--wh75-accent-ink);
          --wh84-shadow:color-mix(in srgb,var(--wh75-accent) 18%,transparent);
          background:
            radial-gradient(circle at 92% 2%,color-mix(in srgb,var(--wh75-accent) 12%,transparent) 0,transparent 36%),
            linear-gradient(180deg,var(--wh84-page),#0b1220) fixed!important;
        }

        body[data-waffle-colour-style] > .container {
          background:color-mix(in srgb,var(--wh84-surface) 90%,transparent)!important;
          border-color:var(--wh84-border)!important;
          box-shadow:0 18px 48px var(--wh84-shadow)!important;
        }

        body[data-waffle-colour-style] .calendar-header-branding,
        body[data-waffle-colour-style] .v10-ops-heading,
        body[data-waffle-colour-style] .directory-dashboard-header,
        body[data-waffle-colour-style] .reminders-header,
        body[data-waffle-colour-style] .audit-header {
          border-color:var(--wh84-border)!important;
        }

        body[data-waffle-colour-style] .v10-ops-heading,
        body[data-waffle-colour-style] .directory-dashboard-header,
        body[data-waffle-colour-style] .reminders-header,
        body[data-waffle-colour-style] .audit-header {
          border-radius:16px!important;
          background:linear-gradient(135deg,var(--wh84-soft-strong),var(--wh84-surface))!important;
          box-shadow:inset 4px 0 0 var(--wh75-accent),0 8px 22px var(--wh84-shadow)!important;
        }

        body[data-waffle-colour-style] .v10-stat-card,
        body[data-waffle-colour-style] .v10-ops-card,
        body[data-waffle-colour-style] .summary-card,
        body[data-waffle-colour-style] .meet-greet-dashboard,
        body[data-waffle-colour-style] .directory-dashboard,
        body[data-waffle-colour-style] .directory-profile-content,
        body[data-waffle-colour-style] .directory-guest-tile-open,
        body[data-waffle-colour-style] .directory-card,
        body[data-waffle-colour-style] .belongings-pet-card,
        body[data-waffle-colour-style] .v1082-past-card,
        body[data-waffle-colour-style] .reminder-composer,
        body[data-waffle-colour-style] .reminders-toolbar,
        body[data-waffle-colour-style] .reminders-notes-grid > *,
        body[data-waffle-colour-style] .audit-toolbar,
        body[data-waffle-colour-style] .audit-log-container > * {
          border-color:var(--wh84-border)!important;
          background:linear-gradient(180deg,var(--wh84-surface),var(--wh84-soft))!important;
          box-shadow:0 8px 22px var(--wh84-shadow)!important;
        }

        body[data-waffle-colour-style] .v10-stat-card {
          box-shadow:inset 0 3px 0 color-mix(in srgb,var(--wh75-accent) 72%,transparent),0 8px 22px var(--wh84-shadow)!important;
        }

        body[data-waffle-colour-style] .v10-stat-icon,
        body[data-waffle-colour-style] .directory-photo-shell,
        body[data-waffle-colour-style] .wh75-nav-icon {
          border-color:var(--wh84-border-strong)!important;
          background:var(--wh84-soft-strong)!important;
        }

        body[data-waffle-colour-style] .v10-card-kicker,
        body[data-waffle-colour-style] .v10-eyebrow,
        body[data-waffle-colour-style] .reminder-composer-kicker,
        body[data-waffle-colour-style] .guest-detail-edit-eyebrow,
        body[data-waffle-colour-style] .directory-dashboard-subtitle + *,
        body[data-waffle-colour-style] .v10-text-action {
          color:var(--wh75-accent-strong)!important;
        }

        body[data-waffle-colour-style] .v10-text-action,
        body[data-waffle-colour-style] .belongings-refresh-btn,
        body[data-waffle-colour-style] .reminders-add-btn,
        body[data-waffle-colour-style] .reminder-save-btn,
        body[data-waffle-colour-style] .audit-refresh-btn {
          border-color:var(--wh75-accent)!important;
          background:var(--wh75-accent)!important;
          color:#fff!important;
          box-shadow:0 6px 16px var(--wh84-shadow)!important;
        }

        body[data-waffle-colour-style] .search-input,
        body[data-waffle-colour-style] .guest-directory-search,
        body[data-waffle-colour-style] .audit-search,
        body[data-waffle-colour-style] .audit-filter,
        body[data-waffle-colour-style] .reminders-filter,
        body[data-waffle-colour-style] .reminder-form-field input,
        body[data-waffle-colour-style] .reminder-form-field textarea,
        body[data-waffle-colour-style] .guest-detail-edit-control {
          border-color:var(--wh84-border)!important;
          background:var(--wh84-surface)!important;
          color:var(--wh75-text)!important;
        }

        body[data-waffle-colour-style] .search-input:focus,
        body[data-waffle-colour-style] .guest-directory-search:focus,
        body[data-waffle-colour-style] .audit-search:focus,
        body[data-waffle-colour-style] .audit-filter:focus,
        body[data-waffle-colour-style] .reminders-filter:focus,
        body[data-waffle-colour-style] .reminder-form-field input:focus,
        body[data-waffle-colour-style] .reminder-form-field textarea:focus,
        body[data-waffle-colour-style] .guest-detail-edit-control:focus {
          outline:0!important;
          border-color:var(--wh75-accent)!important;
          box-shadow:0 0 0 3px var(--wh75-ring)!important;
        }

        body[data-waffle-colour-style] .directory-main-profile-tab.is-active,
        body[data-waffle-colour-style] .v10-reminder-filter.is-active,
        body[data-waffle-colour-style] .v101-audit-filter-chip.is-active,
        body[data-waffle-colour-style] .wh69-view-btn.is-active {
          border-color:var(--wh75-accent)!important;
          background:var(--wh75-accent-soft)!important;
          color:var(--wh75-accent-ink)!important;
          box-shadow:0 0 0 2px var(--wh75-ring)!important;
        }

        body[data-waffle-colour-style] .directory-main-profile-tabs,
        body[data-waffle-colour-style] .v10-reminder-filters,
        body[data-waffle-colour-style] .v101-audit-filter-chips,
        body[data-waffle-colour-style] .wh69-view-switch {
          border-color:var(--wh84-border)!important;
          background:var(--wh84-soft)!important;
        }

        body[data-waffle-colour-style] .directory-main-profile-tab:not(.is-active),
        body[data-waffle-colour-style] .v10-reminder-filter:not(.is-active),
        body[data-waffle-colour-style] .v101-audit-filter-chip:not(.is-active),
        body[data-waffle-colour-style] .wh69-view-btn:not(.is-active) {
          color:var(--wh75-muted)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-calendar {
          border-color:var(--wh84-border)!important;
          background:var(--wh84-surface)!important;
          box-shadow:0 12px 32px var(--wh84-shadow)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-toolbar {
          background:linear-gradient(135deg,var(--wh84-soft-strong),var(--wh84-surface))!important;
          border-color:var(--wh84-border)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-legend,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-weekdays,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-date.is-other,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh69-view-switch {
          background:var(--wh84-soft)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-date,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-timeline,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-meets {
          border-color:var(--wh84-border)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-date.is-today {
          background:color-mix(in srgb,var(--wh75-accent) 10%,var(--wh84-surface))!important;
          box-shadow:inset 0 -3px 0 var(--wh75-accent)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-btn,
        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-sync {
          border-color:var(--wh84-border-strong)!important;
          background:var(--wh84-soft-strong)!important;
          color:var(--wh75-text)!important;
        }

        body[data-waffle-page="calendar"][data-waffle-colour-style] .wh65-sync {
          color:var(--wh75-accent-ink)!important;
        }

        body[data-waffle-page="directory"][data-waffle-colour-style] #directory-care-summary:not(.has-alerts),
        body[data-waffle-page="directory"][data-waffle-colour-style] #v11123LegacyIntakeHistoryNote,
        body[data-waffle-page="directory"][data-waffle-colour-style] .v11144-historical-intake-note {
          border-color:var(--wh84-border)!important;
          background:var(--wh84-soft)!important;
          color:var(--wh75-muted)!important;
        }

        body[data-waffle-page="reminders"][data-waffle-colour-style] #v11115OrganiserRoot {
          --v10-card:var(--wh84-surface);
          --v10-card-soft:var(--wh84-soft);
          --v10-border:var(--wh84-border);
          --v10-primary:var(--wh75-accent-strong);
          color:var(--wh75-text)!important;
        }

        body[data-waffle-page="reminders"][data-waffle-colour-style] #v11115OrganiserRoot > * {
          border-color:var(--wh84-border)!important;
        }

        body[data-waffle-page="audit"][data-waffle-colour-style] #auditLogContainer {
          border-color:var(--wh84-border)!important;
        }

        body[data-waffle-colour-style] #wh75SettingsPanel,
        body[data-waffle-colour-style] #wh75MobileDrawer,
        body[data-waffle-colour-style] #wh75MobileBottomNav {
          border-color:var(--wh84-border)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function reconcile() {
    ensureStyles();
    syncThemeColour();
  }

  function start() {
    reconcile();
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(syncThemeColour);
      observer.observe(document.documentElement, {
        attributes:true,
        attributeFilter:['data-waffle-colour-style']
      });
      if (document.body) {
        observer.observe(document.body, {
          attributes:true,
          attributeFilter:['class','data-waffle-colour-style']
        });
      }
    }
    window.addEventListener('resize', syncThemeColour);
    window.addEventListener('orientationchange', syncThemeColour);
    window.v11184FullPageColourThemesVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
