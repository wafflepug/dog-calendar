const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const importedCss = [...runtimeCss.matchAll(/@import url\("([^?]+)[^"]*"\);/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const settingsSource = fs.readFileSync(path.join(root, 'waffle-ui.js'), 'utf8');
const paletteCss = [...settingsSource.matchAll(/:root\[data-waffle-colour-style="[^"]+"\](?: body\.dark-theme)?\s*\{[^}]+\}/g)].map(match => match[0]).join('\n');
const shellCss = [...settingsSource.matchAll(/body(?:\.dark-theme|:not\(\.dark-theme\))\s*\{\s*--wh75-shell:[^}]+\}/g)].map(match => match[0]).join('\n');
const css = importedCss + '\n' + runtimeCss.replace(/@import[^;]+;/g, '') + '\n' + paletteCss + '\n' + shellCss + '\n* { transition: none !important; animation: none !important; }';
const paletteNames = [...new Set([...paletteCss.matchAll(/data-waffle-colour-style="([^"]+)"/g)].map(match => match[1]))];
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const care = fs.readFileSync(path.join(root, 'care.js'), 'utf8');
const start = app.indexOf('function intakeAttributeControlHtml');
const end = app.indexOf('function directoryCareCategorySummary', start);
const realControlRenderer = app.slice(start, end);
const reviewStart = care.indexOf('      confirmHost.innerHTML = `');
const reviewEnd = care.indexOf('\n      confirmHost.hidden = false', reviewStart);
const actualReviewTemplate = care.slice(reviewStart, reviewEnd);
const identityLabelStart = care.indexOf('    const identityLabel = item =>');
const identityLabelEnd = care.indexOf('\n    const updateReviewButton', identityLabelStart);
const actualIdentityLabel = care.slice(identityLabelStart, identityLabelEnd);
const actualPanelTemplate = care.match(/panel\.innerHTML\s*=\s*(`[^`]*`);/)[0];
const panelMarkup = new Function(`const panel = {}; ${actualPanelTemplate}; return panel.innerHTML;`)();


function profileMarkup() {
  return `<body data-waffle-page="directory"><main class="directory-card is-profile-active" style="padding:12px"><section class="directory-profile-section"><div class="directory-profile-section-heading"><div><span class="directory-profile-section-kicker">Guest profile</span><h4>Profile &amp; Care</h4></div><div class="directory-profile-section-tools"><button class="directory-profile-edit-toggle">Edit profile</button><button class="directory-profile-edit-cancel">Discard changes</button></div></div><div data-directory-main-panel="profile"><div class="directory-profile-intake-section"><div class="intake-profile-grid" data-fields></div></div><div class="directory-profile-save-bar" data-savebar><p class="directory-profile-edit-status is-unsaved">Unsaved changes</p><button class="belongings-save-btn">Save changes</button></div></div></section></main></body>`;
}

function contrastRatio(fg, bg) {
  const channel = value => { const n = Number(value) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
  const lum = color => { const rgb = (color.startsWith('color(srgb') ? color.match(/[\d.]+/g).slice(0,3).map(value => Number(value) * 255) : color.match(/[\d.]+/g).slice(0, 3)).map(channel); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
  const values = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('Care profile editing and returning-stay review remain readable and usable at phone and desktop widths', async ({ page }) => {
  expect(paletteCss.match(/--wh75-accent-soft:/g)).toHaveLength(10);
  expect(actualReviewTemplate).toContain('data-care-stay-name-confirm');
  expect(actualReviewTemplate).toContain('data-care-stay-link-confirm');
  expect(actualReviewTemplate).toContain('data-care-stay-submit disabled');
  const renderer = new Function('escapeDashboardHtml', `${realControlRenderer}; return intakeAttributeControlHtml;`)(value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const renderReview = new Function('stay', 'dog', 'html', `${actualIdentityLabel}; const confirmHost = {}; const mismatch = true; ${actualReviewTemplate}; return confirmHost.innerHTML;`);
  const realReviewMarkup = renderReview(
    {dogName:'Maple · a long source name', startDate:'1 Sep', endDate:'4 Sep', ownerName:'Alexandria Peterson-Smith'},
    {dogId:'53b93dd1-18bc-4854-a7d0-df3942651f71', dogNumber:'#00001', dogName:'Alexandria’s exceptionally long-named dog', breed:'Border Collie'},
    escapeHtml
  );

  for (const theme of ['', 'dark-theme']) for (const width of [320, 390, 412, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`<style>${css}</style>${profileMarkup().replace('<body ', `<body class="${theme}" `)}`);
    await page.evaluate(() => { document.documentElement.dataset.waffleUiReady = "true"; document.body.dataset.waffleColourStyle = document.documentElement.dataset.waffleColourStyle = "waffle-purple"; });
    await page.evaluate(({renderFieldSource}) => {
      const renderField = new Function('escapeDashboardHtml', `${renderFieldSource}; return intakeAttributeControlHtml;`)(value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
      const fields = [
        {key:'foodAllergies', label:'Known food allergies and reactions, including very long care labels', type:'text'},
        {key:'feedingTimes', label:'Feeding times', type:'text'},
        {key:'friendlyDogs', label:'Friendly with other dogs?', type:'yesno'}
      ];
      document.querySelector('[data-fields]').innerHTML = fields.map(field => renderField(field, 'Very long saved value that must wrap cleanly within the control without changing or truncating its content', 'selected-profile')).join('');
      document.querySelectorAll('[data-intake-attribute]').forEach(control => control.disabled = true);
    }, {renderFieldSource: renderer.toString()});
    await page.locator('main').evaluate((host, markup) => {
      const panel = document.createElement('section');
      panel.className = 'care-stay-link';
      panel.innerHTML = markup;
      host.appendChild(panel);
      panel.querySelectorAll('select').forEach(select => { select.innerHTML = '<option>A very long dog name · 1–4 Sep · Alexandria Peterson-Smith</option>'; });
      panel.querySelector('.care-stay-link-review').disabled = false;
    }, panelMarkup);
    await expect(page.locator('.care-stay-link-confirm')).toBeHidden();
    await page.locator('.care-stay-link-confirm').evaluate((host, markup) => { host.innerHTML = markup; host.hidden = false; }, realReviewMarkup);
    // Measure settled layout/contrast, not intermediate compatibility transitions.
    await page.locator('main *').evaluateAll(nodes => nodes.forEach(node => node.style.setProperty('transition', 'none', 'important')));

    const controls = page.locator('.directory-profile-intake-section .intake-profile-control');
    await expect(controls).toHaveCount(3);
    const readonlyFont = parseFloat(await controls.first().evaluate(el => getComputedStyle(el).fontSize));
    expect(readonlyFont).toBeLessThan(16);
    await expect(page.locator('[data-savebar]')).toBeHidden();

    await page.locator('.directory-card').evaluate(card => card.classList.add('is-profile-editing'));
    await controls.evaluateAll(nodes => nodes.forEach(node => { node.disabled = false; }));
    await page.locator('[data-savebar]').evaluate(node => node.style.display = 'flex');
    for (const control of await controls.all()) {
      await expect(control).toHaveCSS('font-size', '16px');
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const button of await page.locator('.directory-profile-edit-toggle, .directory-profile-edit-cancel, .directory-profile-save-bar button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await expect(page.locator('.directory-profile-edit-toggle')).toHaveCSS('font-size', '14px');
    await expect(page.locator('.directory-profile-edit-cancel')).toHaveCSS('font-size', '14px');
    await page.keyboard.press('Tab');
    await page.locator('.directory-profile-edit-toggle').focus();
    await expect(page.locator('.directory-profile-edit-toggle')).toHaveCSS('outline-style', 'solid');

    const link = page.locator('.care-stay-link');
    expect((await link.locator('.care-stay-link-close').boundingBox()).height).toBeGreaterThanOrEqual(44);
    for (const select of await link.locator('select').all()) {
      await expect(select).toHaveCSS('font-size', '16px');
      expect((await select.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const review = page.locator('.care-stay-link-review-card');
    await expect(review.locator('strong').first()).toHaveCSS('font-size', '13px');
    for (const label of await review.locator('label').all()) await expect(label).toHaveCSS('font-size', '14px');
    const actions = await review.locator('.care-stay-link-actions button').evaluateAll(nodes => nodes.map(el => ({box: el.getBoundingClientRect().toJSON(), style:getComputedStyle(el)})));
    for (const action of actions) {
      expect(action.box.height).toBeGreaterThanOrEqual(44);
      expect(action.box.right).toBeLessThanOrEqual(width + .5);
    }
    expect(await page.locator('.care-stay-link-review-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    await page.evaluate(() => document.body.dataset.waffleColourStyle = document.documentElement.dataset.waffleColourStyle = 'waffle-purple');
    const primary = await page.locator('.directory-profile-edit-toggle').evaluate(el => ({fg:getComputedStyle(el).color, bg:getComputedStyle(el).backgroundColor}));
    expect(contrastRatio(primary.fg, primary.bg)).toBeGreaterThanOrEqual(4.5);
    const secondary = await page.locator('.directory-profile-edit-cancel').evaluate(el => ({fg:getComputedStyle(el).color, bg:getComputedStyle(el).backgroundColor}));
    expect(contrastRatio(secondary.fg, secondary.bg)).toBeGreaterThanOrEqual(4.5);
    for (const primaryButton of [page.locator('.directory-profile-save-bar button'), page.locator('.care-stay-link-review')]) {
      const colors = await primaryButton.evaluate(el => ({name:el.className,soft:getComputedStyle(el).getPropertyValue('--wh75-accent-soft'),fg:getComputedStyle(el).color, bg:getComputedStyle(el).backgroundColor}));
      expect(contrastRatio(colors.fg, colors.bg), JSON.stringify({theme,width,...colors})).toBeGreaterThanOrEqual(4.5);
    }
    for (const palette of paletteNames) {
      await page.evaluate(name => document.body.dataset.waffleColourStyle = document.documentElement.dataset.waffleColourStyle = name, palette);
      for (const selector of ['.directory-profile-edit-toggle', '.directory-profile-save-bar button', '.care-stay-link-review']) {
        const colors = await page.locator(selector).evaluate(el => ({fg:getComputedStyle(el).color, bg:getComputedStyle(el).backgroundColor}));
        expect(contrastRatio(colors.fg, colors.bg), `${theme || 'light'} ${palette} ${selector}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    await page.evaluate(() => document.body.dataset.waffleColourStyle = document.documentElement.dataset.waffleColourStyle = 'waffle-purple');
    for (const selector of ['.care-stay-link-review-card > strong', '.care-stay-link-review-card > span', '.care-stay-link-close']) {
      const colors = await page.locator(selector).first().evaluate(el => ({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.care-stay-link-review-card') || el).backgroundColor}));
      expect(contrastRatio(colors.fg, colors.bg), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const state of ['unsaved','saving','error','success']) {
      const colors = await page.locator('.directory-profile-edit-status').evaluate((el,state) => {el.className = 'directory-profile-edit-status is-' + state; let parent=el; let bg=''; while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;} return {fg:getComputedStyle(el).color,bg};},state);
      expect(contrastRatio(colors.fg,colors.bg), `${theme} ${state}`).toBeGreaterThanOrEqual(4.5);
    }
    await page.locator('.directory-profile-edit-status').evaluate(el => el.className='directory-profile-edit-status is-unsaved');
    await expect(page.locator('[data-care-stay-submit]')).toBeDisabled();
    await expect(page.locator('.care-stay-link-confirm[hidden]')).toHaveCount(0);
    await page.locator('.care-stay-link-review').evaluate(el => el.disabled = true);
    await expect(page.locator('.care-stay-link-review')).toBeDisabled();
    await page.locator('.care-stay-link-confirm').evaluate(host => host.hidden = true);
    await expect(page.locator('.care-stay-link-confirm')).toBeHidden();
    await page.locator('.care-stay-link-confirm').evaluate(host => host.hidden = false);
    if ((width === 320 && theme === '') || (width === 390 && theme === 'dark-theme')) {
      const screenshotDir = path.join(os.tmpdir(), 'care-ui-polish-evidence');
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, `care-ui-${theme || 'light'}-${width}.png`), fullPage: true });
    }
  }
});
