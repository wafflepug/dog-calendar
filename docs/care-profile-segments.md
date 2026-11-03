# Segmented Care profiles — 3 November 2026

## Built deliverables
- Overview: existing safety, medication, feeding, owner and handover essentials.
- Activity: completed feeding/walk/medication entries; loads on first selection only.
- Records: existing intake and legacy-document controls, opened directly.
- Tools: visible photo, editing, refresh, summary and booking actions, plus contact/setup sections.
- Persistent dog identity, dates, stay operations and first-level owner-form action. Owner-form status shares a row where space permits.

The Directory-only `care-profile-segments.js` annotates existing nodes rather than cloning or relocating action controls. It preserves existing handlers and in-memory drafts. A pressed-button section group supports arrows, Home and End with visible focus. Native disclosure content opens when its segment is selected; its outer heading is no longer another collapse control. Existing deep links that open a hidden disclosure reveal its corresponding segment. No backend, schema, notification or write-policy change.

## Verification performed
Syntax and diff checks; fictional local preview at 320/390/1440px, including a 320px dark view. All four segments navigated, keyboard End selected Tools, an unsaved activity note survived Overview/Activity switching, and segment switching caused zero additional profile lookups. Activity read count was zero before selection and one after repeated visits. No page errors or horizontal overflow observed. No production writes or regression suites were run. Native screen-reader behaviour on physical phones remains unverified.

## Testing matrix for sitter review
1. Open a current dog: check identity/dates, stay controls and owner form remain available in each segment.
2. Read Overview; select Activity, enter a harmless unsaved note, switch away/back and confirm it remains. Do not record an activity solely to test navigation.
3. Select Records to see intake/documents directly. Select Tools for photo editing/gallery, contact, setup and Book Again. Cancel any editor/booking preview without saving.
4. Use Tab, arrows, Home/End; inspect focus and wrapping at narrow widths and enlarged text.
5. Switch dogs and confirm the new profile starts on Overview with the correct identity. Existing loading/error/identity warnings must remain honest.

Screenshot summary: `output/care-segment-review/review.html`, fictional Milo/Alex data. Cache revision 2026.11.03.09. Rollback is a normal source revert; there is no data migration.

## Next backlog item
Reduce repeated blank optional fields within detailed Care categories while preserving safety warnings and explicit missing-data states.

Token report: one Luna development task plus lead review. Exact token counts are unavailable; none are estimated.
