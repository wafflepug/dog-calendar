const { test, expect } = require('@playwright/test');
const { install, bookings } = require('./fixtures/care-daily-workflows');

test('Care roster search and supporting disclosures use the available header width', async ({ page, baseURL }, testInfo) => {
  const fixture = await install(page);
  const liveWrites = [];
  page.on('request', request => {
    if (request.url().includes('script.google.com') && !['GET', 'HEAD'].includes(request.method())) liveWrites.push(request.method());
  });
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_CARE_ROSTER_FOCUS);
  const toolbar = page.locator('.directory-roster-heading .guest-directory-toolbar');
  const search = toolbar.locator('#guestDirectorySearch');
  const today = toolbar.locator('[data-care-roster-focus]');
  const manage = toolbar.locator('.care-record-maintenance');

  for (const [width, dark] of [[320, false], [390, true], [768, false], [1440, true]]) {
    await page.setViewportSize({ width, height: width < 400 ? 740 : 900 });
    await page.locator('body').evaluate((body, isDark) => body.classList.toggle('dark-theme', isDark), dark);
    await expect(toolbar).toBeVisible();
    await expect(search).toBeVisible();
    await expect(today.locator('summary')).toBeVisible();
    await expect(manage.locator('summary')).toBeVisible();
    if (width === 390 || width === 1440) {
      await page.locator('body').evaluate(body => body.classList.remove('dark-theme'));
      await page.screenshot({ path: testInfo.outputPath(`care-toolbar-closed-${width}-light.png`), fullPage: false, animations: "disabled" });
      if (dark) await page.locator('body').evaluate(body => body.classList.add('dark-theme'));
    }

    const before = await toolbar.evaluate(root => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const input = root.querySelector('#guestDirectorySearch');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = getComputedStyle(input).font;
      const placeholderWidth = context.measureText(input.placeholder).width + parseFloat(getComputedStyle(input).paddingLeft) + parseFloat(getComputedStyle(input).paddingRight) + 2;
      const today = root.querySelector('[data-care-roster-focus] summary'), manage = root.querySelector('.care-record-maintenance summary');
      return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, toolbar: rect(root), headingWidth: root.parentElement.clientWidth - parseFloat(getComputedStyle(root.parentElement).paddingLeft) - parseFloat(getComputedStyle(root.parentElement).paddingRight), search: rect(input), placeholderWidth, today: rect(today), manage: rect(manage), todayFont: getComputedStyle(today).fontSize, manageFont: getComputedStyle(manage).fontSize, todayWeight: getComputedStyle(today).fontWeight, manageWeight: getComputedStyle(manage).fontWeight, todayMarker: getComputedStyle(today, '::marker').content, manageMarker: getComputedStyle(manage, '::marker').content };
    });
    expect(before.pageWidth, JSON.stringify(before)).toBeLessThanOrEqual(width);
    expect(before.search.width, JSON.stringify(before)).toBeGreaterThanOrEqual(before.toolbar.width - 2);
    expect(before.search.width, JSON.stringify(before)).toBeGreaterThanOrEqual(before.placeholderWidth);
    if (width === 390) expect(before.search.width, JSON.stringify(before)).toBeGreaterThan(300);
    if(width <= 820) expect(before.toolbar.width, JSON.stringify(before)).toBeGreaterThanOrEqual(before.headingWidth - 1);
    expect(before.search.x).toBeGreaterThanOrEqual(before.toolbar.x - 1);
    expect(before.search.right).toBeLessThanOrEqual(before.toolbar.right + 1);
    expect(before.today.height).toBeGreaterThanOrEqual(44);
    expect(before.manage.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(before.today.y - before.manage.y)).toBeLessThanOrEqual(1);
    expect(before.todayMarker).not.toBe('none');
    expect(before.manageMarker).not.toBe('none');
    expect(before.todayFont).toBe(before.manageFont);
    expect(before.todayWeight).toBe(before.manageWeight);

    // Ensure 200% text remains operable in the bounded input and doesn't cause page overflow.
    await search.evaluate(input => input.style.setProperty('font-size', `${parseFloat(getComputedStyle(input).fontSize) * 2}px`, 'important'));
    await today.locator('summary').evaluate(el => el.style.setProperty('font-size', `${parseFloat(getComputedStyle(el).fontSize) * 2}px`, 'important'));
    await manage.locator('summary').evaluate(el => el.style.setProperty('font-size', `${parseFloat(getComputedStyle(el).fontSize) * 2}px`, 'important'));
    await search.fill('Alexandria Peterson-Smith-Wellington');
    await expect(search).toHaveValue('Alexandria Peterson-Smith-Wellington');
    await search.focus();
    const enlargedInput = await search.evaluate(input => ({ rect: input.getBoundingClientRect().toJSON(), scrollWidth: input.scrollWidth, clientWidth: input.clientWidth, focused: document.activeElement === input, value: input.value, pageWidth: document.documentElement.scrollWidth }));
    expect(enlargedInput.focused).toBe(true);
    expect(enlargedInput.value).toBe('Alexandria Peterson-Smith-Wellington');
    expect(enlargedInput.rect.right).toBeLessThanOrEqual(width + 1);
    expect(enlargedInput.pageWidth).toBeLessThanOrEqual(width);
    await search.evaluate(input => input.style.removeProperty('font-size'));
    await today.locator('summary').evaluate(el => el.style.removeProperty('font-size'));
    await manage.locator('summary').evaluate(el => el.style.removeProperty('font-size'));
    await search.fill('');

    const readsBeforeDisclosures = fixture.reads.filter(action => action === 'get_guest_profile').length;
    await today.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(today).toHaveAttribute('open', '');
    const rowAfterToday = await toolbar.evaluate(root => ({
      today: root.querySelector('[data-care-roster-focus]').getBoundingClientRect().toJSON(),
      manage: root.querySelector('.care-record-maintenance').getBoundingClientRect().toJSON()
    }));
    expect(rowAfterToday.manage.top).toBeGreaterThanOrEqual(rowAfterToday.today.bottom - 1);
    await today.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(today).not.toHaveAttribute('open', '');
    await manage.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(manage).toHaveAttribute('open', '');
    const onlyManage = await toolbar.evaluate(root => ({
      today: root.querySelector('[data-care-roster-focus]').getBoundingClientRect().toJSON(),
      manage: root.querySelector('.care-record-maintenance').getBoundingClientRect().toJSON()
    }));
    expect(onlyManage.manage.top).toBeGreaterThanOrEqual(onlyManage.today.bottom - 1);
    await manage.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(manage).not.toHaveAttribute('open', '');
    await today.locator('summary').focus();
    await page.keyboard.press('Enter');
    await manage.locator('summary').click();
    await expect(today).toHaveAttribute('open', '');
    await expect(manage).toHaveAttribute('open', '');
    const openBoth = await toolbar.evaluate(root => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { today: rect(root.querySelector('[data-care-roster-focus]')), manage: rect(root.querySelector('.care-record-maintenance')), options: [...root.querySelectorAll('[data-focus-options] button')].filter(el => el.getClientRects().length).map(rect), management: [...root.querySelectorAll('.care-record-maintenance-content > *')].filter(el => el.getClientRects().length).map(rect) };
    });
    expect(openBoth.today.bottom).toBeLessThanOrEqual(openBoth.manage.y + 1);
    for (const box of [...openBoth.options, ...openBoth.management]) {
      expect(box.x).toBeGreaterThanOrEqual(openBoth.manage.x - 1);
      expect(box.right).toBeLessThanOrEqual(openBoth.manage.right + 1);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(fixture.reads.filter(action => action === 'get_guest_profile').length).toBe(readsBeforeDisclosures);

    if (width === 390) await page.screenshot({ path: testInfo.outputPath('care-toolbar-open-mobile.png'), fullPage: false, animations: "disabled" });
    await today.locator('summary').click();
    await manage.locator('summary').click();

    const searchStatus = toolbar.locator('#directory-search-status');
    await search.fill('nothing-matches-this-fixture');
    await expect(searchStatus).toBeVisible();
    const statusBox = await searchStatus.boundingBox();
    expect(statusBox.width).toBeGreaterThanOrEqual(before.toolbar.width - 2);
    await expect(toolbar.locator('[data-directory-search-clear]')).toBeVisible();
    await toolbar.locator('[data-directory-search-clear]').click();
    await expect(searchStatus).toBeHidden();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"] [data-open-directory-profile]`).click();
  await expect(toolbar).toBeHidden();
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(toolbar).toBeVisible();
  expect(liveWrites).toEqual([]);
});
