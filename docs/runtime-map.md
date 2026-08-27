# Waffle House Runtime Map — Phase 3C

Build: `2026.08.27.04`

Phase 3C keeps the browser runtime introduced in Phase 3A/3B unchanged and canonicalises the Apps Script AI backend so the committed repository is the exact source deployed by `clasp`.

## Browser entry points

Every application HTML page loads only:

- `waffle-runtime.css`
- `waffle-bootstrap.js`

`waffle-bootstrap.js` owns the approved shared compatibility order, maintenance gate and build gate.

## Canonical browser feature modules

```text
waffle-bootstrap.js
  └─ shared compatibility base
      ├─ waffle-firebase-config.js
      ├─ waffle-app.js                 # shared data/query/render core
      ├─ V10/V11 base compatibility
      └─ waffle-v11.0.5.js             # canonical feature dispatcher + OCR compatibility
          ├─ waffle-ui.js              # shared mobile shell, quick actions, final UI contract
          ├─ calendar.js               # Calendar
          ├─ care.js                   # Care / Guest Directory
          ├─ organiser.js              # Organiser
          ├─ logs.js                   # Logs adapter; shared renderer remains in waffle-app.js
          └─ waffle-ai.js              # Ask Waffle UI/client stack
```

## Canonical Apps Script AI backend

```text
apps-script/Code.js                    # committed read-only dispatcher + route registry
apps-script/WaffleAI.js                # shared AI tools/instructions and OpenAI-compatible core
apps-script/WaffleAICompat.js          # compatibility helpers still used by canonical AI
apps-script/WaffleAIProvider.js        # Groq-first provider + repaired Gemini fallback
apps-script/WaffleAICalendarFast.js    # targeted B:L calendar month fast path
apps-script/WaffleAIHealth.js          # non-billable production health diagnostics
```

`Code.js` now contains `ask_waffle_ai` and `waffle_ai_health` directly in source control. The deployment workflow validates those committed routes and performs `clasp push --force` without running a source-rewriting patch step.

The eleven versioned Waffle AI provider, health, Gemini-repair and calendar-fast patch files retired in Phase 3C are represented by the unversioned canonical files above. `Phase 3C Backend Contract` fails if those retired files or the deploy-time router patcher return.

## Canonical ownership rules

- Calendar UI changes belong in `calendar.js`.
- Care/Guest Directory UI changes belong in `care.js`.
- Organiser UI/interaction changes belong in `organiser.js` and `organiser.css`.
- Logs page-specific behavior belongs in `logs.js`; shared Audit data/query rendering remains in `waffle-app.js` until the data-layer split.
- Shared navigation, mobile shell, header rail, Quick Action completion and final UI contract belong in `waffle-ui.js`.
- Ask Waffle browser/UI behavior belongs in `waffle-ai.js`.
- Ask Waffle provider policy belongs in `apps-script/WaffleAIProvider.js`.
- Calendar AI fast answers belong in `apps-script/WaffleAICalendarFast.js`.
- Waffle AI health reporting belongs in `apps-script/WaffleAIHealth.js`.
- Read-only Apps Script route registration belongs directly in `apps-script/Code.js`.

## Deletion boundaries

Phase 3B removed the proven historical front-end feature sources that Phase 3A had already embedded into canonical browser modules. Phase 3C additionally retires only the Waffle AI backend patch stack whose final behavior was composed and syntax-validated into the canonical Apps Script files.

Profile lifecycle/storage, request-source persistence, recovery/audit and legacy intake media remain outside this tranche. Their V11-style filenames do not make them dead code; they stay deployed until a separate dependency/equivalence proof exists.

The shared browser compatibility base also remains active: `waffle-firebase-config.js`, `waffle-app.js`, the approved V10 base files, `waffle-v11.0.js`, `waffle-v11.0.4.js`, and `waffle-v11.0.5.js`.

## Enforcement

`Active Code Contract`, `UI Stability Contract`, `Phase 3B Dead Source Contract`, `Phase 3C Backend Contract`, `Maintenance Safety Contract` and the Apps Script deploy health checks enforce the current runtime boundaries. Deployments must push the exact committed Apps Script tree; no CI step may patch application source immediately before deployment.
