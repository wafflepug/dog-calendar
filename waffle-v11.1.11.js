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
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
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
    try {
      if (typeof v10EventRawDates === 'function') {
        const dates = v10EventRawDates(eventRecord) || {};
        return {
          start: normaliseDate(dates.start),
          end: normaliseDate(dates.end || dates.start)
        };
      }
    } catch (_) {}
    const props = eventRecord?.extendedProps || {};
    const start = props.rawStartDate || eventRecord?.startStr || eventRecord?.start || '';
    const end = props.rawEndDate || eventRecord?.endStr || eventRecord?.end || start;
    return { start: normaliseDate(start), end: normaliseDate(end || start) };
  }

  function meetName(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    return String(props.dogName || eventRecord?.title || 'Meet & Greet')
      .replace(/^.*Meet & Greet:\s*/i, '')
      .trim() || 'Meet & Greet';
  }

  function meetTime(eventRecord) {
    const props = eventRecord?.extendedProps || {};
    const direct = String(props.time || props.bookingTime || '').trim();
    if (direct) return direct;
    const titleMatch = String(eventRecord?.title || '').match(/(?:^|\s)(\d{1,2}:\d{2})(?:\s|$)/);
    if (titleMatch) return titleMatch[1];
    const noteMatch = String(props.notes || '').match(/\b(\d{1,2}:\d{2})\b/);
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
          index += 1;
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
    const events = [];
    csv.split(/\r?\n/).slice(1).forEach(line => {
      if (!line.trim()) return;
      const columns = parseCsvLine(line);
      if (!/meet\s*&\s*greet/i.test(String(columns[11] || '').trim())) return;
      const dogName = String(columns[1] || '').trim();
      const start = normaliseDate(columns[3]);
      if (!dogName || !start) return;
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
    });
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

    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.getEvents === 'function') {
        candidates.push(...globalCalendar.getEvents());
      }
    } catch (_) {}

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
      // One Meet & Greet per dog/date. Prefer whichever source has richer details.
      const key = [meetName(eventRecord).toLowerCase(), dates.start].join('|');
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
        return dateCompare || meetTime(a).localeCompare(meetTime(b));
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
    let dateText = '';
    if (showDate && dates.start) {
      try {
        dateText = typeof formatStayDateShort === 'function' ? formatStayDateShort(dates.start) : dates.start;
      } catch (_) { dateText = dates.start; }
    }
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
    const host = document.getElementById('v1116MeetGreetListModal')?.querySelector('[data-v1116-meet-sections]');
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
      for (let index = todayMeets.length - 1; index >= 0; index -= 1) {
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
    return String(value || '').replace(/\D+/g, '').length >= 6;
  }

  function phoneFromAttributes(attributes) {
    if (!attributes || typeof attributes !== 'object') return '';
    for (const [key, value] of Object.entries(attributes)) {
      const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const phoneKey = normalized === 'mobile' || normalized.includes('phone') || normalized.includes('contactnumber');
      if (phoneKey && meaningfulPhone(value)) return String(value).trim();
    }
    return '';
  }

  function phoneFromRecord(record) {
    if (!record || typeof record !== 'object') return '';
    const direct = [record.phone, record.contactNumber, record.mobile, record.emergencyPhone].find(meaningfulPhone);
    return direct ? String(direct).trim() : phoneFromAttributes(record.intakeAttributes);
  }

  function cardPhone(card) {
    if (!card) return '';
    const editPhone = card.querySelector('[data-directory-edit-field="phone"]');
    const direct = [
      card.dataset.phone,
      card.dataset.directoryPhone,
      card.dataset.v1088Phone,
      card.dataset.contactNumber,
      card.dataset.directoryContactNumber,
      editPhone?.dataset?.directoryCurrentValue,
      editPhone?.textContent
    ].find(meaningfulPhone);
    if (direct) return String(direct).trim();

    const control = Array.from(card.querySelectorAll('[data-intake-attribute]')).find(item => {
      const key = String(item.dataset.intakeAttribute || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      return (key === 'mobile' || key.includes('phone') || key.includes('contactnumber')) && meaningfulPhone(item.value || item.textContent);
    });
    if (control) return String(control.value || control.textContent || '').trim();

    const stayKey = String(card.dataset.directoryStayKey || card.dataset.stayKey || '');
    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        const fromProfile = phoneFromRecord(directoryProfileDetailCache?.[stayKey]);
        if (fromProfile) return fromProfile;
      }
    } catch (_) {}
    try {
      if (typeof directorySummaryRecordsCache !== 'undefined') {
        const fromSummary = phoneFromRecord(directorySummaryRecordsCache?.[stayKey]);
        if (fromSummary) return fromSummary;
      }
    } catch (_) {}
    return '';
  }

  function removeFalsePhoneSignal(card, knownPhone) {
    const phone = knownPhone || cardPhone(card);
    if (!phone) return false;

    // Make the correction durable: V11.1.8 reads v1088Phone when it decorates again.
    card.dataset.v1088Phone = phone;

    const host = card.querySelector('[data-v1118-care-signals]');
    if (!host) return false;
    const phoneSignals = Array.from(host.querySelectorAll('span[title],span[aria-label]'))
      .filter(signal => /phone missing/i.test(String(signal.title || signal.getAttribute('aria-label') || '')));
    if (!phoneSignals.length) return false;

    phoneSignals.forEach(signal => signal.remove());
    host.hidden = host.children.length === 0;
    if (card.dataset.v11111PhoneScoreAdjusted !== 'true') {
      card.dataset.v11111PhoneScoreAdjusted = 'true';
      card.dataset.v1118PriorityScore = String(Math.max(0, Number(card.dataset.v1118PriorityScore || 0) - PHONE_MISSING_WEIGHT));
    }
    return true;
  }

  function reconcilePhoneSignals() {
    if (pageName() !== 'directory') return;
    document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(card => removeFalsePhoneSignal(card));
  }

  async function hydrateFlaggedPhoneCards() {
    if (pageName() !== 'directory' || typeof window.queryAppsScript !== 'function') return;
    const cards = Array.from(document.querySelectorAll('.directory-card[data-directory-stay-key]'))
      .filter(card => {
        const host = card.querySelector('[data-v1118-care-signals]');
        const flagged = Array.from(host?.querySelectorAll('span[title],span[aria-label]') || [])
          .some(signal => /phone missing/i.test(String(signal.title || signal.getAttribute('aria-label') || '')));
        return flagged && !cardPhone(card) && card.dataset.v11111PhoneLookup !== 'done';
      })
      .slice(0, 6);

    for (const card of cards) {
      const stayKey = String(card.dataset.directoryStayKey || card.dataset.stayKey || '').trim();
      if (!stayKey) continue;
      card.dataset.v11111PhoneLookup = 'done';
      try {
        const response = await window.queryAppsScript(
          { action: 'get_guest_profile', stayKey },
          { maxAttempts: 1, timeoutMs: 20000 }
        );
        const record = response?.record || null;
        const phone = phoneFromRecord(record);
        if (record) {
          try {
            if (typeof directoryProfileDetailCache !== 'undefined') directoryProfileDetailCache[stayKey] = record;
          } catch (_) {}
        }
        if (phone) removeFalsePhoneSignal(card, phone);
      } catch (_) {
        card.dataset.v11111PhoneLookup = 'retry';
      }
    }
  }

  function scheduleCalendarReconcile() {
    [30, 180].forEach(delay => setTimeout(() => {
      fixSearchButton();
      reconcileMeetPriority();
      renderRobustMeetModal();
    }, delay));
  }

  function scheduleDirectoryReconcile() {
    setTimeout(() => {
      reconcilePhoneSignals();
      hydrateFlaggedPhoneCards().catch(() => {});
    }, 50);
    [500, 1800, 4500].forEach(delay => setTimeout(reconcilePhoneSignals, delay));
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
