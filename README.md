# Waffle House

Phase 3D release safety and observability validation.

## Focused local verification

Use the focused runner for a fast local check of one feature area:

```powershell
node scripts/check-focused-readiness.js --list
node scripts/check-focused-readiness.js --scope intake
node scripts/check-focused-readiness.js --scope booking
node scripts/check-focused-readiness.js --scope care
```

Each scope runs only the named unit fixture or source contract checks printed by `--list`. The runner accepts one of `intake`, `booking`, or `care`; a missing or unknown scope exits with usage error. It invokes only these repository-owned checks with `shell: false`, writes no production data, and never runs browser suites automatically. The JSON result is written to `test-results/focused-readiness.json` and includes the selected scope, actual checks, exit codes, durations, and pass/fail state. A failed check stops that scope immediately.

Focused success is limited to the listed checks. It does not replace the required full local fixture/source-contract suite (`npm run test:mvp`) or CI. Browser and device checks remain separate.

The busy-day Care journey runs as its own required fixture group in `.github/workflows/ui-regression.yml` on pull requests and pushes to `main` when its Playwright config or browser spec changes. It exercises the six viewport/browser cases defined by `playwright.care-busy-day-journey.config.js`.
