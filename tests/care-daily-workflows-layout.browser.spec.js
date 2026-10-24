const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('the complete Care runtime combines filters, truthful setup and optional verified departure sharing',async({page,baseURL},testInfo)=>{
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  const fixture=await install(page);
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS&&window.WAFFLE_DEPARTURE_MESSAGE);
  const grid=page.locator('#directory-grid');
  await expect(grid.locator('.directory-card')).toHaveCount(3);
  const focus=page.locator('[data-care-roster-focus]');
  await expect(focus).not.toHaveAttribute('open','');
  await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="arriving"]').click();
  await expect(grid.locator('.directory-card:visible')).toHaveCount(2);
  await page.locator('#guestDirectorySearch').fill('#00017');
  await expect(grid.locator('.directory-card:visible')).toHaveCount(1);
  const first=grid.locator(`[data-directory-stay-id="${bookings[0].stayId}"]`);
  await first.locator('[data-open-directory-profile]').click();
  await expect(first).toHaveClass(/is-profile-active/);
  await expect(focus).toBeHidden();
  await expect(first.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await expect(first.locator('[data-compact-intake-status]')).toHaveText('Form received');
  await expect(first.locator('[data-v1118-care-signals]')).not.toContainText('Intake missing');
  const setup=first.locator('.directory-care-readiness');
  await expect(setup.locator('[data-care-readiness-summary]')).toHaveText('Details');
  await expect(setup.locator('[data-care-readiness-summary]')).toHaveAttribute('data-state','neutral');
  await expect(setup).not.toHaveAttribute('open','');
  const out=path.join(__dirname,'..','output','releases','2026.10.18.03');
  if(['chromium-390','chromium-1440'].includes(testInfo.project.name)){
    fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,`care-setup-${testInfo.project.name}.png`),fullPage:false});
  }
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(focus).toBeVisible();
  await expect(focus.locator('[data-focus-mode="arriving"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#guestDirectorySearch')).toHaveValue('#00017');
  await page.locator('#guestDirectorySearch').fill('');
  if(!await focus.evaluate(node=>node.open))await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="leaving"]').click();
  await expect(grid.locator('.directory-card:visible')).toHaveCount(2);
  await expect(page.locator('[data-directory-search-clear]')).toBeHidden();
  const fern=grid.locator(`[data-directory-stay-id="${bookings[2].stayId}"]`);
  await expect(fern.locator('[data-v11217-roster-checkout]')).toBeVisible();
  const readsBefore=fixture.reads.filter(action=>action==='get_guest_profile').length;
  await page.evaluate(()=>{
    window.__syntheticWrites=[];
    window.sendPayloadToAppsScript=async payload=>{
      window.__syntheticWrites.push({...payload});
      return {result:'success',record:{...payload,status:'checked_out',updatedAt:'2026-10-18T02:00:00Z',checkedOutAt:'2026-10-18T02:00:00Z'}};
    };
  });
  await fern.locator('[data-v11217-roster-checkout]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeVisible();
  await page.locator('[data-v11217-guided-confirm]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  await expect(page.locator(`#past-directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`)).toHaveCount(1);
  await expect(focus.locator('[data-focus-count="leaving"]')).toHaveText('1');
  const banner=page.locator('#v11217DepartureMessageBanner');
  await expect(banner).toBeVisible();
  const disclosure=banner.locator('[data-v11217-departure-disclosure]');
  await expect(disclosure).not.toHaveAttribute('open','');
  await disclosure.locator('summary').click();
  await expect(banner.locator('textarea')).toHaveValue(/Fern checked out on 18 Oct 2026/);
  await banner.locator('[data-v11217-departure-copy]').click();
  const copied=await page.evaluate(()=>window.__copied);
  expect(copied).toHaveLength(1);
  expect(copied[0]).not.toMatch(/https?:|Private care|0400000000/);
  expect(await page.evaluate(()=>window.__syntheticWrites.map(p=>[p.action,p.stayId]))).toEqual([['checkout_stay',bookings[2].stayId]]);
  expect(fixture.reads.filter(action=>action==='get_guest_profile').length).toBe(readsBefore);
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('#v11217DepartureMessageBanner button, .care-roster-focus button')].filter(el=>el.getClientRects().length).map(el=>({height:el.getBoundingClientRect().height,right:el.getBoundingClientRect().right})),noteFont:parseFloat(getComputedStyle(document.querySelector('#v11217DepartureMessageBanner textarea')).fontSize)}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  expect(geometry.buttons.every(b=>b.height>=44&&b.right<=geometry.width)).toBe(true);
  expect(geometry.noteFont).toBeGreaterThanOrEqual(16);
  expect(runtimeErrors).toEqual([]);
  if(['chromium-390','chromium-1440'].includes(testInfo.project.name))await page.screenshot({path:path.join(out,`care-departure-${testInfo.project.name}.png`),fullPage:false});
});

test('checkout reviews exact Fern care in place and clears the note on explicit cancel',async({page,baseURL},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  const runtimeErrors=[];
  const writeRequests=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  page.on('request',request=>{
    if(request.url().includes('script.google.com')&&!['GET','HEAD'].includes(request.method()))writeRequests.push(request.method());
  });
  const fixture=await install(page,{holdProfileRead:true,fernMedication:'Give the saved tablet with dinner.'});
  await page.goto(`${baseURL}/directory.html?checkoutCareBridgeFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const focus=page.locator('[data-care-roster-focus]');
  if(!await focus.evaluate(node=>node.open))await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="leaving"]').click();

  const fern=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  const checkout=fern.locator('[data-v11217-roster-checkout]');
  await expect(checkout).toBeVisible();
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(0);
  await checkout.click();
  const modal=page.locator('#v11217GuidedCheckout');
  const note=modal.locator('[data-v11217-guided-note]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-v11217-guided-dog]')).toHaveText('Fern');
  await expect(modal.locator('[data-v11217-guided-medication-unknown]')).toHaveText('Not available in this summary');
  await expect(modal.locator('[data-v11217-guided-review-care]')).toBeVisible();
  const handoverNote='Fern’s evening dose is in the blue pouch; Casey will collect at 5pm.';
  await note.fill(handoverNote);

  const screenshotDir=path.join(__dirname,'..','output','care-journey-runtime-rerun');
  fs.mkdirSync(screenshotDir,{recursive:true});
  await page.screenshot({path:path.join(screenshotDir,`${testInfo.project.name}-390-light-checkout-review.png`),fullPage:false});
  await page.locator('body').evaluate(node=>node.classList.add('dark-theme'));
  await page.screenshot({path:path.join(screenshotDir,`${testInfo.project.name}-390-dark-checkout-review.png`),fullPage:false});
  await page.locator('body').evaluate(node=>node.classList.remove('dark-theme'));

  await modal.locator('[data-v11217-guided-review-care]').click();
  await expect(modal.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  const latestHandoverNote='Update: the blue pouch is with Casey.';
  await note.fill(latestHandoverNote);
  fixture.releaseProfileRead();
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-v11217-guided-note]')).toHaveValue(latestHandoverNote);
  await expect(modal.locator('[data-v11217-guided-medication]')).toHaveText('Give the saved tablet with dinner.');
  await expect(modal.locator('[data-v11217-guided-belongings] li')).toHaveText(['Leads / harnesses · Present · Blue lead and fitted harness']);
  await expect(modal.locator('[data-v11217-guided-missing]')).toBeHidden();
  await expect(fern).not.toHaveClass(/is-profile-active/);
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(1);
  expect(fixture.reads.filter(action=>action==='get_guest_belongings')).toHaveLength(1);
  await expect(page.locator(`.directory-card.is-profile-active[data-directory-stay-id="${bookings[0].stayId}"]`)).toHaveCount(0);
  await expect(page.locator(`.directory-card.is-profile-active[data-directory-stay-id="${bookings[1].stayId}"]`)).toHaveCount(0);

  const reviewedShots=path.join(__dirname,'..','output','care-inline-checkout-review');
  fs.mkdirSync(reviewedShots,{recursive:true});
  for(const [width,height,theme,label] of [[320,844,'light','320-light'],[390,844,'dark','390-dark'],[1440,900,'light','1440-light']]){
    await page.setViewportSize({width,height});
    await page.locator('body').evaluate((node,dark)=>node.classList.toggle('dark-theme',dark),theme==='dark');
    await modal.locator('.v11217-modal-body').evaluate(body=>{body.scrollTop=0;});
    await page.screenshot({path:path.join(reviewedShots,`${label}.png`),fullPage:false});
  }

  await modal.locator('[data-v11217-guided-close]').last().click();
  await expect(modal).toBeHidden();
  await checkout.click();
  await expect(modal).toBeVisible();
  await expect(note).toHaveValue('');
  await modal.locator('[data-v11217-guided-close]').last().click();
  await expect(modal).toBeHidden();
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(1);
  expect(fixture.reads.filter(action=>action==='get_guest_belongings')).toHaveLength(1);
  expect(writeRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('canceling and reopening checkout clears its note without writes or legacy confirmation',async({page,baseURL})=>{
  await page.setViewportSize({width:390,height:844});
  const runtimeErrors=[];
  const writeRequests=[];
  const legacyDialogs=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  page.on('request',request=>{
    if(request.url().includes('script.google.com')&&!['GET','HEAD'].includes(request.method()))writeRequests.push(request.method());
  });
  page.on('dialog',async dialog=>{
    legacyDialogs.push({type:dialog.type(),message:dialog.message()});
    await dialog.dismiss();
  });
  const fixture=await install(page);
  await page.goto(`${baseURL}/directory.html?checkoutCareBridgeFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const focus=page.locator('[data-care-roster-focus]');
  if(!await focus.evaluate(node=>node.open))await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="leaving"]').click();
  const fern=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await expect(fern.locator('[data-v11217-roster-checkout]')).toBeVisible();
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(0);
  await fern.locator('[data-v11217-roster-checkout]').click();
  const modal=page.locator('#v11217GuidedCheckout');
  const note=modal.locator('[data-v11217-guided-note]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-v11217-guided-review-care]')).toBeVisible();
  const handoverNote='Fern’s evening dose is in the blue pouch; Casey will collect at 5pm.';
  await note.fill(handoverNote);
  await modal.locator('[data-v11217-guided-close]').last().click();
  await expect(modal).toBeHidden();
  await fern.locator('[data-v11217-roster-checkout]').click();
  await expect(modal).toBeVisible();
  await expect(note).toHaveValue('');
  expect(legacyDialogs).toEqual([]);
  expect(writeRequests).toEqual([]);

  await modal.locator('[data-v11217-guided-close]').last().click();
  await expect(modal).toBeHidden();
  expect(legacyDialogs).toEqual([]);
  expect(writeRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
