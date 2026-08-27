# Phase 3D — Release, Regression & Observability

Phase 3D makes Waffle House releases verifiable without introducing an unauthenticated remote maintenance switch or production-data test writes.

## Release sequence

1. **Maintenance ON commit** — set `WAFFLE_MAINTENANCE_DEFAULT_ = true` in `apps-script/MaintenanceMode.js`.
2. Wait for **Deploy Google Apps Script** to confirm the live endpoint reports `enabled=true`.
3. Make the release changes while writes remain locked.
4. Require the existing contracts plus:
   - Phase 3D Release Gate
   - Phase 3D Browser Smoke
   - GitHub Pages deployment
   - Apps Script backend + Ask Waffle health
5. Review `system-status.html` if troubleshooting is needed.
6. **Maintenance OFF commit** only after the release candidate is green.
7. Wait for Apps Script to confirm `enabled=false` and for Phase 3D Browser Smoke to run the full interactive read-only suite.

If any step fails, maintenance remains ON until the failure is resolved or a rollback commit is prepared.

## Browser smoke scope

The browser suite is intentionally read-only. It verifies:

- Calendar canonical module renders.
- Care canonical module renders and its five main tabs can be clicked.
- Organiser canonical module renders.
- Logs canonical adapter renders.
- Ask Waffle and shared UI canonical modules initialise.
- Desktop theme control exists.
- Mobile menu and bottom navigation render and the drawer opens.
- During maintenance, app entry pages redirect to the maintenance page instead of hydrating the operational UI.
- Phase 3D release/status assets are actually live on GitHub Pages.

The smoke suite must never create, update, delete, submit or upload boarding data.

## Diagnostics

`waffle-diagnostics.js` loads before the legacy compatibility runtime and records a maximum of 25 recent technical failure events in browser `localStorage`.

Stored fields are limited to technical metadata such as timestamp, event type, page name, local filename, line/column and JavaScript error class. Error messages, form values, query strings and boarding/customer data are not stored.

`system-status.html` performs read-only checks for:

- deployed frontend build
- Apps Script data-service health
- Ask Waffle health
- authoritative maintenance state
- release/rollback metadata
- local browser diagnostic count

## Rollback

`waffle-release.json` records the previous known-good SHA. The **Phase 3D Rollback Readiness** workflow verifies a requested target while maintenance is live.

The readiness workflow deliberately does **not** force-move `main` and does not deploy. A rollback must be a new auditable commit that restores the known-good tree, passes all normal deployment checks, and keeps maintenance ON until validation is complete.

## Safety principle

A release is not considered healthy because a commit exists. It is healthy only when the committed source, deployed Apps Script revision, Pages assets, canonical UI modules, read-only backend health and maintenance state all agree.
