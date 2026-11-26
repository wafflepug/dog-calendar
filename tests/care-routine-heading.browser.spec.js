const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');

test('routine edit stays beside its heading when there is room and wraps without clipping',async({page,baseURL})=>{
  const fixture=await install(page);
  await page.goto(`${baseURL}/directory.html?careRoutineHeadingFixture=1`,{waitUntil:'domcontentloaded'});
  const card=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state','fresh');
  const heading=card.locator('.directory-care-brief-feeding-walks .directory-care-brief-note-heading');
  const edit=heading.locator('[data-care-brief-action="edit-routine"]');
  const reads=fixture.reads.filter(action=>action==='get_guest_profile').length;
  for(const width of [320,390,768,1440])for(const dark of [false,true]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
    await expect(edit).toBeVisible();
    const geometry=await heading.evaluate(node=>{
      const title=node.querySelector('h4'),action=node.querySelector('button');
      const box=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,centerY:(r.top+r.bottom)/2};};
      return {heading:box(node),title:box(title),action:box(action),background:getComputedStyle(action).backgroundColor,overflow:node.scrollWidth>node.clientWidth+1};
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.action.height).toBeGreaterThanOrEqual(44);
    expect(geometry.action.left).toBeGreaterThanOrEqual(geometry.heading.left-1);
    expect(geometry.action.right).toBeLessThanOrEqual(geometry.heading.right+1);
    if(width>=390){
      expect(Math.abs(geometry.title.centerY-geometry.action.centerY)).toBeLessThanOrEqual(1);
      expect(geometry.title.right).toBeLessThanOrEqual(geometry.action.left);
    }
  }
  expect(fixture.reads.filter(action=>action==='get_guest_profile')).toHaveLength(reads);
  await page.emulateMedia({forcedColors:"active"});
  expect(await edit.evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe("1px");
  await page.keyboard.press("Tab");
  await edit.focus();
  expect(await edit.evaluate(node=>parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2);
  await page.emulateMedia({forcedColors:"none"});
  await page.keyboard.press("Enter");
  await expect(card.locator('[data-directory-detail="profile"]')).toBeVisible();
  await expect(card.locator('[data-intake-attribute="feedingTimes"]')).toBeVisible();
});

test('guest Activity shows readable routine entries with a type icon and timestamp', async ({page, baseURL}) => {
  await install(page);
  const stay = bookings[0];
  const recordedAt = '2026-10-18T02:00:00Z';
  const note = 'Activity note '.repeat(14).trim();
  await page.route(url => url.hostname === 'script.google.com' && url.searchParams.get('payload')?.includes('"action":"get_care_routine_log"'), async route => {
    const callback = new URL(route.request().url()).searchParams.get('callback');
    const result = {result:'success', careRoutineLogVersion:1, events:[{
      stayKey:stay.stayKey, stayId:stay.stayId, dogId:stay.dogId,
      eventId:'aaaaaaaa-aaaa-4aaa-8aaa-000000000009', type:'walk', recordedAt, note
    }]};
    return route.fulfill({contentType:'application/javascript', body:callback ? `${callback}(${JSON.stringify(result)});` : JSON.stringify(result)});
  });
  await page.setViewportSize({width:320,height:800});
  await page.goto(`${baseURL}/directory.html`, {waitUntil:'domcontentloaded'});
  const card = page.locator(`#directory-grid [data-directory-stay-id="${stay.stayId}"]`);
  await card.locator('[data-open-directory-profile]').click();
  await card.getByRole('button', {name:'Activity',exact:true}).click();
  const row = card.locator('.care-routine-events li');
  await expect(row.getByText('Walk', {exact:true})).toBeVisible();
  await expect(row.locator('[data-palz-icon="walk"]')).toBeVisible();
  await expect(row.locator('time')).toHaveAttribute('datetime', recordedAt);
  await expect(row).toContainText(note);
  expect(await row.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
