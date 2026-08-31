#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'floorplan-outdoors-dark.js').read_text(encoding='utf-8')
css = (root / 'floorplan-outdoors-dark.css').read_text(encoding='utf-8')
bootstrap = (root / 'waffle-bootstrap.js').read_text(encoding='utf-8')
workflow = (root / '.github/workflows/organiser-floorplan.yml').read_text(encoding='utf-8')

required_js = {
    'outdoor carrier reuses accepted core section tool': 'section:entry',
    'outdoor semantic preset persists': "item.preset = 'outdoor'",
    'outdoor default label': "item.label = 'Outdoors'",
    'outdoor ids survive renamed labels': 'state.outdoorIds',
    'manual save wrapper compatibility marker': '__waffleFloorplanDraftWrapper',
    'first-drag compatibility dependency': 'WAFFLE_FLOORPLAN_FIRST_DRAG_FIX',
    'dark stylesheet is loaded': 'floorplan-outdoors-dark.css',
}
for label, needle in required_js.items():
    assert needle in js, f'Missing {label}: {needle}'

required_css = {
    'outdoor section styling': '.floorplan-section.kind-outdoor rect',
    'app dark-theme hook': 'body.dark-theme .floorplan-shell',
    'dark canvas': 'body.dark-theme .floorplan-canvas',
    'dark room footprint': 'body.dark-theme .floorplan-rooms polygon',
    'high contrast section labels': 'body.dark-theme .floorplan-section-label',
    'high contrast care labels': 'body.dark-theme .floorplan-zone-label',
    'high contrast poi labels': 'body.dark-theme .floorplan-artefact-label',
    'dark custom-area input': 'body.dark-theme .floorplan-custom-area-builder input',
    'dark save control': 'body.dark-theme .floorplan-draft-save',
    'dark walls': 'body.dark-theme .floorplan-artefact.kind-wall-h rect',
    'forced colors support': '@media (forced-colors:active)',
}
for label, needle in required_css.items():
    assert needle in css, f'Missing {label}: {needle}'

first_drag = bootstrap.find('"floorplan-first-drag-fix.js"')
outdoors = bootstrap.find('"floorplan-outdoors-dark.js"')
assert first_drag >= 0, 'First-drag runtime module missing from bootstrap'
assert outdoors > first_drag, 'Outdoors/dark module must load after first-drag compatibility layer'

assert 'node --check floorplan-outdoors-dark.js' in workflow, 'Workflow must syntax-check outdoors module'
assert 'python3 scripts/check-floorplan-outdoors-dark.py' in workflow, 'Workflow must run outdoors/dark contract'

print('Floorplan outdoors + dark contrast contract: OK')
