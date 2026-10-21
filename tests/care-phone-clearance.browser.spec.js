const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const {install,bookings}=require('./fixtures/care-daily-workflows');
const cases=[['320-portrait',320,640],['360-portrait',360,740],['375-portrait',375,812],['390-portrait',390,844],['412-portrait',412,915],['430-portrait',430,932],['600-portrait',600,900],['768-portrait',768,1024],['800-portrait',800,1100],['820-portrait',820,1180],['821-desktop',821,1024],['landscape-667',667,320],['landscape-844',844,390]];
test('Care profile clears fixed navigation and keeps controls readable across viewport sizes',async({page,baseURL},testInfo)=>{
 const fixture=await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,dogName:'Alexandria Peterson-Smith-Wellington and Family',ownerName:'Morgan River-Davies',dogNumber:'#12345',source:'Referral from our exceptionally long campaign source',stayKey:'alexandria peterson-smith-wellington and family|2026-10-18|2026-10-20'}]});
 await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_ROSTER_FOCUS);
 const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
 await card.locator('[data-open-directory-profile]').click();
 await expect(card).toHaveClass(/is-profile-active/);
 await page.locator('body').evaluate(node=>node.classList.add('dark-theme'));
 const backButton=page.locator('.directory-profile-back-btn');
 await backButton.scrollIntoViewIfNeeded();
 const openedBack=await page.evaluate(()=>{
  const back=document.querySelector('.directory-profile-back-btn'),header=document.querySelector('#wh75MobileTopbar');
  const b=back.getBoundingClientRect(),h=header?.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
  return{back:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},header:h&&{left:h.left,top:h.top,right:h.right,bottom:h.bottom},overlap:!!(h&&b.left<h.right&&b.right>h.left&&b.top<h.bottom&&b.bottom>h.top),hit:hit&&(hit===back||back.contains(hit))};
 });
 expect(openedBack.overlap).toBe(false);
 expect(openedBack.hit).toBe(true);
 const out=path.join(__dirname,'..','output','phone-clearance-evidence','care'); fs.mkdirSync(out,{recursive:true});
 const allRuns=[];
 for(const [name,width,height] of cases){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const states=[];
  const scrollPoints=await page.evaluate(()=>[0,Math.min(120,document.documentElement.scrollHeight-innerHeight),Math.max(0,document.documentElement.scrollHeight-innerHeight)]);
  for(const y of [...new Set(scrollPoints)]){
   await page.evaluate(y=>window.scrollTo(0,y),y);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const geometry=await page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const back=document.querySelector('.directory-profile-back-btn'),bar=document.querySelector('.directory-profile-back-bar'),launcher=document.querySelector('#wh75MenuButton'),bottom=document.querySelector('#wh75MobileBottomNav');
    const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
    const controls=[...document.querySelectorAll('.directory-care-brief-actions button, .directory-care-more-actions > summary, .directory-care-more-actions-list button, .directory-care-more-actions-list summary')].filter(e=>e.getClientRects().length);
    const br=rect(back),mr=launcher&&rect(launcher),bn=bottom&&rect(bottom),target=document.elementFromPoint(br.x+br.width/2,br.y+br.height/2),menuTarget=mr&&document.elementFromPoint(mr.x+mr.width/2,mr.y+mr.height/2);
    const backVisible=br.bottom>0&&br.y<innerHeight,header=document.querySelector('#wh75MobileTopbar'),hr=header?.getBoundingClientRect(),backUnderHeader=!!(hr&&overlaps(br,hr));
    return {scrollY,scrollWidth:document.documentElement.scrollWidth,bar:rect(bar),back:br,backVisible,backUnderHeader,sticky:getComputedStyle(bar).position,stickyTop:getComputedStyle(bar).top,marginTop:getComputedStyle(bar).marginTop,launcher:mr,bottomNav:bn,backOverlapsLauncher:!!(backVisible&&mr&&overlaps(br,mr)),backHit:!!(target&&(target===back||back.contains(target))),menuHit:!!(menuTarget&&(menuTarget===launcher||launcher.contains(menuTarget))),backOverlapsBottom:!!(backVisible&&bn&&overlaps(br,bn)),controls:controls.map(e=>({text:(e.innerText||e.getAttribute('aria-label')||'').trim(),...rect(e),font:parseFloat(getComputedStyle(e).fontSize),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,coveredByBottom:!!(bn&&overlaps(rect(e),bn))}))};
   });
   states.push(geometry);
   allRuns.push({viewport:name,scrollY:y,geometry});
   expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
   if(geometry.backVisible&&!geometry.backUnderHeader)expect(geometry.backHit).toBe(true);
   if(geometry.backOverlapsLauncher)expect(geometry.backUnderHeader&&geometry.menuHit).toBe(true);
   expect(geometry.menuHit).toBe(geometry.launcher!==null&&geometry.launcher.width>0);
   expect(geometry.backOverlapsBottom).toBe(false);
   expect(geometry.controls.every(c=>c.height>=44&&c.right<=width&&c.scrollWidth<=c.clientWidth+1)).toBe(true);
  if(y===0&&['320-portrait','390-portrait'].includes(name)){
    await page.screenshot({path:path.join(out,`${testInfo.project.name}-${name}-dark-opening.png`),fullPage:false});
    await page.locator('body').evaluate(node=>node.classList.remove('dark-theme'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const light=await page.evaluate(()=>{
     const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
     const back=document.querySelector('.directory-profile-back-btn'),menu=document.querySelector('#wh75MenuButton'),topbar=document.querySelector('#wh75MobileTopbar');
     const b=box(back),m=box(menu),h=box(topbar),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
     return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,back:b,menu:m,topbar:h,backHit:target&&(target===back||back.contains(target)),overlap:back.x<m.right&&back.right>m.x&&back.y<m.bottom&&back.bottom>m.y,name:document.querySelector('.directory-name-row')?.innerText||''};
    });
    expect(light.scrollWidth).toBeLessThanOrEqual(width);
    expect(light.backHit).toBe(true);
    expect(light.overlap).toBe(false);
    expect(light.name).toContain('Alexandria');
    allRuns.push({viewport:name,theme:'light',scrollY:0,geometry:light});
    await page.screenshot({path:path.join(out,`${testInfo.project.name}-${name}-light-opening.png`),fullPage:false});
    await page.locator('body').evaluate(node=>node.classList.add('dark-theme'));
   }
  }
 }
 // Bring the actual Care actions above the fixed navigation, then verify hit targets.
 await page.setViewportSize({width:320,height:640});
 const careTargets=page.locator('.directory-care-brief-actions button, .directory-care-more-actions > summary, .directory-care-more-actions-list button, .directory-care-more-actions-list summary');
 for(let index=0;index<await careTargets.count();index++){
  const control=careTargets.nth(index);
  if(await control.isVisible()){
   const label=(await control.innerText()).trim();
   await control.scrollIntoViewIfNeeded();
   const reach=await control.evaluate(element=>{
    const r=element.getBoundingClientRect(),header=document.querySelector('#wh75MobileTopbar')?.getBoundingClientRect(),footer=document.querySelector('#wh75MobileBottomNav')?.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return{top:r.top,bottom:r.bottom,height:r.height,clearOfHeader:!header||r.top>=header.bottom,clearOfFooter:!footer||r.bottom<=footer.top,hit:hit&&(hit===element||element.contains(hit))};
   });
   expect(reach.height,`${label} has a touch-sized target`).toBeGreaterThanOrEqual(44);
   expect(reach.clearOfHeader&&reach.clearOfFooter&&reach.hit,`${label} is scrollable into an unobstructed hit-test position: ${JSON.stringify(reach)}`).toBe(true);
  }
 }
 // Double the rendered font size on actual Care labels without changing wrapping or layout rules.
 await page.setViewportSize({width:320,height:640});
 let enlarged=await page.evaluate(()=>{
  const selectors=['.directory-profile-back-btn','.directory-profile-breadcrumb','.directory-profile-name','.directory-dog-name-btn','.directory-status-tag','.directory-dog-id'];
  const changed=[];
  for(const selector of selectors)for(const element of document.querySelectorAll(selector)){
   if(!element.getClientRects().length||getComputedStyle(element).visibility==='hidden')continue;
   const before=parseFloat(getComputedStyle(element).fontSize);
   element.dataset.phoneAuditBaseFont=String(before);
   element.dataset.phoneAuditInlineFont=element.style.getPropertyValue('font-size');
   element.dataset.phoneAuditInlinePriority=element.style.getPropertyPriority('font-size');
   element.style.setProperty('font-size',`${before*2}px`,'important');
   changed.push({selector,before,after:parseFloat(getComputedStyle(element).fontSize)});
  }
  return changed;
 });
  expect(enlarged.length).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('[data-phone-audit-base-font]')].every(element=>parseFloat(getComputedStyle(element).fontSize)>=parseFloat(element.dataset.phoneAuditBaseFont)*2)),{timeout:2000}).toBe(true);
 enlarged=await page.evaluate(()=>[...document.querySelectorAll('[data-phone-audit-base-font]')].map(element=>({label:(element.innerText||element.getAttribute('aria-label')||'').trim(),before:parseFloat(element.dataset.phoneAuditBaseFont),after:parseFloat(getComputedStyle(element).fontSize)})));
 expect(enlarged.every(x=>x.after>=x.before*2)).toBe(true);
 await page.locator('.directory-profile-back-btn').scrollIntoViewIfNeeded();
 const enlargedGeometry=await page.evaluate(()=>{const back=document.querySelector('.directory-profile-back-btn'),b=back.getBoundingClientRect(),m=document.querySelector('#wh75MenuButton'),r=m?.getBoundingClientRect(),header=document.querySelector('#wh75MobileTopbar')?.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {scrollWidth:document.documentElement.scrollWidth,menuPresent:!!(r&&r.width),overlap:!!(r&&b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top),backUnderHeader:!!(header&&b.left<header.right&&b.right>header.left&&b.top<header.bottom&&b.bottom>header.top),backHit:hit&&(hit===back||back.contains(hit))};});
 allRuns.push({viewport:'320-portrait-200-percent',geometry:{...enlargedGeometry,fonts:enlarged}});
 expect(enlargedGeometry.scrollWidth).toBeLessThanOrEqual(320);
 expect(enlargedGeometry.overlap).toBe(false);
 expect(enlargedGeometry.backUnderHeader).toBe(false);
 expect(enlargedGeometry.backHit).toBe(true);
 await page.screenshot({path:path.join(out,`${testInfo.project.name}-320-200-percent-dark.png`),fullPage:false});
 await page.evaluate(()=>{for(const element of document.querySelectorAll('[data-phone-audit-inline-font]')){element.style.setProperty('font-size',element.dataset.phoneAuditInlineFont,element.dataset.phoneAuditInlinePriority);delete element.dataset.phoneAuditInlineFont;delete element.dataset.phoneAuditInlinePriority;delete element.dataset.phoneAuditBaseFont;}});
 expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(1);
 fs.writeFileSync(path.join(out,`${testInfo.project.name}.json`),JSON.stringify(allRuns,null,2));
});
