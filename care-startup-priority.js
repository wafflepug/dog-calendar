/* Keeps secondary work behind the first Care directory paint. */
(function installCareStartupPriority(window, document) {
  'use strict';
  let ready = false;
  let settled = false;
  let draining = false;
  const jobs = new Map();
  const isCare = () => String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '') === 'directory';

  function dispatch(job) {
    if (!job || job.done) return;
    job.done = true;
    Promise.resolve().then(job.callback).then(result => { job.result = result; }, error => {
      try { window.console?.warn?.('Care startup task failed:', job.key, error); } catch (_) {}
    }).finally(() => {
      jobs.delete(job.key);
      draining = false;
      job.resolve(job.result);
      drain();
    });
  }

  function drain() {
    if (draining || (isCare() && !ready && !settled)) return;
    const job = jobs.values().next().value;
    if (!job) return;
    draining = true;
    const run = () => dispatch(job);
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1000 });
    else window.setTimeout(run, 0);
  }

  window.WAFFLE_CARE_STARTUP = {
    schedule(key, callback) {
      const id = String(key || 'secondary');
      if (typeof callback !== 'function') return;
      const existing = jobs.get(id);
      if (existing) return existing.promise;
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      const job = { key: id, callback, promise, resolve, done: false };
      jobs.set(id, job);
      drain();
      return promise;
    },
    ready() { ready = true; drain(); },
    settled() { settled = true; drain(); }
  };
})(window, document);
