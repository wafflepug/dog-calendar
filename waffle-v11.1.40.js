/* ============================================================
   WAFFLE HOUSE V11.1.40 — ASK WAFFLE LAYOUT HARDENING
   - Stack Quick Action above Ask Waffle.
   - Remove the stray Request From selector from Ask Waffle.
   - Keep the assistant inside narrow Fold/mobile viewports.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.40';
  const TARGET_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function ensureStyle() {
    if (document.getElementById('aw40-layout-style')) return;

    const style = document.createElement('style');
    style.id = 'aw40-layout-style';
    style.textContent = `
      /* Keep the two global floating actions in a predictable vertical stack. */
      body[data-waffle-page="calendar"] .v10-quick-add-button,
      body[data-waffle-page="directory"] .v10-quick-add-button {
        right: 18px !important;
        bottom: 96px !important;
      }

      /* Defensive selectors for any request-source block injected into Waffle. */
      #v11133AskWaffleModal .request-from,
      #v11133AskWaffleModal .request-from-block,
      #v11133AskWaffleModal .request-source,
      #v11133AskWaffleModal .request-source-block,
      #v11133AskWaffleModal [data-request-from],
      #v11133AskWaffleModal [data-request-source] {
        display: none !important;
      }

      /* Do not let 100vw + modal padding exceed the usable viewport. */
      #v11133AskWaffleModal {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100vw !important;
        overflow: hidden !important;
      }

      #v11133AskWaffleModal .aw37-card {
        box-sizing: border-box !important;
        width: min(720px, 100%) !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }

      #v11133AskWaffleModal .aw37-head,
      #v11133AskWaffleModal .aw37-brand,
      #v11133AskWaffleModal .aw37-brand > div,
      #v11133AskWaffleModal .aw37-prompts,
      #v11133AskWaffleModal .aw37-thread,
      #v11133AskWaffleModal .aw37-form,
      #v11133AskWaffleModal .aw37-foot {
        box-sizing: border-box !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      #v11133AskWaffleModal .aw37-brand > div {
        overflow: hidden;
      }

      #v11133AskWaffleModal .aw37-brand p,
      #v11133AskWaffleModal .aw37-brand h3 {
        overflow-wrap: anywhere;
      }

      #v11133AskWaffleModal .aw37-form {
        grid-template-columns: minmax(0, 1fr) auto !important;
      }

      #v11133AskWaffleModal .aw37-form input {
        box-sizing: border-box !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      @media (max-width: 768px) {
        body[data-waffle-page="calendar"] .v10-quick-add-button,
        body[data-waffle-page="directory"] .v10-quick-add-button {
          right: 12px !important;
          bottom: calc(160px + env(safe-area-inset-bottom)) !important;
        }

        #v11133AskWaffleModal {
          padding: 8px !important;
        }

        #v11133AskWaffleModal .aw37-card {
          width: 100% !important;
          max-height: calc(100dvh - 16px) !important;
        }
      }

      /* Fold-class narrow cover screens, including Galaxy Z Fold portrait. */
      @media (max-width: 420px) {
        #v11133AskWaffleModal {
          padding: 6px !important;
          place-items: center !important;
        }

        #v11133AskWaffleModal .aw37-card {
          width: 100% !important;
          max-height: calc(100dvh - 12px) !important;
          border-radius: 18px !important;
        }

        #v11133AskWaffleModal .aw37-head {
          gap: 8px !important;
          padding: 12px !important;
        }

        #v11133AskWaffleModal .aw37-brand {
          gap: 8px !important;
          flex: 1 1 auto !important;
        }

        #v11133AskWaffleModal .aw37-brand > img {
          width: 44px !important;
          height: 44px !important;
          flex: 0 0 44px !important;
        }

        #v11133AskWaffleModal .aw37-brand small {
          font-size: 8px !important;
          letter-spacing: .07em !important;
        }

        #v11133AskWaffleModal .aw37-brand h3 {
          font-size: 18px !important;
          line-height: 1.1 !important;
        }

        #v11133AskWaffleModal .aw37-brand p {
          font-size: 9px !important;
          line-height: 1.3 !important;
        }

        #v11133AskWaffleModal .aw37-close {
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
        }

        #v11133AskWaffleModal .aw37-prompts {
          gap: 6px !important;
          padding: 8px 12px !important;
          overscroll-behavior-inline: contain;
        }

        #v11133AskWaffleModal .aw37-prompts button {
          padding: 6px 9px !important;
          font-size: 8.5px !important;
        }

        #v11133AskWaffleModal .aw37-thread {
          gap: 10px !important;
          padding: 12px !important;
        }

        #v11133AskWaffleModal .aw37-msg.bot {
          gap: 6px !important;
        }

        #v11133AskWaffleModal .aw37-face {
          width: 44px !important;
          height: 44px !important;
        }

        #v11133AskWaffleModal .aw37-face.latest {
          width: 50px !important;
          height: 50px !important;
        }

        #v11133AskWaffleModal .aw37-bubble {
          max-width: calc(100% - 56px) !important;
          padding: 10px 11px !important;
          font-size: 10px !important;
        }

        #v11133AskWaffleModal .aw37-form {
          gap: 6px !important;
          padding: 10px 12px !important;
        }

        #v11133AskWaffleModal .aw37-form input {
          min-height: 44px !important;
          padding: 9px 10px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          min-width: 60px !important;
          padding: 0 12px !important;
        }

        #v11133AskWaffleModal .aw37-foot {
          padding: 0 12px 9px !important;
        }
      }

      @media (max-width: 360px) {
        #v11133AskWaffleModal {
          padding: 4px !important;
        }

        #v11133AskWaffleModal .aw37-card {
          max-height: calc(100dvh - 8px) !important;
          border-radius: 16px !important;
        }

        #v11133AskWaffleModal .aw37-head {
          padding: 10px !important;
        }

        #v11133AskWaffleModal .aw37-brand > img {
          width: 40px !important;
          height: 40px !important;
          flex-basis: 40px !important;
        }

        #v11133AskWaffleModal .aw37-brand h3 {
          font-size: 17px !important;
        }

        #v11133AskWaffleModal .aw37-brand p {
          font-size: 8.5px !important;
        }

        #v11133AskWaffleModal .aw37-prompts {
          padding-inline: 10px !important;
        }

        #v11133AskWaffleModal .aw37-thread {
          padding: 10px !important;
        }

        #v11133AskWaffleModal .aw37-face {
          width: 40px !important;
          height: 40px !important;
        }

        #v11133AskWaffleModal .aw37-face.latest {
          width: 46px !important;
          height: 46px !important;
        }

        #v11133AskWaffleModal .aw37-bubble {
          max-width: calc(100% - 50px) !important;
        }

        #v11133AskWaffleModal .aw37-form {
          padding: 8px 10px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          min-width: 58px !important;
          padding-inline: 9px !important;
        }

        #v11133AskWaffleModal .aw37-foot {
          padding-inline: 10px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanText(element) {
    return String(element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function providerCount(text) {
    return ['madpaw', 'pawshake', 'facebook', 'other']
      .reduce((count, provider) => count + (text.includes(provider) ? 1 : 0), 0);
  }

  function removeRequestFromBlock() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return false;

    /* Prefer the smallest descendant that contains the heading plus provider
       choices. This avoids touching similarly named controls elsewhere. */
    const directCandidates = Array.from(modal.querySelectorAll('*'))
      .filter(element => {
        const text = cleanText(element);
        return text.includes('request from') && providerCount(text) >= 2;
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    const direct = directCandidates[0];
    if (direct && direct !== modal && !direct.classList.contains('aw37-card')) {
      direct.remove();
      return true;
    }

    /* Fallback for source choices represented mainly by images/ARIA labels. */
    const heading = Array.from(
      modal.querySelectorAll('h1,h2,h3,h4,h5,h6,label,strong,p,span,div')
    ).find(element => cleanText(element) === 'request from');

    if (!heading) return false;

    let candidate = heading.parentElement;
    for (let depth = 0; candidate && depth < 5; depth += 1) {
      if (candidate === modal || candidate.classList.contains('aw37-card')) break;

      const text = cleanText(candidate);
      const controls = candidate.querySelectorAll(
        'button,label,input,[role="radio"],[role="button"]'
      ).length;

      if (providerCount(text) >= 2 || controls >= 3) {
        candidate.remove();
        return true;
      }

      candidate = candidate.parentElement;
    }

    return false;
  }

  function wireModalObserver() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal || modal.dataset.aw40Observed === 'true') return;

    modal.dataset.aw40Observed = 'true';
    const observer = new MutationObserver(() => removeRequestFromBlock());
    observer.observe(modal, { childList: true, subtree: true });
  }

  function apply() {
    if (!TARGET_PAGES.has(pageName())) return;
    ensureStyle();
    removeRequestFromBlock();
    wireModalObserver();
  }

  function start() {
    apply();
    [80, 220, 500, 1000, 2200, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => window.setTimeout(apply, 80));
    window.v11140AskWaffleLayoutVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
