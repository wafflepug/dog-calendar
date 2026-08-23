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

ROUTE_MARKER = "WAFFLE_AI_READ_ONLY_ROUTE_V11148"
OLD_ROUTE_MARKER = "WAFFLE_AI_READ_ONLY_ROUTE_V11147"
ROUTE = f'''\n  /* {ROUTE_MARKER}: conversational Waffle AI stays read-only. */\n  if (action === "waffle_ai_health") {{\n    return getWaffleAiHealthResponseV11148_();\n  }}\n\n  if (action === "ask_waffle_ai") {{\n    return getWaffleAiConversationResponseV11148_(data);\n  }}\n'''


def main() -> int:
    text = CODE.read_text(encoding="utf-8")

    # A generated checkout may contain the previous V11.1.47 injected block.
    # Upgrade its targets/marker in-place before deciding whether to insert.
    if OLD_ROUTE_MARKER in text:
        text = text.replace(OLD_ROUTE_MARKER, ROUTE_MARKER)
        text = text.replace(
            'return getWaffleAiHealthResponse_();',
            'return getWaffleAiHealthResponseV11148_();'
        )
        text = text.replace(
            'return getWaffleAiConversationResponse_(data);',
            'return getWaffleAiConversationResponseV11148_(data);'
        )

    if ROUTE_MARKER not in text:
        anchor = '''function processReadOnlySheetAction_(data) {\n  var action =\n    String(data.action || "");\n'''
        count = text.count(anchor)
        if count < 1:
            print("Could not find processReadOnlySheetAction_ dispatcher anchor.", file=sys.stderr)
            return 2
        text = text.replace(anchor, anchor + ROUTE)
        print(f"Injected Waffle AI V11.1.48 dispatcher routes into {count} dispatcher block(s).")
    else:
        text = text.replace(
            'return getWaffleAiHealthResponse_();',
            'return getWaffleAiHealthResponseV11148_();'
        )
        text = text.replace(
            'return getWaffleAiConversationResponse_(data);',
            'return getWaffleAiConversationResponseV11148_(data);'
        )
        print("Waffle AI dispatcher routes already present; V11.1.48 targets verified.")

    registry_anchor = "var READ_ONLY_SHEET_ACTIONS_ = {\n"
    additions = ""
    if "  waffle_ai_health: true,\n" not in text:
        additions += "  waffle_ai_health: true,\n"
    if "  ask_waffle_ai: true,\n" not in text:
        additions += "  ask_waffle_ai: true,\n"

    if additions:
        count = text.count(registry_anchor)
        if count < 1:
            print("Could not find READ_ONLY_SHEET_ACTIONS_ registry anchor.", file=sys.stderr)
            return 3
        text = text.replace(registry_anchor, registry_anchor + additions)
        print(f"Registered Waffle AI routes as read-only in {count} registry block(s).")

    CODE.write_text(text, encoding="utf-8")

    final = CODE.read_text(encoding="utf-8")
    required = (
        ROUTE_MARKER,
        'action === "waffle_ai_health"',
        'getWaffleAiHealthResponseV11148_()',
        'action === "ask_waffle_ai"',
        'getWaffleAiConversationResponseV11148_(data)',
        "  waffle_ai_health: true,\n",
        "  ask_waffle_ai: true,\n",
    )
    if any(item not in final for item in required):
        print("Waffle AI router verification failed.", file=sys.stderr)
        return 4

    print("Waffle AI V11.1.48 router patch ready for clasp push.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
