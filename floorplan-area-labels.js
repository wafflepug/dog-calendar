/* ============================================================
   WAFFLE HOUSE — FLOORPLAN CUSTOM AREA LABELS
   ------------------------------------------------------------
   Hides baked-in room titles, turns the section toolbox into a
   user-named draggable area tool, and keeps POIs visually above
   room sections and dog-care areas.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_FLOORPLAN_AREA_LABELS) return;

  const VERSION = '1.0.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  const state = {
    label: '',
    pendingLabel: '',
    pendingUntil: 0,
    observer: null,
    scheduled: false
  };

  function installStyle() {
    if (document.getElementById('waffleFloorplanCustomAreaStyle')) return;
    const style = document.createElement('style');
    style.id = 'waffleFloorplanCustomAreaStyle';
    style.textContent = `
      .floorplan-room-label{display:none!important}
      .floorplan-custom-area-builder{display:grid;gap:8px;margin-top:7px}
      .floorplan-custom-area-builder label{display:grid;gap:5px;font:800 10px system-ui;color:#64748b}
      .floorplan-custom-area-builder input{width:100%;box-sizing:border-box;border:1px solid #dbe3ef;border-radius:10px;padding:10px;background:#fff;color:#172033;font:700 13px system-ui;outline:none}
      .floorplan-custom-area-builder input:focus{border-color:#7c3aed;box-shadow:0 0 0 2px rgba(124,58,237,.12)}
      .floorplan-custom-area-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:stretch}
      .floorplan-custom-area-actions .floorplan-tool{min-width:0}
      .floorplan-custom-area-centre{border:1px solid #dbe3ef;border-radius:10px;background:#fff;padding:0 10px;color:#475569;font:800 9px/1.2 system-ui;cursor:pointer;min-height:44px}
      .floorplan-custom-area-centre:disabled,.floorplan-tool[data-floorplan-custom-area-tool][disabled]{opacity:.48;cursor:not-allowed;box-shadow:none}
      .floorplan-custom-area-note{font:650 9px/1.4 system-ui;color:#94a3b8}
      .floorplan-section-icon{display:none}
      .floorplan-section-label{font-weight:900}
      @media(max-width:760px){
        .floorplan-custom-area-builder input{font-size:16px}
        .floorplan-custom-area-actions{grid-template-columns:1fr}
        .floorplan-custom-area-centre{min-height:42px}
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function floorplanVisible() {
    const view = document.querySelector('[data-organiser-view="floorplan"]');
    return !!view && !view.hidden;
  }

  function sectionToolgroup() {
    const firstSectionTool = document.querySelector('[data-floorplan-tool^="section:"]');
    return firstSectionTool?.closest('.floorplan-toolgroup') || null;
  }

  function markPending(label) {
    const clean = String(label || '').trim().slice(0,60);
    if (!clean) return false;
    state.pendingLabel = clean;
    state.pendingUntil = Date.now() + 2500;
    window.setTimeout(() => {
      if (Date.now() >= state.pendingUntil) {
        state.pendingLabel = '';
        state.pendingUntil = 0;
      }
    }, 2700);
    return true;
  }

  function syncTool(tool, input, centreButton) {
    const label = String(input?.value || state.label || '').trim().slice(0,60);
    state.label = label;
    if (input && input.value !== label) input.value = label;

    const strong = tool?.querySelector('strong');
    const small = tool?.querySelector('small');
    const icon = tool?.querySelector('.floorplan-tool-icon');
    if (strong) strong.textContent = label || 'Type an area name';
    if (small) small.textContent = label ? 'Drag onto plan' : 'Enter a label above';
    if (icon) icon.textContent = '▧';
    if (tool) {
      tool.disabled = !label;
      tool.draggable = !!label;
      tool.setAttribute('aria-label', label ? `Drag ${label} area onto floorplan` : 'Type an area name first');
    }
    if (centreButton) centreButton.disabled = !label;
  }

  function bindCarrier(tool, input, centreButton) {
    if (!tool || tool.dataset.floorplanCustomAreaBound === 'true') return;
    tool.dataset.floorplanCustomAreaBound = 'true';

    const remember = () => markPending(input?.value || state.label);
    tool.addEventListener('dragstart', remember, true);
    tool.addEventListener('pointerdown', remember, true);
    tool.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') remember();
    }, true);

    tool.addEventListener('dragend', () => {
      window.setTimeout(() => {
        if (Date.now() >= state.pendingUntil) state.pendingLabel = '';
      }, 800);
    });

    if (centreButton && centreButton.dataset.floorplanCustomAreaBound !== 'true') {
      centreButton.dataset.floorplanCustomAreaBound = 'true';
      centreButton.addEventListener('click', () => {
        if (!markPending(input?.value || state.label)) return;
        try {
          tool.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
        } catch (_) {
          tool.focus();
        }
      });
    }
  }

  function buildCustomAreaTool() {
    const group = sectionToolgroup();
    if (!group) return;

    const headStrong = group.querySelector('.floorplan-toolgroup-head strong');
    const headSmall = group.querySelector('.floorplan-toolgroup-head small');
    if (headStrong) headStrong.textContent = 'Custom areas';
    if (headSmall) headSmall.textContent = 'Type any area name, then drag that labelled box onto the plan.';

    const toolbox = group.querySelector('.floorplan-toolbox');
    if (!toolbox) return;
    const tools = Array.from(toolbox.querySelectorAll('[data-floorplan-tool^="section:"]'));
    if (!tools.length) return;

    const carrier = tools[0];
    carrier.dataset.floorplanCustomAreaTool = 'true';
    tools.slice(1).forEach(tool => { tool.hidden = true; });

    let builder = group.querySelector('[data-floorplan-custom-area-builder]');
    if (!builder) {
      builder = document.createElement('div');
      builder.className = 'floorplan-custom-area-builder';
      builder.dataset.floorplanCustomAreaBuilder = 'true';
      builder.innerHTML = `
        <label>Area name
          <input type="text" maxlength="60" placeholder="e.g. Dining, Kitchen, Quiet corner" data-floorplan-custom-area-input>
        </label>
        <div class="floorplan-custom-area-actions" data-floorplan-custom-area-actions></div>
        <div class="floorplan-custom-area-note">Drag the labelled tile onto the plan. You can move and resize the area after placing it.</div>
      `;
      group.insertBefore(builder, toolbox);
    }

    const actions = builder.querySelector('[data-floorplan-custom-area-actions]');
    if (actions && carrier.parentElement !== actions) actions.appendChild(carrier);

    let centreButton = builder.querySelector('[data-floorplan-custom-area-centre]');
    if (!centreButton && actions) {
      centreButton = document.createElement('button');
      centreButton.type = 'button';
      centreButton.className = 'floorplan-custom-area-centre';
      centreButton.dataset.floorplanCustomAreaCentre = 'true';
      centreButton.textContent = 'Add to centre';
      actions.appendChild(centreButton);
    }

    const input = builder.querySelector('[data-floorplan-custom-area-input]');
    if (input && input.dataset.floorplanCustomAreaBound !== 'true') {
      input.dataset.floorplanCustomAreaBound = 'true';
      input.value = state.label;
      input.addEventListener('input', () => syncTool(carrier,input,centreButton));
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (!state.label) return;
        centreButton?.click();
      });
    }

    syncTool(carrier,input,centreButton);
    bindCarrier(carrier,input,centreButton);
  }

  function applyPendingRename() {
    if (!state.pendingLabel || Date.now() > state.pendingUntil) return;
    const input = document.querySelector('[data-floorplan-item-name^="section|"]');
    if (!input) return;

    const current = String(input.value || '').trim();
    const presetNames = new Set(['Living','Dining','Kitchen','Overflow','Quiet Area','Entry']);
    if (!presetNames.has(current)) return;

    const next = state.pendingLabel;
    state.pendingLabel = '';
    state.pendingUntil = 0;
    if (!next || current === next) return;

    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function ensureLayerOrder() {
    const svg = document.querySelector('[data-floorplan-canvas] svg');
    if (!svg) return;
    const sections = svg.querySelector(':scope > .floorplan-sections');
    const zones = svg.querySelector(':scope > .floorplan-zones');
    const artefacts = svg.querySelector(':scope > .floorplan-artefacts');
    const selection = svg.querySelector(':scope > .floorplan-selection');
    const desired = [sections,zones,artefacts,selection].filter(Boolean);
    if (desired.length < 2) return;

    const current = Array.from(svg.children).filter(node => desired.includes(node));
    const alreadyOrdered = current.length === desired.length && current.every((node,index) => node === desired[index]);
    if (alreadyOrdered) return;
    desired.forEach(node => svg.appendChild(node));
  }

  function removeBakedRoomTitles() {
    document.querySelectorAll('.floorplan-room-label').forEach(label => label.setAttribute('aria-hidden','true'));
  }

  function apply() {
    state.scheduled = false;
    if (!floorplanVisible()) return;
    installStyle();
    removeBakedRoomTitles();
    ensureLayerOrder();
    buildCustomAreaTool();
    applyPendingRename();
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(apply);
  }

  function start() {
    installStyle();
    scheduleApply();
    state.observer = new MutationObserver(scheduleApply);
    state.observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
  }

  window.WAFFLE_FLOORPLAN_AREA_LABELS = Object.freeze({
    version: VERSION,
    refresh: scheduleApply
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
