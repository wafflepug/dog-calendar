/* ============================================================
   WAFFLE HOUSE — AUTHORITATIVE RUNTIME BOOTSTRAP
   Build 2026.08.28.01 · Phase 4 Sitter Workflow Expansion
   ------------------------------------------------------------
   This is the only local JavaScript entry point app HTML should load.
   Privacy-preserving diagnostics load first, followed by the approved
   compatibility base. Canonical feature modules remain page-aware behind
   waffle-v11.0.5.js. Phase 4 loads before the final additive UI polish layer.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_RUNTIME_BOOTSTRAP) return;

  const BUILD = '2026.08.28.01';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';
  const RUNTIME = [
      "waffle-diagnostics.js",
      "waffle-firebase-config.js",
      "waffle-app.js",
      "waffle-v10.8.js",
      "waffle-v10.8.2.js",
      "waffle-v10.8.3.js",
      "waffle-v10.8.5.js",
      "waffle-v10.8.6.js",
      "waffle-v10.8.8.js",
      "waffle-v10.8.9.js",
      "waffle-v11.0.js",
      "waffle-v11.0.4.js",
      "waffle-v11.0.5.js",
      "phase4.js",
      "waffle-v11.1.94.js"
];
  const maintenanceUrl = new URL('maintenance.html', window.location.href);
  let buildBanner = null;

  window.WAFFLE_BUILD = BUILD;
  window.WAFFLE_RUNTIME_BOOTSTRAP = Object.freeze({
    build: BUILD,
    phase: 'phase-4-sitter-workflow-expansion',
    runtime: RUNTIME.slice()
  });

  function tagged(file) {
    return file + '?build=' + encodeURIComponent(BUILD);
  }

  function startMaintenanceGate() {
    if (/\/maintenance\.html$/i.test(window.location.pathname)) return;
    if (window.WAFFLE_MAINTENANCE_GATE) return;

    const style = document.createElement('style');
    style.id = 'waffleMaintenanceGateStyle';
    style.textContent = 'html[data-waffle-maintenance-check="pending"] body{pointer-events:none!important;user-select:none!important;}';
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.setAttribute('data-waffle-maintenance-check', 'pending');

    let settled = false;
    let timer = 0;
    const callbackName = '__waffleBootstrapMaintenance' + Date.now() + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');

    function clean() {
      if (timer) clearTimeout(timer);
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
    }

    function redirect(reason) {
      if (settled) return;
      settled = true;
      clean();
      const from = window.location.pathname + window.location.search + window.location.hash;
      maintenanceUrl.searchParams.set('from', from);
      if (reason) maintenanceUrl.searchParams.set('reason', reason);
      window.location.replace(maintenanceUrl.href);
    }

    function unlock() {
      if (settled) return;
      settled = true;
      clean();
      document.documentElement.removeAttribute('data-waffle-maintenance-check');
      style.remove();
      window.dispatchEvent(new CustomEvent('waffle:maintenance-clear'));
    }

    window[callbackName] = status => {
      if (status && status.enabled === true) return redirect('maintenance');
      if (status && status.result === 'success') return unlock();
      redirect('status-unconfirmed');
    };

    script.onerror = () => redirect('status-unavailable');
    script.src = ENDPOINT + '?action=maintenance_status&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    (document.head || document.documentElement).appendChild(script);
    timer = setTimeout(() => redirect('status-timeout'), 6500);

    window.WAFFLE_MAINTENANCE_GATE = Object.freeze({ version: BUILD, endpoint: ENDPOINT });
  }

  function parserLoadRuntime() {
    const markup = RUNTIME.map(file =>
      '<script src="' + tagged(file) + '" data-waffle-runtime-build="' + BUILD + '"><\/script>'
    ).join('');
    document.write(markup);
  }

  async function dynamicLoadRuntime() {
    for (const file of RUNTIME) {
      if (Array.from(document.scripts).some(node => String(node.src || '').includes('/' + file))) continue;
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = tagged(file);
        script.async = false;
        script.dataset.waffleRuntimeBuild = BUILD;
        script.addEventListener('load', resolve, { once:true });
        script.addEventListener('error', () => reject(new Error('Could not load ' + file)), { once:true });
        document.head.appendChild(script);
      });
    }
  }

  function showBuildUpdate(remoteBuild) {
    if (buildBanner || !document.body) return;
    buildBanner = document.createElement('div');
    buildBanner.id = 'waffleBuildUpdate';
    buildBanner.setAttribute('role', 'status');
    buildBanner.style.cssText = [
      'position:fixed','left:50%','bottom:18px','z-index:2147483000','transform:translateX(-50%)',
      'display:flex','align-items:center','gap:10px','max-width:calc(100vw - 24px)','padding:10px 12px',
      'border:1px solid rgba(124,58,237,.35)','border-radius:14px','background:#172033','color:#fff',
      'box-shadow:0 12px 35px rgba(15,23,42,.32)','font:700 12px/1.35 system-ui,sans-serif'
    ].join(';');
    const copy = document.createElement('span');
    copy.textContent = 'A newer Waffle House is ready.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Refresh';
    button.style.cssText = 'border:0;border-radius:9px;padding:7px 10px;background:#8b5cf6;color:#fff;font:800 11px system-ui;cursor:pointer';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all((regs || []).map(reg => reg.update().catch(() => null)));
      } catch (_) {}
      const url = new URL(window.location.href);
      url.searchParams.set('__waffleBuild', String(remoteBuild || Date.now()));
      window.location.replace(url.href);
    });
    buildBanner.append(copy, button);
    document.body.appendChild(buildBanner);
  }

  async function checkBuild() {
    try {
      const response = await fetch('waffle-build.json?_=' + Date.now(), { cache:'no-store' });
      if (!response.ok) return;
      const manifest = await response.json();
      const remote = String(manifest && manifest.build || '').trim();
      if (remote && remote !== BUILD) showBuildUpdate(remote);
    } catch (_) {}
  }

  startMaintenanceGate();

  if (document.readyState === 'loading') {
    parserLoadRuntime();
    document.addEventListener('DOMContentLoaded', checkBuild, { once:true });
  } else {
    dynamicLoadRuntime().catch(error => console.error('Waffle runtime bootstrap failed:', error));
    checkBuild();
  }

  window.addEventListener('pageshow', checkBuild);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkBuild();
  });
  setInterval(checkBuild, 5 * 60 * 1000);
})();
