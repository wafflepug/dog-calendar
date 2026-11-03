# Care roster panel removal — 4 November 2026

Removed the pictured search/utility panel: dog/owner/ID search, Needs attention, Today's work, Manage records and match-count status. Staying, Arriving, Past, guest cards and guest actions remain available.

The toolbar is explicitly marked removed, hidden from rendering/focus and styled against legacy display overrides. The search node remains disabled for compatibility. Canonical filtering and contextual empty-state copy ignore its value. Workflow filtering reports All stays and matches all guests while preserving its check-in/out API helpers. Guest status tabs still limit the visible stay category. No new script, request, backend action or data change.

Verified syntax/diff and fictional phone/desktop screenshots. The toolbar was not visible; all three stay tabs remained; three guests stayed visible after injecting a stale nonmatching query; workflow mode was All; no page errors. No production writes or regression suites.

Before/after screenshots: output/care-roster-panel-review/before-390.png and after-390.png (also 1440px). Revision 2026.11.04.04. One Luna task plus lead review; exact tokens unavailable. Next: reduce repeated blank optional fields in detailed Care.
