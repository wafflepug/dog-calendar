# Care profile clarity and navigation

Release candidate 2026.10.14.03. Five UI refinements; no backend, identity, booking, or customer-data migration.

- History shows each exact trimmed owner/name phone pair once in its contact directory. Only a single unchanged pair can be omitted from repeated visits; multiple or changed pairs remain attributable to each visit.
- Photo captions wrap and use 14px text in the full runtime, including belongings captions and the viewer.
- Opening a Past profile hides its duplicate roster summary while preserving the profile identity, Dog ID, planned dates and actual checkout. Returning restores the roster.
- Empty Items, Photos and History states explain their scope. Read-only past Items do not invite unsupported edits.
- Phone Care tabs support spatial Up/Down focus movement across their three-column grid. Focus never activates a panel or loads data. Desktop horizontal keys and explicit activation remain unchanged.

## Testing matrix

1. Open Staying and Past profiles at 320px, 390px and desktop widths. Verify identity and dates, return navigation, captions and footer reachability.
2. Check repeated identical contact pairs, different owners, changed phone numbers and missing contacts. Ensure visit attribution is retained and no source records change.
3. Open empty Items/Photos/History. Verify readable scope-specific copy and existing actions. Past Items must remain read-only.
4. Use Tab, arrow keys, Home/End and Enter/Space. Focus must be visible, vertical movement must follow the mobile grid, and backend read counts must remain unchanged until activation.
5. Resize phone to desktop, use reduced motion, and retain a dirty draft while moving focus.
6. Verify existing photo failure/retry, disclosures, save and lazy-read regression suites; production smoke remains read-only.

## Next backlog item

Audit enlarged-text Care summaries and footer-safe dialog layouts with current screenshots before choosing any additional changes.
