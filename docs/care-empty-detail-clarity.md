# Care empty detail clarity

The resolved empty Detailed care section keeps one body status and its existing Edit action. Its duplicate zero-field heading summary is hidden; populated profiles retain their saved-field count and source. Loading, failed refresh, missing profile and unresolved identity remain separate states. No backend read or write is added.

Cross-device regression also exposed a WebKit pointer-target mismatch while scrolling between expanded Care categories. The category panels no longer apply CSS content containment, avoiding a separate contained layout/paint boundary around these interactive sections. Real pointer assertions and event-time diagnostics remain in the regression fixture.

## Manual verification

1. Open a guest whose resolved intake has no saved fields or source. Detailed care must show one empty intake status and an available Edit action.
2. Edit a field without saving, collapse and reopen its category, and verify the draft remains. Discard without changing production data.
3. Open a populated profile: its field count/source must remain available. A later refresh to empty must not leave a stale populated heading.
4. Slow or fail a read: retain loading/error status, retry controls and saved values where available. A missing record or unresolved dog identity must not be described as a safe or complete profile.
5. Check 320px, 390px, Fold/tablet and desktop in light and dark themes. Text must wrap, keyboard focus remain visible, and fixed navigation must not obscure actions.

Automated fixtures block live writes. Physical phone and screen-reader checks remain manual.

Next bounded item: clarify blank medication information in the Care overview, preserving the distinction between unknown instructions and an explicitly saved no-medication response. Inspect the existing data model before changing labels.
