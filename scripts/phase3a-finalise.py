#!/usr/bin/env python3
"""Final Phase 3A runtime normalisation.

Keeps the four HTML entry points aligned with waffle-build.json and updates the
UI stability helper to validate the final contract inside waffle-ui.js. Workflow
YAML is maintained directly through GitHub and is deliberately not rewritten by
this generated-runtime step.
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


# Build .04 is the Phase 3A runtime. All four entries must request the same
# network-first runtime version so a browser cannot mix .03 HTML with .04 JS/CSS.
for page in ("index.html", "directory.html", "reminders.html", "audit.html"):
    text = read(page).replace(f"v={PREVIOUS_BUILD}", f"v={BUILD}")
    if f"waffle-runtime.css?v={BUILD}" not in text:
        raise SystemExit(f"{page}: canonical runtime stylesheet pin missing")
    if f"waffle-bootstrap.js?v={BUILD}" not in text:
        raise SystemExit(f"{page}: canonical bootstrap pin missing")
    write(page, text)


# Final UI Contract is embedded in waffle-ui.js. The standalone historical
# source remains rollback/reference only and must not be required at runtime.
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

print("Phase 3A runtime finalisation applied: entrypoint pins and UI contract helper are canonical.")
