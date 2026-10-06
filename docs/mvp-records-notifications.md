# Records and notification readability follow-up

The existing Records & forms renderers already expose separate safety, Digital intake and Legacy PDFs states. The runtime stylesheet lifts the remaining 12px loading labels and secondary error detail to 13px; their named status rows and action controls keep their existing renderer and 44px sizing.

The notification centre uses its existing Inbox and Settings renderer. Runtime overrides raise feed copy, category/count labels, tab labels, explanatory text and form text to 13px; interactive buttons and the close control are at least 44px. Accented text uses the current Settings ink token. Long notification content wraps inside the existing scrollable modal.

Automated coverage is `tests/mvp-records-notifications.browser.spec.js`, configured by `tests/mvp-records-notifications.config.js`. It runs the actual directory runtime and notification renderer with synthetic items; all outbound non-GET requests are blocked and external reads are locally stubbed. The matrix covers 320, 390, 412 and 1440px, both themes and five Settings palettes, unread/read presentation, long names and messages, focus targets, and existing local mark-read behavior.

Manual follow-up: verify on physical iPhone and Fold4 in portrait and landscape, with the software keyboard open in Notification Settings. Browser layout emulation does not establish physical-device behavior. Confirm the bottom of the modal remains reachable above the fixed navigation footer while scrolling.