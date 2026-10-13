const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const operations = read('waffle-v11.0.js').split('/* Master profile */')[0];
const pastSource = read('waffle-v10.8.6.js');
const moveStart = pastSource.indexOf('function v1086MoveCheckedOutStayToPast(');
const moveEnd = pastSource.indexOf('\n/*', moveStart);
const moveToPast = pastSource.slice(moveStart, moveEnd);
const runtimeCss = read('waffle-runtime.css');
const css = [...runtimeCss.matchAll(/@import url\("([^?]+)[^"]*"\);/g)].map(match => read(match[1])).join('\n') + '\n' + runtimeCss.replace(/@import[^;]+;/g, '');
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
async function setup(page, dark = false) {
  await page.setContent(`<html data-waffle-ui-ready="true"><head><style>${css}</style></head><body data-waffle-page="directory" class="${dark ? 'dark-theme' : ''}"><div id="directoryTabPanel" class="app-tab-panel active"><div id="directory-grid">${ids.map((id, i) => `<article class="directory-card directory-card-fused" data-directory-stay-id="${id}" data-directory-dog-id="dog-${i}" data-directory-stay-key="twin|2026-10-10|2026-10-11" data-directory-dog-name="Twin" data-directory-start-date="2026-10-10" data-directory-end-date="2026-10-11"><button class="directory-guest-tile-open directory-roster-row" data-open-directory-profile><span class="directory-guest-tile-name">Twin</span></button><section class="directory-profile-content"><div class="directory-card-header"></div></section></article>`).join('')}</div><div id="past-directory-grid"></div></div></body></html>`);
  await page.evaluate(() => {
    window.WAFFLE_PAGE = 'directory';
    window.globalCalendar = null;
    window.v1082PastResponse = {};
    window.renderV10OperationsHome = () => {};
    window.applyGuestDirectoryResponse = () => {};
    window.getLocalTodayDateString = () => '2026-10-11';
    window.formatStayDateShort = value => value;
    window.escapeDashboardHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
    window.v10EventRawDates = event => ({start:event.extendedProps.rawStartDate,end:event.extendedProps.rawEndDate});
    window.profileOpens = 0;
    document.addEventListener('click', event => { if (event.target.closest('[data-open-directory-profile]')) window.profileOpens++; });
    window.readActions = [];
    window.queryAppsScript = async payload => { window.readActions.push(payload.action); return {result:'success',versions:{stayOperationIdentityVersion:1}}; };
    window.sent = [];
    window.hold = false;
    window.fail = false;
    window.sendPayloadToAppsScript = async payload => {
      window.sent.push(payload);
      if (window.hold) await new Promise(resolve => window.release = resolve);
      if (window.fail) throw new Error('Synthetic write failure');
      return {result:'success',record:{...payload,status:payload.action==='checkin_stay'?'checked_in':'checked_out',updatedAt:'2026-10-11T01:00:00Z',checkedInAt:'2026-10-11T01:00:00Z',checkedOutAt:'2026-10-11T01:00:00Z'}};
    };
    window.invalidateWaffleClientCaches = async () => {};
    window.showWaffleForegroundPush = () => {};
    window.alerts = [];
    window.alert = message => window.alerts.push(message);
    window.confirm = () => true;
    window.v1086UpdateCareStayCounts = () => {};
    window.filterGuestDirectoryCards = () => {};
  });
  await page.addScriptTag({content:operations});
  await page.addScriptTag({content:moveToPast});
  await page.addScriptTag({content:read('waffle-v11.2.17.js')});
  await expect(page.locator('[data-v11217-roster-actions]')).toHaveCount(2);
}
for (const width of [360, 1280]) {
  test(`canonical roster writes and checkout use distinct Stay IDs at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:800});
    await setup(page, width === 360);
    const card = page.locator(`[data-directory-stay-id="${ids[0]}"]`);
    const checkin = card.locator('[data-v11217-roster-checkin]');
    await expect(checkin).toBeVisible();
    const box = await checkin.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({path:path.join(root,'output',`care-roster-actions-${width}.png`),fullPage:true});
    await page.evaluate(() => window.hold = true);
    await checkin.click();
    await expect(card.locator('[data-v11217-roster-checkout]')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.sent.length)).toBe(1);
    await page.evaluate(() => {window.hold=false;window.release();});
    await expect(checkin).toHaveCount(0);
    await expect(card.locator('[data-v11217-roster-checkout]')).toBeEnabled();
    await card.locator('[data-v11217-roster-checkout]').click();
    await expect(page.locator(`#past-directory-grid [data-directory-stay-id="${ids[0]}"]`)).toHaveCount(1);
    await expect(card.locator('[data-v11217-roster-actions]')).toHaveCount(0);
    await expect(page.locator(`[data-directory-stay-id="${ids[1]}"] [data-v11217-roster-checkin]`)).toBeEnabled();
    expect(await page.evaluate(() => window.sent.map(payload => [payload.action,payload.stayId,payload.dogId]))).toEqual([['checkin_stay',ids[0],'dog-0'],['checkout_stay',ids[0],'dog-0']]);
    expect(await page.evaluate(() => window.profileOpens)).toBe(0);
    expect(await page.evaluate(() => window.readActions)).toEqual(['get_data_versions','get_data_versions']);
  });
}
test('offline and failed writes retain the active stay and restore both actions', async ({page}) => {
  await setup(page);
  const card = page.locator(`[data-directory-stay-id="${ids[0]}"]`);
  await page.context().setOffline(true);
  await card.locator('[data-v11217-roster-checkin]').click();
  await expect.poll(() => page.evaluate(() => window.alerts.join(' '))).toMatch(/live connection/);
  expect(await page.evaluate(() => window.sent.length)).toBe(0);
  await page.context().setOffline(false);
  await page.evaluate(() => window.fail = true);
  await card.locator('[data-v11217-roster-checkout]').click();
  await expect.poll(() => page.evaluate(() => window.alerts.join(' '))).toMatch(/Synthetic write failure/);
  await expect(card.locator('[data-v11217-roster-checkin]')).toBeEnabled();
  await expect(card.locator('[data-v11217-roster-checkout]')).toBeEnabled();
  await expect(page.locator('#past-directory-grid .directory-card')).toHaveCount(0);
  await page.evaluate(() => window.fail = false);
  await card.locator('[data-v11217-roster-checkin]').click();
  await expect(card.locator('[data-v11217-roster-checkin]')).toHaveCount(0);
});

test('same-stay duplicate saves are rejected while a different pet remains independent', async ({page}) => {
  await setup(page);
  await page.evaluate(() => {
    window.pendingReleases = {};
    window.sendPayloadToAppsScript = async payload => {
      window.sent.push(payload);
      await new Promise(resolve => window.pendingReleases[payload.stayId] = resolve);
      return {result:'success',record:{...payload,status:'checked_in',updatedAt:'2026-10-11T01:00:00Z'}};
    };
    window.pendingWrites = [];
    for(const card of document.querySelectorAll('#directory-grid .directory-card')) {
      window.pendingWrites.push(window.v110SaveOperationalStatus(window.v110OperationalPayloadFromCard(card),'checked_in',card));
    }
  });
  await expect.poll(() => page.evaluate(() => window.sent.length)).toBe(2);
  const duplicate = await page.evaluate(async () => {
    const card=document.querySelector('#directory-grid .directory-card');
    try {await window.v110SaveOperationalStatus(window.v110OperationalPayloadFromCard(card),'checked_in',card);return 'unexpected';}
    catch(error){return error.message;}
  });
  expect(duplicate).toMatch(/already being saved/);
  await page.evaluate(id => window.pendingReleases[id](),ids[0]);
  await expect(page.locator(`[data-directory-stay-id="${ids[0]}"] [data-v11217-roster-checkin]`)).toHaveCount(0);
  await expect(page.locator(`[data-directory-stay-id="${ids[1]}"] [data-v11217-roster-checkin]`)).toBeDisabled();
  await page.evaluate(id => window.pendingReleases[id](),ids[1]);
  await page.evaluate(() => Promise.all(window.pendingWrites));
  expect(await page.evaluate(() => window.sent.length)).toBe(2);
});
