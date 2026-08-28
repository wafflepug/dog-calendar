#!/usr/bin/env python3
from pathlib import Path

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


def forbid(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle in text:
        errors.append(f'{path}: must not contain {needle}')


require('waffle-bootstrap.js', '"waffle-v11.1.95.js"')
require('waffle-bootstrap.js', '"waffle-v11.1.96.js"')
require('waffle-bootstrap.js', '"waffle-v11.1.97.js"')
require('waffle-bootstrap.js', '"waffle-v11.1.98.js"')
require('waffle-bootstrap.js', '"waffle-v11.1.99.js"')
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

# V11.1.97 prevents a future stayKey from falling through to the historical
# V10.8.2 "not in current grid => Past Stays" deep-link assumption.
require('waffle-v11.1.97.js', 'originalTryPastDeepLink')
require('waffle-v11.1.97.js', 'isFutureStayKey')
require('waffle-v11.1.97.js', "window.v1082SwitchStayView('future'")
require('waffle-v11.1.97.js', 'WAFFLE_V11196_FUTURE_RANGE?.maintain?.()')
require('waffle-v11.1.97.js', '#directory-grid .directory-card[data-directory-stay-key]')
require('waffle-v11.1.97.js', 'openDirectoryGuestProfile')
require('waffle-v11.1.97.js', 'A future booking must never be reclassified as Past')
require('waffle-v11.1.97.js', 'return originalTryPastDeepLink.apply')

# V11.1.98 makes every confirmed Calendar bar route to Care using a stable
# dog/start/end identity. This must also work for grouped labels containing &.
require('waffle-v11.1.98.js', '.wh65-bar.confirmed[data-wh65-event]')
require('waffle-v11.1.98.js', 'parseCalendarEventKey')
require('waffle-v11.1.98.js', 'stableStayKey')
require('waffle-v11.1.98.js', "url.searchParams.set('dogName'")
require('waffle-v11.1.98.js', "url.searchParams.set('startDate'")
require('waffle-v11.1.98.js', "url.searchParams.set('stayView'")
require('waffle-v11.1.98.js', 'findRequestedCard')
require('waffle-v11.1.98.js', 'openDirectoryGuestProfile')
require('waffle-v11.1.98.js', 'Delete Confirmed Stay')
require('waffle-v11.1.98.js', "action: 'delete_confirmed_stay'")
require('waffle-v11.1.98.js', "localStorage.removeItem('boardingDataCache')")

# V11.1.99 fixes the remaining source gap on Care itself. Native directory
# rendering only includes the next seven days, so the full CSV is parsed without
# calling parseCSVToEvents (which mutates the directory) and is temporarily fed
# through V11.1.96's adapter contract.
require('waffle-v11.1.99.js', 'CARE FUTURE STAY DATA BRIDGE')
require('waffle-v11.1.99.js', "localStorage.getItem('boardingDataCache')")
require('waffle-v11.1.99.js', 'confirmedEventsFromCsv')
require('waffle-v11.1.99.js', "lowerType === 'meet & greet'")
require('waffle-v11.1.99.js', "lowerType === 'potential stay'")
require('waffle-v11.1.99.js', 'WAFFLE_V11196_FUTURE_RANGE')
require('waffle-v11.1.99.js', 'globalCalendar = bridge')
require('waffle-v11.1.99.js', 'REFRESH_MS = 15000')
forbid('waffle-v11.1.99.js', 'parseCSVToEvents(')

# Confirmed-stay deletion is booking-scoped. It must remove the exact confirmed
# boarding row, audit it, invalidate Calendar/Care and retain master profile data.
require('apps-script/V11198ConfirmedStayDelete.js', 'deleteConfirmedStayV11198_')
require('apps-script/V11198ConfirmedStayDelete.js', 'findV108BoardingRow_')
require('apps-script/V11198ConfirmedStayDelete.js', 'sheet.deleteRow(row)')
require('apps-script/V11198ConfirmedStayDelete.js', 'Confirmed Stay Deleted')
require('apps-script/V11198ConfirmedStayDelete.js', 'masterProfileRetained: true')
require('apps-script/V11198ConfirmedStayDelete.js', 'processSheetAction_ = function(data)')
require('apps-script/V11198ConfirmedStayDelete.js', 'delete_confirmed_stay')

if errors:
    raise SystemExit('\n'.join(errors))

print('Care Future Stays contract passed.')
