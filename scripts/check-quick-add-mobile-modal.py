#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / 'index.html').read_text(encoding='utf-8')
runtime_css = (ROOT / 'waffle-runtime.css').read_text(encoding='utf-8')
ui_js = (ROOT / 'waffle-ui.js').read_text(encoding='utf-8')
v108_js = (ROOT / 'waffle-v10.8.js').read_text(encoding='utf-8')
bootstrap = (ROOT / 'waffle-bootstrap.js').read_text(encoding='utf-8')
touch_scroll = (ROOT / 'quick-add-touch-scroll.js').read_text(encoding='utf-8')

required_index = [
    'id="customBookingModal"',
    'id="potentialStayModal"',
    'class="modal-content-panel"',
]
for marker in required_index:
    if marker not in index:
        raise SystemExit(f'Missing Quick Add modal marker in index.html: {marker}')

required_boarding = [
    "m.id='v108BoardingModal'",
    "m.className='v108-modal'",
    'class="v108-modal-card"',
    'data-v108-save-board',
]
for marker in required_boarding:
    if marker not in v108_js:
        raise SystemExit(f'Missing New Boarding modal marker in waffle-v10.8.js: {marker}')

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

required_touch_scroll = [
    'QUICK ADD TOUCH SCROLL',
    '#customBookingModal',
    '#potentialStayModal',
    '#v108BoardingModal',
    '.v108-modal-card',
    '[data-quick-add-modal]',
    'overflow-y: auto !important',
    '-webkit-overflow-scrolling: touch !important',
    'touch-action: pan-y !important',
    'height: 100dvh !important',
    'max-height: none !important',
    'overflow: visible !important',
    'data-quick-add-scroll-spacer',
    '--waffle-quick-add-scroll-clearance',
    "document.getElementById('wh75MobileBottomNav')",
    'Math.max(150, navHeight + 72)',
]
for marker in required_touch_scroll:
    if marker not in touch_scroll:
        raise SystemExit(f'Missing Quick Add touch-scroll marker: {marker}')

if '"quick-add-touch-scroll.js"' not in bootstrap:
    raise SystemExit('Quick Add touch-scroll module is not loaded by waffle-bootstrap.js')

nav_match = re.search(r'#wh75MobileBottomNav\s*\{[^}]*?z-index:(\d+)', ui_js, re.S)
if not nav_match:
    raise SystemExit('Could not resolve mobile bottom-nav z-index from waffle-ui.js')

modal_match = re.search(r'--waffle-quick-add-modal-z:\s*(\d+)', runtime_css)
if not modal_match:
    raise SystemExit('Could not resolve Quick Add modal z-index from waffle-runtime.css')

runtime_modal_match = re.search(r'z-index:\s*(214748\d+)\s*!important', touch_scroll)
if not runtime_modal_match:
    raise SystemExit('Could not resolve final Quick Add touch-scroll z-index')

nav_z = int(nav_match.group(1))
modal_z = int(modal_match.group(1))
runtime_modal_z = int(runtime_modal_match.group(1))
if modal_z <= nav_z:
    raise SystemExit(f'Quick Add modal z-index ({modal_z}) must stay above mobile nav ({nav_z})')
if runtime_modal_z <= nav_z:
    raise SystemExit(f'Final touch-scroll z-index ({runtime_modal_z}) must stay above mobile nav ({nav_z})')

print(
    'Quick Add mobile modal clearance + touch scroll OK: '
    f'New Boarding covered; runtime z={runtime_modal_z} > nav z={nav_z}'
)
