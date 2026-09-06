#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / 'index.html').read_text(encoding='utf-8')
runtime_css = (ROOT / 'waffle-runtime.css').read_text(encoding='utf-8')
ui_js = (ROOT / 'waffle-ui.js').read_text(encoding='utf-8')
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
    '#v10QuickAddSheet',
    '#customBookingModal',
    '#potentialStayModal',
    '[data-quick-add-modal]',
    '.waffle-quick-add-scroll-host',
    '.waffle-quick-add-scroll-panel',
    '.waffle-quick-add-action-row',
    'overflow-y: auto !important',
    '-webkit-overflow-scrolling: touch !important',
    'touch-action: pan-y !important',
    'padding-bottom: calc(170px + env(safe-area-inset-bottom)) !important',
    'max-height: none !important',
    'height: auto !important',
    'overflow: visible !important',
    'MutationObserver',
    'function findHost',
    'function markActionRow',
]
for marker in required_touch_scroll:
    if marker not in touch_scroll:
        raise SystemExit(f'Missing Quick Add touch-scroll marker: {marker}')

if '"quick-add-touch-scroll.js"' not in bootstrap:
    raise SystemExit('Quick Add touch-scroll module is not loaded by waffle-bootstrap.js')

if '#v10QuickAddSheet' not in ui_js:
    raise SystemExit('Canonical #v10QuickAddSheet is missing from waffle-ui.js')

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

print(f'Quick Add mobile modal clearance + canonical sheet touch scroll OK: modal z={modal_z} > nav z={nav_z}')
