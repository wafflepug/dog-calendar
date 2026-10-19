const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const importedCss = [...runtimeCss.matchAll(/@import url\("([^?"]+)[^"]*"\);/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const settings = fs.readFileSync(path.join(root, 'waffle-ui.js'), 'utf8');
const palettes = [...settings.matchAll(/:root\[data-waffle-colour-style="[^"]+"\](?: body\.dark-theme)?\s*\{[^}]+\}/g)].map(match => match[0]).join('\n');
const css = `${importedCss}\n${runtimeCss.replace(/@import[^;]+;/g, '')}\n${palettes}`;
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const slice = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const constant = name => slice(`const ${name}`, '];') + '];';
const safetyFlags = constant('CARE_SAFETY_FLAGS');
const intakeGroups = constant('INTAKE_ATTRIBUTE_UI_GROUPS');
const profileTabs = constant('DIRECTORY_PROFILE_SECONDARY_TABS');
const optionalEditorFields = slice('const DIRECTORY_PROFILE_OPTIONAL_FIELDS', 'let careRiskRecordsCache');
const categorySummary = slice('function directoryCareCategorySummary', 'function renderDirectoryIntakeAttributes');
const intakeControls = slice('function intakeAttributeControlHtml', 'function renderDirectoryIntakeAttributes');
const intakeRenderer = slice('function renderDirectoryIntakeAttributes', 'function renderDirectoryCareProfile');
const sectionState = slice('const directoryCareSectionChoices = new Map();', 'async function openDirectoryGuestProfile');
const editRuntime = slice('function directoryProfileEditKey(card)', 'function setDirectoryProfileEditMode(');
const production = `${safetyFlags}\n${intakeGroups}\n${profileTabs}\n${optionalEditorFields}\nconst directoryProfileEditDrafts = new Map();\nconst careRiskRecordsCache = {};\nconst directorySafetyReadFailures = new Set();\nconst directorySummaryRecordsCache = {};\nconst belongingsRecordsCache = {};\nfunction escapeDashboardHtml(value){return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}\n${editRuntime}\n${sectionState}\n${categorySummary}\n${intakeControls}\n${intakeRenderer}\nfunction renderDirectoryCareProfile(){}\nwindow.renderDirectoryIntakeAttributes = renderDirectoryIntakeAttributes;\nwindow.seedDraft = card => { const initial = collectDirectoryProfileEditValues(card); directoryProfileEditDrafts.set(directoryProfileEditKey(card), { initial, values: { ...initial }, identity: getDirectoryProfileEditIdentity(card), initialized: true, conflict: false, failed: false, saving: false }); };\nwindow.captureDraft = control => handleDirectoryProfileEditInput({ target: control });`;

function fixture(theme, width) {
  return `<!doctype html><html data-waffle-ui-ready="true"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body data-waffle-page="directory" class="${theme}" style="--fixture-width:${width}px"><main class="directory-card is-profile-active" data-stay-key="fixture-stay" data-directory-stay-key="fixture-stay" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-source-row="7"><section data-directory-detail="profile" data-profile-read-state="saved"><div class="directory-profile-section"><div data-directory-main-panel="profile"><button data-toggle-profile-edit>Edit</button><button data-cancel-profile-edit>Discard</button><div data-directory-profile-edit-status></div><div data-directory-intake-attributes></div><button data-save-belongings>Save</button></div></div></section></main></body></html>`;
}

test('Detailed Care groups missing fields, keeps critical unknowns clear, and preserves identity-scoped disclosures and drafts', async ({ browser }) => {
  const feeding = '06:30 before the morning walk\n18:00 after the evening walk';
  const medication = `Give with dinner. ${'If a dose is missed, contact the owner before changing the routine. '.repeat(18)}`;
  const saved = { intakeAttributes: { feedingTimes: feeding, foodAmount: '1 cup', medicationInstructions: medication, medicalConditions: 'Seasonal allergies' }, intakeAttributesSource: 'Synthetic saved profile' };

  for (const theme of ['', 'dark-theme']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture(theme, width));
    await page.addScriptTag({ content: production });
    await page.evaluate(record => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), record), saved);
    await page.locator('[data-profile-subtab="foodWalks"]').click();
    await page.locator('[data-profile-subtab="healthHome"]').click();
    await expect(page.locator('[data-intake-read-attribute="feedingTimes"] .intake-profile-read-value')).toHaveText(feeding);
    await expect(page.locator('[data-intake-read-attribute="medicationInstructions"] .intake-profile-read-value')).toHaveText(medication);
    await expect(page.locator('[data-intake-read-attribute="medicalConditions"]')).toContainText('Seasonal allergies');
    for (const group of await page.locator('.care-category-panel > .intake-profile-group').all()) await expect(group).toBeHidden();
    await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toHaveCount(1);
    await expect(page.locator('[data-profile-subpanel="healthHome"] .intake-profile-missing')).toHaveCount(1);
    await expect(page.locator('[data-profile-subpanel="healthHome"] .intake-profile-missing')).not.toContainText('Medication Instructions');

    const stable = await page.evaluate(record => {
      const card = document.querySelector('.directory-card');
      const category = card.querySelector('[data-care-category="foodWalks"]');
      const details = category.querySelector('.intake-profile-missing');
      const summary = details.querySelector('summary');
      summary.click();
      summary.focus();
      const observer = new MutationObserver(() => {});
      observer.observe(category, { attributes: true, childList: true, subtree: true });
      renderDirectoryIntakeAttributes(card, record);
      const mutationCount = observer.takeRecords().length;
      observer.disconnect();
      return { sameNode: category.querySelector('.intake-profile-missing') === details, open: details.open, focused: document.activeElement === summary, mutationCount };
    }, saved);
    expect(stable).toEqual({ sameNode: true, open: true, focused: true, mutationCount: 0 });

    await page.evaluate(attributes => {
      const card = document.querySelector('.directory-card');
      card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'error';
      renderDirectoryIntakeAttributes(card, { intakeAttributes: attributes });
    }, saved.intakeAttributes);
    await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-missing')).toHaveCount(0);
    await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-medication-status')).toHaveText('Medication instructions are not verified.');
    await expect(page.locator('[data-intake-read-attribute="medicalConditions"]')).toContainText('Seasonal allergies');
    for (const group of await page.locator('.care-category-panel > .intake-profile-group').all()) await expect(group).toBeHidden();
    await page.evaluate(record => {
      const card = document.querySelector('.directory-card');
      card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'saved';
      renderDirectoryIntakeAttributes(card, record);
    }, saved);
    await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toHaveAttribute('open', '');

    await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      card.classList.add('is-profile-editing');
      window.seedDraft(card);
      applyDirectoryProfileEditMode(card);
    });
    const feedingControl = page.locator('[data-intake-attribute="feedingTimes"]');
    await expect(feedingControl).toBeVisible();
    await expect(page.locator('[data-profile-subpanel="foodWalks"] > .intake-profile-group').first()).toBeVisible();
    await expect(page.locator('[data-intake-read-category="foodWalks"]')).toBeHidden();
    await feedingControl.fill('Unsaved draft: keep this value');
    await page.evaluate(() => window.captureDraft(document.querySelector('[data-intake-attribute="feedingTimes"]')));
    await feedingControl.focus();
    await page.evaluate(record => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), record), saved);
    await expect(feedingControl).toHaveValue('Unsaved draft: keep this value');
    await expect(feedingControl).toBeEnabled();
    await expect(feedingControl).toBeFocused();

    await page.evaluate(record => {
      const card = document.querySelector('.directory-card');
      card.classList.remove('is-profile-editing');
      renderDirectoryIntakeAttributes(card, { ...record, intakeAttributes: { medicalConditions: 'Seasonal allergies' } });
    }, saved);
    await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-medication-status')).toHaveText('Medication instructions not provided.');
    await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-missing')).not.toContainText('Medication Instructions');

    for (const state of ['loading', 'error', 'identity-conflict', 'not-found']) {
      await page.evaluate(nextState => {
        const card = document.querySelector('.directory-card');
        card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = nextState;
        renderDirectoryIntakeAttributes(card, { intakeAttributes: {} });
      }, state);
      await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-missing')).toHaveCount(0);
      await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-medication-status')).toBeVisible();
      if (state !== 'not-found') await expect(page.locator('[data-care-category-summary="healthHome"]')).toContainText(/unavailable|loading|identity|review|not verified/i);
    }

    await page.evaluate(record => {
      const card = document.querySelector('.directory-card');
      card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'saved';
      card.dataset.directoryDogId = 'dog-b';
      renderDirectoryIntakeAttributes(card, record);
    }, saved);
    await page.locator('[data-profile-subtab="foodWalks"]').click();
    await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toHaveCount(1);
    await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).not.toHaveAttribute('open', '');
    await page.close();
  }
});
