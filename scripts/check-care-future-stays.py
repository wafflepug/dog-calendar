#!/usr/bin/env python3
from pathlib import Path

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


require('waffle-bootstrap.js', '"waffle-v11.1.95.js"')
require('waffle-runtime.css', 'waffle-v11.1.95.css')
require('waffle-v11.1.95.js', 'Future Stays')
require('waffle-v11.1.95.js', 'data-v1082-stay-tab')
require('waffle-v11.1.95.js', 'v1082StayKind')
require('waffle-v11.1.95.js', "panel.dataset.v1082StayPanel === 'current'")
require('waffle-v11.1.95.js', 'filterGuestDirectoryCards')
require('waffle-v11.1.95.css', 'data-v11195-stay-view="future"')
require('waffle-v11.1.95.css', 'data-v1082-stay-kind="future"')
require('waffle-v11.1.95.css', '#directory-grid')

if errors:
    raise SystemExit('\n'.join(errors))

print('Care Future Stays contract passed.')
