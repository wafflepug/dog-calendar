const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

test.setTimeout(90_000);

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  { timestamp: '2026-10-05', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-01-01', endDate: '2027-01-01', ownerName: 'Alex "A", Owner', phone: '0400000001', notes: `handover-${'verylongword'.repeat(12)}\nBring the "blue", blanket\nLeave at 7pm`, bookingType: 'Boarding', requestSource: 'MadPaws', dogId: '11111111-1111-4111-8111-111111111111', dogNumber: 17 },
  { timestamp: '2026-10-05', dogName: 'Nala', breed: 'Labrador', startDate: '2026-01-01', endDate: '2027-01-01', ownerName: '   ', phone: '  ', notes: '  ', bookingType: 'Boarding' }
];
const keyFor = b => `${b.dogName.toLowerCase()}|${b.startDate}|${b.endDate}`;
const dateCell = value => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; };
const csv = () => ['Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Dog Number', ...bookings.map(b => [b.timestamp, b.dogName, b.breed, dateCell(b.startDate), dateCell(b.endDate), b.ownerName, b.phone, '', '', b.notes, '', b.bookingType, b.dogId || '', b.dogNumber || ''].map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(','))].join('\r\n');

function installFixture(page) {
  const handler = async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: csv() });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google.com')) {
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const action = String(resolved.action || payload.action || params.get('action') || '');
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: `Unapproved backend action blocked: ${resolved.policy.reason}` });
      const records = bookings.map(b => ({ ...b, stayKey: keyFor(b) }));
      let response = { result: 'success', records: [], enabled: false };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: records, summaries: records.map(b => ({ stayKey: b.stayKey, requestSource: b.requestSource || '', riskFlags: b.dogName === 'Milo' ? { medicated: true, foodAllergy: true } : {} })), digitalIntakes: [], legacyIntakes: [] };
      if (action === 'get_intake_statuses') response = { result: 'success', records: [] };
      if (action === 'get_legacy_intake_statuses') response = { result: 'success', records: [] };
      if (action === 'get_belongings') response = { result: 'success', records: [] };
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
    }
    if (/^https?:/.test(url)) return route.fulfill({ status: 200, contentType: url.match(/\.css(?:\?|$)/) ? 'text/css' : 'image/svg+xml', body: url.match(/\.css(?:\?|$)/) ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>' });
    return route.continue();
  };
  page.on('request', request => {
    if (request.url().includes('script.google.com') && !['GET', 'HEAD'].includes(request.method())) throw new Error(`Unexpected write request: ${request.method()} ${request.url()}`);
  });
  return handler;
}


test('Dog record labels, identifiers and complete notes remain readable when text grows', async ({ page, baseURL }) => {
  await page.route('**/*', installFixture(page));
  await page.setViewportSize({ width:390,height:844 });
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const card=page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await card.locator('[data-open-directory-profile]').click();
  await card.locator('[data-v11160-tab="master"]').click();
  await page.evaluate(()=>window.v110RenderMasterProfile(document.querySelector('.directory-card.is-profile-active'),{
    dogName:'Milo with a longer family name',dogNumber:'#00017',breed:'Border Collie',ownerName:'Alexandria Peterson-Smith',phone:'+61 400 111 222',persisted:true,stayCount:12,
    notes:'Keep the full handover available.\n'.repeat(12),riskFlags:{medicated:true}
  }));
  const record=card.locator('.v110-master-record');
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    for(const rootSize of [16,32]){
      await page.locator('html').evaluate((node,size)=>node.style.fontSize=`${size}px`,rootSize);
      for(const dark of [false,true]){
        await page.locator('body').evaluate((node,mode)=>node.classList.toggle('dark-theme',mode),dark);
        const labels=record.locator('.v110-master-fields small');
        expect(await labels.evaluateAll(nodes=>nodes.every(node=>parseFloat(getComputedStyle(node).fontSize)>=13))).toBeTruthy();
        await expect(record.locator('.v110-master-id')).toHaveText('Dog ID #00017');
        const geometry=await record.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth,children:[...node.querySelectorAll('.v110-master-id,.v110-master-fields>div')].map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})),viewport:innerWidth}));
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
        expect(geometry.children.every(box=>box.left>=0&&box.right<=geometry.viewport+1)).toBeTruthy();
      }
    }
  }
  const note=record.locator('.v110-master-note');
  await note.locator('summary').click();
  await expect(note.locator('p')).toHaveCSS('max-height','none');
  await expect(note.locator('p')).toContainText('Keep the full handover available.');
});

test('Care date and detail editor actions remain reachable on short phone viewports', async ({ page, baseURL })=>{
  await page.route('**/*',installFixture(page));
  await page.setViewportSize({width:390,height:844});
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const card=page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await card.locator('[data-open-directory-profile]').click();
  for(const viewport of [{width:320,height:568},{width:390,height:320},{width:667,height:320}]){
    await page.setViewportSize(viewport);
    await card.locator('.v11113-editable-stay-dates').first().click();
    const modal=page.locator('#v11113StayDatesModal');
    await expect(modal).toBeVisible();
    await modal.locator('[data-v11113-stay-dates-status]').evaluate(el=>el.textContent='Example of a long error to review before saving. '.repeat(14));
    for(const rootSize of [16,32]){
      await page.locator('html').evaluate((node,size)=>node.style.fontSize=`${size}px`,rootSize);
      const save=modal.locator('[data-v11113-stay-dates-save]');
      await save.scrollIntoViewIfNeeded();
      await expect.poll(()=>save.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&(hit===el||el.contains(hit));})).toBeTruthy();
      const box=await save.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
      expect(await modal.locator('.v11113-stay-dates-actions').evaluate(el=>getComputedStyle(el).position)).toBe('sticky');
      await expect(modal.locator('[data-v11113-start-date]')).toHaveValue('2026-01-01');
    }
    await modal.locator('[data-v11113-stay-dates-close]').last().click();
    await expect(modal).toBeHidden();
    await page.locator('html').evaluate(node=>node.style.fontSize='16px');
  }
  await card.locator('[data-directory-edit-field="dogName"]').click();
  const editor=page.locator('#guestDetailEditModal');
  await expect(editor).toBeVisible();
  await editor.locator('#guestDetailEditInput').fill('Unsaved dog-name draft');
  await editor.locator('#guestDetailEditStatus').evaluate(el=>el.textContent='Example error message. '.repeat(30));
  const cancel=editor.locator('#cancelGuestDetailEdit');
  await cancel.scrollIntoViewIfNeeded();
  await expect.poll(()=>cancel.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===el;})).toBeTruthy();
  await expect(editor.locator('#guestDetailEditInput')).toHaveValue('Unsaved dog-name draft');
  page.once('dialog',dialog=>dialog.accept());
  await cancel.click();
  await expect(editor).not.toHaveClass(/open/);
});


test('full runtime source controls stay compact and readable beside current care information', async ({page,baseURL})=>{
  await page.route('**/*',installFixture(page));
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const card=page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await card.locator('[data-open-directory-profile]').click();
  const host=card.locator('[data-v11112-care-source-host]');
  const disclosure=host.locator('[data-v11112-source-details]');
  await expect(disclosure).toHaveCount(1);
  await expect(disclosure).not.toHaveAttribute('open','');
  await expect(host.locator('[data-v1117-profile-source-value]').first()).toBeHidden();
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    for(const dark of [false,true]){
      await page.locator('body').evaluate((node,mode)=>node.classList.toggle('dark-theme',mode),dark);
      await expect.poll(()=>host.locator('.v11112-care-source-current strong').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
      const summary=disclosure.locator('summary');await expect(summary).toBeVisible();
      await expect.poll(async()=>{const box=await summary.boundingBox();return box?.height||0;}).toBeGreaterThanOrEqual(44);
      expect(await host.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBeTruthy();
    }
  }
  await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open','');
  await expect(host.locator('[data-v1117-profile-source-value]').first()).toBeVisible();
  await expect(card.locator('.directory-care-brief')).toBeVisible();
});
