# Care re-engineering backlog

## Product goal

Make Care open quickly enough for handover and make the first profile screen
answer the sitter's immediate questions. Measure page shell, guest list,
profile shell and fresh profile data separately. A cleaner screen is not proof
that the underlying read is faster.

## 1. Attribute the long read

Instrument the actual Care runtime with privacy-safe request IDs. Measure first
paint, list readiness, profile shell, saved-data availability, fresh-detail
completion, background callers and timeout/retry time. Cover cold cache, saved
data plus refresh, and failed refresh without changing production reads.

Acceptance: repeatable evidence for all three paths; request counts by caller;
no guest identifiers or response bodies in diagnostics; client and network
time reported separately; the next optimization is selected from evidence.

## 2. Introduce an immediate Care Brief

Replace the tab-first landing view with a compact brief built from data already
present in the selected directory record. Show identity, stay dates/status,
urgent safety flags, feeding or medication summary, and freshness. Provide
large actions for Full profile, Belongings and Edit care details.

Acceptance: profile shell paints without a secondary read; critical warnings
do not rely on colour; long text has no horizontal overflow; actions are at
least 44px; backend contracts and clinical wording remain unchanged.

## 3. Load detail by user intent

Use the timing evidence to assign one owner to each read. Coalesce duplicate
in-flight reads for the same canonical stay only when evidence proves they
exist. Load belongings, history and lower-priority sections when selected,
while saved profile content remains usable during refresh.

Acceptance: one attributable selected-profile request per uncached action;
reopening uses valid saved data plus one refresh; late responses cannot cross
between dogs; secondary tabs do not read eagerly.

## 4. Consolidate profile navigation and editing

Use one header, Care Brief and section list. Keep search, list position and
focus on Back. Move edits into one deliberate mode with Unsaved, Saving, Saved,
Conflict and Failed states plus Save and Discard actions.

Acceptance: phone and desktop runtime tests cover filtered lists, removed dogs,
refresh while selected, typing during refresh, failed saves and keyboard use.
Private drafts are not persisted without a separate security decision.

## 5. Make belongings and photos resilient

Separate local preparation, upload progress and server confirmation. Retain
unfinished text and prepared photos after a recoverable failure. Confirm an
uncertain result with a read-only check before allowing resubmission.

Acceptance: no duplicate uploads; no success before server confirmation;
retry preserves prepared work; navigation warns before discard; offline state
is clear.

## Delivery order

Ship modal clearance and Care navigation continuity first. Run read attribution
next. Use its evidence to choose a client request fix or a separately reviewed
backend query/index task, then build the Care Brief on the resulting data path.
