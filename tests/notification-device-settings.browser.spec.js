const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

async function openFixture(page, baseURL) {
  await page.route('**/*', async route => {
    const req = route.request();
    const url = req.url();
    if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 405, body: 'Fixture blocked write' });
    if (url.includes('script.google.com')) {
      const callback = new URL(url).searchParams.get('callback');
      const action = resolveLocalBackendAction({ method: req.method(), url });
      if (!action.policy.allowed) return route.fulfill({ status: 403, body: 'Fixture blocked backend action' });
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}({result:'success',records:[],bookings:[],items:[]});` });
    }
    if (/^https?:/.test(url) && !url.startsWith(baseURL)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('wafflePushSubscriptionId', 'fixture-device'));
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && typeof hydrateWaffleNotificationSettings === 'function');
}

test('device status failure remains unknown, preserves edits and offers a read retry', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(() => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    const label = modal.querySelector('[data-push-device-label]');
    label.value = 'Local device name';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    modal.querySelector('[data-push-pref="arrivals"]').checked = false;
    modal.querySelector('[data-push-pref="arrivals"]').dispatchEvent(new Event('change', { bubbles: true }));
    window.queryAppsScript = async () => { throw new Error('Synthetic read failure'); };
  });
  await page.evaluate(() => hydrateWaffleNotificationSettings());
  await expect(page.locator('[data-push-message]')).toContainText("Couldn't check this device");
  await expect(page.locator('[data-push-state-retry]')).toBeVisible();
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Local device name');
  await expect(page.locator('[data-push-pref="arrivals"]')).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('wafflePushSubscriptionId'))).toBe('fixture-device');
  await page.evaluate(() => {
    window.deviceReadAttempts = 0;
    window.queryAppsScript = async payload => {
      if (payload.action === 'get_push_device') deviceReadAttempts += 1;
      return { result: 'success', device: { registered: true, enabled: true, deviceLabel: 'Server label', preferences: { ...defaultWafflePushPreferences() } } };
    };
  });
  await page.locator('[data-push-state-retry]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-push-state-retry]')).toBeHidden();
  await expect(page.locator('[data-push-message]')).toBeFocused();
  await expect(page.locator('[data-push-message]')).toContainText('Device registration is active');
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Local device name');
  expect(await page.evaluate(() => deviceReadAttempts)).toBe(1);
});

test('readiness reports browser permission distinctly from server enrollment', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  for (const [permission, expected] of [['default', 'Not enabled'], ['denied', 'Permission blocked'], ['granted', 'Ready']]) {
    await page.evaluate(async permission => {
      const modal = ensureWaffleNotificationModal();
      modal.hidden = false;
      switchWaffleNotificationCentreTab('settings');
      window.WAFFLE_FIREBASE_CONFIG = { apiKey: 'fixture', projectId: 'fixture', messagingSenderId: 'fixture', appId: 'fixture', vapidKey: 'fixture' };
      function FixtureNotification() {}
      FixtureNotification.permission = permission;
      window.Notification = FixtureNotification;
      window.queryAppsScript = async () => ({ result: 'success', device: { registered: true, enabled: true, deviceLabel: 'Server label', preferences: { ...defaultWafflePushPreferences() } } });
      await hydrateWaffleNotificationSettings();
    }, permission);
    await expect(page.locator('[data-push-message]')).toContainText(expected);
    await expect(page.locator('[data-push-message]')).toContainText('Device registration is active');
    if (permission === 'denied') await expect(page.locator('[data-push-enable]')).toBeHidden();
    if (permission === 'default') await expect(page.locator('[data-push-enable]')).toBeVisible();
    if (permission === 'granted') await expect(page.locator('[data-push-test]')).toBeVisible();
  }
  await page.evaluate(async () => {
    function FixtureNotification() {}
    FixtureNotification.permission = 'granted';
    window.Notification = FixtureNotification;
    window.queryAppsScript = async () => ({ result: 'success', device: { registered: false, enabled: false } });
    await hydrateWaffleNotificationSettings();
  });
  await expect(page.locator('[data-push-message]')).toContainText('Not enabled');
  await expect(page.locator('[data-push-message]')).not.toContainText('Ready:');
  await expect(page.locator('[data-push-enable]')).toBeVisible();
  await page.evaluate(async () => {
    window.Notification = undefined;
    await hydrateWaffleNotificationSettings();
  });
  await expect(page.locator('[data-push-message]')).toContainText('Unsupported');
  await expect(page.locator('[data-push-enable]')).toBeHidden();
});

test('missing Firebase setup and iPhone standalone requirements remain explicit', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    function FixtureNotification() {}
    FixtureNotification.permission = 'granted';
    window.Notification = FixtureNotification;
    window.WAFFLE_FIREBASE_CONFIG = null;
    window.queryAppsScript = async () => ({ result: 'success', device: { registered: true, enabled: true, deviceLabel: 'Server label', preferences: { ...defaultWafflePushPreferences() } } });
    await hydrateWaffleNotificationSettings();
  });
  await expect(page.locator('[data-push-message]')).toContainText('notifications are not configured for this app yet');
  await expect(page.locator('[data-push-test]')).toBeHidden();
  await page.evaluate(async () => {
    window.WAFFLE_FIREBASE_CONFIG = { apiKey: 'fixture', projectId: 'fixture', messagingSenderId: 'fixture', appId: 'fixture', vapidKey: 'fixture' };
    window.isWaffleIosDevice = () => true;
    window.isWaffleStandalone = () => false;
    await hydrateWaffleNotificationSettings();
  });
  await expect(page.locator('[data-push-message]')).toContainText('install Waffle House to the iPhone/iPad Home Screen');
  await expect(page.locator('[data-push-test]')).toBeHidden();
});

test('a known disabled device can be re-enabled without a setup code and keeps its device label', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    window.WAFFLE_FIREBASE_CONFIG = { apiKey: 'fixture', projectId: 'fixture', messagingSenderId: 'fixture', appId: 'fixture', vapidKey: 'fixture' };
    function FixtureNotification() {}
    FixtureNotification.permission = 'default';
    window.Notification = FixtureNotification;
    window.queryAppsScript = async () => ({ result: 'success', device: { registered: true, enabled: false, deviceLabel: 'Known device label', preferences: { ...defaultWafflePushPreferences() } } });
    await hydrateWaffleNotificationSettings();
  });
  await expect(page.locator('[data-push-enable]')).toBeVisible();
  await expect(page.locator('[data-push-enrollment-wrap]')).toBeHidden();
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Known device label');
});

test('preference save sends one captured changed payload and reports server acceptance', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    setWafflePushSubscriptionId('fixture-device');
    wafflePushConfirmedSettings = { deviceLabel: 'My browser', preferences: { ...defaultWafflePushPreferences() } };
    modal.querySelector('[data-push-device-label]').value = 'My browser';
    modal.querySelector('[data-push-save]').hidden = false;
    modal.querySelector('[data-push-pref="arrivals"]').checked = false;
    window.saveCalls = [];
    window.queryAppsScript = async payload => {
      if (payload.action === 'update_push_preferences') saveCalls.push(JSON.parse(JSON.stringify(payload)));
      return { result: 'success' };
    };
    await Promise.all([saveWafflePushPreferences(), saveWafflePushPreferences()]);
  });
  expect(await page.evaluate(() => saveCalls.length)).toBe(1);
  expect(await page.evaluate(() => saveCalls[0].preferences.arrivals)).toBe(false);
  await expect(page.locator('[data-push-message]')).toContainText('saved');
  await page.evaluate(() => saveWafflePushPreferences());
  expect(await page.evaluate(() => saveCalls.length)).toBe(1);
});

test('preference rejection preserves the editable value and permits retry', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    wafflePushConfirmedSettings = { deviceLabel: 'My browser', preferences: { ...defaultWafflePushPreferences() } };
    modal.querySelector('[data-push-save]').hidden = false;
    modal.querySelector('[data-push-device-label]').value = 'New label';
    window.queryAppsScript = async () => ({ result: 'error', error: 'Synthetic rejection' });
    await saveWafflePushPreferences();
  });
  await expect(page.locator('[data-push-device-label]')).toHaveValue('New label');
  await expect(page.locator('[data-push-message]')).toContainText('Synthetic rejection');
  await expect(page.locator('[data-push-save]')).toBeEnabled();
});

test('edits made during save remain dirty after the captured request succeeds', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    setWafflePushSubscriptionId('fixture-device');
    wafflePushConfirmedSettings = { deviceLabel: 'My browser', preferences: { ...defaultWafflePushPreferences() } };
    modal.querySelector('[data-push-save]').hidden = false;
    modal.querySelector('[data-push-device-label]').value = 'First edit';
    let finish;
    window.saveCompletion = new Promise(resolve => { finish = resolve; });
    window.queryAppsScript = async payload => {
      if (payload.action === 'get_push_device') return { result: 'success', device: { registered: true, enabled: true, deviceLabel: 'Concurrent server value', preferences: { ...defaultWafflePushPreferences(), arrivals: false } } };
      if (payload.action !== 'update_push_preferences') return { result: 'success', items: [], records: [], bookings: [] };
      window.capturedSave = JSON.parse(JSON.stringify(payload));
      return await saveCompletion;
    };
    window.finishSave = finish;
    window.saveTask = saveWafflePushPreferences();
  });
  await page.locator('[data-push-device-label]').fill('Later edit');
  await page.evaluate(() => hydrateWaffleNotificationSettings());
  expect(await page.evaluate(() => wafflePushConfirmedSettings.deviceLabel)).toBe('My browser');
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Later edit');
  await page.evaluate(() => finishSave({ result: 'success' }));
  await page.evaluate(() => saveTask);
  await expect(page.locator('[data-push-message]')).toContainText('Newer edits are still unsaved');
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Later edit');
  expect(await page.evaluate(() => capturedSave.deviceLabel)).toBe('First edit');
  await expect(page.locator('[data-push-save]')).toBeEnabled();
});

test('a stale preference acknowledgement after disable does not rewrite current settings feedback', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(async () => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    setWafflePushSubscriptionId('fixture-device');
    wafflePushConfirmedSettings = { deviceLabel: 'My browser', preferences: { ...defaultWafflePushPreferences() } };
    modal.querySelector('[data-push-save]').hidden = false;
    modal.querySelector('[data-push-device-label]').value = 'Pending label';
    let finish;
    window.pendingSave = new Promise(resolve => { finish = resolve; });
    window.finishOldSave = finish;
    window.queryAppsScript = async payload => {
      if (payload.action === 'disable_push_device') return { result: 'success' };
      if (payload.action !== 'update_push_preferences') return { result: 'success', items: [], records: [], bookings: [] };
      window.oldSaveStarted = true;
      return await pendingSave;
    };
    window.oldSaveTask = saveWafflePushPreferences();
  });
  await expect.poll(() => page.evaluate(() => oldSaveStarted)).toBe(true);
  await page.evaluate(() => disableWafflePushNotifications());
  await page.evaluate(() => finishOldSave({ result: 'success' }));
  await page.evaluate(() => oldSaveTask);
  expect(await page.evaluate(() => getWafflePushSubscriptionId())).toBe('');
  expect(await page.evaluate(() => wafflePushConfirmedSettings)).toBeNull();
  await expect(page.locator('[data-push-message]')).not.toContainText('Notification preferences saved');
});

test('settings actions and preference controls fill narrow layouts with touch sized actions', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(() => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    window.WAFFLE_FIREBASE_CONFIG = { apiKey: 'fixture', projectId: 'fixture', messagingSenderId: 'fixture', appId: 'fixture', vapidKey: 'fixture' };
    function FixtureNotification() {}
    FixtureNotification.permission = 'default';
    window.Notification = FixtureNotification;
    window.queryAppsScript = async () => ({ result: 'success', device: { registered: false, enabled: false } });
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.body.classList.toggle('dark-theme', theme === 'dark'), theme);
    for (const state of ['new', 'registered']) {
      await page.evaluate(async state => {
        window.Notification.permission = state === 'registered' ? 'granted' : 'default';
        window.queryAppsScript = async () => ({ result: 'success', device: state === 'registered'
          ? { registered: true, enabled: true, deviceLabel: 'Test device', preferences: { ...defaultWafflePushPreferences() } }
          : { registered: false, enabled: false } });
        await hydrateWaffleNotificationSettings();
      }, state);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => { document.querySelector('#waffleNotificationModal [role="dialog"]').style.fontSize = '200%'; });
        const measurements = await page.evaluate(() => {
          const panel = document.querySelector('#waffleNotificationSettingsPanel');
          const dialog = document.querySelector('#waffleNotificationModal [role="dialog"]');
          const actions = [...panel.querySelectorAll('.waffle-notification-actions button')].filter(button => !button.hidden);
          return {
            overflow: dialog.scrollWidth > dialog.clientWidth,
            actions: actions.map(button => { const r = button.getBoundingClientRect(); return [r.width, r.height]; })
          };
        });
        expect(measurements.overflow, `${theme}/${state}/${width}`).toBe(false);
        expect(measurements.actions.length).toBeGreaterThan(0);
        for (const [buttonWidth, height] of measurements.actions) {
          expect(buttonWidth).toBeGreaterThanOrEqual(44);
          expect(height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
});

test('a device check started before saving cannot replace the newer confirmed save', async ({ page, baseURL }) => {
  await openFixture(page, baseURL);
  await page.evaluate(() => {
    const modal = ensureWaffleNotificationModal();
    modal.hidden = false;
    switchWaffleNotificationCentreTab('settings');
    wafflePushConfirmedSettings = { deviceLabel: 'Original label', preferences: { ...defaultWafflePushPreferences() } };
    const input = modal.querySelector('[data-push-device-label]');
    input.value = 'Saved label';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    let resolveRead;
    const readGate = new Promise(resolve => { resolveRead = resolve; });
    window.releaseEarlierDeviceCheck = resolveRead;
    window.queryAppsScript = async payload => {
      if (payload.action === 'get_push_device') return readGate;
      return { result: 'success', items: [], records: [], bookings: [] };
    };
    window.earlierDeviceCheck = hydrateWaffleNotificationSettings();
  });
  await page.evaluate(() => saveWafflePushPreferences());
  await expect(page.locator('[data-push-message]')).toContainText('Notification preferences saved');
  await page.evaluate(() => releaseEarlierDeviceCheck({ result: 'success', device: { registered: true, enabled: true, deviceLabel: 'Original label', preferences: { ...defaultWafflePushPreferences() } } }));
  await page.evaluate(() => earlierDeviceCheck);
  await expect(page.locator('[data-push-device-label]')).toHaveValue('Saved label');
  expect(await page.evaluate(() => wafflePushConfirmedSettings.deviceLabel)).toBe('Saved label');
  await expect(page.locator('[data-push-message]')).toContainText('Notification preferences saved');
});
