#!/usr/bin/env python3
"""Build the canonical Waffle House Calendar runtime.

Phase 2 intentionally keeps the proven historical Calendar source files in the
repository for rollback, but they are no longer loaded individually at runtime.
This builder concatenates them in their proven execution order into calendar.js,
then moves the active V11.0.5 Calendar entry point to that canonical module.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD_BUILD = "2026.08.27.01"
NEW_BUILD = "2026.08.27.02"

CALENDAR_SOURCES = [
    ("waffle-v11.1.69.js", "window.v11169CalendarViewsVersion"),
    ("waffle-v11.1.66.js", "window.v11166MobileMeetVersion"),
    ("waffle-v11.1.67.js", "window.v11167NoCapacityCountVersion"),
    ("waffle-v11.1.68.js", "window.v11168CapacityHealthVersion"),
    ("waffle-v11.1.70.js", "window.v11170PotentialLabelVersion"),
    ("waffle-v11.1.71.js", "window.v11171LegacyCalendarFilterRetirementVersion"),
    ("waffle-v11.1.72.js", "window.v11172MeetOutlookAlignmentVersion"),
    ("waffle-v11.1.73.js", "window.v11173OperationsAvatarVersion"),
    ("waffle-v11.1.84.js", "window.v11184ReadableCalendarDayVersion"),
]

BUILD_REFERENCE_FILES = [
    "waffle-bootstrap.js",
    "waffle-runtime.css",
    "waffle-v11.0.5.js",
    "service-worker.js",
    "index.html",
    "directory.html",
    "reminders.html",
    "audit.html",
]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def build_calendar_bundle() -> None:
    sections: list[str] = []
    for filename, marker in CALENDAR_SOURCES:
        source = read(filename).lstrip("\ufeff")
        if marker not in source:
            raise SystemExit(f"{filename} is missing expected readiness marker {marker}")
        sections.append(
            "\n\n/* ============================================================\n"
            f"   CANONICAL CALENDAR SOURCE · {filename}\n"
            "   Preserved in proven historical execution order.\n"
            "   ============================================================ */\n"
            + source.rstrip()
            + "\n"
        )

    source_names = [name for name, _ in CALENDAR_SOURCES]
    header = f"""/* ============================================================
   WAFFLE HOUSE — CANONICAL CALENDAR MODULE
   Build {NEW_BUILD} · Canonical Source Consolidation Phase 2
   ------------------------------------------------------------
   This is the only active Calendar feature module. It contains the proven
   Calendar behavior formerly executed through nine separate V11.1.x files.

   The historical source files remain in the repository for rollback during
   Phase 2, but the active runtime must not request them individually.
   ============================================================ */
(function () {{
  'use strict';
  window.WAFFLE_CALENDAR_CANONICAL_SOURCES = Object.freeze({json.dumps(source_names)});
}})();
"""

    footer = f"""

/* ============================================================
   CANONICAL CALENDAR READY
   ============================================================ */
(function () {{
  'use strict';
  const manifest = Object.freeze({{
    build: '{NEW_BUILD}',
    version: 'calendar-phase2-1',
    sourceCount: {len(source_names)},
    sources: window.WAFFLE_CALENDAR_CANONICAL_SOURCES
  }});

  window.WAFFLE_CALENDAR_CANONICAL = manifest;
  // Backward-compatible readiness marker retained for older diagnostics only.
  // 11.1.72-outlook-alignment-bridge
  window.v11161CleanCalendarVersion = '11.1.84-readable-calendar-day-bridge';

  try {{
    window.dispatchEvent(new CustomEvent('waffle:calendar-canonical-ready', {{ detail: manifest }}));
  }} catch (_) {{}}
}})();
"""

    write("calendar.js", header + "".join(sections) + footer)


def switch_active_calendar_entry() -> None:
    path = "waffle-v11.0.5.js"
    text = read(path)
    pattern = re.compile(
        r"await loadScript\(\s*"
        r"'waffle-v11\.1\.61\.js',\s*"
        r"\(\) => !!window\.v11161CleanCalendarVersion,\s*"
        r"'11\.1\.61'\s*"
        r"\);",
        re.S,
    )
    replacement = f"""await loadScript(
      'calendar.js',
      () => !!window.WAFFLE_CALENDAR_CANONICAL,
      '{NEW_BUILD}'
    );"""
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Expected one active V11.1.61 Calendar load block, found {count}")
    write(path, updated)


def bump_build_references() -> None:
    for path in BUILD_REFERENCE_FILES:
        text = read(path)
        if OLD_BUILD in text:
            text = text.replace(OLD_BUILD, NEW_BUILD)
        write(path, text)


def harden_service_worker() -> None:
    path = "service-worker.js"
    text = read(path)
    text, count = re.subn(
        r"const WAFFLE_SW_VERSION = '[^']+';",
        f"const WAFFLE_SW_VERSION = 'v11.2.1-calendar-{NEW_BUILD}';",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update WAFFLE_SW_VERSION")

    calendar_asset = f"  './calendar.js?build={NEW_BUILD}',\n"
    if calendar_asset not in text:
        anchor = f"  './waffle-bootstrap.js?v={NEW_BUILD}',\n"
        if anchor not in text:
            raise SystemExit("Could not find bootstrap APP_SHELL entry")
        text = text.replace(anchor, anchor + calendar_asset, 1)

    write(path, text)


def update_build_manifest() -> None:
    manifest = {
        "build": NEW_BUILD,
        "runtime": "waffle-bootstrap.js",
        "styles": "waffle-runtime.css",
        "phase": "canonical-source-consolidation-2-calendar",
        "canonicalModules": {"calendar": "calendar.js"},
        "legacyCalendarSources": [name for name, _ in CALENDAR_SOURCES],
        "legacySourceDeletion": False,
    }
    write("waffle-build.json", json.dumps(manifest, indent=2) + "\n")


def validate_result() -> None:
    calendar = read("calendar.js")
    active = read("waffle-v11.0.5.js")
    worker = read("service-worker.js")
    bootstrap = read("waffle-bootstrap.js")

    if "WAFFLE_CALENDAR_CANONICAL" not in calendar:
        raise SystemExit("Canonical Calendar readiness marker missing")
    if "'calendar.js'" not in active:
        raise SystemExit("V11.0.5 does not load canonical calendar.js")
    if "'waffle-v11.1.61.js'" in active:
        raise SystemExit("V11.0.5 still actively loads the legacy Calendar bridge")
    for filename, _ in CALENDAR_SOURCES:
        if f"'./{filename}" in worker or f'"{filename}"' in bootstrap:
            raise SystemExit(f"Historical Calendar source is still pinned by active runtime: {filename}")
    if f"v11.2.1-calendar-{NEW_BUILD}" not in worker:
        raise SystemExit("Service worker Calendar build version missing")
    if f"./calendar.js?build={NEW_BUILD}" not in worker:
        raise SystemExit("Canonical Calendar is not in the app shell")

    for page in ["index.html", "directory.html", "reminders.html", "audit.html"]:
        text = read(page)
        if f"waffle-bootstrap.js?v={NEW_BUILD}" not in text:
            raise SystemExit(f"{page} does not reference the new build")
        if f"waffle-runtime.css?v={NEW_BUILD}" not in text:
            raise SystemExit(f"{page} does not reference the new stylesheet build")


if __name__ == "__main__":
    build_calendar_bundle()
    switch_active_calendar_entry()
    bump_build_references()
    harden_service_worker()
    update_build_manifest()
    validate_result()
    print(
        "Canonical Calendar built · "
        f"{len(CALENDAR_SOURCES)} historical runtime files consolidated into calendar.js · build {NEW_BUILD}"
    )
