const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

const longDogName='Alexandria Peterson-Smith-Wellington and Family';
const longMedication='Give the prescribed tablet with the evening meal, then wait ten minutes before offering the second small portion. Keep the labelled blue pouch in the overnight bag and call the owner before changing the dose if the appetite or breathing changes.';

test('selected Care identity, safety and note actions stay aligned at narrow and wide widths',async({page,baseURL},testInfo)=>{
  const fixture=await install(page,{bookingOverrides:[
    {stayId:bookings[0].stayId,dogName:longDogName,ownerName:'Casey Alexandra Wellington-Smith',requestSource:'MadPaws',stayKey:`${longDogName.toLowerCase()}|2026-10-18|2026-10-20`}
  ]});
  await page.route('**/script.google.com/**',async route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method()))return route.fallback();
    let params;try{params=new URL(request.url()).searchParams;}catch{return route.fallback();}
    let payload={};try{payload=JSON.parse(params.get('payload')||'{}');}catch{}
    const action=params.get('action')||payload.action;
    if(action==='get_guest_directory'){
      const response={result:'success',bookings:fixture.bookings,summaries:fixture.bookings.map(booking=>({stayKey:booking.stayKey,requestSource:booking.requestSource||'',riskFlags:booking.dogName===longDogName?{foodAllergy:true,medicated:true,escapeRisk:true}:{}})),digitalIntakes:[],legacyIntakes:[]};
      const callback=params.get('callback');
      return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if(action!=='get_guest_profile')return route.fallback();
    const booking=fixture.bookings.find(row=>row.stayId===(params.get('stayId')||payload.stayId));
    const record={stayKey:booking.stayKey,identity:{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId},resolution:{status:'resolved',method:'fixture'},updatedAt:'2026-10-18T00:00:00Z',riskFlags:{foodAllergy:true,medicated:true},intakeAttributesSource:'Saved profile',intakeAttributes:{medicationInstructions:longMedication}};
    const response={result:'success',record},callback=params.get('callback');
    return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  const screenshotDir=path.resolve(__dirname,'../output/care-alignment-current');
  fs.mkdirSync(screenshotDir,{recursive:true});
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:width>=768?900:844});
    const tile=card.locator('.directory-guest-tile-open');
    await expect(tile).toContainText(longDogName);
    await expect(tile.locator('[data-v1117-care-source-badge]')).toContainText('MadPaws');
    const roster=await tile.evaluate(element=>{
      const box=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}};
      return{right:element.getBoundingClientRect().right,name:box(element.querySelector('.directory-guest-tile-name')),source:box(element.querySelector('[data-v1117-care-source-badge]')),status:[...element.querySelectorAll('.directory-roster-status,.v1118-care-status,.v1118-care-signal')].filter(node=>node.getClientRects().length).map(box),scrollWidth:document.documentElement.scrollWidth};
    });
    expect(roster.scrollWidth,JSON.stringify(roster)).toBeLessThanOrEqual(width);
    expect(roster.right).toBeLessThanOrEqual(width+1);
    expect(roster.name.scrollWidth).toBeLessThanOrEqual(roster.name.clientWidth+1);
    expect(roster.source.scrollWidth).toBeLessThanOrEqual(roster.source.clientWidth+1);
    expect(roster.status.every(item=>item.scrollWidth<=item.clientWidth+1),JSON.stringify(roster)).toBe(true);
    await page.screenshot({path:path.join(screenshotDir,`roster-${testInfo.project.name}-${width}.png`),fullPage:false});
  }
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
  await expect(card.locator('[data-care-brief-medication]')).toContainText(longMedication);

  for(const width of [320,390,768,1440])for(const dark of [false,true]){
    await page.setViewportSize({width,height:width>=768?900:844});
    await page.locator('body').evaluate((body,isDark)=>body.classList.toggle('dark-theme',isDark),dark);
    const metrics=await page.evaluate(()=>{
      const card=document.querySelector('.directory-card.is-profile-active');
      const rect=element=>{const r=element.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const visible=selector=>[...card.querySelectorAll(selector)].filter(el=>el.getClientRects().length);
      const selectors=['.directory-card-header','.directory-card-identity','.directory-dog-name-btn','.directory-profile-stay-dates','.directory-care-brief-safety','.directory-care-brief-note','.directory-care-brief-actions','[data-care-brief-action="emergency-contact"]','[data-care-brief-action="handover"]','[data-care-brief-medication]'];
      const elements=selectors.flatMap(selector=>visible(selector).map(el=>({selector,...rect(el),text:el.innerText.trim()})));
      const details=[...card.querySelectorAll('.directory-care-brief-safety .directory-care-brief-note-heading,.directory-care-brief-note .directory-care-brief-note-heading,.v1117-care-source-badge,.v1118-care-status')].filter(el=>el.getClientRects().length).map(el=>({className:el.className,text:el.innerText.trim(),...rect(el)}));
      const overlapping=[];
      const safety=card.querySelector('.directory-care-brief-safety');
      const note=card.querySelector('.directory-care-brief-note');
      const pairs=[
        [safety?.querySelector('.directory-care-brief-note-heading h4'),safety?.querySelector('[data-care-brief-action="emergency-contact"]'),'safety-label/action'],
        [note?.querySelector('.directory-care-brief-note-heading h4'),note?.querySelector('[data-care-brief-action="handover"]'),'note-label/action']
      ];
      for(const [a,b,label] of pairs){
        if(!a?.getClientRects().length||!b?.getClientRects().length)continue;
        const first=rect(a),second=rect(b);
        if(first.left<second.right-1&&first.right>second.left+1&&first.top<second.bottom-1&&first.bottom>second.top+1)overlapping.push(label);
      }
      const noteLane=['h4','[data-care-brief-action="handover"]'].map(selector=>{const box=rect(note.querySelector(selector));return {left:box.left,right:box.right,center:(box.top+box.bottom)/2};});
      const safetyLane=['.directory-care-brief-note-heading h4','[data-care-brief-safety]','[data-care-brief-action="emergency-contact"]'].map(selector=>{
        const element=safety?.querySelector(selector);
        if(!element?.getClientRects().length)return null;
        const box=rect(element);
        return{selector,center:box.top+box.height/2,top:box.top,bottom:box.bottom,height:box.height};
      }).filter(Boolean);
      const dateCells=[...card.querySelectorAll('.directory-profile-stay-dates > span')].filter(el=>el.getClientRects().length).map(el=>rect(el));
      const checkinActions=[...card.querySelectorAll('.v110-operation-actions > [data-v110-checkin],.v110-operation-actions > .v11217-profile-more-actions > summary')].filter(el=>el.getClientRects().length).map(el=>rect(el));
      const actionLayout=(()=>{const host=card.querySelector('.v110-operation-actions');return host?{host:rect(host),display:getComputedStyle(host).display,columns:getComputedStyle(host).gridTemplateColumns,items:[...host.children].map(el=>({className:el.className,box:rect(el),gridColumn:getComputedStyle(el).gridColumn,width:getComputedStyle(el).width}))}:null})();
      const longText=visible('[data-care-brief-medication],.directory-profile-stay-dates,.directory-name-row .directory-dog-id,.directory-name-row [class*="status"],.v1117-care-source-badge,.v1118-care-status,.v1118-care-signal').map(el=>({text:el.innerText.trim(),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,whiteSpace:getComputedStyle(el).whiteSpace,overflowWrap:getComputedStyle(el).overflowWrap}));
      return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,elements,details,overlapping,longText,noteLane,safetyLane,dateCells,checkinActions,actionLayout};
    });
    expect(metrics.scrollWidth,JSON.stringify(metrics)).toBeLessThanOrEqual(width);
    expect(metrics.elements.every(item=>item.left>=-1&&item.right<=width+1&&item.height>0),JSON.stringify(metrics)).toBe(true);
    expect(metrics.overlapping,JSON.stringify(metrics)).toEqual([]);
    expect(metrics.noteLane).toHaveLength(2);
    expect(Math.abs(metrics.noteLane[0].center-metrics.noteLane[1].center),JSON.stringify(metrics.noteLane)).toBeLessThanOrEqual(4);
    expect(metrics.longText.every(item=>item.scrollWidth<=item.clientWidth+1),JSON.stringify(metrics.longText)).toBe(true);
    if(width>=700)expect(Math.max(...metrics.safetyLane.map(item=>item.center))-Math.min(...metrics.safetyLane.map(item=>item.center)),JSON.stringify(metrics.safetyLane)).toBeLessThanOrEqual(4);
    if(width>=601)expect(metrics.dateCells[1].left-metrics.dateCells[0].right,JSON.stringify(metrics.dateCells)).toBeLessThanOrEqual(18);
    if(width>=700&&width<=768){expect(metrics.checkinActions).toHaveLength(2);expect(Math.max(...metrics.checkinActions.map(item=>item.top))-Math.min(...metrics.checkinActions.map(item=>item.top)),JSON.stringify({items:metrics.checkinActions,layout:metrics.actionLayout})).toBeLessThanOrEqual(4);}
    for(const control of await card.locator('[data-care-brief-action="emergency-contact"],[data-care-brief-action="handover"]').all()){
      if(!await control.isVisible())continue;
      const box=await control.boundingBox();
      expect(box.height,`Care action below 44px at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({path:path.join(screenshotDir,`${testInfo.project.name}-${width}-${dark?'dark':'light'}.png`),fullPage:false});
    if(!dark){
      const note=card.locator('.directory-care-brief-note').first();
      if(await note.count())await note.screenshot({path:path.join(screenshotDir,`note-${testInfo.project.name}-${width}.png`)});
    }
    await page.evaluate(()=>window.scrollTo(0,0));
  }
});
