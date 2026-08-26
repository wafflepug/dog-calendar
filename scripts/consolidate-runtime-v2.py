#!/usr/bin/env python3
"""Safer Phase 1 page patcher for Waffle runtime consolidation."""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("waffle_consolidator", HERE / "consolidate-runtime.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load base Waffle consolidator.")
base = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(base)


def replace_direct_tags(text: str, pattern: re.Pattern[str], replacement: str, label: str, path: str) -> str:
    seen = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal seen
        seen += 1
        return replacement if seen == 1 else ""

    output = pattern.sub(repl, text)
    if seen == 0:
        raise RuntimeError(f"No {label} tags found in {path}; refusing an ambiguous consolidation.")
    return output


def patch_page(path: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")

    style_pattern = re.compile(
        r'<link\b(?=[^>]*\brel=["\']stylesheet["\'])(?=[^>]*\bhref=["\'](?:waffle-app\.css|waffle-v[^"\']+\.css)\?[^"\']+["\'])[^>]*>\s*',
        re.I,
    )
    script_pattern = re.compile(
        r'<script\b(?=[^>]*\bsrc=["\'](?:waffle-firebase-config\.js|waffle-app\.js|waffle-v[^"\']+\.js)\?[^"\']+["\'])[^>]*>\s*</script>\s*',
        re.I,
    )

    text = replace_direct_tags(
        text,
        style_pattern,
        f'<link rel="stylesheet" href="waffle-runtime.css?v={base.BUILD}">\n    ',
        "legacy stylesheet",
        path,
    )
    text = replace_direct_tags(
        text,
        script_pattern,
        f'<script src="waffle-bootstrap.js?v={base.BUILD}"></script>\n    ',
        "legacy script",
        path,
    )

    for asset in [
        "manifest.webmanifest",
        "pwa-icon-192.png",
        "pwa-icon-512.png",
        "pwa-maskable-512.png",
        "pwa-apple-touch-icon.png",
    ]:
        text = re.sub(re.escape(asset) + r'\?v=[^"\']+', asset + f'?v={base.BUILD}', text)

    file.write_text(text, encoding="utf-8")


base.patch_page = patch_page
base.main()
