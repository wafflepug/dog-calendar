#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
module = (root / 'waffle-sitter-navigation.js').read_text(encoding='utf-8')
desktop_home = (root / 'desktop-home-sidebar.js').read_text(encoding='utf-8')
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

home_required = {
    'desktop-only breakpoint': "(min-width: 821px)",
    'Home label': "label.textContent = 'Home'",
    'Home destination': "home.setAttribute('href', 'index.html?view=today')",
    'calendar item lookup': "[data-wh-sitter-route=\"calendar\"]",
    'calendar removal': 'calendar.remove()',
    'desktop Home marker': 'WAFFLE_DESKTOP_HOME_SIDEBAR',
}

home_missing = [name for name, marker in home_required.items() if marker not in desktop_home]
if home_missing:
    raise SystemExit('Missing desktop Home sidebar markers: ' + ', '.join(home_missing))

if '"waffle-sitter-navigation.js"' not in bootstrap:
    raise SystemExit('waffle-sitter-navigation.js must be loaded by waffle-bootstrap.js')
if '"desktop-home-sidebar.js"' not in bootstrap:
    raise SystemExit('desktop-home-sidebar.js must be loaded by waffle-bootstrap.js')

if bootstrap.index('"waffle-sitter-navigation.js"') < bootstrap.index('"waffle-v11.2.01.js"'):
    raise SystemExit('Sitter navigation must load after existing compatibility/product layers')
if bootstrap.index('"desktop-home-sidebar.js"') < bootstrap.index('"waffle-sitter-navigation.js"'):
    raise SystemExit('Desktop Home sidebar refinement must load after canonical sitter navigation')

# Sitter Tools belongs in Settings, not the desktop sidebar markup.
sidebar_block = module.split('sidebar.innerHTML = `', 1)[1].split('`;', 1)[0]
if 'Sitter Tools' in sidebar_block:
    raise SystemExit('Desktop sidebar must not expose Sitter Tools directly')
if 'Settings' not in sidebar_block:
    raise SystemExit('Desktop sidebar must retain Settings access')

# The refinement is web/desktop-only and must not rewrite mobile navigation.
for mobile_marker in ('wh75MobileBottomNav', 'wh75MobileDrawer', 'wh75MenuButton'):
    if mobile_marker in desktop_home:
        raise SystemExit(f'Desktop Home sidebar must not modify mobile navigation: {mobile_marker}')

print('Sitter navigation contract OK')
