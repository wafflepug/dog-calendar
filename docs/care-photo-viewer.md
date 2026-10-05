# Care full-size viewer iteration

Three bounded improvements: mobile viewport/safe-area layout, accessible dialog focus and close behavior, and image loading/error/retry feedback. Existing gallery ownership and upload paths remain unchanged.

Acceptance and testing matrix:

1. Open a captioned photo at 320px, 390px and desktop widths in light/dark mode. The image fits and Close/Retry remain visible above fixed navigation.
2. Use Tab and Shift+Tab inside the dialog; press Escape. Focus returns to the original trigger when it still exists. Clicking image content keeps the viewer open; only Close or the backdrop dismisses it.
3. Fail the image request and retry. Retry targets the same image and performs no upload or Apps Script read.
4. Open another photo while the first is delayed, then close. Late responses cannot change the new photo or reopen the dialog.
5. Verify that closing restores page scrolling without moving the user's place or leaving the page locked.

Run the actual viewer fixture through `playwright.care-overview.config.js`, existing gallery checks, and release/carousel contracts. Physical iPhone and Fold validation remains separate from browser emulation.

Next ready backlog: simplify Records & Forms empty/loading/error states and make its primary actions readable at narrow widths. Preserve intake/OCR behavior and avoid eager document requests when the section is collapsed.
