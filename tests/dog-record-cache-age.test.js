const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-v11.0.js', 'utf8');
const savedAge = source.match(/function v110MasterSavedAge\(savedAt,now=Date\.now\(\)\)\{[^\n]+/)[0];
const freshness = source.match(/function v110MasterFreshness\(opt=\{\}\)\{[^\n]+/)[0];

test('Dog Record cache age accepts known savedAt and rejects unknown, invalid and future times', () => {
  const sandbox = {};
  vm.runInNewContext(`${savedAge}\n${freshness}`, sandbox);
  const now = Date.parse('2026-10-16T00:00:00Z');
  assert.equal(sandbox.v110MasterSavedAge(now - 5 * 60_000, now), 'Saved on this device 5 minutes ago');
  assert.equal(sandbox.v110MasterSavedAge(now - 2 * 60 * 60_000, now), 'Saved on this device 2 hours ago');
  assert.equal(sandbox.v110MasterSavedAge(undefined, now), 'Copy save time unavailable');
  assert.equal(sandbox.v110MasterSavedAge('not-a-date', now), 'Copy save time unavailable');
  assert.equal(sandbox.v110MasterSavedAge(now + 60_000, now), 'Copy save time unavailable');
  assert.match(sandbox.v110MasterFreshness({ cached:true, savedAt:now - 60_000, now }), /saved on this device 1 minute ago/i);
  assert.match(sandbox.v110MasterFreshness({ cached:true, now }), /Copy save time unavailable/);
});

test('Dog Record freshness separates verified checks, offline fallback and failed refresh', () => {
  const sandbox = {};
  vm.runInNewContext(`${savedAge}\n${freshness}`, sandbox);
  assert.equal(sandbox.v110MasterFreshness({}), 'Dog record checked just now.');
  assert.match(sandbox.v110MasterFreshness({ offline:true, cached:true, savedAt:Date.now() - 600_000 }), /^Showing saved profile data offline\./);
  assert.match(sandbox.v110MasterFreshness({ refreshFailed:true, offline:true, cached:true }), /^Showing saved profile data; refresh failed\./);
  assert.doesNotMatch(sandbox.v110MasterFreshness({ refreshFailed:true, cached:true }), /checked just now/i);
});

test('Dog Record read keeps cache savedAt separate and applies delayed cache callbacks only to current stay identity', () => {
  const render = source.match(/function v110RenderMasterProfile\(card,r,opt=\{\}\)\{[^\n]+/)[0];
  const risk = source.match(/function v110MasterRiskBadges\(flags\)\{[^\n]+/)[0];
  const load = source.match(/async function v110LoadMasterProfile\(card,opt=\{\}\)\{[\s\S]*?\n\}/)[0];
  const host = { innerHTML:'', dataset:{}, querySelector:() => null };
  let onCached;
  const sandbox = {
    escapeDashboardHtml: value => String(value),
    document:{ activeElement:null },
    v110MasterCache:{},
    v110MasterCacheSavedAt:{},
    queryAppsScriptSWR: async (_payload, options) => { onCached = options.onCached; return new Promise(() => {}); }
  };
  vm.runInNewContext(`function v110Escape(v){return escapeDashboardHtml(v==null?'':String(v));}\n${savedAge}\n${freshness}\n${risk}\n${render}\n${load}`, sandbox);
  const card = { dataset:{ directoryDogName:'Milo', directoryDogId:'dog-7', directoryStayId:'stay-a' }, querySelector(selector){ return selector === '[data-v110-master-host]' ? host : null; } };
  void sandbox.v110LoadMasterProfile(card);
  return Promise.resolve().then(async () => {
    card.dataset.directoryStayId = 'stay-b';
    await onCached({ record:{ dogName:'Milo', persisted:true } }, { savedAt:'2026-10-15T00:00:00Z' });
    assert.equal(sandbox.v110MasterCacheSavedAt['id:dog-7'], undefined);
    assert.doesNotMatch(host.innerHTML, /Saved on this device/);
  });
});
