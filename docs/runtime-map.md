# Waffle House Runtime Map — Phase 3B

Build: `2026.08.27.04`

Phase 3B removes only historical front-end feature sources that Phase 3A already embedded into the canonical modules. The browser runtime itself is unchanged, so the `.04` asset pins remain valid.

## Browser entry points

Every application HTML page loads only:

- `waffle-runtime.css`
- `waffle-bootstrap.js`

`waffle-bootstrap.js` owns the approved shared compatibility order, maintenance gate and build gate.

## Canonical feature modules

```text
waffle-bootstrap.js
  └─ shared compatibility base
      ├─ waffle-firebase-config.js
      ├─ waffle-app.js                 # shared data/query/render core
      ├─ V10/V11 base compatibility
      └─ waffle-v11.0.5.js             # canonical feature dispatcher + OCR/retirement compatibility
          ├─ waffle-ui.js              # shared mobile shell, quick actions, final UI contract
          ├─ calendar.js               # Calendar
          ├─ care.js                   # Care / Guest Directory
          ├─ organiser.js              # Organiser
          ├─ logs.js                   # Logs adapter; shared renderer remains in waffle-app.js
          └─ waffle-ai.js              # Ask Waffle UI/client stack
```

## Canonical ownership rules

- Calendar UI changes belong in `calendar.js`.
- Care/Guest Directory UI changes belong in `care.js`.
- Organiser UI/interaction changes belong in `organiser.js` and `organiser.css`.
- Logs page-specific behavior belongs in `logs.js`; shared Audit data/query rendering remains in `waffle-app.js` until the data-layer split.
- Shared navigation, mobile shell, header rail, Quick Action completion and final UI contract belong in `waffle-ui.js`.
- Ask Waffle browser/UI behavior belongs in `waffle-ai.js`; provider/data routes remain in Apps Script.

## Phase 3B deletion boundary

The 26 front-end feature-era sources recorded in `waffle-build.json` under `removedHistoricalSources` have been deleted after their behavior was consolidated into the six canonical feature modules. CI now treats their reappearance as a regression.

The one-off migration builders and workflows that generated the canonical bundles are also retired. They must not be used to reconstruct old version-file runtime chains.

`waffle-ui-contract.js` is intentionally retained as a reference contract. The active runtime contract marker itself is embedded in `waffle-ui.js`.

## Compatibility that remains active

The shared base chain is deliberately retained: `waffle-firebase-config.js`, `waffle-app.js`, the approved V10 base files, `waffle-v11.0.js`, `waffle-v11.0.4.js`, and `waffle-v11.0.5.js`. These are still loaded by `waffle-bootstrap.js` and are not Phase 3B deletion candidates.

`waffle-v11.0.5.js` still owns genuine shared compatibility, including the canonical Care intake PDF/photo OCR action. Apps Script files with V11-style names are also outside this front-end cleanup because they are deployed server code, not retired browser patches.

Other historical browser files outside the proven Phase 3A source set remain pending explicit audit; Phase 3B does not mass-delete them by filename pattern.

## Enforcement

`Active Code Contract`, `UI Stability Contract`, and `Phase 3B Dead Source Contract` enforce this map. `legacySourceDeletion` is now `true` for the proven canonical feature-source set, while `remainingLegacyAuditPending` records that residual historical files still require evidence before deletion.
