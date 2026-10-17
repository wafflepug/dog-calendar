const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const operationRuntime = fs.readFileSync(path.join(root, 'waffle-v11.0.js'), 'utf8');
const earlyRuntime = fs.readFileSync(path.join(root, 'waffle-v11.2.17.js'), 'utf8');
const runtimeCssSource = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const runtimeCssImports = Array.from(runtimeCssSource.matchAll(/@import\s+url\(["']([^"']+)["']\);/g), match => match[1]);
const runtimeCss = [
  ...runtimeCssImports.map(url => fs.readFileSync(path.join(root, url.split('?')[0]), 'utf8')),
  runtimeCssSource.replace(/@import\s+url\(["'][^"']+["']\);/g, '')
].join('\n');
const actionStart = operationRuntime.indexOf('function v110OperationalPayloadFromCard(');
const actionEnd = operationRuntime.indexOf('function v110LeavingEvents(', actionStart);
const productionActions = operationRuntime.slice(actionStart, actionEnd);

function card(id, dogId, startDate, endDate, past = false) {
  return `<article class="directory-card directory-card-fused is-profile-active" data-directory-stay-id="stay-${id}" data-directory-stay-key="twin-pup|${startDate}|${endDate}|${id}" data-directory-dog-id="${dogId}" data-directory-dog-name="Twin Pup" data-directory-start-date="${startDate}" data-directory-end-date="${endDate}" data-v1088-breed="Cavoodle" ${past ? 'data-v1082-past-stay="true"' : ''}>
    <button class="directory-guest-tile-open" data-open-directory-profile><span class="directory-guest-tile-name">Twin Pup</span></button>
    <div class="directory-profile-content">
      <header class="directory-card-header"><div class="directory-photo-shell"><div class="directory-photo-media"><div class="directory-photo-placeholder">🐶</div></div></div><div class="directory-card-identity"><div class="directory-name-row"><button class="directory-dog-name-btn">Twin Pup</button><span class="directory-dog-id">Dog ID ${dogId}</span><span class="directory-status-tag">Staying</span></div><div class="directory-stay-dates directory-profile-stay-dates"><span><strong>Check-in</strong> 17 Oct 2026</span><span><strong>Check-out</strong> 17 Oct 2026</span></div></div></header>
      <section class="directory-care-brief"><h3>Care essentials</h3><div class="directory-care-brief-grid"><section class="directory-care-brief-item directory-care-brief-safety"><h4>Safety</h4><span class="care-brief-alert">⚠ Food allergy</span></section><section class="directory-care-brief-item"><h4>Feeding</h4><p>Breakfast at 8am</p></section></div></section>
    </div>
  </article>`;
}

async function setup(page, theme, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<!doctype html><html data-waffle-ui-ready="true"><head><style>${runtimeCss}</style></head><body data-waffle-page="directory" class="${theme}"><main class="directory-grid directory-grid-fused">${card('a', '11111111-1111-4111-8111-111111111111', '2026-10-17', '2026-10-17')}${card('b', '22222222-2222-4222-8222-222222222222', '2026-10-17', '2026-10-20')}${card('c', '', '2026-10-17', '2026-10-17')}${card('past', '33333333-3333-4333-8333-333333333333', '2026-10-10', '2026-10-12', true)}</main></body></html>`);
  await page.addScriptTag({ content: `
    window.getLocalTodayDateString = () => '2026-10-17';
    window.operations = new Map();
    window.v110OperationForStay = payload => window.operations.get(payload.stayId) || null;
    window.v110Escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    window.formatStayDateShort = value => value;
    window.v110MasterCache = {};
    window.v110CheckoutCollisions = new Set();
    window.v110IsCheckoutCollision = () => false;
    window.v110OperationIdentityConflicts = {};
    window.v110FormatTime = value => String(value || '');
    ${productionActions}
    window.v110OperationalPayloadFromCard = v110OperationalPayloadFromCard;
    window.v110OperationDisplayState = v110OperationDisplayState;
    window.v110EnsureCareOperationBar = v110EnsureCareOperationBar;
    window.v110EnhanceCareCard = () => {};
  ` });
  await page.addScriptTag({ content: earlyRuntime });
  const enhancerInstalled = await page.evaluate(() => typeof window.v110EnsureCareOperationBar === 'function');
  expect(enhancerInstalled).toBeTruthy();
  await page.evaluate(() => Array.from(document.querySelectorAll('.directory-card')).forEach(card => window.v110EnsureCareOperationBar(card)));
  await expect(page.locator('[data-v110-operation-bar]')).toHaveCount(3);
}

test('selected Care profile keeps Check In primary and groups secondary checkout actions without changing their targets', async ({ browser, browserName }) => {
  test.setTimeout(45000);
  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage();
      try {
      await setup(page, theme, width);
      const dueToday = page.locator('[data-directory-stay-id="stay-a"]');
      const longerStay = page.locator('[data-directory-stay-id="stay-b"]');
      const missingDogId = page.locator('[data-directory-stay-id="stay-c"]');
      const pastStay = page.locator('[data-directory-stay-id="stay-past"]');

      await expect(dueToday.locator('[data-v110-checkin]')).toBeVisible();
      await expect(dueToday.locator('[data-v110-checkout]')).toHaveCount(1);
      await expect(dueToday.locator('.v11217-profile-more-actions > summary')).toHaveText('More actions');
      const dueMore = dueToday.locator('.v11217-profile-more-actions > summary');
      await dueMore.focus();
      await page.keyboard.press('Enter');
      await expect(dueToday.locator('.v11217-profile-more-actions')).toHaveAttribute('open', '');
      await expect(dueToday.locator('.v11217-profile-more-actions [data-v110-checkout]')).toBeVisible();
      expect(await dueToday.locator('.v11217-profile-more-actions [data-v110-checkout]').evaluate(button => button.closest('.directory-card').dataset.directoryStayId)).toBe('stay-a');
      await expect(missingDogId.locator('[data-v110-checkin]')).toBeVisible();
      expect(await missingDogId.locator('[data-v110-checkin]').evaluate(button => button.closest('.directory-card').dataset.directoryDogId)).toBe('');
      await expect(pastStay.locator('[data-v110-operation-bar]')).toHaveCount(0);

      const checkIn = dueToday.locator('[data-v110-checkin]');
      await checkIn.focus();
      const checkInHandle = await checkIn.elementHandle();
      const mutationCount = await dueToday.evaluate(async card => {
        let count = 0;
        const observer = new MutationObserver(records => { count += records.length; });
        observer.observe(card.querySelector('[data-v110-operation-bar]'), { childList: true, subtree: true, attributes: true });
        window.v110EnsureCareOperationBar(card);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        observer.disconnect();
        return count;
      });
      expect(mutationCount).toBe(0);
      expect(await checkInHandle.evaluate(button => button.isConnected && document.activeElement === button)).toBeTruthy();
      await expect(dueToday.locator('.v11217-profile-more-actions')).toHaveAttribute('open', '');
      await checkIn.evaluate(button => { button.disabled = true; });
      await dueToday.evaluate(card => window.v110EnsureCareOperationBar(card));
      expect(await checkInHandle.evaluate(button => button.isConnected && button.disabled)).toBeTruthy();
      await checkIn.evaluate(button => { button.disabled = false; });

      await expect(longerStay.locator('[data-v110-checkin]')).toBeVisible();
      await expect(longerStay.locator('[data-v110-checkout]')).toHaveCount(0);
      await expect(longerStay.locator('.v11217-profile-more-actions [data-v11217-early-checkout]')).toHaveCount(1);
      await longerStay.locator('.v11217-profile-more-actions > summary').click();
      await expect(longerStay.locator('.v11217-profile-more-actions [data-v11217-early-checkout]')).toBeVisible();
      expect(await longerStay.locator('.v11217-profile-more-actions [data-v11217-early-checkout]').evaluate(button => button.closest('.directory-card').dataset.directoryStayId)).toBe('stay-b');

      await page.evaluate(() => {
        window.operations.set('stay-b', {
          stayId: 'stay-b', stayKey: 'twin-pup|2026-10-17|2026-10-20|b',
          status: 'checked_in', checkedInAt: '2026-10-17T01:00:00Z'
        });
        window.v110EnsureCareOperationBar(document.querySelector('[data-directory-stay-id="stay-b"]'));
      });
      await expect(longerStay.locator('[data-v110-checkin], .v11217-profile-more-actions')).toHaveCount(0);
      await expect(longerStay.locator('[data-v11217-early-checkout]')).toBeVisible();

      await page.evaluate(() => {
        window.operations.set('stay-a', {
          stayId: 'stay-a', stayKey: 'twin-pup|2026-10-17|2026-10-17|a', status: 'checked_in'
        });
        window.v110EnsureCareOperationBar(document.querySelector('[data-directory-stay-id="stay-a"]'));
      });
      await expect(dueToday.locator('.v110-operation-actions > [data-v110-checkout]')).toBeVisible();
      await expect(dueToday.locator('.v11217-profile-more-actions')).toHaveCount(0);

      await page.evaluate(() => {
        window.operations.delete('stay-a');
        window.operations.delete('stay-b');
        window.v110EnsureCareOperationBar(document.querySelector('[data-directory-stay-id="stay-a"]'));
        window.v110EnsureCareOperationBar(document.querySelector('[data-directory-stay-id="stay-b"]'));
      });
      await expect(dueToday.locator('.v11217-profile-more-actions')).not.toHaveAttribute('open');
      await expect(longerStay.locator('.v11217-profile-more-actions')).not.toHaveAttribute('open');

      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        photo: document.querySelector('[data-directory-stay-id="stay-a"] .directory-photo-shell').getBoundingClientRect(),
        name: document.querySelector('[data-directory-stay-id="stay-a"] .directory-dog-name-btn').getBoundingClientRect(),
        nameFontSize: getComputedStyle(document.querySelector('[data-directory-stay-id="stay-a"] .directory-dog-name-btn')).fontSize,
        action: document.querySelector('[data-directory-stay-id="stay-a"] [data-v110-checkin]').getBoundingClientRect(),
        moreAction: document.querySelector('[data-directory-stay-id="stay-a"] .v11217-profile-more-actions > summary').getBoundingClientRect(),
        dates: Array.from(document.querySelectorAll('[data-directory-stay-id="stay-a"] .directory-profile-stay-dates strong')).map(node => node.textContent)
      }));
      expect(layout.document).toBeLessThanOrEqual(layout.viewport);
      expect(layout.dates).toEqual(['Check-in', 'Check-out']);
      expect(layout.action.height).toBeGreaterThanOrEqual(44);
      if (width <= 390) expect(layout.photo.width).toBeLessThanOrEqual(64);
      expect(layout.nameFontSize).toBe(width <= 600 ? '16px' : '20px');
      expect(layout.moreAction.height).toBeGreaterThanOrEqual(44);
      expect(layout.name.height).toBeGreaterThan(0);
      expect(layout.name.width).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(root, 'output', `care-profile-opening-${browserName}-${width}-${theme || 'light'}.png`), fullPage: true });
      } finally {
        await page.close();
      }
    }
  }
});
