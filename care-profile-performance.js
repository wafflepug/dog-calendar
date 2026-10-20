/* Local, anonymous Care timing. No operational values are retained or uploaded. */
(function () {
  'use strict';
  if (window.WAFFLE_CARE_PERFORMANCE || document.body?.dataset?.wafflePage !== 'directory') return;
  const LIMIT = 50, MAX_MS = 3600000;
  const phases = new Set(['request-start', 'cache-applied', 'request-end', 'joined']);
  const caches = new Set(['memory', 'saved', 'miss', 'shared']);
  const serverCaches = new Set(['hit', 'miss', 'unchanged']);
  const outcomes = new Set(['success', 'error', 'offline']);
  const samples = [];
  let observer = null, timer = null;
  const duration = value => Number.isFinite(value) ? Math.max(0, Math.min(MAX_MS, value)) : null;
  function append(sample) { samples.push(Object.freeze(sample)); if (samples.length > LIMIT) samples.shift(); }
  function stop() {
    observer?.disconnect(); observer = null;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }
  window.addEventListener('waffle:care-profile-read', event => {
    const d = event.detail;
    if (!d || !phases.has(d.phase)) return;
    append({kind:'read', phase:d.phase, elapsedMs:duration(d.elapsedMs),
      // transportMs is client end-to-end request time; serverMs is reported only by the versioned backend read.
      readDurationMs:d.phase === 'request-end' ? duration(d.elapsedMs) : null,
      transportMs:d.phase === 'request-end' && Number.isFinite(d.transportMs) && d.transportMs >= 0 ? duration(d.transportMs) : null,
      backendMs:d.phase === 'request-end' && Number.isFinite(d.serverMs) && d.serverMs >= 0 ? duration(d.serverMs) : null,
      serverCacheState:serverCaches.has(d.serverCacheState) ? d.serverCacheState : null,
      cacheStatus:caches.has(d.cacheStatus) ? d.cacheStatus : null,
      outcome:outcomes.has(d.outcome) ? d.outcome : null});
  });
  document.addEventListener('click', event => {
    const open = event.target?.closest?.('[data-open-directory-profile]');
    const card = open?.closest('.directory-card');
    if (!card?.closest('#directory-grid') || typeof MutationObserver !== 'function') return;
    stop();
    const start = performance.now();
    let shellRecorded = false;
    const check = () => {
      if (!card.isConnected) { stop(); return; }
      if (!card.classList.contains('is-profile-active')) return;
      if (!shellRecorded) {
        shellRecorded = true;
        append({kind:'open',phase:'shell-render',elapsedMs:duration(performance.now()-start),readDurationMs:null,transportMs:null,backendMs:null,serverCacheState:null,cacheStatus:null,outcome:null});
      }
      if (card.querySelector('[data-directory-detail="profile"]')?.dataset.detailLoaded === 'true') {
        append({kind:'open',phase:'essentials-render',elapsedMs:duration(performance.now()-start),readDurationMs:null,transportMs:null,backendMs:null,serverCacheState:null,cacheStatus:null,outcome:null});
        stop();
      }
    };
    observer = new MutationObserver(check);
    observer.observe(card,{attributes:true,attributeFilter:['class','data-detail-loaded'],childList:true,subtree:true});
    timer = window.setTimeout(stop,15000);
  }, true);
  window.addEventListener('pagehide', stop);
  Object.defineProperty(window,'WAFFLE_CARE_PERFORMANCE',{value:Object.freeze({
    snapshot:() => samples.map(sample => ({...sample})),
    clear:() => { stop(); samples.length = 0; }
  }),writable:false,configurable:false});
})();
