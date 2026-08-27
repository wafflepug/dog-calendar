#!/usr/bin/env python3
"""Build the canonical Waffle House Care / Guest Directory runtime.

Phase 2 keeps the proven historical Care source in the repository for rollback,
but it is no longer loaded individually at runtime. This builder moves the
active desktop Care rebuild into care.js, advances the shared build, and updates
runtime/CI contracts so the legacy Care entry point cannot silently return.

The established intake PDF OCR action intentionally remains in the shared
V11.0.5 compatibility layer during this slice because it owns shared hidden
uploader plumbing as well as the sitter-facing Care action.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD_BUILD = "2026.08.27.02"
NEW_BUILD = "2026.08.27.03"

CARE_SOURCES = [
    ("waffle-v11.1.60.js", "window.v11160DesktopCareRebuildVersion"),
]

CALENDAR_SOURCES = [
    "waffle-v11.1.69.js",
    "waffle-v11.1.66.js",
    "waffle-v11.1.67.js",
    "waffle-v11.1.68.js",
    "waffle-v11.1.70.js",
    "waffle-v11.1.71.js",
    "waffle-v11.1.72.js",
    "waffle-v11.1.73.js",
    "waffle-v11.1.84.js",
]

BUILD_REFERENCE_FILES = [
    "waffle-bootstrap.js",
    "waffle-runtime.css",
    "waffle-v11.0.5.js",
    "calendar.js",
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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Could not update {label}: expected source text not found")
    return text.replace(old, new, 1)


def insert_after_once(text: str, anchor: str, addition: str, label: str) -> str:
    if addition.strip() in text:
        return text
    if anchor not in text:
        raise SystemExit(f"Could not update {label}: insertion anchor not found")
    return text.replace(anchor, anchor + addition, 1)


def build_care_bundle() -> None:
    sections: list[str] = []
    for filename, marker in CARE_SOURCES:
        source = read(filename).lstrip("\ufeff")
        if marker not in source:
            raise SystemExit(f"{filename} is missing expected readiness marker {marker}")
        sections.append(
            "\n\n/* ============================================================\n"
            f"   CANONICAL CARE SOURCE · {filename}\n"
            "   Preserved from the proven historical implementation.\n"
            "   ============================================================ */\n"
            + source.rstrip()
            + "\n"
        )

    source_names = [name for name, _ in CARE_SOURCES]
    header = f"""/* ============================================================
   WAFFLE HOUSE — CANONICAL CARE / GUEST DIRECTORY MODULE
   Build {NEW_BUILD} · Canonical Source Consolidation Phase 2
   ------------------------------------------------------------
   This is the only active standalone Care feature module. It contains the
   proven desktop Care / Guest Directory behavior formerly executed through
   waffle-v11.1.60.js.

   The historical source remains in the repository for rollback during Phase 2,
   but the active runtime must not request it individually.
   ============================================================ */
(function () {{
  'use strict';
  window.WAFFLE_CARE_CANONICAL_SOURCES = Object.freeze({json.dumps(source_names)});
}})();
"""

    footer = f"""

/* ============================================================
   CANONICAL CARE READY
   ============================================================ */
(function () {{
  'use strict';
  const manifest = Object.freeze({{
    build: '{NEW_BUILD}',
    version: 'care-phase2-1',
    sourceCount: {len(source_names)},
    sources: window.WAFFLE_CARE_CANONICAL_SOURCES,
    sharedCompatibility: Object.freeze(['intake-pdf-ocr-v11.1.90'])
  }});

  window.WAFFLE_CARE_CANONICAL = manifest;
  try {{
    window.dispatchEvent(new CustomEvent('waffle:care-canonical-ready', {{ detail: manifest }}));
  }} catch (_) {{}}
}})();
"""

    write("care.js", header + "".join(sections) + footer)


def switch_active_care_entry() -> None:
    path = "waffle-v11.0.5.js"
    text = read(path)
    pattern = re.compile(
        r"async function ensureDesktopCareRebuild\(\) \{\s*"
        r"if \(pageName\(\) !== 'directory'\) return;\s*"
        r"await loadScript\(\s*"
        r"'waffle-v11\.1\.60\.js',\s*"
        r"\(\) => !!window\.v11160DesktopCareRebuildVersion,\s*"
        r"'11\.1\.60'\s*"
        r"\);\s*"
        r"\}",
        re.S,
    )
    replacement = f"""async function ensureDesktopCareRebuild() {{
    if (pageName() !== 'directory') return;
    await loadScript(
      'care.js',
      () => !!window.WAFFLE_CARE_CANONICAL,
      '{NEW_BUILD}'
    );
  }}"""
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        if "'care.js'" in text and "WAFFLE_CARE_CANONICAL" in text:
            return
        raise SystemExit(f"Expected one active V11.1.60 Care load block, found {count}")
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
        f"const WAFFLE_SW_VERSION = 'v11.2.2-care-{NEW_BUILD}';",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not update WAFFLE_SW_VERSION")

    care_asset = f"  './care.js?build={NEW_BUILD}',\n"
    if care_asset not in text:
        anchor = f"  './calendar.js?build={NEW_BUILD}',\n"
        if anchor not in text:
            raise SystemExit("Could not find canonical Calendar APP_SHELL entry")
        text = text.replace(anchor, anchor + care_asset, 1)

    write(path, text)


def update_build_manifest() -> None:
    manifest = {
        "build": NEW_BUILD,
        "runtime": "waffle-bootstrap.js",
        "styles": "waffle-runtime.css",
        "phase": "canonical-source-consolidation-2-care",
        "canonicalModules": {
            "calendar": "calendar.js",
            "care": "care.js",
        },
        "legacyCalendarSources": CALENDAR_SOURCES,
        "legacyCareSources": [name for name, _ in CARE_SOURCES],
        "sharedCareCompatibility": [
            "V11.1.90 intake PDF OCR action remains in waffle-v11.0.5.js",
        ],
        "legacySourceDeletion": False,
    }
    write("waffle-build.json", json.dumps(manifest, indent=2) + "\n")


def update_active_code_contract() -> None:
    path = ".github/workflows/active-code-contract.yml"
    text = read(path)

    text = insert_after_once(
        text,
        "          node --check calendar.js\n",
        "          node --check care.js\n",
        "Active Code Contract JavaScript checks",
    )
    text = replace_once(
        text,
        "          assert manifest.get('phase') == 'canonical-source-consolidation-2-calendar'\n",
        "          assert manifest.get('phase') == 'canonical-source-consolidation-2-care'\n",
        "Active Code Contract phase",
    )
    text = insert_after_once(
        text,
        "          assert manifest.get('canonicalModules', {}).get('calendar') == 'calendar.js'\n",
        "          assert manifest.get('canonicalModules', {}).get('care') == 'care.js'\n",
        "Active Code Contract canonical Care module",
    )

    calendar_loop = """          for source in expected_calendar_sources:
              assert Path(source).exists(), f'rollback Calendar source missing: {source}'
"""
    care_manifest = """

          expected_care_sources = ['waffle-v11.1.60.js']
          assert manifest.get('legacyCareSources') == expected_care_sources
          for source in expected_care_sources:
              assert Path(source).exists(), f'rollback Care source missing: {source}'
"""
    text = insert_after_once(text, calendar_loop, care_manifest, "Active Code Contract Care rollback sources")

    calendar_loader = """          assert \"'waffle-v11.1.61.js'\" not in calendar_loader, 'legacy Calendar bridge is active again'
"""
    care_loader = """

          clean_care = re.search(
              r'async function ensureDesktopCareRebuild\\(\\) \\{(.*?)\\n  \\}',
              compatibility,
              re.S,
          )
          assert clean_care, 'ensureDesktopCareRebuild() not found'
          care_loader = clean_care.group(1)
          assert \"'care.js'\" in care_loader
          assert 'WAFFLE_CARE_CANONICAL' in care_loader
          assert \"'waffle-v11.1.60.js'\" not in care_loader, 'legacy Care source is active again'
"""
    text = insert_after_once(text, calendar_loader, care_loader, "Active Code Contract Care loader")

    calendar_bundle = """          for source in expected_calendar_sources:
              assert f'CANONICAL CALENDAR SOURCE · {source}' in calendar, f'canonical Calendar missing {source}'
"""
    care_bundle = """

          care = Path('care.js').read_text(encoding='utf-8')
          assert 'WAFFLE HOUSE — CANONICAL CARE / GUEST DIRECTORY MODULE' in care
          assert 'WAFFLE_CARE_CANONICAL' in care
          assert f\"build: '{build}'\" in care
          for source in expected_care_sources:
              assert f'CANONICAL CARE SOURCE · {source}' in care, f'canonical Care missing {source}'
          assert 'v11160DesktopCareRebuildVersion' in care
"""
    text = insert_after_once(text, calendar_bundle, care_bundle, "Active Code Contract Care bundle")

    text = replace_once(
        text,
        "          assert f'v11.2.1-calendar-{build}' in worker\n",
        "          assert f'v11.2.2-care-{build}' in worker\n",
        "Active Code Contract service worker version",
    )
    text = insert_after_once(
        text,
        "          assert f'calendar.js?build={build}' in shell\n",
        "          assert f'care.js?build={build}' in shell\n",
        "Active Code Contract Care app-shell entry",
    )
    text = replace_once(
        text,
        "          print('Active Waffle runtime contract passed · canonical Calendar · build', build)\n",
        "          print('Active Waffle runtime contract passed · canonical Calendar + Care · build', build)\n",
        "Active Code Contract success message",
    )
    write(path, text)


def update_ui_stability_contract() -> None:
    path = "scripts/check-ui-stability.py"
    text = read(path)

    anchor = """require(\"waffle-v11.0.5.js\", \"waffle-ui-contract.js\", \"Final UI Contract must load last\")
require(\"waffle-ui-contract.js\", \"WAFFLE_UI_CONTRACT\", \"runtime contract marker must exist\")
"""
    addition = """
require(\"care.js\", \"WAFFLE_CARE_CANONICAL\", \"Care must run through the canonical Care module\")
require(\"care.js\", \"v11160DesktopCareRebuildVersion\", \"canonical Care must preserve the proven desktop Guest Directory rebuild\")
require(\"waffle-v11.0.5.js\", \"'care.js'\", \"shared loader must enter canonical Care instead of the historical standalone file\")
"""
    text = insert_after_once(text, anchor, addition, "UI Stability canonical Care assertions")

    pdf_anchor = """require(
    \"apps-script/LegacyIntake.html\",
    \"Apply Selected Extracted Values\",
    \"OCR conflicts must remain reviewable before profile replacement\",
)
"""
    absence_check = """

compatibility_runtime = (ROOT / \"waffle-v11.0.5.js\").read_text(encoding=\"utf-8\")
care_loader_match = re.search(
    r\"async function ensureDesktopCareRebuild\\(\\) \\{(.*?)\\n  \\}\",
    compatibility_runtime,
    re.S,
)
if not care_loader_match:
    errors.append(\"waffle-v11.0.5.js: ensureDesktopCareRebuild() missing\")
elif \"waffle-v11.1.60.js\" in care_loader_match.group(1):
    errors.append(\"waffle-v11.0.5.js: historical V11.1.60 Care source is active again\")
"""
    text = insert_after_once(text, pdf_anchor, absence_check, "UI Stability retired Care source assertion")
    write(path, text)


def validate_result() -> None:
    care = read("care.js")
    calendar = read("calendar.js")
    active = read("waffle-v11.0.5.js")
    worker = read("service-worker.js")
    manifest = json.loads(read("waffle-build.json"))

    if "WAFFLE_CARE_CANONICAL" not in care:
        raise SystemExit("Canonical Care readiness marker missing")
    if "v11160DesktopCareRebuildVersion" not in care:
        raise SystemExit("Canonical Care lost V11.1.60 readiness behavior")
    if "'care.js'" not in active:
        raise SystemExit("V11.0.5 does not load canonical care.js")

    loader_match = re.search(
        r"async function ensureDesktopCareRebuild\(\) \{(.*?)\n  \}",
        active,
        re.S,
    )
    if not loader_match:
        raise SystemExit("Could not validate ensureDesktopCareRebuild()")
    if "waffle-v11.1.60.js" in loader_match.group(1):
        raise SystemExit("V11.0.5 still actively loads the historical Care source")

    if f"Build {NEW_BUILD}" not in care:
        raise SystemExit("Canonical Care build header missing")
    if f"Build {NEW_BUILD}" not in calendar:
        raise SystemExit("Canonical Calendar was not advanced to the shared build")
    if manifest.get("canonicalModules", {}).get("care") != "care.js":
        raise SystemExit("Build manifest does not declare canonical Care")
    if manifest.get("legacyCareSources") != [name for name, _ in CARE_SOURCES]:
        raise SystemExit("Build manifest Care rollback source list is incorrect")

    if f"v11.2.2-care-{NEW_BUILD}" not in worker:
        raise SystemExit("Service worker Care build version missing")
    if f"./care.js?build={NEW_BUILD}" not in worker:
        raise SystemExit("Canonical Care is not in the app shell")
    if f"./calendar.js?build={NEW_BUILD}" not in worker:
        raise SystemExit("Canonical Calendar app-shell entry did not advance with the shared build")

    for page in ["index.html", "directory.html", "reminders.html", "audit.html"]:
        text = read(page)
        if f"waffle-bootstrap.js?v={NEW_BUILD}" not in text:
            raise SystemExit(f"{page} does not reference the new build")
        if f"waffle-runtime.css?v={NEW_BUILD}" not in text:
            raise SystemExit(f"{page} does not reference the new stylesheet build")

    # The existing OCR action remains deliberately shared and must survive this slice.
    for needle in ["v11190CarePdfOcrVersion", "Scan Intake PDF", "openLegacyIntakeUploadBtn"]:
        if needle not in active:
            raise SystemExit(f"Shared Care OCR compatibility was lost: {needle}")


if __name__ == "__main__":
    build_care_bundle()
    switch_active_care_entry()
    bump_build_references()
    harden_service_worker()
    update_build_manifest()
    update_active_code_contract()
    update_ui_stability_contract()
    validate_result()
    print(
        "Canonical Care built · "
        f"{len(CARE_SOURCES)} historical standalone Care runtime file consolidated into care.js · build {NEW_BUILD}"
    )
