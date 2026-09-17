# Local UI regression runner

This clean-checkout runner serves the repository from `127.0.0.1:4173`, forces `WAFFLE_BASE_URL` to that URL, runs the pinned Playwright CLI directly, forwards additional Playwright arguments, preserves the test exit code, and stops the HTTP server on success, failure, or interrupt.

From a clean checkout:

```sh
npm ci
node node_modules/@playwright/test/cli.js install chromium firefox webkit
npm run test:ui:local -- --project=iphone-pro-390x844
```

The workflow’s `--with-deps` browser installation remains appropriate on a Linux CI host. Local installs should use the browser dependencies required by the host OS. Reports and failure evidence are written by the existing Playwright config to `ui-regression-report.json`, `playwright-report/`, and `test-results/`.

When `WAFFLE_BASE_URL` is loopback, the UI spec protects the Apps Script hosts with an explicit read allowlist, blocks non-read methods and mutation actions, and stubs only the maintenance-status JSONP check. Approved data reads continue normally, including after the `script.googleusercontent.com` redirect.

The runner uses `python` on Windows and `python3` elsewhere. Node.js 20 or newer is required for the runner’s built-in HTTP client.

The lifecycle tests run without Playwright or browser installation:

```sh
node --test tests/local-ui-runner.test.js
```
