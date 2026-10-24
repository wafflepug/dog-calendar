const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const css = runtimeCss.replace(/@import url\("([^"]+)"\);/g, (_match, source) =>
  fs.readFileSync(path.join(root, source.split('?')[0]), 'utf8')
);
const appSource = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const careFlags = appSource.slice(appSource.indexOf('    const CARE_SAFETY_FLAGS ='), appSource.indexOf('    ];', appSource.indexOf('    const CARE_SAFETY_FLAGS =')) + 6);
const summaryHelpers = appSource.slice(appSource.indexOf('    const directorySummaryHtmlState ='), appSource.indexOf('    function renderDirectoryCareBrief('));
const renderer = appSource.slice(appSource.indexOf('    function renderDirectoryCareBrief(card)'), appSource.indexOf('    function openCareReadinessTarget'));
for (const productionMarker of ['data-care-brief-walks', 'directory-care-brief-feeding-walks', 'directory-care-owner-inline', 'Feeding &amp; walks']) {
  if (!appSource.includes(productionMarker)) throw new Error(`Care brief fixture no longer matches production template: ${productionMarker}`);
}

const briefHtml = `
<article class="directory-card is-profile-active" data-stay-key="milo|stay" data-directory-stay-key="milo|stay" data-v1088-phone="0400000000">
  <section class="directory-care-brief" data-directory-care-brief aria-label="Care essentials">
    <div class="directory-care-brief-heading"><h3>Care essentials</h3><span data-care-brief-freshness></span></div>
    <details class="directory-care-readiness"><summary><span>Booking setup</span><strong data-care-readiness-summary></strong></summary><div data-care-readiness-list><div data-care-readiness-item="intake"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div><div data-care-readiness-item="handover"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div></div></details>
    <div class="directory-care-brief-grid">
      <section class="directory-care-brief-item directory-care-brief-safety"><div class="directory-care-brief-note-heading"><h4>Safety</h4></div><div data-care-brief-safety></div></section>
      <section class="directory-care-brief-item"><h4>Medication</h4><p data-care-brief-medication></p></section>
      <section class="directory-care-brief-item directory-care-brief-feeding-walks"><h4>Feeding &amp; walks</h4><div class="directory-care-brief-subsection"><div data-care-brief-feeding></div></div><div class="directory-care-brief-subsection"><div data-care-brief-walks></div></div></section>
      <section class="directory-care-brief-item directory-care-owner-item"><h4>Owner</h4><div class="directory-care-owner-inline"><strong data-care-brief-owner-name></strong><span data-care-brief-call-owner></span></div></section>
    </div>
  </section>
  <div data-directory-detail="profile" data-profile-read-state="saved"></div>
</article>`;

async function setupBrief(page) {
  await page.setContent(`<!doctype html><html data-waffle-ui-ready="true"><head><style>${css}</style></head><body data-waffle-page="directory"><main>${briefHtml}</main></body></html>`);
  await page.addScriptTag({ content: `
    ${careFlags}
    ${summaryHelpers}
    const careRiskRecordsCache = { 'milo|stay': { riskFlags: { foodAllergy: true } } };
    const belongingsRecordsCache = {};
    const directorySummaryRecordsCache = {};
    const directoryProfileDetailCache = {};
    window.fixture = { intakeAttributes: {
      medicationInstructions: 'Give one tablet with dinner. If appetite changes, do not repeat the dose; call the owner before the next meal. Keep the medicine in its labelled pouch.',
      feedingTimes: '07:00 and 17:00', foodAmount: '1 measured cup',
      foodBrandType: 'Sensitive formula with a gradual ten day transition from the previous food, mixed in measured portions at each meal',
      walksPerDay: '2 walks', walkDuration: '30 minutes each'
    } };
    function getDirectoryProfileReadIdentity(card) { return { stayKey: card.dataset.stayKey, cacheKey: card.dataset.stayKey, hasStableIds: window.useStableIdentity === true }; }
    function directoryProfileIdentityIsAmbiguous() { return false; }
    function getDirectoryCareBriefRecord() { return window.fixture; }
    function getDirectoryValidatedCareProfileRecord() { return window.fixture; }
    function getActiveCareFlags(record) { return record?.riskFlags?.foodAllergy ? [{ className: 'is-alert', icon: '⚠️', label: 'Food allergy' }] : []; }
    function getDirectoryCareBriefFreshness() { return { text: 'Saved record · update time unknown', state: 'saved' }; }
    function normalizeDirectoryPhoneForTel(value) { return String(value || '').replace(/[^0-9+]/g, ''); }
    function markDirectoryProfileIdentityConflict() {}
    function escapeDashboardHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
    ${renderer}
    window.renderBrief = renderDirectoryCareBrief;
    renderBrief(document.querySelector('.directory-card'));
  ` });
}

test('care essentials lead with exceptions, preserve full medication, and label feeding and walks at phone and desktop sizes', async ({ page }) => {
  await setupBrief(page);
  const card = page.locator('.directory-card');
  const brief = card.locator('[data-directory-care-brief]');
  const medication = brief.locator('[data-care-brief-medication]');
  await expect(brief.locator('[data-care-brief-safety] .care-brief-alert')).toHaveCount(1);
  await expect(brief.locator('[data-care-brief-safety]')).toContainText('Food allergy');
  await expect(medication).toHaveText('Give one tablet with dinner. If appetite changes, do not repeat the dose; call the owner before the next meal. Keep the medicine in its labelled pouch.');
  const feedingRoutine = brief.locator('[data-care-brief-feeding] [data-care-routine-values]');
  const walkingRoutine = brief.locator('[data-care-brief-walks] [data-care-routine-values]');
  await expect(feedingRoutine.locator('details, summary')).toHaveCount(0);
  await expect(walkingRoutine.locator('details, summary')).toHaveCount(0);
  await expect(brief.locator('[data-care-brief-feeding] [data-care-brief-row="times"]')).toContainText('Times: 07:00 and 17:00');
  await expect(brief.locator('[data-care-brief-feeding] [data-care-brief-row="amount"]')).toContainText('Amount: 1 measured cup');
  await expect(feedingRoutine).toContainText('Sensitive formula with a gradual ten day transition from the previous food, mixed in measured portions at each meal');
  const routineStability = await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const host = card.querySelector('[data-care-brief-feeding]');
    const routine = host.querySelector('[data-care-routine-values]');
    const observer = new MutationObserver(() => {});
    observer.observe(host, { subtree: true, childList: true, characterData: true, attributes: true });
    window.renderBrief(card);
    const mutations = observer.takeRecords().length;
    observer.disconnect();
      return { sameNode: host.querySelector('[data-care-routine-values]') === routine, mutations };
  });
  expect(routineStability).toEqual({ sameNode: true, mutations: 0 });
  const routineIdentity = await page.evaluate(() => {
    window.fixture.intakeAttributes.foodBrandType = 'Updated routine food transition with a complete gradual introduction over ten days in small, measured portions at each meal';
    const card = document.querySelector('.directory-card');
    window.renderBrief(card);
    const updatedValue = card.querySelector('[data-care-brief-feeding] [data-care-brief-row="food"]')?.textContent;
    card.dataset.stayKey = 'milo|different-stay';
    card.dataset.directoryStayKey = 'milo|different-stay';
    window.renderBrief(card);
    return { updatedValue, newIdentityValue: card.querySelector('[data-care-brief-feeding] [data-care-brief-row="food"]')?.textContent };
  });
  expect(routineIdentity.updatedValue).toContain('Updated routine food transition');
  expect(routineIdentity.newIdentityValue).toContain('Updated routine food transition');

  await page.evaluate(() => {
    window.useStableIdentity = true;
    window.fixture.identity = { stayKey: 'milo|different-stay', stayId: 'stay-id', dogId: 'dog-id' };
    window.fixture.resolution = { status: 'resolved', method: 'stable-id' };
    window.fixture.riskFlags = { foodAllergy: true };
    window.renderBrief(document.querySelector('.directory-card'));
  });
  await expect(brief.locator('[data-care-brief-safety]')).toContainText('Food allergy');
  await page.evaluate(() => {
    window.fixture.riskFlags = { foodAllergy: 'yes' };
    window.renderBrief(document.querySelector('.directory-card'));
  });
  await expect(brief.locator('[data-care-brief-safety]')).toHaveText('Safety status unavailable');
  await expect(brief.locator('[data-care-brief-safety]')).not.toContainText('Food allergy');
  await expect(brief.locator('[data-care-brief-walks] [data-care-brief-row="walks"]')).toContainText('Walks: 2 walks');
  await expect(brief.locator('[data-care-brief-walks] [data-care-brief-row="duration"]')).toContainText('Duration: 30 minutes each');
  const order = await brief.locator('.directory-care-brief-grid > .directory-care-brief-item').evaluateAll(items => items.map(item => item.querySelector('h4')?.textContent?.trim()));
  expect(order.slice(0, 3)).toEqual(['Safety', 'Medication', 'Feeding & walks']);

  for (const theme of ['', 'dark-theme']) {
    await page.locator('body').evaluate((body, className) => { body.className = className; }, theme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await feedingRoutine.evaluate(node => { node.open = false; });
      await walkingRoutine.evaluate(node => { node.open = false; });
      await expect(medication).toBeVisible();
      const layout = await medication.evaluate(node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { width: rect.width, right: rect.right, lineClamp: style.webkitLineClamp, overflow: style.overflow, maxHeight: style.maxHeight, height: rect.height, scrollHeight: node.scrollHeight };
      });
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.right).toBeLessThanOrEqual(width + 1);
      expect(layout.lineClamp).toBe('none');
      expect(layout.overflow).not.toBe('hidden');
      expect(layout.maxHeight).toBe('none');
      expect(layout.height).toBeGreaterThan(0);
      expect(layout.scrollHeight).toBeLessThanOrEqual(layout.height + 1);
      for (const routine of [feedingRoutine, walkingRoutine]) {
        await expect(routine).toBeVisible();
        const geometry = await routine.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return { width: rect.width, right: rect.right, height: rect.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
        });
        expect(geometry.width).toBeGreaterThan(0);
        expect(geometry.right).toBeLessThanOrEqual(width + 1);
        expect(geometry.height).toBeGreaterThan(0);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
        expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
      }
      if ([390, 1440].includes(width)) {
        const output = path.join(root, 'output', 'releases', '2026.10.23.06');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, `care-priorities-${width}-${theme || 'light'}.png`), fullPage: false });
      }
    }
  }

  await page.evaluate(() => {
    window.fixture = { intakeAttributes: { medicationInstructions: 'Private instructions', feedingTimes: '06:30', foodAmount: '', foodBrandType: '', walksPerDay: '2 walks', walkDuration: '' } };
    const card = document.querySelector('.directory-card');
    card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'saved';
    window.renderBrief(card);
  });
  await expect(brief.locator('[data-care-brief-feeding] [data-care-brief-row="times"]')).toContainText('Times: 06:30');
  await expect(brief.locator('[data-care-brief-feeding] [data-care-brief-row="amount"]')).toContainText('Amount: Not recorded');
  await expect(brief.locator('[data-care-brief-walks] [data-care-brief-row="walks"]')).toContainText('Walks: 2 walks');
  await expect(brief.locator('[data-care-brief-walks] [data-care-brief-row="duration"]')).toContainText('Duration: Not recorded');
  await page.evaluate(() => {
    window.fixture = { intakeAttributes: {} };
    window.renderBrief(document.querySelector('.directory-card'));
  });
  await expect(brief.locator('[data-care-brief-feeding]')).toHaveText('No feeding instructions saved');
  await expect(brief.locator('[data-care-brief-walks]')).toHaveText('No walking instructions saved');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.profileIdentityBlocked = card.dataset.stayKey;
    card.dataset.profileIdentityBlockedReason = 'conflict';
    card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'identity-conflict';
    window.renderBrief(card);
  });
  await expect(medication).toHaveText('Care record needs identity review');
  await expect(brief).not.toContainText('Private instructions');
});


test('owner contact uses quiet missing text and restores the real phone action without a read', async ({ page }) => {
  await setupBrief(page);
  await page.locator('.directory-card').evaluate(card => { card.dataset.v1088Phone = ''; window.renderBrief(card); });
  const host = page.locator('[data-care-brief-call-owner]');
  await expect(host).toHaveText('Phone unavailable');
  await expect(host.locator('button,a,[aria-disabled]')).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(host.locator('.directory-owner-contact-missing')).toBeVisible();
    expect(await host.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await page.locator('.directory-card').evaluate(card => { card.dataset.v1088Phone = '+61 400 123 456'; window.renderBrief(card); });
  await expect(host.getByRole('link', { name: 'Call owner', exact: true })).toHaveAttribute('href', 'tel:+61400123456');
  await page.locator('.directory-card').evaluate(card => { card.dataset.v1088Phone = ''; window.renderBrief(card); });
  await expect(host).toHaveText('Phone unavailable');
  await expect(host.getByRole('link')).toHaveCount(0);
});
