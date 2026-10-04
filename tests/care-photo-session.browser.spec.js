const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.css'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const renderer = [
  extractFunction('findUniqueHostedPhotoCard'),
  extractFunction('syncHostedPhotoSessionControls')
].join('\n');

for (const width of [320, 390]) {
  for (const theme of ['light', 'dark-theme']) {
    test(`hosted photo recovery controls render accessibly at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await page.setContent(`
        <main><article class="directory-card" data-directory-stay-key="stay-1" data-stay-key="stay-1">
          <section class="belongings-photo-upload-card"><div data-belongings-photo-status role="status">Paused</div></section>
        </article></main>
      `);
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: `
        window.hostedPhotoSessions = new Map([['stay-1::belongings', {
          stayKey: 'stay-1', photoType: 'belongings', sessionKey: 'stay-1::belongings',
          sessionState: 'failed', submitted: true,
          identity: { dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-05' }
        }]]);
        window.escapeDashboardHtml = value => String(value);
        window.directoryProfileEditKey = card => card.dataset.stayKey;
        window.getDirectoryProfileEditIdentity = () => ({ dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-05' });
        window.directoryProfileEditIdentityConflicts = (a, b) => a.dogName !== b.dogName || a.startDate !== b.startDate || a.endDate !== b.endDate;
        ${renderer}
        window.syncHostedPhotoSessionControls();
      ` });
      if (theme === 'dark-theme') await page.locator('body').evaluate(el => el.classList.add('dark-theme'));

      const controls = page.locator('[data-hosted-photo-session-controls]');
      await expect(controls).toContainText('Upload paused with an error');
      await expect(controls.getByRole('button', { name: 'Resume' })).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Check' })).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Discard' })).toBeVisible();
      const heights = await controls.locator('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
      expect(heights).toEqual([44, 44, 44]);
      expect(await page.locator('html').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
