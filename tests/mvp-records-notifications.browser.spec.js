const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const palettes = ['waffle-purple', 'coastal-blue', 'eucalyptus', 'sunset-coral', 'warm-honey'];
const viewports = [320, 390, 412, 1440];
const longItems = [
  { id: 'fixture-unread', kind: 'activity', priority: 'urgent', icon: '⚠️', title: 'Important care update for Alexandria Peterson-Smith and exceptionally long dog name', body: 'The owner sent a long update with details that must wrap inside the notification panel without clipping or forcing horizontal scrolling.', category: 'Care update', timestamp: '2026-10-07T02:30:00Z' },
  { id: 'fixture-read', kind: 'activity', icon: '📋', title: 'Record saved', body: 'The saved record is available to the care team.', category: 'Guest records', timestamp: '2026-10-06T02:30:00Z' }
];

function contrastRatio(foreground, background) {
  const rgb = value => {
    const parts = value.match(/[\d.]+/g)?.map(Number) || [];
    if (parts.length < 3) return [0, 0, 0];
    return parts.slice(0, 3).map(channel => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = color => { const [r, g, b] = rgb(color); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function openReadOnlyRuntime(page, baseURL, options = {}) {
  await page.route('**/*', async route => {
    const req = route.request();
    const url = req.url();
    if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type\n' });
    }
    if (url.includes('script.google.com')) {
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const resolved = resolveLocalBackendAction({ method: req.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Read-only fixture blocked unapproved backend action' });
      const response = { result: 'success', records: [], bookings: [], items: resolved.action === 'get_notification_centre' ? longItems : [], enabled: false };
      if (options.failNotificationRead && resolved.action === 'get_notification_centre') Object.assign(response, { result: 'error', error: 'Synthetic notification read failed' });
      const body = `${callback}(${JSON.stringify(response)});`;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body });
    }
    if (/^https?:/.test(url) && !url.startsWith(baseURL)) {
      const isCss = /\.css(?:\?|$)/.test(url);
      return route.fulfill({ status: 200, contentType: isCss ? 'text/css' : 'image/svg+xml', body: isCss ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' });
    }
    return route.continue();
  });
}

async function buildNotificationFixture(page) {
  const rendered = await page.evaluate(async items => {
    if (typeof ensureWaffleNotificationModal !== 'function' || typeof loadWaffleNotificationCentre !== 'function' || typeof renderWaffleNotificationCentre !== 'function') throw new Error('Notification runtime unavailable');
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    await loadWaffleNotificationCentre({ quiet: true });
    waffleNotificationCentreItems = items;
    renderWaffleNotificationCentre();
    return { count: waffleNotificationCentreItems.length, feed: document.querySelector('[data-notification-feed]')?.innerText || '', ids: [...document.querySelectorAll('[data-notification-item-id]')].map(el => el.dataset.notificationItemId) };
  }, longItems);
  expect(rendered.count, JSON.stringify(rendered)).toBe(2);
  await expect(page.locator('#waffleNotificationModal [data-notification-item-id="fixture-unread"]')).toBeVisible();
}

for (const theme of ['light', 'dark']) {
  test(`notification centre remains readable at four widths across five ${theme} palettes`, async ({ page, baseURL }) => {
    await openReadOnlyRuntime(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
    await page.addInitScript(() => localStorage.setItem('waffleNotificationCentreSeenIds', JSON.stringify(['fixture-read'])));
    await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
    await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof renderWaffleNotificationCentre === 'function');
    await buildNotificationFixture(page);

    for (const palette of palettes) {
      for (const width of viewports) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        const metrics = await page.evaluate(({ palette }) => {
          document.documentElement.setAttribute('data-waffle-colour-style', palette);
          document.body.setAttribute('data-waffle-colour-style', palette);
          const modal = document.querySelector('#waffleNotificationModal');
          const dialog = modal.querySelector('[role="dialog"]');
          const targets = [...modal.querySelectorAll('.v101-notification-tab, .v101-notification-panel-actions button, .v101-notification-item, .waffle-notification-close')];
          const text = [...modal.querySelectorAll('.v101-notification-tab, .v101-notification-tab span, .v101-notification-panel-actions, .v101-notification-panel-actions button, .v101-notification-section-heading strong, .v101-notification-section-heading span, .v101-notification-copy strong, .v101-notification-copy > span:not(.v101-notification-title-row), .v101-notification-copy small')];
          const opaqueBackground = element => {
            const chain = [];
            for (let node = element; node && node !== dialog.parentElement; node = node.parentElement) chain.push(getComputedStyle(node).backgroundColor);
            let bg = [255, 255, 255];
            for (const value of chain.reverse()) {
              const parts = value.match(/[\d.]+/g)?.map(Number) || [];
              if (parts.length < 3) continue;
              const alpha = parts.length > 3 ? parts[3] : 1;
              bg = parts.slice(0, 3).map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha)));
            }
            return `rgb(${bg.join(', ')})`;
          };
          return {
            width: [dialog.clientWidth, dialog.scrollWidth],
            textSizes: text.map(el => parseFloat(getComputedStyle(el).fontSize)),
            targets: targets.map(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; }),
            close: (() => { const r = modal.querySelector('.waffle-notification-close').getBoundingClientRect(); return [r.width, r.height]; })(),
            overflow: dialog.scrollWidth > dialog.clientWidth,
            items: [...modal.querySelectorAll('.v101-notification-item')].map(el => ({ id: el.dataset.notificationItemId, unread: el.classList.contains('is-unread'), width: el.clientWidth, scrollWidth: el.scrollWidth })),
            contrast: [
              ...[modal.querySelector('.v101-notification-tab.is-active'), modal.querySelector('.v101-notification-copy > span:not(.v101-notification-title-row)'), modal.querySelector('[data-notification-mark-read]')].map(el => [getComputedStyle(el).color, opaqueBackground(el)])
            ]
          };
        }, { palette });
        expect(metrics.overflow, `${theme}/${palette}/${width}: dialog horizontal overflow`).toBe(false);
        expect(metrics.textSizes.every(size => size >= 13), `${theme}/${palette}/${width}: text sizes ${metrics.textSizes}`).toBe(true);
        expect(metrics.targets.every(([w, h]) => w >= 44 && h >= 44), `${theme}/${palette}/${width}: targets ${JSON.stringify(metrics.targets)}`).toBe(true);
        expect(metrics.close.every(size => size >= 44)).toBe(true);
        expect(metrics.items.find(item => item.id === 'fixture-unread').unread).toBe(true);
        expect(metrics.items.find(item => item.id === 'fixture-read').unread).toBe(false);
        expect(metrics.contrast.every(([foreground, background]) => contrastRatio(foreground, background) >= 4.5), `${theme}/${palette}/${width}: contrast ${JSON.stringify(metrics.contrast)}`).toBe(true);
      }
    }
    await page.locator('[data-notification-mark-read]').focus();
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ visible: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle }));
    expect(focus.visible).toBe(true);
    expect(focus.outline).not.toBe('none');
  });
}

test('mark-read still uses the existing local seen state and preserves the rendered feed', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof renderWaffleNotificationCentre === 'function');
  await buildNotificationFixture(page);
  await page.evaluate(() => markWaffleNotificationCentreRead());
  await expect(page.locator('#waffleNotificationModal [data-notification-item-id="fixture-unread"]')).not.toHaveClass(/is-unread/);
  await expect(page.locator('#waffleNotificationModal [data-notification-item-id="fixture-read"]')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('waffleNotificationCentreSeenIds') || '[]'))).toContain('fixture-unread');
});


test('empty and failed notification reads keep their existing status messaging', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL, { failNotificationRead: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof loadWaffleNotificationCentre === 'function');
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    await loadWaffleNotificationCentre({ quiet: true }).catch(() => {});
  });
  await expect(page.locator('.v101-notification-empty.is-error')).toContainText('Activity could not be refreshed');
  await page.evaluate(() => { waffleNotificationCentreItems = []; renderWaffleNotificationCentre(); });
  await expect(page.locator('.v101-notification-empty:not(.is-error)')).toContainText('Nothing needs your attention');
});
