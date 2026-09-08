# Frontend asset revisions

The backend compatibility build stays `2026.08.28.01`. Frontend releases have a separate `ASSET_REVISION` in `waffle-bootstrap.js`.

When changing frontend assets, increment that revision and update the matching `rev` query in the four canonical HTML entry pages and the service-worker shell URLs. The bootstrap passes the revision to its scripts, and the compatibility loader passes it to canonical modules. Changed imported CSS must also receive the revision (including `waffle-app.css` in the 2026.09.09.01 release).

This is required even when changing the service-worker cache version. Existing tabs can still be controlled by the previous worker while new HTML loads. Reusing a CSS or script URL lets the old worker return stale content for that navigation. A new URL avoids that mixed release without deleting user storage or forcing a reload.

`npx playwright test --config=playwright.first-open.config.js` verifies a first navigation with a deliberately old worker and stale cache still active. It first demonstrates the unstyled legacy URL, then verifies the current HTML asset URLs produce circles without refresh. Home Guest Portraits CI runs this regression test.
