#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
module = (root / 'waffle-sitter-navigation.js').read_text(encoding='utf-8')
bootstrap = (root / 'waffle-bootstrap.js').read_text(encoding='utf-8')

required = {
    'desktop sidebar': 'whSitterDesktopSidebar',
    'desktop breakpoint': '@media(min-width:821px)',
    'sidebar body state': 'wh-sitter-desktop-sidebar-ready',
    'settings section': 'whSitterToolsSettingsSection',
    'settings action': 'Open Sitter Tools',
    'direct launcher suppression': 'wh-sitter-tools-relocated',
    'launcher matcher': r'\bsitter\s+tools\b',
    'canonical settings integration': 'WAFFLE_APPEARANCE?.openSettings',
    'today route': "index.html?view=today",
    'calendar route': "index.html?view=calendar",
    'care route': "directory.html",
    'organiser route': "reminders.html",
    'logs route': "audit.html",
}

missing = [name for name, marker in required.items() if marker not in module]
if missing:
    raise SystemExit('Missing sitter navigation contract markers: ' + ', '.join(missing))

if '"waffle-sitter-navigation.js"' not in bootstrap:
    raise SystemExit('waffle-sitter-navigation.js must be loaded by waffle-bootstrap.js')

if bootstrap.index('"waffle-sitter-navigation.js"') < bootstrap.index('"waffle-v11.2.01.js"'):
    raise SystemExit('Sitter navigation must load after existing compatibility/product layers')

# Sitter Tools belongs in Settings, not the desktop sidebar markup.
sidebar_block = module.split('sidebar.innerHTML = `', 1)[1].split('`;', 1)[0]
if 'Sitter Tools' in sidebar_block:
    raise SystemExit('Desktop sidebar must not expose Sitter Tools directly')
if 'Settings' not in sidebar_block:
    raise SystemExit('Desktop sidebar must retain Settings access')

print('Sitter navigation contract OK')
