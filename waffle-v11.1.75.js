/* ============================================================
   WAFFLE HOUSE V11.1.75 — INDEPENDENT SITTER TOOLKIT PREVIEW
   ============================================================
   Reversible product-direction preview for independent sitters who receive
   bookings through Pawshake, Mad Paws and similar marketplaces.

   Preview features:
   1. Today Run Sheet — operational checklist generated from existing Calendar
      data, with local completion state only.
   2. Quick Enquiry + Capacity Check — sitter enters a pet and date range and
      Waffle evaluates peak confirmed occupancy without creating a booking.
   3. Owner Care Form — local preview of the owner self-service questionnaire.
      No public link or backend writes are introduced in this preview.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.75';
  const ROOT_ID = 'wh75SitterToolkit';
  const MODAL_ID = 'wh75OwnerCareModal';
  const DAY_MS = 86400000;
  let refreshFrame = 0;
  let observer = null;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function getAdapter() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function isoDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function addDays(value, count) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setDate(date.getDate() + Number(count || 0));
    return date;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function eventType(event) {
    const props = event?.extendedProps || {};
    if (props.isMeetGreet === true) return 'meet';
    if (props.isPotential === true) return 'potential';
    return 'confirmed';
  }

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest')
      .replace(/^.*Meet\s*&\s*Greet:\s*/i, '')
      .replace(/^.*Potential(?:\s+Stay)?:\s*/i, '')
      .replace(/^⏰\s*[^-]+-\s*/i, '')
      .trim() || 'Guest';
  }

  function eventDates(event) {
    const props = event?.extendedProps || {};
    const start = String(props.rawStartDate || props.startDate || event?.startStr || '').slice(0, 10) || isoDate(event?.start);
    let end = String(props.rawEndDate || props.endDate || '').slice(0, 10);
    if (!end && event?.end) {
      const raw = String(event.endStr || '').slice(0, 10) || isoDate(event.end);
      if (event.allDay === false) end = raw;
      else {
        const parsed = parseIso(raw);
        end = parsed ? isoDate(addDays(parsed, -1)) : raw;
      }
    }
    return { start, end: end || start };
  }

  function eventTime(event) {
    const direct = String(event?.extendedProps?.time || '').trim();
    if (direct) return direct;
    if (event?.start && event.allDay === false) {
      try {
        return event.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      } catch (_) {}
    }
    return '';
  }

  function events() {
    return getAdapter()?.getEvents?.() || [];
  }

  function confirmedOn(dateIso) {
    return events().filter(event => {
      if (eventType(event) !== 'confirmed') return false;
      const dates = eventDates(event);
      return dates.start && dates.start <= dateIso && dates.end >= dateIso;
    });
  }

  function capacityHealth(count) {
    if (count >= 4) return { key: 'red', label: 'Red', summary: 'At or above 4 confirmed dogs' };
    if (count === 3) return { key: 'amber', label: 'Amber', summary: '3 confirmed dogs' };
    return { key: 'green', label: 'Green', summary: `${count} confirmed dog${count === 1 ? '' : 's'}` };
  }

  function rangeCapacity(startIso, endIso) {
    const start = parseIso(startIso);
    const end = parseIso(endIso);
    if (!start || !end || end < start) return null;

    const days = [];
    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      const iso = isoDate(cursor);
      const count = confirmedOn(iso).length;
      days.push({ iso, count, health: capacityHealth(count) });
      if (days.length > 62) break;
    }
    const peak = days.reduce((max, day) => Math.max(max, day.count), 0);
    return { days, peak, health: capacityHealth(peak) };
  }

  function todayTasks() {
    const today = isoDate(new Date());
    const todaysEvents = events();
    const confirmed = todaysEvents.filter(event => eventType(event) === 'confirmed');
    const meets = todaysEvents.filter(event => eventType(event) === 'meet' && eventDates(event).start === today);
    const staying = confirmed.filter(event => {
      const dates = eventDates(event);
      return dates.start <= today && dates.end >= today;
    });

    const tasks = [];
    confirmed.forEach(event => {
      const dates = eventDates(event);
      const name = dogName(event);
      if (dates.start === today) tasks.push({ id: `arrival|${name}|${today}`, icon: '↓', label: `Arrival · ${name}`, meta: 'Confirm handover and belongings' });
      if (dates.end === today) tasks.push({ id: `departure|${name}|${today}`, icon: '↑', label: `Departure · ${name}`, meta: 'Check belongings before handover' });
    });
    meets.forEach(event => {
      const name = dogName(event);
      const time = eventTime(event);
      tasks.push({ id: `meet|${name}|${today}|${time}`, icon: '🤝', label: `Meet & Greet · ${name}`, meta: time || 'Time TBC' });
    });
    staying.forEach(event => {
      const name = dogName(event);
      tasks.push({ id: `care|${name}|${today}`, icon: '🐾', label: `Care check · ${name}`, meta: 'Review today’s care requirements' });
    });

    const seen = new Set();
    return tasks.filter(task => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }

  function checklistState() {
    const key = `wh75-run-sheet-${isoDate(new Date())}`;
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveChecklistState(state) {
    const key = `wh75-run-sheet-${isoDate(new Date())}`;
    try { localStorage.setItem(key, JSON.stringify(state || {})); } catch (_) {}
  }

  function ownerDraft() {
    try { return JSON.parse(localStorage.getItem('wh75-owner-care-draft') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function ensureStyle() {
    if (document.getElementById('wh75SitterToolkitStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh75SitterToolkitStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] {
        --wh75-bg:#ffffff;--wh75-soft:#f8fafc;--wh75-line:#dbe3ed;--wh75-text:#172033;--wh75-muted:#64748b;
        --wh75-blue:#2563eb;--wh75-green:#16a34a;--wh75-amber:#f59e0b;--wh75-red:#ef4444;--wh75-purple:#7c3aed;
      }
      body.dark-theme[data-waffle-page="calendar"] {
        --wh75-bg:#152137;--wh75-soft:#1a2941;--wh75-line:#334155;--wh75-text:#f8fafc;--wh75-muted:#a9b6c9;
        --wh75-blue:#60a5fa;--wh75-green:#22c55e;--wh75-amber:#f59e0b;--wh75-red:#f87171;--wh75-purple:#a78bfa;
      }
      #${ROOT_ID}{margin:16px 0;border:1px solid var(--wh75-line);border-radius:18px;background:var(--wh75-bg);color:var(--wh75-text);overflow:hidden;}
      .wh75-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:15px 16px;border-bottom:1px solid var(--wh75-line);background:var(--wh75-soft);}
      .wh75-eyebrow{font-size:8px;font-weight:950;letter-spacing:.09em;text-transform:uppercase;color:var(--wh75-green);}
      .wh75-title{margin-top:3px;font-size:16px;font-weight:950;letter-spacing:-.02em;}
      .wh75-sub{margin-top:4px;font-size:9px;line-height:1.45;color:var(--wh75-muted);max-width:660px;}
      .wh75-preview-pill{flex:0 0 auto;border:1px solid color-mix(in srgb,var(--wh75-purple) 38%,var(--wh75-line));border-radius:999px;padding:6px 9px;background:color-mix(in srgb,var(--wh75-purple) 9%,var(--wh75-bg));color:var(--wh75-purple);font-size:8px;font-weight:950;}
      .wh75-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:14px;}
      .wh75-card{min-width:0;border:1px solid var(--wh75-line);border-radius:15px;background:var(--wh75-bg);padding:13px;box-shadow:0 3px 12px rgba(15,23,42,.04);}
      .wh75-card-top{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
      .wh75-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:var(--wh75-soft);font-size:18px;}
      .wh75-card-kicker{font-size:7px;font-weight:950;color:var(--wh75-muted);text-transform:uppercase;letter-spacing:.08em;}
      .wh75-card-title{margin-top:2px;font-size:12px;font-weight:950;}
      .wh75-card-copy{min-height:30px;margin:0 0 10px;color:var(--wh75-muted);font-size:8.5px;line-height:1.5;}
      .wh75-list{display:grid;gap:6px;max-height:208px;overflow:auto;}
      .wh75-task{display:grid;grid-template-columns:22px minmax(0,1fr);gap:7px;align-items:start;padding:7px;border:1px solid var(--wh75-line);border-radius:10px;background:var(--wh75-soft);}
      .wh75-task input{width:15px;height:15px;margin:1px 0 0;accent-color:var(--wh75-green);}
      .wh75-task-label{font-size:8.5px;font-weight:900;line-height:1.25;}
      .wh75-task-meta{margin-top:2px;color:var(--wh75-muted);font-size:7px;line-height:1.3;}
      .wh75-empty{padding:15px 8px;text-align:center;color:var(--wh75-muted);font-size:8px;border:1px dashed var(--wh75-line);border-radius:10px;}
      .wh75-form{display:grid;gap:7px;}
      .wh75-field{display:grid;gap:3px;}
      .wh75-field label{font-size:7px;font-weight:900;color:var(--wh75-muted);}
      .wh75-input,.wh75-select,.wh75-textarea{width:100%;box-sizing:border-box;border:1px solid var(--wh75-line);border-radius:9px;background:var(--wh75-soft);color:var(--wh75-text);font:inherit;font-size:9px;padding:8px 9px;outline:none;}
      .wh75-textarea{min-height:70px;resize:vertical;}
      .wh75-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
      .wh75-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;}
      .wh75-btn{min-height:32px;border:1px solid var(--wh75-line);border-radius:9px;padding:0 10px;background:var(--wh75-soft);color:var(--wh75-text);cursor:pointer;font:inherit;font-size:8px;font-weight:950;}
      .wh75-btn.primary{border-color:color-mix(in srgb,var(--wh75-blue) 45%,var(--wh75-line));background:color-mix(in srgb,var(--wh75-blue) 11%,var(--wh75-bg));color:var(--wh75-blue);}
      .wh75-btn.purple{border-color:color-mix(in srgb,var(--wh75-purple) 45%,var(--wh75-line));background:color-mix(in srgb,var(--wh75-purple) 10%,var(--wh75-bg));color:var(--wh75-purple);}
      .wh75-result{display:none;margin-top:8px;padding:9px;border:1px solid var(--wh75-line);border-radius:10px;background:var(--wh75-soft);font-size:8px;line-height:1.45;}
      .wh75-result.is-visible{display:block;}
      .wh75-health{display:inline-flex;align-items:center;gap:5px;font-weight:950;}
      .wh75-dot{width:8px;height:8px;border-radius:50%;background:var(--wh75-green);}
      .wh75-health.amber .wh75-dot{background:var(--wh75-amber);}.wh75-health.red .wh75-dot{background:var(--wh75-red);}
      .wh75-range-days{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;}
      .wh75-daychip{padding:4px 6px;border-radius:999px;background:var(--wh75-bg);border:1px solid var(--wh75-line);font-size:6.5px;font-weight:850;color:var(--wh75-muted);}
      .wh75-note{margin-top:8px;padding:7px 8px;border-radius:9px;background:color-mix(in srgb,var(--wh75-purple) 7%,var(--wh75-soft));color:var(--wh75-muted);font-size:7px;line-height:1.4;}
      .wh75-modal{position:fixed;inset:0;z-index:2147482000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.68);box-sizing:border-box;}
      .wh75-modal.is-open{display:flex;}
      .wh75-modal-card{width:min(720px,100%);max-height:min(760px,92vh);overflow:auto;border:1px solid var(--wh75-line);border-radius:18px;background:var(--wh75-bg);color:var(--wh75-text);box-shadow:0 26px 80px rgba(2,6,23,.35);}
      .wh75-modal-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--wh75-line);background:var(--wh75-bg);}
      .wh75-modal-title{font-size:15px;font-weight:950;}.wh75-modal-sub{margin-top:3px;color:var(--wh75-muted);font-size:8px;}
      .wh75-close{width:34px;height:34px;border:1px solid var(--wh75-line);border-radius:10px;background:var(--wh75-soft);color:var(--wh75-text);cursor:pointer;font-size:16px;}
      .wh75-modal-body{padding:15px 16px 18px;}.wh75-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .wh75-modal-grid .wide{grid-column:1/-1;}
      @media(max-width:900px){.wh75-grid{grid-template-columns:1fr;}.wh75-card-copy{min-height:0;}.wh75-list{max-height:none;}}
      @media(max-width:600px){#${ROOT_ID}{border-radius:14px}.wh75-head{padding:12px;}.wh75-title{font-size:14px;}.wh75-grid{padding:10px;gap:9px;}.wh75-card{padding:11px;}.wh75-row,.wh75-modal-grid{grid-template-columns:1fr;}.wh75-modal-grid .wide{grid-column:auto;}.wh75-preview-pill{display:none;}.wh75-modal{padding:8px;}.wh75-modal-card{border-radius:14px;}}
    `;
    document.head.appendChild(style);
  }

  function runSheetHtml() {
    const tasks = todayTasks();
    const state = checklistState();
    if (!tasks.length) return '<div class="wh75-empty">Nothing operational is scheduled today from the current Calendar data.</div>';
    return `<div class="wh75-list">${tasks.map(task => `
      <label class="wh75-task">
        <input type="checkbox" data-wh75-task="${escapeHtml(task.id)}" ${state[task.id] ? 'checked' : ''}>
        <span><span class="wh75-task-label">${escapeHtml(task.icon)} ${escapeHtml(task.label)}</span><span class="wh75-task-meta">${escapeHtml(task.meta)}</span></span>
      </label>`).join('')}</div>`;
  }

  function renderRoot(root) {
    const draft = ownerDraft();
    root.innerHTML = `
      <div class="wh75-head">
        <div><div class="wh75-eyebrow">Independent sitter toolkit</div><div class="wh75-title">Three features to test before we commit</div><div class="wh75-sub">Built around the sitter’s work after a Pawshake, Mad Paws or other marketplace enquiry arrives. This preview reads existing Calendar data and keeps drafts/checklist state locally.</div></div>
        <div class="wh75-preview-pill">PREVIEW · REVERSIBLE</div>
      </div>
      <div class="wh75-grid">
        <article class="wh75-card" data-wh75-card="today">
          <div class="wh75-card-top"><div class="wh75-icon">✅</div><div><div class="wh75-card-kicker">1 · Run the day</div><div class="wh75-card-title">Today Run Sheet</div></div></div>
          <p class="wh75-card-copy">One checklist generated from who is staying, arriving, leaving and meeting you today.</p>
          <div data-wh75-run-sheet>${runSheetHtml()}</div>
        </article>

        <article class="wh75-card" data-wh75-card="enquiry">
          <div class="wh75-card-top"><div class="wh75-icon">⚡</div><div><div class="wh75-card-kicker">2 · Decide quickly</div><div class="wh75-card-title">Quick Enquiry + Capacity</div></div></div>
          <p class="wh75-card-copy">Enter only what you normally get from a marketplace message. Waffle checks the date range against confirmed stays before you decide.</p>
          <div class="wh75-form">
            <div class="wh75-row"><div class="wh75-field"><label for="wh75PetName">Pet</label><input id="wh75PetName" class="wh75-input" placeholder="Coco"></div><div class="wh75-field"><label for="wh75Source">Source</label><select id="wh75Source" class="wh75-select"><option>Pawshake</option><option>Mad Paws</option><option>Other</option></select></div></div>
            <div class="wh75-row"><div class="wh75-field"><label for="wh75Start">Start</label><input id="wh75Start" class="wh75-input" type="date"></div><div class="wh75-field"><label for="wh75End">End</label><input id="wh75End" class="wh75-input" type="date"></div></div>
          </div>
          <div class="wh75-actions"><button type="button" class="wh75-btn primary" data-wh75-check>Check capacity</button><button type="button" class="wh75-btn" data-wh75-copy-enquiry>Copy summary</button></div>
          <div class="wh75-result" data-wh75-result></div>
          <div class="wh75-note">Preview only: this does not create a Potential Stay yet. If you approve the workflow, the next version can hand the checked details into the existing Potential Stay flow.</div>
        </article>

        <article class="wh75-card" data-wh75-card="owner">
          <div class="wh75-card-top"><div class="wh75-icon">🐶</div><div><div class="wh75-card-kicker">3 · Stop retyping care info</div><div class="wh75-card-title">Owner Self-Service Care Form</div></div></div>
          <p class="wh75-card-copy">Preview the questions an owner would confirm before a stay. Returning dogs can reuse their existing profile and only update what changed.</p>
          <div class="wh75-note">${draft.dogName ? `Draft saved for <strong>${escapeHtml(draft.dogName)}</strong>.` : 'No draft yet. Open the form to test the owner experience.'}</div>
          <div class="wh75-actions"><button type="button" class="wh75-btn purple" data-wh75-open-owner>Preview owner form</button><button type="button" class="wh75-btn" data-wh75-copy-owner>Copy questions</button></div>
          <div class="wh75-note">A real public owner link is deliberately not enabled in this preview. That would require a small backend endpoint and permission model once you approve the form.</div>
        </article>
      </div>`;
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    const calendar = document.getElementById('wh65Calendar') || document.getElementById('calendar');
    if (!calendar?.parentElement) return null;
    root = document.createElement('section');
    root.id = ROOT_ID;
    root.setAttribute('aria-label', 'Independent sitter toolkit preview');
    calendar.parentElement.insertBefore(root, calendar);
    renderRoot(root);
    return root;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const draft = ownerDraft();
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'wh75-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Owner care form preview');
    modal.innerHTML = `
      <div class="wh75-modal-card">
        <div class="wh75-modal-head"><div><div class="wh75-modal-title">Owner Care Form · Preview</div><div class="wh75-modal-sub">What the owner would confirm before their dog stays with you.</div></div><button type="button" class="wh75-close" data-wh75-close aria-label="Close">×</button></div>
        <form class="wh75-modal-body" data-wh75-owner-form>
          <div class="wh75-modal-grid">
            <div class="wh75-field"><label>Dog name</label><input class="wh75-input" name="dogName" value="${escapeHtml(draft.dogName || '')}" placeholder="Coco"></div>
            <div class="wh75-field"><label>Owner name</label><input class="wh75-input" name="ownerName" value="${escapeHtml(draft.ownerName || '')}" placeholder="Owner name"></div>
            <div class="wh75-field wide"><label>Feeding routine</label><textarea class="wh75-textarea" name="feeding" placeholder="Food, amount, times, treats">${escapeHtml(draft.feeding || '')}</textarea></div>
            <div class="wh75-field"><label>Medication</label><textarea class="wh75-textarea" name="medication" placeholder="Medication, dose, timing">${escapeHtml(draft.medication || '')}</textarea></div>
            <div class="wh75-field"><label>Allergies / health</label><textarea class="wh75-textarea" name="health" placeholder="Allergies, conditions, restrictions">${escapeHtml(draft.health || '')}</textarea></div>
            <div class="wh75-field"><label>Behaviour & social</label><textarea class="wh75-textarea" name="behaviour" placeholder="Other dogs, people, triggers, separation">${escapeHtml(draft.behaviour || '')}</textarea></div>
            <div class="wh75-field"><label>Sleeping routine</label><textarea class="wh75-textarea" name="sleeping" placeholder="Bed, crate, room, overnight routine">${escapeHtml(draft.sleeping || '')}</textarea></div>
            <div class="wh75-field"><label>Walking routine</label><textarea class="wh75-textarea" name="walking" placeholder="Frequency, lead rules, recall">${escapeHtml(draft.walking || '')}</textarea></div>
            <div class="wh75-field"><label>Emergency / vet</label><textarea class="wh75-textarea" name="emergency" placeholder="Emergency contact and vet details">${escapeHtml(draft.emergency || '')}</textarea></div>
            <div class="wh75-field wide"><label>Anything else I should know?</label><textarea class="wh75-textarea" name="notes" placeholder="Quirks, routines, comforts, household rules">${escapeHtml(draft.notes || '')}</textarea></div>
          </div>
          <div class="wh75-actions"><button class="wh75-btn purple" type="submit">Save preview draft</button><button class="wh75-btn" type="button" data-wh75-copy-owner>Copy questions</button></div>
          <div class="wh75-note">Nothing is sent to an owner in this preview. Saved answers stay only in this browser so you can judge the workflow safely.</div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function ownerQuestionText() {
    return [
      'Waffle Boarding House — Care Form',
      '',
      'Dog name:',
      'Owner name:',
      'Feeding routine (food, amount, times, treats):',
      'Medication (name, dose, timing):',
      'Allergies / health conditions / restrictions:',
      'Behaviour with dogs, people and known triggers:',
      'Sleeping routine:',
      'Walking routine and lead/recall rules:',
      'Emergency contact and vet:',
      'Anything else I should know?'
    ].join('\n');
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const old = button?.textContent;
      if (button) {
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = old || 'Copy'; }, 1200);
      }
    } catch (_) {
      window.prompt('Copy this text:', text);
    }
  }

  function handleCapacityCheck(root) {
    const pet = String(root.querySelector('#wh75PetName')?.value || '').trim() || 'Pet';
    const source = String(root.querySelector('#wh75Source')?.value || '').trim() || 'Marketplace';
    const start = String(root.querySelector('#wh75Start')?.value || '');
    const end = String(root.querySelector('#wh75End')?.value || '');
    const result = root.querySelector('[data-wh75-result]');
    if (!result) return;

    const range = rangeCapacity(start, end);
    if (!range) {
      result.className = 'wh75-result is-visible';
      result.innerHTML = 'Choose a valid start and end date first.';
      return;
    }

    const health = range.health;
    const dayChips = range.days.slice(0, 14).map(day => {
      const date = parseIso(day.iso);
      const label = date ? date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : day.iso;
      return `<span class="wh75-daychip">${escapeHtml(label)} · ${day.count}</span>`;
    }).join('');
    const extra = range.days.length > 14 ? `<span class="wh75-daychip">+${range.days.length - 14} days</span>` : '';
    result.className = 'wh75-result is-visible';
    result.dataset.health = health.key;
    result.innerHTML = `<div class="wh75-health ${health.key}"><span class="wh75-dot"></span>${escapeHtml(health.label)} capacity</div><div style="margin-top:4px"><strong>${escapeHtml(pet)}</strong> · ${escapeHtml(source)} · peak ${range.peak} confirmed dog${range.peak === 1 ? '' : 's'} during this enquiry.</div><div class="wh75-range-days">${dayChips}${extra}</div>`;
  }

  function enquirySummary(root) {
    const pet = String(root.querySelector('#wh75PetName')?.value || '').trim() || 'Pet';
    const source = String(root.querySelector('#wh75Source')?.value || '').trim() || 'Marketplace';
    const start = String(root.querySelector('#wh75Start')?.value || '').trim() || 'Start TBC';
    const end = String(root.querySelector('#wh75End')?.value || '').trim() || 'End TBC';
    const range = rangeCapacity(start, end);
    const capacity = range ? `${range.health.label} · peak ${range.peak} confirmed` : 'Capacity not checked';
    return `Potential Stay · ${pet}\n${start} → ${end}\nSource: ${source}\nCapacity: ${capacity}`;
  }

  function saveOwnerDraft(form) {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = String(value || '').trim(); });
    try { localStorage.setItem('wh75-owner-care-draft', JSON.stringify(data)); } catch (_) {}
    const modal = document.getElementById(MODAL_ID);
    modal?.classList.remove('is-open');
    const root = document.getElementById(ROOT_ID);
    if (root) renderRoot(root);
  }

  function wireEvents(root) {
    if (root.dataset.wh75Wired === 'true') return;
    root.dataset.wh75Wired = 'true';
    root.addEventListener('change', event => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input?.matches('[data-wh75-task]')) return;
      const state = checklistState();
      state[input.dataset.wh75Task] = input.checked;
      saveChecklistState(state);
    });
    root.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button');
      if (!button) return;
      if (button.matches('[data-wh75-check]')) handleCapacityCheck(root);
      if (button.matches('[data-wh75-copy-enquiry]')) copyText(enquirySummary(root), button);
      if (button.matches('[data-wh75-open-owner]')) ensureModal().classList.add('is-open');
      if (button.matches('[data-wh75-copy-owner]')) copyText(ownerQuestionText(), button);
    });
  }

  function wireModal(modal) {
    if (modal.dataset.wh75Wired === 'true') return;
    modal.dataset.wh75Wired = 'true';
    modal.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target === modal || target?.closest('[data-wh75-close]')) modal.classList.remove('is-open');
      const copy = target?.closest('[data-wh75-copy-owner]');
      if (copy) copyText(ownerQuestionText(), copy);
    });
    modal.querySelector('[data-wh75-owner-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      saveOwnerDraft(event.currentTarget);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') modal.classList.remove('is-open');
    });
  }

  function refreshRunSheet() {
    refreshFrame = 0;
    const root = ensureRoot();
    if (!root) return;
    wireEvents(root);
    const runSheet = root.querySelector('[data-wh75-run-sheet]');
    if (runSheet) runSheet.innerHTML = runSheetHtml();
  }

  function scheduleRefresh() {
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(refreshRunSheet);
  }

  function observeCalendar() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => node instanceof Element && (node.id === 'wh65Calendar' || !!node.querySelector?.('#wh65Calendar'))))) {
        scheduleRefresh();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    const root = ensureRoot();
    if (root) wireEvents(root);
    const modal = ensureModal();
    wireModal(modal);
    observeCalendar();
    [60, 180, 450, 900, 1800, 3200, 5200].forEach(delay => setTimeout(scheduleRefresh, delay));
    window.addEventListener('pageshow', scheduleRefresh);
    window.addEventListener('focus', scheduleRefresh);
    window.v11175SitterToolkitPreviewVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
