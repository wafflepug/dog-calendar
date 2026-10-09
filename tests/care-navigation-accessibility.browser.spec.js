const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const careSource = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');

test('Care tabs name and control their panels; keyboard focus moves independently from activation', async ({ page }) => {
  await page.setContent(`<!doctype html><body data-waffle-page="directory">
    <main class="directory-card is-profile-active" data-dog-id="dog-a">
      <div class="directory-profile-content">
        <nav class="directory-main-profile-tabs"><button class="directory-main-profile-tab is-active" data-directory-main-tab="profile">Overview</button></nav>
        <section data-directory-main-panel="profile"><textarea data-draft>Keep this draft</textarea></section>
        <section data-directory-main-panel="belongings"><p>Saved belongings</p></section>
      </div>
    </main>
    <main class="directory-card is-profile-active" data-dog-id="dog-b">
      <div class="directory-profile-content">
        <section data-directory-main-panel="profile"></section>
        <section data-directory-main-panel="belongings"><p>Saved belongings</p></section>
      </div>
    </main>
  </body>`);
  await page.evaluate(() => {
    window.WAFFLE_PAGE = 'directory';
    window.careTabLoads = [];
    window.switchDirectoryProfileMainTab = (_card, key) => window.careTabLoads.push(key);
    window.v110LoadMedia = () => window.careTabLoads.push('media');
  });
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

  const firstCard = page.locator('.directory-card').first();
  const overview = firstCard.locator('[data-v11160-tab="profile"]');
  const finalTab = firstCard.locator('[data-v11160-tab="master"]');
  const itemsTab = firstCard.locator('[data-v11160-tab="belongings"]');
  const profilePanel = firstCard.locator('[data-directory-main-panel="profile"]');
  await overview.focus();
  await page.keyboard.press('End');
  await expect(finalTab).toBeFocused();
  await expect(finalTab).toHaveAttribute('tabindex', '0');
  await expect(finalTab).toHaveAttribute('aria-selected', 'false');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expect(profilePanel).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(profilePanel).toBeFocused();
  await overview.focus();
  await expect(firstCard.locator('#' + await finalTab.getAttribute('aria-controls'))).toHaveAttribute('aria-labelledby', await finalTab.getAttribute('id'));
  await expect(profilePanel).toBeVisible();
  expect(await page.evaluate(() => window.careTabLoads)).toEqual([]);

  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1000);
  await expect(itemsTab).toBeFocused();
  await expect(itemsTab).toHaveAttribute('tabindex', '0');
  await expect(itemsTab).toHaveAttribute('aria-selected', 'false');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expect(profilePanel).toBeVisible();
  expect(await page.evaluate(() => window.careTabLoads)).toEqual([]);

  await page.keyboard.press('Space');
  await expect(itemsTab).toHaveAttribute('aria-selected', 'true');
  await expect(firstCard.locator('[data-directory-main-panel="belongings"]')).toBeVisible();
  await expect(profilePanel).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(firstCard.locator('[data-directory-main-panel="belongings"]')).toBeFocused();
  expect(await page.evaluate(() => window.careTabLoads)).toEqual(['belongings']);

  await itemsTab.focus();
  await page.keyboard.press('ArrowRight');
  const mediaTab = firstCard.locator('[data-v11160-tab="media"]');
  await expect(mediaTab).toBeFocused();
  await expect(mediaTab).toHaveAttribute('aria-selected', 'false');
  expect(await page.evaluate(() => window.careTabLoads)).toEqual(['belongings']);
  await page.keyboard.press('Enter');
  await expect(mediaTab).toHaveAttribute('aria-selected', 'true');
  await expect(firstCard.locator('[data-v110-panel="media"]')).toBeVisible();
  expect(await page.evaluate(() => window.careTabLoads)).toEqual(['belongings', 'media']);
  expect(await page.locator('[data-draft]').inputValue()).toBe('Keep this draft');
});
