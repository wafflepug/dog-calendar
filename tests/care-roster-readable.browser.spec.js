const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('the 320px roster keeps long identity and care badges readable with enlarged text',async({page,baseURL})=>{
  const longName='Alexandria Peterson-Smith-Wellington and Family';
  await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,dogName:longName,stayKey:`${longName.toLowerCase()}|2026-10-18|2026-10-20`}]});
  await page.setViewportSize({width:320,height:800});
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const row=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"] .directory-guest-tile-open`);
  await expect(row).toBeVisible();
  await expect(row.locator('.directory-guest-tile-name')).toHaveText(longName);
  await expect(row.locator('.v1118-care-status')).toHaveText('Arriving');
  await expect(row.locator('.v1118-care-signal',{hasText:'Arrival today'})).toBeVisible();
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
