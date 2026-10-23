const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const {install,bookings}=require('./fixtures/care-daily-workflows');

const viewports=[['320',320,640],['360',360,740],['375',375,812],['390',390,844],['412',412,915],['430',430,932],['768',768,1024],['800',800,1024],['820',820,1024],['821',821,1024],['landscape-667',667,320],['landscape-844',844,390]];

async function settle(page){
 await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true',null,{timeout:25000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
}

async function clickControl(page,menu){
 await expect(menu).toBeVisible();await expect(menu).toBeEnabled();
 await expect.poll(()=>menu.evaluate(button=>{
  const box=button.getBoundingClientRect(),hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
  return hit===button||button.contains(hit);
 }),{message:'control becomes reachable after its native open/close transition'}).toBe(true);
 const point=await menu.evaluate(button=>{
  const box=button.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2;
  const hit=document.elementFromPoint(x,y);
  return{x,y,reachable:hit===button||button.contains(hit),width:box.width,height:box.height};
 });
 expect(point.reachable,'the visible control centre receives pointer input').toBe(true);
 expect(point.width).toBeGreaterThanOrEqual(44);expect(point.height).toBeGreaterThanOrEqual(44);
 await page.mouse.click(point.x,point.y);
}

async function capture(page,info,name){
 const folder=path.join(__dirname,'..','output','phone-clearance-evidence','shared',info.project.name);
 fs.mkdirSync(folder,{recursive:true});
 const file=path.join(folder,name);
 await page.screenshot({path:file});
 await info.attach(name,{path:file,contentType:'image/png'});
}

async function textOverlaps(page){
 return page.evaluate(()=>{
  const text=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>/[\p{L}\p{N}]/u.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const visibleRect=r=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
  const unclipped=(parent,r)=>{
   const inside=(selector)=>!!parent.closest(selector);
   const closedDrawer=parent.closest('#wh75MobileDrawer'),closedSettings=parent.closest('#wh75SettingsPanel');
   if(closedDrawer&&!closedDrawer.classList.contains('is-open'))return false;
   if(closedSettings&&!closedSettings.classList.contains('is-open'))return false;
   for(const [backdrop,panel] of [['#wh75DrawerBackdrop','#wh75MobileDrawer'],['#wh75SettingsBackdrop','#wh75SettingsPanel']]){
    const blocker=document.querySelector(backdrop),rect=blocker?.getBoundingClientRect();
    if(blocker?.classList.contains('is-open')&&!inside(panel)&&rect&&r.left>=rect.left&&r.right<=rect.right&&r.top>=rect.top&&r.bottom<=rect.bottom)return false;
   }
   const topbar=document.querySelector('#wh75MobileTopbar'),header=topbar?.getBoundingClientRect();
   if(header&&!inside('#wh75MobileTopbar')&&header.width&&r.left>=header.left&&r.right<=header.right&&r.top>=header.top&&r.bottom<=header.bottom){
    const color=getComputedStyle(topbar).backgroundColor,alpha=color.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1];
    if(!alpha||Number(alpha)>=.99)return false;
   }
   const footer=document.querySelector('#wh75MobileBottomNav'),footerBox=footer?.getBoundingClientRect();
   if(footerBox&&!inside('#wh75MobileBottomNav')&&footerBox.width&&r.left>=footerBox.left&&r.right<=footerBox.right&&r.top>=footerBox.top&&r.bottom<=footerBox.bottom){
    const style=getComputedStyle(footer);
    if(Number(style.opacity)===1&&(/^rgb\(/.test(style.backgroundColor)||/rgba\([^)]*,\s*1\)$/.test(style.backgroundColor)))return false;
   }
   for(let ancestor=parent;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
    const style=getComputedStyle(ancestor),box=ancestor.getBoundingClientRect();
    if(style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;
    if(/hidden|clip|scroll|auto/.test(style.overflowX)&&(r.left<box.left-1||r.right>box.right+1))return false;
    if(/hidden|clip|scroll|auto/.test(style.overflowY)&&(r.top<box.top-1||r.bottom>box.bottom+1))return false;
    if(ancestor.tagName==='DETAILS'&&!ancestor.open&&!parent.closest('summary'))return false;
   }
   return true;
  };
  while(walker.nextNode()){
   const node=walker.currentNode, parent=node.parentElement;
   if(!parent||!parent.getClientRects().length||getComputedStyle(parent).visibility==='hidden')continue;
   const range=document.createRange();range.selectNodeContents(node);
   // Compare only pixels within the viewport. A line extending below a short
   // landscape viewport can otherwise evade the opaque footer's occlusion check.
   const rects=[...range.getClientRects()].filter(visibleRect).map(r=>{
    const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
    return{left,right,top,bottom,width:right-left,height:bottom-top};
   });
   if(rects.length)for(const r of rects)if(unclipped(parent,r))text.push({node,parent,rect:r,label:node.nodeValue.trim().replace(/\s+/g,' ').slice(0,70)});
  }
  const overlaps=[];
  text.sort((a,b)=>a.rect.left-b.rect.left);
  for(let i=0;i<text.length;i++)for(let j=i+1;j<text.length&&text[j].rect.left<text[i].rect.right;j++){
   const a=text[i],b=text[j];
   if(a.parent===b.parent||a.parent.contains(b.parent)||b.parent.contains(a.parent))continue;
   const x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left),y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
   if(x>1&&y>1)overlaps.push({a:a.label,b:b.label,intersection:[Math.round(x),Math.round(y)],at:[Math.round(Math.max(a.rect.left,b.rect.left)),Math.round(Math.max(a.rect.top,b.rect.top))]});
  }
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const nav=document.querySelector('#wh75MobileBottomNav');
  const targets=[...document.querySelectorAll('#wh75MenuButton,#wh75MobileBottomNav a,#wh75MobileBottomNav button,.wh65-btn,.wh69-view-btn,.fc-button,.app-tab-button')].filter(visible).map(e=>({label:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,50),...rect(e)}));
  const navRect=nav&&visible(nav)?rect(nav):null;
  const topbar=document.querySelector('#wh75MobileTopbar'),menu=document.querySelector('#wh75MenuButton');
  const brands=[...document.querySelectorAll('#whPalzStayMobileShellBrand,#whPalzStayMobileBrand')].filter(visible);
  const calendarToolbar=document.querySelector('.wh65-toolbar,.fc-header-toolbar');
  const toolbarButton=calendarToolbar?.querySelector('button');
  const toolbarButtonRect=toolbarButton?.getBoundingClientRect();
  const toolbarButtonHit=toolbarButtonRect&&document.elementFromPoint(toolbarButtonRect.left+toolbarButtonRect.width/2,toolbarButtonRect.top+toolbarButtonRect.height/2);
  return{viewport:{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,bodyPaddingBottom:getComputedStyle(document.body).paddingBottom},overlaps:overlaps.slice(0,30),labelCount:text.length,targets,navRect,
   topbar:topbar&&visible(topbar)?{...rect(topbar),zIndex:parseInt(getComputedStyle(topbar).zIndex,10)}:null,
   menu:menu&&visible(menu)?{...rect(menu),insideTopbar:!!(topbar&&topbar.contains(menu))}:null,
   brands:brands.map(e=>({id:e.id,...rect(e)})),
   calendarToolbar:calendarToolbar&&visible(calendarToolbar)?{...rect(calendarToolbar),buttonHit:!!(toolbarButtonHit&&(toolbarButtonHit===toolbarButton||toolbarButton.contains(toolbarButtonHit)))}:null};
 });
}

for(const [route,view] of [['today','today'],['calendar','calendar']])
test(`${route}: shared phone labels across phone, tablet and landscape viewports`,async({page,baseURL},info)=>{
 const fixture=await install(page,{bookingOverrides:[{stayId:bookings[0].stayId,dogName:'Alexandria Peterson-Smith-Wellington and Family',ownerName:'Morgan River-Davies',dogNumber:'#12345',source:'Referral from our exceptionally long campaign source',stayKey:'alexandria peterson-smith-wellington and family|2026-10-18|2026-10-20'}]});
  // Keep intentional periodic data polling outside the short resize-only read
  // assertion. The real callbacks still run throughout the layout journey;
  // resize handlers and their requests remain active in the measured window.
  await page.addInitScript(()=>{
   const nativeSetInterval=window.setInterval.bind(window);
   window.setInterval=(callback,delay,...args)=>typeof callback!=='function'
    ?nativeSetInterval(callback,delay,...args)
    :nativeSetInterval(()=>{if(!window.__phoneAuditPauseIntervals)callback(...args);},delay);
  });
  const runs=[];
   await page.goto(`${baseURL}/index.html?view=${view}&ownerWorkflowFixture=1`,{waitUntil:'domcontentloaded'});await settle(page);
   for(const [name,width,height] of viewports){
    await page.setViewportSize({width,height});
    for(const theme of ['light','dark']){
     await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),theme==='dark');
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    runs.push({route,viewport:name,theme,geometry:await textOverlaps(page)});
     const current=runs.at(-1).geometry;
     if(width<=820){
      expect(current.topbar,`${route} ${name} has the mobile brand header`).not.toBeNull();
      expect(current.menu?.insideTopbar,`${route} ${name} keeps the menu in the shared header`).toBe(true);
      expect(current.menu.x).toBeGreaterThanOrEqual(current.topbar.x);
      expect(current.menu.right).toBeLessThanOrEqual(width);
      expect(current.brands,`${route} ${name} shows one brand`).toHaveLength(1);
      expect(current.brands[0].x).toBeGreaterThanOrEqual(current.menu.right+8);
      expect(current.brands[0].right).toBeLessThanOrEqual(width-8);
     }else{
      expect(current.topbar,`${route} ${name} restores the desktop header layout`).toBeNull();
      expect(current.menu).toBeNull();
     }
     if(name==='390'&&theme==='light')await capture(page,info,`${route}-390.png`);
     if(name==='320')await capture(page,info,`${route}-320-${theme}-opening.png`);
     const menu=page.locator('#wh75MenuButton');
     if(name==='320'&&theme==='dark'&&await menu.isVisible()){
      await clickControl(page,page.locator('#wh75MenuButton'));await expect(page.locator('#wh75MobileDrawer')).toHaveClass(/is-open/);
      runs.push({route:`${route}-menu`,viewport:name,theme,geometry:await textOverlaps(page)});
      await page.keyboard.press('Escape');
      await expect(page.locator('#wh75MobileDrawer')).not.toHaveClass(/is-open/);
     }
    }
    // From deep scroll, return the real Calendar controls to a usable position.
    if(route==='calendar'&&name==='320'){
     await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
     await expect.poll(()=>page.evaluate(()=>{
      const toolbar=document.querySelector('.wh65-toolbar');
      if(!toolbar)return false;
      toolbar.scrollIntoView({block:'center',behavior:'instant'});
      const button=toolbar.querySelector('button'),r=button?.getBoundingClientRect(),hit=r&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!(hit&&(hit===button||button.contains(hit)));
     }),{timeout:10000}).toBe(true);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     runs.push({route:'calendar-scrolled',viewport:name,theme:'dark',geometry:await textOverlaps(page)});
     const toolbar=runs.at(-1).geometry.calendarToolbar,header=runs.at(-1).geometry.topbar;
     expect(toolbar,'Calendar toolbar can be scrolled clear of the mobile header').not.toBeNull();
     expect(toolbar.top).toBeGreaterThanOrEqual((header?.bottom||0)-1);
     expect(toolbar.bottom).toBeLessThanOrEqual(height);
     expect(toolbar.buttonHit).toBe(true);
     await page.evaluate(()=>window.scrollTo(0,0));
    }
    if(route==='calendar'&&name==='390'){
     await page.evaluate(()=>document.body.classList.remove('dark-theme'));
    const add=page.locator('#openPotentialBtn');
    if(await add.isVisible()){
      await add.click();await page.waitForTimeout(100);
      runs.push({route:'add-form',viewport:name,theme:'light',geometry:await textOverlaps(page)});
      await capture(page,info,`${name}-add.png`);
      await page.keyboard.press('Escape');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     }
    }
   }
   for(const [name,width,height] of [['320',320,640],['landscape-667',667,320]]){
    await page.setViewportSize({width,height});
    for(const theme of ['light','dark']){
     await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),theme==='dark');
     let fonts=await page.evaluate(()=>{
      const selectors=['#wh75MenuButton','#wh75MobileBottomNav a','#wh75MobileBottomNav button','.wh65-btn,.wh69-view-btn,.fc-button','.app-tab-button','[aria-label*="filter" i]','[data-filter]'];
      const changed=[];
      const seen=new Set();
      for(const selector of selectors)for(const element of document.querySelectorAll(selector)){
       if(!element.getClientRects().length||getComputedStyle(element).visibility==='hidden')continue;
       if(seen.has(element))continue;seen.add(element);
       const before=parseFloat(getComputedStyle(element).fontSize);
       element.dataset.phoneAuditBaseFont=String(before);
       element.dataset.phoneAuditInlineFont=element.style.getPropertyValue('font-size');
       element.dataset.phoneAuditInlinePriority=element.style.getPropertyPriority('font-size');
       element.style.setProperty('font-size',`${before*2}px`,'important');
       changed.push({label:(element.innerText||element.getAttribute('aria-label')||'').trim(),before,after:parseFloat(getComputedStyle(element).fontSize)});
      }
      return changed;
     });
     await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('[data-phone-audit-base-font]')].every(element=>parseFloat(getComputedStyle(element).fontSize)>=parseFloat(element.dataset.phoneAuditBaseFont)*2)),{timeout:2000}).toBe(true);
     fonts=await page.evaluate(()=>[...document.querySelectorAll('[data-phone-audit-base-font]')].map(element=>({label:(element.innerText||element.getAttribute('aria-label')||'').trim(),before:parseFloat(element.dataset.phoneAuditBaseFont),after:parseFloat(getComputedStyle(element).fontSize)})));
     await expect.poll(()=>page.evaluate(()=>{const nav=document.querySelector('#wh75MobileBottomNav');return nav&&parseFloat(getComputedStyle(document.body).paddingBottom)>=nav.getBoundingClientRect().height-1}),{timeout:2000}).toBe(true);
     expect(fonts.length,`${route} has critical labels at ${name}`).toBeGreaterThan(0);
     expect(fonts.every(font=>font.after>=font.before*2),JSON.stringify(fonts)).toBe(true);
     const geometry=await textOverlaps(page);
     runs.push({route:`${route}-200-percent`,viewport:name,theme,geometry,fonts});
     const criticalLabels=await page.evaluate(()=>{
      const elements=[...document.querySelectorAll('#wh75MobileBottomNav a,#wh75MobileBottomNav button,.directory-roster-filters button,.wh65-btn,.wh69-view-btn,.fc-button,[data-filter]')].filter(element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');
      return elements.map(element=>{
       const box=element.getBoundingClientRect(),walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),lines=[];
       while(walker.nextNode()){const node=walker.currentNode;if(!node.nodeValue.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width&&rect.height)lines.push({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,text:node.nodeValue.trim()});}
       const labelElement=element.querySelector(':scope > span:last-child'),labelStyle=labelElement&&getComputedStyle(labelElement);
       return{label:(element.innerText||element.getAttribute('aria-label')||'').trim().slice(0,60),box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},lines,fullyContained:lines.every(line=>line.left>=box.left-1&&line.right<=box.right+1&&line.top>=box.top-1&&line.bottom<=box.bottom+1),labelHtml:labelElement?.outerHTML,style:labelStyle&&{width:labelStyle.width,maxWidth:labelStyle.maxWidth,minWidth:labelStyle.minWidth,whiteSpace:labelStyle.whiteSpace,overflowWrap:labelStyle.overflowWrap,fontSize:labelStyle.fontSize},matchesExpected:!!labelElement&&labelElement.matches('.wh75-bottom-item > span:last-child')};
      }).filter(item=>item.label);
     });
     runs.at(-1).criticalLabels=criticalLabels;
     fs.writeFileSync(path.join(info.outputDir,`${info.project.name}-phone-layout-partial.json`),JSON.stringify({fixtureReads:fixture.reads,runs},null,2));
     expect(criticalLabels.length,`${route} critical controls have visible text labels`).toBeGreaterThan(0);
     expect(criticalLabels.every(item=>item.lines.length>0&&item.fullyContained),JSON.stringify(criticalLabels)).toBe(true);
     if(width<=820&&geometry.navRect)expect(parseFloat(geometry.viewport.bodyPaddingBottom)).toBeGreaterThanOrEqual(geometry.navRect.height-1);
     if(name==='320')await capture(page,info,`${route}-200-${theme}-320.png`);
     else await capture(page,info,`${route}-200-${theme}-667-landscape.png`);
     expect(geometry.viewport.docWidth).toBeLessThanOrEqual(width+1);
     const defects=geometry.overlaps.map(item=>({route:`${route}-200-percent`,viewport:name,theme,...item}));
     expect(defects,JSON.stringify(defects)).toEqual([]);
     await page.evaluate(()=>{for(const element of document.querySelectorAll('[data-phone-audit-inline-font]')){element.style.setProperty('font-size',element.dataset.phoneAuditInlineFont,element.dataset.phoneAuditInlinePriority);delete element.dataset.phoneAuditInlineFont;delete element.dataset.phoneAuditInlinePriority;delete element.dataset.phoneAuditBaseFont;}});
    }
   }
   // Cross the desktop breakpoint and return to verify the mobile shell reuses one live menu button.
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('#wh75MobileTopbar')).toHaveCount(1);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const mobileNodes=await page.evaluate(()=>{
    window.__phoneAuditMenu=document.querySelector('#wh75MenuButton');
    window.__phoneAuditBrand=document.querySelector('#whPalzStayMobileShellBrand')||document.querySelector('#whPalzStayMobileBrand');
    return{menu:!!window.__phoneAuditMenu,brand:!!window.__phoneAuditBrand};
   });
   expect(mobileNodes).toEqual({menu:true,brand:true});
   await page.evaluate(()=>{window.__phoneAuditPauseIntervals=true;});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
   const readsBeforeResize=fixture.reads.length;
   await page.setViewportSize({width:821,height:1024});
   await expect(page.locator('#wh75MobileTopbar')).toHaveCount(0);
   await expect(page.locator('#wh75MenuButton')).toBeHidden();
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('#wh75MobileTopbar')).toHaveCount(1);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.evaluate(()=>{
    window.__phoneAuditMutations=[];
    window.__phoneAuditObserver=new MutationObserver(records=>window.__phoneAuditMutations.push(...records.map(record=>({type:record.type,target:record.target.id||record.target.tagName,attribute:record.attributeName}))));
    window.__phoneAuditObserver.observe(document.querySelector('#wh75MobileTopbar'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    window.__phoneAuditObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    window.WAFFLE_SITTER_NAVIGATION.maintain();
    window.WAFFLE_SITTER_NAVIGATION.maintain();
   });
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
   const repeatedResizeMutations=await page.evaluate(()=>{window.__phoneAuditObserver.disconnect();return window.__phoneAuditMutations;});
   expect(repeatedResizeMutations,`${route} repeated header maintenance does not mutate the header or body classes`).toEqual([]);
   expect(fixture.reads.length,`${route} resize does not add backend reads: ${JSON.stringify(fixture.reads.slice(readsBeforeResize))}`).toBe(readsBeforeResize);
   await page.evaluate(()=>{window.__phoneAuditPauseIntervals=false;});
   const restored=await page.evaluate(()=>({menuSame:window.__phoneAuditMenu===document.querySelector('#wh75MenuButton'),brandSame:window.__phoneAuditBrand===(document.querySelector('#whPalzStayMobileShellBrand')||document.querySelector('#whPalzStayMobileBrand')),brandCount:[...document.querySelectorAll('#whPalzStayMobileShellBrand,#whPalzStayMobileBrand')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').length}));
   expect(restored).toEqual({menuSame:true,brandSame:true,brandCount:1});
   const menu=page.locator('#wh75MenuButton');
   await clickControl(page,page.locator('#wh75MenuButton'));
   await expect(page.locator('#wh75MobileDrawer')).toHaveClass(/is-open/);
   const drawerLayers=await page.evaluate(()=>{
    const topbar=document.querySelector('#wh75MobileTopbar'),drawer=document.querySelector('#wh75MobileDrawer'),backdrop=document.querySelector('#wh75DrawerBackdrop');
    const x=innerWidth-8,y=topbar.getBoundingClientRect().top+topbar.getBoundingClientRect().height/2;
    return{topbarZ:+getComputedStyle(topbar).zIndex,drawerZ:+getComputedStyle(drawer).zIndex,backdropZ:+getComputedStyle(backdrop).zIndex,backdropOpen:backdrop.classList.contains('is-open'),rightHeaderHit:document.elementFromPoint(x,y)===backdrop};
   });
   expect(drawerLayers.drawerZ).toBeGreaterThan(drawerLayers.topbarZ);
   expect(drawerLayers.backdropZ).toBeGreaterThan(drawerLayers.topbarZ);
   expect(drawerLayers.backdropOpen&&drawerLayers.rightHeaderHit).toBe(true);
   await clickControl(page,page.locator('#wh75MobileDrawer [data-wh75-settings]'));
   await expect(page.locator('#wh75SettingsPanel')).toBeVisible();
   // This panel retains a layout box while closed. Visibility alone does
   // not establish that the pointer action opened it and its backdrop.
   await expect(page.locator('#wh75SettingsPanel')).toHaveClass(/is-open/);
   await expect(page.locator('#wh75SettingsBackdrop')).toHaveClass(/is-open/);
   const settingsLayers=await page.evaluate(()=>({topbarZ:+getComputedStyle(document.querySelector('#wh75MobileTopbar')).zIndex,backdropZ:+getComputedStyle(document.querySelector('#wh75SettingsBackdrop')).zIndex,panelZ:+getComputedStyle(document.querySelector('#wh75SettingsPanel')).zIndex,backdropOpen:document.querySelector('#wh75SettingsBackdrop').classList.contains('is-open')}));
   expect(settingsLayers.backdropZ).toBeGreaterThan(settingsLayers.topbarZ);
   expect(settingsLayers.panelZ).toBeGreaterThan(settingsLayers.topbarZ);
   expect(settingsLayers.backdropOpen).toBe(true);
   await page.keyboard.press('Escape');
   const settingsClosed=page.locator('#wh75SettingsPanel');
   await expect(settingsClosed).not.toHaveClass(/is-open/);
   await expect.poll(()=>settingsClosed.evaluate(panel=>{const r=panel.getBoundingClientRect(),s=getComputedStyle(panel);return s.pointerEvents==='none'||Number(s.opacity)===0||r.bottom<=0||r.top>=innerHeight}),{timeout:2000}).toBe(true);
  const output=path.join(__dirname,'..','output','phone-clearance-evidence','shared');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,`${info.project.name}-${route}.json`),JSON.stringify({fixtureReads:fixture.reads,runs},null,2));
  const defects=runs.flatMap(run=>run.geometry.overlaps.map(overlap=>({route:run.route,viewport:run.viewport,theme:run.theme,...overlap})));
  console.log(`PHONE_LABEL_AUDIT ${JSON.stringify({runs:runs.length,routes:[...new Set(runs.map(r=>r.route))],defects})}`);
  expect(runs.every(run=>run.geometry.viewport.docWidth<=run.geometry.viewport.width+1),'No viewport should have horizontal overflow').toBe(true);
  expect(defects,JSON.stringify(defects.slice(0,20))).toEqual([]);
});

test('three digit booking count stays readable at 200 percent text size',async({page,baseURL},info)=>{
 const fixture=await install(page,{bookingOverrides:[{stayId:bookings[1].stayId,startDate:'2026-10-20',endDate:'2026-10-22',stayKey:'milo|2026-10-20|2026-10-22'}]});
 await page.setViewportSize({width:320,height:640});
 await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`,{waitUntil:'domcontentloaded'});
 await settle(page);
 await page.locator('[data-v1082-stay-tab="future"]').click();
 let status=page.locator('#v1082FutureStayCount');
 await expect(status).toBeVisible();
 await expect(status).toHaveText('1');
 // Keep synthetic layout text separate from runtime refreshes, which correctly
 // restore the real count. Reuse the rendered markup, production styles and
 // actual allocated width; no component layout styles are replaced in this fixture.
 const layout=await page.evaluate(()=>({
  markup:document.querySelector('.directory-roster-filters').outerHTML,
  width:document.querySelector('.directory-roster-filters').getBoundingClientRect().width,
  styles:[...document.querySelectorAll('head style,head link[rel="stylesheet"]')].map(element=>element.outerHTML).join('\n'),
  root:[...document.documentElement.attributes].map(attribute=>[attribute.name,attribute.value]),
  body:[...document.body.attributes].map(attribute=>[attribute.name,attribute.value])
 }));
 const runtimePage=page;
 page=await runtimePage.context().newPage();
 await page.setViewportSize({width:320,height:640});
 await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${baseURL}/">${layout.styles}</head><body></body></html>`,{waitUntil:'load'});
 await page.evaluate(layout=>{
  for(const [name,value] of layout.root)document.documentElement.setAttribute(name,value);
  for(const [name,value] of layout.body)document.body.setAttribute(name,value);
  const host=document.createElement('main');host.id='directoryTabPanel';
  host.style.width=`${layout.width}px`;host.style.maxWidth='100%';host.style.marginInline='auto';
  host.innerHTML=layout.markup;document.body.appendChild(host);
 },layout);
 await runtimePage.close();
 status=page.locator('#v1082FutureStayCount');
 await expect(status).toBeVisible();
 expect(await page.locator('.directory-roster-filters').evaluate(element=>element.getBoundingClientRect().width)).toBeCloseTo(layout.width,1);
 for(const theme of ['light','dark']){
  await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),theme==='dark');
  const fonts=await page.evaluate(()=>{
   // Stress the real count badge without rendering 123 unrelated Care profiles.
   document.querySelector('#v1082FutureStayCount').textContent='123';
   const nodes=[...document.querySelectorAll('.directory-roster-filters button strong,.directory-roster-filters button > span:first-child,.directory-roster-filters .v1086-stay-tab-count')].filter(element=>!element.childElementCount&&element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');
   return nodes.map(element=>{
    const before=parseFloat(getComputedStyle(element).fontSize);
    element.dataset.phoneAuditBaseFont=String(before);
    element.dataset.phoneAuditInlineFont=element.style.getPropertyValue('font-size');
    element.dataset.phoneAuditInlinePriority=element.style.getPropertyPriority('font-size');
    element.style.setProperty('font-size',`${before*2}px`,'important');
    return{text:element.textContent.trim(),before};
   });
  });
  expect(fonts.some(font=>font.text==='123')).toBe(true);
  await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('[data-phone-audit-base-font]')].every(element=>parseFloat(getComputedStyle(element).fontSize)>=Number(element.dataset.phoneAuditBaseFont)*2)),{timeout:2000}).toBe(true);

  const geometry=await textOverlaps(page);
  expect(geometry.viewport.docWidth).toBeLessThanOrEqual(321);
  if(geometry.navRect)expect(parseFloat(geometry.viewport.bodyPaddingBottom)).toBeGreaterThanOrEqual(geometry.navRect.height-1);
  expect(geometry.overlaps,JSON.stringify(geometry.overlaps)).toEqual([]);
  const labels=await page.locator('[data-phone-audit-base-font]').evaluateAll(elements=>elements.map(element=>{
   const box=element.getBoundingClientRect(),button=element.closest('button').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(element);
   return{text:element.textContent.trim(),contained:[...range.getClientRects()].every(r=>r.left>=box.left-1&&r.right<=box.right+1&&r.top>=button.top-1&&r.bottom<=button.bottom+1)};
  }));
  await capture(page,info,`123-count-200-${theme}-320.png`);
  expect(labels.some(label=>label.text==='123')).toBe(true);
  expect(labels.every(label=>label.contained),JSON.stringify(labels)).toBe(true);
  await page.evaluate(()=>{for(const element of document.querySelectorAll('[data-phone-audit-base-font]')){element.style.setProperty('font-size',element.dataset.phoneAuditInlineFont,element.dataset.phoneAuditInlinePriority);delete element.dataset.phoneAuditInlineFont;delete element.dataset.phoneAuditInlinePriority;delete element.dataset.phoneAuditBaseFont;}});
 }
 expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(0);
 await page.close();
});
