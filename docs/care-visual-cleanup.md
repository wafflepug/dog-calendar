# Care visual cleanup

Release 2026.10.29.01. Implements the recommended first batch of five presentation changes, using existing Care controls and data.

## Built deliverables

1. Retain one date-specific operational/status badge, removing redundant Arrival today / Checkout today signals. Full stay dates and safety, medication, intake and reminder warnings remain.
2. Collapse Today's work after an explicit filter choice, focus its compact summary and retain one named reset action. Background updates never collapse a disclosure opened by the sitter.
3. Remove decorative nested roster borders and shadows while retaining a clear guest boundary and keyboard focus.
4. Use the configured brand colour for primary check-in, due checkout and owner-link actions. Secondary tools are neutral; early checkout and destructive actions retain their warning colours.
5. Show Next arrival only for two or more eligible visible pending check-ins. When a focused shortcut becomes unnecessary, return focus to the remaining check-in without activating it.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Status | View arriving, leaving, checked-in and past guests | One informative badge; dates and real alerts remain |
| Work filter | Choose a work filter, then reopen options | Collapses only after selection; selected mode/count and named reset remain |
| Background refresh | Refresh while work options are open | Disclosure/focus preserved; no new requests |
| Clear | Clear the active work filter with a search present | Query, tab and loaded arrival range retained |
| Arrivals | Change eligible count 1 to 2, then 2 to 1 | Shortcut appears only for multiple arrivals; no automatic check-in |
| Focus | Hold focus on shortcut versus another control while eligibility changes | Transfer only from the shortcut, never steal focus |
| Responsive | 320/390/540/1440 widths, light/dark, long names and enlarged text | Wrapping, contrast and 44px controls; no hidden footer actions |
| Safety | Review medication/intake/reminder warnings, early checkout and delete | Warnings and destructive meaning remain distinct |
| Scope | Visit Today/Calendar and compare reads | Care-only presentation; no added backend reads or writes |

Executed checks: all 412 Node and five Python MVP checks; 66 full-runtime browser checks across Chromium/WebKit at 320, 390 and 1440px; six final visual/theme checks; 32 arrival eligibility/focus checks; three filter checks and two loader/cache checks passed.

Automated checks use synthetic records. Physical-device and assistive-technology checks remain manual.

## Next backlog item

Review typography and desktop Care reading width after the five changes have been used in everyday boarding work.
