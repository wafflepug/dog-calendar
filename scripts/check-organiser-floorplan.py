#!/usr/bin/env python3
from pathlib import Path
import re

errors = []

floorplan = Path('floorplan.js').read_text(encoding='utf-8')
css = Path('floorplan.css').read_text(encoding='utf-8')
backend = Path('apps-script/V11115Organiser.js').read_text(encoding='utf-8')
bootstrap = Path('waffle-bootstrap.js').read_text(encoding='utf-8')

for needle in [
    'ORGANISER FLOORPLAN STUDIO',
    "type:'floorplan'",
    "action:'get_guest_directory'",
    "action:'get_guest_belongings'",
    'profilePhotoUrl',
    'data-floorplan-profile-photo',
    'data-organiser-tab="floorplan"',
    'data-floorplan-mode="tonight"',
    'data-floorplan-mode="layout"',
    "dataTransfer.setData('text/waffle-dog'",
    "dataTransfer.setData('text/waffle-floorplan-tool'",
    'data-floorplan-tool=',
    'pointerdown',
    'clientToPlanPoint',
    'addToolAtPoint',
    'bindItemMoveResize',
    'data-floorplan-resize=',
    'boxFitsRoom',
    'SECTION_PRESETS',
    'ARTEFACTS',
    'sections: plan.sections',
    'artefacts: plan.artefacts',
    'data-floorplan-item-type=',
    "action:'save_organiser_item'",
    "action:'delete_organiser_item'",
    'floorplan.css?build=',
    "sleep: { label: 'Sleeping'",
    "eat: { label: 'Eating'",
    "safe: { label: 'Safe / Separation'",
]:
    if needle not in floorplan:
        errors.append(f'floorplan.js: missing {needle}')

template_ids = re.findall(r"template\('([^']+)'", floorplan)
if len(template_ids) < 13:
    errors.append(f'floorplan.js: expected at least 13 templates, found {len(template_ids)}')

for required in [
    'small-square','small-long','medium-l','medium-open',
    'large-u','large-multi','multi-room','custom-blank'
]:
    if required not in template_ids:
        errors.append(f'floorplan.js: missing template {required}')

for artefact in ['couch','table','chair','crate','dogbed','food','water','gate','door']:
    if f"{artefact}:" not in floorplan:
        errors.append(f'floorplan.js: missing artefact {artefact}')

for section in ['living','dining','kitchen','overflow','quiet','entry']:
    if f"{section}:" not in floorplan:
        errors.append(f'floorplan.js: missing section preset {section}')

for needle in [
    '@media(max-width:760px)',
    '@media(max-width:460px)',
    '.floorplan-template-grid',
    '.floorplan-canvas',
    '.floorplan-dog.is-selected',
    '.floorplan-toolbox',
    '.floorplan-tool',
    '.floorplan-drag-ghost',
    '.floorplan-dog-avatar.has-photo',
    '.floorplan-summary-avatar.has-photo',
    '.floorplan-section',
    '.floorplan-artefact',
    '.floorplan-resize-handles',
    '.floorplan-item-edit',
    'touch-action:none',
]:
    if needle not in css:
        errors.append(f'floorplan.css: missing {needle}')

if 'floorplan: true' not in backend:
    errors.append('apps-script/V11115Organiser.js: floorplan organiser type is not enabled')

if '"floorplan.js"' not in bootstrap:
    errors.append('waffle-bootstrap.js: floorplan.js is not loaded')
if bootstrap.find('"floorplan.js"') < bootstrap.find('"phase4.js"'):
    errors.append('waffle-bootstrap.js: floorplan should load after phase4 base runtime')

if errors:
    raise SystemExit('\n'.join(errors))

print(
    f'Organiser Floorplan contract passed · {len(template_ids)} templates · '
    'movable/resizable items · room sections · furniture/POIs · profile photos'
)
