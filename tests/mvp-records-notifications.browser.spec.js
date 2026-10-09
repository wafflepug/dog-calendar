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
      if (resolved.action === 'get_notification_centre') {
        options.notificationReadCount = (options.notificationReadCount || 0) + 1;
        if (options.notificationDelay) await new Promise(resolve => setTimeout(resolve, options.notificationDelay));
        if (options.failNotificationRead) Object.assign(response, { result: 'error', error: 'Synthetic notification read failed' });
      }
      const body = `${callback}(${JSON.stringify(response)});`;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body });
    }
    if (/^https?:/.test(url) && !url.startsWith(baseURL)) {
      const isCss = /\.css(?:\?|$)/.test(url);
      return route.fulfill({ status: 200, contentType: isCss ? 'text/css' : 'image/svg+xml', body: isCss ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' });
    }
    return route.continue();
  });
  return options;
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


test('cached refresh failure preserves the feed and offers a working retry', async ({ page, baseURL }) => {
  const fixture = await openReadOnlyRuntime(page, baseURL, { failNotificationRead: false });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.evaluate(async items => { ensureWaffleNotificationModal(); await putWaffleCachedResponse('notifications:centre', { result: 'success', items }); }, longItems);
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  fixture.failNotificationRead = true;
  await page.evaluate(() => openWaffleNotificationCentre());
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'cached-refresh-failure');
  await expect(page.locator('[data-notification-load-status]')).toContainText('Showing saved notifications');
  await expect(page.locator('[data-notification-item-id="fixture-unread"]')).toBeVisible();
  const before = await page.locator('[data-notification-feed]').innerText();
  await page.locator('[data-notification-mark-read]').click();
  const seenAfterMarkRead = await page.evaluate(() => localStorage.getItem('waffleNotificationCentreSeenIds'));
  await expect(page.locator('[data-notification-centre-count]')).toHaveText('Refresh failed');
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'cached-refresh-failure');

  fixture.failNotificationRead = false;
  await page.locator('[data-notification-refresh]').click();
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'fresh');
  await expect(page.locator('[data-notification-centre-count]')).toHaveText('Up to date');
  expect(await page.locator('[data-notification-feed]').innerText()).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('waffleNotificationCentreSeenIds'))).toBe(seenAfterMarkRead);
  const size = await page.locator('[data-notification-refresh]').evaluate(button => { const rect = button.getBoundingClientRect(); return [rect.width, rect.height]; });
  expect(size[0]).toBeGreaterThanOrEqual(44);
  expect(size[1]).toBeGreaterThanOrEqual(44);
});

test('uncached notification failures show retry and preserve any current feed', async ({ page, baseURL }) => {
  const fixture = await openReadOnlyRuntime(page, baseURL, { failNotificationRead: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.evaluate(() => openWaffleNotificationCentre());
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'uncached-failure');
  await expect(page.locator('[data-notification-load-status]')).toContainText('could not be loaded');
  await expect(page.locator('[data-notification-item-id]')).toHaveCount(0);
  await expect(page.locator('[data-notification-refresh]')).toHaveText('Retry');

  fixture.failNotificationRead = false;
  await page.locator('[data-notification-refresh]').click();
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'fresh');
  await expect(page.locator('[data-notification-item-id="fixture-unread"]')).toBeVisible();

  await page.evaluate(items => {
    localStorage.setItem('waffleNotificationCentreSeenIds', JSON.stringify(['kept-seen']));
    waffleNotificationCentreItems = items;
    renderWaffleNotificationCentre();
    return removeWaffleCachedResponse('notifications:centre');
  }, longItems);
  await page.evaluate(async () => await removeWaffleCachedResponse('notifications:centre'));
  const before = await page.locator('[data-notification-feed]').innerText();
  fixture.failNotificationRead = true;
  await page.evaluate(async () => loadWaffleNotificationCentre({ quiet: true }).catch(() => {}));
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'uncached-failure');
  await expect(page.locator('[data-notification-load-status]')).toContainText('current notifications are still shown');
  expect(await page.locator('[data-notification-feed]').innerText()).toBe(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('waffleNotificationCentreSeenIds')))).toEqual(['kept-seen']);
  fixture.failNotificationRead = false;
  await page.locator('[data-notification-refresh]').click();
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'fresh');
});


test('offline notification cache stays labelled saved until an online retry succeeds', async ({ page, baseURL }) => {
  const fixture = await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  await page.evaluate(async items => {
    ensureWaffleNotificationModal();
    await putWaffleCachedResponse('notifications:centre', { result: 'success', items });
  }, longItems);
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  const readsBeforeOffline = fixture.notificationReadCount;

  await page.context().setOffline(true);
  await page.evaluate(() => openWaffleNotificationCentre());
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'cached-refresh-failure');
  await expect(page.locator('[data-notification-load-status]')).toHaveText('Showing saved notifications. Reconnect to refresh.');
  await expect(page.locator('[data-notification-item-id="fixture-unread"]')).toBeVisible();
  expect(fixture.notificationReadCount).toBe(readsBeforeOffline);

  await page.locator('[data-notification-refresh]').click();
  await expect(page.locator('[data-notification-load-status]')).toHaveText('Showing saved notifications. Reconnect to refresh.');
  expect(fixture.notificationReadCount).toBe(readsBeforeOffline);

  await page.context().setOffline(false);
  await page.locator('[data-notification-refresh]').click();
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'fresh');
  expect(fixture.notificationReadCount).toBe(readsBeforeOffline + 1);
});

test('notification open, tab activation, and manual refresh share one in-flight read', async ({ page, baseURL }) => {
  const fixture = await openReadOnlyRuntime(page, baseURL, { notificationDelay: 150 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.waitForFunction(() => !waffleNotificationCentreLoadPromise);
  fixture.notificationReadCount = 0;
  await page.evaluate(() => {
    openWaffleNotificationCentre();
    activateWaffleNotificationCentreTab('inbox');
    retryWaffleNotificationCentre();
  });
  await expect(page.locator('[data-notification-load-status]')).toHaveAttribute('data-state', 'fresh');
  expect(fixture.notificationReadCount).toBe(1);
});

test('notification tabs expose reciprocal panel semantics and support keyboard navigation', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof renderWaffleNotificationCentre === 'function');

  const state = await page.evaluate(() => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    const tabs = [...modal.querySelectorAll('[role="tab"]')];
    const panels = [...modal.querySelectorAll('[role="tabpanel"]')];
    return {
      tabs: tabs.map(tab => ({ id: tab.id, controls: tab.getAttribute('aria-controls'), selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex })),
      panels: panels.map(panel => ({ id: panel.id, labelledBy: panel.getAttribute('aria-labelledby'), hidden: panel.hidden }))
    };
  });
  expect(state.tabs).toHaveLength(2);
  expect(state.panels).toHaveLength(2);
  for (const tab of state.tabs) {
    expect(tab.id).toBeTruthy();
    expect(state.panels.some(panel => panel.id === tab.controls && panel.labelledBy === tab.id)).toBe(true);
  }
  expect(state.tabs.map(tab => tab.tabIndex).sort()).toEqual([-1, 0]);
  expect(state.tabs.filter(tab => tab.selected === 'true')).toHaveLength(1);
  expect(state.panels.filter(panel => !panel.hidden)).toHaveLength(1);

  const inbox = page.getByRole('tab', { name: /Inbox/ });
  const settings = page.getByRole('tab', { name: 'Settings' });
  await inbox.focus();
  await page.keyboard.press('ArrowRight');
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
  await page.keyboard.press('Home');
  await expect(inbox).toBeFocused();
  await expect(inbox).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(settings).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(inbox).toBeFocused();
});

test('notification dialog focuses on open, traps Tab at both ends, and restores focus on close paths', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL + '/directory.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');

  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'notificationLifecycleTestOpener';
    opener.textContent = 'Open notification centre';
    document.body.appendChild(opener);
    opener.focus();
    openWaffleNotificationCentre();
  });
  const modal = page.locator('#waffleNotificationModal');
  const tabs = modal.getByRole('tab');
  const close = modal.getByRole('button', { name: 'Close notifications' });
  const lastItem = modal.locator('[data-notification-item-id="fixture-read"]');
  await expect(modal.getByRole('dialog')).toBeVisible();
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(tabs.first()).toBeFocused();
  await expect(lastItem).toBeVisible();
  await lastItem.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(lastItem).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.locator('#notificationLifecycleTestOpener')).toBeFocused();

  for (const closePath of ['close', 'backdrop']) {
    await page.evaluate(() => {
      document.getElementById('notificationLifecycleTestOpener').focus();
      openWaffleNotificationCentre();
    });
    if (closePath === 'close') await close.click();
    else await modal.click({ position: { x: 4, y: 4 } });
    await expect(modal).toBeHidden();
    await expect(page.locator('#notificationLifecycleTestOpener')).toBeFocused();
  }
});

test('notification dialog ignores nested Escape and restores focus when its opener is hidden or removed', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL + '/directory.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'notificationFallbackTestOpener';
    opener.textContent = 'Open notifications';
    document.body.appendChild(opener);
    opener.focus();
    openWaffleNotificationCentre();
    const nested = document.createElement('div');
    nested.setAttribute('role', 'dialog');
    nested.setAttribute('aria-modal', 'true');
    nested.innerHTML = '<button id="nestedDialogAction">Nested action</button>';
    document.querySelector('#waffleNotificationModal [role="dialog"]').appendChild(nested);
    nested.querySelector('button').focus();
  });
  const modal = page.locator('#waffleNotificationModal');
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await expect(page.locator('#nestedDialogAction')).toBeFocused();
  await modal.getByRole('button', { name: 'Close notifications' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('#notificationFallbackTestOpener')).toBeFocused();

  for (const disposition of ['hidden', 'removed']) {
    await page.evaluate(disposition => {
      const opener = document.getElementById('notificationFallbackTestOpener');
      opener.hidden = false;
      opener.focus();
      openWaffleNotificationCentre();
      if (disposition === 'hidden') opener.hidden = true;
      else opener.remove();
    }, disposition);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page.locator('#wh75MenuButton')).toBeFocused();
  }
});

test('notification Settings action remains reachable above mobile navigation in short landscape', async ({ page, baseURL }) => {
  await openReadOnlyRuntime(page, baseURL);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(baseURL + '/directory.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof openWaffleNotificationCentre === 'function');
  await page.evaluate(() => openWaffleNotificationCentre('settings'));

  const modal = page.locator('#waffleNotificationModal');
  const settingsTab = modal.getByRole('tab', { name: 'Settings' });
  await settingsTab.click();
  const action = modal.locator('.waffle-notification-actions button:not([hidden]):not([disabled])').last();
  await expect(action).toBeVisible();

  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 390 }]) {
    await page.setViewportSize(viewport);
    await action.scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const modal = document.querySelector('#waffleNotificationModal');
      const dialog = modal.querySelector('[role="dialog"]');
      const action = [...dialog.querySelectorAll('.waffle-notification-actions button:not([hidden]):not([disabled])')].filter(el => el.getClientRects().length).at(-1);
      const nav = document.getElementById('wh75MobileBottomNav');
      const actionRect = action.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const navVisible = !!nav && getComputedStyle(nav).display !== 'none' && navRect.height > 0;
      const intersectsNav = navVisible && actionRect.bottom > navRect.top && actionRect.top < navRect.bottom;
      return {
        viewport: [innerWidth, innerHeight],
        action: [actionRect.top, actionRect.bottom],
        actionInViewport: actionRect.height > 0 && actionRect.top >= 0 && actionRect.bottom <= innerHeight,
        intersectsNav,
        modalAboveNav: !intersectsNav || Number(getComputedStyle(modal).zIndex) > Number(getComputedStyle(nav).zIndex)
      };
    });
    expect(geometry.actionInViewport, JSON.stringify(geometry)).toBe(true);
    expect(geometry.modalAboveNav, JSON.stringify(geometry)).toBe(true);
  }
});
