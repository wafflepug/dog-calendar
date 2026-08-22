/* ============================================================
   WAFFLE HOUSE V11.1.11 — MEET DATA RESILIENCE + HEADER/PHONE FIXES
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.11';
  const PHONE_MISSING_WEIGHT = 55;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    if (typeof window.escapeDashboardHtml === 'function') {
      return window.escapeDashboardHtml(value == null ? '' : String(value));
    }
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localToday() {
    if (typeof window.getLocalTodayDateString === 'function') {
      try { return window.getLocalTodayDateString(); } catch (_) {}
    }
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function normaliseDate(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const au = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (au) return `${au[3]}-${String(au[2]).padStart(2, '0')}-${String(au[1]).padStart(2, '0')}`;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text.slice(0, 10);
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function eventDates(eventRecord) {
    if (typeof window.v10EventRawDates === 'function') {
      try {
        const dates = window.v10EventRawDates(eventRecord) || {};
        return {
          start: normaliseDate(dates.start),
          end: normaliseDate(dates.end || dates.start)
        };
      } catch (_) {}
    }
    const props = eventRecord?.extendedProps || {};
    const start = props.rawStartDate || eventRecord?.startStr || eventRecord?.start || '';
    const end = props.rawEndDate || eventRecord?.endStr || eventRecord?.end || start;
    return { start: normaliseDate(start), end: normaliseDate(end || start) };
  }

  function meetName(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    return String(props.dogName || eventRecord?.title || 'Meet & Greet')
      .replace(/^.*Meet & Greet:\s*/i, '')
      .replace(/^.*-\s*/, match => /meet/i.test(match) ? '' : match)
      .trim() || 'Meet & Greet';
  }

  function meetTime(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    const direct = String(props.time || props.bookingTime || '').trim();
    if (direct) return direct;
    const title = String(eventRecord?.title || '');
    const titleMatch = title.match(/(?:^|\s)(\d{1,2}:\d{2})(?:\s|$)/);
    if (titleMatch) return titleMatch[1];
    const notes = String(props.notes || '');
    const noteMatch = notes.match(/\b(\d{1,2}:\d{2})\b/);
    return noteMatch ? noteMatch[1] : '';
  }

  function isMeet(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    return props.isMeetGreet === true || /meet\s*&\s*greet/i.test(String(props.bookingType || ''));
  }

  function parseCsvLine(line) {
    const values = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (char === ',' && !quoted) {
        values.push(value.trim());
        value = '';
        continue;
      }
      value += char;
    }
    values.push(value.trim());
    return values;
  }

  function cachedSpreadsheetMeetEvents() {
    const csv = String(localStorage.getItem('boardingDataCache') || '');
    if (!csv) return [];
    const rows = csv.split(/\r?\n/);
    const events = [];
    for (let index = 1; index < rows.length; index++) {
      if (!rows[index].trim()) continue;
      const columns = parseCsvLine(rows[index]);
      const bookingType = String(columns[11] || '').trim();
      if (!/meet\s*&\s*greet/i.test(bookingType)) continue;
      const dogName = String(columns[1] || '').trim();
      const start = normaliseDate(columns[3]);
      if (!dogName || !start) continue;
      const notes = String(columns[9] || '').trim();
      const timeMatch = notes.match(/\b(\d{1,2}:\d{2})\b/);
      events.push({
        title: dogName,
        startStr: start,
        endStr: normaliseDate(columns[4] || start),
        extendedProps: {
          isMeetGreet: true,
          bookingType: 'Meet & Greet',
          dogName,
          breed: String(columns[2] || '').trim(),
          ownerName: String(columns[5] || '').trim(),
          phone: String(columns[6] || '').trim(),
          notes,
          time: timeMatch ? timeMatch[1] : ''
        }
      });
    }
    return events;
  }

  function temporaryMeetEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem('temporaryMeetGreets') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function eventRichness(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    return [props.breed, props.ownerName || props.owner, props.phone, props.notes, meetTime(eventRecord)]
      .filter(value => String(value || '').trim()).length;
  }

  function robustMeetEvents() {
    const candidates = [];
    if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') {
      try { candidates.push(...window.globalCalendar.getEvents()); } catch (_) {}
    }
    try {
      if (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)) {
        candidates.push(...v110LatestCalendarEvents);
      }
    } catch (_) {}
    candidates.push(...temporaryMeetEvents());
    candidates.push(...cachedSpreadsheetMeetEvents());

    const unique = new Map();
    candidates.forEach(eventRecord => {
      if (!eventRecord || !isMeet(eventRecord)) return;
      const dates = eventDates(eventRecord);
      if (!dates.start) return;
      const key = [meetName(eventRecord).toLowerCase(), dates.start, meetTime(eventRecord)].join('|');
      const existing = unique.get(key);
      if (!existing || eventRichness(eventRecord) > eventRichness(existing)) unique.set(key, eventRecord);
    });
    return Array.from(unique.values());
  }

  function meetWindow() {
    const today = localToday();
    const lastDay = addDays(today, 30);
    const all = robustMeetEvents()
      .filter(eventRecord => {
        const start = eventDates(eventRecord).start;
        return start && start >= today && start <= lastDay;
      })
      .sort((a, b) => {
        const dateCompare = eventDates(a).start.localeCompare(eventDates(b).start);
        if (dateCompare) return dateCompare;
        return meetTime(a).localeCompare(meetTime(b));
      });
    return {
      today,
      todayEvents: all.filter(eventRecord => eventDates(eventRecord).start === today),
      upcomingEvents: all.filter(eventRecord => eventDates(eventRecord).start > today)
    };
  }

  function meetRowHtml(eventRecord, showDate) {
    const dates = eventDates(eventRecord);
    const props = eventRecord?.extendedProps || {};
    const dateText = showDate && dates.start
      ? (typeof window.formatStayDateShort === 'function' ? window.formatStayDateShort(dates.start) : dates.start)
      : '';
    return `
      <article class="v1116-meet-row">
        <div class="v1116-meet-date">
          <strong>${esc(dateText || 'Today')}</strong>
          <span>${esc(meetTime(eventRecord) || 'Time not recorded')}</span>
        </div>
        <div class="v1116-meet-copy">
          <strong>${esc(meetName(eventRecord))}</strong>
          <span>${esc(String(props.breed || '').trim() || 'Breed not recorded')}</span>
        </div>
      </article>`;
  }

  function meetSectionHtml(title, events, showDate, emptyCopy) {
    return `
      <section class="v1116-meet-section">
        <div class="v1116-meet-section-head"><h4>${esc(title)}</h4><span>${events.length}</span></div>
        <div class="v1116-meet-list">
          ${events.length ? events.map(eventRecord => meetRowHtml(eventRecord, showDate)).join('') : `<div class="v1116-meet-empty">${esc(emptyCopy)}</div>`}
        </div>
      </section>`;
  }

  function renderRobustMeetModal() {
    if (pageName() !== 'calendar') return;
    const modal = document.getElementById('v1116MeetGreetListModal');
    const host = modal?.querySelector('[data-v1116-meet-sections]');
    if (!host) return;
    const data = meetWindow();
    host.innerHTML =
      meetSectionHtml('Today', data.todayEvents, false, 'No Meet & Greets scheduled today.') +
      meetSectionHtml('Next 30 Days', data.upcomingEvents, true, 'No upcoming Meet & Greets in the next 30 days.');
  }

  function attentionMeetHtml(eventRecord) {
    const time = meetTime(eventRecord);
    return `
      <div class="v1118-attention-item v11110-informational v11111-meet-informational" role="note" data-v11111-meet-priority>
        <span class="v1118-attention-icon">🤝</span>
        <span><strong>${esc(meetName(eventRecord))}</strong><small>${esc(`Meet & Greet today${time ? ` · ${time}` : ''}`)}</small></span>
        <span class="v11111-no-action" aria-hidden="true"></span>
      </div>`;
  }

  function reconcileMeetPriority() {
    if (pageName() !== 'calendar') return;
    const panel = document.getElementById('v1118AttentionPanel');
    const host = panel?.querySelector('[data-v1118-attention-list]');
    if (!panel || !host) return;

    host.querySelectorAll('.v1118-attention-item').forEach(item => {
      const meta = String(item.querySelector('small')?.textContent || '').trim();
      if (/^Meet & Greet today\b/i.test(meta)) item.remove();
    });

    const todayMeets = meetWindow().todayEvents;
    if (todayMeets.length) {
      host.querySelector('.v1118-attention-clear')?.remove();
      for (let index = todayMeets.length - 1; index >= 0; index--) {
        host.insertAdjacentHTML('afterbegin', attentionMeetHtml(todayMeets[index]));
      }
    }

    const count = host.querySelectorAll('.v1118-attention-item').length;
    const countEl = panel.querySelector('[data-v1118-attention-count]');
    if (countEl) countEl.textContent = String(count);
    panel.classList.toggle('is-clear', count === 0);
  }

  function fixSearchButton() {
    document.querySelectorAll('.v1118-global-search-button').forEach(button => {
      button.querySelector('.v1118-search-button-label')?.remove();
      button.classList.add('v11111-search-icon-only');
      button.setAttribute('aria-label', 'Search');
      button.title = 'Search';
    });
  }

  function meaningfulPhone(value) {
    const digits = String(value || '').replace(/\D+/g, '');
    return digits.length >= 6;
  }

  function profileAttributesHavePhone(attributes) {
    if (!attributes || typeof attributes !== 'object') return false;
    return Object.entries(attributes).some(([key, value]) => {
      const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const phoneKey = normalized === 'mobile' || normalized.includes('phone') || normalized.includes('contactnumber');
      return phoneKey && meaningfulPhone(value);
    });
  }

  function cardHasKnownPhone(card) {
    if (!card) return false;
    const editPhone = card.querySelector('[data-directory-edit-field="phone"]');
    const directValues = [
      card.dataset.phone,
      card.dataset.directoryPhone,
      card.dataset.v1088Phone,
      card.dataset.contactNumber,
      card.dataset.directoryContactNumber,
      editPhone?.dataset?.directoryCurrentValue,
      editPhone?.textContent
    ];
    if (directValues.some(meaningfulPhone)) return true;

    const controls = Array.from(card.querySelectorAll('[data-intake-attribute]'));
    if (controls.some(control => {
      const key = String(control.dataset.intakeAttribute || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      return (key === 'mobile' || key.includes('phone') || key.includes('contactnumber')) && meaningfulPhone(control.value || control.textContent);
    })) return true;

    const stayKey = String(card.dataset.directoryStayKey || card.dataset.stayKey || '');
    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        const record = directoryProfileDetailCache?.[stayKey];
        if (meaningfulPhone(record?.phone) || profileAttributesHavePhone(record?.intakeAttributes)) return true;
      }
    } catch (_) {}
    try {
      if (typeof directorySummaryRecordsCache !== 'undefined') {
        const record = directorySummaryRecordsCache?.[stayKey];
        if (meaningfulPhone(record?.phone) || profileAttributesHavePhone(record?.intakeAttributes)) return true;
      }
    } catch (_) {}
    return false;
  }

  function removeFalsePhoneSignal(card) {
    if (!cardHasKnownPhone(card)) return false;
    const host = card.querySelector('[data-v1118-care-signals]');
    if (!host) return false;
    const phoneSignals = Array.from(host.querySelectorAll('span[title],span[aria-label]'))
      .filter(signal => /phone missing/i.test(String(signal.title || signal.getAttribute('aria-label') || '')));
    if (!phoneSignals.length) return false;
    phoneSignals.forEach(signal => signal.remove());
    host.hidden = host.children.length === 0;
    const score = Number(card.dataset.v1118PriorityScore || 0);
    card.dataset.v1118PriorityScore = String(Math.max(0, score - PHONE_MISSING_WEIGHT * phoneSignals.length));
    return true;
  }

  function reconcilePhoneSignals() {
    if (pageName() !== 'directory') return;
    document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(removeFalsePhoneSignal);
  }

  async function hydrateFlaggedPhoneCards() {
    if (pageName() !== 'directory' || typeof window.queryAppsScript !== 'function') return;
    const cards = Array.from(document.querySelectorAll('.directory-card[data-directory-stay-key]'))
      .filter(card => {
        const host = card.querySelector('[data-v1118-care-signals]');
        const flagged = Array.from(host?.querySelectorAll('span[title],span[aria-label]') || [])
          .some(signal => /phone missing/i.test(String(signal.title || signal.getAttribute('aria-label') || '')));
        return flagged && !cardHasKnownPhone(card) && card.dataset.v11111PhoneLookup !== 'done';
      })
      .slice(0, 6);

    for (const card of cards) {
      const stayKey = String(card.dataset.directoryStayKey || card.dataset.stayKey || '').trim();
      if (!stayKey) continue;
      card.dataset.v11111PhoneLookup = 'done';
      try {
        const response = await window.queryAppsScript({ action: 'get_guest_profile', stayKey }, { maxAttempts: 1, timeoutMs: 20000 });
        const record = response?.record || null;
        if (record) {
          try {
            if (typeof directoryProfileDetailCache !== 'undefined') directoryProfileDetailCache[stayKey] = record;
          } catch (_) {}
          if (meaningfulPhone(record.phone) || profileAttributesHavePhone(record.intakeAttributes)) removeFalsePhoneSignal(card);
        }
      } catch (_) {
        card.dataset.v11111PhoneLookup = 'retry';
      }
    }
  }

  function scheduleCalendarReconcile() {
    setTimeout(() => {
      fixSearchButton();
      reconcileMeetPriority();
      renderRobustMeetModal();
    }, 30);
    setTimeout(() => {
      reconcileMeetPriority();
      renderRobustMeetModal();
    }, 180);
  }

  function scheduleDirectoryReconcile() {
    setTimeout(() => {
      reconcilePhoneSignals();
      hydrateFlaggedPhoneCards().catch(() => {});
    }, 50);
    setTimeout(reconcilePhoneSignals, 500);
  }

  function wrapOperationsRender() {
    const base = window.renderV10OperationsHome;
    if (typeof base !== 'function' || base.v11111MeetResilienceWrapped) return;
    const wrapped = function () {
      const result = base.apply(this, arguments);
      scheduleCalendarReconcile();
      return result;
    };
    wrapped.v11111MeetResilienceWrapped = true;
    wrapped.v11110MeetPriorityWrapped = base.v11110MeetPriorityWrapped;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.renderV10OperationsHome = wrapped;
  }

  function wrapDirectoryRenderer() {
    const base = window.applyGuestDirectoryResponse;
    if (typeof base !== 'function' || base.v11111PhoneWrapped) return;
    const wrapped = function () {
      const result = base.apply(this, arguments);
      scheduleDirectoryReconcile();
      return result;
    };
    wrapped.v11111PhoneWrapped = true;
    wrapped.v1119PastCheckoutWrapped = base.v1119PastCheckoutWrapped;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.applyGuestDirectoryResponse = wrapped;
  }

  function wrapProfileRenderer() {
    const base = window.renderDirectoryIntakeAttributes;
    if (typeof base !== 'function' || base.v11111PhoneWrapped) return;
    const wrapped = function (card) {
      const result = base.apply(this, arguments);
      if (card) setTimeout(() => removeFalsePhoneSignal(card), 20);
      return result;
    };
    wrapped.v11111PhoneWrapped = true;
    window.renderDirectoryIntakeAttributes = wrapped;
  }

  function wireLifecycle() {
    if (window.v11111LifecycleWired) return;
    window.v11111LifecycleWired = true;

    document.addEventListener('click', event => {
      if (pageName() === 'calendar' && event.target.closest('[data-v10-jump="meet"]')) {
        setTimeout(renderRobustMeetModal, 0);
        setTimeout(renderRobustMeetModal, 100);
      }
      if (pageName() === 'directory' && event.target.closest('.directory-card,[data-directory-edit-field="phone"]')) {
        scheduleDirectoryReconcile();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (pageName() === 'calendar') scheduleCalendarReconcile();
      if (pageName() === 'directory') scheduleDirectoryReconcile();
    });

    window.addEventListener('focus', () => {
      if (pageName() === 'calendar') scheduleCalendarReconcile();
      if (pageName() === 'directory') scheduleDirectoryReconcile();
    });
    window.addEventListener('pageshow', () => {
      if (pageName() === 'calendar') scheduleCalendarReconcile();
      if (pageName() === 'directory') scheduleDirectoryReconcile();
    });
  }

  function init() {
    wrapOperationsRender();
    wrapDirectoryRenderer();
    wrapProfileRenderer();
    wireLifecycle();
    fixSearchButton();
    if (pageName() === 'calendar') scheduleCalendarReconcile();
    if (pageName() === 'directory') scheduleDirectoryReconcile();

    setTimeout(() => {
      wrapOperationsRender();
      wrapDirectoryRenderer();
      wrapProfileRenderer();
      fixSearchButton();
      if (pageName() === 'calendar') scheduleCalendarReconcile();
      if (pageName() === 'directory') scheduleDirectoryReconcile();
    }, 700);

    window.WAFFLE_V11111 = {
      version: VERSION,
      robustMeetEvents,
      reconcileMeetPriority,
      renderRobustMeetModal,
      reconcilePhoneSignals
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
