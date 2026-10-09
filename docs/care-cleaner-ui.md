# Cleaner Care & Notification Recovery

Release candidate: 2026.10.09.02. Four UI changes; existing boarding, intake and operation data contracts are retained.

## Built deliverables

1. Notification refresh recovery: retain the available feed during a failed refresh, expose a single Refresh/Retry action, distinguish a current response from saved activity, and coalesce concurrent reads. No polling or additional initial reads.
2. Care roster maintenance: keep search and filters prominent; place occasional identity assignment and older-stay linking under a collapsed **Manage records** disclosure. Existing controls and their confirmation flows remain connected.
3. Selected guest layout: bring the photo, identity, stay dates and operational actions together with less vertical space. Preserve warnings and readable action labels.
4. Detailed Care density: reduce unnecessary space in read-only fields, while retaining complete values and separate, touch-friendly edit controls. Supporting browsers grow read-only textareas to fit their contents; older Safari versions keep longer values scrollable rather than clipping them.

## Testing matrix

| Area | Happy path | Edge/failure checks |
| --- | --- | --- |
| Notifications | Open Inbox, refresh, mark read, close and reopen | Saved-feed refresh failure, no-cache failure, retry success, concurrent activation, seen IDs retained, keyboard focus return |
| Manage records | Open disclosure and use existing maintenance actions | Initial collapse, late controls, repeated preparation, replaced toolbar, no reads/writes merely from expanding |
| Profile | Open a guest and find identity, dates and stay actions near the top | Long names, 320px width, 390px phone, 1440px desktop, light/dark themes, settings accent, 44px controls |
| Detailed Care | Read complete short and multiline values | Empty values, long notes, enter edit mode and preserve 16px input text and drafts |

Local validation: 234 Node checks, five Python contracts, 14 new Care browser cases, eight existing Care hierarchy cases, and notification coverage in Chromium and WebKit (10 cases per engine plus the new offline case per engine). The final 320px/1440px stay-action and alignment checks passed in both engines. New Care coverage is included in the existing parallel CI matrix. Automated verification uses read-only synthetic fixtures. Do a final physical iPhone and Samsung Fold 4 pass: open Care, search and select a guest, expand Detailed Care, edit/cancel a field, return to the roster, open Manage records, and refresh notifications. Check portrait/landscape, enlarged text, safe areas and keyboard overlap. Browser emulation does not replace physical device verification.

## Next backlog item

Records & forms document recovery: inspect returning from the PDF uploader in mobile/PWA; refresh only the selected stay after explicit upload intent, reject responses for a different selected identity, and avoid eager document reads. Preserve current OCR behavior.
