#!/usr/bin/env python3
"""Inject the Waffle AI read-only route into the historical monolithic Code.js.

Code.js predates the split-file architecture and is intentionally not hand-edited
for small feature routes. The Apps Script deploy workflow runs this patch before
`clasp push`, so the deployed project always contains the route while the split
WaffleAI*.js files hold the implementation.

The patch is idempotent and fails closed if the expected dispatcher anchors move.
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CODE = ROOT / "apps-script" / "Code.js"

ROUTE_MARKER = "WAFFLE_AI_READ_ONLY_ROUTE_V11147"
ROUTE = f'''\n  /* {ROUTE_MARKER}: conversational Waffle AI stays read-only. */\n  if (action === "ask_waffle_ai") {{\n    return getWaffleAiConversationResponse_(data);\n  }}\n'''


def main() -> int:
    text = CODE.read_text(encoding="utf-8")

    if ROUTE_MARKER not in text:
        anchor = '''function processReadOnlySheetAction_(data) {\n  var action =\n    String(data.action || "");\n'''
        count = text.count(anchor)
        if count < 1:
            print("Could not find processReadOnlySheetAction_ dispatcher anchor.", file=sys.stderr)
            return 2
        text = text.replace(anchor, anchor + ROUTE)
        print(f"Injected Waffle AI dispatcher route into {count} dispatcher block(s).")
    else:
        # If the marker already exists in a generated/local checkout, upgrade an
        # older provider target rather than duplicating the route.
        text = text.replace(
            'return getWaffleAiResponse_(data);',
            'return getWaffleAiConversationResponse_(data);'
        )
        print("Waffle AI dispatcher route already present; provider target verified.")

    # The V10.8 receipt/read-only classification prevents AI questions from
    # being treated as mutation actions or creating misleading write receipts.
    registry_anchor = "var READ_ONLY_SHEET_ACTIONS_ = {\n"
    registry_entry = "  ask_waffle_ai: true,\n"
    if registry_entry not in text:
        count = text.count(registry_anchor)
        if count < 1:
            print("Could not find READ_ONLY_SHEET_ACTIONS_ registry anchor.", file=sys.stderr)
            return 3
        text = text.replace(registry_anchor, registry_anchor + registry_entry)
        print(f"Registered ask_waffle_ai as read-only in {count} registry block(s).")

    CODE.write_text(text, encoding="utf-8")

    # Verify both requirements after writing.
    final = CODE.read_text(encoding="utf-8")
    if (
        ROUTE_MARKER not in final
        or registry_entry not in final
        or 'getWaffleAiConversationResponse_(data)' not in final
    ):
        print("Waffle AI router verification failed.", file=sys.stderr)
        return 4

    print("Waffle AI router patch ready for clasp push.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
