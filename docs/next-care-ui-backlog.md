# Next UI backlog

Implemented candidate, 9 October 2026: four UI refinements are documented in [Cleaner Care & Notification Recovery](care-cleaner-ui.md): notification retry states, collapsed maintenance tools, compact guest/stay layout and compact read-only care fields. Validation and release verification are required before treating the candidate as deployed.

## Next: Records & forms document recovery

User story: after explicitly uploading a document, I return to the same guest and can see the current document status without re-opening the whole profile.

Inspect the existing uploader-return refresh path on mobile/PWA before choosing a change. Keep explicit upload intent and the existing OCR implementation. Any refresh enhancement must stay scoped to the selected stay and reject responses for a different selected identity. Do not add eager document reads.

Acceptance: cancel/no upload does not claim a new document; completed upload refreshes only the selected stay; failure keeps available details with a clear retry; switching guests while a request is pending cannot show another guest's document. Check 320px, mobile safe areas, keyboard focus, both themes and settings accents.

## Then: Care section navigation consistency

Inspect the desktop tabs and mobile section disclosure patterns against the new compact profile. Improve only demonstrated inconsistency: clear current section, predictable collapse/reopen, readable labels and restored focus. Preserve lazy loading and editing drafts.

Deferred separately: backend persisted-ID Care reads and a reviewed legacy migration map described in next-care-search-consistency.md. This is a data correctness task and should not be bundled into visual polish.
