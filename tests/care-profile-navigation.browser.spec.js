const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const tabsStart = source.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS');
const tabsEnd = source.indexOf('];', tabsStart) + 2;
const helperStart = source.indexOf('    const directoryCareSectionChoices = new Map();');
const openStart = source.indexOf('    async function openDirectoryGuestProfile(', helperStart);
const closeStart = source.indexOf('    function closeDirectoryGuestProfile(', openStart);
const closeEnd = source.indexOf('    function restoreSelectedDirectoryProfile(', closeStart);
const runtime = `${source.slice(tabsStart, tabsEnd)}
${source.slice(helperStart, openStart)}
let directorySelectedProfileStayKey = '';
let directoryProfileNavigationOrigin = null;
function setDirectoryProfileEditMode() {} function switchDirectoryProfileMainTab() {}
function moveDirectoryRosterBadgesIntoProfileHeader() {} function restoreDirectoryRosterBadgesToList() {}
function loadDirectoryProfileDetail() { return Promise.resolve(); }
function filterGuestDirectoryCards() {} function restoreDirectoryProfileNavigationOrigin() { return false; }
${source.slice(openStart, closeEnd)}
window.openProfile = openDirectoryGuestProfile; window.closeProfile = closeDirectoryGuestProfile;`;

function fixture() {
  return `<main>
    <article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-stay-key="current-a"><h2>Buddy</h2>
      <button data-profile-subtab="foodWalks" aria-expanded="false" aria-controls="a-food">Food</button><div id="a-food" data-profile-subpanel="foodWalks" hidden><input aria-label="Food note"></div>
      <button data-profile-subtab="safety" aria-expanded="false" aria-controls="a-safe">Safety</button><div id="a-safe" data-profile-subpanel="safety" hidden><input aria-label="Safety note"></div>
    </article>
    <article class="directory-card" data-directory-stay-id="stay-b" data-directory-dog-id="dog-b" data-directory-stay-key="past-b" data-v1082-past-stay="true"><h2>Buddy</h2>
      <button data-profile-subtab="foodWalks" aria-expanded="false" aria-controls="b-food">Food</button><div id="b-food" data-profile-subpanel="foodWalks" hidden>Food detail</div>
      <button data-profile-subtab="safety" aria-expanded="false" aria-controls="b-safe">Safety</button><div id="b-safe" data-profile-subpanel="safety" hidden>Safety detail</div>
    </article><div class="directory-dashboard-fused"></div></main>`;
}

test('care section choices survive real profile close/reopen and fresh-node restoration', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture());
    await page.addScriptTag({ content: runtime });
    await page.evaluate(() => document.querySelectorAll('[data-profile-subtab]').forEach(button => button.addEventListener('click', () => switchDirectoryProfileSubTab(button.closest('.directory-card'), button.dataset.profileSubtab, true))));
    const cards = page.locator('.directory-card');
    const guestA = cards.nth(0), guestB = cards.nth(1);
    await page.evaluate(() => openProfile(document.querySelector('[data-directory-stay-id="stay-a"]'), { instant: true, preserveScroll: true }));
    const foodA = guestA.locator('[data-profile-subtab="foodWalks"]');
    await foodA.focus();
    await expect(foodA).toBeFocused();
    await foodA.click();
    const clicked = await foodA.evaluate(button => ({ tabs: button.closest('.directory-card').dataset.profileSubTabs, expanded: button.getAttribute('aria-expanded') }));
    expect(clicked).toEqual({ tabs: 'foodWalks', expanded: 'true' });
    await expect(guestA.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await foodA.press('Enter');
    await expect(guestA.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
    await page.evaluate(() => closeProfile({ preserveScroll: true, restoreOrigin: true }));
    await page.evaluate(() => openProfile(document.querySelector('[data-directory-stay-id="stay-a"]'), { instant: true, preserveScroll: true }));
    await expect(guestA.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();

    await page.evaluate(() => closeProfile({ preserveScroll: true, restoreOrigin: true }));
    await page.evaluate(() => openProfile(document.querySelector('[data-directory-stay-id="stay-b"]'), { instant: true, preserveScroll: true }));
    await expect(guestB.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
    await page.evaluate(() => closeProfile({ preserveScroll: true, restoreOrigin: true }));
    await page.evaluate(() => openProfile(document.querySelector('[data-directory-stay-id="stay-a"]'), { instant: true, preserveScroll: true }));
    await page.locator('[data-directory-stay-id="stay-a"] [data-profile-subtab="foodWalks"]').click();
    await expect(page.locator('[data-directory-stay-id="stay-a"] [data-profile-subpanel="foodWalks"]')).toBeVisible();
    await page.evaluate(() => closeProfile({ preserveScroll: true, restoreOrigin: true }));
    await page.evaluate(() => {
      const old = document.querySelector('[data-directory-stay-id="stay-a"]');
      const fresh = document.createElement('article');
      fresh.className = 'directory-card';
      fresh.dataset.directoryStayId = 'stay-a';
      fresh.dataset.directoryDogId = 'dog-a';
      fresh.dataset.directoryStayKey = 'current-a';
      fresh.innerHTML = '<h2>Buddy</h2><button data-profile-subtab="foodWalks" aria-expanded="false" aria-controls="fresh-food">Food</button><div id="fresh-food" data-profile-subpanel="foodWalks" hidden>Food detail</div><button data-profile-subtab="safety" aria-expanded="false" aria-controls="fresh-safe">Safety</button><div id="fresh-safe" data-profile-subpanel="safety" hidden>Safety detail</div>';
      old.replaceWith(fresh);
      fresh.querySelectorAll('[data-profile-subtab]').forEach(button => button.addEventListener('click', () => switchDirectoryProfileSubTab(fresh, button.dataset.profileSubtab, true)));
      openProfile(fresh, { instant: true, preserveScroll: true });
    });
    const freshA = page.locator('[data-directory-stay-id="stay-a"]');
    await expect(freshA.locator('[data-profile-subpanel="foodWalks"]')).toBeVisible();
    await freshA.locator('[data-profile-subtab="safety"]').focus();
    await expect(freshA.locator('[data-profile-subtab="safety"]')).toBeFocused();
    await freshA.locator('[data-profile-subtab="foodWalks"]').press('Enter');
    await expect(freshA.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
    await page.evaluate(() => closeProfile({ preserveScroll: true, restoreOrigin: true }));
    await page.evaluate(() => openProfile(document.querySelector('[data-directory-stay-id="stay-a"]'), { instant: true, preserveScroll: true }));
    await expect(freshA.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
  }
});
