const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');

function fixture(theme = '') {
  return `<!doctype html><html><head><style>
    ${css}
  </style></head><body class="${theme}"><main class="directory-card is-profile-active"><div class="directory-profile-content">
    <header class="directory-card-header"><div class="directory-card-identity"><button class="directory-dog-name-btn">A very long dog name that must wrap without clipping</button><button class="directory-primary-breed">Border Collie</button><div class="directory-stay-dates">📅 20 Sep 2026 – 22 Sep 2026</div></div></header>
    <div class="directory-attributes-grid directory-core-attributes"><button class="directory-attribute"><span class="directory-field-label">Owner</span><span class="directory-field-value">Alexandria Peterson-Smith with a very long family name</span></button><button class="directory-attribute"><span class="directory-field-label">Contact</span><span class="directory-field-value">0400 123 456</span></button><button class="directory-attribute directory-attribute-wide"><span class="directory-field-label">Notes</span><span class="directory-field-value">Long care notes wrap here and remain discoverable for the sitter.</span></button></div>
    <section class="directory-profile-section"><div class="directory-profile-section-heading"><div><span class="directory-profile-section-kicker">Guest profile</span><h4>📋 Profile &amp; Care</h4></div><div class="directory-profile-section-tools"><button class="directory-profile-edit-toggle">✏️ Edit</button></div></div><div class="directory-profile-subtabs"><button class="directory-profile-subtab is-active">Overview</button><button class="directory-profile-subtab">Care &amp; Safety</button></div><div class="intake-profile-grid"><div class="intake-profile-field"><label>Feeding instructions</label><div class="intake-profile-control">Not provided</div></div><div class="intake-profile-field"><label>Medication notes</label><div class="intake-profile-control">Give after dinner; call owner if appetite changes.</div></div></div><div class="care-profile-compact"><div class="care-risk-section-heading"><div><strong>🛡️ Care &amp; Safety</strong><span>Operational alerts stored with this guest profile.</span></div></div><div class="care-risk-grid"><label class="care-risk-option"><input type="checkbox"><span class="care-risk-label">Separation anxiety</span></label><label class="care-risk-option"><input type="checkbox"><span class="care-risk-label">Food allergy and dietary warning</span></label></div></div></section>
  </div></main></body></html>`;
}

test('Care overview wraps long values and keeps controls usable at phone widths', async ({ page }) => {
  for (const width of [390, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture());
    await expect(page.locator('.directory-profile-section-heading h4')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.directory-field-value').first()).toHaveCSS('font-size', '14px');
    await expect(page.locator('.intake-profile-control').first()).toHaveText('Not provided');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
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

test('Care overview text and boundaries meet the scoped contrast targets in light and dark themes', async ({ page }) => {
  for (const theme of ['', 'dark-theme']) {
    await page.setContent(fixture(theme));
    const contrast = await page.evaluate(() => {
    const parse = value => { const m = value.match(/\d+/g).map(Number); return m.slice(0, 3).map(v => v / 255); };
    const lum = rgb => rgb.map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const x = lum(parse(a)), y = lum(parse(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const sample = document.querySelector('.directory-field-value');
    const heading = document.querySelector('.directory-profile-section-heading h4');
    const surface = getComputedStyle(document.querySelector('.directory-card')).backgroundColor;
    return { body: ratio(getComputedStyle(sample).color, surface), heading: ratio(getComputedStyle(heading).color, surface) };
    });
    expect(contrast.body).toBeGreaterThanOrEqual(4.5);
    expect(contrast.heading).toBeGreaterThanOrEqual(4.5);
  }
});
