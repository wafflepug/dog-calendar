# Waffle House UI Stability Contract

The app has accumulated several generations of UI patches. Older code may still be required for data compatibility, but retired visual elements must not become visible before newer UI finishes loading.

## Non-negotiable rules

1. **Final UI must be correct at first paint.** If a legacy element is retired, suppress it in the shared first-paint CSS (`waffle-v11.0.5.css`) rather than hiding it later with JavaScript.
2. **Do not replace visible UI after load when the replacement is already known.** Render the current component immediately, then hydrate its data.
3. **Compatibility DOM is allowed only when old code still needs an ID.** Move it to the hidden compatibility sink; never leave it visible as an intermediate screen.
4. **Do not add page-specific recovery timers that restore retired visual controls.** Recovery code may repair data or behaviour, but the Final UI Contract owns visible chrome.
5. **Background refresh must not rebuild a stable screen.** Keep the current screen visible while data refreshes. Replace data only when the new authoritative result is ready.
6. **Ask Waffle is floating on Calendar and Care.** It must never be inserted into `.calendar-header-branding` or participate in header flex layout.
7. **Historical PDF Intake is read-only.** `#openLegacyIntakeUploadBtn`, `[data-upload-legacy-intake]`, and `[data-reassign-legacy-intake]` must not be restored by new UI patches.
8. **Organiser is the top-level Reminders experience.** Sticky Notes remain an Organiser feature, not a visible startup page.

## Architecture

`waffle-ui-contract.js` is the final runtime authority. It runs after feature layers and normalises only visibility/placement of shared UI. It deliberately does not rebuild operational data views.

`waffle-v11.0.5.css` owns first-paint retirement rules so correctness does not depend on JavaScript speed.

`scripts/check-ui-stability.py` and `.github/workflows/ui-stability.yml` protect the contract in CI. The check verifies that every app page still loads the shared first-paint/runtime layers and blocks known legacy-restoration anti-patterns in new patch files.

## Adding a new UI change

Prefer modifying the current canonical component. If old code must remain for compatibility, keep its DOM hidden and reuse only its data/handlers. Do not create a visible old component and then replace it in a timeout, `DOMContentLoaded`, `pageshow`, `focus`, or background refresh callback.

When introducing a new canonical replacement, update all three layers together when applicable:

- first-paint CSS;
- Final UI Contract;
- service-worker cache/version.

This keeps browser, mobile PWA, and desktop PWA startup behaviour consistent.
