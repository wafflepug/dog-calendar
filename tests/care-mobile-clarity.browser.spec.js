const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

const longDogName='Alexandria Peterson-Smith-Wellington and Family';
const longOwnerName='Casey Alexandra Wellington-Smith';
const longMedication='Give the prescribed tablet with the evening meal, then wait ten minutes before offering the second small portion. Keep the labelled blue pouch in the overnight bag and call the owner before changing the dose if the appetite or breathing changes.';
const longHandover='At dinner, give the labelled tablet with food and check the left paw for redness. Keep the blue inhaler in the overnight bag, use the fitted harness for every walk, and call the owner before changing the routine. '.repeat(2);

async function openFirstStay(page,baseURL,fixture){
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const card=page.locator(`#directory-grid [data-directory-stay-id="${fixture.bookings[0].stayId}"]`);
  await expect(card).toBeVisible();
  return card;
}

test('care essentials and the quiet routine shortcut stay readable across phone, desktop and dark layouts',async({page,baseURL},testInfo)=>{
  const fixture=await install(page,{bookingOverrides:[
    {stayId:bookings[0].stayId,dogName:longDogName,ownerName:longOwnerName,notes:longHandover,stayKey:`${longDogName.toLowerCase()}|2026-10-18|2026-10-20`}
  ]});
  const profileReads=[];
  const liveWrites=[];
  page.on('request',request=>{
    if(request.url().includes('script.google.com')&&!['GET','HEAD'].includes(request.method()))liveWrites.push(request.method());
  });
  await page.route('**/script.google.com/**',async route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method()))return route.fallback();
    let params;
    try{params=new URL(request.url()).searchParams;}catch{return route.fallback();}
    let payload={};
    try{payload=JSON.parse(params.get('payload')||'{}');}catch{}
    const action=params.get('action')||payload.action;
    if(action!=='get_guest_profile')return route.fallback();
    profileReads.push({action,stayId:params.get('stayId')||payload.stayId});
    fixture.reads.push(action);
    const booking=fixture.bookings.find(row=>row.stayId===(params.get('stayId')||payload.stayId));
    const record={
      stayKey:booking.stayKey,
      identity:{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId},
      resolution:{status:'resolved',method:'fixture'},
      updatedAt:'2026-10-18T00:00:00Z',
      riskFlags:{foodAllergy:true,medicated:true},
      intakeAttributesSource:'Saved profile',
      intakeAttributes:{
        feedingTimes:'06:30 before the morning walk and 18:00 after the evening walk',
        foodAmount:'One measured cup at each meal',
        foodBrandType:'Sensitive salmon formula with a gradual ten day transition',
        walksPerDay:'Two walks, one before breakfast and one after dinner',
        walkDuration:'Thirty minutes each, using the fitted harness',
        medicationInstructions:longMedication
      }
    };
    const response={result:'success',record};
    const callback=params.get('callback');
    return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
  });
  await page.setViewportSize({width:390,height:844});
  const card=await openFirstStay(page,baseURL,fixture);
  if(process.env.WAFFLE_CAPTURE_CARE_MOBILE==='1'&&testInfo.project.name==='chromium-390'){
    const evidenceDir=path.resolve(__dirname,'../output/care-mobile-ten/screenshots');
    fs.mkdirSync(evidenceDir,{recursive:true});
    for(const [width,dark] of [[320,false],[320,true],[390,false],[390,true],[1440,false],[1440,true]]){
      await page.setViewportSize({width,height:width===1440?900:844});
      await page.locator('body').evaluate((body,isDark)=>body.classList.toggle('dark-theme',isDark),dark);
      await card.locator('.directory-guest-tile-open').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
      await page.screenshot({path:path.join(evidenceDir,`roster-${width}-${dark?'dark':'light'}.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('body').evaluate(body=>body.classList.remove('dark-theme'));
  }

  const rosterPhoto=card.locator('.directory-guest-tile-open .directory-roster-avatar');
  const rosterFallbackSize=await rosterPhoto.evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height}});
  expect(rosterFallbackSize.width).toBeGreaterThanOrEqual(64);
  expect(rosterFallbackSize.height).toBeGreaterThanOrEqual(64);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  const selectedPhoto=card.locator('.directory-photo-shell');
  const selectedPhotoFallback=selectedPhoto.locator('.directory-photo-placeholder');
  const selectedPhotoMedia=selectedPhoto.locator('.directory-photo-media');
  await expect(selectedPhotoFallback).toBeVisible();
  const selectedPhotoGeometry=await selectedPhoto.evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height}});
  const selectedFallbackGeometry=await selectedPhotoFallback.evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height}});
  const selectedMediaGeometry=await selectedPhotoMedia.evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height}});
  expect(selectedPhotoGeometry.width).toBeGreaterThanOrEqual(64);
  expect(selectedPhotoGeometry.height).toBeGreaterThanOrEqual(64);
  expect(selectedFallbackGeometry).toEqual(selectedMediaGeometry);
  const brief=card.locator('[data-directory-care-brief]');
  const feeding=brief.locator('[data-care-brief-feeding]');
  const walks=brief.locator('[data-care-brief-walks]');
  const safety=brief.locator('[data-care-brief-safety]');
  const medication=brief.locator('[data-care-brief-medication]');
  const ownerName=brief.locator('[data-care-brief-owner-name]');
  const callOwner=brief.locator('[data-care-brief-call-owner]');
  const routineEdit=brief.locator('button[data-care-brief-action="edit-routine"]');
  for(const essential of [feeding,walks,safety,medication,ownerName,callOwner,routineEdit])await expect(essential).toBeVisible();
  await expect(routineEdit).toHaveAccessibleName('Edit routine');
  await expect(brief.locator('details[open]')).toHaveCount(0);
  await expect(feeding).toContainText('One measured cup at each meal');
  await expect(walks).toContainText('Thirty minutes each');
  await expect(safety).toContainText('Food Allergy');
  await expect(medication).toHaveText(longMedication);
  await expect(ownerName).toHaveText(longOwnerName);
  expect(profileReads).toEqual([{action:'get_guest_profile',stayId:bookings[0].stayId}]);
  const readsAfterOpen=fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action));
  expect(readsAfterOpen).toEqual(['get_guest_profile']);

  const tabs=card.locator('.v11160-desktop-tabs [role="tab"]');
  await expect.poll(()=>tabs.evaluateAll(items=>items.every(item=>item.getBoundingClientRect().height>=44))).toBe(true);
  for(const [width,dark] of [[320,false],[320,true],[390,false],[390,true],[1440,false],[1440,true]]){
    await page.setViewportSize({width,height:width===1440?900:844});
    await page.locator('body').evaluate((body,isDark)=>body.classList.toggle('dark-theme',isDark),dark);
    await card.locator('.directory-profile-stay-dates').scrollIntoViewIfNeeded();
    const geometry=await page.evaluate(()=>{
      const selectors=['[data-care-brief-safety]','[data-care-brief-feeding]','[data-care-brief-walks]','[data-care-brief-medication]','[data-care-brief-owner-name]','[data-care-brief-call-owner]','[data-care-brief-action="edit-routine"]'];
      const elements=selectors.map(selector=>document.querySelector(selector)).filter(element=>element?.getClientRects().length);
      const rect=element=>{const value=element.getBoundingClientRect();return{left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height}};
      const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const label=element=>element.hasAttribute('data-care-brief-safety')?'safety':element.hasAttribute('data-care-brief-feeding')?'feeding':element.hasAttribute('data-care-brief-walks')?'walks':element.hasAttribute('data-care-brief-medication')?'medication':element.hasAttribute('data-care-brief-owner-name')?'owner':'action';
      const overlapPairs=[];
      for(let index=0;index<elements.length;index++)for(const other of elements.slice(index+1))if(intersects(rect(elements[index]),rect(other)))overlapPairs.push([label(elements[index]),label(other)]);
      const values=[...document.querySelectorAll('[data-care-brief-feeding] [data-care-brief-row] span:last-child,[data-care-brief-walks] [data-care-brief-row] span:last-child,[data-care-brief-medication]')].filter(element=>element.getClientRects().length);
      const header=document.querySelector('.directory-card.is-profile-active .directory-card-header');
      const photo=document.querySelector('.directory-card.is-profile-active .directory-photo-shell');
      const identity=document.querySelector('.directory-card.is-profile-active .directory-card-identity');
      const name=document.querySelector('.directory-card.is-profile-active .directory-dog-name-btn');
      const dates=document.querySelector('.directory-card.is-profile-active .directory-profile-stay-dates');
      const headerBox=rect(header),photoBox=rect(photo),identityBox=rect(identity),datesBox=rect(dates);
      const headerHit=document.elementFromPoint(datesBox.left+datesBox.width/2,datesBox.top+datesBox.height/2);
      const describePath=selector=>{
        const start=document.querySelector(selector),path=[];
        for(let node=start;node&&path.length<8;node=node.parentElement){
          const style=getComputedStyle(node),box=rect(node);
          path.push({tag:node.tagName.toLowerCase(),className:node.className?.toString?.()||'',attrs:['data-care-brief-walks','data-care-brief-owner-name','data-care-brief-action'].filter(key=>node.hasAttribute(key)),box,display:style.display,gridRow:style.gridRow,gridColumn:style.gridColumn,position:style.position});
          if(node.matches('.directory-care-brief,.directory-card'))break;
        }
        return path;
      };
      return{
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        essentials:elements.map(rect),overlapPairs,
        values:values.map(element=>({text:element.textContent,whiteSpace:getComputedStyle(element).whiteSpace,textOverflow:getComputedStyle(element).textOverflow,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight})),
        header:{header:headerBox,photo:photoBox,identity:identityBox,name:rect(name),dates:datesBox,photoIdentityOverlap:intersects(photoBox,identityBox),dateText:dates.textContent,datesGridColumns:getComputedStyle(dates).gridTemplateColumns,datesHit:headerHit===dates||dates.contains(headerHit),nameWhiteSpace:getComputedStyle(name).whiteSpace,nameTextOverflow:getComputedStyle(name).textOverflow,nameScrollHeight:name.scrollHeight,nameClientHeight:name.clientHeight},
        layout:{walks:describePath('[data-care-brief-walks]'),owner:describePath('[data-care-brief-owner-name]'),subsections:[...document.querySelectorAll('.directory-care-brief-subsection')].map(rect)}
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.overlapPairs,JSON.stringify({width,dark,overlapPairs:geometry.overlapPairs,essentials:geometry.essentials,layout:geometry.layout})).toHaveLength(0);
    expect(geometry.essentials.every(box=>box.left>=-1&&box.right<=width+1&&box.height>0)).toBe(true);
    expect(geometry.header.header.right).toBeLessThanOrEqual(width+1);
    expect(geometry.header.photo.width).toBeGreaterThanOrEqual(64);
    expect(geometry.header.photo.height).toBeGreaterThanOrEqual(64);
    expect(geometry.header.photoIdentityOverlap).toBe(false);
    expect(geometry.header.identity.left).toBeGreaterThanOrEqual(geometry.header.photo.right);
    expect(geometry.header.dates.height).toBeGreaterThanOrEqual(48);
    expect(geometry.header.dates.right).toBeLessThanOrEqual(geometry.header.identity.right+1);
    expect(geometry.header.dateText).toMatch(/Check-in/);
    expect(geometry.header.dateText).toMatch(/Check-out/);
    expect(geometry.header.datesHit).toBe(true);
    expect(['normal','pre-wrap'].includes(geometry.header.nameWhiteSpace)).toBe(true);
    expect(geometry.header.nameTextOverflow).not.toBe('ellipsis');
    expect(geometry.header.nameScrollHeight).toBeLessThanOrEqual(geometry.header.nameClientHeight+2);
    expect(geometry.values.every(value=>['normal','pre-wrap'].includes(value.whiteSpace)&&value.textOverflow!=='ellipsis'&&value.scrollHeight<=value.clientHeight+2),JSON.stringify({width,dark,values:geometry.values})).toBe(true);
    const controls=await card.locator('.v11160-desktop-tabs [role="tab"], [data-care-brief-action="edit-routine"], [data-care-brief-call-owner]').all();
    for(const control of controls){
      if(!await control.isVisible())continue;
      await control.scrollIntoViewIfNeeded();
      const metrics=await control.evaluate(element=>{
        const rect=element.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
        return{height:rect.height,right:rect.right,top:rect.top,bottom:rect.bottom,hit:hit===element||element.contains(hit)};
      });
      expect(metrics.height,`Control shorter than 44px at ${width}px: ${await control.getAttribute('aria-label')||await control.innerText()}`).toBeGreaterThanOrEqual(44);
      expect(metrics.right).toBeLessThanOrEqual(width+1);
      expect(metrics.hit).toBe(true);
    }
    expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual(readsAfterOpen);
    if(process.env.WAFFLE_CAPTURE_CARE_MOBILE==='1'&&testInfo.project.name==='chromium-390'){
      const evidenceDir=path.resolve(__dirname,'../output/care-mobile-ten/screenshots');
      fs.mkdirSync(evidenceDir,{recursive:true});
      await card.locator('.directory-card-header').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
      await page.screenshot({path:path.join(evidenceDir,`selected-header-${width}-${dark?'dark':'light'}.png`)});
      await brief.locator('.directory-care-brief-heading').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
      await page.screenshot({path:path.join(evidenceDir,`selected-care-${width}-${dark?'dark':'light'}.png`)});
    }
  }

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
    const card=document.querySelector('.directory-card.is-profile-active');
    for(const element of card.querySelectorAll('.directory-dog-name-btn,.directory-profile-stay-dates,[data-care-brief-safety],[data-care-brief-feeding],[data-care-brief-walks],[data-care-brief-medication],[data-care-brief-owner-name],[data-care-brief-call-owner],[data-care-brief-action="edit-routine"],.v11160-desktop-tabs [role="tab"]')){
      const size=parseFloat(getComputedStyle(element).fontSize);
      element.style.setProperty('font-size',`${size*2}px`,'important');
    }
  });
  const enlarged=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:[...document.querySelectorAll('.directory-card.is-profile-active .directory-profile-stay-dates,.directory-card.is-profile-active [data-care-brief-safety],.directory-card.is-profile-active [data-care-brief-feeding],.directory-card.is-profile-active [data-care-brief-walks],.directory-card.is-profile-active [data-care-brief-medication],.directory-card.is-profile-active [data-care-brief-owner-name],.directory-card.is-profile-active [data-care-brief-call-owner],.directory-card.is-profile-active [data-care-brief-action="edit-routine"]')].filter(element=>element.getClientRects().length).map(element=>{const rect=element.getBoundingClientRect();return{left:rect.left,right:rect.right,height:rect.height}}),name:(()=>{const element=document.querySelector('.directory-card.is-profile-active .directory-dog-name-btn'),rect=element.getBoundingClientRect();return{left:rect.left,right:rect.right,height:rect.height,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}})()}));
  expect(enlarged.scrollWidth).toBeLessThanOrEqual(390);
  expect(enlarged.items.every(item=>item.left>=-1&&item.right<=391&&item.height>0)).toBe(true);
  expect(enlarged.name.left).toBeGreaterThanOrEqual(0);
  expect(enlarged.name.right).toBeLessThanOrEqual(391);
  expect(enlarged.name.scrollHeight).toBeLessThanOrEqual(enlarged.name.clientHeight+2);
  await routineEdit.click();
  await expect(card.locator('[data-profile-subtab="foodWalks"]')).toHaveAttribute('aria-expanded','true');
  await expect(card.locator('[data-intake-attribute="feedingTimes"]')).toBeVisible();
  expect(profileReads).toHaveLength(1);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual(readsAfterOpen);
  expect(liveWrites).toEqual([]);
});

test('long handover note keeps its own expandable full text and short notes stay directly visible after rerender',async({page,baseURL})=>{
  const fixture=await install(page,{bookingOverrides:[
    {stayId:bookings[0].stayId,notes:longHandover},
    {stayId:bookings[2].stayId,notes:'Call Casey before pickup.'}
  ]});
  await page.setViewportSize({width:390,height:844});
  const first=await openFirstStay(page,baseURL,fixture);
  await first.locator('[data-open-directory-profile]').click();
  await expect(first.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  const longNote=first.locator('[data-care-brief-handover-note]');
  const disclosure=longNote.locator('details');
  await expect(longNote.locator('[data-care-brief-handover-preview]')).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open','');
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure.locator('[data-care-brief-handover-full]')).toHaveText(longHandover.trimEnd());
  const preservation=await page.evaluate(()=>{
    const note=document.querySelector('.directory-card.is-profile-active [data-care-brief-handover-note]');
    const details=note.querySelector('details');
    renderDirectoryCareBrief(document.querySelector('.directory-card.is-profile-active'));
    return{sameNote:note.isConnected&&document.querySelector('[data-care-brief-handover-note]')===note,sameDetails:details.isConnected&&note.querySelector('details')===details,open:details.open,fullText:details.querySelector('[data-care-brief-handover-full]')?.textContent};
  });
  expect(preservation).toEqual({sameNote:true,sameDetails:true,open:true,fullText:longHandover.trimEnd()});
  const readsAfterOpen=fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action));

  await page.locator('#directoryBackToGuestsBtn').click();
  const short=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  await short.locator('[data-open-directory-profile]').click();
  await expect(short.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  const shortNote=short.locator('[data-care-brief-handover-note]');
  await expect(shortNote).toHaveText('Call Casey before pickup.');
  await expect(shortNote).not.toContainText(longHandover);
  await expect(shortNote.locator('details')).toHaveCount(0);
  expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual([...readsAfterOpen,'get_guest_profile']);
});
