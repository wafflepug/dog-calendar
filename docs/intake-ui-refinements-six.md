# Owner intake UI refinements

This change improves the existing seven-step owner intake template without changing its answers, reads, submission payload, draft rules, or legal and signature requirements.

## Changes

1. Step titles wrap on narrow screens instead of clipping with an ellipsis.
2. The progress indicator exposes the current step and step name to assistive technology.
3. Retry and clear-signature controls have 44px minimum touch height.
4. Required-field errors appear beside the field, link through `aria-describedby`, retain and restore prior descriptions, and focus the first invalid control. Required radio groups use one shared error ID and their question as the accessible group name.
5. Section guidance text is increased from 12px to 13px; the existing hint style is also 13px.
6. The long transport-permission question is separated from its answers, exposed as a named group, and uses 52px Yes/No choices.

## Validation

- Owner-intake browser suite: 12 cases passed in each of Chromium and WebKit (24 runs total) at 320px, 390px, and 1440px. The refinement cases also emulate light and dark `prefers-color-scheme` values; this template does not gain a dark theme from that emulation.
- Existing MVP readiness: 431 Node fixtures and five Python source contracts passed.
- `git diff --check` passed.

The browser cases execute the actual `apps-script/Intake.html` template with a stubbed `google.script.run`. They do not measure live Apps Script response times or replace manual screen-reader/physical-device checks.
