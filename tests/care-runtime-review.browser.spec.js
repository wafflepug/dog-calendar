const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('fs');
const path = require('path');

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-18T12:00:00') });
});

const fullCalendarBundle = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const booking = {
  timestamp: '2026-09-18',
  dogName: 'A very long dog name that must wrap without clipping',
  breed: 'Border Collie',
  startDate: '2026-09-17',
  endDate: '2026-09-22',
  ownerName: 'Alexandria Peterson-Smith with a very long family name',
  phone: '0400123456',
  notes: 'Long care notes wrap here and remain discoverable.',
  bookingType: 'Boarding'
};

function csvFixture() {
  return [
    'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type',
    [booking.timestamp, booking.dogName, booking.breed, '17/09/2026', '22/09/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType].join(',')
  ].join('\n');
}

async function installReadOnlyFixtures(page, options = {}) {
  const writes = [];
  const directoryReads = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      writes.push({ method: request.method(), url });
      return route.fulfill({ status: 405, body: 'Read-only review blocked mutation' });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csvFixture() });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) {
        writes.push({ method: request.method(), url, action: resolved.action, reason: resolved.policy.reason });
        return route.fulfill({ status: 403, contentType: 'text/plain', body: `Read-only review blocked backend action: ${resolved.policy.reason}` });
      }
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      let response = { result: 'success', records: [] };
      const action = resolved.action;
      if (action === 'maintenance_status') response = { result: 'success', enabled: false };
      if (action === 'get_guest_directory') {
        const read = { startedAt: Date.now() };
        directoryReads.push(read);
        if (options.directoryDelayMs) await new Promise(resolve => setTimeout(resolve, options.directoryDelayMs));
        response = { result: 'success', bookings: [booking] };
        read.fulfilledAt = Date.now();
      }
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: 'a very long dog name that must wrap without clipping|2026-09-17|2026-09-22', intakeAttributes: { medicationInstructions: 'Give after dinner; call owner if appetite changes.' }, intakeAttributesSource: 'Synthetic saved profile', riskFlags: { foodAllergy: true } } };
      if (action === 'get_data_versions') response = { result: 'success', versions: { bookings: 'runtime-review', belongings: 'runtime-review' } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendarBundle });
    if (/^https?:/.test(url) && !url.includes('127.0.0.1:4175')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ddd"/></svg>' });
    return route.continue();
  });
  return { writes, directoryReads };
}

for (const [name, viewport, colorScheme] of [['390-light', { width: 390, height: 844 }, 'light'], ['390-dark', { width: 390, height: 844 }, 'dark'], ['1440-light', { width: 1440, height: 900 }, 'light']]) {
  test(`actual directory runtime ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    const fixture = await installReadOnlyFixtures(page);
    await page.goto('http://127.0.0.1:4175/directory.html?runtimeReview=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 45000 });
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count(), { timeout: 30000 }).toBe(1);
    const profileButton = page.locator('[data-open-directory-profile]');
    await profileButton.evaluate(button => button.click());
    await expect.poll(() => page.locator('.directory-card.is-profile-active').count()).toBe(1);
    await page.waitForTimeout(1200);
    await expect(page.locator('.directory-card.is-profile-active .directory-dog-name-btn')).toBeVisible();
    const evidence = await page.evaluate(() => {
      const card = document.querySelector('.directory-card.is-profile-active');
      const text = selector => { const el = card.querySelector(selector); const style = getComputedStyle(el); return { text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, fontSize: style.fontSize, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow }; };
      const cardStyle = getComputedStyle(card);
      return { heading: text('.directory-profile-section-heading h4'), value: text('.directory-field-value'), name: text('.directory-dog-name-btn'), breed: text('.directory-primary-breed'), dates: text('.directory-stay-dates'), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, darkTheme: document.body.classList.contains('dark-theme'), cardParent: card.parentElement?.id || '', dashboardClasses: card.closest('.directory-dashboard-fused')?.className || '', cardDisplay: cardStyle.display, cardHidden: card.hidden, cardClass: card.className, body: document.body.innerText.slice(0, 500) };
    });
    console.log(`RUNTIME_EVIDENCE ${name} ${JSON.stringify(evidence)}`);
    await page.screenshot({ path: `test-results/care-runtime-${name}.png`, fullPage: true });
    expect(fixture.writes.every(item => item.reason === 'unapproved action' || item.reason === 'non-read method')).toBe(true);
    expect(evidence.darkTheme).toBe(colorScheme === 'dark');
    expect(evidence.pageWidth).toBeLessThanOrEqual(evidence.viewport);
    expect(evidence.heading.fontSize).toBe('16px');
    expect(evidence.value.fontSize).toBe('14px');
    expect(evidence.name.fontSize).toBe('22px');
    expect(evidence.breed.fontSize).toBe('14px');
    expect(evidence.dates.fontSize).toBe('14px');
    await expect(page.locator('.directory-card.is-profile-active .directory-field-label').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.directory-card.is-profile-active .intake-profile-field label').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.directory-card.is-profile-active .intake-profile-control').first()).toHaveCSS('font-size', '14px');
    for (const item of [evidence.name, evidence.breed, evidence.dates]) {
      expect(item.textOverflow).not.toBe('ellipsis');
      expect(item.whiteSpace).not.toBe('nowrap');
      expect(item.scrollWidth).toBeLessThanOrEqual(item.width + 1);
      expect(item.scrollHeight).toBeLessThanOrEqual(item.height + 2);
    }
  });
}

test('Care detail editors stay readable and reachable in the actual directory runtime', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  const fixture = await installReadOnlyFixtures(page);
  await page.goto('http://127.0.0.1:4175/directory.html?inlineEditorReview=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 45000 });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(1, { timeout: 30000 });
  const card = page.locator('.directory-card[data-directory-stay-key]').first();
  await card.locator('[data-open-directory-profile]').evaluate(button => button.click());
  await expect.poll(() => card.evaluate(el => el.classList.contains('is-profile-active'))).toBe(true);
  await page.waitForTimeout(1200);
  await expect(card.locator('[data-directory-edit-field="dogName"]')).toBeVisible();
  await card.locator('[data-directory-stay-contact] summary').click();

  for (const width of [320, 390, 412, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    for (const accent of ['waffle-purple', 'coastal-blue', 'eucalyptus', 'sunset-coral', 'warm-honey']) {
      await page.evaluate(value => {
        document.documentElement.dataset.waffleColourStyle = value;
        document.body.dataset.waffleColourStyle = value;
        document.body.classList.toggle('dark-theme', innerWidth === 390);
      }, accent);
      const editorFields = width === 320 && accent === 'waffle-purple'
        ? [['dogName', '#guestDetailEditInput'], ['breed', '#guestDetailEditInput'], ['ownerName', '#guestDetailEditInput'], ['phone', '#guestDetailEditInput'], ['notes', '#guestDetailEditTextarea']]
        : [['notes', '#guestDetailEditTextarea']];
      for (const [field, control] of editorFields) {
        const trigger = card.locator(`[data-directory-edit-field="${field}"]`);
        await trigger.evaluate(button => button.click());
        const modal = page.locator('#guestDetailEditModal');
        await expect(modal).toHaveClass(/open/);
        const editor = page.locator(control);
        await expect(editor).toBeVisible();
        await expect(editor).toHaveAccessibleName(field === 'dogName' ? 'Dog Name' : field === 'ownerName' ? 'Owner' : field === 'phone' ? 'Contact Number' : field === 'notes' ? 'Handover note' : 'Breed');
        await expect(editor).toHaveAttribute('aria-describedby', 'guestDetailEditStatus');
        const measured = await modal.evaluate(root => {
          const style = selector => getComputedStyle(root.querySelector(selector));
          const rect = selector => { const value = root.querySelector(selector).getBoundingClientRect(); return { width: value.width, height: value.height, top: value.top, bottom: value.bottom }; };
          const panel = root.querySelector('.guest-detail-edit-panel');
          const status = root.querySelector('#guestDetailEditStatus');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const lum = color => {
            ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0);
          };
          const contrast = (foreground, background) => { const a = lum(foreground), b = lum(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
          const statusStyle = getComputedStyle(status);
          const panelColor = getComputedStyle(panel).backgroundColor;
          const statusContrasts = ['is-clean', 'is-unsaved', 'is-saving', 'is-success', 'is-error'].map(state => {
            status.className = `guest-detail-edit-status ${state}`;
            return contrast(getComputedStyle(status).color, panelColor);
          });
          status.className = 'guest-detail-edit-status is-clean';
          const save = root.querySelector('#saveGuestDetailEdit');
          const saveStyle = getComputedStyle(save);
          return {
            inputFont: style('#guestDetailEditInput').fontSize,
            textareaFont: style('#guestDetailEditTextarea').fontSize,
            statusFont: statusStyle.fontSize,
            labelFont: getComputedStyle(root.querySelector('#guestDetailEditLabel')).fontSize,
            dogLineFont: getComputedStyle(root.querySelector('#guestDetailEditDog')).fontSize,
            statusContrast: contrast(statusStyle.color, panelColor),
            statusContrasts,
            saveContrast: contrast(saveStyle.color, saveStyle.backgroundColor),
            saveOpacity: saveStyle.opacity,
            buttons: [...root.querySelectorAll('.guest-detail-edit-close, .guest-detail-edit-actions button')].map(button => { const r = button.getBoundingClientRect(); return [r.width, r.height]; }),
            longValueFits: root.querySelector('#guestDetailEditDog').scrollWidth <= root.querySelector('#guestDetailEditDog').clientWidth + 1,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            panelHeight: panel.clientHeight,
            panelScrollHeight: panel.scrollHeight
          };
        });
        expect(measured.inputFont).toBe('16px');
        expect(measured.textareaFont).toBe('16px');
        expect(Number.parseFloat(measured.statusFont)).toBeGreaterThanOrEqual(13);
        expect(Number.parseFloat(measured.labelFont)).toBeGreaterThanOrEqual(13);
        expect(Number.parseFloat(measured.dogLineFont)).toBeGreaterThanOrEqual(13);
        expect(measured.statusContrast).toBeGreaterThanOrEqual(4.5);
        expect(measured.statusContrasts.every(ratio => ratio >= 4.5)).toBe(true);
        expect(measured.saveContrast).toBeGreaterThanOrEqual(4.5);
        expect(measured.saveOpacity).toBe('1');
        expect(measured.buttons.every(([w, h]) => w >= 44 && h >= 44)).toBe(true);
        expect(measured.longValueFits).toBe(true);
        expect(measured.pageOverflow).toBe(false);
        await editor.focus();
        expect(await editor.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');

        if (width === 320 && accent === 'waffle-purple' && field === 'notes') {
          await page.setViewportSize({ width: 320, height: 380 }); // Keyboard-open visual-height emulation.
          await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--waffle-mobile-visual-height'))).toBe('380px');
          await page.locator('.guest-detail-edit-actions').scrollIntoViewIfNeeded();
          const actions = await page.locator('.guest-detail-edit-actions').boundingBox();
          expect(actions.y + actions.height).toBeLessThanOrEqual(380);
          expect(actions.y).toBeGreaterThanOrEqual(0);
          await page.setViewportSize({ width: 320, height: 568 });
        }
        await page.locator('#cancelGuestDetailEdit').evaluate(button => button.click());
        await expect(modal).not.toHaveClass(/open/);
        expect(await trigger.evaluate(el => document.activeElement === el)).toBe(true);
      }
    }
  }
  expect(fixture.writes.every(item => item.reason === 'unapproved action' || item.reason === 'non-read method')).toBe(true);
  expect(fixture.writes.some(item => item.action === 'update_guest_detail')).toBe(false);
});

test('a fast initial directory response owns startup and builds its Care card once', async ({ page }) => {
  const fixture = await installReadOnlyFixtures(page);
  await page.goto('http://127.0.0.1:4175/directory.html?runtimeReview=single-directory-read', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 45000 });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toContainText(booking.dogName);
  await page.waitForTimeout(500);

  expect(fixture.directoryReads).toHaveLength(1);
  expect(fixture.directoryReads[0].fulfilledAt).toBeDefined();
  expect(fixture.writes.every(item => item.reason === 'unapproved action' || item.reason === 'non-read method')).toBe(true);
});

test('a delayed initial directory response still builds its Care card', async ({ page }) => {
  const fixture = await installReadOnlyFixtures(page, { directoryDelayMs: 250 });
  await page.goto('http://127.0.0.1:4175/directory.html?runtimeReview=delayed-directory', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toContainText(booking.dogName);

  expect(fixture.directoryReads).toHaveLength(1);
  expect(fixture.directoryReads[0].fulfilledAt).toBeGreaterThan(fixture.directoryReads[0].startedAt);
  expect(fixture.writes.every(item => item.reason === 'unapproved action' || item.reason === 'non-read method')).toBe(true);
});

