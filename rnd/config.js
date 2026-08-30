// Release A R&D only. This file contains browser-safe Supabase publishable
// configuration for the dedicated free R&D project. Never place service-role
// or other privileged credentials in frontend files.
window.WAFFLE_RND_CONFIG = Object.freeze({
  environment: 'rnd',
  supabaseUrl: 'https://bzlmqsvueoctrfnjmosq.supabase.co',
  supabaseAnonKey: 'sb_publishable_CENAyc84KUaJl-PyUC9QmQ_9JF1YyKR'
});

// When the R&D shell is hosted under the production Pages origin, install a
// narrower pass-through service worker so the production Waffle PWA worker
// cannot cache, rewrite, or offline-fallback this isolated preview path.
if ('serviceWorker' in navigator && /\/rnd-preview\//.test(location.pathname)) {
  navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(error => {
    console.warn('R&D preview isolation worker could not be registered:', error);
  });
}
