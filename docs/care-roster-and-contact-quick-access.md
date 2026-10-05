# Care roster and contact quick access

## Roster search feedback

The roster search should filter only by the selected stay's dog name, owner,
and available Dog ID. Search feedback belongs beside the search input and must
report the number of stays left after applying the active Staying, Arriving,
or Past view. A zero-result query shows which view has no match and offers a
44px Clear search control that restores the list and returns keyboard focus to
the input. The fixed Staying and Arriving count pills keep their existing
global meaning. Profile mode retains the list query and the existing Back
scroll/focus restoration. This is a local presentation change: no eager reads
or new writes.

Acceptance covers dog/owner/Dog ID matches, no matches, clear and focus,
query-plus-view composition, global count pills, and Back restoration. Check
320px, 390px, 768px, and desktop widths, both themes and configured accents.
Future-arrival details remain on demand.

## Selected profile phone action

The selected stay's saved phone remains visible exactly as stored and keeps a
separate Edit control. When the value contains 7–15 digits, with optional
leading `+` and only spaces, parentheses, periods, or hyphens as formatting,
show a Call link using the normalized `tel:` value. Do not infer a country
code. Blank values, placeholders, letters, commas, semicolons, and control
characters have no Call action. The existing Care Brief Call owner action
uses the same validation and selected card value, including an intentional
blank edit.

Acceptance verifies the correct selected stay's number for homonymous dogs,
valid and invalid numbers, preserved edit behavior, responsive layout,
keyboard focus, both themes, and no Apps Script request when using Call.

## Ownership boundary

This slice changes the roster UI and contact rendering in `waffle-app.js` and
`waffle-app.css`, with targeted coverage in `care-roster.spec.js`,
`care-contact-handover.browser.spec.js`, and `care-overview-refinement.browser.spec.js`.
It does not change operation review, operation identity, backend APIs, or
category summary behavior.

## Implementation checkpoint

The actual roster search now reports visible matches beside the input, uses
dog/owner/Dog ID fields rather than hidden profile text, preserves global
status totals, and labels future results as currently loaded so it does not
promise to load later arrivals. Clear search restores keyboard focus. The
profile keeps its saved phone text and separate Edit button, and shows an
actionable call link only for validated phone values. The Care Brief reuses
the same normalizer and respects an intentional blank value.

Targeted verification: `care-roster.spec.js` passed 4/4; navigation continuity
passed all 3 phone-light, phone-dark WebKit, and desktop projects; the
normalizer fixture passed; the contact and same-name selected-stay cases
reported six passing project cases across desktop/mobile Chromium and iPhone
WebKit. `node --check` passed for the edited JavaScript files and `git diff
--check` passed for the owned files. No live Apps Script writes were made.
