/* ============================================================
   WAFFLE HOUSE — FLOORPLAN FIRST-DRAG STATE FIX
   ------------------------------------------------------------
   The Layout draft interceptor returns a synthetic save response so edits
   can stay local until Save layout is pressed. Core Floorplan normalisation
   historically cloned zone/section/artefact arrays from that response and
   replaced the active plan object after the editor had already rebound its
   pointer handlers. Those handlers then held the previous plan snapshot,
   making the next drag appear one interaction behind.

   This compatibility layer keeps mutable layout arrays reference-stable
   through synthetic/real Floorplan save responses. Core normalisation still
   receives a valid Array, but its map() step returns the original live array,
   so already-bound drag handlers and the active plan continue to share the
   same item objects. No backend writes are added; Save layout remains the
   only persistence point while editing Layout.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_FLOORPLAN_FIRST_DRAG_FIX) return;

  const VERSION = '1.0.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  let wrapped = null;
  let observer = null;
  let attempts = 0;

  function layoutModeActive() {
    return !!document.querySelector('[data-floorplan-mode="layout"].is-active');
  }

  function isFloorplanSave(payload) {
    return !!payload &&
      payload.action === 'save_organiser_item' &&
      payload.type === 'floorplan' &&
      !!payload.id &&
      !!payload.value;
  }

  function referenceStableArray(array) {
    if (!Array.isArray(array) || typeof Proxy !== 'function') return array;
    return new Proxy(array, {
      get(target, property, receiver) {
        // floorplan.js normalisePlan() maps these three collections. Returning
        // the source array from map keeps the editor's already-bound handlers
        // and the newly-normalised active plan on the same mutable objects.
        if (property === 'map') return function () { return target; };
        return Reflect.get(target, property, receiver);
      }
    });
  }

  function stabiliseResponse(payload, response) {
    if (!response || response.result !== 'success' || !response.item || !payload?.value) return response;

    const source = payload.value;
    const value = {
      ...source,
      rooms: Array.isArray(source.rooms) ? source.rooms : [],
      zones: referenceStableArray(source.zones),
      sections: referenceStableArray(source.sections),
      artefacts: referenceStableArray(source.artefacts),
      assignments: Array.isArray(source.assignments) ? source.assignments : []
    };

    response.item.value = value;
    response.item.title = String(payload.title || value.name || response.item.title || 'Floorplan');
    return response;
  }

  function install() {
    const current = window.queryAppsScript;
    if (typeof current !== 'function') return false;
    if (current === wrapped || current.__waffleFloorplanFirstDragFix === true) return true;

    // Install only after the Layout draft wrapper when it is available. This
    // ensures we preserve the explicit Save layout behaviour introduced by
    // the Floorplan enhancement module rather than bypassing it.
    const draftApi = window.WAFFLE_FLOORPLAN_AREA_LABELS;
    if (!draftApi || typeof draftApi.hasUnsavedChanges !== 'function') return false;

    const next = function (payload, ...rest) {
      const result = current.call(this, payload, ...rest);
      if (!layoutModeActive() || !isFloorplanSave(payload)) return result;
      return Promise.resolve(result).then(response => stabiliseResponse(payload, response));
    };

    next.__waffleFloorplanFirstDragFix = true;
    next.__waffleFloorplanFirstDragOriginal = current;
    wrapped = next;
    window.queryAppsScript = next;
    return true;
  }

  function ensureInstalled() {
    attempts += 1;
    if (install()) {
      observer?.disconnect();
      observer = null;
      return;
    }
    if (attempts > 200) {
      observer?.disconnect();
      observer = null;
    }
  }

  function start() {
    ensureInstalled();
    if (wrapped) return;
    observer = new MutationObserver(ensureInstalled);
    observer.observe(document.documentElement, { childList:true, subtree:true });
    const timer = window.setInterval(() => {
      ensureInstalled();
      if (wrapped || attempts > 200) window.clearInterval(timer);
    }, 100);
  }

  window.WAFFLE_FLOORPLAN_FIRST_DRAG_FIX = Object.freeze({
    version: VERSION,
    ensureInstalled
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
