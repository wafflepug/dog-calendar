# Next Care Profile iteration

## Secondary tools in one location

As a business owner, I want less-used tools grouped consistently so that I can find common care actions without scanning repeated links.

Inspect existing Booking tools, Manage stay & care tools, Records & forms, and secondary menu actions before proposing changes. Preserve direct owner calling and the primary stay operation. Keep delete actions clearly separated. Reuse existing handlers and exact identity payloads; do not introduce backend reads when opening a tools disclosure. Deliver one keyboard-accessible location per tool, with readable labels and no duplicated links.

Acceptance: 320/390/1440px, light/dark, Chromium/WebKit; no overlap with bottom navigation; focus survives disclosure changes; no duplicate actions; current and past guests retain appropriate tools; existing missing-ID and conflict protections remain intact. Verify using synthetic data before read-only production inspection.

## Following candidates

- Contextual field editing directly from a populated care row, preserving draft conflicts and save feedback.
- A concise profile history preview that loads only on demand.
- Validate compact profile layout with long owner names and unusually long critical instructions.
