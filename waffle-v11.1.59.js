/* ============================================================
   WAFFLE HOUSE V11.1.59 — DESKTOP CARE TAB AUTHORITY
   ============================================================
   Care historically accumulated three different tab routers:
   - Profile / Belongings from the base directory layer;
   - Media / Master from V11.0;
   - History from later profile enhancements.

   Mobile currently works and is intentionally left untouched. On desktop this
   layer becomes the single click authority at window capture phase, before the
   historical document/grid delegates can compete with one another.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.59';
  const KEYS = ['profile', 'belongings', 'media', 'history', 'master'];
  let lastSelection = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isDesktopCare() {
    return pageName() === 'directory' &&
      !!window.matchMedia &&
      window.matchMedia('(min-width: 769px)').matches;
  }

  function normaliseKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text.includes('belong')) return 'belongings';
    if (text.includes('media')) return 'media';
    if (text.includes('history')) return 'history';
    if (text.includes('master')) return 'master';
    if (text.includes('profile')) return 'profile';
    return '';
  }

  function tabKey(button) {
    if (!button) return '';
    return normaliseKey(
      button.dataset?.directoryMainTab ||
      button.dataset?.v110Tab ||
      button.dataset?.profileTab ||
      button.dataset?.tab ||
      [
        button.id,
        button.className,
        button.getAttribute?.('aria-controls'),
        button.getAttribute?.('title'),
        button.textContent
      ].join(' ')
    );
  }

  function panelKey(panel) {
    if (!panel) return '';
    return normaliseKey(
      panel.dataset?.directoryMainPanel ||
      panel.dataset?.v110Panel ||
      panel.dataset?.profilePanel ||
      panel.dataset?.panel ||
      [
        panel.id,
        panel.className,
        panel.getAttribute?.('aria-labelledby')
      ].join(' ')
    );
  }

  function cardFor(button) {
    return button?.closest('.directory-card') ||
      document.querySelector('.directory-card.is-profile-active') ||
      null;
  }

  function profileContent(card) {
    return card?.querySelector('.directory-profile-content') || card || null;
  }

  function directPanelForButton(card, button) {
    const controls = String(button?.getAttribute?.('aria-controls') || '').trim();
    if (controls) {
      const candidate = document.getElementById(controls);
      if (candidate && card?.contains(candidate)) return candidate;
    }

    if (button?.id) {
      const escaped = window.CSS?.escape ? CSS.escape(button.id) : button.id.replace(/"/g, '\\"');
      const labelled = card?.querySelector(`[aria-labelledby="${escaped}"]`);
      if (labelled) return labelled;
    }

    return null;
  }

  function findPanel(card, key, button) {
    if (!card || !KEYS.includes(key)) return null;

    const direct = directPanelForButton(card, button);
    if (direct) return direct;

    const selectors = {
      profile: [
        '[data-directory-main-panel="profile"]',
        '[data-profile-panel="profile"]'
      ],
      belongings: [
        '[data-directory-main-panel="belongings"]',
        '[data-profile-panel="belongings"]'
      ],
      media: [
        '[data-v110-panel="media"]',
        '[data-directory-main-panel="media"]',
        '[data-profile-panel="media"]'
      ],
      history: [
        '[data-directory-main-panel="history"]',
        '[data-v110-panel="history"]',
        '[data-profile-panel="history"]',
        '[data-history-panel]',
        '[data-v1088-history-panel]',
        '[data-v111-history-panel]',
        '.directory-history-panel',
        '.v1088-history-panel',
        '.v111-history-panel'
      ],
      master: [
        '[data-v110-panel="master"]',
        '[data-directory-main-panel="master"]',
        '[data-profile-panel="master"]'
      ]
    };

    for (const selector of selectors[key] || []) {
      const found = card.querySelector(selector);
      if (found) return found;
    }

    return Array.from(card.querySelectorAll('.directory-main-profile-panel,[role="tabpanel"]'))
      .find(panel => panelKey(panel) === key) || null;
  }

  function allPanels(card) {
    const result = new Set();
    card?.querySelectorAll('.directory-main-profile-panel,[role="tabpanel"]').forEach(panel => {
      if (KEYS.includes(panelKey(panel))) result.add(panel);
    });
    return Array.from(result);
  }

  function setSelectedState(card, key, preferredPanel) {
    if (!card || !KEYS.includes(key)) return false;

    const target = preferredPanel || findPanel(card, key, null);

    card.querySelectorAll('.directory-main-profile-tab').forEach(button => {
      const active = tabKey(button) === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
      if (active) button.dataset.v11159Selected = 'true';
      else delete button.dataset.v11159Selected;
    });

    allPanels(card).forEach(panel => {
      const active = panel === target || (!target && panelKey(panel) === key);
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    if (target) {
      target.hidden = false;
      target.classList.add('is-active');
      target.setAttribute('aria-hidden', 'false');
    }

    card.dataset.v11159ActiveTab = key;
    return !!target;
  }

  function callGlobal(name, args) {
    try {
      const fn = window[name];
      if (typeof fn === 'function') {
        fn.apply(window, args || []);
        return true;
      }
    } catch (error) {
      console.warn(`Care ${name} fallback failed:`, error);
    }
    return false;
  }

  function builtInRoute(card, key) {
    let called = callGlobal('switchDirectoryProfileMainTab', [card, key]);

    if (!called) {
      try {
        if (typeof switchDirectoryProfileMainTab === 'function') {
          switchDirectoryProfileMainTab(card, key);
          called = true;
        }
      } catch (_) {}
    }

    const detail = card.querySelector(`[data-directory-detail="${key}"]`);
    if (detail && detail.dataset.detailLoaded !== 'true') {
      const loader = key === 'profile'
        ? 'loadDirectoryProfileDetail'
        : 'loadDirectoryBelongingsDetail';
      if (!callGlobal(loader, [card, detail])) {
        try {
          if (key === 'profile' && typeof loadDirectoryProfileDetail === 'function') {
            Promise.resolve(loadDirectoryProfileDetail(card, detail)).catch(() => {});
          } else if (key === 'belongings' && typeof loadDirectoryBelongingsDetail === 'function') {
            Promise.resolve(loadDirectoryBelongingsDetail(card, detail)).catch(() => {});
          }
        } catch (_) {}
      }
    }

    return called;
  }

  function v110Route(card, key) {
    if (callGlobal('v110OpenCustomPanel', [card, key])) return true;
    try {
      if (typeof v110OpenCustomPanel === 'function') {
        v110OpenCustomPanel(card, key);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function parseHistory(card) {
    let rows = [];
    const raw = String(card?.dataset?.v1088AllStays || '').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) rows = parsed;
      } catch (_) {}
    }

    const current = {
      stayKey: String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || ''),
      startDate: String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || ''),
      endDate: String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || ''),
      ownerName: String(card?.dataset?.v1088OwnerName || ''),
      phone: String(card?.dataset?.v1088Phone || ''),
      notes: String(card?.dataset?.v1088Notes || '')
    };

    if (current.startDate && !rows.some(row =>
      String(row?.startDate || '') === current.startDate &&
      String(row?.endDate || row?.startDate || '') === (current.endDate || current.startDate)
    )) rows.unshift(current);

    const seen = new Set();
    return rows.filter(row => {
      const id = [row?.stayKey, row?.startDate, row?.endDate].join('|');
      if (!row || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).sort((a, b) =>
      String(b?.endDate || b?.startDate || '').localeCompare(String(a?.endDate || a?.startDate || ''))
    );
  }

  function shortDate(value) {
    const raw = String(value || '').slice(0, 10);
    if (!raw) return 'Date not recorded';
    const parts = raw.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return raw;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureHistoryFallbackPanel(card, button) {
    let panel = findPanel(card, 'history', button);
    if (panel) return panel;

    const host = profileContent(card);
    if (!host) return null;

    panel = document.createElement('section');
    panel.className = 'directory-main-profile-panel v11159-history-panel';
    panel.dataset.directoryMainPanel = 'history';
    panel.dataset.v11159HistoryPanel = 'true';
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    host.appendChild(panel);
    return panel;
  }

  function renderHistoryFallback(card, panel) {
    if (!panel) return;

    /* Preserve any existing specialised History implementation. Only fill an
       empty/new panel when no historical layer supplied content. */
    const meaningful = Array.from(panel.children).some(child =>
      !child.matches?.('.v110-panel-loading,.directory-lazy-placeholder') &&
      String(child.textContent || '').trim().length > 8
    );
    if (meaningful && panel.dataset.v11159HistoryPanel !== 'true') return;

    const rows = parseHistory(card);
    const dogName = String(card?.dataset?.directoryDogName || card?.dataset?.dogName || 'Dog').trim();

    panel.innerHTML = `
      <section class="v11159-history-shell">
        <div class="v11159-history-heading">
          <div><small>STAY HISTORY</small><h4>🕘 ${escapeHtml(dogName)}'s stays</h4></div>
          <span>${rows.length}</span>
        </div>
        ${rows.length ? `<div class="v11159-history-list">${rows.map((row, index) => `
          <article class="v11159-history-row">
            <span class="v11159-history-index">${index + 1}</span>
            <div><strong>${escapeHtml(shortDate(row.startDate))} – ${escapeHtml(shortDate(row.endDate || row.startDate))}</strong>${row.notes ? `<small>${escapeHtml(row.notes)}</small>` : '<small>Boarding stay</small>'}</div>
          </article>`).join('')}</div>` : '<div class="v11159-history-empty">No previous stay history is available for this profile yet.</div>'}
      </section>`;
  }

  function historyRoute(card, button) {
    const panel = ensureHistoryFallbackPanel(card, button);

    /* If a specialised historical implementation exposes a clear public entry
       point, let it populate first. These calls are deliberately narrow rather
       than invoking arbitrary functions discovered on window. */
    const candidates = [
      'openDirectoryHistoryPanel',
      'loadDirectoryHistory',
      'v1088OpenHistoryPanel',
      'v110OpenHistoryPanel',
      'v111OpenHistoryPanel'
    ];
    for (const name of candidates) {
      if (callGlobal(name, [card, panel])) break;
    }

    renderHistoryFallback(card, panel);
    return panel;
  }

  function route(card, key, button) {
    if (!card || !KEYS.includes(key)) return;

    let target = null;
    if (key === 'profile' || key === 'belongings') {
      builtInRoute(card, key);
      target = findPanel(card, key, button);
    } else if (key === 'media' || key === 'master') {
      v110Route(card, key);
      target = findPanel(card, key, button);
    } else if (key === 'history') {
      target = historyRoute(card, button);
    }

    setSelectedState(card, key, target);
    lastSelection = { card, key, button, at: Date.now() };

    /* Async profile/media loaders mutate the card after the initial click.
       Reassert only the chosen visibility state; do not rebuild any content. */
    [0, 50, 160, 420].forEach(delay => {
      window.setTimeout(() => {
        if (!lastSelection || lastSelection.card !== card || lastSelection.key !== key) return;
        if (!card.isConnected || !isDesktopCare()) return;
        setSelectedState(card, key, findPanel(card, key, button));
      }, delay);
    });
  }

  function handleClick(event) {
    if (!isDesktopCare()) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('.directory-main-profile-tab');
    if (!button) return;

    const key = tabKey(button);
    if (!KEYS.includes(key)) return;

    const card = cardFor(button);
    if (!card) return;

    /* This is intentionally authoritative. Window capture runs before the
       historical document/grid handlers, preventing their incompatible tab
       assumptions from racing after the correct panel has been selected. */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    route(card, key, button);
  }

  function ensureStyle() {
    if (document.getElementById('v11159CareDesktopStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11159CareDesktopStyle';
    style.textContent = `
      @media (min-width:769px) {
        body[data-waffle-page="directory"] .directory-main-profile-tabs {
          position:relative!important;
          z-index:2147480000!important;
          pointer-events:auto!important;
        }
        body[data-waffle-page="directory"] .directory-main-profile-tab {
          position:relative!important;
          z-index:2147480001!important;
          pointer-events:auto!important;
          cursor:pointer!important;
        }
        body[data-waffle-page="directory"] .directory-main-profile-panel[hidden] {
          display:none!important;
        }
        body[data-waffle-page="directory"] .directory-main-profile-panel.is-active:not([hidden]) {
          display:block;
        }
        .v11159-history-shell { display:grid;gap:14px;padding:4px 0 14px; }
        .v11159-history-heading { display:flex;align-items:flex-end;justify-content:space-between;gap:12px; }
        .v11159-history-heading small { display:block;font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--wh-accent,#0f6292); }
        .v11159-history-heading h4 { margin:2px 0 0;font-size:16px;color:var(--wh-text,#111827); }
        .v11159-history-heading>span { min-width:28px;height:28px;display:grid;place-items:center;border-radius:999px;background:var(--wh-surface-soft,#eef3f8);font-size:10px;font-weight:900; }
        .v11159-history-list { display:grid;gap:8px; }
        .v11159-history-row { display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--wh-border,#d9e2ec);border-radius:12px;background:var(--wh-surface-soft,#f8fafc); }
        .v11159-history-index { width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:var(--wh-surface,#fff);font-size:9px;font-weight:900; }
        .v11159-history-row strong,.v11159-history-row small { display:block; }
        .v11159-history-row strong { font-size:11px;color:var(--wh-text,#111827); }
        .v11159-history-row small { margin-top:2px;font-size:9px;color:var(--wh-text-muted,#64748b); }
        .v11159-history-empty { padding:18px;border:1px dashed var(--wh-border,#d9e2ec);border-radius:12px;color:var(--wh-text-muted,#64748b);font-size:11px; }
        body.dark-theme .v11159-history-row,body.dark-theme .v11159-history-heading>span { background:#22304a; }
        body.dark-theme .v11159-history-index { background:#18253a; }
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    ensureStyle();
    window.addEventListener('click', handleClick, true);
    window.v11159CareDesktopTabsVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();