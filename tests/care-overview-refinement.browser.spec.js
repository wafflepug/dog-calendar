const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const careFlags = appSource.slice(appSource.indexOf('const CARE_SAFETY_FLAGS'), appSource.indexOf('];', appSource.indexOf('const CARE_SAFETY_FLAGS')) + 2);
const intakeGroups = appSource.slice(appSource.indexOf('const INTAKE_ATTRIBUTE_UI_GROUPS'), appSource.indexOf('];', appSource.indexOf('const INTAKE_ATTRIBUTE_UI_GROUPS')) + 2);
const profileTabs = appSource.slice(appSource.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS'), appSource.indexOf('];', appSource.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS')) + 2);
const intakeControl = appSource.slice(appSource.indexOf('function intakeAttributeControlHtml'), appSource.indexOf('function renderDirectoryIntakeAttributes'));
const intakeRenderer = appSource.slice(appSource.indexOf('function renderDirectoryIntakeAttributes'), appSource.indexOf('function renderDirectoryCareProfile'));
const careRenderer = appSource.slice(appSource.indexOf('function renderDirectoryCareProfile'), appSource.indexOf('function renderDirectoryBelongings'));
const profileSubtabSwitch = appSource.slice(appSource.indexOf('function switchDirectoryProfileSubTab'), appSource.indexOf('async function openDirectoryGuestProfile'));
const actualRenderer = `${careFlags}\n${intakeGroups}\n${profileTabs}\nlet careRiskRecordsCache = {};\nconst directorySummaryRecordsCache = {};\nconst belongingsRecordsCache = {};\nconst applyDirectoryProfileEditMode = () => {};\nfunction escapeDashboardHtml(value){return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}\n${profileSubtabSwitch}\n${intakeControl}\n${intakeRenderer}\n${careRenderer}\nwindow.renderDirectoryIntakeAttributes = renderDirectoryIntakeAttributes;`;
const briefRenderer = appSource.slice(appSource.indexOf('function renderDirectoryCareBrief(card)'), appSource.indexOf('function openCareReadinessTarget'));
const readinessNavigator = appSource.slice(appSource.indexOf('function openCareReadinessTarget'), appSource.indexOf('function findDirectoryCareElement'));
const briefTestCode = `
  const directoryProfileDetailCache = {};
  const belongingsRecordsCache = {};
  const directorySummaryRecordsCache = {};
  const careRiskRecordsCache = {};
  const escapeDashboardHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  function getDirectoryCareBriefRecord(key) { return directoryProfileDetailCache[key] || belongingsRecordsCache[key] || directorySummaryRecordsCache[key] || null; }
  function getActiveCareFlags(record) { return [{key:'foodAllergy', label:'Food allergy', icon:'⚠', className:'is-danger'}].filter(flag => record?.riskFlags?.[flag.key]); }
  function normalizeDirectoryPhoneForTel(value) { return String(value || '').replace(/[^+\\d]/g, ''); }
  ${briefRenderer}
  window.renderBrief = renderDirectoryCareBrief;
`;

function fixture(theme = '') {
  return `<!doctype html><html><head><style>
    ${css}
  </style></head><body class="${theme}"><main class="directory-card is-profile-active"><div class="directory-profile-content">
    <header class="directory-card-header"><div class="directory-photo-shell"><div class="directory-photo-media">🐶</div></div><div class="directory-card-identity"><button class="directory-dog-name-btn">A very long dog name that must wrap without clipping</button><button class="directory-primary-breed">Border Collie</button><div class="directory-stay-dates">📅 20 Sep 2026 – 22 Sep 2026</div></div></header>
    <div class="directory-attributes-grid directory-core-attributes"><button class="directory-attribute"><span class="directory-field-label">Owner</span><span class="directory-field-value">Alexandria Peterson-Smith with a very long family name</span></button><button class="directory-attribute"><span class="directory-field-label">Contact</span><span class="directory-field-value">0400 123 456</span></button><button class="directory-attribute directory-attribute-wide"><span class="directory-field-label">Notes</span><span class="directory-field-value">Long care notes wrap here and remain discoverable for the sitter.</span></button></div>
    <section class="directory-profile-section"><div class="directory-profile-section-heading"><div><span class="directory-profile-section-kicker">Guest profile</span><h4>📋 Profile &amp; Care</h4></div><div class="directory-profile-section-tools"><button class="directory-profile-edit-toggle">✏️ Edit</button></div></div><div data-directory-detail="profile"><div data-intake-profile-summary></div><div data-directory-intake-attributes><div>Loading profile…</div></div></div></section>
  </div></main></body></html>`;
}

test('Care overview wraps long values and keeps controls usable at phone widths', async ({ page }) => {
  for (const width of [390, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture());
    await page.addScriptTag({ content: actualRenderer });
    await page.evaluate(() => renderDirectoryIntakeAttributes(document.querySelector('.directory-card'), { intakeAttributes: { medicationInstructions: 'Give after dinner; call owner if appetite changes.' }, intakeAttributesSource: 'Synthetic saved fixture' }));
    await expect(page.locator('.directory-profile-section-heading h4')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.directory-field-value').first()).toHaveCSS('font-size', '14px');
    await expect(page.locator('.intake-profile-control').first()).toHaveAttribute('placeholder', 'Not provided');
    await expect(page.locator('.care-category-toggle')).toHaveCount(4);
    expect(await page.locator('.care-category-toggle').evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-expanded') === 'false'))).toBeTruthy();
    await page.locator('[data-profile-subtab="foodWalks"]').click();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeHidden();
    await page.locator('[data-profile-subtab="behaviour"]').click();
    await expect(page.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
    await expect(page.locator('[data-profile-subpanel="behaviour"]')).toBeVisible();
    await expect(page.locator('[data-intake-attribute="feedingTimes"]')).toBeHidden();
    await expect(page.locator('[data-intake-attribute="friendlyDogs"]')).toBeVisible();
    const identityLayout = await page.evaluate(() => {
      if (document.documentElement.scrollWidth > innerWidth) return false;
      return ['.directory-dog-name-btn', '.directory-primary-breed', '.directory-stay-dates'].map(selector => {
        const el = document.querySelector(selector);
        const style = getComputedStyle(el);
        return { selector, width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
      });
    });
    expect(identityLayout.every(item => item.scrollWidth <= item.width + 1 && item.scrollHeight <= item.height + 2 && item.textOverflow !== 'ellipsis' && item.whiteSpace !== 'nowrap')).toBeTruthy();
    await page.locator('button').first().focus();
    expect(await page.locator('button').first().evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.screenshot({ path: `test-results/care-overview-${width}.png`, fullPage: true });
  }
});

test('the fixture stays aligned with the production generated profile structure', () => {
  for (const selector of ['directory-profile-section', 'directory-profile-subtab', 'data-directory-intake-attributes', 'data-directory-profile-care', 'directory-profile-read-status']) {
    expect(appSource).toContain(selector);
  }
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
      ${['feeding','medication','safety','intake','handover'].map(key => `<div class="directory-care-readiness-row" data-care-readiness-item="${key}"><span class="directory-care-readiness-copy"><strong>${key}</strong><small data-care-readiness-detail></small></span><span class="directory-care-readiness-status" data-care-readiness-status></span><button>Review</button></div>`).join('')}
      </div></details><div data-care-brief-safety></div><p data-care-brief-feeding></p><p data-care-brief-medication></p><span data-care-brief-freshness></span><span data-care-brief-call-owner></span>
      <div data-directory-intake>Intake not sent</div><button data-directory-edit-field="notes" data-directory-current-value="" ></button>
    </section></main></body></html>`);
  await page.addScriptTag({ content: briefTestCode });
  await page.evaluate(() => {
    window.renderBrief(document.querySelector('.directory-card'));
  });
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('3 to review');
  await expect(page.locator('[data-care-readiness-item="feeding"]')).toHaveAttribute('data-state', 'pending');
  await expect(page.locator('[data-care-readiness-item="safety"] [data-care-readiness-status]')).toHaveText('Check');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.intakeMethod = 'legacy';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-readiness-item="intake"]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('2 to review');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    directoryProfileDetailCache[card.dataset.stayKey] = { intakeAttributes: { feedingTimes: '7 am', medicationInstructions: 'With dinner' } };
    careRiskRecordsCache[card.dataset.stayKey] = { riskFlags: {} };
    card.querySelector('[data-directory-intake]').textContent = 'Intake complete';
    card.querySelector('[data-directory-edit-field="notes"]').dataset.directoryCurrentValue = 'Call before pickup';
    window.renderBrief(card);
  });
  await expect(page.locator('[data-care-readiness-summary]')).toHaveText('Ready for care');
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
