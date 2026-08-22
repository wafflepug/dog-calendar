/* ============================================================
   WAFFLE HOUSE V11.1.16 — CALENDAR NAV + BRAND HEADER POLISH
   ============================================================ */

(function () {
  'use strict';

  function pageName() {
    return String(document.body?.dataset?.wafflePage || 'calendar');
  }

  function ensureOrganiserLabel() {
    document.querySelectorAll('a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label')
      .forEach(label => { label.textContent = 'Organiser'; });
  }

  function ensureCalendarNavState() {
    if (pageName() !== 'calendar') return;

    const nav = document.querySelector('.app-tabs');
    if (!nav) return;

    nav.classList.add('v11116-calendar-nav');

    nav.querySelectorAll('[data-page-link]').forEach(link => {
      const active = link.dataset.pageLink === 'calendar';
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function makeLogoClickable() {
    document.querySelectorAll('.calendar-header-branding').forEach(header => {
      const logo = header.querySelector('.calendar-brand-logo');
      if (!logo) return;

      const existing = logo.closest('a.v11116-brand-home-link');
      if (existing) return;

      const link = document.createElement('a');
      link.href = 'index.html';
      link.className = 'v11116-brand-home-link';
      link.setAttribute('aria-label', 'Return to Calendar');
      link.title = 'Return to Calendar';

      logo.parentNode.insertBefore(link, logo);
      link.appendChild(logo);
    });
  }

  function polishBrandHeader() {
    document.querySelectorAll('.calendar-header-branding').forEach(header => {
      header.classList.add('v11116-branding');

      const copy = header.querySelector('.calendar-brand-copy');
      if (copy) copy.classList.add('v11116-brand-copy');

      const subtitle = header.querySelector('.calendar-brand-subtitle');
      if (subtitle && /premium dog boarding/i.test(subtitle.textContent || '')) {
        subtitle.textContent = 'Premium Dog Boarding';
      }
    });
  }

  function apply() {
    ensureOrganiserLabel();
    ensureCalendarNavState();
    makeLogoClickable();
    polishBrandHeader();
  }

  function start() {
    apply();

    // Bounded follow-up passes cover late-loaded header actions and patch layers
    // without introducing a persistent MutationObserver.
    [80, 250, 700, 1400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
