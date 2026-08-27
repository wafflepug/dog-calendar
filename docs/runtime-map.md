# Waffle House Runtime Map — Phase 3A

Build: `2026.08.27.04`

## Browser entry points

Every application HTML page loads only:

- `waffle-runtime.css`
- `waffle-bootstrap.js`

`waffle-bootstrap.js` owns the approved shared compatibility order and performs the maintenance/build gates.

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
          ├─ logs.js                   # Logs page adapter; data renderer remains in waffle-app.js
          └─ waffle-ai.js              # Ask Waffle UI/client stack
```

## Canonical ownership rules

- Calendar UI changes belong in `calendar.js`.
- Care/Guest Directory UI changes belong in `care.js`.
- Organiser UI/interaction changes belong in `organiser.js` and `organiser.css`.
- Logs page-specific behavior belongs in `logs.js`; shared Audit data/query rendering remains in `waffle-app.js` until the Phase 3C data-layer split.
- Shared navigation, mobile shell, mobile header rail, Quick Action completion and final UI contract belong in `waffle-ui.js`.
- Ask Waffle browser/UI behavior belongs in `waffle-ai.js`; provider/data routes remain in Apps Script.

## Legacy policy

Historical `waffle-v11.1.*` feature files remain in the repository for rollback/reference during Phase 3A, but are not allowed to re-enter the live feature loader. `legacySourceDeletion` remains `false` until Phase 3B proves each source safe to delete.

The Active Code Contract is the enforcement point for this map.

## Release verification

Build `2026.08.27.04` is the Phase 3A release candidate. This direct marker commit exists so the full GitHub Actions contract suite evaluates the generated canonical runtime and its `.04` browser entry-point pins before maintenance is reopened.
