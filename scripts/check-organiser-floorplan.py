#!/usr/bin/env python3
from pathlib import Path
import re

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


floorplan = Path('floorplan.js').read_text(encoding='utf-8')
css = Path('floorplan.css').read_text(encoding='utf-8')
backend = Path('apps-script/V11115Organiser.js').read_text(encoding='utf-8')
bootstrap = Path('waffle-bootstrap.js').read_text(encoding='utf-8')

for needle in [
    'ORGANISER FLOORPLAN STUDIO',
    "type:'floorplan'",
    "action:'get_guest_directory'",
    "data-organiser-tab=\"floorplan\"",
    "data-floorplan-mode=\"tonight\"",
    "data-floorplan-mode=\"layout\"",
    "dataTransfer.setData('text/waffle-dog'",
    "query({ action:'save_organiser_item'",
    "query({ action:'delete_organiser_item'",
    "floorplan.css?build=",
    "sleep: { label: 'Sleeping'",
    "eat: { label: 'Eating'",
    "safe: { label: 'Safe / Separation'",
]:
    if needle not in floorplan:
        errors.append(f'floorplan.js: missing {needle}')

# The template library intentionally covers small -> large plus a custom start.
template_ids = re.findall(r"template\('([^']+)'", floorplan)
if len(template_ids) < 13:
    errors.append(f'floorplan.js: expected at least 13 templates, found {len(template_ids)}')
for required in ['small-square','small-long','medium-l','medium-open','large-u','large-multi','multi-room','custom-blank']:
    if required not in template_ids:
        errors.append(f'floorplan.js: missing template {required}')

for needle in ['@media(max-width:760px)', '@media(max-width:460px)', '.floorplan-template-grid', '.floorplan-canvas', '.floorplan-dog.is-selected']:
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

print(f'Organiser Floorplan contract passed · {len(template_ids)} templates')
