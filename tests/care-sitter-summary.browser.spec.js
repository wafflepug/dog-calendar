const {test,expect}=require('@playwright/test');
const path=require('node:path');

const modulePath=path.join(__dirname,'..','care-sitter-summary.js');
const longNote=`Give Milo his dinner at 6 pm. ${'Check that he has fresh water after every walk. '.repeat(12)}Keep the blue lead by the back door.`;

async function mount(page,{clipboardMode='resolve',profileState='fresh',identity='milo-one'}={}){
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body data-waffle-page="directory"></body></html>');
  await page.evaluate(({clipboardMode,profileState,identity,longNote})=>{
    const ids=identity==='milo-one'
      ? {key:'milo|2026-10-18|2026-10-20',stay:'stay-milo-one',dog:'dog-milo-one',number:'#00017'}
      : {key:'milo|2026-10-18|2026-10-20',stay:'stay-milo-two',dog:'dog-milo-two',number:'#00018'};
    const card=document.createElement('article');
    card.className='directory-card is-profile-active';
    Object.assign(card.dataset,{directoryStayKey:ids.key,stayKey:ids.key,directoryStayId:ids.stay,directoryDogId:ids.dog,directoryDogNumber:ids.number,directoryDogName:'Milo',directoryStartDate:'2026-10-18',directoryEndDate:'2026-10-20',profileEditing:'false'});
    card.innerHTML=`<div class="directory-card-identity"><h2 data-directory-edit-field="dogName">Milo</h2><div class="directory-profile-stay-dates"><span><strong>Check-in</strong> 18 Oct 2026</span><span><strong>Check-out</strong> 20 Oct 2026</span></div></div>
      <section data-directory-detail="profile" data-profile-read-state="${profileState}"></section>
      <section data-directory-care-brief><div data-care-brief-freshness data-state="fresh"><span data-care-brief-freshness-summary>Saved · 18 Oct · Details</span><span data-care-brief-freshness-detail>Saved care record · checked 18 Oct 2026</span></div>
      <div data-care-brief-safety>No active safety flags recorded</div><p data-care-brief-medication>Give medication with dinner</p>
      <div data-care-brief-feeding><span data-care-brief-row="times"><strong>Times: </strong>8am and 6pm</span><span data-care-brief-row="amount"><strong>Amount: </strong>1 cup</span><span data-care-brief-row="food"><strong>Food: </strong>Sensitive formula</span></div>
      <div data-care-brief-walks><span data-care-brief-row="walks"><strong>Walks: </strong>Two walks</span><span data-care-brief-row="duration"><strong>Duration: </strong>30 minutes</span></div>
      <div data-care-brief-note-rendered="true" data-care-brief-handover-note="${longNote.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')}"><span data-care-brief-handover-preview>Short preview only…</span><details><div data-care-brief-handover-full>${longNote}</div></details></div>
      <a href="tel:0400000000">Private owner phone</a><button data-care-sitter-summary="copy">Copy sitter summary</button><div data-care-sitter-summary-output hidden><span data-care-sitter-summary-status role="status"></span><textarea data-care-sitter-summary-manual aria-label="Sitter summary to copy" readonly hidden></textarea></div></section>`;
    document.body.append(card);
    window.__clipboardWrites=[];
    let release;
    window.__releaseClipboard=()=>release?.();
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(text){window.__clipboardWrites.push(text);return clipboardMode==='reject'?Promise.reject(new Error('blocked')):clipboardMode==='hold'?new Promise(resolve=>{release=resolve;}):Promise.resolve();}}});
  },{clipboardMode,profileState,identity,longNote});
  await page.addScriptTag({path:modulePath});
  return page.locator('.directory-card[data-directory-stay-id="stay-milo-one"]');
}

test('copies the complete saved Care brief for the exact dog and leaves rendered care data unchanged',async({page})=>{
  const card=await mount(page);
  await card.evaluate(node=>node.dataset.directoryDogNumber='17');
  const before=await card.evaluate(node=>({text:[...node.querySelectorAll('[data-care-brief-safety],[data-care-brief-medication],[data-care-brief-feeding],[data-care-brief-walks],[data-care-brief-handover-note],[data-care-brief-freshness]')].map(el=>el.textContent),dataset:{...node.dataset}}));
  await card.locator('[data-care-sitter-summary="copy"]').click();
  const copied=await page.evaluate(()=>window.__clipboardWrites[0]);
  expect(copied).toContain('Sitter summary — Milo · Permanent dog number #00017');
  expect(copied).toContain('Stay ID: stay-milo-one');
  expect(copied).toContain('18 Oct 2026');
  expect(copied).toContain('Freshness: Saved care record · checked 18 Oct 2026');
  expect(copied).toContain('No active safety flags recorded');
  expect(copied).toContain('Give medication with dinner');
  expect(copied).toContain('Times: 8am and 6pm');
  expect(copied).toContain('Walks: Two walks');
  expect(copied).toContain(longNote);
  expect(copied).not.toContain('Private owner phone');
  expect(await card.evaluate(node=>({text:[...node.querySelectorAll('[data-care-brief-safety],[data-care-brief-medication],[data-care-brief-feeding],[data-care-brief-walks],[data-care-brief-handover-note],[data-care-brief-freshness]')].map(el=>el.textContent),dataset:{...node.dataset}}))).toEqual(before);
  await expect(card.locator('[data-care-sitter-summary-status]')).toHaveText('Sitter summary copied.');
});

test('keeps same-name dogs distinct, blocks drafts and unresolved profile reads, and ignores stale clipboard completion',async({page})=>{
  const first=await mount(page,{clipboardMode:'hold'});
  const firstCard=page.locator('.directory-card[data-directory-stay-id="stay-milo-one"]');
  await first.locator('[data-care-sitter-summary="copy"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__clipboardWrites.length)).toBe(1);
  await firstCard.evaluate(card=>card.classList.remove('is-profile-active'));
  await page.evaluate(()=>{
    const card=document.querySelector('.directory-card[data-directory-stay-id="stay-milo-one"]');
    const twin=card.cloneNode(true);twin.classList.add('is-profile-active');twin.dataset.directoryStayId='stay-milo-two';twin.dataset.directoryDogId='dog-milo-two';twin.dataset.directoryDogNumber='#00018';document.body.append(twin);return twin;
  });
  const second=page.locator('.directory-card[data-directory-stay-id="stay-milo-two"]');
  await page.evaluate(()=>window.__releaseClipboard());
  await expect(second.locator('[data-care-sitter-summary-status]')).toBeHidden();
  await expect(firstCard.locator('[data-care-sitter-summary-status]')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__clipboardWrites[0])).toContain('stay-milo-one');

  await second.evaluate(card=>{card.classList.add('is-profile-editing');card.dataset.profileEditing='true';});
  await second.locator('[data-care-sitter-summary="copy"]').click();
  await expect(second.locator('[data-care-sitter-summary-status]')).toContainText('Finish editing');
  expect(await page.evaluate(()=>window.__clipboardWrites.length)).toBe(1);
  await second.evaluate(card=>{card.classList.remove('is-profile-editing');card.dataset.profileEditing='false';card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState='loading';});
  await second.locator('[data-care-sitter-summary="copy"]').click();
  await expect(second.locator('[data-care-sitter-summary-status]')).toContainText('saved care record');
  expect(await page.evaluate(()=>window.__clipboardWrites.length)).toBe(1);
});

test('shows a selectable exact summary when clipboard access is rejected and labels missing care as unrecorded',async({page})=>{
  const card=await mount(page,{clipboardMode:'reject'});
  await card.evaluate(node=>node.dataset.directoryDogNumber='Other');
  await card.locator('[data-care-brief-medication]').evaluate(el=>el.textContent='No saved medication instructions');
  await card.locator('[data-care-brief-feeding]').evaluate(el=>el.textContent='No saved feeding instructions');
  await card.locator('[data-care-brief-walks]').evaluate(el=>el.textContent='Walking details unavailable');
  await card.locator('[data-care-sitter-summary="copy"]').click();
  await expect(card.locator('[data-care-sitter-summary-status]')).toHaveText('Copy unavailable. Select the summary below and copy it manually.');
  const manual=card.locator('[data-care-sitter-summary-manual]');
  await expect(manual).toBeVisible();
  const value=await manual.inputValue();
  expect(value).toContain('Dog ID dog-milo-one');
  expect(value).not.toContain('Other');
  expect(value).toContain('Medication: Not recorded');
  expect(value).toContain('Feeding: Not recorded');
  expect(value).toContain('Walks: Walking details unavailable');
  expect(value).toContain(longNote);
  expect(await manual.evaluate(el=>el.ownerDocument.activeElement===el)).toBeTruthy();
  await card.locator('[data-care-brief-medication]').evaluate(el=>el.textContent='Medication status unavailable');
  await page.evaluate(id=>window.WAFFLE_CARE_SITTER_SUMMARY.syncCard(document.querySelector(`[data-directory-stay-id="${id}"]`)),'stay-milo-one');
  await expect(card.locator('[data-care-sitter-summary-output]')).toBeHidden();
  expect(await manual.inputValue()).toBe('');
});
