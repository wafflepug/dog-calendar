/* ============================================================
   WAFFLE HOUSE V11.1.74 — THEME AVATAR TOGGLE
   Replaces the historical sun/moon emoji with Waffle avatars while preserving
   the existing theme toggle behaviour and accessible button labels.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.74';
  const LIGHT_AVATAR = 'theme-light-mode.webp?v=11.1.74';
  const DARK_AVATAR = 'theme-dark-mode.webp?v=11.1.74';
  let observer = null;
  let frame = 0;

  function ensureStyle() {
    if (document.getElementById('v11174ThemeAvatarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11174ThemeAvatarStyle';
    style.textContent = `
      #themeToggle .theme-toggle-icon.wh74-theme-avatar {
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        width:30px !important;
        height:30px !important;
        min-width:30px !important;
        flex:0 0 30px !important;
        overflow:hidden !important;
        border-radius:50% !important;
        font-size:0 !important;
        line-height:1 !important;
        background:transparent !important;
      }
      #themeToggle .theme-toggle-icon.wh74-theme-avatar > img {
        display:block !important;
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
        object-position:center !important;
        border-radius:50% !important;
      }
      @media (max-width:768px) {
        #themeToggle .theme-toggle-icon.wh74-theme-avatar {
          width:32px !important;
          height:32px !important;
          min-width:32px !important;
          flex-basis:32px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncThemeAvatar() {
    frame = 0;
    ensureStyle();
    const button = document.getElementById('themeToggle');
    const icon = button?.querySelector('.theme-toggle-icon');
    if (!button || !icon) return;

    const isDark = document.body.classList.contains('dark-theme');
    // The icon represents the action the button will perform next.
    const targetTheme = isDark ? 'light' : 'dark';
    const src = targetTheme === 'light' ? LIGHT_AVATAR : DARK_AVATAR;
    const existing = icon.querySelector('img[data-wh74-theme-avatar]');

    icon.classList.add('wh74-theme-avatar');
    if (!existing || existing.dataset.wh74ThemeAvatar !== targetTheme) {
      icon.textContent = '';
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.decoding = 'async';
      image.draggable = false;
      image.dataset.wh74ThemeAvatar = targetTheme;
      icon.appendChild(image);
    }

    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    button.dataset.wh74ThemeAvatar = targetTheme;
  }

  function scheduleSync() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncThemeAvatar);
  }

  function wireObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        if (mutation.type === 'attributes' && mutation.target === document.body && mutation.attributeName === 'class') return true;
        return Array.from(mutation.addedNodes || []).some(node =>
          node instanceof Element && (node.id === 'themeToggle' || !!node.querySelector?.('#themeToggle'))
        );
      });
      if (relevant) scheduleSync();
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function start() {
    ensureStyle();
    syncThemeAvatar();
    wireObserver();
    document.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('#themeToggle')) {
        setTimeout(syncThemeAvatar, 0);
      }
    }, true);
    [50, 150, 400, 900, 1800, 3200].forEach(delay => setTimeout(syncThemeAvatar, delay));
    window.addEventListener('pageshow', syncThemeAvatar);
    window.addEventListener('focus', syncThemeAvatar);
    window.v11174ThemeAvatarVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
