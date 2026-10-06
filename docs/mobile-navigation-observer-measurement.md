# Mobile navigation observer measurement

The focused regression compares the saved pre-change `waffle-sitter-navigation.js` fixture from revision `35f0b79e9e7dcb989f6689a8532a02cdcf9faa69` with the working-tree version in Chromium and WebKit mobile emulation. It uses an in-memory page, 12 batches of 40 Calendar-like day cells, then appends and replaces late navigation controls. No app server, backend, or network fixtures are involved. Playwright instrumentation records MutationObserver callbacks and the `maintain` animation-frame calls and durations.

Install the locked dependencies and run it from the repository root:

```powershell
npm ci
npx playwright test --config=playwright.mvp-observer.config.js
```

Raw per-variant counts and diagnostic timings are written to `test-results/mvp-mobile-observer/mutation-workload-comparison-chromium-mobile.json` and `mutation-workload-comparison-webkit-mobile.json`. The assertions require all 12 unrelated Calendar child-list batches to produce zero navigation `maintain` calls in the candidate while keeping late header branding, Home branding, drawer tools, Settings tools, a wrapped Sitter Tools launcher, and a replaced header hydrated. The saved-source half provides the same-workload before measurement.

The counts demonstrate avoided navigation scans for this synthetic workload. The elapsed callback timings are diagnostic and browser-emulated; they do not establish iPhone or Galaxy Fold speedup. The interrupted full-scroll run in this task is excluded because other work changed asset revisions while it was running. The checked-in `evidence/mobile-performance-*` full scroll baseline remains untouched.
