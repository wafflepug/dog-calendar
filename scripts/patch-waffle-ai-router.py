#!/usr/bin/env python3
"""Inject the Waffle AI read-only routes into the historical monolithic Code.js.

Code.js predates the split-file architecture and is intentionally not hand-edited
for small feature routes. The Apps Script deploy workflow runs this patch before
`clasp push`, so the deployed project always contains the routes while the split
WaffleAI*.js files hold the implementation.

The patch is idempotent and fails closed if the expected dispatcher anchors move.
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CODE = ROOT / "apps-script" / "Code.js"

ROUTE_MARKER = "WAFFLE_AI_READ_ONLY_ROUTE_V11147"
ROUTE = f'''\n  /* {ROUTE_MARKER}: conversational Waffle AI stays read-only. */\n  if (action === "waffle_ai_health") {{\n    return getWaffleAiHealthResponse_();\n  }}\n\n  if (action === "ask_waffle_ai") {{\n    return getWaffleAiConversationResponse_(data);\n  }}\n'''


def main() -> int:
    text = CODE.read_text(encoding="utf-8")

    if ROUTE_MARKER not in text:
        anchor = '''function processReadOnlySheetAction_(data) {\n  var action =\n    String(data.action || "");\n'''
        count = text.count(anchor)
        if count < 1:
            print("Could not find processReadOnlySheetAction_ dispatcher anchor.", file=sys.stderr)
            return 2
        text = text.replace(anchor, anchor + ROUTE)
        print(f"Injected Waffle AI dispatcher routes into {count} dispatcher block(s).")
    else:
        # If the marker already exists in a generated/local checkout, upgrade an
        # older provider target and ensure the health route is present rather
        # than duplicating the whole route block.
        text = text.replace(
            'return getWaffleAiResponse_(data);',
            'return getWaffleAiConversationResponse_(data);'
        )
        if 'action === "waffle_ai_health"' not in text:
            marker_line = f'  /* {ROUTE_MARKER}: conversational Waffle AI stays read-only. */\n'
            text = text.replace(
                marker_line,
                marker_line +
                '  if (action === "waffle_ai_health") {\n' +
                '    return getWaffleAiHealthResponse_();\n' +
                '  }\n\n'
            )
        print("Waffle AI dispatcher routes already present; provider/health targets verified.")

    # The V10.8 receipt/read-only classification prevents AI questions and the
    # health probe from being treated as mutation actions or creating misleading
    # write receipts.
    registry_anchor = "var READ_ONLY_SHEET_ACTIONS_ = {\n"
    registry_entries = (
        "  waffle_ai_health: true,\n"
        "  ask_waffle_ai: true,\n"
    )

    if "  waffle_ai_health: true,\n" not in text or "  ask_waffle_ai: true,\n" not in text:
        count = text.count(registry_anchor)
        if count < 1:
            print("Could not find READ_ONLY_SHEET_ACTIONS_ registry anchor.", file=sys.stderr)
            return 3

        # Avoid duplicating an entry if a local/generated checkout already has
        # one of them.
        additions = ""
        if "  waffle_ai_health: true,\n" not in text:
            additions += "  waffle_ai_health: true,\n"
        if "  ask_waffle_ai: true,\n" not in text:
            additions += "  ask_waffle_ai: true,\n"
        text = text.replace(registry_anchor, registry_anchor + additions)
        print(f"Registered Waffle AI routes as read-only in {count} registry block(s).")

    CODE.write_text(text, encoding="utf-8")

    # Verify all requirements after writing.
    final = CODE.read_text(encoding="utf-8")
    required = (
        ROUTE_MARKER,
        'action === "waffle_ai_health"',
        'getWaffleAiHealthResponse_()',
        'action === "ask_waffle_ai"',
        'getWaffleAiConversationResponse_(data)',
        "  waffle_ai_health: true,\n",
        "  ask_waffle_ai: true,\n",
    )
    if any(item not in final for item in required):
        print("Waffle AI router verification failed.", file=sys.stderr)
        return 4

    print("Waffle AI router patch ready for clasp push.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
