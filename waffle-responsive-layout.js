/* ============================================================
   WAFFLE HOUSE — RESPONSIVE LAYOUT ALIGNMENT
   ------------------------------------------------------------
   Keeps page content aligned with the canonical mobile-shell breakpoint.
   The shell switches at 820/821px, while a few historical Care rules still
   switch at 768px. This module closes that 769–820px gap without hiding
   overflow, so tablet portrait layouts remain genuinely viewport-safe.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_RESPONSIVE_LAYOUT) return;

  const VERSION = '1.0.0';
  const STYLE_ID = 'waffleResponsiveLayoutStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width:769px) and (max-width:820px) {
        body[data-waffle-page="directory"] {
          margin:5px!important;
        }

        body[data-waffle-page="directory"] > .container {
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          box-sizing:border-box!important;
          padding:10px!important;
          border-radius:6px!important;
        }

        body[data-waffle-page="directory"] .directory-dashboard-fused,
        body[data-waffle-page="directory"] .directory-dashboard-header,
        body[data-waffle-page="directory"] .directory-header-actions,
        body[data-waffle-page="directory"] .guest-directory-toolbar,
        body[data-waffle-page="directory"] .v1082-stay-tabs,
        body[data-waffle-page="directory"] .v1082-stay-panels,
        body[data-waffle-page="directory"] .v1082-stay-panel,
        body[data-waffle-page="directory"] .directory-grid {
          min-width:0!important;
          max-width:100%!important;
          box-sizing:border-box!important;
        }

        body[data-waffle-page="directory"] .directory-dashboard-header,
        body[data-waffle-page="directory"] .directory-header-actions {
          flex-wrap:wrap!important;
        }

        body[data-waffle-page="directory"] .directory-dashboard-header > *,
        body[data-waffle-page="directory"] .directory-header-actions > *,
        body[data-waffle-page="directory"] .guest-directory-toolbar > * {
          min-width:0!important;
          max-width:100%!important;
          box-sizing:border-box!important;
        }

        body[data-waffle-page="directory"] .directory-grid {
          grid-template-columns:minmax(0,1fr)!important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  installStyle();

  window.WAFFLE_RESPONSIVE_LAYOUT = Object.freeze({
    version: VERSION,
    breakpoint: '769px-820px'
  });
})();
