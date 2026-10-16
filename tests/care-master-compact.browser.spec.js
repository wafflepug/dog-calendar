const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const compactCss = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.css'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const render = source.match(/function v110RenderMasterProfile\([\s\S]*?\n(?=async function v110LoadMasterProfile)/)?.[0];
const savedAge = source.match(/function v110MasterSavedAge\([\s\S]*?\n(?=function v110MasterPhotoHtml)/)?.[0];
const freshness = source.match(/function v110MasterFreshness\([\s\S]*?\n(?=function v110MasterPhotoHtml)/)?.[0];
const risks = source.match(/function v110MasterRiskBadges\([\s\S]*?\n(?=function v110MasterPhotoHtml)/)?.[0];
const escape = source.match(/function v110Escape\([\s\S]*?\n(?=function )/)?.[0];
const feedback = source.match(/function v110ShowActionFeedback\([\s\S]*?\n(?=function v110ClearActionFeedback)/)?.[0];
const clearFeedback = source.match(/function v110ClearActionFeedback\([\s\S]*?\n(?=function v110ActionErrorMessage)/)?.[0];
const save = source.match(/async function v110SaveMasterFromCard\([\s\S]*?\n(?=\/\* Media \*\/)/)?.[0];
const loadMaster = source.match(/async function v110LoadMasterProfile\([\s\S]*?\n\}/)?.[0];

test('dog record maintenance starts closed and feedback stays visible outside it across same-identity rerenders', async ({ page }) => {
  expect(render).toBeTruthy();
  expect(savedAge).toBeTruthy();
  expect(freshness).toBeTruthy();
  expect(risks).toBeTruthy();
  expect(escape).toBeTruthy();
  expect(feedback).toBeTruthy();
  expect(clearFeedback).toBeTruthy();
  expect(save).toBeTruthy();
  expect(loadMaster).toBeTruthy();
  await page.setContent('<article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-dog-name="Milo"><div data-v110-master-host></div></article>');
  await page.addScriptTag({ content: `
    const escapeDashboardHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    ${escape}\n${savedAge}\n${freshness}\n${risks}\n${feedback}\n${clearFeedback}\n${render}
    const v110ActiveMasterSaves = new Set();
    let v110MasterCache = {};
    window.saveRequests = [];
    const v110OperationalPayloadFromCard = card => JSON.parse(card.dataset.payload);
    const sendPayloadToAppsScript = payload => new Promise((resolve, reject) => window.saveRequests.push({payload, resolve, reject}));
    const v110ErrorCanRetry = error => /temporary/.test(error?.message || '');
    const v110ActionErrorMessage = (label, error) => label + ' could not be saved. ' + error.message;
    let v110MasterCacheSavedAt = {};
    ${save}
  ` });
  await page.evaluate(() => {
    window.renderDogRecord = (card, record, options) => v110RenderMasterProfile(card, record, options);
  });
  await page.addStyleTag({ content: compactCss });
  const record = { dogName:'Milo', breed:'Poodle', ownerName:'Alex', phone:'0400000000', persisted:true, profile:{feeding:'Dinner'}, riskFlags:{escapeRisk:false,foodAllergy:false,medicated:false,separationAnxiety:false,weightManagement:false} };
  await page.evaluate(record => window.renderDogRecord(document.querySelector('.directory-card'), record), record);
  const host = page.locator('[data-v110-master-host]');
  const disclosure = host.locator('[data-v110-update-dog-record]');
  await expect(disclosure).toHaveCount(1);
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(host).toContainText('Saved master profile');
  await expect(host).toContainText('Alex');
  await expect(host).toContainText('0400000000');
  await expect(host.locator('.v110-master-freshness')).toBeVisible();
  await expect(host.locator('.v110-master-care')).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize='200%'; document.body.classList.toggle('dark-theme'); });
    expect(await disclosure.locator('summary').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }


  await disclosure.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await page.evaluate(record => window.renderDogRecord(document.querySelector('.directory-card'), record), record);
  await expect(host.locator('[data-v110-update-dog-record]')).toHaveAttribute('open', '');
  await page.evaluate(() => {
    const currentHost = document.querySelector('[data-v110-master-host]');
    currentHost.querySelector('[data-v110-update-dog-record]').open = false;
    v110ShowActionFeedback(currentHost.querySelector('[data-v110-master-feedback]'), 'Save failed. Retry is available.');
  });
  await expect(host.locator('[data-v110-update-dog-record]')).not.toHaveAttribute('open', '');
  await expect(host.getByRole('alert')).toContainText('Save failed. Retry is available.');
  await expect(host.locator('.v110-master-feedback')).toBeVisible();
  await page.evaluate(record => {
    const card = document.querySelector('.directory-card');
    card.dataset.directoryStayId = 'stay-b';
    window.renderDogRecord(card, record);
  }, record);
  await expect(host.locator('[data-v110-update-dog-record]')).not.toHaveAttribute('open', '');
});

test('master save exposes pending, retry, and ACK feedback while closed and ignores a late ACK after a guest switch', async ({ page }) => {
  const payload = { stayId:'stay-a', stayKey:'milo|2026-10-11|2026-10-14', dogId:'dog-a', dogName:'Milo', breed:'Poodle', startDate:'2026-10-11', endDate:'2026-10-14' };
  await page.setContent(`<article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-stay-key="${payload.stayKey}" data-directory-dog-name="Milo" data-payload='${JSON.stringify(payload)}'><div data-v110-master-host></div></article>`);
  await page.addScriptTag({ content: `const escapeDashboardHtml=value=>String(value??'').replace(/[<>"']/g,char=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));\n${escape}\n${savedAge}\n${freshness}\n${risks}\n${feedback}\n${clearFeedback}\n${render}\nconst v110ActiveMasterSaves=new Set();let v110MasterCache={};let v110MasterCacheSavedAt={};window.saveRequests=[];window.masterReadRequests=[];const v110OperationalPayloadFromCard=card=>JSON.parse(card.dataset.payload);const sendPayloadToAppsScript=payload=>new Promise((resolve,reject)=>window.saveRequests.push({payload,resolve,reject}));const queryAppsScriptSWR=()=>new Promise(resolve=>window.masterReadRequests.push(resolve));const v110ErrorCanRetry=error=>/temporary/.test(error?.message||'');const v110ActionErrorMessage=(label,error)=>label+' could not be saved. '+error.message;${save}\n${loadMaster}` });
  await page.evaluate(record => v110RenderMasterProfile(document.querySelector('.directory-card'), record), {dogName:'Milo',persisted:true,riskFlags:{}});
  const host = page.locator('[data-v110-master-host]');
  const disclosure = host.locator('[data-v110-update-dog-record]');
  await disclosure.locator('summary').click();
  const saving = page.evaluate(() => v110SaveMasterFromCard(document.querySelector('.directory-card'), document.querySelector('[data-v110-save-master]')));
  await expect(host.getByRole('alert')).toContainText('Saving this stay');
  await page.evaluate(() => { void v110SaveMasterFromCard(document.querySelector('.directory-card'), document.querySelector('[data-v110-save-master]')); });
  expect(await page.evaluate(() => window.saveRequests.length)).toBe(1);
  await disclosure.locator('summary').click();
  await expect(host.locator('[data-v110-update-dog-record]')).not.toHaveAttribute('open', '');
  const refreshing = page.evaluate(() => { void v110LoadMasterProfile(document.querySelector('.directory-card'), {force:true}); });
  await expect(host.locator('.v110-master-freshness')).toHaveText('Refreshing dog record…');
  await page.evaluate(() => window.masterReadRequests[0]({data:{record:{dogName:'Milo',persisted:true,riskFlags:{}}}}));
  await refreshing;
  await expect(host.locator('[data-v110-update-dog-record]')).not.toHaveAttribute('open', '');
  await expect(host.getByRole('alert')).toContainText('Saving this stay');
  await page.evaluate(() => window.saveRequests[0].reject(new Error('temporary connection failure')));
  await expect(host.getByRole('alert')).toContainText('temporary connection failure');
  await expect(host.getByRole('button', { name:'Retry' })).toBeVisible();
  const retrying = page.getByRole('button', { name:'Retry' }).click();
  await expect.poll(() => page.evaluate(() => window.saveRequests.length)).toBe(2);
  await page.evaluate(() => { v110MasterCacheSavedAt['id:dog-a']=Date.now()-86400000; });
  await page.evaluate(() => window.saveRequests[1].resolve({record:{dogName:'Milo',persisted:true,riskFlags:{}}}));
  await retrying;
  await expect(host.locator('.v110-action-feedback.is-success')).toContainText('Master Profile saved');
  expect(await page.evaluate(() => v110MasterCacheSavedAt['id:dog-a'])).toBeUndefined();
  await saving;

  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const current = JSON.parse(card.dataset.payload);
    current.stayId = 'stay-c'; current.dogId = 'dog-c'; current.dogName = 'Coco';
    card.dataset.payload = JSON.stringify(current);
    card.dataset.directoryStayId = 'stay-c'; card.dataset.directoryDogId = 'dog-c'; card.dataset.directoryDogName = 'Coco';
    v110RenderMasterProfile(card, {dogName:'Coco',persisted:true,riskFlags:{}});
  });
  await page.evaluate(() => { void v110SaveMasterFromCard(document.querySelector('.directory-card'), document.querySelector('[data-v110-save-master]')); });
  await expect.poll(() => page.evaluate(() => window.saveRequests.length)).toBe(3);
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    const current = JSON.parse(card.dataset.payload); current.stayId='stay-d'; current.dogId='dog-d'; current.dogName='Pip';
    card.dataset.payload=JSON.stringify(current); card.dataset.directoryStayId='stay-d'; card.dataset.directoryDogId='dog-d'; card.dataset.directoryDogName='Pip';
    v110RenderMasterProfile(card, {dogName:'Pip',persisted:true,riskFlags:{}});
    window.saveRequests[2].resolve({record:{dogName:'Coco',persisted:true,riskFlags:{}}});
  });
  await expect(host).toContainText('Pip');
  await expect(host).not.toContainText('Master Profile saved');
  await page.evaluate(() => { void v110LoadMasterProfile(document.querySelector('.directory-card'), {force:true}); });
  await expect.poll(() => page.evaluate(() => window.masterReadRequests.length)).toBe(2);
  await page.evaluate(() => window.masterReadRequests[1]({error: new Error('network unavailable')}));
  await expect(host.locator('.v110-master-freshness')).toContainText('Showing saved profile data; refresh failed.');
  await expect(host.getByRole('button', {name:'Retry loading dog record'})).toBeVisible();
  await expect(host).toContainText('Pip');
  await page.evaluate(() => { void v110SaveMasterFromCard(document.querySelector('.directory-card'), document.querySelector('[data-v110-save-master]')); });
  await expect.poll(() => page.evaluate(() => window.saveRequests.length)).toBe(4);
  await page.evaluate(() => window.saveRequests[3].resolve({queued:true,result:'success',record:{dogName:'Pip',persisted:true}}));
  await expect(host.locator('.v110-action-feedback')).toContainText('did not confirm');
  await expect(host.locator('.v110-action-feedback.is-success')).toHaveCount(0);
});

test('cached Dog Record age states remain readable across widths and themes, and stale callbacks cannot cross guests', async ({ page }) => {
  await page.setContent('<article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-dog-name="Milo"><div data-v110-master-host></div></article>');
  await page.addScriptTag({ content: `const escapeDashboardHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));\n${escape}\n${savedAge}\n${freshness}\n${risks}\n${render}\nlet v110MasterCache={};let v110MasterCacheSavedAt={};window.readOptions=[];window.readResolvers=[];const queryAppsScriptSWR=(_payload,options)=>{window.readOptions.push(options);return new Promise(resolve=>window.readResolvers.push(resolve));}\n${loadMaster}\nwindow.paint=(options)=>v110RenderMasterProfile(document.querySelector('.directory-card'),{dogName:'Milo',persisted:true,riskFlags:{}},options);` });
  const status = page.locator('.v110-master-freshness');
  const knownAt = Date.now() - 7 * 60_000;
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.body.className = theme === 'dark' ? 'dark-theme' : ''; }, theme);
      await page.evaluate(savedAt => window.paint({ cached:true, savedAt }), knownAt);
      await expect(status).toContainText(/saved on this device \d+ minutes? ago/i);
      await page.evaluate(() => window.paint({ cached:true }));
      await expect(status).toContainText('Copy save time unavailable');
      await page.evaluate(savedAt => window.paint({ offline:true, cached:true, savedAt }), knownAt);
      await expect(status).toContainText('Showing saved profile data offline.');
      await expect(status).toContainText(/saved on this device \d+ minutes? ago/i);
      await page.evaluate(savedAt => window.paint({ refreshFailed:true, cached:true, savedAt }), knownAt);
      await expect(status).toContainText('Showing saved profile data; refresh failed.');
      await expect(status).toContainText(/saved on this device \d+ minutes? ago/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }

  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    void v110LoadMasterProfile(card, { force:true });
  });
  await expect.poll(() => page.evaluate(() => window.readOptions.length)).toBe(1);
  await page.evaluate(() => window.readOptions[0].onCached({record:{dogName:'Milo',persisted:true,riskFlags:{}}}, {savedAt:Date.now()-60000}));
  await expect(status).toContainText(/Saved on this device 1 minute ago/i);
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.directoryStayId='stay-b'; card.dataset.directoryDogId='dog-b'; card.dataset.directoryDogName='Coco';
    v110RenderMasterProfile(card,{dogName:'Coco',persisted:true,riskFlags:{}},{});
    window.readOptions[0].onCached({record:{dogName:'Milo',persisted:true,riskFlags:{}}},{savedAt:Date.now()-86400000});
    window.readResolvers[0]({data:{record:{dogName:'Milo',persisted:true,riskFlags:{}}},offlineFallback:true});
  });
  await expect(page.locator('.v110-master-heading h4')).toHaveText('Coco');
  await expect(status).toHaveText('Dog record checked just now.');
});

test('network replacement clears the previous cache time and cold cache refresh failure keeps cached data visible', async ({ page }) => {
  await page.setContent('<article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-dog-name="Milo"><div data-v110-master-host></div></article>');
  await page.addScriptTag({ content: `const escapeDashboardHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));\n${escape}\n${savedAge}\n${freshness}\n${risks}\n${render}\nlet v110MasterCache={};let v110MasterCacheSavedAt={};window.mode='network';const queryAppsScriptSWR=async (_payload,options)=>{if(window.mode==='cold-fail'){await options.onCached({record:{dogName:'Milo',persisted:true,riskFlags:{}}},{savedAt:Date.now()-3600000});throw new Error('synthetic refresh failure');}return {data:{record:{dogName:'Milo Updated',persisted:true,riskFlags:{}}},offlineFallback:false};}\n${loadMaster}` });
  const card = page.locator('.directory-card');
  const status = page.locator('.v110-master-freshness');
  await page.evaluate(() => { v110MasterCache['id:dog-a']={dogName:'Old Milo',persisted:true,riskFlags:{}};v110MasterCacheSavedAt['id:dog-a']=Date.now()-86400000;void v110LoadMasterProfile(document.querySelector('.directory-card'),{force:true}); });
  await expect(page.locator('.v110-master-heading h4')).toHaveText('Milo Updated');
  await expect(status).toHaveText('Dog record checked just now.');
  await expect.poll(() => page.evaluate(() => v110MasterCacheSavedAt['id:dog-a'])).toBeUndefined();
  await page.evaluate(() => { window.mode='cold-fail'; v110MasterCache={}; v110MasterCacheSavedAt={}; void v110LoadMasterProfile(document.querySelector('.directory-card'),{force:true}); });
  await expect(page.locator('.v110-master-heading h4')).toHaveText('Milo');
  await expect(status).toContainText('Showing saved profile data; refresh failed.');
  await expect(status).toContainText('Saved on this device 1 hour ago');
  await expect(page.getByRole('button', { name:'Retry loading dog record' })).toBeVisible();
});
