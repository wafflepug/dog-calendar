/* ============================================================
   WAFFLE HOUSE — FLOORPLAN OUTDOORS + DARK CONTRAST
   ------------------------------------------------------------
   Adds a first-class Outdoors section by reusing the core section drag
   carrier, preserving the existing Floorplan move/resize/draft-save model.
   Also loads dedicated high-contrast Floorplan theme overrides.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_FLOORPLAN_OUTDOORS_DARK) return;

  const VERSION = '1.0.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  const state = {
    pendingOutdoor: false,
    pendingUntil: 0,
    outdoorIds: new Set(),
    wrappedQuery: null,
    observer: null,
    scheduled: false
  };

  function floorplanVisible() {
    const view = document.querySelector('[data-organiser-view="floorplan"]');
    return !!view && !view.hidden;
  }

  function layoutModeActive() {
    return !!document.querySelector('[data-floorplan-mode="layout"].is-active');
  }

  function loadStyle() {
    if (document.querySelector('link[data-waffle-floorplan-outdoors-dark-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `floorplan-outdoors-dark.css?build=${encodeURIComponent(window.WAFFLE_BUILD || VERSION)}`;
    link.dataset.waffleFloorplanOutdoorsDarkStyle = VERSION;
    (document.head || document.documentElement).appendChild(link);
  }

  function markOutdoorPending() {
    state.pendingOutdoor = true;
    state.pendingUntil = Date.now() + 3500;
    window.setTimeout(() => {
      if (Date.now() >= state.pendingUntil) {
        state.pendingOutdoor = false;
        state.pendingUntil = 0;
      }
    }, 3700);
  }

  function isFloorplanSave(payload) {
    return !!payload &&
      payload.action === 'save_organiser_item' &&
      payload.type === 'floorplan' &&
      !!payload.value;
  }

  function sectionsFromPayload(payload) {
    return Array.isArray(payload?.value?.sections) ? payload.value.sections : [];
  }

  function syncOutdoorIdsFromSections(sections) {
    (sections || []).forEach(item => {
      if (!item || String(item.preset || '') !== 'outdoor') return;
      const id = String(item.id || '');
      if (id) state.outdoorIds.add(id);
    });
  }

  function syncOutdoorIdsFromOrganiser(response) {
    const items = Array.isArray(response?.items) ? response.items : [];
    items.forEach(item => {
      if (item?.type !== 'floorplan') return;
      syncOutdoorIdsFromSections(item?.value?.sections);
    });
  }

  function transformPendingOutdoor(payload) {
    if (!state.pendingOutdoor || Date.now() > state.pendingUntil || !isFloorplanSave(payload)) return null;
    const sections = sectionsFromPayload(payload);
    if (!sections.length) return null;

    const item = [...sections].reverse().find(section =>
      section &&
      String(section.preset || '') === 'entry' &&
      String(section.label || '') === 'Entry'
    );
    if (!item) return null;

    item.preset = 'outdoor';
    item.label = 'Outdoors';
    const id = String(item.id || '');
    if (id) state.outdoorIds.add(id);

    state.pendingOutdoor = false;
    state.pendingUntil = 0;
    decorateOutdoorItem(id);
    return item;
  }

  function decorateOutdoorItem(id) {
    if (!id) return;
    const selector = `.floorplan-section[data-floorplan-item-id="${CSS.escape(id)}"]`;
    const group = document.querySelector(selector);
    if (group) {
      group.classList.add('kind-outdoor');
      const label = group.querySelector('.floorplan-section-label');
      if (label && label.textContent === 'Entry') label.textContent = 'Outdoors';
    }

    const edit = document.querySelector(`[data-floorplan-item-name="section|${CSS.escape(id)}"]`);
    if (edit && edit.value === 'Entry') edit.value = 'Outdoors';
  }

  function decorateOutdoorDom() {
    document.querySelectorAll('.floorplan-section[data-floorplan-item-id]').forEach(group => {
      const id = String(group.dataset.floorplanItemId || '');
      group.classList.toggle('kind-outdoor', state.outdoorIds.has(id));
    });
  }

  function processResponse(payload, response) {
    if (payload?.action === 'get_organiser' && response) {
      syncOutdoorIdsFromOrganiser(response);
      scheduleApply();
    }
    if (isFloorplanSave(payload)) {
      syncOutdoorIdsFromSections(sectionsFromPayload(payload));
      scheduleApply();
    }
    return response;
  }

  function installQueryWrapper() {
    const current = window.queryAppsScript;
    if (typeof current !== 'function') return false;
    if (current === state.wrappedQuery || current.__waffleFloorplanOutdoorsDark === true) return true;

    // Wait until both existing Floorplan save layers are present. This keeps
    // manual Save layout and the first-drag reference fix intact.
    if (!window.WAFFLE_FLOORPLAN_AREA_LABELS || !window.WAFFLE_FLOORPLAN_FIRST_DRAG_FIX) return false;

    const wrapped = function (payload, ...rest) {
      if (layoutModeActive() && isFloorplanSave(payload)) transformPendingOutdoor(payload);
      const result = current.call(this, payload, ...rest);
      return Promise.resolve(result).then(response => processResponse(payload, response));
    };

    wrapped.__waffleFloorplanOutdoorsDark = true;
    wrapped.__waffleFloorplanOutdoorsDarkOriginal = current;
    // floorplan-area-labels.js watches queryAppsScript and would otherwise
    // install another draft wrapper outside this layer, bypassing Outdoors.
    // This wrapper delegates to the existing draft wrapper, so it is safe to
    // advertise the same marker and remain the outermost compatible layer.
    wrapped.__waffleFloorplanDraftWrapper = true;

    state.wrappedQuery = wrapped;
    window.queryAppsScript = wrapped;
    return true;
  }

  function outdoorToolGroup() {
    return document.querySelector('[data-floorplan-outdoor-group]');
  }

  function ensureOutdoorTool() {
    if (!floorplanVisible() || !layoutModeActive()) return;
    const inspector = document.querySelector('.floorplan-inspector');
    if (!inspector) return;

    let tool = document.querySelector('[data-floorplan-tool="section:entry"]');
    if (!tool) return;

    let group = outdoorToolGroup();
    if (!group) {
      group = document.createElement('section');
      group.className = 'floorplan-toolgroup floorplan-outdoor-group';
      group.dataset.floorplanOutdoorGroup = 'true';
      group.innerHTML = `
        <div class="floorplan-toolgroup-head">
          <strong>Outdoor areas</strong>
          <small>Add a backyard, courtyard, patio, balcony or other outdoor space.</small>
        </div>
        <div class="floorplan-toolbox" data-floorplan-outdoor-toolbox></div>
        <div class="floorplan-outdoor-note">Place Outdoors on the plan, resize it to the boundary, then rename it if needed.</div>
      `;

      const customGroup = document.querySelector('[data-floorplan-custom-area-builder]')?.closest('.floorplan-toolgroup');
      const structureGroup = document.querySelector('[data-floorplan-structure-group]');
      if (structureGroup?.parentNode === inspector) inspector.insertBefore(group, structureGroup);
      else if (customGroup?.parentNode === inspector && customGroup.nextSibling) inspector.insertBefore(group, customGroup.nextSibling);
      else inspector.appendChild(group);
    }

    const toolbox = group.querySelector('[data-floorplan-outdoor-toolbox]');
    if (toolbox && tool.parentElement !== toolbox) toolbox.appendChild(tool);

    tool.hidden = false;
    tool.removeAttribute('hidden');
    tool.dataset.floorplanOutdoorTool = 'true';
    tool.classList.add('kind-outdoor');

    const icon = tool.querySelector('.floorplan-tool-icon');
    const strong = tool.querySelector('strong');
    const small = tool.querySelector('small');
    if (icon) icon.textContent = '🌿';
    if (strong) strong.textContent = 'Outdoors';
    if (small) small.textContent = 'Drag onto plan';
    tool.setAttribute('aria-label', 'Drag Outdoors onto floorplan');

    if (tool.dataset.floorplanOutdoorBound !== 'true') {
      tool.dataset.floorplanOutdoorBound = 'true';
      tool.addEventListener('pointerdown', markOutdoorPending, true);
      tool.addEventListener('dragstart', markOutdoorPending, true);
      tool.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') markOutdoorPending();
      }, true);
      tool.addEventListener('dragend', () => {
        window.setTimeout(() => {
          if (Date.now() >= state.pendingUntil) {
            state.pendingOutdoor = false;
            state.pendingUntil = 0;
          }
        }, 500);
      });
    }
  }

  function updateHints() {
    const hint = document.querySelector('.floorplan-hint');
    if (hint && /Start with a section/i.test(hint.textContent || '')) {
      hint.textContent = 'Start with an indoor section or Outdoors, then place furniture, POIs and dog-care areas above it.';
    }
    const canvasEmpty = document.querySelector('.floorplan-canvas-empty');
    if (canvasEmpty) {
      canvasEmpty.innerHTML = 'Switch to <strong>Layout</strong> and drag in an indoor/outdoor section, furniture item, POI or dog-care area.';
    }
  }

  function apply() {
    state.scheduled = false;
    loadStyle();
    installQueryWrapper();
    if (!floorplanVisible()) return;
    ensureOutdoorTool();
    decorateOutdoorDom();
    updateHints();
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(apply);
  }

  function start() {
    loadStyle();
    installQueryWrapper();
    scheduleApply();
    state.observer = new MutationObserver(scheduleApply);
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class']
    });
    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('waffle:first-paint-ready', scheduleApply);
  }

  window.WAFFLE_FLOORPLAN_OUTDOORS_DARK = Object.freeze({
    version: VERSION,
    refresh: scheduleApply,
    outdoorIds: () => Array.from(state.outdoorIds)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
