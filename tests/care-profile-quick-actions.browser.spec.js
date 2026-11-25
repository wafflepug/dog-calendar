const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('streamlined profile places records, belongings and destructive actions together', async ({page, baseURL}) => {
  const booking = bookings[0];
  const fixture = await install(page, {
    profileOverrides: { [booking.stayId]: { approvedTreats: 'Plain chicken only', walkingEquipment: 'Blue harness', insuranceNumber: '00AB-42' } }
  });
  await page.goto(`${baseURL}/directory.html`);
  const card = page.locator(`#directory-grid [data-directory-stay-id="${booking.stayId}"]`);
  await expect(card.locator('.directory-guest-tile-open [data-care-photo-status="arrival"]')).toHaveCSS('background-color', 'rgb(21, 128, 61)');
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state', 'fresh');
  await expect(card.getByRole('heading', { name: 'Pet Notes' })).toBeVisible();
  await expect(card.getByText('More actions', {exact: true})).toHaveCount(0);
  const essentials = card.getByRole('region', { name: 'Care essentials' });
  await expect(essentials.getByRole('heading', { name: 'Safety', exact: true })).toHaveCount(0);
  await expect(essentials.locator('[data-care-brief-safety]')).toBeHidden();
  await expect(essentials.getByRole('button', { name: 'Emergency details' })).toBeVisible();
  await expect(card.locator('[data-profile-subtab="safety"]')).toBeVisible();
  const arrivalBadge = card.locator('.directory-card-header [data-care-photo-status="arrival"]');
  await expect(arrivalBadge).toHaveAccessibleName('Arriving today');
  await expect(arrivalBadge.locator('[data-palz-icon="checkin"]')).toBeVisible();
  await expect(card.locator('.directory-card-header .directory-status-tag')).toBeHidden();
  const handover = card.locator('[data-sitter-handover]');
  await expect(handover.locator('input[type="time"]')).toHaveCount(2);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({width, height: 848});
    const emergency = await essentials.getByRole('button', {name:'Emergency details'}).boundingBox();
    expect(emergency.x).toBeGreaterThanOrEqual(0);
    expect(emergency.x + emergency.width).toBeLessThanOrEqual(width);
    const centreOffset = await handover.evaluate(section => {
      const outer = section.getBoundingClientRect();
      const fields = section.querySelector('.sitter-planning-grid').getBoundingClientRect();
      return Math.abs((outer.left + outer.right - fields.left - fields.right) / 2);
    });
    expect(centreOffset).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({width: 390, height: 848});
  expect(fixture.reads).not.toContain('get_dog_history');
  expect(fixture.reads).not.toContain('get_dog_master_profile');

  await card.getByRole('button', {name: 'Records', exact: true}).click();
  const records = card.locator('.directory-care-records-disclosure');
  const bookingTools = card.locator('.p4-directory-actions');
  await expect(bookingTools).toHaveAttribute('data-care-profile-segment', 'records');
  await expect(records.locator('[data-directory-care]')).toBeHidden();
  await expect(card.getByRole('button', {name: 'Refresh records', exact: true})).toHaveCount(0);
  await expect(records.locator('[data-directory-legacy] + [data-care-dog-records]')).toBeVisible();
  await expect(records.getByRole('heading', {name: 'Dog record & stay history'})).toBeVisible();
  await expect.poll(() => fixture.reads.includes('get_dog_history') && fixture.reads.includes('get_dog_master_profile')).toBe(true);
  await expect(records.locator('[data-care-dog-records] [data-v108-history]')).toBeVisible();
  await expect(records.locator('[data-care-dog-records] [data-v110-master-host]')).toBeVisible();

  const belongings = card.getByRole('button', {name: 'Belongings', exact: true});
  await belongings.click();
  await expect(card.locator('[data-directory-main-panel="belongings"]')).toBeVisible();
  await expect(card.getByText('Blue lead and fitted harness')).toBeVisible();
  await expect(card.locator('.belongings-photo-gallery')).toBeVisible();
  await expect(records).toBeHidden();
  await expect(bookingTools).toBeHidden();

  const pdf = card.getByRole('button', {name: 'View intake PDF'});
  const remove = card.getByRole('button', {name: 'Remove Stay', exact: true});
  await expect(pdf).toBeVisible();
  await expect(remove).toBeVisible();
  await expect(card.locator('[data-care-header-intake-pdf] + [data-care-header-remove-stay]')).toHaveCount(1);
  await page.evaluate(() => { window.confirm = () => { throw Error('First press must not confirm'); }; });
  await remove.click();
  const armed = card.getByRole('button', {name: 'Delete Confirmed Stay', exact: true});
  await expect(armed).toBeVisible();
  await page.evaluate(() => { window.__testDeleteConfirmations = 0; window.confirm = () => { window.__testDeleteConfirmations++; return false; }; });
  await armed.click();
  expect(await page.evaluate(() => window.__testDeleteConfirmations)).toBe(1);
  await expect(remove).toBeVisible();
  expect(fixture.reads).not.toContain('delete_confirmed_stay');

  await card.getByRole('button', {name: 'Overview', exact: true}).click();
  await card.getByRole('button', {name: /Food & Walks/}).click();
  await expect(card.locator('[data-intake-read-attribute="approvedTreats"]')).toContainText('Plain chicken only');
  await expect(card.locator('[data-intake-read-attribute="walkingEquipment"]')).toContainText('Blue harness');
  await card.getByRole('button', {name: /Health & Home/}).click();
  await expect(card.locator('[data-intake-read-attribute="insuranceNumber"]')).toBeVisible();
  await expect(card.locator('[data-intake-read-attribute="insuranceNumber"]')).toContainText('00AB-42');

  await page.locator('#directoryBackToGuestsBtn').click();
  const departure = page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  const rosterDepartureBadge = departure.locator('.directory-guest-tile-open [data-care-photo-status="departure"]');
  await expect(rosterDepartureBadge).toHaveAccessibleName('Check-out today');
  await expect(rosterDepartureBadge).toHaveAttribute('data-tone', 'urgent');
  await expect(rosterDepartureBadge).toHaveCSS('background-color', 'rgb(220, 38, 38)');
  await departure.locator('[data-open-directory-profile]').click();
  const departureBadge = departure.locator('.directory-card-header [data-care-photo-status="departure"]');
  await expect(departureBadge).toHaveAccessibleName('Check-out today');
  await expect(departureBadge.locator('[data-palz-icon="luggage"]')).toBeVisible();
  const cornerOffsets = await departureBadge.evaluate(badge => {
    const picture = badge.parentElement.querySelector('.directory-photo-shell').getBoundingClientRect();
    const position = badge.getBoundingClientRect();
    return [Math.abs(picture.right - position.right), Math.abs(picture.top - position.top)];
  });
  expect(Math.max(...cornerOffsets)).toBeLessThanOrEqual(4);
});

test('mobile Notifications opens from the top bar and stays out of the side menu', async ({page, baseURL}) => {
  await install(page);
  await page.goto(`${baseURL}/directory.html`);
  const menu = page.locator('#wh75MenuButton');
  const drawer = page.locator('#wh75MobileDrawer');
  await menu.click();
  await expect(drawer.getByRole('button', {name:'Search', exact:true})).toBeVisible();
  await expect(drawer.getByRole('button', {name:'Notifications', exact:true, includeHidden:true})).toHaveCount(0);
  await expect(drawer.locator('[data-wh-sitter-sync-review]')).toHaveCount(1);
  await drawer.locator('[data-wh75-close-drawer]').first().click();

  const bell = page.locator('#wh75MobileTopbar').getByRole('button', {name:'Notifications', exact:true});
  const notifications = page.locator('#waffleNotificationModal');
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(notifications).toBeVisible();
  await bell.click();
  await expect(notifications).toBeHidden();
});

test('desktop notification dot sits on the bell corner', async ({page, baseURL}) => {
  await page.setViewportSize({width: 1280, height: 800});
  await install(page);
  await page.goto(`${baseURL}/directory.html`);
  const bell = page.locator('#whSitterDesktopTools #waffleNotificationButton');
  const search = page.locator('#whSitterDesktopTools [data-v1118-search-open]');
  await expect(bell).toBeVisible();
  await expect(search).toBeVisible();
  for (const [button, glyph, labelSelector] of [
    [bell, 'bell', '.waffle-notification-button-label'],
    [search, 'search', '.v1118-search-button-label']
  ]) {
    await button.evaluate((node, name) => {
      node.insertAdjacentHTML('beforeend', window.PALZ_ICONS.svg(name));
    }, glyph);
    await expect(button.locator(`:scope > [data-palz-icon="${glyph}"]`)).toBeHidden();
    await expect(button.locator(`:scope > span:first-child > [data-palz-icon="${glyph}"]`)).toBeVisible();
    const alignment = await button.evaluate((node, selector) => {
      const icon = node.firstElementChild.getBoundingClientRect();
      const label = node.querySelector(selector).getBoundingClientRect();
      return Math.abs((icon.top + icon.bottom - label.top - label.bottom) / 2);
    }, labelSelector);
    expect(alignment).toBeLessThanOrEqual(1);
  }
  const geometry = await bell.evaluate(button => {
    const icon = button.querySelector('.waffle-notification-button-icon').getBoundingClientRect();
    const dot = button.querySelector('[data-notification-unread-badge]');
    dot.hidden = false;
    const bounds = dot.getBoundingClientRect();
    return { top: Math.abs(bounds.top - icon.top), right: Math.abs(bounds.right - icon.right), width: bounds.width };
  });
  expect(geometry.top).toBeLessThanOrEqual(5);
  expect(geometry.right).toBeLessThanOrEqual(5);
  expect(geometry.width).toBeGreaterThan(0);
});

test('touch handover picker keeps Set in view and changes only the draft until saved', async ({browser, baseURL}) => {
  const page = await browser.newPage({hasTouch:true,viewport:{width:320,height:560}});
  try {
    await install(page);
    await page.goto(`${baseURL}/directory.html`);
    const card = page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
    await card.locator('[data-open-directory-profile]').click();
    const handover = card.locator('[data-sitter-handover]');
    const input = handover.locator('[name="pickupTime"]');
    await expect(input).toBeHidden();
    const edit = handover.getByRole('button',{name:'Pick-up time: 3:00 PM'});
    await edit.click();
    const picker = page.getByRole('dialog',{name:'Pick-up time'});
    await page.setViewportSize({width:320,height:300});
    const set = picker.getByRole('button',{name:'Set',exact:true});
    const bounds = await set.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(300);
    await picker.getByLabel('Hour').selectOption('4');
    await picker.getByRole('button',{name:'Cancel'}).click();
    await expect(input).toHaveValue('15:00');
    await expect(edit).toBeFocused();
    await edit.click();
    await picker.getByLabel('Hour').selectOption('4');
    await picker.getByLabel('Minute').selectOption('35');
    await set.click();
    await expect(input).toHaveValue('16:35');
    await expect(handover.getByRole('button',{name:'Save times'})).toBeVisible();
    await handover.getByRole('button',{name:'Pick-up time: 4:35 PM'}).click();
    await picker.getByRole('button',{name:'Clear'}).click();
    await expect(input).toHaveValue('');
  } finally { await page.close(); }
});

test('compact profile aligns identity above actions and keeps stay confirmations visible on short screens', async ({page,baseURL}) => {
  await page.setViewportSize({width:320,height:700});
  const fixture = await install(page);
  await page.addInitScript(() => {
    localStorage.setItem('waffleColourStyle', 'custom');
    localStorage.setItem('waffleCustomAccent', '#ffffff');
  });
  await page.goto(`${baseURL}/directory.html`);
  const selectedFilter = page.locator('.directory-roster-filters .v1082-stay-tab.is-active');
  await expect(selectedFilter).toBeVisible();
  const expectAccentStyle = async (control, surface = '--wh75-accent-soft') => {
    const palette = await control.evaluate((node, token) => {
      const sample = document.createElement('span');
      sample.style.backgroundColor = `var(${token})`;
      sample.style.color = 'var(--wh75-accent-ink)';
      node.append(sample);
      const style = getComputedStyle(sample);
      const colours = { background: style.backgroundColor, text: style.color };
      sample.remove();
      return colours;
    }, surface);
    await expect(control).toHaveCSS('background-color', palette.background);
    await expect(control).toHaveCSS('color', palette.text);
    return palette.background;
  };
  await expectAccentStyle(selectedFilter);
  await expectAccentStyle(selectedFilter.locator(':scope > :is(strong, .v1086-stay-tab-count)'), '--wh75-shell');
  const rosterCard = page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await expectAccentStyle(rosterCard.locator('[data-v11113-roster-extend]'));
  await rosterCard.getByRole('button', {name:'Set check-out time'}).click();
  const estimate = page.locator('[data-roster-checkout-dialog]');
  await expectAccentStyle(estimate.getByRole('button', {name:'Save time'}));
  await estimate.getByRole('button', {name:'Cancel'}).click();
  const card = page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('.directory-card-header .directory-photo-shell')).toHaveCSS('width','64px');
  await expect(card.locator('.directory-card-header .directory-profile-name-line .directory-dog-name-btn')).toHaveText('Milo');
  await expect(card.locator('.directory-card-header [data-care-photo-status="arrival"]')).toHaveAccessibleName('Arriving today');
  await expect(card.locator('.directory-card-header [data-care-header-tools]')).toHaveCSS('grid-row-start','2');
  await expect(card.locator('.directory-profile-stay-dates')).toContainText('Check-out');
  await page.evaluate(record => {
    v110MergeOperationRead([record]);
    v110EnsureCareOperationBar(document.querySelector('.directory-card.is-profile-active'));
  }, fixture.recordCheckIn(bookings[0]).record);

  const selectedTab = card.locator('.care-profile-segment-button[aria-pressed="true"]');
  const extendButton = card.getByRole('button',{name:'Extend stay',exact:true});
  const earlyButton = card.getByRole('button',{name:/early checkout for/i});
  for (const [width, dark] of [[320, false], [1280, true]]) {
    await page.setViewportSize({width,height:700});
    await page.evaluate(enabled => document.body.classList.toggle('dark-theme', enabled), dark);
    await expectAccentStyle(selectedTab);
    const accentSurface = await expectAccentStyle(extendButton);
    await expect(earlyButton).not.toHaveCSS('background-color', accentSurface);
  }
  await page.setViewportSize({width:320,height:700});

  const stays = page.locator('#v11113StayDatesModal');
  const checkout = page.locator('#v11217EarlyCheckoutModal');
  for (const [open, panel, confirm] of [
    [extendButton, stays, 'Extend stay'],
    [earlyButton, checkout, 'Confirm early check-out']
  ]) {
    await open.click();
    await page.setViewportSize({width:320,height:275});
    const cancel = panel.getByRole('button',{name:'Cancel',exact:true});
    const action = panel.getByRole('button',{name:confirm,exact:true});
    await expect(cancel).toBeInViewport({ratio:1});
    await expect(action).toBeInViewport({ratio:1});
    if (panel === stays) await expectAccentStyle(action);
    const [cancelBox, actionBox] = await Promise.all([cancel.boundingBox(), action.boundingBox()]);
    expect(cancelBox.width).toBeCloseTo(actionBox.width,0);
    expect(actionBox.height).toBeGreaterThanOrEqual(44);
    await cancel.click();
    await expect(panel).toBeHidden();
    await page.setViewportSize({width:320,height:700});
  }
});

test('profile intake link copies only for the selected stay and opens preparation when needed', async ({page, baseURL}) => {
  await page.setViewportSize({width: 320, height: 740});
  await install(page);
  await page.goto(`${baseURL}/directory.html`);
  const booking = bookings[0];
  const card = page.locator(`#directory-grid [data-directory-stay-id="${booking.stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  const tools = card.locator('[data-care-header-tools]');
  const shortcut = tools.getByRole('button', {name: 'Copy intake link', exact: true});
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveCSS('border-radius', '50%');
  await expect(shortcut.locator('[data-palz-icon="link"]')).toBeVisible();
  await expect(card.locator('[data-care-intake-received]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  const link = 'https://care.example.test/palz-intake.html#token=prepared-fixture';
  await page.evaluate(detail => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', {detail})), {...booking, link});
  await shortcut.click();
  await expect(tools.getByRole('status').filter({hasText: 'Intake link copied.'})).toBeVisible();
  expect(await page.evaluate(() => window.__copied)).toEqual([link]);

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: {writeText: async () => { throw Error('blocked'); }}
  }));
  await shortcut.click();
  const fallback = tools.getByRole('textbox', {name: 'Owner care link for manual copying'});
  await expect(fallback).toHaveValue(link);
  await expect(fallback).toBeInViewport();
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(fallback).toHaveCount(0);

  await page.setViewportSize({width: 1280, height: 800});
  const other = page.locator(`#directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`);
  await other.locator('[data-open-directory-profile]').click();
  const otherShortcut = other.locator('[data-care-header-tools]').getByRole('button', {name: 'Copy intake link', exact: true});
  await otherShortcut.click();
  await expect(page.locator('#p4Modal')).toBeVisible();
  await expect(page.locator('#p4OwnerDog')).toHaveValue(bookings[1].dogName);
  await expect(page.locator('#p4OwnerEnd')).toHaveValue(bookings[1].endDate);
  await page.locator('#p4Modal [data-p4-close]').click();
  await expect(otherShortcut).toBeFocused();
  expect(await page.evaluate(() => window.__copied)).toEqual([link]);
});

test('checking in hides Drop-off and a Pick-up edit preserves the saved Drop-off time', async ({page, baseURL}) => {
  const fixture = await install(page);
  await page.goto(`${baseURL}/directory.html`);
  const card = page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  const handover = card.locator('[data-sitter-handover]');
  const dropoff = handover.locator('[name="dropoffTime"]');
  const pickup = handover.locator('[name="pickupTime"]');
  await expect(dropoff).toBeVisible();
  await expect(pickup).toHaveValue('15:00');
  await page.evaluate(record => {
    v110MergeOperationRead([record]);
    v110EnsureCareOperationBar(document.querySelector('.directory-card.is-profile-active'));
    const send = window.sendPayloadToAppsScript;
    window.sendPayloadToAppsScript = async payload => {
      if (payload.action !== 'save_sitter_handover') return send(payload);
      window.__savedHandover = payload;
      return {result:'success',record:{...payload,times:{dropoffTime:payload.dropoffTime,pickupTime:payload.pickupTime}}};
    };
  }, fixture.recordCheckIn(bookings[0]).record);
  await expect(dropoff).toBeHidden();
  await expect(pickup).toBeEnabled();
  await pickup.fill('16:30');
  await handover.getByRole('button', {name:'Save times'}).click();
  await expect(handover.getByRole('status')).toHaveText('Times saved.');
  expect(await page.evaluate(() => window.__savedHandover)).toMatchObject({dropoffTime:'09:00',pickupTime:'16:30'});
});

test('Detailed Care opens in a viewport-sized modal and Escape returns to the Edit button', async ({page, baseURL}) => {
  await page.setViewportSize({width:320, height:620});
  await install(page);
  await page.goto(`${baseURL}/directory.html`);
  const card = page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state', 'fresh');
  const edit = card.getByRole('button', {name:'Edit detailed care for Milo'});
  await edit.click();
  const modal = page.getByRole('dialog', {name:'Edit detailed care for Milo'});
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', {name:/Food & Walks/})).toBeVisible();
  await expect(modal.getByRole('button', {name:'Save changes'})).toBeDisabled();
  const bounds = await modal.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(620);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(edit).toBeFocused();
});

test('Care quick actions stay compact, truthful and bound to the selected stay',async({page,baseURL},info)=>{
  const fixture=await install(page);
  const profileReads=[];
  page.on('request',request=>{
    if(!request.url().includes('script.google'))return;
    try{
      const params=new URL(request.url()).searchParams;
      const payload=JSON.parse(params.get('payload')||'{}');
      const action=params.get('action')||payload.action;
      if(['get_guest_profile','get_guest_belongings','get_belongings'].includes(action))profileReads.push({...Object.fromEntries(params),...payload,action});
    }catch{}
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?careQuickActionsFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_INTAKE_STATUS);

  const first=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await first.locator('[data-open-directory-profile]').click();
  await expect(first).toHaveClass(/is-profile-active/);
  await expect(first.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  const readsAfterProfile=profileReads.length;
  const freshness=first.locator('[data-care-brief-freshness]');
  await expect(freshness.locator('[data-care-brief-freshness-summary]')).toContainText('Saved ·');
  await expect(freshness.locator('[data-care-brief-freshness-full]')).toContainText('Saved record · updated');
  await expect(freshness).toHaveAttribute('data-state','fresh');
  const details=freshness.locator('.directory-care-freshness-details');
  await expect(details).not.toHaveAttribute('open','');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  await expect(details.locator('small')).toContainText('does not confirm care instructions were reviewed');
  expect(await details.locator('summary').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await details.locator('summary').focus();
  const hostBefore=await freshness.evaluate(node=>({summary:node.querySelector('[data-care-brief-freshness-summary]').textContent,full:node.querySelector('[data-care-brief-freshness-full]').textContent,details:node.querySelector('.directory-care-freshness-details').open}));
  await page.evaluate(()=>window.WAFFLE_INTAKE_STATUS.refresh(document.querySelector('.directory-card.is-profile-active')));
  expect(await freshness.evaluate(node=>({summary:node.querySelector('[data-care-brief-freshness-summary]').textContent,full:node.querySelector('[data-care-brief-freshness-full]').textContent,details:node.querySelector('.directory-care-freshness-details').open}))).toEqual(hostBefore);
  await expect(details.locator('summary')).toBeFocused();

  const photoTools=first.locator('.directory-care-photo-tools');
  const more=first.locator('.directory-care-more-actions');
  await expect(photoTools).toHaveCount(1);
  await expect(more.locator(':scope > summary')).toHaveCount(0);
  await expect(more.locator('.directory-care-more-actions-list')).toBeVisible();
  await expect(photoTools.locator('strong')).toHaveCount(0);
  await expect(first.locator('.directory-photo-shell [data-upload-dog-photo], .directory-photo-shell [data-v108-gallery]')).toHaveCount(0);
  await expect(photoTools.locator('[data-upload-dog-photo]')).toBeVisible();
  await expect(photoTools.locator('[data-v108-gallery]')).toBeVisible();
  expect(await photoTools.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  expect(await photoTools.locator('button').evaluateAll(buttons=>buttons.every(button=>button.getBoundingClientRect().height>=44))).toBe(true);
  expect(profileReads.length).toBe(readsAfterProfile);
  await page.evaluate(()=>{
    window.__quickPhotoWrites=[];
    window.sendPayloadToAppsScript=async payload=>{window.__quickPhotoWrites.push({...payload});return {result:'success'};};
  });
  await photoTools.locator('[data-upload-dog-photo]').click();
  const uploader=page.locator('#hostedBelongingsPhotoUploaderModal');
  await expect(uploader).toBeVisible();
  await expect(page.locator('#hostedBelongingsPhotoUploaderTitle')).toContainText('Position Dog Photo');
  expect(await page.evaluate(()=>window.__quickPhotoWrites)).toEqual([]);
  await expect.poll(async()=>new URL(await page.locator('#hostedBelongingsPhotoUploaderFrame').getAttribute('src')).searchParams.get('dogName')).toBe(bookings[0].dogName);
  await expect.poll(async()=>new URL(await page.locator('#hostedBelongingsPhotoUploaderFrame').getAttribute('src')).searchParams.get('photoType')).toBe('dogProfile');
  const photoEditorUrl=new URL(await page.locator('#hostedBelongingsPhotoUploaderFrame').getAttribute('src'));
  expect(photoEditorUrl.searchParams.get('editProfilePhoto')).toBe('true');
  expect(photoEditorUrl.searchParams.get('dogId')).toBe(bookings[0].dogId);
  expect(photoEditorUrl.searchParams.get('stayId')).toBe(bookings[0].stayId);
  await page.locator('#closeHostedBelongingsPhotoUploader').click();
  expect(await page.evaluate(()=>window.__quickPhotoWrites)).toEqual([]);
  await expect(first.locator('[data-v1089-upload-loading]')).toBeHidden();
  const galleryReadsBefore=fixture.reads.filter(action=>action==='get_guest_profile').length;
  await photoTools.locator('[data-v108-gallery]').click();
  await expect(page.locator('#v108GalleryModal')).toBeVisible();
  await expect(page.locator('[data-v108-gallery-title]')).toHaveText('🐶 Milo Photos');
  await expect.poll(()=>fixture.reads.filter(action=>action==='get_guest_profile').length).toBe(galleryReadsBefore+1);
  expect(profileReads.filter(row=>row.action==='get_guest_profile').at(-1)?.stayId).toBe(bookings[0].stayId);
  await page.locator('#v108GalleryModal [data-v108-close]').click();

  const ownerGroup=first.locator('.directory-care-brief-actions > [data-care-owner-link-group]');
  await expect(ownerGroup.locator('[data-p4-dir="owner"]')).toBeVisible();
  await expect(ownerGroup.locator('[data-compact-intake-status]')).toHaveText('Form received');
  await expect(first.locator('.directory-care-brief-actions > .directory-care-more-actions [data-p4-dir="owner"]')).toHaveCount(0);
  await details.locator('summary').click();
  const readCountBeforeLayout=fixture.reads.filter(action=>['get_guest_profile','get_guest_belongings','get_belongings'].includes(action)).length;
  for(const width of [320,390,1440])for(const dark of [false,true]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await ownerGroup.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    expect(await ownerGroup.locator('[data-p4-dir="owner"]').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    if(process.env.WAFFLE_CAPTURE_UI_EVIDENCE==='1'&&info.project.name==='chromium'&&width!==390){
      const dir=path.resolve(__dirname,'../output/releases/2026.10.23.04/evidence');fs.mkdirSync(dir,{recursive:true});
      await page.locator('#directoryBackToGuestsBtn').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(dir,`quick-profile-${width}-${dark?'dark':'light'}.png`)});
      await ownerGroup.screenshot({path:path.join(dir,`owner-status-${width}-${dark?'dark':'light'}.png`)});
      await photoTools.screenshot({path:path.join(dir,`photo-tools-${width}-${dark?'dark':'light'}.png`)});
    }
  }
  await page.setViewportSize({width:320,height:844});
  await ownerGroup.evaluate(node=>node.querySelectorAll('button, [data-compact-intake-status]').forEach(el=>el.style.fontSize=`${parseFloat(getComputedStyle(el).fontSize)*2}px`));
  expect(await ownerGroup.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_guest_belongings','get_belongings'].includes(action))).toHaveLength(readCountBeforeLayout);
  await ownerGroup.locator('[data-p4-dir="owner"]').click();
  await expect(page.locator('#p4Modal')).toBeVisible();
  await expect(page.locator('#p4OwnerDog')).toHaveValue(bookings[0].dogName);
  await expect(page.locator('#p4OwnerStart')).toHaveValue(bookings[0].startDate);
  await page.locator('#p4Modal [data-p4-close]').click();

  const guestProfileReadsBeforeOtherCards=fixture.reads.filter(action=>action==='get_guest_profile').length;
  await page.locator('#directoryBackToGuestsBtn').click();
  const second=page.locator(`#directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`);
  await second.locator('[data-open-directory-profile]').click();
  await expect(second.locator('[data-compact-intake-status]')).toHaveText('Not prepared');
  await expect(second.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await page.evaluate(({dogName,startDate,endDate,dogId,stayId})=>window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready',{detail:{dogName,startDate,endDate,dogId,stayId,link:'https://care.example.test/prepared-fixture'}})),{dogName:bookings[1].dogName,startDate:bookings[1].startDate,endDate:bookings[1].endDate,dogId:bookings[1].dogId,stayId:bookings[1].stayId});
  await expect(second.locator('[data-compact-intake-status]')).toHaveText('Link ready');
  await expect(first.locator('[data-compact-intake-status]')).toHaveText('Form received');
  await page.locator('#directoryBackToGuestsBtn').click();
  const third=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await third.locator('[data-open-directory-profile]').click();
  await expect(third.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await third.locator('[data-directory-intake]').evaluate(node=>{node.setAttribute('aria-busy','false');node.innerHTML='<div class="directory-record-error">Digital intake unavailable</div>';});
  await expect(third.locator('[data-compact-intake-status]')).toHaveText('Status unknown');
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(guestProfileReadsBeforeOtherCards+2);
});

// Exercise the production renderer's freshness block against its real state helper.
test('compact freshness preserves every source state, exact details and stable disclosure DOM',async({page})=>{
  const source=fs.readFileSync(path.join(__dirname,'../waffle-app.js'),'utf8');
  const getter=source.slice(source.indexOf('    function getDirectoryCareBriefFreshness('),source.indexOf('    function mergeDirectoryCareRecordWithServerTimestamp('));
  const setters=source.slice(source.indexOf('    const directorySummaryHtmlState ='),source.indexOf('    function renderDirectoryCareBrief('));
  const renderStart=source.indexOf('    function renderDirectoryCareBrief(');
  const block=source.slice(source.indexOf('        if (freshnessHost) {',renderStart),source.indexOf('        if (callActionHost) {',renderStart));
  expect(block).toContain('compactFreshness');
  await page.setContent('<article><div data-directory-detail="profile"><span data-directory-profile-read-status></span></div><div data-care-brief-freshness><details><summary><span data-care-brief-freshness-summary></span></summary><span data-care-brief-freshness-detail></span></details></div></article>');
  await page.addScriptTag({content:getter+setters+`window.renderFreshnessFixture = ({record,readState='fresh',missing=false,conflict=false,offline=false,failed=false}) => {
    const card=document.querySelector('article'),freshnessHost=card.querySelector('[data-care-brief-freshness]');
    const validatedProfileRecord=record,profileReadState=readState,missingProfile=missing,profileIdentityNeedsReview=conflict;
    const feedingHost=null,medicationHost=null;
    const status=card.querySelector('[data-directory-profile-read-status]');
    status.dataset.freshnessOffline=String(offline);status.dataset.freshnessRefreshFailed=String(failed);
    const markDirectoryProfileIdentityConflict=()=>{};
    ${block}
  };`});
  const year=new Date().getFullYear();
  const saved={updatedAt:`${year-1}-01-03T10:15:00Z`};
  const cases=[
    [{record:saved},'fresh','Saved ·','Saved record · updated'],
    [{record:{}},'saved','Saved · time unknown','update time unknown'],
    [{record:{updatedAt:'invalid'}},'saved','Saved · time unknown','update time unknown'],
    [{record:{updatedAt:'2999-01-01'}},'saved','Saved · time unknown','update time unknown'],
    [{record:saved,offline:true},'offline','Offline · saved care','Offline · saved record'],
    [{record:saved,offline:true,failed:true},'offline','Offline · saved care','refresh unavailable'],
    [{record:saved,readState:'refreshing'},'refreshing','Refreshing saved care','Refreshing · saved record'],
    [{record:null,readState:'loading'},'loading','Loading care record','Loading care record'],
    [{record:saved,failed:true},'error','Refresh failed · saved care','Refresh failed · saved record'],
    [{record:null,readState:'error'},'error','Care record unavailable','could not be loaded'],
    [{record:null,missing:true},'missing','No saved care record','No saved care record'],
    [{record:saved,readState:'identity-conflict'},'unresolved','Care record identity needs review','identity needs review'],
    [{record:saved,conflict:true},'identity-conflict','review the care record identity','Shared name and dates']
  ];
  const host=page.locator('[data-care-brief-freshness]');
  for(const [input,state,summary,full] of cases){
    await page.evaluate(input=>window.renderFreshnessFixture(input),input);
    await expect(host).toHaveAttribute('data-state',state);
    await expect(host.locator('summary')).toContainText(summary);
    await expect(host.locator('[data-care-brief-freshness-detail]')).toContainText(full);
  }
  await page.evaluate(input=>window.renderFreshnessFixture(input),{record:saved});
  await expect(host.locator('summary')).toContainText(String(year-1));
  await host.locator('summary').click();await host.locator('summary').focus();
  const unchanged=await page.evaluate(input=>{
    const host=document.querySelector('[data-care-brief-freshness]'),details=host.querySelector('details');
    const observer=new MutationObserver(()=>{});observer.observe(host,{subtree:true,attributes:true,childList:true,characterData:true});
    window.renderFreshnessFixture(input);
    const count=observer.takeRecords().length;observer.disconnect();
    return {count,same:details===host.querySelector('details'),open:details.open,focused:document.activeElement===details.querySelector('summary')};
  },{record:saved});
  expect(unchanged).toEqual({count:0,same:true,open:true,focused:true});
});
