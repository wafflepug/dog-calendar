#!/usr/bin/env python3
"""Waffle House final-UI regression check.

This check does not try to lint the whole historical codebase. It protects the
current architecture from drifting back toward visible legacy-first rendering.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def require(path: str, needle: str, reason: str) -> None:
    file = ROOT / path
    if not file.exists():
        errors.append(f"{path}: missing ({reason})")
        return
    text = file.read_text(encoding="utf-8")
    if needle not in text:
        errors.append(f"{path}: missing {needle!r} ({reason})")


# Every app page must load the shared first-paint/compatibility layer.
for page in ("index.html", "directory.html", "reminders.html", "audit.html"):
    require(page, "waffle-v11.0.5.css", "shared first-paint retirement CSS must load")
    require(page, "waffle-v11.0.5.js", "shared final UI loader must load")

# The final contract must remain wired into runtime and the PWA shell.
require("waffle-v11.0.5.js", "waffle-ui-contract.js", "Final UI Contract must load last")
require("service-worker.js", "waffle-ui-contract.js", "installed PWAs must cache the Final UI Contract")
require("waffle-ui-contract.js", "WAFFLE_UI_CONTRACT", "runtime contract marker must exist")

# First-paint CSS is deliberately independent from JavaScript timing.
for needle, reason in (
    ('body[data-waffle-page="calendar"] #aw37launch', "Calendar Ask Waffle cannot enter header layout"),
    ('body[data-waffle-page="directory"] #openLegacyIntakeUploadBtn', "legacy PDF upload cannot flash"),
    ('body[data-waffle-page="reminders"]', "Organiser must suppress legacy top-level content before hydration"),
):
    require("waffle-v11.0.5.css", needle, reason)

# Care exposes one canonical PDF OCR action while the old legacy control remains
# hidden compatibility plumbing. The existing Apps Script workflow must continue
# to read scanned/handwritten forms and require review before conflicting values
# replace profile data.
require(
    "waffle-v11.0.5.js",
    "v11190CarePdfOcrVersion",
    "canonical Care PDF OCR action must remain enabled",
)
require(
    "waffle-v11.0.5.js",
    "Scan Intake PDF",
    "Care must expose the sitter-facing PDF OCR action",
)
require(
    "waffle-v11.0.5.js",
    "openLegacyIntakeUploadBtn",
    "canonical OCR action must retain the established hidden uploader fallback",
)
require(
    "apps-script/Code.js",
    "Read the entire PDF, including scanned pages, handwriting, tick boxes and printed form labels.",
    "intake OCR must continue supporting handwritten/scanned forms",
)
require(
    "apps-script/LegacyIntake.html",
    "Apply Selected PDF Values",
    "OCR conflicts must remain reviewable before profile replacement",
)


VERSION_RE = re.compile(r"waffle-v(\d+)\.(\d+)\.(\d+)\.js$")
MIN_GUARDED_VERSION = (11, 1, 46)

# These are the exact historical anti-patterns that caused the recent flashes.
# Older files are grandfathered because the Final UI Contract neutralises them;
# new patch files are not allowed to introduce the patterns again.
FORBIDDEN_NEW_PATCH_PATTERNS = (
    ("restoreLegacyIntakeControls", "do not restore retired PDF intake controls"),
    ("h.insertBefore(b,th", "do not insert Ask Waffle into the Calendar header"),
    ("header.insertBefore(b", "do not insert Ask Waffle into the Calendar header"),
    ("style.removeProperty('display')", "do not unhide retired UI in recovery code"),
    ('style.removeProperty("display")', "do not unhide retired UI in recovery code"),
)

for file in ROOT.glob("waffle-v*.js"):
    match = VERSION_RE.fullmatch(file.name)
    if not match:
        continue
    version = tuple(map(int, match.groups()))
    if version < MIN_GUARDED_VERSION:
        continue

    text = file.read_text(encoding="utf-8")
    for pattern, reason in FORBIDDEN_NEW_PATCH_PATTERNS:
        if pattern in text:
            errors.append(f"{file.name}: forbidden pattern {pattern!r} ({reason})")


if errors:
    print("UI stability contract check FAILED:\n")
    for error in errors:
        print(f" - {error}")
    print("\nSee UI-STABILITY.md before adding a new visual recovery/compatibility patch.")
    sys.exit(1)

print("UI stability contract check passed.")
