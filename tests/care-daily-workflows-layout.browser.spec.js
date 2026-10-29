const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('Care owner contact, filtered counts and verified check-in preserve the next arrival without profile reads',async({page,baseURL})=>{
  const fixture=await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,phone:'+61 (400) 123-456'}]});
  await page.goto(`${baseURL}/directory.html?ownerFlowFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const first=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  const second=page.locator(`#directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`);
  const more=first.locator('.v11217-roster-more-actions');
  await more.locator('summary').click();
  const call=more.locator('[data-v11217-roster-owner-call]');
  await expect(call).toHaveAttribute('href','tel:+61400123456');
  await expect(call).toContainText('Call owner');
  await expect(call).toHaveAccessibleName(/#00017/);
  expect(await call.evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await more.locator('summary').click();
  const focus=page.locator('[data-care-roster-focus]');
  await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="arriving"]').click();
  const search=page.locator('#guestDirectorySearch');
  await search.fill('#00017');
  await expect(focus.locator('summary')).toHaveText('Arriving today · 1 of 2');
  await expect(focus.locator('[data-focus-count="arriving"]')).toHaveText('2');
  await search.fill('not-a-match');
  await expect(focus.locator('summary')).toHaveText('Arriving today · 0 of 2');
  await search.fill('');
  await expect(focus.locator('summary')).toHaveText('Arriving today · 2');
  await page.exposeFunction('__recordCareCheckIn',payload=>fixture.recordCheckIn(payload));
  await page.evaluate(()=>{
    window.__careOwnerWrites=[];
    window.sendPayloadToAppsScript=async payload=>{window.__careOwnerWrites.push({...payload});return window.__recordCareCheckIn(payload);};
    document.body.style.minHeight='2400px';
  });
  const checkIn=first.locator('[data-v11217-roster-checkin]');
  await checkIn.evaluate(node=>node.focus({preventScroll:true}));
  await page.evaluate(()=>window.scrollTo(0,120));
  const beforeScroll=await page.evaluate(()=>window.scrollY);
  await page.keyboard.press('Enter');
  await expect(first).toBeHidden();
  await expect(second.locator('[data-v11217-roster-checkin]')).toBeFocused();
  expect(await page.evaluate(()=>window.scrollY)).toBe(beforeScroll);
  await expect(focus.locator('summary')).toHaveText('Arriving today · 1');
  const writes=await page.evaluate(()=>window.__careOwnerWrites);
  expect(writes).toHaveLength(1);expect(writes[0].action).toBe('checkin_stay');expect(writes[0].stayId).toBe(bookings[0].stayId);
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(0);
});

test('Care long handover previews and inline discard choices remain readable above the phone footer',async({page,baseURL},testInfo)=>{
  const longNote='<b>Private saved handover</b>\n'+('Call Casey before pickup and return the labelled bag. '.repeat(8).trimEnd());
  const fixture=await install(page,{bookingOverrides:[{stayId:bookings[2].stayId,notes:longNote}]});
  const nativeDialogs=[];
  page.on('dialog',async dialog=>{nativeDialogs.push(dialog.message());await dialog.dismiss();});
  await page.goto(`${baseURL}/directory.html?ownerFlowFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const fern=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await fern.locator('[data-v11217-roster-checkout]').click();
  const modal=page.locator('#v11217GuidedCheckout');
  const saved=modal.locator('[data-v11217-guided-handover]');
  const preview=saved.locator('[data-v11217-guided-handover-preview]');
  await expect(saved).not.toHaveAttribute('open','');await expect(preview).toBeVisible();
  await expect(preview).toContainText('Private saved handover');await expect(preview.locator('b')).toHaveCount(0);
  expect(await preview.evaluate(node=>getComputedStyle(node).whiteSpace)).toBe('nowrap');
  await saved.locator('summary').click();
  expect(await saved.locator('[data-v11217-guided-handover-note]').textContent()).toBe(longNote);
  await saved.locator('summary').click();
  const note=modal.locator('[data-v11217-guided-note]');
  for(const dark of [false,true]){
    await page.locator('body').evaluate((body,on)=>body.classList.toggle('dark-theme',on),dark);
    await note.fill('A departure draft to retain without a browser prompt.');
    await modal.locator('[data-v11217-guided-close]').last().click();
    const prompt=modal.locator('[data-v11217-discard-prompt]');
    await expect(prompt).toBeVisible();await expect(prompt.locator('[data-v11217-discard-keep]')).toBeFocused();
    for(const button of await prompt.locator('button').all()){
      const hit=await button.evaluate(node=>{const r=node.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{height:r.height,bottom:r.bottom,right:r.right,width:innerWidth,viewport:innerHeight,hit:top===node||node.contains(top)};});
      expect(hit.height).toBeGreaterThanOrEqual(44);expect(hit.bottom).toBeLessThanOrEqual(hit.viewport);expect(hit.right).toBeLessThanOrEqual(hit.width);expect(hit.hit).toBe(true);
    }
    if(testInfo.project.name==='chromium-320'&&!dark){
      await prompt.evaluate(node=>node.style.fontSize='28px');
      for(const button of await prompt.locator('button').all()){
        const geometry=await button.evaluate(node=>{const r=node.getBoundingClientRect();return{right:r.right,bottom:r.bottom,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,height:innerHeight};});
        expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
      }
      await prompt.evaluate(node=>node.style.removeProperty('font-size'));
    }
    if(testInfo.project.name==='chromium-390')await page.screenshot({path:testInfo.outputPath(`inline-discard-${dark?'dark':'light'}.png`),animations:'disabled'});
    await modal.locator('[data-v11217-guided-confirm]').evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    await expect(modal).toBeVisible();
    await prompt.locator('[data-v11217-discard-keep]').click();await expect(note).toHaveValue('A departure draft to retain without a browser prompt.');
    await expect(modal.locator('[data-v11217-guided-confirm]')).toBeEnabled();
    if(['chromium-390','chromium-1440'].includes(testInfo.project.name))await page.screenshot({path:testInfo.outputPath(`owner-flow-${dark?'dark':'light'}.png`),animations:'disabled'});
  }
  await modal.locator('[data-v11217-guided-close]').last().click();await modal.locator('[data-v11217-discard-confirm]').click();
  await expect(modal).toBeHidden();
  const sameDay=page.locator(`#directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`);
  await sameDay.locator('[data-v11217-roster-checkout]').click();await expect(saved).toBeHidden();await expect(note).toHaveValue('');
  await modal.locator('[data-v11217-guided-close]').last().click();
  const ongoing=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await ongoing.locator('.v11217-roster-more-actions summary').click();await ongoing.locator('.v11217-roster-more-actions [data-v11217-early-checkout]').click();
  const early=page.locator('#v11217EarlyCheckoutModal');await early.locator('[data-v11217-note]').fill('Keep this early pickup draft.');
  await early.locator('[data-v11217-close]').last().click();
  const earlyKeep=early.locator('[data-v11217-discard-keep]');await expect(earlyKeep).toBeVisible();
  expect(await earlyKeep.evaluate(node=>{const r=node.getBoundingClientRect();return r.bottom<=innerHeight&&r.height>=44;})).toBe(true);
  await early.locator('[data-v11217-discard-confirm]').click();await expect(early).toBeHidden();
  expect(nativeDialogs).toEqual([]);expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(0);
});

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
  const arrivalSummary=first.locator('[data-arrival-task-heading]');
  await expect(arrivalSummary).toContainText('Care checks');
  for(const dark of [false,true]){
    await page.locator('body').evaluate((node,on)=>node.classList.toggle('dark-theme',on),dark);
    await arrivalSummary.evaluate(node=>node.scrollIntoView({block:'center'}));
    const geometry=await arrivalSummary.evaluate(node=>{const r=node.getBoundingClientRect();return{height:r.height,left:r.left,right:r.right,width:innerWidth,overflow:node.scrollWidth>node.clientWidth+1};});
    expect(geometry.height).toBeGreaterThanOrEqual(44);expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.width+1);expect(geometry.overflow).toBe(false);
    if(['chromium-390','chromium-1440'].includes(testInfo.project.name)){
      const dir=path.join(__dirname,'..','output','care-arrival-rebooking');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,`arrival-${testInfo.project.name}-${dark?'dark':'light'}.png`)});
    }
  }
  await page.locator('body').evaluate(node=>node.classList.remove('dark-theme'));
  await first.locator('[data-open-directory-profile]').click();
  await expect(first).toHaveClass(/is-profile-active/);
  await expect(focus).toBeHidden();
  await expect(first.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await expect(first.locator('[data-compact-intake-status]')).toHaveText('Form received');
  await expect(first.locator('[data-v1118-care-signals]').filter({hasText:'Intake missing'})).toHaveCount(0);
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
  await page.exposeFunction('__recordSyntheticCheckout',payload=>fixture.recordCheckout(payload));
  await page.evaluate(()=>{
    window.__syntheticWrites=[];
    window.sendPayloadToAppsScript=async payload=>{
      window.__syntheticWrites.push({...payload});
      return window.__recordSyntheticCheckout(payload);
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
  const directCopy=banner.locator('[data-v11217-departure-copy]');
  await expect(directCopy).toBeVisible();
  await expect(directCopy).toBeFocused();
  for(const dark of [false,true]){
    await page.locator('body').evaluate((node,on)=>node.classList.toggle('dark-theme',on),dark);
    await directCopy.scrollIntoViewIfNeeded();
    const geometry=await banner.evaluate(node=>{
      const controls=[...node.querySelectorAll('button')].filter(el=>el.getClientRects().length);
      const rects=controls.map(el=>el.getBoundingClientRect());
      return {overflow:document.documentElement.scrollWidth>innerWidth,
        sizes:rects.every(r=>r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth),
        overlap:rects.some((a,i)=>rects.some((b,j)=>i<j&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),
        hit:controls.every(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})};
    });
    expect(geometry).toEqual({overflow:false,sizes:true,overlap:false,hit:true});
    if(['chromium-390','chromium-1440'].includes(testInfo.project.name)){
      const dir=path.join(__dirname,'..','output','care-checkout-completion');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,`completion-${testInfo.project.name}-${dark?'dark':'light'}.png`)});
    }
  }
  await page.locator('body').evaluate(node=>node.classList.remove('dark-theme'));
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
  await expect(modal.locator('[data-v11217-discard-prompt]')).toBeVisible();
  await modal.locator('[data-v11217-discard-confirm]').click();
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

test('confirmed discard clears the checkout note without writes or a second prompt',async({page,baseURL})=>{
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
  await note.evaluate(node=>node.setSelectionRange(5,12));
  await modal.locator('[data-v11217-guided-close]').last().click();
  const discard=modal.locator('[data-v11217-discard-prompt]');
  await expect(discard).toBeVisible();
  await expect(discard.locator('[data-v11217-discard-keep]')).toBeFocused();
  await modal.locator('[data-v11217-guided-close].v11217-modal-close').click();
  await discard.locator('[data-v11217-discard-keep]').click();
  await expect(note).toHaveValue(handoverNote);
  await expect(note).toBeFocused();
  expect(await note.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([5,12]);
  await expect(modal.locator('[data-v11217-guided-confirm]')).toBeEnabled();
  await modal.locator('[data-v11217-guided-close]').last().click();
  await discard.locator('[data-v11217-discard-confirm]').click();
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


test('Care recovery clears only explicit filters and named arrival navigation does not open profiles or write',async({page,baseURL},testInfo)=>{
  const attemptedWrites=[];
  page.on('request',request=>{if(request.url().includes('script.google')&&!['GET','HEAD'].includes(request.method()))attemptedWrites.push(request.method());});
  const fixture=await install(page);
  await page.goto(`${baseURL}/directory.html?careEfficiencyTen=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS&&window.WAFFLE_ARRIVAL_READY);
  const grid=page.locator('#directory-grid');await expect(grid.locator('.directory-card')).toHaveCount(3);
  const next=page.locator('[data-waffle-arrival-next]');
  await expect(next).toContainText('Milo');await expect(next).toContainText('#00017');
  const initialReads=fixture.reads.filter(action=>['get_guest_profile','get_guest_belongings','list_dog_identities'].includes(action)).length;
  await next.click();
  await expect(grid.locator(`[data-directory-stay-id="${bookings[0].stayId}"] [data-v11217-roster-checkin]`)).toBeFocused();
  await expect(next).toContainText('#00018');
  const search=page.locator('#guestDirectorySearch'),empty=page.locator('#directory-empty-state');
  await search.fill('No such guest');await expect(empty).toBeVisible();
  await expect(empty.locator('[data-directory-empty-action]')).toHaveText('Clear search');
  await search.press('Escape');await expect(search).toHaveValue('');
  await expect(grid.locator('.directory-card:visible')).toHaveCount(3);
  const work=page.locator('[data-care-roster-focus]');
  if(!await work.evaluate(node=>node.open))await work.locator('summary').click();
  await work.locator('[data-focus-mode="leaving"]').click();await search.fill('No such guest');
  await expect(empty).toBeVisible();await expect(empty.locator('[data-directory-empty-action]')).toHaveText('Clear search and filter');
  for(const dark of [false,true]){
    await page.locator('body').evaluate((node,on)=>node.classList.toggle('dark-theme',on),dark);
    const action=empty.locator('[data-directory-empty-action]');await action.scrollIntoViewIfNeeded();
    const geometry=await action.evaluate(node=>{const r=node.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,height:r.height,right:r.right,hit:node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
    expect(geometry.overflow).toBe(false);expect(geometry.height).toBeGreaterThanOrEqual(44);expect(geometry.right).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));expect(geometry.hit).toBe(true);
    if(['chromium-390','chromium-1440'].includes(testInfo.project.name)){
      const dir=path.join(__dirname,'..','output','care-daily-efficiency');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,`recovery-${testInfo.project.name}-${dark?'dark':'light'}.png`)});
    }
  }
  await empty.locator('[data-directory-empty-action]').click();
  await expect(search).toHaveValue('');await expect(search).toBeFocused();
  await expect(work.locator('[data-focus-mode="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(grid.locator('.directory-card:visible')).toHaveCount(3);
  await expect(page.locator('.directory-card.is-profile-active')).toHaveCount(0);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_guest_belongings','list_dog_identities'].includes(action)).length).toBe(initialReads);
  expect(attemptedWrites).toEqual([]);
});


test('Care visual cleanup keeps one status, compact filters and themed readable primary actions',async({page,baseURL},info)=>{
  const fixture=await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,riskFlags:{medicated:true}}]});
  await page.goto(`${baseURL}/directory.html?visualCleanup=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const grid=page.locator('#directory-grid');await expect(grid.locator('.directory-card')).toHaveCount(3);
  const first=grid.locator(`[data-directory-stay-id="${bookings[0].stayId}"]`),last=grid.locator(`[data-directory-stay-id="${bookings[2].stayId}"]`);
  const row=first.locator('[data-open-directory-profile]'),checkin=first.locator('[data-v11217-roster-checkin]'),checkout=last.locator('[data-v11217-roster-checkout]');
  await expect(row.locator('.v1118-care-status')).toHaveText('ARRIVING TODAY');
  await expect(row.locator('.v1118-care-signal',{hasText:'Arrival today'})).toHaveCount(0);
  await expect(row.locator('.v1118-care-signal',{hasText:'Medication'})).toBeVisible();
  await expect(last.locator('.v1118-care-signal',{hasText:'Checkout today'})).toHaveCount(0);
  const next=page.locator('[data-waffle-arrival-next]');await expect(next).toBeVisible();
  const readsBefore=fixture.reads.filter(x=>x==='get_guest_profile').length;
  for(const dark of [false,true])for(const accent of ['waffle-purple','coastal-blue','eucalyptus','sunset-coral','warm-honey']){
    await page.evaluate(({dark,accent})=>{document.body.classList.toggle('dark-theme',dark);document.documentElement.dataset.waffleColourStyle=accent;},{dark,accent});
    const appearance=await checkin.evaluate(button=>{
      const s=getComputedStyle(button),row=button.closest('.directory-card').querySelector('[data-open-directory-profile]'),r=getComputedStyle(row),card=getComputedStyle(button.closest('.directory-card'));
      const light=colour=>{const a=colour.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*a[0]+.7152*a[1]+.0722*a[2];};
      const token=document.createElement('span');token.style.color=getComputedStyle(document.body).getPropertyValue('--care-primary-fill').trim();const a=light(s.color),b=light(s.backgroundColor);return{background:s.backgroundColor,expected:token.style.color,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),height:button.getBoundingClientRect().height,rowBorder:r.borderTopWidth,rowShadow:r.boxShadow,cardBorder:parseFloat(card.borderTopWidth),width:innerWidth,scroll:document.documentElement.scrollWidth};
    });
    expect(appearance.background).toBe(appearance.expected);expect(appearance.contrast).toBeGreaterThanOrEqual(4.5);expect(appearance.height).toBeGreaterThanOrEqual(44);
    expect(appearance.rowBorder).toBe('0px');expect(appearance.rowShadow).toBe('none');expect(appearance.cardBorder).toBeGreaterThan(0);expect(appearance.scroll).toBeLessThanOrEqual(appearance.width);
    expect(await checkout.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(appearance.background);
  }
  const work=page.locator('[data-care-roster-focus]');await work.locator('summary').click();await work.locator('[data-focus-mode="arriving"]').click();
  await expect(work).not.toHaveAttribute('open','');await expect(work.locator('summary')).toBeFocused();await expect(work.locator('summary')).toHaveText('Arriving today · 2');
  await expect(page.locator('[data-focus-clear]')).toHaveAccessibleName('Clear Arriving today filter');
  const filterLayout=await work.evaluate(node=>{const a=node.getBoundingClientRect(),b=document.querySelector('[data-focus-clear]').getBoundingClientRect();return{overlap:Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top),separate:a.right<=b.left+1};});
  expect(filterLayout.overlap).toBeGreaterThanOrEqual(40);expect(filterLayout.separate).toBe(true);
  const search=page.locator('#guestDirectorySearch');await search.fill('#00017');await expect(next).toBeHidden();
  await expect(checkin).toBeVisible();await expect(row.locator('.v1118-care-signal',{hasText:'Medication'})).toBeVisible();
  const dir=path.join(__dirname,'..','output','care-visual-cleanup');fs.mkdirSync(dir,{recursive:true});
  for(const dark of [false,true]){
    await page.evaluate(dark=>{document.body.classList.toggle('dark-theme',dark);document.documentElement.dataset.waffleColourStyle='waffle-purple';},dark);
    await page.screenshot({path:path.join(dir,`care-clean-${info.project.name}-${dark?'dark':'light'}.png`),animations:'disabled'});
  }
  expect(fixture.reads.filter(x=>x==='get_guest_profile').length).toBe(readsBefore);
});
