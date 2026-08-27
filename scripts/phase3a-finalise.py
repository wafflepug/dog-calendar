#!/usr/bin/env python3
"""Final Phase 3A rollout normalisation.

Keeps entry-page build pins aligned with waffle-build.json and updates CI to
validate canonical modules while preserving historical source files for rollback.
This script is intentionally idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = "2026.08.27.04"
PREVIOUS_BUILD = "2026.08.27.03"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_required(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{path}: expected migration anchor not found: {old!r}")
    write(path, text.replace(old, new, 1))


# Build .04 is the Phase 3A runtime. All four HTML entries must request the same
# network-first runtime version so a browser cannot mix .03 HTML with .04 JS/CSS.
for page in ("index.html", "directory.html", "reminders.html", "audit.html"):
    text = read(page).replace(f"v={PREVIOUS_BUILD}", f"v={BUILD}")
    if f"waffle-runtime.css?v={BUILD}" not in text:
        raise SystemExit(f"{page}: canonical runtime stylesheet pin missing")
    if f"waffle-bootstrap.js?v={BUILD}" not in text:
        raise SystemExit(f"{page}: canonical bootstrap pin missing")
    write(page, text)


# Final UI contract now lives inside waffle-ui.js; the rollback source remains
# in the repository but must not be required as a live script.
replace_required(
    "scripts/check-ui-stability.py",
    'require("waffle-v11.0.5.js", "waffle-ui-contract.js", "Final UI Contract must load last")',
    'require("waffle-v11.0.5.js", "\'waffle-ui.js\'", "canonical shared UI module must load")',
)
replace_required(
    "scripts/check-ui-stability.py",
    'require("waffle-ui-contract.js", "WAFFLE_UI_CONTRACT", "runtime contract marker must exist")',
    'require("waffle-ui.js", "WAFFLE_UI_CONTRACT", "runtime contract marker must exist inside canonical shared UI")',
)


# Active-code contract: V11.1.80 is rollback-only source now, and all historical
# UI sources except waffle-ui-contract.js must remain absent from the live loader.
replace_required(
    ".github/workflows/active-code-contract.yml",
    "expected_ui_sources = ['waffle-v11.1.75.js','waffle-v11.1.76.js','waffle-v11.1.89.js','waffle-ui-contract.js']",
    "expected_ui_sources = ['waffle-v11.1.75.js','waffle-v11.1.76.js','waffle-v11.1.80.js','waffle-v11.1.89.js','waffle-ui-contract.js']",
)
replace_required(
    ".github/workflows/active-code-contract.yml",
    "retired_live = set(expected_organiser_sources + expected_ui_sources[:3] + expected_ai_sources + expected_care_sources)",
    "retired_live = set(expected_organiser_sources + expected_ui_sources[:-1] + expected_ai_sources + expected_care_sources)",
)


# UI Stability keeps the same behavioral assertions, but the active ownership
# for the V11.1.53 and V11.1.58 behavior is now waffle-ai.js.
ui_workflow = read(".github/workflows/ui-stability.yml")
if "node --check waffle-ui.js" not in ui_workflow:
    ui_workflow = ui_workflow.replace(
        "          node --check care.js\n",
        "          node --check care.js\n          node --check organiser.js\n          node --check logs.js\n          node --check waffle-ui.js\n          node --check waffle-ai.js\n",
        1,
    )
ui_workflow = ui_workflow.replace(
    '          grep -q "waffle-v11.1.53.js" waffle-v11.0.5.js\n',
    '          grep -q "\'waffle-ai.js\'" waffle-v11.0.5.js\n',
    1,
)
for old in (
    "          grep -q \"'calendar', 'directory', 'reminders', 'audit'\" waffle-v11.1.53.js\n",
    "          grep -q \"removeEverythingAfterFooter\" waffle-v11.1.53.js\n",
    "          grep -q \".aw37-foot ~ \\\\*\" waffle-v11.1.53.js\n",
    "          grep -q \"label.textContent = 'Organiser'\" waffle-v11.1.53.js\n",
):
    ui_workflow = ui_workflow.replace(old, old.replace("waffle-v11.1.53.js", "waffle-ai.js"), 1)
ui_workflow = ui_workflow.replace(
    '          if grep -q "event.stopImmediatePropagation" waffle-v11.1.53.js; then\n',
    '          if grep -q "event.stopImmediatePropagation" waffle-ai.js; then\n',
    1,
)
ui_workflow = ui_workflow.replace(
    '          grep -q "waffle-v11.1.58.js" waffle-v11.0.5.js\n',
    '          grep -q "\'waffle-ai.js\'" waffle-v11.0.5.js\n',
    1,
)
for needle in (
    "SpeechRecognition",
    "webkitSpeechRecognition",
    "recognition.lang = 'en-AU'",
    "Listening…",
    "aw58-listening-avatar",
    "window.v11158WaffleSpeechVersion",
):
    old = f'          grep -q "{needle}" waffle-v11.1.58.js\n'
    new = f'          grep -q "{needle}" waffle-ai.js\n'
    ui_workflow = ui_workflow.replace(old, new, 1)
write(".github/workflows/ui-stability.yml", ui_workflow)


# The mobile shell contract is now intentionally canonical-first. Historical
# V11.1.75/76/80/89 files are checked only as rollback sources, never as runtime.
mobile_workflow = r'''name: Mobile Sitter Shell

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  contents: read

jobs:
  mobile-sitter-shell:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Validate canonical mobile sitter shell
        run: |
          node --check waffle-bootstrap.js
          node --check waffle-v11.0.5.js
          node --check waffle-ui.js
          node --check organiser.js
          node --check service-worker.js

          grep -q '"waffle-v11.0.5.js"' waffle-bootstrap.js
          grep -q "'waffle-ui.js'" waffle-v11.0.5.js
          grep -q "WAFFLE_UI_CANONICAL" waffle-ui.js

          # Proven mobile shell/footer/header/Quick Action behavior is embedded
          # in the single canonical shared UI module.
          grep -q "v11175MobileSitterShellVersion" waffle-ui.js
          grep -q "v11176AuthoritativeMobileFooterVersion" waffle-ui.js
          grep -q "v11178UniformMobileFooterVersion" waffle-ui.js
          grep -q "v11180MobileHeaderRailVersion" waffle-ui.js
          grep -q "v11181MobileHeaderAvatarsVersion" waffle-ui.js
          grep -q "v11182CleanMobileTodayHeaderVersion" waffle-ui.js
          grep -q "v11189MobileQuickActionCompletionVersion" waffle-ui.js

          grep -q "index.html?view=today" waffle-ui.js
          grep -q "index.html?view=calendar" waffle-ui.js
          grep -q "Today" waffle-ui.js
          grep -q "Calendar" waffle-ui.js
          grep -q "Care" waffle-ui.js
          grep -q "Organiser" waffle-ui.js
          grep -q "Logs" waffle-ui.js
          grep -q "Quick Add" waffle-ui.js
          grep -q "Ask Waffle" waffle-ui.js
          grep -q "Appearance &amp; Colour" waffle-ui.js
          grep -q "grid-template-columns:repeat(5" waffle-ui.js
          grep -q "data-wh75-mobile-view" waffle-ui.js

          grep -q "nav.app-tabs" waffle-ui.js
          grep -q "#v1118MobileNav" waffle-ui.js
          grep -q "ensureBottomNav" waffle-ui.js
          grep -q "today-calendar-add-care-waffle-ai" waffle-ui.js
          grep -q "waffle-today-avatar-v1178.svg" waffle-ui.js
          grep -q "waffle-calendar-avatar-v1178.svg" waffle-ui.js
          grep -q "waffle-care-avatar-v1178.svg" waffle-ui.js
          grep -q "wh78-avatar-shell" waffle-ui.js
          grep -q "Waffle AI" waffle-ui.js

          grep -q "calendar-brand-logo" waffle-ui.js
          grep -q "wh80MobileHeaderRail" waffle-ui.js
          grep -q "wh81MobileInstallSlot" waffle-ui.js
          grep -q "v10TodayStatus" waffle-ui.js
          grep -q "#v10TodayDateLabel" waffle-ui.js
          grep -q "promoteTodayDate" waffle-ui.js
          grep -q "waffle-notification-avatar-v1181.svg" waffle-ui.js
          grep -q "waffle-search-avatar-v1181.svg" waffle-ui.js
          grep -q "data-wh80-role=\"notification\"" waffle-ui.js
          grep -q "data-wh80-role=\"search\"" waffle-ui.js
          grep -q "data-wh80-role=\"status\"" waffle-ui.js

          # Every Quick Action remains completable and Organiser uses its
          # canonical module instead of the historical V11.1.15 loader.
          grep -q 'data-v10-quick-action="boarding"' waffle-app.js
          grep -q 'data-v10-quick-action="potential"' waffle-app.js
          grep -q 'data-v10-quick-action="meet"' waffle-app.js
          grep -q 'data-v10-quick-action="reminder"' waffle-app.js
          grep -q '#v10QuickAddSheet' waffle-ui.js
          grep -q '#potentialStayModal' waffle-ui.js
          grep -q '#customBookingModal' waffle-ui.js
          grep -q 'overflow-y:auto!important' waffle-ui.js
          grep -q 'max-height:100dvh' waffle-ui.js
          grep -q 'Organiser · Sticky Notes' waffle-ui.js
          grep -q 'openReminderComposer' waffle-ui.js
          grep -q 'organiser.js?build=' waffle-ui.js
          grep -q 'WAFFLE_QUICK_ACTION_STATUS' waffle-ui.js
          if grep -q 'waffle-v11.1.15.js?v=' waffle-ui.js; then
            echo "Canonical shared UI must not activate historical Organiser code"
            exit 1
          fi
          if grep -q "script.src = 'waffle-v11.1.80.js" waffle-ui.js; then
            echo "Canonical shared UI must not dynamically activate V11.1.80"
            exit 1
          fi

          # Historical sources remain available for rollback only.
          test -f waffle-v11.1.75.js
          test -f waffle-v11.1.76.js
          test -f waffle-v11.1.80.js
          test -f waffle-v11.1.89.js
          test -f waffle-v11.1.15.js
          test -f waffle-v11.1.15.css

          test -f waffle-today-avatar-v1178.svg
          test -f waffle-calendar-avatar-v1178.svg
          test -f waffle-care-avatar-v1178.svg
          test -f waffle-notification-avatar-v1181.svg
          test -f waffle-search-avatar-v1181.svg
          grep -q "Waffle holding a calendar" waffle-calendar-avatar-v1178.svg
          grep -q "data:image/webp;base64" waffle-calendar-avatar-v1178.svg
          grep -q "Waffle today avatar" waffle-today-avatar-v1178.svg
          grep -q "Waffle notification avatar" waffle-notification-avatar-v1181.svg
          grep -q "Waffle Search" waffle-search-avatar-v1181.svg
          grep -q "self-contained Waffle pug search icon" waffle-search-avatar-v1181.svg
          if grep -Eq "data:image/(jpeg|webp);base64" waffle-search-avatar-v1181.svg; then
            echo "Search avatar must remain pure vector without embedded raster data"
            exit 1
          fi

          grep -q "V11.1.79 — MOBILE FOOTER TYPOGRAPHY" waffle-v11.0.5.css
          grep -q "font-size: 11px" waffle-v11.0.5.css
          grep -q "font-weight: 700" waffle-v11.0.5.css
          grep -q "V11.1.84 — MOBILE FULL-PAGE COLOUR THEMES" waffle-v11.0.5.css
          grep -q -- "--wh84-page" waffle-v11.0.5.css
          grep -q "body\[data-waffle-colour-style\] > .container" waffle-v11.0.5.css
          grep -q "#v11115OrganiserRoot" waffle-v11.0.5.css

          grep -q "waffle-bootstrap.js" service-worker.js
          grep -q "waffle-runtime.css" service-worker.js
          grep -q "waffle-ui.js" service-worker.js
          grep -q "organiser.js" service-worker.js
          grep -q "path.endsWith('.js')" service-worker.js
          grep -q "path.endsWith('.css')" service-worker.js
          grep -q "fetch(request, { cache: 'no-store' })" service-worker.js
          if grep -Eq "waffle-v11\.1\.(75|76|80|89)\.js" service-worker.js; then
            echo "Historical mobile patch JS must not be pinned in the service-worker app shell"
            exit 1
          fi

          if grep -q "style.removeProperty('display')" waffle-ui.js organiser.js; then
            echo "Canonical mobile sitter shell must not use the banned display recovery pattern"
            exit 1
          fi
'''
write(".github/workflows/mobile-sitter-shell.yml", mobile_workflow)

print("Phase 3A final rollout normalisation applied.")
