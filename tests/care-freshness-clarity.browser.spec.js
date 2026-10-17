const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const path = require('node:path');
const runtimeCss = fs.readFileSync('waffle-runtime.css', 'utf8').replace(/@import url\("([^"?]+)[^" ]*"\);/g, (_, file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
const helperStart = source.indexOf('    const directorySummaryHtmlState =');
const rendererStart = source.indexOf('    function renderDirectoryCareBrief(', helperStart);
const rendererEnd = source.indexOf('    function openCareReadinessTarget(', rendererStart);
const freshnessStart = source.indexOf('    function getDirectoryCareBriefFreshness(');
const readStatusStart = source.indexOf('    function setDirectoryProfileReadStatus(');
const readStatusEnd = source.indexOf('    function getDirectoryProfileReadIdentity(', readStatusStart);
const readStatusCode = source.slice(readStatusStart, readStatusEnd);
const briefCode = source.slice(freshnessStart, source.indexOf('    function mergeDirectoryCareRecordWithServerTimestamp(', helperStart))
  + source.slice(rendererStart, rendererEnd);

async function install(page) {
  await page.setContent(`<body data-waffle-page="directory"><article class="directory-card" data-stay-key="milo|a|b" data-directory-stay-key="milo|a|b"><div data-directory-detail="profile"><div data-directory-intake-attributes></div></div><section data-directory-care-brief><div data-care-readiness-list><div data-care-readiness-item="intake"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div><div data-care-readiness-item="handover"><span data-care-readiness-status></span><span data-care-readiness-detail></span></div></div><details><summary><span data-care-readiness-summary></span></summary></details><section class="directory-care-brief-safety"><div data-care-brief-safety></div></section><div data-care-brief-owner-name></div><div data-care-brief-feeding></div><div data-care-brief-medication></div><div class="directory-care-brief-freshness" data-care-brief-freshness></div><div data-care-brief-call-owner></div></section></article></body>`);
  await page.addStyleTag({ content: runtimeCss });
  await page.addScriptTag({ content: `
    window.directorySummaryRecordsCache={}; window.careRiskRecordsCache={}; window.belongingsRecordsCache={};
    window.currentRecord={stayKey:'milo|a|b',intakeAttributes:{},updatedAt:'2026-10-15T08:30:00Z',retrievedAt:'2026-10-17T12:00:00Z'};
    function getDirectoryProfileReadIdentity(){return {cacheKey:'identity-a',hasStableIds:false}}
    function directoryProfileIdentityIsAmbiguous(){return false}
    function getDirectoryCareBriefRecord(){return window.currentRecord}
    function getDirectoryValidatedCareProfileRecord(card){return card.dataset.profileIdentityBlocked?null:window.currentRecord}
    function setDirectorySummaryText(host,value){const next=String(value??'');if(host&&host.textContent!==next)host.textContent=next}
    function setDirectorySummaryData(host,key,value){const next=String(value??'');if(host&&host.dataset&&host.dataset[key]!==next)host.dataset[key]=next}
    function setDirectorySummaryAttribute(host,name,value){const next=String(value??'');if(host&&host.getAttribute(name)!==next)host.setAttribute(name,next)}
    function setDirectorySummaryClass(host,name,on){if(host&&host.classList.contains(name)!==!!on)host.classList.toggle(name,!!on)}
    function getActiveCareFlags(){return []}
    function normalizeDirectoryPhoneForTel(){return ''}
    function markDirectoryProfileIdentityConflict(){}
    function escapeDashboardHtml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
    ${briefCode}
    ${readStatusCode}
    window.setProfileReadStatus=setDirectoryProfileReadStatus;
    window.render=renderDirectoryCareBrief;
  `});
  await page.evaluate(() => setProfileReadStatus(document.querySelector('[data-directory-detail="profile"]'), 'saved', 'Saved details shown'));
}

for (const width of [390, 1440]) test(`Care freshness stays legible and truthful at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await install(page);
  const result = await page.evaluate(() => {
    const card=document.querySelector('.directory-card'), host=card.querySelector('[data-care-brief-freshness]');
    const states=[];
    const readStatus=card.querySelector('[data-directory-profile-read-status]');
    const setMode=(mode,state='saved')=>{readStatus.dataset.freshnessOffline=String(mode.includes('offline'));readStatus.dataset.freshnessRefreshFailed=String(mode.includes('failed'));card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState=state;render(card);states.push({state:host.dataset.state,text:host.textContent.trim()})};
    setMode('','loading');
    setMode('','refreshing');
    setMode('');
    setMode('offline');
    setMode('refresh-failed','error');
    setMode('offline-failed','error');
    window.currentRecord={retrievedAt:'2026-10-17T12:00:00Z'};setMode('');
    const existing=host;
    const observer=new MutationObserver(()=>{});observer.observe(host,{subtree:true,childList:true,characterData:true,attributes:true});
    render(card);const noMutation=observer.takeRecords().length===0 && card.querySelector('[data-care-brief-freshness]')===existing;
    card.dataset.directoryStayKey='same-name|c|d';window.currentRecord={stayKey:'same-name|c|d',updatedAt:'2026-10-15T08:30:00Z',intakeAttributes:{}};setMode('offline');
    card.dataset.profileIdentityBlocked='identity-a';card.dataset.profileIdentityBlockedReason='collision';card.querySelector('[data-directory-detail="profile"]').dataset.profileReadState='identity-conflict';render(card);states.push({state:host.dataset.state,text:host.textContent.trim()});
    const rect=host.getBoundingClientRect();
    return {states,noMutation,width:rect.width,scrollWidth:host.scrollWidth,viewport:innerWidth};
  });
  expect(result.states.map(x=>x.state)).toEqual(['loading','refreshing','fresh','offline','error','offline','saved','offline','identity-conflict']);
  expect(result.states[0].text).toContain('Loading');
  expect(result.states[1].text).toContain('Refreshing');
  expect(result.states[2].text).toContain('Saved');
  expect(result.states[3].text).toContain('Offline');
  expect(result.states[4].text).toContain('Refresh failed');
  expect(result.states[5].text).toContain('Offline · refresh unavailable');
  expect(result.states[6].text).toContain('update time unknown');
  expect(result.noMutation).toBe(true);
  expect(result.width).toBeLessThanOrEqual(width);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width+1);
});

test('production read-status setter preserves live errors and suppresses only duplicate success', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await install(page);
  const result = await page.evaluate(() => {
    const details=document.querySelector('[data-directory-detail="profile"]');
    const host=document.querySelector('[data-care-brief-freshness]');
    const retryAction=()=>{};
    setProfileReadStatus(details,'fresh','Care details updated');
    const success=details.querySelector('[data-directory-profile-read-status]');
    const successState={live:success.getAttribute('aria-live'),redundant:success.classList.contains('is-visually-redundant'),role:success.getAttribute('role')};
    setProfileReadStatus(details,'error','Saved details shown · offline refresh unavailable',retryAction,{offline:true,refreshFailed:true});
    const error=details.querySelector('[data-directory-profile-read-status]');
    const retry=error.querySelector('[data-retry-directory-profile-read]');
    const errorState={live:error.getAttribute('aria-live'),redundant:error.classList.contains('is-visually-redundant'),role:error.getAttribute('role'),retry:!!retry,visible:!!retry&&retry.getBoundingClientRect().width>0,text:host.textContent.trim(),state:host.dataset.state};
    document.body.classList.remove('dark-theme');
    const light={color:getComputedStyle(host).color,background:getComputedStyle(host).backgroundColor,width:host.getBoundingClientRect().width,scrollWidth:host.scrollWidth};
    document.body.classList.add('dark-theme');
    const dark={color:getComputedStyle(host).color,background:getComputedStyle(host).backgroundColor,width:host.getBoundingClientRect().width,scrollWidth:host.scrollWidth};
    return {successState,errorState,light,dark};
  });
  const contrast = (fg,bg) => {
    const lum = color => {
      const [r,g,b]=color.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});
      return .2126*r+.7152*g+.0722*b;
    };
    const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  expect(result.successState).toEqual({live:'off',redundant:true,role:'status'});
  expect(result.errorState.live).toBe('polite');
  expect(result.errorState.redundant).toBe(false);
  expect(result.errorState.role).toBe('status');
  expect(result.errorState.retry).toBe(true);
  expect(result.errorState.visible).toBe(true);
  expect(result.errorState.state).toBe('offline');
  expect(result.errorState.text).toContain('Offline · refresh unavailable');
  for (const theme of [result.light,result.dark]) {
    expect(contrast(theme.color,theme.background), JSON.stringify(theme)).toBeGreaterThanOrEqual(4.5);
    expect(theme.width).toBeLessThanOrEqual(320);
    expect(theme.scrollWidth).toBeLessThanOrEqual(theme.width+1);
  }
});
