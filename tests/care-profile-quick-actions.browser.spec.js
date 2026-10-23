const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

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
  await expect(more).not.toHaveAttribute('open','');
  await expect(first.locator('.directory-photo-shell [data-upload-dog-photo], .directory-photo-shell [data-v108-gallery]')).toHaveCount(0);
  await more.locator(':scope > summary').click();
  await expect(photoTools.locator('[data-upload-dog-photo]')).toBeVisible();
  await expect(photoTools.locator('[data-v108-gallery]')).toBeVisible();
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
  await expect.poll(()=>page.evaluate(()=>window.__quickPhotoWrites[0]?.stayKey)).toBe(bookings[0].stayKey);
  await expect.poll(async()=>new URL(await page.locator('#hostedBelongingsPhotoUploaderFrame').getAttribute('src')).searchParams.get('dogName')).toBe(bookings[0].dogName);
  await expect.poll(async()=>new URL(await page.locator('#hostedBelongingsPhotoUploaderFrame').getAttribute('src')).searchParams.get('photoType')).toBe('dogProfile');
  await page.locator('#closeHostedBelongingsPhotoUploader').click();
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
  await page.evaluate(({dogName,startDate,endDate,dogId,stayId})=>window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready',{detail:{dogName,startDate,endDate,dogId,stayId}})),{dogName:bookings[1].dogName,startDate:bookings[1].startDate,endDate:bookings[1].endDate,dogId:bookings[1].dogId,stayId:bookings[1].stayId});
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
