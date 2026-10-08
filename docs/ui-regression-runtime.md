# UI regression runtime

The cross-device regression used to run as one serial job. On run 37762768455, the installation and application-test step took 30 minutes 27 seconds, followed by 9 minutes 3 seconds for placement tests. Only about 50 seconds of the first step was dependency/browser setup. Individual suite timings included care refinements 6.3 minutes, scroll access 2.5, loading feedback 2.9, navigation continuity 2.5, records and notifications 6.2, overview 7.6, and the placement suite 9 minutes. The workflow now starts contract checks, fixture suites, and placement shards as separate jobs so independent work can run at the same time.

## Coverage layout

The `contracts` job keeps every existing Node command and adds `tests/ui-workflow-parallel.test.js`, which checks that the workflow retains its parallel jobs and coverage.

The `fixtures` matrix runs all 13 existing Playwright config invocations, grouped as follows:

| Group | Configurations |
| --- | --- |
| overview | `playwright.care-overview.config.js` |
| refinements | `playwright.care-ui-refinements.config.js`, `playwright.care-profile.config.js`, `playwright.care-ui-polish.config.js`, `playwright.care-roster.config.js`, `playwright.returning-dogs.config.js` |
| navigation | `playwright.care-scroll-access.config.js`, `playwright.care-loading-feedback.config.js`, `playwright.care-navigation-accessibility.config.js` |
| records | `playwright.care-navigation-continuity.config.js`, `tests/mvp-records-notifications.config.js`, `playwright.mvp-observer.config.js`, `playwright.runtime-review.config.js` |

Each configuration remains a separate Playwright invocation, preserving its configured projects, assertions, timeout, retry, and worker behavior. Fixture jobs install Chromium, Firefox, and WebKit to retain the full browser and native dependency environment used by the original serial workflow, including for configs whose projects select only Chromium and WebKit.

The `placement` matrix runs the existing `npm run test:ui:local` command with `--shard=1/3`, `2/3`, or `3/3`. Each shard installs Chromium, Firefox, and WebKit to cover the existing cross-device projects. The local runner retains its existing reporters and suite behavior.

The final required check remains named `ui-regression`. It waits for all three job families and fails when any dependency fails, is skipped, or is cancelled. Matrix jobs use `fail-fast: false` so other groups can finish and upload diagnostics after an individual failure.

## Runtime expectations

Parallel jobs should reduce elapsed wall-clock time because the previously serial fixture suites and placement shards overlap. A 10–15 minute wall-clock run is an estimate, not a measured result. Total runner minutes may increase because each independent job has its own checkout, dependency installation, and browser setup. The previous run shows browser installation was about 50 seconds; caching the npm package download reduces repeat dependency setup where the hosted runner cache is available. Browser binaries are installed per job. Trial run 37836187524 exposed a separate infrastructure delay: three runners spent over ten minutes downloading apt packages from azure.archive.ubuntu.com before any tests started. Browser jobs now replace that hostname with archive.ubuntu.com in `/etc/apt/sources.list`, matching `.list` or `.sources` files under `/etc/apt/sources.list.d/`, and `/etc/apt/apt-mirrors*.txt` mirrorlist files. Runner logs showed apt resolving Azure URLs through `file:/etc/apt/apt-mirrors.txt`, so the mirrorlist files are included alongside source entries. This retains the same package signatures and repositories. Each dependency/browser installation step has a separate five-minute timeout: an infrastructure stall fails promptly with logs instead of consuming the entire 30-minute test job. Test dependency setup uses npm ci --no-audit --no-fund to avoid optional audit/funding requests; test assertions and merge gates are unchanged.

## Artifacts and local diagnosis

Every fixture group uploads a separate artifact named `ui-regression-fixtures-<group>-<run id>-<run attempt>`. Placement uploads one artifact per shard named `cross-device-ui-regression-shard-<number>-<run id>-<run attempt>`. Including the run attempt keeps artifacts from reruns separate from immutable artifacts created by earlier attempts. Artifacts retain the Playwright reports, summary and JSON report when produced, plus `test-results` evidence for 14 days. Fixture configurations receive a unique output directory under `test-results/` so one config cannot overwrite another config's evidence within its job. Placement artifacts are shard-local.

To reproduce one fixture group locally, run the commands from the workflow with that group's configuration list, for example:

```sh
npm ci
npx playwright install chromium firefox webkit
node node_modules/@playwright/test/cli.js test --config=playwright.care-overview.config.js --output=test-results/overview-playwright.care-overview
```

To reproduce a placement shard, install all three browser engines and pass the shard through the existing local runner:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:ui:local -- --shard=1/3
```

Use the matching shard number to investigate the other two placement jobs. The uploaded shard artifacts retain their own summary and failure evidence.
