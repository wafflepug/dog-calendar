const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  { timestamp: '2026-09-18', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alex Owner', phone: '0400000001', notes: 'Saved Milo care note', bookingType: 'Boarding' },
  { timestamp: '2026-09-18', dogName: 'Nala', breed: 'Labrador', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Bea Owner', phone: '0400000002', notes: 'Saved Nala care note', bookingType: 'Boarding' }
];

const stayKey = booking => `${booking.dogName.toLowerCase()}|${booking.startDate}|${booking.endDate}`;
const csv = () => [
  'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type',
  ...bookings.map(b => [b.timestamp, b.dogName, b.breed, '17/09/2026', '22/09/2026', b.ownerName, b.phone, '', '', b.notes, '', b.bookingType].join(','))
].join('\n');

function profileRecord(key, label = 'Saved') {
  return { stayKey: key, intakeAttributes: { medicationInstructions: `${label} medication` }, intakeAttributesSource: 'Saved profile', riskFlags: {} };
}

function installReadOnlyRuntimeFixture(page, options = {}) {
  const profileCalls = new Map();
  const gates = new Map();
  const released = new Set();
  const release = (key, call = 1) => {
    const id = `${key}:${call}`;
    released.add(id);
    gates.get(id)?.();
  };
  const handler = async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.startsWith('http://127.0.0.1:44972/')) return route.continue();
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: csv() });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google.com')) {
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const action = String(resolved.action || payload.action || params.get('action') || '');
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: `Unapproved backend action blocked: ${resolved.policy.reason}` });
      let response;
      if (action === 'get_guest_directory') {
        response = {
          result: 'success',
          bookings,
          summaries: options.summaryRecords || bookings.map(b => ({
            stayKey: stayKey(b),
            riskFlags: options.summaryRiskFlags?.(b) || {}
          }))
        };
      } else if (action === 'get_guest_profile') {
        const key = String(payload.stayKey || '');
        const call = (profileCalls.get(key) || 0) + 1;
        profileCalls.set(key, call);
        const behavior = options.profileBehavior?.(key, call) || { kind: 'success', delay: 0 };
        if (behavior.kind === 'error') {
          const errorResponse = { result: 'error', error: behavior.message || 'fixture profile failure' };
          if (behavior.delay) await new Promise(resolve => setTimeout(resolve, behavior.delay));
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(errorResponse)});` });
        }
        response = {
          result: 'success',
          record: behavior.record || profileRecord(key, behavior.label || 'Fresh')
        };
        if ((options.holdProfile || behavior.hold) && behavior.kind === 'success' && !released.has(`${key}:${call}`)) {
          await new Promise(resolve => gates.set(`${key}:${call}`, resolve));
        }
        if (behavior.delay) await new Promise(resolve => setTimeout(resolve, behavior.delay));
      } else if (action === 'get_belongings') {
        response = {
          result: 'success',
          records: typeof options.belongingsRecords === 'function'
            ? options.belongingsRecords(payload)
            : (options.belongingsRecords || [])
        };
      }
      if (!response) response = { result: 'success', records: [], enabled: false };
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
    }
    if (/^https?:/.test(url)) return route.fulfill({ status: 200, contentType: url.match(/\.css(?:\?|$)/) ? 'text/css' : 'image/svg+xml', body: url.match(/\.css(?:\?|$)/) ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>' });
    return route.continue();
  };
  return { profileCalls, handler, release };
}

async function openDirectory(page, baseURL, fixture, colorScheme = 'light') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
  await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
  await page.route('**/*', fixture.handler);
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(2);
}

async function openProfile(page, dogName = 'Milo') {
  const card = page.locator(`.directory-card[data-directory-dog-name="${dogName}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  return card;
}

async function seedProfileCache(page, key, label = 'Cached') {
  await page.evaluate(async ({ key, record }) => {
    if (typeof putWaffleCachedResponse !== 'function') throw new Error('actual Waffle cache helper is unavailable');
    await putWaffleCachedResponse(`directory:profile:${key}`, { result: 'success', record });
  }, { key, record: profileRecord(key, label) });
}

async function assertFeedbackStyles(status) {
  const actual = await status.evaluate(element => {
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const luminance = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgb = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
        value /= 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return {
      contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      fontSize: parseFloat(getComputedStyle(element.querySelector('.directory-profile-read-status-message')).fontSize),
      busyAncestor: Boolean(element.closest('[aria-busy="true"]'))
    };
  });
  expect(actual.contrast).toBeGreaterThanOrEqual(4.5);
  expect(actual.fontSize).toBeGreaterThanOrEqual(12);
  expect(actual.busyAncestor).toBe(false);
}

for (const colorScheme of ['light', 'dark']) {
  test(`cold delayed profile success exposes loading and fresh states (${colorScheme})`, async ({ page, baseURL }) => {
    const fixture = installReadOnlyRuntimeFixture(page, { holdProfile: true, profileBehavior: () => ({ kind: 'success' }) });
    await openDirectory(page, baseURL, fixture, colorScheme);
    const card = await openProfile(page);
    const details = card.locator('[data-directory-detail="profile"]');
    const status = details.locator('[data-directory-profile-read-status]');
    await expect(status).toHaveAttribute('data-state', 'loading');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    const host = details.locator('[data-directory-intake-attributes]');
    await expect(host).toHaveAttribute('aria-busy', 'true');
    fixture.release(await card.getAttribute('data-directory-stay-key'));
    await expect(status).toHaveAttribute('data-state', 'fresh', { timeout: 2_000 });
    await expect(host).toHaveAttribute('aria-busy', 'false');
    await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Fresh medication');
  });
}

test('saved cached profile stays visible while delayed fresh data arrives', async ({ page, baseURL }) => {
  const fixture = installReadOnlyRuntimeFixture(page, { holdProfile: true, profileBehavior: () => ({ kind: 'success', label: 'Fresh' }) });
  await openDirectory(page, baseURL, fixture);
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  const key = await card.getAttribute('data-directory-stay-key');
  await seedProfileCache(page, key);
  await card.locator('[data-open-directory-profile]').click();
  const details = card.locator('[data-directory-detail="profile"]');
  const status = details.locator('[data-directory-profile-read-status]');
  await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Cached medication');
  await expect(status).toHaveAttribute('data-state', 'refreshing');
  await expect(details.locator('[data-directory-intake-attributes]')).toHaveAttribute('aria-busy', 'true');
  fixture.release(key);
  await expect(status).toHaveAttribute('data-state', 'fresh', { timeout: 2_000 });
  await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Fresh medication');
});

test('cached profile failure preserves saved content and one retry succeeds', async ({ page, baseURL }) => {
  const fixture = installReadOnlyRuntimeFixture(page, { profileBehavior: (_key, call) => call === 1 ? { kind: 'error' } : { kind: 'success', label: 'Retried' } });
  await openDirectory(page, baseURL, fixture, 'dark');
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await seedProfileCache(page, await card.getAttribute('data-directory-stay-key'));
  await card.locator('[data-open-directory-profile]').click();
  const details = card.locator('[data-directory-detail="profile"]');
  const status = details.locator('[data-directory-profile-read-status]');
  await expect(status).toHaveAttribute('data-state', 'error', { timeout: 2_000 });
  await assertFeedbackStyles(status);
  await expect(status.locator('[data-retry-directory-profile-read]')).toHaveCount(1);
  await expect(details.locator('[data-retry-directory-profile-read], [data-retry-directory-detail="profile"]')).toHaveCount(1);
  await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Cached medication');
  await status.locator('[data-retry-directory-profile-read]').click();
  await expect(status).toHaveAttribute('data-state', 'fresh', { timeout: 2_000 });
  await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Retried medication');
  await expect(status.locator('[data-retry-directory-profile-read]')).toHaveCount(0);
});

test('cold profile failure renders exactly one status retry and succeeds after retry', async ({ page, baseURL }) => {
  const fixture = installReadOnlyRuntimeFixture(page, { profileBehavior: (_key, call) => call === 1 ? { kind: 'error' } : { kind: 'success', label: 'Recovered' } });
  await openDirectory(page, baseURL, fixture);
  const card = await openProfile(page);
  const details = card.locator('[data-directory-detail="profile"]');
  const status = details.locator('[data-directory-profile-read-status]');
  await expect(status).toHaveAttribute('data-state', 'error', { timeout: 2_000 });
  await assertFeedbackStyles(status);
  await expect(status.locator('[data-retry-directory-profile-read]')).toHaveCount(1);
  await expect(details.locator('[data-retry-directory-profile-read], [data-retry-directory-detail="profile"]')).toHaveCount(1);
  const target = await status.locator('[data-retry-directory-profile-read]').boundingBox();
  expect(target.height).toBeGreaterThanOrEqual(44);
  expect(target.width).toBeGreaterThanOrEqual(44);
  await status.locator('[data-retry-directory-profile-read]').focus();
  await expect(status.locator('[data-retry-directory-profile-read]')).toBeFocused();
  await status.locator('[data-retry-directory-profile-read]').click();
  await expect(status).toHaveAttribute('data-state', 'fresh', { timeout: 2_000 });
  await expect(details.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Recovered medication');
});

test('status remains visible across care subtabs, Back stays usable, and late response cannot cross stays', async ({ page, baseURL }) => {
  const fixture = installReadOnlyRuntimeFixture(page, { profileBehavior: key => key.startsWith('milo|') ? { kind: 'success', hold: true, label: 'Late Milo' } : { kind: 'success', label: 'Nala' } });
  await openDirectory(page, baseURL, fixture);
  const miloKey = await page.locator('.directory-card[data-directory-dog-name="Milo"]').getAttribute('data-directory-stay-key');
  await seedProfileCache(page, miloKey);
  const milo = await openProfile(page, 'Milo');
  const miloStatus = milo.locator('[data-directory-profile-read-status]');
  await expect(miloStatus).toHaveAttribute('data-state', 'refreshing');
  await milo.locator('[data-profile-subtab="care"]').click();
  await expect(miloStatus).toBeVisible();
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(page.locator('.directory-dashboard-fused')).not.toHaveClass(/is-profile-mode/);
  const nala = await openProfile(page, 'Nala');
  await expect(nala.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Nala medication', { timeout: 2_000 });
  fixture.release(miloKey);
  await expect.poll(() => page.evaluate(key => directoryProfileDetailCache[key]?.intakeAttributes?.medicationInstructions, miloKey)).toBe('Late Milo medication');
  await expect(nala.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Nala medication');
  await page.locator('#directoryBackToGuestsBtn').focus();
  await expect(page.locator('#directoryBackToGuestsBtn')).toBeFocused();
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(page.locator('.directory-dashboard-fused')).not.toHaveClass(/is-profile-mode/);
});

test('Care Brief shows cached safety before the profile read and refreshes feeding and medication', async ({ page, baseURL }) => {
  const key = stayKey(bookings[0]);
  const fixture = installReadOnlyRuntimeFixture(page, {
    summaryRiskFlags: booking => booking.dogName === 'Milo' ? { foodAllergy: true } : {},
    profileBehavior: () => ({
      kind: 'success',
      record: {
        stayKey: key,
        intakeAttributes: {
          feedingTimes: '07:00 and 17:00',
          foodAmount: '1 cup',
          foodBrandType: 'Sensitive formula',
          medicationInstructions: 'Give after dinner'
        },
        intakeAttributesSource: 'Saved profile',
        riskFlags: { foodAllergy: true }
      }
    })
  });
  await openDirectory(page, baseURL, fixture, 'dark');
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  const brief = card.locator('[data-directory-care-brief]');

  await expect(brief.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
  await expect(brief.locator('[data-care-brief-feeding]')).toContainText('Loading with full profile');
  await expect(brief.locator('[data-care-brief-medication]')).toContainText('Loading with full profile');
  expect(fixture.profileCalls.get(key)).toBeUndefined();

  await openProfile(page);
  await expect(brief.locator('[data-care-brief-feeding]')).toHaveText('07:00 and 17:00 · 1 cup · Sensitive formula');
  await expect(brief.locator('[data-care-brief-medication]')).toHaveText('Give after dinner');
  await expect(brief.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state', 'available');
  expect(fixture.profileCalls.get(key)).toBe(1);
});
