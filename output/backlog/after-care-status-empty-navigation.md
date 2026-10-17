# Next Care item: useful roster filters

Audit the existing Staying/Arriving/Past tabs, text search and lazy arrival range before adding controls. Keep this task limited to one compact, accessible filter menu based on metadata already loaded.

Suggested first filters: arriving today, leaving today and intake needing review. Distinguish missing intake from an unavailable read. Do not infer medication schedules, invent safety clearance or automatically load later arrivals.

Acceptance criteria:
- A selected filter and its loaded-result count are visible and removable with one action.
- Search, selected stay category, Back focus and scroll restoration work together.
- Same-name dogs remain separated by verified identity; no changes to write targeting.
- Keyboard and touch work at 320px and desktop widths in both themes.
- No extra reads or polling. Synthetic Chromium/WebKit tests cover no matches, unavailable metadata and deferred arrivals.

Deliver a bounded diff, actual runtime tests and a Built Deliverables / Testing Matrix / Next Backlog Item report. Audit existing coverage first; do not add a second filter system.
