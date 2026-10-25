const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

const longName='Alexandria Peterson-Smith-Wellington and Family';
const longNote=('Give the evening medication after dinner, then check the left paw for redness. Keep the blue inhaler in the overnight bag and call the owner if breathing changes. ').repeat(3);

test('Care profile back bar, handover note and section tabs stay clear and readable',async({page,baseURL},info)=>{
  const fixture=await install(page,{bookingOverrides:[
    {stayId:bookings[0].stayId,dogName:longName,dogNumber:'#12345',notes:longNote,stayKey:`${longName.toLowerCase()}|2026-10-18|2026-10-20`}
  ]});
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);

  const focus=page.locator('[data-care-roster-focus]');
  await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="arriving"]').click();
  const search=page.locator('#guestDirectorySearch');
  await search.fill('#12345');
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await expect(page.locator('#directoryProfileBreadcrumbName')).toHaveText(longName);
  await expect(page.locator('.directory-profile-breadcrumb')).toBeHidden();
  await expect(card.locator('.directory-dog-name-btn')).toHaveText(longName);

  const tabs=card.locator('.v11160-desktop-tabs [role="tab"]');
  await expect(tabs).toHaveText(['Overview','Items','Photos','Stay history','Dog record']);
  await expect(tabs.locator('span[aria-hidden="true"]')).toHaveCount(0);
  await expect.poll(()=>tabs.evaluateAll(items=>items.every(item=>item.getBoundingClientRect().height>=44))).toBe(true);
  const overview=tabs.filter({hasText:'Overview'});
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.filter({hasText:'Items'})).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected','true');
  await expect(tabs.filter({hasText:'Items'})).toHaveAttribute('aria-selected','false');
  const profileReadsAfterOpen=fixture.reads.filter(action=>action==='get_guest_profile').length;
  expect(profileReadsAfterOpen).toBe(1);
  const careReadsAfterOpen=fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action));

  const noteHost=card.locator('[data-care-brief-handover-note]');
  await expect(card.locator('[data-care-brief-safety]')).toBeVisible();
  await expect(card.locator('[data-care-brief-medication]')).toBeVisible();
  await expect(card.locator('[data-care-brief-feeding]')).toBeVisible();
  await expect(card.locator('[data-care-brief-walks]')).toBeVisible();
  await expect(card.locator('.directory-care-owner-line')).toBeVisible();
  const noteDetails=noteHost.locator('[data-care-brief-handover-details]');
  await expect(noteDetails).toHaveCount(1);
  await expect(noteDetails).not.toHaveAttribute('open','');
  await expect(noteHost.locator('[data-care-brief-handover-full]')).toHaveText(longNote);
  const noteNode=await noteHost.elementHandle();
  await noteDetails.locator(':scope > summary').click();
  await expect(noteDetails).toHaveAttribute('open','');
  await page.evaluate(()=>renderDirectoryCareBrief(document.querySelector('.directory-card.is-profile-active')));
  expect(await noteNode.evaluate(node=>node.isConnected)).toBe(true);
  await expect(noteHost.locator('[data-care-brief-handover-details]')).toHaveAttribute('open','');
  await expect(noteHost.locator('[data-care-brief-handover-full]')).toHaveText(longNote);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual(careReadsAfterOpen);

  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});
    for(const theme of ['light','dark']){
      await page.locator('body').evaluate((body,dark)=>body.classList.toggle('dark-theme',dark),theme==='dark');
      await page.locator('#directoryBackToGuestsBtn').scrollIntoViewIfNeeded();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const geometry=await page.evaluate(()=>{
        const box=element=>{const rect=element.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height}};
        const back=document.querySelector('.directory-profile-back-btn'),bar=document.querySelector('.directory-profile-back-bar'),name=document.querySelector('.directory-card.is-profile-active .directory-dog-name-btn'),header=document.querySelector('#wh75MobileTopbar'),menu=document.querySelector('#wh75MenuButton');
        const b=box(back),h=header&&box(header),m=menu&&box(menu),n=box(name),overlaps=(a,c)=>!!(a&&c&&a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top);
        return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,back:b,bar:box(bar),name:n,header:h,menu:m,overlapHeader:overlaps(b,h),overlapMenu:overlaps(b,m),whiteSpace:getComputedStyle(name).whiteSpace,overflow:getComputedStyle(name).textOverflow,backHit:(()=>{const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return hit===back||back.contains(hit)})()};
      });
      expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
      expect(geometry.back.height).toBeGreaterThanOrEqual(44);
      expect(geometry.overlapHeader).toBe(false);
      expect(geometry.overlapMenu).toBe(false);
      expect(geometry.backHit).toBe(true);
      expect(geometry.whiteSpace).toBe('normal');
      expect(geometry.overflow).not.toBe('ellipsis');
      expect(geometry.name.width).toBeLessThanOrEqual(geometry.bar.width);
      if(process.env.WAFFLE_CAPTURE_UI_EVIDENCE==='1'&&info.project.name==='chromium'&&width!==390){
        const out=path.resolve(__dirname,'../output/releases/2026.10.23.03/evidence');fs.mkdirSync(out,{recursive:true});
        await page.screenshot({path:path.join(out,`care-profile-${width}-${theme}.png`)});
        await card.locator('.directory-care-brief-note').screenshot({path:path.join(out,`care-note-${width}-${theme}.png`)});
        await card.locator('.v11160-desktop-tabs').screenshot({path:path.join(out,`care-tabs-${width}-${theme}.png`)});
      }
    }
  }

  await page.setViewportSize({width:320,height:844});
  await page.locator('#directoryBackToGuestsBtn').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    const name=document.querySelector('.directory-card.is-profile-active .directory-dog-name-btn');
    name.style.setProperty('font-size',`${parseFloat(getComputedStyle(name).fontSize)*2}px`,'important');
    document.querySelectorAll('.v11160-desktop-tab').forEach(tab=>tab.style.setProperty('font-size',`${parseFloat(getComputedStyle(tab).fontSize)*2}px`,'important'));
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const enlarged=await page.evaluate(()=>{
    const back=document.querySelector('.directory-profile-back-btn'),b=back.getBoundingClientRect(),header=document.querySelector('#wh75MobileTopbar')?.getBoundingClientRect(),menu=document.querySelector('#wh75MenuButton'),m=menu?.getBoundingClientRect(),overlaps=(a,c)=>!!(a&&c&&a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    const name=document.querySelector('.directory-card.is-profile-active .directory-dog-name-btn');
    return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,back:b.height,backRect:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},nameWidth:name.clientWidth,nameScroll:name.scrollWidth,overlapHeader:overlaps(b,header),overlapMenu:overlaps(b,m),backHit:hit===back||back.contains(hit),tabs:[...document.querySelectorAll('.v11160-desktop-tab')].map(tab=>({height:tab.getBoundingClientRect().height,right:tab.getBoundingClientRect().right,label:tab.querySelector('span:last-child'),labelWidth:tab.querySelector('span:last-child').clientWidth,labelScroll:tab.querySelector('span:last-child').scrollWidth}))};
  });
  expect(enlarged.scrollWidth).toBeLessThanOrEqual(320);
  expect(enlarged.back).toBeGreaterThanOrEqual(44);
  expect(enlarged.nameScroll).toBeLessThanOrEqual(enlarged.nameWidth+1);
  expect(enlarged.overlapHeader).toBe(false);
  expect(enlarged.overlapMenu).toBe(false);
  expect(enlarged.backHit).toBe(true);
  expect(enlarged.tabs.every(tab=>tab.height>=44&&tab.right<=320&&tab.labelScroll<=tab.labelWidth+1)).toBe(true);

  await card.locator('.directory-care-more-actions > summary').click();
  await card.locator('[data-directory-stay-contact] summary').click();
  await card.locator('[data-directory-edit-field="notes"]').click();
  await expect(page.locator('#guestDetailEditModal')).toHaveClass(/open/);
  const editedNote='Updated: give the full tablet after dinner and call before pickup. '.repeat(4);
  await page.locator('#guestDetailEditTextarea').fill(editedNote);
  await page.evaluate(({dogName,startDate,endDate,note})=>{
    window.sendPayloadToAppsScript=async payload=>({result:'success',fieldLabel:'Handover note',record:{dogName,breed:'Collie',startDate,endDate,ownerName:'Alex',phone:'0400000000',notes:payload.value,bookingType:'Boarding'}});
    window.refreshCalendarData=()=>true;
    window.loadCareRiskDashboard=async()=>{};
  },{dogName:longName,startDate:'2026-10-18',endDate:'2026-10-20',note:editedNote});
  await page.locator('#saveGuestDetailEdit').click();
  await expect(page.locator('#guestDetailEditStatus')).toContainText('saved and synced');
  await expect(noteHost.locator('[data-care-brief-handover-details]')).toHaveCount(1);
  await expect(noteHost.locator('[data-care-brief-handover-full]')).toHaveText(editedNote);
  await expect(card.locator('[data-directory-edit-field="notes"] .directory-field-value')).toHaveText(editedNote);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual(careReadsAfterOpen);

  await page.locator('#cancelGuestDetailEdit').click();
  await card.locator('[data-directory-edit-field="notes"]').click();
  await page.locator('#guestDetailEditTextarea').fill('Short updated note: call before pickup.');
  await page.locator('#saveGuestDetailEdit').click();
  await expect(noteHost).toHaveText('Short updated note: call before pickup.');
  await expect(noteHost.locator('details')).toHaveCount(0);
  await expect(card.locator('[data-directory-edit-field="notes"] .directory-field-value')).toHaveText('Short updated note: call before pickup.');
  await page.locator('#cancelGuestDetailEdit').click();

  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(search).toHaveValue('#12345');
  await expect(focus.locator('[data-focus-mode="arriving"]')).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('[data-open-directory-profile]')).toBeFocused();
  await search.fill('');
  if(!await focus.evaluate(node=>node.open))await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="all"]').click();
  const shortCard=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await shortCard.locator('[data-open-directory-profile]').click();
  await expect(shortCard.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  const shortNote=shortCard.locator('[data-care-brief-handover-note]');
  await expect(shortNote).toHaveText(bookings[2].notes);
  await expect(shortNote.locator('details')).toHaveCount(0);
  await expect(shortNote).not.toContainText(editedNote);
  expect(fixture.reads.filter(action=>action==='get_guest_profile').length).toBe(profileReadsAfterOpen+1);
});
