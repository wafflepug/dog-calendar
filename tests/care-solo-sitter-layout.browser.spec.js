const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {install,bookings}=require('./fixtures/care-daily-workflows');

function contrastRatio(foreground,background){
  const luminance=color=>{
    const values=color.match(/[\d.]+/g).slice(0,3).map(Number);
    const channels=(color.startsWith('color(srgb')?values.map(value=>value*255):values).map(value=>{
      const channel=value/255;
      return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
    });
    return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
  };
  const [light,dark]=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (light+0.05)/(dark+0.05);
}

async function openMilo(page,baseURL){
  await install(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?soloSitterLayoutFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_INTAKE_STATUS);
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state','fresh');
  return card;
}

test('selected guest controls stay compact, readable and usable at phone and desktop widths',async({page,baseURL},info)=>{
  const card=await openMilo(page,baseURL);
  const backBar=page.locator('#directoryProfileBackBar');
  const freshness=card.locator('[data-care-brief-freshness]');
  const disclosure=freshness.locator('details');
  const emergency=card.locator('[data-care-brief-action="emergency-contact"]');
  const handover=card.locator('[data-care-brief-action="handover"]');

  for(const width of [320,390,1440])for(const dark of [false,true]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
    await expect(backBar).toBeVisible();
    await expect(backBar.locator('#directoryBackToGuestsBtn')).toBeVisible();
    const layout=await page.evaluate(()=>{
      const bar=document.querySelector('#directoryProfileBackBar');
      const controls=[...bar.querySelectorAll('button')].filter(button=>button.getClientRects().length>0);
      const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      return {scrollWidth:document.documentElement.scrollWidth,innerWidth,bar:box(bar),controls:controls.map(box)};
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(width+1);
    for(const rect of layout.controls)expect(rect.height).toBeGreaterThanOrEqual(43.99);
    expect(layout.bar.height).toBeLessThan(150);
    for(const control of [emergency,handover]){
      await expect(control).toBeVisible();
      expect(await control.evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43.99);
      await expect.poll(async()=>{
      const colors=await control.evaluate(node=>{
        const layers=[];
        for(let parent=node;parent;parent=parent.parentElement){
          const color=getComputedStyle(parent).backgroundColor;
          if(color==='transparent')continue;
          const values=color.match(/[\d.]+/g)?.map(Number)||[];
          if(values.length<3)continue;
          const srgb=color.startsWith('color(srgb');
          const rgb=(srgb?values.slice(0,3).map(value=>value*255):values.slice(0,3));
          const alpha=color.includes('/')?values[3]:(color.startsWith('rgba(')?values[3]:1);
          if(alpha>0)layers.push({rgb,alpha});
        }
        let composite=[255,255,255];
        for(const layer of layers.reverse())composite=layer.rgb.map((channel,index)=>channel*layer.alpha+composite[index]*(1-layer.alpha));
        const background=`rgb(${composite.map(value=>Math.round(value)).join(', ')})`;
        return {foreground:getComputedStyle(node).color,background};
      });
      return contrastRatio(colors.foreground,colors.background);
      },{message:`Stable ${dark?'dark':'light'} ${width}px action contrast`}).toBeGreaterThanOrEqual(4.5);
    }
    expect(await card.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    const alignment=await card.evaluate(card=>{
      const briefHeading=card.querySelector('.directory-care-brief-heading');
      const title=briefHeading?.firstElementChild;
      const freshness=briefHeading?.querySelector('.directory-care-brief-freshness');
      const safety=card.querySelector('.directory-care-brief-safety');
      const safetyTitle=safety?.querySelector('.directory-care-brief-note-heading h4');
      const flags=safety?.querySelector('[data-care-brief-safety]');
      const emergency=safety?.querySelector('[data-care-brief-action="emergency-contact"]');
      const box=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,centerY:(r.top+r.bottom)/2}};
      return {title:box(title),freshness:box(freshness),safetyTitle:box(safetyTitle),flags:box(flags),emergency:box(emergency),titleAlign:getComputedStyle(title).textAlign,freshnessAlign:getComputedStyle(freshness).textAlign};
    });
    expect(alignment.titleAlign).toBe('left');
    expect(alignment.freshnessAlign).toBe('left');
    expect(alignment.freshness.left).toBeGreaterThanOrEqual(alignment.title.left-0.01);
    if(width>=769){
      expect(alignment.safetyTitle.centerY).toBeCloseTo(alignment.flags.centerY,0);
      expect(alignment.flags.centerY).toBeCloseTo(alignment.emergency.centerY,0);
      expect(alignment.safetyTitle.left).toBeLessThan(alignment.flags.left);
      expect(alignment.flags.right).toBeLessThan(alignment.emergency.left);
    }else{
      expect(alignment.safetyTitle.centerY).toBeCloseTo(alignment.emergency.centerY,0);
      expect(alignment.flags.top).toBeGreaterThanOrEqual(Math.max(alignment.safetyTitle.bottom,alignment.emergency.bottom)-0.01);
    }

    if(process.env.WAFFLE_CAPTURE_SOLO==='1'&&info.project.name==='chromium-390'){
      const screenshotDir=path.resolve(__dirname,'../output/solo-sitter-six/screenshots');
      fs.mkdirSync(screenshotDir,{recursive:true});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({
        path:path.join(screenshotDir,`solo-layout-${width}-${dark?'dark':'light'}.png`)
      });
    }
  }

  const savedStyle=await freshness.evaluate(node=>({border:getComputedStyle(node).borderTopWidth,background:getComputedStyle(node).backgroundColor}));
  expect(savedStyle.border).toBe('0px');
  const summary=disclosure.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open','');
  await expect(disclosure.locator('[data-care-brief-freshness-detail]')).toBeVisible();
  await expect(disclosure.locator('small')).toContainText('does not confirm care instructions were reviewed');
  expect(await summary.evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43.99);

  for(const state of ['offline','error','identity-conflict']){
    await freshness.evaluate((node,state)=>{node.dataset.state=state;},state);
    const warning=await freshness.evaluate(node=>({visible:node.getBoundingClientRect().height>0,border:getComputedStyle(node).borderTopWidth,color:getComputedStyle(node).color}));
    expect(warning.visible).toBe(true);
    expect(parseFloat(warning.border)).toBeGreaterThan(0);
    expect(warning.color).not.toBe(savedStyle.background);
  }
});

test('sitter summary fallback stays hidden until revealed and remains readable',async({page,baseURL})=>{
  const card=await openMilo(page,baseURL);
  const output=card.locator('[data-care-sitter-summary-output]');
  const manual=output.locator('[data-care-sitter-summary-manual]');
  await expect(output).toBeHidden();
  await expect(manual).toBeHidden();

  await page.evaluate(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('clipboard unavailable in fixture')}}});
  });
  const more=card.locator('.directory-care-more-actions');
  await more.locator(':scope > summary').click();
  const copy=card.locator('[data-care-sitter-summary="copy"]');
  await copy.scrollIntoViewIfNeeded();
  await copy.click();
  await expect(output).toBeVisible();
  await expect(manual).toBeVisible();
  await expect(manual).toHaveValue(/Milo/);
  const layout=await manual.evaluate(node=>({fontSize:parseFloat(getComputedStyle(node).fontSize),width:node.getBoundingClientRect().width,parent:node.parentElement.getBoundingClientRect().width,overflow:node.scrollWidth<=node.clientWidth+1,readOnly:node.readOnly}));
  expect(layout.fontSize).toBeGreaterThanOrEqual(16);
  expect(layout.width).toBeLessThanOrEqual(layout.parent+0.01);
  expect(layout.overflow).toBe(true);
  expect(layout.readOnly).toBe(true);
  const selectedText=await manual.evaluate(node=>{node.focus();node.select();return {start:node.selectionStart,end:node.selectionEnd,length:node.value.length}});
  expect(selectedText).toMatchObject({start:0,end:selectedText.length});
});

test('Emergency details opens health read-only and handover opens the matching note editor',async({page,baseURL})=>{
  const card=await openMilo(page,baseURL);
  const healthHome=card.locator('[data-profile-subtab="healthHome"]');
  const emergency=card.locator('[data-care-brief-action="emergency-contact"]');
  await emergency.scrollIntoViewIfNeeded();
  await emergency.click();
  await expect(healthHome).toHaveAttribute('aria-expanded','true');
  await expect(card).not.toHaveClass(/is-profile-editing/);
  await expect(page.locator('#guestDetailEditModal')).not.toHaveClass(/open/);

  const handover=card.locator('[data-care-brief-action="handover"]');
  await handover.scrollIntoViewIfNeeded();
  await handover.click();
  const editor=page.locator('#guestDetailEditModal');
  const textarea=page.locator('#guestDetailEditTextarea');
  const notesTrigger=card.locator('[data-directory-edit-field="notes"]');
  await expect(editor).toHaveClass(/open/);
  await expect(page.locator('#guestDetailEditTitle')).toContainText('Handover note');
  await expect(page.locator('#guestDetailEditDog')).toContainText('Milo');
  await expect(textarea).toHaveValue('Call before pickup.');
  await textarea.fill('Fixture draft to keep after cancel.');
  await expect(page.locator('#guestDetailEditStatus')).toContainText('Unsaved changes');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('#cancelGuestDetailEdit').click();
  await expect(editor).toHaveClass(/open/);
  await expect(textarea).toHaveValue('Fixture draft to keep after cancel.');
  await expect(page.locator('#guestDetailEditStatus')).toContainText('Unsaved changes');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#cancelGuestDetailEdit').click();
  await expect(editor).not.toHaveClass(/open/);
  await expect(handover).toBeFocused();

  await handover.scrollIntoViewIfNeeded();
  await handover.click();
  await expect(editor).toHaveClass(/open/);
  await expect(textarea).toHaveValue('Call before pickup.');
  await page.locator('#cancelGuestDetailEdit').click();
  await expect(editor).not.toHaveClass(/open/);
  await expect(handover).toBeFocused();
});


test('Care note editor identifies the dog, focuses its label and grows without hiding phone actions',async({page,baseURL})=>{
  const card=await openMilo(page,baseURL);
  await card.locator('[data-care-brief-action="handover"]').click();
  const note=page.locator('#guestDetailEditTextarea');
  await expect(page.locator('#guestDetailEditDog')).toContainText('#00017');
  await expect(page.locator('#guestDetailEditLabel')).toHaveAttribute('for','guestDetailEditTextarea');
  await expect(note).toBeFocused();
  await expect(note).toHaveAttribute('maxlength','2000');
  await page.locator('#guestDetailEditLabel').click();
  await expect(note).toBeFocused();
  const initial=await note.evaluate(node=>node.getBoundingClientRect().height);
  const draft=Array.from({length:30},(_,i)=>`Line ${i}: Keep all of this handover detail.`).join('\n');
  await note.fill(draft);
  await expect(note).toHaveValue(draft);
  expect(await note.evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThan(initial);
  expect(await note.evaluate(node=>node.getBoundingClientRect().height)).toBeLessThanOrEqual(260);
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:568});
    const save=page.locator('#saveGuestDetailEdit');
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await note.fill('Short note');
  expect(await note.evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(initial+10);
});

test('Care editor shortcuts respect IME, repeat, dirty state and actual Save failure',async({page,baseURL})=>{
  const card=await openMilo(page,baseURL);
  let writes=0;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    let payload={};try{payload=JSON.parse(url.searchParams.get('payload')||'{}');}catch(_){}
    if(payload.action!=='update_guest_detail')return route.fallback();
    writes++;
    await route.fulfill({status:200,contentType:'application/javascript',body:`${url.searchParams.get('callback')}(${JSON.stringify({result:'error',error:'Fixture unavailable; draft remains safe.'})});`});
  });
  await card.locator('[data-care-brief-action="handover"]').click();
  const note=page.locator('#guestDetailEditTextarea');
  await note.press('Control+Enter');
  expect(writes).toBe(0);
  await note.fill('Draft retained after unavailable service.');
  for(const options of [{ctrlKey:true,isComposing:true},{ctrlKey:true,repeat:true},{ctrlKey:true,altKey:true},{ctrlKey:false}]){
    await note.dispatchEvent('keydown',{key:'Enter',bubbles:true,...options});
  }
  expect(writes).toBe(0);
  await page.locator('#cancelGuestDetailEdit').focus();
  await page.locator('#cancelGuestDetailEdit').press('Control+Enter');
  expect(writes).toBe(0);
  await note.focus();
  await note.press('Meta+Enter');
  await expect.poll(()=>writes).toBe(1);
  await expect(page.locator('#guestDetailEditStatus')).toContainText('Fixture unavailable');
  await expect(note).toHaveValue('Draft retained after unavailable service.');
  await expect(page.locator('#saveGuestDetailEdit')).toBeEnabled();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#cancelGuestDetailEdit').click();
  await card.locator('[data-directory-edit-field="phone"]').evaluate(node=>node.click());
  const phone=page.locator('#guestDetailEditInput');
  await phone.fill('+61 400 000 123');
  await phone.press('Enter');
  await expect.poll(()=>writes).toBe(2);
  await expect(page.locator('#guestDetailEditStatus')).toContainText('Fixture unavailable');
  await expect(phone).toHaveValue('+61 400 000 123');
});


test('Care editor resets field input hints and cancelled focus never returns to a hidden field',async({page,baseURL})=>{
  const card=await openMilo(page,baseURL);
  await page.evaluate(()=>{
    const original=window.setTimeout;
    window.__editorFocusJobs=[];
    window.setTimeout=function(callback,delay,...args){
      if(delay===30){window.__editorFocusJobs.push(()=>callback(...args));return -1;}
      return original(callback,delay,...args);
    };
  });
  await card.locator('[data-care-brief-action="handover"]').click();
  await page.locator('#cancelGuestDetailEdit').click();
  await page.evaluate(()=>window.__editorFocusJobs.splice(0).forEach(job=>job()));
  await expect(card.locator('[data-care-brief-action="handover"]')).toBeFocused();
  // Programmatic button activation also covers editing from the profile action surface.
  await card.locator('[data-directory-edit-field="phone"]').evaluate(node=>node.click());
  const input=page.locator('#guestDetailEditInput');
  await expect(input).toHaveAttribute('type','tel');
  await expect(input).toHaveAttribute('inputmode','tel');
  await expect(input).toHaveAttribute('autocomplete','off');
  await page.locator('#cancelGuestDetailEdit').focus();
  await page.evaluate(()=>window.__editorFocusJobs.splice(0).forEach(job=>job()));
  await expect(page.locator('#cancelGuestDetailEdit')).toBeFocused();
  await page.locator('#cancelGuestDetailEdit').click();
  await card.locator('[data-directory-edit-field="ownerName"]').evaluate(node=>node.click());
  await expect(input).toHaveAttribute('type','text');
  await expect(input).toHaveAttribute('inputmode','text');
  await expect(page.locator('#guestDetailEditLabel')).toHaveAttribute('for','guestDetailEditInput');
  await page.locator('#guestDetailEditLabel').click();
  await expect(input).toBeFocused();
});

test('profile heading, contact and action rows align with received form status and enlarged text',async({page,baseURL},info)=>{
  const fixture=await install(page);
  await page.goto(`${baseURL}/directory.html?careAlignmentFixture=1`,{waitUntil:'domcontentloaded'});
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state','fresh');
  await expect(card.locator('[data-compact-intake-status]')).toHaveText('Form received');
  const reads=fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action));
  const more=card.locator('.directory-care-more-actions');
  await more.locator(':scope > summary').click();
  const secondary=more.locator(':scope > .directory-care-more-actions-list > [data-p4-dir="again"], :scope > .directory-care-more-actions-list > [data-owner-care-sharing-options]');
  await expect(secondary).toHaveCount(2);
  for(const dark of [false,true])for(const scale of [1,2]){
    await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
    await card.evaluate((card,scale)=>{
      for(const node of card.querySelectorAll('.directory-care-brief-heading h3,.directory-care-brief-freshness summary,.directory-care-brief-note-heading h4,[data-care-brief-owner-name],.directory-care-owner-phone,.directory-care-brief-actions button,[data-care-brief-call-owner] a')){
        if(!node.dataset.alignmentFont)node.dataset.alignmentFont=parseFloat(getComputedStyle(node).fontSize);
        node.style.fontSize=`${Number(node.dataset.alignmentFont)*scale}px`;
      }
    },scale);
    const geometry=await card.evaluate(card=>{
      const box=selector=>{const node=card.querySelector(selector),r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
      return {overflow:card.scrollWidth>card.clientWidth+1,viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,
        primary:box('[data-care-brief-action="full-profile"]'),owner:box('[data-p4-dir="owner"]'),status:box('[data-compact-intake-status]'),
        name:box('[data-care-brief-owner-name]'),phone:box('.directory-care-owner-phone'),call:box('[data-care-brief-call-owner] a')};
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.viewportOverflow).toBe(false);
    expect(geometry.name.left).toBeCloseTo(geometry.phone.left,0);
    expect(geometry.name.bottom).toBeLessThanOrEqual(geometry.phone.top+1);
    expect(geometry.name.right).toBeLessThanOrEqual(geometry.call.left);
    expect(geometry.phone.right).toBeLessThanOrEqual(geometry.call.left);
    expect(geometry.call.height).toBeGreaterThanOrEqual(44);
    if(page.viewportSize().width>360)expect(geometry.primary.top).toBeCloseTo(geometry.owner.top,0);
    expect(geometry.status.top).toBeGreaterThanOrEqual(geometry.owner.bottom);
    for(const control of await secondary.all()){
      await control.scrollIntoViewIfNeeded();
      const style=await control.evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {height:r.height,border:s.borderTopWidth,radius:s.borderTopLeftRadius,hit:hit===node||node.contains(hit),overflow:node.scrollWidth>node.clientWidth+1};});
      expect(style.height).toBeGreaterThanOrEqual(44);
      expect(style.border).toBe('1px');
      expect(style.radius).toBe('8px');
      expect(style.overflow).toBe(false);
      expect(style.hit).toBe(true);
    }
    if(process.env.WAFFLE_CAPTURE_ALIGNMENT==='1'){
      const dir=path.resolve(__dirname,'../output/care-profile-alignment');fs.mkdirSync(dir,{recursive:true});
      await card.locator('.directory-care-owner-line').evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
      await page.screenshot({path:path.join(dir,`${info.project.name}-${dark?'dark':'light'}-${scale}x.png`)});
    }
  }
  expect(fixture.reads.filter(action=>['get_guest_profile','get_dog_history','get_belongings','get_guest_belongings'].includes(action))).toEqual(reads);
  // Missing or invalid numbers retain the existing explicit edit action, never a dial link.
  for(const phone of ['', 'not a phone']){
    await card.evaluate((card,phone)=>{card.querySelector('[data-directory-edit-field="phone"]').dataset.directoryCurrentValue=phone;card.dataset.v1088Phone=phone;window.WAFFLE_REFRESH_CARE_SETUP(card);},phone);
    await expect(card.locator('.directory-owner-contact-missing')).toBeVisible();
    await expect(card.locator('[data-care-brief-call-owner] a')).toHaveCount(0);
    await expect(card.getByRole('button',{name:'Add number',exact:true})).toBeVisible();
  }
  const contact=card.locator('[data-care-brief-call-owner]');
  await contact.evaluate(node=>{node.hidden=true;});
  await expect(contact.locator('button')).toBeHidden();
  await expect(contact.locator('.directory-owner-contact-missing')).toBeHidden();
  await contact.evaluate(node=>{node.hidden=false;});
  await expect(contact.locator('.directory-owner-contact-missing')).toBeVisible();
  expect(await card.getAttribute('data-directory-stay-id')).toBe(bookings[0].stayId);
  expect(await card.getAttribute('data-directory-dog-id')).toBe(bookings[0].dogId);
});
