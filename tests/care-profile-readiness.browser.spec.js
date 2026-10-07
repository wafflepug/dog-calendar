const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const helperStart = source.indexOf('function setDirectoryProfileReadStatus');
const loadStart = source.indexOf('async function loadDirectoryProfileDetail');
const loadEnd = source.indexOf('async function loadDirectoryBelongingsDetail', loadStart);
const profileCode = source.slice(helperStart, loadStart) + source.slice(loadStart, loadEnd);
const rawStart = source.indexOf('function queryAppsScriptRaw');
const rawEnd = source.indexOf('function queryAppsScript(', rawStart);
const rawCode = source.slice(rawStart, rawEnd);

test('profile shell and saved attributes remain usable through a delayed failed refresh', async ({ page }) => {
  await page.setContent(`
    <article class="directory-card" data-stay-key="milo|2026-09-20|2026-09-22">
      <section data-directory-detail="profile">
        <div data-directory-intake-attributes><div>Saved allergy: Chicken</div></div>
      </section>
    </article>
  `);
  await page.evaluate(() => {
    window.directoryProfileDetailCache = {};
    window.directorySelectedProfileStayKey = 'milo|2026-09-20|2026-09-22';
    window.renderDirectoryIntakeAttributes = (card, record) => {
      card.querySelector('[data-directory-intake-attributes]').textContent =
        record.intakeAttributes?.allergy || 'No saved allergy';
    };
    window.reconcileDirectoryDigitalIntakeFromProfile = () => {};
    window.setDirectoryDetailLoading = () => {};
    window.setDirectoryDetailError = () => {};
    window.escapeDashboardHtml = value => String(value || '');
    window.requestCount = 0;
    window.queryAppsScriptSWR = async (payload, options) => {
      window.requestCount += 1;
      await options.onCached({ record: { stayKey: payload.stayKey, intakeAttributes: { allergy: 'Chicken' } } });
      await new Promise(resolve => setTimeout(resolve, 250));
      throw new Error('delayed fixture timeout');
    };
  });
  await page.addScriptTag({ content: profileCode + '\nwindow.loadDirectoryProfileDetail = loadDirectoryProfileDetail;' });
  const pending = page.evaluate(() => window.loadDirectoryProfileDetail(
    document.querySelector('.directory-card'),
    document.querySelector('[data-directory-detail="profile"]'),
    { force: true }
  ));
  await page.waitForTimeout(50);
  await expect(page.locator('[data-directory-intake-attributes]')).toHaveText('Chicken');
  await expect(page.locator('[data-directory-profile-read-status]')).toHaveText(/refreshing/);
  await pending;
  await expect(page.locator('[data-directory-intake-attributes]')).toHaveText('Chicken');
  await expect(page.locator('[data-directory-profile-read-status]')).toHaveText(/Unable to refresh saved details/);
  await expect(page.locator('[data-retry-directory-profile-read]')).toBeVisible();
  expect(await page.evaluate(() => window.requestCount)).toBe(1);
});

test('late JSONP profile response is retired without a page error', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error));
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: `${rawCode}\nwindow.queryAppsScriptRaw = queryAppsScriptRaw;` });
  await page.evaluate(() => {
    window.APPS_SCRIPT_WEBAPP_URL = 'https://example.test/exec';
    document.body.appendChild = script => {
      setTimeout(() => {
        const callback = new URL(script.src).searchParams.get('callback');
        window.lateCallbackName = callback;
        window[callback]({ result: 'success' });
        script.dispatchEvent(new Event('load'));
      }, 50);
      return script;
    };
    return window.queryAppsScriptRaw(
      { action: 'get_guest_profile', stayKey: 'milo|2026-09-20|2026-09-22' },
      { maxAttempts: 1, timeoutMs: 10, lateCallbackGraceMs: 20 }
    ).catch(() => null);
  });
  await page.waitForTimeout(100);
  expect(pageErrors).toHaveLength(0);
  expect(await page.evaluate(() => window[window.lateCallbackName])).toBeUndefined();
});

test('a late callback from a timed-out JSONP attempt cannot override its retry', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error));
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: `${rawCode}\nwindow.queryAppsScriptRaw = queryAppsScriptRaw;` });
  const result = await page.evaluate(() => {
    window.APPS_SCRIPT_WEBAPP_URL = 'https://example.test/exec';
    window.jsonpScripts = [];
    window.lateCallbackRetired = false;
    document.body.appendChild = script => {
      const attempt = window.jsonpScripts.push(script);
      const callback = new URL(script.src).searchParams.get('callback');
      if (attempt === 1) {
        setTimeout(() => {
          window[callback]({ result: 'success', source: 'late first attempt' });
          script.dispatchEvent(new Event('load'));
          window.lateCallbackRetired = window[callback] === undefined;
        }, 1500);
      } else {
        setTimeout(() => {
          window[callback]({ result: 'success', source: 'retry' });
          script.dispatchEvent(new Event('load'));
        }, 20);
      }
      return script;
    };
    return window.queryAppsScriptRaw(
      { action: 'get_guest_profile', stayKey: 'milo|2026-09-20|2026-09-22' },
      { maxAttempts: 2, timeoutMs: 100 }
    );
  });
  expect(result.source).toBe('retry');
  await expect.poll(() => page.evaluate(() => window.lateCallbackRetired)).toBe(true);
  expect(pageErrors).toHaveLength(0);
});
