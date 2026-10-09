const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('care-profile-performance.js','utf8');
function setup(page='directory') {
  const events={}, docEvents={}; let clock=100, observer, timer;
  class Observer { constructor(cb){this.cb=cb;observer=this;} observe(target,options){this.target=target;this.options=options;} disconnect(){this.disconnected=true;} }
  const window={addEventListener:(name,cb)=>events[name]=cb,setTimeout:cb=>(timer=cb,1),clearTimeout:()=>timer=null};
  const document={body:{dataset:{wafflePage:page}},addEventListener:(name,cb)=>docEvents[name]=cb};
  vm.runInNewContext(source,{window,document,performance:{now:()=>clock},MutationObserver:Observer});
  return {api:window.WAFFLE_CARE_PERFORMANCE,emit:d=>events['waffle:care-profile-read']({detail:d}),click:target=>docEvents.click({target}),time:n=>clock=n,observer:()=>observer,timeout:()=>timer?.(),events};
}
test('live timing is directory-only and retains no private event values',()=>{
  assert.equal(setup('calendar').api,undefined);
  const h=setup();h.emit({phase:'request-end',elapsedMs:125,cacheStatus:'miss',outcome:'success',requestId:'private dog name',payload:{phone:'0411111111'},url:'https://private'});
  const s=h.api.snapshot()[0];assert.equal(s.readDurationMs,125);assert.equal(s.backendMs,null);
  assert.deepEqual(Object.keys(s).sort(),['backendMs','cacheStatus','elapsedMs','kind','outcome','phase','readDurationMs'].sort());
  assert.doesNotMatch(JSON.stringify(s),/private|0411111111|https/);
});
test('only finite durations and fixed status labels are accepted; samples and copies are bounded',()=>{
  const h=setup();h.emit({phase:'arbitrary private value',elapsedMs:1});assert.equal(h.api.snapshot().length,0);
  h.emit({phase:'joined',elapsedMs:Infinity,cacheStatus:'owner name',outcome:'raw error'});const first=h.api.snapshot()[0];assert.equal(first.elapsedMs,null);assert.equal(first.cacheStatus,null);assert.equal(first.outcome,null);
  for(let i=0;i<60;i++)h.emit({phase:'cache-applied',elapsedMs:i,cacheStatus:'saved'});
  const copy=h.api.snapshot();assert.equal(copy.length,50);assert.equal(copy.at(-1).elapsedMs,59);copy[0].phase='tampered';assert.notEqual(h.api.snapshot()[0].phase,'tampered');
  h.api.clear();assert.equal(h.api.snapshot().length,0);
});
test('opening measures only selected card, separates shell from essentials and disconnects',()=>{
  const h=setup();let active=false,loaded=false;
  const card={isConnected:true,closest:selector=>selector==='#directory-grid'?{}:null,classList:{contains:()=>active},querySelector:()=>({dataset:{detailLoaded:String(loaded)}})};
  const button={closest:()=>card},target={closest:()=>button};
  h.click(target);const o=h.observer();assert.equal(o.target,card);assert.deepEqual(Array.from(o.options.attributeFilter),['class','data-detail-loaded']);
  active=true;h.time(110);o.cb();loaded=true;h.time(125);o.cb();
  assert.deepEqual(Array.from(h.api.snapshot(),s=>s.phase),['shell-render','essentials-render']);assert.deepEqual(Array.from(h.api.snapshot(),s=>s.elapsedMs),[10,25]);assert.equal(o.disconnected,true);
});
test('observer is retired on timeout and clear',()=>{
  const h=setup();const card={isConnected:true,closest:()=>({}),classList:{contains:()=>false}};
  h.click({closest:()=>({closest:()=>card})});h.timeout();assert.equal(h.observer().disconnected,true);
  h.click({closest:()=>({closest:()=>card})});h.api.clear();assert.equal(h.observer().disconnected,true);
});
