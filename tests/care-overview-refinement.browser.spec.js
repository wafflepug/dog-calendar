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
const actualRenderer = `${careFlags}\n${intakeGroups}\n${profileTabs}\nlet careRiskRecordsCache = {};\nconst directorySummaryRecordsCache = {};\nconst belongingsRecordsCache = {};\nconst applyDirectoryProfileEditMode = () => {};\nfunction escapeDashboardHtml(value){return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}\n${intakeControl}\n${intakeRenderer}\n${careRenderer}\nwindow.renderDirectoryIntakeAttributes = renderDirectoryIntakeAttributes;`;

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
    await expect(page.locator('.directory-profile-subtab')).toHaveCount(5);
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
