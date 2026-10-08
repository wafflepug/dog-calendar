const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'waffle-v10.8.js'), 'utf8');
const historyCss = fs.readFileSync(path.join(root, 'waffle-v10.8.css'), 'utf8');
const evidenceDir = path.join(root, 'evidence', 'care-overview');
fs.mkdirSync(evidenceDir, { recursive: true });
const careFlags = appSource.slice(appSource.indexOf('const CARE_SAFETY_FLAGS'), appSource.indexOf('];', appSource.indexOf('const CARE_SAFETY_FLAGS')) + 2);
const intakeGroups = appSource.slice(appSource.indexOf('const INTAKE_ATTRIBUTE_UI_GROUPS'), appSource.indexOf('];', appSource.indexOf('const INTAKE_ATTRIBUTE_UI_GROUPS')) + 2);
const profileTabs = appSource.slice(appSource.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS'), appSource.indexOf('];', appSource.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS')) + 2);
const intakeControl = appSource.slice(appSource.indexOf('function intakeAttributeControlHtml'), appSource.indexOf('function renderDirectoryIntakeAttributes'));
const categorySummary = appSource.slice(appSource.indexOf('function directoryCareCategorySummary'), appSource.indexOf('function renderDirectoryIntakeAttributes'));
const intakeRenderer = appSource.slice(appSource.indexOf('function renderDirectoryIntakeAttributes'), appSource.indexOf('function renderDirectoryCareProfile'));
const careRenderer = appSource.slice(appSource.indexOf('function renderDirectoryCareProfile'), appSource.indexOf('function renderDirectoryBelongings'));
const profileSubtabSwitch = appSource.slice(appSource.indexOf('function switchDirectoryProfileSubTab'), appSource.indexOf('async function openDirectoryGuestProfile'));
const actualRenderer = `${careFlags}\n${intakeGroups}\n${profileTabs}\nlet careRiskRecordsCache = {};\nconst directorySafetyReadFailures = new Set();\nconst directorySummaryRecordsCache = {};\nconst belongingsRecordsCache = {};\nconst applyDirectoryProfileEditMode = () => {};\nconst restoreDirectoryProfileEditDraft = () => {};\nfunction escapeDashboardHtml(value){return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}\n${categorySummary}\n${profileSubtabSwitch}\n${intakeControl}\n${intakeRenderer}\n${careRenderer}\nwindow.renderDirectoryIntakeAttributes = renderDirectoryIntakeAttributes;\nwindow.setCategorySafetyRecord = (key, record) => { careRiskRecordsCache[key] = record; directorySafetyReadFailures.delete(key); };\nwindow.setCategorySafetyFailure = key => directorySafetyReadFailures.add(key);\nwindow.summarizeCareCategory = directoryCareCategorySummary;`;
const briefIdentityGuard = appSource.slice(appSource.indexOf('function getDirectoryProfileReadIdentity(card)'), appSource.indexOf('async function loadDirectoryProfileDetail('));
const careBriefRecordHelper = appSource.slice(appSource.indexOf('function getDirectoryCareBriefRecord(card)'), appSource.indexOf('function normalizeDirectoryPhoneForTel'));
const briefFreshnessHelpers = appSource.slice(appSource.indexOf('function getDirectoryCareBriefFreshness('), appSource.indexOf('function renderDirectoryCareBrief(card)'));
const briefRenderer = appSource.slice(appSource.indexOf('function renderDirectoryCareBrief(card)'), appSource.indexOf('function openCareReadinessTarget'));
const belongingsItems = appSource.slice(appSource.indexOf('const BELONGINGS_ITEMS'), appSource.indexOf('];', appSource.indexOf('const BELONGINGS_ITEMS')) + 2);
const belongingsRenderer = appSource.slice(appSource.indexOf('function renderDirectoryBelongings'), appSource.indexOf('function renderDirectoryOperationalSections'));

test('Belongings recovery controls wrap, remain touch-sized, and expose keyboard focus in both themes', async ({ page }) => {
  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<style>${css}</style><body class="${theme}"><main class="directory-card" data-stay-key="stay-a" style="padding:12px"><section data-directory-detail="belongings"><div data-directory-belongings></div></section></main></body>`);
      await page.addScriptTag({ content: `${belongingsItems}\nconst careRiskRecordsCache={},directorySummaryRecordsCache={}; const uncertainBelongingsPhotoUploads=new Map(),hostedPendingPhotoConfirmations=new Map([['stay-a',{}]]); function renderDirectoryCareProfile(){} function restoreBelongingsItemDraft(){} function syncHostedPhotoSessionControls(){} function setBelongingsUploadCheckVisible(){} function escapeDashboardHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}\n${belongingsRenderer}` });
      await page.evaluate(() => renderDirectoryBelongings(document.querySelector('.directory-card'), {items:{},photos:[]}));
      const buttons = page.locator('[data-save-belongings], [data-discard-belongings-draft], [data-confirm-hosted-photo]');
      await expect(buttons).toHaveCount(3);
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await page.locator('[data-confirm-hosted-photo]').focus();
      await expect(page.locator('[data-confirm-hosted-photo]')).toHaveCSS('outline-style', 'solid');
      const backgrounds = await page.locator('[data-save-belongings], [data-discard-belongings-draft]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
      expect(backgrounds[0]).not.toBe(backgrounds[1]);
    }
  }
});
const readinessNavigator = appSource.slice(appSource.indexOf('function openCareReadinessTarget'), appSource.indexOf('function findDirectoryCareElement'));
const briefTestCode = `
  const directoryProfileDetailCache = {};
  const belongingsRecordsCache = {};
  const directorySummaryRecordsCache = {};
  const careRiskRecordsCache = {};
  const escapeDashboardHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  function getActiveCareFlags(record) { return [{key:'foodAllergy', label:'Food allergy', icon:'⚠', className:'is-danger'}].filter(flag => record?.riskFlags?.[flag.key]); }
  function normalizeDirectoryPhoneForTel(value) { return String(value || '').replace(/[^+\\d]/g, ''); }
  ${briefIdentityGuard}
  ${careBriefRecordHelper}
  ${briefFreshnessHelpers}
  ${briefRenderer}
  window.renderBrief = renderDirectoryCareBrief;
  window.seedBriefFixture = card => { directoryProfileDetailCache['stay-a'] = { stayKey: 'stay-a', intakeAttributes: { feedingTimes: '7 am', foodAmount: '1 cup', medicationInstructions: 'With dinner' }, intakeAttributesSource: 'Saved profile' }; careRiskRecordsCache['stay-a'] = { riskFlags: { foodAllergy: true } }; card.dataset.intakeMethod = 'legacy'; renderDirectoryCareBrief(card); card.dataset.briefDebug = JSON.stringify({ key: card.dataset.stayKey, safety: card.querySelector('[data-care-brief-safety]')?.innerText, flags: careRiskRecordsCache['stay-a'] }); };
`;
function fixture(theme = '') {
  return `<!doctype html><html><head><style>
    ${css}
  </style></head><body class="${theme}"><main class="directory-card is-profile-active" data-stay-key="stay-a" data-directory-source-row="4"><div class="directory-profile-content">
    <header class="directory-card-header"><div class="directory-photo-shell"><div class="directory-photo-media"><img class="directory-dog-photo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23cbd5e1'/%3E%3C/svg%3E" alt="Milo"></div></div><div class="directory-card-identity"><div class="directory-name-row"><button class="directory-dog-name-btn">A very long dog name that must wrap without clipping</button><span class="directory-dog-id">Dog ID #00017</span><span class="directory-status-tag tag-checked-out">Checked Out</span></div><button class="directory-primary-breed">Border Collie</button><div class="directory-stay-dates">📅 20 Sep 2026 – 22 Sep 2026</div></div></header>
    <section class="directory-care-brief" data-directory-care-brief aria-label="Care readiness"><div class="directory-care-brief-heading"><div><span class="directory-profile-section-kicker">Selected guest</span><h3>Care overview</h3></div><span class="directory-care-brief-freshness" data-care-brief-freshness role="status" aria-live="polite">Care details available · Saved profile</span></div><div class="directory-care-brief-grid"><section class="directory-care-brief-item directory-care-brief-safety" data-state="attention"><div class="directory-care-brief-note-heading"><h4>Safety</h4><button class="directory-care-brief-note-edit" data-care-readiness-action="safety">Review</button></div><div class="directory-care-brief-value" data-care-brief-safety data-state="attention"><span class="care-brief-alert">⚠ Food allergy</span></div></section><section class="directory-care-brief-item"><h4>Feeding</h4><p class="directory-care-brief-value" data-care-brief-feeding>7 am · 1 cup</p></section><section class="directory-care-brief-item"><h4>Medication</h4><p class="directory-care-brief-value" data-care-brief-medication>With dinner</p></section><section class="directory-care-brief-item"><h4>Owner</h4><p class="directory-care-brief-value directory-care-brief-contact"><strong>Alexandria Peterson-Smith</strong><span>0400 123 456</span></p></section><section class="directory-care-brief-item directory-care-brief-note"><div class="directory-care-brief-note-heading"><h4>Handover note</h4><button class="directory-care-brief-note-edit" data-care-brief-action="handover">Update</button></div><p class="directory-care-brief-value">Call before pickup.\nMedication is in the blue bag.</p></section></div><details class="directory-care-readiness"><summary><span>Other setup checks</span><strong data-care-readiness-summary>1 to review</strong></summary><div class="directory-care-readiness-list" data-care-readiness-list><div data-care-readiness-item="intake"><span data-care-readiness-status></span><small data-care-readiness-detail></small></div><div data-care-readiness-item="handover"><span data-care-readiness-status></span><small data-care-readiness-detail></small></div></div></details><div class="directory-care-brief-actions"><button class="directory-care-brief-action is-primary">Care details</button><a class="directory-care-brief-action" href="tel:+61400123456">Call owner</a><details class="directory-care-more-actions"><summary>More actions</summary></details></div></section>
    <div class="directory-attributes-grid directory-core-attributes"><button class="directory-attribute"><span class="directory-field-label">Owner</span><span class="directory-field-value">Alexandria Peterson-Smith with a very long family name</span></button><button class="directory-attribute"><span class="directory-field-label">Contact</span><span class="directory-field-value">0400 123 456</span></button><button class="directory-attribute directory-attribute-wide"><span class="directory-field-label">Notes</span><span class="directory-field-value">Long care notes wrap here and remain discoverable for the sitter.</span></button></div>
    <section class="directory-profile-section"><div class="directory-profile-section-heading"><div><span class="directory-profile-section-kicker">Guest profile</span><h4>📋 Profile &amp; Care</h4></div><div class="directory-profile-section-tools"><button class="directory-profile-edit-toggle">✏️ Edit</button></div></div><div data-directory-detail="profile" data-directory-main-panel="profile"><div data-intake-profile-summary></div><div data-directory-intake-attributes><div>Loading profile…</div></div></div></section>
  </div></main></body></html>`;
}

test('Care overview wraps long values and keeps controls usable at phone widths', async ({ page }) => {
  for (const theme of ['', 'dark-theme']) for (const width of [390, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture(theme));
    await page.addScriptTag({ content: actualRenderer });
    await page.evaluate(() => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: { medicationInstructions: 'Give after dinner; call owner if appetite changes.' }, intakeAttributesSource: 'Synthetic saved fixture' }));
    await expect(page.locator('[data-care-brief-safety]')).toContainText('Food allergy');
    await expect(page.locator('[data-care-brief-feeding]')).toContainText('7 am');
    if ([390, 412, 1440].includes(width)) await page.screenshot({ path: path.join(evidenceDir, `care-overview-${theme || 'light'}-${width}.png`), fullPage: true });
    await expect(page.locator('.directory-profile-section-heading h4')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.directory-field-value').first()).toHaveCSS('font-size', '14px');
    await expect(page.locator('.intake-profile-control').first()).toHaveAttribute('placeholder', 'Not provided');
    await expect(page.locator('.care-category-toggle')).toHaveCount(4);
    expect(await page.locator('.care-category-toggle').evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-expanded') === 'false'))).toBeTruthy();
    await page.locator('[data-profile-subtab="foodWalks"]').click();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toHaveCSS('contain', 'none');
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeHidden();
    await page.locator('[data-profile-subtab="behaviour"]').click();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeVisible();
    await expect(page.locator('[data-intake-attribute="feedingTimes"]')).toBeVisible();
    await expect(page.locator('[data-intake-attribute="friendlyDogs"]')).toBeVisible();
    await page.evaluate(() => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: { medicationInstructions: 'Updated saved fixture' }, intakeAttributesSource: 'Synthetic saved fixture' }));
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeVisible();
    const behaviourToggle = page.locator('[data-profile-subtab="behaviour"]');
    await behaviourToggle.focus();
    await behaviourToggle.press('Enter');
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeHidden();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await expect(behaviourToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(behaviourToggle).toBeFocused();
    await behaviourToggle.press('Space');
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeVisible();
    await expect(behaviourToggle).toHaveAttribute('aria-expanded', 'true');
    const identityLayout = await page.evaluate(() => {
      if (document.documentElement.scrollWidth > innerWidth) return false;
      return ['.directory-dog-name-btn', '.directory-primary-breed', '.directory-stay-dates'].map(selector => {
        const el = document.querySelector(selector);
        const style = getComputedStyle(el);
        return { selector, width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
      });
    });
    expect(identityLayout.every(item => item.scrollWidth <= item.width + 1 && item.scrollHeight <= item.height + 2 && item.textOverflow !== 'ellipsis' && item.whiteSpace !== 'nowrap')).toBeTruthy();
    const cardMetrics = await page.evaluate(() => ({
      photo: document.querySelector('.directory-photo-shell').getBoundingClientRect(),
      dogPhotoObjectFit: getComputedStyle(document.querySelector('.directory-dog-photo')).objectFit,
      nameFontSize: getComputedStyle(document.querySelector('.directory-dog-name-btn')).fontSize,
      chips: [...document.querySelectorAll('.directory-name-row > .directory-dog-id, .directory-name-row > .directory-status-tag')].map(node => ({ box: node.getBoundingClientRect(), fontSize: getComputedStyle(node).fontSize, whiteSpace: getComputedStyle(node).whiteSpace })),
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(cardMetrics.photo.width).toBe(width <= 520 ? 72 : 88);
    expect(cardMetrics.dogPhotoObjectFit).toBe('cover');
    expect(cardMetrics.nameFontSize).toBe('22px');
    expect(cardMetrics.chips.every(chip => chip.fontSize === '11px' && chip.whiteSpace !== 'nowrap')).toBeTruthy();
    expect(cardMetrics.chips.every(chip => chip.box.right <= width && chip.whiteSpace !== 'nowrap')).toBeTruthy();
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(width);
    await page.locator('button').first().focus();
    expect(await page.locator('button').first().evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    if ([390, 412, 1440].includes(width)) await page.screenshot({ path: path.join(evidenceDir, `care-details-${theme || 'light'}-${width}.png`), fullPage: true });
  }
});

test('curated Care summaries surface sitter instructions and keep disclosures readable at every target width', async ({ page }) => {
  const attributes = {
    feedingTimes: '06:30 before the morning walk and 18:00 after the evening walk',
    foodAmount: '1 cup at each meal',
    walksPerDay: '2 walks',
    walkDuration: '30 minutes each',
    triggersFears: '<b>Thunder</b> and unfamiliar delivery workers; give a little space and approach slowly. '.repeat(2),
    aggression: 'No',
    foodAggression: 'No',
    separationAnxiety: 'Yes',
    medicationInstructions: 'Give with dinner and call the owner if appetite changes. '.repeat(3),
    medicalConditions: 'Seasonal allergies; watch for itching. '.repeat(2),
    sleepLocation: 'On the mat beside the bedroom door',
    offLeashAllowed: 'No',
    crateTrained: 'Yes',
    emergencyContact: 'Owner details should not appear in the health summary',
    emergencyPhone: '0400 123 456'
  };

  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      await page.setContent(fixture(theme));
      await page.addScriptTag({ content: actualRenderer });
      const card = page.locator('.directory-card').first();
      await page.evaluate(() => setCategorySafetyRecord('stay-a', { riskFlags: { foodAllergy: true } }));
      await page.evaluate(profile => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: profile, intakeAttributesSource: 'Saved profile' }), attributes);
      const safetyCacheState = await page.evaluate(() => ({ failed: directorySafetyReadFailures.has('stay-a'), record: careRiskRecordsCache['stay-a'], cardKey: document.querySelector('.directory-card').dataset.stayKey }));
      expect(safetyCacheState.failed, JSON.stringify(safetyCacheState)).toBe(false);

      const food = page.locator('[data-care-category-summary="foodWalks"]');
      const behaviour = page.locator('[data-care-category-summary="behaviour"]');
      const health = page.locator('[data-care-category-summary="healthHome"]');
      await expect(food).toContainText('Feed:');
      await expect(food).toContainText('Amount:');
      await expect(food).toContainText('Walks:');
      await expect(behaviour).toContainText('Triggers & handling:');
      await expect(behaviour).toContainText('Separation: Yes');
      await expect(health).toContainText('Medication:');
      await expect(health).toContainText('Conditions:');
      await expect(health).toContainText('Sleep:');
      await expect(health).not.toContainText('Owner details');
      await expect(page.locator('[data-care-category-summary="safety"]')).toContainText('Food Allergy');
      expect(await behaviour.evaluate(node => node.textContent)).toContain('<b>Thunder</b>');
      expect(await behaviour.locator('b').count()).toBe(0);

      await page.locator('[data-profile-subtab="foodWalks"]').click();
      const savedFoodSummary = await food.textContent();
      await page.locator('[data-intake-attribute="feedingTimes"]').fill('Unsaved draft time');
      await expect(food).toHaveText(savedFoodSummary);

      const disclosure = page.locator('[data-profile-subtab="foodWalks"]');
      const box = await disclosure.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await food.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
      await disclosure.focus();
      await expect(disclosure).toHaveCSS('outline-style', 'solid');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

      const summaryGeometry = await food.evaluate(node => {
        const summary = node.getBoundingClientRect();
        const chevron = node.closest('.care-category-toggle').querySelector('.care-category-chevron').getBoundingClientRect();
        const cardBackground = getComputedStyle(node.closest('.care-category-card')).backgroundColor;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const luminance = color => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
        };
        const foreground = luminance(getComputedStyle(node).color);
        const background = luminance(cardBackground);
        return { width: summary.width, height: summary.height, right: summary.right, chevronLeft: chevron.left, contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
      });
      expect(summaryGeometry.width).toBeGreaterThanOrEqual(80);
      expect(summaryGeometry.height).toBeGreaterThan(0);
      expect(summaryGeometry.right).toBeLessThanOrEqual(summaryGeometry.chevronLeft - 4);
      expect(summaryGeometry.contrast).toBeGreaterThanOrEqual(4.5);
      const wrap = await behaviour.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
        return { whiteSpace: getComputedStyle(node).whiteSpace, lineCount: lines.size };
      });
      expect(wrap.whiteSpace).toBe('normal');
      expect(wrap.lineCount).toBeGreaterThanOrEqual(width <= 390 ? 2 : 1);

      const select = page.locator('select.intake-profile-control').first();
      await page.locator('select.intake-profile-control').evaluateAll(nodes => nodes.forEach(node => { node.disabled = true; }));
      const selectContrast = await select.evaluate(node => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const rgba = color => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data];
        };
        let surface = node;
        let background = rgba(getComputedStyle(surface).backgroundColor);
        while (background[3] < 250 && surface.parentElement) {
          surface = surface.parentElement;
          background = rgba(getComputedStyle(surface).backgroundColor);
        }
        const luminance = channels => channels.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const foreground = luminance(rgba(getComputedStyle(node).color));
        const backdrop = luminance(background);
        return { ratio: (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05), foreground: getComputedStyle(node).color, background: getComputedStyle(surface).backgroundColor };
      });
      expect(selectContrast.ratio, JSON.stringify(selectContrast)).toBeGreaterThanOrEqual(4.5);

      if (width === 320 || width === 1440) {
        await page.screenshot({ path: `test-results/care-summaries-${theme ? 'dark' : 'light'}-${width}.png`, fullPage: true });
      }

      await card.evaluate(node => {
        const clone = node.cloneNode(true);
        clone.dataset.stayKey = 'stay-b';
        clone.dataset.directorySourceRow = '5';
        node.parentElement.appendChild(clone);
      });
      const second = page.locator('.directory-card').nth(1);
      await second.evaluate(node => renderDirectoryIntakeAttributes(node, { intakeAttributes: { feedingTimes: 'Once daily' } }));
      const ids = await page.locator('.care-category-toggle').evaluateAll(nodes => nodes.map(node => node.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const toggle of await page.locator('.care-category-toggle').all()) {
        const panelId = await toggle.getAttribute('aria-controls');
        await expect(page.locator(`#${panelId}`)).toHaveAttribute('aria-labelledby', await toggle.getAttribute('id'));
      }

      const statuses = await page.evaluate(() => ({
        partial: window.summarizeCareCategory('safety', {}, 'saved', {}, 'saved'),
        explicitClear: window.summarizeCareCategory('safety', {}, 'saved', { riskFlags: {} }, 'saved'),
        malformedFlags: window.summarizeCareCategory('safety', {}, 'saved', { riskFlags: [] }, 'saved'),
        malformedValue: window.summarizeCareCategory('safety', {}, 'saved', { riskFlags: { foodAllergy: 'false' } }, 'saved'),
        failed: window.summarizeCareCategory('safety', {}, 'saved', null, 'error'),
        loading: window.summarizeCareCategory('foodWalks', {}, 'loading', null, 'loading'),
        profileError: window.summarizeCareCategory('healthHome', {}, 'error', null, 'loading'),
        emptyFood: window.summarizeCareCategory('foodWalks', {}, 'fresh', null, 'loading'),
        emptyBehaviour: window.summarizeCareCategory('behaviour', {}, 'saved', null, 'loading'),
        emptyHealth: window.summarizeCareCategory('healthHome', {}, 'saved', null, 'loading'),
        missingProfile: window.summarizeCareCategory('foodWalks', {}, 'not-found', null, 'loading'),
        identityConflict: window.summarizeCareCategory('healthHome', {}, 'identity-conflict', null, 'loading'),
        customRisk: window.summarizeCareCategory('behaviour', { aggression: 'Reactive near food' }, 'saved', null, 'loading')
      }));
      expect(statuses.partial.text).toBe('Safety status not loaded');
      expect(statuses.explicitClear.text).toBe('No active alerts');
      expect(statuses.malformedFlags.text).toBe('Safety status unavailable');
      expect(statuses.malformedValue.text).toBe('Safety status unavailable');
      expect(statuses.failed.text).toBe('Safety status unavailable');
      expect(statuses.loading.text).toBe('Loading care details…');
      expect(statuses.profileError.text).toBe('Care details unavailable');
      expect(statuses.emptyFood).toEqual({ text: 'No food or walk details saved', state: 'empty' });
      expect(statuses.emptyBehaviour).toEqual({ text: 'No behaviour details saved', state: 'empty' });
      expect(statuses.emptyHealth).toEqual({ text: 'No health or home details saved', state: 'empty' });
      expect(statuses.missingProfile).toEqual({ text: 'No saved care profile', state: 'unknown' });
      expect(statuses.identityConflict).toEqual({ text: 'Review care record identity', state: 'unknown' });
      expect(statuses.customRisk.text).toContain('Aggression: Reactive near food');

      await page.locator('[data-directory-detail="profile"]').first().evaluate(node => { node.dataset.profileReadState = 'error'; });
      await page.evaluate(() => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: {} }));
      await expect(page.locator('[data-care-category-summary="healthHome"]').first()).toHaveText('Care details unavailable');
      await page.evaluate(() => setCategorySafetyFailure('stay-a'));
      await page.evaluate(() => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: {} }));
      await expect(page.locator('[data-care-category-summary="safety"]').first()).toHaveText('Safety status unavailable');
    }
  }
});

test('long feeding times and medication instructions remain readable and editable on desktop and narrow phones', async ({ page }) => {
  const feeding = '06:30 before the morning walk, then 18:00 after the evening walk; keep the bowl away from the back door.';
  const medication = 'Give one tablet with the evening meal. If a dose is missed, do not give an extra tablet. Watch for changes in appetite or energy and contact the owner if either occurs. Keep the medication in its labelled container and out of reach of other dogs.';
  for (const width of [360, 390, 1440]) {
    for (const theme of ['', 'dark-theme']) {
      await page.setViewportSize({ width, height: 760 });
      await page.setContent(fixture(theme));
      await page.addScriptTag({ content: actualRenderer });
      await page.evaluate(({feeding, medication}) => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), {
        intakeAttributes: { feedingTimes: feeding, medicationInstructions: medication },
        intakeAttributesSource: 'Synthetic saved fixture'
      }), {feeding, medication});
      await page.locator('[data-profile-subtab="foodWalks"]').click();
      await page.locator('[data-profile-subtab="healthHome"]').click();
      const feedingControl = page.locator('[data-intake-attribute="feedingTimes"]');
      const medicationControl = page.locator('[data-intake-attribute="medicationInstructions"]');
      await expect(feedingControl).toHaveValue(feeding);
      await expect(medicationControl).toHaveValue(medication);
      await expect(page.locator(`label[for="${await feedingControl.getAttribute('id')}"]`)).toHaveText('Feeding Times');
      await expect(page.locator(`label[for="${await medicationControl.getAttribute('id')}"]`)).toHaveText('Medication Instructions');
      await expect(feedingControl).toHaveAttribute('rows', '2');
      await expect(medicationControl).toHaveAttribute('rows', '5');
      await medicationControl.focus();
      await medicationControl.press('End');
      expect(await medicationControl.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
      const geometry = await page.evaluate(() => {
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
          const normalized = channel / 255;
          return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        const luminance = value => rgb(value).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const contrast = (foreground, background) => {
          const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          return (values[0] + .05) / (values[1] + .05);
        };
        const selectors = ['[data-intake-attribute="feedingTimes"]', '[data-intake-attribute="medicationInstructions"]'];
        const fields = selectors.map(selector => {
          const el = document.querySelector(selector);
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {right: rect.right, width: rect.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, height: rect.height, contrast: contrast(style.color, style.backgroundColor)};
        });
        return {pageWidth: document.documentElement.scrollWidth, fields};
      });
      expect(geometry.pageWidth).toBeLessThanOrEqual(width);
      expect(geometry.fields.every(field => field.right <= width + 1 && field.width > 0 && field.clientWidth > 0)).toBeTruthy();
      expect(geometry.fields.every(field => field.contrast >= 4.5)).toBeTruthy();
      expect(geometry.fields[1].height).toBeGreaterThanOrEqual(132);
    }
  }
});

test('the fixture stays aligned with the production generated profile structure', () => {
  for (const selector of ['directory-profile-section', 'directory-profile-subtab', 'data-directory-intake-attributes', 'data-directory-profile-care', 'directory-profile-read-status']) {
    expect(appSource).toContain(selector);
  }
});

test('care field labels target the selected dog when multiple profiles are rendered', async ({ page }) => {
  await page.setContent(fixture());
  await page.addScriptTag({ content: actualRenderer });
  const controls = await page.evaluate(() => {
    const first = document.querySelector('.directory-card');
    first.dataset.directorySourceRow = '2';
    const second = first.cloneNode(true);
    second.dataset.directorySourceRow = '3';
    first.after(second);
    for (const card of [first, second]) {
      renderDirectoryIntakeAttributes(card, { intakeAttributes: { feedingTimes: 'Morning and evening' } });
    }
    return [first, second].map(card => {
      const control = card.querySelector('[data-intake-attribute="feedingTimes"]');
      return { id: control.id, labelFor: card.querySelector('.intake-profile-field-feedingTimes label').htmlFor };
    });
  });
  expect(controls[0].id).not.toBe(controls[1].id);
  for (const control of controls) expect(control.labelFor).toBe(control.id);
});

test('Care overview text and muted labels meet the scoped contrast targets in light and dark themes', async ({ page }) => {
  for (const theme of ['', 'dark-theme']) {
    await page.setContent(fixture(theme));
    const contrast = await page.evaluate(() => {
    const parse = value => { const m = value.match(/\d+/g).map(Number); return m.slice(0, 3).map(v => v / 255); };
    const lum = rgb => rgb.map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const x = lum(parse(a)), y = lum(parse(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const sample = document.querySelector('.directory-field-value');
    const muted = document.querySelector('.directory-field-label');
    const heading = document.querySelector('.directory-profile-section-heading h4');
    const surface = getComputedStyle(document.querySelector('.directory-card')).backgroundColor;
    return { body: ratio(getComputedStyle(sample).color, surface), muted: ratio(getComputedStyle(muted).color, surface), heading: ratio(getComputedStyle(heading).color, surface) };
    });
    expect(contrast.body).toBeGreaterThanOrEqual(4.5);
    expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
    expect(contrast.heading).toBeGreaterThanOrEqual(4.5);
  }
});

test('readiness checklist updates from cached profile state, prioritizes gaps, and stays touch-sized', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main class="directory-card is-profile-active" data-stay-key="milo|stay" data-directory-stay-key="milo|stay">
    <section class="directory-care-brief" data-directory-care-brief>
      <details class="directory-care-readiness"><summary>Review checklist <strong data-care-readiness-summary></strong></summary><div class="directory-care-readiness-list" data-care-readiness-list>
      ${['intake','handover'].map(key => `<div class="directory-care-readiness-row" data-care-readiness-item="${key}"><span class="directory-care-readiness-copy"><strong>${key}</strong><small data-care-readiness-detail></small></span><span class="directory-care-readiness-status" data-care-readiness-status></span><button>Review</button></div>`).join('')}
      </div></details><section class="directory-care-brief-item directory-care-brief-safety"><div data-care-brief-safety></div></section><p data-care-brief-feeding></p><p data-care-brief-medication></p><span data-care-brief-freshness></span><span data-care-brief-call-owner></span>
      <section class="directory-care-brief-item directory-care-brief-note"><div class="directory-care-brief-note-heading"><h4>Handover note</h4><button class="directory-care-brief-note-edit" data-care-brief-action="handover" aria-label="Update handover">Update</button></div><p class="directory-care-brief-value">Call before pickup\nMedication is in the blue bag.</p></section>
      <div data-directory-intake>Intake not sent</div><button data-directory-edit-field="notes" data-directory-current-value="" ></button>
    </section></main></body></html>`);
  await page.addScriptTag({ content: briefTestCode });
  await page.evaluate(() => {
    window.renderBrief(document.querySelector('.directory-card'));
  });
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('2 to review');
  await expect(page.locator('[data-care-brief-safety]')).toContainText('Safety profile not yet available');
  await expect(page.locator('.directory-care-brief-safety')).toBeVisible();
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.intakeMethod = 'legacy';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-readiness-item="intake"]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('1 to review');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    directoryProfileDetailCache[card.dataset.stayKey] = { intakeAttributes: { feedingTimes: '7 am', medicationInstructions: 'With dinner' } };
    careRiskRecordsCache[card.dataset.stayKey] = { riskFlags: {} };
    card.querySelector('[data-directory-intake]').textContent = 'Intake complete';
    card.querySelector('[data-directory-edit-field="notes"]').dataset.directoryCurrentValue = 'Call before pickup';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('Ready for care');
  await expect(page.locator('[data-care-brief-safety]')).toHaveAttribute('data-state', 'clear');
  await expect(page.locator('.directory-care-brief-safety')).toHaveAttribute('data-state', 'clear');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    careRiskRecordsCache[card.dataset.stayKey] = { riskFlags: { foodAllergy: true } };
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-brief-safety]')).toHaveAttribute('data-state', 'attention');
  await expect(page.locator('.directory-care-brief-safety')).toHaveAttribute('data-state', 'attention');
  await expect(page.locator('[data-care-brief-safety]')).toContainText('Food allergy');
  await expect(page.locator('[data-care-brief-safety] .care-brief-alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update handover' })).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active' });
  const handoverAction = page.getByRole('button', { name: 'Update handover' });
  await handoverAction.focus();
  expect(await handoverAction.evaluate(button => ({
    height: button.getBoundingClientRect().height,
    outline: getComputedStyle(button).outlineStyle
  }))).toMatchObject({ height: expect.any(Number), outline: 'solid' });
  expect(await handoverAction.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.emulateMedia({ forcedColors: 'none' });
  await expect(page.locator('.directory-care-brief-note .directory-care-brief-value')).toHaveCSS('white-space', 'pre-wrap');
  await expect(page.locator('.directory-care-brief-note .directory-care-brief-value')).toContainText('Medication is in the blue bag.');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.directory-care-readiness > summary').click();
    const rows = await page.locator('.directory-care-readiness-row > button').evaluateAll(items => items.map(item => {
      const r = item.getBoundingClientRect();
      return { width:r.width, height:r.height, right:r.right };
    }));
    expect(rows.every(row => row.width >= 44 && row.height >= 44 && row.right <= width + 1)).toBeTruthy();
    await page.locator('.directory-care-readiness > summary').click();
  }
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
  await page.locator('.directory-care-readiness > summary').click();
  await expect(page.locator('.directory-care-readiness-row').first()).toHaveCSS('border-left-width', '4px');
});

test('server identity conflict blocks legacy profile, belongings, and safety fallbacks in the care brief', async ({ page }) => {
  await page.setContent(`<!doctype html><html><body><main class="directory-card" data-stay-key="stay-a" data-directory-stay-key="stay-a">
    <section class="directory-care-brief" data-directory-care-brief><section data-care-brief-safety></section><p data-care-brief-feeding></p><p data-care-brief-medication></p><span data-care-brief-freshness></span><span data-care-brief-call-owner></span>
    <div data-directory-intake>Intake not sent</div><button data-directory-edit-field="notes"></button></section></main></body></html>`);
  await page.addScriptTag({ content: briefTestCode });
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    directoryProfileDetailCache['stay-a'] = { stayKey: 'stay-a', intakeAttributes: { feedingTimes: '7 am', medicationInstructions: 'Private legacy medicine' } };
    belongingsRecordsCache['stay-a'] = { items: { medication: 'Private belongings medicine' }, riskFlags: { foodAllergy: true } };
    careRiskRecordsCache['stay-a'] = { riskFlags: { foodAllergy: true } };
    card.dataset.profileIdentityBlocked = 'stay-a';
    card.dataset.profileIdentityBlockedReason = 'conflict';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-brief-freshness]')).toHaveAttribute('aria-description', /shared saved record.*intake imports, photos and booking changes/i);
  await expect(page.locator('[data-care-brief-safety]')).toContainText('Safety profile not yet available');
  await expect(page.locator('[data-care-brief-feeding]')).toContainText('Care record needs identity review');
  await expect(page.locator('[data-care-brief-medication]')).not.toContainText('Private');
  await expect(page.locator('[data-care-brief-safety]')).not.toContainText('Food allergy');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.profileIdentityBlockedReason = 'missing';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-brief-feeding]')).toHaveText('No saved feeding instructions');
  await expect(page.locator('[data-care-brief-medication]')).toHaveText('No saved medication instructions');
  await expect(page.locator('[data-care-brief-freshness]')).toHaveText('No saved care record');
  await expect(page.locator('[data-care-brief-feeding]')).not.toContainText('identity review');
});

test('readiness actions expand the correct category and focus its existing field', async ({ page }) => {
  await page.setContent(`<main class="directory-card"><button data-v11160-tab="profile"></button><section data-directory-detail="profile"><section data-care-category="foodWalks"><button data-profile-subtab="foodWalks" aria-expanded="false"></button><div data-profile-subpanel="foodWalks" hidden><input data-intake-attribute="feedingTimes"><input data-intake-attribute="foodAmount"></div></section><section data-care-category="healthHome"><button data-profile-subtab="healthHome" aria-expanded="false"></button><div data-profile-subpanel="healthHome" hidden><textarea data-intake-attribute="medicationInstructions"></textarea></div></section><section data-care-category="safety"><button data-profile-subtab="safety" aria-expanded="false"></button><div data-profile-subpanel="safety" hidden><label><input type="checkbox" data-care-risk-flag="foodAllergy"></label></div></section><details class="directory-care-records-disclosure"><button data-create-intake-link></button></details><details data-directory-stay-contact><button data-directory-edit-field="notes"></button></details></section></main>`);
  await page.addScriptTag({ content: `${readinessNavigator}\nwindow.WAFFLE_TEST_CALLS=[];function switchDirectoryProfileMainTab(){}function switchDirectoryProfileSubTab(card,key){card.querySelectorAll('[data-profile-subpanel]').forEach(panel=>panel.hidden=panel.dataset.profileSubpanel!==key);card.querySelectorAll('[data-profile-subtab]').forEach(button=>button.setAttribute('aria-expanded',button.dataset.profileSubtab===key?'true':'false'));}function setDirectoryProfileEditMode(card,enabled){window.WAFFLE_TEST_CALLS.push(enabled);}` });
  for (const [action, selector] of [
    ['feeding', '[data-intake-attribute="feedingTimes"]'],
    ['medication', '[data-intake-attribute="medicationInstructions"]'],
    ['safety', '[data-care-risk-flag]'],
    ['intake', '[data-create-intake-link]'],
    ['handover', '[data-directory-edit-field="notes"]']
  ]) {
    await page.evaluate(({action}) => {
      const target = document.querySelector(action === 'intake' ? '[data-create-intake-link]' : action === 'safety' ? '[data-care-risk-flag]' : action === 'handover' ? '[data-directory-edit-field="notes"]' : `[data-intake-attribute="${action === 'feeding' ? 'feedingTimes' : 'medicationInstructions'}"]`);
      target.clicked = false;
      target.addEventListener('click', () => { target.clicked = true; });
      openCareReadinessTarget(document.querySelector('.directory-card'), action);
    }, {action});
    if (action === 'handover') {
      await expect.poll(() => page.locator(selector).evaluate(item => item.clicked)).toBeTruthy();
    } else {
      await expect(page.locator(selector)).toBeFocused();
    }
    if (['feeding', 'medication', 'safety'].includes(action)) {
      const category = action === 'feeding' ? 'foodWalks' : action === 'safety' ? 'safety' : 'healthHome';
      await expect(page.locator(`[data-profile-subtab="${category}"]`)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`[data-profile-subpanel="${category}"]`)).toBeVisible();
    }
  }
  await expect(page.locator('.directory-care-records-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('[data-directory-stay-contact]')).toHaveAttribute('open', '');
});

test('Care overview leads with essentials and history distinguishes actual from scheduled checkout', async ({ page }) => {
  const start = historySource.indexOf('function v108RenderHistory(');
  const end = historySource.indexOf('\n', start);
  const renderer = historySource.slice(start, end);
  for (const theme of ['', 'dark-theme']) {
    await page.setContent(`<style>${css}\n${historyCss}</style><body class="${theme}"><main class="directory-card is-profile-active"><div class="directory-profile-content"><section class="directory-care-brief"><div class="directory-care-brief-heading"><h3>Care overview</h3><span class="directory-care-brief-freshness">Care details available · Verified profile source with a deliberately long label</span></div><div class="directory-care-brief-grid"><section class="directory-care-brief-item directory-care-brief-safety"><h4>Safety</h4><span class="care-brief-alert">⚠ Food allergy</span></section><section class="directory-care-brief-item"><h4>Feeding</h4><p class="directory-care-brief-value">Long feeding directions wrap cleanly and remain readable.</p></section><section class="directory-care-brief-item"><h4>Medication</h4><p class="directory-care-brief-value">With dinner.</p></section><section class="directory-care-brief-item directory-care-brief-note"><h4>Handover note</h4><p class="directory-care-brief-value">Call before pickup.</p></section></div><details class="directory-care-readiness"><summary>Other setup checks</summary></details></section><section class="v108-history-panel"><div data-history></div></section></div></main></body>`);
    await page.addScriptTag({ content: `function escapeDashboardHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')} function v10FormatDateLabel(v){return String(v||'')}\n${renderer}` });
    await page.evaluate(() => v108RenderHistory(document.querySelector('[data-history]'), {
    dogNumber: '00017', stayCount: 3, previousStays: [
      { startDate: '2026-08-01', endDate: '2026-08-05', notes: 'Safety monitor appetite.', careChanges: [{ source: 'care profile' }] },
      { startDate: '2026-06-01', endDate: '2026-06-05', actualCheckoutDate: '2026-06-03', status: 'checked_out', notes: 'Owner requested early pickup.', careChanges: [{ updatedAt: '2026-06-02T10:12:00Z', source: 'care profile' }] },
      { startDate: '2026-03-01', endDate: '2026-03-02' }
    ]
    }));
    await expect(page.locator('.v108-history-summary')).toContainText('Dog ID #00017');
    const cards = page.locator('.v108-stay-history');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Scheduled start 2026-08-01');
    await expect(cards.nth(0)).toContainText('Scheduled checkout 2026-08-05');
    await expect(cards.nth(0)).not.toContainText('Undated change');
    await expect(cards.nth(1)).toContainText('Checked out 2026-06-03');
    await expect(cards.nth(1)).toContainText('Originally scheduled 2026-06-05');
    await expect(cards.nth(1)).toContainText('Care record updates2026-06-02 · care profile');
    await expect(cards.nth(0)).toContainText('Safety monitor appetite.');
    expect(appSource.indexOf('class="directory-care-brief-grid"')).toBeLessThan(appSource.indexOf('<details class="directory-care-readiness">'));
    expect(appSource).toContain("'<span class=\"directory-status-tag tag-checked-out\">Checked Out</span>'");
    expect(appSource).not.toContain("class=\"directory-status-tag\" style=\"background:#e2e8f0");
    for (const width of [390, 412, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        brief: document.querySelector('.directory-care-brief').getBoundingClientRect(),
        freshness: document.querySelector('.directory-care-brief-freshness').getBoundingClientRect(),
        safety: document.querySelector('.directory-care-brief-safety').getBoundingClientRect(),
        note: document.querySelector('.directory-care-brief-note').getBoundingClientRect()
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.freshness.left).toBeGreaterThanOrEqual(layout.brief.left);
      expect(layout.freshness.right).toBeLessThanOrEqual(layout.brief.right);
      expect(layout.safety.width).toBeGreaterThanOrEqual(200);
      expect(layout.note.width).toBeGreaterThanOrEqual(200);
      await page.screenshot({ path: path.join(evidenceDir, `history-${theme || 'light'}-${width}.png`), fullPage: true });
    }
  }
});
