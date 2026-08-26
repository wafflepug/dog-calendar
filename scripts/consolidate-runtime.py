#!/usr/bin/env python3
"""Phase 1: give Waffle House one deterministic browser runtime entry point.

This intentionally does not delete historical source files yet. It removes them
from page-level execution, moves the approved compatibility order into one
bootstrap, and makes browser/service-worker cache behaviour deterministic.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

BUILD = "2026.08.27.01"
PAGES = ["index.html", "directory.html", "reminders.html", "audit.html"]

BASE_RUNTIME = [
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
]

BASE_STYLES = [
    "waffle-app.css",
    "waffle-v10.8.css",
    "waffle-v10.8.2.css",
    "waffle-v10.8.3.css",
    "waffle-v10.8.5.css",
    "waffle-v10.8.6.css",
    "waffle-v10.8.7.css",
    "waffle-v10.8.8.css",
    "waffle-v10.8.9.css",
    "waffle-v11.0.css",
    "waffle-v11.0.3.css",
    "waffle-v11.0.5.css",
]

MAINTENANCE_ENDPOINT = (
    "https://script.google.com/macros/s/"
    "AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec"
)


def replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label} replacement; found {count}.")
    return new_text


def write_runtime_css() -> None:
    lines = [
        "/* Waffle House consolidated style entry point.",
        f"   Build: {BUILD}",
        "   Historical files remain source modules during Phase 1, but pages no longer",
        "   reference them individually. Preserve this import order until modules are folded in. */",
    ]
    lines += [f'@import url("{name}?build={BUILD}");' for name in BASE_STYLES]
    lines.append("")
    Path("waffle-runtime.css").write_text("\n".join(lines), encoding="utf-8")


def write_build_manifest() -> None:
    payload = {
        "build": BUILD,
        "runtime": "waffle-bootstrap.js",
        "styles": "waffle-runtime.css",
        "phase": "runtime-consolidation-1",
        "legacySourceDeletion": False,
    }
    Path("waffle-build.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_bootstrap() -> None:
    runtime_json = json.dumps(BASE_RUNTIME, indent=6)
    code = f'''/* ============================================================
   WAFFLE HOUSE — AUTHORITATIVE RUNTIME BOOTSTRAP
   Build {BUILD} · Runtime Consolidation Phase 1
   ------------------------------------------------------------
   This is the only local JavaScript entry point app HTML should load.
   The approved compatibility order lives here until old modules are safely
   folded into canonical source. Historical files remain in Git history/repo,
   but cannot re-enter page execution unless explicitly allow-listed here.
   ============================================================ */
(function () {{
  'use strict';
  if (window.WAFFLE_RUNTIME_BOOTSTRAP) return;

  const BUILD = '{BUILD}';
  const ENDPOINT = '{MAINTENANCE_ENDPOINT}';
  const RUNTIME = {runtime_json};
  const maintenanceUrl = new URL('maintenance.html', window.location.href);
  let buildBanner = null;

  window.WAFFLE_BUILD = BUILD;
  window.WAFFLE_RUNTIME_BOOTSTRAP = Object.freeze({{
    build: BUILD,
    runtime: RUNTIME.slice()
  }});

  function tagged(file) {{
    return file + '?build=' + encodeURIComponent(BUILD);
  }}

  function startMaintenanceGate() {{
    if (/\/maintenance\.html$/i.test(window.location.pathname)) return;
    if (window.WAFFLE_MAINTENANCE_GATE) return;

    const style = document.createElement('style');
    style.id = 'waffleMaintenanceGateStyle';
    style.textContent = 'html[data-waffle-maintenance-check="pending"] body{{pointer-events:none!important;user-select:none!important;}}';
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.setAttribute('data-waffle-maintenance-check', 'pending');

    let settled = false;
    let timer = 0;
    const callbackName = '__waffleBootstrapMaintenance' + Date.now() + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');

    function clean() {{
      if (timer) clearTimeout(timer);
      try {{ delete window[callbackName]; }} catch (_) {{ window[callbackName] = undefined; }}
      script.remove();
    }}

    function redirect(reason) {{
      if (settled) return;
      settled = true;
      clean();
      const from = window.location.pathname + window.location.search + window.location.hash;
      maintenanceUrl.searchParams.set('from', from);
      if (reason) maintenanceUrl.searchParams.set('reason', reason);
      window.location.replace(maintenanceUrl.href);
    }}

    function unlock() {{
      if (settled) return;
      settled = true;
      clean();
      document.documentElement.removeAttribute('data-waffle-maintenance-check');
      style.remove();
      window.dispatchEvent(new CustomEvent('waffle:maintenance-clear'));
    }}

    window[callbackName] = status => {{
      if (status && status.enabled === true) return redirect('maintenance');
      if (status && status.result === 'success') return unlock();
      redirect('status-unconfirmed');
    }};

    script.onerror = () => redirect('status-unavailable');
    script.src = ENDPOINT + '?action=maintenance_status&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    (document.head || document.documentElement).appendChild(script);
    timer = setTimeout(() => redirect('status-timeout'), 6500);

    window.WAFFLE_MAINTENANCE_GATE = Object.freeze({{ version: BUILD, endpoint: ENDPOINT }});
  }}

  function parserLoadRuntime() {{
    const markup = RUNTIME.map(file =>
      '<script src="' + tagged(file) + '" data-waffle-runtime-build="' + BUILD + '"><\\/script>'
    ).join('');
    document.write(markup);
  }}

  async function dynamicLoadRuntime() {{
    for (const file of RUNTIME) {{
      if (Array.from(document.scripts).some(node => String(node.src || '').includes('/' + file))) continue;
      await new Promise((resolve, reject) => {{
        const script = document.createElement('script');
        script.src = tagged(file);
        script.async = false;
        script.dataset.waffleRuntimeBuild = BUILD;
        script.addEventListener('load', resolve, {{ once:true }});
        script.addEventListener('error', () => reject(new Error('Could not load ' + file)), {{ once:true }});
        document.head.appendChild(script);
      }});
    }}
  }}

  function showBuildUpdate(remoteBuild) {{
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
    button.addEventListener('click', async () => {{
      button.disabled = true;
      try {{
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all((regs || []).map(reg => reg.update().catch(() => null)));
      }} catch (_) {{}}
      const url = new URL(window.location.href);
      url.searchParams.set('__waffleBuild', String(remoteBuild || Date.now()));
      window.location.replace(url.href);
    }});
    buildBanner.append(copy, button);
    document.body.appendChild(buildBanner);
  }}

  async function checkBuild() {{
    try {{
      const response = await fetch('waffle-build.json?_=' + Date.now(), {{ cache:'no-store' }});
      if (!response.ok) return;
      const manifest = await response.json();
      const remote = String(manifest && manifest.build || '').trim();
      if (remote && remote !== BUILD) showBuildUpdate(remote);
    }} catch (_) {{}}
  }}

  startMaintenanceGate();

  if (document.readyState === 'loading') {{
    parserLoadRuntime();
    document.addEventListener('DOMContentLoaded', checkBuild, {{ once:true }});
  }} else {{
    dynamicLoadRuntime().catch(error => console.error('Waffle runtime bootstrap failed:', error));
    checkBuild();
  }}

  window.addEventListener('pageshow', checkBuild);
  document.addEventListener('visibilitychange', () => {{
    if (document.visibilityState === 'visible') checkBuild();
  }});
  setInterval(checkBuild, 5 * 60 * 1000);
}})();
'''
    Path("waffle-bootstrap.js").write_text(code, encoding="utf-8")


def patch_page(path: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")

    css_pattern = (
        r'\n\s*<link rel="stylesheet" href="waffle-app\.css\?v=[^"]+">\s*'
        r'(?:\n\s*<link rel="stylesheet" href="waffle-v[^"]+">\s*)+'
    )
    text = replace_once(
        text,
        css_pattern,
        f'\n    <link rel="stylesheet" href="waffle-runtime.css?v={BUILD}">\n',
        f"style chain in {path}",
        re.MULTILINE,
    )

    js_pattern = (
        r'\n\s*<script src="waffle-firebase-config\.js\?v=[^"]+"></script>\s*'
        r'(?:\n\s*<script src="waffle-(?:app|v)[^"]+"></script>\s*)+'
    )
    text = replace_once(
        text,
        js_pattern,
        f'\n    <script src="waffle-bootstrap.js?v={BUILD}"></script>\n',
        f"script chain in {path}",
        re.MULTILINE,
    )

    for asset in [
        "manifest.webmanifest",
        "pwa-icon-192.png",
        "pwa-icon-512.png",
        "pwa-maskable-512.png",
        "pwa-apple-touch-icon.png",
    ]:
        text = re.sub(re.escape(asset) + r'\?v=[^"\']+', asset + f'?v={BUILD}', text)

    file.write_text(text, encoding="utf-8")


def patch_compatibility_loaders() -> None:
    loader = Path("waffle-v11.0.5.js")
    text = loader.read_text(encoding="utf-8")
    text = text.replace(
        'waffle-v11.0.5-core.js?v=11.1.40',
        f'waffle-v11.0.5-core.js?v=11.1.40&build={BUILD}',
    )
    text = text.replace(
        "script.src = src + '?v=' + version;",
        f"script.src = src + '?v=' + encodeURIComponent(version) + '&build=' + encodeURIComponent(String(window.WAFFLE_BUILD || '{BUILD}'));",
    )
    text = text.replace(
        "script.src = 'waffle-v11.1.89.js?v=11.1.89';",
        f"script.src = 'waffle-v11.1.89.js?v=11.1.89&build={BUILD}';",
    )
    loader.write_text(text, encoding="utf-8")

    calendar = Path("waffle-v11.1.61.js")
    text = calendar.read_text(encoding="utf-8")
    text = text.replace(
        "script.src = file + '?v=' + version;",
        f"script.src = file + '?v=' + encodeURIComponent(version) + '&build=' + encodeURIComponent(String(window.WAFFLE_BUILD || '{BUILD}'));",
    )
    calendar.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    file = Path("service-worker.js")
    text = file.read_text(encoding="utf-8")
    text = re.sub(
        r"const WAFFLE_SW_VERSION = '[^']+';",
        f"const WAFFLE_SW_VERSION = 'v11.2.0-runtime-{BUILD}';",
        text,
        count=1,
    )

    app_shell = f'''const APP_SHELL = [
  './',
  './index.html',
  './directory.html',
  './reminders.html',
  './audit.html',
  './maintenance.html',
  './waffle-build.json',
  './waffle-bootstrap.js?v={BUILD}',
  './waffle-runtime.css?v={BUILD}',
  './waffle-maintenance.webp?v=11.1.92',
  './waffle-logo.png',
  './waffle-logo-dark.png',
  './manifest.webmanifest?v={BUILD}',
  './pwa-icon-192.png?v={BUILD}',
  './pwa-icon-512.png?v={BUILD}',
  './pwa-maskable-512.png?v={BUILD}',
  './pwa-apple-touch-icon.png?v={BUILD}',
  './waffle-firebase-config.js?build={BUILD}'
];'''
    text = replace_once(
        text,
        r"const APP_SHELL = \[.*?\n\];",
        app_shell,
        "service-worker app shell",
        re.DOTALL,
    )

    text = text.replace(
        "importScripts('./waffle-firebase-config.js?v=11.1.4-recovery');",
        f"importScripts('./waffle-firebase-config.js?build={BUILD}');",
    )

    fresh_fn = '''function isFirstPaintCriticalAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith('/waffle-maintenance.webp') ||
    path.endsWith('/waffle-build.json') ||
    path.endsWith('/manifest.webmanifest') ||
    path.endsWith('.js') ||
    path.endsWith('.css')
  );
}'''
    text = replace_once(
        text,
        r"function isFirstPaintCriticalAsset\(url\) \{.*?\n\}",
        fresh_fn,
        "service-worker critical asset strategy",
        re.DOTALL,
    )

    file.write_text(text, encoding="utf-8")


def main() -> None:
    write_runtime_css()
    write_build_manifest()
    write_bootstrap()
    for page in PAGES:
        patch_page(page)
    patch_compatibility_loaders()
    patch_service_worker()
    print(f"Waffle active runtime consolidated for build {BUILD}.")


if __name__ == "__main__":
    main()
