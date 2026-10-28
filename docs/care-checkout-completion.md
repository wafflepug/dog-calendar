# Care checkout completion

Release 2026.10.28.08. Three Care improvements reuse verified checkout receipts and existing controls. No additional backend reads or deployment.

## Built deliverables

1. Copy message and Share are available immediately after verified checkout. Full message text remains expandable; clipboard failure offers manual recovery. No message is sent automatically.
2. Successful normal and early checkout focus their matching verified completion. A different stay, hidden roster or unverified receipt cannot claim completion focus. Failed saves preserve the existing sheet and note.
3. Dismiss returns to a visible current guest near the viewport, preserving list filters and position. An empty roster falls back to search.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Normal / early success | Complete each checkout using a synthetic verified receipt | One existing write; matching completion receives focus |
| Direct message | Keep text collapsed, use Copy or supported Share | One explicit action; truthful status; no forced expansion on success |
| Clipboard blocked | Reject Copy while remaining on it | Message expands for manual selection |
| Delayed clipboard | Start Copy, collapse or move away, then reject | No focus steal; visible recovery guidance |
| Replacement | Replace/dismiss banner during a pending action | Old response cannot modify or focus the replacement |
| Identity / visibility | Request completion focus for another stay or hidden tab | No focus change |
| Return to guests | Dismiss with search above a scrolled current roster | Nearby visible guest receives focus; filters remain |
| Empty / hidden guests | Dismiss with no usable current guest | Visible search fallback; no hidden-card focus |
| Failed checkout | Reject save with a departure note | Sheet and draft retained; no completion focus |
| Responsive | Check 320px, 390px and desktop, light/dark, enlarged text | Readable actions/status, no clipping or covered controls |

Automated fixtures intercept backend traffic. Native share destinations and physical phone viewport behavior remain manual checks.

## Executed verification

412 Node fixtures and five Python contracts passed. Targeted browser coverage: 162 guided/review checks across six projects, 28 departure checks in Chromium/WebKit, seven roster action checks, 18 full-runtime workflow checks and two cache/loader checks. Full-runtime geometry checks cover 320px, 390px and 1440px in both themes. An older assertion was corrected to allow an absent empty warning container while still rejecting an erroneous intake warning; its failed 320px case passed after correction. Physical-device/native-share checks remain manual.

## Next backlog item

Audit empty-roster recovery and return from owner sharing before introducing any additional Care controls.
