# Care overview refinement

The Care profile keeps the existing read and edit fields and lazy secondary
tabs. The overview order remains dog identity and stay dates, core owner/contact
attributes, then the saved profile and care sections. The profile and care
secondary tabs continue to use the existing cached/readiness path.

Field mapping:

- identity: dog name, breed, profile photo, stay dates, and current status;
- owner contact: owner and phone fields from the booking row;
- care instructions: saved intake attributes grouped by the existing Profile,
  Care, and Notes tabs;
- safety: the existing persisted risk flags rendered by `renderDirectoryCareProfile`;
- belongings: existing items/photos panel, still loaded only when selected.

The refinement raises scoped profile headings to 16px, labels to 12px, and
readable values/body text to 14px. Long names, owner values, notes, and safety
labels wrap within the profile card. Missing values continue to use the current
empty/unavailable text and are not treated as safe defaults. The CSS uses the
existing surface, border, text, muted-text, and accent tokens; no backend,
identity, saved-value, timeout, or eager-fetch behavior changes.

Full-runtime verification also opens the actual directory page with read-only
synthetic responses at 390px in both saved theme modes and 1440px in light mode.
These three checks verify the final compatibility CSS cascade, including 22px
wrapped names, 14px breed/dates and values, and 16px section headings. Scoped
important declarations override older compatibility rules only inside the
selected profile. The isolated layout/contrast suite passes nine checks across
Chromium and WebKit; neither suite measures live backend latency.
