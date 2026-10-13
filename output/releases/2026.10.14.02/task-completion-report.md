# Compact Care Items, Photos and History

Release candidate: 2026.10.14.02. Deployment is verified separately in the completion report.

## Built deliverables

1. Items opens with saved belongings and their descriptions. Unchecked items with notes remain listed as not marked present. The existing checklist is available through an Edit checklist disclosure.
2. Photo-note, camera and library controls sit behind Add belongings photos. Saved photos and actionable upload feedback remain visible separately.
3. Photos has one short heading and a single explanation of which photos follow the dog and which belong to the visit.
4. Gallery sections retain their expanded state for the same Dog/Stay identity through matching refreshes. Each toggle identifies its controlled content; another identity starts with its own defaults.
5. Stay history groups visits by validated start-date year, newest first. The newest year starts open and older years start collapsed. Undated stays remain available separately. Scheduled and actual checkout dates, contacts, notes and care-update records retain their meaning.

These changes use the existing read and write paths. They add no startup reads, automatic writes or backend schema changes.

## Testing matrix

| Journey | Verification | Expected result |
| --- | --- | --- |
| Items glance | Open Items with saved present items and an unchecked item with a description | Saved descriptions are readable; unchecked status is explicit; checklist and upload controls start collapsed |
| Edit checklist | Open with keyboard, change a description, collapse/reopen and receive a matching refresh | Exact draft survives; disclosure state is retained; existing save/discard controls target the same stay |
| Photo controls | Open Add belongings photos, enter a note, collapse/reopen | Note remains; saved gallery remains visible; no request is caused by the disclosure |
| Upload recovery | Simulate failed or uncertain upload outcomes | Feedback and recovery action are visible without reopening hidden controls |
| Gallery refresh | Change group expansion, refresh the same identity, then reuse the legacy key with different stable IDs | Same-identity state survives; different identity resets; counts and ARIA relationships remain accurate |
| Visit history | Open a repeat guest with multiple years, an undated visit and an early checkout | All visits remain accessible; year counts are accurate; actual checkout and scheduled dates are distinct |
| Narrow and enlarged layout | Repeat on phone and desktop, light/dark themes, long descriptions and names | Text wraps, touch targets are usable, keyboard focus is visible and footer controls do not obscure actions |

Synthetic browser fixtures block production writes. Browser emulation does not replace physical iPhone/Fold acceptance.

## Next backlog item

Improve spatial keyboard navigation of the five Care tabs on the mobile grid. Arrow Up/Down should move focus by column without activating a new tab or causing a read; existing Left/Right, Home/End and selected-tab behavior remain intact.

## Local verification

- Luna implemented the bounded Items and Photos/history stories; the lead model reviewed integration and corrected identity/visibility focus guards and the active style cascade.
- 301 Node tests pass. 61 focused browser cases pass: 8 new full-runtime/fallback cases across Chromium and WebKit, 7 existing Photos/fallback cases, 45 existing overview/viewer cases across desktop, phone and WebKit projects, and one existing full-runtime shared-read journey.
- The full-runtime layout measure caught legacy Photos fonts at 10px/8px. The scoped cascade fix now measures 18px for the header, 14px for group titles and 12px for descriptions, with a 72.8px group toggle on the synthetic phone fixture.
- Matching gallery refreshes retain open groups and keyboard focus without taking focus from another control. Same-key/different-ID fixtures reset disclosure state. History remains lazy; grouping and native disclosure toggles introduce no additional reads.
- The Items fixture permits only an intercepted, in-memory save for its exact synthetic stay. Save payload and descriptions remain intact; no production mutation is permitted. Saved photos can be scrolled clear of the fixed footer.
- Existing isolated renderer fixtures were updated to include the draft-map dependency, extract the now-multiline history function, and enter keyboard modality before asserting focus-visible. Their behavior assertions remain intact.
- Optional screenshot exports are separate from the functional CI path; ordinary failures retain screenshots/traces. The native disclosure and layout assertions run regardless of screenshot export.

Physical phone hardware and real-device latency are unverified. This batch changes only frontend UI; it introduces no Apps Script source changes, data migration, paid service or access requirement. Current-head CI, merge SHA and live deployment attribution are added to the verified report after release.

CI caught one stale expectation for the previous Photos heading. The regression now asserts the exact new heading and scope hint; its shared-read and no-mutation assertions remain intact. The corrected full-runtime case passed locally.
