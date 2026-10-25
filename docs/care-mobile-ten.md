# Care at a glance — ten UI enhancements

Release: 2026.10.26.01. Scope: Care (directory.html) only. Calendar and Today screen content remains unchanged; their existing asset revision metadata advances for cache consistency. No backend or schema changes.

## Built deliverables

1. Compact selected profile identity: photo, name, permanent Dog ID, status and stay dates wrap together.
2. Larger roster photos and matching initial fallback footprints improve recognition.
3. Status, source and care-alert labels wrap without covering the dog identity.
4. Routine operational and owner actions wrap with at least 44px touch targets.
5. Feeding and walks are visible in the initial care overview.
6. Owner name and the existing verified Call owner action are visible without expanding routine details.
7. Short handover notes show directly; long notes have their own native disclosure. Unchanged rendering preserves its open state.
8. Edit routine opens the existing Food & Walks editor and focuses its relevant fields.
9. Full medication and safety text wraps; these values are never clamped or hidden behind the handover disclosure.
10. Consistent section navigation uses five columns on desktop and three-plus-two on phones.

## Testing matrix

| Journey | Steps and expected outcome |
| --- | --- |
| Daily care | Open a guest. Identity, status, dates, safety, medication, feeding, walks and owner are visible. No extra profile/history read is introduced. |
| Handover | Short text is immediately visible. Expand a long note to see its full content. Unchanged re-render retains the disclosure state. Switch guests and confirm the correct note. |
| Routine edit | Select Edit routine. Food & Walks opens in the existing editor, with focus in a routine field. Cancel/save retains the existing draft and exact stay safeguards. Opening alone writes nothing. |
| Narrow screens | At 320px and 390px, inspect long names, IDs, source, statuses and alerts. No horizontal document overflow or covered text; routine targets are at least 44px. |
| Large screens | At 1440px inspect the same identity and overview without stretched, overlapping controls. |
| Accessibility | Repeat in light/dark, keyboard navigation and enlarged text. Visible labels remain legible and full safety/medication text remains available. |
| Missing data | Missing routine/contact remains unknown; do not infer readiness, a phone number or a successful save. |
| Scope | Run the Care scope contract and compare Calendar JS and normalized Today HTML to the base revision. No Care stylesheet is linked from Today. |

Automated coverage uses synthetic guests and blocked production mutations. Browser emulation does not certify every physical phone. Publication evidence and screenshots are stored under output/care-mobile-ten locally; no real guest snapshot is included.

## Architecture and performance

The stylesheet is linked only from Care and every selector is Directory-gated. The change adds no startup request, observer, background refresh or reader. First-level summaries reuse already loaded data. Edit routine delegates to existing editor behavior; owner calling retains its existing identity checks. Native handover disclosure rendering changes only when the note changes.

## Next backlog item

Observe representative sitter tasks on physical phones: arrival review, a feeding lookup, owner contact and checkout. Use the measured hesitation or repeated presses to choose the next change.
