# Care mobile hierarchy

Profile mode uses the existing `.is-profile-mode` state. The guest-list introduction, status filter tabs, search toolbar, PDF import control and directory refresh are hidden while a stay is selected; the alert summary, stay status, safety information and profile tabs remain available. The compact Back row stays in the normal page flow and `closeDirectoryGuestProfile()` restores the list controls.

The focused browser fixture runs the complete `directory.html` runtime with the bundled CSS cascade, a read-only CSV/Apps Script fixture, FullCalendar, and Chromium at 390px light/dark plus 1440px light. It checks long identity wrapping, visible safety state, keyboard focus on Back, hidden profile-mode list controls, and restoration of refresh/import controls after Back.

The dedicated Playwright config starts an isolated local server on port 4177:

```powershell
$env:NODE_PATH = (Resolve-Path '..\care-profile-readiness\node_modules').Path
..\care-profile-readiness\node_modules\.bin\playwright.cmd test --config=playwright.care-mobile-hierarchy.config.js
```
