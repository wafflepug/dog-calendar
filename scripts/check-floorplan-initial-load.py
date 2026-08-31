#!/usr/bin/env python3
from pathlib import Path

errors = []
area = Path('floorplan-area-labels.js').read_text(encoding='utf-8')
worker = Path('service-worker.js').read_text(encoding='utf-8')

for needle in [
    'ensureFloorplanRegistration',
    'data-organiser-tab="floorplan"',
    'data-organiser-view="floorplan"',
    'activateFloorplanFromGuard',
    'WAFFLE_ORGANISER_FLOORPLAN',
    'MutationObserver(scheduleApply)',
]:
    if needle not in area:
        errors.append(f'floorplan-area-labels.js: missing initial-load guard marker {needle}')

for needle in [
    "path.endsWith('/waffle-bootstrap.js')",
    "path.endsWith('/floorplan.js')",
    "path.endsWith('/floorplan-area-labels.js')",
]:
    if needle not in worker:
        errors.append(f'service-worker.js: missing network-first Floorplan runtime marker {needle}')

if errors:
    raise SystemExit('\n'.join(errors))

print('Floorplan initial-load contract passed · persistent tab registration · network-first Floorplan runtime')
