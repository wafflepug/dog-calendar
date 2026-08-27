#!/usr/bin/env python3
# Phase 3A v2 is intentionally safe to invoke only when the workflow detects
# the V11.1.80 dynamic loader; once embedded, the workflow skips this patch.
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BUILD = '2026.08.27.04'


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')


ui = read('waffle-ui.js')

# V11.1.76 historically appended V11.1.80 as another network script. Phase 3A
# owns the entire shared mobile UI path, so remove that loader and embed the
# proven V11.1.80 implementation directly before V11.1.89.
ui, count = re.subn(
    r"/\* V11\.1\.80 — load the final mobile Calendar header authority after the footer\. \*/\n\(function \(\) \{.*?\n\}\)\(\);\n",
    "/* V11.1.80 dynamic loader retired: implementation is canonical below. */\n",
    ui,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Could not retire V11.1.80 dynamic loader from canonical UI.')

source80 = read('waffle-v11.1.80.js').rstrip()
anchor = '/* ---- source: waffle-v11.1.89.js ---- */'
if anchor not in ui:
    raise SystemExit('Could not find V11.1.89 insertion anchor in canonical UI.')
ui = ui.replace(
    anchor,
    '/* ---- source: waffle-v11.1.80.js ---- */\n' + source80 + '\n\n' + anchor,
    1,
)

if "script.src = 'waffle-v11.1.80.js" in ui:
    raise SystemExit('V11.1.80 dynamic script activation remains in canonical UI.')
for marker in ('v11180MobileHeaderRailVersion','v11181MobileHeaderAvatarsVersion','v11182CleanMobileTodayHeaderVersion'):
    if marker not in ui:
        raise SystemExit(f'Canonical UI missing {marker}.')
write('waffle-ui.js', ui)

manifest = json.loads(read('waffle-build.json'))
legacy_ui = list(manifest.get('legacyUiSources') or [])
if 'waffle-v11.1.80.js' not in legacy_ui:
    insert_at = legacy_ui.index('waffle-v11.1.89.js') if 'waffle-v11.1.89.js' in legacy_ui else len(legacy_ui)
    legacy_ui.insert(insert_at, 'waffle-v11.1.80.js')
manifest['legacyUiSources'] = legacy_ui
write('waffle-build.json', json.dumps(manifest, indent=2) + '\n')

runtime_map = read('docs/runtime-map.md')
needle = '- Shared navigation, mobile shell, Quick Action completion and final UI contract belong in `waffle-ui.js`.'
replacement = '- Shared navigation, mobile shell, mobile header rail, Quick Action completion and final UI contract belong in `waffle-ui.js`.'
if needle in runtime_map:
    runtime_map = runtime_map.replace(needle, replacement, 1)
write('docs/runtime-map.md', runtime_map)

print('Phase 3A v2 patch applied: V11.1.80 is now embedded in waffle-ui.js.')
