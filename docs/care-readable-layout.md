# Care readable layout

Release candidate: 2026.10.27.01. Care-only frontend changes.

## Built deliverables

- Activate the roster's two-column layout so the photo, identity, status, booking source and care exceptions have deliberate positions.
- Place booking-source badges in a dedicated row, clear of the guest identity and care exceptions.
- Keep Edit routine beside Feeding & walks when space permits, using the same quiet text treatment as Emergency details and Update handover. Retain a 44px touch target and visible focus; narrow layouts can wrap.

No new controls, icons, backend reads or data mutations. Exact dog/stay identities, drafts and check-in/checkout behavior are preserved. Calendar and Today content is unchanged.

## Testing matrix

1. Open Care at 320px, 390px, tablet and desktop widths. Check long names, photos/fallbacks, permanent Dog IDs, source labels and care badges. Nothing should overlap or require horizontal page scrolling.
2. Enlarge roster text to 200%. Check complete labels and independent rows. Repeat in light and dark themes with Chromium and WebKit.
3. Open a current profile. Feeding & walks and Edit routine share a heading row when space permits; small screens may stack cleanly. Confirm a minimum 44px action and visible keyboard focus.
4. Select Edit routine. The existing food/walks editor opens directly and saved fields remain available. Resizing and changing themes must not request another profile read.
5. Run existing Care mobile clarity, roster, alignment and current-stay navigation checks. Retain full medication/safety text and current-stay selection.

Automated emulation does not replace physical-phone validation.

## Next backlog item

Validate arrival, quick daily-care lookup and checkout with the sitter on physical phones; record observed friction before adding controls. Estimated frequency: daily; expected benefit: fewer reading/layout interruptions; effort: one bounded observation session. No measured time saving is claimed.
