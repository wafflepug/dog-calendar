const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const helperStart = source.indexOf('    const directorySummaryHtmlState =');
const helperEnd = source.indexOf('    function renderDirectoryCareBrief(', helperStart);
const digitalStart = source.indexOf('    function setDirectoryIntakeStatus(');
const digitalEnd = source.indexOf('    function renderDirectoryCareBriefForStay(', digitalStart);
const legacyStart = source.indexOf('    function setDirectoryLegacyIntakeStatus(');
const legacyEnd = source.indexOf('    async function hydrateDirectoryLegacyIntakes(', legacyStart);
const summaryCode = source.slice(helperStart, helperEnd) + source.slice(digitalStart, digitalEnd) + source.slice(legacyStart, legacyEnd);

test('canonical aggregate skips identical writes and distinguishes unavailable safety', async ({ page }) => {
  const ai = fs.readFileSync('waffle-ai.js', 'utf8');
  const start = ai.indexOf('  function renderCanonicalCareSummary() {');
  const end = ai.indexOf('  function queueCareSummary()', start);
  await page.setContent('<span id="directory-care-summary"></span><div id="directory-grid"><article class="directory-card"><div class="directory-care-strip has-alerts"><span data-directory-care-alert>Allergy</span></div></article></div>');
  await page.addScriptTag({ content: `
    function isDirectory() { return true; }
    function currentGrid() { return document.getElementById('directory-grid'); }
    function currentCards() { return [...document.querySelectorAll('.directory-card')]; }
    function directoryIsVisiblyLoading() { return false; }
    ${ai.slice(start, end)}
    window.updateAggregate = renderCanonicalCareSummary;
  ` });
  const result = await page.evaluate(() => {
    const summary = document.getElementById('directory-care-summary');
    updateAggregate();
    const text = summary.firstChild;
    const observer = new MutationObserver(() => {});
    observer.observe(summary, { subtree: true, childList: true, attributes: true, characterData: true });
    updateAggregate();
    const identical = observer.takeRecords().length === 0 && summary.firstChild === text;
    const strip = document.querySelector('.directory-care-strip');
    strip.classList.remove('has-alerts');
    strip.innerHTML = '<div class="directory-record-error">Unavailable</div>';
    updateAggregate();
    const unavailable = summary.textContent === 'Safety status unavailable';
    strip.replaceChildren();
    updateAggregate();
    return { identical, unavailable, clear: summary.textContent === 'No active care alerts' };
  });
  expect(result).toEqual({ identical: true, unavailable: true, clear: true });
});

test('identical digital and legacy summaries retain action nodes and transient failure feedback', async ({ page }) => {
  await page.setContent(`
    <article class="directory-card" data-directory-dog-name="Milo">
      <div data-directory-intake="stay-a"></div>
      <div data-directory-legacy="stay-a"></div>
    </article>
  `);
  await page.addScriptTag({ content: `
    function getStoredDigitalProfileIntakeStatus() { return null; }
    function escapeDashboardHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
    function formatAuditTimestamp(value) { return String(value); }
    function applyDirectoryIntakeMethodVisibility() {}
    function renderDirectoryCareBriefForStay() {}
    ${summaryCode}
    window.setDirectoryIntakeStatus = setDirectoryIntakeStatus;
    window.setDirectoryLegacyIntakeStatus = setDirectoryLegacyIntakeStatus;
  ` });
  const result = await page.evaluate(() => {
    const digital = document.querySelector('[data-directory-intake]');
    const legacy = document.querySelector('[data-directory-legacy]');
    const digitalChanges = [];
    const legacyChanges = [];
    const digitalObserver = new MutationObserver(records => digitalChanges.push(...records));
    const legacyObserver = new MutationObserver(records => legacyChanges.push(...records));
    digitalObserver.observe(digital, { childList: true, subtree: true });
    legacyObserver.observe(legacy, { childList: true, subtree: true });
    const intake = { status: 'Complete', submittedAt: '2026-10-15', pdfUrl: 'https://example.test/intake.pdf', token: 'token-a' };
    const documents = { count: 1, latest: { uploadedAt: '2026-10-15', aiStatus: 'Complete', pdfUrl: 'https://example.test/legacy.pdf', documentId: 'doc-a' } };
    setDirectoryIntakeStatus('stay-a', intake);
    setDirectoryLegacyIntakeStatus('stay-a', documents);
    const digitalAction = digital.querySelector('[data-create-intake-link]');
    const legacyAction = legacy.querySelector('[data-reassign-legacy-intake]');
    if (!digitalAction || !legacyAction) throw new Error('Expected both generated intake actions to exist');
    const failure = document.createElement('span');
    failure.dataset.legacyRefreshFailure = '';
    failure.textContent = 'Could not refresh. Showing previously available document.';
    legacy.append(failure);
    digitalChanges.length = 0;
    legacyChanges.length = 0;
    digitalObserver.takeRecords();
    legacyObserver.takeRecords();
    setDirectoryIntakeStatus('stay-a', intake);
    setDirectoryLegacyIntakeStatus('stay-a', documents);
    const sameRetained = digital.querySelector('[data-create-intake-link]') === digitalAction
      && legacy.querySelector('[data-reassign-legacy-intake]') === legacyAction
      && legacy.querySelector('[data-legacy-refresh-failure]') === failure;
    const unchangedMutations = {
      digital: digitalChanges.length + digitalObserver.takeRecords().length,
      legacy: legacyChanges.length + legacyObserver.takeRecords().length
    };
    const changed = { ...intake, pdfUrl: 'https://example.test/new-intake.pdf' };
    setDirectoryIntakeStatus('stay-a', changed);
    const digitalUpdated = digital.querySelector('[href="https://example.test/new-intake.pdf"]') !== null;
    const changedDocuments = { ...documents, count: 2, latest: { ...documents.latest, documentId: 'doc-b' } };
    setDirectoryLegacyIntakeStatus('stay-a', changedDocuments);
    const legacyUpdated = legacy.querySelector('[data-legacy-document-id="doc-b"]') !== null;
    return { digitalSame: digital.querySelector(`[data-create-intake-link]`) === digitalAction, legacySame: legacy.querySelector(`[data-reassign-legacy-intake]`) === legacyAction, failureSame: legacy.querySelector(`[data-legacy-refresh-failure]`) === failure, sameRetained, unchangedMutations, digitalUpdated, legacyUpdated, failureRetained: legacy.querySelector('[data-legacy-refresh-failure]') === failure };
  });
  expect(result.sameRetained).toBe(true);
  expect(result.unchangedMutations).toEqual({ digital: 0, legacy: 0 });
  expect(result.digitalUpdated).toBe(true);
  expect(result.legacyUpdated).toBe(true);
  expect(result.failureRetained).toBe(true);
});

test('Care brief repeated rendering keeps DOM hosts and produces no DOM mutations', async ({ page }) => {
  await page.setContent(`
    <article class="directory-card" data-stay-key="stay-a" data-directory-stay-key="stay-a" data-v1088OwnerName="Casey" data-v1088Phone="0400000000" data-v1088Notes="handover">
      <div data-directory-intake>Awaiting owner</div>
      <div data-directory-detail="profile" data-profile-read-state="saved"></div>
      <div data-directory-edit-field="notes" data-directory-current-value="handover"></div>
      <div data-directory-edit-field="ownerName" data-directory-current-value="Casey"></div>
      <div data-directory-edit-field="phone" data-directory-current-value="0400000000"></div>
      <section data-directory-care-brief>
        <div data-care-readiness-list>
          <div data-care-readiness-item="intake"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div>
          <div data-care-readiness-item="handover"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div>
        </div>
        <details><summary><span data-care-readiness-summary></span></summary></details>
        <section class="directory-care-brief-safety"><div data-care-brief-safety></div></section>
        <div data-care-brief-owner-name></div><div data-care-brief-feeding></div>
        <div data-care-brief-medication></div><div data-care-brief-freshness></div>
        <div data-care-brief-call-owner></div>
      </section>
    </article>
  `);
  const briefCode = source.slice(helperStart, helperEnd) + source.slice(source.indexOf('    function renderDirectoryCareBrief('), source.indexOf('    function openCareReadinessTarget('));
  const safetyFlagsStart = source.indexOf('    const CARE_SAFETY_FLAGS =');
  const safetyFlags = source.slice(safetyFlagsStart, source.indexOf('    ];', safetyFlagsStart) + 6);
  await page.addScriptTag({ content: `
    ${safetyFlags}
    window.directorySummaryRecordsCache = {};
    window.careRiskRecordsCache = { 'stay-a': { riskFlags: { allergy: true } } };
    window.belongingsRecordsCache = {};
    window.profileRecord = { intakeAttributes: { feedingTimes: 'Morning', medicationInstructions: 'With food' } };
    function getDirectoryProfileReadIdentity() { return { cacheKey: 'identity-a', hasStableIds: false }; }
    function directoryProfileIdentityIsAmbiguous() { return false; }
    function getDirectoryCareBriefRecord() { return window.profileRecord; }
    function getDirectoryValidatedCareProfileRecord() { return window.profileRecord; }
    function getActiveCareFlags(record) { return record?.riskFlags?.allergy ? [{ className: 'is-alert', icon: '⚠️', label: 'Allergy' }] : []; }
    function getDirectoryCareBriefFreshness() { return { text: 'Updated today', state: 'fresh' }; }
    function normalizeDirectoryPhoneForTel(value) { return String(value || '').replace(/[^0-9+]/g, ''); }
    function markDirectoryProfileIdentityConflict() {}
    function escapeDashboardHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
    ${briefCode}
    window.renderDirectoryCareBrief = renderDirectoryCareBrief;
  ` });
  const result = await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const brief = card.querySelector('[data-directory-care-brief]');
    const changes = [];
    const observer = new MutationObserver(records => changes.push(...records));
    observer.observe(brief, { subtree: true, childList: true, characterData: true, attributes: true });
    renderDirectoryCareBrief(card);
    observer.takeRecords();
    changes.length = 0;
    const beforeNodes = [brief, ...brief.querySelectorAll('*')];
    const safetyAlert = brief.querySelector('.care-brief-alert');
    const callAction = brief.querySelector('[data-care-brief-call-owner]').firstElementChild;
    renderDirectoryCareBrief(card);
    const unchangedMutations = changes.length + observer.takeRecords().length;
    const afterNodes = [brief, ...brief.querySelectorAll('*')];
    const stableNodes = beforeNodes.length === afterNodes.length
      && beforeNodes.every((node, index) => afterNodes[index] === node)
      && brief.querySelector('.care-brief-alert') === safetyAlert
      && brief.querySelector('[data-care-brief-call-owner]').firstElementChild === callAction;
    window.profileRecord.intakeAttributes.feedingTimes = 'Evening';
    window.careRiskRecordsCache['stay-a'].riskFlags.allergy = false;
    renderDirectoryCareBrief(card);
    return {
      unchangedMutations,
      stableNodes,
      feedingUpdated: brief.querySelector('[data-care-brief-feeding]').textContent.includes('Times: Evening'),
      safetyCleared: brief.querySelector('[data-care-brief-safety]').textContent.includes('No active safety flags'),
      changedMutations: observer.takeRecords().length
    };
  });
  expect(result.unchangedMutations).toBe(0);
  expect(result.stableNodes).toBe(true);
  expect(result.feedingUpdated).toBe(true);
  expect(result.safetyCleared).toBe(true);
  expect(result.changedMutations).toBeGreaterThan(0);
});

test('identical intake overview state avoids repeated attribute mutations', async ({ page }) => {
  await page.setContent(`
    <article class="directory-card" data-intake-method="none">
      <div data-directory-intake="stay-a"></div>
      <div data-directory-legacy="stay-a"></div>
    </article>
  `);
  const start = source.indexOf('    function applyDirectoryIntakeMethodVisibility(');
  const end = source.indexOf('    function setDirectoryIntakeStatus(', start);
  await page.addScriptTag({ content: `
    const directoryIntakeStatusCache = {};
    const directoryLegacyIntakeCache = {};
    function getEffectiveDirectoryDigitalIntakeRecord() { return null; }
    ${source.slice(start, end)}
    window.applyIntakeVisibility = applyDirectoryIntakeMethodVisibility;
  ` });
  const result = await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const records = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(card, { attributes: true, subtree: true });
    // This is the prior unconditional overview assignment, measured against
    // the same real DOM observer and unchanged state.
    card.dataset.intakeMethod = 'none';
    const beforeCount = observer.takeRecords().length;
    applyIntakeVisibility('stay-a');
    const afterCount = observer.takeRecords().length;
    return { beforeCount, afterCount, method: card.dataset.intakeMethod, digitalVisible: !card.querySelector('[data-directory-intake]').hidden, legacyVisible: !card.querySelector('[data-directory-legacy]').hidden };
  });
  expect(result.beforeCount).toBe(1);
  expect(result.afterCount).toBe(0);
  expect(result.method).toBe('none');
  expect(result.digitalVisible).toBe(true);
  expect(result.legacyVisible).toBe(true);
});
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const path = require('node:path');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

function sameNameBookings() {
  return [
    { dogName: 'Twin Pup', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', startDate: '2026-09-17', endDate: '2026-09-20', ownerName: 'Owner A', dogNumber: '#00011' },
    { dogName: 'Twin Pup', dogId: '22222222-2222-4222-8222-222222222222', stayId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', startDate: '2026-09-18', endDate: '2026-09-22', ownerName: 'Owner B', dogNumber: '#00012' }
  ].map((record, index) => ({ ...record, timestamp: '2026-09-18', breed: 'Cavoodle', phone: '0400000000', notes: '', bookingType: 'Boarding', dogNumber: record.dogNumber, index }));
}

async function installSameNameRefreshFixture(page, bookings) {
  let profileReads = 0;
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.UTC(2026, 8, 18, 12, 0, 0);
    function BusinessDate(...args) {
      if (!new.target) return new NativeDate(fixedNow).toString();
      return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target);
    }
    BusinessDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(BusinessDate, NativeDate);
    BusinessDate.now = () => fixedNow;
    globalThis.Date = BusinessDate;
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'fixture' });
    const url = request.url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const header = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Stay ID,Dog Number';
      const rows = bookings.map(item => [item.timestamp, item.dogName, item.breed, item.startDate.split('-').reverse().join('/'), item.endDate.split('-').reverse().join('/'), item.ownerName, item.phone, '', '', item.notes, '', item.bookingType, item.dogId, item.stayId, item.dogNumber].join(','));
      return route.fulfill({ status: 200, contentType: 'text/csv', body: [header, ...rows].join('\n') });
    }
    if (url.includes('script.google')) {
      const policy = resolveLocalBackendAction({ method: request.method(), url });
      if (!policy.policy.allowed) return route.fulfill({ status: 403, body: 'fixture' });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {}; try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      if (policy.action === 'get_guest_profile') profileReads++;
      const records = bookings.map(item => ({
        stayKey: `${item.dogName.toLowerCase()}|${item.startDate}|${item.endDate}`,
        stayId: item.stayId,
        dogId: item.dogId
      }));
      const response = policy.action === 'get_guest_directory'
        ? { result: 'success', bookings, summaries: records.map(record => ({ ...record, riskFlags: {} })) }
        : policy.action === 'get_past_guest_directory'
          ? { result: 'success', bookings: [], summaries: [] }
          : policy.action === 'get_guest_profile'
            ? { result: 'success', record: { stayKey: payload.stayKey, identity: { stayKey: payload.stayKey, stayId: payload.stayId, dogId: payload.dogId }, resolution: { status: 'resolved', method: 'fixture' }, intakeAttributes: { feedingTimes: 'Morning' } } }
            : { result: 'success', records: [] };
      const body = callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response);
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'application/javascript' : 'image/svg+xml', body: type === 'stylesheet' || type === 'script' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return () => profileReads;
}

for (const width of [390, 1440]) {
  test(`full consolidated refresh preserves the selected same-name guest and scopes changed summaries at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const bookings = sameNameBookings();
    const profileReads = await installSameNameRefreshFixture(page, bookings);
    await page.route('**/waffle-app.js*', async route => {
      const appSource = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: appSource.replace('function applyGuestDirectoryResponse(', 'window.__applyCareSummaryResponse = applyGuestDirectoryResponse;\n    function applyGuestDirectoryResponse(') });
    });
    await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    await expect(page.locator('#directory-grid .directory-card')).toHaveCount(2);
    const cards = page.locator('#directory-grid .directory-card');
    const openers = page.locator('#directory-grid [data-open-directory-profile]');
    await openers.first().click();
    await expect(page.locator('.directory-card.is-profile-active [data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    const key = booking => `${booking.dogName.toLowerCase()}|${booking.startDate}|${booking.endDate}`;
    const baseResponse = {
      result: 'success', bookings,
      summaries: bookings.map(booking => ({ stayKey: key(booking), stayId: booking.stayId, dogId: booking.dogId, riskFlags: {} })),
      digitalIntakes: bookings.map(booking => ({ stayKey: key(booking), status: 'Awaiting Owner', token: `token-${booking.dogNumber}` })),
      legacyIntakes: []
    };
    await page.evaluate(response => window.__applyCareSummaryResponse(response), baseResponse);
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card.is-profile-active');
      const profile = card.querySelector('[data-directory-detail="profile"]');
      profile.open = true;
      const disclosure = card.querySelector('.directory-care-records-disclosure');
      if (disclosure) disclosure.open = true;
      const draft = document.createElement('textarea');
      draft.dataset.refreshDraftProbe = '';
      draft.value = 'Keep this unsubmitted note';
      card.appendChild(draft);
      draft.focus();
      window.__refreshProbe = {
        card,
        profile,
        safety: card.querySelector('[data-care-brief-safety]'),
        safetyChildren: Array.from(card.querySelector('[data-care-brief-safety]').childNodes),
        intake: card.querySelector('[data-directory-intake]'),
        intakeChildren: Array.from(card.querySelector('[data-directory-intake]').childNodes),
        other: Array.from(document.querySelectorAll('#directory-grid .directory-card')).find(item => item !== card),
        otherSafety: Array.from(document.querySelectorAll('#directory-grid .directory-card')).find(item => item !== card).querySelector('[data-care-brief-safety]'),
        otherRosterCare: Array.from(document.querySelectorAll('#directory-grid .directory-card')).find(item => item !== card).querySelector('.directory-care-strip'),
        otherRosterCareChildren: Array.from(Array.from(document.querySelectorAll('#directory-grid .directory-card')).find(item => item !== card).querySelector('.directory-care-strip').childNodes)
      };
    });
    const readCount = profileReads();
    await page.evaluate(response => window.__applyCareSummaryResponse(response), baseResponse);
    const preserved = await page.evaluate(() => {
      const state = window.__refreshProbe;
      const active = document.querySelector('.directory-card.is-profile-active');
      const disclosure = state.card.querySelector('.directory-care-records-disclosure');
      return {
        card: active === state.card,
        profile: active.querySelector('[data-directory-detail="profile"]') === state.profile,
        safetyHost: active.querySelector('[data-care-brief-safety]') === state.safety,
        safetyChildren: Array.from(state.safety.childNodes).every((node, index) => node === state.safetyChildren[index]),
        intakeHost: active.querySelector('[data-directory-intake]') === state.intake,
        intakeChildren: Array.from(state.intake.childNodes).every((node, index) => node === state.intakeChildren[index]),
        otherCard: state.other.isConnected,
        otherRosterCareChildren: Array.from(state.otherRosterCare.childNodes).every((node, index) => node === state.otherRosterCareChildren[index]),
        focusedDraft: document.activeElement?.hasAttribute('data-refresh-draft-probe') && document.activeElement.value === 'Keep this unsubmitted note',
        profileOpen: state.profile.open,
        disclosureOpen: !disclosure || disclosure.open
      };
    });
    expect(preserved).toEqual({ card: true, profile: true, safetyHost: true, safetyChildren: true, intakeHost: true, intakeChildren: true, otherCard: true, otherRosterCareChildren: true, focusedDraft: true, profileOpen: true, disclosureOpen: true });
    expect(profileReads()).toBe(readCount);
    const secondKey = key(bookings[1]);
    const changedResponse = {
      ...baseResponse,
      summaries: baseResponse.summaries.map(summary => summary.stayKey === secondKey ? { ...summary, riskFlags: { foodAllergy: true } } : summary),
      digitalIntakes: baseResponse.digitalIntakes.map(record => record.stayKey === secondKey ? { ...record, status: 'Complete', pdfUrl: 'https://example.test/updated.pdf', token: 'new-token' } : record)
    };
    await page.evaluate(response => window.__applyCareSummaryResponse(response), changedResponse);
    // The canonical aggregate is intentionally updated on the next animation frame.
    await expect(page.locator('#directory-care-summary')).toContainText('1 alert');
    const changed = await page.evaluate(() => {
      const other = window.__refreshProbe.other;
      return {
        selectedSafetySame: window.__refreshProbe.card.querySelector('[data-care-brief-safety]') === window.__refreshProbe.safety,
        selectedIntakeSame: window.__refreshProbe.card.querySelector('[data-directory-intake]') === window.__refreshProbe.intake,
        otherSafetyHostSame: other.querySelector('[data-care-brief-safety]') === window.__refreshProbe.otherSafety,
        otherIntakeHostSame: other.querySelector('[data-directory-intake]') === window.__refreshProbe.other.querySelector('[data-directory-intake]'),
        otherSafetyChanged: other.querySelector('.directory-care-strip').textContent.includes('Food Allergy'),
        otherSafetyAlertClass: other.querySelector('.directory-care-strip').classList.contains('has-alerts'),
        otherSafetyAlertNodes: other.querySelectorAll('.directory-care-strip [data-directory-care-alert]').length,
        otherIntakeChanged: other.querySelector('[data-directory-intake]').querySelector('[href="https://example.test/updated.pdf"]') !== null,
        selectedStillActive: document.querySelector('.directory-card.is-profile-active') === window.__refreshProbe.card,
        alertSummary: document.getElementById('directory-care-summary')?.textContent || ''
      };
    });
    expect(changed.selectedSafetySame).toBe(true);
    expect(changed.selectedIntakeSame).toBe(true);
    expect(changed.otherSafetyHostSame).toBe(true);
    expect(changed.otherIntakeHostSame).toBe(true);
    expect(changed.otherSafetyChanged).toBe(true);
    expect(changed.otherSafetyAlertClass).toBe(true);
    expect(changed.otherSafetyAlertNodes).toBe(1);
    expect(changed.otherIntakeChanged).toBe(true);
    expect(changed.selectedStillActive).toBe(true);
    expect(changed.alertSummary).toMatch(/1.*alert|1.*flag/i);
    expect(profileReads()).toBe(readCount);
    expect(await cards.count()).toBe(2);
  });
}

test('unchanged safety profile retains a focused checkbox and changed data restores its edit draft', async ({ page }) => {
  await page.setContent(`
    <article class="directory-card is-profile-editing" data-stay-key="stay-a">
      <section data-care-category>
        <span data-care-category-summary="safety" data-state="unknown"></span>
        <div data-directory-profile-care></div>
      </section>
      <div data-directory-profile-edit-status></div>
      <button data-directory-profile-edit-save></button>
    </article>
  `);
  const safetyCode = source.slice(helperStart, helperEnd)
    + source.slice(source.indexOf('function restoreDirectoryProfileEditDraft('), source.indexOf('function handleDirectoryProfileEditInput('))
    + source.slice(source.indexOf('    function renderDirectoryCareProfile(card, record) {'), source.indexOf('    function renderDirectoryBelongings(card, record) {'));
  await page.addScriptTag({ content: `
    const CARE_SAFETY_FLAGS = [
      { key: 'foodAllergy', label: 'Food Allergy', icon: '⚠️', className: 'risk-allergy' },
      { key: 'medicated', label: 'Medicated', icon: '💊', className: 'risk-medicated' }
    ];
    const directoryProfileEditDrafts = new Map();
    const directorySafetyReadFailures = new Set();
    const careRiskRecordsCache = {};
    const directorySummaryRecordsCache = {};
    const belongingsRecordsCache = {};
    function directoryProfileEditKey() { return 'stay-a'; }
    function collectDirectoryProfileEditValues(card) { return Object.fromEntries([...card.querySelectorAll('[data-care-risk-flag]')].map(input => [input.dataset.careRiskFlag, input.checked])); }
    function validateDirectoryProfileEditContext() {}
    function applyDirectoryProfileEditValues(card, values) { for (const [key, value] of Object.entries(values)) { const input = card.querySelector('[data-care-risk-flag="' + key + '"]'); if (input) input.checked = !!value; } }
    function updateDirectoryProfileEditFeedback() {}
    function applyDirectoryProfileEditMode() {}
    function directoryCareCategorySummary(_tab, _attributes, _state, record, readState) { return { text: readState === 'loading' ? 'Loading safety status…' : record?.riskFlags?.foodAllergy ? 'Food Allergy' : 'Safety clear', state: readState === 'loading' ? 'unknown' : 'saved' }; }
    function escapeDashboardHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
    ${safetyCode}
    window.renderDirectoryCareProfile = renderDirectoryCareProfile;
    window.directoryProfileEditDrafts = directoryProfileEditDrafts;
  ` });
  const result = await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const firstRecord = { riskFlags: { foodAllergy: false, medicated: false } };
    window.directoryProfileEditDrafts.set('stay-a', {
      initial: { foodAllergy: false, medicated: false },
      values: { foodAllergy: true, medicated: false },
      initialized: true, conflict: false, failed: false, saving: false
    });
    renderDirectoryCareProfile(card, firstRecord);
    const host = card.querySelector('[data-directory-profile-care]');
    const allergy = host.querySelector('[data-care-risk-flag="foodAllergy"]');
    allergy.checked = true;
    allergy.focus();
    const observer = new MutationObserver(() => {});
    observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    const beforeMutations = observer.takeRecords().length;
    renderDirectoryCareProfile(card, firstRecord);
    const unchangedMutations = beforeMutations + observer.takeRecords().length;
    const retained = host.querySelector('[data-care-risk-flag="foodAllergy"]') === allergy
      && document.activeElement === allergy
      && allergy.checked;
    const changedRecord = { riskFlags: { foodAllergy: true, medicated: true } };
    renderDirectoryCareProfile(card, changedRecord);
    const restoredAllergy = host.querySelector('[data-care-risk-flag="foodAllergy"]');
    const restoredMedication = host.querySelector('[data-care-risk-flag="medicated"]');
    return {
      unchangedMutations,
      retained,
      changedNodes: restoredAllergy !== allergy,
      updatedSummary: card.querySelector('[data-care-category-summary="safety"]').textContent === 'Food Allergy',
      draftPreserved: restoredAllergy.checked && !restoredMedication.checked,
      conflictRecorded: window.directoryProfileEditDrafts.get('stay-a').conflict === true,
      changedMutations: observer.takeRecords().length
    };
  });
  expect(result.unchangedMutations).toBe(0);
  expect(result.retained).toBe(true);
  expect(result.changedNodes).toBe(true);
  expect(result.updatedSummary).toBe(true);
  expect(result.draftPreserved).toBe(true);
  expect(result.conflictRecorded).toBe(true);
  expect(result.changedMutations).toBeGreaterThan(0);
});
