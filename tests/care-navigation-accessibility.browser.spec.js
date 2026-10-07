const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const careSource = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');

test('Care tabs name and control their matching panels and retain keyboard navigation', async ({ page }) => {
  await page.setContent(`<!doctype html><body data-waffle-page="directory">
    <main class="directory-card is-profile-active" data-dog-id="dog-a">
      <div class="directory-profile-content">
        <nav class="directory-main-profile-tabs"><button class="directory-main-profile-tab is-active" data-directory-main-tab="profile">Overview</button></nav>
        <section data-directory-main-panel="profile"><textarea data-draft>Keep this draft</textarea></section>
        <section data-directory-main-panel="belongings"></section>
      </div>
    </main>
    <main class="directory-card is-profile-active" data-dog-id="dog-b">
      <div class="directory-profile-content">
        <section data-directory-main-panel="profile"></section>
        <section data-directory-main-panel="belongings"></section>
      </div>
    </main>
  </body>`);
  await page.evaluate(() => { window.WAFFLE_PAGE = 'directory'; });
  await page.addScriptTag({ content: careSource });
  const tabs = page.locator('.directory-card.is-profile-active .v11160-desktop-tab');
  await expect(tabs).toHaveCount(10);
  await expect.poll(() => page.locator('.directory-card').evaluateAll(cards => cards.every(card => {
    const nav = card.querySelector('[role="tablist"]');
    const selected = nav?.querySelector('[role="tab"][aria-selected="true"]');
    const tabs = Array.from(nav?.querySelectorAll('[role="tab"]') || []);
    const panels = Array.from(card.querySelectorAll('[role="tabpanel"]'));
    return selected && panels.length === 5 && tabs.every(tab => {
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      return tab.id && panel && card.contains(panel) && panel.getAttribute('aria-labelledby') === tab.id;
    });
  }))).toBe(true);
  expect(await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id);
    return ids.length === new Set(ids).size;
  })).toBe(true);
  const overview = page.locator('.directory-card').first().locator('[data-v11160-tab="profile"]');
  await overview.focus();
  await page.keyboard.press('End');
  const finalTab = page.locator('.directory-card').first().locator('[data-v11160-tab="master"]');
  await expect(finalTab).toBeFocused();
  await expect(finalTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.directory-card').first().locator('#' + await finalTab.getAttribute('aria-controls'))).toHaveAttribute('aria-labelledby', await finalTab.getAttribute('id'));
  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  const itemsTab = page.locator('.directory-card').first().locator('[data-v11160-tab="belongings"]');
  await expect(itemsTab).toBeFocused();
  await expect(itemsTab).toHaveAttribute('aria-selected', 'true');
  expect(await page.locator('.directory-card').first().locator('[role="tabpanel"]').evaluateAll(panels =>
    panels.filter(panel => !panel.hidden).map(panel => panel.dataset.directoryMainPanel || panel.dataset.v110Panel)
  )).toEqual(['belongings']);
  expect(await page.locator('[data-draft]').inputValue()).toBe('Keep this draft');
});
