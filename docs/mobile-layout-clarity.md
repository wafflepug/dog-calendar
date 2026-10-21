# Mobile layout clarity

The shared mobile menu and Palz Stay logo now occupy one opaque header above page content. This addresses the launcher covering Care's Back label and other headings as a person scrolls. The original menu and brand nodes are reused, preserving their handlers and restoring their desktop locations when the viewport crosses 820px. Care's Back bar stays in the normal document flow.

The header reserves safe-area space and scroll clearance. Footer labels wrap within their individual tabs when text grows, and the footer uses a solid background. A single guarded size observer measures the existing footer so page clearance can follow its height; it disconnects on desktop. These changes add no guest request, storage entry, backend change or new navigation action. Drawer and Settings layers must remain above the header. Repeated layout maintenance must not continually mutate the DOM.

On mobile Calendar, the date and Month/Fortnight/Week selector occupy their own row, with previous/next and Refresh below. This prevents the Week label colliding with Refresh. Calendar buttons retain at least 44px height and can wrap at larger text sizes. Settings also closes with Escape while other dialogs retain their own Escape handling.

Returning guest rows no longer run a vertical entrance animation. The animation previously moved a row during Back's anchor measurement, leaving a small scroll-position drift. The existing strict position and identity checks remain in place.

On narrow Care screens, Staying/Arriving/Past labels sit above their counts. Badges expand with their text instead of clipping a three-digit value into a fixed circle. The larger-text test checks the actual text ranges of both labels and numbers, including text that an overflow-clipping rule could otherwise hide.

## Verification matrix

Use synthetic fixtures; do not modify live guests to verify layout.

| Journey | Steps | Expected result |
| --- | --- | --- |
| Care profile | Open a guest, use Back, then open again at 320/390px | Back is visible, readable and tappable below the header; the guest anchor is preserved |
| Long labels | Use a long guest name, status, source and three-digit counts | Labels wrap without hiding another label or creating page-wide horizontal scrolling |
| Scrolling | Scroll shallowly and to the end in portrait and short landscape | The opaque header separates its menu from content; important controls can be scrolled into view above the footer |
| Navigation | Open and close the drawer; open Settings | One menu responds once; overlays cover the header and their controls remain usable |
| Responsive layout | Resize 390 → 821 → 390px | Desktop locations are restored; the same menu and logo nodes return without duplicates or extra reads |
| Enlarged text | Double actual rendered label/control font sizes, in both themes | Navigation labels remain distinct; Care Back and modal actions remain usable |
| Owner and date dialogs | Enter a long owner phone/name; open stay dates on narrow and landscape screens | Labels are separate from inputs, dates are readable and actions remain reachable |
| Calendar | Scroll the calendar on a narrow phone | Calendar navigation remains visible and tappable below the header |

Automated coverage lives in `playwright.phone-clearance.config.js` and the existing owner-handoff suite. Browser emulation covers selected widths and engines; physical iOS/Android checks, text scaling and device-specific safe areas remain part of release acceptance.

## Next backlog item

Audit multi-dog arrivals and repeated day-care booking at narrow widths. Reuse the existing visit planner and permanent Dog IDs. Improve only demonstrated grouping or label problems, preserving per-visit save identity, partial-failure recovery and explicit owner sharing without additional startup reads.
