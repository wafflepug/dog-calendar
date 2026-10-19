const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const importedCss = [...runtimeCss.matchAll(/@import url\("([^?"]+)[^"]*"\);/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const settingsSource = fs.readFileSync(path.join(root, 'waffle-ui.js'), 'utf8');
const paletteCss = [...settingsSource.matchAll(/:root\[data-waffle-colour-style="[^"]+"\](?: body\.dark-theme)?\s*\{[^}]+\}/g)].map(match => match[0]).join('\n');
const css = importedCss + '\n' + runtimeCss.replace(/@import[^;]+;/g, '') + '\n' + paletteCss;
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const sliceConst = name => {
  const start = app.indexOf(`const ${name}`);
  return app.slice(start, app.indexOf('];', start) + 2);
};
const categorySummary = app.slice(app.indexOf('function directoryCareCategorySummary'), app.indexOf('function renderDirectoryIntakeAttributes'));
const optionalEditorFields = app.slice(app.indexOf('const DIRECTORY_PROFILE_OPTIONAL_FIELDS'), app.indexOf('let careRiskRecordsCache'));
const intakeControl = app.slice(app.indexOf('function intakeAttributeControlHtml'), app.indexOf('function renderDirectoryIntakeAttributes'));
const intakeRenderer = app.slice(app.indexOf('function renderDirectoryIntakeAttributes'), app.indexOf('function renderDirectoryCareProfile'));
const sectionRuntime = app.slice(app.indexOf('const directoryCareSectionChoices = new Map();'), app.indexOf('async function openDirectoryGuestProfile'));
const productionRenderer = `${sliceConst('CARE_SAFETY_FLAGS')}\n${sliceConst('INTAKE_ATTRIBUTE_UI_GROUPS')}\n${sliceConst('DIRECTORY_PROFILE_SECONDARY_TABS')}\n${optionalEditorFields}
const careRiskRecordsCache = {}, directorySummaryRecordsCache = {}, belongingsRecordsCache = {};
const directorySafetyReadFailures = new Set();
function directoryProfileIdentityCacheKey(){return '';}
function escapeDashboardHtml(value){return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
${sectionRuntime}
function renderDirectoryCareProfile(){}
function restoreDirectoryProfileEditDraft(){}
function applyDirectoryProfileEditMode(){}
${categorySummary}\n${intakeControl}\n${intakeRenderer}
window.renderActualIntake = renderDirectoryIntakeAttributes;
`;

function fixture(theme, accent) {
  return `<!doctype html><html data-waffle-ui-ready="true"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
    <body class="${theme}" data-waffle-page="directory" style="${accent}"><main class="directory-card is-profile-active" data-stay-key="fixture-stay" data-directory-source-row="5">
      <section data-directory-detail="profile" data-profile-read-state="saved"><div data-directory-main-panel="profile">
        <section class="directory-profile-section directory-profile-intake-section">
          <header class="directory-profile-section-header"><h3>Saved care profile</h3><div class="directory-profile-section-tools"><span class="intake-profile-source" data-intake-profile-summary></span><button type="button">Edit</button></div></header>
          <div data-directory-intake-attributes></div>
        </section>
      </div></section>
    </main></body></html>`;
}

const profile = {
  feedingTimes: '06:30 before morning walk and 18:00 after evening walk',
  foodAmount: '1 cup at each meal',
  walksPerDay: '2 walks',
  triggersFears: 'Thunder and unfamiliar delivery workers; approach slowly',
  medicationInstructions: 'Give with dinner and call if appetite changes',
  medicalConditions: 'Seasonal allergies; watch for itching',
  sleepLocation: 'On the mat beside the bedroom door'
};

test('selected intake source and all category summary states stay readable and wrap at Care widths', async ({ page }, testInfo) => {
  const accents = [
    '--wh75-accent:#7562db;--wh75-accent-ink:#4338ca;--wh75-accent-soft:#ede9fe',
    '--wh75-accent:#0f766e;--wh75-accent-ink:#115e59;--wh75-accent-soft:#ccfbf1'
  ];
  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 768, 1440]) {
      for (const accent of accents) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(fixture(theme, accent));
        await page.addScriptTag({ content: productionRenderer });
        await page.evaluate(data => renderActualIntake(document.querySelector('.directory-card'), { intakeAttributes: data, intakeAttributesSource: 'Verified saved profile from booking record; reviewed at the front desk' }), profile);

        const metrics = await page.evaluate(() => {
          const source = document.querySelector('[data-intake-profile-summary]');
          const sourceLine = document.querySelector('.directory-profile-source-line');
          const label = document.querySelector('.intake-profile-field label');
          const summaries = [...document.querySelectorAll('.care-category-summary')];
          const rect = node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, height: box.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }; };
          return {
            sourceFont: parseFloat(getComputedStyle(source).fontSize),
            sourceWhiteSpace: getComputedStyle(source).whiteSpace,
            sourceRect: rect(source),
            sourceLineFont: parseFloat(getComputedStyle(sourceLine).fontSize),
            sourceLineWhiteSpace: getComputedStyle(sourceLine).whiteSpace,
            sourceLineRect: rect(sourceLine),
            labelFont: parseFloat(getComputedStyle(label).fontSize),
            summaries: summaries.map(node => ({
              text: node.textContent,
              state: node.dataset.state,
              font: parseFloat(getComputedStyle(node).fontSize),
              lineClamp: getComputedStyle(node).webkitLineClamp,
              whiteSpace: getComputedStyle(node).whiteSpace,
              rect: rect(node),
              parentRight: node.closest('.care-category-toggle').getBoundingClientRect().right
            })),
            docWidth: document.documentElement.scrollWidth
          };
        });
        const context = JSON.stringify({ theme, width, accent, metrics });
        expect(metrics.sourceFont, context).toBeGreaterThanOrEqual(12);
        expect(metrics.labelFont, context).toBeGreaterThanOrEqual(12);
        expect(metrics.sourceWhiteSpace, context).toBe('normal');
        expect(metrics.sourceLineFont, context).toBeGreaterThanOrEqual(12);
        expect(metrics.sourceLineWhiteSpace, context).toBe('normal');
        expect(metrics.sourceRect.right, context).toBeLessThanOrEqual(width);
        expect(metrics.sourceLineRect.right, context).toBeLessThanOrEqual(width);
        expect(metrics.summaries.every(summary => summary.font >= 13), context).toBeTruthy();
        expect(metrics.summaries.every(summary => summary.lineClamp === 'none'), context).toBeTruthy();
        expect(metrics.summaries.every(summary => summary.whiteSpace === 'normal' && summary.rect.right <= summary.parentRight + 1), context).toBeTruthy();
        expect(metrics.docWidth, context).toBeLessThanOrEqual(width);

        if ((width === 320 && theme === '' && accent === accents[0]) || (width === 1440 && theme === 'dark-theme' && accent === accents[1])) {
          await page.screenshot({ path: testInfo.outputPath(`care-intake-${width}-${theme || 'light'}.png`), fullPage: true });
        }

        const states = [
          ['loading', 'Loading care details…'],
          ['error', 'Care details unavailable'],
          ['not-found', 'No saved care profile'],
          ['identity-conflict', 'Review care record identity'],
          ['saved-empty', 'No food or walk details saved']
        ];
        for (const [state, expectedText] of states) {
          const stateMetrics = await page.evaluate(nextState => {
            const card = document.querySelector('.directory-card');
            const detail = card.querySelector('[data-directory-detail="profile"]');
            detail.dataset.profileReadState = nextState === 'saved-empty' ? 'saved' : nextState;
            renderActualIntake(card, { intakeAttributes: {}, intakeAttributesSource: '' });
            return [...card.querySelectorAll('.care-category-summary')].map(node => ({
              text: node.textContent,
              state: node.dataset.state,
              font: parseFloat(getComputedStyle(node).fontSize),
              clamp: getComputedStyle(node).webkitLineClamp,
              right: node.getBoundingClientRect().right,
              parentRight: node.closest('.care-category-toggle').getBoundingClientRect().right
            }));
          }, state);
          expect(stateMetrics.every(summary => summary.font >= 13 && summary.clamp === 'none' && summary.right <= summary.parentRight + 1), `${context} state=${state}`).toBeTruthy();
          expect(stateMetrics[0].text).toBe(expectedText);
          if (state === 'saved-empty') {
            expect(stateMetrics.slice(0, 3).every(summary => summary.state === 'empty')).toBeTruthy();
            expect(stateMetrics[3].state).toBe('unknown');
          } else {
            expect(stateMetrics.every(summary => summary.state === 'unknown')).toBeTruthy();
          }
        }

      }
    }
  }
});

test('read-only care rows retain complete values, grouped missing labels, and unknown critical state', async ({ page }) => {
  const feeding = '06:30 before the morning walk\n18:00 after the evening walk';
  const medication = `Give with dinner. ${'If a dose is missed, contact the owner before changing the routine. '.repeat(14)}`;
  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 880 });
      await page.setContent(fixture(theme, '--wh75-accent:#7562db;--wh75-accent-ink:#4338ca;--wh75-accent-soft:#ede9fe'));
      await page.addScriptTag({ content: productionRenderer });
      await page.evaluate(({ feeding, medication }) => renderActualIntake(document.querySelector('.directory-card'), {
        intakeAttributes: { feedingTimes: feeding, foodAmount: '1 cup', medicationInstructions: medication },
        intakeAttributesSource: 'Synthetic saved profile'
      }), { feeding, medication });
      await page.locator('[data-profile-subtab="foodWalks"]').click();
      await page.locator('[data-profile-subtab="healthHome"]').click();
      await expect(page.locator('[data-intake-read-attribute="feedingTimes"] .intake-profile-read-value')).toHaveText(feeding);
      await expect(page.locator('[data-intake-read-attribute="medicationInstructions"] .intake-profile-read-value')).toHaveText(medication);
      await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toHaveCount(1);
      await expect(page.locator('[data-profile-subpanel="healthHome"] .intake-profile-missing')).toHaveCount(1);
      await expect(page.locator('[data-profile-subpanel="healthHome"] .intake-profile-missing')).not.toContainText('Medication Instructions');
      const missing = page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing');
      await missing.locator('summary').click();
      await expect(missing).toContainText('Food Allergies');
      await page.evaluate(({ feeding, medication }) => renderActualIntake(document.querySelector('.directory-card'), {
        intakeAttributes: { feedingTimes: `${feeding} updated`, foodAmount: '1.25 cups', medicationInstructions: medication },
        intakeAttributesSource: 'Synthetic refreshed profile'
      }), { feeding, medication });
      await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toHaveAttribute('open', '');
      await expect(page.locator('[data-profile-subpanel="foodWalks"] .intake-profile-missing')).toContainText('Food Allergies');
      const disclosureStability = await page.evaluate(({ feeding, medication }) => {
        const card = document.querySelector('.directory-card');
        const category = card.querySelector('[data-care-category="foodWalks"]');
        const disclosure = category.querySelector('.intake-profile-missing');
        const summary = disclosure.querySelector('summary');
        summary.focus();
        const observer = new MutationObserver(() => {});
        observer.observe(category, { attributes: true, childList: true, subtree: true });
        renderActualIntake(card, { intakeAttributes: { feedingTimes: `${feeding} updated`, foodAmount: '1.25 cups', medicationInstructions: medication }, intakeAttributesSource: 'Synthetic refreshed profile' });
        const mutationCount = observer.takeRecords().length;
        observer.disconnect();
        return { sameDisclosure: category.querySelector('.intake-profile-missing') === disclosure, open: disclosure.open, focused: document.activeElement === summary, mutationCount };
      }, { feeding, medication });
      expect(disclosureStability).toEqual({ sameDisclosure: true, open: true, focused: true, mutationCount: 0 });

      await page.locator('.directory-card').evaluate(node => node.classList.add('is-profile-editing'));
      await expect(page.locator('[data-intake-read-category="foodWalks"]')).toBeHidden();
      await expect(page.locator('[data-intake-attribute="feedingTimes"]')).toBeVisible();
      await expect(page.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue(medication);
      await page.locator('.directory-card').evaluate(node => node.classList.remove('is-profile-editing'));
      await expect(page.locator('[data-intake-read-category="healthHome"]')).toBeVisible();
      await expect(page.locator('[data-intake-attribute="medicationInstructions"]')).toBeHidden();
      await page.evaluate(() => {
        document.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = 'saved';
        renderActualIntake(document.querySelector('.directory-card'), { intakeAttributes: { medicalConditions: 'Seasonal allergies' } });
      });
      await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-medication-status')).toHaveText('Medication instructions not provided.');
      await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-missing')).not.toContainText('Medication Instructions');

      for (const readState of ['loading', 'error', 'identity-conflict', 'not-found']) {
        await page.evaluate(state => {
          document.querySelector('[data-directory-detail="profile"]').dataset.profileReadState = state;
          renderActualIntake(document.querySelector('.directory-card'), { intakeAttributes: {} });
        }, readState);
        await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-missing')).toHaveCount(0);
        await expect(page.locator('[data-intake-read-category="healthHome"] .intake-profile-medication-status')).toBeVisible();
        if (readState !== 'not-found') await expect(page.locator('[data-care-category-summary="healthHome"]')).toHaveText({ loading: 'Loading care details…', error: 'Care details unavailable', 'identity-conflict': 'Review care record identity' }[readState]);
      }
    }
  }
});
