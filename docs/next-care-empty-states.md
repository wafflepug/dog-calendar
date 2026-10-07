# Next Care item: concise empty details

User story: when a guest has no saved detail in a Care section, I can understand what is missing and find the existing relevant action without repeated introductory text.

Inspect the actual Overview, Detailed care, Records & forms, Photos and Stay history renderers before changing anything. Inventory missing, loading, refresh error, unresolved identity and empty-success states. Record a concrete duplication or confusing action in a fixture first; do not infer a defect from an unused legacy style.

Bound scope to one or two verified sections in `waffle-app.js` and `care.js`, with scoped theme-aware styles if needed. Retain one concise status and an existing relevant action. A missing safety or medication record must remain unknown, not become a reassurance. Preserve exact dog/stay identity, disclosure state, drafts, existing retry handlers and photo/import flows. Add no backend endpoint, initial read, polling or broad observer.

Acceptance: check successful empty records, genuinely missing records, loading, refresh failure and ambiguous identities; use real runtime fixtures that block live writes. At 320px, 390px, Fold/tablet and desktop in both themes, text and actions must wrap, keyboard focus must remain visible and controls must stay clear of fixed navigation. Closing and reopening a section must retain drafts. Physical phone and screen-reader checks remain a separate manual matrix.

Deliver a small implementation, meaningful browser coverage, an updated verification note, and Built Deliverables / Testing Matrix / Next Backlog Item after lead review. Do not repeat search result controls or add a new dashboard introduction.
