#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / 'index.html').read_text(encoding='utf-8')
runtime_css = (ROOT / 'waffle-runtime.css').read_text(encoding='utf-8')
ui_js = (ROOT / 'waffle-ui.js').read_text(encoding='utf-8')

required_index = [
    'id="customBookingModal"',
    'id="potentialStayModal"',
    'class="modal-content-panel"',
]
for marker in required_index:
    if marker not in index:
        raise SystemExit(f'Missing Quick Add modal marker in index.html: {marker}')

required_css = [
    'QUICK ADD MOBILE MODAL CLEARANCE',
    '#customBookingModal',
    '#potentialStayModal',
    '.modal-content-panel',
    '100dvh',
    'env(safe-area-inset-bottom)',
    'overflow-y: auto !important',
    'overscroll-behavior: contain',
]
for marker in required_css:
    if marker not in runtime_css:
        raise SystemExit(f'Missing mobile modal safety marker in waffle-runtime.css: {marker}')

nav_match = re.search(r'#wh75MobileBottomNav\s*\{[^}]*?z-index:(\d+)', ui_js, re.S)
if not nav_match:
    raise SystemExit('Could not resolve mobile bottom-nav z-index from waffle-ui.js')

modal_match = re.search(r'--waffle-quick-add-modal-z:\s*(\d+)', runtime_css)
if not modal_match:
    raise SystemExit('Could not resolve Quick Add modal z-index from waffle-runtime.css')

nav_z = int(nav_match.group(1))
modal_z = int(modal_match.group(1))
if modal_z <= nav_z:
    raise SystemExit(f'Quick Add modal z-index ({modal_z}) must stay above mobile nav ({nav_z})')

print(f'Quick Add mobile modal clearance OK: modal z={modal_z} > nav z={nav_z}')
