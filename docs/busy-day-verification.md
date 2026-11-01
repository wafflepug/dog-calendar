# Care busy-day journey verification

## Coverage

`care-busy-day-journey.browser.spec.js` exercises one bounded arrival-to-pickup journey against the directory page and the existing generated Care runtime fixture. Two same-name Milo stays have distinct Dog IDs, Stay IDs, owners, dates, and synthetic full-care values. The test checks in Milo #00018, opens that stay’s current Care profile, confirms feeding, food amount/type, allergy, and medication details, then records pickup checkout for the same stay.

The assertions cover exact arrival and checkout action names, 44px minimum target height and center-point hit testing after scrolling each target into view, the exact Dog ID/Stay ID sent for check-in, the exact profile lookup identity, profile care contents, checkout identity in the guided sheet, and the final past-stay record. Synthetic write handlers update only in-memory fixture state. The fixture blocks backend non-GET requests, and the test asserts there were no attempted network writes or runtime errors.

## Browser matrix

The standalone `playwright.care-busy-day-journey.config.js` runs the scenario in Chromium and WebKit at 320×844, 390×844, and 1440×900.

Run it with:

```powershell
$env:NODE_PATH='C:/Users/Raymark/Documents/Codex/2026-09-08/waffle-house-modernization/work/local-ui-test-runner/node_modules'
& 'C:/Users/Raymark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' '../local-ui-test-runner/node_modules/@playwright/test/cli.js' test --config=playwright.care-busy-day-journey.config.js
```

## Result

Final standalone run: **6 passed** across Chromium and WebKit at all three configured viewport sizes (56.8 seconds). No production UI code was changed.
