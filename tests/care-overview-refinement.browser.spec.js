const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');

function fixture(theme = '') {
  return `<!doctype html><html><head><style>
    :root{--wh-surface:#fff;--wh-surface-muted:#f8fafc;--wh-text:#172033;--wh-text-muted:#475569;--wh-border:#cbd5e1;--wh-border-soft:#e2e8f0;--wh-accent:#2563eb;--wh-primary:#0f3550}
    body.dark-theme{--wh-surface:#182235;--wh-surface-muted:#202c3e;--wh-text:#f8fafc;--wh-text-muted:#cbd5e1;--wh-border:#40516a;--wh-border-soft:#40516a;--wh-accent:#93c5fd;--wh-primary:#dbeafe}
    body{margin:0;background:var(--wh-surface-muted);color:var(--wh-text);font:14px/1.45 system-ui,sans-serif}.directory-card{max-width:980px;margin:16px auto;background:var(--wh-surface);border:1px solid var(--wh-border)}
    .directory-profile-content{display:block;padding:18px}.directory-card-header{display:flex;gap:16px}.directory-card-identity{min-width:0}.directory-dog-name-btn,.directory-primary-breed,.directory-attribute{border:0;background:none;color:inherit;text-align:left}.directory-dog-name-btn{font-size:25px;font-weight:800}.directory-primary-breed{display:block}.directory-stay-dates{margin-top:8px}.directory-attributes-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.directory-attribute{display:grid;gap:5px;padding:10px;border:1px solid var(--wh-border);border-radius:9px}.directory-field-label{color:var(--wh-text-muted)}.directory-profile-section{margin-top:14px;border:1px solid var(--wh-border);border-radius:11px;overflow:hidden}.directory-profile-section-heading,.care-risk-section-heading,.belongings-item-section-heading{display:flex;justify-content:space-between;padding:12px 13px;background:var(--wh-surface-muted)}.directory-profile-section-heading h4{margin:0}.directory-profile-section-kicker{display:block;color:var(--wh-text-muted)}.directory-profile-section-tools{display:flex;gap:6px}.directory-profile-subtabs{display:flex;gap:8px;padding:10px;overflow:auto}.directory-profile-subtab{padding:8px 12px;border:1px solid var(--wh-border);border-radius:999px;background:var(--wh-surface);color:var(--wh-text)}.directory-profile-subtab.is-active{border-color:var(--wh-accent);color:var(--wh-accent)}.intake-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.intake-profile-field{display:grid;gap:4px;min-width:0;padding:9px;border:1px solid var(--wh-border)}.intake-profile-field label{color:var(--wh-text-muted)}.intake-profile-control{max-width:100%;box-sizing:border-box}.care-risk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.care-risk-option{display:flex;gap:7px;align-items:center;padding:8px;border:1px solid var(--wh-border)}.care-risk-label{min-width:0}.directory-card.is-profile-active .directory-card-identity,.directory-card.is-profile-active .directory-profile-section,.directory-card.is-profile-active .directory-attributes-grid{min-width:0}
    ${css}
  </style></head><body class="${theme}"><main class="directory-card is-profile-active"><div class="directory-profile-content">
    <header class="directory-card-header"><div class="directory-card-identity"><button class="directory-dog-name-btn">A very long dog name that must wrap without clipping</button><button class="directory-primary-breed">Border Collie</button><div class="directory-stay-dates">📅 20 Sep 2026 – 22 Sep 2026</div></div></header>
    <div class="directory-attributes-grid directory-core-attributes"><button class="directory-attribute"><span class="directory-field-label">Owner</span><span class="directory-field-value">Alexandria Peterson-Smith with a very long family name</span></button><button class="directory-attribute"><span class="directory-field-label">Contact</span><span class="directory-field-value">0400 123 456</span></button><button class="directory-attribute directory-attribute-wide"><span class="directory-field-label">Notes</span><span class="directory-field-value">Long care notes wrap here and remain discoverable for the sitter.</span></button></div>
    <section class="directory-profile-section"><div class="directory-profile-section-heading"><div><span class="directory-profile-section-kicker">Guest profile</span><h4>📋 Profile &amp; Care</h4></div><div class="directory-profile-section-tools"><button class="directory-profile-edit-toggle">✏️ Edit</button></div></div><div class="directory-profile-subtabs"><button class="directory-profile-subtab is-active">Overview</button><button class="directory-profile-subtab">Care &amp; Safety</button></div><div class="intake-profile-grid"><div class="intake-profile-field"><label>Feeding instructions</label><div class="intake-profile-control">Not provided</div></div><div class="intake-profile-field"><label>Medication notes</label><div class="intake-profile-control">Give after dinner; call owner if appetite changes.</div></div></div><div class="care-profile-compact"><div class="care-risk-section-heading"><div><strong>🛡️ Care &amp; Safety</strong><span>Operational alerts stored with this guest profile.</span></div></div><div class="care-risk-grid"><label class="care-risk-option"><input type="checkbox"><span class="care-risk-label">Separation anxiety</span></label><label class="care-risk-option"><input type="checkbox"><span class="care-risk-label">Food allergy and dietary warning</span></label></div></div></section>
  </div></main></body></html>`;
}

test('Care overview wraps long values and keeps controls usable at phone widths', async ({ page }) => {
  for (const width of [390, 412, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture());
    await expect(page.locator('.directory-profile-section-heading h4')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.directory-field-value').first()).toHaveCSS('font-size', '14px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.locator('button').first().focus();
    expect(await page.locator('button').first().evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.screenshot({ path: `test-results/care-overview-${width}.png`, fullPage: true });
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
