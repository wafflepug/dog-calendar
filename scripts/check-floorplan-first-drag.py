#!/usr/bin/env python3
from pathlib import Path

fix = Path('floorplan-first-drag-fix.js').read_text(encoding='utf-8')
bootstrap = Path('waffle-bootstrap.js').read_text(encoding='utf-8')

required = [
    'FLOORPLAN FIRST-DRAG STATE FIX',
    'referenceStableArray',
    "property === 'map'",
    'return target',
    'stabiliseResponse',
    "payload.action === 'save_organiser_item'",
    "payload.type === 'floorplan'",
    '__waffleFloorplanFirstDragFix',
    'WAFFLE_FLOORPLAN_AREA_LABELS',
]
missing = [needle for needle in required if needle not in fix]
if missing:
    raise SystemExit('floorplan-first-drag-fix.js missing: ' + ', '.join(missing))

base = bootstrap.find('"floorplan.js"')
enhancement = bootstrap.find('"floorplan-area-labels.js"')
first_drag = bootstrap.find('"floorplan-first-drag-fix.js"')
if min(base, enhancement, first_drag) < 0:
    raise SystemExit('waffle-bootstrap.js is missing a Floorplan runtime module')
if not (base < enhancement < first_drag):
    raise SystemExit('Floorplan first-drag fix must load after the base and draft enhancement modules')

print('Floorplan first-drag contract passed · reference-stable draft arrays · runtime order protected')
