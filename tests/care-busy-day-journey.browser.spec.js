const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');
const {settlePointerTargetAfterScroll}=require('./fixtures/care-pointer-readiness');

test('busy day: check in the correct Milo, review that stay’s care, then complete pickup checkout',async({page,baseURL})=>{
  const runtimeErrors=[];
  const attemptedNetworkWrites=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  page.on('request',request=>{
    if(request.url().includes('script.google.com')){
      if(!['GET','HEAD'].includes(request.method()))attemptedNetworkWrites.push(request.method());
    }
  });
  const fixture=await install(page,{profileOverrides:{[bookings[0].stayId]:{feedingTimes:'7am and 7pm',foodAmount:'1 cup',foodBrandType:'Sensitive formula'},[bookings[1].stayId]:{feedingTimes:'6am and 6pm',foodAmount:'2 cups',foodBrandType:'Chicken-free kibble',foodAllergies:'Chicken',medicationInstructions:'Give tablet with dinner.'}}});
  await page.goto(`${baseURL}/directory.html?busyDayFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);

  const first=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  const sameName=page.locator(`#directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`);
  await expect(first).toHaveAttribute('data-directory-dog-id',bookings[0].dogId);
  await expect(sameName).toHaveAttribute('data-directory-dog-id',bookings[1].dogId);
  await expect(first.locator('[data-v11217-roster-checkin]')).toHaveAccessibleName('Check-in Milo, Dog ID #00017, owner Alex, booked 18 Oct 2026 to 20 Oct 2026');
  await expect(sameName.locator('[data-v11217-roster-checkin]')).toHaveAccessibleName('Check-in Milo, Dog ID #00018, owner Bea, booked 18 Oct 2026 to 18 Oct 2026');

  await page.exposeFunction('__recordBusyDayCheckIn',payload=>fixture.recordCheckIn(payload));
  await page.exposeFunction('__recordBusyDayCheckout',payload=>fixture.recordCheckout(payload));
  await page.evaluate(()=>{
    window.__busyDayWrites=[];
    window.sendPayloadToAppsScript=async payload=>{
      window.__busyDayWrites.push({...payload});
      if(payload.action==='checkin_stay')return window.__recordBusyDayCheckIn(payload);
      if(payload.action==='checkout_stay')return window.__recordBusyDayCheckout(payload);
      return {result:'success'};
    };
  });

  const arrivalAction=sameName.locator('[data-v11217-roster-checkin]');
  await settlePointerTargetAfterScroll(page,arrivalAction);
  const arrivalHit=await arrivalAction.evaluate(node=>{const r=node.getBoundingClientRect();return{height:r.height,right:r.right,width:innerWidth,hit:node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
  expect(arrivalHit.height).toBeGreaterThanOrEqual(44);expect(arrivalHit.right).toBeLessThanOrEqual(arrivalHit.width);expect(arrivalHit.hit).toBe(true);
  await arrivalAction.click();
  await expect.poll(()=>page.evaluate(()=>window.__busyDayWrites.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__busyDayWrites[0]?.action)).toBe('checkin_stay');
  await expect.poll(()=>page.evaluate(()=>window.__busyDayWrites[0]?.stayId)).toBe(bookings[1].stayId);
  await expect.poll(()=>page.evaluate(()=>window.__busyDayWrites[0]?.dogId)).toBe(bookings[1].dogId);
  const checkedIn=sameName;
  await expect(checkedIn.locator('[data-v11217-roster-checkout]')).toBeVisible();
  await expect(page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"] [data-v11217-roster-checkin]`)).toBeVisible();

  await checkedIn.locator('[data-open-directory-profile]').click();
  await expect(checkedIn).toHaveClass(/is-profile-active/);
  const profile=checkedIn.locator('[data-directory-detail="profile"]');
  await expect(profile).toHaveAttribute('data-profile-read-state','fresh');
  await expect(checkedIn.locator('[data-intake-attribute="feedingTimes"]')).toHaveValue('6am and 6pm');
  await expect(checkedIn.locator('[data-intake-attribute="foodAmount"]')).toHaveValue('2 cups');
  await expect(checkedIn.locator('[data-intake-attribute="foodBrandType"]')).toHaveValue('Chicken-free kibble');
  await expect(checkedIn.locator('[data-intake-attribute="foodAllergies"]')).toHaveValue('Chicken');
  await expect(checkedIn.locator('[data-intake-attribute="medicationInstructions"]')).toHaveValue('Give tablet with dinner.');
  await expect(page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`)).not.toHaveClass(/is-profile-active/);
  expect(fixture.profileLookups).toHaveLength(1);
  expect(fixture.profileLookups[0]).toMatchObject({dogId:bookings[1].dogId,stayId:bookings[1].stayId});
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toEqual(['get_guest_profile']);

  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(checkedIn).not.toHaveClass(/is-profile-active/);
  await expect(checkedIn.locator('[data-v11217-roster-checkout]')).toBeVisible();
  const pickupAction=checkedIn.locator('[data-v11217-roster-checkout]');
  await settlePointerTargetAfterScroll(page,pickupAction);
  const pickupHit=await pickupAction.evaluate(node=>{const r=node.getBoundingClientRect();return{height:r.height,right:r.right,width:innerWidth,hit:node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
  expect(pickupHit.height).toBeGreaterThanOrEqual(44);expect(pickupHit.right).toBeLessThanOrEqual(pickupHit.width);expect(pickupHit.hit).toBe(true);
  await pickupAction.click();
  const checkout=page.locator('#v11217GuidedCheckout');
  await expect(checkout).toBeVisible();
  await expect(checkout.locator('[data-v11217-guided-dog]')).toHaveText('Milo');
  await expect(checkout.locator('[data-v11217-guided-dogid]')).toContainText('#00018');
  await expect(checkout).toHaveAccessibleDescription(/Dog ID #00018 · owner Bea · booked 18 Oct 2026 to 18 Oct 2026/);
  await checkout.locator('[data-v11217-guided-confirm]').click();
  await expect(checkout).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__busyDayWrites.length)).toBe(2);
  const writes=await page.evaluate(()=>window.__busyDayWrites.map(({action,dogId,stayId})=>({action,dogId,stayId})));
  expect(writes).toEqual([
    {action:'checkin_stay',dogId:bookings[1].dogId,stayId:bookings[1].stayId},
    {action:'checkout_stay',dogId:bookings[1].dogId,stayId:bookings[1].stayId}
  ]);
  await expect(page.locator(`#past-directory-grid [data-directory-stay-id="${bookings[1].stayId}"]`)).toHaveCount(1);
  await expect(page.locator(`#past-directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`)).toHaveCount(0);
  expect(attemptedNetworkWrites).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
