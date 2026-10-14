const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const importedCss = [...runtimeCss.matchAll(/@import url\("([^?]+)[^"]*"\);/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const testCss = `${importedCss}\n${runtimeCss.replace(/@import[^;]+;/g, '')}`;
const stayKey = 'source guest|2026-10-08|2026-10-12';
const dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stayId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function makeProfile(page, { past = false, saveFailure = false, saveMode = 'success', initialSource = 'Other' } = {}) {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(`<style>${testCss}</style><body data-waffle-page="directory" class="">
    <main><article class="directory-card is-profile-active" style="visibility:visible!important" data-directory-stay-key="${stayKey}" data-directory-stay-id="${stayId}" data-directory-dog-id="${dogId}" data-directory-dog-name="Source Guest"${past ? ` data-v1082-past-stay="true" data-v11112-request-source="Other" data-v11112-request-source-known="true" data-v11112-request-source-identity="stable:${stayId}::${dogId}::${stayKey}"` : ''}>
      <div class="directory-card-core" style="visibility:visible!important">${past ? '' : '<section class="directory-care-brief" data-directory-care-brief>Care essentials</section><div data-existing-booking-tools>Booking tools</div>'}<div data-directory-main-panel="profile"><div data-directory-edit-field="notes">Saved care note</div></div></div>
    </article></main></body>`);
  await page.evaluate(({ fail, saveMode, stayId, dogId, initialSource }) => {
    window.setTimeout = () => 0;
    window.V1112_REQUEST_SOURCES = [{ value: 'Google', label: 'Google' }, { value: 'Other', label: 'Other' }];
    window.__profileReads = 0;
    window.__sourceWrites = [];
    window.WAFFLE_CARE_PROFILE_READS = {
      matches: () => true,
      read: async card => {
        window.__profileReads++;
        return { data: { record: { stayKey: card.dataset.directoryStayKey, dogName: 'Source Guest', requestSource: initialSource, identity: { stayKey: card.dataset.directoryStayKey, stayId, dogId } } } };
      }
    };
    window.sendPayloadToAppsScript = async payload => {
      window.__sourceWrites.push(payload);
      if (fail) return { result: 'error', error: 'Source save was rejected by fixture.' };
      if (saveMode === 'deferred') return new Promise(resolve => { window.__resolveSourceSave = resolve; });
      if (saveMode === 'queued') return { result: 'success', queued: true };
      return { result: 'success', requestSource: payload.requestSource };
    };
  }, { fail: saveFailure, saveMode, stayId, dogId, initialSource });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'waffle-v11.1.7.js') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'waffle-v11.1.12.js') });
  const card = page.locator('.directory-card');
  await page.waitForFunction(() => !!window.WAFFLE_V11112);
  await card.evaluate(async node => window.WAFFLE_V11112.hydrateCard(node));
  return card;
}

test('source disclosure preserves keyboard focus and open state across same identity hydration without a toggle read', async ({ page }) => {
  const card = await makeProfile(page, { initialSource: '' });
  const host = page.locator('[data-v11112-care-source-host]');
  expect(await card.evaluate(node => {
    const brief = node.querySelector('[data-directory-care-brief]');
    const first = window.WAFFLE_V11112.ensureStableSourceHost(node);
    const second = window.WAFFLE_V11112.ensureStableSourceHost(node);
    return first === second && first.parentElement === brief.parentElement && brief.nextElementSibling === first && first.nextElementSibling.matches('[data-existing-booking-tools]') && node.querySelectorAll('[data-v11112-care-source-host]').length === 1;
  })).toBeTruthy();
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Not recorded');
  await expect(host.locator('[data-v11112-source-status]')).toBeEmpty();
  const summary = host.locator('[data-v11112-source-details] summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Space');
  await expect(host.locator('[data-v11112-source-details]')).toHaveAttribute('open', '');
  const count = await page.evaluate(() => window.__profileReads);
  await card.evaluate(async node => window.WAFFLE_V11112.hydrateCard(node));
  await expect(host.locator('[data-v11112-source-details]')).toHaveAttribute('open', '');
  await expect(host.locator('[data-v11112-source-details] summary')).toBeFocused();
  expect(await page.evaluate(() => window.__profileReads)).toBe(count);

  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(mode => document.body.classList.toggle('dark-theme', mode === 'dark'), theme);
    const metrics = await host.locator('[data-v11112-source-details] summary').evaluate(node => ({
      target: node.getBoundingClientRect().toJSON(),
      hostWidth: node.closest('[data-v11112-care-source-host]').clientWidth,
      hostScroll: node.closest('[data-v11112-care-source-host]').scrollWidth,
      pageWidth: document.documentElement.clientWidth,
      pageScroll: document.documentElement.scrollWidth
    }));
    expect(metrics.hostScroll, `${theme} ${width}px source`).toBeLessThanOrEqual(metrics.hostWidth + 1);
    expect(metrics.pageScroll, `${theme} ${width}px page`).toBeLessThanOrEqual(metrics.pageWidth + 1);
    expect(metrics.target.height, `${theme} ${width}px target`).toBeGreaterThanOrEqual(44);
  }
});

test('source save sends stable stay identity and waits for acknowledgement before showing Saved', async ({ page }) => {
  const card = await makeProfile(page, { saveMode: 'deferred' });
  const host = page.locator('[data-v11112-care-source-host]');
  const details = host.locator('[data-v11112-source-details]');
  await details.locator('summary').click();
  await details.locator('[data-v1117-profile-source-value="Google"]').click();
  await expect(host.locator('[data-v11112-source-status]')).toHaveText('Saving…');
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other');
  await card.evaluate(node => window.WAFFLE_V11112.renderStableSourceEditor(node, { requestSource: 'Other' }));
  await expect(host.locator('[data-v11112-source-status]')).toHaveText('Saving…');
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other');
  await expect(details.locator('[data-v1117-profile-source-value="Google"]')).toBeDisabled();
  await details.locator('[data-v1117-profile-source-value="Google"]').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.__sourceWrites.length)).toBe(1);
  await page.evaluate(() => window.__resolveSourceSave({ result: 'success', requestSource: 'Google' }));
  await expect(host.locator('[data-v11112-source-status]')).toHaveText('Saved');
  const payload = await page.evaluate(() => window.__sourceWrites[0]);
  expect(payload).toEqual({ action: 'update_request_source', stayKey, dogName: 'Source Guest', requestSource: 'Google' });
  expect(await host.locator('[data-v11112-source-status]').evaluate((node, disclosure) => !disclosure.contains(node), await details.elementHandle())).toBeTruthy();
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Google');

  const failurePage = await page.context().newPage();
  try {
    const failedCard = await makeProfile(failurePage, { saveFailure: true });
    const failedHost = failurePage.locator('[data-v11112-care-source-host]');
    const failedDetails = failedHost.locator('[data-v11112-source-details]');
    await failedDetails.locator('summary').click();
    await failedDetails.locator('[data-v1117-profile-source-value="Google"]').click();
    await expect(failedHost.locator('[data-v11112-source-status]')).toContainText('rejected by fixture');
    expect(await failedHost.locator('[data-v11112-source-status]').evaluate((node, disclosure) => !disclosure.contains(node), await failedDetails.elementHandle())).toBeTruthy();
    await expect(failedHost.locator('[data-v11112-care-source-current]')).toContainText('Other');
    await expect(failedDetails.locator('[data-v1117-profile-source-value="Google"]')).toBeEnabled();
  } finally {
    await failurePage.close();
  }
});

test('late source acknowledgement cannot replace another guest after the same card changes identity', async ({ page }) => {
  const card = await makeProfile(page, { saveMode: 'deferred' });
  const host = page.locator('[data-v11112-care-source-host]');
  const details = host.locator('[data-v11112-source-details]');
  await details.locator('summary').click();
  await details.locator('[data-v1117-profile-source-value="Google"]').click();
  await expect.poll(() => page.evaluate(() => window.__sourceWrites.length)).toBe(1);
  await card.evaluate(node => {
    node.dataset.directoryStayKey = 'other guest|2026-10-08|2026-10-12';
    node.dataset.directoryStayId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    node.dataset.directoryDogId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    window.WAFFLE_V11112.renderStableSourceEditor(node, { requestSource: 'Other Guest Source' });
  });
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other Guest Source');
  await expect(host.locator('[data-v11112-source-status]')).toBeEmpty();
  await page.evaluate(() => window.__resolveSourceSave({ result: 'success', requestSource: 'Google' }));
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other Guest Source');
  await expect(host.locator('[data-v11112-source-status]')).toBeEmpty();
  expect((await page.evaluate(() => window.__sourceWrites[0])).stayKey).toBe(stayKey);
});

test('queued source response never reports Saved or replaces the saved source value', async ({ page }) => {
  await makeProfile(page, { saveMode: 'queued' });
  const host = page.locator('[data-v11112-care-source-host]');
  const details = host.locator('[data-v11112-source-details]');
  await details.locator('summary').click();
  await details.locator('[data-v1117-profile-source-value="Google"]').click();
  await expect(host.locator('[data-v11112-source-status]')).toHaveText('Waiting to sync · saved source unchanged');
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other');
  await expect(host.locator('[data-v1117-profile-source-value="Google"]')).toBeEnabled();
});

test('past stays render as read-only snapshots and synthetic legacy source clicks do not write', async ({ page }) => {
  const card = await makeProfile(page, { past: true });
  const host = page.locator('[data-v11112-care-source-host]');
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Other');
  expect(await page.evaluate(() => window.__profileReads)).toBe(0);
  await expect(host.locator('[data-v11112-source-details]')).toHaveCount(0);
  expect(await card.evaluate(node => node.querySelector('[data-directory-edit-field="notes"]').nextElementSibling === node.querySelector('[data-v11112-care-source-host]'))).toBeTruthy();
  await card.evaluate(node => {
    node.querySelector('[data-v1117-profile-source-picker]')?.insertAdjacentHTML('beforeend', '<div><button data-v1117-profile-source-value="Google">Google</button></div>');
    node.querySelector('[data-v1117-profile-source-value]').click();
  });
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => window.__sourceWrites)).toEqual([]);
  await card.evaluate(node => window.WAFFLE_V11112.renderStableSourceEditor(node, {}));
  await expect(host.locator('[data-v11112-care-source-current]')).toContainText('Source not available');
});
