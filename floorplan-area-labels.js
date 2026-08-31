/* ============================================================
   WAFFLE HOUSE — FLOORPLAN LAYOUT ENHANCEMENTS
   ------------------------------------------------------------
   Hides baked-in room titles, turns the section toolbox into a
   user-named draggable area tool, keeps POIs visually above room
   sections and dog-care areas, self-heals Floorplan registration,
   batches Layout edits behind an explicit Save layout action, and
   adds draggable wall/divider structures.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_FLOORPLAN_AREA_LABELS) return;

  const VERSION = '1.2.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  const state = {
    label: '',
    pendingLabel: '',
    pendingUntil: 0,
    observer: null,
    scheduled: false,
    dirty: false,
    saving: false,
    draftPayload: null,
    draftPlanId: '',
    allowRealSave: false,
    queryWrapper: null,
    structureMode: 'wall-h',
    pendingStructure: '',
    pendingStructureUntil: 0,
    structureKindsById: Object.create(null)
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

      .floorplan-draft-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .floorplan-draft-save{border:1px solid #0f766e!important;background:#0f766e!important;color:#fff!important;font-weight:900!important}
      .floorplan-draft-save:disabled{opacity:.5;cursor:not-allowed}
      .floorplan-draft-discard{border:1px solid #cbd5e1!important;background:#fff!important;color:#475569!important;font-weight:800!important}
      .floorplan-draft-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:7px 10px;background:#f1f5f9;color:#64748b;font:800 10px/1 system-ui;white-space:nowrap}
      .floorplan-draft-status.is-dirty{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
      .floorplan-draft-status.is-saving{background:#ecfeff;color:#0f766e;border:1px solid #a5f3fc}
      .floorplan-layout-save-note{margin:0 0 8px;padding:9px 11px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;color:#1d4ed8;font:750 10px/1.4 system-ui}

      .floorplan-structure-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:7px 0}
      .floorplan-structure-mode{border:1px solid #dbe3ef;border-radius:9px;background:#fff;color:#475569;padding:8px 5px;font:800 9px/1.15 system-ui;cursor:pointer}
      .floorplan-structure-mode.is-active{border-color:#64748b;background:#f1f5f9;color:#0f172a;box-shadow:inset 0 0 0 1px #64748b}
      .floorplan-structure-note{font:650 9px/1.4 system-ui;color:#94a3b8;margin-top:6px}
      .floorplan-structure-group .floorplan-tool{width:100%}

      .floorplan-artefact.kind-wall-h text,
      .floorplan-artefact.kind-wall-v text,
      .floorplan-artefact.kind-divider text{display:none}
      .floorplan-artefact.kind-wall-h rect,
      .floorplan-artefact.kind-wall-v rect{fill:#475569!important;stroke:#1e293b!important;stroke-width:3!important;rx:3!important;ry:3!important;transform-box:fill-box;transform-origin:center}
      .floorplan-artefact.kind-wall-h rect{transform:scaleY(.22)}
      .floorplan-artefact.kind-wall-v rect{transform:scaleX(.22)}
      .floorplan-artefact.kind-divider rect{fill:rgba(100,116,139,.10)!important;stroke:#64748b!important;stroke-width:4!important;stroke-dasharray:13 9!important;rx:5!important;ry:5!important;transform-box:fill-box;transform-origin:center;transform:scaleY(.34)}
      .floorplan-artefact.kind-wall-h.is-selected rect,
      .floorplan-artefact.kind-wall-v.is-selected rect,
      .floorplan-artefact.kind-divider.is-selected rect{stroke:#2563eb!important;stroke-width:6!important}

      @media(max-width:760px){
        .floorplan-custom-area-builder input{font-size:16px}
        .floorplan-custom-area-actions{grid-template-columns:1fr}
        .floorplan-custom-area-centre{min-height:42px}
        .floorplan-draft-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}
        .floorplan-draft-status{grid-column:1/-1;justify-content:center}
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }

  function toast(message, mode) {
    if (typeof window.showWaffleToast === 'function') {
      try { window.showWaffleToast(message, mode || 'success'); return; } catch (_) {}
    }
    let node = document.getElementById('floorplanDraftToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'floorplanDraftToast';
      node.className = 'floorplan-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.mode = mode || 'success';
    node.classList.add('is-visible');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('is-visible'), 2400);
  }

  function floorplanVisible() {
    const view = document.querySelector('[data-organiser-view="floorplan"]');
    return !!view && !view.hidden;
  }

  function layoutModeActive() {
    return !!document.querySelector('[data-floorplan-mode="layout"].is-active');
  }

  function activePlanId() {
    return String(document.querySelector('[data-floorplan-plan].is-active')?.dataset?.floorplanPlan || state.draftPlanId || '');
  }

  function activateFloorplanFromGuard() {
    document.querySelectorAll('[data-organiser-tab]').forEach(button => {
      const active = button.dataset.organiserTab === 'floorplan';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-organiser-view]').forEach(view => {
      view.hidden = view.dataset.organiserView !== 'floorplan';
    });

    const api = window.WAFFLE_ORGANISER_FLOORPLAN;
    if (api && typeof api.refresh === 'function') {
      try { api.refresh(); } catch (_) {}
    }
    scheduleApply();
  }

  function ensureFloorplanRegistration() {
    const root = document.getElementById('v11115OrganiserRoot');
    if (!root) return false;
    const tabs = root.querySelector('.v11115-organiser-tabs');
    const body = root.querySelector('.v11115-organiser-body');
    if (!tabs || !body) return false;

    let button = tabs.querySelector('[data-organiser-tab="floorplan"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.organiserTab = 'floorplan';
      button.textContent = '🏠 Floorplan';
      const sleep = tabs.querySelector('[data-organiser-tab="sleep"]');
      tabs.insertBefore(button, sleep || tabs.lastElementChild);
    }

    if (button.dataset.floorplanAreaGuardBound !== 'true') {
      button.dataset.floorplanAreaGuardBound = 'true';
      button.addEventListener('click', activateFloorplanFromGuard);
    }

    let view = body.querySelector('[data-organiser-view="floorplan"]');
    if (!view) {
      view = document.createElement('div');
      view.dataset.organiserView = 'floorplan';
      view.hidden = true;
      body.appendChild(view);
    }
    return true;
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

  function markStructurePending(mode) {
    state.pendingStructure = mode || state.structureMode || 'wall-h';
    state.pendingStructureUntil = Date.now() + 3000;
  }

  function structureMeta(mode) {
    if (mode === 'wall-v') return { label:'Wall · Vertical', icon:'┃', itemLabel:'Wall' };
    if (mode === 'divider') return { label:'Divider', icon:'┄', itemLabel:'Divider' };
    return { label:'Wall · Horizontal', icon:'━', itemLabel:'Wall' };
  }

  function syncStructureCarrier(carrier) {
    if (!carrier) return;
    const meta = structureMeta(state.structureMode);
    const icon = carrier.querySelector('.floorplan-tool-icon');
    const strong = carrier.querySelector('strong');
    const small = carrier.querySelector('small');
    if (icon) icon.textContent = meta.icon;
    if (strong) strong.textContent = meta.label;
    if (small) small.textContent = 'Drag onto plan';
    carrier.setAttribute('aria-label', `Drag ${meta.label} onto floorplan`);
  }

  function ensureStructureTools() {
    if (!layoutModeActive()) return;
    const gate = document.querySelector('[data-floorplan-tool="artefact:gate"]');
    if (!gate) return;

    const furnitureGroup = Array.from(document.querySelectorAll('.floorplan-toolgroup')).find(group =>
      /Furniture\s*&\s*POIs/i.test(String(group.querySelector('.floorplan-toolgroup-head strong')?.textContent || ''))
    );
    if (!furnitureGroup) return;

    let group = document.querySelector('[data-floorplan-structure-group]');
    if (!group) {
      group = document.createElement('section');
      group.className = 'floorplan-toolgroup floorplan-structure-group';
      group.dataset.floorplanStructureGroup = 'true';
      group.innerHTML = `
        <div class="floorplan-toolgroup-head"><strong>Walls &amp; dividers</strong><small>Split or define open spaces. Pick a type, then drag it onto the plan.</small></div>
        <div class="floorplan-structure-modes" role="group" aria-label="Wall and divider type">
          <button type="button" class="floorplan-structure-mode" data-floorplan-structure-mode="wall-h">━ Wall</button>
          <button type="button" class="floorplan-structure-mode" data-floorplan-structure-mode="wall-v">┃ Wall</button>
          <button type="button" class="floorplan-structure-mode" data-floorplan-structure-mode="divider">┄ Divider</button>
        </div>
        <div class="floorplan-toolbox" data-floorplan-structure-toolbox></div>
        <div class="floorplan-structure-note">Walls and dividers are layout objects. Move and resize them like other items.</div>
      `;
      furnitureGroup.parentNode?.insertBefore(group,furnitureGroup);
    }

    const toolbox = group.querySelector('[data-floorplan-structure-toolbox]');
    if (toolbox && gate.parentElement !== toolbox) toolbox.appendChild(gate);
    gate.dataset.floorplanStructureCarrier = 'true';

    if (gate.dataset.floorplanStructureBound !== 'true') {
      gate.dataset.floorplanStructureBound = 'true';
      const remember = () => markStructurePending(state.structureMode);
      gate.addEventListener('pointerdown', remember, true);
      gate.addEventListener('dragstart', remember, true);
      gate.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') remember();
      }, true);
    }

    group.querySelectorAll('[data-floorplan-structure-mode]').forEach(button => {
      const active = button.dataset.floorplanStructureMode === state.structureMode;
      button.classList.toggle('is-active', active);
      if (button.dataset.floorplanStructureBound !== 'true') {
        button.dataset.floorplanStructureBound = 'true';
        button.addEventListener('click', () => {
          state.structureMode = button.dataset.floorplanStructureMode || 'wall-h';
          group.querySelectorAll('[data-floorplan-structure-mode]').forEach(item => item.classList.toggle('is-active', item === button));
          syncStructureCarrier(gate);
        });
      }
    });
    syncStructureCarrier(gate);
  }

  function transformPendingStructure(payload) {
    if (!state.pendingStructure || Date.now() > state.pendingStructureUntil) return;
    const artefacts = payload?.value?.artefacts;
    if (!Array.isArray(artefacts) || !artefacts.length) return;
    const item = [...artefacts].reverse().find(entry => entry && entry.kind === 'gate' && String(entry.label || '') === 'Gate / Divider');
    if (!item) return;

    const mode = state.pendingStructure;
    const meta = structureMeta(mode);
    item.kind = mode;
    item.label = meta.itemLabel;

    if (mode === 'wall-v') {
      const cx = Number(item.x || 0) + Number(item.w || 0) / 2;
      const cy = Number(item.y || 0) + Number(item.h || 0) / 2;
      const oldW = Math.max(58, Number(item.w) || 165);
      const oldH = Math.max(48, Number(item.h) || 52);
      item.w = Math.max(58, Math.min(72, oldH + 6));
      item.h = Math.max(130, oldW);
      item.x = Math.round(cx - item.w / 2);
      item.y = Math.round(cy - item.h / 2);
    }

    state.structureKindsById[String(item.id || '')] = mode;
    state.pendingStructure = '';
    state.pendingStructureUntil = 0;
  }

  function decorateStructureDom() {
    document.querySelectorAll('.floorplan-artefact').forEach(group => {
      const id = String(group.dataset.floorplanItemId || '');
      const classMode = ['wall-h','wall-v','divider'].find(mode => group.classList.contains(`kind-${mode}`));
      const mode = classMode || state.structureKindsById[id];
      if (!mode) return;
      group.classList.remove('kind-gate');
      group.classList.add(`kind-${mode}`);
      group.dataset.floorplanStructure = mode;
      group.querySelectorAll('text').forEach(text => text.setAttribute('aria-hidden','true'));
    });

    const poiBadge = Array.from(document.querySelectorAll('.floorplan-progress span')).find(span => /POIs/i.test(span.textContent || ''));
    if (poiBadge && !/structures/i.test(poiBadge.textContent || '')) poiBadge.textContent = `${poiBadge.textContent} / structures`;
  }

  function isFloorplanSave(payload) {
    return payload && payload.action === 'save_organiser_item' && payload.type === 'floorplan' && payload.id;
  }

  function fakeSaveResponse(payload) {
    const now = new Date().toISOString();
    return {
      result: 'success',
      item: {
        id: String(payload.id || ''),
        type: 'floorplan',
        title: String(payload.title || payload?.value?.name || 'Floorplan'),
        stayKey: '',
        dogName: '',
        value: clone(payload.value || {}),
        updatedAt: now
      }
    };
  }

  function captureDraft(payload) {
    transformPendingStructure(payload);
    const copy = clone(payload);
    state.draftPayload = copy;
    state.draftPlanId = String(copy.id || '');
    state.dirty = true;
    updateDraftControls();
    scheduleApply();
  }

  function installSaveInterceptor() {
    const current = window.queryAppsScript;
    if (typeof current !== 'function') return;
    if (current === state.queryWrapper) return;
    if (current.__waffleFloorplanDraftWrapper === true) {
      state.queryWrapper = current;
      return;
    }

    const wrapped = function (payload, ...rest) {
      if (!state.allowRealSave && layoutModeActive() && isFloorplanSave(payload)) {
        captureDraft(payload);
        return Promise.resolve(fakeSaveResponse(payload));
      }
      return current.call(this, payload, ...rest);
    };
    wrapped.__waffleFloorplanDraftWrapper = true;
    wrapped.__waffleFloorplanDraftOriginal = current;
    state.queryWrapper = wrapped;
    window.queryAppsScript = wrapped;
  }

  function clearDraftState() {
    state.dirty = false;
    state.saving = false;
    state.draftPayload = null;
    state.draftPlanId = '';
    state.pendingStructure = '';
    state.pendingStructureUntil = 0;
    updateDraftControls();
  }

  async function saveDraft() {
    if (!state.dirty || !state.draftPayload || state.saving) return;
    state.saving = true;
    updateDraftControls();
    try {
      state.allowRealSave = true;
      const response = await window.queryAppsScript(clone(state.draftPayload));
      if (!response || response.result !== 'success') throw new Error(response?.message || 'Floorplan could not be saved.');
      clearDraftState();
      toast('Layout saved ✓');
      const api = window.WAFFLE_ORGANISER_FLOORPLAN;
      if (api && typeof api.refresh === 'function') await api.refresh();
    } catch (error) {
      state.saving = false;
      updateDraftControls();
      toast(error?.message || 'Floorplan could not be saved.', 'error');
    } finally {
      state.allowRealSave = false;
    }
  }

  function discardDraft() {
    if (!state.dirty) return;
    clearDraftState();
    toast('Unsaved layout changes discarded');
    const api = window.WAFFLE_ORGANISER_FLOORPLAN;
    if (api && typeof api.refresh === 'function') {
      try { api.refresh(); } catch (_) {}
    }
  }

  function updateDraftControls() {
    const save = document.querySelector('[data-floorplan-save-layout]');
    const discard = document.querySelector('[data-floorplan-discard-layout]');
    const status = document.querySelector('[data-floorplan-draft-status]');
    if (save) {
      save.disabled = !state.dirty || state.saving;
      save.textContent = state.saving ? 'Saving…' : 'Save layout';
    }
    if (discard) discard.disabled = !state.dirty || state.saving;
    if (status) {
      status.classList.toggle('is-dirty', state.dirty && !state.saving);
      status.classList.toggle('is-saving', state.saving);
      status.textContent = state.saving ? '⏳ Saving changes' : state.dirty ? '● Unsaved changes' : '✓ All changes saved';
    }
  }

  function ensureDraftControls() {
    if (!layoutModeActive()) return;
    const actions = document.querySelector('.floorplan-toolbar .floorplan-actions');
    if (!actions) return;

    let controls = actions.querySelector('[data-floorplan-draft-actions]');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'floorplan-draft-actions';
      controls.dataset.floorplanDraftActions = 'true';
      controls.innerHTML = `
        <span class="floorplan-draft-status" data-floorplan-draft-status></span>
        <button type="button" class="floorplan-draft-discard" data-floorplan-discard-layout>Discard</button>
        <button type="button" class="floorplan-draft-save" data-floorplan-save-layout>Save layout</button>
      `;
      actions.insertBefore(controls, actions.firstChild);
      controls.querySelector('[data-floorplan-save-layout]')?.addEventListener('click', saveDraft);
      controls.querySelector('[data-floorplan-discard-layout]')?.addEventListener('click', discardDraft);
    }

    const inspector = document.querySelector('.floorplan-inspector');
    if (inspector && !inspector.querySelector('[data-floorplan-layout-save-note]')) {
      const note = document.createElement('div');
      note.className = 'floorplan-layout-save-note';
      note.dataset.floorplanLayoutSaveNote = 'true';
      note.textContent = 'Edit freely — changes stay on this device until you press Save layout.';
      inspector.insertBefore(note, inspector.firstChild);
    }

    const canvasNote = document.querySelector('.floorplan-canvas-toolbar small');
    if (canvasNote) canvasNote.textContent = state.dirty ? 'Unsaved changes · press Save layout when ready' : 'Drag items in, then move or resize them';
    updateDraftControls();
  }

  function guardUnsavedNavigation(event) {
    if (!state.dirty) return;
    const target = event.target?.closest?.([
      '[data-floorplan-mode="tonight"]',
      '[data-floorplan-plan]',
      '[data-floorplan-new]',
      '[data-floorplan-default]',
      '[data-floorplan-duplicate]',
      '[data-floorplan-delete]',
      '[data-floorplan-refresh]',
      '[data-organiser-tab]:not([data-organiser-tab="floorplan"])'
    ].join(','));
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    toast('Save or discard your layout changes first.', 'error');
  }

  function apply() {
    state.scheduled = false;
    ensureFloorplanRegistration();
    installSaveInterceptor();
    if (!floorplanVisible()) return;
    installStyle();
    removeBakedRoomTitles();
    ensureLayerOrder();
    buildCustomAreaTool();
    applyPendingRename();
    ensureStructureTools();
    decorateStructureDom();
    ensureDraftControls();
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(apply);
  }

  function start() {
    installStyle();
    installSaveInterceptor();
    scheduleApply();
    state.observer = new MutationObserver(scheduleApply);
    state.observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
    document.addEventListener('click', guardUnsavedNavigation, true);
    window.addEventListener('beforeunload', event => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('waffle:first-paint-ready', scheduleApply);
  }

  window.WAFFLE_FLOORPLAN_AREA_LABELS = Object.freeze({
    version: VERSION,
    refresh: scheduleApply,
    ensureRegistered: ensureFloorplanRegistration,
    hasUnsavedChanges: () => state.dirty,
    saveLayout: saveDraft,
    discardLayout: discardDraft
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();