const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const FULLCALENDAR = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const BOOKING = { timestamp: '2026-09-18', dogName: 'Fixture Guest', breed: 'Mixed breed', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Fixture Owner', phone: '0000000000', notes: 'Fixture notes', bookingType: 'Boarding' };
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const CSV = [
  'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type',
  [BOOKING.timestamp, BOOKING.dogName, BOOKING.breed, '17/09/2026', '22/09/2026', BOOKING.ownerName, BOOKING.phone, '', '', BOOKING.notes, '', BOOKING.bookingType].map(csvCell).join(',')
].join('\n');
const APPROVED = new Set(['maintenance_status', 'get_guest_directory', 'get_guest_profile', 'get_data_versions', 'get_reminders_notes', 'get_stay_operations', 'get_notification_centre', 'get_past_guest_directory', 'waffle_ai_health']);

async function installFixtures(page, ledger) {
  await page.clock.setFixedTime(new Date('2026-09-18T00:00:00Z'));
  await page.addInitScript(() => {
    const trace = window.__careReadTrace = { marks: [], activePhase: 'navigation' };
    const mark = (name, phase) => {
      const at = performance.now();
      trace.marks.push({ name, phase: phase || trace.activePhase, at });
      if (phase) trace.activePhase = phase;
    };
    window.addEventListener('click', event => {
      const target = event.target?.closest?.('[data-open-directory-profile], [data-directory-main-tab], [data-profile-subtab]');
      if (!target) return;
      const phase = target.hasAttribute('data-open-directory-profile') ? 'profile' :
        (target.dataset.directoryMainTab === 'belongings' ? 'belongings' : 'secondary-tab');
      mark(`caller-${phase}-click`, phase);
    }, true);
    const observer = new MutationObserver(() => {
      const card = document.querySelector('.directory-card.is-profile-active');
      if (card) {
        if (!card.dataset.traceShellMarked && document.querySelector('.directory-dashboard-fused.is-profile-mode')) {
          card.dataset.traceShellMarked = 'true'; mark('profile-shell', 'profile');
        }
        const profile = card.querySelector('[data-directory-detail="profile"]');
        if (profile?.dataset.detailLoaded === 'true' && !profile.dataset.traceLoadedMarked) {
          profile.dataset.traceLoadedMarked = 'true'; mark('profile-detail-loaded', 'profile');
        }
        const belongings = card.querySelector('[data-directory-detail="belongings"]');
        if (belongings?.dataset.detailLoaded === 'true' && !belongings.dataset.traceLoadedMarked) {
          belongings.dataset.traceLoadedMarked = 'true'; mark('belongings-detail-loaded', 'belongings');
        }
      }
      if (document.documentElement.dataset.waffleUiReady === 'true' && !trace.uiReady) {
        trace.uiReady = true; mark('ui-ready', 'directory');
      }
      if (document.querySelector('.directory-card[data-directory-stay-key]') && !trace.firstCard) {
        trace.firstCard = true; mark('first-directory-card', 'directory');
      }
    });
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-detail-loaded'] });
    mark('navigation-start', 'directory');
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, contentType: 'text/plain', body: 'Mutation blocked by read-only timing fixture' });
    if (url.includes('fullcalendar@6.1.8/index.global.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: FULLCALENDAR });
    if (url.includes('fullcalendar@6.1.8/index.global.min.css')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: CSV });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const action = APPROVED.has(resolved.action) ? resolved.action : 'unknown';
      let callerPhase = 'unavailable';
      try { callerPhase = await page.evaluate(() => window.__careReadTrace?.activePhase || 'unavailable'); } catch (_) {}
      const entry = { requestId: `q${String(ledger.length + 1).padStart(3, '0')}`, action, attempt: Number(new URL(url).searchParams.get('_attempt') || 1), phase: action === 'get_guest_directory' ? 'directory' : callerPhase, start: performance.now(), startWall: Date.now(), blockedReason: null };
      ledger.push(entry);
      if (!resolved.policy.allowed || !APPROVED.has(resolved.action)) {
        entry.blockedReason = 'unapproved action';
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ result: 'error' }) });
      }
      let body = { result: 'success', records: [] };
      const requestedPayload = JSON.parse(new URL(url).searchParams.get('payload') || '{}');
      if (action === 'get_guest_directory') body = { result: 'success', bookings: [BOOKING] };
      if (action === 'get_guest_profile') body = { result: 'success', record: { stayKey: requestedPayload.stayKey || new URL(url).searchParams.get('stayKey'), intakeAttributes: { medicationInstructions: 'Fixture instruction' }, intakeAttributesSource: 'Fixture' } };
      if (action === 'get_data_versions') body = { result: 'success', versions: { bookings: 'fixture', belongings: 'fixture' } };
      const callback = new URL(url).searchParams.get('callback');
      const payload = callback ? `${callback}(${JSON.stringify(body)});` : JSON.stringify(body);
      await route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body: payload });
      entry.fulfillmentEnd = performance.now();
      entry.fulfillmentWall = Date.now();
      return;
    }
    if (/^https?:/i.test(url) && !url.startsWith('http://127.0.0.1:')) return route.fulfill({ status: 403, contentType: 'text/plain', body: 'External request blocked' });
    return route.continue();
  });
}

async function runProfile(page, ledger, mode, testInfo) {
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 30000 });
  const uiReadyAt = await page.evaluate(() => performance.now());
  await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count(), { timeout: 30000 }).toBe(1);
  const cardReadyAt = await page.evaluate(() => performance.now());
  const card = page.locator('.directory-card[data-directory-stay-key]').first();
  const clickStart = await page.evaluate(() => performance.now());
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const shellActiveAt = await page.evaluate(() => performance.now());
  const shellProfileMode = await page.locator('.directory-dashboard-fused.is-profile-mode').count() > 0;
  expect(shellProfileMode).toBe(true);
  await expect(page.locator('#directoryBackToGuestsBtn')).toBeVisible();
  const backVisibleAt = await page.evaluate(() => performance.now());
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true', { timeout: 30000 });
  const detailLoadedAt = await page.evaluate(() => performance.now());
  const pageTrace = await page.evaluate(() => window.__careReadTrace);
  const evidence = {
    mode,
    sampleCount: 1,
    phases: {
      directory: mode === 'warm-reopen' ? { unavailable: 'same-document repeat; directory navigation not repeated' } : { start: pageTrace.marks.find(mark => mark.name === 'navigation-start')?.at ?? null, uiReady: pageTrace.marks.find(mark => mark.name === 'ui-ready')?.at ?? uiReadyAt, firstCard: pageTrace.marks.find(mark => mark.name === 'first-directory-card')?.at ?? cardReadyAt, end: cardReadyAt },
      clickToShell: { start: clickStart, shellActiveAt, shellMarkerObserved: pageTrace.marks.find(mark => mark.name === 'profile-shell')?.at ?? null, backBar: backVisibleAt, end: shellActiveAt },
      profileDetail: { start: clickStart, loaded: pageTrace.marks.find(mark => mark.name === 'profile-detail-loaded')?.at ?? detailLoadedAt, end: detailLoadedAt },
      secondaryTabs: { status: 'not exercised in this sample' }
    },
    requests: ledger.map(item => ({ requestId: item.requestId, action: item.action, phase: item.phase, attempt: item.attempt, elapsedMs: item.fulfillmentEnd == null ? null : item.fulfillmentEnd - item.start, completion: item.fulfillmentEnd == null ? 'pending' : 'fulfilled' })),
    actionCounts: ledger.reduce((out, item) => { const key = `${item.phase}:${item.action}`; out[key] = (out[key] || 0) + 1; return out; }, {}),
    profileAttemptCount: ledger.filter(item => item.action === 'get_guest_profile').length,
    cacheState: mode.includes('warm-cache') ? 'seeded-stale-while-revalidate' : mode === 'cold' ? 'cold-empty' : 'warm-reopen-unverified',
    cacheRenderObserved: mode.includes('warm-cache') ? 'not measured in this sample' : 'not applicable',
    callerApplicationMarker: 'detail-loaded DOM marker; callback internals unavailable'
  };
  await testInfo.attach(`profile-read-${mode}.json`, { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(`PROFILE_READ_TIMING ${JSON.stringify(evidence)}`);
  expect(JSON.stringify(evidence)).not.toMatch(/Fixture|Owner|https?:\/\/|stayKey|payload|responseBody|rawKey/i);
  return evidence;
}

test('directory profile read cold timing', async ({ page, baseURL }, testInfo) => {
  const ledger = [];
  await installFixtures(page, ledger);
  await page.goto(`${baseURL}/directory.html?timing=cold`, { waitUntil: 'domcontentloaded' });
  const evidence = await runProfile(page, ledger, 'cold', testInfo);
  expect(evidence.cacheState).toBe('cold-empty');
  expect(evidence.actionCounts['directory:get_guest_directory']).toBeGreaterThan(0);
  expect(evidence.actionCounts['profile:get_guest_profile']).toBeGreaterThan(0);
});

test('directory profile read warm reopen timing', async ({ page, baseURL }, testInfo) => {
  const ledger = [];
  await installFixtures(page, ledger);
  await page.goto(`${baseURL}/directory.html?timing=warm`, { waitUntil: 'domcontentloaded' });
  const first = await runProfile(page, ledger, 'warm-first', testInfo);
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toBeVisible();
  const evidence = await runProfile(page, ledger, 'warm-reopen', testInfo);
  expect(evidence.cacheState).toBe('warm-reopen-unverified');
  expect(evidence.profileAttemptCount).toBeGreaterThanOrEqual(first.profileAttemptCount);
  evidence.profileAttemptDeltaFromFirst = evidence.profileAttemptCount - first.profileAttemptCount;
  await testInfo.attach('profile-read-warm-delta.json', { body: JSON.stringify({ firstProfileAttemptCount: first.profileAttemptCount, reopenProfileAttemptCount: evidence.profileAttemptCount, delta: evidence.profileAttemptDeltaFromFirst }, null, 2), contentType: 'application/json' });
});

test('directory profile read at a seeded stale-while-revalidate cache boundary', async ({ page, baseURL }, testInfo) => {
  const ledger = [];
  await installFixtures(page, ledger);
  await page.goto(`${baseURL}/directory.html?timing=seeded-warm`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 30000 });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(1);
  const card = page.locator('.directory-card[data-directory-stay-key]').first();
  const key = await card.getAttribute('data-directory-stay-key');
  await page.evaluate(async key => {
    await putWaffleCachedResponse(`directory:profile:${key}`, { result: 'success', record: { stayKey: key, intakeAttributes: {}, intakeAttributesSource: 'fixture' } });
  }, key);
  const clickStart = await page.evaluate(() => performance.now());
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const shellActiveAt = await page.evaluate(() => performance.now());
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true', { timeout: 30000 });
  const detailLoadedAt = await page.evaluate(() => performance.now());
  const pageTrace = await page.evaluate(() => window.__careReadTrace);
  const profileRequest = [...ledger].reverse().find(item => item.action === 'get_guest_profile');
  const pageTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  const detailMark = pageTrace.marks.find(mark => mark.name === 'profile-detail-loaded');
  const cacheRenderedBeforeFresh = Boolean(profileRequest?.fulfillmentWall && detailMark && pageTimeOrigin + detailMark.at < profileRequest.fulfillmentWall);
  const evidence = {
    mode: 'warm-cache', sampleCount: 1,
    phases: { clickToShell: { start: clickStart, shellActiveAt, shellMarkerObserved: pageTrace.marks.find(mark => mark.name === 'profile-shell')?.at ?? null, end: shellActiveAt }, profileDetail: { start: clickStart, loaded: detailLoadedAt } },
    requests: ledger.map(item => ({ requestId: item.requestId, action: item.action, phase: item.phase, attempt: item.attempt, elapsedMs: item.fulfillmentEnd == null ? null : item.fulfillmentEnd - item.start, completion: item.fulfillmentEnd == null ? 'pending' : 'fulfilled' })),
    actionCounts: ledger.reduce((out, item) => { const key = `${item.phase}:${item.action}`; out[key] = (out[key] || 0) + 1; return out; }, {}),
    profileAttemptCount: ledger.filter(item => item.action === 'get_guest_profile').length,
    cacheState: 'seeded-stale-while-revalidate', cacheRenderObserved: cacheRenderedBeforeFresh ? 'detail rendered before network fulfillment' : 'unavailable',
    callerApplicationMarker: 'detail-loaded DOM marker; callback internals unavailable'
  };
  await testInfo.attach('profile-read-warm-cache.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(`PROFILE_READ_TIMING ${JSON.stringify(evidence)}`);
  expect(JSON.stringify(evidence)).not.toMatch(/Fixture|Owner|https?:\/\/|stayKey|payload|responseBody|rawKey/i);
  expect(evidence.profileAttemptCount).toBeGreaterThan(0);
  expect(evidence.cacheState).toBe('seeded-stale-while-revalidate');
});
