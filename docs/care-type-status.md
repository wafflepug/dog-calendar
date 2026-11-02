# Care typography and status — 3 November 2026

Built: consistent Care name, heading and instruction-text sizes/line heights. Semantic roster/profile status colours: active/home green; arrival/upcoming blue; due/missing/unverified intake and missing phone amber; recorded safety risks red; past/checked-out and informational medication/weight/link-ready flags neutral. Existing visible labels remain; colour is supplemental. Explicit dark-theme palettes are included. Scope is CSS only; no operation, network or Today/Calendar behaviour changes.

Checks: CSS/diff review, entry-point JavaScript syntax checks, and read-only before/after phone/desktop roster/profile captures with synthetic guests. No regression suites, live writes or measured performance claims.

Manual review: compare arrival and missing-intake chips, open a Care profile and review headings/instructions. In normal use, review active/past/medication/safety labels in the chosen theme. No status meaning or booking data is changed by this styling.

Screenshot summary: output/care-type-status-review/review.html retains before/after roster and profile views at 390px/1440px, plus the active attention filter.

Next: make Care tools and section actions visually consistent while retaining immediate access.

Token report: Luna development; exact token usage is not exposed and is not estimated.
