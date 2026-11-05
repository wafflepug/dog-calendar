# Palz Stay branded icon system

Reference direction: simple navy/purple symbols, rounded strokes and restrained pastel active backgrounds. The implementation uses code-native inline SVGs, with no raster generation, font dependency or external icon requests.

## Design rules
- 24×24 viewbox, 1.8 rounded stroke; 20px action graphics and 22px navigation graphics. Paw is a filled identity symbol.
- Navy for normal navigation, purple with a soft lavender active tile, light equivalents in dark mode. Existing warning/success/action colours retain their meaning.
- Text labels remain visible. SVGs are decorative and hidden from screen readers; icon-only controls retain or gain accessible names.
- Actual pet photos and booking-source logos are retained. Empty dog-face placeholders use the paw symbol; initials remain initials.

## Implementation
palz-icons.js exposes PALZ_ICONS.svg(name) and a named catalogue. It normalises desktop/mobile navigation, settings mode graphics, the assistant launcher and recognised application-owned emoji icons in controls/status displays. Existing SVG Care tools use the same rounded stroke treatment. Original controls, event handlers and layout remain in place.

A batched observer handles later renders and restores graphics on changing action labels. It ignores its own SVG subtrees, avoids rewriting user notes/forms/names and does not introduce backend requests. The capability, identity, photo and care handlers are unchanged. The service worker precaches the new module.

## Verification
Fictional local-data screenshots: Today, Calendar, Guests, Care Profile, Organiser and Logs at 390px and 1440px; dark Care Profile at 320px. Focused checks confirm decorative navigation images are hidden, SVG icons are present, dynamic control updates are decorated once, user notes retain typed emojis and icon counts stabilise without duplication. No production writes or broad regression suite. The local review gallery includes before/after images.

## Extension
Use PALZ_ICONS.svg with the existing semantic name for new app-owned controls rather than adding emojis or another icon library. Do not decorate freeform user content. Exact token usage unavailable.
