# Expanded Care support readability

Release candidate `2026.10.30.02` · service worker `v11.4.161-care-expanded-six-2026.10.30.02`.

Six Care-only presentation refinements cover expanded profile tools, Booking setup, Records & forms, stay contact, the multiline handover note, and the existing single-field editor:

1. Wider secondary-tool columns at desktop widths make longer action labels easier to scan while retaining the current action order and disclosures.
2. At phone widths, Booking setup gives each item name and detail the full row, then places the full status beside its existing Review action.
3. Records & forms actions use a visible 3px keyboard focus ring consistent with their disclosure header.
4. At 420px and below, owner and contact fields use a single readable column; the handover field remains full width.
5. Multiline handover text gets a more open line height and stays complete.
6. The existing detail editor wraps its identity header cleanly for long names and keeps the current close, save, and discard controls reachable.

No controls, labels, warnings, hidden states, identities, drafts, handlers, data reads/writes, backend behavior, or Today/Calendar layouts change. Safety and Medication remain complete and visible. CSS remains gated to the Directory page.

## Verification matrix

- Profile tools in Chromium and WebKit at 320, 390, and 1440px, light and dark, including long Booking setup status and 200% root text.
- Records & forms across 320, 390, and 1440px in both themes, preserving loading, unknown, empty, warning, and document states; verify 44px controls and visible focus.
- Contact and handover at 320, 390, and 1440px in both themes with long names and multiline notes; verify no overflow, complete text, visible focus, and 44px edit targets.
- Detail editor with long identity context, 200% root text, short mobile visual viewport, and existing draft/focus/save guards.
- Existing Care state-preservation and UI-stability checks; exact-head CI before merge.
- Production verification remains static asset and release/capability metadata only. No guest reads, guest writes, or sample notifications.

Physical phone and mobile PWA refresh checks remain manual.
