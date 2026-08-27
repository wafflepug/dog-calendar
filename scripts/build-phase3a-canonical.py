#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BUILD = '2026.08.27.04'
SW_VERSION = 'v11.3.0-phase3a-2026.08.27.04'


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def banner(title, sources):
    joined = ', '.join(sources)
    return (
        '/* ============================================================\n'
        f'   WAFFLE HOUSE — {title}\n'
        f'   Build {BUILD} · Phase 3A\n'
        '   ------------------------------------------------------------\n'
        f'   Canonicalised from: {joined}\n'
        '   Historical source files remain rollback/reference only.\n'
        '   ============================================================ */\n\n'
    )


# ---------------------------------------------------------------------------
# Organiser
# ---------------------------------------------------------------------------
organiser_js_source = 'waffle-v11.1.15.js'
organiser_css_source = 'waffle-v11.1.15.css'
organiser_source = read(organiser_js_source)
organiser_css_source_text = read(organiser_css_source)

organiser_style_gate = f"""(function () {{
  'use strict';
  const page = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (page !== 'reminders') return;
  if (document.querySelector('link[data-waffle-organiser-canonical-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'organiser.css?build={BUILD}';
  link.dataset.waffleOrganiserCanonicalStyle = '{BUILD}';
  document.head.appendChild(link);
}})();

"""
organiser_marker = f"""
(function () {{
  'use strict';
  window.WAFFLE_ORGANISER_CANONICAL = Object.freeze({{
    build: '{BUILD}',
    module: 'organiser.js',
    rollbackSources: ['{organiser_js_source}', '{organiser_css_source}']
  }});
}})();
"""
write(
    'organiser.js',
    banner('CANONICAL ORGANISER', [organiser_js_source]) + organiser_style_gate + organiser_source.rstrip() + '\n' + organiser_marker
)
write(
    'organiser.css',
    banner('CANONICAL ORGANISER STYLES', [organiser_css_source]) + organiser_css_source_text.rstrip() + '\n'
)


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------
# The actual Audit/Logs data renderer remains in waffle-app.js. This adapter
# establishes the page-specific canonical ownership without duplicating the
# shared data/query layer.
logs_source = f"""{banner('CANONICAL LOGS PAGE ADAPTER', ['waffle-app.js audit data/render core'])}(function () {{
  'use strict';
  const BUILD = '{BUILD}';

  function pageName() {{
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }}

  function canonicaliseNavigation() {{
    document.querySelectorAll('a[href$="audit.html"] .nav-label, [data-page-link="audit"] .nav-label')
      .forEach(label => {{ label.textContent = 'Logs'; }});
    document.querySelectorAll('a[href$="audit.html"], [data-page-link="audit"]')
      .forEach(link => {{
        const aria = String(link.getAttribute('aria-label') || '');
        const title = String(link.getAttribute('title') || '');
        if (/audit/i.test(aria)) link.setAttribute('aria-label', aria.replace(/audit(?: log)?/ig, 'Logs'));
        if (/audit/i.test(title)) link.setAttribute('title', title.replace(/audit(?: log)?/ig, 'Logs'));
      }});
  }}

  function apply() {{
    canonicaliseNavigation();
    if (pageName() !== 'audit') return;
    document.title = 'Waffle House — Logs';
    document.body.dataset.waffleCanonicalLogs = BUILD;
    const heading = document.querySelector('#auditTabPanel h1, #auditTabPanel h2, .audit-header h1, .audit-header h2');
    if (heading && /audit/i.test(String(heading.textContent || ''))) heading.textContent = 'Logs';
  }}

  async function refresh() {{
    if (typeof window.loadAuditLog === 'function') return window.loadAuditLog({{ force:true }});
    throw new Error('Waffle Logs data renderer is not ready yet.');
  }}

  window.WAFFLE_LOGS_CANONICAL = Object.freeze({{
    build: BUILD,
    module: 'logs.js',
    dataOwner: 'waffle-app.js',
    refresh
  }});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {{ once:true }});
  else apply();
  window.addEventListener('pageshow', apply);
}})();
"""
write('logs.js', logs_source)


# ---------------------------------------------------------------------------
# Shared UI
# ---------------------------------------------------------------------------
ui_sources = [
    'waffle-v11.1.75.js',
    'waffle-v11.1.76.js',
    'waffle-v11.1.89.js',
    'waffle-ui-contract.js'
]
ui_chunks = []
for source_name in ui_sources:
    source = read(source_name)
    if source_name == 'waffle-v11.1.89.js':
        # Organiser Quick Action recovery must resolve through the canonical
        # module rather than silently reactivating V11.1.15.
        source = source.replace('waffle-v11.1.15.css?v=11.1.89', f'organiser.css?build={BUILD}')
        source = source.replace("includes('/waffle-v11.1.15.css')", "includes('/organiser.css')")
        source = source.replace("includes('/waffle-v11.1.15.js')", "includes('/organiser.js')")
        source = source.replace("script.src = 'waffle-v11.1.15.js?v=11.1.89';", f"script.src = 'organiser.js?build={BUILD}';")
    ui_chunks.append(f"\n/* ---- source: {source_name} ---- */\n{source.rstrip()}\n")

ui_marker = f"""
(function () {{
  'use strict';
  window.WAFFLE_UI_CANONICAL = Object.freeze({{
    build: '{BUILD}',
    module: 'waffle-ui.js',
    rollbackSources: {json.dumps(ui_sources)}
  }});
}})();
"""
write('waffle-ui.js', banner('CANONICAL SHARED UI', ui_sources) + ''.join(ui_chunks) + ui_marker)


# ---------------------------------------------------------------------------
# Ask Waffle
# ---------------------------------------------------------------------------
ai_universal_before = [
    'waffle-v11.1.37-assets.js',
    'waffle-v11.1.53.js',
    'waffle-v11.1.37.js',
    'waffle-v11.1.38.js'
]
ai_parity = ['waffle-v11.1.39.js', 'waffle-v11.1.40.js']
ai_calendar = ['waffle-v11.1.45.js']
ai_universal_after = ['waffle-v11.1.47.js', 'waffle-v11.1.48.js', 'waffle-v11.1.58.js']
ai_sources = ai_universal_before + ai_parity + ai_calendar + ai_universal_after

ai_parts = [banner('CANONICAL ASK WAFFLE', ai_sources)]
for source_name in ai_universal_before:
    ai_parts.append(f"\n/* ---- source: {source_name} ---- */\n{read(source_name).rstrip()}\n")

ai_parts.append("""
/* Calendar/Care layout compatibility retained inside the canonical bundle. */
if (['calendar', 'directory'].includes(String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar'))) {
""")
for source_name in ai_parity:
    ai_parts.append(f"\n/* ---- conditional source: {source_name} ---- */\n{read(source_name).rstrip()}\n")
ai_parts.append('}\n')

ai_parts.append("""
/* Calendar-only stability compatibility retained inside the canonical bundle. */
if (String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar') {
""")
for source_name in ai_calendar:
    ai_parts.append(f"\n/* ---- conditional source: {source_name} ---- */\n{read(source_name).rstrip()}\n")
ai_parts.append('}\n')

for source_name in ai_universal_after:
    ai_parts.append(f"\n/* ---- source: {source_name} ---- */\n{read(source_name).rstrip()}\n")

ai_parts.append(f"""
(function () {{
  'use strict';
  window.WAFFLE_AI_CANONICAL = Object.freeze({{
    build: '{BUILD}',
    module: 'waffle-ai.js',
    rollbackSources: {json.dumps(ai_sources)}
  }});
}})();
""")
write('waffle-ai.js', ''.join(ai_parts))


# ---------------------------------------------------------------------------
# Compatibility loader: keep V11.0.5 core, legacy retirement and OCR plumbing,
# but route feature/runtime hydration through canonical modules only.
# ---------------------------------------------------------------------------
loader_path = 'waffle-v11.0.5.js'
loader = read(loader_path)
loader = loader.replace('2026.08.27.03', BUILD)

new_ask = f"""  async function ensureAskWaffle() {{
    await loadScript(
      'waffle-ai.js',
      () => !!window.WAFFLE_AI_CANONICAL,
      '{BUILD}'
    );
  }}

  async function ensureCleanCalendar"""
loader, count = re.subn(
    r"  async function ensureAskWaffle\(\) \{.*?\n  \}\n\n  async function ensureCleanCalendar",
    new_ask,
    loader,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('Could not replace ensureAskWaffle().')

new_shared_block = f"""  async function ensureSharedUi() {{
    await loadScript(
      'waffle-ui.js',
      () => !!window.WAFFLE_UI_CANONICAL,
      '{BUILD}'
    );
  }}

  async function ensureOrganiser() {{
    if (pageName() !== 'reminders') return;
    await loadScript(
      'organiser.js',
      () => !!window.WAFFLE_ORGANISER_CANONICAL,
      '{BUILD}'
    );
  }}

  async function ensureLogs() {{
    if (pageName() !== 'audit') return;
    await loadScript(
      'logs.js',
      () => !!window.WAFFLE_LOGS_CANONICAL,
      '{BUILD}'
    );
  }}

  async function startFinalUi() {{
    try {{
      await ensureSharedUi();
    }} catch (error) {{
      console.warn('Canonical shared UI could not load:', error);
    }}

    try {{
      await ensureCleanCalendar();
    }} catch (error) {{
      console.warn('Canonical Calendar could not load:', error);
    }}

    try {{
      await ensureDesktopCareRebuild();
    }} catch (error) {{
      console.warn('Canonical Care could not load:', error);
    }}

    try {{
      await ensureOrganiser();
    }} catch (error) {{
      console.warn('Canonical Organiser could not load:', error);
    }}

    try {{
      await ensureLogs();
    }} catch (error) {{
      console.warn('Canonical Logs adapter could not load:', error);
    }}

    try {{
      await ensureAskWaffle();
    }} catch (error) {{
      console.warn('Canonical Ask Waffle could not load:', error);
    }}
  }}

  if (document.readyState === 'loading')"""
loader, count = re.subn(
    r"  async function ensureMobileSitterShell\(\) \{.*?\n  if \(document\.readyState === 'loading'\)",
    new_shared_block,
    loader,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('Could not replace shared UI/startFinalUi block.')

# The embedded V11.1.89 shim would otherwise race the canonical shared UI on
# DOMContentLoaded and request the retired source. Its implementation is now
# included in waffle-ui.js.
loader, count = re.subn(
    r"/\* V11\.1\.89 — shared mobile Quick Action completion \+ Organiser reminder routing\. \*/.*?(?=/\* ============================================================\n   V11\.1\.90)",
    "/* V11.1.89 behavior is canonical in waffle-ui.js. */\n\n",
    loader,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('Could not retire embedded V11.1.89 loader shim.')

# Historical feature files may exist on disk but must not remain reachable from
# the live compatibility loader after Phase 3A.
retired_loader_names = [organiser_js_source] + ui_sources[:3] + ai_sources
for source_name in retired_loader_names:
    if source_name in loader:
        raise SystemExit(f'Legacy feature source remains active in compatibility loader: {source_name}')

write(loader_path, loader)


# ---------------------------------------------------------------------------
# Build/bootstrap/style versions
# ---------------------------------------------------------------------------
bootstrap = read('waffle-bootstrap.js').replace('2026.08.27.03', BUILD)
bootstrap = bootstrap.replace('Runtime Consolidation Phase 1', 'Canonical Runtime Phase 3A')
write('waffle-bootstrap.js', bootstrap)

runtime_css = read('waffle-runtime.css').replace('2026.08.27.03', BUILD)
runtime_css = runtime_css.replace('Historical files remain source modules during Phase 1', 'Historical base styles remain compatibility sources during Phase 3A')
write('waffle-runtime.css', runtime_css)


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
manifest = {
    'build': BUILD,
    'runtime': 'waffle-bootstrap.js',
    'styles': 'waffle-runtime.css',
    'phase': 'phase-3a-canonical-modules',
    'canonicalModules': {
        'calendar': 'calendar.js',
        'care': 'care.js',
        'organiser': 'organiser.js',
        'logs': 'logs.js',
        'ui': 'waffle-ui.js',
        'ai': 'waffle-ai.js'
    },
    'legacyCalendarSources': [
        'waffle-v11.1.69.js','waffle-v11.1.66.js','waffle-v11.1.67.js',
        'waffle-v11.1.68.js','waffle-v11.1.70.js','waffle-v11.1.71.js',
        'waffle-v11.1.72.js','waffle-v11.1.73.js','waffle-v11.1.84.js'
    ],
    'legacyCareSources': ['waffle-v11.1.60.js'],
    'legacyOrganiserSources': [organiser_js_source, organiser_css_source],
    'legacyUiSources': ui_sources,
    'legacyAiSources': ai_sources,
    'sharedLogsCompatibility': [
        'waffle-app.js retains canonical shared Audit/Logs data and renderer core; logs.js owns page-level adapter behavior'
    ],
    'sharedCareCompatibility': [
        'V11.1.90 intake PDF OCR action remains in waffle-v11.0.5.js'
    ],
    'legacySourceDeletion': False
}
write('waffle-build.json', json.dumps(manifest, indent=2) + '\n')


# ---------------------------------------------------------------------------
# Service worker
# ---------------------------------------------------------------------------
sw = read('service-worker.js')
sw = re.sub(r"const WAFFLE_SW_VERSION = '[^']+';", f"const WAFFLE_SW_VERSION = '{SW_VERSION}';", sw, count=1)
sw = sw.replace('2026.08.27.03', BUILD)

anchor = f"  './care.js?build={BUILD}',\n"
addition = (
    anchor +
    f"  './organiser.js?build={BUILD}',\n" +
    f"  './organiser.css?build={BUILD}',\n" +
    f"  './logs.js?build={BUILD}',\n" +
    f"  './waffle-ui.js?build={BUILD}',\n" +
    f"  './waffle-ai.js?build={BUILD}',\n"
)
if anchor not in sw:
    raise SystemExit('Could not find Care app-shell anchor in service worker.')
sw = sw.replace(anchor, addition, 1)
write('service-worker.js', sw)


# ---------------------------------------------------------------------------
# Runtime map
# ---------------------------------------------------------------------------
runtime_map = f"""# Waffle House Runtime Map — Phase 3A

Build: `{BUILD}`

## Browser entry points

Every application HTML page loads only:

- `waffle-runtime.css`
- `waffle-bootstrap.js`

`waffle-bootstrap.js` owns the approved shared compatibility order and performs the maintenance/build gates.

## Canonical feature modules

```text
waffle-bootstrap.js
  └─ shared compatibility base
      ├─ waffle-firebase-config.js
      ├─ waffle-app.js                 # shared data/query/render core
      ├─ V10/V11 base compatibility
      └─ waffle-v11.0.5.js             # canonical feature dispatcher + OCR/retirement compatibility
          ├─ waffle-ui.js              # shared mobile shell, quick actions, final UI contract
          ├─ calendar.js               # Calendar
          ├─ care.js                   # Care / Guest Directory
          ├─ organiser.js              # Organiser
          ├─ logs.js                   # Logs page adapter; data renderer remains in waffle-app.js
          └─ waffle-ai.js              # Ask Waffle UI/client stack
```

## Canonical ownership rules

- Calendar UI changes belong in `calendar.js`.
- Care/Guest Directory UI changes belong in `care.js`.
- Organiser UI/interaction changes belong in `organiser.js` and `organiser.css`.
- Logs page-specific behavior belongs in `logs.js`; shared Audit data/query rendering remains in `waffle-app.js` until the Phase 3C data-layer split.
- Shared navigation, mobile shell, Quick Action completion and final UI contract belong in `waffle-ui.js`.
- Ask Waffle browser/UI behavior belongs in `waffle-ai.js`; provider/data routes remain in Apps Script.

## Legacy policy

Historical `waffle-v11.1.*` feature files remain in the repository for rollback/reference during Phase 3A, but are not allowed to re-enter the live feature loader. `legacySourceDeletion` remains `false` until Phase 3B proves each source safe to delete.

The Active Code Contract is the enforcement point for this map.
"""
write('docs/runtime-map.md', runtime_map)

print('Phase 3A canonical modules generated:')
for name in ('organiser.js','organiser.css','logs.js','waffle-ui.js','waffle-ai.js'):
    print(' -', name)
print('Build:', BUILD)
print('Service worker:', SW_VERSION)
