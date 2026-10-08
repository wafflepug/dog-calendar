const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

// This suite boots the complete versioned runtime; it is a functional check,
// while the separate Care timing suite checks profile performance.
test.setTimeout(90_000);

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  { timestamp: '2026-09-18', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alex Owner', phone: '0400000001', notes: 'Saved Milo care note', bookingType: 'Boarding' },
  { timestamp: '2026-09-18', dogName: 'Nala', breed: 'Labrador', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Bea Owner', phone: '0400000002', notes: 'Saved Nala care note', bookingType: 'Boarding' }
];
const stayKey = booking => `${booking.dogName.toLowerCase()}|${booking.startDate}|${booking.endDate}`;
const csv = () => ['Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type', ...bookings.map(b => [b.timestamp, b.dogName, b.breed, '17/09/2026', '22/09/2026', b.ownerName, b.phone, '', '', b.notes, '', b.bookingType].join(','))].join('\n');

function contrastRatio(foreground, background) {
  const luminance = value => {
    const parts = value.match(/[\d.]+/g)?.map(Number) || [];
    const [r, g, b] = parts.slice(0, 3).map(channel => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function installFixture(page, options = {}) {
  const calls = new Map();
  const requests = new Map();
  const handler = async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
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
      requests.set(action, [...(requests.get(action) || []), payload]);
      const call = (calls.get(action) || 0) + 1;
      calls.set(action, call);
      if (options.failOnce === action && call <= (options.failAttempts || 1)) {
        if (options.delayFailure) await new Promise(resolve => setTimeout(resolve, options.delayFailure));
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify({ result: 'error', error: 'fixture read failure' })});` });
      }
      let response = { result: 'success', records: [], enabled: false };
      if (action === 'get_guest_directory') response = {
        result: 'success', bookings,
        summaries: options.summaryRecords || bookings.map(b => ({ stayKey: stayKey(b), riskFlags: b.dogName === 'Milo' ? { foodAllergy: true } : {} })),
        digitalIntakes: options.digitalIntakes || [], legacyIntakes: options.legacyIntakes || []
      };
      if (action === 'get_guest_profile') {
        const requestedStayKey = String(payload.stayKey || params.get('stayKey') || '');
        const matchingBookings = bookings.filter(booking => stayKey(booking) === requestedStayKey);
        const uniquelyResolved = matchingBookings.length === 1;
        response = {
          result: 'success',
          record: {
            stayKey: requestedStayKey,
            identity: { stayKey: requestedStayKey, stayId: '', dogId: '' },
            resolution: uniquelyResolved
              ? { status: 'resolved', method: 'legacy-key-unique' }
              : { status: 'unresolved', method: 'ambiguous-legacy-key', reason: matchingBookings.length ? 'multiple-bookings-share-stay-key' : 'no-booking-proves-stay-key' },
            intakeAttributes: {},
            intakeAttributesSource: '',
            dogPhoto: null,
            dogPhotoGallery: [],
            stayPhotos: []
          }
        };
      }
      if (action === 'get_intake_statuses') response = { result: 'success', records: options.digitalIntakes || [] };
      if (action === 'get_legacy_intake_statuses') response = { result: 'success', records: options.legacyIntakes || [] };
      if (action === 'get_belongings') response = { result: 'success', records: [] };
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
    }
    if (/^https?:/.test(url)) return route.fulfill({ status: 200, contentType: url.match(/\.css(?:\?|$)/) ? 'text/css' : 'image/svg+xml', body: url.match(/\.css(?:\?|$)/) ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>' });
    return route.continue();
  };
  page.on('request', request => {
    if (request.url().includes('script.google.com') && request.method() !== 'GET' && request.method() !== 'HEAD') throw new Error(`Unexpected write request: ${request.method()} ${request.url()}`);
  });
  return { handler, calls, requests };
}

async function openDirectory(page, baseURL, fixture, width = 390, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
  await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
  await page.route('**/*', fixture.handler);
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toHaveCount(2);
}

async function openRecords(page) {
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const records = card.locator('.directory-care-records-disclosure');
  await records.locator('summary').click();
  return { card, records };
}

test('Records & forms stays readable and keeps real state/action targets at 320, 390 and 1440px in both themes', async ({ page, baseURL }) => {
  // This matrix boots the complete runtime twice; Windows WebKit needs more
  // setup time than the single-journey cases. Behaviour assertions stay unchanged.
  test.setTimeout(180_000);
  const fixture = installFixture(page);
  for (const theme of ['light', 'dark']) {
    await openDirectory(page, baseURL, fixture, 390, theme);
    const { records } = await openRecords(page);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(records.locator('.directory-record-kicker')).toHaveText(['Safety record', 'Digital intake', 'Legacy PDFs']);
      await expect(records.locator('[data-directory-care]')).toContainText('Food Allergy');
      await expect(records.locator('[data-directory-intake]')).toContainText('No digital intake on file');
      await expect(records.locator('[data-create-intake-link]')).toHaveAttribute('aria-label', 'Create Milo intake link');
      await expect(records.locator('[data-directory-legacy]')).toContainText('No legacy PDF on file');
      await expect(records.locator('[data-care-record-upload]')).toHaveText('Upload PDF for OCR');
      const geometry = await records.evaluate(root => ({
        width: [root.clientWidth, root.scrollWidth],
        children: [...root.querySelectorAll('.directory-care-records-body > *')].map(el => ({ className: el.className, bounds: [el.getBoundingClientRect().width, el.scrollWidth, el.clientWidth] })),
        overflow: root.scrollWidth > root.clientWidth,
        buttons: [...root.querySelectorAll('button, a.directory-intake-action')].map(el => {
          const r = el.getBoundingClientRect(); return [r.width, r.height];
        }),
      }));
      expect(geometry.overflow).toBe(false);
      expect(geometry.buttons.every(([w, h]) => Math.round(w * 100) / 100 >= 44 && Math.round(h * 100) / 100 >= 44)).toBe(true);
    }
    await records.locator('summary').focus();
    await page.keyboard.press('Tab');
    // Safari's default Tab policy can skip buttons. Check the same keyboard
    // focus style without depending on the host's Full Keyboard Access setting.
    await records.locator('.directory-care-records-body .directory-intake-action').first().focus();
    const focused = await page.evaluate(() => ({
      isAction: document.activeElement?.matches('.directory-care-records-body .directory-intake-action'),
      outline: getComputedStyle(document.activeElement).outlineStyle
    }));
    expect(focused.isAction).toBe(true);
    expect(focused.outline).not.toBe('none');
  }
});

test('failed uncached digital intake read retries only the selected stay', async ({ page, baseURL }) => {
  const fixture = installFixture(page, { failOnce: 'get_intake_statuses', delayFailure: 100 });
  await openDirectory(page, baseURL, fixture, 390, 'light');
  const { card, records } = await openRecords(page);
  await page.evaluate(() => {
    directoryIntakeStatusCache = {};
    return hydrateDirectoryIntakeStatuses({ force: true });
  });
  const intake = records.locator('[data-directory-intake]');
  await expect(intake).toContainText('Digital intake unavailable');
  const retry = intake.locator('[data-care-record-retry="intake"]');
  await expect(retry).toHaveAttribute('data-stay-key', await records.locator('[data-directory-intake]').getAttribute('data-directory-intake'));
  await retry.click();
  await expect(intake).toContainText('No digital intake on file');
  expect(fixture.calls.get('get_intake_statuses')).toBeGreaterThanOrEqual(2);
  expect(fixture.requests.get('get_intake_statuses').at(-1).stayKeys).toEqual([await card.getAttribute('data-directory-stay-key')]);
  await expect(records.locator('[data-directory-care]')).toContainText('Food Allergy');
  await page.locator('#directoryBackToGuestsBtn').click();
  const nala = page.locator('.directory-card[data-directory-dog-name="Nala"]');
  await expect(nala.locator('[data-directory-intake]')).toContainText('Digital intake unavailable');
});

test('failed legacy read retries only the selected stay', async ({ page, baseURL }) => {
  const fixture = installFixture(page, { failOnce: 'get_legacy_intake_statuses' });
  await openDirectory(page, baseURL, fixture, 390, 'dark');
  const { card, records } = await openRecords(page);
  await page.evaluate(() => {
    directoryLegacyIntakeCache = {};
    return hydrateDirectoryLegacyIntakes({ force: true });
  });
  const legacy = records.locator('[data-directory-legacy]');
  await expect(legacy).toContainText('Legacy PDFs unavailable');
  await legacy.locator('[data-care-record-retry="legacy"]').click();
  await expect(legacy).toContainText('No legacy PDF on file');
  expect(fixture.requests.get('get_legacy_intake_statuses').at(-1).stayKeys).toEqual([await card.getAttribute('data-directory-stay-key')]);
  await expect(legacy.locator('[data-care-record-upload]')).toHaveText('Upload PDF for OCR');
  const legacyStatusReads = fixture.calls.get('get_legacy_intake_statuses') || 0;
});

test('resolved digital and legacy records keep their status, PDF link, review and upload actions', async ({ page, baseURL }) => {
  const key = stayKey(bookings[0]);
  const fixture = installFixture(page, {
    digitalIntakes: [{ stayKey: key, status: 'Awaiting Owner', token: 'fixture-token' }],
    legacyIntakes: [{ stayKey: key, count: 1, latest: { stayKey: key, documentId: 'legacy-milo', uploadedAt: '2026-09-18T10:00:00Z', aiStatus: 'Review Required', conflictCount: 1, pdfUrl: 'https://example.test/milo.pdf' } }]
  });
  await openDirectory(page, baseURL, fixture, 390, 'light');
  const { records } = await openRecords(page);
  await expect(records.locator('[data-directory-intake]')).toContainText('Awaiting owner');
  await expect(records.locator('[data-directory-intake] [data-create-intake-link]')).toHaveAttribute('aria-label', 'Copy Milo intake link');
  await expect(records.locator('[data-directory-legacy]')).toContainText('Legacy PDF on file');
  await expect(records.locator('[data-directory-legacy]')).toContainText(/Review/i);
  await expect(records.locator('[data-directory-legacy] a')).toHaveAttribute('href', 'https://example.test/milo.pdf');
  await expect(records.locator('[data-directory-legacy] [data-care-record-upload]')).toHaveText('Upload PDF for OCR');
  // The shipped compatibility layer retires this administrative action from
  // the visible profile while retaining its existing document target.
  await expect(page.locator('[data-reassign-legacy-intake][data-legacy-document-id="legacy-milo"]').first()).toBeAttached();
});

test('legacy OCR labels are truthful and stay separate from file metadata', async ({ page, baseURL }) => {
  const key = stayKey(bookings[0]);
  const fixture = installFixture(page, {
    digitalIntakes: [{ stayKey: key, status: 'Complete', storedProfileFallback: true, submittedAt: '2026-09-18T10:00:00Z' }],
    legacyIntakes: [{ stayKey: key, count: 3, latest: { stayKey: key, documentId: 'legacy-milo', uploadedAt: '2026-09-18T10:00:00Z', aiStatus: 'Complete', pdfUrl: 'https://example.test/milo.pdf' } }]
  });
  await openDirectory(page, baseURL, fixture, 390, 'light');
  const { records } = await openRecords(page);
  const digital = records.locator('[data-directory-intake]');
  await expect(digital.locator('.directory-record-status')).toHaveText('Intake complete');
  await expect(digital.locator('.directory-record-meta')).toContainText('Stored profile');
  await expect(digital.locator('.directory-record-meta')).toContainText(/18.*2026/);

  const legacy = records.locator('[data-directory-legacy]');
  await expect(legacy.locator('.directory-record-status').first()).toContainText('Legacy PDF on file');
  await expect(legacy.locator('.directory-record-meta')).toContainText('3 files');
  await expect(legacy.locator('.directory-record-meta')).toContainText(/18.*2026/);
  await expect(legacy.locator('.directory-legacy-ai-status')).toHaveText(/OCR complete/i);
  await expect(legacy.locator('.directory-record-status').first()).not.toContainText(/files|18\/09/);

  const legacyStatusReads = fixture.calls.get('get_legacy_intake_statuses') || 0;
  const labels = await page.evaluate(stayKey => {
    const states = [
      ['Review Required', 2], ['AI Failed', 0], ['Processing', 0],
      ['Queued', 0], ['', 0], ['Unrecognized future state', 0],
      ['Saved · Ready for Free OCR', 0], ['Saved · Pending AI', 0], ['Retry Needed', 0]
    ];
    return states.map(([aiStatus, conflictCount]) => {
      setDirectoryLegacyIntakeStatus(stayKey, {
        count: 1,
        latest: { stayKey, documentId: 'legacy-milo', aiStatus, conflictCount }
      });
      const root = document.querySelector(`[data-directory-legacy="${CSS.escape(stayKey)}"]`);
      return {
        aiStatus,
        label: root.querySelector('.directory-legacy-ai-status')?.textContent.trim(),
        retryAction: !!root.querySelector('[data-care-record-retry="legacy"]'),
        primary: root.querySelector('.directory-record-status')?.textContent.trim()
      };
    });
  }, key);
  expect(labels.map(item => item.label)).toEqual([
    '⚠️ OCR needs review · 2 items to review', '⚠️ OCR failed', '⏳ OCR processing',
    '⏳ OCR queued', 'OCR status unavailable', 'OCR status unavailable',
    'OCR not started', '⏳ OCR processing', '⚠️ OCR delayed'
  ]);
  expect(labels.every(item => !item.retryAction)).toBe(true);
  expect(labels.every(item => item.primary.includes('Legacy PDF on file'))).toBe(true);
  await expect(legacy.locator('[data-care-record-upload]')).toHaveText('Upload PDF for OCR');
  for (const theme of ['light', 'dark']) {
    for (const palette of ['waffle-purple', 'coastal-blue', 'eucalyptus', 'sunset-coral', 'warm-honey']) {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await page.evaluate(({ theme, palette }) => {
          document.body.classList.toggle('dark-theme', theme === 'dark');
          document.body.setAttribute('data-waffle-colour-style', palette);
          document.documentElement.setAttribute('data-waffle-colour-style', palette);
          const root = document.querySelector('[data-directory-legacy]');
          const primary = root.querySelector('.directory-record-status');
          const meta = root.querySelector('.directory-record-meta');
          const p = primary.getBoundingClientRect();
          const m = meta.getBoundingClientRect();
          const opaqueBackground = element => {
            const chain = [];
            for (let node = element; node; node = node.parentElement) {
              chain.push(getComputedStyle(node).backgroundColor);
              if (node === document.body) break;
            }
            let bg = [255, 255, 255];
            for (const value of chain.reverse()) {
              const parts = value.match(/[\d.]+/g)?.map(Number) || [];
              if (parts.length < 3) continue;
              const alpha = parts.length > 3 ? parts[3] : 1;
              bg = parts.slice(0, 3).map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha)));
            }
            return `rgb(${bg.join(', ')})`;
          };
          const contrast = element => [getComputedStyle(element).color, opaqueBackground(element)];
          return {
            overflow: root.scrollWidth > root.clientWidth,
            statusAndMetadataSeparate: m.top >= p.bottom - 1,
            status: primary.textContent.trim(),
            metadata: meta.textContent.trim(),
            contrast: [contrast(primary), contrast(meta)],
            actions: [...root.querySelectorAll('.directory-intake-action')].filter(el => el.getClientRects().length).map(el => {
              const r = el.getBoundingClientRect(); return [r.width, r.height];
            })
          };
        }, { theme, palette });
        expect(geometry.overflow, `${theme}/${palette}/${width}: record overflow`).toBe(false);
        expect(geometry.statusAndMetadataSeparate, `${theme}/${palette}/${width}: status and metadata overlap`).toBe(true);
        expect(geometry.status).toContain('Legacy PDF on file');
        expect(geometry.metadata).toContain('1 file');
        expect(geometry.contrast.every(([foreground, background]) => contrastRatio(foreground, background) >= 4.5), `${theme}/${palette}/${width}: status contrast ${JSON.stringify(geometry.contrast)}`).toBe(true);
        expect(geometry.actions.every(([w, h]) => w >= 44 && h >= 44), `${theme}/${palette}/${width}: action targets ${JSON.stringify(geometry.actions)}`).toBe(true);
      }
    }
  }
  expect(fixture.calls.get('get_legacy_intake_statuses') || 0).toBe(legacyStatusReads);
});
test('a failed safety refresh preserves cached alerts and marks uncached stays unavailable', async ({ page, baseURL }) => {
  const fixture = installFixture(page, { failOnce: 'get_belongings', summaryRecords: [{ stayKey: stayKey(bookings[0]), riskFlags: { foodAllergy: true } }] });
  await openDirectory(page, baseURL, fixture, 390, 'light');
  await page.evaluate(() => loadCareRiskDashboard(localStorage.getItem('boardingDataCache') || ''));
  const { records } = await openRecords(page);
  const safety = records.locator('[data-directory-care]');
  await expect(safety).toContainText('Food Allergy');
  await expect(safety).toHaveAttribute('aria-busy', 'false');
  await page.locator('#directoryBackToGuestsBtn').click();
  const nala = page.locator('.directory-card[data-directory-dog-name="Nala"]');
  await nala.locator('[data-open-directory-profile]').click();
  await expect(nala).toHaveClass(/is-profile-active/);
  const nalaSafety = nala.locator('[data-directory-care]');
  await expect(nalaSafety).toContainText('Safety record unavailable');
  await expect(nalaSafety).toHaveAttribute('aria-busy', 'false');
  expect(fixture.requests.get('get_belongings').length).toBeGreaterThan(0);
});

test('collapsed Records & forms does not trigger additional document reads', async ({ page, baseURL }) => {
  const fixture = installFixture(page);
  await openDirectory(page, baseURL, fixture);
  const initialIntakeReads = fixture.calls.get('get_intake_statuses') || 0;
  const initialLegacyReads = fixture.calls.get('get_legacy_intake_statuses') || 0;
  await page.waitForTimeout(150);
  expect(fixture.calls.get('get_intake_statuses') || 0).toBe(initialIntakeReads);
  expect(fixture.calls.get('get_legacy_intake_statuses') || 0).toBe(initialLegacyReads);
});
