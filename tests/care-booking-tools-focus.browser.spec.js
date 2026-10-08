const { test, expect } = require('@playwright/test');
const path = require('node:path');

for (const [size, viewport] of [['320', { width: 320, height: 844 }], ['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`Sitter Tools focus continuity ${size}px ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      const mutations = [];
      await page.route('**/*', async route => {
        const request = route.request();
        if (!['GET', 'HEAD'].includes(request.method())) {
          mutations.push({ method: request.method(), url: request.url() });
          return route.fulfill({ status: 405, body: 'Read-only focus fixture blocked mutation' });
        }
        return route.continue();
      });
      await page.setContent('<!doctype html><html><body><button id="ownerLink" type="button">Owner link</button></body></html>');
      await page.addScriptTag({ path: path.join(__dirname, '..', 'phase4-core.js') });
      await page.evaluate(() => {
        const booking = document.querySelector('[data-p4-panel="booking"]');
        booking.innerHTML = '<button id="hiddenFirst" hidden>Hidden first</button><input id="disabledFirst" disabled><label>Dog name <input id="dogName" value="Milo"></label><label>Start date <input id="startDate" value="2026-10-10"></label>';
        document.querySelector('[data-p4-panel="owner"]').innerHTML = '<button id="ownerAction" type="button">Create owner link</button>';
      });
      const opener = page.locator('#ownerLink');
      await opener.focus();
      await opener.evaluate(el => window.WAFFLE_PHASE4_CORE.open('booking', el));
      const dialog = page.getByRole('dialog', { name: '🧰 Sitter Tools' });
      await expect(dialog).toBeVisible();
      await expect(page.locator('#dogName')).toBeFocused();
      await expect(page.locator('[data-p4-tab="booking"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-p4-tab="owner"]')).toHaveAttribute('aria-pressed', 'false');

      const closeButton = page.locator('[data-p4-close]');
      await closeButton.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#startDate')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(closeButton).toBeFocused();

      await page.locator('[data-p4-tab="owner"]').click();
      await expect(page.locator('[data-p4-tab="owner"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.querySelector('#p4Modal [role="dialog"]').contains(document.activeElement))).toBeTruthy();
      await page.locator('[data-p4-tab="booking"]').click();
      await expect(page.locator('#dogName')).toHaveValue('Milo');
      expect(await page.evaluate(() => document.querySelector('#p4Modal [role="dialog"]').contains(document.activeElement))).toBeTruthy();

      await page.evaluate(() => {
        window.__identityRead = new Promise(resolve => { window.__finishIdentityRead = resolve; });
        window.__identityRead.then(() => { document.querySelector('#dogName').dataset.identityRead = 'done'; });
      });
      await page.locator('#startDate').focus();
      await page.evaluate(() => window.__finishIdentityRead());
      await expect(page.locator('#startDate')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();

      await opener.evaluate(el => window.WAFFLE_PHASE4_CORE.open('owner', el));
      await page.evaluate(() => {
        const outer = document.createElement('div');
        outer.id = 'outerModal'; outer.setAttribute('role', 'dialog'); outer.setAttribute('aria-modal', 'true');
        outer.innerHTML = '<button id="outerAction">Outer action</button>';
        document.body.appendChild(outer); document.querySelector('#outerAction').focus();
      });
      const outerEscapePrevented = await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.dispatchEvent(event); return event.defaultPrevented; });
      expect(outerEscapePrevented).toBe(false);
      await expect(dialog).toBeVisible();
      await expect(page.locator('#outerAction')).toBeFocused();
      const outerTabPrevented = await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); document.dispatchEvent(event); return event.defaultPrevented; });
      expect(outerTabPrevented).toBe(false);
      await page.locator('#outerModal').evaluate(el => el.remove());
      await page.evaluate(() => { document.body.setAttribute('tabindex', '7'); document.querySelector('#ownerLink').disabled = true; });
      await page.locator('[data-p4-close]').click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('body')).toHaveAttribute('tabindex', '7');
      expect(await page.evaluate(() => document.activeElement === document.body)).toBeTruthy();

      await page.evaluate(() => { document.body.removeAttribute('tabindex'); const button = document.querySelector('#ownerLink'); button.disabled = false; window.WAFFLE_PHASE4_CORE.open('booking', button); button.hidden = true; });
      await page.locator('[data-p4-close]').click();
      await expect(dialog).toBeHidden();
      expect(await page.evaluate(() => document.activeElement === document.body)).toBeTruthy();
      expect(await page.locator('body').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => { const button = document.querySelector('#ownerLink'); button.hidden = false; window.WAFFLE_PHASE4_CORE.open('booking', button); button.remove(); });
      await page.locator('[data-p4-close]').click();
      await expect(dialog).toBeHidden();
      expect(await page.evaluate(() => document.activeElement === document.body)).toBeTruthy();
      expect(mutations).toEqual([]);
    });
  }
}
