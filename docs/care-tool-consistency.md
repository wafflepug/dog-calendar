# Care tool consistency — 3 November 2026

Built: shared visual treatment for directly visible secondary profile tools; aligned section headings/actions with natural wrapping; clearer keyboard focus, pressed and hover feedback. Primary Care/owner-form actions and destructive controls retain their distinct hierarchy. No tools are moved into a dropdown.

Scope: Care-only CSS, preserving visible labels, status colours, handlers, loading and save behaviour. Cache revision 2026.11.03.05.

Checks: diff/CSS inspection and read-only synthetic phone/desktop before-and-after profile/tool screenshots, including a keyboard-focus preview. No regression suites or production saves.

Manual review: open a guest profile, compare photo/edit/refresh/summary/Book Again tools, tab to a tool, and inspect Safety/Feeding/Handover headings on a narrow screen. Buttons must remain immediately accessible with complete labels.

Screenshot summary: output/care-tool-consistency-review/review.html retains phone/desktop before/after views and keyboard-focus previews.

Next: saved owner-update templates using existing sharing controls.

Token report: Luna development; exact usage is not exposed and is not estimated.
