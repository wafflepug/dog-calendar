# Mobile performance baseline

This is a test-only baseline captured from the canonical local app at source
SHA `2607c3c5691329a7d2aceb61841f28051081fe5a`, with fixed application time
`2026-09-17T12:00:00.000Z`. It uses deterministic CSV fixtures, the pinned
Playwright browsers, fresh contexts for every run, and the real FullCalendar
bundle. It does not change production runtime behavior or claim physical-device
performance.

Run `npm run test:perf:mobile` to regenerate the evidence. The runner requires
the loopback server and refuses an occupied port or a non-loopback backend. It
produces four raw group files and a merged summary with 20 measured runs and 4
matched calibration runs (Today and Calendar on the iPhone/WebKit and Android/
Chromium emulations). Calibration values are shown beside measured medians;
instrumentation overhead is not subtracted. Long-task entries are reported as
unsupported where WebKit does not expose them, and layout-shift is not
collected.

The evidence is a repeatable starting point for the next Care/UI work. It does
not explain the reported three-to-five-minute profile delay; that requires
request timings from a real deployment or a backend trace. Physical iPhone and
Samsung Fold verification remains a separate acceptance step.
