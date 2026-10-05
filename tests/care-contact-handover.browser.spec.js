const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

test.setTimeout(90_000);

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  { timestamp: '2026-10-05', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-01-01', endDate: '2027-01-01', ownerName: 'Alex Owner', phone: '0400000001', notes: `handover-${'verylongword'.repeat(12)} Bring the blue blanket`, bookingType: 'Boarding' },
  { timestamp: '2026-10-05', dogName: 'Nala', breed: 'Labrador', startDate: '2026-01-01', endDate: '2027-01-01', ownerName: '   ', phone: '  ', notes: '  ', bookingType: 'Boarding' }
];
const keyFor = b => `${b.dogName.toLowerCase()}|${b.startDate}|${b.endDate}`;
const dateCell = value => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; };
const csv = () => ['Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type', ...bookings.map(b => [b.timestamp, b.dogName, b.breed, dateCell(b.startDate), dateCell(b.endDate), b.ownerName, b.phone, '', '', b.notes, '', b.bookingType].map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(','))].join('\n');

function installFixture(page) {
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
      const records = bookings.map(b => ({ ...b, stayKey: keyFor(b) }));
      let response = { result: 'success', records: [], enabled: false };
      if (action === 'get_guest_directory') response = { result: 'success', bookings, summaries: records.map(b => ({ stayKey: b.stayKey, riskFlags: {} })), digitalIntakes: [], legacyIntakes: [] };
      if (action === 'get_intake_statuses') response = { result: 'success', records: [] };
      if (action === 'get_legacy_intake_statuses') response = { result: 'success', records: [] };
      if (action === 'get_belongings') response = { result: 'success', records: [] };
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
    }
    if (/^https?:/.test(url)) return route.fulfill({ status: 200, contentType: url.match(/\.css(?:\?|$)/) ? 'text/css' : 'image/svg+xml', body: url.match(/\.css(?:\?|$)/) ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>' });
    return route.continue();
  };
  page.on('request', request => {
    if (request.url().includes('script.google.com') && !['GET', 'HEAD'].includes(request.method())) throw new Error(`Unexpected write request: ${request.method()} ${request.url()}`);
  });
  return handler;
}

test('stay contact and handover is readable, editable and tied to the selected dog at phone and desktop widths', async ({ page, baseURL }) => {
  const fixture = installFixture(page);
  await page.route('**/*', fixture);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.addInitScript(mode => localStorage.setItem('theme', mode), 'light');
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  const emptyCard = page.locator(`.directory-card[data-directory-stay-key="${keyFor(bookings[1])}"]`);
  await expect(emptyCard.locator('[data-open-directory-profile]')).toBeVisible();
  // Both stays cover the test date; status filtering is tested separately.
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await expect(card.locator('[data-open-directory-profile]')).toBeVisible();
  const selectedNote = bookings[0].notes;
  await card.locator('[data-open-directory-profile]').click();
  const contact = card.locator('[data-directory-stay-contact]');
  await contact.locator('summary').click();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.evaluate(() => document.querySelector('[data-wh75-mode="dark"]').click());
      const settings = page.getByRole('dialog', { name: 'Settings' });
      if (await settings.isVisible().catch(() => false)) await page.evaluate(() => document.querySelector('[data-wh75-close-settings]').click());
      await expect(settings).not.toHaveClass(/is-open/);
    }
    await page.emulateMedia({ colorScheme: theme });
    expect(await page.evaluate(() => document.body.classList.contains('dark-theme'))).toBe(theme === 'dark');
    await expect(contact.locator('.directory-field-label')).toHaveText(['Owner', 'Contact', 'Handover note']);
    await expect(contact.locator('[data-directory-edit-field="notes"] .directory-field-value')).toHaveText(selectedNote);
    await expect(contact.locator('[data-directory-edit-field="notes"] .directory-field-value')).toHaveCSS('white-space', 'pre-wrap');
    await expect(contact.locator('[data-directory-edit-field="notes"]')).toHaveAttribute('aria-label', 'Edit Milo handover note');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await contact.evaluate(root => ({ overflow: root.scrollWidth > root.clientWidth, buttons: [...root.querySelectorAll('button')].map(button => { const r = button.getBoundingClientRect(); return [r.width, r.height]; }) }));
      expect(layout.overflow).toBe(false);
      expect(layout.buttons.every(([w, h]) => Math.round(w * 100) / 100 >= 44 && Math.round(h * 100) / 100 >= 44)).toBe(true);
      const readable = await contact.evaluate(root => {
        const size = selector => [...root.querySelectorAll(selector)].map(el => Number.parseFloat(getComputedStyle(el).fontSize));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const luminance = color => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const values = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
        };
        const contrast = [...root.querySelectorAll('.directory-attribute')].flatMap(button => {
          const background = getComputedStyle(button).backgroundColor;
          return [...button.querySelectorAll('.directory-field-label, .directory-field-value, .directory-contact-edit-hint')].map(el => {
            const a = luminance(getComputedStyle(el).color); const b = luminance(background);
            return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground: getComputedStyle(el).color, background };
          });
        });
        return { labels: size('.directory-field-label'), values: size('.directory-field-value'), hints: size('.directory-contact-edit-hint'), contrast };
      });
      expect(readable.labels.every(size => size >= 12)).toBe(true);
      expect(readable.values.every(size => size >= 14)).toBe(true);
      expect(readable.hints.every(size => size >= 12)).toBe(true);
      expect(readable.contrast.every(value => value.ratio >= 4.5), JSON.stringify(readable)).toBe(true);
    }
  }
  const note = contact.locator('[data-directory-edit-field="notes"]');
  await note.focus();
  expect(await note.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await note.click();
  await expect(page.locator('#guestDetailEditTitle')).toContainText('Handover note');
  await expect(page.locator('#guestDetailEditDog')).toContainText('Milo');
  await expect(page.locator('#guestDetailEditTextarea')).toHaveValue(selectedNote);
  await page.locator('#cancelGuestDetailEdit').click();

  await page.locator('#directoryBackToGuestsBtn').click();
  await page.getByRole('tab', { name: /Staying/ }).click();
  await expect(emptyCard.locator('[data-open-directory-profile]')).toBeVisible();
  await emptyCard.locator('[data-open-directory-profile]').click();
  const emptyContact = emptyCard.locator('[data-directory-stay-contact]');
  await emptyContact.locator('summary').click();
  await expect(emptyContact).toContainText('Owner not provided');
  await expect(emptyContact).toContainText('Contact not provided');
  await expect(emptyContact).toContainText('No handover note provided');
  await expect(emptyContact.locator('[data-directory-edit-field="ownerName"]')).toHaveAttribute('data-directory-current-value', '');
  await expect(emptyContact.locator('[data-directory-edit-field="notes"]')).toHaveAttribute('data-directory-current-value', '');
});
