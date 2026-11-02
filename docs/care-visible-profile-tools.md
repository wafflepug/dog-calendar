# Visible Care profile tools

## Built deliverables
- Replace the outer More tools disclosure with visible profile actions.
- Keep Change profile photo and Photo gallery alongside Edit care details, Refresh records, Copy sitter summary and Book Again.
- Use wrapping, labelled buttons with 44px minimum touch targets and keyboard focus indicators.
- Keep lengthy contact, booking and records content in their existing sections; retain lazy loading and selected-stay handlers.
- Coordinate browser cache revision 2026.11.02.05.

## Testing matrix
1. Open Care, select a guest, and find the photo/edit/refresh/summary actions without expanding More tools.
2. Open Change profile photo and Photo gallery; cancel without changing the stored photo.
3. Open Edit care details, type an unsaved draft, and verify moving focus or preparing the owner form does not erase it.
4. At 320px, 390px and desktop width, check complete labels, minimum touch targets and no horizontal overflow, in light and dark themes.
5. Navigate by keyboard; check visible focus and focus return after cancelling an action.
6. Verify Book Again and owner sharing refer to the selected dog and stay. Expanding longer sections must not trigger duplicate profile reads.
7. Cancel destructive or write actions during manual verification. Automated browser fixtures block production writes.

## Automated verification
- Chromium: 8 profile-tool checks passed across 320/390/1440 light and dark views.
- WebKit: all 6 responsive profile-tool checks passed.
- Photo editor/gallery and saved-care quick-action regressions: 4 checks passed across Chromium and WebKit.
- Updated contact and booking suites: 27 passed; mobile glance and hierarchy checks: 11 passed.
- Bootstrap/release tests: 12 passed; active runtime contract and JavaScript syntax checks passed.
- Visual review: final tool area uses matching button typography and row heights. All automated data is synthetic; no production records were changed.

## Next backlog item
Review the profile action hierarchy with real sitter feedback: keep daily tasks prominent and reduce repeated edit entry points without hiding photo access.
