#!/usr/bin/env python3
from pathlib import Path

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


frontend = 'waffle-v11.2.18.js'
bootstrap = 'waffle-bootstrap.js'

# The gallery remains presentation-only and enhances the existing media model.
require(frontend, "VERSION = '11.2.18'")
require(frontend, 'v110RenderMedia')
require(frontend, 'v110-media-grid')
require(frontend, 'v11218-carousel-track')
require(frontend, 'scroll-snap-type:x mandatory')
require(frontend, 'scroll-behavior:smooth')
require(frontend, 'dataset.v11218CarouselPrev')
require(frontend, 'dataset.v11218CarouselNext')
require(frontend, 'dataset.v11218CarouselThumb')
require(frontend, "event.key === 'ArrowLeft'")
require(frontend, "event.key === 'ArrowRight'")
require(frontend, 'prefers-reduced-motion:reduce')
require(frontend, 'autoplay: false')
require(frontend, 'Swipe or use Previous and Next')
require(frontend, 'aria-live')
require(frontend, 'object-fit:contain')

# Runtime: this release adds a brand-new runtime filename, so it can ship on the
# existing coordinated shell revision without repinning every entry page/CSS/SW.
require(bootstrap, '"waffle-v11.2.18.js"')
require(bootstrap, "const ASSET_REVISION = '2026.09.22.02';")
require(bootstrap, "const BUILD = '2026.08.28.01';")
text = Path(bootstrap).read_text(encoding='utf-8')
if text.find('"waffle-v11.2.18.js"') < text.find('"waffle-v11.2.17.js"'):
    errors.append('waffle-bootstrap.js: V11.2.18 must load after V11.2.17')

if errors:
    raise SystemExit('\n'.join(errors))

print('Media carousel contract passed.')
