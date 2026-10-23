# Care profile cleanup

This change addresses three small profile issues observed in the existing Care runtime.

## Changes

- The Back bar keeps its existing guest-list action and navigation state, with a 44px target on phone and desktop. The duplicate breadcrumb name is hidden; the full dog name stays in the profile's identity header. The existing fixed menu and header layout remains in control of their position.
- Short handover notes remain plain and visible in Care essentials. Notes longer than 180 characters start collapsed with a readable preview and “Read full note” control. Opening the native disclosure shows the complete note and a “Show less” control. An unchanged render keeps the disclosure node, open state and summary focus. Saving a revised note updates both the contact field and the Care essentials display; a note that becomes short returns to plain text.
- The five existing Care section tabs keep their labels and keyboard behavior. Decorative emoji are removed so the three-column phone layout gives more room to the words; existing focus, active, desktop, and lazy-load behavior stays in place.

Safety and medication summaries remain visible outside the handover disclosure. The note preview does not replace or truncate the note inside the expanded content.

## Acceptance

The focused browser spec uses the real local runtime and `tests/fixtures/care-daily-workflows.js` with synthetic records. It checks Back-bar geometry at 320/390/1440px in both themes plus actual doubled label text, one visible guest identity, query/filter and opener-focus restoration, short and long handover notes, unchanged disclosure focus, saved note edits, guest isolation, text-first tab labels and 44px targets. Care-read counts are checked around display and edit actions. Run it with the repository’s phone-clearance Playwright configuration and review existing Care summary and navigation regressions. Physical-phone validation remains separate.

## Task Completion Report

**Built Deliverables:** Three Care UI improvements described above, a focused real-runtime fixture, and a consistent bounded Chromium setup for the Care timing workflow. The latter retains a required 10-minute test step and distinguishes setup failure from test failure. Luna implemented the initial UI; the lead completed integration and validation.

**Testing Matrix:** The phone suite passed eight cases across Chromium/WebKit, Care summary refresh passed 14, and keyboard navigation passed one. Final focused checks also verify the compact return control and visible expanded note. All 375 Node fixtures and five Python contracts passed. Manual verification: open a long-name guest at 320/390/1440px, return to the same filtered list, expand/collapse a long note, save a revised note and a short note, then open another guest. Confirm the full identity remains readable, safety/medication stay visible, notes never cross guests, and navigation introduces no Care reads. Test themes, keyboard and doubled text; physical-phone checks remain manual.

**Next Backlog Item:** Simplify the freshness indicator and photo-maintenance actions after a visual audit, keeping one clear owner-link action and visible Safety/Medication. Reuse loaded data and existing tools; do not introduce additional profile reads or auto-send messages.

Candidate 2026.10.23.03 is separate from the published 2026.10.23.02 release. Current-head CI and live revision verification remain required before publication.
