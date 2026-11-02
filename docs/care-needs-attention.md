# Care Needs attention — 3 November 2026

Built: a directly accessible Staying filter/count for loaded guests with explicit care flags. Uses existing roster signals and canonical search/filter flow; makes no additional network or profile requests. Positive care flags and due reminders count; Intake missing counts only when the intake adapter explicitly reports not_prepared. Link-ready/unverified forms are excluded. Unknown operation state does not erase an explicit care flag; checked-out or out-of-date stays are excluded.

Checks: syntax and diff review, phone/desktop visual inspection and one filter interaction using synthetic read-only data. No regression suites or production writes.

Manual review: in Staying, toggle Needs attention, search for a guest, and toggle it off. Switch to Arriving/Past or open a profile; the control is hidden outside Staying. No flags must not be described as all care reviewed.

Screenshot summary: local output/care-attention-review/review.html includes actual before/after views at 390px and 1440px, plus the filtered view. This implementation establishes before/after capture as part of each subsequent delivery.

Next: one-tap routine logging, with timestamped records clearly separated from care instructions.

Token report: Luna development; exact token usage is not exposed. No token estimates are presented.
