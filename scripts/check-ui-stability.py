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


# Every app page must use the consolidated first-paint/runtime entry points.
# Historical CSS/JS remains approved source during Phase 1, but individual
# version files must no longer be wired directly into each HTML page.
for page in ("index.html", "directory.html", "reminders.html", "audit.html"):
    require(page, "waffle-runtime.css", "consolidated first-paint stylesheet must load")
    require(page, "waffle-bootstrap.js", "authoritative runtime bootstrap must load")

# The consolidated entries must still preserve the proven final UI layer.
require("waffle-runtime.css", "waffle-v11.0.5.css", "shared first-paint retirement CSS must remain in approved style order")
require("waffle-bootstrap.js", '"waffle-v11.0.5.js"', "shared final UI loader must remain in approved runtime order")
require("waffle-v11.0.5.js", "'waffle-ui.js'", "canonical shared UI module must load")
require("waffle-ui.js", "WAFFLE_UI_CONTRACT", "runtime contract marker must exist inside canonical shared UI")

require("care.js", "WAFFLE_CARE_CANONICAL", "Care must run through the canonical Care module")
require("care.js", "v11160DesktopCareRebuildVersion", "canonical Care must preserve the proven desktop Guest Directory rebuild")
require("waffle-v11.0.5.js", "'care.js'", "shared loader must enter canonical Care instead of the historical standalone file")

# Installed PWAs must fetch current JS/CSS rather than pinning historical
# compatibility layers in the app-shell cache.
require("service-worker.js", "waffle-bootstrap.js", "PWA shell must cache the authoritative bootstrap")
require("service-worker.js", "waffle-runtime.css", "PWA shell must cache the consolidated stylesheet entry")
require("service-worker.js", "path.endsWith('.js')", "runtime JavaScript must use the network-first critical-asset path")
require("service-worker.js", "path.endsWith('.css')", "runtime CSS must use the network-first critical-asset path")
require("service-worker.js", "fetch(request, { cache: 'no-store' })", "critical runtime assets must bypass stale browser cache")

# First-paint CSS is deliberately independent from JavaScript timing.
for needle, reason in (
    ('body[data-waffle-page="calendar"] #aw37launch', "Calendar Ask Waffle cannot enter header layout"),
    ('body[data-waffle-page="directory"] #openLegacyIntakeUploadBtn', "legacy PDF upload cannot flash"),
    ('body[data-waffle-page="reminders"]', "Organiser must suppress legacy top-level content before hydration"),
):
    require("waffle-v11.0.5.css", needle, reason)

# Care exposes one canonical intake OCR action while the old legacy control
# remains hidden compatibility plumbing. The existing Apps Script workflow must
# continue to read scanned/handwritten forms and require review before
# conflicting values replace profile data.
require(
    "waffle-v11.0.5.js",
    "v11190CarePdfOcrVersion",
    "canonical Care intake OCR action must remain enabled",
)
require(
    "waffle-v11.0.5.js",
    "Scan Intake PDF",
    "Care must expose the sitter-facing intake OCR action",
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
    "Apply Selected Extracted Values",
    "OCR conflicts must remain reviewable before profile replacement",
)


compatibility_runtime = (ROOT / "waffle-v11.0.5.js").read_text(encoding="utf-8")
care_loader_match = re.search(
    r"async function ensureDesktopCareRebuild\(\) \{(.*?)\n  \}",
    compatibility_runtime,
    re.S,
)
if not care_loader_match:
    errors.append("waffle-v11.0.5.js: ensureDesktopCareRebuild() missing")
elif "waffle-v11.1.60.js" in care_loader_match.group(1):
    errors.append("waffle-v11.0.5.js: historical V11.1.60 Care source is active again")


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
