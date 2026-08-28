#!/usr/bin/env python3
from pathlib import Path

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


require('waffle-bootstrap.js', '"waffle-v11.1.95.js"')
require('waffle-bootstrap.js', '"waffle-v11.1.96.js"')
require('waffle-runtime.css', 'waffle-v11.1.95.css')
require('waffle-runtime.css', 'waffle-v11.1.96.css')
require('waffle-v11.1.95.js', 'Future Stays')
require('waffle-v11.1.95.js', 'data-v1082-stay-tab')
require('waffle-v11.1.95.js', 'v1082StayKind')
require('waffle-v11.1.95.js', "panel.dataset.v1082StayPanel === 'current'")
require('waffle-v11.1.95.js', 'filterGuestDirectoryCards')
require('waffle-v11.1.95.css', 'data-v11195-stay-view="future"')
require('waffle-v11.1.95.css', 'data-v1082-stay-kind="future"')
require('waffle-v11.1.95.css', '#directory-grid')

# V11.1.96 must source confirmed events beyond the historical seven-day Care
# subset, retain the existing Care profile machinery and group arrivals by month.
require('waffle-v11.1.96.js', 'FULL_MONTHS_AHEAD = 6')
require('waffle-v11.1.96.js', 'getCalendarAdapter')
require('waffle-v11.1.96.js', 'props.isMeetGreet === true || props.isPotential === true')
require('waffle-v11.1.96.js', 'data-v11196-synthetic-future="true"')
require('waffle-v11.1.96.js', 'data-directory-detail="profile"')
require('waffle-v11.1.96.js', 'data-directory-detail="belongings"')
require('waffle-v11.1.96.js', 'groupFutureCardsByMonth')
require('waffle-v11.1.96.js', 'Next 6+ months · grouped by month')
require('waffle-v11.1.96.css', '.v11196-month-heading')
require('waffle-v11.1.96.css', 'grid-column: 1 / -1')

if errors:
    raise SystemExit('\n'.join(errors))

print('Care Future Stays contract passed.')
