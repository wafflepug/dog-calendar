const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('the 320px roster keeps long identity and care badges readable with enlarged text',async({page,baseURL})=>{
  const longName='Alexandria Peterson-Smith-Wellington and Family';
  await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,dogName:longName,riskFlags:{medicated:true},stayKey:`${longName.toLowerCase()}|2026-10-18|2026-10-20`}]});
  await page.setViewportSize({width:320,height:800});
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const row=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"] .directory-guest-tile-open`);
  await expect(row).toBeVisible();
  await expect(row.locator('.directory-guest-tile-name')).toHaveText(longName);
  await expect(row.locator('.v1118-care-status')).toHaveText('ARRIVING TODAY');
  await expect(row.locator('.v1118-care-signal',{hasText:'Arrival today'})).toHaveCount(0);
  await expect(row.locator('.v1118-care-signal',{hasText:'Medication'})).toBeVisible();
  await row.evaluate(button=>{
    for(const element of button.querySelectorAll('.directory-guest-tile-name,.directory-roster-context,.v1118-care-status,.v1118-care-signal')){
      element.style.setProperty('font-size',`${parseFloat(getComputedStyle(element).fontSize)*2}px`,'important');
    }
  });
  const measure=()=>row.evaluate(button=>{
    const selectors=['.directory-roster-copy','.v1118-care-status','.v1118-care-signals'];
    const bounds=element=>{const r=element.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const items=selectors.map(selector=>({selector,...bounds(button.querySelector(selector))}));
    const avatar=bounds(button.querySelector('.directory-roster-avatar'));
    const text=[...button.querySelectorAll('.directory-guest-tile-name,.v1118-care-status,.v1118-care-signal')].map(element=>({text:element.innerText,whiteSpace:getComputedStyle(element).whiteSpace,overflow:getComputedStyle(element).overflow,textOverflow:getComputedStyle(element).textOverflow,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight}));
    return{viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,row:bounds(button),avatar,display:getComputedStyle(button).display,name:button.querySelector('.directory-guest-tile-name').innerText,items,text};
  });
  for(const [width,dark] of [[320,false],[320,true],[390,false],[1280,true]]){
    await page.setViewportSize({width,height:width===1280?900:800});
    await page.locator('body').evaluate((body,isDark)=>body.classList.toggle('dark-theme',isDark),dark);
    const layout=await measure();
    expect(layout.display,`row display at ${width}px`).toBe('grid');
    expect(layout.scrollWidth,`page overflow at ${width}px`).toBeLessThanOrEqual(layout.viewport);
    expect(layout.row.width,`row width at ${width}px`).toBeLessThanOrEqual(layout.viewport);
    expect(layout.row.height,`touch target at ${width}px`).toBeGreaterThanOrEqual(44);
    expect(layout.name).toBe(longName);
    expect(layout.items.every(item=>item.left>=0&&item.right<=layout.viewport+1&&item.height>0),JSON.stringify({width,items:layout.items})).toBe(true);
    expect(layout.items[0].bottom).toBeLessThanOrEqual(layout.items[1].top+1);
    expect(layout.items[1].bottom).toBeLessThanOrEqual(layout.items[2].top+1);
    expect(layout.avatar.bottom).toBeLessThanOrEqual(layout.items[2].top+1);
    expect(layout.text.every(item=>item.whiteSpace==='normal'&&item.textOverflow!=='ellipsis'&&item.scrollHeight<=item.clientHeight+6),JSON.stringify({width,text:layout.text})).toBe(true);
  }
});

test('Care reading layout keeps identity text readable and bounds wide desktop content',async({page,baseURL},testInfo)=>{
  const fixture=await install(page,{fernMedication:'Give one saved tablet with dinner. Keep the complete instructions visible.'});
  await page.goto(`${baseURL}/directory.html?careReadingFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
  const dashboard=page.locator('#directoryTabPanel .directory-dashboard-fused');
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[2].stayId}"]`);
  const row=card.locator('.directory-guest-tile-open');
  await expect(row).toBeVisible();
  const profileReads=()=>fixture.reads.filter(action=>action==='get_guest_profile').length;
  const initialReads=profileReads();
  for(const width of [320,390,820,1024,1440,1920])for(const dark of [false,true]){
    await page.setViewportSize({width,height:900});
    await page.locator('body').evaluate((body,on)=>body.classList.toggle('dark-theme',on),dark);
    const geometry=await dashboard.evaluate(root=>{
      const rect=node=>node.getBoundingClientRect().toJSON();
      const heading=root.querySelector('.directory-roster-heading');
      const row=root.querySelector('#directory-grid .directory-guest-tile-open');
      const selectors=['.directory-guest-tile-name','.directory-roster-context','.directory-roster-owner','.directory-dog-id','.directory-roster-status,.v1118-care-status'];
      return{viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,dashboard:rect(root),headingRow:rect(heading),headingContentWidth:heading.clientWidth-parseFloat(getComputedStyle(heading).paddingLeft)-parseFloat(getComputedStyle(heading).paddingRight),heading:rect(heading.firstElementChild),toolbar:rect(heading.querySelector('.guest-directory-toolbar')),searchFont:getComputedStyle(heading.querySelector('#guestDirectorySearch')).fontFamily,toolbarFont:getComputedStyle(heading.querySelector('.guest-directory-toolbar')).fontFamily,rowFont:getComputedStyle(row).fontFamily,cardFont:getComputedStyle(row.parentElement).fontFamily,text:selectors.map(selector=>{const el=[...row.querySelectorAll(selector)].find(node=>node.getClientRects().length&&getComputedStyle(node).display!=='none');return{selector,exists:!!el,size:el?parseFloat(getComputedStyle(el).fontSize):0,box:el?rect(el):null};})};
    });
    expect(geometry.pageWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(width);
    expect(geometry.rowFont).toBe(geometry.cardFont);
    expect(geometry.searchFont).toBe(geometry.toolbarFont);
    expect(geometry.dashboard.x).toBeGreaterThanOrEqual(0);
    expect(geometry.dashboard.right).toBeLessThanOrEqual(width+1);
    if(width>=1024){
      expect(geometry.dashboard.width).toBeLessThanOrEqual(1041);
      expect(Math.abs(geometry.heading.y-geometry.toolbar.y),JSON.stringify(geometry)).toBeLessThanOrEqual(8);
      expect(geometry.toolbar.width,JSON.stringify(geometry)).toBeGreaterThanOrEqual(Math.min(530,geometry.headingContentWidth-196)-1);
    }
    for(const item of geometry.text){
      expect(item.exists,item.selector).toBe(true);
      const minimum=item.selector.includes('name')?16:/context|owner/.test(item.selector)?14:12;
      expect(item.size,item.selector).toBeGreaterThanOrEqual(minimum);
      expect(item.box.right,item.selector).toBeLessThanOrEqual(width+1);
    }
    if(width===390||width===1440){
      const fs=require('node:fs'),path=require('node:path');
      const dir=path.join(__dirname,'..','output','care-reading-layout');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,`roster-${testInfo.project.name}-${width}-${dark?'dark':'light'}.png`),animations:'disabled'});
    }
  }
  expect(profileReads()).toBe(initialReads);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state','fresh');
  await expect(card.locator('[data-care-brief-medication]')).toContainText('Keep the complete instructions visible.');
  for(const width of [320,390,1440,1920]){
    await page.setViewportSize({width,height:900});
    const metrics=await card.evaluate(root=>({pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,width:root.getBoundingClientRect().width,values:[...root.querySelectorAll('.directory-care-brief-value,[data-care-brief-medication]')].filter(el=>el.getClientRects().length).map(el=>({size:parseFloat(getComputedStyle(el).fontSize),scroll:el.scrollHeight,client:el.clientHeight,text:el.innerText}))}));
    expect(metrics.pageWidth).toBeLessThanOrEqual(width);
    expect(metrics.values.length).toBeGreaterThan(0);
    for(const value of metrics.values){expect(value.size).toBeGreaterThanOrEqual(15);expect(value.scroll,JSON.stringify(value)).toBeLessThanOrEqual(value.client+2);}
    if(width>=1024)expect(metrics.width).toBeLessThanOrEqual(1041);
  }
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(row).toBeVisible();
});
